import { useState } from "react";
import { ChevronDown, ChevronUp, RefreshCw, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

type CustomerOrder = {
  id: number;
  orderNumber: string;
  items: string;
  total: number;
  paymentStatus: "pending" | "confirmed" | "rejected";
  executionStatus: "pending" | "manual_processing" | "completed" | "failed";
  ownerNote: string | null;
  supplierOrderId?: string | null;
  supplierStatus?: string | null;
  supplierAttempts?: number;
  createdAt: string | Date;
};

const orderItems = (items: string): Array<{ name?: string; targetId?: string; quantity?: string | number }> => {
  try { return JSON.parse(items) || []; } catch { return []; }
};

const orderState = (order: CustomerOrder) => {
  if (order.executionStatus === "completed") return { label: "مكتملة", className: "completed" };
  if (order.executionStatus === "failed" || order.paymentStatus === "rejected") return { label: "فاشلة", className: "failed" };
  if (order.paymentStatus === "pending") return { label: "بانتظار تأكيد الدفع", className: "pending" };
  return { label: "قيد التنفيذ", className: "processing" };
};

const supplierState = (status?: string | null) =>
  status === "accept" ? "تم قبول الشحن" :
  status === "reject" ? "مرفوض من المزوّد" :
  status === "wait" ? "بانتظار التنفيذ" :
  status === "sending" ? "جارٍ الإرسال" : status || "قيد الإرسال";

export default function CustomerOrderTracking({ onClose }: { onClose: () => void }) {
  const orders = trpc.customer.orders.useQuery(undefined, { refetchInterval: 20000 });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return <div className="overlay" onClick={onClose}>
    <div className="customer-modal" onClick={event => event.stopPropagation()}>
      <button className="close-btn" onClick={onClose} aria-label="إغلاق"><X /></button>
      <span className="eyebrow">طلباتك في رصيد</span>
      <h2>تتبّع الطلبات</h2>
      <p className="modal-copy">تابع طلبات تعبئة المحفظة وشحن الألعاب والتطبيقات وحالة كل طلب.</p>
      <section className="customer-orders">
        <div className="customer-orders-head">
          <strong>جميع الطلبات</strong>
          <button type="button" onClick={() => orders.refetch()} disabled={orders.isFetching}><RefreshCw size={14}/> تحديث</button>
        </div>
        {orders.isLoading ? <p className="modal-copy">جارٍ تحميل الطلبات...</p> :
          orders.error ? <p className="form-error">تعذر تحميل الطلبات. حاول التحديث مرة أخرى.</p> :
          orders.data?.length ? orders.data.map((order: CustomerOrder) => {
            const state = orderState(order);
            const items = orderItems(order.items);
            const expanded = expandedId === order.id;
            return <div className={`customer-order ${expanded ? "expanded" : ""}`} key={order.id}>
              <button type="button" className="customer-order-summary" onClick={() => setExpandedId(expanded ? null : order.id)}>
                <div><strong>{items[0]?.name || "عملية شحن"}</strong><small>{order.orderNumber} · {new Date(order.createdAt).toLocaleDateString("ar-SY")}</small></div>
                <div><b className={`customer-order-status ${state.className}`}>{state.label}</b><span>${(order.total / 100).toFixed(2)}</span></div>
                {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
              </button>
              {expanded && <div className="customer-order-details">
                {items.map((item, index) => <div className="order-detail-row" key={index}>
                  <span>المنتج</span><strong>{item.name || "شحن رقمي"}</strong>
                  {item.targetId && <><span>المعرّف</span><strong>{item.targetId}</strong></>}
                  {item.quantity != null && <><span>الكمية</span><strong>{String(item.quantity)}</strong></>}
                </div>)}
                <div className="order-detail-meta">
                  <span>حالة الدفع</span><strong>{order.paymentStatus === "confirmed" ? "مؤكد" : order.paymentStatus === "rejected" ? "مرفوض" : "بانتظار التأكيد"}</strong>
                  <span>حالة الشحن</span><strong>{order.executionStatus === "completed" ? "مكتمل" : order.executionStatus === "failed" ? "فشل" : supplierState(order.supplierStatus)}</strong>
                  {order.supplierOrderId && <><span>رقم المزوّد</span><strong>{order.supplierOrderId}</strong></>}
                  {order.ownerNote && <><span>ملاحظة</span><strong>{order.ownerNote}</strong></>}
                </div>
              </div>}
            </div>;
          }) : <p className="modal-copy">لا توجد طلبات مسجلة حتى الآن.</p>}
      </section>
    </div>
  </div>;
}
