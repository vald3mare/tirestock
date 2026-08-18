package admin

import (
	"encoding/json"
	"errors"
	"net/http"

	"tirestock/api/internal/httpx"
	"tirestock/api/internal/seo"
)

// HTTP-слой раздела «SEO-мета». Домен — internal/seo; здесь парсинг, маппинг
// ошибок и подстановка автора. Маршруты фиксированы (сид), поэтому только
// список и правка — без создания/удаления.

func mapSeoErr(w http.ResponseWriter, err error) bool {
	switch {
	case err == nil:
		return false
	case errors.Is(err, seo.ErrNotFound):
		httpx.NotFound(w, "маршрут не найден")
	default:
		httpx.Internal(w, err)
	}
	return true
}

type seoListResponse struct {
	Items []seo.Meta `json:"items"`
	Total int        `json:"total"`
}

func (h *Handlers) seoList(w http.ResponseWriter, r *http.Request) {
	items, err := h.seo.List(r.Context())
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, seoListResponse{Items: items, Total: len(items)})
}

type seoUpdateInput struct {
	Route       string `json:"route"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

func (h *Handlers) seoUpdate(w http.ResponseWriter, r *http.Request) {
	var in seoUpdateInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.ValidationFailed(w, "некорректный JSON")
		return
	}
	if in.Route == "" {
		httpx.ValidationFailed(w, "не задан маршрут")
		return
	}
	err := h.seo.Update(r.Context(), in.Route, seo.Input{Title: in.Title, Description: in.Description}, h.editor(r))
	if mapSeoErr(w, err) {
		return
	}
	m, err := h.seo.Get(r.Context(), in.Route)
	if mapSeoErr(w, err) {
		return
	}
	httpx.JSON(w, http.StatusOK, m)
}
