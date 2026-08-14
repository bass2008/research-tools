from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import access
from ..db import get_db
from ..deps import optional_user
from ..models import User
from ..report import build_report
from ..schemas import BirthIn

router = APIRouter(tags=["matrix"])


@router.post("/matrix/calc")
def calc(payload: BirthIn, user: User | None = Depends(optional_user),
         db: Session = Depends(get_db)) -> dict:
    """Расчёт без сохранения. Дата рождения нигде не логируется и не уходит в аналитику."""
    # ALL открывает любую дату сразу; разовое право живёт на конкретной матрице,
    # поэтому здесь, без сохранения, оно не применяется
    unlocked = access.ALL in access.scopes(db, user)
    try:
        return build_report(payload.birth, payload.sex, unlocked=unlocked)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
