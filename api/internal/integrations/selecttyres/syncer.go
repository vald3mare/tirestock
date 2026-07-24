package selecttyres

import (
	"context"
	"log/slog"
	"time"

	"tirestock/api/internal/catalog"
)

// Store — приёмник результатов синка (read-модель каталога). Объявляет потребитель.
type Store interface {
	Upsert(ctx context.Context, p catalog.SyncProduct) error
	PruneStaleBefore(ctx context.Context, before time.Time) (int64, error)
}

// Syncer — фоновый контур: раз в Interval тянет фид SelectTyres и обновляет каталог.
// Рядом с outbox-воркером в том же процессе.
type Syncer struct {
	client   *Client
	store    Store
	interval time.Duration
	log      *slog.Logger
}

func NewSyncer(client *Client, store Store, interval time.Duration, log *slog.Logger) *Syncer {
	if interval <= 0 {
		interval = time.Hour
	}
	return &Syncer{client: client, store: store, interval: interval, log: log}
}

// Run делает первый синк сразу, затем по тикеру. Блокирует до отмены ctx.
func (s *Syncer) Run(ctx context.Context) {
	if err := s.SyncOnce(ctx); err != nil {
		s.log.Error("selecttyres: первый синк не удался", "err", err)
	}
	t := time.NewTicker(s.interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if err := s.SyncOnce(ctx); err != nil {
				s.log.Error("selecttyres: синк не удался", "err", err)
			}
		}
	}
}

// SyncOnce выполняет один цикл: скачать фид → upsert товаров → погасить пропавшие.
func (s *Syncer) SyncOnce(ctx context.Context) error {
	start := time.Now()
	s.log.Info("selecttyres: синк начат")

	parsed, kept, err := s.client.Fetch(ctx, func(p catalog.SyncProduct) error {
		return s.store.Upsert(ctx, p)
	})
	if err != nil {
		return err
	}
	pruned, err := s.store.PruneStaleBefore(ctx, start)
	if err != nil {
		s.log.Error("selecttyres: удаление устаревших предложений", "err", err)
	}
	s.log.Info("selecttyres: синк завершён",
		"в_фиде", parsed, "с_наличием", kept, "удалено_предложений", pruned,
		"длительность", time.Since(start).Round(time.Second).String())
	return nil
}
