from __future__ import annotations

import datetime as dt
import json

from sqlalchemy import (Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text, event,
                        func, text)
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
    # Пульс приходит каждые 45 секунд, но это поле обновляется пакетно раз в час: иначе одна
    # открытая вкладка превращала бы SQLite WAL в непрерывный журнал служебных записей.
    last_seen_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))

    matrices: Mapped[list["SavedMatrix"]] = relationship(back_populates="user",
                                                        cascade="all, delete-orphan")
    payments: Mapped[list["Payment"]] = relationship(back_populates="user",
                                                     cascade="all, delete-orphan")
    entitlements: Mapped[list["Entitlement"]] = relationship(back_populates="user",
                                                             cascade="all, delete-orphan")

    def public(self) -> dict:
        return {"id": self.id, "email": self.email, "created_at": iso(self.created_at)}


MONTHS = ("января", "февраля", "марта", "апреля", "мая", "июня",
          "июля", "августа", "сентября", "октября", "ноября", "декабря")


def default_title(birth: dt.date) -> str:
    return f"Матрица {birth.day} {MONTHS[birth.month - 1]} {birth.year}"


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
    provider: Mapped[str] = mapped_column(String(16), nullable=False, default="mock",
                                          server_default="mock")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="NEW",
                                        server_default="NEW")
    pay_url: Mapped[str | None] = mapped_column(String(300))
    # номер заказа у провайдера: нужен, чтобы вернуть человека к уже начатому платежу, а не
    # выставлять второй счёт за ту же дату
    order_id: Mapped[str | None] = mapped_column(String(64), index=True)
    user: Mapped[User] = relationship(back_populates="payments")

    def body(self) -> dict:
        return json.loads(self.tariff_body)

    def state(self) -> str:
        """Одно состояние вместо трёх отметок. Раньше каждый экран собирал исход сам, и порядок
        проверок решал результат: страница возврата смотрела на «оплачено» раньше, чем на «возврат»,
        и поздравляла с покупкой уже возвращённого платежа. Отметка об оплате — факт истории, она
        остаётся навсегда, поэтому первым проверяется возврат."""
        if self.refunded_at is not None or self.status in ("REFUNDED", "PARTIAL_REFUNDED"):
            return "refunded"
        if self.paid_at is not None:
            return "paid"
        if self.status == "ABANDONED":
            return "abandoned"
        if self.status in ("REJECTED", "DEADLINE_EXPIRED", "ATTEMPTS_EXPIRED", "AUTH_FAIL",
                           "REVERSED", "CANCELED"):
            return "failed"
        return "new"

    def item(self) -> dict:
        return {"id": self.id, "amount": self.amount, "tariff": self.body(),
                "matrix_id": self.matrix_id, "external_id": self.external_id,
                "provider": self.provider, "status": self.status, "state": self.state(),
                "created_at": iso(self.created_at), "paid_at": iso(self.paid_at),
                "refunded_at": iso(self.refunded_at)}


PAYMENT_STATES = ("new", "paid", "refunded", "failed", "abandoned")


class Entitlement(Base):
    """Право доступа. Отдельно от платежа: доступ бывает без денег (промо, компенсация),
    а платёж бывает без доступа (возврат, неоплаченная попытка)."""

    __tablename__ = "entitlements"
    # Два одновременных платежа за одну дату читали «доступа ещё нет» оба и оба его выдавали:
    # списывалось вдвое. Проверка перед записью гонку не ловит — ловит индекс.
    __table_args__ = (
        Index("ux_entitlement_active_matrix", "user_id", "matrix_id", unique=True,
              sqlite_where=text("matrix_id IS NOT NULL AND revoked_at IS NULL")),
    )

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


class ReportJob(Base):
    """Задача на печать PDF. Пользователь её не видит: для него запрос синхронный, а таблица
    нужна админу, чтобы видеть, сколько разборов печатали и сколько это заняло."""
    __tablename__ = "report_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"),
                                        index=True, nullable=False)
    matrix_id: Mapped[int] = mapped_column(ForeignKey("matrices.id", ondelete="CASCADE"),
                                           index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="running")
    object_key: Mapped[str | None] = mapped_column(String(300))
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    error: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False,
                                                    default=utcnow, server_default=func.now())
    started_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship()
    matrix: Mapped[SavedMatrix] = relationship()

    def seconds(self) -> float | None:
        if self.started_at is None or self.finished_at is None:
            return None
        return round((as_utc(self.finished_at) - as_utc(self.started_at)).total_seconds(), 1)

    def item(self) -> dict:
        return {"id": self.id, "matrix_id": self.matrix_id, "status": self.status,
                "created_at": iso(self.created_at), "started_at": iso(self.started_at),
                "finished_at": iso(self.finished_at), "seconds": self.seconds(),
                "size_bytes": self.size_bytes, "error": self.error}


class PaymentSweep(Base):
    """Прогон досверки платежей. Задача создаётся только когда есть что опрашивать: пустые
    прогоны раз в пять минут засорили бы очередь."""
    __tablename__ = "payment_sweeps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="running")
    started_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False,
                                                    default=utcnow, server_default=func.now())
    finished_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    checked: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    changed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    log: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    error: Mapped[str | None] = mapped_column(String(300))

    def entries(self) -> list[dict]:
        return json.loads(self.log)

    def seconds(self) -> float | None:
        if self.finished_at is None:
            return None
        return round((as_utc(self.finished_at) - as_utc(self.started_at)).total_seconds(), 1)

    def item(self) -> dict:
        return {"id": self.id, "status": self.status, "checked": self.checked,
                "changed": self.changed, "seconds": self.seconds(),
                "started_at": iso(self.started_at), "finished_at": iso(self.finished_at),
                "error": self.error, "log": self.entries()}


class ErrorLog(Base):
    """Пятисотки: по ним считается тревога и видно, что именно сломалось. Тела запросов и
    персональных данных здесь нет намеренно — только метод, путь и голова трассировки."""
    __tablename__ = "error_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False,
                                            default=utcnow, server_default=func.now(), index=True)
    method: Mapped[str] = mapped_column(String(8), nullable=False)
    path: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[int] = mapped_column(Integer, nullable=False)
    message: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    trace: Mapped[str | None] = mapped_column(Text)

    def item(self) -> dict:
        return {"id": self.id, "at": iso(self.at), "method": self.method, "path": self.path,
                "status": self.status, "message": self.message, "trace": self.trace}


class SecurityAudit(Base):
    """Журнал попыток входа, регистрации и сброса пароля: успех, отказ или отсечение лимитом.
    Виден только админу. Почта тут хранится намеренно (в отличие от error_log): смысл журнала —
    видеть, какой аккаунт и с какого адреса перебирают."""
    __tablename__ = "security_audit"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False,
                                            default=utcnow, server_default=func.now(), index=True)
    action: Mapped[str] = mapped_column(String(16), nullable=False)          # login | register | reset
    outcome: Mapped[str] = mapped_column(String(16), nullable=False, index=True)  # success | failed | throttled
    email: Mapped[str | None] = mapped_column(String(320), index=True)
    ip: Mapped[str | None] = mapped_column(String(64))

    def item(self) -> dict:
        return {"id": self.id, "at": iso(self.at), "action": self.action,
                "outcome": self.outcome, "email": self.email, "ip": self.ip}


AUDIT_ACTIONS = ("login", "register", "reset")
AUDIT_OUTCOMES = ("success", "failed", "throttled")
