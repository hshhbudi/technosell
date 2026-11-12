
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  Gamepad2,
  Headphones,
  Home as HomeIcon,
  Menu,
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
    | "الإكسسوارات";
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

    category: (p.storeSection || (isGameProduct(category, p.name, subcategory) ? "الألعاب" : "التطبيقات")) as StoreProduct["category"],

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

  // إخفاء منتجات الأكواد المحظورة من قسم الشحن المباشر
  // المتجر يعرض من المورد قسم الألعاب وتطبيقات البث المباشر فقط.
  const supplierOnlyIdProducts = supplierProducts.filter(
    (product) =>
      (product.category === "الألعاب" || product.category === "التطبيقات") &&
      !isBlockedCodeProduct(
        product.name,
        product.subcategory ?? "",
        product.description ?? ""
      )
  );

  // منتجات المورد الرقمية مع المنتجات اليدوية المنشورة من لوحة الإدارة.
  const manualProducts: StoreProduct[] = (manualProductsQuery.data ?? []).map((p) => ({
    id: p.id, externalId: "manual-" + p.id, name: p.name,
    category: (["الهواتف", "الإكسسوارات", "المنتجات"].includes(p.category) ? p.category : "المنتجات") as StoreProduct["category"],
    subcategory: p.category, delivery: "id",
    price: Number(p.priceUsdCents ?? p.price ?? 0), stock: Number(p.stock ?? 0),
    tag: p.tag ?? undefined, description: p.description ?? "", imageUrl: p.imageUrl ?? null,
    accent: "gold", icon: "product",
  }));
  // The public store shows only the automatically synchronized Fast4Top Games and Apps catalog.
  const products: StoreProduct[] = supplierOnlyIdProducts;

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
          <span className="legacy-logo-mark">✦</span>

          <span>
            رصيد<strong> RASEED</strong>
            <small>متجر رقمي وتقني متكامل</small>
          </span>
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
          <button className="raseed-balance-button" onClick={() => customerQuery.data ? showToast("رصيدك الحالي: " + money(customerQuery.data.balanceCents ?? 0)) : setAuthOpen(true)} aria-label="رصيدي">
            <span>رصيدي</span><strong>{customerQuery.data ? money(customerQuery.data.balanceCents ?? 0) : "دخول الحساب"}</strong>
          </button>
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
              شحن ألعابك وتطبيقاتك بسهولة
              <br />
              <strong>ألعاب • تطبيقات</strong>
            </h1>

            <p>
              جميع الألعاب والتطبيقات الرقمية في مكان واحد، مع تحديث تلقائي للمنتجات.
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
          <button
            className={active === "الألعاب" ? "selected" : ""}
            onClick={() => selectCategory("الألعاب")}
          >
            <Gamepad2 /> الألعاب
          </button>

          <button
            className={active === "التطبيقات" ? "selected" : ""}
            onClick={() => selectCategory("التطبيقات")}
          >
            <Package /> تطبيقات البث المباشر
          </button>

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
        <div className="raseed-wallet-card"><span>رصيد حسابك</span><strong>{customerQuery.data ? money(customerQuery.data.balanceCents ?? 0) : "سجّل دخولك"}</strong><button onClick={() => customerQuery.data ? showToast("رصيدك الحالي: " + money(customerQuery.data.balanceCents ?? 0)) : setAuthOpen(true)}>＋ شحن الرصيد</button></div>
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

      <footer className="legacy-footer">
        <strong>رصيد</strong>
        <span>كل احتياجاتك الرقمية والتقنية في مكان واحد</span>
        <small>تواصل: <a href="tel:+994408440648">+994408440648</a> · © {new Date().getFullYear()} رصيد</small>
      </footer>
    </div>
  );
}

