#!/usr/bin/env bash
# Совместимость: один фронтенд/API/БД для RU и COM.
set -euo pipefail
exec "$(dirname "$0")/run.sh" "$@"
