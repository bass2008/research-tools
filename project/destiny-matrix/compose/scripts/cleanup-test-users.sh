#!/usr/bin/env bash
# Убрать с прода тестовые аккаунты прогонов. По умолчанию только показывает, что удалит;
# удаление — APPLY=1. Живые покупатели под маску не попадают: она про адреса прогонов.
set -euo pipefail

IP=84.201.157.100
APPLY="${APPLY:-0}"

# python едет на машину по stdin: так не приходится экранировать кавычки в ssh-команде
ssh -o StrictHostKeyChecking=accept-new "ubuntu@$IP" \
  "cd /srv/arcana && docker compose exec -T -e APPLY='$APPLY' api python -" <<'PY'
import os, sqlite3

MASKS = ("night-%@example.ru", "warm-%@example.ru", "prod-%@example.ru", "tls-%@example.ru",
         "s11-%@example.ru", "e2e-%@example.ru", "acq-test%@arcana-sense.ru")
apply = os.environ.get("APPLY") == "1"
db = sqlite3.connect("/srv/api/var/api.db")

ids = sorted({r[0] for mask in MASKS
              for r in db.execute("select id from users where email like ?", (mask,))})
print("аккаунтов под маску:", len(ids), "| всего в базе:",
      db.execute("select count(*) from users").fetchone()[0])
if not ids:
    raise SystemExit(0)

holes = ",".join("?" * len(ids))
for table in ("payments", "entitlements", "matrices", "report_jobs"):
    count = db.execute(f"select count(*) from {table} where user_id in ({holes})", ids).fetchone()[0]
    print(f"  {table}: {count}")

if not apply:
    print("сухой прогон. Удалить: APPLY=1 scripts/cleanup-test-users.sh")
    raise SystemExit(0)

db.execute("pragma foreign_keys = on")
for table in ("report_jobs", "entitlements", "payments", "matrices"):
    db.execute(f"delete from {table} where user_id in ({holes})", ids)
db.execute(f"delete from users where id in ({holes})", ids)
db.commit()
print("удалено аккаунтов:", len(ids), "| осталось:",
      db.execute("select count(*) from users").fetchone()[0])
PY
