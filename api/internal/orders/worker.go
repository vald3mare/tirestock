package orders

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"tirestock/api/internal/db"
)

// WorkerConfig — параметры воркера доставки outbox.
type WorkerConfig struct {
	Interval    time.Duration // период опроса очереди
	BatchSize   int32         // сколько записей забирать за проход
	MaxAttempts int32         // после стольких неудач — status=failed
	BaseDelay   time.Duration // база экспоненциального ретрая: BaseDelay * 2^attempts
}

func DefaultWorkerConfig() WorkerConfig {
	return WorkerConfig{
		Interval:    5 * time.Second,
		BatchSize:   10,
		MaxAttempts: 8,
		BaseDelay:   30 * time.Second,
	}
}

// Worker — фоновая доставка записей outbox во внешнюю систему (tradesk).
// Забирает pending-записи через FOR UPDATE SKIP LOCKED — безопасно
// при нескольких экземплярах.
type Worker struct {
	pool     *pgxpool.Pool
	q        *db.Queries
	delivery OrderDelivery
	cfg      WorkerConfig
	log      *slog.Logger
}

func NewWorker(pool *pgxpool.Pool, delivery OrderDelivery, cfg WorkerConfig, log *slog.Logger) *Worker {
	return &Worker{pool: pool, q: db.New(pool), delivery: delivery, cfg: cfg, log: log}
}

// Run крутит цикл доставки до отмены контекста.
func (w *Worker) Run(ctx context.Context) {
	t := time.NewTicker(w.cfg.Interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if n, err := w.ProcessOnce(ctx); err != nil {
				w.log.Error("outbox: проход воркера", "err", err)
			} else if n > 0 {
				w.log.Info("outbox: обработано", "count", n)
			}
		}
	}
}

// ProcessOnce — один проход: забрать батч под блокировкой, доставить, отметить.
// Возвращает число обработанных записей (доставленных или перепланированных).
func (w *Worker) ProcessOnce(ctx context.Context) (int, error) {
	tx, err := w.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := w.q.WithTx(tx)
	batch, err := qtx.ClaimOutbox(ctx, w.cfg.BatchSize)
	if err != nil {
		return 0, fmt.Errorf("claim outbox: %w", err)
	}

	for _, item := range batch {
		result, deliverErr := w.delivery.Deliver(ctx, item.Kind, item.Payload)
		switch {
		case deliverErr == nil:
			// result — ответ приёмника (для заказа это номер записи в tradesk):
			// храним его, чтобы админка показала, где искать заказ в учётке.
			if err := qtx.MarkOutboxDelivered(ctx, db.MarkOutboxDeliveredParams{
				ID: item.ID, Result: result,
			}); err != nil {
				return 0, fmt.Errorf("mark delivered %d: %w", item.ID, err)
			}
		case item.Attempts+1 >= w.cfg.MaxAttempts:
			w.log.Error("outbox: запись переведена в failed", "id", item.ID, "attempts", item.Attempts+1, "err", deliverErr)
			if err := qtx.MarkOutboxFailed(ctx, db.MarkOutboxFailedParams{
				ID: item.ID, LastError: deliverErr.Error(),
			}); err != nil {
				return 0, fmt.Errorf("mark failed %d: %w", item.ID, err)
			}
		default:
			delay := w.cfg.BaseDelay * (1 << item.Attempts) // экспонента: base * 2^attempts
			w.log.Warn("outbox: доставка не удалась, ретрай", "id", item.ID, "attempts", item.Attempts+1, "delay", delay, "err", deliverErr)
			if err := qtx.RescheduleOutbox(ctx, db.RescheduleOutboxParams{
				ID:          item.ID,
				NextRetryAt: pgtype.Timestamptz{Time: time.Now().Add(delay), Valid: true},
				LastError:   deliverErr.Error(),
			}); err != nil {
				return 0, fmt.Errorf("reschedule %d: %w", item.ID, err)
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("commit: %w", err)
	}
	return len(batch), nil
}
