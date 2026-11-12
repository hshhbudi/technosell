
import { randomUUID } from "node:crypto";
import { ENV } from "./_core/env";
import { syncSupplierProducts } from "./db";

const FAST4TOP_BASE_URL = "https://api.fast4top.com";

type Fast4TopProduct = {
  id: number;
  name?: string;
  product_name?: string;
  category_name?: string;
  price?: number | string;
  base_price?: number | string;
  product_currency_price?: string;
  available?: boolean;
  visible?: number;
  photo?: unknown;
  image?: unknown;
  image_url?: unknown;
  product_image?: unknown;
  productImage?: unknown;
  product_img?: unknown;
  thumbnail?: unknown;
  picture?: unknown;
  img?: unknown;
  images?: unknown;
  icon?: unknown;
  icon_url?: unknown;
  logo?: unknown;
  category_img?: unknown;
  description?: string | null;
  offer?: boolean;
  product_type?: string;
  parent_id?: number;
  qty?: { min?: string; max?: string } | null;
  amount?: { min?: string; max?: string } | null;
  qty_values?:
    | { min?: string | number; max?: string | number }
    | string[]
    | null;
  requires?: Array<{
    name?: string;
    question?: string;
    type?: string;
  }>;
  params?: string[];
};

type ApiEnvelope<T> = {
  status?: string | number;
  message?: string;
  data?: T;
};

export type Fast4TopOrderStatus = "accept" | "reject" | "wait";

export type Fast4TopOrderResult = {
  orderId: string;
  status: Fast4TopOrderStatus;
  price?: number;
  raw: unknown;
};

export class Fast4TopError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false
  ) {
    super(message);
    this.name = "Fast4TopError";
  }
}

let catalogCache: {
  at: number;
  products: ReturnType<typeof normalizeProducts>;
} | null = null;

const apiToken = () => ENV.fast4topApiToken || ENV.fast4topApiKey;

export const isFast4TopConfigured = () => Boolean(apiToken());

const ERROR_MESSAGES: Record<string, string> = {
  "100": "رصيد حساب Fast4Top غير كافٍ",
  "105": "الكمية غير متاحة",
  "106": "الكمية غير مسموحة",
  "107": "معرّف اللاعب محظور",
  "108": "المنتج يحتاج إلى تحقق 2FA",
  "109": "المنتج غير موجود أو تم حذفه",
  "110": "المنتج غير متاح حالياً",
  "111": "يجب إعادة المحاولة بعد دقيقة",
  "112": "الكمية أصغر من الحد الأدنى",
  "113": "الكمية أكبر من الحد الأقصى",
  "114": "خطأ غير معروف من Fast4Top",
  "120": "رمز API مطلوب",
  "121": "رمز API غير صحيح",
  "122": "غير مسموح باستخدام API",
  "123": "عنوان IP الخادم غير مسموح",
  "130": "خادم Fast4Top تحت الصيانة",
  "500": "خطأ داخلي من Fast4Top",
};

async function apiGet<T>(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  const token = apiToken();

  if (!token) {
    throw new Fast4TopError(
      "NOT_CONFIGURED",
      "لم يتم إعداد FAST4TOP_API_TOKEN في الخادم"
    );
  }

  const url = new URL(path, FAST4TOP_BASE_URL);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "api-token": token,
      },
      signal: controller.signal,
    });

    const responseText = await response.text();
    let payload: any = null;

    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const details =
        payload?.message ||
        payload?.error ||
        responseText ||
        "لا توجد تفاصيل إضافية";

      throw new Fast4TopError(
        `HTTP_${response.status}`,
        `Fast4Top HTTP ${response.status}: ${String(details).slice(0, 1000)}`,
        response.status >= 500 || response.status === 429
      );
    }

    const envelope = payload as ApiEnvelope<unknown>;

    const apiCode =
      typeof envelope?.status === "number"
        ? String(envelope.status)
        : typeof envelope?.status === "string" &&
            envelope.status !== "OK"
          ? envelope.status
          : undefined;

    if (apiCode && apiCode !== "200" && apiCode !== "OK") {
      const message =
        ERROR_MESSAGES[apiCode] ||
        envelope.message ||
        `خطأ Fast4Top رقم ${apiCode}`;

      throw new Fast4TopError(
        apiCode,
        message,
        ["111", "114", "130", "500"].includes(apiCode)
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof Fast4TopError) {
      throw error;
    }

    const message =
      error instanceof Error && error.name === "AbortError"
        ? "انتهت مهلة الاتصال بـ Fast4Top"
        : error instanceof Error
          ? error.message
          : "تعذر الاتصال بـ Fast4Top";

    throw new Fast4TopError("NETWORK", message, true);
  } finally {
    clearTimeout(timeout);
  }
}

function detectSection(
  product: Fast4TopProduct
): "التطبيقات" | "الألعاب" | null {
  const value = [
    product.name,
    product.product_name,
    product.category_name,
    product.product_type,
  ].filter(Boolean).join(" ").toLowerCase();

  // Use explicit supplier type/category labels first, then known Fast4Top catalog brands.
  if ((/\b(app|apps|application|applications|live app|social app)\b|قسم التطبيقات|تطبيقات/i.test(value))) {
    return "التطبيقات";
  }
  if ((/\b(game|games|gaming)\b|قسم الألعاب|قسم الالعاب|ألعاب|العاب/i.test(value))) {
    return "الألعاب";
  }

  // Fast4Top social/live application catalog (including brands shown in its Apps section).
  if (/(haya|kwai|likee|bigo|tiktok|تيك\s*توك|poppo|mico|chamet|yalla\s*live|buzzcast|liveme|live\s*me|nonolive|uplive|soul\s*chill|mey[o]?\s*live|mey[o]?\s*chat|tumile|4fun|talk\s*talk|bo?bo\s*chat|yoho\s*waka|yoyo\s*chat|haki\s*chat|azal\s*live|lami\s*chat|lama\s*chat|falla\s*chat|migo\s*live|hawa\s*chat|beela\s*chat|mr.?7ba|light\s*chat|party\s*star|ligo\s*live|binmo\s*chat|hlah\s*chat|hayyakom|dream\s*chat|super\s*live|fancy\s*live|kiyo\s*chat|imo\s*chat|honey\s*jar|sky\s*chat|soyo\s*chat|livu|xena\s*live|ayome\s*chat|lit\s*chat|tango\s*live|yaahlan|momo\s*live|hicat\s*chat|yooy\s*chat|hallame|sugo|tami\s*chat|سول\s*تشيل|هاي\s*شات|كواي|لايكي|بيجو)/i.test(value)) {
    return "التطبيقات";
  }

  // Fast4Top games catalog.
  if (/(pubg|ببجي|free\s*fire|freefire|فري\s*فاير|call\s*of\s*duty|كول\s*اوف\s*ديوتي|mobile\s*legends|mlbb|roblox|minecraft|clash\s*of\s*clans|clash\s*royale|8\s*ball\s*pool|8ball|jawaker|جواكر|fifa\s*mobile|efootball|فيفا|fortnite|steam|playstation|xbox|valorant|genshin|whiteout\s*survival|football\s*rising|ludo\s*world|rise\s*of\s*the\s*kings|wepla|undawn|stumble\s*guys|last\s*war|brawl\s*stars|yalla\s*ludo|موبايل\s*ليجند)/i.test(value)) {
    return "الألعاب";
  }

  return null;
}

function imageCandidate(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = imageCandidate(item);
      if (found) return found;
    }
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["url", "src", "path", "image_url", "image", "original", "thumbnail"]) {
      const found = imageCandidate(record[key]);
      if (found) return found;
    }
  }
  return null;
}

function resolveProductImage(product: Fast4TopProduct): string | null {
  const record = product as Record<string, unknown>;
  for (const key of [
    "image", "image_url", "photo", "product_image", "productImage",
    "product_img", "thumbnail", "picture", "img", "images",
    "icon", "icon_url", "logo", "category_img",
  ]) {
    const candidate = imageCandidate(record[key]);
    if (!candidate) continue;
    if (/^(https?:)?\/\//i.test(candidate)) return candidate.startsWith("//") ? `https:${candidate}` : candidate;
    return new URL(candidate.replace(/^\/+/, ""), FAST4TOP_BASE_URL + "/").toString();
  }
  return null;
}

function normalizeProducts(products: Fast4TopProduct[]) {
  const unique = new Map<number, Fast4TopProduct>();

  for (const product of products) {
    if (
      product &&
      Number.isFinite(Number(product.id)) &&
      Number(product.id) > 0
    ) {
      unique.set(Number(product.id), product);
    }
  }

  return [...unique.values()].filter((product) => detectSection(product) !== null).map((product) => {
    const qtyValues = product.qty_values;

    const quantity =
      product.qty ||
      product.amount ||
      (Array.isArray(qtyValues)
        ? {
            min: String(qtyValues[0] ?? 1),
            max: String(qtyValues[qtyValues.length - 1] ?? 1),
          }
        : qtyValues
          ? {
              min: String(qtyValues.min ?? 1),
              max: String(qtyValues.max ?? 1),
            }
          : null);

    const minimumQuantity = Math.max(
      1,
      Number(quantity?.min || 1) || 1
    );

    const price = Number(
      product.price ??
        product.product_currency_price ??
        product.base_price ??
        0
    );

    const name =
      product.name ||
      product.product_name ||
      `منتج ${product.id}`;

    const categoryName = product.category_name || name;
    // Accept URL strings and nested/array image payloads from Fast4Top.
    const photo = resolveProductImage(product);

    const requires =
      product.requires ||
      (product.params || []).map((question) => ({
        name: question,
        question,
        type: "text",
      }));

    return {
      externalId: String(product.id),
      name,
      category: detectSection(product),
      subcategory: categoryName,

      // سعر المزوّد فقط، بدون إضافة نسبة ربح هنا.
      supplierPriceCents: Math.max(
        0,
        Math.round(price * 100 * minimumQuantity)
      ),

      available:
        product.available !== false && product.visible !== 0,

      imageUrl: photo,

      description:
        product.description ||
        categoryName ||
        "منتج رقمي من Fast4Top",

      quantity: minimumQuantity,
      quantityValues: Array.isArray(qtyValues)
        ? qtyValues
        : null,
      requires,
      productType: product.product_type || "package",
    };
  });
}

export async function readDigitalCatalog() {
  if (catalogCache && Date.now() - catalogCache.at < 60000) {
    return catalogCache.products;
  }

  const response = await apiGet<
    Fast4TopProduct[] | ApiEnvelope<Fast4TopProduct[]>
  >("/client/api/products");

  const productsRaw = Array.isArray(response)
    ? response
    : Array.isArray(response?.data)
      ? response.data
      : null;

  if (!productsRaw) {
    throw new Fast4TopError(
      "INVALID_PRODUCTS_RESPONSE",
      "Fast4Top لم يرجع قائمة منتجات صالحة",
      true
    );
  }

  const products = normalizeProducts(productsRaw);

  catalogCache = {
    at: Date.now(),
    products,
  };

  return products;
}

/**
 * جلب المنتجات من Fast4Top وحفظها في قاعدة البيانات.
 * المنتجات الجديدة تُحفظ غير معتمدة وغير مفعلة افتراضياً.
 */
export async function syncFast4TopCatalog() {
  const products = await readDigitalCatalog();

  const syncResult = await syncSupplierProducts(products);

  return {
    total: syncResult.total,
    inserted: syncResult.inserted,
    updated: syncResult.updated,
    message: "تم جلب المنتجات ومزامنتها مع قاعدة البيانات",
  };
}

export async function getFast4TopProfile() {
  return apiGet<{
    balance: string;
    email: string;
  }>("/client/api/profile");
}

export async function createFast4TopOrder(input: {
  productId: number;
  quantity?: number;
  playerId?: string;
  orderUuid?: string;
  extraParams?: Record<string, string | number>;
}): Promise<Fast4TopOrderResult> {
  if (
    !Number.isFinite(input.productId) ||
    input.productId <= 0
  ) {
    throw new Fast4TopError(
      "INVALID_PRODUCT_ID",
      "معرّف المنتج غير صالح"
    );
  }

  const orderUuid = input.orderUuid || randomUUID();

  const params: Record<string, string | number | undefined> = {
    qty: input.quantity ?? 1,
    ...(input.playerId ? { playerId: input.playerId } : {}),
    ...(input.extraParams || {}),
    order_uuid: orderUuid,
  };

  const payload = await apiGet<
    ApiEnvelope<{
      order_id?: string;
      status?: Fast4TopOrderStatus;
      price?: number;
    }>
  >(`/client/api/newOrder/${input.productId}/params`, params);

  const data = payload?.data;

  if (
    !data?.order_id ||
    !["accept", "reject", "wait"].includes(data.status || "")
  ) {
    throw new Fast4TopError(
      "INVALID_RESPONSE",
      "استجابة Fast4Top غير مكتملة",
      true
    );
  }

  return {
    orderId: data.order_id,
    status: data.status as Fast4TopOrderStatus,
    price: data.price,
    raw: payload,
  };
}

export async function checkFast4TopOrders(orderIds: string[]) {
  if (!orderIds.length) {
    return [] as Array<{
      order_id: string;
      status: Fast4TopOrderStatus;
      price?: string;
    }>;
  }

  const payload = await apiGet<
    ApiEnvelope<
      Array<{
        order_id: string;
        status: Fast4TopOrderStatus;
        price?: string;
      }>
    >
  >("/client/api/check", {
    orders: JSON.stringify(orderIds),
  });

  return payload.data || [];
}
