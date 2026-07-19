package oldsite

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
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
	if err := c.Deliver(context.Background(), orders.KindCallback, payload); err != nil {
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
	if err := c.Deliver(context.Background(), orders.KindCallback, payload); err != nil {
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
	if err := c.Deliver(context.Background(), orders.KindCallback, payload); err == nil {
		t.Error("ожидали ошибку на пустой телефон")
	}
}

func TestDeliverOrderUnsupported(t *testing.T) {
	srv, _ := newFake(t)
	c := newClient(t, srv.URL)
	err := c.Deliver(context.Background(), orders.KindOrder, []byte(`{}`))
	if err == nil || !strings.Contains(err.Error(), "не реализована") {
		t.Errorf("ожидали ошибку нереализованной доставки заказа, got %v", err)
	}
}
