#!/usr/bin/env bash
# Юнит-тесты языка, который собираемся выкладывать.
#
# Тесты параметризованы языком: `NEXT_PUBLIC_SITE_LANG` подставляет корпус, словари и подписи.
# Зелёный русский прогон ничего не говорит об английской сборке — и наоборот. Пока это не
# проверялось, английский контур выкладывался с полутора сотнями красных тестов, а гейт считал
# себя пройденным, потому что гонял русские.
#
#   scripts/assert-unit-tests.sh ru
#   scripts/assert-unit-tests.sh en
set -euo pipefail
cd "$(dirname "$0")/../.."

LANG_CODE="${1:?язык обязателен: ru или en}"
case "$LANG_CODE" in
  ru|en) ;;
  *) echo "неизвестный язык: $LANG_CODE" >&2; exit 2 ;;
esac

echo "== юнит-тесты сборки ($LANG_CODE)"
if ! NEXT_PUBLIC_SITE_LANG="$LANG_CODE" npm --prefix web test -- --run; then
  echo "выкладка запрещена: юнит-тесты языка $LANG_CODE красные" >&2
  exit 1
fi
if ! npm --prefix web run typecheck; then
  echo "выкладка запрещена: typecheck не проходит" >&2
  exit 1
fi
