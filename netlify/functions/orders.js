const { checkTelegramAuth } = require("./_utils");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

    const initData = event.headers["telegram-init-data"] || "";
    const BOT_TOKEN = process.env.BOT_TOKEN || "";
    if (!initData || !checkTelegramAuth(initData, BOT_TOKEN)) {
      return { statusCode: 401, body: JSON.stringify({ ok:false, error:"unauthorized" }) };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const { items=[], vatMode="with" } = body;
    if (!Array.isArray(items) || !items.length) {
      return { statusCode: 400, body: JSON.stringify({ ok:false, error:"empty_items" }) };
    }

    const id = "ORD-" + Date.now();
    const subtotal = items.reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0);
    const vat = vatMode === "with" ? subtotal * 0.12 : 0;
    const total = subtotal + vat;

    return { statusCode: 200, body: JSON.stringify({ ok:true, orderId:id, subtotal, vat, total }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:e.message }) };
  }
};