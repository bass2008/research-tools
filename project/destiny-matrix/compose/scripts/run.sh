#!/usr/bin/env bash
# Собрать изменившееся и поднять.
set -euo pipefail
cd "$(dirname "$0")/.."

export BUILD_COMMIT="$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- .. || echo +)"
export BUILD_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
export BUILD_TIME="$(TZ=Europe/Moscow date '+%Y-%m-%d %H:%M МСК')"

# сеть печати общая для прода и тестового контура: создаём, если её ещё нет
docker network create arcana-print >/dev/null 2>&1 || true

docker compose build
docker compose up -d --wait
echo "сайт: http://127.0.0.1:3000  ·  админка /admin (snborodaenko@mail.ru / 123)"
