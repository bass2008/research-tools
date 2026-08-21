#!/usr/bin/env bash
# Запуск без докера: uvicorn и собранный фронт на node.
set -euo pipefail
cd "$(dirname "$0")/../.."

PY="${PY:-/home/sergey/miniconda3/envs/research3.12/bin/python}"
LOGS=/tmp/arcana; mkdir -p "$LOGS"

# ключи Postbox и бакета отчётов лежат вне репозитория: без них письма пишутся в лог,
# а печать PDF отвечает 503
for env in ~/.config/arcana/smtp.env ~/.config/arcana/reports.env; do
  if [ -f "$env" ]; then set -a; . "$env"; set +a; fi
done

# Печать PDF без докера не работает: Chromium живёт в контейнере. Если демон отвечает —
# поднимаем его тем же образом, что и в compose; браузер видит фронт как host.docker.internal.
if docker info >/dev/null 2>&1; then
  docker build -q -f compose/browser.Dockerfile -t arcana-browser:dev compose >/dev/null
  docker rm -f arcana-browser-dev >/dev/null 2>&1 || true
  docker run -d --name arcana-browser-dev -p 3001:3001 --memory 512m \
    -e BROWSER_SECRET="${BROWSER_SECRET:-dev-browser-secret}" \
    --add-host host.docker.internal:host-gateway arcana-browser:dev >/dev/null
  export BROWSER_URL=http://127.0.0.1:3001 WEB_INTERNAL_URL=http://host.docker.internal:3000
  echo "== браузер печати поднят"
else
  echo "== docker не отвечает: печать PDF будет недоступна"
fi

for port in 8010 3000; do
  for pid in $(ss -ltnp 2>/dev/null | grep ":$port " | grep -o 'pid=[0-9]*' | cut -d= -f2); do kill "$pid"; done
done
sleep 2

echo "== api"
(cd api && PYTHONPATH=.. "$PY" -m app.schema ensure >>"$LOGS/api.log" 2>&1 \
  && PYTHONPATH=.. setsid "$PY" -m uvicorn app.main:app --host 127.0.0.1 --port 8010 \
       </dev/null >>"$LOGS/api.log" 2>&1 &)

echo "== фронт: сборка"
cd web
export NEXT_PUBLIC_BUILD_COMMIT="$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- .. || echo +)"
export NEXT_PUBLIC_BUILD_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
export NEXT_PUBLIC_BUILD_TIME="$(TZ=Europe/Moscow date '+%Y-%m-%d %H:%M МСК')"
npm run build >"$LOGS/build.log" 2>&1 || { tail -20 "$LOGS/build.log"; exit 1; }

# NODE_ENV=development: с secure-кукой вход по http не работает
NODE_ENV=development API_INTERNAL_URL=http://127.0.0.1:8010 \
  setsid npx next start -p 3000 </dev/null >"$LOGS/web.log" 2>&1 &

until curl -sf -o /dev/null http://127.0.0.1:3000/ && curl -sf -o /dev/null http://127.0.0.1:8010/api/health; do sleep 1; done
echo "сайт: http://127.0.0.1:3000  ·  логи: $LOGS"
