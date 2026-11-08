"""Авторские разборы: заявка → ревью → готовая персональная статья."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
import threading
from collections import defaultdict
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Discriminator, Field, HttpUrl, Tag
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import grants, notifications, printing, products, reports
from .config import settings
from .db import SessionLocal
from .http_errors import error
from .models import IndividualReading, User, iso, utcnow
from .security import INDIVIDUAL_LINK_TTL, create_individual_token, read_individual_token


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Heading(StrictModel):
    h3: str = Field(min_length=1, max_length=300)


class Bullets(StrictModel):
    ul: list[str] = Field(min_length=1)


class Steps(StrictModel):
    ol: list[str] = Field(min_length=1)


class TableData(StrictModel):
    head: list[str] = Field(min_length=1)
    rows: list[list[str]]


class Table(StrictModel):
    table: TableData


class ChakraFigure(StrictModel):
    chakra: Literal["muladhara", "svadhisthana", "manipura", "anahata", "vishuddha", "ajna", "sahasrara", "total"]


PointLetter = Literal["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q",
                      "R", "R1", "R2", "S", "T"]
# Points of the year matrix ("Prognostics") and of a month matrix; P1–P3 are the thirds of the year.
YearLetter = Literal["A", "B", "C", "D", "E", "F", "G", "H", "I", "P1", "P2", "P3"]
MonthLetter = Literal["A", "B", "C", "D", "E", "F", "G", "H", "I"]


class MonthPoints(StrictModel):
    n: int = Field(ge=1, le=12)
    points: list[MonthLetter] = Field(min_length=1, max_length=6)


class ArticleCard(StrictModel):
    arcanum: int = Field(ge=1, le=22)
    label: str = Field(min_length=1, max_length=150)
    caption: str = Field(min_length=1, max_length=1000)
    points: list[PointLetter] = Field(default_factory=list, max_length=6)
    year: list[YearLetter] = Field(default_factory=list, max_length=6)
    month: MonthPoints | None = None


class ArticleSource(StrictModel):
    title: str = Field(min_length=1, max_length=300)
    url: HttpUrl
    note: str = Field(min_length=1, max_length=1500)


class ArticleSection(StrictModel):
    h2: str = Field(min_length=1, max_length=300)
    paragraphs: list[str | Heading | Bullets | Steps | Table | ChakraFigure] = Field(min_length=1)
    cards: list[ArticleCard] = Field(default_factory=list, max_length=4)
    sources: list[ArticleSource] = Field(default_factory=list, max_length=8)


class ArticleV1(StrictModel):
    title: str = Field(min_length=1, max_length=300)
    lead: str = Field(min_length=1, max_length=5000)
    sections: list[ArticleSection] = Field(min_length=1, max_length=50)


class FormulaItem(StrictModel):
    arcanum: int = Field(ge=1, le=22)
    label: str = Field(min_length=1, max_length=120)
    points: list[PointLetter] = Field(default_factory=list, max_length=6)
    year: list[YearLetter] = Field(default_factory=list, max_length=6)
    month: MonthPoints | None = None


class Formula(StrictModel):
    items: list[FormulaItem | Literal["+", "=", "↔", "→"]] = Field(min_length=2, max_length=9)
    caption: str = Field(default="", max_length=1000)


class FormulaBlock(StrictModel):
    formula: Formula


class Finding(StrictModel):
    title: str = Field(min_length=1, max_length=200)
    formula: Formula | None = None
    text: list[str] = Field(min_length=1, max_length=6)
    action: str = Field(default="", max_length=800)


class FindingBlock(StrictModel):
    finding: Finding


class TimelineItem(StrictModel):
    age: str = Field(min_length=1, max_length=20)
    arcanum: int = Field(ge=1, le=22)
    title: str = Field(min_length=1, max_length=150)
    text: str = Field(min_length=1, max_length=2000)
    now: bool = False


class TimelineBlock(StrictModel):
    timeline: list[TimelineItem] = Field(min_length=1, max_length=24)


class SelfCheckItem(StrictModel):
    arcanum: int = Field(ge=1, le=22)
    label: str = Field(min_length=1, max_length=120)
    points: list[PointLetter] = Field(default_factory=list, max_length=6)
    year: list[YearLetter] = Field(default_factory=list, max_length=6)
    month: MonthPoints | None = None
    plus: list[str] = Field(min_length=1, max_length=6)
    minus: list[str] = Field(min_length=1, max_length=6)


class SelfCheckBlock(StrictModel):
    selfcheck: list[SelfCheckItem] = Field(min_length=1, max_length=12)


class InsertBlock(StrictModel):
    insert: Literal["chakras", "karmic_tail"]


ChapterKind = Literal["key", "findings", "character", "talents", "money", "relations", "family", "karma", "body",
                      "chakras", "zodiac", "close", "time", "selfcheck", "plan", "year", "quarter", "month", "other"]


class Chapter(StrictModel):
    kind: ChapterKind
    h2: str = Field(min_length=1, max_length=300)
    conclusion: str = Field(min_length=1, max_length=2000)
    cards: list[ArticleCard] = Field(default_factory=list, max_length=4)
    blocks: list[str | Heading | Bullets | Steps | Table | ChakraFigure | FormulaBlock | FindingBlock | TimelineBlock
                 | SelfCheckBlock | InsertBlock] = Field(min_length=1)
    actions: list[str] = Field(default_factory=list, max_length=8)


class Question(StrictModel):
    q: str = Field(min_length=1, max_length=300)
    a: list[str | Bullets | Steps] = Field(min_length=1, max_length=8)


class Report(StrictModel):
    version: Literal[2]
    title: str = Field(min_length=1, max_length=300)
    lead: str = Field(min_length=1, max_length=5000)
    summary: list[str] = Field(min_length=3, max_length=9)
    chapters: list[Chapter] = Field(min_length=1, max_length=30)
    faq: list[Question] = Field(default_factory=list, max_length=20)
    sources: list[ArticleSource] = Field(default_factory=list, max_length=20)


def _version(value) -> str:
    version = value.get("version") if isinstance(value, dict) else getattr(value, "version", None)
    return "v2" if version == 2 else "v1"


Article = Annotated[Union[Annotated[ArticleV1, Tag("v1")], Annotated[Report, Tag("v2")]], Discriminator(_version)]


class RequestIn(StrictModel):
    user_id: int = Field(alias="userId", gt=0)
    kind: Literal["personal", "pair"]
    product: Literal["personal", "pair"] = "personal"
    year: int | None = Field(default=None, ge=1900, le=2200)
    inputs: dict
    locale: Literal["ru", "en"] = "ru"
    comment: str = Field(default="", max_length=10000)
    automatic_reading: dict


def href(row_id: int) -> str:
    return f"/matrix/individual/{row_id}"


def inserts(snapshot: dict) -> dict:
    """Blocks of the saved automatic reading that the report shows unchanged."""
    sections = {s.get("key"): s for s in snapshot.get("sections") or [] if isinstance(s, dict)}
    out = {}
    chakras = (sections.get("chakras") or {}).get("longform")
    if isinstance(chakras, dict) and chakras.get("chakraRows"):
        out["chakras"] = chakras
    tail = sections.get("past_lives") or {}
    if isinstance(tail.get("tailReading"), dict) and tail["tailReading"].get("paragraphs"):
        out["karmic_tail"] = {"title": tail.get("title"), "paragraphs": tail["tailReading"]["paragraphs"]}
    return out


def item(row: IndividualReading, *, article: bool = False, admin: bool = False) -> dict:
    result = {"id": row.id, "product": row.product, "kind": row.kind, "year": row.year, "inputs": json.loads(row.inputs),
              "locale": row.locale, "status": row.status, "title": row.title,
              "created_at": iso(row.created_at), "approved_at": iso(row.approved_at), "href": href(row.id)}
    if article:
        result["article"] = json.loads(row.article) if row.article else None
        snapshot = json.loads(row.automatic_reading)
        result["matrix"] = snapshot.get("matrix")
        result["inserts"] = inserts(snapshot)
    if admin:
        result.update(email=row.user.email, comment=row.comment)
    return result


def get(db: Session, row_id: int) -> IndividualReading:
    row = db.get(IndividualReading, row_id)
    if not row:
        raise error(404, "Разбор не найден.", "Reading not found.")
    return row


def listing(db: Session, page: int, size: int, *, user_id: int | None = None, status: str | None = None, product: str | None = None) -> dict:
    q = select(IndividualReading)
    if user_id is not None:
        q = q.where(IndividualReading.user_id == user_id)
    if product:
        q = q.where(IndividualReading.product == product)
    if status:
        q = q.where(IndividualReading.status == status)
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = db.scalars(q.order_by(IndividualReading.id.desc()).offset((page - 1) * size).limit(size)).all()
    if user_id is None:
        return {"items": [item(row, admin=True) for row in rows], "page": page, "page_size": size, "total": total}
    # The owner sees the request at once but not the draft title: it is shown only once published.
    owned = [{**item(row), "title": row.title if row.status == "done" else None} for row in rows]
    return {"items": owned, "page": page, "page_size": size, "total": total}


def create(db: Session, payload: RequestIn) -> dict:
    user = db.get(User, payload.user_id)
    if not user:
        raise error(404, "Пользователь не найден. Сначала он должен зарегистрироваться.", "User not found. They need to register first.")
    product = payload.kind
    if payload.year is not None and product != "personal":
        raise error(422, "Разбор на год делается только по одной дате.", "A year reading is made for one date only.")
    try:
        inputs = products.PRODUCTS[product].normalize(payload.inputs)
    except ValueError as exc:
        raise error(422, str(exc), "Check the birth dates.") from None
    # The automatic reading of the same dates comes as a gift and opens at once.
    grants.grant_reading(db, user, products.PRODUCTS[product], inputs)
    user = db.get(User, payload.user_id)
    row = IndividualReading(user_id=user.id, product=product, kind=payload.kind, year=payload.year, inputs=json.dumps(inputs),
        locale=payload.locale, comment=payload.comment.strip(),
        automatic_reading=json.dumps(payload.automatic_reading, ensure_ascii=False))
    db.add(row)
    db.commit()
    return item(row, admin=True)


def submit(db: Session, row_id: int, article: Article) -> dict:
    row = get(db, row_id)
    # An approved article is fixed in place: the owner sees the new text at once, no repeat email.
    row.article = article.model_dump_json()
    row.title = article.title
    if row.status != "done":
        row.status = "review"
    db.commit()
    if row.status == "done":
        print_ahead(row)
    return item(row, article=True, admin=True)


def link_token(row_id: int, user_id: int) -> str:
    return create_individual_token("individual_reading", row_id, user_id, INDIVIDUAL_LINK_TTL)


def token_allows(token: str, row: IndividualReading) -> bool:
    return read_individual_token(token, "individual_reading") == (row.id, row.user_id) and row.status == "done"


# Bump after changing the print layout: PDFs are cached under this key and old files stay in use.
PDF_REVISION = "v12"


def print_token(row: IndividualReading) -> str:
    return create_individual_token("individual_print", row.id, row.user_id,
                                   dt.timedelta(seconds=settings.print_token_ttl_seconds))


PREVIEW_TTL = dt.timedelta(minutes=30)


def preview(db: Session, row_id: int) -> dict:
    row = get(db, row_id)
    if not row.article:
        raise error(409, "Статьи для предпросмотра ещё нет.", "There is no article to preview yet.")
    token = create_individual_token("individual_print", row.id, row.user_id, PREVIEW_TTL)
    return {"url": f"/{row.locale}/print/individual?r={row.id}&t={token}"}


def print_page(db: Session, row_id: int, token: str) -> dict:
    row = get(db, row_id)
    if read_individual_token(token, "individual_print") != (row.id, row.user_id) or not row.article:
        raise error(403, "Пропуск для печати недействителен.", "The print pass is invalid.")
    return item(row, article=True)


_print_locks: defaultdict[str, threading.Lock] = defaultdict(threading.Lock)


def pdf_key(row: IndividualReading) -> str:
    # A new article version or print layout gets a new file; the previous one is never served for it.
    return f"individual/{PDF_REVISION}/{row.id}/{row.locale}/{hashlib.sha256(row.article.encode()).hexdigest()[:16]}.pdf"


def _print_once(key: str, query: str, locale: str) -> None:
    # A click during the background print waits for that file instead of printing it again.
    with _print_locks[key]:
        if not reports.store().exists(key):
            reports.upload(key, reports.render(f"{settings.web_internal_url.rstrip('/')}/{locale}/print/individual?{query}"))


def _printed(key: str, query: str, locale: str, filename: str) -> dict:
    if not settings.pdf_enabled and not reports.store().exists(key):
        raise error(503, "Печать PDF сейчас выключена.", "PDF printing is currently off.")
    try:
        _print_once(key, query, locale)
    except Exception as exc:                       # noqa: BLE001
        raise error(502, "Не удалось напечатать PDF. Попробуйте ещё раз.", "Unable to print the PDF. Please try again.") from exc
    return {"url": reports.link(key, filename)}


def ensure_pdf(row: IndividualReading) -> str:
    key = pdf_key(row)
    _print_once(key, f"r={row.id}&t={print_token(row)}", row.locale)
    return key


def _print_ahead(row_id: int) -> None:
    with SessionLocal() as db:
        row = db.get(IndividualReading, row_id)
        if row is not None and row.status == "done" and row.article:
            ensure_pdf(row)


def print_ahead(row: IndividualReading) -> bool:
    return printing.background(("individual", row.id, pdf_key(row)), _print_ahead, row.id)


def pdf(db: Session, row_id: int, user: User) -> dict:
    row = get(db, row_id)
    admin = settings.is_admin(user.email)
    if user.id != row.user_id and not admin:
        raise error(403, "Разбор доступен только владельцу.", "The reading is available only to its owner.")
    # The owner gets the PDF of the published article; the admin may print a draft on demand.
    if not row.article or (row.status != "done" and not admin):
        raise error(409, "PDF появится после публикации статьи.", "The PDF is available once the article is published.")
    return _printed(pdf_key(row), f"r={row.id}&t={print_token(row)}", row.locale,
                    f"{(row.title or 'Individual reading').replace('/', '-')}.pdf")


EXAMPLE_NAMES = {"personal": ("личный разбор", "personal reading"), "pair": ("совместимость пары", "couple compatibility"),
                 "year": ("разбор года", "year reading")}


def example_pdf(slug: str, locale: str) -> dict:
    if slug not in EXAMPLE_NAMES:
        raise error(404, "Такого примера нет.", "There is no such example.")
    # The examples ship with the web build, so a release is their version: at most one print per example and language.
    build = re.sub(r"[^\w.-]", "_", settings.build_commit) or "dev"
    ru, en = EXAMPLE_NAMES[slug]
    return _printed(f"individual-example/{PDF_REVISION}/{build}/{slug}/{locale}.pdf", f"example={slug}", locale,
                    f"Пример разбора — {ru}.pdf" if locale == "ru" else f"Sample reading — {en}.pdf")


def open_article(db: Session, row_id: int, user: User | None, token: str) -> dict:
    row = get(db, row_id)
    own = user is not None and (user.id == row.user_id or settings.is_admin(user.email))
    if not own and not token_allows(token, row):
        raise error(403, "Войдите в аккаунт владельца или откройте действующую ссылку из письма.",
                    "Sign in as the owner or use a valid link from your email.")
    if not row.article:
        raise error(404, "Статья ещё не готова.", "The article is not ready yet.")
    return {**item(row, article=True), "can_pdf": own and row.status == "done"}


def approve(db: Session, row_id: int) -> dict:
    row = get(db, row_id)
    if row.status == "done":
        return {**item(row), "already_approved": True}
    if row.status != "review" or not row.article:
        raise error(409, "Сначала добавьте статью для ревью.", "Submit an article for review first.")
    row.status = "done"
    row.approved_at = utcnow()
    ids = notifications.emit(db, "individual_reading_ready", f"individual:{row.id}",
        {"individual_id": row.id, "locale": row.locale}, [row.user_id])
    db.commit()
    print_ahead(row)
    failed = notifications.deliver_emails(db, ids)
    return {**item(row), "email_errors": failed}
