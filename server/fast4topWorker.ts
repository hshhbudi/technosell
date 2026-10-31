import { Fast4TopError, checkFast4TopOrders, createFast4TopOrder } from "./fast4top";
import { finalizeSupplierOrder, listPendingSupplierOrders, updateSupplierOrder } from "./db";

type SupplierItem = { supplierProductId?: number; targetId?: string; quantity?: number; name?: string };
const MAX_ATTEMPTS = 3;
let workerBusy = false;

function itemFromOrder(items: string): SupplierItem | null {
  try {
    const item = JSON.parse(items)[0] as SupplierItem | undefined;
    return item?.supplierProductId ? item : null;
  } catch { return null; }
}

async function submitOrder(order: Awaited<ReturnType<typeof listPendingSupplierOrders>>[number]) {
  const item = itemFromOrder(order.items);
  if (!item?.supplierProductId || !order.supplierOrderUuid) return;
  const attempts = order.supplierAttempts ?? 0;
  if (attempts >= MAX_ATTEMPTS) {
    await finalizeSupplierOrder(order.id, { status: "reject", supplierOrderId: order.supplierOrderId, note: "تعذر الاتصال بـ Fast4Top بعد 3 محاولات؛ تمت إعادة المبلغ إلى رصيد العميل" });
    return;
  }
  await updateSupplierOrder(order.id, { supplierStatus: "sending", supplierAttempts: attempts + 1, supplierLastError: null, executionStatus: "manual_processing", ownerNote: `محاولة الشحن التلقائي ${attempts + 1} من ${MAX_ATTEMPTS}` });
  try {
    const result = await createFast4TopOrder({ productId: item.supplierProductId, quantity: item.quantity ?? 1, playerId: item.targetId, orderUuid: order.supplierOrderUuid });
    await finalizeSupplierOrder(order.id, { status: result.status, supplierOrderId: result.orderId, note: result.status === "wait" ? "تم قبول الطلب وهو قيد التنفيذ لدى Fast4Top" : undefined });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ غير معروف من Fast4Top";
    const retryable = error instanceof Fast4TopError ? error.retryable : true;
    if (!retryable || attempts + 1 >= MAX_ATTEMPTS) {
      await finalizeSupplierOrder(order.id, { status: "reject", supplierOrderId: order.supplierOrderId, note: `${message}؛ تمت إعادة المبلغ إلى رصيد العميل` });
    } else {
      await updateSupplierOrder(order.id, { supplierStatus: "retry", supplierAttempts: attempts + 1, supplierLastError: message, executionStatus: "manual_processing", ownerNote: `${message}. ستتم إعادة المحاولة تلقائيًا.` });
    }
  }
}

async function checkWaitingOrders(orders: Awaited<ReturnType<typeof listPendingSupplierOrders>>) {
  const waiting = orders.filter(order => order.supplierStatus === "wait" && order.supplierOrderId);
  if (!waiting.length) return;
  try {
    const results = await checkFast4TopOrders(waiting.map(order => order.supplierOrderId as string));
    for (const order of waiting) {
      const result = results.find(item => item.order_id === order.supplierOrderId);
      if (result?.status) await finalizeSupplierOrder(order.id, { status: result.status, supplierOrderId: result.order_id, note: result.status === "wait" ? "الطلب ما زال قيد التنفيذ لدى Fast4Top" : undefined });
    }
  } catch (error) {
    console.warn("[Fast4Top] status check failed:", error instanceof Error ? error.message : "unknown error");
  }
}

export async function processPendingFast4TopOrders() {
  if (workerBusy) return;
  workerBusy = true;
  try {
    const orders = await listPendingSupplierOrders();
    await checkWaitingOrders(orders);
    const fresh = await listPendingSupplierOrders();
    for (const order of fresh.filter(item => item.supplierStatus === "sending" || item.supplierStatus === "retry")) await submitOrder(order);
  } catch (error) {
    console.warn("[Fast4Top] worker failed:", error instanceof Error ? error.message : "unknown error");
  } finally { workerBusy = false; }
}

export function startFast4TopWorker() {
  void processPendingFast4TopOrders();
  setInterval(() => void processPendingFast4TopOrders(), 60_000);
}

export { submitOrder as dispatchFast4TopOrder };
