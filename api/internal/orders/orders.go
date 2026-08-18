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
	KindRequest  = "request" // заявка с формы услуги/хранения → tradesk /api/request
)

// OrderDelivery — доставка заказа/заявки во внешнюю учётную систему.
// Реализации: integrations/tradesk (прямой контур), oldsite (мост через Битрикс,
// на выключение), mock. Интерфейс объявляет потребитель — orders.
//
// Возвращает result — то, чем ответил приёмник (для заказа это НОМЕР записи в
// tradesk). Воркер кладёт его в outbox.result, админка показывает менеджеру:
// так мы не дублируем данные учётной системы, но всегда знаем, где искать заказ.
type OrderDelivery interface {
	Deliver(ctx context.Context, kind string, payload []byte) (result string, err error)
}

// ErrValidation — невалидный ввод (sentinel фичи).
var ErrValidation = errors.New("orders: validation failed")

// OrderItem — позиция заказа. Цена пока приходит с клиента (мок-этап);
// TODO: сверять цену с каталогом при подключении синк-БД.
// Code — код товара в SelectTyres (напр. `t668559`); нужен приёмнику tradesk
// (`/api/addorder?code=`). ВНИМАНИЕ: старый сайт слал туда СВОЙ код («Код товара»
// на карточке, напр. 99302) — пространства кодов разные, см. ARCHITECTURE.md №2.
type OrderItem struct {
	Slug  string `json:"slug"`
	Code  string `json:"code"`
	Name  string `json:"name"`
	Price int    `json:"price"`
	Qty   int    `json:"qty"`
}

// CreateOrderInput — вход POST /api/v1/orders.
// Города в контракте нет: магазин работает только по Санкт-Петербургу
// (решение 11.08.2026), приёмник tradesk получает city=spb константой.
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

// RequestInput — вход POST /api/v1/requests (заявка с формы услуги).
// Отличие от обратного звонка — тип услуги: он уходит в tradesk отдельным полем,
// менеджер сразу видит, на что заявка (шиномонтаж, хранение, покраска дисков…).
type RequestInput struct {
	Name    string `json:"name"`
	Phone   string `json:"phone"`
	Type    string `json:"type"`
	Comment string `json:"comment"`
}

// Service — бизнес-логика заказов: транзакционная запись заказа вместе
// со строкой outbox (заказ никогда не теряется).
type Service struct {
	pool *pgxpool.Pool
	q    *db.Queries
	// commentPrefix приписывается к комментарию каждого заказа/заявки.
	// Нужен стендам, которые шлют в БОЕВОЙ tradesk: менеджер сразу видит, что
	// запись тестовая, и не тратит звонок. На проде пусто (env DELIVERY_TEST_MARK).
	commentPrefix string
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, q: db.New(pool)}
}

// WithCommentPrefix помечает все исходящие заявки и заказы (см. commentPrefix).
func (s *Service) WithCommentPrefix(prefix string) *Service {
	s.commentPrefix = strings.TrimSpace(prefix)
	return s
}

// mark приписывает пометку стенда к комментарию.
func (s *Service) mark(comment string) string {
	if s.commentPrefix == "" {
		return comment
	}
	if strings.TrimSpace(comment) == "" {
		return s.commentPrefix
	}
	return s.commentPrefix + " " + comment
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
		Comment:        s.mark(in.Comment),
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
		"comment":       s.mark(in.Comment),
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
	in.Comment = s.mark(in.Comment)
	payload, err := json.Marshal(in)
	if err != nil {
		return fmt.Errorf("marshal callback: %w", err)
	}
	if _, err := s.q.InsertOutbox(ctx, db.InsertOutboxParams{Kind: KindCallback, Payload: payload}); err != nil {
		return fmt.Errorf("insert outbox: %w", err)
	}
	return nil
}

// CreateRequest пишет заявку с формы услуги в outbox (доставка в tradesk воркером).
func (s *Service) CreateRequest(ctx context.Context, in RequestInput) error {
	if strings.TrimSpace(in.Phone) == "" {
		return fmt.Errorf("%w: укажите телефон", ErrValidation)
	}
	if strings.TrimSpace(in.Type) == "" {
		return fmt.Errorf("%w: не указан тип заявки", ErrValidation)
	}
	in.Comment = s.mark(in.Comment)
	payload, err := json.Marshal(in)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}
	if _, err := s.q.InsertOutbox(ctx, db.InsertOutboxParams{Kind: KindRequest, Payload: payload}); err != nil {
		return fmt.Errorf("insert outbox: %w", err)
	}
	return nil
}
