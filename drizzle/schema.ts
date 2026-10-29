import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 180 }).notNull().unique(),
  category: varchar("category", { length: 40 }).notNull(),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  available: int("available").default(1).notNull(),
  accent: varchar("accent", { length: 40 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const stockItems = mysqlTable("stockItems", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  detail: varchar("detail", { length: 255 }).notNull(),
  current: decimal("current", { precision: 10, scale: 3 }).notNull(),
  minimum: decimal("minimum", { precision: 10, scale: 3 }).notNull(),
  lastCost: decimal("lastCost", { precision: 10, scale: 2 }).default("0").notNull(),
  unit: varchar("unit", { length: 20 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const stockMovements = mysqlTable("stockMovements", {
  id: int("id").autoincrement().primaryKey(),
  stockItemId: int("stockItemId").notNull(),
  type: mysqlEnum("type", ["in", "out", "adjustment"]).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  reason: varchar("reason", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const productionSheets = mysqlTable("productionSheets", {
  id: int("id").autoincrement().primaryKey(),
  product: varchar("product", { length: 160 }).notNull(),
  yieldText: varchar("yieldText", { length: 80 }).notNull(),
  prepTime: varchar("prepTime", { length: 40 }).notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }).notNull(),
  ingredientsJson: text("ingredientsJson").notNull(),
  active: int("active").default(1).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const motoboys = mysqlTable("motoboys", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  status: mysqlEnum("status", ["online", "offline", "delivering"]).default("offline").notNull(),
  deliveries: int("deliveries").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const deliverySettings = mysqlTable("deliverySettings", {
  id: int("id").autoincrement().primaryKey(),
  baseFee: decimal("baseFee", { precision: 10, scale: 2 }).notNull(),
  perKm: decimal("perKm", { precision: 10, scale: 2 }).notNull(),
  maxRadius: decimal("maxRadius", { precision: 10, scale: 2 }).notNull(),
  minimumOrder: decimal("minimumOrder", { precision: 10, scale: 2 }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const paymentSettings = mysqlTable("paymentSettings", {
  id: int("id").autoincrement().primaryKey(),
  pix: int("pix").default(1).notNull(),
  card: int("card").default(1).notNull(),
  cashOnDelivery: int("cashOnDelivery").default(1).notNull(),
  onlineProvider: varchar("onlineProvider", { length: 40 }).default("Não conectado").notNull(),
  onlineEnabled: int("onlineEnabled").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const integrations = mysqlTable("integrations", {
  id: int("id").autoincrement().primaryKey(),
  platform: varchar("platform", { length: 60 }).notNull().unique(),
  status: mysqlEnum("status", ["connected", "pending", "available"]).default("available").notNull(),
  credentialsRef: varchar("credentialsRef", { length: 120 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 40 }).notNull().unique(),
  externalId: varchar("externalId", { length: 120 }),
  source: mysqlEnum("source", ["site", "ifood", "whatsapp", "marketplace", "balcao"]).notNull(),
  customerName: varchar("customerName", { length: 160 }).notNull(),
  address: text("address"),
  customerNote: text("customerNote"),
  deliveryType: mysqlEnum("deliveryType", ["delivery", "pickup", "counter"]).notNull(),
  status: mysqlEnum("status", ["analysis", "production", "ready", "completed", "cancelled"]).default("analysis").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 40 }).notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid", "failed", "cash_on_delivery"]).default("pending").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  deliveryFee: decimal("deliveryFee", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const orderItems = mysqlTable("orderItems", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productId: int("productId"),
  name: varchar("name", { length: 160 }).notNull(),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  observations: text("observations"),
});

export const stripeEvents = mysqlTable("stripeEvents", {
  id: int("id").autoincrement().primaryKey(),
  eventId: varchar("eventId", { length: 160 }).notNull().unique(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 30 }).notNull(),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const purchaseRequests = mysqlTable("purchaseRequests", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 40 }).notNull().unique(),
  status: mysqlEnum("status", ["draft", "sent", "quoting", "awarded", "ordered", "received"]).default("draft").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const purchaseItems = mysqlTable("purchaseItems", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull(),
  stockItemId: int("stockItemId"),
  itemName: varchar("itemName", { length: 160 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unit: varchar("unit", { length: 20 }).notNull(),
});

export const supplierQuotes = mysqlTable("supplierQuotes", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull(),
  supplierId: int("supplierId").notNull(),
  token: varchar("token", { length: 80 }).notNull().unique(),
  status: mysqlEnum("status", ["sent", "responded", "awarded", "rejected"]).default("sent").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).default("0").notNull(),
  notes: text("notes"),
  submittedAt: timestamp("submittedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const supplierQuoteItems = mysqlTable("supplierQuoteItems", {
  id: int("id").autoincrement().primaryKey(),
  quoteId: int("quoteId").notNull(),
  purchaseItemId: int("purchaseItemId").notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  available: int("available").default(1).notNull(),
});
