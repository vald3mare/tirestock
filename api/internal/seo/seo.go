// Package seo — фича «SEO-мета»: title/description статических маршрутов витрины,
// редактируемые в админке. Истина SEO-меты витрины (кроме контентных страниц,
// у которых своя) живёт здесь. SEO — священная корова (CLAUDE.md).
package seo

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

// DefaultRoute — зарезервированный ключ дефолт-шаблона (fallback по полям).
const DefaultRoute = "*"

// Sentinel-ошибки фичи.
var (
	ErrNotFound = errors.New("seo: маршрут не найден")
)

// Meta — SEO-мета одного маршрута.
type Meta struct {
	Route       string    `json:"route"`
	Label       string    `json:"label"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	IsDefault   bool      `json:"is_default"`
	UpdatedBy   string    `json:"updated_by"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Resolved — эффективная мета маршрута (после подстановки дефолта по полям).
type Resolved struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

func mk(route, label, title, desc string, isDefault bool, by string, at pgtype.Timestamptz) Meta {
	return Meta{
		Route: route, Label: label, Title: title, Description: desc,
		IsDefault: isDefault, UpdatedBy: by, UpdatedAt: at.Time,
	}
}

// Input — редактируемые поля меты.
type Input struct {
	Title       string
	Description string
}

// Service — бизнес-логика SEO-меты поверх sqlc.
type Service struct {
	q *db.Queries
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{q: db.New(pool)}
}

// List — все записи для админки (дефолт первым).
func (s *Service) List(ctx context.Context) ([]Meta, error) {
	rows, err := s.q.ListSeoMeta(ctx)
	if err != nil {
		return nil, fmt.Errorf("list seo meta: %w", err)
	}
	out := make([]Meta, 0, len(rows))
	for _, r := range rows {
		out = append(out, mk(r.Route, r.Label, r.Title, r.Description, r.IsDefault, r.UpdatedBy, r.UpdatedAt))
	}
	return out, nil
}

func (s *Service) Get(ctx context.Context, route string) (Meta, error) {
	r, err := s.q.GetSeoMeta(ctx, route)
	if errors.Is(err, pgx.ErrNoRows) {
		return Meta{}, ErrNotFound
	}
	if err != nil {
		return Meta{}, fmt.Errorf("get seo meta: %w", err)
	}
	return mk(r.Route, r.Label, r.Title, r.Description, r.IsDefault, r.UpdatedBy, r.UpdatedAt), nil
}

func (s *Service) Update(ctx context.Context, route string, in Input, editor string) error {
	if _, err := s.Get(ctx, route); err != nil {
		return err
	}
	return s.q.UpdateSeoMeta(ctx, db.UpdateSeoMetaParams{
		Route: route, Title: strings.TrimSpace(in.Title),
		Description: strings.TrimSpace(in.Description), UpdatedBy: editor,
	})
}

// Resolve возвращает эффективную мету маршрута: значения роута, а по пустым полям —
// подстановка из дефолт-шаблона ('*'). Неизвестный маршрут → чистый дефолт.
func (s *Service) Resolve(ctx context.Context, route string) (Resolved, error) {
	def, err := s.Get(ctx, DefaultRoute)
	if err != nil && !errors.Is(err, ErrNotFound) {
		return Resolved{}, err
	}
	res := Resolved{Title: def.Title, Description: def.Description}

	if route != DefaultRoute {
		m, err := s.Get(ctx, route)
		if err == nil {
			if strings.TrimSpace(m.Title) != "" {
				res.Title = m.Title
			}
			if strings.TrimSpace(m.Description) != "" {
				res.Description = m.Description
			}
		} else if !errors.Is(err, ErrNotFound) {
			return Resolved{}, err
		}
	}
	return res, nil
}
