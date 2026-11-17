
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  Gamepad2,
  Headphones,
  CreditCard,
  Bell,
  UserRound,
  Wifi,
  Home as HomeIcon,
  Menu,
  MessageCircle,
  Send,
  Bot,
  Moon,
  Package,
  Search,
  Settings,
  Smartphone,
  Sparkles,
  Sun,
  X,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import CustomerAuth from "@/components/CustomerAuth";
import ProductArtwork from "@/components/ProductArtwork";
import {
  appPointPriceCents,
  appPointsStep,
  appPointsTotalCents,
  appPointsValue,
  formatPointPrice,
  formatPoints,
} from "@shared/points";

type StoreProduct = {
  id: number;
  externalId: string;
  supplierDbId?: number;
  name: string;
  category:
    | "التطبيقات"
    | "الألعاب"
    | "المنتجات"
    | "الهواتف"
    | "الإكسسوارات"
    | "الخدمات والاتصالات"
    | "البطاقات الرقمية"
    | "العملات الرقمية"
    | "تفعيل الأرقام"
    | "السوشيال ميديا"
    | "الخدمات السورية"
    | "مزودات الإنترنت"
    | "التصميم"
    | "خدمات رقمية";
  subcategory: string;
  delivery: "id" | "code";
  price: number;
  stock: number;
  tag?: string;
  description: string;
  imageUrl?: string | null;
  accent: string;
  icon: "app" | "game" | "product";
  quantity?: { min?: string; max?: string } | null;
  quantityValues?: number[] | { min: number; max: number } | null;
  points?: number | null;
  markupPercent?: number;
  supplierPriceCents?: number;
  requires?: Array<{
    name?: string;
    question?: string;
    type?: string;
  }>;
};

const APP_ARABIC_NAMES: Array<[RegExp, string]> = [
  [/tiktok/i, "تيك توك"], [/tumile/i, "توميلي لايف"], [/meye?o/i, "ميو لايف"],
  [/soul\\s*chill/i, "سول تشيل"], [/soul\\s*u/i, "سول يو"], [/soul\\s*star/i, "سول ستار"],
  [/bigo/i, "بيجو لايف"], [/ahlan/i, "أهلًا شات"], [/likee/i, "لايكي لايف"],
  [/yalla/i, "يلا لايف"], [/kwai/i, "كواي"], [/talk\\s*talk/i, "توك توك"],
  [/up\\s*live/i, "أب لايف"], [/mico/i, "ميكو لايف"], [/4fun/i, "فور فن شات"],
  [/haki/i, "هاكي شات"], [/yoyo/i, "يويو شات"], [/yoho/i, "يوهو واكا"],
  [/falla/i, "فالا شات"], [/lama/i, "لاما شات"], [/lami/i, "لامي شات"],
  [/azal/i, "أزال لايف"], [/beela/i, "بيلا شات"], [/hawa/i, "حوا شات"],
  [/migo/i, "ميغو لايف"], [/poppo/i, "بوبو لايف"], [/party\\s*star/i, "بارتي ستار"],
  [/light\\s*chat/i, "لايت شات"], [/mr7ba/i, "مرحبا شات"], [/hayya?kom/i, "حياكم شات"],
  [/h(i|e)ya/i, "هيا شات"], [/tango/i, "تانجو"], [/sugo/i, "سوغو"],
  [/soyo/i, "سويو شات"], [/sky\\s*chat/i, "سكاي شات"], [/honey\\s*jar/i, "هاني جار"],
  [/imo/i, "إيمو"], [/livu/i, "ليف يو"], [/momo/i, "مومو لايف"],
  [/taka/i, "تاكا"], [/tada/i, "تادا شات"], [/e-?party/i, "إي بارتي"],
  [/yoparty/i, "يو بارتي"], [/yami/i, "يامي ستار"], [/laki/i, "لاكي شات"],
  [/doli/i, "دولي لايف"], [/hopi/i, "هوبي ستار"], [/nahki/i, "ناكي لايف"],
  [/yahoo/i, "ياهو ستار"], [/yudo/i, "يودو"], [/salam/i, "سلام شات"],
  [/our\\s*talk/i, "أور توك"], [/hi\\s*party/i, "هاي بارتي"], [/ditto/i, "ديتو لايف"],
  [/mango/i, "مانجو لايف"], [/wyak/i, "وياك شات"], [/allo/i, "ألو شات"],
  [/rostar/i, "روستار"], [/weso/i, "ويسو شات"], [/asha/i, "آشا لايف"],
  [/shila/i, "شيلا شات"], [/chamoji/i, "تشاموجي"], [/pk\\s*star/i, "بي كي ستار"],
  [/ti\\s*live/i, "تي آي لايف"], [/amisu/i, "أميسو بارتي"], [/sophia/i, "صوفيا شات"],
  [/hoob/i, "هوب شات"], [/nady/i, "نادي ستار"], [/lemi/i, "ليمي لايف"],
  [/oyuni/i, "أويوني"], [/nice\\s*chat/i, "نايس شات"], [/faby/i, "فابي ستار"],
  [/shaghaf/i, "شغف شات"], [/volistar/i, "فولي ستار"], [/wikoo/i, "ويكو"],
  [/moma/i, "موما لايف"], [/yula/i, "يولا شات"], [/yumi/i, "يومي شات"],
  [/ya?ha/i, "ياها شات"], [/sohi/i, "سوهي شات"], [/taj\\s*star/i, "تاج ستار"],
  [/tiktok/i, "تيك توك"], [/taka/i, "تاكا"], [/sodfa/i, "صدفة شات"],
  [/wego/i, "ويغو لايف"], [/saada/i, "سعادة"], [/higo/i, "هيغو شات"],
  [/habi/i, "هابي شات"], [/dana/i, "دانا"], [/kiti/i, "كيتي لايف"],
  [/hooka/i, "هوكا شات"], [/vilaa/i, "فيلا شات"], [/lions/i, "لايونز شات"],
  [/hilla/i, "هيلا شات"], [/kessmet/i, "كيسمت"], [/sahra/i, "سهرة شات"],
  [/waki/i, "واكي ستار"], [/layla/i, "ليلى شات"], [/leeski/i, "ليسكي"],
  [/oohla/i, "أوهلا شات"], [/nabd/i, "نبض شات"], [/waaw/i, "واو شات"],
  [/halla/i, "هلا لايف"], [/gam(et)?\\s*live/i, "غيمت لايف"], [/halo/i, "هالو ستار"],
  [/joyo/i, "جويو لايف"], [/hamster/i, "هامستر"], [/hoga/i, "هوغا شات"],
  [/maza/i, "مازا شات"], [/habby/i, "هابي شات"], [/will\\s*chill/i, "ويل تشيل"],
  [/we\\s*party/i, "وي بارتي"], [/zaar/i, "زار"], [/chillchat/i, "تشيل شات"],
  [/roka/i, "روكا لايف"], [/hiyoo/i, "هيو"], [/matemet/i, "ميت ميت"],
  [/tayyb/i, "طيب شات"], [/up\\s*fun/i, "أب فن"], [/fofo/i, "فوفو شات"],
  [/dika/i, "ديكا شات"], [/supermeet/i, "سوبر ميت"], [/karak/i, "كرك شات"],
  [/somatch/i, "سو ماتش"], [/laka/i, "لاكا شات"], [/hati/i, "هاتي شات"],
  [/we\\s*chill/i, "وي تشيل"], [/shabab/i, "شباب شات"], [/yayya/i, "يايا شات"],
  [/sama/i, "سما شات"], [/baat/i, "بات لايف"], [/lado/i, "لادو شات"],
  [/oloo/i, "أولو"], [/hami/i, "هامي بارتي"], [/zaffa/i, "زفة لايف"],
  [/mikoo/i, "ميكو"], [/litme/i, "ليت مي"], [/lotfun/i, "لوت فن"],
  [/yena/i, "يينا شات"], [/crush/i, "كراش لايف"], [/hoki/i, "هوكي شات"],
  [/woho/i, "وهو"], [/vone/i, "فون"], [/winko/i, "وينكو"],
  [/niu/i, "نيو شات"], [/arabstar/i, "عرب ستار"], [/ezzo/i, "إيزو"],
  [/sohha/i, "صحة لايف"], [/hay(i)?\\s*bulala/i, "هاي بولالا"],
  [/wahda/i, "وحدة"], [/taya/i, "تايا"], [/lama\\s*ludo/i, "لاما لودو"],
  [/rixo/i, "ريكسو"], [/sillagcc/i, "سيلا جي سي سي"], [/funni/i, "فني"],
  [/bota/i, "بوتا شات"], [/habi/i, "هابي شات"], [/niko/i, "نيكو شات"],
  [/pocoo/i, "بوكو شات"], [/holm/i, "هولم"], [/kitta/i, "كيتا"],
];
const transliterateAppName = (name: string) => {
  const words = name.replace(/[^a-zA-Z0-9\\s-]/g, " ").trim().split(/\\s+/).filter(Boolean);
  const map: Array<[RegExp, string]> = [
    [/tion/gi, "شن"], [/tch/gi, "تش"], [/sh/gi, "ش"], [/ch/gi, "تش"],
    [/th/gi, "ث"], [/kh/gi, "خ"], [/gh/gi, "غ"], [/ph/gi, "ف"],
    [/oo/gi, "و"], [/ee/gi, "ي"], [/ea/gi, "ي"], [/ai/gi, "اي"],
    [/ay/gi, "اي"], [/ou/gi, "او"], [/ow/gi, "او"], [/qu/gi, "كو"],
    [/ck/gi, "ك"], [/c/gi, "ك"], [/g/gi, "ج"], [/j/gi, "ج"],
    [/v/gi, "ڤ"], [/p/gi, "ب"], [/x/gi, "كس"], [/w/gi, "و"],
    [/y/gi, "ي"], [/z/gi, "ز"], [/s/gi, "س"], [/r/gi, "ر"],
    [/t/gi, "ت"], [/d/gi, "د"], [/f/gi, "ف"], [/h/gi, "ه"],
    [/k/gi, "ك"], [/l/gi, "ل"], [/m/gi, "م"], [/n/gi, "ن"],
    [/b/gi, "ب"], [/a/gi, "ا"], [/e/gi, "ي"], [/i/gi, "ي"],
    [/o/gi, "و"], [/u/gi, "و"],
  ];
  return words.map((word) => {
    let value = word;
    for (const [pattern, letter] of map) value = value.replace(pattern, letter);
    return value;
  }).join(" ");
};
const arabicAppName = (name: string) =>
  APP_ARABIC_NAMES.find(([pattern]) => pattern.test(name))?.[1] || transliterateAppName(name);

const APP_GROUP_ALIASES: Array<[RegExp, string]> = [
  [/soul\s*chill/i, "سول تشيل"], [/soul\s*u\b/i, "سول يو"], [/soul\s*star/i, "سول ستار"],
  [/talk\s*talk/i, "توك توك"], [/up\s*live/i, "أب لايف"], [/party\s*star/i, "بارتي ستار"],
  [/light\s*chat/i, "لايت شات"], [/sky\s*chat/i, "سكاي شات"], [/honey\s*jar/i, "هاني جار"],
  [/our\s*talk/i, "أور توك"], [/hi\s*party/i, "هاي بارتي"], [/nice\s*chat/i, "نايس شات"],
  [/taj\s*star/i, "تاج ستار"], [/hay\s*bulala/i, "هاي بولالا"], [/lama\s*ludo/i, "لاما لودو"],
  [/pk\s*star/i, "بي كي ستار"], [/ti\s*live/i, "تي آي لايف"], [/we\s*party/i, "وي بارتي"],
  [/will\s*chill/i, "ويل تشيل"], [/we\s*chill/i, "وي تشيل"], [/up\s*fun/i, "أب فن"],
  [/game\s*live/i, "غيمت لايف"], [/haya/i, "هيا شات"], [/tiktok/i, "تيك توك"],
  [/tumile/i, "توميلي لايف"], [/meyo/i, "ميو لايف"], [/bigo/i, "بيجو لايف"],
  [/ahlan/i, "أهلًا شات"], [/likee/i, "لايكي لايف"], [/yalla/i, "يلا لايف"],
  [/kwai/i, "كواي"], [/mico/i, "ميكو لايف"], [/4fun/i, "فور فن شات"],
  [/haki/i, "هاكي شات"], [/yoyo/i, "يويو شات"], [/yoho/i, "يوهو واكا"],
  [/falla/i, "فالا شات"], [/lama/i, "لاما شات"], [/lami/i, "لامي شات"],
  [/azal/i, "أزال لايف"], [/beela/i, "بيلا شات"], [/hawa/i, "حوا شات"],
  [/migo/i, "ميغو لايف"], [/poppo/i, "بوبو لايف"], [/mr7ba/i, "مرحبا شات"],
  [/tango/i, "تانجو"], [/sugo/i, "سوغو"], [/soyo/i, "سويو شات"], [/imo/i, "إيمو"],
  [/livu/i, "ليف يو"], [/momo/i, "مومو لايف"], [/taka/i, "تاكا"], [/tada/i, "تادا شات"],
  [/yami/i, "يامي ستار"], [/laki/i, "لاكي شات"], [/doli/i, "دولي لايف"], [/hopi/i, "هوبي ستار"],
  [/yudo/i, "يودو"], [/salam/i, "سلام شات"], [/ditto/i, "ديتو لايف"], [/mango/i, "مانجو لايف"],
  [/allo/i, "ألو شات"], [/rostar/i, "روستار"], [/weso/i, "ويسو شات"], [/asha/i, "آشا لايف"],
  [/shila/i, "شيلا شات"], [/amisu/i, "أميسو بارتي"], [/sophia/i, "صوفيا شات"],
  [/nady/i, "نادي ستار"], [/lemi/i, "ليمي لايف"], [/wikoo/i, "ويكو"], [/yumi/i, "يومي شات"],
  [/halla/i, "هلا لايف"], [/halo/i, "هالو ستار"], [/hamster/i, "هامستر"], [/hoga/i, "هوغا شات"],
  [/maza/i, "مازا شات"], [/roka/i, "روكا لايف"], [/hiyoo/i, "هيو"], [/vone/i, "فون"],
  [/winko/i, "وينكو"], [/niu/i, "نيو شات"], [/arabstar/i, "عرب ستار"], [/ezzo/i, "إيزو"],
  [/bota/i, "بوتا شات"], [/niko/i, "نيكو شات"], [/pocoo/i, "بوكو شات"], [/kitta/i, "كيتا"],
];

const isGenericAppSection = (subcategory: string) =>
  /^(apps?\s+section|app\s+section)$/i.test(subcategory.trim());

const getAppGroupName = (product: StoreProduct) => {
  const subcategory = (product.subcategory || "").trim();
  if (subcategory && !isGenericAppSection(subcategory)) return subcategory;
  const match = APP_GROUP_ALIASES.find(([pattern]) => pattern.test(product.name));
  if (match) return match[1];
  const baseName = product.name
    .replace(/\s*[-–—|:]?\s*\d[\d,.\s]*(?:coins?|diamonds?|points?|beans?|credits?|gifts?|نقطة|نقاط|ماسة|ماسات|عملة|عملات|كوينز?)\b.*$/i, "")
    .replace(/\s*[-–—|:].*$/, "")
    .trim();
  return baseName || product.name.trim() || "تطبيق";
};

const money = (cents: number) =>
  `$ ${(Number(cents || 0) / 100).toFixed(2)}`;

const pointsPricing = (product: StoreProduct) => ({
  supplierPriceCents: product.supplierPriceCents ?? 0,
  markupPercent: product.markupPercent ?? 8,
  quantity: Number(product.quantity?.min || 1),
  points: product.points ?? null,
});

const isGameProduct = (
  category: string,
  name = "",
  subcategory = ""
) =>
  /(ألعاب|العاب|game|games)/i.test(category) ||
  /(pubg|ببجي|free\s*fire|فري\s*فاير|jawaker|جواكر|call\s*of\s*duty|كول\s*اوف\s*ديوتي|mobile\s*legends|mlbb|roblox|minecraft|clash\s*of\s*clans|efootball|فيفا|fortnite|steam|playstation|xbox)/i.test(
    `${name} ${subcategory}`
  );

const isFreeFireProduct = (name = "", subcategory = "") =>
  /(free\s*fire|فري\s*فاير)/i.test(`${name} ${subcategory}`);

const isPubgProduct = (name = "", subcategory = "") =>
  /(pubg|ببجي)/i.test(`${name} ${subcategory}`);

const isCodeProduct = (
  name = "",
  subcategory = "",
  description = ""
) =>
  /(code|redeem|voucher|gift|كود|بطاقة|كرت)/i.test(
    `${name} ${subcategory} ${description}`
  );

const isBlockedCodeProduct = (
  name = "",
  subcategory = "",
  description = ""
) =>
  (isFreeFireProduct(name, subcategory) ||
    isPubgProduct(name, subcategory)) &&
  isCodeProduct(name, subcategory, description);

const freeFireSection = (
  name: string,
  subcategory: string,
  description: string
) =>
  isCodeProduct(name, subcategory, description)
    ? "Free Fire أكواد"
    : "Free Fire شحن بالـID";

export default function Home() {
  const supplierQuery = trpc.supplier.catalog.useQuery(undefined, {
    staleTime: 60_000,
  });
  const manualProductsQuery = trpc.products.list.useQuery(undefined, { staleTime: 60_000 });
  const supplierCategoryOverridesQuery = trpc.supplier.publicCategories.useQuery(undefined, { staleTime: 60_000 });

  const customerQuery = trpc.customer.me.useQuery();

  const [active, setActive] =
    useState<StoreProduct["category"]>("التطبيقات");

  const [subcategory, setSubcategory] = useState("");
  const [selectedApp, setSelectedApp] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StoreProduct | null>(null);
  const [targetId, setTargetId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  // Pearl (التصميم الأبيض رقم 2) هو المظهر الافتراضي للمتجر.
  // يبقى التبديل إلى الوضع الداكن متاحًا من إعدادات المظهر.
  const [lightMode, setLightMode] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<Array<{ role: "assistant" | "customer"; text: string }>>([
    { role: "assistant", text: "أهلاً بك في رصيد 👋 اسألني عن المنتجات والأسعار وشحن الألعاب والتطبيقات، أو اختر أحد الأزرار بالأسفل." },
  ]);

  const directTopup = trpc.customer.directTopup.useMutation({
    onSuccess: async () => {
      setSelected(null);
      setTargetId("");
      setQuantity("");

      await customerQuery.refetch();

      setToast(
        "تم إرسال طلب الشحن إلى Fast4Top؛ لمتابعة الحالة تواصل معنا على رقم الدعم"
      );

      setTimeout(() => setToast(""), 3200);
    },

    onError: (error) => {
      setToast(error.message);
      setTimeout(() => setToast(""), 3200);
    },
  });

  // منتجات المورد المعتمدة والمفعّلة من قاعدة البيانات
  const supplierCategoryOverrides = supplierCategoryOverridesQuery.data ?? [];
  const supplierProducts: StoreProduct[] = (
  supplierQuery.data?.products ?? []
).map((p) => {
  const category = p.category ?? "";
  const subcategory = p.subcategory ?? "";
  const description = p.description ?? "";

  return {
    id: p.id,
    externalId: String(p.externalId),
    supplierDbId: p.id,

    name: p.name,

    category: (p.storeSection || (isGameProduct(category, p.name, subcategory) ? "الألعاب" : /(mtn|syriatel|سيريتل|سيرياتيل|اتصالات|رصيد الهاتف)/i.test(`${category} ${p.name} ${subcategory}`) ? "الخدمات والاتصالات" : /(بطاقات|كروت|voucher|gift.?card|اشتراك|subscription)/i.test(`${category} ${p.name} ${subcategory}`) ? "البطاقات الرقمية" : /(app|application|تطبيق|بث مباشر|social)/i.test(`${category} ${p.name} ${subcategory}`) ? "التطبيقات" : "خدمات رقمية")) as StoreProduct["category"],

    subcategory: (() => {
      const sourceName = isFreeFireProduct(p.name, subcategory)
        ? freeFireSection(p.name, subcategory, description)
        : /pubg|ببجي/i.test(`${p.name} ${subcategory}`) ? "PUBG" : subcategory;
      return supplierCategoryOverrides.find(item => item.sourceName === sourceName)?.displayName || sourceName;
    })(),

    delivery:
      isFreeFireProduct(p.name, subcategory) &&
      isCodeProduct(p.name, subcategory, description)
        ? "code"
        : "id",

    price: p.sellingPriceCents,
    stock: p.available ? 99 : 0,
    quantity: p.quantity ? {
      min: String(p.quantity),
      max: String(
        p.quantityValues && !Array.isArray(p.quantityValues)
          ? (p.quantityValues as { min?: number; max?: number }).max
          : p.quantity
      ),
    } : null,
    quantityValues: Array.isArray(p.quantityValues)
      ? p.quantityValues.map(Number).filter((value: number) => Number.isSafeInteger(value) && value > 0)
      : p.quantityValues && typeof p.quantityValues === "object"
        ? { min: Number((p.quantityValues as { min?: number; max?: number }).min), max: Number((p.quantityValues as { min?: number; max?: number }).max) }
        : null,

    points: p.points ?? null,
    markupPercent: p.markupPercent,
    supplierPriceCents: p.supplierPriceCents,

    description,
    imageUrl: p.imageUrl || supplierCategoryOverrides.find(item => item.sourceName === subcategory)?.imageUrl || null,

    accent: isGameProduct(category, p.name, subcategory)
      ? "blue"
      : "pink",

    icon: isGameProduct(category, p.name, subcategory)
      ? "game"
      : "app", 
    
    requires: Array.isArray(p.requires) ? p.requires : [],
  };
});

  // إخفاء منتجات الأكواد المحظورة من الشحن المباشر مع إبقاء بقية أقسام المورد.
  const supplierOnlyIdProducts = supplierProducts.filter(
    (product) =>
      !isBlockedCodeProduct(
        product.name,
        product.subcategory ?? "",
        product.description ?? ""
      )
  );

  // منتجات المورد الرقمية مع المنتجات اليدوية المنشورة من لوحة الإدارة.
  const manualProducts: StoreProduct[] = (manualProductsQuery.data ?? []).map((p) => ({
    id: p.id, externalId: "manual-" + p.id, name: p.name,
    category: (["التطبيقات", "الألعاب", "المنتجات", "الهواتف", "الإكسسوارات", "الخدمات والاتصالات", "البطاقات الرقمية", "خدمات رقمية"].includes(p.category) ? p.category : "المنتجات") as StoreProduct["category"],
    subcategory: p.category, delivery: "id",
    price: Number(p.priceUsdCents ?? p.price ?? 0), stock: Number(p.stock ?? 0),
    tag: p.tag ?? undefined, description: p.description ?? "", imageUrl: p.imageUrl ?? null,
    accent: "gold", icon: "product",
  }));
  // يعرض المتجر المنتجات التي اختارها المالك من Fast4Top إضافة إلى المنتجات اليدوية المنشورة.
  const products: StoreProduct[] = [...supplierOnlyIdProducts, ...manualProducts];

  const appGroups = useMemo(() => {
    if (active !== "التطبيقات") return [];
    const grouped = new Map<string, StoreProduct[]>();
    for (const product of products) {
      if (product.category !== "التطبيقات") continue;
      // بعض منتجات Fast4Top تصل بتصنيف عام اسمه Apps Section.
      // لا نجمعها كلها في بطاقة واحدة؛ كل اسم تطبيق يجب أن يظهر كبطاقة مستقلة
      // حتى تظهر صورته وباقاته بشكل صحيح على الهاتف والكمبيوتر.
      const key = getAppGroupName(product);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(product);
    }
    return Array.from(grouped.entries()).map(([name, items]) => ({
      name, items,
      imageUrl: supplierCategoryOverrides.find(item => item.displayName === name || item.sourceName === name)?.imageUrl || items.find(item => item.imageUrl)?.imageUrl || null,
      productCount: items.length,
    })).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [products, active, supplierCategoryOverrides]);

  const subcategories = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .filter((p) => p.category === active)
            .map((p) => p.subcategory)
            .filter(Boolean)
        )
      ),
    [products, active]
  );

  useEffect(() => {
    if (
      subcategory &&
      !subcategories.includes(subcategory)
    ) {
      setSubcategory("");
    }
  }, [subcategories, subcategory]);

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          p.category === active &&
          (active !== "التطبيقات" || !selectedApp || getAppGroupName(p) === selectedApp) &&
          (!subcategory || p.subcategory === subcategory) &&
          p.name.toLowerCase().includes(query.toLowerCase())
      ),
    [products, active, subcategory, selectedApp, query]
  );

  const selectCategory = (
    value: StoreProduct["category"]
  ) => {
    setActive(value);
    setSubcategory("");
    setSelectedApp("");
    setQuery("");
  };

  const hasQuantity = (p: StoreProduct) =>
    Boolean(Array.isArray(p.quantityValues) && p.quantityValues.length) ||
    Boolean(p.quantityValues && !Array.isArray(p.quantityValues));

  const selectedPricing = selected ? pointsPricing(selected) : null;

  const selectedPoints = selectedPricing
    ? Math.max(1, Number(quantity) || appPointsValue(selectedPricing))
    : 1;

  const computedTotal = selected
    ? selected.category === "التطبيقات"
      ? selectedPoints === appPointsValue(pointsPricing(selected))
        ? selected.price
        : appPointsTotalCents(pointsPricing(selected), selectedPoints)
      : (() => {
          const min = Number(selected.quantity?.min || 1);

          const q = hasQuantity(selected)
            ? Math.max(min, Number(quantity) || min)
            : 1;

          return Math.max(
            1,
            Math.round(selected.price * (q / min))
          );
        })()
    : 0;

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 2800);
  };

  const startTopup = (product: StoreProduct) => {
    // المنتجات اليدوية لا يتم إرسالها إلى Fast4Top
    if (!product.supplierDbId) {
      showToast(
        "هذا المنتج غير متاح للشحن المباشر حاليًا"
      );
      return;
    }

    if (!customerQuery.data) {
      setAuthOpen(true);
      showToast("سجّل دخولك أولًا للشحن المباشر");
      return;
    }

    setSelected(product);
    setTargetId("");
    setQuantity(
      product.category === "التطبيقات"
        ? String(appPointsValue(pointsPricing(product)))
        : Array.isArray(product.quantityValues) && product.quantityValues.length
          ? String(product.quantityValues[0])
          : product.quantityValues && !Array.isArray(product.quantityValues)
            ? String(product.quantityValues.min)
            : ""
    );
  };

  const sendAssistantMessage = (rawText: string) => {
    const message = rawText.trim();
    if (!message) return;
    setAssistantMessages((items) => [...items, { role: "customer", text: message }]);
    setAssistantDraft("");

    const normalized = message.toLowerCase();
    const categoryMatch =
      /(ببجي|pubg|فري فاير|free fire|العاب|ألعاب|لعبة|game)/i.test(message)
        ? "الألعاب"
        : /(تطبيق|تطبيقات|هايا|haya|كواي|kwai|لايكي|likee|تيك.?توك|tiktok|بيجو|bigo)/i.test(message)
          ? "التطبيقات"
          : /(هاتف|موبايل|جوال|اكسسوار|إكسسوار|سماعة|شاحن)/i.test(message)
            ? "المنتجات"
            : /(بطاقة|بطاقات|اشتراك|كرت)/i.test(message)
              ? "البطاقات الرقمية"
              : null;

    const matchedProducts = products.filter((product) =>
      [product.name, product.subcategory, product.description]
        .filter(Boolean)
        .some((value) => normalized.includes(String(value).toLowerCase()) || String(value).toLowerCase().includes(normalized))
    );

    let answer = "";
    if (/(طلب|طلبي|حالة الشحن|وين وصل|تتبع|متابعة)/i.test(message)) {
      answer = customerQuery.data
        ? "لمتابعة طلباتك افتح حسابك من زر «حسابي» في أعلى المتجر. إذا لم تظهر الحالة أو احتجت مساعدة، تواصل مع الدعم البشري عبر واتساب."
        : "لمتابعة طلبك سجّل الدخول أولاً من زر «تسجيل الدخول»، ثم افتح حسابك والطلبات. ويمكنك التواصل مع الدعم عبر واتساب.";
    } else if (/(رصيد|محفظة|تعبئة|شحن رصيد الحساب)/i.test(message)) {
      answer = "لتعبئة رصيد حسابك اضغط «تعبئة الرصيد» وسجّل الدخول، ثم اتبع خطوات الدفع الظاهرة في المتجر. لا ترسل كلمة المرور أو رمز التحقق لأي شخص.";
    } else if (matchedProducts.length) {
      answer = "وجدت هذه المنتجات المنشورة حالياً في المتجر:\n" +
        matchedProducts.slice(0, 5).map((product) => `• ${product.name} — ${money(product.price)}`).join("\n") +
        "\nيمكنك فتح القسم والضغط على «اشحن الآن» للمنتجات المتاحة للشحن المباشر.";
    } else if (categoryMatch) {
      const categoryProducts = products.filter((product) => product.category === categoryMatch).slice(0, 5);
      answer = categoryProducts.length
        ? `قسم ${categoryMatch} يحتوي حالياً على:\n` + categoryProducts.map((product) => `• ${product.name} — ${money(product.price)}`).join("\n") + "\nاضغط زر القسم لعرض جميع المنتجات المتاحة."
        : `قسم ${categoryMatch} لا يحتوي حالياً على منتجات منشورة. يمكنك مراسلة الدعم للتأكد من توفر الخدمة.`;
      selectCategory(categoryMatch as StoreProduct["category"]);
    } else if (/(دفع|ادفع|شام كاش|shamcash)/i.test(message)) {
      answer = "طرق الدفع المتاحة تظهر لك أثناء تعبئة الرصيد أو تأكيد الطلب. لا تحول أي مبلغ إلى جهة غير موضحة داخل المتجر، وإذا واجهت مشكلة تواصل مع الدعم.";
    } else if (/(مرحبا|السلام|اهلا|أهلا|هاي|hello)/i.test(message)) {
      answer = "أهلاً وسهلاً فيك 🌟 كيف بقدر أساعدك؟ اسأل عن لعبة أو تطبيق أو سعر منتج، أو اختر أحد الأقسام.";
    } else {
      answer = "فيني أساعدك بمعلومات المنتجات المنشورة وأسعارها وأقسام الألعاب والتطبيقات، وبإرشادات الطلب وتعبئة الرصيد. إذا سؤالك يحتاج متابعة من موظف، اضغط «تواصل مع الدعم».";
    }

    setAssistantMessages((items) => [...items, { role: "assistant", text: answer }]);
  };

  const submitTopup = () => {
    if (!selected) return;

    if (!selected.supplierDbId) {
      showToast("معرّف منتج المورد غير موجود");
      return;
    }

    const target =
      selected.delivery === "code"
        ? undefined
        : targetId.trim();

    if (selected.delivery !== "code" && !target) {
      showToast("أدخل الـID المطلوب للشحن");
      return;
    }

    const q =
      selected.category === "التطبيقات"
        ? selectedPoints
        : hasQuantity(selected)
          ? Math.max(
              Number(selected.quantity?.min || 1),
              Number(quantity) || 1
            )
          : undefined;

    directTopup.mutate({
      // نرسل المعرّف الداخلي من قاعدة البيانات
      // وليس externalId الخاص بالمورد
      supplierProductId: selected.supplierDbId,

      name: selected.name,
      category: selected.subcategory,
      targetId: target,
      quantity: q,
      totalCents: computedTotal,
    });
  };
  return (
    <div
      className={`legacy-store ${lightMode ? "theme-light" : ""}`}
      dir="rtl"
    >
      
      <header className="legacy-header">
        <Link href="/" className="legacy-logo">
          <span className="legacy-logo-mark">ر</span>
          <span>رصيد</span>
        </Link>

        <nav className={menuOpen ? "open" : ""}>
          <button onClick={() => window.scrollTo({top:0,behavior:"smooth"})}><HomeIcon size={17}/> الرئيسية</button>
          <button onClick={() => document.getElementById("category-links")?.scrollIntoView({behavior:"smooth"})}><Package size={17}/> الأقسام</button>
          <button onClick={() => document.getElementById("catalog")?.scrollIntoView({behavior:"smooth"})}><Smartphone size={17}/> المنتجات</button>
        </nav>

        <div className="legacy-actions">
          <button className="theme-toggle" aria-label="بحث" title="بحث" onClick={() => { document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" }); window.setTimeout(() => document.querySelector<HTMLInputElement>(".legacy-search input")?.focus(), 350); }}>
            <Search size={19}/>
          </button>
          <button className="raseed-balance-button" onClick={() => setAuthOpen(true)} aria-label="رصيدي">
            <span>رصيد الحساب</span><strong>{customerQuery.data ? money(customerQuery.data.balanceCents ?? 0) : "تسجيل الدخول"}</strong>
          </button>
          <button className="raseed-wallet-topup" onClick={() => setAuthOpen(true)}><CreditCard size={17}/> تعبئة الرصيد</button>
          <button className="raseed-login-button" onClick={() => setAuthOpen(true)}><UserRound size={17}/> {customerQuery.data ? "حسابي" : "تسجيل الدخول"}</button>
          {!customerQuery.data && <button className="raseed-register-button" onClick={() => setAuthOpen(true)}>إنشاء حساب</button>}
          <button className="raseed-notifications-button" onClick={() => setAuthOpen(true)} aria-label="الإشعارات" title="الإشعارات"><Bell size={19}/></button>
          <button className="raseed-header-settings" onClick={() => setSettingsOpen(v => !v)} aria-label="الإعدادات" title="الإعدادات"><Settings size={20}/></button>
          {settingsOpen && <div className="raseed-header-settings-popover"><strong>إعدادات رصيد</strong><button onClick={() => {setLightMode(v => !v);setSettingsOpen(false);}}>{lightMode ? <Sun size={16}/> : <Moon size={16}/>} تغيير المظهر</button></div>}
          <button
            className="theme-toggle"
            onClick={() => setLightMode((v) => !v)}
            aria-label="تبديل المظهر"
          >
            {lightMode ? (
              <Moon size={19} />
            ) : (
              <Sun size={19} />
            )}
          </button>

          <button
            className="legacy-menu"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="القائمة"
          >
            <Menu size={23} />
          </button>
        </div>

      </header>

      <main>
        <div className="raseed-store-layout"><div className="raseed-main-column"><section className="legacy-hero">
          <div className="legacy-hero-copy">
            <span className="legacy-kicker">
              <Sparkles size={14} /> رصيد • وجهتك للشحن الرقمي
            </span>

            <h1>
              كل ما تحتاجه، <strong>في مكان واحد</strong>
            </h1>

            <p>
              أجهزة وإكسسوارات وألعاب وشحن وخدمات الاتصالات، بتجربة راقية وسريعة.
            </p>

            <div className="legacy-hero-buttons">
              <button
                className="legacy-primary"
                onClick={() =>
                  document
                    .getElementById("catalog")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                اكتشف الخدمات <ChevronLeft size={17} />
              </button>

              <span>
                <Zap size={16} /> تنفيذ مباشر • متابعة واضحة • دعم متواصل
              </span>
            </div>
          </div>

          <div className="legacy-hero-art raseed-hero-art">
            <div className="hero-glow" />

            <div className="hero-device">
              <div className="device-brand">RASEED • DIGITAL STORE</div>

              <div className="hero-icons">
                <Gamepad2 />
                <span>+</span>
                <Package />
              </div>

              <strong>شحنك أسهل مع رصيد</strong>
              <small>GAMES • LIVE APPS</small>
            </div>

            <div className="hero-sticker">
              آمن
              <br />
              <b>100%</b>
            </div>
          </div>
        </section>

        <section className="legacy-category-row" id="category-links">
  {([
    {category:"المنتجات",icon:<Package/>,title:"منتجات",hint:"منتجات المتجر"},
    {category:"الإكسسوارات",icon:<Headphones/>,title:"إكسسوارات",hint:"سماعات وكفرات وشواحن"},
    {category:"الهواتف",icon:<Smartphone/>,title:"هواتف",hint:"أحدث الأجهزة"},
    {category:"الألعاب",icon:<Gamepad2/>,title:"ألعاب",hint:"شحن وبطاقات ألعاب"},
    {category:"التطبيقات",icon:<Package/>,title:"التطبيقات",hint:"تطبيقات ورصيد وعملات رقمية"},
    {category:"الخدمات والاتصالات",icon:<Wifi/>,title:"خدمات MTN وسيريتل",hint:"رصيد وباقات وخدمات"},
    {category:"البطاقات الرقمية",icon:<CreditCard/>,title:"بطاقات رقمية",hint:"هدايا واشتراكات"},
    {category:"العملات الرقمية",icon:<CreditCard/>,title:"عملات رقمية",hint:"خدمات العملات"},
    {category:"تفعيل الأرقام",icon:<Smartphone/>,title:"تفعيل الأرقام",hint:"أرقام وخدمات تفعيل"},
    {category:"السوشيال ميديا",icon:<Sparkles/>,title:"السوشيال ميديا",hint:"خدمات المنصات"},
    {category:"الخدمات السورية",icon:<Wifi/>,title:"الخدمات السورية",hint:"خدمات محلية"},
    {category:"مزودات الإنترنت",icon:<Wifi/>,title:"مزودات الإنترنت",hint:"باقات الإنترنت"},
    {category:"التصميم",icon:<Sparkles/>,title:"التصميم",hint:"خدمات التصميم"},
    {category:"خدمات رقمية",icon:<Sparkles/>,title:"خدمات رقمية",hint:"اكتشف المزيد"},
  ] as const).map(item => (
    <button key={item.category} className={active === item.category ? "selected" : ""} onClick={() => selectCategory(item.category)}>
      <span className="category-card-icon">{item.icon}</span><strong>{item.title}</strong><small>{item.hint}</small>
    </button>
  ))}
</section>

        <section className="legacy-catalog" id="catalog">
          <div className="legacy-section-head">
            <div>
              <span className="legacy-kicker">DIRECT TOPUP / الشحن المباشر</span>
              <h2>{active === "التطبيقات" && selectedApp ? selectedApp : `قسم ${active}`}</h2>
              {active === "التطبيقات" && selectedApp && <small className="app-section-count">{filtered.length} منتج متاح</small>}
            </div>
            {(!(active === "التطبيقات" && !selectedApp)) && (
              <div className="legacy-search">
                <Search size={18}/>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث داخل هذا القسم..."/>
              </div>
            )}
          </div>
          {active === "التطبيقات" && !selectedApp ? (
            <div className="app-directory" aria-label="اختر التطبيق">
              {appGroups.map((app) => (
                <article key={app.name} className="app-directory-card">
                  <button type="button" className="app-directory-main" onClick={() => {setSelectedApp(app.name);setSubcategory("");setQuery("");}}>
                    <div className="app-directory-art">
                      {(() => {
                        // استخدم صورة أول باقة فعلية؛ اسم المجموعة العربي قد لا يطابق
                        // اسم ملف الصورة المحلي، وكان ذلك يعرض الغلاف البني الافتراضي.
                        const cover = app.items[0];
                        return <ProductArtwork
                          name={cover?.name || app.name}
                          category="التطبيقات"
                          subcategory={cover?.subcategory || app.name}
                          imageUrl={cover?.imageUrl || app.imageUrl}
                          externalId={cover?.externalId}
                          fit="contain"
                        />;
                      })()}
                    </div>
                    <div className="app-directory-heading">
                      <strong>{app.name}</strong>
                      <span>{app.productCount} باقات متاحة</span>
                    </div>
                    <ChevronLeft size={18} aria-hidden="true"/>
                  </button>
                  <div className="app-package-strip" aria-label={`باقات ${app.name}`}>
                    {app.items.slice(0, 5).map((item, index) => (
                      <button
                        type="button"
                        key={`${item.id}-${item.name}-${index}`}
                        className="app-package-mini"
                        title={item.name}
                        onClick={() => startTopup(item)}
                      >
                        <span className="app-package-art">
                          <ProductArtwork
                            name={item.name}
                            category={item.category}
                            subcategory={item.subcategory}
                            imageUrl={item.imageUrl}
                            externalId={item.externalId}
                            fit="contain"
                          />
                        </span>
                        <small>{item.points != null ? formatPoints(item.points) : `باقة ${index + 1}`}</small>
                      </button>
                    ))}
                  </div>
                  <button type="button" className="app-directory-action" onClick={() => {setSelectedApp(app.name);setSubcategory("");setQuery("");}}>
                    باقات التطبيق <ChevronLeft size={15}/>
                  </button>
                </article>
              ))}
              {appGroups.length === 0 && <div className="legacy-empty"><Package size={32}/><p>لا توجد تطبيقات منشورة حالياً.</p></div>}
            </div>
          ) : (
            <>
              {active === "التطبيقات" && selectedApp && (
                <button type="button" className="app-directory-back" onClick={() => {setSelectedApp("");setSubcategory("");setQuery("");}}>
                  <ChevronLeft size={17}/> العودة إلى كل التطبيقات
                </button>
              )}
              {active !== "التطبيقات" && (
                <div className="subcategory-row">
                  <button className={!subcategory ? "selected" : ""} onClick={() => setSubcategory("")}>كل المنتجات</button>
                  {subcategories.map((s) => (
                    <button key={s} className={subcategory === s ? "selected" : ""} onClick={() => setSubcategory(s)}>
                      <ProductArtwork variant="chip" name={s} category={active} subcategory={s} imageUrl={supplierCategoryOverrides.find(item => item.displayName === s)?.imageUrl}/>
                      {s}
                    </button>
                  ))}
                </div>
              )}
<div className="legacy-grid">
            {filtered.map((p) => (
              <article
                className="legacy-card"
                key={`${p.id}-${p.name}`}
              >
                <div
                  className={`legacy-card-art ${p.accent}`}
                >
                  {p.tag && (
                    
<b className="legacy-tag">{p.tag}</b>
                  )}

                  <ProductArtwork
                    name={p.name}
                    category={p.category}
                    subcategory={p.subcategory}
                    imageUrl={p.imageUrl}
                    externalId={p.externalId}
                    fit={p.icon === "product" ? "cover" : "contain"}
                  />
                </div>

                <div className="legacy-card-info">
                  <span>{p.subcategory}</span>
                  <h3>{p.name}</h3>
                  {(active === "التطبيقات" || p.category === "التطبيقات") && (
                    <small className="legacy-arabic-name" style={{display:"block",marginTop:4,opacity:.9,fontSize:13,direction:"rtl"}}>
                      {arabicAppName(p.name)}
                    </small>
                  )}
                  {p.category === "التطبيقات" &&
                    (p.points != null || Number(p.quantity?.min || 1) > 1) && (
                      <span className="legacy-points-badge">
                        {formatPoints(
                          appPointsValue({
                            points: p.points,
                            quantity: Number(p.quantity?.min || 1),
                          })
                        )}{" "}
                        نقطة
                      </span>
                    )}
                  <p>{p.description}</p>

                  <div className="legacy-card-bottom">
                    <strong>{money(p.price)}</strong>

                    {p.supplierDbId ? (
                      <button onClick={() => startTopup(p)}>اشحن الآن</button>
                    ) : (
                      <a className="legacy-manual-order" href={"https://wa.me/994408440648?text=" + encodeURIComponent("مرحباً، أريد الاستفسار وطلب: " + p.name)} target="_blank" rel="noreferrer">اطلب عبر واتساب</a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="legacy-empty">
              <Package size={32} />
              <p>لا توجد منتجات في هذا القسم حالياً.</p>
            </div>
          )}
            </> 
          )}
        </section></div><aside className="raseed-right-sidebar">
        <div className="raseed-wallet-card"><span>رصيد حسابك</span><strong>{customerQuery.data ? money(customerQuery.data.balanceCents ?? 0) : "سجّل دخولك"}</strong><button onClick={() => setAuthOpen(true)}>＋ تعبئة الرصيد</button><button className="raseed-login-sidebar" onClick={() => setAuthOpen(true)}>{customerQuery.data ? "حسابي والطلبات" : "تسجيل الدخول / إنشاء حساب"}</button></div>
        <button className="raseed-sidebar-settings" onClick={() => setSettingsOpen(v => !v)}><Settings size={22}/> الإعدادات <ChevronLeft size={17}/></button>
        {settingsOpen && <div className="raseed-sidebar-settings-panel"><button onClick={() => {setLightMode(v => !v);setSettingsOpen(false);}}>{lightMode ? <Sun size={16}/> : <Moon size={16}/>} تغيير المظهر</button><button onClick={() => {setAuthOpen(true);setSettingsOpen(false);}}>حسابي</button></div>}
        <button className="raseed-sidebar-theme" onClick={() => setLightMode(v => !v)}>{lightMode ? <Sun/> : <Moon/>} المظهر</button>
        <div className="raseed-sidebar-brand"><span>♛</span><strong>رصيد</strong><small>أسرع • آمن • الأفضل</small></div>
        <div className="raseed-sidebar-benefits"><span><Zap/> شحن فوري</span><span>♢ أمان عالي</span><span>◉ دعم 24/7</span></div>
      </aside></div>
      </main>

      {selected && (
        <div className="legacy-modal-backdrop">
          <div className="legacy-modal">
            <button
              className="legacy-modal-close"
              onClick={() => setSelected(null)}
              aria-label="إغلاق"
            >
              <X size={20} />
            </button>

            <h2>تأكيد طلب الشحن</h2>
            <strong>{selected.name}</strong>
            <p>{selected.description}</p>

            {selected.delivery !== "code" && (
              <label>
                معرّف اللاعب أو الحساب
                <input
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  placeholder="أدخل ID الحساب"
                />
              </label>
            )}

            {selected.category === "التطبيقات" ? (
              <label>
                عدد النقاط
                <div className="points-stepper">
                  <button
                    type="button"
                    className="points-step-btn"
                    aria-label="إنقاص النقاط"
                    onClick={() =>
                      setQuantity(
                        String(
                          Math.max(
                            1,
                            selectedPoints - appPointsStep(selectedPoints)
                          )
                        )
                      )
                    }
                    disabled={selectedPoints <= 1}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(e.target.value.replace(/[^\d]/g, ""))
                    }
                    onBlur={() => setQuantity(String(selectedPoints))}
                    aria-label="عدد النقاط"
                  />
                  <button
                    type="button"
                    className="points-step-btn"
                    aria-label="زيادة النقاط"
                    onClick={() =>
                      setQuantity(
                        String(
                          selectedPoints + appPointsStep(selectedPoints)
                        )
                      )
                    }
                  >
                    +
                  </button>
                </div>
                <small className="points-hint">
                  سعر النقطة: {formatPointPrice(appPointPriceCents(selectedPricing!))} — يمكنك إدخال أي عدد نقاط
                </small>
              </label>
            ) : (
              hasQuantity(selected) && (
                <label>
                  الكمية المتاحة لدى Fast4Top
                  {Array.isArray(selected.quantityValues) && selected.quantityValues.length ? (
                    <select
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    >
                      {selected.quantityValues.map((value) => (
                        <option key={value} value={value}>{value.toLocaleString("en-US")}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      min={selected.quantity?.min || 1}
                      max={selected.quantity?.max || undefined}
                      step="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="أدخل كمية ضمن حدود المورد"
                    />
                  )}
                </label>
              )
            )}

            <div className="legacy-modal-total">
              المجموع: <strong>{money(computedTotal)}</strong>
            </div>

            <button
              className="legacy-primary"
              onClick={submitTopup}
              disabled={directTopup.isPending}
            >
              {directTopup.isPending ? "جارٍ إرسال الطلب..." : "تأكيد الشحن"}
            </button>
          </div>
        </div>
      )}

      {authOpen && (
        <CustomerAuth
          onClose={() => setAuthOpen(false)}
          onSuccess={async () => {
            setAuthOpen(false);
            await customerQuery.refetch();
          }}
        />
      )}

      {toast && <div className="legacy-toast">{toast}</div>}

      <div className="raseed-assistant-root" dir="rtl">
        {assistantOpen && (
          <section className="raseed-assistant-panel" aria-label="مساعد رصيد">
            <header className="raseed-assistant-head">
              <span className="raseed-assistant-avatar"><Bot size={21} /></span>
              <div><strong>مساعد رصيد</strong><small>مساعدة آلية • الدعم البشري متاح</small></div>
              <button type="button" aria-label="إغلاق المحادثة" onClick={() => setAssistantOpen(false)}><X size={19} /></button>
            </header>
            <div className="raseed-assistant-messages" aria-live="polite">
              {assistantMessages.map((item, index) => (
                <div key={index} className={item.role === "customer" ? "raseed-chat-message customer" : "raseed-chat-message assistant"}>
                  {item.text.split("\n").map((line, lineIndex) => <span key={lineIndex}>{line}</span>)}
                </div>
              ))}
            </div>
            <div className="raseed-assistant-quick">
              <button type="button" onClick={() => sendAssistantMessage("أريد شحن ألعاب")}>شحن ألعاب</button>
              <button type="button" onClick={() => sendAssistantMessage("أريد شحن تطبيقات")}>شحن تطبيقات</button>
              <button type="button" onClick={() => sendAssistantMessage("كيف أتابع طلبي؟")}>متابعة طلب</button>
            </div>
            <form className="raseed-assistant-compose" onSubmit={(event) => { event.preventDefault(); sendAssistantMessage(assistantDraft); }}>
              <input value={assistantDraft} onChange={(event) => setAssistantDraft(event.target.value)} placeholder="اكتب سؤالك هنا..." aria-label="اكتب سؤالك" />
              <button type="submit" aria-label="إرسال السؤال" disabled={!assistantDraft.trim()}><Send size={18} /></button>
            </form>
            <a className="raseed-assistant-human" href={"https://wa.me/994408440648?text=" + encodeURIComponent("مرحباً، أحتاج مساعدة من فريق رصيد")} target="_blank" rel="noreferrer">تواصل مع الدعم البشري عبر واتساب</a>
            <small className="raseed-assistant-note">الإجابات آلية وتعتمد على المنتجات المنشورة؛ لا تنفّذ دفعاً أو طلب شحن نيابةً عنك.</small>
          </section>
        )}
        <button className="raseed-assistant-launcher" type="button" onClick={() => setAssistantOpen((open) => !open)} aria-label="افتح مساعد رصيد">
          {assistantOpen ? <X size={23} /> : <><MessageCircle size={22} /><span>اسأل مساعد رصيد</span></>}
        </button>
      </div>
      <style>{`
.app-directory{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:18px 0 26px}
        .app-directory-card{min-width:0;display:grid;gap:12px;padding:14px;border:1px solid #2b4776;border-radius:20px;background:linear-gradient(145deg,#172951,#101b38);color:#f7f1ff;text-align:right;box-shadow:0 10px 28px #0003;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
        .app-directory-card:hover{transform:translateY(-3px);border-color:#26c9e5;box-shadow:0 16px 34px #0005}
        .app-directory-main{min-width:0;display:grid;grid-template-columns:68px minmax(0,1fr) 20px;align-items:center;gap:12px;padding:0;border:0;background:transparent;color:inherit;text-align:right;cursor:pointer}
        .app-directory-art{position:relative;height:68px;overflow:hidden;border-radius:16px;background:linear-gradient(145deg,#202e5c,#10172f);display:grid;place-items:center;border:1px solid #38558a}
        .app-directory-art>*{width:100%;height:100%}
        .app-directory-art .pa-media,.app-package-art .pa-media{position:absolute;inset:0;width:100%;height:100%;z-index:3;object-fit:contain;padding:5px;background:transparent}
        .app-directory-art .pa-ready .pa-fallback,.app-package-art .pa-ready .pa-fallback{opacity:0}
        .app-directory-heading{min-width:0;display:grid;gap:4px}
        .app-directory-card strong{font-size:17px;font-weight:850;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .app-directory-heading span{font-size:11px;color:#a9c0e1}
        .app-package-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}
        .app-package-mini{min-width:0;display:grid;gap:5px;padding:5px 4px;border:1px solid #31558a;border-radius:11px;background:#102040;color:#d9ebff;cursor:pointer;transition:background .16s ease,border-color .16s ease,transform .16s ease}
        .app-package-mini:hover{transform:translateY(-2px);background:#1c3565;border-color:#35d1e9}
        .app-package-art{height:40px;display:grid;place-items:center;overflow:hidden;border-radius:7px;background:#162952}
        .app-package-art>*{width:100%;height:100%}
        .app-package-mini small{font-size:9px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#a9c9ed}
        .app-directory-action{justify-self:stretch;display:flex;align-items:center;justify-content:center;gap:5px;padding:9px 12px;border:0;border-radius:11px;background:linear-gradient(90deg,#a43cf1,#18c7df);color:#fff;font-weight:800;font-size:12px;cursor:pointer}
        .app-directory-back{display:flex;align-items:center;gap:7px;margin:14px 0;padding:10px 15px;border:1px solid #51406b;border-radius:999px;background:#1b1730;color:#f4d77d;font-weight:700;cursor:pointer}
        .app-section-count{display:block;margin-top:6px;color:#b9a9d2;font-size:12px}
        /* Pearl: لا بنفسجي ولا رمادي في بطاقات التطبيقات. */
        .theme-light .app-directory-card{border-color:#dbe6f3;background:#fff;color:#172b4d;box-shadow:0 10px 28px rgba(34,72,122,.10)}
        .theme-light .app-directory-card:hover{border-color:#19aeca;box-shadow:0 16px 34px rgba(34,72,122,.16)}
        .theme-light .app-directory-art{background:linear-gradient(145deg,#f5f9fd,#eaf2fa);border-color:#d5e2ef}
        .theme-light .app-directory-heading span{color:#6b7f99}
        .theme-light .app-package-mini{border-color:#d9e5f1;background:#f8fbfe;color:#203958}
        .theme-light .app-package-mini:hover{background:#eef8fc;border-color:#28b7cc}
        .theme-light .app-package-art{background:#eef4fa}
        .theme-light .app-package-mini small{color:#6b7f99}
        .theme-light .app-directory-action{background:linear-gradient(90deg,#164b7a,#1baabd);color:#fff}
        .theme-light .app-directory-back{border-color:#c9dbea;background:#fff;color:#22527a}
        .theme-light .app-section-count{color:#6b7f99}
        @media(max-width:850px){.app-directory{grid-template-columns:1fr}}
        @media(max-width:650px){.app-directory{gap:10px;margin:12px 0 20px}.app-directory-card{padding:10px;border-radius:15px;gap:9px}.app-directory-main{grid-template-columns:54px minmax(0,1fr) 18px;gap:9px}.app-directory-art{height:54px;border-radius:12px}.app-directory-card strong{font-size:14px}.app-package-strip{gap:4px}.app-package-mini{padding:4px 2px}.app-package-art{height:34px}.app-package-mini small{font-size:8px}}
                .raseed-assistant-root{position:fixed;right:18px;bottom:18px;z-index:90;font-family:Tahoma,"Segoe UI",Arial,sans-serif}
        .raseed-assistant-launcher{display:flex;align-items:center;gap:9px;padding:13px 17px;border-radius:999px;background:#19b8d2;color:#07152d;font-weight:800;box-shadow:0 8px 28px #0005}
        .raseed-assistant-panel{position:absolute;right:0;bottom:66px;width:min(365px,calc(100vw - 28px));height:min(540px,calc(100dvh - 115px));display:flex;flex-direction:column;overflow:hidden;border:1px solid #36517b;border-radius:19px;background:#091536;color:#eef5ff;box-shadow:0 18px 55px #0009}
        .raseed-assistant-head{display:flex;align-items:center;gap:10px;padding:13px;background:#112653;border-bottom:1px solid #29416e}
        .raseed-assistant-avatar{width:38px;height:38px;display:grid;place-items:center;border-radius:50%;background:#19b8d2;color:#07152d}
        .raseed-assistant-head div{display:grid;gap:4px;flex:1}.raseed-assistant-head strong{font-size:13px}.raseed-assistant-head small{font-size:10px;color:#a9bddc}
        .raseed-assistant-head>button{background:transparent;color:#dce9ff;padding:6px}
        .raseed-assistant-messages{flex:1;overflow:auto;padding:13px;display:flex;flex-direction:column;gap:9px}
        .raseed-chat-message{max-width:90%;padding:10px 12px;border-radius:13px;font-size:11px;line-height:1.8;white-space:pre-wrap;display:grid;gap:2px}
        .raseed-chat-message.assistant{align-self:flex-start;background:#142b57;color:#e7f2ff;border-bottom-right-radius:4px}
        .raseed-chat-message.customer{align-self:flex-end;background:#087f9d;color:#fff;border-bottom-left-radius:4px}
        .raseed-assistant-quick{display:flex;gap:6px;overflow-x:auto;padding:0 11px 10px}
        .raseed-assistant-quick button{white-space:nowrap;border:1px solid #34517f;background:#10234a;color:#cde9ff;border-radius:999px;padding:7px 10px;font-size:10px}
        .raseed-assistant-compose{display:flex;gap:7px;padding:10px;border-top:1px solid #263c65}
        .raseed-assistant-compose input{min-width:0;flex:1;border:1px solid #344b75;border-radius:11px;background:#101f42;color:#fff;padding:11px;font-size:12px;outline:none}
        .raseed-assistant-compose button{width:42px;border-radius:11px;background:#19b8d2;color:#07152d;display:grid;place-items:center}.raseed-assistant-compose button:disabled{opacity:.45}
        .raseed-assistant-human{display:block;text-align:center;color:#75e4f2;text-decoration:none;font-size:10px;padding:8px}
        .raseed-assistant-note{display:block;text-align:center;color:#8297ba;font-size:9px;padding:0 10px 10px}
        @media(max-width:480px){.raseed-assistant-root{right:12px;bottom:12px}.raseed-assistant-panel{right:0;width:calc(100vw - 24px);height:min(520px,calc(100dvh - 100px))}.raseed-assistant-launcher{padding:12px 15px}}
      `}</style>

      <footer className="legacy-footer">
        <strong>رصيد</strong>
        <span>كل احتياجاتك الرقمية والتقنية في مكان واحد</span>
        <small>تواصل: <a href="tel:+994408440648">+994408440648</a> · © {new Date().getFullYear()} رصيد</small>
      </footer>
    </div>
  );
}
