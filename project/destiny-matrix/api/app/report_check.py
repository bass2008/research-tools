from __future__ import annotations

import argparse
import sys
import time
import urllib.request
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .db import SessionLocal
from .models import ReportJob
from .printing import PDF_REVISION
from .store import S3Store


def done_jobs(db: Session) -> list[ReportJob]:
    return list(db.scalars(select(ReportJob).where(ReportJob.status == "done",
                                                   ReportJob.object_key.is_not(None))
                           .order_by(ReportJob.id)))


def gone(job: ReportJob) -> bool:
    # A wiped local file has nothing to reprint from: the test contour prints only on demand.
    return settings.reports_store == "local" and not (Path(settings.reports_dir) / job.object_key).is_file()


def head(key: str) -> bytes | None:
    # Local storage is read directly: LocalStore() wipes its directory on creation, and the API
    # does the same on start, so a missing local file is expected (None), not broken.
    if settings.reports_store == "local":
        path = Path(settings.reports_dir) / key
        if not path.is_file():
            return None
        with path.open("rb") as file:
            return file.read(8)
    # The same signed link the buyer gets; a Range request proves the download without pulling MBs.
    request = urllib.request.Request(S3Store().link(key), headers={"Range": "bytes=0-7"})
    with urllib.request.urlopen(request, timeout=30) as answer:
        return answer.read(8)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wait", type=int, default=0, help="сколько секунд ждать перепечатку")
    args = parser.parse_args()
    deadline = time.monotonic() + args.wait
    while True:
        with SessionLocal() as db:
            jobs = done_jobs(db)
        stale = [j for j in jobs if not j.object_key.startswith(f"{PDF_REVISION}/") and not gone(j)]
        if not stale or time.monotonic() >= deadline:
            break
        print(f"ждём перепечатку: старых PDF {len(stale)}", flush=True)
        time.sleep(10)

    broken, wiped = [], 0
    for job in jobs:
        if job in stale:
            continue
        try:
            start = head(job.object_key)
        except Exception as exc:                   # noqa: BLE001
            start = b""
            print(f"  задача {job.id}: {exc}")
        if start is None:
            wiped += 1
        elif not start.startswith(b"%PDF"):
            broken.append(job)
    print(f"PDF ревизии {PDF_REVISION}: готовых {len(jobs)}, старых {len(stale)}, "
          f"не скачиваются {len(broken)}" + (f", стёрты при перезапуске {wiped}" if wiped else ""))
    for job in stale:
        print(f"  старый: задача {job.id}, матрица {job.matrix_id}, {job.locale}, {job.object_key}")
    for job in broken:
        print(f"  не скачивается: задача {job.id}, матрица {job.matrix_id}, {job.object_key}")
    return 1 if stale or broken else 0


if __name__ == "__main__":
    sys.exit(main())
