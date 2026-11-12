
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
  requires?: Array<{
    name?: string;
    question?: string;
    type?: string;
  }>;
};

const money = (cents: number) =>
  `$ ${(Number(cents || 0) / 100).toFixed(2)}`;

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

const fallbackImageFor = (
  product: Pick<StoreProduct, "name" | "subcategory" | "category">
): string | null => {
  const itemName = `${product.name} ${product.subcategory}`.toLowerCase();

  // Official Google Play app icons for products without supplier artwork.
  if (product.category === "التطبيقات") {
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

  if (product.category !== "الألعاب") return null;

  // Game artwork fallbacks for supplier products that arrive without an image.
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
};

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
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StoreProduct | null>(null);
  const [targetId, setTargetId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [lightMode, setLightMode] = useState(false);
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
          (!subcategory || p.subcategory === subcategory) &&
          p.name.toLowerCase().includes(query.toLowerCase())
      ),
    [products, active, subcategory, query]
  );

  const selectCategory = (
    value: StoreProduct["category"]
  ) => {
    setActive(value);
    setSubcategory("");
  };

  const hasQuantity = (p: StoreProduct) =>
    Boolean(Array.isArray(p.quantityValues) && p.quantityValues.length) ||
    Boolean(p.quantityValues && !Array.isArray(p.quantityValues));

  const computedTotal = selected
    ? (() => {
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
      Array.isArray(product.quantityValues) && product.quantityValues.length
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

    const q = hasQuantity(selected)
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
    {category:"التطبيقات",icon:<Package/>,title:"شحن تطبيقات",hint:"رصيد وعملات للتطبيقات"},
    {category:"الخدمات والاتصالات",icon:<Wifi/>,title:"خدمات MTN وسيريتل",hint:"رصيد وباقات وخدمات"},
    {category:"البطاقات الرقمية",icon:<CreditCard/>,title:"بطاقات رقمية",hint:"هدايا واشتراكات"},
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
              <span className="legacy-kicker">
                DIRECT TOPUP / الشحن المباشر
              </span>

              <h2>قسم {active}</h2>
            </div>

            <div className="legacy-search">
              <Search size={18} />

              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث داخل هذا القسم..."
              />
            </div>
          </div>

          <div className="subcategory-row">
            <button
              className={!subcategory ? "selected" : ""}
              onClick={() => setSubcategory("")}
            >
              كل المنتجات
            </button>

            {subcategories.map((s) => (
              <button
                key={s}
                className={
                  subcategory === s ? "selected" : ""
                }
                onClick={() => setSubcategory(s)}
              >
                {supplierCategoryOverrides.find(item => item.displayName === s)?.imageUrl ? (
                  <img className="subcategory-image" src={supplierCategoryOverrides.find(item => item.displayName === s)?.imageUrl || ""} alt="" />
                ) : active === "الألعاب" ? (
                  <Gamepad2 size={14} />
                ) : (
                  <Package size={14} />
                )}
                {s}
              </button>
            ))}
          </div>

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

                  {!p.imageUrl && <div className="legacy-product-icon">
                    {p.icon === "game" ? <Gamepad2 size={42} /> : p.icon === "app" ? <Package size={42} /> : <Smartphone size={42} />}
                  </div>}
                  {(p.imageUrl || fallbackImageFor(p)) && (
                    <img
                      src={p.imageUrl || fallbackImageFor(p) || ""}
                      alt={p.name}
                      loading="lazy"
                      onError={(event) => { event.currentTarget.style.display = "none"; }}
                    />
                  )}
                </div>

                <div className="legacy-card-info">
                  <span>{p.subcategory}</span>
                  <h3>{p.name}</h3>
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

            {hasQuantity(selected) && (
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

