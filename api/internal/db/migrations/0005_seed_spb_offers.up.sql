-- Сид product_offers для СПб из денормализованного снапшота products.
-- Назначение: каталог city-aware читает product_offers; если синк SelectTyres
-- недоступен (напр. фид отдаёт 403), офферы пусты и каталог полностью исчезает.
-- Этот сид восстанавливает СПб-офферы из последнего известного снапшота products
-- (products.price/stock ведёт синк, см. defaultOfferSnapshot). Идемпотентно:
-- ON CONFLICT DO NOTHING — реальные офферы синка не перетираются. На свежей БД
-- (products пуст) сид — no-op, данные наполнит реальный синк.
INSERT INTO product_offers (product_code, city, price, stock, updated_at)
SELECT code, 'spb', price, stock, now()
FROM products
WHERE code <> '' AND price > 0
ON CONFLICT (product_code, city) DO NOTHING;
