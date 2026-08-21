#!/usr/bin/env bash
# Снять копию боевой базы и положить в Object Storage.
set -euo pipefail
cd "$(dirname "$0")/.."

IP=84.201.157.100
BUCKET=db-backups-hjb4rfs
PREFIX=destiny-matrix
CONTAINER=arcana-api-1

STAMP="$(TZ=Europe/Moscow date '+%Y%m%d-%H%M')"
NAME="api-$STAMP.db.gz"
LOCAL="$(mktemp -d)/$NAME"
trap 'rm -rf "$(dirname "$LOCAL")"' EXIT

echo "== копия на $IP"
# база в WAL: файловая копия без -wal — устаревший снимок, поэтому только sqlite backup
ssh -o StrictHostKeyChecking=accept-new "ubuntu@$IP" "set -e
  sudo docker exec $CONTAINER python -c \"
import sqlite3
src = sqlite3.connect('/srv/api/var/api.db')
dst = sqlite3.connect('/tmp/dump.db')
src.backup(dst)
dst.close(); src.close()\"
  sudo docker cp $CONTAINER:/tmp/dump.db /tmp/$STAMP.db >/dev/null
  sudo docker exec $CONTAINER rm -f /tmp/dump.db
  sudo gzip -f /tmp/$STAMP.db
  sudo chown ubuntu /tmp/$STAMP.db.gz"
scp -q "ubuntu@$IP:/tmp/$STAMP.db.gz" "$LOCAL"
ssh "ubuntu@$IP" "rm -f /tmp/$STAMP.db.gz"

# копия должна открываться: битый дамп в бакете хуже отсутствующего
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

echo "== в бакет s3://$BUCKET/$PREFIX/"
yc storage s3api put-object --bucket "$BUCKET" --key "$PREFIX/$NAME" --body "$LOCAL" >/dev/null
echo "  $NAME  $(du -h "$LOCAL" | cut -f1)"

echo "== последние копии"
yc storage s3api list-objects --bucket "$BUCKET" --prefix "$PREFIX/" --format json \
  | python3 -c "
import json, sys
items = json.load(sys.stdin).get('contents') or []
for o in sorted(items, key=lambda o: o['key'])[-5:]:
    print(f\"  {o['key']}  {int(o['size']):>8} Б  {o['last_modified']}\")
print(f'  всего копий: {len(items)}')"
