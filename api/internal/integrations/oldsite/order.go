package oldsite

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"tirestock/api/internal/orders"
)

// Доставка заказа через мост Битрикса: POST /ajax/order.php, который сам дёргает
// tradesk (`GET /api/addorder?…`) и возвращает номер заказа либо `error`.
// Контракт вскрыт из исходника order.php и фронтенда карточки товара (11.08.2026).
//
// ⚠️ Приёмник принимает ОДНУ позицию на запрос — многопозиционный заказ уходит
// N запросами (см. tradesk/order.go, там та же логика для прямого контура).

const (
	pathOrder = "/ajax/order.php"

	// Только Санкт-Петербург: мультигород отменён (решение 11.08.2026).
	orderCitySPb = "spb"

	// Тип номенклатуры старого сайта; для дисков будет "wheels", когда SelectTyres
	// включит их выгрузку.
	orderTypeTyres = "tyres"
)

// orderPayload повторяет структуру, которую orders.CreateOrder кладёт в outbox.
type orderPayload struct {
	OrderID      int64              `json:"order_id"`
	CustomerName string             `json:"customer_name"`
	Phone        string             `json:"phone"`
	Comment      string             `json:"comment"`
	Items        []orders.OrderItem `json:"items"`
	Total        int                `json:"total"`
}

func (c *Client) deliverOrder(ctx context.Context, payload []byte) (string, error) {
	var in orderPayload
	if err := json.Unmarshal(payload, &in); err != nil {
		return "", fmt.Errorf("oldsite order: разбор payload: %w", err)
	}
	if strings.TrimSpace(in.Phone) == "" {
		return "", fmt.Errorf("oldsite order: пустой телефон")
	}
	if len(in.Items) == 0 {
		return "", fmt.Errorf("oldsite order: пустой заказ #%d", in.OrderID)
	}

	numbers := make([]string, 0, len(in.Items))
	for i, it := range in.Items {
		fields := url.Values{
			"phone":   {in.Phone},
			"name":    {in.CustomerName},
			"comment": {orderComment(in, i)},
			"qty":     {strconv.Itoa(it.Qty)},
			"product": {it.Name},
			"code":    {it.Code},
			"price":   {strconv.Itoa(it.Price)},
			"city":    {orderCitySPb},
			"type":    {orderTypeTyres},
		}
		body, err := c.postFormRead(ctx, pathOrder, fields)
		if err != nil {
			return "", fmt.Errorf("oldsite order #%d, позиция %d/%d: %w", in.OrderID, i+1, len(in.Items), err)
		}
		// order.php печатает ответ tradesk: номер заказа либо `error`. Пустой ответ
		// означает, что мост не достучался до tradesk (file_get_contents вернул false).
		if body == "" || strings.EqualFold(body, "error") {
			return "", fmt.Errorf("oldsite order #%d, позиция %d/%d: мост ответил %q", in.OrderID, i+1, len(in.Items), body)
		}
		numbers = append(numbers, body)
	}
	return strings.Join(numbers, ", "), nil
}

// orderComment — тот же текст, что и в прямом контуре tradesk: номер нашего заказа,
// позиция и код товара в нашей номенклатуре (поле code приёмника хранит код старого
// магазина, по нему наш товар не найдётся — менеджеру нужна опора в тексте).
func orderComment(in orderPayload, i int) string {
	parts := []string{fmt.Sprintf("Заказ с сайта #%d", in.OrderID)}
	if len(in.Items) > 1 {
		parts = append(parts, fmt.Sprintf("позиция %d/%d", i+1, len(in.Items)))
	}
	if code := strings.TrimSpace(in.Items[i].Code); code != "" {
		parts = append(parts, "код SelectTyres: "+code)
	}
	if c := strings.TrimSpace(in.Comment); c != "" {
		parts = append(parts, c)
	}
	return strings.Join(parts, ". ")
}
