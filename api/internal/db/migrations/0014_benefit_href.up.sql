-- Преимущества (строка офферов над каталогом) становятся кликабельными: ведут на
-- страницу соответствующего сервиса. Плюс убираем оффер «покраска дисков» —
-- услуга больше не оказывается (страница /disk-painting/ удалена).
ALTER TABLE benefits ADD COLUMN href TEXT NOT NULL DEFAULT '';

-- Удаляем оффер покраски дисков (если ещё в сиде).
DELETE FROM benefits WHERE href = '' AND (title ILIKE '%покраск%' OR title ILIKE '%диск%');

-- Проставляем ссылки на существующие офферы по смыслу заголовка.
UPDATE benefits SET href = '/mounting/'        WHERE href = '' AND title ILIKE '%шиномонтаж%';
UPDATE benefits SET href = '/services/storage' WHERE href = '' AND title ILIKE '%хранени%';
UPDATE benefits SET href = '/delivery/'        WHERE href = '' AND title ILIKE '%доставк%';
