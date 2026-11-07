from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import access, readings
from .. import individual_readings as individual
from ..db import get_db
from ..deps import current_user
from ..http_errors import error
from ..models import IndividualReading, Reading, User
from ..security import create_share_token, read_share_token
from .individual_readings import private_response

router = APIRouter(tags=["shares"])


@router.post("/readings/{reading_id}/share", dependencies=[Depends(private_response)])
def share_reading(reading_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    row = readings.own(db, user, reading_id)
    return {"token": create_share_token("reading", row.id, user.id)}


@router.post("/individual-readings/{row_id}/share", dependencies=[Depends(private_response)])
def share_individual(row_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    row = individual.get(db, row_id)
    if row.user_id != user.id:
        raise error(403, "Разбор доступен только владельцу.", "The reading is available only to its owner.")
    if row.status != "done" or not row.article:
        raise error(409, "Поделиться можно готовым разбором.", "Only a finished reading can be shared.")
    return {"token": create_share_token("individual", row.id, user.id)}


@router.get("/shared/{token}", dependencies=[Depends(private_response)])
def shared(token: str, db: Session = Depends(get_db)) -> dict:
    kind, row_id, user_id = read_share_token(token) or ("", 0, 0)
    if kind == "reading":
        row, user = db.get(Reading, row_id), db.get(User, user_id)
        if row and user and row.user_id == user.id and row.removed_at is None:
            # the link shows what its owner sees: the paid sections open only if the owner can open them
            rights = access.active_rights(db, user)
            return {**row.item(), "shared": "reading", "unlocked": access.can_open(db, user, row, rights=rights),
                    "plan": access.plan_label(db, rights, row)}
    if kind == "individual":
        row = db.get(IndividualReading, row_id)
        if row and row.user_id == user_id and row.status == "done" and row.article:
            return {**individual.item(row, article=True), "shared": "individual"}
    raise error(404, "Ссылка недействительна или разбор удалён.", "The link is invalid or the reading was removed.")
