#!/usr/bin/env bash
# Погасить. База в томе остаётся.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose down
