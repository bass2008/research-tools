from __future__ import annotations

import datetime as dt
import json

from sqlalchemy import (Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text, event,
                        func, text)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base
from .i18n import say, current_locale


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


class Offer(Base):
    """Цена продукта в канале продаж. Цену меняем часто, поэтому она живёт здесь, а не в коде.

    Один продукт может продаваться в разных каналах по разной цене: на сайте, на лендинге, позже в
    приложении. Канал определяет сервер, а не браузер (`offers.for_channel`).
    """

    __tablename__ = "offers"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)          # 'single' | 'month' | 'pair'
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)            # копейки
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="RUB",
                                          server_default="RUB")
    channel: Mapped[str] = mapped_column(String(32), nullable=False, default="site",
                                         server_default="site")
    # JSON-массив кодов продуктов; "*" — все продукты, включая будущие
    products: Mapped[str] = mapped_column(Text, nullable=False)
    # право привязано к одному разбору; иначе открывает любые разборы этих продуктов
    per_reading: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True,
                                              server_default=text("1"))
    store_unlimited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False,
                                                  server_default=text("0"))
    period_days: Mapped[int | None] = mapped_column(Integer)               # NULL — бессрочно
    # на витрине; скрытое предложение можно купить только по прямой ссылке
    public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True,
                                         server_default=text("1"))
    sort: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    def product_list(self) -> list[str]:
        return json.loads(self.products)

    def scopes(self) -> list[str]:
        return legacy_scope(self.per_reading, self.store_unlimited)

    def body(self) -> dict:
        """Снимок для заказа: всё, что нужно, чтобы объяснить покупку без справочника."""
        return {"id": self.id, "name": self.name, "price": self.price, "currency": self.currency,
                "channel": self.channel, "products": self.product_list(),
                "per_reading": self.per_reading, "store_unlimited": self.store_unlimited,
                "period_days": self.period_days, "scope": self.scopes()}

    def public_body(self) -> dict:
        from .offers import display_name
        return {**self.body(), "name": display_name(self.id, self.name)}


def legacy_scope(per_reading: bool, store_unlimited: bool) -> list[str]:
    """Прежние виды доступа (`single`, `matrix`, `all`) для фронта, который ещё читает их."""
    if per_reading:
        return ["single"]
    return ["single", "matrix", "all"] if store_unlimited else ["single", "all"]


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

    readings: Mapped[list["Reading"]] = relationship(back_populates="user",
                                                     cascade="all, delete-orphan")
    purchases: Mapped[list["Purchase"]] = relationship(back_populates="user",
                                                       cascade="all, delete-orphan")
    payments: Mapped[list["Payment"]] = relationship(back_populates="user",
                                                     cascade="all, delete-orphan")
    entitlements: Mapped[list["Entitlement"]] = relationship(back_populates="user",
                                                             cascade="all, delete-orphan")

    def public(self) -> dict:
        return {"id": self.id, "email": self.email, "created_at": iso(self.created_at)}


class MetrikaClient(Base):
    __tablename__ = "metrika_clients"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    counter_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    site_origin: Mapped[str] = mapped_column(String(255), nullable=False)
    first_seen_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    def item(self) -> dict:
        return {"client_id": self.client_id, "counter_id": self.counter_id,
                "site_origin": self.site_origin, "first_seen_at": iso(self.first_seen_at),
                "last_seen_at": iso(self.last_seen_at)}


def default_title(birth: dt.date) -> str:
    """Подпись сохранённой матрицы на языке контура.

    Заголовок видит человек — в кабинете и в имени скачанного PDF, — поэтому он идёт через
    словарь. Русский заголовок на английском сайте держался здесь дольше всего именно потому,
    что строка выглядела служебной.
    """
    months = say("matrix.months").split()
    return say("matrix.default_title", day=birth.day, month=months[birth.month - 1],
               year=birth.year)


class Reading(Base):
    """Разбор: продукт и введённые данные. Его хранят в кабинете, покупают и печатают.

    Номера личных разборов совпадают с номерами прежней таблицы `matrices`, поэтому старые адреса
    `/matrices/<id>` и `/report?m=<id>` и ссылки в письмах ведут туда же.
    """

    __tablename__ = "readings"
    __table_args__ = (Index("ix_readings_subject", "user_id", "product", "subject_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"),
                                         index=True, nullable=False)
    product: Mapped[str] = mapped_column(String(32), nullable=False)
    inputs: Mapped[str] = mapped_column(Text, nullable=False)              # JSON
    subject_key: Mapped[str] = mapped_column(String(200), nullable=False)
    title: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False,
                                                    default=utcnow, server_default=func.now())

    user: Mapped[User] = relationship(back_populates="readings")

    def data(self) -> dict:
        return json.loads(self.inputs)

    @property
    def birth(self) -> dt.date | None:
        value = self.data().get("birth")
        return dt.date.fromisoformat(value) if value else None

    @property
    def sex(self) -> str | None:
        return self.data().get("sex")

    def label(self) -> str:
        from . import products
        product = products.get(self.product)
        return self.title or (product.default_title(self.data()) if product else str(self.id))

    def item(self) -> dict:
        out = {"id": self.id, "product": self.product, "inputs": self.data(),
               "title": self.label(), "created_at": iso(self.created_at)}
        if self.product == "personal":
            out |= {"birth": self.data()["birth"], "sex": self.data()["sex"]}
        return out


class Purchase(Base):
    """Заказ: что купили, за сколько и где. Платёж — попытка его оплатить: карту отклонили —
    у того же заказа появляется новая попытка, а не второй заказ.

    Снимок предложения обязателен: цену меняем часто, история переписываться не должна. В снимке
    же язык, сайт и подключение оплаты — по ним письмо и досверка работают без запроса.
    """

    __tablename__ = "purchases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"),
                                         index=True, nullable=False)
    offer_id: Mapped[str] = mapped_column(String(32), nullable=False)
    offer_body: Mapped[str] = mapped_column(Text, nullable=False)          # JSON на момент покупки
    reading_id: Mapped[int | None] = mapped_column(ForeignKey("readings.id", ondelete="SET NULL"),
                                                   index=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)           # копейки
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="RUB",
                                          server_default="RUB")
    channel: Mapped[str] = mapped_column(String(32), nullable=False, default="site",
                                         server_default="site")
    # Оплата и возврат — факты заказа. Остальные состояния (новый, не прошёл, брошен) берутся
    # у последней попытки: отдельная колонка здесь разошлась бы с досверкой, которая ставит
    # попытке «брошен».
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False,
                                                    default=utcnow, server_default=func.now())
    paid_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    refunded_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="purchases")
    reading: Mapped["Reading | None"] = relationship()
    payments: Mapped[list["Payment"]] = relationship(back_populates="purchase",
                                                     cascade="all, delete-orphan",
                                                     order_by="Payment.id")

    def body(self) -> dict:
        return json.loads(self.offer_body)

    def state(self) -> str:
        if self.refunded_at is not None:
            return "refunded"
        if self.paid_at is not None:
            return "paid"
        attempt = self.last_payment()
        return attempt.state() if attempt else "new"

    def last_payment(self) -> "Payment | None":
        paid = [p for p in self.payments if p.paid_at is not None]
        return (paid or self.payments or [None])[-1]

    def item(self) -> dict:
        """Строка истории покупок. Поля платежа — от попытки, которая прошла, иначе от последней."""
        from .offers import display_name
        offer = self.body()
        if isinstance(offer.get("name"), str):
            offer["display_name"] = display_name(offer.get("id", ""), offer["name"])
        attempt = self.last_payment()
        return {"id": self.id, "amount": self.amount, "currency": self.currency, "tariff": offer,
                "reading_id": self.reading_id, "matrix_id": self.reading_id,
                "reading": self.reading.item() if self.reading else None,
                "product": (offer.get("products") or [None])[0] if offer.get("per_reading") else None,
                "external_id": attempt.external_id if attempt else None,
                "provider": attempt.provider if attempt else None,
                "status": attempt.status if attempt else "NEW", "state": self.state(),
                "created_at": iso(self.created_at), "paid_at": iso(self.paid_at),
                "refunded_at": iso(self.refunded_at)}


class Payment(Base):
    """Попытка оплатить заказ у провайдера: номер у банка, ссылка на форму, банковский статус."""

    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"),
                                         index=True, nullable=False)
    purchase_id: Mapped[int] = mapped_column(ForeignKey("purchases.id", ondelete="CASCADE"),
                                             index=True, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)            # копейки
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
    purchase: Mapped[Purchase] = relationship(back_populates="payments")

    def body(self) -> dict:
        return self.purchase.body()

    @property
    def reading_id(self) -> int | None:
        return self.purchase.reading_id

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
        from .offers import display_name
        tariff = self.body()
        if isinstance(tariff.get("name"), str):
            tariff["display_name"] = display_name(tariff.get("id", ""), tariff["name"])
        return {"id": self.id, "amount": self.amount, "tariff": tariff,
                "purchase_id": self.purchase_id,
                "reading_id": self.reading_id, "matrix_id": self.reading_id,
                "external_id": self.external_id,
                "provider": self.provider, "status": self.status, "state": self.state(),
                "created_at": iso(self.created_at), "paid_at": iso(self.paid_at),
                "refunded_at": iso(self.refunded_at)}


PAYMENT_STATES = ("new", "paid", "refunded", "failed", "abandoned")


class Entitlement(Base):
    """Право доступа. Отдельно от заказа: доступ бывает без денег (промо, компенсация),
    а заказ бывает без доступа (возврат, неоплаченная попытка)."""

    __tablename__ = "entitlements"
    # Два одновременных платежа за один разбор читали «доступа ещё нет» оба и оба его выдавали:
    # списывалось вдвое. Проверка перед записью гонку не ловит — ловит индекс. Купленное и
    # выданное — разные факты: выданное поверх покупки обязано пережить её возврат, поэтому на
    # разбор допускается одно купленное и одно выданное право.
    __table_args__ = (
        Index("ux_entitlement_active_purchase", "purchase_id", unique=True,
              sqlite_where=text("purchase_id IS NOT NULL AND revoked_at IS NULL")),
        Index("ux_entitlement_active_reading", "user_id", "reading_id", unique=True,
              sqlite_where=text("reading_id IS NOT NULL AND revoked_at IS NULL AND purchase_id IS NOT NULL")),
        Index("ux_entitlement_granted_reading", "user_id", "reading_id", unique=True,
              sqlite_where=text("reading_id IS NOT NULL AND revoked_at IS NULL AND purchase_id IS NULL")),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"),
                                         index=True, nullable=False)
    purchase_id: Mapped[int | None] = mapped_column(ForeignKey("purchases.id", ondelete="SET NULL"),
                                                    index=True)
    products: Mapped[str] = mapped_column(Text, nullable=False)              # JSON, снимок предложения
    per_reading: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True,
                                              server_default=text("1"))
    store_unlimited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False,
                                                  server_default=text("0"))
    reading_id: Mapped[int | None] = mapped_column(ForeignKey("readings.id", ondelete="CASCADE"))
    starts_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False,
                                                   default=utcnow, server_default=func.now())
    expires_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    note: Mapped[str | None] = mapped_column(String(120))                   # «промо», «компенсация»

    user: Mapped[User] = relationship(back_populates="entitlements")

    def product_list(self) -> list[str]:
        return json.loads(self.products)

    def covers(self, product: str) -> bool:
        from .products import covers
        return covers(self.product_list(), product)

    def scopes(self) -> list[str]:
        return legacy_scope(self.per_reading, self.store_unlimited)

    def active(self, now: dt.datetime | None = None) -> bool:
        now = now or utcnow()
        if self.revoked_at is not None:
            return False
        if as_utc(self.starts_at) > now:
            return False
        return self.expires_at is None or as_utc(self.expires_at) > now

    def item(self) -> dict:
        return {"id": self.id, "products": self.product_list(), "per_reading": self.per_reading,
                "store_unlimited": self.store_unlimited, "scope": self.scopes(),
                "reading_id": self.reading_id, "matrix_id": self.reading_id,
                "purchase_id": self.purchase_id,
                "starts_at": iso(self.starts_at), "expires_at": iso(self.expires_at),
                "revoked_at": iso(self.revoked_at), "note": self.note}


class ReportJob(Base):
    """Задача на печать PDF. Пользователь её не видит: для него запрос синхронный, а таблица
    нужна админу, чтобы видеть, сколько разборов печатали и сколько это заняло."""
    __tablename__ = "report_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"),
                                        index=True, nullable=False)
    reading_id: Mapped[int] = mapped_column(ForeignKey("readings.id", ondelete="CASCADE"),
                                            index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="running")
    locale: Mapped[str] = mapped_column(String(16), nullable=False, default=current_locale)
    object_key: Mapped[str | None] = mapped_column(String(300))
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    error: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False,
                                                    default=utcnow, server_default=func.now())
    started_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship()
    reading: Mapped[Reading] = relationship()

    def seconds(self) -> float | None:
        if self.started_at is None or self.finished_at is None:
            return None
        return round((as_utc(self.finished_at) - as_utc(self.started_at)).total_seconds(), 1)

    def item(self) -> dict:
        return {"id": self.id, "reading_id": self.reading_id, "matrix_id": self.reading_id,
                "status": self.status, "locale": self.locale,
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


class WorkTask(Base):
    """Задача для исполнителя (Claude Code / Codex через MCP `arcana-tasks`).

    queued → (watch выдал сигнал) signalled → done | failed. Сигнал выдаётся один раз; задача,
    которую не сдали за `task_lease_hours`, снова попадает в выдачу."""
    __tablename__ = "work_tasks"
    # Исполнитель может вернуть результат после удаления задачи: её ID нельзя выдать снова.
    __table_args__ = {"sqlite_autoincrement": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued", index=True)
    reading_id: Mapped[int | None] = mapped_column(ForeignKey("readings.id", ondelete="SET NULL"), index=True)
    reason: Mapped[str | None] = mapped_column(String(64))
    params: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    problems: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(String(500))
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False,
                                                    default=utcnow, server_default=func.now())
    signalled_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))

    def data(self) -> dict:
        return json.loads(self.params)

    def item(self) -> dict:
        return {"id": self.id, "kind": self.kind, "status": self.status, "reading_id": self.reading_id,
                "reason": self.reason, "params": self.data(), "error": self.error,
                "problems": json.loads(self.problems) if self.problems else [],
                "attempts": self.attempts, "created_at": iso(self.created_at),
                "due_at": iso(as_utc(self.created_at) + dt.timedelta(days=1)),
                "signalled_at": iso(self.signalled_at), "finished_at": iso(self.finished_at)}


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


AUDIT_ACTIONS = ("login", "register", "reset", "impersonate")
AUDIT_OUTCOMES = ("success", "failed", "throttled")
