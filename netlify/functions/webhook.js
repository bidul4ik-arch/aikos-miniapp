
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
  const res = [];
  for (const it of items){
    let score = 0;

    // размер
    if (q.size){
      const sz = it.size||{};
      if (sz.width==q.size.w && sz.aspect==q.size.a && sz.rim==q.size.r) score += 3;
      else if (sz.width==q.size.w && sz.aspect==q.size.a) score += 2;
      else if (sz.width==q.size.w) score += 1;
    }
    // сезон
    if (q.season){ if (it.season===q.season) score += 2; }
    // шипы/ранфлат
    if (q.flags.studded){ if (it.studded) score += 1; else score -= 1; }
    if (q.flags.runflat){ if (it.runflat) score += 1; else score -= 1; }
    // бренд
    if (q.brands && q.brands.length){
      if (q.brands.includes(it.brand)) score += 2;
    }

    // базовый приоритет — наличие и цена
    score += Math.min(2, stockSum(it)>0 ? 1 : -1);
    if (typeof it.price === "number") score += 0.001 * (10000/Math.max(1,it.price)); // лёгкий перекос к дешевле

    if (score > -1) res.push({ it, score });
  }
  res.sort((a,b)=> b.score - a.score);
  return res.slice(0,5).map(x=>x.it);
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
  if (!items.length) return "Ничего не нашёл по запросу — откройте мини-аппу и примените фильтры (сезон/бренд/размер).";
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

  const top = pickItems({ size, season, flags, brands });
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

  const tail = `\n\nОткрыть каталог: ${siteUrl || ""}`;
  return (header ? `Запрос: ${header}\n` : "") + itemsText + branchesText + tail;
}


exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 200, body: JSON.stringify({ ok:true }) };
    const update = event.body ? JSON.parse(event.body) : {};
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const SITE_URL = process.env.SITE_URL || "";

    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = (msg.text || "").trim();
    
      // /start — только на эту команду показываем приветствие и кнопки
      if (text === "/start") {
        const reply_markup = {
          inline_keyboard: [
            [{ text: "Открыть магазин шин", web_app: { url: SITE_URL || "https://example.com" } }],
            // опционально кнопка на презентацию, если загрузил файл в /public/docs/
            // [{ text: "Презентация (PPTX)", url: `${SITE_URL}/docs/DK_Leading_Roadmap_Pricing_KZ.pptx` }]
          ]
        };
    
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "Добро пожаловать! Откройте мини-аппу, чтобы выбрать шины и оформить заказ.\nЕсть консультант: задайте вопрос командой /ask",
            reply_markup
          })
        });
    
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }
    
      // /ask — ассистент (rule-based). 
      if (text.startsWith("/ask")) {
        const q = text.replace(/^\/ask\s*/i, "").trim();
        if (!q) {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: "Напишите так: /ask какие летние шины 205/55 R16?" })
          });
        } else {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, action: "typing" })
          });
          // ruleAssistant — это функция из вставки, которую мы добавляли выше файла
          const ans = ruleAssistant({ text: q, siteUrl: SITE_URL || "" });
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: ans, disable_web_page_preview: true })
          });
        }
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }
    
      
    }
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ ok:false, error:e.message }) };
  }
};