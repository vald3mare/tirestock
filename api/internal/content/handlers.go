package content

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"tirestock/api/internal/httpx"
)

// PublicHandlers — публичный HTTP-слой контентных страниц (без авторизации).
// Отдаёт только опубликованные страницы для рендера на витрине.
type PublicHandlers struct {
	svc *Service
}

func NewPublicHandlers(svc *Service) *PublicHandlers {
	return &PublicHandlers{svc: svc}
}

func (h *PublicHandlers) Mount(r chi.Router) {
	r.Get("/content", h.byPath)
}

// byPath: GET /api/v1/content?path=/points/ → опубликованная страница или 404.
func (h *PublicHandlers) byPath(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		httpx.ValidationFailed(w, "не задан параметр path")
		return
	}
	p, err := h.svc.PublicBySlug(r.Context(), path)
	if errors.Is(err, ErrNotFound) {
		httpx.NotFound(w, "страница не найдена")
		return
	}
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}
