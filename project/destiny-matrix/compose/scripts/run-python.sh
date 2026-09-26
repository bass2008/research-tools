#!/usr/bin/env bash
# Запуск без докера: uvicorn и собранный фронт на node.
# Аргументы ru/en сохранены как алиасы общего приложения, язык выбирается по Host.
set -euo pipefail
cd "$(dirname "$0")/../.."
case "${1:-}" in
  ""|ru|en) ;;
  *) echo "использование: run-python.sh [ru|en]"; exit 1 ;;
esac
export SITE_LANG=ru NEXT_PUBLIC_SITE_LANG=ru NEXT_PUBLIC_SUPPORTED_LOCALES=ru,en
export ALL_FREE_WITHOUT_PAYMENT="${ALL_FREE_WITHOUT_PAYMENT:-0}"
export WEB_PORT="${WEB_PORT:-3000}" API_PORT="${API_PORT:-8010}"
export MOCK_PAYMENTS="${MOCK_PAYMENTS:-1}" MAIL_TO_LOG=1 SESSION_COOKIE_SECURE=0
export NEXT_PUBLIC_ALL_FREE_WITHOUT_PAYMENT="$ALL_FREE_WITHOUT_PAYMENT"

PY="${PY:-/home/sergey/miniconda3/envs/research3.12/bin/python}"
LOGS=/tmp/arcana; mkdir -p "$LOGS"

# ключи Postbox и бакета отчётов лежат вне репозитория: без них письма пишутся в лог,
# а печать PDF отвечает 503
for env in ~/.config/arcana/smtp.env ~/.config/arcana/reports.env; do
  if [ -f "$env" ]; then set -a; . "$env"; set +a; fi
done

# Один и тот же allowlist передаём BFF и API, включая Host внутреннего браузера.
export SITE_PROFILES="$("$PY" - <<'CONFIG'
import json, os
port = os.environ["WEB_PORT"]
provider = os.environ.get("PAYMENT_PROVIDER", "mock")
ru = f"http://localhost:{port}"
print(json.dumps([
    {"origin": ru, "hosts": [f"localhost:{port}", f"ru.localhost:{port}"],
     "defaultLocale": "ru", "locales": ["ru"],
     "payments": [{"id": provider, "provider": provider,
                   "notificationUrl": f"{ru}/api/payments/notify/{provider}"}]},
    {"origin": f"http://127.0.0.1:{port}",
     "hosts": [f"127.0.0.1:{port}", f"com.localhost:{port}", f"host.docker.internal:{port}"],
     "defaultLocale": "en", "locales": ["en", "ru"], "payments": []},
]))
CONFIG
)"

# Печать PDF без докера не работает: Chromium живёт в контейнере. Если демон отвечает —
# поднимаем его тем же образом, что и в compose; браузер видит фронт как host.docker.internal.
if docker info >/dev/null 2>&1; then
  docker build -q -f compose/browser.Dockerfile -t arcana-browser:dev compose >/dev/null
  docker rm -f arcana-browser-dev >/dev/null 2>&1 || true
  docker run -d --name arcana-browser-dev -p 3001:3001 --memory 512m \
    -e BROWSER_SECRET="${BROWSER_SECRET:-dev-browser-secret}" \
    --add-host host.docker.internal:host-gateway arcana-browser:dev >/dev/null
  export BROWSER_URL=http://127.0.0.1:3001 WEB_INTERNAL_URL="http://host.docker.internal:$WEB_PORT"
  echo "== браузер печати поднят"
else
  echo "== docker не отвечает: печать PDF будет недоступна"
fi

# Ждём, пока порт реально освободится: `sleep 2` не хватало, и uvicorn падал на «address already
# in use» — скрипт при этом молча висел в ожидании здоровья, а выглядело как зависшая сборка.
for port in "$API_PORT" "$WEB_PORT"; do
  for pid in $(ss -ltnp 2>/dev/null | grep ":$port " | grep -o 'pid=[0-9]*' | cut -d= -f2); do kill "$pid"; done
done
for port in "$API_PORT" "$WEB_PORT"; do
  for _ in $(seq 1 40); do
    ss -ltn 2>/dev/null | grep -q ":$port " || break
    sleep 0.5
  done
done

echo "== api"
# setsid --fork, а не просто setsid: без форка процесс остаётся потомком скрипта, и bash в конце
# ждёт его завершения — скрипт не выходил, пока работает api, и это выглядело как зависание.
(cd api && PYTHONPATH=.. "$PY" -m app.schema ensure >>"$LOGS/api.log" 2>&1 \
  && PYTHONPATH=.. setsid --fork "$PY" -m uvicorn app.main:app --host 127.0.0.1 --port "$API_PORT" \
       </dev/null >>"$LOGS/api.log" 2>&1 &)

echo "== фронт: сборка"
cd web
export NEXT_PUBLIC_BUILD_COMMIT="$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- .. || echo +)"
export NEXT_PUBLIC_BUILD_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
export NEXT_PUBLIC_BUILD_TIME="$(TZ=Europe/Moscow date '+%Y-%m-%d %H:%M МСК')"
export NEXT_PUBLIC_SITE_URL="${SITE_URL:-http://127.0.0.1:$WEB_PORT}"
npm run build >"$LOGS/build.log" 2>&1 || { tail -20 "$LOGS/build.log"; exit 1; }

# NODE_ENV=development: с secure-кукой вход по http не работает
NODE_ENV=development API_INTERNAL_URL="http://127.0.0.1:$API_PORT" \
  setsid --fork npx next start -p "$WEB_PORT" </dev/null >"$LOGS/web.log" 2>&1 &

# Ожидание с пределом: молчаливое «висит» ничего не говорит о причине, а причина всегда в логе.
for _ in $(seq 1 90); do
  curl -sf -o /dev/null "http://127.0.0.1:$WEB_PORT/" \
    && curl -sf -o /dev/null "http://127.0.0.1:$API_PORT/api/health" && ready=1 && break
  sleep 1
done
if [ "${ready:-0}" != 1 ]; then
  echo "не поднялось за 90 с:"
  curl -sf -o /dev/null "http://127.0.0.1:$API_PORT/api/health" || { echo "-- api ($LOGS/api.log)"; tail -5 "$LOGS/api.log"; }
  curl -sf -o /dev/null "http://127.0.0.1:$WEB_PORT/" || { echo "-- фронт ($LOGS/web.log)"; tail -5 "$LOGS/web.log"; }
  exit 1
fi
echo "сайт: http://127.0.0.1:$WEB_PORT (COM) / http://localhost:$WEB_PORT (RU)  ·  логи: $LOGS"
