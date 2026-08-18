// Package admin — фича «контентная админка»: авторизация (сессии в БД),
// монитор заказов (проекция outbox), оверрайды товаров поверх read-модели.
// Границы истины не нарушаются: цены/остатки — только чтение из каталога,
// заказы уходят в tradesk воркером, здесь лишь наблюдение и «повторить».
package admin

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"tirestock/api/internal/catalog"
	"tirestock/api/internal/db"
)

// Sentinel-ошибки фичи.
var (
	ErrInvalidCredentials = errors.New("admin: неверный логин или пароль")
	ErrUnauthorized       = errors.New("admin: нет активной сессии")
)

// SessionTTL — срок жизни сессии админки.
const SessionTTL = 30 * 24 * time.Hour

// User — авторизованный пользователь админки.
type User struct {
	ID          int64  `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
}

// Service — бизнес-логика админки поверх БД и каталога.
type Service struct {
	pool    *pgxpool.Pool
	q       *db.Queries
	catalog *catalog.Service
}

func NewService(pool *pgxpool.Pool, cat *catalog.Service) *Service {
	return &Service{pool: pool, q: db.New(pool), catalog: cat}
}

// Bootstrap заводит первого пользователя из env, если таблица пуста (иначе no-op).
func (s *Service) Bootstrap(ctx context.Context, username, password, displayName string) error {
	if username == "" || password == "" {
		return nil
	}
	n, err := s.q.CountAdminUsers(ctx)
	if err != nil {
		return fmt.Errorf("count admins: %w", err)
	}
	if n > 0 {
		return nil
	}
	hash, err := hashPassword(password)
	if err != nil {
		return err
	}
	if displayName == "" {
		displayName = username
	}
	_, err = s.q.InsertAdminUser(ctx, db.InsertAdminUserParams{
		Username:     username,
		PasswordHash: hash,
		DisplayName:  displayName,
	})
	return err
}

// Login проверяет креды и создаёт сессию. Возвращает токен (в куку) и срок.
func (s *Service) Login(ctx context.Context, username, password string) (token string, expires time.Time, err error) {
	u, err := s.q.GetAdminUserByUsername(ctx, strings.TrimSpace(username))
	if errors.Is(err, pgx.ErrNoRows) {
		return "", time.Time{}, ErrInvalidCredentials
	}
	if err != nil {
		return "", time.Time{}, fmt.Errorf("get user: %w", err)
	}
	if !verifyPassword(password, u.PasswordHash) {
		return "", time.Time{}, ErrInvalidCredentials
	}
	token, tokenHash, err := newSessionToken()
	if err != nil {
		return "", time.Time{}, err
	}
	expires = time.Now().Add(SessionTTL)
	if err := s.q.CreateSession(ctx, db.CreateSessionParams{
		TokenHash: tokenHash,
		UserID:    u.ID,
		ExpiresAt: pgtype.Timestamptz{Time: expires, Valid: true},
	}); err != nil {
		return "", time.Time{}, fmt.Errorf("create session: %w", err)
	}
	return token, expires, nil
}

// Logout удаляет сессию по токену (идемпотентно).
func (s *Service) Logout(ctx context.Context, token string) error {
	return s.q.DeleteSession(ctx, hashToken(token))
}

// Authenticate возвращает пользователя по токену сессии или ErrUnauthorized.
func (s *Service) Authenticate(ctx context.Context, token string) (User, error) {
	if token == "" {
		return User{}, ErrUnauthorized
	}
	row, err := s.q.GetSessionUser(ctx, hashToken(token))
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrUnauthorized
	}
	if err != nil {
		return User{}, fmt.Errorf("get session: %w", err)
	}
	return User{ID: row.ID, Username: row.Username, DisplayName: row.DisplayName}, nil
}

// ── Заказы ──────────────────────────────────────────────────────────────────

const ordersPerPage = 50

// OrderRow — строка списка заказов админки.
type OrderRow struct {
	ID             int64     `json:"id"`
	CustomerName   string    `json:"customer_name"`
	Phone          string    `json:"phone"`
	Total          int       `json:"total"`
	CreatedAt      time.Time `json:"created_at"`
	DeliveryStatus string    `json:"delivery_status"` // pending|delivered|failed
	Attempts       int       `json:"attempts"`
	LastError      string    `json:"last_error"`
	// Номер записи в tradesk (ответ приёмника). Данные заказа живут в tradesk —
	// у себя держим только номер, чтобы менеджер знал, где искать, и мы не
	// дублировали учётную систему.
	TradeskNumber string `json:"tradesk_number"`
}

// OrderStats — счётчики над списком заказов (для подзаголовка).
type OrderStats struct {
	Today  int `json:"today"`
	Queued int `json:"queued"`
	Failed int `json:"failed"`
}

// OrdersPage — ответ монитора заказов.
type OrdersPage struct {
	Items []OrderRow `json:"items"`
	Stats OrderStats `json:"stats"`
}

// Orders возвращает заказы (фильтр статуса: ""|pending|delivered|failed) и счётчики.
func (s *Service) Orders(ctx context.Context, status string, page int) (OrdersPage, error) {
	if page < 1 {
		page = 1
	}
	switch status {
	case "", "pending", "delivered", "failed":
	default:
		status = ""
	}
	rows, err := s.q.ListOrders(ctx, db.ListOrdersParams{
		Limit:  ordersPerPage,
		Offset: int32((page - 1) * ordersPerPage),
		Status: status,
	})
	if err != nil {
		return OrdersPage{}, fmt.Errorf("list orders: %w", err)
	}
	items := make([]OrderRow, 0, len(rows))
	for _, r := range rows {
		items = append(items, OrderRow{
			ID:             r.ID,
			CustomerName:   r.CustomerName,
			Phone:          r.Phone,
			Total:          int(r.Total),
			CreatedAt:      r.CreatedAt.Time,
			DeliveryStatus: r.DeliveryStatus,
			Attempts:       int(r.Attempts),
			LastError:      r.LastError,
			TradeskNumber:  r.TradeskNumber,
		})
	}
	st, err := s.q.OrderStats(ctx)
	if err != nil {
		return OrdersPage{}, fmt.Errorf("order stats: %w", err)
	}
	return OrdersPage{
		Items: items,
		Stats: OrderStats{Today: int(st.Today), Queued: int(st.Queued), Failed: int(st.Failed)},
	}, nil
}

// RetryOrder возвращает недоставленный заказ (status=failed) в очередь.
func (s *Service) RetryOrder(ctx context.Context, orderID int64) error {
	return s.q.RetryOrderDelivery(ctx, orderID)
}

// ── Товары (read-модель + оверрайды) ────────────────────────────────────────

// ProductAdmin — товар в админке: read-only поля из каталога + наши оверрайды.
type ProductAdmin struct {
	Slug     string `json:"slug"`
	Name     string `json:"name"`
	Price    int    `json:"price"`
	Stock    int    `json:"stock"`
	Hidden   bool   `json:"hidden"`
	BadgeHit bool   `json:"badge_hit"`
}

// Products листает каталог (read-модель) с наложенными оверрайдами; query —
// подстрока по названию/бренду/модели (без учёта регистра).
// Products — список товаров для админки. availability: "" (все) | "in" | "out".
// Потолок 1000: распроданных ~500, они должны попадать в выборку «Нет в наличии»
// (иначе не видны — наличие сортируется вверх). Поиск q — доп. фильтр по названию.
func (s *Service) Products(ctx context.Context, query, availability string) ([]ProductAdmin, error) {
	list, _, err := s.catalog.List(ctx, catalog.Filters{Availability: availability}, 1, 1000)
	if err != nil {
		return nil, fmt.Errorf("list catalog: %w", err)
	}
	overrides, err := s.q.ListOverrides(ctx)
	if err != nil {
		return nil, fmt.Errorf("list overrides: %w", err)
	}
	ov := make(map[string]db.ListOverridesRow, len(overrides))
	for _, o := range overrides {
		ov[o.Slug] = o
	}
	q := strings.ToLower(strings.TrimSpace(query))
	out := make([]ProductAdmin, 0, len(list))
	for _, p := range list {
		if q != "" && !strings.Contains(strings.ToLower(p.Name+" "+p.Brand+" "+p.Model), q) {
			continue
		}
		o := ov[p.Slug]
		out = append(out, ProductAdmin{
			Slug:     p.Slug,
			Name:     p.Name,
			Price:    p.Price,
			Stock:    p.Stock,
			Hidden:   o.Hidden,
			BadgeHit: o.BadgeHit,
		})
	}
	return out, nil
}

// SetOverride сохраняет оверрайды товара (скрыть/бейдж) от имени пользователя.
func (s *Service) SetOverride(ctx context.Context, slug string, hidden, badgeHit bool, userID int64) error {
	if strings.TrimSpace(slug) == "" {
		return fmt.Errorf("admin: пустой slug")
	}
	uid := userID
	return s.q.UpsertOverride(ctx, db.UpsertOverrideParams{
		Slug:      slug,
		Hidden:    hidden,
		BadgeHit:  badgeHit,
		UpdatedBy: &uid,
	})
}
