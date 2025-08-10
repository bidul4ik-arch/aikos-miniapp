const fs = require("fs");
const path = require("path");
const { checkTelegramAuth } = require("./_utils");

exports.handler = async (event) => {
  try {
    const initData = event.headers["telegram-init-data"] || "";
    const BOT_TOKEN = process.env.BOT_TOKEN || "";
    if (!initData || !checkTelegramAuth(initData, BOT_TOKEN)) {
      return { statusCode: 401, body: JSON.stringify({ ok:false, error:"unauthorized" }) };
    }
    const p = path.join(__dirname, "data", "menu.json");
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    return { statusCode: 200, body: JSON.stringify({ ok:true, ...data }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:e.message }) };
  }
};