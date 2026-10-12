"""Доступ считается по правам, а не по «тарифу пользователя».

Право покрывает набор продуктов (`*` — все, включая будущие) и либо привязано к одному разбору,
либо открывает любые разборы этих продуктов — так устроена подписка. Источник истины — записи в
entitlements; продукт ни в одной проверке здесь не назван по имени.
"""
from __future__ import annotations

import datetime as dt
import json

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import settings
from .models import Entitlement, Purchase, Reading, User, iso, utcnow
from .products import PERSONAL, PRODUCTS


def active_rights(db: Session, user: User | None,
                  now: dt.datetime | None = None) -> list[Entitlement]:
    if user is None:
        return []
    now = now or utcnow()
    rows = db.scalars(select(Entitlement).where(Entitlement.user_id == user.id)).all()
    return [r for r in rows if r.active(now)]


def opens(right: Entitlement, reading: Reading) -> bool:
    """Открывает ли право этот разбор. Разовое право без разбора не открывает ничего, пока его
    не привяжут (`bind_unbound`): иначе оно работало бы как подписка."""
    if not right.covers(reading.product):
        return False
    if right.per_reading:
        return right.reading_id == reading.id
    return right.reading_id is None or right.reading_id == reading.id


def held(rights: list[Entitlement], products: list[str], reading: Reading | None = None, *,
         forever: bool = False) -> list[Entitlement]:
    """Действующие права, которые уже дают все `products`: на разбор `reading` или, без него, на
    любой разбор (подписка). С `forever` — только бессрочные.

    Единственное место, где решается «такое право уже есть». Открытие разбора, продажа и выдача
    админом задают один вопрос с разной строгостью; когда каждый отвечал на него сам, продажа
    пропускала вторую подписку, а выдача подписчику держалась на подписке."""
    return [r for r in rights
            if all(r.covers(p) for p in products)
            and (opens(r, reading) if reading is not None else not r.per_reading)
            and (not forever or r.expires_at is None)]


def granted(rights: list[Entitlement]) -> list[Entitlement]:
    """Права без заказа: выдал админ, промо, компенсация."""
    return [r for r in rights if r.purchase_id is None]


def covering(rights: list[Entitlement], offer: dict, reading: Reading | None = None, *,
             forever: bool = False) -> list[Entitlement]:
    """Права, при которых новое право по предложению `offer` ничего не добавит.

    Продажа отказывает, пока открыто сейчас: подписчику ничего не продаём. Выдача админом
    передаёт только выданные права (`granted`) и для разбора — `forever`: выданное переживает и
    подписку, и возврат покупки."""
    if offer["per_reading"]:
        return held(rights, [reading.product], reading, forever=forever) if reading is not None else []
    return held(rights, offer["products"], forever=forever)


def can_open(db: Session, user: User | None, reading: Reading | None,
             now: dt.datetime | None = None,
             rights: list[Entitlement] | None = None) -> bool:
    """Открыт ли полный разбор.

    Витрина без оплаты открывает всё сразу — прав для этого не заводим: флаг снимается,
    и доступ возвращается к оплаченному, а раздача прав осталась бы навсегда.
    """
    if settings.all_free_without_payment:
        return True
    if reading is None or user is None or reading.user_id != user.id:
        return False
    rights = active_rights(db, user, now) if rights is None else rights
    return bool(held(rights, [reading.product], reading))


def unlocked(db: Session, user: User | None, reading_id: int | None,
             now: dt.datetime | None = None) -> bool:
    if settings.all_free_without_payment:
        return True
    reading = db.get(Reading, reading_id) if reading_id is not None else None
    return can_open(db, user, reading, now)


def can_open_unsaved(db: Session, user: User | None, product: str,
                     now: dt.datetime | None = None) -> bool:
    """Расчёт без сохранения: открывает только право без привязки к разбору, то есть подписка.
    Разовому праву не к чему привязаться."""
    if settings.all_free_without_payment:
        return True
    return bool(held(active_rights(db, user, now), [product]))


def reading_state(rights: list[Entitlement], reading: Reading) -> dict:
    """Как открыт разбор — для списка в кабинете.

    `open` — витрина без оплаты: открыт всем, пока включён флаг, и владением не является.
    `forever` — куплен бессрочным правом и останется; `granted` — открыт тем же бессрочным
    правом, но выданным без денег (админ, промо, компенсация); `subscription` — открыт, пока
    действует срочное право (с датой окончания); `locked` — закрыт, разбор можно выкупить.

    Купленное и выданное разделены намеренно: в кабинете «Куплена» — знак владения со своей
    отметкой, и выдавать её за подарок нельзя. Права передаются списком, а не считаются заново на
    каждую строку: иначе список кабинета — запрос на разбор.
    """
    if settings.all_free_without_payment:
        return {"access": "open", "access_until": None, "access_granted": False}
    ends: list[dt.datetime] = []
    granted = False
    bought_subscription = False
    for right in rights:
        if not opens(right, reading):
            continue
        if right.expires_at is None:
            if right.purchase_id is not None:
                return {"access": "forever", "access_until": None, "access_granted": False}
            granted = True
            continue
        ends.append(right.expires_at)
        bought_subscription = bought_subscription or right.purchase_id is not None
    if granted:
        return {"access": "granted", "access_until": None, "access_granted": True}
    if ends:
        # выданная подписка подписывается выданной везде: в бейдже, шапке разбора и PDF
        return {"access": "subscription", "access_until": iso(max(ends)),
                "access_granted": not bought_subscription}
    return {"access": "locked", "access_until": None, "access_granted": False}


def bind_unbound(db: Session, user: User, reading: Reading,
                 now: dt.datetime | None = None) -> bool:
    """Привязать разовое право без разбора к этому разбору.

    Новые заказы всегда указывают разбор, так что таких прав больше не появляется. Функция лечит
    права, купленные до этого правила: оплаченным становится первый разбор, к которому их применили.
    """
    for right in active_rights(db, user, now):
        if right.per_reading and right.reading_id is None and right.covers(reading.product):
            right.reading_id = reading.id
            # история покупок обязана показывать разбор, который открыл заказ
            purchase = db.get(Purchase, right.purchase_id) if right.purchase_id else None
            if purchase is not None and purchase.reading_id is None:
                purchase.reading_id = reading.id
            db.commit()
            return True
    return False


def slots(rights: list[Entitlement], product: str) -> int:
    """Сколько разборов продукта оплачено разовыми правами: одно право — один разбор."""
    return sum(1 for r in rights if r.per_reading and r.covers(product))


def saved_count(db: Session, user: User, product: str | None = None) -> int:
    query = select(func.count(Reading.id)).where(Reading.user_id == user.id)
    if product:
        query = query.where(Reading.product == product)
    return int(db.scalar(query) or 0)


def storage_limit(db: Session, user: User, product: str,
                  now: dt.datetime | None = None) -> int | None:
    """Сколько разборов продукта можно держать в кабинете. None — без ограничения.

    Один бесплатный, чтобы вход имел смысл, плюс по одному за каждое купленное разовое право:
    иначе второй платёж не смог бы открыть второй разбор. Подписка с хранением снимает счёт.
    """
    rights = active_rights(db, user, now)
    if settings.all_free_without_payment or any(r.store_unlimited for r in rights):
        return None
    return 1 + slots(rights, product)


def can_save_more(db: Session, user: User, product: str, now: dt.datetime | None = None) -> bool:
    limit = storage_limit(db, user, product, now)
    return limit is None or saved_count(db, user, product) < limit


def grant(db: Session, user: User, offer: dict, purchase: Purchase | None = None,
          reading_id: int | None = None, now: dt.datetime | None = None,
          note: str | None = None) -> Entitlement:
    """Выдать право по снимку предложения. Срок считается один раз и потом не двигается."""
    now = now or utcnow()
    period = offer.get("period_days")
    right = Entitlement(user_id=user.id, purchase_id=purchase.id if purchase else None,
                        products=json.dumps(offer["products"], ensure_ascii=False),
                        per_reading=bool(offer["per_reading"]),
                        store_unlimited=bool(offer.get("store_unlimited")),
                        reading_id=reading_id if offer["per_reading"] else None,
                        starts_at=now,
                        expires_at=None if period is None else now + dt.timedelta(days=period),
                        note=note)
    db.add(right)
    db.flush()
    return right


def product_summary(rights: list[Entitlement], product: str) -> dict:
    mine = [r for r in rights if r.covers(product)]
    singles = [r for r in mine if r.per_reading]
    subscriptions = [r for r in mine if not r.per_reading]
    # Разбор считается один раз, даже если на нём и купленное, и выданное право.
    owned = {r.reading_id or -r.id for r in singles if r.expires_at is None and r.purchase_id is not None}
    given = {r.reading_id or -r.id for r in singles if r.expires_at is None and r.purchase_id is None} - owned
    ends = [r.expires_at for r in mine if r.expires_at is not None]
    free = settings.all_free_without_payment
    return {
        "unlimited": free or bool(subscriptions),
        # подписка без заказа — выдана админом: кабинет не называет её покупкой
        "unlimited_granted": not free and bool(subscriptions) and all(r.purchase_id is None for r in subscriptions),
        "owned": len(owned),
        "granted": len(given),
        "until": iso(max(ends)) if ends else None,
        "limit": None if free or any(r.store_unlimited for r in rights) else 1 + len({r.reading_id or -r.id for r in singles}),
    }


def holdings(rights: list[Entitlement], subscription_name: str | None = None) -> list[dict]:
    """Что у человека есть — одним списком: подписки, затем разборы по продуктам; купленное и
    выданное отдельными строками.

    Единственная сводка прав для экранов: кабинет, админка и печать выводят её как есть и из прав
    сами ничего не считают. Пока каждый экран собирал строку «Доступ» из полей личного разбора, у
    пары и у выданного всякий раз находилась непокрытая комбинация."""
    out: list[dict] = []
    subscriptions = [r for r in rights if not r.per_reading]
    for source in ("bought", "granted"):
        mine = [r for r in subscriptions if (r.purchase_id is None) == (source == "granted")]
        if mine:
            ends = [r.expires_at for r in mine]
            out.append({"kind": "subscription", "source": source, "name": subscription_name,
                        "products": sorted({p for r in mine for p in r.product_list()}),
                        "until": None if any(e is None for e in ends) else iso(max(ends))})
    singles = [r for r in rights if r.per_reading]
    for code in PRODUCTS:
        mine = [r for r in singles if code in r.product_list()]
        # разбор с купленным и выданным правом считается купленным, один раз
        bought = {r.reading_id or -r.id for r in mine if r.purchase_id is not None}
        given = {r.reading_id or -r.id for r in mine if r.purchase_id is None} - bought
        for source, keys in (("bought", bought), ("granted", given)):
            if keys:
                out.append({"kind": "reading", "source": source, "product": code, "count": len(keys)})
    return out


def subscription_name(db: Session) -> str | None:
    """Имя подписки для сводки — из справочника, как на витрине и в платежах."""
    from . import offers
    from .products import ANY
    found = [o for o in offers.all_offers(db) if not o.per_reading]
    best = next((o for o in found if ANY in o.product_list()), found[0] if found else None)
    return best.public_body()["name"] if best else None


def plan_label(db: Session, rights: list[Entitlement], reading: Reading) -> str:
    """Чем открыт разбор — подпись в шапке разбора и PDF: купленное называется предложением,
    выданное — выданным, подписка — подпиской."""
    from . import offers
    from .i18n import say
    found = reading_state(rights, reading)
    state = found["access"]
    if state == "locked":
        return say("report.plan_free")
    if found["access_granted"]:
        return say("report.plan_granted")
    shop = offers.storefront(db, reading.product)
    offer = next((o for o in shop if o.per_reading == (state == "forever")), None)
    if state == "open" or offer is None:
        return say("report.plan_full")
    return say("report.plan_named", name=offer.public_body()["name"])


def after_refund(db: Session, purchase: Purchase, now: dt.datetime | None = None) -> tuple[str, dict, str | None]:
    """Что станет с доступом без прав этого заказа: ключ исхода, значения для текста, продукт."""
    from .products import date_label
    user = db.get(User, purchase.user_id)
    rights = [r for r in active_rights(db, user, now) if r.purchase_id != purchase.id]
    reading = db.get(Reading, purchase.reading_id) if purchase.reading_id is not None else None
    if reading is not None:
        state = reading_state(rights, reading)
        if state["access"] == "locked":
            return "closes", {}, reading.product
        if state["access"] == "subscription":
            return "stays_subscription", {"until": date_label(state["access_until"][:10])}, reading.product
        return "stays_open", {}, reading.product
    if not purchase.body().get("per_reading", True):
        left = [h for h in holdings(rights) if h["kind"] == "subscription"]
        if not left:
            return "subscription_ends", {}, None
        ends = [h["until"] for h in left]
        if any(e is None for e in ends):
            return "subscription_stays_forever", {}, None
        return "subscription_stays", {"until": date_label(max(ends)[:10])}, None
    return "rights_revoked", {}, None


# после этих исходов доступа по заказу не остаётся — можно предложить купить снова
CLOSED_AFTER_REFUND = {"closes", "subscription_ends", "rights_revoked"}


def refund_outcome(db: Session, purchase: Purchase, now: dt.datetime | None = None, *,
                   done: bool = False) -> str:
    """Что станет с доступом без прав этого заказа — для окна возврата и письма о возврате.

    Считается теми же функциями, что кабинет, а не обещается заранее: разбор, выданный админом
    или открытый подпиской, после возврата остаётся открытым, и «разбор закроется» было ложью.
    `done` — для письма, уже после возврата: те же факты в прошедшем времени."""
    from .i18n import say_for
    key, values, product = after_refund(db, purchase, now)
    return say_for(f"refund.{'done.' if done else ''}{key}", product, **values)


def summary(db: Session, user: User | None, now: dt.datetime | None = None) -> dict:
    """Что показать в кабинете: какие виды доступа есть и до какого числа.

    Верхние поля — про личный разбор, в прежнем виде: на них держится фронт личного разбора.
    Купленная пара их не трогает, иначе личный разбор вёл бы себя как оплаченный. По каждому
    продукту — `products`.
    """
    rights = active_rights(db, user, now)
    personal = product_summary(rights, PERSONAL)
    kinds = sorted({k for r in rights if r.covers(PERSONAL) for k in r.scopes()})
    free = settings.all_free_without_payment
    return {
        "scopes": kinds,
        # витрина без оплаты открывает любые даты и снимает счёт мест, но купленным это не
        # становится: `scopes` остаётся пустым, и в кабинете нет строки о покупке, которой не было
        "all_free": free,
        "unlimited_matrices": personal["unlimited"],
        "can_store": free or any(r.store_unlimited for r in rights),
        # None — без ограничения; иначе бесплатная плюс по одной за каждое разовое право
        "matrices_limit": personal["limit"],
        # сколько дат куплено бессрочно: покупка и подписка живут одновременно, и кабинет
        # обязан показывать обе. Выданные без денег сюда не входят
        "owned": personal["owned"],
        # сколько открыто без оплаты (выдал админ, промо): слот они занимают наравне с купленными
        "granted": personal["granted"],
        # только через iso(): голый isoformat() терял смещение, и браузер читал время как
        # местное — срок подписки показывался на три часа раньше, а у полуночи на сутки
        "until": personal["until"],
        "rights": [r.item() for r in rights],
        "products": {code: product_summary(rights, code) for code in PRODUCTS},
        "holdings": holdings(rights, subscription_name(db)),
    }
