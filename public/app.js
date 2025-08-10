const tg = window.Telegram.WebApp;
tg.expand(); tg.ready();

const hello = document.getElementById("hello");
function renderHello(){
  const u = tg.initDataUnsafe?.user;
  hello.textContent = u ? `Привет, ${u.first_name}!` : "Привет!";
}
renderHello();

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
  cart: {}, // id -> {qty, price, title, ...}
  currency: "EUR",
  vat: "with"
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
  const resp = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type":"application/json",
      ...(opts.headers||{}),
      "Telegram-Init-Data": tg.initData || ""
    }
  });
  return resp.json();
}

// Load initial data
async function loadAll(){
  const [menu, br, rev] = await Promise.all([
    api("/api/menu"),
    fetch("/api/branches").then(r=>r.json()),
    fetch("/api/reviews/links").then(r=>r.json()),
  ]);
  state.menu = menu;
  state.branches = br.branches || [];
  state.links = rev.links || [];
  renderFilters(menu);
  renderCatalog(menu.items);
  renderBranches();
  renderReviewLinks();
}
loadAll().catch(e=>tg.showAlert("Ошибка загрузки: "+e.message));

// Currency / VAT handling
const currencyEl = document.getElementById("currency");
const vatEl = document.getElementById("vat");
const RATES = { EUR:1, USD:1.1, KZT:500, UZS:13000 }; // demo rates
const SYMBOLS = { EUR:"€", USD:"$", KZT:"₸", UZS:"сўм" };

currencyEl.onchange = ()=>{ state.currency = currencyEl.value; renderCatalog(state.menu.items); };
vatEl.onchange = ()=>{ state.vat = vatEl.value; renderCatalog(state.menu.items); };

function priceWithSettings(eur){
  const rate = RATES[state.currency] || 1;
  let p = eur * rate;
  if(state.vat === "with"){ p *= 1.12; } // demo VAT 12%
  return p;
}
function fmtPrice(eur){
  const val = priceWithSettings(eur);
  const sym = SYMBOLS[state.currency] || "";
  return `${val.toFixed(2)} ${sym}`;
}

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

function renderFilters(menu){
  const seasons = menu.categories.map(c=>c.id);
  fSeason.innerHTML = '<option value="">Сезон</option>' + seasons.map(s=>`<option value="${s}">${labelSeason(s)}</option>`).join("");
  fBrand.innerHTML = '<option value="">Бренд</option>' + menu.brands.map(b=>`<option value="${b}">${b}</option>`).join("");
  [fSeason,fBrand,fWidth,fAspect,fRim,fStud,fRunflat].forEach(el=>el.onchange = applyFilters);
}

function applyFilters(){
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
  if(!state.cart[item.id]) state.cart[item.id] = { qty:0, price:item.price, title:item.title };
  state.cart[item.id].qty += 1;
  updateCartBar();
  tg.HapticFeedback.notificationOccurred("success");
}
function cartCount(){ return Object.values(state.cart).reduce((a,b)=>a+b.qty,0); }

function firstImage(it){
  const f = (it.images && it.images.length) ? it.images[0] : "/images/noimage.svg";
  return f;
}
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
        <div class="row"><strong>${it.brand}</strong> <span class="badge">${labelSeason(it.season)}</span></div>
        <div>${it.title}</div>
        <div class="hint">${it.size.width}/${it.size.aspect} R${it.size.rim} • Load ${it.loadIndex} • ${it.speedIndex}${it.runflat?" • RunFlat":""}</div>
        <div class="row">
          <div><strong>${fmtPrice(it.price)}</strong></div>
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
  state.branches.forEach(b=>{
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
  state.links.forEach(l=>{
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `<strong>${l.label}</strong> <a href="${l.url}" target="_blank">Оставить отзыв</a>`;
    list.appendChild(el);
  });
  const form = document.getElementById("review-form");
  form.onsubmit = (e)=>{
    e.preventDefault();
    tg.showPopup({
      title:"Спасибо!",
      message:"Внутренний отзыв отправлен (демо). Мы свяжемся с вами.",
      buttons:[{id:"ok",type:"ok"}]
    });
  };
}

// Delivery tracking
const btnTrack = document.getElementById("btn-track");
const trackResult = document.getElementById("track-result");
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
function labelStatus(s){
  return {
    accepted:"Принят",
    processing:"Готовится",
    on_the_way:"В пути",
    delivered:"Доставлен"
  }[s] || s;
}

// Checkout
btnCheckout.onclick = checkout;
async function checkout(){
  const items = Object.entries(state.cart).map(([id, v])=>({ id, qty:v.qty, price:v.price }));
  if(!items.length) return tg.showAlert("Корзина пуста");
  try{
    const resp = await api("/api/orders", {
      method:"POST",
      body: JSON.stringify({ items, vatMode: state.vat })
    });
    if(!resp.ok) throw new Error(resp.error || "Server error");
    tg.showPopup({
      title:"Заказ оформлен",
      message:`№ ${resp.orderId}\nИтого (EUR, без визуального пересчёта): ${resp.total.toFixed(2)}`,
      buttons:[{id:"ok",type:"ok"}]
    });
    state.cart = {};
    updateCartBar();
    setView("delivery");
    document.getElementById("order-id").value = resp.orderId;
    btnTrack.click();
  }catch(e){
    tg.showAlert("Ошибка: " + e.message);
  }
}

// --- Simple modal viewer ---
const backdrop = document.getElementById("modal-backdrop");
const mTitle = document.getElementById("m-title");
const mImg = document.getElementById("m-img");
const mClose = document.getElementById("m-close");
let modalItem = null;
let galleryIdx = 0;

function openModal(item){
  modalItem = item;
  galleryIdx = 0;
  const imgs = (item.images && item.images.length) ? item.images : [firstImage(item)];
  mTitle.textContent = `${item.brand} • ${item.title}`;
  mImg.src = imgs[galleryIdx];
  renderThumbs(imgs);
  backdrop.style.display = "flex";
}
function closeModal(){ backdrop.style.display = "none"; }
mClose.onclick = closeModal;
backdrop.onclick = (e)=>{ if(e.target === backdrop) closeModal(); };

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
  const imgs = (modalItem.images && modalItem.images.length) ? modalItem.images : [firstImage(modalItem)];
  galleryIdx = (galleryIdx - 1 + imgs.length) % imgs.length;
  mImg.src = imgs[galleryIdx];
  renderThumbs(imgs);
};
document.getElementById("g-next").onclick = ()=>{
  const imgs = (modalItem.images && modalItem.images.length) ? modalItem.images : [firstImage(modalItem)];
  galleryIdx = (galleryIdx + 1) % imgs.length;
  mImg.src = imgs[galleryIdx];
  renderThumbs(imgs);
};
