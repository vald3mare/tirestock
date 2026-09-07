package catalog

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"tirestock/api/internal/db"
)

// DBWheelSource — каталог дисков из БД (wheels + wheel_offers). City-aware:
// INNER JOIN оффера города, цена/остаток из оффера. Изолирован от шин.
type DBWheelSource struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewDBWheelSource(pool *pgxpool.Pool) *DBWheelSource {
	return &DBWheelSource{pool: pool, q: db.New(pool)}
}

const wheelListCols = `w.id, w.slug, w.code, w.brand, w.model, w.name, w.width, w.diameter,
	w.pcd, w.et, w.dia, w.color_human, w.wheel_type, wo.price, wo.stock, w.image_url`

func (s *DBWheelSource) List(ctx context.Context, f WheelFilters, page, perPage int) ([]Wheel, int, error) {
	city := cityOrDefault(f.City)
	where, filterArgs := f.WhereSQL(2) // $1 — город
	allArgs := append([]any{city}, filterArgs...)

	cond := "w.code <> ''"
	if where != "" {
		cond += " AND " + trimWherePrefix(where)
	}
	from := "FROM wheels w " +
		"JOIN wheel_offers wo ON wo.wheel_code = w.code AND wo.city = $1 WHERE " + cond

	var total int
	if err := s.pool.QueryRow(ctx, "SELECT count(*) "+from, allArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count wheels: %w", err)
	}
	if total == 0 {
		return []Wheel{}, 0, nil
	}

	orderBy := wheelSortOrders[f.Sort]
	listSQL := fmt.Sprintf("SELECT %s %s ORDER BY %s LIMIT $%d OFFSET $%d",
		wheelListCols, from, orderBy, len(allArgs)+1, len(allArgs)+2)
	rows, err := s.pool.Query(ctx, listSQL, append(allArgs, perPage, (page-1)*perPage)...)
	if err != nil {
		return nil, 0, fmt.Errorf("list wheels: %w", err)
	}
	defer rows.Close()

	items := make([]Wheel, 0, perPage)
	for rows.Next() {
		w, err := scanWheel(rows)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, w)
	}
	return items, total, rows.Err()
}

func (s *DBWheelSource) BySlug(ctx context.Context, slug, city string) (Wheel, error) {
	r, err := s.q.GetWheelBySlug(ctx, db.GetWheelBySlugParams{Slug: slug, City: cityOrDefault(city)})
	if errors.Is(err, pgx.ErrNoRows) {
		return Wheel{}, ErrNotFound
	}
	if err != nil {
		return Wheel{}, fmt.Errorf("get wheel: %w", err)
	}
	return Wheel{
		ID: r.ID, Slug: r.Slug, Code: r.Code, Brand: r.Brand, Model: r.Model, Name: r.Name,
		Width: r.Width, Diameter: int(r.Diameter), PCD: r.Pcd, ET: r.Et, DIA: r.Dia,
		Color: r.ColorHuman, WheelType: r.WheelType, Price: int(r.Price), Stock: int(r.Stock),
		ImageURL: r.ImageUrl,
	}, nil
}

func scanWheel(rows pgx.Rows) (Wheel, error) {
	var w Wheel
	if err := rows.Scan(
		&w.ID, &w.Slug, &w.Code, &w.Brand, &w.Model, &w.Name, &w.Width, &w.Diameter,
		&w.PCD, &w.ET, &w.DIA, &w.Color, &w.WheelType, &w.Price, &w.Stock, &w.ImageURL,
	); err != nil {
		return Wheel{}, fmt.Errorf("scan wheel: %w", err)
	}
	return w, nil
}

// Facets — реальные значения фильтров дисков в наличии города (для сайдбара).
func (s *DBWheelSource) Facets(ctx context.Context, city string) (WheelFacets, error) {
	city = cityOrDefault(city)
	q := fmt.Sprintf(`
SELECT
  array_agg(DISTINCT w.brand ORDER BY w.brand) FILTER (WHERE w.brand <> ''),
  array_agg(DISTINCT w.diameter ORDER BY w.diameter) FILTER (WHERE w.diameter BETWEEN %d AND %d),
  array_agg(DISTINCT w.width ORDER BY w.width) FILTER (WHERE w.width BETWEEN %g AND %g),
  array_agg(DISTINCT w.pcd ORDER BY w.pcd) FILTER (WHERE w.pcd <> ''),
  array_agg(DISTINCT w.wheel_type ORDER BY w.wheel_type) FILTER (WHERE w.wheel_type <> '')
FROM wheels w
JOIN wheel_offers wo ON wo.wheel_code = w.code AND wo.city = $1
WHERE w.code <> ''`,
		WheelMinDiameter, WheelMaxDiameter, WheelMinWidth, WheelMaxWidth)
	var f WheelFacets
	var d []int32
	if err := s.pool.QueryRow(ctx, q, city).Scan(&f.Brands, &d, &f.Widths, &f.PCDs, &f.Types); err != nil {
		return WheelFacets{}, fmt.Errorf("wheel facets: %w", err)
	}
	f.Diameters = int32sToInts(d)
	// Инвариант контракта: required-массивы не nil.
	if f.Brands == nil {
		f.Brands = []string{}
	}
	if f.Widths == nil {
		f.Widths = []float64{}
	}
	if f.PCDs == nil {
		f.PCDs = []string{}
	}
	if f.Types == nil {
		f.Types = []string{}
	}
	return f, nil
}

// trimWherePrefix убирает ведущее "WHERE " (условия склеиваются в общий cond).
func trimWherePrefix(s string) string {
	const p = "WHERE "
	if len(s) >= len(p) && s[:len(p)] == p {
		return s[len(p):]
	}
	return s
}
