#!/usr/bin/env bash
# Единая команда подготовки всех производных файлов контента перед тестами и релизом.
# Язык — первым аргументом: `prepare-content.sh ru`, `prepare-content.sh en`.
set -euo pipefail

cd "$(dirname "$0")/../.."

LANG_CODE="${1:-ru}"
case "$LANG_CODE" in
  ru|en) ;;
  *) echo "неизвестный язык: $LANG_CODE (ожидается ru или en)"; exit 1 ;;
esac

PY="${PY:-/home/sergey/miniconda3/envs/research3.12/bin/python}"

echo "Собираю базовый корпус энциклопедии [$LANG_CODE]"
"$PY" -m content.build --lang "$LANG_CODE"

echo "Обновляю публичный каталог разделов [$LANG_CODE]"
PYTHONPATH=.. "$PY" web/scripts/make-catalog.py --lang "$LANG_CODE"

echo "Накладываю редакционные SEO-статьи [$LANG_CODE]"
"$PY" ../../tools/seo/build-content.py --lang "$LANG_CODE"

if [ "$LANG_CODE" = "ru" ]; then
  # Реестры спроса и карточки аудита построены по русскому Вордстату: у английского поля
  # своего замера ещё нет (docs/semcore.md, «Английские формулировки»), и выдумывать его нельзя.
  echo "Обновляю производные SEO-реестры и аудит"
  "$PY" ../../tools/seo/prepare-unified-release.py
fi

echo "Обновляю golden-векторы и полный parity-снимок"
npm --prefix web run golden

echo "Проверяю итоговый корпус [$LANG_CODE]"
"$PY" ../../tools/seo/build-content.py --lang "$LANG_CODE" --check
if [ "$LANG_CODE" = "ru" ]; then
  "$PY" ../../tools/seo/prepare-unified-release.py --check
fi
ENCYCLOPEDIA_LANG="$LANG_CODE" "$PY" -m content.validate

echo "Контент и производные release-артефакты подготовлены [$LANG_CODE]"
