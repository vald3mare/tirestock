// Package orders — фича «заказы и заявки»: приём заказа/обратного звонка,
// outbox-очередь и воркер доставки в tradesk.
package orders

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"tirestock/api/internal/db"
)

// Виды записей outbox.
const (
	KindOrder    = "order"
	KindCallback = "callback"
)

// OrderDelivery — доставка заказа/заявки во внешнюю учётную систему.
// Реализации: integrations/mock (сейчас), tradesk (после разведки механизма).
// Интерфейс объявляет потребитель — orders.
type OrderDelivery interface {
	Deliver(ctx context.Context, kind string, payload []byte) error
}

// ErrValidation — невалидный ввод (sentinel фичи).
var ErrValidation = errors.New("orders: validation failed")

// OrderItem — позиция заказа. Цена пока приходит с клиента (мок-этап);
// TODO: сверять цену с каталогом при подключении синк-БД.
type OrderItem struct {
	Slug  string `json:"slug"`
	Name  string `json:"name"`
	Price int    `json:"price"`
	Qty   int    `json:"qty"`
}

// CreateOrderInput — вход POST /api/v1/orders.
type CreateOrderInput struct {
	IdempotencyKey string      `json:"idempotency_key"`
	CustomerName   string      `json:"customer_name"`
	Phone          string      `json:"phone"`
	Comment        string      `json:"comment"`
	Items          []OrderItem `json:"items"`
}

// CallbackInput — вход POST /api/v1/callbacks (обратный звонок).
type CallbackInput struct {
	Name    string `json:"name"`
	Phone   string `json:"phone"`
	Comment string `json:"comment"`
}

// Service — бизнес-логика заказов: транзакционная запись заказа вместе
// со строкой outbox (заказ никогда не теряется).
type Service struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, q: db.New(pool)}
}

func (in CreateOrderInput) validate() error {
	if strings.TrimSpace(in.IdempotencyKey) == "" {
		return fmt.Errorf("%w: idempotency_key обязателен", ErrValidation)
	}
	if strings.TrimSpace(in.CustomerName) == "" {
		return fmt.Errorf("%w: укажите имя", ErrValidation)
	}
	if strings.TrimSpace(in.Phone) == "" {
		return fmt.Errorf("%w: укажите телефон", ErrValidation)
	}
	if len(in.Items) == 0 {
		return fmt.Errorf("%w: заказ пуст", ErrValidation)
	}
	for _, it := range in.Items {
		if it.Slug == "" || it.Qty < 1 || it.Price < 0 {
			return fmt.Errorf("%w: некорректная позиция заказа", ErrValidation)
		}
	}
	return nil
}

// CreateOrder пишет заказ и строку outbox в одной транзакции.
// Повторный запрос с тем же idempotency_key возвращает существующий заказ
// (защита от даблклика «Оформить заказ»).
func (s *Service) CreateOrder(ctx context.Context, in CreateOrderInput) (orderID int64, err error) {
	if err := in.validate(); err != nil {
		return 0, err
	}

	if id, err := s.q.GetOrderIDByIdempotencyKey(ctx, in.IdempotencyKey); err == nil {
		return id, nil
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return 0, fmt.Errorf("check idempotency: %w", err)
	}

	total := 0
	for _, it := range in.Items {
		total += it.Price * it.Qty
	}
	itemsJSON, err := json.Marshal(in.Items)
	if err != nil {
		return 0, fmt.Errorf("marshal items: %w", err)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.q.WithTx(tx)
	orderID, err = qtx.InsertOrder(ctx, db.InsertOrderParams{
		IdempotencyKey: in.IdempotencyKey,
		CustomerName:   in.CustomerName,
		Phone:          in.Phone,
		Comment:        in.Comment,
		Items:          itemsJSON,
		Total:          int32(total),
	})
	if err != nil {
		return 0, fmt.Errorf("insert order: %w", err)
	}

	payload, err := json.Marshal(map[string]any{
		"order_id":      orderID,
		"customer_name": in.CustomerName,
		"phone":         in.Phone,
		"comment":       in.Comment,
		"items":         in.Items,
		"total":         total,
	})
	if err != nil {
		return 0, fmt.Errorf("marshal outbox payload: %w", err)
	}
	if _, err := qtx.InsertOutbox(ctx, db.InsertOutboxParams{Kind: KindOrder, Payload: payload}); err != nil {
		return 0, fmt.Errorf("insert outbox: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("commit: %w", err)
	}
	return orderID, nil
}

// CreateCallback пишет заявку «обратный звонок» в outbox (доставка в tradesk воркером).
func (s *Service) CreateCallback(ctx context.Context, in CallbackInput) error {
	if strings.TrimSpace(in.Phone) == "" {
		return fmt.Errorf("%w: укажите телефон", ErrValidation)
	}
	payload, err := json.Marshal(in)
	if err != nil {
		return fmt.Errorf("marshal callback: %w", err)
	}
	if _, err := s.q.InsertOutbox(ctx, db.InsertOutboxParams{Kind: KindCallback, Payload: payload}); err != nil {
		return fmt.Errorf("insert outbox: %w", err)
	}
	return nil
}
