from __future__ import annotations

import datetime as dt
import json

from sqlalchemy import (Boolean, Date, DateTime, ForeignKey, Integer, String, Text, event, func,
                        text)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def as_utc(value: dt.datetime) -> dt.datetime:
    """sqlite отдаёт время без зоны — дописываем UTC, иначе сравнение с now() падает."""
    return value if value.tzinfo is not None else value.replace(tzinfo=dt.timezone.utc)


def iso(value: dt.datetime | None) -> str | None:
    return None if value is None else as_utc(value).isoformat()


@event.listens_for(Engine, "connect")
def _sqlite_pragmas(dbapi_connection, _record) -> None:
    """Внешние ключи в sqlite по умолчанию ВЫКЛЮЧЕНЫ, а без WAL читатель блокирует писателя.

    Без первой строки объявленный ниже ON DELETE CASCADE не работает вовсе — проверено:
    удаление пользователя оставляло его матрицы сиротами.
    """
    if type(dbapi_connection).__module__.startswith("sqlite3"):
        cur = dbapi_connection.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA busy_timeout=5000")
        cur.close()


class Tariff(Base):
    """Витрина и правила доступа. Цену меняем часто, поэтому она живёт здесь, а не в коде."""

    __tablename__ = "tariffs"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)          # 'single' | 'month'
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)            # копейки
    scope: Mapped[str] = mapped_column(Text, nullable=False)               # JSON-массив
    period_days: Mapped[int | None] = mapped_column(Integer)               # NULL — бессрочно

    def scopes(self) -> list[str]:
        return json.loads(self.scope)

    def body(self) -> dict:
        """Снимок для платежа: всё, что нужно, чтобы объяснить покупку без справочника."""
        return {"id": self.id, "name": self.name, "price": self.price,
                "scope": self.scopes(), "period_days": self.period_days}

    def public(self) -> dict:
        return self.body()


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False,
                                                    default=utcnow, server_default=func.now())

    matrices: Mapped[list["SavedMatrix"]] = relationship(back_populates="user",
                                                        cascade="all, delete-orphan")
    payments: Mapped[list["Payment"]] = relationship(back_populates="user",
                                                     cascade="all, delete-orphan")
    entitlements: Mapped[list["Entitlement"]] = relationship(back_populates="user",
                                                             cascade="all, delete-orphan")

    def public(self) -> dict:
        return {"id": self.id, "email": self.email, "created_at": iso(self.created_at)}


class SavedMatrix(Base):
    __tablename__ = "matrices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"),
                                         index=True, nullable=False)
    birth: Mapped[dt.date] = mapped_column(Date, nullable=False)
    sex: Mapped[str] = mapped_column(String(1), nullable=False)
    title: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False,
                                                    default=utcnow, server_default=func.now())

    user: Mapped[User] = relationship(back_populates="matrices")

    def item(self) -> dict:
        return {"id": self.id, "birth": self.birth.isoformat(), "sex": self.sex,
                "title": self.title, "created_at": iso(self.created_at)}


class Payment(Base):
    """Деньги. Снимок тарифа обязателен: цену меняем часто, история переписываться не должна."""

    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"),
                                         index=True, nullable=False)
    tariff_body: Mapped[str] = mapped_column(Text, nullable=False)          # JSON на момент покупки
    amount: Mapped[int] = mapped_column(Integer, nullable=False)            # уплачено, копейки
    matrix_id: Mapped[int | None] = mapped_column(ForeignKey("matrices.id", ondelete="SET NULL"))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False,
                                                    default=utcnow, server_default=func.now())
    paid_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    refunded_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    external_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)

    user: Mapped[User] = relationship(back_populates="payments")

    def body(self) -> dict:
        return json.loads(self.tariff_body)

    def item(self) -> dict:
        return {"id": self.id, "amount": self.amount, "tariff": self.body(),
                "matrix_id": self.matrix_id, "external_id": self.external_id,
                "created_at": iso(self.created_at), "paid_at": iso(self.paid_at),
                "refunded_at": iso(self.refunded_at)}


class Entitlement(Base):
    """Право доступа. Отдельно от платежа: доступ бывает без денег (промо, компенсация),
    а платёж бывает без доступа (возврат, неоплаченная попытка)."""

    __tablename__ = "entitlements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"),
                                         index=True, nullable=False)
    payment_id: Mapped[int | None] = mapped_column(ForeignKey("payments.id", ondelete="SET NULL"))
    scope: Mapped[str] = mapped_column(Text, nullable=False)                # JSON-массив
    matrix_id: Mapped[int | None] = mapped_column(ForeignKey("matrices.id", ondelete="CASCADE"))
    starts_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False,
                                                   default=utcnow, server_default=func.now())
    expires_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    note: Mapped[str | None] = mapped_column(String(120))                   # «промо», «компенсация»

    user: Mapped[User] = relationship(back_populates="entitlements")

    def scopes(self) -> list[str]:
        return json.loads(self.scope)

    def active(self, now: dt.datetime | None = None) -> bool:
        now = now or utcnow()
        if self.revoked_at is not None:
            return False
        if as_utc(self.starts_at) > now:
            return False
        return self.expires_at is None or as_utc(self.expires_at) > now

    def item(self) -> dict:
        return {"id": self.id, "scope": self.scopes(), "matrix_id": self.matrix_id,
                "starts_at": iso(self.starts_at), "expires_at": iso(self.expires_at),
                "revoked_at": iso(self.revoked_at), "note": self.note}


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    source: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False,
                                                    default=utcnow, server_default=func.now())
