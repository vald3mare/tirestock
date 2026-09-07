// Package selecttyres — адаптер синка каталога из SelectTyres. Единый JSON-фид
// (ассортимент + остатки в одном файле, ~40МБ) по ссылке с токеном. Стримингом
// разбирает массив tires и отдаёт агрегированные строки каталога.
//
// Решения по бизнесу (ARCHITECTURE.md → SelectTyres):
//   - цена = минимальная recommended_retail_price среди предложений города;
//   - остаток = сумма quantity среди предложений города;
//   - агрегируем по каждому целевому городу (СПб, МСК); товар без предложений пропускаем.
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

// BaseCity — город снапшота products (для живучести/фолбэка). Мультигород: СПб + Москва.
const BaseCity = "spb"

// DefaultCityStocks — подстроки stock_name складов по городам (нижний регистр).
// NB: склад "sever-avto-msk_sankt-peterburg" содержит "msk", но физически питерский —
// поэтому СПб матчим по "spb"/"sankt-peterburg". Москва — сам город + Подмосковье
// (mosobl, Домодедово-Кучино, Давыдово): это склады МО, обслуживающие московского
// клиента. Ярославль/Наб.Челны в Москву НЕ включаем (это отдельные города).
var DefaultCityStocks = map[string][]string{
	"spb": {"spb", "sankt-peterburg"},
	"msk": {"moskva", "moscow", "mosobl", "domodedovo", "davydovo"},
}

// Config — параметры источника.
type Config struct {
	FeedURL    string
	CityStocks map[string][]string // город → подстроки stock_name; пусто → DefaultCityStocks
	Timeout    time.Duration       // на скачивание фида; 0 → 6m
}

// Client — загрузчик и парсер фида.
type Client struct {
	cfg  Config
	http *http.Client
	// unrecognized — склады из последнего Fetch, не прошедшие фильтр СПб
	// (stock_name → число офферов). Сбрасывается в начале Fetch. Не потокобезопасно:
	// Fetch вызывается последовательно одним синкером.
	unrecognized map[string]int
}

func NewClient(cfg Config) (*Client, error) {
	if strings.TrimSpace(cfg.FeedURL) == "" {
		return nil, fmt.Errorf("selecttyres: FeedURL обязателен")
	}
	if len(cfg.CityStocks) == 0 {
		cfg.CityStocks = DefaultCityStocks
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

	c.unrecognized = map[string]int{} // сброс на каждый Fetch

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
			for _, o := range t.Offers { // склады с наличием, не попавшие ни в один город
				if o.Quantity > 0 && !c.recognized(o.StockName) {
					c.unrecognized[o.StockName]++
				}
			}
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

// mapTire собирает товар и агрегирует предложения по каждому городу в свой оффер.
// ok=false — товара нет ни в одном городе (нет склада или не удалось вычислить цену).
func (c *Client) mapTire(t feedTire) (catalog.SyncProduct, bool) {
	var offers []catalog.CityOffer
	for city, subs := range c.cfg.CityStocks {
		if price, stock, ok := aggregateCity(t.Offers, subs); ok {
			offers = append(offers, catalog.CityOffer{City: city, Price: price, Stock: stock})
		}
	}
	if len(offers) == 0 {
		return catalog.SyncProduct{}, false
	}
	// Снапшот базового города (СПб) в products; если базового нет — первый попавшийся.
	base := offers[0]
	for _, of := range offers {
		if of.City == BaseCity {
			base = of
			break
		}
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
		Code: t.Code, Slug: slugify(name, t.Code), Brand: t.Brand, Model: t.Model,
		Name: name, SizeLabel: sizeLabel, Width: width, Profile: profile, Diameter: diameter,
		Season: season, Spikes: t.Thorn, Runflat: t.Runflat, ImageURL: t.Photo,
		Price: base.Price, Stock: base.Stock, Offers: offers,
	}, true
}

// aggregateCity суммирует остаток и берёт минимальную цену по складам города.
// Цена — мин. РРЦ; фолбэк на мин. интернет-цену, если РРЦ нет. ok=false — города нет.
func aggregateCity(offers []feedOffer, subs []string) (price, stock int, ok bool) {
	hasPrice, found := false, false
	consider := func(raw *string) {
		if raw == nil {
			return
		}
		v, err := strconv.ParseFloat(*raw, 64)
		if err != nil || v <= 0 {
			return
		}
		if iv := int(v); !hasPrice || iv < price {
			price, hasPrice = iv, true
		}
	}
	for _, o := range offers {
		if !matchStock(o.StockName, subs) {
			continue
		}
		found = true
		stock += o.Quantity
		consider(o.RRP)
	}
	if !found {
		return 0, 0, false
	}
	if !hasPrice {
		for _, o := range offers {
			if matchStock(o.StockName, subs) {
				consider(o.MinInternet)
			}
		}
	}
	if !hasPrice {
		return 0, 0, false
	}
	return price, stock, true
}

func matchStock(stockName string, subs []string) bool {
	s := strings.ToLower(stockName)
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}

// recognized сообщает, проходит ли склад фильтр хотя бы одного города.
func (c *Client) recognized(stockName string) bool {
	for _, subs := range c.cfg.CityStocks {
		if matchStock(stockName, subs) {
			return true
		}
	}
	return false
}

// UnrecognizedStocks — склады из последнего Fetch, не попавшие ни в один город
// (stock_name → число офферов с наличием). Товары с таких складов в каталог не
// попадают — синкер логирует это, чтобы новый склад не терялся молча.
func (c *Client) UnrecognizedStocks() map[string]int {
	return c.unrecognized
}

// parseDim: "245.00" → 245.
func parseDim(s string) int {
	v, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil {
		return 0
	}
	return int(v)
}
