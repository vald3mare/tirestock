#!/usr/bin/env bash
# Контрактный smoke-тест публичного API: прогоняет каждый эндпоинт витрины и
# проверяет код ответа + обязательные поля JSON (по OpenAPI required). Ловит
# регрессии контракта («запрос не обработался»). Ничего не пишет в БД/tradesk —
# только GET и один idempotent-безопасный POST на мок НЕ шлём.
#
# Использование: API_BASE=http://localhost:8080 deploy/smoke-api.sh
set -uo pipefail

BASE="${API_BASE:-http://localhost:8080}/api/v1"
PASS=0; FAIL=0

# check <name> <url> <expected_code> [jq_required_field ...]
check() {
  local name="$1" url="$2" want="$3"; shift 3
  local body code
  body=$(curl -s -m 15 -w $'\n%{http_code}' "$url" 2>/dev/null)
  code="${body##*$'\n'}"; body="${body%$'\n'*}"
  if [ "$code" != "$want" ]; then
    echo "  ✗ $name — код $code, ждали $want"; FAIL=$((FAIL+1)); return
  fi
  for field in "$@"; do
    if ! echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); k='$field'.split('.'); v=d
for p in k: v=v[int(p)] if p.lstrip('-').isdigit() else v[p]" 2>/dev/null; then
      echo "  ✗ $name — нет обязательного поля '$field'"; FAIL=$((FAIL+1)); return
    fi
  done
  echo "  ✓ $name"; PASS=$((PASS+1))
}

echo "== Контрактный smoke-тест публичного API =="
echo "base: $BASE"
echo
echo "-- health --"
check "health"              "$BASE/health" 200 status

echo "-- каталог --"
check "products list"       "$BASE/products?per_page=2" 200 items total page per_page
check "products фильтр"     "$BASE/products?width=205&season=winter&per_page=1" 200 items total
check "products цена"       "$BASE/products?price_min=5000&price_max=20000&per_page=1" 200 total
check "products сортировка" "$BASE/products?sort=price_asc&per_page=1" 200 items
check "products город msk"  "$BASE/products?city=msk&per_page=1" 200 total
check "products плохой city"  "$BASE/products?city=xyz&per_page=1" 200 total
check "products плохой width" "$BASE/products?width=abc" 400 error
check "facets spb"          "$BASE/catalog/facets?city=spb" 200 brands widths profiles diameters popular_sizes
check "facets msk"          "$BASE/catalog/facets?city=msk" 200 brands popular_sizes

# товар по slug — берём реальный slug из листинга
SLUG=$(curl -s -m 15 "$BASE/products?per_page=1" | python3 -c 'import sys,json;print(json.load(sys.stdin)["items"][0]["slug"])' 2>/dev/null)
if [ -n "$SLUG" ]; then
  check "product by slug"   "$BASE/products/$SLUG" 200 id slug brand model name size_label price stock badge_hit
  check "product bad slug"  "$BASE/products/nope-does-not-exist-xyz" 404 error
fi

echo "-- контент/сервисы --"
check "benefits"            "$BASE/benefits" 200 items
check "pickup-points spb"   "$BASE/pickup-points?city=spb" 200 items
check "pickup-point slug"   "$BASE/pickup-points/novoselov-49" 200 id slug address
check "pickup bad slug"     "$BASE/pickup-points/nope-xyz" 404 error
check "seo /"               "$BASE/seo?path=/" 200 title description
check "content /about/"     "$BASE/content?path=/about/" 200 slug title body
check "content bad path"    "$BASE/content?path=/nope-xyz/" 404 error

echo "-- обратная интеграция --"
check "order-status пусто"  "$BASE/order-status?code=NOPE123" 200 found code status_text step products

echo
echo "== Итог: $PASS ok, $FAIL ошибок =="
[ "$FAIL" -eq 0 ]
