import json
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import individual_readings as service
from ..db import get_db
from ..deps import current_user, optional_user
from ..models import User
from .admin import admin_user
from ..i18n import current_locale
from ..security import read_worker_token

def article_author(x_internal_token: str | None = Header(default=None)) -> None:
    if not read_worker_token(x_internal_token):
        raise HTTPException(401, "неверный или отсутствующий X-Internal-Token")


router = APIRouter(tags=["individual-readings"])


def private_response(response: Response):
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Robots-Tag"] = "noindex, nofollow, noarchive"


@router.get("/individual-readings", dependencies=[Depends(private_response)])
def mine(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
         product: Literal["personal", "pair"] | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return service.listing(db, page, page_size, user_id=user.id, product=product)


class OpenIn(BaseModel):
    token: str = ""


@router.post("/individual-readings/{row_id}/open", dependencies=[Depends(private_response)])
def open_article(row_id: int, payload: OpenIn, user: User | None = Depends(optional_user),
                 db: Session = Depends(get_db)):
    return service.open_article(db, row_id, user, payload.token)


@router.post("/individual-examples/{slug}/pdf", dependencies=[Depends(private_response)])
def example_pdf(slug: str):
    return service.example_pdf(slug, current_locale())


@router.post("/individual-readings/{row_id}/pdf", dependencies=[Depends(private_response)])
def pdf(row_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return service.pdf(db, row_id, user)


@router.get("/individual-readings/{row_id}/print", dependencies=[Depends(private_response)])
def print_page(row_id: int, t: str = Query(..., min_length=16), db: Session = Depends(get_db)):
    return service.print_page(db, row_id, t)


@router.get("/admin/individual-readings", dependencies=[Depends(admin_user)])
@router.get("/internal/individual-readings", dependencies=[Depends(article_author)])
def listing(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
            status: Literal["pending", "review", "done"] | None = None,
            db: Session = Depends(get_db)):
    return service.listing(db, page, page_size, status=status)


@router.post("/admin/individual-readings", dependencies=[Depends(admin_user)])
def create(payload: service.RequestIn, db: Session = Depends(get_db)):
    return service.create(db, payload)


@router.get("/admin/individual-readings/{row_id}", dependencies=[Depends(admin_user)])
@router.get("/internal/individual-readings/{row_id}", dependencies=[Depends(article_author)])
def brief(row_id: int, db: Session = Depends(get_db)):
    row = service.get(db, row_id)
    result = {
        "id": row.id,
        "status": row.status,
        "kind": row.kind,
        "year": row.year,
        "locale": row.locale,
        "inputs": json.loads(row.inputs),
        "comment": row.comment,
        "created_at": service.iso(row.created_at),
        "automatic_reading": json.loads(row.automatic_reading),
        "prompt": ".agents/skills/arcana-product-skill/prompts/individual-reading-prompt.md",
    }
    if row.article:
        result["article"] = json.loads(row.article)
    return result


@router.get("/admin/individual-readings/{row_id}/preview", dependencies=[Depends(admin_user), Depends(private_response)])
def preview(row_id: int, db: Session = Depends(get_db)):
    return service.preview(db, row_id)


@router.post("/admin/individual-readings/{row_id}/article", dependencies=[Depends(admin_user)])
@router.post("/internal/individual-readings/{row_id}/article", dependencies=[Depends(article_author)])
def submit(row_id: int, payload: service.Article, db: Session = Depends(get_db)):
    return service.submit(db, row_id, payload)


@router.post("/admin/individual-readings/{row_id}/approve", dependencies=[Depends(admin_user)])
def approve(row_id: int, db: Session = Depends(get_db)):
    return service.approve(db, row_id)
