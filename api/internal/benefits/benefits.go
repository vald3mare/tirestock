// Package benefits — фича «Преимущества»: строка офферов над каталогом на главной
// (компонент витрины BenefitsBar). Истина контента витрины — наша админка (CLAUDE.md),
// поэтому офферы редактируемы, а не захардкожены.
package benefits

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
	ErrNotFound     = errors.New("benefits: оффер не найден")
	ErrTitleMissing = errors.New("benefits: заголовок обязателен")
)

// Benefit — оффер строки преимуществ.
type Benefit struct {
	ID        int64     `json:"id"`
	Icon      string    `json:"icon"`
	Title     string    `json:"title"`
	Note      string    `json:"note"`
	SortOrder int       `json:"sort_order"`
	Published bool      `json:"published"`
	UpdatedBy string    `json:"updated_by"`
	UpdatedAt time.Time `json:"updated_at"`
}

func mk(id int64, icon, title, note string, sort int32, pub bool, by string, at pgtype.Timestamptz) Benefit {
	return Benefit{
		ID: id, Icon: icon, Title: title, Note: note, SortOrder: int(sort),
		Published: pub, UpdatedBy: by, UpdatedAt: at.Time,
	}
}

// Input — редактируемые поля оффера.
type Input struct {
	Icon      string
	Title     string
	Note      string
	SortOrder int
	Published bool
}

// Service — бизнес-логика преимуществ поверх sqlc.
type Service struct {
	q *db.Queries
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{q: db.New(pool)}
}

// List — все офферы для админки (любой статус).
func (s *Service) List(ctx context.Context) ([]Benefit, error) {
	rows, err := s.q.ListBenefits(ctx)
	if err != nil {
		return nil, fmt.Errorf("list benefits: %w", err)
	}
	out := make([]Benefit, 0, len(rows))
	for _, r := range rows {
		out = append(out, mk(r.ID, r.Icon, r.Title, r.Note, r.SortOrder, r.Published, r.UpdatedBy, r.UpdatedAt))
	}
	return out, nil
}

// ListPublished — опубликованные офферы для витрины.
func (s *Service) ListPublished(ctx context.Context) ([]Benefit, error) {
	rows, err := s.q.ListPublishedBenefits(ctx)
	if err != nil {
		return nil, fmt.Errorf("list published benefits: %w", err)
	}
	out := make([]Benefit, 0, len(rows))
	for _, r := range rows {
		out = append(out, mk(r.ID, r.Icon, r.Title, r.Note, r.SortOrder, r.Published, r.UpdatedBy, r.UpdatedAt))
	}
	return out, nil
}

func (s *Service) Get(ctx context.Context, id int64) (Benefit, error) {
	r, err := s.q.GetBenefit(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Benefit{}, ErrNotFound
	}
	if err != nil {
		return Benefit{}, fmt.Errorf("get benefit: %w", err)
	}
	return mk(r.ID, r.Icon, r.Title, r.Note, r.SortOrder, r.Published, r.UpdatedBy, r.UpdatedAt), nil
}

func (s *Service) Create(ctx context.Context, in Input, editor string) (Benefit, error) {
	title := strings.TrimSpace(in.Title)
	if title == "" {
		return Benefit{}, ErrTitleMissing
	}
	r, err := s.q.CreateBenefit(ctx, db.CreateBenefitParams{
		Icon: strings.TrimSpace(in.Icon), Title: title, Note: strings.TrimSpace(in.Note),
		SortOrder: int32(in.SortOrder), UpdatedBy: editor,
	})
	if err != nil {
		return Benefit{}, fmt.Errorf("create benefit: %w", err)
	}
	return mk(r.ID, r.Icon, r.Title, r.Note, r.SortOrder, r.Published, r.UpdatedBy, r.UpdatedAt), nil
}

func (s *Service) Update(ctx context.Context, id int64, in Input, editor string) error {
	if _, err := s.Get(ctx, id); err != nil {
		return err
	}
	title := strings.TrimSpace(in.Title)
	if title == "" {
		return ErrTitleMissing
	}
	return s.q.UpdateBenefit(ctx, db.UpdateBenefitParams{
		ID: id, Icon: strings.TrimSpace(in.Icon), Title: title, Note: strings.TrimSpace(in.Note),
		SortOrder: int32(in.SortOrder), Published: in.Published, UpdatedBy: editor,
	})
}

func (s *Service) Delete(ctx context.Context, id int64) error {
	if _, err := s.Get(ctx, id); err != nil {
		return err
	}
	return s.q.DeleteBenefit(ctx, id)
}
