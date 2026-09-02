// Package orderstatus — фича «Статус заказа»: чтение статуса заказа ИЗ tradesk
// (обратная интеграция). Клиент вводит номер заказа → тянем из tradesk
// GET /data/status?order_code= → маппим сырой статус в человекочитаемый.
// Контракт снят с кода старого сайта (/status/index.php).
package orderstatus

import (
	"context"
	"strings"
	"time"
)

// Raw — сырой ответ tradesk /data/status?order_code=. Поля 1:1 с JSON tradesk.
type Raw struct {
	Status    string       `json:"status"`
	Date      string       `json:"date"`
	Point     string       `json:"point"`
	PointID   int          `json:"point_id"`
	DriverID  int          `json:"driver_id"`
	Products  []RawProduct `json:"products"`
}

type RawProduct struct {
	ProductName        string `json:"product_name"`
	ProductQty         int    `json:"product_qty"`
	ProductRetailPrice int    `json:"product_retail_price"`
}

// Source — источник статуса заказа (реализация: integrations/tradesk).
// Возвращает (nil, nil), если заказ не найден (пустой ответ tradesk).
type Source interface {
	FetchStatus(ctx context.Context, orderCode string) (*Raw, error)
}

// Status — статус заказа для витрины (человекочитаемый).
type Status struct {
	Found      bool      `json:"found"`
	Code       string    `json:"code"`
	Status     string    `json:"status"`       // сырой код статуса tradesk
	StatusText string    `json:"status_text"`  // человекочитаемый
	Step       int        `json:"step"`        // 0 (нет прогресса) | 1..4 — этап для полосы прогресса
	Date       string    `json:"date"`         // дата исполнения (dd-mm-yyyy) или пусто
	Point      string    `json:"point"`        // пункт выдачи
	Products   []Product `json:"products"`
}

type Product struct {
	Name  string `json:"name"`
	Qty   int    `json:"qty"`
	Price int    `json:"price"` // за штуку, руб.
	Sum   int    `json:"sum"`   // qty*price
}

// Disabled — источник-заглушка, когда tradesk-приём не настроен (нет
// TRADESK_BASE_URL): любой заказ «не найден». Витрина покажет обычное «не найден».
type Disabled struct{}

func (Disabled) FetchStatus(context.Context, string) (*Raw, error) { return nil, nil }

// Service — бизнес-логика статуса поверх источника.
type Service struct {
	src Source
}

func NewService(src Source) *Service {
	return &Service{src: src}
}

// Lookup тянет и маппит статус заказа по номеру. Пустой номер / не найден →
// Status{Found:false} без ошибки.
func (s *Service) Lookup(ctx context.Context, code string) (Status, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return Status{Found: false}, nil
	}
	raw, err := s.src.FetchStatus(ctx, code)
	if err != nil {
		return Status{}, err
	}
	if raw == nil {
		return Status{Found: false, Code: code}, nil
	}

	text, step := mapStatus(raw)
	out := Status{
		Found:      true,
		Code:       code,
		Status:     raw.Status,
		StatusText: text,
		Step:       step,
		Date:       formatDate(raw.Date),
		Point:      raw.Point,
		Products:   []Product{}, // не nil: контракт (products required) → JSON [], а не null
	}
	for _, p := range raw.Products {
		if p.ProductRetailPrice <= 0 {
			continue // старый сайт скрывает позиции с нулевой розничной ценой
		}
		out.Products = append(out.Products, Product{
			Name: p.ProductName, Qty: p.ProductQty,
			Price: p.ProductRetailPrice, Sum: p.ProductRetailPrice * p.ProductQty,
		})
	}
	return out, nil
}

// mapStatus повторяет маппинг статусов старого сайта (/status/index.php).
// Возвращает человекочитаемый текст и этап прогресса (0 — без полосы, 1..4).
func mapStatus(r *Raw) (string, int) {
	switch r.Status {
	case "new":
		return "Новый", 0
	case "process", "payment", "prepayed", "payed", "checkout":
		return "В работе", 1
	case "transit", "move":
		return "Сборка на складе / Погрузка", 2
	case "stock":
		return stockStatus(r)
	case "reload", "load":
		return "Водитель в пути", 3
	case "ready":
		return "Готов к выдаче", 4
	case "complete":
		return "Выполнен", 4
	case "cancel", "return":
		return "Отменён", 0
	default:
		return "В обработке", 0
	}
}

// stockStatus — ветвление для статуса stock (логика старого сайта): пункт 26 или
// после 15:00 без водителя → «Водитель в пути»; иначе «Сборка на складе».
func stockStatus(r *Raw) (string, int) {
	if r.PointID == 26 {
		return "Водитель в пути", 3
	}
	if r.DriverID == 0 {
		if time.Now().Hour() > 15 {
			return "Водитель в пути", 3
		}
		return "Сборка на складе / Погрузка", 2
	}
	return "Сборка на складе / Погрузка", 2
}

// formatDate: ISO/дата tradesk → dd-mm-yyyy (как на старом сайте). Пусто → пусто.
func formatDate(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	for _, layout := range []string{"2006-01-02", time.RFC3339, "2006-01-02 15:04:05"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t.Format("02-01-2006")
		}
	}
	return s // неизвестный формат — отдаём как есть
}
