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
	CountSynced(ctx context.Context) (int64, error) // текущий размер каталога (до синка)
}

// DefaultMinHealthyRatio — доля от прошлого размера каталога, ниже которой синк
// считается «усохшим» и prune пропускается (сохраняем последнее состояние).
const DefaultMinHealthyRatio = 0.5

// Syncer — фоновый контур: раз в Interval тянет фид SelectTyres и обновляет каталог.
// Рядом с outbox-воркером в том же процессе.
type Syncer struct {
	client      *Client
	store       Store
	interval    time.Duration
	minHealthy  float64 // порог здоровья: kept ≥ minHealthy*prev, иначе prune пропускаем
	log         *slog.Logger
}

func NewSyncer(client *Client, store Store, interval time.Duration, minHealthyRatio float64, log *slog.Logger) *Syncer {
	if interval <= 0 {
		interval = time.Hour
	}
	if minHealthyRatio <= 0 || minHealthyRatio > 1 {
		minHealthyRatio = DefaultMinHealthyRatio
	}
	return &Syncer{client: client, store: store, interval: interval, minHealthy: minHealthyRatio, log: log}
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
// Живучесть: при ошибке Fetch (фид недоступен, 403, сеть) офферы НЕ трогаем —
// каталог живёт из последнего состояния. При успешном, но «усохшем» фиде
// (пришло < minHealthy доли от прошлого размера) prune ПРОПУСКАЕМ, чтобы не
// снести каталог из-за обрезанной/пустой выгрузки.
func (s *Syncer) SyncOnce(ctx context.Context) error {
	start := time.Now()
	s.log.Info("selecttyres: синк начат")

	prev, err := s.store.CountSynced(ctx)
	if err != nil {
		s.log.Error("selecttyres: подсчёт текущего каталога", "err", err)
		prev = 0 // не смогли узнать прошлый размер — порог не применяем
	}

	parsed, kept, err := s.client.Fetch(ctx, func(p catalog.SyncProduct) error {
		return s.store.Upsert(ctx, p)
	})
	if err != nil {
		return err // офферы не трогаем — последнее состояние сохраняется
	}

	if prev > 0 && float64(kept) < s.minHealthy*float64(prev) {
		s.log.Warn("selecttyres: усохший фид — prune пропущен, сохраняю последнее состояние",
			"пришло", kept, "было", prev, "порог", s.minHealthy,
			"длительность", time.Since(start).Round(time.Second).String())
		return nil
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
