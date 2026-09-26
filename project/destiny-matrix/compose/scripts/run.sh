#!/usr/bin/env bash
# Собрать общее приложение. Старые аргументы ru/en оставлены как алиасы того же запуска.
set -euo pipefail
cd "$(dirname "$0")/.."

case "${1:-}" in
  ""|ru|en) ;;
  *) echo "использование: run.sh [ru|en]; оба домена запускаются вместе"; exit 1 ;;
esac

export BUILD_COMMIT="$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- .. || echo +)"
export BUILD_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
export BUILD_TIME="$(TZ=Europe/Moscow date '+%Y-%m-%d %H:%M МСК')"
# Та же метка машинным форматом. Заголовок `Last-Modified` сайт больше не отдаёт (Decision 8),
# метка осталась только для админской таблицы настроек.
export BUILD_ISO="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

# Домен выбирает язык и платежи. Аргумент en больше не создаёт второй проект/БД.
export SITE_LANG=ru ALL_FREE_WITHOUT_PAYMENT="${ALL_FREE_WITHOUT_PAYMENT:-0}"

docker network create arcana-print >/dev/null 2>&1 || true

docker compose build
# Удаляются только старые сервисы этого проекта: после переименования они иначе занимают порты.
docker compose up -d --wait --remove-orphans
# Способы оплаты зависят от профиля, а не языка интерфейса.
echo "сайт: http://127.0.0.1:${WEB_PORT:-3000}  (COM) / http://localhost:${WEB_PORT:-3000} (RU)  ·  всё бесплатно: ${ALL_FREE_WITHOUT_PAYMENT}"
echo "админка /admin (snborodaenko@mail.ru / 123)  ·  платежи RU: ${PAYMENT_PROVIDER:-mock}; COM: недоступны"
