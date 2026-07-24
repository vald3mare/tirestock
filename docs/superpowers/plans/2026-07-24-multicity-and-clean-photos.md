# Мультигород (СПб/МСК) + чистые фото — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Каталог отдаёт цену и остаток по выбранному городу (СПб/МСК), город переключается кукой в шапке; основное фото товара берётся чистым (без вотермарка) из Avito-фида SelectTyres.

**Architecture:** Город-независимые атрибуты остаются в `products`, цена/остаток выносятся в новую таблицу `product_offers(product_code, city, price, stock)`. JSON-синкер агрегирует предложения по каждому городу отдельно; отдельный XML-синкер пишет `products.image_clean_url`. Каталог city-aware через `INNER JOIN product_offers`. Next читает куку `city` на сервере и пробрасывает в API.

**Tech Stack:** Go 1.25 (chi, pgx v5, sqlc, golang-migrate, stdlib `encoding/xml`), PostgreSQL, Next.js 15 App Router + TS, openapi-typescript.

## Global Constraints

- Цена = РРЦ: минимальная `recommended_retail_price` среди складов города; фолбэк — минимальная `minimal_internet_price`. Считается **по каждому городу отдельно**.
- Ровно два города: `spb`, `msk`. Дефолт — `spb`. Невалидное значение города → `spb`.
- Товар без предложения в выбранном городе — **скрыт** из выдачи (INNER JOIN), не «под заказ».
- SQL — только сырой pgx + sqlc, без ORM. Пакеты плоские по фичам.
- Секреты (URL фидов с токеном) — только в `deploy/.env` (gitignored), никогда в код/репо.
- Не коммитить/пушить без явной просьбы пользователя (это правило проекта; шаги «Commit» выполняются, но `git push` — нет).
- Данные ходят из Next в Go только через `web/lib/api/client.ts`; типы — из `schema.d.ts` (не править руками, регенерировать).
- Тач-таргеты ≥44px, `:focus-visible`, `prefers-reduced-motion`, `font-variant-numeric: tabular-nums` для цен — уже в глобальных стилях, новые UI-элементы им следуют.
- **graphify-мантра (CLAUDE.md → graphify):** поиск по коду — через graphify, не grep; после изменений кода — `graphify update .` (или полагаться на запущенный `graphify watch`); релевантные спек/MD-файлы (`ARCHITECTURE.md`, `PROJECT_OVERVIEW.md`, `TODO.md`, эта спека/план) держать в актуальном состоянии по мере работы.

---

## Task 1: Миграция 0004 — `image_clean_url` + таблица `product_offers`

**Files:**
- Create: `api/internal/db/migrations/0004_multicity_photos.up.sql`
- Create: `api/internal/db/migrations/0004_multicity_photos.down.sql`

**Interfaces:**
- Produces: колонка `products.image_clean_url TEXT NOT NULL DEFAULT ''`; таблица `product_offers(product_code TEXT, city TEXT, price BIGINT, stock INT, updated_at TIMESTAMPTZ)` PK `(product_code, city)`.

- [ ] **Step 1: Написать up-миграцию**

`api/internal/db/migrations/0004_multicity_photos.up.sql`:
```sql
-- Чистое фото (без вотермарка) из Avito-фида; пусто → фолбэк на products.image_url.
ALTER TABLE products ADD COLUMN image_clean_url TEXT NOT NULL DEFAULT '';

-- Цена и остаток по городу. Нет строки для (code, city) → товара в городе нет.
CREATE TABLE product_offers (
    product_code TEXT        NOT NULL,
    city         TEXT        NOT NULL,
    price        BIGINT      NOT NULL,
    stock        INTEGER     NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (product_code, city)
);
CREATE INDEX product_offers_city_stock_idx ON product_offers (city, stock);
```

- [ ] **Step 2: Написать down-миграцию**

`api/internal/db/migrations/0004_multicity_photos.down.sql`:
```sql
DROP TABLE IF EXISTS product_offers;
ALTER TABLE products DROP COLUMN IF EXISTS image_clean_url;
```

- [ ] **Step 3: Применить миграцию через рестарт api (НЕ руками)**

Миграции накатывает `db.Migrate` при старте api (golang-migrate ведёт `schema_migrations`).
Применять up-файл руками через psql НЕЛЬЗЯ — migrate потом попытается накатить 0004 повторно
и упадёт («relation already exists» / dirty). Правильно — перезапустить api:
```bash
cd /home/valdemar/Desktop/tirestock
docker compose -f deploy/docker-compose.yml up -d postgres
docker compose -f deploy/docker-compose.yml restart api   # если контейнер запущен; иначе up -d api
docker compose -f deploy/docker-compose.yml logs --tail=20 api | grep -i migr
docker compose -f deploy/docker-compose.yml exec -T postgres \
  psql -U tirestock -d tirestock -c "\d product_offers"
```
Expected: в логах миграция 0004 применена без ошибок; таблица `product_offers` с колонками
product_code, city, price, stock, updated_at; PK по (product_code, city).
(Код api ещё старый — это ок, рестарт нужен только чтобы прогнать миграции.)

- [ ] **Step 4: Commit**

```bash
git add api/internal/db/migrations/0004_multicity_photos.up.sql api/internal/db/migrations/0004_multicity_photos.down.sql
git commit -m "feat(db): миграция 0004 — product_offers + image_clean_url"
```

---

## Task 2: sqlc-запросы для offers и чистого фото

**Files:**
- Modify: `api/internal/catalog/queries.sql`
- Regenerate: `api/internal/db/*.sql.go` (через `sqlc generate`)

**Interfaces:**
- Produces (sqlc-сгенерированные методы):
  - `UpsertProductOffer(ctx, UpsertProductOfferParams{ProductCode string, City string, Price int64, Stock int32}) error`
  - `DeleteStaleOffers(ctx, pgtype.Timestamptz) (int64, error)`
  - `UpdateProductImageClean(ctx, UpdateProductImageCleanParams{Code string, ImageCleanUrl string}) (int64, error)`
  - `GetCatalogProductBySlug(ctx, GetCatalogProductBySlugParams{Slug string, City string}) (...)` — теперь с city и колонками из offers.

- [ ] **Step 1: Обновить `UpsertProduct` — убрать price/stock из products (пишем 0), оставить image_url**

В `api/internal/catalog/queries.sql` заменить тело `UpsertProduct` так, чтобы price/stock всегда писались 0 (legacy-колонки; city-путь читает из product_offers). Оставляем колонки в INSERT, но значения приходят как параметры — синк передаёт 0 (правится в Task 3, здесь query не трогаем по сигнатуре). **Этот шаг — no-op для SQL**, `UpsertProduct` остаётся как есть. (Пометка: значения price/stock станут нулями со стороны Go в Task 3.)

- [ ] **Step 2: Добавить запросы offers и фото в `queries.sql`**

Дописать в конец `api/internal/catalog/queries.sql`:
```sql
-- name: UpsertProductOffer :exec
INSERT INTO product_offers (product_code, city, price, stock, updated_at)
VALUES ($1, $2, $3, $4, now())
ON CONFLICT (product_code, city) DO UPDATE SET
    price = EXCLUDED.price,
    stock = EXCLUDED.stock,
    updated_at = now();

-- name: DeleteStaleOffers :execrows
-- Предложения, не обновлённые в текущем прогоне синка (город/товар пропал), удаляем.
DELETE FROM product_offers WHERE updated_at < $1;

-- name: UpdateProductImageClean :execrows
UPDATE products SET image_clean_url = $2 WHERE code = $1 AND code <> '';
```

- [ ] **Step 3: Переписать `GetCatalogProductBySlug` — city + offers + чистое фото**

Заменить блок `GetCatalogProductBySlug` в `queries.sql` на:
```sql
-- name: GetCatalogProductBySlug :one
SELECT
    p.id, p.slug, p.brand, p.model, p.name, p.size_label,
    p.width, p.profile, p.diameter, p.season, p.spikes, p.runflat,
    po.price, po.stock,
    COALESCE(NULLIF(p.image_clean_url, ''), p.image_url) AS image_url,
    COALESCE(o.badge_hit, false) AS badge_hit
FROM products p
JOIN product_offers po ON po.product_code = p.code AND po.city = $2
LEFT JOIN product_overrides o ON o.slug = p.slug
WHERE p.slug = $1 AND COALESCE(o.hidden, false) = false;
```

- [ ] **Step 4: Сгенерировать sqlc**

Run:
```bash
cd /home/valdemar/Desktop/tirestock/api && sqlc generate
```
Expected: без ошибок; в `internal/db` появляются методы `UpsertProductOffer`, `DeleteStaleOffers`, `UpdateProductImageClean`; `GetCatalogProductBySlugParams` теперь `{Slug, City string}`, а `GetCatalogProductBySlugRow.Price/Stock` — из offers (`int64`/`int32`).

- [ ] **Step 5: Проверить компиляцию пакета db**

Run: `cd /home/valdemar/Desktop/tirestock/api && go build ./internal/db/...`
Expected: успешная сборка (пакет catalog пока может не собираться — правим в Task 3/6).

- [ ] **Step 6: Commit**

```bash
git add api/internal/catalog/queries.sql api/internal/db
git commit -m "feat(db): sqlc-запросы product_offers, чистое фото, BySlug по городу"
```

---

## Task 3: `SyncProduct` per-city offers + `SyncStore` пишет offers

**Files:**
- Modify: `api/internal/catalog/catalog.go` (добавить `City`-константы, `CityOffer`)
- Modify: `api/internal/catalog/syncstore.go`
- Test: `api/internal/catalog/syncstore_test.go` (создать — юнит на маппинг параметров без БД не выйдет; вместо этого тест на структуру CityOffer/константы)

**Interfaces:**
- Consumes: `db.UpsertProductOffer`, `db.DeleteStaleOffers` (Task 2).
- Produces:
  - `catalog.CitySPB = "spb"`, `catalog.CityMSK = "msk"`, `catalog.ValidCity(string) bool`, `catalog.AllCities = []string{"spb","msk"}`
  - `catalog.CityOffer{City string, Price int, Stock int}`
  - `catalog.SyncProduct` без `Price/Stock`, с полем `Offers []CityOffer`
  - `SyncStore.Upsert(ctx, SyncProduct) error` (пишет products + offers)
  - `SyncStore.PruneStaleBefore(ctx, time.Time) (int64, error)` (переименован из `ZeroStaleBefore`)

- [ ] **Step 1: Написать тест на константы городов и `ValidCity`**

`api/internal/catalog/catalog_test.go` (создать; если файл есть — дописать):
```go
package catalog

import "testing"

func TestValidCity(t *testing.T) {
	for _, c := range AllCities {
		if !ValidCity(c) {
			t.Errorf("ValidCity(%q) = false, ожидалось true", c)
		}
	}
	if ValidCity("spb ") || ValidCity("") || ValidCity("piter") {
		t.Error("ValidCity пропустил невалидный город")
	}
}
```

- [ ] **Step 2: Запустить тест — падает (нет ValidCity)**

Run: `cd /home/valdemar/Desktop/tirestock/api && go test ./internal/catalog/ -run TestValidCity`
Expected: FAIL — `undefined: ValidCity` / `undefined: AllCities`.

- [ ] **Step 3: Добавить город-константы и `CityOffer` в `catalog.go`**

В `api/internal/catalog/catalog.go` после блока `Season`-констант добавить:
```go
// Города витрины. Ровно два (созвон с Виталием): СПб и МСК.
const (
	CitySPB = "spb"
	CityMSK = "msk"
)

// AllCities — список валидных городов (порядок = дефолтный порядок вывода).
var AllCities = []string{CitySPB, CityMSK}

// ValidCity сообщает, поддерживается ли город.
func ValidCity(c string) bool {
	for _, x := range AllCities {
		if x == c {
			return true
		}
	}
	return false
}

// CityOffer — цена и остаток товара в конкретном городе (агрегат синка).
type CityOffer struct {
	City  string
	Price int
	Stock int
}
```

- [ ] **Step 4: Переписать `SyncProduct` в `syncstore.go` — offers вместо плоских Price/Stock**

В `api/internal/catalog/syncstore.go` заменить struct `SyncProduct`:
```go
// SyncProduct — строка каталога для upsert синком. Цена/остаток разнесены по
// городам (Offers). Ключ идемпотентности — Code.
type SyncProduct struct {
	Code      string
	Slug      string
	Brand     string
	Model     string
	Name      string
	SizeLabel string
	Width     int
	Profile   int
	Diameter  int
	Season    Season
	Spikes    bool
	Runflat   bool
	ImageURL  string
	Offers    []CityOffer
}
```

- [ ] **Step 5: Переписать `SyncStore.Upsert` и `PruneStaleBefore`**

Заменить методы `Upsert` и `ZeroStaleBefore` в `syncstore.go`:
```go
func (s *SyncStore) Upsert(ctx context.Context, p SyncProduct) error {
	if err := s.q.UpsertProduct(ctx, db.UpsertProductParams{
		Code: p.Code, Slug: p.Slug, Brand: p.Brand, Model: p.Model, Name: p.Name,
		SizeLabel: p.SizeLabel, Width: int32(p.Width), Profile: int32(p.Profile),
		Diameter: int32(p.Diameter), Season: string(p.Season), Spikes: p.Spikes,
		Runflat: p.Runflat, Price: 0, Stock: 0, ImageUrl: p.ImageURL, // price/stock legacy — читаем из product_offers
	}); err != nil {
		return fmt.Errorf("upsert product %s: %w", p.Code, err)
	}
	for _, o := range p.Offers {
		if err := s.q.UpsertProductOffer(ctx, db.UpsertProductOfferParams{
			ProductCode: p.Code, City: o.City, Price: int64(o.Price), Stock: int32(o.Stock),
		}); err != nil {
			return fmt.Errorf("upsert offer %s/%s: %w", p.Code, o.City, err)
		}
	}
	return nil
}

// PruneStaleBefore удаляет предложения, не обновлённые в текущем прогоне синка
// (город или товар пропал из выгрузки). Возвращает число удалённых строк.
func (s *SyncStore) PruneStaleBefore(ctx context.Context, before time.Time) (int64, error) {
	return s.q.DeleteStaleOffers(ctx, pgtype.Timestamptz{Time: before, Valid: true})
}
```
(Удалить старый метод `ZeroStaleBefore`.)

- [ ] **Step 6: Запустить тест — проходит**

Run: `cd /home/valdemar/Desktop/tirestock/api && go test ./internal/catalog/ -run TestValidCity`
Expected: PASS. (Пакет `dbsource.go` ещё не собирается — правим в Task 6; это ок, `go test` пакета упадёт на сборке. Если так — временно допустимо, но лучше выполнять Task 3 и 6 подряд перед запуском полного `go build`.)

- [ ] **Step 7: Commit**

```bash
git add api/internal/catalog/catalog.go api/internal/catalog/catalog_test.go api/internal/catalog/syncstore.go
git commit -m "feat(catalog): CityOffer + SyncProduct.Offers + SyncStore пишет product_offers"
```

---

## Task 4: SelectTyres JSON-клиент — агрегация по городам

**Files:**
- Modify: `api/internal/integrations/selecttyres/client.go`
- Modify: `api/internal/integrations/selecttyres/client_test.go`

**Interfaces:**
- Consumes: `catalog.CityOffer`, `catalog.SyncProduct.Offers`, `catalog.CitySPB/CityMSK` (Task 3).
- Produces:
  - `selecttyres.Config{FeedURL string, CityFilters map[string][]string, Timeout time.Duration}`
  - `selecttyres.DefaultCityFilters = map[string][]string{"spb": {"spb","sankt-peterburg"}, "msk": {"msk","moskva","moscow"}}`
  - `Client.Fetch(ctx, fn func(catalog.SyncProduct) error) (parsed, kept int, err error)` — сигнатура прежняя, внутри mapTire отдаёт per-city offers.

- [ ] **Step 1: Переписать тест `mapTire` под per-city агрегаты**

Заменить в `api/internal/integrations/selecttyres/client_test.go` тесты маппинга на:
```go
func testClient(t *testing.T) *Client {
	t.Helper()
	c, err := NewClient(Config{FeedURL: "http://x", CityFilters: map[string][]string{
		"spb": {"spb"}, "msk": {"msk"},
	}})
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestMapTire_PerCityAggregate(t *testing.T) {
	rrp := func(s string) *string { return &s }
	tire := feedTire{
		Code: "t1", FullName: "Тест 205/55 R16", Season: "Летняя",
		Width: "205.00", Height: "55.00", Diameter: "16.00",
		Offers: []feedOffer{
			{StockName: "spb-1", Quantity: 3, RRP: rrp("5000")},
			{StockName: "spb-2", Quantity: 2, RRP: rrp("4500")},
			{StockName: "msk-1", Quantity: 4, RRP: rrp("4800")},
			{StockName: "other", Quantity: 9, RRP: rrp("100")},
		},
	}
	p, ok := testClient(t).mapTire(tire)
	if !ok {
		t.Fatal("ожидался ok=true")
	}
	got := map[string]catalog.CityOffer{}
	for _, o := range p.Offers {
		got[o.City] = o
	}
	if got["spb"].Stock != 5 || got["spb"].Price != 4500 {
		t.Errorf("spb: got %+v, ожидалось stock=5 price=4500", got["spb"])
	}
	if got["msk"].Stock != 4 || got["msk"].Price != 4800 {
		t.Errorf("msk: got %+v, ожидалось stock=4 price=4800", got["msk"])
	}
}

func TestMapTire_PriceFallbackPerCity(t *testing.T) {
	mi := func(s string) *string { return &s }
	tire := feedTire{
		Code: "t2", FullName: "Ф 195/65 R15", Season: "Зимняя",
		Width: "195.00", Height: "65.00", Diameter: "15.00",
		Offers: []feedOffer{
			{StockName: "spb-1", Quantity: 1, MinInternet: mi("7000")}, // РРЦ нет → фолбэк
		},
	}
	p, ok := testClient(t).mapTire(tire)
	if !ok || len(p.Offers) != 1 || p.Offers[0].City != "spb" || p.Offers[0].Price != 7000 {
		t.Errorf("фолбэк цены по городу не сработал: ok=%v offers=%+v", ok, p.Offers)
	}
}

func TestMapTire_NoTargetCity_Skip(t *testing.T) {
	rrp := func(s string) *string { return &s }
	tire := feedTire{Code: "t3", FullName: "X", Offers: []feedOffer{
		{StockName: "other-1", Quantity: 5, RRP: rrp("3000")},
	}}
	if _, ok := testClient(t).mapTire(tire); ok {
		t.Error("ожидался ok=false — нет складов целевых городов")
	}
}
```

- [ ] **Step 2: Запустить — падает**

Run: `cd /home/valdemar/Desktop/tirestock/api && go test ./internal/integrations/selecttyres/ -run TestMapTire`
Expected: FAIL (компиляция: `Config` без `CityFilters`, `SyncProduct.Price` больше нет и т.п.).

- [ ] **Step 3: Обновить `Config`, `NewClient`, дефолты**

В `api/internal/integrations/selecttyres/client.go` заменить блок `DefaultStockFilter`, `Config`, `Client`, `NewClient`:
```go
// DefaultCityFilters — подстроки stock_name по городам (нижний регистр).
// MSK-подстроки — предположение; свериться с живым фидом (см. spec §10).
var DefaultCityFilters = map[string][]string{
	catalog.CitySPB: {"spb", "sankt-peterburg"},
	catalog.CityMSK: {"msk", "moskva", "moscow"},
}

// Config — параметры источника.
type Config struct {
	FeedURL     string
	CityFilters map[string][]string // город → подстроки stock_name; пусто → DefaultCityFilters
	Timeout     time.Duration       // на скачивание фида; 0 → 6m
}

// Client — загрузчик и парсер фида.
type Client struct {
	cfg    Config
	cities []string // детерминированный порядок городов
	http   *http.Client
}

func NewClient(cfg Config) (*Client, error) {
	if strings.TrimSpace(cfg.FeedURL) == "" {
		return nil, fmt.Errorf("selecttyres: FeedURL обязателен")
	}
	if len(cfg.CityFilters) == 0 {
		cfg.CityFilters = DefaultCityFilters
	}
	if cfg.Timeout == 0 {
		cfg.Timeout = 6 * time.Minute
	}
	cities := make([]string, 0, len(cfg.CityFilters))
	for _, c := range catalog.AllCities { // стабильный порядок из каталога
		if _, ok := cfg.CityFilters[c]; ok {
			cities = append(cities, c)
		}
	}
	return &Client{cfg: cfg, cities: cities, http: &http.Client{Timeout: cfg.Timeout}}, nil
}
```

- [ ] **Step 4: Переписать `mapTire` — цикл по городам**

Заменить `mapTire` и `isTargetStock` в `client.go`:
```go
// mapTire агрегирует предложения по каждому городу отдельно. ok=false — товар без
// предложений ни в одном целевом городе (или без вычислимой цены во всех).
func (c *Client) mapTire(t feedTire) (catalog.SyncProduct, bool) {
	var offers []catalog.CityOffer
	for _, city := range c.cities {
		subs := c.cfg.CityFilters[city]
		stock, price, hasPrice, found := 0, 0, false, false
		consider := func(raw *string) {
			if raw == nil {
				return
			}
			v, err := strconv.ParseFloat(*raw, 64)
			if err != nil || v <= 0 {
				return
			}
			iv := int(v)
			if !hasPrice || iv < price {
				price, hasPrice = iv, true
			}
		}
		for _, o := range t.Offers {
			if !matchStock(o.StockName, subs) {
				continue
			}
			found = true
			stock += o.Quantity
			consider(o.RRP) // цена = мин. РРЦ
		}
		if !found {
			continue
		}
		if !hasPrice { // нет РРЦ ни у одного склада города — фолбэк на интернет-цену
			for _, o := range t.Offers {
				if matchStock(o.StockName, subs) {
					consider(o.MinInternet)
				}
			}
		}
		if !hasPrice {
			continue // город есть, но цену не вычислить — пропускаем город
		}
		offers = append(offers, catalog.CityOffer{City: city, Price: price, Stock: stock})
	}
	if len(offers) == 0 {
		return catalog.SyncProduct{}, false
	}

	season, ok := seasonMap[t.Season]
	if !ok {
		season = catalog.SeasonAllSeason
	}
	width, profile, diameter := parseDim(t.Width), parseDim(t.Height), parseDim(t.Diameter)
	sizeLabel := fmt.Sprintf("%d/%d R%d", width, profile, diameter)
	if t.LoadIndex != "" || t.SpeedIndex != "" {
		sizeLabel += " " + t.LoadIndex + t.SpeedIndex
	}
	name := strings.TrimSpace(t.FullName)
	if name == "" {
		name = strings.TrimSpace(t.Brand + " " + t.Model + " " + sizeLabel)
	}

	return catalog.SyncProduct{
		Code: t.Code, Slug: slugify(name, t.Code), Brand: t.Brand, Model: t.Model,
		Name: name, SizeLabel: sizeLabel, Width: width, Profile: profile, Diameter: diameter,
		Season: season, Spikes: t.Thorn, Runflat: t.Runflat, ImageURL: t.Photo, Offers: offers,
	}, true
}

func matchStock(stockName string, subs []string) bool {
	s := strings.ToLower(stockName)
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}
```
(Удалить метод `isTargetStock`.)

- [ ] **Step 5: Запустить тесты — проходят**

Run: `cd /home/valdemar/Desktop/tirestock/api && go test ./internal/integrations/selecttyres/ -run TestMapTire -v`
Expected: PASS все три теста.

- [ ] **Step 6: Commit**

```bash
git add api/internal/integrations/selecttyres/client.go api/internal/integrations/selecttyres/client_test.go
git commit -m "feat(selecttyres): агрегация цены/остатка по городам (СПб/МСК)"
```

---

## Task 5: Синкер — использовать `PruneStaleBefore`

**Files:**
- Modify: `api/internal/integrations/selecttyres/syncer.go`

**Interfaces:**
- Consumes: `SyncStore.PruneStaleBefore` (Task 3).
- Produces: `Syncer` работает с обновлённым `Store` (метод `PruneStaleBefore`).

- [ ] **Step 1: Обновить интерфейс `Store` и вызов в `SyncOnce`**

В `api/internal/integrations/selecttyres/syncer.go`:
- в интерфейсе `Store` заменить `ZeroStaleBefore` на `PruneStaleBefore(ctx context.Context, before time.Time) (int64, error)`;
- в `SyncOnce` заменить вызов `s.store.ZeroStaleBefore(ctx, start)` на `s.store.PruneStaleBefore(ctx, start)`;
- в лог-строке заменить ключ `"погашено"` на `"удалено_предложений"`, а `"с_наличием_спб"` на `"с_наличием"`.

```go
type Store interface {
	Upsert(ctx context.Context, p catalog.SyncProduct) error
	PruneStaleBefore(ctx context.Context, before time.Time) (int64, error)
}
```
```go
	pruned, err := s.store.PruneStaleBefore(ctx, start)
	if err != nil {
		s.log.Error("selecttyres: удаление устаревших предложений", "err", err)
	}
	s.log.Info("selecttyres: синк завершён",
		"в_фиде", parsed, "с_наличием", kept, "удалено_предложений", pruned,
		"длительность", time.Since(start).Round(time.Second).String())
```

- [ ] **Step 2: Собрать пакет**

Run: `cd /home/valdemar/Desktop/tirestock/api && go build ./internal/integrations/selecttyres/`
Expected: успешная сборка.

- [ ] **Step 3: Commit**

```bash
git add api/internal/integrations/selecttyres/syncer.go
git commit -m "refactor(selecttyres): синкер использует PruneStaleBefore (offers)"
```

---

## Task 6: Каталог city-aware (Filters.City, DBSource, mock, handlers, service)

**Files:**
- Modify: `api/internal/catalog/filters.go`
- Modify: `api/internal/catalog/filters_test.go`
- Modify: `api/internal/catalog/dbsource.go`
- Modify: `api/internal/catalog/catalog.go` (интерфейс + Service.BySlug)
- Modify: `api/internal/catalog/handlers.go`
- Modify: `api/internal/integrations/mock/catalog.go`

**Interfaces:**
- Consumes: `db.GetCatalogProductBySlug` с city (Task 2), `catalog.ValidCity` (Task 3).
- Produces:
  - `catalog.Filters.City string`
  - `catalog.CatalogSource.BySlug(ctx, slug, city string) (Product, error)`
  - `catalog.Service.BySlug(ctx, slug, city string) (Product, error)`
  - `WhereSQL` фильтрует по `po.price` (город приходит отдельным первым аргументом из DBSource).

- [ ] **Step 1: Тест — ParseFilters читает city и валидирует**

Дописать в `api/internal/catalog/filters_test.go`:
```go
func TestParseFilters_City(t *testing.T) {
	f, _, _, err := ParseFilters(url.Values{"city": {"msk"}})
	if err != nil || f.City != "msk" {
		t.Fatalf("city=msk: got %q err=%v", f.City, err)
	}
	f2, _, _, _ := ParseFilters(url.Values{})
	if f2.City != CitySPB {
		t.Errorf("дефолт города: got %q, ожидалось spb", f2.City)
	}
	f3, _, _, _ := ParseFilters(url.Values{"city": {"piter"}})
	if f3.City != CitySPB {
		t.Errorf("невалидный город → дефолт spb, got %q", f3.City)
	}
}
```
(Убедиться, что в импортах теста есть `net/url`.)

- [ ] **Step 2: Запустить — падает**

Run: `cd /home/valdemar/Desktop/tirestock/api && go test ./internal/catalog/ -run TestParseFilters_City`
Expected: FAIL — `f.City undefined`.

- [ ] **Step 3: Добавить `City` в Filters, парсинг, изменить price на po.price**

В `api/internal/catalog/filters.go`:
- в struct `Filters` добавить поле `City string // выбранный город (spb|msk)`;
- в `ParseFilters` перед `return f, page, perPage, nil` добавить:
```go
	f.City = CitySPB
	if c := q.Get("city"); ValidCity(c) {
		f.City = c
	}
```
- в `WhereSQL` заменить две строки цены на квалифицированные (в JOIN `price` неоднозначен — есть и в products, и в product_offers):
```go
	if f.PriceMin != nil {
		add("po.price >= $%d", *f.PriceMin)
	}
	if f.PriceMax != nil {
		add("po.price <= $%d", *f.PriceMax)
	}
```
(`Match` для мока не трогаем — город к моку неприменим.)

- [ ] **Step 4: Запустить тест city — проходит**

Run: `cd /home/valdemar/Desktop/tirestock/api && go test ./internal/catalog/ -run TestParseFilters_City`
Expected: PASS.

- [ ] **Step 5: Обновить интерфейс и Service.BySlug в `catalog.go`**

В `api/internal/catalog/catalog.go`:
- добавить в `Product` поле после `ImageURL`? — не нужно; image приходит уже как эффективный URL. Оставляем `ImageURL` как есть (значение = чистое или фолбэк).
- в интерфейсе `CatalogSource` заменить `BySlug(ctx, slug string)` на:
```go
	BySlug(ctx context.Context, slug, city string) (Product, error)
```
- в `Service.BySlug`:
```go
func (s *Service) BySlug(ctx context.Context, slug, city string) (Product, error) {
	return s.src.BySlug(ctx, slug, city)
}
```

- [ ] **Step 6: Обновить DBSource — JOIN product_offers, чистое фото, city-аргумент**

В `api/internal/catalog/dbsource.go`:
- заменить `listCols`:
```go
const listCols = `p.id, p.slug, p.brand, p.model, p.name, p.size_label,
	p.width, p.profile, p.diameter, p.season, p.spikes, p.runflat,
	po.price, po.stock, COALESCE(NULLIF(p.image_clean_url, ''), p.image_url), COALESCE(o.badge_hit, false)`
```
- заменить тело `List`:
```go
func (s *DBSource) List(ctx context.Context, f Filters, page, perPage int) ([]Product, int, error) {
	city := f.City
	if !ValidCity(city) {
		city = CitySPB
	}
	where, args := f.WhereSQL(2) // $1 зарезервирован под город
	allArgs := append([]any{city}, args...)
	cond := "COALESCE(o.hidden, false) = false"
	if where != "" {
		cond += " AND " + strings.TrimPrefix(where, "WHERE ")
	}
	from := "FROM products p " +
		"JOIN product_offers po ON po.product_code = p.code AND po.city = $1 " +
		"LEFT JOIN product_overrides o ON o.slug = p.slug WHERE " + cond

	var total int
	if err := s.pool.QueryRow(ctx, "SELECT count(*) "+from, allArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count products: %w", err)
	}
	if total == 0 {
		return []Product{}, 0, nil
	}

	listSQL := fmt.Sprintf(
		"SELECT %s %s ORDER BY (po.stock > 0) DESC, p.id LIMIT $%d OFFSET $%d",
		listCols, from, len(allArgs)+1, len(allArgs)+2,
	)
	rows, err := s.pool.Query(ctx, listSQL, append(allArgs, perPage, (page-1)*perPage)...)
	if err != nil {
		return nil, 0, fmt.Errorf("list products: %w", err)
	}
	defer rows.Close()

	items := make([]Product, 0, perPage)
	for rows.Next() {
		p, err := scanProduct(rows)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, p)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}
```
- заменить сигнатуру и тело `BySlug`:
```go
func (s *DBSource) BySlug(ctx context.Context, slug, city string) (Product, error) {
	if !ValidCity(city) {
		city = CitySPB
	}
	r, err := s.q.GetCatalogProductBySlug(ctx, db.GetCatalogProductBySlugParams{Slug: slug, City: city})
	if errors.Is(err, pgx.ErrNoRows) {
		return Product{}, ErrNotFound
	}
	if err != nil {
		return Product{}, fmt.Errorf("get product: %w", err)
	}
	return Product{
		ID: r.ID, Slug: r.Slug, Brand: r.Brand, Model: r.Model, Name: r.Name,
		SizeLabel: r.SizeLabel, Width: int(r.Width), Profile: int(r.Profile),
		Diameter: int(r.Diameter), Season: Season(r.Season), Spikes: r.Spikes,
		Runflat: r.Runflat, Price: int(r.Price), Stock: int(r.Stock),
		ImageURL: r.ImageUrl, BadgeHit: r.BadgeHit,
	}, nil
}
```

- [ ] **Step 7: Обновить mock BySlug сигнатуру**

В `api/internal/integrations/mock/catalog.go` заменить сигнатуру:
```go
func (s *CatalogSource) BySlug(_ context.Context, slug, _ string) (catalog.Product, error) {
```
(город мок игнорирует.)

- [ ] **Step 8: Обновить handler bySlug — читать city из query**

В `api/internal/catalog/handlers.go` заменить `bySlug`:
```go
func (h *Handlers) bySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	city := r.URL.Query().Get("city")
	if !ValidCity(city) {
		city = CitySPB
	}
	p, err := h.svc.BySlug(r.Context(), slug, city)
	if errors.Is(err, ErrNotFound) {
		httpx.NotFound(w, "товар не найден")
		return
	}
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}
```

- [ ] **Step 9: Собрать и прогнать все тесты api**

Run: `cd /home/valdemar/Desktop/tirestock/api && go build ./... && go test ./...`
Expected: сборка зелёная; тесты каталога/selecttyres/orders/admin проходят.

- [ ] **Step 10: Commit**

```bash
git add api/internal/catalog api/internal/integrations/mock/catalog.go
git commit -m "feat(catalog): city-aware листинг и товар (JOIN product_offers, чистое фото)"
```

---

## Task 7: Avito-фото-синкер (XML) + Store

**Files:**
- Create: `api/internal/integrations/selecttyres/photos.go`
- Create: `api/internal/integrations/selecttyres/photos_test.go`
- Modify: `api/internal/catalog/syncstore.go` (метод `UpdateImageClean`)

**Interfaces:**
- Consumes: `db.UpdateProductImageClean` (Task 2).
- Produces:
  - `selecttyres.PhotoConfig{FeedURL string, Timeout time.Duration}`
  - `selecttyres.NewPhotoClient(PhotoConfig) (*PhotoClient, error)`
  - `PhotoClient.Fetch(ctx, fn func(code, url string) error) (parsed, withPhoto int, err error)`
  - `selecttyres.PhotoStore` интерфейс `UpdateImageClean(ctx, code, url string) (int64, error)`
  - `selecttyres.NewPhotoSyncer(*PhotoClient, PhotoStore, time.Duration, *slog.Logger) *PhotoSyncer` с `Run(ctx)`/`SyncOnce(ctx)`
  - `SyncStore.UpdateImageClean(ctx, code, url string) (int64, error)`

- [ ] **Step 1: Тест парсера Avito-XML**

`api/internal/integrations/selecttyres/photos_test.go`:
```go
package selecttyres

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

const sampleAds = `<Ads formatVersion="3" target="Avito.ru">
  <Ad><Id>t1</Id><Title>A</Title>
    <Images><Image url="https://ex/media/a.png"/></Images></Ad>
  <Ad><Id>t2</Id><Title>B</Title>
    <Images></Images></Ad>
  <Ad><Id>t3</Id><Title>C</Title>
    <Images><Image url="https://ex/media/c.jpg"/></Images></Ad>
</Ads>`

func TestPhotoClient_Fetch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/xml")
		_, _ = w.Write([]byte(sampleAds))
	}))
	defer srv.Close()

	c, err := NewPhotoClient(PhotoConfig{FeedURL: srv.URL})
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]string{}
	parsed, withPhoto, err := c.Fetch(context.Background(), func(code, url string) error {
		got[code] = url
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if parsed != 3 || withPhoto != 2 {
		t.Errorf("parsed=%d withPhoto=%d, ожидалось 3 и 2", parsed, withPhoto)
	}
	if got["t1"] != "https://ex/media/a.png" || got["t3"] != "https://ex/media/c.jpg" {
		t.Errorf("неверные url: %+v", got)
	}
	if _, ok := got["t2"]; ok {
		t.Error("t2 без фото не должен попасть в fn")
	}
}
```

- [ ] **Step 2: Запустить — падает**

Run: `cd /home/valdemar/Desktop/tirestock/api && go test ./internal/integrations/selecttyres/ -run TestPhotoClient`
Expected: FAIL — `undefined: NewPhotoClient`.

- [ ] **Step 3: Реализовать PhotoClient и PhotoSyncer**

`api/internal/integrations/selecttyres/photos.go`:
```go
package selecttyres

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

// PhotoConfig — параметры Avito-фида «чистых» фото (без вотермарка).
type PhotoConfig struct {
	FeedURL string
	Timeout time.Duration // 0 → 6m
}

// PhotoClient — стриминговый парсер Avito-XML (по <Ad>).
type PhotoClient struct {
	cfg  PhotoConfig
	http *http.Client
}

func NewPhotoClient(cfg PhotoConfig) (*PhotoClient, error) {
	if strings.TrimSpace(cfg.FeedURL) == "" {
		return nil, fmt.Errorf("selecttyres: PhotoConfig.FeedURL обязателен")
	}
	if cfg.Timeout == 0 {
		cfg.Timeout = 6 * time.Minute
	}
	return &PhotoClient{cfg: cfg, http: &http.Client{Timeout: cfg.Timeout}}, nil
}

type xmlAd struct {
	ID     string `xml:"Id"`
	Images struct {
		Image []struct {
			URL string `xml:"url,attr"`
		} `xml:"Image"`
	} `xml:"Images"`
}

// Fetch скачивает Avito-фид и для каждого <Ad> с непустым фото зовёт fn(code, url).
// Разбор потоковый — весь файл в память не грузится.
func (c *PhotoClient) Fetch(ctx context.Context, fn func(code, url string) error) (parsed, withPhoto int, err error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.cfg.FeedURL, nil)
	if err != nil {
		return 0, 0, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return 0, 0, fmt.Errorf("selecttyres: скачивание фото-фида: %w", err)
	}
	defer func() { _, _ = io.Copy(io.Discard, resp.Body); _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return 0, 0, fmt.Errorf("selecttyres: фото-фид вернул статус %d", resp.StatusCode)
	}

	dec := xml.NewDecoder(resp.Body)
	for {
		tok, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return parsed, withPhoto, fmt.Errorf("selecttyres: разбор фото-XML: %w", err)
		}
		se, ok := tok.(xml.StartElement)
		if !ok || se.Name.Local != "Ad" {
			continue
		}
		var ad xmlAd
		if err := dec.DecodeElement(&ad, &se); err != nil {
			return parsed, withPhoto, fmt.Errorf("selecttyres: разбор <Ad>: %w", err)
		}
		parsed++
		code := strings.TrimSpace(ad.ID)
		if code == "" || len(ad.Images.Image) == 0 {
			continue
		}
		url := strings.TrimSpace(ad.Images.Image[0].URL)
		if url == "" {
			continue
		}
		if err := fn(code, url); err != nil {
			return parsed, withPhoto, err
		}
		withPhoto++
	}
	return parsed, withPhoto, nil
}

// PhotoStore — приёмник чистых фото (обновление products.image_clean_url).
type PhotoStore interface {
	UpdateImageClean(ctx context.Context, code, url string) (int64, error)
}

// PhotoSyncer — фоновый контур: раз в interval тянет Avito-фид и обновляет чистые фото.
type PhotoSyncer struct {
	client   *PhotoClient
	store    PhotoStore
	interval time.Duration
	log      *slog.Logger
}

func NewPhotoSyncer(client *PhotoClient, store PhotoStore, interval time.Duration, log *slog.Logger) *PhotoSyncer {
	if interval <= 0 {
		interval = time.Hour
	}
	return &PhotoSyncer{client: client, store: store, interval: interval, log: log}
}

func (s *PhotoSyncer) Run(ctx context.Context) {
	if err := s.SyncOnce(ctx); err != nil {
		s.log.Error("selecttyres: первый синк фото не удался", "err", err)
	}
	t := time.NewTicker(s.interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if err := s.SyncOnce(ctx); err != nil {
				s.log.Error("selecttyres: синк фото не удался", "err", err)
			}
		}
	}
}

func (s *PhotoSyncer) SyncOnce(ctx context.Context) error {
	start := time.Now()
	s.log.Info("selecttyres: синк фото начат")
	var updated int64
	parsed, withPhoto, err := s.client.Fetch(ctx, func(code, url string) error {
		n, err := s.store.UpdateImageClean(ctx, code, url)
		updated += n
		return err
	})
	if err != nil {
		return err
	}
	s.log.Info("selecttyres: синк фото завершён",
		"в_фиде", parsed, "с_фото", withPhoto, "обновлено", updated,
		"длительность", time.Since(start).Round(time.Second).String())
	return nil
}
```

- [ ] **Step 4: Добавить `SyncStore.UpdateImageClean`**

В `api/internal/catalog/syncstore.go` дописать метод:
```go
// UpdateImageClean записывает чистое фото товара по коду. Возвращает число строк
// (0 — товара с таким кодом ещё нет в каталоге).
func (s *SyncStore) UpdateImageClean(ctx context.Context, code, url string) (int64, error) {
	return s.q.UpdateProductImageClean(ctx, db.UpdateProductImageCleanParams{Code: code, ImageCleanUrl: url})
}
```

- [ ] **Step 5: Запустить тест — проходит; собрать пакеты**

Run: `cd /home/valdemar/Desktop/tirestock/api && go test ./internal/integrations/selecttyres/ -run TestPhotoClient && go build ./...`
Expected: PASS + зелёная сборка.

- [ ] **Step 6: Commit**

```bash
git add api/internal/integrations/selecttyres/photos.go api/internal/integrations/selecttyres/photos_test.go api/internal/catalog/syncstore.go
git commit -m "feat(selecttyres): Avito-синкер чистых фото → image_clean_url"
```

---

## Task 8: Проводка в main.go + env

**Files:**
- Modify: `api/cmd/api/main.go`
- Modify: `deploy/.env` (секреты — локально, не в git)
- Modify: `deploy/.env.example`
- Modify: `deploy/docker-compose.yml` (проброс новых env в сервис api)

**Interfaces:**
- Consumes: `selecttyres.NewPhotoClient/NewPhotoSyncer`, `selecttyres.DefaultCityFilters`, `catalog.NewSyncStore` (Store и PhotoStore — один и тот же `*SyncStore`).

- [ ] **Step 1: Расширить config и loadConfig**

В `api/cmd/api/main.go`:
- в struct `config` добавить поля:
```go
	// Синк каталога из SelectTyres (пусто → каталог на моке).
	Selecttyres   selecttyres.Config
	PhotoFeedURL  string
	SyncInterval  time.Duration
```
- в `loadConfig` после блока Selecttyres заменить/добавить:
```go
	cfg.Selecttyres = selecttyres.Config{
		FeedURL:     os.Getenv("SELECTYRES_FEED_URL"),
		CityFilters: cityFiltersFromEnv(),
	}
	cfg.PhotoFeedURL = os.Getenv("SELECTYRES_PHOTO_FEED_URL")
```
- добавить хелпер под `loadConfig`:
```go
// cityFiltersFromEnv читает подстроки складов по городам из env; пусто → дефолты.
// SELECTYRES_STOCK_SPB / SELECTYRES_STOCK_MSK — списки через запятую.
func cityFiltersFromEnv() map[string][]string {
	parse := func(env, city string) []string {
		v := strings.TrimSpace(os.Getenv(env))
		if v == "" {
			return selecttyres.DefaultCityFilters[city]
		}
		var out []string
		for _, s := range strings.Split(v, ",") {
			if s = strings.TrimSpace(strings.ToLower(s)); s != "" {
				out = append(out, s)
			}
		}
		return out
	}
	return map[string][]string{
		catalog.CitySPB: parse("SELECTYRES_STOCK_SPB", catalog.CitySPB),
		catalog.CityMSK: parse("SELECTYRES_STOCK_MSK", catalog.CityMSK),
	}
}
```
- добавить `"strings"` в импорты.

- [ ] **Step 2: Запустить фото-синкер рядом с JSON-синкером**

В `main.go`, в блоке, где создаётся `syncer` (внутри `if cfg.Selecttyres.FeedURL != ""`), сохранить общий store и после старта JSON-синкера добавить старт фото-синкера. Заменить блок:
```go
	var catSource catalog.CatalogSource
	var syncer *selecttyres.Syncer
	var photoSyncer *selecttyres.PhotoSyncer
	if cfg.Selecttyres.FeedURL != "" {
		stClient, err := selecttyres.NewClient(cfg.Selecttyres)
		if err != nil {
			log.Error("selecttyres client", "err", err)
			os.Exit(1)
		}
		store := catalog.NewSyncStore(pool)
		syncer = selecttyres.NewSyncer(stClient, store, cfg.SyncInterval, log)
		catSource = catalog.NewDBSource(pool)
		log.Info("каталог: SelectTyres (синк в read-модель)", "interval", cfg.SyncInterval.String())

		if cfg.PhotoFeedURL != "" {
			pClient, err := selecttyres.NewPhotoClient(selecttyres.PhotoConfig{FeedURL: cfg.PhotoFeedURL})
			if err != nil {
				log.Error("selecttyres photo client", "err", err)
				os.Exit(1)
			}
			photoSyncer = selecttyres.NewPhotoSyncer(pClient, store, cfg.SyncInterval, log)
			log.Info("каталог: синк чистых фото (Avito-фид) включён")
		}
	} else {
		catSource = mock.NewCatalogSource()
		log.Info("каталог: мок (SELECTYRES_FEED_URL не задан)")
	}
```
И рядом с `go syncer.Run(ctx)`:
```go
	if syncer != nil {
		go syncer.Run(ctx)
	}
	if photoSyncer != nil {
		go photoSyncer.Run(ctx)
	}
```

- [ ] **Step 3: Собрать api**

Run: `cd /home/valdemar/Desktop/tirestock/api && go build ./...`
Expected: зелёная сборка.

- [ ] **Step 4: Прописать env**

В `deploy/.env` добавить (значение фото-URL — рабочая ссылка, что прислал Виталий; JSON-URL обновить, когда перегенерирует):
```
SELECTYRES_PHOTO_FEED_URL=https://files.selectyre.ru/a1fadc32-409b-4d95-934f-4b93c0d8d80b.xml
# Подстроки складов по городам (нижний регистр, через запятую). Пусто → дефолты кода.
# MSK-подстроки — предположение; свериться с живым JSON-фидом.
SELECTYRES_STOCK_SPB=spb,sankt-peterburg
SELECTYRES_STOCK_MSK=msk,moskva,moscow
```
В `deploy/.env.example` добавить те же ключи с плейсхолдерами (без реального токена):
```
SELECTYRES_PHOTO_FEED_URL=
SELECTYRES_STOCK_SPB=spb,sankt-peterburg
SELECTYRES_STOCK_MSK=msk,moskva,moscow
```
В `deploy/docker-compose.yml` в сервисе `api` (секция `environment`) добавить проброс:
```yaml
      SELECTYRES_PHOTO_FEED_URL: ${SELECTYRES_PHOTO_FEED_URL}
      SELECTYRES_STOCK_SPB: ${SELECTYRES_STOCK_SPB}
      SELECTYRES_STOCK_MSK: ${SELECTYRES_STOCK_MSK}
```

- [ ] **Step 5: Commit (без .env — он gitignored)**

```bash
git add api/cmd/api/main.go deploy/.env.example deploy/docker-compose.yml
git commit -m "feat(api): проводка фото-синкера и city-фильтров складов из env"
```

---

## Task 9: OpenAPI — параметр `city` + регенерация типов

**Files:**
- Modify: `api/openapi.yaml`
- Regenerate: `web/lib/api/schema.d.ts` (`npm run gen:api`)

**Interfaces:**
- Produces: query-параметр `city` (enum spb|msk, default spb) на `GET /products` и `GET /products/{slug}`.

- [ ] **Step 1: Добавить параметр city в openapi**

В `api/openapi.yaml`:
- добавить переиспользуемый параметр в `components.parameters` (если секции нет — создать):
```yaml
    CityParam:
      name: city
      in: query
      required: false
      schema:
        type: string
        enum: [spb, msk]
        default: spb
      description: Город (СПб/МСК). Влияет на цену и наличие.
```
- в операции `GET /products` и `GET /products/{slug}` в списки `parameters` добавить:
```yaml
        - $ref: '#/components/parameters/CityParam'
```

- [ ] **Step 2: Регенерировать TS-типы**

Run: `cd /home/valdemar/Desktop/tirestock/web && npm run gen:api`
Expected: `web/lib/api/schema.d.ts` обновлён; параметр `city` появляется в типах query.

- [ ] **Step 3: Проверить типы**

Run: `cd /home/valdemar/Desktop/tirestock/web && npx tsc --noEmit`
Expected: без ошибок (существующий код не сломан; `city` опционален).

- [ ] **Step 4: Commit**

```bash
git add api/openapi.yaml web/lib/api/schema.d.ts
git commit -m "feat(api): openapi параметр city + регенерация TS-типов"
```

---

## Task 10: Next — кука города, серверный хелпер, проброс city в API

**Files:**
- Create: `web/lib/city.ts`
- Modify: `web/lib/api/client.ts`
- Modify: `web/app/api/catalog-count/route.ts`
- Modify: `web/app/(storefront)/catalog/page.tsx`
- Modify: `web/app/(storefront)/catalog/[slug]/page.tsx`
- Modify: `web/app/(storefront)/page.tsx` (главная — «Популярные»)

**Interfaces:**
- Produces:
  - `web/lib/city.ts`: `type City = "spb" | "msk"`, `CITY_COOKIE = "city"`, `CITIES` (метаданные), `getCity(): Promise<City>`, `isCity(v): v is City`.
  - `client.ts`: `ProductFilters.city?: City`; `getProductBySlug(slug, city?)`.

- [ ] **Step 1: Серверный хелпер города**

`web/lib/city.ts`:
```ts
import { cookies } from "next/headers";

export type City = "spb" | "msk";
export const CITY_COOKIE = "city";
export const DEFAULT_CITY: City = "spb";

// Метаданные городов для шапки/футера. Адрес/телефон МСК — плейсхолдер до данных
// от Виталия (TODO: уточнить реальный адрес и телефон Москвы).
export const CITIES: Record<City, { label: string; address: string; phone: string; phoneHref: string }> = {
  spb: {
    label: "Санкт-Петербург",
    address: "Зотовский пр. 11, стр. 1",
    phone: "+7 (812) 614-64-42",
    phoneHref: "tel:+78126146442",
  },
  msk: {
    label: "Москва",
    address: "уточняется",
    phone: "+7 (812) 614-64-42",
    phoneHref: "tel:+78126146442",
  },
};

export function isCity(v: string | undefined): v is City {
  return v === "spb" || v === "msk";
}

// Читает выбранный город из куки (сервер). Невалидное/пусто → дефолт.
export async function getCity(): Promise<City> {
  const store = await cookies();
  const v = store.get(CITY_COOKIE)?.value;
  return isCity(v) ? v : DEFAULT_CITY;
}
```

- [ ] **Step 2: Добавить city в API-клиент**

В `web/lib/api/client.ts`:
- в тип `ProductFilters` добавить `city?: "spb" | "msk";` (первой строкой полей);
- заменить `getProductBySlug`:
```ts
export function getProductBySlug(slug: string, city?: "spb" | "msk"): Promise<Product> {
  const q = city ? `?city=${city}` : "";
  return request(`/products/${encodeURIComponent(slug)}${q}`);
}
```
(`listProducts` уже сериализует все поля `ProductFilters`, включая `city` — правки не нужны.)

- [ ] **Step 3: Проброс city в catalog-count route**

В `web/app/api/catalog-count/route.ts`:
- добавить в объект `filters` строку `city: (str("city") as "spb" | "msk" | undefined),` (используя существующий хелпер `str`).

- [ ] **Step 4: Проброс city в страницы каталога/товара/главной**

- `web/app/(storefront)/catalog/page.tsx`: импортировать `getCity`, в начале серверного компонента `const city = await getCity();`, и добавить `city` в объект фильтров, передаваемый в `listProducts(...)`.
- `web/app/(storefront)/catalog/[slug]/page.tsx`: `const city = await getCity();` и вызвать `getProductBySlug(slug, city)` (и в `generateMetadata`, если он тоже грузит товар — там тоже `getCity()` + city). Если товар грузится через `React.cache`-обёртку, добавить `city` в аргументы обёртки, чтобы кэш был по (slug, city).
- `web/app/(storefront)/page.tsx`: `const city = await getCity();`, передать `city` в `listProducts(...)` для блока «Популярные».

- [ ] **Step 5: Проверить типы и сборку**

Run: `cd /home/valdemar/Desktop/tirestock/web && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 6: Commit**

```bash
git add web/lib/city.ts web/lib/api/client.ts web/app/api/catalog-count/route.ts "web/app/(storefront)/catalog/page.tsx" "web/app/(storefront)/catalog/[slug]/page.tsx" "web/app/(storefront)/page.tsx"
git commit -m "feat(web): кука города + проброс city в каталог/товар/главную"
```

---

## Task 11: Переключатель города в шапке (DNS-стиль)

**Files:**
- Create: `web/components/blocks/CitySwitcher.tsx`
- Create: `web/app/api/city/route.ts` (установка куки city)
- Modify: `web/components/blocks/Header.tsx` (топбар — заменить статичный адрес)

**Interfaces:**
- Consumes: `web/lib/city.ts` (`City`, `CITIES`, `CITY_COOKIE`, `getCity`).
- Produces: клиентский `CitySwitcher` (пропсы `{ city: City }`); route `POST /api/city` ставит куку и `204`.

- [ ] **Step 1: Route для установки куки города**

`web/app/api/city/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { CITY_COOKIE, isCity } from "@/lib/city";

// Ставит куку выбранного города на год. Клиентский переключатель дёргает POST,
// затем делает router.refresh() — серверные страницы перечитывают куку.
export async function POST(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city") ?? "";
  if (!isCity(city)) {
    return NextResponse.json({ error: "bad city" }, { status: 400 });
  }
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(CITY_COOKIE, city, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}
```

- [ ] **Step 2: Клиентский переключатель**

`web/components/blocks/CitySwitcher.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CITIES, type City } from "@/lib/city";

// Переключатель города в топбаре (DNS-стиль): один домен, город в куке.
// Enter/Escape, aria-expanded; при выборе — POST /api/city + router.refresh().
export function CitySwitcher({ city }: { city: City }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function choose(next: City) {
    setOpen(false);
    if (next === city) return;
    await fetch(`/api/city?city=${next}`, { method: "POST" });
    startTransition(() => router.refresh());
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="flex min-h-touch items-center gap-2 text-caption-lg text-grey hover:text-dark"
      >
        <img src="/icons/pin.svg" alt="" width={16} height={16} className="size-4" />
        {CITIES[city].label}
        <img src="/icons/chevron-down-sm.svg" alt="" width={16} height={16} className="size-4" />
      </button>
      {open && (
        <ul
          role="listbox"
          className="animate-dropdown absolute left-0 top-full z-50 mt-1 min-w-48 origin-top rounded-field border border-line bg-white py-1 shadow-dropdown"
        >
          {(Object.keys(CITIES) as City[]).map((c) => (
            <li key={c}>
              <button
                type="button"
                role="option"
                aria-selected={c === city}
                onClick={() => choose(c)}
                className={
                  "block w-full px-4 py-2.5 text-left text-field hover:bg-light " +
                  (c === city ? "font-semibold text-blue" : "text-dark")
                }
              >
                {CITIES[c].label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Встроить переключатель в Header (топбар) + город-зависимые адрес/телефон**

В `web/components/blocks/Header.tsx`:
- сделать компонент серверным читателем города: импортировать `getCity`, `CITIES`; в начале `export async function Header()` — `const city = await getCity();` (компонент станет `async`; он серверный — ок);
- заменить статичный блок адреса (`<p>…Санкт-Петербург, Зотовский…</p>`) на `<CitySwitcher city={city} />`;
- телефон в топбаре заменить на город-зависимый:
```tsx
            <a href={CITIES[city].phoneHref} className="flex items-center gap-2 text-caption-lg font-semibold text-dark">
              <img src="/icons/phone.svg" alt="" width={16} height={16} className="size-4" />
              {CITIES[city].phone}
            </a>
```
- импортировать `CitySwitcher` из `@/components/blocks/CitySwitcher`.

- [ ] **Step 4: Проверить, что Header используется как async-компонент**

Убедиться, что `Header` рендерится в серверном layout (`web/app/(storefront)/layout.tsx`) — он уже там. Async серверный компонент допустим. Прогнать типы:
Run: `cd /home/valdemar/Desktop/tirestock/web && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 5: Собрать web**

Run: `cd /home/valdemar/Desktop/tirestock/web && npm run build`
Expected: сборка проходит (страницы каталога/товара/главной остаются динамическими/ISR — не ломаются от чтения куки; если Next ругается на `cookies()` в статической странице — убедиться, что затронутые страницы уже не статические, т.к. читают куку).

- [ ] **Step 6: Commit**

```bash
git add web/components/blocks/CitySwitcher.tsx web/app/api/city/route.ts web/components/blocks/Header.tsx
git commit -m "feat(web): переключатель города в шапке (кука, DNS-стиль)"
```

---

## Task 12: Пересборка контейнеров и живая проверка

**Files:** нет (проверка).

**Interfaces:** нет.

- [ ] **Step 1: Пересобрать и поднять стек**

Run:
```bash
cd /home/valdemar/Desktop/tirestock
docker compose -f deploy/docker-compose.yml up -d --build
docker compose -f deploy/docker-compose.yml logs --tail=40 api
```
Expected: миграция 0004 применилась; логи «синк начат/фото начат». JSON-синк может ругаться `AccessDenied` (протухший URL) — это ожидаемо до свежего URL от Виталия; фото-синк должен пройти (XML-URL рабочий).

- [ ] **Step 2: Проверить, что чистые фото проливаются**

Run:
```bash
docker compose -f deploy/docker-compose.yml exec -T postgres psql -U tirestock -d tirestock \
  -c "SELECT count(*) FILTER (WHERE image_clean_url <> '') AS clean, count(*) AS total FROM products;"
```
Expected: `clean` > 0 (для товаров, что уже есть в каталоге; фото пишутся только по существующим code).

- [ ] **Step 3: Проверить city-aware каталог через API (после свежего JSON-URL)**

Когда Виталий пришлёт рабочий `SELECTYRES_FEED_URL` — прописать в `.env`, пересобрать, дождаться синка, затем:
```bash
curl -s "http://localhost:8080/api/v1/products?city=spb&per_page=1" | head -c 300; echo
curl -s "http://localhost:8080/api/v1/products?city=msk&per_page=1" | head -c 300; echo
```
Expected: разные `total`/наборы по городам; поле `image_url` товара указывает на `media/tires/big/...` (чистое) там, где фото прилилось.

- [ ] **Step 4: Проверить сверку MSK-складов**

Когда JSON-фид доступен — вытащить реальные `stock_name` и убедиться, что MSK-подстроки ловят московские склады (иначе поправить `SELECTYRES_STOCK_MSK` в `.env`):
```bash
# из логов/фида: перечислить уникальные stock_name; проверить, что московские
# попадают под msk,moskva,moscow. При расхождении — обновить env и пересобрать.
```
Expected: московские склады матчатся; `product_offers` содержит строки с `city='msk'`.

- [ ] **Step 5: Ручная проверка UI**

Открыть витрину, переключить город в шапке → каталог и «Популярные» меняют выдачу/цены; на карточке товара фото без вотермарка. Прогнать по чеклисту: переключатель ≥44px, Enter/Escape работают, `prefers-reduced-motion` не ломает.

- [ ] **Step 6: Обновить TODO и память**

- В `TODO.md`: отметить сделанное (мультигород базовый, чистые фото), добавить хвосты: свежий JSON-URL, сверка MSK-складов, постоянство ссылок (вопрос в поддержку SelectTyres), реальные адрес/телефон Москвы, корзина/заказ city-aware, диски (отдельная выгрузка).
- Обновить память `next-selecttyres.md`: добавить факт про Avito-фид чистых фото и ротацию URL выгрузок.

- [ ] **Step 7: Commit**

```bash
git add TODO.md
git commit -m "docs: TODO — мультигород и чистые фото, хвосты по SelectTyres"
```

---

## Заметки для исполнителя

- Задачи 3 и 6 меняют один пакет `catalog`; между ними пакет может не собираться целиком. Прогонять полный `go build ./...` только после Task 6.
- JSON-фид сейчас отдаёт `AccessDenied` — это **не** дефект кода. Живая проверка мультигорода (Task 12 шаги 3–4) ждёт свежий URL от Виталия. Фото-синк проверяется независимо (шаг 2).
- MSK-подстроки складов — предположение. До сверки с живым фидом `city=msk` может давать пусто; это ожидаемо, чинится значением `SELECTYRES_STOCK_MSK` в `.env` без пересборки кода.
- Реальные адрес/телефон Москвы неизвестны — в `CITIES.msk` плейсхолдер, пометить в TODO.
- Секреты (URL с токеном) — только `deploy/.env`; в git идёт только `.env.example` с пустыми значениями.
- **ISR → динамика:** чтение `cookies()` (через `getCity()` в Header и страницах) переводит
  затронутые страницы в динамический рендер per-request. Это осознанный компромисс DNS-стиля
  (один домен, город в куке): `export const revalidate` на главной больше не даёт статический
  кэш — «Популярные» рендерятся под город на каждый запрос. Так и должно быть. Не пытаться
  «чинить» это возвратом к статике — сломается переключение города.
