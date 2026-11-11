
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
  category.includes("ألعاب") ||
  /(pubg|ببجي|free\s*fire|فري\s*فاير|jawaker|جواكر)/i.test(
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
) => {
  const key = `${product.name} ${product.subcategory}`.toLowerCase();

  if (/pubg|ببجي/.test(key))
    return "/manus-storage/async-images/a9Pzhfk5LY7hLwr9h95SIk/image-1.webp";

  if (/free\s*fire|فري\s*فاير/.test(key))
    return "/manus-storage/async-images/a9Pzhfk5LY7hLwr9h95SIk/image-2.webp";

  if (/jawaker|جواكر/.test(key))
    return "/manus-storage/async-images/a9Pzhfk5LY7hLwr9h95SIk/image-3.webp";

  if (/tiktok|تيك/.test(key))
    return "/manus-storage/async-images/a9Pzhfk5LY7hLwr9h95SIk/image-4.webp";

  if (/mico/.test(key))
    return "/manus-storage/async-images/a9Pzhfk5LY7hLwr9h95SIk/image-5.webp";

  if (/soulchill|soul chill/.test(key))
    return "/manus-storage/async-images/dC7hOVU80fiYkfMtnZv0ow/image-1.webp";

  return null;
};

export default function Home() {
  const catalogQuery = trpc.products.list.useQuery();

  const supplierQuery = trpc.supplier.catalog.useQuery(undefined, {
    staleTime: 60_000,
  });

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

  const shipmentHistory = trpc.customer.orders.useQuery(undefined, {
    enabled: Boolean(customerQuery.data && historyOpen),
    refetchInterval: 20_000,
  });

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

    category: (
      isGameProduct(category, p.name, subcategory)
        ? "الألعاب"
        : category || "المنتجات"
    ) as StoreProduct["category"],

    subcategory: isFreeFireProduct(p.name, subcategory)
      ? freeFireSection(p.name, subcategory, description)
      : /pubg|ببجي/i.test(`${p.name} ${subcategory}`)
        ? "PUBG"
        : subcategory,

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

    quantity: p.quantity,
    requires: p.requires,
  };
});

  // إخفاء منتجات الأكواد المحظورة من قسم الشحن المباشر
  const supplierOnlyIdProducts = supplierProducts.filter(
  (product) =>
    !isBlockedCodeProduct(
      product.name,
      product.subcategory ?? "",
      product.description ?? ""
    )
);

  // المنتجات اليدوية الموجودة في المتجر
  const localProducts: StoreProduct[] = (
    catalogQuery.data ?? []
  ).map((p) => ({
    id: p.id,
    externalId: String(p.id),

    // المنتجات اليدوية لا تملك معرّف شحن لدى المورد
    supplierDbId: undefined,

    name: p.name,

    category: (
      [
        "التطبيقات",
        "الألعاب",
        "المنتجات",
        "الهواتف",
        "الإكسسوارات",
      ].includes(p.category)
        ? p.category
        : "المنتجات"
    ) as StoreProduct["category"],

    subcategory: p.category,
    delivery: "id",

    price: p.priceUsdCents ?? p.price,
    stock: p.stock,

    tag: p.tag ?? undefined,
    description: p.description ?? "منتج من Techno Sell",
    imageUrl: p.imageUrl,

    accent:
      p.category === "الألعاب"
        ? "blue"
        : p.category === "التطبيقات"
          ? "pink"
          : p.category === "الهواتف"
            ? "navy"
            : "gold",

    icon:
      p.category === "الألعاب"
        ? "game"
        : p.category === "التطبيقات"
          ? "app"
          : "product",
  }));

  // دمج منتجات المورد مع المنتجات اليدوية دون تكرار الاسم
  const remoteAndLocalProducts = [
    ...supplierOnlyIdProducts,
    ...localProducts.filter(
      (local) =>
        !supplierProducts.some(
          (remote) => remote.name === local.name
        )
    ),
  ];

  // لا نضيف منتجات تجريبية أو أسعار وهمية
  const products: StoreProduct[] = remoteAndLocalProducts;

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
    .filter(
      (p) =>
        p.supplierDbId &&
        (p.tag || p.name.includes("عرض"))
    )
    .slice(0, 6);

  return (
    <div
      className={`legacy-store ${lightMode ? "theme-light" : ""}`}
      dir="rtl"
    >
      <div className="legacy-topline">
        <span>
          <Sparkles size={14} /> شحن مباشر وآمن
        </span>

        <b>Techno Sell</b>

        <span>
          {customerQuery.data
            ? `رصيدك ${money(customerQuery.data.balanceCents)}`
            : "تسجيل الدخول للشحن"}
        </span>
      </div>

      <header className="legacy-header">
        <Link href="/" className="legacy-logo">
          <span className="legacy-logo-mark">TS</span>

          <span>
            Techno<strong>Sell</strong>
            <small>
              متجر الشحن والهواتف والإكسسوارات
            </small>
          </span>
        </Link>

        <nav className={menuOpen ? "open" : ""}>
          <button
            onClick={() => {
              selectCategory("التطبيقات");
              setMenuOpen(false);
            }}
          >
            التطبيقات
          </button>

          <button
            onClick={() => {
              selectCategory("الألعاب");
              setMenuOpen(false);
            }}
          >
            الألعاب
          </button>

          <button
            onClick={() => {
              selectCategory("الهواتف");
              setMenuOpen(false);
            }}
          >
            الهواتف
          </button>

          <button
            onClick={() => {
              selectCategory("الإكسسوارات");
              setMenuOpen(false);
            }}
          >
            الإكسسوارات
          </button>

          <button
            onClick={() => {
              document
                .getElementById("offers")
                ?.scrollIntoView({ behavior: "smooth" });

              setMenuOpen(false);
            }}
          >
            العروض
          </button>
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
            <i>2</i>
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
            <strong>إشعارات المتجر</strong>
            <p>العروض الجديدة متاحة الآن.</p>
            <p>الشحن يتم من رصيدك مباشرة.</p>
            <small>
              صاحب المتجر:{" "}
              <a href="tel:+963968057214">
                +963968057214
              </a>
            </small>
          </div>
        )}
      </header>

      <main>
        <section className="legacy-hero">
          <div className="legacy-hero-copy">
            <span className="legacy-kicker">
              TECHNO SELL / DIRECT TOPUP
            </span>

            <h1>
              اشحن حسابك
              <br />
              <strong>بضغطة واحدة</strong>
            </h1>

            <p>
              اختر اللعبة أو التطبيق، اكتب الـID والكمية،
              وسيصل طلبك مباشرة إلى نظام الشحن.
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
                ابدأ الشحن <ChevronLeft size={17} />
              </button>

              <span>
                <Zap size={16} /> لا توجد سلة للمنتجات الرقمية
              </span>
            </div>
          </div>

          <div className="legacy-hero-art">
            <div className="hero-glow" />

            <div className="hero-device">
              <div className="device-brand">TS / DIRECT</div>

              <div className="hero-icons">
                <Gamepad2 />
                <span>+</span>
                <Package />
              </div>

              <strong>شحنك مباشر</strong>
              <small>ID + كمية</small>
            </div>

            <div className="hero-sticker">
              آمن
              <br />
              <b>100%</b>
            </div>
          </div>
        </section>

        <section className="store-banner-wrap">
          <img src="/store-banner.jpg" alt="Techno Sell" />
        </section>

        <section className="legacy-category-row">
          <button
            className={
              active === "التطبيقات" ? "selected" : ""
            }
            onClick={() => selectCategory("التطبيقات")}
          >
            <Package /> التطبيقات
          </button>

          <button
            className={
              active === "الألعاب" ? "selected" : ""
            }
            onClick={() => selectCategory("الألعاب")}
          >
            <Gamepad2 /> الألعاب
          </button>

          <button
            className={
              active === "الهواتف" ? "selected" : ""
            }
            onClick={() => selectCategory("الهواتف")}
          >
            <Smartphone /> الهواتف
          </button>

          <button
            className={
              active === "الإكسسوارات" ? "selected" : ""
            }
            onClick={() => selectCategory("الإكسسوارات")}
          >
            <Headphones /> الإكسسوارات
          </button>

          <button
            className={
              active === "المنتجات" ? "selected" : ""
            }
            onClick={() => selectCategory("المنتجات")}
          >
            <Package /> المنتجات
          </button>
        </section>

        <section className="offers-panel" id="offers">
          <div>
            <span className="legacy-kicker">
              LIMITED OFFERS / عروض مختارة
            </span>

            <h2>عروض اليوم</h2>

            <p>
              اختيارات مميزة بأسعار واضحة وشحن مباشر.
            </p>
          </div>

          <div className="offers-strip">
            {offers.map((p) => (
              <button
                key={`offer-${p.id}`}
                onClick={() => startTopup(p)}
              >
                <span>{p.tag || "عرض"}</span>
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
                {active === "الألعاب" ? (
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

                  {p.imageUrl || fallbackImageFor(p) ? (
                    <img
                      src={p.imageUrl || fallbackImageFor(p) || ""}
                      alt={p.name}
                    />
                  ) : (
                    <div className="legacy-product-icon">
                      {p.icon === "game" ? (
                        <Gamepad2 size={42} />
                      ) : p.icon === "app" ? (
                        <Package size={42} />
                      ) : (
                        <Smartphone size={42} />
                      )}
                    </div>
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
                  <strong>{order.orderNumber}</strong>
                  <span>{order.executionStatus}</span>
                  <small>{money(order.total)}</small>
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
        <strong>Techno Sell</strong>
        <span>متجرك للشحن والهواتف والإكسسوارات</span>
        <small>© {new Date().getFullYear()} Techno Sell</small>
      </footer>
    </div>
  );
}

