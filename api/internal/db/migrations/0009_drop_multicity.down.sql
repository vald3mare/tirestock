-- Возврат к модели с городами: таблица воссоздаётся и наполняется из products
-- (единственный город, который у нас есть, — СПб).
CREATE TABLE IF NOT EXISTS product_offers (
    product_code TEXT        NOT NULL,
    city         TEXT        NOT NULL,
    price        BIGINT      NOT NULL,
    stock        INT         NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (product_code, city)
);

INSERT INTO product_offers (product_code, city, price, stock)
SELECT code, 'spb', price, stock FROM products WHERE code <> ''
ON CONFLICT (product_code, city) DO NOTHING;
