#!/usr/bin/env bash
# Деплой/обновление TireStock на прод-VM (Yandex Cloud). Запускать НА VM из корня репо.
# Идемпотентен: тянет свежий код, пересобирает образы, поднимает стек. Миграции БД
# накатываются самим API при старте (golang-migrate).
#
# Использование (на VM):
#   cd ~/tirestock && ./infra/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."   # корень репо

# Файл compose: по умолчанию домен+TLS (prod), но можно IP+HTTP:
#   COMPOSE_FILE=infra/docker-compose.ip.yml ./infra/deploy.sh
CF="${COMPOSE_FILE:-infra/docker-compose.prod.yml}"
COMPOSE="docker compose -f $CF --env-file infra/.env.prod"

if [ ! -f infra/.env.prod ]; then
  echo "✗ Нет infra/.env.prod — скопируй infra/.env.prod.example и заполни." >&2
  exit 1
fi

echo "▶ Обновляю код (git pull)…"
git pull --ff-only || echo "  (git pull пропущен — не git-репо или нет upstream)"

echo "▶ Сборка и запуск прод-стека…"
$COMPOSE up -d --build

echo "▶ Жду готовности api…"
for _ in $(seq 1 60); do
  if $COMPOSE exec -T api wget -qO- http://localhost:8080/api/v1/health >/dev/null 2>&1; then
    echo "  ✓ api healthy"; break
  fi
  sleep 2
done

echo "▶ Статус:"
$COMPOSE ps
echo
DOMAIN_VAL=$(grep -E '^DOMAIN=' infra/.env.prod | cut -d= -f2- || true)
if [ "$CF" = "infra/docker-compose.ip.yml" ]; then
  echo "Готово. Витрина по IP (HTTP): http://<публичный-IP-ВМ>/"
else
  echo "Готово. Витрина: https://${DOMAIN_VAL}"
fi
echo "Проверка контрактов: API_BASE=http://localhost:8080 deploy/smoke-api.sh (внутри сети VM)"
