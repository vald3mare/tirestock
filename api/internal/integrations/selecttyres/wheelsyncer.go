package selecttyres

import (
	"context"
	"log/slog"
	"time"

	"tirestock/api/internal/catalog"
)

// WheelStore — приёмник синка дисков. Объявляет потребитель (изолирован от шин).
type WheelStore interface {
	Upsert(ctx context.Context, w catalog.SyncWheel) error
	PruneStaleBefore(ctx context.Context, before time.Time) (int64, error)
	CountSynced(ctx context.Context) (int64, error)
}

// WheelSyncer — фоновый контур синка дисков. Живучесть 1:1 с шинным Syncer:
// при ошибке Fetch офферы НЕ трогаем; при усохшем фиде prune пропускаем.
// Отдельный контур — падение фида дисков НЕ влияет на шины и наоборот.
type WheelSyncer struct {
	client     *Client
	store      WheelStore
	interval   time.Duration
	minHealthy float64
	log        *slog.Logger
}

func NewWheelSyncer(client *Client, store WheelStore, interval time.Duration, minHealthyRatio float64, log *slog.Logger) *WheelSyncer {
	if interval <= 0 {
		interval = time.Hour
	}
	if minHealthyRatio <= 0 || minHealthyRatio > 1 {
		minHealthyRatio = DefaultMinHealthyRatio
	}
	return &WheelSyncer{client: client, store: store, interval: interval, minHealthy: minHealthyRatio, log: log}
}

func (s *WheelSyncer) Run(ctx context.Context) {
	if err := s.SyncOnce(ctx); err != nil {
		s.log.Error("selecttyres wheels: первый синк не удался", "err", err)
	}
	t := time.NewTicker(s.interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if err := s.SyncOnce(ctx); err != nil {
				s.log.Error("selecttyres wheels: синк не удался", "err", err)
			}
		}
	}
}

func (s *WheelSyncer) SyncOnce(ctx context.Context) error {
	start := time.Now()
	s.log.Info("selecttyres wheels: синк дисков начат")

	prev, err := s.store.CountSynced(ctx)
	if err != nil {
		s.log.Error("selecttyres wheels: подсчёт каталога дисков", "err", err)
		prev = 0
	}

	parsed, kept, err := s.client.FetchWheels(ctx, func(w catalog.SyncWheel) error {
		return s.store.Upsert(ctx, w)
	})
	if err != nil {
		return err // офферы не трогаем — последнее состояние сохраняется
	}

	if prev > 0 && float64(kept) < s.minHealthy*float64(prev) {
		s.log.Warn("selecttyres wheels: усохший фид — prune пропущен",
			"пришло", kept, "было", prev, "порог", s.minHealthy)
		return nil
	}

	pruned, err := s.store.PruneStaleBefore(ctx, start)
	if err != nil {
		s.log.Error("selecttyres wheels: обнуление устаревших дисков", "err", err)
	}
	s.log.Info("selecttyres wheels: синк дисков завершён",
		"в_фиде", parsed, "с_предложениями", kept, "обнулено", pruned,
		"длительность", time.Since(start).Round(time.Second).String())
	return nil
}
