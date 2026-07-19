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

	"tirestock/api/internal/catalog"
	"tirestock/api/internal/db"
	"tirestock/api/internal/httpx"
	"tirestock/api/internal/integrations/mock"
	"tirestock/api/internal/orders"
)

type config struct {
	Addr        string
	DatabaseURL string
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

	// Источники данных: пока моки (см. ARCHITECTURE.md → открытые вопросы).
	catalogSvc := catalog.NewService(mock.NewCatalogSource())
	ordersSvc := orders.NewService(pool)
	delivery := mock.NewOrderDelivery()

	// Фоновый контур: воркер доставки outbox → tradesk (пока мок).
	worker := orders.NewWorker(pool, delivery, orders.DefaultWorkerConfig(), log)
	go worker.Run(ctx)

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
