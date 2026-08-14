from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import create_engine, make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


def make_engine(url: str | None = None, **kwargs):
    url = url or settings.database_url
    parsed = make_url(url)
    connect_args = {}
    if parsed.get_backend_name() == "sqlite":
        connect_args["check_same_thread"] = False
        if parsed.database and parsed.database != ":memory:":
            Path(parsed.database).parent.mkdir(parents=True, exist_ok=True)
    else:
        kwargs.setdefault("pool_pre_ping", True)
    return create_engine(url, connect_args=connect_args, **kwargs)


engine = make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
