import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  getUserByEmail, createUser, getServices, getServiceBySlug, getServiceById,
  createOrder, getClientOrders, getAllOrders, getOrderById, updateOrderStatus,
  getNotifications, getUnreadNotificationCount, markNotificationRead,
  markAllNotificationsRead, seedDatabase, updateOrderPayment,
} from "./storage";
import { registerSchema, loginSchema, createOrderSchema, orders } from "@shared/schema";
import { db } from "./db";

const JWT_SECRET = process.env.SESSION_SECRET || "mystic-secret-key-change-me";

function generateToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "7d" });
}

function verifyToken(token: string): { userId: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
  } catch {
    return null;
  }
}

function authMiddleware(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const payload = verifyToken(authHeader.slice(7));
  if (!payload) {
    return res.status(401).json({ message: "Invalid token" });
  }
  (req as any).userId = payload.userId;
  (req as any).userRole = payload.role;
  next();
}

function adminMiddleware(req: Request, res: Response, next: Function) {
  if ((req as any).userRole !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  await seedDatabase();

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }
      const { email, password } = parsed.data;
      const existing = await getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "Email already registered" });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await createUser(email, passwordHash, "client");
      const token = generateToken(user.id, user.role);
      res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
    } catch (err) {
      console.error("Register error:", err);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }
      const { email, password } = parsed.data;
      const user = await getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const token = generateToken(user.id, user.role);
      res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { getUserById } = await import("./storage");
      const user = await getUserById((req as any).userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ id: user.id, email: user.email, role: user.role });
    } catch (err) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  app.get("/api/services", async (_req: Request, res: Response) => {
    try {
      const serviceList = await getServices();
      res.json(serviceList);
    } catch (err) {
      res.status(500).json({ message: "Failed to load services" });
    }
  });

  app.get("/api/services/:slug", async (req: Request, res: Response) => {
    try {
      const service = await getServiceBySlug(req.params.slug);
      if (!service) return res.status(404).json({ message: "Service not found" });
      res.json(service);
    } catch (err) {
      res.status(500).json({ message: "Failed to load service" });
    }
  });

  app.post("/api/orders", authMiddleware, async (req: Request, res: Response) => {
    try {
      const parsed = createOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }
      const { serviceId, deliveryType, fullName, dob, question, details, chatMinutes } = parsed.data;
      const service = await getServiceById(serviceId);
      if (!service) return res.status(404).json({ message: "Service not found" });

      let basePriceCents = service.priceUsdCents;
      if (service.slug === "live-chat" && chatMinutes) {
        basePriceCents = Math.ceil(chatMinutes * (399 / 5));
      }
      const expressSurcharge = 1000;
      const priceUsdCents = deliveryType === "express" ? basePriceCents + expressSurcharge : basePriceCents;

      const orderDetails = { ...details, chatMinutes: chatMinutes || undefined };
      const result = await createOrder(
        (req as any).userId,
        serviceId,
        priceUsdCents,
        deliveryType || "standard",
        { fullName, dob, question, details: orderDetails }
      );
      res.json(result);
    } catch (err) {
      console.error("Create order error:", err);
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  app.get("/api/orders", authMiddleware, async (req: Request, res: Response) => {
    try {
      const orderList = await getClientOrders((req as any).userId);
      res.json(orderList);
    } catch (err) {
      res.status(500).json({ message: "Failed to load orders" });
    }
  });

  app.get("/api/orders/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const order = await getOrderById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if ((req as any).userRole !== "admin" && order.clientId !== (req as any).userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(order);
    } catch (err) {
      res.status(500).json({ message: "Failed to load order" });
    }
  });

  app.get("/api/admin/orders", authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const orderList = await getAllOrders(status);
      res.json(orderList);
    } catch (err) {
      res.status(500).json({ message: "Failed to load orders" });
    }
  });

  app.put("/api/admin/orders/:id", authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
      const { status, adminResponse } = req.body;
      if (!status) return res.status(400).json({ message: "Status required" });
      const order = await updateOrderStatus(req.params.id, status, adminResponse);
      res.json(order);
    } catch (err) {
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  app.get("/api/notifications", authMiddleware, async (req: Request, res: Response) => {
    try {
      const notifs = await getNotifications((req as any).userId);
      res.json(notifs);
    } catch (err) {
      res.status(500).json({ message: "Failed to load notifications" });
    }
  });

  app.get("/api/notifications/unread-count", authMiddleware, async (req: Request, res: Response) => {
    try {
      const count = await getUnreadNotificationCount((req as any).userId);
      res.json({ count });
    } catch (err) {
      res.status(500).json({ message: "Failed to get count" });
    }
  });

  app.put("/api/notifications/:id/read", authMiddleware, async (req: Request, res: Response) => {
    try {
      await markNotificationRead(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to mark read" });
    }
  });

  app.put("/api/notifications/read-all", authMiddleware, async (req: Request, res: Response) => {
    try {
      await markAllNotificationsRead((req as any).userId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to mark all read" });
    }
  });

  app.post("/api/payments/initialize", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { orderId } = req.body;
      if (!orderId) return res.status(400).json({ message: "Order ID required" });

      const order = await getOrderById(orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.clientId !== (req as any).userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (order.status !== "pending") {
        return res.status(400).json({ message: "Order already processed" });
      }

      const { getUserById } = await import("./storage");
      const user = await getUserById((req as any).userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const amountUsd = order.priceUsdCents / 100;
      const reference = `MYS-${order.id.slice(0, 8)}-${Date.now().toString(36)}`;
      
      const korapaySecret = process.env.KORAPAY_SECRET_KEY;
      if (!korapaySecret) {
        return res.status(500).json({ message: "Payment not configured" });
      }

      const host = process.env.REPLIT_DEV_DOMAIN || process.env.REPL_SLUG && `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` || req.get('host') || 'mystic-text-portals.replit.app';
      const baseUrl = `https://${host}`;

      const exchangeRate = 1580;
      const amountNgn = Math.ceil(amountUsd * exchangeRate);

      const response = await globalThis.fetch("https://api.korapay.com/merchant/api/v1/charges/initialize", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${korapaySecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reference,
          amount: amountNgn,
          currency: "NGN",
          redirect_url: `${baseUrl}/api/payments/callback`,
          customer: {
            name: user.email.split("@")[0],
            email: user.email,
          },
          notification_url: `${baseUrl}/api/payments/webhook`,
          narration: `MysticTxt - ${order.service?.title || 'Service'} (${(order as any).deliveryType === 'express' ? 'Express' : 'Standard'})`,
        }),
      });

      const data = await response.json();
      
      if (!data.status) {
        console.error("Korapay init error:", JSON.stringify(data));
        const errorMsg = data.message || "Payment provider error. Please try again.";
        return res.status(500).json({ message: errorMsg });
      }

      res.json({
        checkoutUrl: data.data.checkout_url,
        reference: data.data.reference || reference,
      });
    } catch (err) {
      console.error("Payment init error:", err);
      res.status(500).json({ message: "Failed to initialize payment" });
    }
  });

  app.post("/api/payments/webhook", async (req: Request, res: Response) => {
    try {
      const { event, data } = req.body;
      console.log("Korapay webhook received:", event, data?.reference);

      if (event === "charge.success" && data) {
        const ref = data.reference || data.payment_reference;
        if (ref) {
          const orderIdMatch = ref.match(/MYS(?:TIC)?-([^-]+)-/);
          if (orderIdMatch) {
            const partialId = orderIdMatch[1];
            const allOrders = await db.select().from(orders);
            const matchedOrder = allOrders.find(o => o.id.startsWith(partialId));
            if (matchedOrder) {
              await updateOrderPayment(matchedOrder.id, ref);
              console.log("Order paid via webhook:", matchedOrder.id);
            }
          }
        }
      }

      res.json({ status: "success" });
    } catch (err) {
      console.error("Webhook error:", err);
      res.json({ status: "received" });
    }
  });

  app.get("/api/payments/callback", async (req: Request, res: Response) => {
    try {
      const reference = req.query.reference as string;
      if (reference) {
        const orderIdMatch = reference.match(/MYS(?:TIC)?-([^-]+)-/);
        if (orderIdMatch) {
          const partialId = orderIdMatch[1];
          const allOrders = await db.select().from(orders);
          const matchedOrder = allOrders.find(o => o.id.startsWith(partialId));
          const orderId = matchedOrder?.id || partialId;
          
          const korapaySecret = process.env.KORAPAY_SECRET_KEY;
          if (korapaySecret) {
            const verifyRes = await globalThis.fetch(
              `https://api.korapay.com/merchant/api/v1/charges/${reference}`,
              {
                headers: { "Authorization": `Bearer ${korapaySecret}` },
              }
            );
            const verifyData = await verifyRes.json();
            if (verifyData.status && verifyData.data?.status === "success") {
              await updateOrderPayment(orderId, reference);
            }
          }
        }
      }
      
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Payment Complete</title>
        <style>
          body { background: #0A0A1A; color: #E8E8F0; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .container { text-align: center; padding: 40px; }
          h1 { color: #D4A853; margin-bottom: 16px; }
          p { color: #8888AA; }
        </style>
        </head>
        <body>
          <div class="container">
            <h1>Payment Complete</h1>
            <p>Your payment has been processed. You can close this window and return to the app.</p>
          </div>
        </body>
        </html>
      `);
    } catch (err) {
      console.error("Callback error:", err);
      res.send("Payment processing. You can close this window.");
    }
  });

  app.get("/api/payments/verify/:orderId", authMiddleware, async (req: Request, res: Response) => {
    try {
      const order = await getOrderById(req.params.orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.clientId !== (req as any).userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json({ status: order.status, paid: order.status !== "pending" });
    } catch (err) {
      res.status(500).json({ message: "Failed to verify" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
