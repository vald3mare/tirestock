-- Раздел «Пункты выдачи» админки. Правила — в сервисе internal/pickups.

-- name: ListPickupPoints :many
-- Все пункты для админки (любой статус), центральный первым, затем по порядку.
SELECT id, address, metro, hours, badge, note, is_central, sort_order, published, updated_by, updated_at
FROM pickup_points
ORDER BY is_central DESC, sort_order, id;

-- name: ListPublishedPickupPoints :many
-- Опубликованные пункты для витрины.
SELECT id, address, metro, hours, badge, note, is_central, sort_order, published, updated_by, updated_at
FROM pickup_points
WHERE published = true
ORDER BY is_central DESC, sort_order, id;

-- name: GetPickupPoint :one
SELECT id, address, metro, hours, badge, note, is_central, sort_order, published, updated_by, updated_at
FROM pickup_points WHERE id = $1;

-- name: CreatePickupPoint :one
INSERT INTO pickup_points (address, metro, hours, badge, note, is_central, sort_order, published, updated_by)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, address, metro, hours, badge, note, is_central, sort_order, published, updated_by, updated_at;

-- name: UpdatePickupPoint :exec
UPDATE pickup_points SET
    address = $2, metro = $3, hours = $4, badge = $5, note = $6,
    is_central = $7, sort_order = $8, published = $9, updated_by = $10, updated_at = now()
WHERE id = $1;

-- name: DeletePickupPoint :exec
DELETE FROM pickup_points WHERE id = $1;
