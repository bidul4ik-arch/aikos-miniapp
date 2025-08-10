
# Netlify Deploy Pack — Telegram Mini App (Tires)

## Что внутри
- `netlify.toml` — публикация `/public`, редиректы `/api/*` → функции и `/webhook` → функция вебхука.
- `netlify/functions/*` — серверлес эндпоинты:
  - `menu` — GET ассортимент (требует Telegram initData)
  - `branches` — GET филиалы
  - `reviews` — GET кнопки отзывов
  - `orders` — POST оформить заказ (демо-расчёт НДС)
  - `order-status` — GET статус заказа (?id=...)
  - `webhook` — Telegram webhook (шлёт кнопку "Открыть магазин шин")

> JSON-файлы `menu.json`, `branches.json`, `reviews.json` подключаются через `included_files` и читаются функциями из корня.

## Как задеплоить на Netlify (5 шагов)
1) Скопируйте эту папку в корень проекта, чтобы рядом были `public/`, `menu.json`, `branches.json`, `reviews.json`, `netlify.toml`, `netlify/functions/`.
2) Залейте репозиторий на GitHub/GitLab/Bitbucket и подключите на https://app.netlify.com/ (Site settings: Publish dir = `public`).
3) В Netlify → **Site settings → Environment variables** добавьте:
   - `BOT_TOKEN` = токен вашего бота
   - `SITE_URL` = ваш URL сайта в Netlify (например, `https://my-shop.netlify.app`)
4) После деплоя установите вебхук для бота (замените `<BOT_TOKEN>` и `<SITE_URL>`):
   ```bash
   curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook"      -H "Content-Type: application/json"      -d '{"url":"<SITE_URL>/webhook"}'
   ```
5) Откройте чат с ботом, напишите /start — придёт кнопка **Открыть магазин шин**.

## Примечания
- Память функций Netlify не сохраняется между вызовами — заказы в демо не хранятся.
- Если `/api/menu` отдаёт 401 в браузере — это норма: initData приходит только из Telegram.
