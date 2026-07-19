# TireStock — новая витрина tirestock.ru

Монорепо: `web/` (Next.js витрина + админка), `api/` (Go-сервис), `deploy/` (docker-compose).
Контекст и правила: `CLAUDE.md`, `docs/CONVENTIONS.md`, `docs/DESIGN_SYSTEM.md`, `docs/ARCHITECTURE.md`.
**Обзор всего, что сделано, и как оно устроено: `docs/PROJECT_OVERVIEW.md`** — начинать чтение отсюда.

## Запуск всего через Docker

```bash
cp deploy/.env.example deploy/.env
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up --build
```

- витрина: http://localhost:3000 (демо UI-кита: http://localhost:3000/dev/ui)
- api: http://localhost:8080/api/v1/health
- postgres: localhost:5432

Миграции применяются автоматически при старте api.

> Если api не может достучаться до postgres (firewall хоста блокирует
> межконтейнерный трафик — так на текущей dev-машине), добавьте override:
> `docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.hostnet-workaround.yml --env-file deploy/.env up`

## Локальная разработка

### web (Next.js)

```bash
cd web
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run build
npm run gen:api    # регенерация TS-типов из ../api/openapi.yaml
```

Витрина ходит в api по `API_URL` (дефолт `http://localhost:8080`).

### api (Go)

```bash
cd api
go build ./... && go vet ./...

# запуск (нужен Postgres):
docker compose -f ../deploy/docker-compose.yml up -d postgres
DATABASE_URL='postgres://tirestock:tirestock@localhost:5432/tirestock?sslmode=disable' go run ./cmd/api
```

### Тесты api

Юнит-тесты (маппинг фильтров URL→SQL) бегут всегда; интеграционные тесты
outbox-воркера требуют Postgres — задайте `TEST_DATABASE_URL`, иначе они пропускаются:

```bash
docker compose -f ../deploy/docker-compose.yml up -d postgres
TEST_DATABASE_URL='postgres://tirestock:tirestock@localhost:5432/tirestock?sslmode=disable' go test ./...
```

### Кодогенерация

- SQL → Go: `sqlc generate` в `api/` (бинарник: https://github.com/sqlc-dev/sqlc/releases).
  Запросы фич — `api/internal/*/queries.sql`, вывод — `api/internal/db/`.
- OpenAPI → TS: `npm run gen:api` в `web/`. Любое изменение API начинается
  с правки `api/openapi.yaml`, потом код (спека — источник истины).

## Что уже есть / чего нет

Есть: скелет монорепо, токены дизайн-системы (`web/styles/`), UI-кит (`web/components/ui/`,
демо на `/dev/ui`), контракт `api/openapi.yaml` + типизированный клиент (`web/lib/api/`),
каталог и заказы на мок-источниках, Postgres-схема (products, orders, outbox),
outbox-воркер с ретраями (SKIP LOCKED).

Нет (осознанно, см. ARCHITECTURE.md): страниц витрины, реальных интеграций
SelectTyres/tradesk (только интерфейсы `CatalogSource`/`OrderDelivery` + моки), админки.
