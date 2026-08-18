package tradesk

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"tirestock/api/internal/orders"
)

// Приёмник заявок tradesk. Контракт вскрыт из /ajax/request.php старого сайта
// (11.08.2026): обычный POST формой через curl, все поля формы + `site`.
//
//	POST http://tradesk.ru/api/request   (form-urlencoded: name, phone, extra, type, site)
//
// Отличие от backcall: у заявки есть ТИП (какая услуга) и произвольные поля —
// именно это нужно формам сервисных страниц и хранения. Старый сайт слал
// `site=tirestock.ru`, чтобы менеджер видел источник; шлём то же самое.
const (
	pathRequest = "/api/request"
	requestSite = "tirestock.ru"
)

func (c *Client) deliverRequest(ctx context.Context, payload []byte) error {
	var in orders.RequestInput
	if err := json.Unmarshal(payload, &in); err != nil {
		return fmt.Errorf("tradesk request: разбор payload: %w", err)
	}
	if strings.TrimSpace(in.Phone) == "" {
		return fmt.Errorf("tradesk request: пустой телефон")
	}
	return c.postPlainForm(ctx, pathRequest, url.Values{
		"name":  {in.Name},
		"phone": {in.Phone},
		"extra": {in.Comment},
		"type":  {in.Type},
		"site":  {requestSite},
	})
}
