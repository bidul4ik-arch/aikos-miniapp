// --- Safe Telegram stub for browser preview ---
const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : {
  initData: "",
  initDataUnsafe: {},
  expand(){}, ready(){},
  HapticFeedback: { impactOccurred(){}, notificationOccurred(){} },
  MainButton: { setText(){ return this }, show(){ return this }, hide(){}, onClick(){} },
  showAlert(msg){ try{ alert(msg) }catch(_){} },
  showPopup({title, message}){ try{ alert((title?title+"\n":"") + (message||"")) }catch(_){} }
};
const IS_BROWSER_PREVIEW = !window.Telegram || !window.Telegram.WebApp;
tg.expand(); tg.ready();

const hello = document.getElementById("hello");
function renderHello(){
  const u = tg.initDataUnsafe?.user;
  hello.textContent = u ? `Привет, ${u.first_name}!` : "Привет!";
}
renderHello();

const NOTICE = document.getElementById("notice");
if (IS_BROWSER_PREVIEW) {
  NOTICE.style.display = "block";
  NOTICE.textContent = "Предпросмотр в браузере: часть функций требует открыть из Telegram.";
}

// Tabs
const TABS = [
  {id:"catalog", label:"Каталог"},
  {id:"fitment", label:"По авто"},
  {id:"delivery", label:"Доставка"},
  {id:"branches", label:"Филиалы"},
  {id:"reviews", label:"Отзывы"}
];
const state = {
  view: "catalog",
  menu: null,
  branches: [],
  links: [],
  cart: {}, // id -> {qty, price, title, images}
};
const $ = (s)=>document.querySelector(s);
const tabs = $("#tabs");
function renderTabs(){
  tabs.innerHTML = "";
  TABS.forEach(t=>{
    const el = document.createElement("button");
    el.className = "tab" + (state.view===t.id?" active":"");
    el.textContent = t.label;
    el.onclick = ()=>setView(t.id);
    tabs.appendChild(el);
  });
}
function setView(id){
  state.view = id;
  renderTabs();
  for(const t of TABS){
    $("#"+t.id).style.display = (t.id===id) ? "block" : "none";
  }
}
renderTabs(); setView("catalog");

// API helper
async function api(path, opts={}){
  const headers = { "Content-Type":"application/json", ...(opts.headers||{}) };
  if (!IS_BROWSER_PREVIEW) headers["Telegram-Init-Data"] = tg.initData || "";
  const resp = await fetch(path, { ...opts, headers, cache: "no-store" });
  return resp.json();
}

// Load data
async function loadAll(){
  try{
    const [menu, br, rev] = await Promise.all([
      api("/api/menu"),
      fetch("/api/branches", {cache:"no-store"}).then(r=>r.json()),
      fetch("/api/reviews/links", {cache:"no-store"}).then(r=>r.json()),
    ]);
    state.menu = menu;
    state.branches = br.branches || [];
    state.links = rev.links || [];
    renderFilters(menu);
    renderCatalog(menu.items);
    renderBranches();
    renderReviewLinks();
  }catch(e){
    // fallback minimal demo
    renderCatalog([
      {id:"demo1", brand:"Michelin", season:"summer", title:"Pilot Sport 4", size:{width:205,aspect:55,rim:16}, loadIndex:91, speedIndex:"V", price:120, images:["/images/tire_michelin_ps4.webp"]},
      {id:"demo2", brand:"Goodyear", season:"summer", title:"Eagle F1", size:{width:255,aspect:40,rim:19}, loadIndex:100, speedIndex:"Y", price:210, images:["/images/tire_goodyear.webp"]}
    ]);
  }
}
loadAll();

// Filters
const fSeason = $("#f-season");
const fBrand = $("#f-brand");
const fWidth = $("#f-width");
const fAspect = $("#f-aspect");
const fRim = $("#f-rim");
const fStud = $("#f-stud");
const fRunflat = $("#f-runflat");

function labelSeason(s){
  return {summer:"Летние", winter:"Зимние", allseason:"Всесезон"}[s] || s;
}
function stockSum(it){
  try { return (it.stock||[]).reduce((s,a)=>s + Number(a.qty||0), 0); } catch(e){ return 0; }
}
function firstImage(it){ return (it.images && it.images[0]) || ""; }

function renderFilters(menu){
  if(!menu) return;
  const seasons = menu.categories.map(c=>c.id);
  fSeason.innerHTML = '<option value="">Сезон</option>' + seasons.map(s=>`<option value="${s}">${labelSeason(s)}</option>`).join("");
  fBrand.innerHTML = '<option value="">Бренд</option>' + menu.brands.map(b=>`<option value="${b}">${b}</option>`).join("");
  [fSeason,fBrand,fWidth,fAspect,fRim,fStud,fRunflat].forEach(el=>el.onchange = applyFilters);
}
function applyFilters(){
  if(!state.menu) return;
  const items = state.menu.items.filter(it=>{
    if(fSeason.value && it.season !== fSeason.value) return false;
    if(fBrand.value && it.brand !== fBrand.value) return false;
    if(fWidth.value && String(it.size.width) !== fWidth.value) return false;
    if(fAspect.value && String(it.size.aspect) !== fAspect.value) return false;
    if(fRim.value && String(it.size.rim) !== fRim.value) return false;
    if(fStud.checked && !it.studded) return false;
    if(fRunflat.checked && !it.runflat) return false;
    return true;
  });
  renderCatalog(items);
}

// Catalog
const grid = document.getElementById("grid");
const itemsCount = document.getElementById("items-count");
const btnCheckout = document.getElementById("btn-checkout");

function addToCart(item){
  if(!state.cart[item.id]) state.cart[item.id] = { qty:0, price:item.price, title:item.title, images:item.images };
  state.cart[item.id].qty += 1;
  updateCartBar();
  tg.HapticFeedback.notificationOccurred("success");
}
function cartCount(){ return Object.values(state.cart).reduce((a,b)=>a+b.qty,0); }
function updateCartBar(){
  itemsCount.textContent = cartCount();
  const count = cartCount();
  if(count>0){
    tg.MainButton.setText(`Оформить • ${count}`).show().onClick(checkout);
  } else tg.MainButton.hide();
}

function renderCatalog(items){
  grid.innerHTML = "";
  items.forEach(it=>{
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <img class="card-img" src="${firstImage(it)}" alt="${it.title}">
      <div class="card-body">
        <div class="row"><strong>${it.brand}</strong> <span class="badge">${labelSeason(it.season)}</span> ${it.runflat?'<span class="badge">RunFlat</span>':""} ${it.studded?'<span class="badge">Шипы</span>':""} <span class="tag tag-stock">В наличии: ${stockSum(it)}</span></div>
        <div>${it.title}</div>
        <div class="hint">${it.size.width}/${it.size.aspect} R${it.size.rim} • Load ${it.loadIndex||""} • ${it.speedIndex||""}</div>
        <div class="row">
          <div><strong>${(it.price||0).toFixed ? it.price.toFixed(2) : it.price} €</strong></div>
          <button class="btn">В корзину</button>
        </div>
      </div>
    `;
    div.querySelector(".btn").onclick = ()=>addToCart(it);
    const img = div.querySelector(".card-img");
    img.style.cursor = "pointer";
    img.onclick = ()=>openModal(it);
    grid.appendChild(div);
  });
  updateCartBar();
}

// Branches
function renderBranches(){
  const list = document.getElementById("branches-list");
  list.innerHTML = "";
  (state.branches||[]).forEach(b=>{
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <strong>${b.name}</strong>
      <span class="hint">${b.address}</span>
      <span class="hint">${b.hours} • ${b.phone}</span>
      <a href="${b.mapUrl}" target="_blank">Открыть карту</a>
    `;
    list.appendChild(el);
  });
}

// Reviews links
function renderReviewLinks(){
  const list = document.getElementById("reviews-list");
  list.innerHTML = "";
  (state.links||[]).forEach(l=>{
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `<strong>${l.label}</strong> <a href="${l.url}" target="_blank">Оставить отзыв</a>`;
    list.appendChild(el);
  });
}

// Delivery tracking
const btnTrack = document.getElementById("btn-track");
const trackResult = document.getElementById("track-result");
if(btnTrack){
  btnTrack.onclick = async ()=>{
    const id = document.getElementById("order-id").value.trim();
    if(!id) return tg.showAlert("Введите номер заказа");
    try{
      const data = await api(`/api/orders/${encodeURIComponent(id)}`);
      if(!data.ok) throw new Error(data.error || "Ошибка");
      trackResult.style.display = "block";
      trackResult.innerHTML = `
        <strong>Заказ: ${data.orderId}</strong>
        <span class="hint">Статус: ${labelStatus(data.status)}</span>
        <span class="hint">Ожидаемое время: ${data.eta || "—"}</span>
      `;
    }catch(e){
      tg.showAlert("Ошибка: " + e.message);
    }
  };
}
function labelStatus(s){
  return { accepted:"Принят", processing:"Готовится", on_the_way:"В пути", delivered:"Доставлен" }[s] || s;
}

// Modal gallery
const backdrop = document.getElementById("modal-backdrop");
const mTitle = document.getElementById("m-title");
const mImg = document.getElementById("m-img");
const mSpec = document.getElementById("m-spec");
const mPrice = document.getElementById("m-price");
const mQty = document.getElementById("m-qty");
const mClose = document.getElementById("m-close");
const mMinus = document.getElementById("m-minus");
const mPlus = document.getElementById("m-plus");
const mAdd = document.getElementById("m-add");
let modalItem = null;
let modalQty = 1;
let galleryIdx = 0;

function openModal(item){
  modalItem = item;
  galleryIdx = 0;
  modalQty = 1;
  mTitle.textContent = `${item.brand} • ${item.title}`;
  const imgs = (item.images && item.images.length ? item.images : [""]);
  mImg.src = imgs[galleryIdx];
  renderThumbs(imgs);
  mSpec.textContent = `${item.size.width}/${item.size.aspect} R${item.size.rim} • Load ${item.loadIndex||""} • ${item.speedIndex||""}${item.runflat?" • RunFlat":""}${item.studded?" • Шипы":""}`;
  mPrice.textContent = `${(item.price||0).toFixed ? item.price.toFixed(2) : item.price} €`;
  mQty.textContent = String(modalQty);
  backdrop.style.display = "flex";
  tg.HapticFeedback.impactOccurred("light");
}
function closeModal(){ backdrop.style.display = "none"; }
mClose.onclick = closeModal;
backdrop.onclick = (e)=>{ if(e.target === backdrop) closeModal(); };
mMinus.onclick = ()=>{ if(modalQty>1){ modalQty--; mQty.textContent = String(modalQty); } };
mPlus.onclick = ()=>{ modalQty++; mQty.textContent = String(modalQty); };
mAdd.onclick = ()=>{ for(let i=0;i<modalQty;i++) addToCart(modalItem); closeModal(); };

function renderThumbs(imgs){
  const c = document.getElementById("g-thumbs");
  c.innerHTML = "";
  imgs.forEach((src, idx)=>{
    const t = document.createElement("img");
    t.src = src;
    if(idx===galleryIdx) t.classList.add("active");
    t.onclick = ()=>{ galleryIdx = idx; mImg.src = imgs[galleryIdx]; renderThumbs(imgs); };
    c.appendChild(t);
  });
}
document.getElementById("g-prev").onclick = ()=>{
  const imgs = (modalItem.images && modalItem.images.length ? modalItem.images : [""]);
  galleryIdx = (galleryIdx - 1 + imgs.length) % imgs.length;
  mImg.src = imgs[galleryIdx];
  renderThumbs(imgs);
};
document.getElementById("g-next").onclick = ()=>{
  const imgs = (modalItem.images && modalItem.images.length ? modalItem.images : [""]);
  galleryIdx = (galleryIdx + 1) % imgs.length;
  mImg.src = imgs[galleryIdx];
  renderThumbs(imgs);
};

// Checkout (demo)
btnCheckout.onclick = checkout;
async function checkout(){
  const items = Object.entries(state.cart).map(([id, v])=>({ id, qty:v.qty, price:v.price }));
  if(!items.length) return tg.showAlert("Корзина пуста");
  try{
    const resp = await api("/api/orders", { method:"POST", body: JSON.stringify({ items, vatMode: "with" }) });
    if(!resp.ok) throw new Error(resp.error || "Server error");
    tg.showPopup({ title:"Заказ оформлен", message:`№ ${resp.orderId}\nИтого: ${resp.total}` , buttons:[{id:"ok",type:"ok"}] });
    state.cart = {}; updateCartBar();
    setView("delivery"); document.getElementById("order-id").value = resp.orderId;
  }catch(e){ tg.showAlert("Ошибка: " + e.message); }
}
