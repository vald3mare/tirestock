package catalog

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"
)

// Санитарные диапазоны дисков (отсечь мусор фида).
const (
	WheelMinDiameter, WheelMaxDiameter = 10, 26
	WheelMinWidth, WheelMaxWidth       = 4.0, 14.0
)

// wheelSortOrders — белый список сортировок дисков → ORDER BY. Наличие всегда сверху.
var wheelSortOrders = map[string]string{
	"":           "(wo.stock > 0) DESC, w.id",
	"price_asc":  "(wo.stock > 0) DESC, wo.price ASC, w.id",
	"price_desc": "(wo.stock > 0) DESC, wo.price DESC, w.id",
	"name":       "(wo.stock > 0) DESC, w.brand ASC, w.model ASC, w.id",
}

// ParseWheelFilters читает фильтры дисков из query каталога.
func ParseWheelFilters(q url.Values) (WheelFilters, int, int, error) {
	var f WheelFilters
	intp := func(k string) (*int, error) {
		v := q.Get(k)
		if v == "" {
			return nil, nil
		}
		n, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("параметр %s: ожидается число", k)
		}
		return &n, nil
	}
	var err error
	if f.Diameter, err = intp("diameter"); err != nil {
		return WheelFilters{}, 0, 0, err
	}
	if v := q.Get("width"); v != "" {
		w, e := strconv.ParseFloat(v, 64)
		if e != nil {
			return WheelFilters{}, 0, 0, fmt.Errorf("параметр width: ожидается число")
		}
		f.Width = &w
	}
	if f.PriceMin, err = intp("price_min"); err != nil {
		return WheelFilters{}, 0, 0, err
	}
	if f.PriceMax, err = intp("price_max"); err != nil {
		return WheelFilters{}, 0, 0, err
	}
	f.PCD = strings.TrimSpace(q.Get("pcd"))
	f.Brand = strings.TrimSpace(q.Get("brand"))
	f.Type = strings.TrimSpace(q.Get("type"))
	if s := q.Get("sort"); s != "" {
		if _, ok := wheelSortOrders[s]; !ok {
			return WheelFilters{}, 0, 0, fmt.Errorf("параметр sort: недопустимое значение")
		}
		f.Sort = s
	}
	f.City = ParseCity(q.Get("city"))

	page := 1
	if p, e := strconv.Atoi(q.Get("page")); e == nil && p > 1 {
		page = p
	}
	perPage := 24
	if pp, e := strconv.Atoi(q.Get("per_page")); e == nil && pp >= 1 && pp <= 100 {
		perPage = pp
	}
	return f, page, perPage, nil
}

// WhereSQL собирает условия фильтра (плейсхолдеры с startArg). Цена — из оффера города.
func (f WheelFilters) WhereSQL(startArg int) (string, []any) {
	var conds []string
	var args []any
	add := func(expr string, v any) {
		args = append(args, v)
		conds = append(conds, fmt.Sprintf(expr, startArg+len(args)-1))
	}
	if f.Diameter != nil {
		add("w.diameter = $%d", *f.Diameter)
	}
	if f.Width != nil {
		add("w.width = $%d", *f.Width)
	}
	if f.PCD != "" {
		add("w.pcd = $%d", f.PCD)
	}
	if f.Brand != "" {
		add("w.brand ILIKE $%d", f.Brand)
	}
	if f.Type != "" {
		add("w.wheel_type = $%d", f.Type)
	}
	if f.PriceMin != nil {
		add("wo.price >= $%d", *f.PriceMin)
	}
	if f.PriceMax != nil {
		add("wo.price <= $%d", *f.PriceMax)
	}
	if len(conds) == 0 {
		return "", args
	}
	return "WHERE " + strings.Join(conds, " AND "), args
}
