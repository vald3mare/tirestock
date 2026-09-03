package httpx

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// RateLimiter — простой in-memory лимитер по IP (token bucket), без внешних
// зависимостей (проект их минимизирует). Защищает от брутфорса логина и спама
// публичных форм/заказов. Для одной ноды достаточно; при масштабировании на
// несколько инстансов лимит станет per-instance — тогда выносить в Redis/шлюз.
type RateLimiter struct {
	mu       sync.Mutex
	buckets  map[string]*bucket
	rate     float64 // токенов в секунду (устойчивая скорость)
	burst    float64 // ёмкость ведра (пиковая пачка)
	name     string
}

type bucket struct {
	tokens float64
	last   time.Time
}

// NewRateLimiter: rate — запросов/сек в среднем, burst — максимальная пачка.
// name используется в заголовке для отладки. Запускает фоновую очистку.
func NewRateLimiter(name string, rate, burst float64) *RateLimiter {
	rl := &RateLimiter{
		buckets: make(map[string]*bucket),
		rate:    rate,
		burst:   burst,
		name:    name,
	}
	go rl.gc()
	return rl
}

// allow расходует один токен для ключа (IP). false → лимит превышен.
func (rl *RateLimiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	b, ok := rl.buckets[key]
	if !ok {
		rl.buckets[key] = &bucket{tokens: rl.burst - 1, last: now}
		return true
	}
	// Пополняем ведро пропорционально прошедшему времени.
	b.tokens += now.Sub(b.last).Seconds() * rl.rate
	if b.tokens > rl.burst {
		b.tokens = rl.burst
	}
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// gc раз в минуту выкидывает давно неактивные ведра (не растём в памяти).
func (rl *RateLimiter) gc() {
	for range time.Tick(time.Minute) {
		rl.mu.Lock()
		cutoff := time.Now().Add(-10 * time.Minute)
		for k, b := range rl.buckets {
			if b.last.Before(cutoff) {
				delete(rl.buckets, k)
			}
		}
		rl.mu.Unlock()
	}
}

// MaxBodyBytes ограничивает размер тела запроса (защита от DoS большим JSON).
// Оборачивает r.Body в http.MaxBytesReader — при превышении Decode вернёт ошибку,
// которую хендлеры уже трактуют как validation_failed (400).
func MaxBodyBytes(limit int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, limit)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// Middleware — chi-совместимый middleware: на превышение отдаёт 429.
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !rl.allow(clientIP(r)) {
			w.Header().Set("Retry-After", "60")
			Error(w, http.StatusTooManyRequests, "rate_limited", "слишком много запросов, попробуйте позже")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// clientIP извлекает IP клиента с учётом обратного прокси (Traefik ставит
// X-Forwarded-For / X-Real-IP). Берём первый адрес из X-Forwarded-For.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		first, _, _ := strings.Cut(xff, ",")
		return strings.TrimSpace(first)
	}
	if xr := r.Header.Get("X-Real-IP"); xr != "" {
		return xr
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
