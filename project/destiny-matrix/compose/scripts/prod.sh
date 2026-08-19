#!/usr/bin/env bash
# Раскладка боевой машины локально: nginx впереди.
set -euo pipefail
cd "$(dirname "$0")/.."

export BUILD_COMMIT="$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- .. || echo +)"
export BUILD_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
export BUILD_TIME="$(TZ=Europe/Moscow date '+%Y-%m-%d %H:%M МСК')"

docker compose -f docker-compose.yml -f compose.prod.yml up -d --build --wait
echo "сайт через nginx: http://127.0.0.1:8080"
