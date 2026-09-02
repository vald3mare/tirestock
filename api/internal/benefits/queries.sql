-- Раздел «Преимущества» админки (строка офферов BenefitsBar). Правила — в сервисе.

-- name: ListBenefits :many
-- Все офферы для админки (любой статус), в порядке вывода.
SELECT id, icon, title, note, href, sort_order, published, updated_by, updated_at
FROM benefits
ORDER BY sort_order, id;

-- name: ListPublishedBenefits :many
-- Опубликованные офферы для витрины.
SELECT id, icon, title, note, href, sort_order, published, updated_by, updated_at
FROM benefits
WHERE published = true
ORDER BY sort_order, id;

-- name: GetBenefit :one
SELECT id, icon, title, note, href, sort_order, published, updated_by, updated_at
FROM benefits WHERE id = $1;

-- name: CreateBenefit :one
INSERT INTO benefits (icon, title, note, href, sort_order, updated_by)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, icon, title, note, href, sort_order, published, updated_by, updated_at;

-- name: UpdateBenefit :exec
UPDATE benefits SET
    icon = $2, title = $3, note = $4, href = $5, sort_order = $6, published = $7,
    updated_by = $8, updated_at = now()
WHERE id = $1;

-- name: DeleteBenefit :exec
DELETE FROM benefits WHERE id = $1;
