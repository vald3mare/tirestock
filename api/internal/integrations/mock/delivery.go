package mock

import (
	"context"
	"log/slog"
	"sync"
)

// OrderDelivery — мок доставки заказов/заявок в tradesk: пишет в лог и запоминает
// доставленное (для тестов). Реальный адаптер tradesk появится после разведки механизма.
type OrderDelivery struct {
	mu        sync.Mutex
	delivered []DeliveredItem
	failWith  error // если задано — Deliver всегда возвращает эту ошибку
}

type DeliveredItem struct {
	Kind    string
	Payload []byte
}

func NewOrderDelivery() *OrderDelivery {
	return &OrderDelivery{}
}

// FailWith включает режим отказа (для тестов ретраев воркера).
func (d *OrderDelivery) FailWith(err error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.failWith = err
}

func (d *OrderDelivery) Deliver(_ context.Context, kind string, payload []byte) (string, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.failWith != nil {
		return "", d.failWith
	}
	d.delivered = append(d.delivered, DeliveredItem{Kind: kind, Payload: payload})
	slog.Info("mock delivery: доставлено в tradesk (мок)", "kind", kind, "bytes", len(payload))
	return "mock", nil
}

// Delivered возвращает копию списка доставленных записей.
func (d *OrderDelivery) Delivered() []DeliveredItem {
	d.mu.Lock()
	defer d.mu.Unlock()
	out := make([]DeliveredItem, len(d.delivered))
	copy(out, d.delivered)
	return out
}
