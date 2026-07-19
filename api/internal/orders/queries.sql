-- name: GetOrderIDByIdempotencyKey :one
SELECT id FROM orders WHERE idempotency_key = $1;

-- name: InsertOrder :one
INSERT INTO orders (idempotency_key, customer_name, phone, comment, items, total)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id;

-- name: InsertOutbox :one
INSERT INTO outbox (kind, payload)
VALUES ($1, $2)
RETURNING id;

-- name: ClaimOutbox :many
SELECT id, kind, payload, attempts
FROM outbox
WHERE status = 'pending' AND next_retry_at <= now()
ORDER BY id
LIMIT $1
FOR UPDATE SKIP LOCKED;

-- name: MarkOutboxDelivered :exec
UPDATE outbox
SET status = 'delivered', updated_at = now()
WHERE id = $1;

-- name: RescheduleOutbox :exec
UPDATE outbox
SET attempts = attempts + 1, next_retry_at = $2, last_error = $3, updated_at = now()
WHERE id = $1;

-- name: MarkOutboxFailed :exec
UPDATE outbox
SET status = 'failed', attempts = attempts + 1, last_error = $2, updated_at = now()
WHERE id = $1;

-- name: GetOutbox :one
SELECT id, kind, payload, status, attempts, next_retry_at, last_error
FROM outbox
WHERE id = $1;
