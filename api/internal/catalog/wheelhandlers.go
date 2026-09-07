package catalog

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"tirestock/api/internal/httpx"
)

// WheelListResponse — ответ GET /api/v1/wheels.
type WheelListResponse struct {
	Items   []Wheel `json:"items"`
	Total   int     `json:"total"`
	Page    int     `json:"page"`
	PerPage int     `json:"per_page"`
}

// WheelHandlers — HTTP-хендлеры каталога дисков (изолированы от шин).
type WheelHandlers struct {
	svc *WheelService
}

func NewWheelHandlers(svc *WheelService) *WheelHandlers { return &WheelHandlers{svc: svc} }

func (h *WheelHandlers) Mount(r chi.Router) {
	r.Get("/wheels", h.list)
	r.Get("/wheels/facets", h.facets)
	r.Get("/wheels/{slug}", h.bySlug)
}

func (h *WheelHandlers) facets(w http.ResponseWriter, r *http.Request) {
	f, err := h.svc.Facets(r.Context(), ParseCity(r.URL.Query().Get("city")))
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, f)
}

func (h *WheelHandlers) list(w http.ResponseWriter, r *http.Request) {
	f, page, perPage, err := ParseWheelFilters(r.URL.Query())
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
		items = []Wheel{}
	}
	httpx.JSON(w, http.StatusOK, WheelListResponse{Items: items, Total: total, Page: page, PerPage: perPage})
}

func (h *WheelHandlers) bySlug(w http.ResponseWriter, r *http.Request) {
	p, err := h.svc.BySlug(r.Context(), chi.URLParam(r, "slug"), ParseCity(r.URL.Query().Get("city")))
	if errors.Is(err, ErrNotFound) {
		httpx.NotFound(w, "диск не найден")
		return
	}
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}
