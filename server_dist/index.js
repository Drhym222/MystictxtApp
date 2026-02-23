var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// server/storage.ts
import { eq, desc, and } from "drizzle-orm";

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  adminSettings: () => adminSettings,
  chatMessages: () => chatMessages,
  chatSessions: () => chatSessions,
  createOrderSchema: () => createOrderSchema,
  insertUserSchema: () => insertUserSchema,
  loginSchema: () => loginSchema,
  notifications: () => notifications,
  orderIntake: () => orderIntake,
  orders: () => orders,
  registerSchema: () => registerSchema,
  services: () => services,
  users: () => users
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("client"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priceUsdCents: integer("price_usd_cents").notNull(),
  imageUrl: text("image_url"),
  active: boolean("active").notNull().default(true)
});
var orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => users.id),
  serviceId: varchar("service_id").notNull().references(() => services.id),
  deliveryType: text("delivery_type").notNull().default("standard"),
  status: text("status").notNull().default("pending"),
  priceUsdCents: integer("price_usd_cents").notNull(),
  paymentReference: text("payment_reference"),
  adminResponse: text("admin_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  paidAt: timestamp("paid_at"),
  deliveredAt: timestamp("delivered_at")
});
var orderIntake = pgTable("order_intake", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  fullName: text("full_name").notNull(),
  dobOptional: text("dob_optional"),
  question: text("question").notNull(),
  detailsJson: jsonb("details_json"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  read: boolean("read").notNull().default(false),
  orderId: varchar("order_id"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var adminSettings = pgTable("admin_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  clientId: varchar("client_id").notNull().references(() => users.id),
  purchasedMinutes: integer("purchased_minutes").notNull(),
  status: text("status").notNull().default("ringing"),
  acceptedAt: timestamp("accepted_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => chatSessions.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  senderRole: text("sender_role").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertUserSchema = createInsertSchema(users).pick({
  email: true,
  passwordHash: true,
  role: true
});
var registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});
var loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});
var createOrderSchema = z.object({
  serviceId: z.string(),
  deliveryType: z.enum(["standard", "express"]).default("standard"),
  fullName: z.string().min(1),
  dob: z.string().optional(),
  question: z.string().min(1),
  details: z.any().optional(),
  chatMinutes: z.number().optional()
});

// server/db.ts
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}
var pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});
var db = drizzle(pool, { schema: schema_exports });

// server/storage.ts
async function getUserById(id) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}
async function getUserByEmail(email) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user;
}
async function createUser(email, passwordHash, role = "client") {
  const [user] = await db.insert(users).values({ email, passwordHash, role }).returning();
  return user;
}
async function getServices() {
  return db.select().from(services).where(eq(services.active, true));
}
async function getServiceBySlug(slug) {
  const [service] = await db.select().from(services).where(eq(services.slug, slug));
  return service;
}
async function getServiceById(id) {
  const [service] = await db.select().from(services).where(eq(services.id, id));
  return service;
}
async function createOrder(clientId, serviceId, priceUsdCents, deliveryType, intake) {
  const [order] = await db.insert(orders).values({
    clientId,
    serviceId,
    priceUsdCents,
    deliveryType,
    status: "pending"
  }).returning();
  const [intakeRecord] = await db.insert(orderIntake).values({
    orderId: order.id,
    fullName: intake.fullName,
    dobOptional: intake.dob,
    question: intake.question,
    detailsJson: intake.details
  }).returning();
  return { order, intake: intakeRecord };
}
async function updateOrderPayment(orderId, paymentReference) {
  const [order] = await db.update(orders).set({
    status: "paid",
    paymentReference,
    paidAt: /* @__PURE__ */ new Date()
  }).where(eq(orders.id, orderId)).returning();
  if (order) {
    const [service] = await db.select().from(services).where(eq(services.id, order.serviceId));
    const adminUsers = await db.select().from(users).where(eq(users.role, "admin"));
    const [intake] = await db.select().from(orderIntake).where(eq(orderIntake.orderId, orderId));
    if (service?.slug === "live-chat") {
      const chatMinutes = intake?.detailsJson?.chatMinutes || 5;
      const [session] = await db.insert(chatSessions).values({
        orderId: order.id,
        clientId: order.clientId,
        purchasedMinutes: chatMinutes,
        status: "ringing"
      }).returning();
      for (const admin of adminUsers) {
        await db.insert(notifications).values({
          userId: admin.id,
          type: "live_chat_ringing",
          title: "Incoming Live Chat",
          body: `${intake?.fullName || "A client"} is requesting a ${chatMinutes}-minute live chat session!`,
          orderId: order.id
        });
      }
    } else {
      for (const admin of adminUsers) {
        await db.insert(notifications).values({
          userId: admin.id,
          type: "new_order",
          title: "New Order Received",
          body: `New paid order #${order.id.slice(0, 8)} from ${intake?.fullName || "a client"}`,
          orderId: order.id
        });
      }
    }
  }
  return order;
}
async function getClientOrders(clientId) {
  const result = await db.select().from(orders).where(eq(orders.clientId, clientId)).orderBy(desc(orders.createdAt));
  const enriched = [];
  for (const order of result) {
    const [service] = await db.select().from(services).where(eq(services.id, order.serviceId));
    const [intake] = await db.select().from(orderIntake).where(eq(orderIntake.orderId, order.id));
    enriched.push({ ...order, service, intake: intake || null });
  }
  return enriched;
}
async function getAllOrders(statusFilter) {
  const result = statusFilter ? await db.select().from(orders).where(eq(orders.status, statusFilter)).orderBy(desc(orders.createdAt)) : await db.select().from(orders).orderBy(desc(orders.createdAt));
  const enriched = [];
  for (const order of result) {
    const [service] = await db.select().from(services).where(eq(services.id, order.serviceId));
    const [intake] = await db.select().from(orderIntake).where(eq(orderIntake.orderId, order.id));
    const [client] = await db.select().from(users).where(eq(users.id, order.clientId));
    enriched.push({ ...order, service, intake: intake || null, client: { email: client?.email || "" } });
  }
  return enriched;
}
async function getOrderById(orderId) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return void 0;
  const [service] = await db.select().from(services).where(eq(services.id, order.serviceId));
  const [intake] = await db.select().from(orderIntake).where(eq(orderIntake.orderId, order.id));
  const [client] = await db.select().from(users).where(eq(users.id, order.clientId));
  return { ...order, service, intake: intake || null, client: { email: client?.email || "" } };
}
async function updateOrderStatus(orderId, status, adminResponse) {
  const updates = { status };
  if (status === "delivered") {
    updates.deliveredAt = /* @__PURE__ */ new Date();
    if (adminResponse) updates.adminResponse = adminResponse;
  }
  const [order] = await db.update(orders).set(updates).where(eq(orders.id, orderId)).returning();
  if (status === "delivered") {
    await db.insert(notifications).values({
      userId: order.clientId,
      type: "order_delivered",
      title: "Your Reading is Ready",
      body: `Your order #${order.id.slice(0, 8)} has been delivered.`,
      orderId: order.id
    });
  }
  return order;
}
async function getNotifications(userId) {
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
}
async function getUnreadNotificationCount(userId) {
  const result = await db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return result.length;
}
async function markNotificationRead(notificationId) {
  await db.update(notifications).set({ read: true }).where(eq(notifications.id, notificationId));
}
async function markAllNotificationsRead(userId) {
  await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
}
async function getAdminSetting(key) {
  const [setting] = await db.select().from(adminSettings).where(eq(adminSettings.key, key));
  return setting?.value || null;
}
async function setAdminSetting(key, value) {
  const [existing] = await db.select().from(adminSettings).where(eq(adminSettings.key, key));
  if (existing) {
    await db.update(adminSettings).set({ value, updatedAt: /* @__PURE__ */ new Date() }).where(eq(adminSettings.key, key));
  } else {
    await db.insert(adminSettings).values({ key, value });
  }
}
async function getChatSessionByOrderId(orderId) {
  const [session] = await db.select().from(chatSessions).where(eq(chatSessions.orderId, orderId));
  return session;
}
async function getActiveChatSession() {
  const [session] = await db.select().from(chatSessions).where(eq(chatSessions.status, "active"));
  return session;
}
async function getRingingChatSessions() {
  return db.select().from(chatSessions).where(eq(chatSessions.status, "ringing")).orderBy(desc(chatSessions.createdAt));
}
async function acceptChatSession(sessionId) {
  const [session] = await db.update(chatSessions).set({
    status: "active",
    acceptedAt: /* @__PURE__ */ new Date()
  }).where(eq(chatSessions.id, sessionId)).returning();
  if (session) {
    await db.insert(notifications).values({
      userId: session.clientId,
      type: "chat_accepted",
      title: "Chat Session Started",
      body: "The advisor has accepted your chat. Your session is now live!",
      orderId: session.orderId
    });
  }
  return session;
}
async function endChatSession(sessionId) {
  const [session] = await db.update(chatSessions).set({
    status: "ended",
    endedAt: /* @__PURE__ */ new Date()
  }).where(eq(chatSessions.id, sessionId)).returning();
  if (session) {
    await db.update(orders).set({ status: "delivered", deliveredAt: /* @__PURE__ */ new Date() }).where(eq(orders.id, session.orderId));
    await db.insert(notifications).values({
      userId: session.clientId,
      type: "chat_ended",
      title: "Chat Session Ended",
      body: "Your live chat session has ended. Thank you!",
      orderId: session.orderId
    });
  }
  return session;
}
async function addChatMessage(sessionId, senderId, senderRole, message) {
  const [msg] = await db.insert(chatMessages).values({
    sessionId,
    senderId,
    senderRole,
    message
  }).returning();
  return msg;
}
async function getChatMessages(sessionId) {
  return db.select().from(chatMessages).where(eq(chatMessages.sessionId, sessionId)).orderBy(chatMessages.createdAt);
}
async function getLiveChatAvailability() {
  const setting = await getAdminSetting("live_chat_enabled");
  if (setting !== "true") return { status: "offline" };
  const activeSession = await getActiveChatSession();
  if (activeSession) return { status: "busy" };
  return { status: "online" };
}
async function seedDatabase() {
  const bcrypt2 = await import("bcryptjs");
  const serviceData = [
    {
      slug: "psychic-reading",
      title: "Psychic Reading",
      description: "Gain deep insights into your life path, relationships, and future through a personalized psychic reading. Our gifted advisor connects with your energy to reveal hidden truths and guide you toward clarity.",
      priceUsdCents: 499
    },
    {
      slug: "tarot-reading",
      title: "Tarot Reading",
      description: "Unlock the wisdom of the ancient tarot cards. Each card drawn reveals a layer of your journey\u2014past influences, present energies, and future possibilities. Receive a detailed interpretation tailored to your question.",
      priceUsdCents: 499
    },
    {
      slug: "telepathy-mind-reading",
      title: "Telepathy Mind Reading",
      description: "Experience the extraordinary gift of telepathic connection. Our advisor tunes into your mental frequency to perceive thoughts, emotions, and intentions that lie beneath the surface.",
      priceUsdCents: 499
    },
    {
      slug: "find-lost-items",
      title: "Find Lost/Missing Items",
      description: "Have you lost something precious? Our gifted advisor uses psychic abilities to help locate lost or missing items, pets, and even people. Through deep intuitive connection, we can sense the energy of what you seek and guide you toward finding it.",
      priceUsdCents: 8999
    },
    {
      slug: "live-chat",
      title: "Live Chat",
      description: "Connect with our mystic advisor in real-time through live text chat. Purchase session time and get instant guidance as the advisor accepts your connection. Timer starts only when the advisor is active \u2014 ask unlimited questions within your session.",
      priceUsdCents: 399
    }
  ];
  const existingServices = await db.select().from(services);
  if (existingServices.length === 0) {
    await db.insert(services).values(serviceData);
  } else {
    for (const svc of serviceData) {
      const existing = existingServices.find((s) => s.slug === svc.slug);
      if (existing) {
        await db.update(services).set({
          title: svc.title,
          description: svc.description,
          priceUsdCents: svc.priceUsdCents
        }).where(eq(services.slug, svc.slug));
      } else {
        const oldImplants = existingServices.find((s) => s.slug === "telepathy-mind-implants");
        if (svc.slug === "find-lost-items" && oldImplants) {
          await db.update(services).set({
            slug: svc.slug,
            title: svc.title,
            description: svc.description,
            priceUsdCents: svc.priceUsdCents
          }).where(eq(services.slug, "telepathy-mind-implants"));
        } else {
          await db.insert(services).values(svc);
        }
      }
    }
  }
  const adminEmail = "mysticsughter@gmail.com";
  const adminPassword = "Makurdi@1";
  const existingAdmin = await getUserByEmail(adminEmail);
  const hash = await bcrypt2.hash(adminPassword, 12);
  if (!existingAdmin) {
    await createUser(adminEmail, hash, "admin");
  } else {
    const passwordMatch = await bcrypt2.compare(adminPassword, existingAdmin.passwordHash);
    if (!passwordMatch) {
      await db.update(users).set({ passwordHash: hash }).where(eq(users.id, existingAdmin.id));
      console.log("Admin password updated");
    }
  }
  const liveChatSetting = await getAdminSetting("live_chat_enabled");
  if (liveChatSetting === null) {
    await setAdminSetting("live_chat_enabled", "false");
  }
}

// server/routes.ts
var JWT_SECRET = process.env.SESSION_SECRET || "mystic-secret-key-change-me";
function generateToken(userId, role) {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "7d" });
}
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const payload = verifyToken(authHeader.slice(7));
  if (!payload) {
    return res.status(401).json({ message: "Invalid token" });
  }
  req.userId = payload.userId;
  req.userRole = payload.role;
  next();
}
function adminMiddleware(req, res, next) {
  if (req.userRole !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}
async function registerRoutes(app2) {
  await seedDatabase();
  app2.post("/api/auth/register", async (req, res) => {
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
  app2.post("/api/auth/login", async (req, res) => {
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
  app2.get("/api/auth/me", authMiddleware, async (req, res) => {
    try {
      const user = await getUserById(req.userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ id: user.id, email: user.email, role: user.role });
    } catch (err) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });
  app2.get("/api/services", async (_req, res) => {
    try {
      const serviceList = await getServices();
      res.json(serviceList);
    } catch (err) {
      res.status(500).json({ message: "Failed to load services" });
    }
  });
  app2.get("/api/services/:slug", async (req, res) => {
    try {
      const service = await getServiceBySlug(req.params.slug);
      if (!service) return res.status(404).json({ message: "Service not found" });
      res.json(service);
    } catch (err) {
      res.status(500).json({ message: "Failed to load service" });
    }
  });
  app2.post("/api/orders", authMiddleware, async (req, res) => {
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
      const expressSurcharge = 1e3;
      const priceUsdCents = deliveryType === "express" ? basePriceCents + expressSurcharge : basePriceCents;
      const orderDetails = { ...details, chatMinutes: chatMinutes || void 0 };
      const result = await createOrder(
        req.userId,
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
  app2.get("/api/orders", authMiddleware, async (req, res) => {
    try {
      const orderList = await getClientOrders(req.userId);
      res.json(orderList);
    } catch (err) {
      res.status(500).json({ message: "Failed to load orders" });
    }
  });
  app2.get("/api/orders/:id", authMiddleware, async (req, res) => {
    try {
      const order = await getOrderById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (req.userRole !== "admin" && order.clientId !== req.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      const chatSession = await getChatSessionByOrderId(order.id);
      res.json({ ...order, chatSession: chatSession || null });
    } catch (err) {
      res.status(500).json({ message: "Failed to load order" });
    }
  });
  app2.get("/api/admin/orders", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const status = req.query.status;
      const orderList = await getAllOrders(status);
      res.json(orderList);
    } catch (err) {
      res.status(500).json({ message: "Failed to load orders" });
    }
  });
  app2.put("/api/admin/orders/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { status, adminResponse } = req.body;
      if (!status) return res.status(400).json({ message: "Status required" });
      const order = await updateOrderStatus(req.params.id, status, adminResponse);
      res.json(order);
    } catch (err) {
      res.status(500).json({ message: "Failed to update order" });
    }
  });
  app2.get("/api/notifications", authMiddleware, async (req, res) => {
    try {
      const notifs = await getNotifications(req.userId);
      res.json(notifs);
    } catch (err) {
      res.status(500).json({ message: "Failed to load notifications" });
    }
  });
  app2.get("/api/notifications/unread-count", authMiddleware, async (req, res) => {
    try {
      const count = await getUnreadNotificationCount(req.userId);
      res.json({ count });
    } catch (err) {
      res.status(500).json({ message: "Failed to get count" });
    }
  });
  app2.put("/api/notifications/:id/read", authMiddleware, async (req, res) => {
    try {
      await markNotificationRead(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to mark read" });
    }
  });
  app2.put("/api/notifications/read-all", authMiddleware, async (req, res) => {
    try {
      await markAllNotificationsRead(req.userId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to mark all read" });
    }
  });
  app2.get("/api/live-chat/availability", async (_req, res) => {
    try {
      const availability = await getLiveChatAvailability();
      res.json(availability);
    } catch (err) {
      res.status(500).json({ message: "Failed to check availability" });
    }
  });
  app2.get("/api/admin/settings/live-chat", authMiddleware, adminMiddleware, async (_req, res) => {
    try {
      const value = await getAdminSetting("live_chat_enabled");
      res.json({ enabled: value === "true" });
    } catch (err) {
      res.status(500).json({ message: "Failed to get setting" });
    }
  });
  app2.put("/api/admin/settings/live-chat", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { enabled } = req.body;
      await setAdminSetting("live_chat_enabled", enabled ? "true" : "false");
      res.json({ enabled: !!enabled });
    } catch (err) {
      res.status(500).json({ message: "Failed to update setting" });
    }
  });
  app2.get("/api/admin/chat/ringing", authMiddleware, adminMiddleware, async (_req, res) => {
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
  app2.get("/api/admin/chat/active", authMiddleware, adminMiddleware, async (_req, res) => {
    try {
      const session = await getActiveChatSession();
      if (!session) return res.json(null);
      const order = await getOrderById(session.orderId);
      res.json({ ...session, order });
    } catch (err) {
      res.status(500).json({ message: "Failed to get active session" });
    }
  });
  app2.post("/api/admin/chat/:sessionId/accept", authMiddleware, adminMiddleware, async (req, res) => {
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
  app2.post("/api/admin/chat/:sessionId/end", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const session = await endChatSession(req.params.sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });
      res.json(session);
    } catch (err) {
      res.status(500).json({ message: "Failed to end session" });
    }
  });
  app2.get("/api/chat/:sessionId/messages", authMiddleware, async (req, res) => {
    try {
      const messages = await getChatMessages(req.params.sessionId);
      res.json(messages);
    } catch (err) {
      res.status(500).json({ message: "Failed to get messages" });
    }
  });
  app2.post("/api/chat/:sessionId/messages", authMiddleware, async (req, res) => {
    try {
      const { message } = req.body;
      if (!message?.trim()) return res.status(400).json({ message: "Message required" });
      const msg = await addChatMessage(
        req.params.sessionId,
        req.userId,
        req.userRole === "admin" ? "admin" : "client",
        message.trim()
      );
      res.json(msg);
    } catch (err) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });
  app2.get("/api/chat/session/:orderId", authMiddleware, async (req, res) => {
    try {
      const session = await getChatSessionByOrderId(req.params.orderId);
      if (!session) return res.json(null);
      res.json(session);
    } catch (err) {
      res.status(500).json({ message: "Failed to get session" });
    }
  });
  app2.post("/api/payments/initialize", authMiddleware, async (req, res) => {
    try {
      const { orderId } = req.body;
      if (!orderId) return res.status(400).json({ message: "Order ID required" });
      const order = await getOrderById(orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.clientId !== req.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (order.status !== "pending") {
        return res.status(400).json({ message: "Order already processed" });
      }
      const user = await getUserById(req.userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const amountUsd = order.priceUsdCents / 100;
      const reference = `MYS-${order.id.slice(0, 8)}-${Date.now().toString(36)}`;
      const korapaySecret = process.env.KORAPAY_SECRET_KEY;
      if (!korapaySecret) {
        return res.status(500).json({ message: "Payment not configured" });
      }
      const prodDomain = process.env.REPL_SLUG ? `${process.env.REPL_SLUG}.replit.app` : null;
      const host = prodDomain || process.env.REPLIT_DEV_DOMAIN || req.get("host") || "mystic-text-portals.replit.app";
      const baseUrl = `https://${host}`;
      const exchangeRate = 1580;
      const amountNgn = Math.ceil(amountUsd * exchangeRate);
      const isLiveChat = order.service?.slug === "live-chat";
      const response = await globalThis.fetch("https://api.korapay.com/merchant/api/v1/charges/initialize", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${korapaySecret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          reference,
          amount: amountNgn,
          currency: "NGN",
          redirect_url: `${baseUrl}/api/payments/callback?orderId=${order.id}&isChat=${isLiveChat ? "1" : "0"}`,
          customer: {
            name: user.email.split("@")[0],
            email: user.email
          },
          notification_url: `${baseUrl}/api/payments/webhook`,
          narration: `MysticTxt - ${order.service?.title || "Service"} (${order.deliveryType === "express" ? "Express" : "Standard"})`
        })
      });
      const data = await response.json();
      if (!data.status) {
        console.error("Korapay init error:", JSON.stringify(data));
        const errorMsg = data.message || "Payment provider error. Please try again.";
        return res.status(500).json({ message: errorMsg });
      }
      res.json({
        checkoutUrl: data.data.checkout_url,
        reference: data.data.reference || reference
      });
    } catch (err) {
      console.error("Payment init error:", err);
      res.status(500).json({ message: "Failed to initialize payment" });
    }
  });
  app2.post("/api/payments/webhook", async (req, res) => {
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
            const matchedOrder = allOrders.find((o) => o.id.startsWith(partialId));
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
  app2.get("/api/payments/callback", async (req, res) => {
    try {
      const reference = req.query.reference;
      const orderId = req.query.orderId;
      const isChat = req.query.isChat === "1";
      if (reference) {
        let matchedOrderId = orderId;
        if (!matchedOrderId) {
          const orderIdMatch = reference.match(/MYS(?:TIC)?-([^-]+)-/);
          if (orderIdMatch) {
            const partialId = orderIdMatch[1];
            const allOrders = await db.select().from(orders);
            const matchedOrder = allOrders.find((o) => o.id.startsWith(partialId));
            matchedOrderId = matchedOrder?.id;
          }
        }
        if (matchedOrderId) {
          const korapaySecret = process.env.KORAPAY_SECRET_KEY;
          if (korapaySecret) {
            const verifyRes = await globalThis.fetch(
              `https://api.korapay.com/merchant/api/v1/charges/${reference}`,
              {
                headers: { "Authorization": `Bearer ${korapaySecret}` }
              }
            );
            const verifyData = await verifyRes.json();
            if (verifyData.status && verifyData.data?.status === "success") {
              await updateOrderPayment(matchedOrderId, reference);
            }
          }
        }
      }
      const productionDomain = "mystic-text-portals.replit.app";
      const appBase = process.env.NODE_ENV === "production" ? `https://${productionDomain}` : `https://${process.env.REPLIT_DEV_DOMAIN || productionDomain}`;
      const path2 = isChat && orderId ? `/live-chat/${orderId}` : orderId ? `/order/${orderId}` : `/`;
      const fullRedirectUrl = `${appBase}${path2}`;
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Payment Complete</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { background: #0A0A1A; color: #E8E8F0; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .container { text-align: center; padding: 40px; max-width: 400px; }
          h1 { color: #D4A853; margin-bottom: 16px; font-size: 24px; }
          p { color: #8888AA; margin-bottom: 24px; }
          .btn { display: inline-block; background: linear-gradient(90deg, #D4A853, #B08930); color: #0A0A1A; text-decoration: none; padding: 14px 32px; border-radius: 14px; font-weight: 700; font-size: 16px; }
          .spinner { width: 40px; height: 40px; border: 3px solid rgba(212,168,83,0.3); border-top-color: #D4A853; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
        </head>
        <body>
          <div class="container">
            <div class="spinner"></div>
            <h1>Payment Successful!</h1>
            <p>${isChat ? "Your live chat session is being set up. Redirecting..." : "Your order has been placed. Redirecting..."}</p>
            <a class="btn" href="${fullRedirectUrl}" id="returnBtn">Return to MysticTxt</a>
          </div>
          <script>
            setTimeout(function() {
              window.location.href = "${fullRedirectUrl}";
            }, 2500);
          </script>
        </body>
        </html>
      `);
    } catch (err) {
      console.error("Callback error:", err);
      res.send("Payment processing. You can close this window.");
    }
  });
  app2.get("/api/payments/verify/:orderId", authMiddleware, async (req, res) => {
    try {
      const order = await getOrderById(req.params.orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.clientId !== req.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json({ status: order.status, paid: order.status !== "pending" });
    } catch (err) {
      res.status(500).json({ message: "Failed to verify" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs from "fs";
import * as path from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path2 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path2.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app2.use(express.static(path.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();
