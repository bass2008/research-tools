#!/usr/bin/env bash
# Оба сайта сразу: русский на 3000, английский на 3001. Нужен, когда правка задевает обе
# языковые сборки — переключатель языка, hreflang, общие компоненты.
set -euo pipefail
cd "$(dirname "$0")/.."

export BUILD_COMMIT="$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- .. || echo +)"

# Одиночные контуры держат те же порты 3000 и 8010: без этого из общего стенда поднимется
# только английский, а русский молча останется прежним.
docker compose -p arcana down >/dev/null 2>&1 || true
docker compose -p arcana-en down >/dev/null 2>&1 || true

docker network create arcana-print >/dev/null 2>&1 || true

# -f без override: локальная надстройка описывает единственный контур и здесь только мешает.
docker compose -f docker-compose.full.yml build
docker compose -f docker-compose.full.yml up -d --wait

echo "русский:    http://127.0.0.1:3000  ·  api 8010"
echo "английский: http://127.0.0.1:3001  ·  api 8210  ·  всё бесплатно"
echo "админка /admin (snborodaenko@mail.ru / 123)  ·  платежи: mock"
echo "погасить: docker compose -f docker-compose.full.yml down"
