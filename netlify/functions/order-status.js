const { checkTelegramAuth } = require("./_utils");
exports.handler = async (event) => {
  try {
    const initData = event.headers["telegram-init-data"] || "";
    const BOT_TOKEN = process.env.BOT_TOKEN || "";
    if (!initData || !checkTelegramAuth(initData, BOT_TOKEN)) {
      return { statusCode: 401, body: JSON.stringify({ ok:false, error:"unauthorized" }) };
    }
    const id = (event.queryStringParameters && event.queryStringParameters.id) || "ORD-unknown";
    const statuses = ["accepted","processing","on_the_way","delivered"];
    const idx = Math.floor((Date.now()/30000) % statuses.length);
    return { statusCode: 200, body: JSON.stringify({ ok:true, orderId:id, status:statuses[idx], eta:"Сегодня 18:00" }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:e.message }) };
  }
};