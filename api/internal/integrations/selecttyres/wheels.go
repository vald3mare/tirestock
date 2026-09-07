package selecttyres

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"tirestock/api/internal/catalog"
)

// Диски — отдельный фид SelectTyres (секция wheels). Клиент переиспользует
// агрегацию офферов по городам (aggregateCity) и cookiejar/HTTP шин, но парсит
// секцию wheels и мапит в catalog.SyncWheel. Полностью изолировано от шинного пути.

// feedWheel — нужные поля диска из фида (секция wheels).
type feedWheel struct {
	Code       string      `json:"code"`
	FullName   string      `json:"p_full_name"`
	Brand      string      `json:"p_brand"`
	Model      string      `json:"p_model"`
	Category   string      `json:"p_category"`
	Color      string      `json:"p_color"`
	ColorHuman string      `json:"p_human_readable_color"`
	Width      string      `json:"p_width"`
	Diameter   string      `json:"p_diameter"`
	BoltsCount int         `json:"p_bolts_count"`
	BoltsSpace string      `json:"p_bolts_space"`
	PCD        string      `json:"p_pcd"`
	ET         string      `json:"p_et"`
	DIA        string      `json:"p_dia"`
	Type       string      `json:"p_type"`
	Photo      string      `json:"p_photo"`
	Offers     []feedOffer `json:"offers"`
}

func parseFloat(s string) float64 {
	v, _ := strconv.ParseFloat(strings.TrimSpace(s), 64)
	return v
}

// FetchWheels скачивает фид и для каждого диска с предложениями вызывает fn.
// Потоковый разбор (весь файл в память не грузим). Секции кроме wheels пропускаются.
func (c *Client) FetchWheels(ctx context.Context, fn func(catalog.SyncWheel) error) (parsed, kept int, err error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.cfg.FeedURL, nil)
	if err != nil {
		return 0, 0, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return 0, 0, fmt.Errorf("selecttyres wheels: скачивание фида: %w", err)
	}
	defer func() { _, _ = io.Copy(io.Discard, resp.Body); _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return 0, 0, fmt.Errorf("selecttyres wheels: фид вернул статус %d", resp.StatusCode)
	}

	c.unrecognized = map[string]int{}

	dec := json.NewDecoder(resp.Body)
	if _, err := dec.Token(); err != nil {
		return 0, 0, fmt.Errorf("selecttyres wheels: битый JSON: %w", err)
	}
	for dec.More() {
		keyTok, err := dec.Token()
		if err != nil {
			return parsed, kept, err
		}
		key, _ := keyTok.(string)
		if key != "wheels" {
			var skip json.RawMessage
			if err := dec.Decode(&skip); err != nil {
				return parsed, kept, err
			}
			continue
		}
		if _, err := dec.Token(); err != nil { // '['
			return parsed, kept, err
		}
		for dec.More() {
			var w feedWheel
			if err := dec.Decode(&w); err != nil {
				return parsed, kept, fmt.Errorf("selecttyres wheels: разбор диска: %w", err)
			}
			parsed++
			for _, o := range w.Offers {
				if o.Quantity > 0 && !c.recognized(o.StockName) {
					c.unrecognized[o.StockName]++
				}
			}
			sw, ok := c.mapWheel(w)
			if !ok {
				continue
			}
			if err := fn(sw); err != nil {
				return parsed, kept, err
			}
			kept++
		}
		if _, err := dec.Token(); err != nil { // ']'
			return parsed, kept, err
		}
	}
	return parsed, kept, nil
}

// mapWheel агрегирует предложения диска по городам. ok=false — ни в одном городе.
func (c *Client) mapWheel(w feedWheel) (catalog.SyncWheel, bool) {
	var offers []catalog.CityOffer
	for city, subs := range c.cfg.CityStocks {
		if price, stock, ok := aggregateCity(w.Offers, subs); ok {
			offers = append(offers, catalog.CityOffer{City: city, Price: price, Stock: stock})
		}
	}
	if len(offers) == 0 {
		return catalog.SyncWheel{}, false
	}
	base := offers[0]
	for _, of := range offers {
		if of.City == BaseCity {
			base = of
			break
		}
	}
	name := strings.TrimSpace(w.FullName)
	if name == "" {
		name = strings.TrimSpace(w.Brand + " " + w.Model)
	}
	return catalog.SyncWheel{
		Code: w.Code, Slug: slugify(name, w.Code), Brand: w.Brand, Model: w.Model,
		Name: name, Category: w.Category, Width: parseFloat(w.Width), Diameter: parseDim(w.Diameter),
		PCD: w.PCD, BoltsCount: w.BoltsCount, BoltsSpace: parseFloat(w.BoltsSpace),
		ET: parseFloat(w.ET), DIA: parseFloat(w.DIA), Color: w.Color, ColorHuman: w.ColorHuman,
		WheelType: w.Type, ImageURL: w.Photo, Price: base.Price, Stock: base.Stock, Offers: offers,
	}, true
}
