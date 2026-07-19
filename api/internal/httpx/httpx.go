// Package httpx — общие HTTP-помощники: единый формат ошибок и JSON-ответы.
package httpx

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// ErrorBody — единый формат ошибки API: {"error": {"code", "message"}}.
type ErrorBody struct {
	Error ErrorInfo `json:"error"`
}

type ErrorInfo struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Стабильные строковые коды ошибок.
const (
	CodeValidationFailed = "validation_failed"
	CodeNotFound         = "not_found"
	CodeInternal         = "internal_error"
)

func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("encode response", "err", err)
	}
}

func Error(w http.ResponseWriter, status int, code, message string) {
	JSON(w, status, ErrorBody{Error: ErrorInfo{Code: code, Message: message}})
}

func ValidationFailed(w http.ResponseWriter, message string) {
	Error(w, http.StatusBadRequest, CodeValidationFailed, message)
}

func NotFound(w http.ResponseWriter, message string) {
	Error(w, http.StatusNotFound, CodeNotFound, message)
}

func Internal(w http.ResponseWriter, err error) {
	slog.Error("internal error", "err", err)
	Error(w, http.StatusInternalServerError, CodeInternal, "внутренняя ошибка сервера")
}
