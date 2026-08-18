// Package oldsite — ВРЕМЕННЫЙ мост доставки заявок в tradesk через публичные
// ajax-обработчики старого сайта tirestock.ru (Битрикс). Реализует orders.OrderDelivery.
//
// Зачем: у tradesk нет доступного «create»-эндпоинта (в админке backcall/create → 404),
// а заявки исторически доходят до учётки именно через битриксовые скрипты
// /ajax/call.php и /ajax/request.php. Пока не вскрыт прямой приёмник tradesk
// (нужен исходник call.php или ответ владельца), новый бэкенд шлёт сюда — заявки
// капают в tradesk точно как со старого сайта.
//
// Контракт подтверждён исходниками /ajax/*.php (прочитаны через админку Битрикса,
// 11.08.2026 — сами скрипты и их назначение: docs/OLDSITE_AJAX.md):
//   - Обратный звонок: POST /ajax/call.php,  body: phone=<>&comment=<>
//   - Заявка:          POST /ajax/request.php, body: name=<>&phone=<>&extra=<>&type=<>
//   - Заказ:           POST /ajax/order.php, body: phone/name/comment/qty/product/
//     code/price/city/type — ОДНА ПОЗИЦИЯ на запрос; в ответе номер заказа в tradesk
//     либо строка `error`.
// Кодировка сайта — UTF-8 (проверено), конвертация не нужна. Авторизации/CSRF нет
// (публичные обработчики форм; фронт шлёт без токена).
//
// ⚠️ Это мост на период параллельного запуска. Он зависит от живого Битрикса —
// после его выключения переключить доставку на прямой адаптер tradesk (пакет tradesk).
package oldsite

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"tirestock/api/internal/orders"
)

// Config — подключение к старому сайту.
type Config struct {
	BaseURL string        // напр. https://tirestock.ru
	Timeout time.Duration // на один запрос; 0 → 15s
}

// Client — HTTP-клиент к ajax-обработчикам старого сайта.
type Client struct {
	cfg  Config
	http *http.Client
}

func NewClient(cfg Config) (*Client, error) {
	if strings.TrimSpace(cfg.BaseURL) == "" {
		return nil, fmt.Errorf("oldsite: BaseURL обязателен")
	}
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")
	if cfg.Timeout == 0 {
		cfg.Timeout = 15 * time.Second
	}
	return &Client{cfg: cfg, http: &http.Client{Timeout: cfg.Timeout}}, nil
}

// Deliver реализует orders.OrderDelivery.
func (c *Client) Deliver(ctx context.Context, kind string, payload []byte) (string, error) {
	switch kind {
	case orders.KindCallback:
		return "", c.deliverCallback(ctx, payload)
	case orders.KindRequest:
		return "", c.deliverRequest(ctx, payload)
	case orders.KindOrder:
		return c.deliverOrder(ctx, payload)
	default:
		return "", fmt.Errorf("oldsite: неизвестный вид outbox %q", kind)
	}
}

// deliverRequest шлёт заявку в /ajax/request.php (мост дальше зовёт /api/request).
func (c *Client) deliverRequest(ctx context.Context, payload []byte) error {
	var in orders.RequestInput
	if err := json.Unmarshal(payload, &in); err != nil {
		return fmt.Errorf("oldsite request: разбор payload: %w", err)
	}
	if strings.TrimSpace(in.Phone) == "" {
		return fmt.Errorf("oldsite request: пустой телефон")
	}
	return c.postForm(ctx, "/ajax/request.php", url.Values{
		"name":  {in.Name},
		"phone": {in.Phone},
		"extra": {in.Comment},
		"type":  {in.Type},
	})
}

// deliverCallback шлёт обратный звонок в /ajax/call.php.
// call.php принимает только phone+comment (имени в форме нет), поэтому имя,
// если задано, подмешиваем в начало комментария — чтобы менеджер его видел.
func (c *Client) deliverCallback(ctx context.Context, payload []byte) error {
	var in orders.CallbackInput
	if err := json.Unmarshal(payload, &in); err != nil {
		return fmt.Errorf("oldsite callback: разбор payload: %w", err)
	}
	if strings.TrimSpace(in.Phone) == "" {
		return fmt.Errorf("oldsite callback: пустой телефон")
	}
	comment := strings.TrimSpace(in.Comment)
	if name := strings.TrimSpace(in.Name); name != "" {
		if comment == "" {
			comment = "Имя: " + name
		} else {
			comment = "Имя: " + name + ". " + comment
		}
	}
	return c.postForm(ctx, "/ajax/call.php", url.Values{
		"phone":   {in.Phone},
		"comment": {comment},
	})
}

// postFormRead — как postForm, но возвращает тело ответа (order.php печатает
// номер заказа из tradesk либо `error`).
func (c *Client) postFormRead(ctx context.Context, path string, fields url.Values) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.BaseURL+path, strings.NewReader(fields.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("oldsite POST %s: %w", path, err)
	}
	defer func() {
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
	}()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("oldsite POST %s: status %d", path, resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	if err != nil {
		return "", fmt.Errorf("oldsite POST %s: чтение ответа: %w", path, err)
	}
	return strings.TrimSpace(string(body)), nil
}

// postForm отправляет form-urlencoded POST и считает успехом только 2xx.
func (c *Client) postForm(ctx context.Context, path string, fields url.Values) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.BaseURL+path, strings.NewReader(fields.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("oldsite POST %s: %w", path, err)
	}
	defer func() {
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
	}()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("oldsite POST %s: status %d", path, resp.StatusCode)
	}
	return nil
}
