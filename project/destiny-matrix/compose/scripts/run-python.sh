#!/usr/bin/env bash
# Запуск без докера: uvicorn и собранный фронт на node.
set -euo pipefail
cd "$(dirname "$0")/../.."

PY="${PY:-/home/sergey/miniconda3/envs/research3.12/bin/python}"
LOGS=/tmp/arcana; mkdir -p "$LOGS"

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
