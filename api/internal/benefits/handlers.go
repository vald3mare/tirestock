package benefits

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"tirestock/api/internal/httpx"
)

// PublicHandlers — публичный HTTP-слой (без авторизации): опубликованные офферы
// для строки BenefitsBar на витрине.
type PublicHandlers struct {
	svc *Service
}

func NewPublicHandlers(svc *Service) *PublicHandlers {
	return &PublicHandlers{svc: svc}
}

func (h *PublicHandlers) Mount(r chi.Router) {
	r.Get("/benefits", h.list)
}

type listResponse struct {
	Items []Benefit `json:"items"`
}

// list: GET /api/v1/benefits → опубликованные офферы в порядке вывода.
func (h *PublicHandlers) list(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListPublished(r.Context())
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, listResponse{Items: items})
}
