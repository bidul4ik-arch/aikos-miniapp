// Safe Telegram stub (keeps working in WebView and browser)
const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : {
  initData: "", initDataUnsafe: {}, expand(){}, ready(){}, HapticFeedback:{impactOccurred(){}, notificationOccurred(){}},
  MainButton:{ setText(){return this}, show(){return this}, hide(){}, onClick(){} }, showAlert(m){ try{alert(m)}catch(_){} }
};
const IS_BROWSER = !window.Telegram || !window.Telegram.WebApp;
tg.expand(); tg.ready();

// Tiny debug panel
function showDebug(data){
  const wrap = document.createElement('div');
  wrap.style.cssText='position:fixed;left:8px;right:8px;bottom:8px;max-height:45vh;overflow:auto;background:#111b28;color:#fff;border:1px solid #2a3b4f;border-radius:12px;padding:10px;z-index:9999;font:12px/1.4 monospace; white-space:pre-wrap';
  wrap.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const close = document.createElement('button');
  close.textContent='×'; close.style.cssText='position:absolute;top:4px;right:8px;background:#334559;border:none;color:#fff;border-radius:6px;padding:4px 8px;cursor:pointer';
  close.onclick=()=>wrap.remove();
  wrap.appendChild(close);
  document.body.appendChild(wrap);
}
window.__miniapp_debug = showDebug;

// Elements
const fSeason = document.querySelector("#f-season");
const fBrand = document.querySelector("#f-brand");
const fWidth = document.querySelector("#f-width");
const fAspect = document.querySelector("#f-aspect");
const fRim = document.querySelector("#f-rim");
const fStud = document.querySelector("#f-stud");
const fRunflat = document.querySelector("#f-runflat");
const grid = document.querySelector("#grid");
const itemsCount = document.querySelector("#items-count");
const hello = document.querySelector("#hello");
const logo = document.querySelector(".logo");
const currencyEl = document.querySelector('#currency');
const vatEl      = document.querySelector('#vat');
const btnCheckout = document.getElementById('btn-checkout');
const cartBackdrop = document.getElementById('cart-backdrop');
const cartList = document.getElementById('cart-list');
const cartTotals = document.getElementById('cart-totals');
const btnCart = document.getElementById('btn-cart');

const VAT_RATE = 0.12; // KZ НДС 12%. Только для показа; бэкенд считает финально.
let isCartOpen = false;

if (hello) hello.textContent = tg.initDataUnsafe?.user ? `Привет, ${tg.initDataUnsafe.user.first_name}!` : "Привет!";
if (logo) logo.addEventListener('dblclick', ()=>showDebug(window.__last_menu_response || {}));

const state = { menu:{categories:[], brands:[], items:[]}, cart:{} };
const rates   = { EUR: 1, KZT: 500, USD: 1.1, UZS: 12900 }; // базовая валюта — EUR
const symbols = { EUR: '€', KZT: '₸', USD: '$', UZS: 'сўм' };
state.currency = 'EUR';
state.vatMode  = 'with';

function convert(amountEUR){ return amountEUR * (rates[state.currency] || 1); }
function fmtPrice(amountEUR){
  const v = convert(amountEUR);
  const s = symbols[state.currency] || '';
  const num = state.currency === 'UZS' ? Math.round(v).toLocaleString('ru-RU') : v.toFixed(2);
  return `${s} ${num}`;
}

currencyEl?.addEventListener('change', ()=>{
  state.currency = currencyEl.value;
  renderCatalog(state.menu.items); // перерисовать цены
  if (isCartOpen) renderCartModal();
});
vatEl?.addEventListener('change', ()=>{
  state.vatMode = vatEl.value;
});

async function api(path, opts={}){
  const headers = { "Content-Type":"application/json", ...(opts.headers||{}) };
  if (!IS_BROWSER) headers["Telegram-Init-Data"] = tg.initData || "";
  const resp = await fetch(path, { ...opts, headers, cache:"no-store" });
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch (e) { json = { ok:false, parseError:e.message, raw:text.slice(0,400) }; }
  return { status: resp.status, json };
}

function ensureArrays(payload){
  const m = payload || {};
  return {
    categories: Array.isArray(m.categories) ? m.categories : [],
    brands: Array.isArray(m.brands) ? m.brands : [],
    items: Array.isArray(m.items) ? m.items : (Array.isArray(m)? m : [])
  };
}

async function loadMenu(){
  const { status, json } = await api("/api/menu");
  window.__last_menu_response = { status, body: json };
  if (status !== 200 || json.ok === false) {
    throw new Error(json?.error || `HTTP ${status}`);
  }
  return ensureArrays(json);
}

function labelSeason(s){ return { summer:"Летние", winter:"Зимние", allseason:"Всесезон" }[s] || s || ""; }
function firstImage(it){ return (it.images && it.images[0]) || "/images/noimage.svg"; }
function stockSum(it){ try { return (it.stock||[]).reduce((s,a)=>s + Number(a.qty||0), 0); } catch(e){ return 0; } }

function renderFilters(menu){
  const categories = menu?.categories || [];
  const brands = menu?.brands || [];

  if (fSeason) fSeason.innerHTML = '<option value="">Сезон</option>' + categories.map(c=>`<option value="${c.id}">${labelSeason(c.id)}</option>`).join("");
  if (fBrand)  fBrand.innerHTML  = '<option value="">Бренд</option>' + brands.map(b=>`<option value="${b}">${b}</option>`).join("");
  [fWidth, fAspect, fRim].forEach(el=>{
    if (!el) return;
    el.addEventListener('keyup', e=>{ if (e.key === 'Enter') applyFilters(); });
    el.addEventListener('change', applyFilters);
    el.addEventListener('blur', applyFilters);
  });
  [fSeason,fBrand,fWidth,fAspect,fRim,fStud,fRunflat]
    .filter(Boolean)
    .forEach(el=> el.onchange = applyFilters);
}

function renderCatalog(items){
  if (!grid) return;
  grid.innerHTML = "";
  (items || []).forEach(it=>{
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <img class="card-img" src="${firstImage(it)}" alt="${it.title||''}">
      <div class="card-body">
        <div class="row"><strong>${it.brand||''}</strong> <span class="badge">${labelSeason(it.season)}</span> ${it.runflat?'<span class="badge">RunFlat</span>':""} ${it.studded?'<span class="badge">Шипы</span>':""} <span class="badge">В наличии: ${stockSum(it)}</span></div>
        <div>${it.title||''}</div>
        <div class="hint">${it.size?`${it.size.width}/${it.size.aspect} R${it.size.rim}`:''}</div>
        <div class="row"><div><strong>${fmtPrice(Number(it.price||0))}</strong></div><button class="btn">В корзину</button></div>
      </div>`;
    const btn = div.querySelector(".btn");
    if (btn) btn.onclick = ()=>addToCart(it);
    grid.appendChild(div);
  });
  updateCartBar();
}


function applyFilters(){
  // извлечём возможный комбинированный размер из поля "Ширина"
  let w = (fWidth?.value || "").trim();
  let a = (fAspect?.value || "").trim();
  let r = (fRim?.value || "").trim();

  const combo = (fWidth?.value || "").toLowerCase();
  const m = combo.match(/(\d{3})\s*[\/x]\s*(\d{2})\s*(?:r\s*)?(\d{2})/i);
  if (m) {
    w = m[1]; a = m[2]; r = m[3];
    if (fWidth)  fWidth.value  = w;
    if (fAspect) fAspect.value = a;
    if (fRim)    fRim.value    = r;
  }

  const season = fSeason?.value || "";
  const brand  = (fBrand?.value || "").toLowerCase();
  const items = (state.menu.items || []).filter(it=>{
    if (season && it.season !== season) return false;
    if (brand && (it.brand||"").toLowerCase() !== brand) return false;
    if (w && String(it.size?.width)  !== String(w)) return false;
    if (a && String(it.size?.aspect) !== String(a)) return false;
    if (r && String(it.size?.rim)    !== String(r)) return false;
    if (fStud?.checked && !it.studded) return false;
    if (fRunflat?.checked && !it.runflat) return false;
    return true;
  });
  renderCatalog(items);
}


function addToCart(item){
  if(!state.cart[item.id]) state.cart[item.id] = { qty:0, price:item.price };
  state.cart[item.id].qty++;
  updateCartBar();
  tg.HapticFeedback.notificationOccurred("success");
}
function cartCount(){ return Object.values(state.cart).reduce((a,b)=>a+b.qty,0); }
function updateCartBar(){
  const c = cartCount();
  if (itemsCount) itemsCount.textContent = c;
  if (tg.MainButton && tg.MainButton.setText) {
    if (c>0) tg.MainButton.setText(`Оформить • ${c}`).show();
    else tg.MainButton.hide();
    }
}
function getCartItems(){
  const items = state.menu.items || [];
  return Object.entries(state.cart).map(([id, c])=>{
    const it = items.find(x=>x.id===id) || {};
    return { id, qty: Number(c.qty||0), price: Number(it.price||0), it };
  }).filter(x=>x.qty>0);
}

function setQty(id, qty){
  if (qty <= 0) delete state.cart[id];
  else {
    if(!state.cart[id]) state.cart[id] = { qty:0, price:0 };
    state.cart[id].qty = qty;
  }
  updateCartBar();
  if (isCartOpen) renderCartModal();
}

function lineTotalEUR(row){ return row.qty * (row.price || 0); }
function cartTotalsEUR(){
  const rows = getCartItems();
  const subtotal = rows.reduce((s,r)=> s + lineTotalEUR(r), 0);
  const vat = state.vatMode === 'with' ? subtotal * VAT_RATE : 0;
  const total = state.vatMode === 'with' ? (subtotal + vat) : subtotal;
  return { subtotal, vat, total };
}

function renderCartModal(){
  const rows = getCartItems();

  if (rows.length === 0){
    cartList.innerHTML = `<div class="item">Корзина пуста. Добавьте товары из каталога.</div>`;
  } else {
    cartList.innerHTML = rows.map(r=>{
      const it = r.it || {};
      const sz = it.size ? `${it.size.width}/${it.size.aspect} R${it.size.rim}` : '';
      return `
      <div class="item" data-id="${r.id}">
        <div><b>${it.brand || ''} ${it.title || ''}</b></div>
        <div class="muted">${sz}</div>
        <div class="row">
          <div class="muted">Цена: ${fmtPrice(it.price||0)} • Сумма: <b>${fmtPrice(lineTotalEUR(r))}</b></div>
          <div class="row" style="gap:6px">
            <button class="close btn-dec">–</button>
            <span>${r.qty}</span>
            <button class="close btn-inc">+</button>
            <button class="close btn-del">×</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  const { subtotal, vat, total } = cartTotalsEUR();
  cartTotals.innerHTML = `
    <div><b>Сумма товаров:</b> ${fmtPrice(subtotal)}</div>
    <div>НДС (${Math.round(VAT_RATE*100)}%): ${state.vatMode==='with' ? fmtPrice(vat) : '— (цены без НДС)'}</div>
    <div><b>Итого к оплате:</b> ${fmtPrice(total)}</div>
    <div class="muted">Валюта: ${symbols[state.currency] || ''}. Переключай вверху в фильтрах.</div>
  `;

  cartList.querySelectorAll('.item').forEach(row=>{
    const id = row.getAttribute('data-id');
    row.querySelector('.btn-inc')?.addEventListener('click', ()=> setQty(id, (state.cart[id]?.qty||1) + 1));
    row.querySelector('.btn-dec')?.addEventListener('click', ()=> setQty(id, (state.cart[id]?.qty||1) - 1));
    row.querySelector('.btn-del')?.addEventListener('click', ()=> setQty(id, 0));
  });
}

function openCart(){ isCartOpen = true; renderCartModal(); cartBackdrop?.classList.add('show'); }
function closeCart(){ isCartOpen = false; cartBackdrop?.classList.remove('show'); }

async function checkout(){
  const items = Object.entries(state.cart).map(([id, c])=>{
    const it = (state.menu.items||[]).find(x=>x.id===id) || {};
    return { id, qty: Number(c.qty||0), price: Number(it.price||0) }; // price в EUR (база)
  });
  if (!items.length) return tg.showAlert('Корзина пустая');

  const { status, json } = await api('/api/orders', {
    method: 'POST',
    body: JSON.stringify({ items, vatMode: state.vatMode })
  });
  if (status !== 200 || !json.ok) throw new Error(json.error || 'order failed');

  const { orderId, total } = json;
  tg.showAlert(`Заказ оформлен!\n№ ${orderId}\nСумма: ${fmtPrice(total)} (${state.vatMode==='with' ? 'с НДС' : 'без НДС'})`);

  state.cart = {};
  updateCartBar();

  const input = document.getElementById('order-id');
  if (input) input.value = orderId;
  showTab('delivery');
  await trackOrder(orderId);
}
btnCheckout?.addEventListener('click', checkout);
if (tg.MainButton?.onClick) tg.MainButton.onClick(checkout);
btnCart?.addEventListener('click', openCart);
document.getElementById('cart-close')?.addEventListener('click', closeCart);
document.getElementById('cart-clear')?.addEventListener('click', ()=>{
  state.cart = {}; updateCartBar(); renderCartModal();
});
document.getElementById('cart-checkout')?.addEventListener('click', ()=>{
  closeCart(); checkout();
});

// Закрытие по клику на фон и по Esc
cartBackdrop?.addEventListener('click', (e)=>{ if (e.target === cartBackdrop) closeCart(); });
document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape' && isCartOpen) closeCart(); });

async function trackOrder(id){
  const { status, json } = await api(`/api/order-status?id=${encodeURIComponent(id)}`);
  if (status === 200 && json.ok){
    const box = document.getElementById('track-result');
    if (box){
      box.style.display = 'block';
      box.innerHTML = `<div><b>Заказ ${json.orderId}</b></div>
                       <div>Статус: ${json.status}</div>
                       <div>ETA: ${json.eta||'-'}</div>`;
    }
  }
}
document.getElementById('btn-track')?.addEventListener('click', ()=>{
  const id = document.getElementById('order-id')?.value.trim();
  if (!id) return tg.showAlert('Введите номер заказа');
  trackOrder(id);
});
const tabsEl = document.getElementById("tabs");
const SECTIONS = [
  { id: "catalog",  title: "Каталог"  },
  { id: "fitment",  title: "По авто"  },
  { id: "delivery", title: "Доставка" },
  { id: "branches", title: "Филиалы" },
  { id: "reviews",  title: "Отзывы"   },
];
let branchesLoaded = false, reviewsLoaded = false;

async function loadBranchesOnce(){
  if (branchesLoaded) return;
  const { status, json } = await api('/api/branches');
  if (status === 200 && json.ok){
    const list = document.getElementById('branches-list');
    if (list) {
      list.innerHTML = (json.branches||[]).map(b=>`
        <div class="item">
          <div><b>${b.name}</b></div>
          <div class="muted">${b.address}</div>
          <div class="muted">${b.hours||''}</div>
          <div class="row">
            <a href="${b.mapUrl}" target="_blank">На карте</a>
            <a href="tel:${b.phone}">${b.phone}</a>
          </div>
        </div>`).join('');
    }
    branchesLoaded = true;
  }
}

async function loadReviewsOnce(){
  if (reviewsLoaded) return;
  const { status, json } = await api('/api/reviews');
  if (status === 200 && json.ok){
    const list = document.getElementById('reviews-list');
    if (list) {
      list.innerHTML = (json.links||[]).map(r=>`<a class="item" href="${r.url}" target="_blank">${r.label}</a>`).join('');
    }
    reviewsLoaded = true;
  }
}

function showTab(id) {
  document.querySelectorAll("section").forEach(s => {
    s.style.display = (s.id === id) ? "block" : "none";
  });
  if (tabsEl) {
    tabsEl.querySelectorAll(".tab").forEach(t =>
      t.classList.toggle("active", t.dataset.id === id)
    );
  }
  if (id === 'branches') loadBranchesOnce();
  if (id === 'reviews')  loadReviewsOnce();
}

function buildTabs() {
  if (!tabsEl) return;
  tabsEl.innerHTML = SECTIONS
    .map(t => `<div class="tab" data-id="${t.id}">${t.title}</div>`)
    .join("");
  tabsEl.querySelectorAll(".tab").forEach(btn =>
    btn.addEventListener("click", () => showTab(btn.dataset.id))
  );
  showTab("catalog"); // <-- показываем каталог сразу
}

// вызвать до/после загрузки меню — без разницы
buildTabs();

async function bootstrap(){
  try {
    const menu = await loadMenu();
    state.menu = menu;
    renderFilters(menu);
    renderCatalog(menu.items);
  } catch (e){
    tg.showAlert("Ошибка загрузки: " + e.message + "\nДважды нажми на логотип для подробностей.");
    // minimal fallback to keep UI alive
    renderCatalog([{id:"demo", brand:"Michelin", season:"summer", title:"Pilot Sport 4", size:{width:205,aspect:55,rim:16}, price:120, images:["/images/tire_michelin_ps4.webp"]}]);
  }
}

bootstrap();
