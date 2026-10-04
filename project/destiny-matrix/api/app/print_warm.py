from __future__ import annotations

import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import access, reports
from .config import settings
from .db import SessionLocal
from .models import SavedMatrix, User
from .security import create_print_token


def target(db: Session) -> SavedMatrix | None:
    for row in db.scalars(select(SavedMatrix).order_by(SavedMatrix.id.desc())):
        owner = db.get(User, row.user_id)
        if owner is not None and access.unlocked_matrix(db, owner, row.id):
            return row
    return None


def main() -> None:
    # Chromium starts on the first print after deploy; a throwaway print keeps that off the buyer.
    # Nothing is stored: no report job, no file.
    if not settings.pdf_enabled:
        print("печать выключена: прогревать нечего")
        return
    with SessionLocal() as db:
        row = target(db)
    if row is None:
        print("открытых разборов нет: прогревать нечем")
        return
    token = create_print_token(row.id, row.user_id)
    url = f"{settings.web_internal_url.rstrip('/')}/print/report?m={row.id}&t={token}&lang=ru"
    started = time.monotonic()
    pdf = reports.render(url)
    print(f"печать прогрета: матрица {row.id}, {len(pdf)} Б за {time.monotonic() - started:.1f} с")


if __name__ == "__main__":
    main()
