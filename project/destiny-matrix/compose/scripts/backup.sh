#!/usr/bin/env bash
# Снять копию боевой базы и положить в объектное хранилище.
set -euo pipefail
cd "$(dirname "$0")/.."

IP="${ARCANA_PROD_IP:-45.80.130.166}"
SSH_USER="${ARCANA_SSH_USER:-root}"
BUCKET=db-backups-hjb4rfs
PREFIX=destiny-matrix
CONTAINER=arcana-api-1

STAMP="$(TZ=Europe/Moscow date '+%Y%m%d-%H%M')"
NAME="api-$STAMP.db.gz"
LOCAL="$(mktemp -d)/$NAME"
trap 'rm -rf "$(dirname "$LOCAL")"' EXIT

echo "== копия на $IP"
# база в WAL: файловая копия без -wal — устаревший снимок, поэтому только sqlite backup
ssh -o StrictHostKeyChecking=accept-new "$SSH_USER@$IP" "set -e
  docker exec $CONTAINER python -c \"
import sqlite3
src = sqlite3.connect('/srv/api/var/api.db')
dst = sqlite3.connect('/tmp/dump.db')
src.backup(dst)
dst.close(); src.close()\"
  docker cp $CONTAINER:/tmp/dump.db /tmp/$STAMP.db >/dev/null
  docker exec $CONTAINER rm -f /tmp/dump.db
  gzip -f /tmp/$STAMP.db"
scp -q "$SSH_USER@$IP:/tmp/$STAMP.db.gz" "$LOCAL"
ssh "$SSH_USER@$IP" "rm -f /tmp/$STAMP.db.gz"

# копия должна открываться: битый дамп в хранилище хуже отсутствующего
gzip -t "$LOCAL"
zcat "$LOCAL" > "$LOCAL.db"
python3 - "$LOCAL.db" <<'PY'
import sqlite3, sys
db = sqlite3.connect(sys.argv[1])
assert db.execute("pragma integrity_check").fetchone()[0] == "ok", "битая копия"
counts = {t: db.execute(f"select count(*) from {t}").fetchone()[0]
          for t in ("users", "payments", "matrices", "entitlements")}
print("  проверено:", ", ".join(f"{k} {v}" for k, v in counts.items()))
PY

# Основной адресат — R2. Машина стоит на локальном NVMe, который умирает вместе с сервером,
# а копия у того же провайдера от потери провайдера не спасает.
echo "== копия в R2"
R2_ENV="${R2_ENV:-$HOME/.config/arcana/r2.env}"
test -r "$R2_ENV" || { echo "нет $R2_ENV — копию класть некуда" >&2; exit 1; }
set -a; . "$R2_ENV"; set +a
python3 scripts/r2-put.py "$LOCAL" "$PREFIX/$NAME"
echo "  $NAME  $(du -h "$LOCAL" | cut -f1)"

# Второй адресат, пока жив аккаунт Яндекса: сервер уже не там, но бакет ещё оплачен.
if command -v yc >/dev/null \
   && yc storage s3api put-object --bucket "$BUCKET" --key "$PREFIX/$NAME" --body "$LOCAL" >/dev/null 2>&1; then
    echo "== копия в s3://$BUCKET/$PREFIX/"
else
    echo "== бакет Яндекса пропущен"
fi

echo "== свежая копия в R2: $(python3 scripts/r2-last.py)"
