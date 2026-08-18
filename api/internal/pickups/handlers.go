package pickups

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"tirestock/api/internal/httpx"
)

// PublicHandlers — публичный HTTP-слой (без авторизации): опубликованные пункты
// выдачи для страницы /points витрины.
type PublicHandlers struct {
	svc *Service
}

func NewPublicHandlers(svc *Service) *PublicHandlers {
	return &PublicHandlers{svc: svc}
}

func (h *PublicHandlers) Mount(r chi.Router) {
	r.Get("/pickup-points", h.list)
}

type listResponse struct {
	Items []Point `json:"items"`
}

func (h *PublicHandlers) list(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListPublished(r.Context())
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, listResponse{Items: items})
}
