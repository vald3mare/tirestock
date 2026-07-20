package admin

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
)

// Хеш пароля — pbkdf2-sha256, строка формата
// pbkdf2_sha256$<iter>$<salt_b64>$<hash_b64>. Без внешних зависимостей (stdlib).
const (
	pbkdf2Iter   = 120_000
	pbkdf2KeyLen = 32
	saltLen      = 16
)

// hashPassword формирует хеш для хранения в admin_users.password_hash.
func hashPassword(password string) (string, error) {
	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("rand salt: %w", err)
	}
	dk, err := pbkdf2.Key(sha256.New, password, salt, pbkdf2Iter, pbkdf2KeyLen)
	if err != nil {
		return "", fmt.Errorf("pbkdf2: %w", err)
	}
	return fmt.Sprintf("pbkdf2_sha256$%d$%s$%s",
		pbkdf2Iter,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(dk),
	), nil
}

// verifyPassword сверяет пароль с хранимым хешем (constant-time).
func verifyPassword(password, encoded string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 4 || parts[0] != "pbkdf2_sha256" {
		return false
	}
	iter, err := strconv.Atoi(parts[1])
	if err != nil {
		return false
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[2])
	if err != nil {
		return false
	}
	want, err := base64.RawStdEncoding.DecodeString(parts[3])
	if err != nil {
		return false
	}
	got, err := pbkdf2.Key(sha256.New, password, salt, iter, len(want))
	if err != nil {
		return false
	}
	return subtle.ConstantTimeCompare(got, want) == 1
}

// newSessionToken выдаёт случайный токен (клиенту в куку) и его sha256-хеш
// (хранится в БД, чтобы утечка таблицы не раскрывала действующие токены).
func newSessionToken() (token, tokenHash string, err error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", "", fmt.Errorf("rand token: %w", err)
	}
	token = base64.RawURLEncoding.EncodeToString(buf)
	return token, hashToken(token), nil
}

// hashToken — sha256(token) в hex; детерминированно для поиска сессии по куке.
func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
