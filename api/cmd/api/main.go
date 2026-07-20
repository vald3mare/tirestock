// Единственная точка входа api: HTTP-сервер + фоновые контуры (outbox-воркер).
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"tirestock/api/internal/admin"
	"tirestock/api/internal/catalog"
	"tirestock/api/internal/db"
	"tirestock/api/internal/httpx"
	"tirestock/api/internal/integrations/mock"
	"tirestock/api/internal/integrations/oldsite"
	"tirestock/api/internal/integrations/selecttyres"
	"tirestock/api/internal/integrations/tradesk"
	"tirestock/api/internal/orders"
)

type config struct {
	Addr        string
	DatabaseURL string
	// Доставка заявок (приоритет: oldsite-мост → прямой tradesk → мок).
	OldSite oldsite.Config
	Tradesk tradesk.Config
	// Сид первого пользователя админки (создаётся, только если таблица пуста).
	AdminBootstrapUser     string
	AdminBootstrapPassword string
	AdminBootstrapName     string
	// Синк каталога из SelectTyres (пусто → каталог на моке).
	Selecttyres  selecttyres.Config
	SyncInterval time.Duration
}

// Конфиг читается из env один раз в main и передаётся явно.
func loadConfig() config {
	cfg := config{
		Addr:        ":8080",
		DatabaseURL: os.Getenv("DATABASE_URL"),
	}
	if v := os.Getenv("API_ADDR"); v != "" {
		cfg.Addr = v
	}
	cfg.OldSite = oldsite.Config{BaseURL: os.Getenv("OLDSITE_BASE_URL")}
	cfg.Tradesk = tradesk.Config{
		BaseURL:  os.Getenv("TRADESK_BASE_URL"),
		Username: os.Getenv("TRADESK_USERNAME"),
		Password: os.Getenv("TRADESK_PASSWORD"),
	}
	cfg.AdminBootstrapUser = os.Getenv("ADMIN_BOOTSTRAP_USER")
	cfg.AdminBootstrapPassword = os.Getenv("ADMIN_BOOTSTRAP_PASSWORD")
	cfg.AdminBootstrapName = os.Getenv("ADMIN_BOOTSTRAP_NAME")
	cfg.Selecttyres = selecttyres.Config{FeedURL: os.Getenv("SELECTYRES_FEED_URL")}
	cfg.SyncInterval = time.Hour
	if v := os.Getenv("SELECTYRES_SYNC_INTERVAL"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			cfg.SyncInterval = d
		}
	}
	return cfg
}

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(log)

	cfg := loadConfig()
	if cfg.DatabaseURL == "" {
		log.Error("DATABASE_URL не задан")
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if err := db.Migrate(cfg.DatabaseURL); err != nil {
		log.Error("миграции", "err", err)
		os.Exit(1)
	}
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Error("подключение к БД", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	// Источник каталога: read-модель products + синк SelectTyres, если задан фид;
	// иначе мок (этап без интеграции). Синк-воркер стартует ниже.
	var catSource catalog.CatalogSource
	var syncer *selecttyres.Syncer
	if cfg.Selecttyres.FeedURL != "" {
		stClient, err := selecttyres.NewClient(cfg.Selecttyres)
		if err != nil {
			log.Error("selecttyres client", "err", err)
			os.Exit(1)
		}
		syncer = selecttyres.NewSyncer(stClient, catalog.NewSyncStore(pool), cfg.SyncInterval, log)
		catSource = catalog.NewDBSource(pool)
		log.Info("каталог: SelectTyres (синк в read-модель)", "interval", cfg.SyncInterval.String())
	} else {
		catSource = mock.NewCatalogSource()
		log.Info("каталог: мок (SELECTYRES_FEED_URL не задан)")
	}
	catalogSvc := catalog.NewService(catSource)
	ordersSvc := orders.NewService(pool)

	// Доставка заявок. Приоритет: мост через старый сайт (OLDSITE_BASE_URL) →
	// прямой tradesk (TRADESK_BASE_URL) → мок. См. ARCHITECTURE.md: мост временный,
	// до вскрытия прямого приёмника tradesk.
	var delivery orders.OrderDelivery
	switch {
	case cfg.OldSite.BaseURL != "":
		oc, err := oldsite.NewClient(cfg.OldSite)
		if err != nil {
			log.Error("oldsite client", "err", err)
			os.Exit(1)
		}
		delivery = oc
		log.Info("доставка: мост через старый сайт (Битрикс)", "base_url", cfg.OldSite.BaseURL)
	case cfg.Tradesk.BaseURL != "":
		tc, err := tradesk.NewClient(cfg.Tradesk)
		if err != nil {
			log.Error("tradesk client", "err", err)
			os.Exit(1)
		}
		delivery = tc
		log.Info("доставка: прямой tradesk", "base_url", cfg.Tradesk.BaseURL)
	default:
		delivery = mock.NewOrderDelivery()
		log.Info("доставка: мок (OLDSITE_BASE_URL/TRADESK_BASE_URL не заданы)")
	}

	// Админка: сессии в БД, монитор заказов, оверрайды товаров.
	adminSvc := admin.NewService(pool, catalogSvc)
	if err := adminSvc.Bootstrap(ctx, cfg.AdminBootstrapUser, cfg.AdminBootstrapPassword, cfg.AdminBootstrapName); err != nil {
		log.Error("сид админа", "err", err)
		os.Exit(1)
	}

	// Фоновый контур: воркер доставки outbox → tradesk (или мок).
	worker := orders.NewWorker(pool, delivery, orders.DefaultWorkerConfig(), log)
	go worker.Run(ctx)

	// Фоновый контур: синк каталога из SelectTyres (если включён).
	if syncer != nil {
		go syncer.Run(ctx)
	}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			if err := pool.Ping(r.Context()); err != nil {
				httpx.Error(w, http.StatusServiceUnavailable, "db_unavailable", "БД недоступна")
				return
			}
			httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
		})
		catalog.NewHandlers(catalogSvc).Mount(r)
		orders.NewHandlers(ordersSvc).Mount(r)
		admin.NewHandlers(adminSvc).Mount(r)
	})

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Error("shutdown", "err", err)
		}
	}()

	log.Info("api запущен", "addr", cfg.Addr)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Error("http server", "err", err)
		os.Exit(1)
	}
}
