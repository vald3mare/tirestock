package admin

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"tirestock/api/internal/benefits"
	"tirestock/api/internal/httpx"
)

// HTTP-слой раздела «Преимущества». Домен — internal/benefits; здесь парсинг,
// маппинг ошибок и подстановка автора правки.

func benefitID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpx.ValidationFailed(w, "некорректный id оффера")
		return 0, false
	}
	return id, true
}

func mapBenefitErr(w http.ResponseWriter, err error) bool {
	switch {
	case err == nil:
		return false
	case errors.Is(err, benefits.ErrNotFound):
		httpx.NotFound(w, "оффер не найден")
	case errors.Is(err, benefits.ErrTitleMissing):
		httpx.ValidationFailed(w, "заголовок обязателен")
	default:
		httpx.Internal(w, err)
	}
	return true
}

type benefitsListResponse struct {
	Items []benefits.Benefit `json:"items"`
	Total int                `json:"total"`
}

func (h *Handlers) benefitsList(w http.ResponseWriter, r *http.Request) {
	items, err := h.benefits.List(r.Context())
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, benefitsListResponse{Items: items, Total: len(items)})
}

func (h *Handlers) benefit(w http.ResponseWriter, r *http.Request) {
	id, ok := benefitID(w, r)
	if !ok {
		return
	}
	b, err := h.benefits.Get(r.Context(), id)
	if mapBenefitErr(w, err) {
		return
	}
	httpx.JSON(w, http.StatusOK, b)
}

type benefitInput struct {
	Icon      string `json:"icon"`
	Title     string `json:"title"`
	Note      string `json:"note"`
	Href      string `json:"href"`
	SortOrder int    `json:"sort_order"`
	Published bool   `json:"published"`
}

func (h *Handlers) createBenefit(w http.ResponseWriter, r *http.Request) {
	var in benefitInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.ValidationFailed(w, "некорректный JSON")
		return
	}
	b, err := h.benefits.Create(r.Context(), benefits.Input{
		Icon: in.Icon, Title: in.Title, Note: in.Note, Href: in.Href, SortOrder: in.SortOrder, Published: in.Published,
	}, h.editor(r))
	if mapBenefitErr(w, err) {
		return
	}
	httpx.JSON(w, http.StatusCreated, b)
}

func (h *Handlers) updateBenefit(w http.ResponseWriter, r *http.Request) {
	id, ok := benefitID(w, r)
	if !ok {
		return
	}
	var in benefitInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.ValidationFailed(w, "некорректный JSON")
		return
	}
	err := h.benefits.Update(r.Context(), id, benefits.Input{
		Icon: in.Icon, Title: in.Title, Note: in.Note, Href: in.Href, SortOrder: in.SortOrder, Published: in.Published,
	}, h.editor(r))
	if mapBenefitErr(w, err) {
		return
	}
	b, err := h.benefits.Get(r.Context(), id)
	if mapBenefitErr(w, err) {
		return
	}
	httpx.JSON(w, http.StatusOK, b)
}

func (h *Handlers) deleteBenefit(w http.ResponseWriter, r *http.Request) {
	id, ok := benefitID(w, r)
	if !ok {
		return
	}
	if mapBenefitErr(w, h.benefits.Delete(r.Context(), id)) {
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
