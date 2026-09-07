package catalog

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"tirestock/api/internal/db"
)

// WheelSyncStore — запись read-модели дисков синком. Полностью изолирована от шин:
// свои таблицы wheels/wheel_offers, свой prune. Реализует selecttyres.WheelStore.
type WheelSyncStore struct {
	q *db.Queries
}

func NewWheelSyncStore(pool *pgxpool.Pool) *WheelSyncStore {
	return &WheelSyncStore{q: db.New(pool)}
}

func (s *WheelSyncStore) Upsert(ctx context.Context, w SyncWheel) error {
	if err := s.q.UpsertWheel(ctx, db.UpsertWheelParams{
		Code: w.Code, Slug: w.Slug, Brand: w.Brand, Model: w.Model, Name: w.Name,
		Category: w.Category, Width: w.Width, Diameter: int32(w.Diameter), Pcd: w.PCD,
		BoltsCount: int32(w.BoltsCount), BoltsSpace: w.BoltsSpace, Et: w.ET, Dia: w.DIA,
		Color: w.Color, ColorHuman: w.ColorHuman, WheelType: w.WheelType,
		ImageUrl: w.ImageURL, Price: int64(w.Price), Stock: int32(w.Stock),
	}); err != nil {
		return fmt.Errorf("upsert wheel %s: %w", w.Code, err)
	}
	for _, of := range w.Offers {
		if err := s.q.UpsertWheelOffer(ctx, db.UpsertWheelOfferParams{
			WheelCode: w.Code, City: of.City, Price: int64(of.Price), Stock: int32(of.Stock),
		}); err != nil {
			return fmt.Errorf("upsert wheel offer %s/%s: %w", w.Code, of.City, err)
		}
	}
	return nil
}

// PruneStaleBefore обнуляет остаток у офферов/дисков, не пришедших в текущем прогоне.
// Строки не удаляем (ссылки заказов/URL). Затрагивает ТОЛЬКО таблицы дисков.
func (s *WheelSyncStore) PruneStaleBefore(ctx context.Context, before time.Time) (int64, error) {
	ts := pgtype.Timestamptz{Time: before, Valid: true}
	offers, err := s.q.ZeroStaleWheelOffers(ctx, ts)
	if err != nil {
		return 0, fmt.Errorf("zero stale wheel offers: %w", err)
	}
	rows, err := s.q.ZeroStaleWheels(ctx, ts)
	if err != nil {
		return offers, fmt.Errorf("zero stale wheels: %w", err)
	}
	return offers + rows, nil
}

func (s *WheelSyncStore) CountSynced(ctx context.Context) (int64, error) {
	n, err := s.q.CountSyncedWheels(ctx)
	if err != nil {
		return 0, fmt.Errorf("count synced wheels: %w", err)
	}
	return n, nil
}
