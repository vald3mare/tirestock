-- Мультигород отменён (решение владельца 11.08.2026): магазин работает только
-- по Санкт-Петербургу, городских поддоменов не будет.
--
-- Цена и остаток и так велись в products как снапшот СПб (см. syncstore), а
-- product_offers добавляла второе измерение «город» — теперь оно лишнее.
-- Перед удалением подтягиваем в products петербургские значения: если фид
-- почему-то не успел обновить снапшот, каталог не должен просесть.
UPDATE products p
SET price = po.price,
    stock = po.stock
FROM product_offers po
WHERE po.product_code = p.code
  AND po.city = 'spb'
  AND (p.price <> po.price OR p.stock <> po.stock);

-- Товары БЕЗ петербургского предложения — это ассортимент чужих городов
-- (в products они лежали со снапшотом первого попавшегося города). Раньше их
-- прятал JOIN по городу, теперь листинг читает products напрямую — значит,
-- их надо убрать, иначе в каталоге СПб появятся московские позиции.
-- Заказы не пострадают: позиции заказа хранятся снимком в orders.items.
DELETE FROM products p
WHERE p.code <> ''
  AND NOT EXISTS (
      SELECT 1 FROM product_offers po
      WHERE po.product_code = p.code AND po.city = 'spb'
  );

DROP TABLE IF EXISTS product_offers;
