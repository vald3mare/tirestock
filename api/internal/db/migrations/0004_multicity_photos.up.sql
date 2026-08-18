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
