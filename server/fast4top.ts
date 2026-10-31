import { randomUUID } from "node:crypto";
import { ENV } from "./_core/env";

const FAST4TOP_BASE_URL = "https://api.fast4top.com";
const FAST4TOP_CATALOG_URL = "https://api.fast4top.com/api";
const FAST4TOP_ASSET_URL = "https://api.fast4top.com/";
const STORE_MARKUP = 1.10;

type Fast4TopCategory = { id: number; name: string; categories?: Fast4TopCategory[] };
type Fast4TopProduct = {
  id: number;
  product_name?: string;
  category_name?: string;
  price?: number;
  product_currency_price?: string;
  available?: boolean;
  visible?: number;
  photo?: string | null;
  description?: string | null;
  offer?: boolean;
  qty?: { min?: string; max?: string } | null;
  amount?: { min?: string; max?: string } | null;
  qty_values?: { min?: string | number; max?: string | number } | string[] | null;
  requires?: Array<{ name?: string; question?: string; type?: string }>;
};
type CategoryResponse = { status?: string; data?: { name?: string; products?: Fast4TopProduct[]; categories?: Fast4TopCategory[] } };
type ApiEnvelope<T> = { status?: string | number; message?: string; data?: T };
export type Fast4TopOrderStatus = "accept" | "reject" | "wait";
export type Fast4TopOrderResult = { orderId: string; status: Fast4TopOrderStatus; price?: number; raw: unknown };
export class Fast4TopError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryable = false) {
    super(message);
    this.name = "Fast4TopError";
  }
}

let catalogCache: { at: number; products: ReturnType<typeof normalizeProducts> } | null = null;
const apiToken = () => ENV.fast4topApiToken || ENV.fast4topApiKey;
export const isFast4TopConfigured = () => Boolean(apiToken());

async function apiGet<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const token = apiToken();
  if (!token) throw new Fast4TopError("NOT_CONFIGURED", "لم يتم إعداد رمز Fast4Top API في الخادم");
  const url = new URL(path, FAST4TOP_BASE_URL);
  Object.entries(params).forEach(([key, value]) => value !== undefined && url.searchParams.set(key, String(value)));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json", "api-token": token }, signal: controller.signal });
    let payload: unknown = null;
    try { payload = await response.json(); } catch { /* handled below */ }
    if (!response.ok) throw new Fast4TopError(`HTTP_${response.status}`, `Fast4Top أعاد HTTP ${response.status}`, response.status >= 500 || response.status === 429);
    const envelope = payload as ApiEnvelope<unknown>;
    const apiCode = typeof envelope?.status === "number" ? String(envelope.status) : undefined;
    if (apiCode && apiCode !== "200" && apiCode !== "OK") {
      const retryable = apiCode === "111" || apiCode === "114" || apiCode === "500";
      const messages: Record<string, string> = { "100": "رصيد حساب Fast4Top غير كافٍ", "105": "الكمية غير متاحة", "106": "الكمية غير مسموحة", "107": "معرّف اللاعب محظور", "109": "المنتج غير موجود", "110": "المنتج غير متاح حاليًا", "111": "Fast4Top طلب إعادة المحاولة بعد دقيقة", "112": "الكمية أصغر من الحد الأدنى", "113": "الكمية أكبر من الحد الأقصى", "121": "رمز Fast4Top غير صحيح", "123": "عنوان IP الخاص بالخادم غير مسموح في Fast4Top" };
      throw new Fast4TopError(apiCode, messages[apiCode] || envelope.message || `خطأ Fast4Top رقم ${apiCode}`, retryable);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof Fast4TopError) throw error;
    const message = error instanceof Error && error.name === "AbortError" ? "انتهت مهلة الاتصال بـ Fast4Top" : error instanceof Error ? error.message : "تعذر الاتصال بـ Fast4Top";
    throw new Fast4TopError("NETWORK", message, true);
  } finally { clearTimeout(timeout); }
}

async function readCategory(id: number): Promise<CategoryResponse["data"]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${FAST4TOP_CATALOG_URL}/category/products/${id}?lang=ar`, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) throw new Error(`Fast4Top returned HTTP ${response.status}`);
    const payload = (await response.json()) as CategoryResponse;
    return payload.data;
  } finally { clearTimeout(timeout); }
}

function normalizeProducts(raw: Array<{ product: Fast4TopProduct; section: "التطبيقات" | "الألعاب" }>) {
  const unique = new Map<number, { product: Fast4TopProduct; section: "التطبيقات" | "الألعاب" }>();
  for (const item of raw) if (item.product.visible !== 0 && item.product.available !== false) unique.set(item.product.id, item);
  return [...unique.values()].map(({ product, section }) => {
    const quantity = product.qty || product.amount || (Array.isArray(product.qty_values)
      ? { min: String(product.qty_values[0] ?? 1), max: String(product.qty_values[product.qty_values.length - 1] ?? 1) }
      : product.qty_values ? { min: String(product.qty_values.min ?? 1), max: String(product.qty_values.max ?? 1) } : null);
    return {
    externalId: product.id,
    name: product.product_name || `منتج ${product.id}`,
    category: section,
    subcategory: /pubg|ببجي/i.test(`${product.product_name || ""} ${product.category_name || ""}`) ? "PUBG" : product.category_name && !/^قسم\s*(التطبيقات|الألعاب)$/i.test(product.category_name) ? product.category_name : product.product_name || section,
    priceUsdCents: Math.max(0, Math.round(Number(product.price ?? product.product_currency_price ?? 0) * 100 * Number((product.qty || product.amount)?.min || 1) * STORE_MARKUP)),
    available: product.available !== false,
    imageUrl: product.photo ? (product.photo.startsWith("http") ? product.photo : new URL(product.photo.replace(/^\/+/, ""), FAST4TOP_ASSET_URL).toString()) : null,
    description: product.description || product.category_name || "منتج رقمي من Fast4Top",
    offer: Boolean(product.offer),
    quantity,
    requires: product.requires || [],
    };
  });
}

export async function readDigitalCatalog() {
  if (catalogCache && Date.now() - catalogCache.at < 60_000) return catalogCache.products;
  const roots = await Promise.all([readCategory(1), readCategory(2)]);
  const raw: Array<{ product: Fast4TopProduct; section: "التطبيقات" | "الألعاب" }> = [];
  roots.forEach((root, index) => (root?.products ?? []).forEach(product => raw.push({ product, section: index === 1 ? "الألعاب" : "التطبيقات" })));
  const visit = async (category: Fast4TopCategory, section: "التطبيقات" | "الألعاب"): Promise<void> => {
    try {
      const data = await readCategory(category.id);
      (data?.products ?? []).forEach(product => raw.push({ product, section }));
      await Promise.all((data?.categories ?? []).map(child => visit(child, section)));
    } catch (error) { console.warn(`[Fast4Top] category ${category.id} skipped:`, error instanceof Error ? error.message : "unknown error"); }
  };
  await Promise.all(roots.flatMap((root, index) => (root?.categories ?? []).map(category => visit(category, index === 1 ? "الألعاب" : "التطبيقات"))));
  const products = normalizeProducts(raw);
  catalogCache = { at: Date.now(), products };
  return products;
}

export async function getFast4TopProfile() {
  return apiGet<{ balance: string; email: string }>("/client/api/profile");
}

export async function createFast4TopOrder(input: { productId: number; quantity?: number; playerId?: string; orderUuid?: string }): Promise<Fast4TopOrderResult> {
  const orderUuid = input.orderUuid || randomUUID();
  const payload = await apiGet<ApiEnvelope<{ order_id?: string; status?: Fast4TopOrderStatus; price?: number }>>(`/client/api/newOrder/${input.productId}/params`, { qty: input.quantity ?? 1, ...(input.playerId ? { playerId: input.playerId } : {}), order_uuid: orderUuid });
  const data = payload.data;
  if (!data?.order_id || !data.status) throw new Fast4TopError("INVALID_RESPONSE", "استجابة Fast4Top غير مكتملة", true);
  return { orderId: data.order_id, status: data.status, price: data.price, raw: payload };
}

export async function checkFast4TopOrders(orderIds: string[]) {
  if (!orderIds.length) return [] as Array<{ order_id: string; status: Fast4TopOrderStatus; price?: string }>;
  const payload = await apiGet<ApiEnvelope<Array<{ order_id: string; status: Fast4TopOrderStatus; price?: string }>>>("/client/api/check", { orders: orderIds.join(",") });
  return payload.data || [];
}
