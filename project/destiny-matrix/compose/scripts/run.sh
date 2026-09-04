#!/usr/bin/env bash
# Собрать изменившееся и поднять.
set -euo pipefail
cd "$(dirname "$0")/.."

export BUILD_COMMIT="$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- .. || echo +)"
export BUILD_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
export BUILD_TIME="$(TZ=Europe/Moscow date '+%Y-%m-%d %H:%M МСК')"
# Та же сборка машинным форматом: из неё берётся HTTP-заголовок `Last-Modified`, а его нельзя
# занижать — после релиза любая страница могла измениться.
export BUILD_ISO="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

#export PAYMENT_PROVIDER=tbank

docker network create arcana-print >/dev/null 2>&1 || true

docker compose build
docker compose up -d --wait
# Провайдер печатаем всегда: забытая раскомментированная строка выше — это платежи в банк вместо
# мока, и заметить это по поведению сайта не сразу получается.
echo "сайт: http://127.0.0.1:3000  ·  админка /admin (snborodaenko@mail.ru / 123)  ·  платежи: ${PAYMENT_PROVIDER:-mock}"
