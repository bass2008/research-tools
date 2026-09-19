#!/usr/bin/env bash
# Проверить, что из копии в R2 можно подняться. Целостность файла проверяет сам backup.sh, но
# «gzip не бит» и «сервис стартует на этой базе» — разные утверждения, а узнать разницу в момент
# аварии поздно.
set -euo pipefail
cd "$(dirname "$0")/.."

R2_ENV="${R2_ENV:-$HOME/.config/arcana/r2.env}"
IMAGE="${IMAGE:-arcana/api:dev}"
PORT="${PORT:-8099}"
# Каталог в домашней папке, а не в /tmp: docker на этой машине /tmp не монтирует
WORK="$(mktemp -d -p "$HOME" .arcana-restore-XXXX)"
trap 'rm -rf "$WORK"; docker rm -f arcana-restore-check >/dev/null 2>&1 || true' EXIT

[ -f "$R2_ENV" ] || { echo "нет $R2_ENV"; exit 1; }
set -a; . "$R2_ENV"; set +a

echo "== последняя копия из R2"
KEY="$(python3 scripts/r2-last.py)"
python3 scripts/r2-get.py "$KEY" "$WORK/api.db.gz"
gzip -d "$WORK/api.db.gz"

echo "== что внутри"
python3 - "$WORK/api.db" <<'PY'
import sqlite3, sys
db = sqlite3.connect(sys.argv[1])
assert db.execute("pragma integrity_check").fetchone()[0] == "ok", "битая копия"
tables = {r[0] for r in db.execute("select name from sqlite_master where type='table'")}
need = {"users", "payments", "matrices", "entitlements", "report_jobs", "tariffs"}
missing = need - tables
assert not missing, f"в копии нет таблиц: {missing}"
counts = {t: db.execute(f"select count(*) from {t}").fetchone()[0] for t in sorted(need)}
print("  ", ", ".join(f"{k} {v}" for k, v in counts.items()))
PY

echo "== поднимаем сервис на этой базе"
chmod 666 "$WORK/api.db"
docker run -d --rm --name arcana-restore-check -p "127.0.0.1:$PORT:8010" \
    -v "$WORK/api.db:/srv/api/var/api.db" \
    -e APP_ENV=dev -e JWT_SECRET=restore-check-secret-not-used-anywhere-32 \
    "$IMAGE" >/dev/null

for i in $(seq 1 30); do
    sleep 2
    ANSWER="$(curl -s --max-time 3 "http://127.0.0.1:$PORT/api/health" || true)"
    [ -n "$ANSWER" ] && break
done
echo "  /api/health: ${ANSWER:-нет ответа}"
echo "$ANSWER" | grep -q '"db":true' || { echo "сервис не поднялся на восстановленной базе"; exit 1; }

echo "== тарифы читаются из восстановленной базы"
curl -s --max-time 5 "http://127.0.0.1:$PORT/api/tariffs" | python3 -c "
import json, sys
items = json.load(sys.stdin).get('items') or []
assert items, 'справочник тарифов пуст'
print('  ', ', '.join(f\"{t['id']} {t['price'] / 100:.0f} ₽\" for t in items))"

echo "ВОССТАНОВЛЕНИЕ ПРОВЕРЕНО: $KEY"
