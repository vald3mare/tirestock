package seo

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"tirestock/api/internal/httpx"
)

// PublicHandlers — публичный HTTP-слой (без авторизации): эффективная мета
// маршрута для generateMetadata на витрине.
type PublicHandlers struct {
	svc *Service
}

func NewPublicHandlers(svc *Service) *PublicHandlers {
	return &PublicHandlers{svc: svc}
}

func (h *PublicHandlers) Mount(r chi.Router) {
	r.Get("/seo", h.resolve)
}

// resolve: GET /api/v1/seo?path=/catalog → эффективные title/description.
// Пустой path трактуется как '/'. Неизвестный маршрут отдаёт дефолт-шаблон.
func (h *PublicHandlers) resolve(w http.ResponseWriter, r *http.Request) {
	route := r.URL.Query().Get("path")
	if route == "" {
		route = "/"
	}
	res, err := h.svc.Resolve(r.Context(), route)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}
