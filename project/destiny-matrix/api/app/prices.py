"""Prices that are not one offer each live in the database too: they change without a release."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Price

INDIVIDUAL = "individual"

# kopecks; existing rows are never overwritten
SEED = [
    ("individual_1", INDIVIDUAL, 199_000),          # one reading in the order
    ("individual_2", INDIVIDUAL, 299_000),          # two
    ("individual_3", INDIVIDUAL, 359_000),          # three
    ("individual_next", INDIVIDUAL, 119_000),       # each reading after the third
    ("individual_after_three", INDIVIDUAL, 119_000),  # any reading once three were bought
]


def seed(db: Session) -> None:
    for pid, kind, value in SEED:
        if db.get(Price, pid) is None:
            db.add(Price(id=pid, type=kind, value=value))
    db.commit()


def of_type(db: Session, kind: str) -> dict[str, int]:
    rows = {r.id: r.value for r in db.scalars(select(Price).where(Price.type == kind))}
    return {pid: rows.get(pid, value) for pid, k, value in SEED if k == kind} | rows
