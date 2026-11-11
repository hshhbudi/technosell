
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronLeft,
  ClipboardList,
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
  WalletCards,
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
  _product: Pick<StoreProduct, "name" | "subcategory" | "category">
) => null;

export default function Home() {
  const catalogQuery = trpc.products.list.useQuery();

  const supplierQuery = trpc.supplier.catalog.useQuery(undefined, {
    staleTime: 60_000,
  });
  const supplierCategoryOverridesQuery = trpc.supplier.publicCategories.useQuery(undefined, { staleTime: 60_000 });

  const customerQuery = trpc.customer.me.useQuery();

  const [active, setActive] =
    useState<StoreProduct["category"]>("التطبيقات");

  const [subcategory, setSubcategory] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StoreProduct | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [lightMode, setLightMode] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const customerOrdersQuery = trpc.customer.orders.useQuery(undefined, {
    enabled: Boolean(customerQuery.data),
    refetchInterval: 20_000,
  });

  const shipmentHistory = trpc.customer.orders.useQuery(undefined, {
    enabled: Boolean(customerQuery.data && historyOpen),
    refetchInterval: 20_000,
  });

  const customerNotifications = (customerOrdersQuery.data ?? []).slice(0, 8);
  const customerNotificationCount = customerNotifications.filter((order) =>
    order.paymentStatus === "pending" ||
    order.executionStatus === "completed" ||
    order.executionStatus === "failed" ||
    order.paymentStatus === "rejected"
  ).length;
  const notificationText = (order: (typeof customerNotifications)[number]) => {
    if (order.paymentStatus === "rejected" || order.executionStatus === "failed") return "تعذر تنفيذ الطلب أو تم رفض الدفع";
    if (order.executionStatus === "completed") return "اكتمل طلبك بنجاح";
    if (order.paymentStatus === "confirmed") return "تم تأكيد الدفع والطلب قيد المعالجة";
    return "طلبك وصل وينتظر مراجعة الدفع";
  };

  const directTopup = trpc.customer.directTopup.useMutation({
    onSuccess: async () => {
      setSelected(null);
      setTargetId("");
      setQuantity("");

      await customerQuery.refetch();

      setToast(
        "تم إرسال طلب الشحن إلى Fast4Top؛ تابع حالته من السجل"
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

    description,
    imageUrl: p.imageUrl,

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

  // نعرض فقط المنتجات المعتمدة القادمة من مورد الشحن؛ لا نخلط معها الهواتف أو الإكسسوارات أو المنتجات اليدوية.
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
    p.category === "التطبيقات" &&
    (Boolean(p.quantity?.min) ||
      Boolean(
        p.requires?.some(
          (r) =>
            r.type === "quantity" ||
            r.type === "amount" ||
            r.name?.toLowerCase().includes("qty") ||
            r.name?.toLowerCase().includes("amount") ||
            r.question?.includes("كمية") ||
            r.question?.includes("عدد")
        )
      ));

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
      product.category === "التطبيقات"
        ? product.quantity?.min || ""
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
  // العروض تعرض منتجات المورد فقط
  const offers = products
    .filter((p) => p.supplierDbId && (p.tag || p.name.includes("عرض")))
    .concat(products.filter((p) => p.supplierDbId && !(p.tag || p.name.includes("عرض"))))
    .filter((p, index, all) => all.findIndex((item) => item.id === p.id) === index)
    .slice(0, 6);

  return (
    <div
      className={`legacy-store ${lightMode ? "theme-light" : ""}`}
      dir="rtl"
    >
      <aside className="raseed-side-rail" aria-label="اختصارات الحساب">
        <button className="raseed-rail-balance" onClick={() => setAuthOpen(true)} title="رصيد الحساب"><WalletCards size={19}/><span>{customerQuery.data ? money(customerQuery.data.balanceCents) : "حسابي"}</span></button>
        <button onClick={() => customerQuery.data ? setHistoryOpen(true) : setAuthOpen(true)} title="طلباتي"><ClipboardList size={19}/><small>طلباتي</small></button>
        <button onClick={() => {setNoticeOpen(v=>!v);setSettingsOpen(false);}} title="الإشعارات"><Bell size={19}/><small>الإشعارات</small>{customerNotificationCount>0&&<i>{customerNotificationCount}</i>}</button>
        <button onClick={() => setSettingsOpen(v=>!v)} title="الإعدادات"><Settings size={20}/><small>الإعدادات</small></button>
        {settingsOpen && <div className="raseed-settings-popover"><strong>إعدادات رصيد</strong>
          <button onClick={() => {setAuthOpen(true);setSettingsOpen(false);}}><WalletCards size={16}/> الحساب والمحفظة</button>
          <button onClick={() => {setHistoryOpen(true);setSettingsOpen(false);}}><ClipboardList size={16}/> سجل الطلبات</button>
          <button onClick={() => {setLightMode(v=>!v);setSettingsOpen(false);}}>{lightMode?<Sun size={16}/>:<Moon size={16}/>} تغيير المظهر</button>
          <button onClick={() => {setNoticeOpen(true);setSettingsOpen(false);}}><Bell size={16}/> مركز الإشعارات</button>
        </div>}
      </aside>
      <header className="legacy-header">
        <Link href="/" className="legacy-logo">
          <span className="legacy-logo-mark">ر</span>

          <span>
            رصيد<strong> ✦</strong>
            <small>
              متجر الألعاب وتطبيقات البث المباشر
            </small>
          </span>
        </Link>

        <nav className={menuOpen ? "open" : ""}>
          <button onClick={() => { selectCategory("الألعاب"); document.getElementById("catalog")?.scrollIntoView({behavior:"smooth"}); setMenuOpen(false); }}>الألعاب</button>
          <button onClick={() => { selectCategory("التطبيقات"); document.getElementById("catalog")?.scrollIntoView({behavior:"smooth"}); setMenuOpen(false); }}>البث المباشر</button>
          <button onClick={() => { document.getElementById("offers")?.scrollIntoView({behavior:"smooth"}); setMenuOpen(false); }}>منتجات مميزة</button>
        </nav>

        <div className="legacy-actions">
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
            className="notice-button"
            onClick={() => setNoticeOpen((v) => !v)}
            aria-label="الإشعارات"
          >
            <Bell size={19} />
            {customerNotificationCount > 0 && <i>{customerNotificationCount}</i>}
          </button>

          <button
            className="history-button"
            onClick={() =>
              customerQuery.data
                ? setHistoryOpen(true)
                : setAuthOpen(true)
            }
            aria-label="السجل"
          >
            <ClipboardList size={19} />
          </button>

          <button
            onClick={() => setAuthOpen(true)}
            aria-label="الحساب"
          >
            <WalletCards size={20} />
            <span>
              {customerQuery.data
                ? money(customerQuery.data.balanceCents)
                : "حسابي"}
            </span>
          </button>

          <button
            className="legacy-menu"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="القائمة"
          >
            <Menu size={23} />
          </button>
        </div>

        {noticeOpen && (
          <div className="store-notices">
            <strong>إشعارات طلباتك</strong>
            {!customerQuery.data ? (
              <p>سجّل الدخول لمتابعة إشعارات طلباتك.</p>
            ) : customerOrdersQuery.isLoading ? (
              <p>جارٍ تحميل الإشعارات...</p>
            ) : customerNotifications.length ? (
              customerNotifications.map((order) => (
                <div className="store-notification-item" key={order.id}>
                  <b>{(() => { try { const items=JSON.parse(order.items) as Array<{name?:string;quantity?:number}>; return items.map(item => `${item.quantity && item.quantity > 1 ? `${item.quantity} × ` : ""}${item.name || "طلبك"}`).join("، ") || order.orderNumber; } catch { return order.orderNumber; } })()}</b>
                  <p>{notificationText(order)}</p>
                  <small>{new Date(order.createdAt).toLocaleString("ar-SY")}</small>
                </div>
              ))
            ) : (
              <p>لا توجد إشعارات جديدة. ستظهر حالة طلباتك هنا تلقائيًا.</p>
            )}
            <small>
              صاحب المتجر:{" "}
              <a href="tel:+994408440648">+994408440648</a>
            </small>
          </div>
        )}
      </header>

      <main>
        <section className="legacy-hero">
          <div className="legacy-hero-copy">
            <span className="legacy-kicker">
              <Sparkles size={14} /> رصيد • وجهتك للشحن الرقمي
            </span>

            <h1>
              عالم الألعاب
              <br />
              <strong>والبث المباشر</strong>
            </h1>

            <p>
              كل شحنات ألعابك وتطبيقات البث المباشر بمكان واحد. اختر خدمتك، أدخل بياناتك، وتابع طلبك لحظة بلحظة.
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

          <div className="legacy-hero-art">
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

        <section className="store-banner-wrap">
          
        </section>

        <section className="legacy-category-row">
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

        <section className="offers-panel" id="offers">
          <div>
            <span className="legacy-kicker">
              RASEED PICKS / اختيارات رصيد
            </span>

            <h2>عروض اليوم</h2>

            <p>
              اكتشف الخدمات الأكثر تميزًا من ألعابك وتطبيقات البث المباشر.
            </p>
          </div>

          <div className="offers-strip">
            {offers.map((p) => (
              <button
                key={`offer-${p.id}`}
                onClick={() => startTopup(p)}
              >
                <span>{p.tag || "مميز"}</span>
                <strong>{p.name}</strong>
                <small>{money(p.price)}</small>
              </button>
            ))}

            {offers.length === 0 && (
              <span>
                ستظهر العروض عند توفرها من المزوّد.
              </span>
            )}
          </div>
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

                  <div className="legacy-product-icon">
                    {p.icon === "game" ? <Gamepad2 size={42} /> : p.icon === "app" ? <Package size={42} /> : <Smartphone size={42} />}
                  </div>
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

                    <button
                      onClick={() => startTopup(p)}
                      disabled={!p.supplierDbId}
                    >
                      {p.supplierDbId ? "اشحن الآن" : "غير متاح للشحن"}
                    </button>
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
        </section>
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
                الكمية
                <input
                  type="number"
                  min={selected.quantity?.min || 1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="أدخل الكمية"
                />
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

      {historyOpen && (
        <div className="legacy-modal-backdrop">
          <div className="legacy-modal">
            <button
              className="legacy-modal-close"
              onClick={() => setHistoryOpen(false)}
              aria-label="إغلاق"
            >
              <X size={20} />
            </button>

            <h2>سجل طلباتي</h2>

            {shipmentHistory.isLoading ? (
              <p>جارٍ تحميل الطلبات...</p>
            ) : shipmentHistory.data?.length ? (
              shipmentHistory.data.map((order) => (
                <div className="legacy-history-item" key={order.id}>
                  <strong>{(() => { try { const items=JSON.parse(order.items) as Array<{name?:string;quantity?:number;targetId?:string}>; return items.map(item => `${item.quantity && item.quantity > 1 ? `${item.quantity} × ` : ""}${item.name || "طلب من المتجر"}`).join("، ") || order.orderNumber; } catch { return order.orderNumber; } })()}</strong>
                  <span>{order.executionStatus==="completed"?"مكتمل":order.executionStatus==="failed"?"فشل":order.executionStatus==="manual_processing"?"قيد المعالجة اليدوية":order.paymentStatus==="confirmed"?"قيد التنفيذ":"بانتظار تأكيد الدفع"}</span>
                  <small>{order.orderNumber} · {money(order.total)}</small>
                  <small>{new Date(order.createdAt).toLocaleString("ar-SY")}</small>
                </div>
              ))
            ) : (
              <p>لا توجد طلبات حتى الآن.</p>
            )}
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

