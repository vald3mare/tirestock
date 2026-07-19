# TireStock — обзор проекта для разработчика

Дата: 19.07.2026. Что сделано: фундамент монорепо + все страницы витрины по макету Figma
на мок-данных, два аудита (Web Interface Guidelines + React best practices от Vercel)
с исправлениями, адаптив. Ниже — как всё устроено, где что лежит и что помечено TODO.

Смежные документы: `CONVENTIONS.md` (правила кода — читать первым), `DESIGN_SYSTEM.md`
(токены и спеки компонентов), `ARCHITECTURE.md` (карта системы и открытые вопросы),
корневой `README.md` (команды запуска).

---

## 1. Общая картина

```
web (Next.js, :3000)  ──HTTP──▶  api (Go, :8080)  ──pgx──▶  postgres (:5432)
        │                              │
        │ типизированный клиент        │ мок-источники (in-memory):
        │ из openapi.yaml              │   CatalogSource  → 12 шин
        └── SSR всех страниц           │   OrderDelivery  → лог вместо tradesk
                                       └── outbox-воркер (горутина, ретраи)
```

Принципы (из CONVENTIONS.md, здесь кратко):
- **Server-first.** Все страницы — Server Components; `"use client"` только у листовых
  интерактивных компонентов (дропдаун, степпер, табы, фильтр).
- **Состояние фильтров/пагинации — в URL**, не в useState (шарибельные ссылки, SEO).
- **Данные ходят только через `web/lib/api`** — никаких fetch в компонентах.
- **Интерфейсы у потребителя:** `catalog.CatalogSource` и `orders.OrderDelivery` —
  единственные два интерфейса; реальные адаптеры SelectTyres/tradesk подменят моки
  без переписывания страниц.
- **Заказ никогда не теряется:** запись заказа и строки outbox — одна транзакция;
  доставка — отдельным воркером с ретраями.

---

## 2. api/ — Go-сервис

Один процесс: HTTP API + фоновый outbox-воркер. Точка входа `cmd/api/main.go`:
читает env (`DATABASE_URL`, `API_ADDR`), гонит миграции, собирает зависимости,
поднимает chi-роутер и воркер, graceful shutdown по SIGINT/SIGTERM.

### Пакеты (фича = пакет, без слоёв)

| Пакет | Что делает |
|---|---|
| `internal/catalog` | Модель `Product`, фильтры, `CatalogSource`, сервис, хендлеры `GET /products`, `GET /products/{slug}` |
| `internal/orders` | `CreateOrder`/`CreateCallback`, outbox, воркер, `OrderDelivery`, хендлеры `POST /orders`, `POST /callbacks` |
| `internal/integrations/mock` | Мок-каталог (12 шин, in-memory) и мок-доставка (лог + память для тестов) |
| `internal/httpx` | Единый формат ошибок `{"error":{"code","message"}}`, JSON-хелперы |
| `internal/db` | pgx-пул, миграции (golang-migrate, embed), sqlc-генерация |
| `internal/content` | Пусто — задел под контентную админку |

### Каталог и фильтры — `internal/catalog`

- `filters.go` — ядро фичи. `ParseFilters(url.Values)` разбирает query-параметры
  (width, profile, diameter, season, brand, price_min, price_max, spikes, runflat,
  page, per_page; имена совпадают с URL витрины 1:1) с валидацией → 400.
  У `Filters` два потребителя-метода с одинаковой семантикой:
  - `WhereSQL(startArg)` — WHERE-условие + args для будущего источника на синк-БД;
  - `Match(Product)` — фильтрация в памяти, используется мок-источником.
- `CatalogSource` (интерфейс): `List(ctx, filters, page, perPage) (items, total, err)`
  и `BySlug(ctx, slug)`. Сейчас единственная реализация — `mock.CatalogSource`
  (сортировка по цене, пагинация срезом). Когда появится синк из SelectTyres —
  вторая реализация поверх таблицы `products` (она уже есть в БД, пустая).

### Заказы и outbox — `internal/orders`

- `CreateOrder`: валидация → проверка `idempotency_key` (повтор вернёт существующий
  id — защита от даблклика) → в одной транзакции INSERT в `orders` + INSERT в `outbox`
  (kind=`order`, payload=JSON заказа).
- `CreateCallback`: заявка «обратный звонок» → строка outbox (kind=`callback`).
- `worker.go`: тикер (5с) → `ProcessOnce`: транзакция, `SELECT … FOR UPDATE SKIP LOCKED`
  батчами, для каждой записи `delivery.Deliver(...)`:
  - успех → `status=delivered`;
  - ошибка → `attempts+1`, `next_retry_at = now + BaseDelay·2^attempts` (экспонента);
  - `attempts ≥ MaxAttempts` (8) → `status=failed` — такие записи увидит админка
    с кнопкой «повторить» (TODO).
  SKIP LOCKED делает воркер безопасным при нескольких экземплярах.
- Цены позиций заказа пока приходят с клиента (мок-этап) — сверка с каталогом
  помечена TODO в `orders.go`.

### БД

- Миграции: `internal/db/migrations/0001_init.{up,down}.sql` — таблицы `products`
  (read-модель, пока пустая), `orders`, `outbox` (+частичный индекс по pending).
  Применяются автоматически при старте api. Схему менять ТОЛЬКО миграциями.
- SQL: `internal/orders/queries.sql` → sqlc генерит `internal/db/{queries.sql.go,
  sqlc_models.go, sqlc_db.go}` (коммитятся). Регенерация: `sqlc generate` в `api/`
  (бинарник v1.30.0 лежит в `~/.local/bin`; `go run sqlc@latest` не делать — компилится
  минутами).
- golang-migrate использует драйвер pgx5 — в `db.go` схема URL подменяется
  `postgres://` → `pgx5://`.

### Контракт

`api/openapi.yaml` — источник истины. Любое изменение API: сначала спека → код →
`npm run gen:api` в web (генерит `web/lib/api/schema.d.ts`). Эндпоинты:
`GET /api/v1/health`, `GET /api/v1/products`, `GET /api/v1/products/{slug}`,
`POST /api/v1/orders` (Idempotency-Key), `POST /api/v1/callbacks`.

### Тесты (`TEST_DATABASE_URL` обязателен для интеграционных, иначе skip)

- `catalog/filters_test.go` — маппинг URL→SQL, пагинация, валидация (юнит).
- `orders/worker_test.go` — против реального Postgres: доставка pending→delivered,
  идемпотентность заказа, ретраи с экспонентой и failed после N, уважение
  `next_retry_at`, конкурентные воркеры без дублей (SKIP LOCKED).

---

## 3. web/ — Next.js витрина

App Router, TypeScript strict, Tailwind v4 (конфиг через CSS `@theme`, без JS-конфига).

### Токены — `styles/`

- `tokens.css` — ЕДИНСТВЕННОЕ место значений дизайна: палитра (`--color-blue #2F5FD0`
  и др.), типографическая шкала (`text-h1` … `text-legal` — размер+межстрочный+вес
  одним классом), радиусы (`rounded-badge|chip|field|card|card-lg|container`),
  тень `shadow-dropdown`, сетка (`w-col` 264px, `max-w-content` 1104px, `min-h-touch`
  44px, `min-h-card-title` 45px). В компонентах сырых hex/px быть не должно —
  при ревью это первое, что проверять.
- `fonts.css` — Manrope self-hosted (`public/fonts/*.woff2`, латиница+кириллица,
  веса 500/600/800), `font-display: swap`; preload — в `app/layout.tsx`.
- `globals.css` — сброс, `:focus-visible` (outline только с клавиатуры),
  `prefers-reduced-motion`, утилита `tnum` (tabular-nums для цен/количеств).

### UI-кит — `components/ui/` (тупые компоненты: пропсы → разметка)

| Компонент | Клиентский? | Заметки |
|---|---|---|
| `Button` | нет | primary/secondary, size md/sm (sm — CTA карточки) |
| `Field` | нет | инпут 52px, опциональный label |
| `Dropdown` | **да** | кастомный listbox: Enter/Escape, aria-expanded, клик-вне, hover-мостик (pt-1 между кнопкой и панелью) |
| `Tab` | нет | active = синий фон |
| `Chip` | нет | тач-таргет добит невидимым ::after до 44px |
| `SeasonBadge` | нет | лето/зима(+шипы/липучка)/всесезонка, инлайн-SVG иконки |
| `Checkbox` | нет | 20×20, кастомная галочка, label обязателен |
| `Stepper` | **да** | дефолт 4 (шины комплектами), aria-label на кнопках, inputmode=numeric |

Демо всего кита — `/dev/ui` (noindex), там же шкала типографики и палитра —
удобно сверять с Figma.

### Адаптив

Десктоп верстается 1:1 по макету (контейнер 1104, колонка 264); мобильных фреймов
в Figma НЕТ, поэтому <1024px — прагматичная перестройка без макета:
- Сетки товаров: 2 колонки (4 на lg), каталог 1/2/3; карточка `w-full`,
  фото по аспекту 232:172 — ничего не наезжает при сжатии.
- Виджет поиска: поля 1/2 колонки, CTA на всю ширину; фильтр каталога встаёт
  над сеткой (`flex-col-reverse`); страницы товар/корзина/хранение — в столбик.
- Header: часы скрыты на <md, нав скрыт на <lg — **мобильное меню-бургер TODO
  (нужен макет)**. Футер 1/2/4 колонки.
- H1 42 → 28 на мобиле (`text-h2 lg:text-h1`).

### Аудиты (пройдены, находки исправлены)

- **Vercel Web Interface Guidelines** (`.agents/skills/web-design-guidelines`):
  skip-link + `id="main"`, `width/height` у всех `<img>`, `loading="lazy"` у карточек,
  `autocomplete/inputmode` в формах, `touch-action: manipulation`, `theme-color`.
- **Vercel React best practices**: `React.cache()` вокруг `loadProduct`
  (generateMetadata + страница = один запрос); дубли стилей кнопок → `buttonStyles.ts`
  + `ButtonLink`; списки опций фильтров → `lib/catalog-options.ts`; Stepper —
  корректный controlled/uncontrolled; role="option" на кнопках Dropdown.

### Блоки — `components/blocks/` (составные, данные пропсами)

- `Header` — топбар + sticky основная строка. Ассеты из Figma в `public/icons`,
  `public/images/logo.png`. TODO: выпадающие панели навигации (фрейм 35:234 в Figma).
- `Footer` — 4 колонки, `tel:`/`mailto:`, дисклеймер.
- `SearchWidget` (client) — hero-поиск: 3 таба (по размеру / по авто-заглушка /
  по каталогу), чипы «Популярно» заполняют дропдауны, submit → router.push
  `/catalog?width=…`. ЕДИНЫЙ источник опций размеров пока продублирован
  с FilterSidebar — кандидат на вынос в общий модуль при рефакторинге.
- `FilterSidebar` (client) — те же фильтры вертикально + Производитель, цена от/до,
  чекбоксы; init из useSearchParams, «Показать N шин» (N приходит с сервера пропсом,
  живое число до применения — TODO), «Сбросить».
- `ProductCard` — карточка 264 строго по DESIGN_SYSTEM (clamp-2 с резервом 45px,
  tabular-nums). TODO: состояние «нет в наличии» (дизайна ещё нет).
- `AddToCart` (client) — степпер + живая сумма комплекта. Кнопка пока без действия.
- `BenefitsBar`, `ServicesSection`, `Breadcrumbs` — статические серверные.

### Страницы — `app/`

| Роут | Тип | Данные |
|---|---|---|
| `/` | server | `listProducts({per_page: 8})`; секции hero+поиск, преимущества, услуги, товары |
| `/catalog` | server, dynamic | фильтры из `searchParams` → `listProducts`; empty state; «Показать ещё» = ссылка `?page=N+1` |
| `/catalog/[slug]` | server, dynamic | `getProductBySlug` (404 → notFound), характеристики/описание из данных, похожие по сезону; `generateMetadata` |
| `/cart` | server | **вёрстка на демо-составе** (первые 2 товара из API). Настоящая корзина (cookie + серверное чтение, undo-удаление) — TODO |
| `/services/storage` | server | статика + **рабочая форма заявки**: server action `actions.ts` → `createCallback` → outbox. Результат через `?sent=1`/`?error=…` |
| `/dev/ui` | server+client | демо UI-кита, noindex |

### Слой API — `lib/`

- `lib/api/schema.d.ts` — сгенерирован из openapi.yaml (`npm run gen:api`), руками
  не править.
- `lib/api/client.ts` — типизированный fetch-клиент (`API_URL`, дефолт
  localhost:8080; в docker — `http://host.docker.internal:8080` через override).
  `ApiError` с кодом/статусом. Все страницы ходят только сюда.
- `lib/format.ts` — `formatPrice`/`formatNumber` (Intl ru-RU), `seasonLabel`.
- `lib/catalog-options.ts` — единый источник опций фильтров (ширины/сезоны/бренды,
  парсер «205/55 R16») для SearchWidget и FilterSidebar.
- `lib/tire-indices.ts` — таблица ETRTO: «94T» → «Индекс нагрузки 94 (до 670 кг)»
  для страницы товара.

### Граф знаний (graphify)

`graphify-out/graph.json` — граф проекта (~230 узлов: AST кода + концепты из доков).
Секция `## graphify` в CLAUDE.md заставляет Claude Code сверяться с графом до чтения
файлов (~2.3k токенов на вопрос вместо ~31k). Обновление: git-хук после коммита
(код, бесплатно) или `/graphify <path> --update` (доки, один LLM-субагент).
Сохранённые ответы — `graphify-out/memory/`.

---

## 4. deploy/

- `docker-compose.yml` — postgres 16 (healthcheck) → api (multi-stage golang→alpine,
  миграции на старте, healthcheck по /health) → web (multi-stage node, Next standalone).
  Env — из `deploy/.env` (скопировать из `.env.example`).
- `docker-compose.hostnet-workaround.yml` — **особенность текущей dev-машины**:
  firewall блокирует контейнер↔контейнер трафик, поэтому сервисы ходят друг к другу
  через published-порты хоста (`host.docker.internal`). На нормальном VPS не нужен.
  Запуск с ним: `docker compose -f deploy/docker-compose.yml -f
  deploy/docker-compose.hostnet-workaround.yml --env-file deploy/.env up -d --build`.
- Docker Hub на этой машине медленный — образы тянуть через зеркало:
  `docker pull dockerhub.timeweb.cloud/library/<image>` + `docker tag`.

---

## 5. Карта TODO (помечены в коде комментариями `TODO:`)

**Продукт:**
- Корзина: cookie + серверное чтение, добавление из карточек (qty=4), undo-снекбар.
- Checkout: макета нет; «Оформить заказ» → `POST /orders` уже готов на бэке.
- Дропдауны навигации (Шины/Диски/Сервис) — фрейм `Dropdown_open` 35:234.
- Таб «По авто» — ждёт базу подбора SelectTyres (разведка).
- Живое число «Показать N шин» до применения фильтра.
- Текстовый поиск (`?q=`) — в API нет, виджет параметр шлёт, каталог игнорирует.
- Сортировка каталога — в API нет, дропдаун-заглушка.
- Фото товаров — у всех плейсхолдер `public/images/tire-placeholder.png`;
  реальные придут из SelectTyres (поле в API ещё не заведено).
- Состояние «нет в наличии» карточки; страницы Диски, Пункты выдачи, текстовые.

**Интеграции (см. ARCHITECTURE.md → открытые вопросы):**
- Реальные адаптеры `selecttyres/` и `tradesk/` в `integrations/` — после разведки.
- Синк каталога в таблицу `products` + переключение `CatalogSource` на БД.
- Мультигород: ~60 поддоменов старого сайта — механика не выяснена, middleware
  ещё не писали.

**Данные, требующие уточнения у клиента:** цены хранения (в макете плейсхолдеры),
актуальный адрес (Зотовский пр. 11 vs Бехтерева 2И), «Что с моим заказом?».

---

## 6. Быстрый старт ревью

```bash
# всё разом (с обходом firewall этой машины):
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.hostnet-workaround.yml \
  --env-file deploy/.env up -d --build
# → http://localhost:3000 (+ /catalog, /cart, /services/storage, /dev/ui)

# тесты api:
docker compose -f deploy/docker-compose.yml up -d postgres
cd api && go vet ./... && \
TEST_DATABASE_URL='postgres://tirestock:tirestock@localhost:5432/tirestock?sslmode=disable' go test ./...

# web:
cd web && npm run typecheck && npm run build
```

Смоук заказа: `POST :8080/api/v1/orders` с Idempotency-Key → через ~5с строка в
`outbox` станет `delivered` (лог api: «mock delivery: доставлено»).
