#!/usr/bin/env bash
# ПОЛНЫЙ релиз-smoke: проверяет КАЖДЫЙ эндпоинт перед сдачей заказчику —
# публичные (read), пишущие формы (orders/callbacks/requests), обратную интеграцию
# и весь админ-контур (login → read → CRUD с самоочисткой).
#
# ⚠️ Пишущие запросы В tradesk (orders/callbacks/requests) помечены в payload
# «ТЕСТ ПЕРЕД РЕЛИЗОМ — НЕ ОБРАБАТЫВАТЬ», чтобы менеджер tradesk сразу видел тест.
# Админ-CRUD создаёт и тут же удаляет тестовую запись (после себя не мусорит).
#
# Использование:
#   API_BASE=http://localhost:8080 ADMIN_USER=admin ADMIN_PASSWORD=... deploy/smoke-release.sh
set -uo pipefail

BASE="${API_BASE:-http://localhost:8080}/api/v1"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
MARK="‼ ТЕСТ ПЕРЕД РЕЛИЗОМ — НЕ ОБРАБАТЫВАТЬ"
PASS=0; FAIL=0

jqget() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }

# check <name> <method> <url> <expected_code> [--data <json>] [--auth] [field ...]
check() {
  local name="$1" method="$2" url="$3" want="$4"; shift 4
  local data="" auth=() fields=()
  while [ $# -gt 0 ]; do
    case "$1" in
      --data) data="$2"; shift 2;;
      --auth) auth=(-H "Authorization: Bearer $TOKEN"); shift;;
      *) fields+=("$1"); shift;;
    esac
  done
  local args=(-s -m 20 -X "$method" "${auth[@]}")
  [ -n "$data" ] && args+=(-H 'Content-Type: application/json' -d "$data")
  local body code
  body=$(curl "${args[@]}" -w $'\n%{http_code}' "$url" 2>/dev/null)
  code="${body##*$'\n'}"; body="${body%$'\n'*}"
  if [ "$code" != "$want" ]; then
    echo "  ✗ $name — код $code, ждали $want ${data:+[payload помечен ТЕСТ]}"; FAIL=$((FAIL+1)); return 1
  fi
  for f in "${fields[@]}"; do
    if ! echo "$body" | python3 -c "import sys,json;d=json.load(sys.stdin);k='$f'.split('.');v=d
for p in k: v=v[int(p)] if p.lstrip('-').isdigit() else v[p]" 2>/dev/null; then
      echo "  ✗ $name — нет поля '$f'"; FAIL=$((FAIL+1)); return 1
    fi
  done
  echo "  ✓ $name"; PASS=$((PASS+1)); LAST_BODY="$body"; return 0
}

echo "════════════════════════════════════════════════════════"
echo " РЕЛИЗ-SMOKE TireStock — $BASE"
echo " Пишущие запросы помечены: «$MARK»"
echo "════════════════════════════════════════════════════════"

echo; echo "── 1. Публичные: каталог ──"
check "health"              GET "$BASE/health" 200 status
check "products list"       GET "$BASE/products?per_page=2" 200 items total page per_page
check "products фильтр"     GET "$BASE/products?width=205&season=winter&per_page=1" 200 items
check "products цена"       GET "$BASE/products?price_min=5000&price_max=20000&per_page=1" 200 total
check "products сортировка" GET "$BASE/products?sort=price_asc&per_page=1" 200 items
check "products город msk"  GET "$BASE/products?city=msk&per_page=1" 200 total
check "products плохой city"  GET "$BASE/products?city=xyz&per_page=1" 200 total
check "products плохой width" GET "$BASE/products?width=abc" 400 error
check "facets spb"          GET "$BASE/catalog/facets?city=spb" 200 brands widths popular_sizes
check "facets msk"          GET "$BASE/catalog/facets?city=msk" 200 brands popular_sizes

SLUG=$(curl -s -m 15 "$BASE/products?per_page=1" | jqget '["items"][0]["slug"]')
CODE=$(curl -s -m 15 "$BASE/products/$SLUG" | jqget '["code"]')
PRICE=$(curl -s -m 15 "$BASE/products/$SLUG" | jqget '["price"]')
NAME=$(curl -s -m 15 "$BASE/products/$SLUG" | jqget '["name"]')
if [ -n "$SLUG" ]; then
  check "product by slug"   GET "$BASE/products/$SLUG" 200 id slug brand price stock code
  check "product bad slug"  GET "$BASE/products/nope-xyz-000" 404 error
  echo "     (артикул для tradesk: code='$CODE')"
fi

echo; echo "── 2. Публичные: контент/сервисы ──"
check "benefits"            GET "$BASE/benefits" 200 items
check "pickup-points spb"   GET "$BASE/pickup-points?city=spb" 200 items
check "pickup-point slug"   GET "$BASE/pickup-points/novoselov-49" 200 id slug address
check "pickup bad slug"     GET "$BASE/pickup-points/nope-xyz" 404 error
check "seo /"               GET "$BASE/seo?path=/" 200 title description
check "content /about/"     GET "$BASE/content?path=/about/" 200 slug title body
check "content bad path"    GET "$BASE/content?path=/nope-xyz/" 404 error
check "order-status пусто"  GET "$BASE/order-status?code=NOPE123" 200 found status_text products

echo; echo "── 3. Пишущие формы → tradesk (ПОМЕЧЕНЫ ТЕСТ) ──"
IK="release-smoke-$(date +%s)"
ORDER_JSON=$(python3 -c "import json;print(json.dumps({'idempotency_key':'$IK','customer_name':'$MARK','phone':'+79990000000','comment':'$MARK','items':[{'slug':'$SLUG','code':'$CODE','name':'$NAME','price':$PRICE,'qty':4}]}))")
check "POST /orders"    POST "$BASE/orders"    201 --data "$ORDER_JSON" order_id
check "POST /callbacks" POST "$BASE/callbacks" 201 --data "$(python3 -c "import json;print(json.dumps({'name':'$MARK','phone':'+79990000000','comment':'$MARK'}))")" status
check "POST /requests"  POST "$BASE/requests"  201 --data "$(python3 -c "import json;print(json.dumps({'name':'$MARK','phone':'+79990000000','type':'шиномонтаж','comment':'$MARK'}))")" status

echo; echo "── 4. Админка: авторизация ──"
if [ -z "$ADMIN_PASSWORD" ]; then
  echo "  ⚠ ADMIN_PASSWORD не задан — админ-часть пропущена (задай ADMIN_PASSWORD=...)"
else
  LOGIN=$(curl -s -m 15 -X POST "$BASE/admin/login" -H 'Content-Type: application/json' \
    -d "$(python3 -c "import json;print(json.dumps({'username':'$ADMIN_USER','password':'$ADMIN_PASSWORD'}))")")
  TOKEN=$(echo "$LOGIN" | jqget '["token"]')
  if [ -z "$TOKEN" ]; then
    echo "  ✗ admin login — токен не получен: $(echo "$LOGIN" | head -c 120)"; FAIL=$((FAIL+1))
  else
    echo "  ✓ admin login (токен получен)"; PASS=$((PASS+1))
    check "GET /admin/me"            GET "$BASE/admin/me" 200 --auth username
    check "GET /admin/orders"        GET "$BASE/admin/orders" 200 --auth items stats
    check "GET /admin/products"      GET "$BASE/admin/products" 200 --auth
    check "GET /admin/pages"         GET "$BASE/admin/pages" 200 --auth
    check "GET /admin/benefits"      GET "$BASE/admin/benefits" 200 --auth items
    check "GET /admin/seo"           GET "$BASE/admin/seo" 200 --auth
    check "GET /admin/pickup-points" GET "$BASE/admin/pickup-points" 200 --auth items
    check "admin без токена → 401"   GET "$BASE/admin/me" 401 error

    # детальная карточка первого заказа (обратная интеграция статуса)
    OID=$(curl -s -m 15 -H "Authorization: Bearer $TOKEN" "$BASE/admin/orders" | jqget '["items"][0]["id"]')
    [ -n "$OID" ] && check "GET /admin/orders/{id}" GET "$BASE/admin/orders/$OID" 200 --auth id items

    echo; echo "── 5. Админ-CRUD (создать→изменить→удалить тест-преимущество) ──"
    BEN_JSON=$(python3 -c "import json;print(json.dumps({'icon':'star','title':'$MARK','note':'smoke','href':'','sort_order':999,'published':False}))")
    if check "POST /admin/benefits (create)" POST "$BASE/admin/benefits" 201 --auth --data "$BEN_JSON" id; then
      BID=$(echo "$LAST_BODY" | jqget '["id"]')
      check "GET /admin/benefits/{id}"    GET "$BASE/admin/benefits/$BID" 200 --auth id title
      UPD=$(python3 -c "import json;print(json.dumps({'icon':'star','title':'$MARK (изменено)','note':'smoke','href':'','sort_order':999,'published':False}))")
      check "PUT /admin/benefits/{id}"    PUT "$BASE/admin/benefits/$BID" 200 --auth --data "$UPD"
      check "DELETE /admin/benefits/{id}" DELETE "$BASE/admin/benefits/$BID" 200 --auth
      check "benefit удалён → 404"        GET "$BASE/admin/benefits/$BID" 404 --auth error
    fi
    curl -s -m 10 -X POST "$BASE/admin/logout" -H "Authorization: Bearer $TOKEN" >/dev/null 2>&1 && echo "  ✓ POST /admin/logout" && PASS=$((PASS+1))
  fi
fi

echo; echo "════════════════════════════════════════════════════════"
echo " ИТОГ: $PASS ok, $FAIL ошибок"
echo " ⚠ Тестовые заказы/заявки помечены «$MARK» — можно удалить в tradesk."
echo "════════════════════════════════════════════════════════"
[ "$FAIL" -eq 0 ]
