// Единственная точка входа api: HTTP-сервер + фоновые контуры (outbox-воркер).
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"tirestock/api/internal/admin"
	"tirestock/api/internal/catalog"
	"tirestock/api/internal/benefits"
	"tirestock/api/internal/content"
	"tirestock/api/internal/orderstatus"
	"tirestock/api/internal/pickups"
	"tirestock/api/internal/seo"
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
	Selecttyres    selecttyres.Config
	PhotoFeedURL   string
	SyncInterval   time.Duration
	SyncMinHealthy float64 // порог здоровья синка (доля от прошлого размера); 0 → дефолт
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
	cfg.Selecttyres = selecttyres.Config{
		FeedURL:    os.Getenv("SELECTYRES_FEED_URL"),
		CityStocks: cityStocksFromEnv(),
	}
	cfg.PhotoFeedURL = os.Getenv("SELECTYRES_PHOTO_FEED_URL")
	cfg.SyncInterval = time.Hour
	if v := os.Getenv("SELECTYRES_SYNC_INTERVAL"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			cfg.SyncInterval = d
		}
	}
	if v := os.Getenv("SELECTYRES_MIN_HEALTHY_RATIO"); v != "" {
		if r, err := strconv.ParseFloat(v, 64); err == nil {
			cfg.SyncMinHealthy = r
		}
	}
	return cfg
}

// cityStocksFromEnv читает подстроки складов по городам из env (мультигород:
// СПб + Москва). SELECTYRES_STOCK_SPB / SELECTYRES_STOCK_MSK, через запятую;
// пустой город → дефолт пакета. Пусто оба → DefaultCityStocks целиком.
func cityStocksFromEnv() map[string][]string {
	out := map[string][]string{}
	for city, env := range map[string]string{"spb": "SELECTYRES_STOCK_SPB", "msk": "SELECTYRES_STOCK_MSK"} {
		v := strings.TrimSpace(os.Getenv(env))
		if v == "" {
			out[city] = selecttyres.DefaultCityStocks[city]
			continue
		}
		var subs []string
		for _, s := range strings.Split(v, ",") {
			if s = strings.TrimSpace(strings.ToLower(s)); s != "" {
				subs = append(subs, s)
			}
		}
		out[city] = subs
	}
	return out
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
	var photoSyncer *selecttyres.PhotoSyncer
	if cfg.Selecttyres.FeedURL != "" {
		stClient, err := selecttyres.NewClient(cfg.Selecttyres)
		if err != nil {
			log.Error("selecttyres client", "err", err)
			os.Exit(1)
		}
		store := catalog.NewSyncStore(pool)
		syncer = selecttyres.NewSyncer(stClient, store, cfg.SyncInterval, cfg.SyncMinHealthy, log)
		catSource = catalog.NewDBSource(pool)
		log.Info("каталог: SelectTyres (синк в read-модель)", "interval", cfg.SyncInterval.String())

		if cfg.PhotoFeedURL != "" {
			pClient, err := selecttyres.NewPhotoClient(selecttyres.PhotoConfig{FeedURL: cfg.PhotoFeedURL})
			if err != nil {
				log.Error("selecttyres photo client", "err", err)
				os.Exit(1)
			}
			photoSyncer = selecttyres.NewPhotoSyncer(pClient, store, cfg.SyncInterval, log)
			log.Info("каталог: синк чистых фото (Avito-фид) включён")
		}
	} else {
		catSource = mock.NewCatalogSource()
		log.Info("каталог: мок (SELECTYRES_FEED_URL не задан)")
	}
	catalogSvc := catalog.NewService(catSource)
	// DELIVERY_TEST_MARK — пометка стенда в комментарии заявок и заказов.
	// Задаётся на локальном/тестовом стенде, который шлёт в БОЕВОЙ tradesk, чтобы
	// менеджер видел тестовые записи и не тратил звонок. На проде — пусто.
	ordersSvc := orders.NewService(pool).WithCommentPrefix(os.Getenv("DELIVERY_TEST_MARK"))
	if m := os.Getenv("DELIVERY_TEST_MARK"); m != "" {
		log.Warn("заявки помечаются как тестовые", "пометка", m)
	}

	// Доставка заявок и заказов. Приоритет: ПРЯМОЙ tradesk (TRADESK_BASE_URL) →
	// мост через Битрикс (OLDSITE_BASE_URL, аварийный) → мок.
	//
	// Контракт приёмников вскрыт 11.08.2026 (docs/OLDSITE_AJAX.md), поэтому
	// Битрикс из цепочки выведен: он был тонким прокси и больше не нужен.
	// Мост оставлен как запасной путь на время параллельного запуска — если
	// прямой контур вдруг откажет, достаточно задать OLDSITE_BASE_URL и снять
	// TRADESK_BASE_URL.
	var delivery orders.OrderDelivery
	// Источник статуса заказа (обратная интеграция /data/status?order_code=).
	// Есть только при прямом tradesk; иначе заглушка (заказ «не найден»).
	var statusSource orderstatus.Source = orderstatus.Disabled{}
	switch {
	case cfg.Tradesk.BaseURL != "":
		cfg.Tradesk.Log = log
		tc, err := tradesk.NewClient(cfg.Tradesk)
		if err != nil {
			log.Error("tradesk client", "err", err)
			os.Exit(1)
		}
		delivery = tc
		statusSource = tc
		log.Info("доставка: прямой tradesk", "base_url", cfg.Tradesk.BaseURL)
	case cfg.OldSite.BaseURL != "":
		oc, err := oldsite.NewClient(cfg.OldSite)
		if err != nil {
			log.Error("oldsite client", "err", err)
			os.Exit(1)
		}
		delivery = oc
		log.Warn("доставка: АВАРИЙНЫЙ мост через Битрикс — задайте TRADESK_BASE_URL", "base_url", cfg.OldSite.BaseURL)
	default:
		delivery = mock.NewOrderDelivery()
		log.Info("доставка: мок (OLDSITE_BASE_URL/TRADESK_BASE_URL не заданы)")
	}

	// Статус заказа из tradesk (обратная интеграция): общий сервис для витрины
	// (/order-status) и админки (живой статус в карточке заказа).
	orderStatusSvc := orderstatus.NewService(statusSource)

	// Админка: сессии в БД, монитор заказов, оверрайды товаров.
	adminSvc := admin.NewService(pool, catalogSvc, orderStatusSvc)
	contentSvc := content.NewService(pool)
	benefitsSvc := benefits.NewService(pool)
	seoSvc := seo.NewService(pool)
	pickupsSvc := pickups.NewService(pool)
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
	if photoSyncer != nil {
		go photoSyncer.Run(ctx)
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
		content.NewPublicHandlers(contentSvc).Mount(r)
		benefits.NewPublicHandlers(benefitsSvc).Mount(r)
		seo.NewPublicHandlers(seoSvc).Mount(r)
		pickups.NewPublicHandlers(pickupsSvc).Mount(r)
		orderstatus.NewPublicHandlers(orderStatusSvc).Mount(r)
		admin.NewHandlers(adminSvc, contentSvc, benefitsSvc, seoSvc, pickupsSvc).Mount(r)
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
