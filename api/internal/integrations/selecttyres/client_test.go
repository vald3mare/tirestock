package selecttyres

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"tirestock/api/internal/catalog"
)

func testClient(t *testing.T) *Client {
	t.Helper()
	c, err := NewClient(Config{FeedURL: "http://x", CityFilters: map[string][]string{
		"spb": {"spb"}, "msk": {"msk"},
	}})
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestMapTire_PerCityAggregate(t *testing.T) {
	rrp := func(s string) *string { return &s }
	tire := feedTire{
		Code: "t1", FullName: "Тест 205/55 R16", Season: "Летняя",
		Width: "205.00", Height: "55.00", Diameter: "16.00",
		Offers: []feedOffer{
			{StockName: "spb-1", Quantity: 3, RRP: rrp("5000")},
			{StockName: "spb-2", Quantity: 2, RRP: rrp("4500")},
			{StockName: "msk-1", Quantity: 4, RRP: rrp("4800")},
			{StockName: "other", Quantity: 9, RRP: rrp("100")},
		},
	}
	p, ok := testClient(t).mapTire(tire)
	if !ok {
		t.Fatal("ожидался ok=true")
	}
	got := map[string]catalog.CityOffer{}
	for _, o := range p.Offers {
		got[o.City] = o
	}
	if got["spb"].Stock != 5 || got["spb"].Price != 4500 {
		t.Errorf("spb: got %+v, ожидалось stock=5 price=4500", got["spb"])
	}
	if got["msk"].Stock != 4 || got["msk"].Price != 4800 {
		t.Errorf("msk: got %+v, ожидалось stock=4 price=4800", got["msk"])
	}
}

func TestMapTire_PriceFallbackPerCity(t *testing.T) {
	mi := func(s string) *string { return &s }
	tire := feedTire{
		Code: "t2", FullName: "Ф 195/65 R15", Season: "Зимняя",
		Width: "195.00", Height: "65.00", Diameter: "15.00",
		Offers: []feedOffer{
			{StockName: "spb-1", Quantity: 1, MinInternet: mi("7000")}, // РРЦ нет → фолбэк
		},
	}
	p, ok := testClient(t).mapTire(tire)
	if !ok || len(p.Offers) != 1 || p.Offers[0].City != "spb" || p.Offers[0].Price != 7000 {
		t.Errorf("фолбэк цены по городу не сработал: ok=%v offers=%+v", ok, p.Offers)
	}
}

func TestMapTire_NoTargetCity_Skip(t *testing.T) {
	rrp := func(s string) *string { return &s }
	tire := feedTire{Code: "t3", FullName: "X", Offers: []feedOffer{
		{StockName: "other-1", Quantity: 5, RRP: rrp("3000")},
	}}
	if _, ok := testClient(t).mapTire(tire); ok {
		t.Error("ожидался ok=false — нет складов целевых городов")
	}
}

func TestFetchStreamsFeed(t *testing.T) {
	feed := `{"metainfo":{"client_name":"x"},"wheels":[],"tires":[
		{"code":"t1","p_full_name":"A 205/55 R16","p_brand":"A","p_width":"205.00","p_height":"55.00","p_diameter":"16.00","p_season":"Летняя","offers":[{"stock_name":"spb-1","quantity":4,"recommended_retail_price":"5000.00"}]},
		{"code":"t2","p_full_name":"B","p_brand":"B","p_season":"Зимняя","offers":[{"stock_name":"msk-1","quantity":9,"recommended_retail_price":"1.00"}]}
	]}`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(feed))
	}))
	defer srv.Close()

	c, err := NewClient(Config{FeedURL: srv.URL, CityFilters: map[string][]string{
		"spb": {"spb"}, "msk": {"msk"},
	}})
	if err != nil {
		t.Fatal(err)
	}
	var got []catalog.SyncProduct
	parsed, kept, err := c.Fetch(context.Background(), func(p catalog.SyncProduct) error {
		got = append(got, p)
		return nil
	})
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if parsed != 2 || kept != 2 {
		t.Errorf("parsed=%d kept=%d, want 2/2", parsed, kept)
	}
	if len(got) != 2 || got[0].Code != "t1" || len(got[0].Offers) != 1 || got[0].Offers[0].Stock != 4 || got[0].Offers[0].Price != 5000 {
		t.Errorf("неверный товар: %+v", got)
	}
}

func TestFetchReportsUnrecognizedStocks(t *testing.T) {
	feed := `{"tires":[
		{"code":"t1","p_full_name":"A 205/55 R16","p_brand":"A","p_width":"205.00","p_height":"55.00","p_diameter":"16.00","p_season":"Летняя","offers":[
			{"stock_name":"depot_spb","quantity":4,"recommended_retail_price":"5000.00"},
			{"stock_name":"depot_yaroslavl","quantity":7,"recommended_retail_price":"4000.00"},
			{"stock_name":"depot_kazan","quantity":0,"recommended_retail_price":"3000.00"}
		]}
	]}`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte(feed))
	}))
	defer srv.Close()

	c, err := NewClient(Config{FeedURL: srv.URL, CityFilters: map[string][]string{
		"spb": {"spb"}, "msk": {"moskva"},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := c.Fetch(context.Background(), func(catalog.SyncProduct) error { return nil }); err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	u := c.UnrecognizedStocks()
	if u["depot_yaroslavl"] != 1 {
		t.Errorf("depot_yaroslavl должен быть нераспознан (1 оффер), got %+v", u)
	}
	if _, ok := u["depot_spb"]; ok {
		t.Error("depot_spb распознан по СПб — не должен попасть в нераспознанные")
	}
	if _, ok := u["depot_kazan"]; ok {
		t.Error("depot_kazan с quantity=0 не должен учитываться")
	}
}
