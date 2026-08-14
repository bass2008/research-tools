from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Lead
from ..schemas import LeadIn

router = APIRouter(tags=["leads"])


@router.post("/leads")
def create_lead(payload: LeadIn, db: Session = Depends(get_db)) -> dict:
    """Идемпотентно по почте: повторная отправка не плодит строк и не теряет источник."""
    lead = db.scalar(select(Lead).where(Lead.email == payload.email))
    if lead is None:
        lead = Lead(email=payload.email, source=payload.source)
        db.add(lead)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            lead = db.scalar(select(Lead).where(Lead.email == payload.email))
    elif payload.source and not lead.source:
        lead.source = payload.source
        db.commit()
    return {"ok": True}
