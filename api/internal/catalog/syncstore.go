package catalog

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"tirestock/api/internal/db"
)

// SyncProduct — строка каталога для upsert синком (уже агрегированная: цена и
// остаток сведены из предложений источника). Ключ идемпотентности — Code.
type SyncProduct struct {
	Code      string
	Slug      string
	Brand     string
	Model     string
	Name      string
	SizeLabel string
	Width     int
	Profile   int
	Diameter  int
	Season    Season
	Spikes    bool
	Runflat   bool
	Price     int
	Stock     int
	ImageURL  string
}

// SyncStore — запись read-модели products синком. Обёртка над sqlc.
type SyncStore struct {
	q *db.Queries
}

func NewSyncStore(pool *pgxpool.Pool) *SyncStore {
	return &SyncStore{q: db.New(pool)}
}

func (s *SyncStore) Upsert(ctx context.Context, p SyncProduct) error {
	return s.q.UpsertProduct(ctx, db.UpsertProductParams{
		Code: p.Code, Slug: p.Slug, Brand: p.Brand, Model: p.Model, Name: p.Name,
		SizeLabel: p.SizeLabel, Width: int32(p.Width), Profile: int32(p.Profile),
		Diameter: int32(p.Diameter), Season: string(p.Season), Spikes: p.Spikes,
		Runflat: p.Runflat, Price: int32(p.Price), Stock: int32(p.Stock), ImageUrl: p.ImageURL,
	})
}

// ZeroStaleBefore гасит остаток товаров, не обновлённых в текущем прогоне синка
// (пропали из выгрузки). Возвращает число затронутых строк.
func (s *SyncStore) ZeroStaleBefore(ctx context.Context, before time.Time) (int64, error) {
	return s.q.ZeroStaleStock(ctx, pgtype.Timestamptz{Time: before, Valid: true})
}

func (s *SyncStore) CountSynced(ctx context.Context) (int64, error) {
	n, err := s.q.CountSyncedProducts(ctx)
	if err != nil {
		return 0, fmt.Errorf("count synced: %w", err)
	}
	return n, nil
}
