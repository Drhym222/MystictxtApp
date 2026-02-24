import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import {
  getUserByEmail, createUser, getServices, getServiceBySlug, getServiceById,
  createOrder, getClientOrders, getAllOrders, getOrderById, updateOrderStatus,
  getNotifications, getUnreadNotificationCount, markNotificationRead,
  markAllNotificationsRead, seedDatabase, updateOrderPayment,
  getAdminSetting, setAdminSetting, getChatSessionByOrderId, getActiveChatSession,
  getRingingChatSessions, acceptChatSession, endChatSession, addChatMessage,
  getChatMessages, getLiveChatAvailability, getUserById,
} from "./storage";
import { registerSchema, loginSchema, createOrderSchema, orders, orderIntake, chatSessions, notifications, users } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

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
      const user = await getUserById((req as any).userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ id: user.id, email: user.email, role: user.role });
    } catch (err) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  app.post("/api/auth/google", async (req: Request, res: Response) => {
    try {
      const { idToken } = req.body;
      if (!idToken) {
        return res.status(400).json({ message: "Missing Google ID token" });
      }

      const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
      const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`;
      const tokenRes = await globalThis.fetch(tokenInfoUrl);
      if (!tokenRes.ok) {
        return res.status(401).json({ message: "Invalid Google token" });
      }
      const tokenData = await tokenRes.json() as any;

      if (googleClientId && tokenData.aud !== googleClientId) {
        return res.status(401).json({ message: "Token audience mismatch" });
      }

      const email = tokenData.email?.toLowerCase();
      if (!email) {
        return res.status(400).json({ message: "No email in Google token" });
      }

      let user = await getUserByEmail(email);
      if (!user) {
        const randomHash = await bcrypt.hash(Math.random().toString(36), 10);
        user = await createUser(email, randomHash, "client");
      }

      if (user.role === "admin") {
        return res.status(403).json({ message: "Admin accounts cannot use Google Sign-In" });
      }

      const token = generateToken(user.id, user.role);
      res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
    } catch (err) {
      console.error("Google auth error:", err);
      res.status(500).json({ message: "Google authentication failed" });
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

      if (service.slug === "live-chat") {
        const availability = await getLiveChatAvailability();
        if (availability.status === "offline") {
          return res.status(400).json({ message: "Live chat is currently offline. The advisor is not available." });
        }
        if (availability.status === "busy") {
          return res.status(400).json({ message: "The advisor is currently in another live chat session. Please wait and try again." });
        }
      }

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
      const chatSession = await getChatSessionByOrderId(order.id);
      res.json({ ...order, chatSession: chatSession || null });
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

  app.get("/api/live-chat/availability", async (_req: Request, res: Response) => {
    try {
      const availability = await getLiveChatAvailability();
      res.json(availability);
    } catch (err) {
      res.status(500).json({ message: "Failed to check availability" });
    }
  });

  app.get("/api/admin/settings/live-chat", authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
    try {
      const value = await getAdminSetting("live_chat_enabled");
      res.json({ enabled: value === "true" });
    } catch (err) {
      res.status(500).json({ message: "Failed to get setting" });
    }
  });

  app.put("/api/admin/settings/live-chat", authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
      const { enabled } = req.body;
      await setAdminSetting("live_chat_enabled", enabled ? "true" : "false");
      res.json({ enabled: !!enabled });
    } catch (err) {
      res.status(500).json({ message: "Failed to update setting" });
    }
  });

  app.get("/api/admin/chat/ringing", authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
    try {
      const sessions = await getRingingChatSessions();
      const enriched = [];
      for (const s of sessions) {
        const order = await getOrderById(s.orderId);
        enriched.push({ ...s, order });
      }
      res.json(enriched);
    } catch (err) {
      res.status(500).json({ message: "Failed to get ringing sessions" });
    }
  });

  app.get("/api/admin/chat/active", authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
    try {
      const session = await getActiveChatSession();
      if (!session) return res.json(null);
      const order = await getOrderById(session.orderId);
      res.json({ ...session, order });
    } catch (err) {
      res.status(500).json({ message: "Failed to get active session" });
    }
  });

  app.post("/api/admin/chat/:sessionId/accept", authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
      const existing = await getActiveChatSession();
      if (existing) {
        return res.status(400).json({ message: "You already have an active chat session. End it first." });
      }
      const session = await acceptChatSession(req.params.sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });
      res.json(session);
    } catch (err) {
      res.status(500).json({ message: "Failed to accept session" });
    }
  });

  app.post("/api/admin/chat/:sessionId/end", authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
      const session = await endChatSession(req.params.sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });
      res.json(session);
    } catch (err) {
      res.status(500).json({ message: "Failed to end session" });
    }
  });

  app.get("/api/chat/:sessionId/messages", authMiddleware, async (req: Request, res: Response) => {
    try {
      const messages = await getChatMessages(req.params.sessionId);
      res.json(messages);
    } catch (err) {
      res.status(500).json({ message: "Failed to get messages" });
    }
  });

  app.post("/api/chat/:sessionId/messages", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { message } = req.body;
      if (!message?.trim()) return res.status(400).json({ message: "Message required" });
      const msg = await addChatMessage(
        req.params.sessionId,
        (req as any).userId,
        (req as any).userRole === "admin" ? "admin" : "client",
        message.trim()
      );
      res.json(msg);
    } catch (err) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.get("/api/chat/session/:orderId", authMiddleware, async (req: Request, res: Response) => {
    try {
      let session = await getChatSessionByOrderId(req.params.orderId);
      if (!session) {
        const order = await getOrderById(req.params.orderId);
        if (order && order.status === "paid" && order.service?.slug === "live-chat") {
          const [intake] = await db.select().from(orderIntake).where(eq(orderIntake.orderId, order.id));
          const chatMinutes = (intake?.detailsJson as any)?.chatMinutes || 5;
          const [newSession] = await db.insert(chatSessions).values({
            orderId: order.id,
            clientId: order.clientId,
            purchasedMinutes: chatMinutes,
            status: "ringing",
          }).returning();
          session = newSession;

          const adminUsers = await db.select().from(users).where(eq(users.role, "admin"));
          for (const admin of adminUsers) {
            await db.insert(notifications).values({
              userId: admin.id,
              type: "live_chat_ringing",
              title: "Incoming Live Chat",
              body: `${intake?.fullName || 'A client'} is requesting a ${chatMinutes}-minute live chat session!`,
              orderId: order.id,
            });
          }
        }
      }
      res.json(session || null);
    } catch (err) {
      res.status(500).json({ message: "Failed to get session" });
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

      const user = await getUserById((req as any).userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        return res.status(500).json({ message: "Payment not configured" });
      }

      const stripe = new Stripe(stripeSecretKey);

      const host = req.get('host') || process.env.REPLIT_DEV_DOMAIN || 'mystic-text-portals.replit.app';
      const baseUrl = `https://${host}`;
      const isLiveChat = order.service?.slug === "live-chat";

      const successPath = isLiveChat ? `/live-chat/${order.id}` : `/order/${order.id}`;
      const cancelPath = `/order/${order.id}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card", "paypal"],
        mode: "payment",
        customer_email: user.email,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `MysticTxt - ${order.service?.title || 'Service'}`,
                description: `${(order as any).deliveryType === 'express' ? 'Express' : 'Standard'} delivery`,
              },
              unit_amount: order.priceUsdCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          orderId: order.id,
          isLiveChat: isLiveChat ? "1" : "0",
        },
        success_url: `${baseUrl}/api/payments/callback?session_id={CHECKOUT_SESSION_ID}&orderId=${order.id}&isChat=${isLiveChat ? '1' : '0'}`,
        cancel_url: `${baseUrl}${cancelPath}`,
      });

      res.json({
        checkoutUrl: session.url,
        sessionId: session.id,
      });
    } catch (err) {
      console.error("Payment init error:", err);
      res.status(500).json({ message: "Failed to initialize payment" });
    }
  });

  app.post("/api/payments/webhook", async (req: Request, res: Response) => {
    try {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        return res.status(500).json({ message: "Stripe not configured" });
      }

      const stripe = new Stripe(stripeSecretKey);
      const sig = req.headers["stripe-signature"] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      let event: Stripe.Event;

      if (webhookSecret && sig) {
        try {
          event = stripe.webhooks.constructEvent((req as any).rawBody, sig, webhookSecret);
        } catch (err: any) {
          console.error("Stripe webhook signature verification failed:", err.message);
          return res.status(400).json({ message: "Invalid signature" });
        }
      } else {
        event = req.body as Stripe.Event;
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.orderId;
        const paymentIntentId = session.payment_intent as string;

        if (orderId) {
          await updateOrderPayment(orderId, paymentIntentId || session.id);
          console.log("Order paid via Stripe webhook:", orderId);
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error("Webhook error:", err);
      res.json({ received: true });
    }
  });

  app.get("/api/payments/callback", async (req: Request, res: Response) => {
    const orderId = req.query.orderId as string;
    const isChat = req.query.isChat === "1";

    try {
      const sessionId = req.query.session_id as string;
      if (sessionId && orderId) {
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
        if (stripeSecretKey) {
          try {
            const stripe = new Stripe(stripeSecretKey);
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            if (session.payment_status === "paid") {
              await updateOrderPayment(orderId, (session.payment_intent as string) || session.id);
            }
          } catch (stripeErr) {
            console.error("Stripe session retrieval error:", stripeErr);
          }
        }
      }
    } catch (err) {
      console.error("Callback payment verification error:", err);
    }

    const callbackHost = req.get('host') || process.env.REPLIT_DEV_DOMAIN || 'mystic-text-portals.replit.app';
    const appBase = `https://${callbackHost}`;
    const path = isChat && orderId ? `/live-chat/${orderId}` : orderId ? `/order/${orderId}` : `/`;
    const fullRedirectUrl = `${appBase}${path}`;
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Payment Complete</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { background: #0A0A1A; color: #E8E8F0; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .container { text-align: center; padding: 40px; max-width: 400px; }
        .check { font-size: 48px; margin-bottom: 12px; }
        h1 { color: #D4A853; margin-bottom: 16px; font-size: 24px; }
        p { color: #8888AA; margin-bottom: 24px; }
        .btn { display: inline-block; background: linear-gradient(90deg, #D4A853, #B08930); color: #0A0A1A; text-decoration: none; padding: 14px 32px; border-radius: 14px; font-weight: 700; font-size: 16px; }
      </style>
      </head>
      <body>
        <div class="container">
          <div class="check">✨</div>
          <h1>Payment Successful!</h1>
          <p>${isChat ? 'Your live chat session is being set up. Redirecting...' : 'Your order has been placed. Redirecting to your order...'}</p>
          <a class="btn" href="${fullRedirectUrl}" id="returnBtn">Return to MysticTxt</a>
        </div>
        <script>
          setTimeout(function() {
            window.location.href = "${fullRedirectUrl}";
          }, 1500);
        </script>
      </body>
      </html>
    `);
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
