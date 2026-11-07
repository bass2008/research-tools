from __future__ import annotations

import datetime as dt
import secrets
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from .. import notifications as service
from ..db import begin_write
from ..http_errors import error
from ..config import settings
from ..db import get_db
from ..deps import current_user, ghost_session
from ..i18n import current_locale
from ..models import Notification, NotificationDelivery as Delivery, User, iso, utcnow, as_utc
from ..schemas import ReadAllNotifications
def notification_admin(user: User = Depends(current_user)) -> User:
    if not settings.is_admin(user.email):
        raise error(403, "Доступ администратора обязателен.", "Administrator access required.")
    return user


router = APIRouter(tags=["notifications"])


def allowed(user: User):
    # Personal inbox is the same for every account, including administrators.
    return [Delivery.user_id == user.id, Notification.type != service.ADMIN_TYPE]


def listing(db: Session, rules: list, page: int, size: int, *, admin: bool = False,
            time_zone: str = "UTC") -> dict:
    q = select(Delivery).join(Notification).where(*rules)
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = db.scalars(q.order_by(Delivery.id.desc()).offset((page-1)*size).limit(size)).all()
    items = []
    for d in rows:
        item = {"delivery_id": d.id, "notification_id": d.notification_id, "type": d.notification.type,
                **service.render(d.notification, current_locale(), admin=admin, user_id=d.user_id, time_zone=time_zone),
                "created_at": iso(d.notification.created_at),
                "delivered_at": iso(d.delivered_at), "read_at": iso(d.read_at)}
        if admin:
            item["user"] = {"id": d.user_id, "email": d.user.email}
        items.append(item)
    return {"items": items, "total": total, "page": page, "page_size": size}


@router.get("/notifications")
def inbox(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
          unread_only: bool = False, time_zone: str = "UTC",
          user: User = Depends(current_user), db: Session = Depends(get_db)):
    rules = allowed(user)
    unread = db.scalar(select(func.count(Delivery.id)).join(Notification).where(*rules, Delivery.read_at.is_(None))) or 0
    boundary = db.scalar(select(func.max(Delivery.id)).join(Notification).where(*rules)) or 0
    result = listing(db, rules + ([Delivery.read_at.is_(None)] if unread_only else []), page, page_size,
                     time_zone=time_zone)
    return {**result, "unread_count": unread, "through_id": boundary}


@router.post("/notifications/read-all")
def read_all(payload: ReadAllNotifications, user: User = Depends(current_user),
             ghost: bool = Depends(ghost_session), db: Session = Depends(get_db)):
    if ghost:
        raise error(403, "В чужом кабинете прочтение не изменяется.", "Cannot change read state while impersonating.")
    ids = select(Delivery.id).join(Notification).where(*allowed(user), Delivery.id <= payload.through_id)
    db.execute(update(Delivery).where(Delivery.id.in_(ids), Delivery.read_at.is_(None)).values(read_at=utcnow()))
    db.commit()
    return {"ok": True}


@router.post("/notifications/{delivery_id}/read")
def read_one(delivery_id: int, user: User = Depends(current_user),
             ghost: bool = Depends(ghost_session), db: Session = Depends(get_db)):
    if ghost:
        raise error(403, "В чужом кабинете прочтение не изменяется.", "Cannot change read state while impersonating.")
    row = db.scalar(select(Delivery).join(Notification).where(*allowed(user), Delivery.id == delivery_id))
    if not row:
        raise error(404, "Уведомление не найдено.", "Notification not found.")
    # Не перезаписывать время первого прочтения конкурентным запросом.
    db.execute(update(Delivery).where(Delivery.id == row.id, Delivery.read_at.is_(None)).values(read_at=utcnow()))
    db.commit()
    db.refresh(row)
    return {"read_at": iso(row.read_at)}


@router.get("/admin/notifications")
def admin_notifications(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                        user_id: int | None = None, type: str | None = None, read: bool | None = None,
                        delivered_from: dt.datetime | None = None, delivered_to: dt.datetime | None = None,
                        time_zone: str = "UTC",
                        _: User = Depends(notification_admin), db: Session = Depends(get_db)):
    rules = []
    if user_id is not None:
        rules.append(Delivery.user_id == user_id)
    if type:
        rules.append(Notification.type == type)
    if read is not None:
        rules.append(Delivery.read_at.is_not(None) if read else Delivery.read_at.is_(None))
    if delivered_from:
        rules.append(Delivery.delivered_at >= as_utc(delivered_from))
    if delivered_to:
        rules.append(Delivery.delivered_at < as_utc(delivered_to))
    return listing(db, rules, page, page_size, admin=True, time_zone=time_zone)


@router.post("/internal/notifications/check")
def check(request: Request, db: Session = Depends(get_db)):
    secret = settings.notification_check_secret
    if not secret or not secrets.compare_digest(request.headers.get("authorization", ""), f"Bearer {secret}"):
        raise error(403, "Служебный доступ запрещён.", "Service access denied.")
    if not settings.notification_check_since:
        raise error(503, "Не задан момент начала проверки.", "Notification start time is not configured.")
    try:
        since = as_utc(dt.datetime.fromisoformat(settings.notification_check_since.replace("Z", "+00:00")))
    except ValueError:
        raise error(503, "Некорректный момент начала проверки.", "Invalid notification start time.") from None
    begin_write(db)
    ids = service.expiration_events(db, since)
    db.commit()
    return {"created": len(ids), "email_errors": service.deliver_emails(db, ids)}
