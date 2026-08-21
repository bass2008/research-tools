#!/usr/bin/env bash
# Снести локальную базу и завести заново: остаются админ и тарифы из сида.
set -euo pipefail
cd "$(dirname "$0")/../.."

PY="${PY:-/home/sergey/miniconda3/envs/research3.12/bin/python}"
DB=api/var/api.db
SECRETS=~/.config/arcana/smtp.env
LOGS=/tmp/arcana; mkdir -p "$LOGS"
COPY="$LOGS/api.db.$(TZ=Europe/Moscow date '+%Y%m%d-%H%M')"

if [ -f "$DB" ]; then
  # WAL: копия только через backup, файловая была бы устаревшим снимком
  "$PY" - "$DB" "$COPY" <<'PY'
import sqlite3, sys
src = sqlite3.connect(sys.argv[1])
counts = {t: src.execute(f"select count(*) from {t}").fetchone()[0]
          for t in ("users", "matrices", "payments", "entitlements")}
print("удаляю:", ", ".join(f"{k} {v}" for k, v in counts.items()))
print("пользователи:", ", ".join(r[0] for r in src.execute("select email from users")) or "нет")
dst = sqlite3.connect(sys.argv[2])
src.backup(dst)
dst.close(); src.close()
PY
  echo "копия: $COPY"
fi

alive="$(ss -ltnp 2>/dev/null | grep ':8010 ' | grep -o 'pid=[0-9]*' | cut -d= -f2 || true)"
if [ -n "$alive" ]; then
  for pid in $alive; do kill "$pid"; done
  sleep 1
fi

rm -f api/var/api.db api/var/api.db-wal api/var/api.db-shm

if [ -f "$SECRETS" ]; then set -a; . "$SECRETS"; set +a; fi
(cd api && PYTHONPATH=.. "$PY" -m app.schema ensure)

if [ -n "$alive" ]; then
  (cd api && PYTHONPATH=.. setsid nohup "$PY" -m uvicorn app.main:app \
     --host 127.0.0.1 --port 8010 >>"$LOGS/api.log" 2>&1 &)
  until curl -sf -o /dev/null http://127.0.0.1:8010/api/health; do sleep 1; done
  echo "api поднят заново на прежнем порту"
fi
