package admin

import "testing"

func TestPasswordHashVerify(t *testing.T) {
	hash, err := hashPassword("s3cret-пароль")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if !verifyPassword("s3cret-пароль", hash) {
		t.Error("верный пароль не прошёл проверку")
	}
	if verifyPassword("wrong", hash) {
		t.Error("неверный пароль прошёл проверку")
	}
	// Соль случайна — два хеша одного пароля различаются.
	hash2, _ := hashPassword("s3cret-пароль")
	if hash == hash2 {
		t.Error("хеши одинаковы — соль не работает")
	}
}

func TestVerifyRejectsMalformed(t *testing.T) {
	for _, bad := range []string{"", "plain", "bcrypt$1$x$y", "pbkdf2_sha256$abc$s$h"} {
		if verifyPassword("x", bad) {
			t.Errorf("принят битый хеш: %q", bad)
		}
	}
}

func TestSessionTokenHashDeterministic(t *testing.T) {
	token, hash, err := newSessionToken()
	if err != nil {
		t.Fatalf("token: %v", err)
	}
	if token == "" || hash == "" {
		t.Fatal("пустой токен/хеш")
	}
	if hashToken(token) != hash {
		t.Error("hashToken недетерминирован")
	}
	// Токен не хранится в открытом виде — хеш от него отличается.
	if hash == token {
		t.Error("хеш совпадает с токеном")
	}
}
