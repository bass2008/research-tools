#!/usr/bin/env bash
# Локальный запуск API: api/run.sh [порт]
set -euo pipefail
cd "$(dirname "$0")"
PORT="${1:-8010}"
ENV_NAME="${CONDA_ENV:-research3.12}"
export DATABASE_URL="${DATABASE_URL:-sqlite+pysqlite:///$PWD/var/api.db}"
export PYTHONPATH="${PYTHONPATH:-$(cd .. && pwd)}"

# Схема создаётся из моделей: миграций на этапе разработки нет намеренно, таблицы можно ронять.
conda run -n "$ENV_NAME" python -m app.schema ensure
exec conda run -n "$ENV_NAME" python -m uvicorn app.main:app --host 127.0.0.1 --port "$PORT"
