package catalog

import (
	"net/url"
	"reflect"
	"testing"
)

// Обязательный тест по конвенциям: маппинг фильтров URL → SQL.
func TestParseFiltersAndWhereSQL(t *testing.T) {
	tests := []struct {
		name     string
		query    string
		wantSQL  string
		wantArgs []any
	}{
		{
			name:     "без фильтров",
			query:    "",
			wantSQL:  "",
			wantArgs: nil,
		},
		{
			name:     "типоразмер полностью",
			query:    "width=205&profile=55&diameter=16",
			wantSQL:  "WHERE width = $1 AND profile = $2 AND diameter = $3",
			wantArgs: []any{205, 55, 16},
		},
		{
			name:     "сезон и бренд",
			query:    "season=winter&brand=Nokian",
			wantSQL:  "WHERE season = $1 AND brand ILIKE $2",
			wantArgs: []any{"winter", "Nokian"},
		},
		{
			name:     "цена от и до",
			query:    "price_min=5000&price_max=15000",
			wantSQL:  "WHERE po.price >= $1 AND po.price <= $2",
			wantArgs: []any{5000, 15000},
		},
		{
			name:     "шипы и runflat",
			query:    "spikes=true&runflat=false",
			wantSQL:  "WHERE spikes = $1 AND runflat = $2",
			wantArgs: []any{true, false},
		},
		{
			name:  "всё сразу",
			query: "width=205&profile=55&diameter=16&season=winter&brand=Nokian&price_min=5000&price_max=20000&spikes=true&runflat=false",
			wantSQL: "WHERE width = $1 AND profile = $2 AND diameter = $3 AND season = $4 " +
				"AND brand ILIKE $5 AND po.price >= $6 AND po.price <= $7 AND spikes = $8 AND runflat = $9",
			wantArgs: []any{205, 55, 16, "winter", "Nokian", 5000, 20000, true, false},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q, err := url.ParseQuery(tt.query)
			if err != nil {
				t.Fatalf("ParseQuery: %v", err)
			}
			f, _, _, err := ParseFilters(q)
			if err != nil {
				t.Fatalf("ParseFilters: %v", err)
			}
			sql, args := f.WhereSQL(1)
			if sql != tt.wantSQL {
				t.Errorf("SQL:\n got  %q\n want %q", sql, tt.wantSQL)
			}
			if !reflect.DeepEqual(args, tt.wantArgs) {
				t.Errorf("args:\n got  %#v\n want %#v", args, tt.wantArgs)
			}
		})
	}
}

func TestWhereSQLStartArgOffset(t *testing.T) {
	q, _ := url.ParseQuery("width=205&diameter=16")
	f, _, _, err := ParseFilters(q)
	if err != nil {
		t.Fatalf("ParseFilters: %v", err)
	}
	sql, args := f.WhereSQL(3)
	want := "WHERE width = $3 AND diameter = $4"
	if sql != want {
		t.Errorf("SQL: got %q, want %q", sql, want)
	}
	if !reflect.DeepEqual(args, []any{205, 16}) {
		t.Errorf("args: got %#v", args)
	}
}

func TestQueryFilterSQLAndMatch(t *testing.T) {
	q, _ := url.ParseQuery("q=nokian&diameter=16")
	f, _, _, err := ParseFilters(q)
	if err != nil {
		t.Fatalf("ParseFilters: %v", err)
	}
	sql, args := f.WhereSQL(1)
	want := "WHERE (name ILIKE $1 OR brand ILIKE $1 OR model ILIKE $1) AND diameter = $2"
	if sql != want {
		t.Errorf("SQL: got %q, want %q", sql, want)
	}
	if !reflect.DeepEqual(args, []any{"%nokian%", 16}) {
		t.Errorf("args: got %#v", args)
	}
	// Match — та же семантика (для мока): регистронезависимая подстрока.
	p := Product{Name: "Nokian Hakkapeliitta 10", Brand: "Nokian", Model: "Hakkapeliitta", Diameter: 16}
	if !f.Match(p) {
		t.Error("ожидалось совпадение по q=nokian + diameter=16")
	}
	q2, _ := url.ParseQuery("q=michelin")
	f2, _, _, _ := ParseFilters(q2)
	if f2.Match(p) {
		t.Error("michelin не должен совпасть с Nokian")
	}
}

func TestParseFiltersPagination(t *testing.T) {
	q, _ := url.ParseQuery("page=3&per_page=12")
	_, page, perPage, err := ParseFilters(q)
	if err != nil {
		t.Fatalf("ParseFilters: %v", err)
	}
	if page != 3 || perPage != 12 {
		t.Errorf("got page=%d per_page=%d, want 3 и 12", page, perPage)
	}

	q, _ = url.ParseQuery("")
	_, page, perPage, err = ParseFilters(q)
	if err != nil {
		t.Fatalf("ParseFilters: %v", err)
	}
	if page != 1 || perPage != DefaultPerPage {
		t.Errorf("дефолты: got page=%d per_page=%d, want 1 и %d", page, perPage, DefaultPerPage)
	}
}

func TestParseFiltersValidation(t *testing.T) {
	bad := []string{
		"width=abc",
		"season=spring",
		"spikes=да",
		"page=0",
		"per_page=1000",
		"price_min=-5",
	}
	for _, query := range bad {
		q, _ := url.ParseQuery(query)
		if _, _, _, err := ParseFilters(q); err == nil {
			t.Errorf("query %q: ожидалась ошибка валидации, получен nil", query)
		}
	}
}

func TestParseFilters_City(t *testing.T) {
	f, _, _, err := ParseFilters(url.Values{"city": {"msk"}})
	if err != nil || f.City != "msk" {
		t.Fatalf("city=msk: got %q err=%v", f.City, err)
	}
	f2, _, _, _ := ParseFilters(url.Values{})
	if f2.City != CitySPB {
		t.Errorf("дефолт города: got %q, ожидалось spb", f2.City)
	}
	f3, _, _, _ := ParseFilters(url.Values{"city": {"piter"}})
	if f3.City != CitySPB {
		t.Errorf("невалидный город → дефолт spb, got %q", f3.City)
	}
}
