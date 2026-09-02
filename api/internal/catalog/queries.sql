-- Upsert товара из синка SelectTyres (ключ — code). Динамические выборки каталога
-- (листинг с фильтрами) идут сырым pgx через Filters.WhereSQL — здесь только статика.

-- name: UpsertProduct :exec
INSERT INTO products (
    code, slug, brand, model, name, size_label,
    width, profile, diameter, season, spikes, runflat,
    price, stock, image_url, synced_at
) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10, $11, $12,
    $13, $14, $15, now()
)
ON CONFLICT (code) WHERE code <> '' DO UPDATE SET
    slug = EXCLUDED.slug,
    brand = EXCLUDED.brand,
    model = EXCLUDED.model,
    name = EXCLUDED.name,
    size_label = EXCLUDED.size_label,
    width = EXCLUDED.width,
    profile = EXCLUDED.profile,
    diameter = EXCLUDED.diameter,
    season = EXCLUDED.season,
    spikes = EXCLUDED.spikes,
    runflat = EXCLUDED.runflat,
    price = EXCLUDED.price,
    stock = EXCLUDED.stock,
    image_url = EXCLUDED.image_url,
    synced_at = now();

-- name: ZeroStaleStock :execrows
-- Товары, пропавшие из последней выгрузки, гасим до нуля остатка (не в наличии).
UPDATE products SET stock = 0, synced_at = now()
WHERE code <> '' AND synced_at < $1 AND stock <> 0;

-- name: UpsertProductOffer :exec
-- Цена/остаток товара в городе (мультигород). Ключ — (product_code, city).
INSERT INTO product_offers (product_code, city, price, stock, updated_at)
VALUES ($1, $2, $3, $4, now())
ON CONFLICT (product_code, city) DO UPDATE SET
    price = EXCLUDED.price, stock = EXCLUDED.stock, updated_at = now();

-- name: ZeroStaleOffers :execrows
-- Офферы, не обновлённые в текущем прогоне синка (товар пропал со складов города),
-- гасим до нуля остатка. Строки не удаляем — заказы/URL могут ссылаться.
UPDATE product_offers SET stock = 0, updated_at = now()
WHERE updated_at < $1 AND stock <> 0;

-- name: GetCatalogProductBySlug :one
-- City-aware: цена/остаток из оффера города ($2). Товар без оффера в городе → нет строки.
SELECT
    p.id, p.slug, p.code, p.brand, p.model, p.name, p.size_label,
    p.width, p.profile, p.diameter, p.season, p.spikes, p.runflat,
    po.price, po.stock,
    COALESCE(NULLIF(p.image_clean_url, ''), p.image_url) AS image_url,
    COALESCE(o.badge_hit, false) AS badge_hit
FROM products p
JOIN product_offers po ON po.product_code = p.code AND po.city = $2
LEFT JOIN product_overrides o ON o.slug = p.slug
WHERE p.slug = $1 AND COALESCE(o.hidden, false) = false;

-- name: CountSyncedProducts :one
SELECT count(*) FROM products WHERE code <> '';



-- name: UpdateProductImageClean :execrows
UPDATE products SET image_clean_url = $2 WHERE code = $1 AND code <> '';
