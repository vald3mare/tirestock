-- Поля для синка каталога из SelectTyres. code — стабильный идентификатор товара
-- в фиде (ключ upsert и связка ассортимент↔остатки). image_url — фото из фида.
ALTER TABLE products ADD COLUMN code       TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN image_url  TEXT NOT NULL DEFAULT '';

-- Уникальность по code (upsert синка). slug остаётся уникальным для URL витрины.
CREATE UNIQUE INDEX products_code_idx ON products (code) WHERE code <> '';
