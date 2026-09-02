package orderstatus

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"tirestock/api/internal/httpx"
)

// PublicHandlers — публичный HTTP-слой: проверка статуса заказа по номеру
// (страница /status/ витрины). Без авторизации, как на старом сайте.
type PublicHandlers struct {
	svc *Service
}

func NewPublicHandlers(svc *Service) *PublicHandlers {
	return &PublicHandlers{svc: svc}
}

func (h *PublicHandlers) Mount(r chi.Router) {
	r.Get("/order-status", h.lookup)
}

// lookup: GET /api/v1/order-status?code=C288416 → статус заказа (found:false, если
// не найден или tradesk-приём выключен).
func (h *PublicHandlers) lookup(w http.ResponseWriter, r *http.Request) {
	st, err := h.svc.Lookup(r.Context(), r.URL.Query().Get("code"))
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, st)
}
