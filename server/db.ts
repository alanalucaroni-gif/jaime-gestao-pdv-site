import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.


import { desc } from "drizzle-orm";
import { orders, orderItems, products, stripeEvents } from "../drizzle/schema";
import { purchaseItems, purchaseRequests, supplierQuoteItems, supplierQuotes, suppliers, stockItems, stockMovements } from "../drizzle/schema";
import crypto from "node:crypto";

export async function listProducts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).orderBy(products.category, products.name);
}

export async function syncProducts(items: Array<{ name: string; slug: string; category: string; description: string; price: string; available: number; accent: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  for (const item of items) {
    await db.insert(products).values(item).onDuplicateKeyUpdate({
      set: { name: item.name, category: item.category, description: item.description, price: item.price, available: item.available, accent: item.accent },
    });
  }
  return listProducts();
}

export async function updateProduct(id: number, patch: { price?: string; available?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(products).set(patch).where(eq(products.id, id));
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function listOrders() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(100);
  return Promise.all(rows.map(async order => ({
    ...order,
    items: await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
  })));
}

export async function createOrderRecord(input: {
  publicId: string; externalId?: string; source: "site" | "ifood" | "whatsapp" | "marketplace" | "balcao"; customerName: string; address?: string; customerNote?: string; deliveryType: "delivery" | "pickup" | "counter"; paymentMethod: string; paymentStatus?: "pending" | "paid" | "failed" | "cash_on_delivery"; subtotal: string; deliveryFee: string; total: string; items: Array<{ productId?: number; name: string; quantity: number; unitPrice: string; observations?: string }>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(orders).values({
    publicId: input.publicId,
    externalId: input.externalId,
    source: input.source,
    customerName: input.customerName,
    address: input.address,
    customerNote: input.customerNote,
    deliveryType: input.deliveryType,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentStatus ?? "pending",
    subtotal: input.subtotal,
    deliveryFee: input.deliveryFee,
    total: input.total,
  });
  const order = await db.select().from(orders).where(eq(orders.publicId, input.publicId)).limit(1);
  if (!order[0]) throw new Error("Order was not created");
  await db.insert(orderItems).values(input.items.map(item => ({ orderId: order[0].id, ...item })));
  return order[0];
}

export async function updateOrderStatus(publicId: string, status: "analysis" | "production" | "ready" | "completed" | "cancelled") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(orders).set({ status }).where(eq(orders.publicId, publicId));
  const rows = await db.select().from(orders).where(eq(orders.publicId, publicId)).limit(1);
  return rows[0];
}

export async function markStripeEvent(eventId: string, eventType: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select({ id: stripeEvents.id }).from(stripeEvents).where(eq(stripeEvents.eventId, eventId)).limit(1);
  if (existing.length > 0) return false;
  await db.insert(stripeEvents).values({ eventId, eventType });
  return true;
}


export async function markOrderPaid(publicId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(orders).set({ paymentStatus: "paid" }).where(eq(orders.publicId, publicId));
}

export async function listSuppliers() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(suppliers).where(eq(suppliers.active, 1)).orderBy(suppliers.name);
}

export async function createSupplier(input: { name: string; whatsapp: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const digits = input.whatsapp.replace(/\D/g, "");
  const brazilianWhatsapp = digits.startsWith("55") ? digits : `55${digits}`;
  await db.insert(suppliers).values({ name: input.name, whatsapp: brazilianWhatsapp });
  return (await db.select().from(suppliers).orderBy(desc(suppliers.id)).limit(1))[0];
}

export async function createPurchaseRequest(input: { items: Array<{ itemName: string; quantity: string; unit: string; stockItemId?: number }>; supplierIds: number[]; notes?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const publicId = `PC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  await db.insert(purchaseRequests).values({ publicId, status: "sent", notes: input.notes });
  const request = (await db.select().from(purchaseRequests).where(eq(purchaseRequests.publicId, publicId)).limit(1))[0];
  if (!request) throw new Error("Purchase request was not created");
  await db.insert(purchaseItems).values(input.items.map(item => ({ requestId: request.id, itemName: item.itemName, quantity: item.quantity, unit: item.unit, stockItemId: item.stockItemId })));
  await db.insert(supplierQuotes).values(input.supplierIds.map(supplierId => ({ requestId: request.id, supplierId, token: crypto.randomBytes(24).toString("hex"), status: "sent" as const })));
  return getPurchaseRequest(publicId);
}

export async function getPurchaseRequest(publicId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const request = (await db.select().from(purchaseRequests).where(eq(purchaseRequests.publicId, publicId)).limit(1))[0];
  if (!request) return undefined;
  const items = await db.select().from(purchaseItems).where(eq(purchaseItems.requestId, request.id));
  const quotes = await db.select().from(supplierQuotes).where(eq(supplierQuotes.requestId, request.id));
  return { ...request, items, quotes };
}

export async function submitSupplierQuote(input: { token: string; items: Array<{ purchaseItemId: number; unitPrice: string; available: number }>; notes?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const quote = (await db.select().from(supplierQuotes).where(eq(supplierQuotes.token, input.token)).limit(1))[0];
  if (!quote) throw new Error("Cotação não encontrada");
  await db.insert(supplierQuoteItems).values(input.items.map(item => ({ quoteId: quote.id, ...item })));
  const total = input.items.reduce((sum, item) => sum + Number(item.unitPrice), 0);
  await db.update(supplierQuotes).set({ status: "responded", total: total.toFixed(2), notes: input.notes, submittedAt: new Date() }).where(eq(supplierQuotes.id, quote.id));
  return getPurchaseRequest((await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, quote.requestId)).limit(1))[0].publicId);
}

export async function getSupplierQuote(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const quote = (await db.select().from(supplierQuotes).where(eq(supplierQuotes.token, token)).limit(1))[0];
  if (!quote) return undefined;
  const request = (await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, quote.requestId)).limit(1))[0];
  const items = await db.select().from(purchaseItems).where(eq(purchaseItems.requestId, quote.requestId));
  const supplier = (await db.select().from(suppliers).where(eq(suppliers.id, quote.supplierId)).limit(1))[0];
  return { quote, request, items, supplier };
}

export async function awardSupplierQuote(quoteId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const quote = (await db.select().from(supplierQuotes).where(eq(supplierQuotes.id, quoteId)).limit(1))[0];
  if (!quote) throw new Error("Cotação não encontrada");
  await db.update(supplierQuotes).set({ status: "awarded" }).where(eq(supplierQuotes.id, quoteId));
  await db.update(purchaseRequests).set({ status: "awarded" }).where(eq(purchaseRequests.id, quote.requestId));
  return quote;
}

export async function receivePurchase(requestId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const awarded = (await db.select().from(supplierQuotes).where(eq(supplierQuotes.requestId, requestId)).limit(1)).find(quote => quote.status === "awarded");
  if (!awarded) throw new Error("Escolha uma cotação antes de receber");
  const items = await db.select().from(purchaseItems).where(eq(purchaseItems.requestId, requestId));
  const prices = await db.select().from(supplierQuoteItems).where(eq(supplierQuoteItems.quoteId, awarded.id));
  for (const item of items) {
    if (!item.stockItemId) continue;
    const price = prices.find(row => row.purchaseItemId === item.id);
    const current = (await db.select().from(stockItems).where(eq(stockItems.id, item.stockItemId)).limit(1))[0];
    if (!current) continue;
    await db.update(stockItems).set({ current: (Number(current.current) + Number(item.quantity)).toFixed(3), lastCost: price?.unitPrice ?? current.lastCost }).where(eq(stockItems.id, item.stockItemId));
    await db.insert(stockMovements).values({ stockItemId: item.stockItemId, type: "in", quantity: item.quantity, reason: `Compra ${requestId}` });
  }
  await db.update(purchaseRequests).set({ status: "received" }).where(eq(purchaseRequests.id, requestId));
  return getPurchaseRequest((await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, requestId)).limit(1))[0].publicId);
}
