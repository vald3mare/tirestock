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

const listCols = `p.id, p.slug, p.brand, p.model, p.name, p.size_label,
	p.width, p.profile, p.diameter, p.season, p.spikes, p.runflat,
	p.price, p.stock, p.image_url, COALESCE(o.badge_hit, false)`

func (s *DBSource) List(ctx context.Context, f Filters, page, perPage int) ([]Product, int, error) {
	where, args := f.WhereSQL(1)
	cond := "COALESCE(o.hidden, false) = false"
	if where != "" {
		cond += " AND " + strings.TrimPrefix(where, "WHERE ")
	}
	from := "FROM products p LEFT JOIN product_overrides o ON o.slug = p.slug WHERE " + cond

	var total int
	if err := s.pool.QueryRow(ctx, "SELECT count(*) "+from, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count products: %w", err)
	}
	if total == 0 {
		return []Product{}, 0, nil
	}

	listSQL := fmt.Sprintf(
		"SELECT %s %s ORDER BY (p.stock > 0) DESC, p.id LIMIT $%d OFFSET $%d",
		listCols, from, len(args)+1, len(args)+2,
	)
	rows, err := s.pool.Query(ctx, listSQL, append(args, perPage, (page-1)*perPage)...)
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

func (s *DBSource) BySlug(ctx context.Context, slug string) (Product, error) {
	r, err := s.q.GetCatalogProductBySlug(ctx, slug)
	if errors.Is(err, pgx.ErrNoRows) {
		return Product{}, ErrNotFound
	}
	if err != nil {
		return Product{}, fmt.Errorf("get product: %w", err)
	}
	return Product{
		ID: r.ID, Slug: r.Slug, Brand: r.Brand, Model: r.Model, Name: r.Name,
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
