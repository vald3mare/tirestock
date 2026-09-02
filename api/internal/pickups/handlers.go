package pickups

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"tirestock/api/internal/httpx"
)

// PublicHandlers — публичный HTTP-слой (без авторизации): опубликованные пункты
// выдачи для страниц /points и /points/<slug> витрины.
type PublicHandlers struct {
	svc *Service
}

func NewPublicHandlers(svc *Service) *PublicHandlers {
	return &PublicHandlers{svc: svc}
}

func (h *PublicHandlers) Mount(r chi.Router) {
	r.Get("/pickup-points", h.list)
	r.Get("/pickup-points/{slug}", h.bySlug)
}

type listResponse struct {
	Items []Point `json:"items"`
}

// list: GET /api/v1/pickup-points?city=spb → опубликованные пункты города.
func (h *PublicHandlers) list(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListPublished(r.Context(), r.URL.Query().Get("city"))
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, listResponse{Items: items})
}

// bySlug: GET /api/v1/pickup-points/{slug} → пункт для отдельной страницы.
func (h *PublicHandlers) bySlug(w http.ResponseWriter, r *http.Request) {
	p, err := h.svc.BySlug(r.Context(), chi.URLParam(r, "slug"))
	if errors.Is(err, ErrNotFound) {
		httpx.NotFound(w, "пункт не найден")
		return
	}
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}
