import { useState, type ReactNode } from "react";
import { ArrowRight, BadgePercent, Bell, Box, CheckCircle2, Clock3, CreditCard, Gamepad2, LayoutDashboard, Package, Plus, RefreshCw, Search, ShoppingBag, Smartphone, Trash2, TrendingUp, Users, WalletCards, X } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";

const money=(cents:number)=>`$ ${(cents/100).toFixed(2)}`;
const isSyriaTopupOrder=(items:string)=>items.includes('"category":"شحن ألعاب"')||items.includes('"category":"شحن تطبيقات"');
const isWalletTopupOrder=(items:string)=>items.includes('"category":"تعبئة الرصيد"');
const isGameProduct=(category:string,name="",subcategory="")=>/(ألعاب|العاب|game|games|gaming)/i.test(category)||/(pubg|ببجي|free\s*fire|فري\s*فاير|jawaker|جواكر|call\s*of\s*duty|mobile\s*legends|mlbb|roblox|minecraft|fortnite|steam|playstation|xbox|valorant|genshin)/i.test(`${name} ${subcategory}`);
const isLiveAppProduct=(category:string,name="",subcategory="")=>/(haya|kwai|likee|bigo|tiktok|poppo|mico|chamet|yalla\s*live|buzzcast|liveme|nonolive|uplive|live\s*stream|تطبيق|app|application|social|بث\s*مباشر)/i.test(`${category} ${name} ${subcategory}`);

type FormState={name:string;category:string;description:string;priceUsd:string;oldPrice:string;stock:string;isDigital:boolean;tag:string;imageData:string};
const emptyForm:FormState={name:"",category:"التطبيقات",description:"",priceUsd:"",oldPrice:"",stock:"0",isDigital:true,tag:"",imageData:""};
const adminSections=[
  {id:"dashboard",label:"الرئيسية",hint:"نظرة عامة",icon:<LayoutDashboard size={17}/>},
  {id:"games",label:"الألعاب",hint:"كتالوج الألعاب",icon:<Gamepad2 size={17}/>},
  {id:"apps",label:"التطبيقات",hint:"كتالوج التطبيقات",icon:<Smartphone size={17}/>},
  {id:"products",label:"المنتجات",hint:"الهواتف والإكسسوارات",icon:<ShoppingBag size={17}/>},
  {id:"offers",label:"العروضات",hint:"الأسعار المميزة",icon:<BadgePercent size={17}/>},
  {id:"payments",label:"الدفع",hint:"طلبات العملاء",icon:<CreditCard size={17}/>},
  {id:"balance",label:"الرصيد",hint:"تعبئة العملاء",icon:<WalletCards size={17}/>},
] as const;

function compressProductImage(file: File, onDone: (data: string) => void, onError: (message: string) => void) {
  if (!file.type.startsWith("image/")) { onError("اختر ملف صورة صالحًا"); return; }
  const reader = new FileReader();
  reader.onerror = () => onError("تعذر قراءة الصورة من الهاتف");
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => onError("تعذر معالجة الصورة، جرّب صورة أخرى");
    image.onload = () => {
      const maxSide = 1000;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) { onError("تعذر تجهيز الصورة"); return; }
      context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let data = canvas.toDataURL("image/jpeg", 0.68);
      if (data.length > 1_400_000) data = canvas.toDataURL("image/jpeg", 0.5);
      if (data.length > 1_800_000) { onError("الصورة ما زالت كبيرة؛ اختر صورة أصغر أو التقطها بدقة أقل"); return; }
      onDone(data);
    };
    image.src = String(reader.result);
  };
  reader.readAsDataURL(file);
}

export default function Admin() {
  const auth = useAuth();
  const localLogin = trpc.adminLocal.login.useMutation({ onSuccess: () => window.location.reload() });
  const access = trpc.admin.access.useQuery(undefined, { enabled: Boolean(auth.user?.role === "admin"), retry: false });
  const claim = trpc.admin.claim.useMutation({ onSuccess: (result) => { if (result.claimed) window.location.reload(); } });
  const productsQuery = trpc.admin.products.list.useQuery(undefined, { enabled: Boolean(auth.user?.role === "admin"), retry: false });
  const supplierAdminCatalogQuery = trpc.supplier.adminCatalog.useQuery(undefined, { enabled: Boolean(auth.user?.role === "admin"), staleTime: 30_000, retry: false });
  const categoryOverridesQuery = trpc.supplier.categoryOverrides.useQuery(undefined, { enabled: Boolean(auth.user?.role === "admin"), staleTime: 30_000, retry: false });
  const supplierProfileQuery = trpc.supplier.profile.useQuery(undefined, { enabled: Boolean(auth.user?.role === "admin"), refetchInterval: 60_000, retry: false });
  const ordersQuery = trpc.admin.orders.list.useQuery(undefined, { enabled: Boolean(auth.user?.role === "admin"), retry: false, refetchInterval: 15_000 });
  const updateOrder = trpc.admin.orders.updateStatus.useMutation({ onSuccess: ()=>ordersQuery.refetch() });
  const utils = trpc.useUtils();
  const syncSupplier = trpc.supplier.sync.useMutation({
    onSuccess: async (result) => {
      setNotice(`اكتملت مزامنة Fast4Top: ${result.inserted ?? 0} جديد، ${result.updated ?? 0} محدّث`);
      await Promise.all([utils.supplier.adminCatalog.invalidate(), utils.supplier.catalog.invalidate()]);
    },
    onError: (err) => setError(err.message || "تعذرت مزامنة كتالوج Fast4Top"),
  });
  const setSupplierStoreSection = trpc.supplier.setStoreSection.useMutation({
    onSuccess: async () => {
      setNotice("تم نقل المنتج إلى القسم المحدد");
      await Promise.all([utils.supplier.adminCatalog.invalidate(), utils.supplier.catalog.invalidate()]);
    },
    onError: (err) => setError(err.message || "تعذر تغيير قسم المنتج"),
  });
  const setSupplierImage = trpc.supplier.setImage.useMutation({
    onSuccess: async () => {
      setNotice("تم حفظ صورة المنتج");
      await Promise.all([utils.supplier.adminCatalog.invalidate(), utils.supplier.catalog.invalidate()]);
    },
    onError: (err) => setError(err.message || "تعذر حفظ صورة المنتج"),
  });
  const setSupplierEnabled = trpc.supplier.setEnabled.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.supplier.adminCatalog.invalidate(), utils.supplier.catalog.invalidate()]);
    },
    onError: (err) => setError(err.message || "تعذر تحديث حالة المنتج"),
  });
  const setSupplierSelection = trpc.supplier.setSelection.useMutation({
    onSuccess: async (_result, variables) => {
      setNotice(variables.selected ? "تمت إضافة المنتج إلى قائمة المنتجات المختارة" : "تمت إزالة المنتج من قائمة المنتجات المختارة");
      await Promise.all([utils.supplier.adminCatalog.invalidate(), utils.supplier.catalog.invalidate()]);
    },
    onError: (err) => setError(err.message || "تعذر تحديث المنتجات المختارة"),
  });
  const saveSupplierCategory = trpc.supplier.saveCategory.useMutation({
    onSuccess: async () => {
      setCategoryEdit(null);
      setNotice("تم حفظ اسم وصورة القسم");
      await Promise.all([utils.supplier.categoryOverrides.invalidate(), utils.supplier.catalog.invalidate()]);
    },
    onError: (err) => setError(err.message || "تعذر حفظ إعدادات القسم"),
  });
  const setSupplierCategoryEnabled = trpc.supplier.setCategoryEnabled.useMutation({
    onSuccess: async (_result, variables) => {
      setNotice(variables.enabled ? `تم تفعيل قسم ${variables.category} بالكامل` : `تم إخفاء قسم ${variables.category} من المتجر`);
      await Promise.all([utils.supplier.adminCatalog.invalidate(), utils.supplier.catalog.invalidate()]);
    },
    onError: (err) => setError(err.message || "تعذر تحديث القسم"),
  });
  const createProduct = trpc.admin.products.create.useMutation({ onSuccess: async()=>{ setForm(emptyForm); setFormOpen(false); setError(""); setNotice("تمت إضافة المنتج وظهر الآن في المتجر"); setTimeout(()=>setNotice(""),3500); await utils.admin.products.list.invalidate(); }, onError: (err)=>setError(err.message || "تعذر حفظ المنتج، حاول مرة أخرى") });

const updateProduct = trpc.admin.products.update.useMutation({ onSuccess: async()=>{ setForm(emptyForm); setFormOpen(false); setError(""); await utils.admin.products.list.invalidate(); }, onError: (err)=>setError(err.message || "تعذر تعديل المنتج، حاول مرة أخرى") });

const removeProduct = trpc.admin.products.delete.useMutation({ onSuccess: async()=>{ setNotice("تم حذف المنتج من المتجر"); setTimeout(()=>setNotice(""),3000); await utils.admin.products.list.invalidate(); } });
  const transfer = trpc.admin.transferOwnership.useMutation({ onSuccess: () => { setTransferOpen(false); setTransferEmail(""); auth.logout(); } });
  const addAdmin = trpc.admin.addAdmin.useMutation({ onSuccess: () => { setTransferOpen(false); setTransferEmail(""); setError("تمت إضافة المدير المشارك بنجاح"); }, onError: e=>setError(e.message) });
  const [formOpen,setFormOpen]=useState(false); const [form,setForm]=useState<FormState>(emptyForm); const [editingId,setEditingId]=useState<number|null>(null); const [error,setError]=useState(""); const [notice,setNotice]=useState(""); const [activeSection,setActiveSection]=useState<"dashboard"|"games"|"apps"|"products"|"offers"|"payments"|"balance">("dashboard"); const [productSort,setProductSort]=useState<"default"|"name-asc"|"name-desc"|"price-asc"|"price-desc">("default"); const [transferOpen,setTransferOpen]=useState(false); const [transferEmail,setTransferEmail]=useState(""); const [localEmail,setLocalEmail]=useState(""); const [localPassword,setLocalPassword]=useState(""); const [orderFilter,setOrderFilter]=useState<"all"|"pending"|"processing"|"completed"|"failed">("all"); const [orderSearch,setOrderSearch]=useState(""); const [productSearch,setProductSearch]=useState(""); const [notificationsOpen,setNotificationsOpen]=useState(false); const [supplierView,setSupplierView]=useState<"all"|"selected"|"unselected">("all"); const [supplierSyncSection,setSupplierSyncSection]=useState<"all"|"الألعاب"|"التطبيقات"|"الخدمات والاتصالات"|"البطاقات الرقمية"|"خدمات رقمية">("all"); const [categoryEdit,setCategoryEdit]=useState<{sourceName:string;displayName:string;imageUrl:string}|null>(null);
  if (auth.loading) return <div className="admin-gate"><div className="gate-card"><span className="brand-mark">TS</span><h1>جاري التحقق من صلاحيات الدخول</h1><p>هذه الصفحة مخصصة لصاحب المتجر وفريق الإدارة فقط.</p></div></div>;
  if (!auth.user) return <div className="admin-gate"><form className="gate-card" onSubmit={e=>{e.preventDefault();localLogin.mutate({email:localEmail,password:localPassword})}}><span className="brand-mark">TS</span><h1>دخول صاحب المتجر</h1><p>دخول مستقل عن Google وManus. استخدم بيانات المالك التي تم إعدادها بأمان.</p><label className="admin-login-field">البريد الإلكتروني<input required type="email" value={localEmail} onChange={e=>setLocalEmail(e.target.value)} placeholder="owner@example.com"/></label><label className="admin-login-field">كلمة المرور<input required type="password" value={localPassword} onChange={e=>setLocalPassword(e.target.value)} placeholder="كلمة المرور"/></label>{localLogin.error&&<div className="form-error">{localLogin.error.message}</div>}<button className="primary-btn full" disabled={localLogin.isPending}>{localLogin.isPending?"جارٍ تسجيل الدخول...":"تسجيل الدخول كمالك"} <ArrowRight size={17}/></button></form></div>;
  if (auth.user.role !== "admin" || access.isError) return <div className="admin-gate"><div className="gate-card"><span className="brand-mark">TS</span><h1>تجهيز حساب المالك</h1><p>إذا كنت تستخدم الحساب المنفصل الذي تريد تخصيصه للمتجر، اضغط الزر مرة واحدة لاعتماده كمالك. لا تستخدم حساب الزبائن أو حساب MySon.</p><button className="primary-btn" onClick={()=>claim.mutate()} disabled={claim.isPending}>{claim.isPending?"جارٍ اعتماد الحساب...":"اعتماد هذا الحساب كمالك"} <ArrowRight size={17}/></button><Link href="/" className="back-link gate-back">العودة إلى المتجر</Link></div></div>;
  const products=productsQuery.data??[];
  const supplierProducts=(supplierAdminCatalogQuery.data?.products??[]);
  const supplierCategories = Array.from(new Set(supplierProducts.filter(p=>supplierSyncSection==="all"||(p.storeSection||"خدمات رقمية")===supplierSyncSection).map(p => p.subcategory).filter((name): name is string => Boolean(name)))).sort((a,b)=>a.localeCompare(b,"ar"));
  const productTerm = productSearch.trim().toLocaleLowerCase("ar");
  const matchesProductSearch = (name:string, category:string, extra="") => !productTerm || `${name} ${category} ${extra}`.toLocaleLowerCase("ar").includes(productTerm);
  const sortedSupplierProducts = supplierProducts.filter(p=>(supplierSyncSection==="all" || (p.storeSection || "خدمات رقمية")===supplierSyncSection) && (supplierView==="all" || (supplierView==="selected" ? p.ownerSelected : !p.ownerSelected)) && matchesProductSearch(p.name,p.category ?? "",p.subcategory ?? "")).slice().sort((left,right)=>{if(productSort==="name-asc")return left.name.localeCompare(right.name,"ar");if(productSort==="name-desc")return right.name.localeCompare(left.name,"ar");if(productSort==="price-asc")return left.sellingPriceCents-right.sellingPriceCents;if(productSort==="price-desc")return right.sellingPriceCents-left.sellingPriceCents;return 0;});
  const categoryOverrides = categoryOverridesQuery.data ?? [];
  const orders=ordersQuery.data??[];
  const visibleProducts=products.filter(p=>matchesProductSearch(p.name,p.category,p.description ?? "")).filter(p=>activeSection==="games"?isGameProduct(p.category,p.name,""):activeSection==="apps"?p.category.includes("تطبيقات"):activeSection==="offers"?Boolean(p.tag||p.oldPrice):activeSection==="products"?["الهواتف","الإكسسوارات","المنتجات"].includes(p.category):true).slice().sort((left,right)=>{if(productSort==="name-asc")return left.name.localeCompare(right.name,"ar");if(productSort==="name-desc")return right.name.localeCompare(left.name,"ar");const lp=Number(left.priceUsdCents??left.price??0),rp=Number(right.priceUsdCents??right.price??0);if(productSort==="price-asc")return lp-rp;if(productSort==="price-desc")return rp-lp;return 0;});
  const confirmedOrders=orders.filter(o=>o.paymentStatus==="confirmed");
  const totalSales=confirmedOrders.reduce((sum,o)=>sum+o.total,0);
  const activeGames=products.filter(p=>p.isActive&&isGameProduct(p.category,p.name,"")).length;
  const uniqueCustomers=new Set(orders.map(o=>o.customerId||o.customerName)).size;
  const salesDays=Array.from({length:7},(_,offset)=>{const date=new Date();date.setHours(0,0,0,0);date.setDate(date.getDate()-(6-offset));const key=date.toISOString().slice(0,10);return {key,label:date.toLocaleDateString("ar-SY",{weekday:"short"}),value:confirmedOrders.filter(o=>new Date(o.createdAt).toISOString().slice(0,10)===key).reduce((sum,o)=>sum+o.total,0)};});
  const maxSales=Math.max(...salesDays.map(day=>day.value),1);
  const visibleOrders=activeSection==="balance"?orders.filter(o=>isWalletTopupOrder(o.items)):activeSection==="payments"?orders.filter(o=>!isWalletTopupOrder(o.items)):orders;
  const filteredOrders=visibleOrders.filter(order=>{const status=order.executionStatus==="completed"?"completed":order.executionStatus==="failed"||order.paymentStatus==="rejected"?"failed":order.paymentStatus==="confirmed"?"processing":"pending";const matchesFilter=orderFilter==="all"||status===orderFilter;const term=orderSearch.trim().toLowerCase();const matchesSearch=!term||order.orderNumber.toLowerCase().includes(term)||order.customerName.toLowerCase().includes(term)||String(order.customerId||"").includes(term);return matchesFilter&&matchesSearch;});
  const openEdit=(p:(typeof products)[number])=>{setEditingId(p.id);setForm({name:p.name,category:p.category,description:p.description||"",priceUsd:((p.priceUsdCents??p.price)/100).toFixed(2),oldPrice:p.oldPrice?((p.oldPrice)/100).toFixed(2):"",stock:String(p.stock),isDigital:p.isDigital,tag:p.tag||"",imageData:""});setError("");setFormOpen(true)};
  const submit=(e:React.FormEvent)=>{e.preventDefault();setError("");if(!form.name.trim()||!form.priceUsd||Number(form.priceUsd)<0){setError("اكتب اسم المنتج وسعر الدولار بشكل صحيح");return}const payload={name:form.name.trim(),category:form.category,description:form.description.trim()||undefined,priceUsdCents:Math.round(Number(form.priceUsd)*100),oldPrice:form.oldPrice?Math.round(Number(form.oldPrice)*100):undefined,stock:Number(form.stock)||0,isDigital:form.isDigital,tag:form.tag.trim()||undefined,imageData:form.imageData||undefined};if(editingId) updateProduct.mutate({id:editingId,...payload}); else createProduct.mutate(payload)};
  return <div className="admin-shell">
      <header className="admin-topbar"><Link href="/" className="back-link"><ArrowRight size={18}/> العودة للمتجر</Link><div className="admin-brand"><span className="brand-mark">ر</span><span>لوحة رصيد</span></div><div className="admin-top-actions"><span className="admin-live-status"><i/> المتجر متصل</span><span className="admin-phone">اتصال: <a href="tel:+994408440648">+994408440648</a></span><button className="icon-btn" title="إشعارات المالك" aria-label="إشعارات المالك" onClick={()=>setNotificationsOpen(v=>!v)}><Bell size={18}/>{orders.filter(o=>o.paymentStatus==='pending').length>0&&<i>{orders.filter(o=>o.paymentStatus==='pending').length}</i>}</button>{notificationsOpen&&<div className="admin-notifications"><strong>إشعارات المالك</strong>{orders.filter(o=>o.paymentStatus==='pending').slice(0,8).map(order=><button key={order.id} onClick={()=>{setActiveSection(isWalletTopupOrder(order.items)?"balance":"payments");setNotificationsOpen(false)}}><b>{isWalletTopupOrder(order.items)?"طلب تعبئة رصيد جديد":"طلب دفع جديد"}</b><span>{order.customerName} · {order.orderNumber}</span><small>{new Date(order.createdAt).toLocaleString("ar-SY")}</small></button>)}{orders.filter(o=>o.paymentStatus==='pending').length===0&&<p>لا توجد طلبات بانتظار المراجعة.</p>}</div>}</div></header>
      <main className="admin-main" data-section={activeSection}>{notice&&<div className="admin-notice"><CheckCircle2 size={17}/>{notice}</div>}{error&&!formOpen&&!transferOpen&&<div className="form-error">{error}</div>}
      <div className="admin-heading"><div><span className="eyebrow admin-eyebrow">مركز العمليات · إدارة آمنة</span><h1>صاحب المتجر</h1><p>كل ما تحتاجه لإدارة المبيعات والشحن والمنتجات من مكان واحد.</p></div><div className="admin-heading-actions"><button className="secondary-btn" onClick={()=>{setError("");setTransferOpen(true)}}>إضافة مدير مشارك</button><button className="primary-btn" onClick={()=>setFormOpen(true)}><Plus size={17}/> إضافة منتج</button></div></div>
      <nav className="admin-section-tabs" aria-label="أقسام لوحة المالك">{adminSections.map(section=><button key={section.id} className={activeSection===section.id?"active":""} onClick={()=>setActiveSection(section.id)}><span className="admin-tab-icon">{section.icon}</span><span><b>{section.label}</b><small>{section.hint}</small></span></button>)}</nav>
      {activeSection==="dashboard"&&<section className="stats-grid"><Stat icon={<Box/>} label="إجمالي المبيعات" value={money(totalSales)} suffix="" delta="من الطلبات المؤكدة"/><Stat icon={<TrendingUp/>} label="ألعاب نشطة" value={String(activeGames)} suffix="لعبة" delta="متاحة في المتجر"/><Stat icon={<Clock3/>} label="طلبات جديدة" value={String(orders.filter(o=>o.paymentStatus==='pending').length)} suffix="طلب" delta="بانتظار المراجعة"/><Stat icon={<Users/>} label="عملاء نشطون" value={String(uniqueCustomers)} suffix="عميل" delta="حسب الطلبات"/><Stat icon={<CreditCard/>} label="رصيد Fast4Top" value={supplierProfileQuery.data?.balance?`$ ${Number(supplierProfileQuery.data.balance).toFixed(3)}`:"—"} suffix="" delta={supplierProfileQuery.data?.connected?"متصل ويُحدّث تلقائيًا":"تحقق من الاتصال"}/></section>}
      <section className="panel product-manager"><div className="panel-head admin-products-toolbar"><div><h2>منتجات المتجر</h2><span>رتّب المنتجات حسب الاسم أو السعر، ثم عدّلها أو احذفها</span></div><div className="admin-products-actions"><label className="admin-product-search"><Search size={16}/><input value={productSearch} onChange={e=>setProductSearch(e.target.value)} placeholder="ابحث عن منتج بالاسم أو القسم..." aria-label="بحث المنتجات"/></label><label className="admin-sort-control">فرز المنتجات<select value={productSort} onChange={e=>setProductSort(e.target.value as typeof productSort)}><option value="default">الترتيب الافتراضي</option><option value="name-asc">الاسم: أ إلى ي</option><option value="name-desc">الاسم: ي إلى أ</option><option value="price-asc">السعر: الأقل أولاً</option><option value="price-desc">السعر: الأعلى أولاً</option></select></label><button className="text-btn" onClick={()=>{setEditingId(null);setForm(emptyForm);setFormOpen(true)}}><Plus size={14}/> إضافة منتج</button></div></div>{visibleProducts.length===0?<div className="manager-empty"><Package size={34}/><h3>لم تضف أي منتج بعد</h3><p>ابدأ بإضافة أول تطبيق أو لعبة أو هاتف أو إكسسوار.</p><button className="primary-btn" onClick={()=>{setEditingId(null);setForm(emptyForm);setFormOpen(true)}}>إضافة أول منتج</button></div>:<div className="managed-products">{visibleProducts.map(p=><div className="managed-product" key={p.id}><div className="product-mini"><Box size={18}/></div><div className="managed-product-main"><strong>{p.name}</strong><span>{p.category} · منتج المتجر</span></div><div className="managed-price"><b>{money(p.priceUsdCents??p.price)}</b><small>المخزون: {p.stock}</small></div><button className="text-btn" title="تعديل المنتج" onClick={()=>openEdit(p)}>تعديل</button><button className="delete-btn" title="حذف المنتج" onClick={()=>{if(window.confirm(`حذف المنتج «${p.name}» من المتجر؟`)) removeProduct.mutate({id:p.id})}} disabled={removeProduct.isPending}><Trash2 size={15}/> حذف</button></div>)}</div>}</section>
        
<section className="panel supplier-manager">
  <div className="panel-head">
    <div>
      <h2>كتالوج Fast4Top المتصل</h2>
      <span>تتم مزامنة كتالوج Fast4Top بالكامل، مع تصنيف المنتجات حسب المصدر واختيار ما يظهر للزبائن</span>
    </div>
    <div className="admin-heading-actions">
      <span className="status-pill cyan">{supplierAdminCatalogQuery.isLoading ? "جاري التحميل" : `${supplierProducts.length} منتج · ${supplierCategories.length} قسم`}</span>
      <button className="secondary-btn" onClick={() => syncSupplier.mutate({section:supplierSyncSection})} disabled={syncSupplier.isPending}>
        <RefreshCw size={15}/> {syncSupplier.isPending ? "جارٍ التحديث..." : "مزامنة الآن"}
      </button>
    </div>
  </div>
  {supplierProducts.length === 0 ? (
    <div className="manager-note">
      <Clock3 size={17}/> تتم مزامنة الكتالوج تلقائيًا عند تشغيل المتجر. إذا لم يظهر شيء، تحقق من اتصال Fast4Top.
    </div>
  ) : (
    <>
      <div className="supplier-category-controls">
        <h3>أقسام Fast4Top — اختر ما تريد عرضه في المتجر</h3>
        <div className="supplier-category-list">
          {supplierCategories.map(category => {
            const categoryProducts = supplierProducts.filter(p => p.subcategory === category && (supplierSyncSection==="all"||(p.storeSection||"خدمات رقمية")===supplierSyncSection));
            const selectedCount = categoryProducts.filter(p => p.ownerSelected).length;
            const enabled = selectedCount > 0 && categoryProducts.filter(p => p.ownerSelected).every(p => p.approved && p.enabled);
            return (
              <div className="supplier-category-control supplier-category-custom" key={category}>
                <span className="supplier-category-preview">
                  {categoryOverrides.find(item => item.sourceName === category)?.imageUrl
                    ? <img src={categoryOverrides.find(item => item.sourceName === category)?.imageUrl || ""} alt={category}/>
                    : <span className="product-mini"><Box size={18}/></span>}
                  <span><strong>{categoryOverrides.find(item => item.sourceName === category)?.displayName || category}</strong><small>{selectedCount} مختار من {categoryProducts.length} منتج · المصدر: {category}</small></span>
                </span>
                <div className="admin-heading-actions">
                  <button className="text-btn" onClick={() => setCategoryEdit({sourceName:category,displayName:categoryOverrides.find(item => item.sourceName === category)?.displayName || category,imageUrl:categoryOverrides.find(item => item.sourceName === category)?.imageUrl || ""})}>تعديل الاسم والصورة</button>
                  <button className={enabled ? "secondary-btn" : "primary-btn"} onClick={() => setSupplierCategoryEnabled.mutate({category, enabled: !enabled})} disabled={setSupplierCategoryEnabled.isPending}>
                    {enabled ? "إيقاف عرض القسم" : "عرض المنتجات المختارة"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="supplier-sync-tabs" role="group" aria-label="تقسيم كتالوج الألعاب والتطبيقات وخدمات الشحن">
        {(["الألعاب","التطبيقات","all","الخدمات والاتصالات","البطاقات الرقمية","خدمات رقمية"] as const).map(section=><button key={section} className={supplierSyncSection===section?"primary-btn":"secondary-btn"} onClick={()=>{setSupplierSyncSection(section);setSupplierView("all");syncSupplier.mutate({section});}}>
          {section==="الألعاب"?"الألعاب + خدمات شحنها":section==="التطبيقات"?"التطبيقات + خدمات شحنها":section==="all"?"كل كتالوج Fast4Top":"مزامنة "+section}
        </button>)}
      </div>
      <p className="manager-note">{supplierSyncSection==="الألعاب"?"هنا تظهر الألعاب وباقاتها وخيارات شحنها التابعة لها، مثل PUBG وفري فاير، حسب المنتجات التي يوفرها Fast4Top.":supplierSyncSection==="التطبيقات"?"هنا تظهر التطبيقات وخدمات شحنها التابعة لها، مثل TikTok وLikee وKwai وBigo، حسب المنتجات التي يوفرها Fast4Top.":"اختر مجموعة الألعاب أو التطبيقات لعرض منتجاتها وخدمات شحنها معًا، أو اعرض كتالوج Fast4Top كاملًا."}</p>
       <div className="admin-heading-actions" style={{marginBottom:16}}>
        <button className={supplierView==="all" ? "primary-btn" : "secondary-btn"} onClick={()=>setSupplierView("all")}>كل كتالوج Fast4Top ({supplierProducts.length})</button>
        <button className={supplierView==="selected" ? "primary-btn" : "secondary-btn"} onClick={()=>setSupplierView("selected")}>المنتجات المختارة للمتجر ({supplierProducts.filter(p=>p.ownerSelected).length})</button>
        <button className={supplierView==="unselected" ? "primary-btn" : "secondary-btn"} onClick={()=>setSupplierView("unselected")}>غير المضافة ({supplierProducts.filter(p=>!p.ownerSelected).length})</button>
      </div>
      <p className="manager-note">المزامنة تجلب الكتالوج فقط. لن يظهر أي منتج للزبائن إلا بعد اختيارك له من هنا.</p>
      <div className="supplier-products-grid">
        {sortedSupplierProducts.map(p => (
          <div className="supplier-mini-card" key={`${p.externalId}-${p.name}`}>
            {p.imageUrl ? <img src={p.imageUrl} alt={p.name}/> : <div className="product-mini"><Box size={18}/></div>}
            <div>
              <strong>{p.name}</strong>
              <label className="supplier-section-picker">صورة المنتج
                <input type="file" accept="image/png,image/jpeg,image/webp" aria-label={`رفع صورة ${p.name}`} onChange={e=>{const file=e.target.files?.[0];if(file)compressProductImage(file,data=>setSupplierImage.mutate({id:p.id,imageData:data}),setError);e.currentTarget.value="";}} disabled={setSupplierImage.isPending}/>
              </label>
              <small>{p.category ?? "غير مصنف"} · {p.subcategory ?? ""}</small>
              <label className="supplier-section-picker">قسم المتجر
                <select value={p.storeSection || "خدمات رقمية"} onChange={e => setSupplierStoreSection.mutate({id:p.id,storeSection:e.target.value as "الألعاب" | "التطبيقات" | "الخدمات والاتصالات" | "البطاقات الرقمية" | "خدمات رقمية"})} disabled={setSupplierStoreSection.isPending}>
                  <option value="الألعاب">الألعاب</option>
                  <option value="التطبيقات">التطبيقات</option><option value="الخدمات والاتصالات">الخدمات والاتصالات</option><option value="البطاقات الرقمية">البطاقات الرقمية</option><option value="خدمات رقمية">خدمات رقمية أخرى</option>
                </select>
              </label>
              <b>{money(p.sellingPriceCents)}</b>
              <small>الحالة: {p.ownerSelected ? "مختار للمتجر" : "مزامن فقط وغير معروض"} · التوفر لدى المزوّد: {p.available ? "متاح" : "غير متاح"}</small>
              <div className="admin-heading-actions">
                <button className={p.ownerSelected ? "secondary-btn" : "primary-btn"} onClick={() => setSupplierSelection.mutate({id:p.id,selected:!p.ownerSelected})} disabled={setSupplierSelection.isPending || (!p.ownerSelected && !p.available)}>
                  {p.ownerSelected ? "إزالة من المنتجات المختارة" : "إضافة إلى المتجر"}
                </button>
                {p.ownerSelected && <button className="text-btn" onClick={() => setSupplierEnabled.mutate({id:p.id,enabled:!p.enabled})} disabled={setSupplierEnabled.isPending}>
                  {p.enabled ? "إيقاف العرض مؤقتًا" : "إعادة عرض المنتج"}
                </button>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )}
</section>
      {(activeSection==="payments"||activeSection==="balance")&&<section className="panel orders-manager">
        <div className="panel-head"><div><h2>{activeSection==="balance"?"طلبات تعبئة رصيد الزبائن":"طلبات الدفع والشحن"}</h2><span>{visibleOrders.length} طلب · تتحدث القائمة تلقائيًا</span></div><button className="secondary-btn" onClick={()=>ordersQuery.refetch()}><RefreshCw size={15}/> تحديث الطلبات</button></div>
        <div className="orders-toolbar"><input value={orderSearch} onChange={e=>setOrderSearch(e.target.value)} placeholder="ابحث برقم الطلب أو اسم الزبون أو رقمه"/><select value={orderFilter} onChange={e=>setOrderFilter(e.target.value as typeof orderFilter)}><option value="all">كل الحالات</option><option value="pending">بانتظار المراجعة</option><option value="processing">مؤكد / قيد المعالجة</option><option value="completed">مكتمل</option><option value="failed">مرفوض / فاشل</option></select></div>
        {ordersQuery.isLoading?<div className="manager-note">جاري تحميل الطلبات...</div>:filteredOrders.length===0?<div className="manager-empty"><WalletCards size={30}/><h3>لا توجد طلبات هنا</h3><p>طلبات الزبائن الجديدة ستظهر في هذا القسم مباشرة.</p></div>:<div className="orders-list">{filteredOrders.map(order=>{const walletOrder=isWalletTopupOrder(order.items);return <article className="owner-order-card" key={order.id}>
          <div className="owner-order-main"><div><strong>{walletOrder?"تعبئة رصيد المحفظة":(() => { try { const items=JSON.parse(order.items) as Array<{name?:string;quantity?:number;targetId?:string}>; return items.map(item => `${item.quantity && item.quantity > 1 ? `${item.quantity} × ` : ""}${item.name || "طلب من المتجر"}`).join("، ") || "طلب من المتجر"; } catch { return "طلب من المتجر"; } })()} · {order.customerName}</strong><small>{order.orderNumber} · {new Date(order.createdAt).toLocaleString("ar-SY")} · {order.phone}</small></div><b className="owner-order-total">{money(order.total)}</b></div>
          <div className="owner-order-meta"><span>الدفع: {order.paymentStatus==="confirmed"?"مؤكد":order.paymentStatus==="rejected"?"مرفوض":"بانتظار التأكيد"}</span>{order.paymentReference&&<span>رقم التحويل: {order.paymentReference}</span>}{order.ownerNote&&<span>ملاحظة: {order.ownerNote}</span>}</div>
          {order.paymentProofUrl&&<a className="owner-proof-link" href={order.paymentProofUrl} target="_blank" rel="noreferrer">عرض إثبات التحويل</a>}
          {order.paymentStatus==="pending"&&<div className="owner-order-actions"><button className="primary-btn" onClick={()=>updateOrder.mutate({id:order.id,paymentStatus:"confirmed",...(walletOrder?{executionStatus:"completed" as const}:{})})} disabled={updateOrder.isPending}>{walletOrder?"تأكيد التحويل وإضافة الرصيد":"تأكيد الدفع"}</button><button className="delete-btn" onClick={()=>updateOrder.mutate({id:order.id,paymentStatus:"rejected",executionStatus:"failed"})} disabled={updateOrder.isPending}>رفض الطلب</button></div>}
        </article>})}</div>}
      </section>}
      </main>
    {categoryEdit&&<div className="overlay"><form className="product-modal category-edit-modal" onSubmit={e=>{e.preventDefault();saveSupplierCategory.mutate({sourceName:categoryEdit.sourceName,displayName:categoryEdit.displayName.trim(),imageUrl:categoryEdit.imageUrl.startsWith("data:image/") ? null : categoryEdit.imageUrl || null,imageData:categoryEdit.imageUrl.startsWith("data:image/") ? categoryEdit.imageUrl : undefined});}}><button type="button" className="close-btn modal-close" onClick={()=>setCategoryEdit(null)}><X/></button><span className="eyebrow">تخصيص قسم Fast4Top</span><h2>تعديل القسم</h2><p>التعديل محفوظ بشكل مستقل، ولن تضيع الصورة أو الاسم عند مزامنة المنتجات.</p><label>اسم القسم الظاهر<input required maxLength={255} value={categoryEdit.displayName} onChange={e=>setCategoryEdit({...categoryEdit,displayName:e.target.value})}/></label><label>صورة القسم<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file)compressProductImage(file,data=>setCategoryEdit(v=>v?{...v,imageUrl:data}:v),setError);}}/></label>{categoryEdit.imageUrl&&<img className="category-edit-preview" src={categoryEdit.imageUrl} alt="معاينة صورة القسم"/>}<div className="admin-heading-actions"><button type="submit" className="primary-btn" disabled={saveSupplierCategory.isPending}>{saveSupplierCategory.isPending?"جارٍ الحفظ...":"حفظ التعديلات"}</button><button type="button" className="secondary-btn" onClick={()=>setCategoryEdit(null)}>إلغاء</button></div></form></div>}
    {formOpen&&<div className="overlay"><form className="product-modal" onSubmit={submit}><button type="button" className="close-btn modal-close" onClick={()=>setFormOpen(false)}><X/></button><span className="eyebrow">إدارة كتالوج التطبيقات والألعاب</span><h2>{editingId?"تعديل المنتج":"إضافة منتج جديد"}</h2><div className="form-grid"><label>اسم المنتج<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="مثال: Free Fire Diamonds أو TikTok Coins"/></label><label>الفئة<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option>التطبيقات</option><option>الألعاب</option><option>الهواتف</option><option>الإكسسوارات</option><option>المنتجات</option></select></label><label>السعر بالدولار<input required type="number" min="0" step="0.01" value={form.priceUsd} onChange={e=>setForm({...form,priceUsd:e.target.value})} placeholder="بالدولار الأمريكي"/></label><label>السعر السابق بالدولار<input type="number" min="0" step="0.01" value={form.oldPrice} onChange={e=>setForm({...form,oldPrice:e.target.value})} placeholder="اختياري للخصم"/></label><label>المخزون<input required type="number" min="0" value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})}/></label><label>شارة المنتج<input value={form.tag} onChange={e=>setForm({...form,tag:e.target.value})} placeholder="الأكثر مبيعًا، عرض خاص..."/></label><label>صورة المنتج<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>{const file=e.target.files?.[0];if(!file)return;setError("جاري تجهيز الصورة...");compressProductImage(file,data=>{setForm({...form,imageData:data});setError("")},message=>setError(message))}}/></label><label className="wide">الوصف<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="وصف مختصر يظهر للزبائن"/></label></div>{error&&<div className="form-error">{error}</div>}<button className="primary-btn full" disabled={createProduct.isPending||updateProduct.isPending}>{createProduct.isPending||updateProduct.isPending?"جارٍ الحفظ...":editingId?"حفظ تعديلات المنتج":"حفظ المنتج وإظهاره في المتجر"}</button></form></div>}
    {transferOpen&&<div className="overlay"><form className="product-modal" onSubmit={e=>{e.preventDefault();addAdmin.mutate({email:transferEmail})}}><button type="button" className="close-btn modal-close" onClick={()=>setTransferOpen(false)}><X/></button><span className="eyebrow">صلاحيات المتجر</span><h2>إضافة مدير مشارك</h2><p className="modal-copy">اكتب بريد الحساب الثاني بعد أن يسجل دخوله إلى Manus مرة واحدة. سيبقى المالك الحالي فعالًا ولن يتم فصل المتجر عن أي حساب.</p><label>بريد المدير المشارك<input required type="email" value={transferEmail} onChange={e=>setTransferEmail(e.target.value)} placeholder="manager@example.com"/></label>{error&&<div className="form-error">{error}</div>}<button className="primary-btn full" disabled={addAdmin.isPending}>{addAdmin.isPending?"جارٍ إضافة المدير...":"إضافة المدير المشارك"}</button></form></div>}
  </div>
}
function Stat({icon,label,value,suffix,delta}:{icon:ReactNode;label:string;value:string;suffix:string;delta:string}){return <div className="stat-card"><div className="stat-icon">{icon}</div><span>{label}</span><strong>{value} <small>{suffix}</small></strong><em>{delta}</em></div>}
