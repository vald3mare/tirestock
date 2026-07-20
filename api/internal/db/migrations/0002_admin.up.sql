-- Пользователи админки. Пароль — pbkdf2 (stdlib crypto/pbkdf2), хеш строкой
-- вида pbkdf2_sha256$<iter>$<salt_b64>$<hash_b64>. Заводятся сидом из env.
CREATE TABLE admin_users (
    id            BIGSERIAL PRIMARY KEY,
    username      TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    display_name  TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Сессии админки: в БД хранится ХЕШ токена (sha256), клиенту в httpOnly-куке —
-- сам токен. Ревокация = удаление строки; протухшие чистятся по expires_at.
CREATE TABLE admin_sessions (
    token_hash TEXT        PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES admin_users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX admin_sessions_user_idx ON admin_sessions (user_id);

-- Оверрайды витрины поверх read-модели SelectTyres (истина цен/остатков — там,
-- мы их не трогаем). Здесь только наше: скрыть товар и бейдж «Хит». Ключ — slug.
CREATE TABLE product_overrides (
    slug       TEXT        PRIMARY KEY,
    hidden     BOOLEAN     NOT NULL DEFAULT FALSE,
    badge_hit  BOOLEAN     NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by BIGINT      REFERENCES admin_users (id) ON DELETE SET NULL
);
