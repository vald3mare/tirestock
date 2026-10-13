-- Правка владельца 18.09.2026 по пунктам выдачи:
--  1) Кубинская ул., 4к2 - новый пункт («Кубинки вообще не было»), основной;
--  2) Культуры 61к4 → 61к2 (у нас был неверный корпус);
--  3) Новосёлов 49 → 47 (владелец уточнил номер дома);
--  4) «Основными» (is_main) делаем ровно эти 4: Кубинская 4к2, Торфяная 21,
--     Новосёлов 47, Культуры 61к2 - остальные СПб-пункты перестают быть основными
--     (в т.ч. Полюстровский пр., 73).
-- Slug'и не меняем (внутренние, координаты в витрине привязаны к ним) - правим
-- только отображаемый адрес.

-- Снимаем «основной» со всех пунктов СПб - назначим точечно ниже.
UPDATE pickup_points SET is_main = false WHERE city = 'spb';

-- Правки адресов существующих пунктов.
UPDATE pickup_points SET address = 'ул. Новосёлов, 47', updated_by = 'правка 18.09.2026' WHERE slug = 'novoselov-49';
UPDATE pickup_points SET address = 'пр. Культуры, 61к2', updated_by = 'правка 18.09.2026' WHERE slug = 'kultury-61k4';

-- Новый пункт Кубинская 4к2 (координаты в витрине - POINT_COORDS, примерно у дома 4).
INSERT INTO pickup_points (slug, address, metro, hours, badge, note, is_main, city, sort_order, published, updated_by)
VALUES ('kubinskaya-4k2', 'Кубинская ул., 4к2', 'м. Электросила', '', '−15% на шиномонтаж', '', true, 'spb', 5, true, 'Виталий');

-- Делаем основными ровно 4 адреса.
UPDATE pickup_points SET is_main = true
WHERE slug IN ('kubinskaya-4k2', 'torfyanaya-21', 'novoselov-49', 'kultury-61k4');
