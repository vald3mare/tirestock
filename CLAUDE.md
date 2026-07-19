# TireStock — редизайн интернет-магазина шин (tirestock.ru)

Контекст для Claude Code. Детали: `docs/DESIGN_SYSTEM.md`, `docs/ARCHITECTURE.md`.

## Что это за проект
Новая витрина для действующего магазина шин/дисков в СПб (заказчик — Виталий, владелец).
Старый сайт — Битрикс, ~4000 посетителей/день из органики. Новый сайт верстается по готовому
макету в Figma и запускается СНАЧАЛА НА ТЕСТОВОМ ДОМЕНЕ параллельно со старым.

## Стек (зафиксирован — не менять без обсуждения)
- **Витрина: Next.js App Router + TypeScript, server-first.** Server Components по умолчанию,
  HTML рендерится на сервере (SEO). Клиентский JS ("use client") только для интерактива:
  табы поиска, степпер, корзина, дропдауны. Никаких клиентских стейт-менеджеров.
  Стили: Tailwind поверх токенов из DESIGN_SYSTEM.md. Middleware — городские поддомены.
  `generateMetadata` — SEO-мета из админки. Админка — страницы в том же Next за авторизацией.
- **Бэкенд: Go, один сервис** (API + фоновые контуры в одном процессе).
  Роутер: `net/http` (Go 1.22+) или `chi`. БД: `pgx` + `sqlc` (сырой SQL, без ORM).
  Миграции: `golang-migrate`. Фон: горутины + `time.Ticker` / `robfig/cron`
  (синк каталога, воркер доставки заказов). Логи: `slog`.
  Структура: плоские пакеты по фичам, БЕЗ слоёв repository/service/handler ради архитектуры.
- **PostgreSQL — один на всё:** read-модель каталога, заказы + outbox-очередь, контент
  админки, кэш. Redis НЕ используем без доказанной необходимости.
- **Контракты:** OpenAPI-спека из Go → генерация TS-типов для Next
  (`oapi-codegen` / `openapi-typescript`) в CI.
- **Инфра:** Docker Compose (next, api, postgres, nginx/traefik), VPS в РФ.
  Тестовый домен = тот же compose с другим env + ОБЯЗАТЕЛЬНО robots.txt Disallow и noindex.
- Осознанно НЕ используем: SPA/Vite-шаблоны, NestJS/BullMQ, Redis, PHP, serverless,
  отдельный фреймворк для админки.

## Жёсткие ограничения (нарушать нельзя)
1. **SEO — священная корова.** Структура URL проиндексированных страниц старого сайта
   наследуется 1:1 (или 301 на каждую). Ничего не выдумывать — сверяться со старым сайтом.
2. **Ядро бизнеса не трогаем.** Учётная система tradesk.ru (Yii2, самопись) и источник
   товаров SelectTyres остаются. Новый сайт — только витрина + контентная админка.
3. **Границы истины данных:**
   - товары/цены/остатки → SelectTyres (у нас read-модель, в админке read-only + оверрайды)
   - заказы/клиенты/хранение/возвраты → tradesk (мы только отправляем заказ)
   - контент витрины (тексты, баннеры, SEO-мета) → наша админка
4. Формы «обратный звонок» и «заявка» с сайта тоже должны попадать в tradesk (там есть разделы).
5. **Заказ никогда не теряется:** оформление пишет заказ в свою БД (outbox), отдельный
   воркер с ретраями доставляет его в tradesk; недоставленные видны в админке с «повторить».

## Дизайн
- Figma file key: `OgPQsbsSrM4rLklgkdtaLO` (страницы: Desktop, Каталог, Товар, Корзина,
  Услуга; состояния поиска 1–4; демо дропдауна; библиотека 🧩 Components).
- Все токены и правила — в `docs/DESIGN_SYSTEM.md`. Не изобретать значения — брать оттуда.
- Аудитория 45+: крупные шрифты, всё подписано, телефон всегда виден, никакого декора.

## Функциональные особенности (не потерять при вёрстке)
- Поиск в hero = фильтр каталога (один компонент, два контекста; выбранные параметры
  переносятся в каталог через URL query params).
- Три режима поиска: по размеру / по авто / по каталогу (текстовый). Кнопка с живым
  числом: «Показать N шин».
- Количество в карточке товара по умолчанию = 4 (шины покупают комплектами).
- Города: ~60 поддоменов на старом сайте — уточнить механику до вёрстки мультигорода.

## Чеклист качества (из Web Interface Guidelines, применять ко всему коду)
- Фильтры/табы/пагинация — в URL query params; товар = отдельный URL
- Цены и количества — `font-variant-numeric: tabular-nums`
- Названия товаров — line-clamp: 2 с зарезервированной высотой (ряды карточек не пляшут)
- Контраст AA: акцентный синий строго #2F5FD0 (не светлее!)
- Тач-таргеты ≥44px; фокус только через :focus-visible, никогда outline:none без замены
- Удаление из корзины — undo-снекбар, не мгновенно и не confirm()
- Дропдауны: Enter/Escape, aria-expanded, hover-мостик к панели
- prefers-reduced-motion; не использовать transition: all
- Manrope: preload + font-display: swap
- Плейсхолдеры — с примером и многоточием «…», не инструкция
- tel:/mailto: ссылки на телефон и почту (телефон в шапке и футере)

## Статус интеграций (см. ARCHITECTURE.md → открытые вопросы)
Механизм SelectTyres→сайт и сайт→tradesk ещё в разведке. Витрина строится на моках:
слой данных за интерфейсами-адаптерами (`CatalogSource`, `OrderDelivery`), чтобы источник
(мок → синк-база → реальные адаптеры) подменялся без переписывания страниц.
Не хардкодить товары в компоненты.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
