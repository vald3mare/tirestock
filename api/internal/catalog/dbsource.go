package catalog

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"tirestock/api/internal/db"
)

// DBSource — источник каталога на read-модели products (наполняется синком
// SelectTyres). Реализует CatalogSource. Скрытые оверрайдом товары не отдаёт,
// бейдж «Хит» подмешивает из product_overrides.
type DBSource struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewDBSource(pool *pgxpool.Pool) *DBSource {
	return &DBSource{pool: pool, q: db.New(pool)}
}

// DefaultCity — базовый город каталога (мультигород: СПб + Москва).
const DefaultCity = "spb"

func cityOrDefault(c string) string {
	if c = strings.TrimSpace(c); c != "" {
		return c
	}
	return DefaultCity
}

// Цена/остаток — из оффера города (po.*), не из снапшота products.
const listCols = `p.id, p.slug, p.brand, p.model, p.name, p.size_label,
	p.width, p.profile, p.diameter, p.season, p.spikes, p.runflat,
	po.price, po.stock, COALESCE(NULLIF(p.image_clean_url, ''), p.image_url), COALESCE(o.badge_hit, false)`

func (s *DBSource) List(ctx context.Context, f Filters, page, perPage int) ([]Product, int, error) {
	// $1 — город (INNER JOIN оффера); фильтры нумеруются с $2.
	city := cityOrDefault(f.City)
	where, filterArgs := f.WhereSQL(2)
	allArgs := append([]any{city}, filterArgs...)

	cond := "p.code <> '' AND COALESCE(o.hidden, false) = false"
	if where != "" {
		cond += " AND " + strings.TrimPrefix(where, "WHERE ")
	}
	// INNER JOIN product_offers: товар без оффера в городе в каталог не попадает.
	from := "FROM products p " +
		"JOIN product_offers po ON po.product_code = p.code AND po.city = $1 " +
		"LEFT JOIN product_overrides o ON o.slug = p.slug WHERE " + cond

	var total int
	if err := s.pool.QueryRow(ctx, "SELECT count(*) "+from, allArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count products: %w", err)
	}
	if total == 0 {
		return []Product{}, 0, nil
	}

	// ORDER BY берётся из белого списка SortOrders (не из ввода) — SQL-инъекция исключена.
	orderBy := SortOrders[f.Sort]
	listSQL := fmt.Sprintf(
		"SELECT %s %s ORDER BY %s LIMIT $%d OFFSET $%d",
		listCols, from, orderBy, len(allArgs)+1, len(allArgs)+2,
	)
	rows, err := s.pool.Query(ctx, listSQL, append(allArgs, perPage, (page-1)*perPage)...)
	if err != nil {
		return nil, 0, fmt.Errorf("list products: %w", err)
	}
	defer rows.Close()

	items := make([]Product, 0, perPage)
	for rows.Next() {
		p, err := scanProduct(rows)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, p)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (s *DBSource) BySlug(ctx context.Context, slug, city string) (Product, error) {
	r, err := s.q.GetCatalogProductBySlug(ctx, db.GetCatalogProductBySlugParams{
		Slug: slug, City: cityOrDefault(city),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Product{}, ErrNotFound
	}
	if err != nil {
		return Product{}, fmt.Errorf("get product: %w", err)
	}
	return Product{
		ID: r.ID, Slug: r.Slug, Code: r.Code, Brand: r.Brand, Model: r.Model, Name: r.Name,
		SizeLabel: r.SizeLabel, Width: int(r.Width), Profile: int(r.Profile),
		Diameter: int(r.Diameter), Season: Season(r.Season), Spikes: r.Spikes,
		Runflat: r.Runflat, Price: int(r.Price), Stock: int(r.Stock),
		ImageURL: r.ImageUrl, BadgeHit: r.BadgeHit,
	}, nil
}

// scanProduct читает строку листинга (порядок = listCols).
func scanProduct(rows pgx.Rows) (Product, error) {
	var p Product
	var season string
	if err := rows.Scan(
		&p.ID, &p.Slug, &p.Brand, &p.Model, &p.Name, &p.SizeLabel,
		&p.Width, &p.Profile, &p.Diameter, &season, &p.Spikes, &p.Runflat,
		&p.Price, &p.Stock, &p.ImageURL, &p.BadgeHit,
	); err != nil {
		return Product{}, fmt.Errorf("scan product: %w", err)
	}
	p.Season = Season(season)
	return p, nil
}

// Facets возвращает реальные значения фильтров, присутствующие в каталоге
// (не скрытые товары). array_agg с FILTER отсекает пустые бренды; NULL-массивы
// (пустой каталог) сканируются в nil-срезы — витрина отдаст пустые списки.
func (s *DBSource) Facets(ctx context.Context, city string) (Facets, error) {
	city = cityOrDefault(city)
	// City-aware: только товары с оффером в городе. FILTER по санитарным диапазонам
	// отсекает битые значения фида (width=7 и т.п.).
	q := fmt.Sprintf(`
SELECT
  array_agg(DISTINCT p.brand ORDER BY p.brand) FILTER (WHERE p.brand <> ''),
  array_agg(DISTINCT p.width ORDER BY p.width) FILTER (WHERE p.width BETWEEN %d AND %d),
  array_agg(DISTINCT p.profile ORDER BY p.profile) FILTER (WHERE p.profile BETWEEN %d AND %d),
  array_agg(DISTINCT p.diameter ORDER BY p.diameter) FILTER (WHERE p.diameter BETWEEN %d AND %d)
FROM products p
JOIN product_offers po ON po.product_code = p.code AND po.city = $1
LEFT JOIN product_overrides o ON o.slug = p.slug
WHERE p.code <> '' AND COALESCE(o.hidden, false) = false`,
		MinWidth, MaxWidth, MinProfile, MaxProfile, MinDiameter, MaxDiameter)
	var f Facets
	var w, pr, d []int32
	if err := s.pool.QueryRow(ctx, q, city).Scan(&f.Brands, &w, &pr, &d); err != nil {
		return Facets{}, fmt.Errorf("facets: %w", err)
	}
	f.Widths = int32sToInts(w)
	f.Profiles = int32sToInts(pr)
	f.Diameters = int32sToInts(d)

	sizes, err := s.popularSizes(ctx, city)
	if err != nil {
		return Facets{}, err
	}
	f.PopularSizes = sizes
	// Инвариант контракта: все required-массивы НЕ nil (JSON [], не null), даже при
	// пустом каталоге города — иначе клиент падает на .length. array_agg возвращает
	// NULL при отсутствии строк, поэтому Brands/PopularSizes страхуем явно.
	if f.Brands == nil {
		f.Brands = []string{}
	}
	if f.PopularSizes == nil {
		f.PopularSizes = []Size{}
	}
	return f, nil
}

// popularSizes — топ типоразмеров по числу товаров в наличии в городе (чипы «Популярно»).
func (s *DBSource) popularSizes(ctx context.Context, city string) ([]Size, error) {
	q := fmt.Sprintf(`
SELECT p.width, p.profile, p.diameter
FROM products p
JOIN product_offers po ON po.product_code = p.code AND po.city = $1
LEFT JOIN product_overrides o ON o.slug = p.slug
WHERE p.code <> '' AND COALESCE(o.hidden, false) = false AND po.stock > 0
  AND p.width BETWEEN %d AND %d AND p.profile BETWEEN %d AND %d AND p.diameter BETWEEN %d AND %d
GROUP BY p.width, p.profile, p.diameter
ORDER BY count(*) DESC, p.width, p.profile, p.diameter
LIMIT 4`,
		MinWidth, MaxWidth, MinProfile, MaxProfile, MinDiameter, MaxDiameter)
	rows, err := s.pool.Query(ctx, q, city)
	if err != nil {
		return nil, fmt.Errorf("popular sizes: %w", err)
	}
	defer rows.Close()
	var out []Size
	for rows.Next() {
		var wd, pf, dm int32
		if err := rows.Scan(&wd, &pf, &dm); err != nil {
			return nil, fmt.Errorf("scan popular size: %w", err)
		}
		out = append(out, Size{
			Width: int(wd), Profile: int(pf), Diameter: int(dm),
			Label: fmt.Sprintf("%d/%d R%d", wd, pf, dm),
		})
	}
	return out, rows.Err()
}

func int32sToInts(src []int32) []int {
	out := make([]int, len(src))
	for i, v := range src {
		out[i] = int(v)
	}
	return out
}
