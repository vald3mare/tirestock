package catalog

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"tirestock/api/internal/db"
)

// SyncProduct — строка каталога для upsert синком. Цена/остаток разнесены по
// городам (Offers). Ключ идемпотентности — Code.
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
	ImageURL  string
	Offers    []CityOffer
}

// SyncStore — запись read-модели products синком. Обёртка над sqlc.
type SyncStore struct {
	q *db.Queries
}

func NewSyncStore(pool *pgxpool.Pool) *SyncStore {
	return &SyncStore{q: db.New(pool)}
}

func (s *SyncStore) Upsert(ctx context.Context, p SyncProduct) error {
	if err := s.q.UpsertProduct(ctx, db.UpsertProductParams{
		Code: p.Code, Slug: p.Slug, Brand: p.Brand, Model: p.Model, Name: p.Name,
		SizeLabel: p.SizeLabel, Width: int32(p.Width), Profile: int32(p.Profile),
		Diameter: int32(p.Diameter), Season: string(p.Season), Spikes: p.Spikes,
		Runflat: p.Runflat, Price: 0, Stock: 0, ImageUrl: p.ImageURL, // price/stock legacy — читаем из product_offers
	}); err != nil {
		return fmt.Errorf("upsert product %s: %w", p.Code, err)
	}
	for _, o := range p.Offers {
		if err := s.q.UpsertProductOffer(ctx, db.UpsertProductOfferParams{
			ProductCode: p.Code, City: o.City, Price: int64(o.Price), Stock: int32(o.Stock),
		}); err != nil {
			return fmt.Errorf("upsert offer %s/%s: %w", p.Code, o.City, err)
		}
	}
	return nil
}

// PruneStaleBefore удаляет предложения, не обновлённые в текущем прогоне синка
// (город или товар пропал из выгрузки). Возвращает число удалённых строк.
func (s *SyncStore) PruneStaleBefore(ctx context.Context, before time.Time) (int64, error) {
	return s.q.DeleteStaleOffers(ctx, pgtype.Timestamptz{Time: before, Valid: true})
}

func (s *SyncStore) CountSynced(ctx context.Context) (int64, error) {
	n, err := s.q.CountSyncedProducts(ctx)
	if err != nil {
		return 0, fmt.Errorf("count synced: %w", err)
	}
	return n, nil
}

// UpdateImageClean записывает чистое фото товара по коду. Возвращает число строк
// (0 — товара с таким кодом ещё нет в каталоге).
func (s *SyncStore) UpdateImageClean(ctx context.Context, code, url string) (int64, error) {
	return s.q.UpdateProductImageClean(ctx, db.UpdateProductImageCleanParams{Code: code, ImageCleanUrl: url})
}
