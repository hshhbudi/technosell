import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  mediumtext,
  text,
  timestamp,
  varchar,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

/**
 * Core user table
 */
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

/**
 * Customer accounts
 */
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

/**
 * Manual store products
 * This table remains unchanged.
 */
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

/**
 * Orders
 * Existing supplier order fields are preserved.
 */
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
  paymentMethod: mysqlEnum("paymentMethod", ["shamcash", "other"])
    .notNull()
    .default("shamcash"),
  paymentReference: varchar("paymentReference", { length: 160 }),
  paymentProofUrl: varchar("paymentProofUrl", { length: 600 }),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "confirmed", "rejected"])
    .notNull()
    .default("pending"),
  executionStatus: mysqlEnum("executionStatus", [
    "pending",
    "manual_processing",
    "completed",
    "failed",
  ])
    .notNull()
    .default("pending"),
  ownerNote: text("ownerNote"),
  supplierOrderUuid: varchar("supplierOrderUuid", { length: 36 }),
  supplierOrderId: varchar("supplierOrderId", { length: 100 }),
  supplierStatus: varchar("supplierStatus", { length: 32 }),
  supplierAttempts: int("supplierAttempts").notNull().default(0),
  supplierLastError: text("supplierLastError"),
  supplierRefunded: boolean("supplierRefunded").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * Fast4Top supplier products
 * Separate from manually managed store products.
 */
export const supplierProducts = mysqlTable(
  "supplier_products",
  {
    id: int("id").autoincrement().primaryKey(),

    externalId: varchar("externalId", { length: 100 }).notNull(),

    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 100 }),
    subcategory: varchar("subcategory", { length: 100 }),

    // Original supplier price in USD cents
    supplierPriceCents: int("supplierPriceCents").notNull(),

    // Editable profit percentage; default is 8%
    markupPercent: int("markupPercent").notNull().default(8),

    // Final customer selling price in USD cents
    sellingPriceCents: int("sellingPriceCents").notNull(),

    quantity: int("quantity").default(1),

    quantityValues: json("quantityValues"),

    requires: json("requires"),

    productType: varchar("productType", { length: 100 }),

    imageUrl: text("imageUrl"),
    description: text("description"),

    available: boolean("available").notNull().default(true),

    // Owner approval and visibility are separate controls
    approved: boolean("approved").notNull().default(false),
    enabled: boolean("enabled").notNull().default(false),

    createdAt: timestamp("createdAt").defaultNow().notNull(),

    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    externalIdUnique: uniqueIndex("supplier_products_external_id_unique").on(
      table.externalId
    ),
  })
);

export const supplierCategories = mysqlTable("supplier_categories", {
  id: int("id").autoincrement().primaryKey(),
  sourceName: varchar("sourceName", { length: 255 }).notNull().unique(),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  imageUrl: text("imageUrl"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SupplierCategory = typeof supplierCategories.$inferSelect;

export type SupplierProduct = typeof supplierProducts.$inferSelect;
export type InsertSupplierProduct = typeof supplierProducts.$inferInsert;


/**
 * Persistent uploads stored in the existing MySQL database.
 * This replaces the retired Manus/Forge object storage dependency.
 */
export const mediaFiles = mysqlTable("media_files", {
  id: int("id").autoincrement().primaryKey(),
  storageKey: varchar("storageKey", { length: 255 }).notNull().unique(),
  contentType: varchar("contentType", { length: 100 }).notNull(),
  dataBase64: mediumtext("dataBase64").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MediaFile = typeof mediaFiles.$inferSelect;
