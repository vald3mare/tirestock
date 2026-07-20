package selecttyres

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"tirestock/api/internal/catalog"
)

func strptr(s string) *string { return &s }

func testClient(t *testing.T, url string) *Client {
	t.Helper()
	c, err := NewClient(Config{FeedURL: url})
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestMapTireAggregatesSpbOnly(t *testing.T) {
	c := testClient(t, "http://x")
	// СПб: 2 предложения (остаток 5+3=8, мин.РРЦ = 6000); Москва игнор.
	tire := feedTire{
		Code: "t100", FullName: "Nokian X 205/55 R16 91T", Brand: "Nokian", Model: "X",
		Width: "205.00", Height: "55.00", Diameter: "16.00", LoadIndex: "91", SpeedIndex: "T",
		Season: "Зимняя", Thorn: true,
		Offers: []feedOffer{
			{StockName: "koleso-russia_spb", Quantity: 5, RRP: strptr("6500.00")},
			{StockName: "eksklyuziv_sankt-peterburg", Quantity: 3, RRP: strptr("6000.00")},
			{StockName: "shinservis_moskva", Quantity: 99, RRP: strptr("100.00")}, // Москва — не считается
		},
	}
	p, ok := c.mapTire(tire)
	if !ok {
		t.Fatal("товар отброшен, ожидался keep")
	}
	if p.Stock != 8 {
		t.Errorf("остаток: got %d, want 8 (только СПб)", p.Stock)
	}
	if p.Price != 6000 {
		t.Errorf("цена: got %d, want 6000 (мин.РРЦ СПб)", p.Price)
	}
	if p.Season != catalog.SeasonWinter {
		t.Errorf("сезон: got %q, want winter", p.Season)
	}
	if p.SizeLabel != "205/55 R16 91T" {
		t.Errorf("size_label: got %q", p.SizeLabel)
	}
	if !p.Spikes {
		t.Error("шипы потеряны")
	}
	if p.Slug == "" || p.Code != "t100" {
		t.Errorf("slug/code: %q / %q", p.Slug, p.Code)
	}
}

func TestMapTireSkipsWithoutSpb(t *testing.T) {
	c := testClient(t, "http://x")
	tire := feedTire{
		Code: "t2", Season: "Летняя",
		Offers: []feedOffer{{StockName: "shinservis_moskva", Quantity: 10, RRP: strptr("5000")}},
	}
	if _, ok := c.mapTire(tire); ok {
		t.Error("товар без СПб-предложений должен отбрасываться")
	}
}

func TestMapTireFallbackToInternetPrice(t *testing.T) {
	c := testClient(t, "http://x")
	tire := feedTire{
		Code: "t3", Season: "Всесезонная",
		Width: "195.00", Height: "65.00", Diameter: "15.00",
		Offers: []feedOffer{
			{StockName: "buywheel_spb", Quantity: 2, RRP: nil, MinInternet: strptr("4200.00")},
		},
	}
	p, ok := c.mapTire(tire)
	if !ok {
		t.Fatal("ожидался keep через фолбэк интернет-цены")
	}
	if p.Price != 4200 {
		t.Errorf("цена-фолбэк: got %d, want 4200", p.Price)
	}
	if p.Season != catalog.SeasonAllSeason {
		t.Errorf("сезон: got %q, want allseason", p.Season)
	}
}

func TestFetchStreamsFeed(t *testing.T) {
	feed := `{"metainfo":{"client_name":"x"},"wheels":[],"tires":[
		{"code":"t1","p_full_name":"A 205/55 R16","p_brand":"A","p_width":"205.00","p_height":"55.00","p_diameter":"16.00","p_season":"Летняя","offers":[{"stock_name":"koleso-russia_spb","quantity":4,"recommended_retail_price":"5000.00"}]},
		{"code":"t2","p_full_name":"B","p_brand":"B","p_season":"Зимняя","offers":[{"stock_name":"shinservis_moskva","quantity":9,"recommended_retail_price":"1.00"}]}
	]}`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(feed))
	}))
	defer srv.Close()

	c := testClient(t, srv.URL)
	var got []catalog.SyncProduct
	parsed, kept, err := c.Fetch(context.Background(), func(p catalog.SyncProduct) error {
		got = append(got, p)
		return nil
	})
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if parsed != 2 || kept != 1 {
		t.Errorf("parsed=%d kept=%d, want 2/1 (t2 — только Москва)", parsed, kept)
	}
	if len(got) != 1 || got[0].Code != "t1" || got[0].Stock != 4 || got[0].Price != 5000 {
		t.Errorf("неверный товар: %+v", got)
	}
}
