package tradesk

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"tirestock/api/internal/orders"
)

// Deliver реализует orders.OrderDelivery: маршрутизирует payload outbox по виду
// (order/callback) в соответствующий приёмник tradesk. Идемпотентность гарантирует
// вызывающая сторона (outbox: одна строка — одна доставка).
func (c *Client) Deliver(ctx context.Context, kind string, payload []byte) (string, error) {
	switch kind {
	case orders.KindCallback:
		return "", c.deliverCallback(ctx, payload)
	case orders.KindRequest:
		return "", c.deliverRequest(ctx, payload)
	case orders.KindOrder:
		in, err := unmarshalOrder(payload)
		if err != nil {
			return "", err
		}
		return c.deliverOrder(ctx, in)
	default:
		return "", fmt.Errorf("tradesk: неизвестный вид outbox %q", kind)
	}
}

// deliverCallback шлёт «обратный звонок» в приёмник /data/backcall.
//
// Контракт ВСКРЫТ из исходника моста старого сайта (Битрикс, /ajax/call.php, 11.08.2026):
//
//	file_get_contents('http://tradesk.ru/data/backcall?phone=…&comment=…')
//
// То есть GET с query-параметрами, без авторизации, сессии и CSRF — приёмник
// публичный. Поля ровно два: phone и comment; имени в контракте НЕТ, поэтому имя
// подмешиваем в начало комментария (так же делает мост oldsite — менеджер видит
// одинаковый текст независимо от того, какой контур доставки включён).
func (c *Client) deliverCallback(ctx context.Context, payload []byte) error {
	var in orders.CallbackInput
	if err := json.Unmarshal(payload, &in); err != nil {
		return fmt.Errorf("tradesk callback: разбор payload: %w", err)
	}
	if strings.TrimSpace(in.Phone) == "" {
		return fmt.Errorf("tradesk callback: пустой телефон")
	}
	return c.getData(ctx, pathBackcall, url.Values{
		"phone":   {in.Phone},
		"comment": {FoldNameIntoComment(in.Name, in.Comment)},
	})
}

// unmarshalOrder разбирает payload outbox в структуру заказа (доставка — order.go).
func unmarshalOrder(payload []byte) (orderPayload, error) {
	var in orderPayload
	if err := json.Unmarshal(payload, &in); err != nil {
		return orderPayload{}, fmt.Errorf("tradesk order: разбор payload: %w", err)
	}
	return in, nil
}

// FoldNameIntoComment складывает имя в комментарий: приёмники tradesk (backcall)
// принимают только phone+comment, отдельного поля имени в контракте нет.
func FoldNameIntoComment(name, comment string) string {
	name = strings.TrimSpace(name)
	comment = strings.TrimSpace(comment)
	switch {
	case name == "":
		return comment
	case comment == "":
		return "Имя: " + name
	default:
		return "Имя: " + name + ". " + comment
	}
}

// orderPayload повторяет структуру, которую orders.CreateOrder кладёт в outbox.
type orderPayload struct {
	OrderID      int64              `json:"order_id"`
	CustomerName string             `json:"customer_name"`
	Phone        string             `json:"phone"`
	Comment      string             `json:"comment"`
	Items        []orders.OrderItem `json:"items"`
	Total        int                `json:"total"`
}

// ── КОНТРАКТ ПРИЁМНИКА tradesk ─────────────────────────────────────────────────
// Вскрыт из исходников мостов старого сайта (Битрикс, папка /ajax):
//   - call.php → GET /data/backcall?phone=&comment=      (ПОДТВЕРЖДЕНО)
//   - auth.php → GET /api/login?phone=                   (есть и namespace /api/;
//     сам файл нерабочий — синтаксическая ошибка в switch, никогда не исполнялся)
//   - order.php, request.php, record.php — ЕЩЁ НЕ ПРОЧИТАНЫ (см. TODO.md).
const (
	pathBackcall = "/data/backcall"
)
