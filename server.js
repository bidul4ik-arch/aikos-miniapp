import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  BOT_TOKEN,
  WEBHOOK_URL, // e.g. https://your-domain.com
  PORT = 3000
} = process.env;

if (!BOT_TOKEN) {
  console.warn("⚠️ BOT_TOKEN is not set in .env");
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the Mini App (static files)
app.use("/", express.static(path.join(__dirname, "public")));

// Telegram WebApp initData verification
function checkTelegramAuth(initData) {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    urlParams.delete("hash");

    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secret = crypto
      .createHmac("sha256", "WebAppData")
      .update(BOT_TOKEN)
      .digest();
    const hmac = crypto
      .createHmac("sha256", secret)
      .update(dataCheckString)
      .digest("hex");

    return hmac === hash;
  } catch (e) {
    return false;
  }
}
function requireAuth(req, res, next) {
  const initData = req.header("Telegram-Init-Data") || req.body.initData || "";
  if (!initData || !checkTelegramAuth(initData)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

// Simple echo
app.post("/api/echo", (req, res) => {
  const initData = req.header("Telegram-Init-Data") || req.body.initData || "";
  if (!initData || !checkTelegramAuth(initData)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  const params = new URLSearchParams(initData);
  const user = params.get("user") ? JSON.parse(params.get("user")) : null;
  return res.json({ ok: true, echo: req.body, user });
});

// --- Tires shop & reviews API ---
app.get("/api/menu", requireAuth, (req, res) => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "menu.json"), "utf-8"));
  res.json({ ok: true, ...data });
});

app.get("/api/branches", (req, res) => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "branches.json"), "utf-8"));
  res.json({ ok: true, branches: data });
});

app.get("/api/reviews/links", (req, res) => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "reviews.json"), "utf-8"));
  res.json({ ok: true, links: data });
});

let ORDERS = [];
app.post("/api/orders", requireAuth, (req, res) => {
  const { items, contact, branchId, slot, comment, vatMode="with" } = req.body || {};
  if (!items || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ ok: false, error: "empty_items" });
  }
  const id = "ORD-" + Date.now();
  const subtotal = items.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.qty || 0)), 0);
  const vat = vatMode === "with" ? subtotal * 0.12 : 0; // demo VAT 12%
  const total = subtotal + vat;
  const order = { id, items, contact, branchId, slot, comment, subtotal, vat, total, createdAt: new Date().toISOString(), status: "processing" };
  ORDERS.push(order);
  res.json({ ok: true, orderId: id, total, vat, subtotal });
});

// Delivery tracking mock
app.get("/api/orders/:id", requireAuth, (req, res) => {
  const id = req.params.id;
  const o = ORDERS.find(x => x.id === id);
  if (!o) {
    const statuses = ["accepted","processing","on_the_way","delivered"];
    const idx = Math.floor((Date.now()/30000) % statuses.length);
    return res.json({ ok: true, orderId: id, status: statuses[idx], eta: "Сегодня 18:00" });
  }
  res.json({ ok: true, orderId: o.id, status: o.status, total: o.total, eta: "Сегодня 18:00" });
});

// Webhook handler for incoming bot updates
app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  const update = req.body;
  try {
    if (update.message) {
      const chatId = update.message.chat.id;
      const reply_markup = {
        inline_keyboard: [[{ text: "Открыть магазин шин", web_app: { url: `${process.env.WEBHOOK_URL || ""}/` } }]]
      };

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Добро пожаловать! Откройте мини-аппу, чтобы выбрать шины и оформить заказ.`,
          reply_markup
        })
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ ok: false });
  }
});

// Utilities to set/delete webhook quickly
async function setWebhook() {
  if (!WEBHOOK_URL) {
    console.error("WEBHOOK_URL is not set. Example: https://your-domain.com");
    process.exit(1);
  }
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;
  const hook = `${WEBHOOK_URL}/webhook/${BOT_TOKEN}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: hook, allowed_updates: ["message"] })
  });
  const data = await resp.json();
  console.log("setWebhook:", data);
}

async function deleteWebhook() {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`;
  const resp = await fetch(url, { method: "POST" });
  const data = await resp.json();
  console.log("deleteWebhook:", data);
}

// CLI helper
if (process.argv[2] === "set-webhook") {
  setWebhook().then(() => process.exit(0));
} else if (process.argv[2] === "delete-webhook") {
  deleteWebhook().then(() => process.exit(0));
} else {
  app.listen(PORT, () => {
    console.log(`✅ Server on http://localhost:${PORT}`);
  });
}
