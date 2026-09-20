#!/usr/bin/env bash
# Собрать изменившееся и поднять. Язык развёртки — первым аргументом: `run.sh ru`, `run.sh en`.
set -euo pipefail
cd "$(dirname "$0")/.."

LANG_CODE="${1:-${SITE_LANG:-ru}}"
case "$LANG_CODE" in
  ru|en) ;;
  *) echo "неизвестный язык: $LANG_CODE (ожидается ru или en)"; exit 1 ;;
esac

export BUILD_COMMIT="$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- .. || echo +)"
export BUILD_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
export BUILD_TIME="$(TZ=Europe/Moscow date '+%Y-%m-%d %H:%M МСК')"
# Та же метка машинным форматом. Заголовок `Last-Modified` сайт больше не отдаёт (Decision 8),
# метка осталась только для админской таблицы настроек.
export BUILD_ISO="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

# Язык развёртки и витрина без оплаты: у английского контура кассы ещё нет (foreign-acquiring.md),
# поэтому там разбор открыт всем. Обе переменные читают и api, и сборка фронта.
export SITE_LANG="$LANG_CODE"
if [ "$LANG_CODE" = "en" ]; then
  export ALL_FREE_WITHOUT_PAYMENT="${ALL_FREE_WITHOUT_PAYMENT:-1}"
  export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-arcana-en}"
  export WEB_PORT="${WEB_PORT:-3200}"
  export API_PORT="${API_PORT:-8210}"
  export SITE_URL="${SITE_URL:-http://127.0.0.1:${WEB_PORT}}"
else
  export ALL_FREE_WITHOUT_PAYMENT="${ALL_FREE_WITHOUT_PAYMENT:-0}"
fi

#export PAYMENT_PROVIDER=tbank

docker network create arcana-print >/dev/null 2>&1 || true

docker compose build
docker compose up -d --wait
# Провайдер печатаем всегда: забытая раскомментированная строка выше — это платежи в банк вместо
# мока, и заметить это по поведению сайта не сразу получается.
echo "сайт: http://127.0.0.1:${WEB_PORT:-3000}  ·  язык: ${SITE_LANG}  ·  всё бесплатно: ${ALL_FREE_WITHOUT_PAYMENT}"
echo "админка /admin (snborodaenko@mail.ru / 123)  ·  платежи: ${PAYMENT_PROVIDER:-mock}"
