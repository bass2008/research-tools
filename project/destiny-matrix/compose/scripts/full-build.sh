#!/usr/bin/env bash
# Пересобрать всё с нуля и поднять: свежие базовые образы, зависимости заново.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose build --no-cache --pull
exec "$(dirname "$0")/run.sh"
