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

# Ждём, пока порт реально освободится: `sleep 2` не хватало, и uvicorn падал на «address already
# in use» — скрипт при этом молча висел в ожидании здоровья, а выглядело как зависшая сборка.
for port in 8010 3000; do
  for pid in $(ss -ltnp 2>/dev/null | grep ":$port " | grep -o 'pid=[0-9]*' | cut -d= -f2); do kill "$pid"; done
done
for port in 8010 3000; do
  for _ in $(seq 1 40); do
    ss -ltn 2>/dev/null | grep -q ":$port " || break
    sleep 0.5
  done
done

echo "== api"
# setsid --fork, а не просто setsid: без форка процесс остаётся потомком скрипта, и bash в конце
# ждёт его завершения — скрипт не выходил, пока работает api, и это выглядело как зависание.
(cd api && PYTHONPATH=.. "$PY" -m app.schema ensure >>"$LOGS/api.log" 2>&1 \
  && PYTHONPATH=.. setsid --fork "$PY" -m uvicorn app.main:app --host 127.0.0.1 --port 8010 \
       </dev/null >>"$LOGS/api.log" 2>&1 &)

echo "== фронт: сборка"
cd web
export NEXT_PUBLIC_BUILD_COMMIT="$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- .. || echo +)"
export NEXT_PUBLIC_BUILD_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
export NEXT_PUBLIC_BUILD_TIME="$(TZ=Europe/Moscow date '+%Y-%m-%d %H:%M МСК')"
npm run build >"$LOGS/build.log" 2>&1 || { tail -20 "$LOGS/build.log"; exit 1; }

# NODE_ENV=development: с secure-кукой вход по http не работает
NODE_ENV=development API_INTERNAL_URL=http://127.0.0.1:8010 \
  setsid --fork npx next start -p 3000 </dev/null >"$LOGS/web.log" 2>&1 &

# Ожидание с пределом: молчаливое «висит» ничего не говорит о причине, а причина всегда в логе.
for _ in $(seq 1 90); do
  curl -sf -o /dev/null http://127.0.0.1:3000/ && curl -sf -o /dev/null http://127.0.0.1:8010/api/health && ready=1 && break
  sleep 1
done
if [ "${ready:-0}" != 1 ]; then
  echo "не поднялось за 90 с:"
  curl -sf -o /dev/null http://127.0.0.1:8010/api/health || { echo "-- api ($LOGS/api.log)"; tail -5 "$LOGS/api.log"; }
  curl -sf -o /dev/null http://127.0.0.1:3000/ || { echo "-- фронт ($LOGS/web.log)"; tail -5 "$LOGS/web.log"; }
  exit 1
fi
echo "сайт: http://127.0.0.1:3000  ·  логи: $LOGS"
