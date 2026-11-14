
import { and, desc, eq, gte, isNull, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertCustomerAccount,
  InsertOrder,
  InsertProduct,
  InsertUser,
  customerAccounts,
  orders,
  products,
  users,
  supplierProducts,
  supplierCategories,
  mediaFiles,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Database connection
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

// ===============================
// DATABASE-BACKED MEDIA STORAGE
// ===============================

export async function saveStoredMedia(input: {
  storageKey: string;
  contentType: string;
  dataBase64: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(mediaFiles).values(input);
}

export async function getStoredMedia(storageKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db
    .select({
      contentType: mediaFiles.contentType,
      dataBase64: mediaFiles.dataBase64,
    })
    .from(mediaFiles)
    .where(eq(mediaFiles.storageKey, storageKey))
    .limit(1);
  return rows[0] ?? null;
}

// ===============================
// USERS
// ===============================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  try {
    const values: InsertUser = { openId: user.openId };
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
      values.role = "admin";
      updateSet.role = "admin";
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
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  return result[0];
}

export async function transferOwnership(
  currentOpenId: string,
  newOwnerEmail: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const target = await getUserByEmail(newOwnerEmail);
  if (!target) {
    return { transferred: false, reason: "target_not_found" as const };
  }

  if (target.openId === currentOpenId) {
    return { transferred: false, reason: "same_account" as const };
  }

  await db
    .update(users)
    .set({ role: "user" })
    .where(eq(users.openId, currentOpenId));

  await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.openId, target.openId));

  return { transferred: true, targetEmail: target.email };
}

export async function claimFirstAdmin(openId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);

  if (admins.length > 0) return false;

  await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.openId, openId));

  return true;
}

export async function grantAdminByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const target = await getUserByEmail(email);
  if (!target) {
    return { granted: false, reason: "target_not_found" as const };
  }

  await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.openId, target.openId));

  return { granted: true, targetEmail: target.email };
}

// ===============================
// CUSTOMERS
// ===============================

export async function getCustomerByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(customerAccounts)
    .where(eq(customerAccounts.email, email.toLowerCase()))
    .limit(1);

  return result[0];
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(customerAccounts)
    .where(eq(customerAccounts.id, id))
    .limit(1);

  return result[0];
}

export async function createCustomer(input: InsertCustomerAccount) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const result = await db
    .insert(customerAccounts)
    .values({ ...input, email: input.email.toLowerCase() });

  const created = await db
    .select()
    .from(customerAccounts)
    .where(eq(customerAccounts.id, Number(result[0].insertId)))
    .limit(1);

  return created[0];
}

export async function spendCustomerBalance(
  customerId: number,
  amountCents: number
) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Invalid balance amount");
  }

  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const result = await db
    .update(customerAccounts)
    .set({
      balanceCents: sql`${customerAccounts.balanceCents} - ${amountCents}`,
    })
    .where(
      and(
        eq(customerAccounts.id, customerId),
        gte(customerAccounts.balanceCents, amountCents)
      )
    );

  return Number(result[0].affectedRows ?? 0) > 0;
}

export async function addCustomerBalance(
  customerId: number,
  amountCents: number
) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Invalid balance amount");
  }

  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db
    .update(customerAccounts)
    .set({
      balanceCents: sql`${customerAccounts.balanceCents} + ${amountCents}`,
    })
    .where(eq(customerAccounts.id, customerId));

  return getCustomerById(customerId);
}

export async function updateCustomerPassword(
  customerId: number,
  passwordHash: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db
    .update(customerAccounts)
    .set({ passwordHash })
    .where(eq(customerAccounts.id, customerId));

  return true;
}

// ===============================
// MANUAL STORE PRODUCTS
// ===============================

export async function listProducts() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(desc(products.createdAt));
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

  const created = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  return created[0];
}

export async function updateProduct(
  id: number,
  input: Partial<InsertProduct>
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db.update(products).set(input).where(eq(products.id, id));

  const updated = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  return updated[0];
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db
    .update(products)
    .set({ isActive: false })
    .where(eq(products.id, id));

  return { success: true } as const;
}

// ===============================
// FAST4TOP SUPPLIER PRODUCTS
// ===============================

export type SupplierProductSyncInput = {
  externalId: string;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  storeSection?: string | null;
  supplierPriceCents: number;
  quantity?: number | null;
  quantityValues?: unknown;
  requires?: unknown;
  productType?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  available?: boolean;
};

function calculateSellingPrice(
  supplierPriceCents: number,
  markupPercent: number
) {
  return Math.round(
    supplierPriceCents * (100 + markupPercent) / 100
  );
}

export async function listSupplierProducts() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(supplierProducts)
    .orderBy(desc(supplierProducts.createdAt));
}

export async function listAllSupplierProducts() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(supplierProducts)
    .orderBy(desc(supplierProducts.createdAt));
}

export async function listApprovedSupplierProducts() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(supplierProducts)
    .where(
      and(
        eq(supplierProducts.ownerSelected, true),
        eq(supplierProducts.approved, true),
        eq(supplierProducts.enabled, true),
        eq(supplierProducts.available, true)
      )
    )
    .orderBy(desc(supplierProducts.createdAt));
}

export async function getSupplierProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(supplierProducts)
    .where(eq(supplierProducts.id, id))
    .limit(1);

  return result[0];
}

export async function getSupplierProductByExternalId(externalId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(supplierProducts)
    .where(eq(supplierProducts.externalId, externalId))
    .limit(1);

  return result[0];
}

export async function syncSupplierProducts(
  items: SupplierProductSyncInput[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  // Read the current catalog once instead of issuing one SELECT per supplier item.
  const existingRows = await db.select().from(supplierProducts);
  const existingByExternalId = new Map(
    existingRows.map((product) => [product.externalId, product])
  );

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    if (
      !item.externalId ||
      !item.name ||
      !Number.isInteger(item.supplierPriceCents) ||
      item.supplierPriceCents < 0
    ) {
      skipped++;
      continue;
    }

    const current = existingByExternalId.get(item.externalId);

    if (current) {
      const markup = current.markupPercent ?? 8;
      const isAvailable = item.available ?? current.available ?? true;

      // Refresh supplier data while preserving the owner's publication choices.
      await db
        .update(supplierProducts)
        .set({
          name: item.name,
          category: item.category ?? current.category,
          subcategory: item.subcategory ?? current.subcategory,
          // Correct products previously imported into Applications when the supplier now classifies them as Games.
          // Keep any other owner-selected folder unchanged.
          storeSection: current.storeSection === "التطبيقات" && item.storeSection === "الألعاب"
            ? "الألعاب"
            : current.storeSection || item.storeSection || null,
          supplierPriceCents: item.supplierPriceCents,
          sellingPriceCents: calculateSellingPrice(
            item.supplierPriceCents,
            markup
          ),
          quantity: item.quantity ?? current.quantity,
          // Quantity choices belong to Fast4Top; clear stale choices if the supplier no longer sends them.
          quantityValues: item.quantityValues ?? null,
          requires: item.requires ?? current.requires,
          productType: item.productType ?? current.productType,
          // Preserve an image uploaded by the store owner; only fill an empty image from Fast4Top.
          imageUrl: current.imageUrl || item.imageUrl || null,
          description: item.description ?? current.description,
          available: isAvailable,
          approved: current.approved,
          enabled: current.enabled,
          ownerSelected: current.ownerSelected,
        })
        .where(eq(supplierProducts.id, current.id));

      updated++;
      continue;
    }

    const markup = 8;

    // New supplier items remain hidden until the owner explicitly selects them.
    const isAvailable = item.available ?? true;
    await db.insert(supplierProducts).values({
      externalId: item.externalId,
      name: item.name,
      category: item.category ?? null,
      subcategory: item.subcategory ?? null,
      supplierPriceCents: item.supplierPriceCents,
      markupPercent: markup,
      sellingPriceCents: calculateSellingPrice(
        item.supplierPriceCents,
        markup
      ),
      quantity: item.quantity ?? 1,
      quantityValues: item.quantityValues ?? null,
      requires: item.requires ?? null,
      productType: item.productType ?? null,
      imageUrl: item.imageUrl ?? null,
      description: item.description ?? null,
      available: isAvailable,
      storeSection: item.storeSection ?? null,
      approved: false,
      enabled: false,
      ownerSelected: false,
    });

    inserted++;
  }

  return { inserted, updated, skipped, total: items.length };
}

export async function updateSupplierProductMarkup(
  id: number,
  markupPercent: number
) {
  if (
    !Number.isInteger(markupPercent) ||
    markupPercent < 0 ||
    markupPercent > 1000
  ) {
    throw new Error("Markup must be an integer between 0 and 1000");
  }

  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const current = await getSupplierProductById(id);
  if (!current) throw new Error("Supplier product not found");

  const sellingPriceCents = calculateSellingPrice(
    current.supplierPriceCents,
    markupPercent
  );

  await db
    .update(supplierProducts)
    .set({
      markupPercent,
      sellingPriceCents,
    })
    .where(eq(supplierProducts.id, id));

  return getSupplierProductById(id);
}

export async function setSupplierProductImage(id: number, imageUrl: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(supplierProducts).set({ imageUrl }).where(eq(supplierProducts.id, id));
  return getSupplierProductById(id);
}

export async function setSupplierProductStoreSection(id: number, storeSection: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(supplierProducts).set({ storeSection }).where(eq(supplierProducts.id, id));
  return getSupplierProductById(id);
}

export async function moveSupplierFolderProducts(fromSection: string, toSection: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (fromSection === toSection) return { moved: 0, fromSection, toSection };
  const where = fromSection === "خدمات رقمية"
    ? or(eq(supplierProducts.storeSection, fromSection), isNull(supplierProducts.storeSection))
    : eq(supplierProducts.storeSection, fromSection);
  const result = await db.update(supplierProducts)
    .set({ storeSection: toSection })
    .where(where);
  return { moved: Number(result[0].affectedRows ?? 0), fromSection, toSection };
}

export async function setSupplierProductApproval(
  id: number,
  approved: boolean
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db
    .update(supplierProducts)
    .set({ approved })
    .where(eq(supplierProducts.id, id));

  return getSupplierProductById(id);
}

export async function listSupplierCategoryOverrides() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(supplierCategories).orderBy(supplierCategories.sourceName);
}

export async function saveSupplierCategoryOverride(input: {
  sourceName: string;
  displayName: string;
  imageUrl?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(supplierCategories).values({
    sourceName: input.sourceName,
    displayName: input.displayName,
    imageUrl: input.imageUrl ?? null,
  }).onDuplicateKeyUpdate({
    set: { displayName: input.displayName, imageUrl: input.imageUrl ?? null },
  });
  return { success: true };
}

export async function setSupplierCategoryEnabled(
  categoryName: string,
  enabled: boolean
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  if (enabled) {
    await db.update(supplierProducts).set({ enabled: true }).where(and(
      eq(supplierProducts.subcategory, categoryName),
      eq(supplierProducts.ownerSelected, true),
      eq(supplierProducts.approved, true),
      eq(supplierProducts.available, true)
    ));
  } else {
    await db.update(supplierProducts).set({ enabled: false })
      .where(eq(supplierProducts.subcategory, categoryName));
  }

  return { category: categoryName, enabled };
}

export async function setSupplierProductSelection(id: number, selected: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(supplierProducts)
    .set({ ownerSelected: selected, approved: selected, enabled: selected })
    .where(eq(supplierProducts.id, id));
  return getSupplierProductById(id);
}

export async function setSupplierProductEnabled(
  id: number,
  enabled: boolean
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db
    .update(supplierProducts)
    .set({ enabled })
    .where(eq(supplierProducts.id, id));

  return getSupplierProductById(id);
}

// ===============================
// ORDERS
// ===============================

export async function createOrder(input: InsertOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db.insert(orders).values(input);

  const created = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, input.orderNumber))
    .limit(1);

  return created[0];
}

export async function listOrders() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function listCustomerOrders(customerId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      items: orders.items,
      total: orders.total,
      paymentStatus: orders.paymentStatus,
      executionStatus: orders.executionStatus,
      ownerNote: orders.ownerNote,
      supplierOrderId: orders.supplierOrderId,
      supplierStatus: orders.supplierStatus,
      supplierAttempts: orders.supplierAttempts,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.createdAt));
}

export async function updateOrderStatus(
  id: number,
  input: {
    paymentStatus?: "pending" | "confirmed" | "rejected";
    executionStatus?: "pending" | "manual_processing" | "completed" | "failed";
    ownerNote?: string | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const current = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  await db.update(orders).set(input).where(eq(orders.id, id));

  const updated = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  if (
    current[0] &&
    current[0].paymentStatus !== "confirmed" &&
    input.paymentStatus === "confirmed" &&
    current[0].customerId
  ) {
    try {
      const items = JSON.parse(current[0].items) as Array<{
        category?: string;
      }>;

      if (items.some((item) => item.category === "تعبئة الرصيد")) {
        await addCustomerBalance(
          current[0].customerId,
          current[0].total
        );
      }
    } catch {
      // Preserve status update for legacy malformed orders.
    }
  }

  return updated[0];
}

// ===============================
// FAST4TOP SUPPLIER ORDERS
// ===============================

export async function listPendingSupplierOrders() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.paymentStatus, "confirmed"),
        sql`${orders.supplierStatus} in ('wait', 'accept', 'sending', 'retry')`
      )
    )
    .orderBy(orders.createdAt);
}

export async function updateSupplierOrder(
  id: number,
  input: {
    supplierOrderId?: string | null;
    supplierStatus?: string | null;
    supplierAttempts?: number;
    supplierLastError?: string | null;
    supplierRefunded?: boolean;
    executionStatus?: "pending" | "manual_processing" | "completed" | "failed";
    ownerNote?: string | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db.update(orders).set(input).where(eq(orders.id, id));

  const updated = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  return updated[0];
}

export async function finalizeSupplierOrder(
  id: number,
  result: {
    status: "accept" | "reject" | "wait";
    supplierOrderId?: string | null;
    note?: string | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  if (result.status === "reject") {
    await db.transaction(async (tx) => {
      const currentResult = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);

      const current = currentResult[0];
      if (!current) return;

      const note =
        result.note ?? "تم رفض الطلب من Fast4Top";

      const claim = await tx
        .update(orders)
        .set({
          supplierOrderId:
            result.supplierOrderId ?? current.supplierOrderId,
          supplierStatus: "reject",
          supplierLastError: note,
          supplierRefunded: true,
          executionStatus: "failed",
          ownerNote: note,
        })
        .where(
          and(
            eq(orders.id, id),
            eq(orders.supplierRefunded, false)
          )
        );

      if (
        Number(claim[0].affectedRows ?? 0) > 0 &&
        current.customerId
      ) {
        await tx
          .update(customerAccounts)
          .set({
            balanceCents: sql`${customerAccounts.balanceCents} + ${current.total}`,
          })
          .where(eq(customerAccounts.id, current.customerId));
      }
    });
  } else if (result.status === "accept") {
    await db
      .update(orders)
      .set({
        supplierOrderId:
          result.supplierOrderId ?? null,
        supplierStatus: "accept",
        supplierLastError: null,
        executionStatus: "manual_processing",
        ownerNote: result.note ?? "تم قبول الطلب لدى Fast4Top",
      })
      .where(eq(orders.id, id));
  } else {
    await db
      .update(orders)
      .set({
        supplierOrderId:
          result.supplierOrderId ?? null,
        supplierStatus: "wait",
        supplierLastError: null,
        executionStatus: "manual_processing",
        ownerNote: result.note ?? "الطلب قيد التنفيذ لدى Fast4Top",
      })
            .where(eq(orders.id, id));
  }
}
