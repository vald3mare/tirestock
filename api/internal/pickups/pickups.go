// Package pickups — фича «Пункты выдачи»: пункты выдачи заказов витрины (страница
// /points и /points/<slug>). Истина контента витрины — наша админка (CLAUDE.md):
// адрес/метро/часы, бейдж-акция и «основной адрес» редактируются, а не хардкодятся.
package pickups

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"tirestock/api/internal/db"
)

// DefaultCity — город пунктов по умолчанию (СПб). Возврат Москвы — второй город.
const DefaultCity = "spb"

// Sentinel-ошибки фичи.
var (
	ErrNotFound       = errors.New("pickups: пункт не найден")
	ErrAddressMissing = errors.New("pickups: адрес обязателен")
)

// Point — пункт выдачи. is_main — «основной адрес» (несколько; рендерятся крупной
// карточкой с телефоном, первыми). slug — для отдельной страницы /points/<slug>.
type Point struct {
	ID        int64     `json:"id"`
	Slug      string    `json:"slug"`
	Address   string    `json:"address"`
	Metro     string    `json:"metro"`
	Hours     string    `json:"hours"`
	Badge     string    `json:"badge"`
	Note      string    `json:"note"`
	IsCentral bool      `json:"is_central"`
	IsMain    bool      `json:"is_main"`
	City      string    `json:"city"`
	SortOrder int       `json:"sort_order"`
	Published bool      `json:"published"`
	UpdatedBy string    `json:"updated_by"`
	UpdatedAt time.Time `json:"updated_at"`
}

// row — общий интерфейс sqlc-строк пунктов (все SELECT одинаковой формы).
type row struct {
	ID        int64
	Slug      string
	Address   string
	Metro     string
	Hours     string
	Badge     string
	Note      string
	IsCentral bool
	IsMain    bool
	City      string
	SortOrder int32
	Published bool
	UpdatedBy string
	UpdatedAt pgtype.Timestamptz
}

func mk(r row) Point {
	return Point{
		ID: r.ID, Slug: r.Slug, Address: r.Address, Metro: r.Metro, Hours: r.Hours,
		Badge: r.Badge, Note: r.Note, IsCentral: r.IsCentral, IsMain: r.IsMain,
		City: r.City, SortOrder: int(r.SortOrder), Published: r.Published,
		UpdatedBy: r.UpdatedBy, UpdatedAt: r.UpdatedAt.Time,
	}
}

// Input — редактируемые поля пункта.
type Input struct {
	Slug      string
	Address   string
	Metro     string
	Hours     string
	Badge     string
	Note      string
	IsCentral bool
	IsMain    bool
	City      string
	SortOrder int
	Published bool
}

// Service — бизнес-логика пунктов выдачи поверх sqlc.
type Service struct {
	q *db.Queries
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{q: db.New(pool)}
}

func (s *Service) List(ctx context.Context) ([]Point, error) {
	rows, err := s.q.ListPickupPoints(ctx)
	if err != nil {
		return nil, fmt.Errorf("list pickup points: %w", err)
	}
	out := make([]Point, 0, len(rows))
	for _, r := range rows {
		out = append(out, mk(row(r)))
	}
	return out, nil
}

// ListPublished — опубликованные пункты города (пусто → DefaultCity).
func (s *Service) ListPublished(ctx context.Context, city string) ([]Point, error) {
	if city == "" {
		city = DefaultCity
	}
	rows, err := s.q.ListPublishedPickupPoints(ctx, city)
	if err != nil {
		return nil, fmt.Errorf("list published pickup points: %w", err)
	}
	out := make([]Point, 0, len(rows))
	for _, r := range rows {
		out = append(out, mk(row(r)))
	}
	return out, nil
}

func (s *Service) Get(ctx context.Context, id int64) (Point, error) {
	r, err := s.q.GetPickupPoint(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Point{}, ErrNotFound
	}
	if err != nil {
		return Point{}, fmt.Errorf("get pickup point: %w", err)
	}
	return mk(row(r)), nil
}

// BySlug — опубликованный пункт по slug (для отдельной страницы).
func (s *Service) BySlug(ctx context.Context, slug string) (Point, error) {
	r, err := s.q.GetPickupPointBySlug(ctx, strings.TrimSpace(slug))
	if errors.Is(err, pgx.ErrNoRows) {
		return Point{}, ErrNotFound
	}
	if err != nil {
		return Point{}, fmt.Errorf("get pickup point by slug: %w", err)
	}
	return mk(row(r)), nil
}

func (s *Service) Create(ctx context.Context, in Input, editor string) (Point, error) {
	addr := strings.TrimSpace(in.Address)
	if addr == "" {
		return Point{}, ErrAddressMissing
	}
	slug := strings.TrimSpace(in.Slug)
	if slug == "" {
		slug = slugify(addr)
	}
	r, err := s.q.CreatePickupPoint(ctx, db.CreatePickupPointParams{
		Slug: slug, Address: addr, Metro: strings.TrimSpace(in.Metro), Hours: strings.TrimSpace(in.Hours),
		Badge: strings.TrimSpace(in.Badge), Note: strings.TrimSpace(in.Note),
		IsCentral: in.IsCentral, IsMain: in.IsMain, City: cityOrDefault(in.City),
		SortOrder: int32(in.SortOrder), Published: in.Published, UpdatedBy: editor,
	})
	if err != nil {
		return Point{}, fmt.Errorf("create pickup point: %w", err)
	}
	return mk(row(r)), nil
}

func (s *Service) Update(ctx context.Context, id int64, in Input, editor string) error {
	if _, err := s.Get(ctx, id); err != nil {
		return err
	}
	addr := strings.TrimSpace(in.Address)
	if addr == "" {
		return ErrAddressMissing
	}
	slug := strings.TrimSpace(in.Slug)
	if slug == "" {
		slug = slugify(addr)
	}
	return s.q.UpdatePickupPoint(ctx, db.UpdatePickupPointParams{
		ID: id, Slug: slug, Address: addr, Metro: strings.TrimSpace(in.Metro), Hours: strings.TrimSpace(in.Hours),
		Badge: strings.TrimSpace(in.Badge), Note: strings.TrimSpace(in.Note),
		IsCentral: in.IsCentral, IsMain: in.IsMain, City: cityOrDefault(in.City),
		SortOrder: int32(in.SortOrder), Published: in.Published, UpdatedBy: editor,
	})
}

func (s *Service) Delete(ctx context.Context, id int64) error {
	if _, err := s.Get(ctx, id); err != nil {
		return err
	}
	return s.q.DeletePickupPoint(ctx, id)
}

func cityOrDefault(c string) string {
	if c = strings.TrimSpace(c); c != "" {
		return c
	}
	return DefaultCity
}

// slugify — URL-slug из адреса (транслит кириллицы). Для новых пунктов из админки,
// если slug не задан руками. Сид-пункты несут slug'и явно (миграция 0015).
func slugify(s string) string {
	var b strings.Builder
	prevDash := false
	for _, r := range strings.ToLower(s) {
		if tr, ok := translit[r]; ok {
			b.WriteString(tr)
			prevDash = false
			continue
		}
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			prevDash = false
		default:
			if !prevDash && b.Len() > 0 {
				b.WriteByte('-')
				prevDash = true
			}
		}
	}
	return strings.Trim(b.String(), "-")
}

var translit = map[rune]string{
	'а': "a", 'б': "b", 'в': "v", 'г': "g", 'д': "d", 'е': "e", 'ё': "e",
	'ж': "zh", 'з': "z", 'и': "i", 'й': "y", 'к': "k", 'л': "l", 'м': "m",
	'н': "n", 'о': "o", 'п': "p", 'р': "r", 'с': "s", 'т': "t", 'у': "u",
	'ф': "f", 'х': "h", 'ц': "c", 'ч': "ch", 'ш': "sh", 'щ': "sch", 'ъ': "",
	'ы': "y", 'ь': "", 'э': "e", 'ю': "yu", 'я': "ya",
}
