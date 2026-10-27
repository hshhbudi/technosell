import { and, desc, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertCustomerAccount, InsertOrder, InsertProduct, InsertUser, customerAccounts, orders, products, users } from "../drizzle/schema";
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

export async function getUserByEmail(email: string) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return result[0];
}

export async function transferOwnership(currentOpenId: string, newOwnerEmail: string) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const target = await getUserByEmail(newOwnerEmail);
  if (!target) return { transferred: false, reason: "target_not_found" as const };
  if (target.openId === currentOpenId) return { transferred: false, reason: "same_account" as const };
  await db.update(users).set({ role: "user" }).where(eq(users.openId, currentOpenId));
  await db.update(users).set({ role: "admin" }).where(eq(users.openId, target.openId));
  return { transferred: true, targetEmail: target.email };
}

export async function claimFirstAdmin(openId: string) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  if (admins.length > 0) return false;
  await db.update(users).set({ role: "admin" }).where(eq(users.openId, openId));
  return true;
}

export async function grantAdminByEmail(email: string) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const target = await getUserByEmail(email);
  if (!target) return { granted: false, reason: "target_not_found" as const };
  await db.update(users).set({ role: "admin" }).where(eq(users.openId, target.openId));
  return { granted: true, targetEmail: target.email };
}

export async function getCustomerByEmail(email: string) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(customerAccounts).where(eq(customerAccounts.email, email.toLowerCase())).limit(1);
  return result[0];
}

export async function getCustomerById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(customerAccounts).where(eq(customerAccounts.id, id)).limit(1);
  return result[0];
}

export async function createCustomer(input: InsertCustomerAccount) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const result = await db.insert(customerAccounts).values({ ...input, email: input.email.toLowerCase() });
  const created = await db.select().from(customerAccounts).where(eq(customerAccounts.id, Number(result[0].insertId))).limit(1);
  return created[0];
}

export async function spendCustomerBalance(customerId: number, amountCents: number) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const result = await db.update(customerAccounts)
    .set({ balanceCents: sql`${customerAccounts.balanceCents} - ${amountCents}` })
    .where(and(eq(customerAccounts.id, customerId), gte(customerAccounts.balanceCents, amountCents)));
  return Number(result[0].affectedRows ?? 0) > 0;
}

export async function addCustomerBalance(customerId: number, amountCents: number) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  await db.update(customerAccounts)
    .set({ balanceCents: sql`${customerAccounts.balanceCents} + ${amountCents}` })
    .where(eq(customerAccounts.id, customerId));
  return getCustomerById(customerId);
}

export async function updateCustomerPassword(customerId: number, passwordHash: string) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  await db.update(customerAccounts).set({ passwordHash }).where(eq(customerAccounts.id, customerId));
  return true;
}

export async function listProducts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).where(eq(products.isActive, true)).orderBy(desc(products.createdAt));
}

export async function listAllProducts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).orderBy(desc(products.createdAt));
}

export async function createProduct(input: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(products).values(input);
  const id = Number(result[0].insertId);
  const created = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return created[0];
}

export async function updateProduct(id: number, input: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(products).set(input).where(eq(products.id, id));
  const updated = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return updated[0];
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(products).set({ isActive: false }).where(eq(products.id, id));
  return { success: true } as const;
}

export async function createOrder(input: InsertOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(orders).values(input);
  const created = await db.select().from(orders).where(eq(orders.orderNumber, input.orderNumber)).limit(1);
  return created[0];
}

export async function listOrders() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function updateOrderStatus(id: number, input: { paymentStatus?: "pending" | "confirmed" | "rejected"; executionStatus?: "pending" | "manual_processing" | "completed" | "failed"; ownerNote?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const current = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  await db.update(orders).set(input).where(eq(orders.id, id));
  const updated = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (current[0] && current[0].paymentStatus !== "confirmed" && input.paymentStatus === "confirmed" && current[0].customerId) {
    try {
      const items = JSON.parse(current[0].items) as Array<{ category?: string }>;
      if (items.some(item => item.category === "تعبئة الرصيد")) await addCustomerBalance(current[0].customerId, current[0].total);
    } catch { /* Preserve the status update for legacy malformed orders. */ }
  }
  return updated[0];
}
