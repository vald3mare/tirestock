-- Раздел «SEO-мета» админки. Правила резолва (роут ∥ дефолт) — в сервисе.

-- name: ListSeoMeta :many
-- Все записи для админки; дефолт-шаблон ('*') первым.
SELECT route, label, title, description, is_default, updated_by, updated_at
FROM seo_meta
ORDER BY is_default DESC, route;

-- name: GetSeoMeta :one
SELECT route, label, title, description, is_default, updated_by, updated_at
FROM seo_meta WHERE route = $1;

-- name: UpdateSeoMeta :exec
-- Правит только редактируемые поля (route/label/is_default не меняются из UI).
UPDATE seo_meta SET
    title = $2, description = $3, updated_by = $4, updated_at = now()
WHERE route = $1;
