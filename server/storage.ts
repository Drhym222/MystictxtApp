import { eq, desc, and } from "drizzle-orm";
import { db } from "./db";
import {
  users, services, orders, orderIntake, notifications,
  type User, type Service, type Order, type OrderIntake, type Notification,
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
    const adminUsers = await db.select().from(users).where(eq(users.role, "admin"));
    const [intake] = await db.select().from(orderIntake).where(eq(orderIntake.orderId, orderId));
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
  let query = db.select().from(orders).orderBy(desc(orders.createdAt));

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

export async function seedDatabase(): Promise<void> {
  const existingServices = await db.select().from(services);
  if (existingServices.length > 0) return;

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
      slug: "telepathy-mind-implants",
      title: "Telepathy Mind Implants",
      description: "Harness the power of focused intention through telepathic mind implants. Our specialist channels specific thoughts and positive affirmations toward your target, creating subtle but powerful shifts in consciousness.",
      priceUsdCents: 499,
    },
    {
      slug: "live-chat",
      title: "Live Chat",
      description: "Connect with our mystic advisor in real-time through text. Ask your burning questions and receive immediate guidance. Each bundle includes multiple text replies for an in-depth conversation.",
      priceUsdCents: 499,
    },
  ];

  await db.insert(services).values(serviceData);

  const existingAdmin = await getUserByEmail("mysticsughter@gmail.com");
  if (!existingAdmin) {
    const bcrypt = await import("bcryptjs");
    const adminPassword = process.env.ADMIN_PASSWORD || "MysticAdmin2024!";
    const hash = await bcrypt.hash(adminPassword, 12);
    await createUser("mysticsughter@gmail.com", hash, "admin");
  }
}
