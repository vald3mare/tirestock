-- Откат правки 18.09.2026: возвращаем прежние адреса/основные и убираем Кубинскую.
DELETE FROM pickup_points WHERE slug = 'kubinskaya-4k2';
UPDATE pickup_points SET address = 'ул. Новосёлов, 49' WHERE slug = 'novoselov-49';
UPDATE pickup_points SET address = 'пр. Культуры, 61к4' WHERE slug = 'kultury-61k4';
UPDATE pickup_points SET is_main = false WHERE city = 'spb';
UPDATE pickup_points SET is_main = true
WHERE slug IN ('novoselov-49', 'torfyanaya-21', 'polyustrovskiy-73');
