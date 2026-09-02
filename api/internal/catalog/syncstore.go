package catalog

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"tirestock/api/internal/db"
)

// CityOffer — цена и остаток товара в конкретном городе (агрегат складов города).
type CityOffer struct {
	City  string
	Price int // рубли за штуку
	Stock int
}

// SyncProduct — строка каталога для upsert синком. Городонезависимые атрибуты +
// цена/остаток по городам (Offers). Price/Stock — снапшот базового города (СПб)
// для products (живучесть/фолбэк). Ключ идемпотентности — Code.
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
	Price     int // снапшот базового города (СПб)
	Stock     int
	Offers    []CityOffer // цена/остаток по городам (СПб, Москва…)
}

// SyncStore — запись read-модели products синком. Обёртка над sqlc.
type SyncStore struct {
	q *db.Queries
}

func NewSyncStore(pool *pgxpool.Pool) *SyncStore {
	return &SyncStore{q: db.New(pool)}
}

func (s *SyncStore) Upsert(ctx context.Context, p SyncProduct) error {
	// products держит городонезависимые атрибуты + снапшот базового города (СПб);
	// цена/остаток по городам — в product_offers (мультигород, СПб + Москва).
	if err := s.q.UpsertProduct(ctx, db.UpsertProductParams{
		Code: p.Code, Slug: p.Slug, Brand: p.Brand, Model: p.Model, Name: p.Name,
		SizeLabel: p.SizeLabel, Width: int32(p.Width), Profile: int32(p.Profile),
		Diameter: int32(p.Diameter), Season: string(p.Season), Spikes: p.Spikes,
		Runflat: p.Runflat, Price: int32(p.Price), Stock: int32(p.Stock), ImageUrl: p.ImageURL,
	}); err != nil {
		return fmt.Errorf("upsert product %s: %w", p.Code, err)
	}
	for _, of := range p.Offers {
		if err := s.q.UpsertProductOffer(ctx, db.UpsertProductOfferParams{
			ProductCode: p.Code, City: of.City, Price: int64(of.Price), Stock: int32(of.Stock),
		}); err != nil {
			return fmt.Errorf("upsert offer %s/%s: %w", p.Code, of.City, err)
		}
	}
	return nil
}

// PruneStaleBefore обнуляет остаток у офферов, не пришедших в текущем прогоне
// синка (товар пропал со складов города), и у товаров без свежего снапшота. Сами
// строки не удаляем: по ним могут быть ссылки из заказов и SEO-URL.
func (s *SyncStore) PruneStaleBefore(ctx context.Context, before time.Time) (int64, error) {
	ts := pgtype.Timestamptz{Time: before, Valid: true}
	offers, err := s.q.ZeroStaleOffers(ctx, ts)
	if err != nil {
		return 0, fmt.Errorf("zero stale offers: %w", err)
	}
	prods, err := s.q.ZeroStaleStock(ctx, ts)
	if err != nil {
		return offers, fmt.Errorf("zero stale stock: %w", err)
	}
	return offers + prods, nil
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
