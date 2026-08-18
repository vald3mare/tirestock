package oldsite

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"

	"tirestock/api/internal/orders"
)

func newFake(t *testing.T) (*httptest.Server, *url.Values) {
	t.Helper()
	var last url.Values
	mux := http.NewServeMux()
	mux.HandleFunc("/ajax/call.php", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method", http.StatusMethodNotAllowed)
			return
		}
		r.ParseForm()
		last = r.PostForm
		w.WriteHeader(http.StatusOK)
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv, &last
}

// fakeOrderBridge имитирует /ajax/order.php: принимает POST по одной позиции и
// печатает номер заказа из tradesk (как это делает мост старого сайта).
func fakeOrderBridge(t *testing.T, reply func(i int) string) (*httptest.Server, *[]url.Values) {
	t.Helper()
	var calls []url.Values
	mux := http.NewServeMux()
	mux.HandleFunc("/ajax/order.php", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method", http.StatusMethodNotAllowed)
			return
		}
		r.ParseForm()
		calls = append(calls, r.PostForm)
		w.Write([]byte(reply(len(calls) - 1)))
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv, &calls
}

func newClient(t *testing.T, base string) *Client {
	t.Helper()
	c, err := NewClient(Config{BaseURL: base})
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestDeliverCallback(t *testing.T) {
	srv, last := newFake(t)
	c := newClient(t, srv.URL)

	payload, _ := json.Marshal(orders.CallbackInput{Phone: "+79210000000", Comment: "перезвоните"})
	if _, err := c.Deliver(context.Background(), orders.KindCallback, payload); err != nil {
		t.Fatalf("Deliver: %v", err)
	}
	if got := last.Get("phone"); got != "+79210000000" {
		t.Errorf("phone: got %q", got)
	}
	if got := last.Get("comment"); got != "перезвоните" {
		t.Errorf("comment: got %q", got)
	}
}

func TestDeliverCallbackFoldsName(t *testing.T) {
	srv, last := newFake(t)
	c := newClient(t, srv.URL)

	payload, _ := json.Marshal(orders.CallbackInput{Name: "Иван", Phone: "+79210000000", Comment: "хочу хранение"})
	if _, err := c.Deliver(context.Background(), orders.KindCallback, payload); err != nil {
		t.Fatalf("Deliver: %v", err)
	}
	// Имя подмешано в комментарий (в call.php поля имени нет).
	if got := last.Get("comment"); got != "Имя: Иван. хочу хранение" {
		t.Errorf("comment fold: got %q", got)
	}
}

func TestDeliverCallbackEmptyPhone(t *testing.T) {
	srv, _ := newFake(t)
	c := newClient(t, srv.URL)
	payload, _ := json.Marshal(orders.CallbackInput{Comment: "без телефона"})
	if _, err := c.Deliver(context.Background(), orders.KindCallback, payload); err == nil {
		t.Error("ожидали ошибку на пустой телефон")
	}
}

// Заказ уходит по одному запросу на позицию; город всегда spb (мультигород отменён).
func TestDeliverOrder(t *testing.T) {
	srv, calls := fakeOrderBridge(t, func(i int) string { return "1234" + strconv.Itoa(i) })
	c := newClient(t, srv.URL)

	payload, _ := json.Marshal(orderPayload{
		OrderID: 42, CustomerName: "Пётр", Phone: "+79219998877", Comment: "домофон 12",
		Items: []orders.OrderItem{
			{Slug: "nokian-1", Code: "t668559", Name: "Nokian Hakka 205/55 R16", Price: 12000, Qty: 4},
			{Slug: "kama-2", Code: "t499637", Name: "Kama Breeze 195/65 R15", Price: 4000, Qty: 1},
		},
		Total: 52000,
	})
	if _, err := c.Deliver(context.Background(), orders.KindOrder, payload); err != nil {
		t.Fatalf("Deliver: %v", err)
	}
	if len(*calls) != 2 {
		t.Fatalf("запросов: got %d, want 2 (по одному на позицию)", len(*calls))
	}
	first := (*calls)[0]
	if got := first.Get("product"); got != "Nokian Hakka 205/55 R16" {
		t.Errorf("product: got %q", got)
	}
	if got := first.Get("qty"); got != "4" {
		t.Errorf("qty: got %q", got)
	}
	if got := first.Get("price"); got != "12000" {
		t.Errorf("price: got %q", got)
	}
	if got := first.Get("city"); got != "spb" {
		t.Errorf("city: got %q, want spb", got)
	}
	if got := first.Get("comment"); !strings.Contains(got, "#42") || !strings.Contains(got, "позиция 1/2") || !strings.Contains(got, "t668559") {
		t.Errorf("comment без опознавательных знаков: %q", got)
	}
}

// Мост печатает `error`, когда tradesk отказал: доставка обязана упасть,
// чтобы outbox повторил (заказ не теряется).
func TestDeliverOrderBridgeError(t *testing.T) {
	srv, _ := fakeOrderBridge(t, func(int) string { return "error" })
	c := newClient(t, srv.URL)

	payload, _ := json.Marshal(orderPayload{
		OrderID: 43, CustomerName: "Пётр", Phone: "+79219998877",
		Items: []orders.OrderItem{{Slug: "s", Code: "t1", Name: "Шина", Price: 100, Qty: 1}},
	})
	if _, err := c.Deliver(context.Background(), orders.KindOrder, payload); err == nil {
		t.Fatal("ожидали ошибку на ответ error")
	}
}

func TestDeliverOrderEmptyPhone(t *testing.T) {
	srv, calls := fakeOrderBridge(t, func(int) string { return "1" })
	c := newClient(t, srv.URL)

	payload, _ := json.Marshal(orderPayload{OrderID: 44, Items: []orders.OrderItem{{Slug: "s", Qty: 1}}})
	if _, err := c.Deliver(context.Background(), orders.KindOrder, payload); err == nil {
		t.Fatal("ожидали ошибку на пустой телефон")
	}
	if len(*calls) != 0 {
		t.Errorf("ничего не должно уйти в мост, got %d", len(*calls))
	}
}
