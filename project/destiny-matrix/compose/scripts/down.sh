#!/usr/bin/env bash
# Погасить. База в томе остаётся.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose -f docker-compose.yml -f compose.prod.yml down
