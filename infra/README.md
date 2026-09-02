# Прод-деплой TireStock на Yandex Cloud

Стек: **Compute VM (Docker Compose)** + **Managed Service for PostgreSQL** +
**Traefik** (TLS Let's Encrypt). Витрина (Next) публична, Go-API внутренний,
Postgres — управляемый. Требование ТЗ «VPS в РФ» выполнено.

```
Интернет → Traefik(:443, TLS) → web(:3000, Next SSR) → api(:8080, Go) → Managed PostgreSQL
                                                          ↕
                                        SelectTyres (фид) · tradesk (заказы)
```

## Что понадобится
- Аккаунт Yandex Cloud с привязанной платёжкой
- Домен (A-запись на публичный IP VM) — для HTTPS
- ~400–600 ₽/мес VM + тариф Managed PostgreSQL

---

## Шаг 1. Managed PostgreSQL
1. Консоль YC → **Managed Service for PostgreSQL → Создать кластер**.
2. Версия 16, окружение PRODUCTION (или минимальный класс для старта, напр. `b1.medium`, 1 хост).
3. БД: имя `tirestock`, пользователь `tirestock`, задать пароль.
4. Хосты: включить **публичный доступ** к хосту (или разместить VM в той же сети — тогда без публичного доступа, безопаснее).
5. Скопировать **строку подключения** (хост вида `rc1a-xxxx.mdb.yandexcloud.net:6432`).

`DATABASE_URL=postgres://tirestock:ПАРОЛЬ@rc1a-xxxx.mdb.yandexcloud.net:6432/tirestock?sslmode=require`

> Миграции накатываются автоматически при первом старте API (golang-migrate).
> Отдельно ничего запускать не нужно.

## Шаг 2. Compute VM
1. Консоль YC → **Compute Cloud → Создать ВМ**.
2. Ubuntu 22.04 LTS, 2 vCPU / 4 ГБ (можно прерываемую для демо — дешевле), диск 20+ ГБ.
3. **Публичный IPv4**, SSH-ключ.
4. Если Managed PG без публичного доступа — VM в **той же сети/подсети**, что и кластер.

## Шаг 3. Домен
- A-запись `demo.твойдомен.ru` → публичный IP VM.
- (Дождаться распространения DNS перед первым запуском — Let's Encrypt проверяет домен.)

## Шаг 4. Подготовка VM
```bash
ssh yc-user@<PUBLIC_IP>
# Docker + compose
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER" && newgrp docker
# Firewall: открыть 80/443 (в YC — security group: TCP 80,443 из 0.0.0.0/0; SSH 22 — только свой IP)
# Код
git clone https://github.com/vald3mare/tirestock.git ~/tirestock
cd ~/tirestock/infra
cp .env.prod.example .env.prod
nano .env.prod   # заполнить DOMAIN, ACME_EMAIL, DATABASE_URL, TRADESK_*, SELECTYRES_*, ADMIN_*
```

## Шаг 5. Запуск
```bash
cd ~/tirestock
./infra/deploy.sh
```
Traefik выпустит TLS-сертификат автоматически (нужен доступный 80-й порт и корректная A-запись).

## Шаг 6. Проверка
- Витрина: `https://demo.твойдомен.ru`
- Контракты: `API_BASE=http://localhost:8080 deploy/smoke-api.sh` (внутри VM; api не публичен)
- Логи: `docker compose -f infra/docker-compose.prod.yml logs -f api`

## Обновление (деплой новой версии)
```bash
cd ~/tirestock && ./infra/deploy.sh   # git pull + rebuild + up
```

---

## Усиление БД до verify-full (рекомендуется после старта)
1. Скачать CA Yandex на VM:
   `mkdir -p ~/.postgresql && curl -o ~/.postgresql/root.crt https://storage.yandexcloud.net/cloud-certs/CA.pem`
2. Смонтировать CA в контейнер api (том `~/.postgresql:/root/.postgresql:ro` в compose) и
   в `DATABASE_URL` заменить `sslmode=require` → `sslmode=verify-full`.

## Заметки
- **api не публикуется наружу** — только web через Traefik. Это by design (аудит безопасности).
- Кэш фото — в томе `web-image-cache`, переживает пересборку.
- Резервные копии БД — штатными средствами Managed PostgreSQL (автобэкапы в консоли YC).
- Секреты (`.env.prod`) не коммитятся.
