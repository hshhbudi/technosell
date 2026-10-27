const FAST4TOP_BASE_URL = "https://api.fast4top.com/api";
const FAST4TOP_ASSET_URL = "https://api.fast4top.com/";

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
  requires?: Array<{ name?: string; question?: string; type?: string }>;
};

type CategoryResponse = { status?: string; data?: { name?: string; products?: Fast4TopProduct[]; categories?: Fast4TopCategory[] } };
let catalogCache: { at: number; products: ReturnType<typeof normalizeProducts> } | null = null;

async function readCategory(id: number): Promise<CategoryResponse["data"]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${FAST4TOP_BASE_URL}/category/products/${id}?lang=ar`, {
      // Fast4Top exposes this catalog endpoint publicly; do not send the stored
      // credential to a read-only endpoint that rejects Bearer headers.
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Fast4Top returned HTTP ${response.status}`);
    const payload = (await response.json()) as CategoryResponse;
    return payload.data;
  } finally { clearTimeout(timeout); }
}

function normalizeProducts(raw: Array<{ product: Fast4TopProduct; section: "التطبيقات" | "الألعاب" }>) {
  const unique = new Map<number, { product: Fast4TopProduct; section: "التطبيقات" | "الألعاب" }>();
  for (const item of raw) if (item.product.visible !== 0 && item.product.available !== false) unique.set(item.product.id, item);
  return [...unique.values()].map(({ product, section }) => ({
    externalId: product.id,
    name: product.product_name || `منتج ${product.id}`,
    category: section,
    subcategory: product.category_name || section,
    priceUsdCents: Math.max(0, Math.round(Number(product.price ?? product.product_currency_price ?? 0) * 100)),
    available: product.available !== false,
    imageUrl: product.photo ? `${FAST4TOP_ASSET_URL}${product.photo}` : null,
    description: product.description || product.category_name || "منتج رقمي من Fast4Top",
    offer: Boolean(product.offer),
    quantity: product.qty || null,
    requires: product.requires || [],
  }));
}

export async function readDigitalCatalog() {
  if (catalogCache && Date.now() - catalogCache.at < 60_000) return catalogCache.products;
  const roots = await Promise.all([readCategory(1), readCategory(2)]);
  const categories = roots.flatMap(root => root?.categories ?? []);
  // Keep the supplier's public endpoint comfortable: it can expose many
  // child categories, so read them sequentially instead of opening 20+ calls.
  const responses: Array<{ data: CategoryResponse["data"]; section: "التطبيقات" | "الألعاب" }> = [];
  for (const category of categories) {
    const rootIndex = roots.findIndex(root => (root?.categories ?? []).some(item => item.id === category.id));
    responses.push({ data: await readCategory(category.id), section: rootIndex === 1 ? "الألعاب" : "التطبيقات" });
  }
  const raw: Array<{ product: Fast4TopProduct; section: "التطبيقات" | "الألعاب" }> = [];
  roots.forEach((root, index) => (root?.products ?? []).forEach(product => raw.push({ product, section: index === 1 ? "الألعاب" : "التطبيقات" })));
  responses.forEach(({ data, section }) => (data?.products ?? []).forEach(product => raw.push({ product, section })));
  const products = normalizeProducts(raw);
  catalogCache = { at: Date.now(), products };
  return products;
}
