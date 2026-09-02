-- Откат к СПб-only: снапшот СПб обратно в products, удаление офферов.
UPDATE products p
SET price = po.price, stock = po.stock
FROM product_offers po
WHERE po.product_code = p.code AND po.city = 'spb';

DROP TABLE IF EXISTS product_offers;
