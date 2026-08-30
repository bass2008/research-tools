#!/usr/bin/env bash
# Read-only снимок prod-БД перед/после релиза. Ничего не удаляет и не блокирует платежи.
set -euo pipefail

IP="${ARCANA_PROD_IP:-84.201.157.100}"

ssh -o StrictHostKeyChecking=accept-new "ubuntu@$IP" \
  "cd /srv/arcana && docker compose exec -T api python -" <<'PY'
from __future__ import annotations

import datetime as dt
import json
import sqlite3

db = sqlite3.connect("/srv/api/var/api.db")
db.row_factory = sqlite3.Row
tables = ("users", "matrices", "payments", "entitlements", "report_jobs")
counts = {name: db.execute(f"select count(*) from {name}").fetchone()[0] for name in tables}
paid = db.execute(
    "select count(*) from payments where paid_at is not null and refunded_at is null"
).fetchone()[0]
pending = db.execute(
    "select count(*) from payments where paid_at is null and refunded_at is null "
    "and status not in ('REJECTED', 'DEADLINE_EXPIRED', 'ATTEMPTS_EXPIRED', 'AUTH_FAIL', "
    "'REVERSED', 'CANCELED', 'ABANDONED')"
).fetchone()[0]
running_reports = db.execute(
    "select count(*) from report_jobs where status in ('queued', 'running')"
).fetchone()[0]
print(json.dumps({
    "captured_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    "counts": counts,
    "successful_not_refunded": paid,
    "payments_pending": pending,
    "reports_queued_or_running": running_reports,
}, ensure_ascii=False, indent=2))
PY
