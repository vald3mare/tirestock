package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRateLimiterBlocksAfterBurst(t *testing.T) {
	rl := NewRateLimiter("test", 0.01, 3) // пачка 3, пополнение почти нулевое
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) })
	h := rl.Middleware(ok)

	call := func() int {
		req := httptest.NewRequest(http.MethodPost, "/x", nil)
		req.Header.Set("X-Forwarded-For", "1.2.3.4")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}

	// Первые 3 (burst) проходят, 4-й — 429.
	for i := 0; i < 3; i++ {
		if code := call(); code != 200 {
			t.Fatalf("запрос %d: got %d, want 200", i+1, code)
		}
	}
	if code := call(); code != http.StatusTooManyRequests {
		t.Fatalf("4-й запрос: got %d, want 429", code)
	}
}

func TestRateLimiterPerIP(t *testing.T) {
	rl := NewRateLimiter("test", 0.01, 1)
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) })
	h := rl.Middleware(ok)
	do := func(ip string) int {
		req := httptest.NewRequest(http.MethodPost, "/x", nil)
		req.Header.Set("X-Forwarded-For", ip)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}
	// Разные IP не влияют друг на друга.
	if do("1.1.1.1") != 200 || do("2.2.2.2") != 200 {
		t.Fatal("разные IP должны обслуживаться независимо")
	}
	// Повтор того же IP — 429.
	if do("1.1.1.1") != http.StatusTooManyRequests {
		t.Fatal("повтор с того же IP должен дать 429")
	}
}

func TestClientIPFromXFF(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Forwarded-For", "203.0.113.7, 10.0.0.1")
	if got := clientIP(req); got != "203.0.113.7" {
		t.Errorf("clientIP: got %q, want 203.0.113.7", got)
	}
}
