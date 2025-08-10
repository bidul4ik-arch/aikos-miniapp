exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 200, body: JSON.stringify({ ok:true }) };
    const update = event.body ? JSON.parse(event.body) : {};
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const SITE_URL = process.env.SITE_URL || "";

    if (update.message) {
      const chatId = update.message.chat.id;
      const reply_markup = { inline_keyboard: [[{ text: "Открыть магазин шин", web_app: { url: SITE_URL || "https://example.com" } }]] };
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "Добро пожаловать! Откройте мини-аппу, чтобы выбрать шины и оформить заказ.", reply_markup })
      });
    }
    return { statusCode: 200, body: JSON.stringify({ ok:true }) };
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ ok:false, error:e.message }) };
  }
};