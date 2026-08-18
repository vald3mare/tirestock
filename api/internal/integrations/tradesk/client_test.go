package tradesk

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"

	"tirestock/api/internal/orders"
)

// fakeTradesk имитирует приёмник /data/* (публичный GET, без авторизации) и
// админ-контур Yii2 (CSRF в <meta>, вход по /site/login, валидация _csrf-frontend).
type fakeTradesk struct {
	logins     atomic.Int32
	dataCalls  atomic.Int32
	lastQuery  url.Values
	orderCalls []url.Values
	orderReply string // ответ /api/addorder; по умолчанию — номер заказа

	lastRequestForm url.Values // поля последнего POST /api/request

	mux *http.ServeMux
}

func newFakeTradesk(t *testing.T) *fakeTradesk {
	t.Helper()
	f := &fakeTradesk{mux: http.NewServeMux()}

	// Приёмник заявок: как в /ajax/call.php — GET с query, без кук и токенов.
	f.mux.HandleFunc("/data/backcall", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "want GET", http.StatusMethodNotAllowed)
			return
		}
		f.dataCalls.Add(1)
		f.lastQuery = r.URL.Query()
		w.WriteHeader(http.StatusOK)
	})

	// Приёмник заказа: GET, отвечает номером заказа в кавычках (как реальный tradesk).
	f.mux.HandleFunc("/api/addorder", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "want GET", http.StatusMethodNotAllowed)
			return
		}
		f.orderCalls = append(f.orderCalls, r.URL.Query())
		if f.orderReply != "" {
			w.Write([]byte(f.orderReply))
			return
		}
		w.Write([]byte(`"5501` + strconv.Itoa(len(f.orderCalls)) + `"`))
	})

	// Приёмник заявок: POST формой, без авторизации (мост шлёт curl-ом).
	f.mux.HandleFunc("/api/request", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "want POST", http.StatusMethodNotAllowed)
			return
		}
		r.ParseForm()
		f.lastRequestForm = r.PostForm
		w.WriteHeader(http.StatusOK)
	})

	meta := `<html><head><meta name="csrf-token" content="tok-123"></head><body>`
	loginForm := meta + `<form><input name="LoginForm[password]"></form></body></html>`
	f.mux.HandleFunc("/site/login", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			w.Write([]byte(loginForm))
			return
		}
		r.ParseForm()
		if r.PostForm.Get("_csrf-frontend") != "tok-123" || r.PostForm.Get("LoginForm[username]") == "" {
			http.Error(w, "bad", http.StatusBadRequest)
			return
		}
		f.logins.Add(1)
		http.SetCookie(w, &http.Cookie{Name: "PHPSESSID", Value: "sess-ok", Path: "/"})
		w.Write([]byte(meta + `ok</body></html>`))
	})

	return f
}

func newTestClient(t *testing.T, srv *httptest.Server) *Client {
	t.Helper()
	c, err := NewClient(Config{BaseURL: srv.URL})
	if err != nil {
		t.Fatal(err)
	}
	return c
}

// Контракт /data/backcall: только phone и comment; имя складывается в комментарий.
func TestDeliverCallback(t *testing.T) {
	fake := newFakeTradesk(t)
	srv := httptest.NewServer(fake.mux)
	defer srv.Close()
	c := newTestClient(t, srv)

	payload, _ := json.Marshal(orders.CallbackInput{Name: "Иван", Phone: "+79210000000", Comment: "перезвоните"})
	if _, err := c.Deliver(context.Background(), orders.KindCallback, payload); err != nil {
		t.Fatalf("Deliver: %v", err)
	}

	if got := fake.dataCalls.Load(); got != 1 {
		t.Errorf("вызовов /data/backcall: got %d, want 1", got)
	}
	if got := fake.lastQuery.Get("phone"); got != "+79210000000" {
		t.Errorf("phone: got %q", got)
	}
	if got := fake.lastQuery.Get("comment"); got != "Имя: Иван. перезвоните" {
		t.Errorf("comment: got %q", got)
	}
	// Вход в админку для доставки заявки не нужен.
	if got := fake.logins.Load(); got != 0 {
		t.Errorf("логинов: got %d, want 0 (приёмник публичный)", got)
	}
}

func TestDeliverCallbackFoldsNameWithoutComment(t *testing.T) {
	fake := newFakeTradesk(t)
	srv := httptest.NewServer(fake.mux)
	defer srv.Close()
	c := newTestClient(t, srv)

	payload, _ := json.Marshal(orders.CallbackInput{Name: "Пётр", Phone: "+79219998877"})
	if _, err := c.Deliver(context.Background(), orders.KindCallback, payload); err != nil {
		t.Fatalf("Deliver: %v", err)
	}
	if got := fake.lastQuery.Get("comment"); got != "Имя: Пётр" {
		t.Errorf("comment: got %q", got)
	}
}

func TestDeliverCallbackEmptyPhone(t *testing.T) {
	fake := newFakeTradesk(t)
	srv := httptest.NewServer(fake.mux)
	defer srv.Close()
	c := newTestClient(t, srv)

	payload, _ := json.Marshal(orders.CallbackInput{Name: "Иван"})
	if _, err := c.Deliver(context.Background(), orders.KindCallback, payload); err == nil {
		t.Fatal("ожидали ошибку на пустом телефоне")
	}
	if got := fake.dataCalls.Load(); got != 0 {
		t.Errorf("не должны были дёргать приёмник, got %d", got)
	}
}

// Заказ: GET /api/addorder, по одному вызову на позицию, город всегда spb.
// Ответ приёмника — номер заказа в кавычках.
func TestDeliverOrder(t *testing.T) {
	fake := newFakeTradesk(t)
	srv := httptest.NewServer(fake.mux)
	defer srv.Close()
	c := newTestClient(t, srv)

	payload, _ := json.Marshal(orderPayload{
		OrderID: 7, CustomerName: "Пётр", Phone: "+79219998877", Comment: "домофон 12",
		Items: []orders.OrderItem{
			{Slug: "nokian-1", Code: "t668559", Name: "Nokian Hakka 205/55 R16", Qty: 4, Price: 12000},
			{Slug: "kama-2", Code: "t499637", Name: "Kama Breeze 195/65 R15", Qty: 1, Price: 4000},
		},
		Total: 52000,
	})
	if _, err := c.Deliver(context.Background(), orders.KindOrder, payload); err != nil {
		t.Fatalf("Deliver: %v", err)
	}
	if len(fake.orderCalls) != 2 {
		t.Fatalf("вызовов /api/addorder: got %d, want 2 (по одному на позицию)", len(fake.orderCalls))
	}
	first := fake.orderCalls[0]
	for field, want := range map[string]string{
		"phone":   "+79219998877",
		"name":    "Пётр",
		"qty":     "4",
		"product": "Nokian Hakka 205/55 R16",
		"code":    "t668559",
		"price":   "12000",
		"city":    "spb",
		"type":    "tyres",
	} {
		if got := first.Get(field); got != want {
			t.Errorf("%s: got %q, want %q", field, got, want)
		}
	}
	if got := first.Get("comment"); !strings.Contains(got, "#7") || !strings.Contains(got, "позиция 1/2") {
		t.Errorf("comment без опознавательных знаков: %q", got)
	}
	// Логин для доставки заказа не нужен — приёмник публичный.
	if got := fake.logins.Load(); got != 0 {
		t.Errorf("логинов: got %d, want 0", got)
	}
}

// Номера, которые вернул приёмник, отдаются наверх — воркер кладёт их в outbox,
// админка показывает менеджеру, где искать заказ в учётке.
func TestDeliverOrderReturnsTradeskNumbers(t *testing.T) {
	fake := newFakeTradesk(t)
	srv := httptest.NewServer(fake.mux)
	defer srv.Close()
	c := newTestClient(t, srv)

	payload, _ := json.Marshal(orderPayload{
		OrderID: 10, CustomerName: "Пётр", Phone: "+79219998877",
		Items: []orders.OrderItem{
			{Slug: "a", Code: "t1", Name: "Шина А", Qty: 4, Price: 100},
			{Slug: "b", Code: "t2", Name: "Шина Б", Qty: 2, Price: 200},
		},
	})
	got, err := c.Deliver(context.Background(), orders.KindOrder, payload)
	if err != nil {
		t.Fatalf("Deliver: %v", err)
	}
	if got != "55011, 55012" {
		t.Errorf("номера tradesk: got %q, want %q", got, "55011, 55012")
	}
}

// Заявка: POST /api/request формой, с типом услуги и пометкой источника.
func TestDeliverRequest(t *testing.T) {
	fake := newFakeTradesk(t)
	srv := httptest.NewServer(fake.mux)
	defer srv.Close()
	c := newTestClient(t, srv)

	payload, _ := json.Marshal(orders.RequestInput{
		Name: "Иван", Phone: "+79210000000", Type: "Шиномонтаж", Comment: "завтра утром",
	})
	if _, err := c.Deliver(context.Background(), orders.KindRequest, payload); err != nil {
		t.Fatalf("Deliver: %v", err)
	}
	if fake.lastRequestForm == nil {
		t.Fatal("заявка не долетела до /api/request")
	}
	for field, want := range map[string]string{
		"name":  "Иван",
		"phone": "+79210000000",
		"type":  "Шиномонтаж",
		"extra": "завтра утром",
		"site":  "tirestock.ru",
	} {
		if got := fake.lastRequestForm.Get(field); got != want {
			t.Errorf("%s: got %q, want %q", field, got, want)
		}
	}
}

// Приёмник ответил `error` → доставка падает, outbox повторит.
func TestDeliverOrderRejected(t *testing.T) {
	fake := newFakeTradesk(t)
	fake.orderReply = "error"
	srv := httptest.NewServer(fake.mux)
	defer srv.Close()
	c := newTestClient(t, srv)

	payload, _ := json.Marshal(orderPayload{
		OrderID: 8, CustomerName: "Пётр", Phone: "+79219998877",
		Items: []orders.OrderItem{{Slug: "s", Code: "t1", Name: "Шина", Qty: 1, Price: 100}},
	})
	if _, err := c.Deliver(context.Background(), orders.KindOrder, payload); err == nil {
		t.Fatal("ожидали ошибку на ответ error")
	}
}

func TestDeliverOrderEmptyPhone(t *testing.T) {
	fake := newFakeTradesk(t)
	srv := httptest.NewServer(fake.mux)
	defer srv.Close()
	c := newTestClient(t, srv)

	payload, _ := json.Marshal(orderPayload{OrderID: 9, Items: []orders.OrderItem{{Slug: "s", Qty: 1}}})
	if _, err := c.Deliver(context.Background(), orders.KindOrder, payload); err == nil {
		t.Fatal("ожидали ошибку на пустой телефон")
	}
	if len(fake.orderCalls) != 0 {
		t.Errorf("ничего не должно было уйти в tradesk, got %d", len(fake.orderCalls))
	}
}

func TestDeliverUnknownKind(t *testing.T) {
	fake := newFakeTradesk(t)
	srv := httptest.NewServer(fake.mux)
	defer srv.Close()
	c := newTestClient(t, srv)
	if _, err := c.Deliver(context.Background(), "storage", nil); err == nil || !strings.Contains(err.Error(), "неизвестный вид") {
		t.Errorf("ожидали ошибку неизвестного вида, got %v", err)
	}
}

// Админ-контур (вход + CSRF) доставкой не используется, но остаётся для служебных
// действий — проверяем, что он жив и что без кредов вход честно отказывает.
func TestAdminLogin(t *testing.T) {
	fake := newFakeTradesk(t)
	srv := httptest.NewServer(fake.mux)
	defer srv.Close()

	c, err := NewClient(Config{BaseURL: srv.URL, Username: "u", Password: "p"})
	if err != nil {
		t.Fatal(err)
	}
	if err := c.ensureLogin(context.Background()); err != nil {
		t.Fatalf("ensureLogin: %v", err)
	}
	if got := fake.logins.Load(); got != 1 {
		t.Errorf("логинов: got %d, want 1", got)
	}
	// Повторный вызов переиспользует сессию.
	if err := c.ensureLogin(context.Background()); err != nil {
		t.Fatalf("ensureLogin#2: %v", err)
	}
	if got := fake.logins.Load(); got != 1 {
		t.Errorf("после 2-го вызова логинов: got %d, want 1", got)
	}

	noCreds := newTestClient(t, srv)
	if err := noCreds.ensureLogin(context.Background()); err == nil {
		t.Error("без кредов вход должен отказывать")
	}
}
