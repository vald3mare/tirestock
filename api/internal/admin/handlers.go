package admin

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"tirestock/api/internal/httpx"
)

type ctxKey int

const userKey ctxKey = 0

// Handlers — HTTP-слой админки. Токен сессии ходит между Next и Go в заголовке
// Authorization: Bearer <token>; httpOnly-куку на домене витрины ставит Next.
type Handlers struct {
	svc *Service
}

func NewHandlers(svc *Service) *Handlers {
	return &Handlers{svc: svc}
}

// Mount вешает роуты админки. Публичен только login; остальное — за сессией.
func (h *Handlers) Mount(r chi.Router) {
	r.Route("/admin", func(r chi.Router) {
		r.Post("/login", h.login)

		r.Group(func(r chi.Router) {
			r.Use(h.requireSession)
			r.Post("/logout", h.logout)
			r.Get("/me", h.me)
			r.Get("/orders", h.orders)
			r.Post("/orders/{id}/retry", h.retryOrder)
			r.Get("/products", h.products)
			r.Put("/products/{slug}/override", h.setOverride)
		})
	})
}

// requireSession валидирует Bearer-токен и кладёт пользователя в контекст.
func (h *Handlers) requireSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := bearer(r)
		u, err := h.svc.Authenticate(r.Context(), token)
		if err != nil {
			httpx.Error(w, http.StatusUnauthorized, "unauthorized", "требуется вход")
			return
		}
		ctx := context.WithValue(r.Context(), userKey, u)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func bearer(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if after, ok := strings.CutPrefix(h, "Bearer "); ok {
		return after
	}
	return ""
}

func userFrom(ctx context.Context) User {
	u, _ := ctx.Value(userKey).(User)
	return u
}

// ── login / logout / me ─────────────────────────────────────────────────────

type loginInput struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token     string `json:"token"`
	ExpiresAt string `json:"expires_at"` // RFC3339, для срока куки в Next
	User      User   `json:"user"`
}

func (h *Handlers) login(w http.ResponseWriter, r *http.Request) {
	var in loginInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.ValidationFailed(w, "некорректный JSON")
		return
	}
	token, expires, err := h.svc.Login(r.Context(), in.Username, in.Password)
	if errors.Is(err, ErrInvalidCredentials) {
		httpx.Error(w, http.StatusUnauthorized, "invalid_credentials", "неверный логин или пароль")
		return
	}
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	u, _ := h.svc.Authenticate(r.Context(), token)
	httpx.JSON(w, http.StatusOK, loginResponse{
		Token:     token,
		ExpiresAt: expires.UTC().Format("2006-01-02T15:04:05Z07:00"),
		User:      u,
	})
}

func (h *Handlers) logout(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.Logout(r.Context(), bearer(r)); err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handlers) me(w http.ResponseWriter, r *http.Request) {
	httpx.JSON(w, http.StatusOK, userFrom(r.Context()))
}

// ── заказы ──────────────────────────────────────────────────────────────────

func (h *Handlers) orders(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	res, err := h.svc.Orders(r.Context(), r.URL.Query().Get("status"), page)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handlers) retryOrder(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpx.ValidationFailed(w, "некорректный id заказа")
		return
	}
	if err := h.svc.RetryOrder(r.Context(), id); err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "queued"})
}

// ── товары ──────────────────────────────────────────────────────────────────

func (h *Handlers) products(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.Products(r.Context(), r.URL.Query().Get("q"))
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": items})
}

type overrideInput struct {
	Hidden   bool `json:"hidden"`
	BadgeHit bool `json:"badge_hit"`
}

func (h *Handlers) setOverride(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	var in overrideInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.ValidationFailed(w, "некорректный JSON")
		return
	}
	if err := h.svc.SetOverride(r.Context(), slug, in.Hidden, in.BadgeHit, userFrom(r.Context()).ID); err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "saved"})
}
