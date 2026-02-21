import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  getUserByEmail, createUser, getServices, getServiceBySlug, getServiceById,
  createOrder, getClientOrders, getAllOrders, getOrderById, updateOrderStatus,
  getNotifications, getUnreadNotificationCount, markNotificationRead,
  markAllNotificationsRead, seedDatabase,
} from "./storage";
import { registerSchema, loginSchema, createOrderSchema } from "@shared/schema";

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
      const { serviceId, fullName, dob, question, details } = parsed.data;
      const service = await getServiceById(serviceId);
      if (!service) return res.status(404).json({ message: "Service not found" });

      const result = await createOrder(
        (req as any).userId,
        serviceId,
        service.priceUsdCents,
        { fullName, dob, question, details }
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

  const httpServer = createServer(app);
  return httpServer;
}
