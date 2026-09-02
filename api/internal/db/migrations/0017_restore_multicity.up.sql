-- Возврат мультигорода: Санкт-Петербург + Москва (решение владельца 25.08.2026).
-- БЕЗ 60 городских поддоменов старого сайта — только два города с переключателем.
-- Отменяет 0009. Цена/остаток снова ведутся по городу в product_offers; products
-- держит городонезависимые атрибуты (бренд/модель/размер/сезон/фото/код).
CREATE TABLE product_offers (
    product_code TEXT        NOT NULL,
    city         TEXT        NOT NULL,
    price        BIGINT      NOT NULL,
    stock        INTEGER     NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (product_code, city)
);
CREATE INDEX product_offers_city_stock_idx ON product_offers (city, stock);

-- Бэкфилл СПб из products (текущий снапшот петербургских цен), чтобы каталог СПб
-- работал сразу, до первого мультигород-синка. Москва наполнится синком.
INSERT INTO product_offers (product_code, city, price, stock)
SELECT code, 'spb', price, stock FROM products WHERE code <> ''
ON CONFLICT (product_code, city) DO NOTHING;
