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
	c, err := NewClient(Config{FeedURL: "http://x", StockFilter: []string{"spb"}})
	if err != nil {
		t.Fatal(err)
	}
	return c
}

// Склады СПб суммируются в один остаток, цена = минимальная РРЦ.
// Склады других городов игнорируются: магазин работает только по Петербургу.
func TestMapTire_AggregatesSpbStocks(t *testing.T) {
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
	if p.Stock != 5 || p.Price != 4500 {
		t.Errorf("got stock=%d price=%d, ожидалось stock=5 price=4500 (только склады СПб)", p.Stock, p.Price)
	}
}

func TestMapTire_PriceFallbackToInternet(t *testing.T) {
	mi := func(s string) *string { return &s }
	tire := feedTire{
		Code: "t2", FullName: "Ф 195/65 R15", Season: "Зимняя",
		Width: "195.00", Height: "65.00", Diameter: "15.00",
		Offers: []feedOffer{
			{StockName: "spb-1", Quantity: 1, MinInternet: mi("7000")}, // РРЦ нет → фолбэк
		},
	}
	p, ok := testClient(t).mapTire(tire)
	if !ok || p.Price != 7000 || p.Stock != 1 {
		t.Errorf("фолбэк цены не сработал: ok=%v price=%d stock=%d", ok, p.Price, p.Stock)
	}
}

func TestMapTire_NoSpbStock_Skip(t *testing.T) {
	rrp := func(s string) *string { return &s }
	tire := feedTire{Code: "t3", FullName: "X", Offers: []feedOffer{
		{StockName: "other-1", Quantity: 5, RRP: rrp("3000")},
	}}
	if _, ok := testClient(t).mapTire(tire); ok {
		t.Error("ожидался ok=false — нет складов СПб")
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

	c, err := NewClient(Config{FeedURL: srv.URL, StockFilter: []string{"spb"}})
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
	// t2 лежит только на московском складе — в каталог СПб он не попадает.
	if parsed != 2 || kept != 1 {
		t.Errorf("parsed=%d kept=%d, want 2/1 (московский товар отброшен)", parsed, kept)
	}
	if len(got) != 1 || got[0].Code != "t1" || got[0].Stock != 4 || got[0].Price != 5000 {
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

	c, err := NewClient(Config{FeedURL: srv.URL, StockFilter: []string{"spb"}})
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
