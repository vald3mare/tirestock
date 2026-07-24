package admin

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"tirestock/api/internal/content"
	"tirestock/api/internal/httpx"
)

// HTTP-слой раздела «Страницы». Домен и правила блокировки — в internal/content;
// здесь только парсинг, маппинг ошибок и подстановка автора правки (updated_by).

type pagesListResponse struct {
	Items     []content.Page `json:"items"`
	Total     int            `json:"total"`
	Published int            `json:"published"`
	Drafts    int            `json:"drafts"`
}

func (h *Handlers) editor(r *http.Request) string {
	u := userFrom(r.Context())
	if u.DisplayName != "" {
		return u.DisplayName
	}
	return u.Username
}

// pageID парсит {id} из пути; при ошибке пишет 400 и возвращает ok=false.
func pageID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpx.ValidationFailed(w, "некорректный id страницы")
		return 0, false
	}
	return id, true
}

// mapContentErr переводит доменные ошибки content в HTTP-ответы. Возвращает
// true, если ошибка обработана (ответ уже записан).
func mapContentErr(w http.ResponseWriter, err error) bool {
	switch {
	case err == nil:
		return false
	case errors.Is(err, content.ErrNotFound):
		httpx.NotFound(w, "страница не найдена")
	case errors.Is(err, content.ErrForbidden):
		httpx.Error(w, http.StatusForbidden, "forbidden", "операция недоступна для этой страницы")
	case errors.Is(err, content.ErrSlugTaken):
		httpx.Error(w, http.StatusConflict, "slug_taken", "страница с таким URL уже есть")
	case errors.Is(err, content.ErrSlugInvalid):
		httpx.ValidationFailed(w, "URL должен начинаться с /")
	default:
		httpx.Internal(w, err)
	}
	return true
}

func (h *Handlers) pages(w http.ResponseWriter, r *http.Request) {
	items, err := h.content.List(r.Context())
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	published := 0
	for _, p := range items {
		if p.Published {
			published++
		}
	}
	httpx.JSON(w, http.StatusOK, pagesListResponse{
		Items: items, Total: len(items), Published: published, Drafts: len(items) - published,
	})
}

func (h *Handlers) page(w http.ResponseWriter, r *http.Request) {
	id, ok := pageID(w, r)
	if !ok {
		return
	}
	p, err := h.content.Get(r.Context(), id)
	if mapContentErr(w, err) {
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

type createPageInput struct {
	Slug  string `json:"slug"`
	Title string `json:"title"`
}

func (h *Handlers) createPage(w http.ResponseWriter, r *http.Request) {
	var in createPageInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.ValidationFailed(w, "некорректный JSON")
		return
	}
	p, err := h.content.Create(r.Context(), in.Slug, in.Title, h.editor(r))
	if mapContentErr(w, err) {
		return
	}
	httpx.JSON(w, http.StatusCreated, p)
}

type updatePageInput struct {
	Title           string `json:"title"`
	Body            string `json:"body"`
	MetaTitle       string `json:"meta_title"`
	MetaDescription string `json:"meta_description"`
}

func (h *Handlers) updatePage(w http.ResponseWriter, r *http.Request) {
	id, ok := pageID(w, r)
	if !ok {
		return
	}
	var in updatePageInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.ValidationFailed(w, "некорректный JSON")
		return
	}
	err := h.content.Update(r.Context(), id, content.UpdateInput{
		Title: in.Title, Body: in.Body, MetaTitle: in.MetaTitle, MetaDescription: in.MetaDescription,
	}, h.editor(r))
	if mapContentErr(w, err) {
		return
	}
	h.respondPage(w, r, id)
}

type renamePageInput struct {
	Slug string `json:"slug"`
}

func (h *Handlers) renamePage(w http.ResponseWriter, r *http.Request) {
	id, ok := pageID(w, r)
	if !ok {
		return
	}
	var in renamePageInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.ValidationFailed(w, "некорректный JSON")
		return
	}
	if mapContentErr(w, h.content.Rename(r.Context(), id, in.Slug, h.editor(r))) {
		return
	}
	h.respondPage(w, r, id)
}

type publishPageInput struct {
	Published bool `json:"published"`
}

func (h *Handlers) publishPage(w http.ResponseWriter, r *http.Request) {
	id, ok := pageID(w, r)
	if !ok {
		return
	}
	var in publishPageInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.ValidationFailed(w, "некорректный JSON")
		return
	}
	if mapContentErr(w, h.content.SetPublished(r.Context(), id, in.Published, h.editor(r))) {
		return
	}
	h.respondPage(w, r, id)
}

func (h *Handlers) deletePage(w http.ResponseWriter, r *http.Request) {
	id, ok := pageID(w, r)
	if !ok {
		return
	}
	if mapContentErr(w, h.content.Delete(r.Context(), id)) {
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// respondPage перечитывает страницу и отдаёт её свежее состояние.
func (h *Handlers) respondPage(w http.ResponseWriter, r *http.Request, id int64) {
	p, err := h.content.Get(r.Context(), id)
	if mapContentErr(w, err) {
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}
