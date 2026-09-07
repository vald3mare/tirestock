-- Контентные страницы админки. Правила блокировки — в сервисе internal/content.

-- name: ListContentPages :many
SELECT id, slug, title, body, meta_title, meta_description,
       published, indexed, system, updated_by, updated_at
FROM content_pages
ORDER BY published DESC, id;

-- name: ListPublishedByPrefix :many
-- Опубликованные страницы под префиксом URL (напр. '/news/') — для раздела-листинга.
-- Сам префикс-индекс (slug = префикс) исключаем. Свежие сверху.
SELECT id, slug, title, body, meta_title, meta_description,
       published, indexed, system, updated_by, updated_at
FROM content_pages
WHERE published = true AND slug LIKE $1 || '%' AND slug <> $1
ORDER BY updated_at DESC, id DESC;

-- name: GetContentPage :one
SELECT id, slug, title, body, meta_title, meta_description,
       published, indexed, system, updated_by, updated_at
FROM content_pages WHERE id = $1;

-- name: GetContentPageBySlug :one
SELECT id, slug, title, body, meta_title, meta_description,
       published, indexed, system, updated_by, updated_at
FROM content_pages WHERE slug = $1;

-- name: CreateContentPage :one
INSERT INTO content_pages (slug, title, updated_by)
VALUES ($1, $2, $3)
RETURNING id, slug, title, body, meta_title, meta_description,
          published, indexed, system, updated_by, updated_at;

-- name: UpdateContentPage :exec
UPDATE content_pages SET
    title = $2, body = $3, meta_title = $4, meta_description = $5,
    updated_by = $6, updated_at = now()
WHERE id = $1;

-- name: RenameContentPage :exec
-- Смена URL — только для черновиков (проверяется в сервисе).
UPDATE content_pages SET slug = $2, updated_by = $3, updated_at = now()
WHERE id = $1;

-- name: SetContentPagePublished :exec
-- Публикация делает indexed=true липко (SEO-адрес закрепляется); снятие с
-- публикации не сбрасывает indexed.
UPDATE content_pages SET
    published = $2, indexed = content_pages.indexed OR $2,
    updated_by = $3, updated_at = now()
WHERE id = $1;

-- name: DeleteContentPage :exec
DELETE FROM content_pages WHERE id = $1;
