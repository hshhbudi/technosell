
import {
  checkFast4TopOrders,
  createFast4TopOrder,
  syncFast4TopCatalog,
  isFast4TopConfigured,
} from "./fast4top";

import {
  finalizeSupplierOrder,
  listPendingSupplierOrders,
  updateSupplierOrder,
} from "./db";

type SupplierItem = {
  supplierProductId?: number;
  targetId?: string;
  quantity?: number;
  name?: string;
};

type PendingOrder = Awaited<
  ReturnType<typeof listPendingSupplierOrders>
>[number];

// الطلبات التي يجري إرسالها حالياً من هذه النسخة من الخادم.
const activeOrderIds = new Set<number>();

let workerBusy = false;

const STALE_ORDER_MINUTES = 3;

function itemFromOrder(items: string): SupplierItem | null {
  try {
    const parsed = JSON.parse(items);

    const item = Array.isArray(parsed)
      ? (parsed[0] as SupplierItem | undefined)
      : undefined;

    return item?.supplierProductId ? item : null;
  } catch {
    return null;
  }
}

function isOldSendingOrder(order: PendingOrder): boolean {
  if (!order.createdAt) return false;

  const createdAt = new Date(order.createdAt).getTime();

  if (!Number.isFinite(createdAt)) return false;

  const age = Date.now() - createdAt;

  return age >= STALE_ORDER_MINUTES * 60 * 1000;
}

/**
 * إرسال الطلب مرة واحدة فقط.
 * لا توجد إعادة محاولة تلقائية عند نتيجة اتصال مجهولة.
 */
async function submitOrder(order: PendingOrder) {
  const item = itemFromOrder(order.items);

  if (!item?.supplierProductId || !order.supplierOrderUuid) {
    await updateSupplierOrder(order.id, {
      supplierStatus: "review",
      executionStatus: "manual_processing",
      supplierLastError: "بيانات طلب الشحن غير مكتملة",
      ownerNote: "الطلب يحتاج مراجعة المالك بسبب نقص بيانات المنتج",
    });
    return;
  }

  // لا نسمح بإعادة إرسال طلب سبق إرساله.
  if ((order.supplierAttempts ?? 0) > 0) {
    await updateSupplierOrder(order.id, {
      supplierStatus: "review",
      executionStatus: "manual_processing",
      supplierLastError: "تم إيقاف إعادة الإرسال التلقائي",
      ownerNote: "الطلب يحتاج مراجعة المالك قبل أي محاولة جديدة",
    });
    return;
  }

  await updateSupplierOrder(order.id, {
    supplierStatus: "sending",
    supplierAttempts: 1,
    supplierLastError: null,
    executionStatus: "manual_processing",
    ownerNote: "جارٍ إرسال الطلب إلى Fast4Top",
  });

  try {
    const result = await createFast4TopOrder({
      productId: item.supplierProductId,
      quantity: item.quantity ?? 1,
      playerId: item.targetId,
      orderUuid: order.supplierOrderUuid,
    });

    await finalizeSupplierOrder(order.id, {
      status: result.status,
      supplierOrderId: result.orderId,
      note:
        result.status === "wait"
          ? "الطلب قيد التنفيذ لدى Fast4Top"
          : result.status === "accept"
            ? "تم قبول الطلب لدى Fast4Top، بانتظار تأكيد التنفيذ"
            : "رفض Fast4Top الطلب",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "تعذر تحديد نتيجة طلب Fast4Top";

    // لا نعيد الإرسال ولا نرجع الرصيد عند النتيجة المجهولة.
    await updateSupplierOrder(order.id, {
      supplierStatus: "review",
      executionStatus: "manual_processing",
      supplierLastError: message,
      ownerNote:
        "نتيجة الإرسال غير مؤكدة. يجب مراجعة الطلب لدى Fast4Top قبل أي إجراء",
    });

    console.warn(
      `[Fast4Top] Order ${order.id} needs manual review:`,
      message
    );
  }
}

/**
 * متابعة الطلبات التي لديها رقم طلب مؤكد لدى Fast4Top.
 */
async function checkWaitingOrders(orders: PendingOrder[]) {
  const waiting = orders.filter(
    (order) =>
      (order.supplierStatus === "wait" ||
        order.supplierStatus === "accept") &&
      order.supplierOrderId
  );

  if (!waiting.length) return;

  try {
    const results = await checkFast4TopOrders(
      waiting.map((order) => order.supplierOrderId as string)
    );

    for (const order of waiting) {
      const result = results.find(
        (item) => item.order_id === order.supplierOrderId
      );

      if (!result?.status) continue;

      await finalizeSupplierOrder(order.id, {
        status: result.status,
        supplierOrderId: result.order_id,
        note:
          result.status === "wait"
            ? "الطلب ما زال قيد التنفيذ لدى Fast4Top"
            : result.status === "accept"
              ? "Fast4Top أكد قبول الطلب، بانتظار تأكيد التنفيذ"
              : "Fast4Top رفض الطلب",
      });
    }
  } catch (error) {
    console.warn(
      "[Fast4Top] Status check failed:",
      error instanceof Error ? error.message : "unknown error"
    );
  }
}

/**
 * متابعة الحالات القديمة فقط.
 * لا يعيد إرسال الطلبات القديمة تلقائياً.
 */
export async function processPendingFast4TopOrders() {
  if (workerBusy) return;

  workerBusy = true;

  try {
    const orders = await listPendingSupplierOrders();

    await checkWaitingOrders(orders);

    for (const order of orders) {
      if (
        order.supplierStatus !== "sending" &&
        order.supplierStatus !== "retry"
      ) {
        continue;
      }

      // لا نلمس الطلب الذي يجري إرساله حالياً.
      if (activeOrderIds.has(order.id)) {
        continue;
      }

      // نعطي الطلب الجديد وقتاً كافياً قبل اعتباره عالقاً.
      if (!isOldSendingOrder(order)) {
        continue;
      }

      await updateSupplierOrder(order.id, {
        supplierStatus: "review",
        executionStatus: "manual_processing",
        supplierLastError: "الطلب لم تُحسم نتيجة إرساله",
        ownerNote:
          "تم إيقاف إعادة الإرسال التلقائي. يلزم التحقق من Fast4Top",
      });
    }
  } catch (error) {
    console.warn(
      "[Fast4Top] Worker failed:",
      error instanceof Error ? error.message : "unknown error"
    );
  } finally {
    workerBusy = false;
  }
}

let catalogSyncBusy = false;

async function runCatalogSync() {
  if (catalogSyncBusy) {
    console.log("[Fast4Top] Catalog sync skipped: another sync is already running");
    return;
  }

  if (!isFast4TopConfigured()) {
    console.warn("[Fast4Top] Catalog sync skipped: FAST4TOP_API_TOKEN or FAST4TOP_API_KEY is missing");
    return;
  }

  console.log("[Fast4Top] Starting catalog sync...");
  catalogSyncBusy = true;
  try {
    const result = await syncFast4TopCatalog();
    console.log(
      `[Fast4Top] Automatic catalog sync complete: ${result.total} total, ${result.inserted} inserted, ${result.updated} updated`
    );
  } catch (error) {
    console.warn(
      "[Fast4Top] Automatic catalog sync failed:",
      error instanceof Error ? error.message : "unknown error"
    );
  } finally {
    catalogSyncBusy = false;
  }
}

export function startFast4TopWorker() {
  void processPendingFast4TopOrders();
  void runCatalogSync();

  setInterval(() => {
    void processPendingFast4TopOrders();
  }, 60_000);

  // Refresh supplier catalog every three hours while the app is awake.
  setInterval(() => {
    void runCatalogSync();
  }, 3 * 60 * 60 * 1000);
}

/**
 * إرسال طلب جديد مع منع التداخل مع العامل الدوري.
 */
export async function dispatchFast4TopOrder(order: PendingOrder) {
  if (activeOrderIds.has(order.id)) return;

  activeOrderIds.add(order.id);

  try {
    await submitOrder(order);
  } finally {
    activeOrderIds.delete(order.id);
  }
}
