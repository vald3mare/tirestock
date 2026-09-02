package catalog

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"tirestock/api/internal/httpx"
)

// ListResponse — ответ GET /api/v1/products.
type ListResponse struct {
	Items   []Product `json:"items"`
	Total   int       `json:"total"`
	Page    int       `json:"page"`
	PerPage int       `json:"per_page"`
}

// Handlers — тонкие HTTP-хендлеры каталога: распарсить → сервис → DTO.
type Handlers struct {
	svc *Service
}

func NewHandlers(svc *Service) *Handlers {
	return &Handlers{svc: svc}
}

func (h *Handlers) Mount(r chi.Router) {
	r.Get("/products", h.list)
	r.Get("/products/{slug}", h.bySlug)
	r.Get("/catalog/facets", h.facets)
}

func (h *Handlers) facets(w http.ResponseWriter, r *http.Request) {
	f, err := h.svc.Facets(r.Context(), ParseCity(r.URL.Query().Get("city")))
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, f)
}

func (h *Handlers) list(w http.ResponseWriter, r *http.Request) {
	f, page, perPage, err := ParseFilters(r.URL.Query())
	if err != nil {
		httpx.ValidationFailed(w, err.Error())
		return
	}
	items, total, err := h.svc.List(r.Context(), f, page, perPage)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	if items == nil {
		items = []Product{}
	}
	httpx.JSON(w, http.StatusOK, ListResponse{Items: items, Total: total, Page: page, PerPage: perPage})
}

func (h *Handlers) bySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	p, err := h.svc.BySlug(r.Context(), slug, ParseCity(r.URL.Query().Get("city")))
	if errors.Is(err, ErrNotFound) {
		httpx.NotFound(w, "товар не найден")
		return
	}
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}
