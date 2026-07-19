package catalog

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"
)

// Filters — фильтры каталога. Имена полей = имена query-параметров URL витрины
// (width, profile, diameter, season, brand, price_min, price_max, spikes, runflat).
type Filters struct {
	Width    *int
	Profile  *int
	Diameter *int
	Season   *Season
	Brand    *string
	PriceMin *int
	PriceMax *int
	Spikes   *bool
	Runflat  *bool
}

// DefaultPerPage — дефолт пагинации каталога по конвенциям API.
const DefaultPerPage = 24
const MaxPerPage = 100

// ParseFilters разбирает query-параметры URL в Filters + пагинацию.
// Невалидное значение — ошибка (ответ 400 validation_failed), а не молчаливый пропуск.
func ParseFilters(q url.Values) (Filters, int, int, error) {
	var f Filters

	intParam := func(name string, dst **int) error {
		s := q.Get(name)
		if s == "" {
			return nil
		}
		v, err := strconv.Atoi(s)
		if err != nil || v < 0 {
			return fmt.Errorf("параметр %s: ожидается неотрицательное число, получено %q", name, s)
		}
		*dst = &v
		return nil
	}
	boolParam := func(name string, dst **bool) error {
		s := q.Get(name)
		if s == "" {
			return nil
		}
		v, err := strconv.ParseBool(s)
		if err != nil {
			return fmt.Errorf("параметр %s: ожидается true/false, получено %q", name, s)
		}
		*dst = &v
		return nil
	}

	for name, dst := range map[string]**int{
		"width": &f.Width, "profile": &f.Profile, "diameter": &f.Diameter,
		"price_min": &f.PriceMin, "price_max": &f.PriceMax,
	} {
		if err := intParam(name, dst); err != nil {
			return Filters{}, 0, 0, err
		}
	}
	for name, dst := range map[string]**bool{"spikes": &f.Spikes, "runflat": &f.Runflat} {
		if err := boolParam(name, dst); err != nil {
			return Filters{}, 0, 0, err
		}
	}

	if s := q.Get("season"); s != "" {
		switch Season(s) {
		case SeasonSummer, SeasonWinter, SeasonAllSeason:
			season := Season(s)
			f.Season = &season
		default:
			return Filters{}, 0, 0, fmt.Errorf("параметр season: ожидается summer|winter|allseason, получено %q", s)
		}
	}
	if b := q.Get("brand"); b != "" {
		f.Brand = &b
	}

	page := 1
	if s := q.Get("page"); s != "" {
		v, err := strconv.Atoi(s)
		if err != nil || v < 1 {
			return Filters{}, 0, 0, fmt.Errorf("параметр page: ожидается число ≥ 1, получено %q", s)
		}
		page = v
	}
	perPage := DefaultPerPage
	if s := q.Get("per_page"); s != "" {
		v, err := strconv.Atoi(s)
		if err != nil || v < 1 || v > MaxPerPage {
			return Filters{}, 0, 0, fmt.Errorf("параметр per_page: ожидается число 1–%d, получено %q", MaxPerPage, s)
		}
		perPage = v
	}

	return f, page, perPage, nil
}

// WhereSQL строит WHERE-условие и аргументы для SQL-запроса по read-модели products.
// Используется источником на синк-БД; мок фильтрует в памяти теми же Filters.
// startArg — номер первого плейсхолдера ($1, $2, …).
func (f Filters) WhereSQL(startArg int) (string, []any) {
	var conds []string
	var args []any
	add := func(expr string, val any) {
		args = append(args, val)
		conds = append(conds, fmt.Sprintf(expr, len(args)+startArg-1))
	}

	if f.Width != nil {
		add("width = $%d", *f.Width)
	}
	if f.Profile != nil {
		add("profile = $%d", *f.Profile)
	}
	if f.Diameter != nil {
		add("diameter = $%d", *f.Diameter)
	}
	if f.Season != nil {
		add("season = $%d", string(*f.Season))
	}
	if f.Brand != nil {
		add("brand ILIKE $%d", *f.Brand)
	}
	if f.PriceMin != nil {
		add("price >= $%d", *f.PriceMin)
	}
	if f.PriceMax != nil {
		add("price <= $%d", *f.PriceMax)
	}
	if f.Spikes != nil {
		add("spikes = $%d", *f.Spikes)
	}
	if f.Runflat != nil {
		add("runflat = $%d", *f.Runflat)
	}

	if len(conds) == 0 {
		return "", nil
	}
	return "WHERE " + strings.Join(conds, " AND "), args
}

// Match проверяет товар по фильтрам в памяти (для мок-источника).
// Семантика обязана совпадать с WhereSQL.
func (f Filters) Match(p Product) bool {
	if f.Width != nil && p.Width != *f.Width {
		return false
	}
	if f.Profile != nil && p.Profile != *f.Profile {
		return false
	}
	if f.Diameter != nil && p.Diameter != *f.Diameter {
		return false
	}
	if f.Season != nil && p.Season != *f.Season {
		return false
	}
	if f.Brand != nil && !strings.EqualFold(p.Brand, *f.Brand) {
		return false
	}
	if f.PriceMin != nil && p.Price < *f.PriceMin {
		return false
	}
	if f.PriceMax != nil && p.Price > *f.PriceMax {
		return false
	}
	if f.Spikes != nil && p.Spikes != *f.Spikes {
		return false
	}
	if f.Runflat != nil && p.Runflat != *f.Runflat {
		return false
	}
	return true
}
