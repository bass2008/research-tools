#!/usr/bin/env bash
# Английская раскладка в докере: тот же состав, другой язык и витрина без оплаты.
set -euo pipefail
exec "$(dirname "$0")/run.sh" en
