from __future__ import annotations

import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import access, printing, reports
from .config import settings
from .db import SessionLocal
from .i18n import using_locale
from .models import Reading, User
from .security import create_print_token


def target(db: Session) -> Reading | None:
    for row in db.scalars(select(Reading).order_by(Reading.id.desc())):
        owner = db.get(User, row.user_id)
        if owner is not None and access.can_open(db, owner, row):
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
    with using_locale("ru"):
        url = printing.print_url(row, create_print_token(row.id, row.user_id))
    started = time.monotonic()
    pdf = reports.render(url)
    print(f"печать прогрета: разбор {row.id}, {len(pdf)} Б за {time.monotonic() - started:.1f} с")


if __name__ == "__main__":
    main()
