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
	Query    *string // текстовый поиск (q): по названию/бренду/модели
	Width    *int
	Profile  *int
	Diameter *int
	Season   *Season
	Brand    *string
	PriceMin *int
	PriceMax *int
	Spikes   *bool
	Runflat  *bool
	Sort     string // "" (по умолчанию) | price_asc | price_desc | name
	// Availability — фильтр наличия: "" (все) | "in" (в наличии) | "out" (распродано).
	// Нужен админке, чтобы найти распроданные товары (их синк не удаляет, обнуляет остаток).
	Availability string
	// City — город (мультигород): каталог показывает товары с оффером в этом городе,
	// цена/остаток берутся из оффера. Пусто → базовый город (СПб).
	City string
}

// Cities — поддерживаемые города (мультигород: СПб + Москва). Ключ = код в URL/БД.
var Cities = map[string]bool{"spb": true, "msk": true}

// ParseCity нормализует код города из query: неизвестный/пустой → "spb".
func ParseCity(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	if Cities[s] {
		return s
	}
	return "spb"
}

// SortOrders — допустимые значения сортировки → SQL-выражение ORDER BY.
// Первичный ключ всегда «в наличии сверху», затем выбранная сортировка, затем id
// (стабильность пагинации). Пустая строка = дефолт (наличие + id).
// Цена/остаток — из оффера города (po.*). Наличие всегда сверху.
var SortOrders = map[string]string{
	"":           "(po.stock > 0) DESC, p.id",
	"price_asc":  "(po.stock > 0) DESC, po.price ASC, p.id",
	"price_desc": "(po.stock > 0) DESC, po.price DESC, p.id",
	"name":       "(po.stock > 0) DESC, p.brand ASC, p.model ASC, p.id",
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
	if s := strings.TrimSpace(q.Get("q")); s != "" {
		f.Query = &s
	}
	if s := q.Get("sort"); s != "" {
		if _, ok := SortOrders[s]; !ok {
			return Filters{}, 0, 0, fmt.Errorf("параметр sort: ожидается price_asc|price_desc|name, получено %q", s)
		}
		f.Sort = s
	}
	if s := q.Get("stock"); s != "" {
		if s != "in" && s != "out" {
			return Filters{}, 0, 0, fmt.Errorf("параметр stock: ожидается in|out, получено %q", s)
		}
		f.Availability = s
	}
	f.City = ParseCity(q.Get("city"))

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

	if f.Query != nil {
		args = append(args, "%"+*f.Query+"%")
		n := len(args) + startArg - 1
		conds = append(conds, fmt.Sprintf("(name ILIKE $%d OR brand ILIKE $%d OR model ILIKE $%d)", n, n, n))
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
	// Цена/остаток берутся из оффера города (po.*) — квалифицируем, т.к. в JOIN
	// присутствуют и products.price/stock (снапшот базового города).
	if f.PriceMin != nil {
		add("po.price >= $%d", *f.PriceMin)
	}
	if f.PriceMax != nil {
		add("po.price <= $%d", *f.PriceMax)
	}
	if f.Spikes != nil {
		add("spikes = $%d", *f.Spikes)
	}
	if f.Runflat != nil {
		add("runflat = $%d", *f.Runflat)
	}
	// Наличие — без плейсхолдера (константное выражение), значение из белого списка.
	switch f.Availability {
	case "in":
		conds = append(conds, "po.stock > 0")
	case "out":
		conds = append(conds, "po.stock = 0")
	}

	if len(conds) == 0 {
		return "", nil
	}
	return "WHERE " + strings.Join(conds, " AND "), args
}

// Match проверяет товар по фильтрам в памяти (для мок-источника).
// Семантика обязана совпадать с WhereSQL.
func (f Filters) Match(p Product) bool {
	if f.Query != nil {
		hay := strings.ToLower(p.Name + " " + p.Brand + " " + p.Model)
		if !strings.Contains(hay, strings.ToLower(*f.Query)) {
			return false
		}
	}
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
	if f.Availability == "in" && p.Stock <= 0 {
		return false
	}
	if f.Availability == "out" && p.Stock > 0 {
		return false
	}
	return true
}
