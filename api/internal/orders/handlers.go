package orders

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"tirestock/api/internal/httpx"
)

// Handlers — тонкие HTTP-хендлеры: распарсить → провалидировать → сервис → DTO.
type Handlers struct {
	svc *Service
}

func NewHandlers(svc *Service) *Handlers {
	return &Handlers{svc: svc}
}

func (h *Handlers) Mount(r chi.Router) {
	r.Post("/orders", h.createOrder)
	r.Post("/callbacks", h.createCallback)
	r.Post("/requests", h.createRequest)
}

// CreateOrderResponse — ответ POST /api/v1/orders.
type CreateOrderResponse struct {
	OrderID int64 `json:"order_id"`
}

func (h *Handlers) createOrder(w http.ResponseWriter, r *http.Request) {
	var in CreateOrderInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.ValidationFailed(w, "некорректный JSON")
		return
	}
	// Idempotency-key принимаем и заголовком, и полем тела.
	if k := r.Header.Get("Idempotency-Key"); k != "" {
		in.IdempotencyKey = k
	}
	id, err := h.svc.CreateOrder(r.Context(), in)
	if errors.Is(err, ErrValidation) {
		httpx.ValidationFailed(w, err.Error())
		return
	}
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, CreateOrderResponse{OrderID: id})
}

// createRequest — заявка с формы услуги (шиномонтаж, хранение, ремонт дисков…).
// Отличается от обратного звонка типом услуги: в tradesk уходит отдельным полем.
func (h *Handlers) createRequest(w http.ResponseWriter, r *http.Request) {
	var in RequestInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.ValidationFailed(w, "некорректный JSON")
		return
	}
	err := h.svc.CreateRequest(r.Context(), in)
	if errors.Is(err, ErrValidation) {
		httpx.ValidationFailed(w, err.Error())
		return
	}
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]string{"status": "accepted"})
}

func (h *Handlers) createCallback(w http.ResponseWriter, r *http.Request) {
	var in CallbackInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.ValidationFailed(w, "некорректный JSON")
		return
	}
	err := h.svc.CreateCallback(r.Context(), in)
	if errors.Is(err, ErrValidation) {
		httpx.ValidationFailed(w, err.Error())
		return
	}
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]string{"status": "accepted"})
}
