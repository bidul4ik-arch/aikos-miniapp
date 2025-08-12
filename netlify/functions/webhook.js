
const fs = require("fs");
const path = require("path");

function readJSON(rel) {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, "data", rel), "utf-8")); }
  catch { return null; }
}
const MENU = readJSON("menu.json") || { items: [], brands: [] };
const BRANCHES = readJSON("branches.json") || [];

// parse "205/55 R16" (допускает пробелы и разные регистры)
function parseSize(text) {
  const t = (text||"").toLowerCase().replace(",",".");
  const re = /(\d{3})\s*[\/x]\s*(\d{2})\s*(?:r\s*)?(\d{2})/i;
  const m = t.match(re);
  if (m) return { w:+m[1], a:+m[2], r:+m[3] };
  // fallback: "205 55 16"
  const m2 = t.match(/\b(\d{3})\s+(\d{2})\s+(\d{2})\b/);
  if (m2) return { w:+m2[1], a:+m2[2], r:+m2[3] };
  return null;
}

function parseSeason(text) {
  const t = (text||"").toLowerCase();
  if (t.includes("лет")) return "summer";
  if (t.includes("зим")) return "winter";
  if (t.includes("всесез")) return "allseason";
  return null;
}
function parseFlags(text){
  const t = (text||"").toLowerCase();
  return {
    studded: /шип/.test(t),
    runflat: /runflat|ранфлат/.test(t)
  };
}
function findBrands(text){
  const t = (text||"").toLowerCase();
  const brands = Array.isArray(MENU.brands)? MENU.brands : [];
  const found = brands.filter(b => t.includes(String(b).toLowerCase()));
  return found;
}

function stockSum(it){
  try { return (it.stock||[]).reduce((s,a)=> s + Number(a.qty||0), 0); } catch { return 0; }
}

function pickItems(q){
  const items = Array.isArray(MENU.items) ? MENU.items : [];
  const out = [];

  // нормализуем желаемый размер
  const want = q.size ? {w:+q.size.w, a:+q.size.a, r:+q.size.r} : null;

  for (const it of items){
    let score = 0;

    // --- 1) Размер: точное совпадение или близкие ---
    const sz = it.size || {};
    if (want){
      const dw = Math.abs((+sz.width)  - want.w);
      const da = Math.abs((+sz.aspect) - want.a);
      const dr = Math.abs((+sz.rim)    - want.r);
      if (dw===0 && da===0 && dr===0) score += 6;           // идеально
      else if (dw===0 && da===0 && dr<=1) score += 4;       // диск ±1
      else if (dw<=10 && da<=5 && dr<=1) score += 2;        // близко по габаритам
      else if (dw<=10 && da<=10) score += 1;                // примерно
      else score -= 2;                                      // далековато
    }

    // --- 2) Сезон/флаги ---
    if (q.season){ if (it.season === q.season) score += 2; else score -= 1; }
    if (q.flags?.studded){ score += it.studded ? 1 : -1; }
    if (q.flags?.runflat){ score += it.runflat ? 1 : -1; }

    // --- 3) Бренды ---
    if (q.brands?.length){
      if (q.brands.includes(it.brand)) score += 2;
      else score -= 1;
    }

    // --- 4) Текстовая близость по названию (бренд/модель) ---
    const hay = `${(it.brand||"")} ${(it.title||"")}`.toLowerCase();
    for (const kw of (q.keywords||[])){
      if (hay.includes(kw)) score += 0.8;
    }

    // --- 5) Приоритет по наличию и цене ---
    score += stockSum(it) > 0 ? 1 : -2;
    if (typeof it.price === "number") score += 0.2 * (1/Math.log10(10 + it.price)); // чуть тянем дешевле

    if (score > -3) out.push({ it, score });
  }

  // Если совсем пусто — отдаём ТОП по бренду/сезону/наличию
  if (!out.length){
    for (const it of items){
      let s = 0;
      if (q.season && it.season === q.season) s += 1;
      if (q.brands?.includes(it.brand)) s += 1;
      s += stockSum(it) > 0 ? 1 : 0;
      out.push({ it, score: s });
    }
  }

  out.sort((a,b)=> b.score - a.score);
  return out.slice(0,5).map(x=>x.it);
}

function findBranches(text){
  const t = (text||"").toLowerCase();
  const list = Array.isArray(BRANCHES)? BRANCHES : [];
  // ищем по названию/адресу
  const hits = list.filter(b => {
    const s = `${b.name} ${b.address}`.toLowerCase();
    // если упомянули город (алматы/астана/шымкент и т.п.)
    return t.split(/\s+/).some(w => w.length>3 && s.includes(w));
  });
  return (hits.length ? hits : list).slice(0,3);
}

function formatItems(items){
  if (!items.length) return "Ничего не нашёл по запросу — откройте мини-апп и примените фильтры (сезон/бренд/размер).";
  return items.map(it=>{
    const sz = it.size ? `${it.size.width}/${it.size.aspect} R${it.size.rim}` : "";
    const tags = [it.season==='summer'?'летние': it.season==='winter'?'зимние':'всесезон', it.studded?'шипы':'', it.runflat?'runflat':''].filter(Boolean).join(", ");
    return `• ${it.brand} ${it.title} ${sz} — €${Number(it.price||0).toFixed(2)} (${tags}; в наличии: ${stockSum(it)})`;
  }).join("\n");
}

function ruleAssistant({ text, siteUrl }){
  const size = parseSize(text);
  const season = parseSeason(text);
  const flags = parseFlags(text);
  const brands = findBrands(text);
  const tokens = (text||"")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(t => t && t.length>2);

  const top = pickItems({ size, season, flags, brands, keywords: tokens });

  const header = [
    size ? `Размер: ${size.w}/${size.a} R${size.r}` : null,
    season ? `Сезон: ${season}` : null,
    brands && brands.length ? `Бренд: ${brands.join(", ")}` : null,
    flags.studded ? "Шипы" : null,
    flags.runflat ? "RunFlat" : null
  ].filter(Boolean).join(" • ");

  const itemsText = formatItems(top);

  // филиалы — только если вопрос про "где / адрес / телефон / купить"
  let branchesText = "";
  if (/\b(где|адрес|тел|купить|офис|магазин|филиал)\b/i.test(text)){
    const bb = findBranches(text);
    branchesText = "\n\nФилиалы:\n" + bb.map(b=>`• ${b.name}: ${b.address} — ${b.phone}`).join("\n");
  }

  const tail = `\n\nОткрыть магазин в Telegram: ${botLinkStart('shop')}`;
  return (header ? `Запрос: ${header}\n` : "") + itemsText + branchesText + tail;
}

const BOT_USERNAME = process.env.BOT_USERNAME || "";
function botLinkStart(param = "shop") {
  return BOT_USERNAME
    ? `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(param)}`
    : (process.env.SITE_URL || "");
}
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 200, body: JSON.stringify({ ok:true }) };

    const update = event.body ? JSON.parse(event.body) : {};
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const SITE_URL = process.env.SITE_URL || "";

    async function tg(method, payload){
      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload)
      });
      return r.json();
    }

    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = (msg.text || "").trim();

      // /start и /start <param>
      if (text.startsWith("/start")) {
        const startText =
          "Aikos Tires — мини-магазин в Telegram.\n" +
          "• Каталог, фильтры, корзина\n" +
          "• Доставка и трекинг\n" +
          "• Отзывы на площадках\n\n" +
          "Нужна помощь? /ask летние 205/55 R16 michelin";

        const reply_markup = {
          inline_keyboard: [
            [{ text: "Открыть магазин шин", web_app: { url: SITE_URL || "https://example.com" } }],
            [{ text: "Открыть чат с ботом", url: botLinkStart("shop") }]
          ]
        };

        await tg("sendMessage", { chat_id: chatId, text: startText, reply_markup });
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      // /ask — rule-assistant (без ИИ)
      if (text.startsWith("/ask")) {
        const q = text.replace(/^\/ask\s*/i, "").trim();
        if (!q) {
          await tg("sendMessage", { chat_id: chatId, text: "Напишите так: /ask летние шины 205/55 R16 michelin" });
        } else {
          await tg("sendChatAction", { chat_id: chatId, action: "typing" });
          const ans = ruleAssistant({ text: q, siteUrl: SITE_URL || "" });
          await tg("sendMessage", { chat_id: chatId, text: ans, disable_web_page_preview: true });
        }
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }
    }

    return { statusCode: 200, body: JSON.stringify({ ok:true }) };
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ ok:false, error:e.message }) };
  }
};
