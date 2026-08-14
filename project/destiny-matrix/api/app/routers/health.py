from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..db import get_db

router = APIRouter(tags=["service"])


@router.get("/health")
def health(db: Session = Depends(get_db)) -> dict:
    try:
        db.execute(text("select 1"))
        alive = True
    except Exception:
        alive = False
        try:
            db.rollback()
        except Exception:
            pass
    return {"ok": True, "db": alive}
