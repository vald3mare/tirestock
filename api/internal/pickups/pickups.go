// Package pickups — фича «Пункты выдачи»: пункты выдачи заказов витрины (страница
// /points). Истина контента витрины — наша админка (CLAUDE.md): адрес/метро/часы
// и бейдж-акция каждого пункта редактируются, а не хардкодятся.
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

// Sentinel-ошибки фичи.
var (
	ErrNotFound       = errors.New("pickups: пункт не найден")
	ErrAddressMissing = errors.New("pickups: адрес обязателен")
)

// Point — пункт выдачи. is_central — центральный склад (рендерится отдельно:
// телефон, «основной», полный сервис). badge — акция («−15% на шиномонтаж»).
type Point struct {
	ID        int64     `json:"id"`
	Address   string    `json:"address"`
	Metro     string    `json:"metro"`
	Hours     string    `json:"hours"`
	Badge     string    `json:"badge"`
	Note      string    `json:"note"`
	IsCentral bool      `json:"is_central"`
	SortOrder int       `json:"sort_order"`
	Published bool      `json:"published"`
	UpdatedBy string    `json:"updated_by"`
	UpdatedAt time.Time `json:"updated_at"`
}

func mk(id int64, addr, metro, hours, badge, note string, central bool, sort int32, pub bool, by string, at pgtype.Timestamptz) Point {
	return Point{
		ID: id, Address: addr, Metro: metro, Hours: hours, Badge: badge, Note: note,
		IsCentral: central, SortOrder: int(sort), Published: pub, UpdatedBy: by, UpdatedAt: at.Time,
	}
}

// Input — редактируемые поля пункта.
type Input struct {
	Address   string
	Metro     string
	Hours     string
	Badge     string
	Note      string
	IsCentral bool
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
		out = append(out, mk(r.ID, r.Address, r.Metro, r.Hours, r.Badge, r.Note, r.IsCentral, r.SortOrder, r.Published, r.UpdatedBy, r.UpdatedAt))
	}
	return out, nil
}

func (s *Service) ListPublished(ctx context.Context) ([]Point, error) {
	rows, err := s.q.ListPublishedPickupPoints(ctx)
	if err != nil {
		return nil, fmt.Errorf("list published pickup points: %w", err)
	}
	out := make([]Point, 0, len(rows))
	for _, r := range rows {
		out = append(out, mk(r.ID, r.Address, r.Metro, r.Hours, r.Badge, r.Note, r.IsCentral, r.SortOrder, r.Published, r.UpdatedBy, r.UpdatedAt))
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
	return mk(r.ID, r.Address, r.Metro, r.Hours, r.Badge, r.Note, r.IsCentral, r.SortOrder, r.Published, r.UpdatedBy, r.UpdatedAt), nil
}

func (s *Service) Create(ctx context.Context, in Input, editor string) (Point, error) {
	addr := strings.TrimSpace(in.Address)
	if addr == "" {
		return Point{}, ErrAddressMissing
	}
	r, err := s.q.CreatePickupPoint(ctx, db.CreatePickupPointParams{
		Address: addr, Metro: strings.TrimSpace(in.Metro), Hours: strings.TrimSpace(in.Hours),
		Badge: strings.TrimSpace(in.Badge), Note: strings.TrimSpace(in.Note),
		IsCentral: in.IsCentral, SortOrder: int32(in.SortOrder), Published: in.Published, UpdatedBy: editor,
	})
	if err != nil {
		return Point{}, fmt.Errorf("create pickup point: %w", err)
	}
	return mk(r.ID, r.Address, r.Metro, r.Hours, r.Badge, r.Note, r.IsCentral, r.SortOrder, r.Published, r.UpdatedBy, r.UpdatedAt), nil
}

func (s *Service) Update(ctx context.Context, id int64, in Input, editor string) error {
	if _, err := s.Get(ctx, id); err != nil {
		return err
	}
	addr := strings.TrimSpace(in.Address)
	if addr == "" {
		return ErrAddressMissing
	}
	return s.q.UpdatePickupPoint(ctx, db.UpdatePickupPointParams{
		ID: id, Address: addr, Metro: strings.TrimSpace(in.Metro), Hours: strings.TrimSpace(in.Hours),
		Badge: strings.TrimSpace(in.Badge), Note: strings.TrimSpace(in.Note),
		IsCentral: in.IsCentral, SortOrder: int32(in.SortOrder), Published: in.Published, UpdatedBy: editor,
	})
}

func (s *Service) Delete(ctx context.Context, id int64) error {
	if _, err := s.Get(ctx, id); err != nil {
		return err
	}
	return s.q.DeletePickupPoint(ctx, id)
}
