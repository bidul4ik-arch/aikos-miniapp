const { checkTelegramAuth } = require("./_utils");
const raw = require("./data/menu.json"); // ⬅️ JSON попадёт в бандл

exports.handler = async (event) => {
  try {
    const initData = event.headers["telegram-init-data"] || "";
    const BOT_TOKEN = process.env.BOT_TOKEN || "";
    if (!initData || !checkTelegramAuth(initData, BOT_TOKEN)) {
      return { statusCode: 401, body: JSON.stringify({ ok:false, error:"unauthorized" }) };
    }

    const payload = {
      ok: true,
      categories: Array.isArray(raw.categories) ? raw.categories : [],
      brands: Array.isArray(raw.brands) ? raw.brands : [],
      items:
        Array.isArray(raw.items) ? raw.items :
        (Array.isArray(raw) ? raw : [])
    };
    return { statusCode: 200, body: JSON.stringify(payload) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error: e.message }) };
  }
};
