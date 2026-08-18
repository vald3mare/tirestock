package admin

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"tirestock/api/internal/httpx"
	"tirestock/api/internal/pickups"
)

// HTTP-слой раздела «Пункты выдачи». Домен — internal/pickups; здесь парсинг,
// маппинг ошибок и подстановка автора правки.

func pickupID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpx.ValidationFailed(w, "некорректный id пункта")
		return 0, false
	}
	return id, true
}

func mapPickupErr(w http.ResponseWriter, err error) bool {
	switch {
	case err == nil:
		return false
	case errors.Is(err, pickups.ErrNotFound):
		httpx.NotFound(w, "пункт не найден")
	case errors.Is(err, pickups.ErrAddressMissing):
		httpx.ValidationFailed(w, "адрес обязателен")
	default:
		httpx.Internal(w, err)
	}
	return true
}

type pickupsListResponse struct {
	Items []pickups.Point `json:"items"`
	Total int             `json:"total"`
}

func (h *Handlers) pickupsList(w http.ResponseWriter, r *http.Request) {
	items, err := h.pickups.List(r.Context())
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, pickupsListResponse{Items: items, Total: len(items)})
}

func (h *Handlers) pickup(w http.ResponseWriter, r *http.Request) {
	id, ok := pickupID(w, r)
	if !ok {
		return
	}
	p, err := h.pickups.Get(r.Context(), id)
	if mapPickupErr(w, err) {
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

type pickupInput struct {
	Address   string `json:"address"`
	Metro     string `json:"metro"`
	Hours     string `json:"hours"`
	Badge     string `json:"badge"`
	Note      string `json:"note"`
	IsCentral bool   `json:"is_central"`
	SortOrder int    `json:"sort_order"`
	Published bool   `json:"published"`
}

func (in pickupInput) toDomain() pickups.Input {
	return pickups.Input{
		Address: in.Address, Metro: in.Metro, Hours: in.Hours, Badge: in.Badge,
		Note: in.Note, IsCentral: in.IsCentral, SortOrder: in.SortOrder, Published: in.Published,
	}
}

func (h *Handlers) createPickup(w http.ResponseWriter, r *http.Request) {
	var in pickupInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.ValidationFailed(w, "некорректный JSON")
		return
	}
	p, err := h.pickups.Create(r.Context(), in.toDomain(), h.editor(r))
	if mapPickupErr(w, err) {
		return
	}
	httpx.JSON(w, http.StatusCreated, p)
}

func (h *Handlers) updatePickup(w http.ResponseWriter, r *http.Request) {
	id, ok := pickupID(w, r)
	if !ok {
		return
	}
	var in pickupInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.ValidationFailed(w, "некорректный JSON")
		return
	}
	if mapPickupErr(w, h.pickups.Update(r.Context(), id, in.toDomain(), h.editor(r))) {
		return
	}
	p, err := h.pickups.Get(r.Context(), id)
	if mapPickupErr(w, err) {
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handlers) deletePickup(w http.ResponseWriter, r *http.Request) {
	id, ok := pickupID(w, r)
	if !ok {
		return
	}
	if mapPickupErr(w, h.pickups.Delete(r.Context(), id)) {
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
