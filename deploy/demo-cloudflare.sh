#!/usr/bin/env bash
# Демо-стенд для показа заказчику через Cloudflare quick-туннель.
# Поднимает весь стек (Next + Go + Postgres) на ЭТОЙ машине и публикует витрину
# наружу по HTTPS. URL случайный (*.trycloudflare.com) и МЕНЯЕТСЯ при каждом
# запуске — это нормально для быстрого демо (аккаунт/домен Cloudflare не нужны).
#
# Стоп: Ctrl+C (туннель гаснет); стек остановить — docker compose ... down.
#
# Почему host-сеть: на этой машине firewall режет межконтейнерный трафik
# (bridge FORWARD dropped), поэтому api/web сидят на host-сети (overlay
# docker-compose.hostnet-demo.yml). Починка firewall (iptables FORWARD ACCEPT
# для docker) сделает overlay ненужным.
set -euo pipefail
cd "$(dirname "$0")"

CLOUDFLARED="${CLOUDFLARED:-$HOME/.local/bin/cloudflared}"
WEB_PORT="${WEB_PORT:-3000}"

echo "▶ Поднимаю стек (Next + Go + Postgres)…"
docker compose -f docker-compose.yml -f docker-compose.hostnet-demo.yml --env-file .env up -d --build

echo "▶ Жду готовности витрины на :$WEB_PORT…"
for _ in $(seq 1 60); do
  if curl -s -o /dev/null "http://localhost:$WEB_PORT/"; then break; fi
  sleep 1
done

echo "▶ Открываю Cloudflare quick-туннель…"
echo "  (публичный URL появится ниже; для показа заказчику дайте именно его)"
echo
# --protocol http2: на этой машине активен VPN/прокси (FlClashX), QUIC-транспорт
# cloudflared через него рвётся ('control stream failure'). http2 устойчивее.
exec "$CLOUDFLARED" tunnel --no-autoupdate --protocol http2 --url "http://localhost:$WEB_PORT"
