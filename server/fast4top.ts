
import { randomUUID } from "node:crypto";
import { ENV } from "./_core/env";

const FAST4TOP_BASE_URL = "https://api.fast4top.com";
const STORE_MARKUP = 1.08;

type Fast4TopCategory = {
  id: number;
  name: string;
  categories?: Fast4TopCategory[];
};

type Fast4TopProduct = {
  id: number;
  name?: string;
  product_name?: string;
  category_name?: string;
  price?: number;
  base_price?: number;
  product_currency_price?: string;
  available?: boolean;
  visible?: number;
  photo?: string | null;
  category_img?: string | null;
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

type CategoryResponse = {
  status?: string | number;
  data?: {
    name?: string;
    products?: Fast4TopProduct[];
    categories?: Fast4TopCategory[];
  };
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

const apiToken = () =>
  ENV.fast4topApiToken || ENV.fast4topApiKey;

export const isFast4TopConfigured = () =>
  Boolean(apiToken());

// ========================================
// الاتصال بخادم Fast4Top
// ========================================

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

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "api-token": token,
      },
      signal: controller.signal,
    });

    let payload: any = null;

    try {
      payload = await response.json();
    } catch {
      // استجابة غير JSON
    }

    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.error ||
        `Fast4Top HTTP ${response.status}`;

      throw new Fast4TopError(
        `HTTP_${response.status}`,
        String(message),
        response.status >= 500 ||
          response.status === 429
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

    if (
      apiCode &&
      apiCode !== "200" &&
      apiCode !== "OK"
    ) {
      const messages: Record<string, string> = {
        "100": "رصيد حساب Fast4Top غير كافٍ",
        "105": "الكمية غير متاحة",
        "106": "الكمية غير مسموحة",
        "107": "معرّف اللاعب محظور",
        "108": "المنتج يحتاج إلى تحقق 2FA",
        "109": "المنتج غير موجود",
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
        "500": "خطأ داخلي في Fast4Top",
      };

      const retryable = [
        "111",
        "114",
        "130",
        "500",
      ].includes(apiCode);

      throw new Fast4TopError(
        apiCode,
        messages[apiCode] ||
          envelope.message ||
          `خطأ Fast4Top رقم ${apiCode}`,
        retryable
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof Fast4TopError) {
      throw error;
    }

    const message =
      error instanceof Error &&
      error.name === "AbortError"
        ? "انتهت مهلة الاتصال بـ Fast4Top"
        : error instanceof Error
          ? error.message
          : "تعذر الاتصال بـ Fast4Top";

    throw new Fast4TopError(
      "NETWORK",
      message,
      true
    );
  } finally {
    clearTimeout(timeout);
  }
}

// ========================================
// قراءة محتوى الأقسام
// ========================================

async function readCategory(
  id: number
): Promise<CategoryResponse["data"]> {
  const token = apiToken();

  if (!token) {
    throw new Fast4TopError(
      "NOT_CONFIGURED",
      "Fast4Top API Token غير موجود"
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    12000
  );

  try {
    const response = await fetch(
      `${FAST4TOP_BASE_URL}/client/api/content/${id}`,
      {
        headers: {
          Accept: "application/json",
          "api-token": token,
        },
        signal: controller.signal,
      }
    );

    let payload: any = null;

    try {
      payload = await response.json();
    } catch {
      // تجاهل الاستجابة غير الصالحة
    }

    if (!response.ok) {
      throw new Error(
        payload?.message ||
          `Fast4Top returned HTTP ${response.status}`
      );
    }

    return payload?.data ?? payload;
  } finally {
    clearTimeout(timeout);
  }
}

// ========================================
// تحويل المنتجات إلى صيغة المتجر
// ========================================

function normalizeProducts(
  raw: Array<{
    product: Fast4TopProduct;
    section: "التطبيقات" | "الألعاب";
  }>
) {
  const unique = new Map<
    number,
    {
      product: Fast4TopProduct;
      section: "التطبيقات" | "الألعاب";
    }
  >();

  for (const item of raw) {
    if (
      item.product.visible !== 0 &&
      item.product.available !== false
    ) {
      unique.set(item.product.id, item);
    }
  }

  return [...unique.values()].map(
    ({ product, section }) => {
      const qtyValues = product.qty_values;

      const quantity =
        product.qty ||
        product.amount ||
        (Array.isArray(qtyValues)
          ? {
              min: String(qtyValues[0] ?? 1),
              max: String(
                qtyValues[qtyValues.length - 1] ?? 1
              ),
            }
          : qtyValues
            ? {
                min: String(qtyValues.min ?? 1),
                max: String(qtyValues.max ?? 1),
              }
            : null);

      const minimumQuantity = Number(
        quantity?.min || 1
      );

      const price = Number(
        product.price ??
          product.product_currency_price ??
          0
      );

      const productName =
        product.name ||
        product.product_name ||
        `منتج ${product.id}`;

      const categoryName =
        product.category_name || productName;

      const photo =
        product.photo || product.category_img;

      const requires =
        product.requires ||
        (product.params || []).map((question) => ({
          name: question,
          question,
          type: "text",
        }));

      return {
        externalId: product.id,

        name: productName,

        category: section,

        subcategory:
          /pubg|ببجي/i.test(
            `${productName} ${categoryName}`
          )
            ? "PUBG"
            : categoryName &&
                !/^قسم\s*(التطبيقات|الألعاب)$/i.test(
                  categoryName
                )
              ? categoryName
              : productName,

        priceUsdCents: Math.max(
          0,
          Math.round(
            price *
              100 *
              minimumQuantity *
              STORE_MARKUP
          )
        ),

        available: product.available !== false,

        imageUrl: photo
          ? photo.startsWith("http")
            ? photo
            : new URL(
                photo.replace(/^\/+/, ""),
                FAST4TOP_BASE_URL + "/"
              ).toString()
          : null,

        description:
          product.description ||
          categoryName ||
          "منتج رقمي من Fast4Top",

        offer: Boolean(product.offer),

        quantity,

        quantityValues: Array.isArray(qtyValues)
          ? qtyValues
          : null,

        requires,

        productType: product.product_type || "package",
      };
    }
  );
}

// ========================================
// جلب كتالوج المنتجات بالكامل
// ========================================

export async function readDigitalCatalog() {
  if (
    catalogCache &&
    Date.now() - catalogCache.at < 60000
  ) {
    return catalogCache.products;
  }

  // الصفحة الرئيسية في توثيق Fast4Top هي content/0
  const root = await readCategory(0);

  const raw: Array<{
    product: Fast4TopProduct;
    section: "التطبيقات" | "الألعاب";
  }> = [];

  const visited = new Set<number>();

  const getSection = (
    name: string,
    parent: "التطبيقات" | "الألعاب"
  ): "التطبيقات" | "الألعاب" => {
    if (/game|لعبة|ألعاب|games/i.test(name)) {
      return "الألعاب";
    }

    if (/app|تطبيق|تطبيقات/i.test(name)) {
      return "التطبيقات";
    }

    return parent;
  };

  const visit = async (
    category: Fast4TopCategory,
    parentSection: "التطبيقات" | "الألعاب"
  ): Promise<void> => {
    if (visited.has(category.id)) return;

    visited.add(category.id);

    const section = getSection(
      category.name || "",
      parentSection
    );

    try {
      const data = await readCategory(category.id);

      (data?.products ?? []).forEach((product) => {
        raw.push({ product, section });
      });

      await Promise.all(
        (data?.categories ?? []).map((child) =>
          visit(child, section)
        )
      );
    } catch (error) {
      console.warn(
        `[Fast4Top] category ${category.id} skipped:`,
        error instanceof Error
          ? error.message
          : "unknown error"
      );
    }
  };

  const rootSection = "التطبيقات" as const;

  (root?.products ?? []).forEach((product) => {
    raw.push({
      product,
      section: rootSection,
    });
  });

  await Promise.all(
    (root?.categories ?? []).map((category) =>
      visit(category, rootSection)
    )
  );

  const products = normalizeProducts(raw);

  catalogCache = {
    at: Date.now(),
    products,
  };

  return products;
}

// ========================================
// معلومات حساب Fast4Top
// ========================================

export async function getFast4TopProfile() {
  return apiGet<{
    balance: string;
    email: string;
  }>("/client/api/profile");
}

// ========================================
// إنشاء طلب شحن
// ========================================

export async function createFast4TopOrder(input: {
  productId: number;
  quantity?: number;
  playerId?: string;
  orderUuid?: string;
  extraParams?: Record<string, string | number>;
}): Promise<Fast4TopOrderResult> {
  const orderUuid =
    input.orderUuid || randomUUID();

  const params: Record<
    string,
    string | number | undefined
  > = {
    qty: input.quantity ?? 1,
    ...(input.playerId
      ? { playerId: input.playerId }
      : {}),
    ...(input.extraParams || {}),
    order_uuid: orderUuid,
  };

  const payload = await apiGet<
    ApiEnvelope<{
      order_id?: string;
      status?: Fast4TopOrderStatus;
      price?: number;
    }>
  >(
    `/client/api/newOrder/${input.productId}/params`,
    params
  );

  const data = payload.data;

  if (!data?.order_id || !data.status) {
    throw new Fast4TopError(
      "INVALID_RESPONSE",
      "استجابة Fast4Top غير مكتملة",
      true
    );
  }

  return {
    orderId: data.order_id,
    status: data.status,
    price: data.price,
    raw: payload,
  };
}

// ========================================
// التحقق من حالة الطلبات
// ========================================

export async function checkFast4TopOrders(
  orderIds: string[]
) {
  if (!orderIds.length) {
    return [] as Array<{
      order_id: string;
      status: Fast4TopOrderStatus;
      price?: string;
    }>;
  }

  const orders = `[${orderIds.join(",")}]`;

  const payload = await apiGet<
    ApiEnvelope<
      Array<{
        order_id: string;
        status: Fast4TopOrderStatus;
        price?: string;
      }>
    >
  >("/client/api/check", {
    orders,
  });

  return payload.data || [];
}
