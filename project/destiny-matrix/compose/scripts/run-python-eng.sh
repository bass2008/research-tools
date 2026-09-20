#!/usr/bin/env bash
# Английский стенд без докера: uvicorn и собранный английский фронт на node.
set -euo pipefail
exec "$(dirname "$0")/run-python.sh" en
