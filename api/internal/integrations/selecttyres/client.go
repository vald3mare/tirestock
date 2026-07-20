// Package selecttyres — адаптер синка каталога из SelectTyres. Единый JSON-фид
// (ассортимент + остатки в одном файле, ~40МБ) по ссылке с токеном. Стримингом
// разбирает массив tires и отдаёт агрегированные строки каталога.
//
// Решения по бизнесу (ARCHITECTURE.md → SelectTyres):
//   - цена = минимальная recommended_retail_price среди СПб-предложений;
//   - остаток = сумма quantity среди СПб-предложений;
//   - берём только склады СПб (магазин в СПб); товар без СПб-предложений пропускаем.
package selecttyres

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"tirestock/api/internal/catalog"
)

// DefaultStockFilter — подстроки stock_name, считающиеся складами СПб.
var DefaultStockFilter = []string{"spb", "sankt-peterburg"}

// Config — параметры источника.
type Config struct {
	FeedURL     string
	StockFilter []string      // подстроки stock_name (СПб); пусто → DefaultStockFilter
	Timeout     time.Duration // на скачивание фида; 0 → 6m (файл большой и медленный)
}

// Client — загрузчик и парсер фида.
type Client struct {
	cfg  Config
	http *http.Client
}

func NewClient(cfg Config) (*Client, error) {
	if strings.TrimSpace(cfg.FeedURL) == "" {
		return nil, fmt.Errorf("selecttyres: FeedURL обязателен")
	}
	if len(cfg.StockFilter) == 0 {
		cfg.StockFilter = DefaultStockFilter
	}
	if cfg.Timeout == 0 {
		cfg.Timeout = 6 * time.Minute
	}
	return &Client{cfg: cfg, http: &http.Client{Timeout: cfg.Timeout}}, nil
}

// feedTire — нужные поля товара из фида (остальные игнорируются).
type feedTire struct {
	Code       string      `json:"code"`
	FullName   string      `json:"p_full_name"`
	Brand      string      `json:"p_brand"`
	Model      string      `json:"p_model"`
	Width      string      `json:"p_width"`
	Height     string      `json:"p_height"`
	Diameter   string      `json:"p_diameter"`
	LoadIndex  string      `json:"p_load_index"`
	SpeedIndex string      `json:"p_speed_index"`
	Season     string      `json:"p_season"`
	Thorn      bool        `json:"p_thorn"`
	Runflat    bool        `json:"p_runflat"`
	Photo      string      `json:"p_photo"`
	Offers     []feedOffer `json:"offers"`
}

type feedOffer struct {
	StockName   string  `json:"stock_name"`
	Quantity    int     `json:"quantity"`
	RRP         *string `json:"recommended_retail_price"`
	MinInternet *string `json:"minimal_internet_price"`
	Price       *string `json:"price"`
}

var seasonMap = map[string]catalog.Season{
	"Летняя":      catalog.SeasonSummer,
	"Зимняя":      catalog.SeasonWinter,
	"Всесезонная": catalog.SeasonAllSeason,
}

// Fetch скачивает фид и для каждого подходящего товара вызывает fn с готовой
// строкой каталога. Разбор потоковый — весь файл в память не грузится.
func (c *Client) Fetch(ctx context.Context, fn func(catalog.SyncProduct) error) (parsed, kept int, err error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.cfg.FeedURL, nil)
	if err != nil {
		return 0, 0, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return 0, 0, fmt.Errorf("selecttyres: скачивание фида: %w", err)
	}
	defer func() { _, _ = io.Copy(io.Discard, resp.Body); _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return 0, 0, fmt.Errorf("selecttyres: фид вернул статус %d", resp.StatusCode)
	}

	dec := json.NewDecoder(resp.Body)
	if _, err := dec.Token(); err != nil { // открывающая '{'
		return 0, 0, fmt.Errorf("selecttyres: битый JSON (нет '{'): %w", err)
	}
	for dec.More() {
		keyTok, err := dec.Token()
		if err != nil {
			return parsed, kept, err
		}
		key, _ := keyTok.(string)
		if key != "tires" {
			var skip json.RawMessage // пропускаем прочие секции (wheels, metainfo)
			if err := dec.Decode(&skip); err != nil {
				return parsed, kept, err
			}
			continue
		}
		if _, err := dec.Token(); err != nil { // '['
			return parsed, kept, err
		}
		for dec.More() {
			var t feedTire
			if err := dec.Decode(&t); err != nil {
				return parsed, kept, fmt.Errorf("selecttyres: разбор товара: %w", err)
			}
			parsed++
			p, ok := c.mapTire(t)
			if !ok {
				continue
			}
			if err := fn(p); err != nil {
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

// mapTire агрегирует предложения СПб в одну строку каталога. ok=false — товар
// без СПб-предложений или без вычислимой цены (пропускаем).
func (c *Client) mapTire(t feedTire) (catalog.SyncProduct, bool) {
	stock := 0
	price := 0
	hasPrice := false
	consider := func(raw *string) {
		if raw == nil {
			return
		}
		v, err := strconv.ParseFloat(*raw, 64)
		if err != nil || v <= 0 {
			return
		}
		iv := int(v)
		if !hasPrice || iv < price {
			price, hasPrice = iv, true
		}
	}
	spbFound := false
	for _, o := range t.Offers {
		if !c.isTargetStock(o.StockName) {
			continue
		}
		spbFound = true
		stock += o.Quantity
		consider(o.RRP) // цена = мин. РРЦ; фолбэк — мин. интернет-цена
	}
	if !spbFound {
		return catalog.SyncProduct{}, false
	}
	if !hasPrice { // ни у одного СПб-предложения нет РРЦ — пробуем интернет-цену
		for _, o := range t.Offers {
			if c.isTargetStock(o.StockName) {
				consider(o.MinInternet)
			}
		}
	}
	if !hasPrice {
		return catalog.SyncProduct{}, false
	}

	season, ok := seasonMap[t.Season]
	if !ok {
		season = catalog.SeasonAllSeason
	}
	width, profile, diameter := parseDim(t.Width), parseDim(t.Height), parseDim(t.Diameter)
	sizeLabel := fmt.Sprintf("%d/%d R%d", width, profile, diameter)
	if t.LoadIndex != "" || t.SpeedIndex != "" {
		sizeLabel += " " + t.LoadIndex + t.SpeedIndex
	}
	name := strings.TrimSpace(t.FullName)
	if name == "" {
		name = strings.TrimSpace(t.Brand + " " + t.Model + " " + sizeLabel)
	}

	return catalog.SyncProduct{
		Code:      t.Code,
		Slug:      slugify(name, t.Code),
		Brand:     t.Brand,
		Model:     t.Model,
		Name:      name,
		SizeLabel: sizeLabel,
		Width:     width,
		Profile:   profile,
		Diameter:  diameter,
		Season:    season,
		Spikes:    t.Thorn,
		Runflat:   t.Runflat,
		Price:     price,
		Stock:     stock,
		ImageURL:  t.Photo,
	}, true
}

func (c *Client) isTargetStock(stockName string) bool {
	s := strings.ToLower(stockName)
	for _, sub := range c.cfg.StockFilter {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}

// parseDim: "245.00" → 245.
func parseDim(s string) int {
	v, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil {
		return 0
	}
	return int(v)
}
