-- Раздел «Пункты выдачи» админки. Правила — в сервисе internal/pickups.

-- name: ListPickupPoints :many
-- Все пункты для админки (любой статус), основные первыми, затем по порядку.
SELECT id, slug, address, metro, hours, badge, note, is_central, is_main, city, sort_order, published, updated_by, updated_at
FROM pickup_points
ORDER BY is_main DESC, sort_order, id;

-- name: ListPublishedPickupPoints :many
-- Опубликованные пункты для витрины (по городу).
SELECT id, slug, address, metro, hours, badge, note, is_central, is_main, city, sort_order, published, updated_by, updated_at
FROM pickup_points
WHERE published = true AND city = $1
ORDER BY is_main DESC, sort_order, id;

-- name: GetPickupPoint :one
SELECT id, slug, address, metro, hours, badge, note, is_central, is_main, city, sort_order, published, updated_by, updated_at
FROM pickup_points WHERE id = $1;

-- name: GetPickupPointBySlug :one
-- Опубликованный пункт по slug — для отдельной страницы /points/<slug>.
SELECT id, slug, address, metro, hours, badge, note, is_central, is_main, city, sort_order, published, updated_by, updated_at
FROM pickup_points WHERE slug = $1 AND slug <> '' AND published = true;

-- name: CreatePickupPoint :one
INSERT INTO pickup_points (slug, address, metro, hours, badge, note, is_central, is_main, city, sort_order, published, updated_by)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING id, slug, address, metro, hours, badge, note, is_central, is_main, city, sort_order, published, updated_by, updated_at;

-- name: UpdatePickupPoint :exec
UPDATE pickup_points SET
    slug = $2, address = $3, metro = $4, hours = $5, badge = $6, note = $7,
    is_central = $8, is_main = $9, city = $10, sort_order = $11, published = $12,
    updated_by = $13, updated_at = now()
WHERE id = $1;

-- name: DeletePickupPoint :exec
DELETE FROM pickup_points WHERE id = $1;
