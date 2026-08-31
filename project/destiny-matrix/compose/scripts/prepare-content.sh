#!/usr/bin/env bash
# Единая команда подготовки всех производных файлов контента перед тестами и релизом.
set -euo pipefail

cd "$(dirname "$0")/../.."

PY="${PY:-/home/sergey/miniconda3/envs/research3.12/bin/python}"

echo "Собираю базовый корпус энциклопедии"
"$PY" -m content.build

echo "Накладываю редакционные SEO-статьи"
"$PY" ../../tools/seo/build-content.py

echo "Обновляю производные SEO-реестры и аудит"
"$PY" ../../tools/seo/prepare-unified-release.py

echo "Обновляю golden-векторы и полный parity-снимок"
npm --prefix web run golden

echo "Проверяю итоговый корпус"
"$PY" ../../tools/seo/build-content.py --check
"$PY" ../../tools/seo/prepare-unified-release.py --check
"$PY" -m content.validate

echo "Контент и производные release-артефакты подготовлены"
