-- Диски: upsert синком + мультигород-офферы. Динамический листинг — сырым pgx.

-- name: UpsertWheel :exec
INSERT INTO wheels (
    code, slug, brand, model, name, category, width, diameter, pcd,
    bolts_count, bolts_space, et, dia, color, color_human, wheel_type,
    image_url, price, stock, synced_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9,
    $10, $11, $12, $13, $14, $15, $16,
    $17, $18, $19, now()
)
ON CONFLICT (code) WHERE code <> '' DO UPDATE SET
    slug = EXCLUDED.slug, brand = EXCLUDED.brand, model = EXCLUDED.model,
    name = EXCLUDED.name, category = EXCLUDED.category, width = EXCLUDED.width,
    diameter = EXCLUDED.diameter, pcd = EXCLUDED.pcd, bolts_count = EXCLUDED.bolts_count,
    bolts_space = EXCLUDED.bolts_space, et = EXCLUDED.et, dia = EXCLUDED.dia,
    color = EXCLUDED.color, color_human = EXCLUDED.color_human, wheel_type = EXCLUDED.wheel_type,
    image_url = EXCLUDED.image_url, price = EXCLUDED.price, stock = EXCLUDED.stock,
    synced_at = now();

-- name: UpsertWheelOffer :exec
INSERT INTO wheel_offers (wheel_code, city, price, stock, updated_at)
VALUES ($1, $2, $3, $4, now())
ON CONFLICT (wheel_code, city) DO UPDATE SET
    price = EXCLUDED.price, stock = EXCLUDED.stock, updated_at = now();

-- name: ZeroStaleWheelOffers :execrows
UPDATE wheel_offers SET stock = 0, updated_at = now()
WHERE updated_at < $1 AND stock <> 0;

-- name: ZeroStaleWheels :execrows
UPDATE wheels SET stock = 0, synced_at = now()
WHERE code <> '' AND synced_at < $1 AND stock <> 0;

-- name: CountSyncedWheels :one
SELECT count(*) FROM wheels WHERE code <> '';

-- name: GetWheelBySlug :one
-- City-aware: цена/остаток из оффера города ($2). Нет оффера в городе → нет строки.
SELECT w.id, w.slug, w.code, w.brand, w.model, w.name, w.width, w.diameter,
       w.pcd, w.et, w.dia, w.color_human, w.wheel_type, wo.price, wo.stock, w.image_url
FROM wheels w
JOIN wheel_offers wo ON wo.wheel_code = w.code AND wo.city = $2
WHERE w.slug = $1;
