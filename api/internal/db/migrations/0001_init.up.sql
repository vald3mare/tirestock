-- Read-модель каталога (истина — SelectTyres, заполняется синком; сейчас пусто, мок в памяти)
CREATE TABLE products (
    id         BIGSERIAL PRIMARY KEY,
    slug       TEXT        NOT NULL UNIQUE,
    brand      TEXT        NOT NULL,
    model      TEXT        NOT NULL,
    name       TEXT        NOT NULL,
    size_label TEXT        NOT NULL,
    width      INT         NOT NULL,
    profile    INT         NOT NULL,
    diameter   INT         NOT NULL,
    season     TEXT        NOT NULL CHECK (season IN ('summer', 'winter', 'allseason')),
    spikes     BOOLEAN     NOT NULL DEFAULT FALSE,
    runflat    BOOLEAN     NOT NULL DEFAULT FALSE,
    price      INT         NOT NULL,
    stock      INT         NOT NULL DEFAULT 0,
    synced_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX products_size_idx ON products (diameter, width, profile);
CREATE INDEX products_season_idx ON products (season);
CREATE INDEX products_brand_idx ON products (brand);

-- Заказы: пишутся у нас, доставляются в tradesk воркером через outbox
CREATE TABLE orders (
    id              BIGSERIAL PRIMARY KEY,
    idempotency_key TEXT        NOT NULL UNIQUE,
    customer_name   TEXT        NOT NULL,
    phone           TEXT        NOT NULL,
    comment         TEXT        NOT NULL DEFAULT '',
    items           JSONB       NOT NULL,
    total           INT         NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Outbox: заказ/заявка пишется транзакционно со строкой outbox (status=pending).
-- Воркер забирает через FOR UPDATE SKIP LOCKED, ретраи с экспонентой,
-- после N неудач — status=failed (виден в админке с кнопкой «повторить»).
CREATE TABLE outbox (
    id            BIGSERIAL PRIMARY KEY,
    kind          TEXT        NOT NULL CHECK (kind IN ('order', 'callback')),
    payload       JSONB       NOT NULL,
    status        TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
    attempts      INT         NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error    TEXT        NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX outbox_pending_idx ON outbox (next_retry_at) WHERE status = 'pending';
