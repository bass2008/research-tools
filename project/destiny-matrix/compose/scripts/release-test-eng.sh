#!/usr/bin/env bash
# Совместимость со старой командой: оба домена теперь выкладываются одним релизом.
set -euo pipefail
exec "$(dirname "$0")/release-test.sh" "$@"
