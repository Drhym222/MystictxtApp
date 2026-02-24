import { eq, desc, and, ne } from "drizzle-orm";
import { db } from "./db";
import {
  users, services, orders, orderIntake, notifications, adminSettings, chatSessions, chatMessages,
  type User, type Service, type Order, type OrderIntake, type Notification, type ChatSession, type ChatMessage,
} from "@shared/schema";

export async function getUserById(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user;
}

export async function createUser(email: string, passwordHash: string, role: string = "client"): Promise<User> {
  const [user] = await db.insert(users).values({ email, passwordHash, role }).returning();
  return user;
}

export async function getServices(): Promise<Service[]> {
  return db.select().from(services).where(eq(services.active, true));
}

export async function getServiceBySlug(slug: string): Promise<Service | undefined> {
  const [service] = await db.select().from(services).where(eq(services.slug, slug));
  return service;
}

export async function getServiceById(id: string): Promise<Service | undefined> {
  const [service] = await db.select().from(services).where(eq(services.id, id));
  return service;
}

export async function createOrder(
  clientId: string,
  serviceId: string,
  priceUsdCents: number,
  deliveryType: string,
  intake: { fullName: string; dob?: string; question: string; details?: any }
): Promise<{ order: Order; intake: OrderIntake }> {
  const [order] = await db.insert(orders).values({
    clientId,
    serviceId,
    priceUsdCents,
    deliveryType,
    status: "pending",
  }).returning();

  const [intakeRecord] = await db.insert(orderIntake).values({
    orderId: order.id,
    fullName: intake.fullName,
    dobOptional: intake.dob,
    question: intake.question,
    detailsJson: intake.details,
  }).returning();

  return { order, intake: intakeRecord };
}

export async function updateOrderPayment(orderId: string, paymentReference: string): Promise<Order | undefined> {
  const [order] = await db.update(orders).set({
    status: "paid",
    paymentReference,
    paidAt: new Date(),
  }).where(eq(orders.id, orderId)).returning();
  
  if (order) {
    const [service] = await db.select().from(services).where(eq(services.id, order.serviceId));
    const adminUsers = await db.select().from(users).where(eq(users.role, "admin"));
    const [intake] = await db.select().from(orderIntake).where(eq(orderIntake.orderId, orderId));

    if (service?.slug === "live-chat") {
      const existingSession = await getChatSessionByOrderId(order.id);
      if (!existingSession) {
        const chatMinutes = (intake?.detailsJson as any)?.chatMinutes || 5;
        await db.insert(chatSessions).values({
          orderId: order.id,
          clientId: order.clientId,
          purchasedMinutes: chatMinutes,
          status: "ringing",
        }).returning();

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
    } else {
      const existingNotifs = await db.select().from(notifications)
        .where(eq(notifications.orderId, orderId));
      if (existingNotifs.length === 0) {
        for (const admin of adminUsers) {
          await db.insert(notifications).values({
            userId: admin.id,
            type: "new_order",
            title: "New Order Received",
            body: `New paid order #${order.id.slice(0, 8)} from ${intake?.fullName || 'a client'}`,
            orderId: order.id,
          });
        }
      }
    }
  }
  
  return order;
}

export async function getClientOrders(clientId: string): Promise<(Order & { service: Service; intake: OrderIntake | null })[]> {
  const result = await db.select().from(orders)
    .where(eq(orders.clientId, clientId))
    .orderBy(desc(orders.createdAt));

  const enriched = [];
  for (const order of result) {
    const [service] = await db.select().from(services).where(eq(services.id, order.serviceId));
    const [intake] = await db.select().from(orderIntake).where(eq(orderIntake.orderId, order.id));
    enriched.push({ ...order, service, intake: intake || null });
  }
  return enriched;
}

export async function getAllOrders(statusFilter?: string): Promise<(Order & { service: Service; intake: OrderIntake | null; client: { email: string } })[]> {
  const result = statusFilter
    ? await db.select().from(orders).where(eq(orders.status, statusFilter)).orderBy(desc(orders.createdAt))
    : await db.select().from(orders).orderBy(desc(orders.createdAt));

  const enriched = [];
  for (const order of result) {
    const [service] = await db.select().from(services).where(eq(services.id, order.serviceId));
    const [intake] = await db.select().from(orderIntake).where(eq(orderIntake.orderId, order.id));
    const [client] = await db.select().from(users).where(eq(users.id, order.clientId));
    enriched.push({ ...order, service, intake: intake || null, client: { email: client?.email || "" } });
  }
  return enriched;
}

export async function getOrderById(orderId: string): Promise<(Order & { service: Service; intake: OrderIntake | null; client: { email: string } }) | undefined> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return undefined;

  const [service] = await db.select().from(services).where(eq(services.id, order.serviceId));
  const [intake] = await db.select().from(orderIntake).where(eq(orderIntake.orderId, order.id));
  const [client] = await db.select().from(users).where(eq(users.id, order.clientId));
  return { ...order, service, intake: intake || null, client: { email: client?.email || "" } };
}

export async function updateOrderStatus(orderId: string, status: string, adminResponse?: string): Promise<Order> {
  const updates: any = { status };
  if (status === "delivered") {
    updates.deliveredAt = new Date();
    if (adminResponse) updates.adminResponse = adminResponse;
  }
  const [order] = await db.update(orders).set(updates).where(eq(orders.id, orderId)).returning();

  if (status === "delivered") {
    await db.insert(notifications).values({
      userId: order.clientId,
      type: "order_delivered",
      title: "Your Reading is Ready",
      body: `Your order #${order.id.slice(0, 8)} has been delivered.`,
      orderId: order.id,
    });
  }

  return order;
}

export async function getNotifications(userId: string): Promise<Notification[]> {
  return db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt));
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const result = await db.select().from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return result.length;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await db.update(notifications).set({ read: true }).where(eq(notifications.id, notificationId));
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
}

export async function getAdminSetting(key: string): Promise<string | null> {
  const [setting] = await db.select().from(adminSettings).where(eq(adminSettings.key, key));
  return setting?.value || null;
}

export async function setAdminSetting(key: string, value: string): Promise<void> {
  const [existing] = await db.select().from(adminSettings).where(eq(adminSettings.key, key));
  if (existing) {
    await db.update(adminSettings).set({ value, updatedAt: new Date() }).where(eq(adminSettings.key, key));
  } else {
    await db.insert(adminSettings).values({ key, value });
  }
}

export async function getChatSessionByOrderId(orderId: string): Promise<ChatSession | undefined> {
  const [session] = await db.select().from(chatSessions).where(eq(chatSessions.orderId, orderId));
  return session;
}

export async function getActiveChatSession(): Promise<ChatSession | undefined> {
  const [session] = await db.select().from(chatSessions).where(eq(chatSessions.status, "active"));
  return session;
}

export async function getRingingChatSessions(): Promise<ChatSession[]> {
  return db.select().from(chatSessions)
    .where(eq(chatSessions.status, "ringing"))
    .orderBy(desc(chatSessions.createdAt));
}

export async function acceptChatSession(sessionId: string): Promise<ChatSession | undefined> {
  const [session] = await db.update(chatSessions).set({
    status: "active",
    acceptedAt: new Date(),
  }).where(eq(chatSessions.id, sessionId)).returning();

  if (session) {
    await db.insert(notifications).values({
      userId: session.clientId,
      type: "chat_accepted",
      title: "Chat Session Started",
      body: "The advisor has accepted your chat. Your session is now live!",
      orderId: session.orderId,
    });
  }

  return session;
}

export async function endChatSession(sessionId: string): Promise<ChatSession | undefined> {
  const [session] = await db.update(chatSessions).set({
    status: "ended",
    endedAt: new Date(),
  }).where(eq(chatSessions.id, sessionId)).returning();

  if (session) {
    await db.update(orders).set({ status: "delivered", deliveredAt: new Date() }).where(eq(orders.id, session.orderId));

    await db.insert(notifications).values({
      userId: session.clientId,
      type: "chat_ended",
      title: "Chat Session Ended",
      body: "Your live chat session has ended. Thank you!",
      orderId: session.orderId,
    });
  }

  return session;
}

export async function addChatMessage(sessionId: string, senderId: string, senderRole: string, message: string): Promise<ChatMessage> {
  const [msg] = await db.insert(chatMessages).values({
    sessionId,
    senderId,
    senderRole,
    message,
  }).returning();
  return msg;
}

export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  return db.select().from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt);
}

export async function getLiveChatAvailability(): Promise<{ status: "online" | "offline" | "busy" }> {
  const setting = await getAdminSetting("live_chat_enabled");
  if (setting !== "true") return { status: "offline" };

  const activeSession = await getActiveChatSession();
  if (activeSession) return { status: "busy" };

  return { status: "online" };
}

export async function seedDatabase(): Promise<void> {
  const bcrypt = await import("bcryptjs");

  const serviceData = [
    {
      slug: "psychic-reading",
      title: "Psychic Reading",
      description: "Gain deep insights into your life path, relationships, and future through a personalized psychic reading. Our gifted advisor connects with your energy to reveal hidden truths and guide you toward clarity.",
      priceUsdCents: 499,
    },
    {
      slug: "tarot-reading",
      title: "Tarot Reading",
      description: "Unlock the wisdom of the ancient tarot cards. Each card drawn reveals a layer of your journey—past influences, present energies, and future possibilities. Receive a detailed interpretation tailored to your question.",
      priceUsdCents: 499,
    },
    {
      slug: "telepathy-mind-reading",
      title: "Telepathy Mind Reading",
      description: "Experience the extraordinary gift of telepathic connection. Our advisor tunes into your mental frequency to perceive thoughts, emotions, and intentions that lie beneath the surface.",
      priceUsdCents: 499,
    },
    {
      slug: "find-lost-items",
      title: "Find Lost/Missing Items",
      description: "Have you lost something precious? Our gifted advisor uses psychic abilities to help locate lost or missing items, pets, and even people. Through deep intuitive connection, we can sense the energy of what you seek and guide you toward finding it.",
      priceUsdCents: 8999,
    },
    {
      slug: "live-chat",
      title: "Live Chat",
      description: "Connect with our mystic advisor in real-time through live text chat. Purchase session time and get instant guidance as the advisor accepts your connection. Timer starts only when the advisor is active — ask unlimited questions within your session.",
      priceUsdCents: 399,
    },
  ];

  const existingServices = await db.select().from(services);

  if (existingServices.length === 0) {
    await db.insert(services).values(serviceData);
  } else {
    for (const svc of serviceData) {
      const existing = existingServices.find(s => s.slug === svc.slug);
      if (existing) {
        await db.update(services).set({
          title: svc.title,
          description: svc.description,
          priceUsdCents: svc.priceUsdCents,
        }).where(eq(services.slug, svc.slug));
      } else {
        const oldImplants = existingServices.find(s => s.slug === "telepathy-mind-implants");
        if (svc.slug === "find-lost-items" && oldImplants) {
          await db.update(services).set({
            slug: svc.slug,
            title: svc.title,
            description: svc.description,
            priceUsdCents: svc.priceUsdCents,
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
  const hash = await bcrypt.hash(adminPassword, 12);
  if (!existingAdmin) {
    await createUser(adminEmail, hash, "admin");
  } else {
    const passwordMatch = await bcrypt.compare(adminPassword, existingAdmin.passwordHash);
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
