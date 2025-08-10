# Telegram Mini App — Tire Shop (MVP)

Готовая мини-аппа: каталог шин + отзывы + отслеживание доставки.

## Что входит
- Express-сервер, статика из `/public`
- Проверка `Telegram-Init-Data` на API
- API:
  - `GET /api/menu` — ассортимент и фильтры
  - `GET /api/branches` — филиалы (Казахстан, демо)
  - `GET /api/reviews/links` — кнопки на площадки отзывов (Google, Яндекс, 2ГИС, Trustpilot, Facebook, Instagram)
  - `POST /api/orders` — оформить заказ
  - `GET /api/orders/:id` — статус заказа (мок)
- Вебхук бота `POST /webhook/<BOT_TOKEN>` — присылает кнопку открытия мини-аппы

## Быстрый старт
1. `.env`:
   ```env
   BOT_TOKEN=123456:ABC...
   WEBHOOK_URL=https://<ваш-публичный-домен>
   PORT=3000
   ```
2. Установка и запуск:
   ```bash
   npm install
   npm run dev
   ```
3. Публичный доступ (например, ngrok) и вебхук:
   ```bash
   ngrok http 3000
   export WEBHOOK_URL=https://<адрес-ngrok>
   npm run set:webhook
   ```
4. Напишите боту — получите кнопку «Открыть магазин шин».

> Для оплаты, поиска по авто и реального статуса — подключите свои источники.
