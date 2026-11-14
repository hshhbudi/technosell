/**
 * حساب نقاط منتجات قسم التطبيقات.
 *
 * سعر النقطة يُشتق من سعر المورد في Fast4Top ونسبة الربح المعتمدة:
 *   سعر النقطة = سعر المورد للحد الأدنى × (100 + نسبة الربح) / (100 × الحد الأدنى)
 * ثم يُحسب سعر المنتج = سعر النقطة × عدد النقاط.
 *
 * الوحدة مشتركة بين الواجهة والخادم لضمان تطابق السعر المعروض مع السعر المحفوظ.
 */

export const APP_STORE_SECTION = "التطبيقات" as const;

/** أعلى عدد نقاط مسموح به في عملية واحدة (حماية من المدخلات الشاذة فقط). */
export const MAX_APP_POINTS = 10_000_000;

export type AppPointsPricing = {
  supplierPriceCents: number;
  markupPercent: number;
  quantity?: number | null;
  points?: number | null;
};

/** الحد الأدنى لكمية المورد، وهو الأساس الذي يُشتق منه سعر النقطة. */
export function appBaseQuantity(
  product: Pick<AppPointsPricing, "quantity">
): number {
  const quantity = Number(product.quantity);
  return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 1;
}

/** عدد النقاط المعتمد للمنتج: نقاط المالك إن وُجدت، وإلا حدّ المورد الأدنى. */
export function appPointsValue(product: {
  points?: number | null;
  quantity?: number | null;
}): number {
  const points = Number(product.points);
  if (Number.isSafeInteger(points) && points > 0) return points;

  return appBaseQuantity({ quantity: product.quantity });
}

/** سعر النقطة الواحدة بالسنت (قد يكون كسريًا). */
export function appPointPriceCents(product: AppPointsPricing): number {
  const base = appBaseQuantity(product);
  const markup = Math.max(0, Number(product.markupPercent) || 0);
  const supplier = Math.max(0, Number(product.supplierPriceCents) || 0);

  return (supplier * (100 + markup)) / (100 * base);
}

/** سعر عدد محدد من النقاط بالسنت. */
export function appPointsTotalCents(
  product: AppPointsPricing,
  points: number
): number {
  const safePoints = Math.max(1, Math.trunc(Number(points) || 0));
  return Math.round(appPointPriceCents(product) * safePoints);
}

/**
 * مقدار الخطوة لأزرار (+) و(−).
 * مجرد تسهيل للتحكم السريع؛ الإدخال اليدوي يسمح بأي عدد نقاط.
 */
export function appPointsStep(points: number): number {
  const value = Math.max(1, Math.trunc(Number(points) || 1));
  if (value >= 10_000) return 1_000;
  if (value >= 1_000) return 100;
  if (value >= 100) return 10;
  return 1;
}

/** عرض سعر النقطة بأربع خانات عشرية. */
export function formatPointPrice(cents: number): string {
  return `$ ${(Number(cents || 0) / 100).toFixed(4)}`;
}

/** عرض عدد النقاط بأرقام واضحة. */
export function formatPoints(points: number): string {
  return Number(points || 0).toLocaleString("en-US");
}
