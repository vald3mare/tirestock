package tradesk

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"

	"tirestock/api/internal/orders"
)

// fakeTradesk имитирует ключевое поведение Yii2: CSRF в <meta>, вход по /site/login
// с выдачей сессионной куки, валидация _csrf-frontend на POST-действиях.
type fakeTradesk struct {
	logins   atomic.Int32
	posts    atomic.Int32
	lastForm url.Values
	// expireAfter>0 → первые expireAfter POST-действий отвечают формой логина
	// (имитация протухшей сессии), заставляя клиент перелогиниться.
	expireAfter int32
	mux         *http.ServeMux
}

func newFakeTradesk(t *testing.T) *fakeTradesk {
	t.Helper()
	f := &fakeTradesk{mux: http.NewServeMux()}

	meta := `<html><head><meta name="csrf-token" content="tok-123"></head><body>`
	loginForm := meta + `<form><input name="LoginForm[password]"></form></body></html>`

	f.mux.HandleFunc("/site/login", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			w.Write([]byte(loginForm))
			return
		}
		// POST: проверяем, что пришёл csrf и креды.
		r.ParseForm()
		if r.PostForm.Get("_csrf-frontend") != "tok-123" || r.PostForm.Get("LoginForm[username]") == "" {
			http.Error(w, "bad", http.StatusBadRequest)
			return
		}
		f.logins.Add(1)
		http.SetCookie(w, &http.Cookie{Name: "PHPSESSID", Value: "sess-ok", Path: "/"})
		w.Write([]byte(meta + `ok</body></html>`)) // без формы логина = успех
	})

	// Страница формы контура — отдаёт свежий CSRF.
	formPage := func(w http.ResponseWriter, r *http.Request) {
		if c, err := r.Cookie("PHPSESSID"); err != nil || c.Value == "" {
			http.Redirect(w, r, "/site/login", http.StatusFound)
			return
		}
		w.Write([]byte(meta + `form</body></html>`))
	}
	f.mux.HandleFunc("/backcall/index", formPage)
	f.mux.HandleFunc("/order/index", formPage)

	// Действие создания — валидирует сессию и csrf, запоминает поля.
	action := func(w http.ResponseWriter, r *http.Request) {
		n := f.posts.Add(1)
		if n <= f.expireAfter {
			// имитируем протухшую сессию: возвращаем форму логина
			w.Write([]byte(loginForm))
			return
		}
		r.ParseForm()
		if r.PostForm.Get("_csrf-frontend") != "tok-123" {
			http.Error(w, "csrf", http.StatusBadRequest)
			return
		}
		f.lastForm = r.PostForm
		w.WriteHeader(http.StatusOK)
	}
	f.mux.HandleFunc("/backcall/create", action)
	f.mux.HandleFunc("/order/create", action)

	return f
}

func newTestClient(t *testing.T, srv *httptest.Server) *Client {
	t.Helper()
	c, err := NewClient(Config{BaseURL: srv.URL, Username: "u", Password: "p"})
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestDeliverCallback(t *testing.T) {
	fake := newFakeTradesk(t)
	srv := httptest.NewServer(fake.mux)
	defer srv.Close()
	c := newTestClient(t, srv)

	payload, _ := json.Marshal(orders.CallbackInput{Name: "Иван", Phone: "+79210000000", Comment: "перезвоните"})
	if err := c.Deliver(context.Background(), orders.KindCallback, payload); err != nil {
		t.Fatalf("Deliver: %v", err)
	}

	if got := fake.logins.Load(); got != 1 {
		t.Errorf("логинов: got %d, want 1", got)
	}
	if got := fake.lastForm.Get(fieldBackcallPhone); got != "+79210000000" {
		t.Errorf("phone: got %q", got)
	}
	if got := fake.lastForm.Get(fieldBackcallName); got != "Иван" {
		t.Errorf("name: got %q", got)
	}
	// Вторая доставка не должна логиниться заново (сессия жива).
	if err := c.Deliver(context.Background(), orders.KindCallback, payload); err != nil {
		t.Fatalf("Deliver#2: %v", err)
	}
	if got := fake.logins.Load(); got != 1 {
		t.Errorf("после 2-й доставки логинов: got %d, want 1 (сессия переиспользуется)", got)
	}
}

func TestDeliverReloginOnExpiredSession(t *testing.T) {
	fake := newFakeTradesk(t)
	fake.expireAfter = 1 // первый POST вернёт форму логина → клиент перелогинится и повторит
	srv := httptest.NewServer(fake.mux)
	defer srv.Close()
	c := newTestClient(t, srv)

	payload, _ := json.Marshal(orders.CallbackInput{Phone: "+79210000000"})
	if err := c.Deliver(context.Background(), orders.KindCallback, payload); err != nil {
		t.Fatalf("Deliver: %v", err)
	}
	if got := fake.logins.Load(); got != 2 {
		t.Errorf("логинов: got %d, want 2 (первичный + после протухания)", got)
	}
	if fake.lastForm.Get(fieldBackcallPhone) != "+79210000000" {
		t.Error("повторная доставка не долетела с полями")
	}
}

func TestDeliverOrderFields(t *testing.T) {
	fake := newFakeTradesk(t)
	srv := httptest.NewServer(fake.mux)
	defer srv.Close()
	c := newTestClient(t, srv)

	payload, _ := json.Marshal(orderPayload{
		OrderID: 7, CustomerName: "Пётр", Phone: "+79219998877",
		Items: []orders.OrderItem{{Slug: "nokian-1", Qty: 4, Price: 12000}},
		Total: 48000,
	})
	if err := c.Deliver(context.Background(), orders.KindOrder, payload); err != nil {
		t.Fatalf("Deliver: %v", err)
	}
	if got := fake.lastForm.Get("OrderItem[0][slug]"); got != "nokian-1" {
		t.Errorf("item slug: got %q", got)
	}
	if got := fake.lastForm.Get("OrderItem[0][qty]"); got != "4" {
		t.Errorf("item qty: got %q", got)
	}
}

func TestDeliverUnknownKind(t *testing.T) {
	fake := newFakeTradesk(t)
	srv := httptest.NewServer(fake.mux)
	defer srv.Close()
	c := newTestClient(t, srv)
	if err := c.Deliver(context.Background(), "storage", nil); err == nil || !strings.Contains(err.Error(), "неизвестный вид") {
		t.Errorf("ожидали ошибку неизвестного вида, got %v", err)
	}
}
