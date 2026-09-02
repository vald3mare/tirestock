package tradesk

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"tirestock/api/internal/orderstatus"
)

// FetchStatus читает статус заказа из tradesk — обратная интеграция.
// GET /data/status?order_code=<code> → JSON. Контракт снят с /status/index.php
// старого сайта. Пустой ответ tradesk (заказ не найден) → (nil, nil).
// Реализует orderstatus.Source.
func (c *Client) FetchStatus(ctx context.Context, orderCode string) (*orderstatus.Raw, error) {
	u := c.cfg.BaseURL + "/data/status?" + url.Values{"order_code": {orderCode}}.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("tradesk GET /data/status: %w", err)
	}
	defer drain(resp)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("tradesk GET /data/status: status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<18))
	if err != nil {
		return nil, fmt.Errorf("tradesk GET /data/status: чтение ответа: %w", err)
	}
	// Заказ не найден: старый сайт трактует пустой ответ как «не найден».
	if len(strings.TrimSpace(string(body))) == 0 {
		return nil, nil
	}
	var raw orderstatus.Raw
	if err := json.Unmarshal(body, &raw); err != nil {
		// tradesk вернул не-JSON (напр. «error»/пусто) — трактуем как «не найден».
		return nil, nil
	}
	// Пустой статус — тоже «не найден».
	if strings.TrimSpace(raw.Status) == "" {
		return nil, nil
	}
	return &raw, nil
}
