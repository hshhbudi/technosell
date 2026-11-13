import manifest from "@/generated/product-images.json";

export type ProductImageEntry = {
  file: string;
  key: string;
  id?: string;
  section?: string;
  tokens: string[];
};

type ProductImageManifest = {
  generatedAt?: string | null;
  count?: number;
  entries?: ProductImageEntry[];
};

type ProductImageInput = {
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  imageUrl?: string | null;
  externalId?: string | null;
};

/** مجلد الصور المحلية: client/public/product-images */
const entries: ProductImageEntry[] = (((manifest as unknown) as ProductImageManifest).entries ?? []).filter(
  (entry): entry is ProductImageEntry => Boolean(entry && entry.file)
);

/** كلمات عامة لا تصلح وحدها لمطابقة صورة بمنتج. */
const GENERIC_TOKENS = new Set([
  "شحن",
  "رصيد",
  "جواهر",
  "شدات",
  "باقه",
  "بطاقه",
  "كود",
  "تعبئه",
  "اشتراك",
  "دولار",
  "سعر",
  "منتج",
  "خدمه",
]);

const ARABIC_RANGE = /[\u0600-\u06FF]/;

/** كلمات تبدأ بها أسماء كثيرة ولا تميّز منتجًا عن آخر، فنتجاوزها عند اختيار الحرف. */
const GENERIC_NAME_WORDS = new Set([
  "تطبيق",
  "تطبيقات",
  "لعبه",
  "العاب",
  "بطاقه",
  "بطاقات",
  "باقه",
  "باقات",
  "خدمه",
  "خدمات",
  "شحن",
  "تفعيل",
  "سماعه",
  "شاحن",
  "منتج",
  "منتجات",
  "عرض",
  "حساب",
  "رصيد",
  "اشتراك",
  "كود",
  "متجر",
  "رقم",
]);

/** توحيد الاسم لمقارنة مرنة بين أسماء الملفات وأسماء المنتجات. */
export function normalizeImageKey(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** أحرف/كلمة مختصرة تظهر داخل البلاطة عند غياب الصورة. */
export function monogramFor(name: string | null | undefined): string {
  const cleaned = String(name ?? "")
    .replace(/[([{][^)\]}]*[)\]}]/g, " ")
    .replace(/[0-9٠-٩]+/g, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "TS";

  const words = cleaned.split(" ").filter((word) => word.length > 1);

  if (ARABIC_RANGE.test(cleaned)) {
    const significant = words.filter(
      (word) => !GENERIC_NAME_WORDS.has(normalizeImageKey(word))
    );
    const word = significant[0] ?? words[0] ?? cleaned;
    return word.slice(0, 6);
  }

  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export type ArtworkTone = { from: string; to: string; glow: string };

const TONES: ArtworkTone[] = [
  { from: "#1e3a8a", to: "#0a1024", glow: "#38bdf8" },
  { from: "#4c1d95", to: "#150a28", glow: "#a855f7" },
  { from: "#0f766e", to: "#051b18", glow: "#2dd4bf" },
  { from: "#7c2d12", to: "#1a0d07", glow: "#fb923c" },
  { from: "#831843", to: "#19060f", glow: "#f472b6" },
  { from: "#1e40af", to: "#090f2b", glow: "#60a5fa" },
  { from: "#3f3f46", to: "#0e0e11", glow: "#a1a1aa" },
  { from: "#065f46", to: "#03140e", glow: "#34d399" },
];

/** لون ثابت لكل منتج حتى لا يتغيّر بين الزيارات. */
export function toneFor(seed: string | null | undefined): ArtworkTone {
  const value = String(seed ?? "techno-sell");
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) >>> 0;
  }
  return TONES[hash % TONES.length];
}

function scoreEntry(
  entry: ProductImageEntry,
  keys: string[],
  section?: string | null
): number {
  let best = 0;

  for (const key of keys) {
    if (!key) continue;

    if (entry.key === key) {
      best = Math.max(best, 1000 + entry.tokens.length);
      continue;
    }

    if (!entry.tokens.length) continue;

    const padded = ` ${key} `;
    const contained = entry.tokens.every((token) => padded.includes(` ${token} `));
    if (!contained) continue;

    const meaningful = entry.tokens.filter(
      (token) => !GENERIC_TOKENS.has(token) && (token.length >= 3 || /\d/.test(token))
    );
    if (!meaningful.length) continue;

    const coverage = entry.tokens.length / Math.max(1, key.split(" ").length);
    best = Math.max(
      best,
      200 + entry.tokens.length * 20 + Math.round(coverage * 50)
    );
  }

  if (best > 0 && section && entry.section === section) best += 30;
  return best;
}

/** يبحث عن صورة محلية مطابقة بالمعرّف أو بالاسم. */
export function findLocalProductImage(input: ProductImageInput): string | null {
  if (!entries.length) return null;

  const externalId = String(input.externalId ?? "").trim();
  if (externalId) {
    const byId = entries.find((entry) => entry.id === externalId);
    if (byId) return byId.file;
  }

  const keys = [
    normalizeImageKey(input.name),
    normalizeImageKey(input.subcategory),
    normalizeImageKey(`${input.name ?? ""} ${input.subcategory ?? ""}`),
  ].filter(Boolean);

  let bestEntry: ProductImageEntry | null = null;
  let bestScore = 0;

  for (const entry of entries) {
    if (!entry.key) continue;
    const score = scoreEntry(entry, keys, input.category);
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  return bestScore >= 200 && bestEntry ? bestEntry.file : null;
}

/**
 * صور علامات احتياطية من شبكة خارجية.
 * تُستخدم فقط إذا لم يضع المالك صورة، ويسقط النظام تلقائيًا إلى البلاطة المحلية عند فشلها.
 */
export function remoteBrandArtwork(input: ProductImageInput): string | null {
  const itemName = `${input.name ?? ""} ${input.subcategory ?? ""}`.toLowerCase();
  if (!itemName.trim()) return null;

  if (input.category === "التطبيقات") {
    if (/(haya|هايا|هيا)/i.test(itemName)) {
      return "https://play-lh.googleusercontent.com/wcwRELi8XuMjQHavMgULcNXD-WTVfkUs1nVW7x3cIuiuqRnHftHvOri4FLZAIPheewptkTEVBFQhi2lB3PYl2Q=w512-h512";
    }
    if (/(kwai|كواي)/i.test(itemName)) {
      return "https://play-lh.googleusercontent.com/_tbJZAK7486yk-0V2nBqYtH3lyWrZG5aI5MaKtzIsZou_UBEnX8wV5Dwyty2s2WsI3U6JgERB1-rBM_dJJoCcmk=w512-h512";
    }
    if (/(likee|لايكي)/i.test(itemName)) {
      return "https://play-lh.googleusercontent.com/5kFm2Or1bHsU_OEZWkrWPWTBol5V5lMYbZieFg8E_8iXjuarqkb6PEQnKW84nD6KPGvLySi_XZfY90dA0aFL=w512-h512";
    }
    if (/(bigo|بيجو)/i.test(itemName)) {
      return "https://play-lh.googleusercontent.com/8nDM585uK3X3AXiDQJC4lEARF_VLFrgdma-1YkdFMAwKi1LSrg4bMnWMGq7GqsviTKyL_LUfYayflZgs0SqCqQ=w512-h512";
    }
    const appArtwork: Array<[RegExp, string]> = [
      [/(tiktok|تيك\s*توك)/i, "tiktok"],
      [/(yalla\s*live|يلا\s*لايف)/i, "yallalive"],
      [/(mico|ميكو)/i, "mico"],
      [/(poppo|بوبو)/i, "poppo"],
      [/(livu|ليڤو)/i, "livu"],
      [/(imo|ايمو)/i, "imo"],
      [/(tango|تانجو)/i, "tango"],
      [/(momo|مومو)/i, "momolive"],
      [/(telegram|تلغرام|تيليجرام)/i, "telegram"],
      [/(youtube|يوتيوب)/i, "youtube"],
      [/(discord|ديسكورد)/i, "discord"],
      [/(spotify|سبوتيفاي)/i, "spotify"],
      [/(twitch|تويتش)/i, "twitch"],
    ];
    const app = appArtwork.find(([pattern]) => pattern.test(itemName));
    return app ? `https://cdn.simpleicons.org/${app[1]}/FFFFFF` : null;
  }

  if (input.category !== "الألعاب") return null;

  if (/(free\s*fire|فري\s*فاير)/i.test(itemName)) {
    return "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/d6/8f/47/d68f4742-5a10-b375-2114-0f840bd49ec1/AppIcon-1781539049-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg";
  }
  if (/(pubg|ببجي)/i.test(itemName)) {
    return "https://syimg.3dmgame.com/uploadimg/ico/2025/0515/1747294853476299.png";
  }

  const gameArtwork: Array<[RegExp, string]> = [
    [/(mobile\s*legends|mlbb|موبايل\s*ليجند)/i, "mobilelegendsbangbang"],
    [/(call\s*of\s*duty|cod|كول\s*اوف\s*ديوتي)/i, "callofduty"],
    [/(roblox|روبلوكس)/i, "roblox"],
    [/(minecraft|ماين\s*كرافت)/i, "minecraft"],
    [/(clash\s*of\s*clans|كلاش\s*اوف\s*كلانس)/i, "clashofclans"],
    [/(fortnite|فورتنايت)/i, "fortnite"],
    [/(valorant|فالورانت)/i, "valorant"],
    [/(genshin\s*impact|جينشن)/i, "genshinimpact"],
    [/(efootball|\bpes\b|بيس)/i, "konami"],
    [/(steam|ستيم)/i, "steam"],
    [/(playstation|psn|بلايستيشن)/i, "playstation"],
    [/(xbox|إكس\s*بوكس)/i, "xbox"],
  ];
  const artwork = gameArtwork.find(([pattern]) => pattern.test(itemName));
  return artwork ? `https://cdn.simpleicons.org/${artwork[1]}/FFFFFF` : null;
}

/**
 * أولوية الصورة:
 * 1) صورة رفعها المالك أو أرسلها المورد
 * 2) صورة محلية مطابقة في client/public/product-images
 * 3) صورة علامة احتياطية من الشبكة (اختيارية)
 * 4) null → بلاطة مولّدة بالكود
 */
export function resolveProductImage(input: ProductImageInput): string | null {
  const explicit = String(input.imageUrl ?? "").trim();
  if (explicit) {
    if (explicit.startsWith("//")) return `https:${explicit}`;
    return explicit;
  }

  return findLocalProductImage(input) ?? remoteBrandArtwork(input);
}

export function localImageCount(): number {
  return entries.length;
}
