-- ── Пользователи / сессии ──────────────────────────────────────────────────

-- name: CountAdminUsers :one
SELECT count(*) FROM admin_users;

-- name: InsertAdminUser :one
INSERT INTO admin_users (username, password_hash, display_name)
VALUES ($1, $2, $3)
RETURNING id;

-- name: GetAdminUserByUsername :one
SELECT id, username, password_hash, display_name
FROM admin_users
WHERE username = $1;

-- name: CreateSession :exec
INSERT INTO admin_sessions (token_hash, user_id, expires_at)
VALUES ($1, $2, $3);

-- name: GetSessionUser :one
SELECT u.id, u.username, u.display_name
FROM admin_sessions s
JOIN admin_users u ON u.id = s.user_id
WHERE s.token_hash = $1 AND s.expires_at > now();

-- name: DeleteSession :exec
DELETE FROM admin_sessions WHERE token_hash = $1;

-- name: DeleteExpiredSessions :exec
DELETE FROM admin_sessions WHERE expires_at <= now();

-- ── Заказы (проекция для админки: заказ + статус доставки из outbox) ─────────

-- name: ListOrders :many
SELECT
    o.id,
    o.customer_name,
    o.phone,
    o.total,
    o.created_at,
    COALESCE(ob.status, 'pending') AS delivery_status,
    COALESCE(ob.attempts, 0)       AS attempts,
    COALESCE(ob.last_error, '')    AS last_error
FROM orders o
LEFT JOIN outbox ob
    ON ob.kind = 'order' AND (ob.payload->>'order_id')::bigint = o.id
WHERE sqlc.arg('status')::text = '' OR COALESCE(ob.status, 'pending') = sqlc.arg('status')::text
ORDER BY o.id DESC
LIMIT $1 OFFSET $2;

-- name: OrderStats :one
SELECT
    count(*) FILTER (WHERE o.created_at::date = now()::date)          AS today,
    count(*) FILTER (WHERE COALESCE(ob.status, 'pending') = 'pending') AS queued,
    count(*) FILTER (WHERE ob.status = 'failed')                      AS failed
FROM orders o
LEFT JOIN outbox ob
    ON ob.kind = 'order' AND (ob.payload->>'order_id')::bigint = o.id;

-- name: RetryOrderDelivery :exec
UPDATE outbox
SET status = 'pending', next_retry_at = now(), last_error = '', updated_at = now()
WHERE kind = 'order'
  AND status = 'failed'
  AND (payload->>'order_id')::bigint = sqlc.arg('order_id')::bigint;

-- ── Оверрайды товаров ───────────────────────────────────────────────────────

-- name: ListOverrides :many
SELECT slug, hidden, badge_hit FROM product_overrides;

-- name: UpsertOverride :exec
INSERT INTO product_overrides (slug, hidden, badge_hit, updated_by, updated_at)
VALUES ($1, $2, $3, $4, now())
ON CONFLICT (slug) DO UPDATE
SET hidden = EXCLUDED.hidden,
    badge_hit = EXCLUDED.badge_hit,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();
