import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
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

export const customerAccounts = mysqlTable("customer_accounts", {
  id: int("id").autoincrement().primaryKey(),
  displayName: varchar("displayName", { length: 120 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  freeFireId: varchar("freeFireId", { length: 120 }),
  pubgId: varchar("pubgId", { length: 120 }),
  pubgServerId: varchar("pubgServerId", { length: 120 }),
  takaId: varchar("takaId", { length: 120 }),
  bigoId: varchar("bigoId", { length: 120 }),
  balanceCents: int("balanceCents").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomerAccount = typeof customerAccounts.$inferSelect;
export type InsertCustomerAccount = typeof customerAccounts.$inferInsert;

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  description: text("description"),
  price: int("price").notNull(),
  priceTry: int("priceTry"),
  priceUsdCents: int("priceUsdCents"),
  oldPrice: int("oldPrice"),
  stock: int("stock").notNull().default(0),
  isDigital: boolean("isDigital").notNull().default(false),
  tag: varchar("tag", { length: 60 }),
  imageUrl: varchar("imageUrl", { length: 500 }),
  fulfillmentUrl: varchar("fulfillmentUrl", { length: 500 }),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId"),
  orderNumber: varchar("orderNumber", { length: 32 }).notNull().unique(),
  items: text("items").notNull(),
  total: int("total").notNull(),
  customerName: varchar("customerName", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  playerId: varchar("playerId", { length: 120 }),
  serverId: varchar("serverId", { length: 120 }),
  paymentMethod: mysqlEnum("paymentMethod", ["shamcash", "other"]).notNull().default("shamcash"),
  paymentReference: varchar("paymentReference", { length: 160 }),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "confirmed", "rejected"]).notNull().default("pending"),
  executionStatus: mysqlEnum("executionStatus", ["pending", "manual_processing", "completed", "failed"]).notNull().default("pending"),
  ownerNote: text("ownerNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;
