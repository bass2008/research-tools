"""Досверка платежей: спросить провайдера о тех, что остались без исхода.

Уведомление может не дойти — сеть, перезапуск, закрытая вкладка. Опрос закрывает эту дыру:
запускается по расписанию, берёт незакрытые платежи за последние сутки и применяет их исход тем
же кодом, что и уведомление.

    python -m app.sweep            один прогон; пустой список задачу не создаёт
"""
from __future__ import annotations

import datetime as dt
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import payments
from .db import SessionLocal
from .config import settings
from .models import Payment, PaymentSweep, as_utc, utcnow

# исход уже известен: спрашивать нечего
SETTLED = ("REFUNDED", "PARTIAL_REFUNDED", "REVERSED", "REJECTED", "CANCELED",
           "DEADLINE_EXPIRED", "ATTEMPTS_EXPIRED", "AUTH_FAIL")
WINDOW_HOURS = 24

# Наш собственный статус, не банковский: человек ушёл с формы и не вернулся. Спрашивать про такой
# платёж больше нечего, но право он не закрывает — если оплата всё же случится, уведомление банка
# обработается как обычно и доступ откроется.
ABANDONED = "ABANDONED"


def pending(db: Session, now: dt.datetime | None = None) -> list[Payment]:
    now = now or utcnow()
    since = now - dt.timedelta(hours=WINDOW_HOURS)
    rows = db.scalars(select(Payment).where(Payment.paid_at.is_(None),
                                            Payment.refunded_at.is_(None),
                                            Payment.created_at >= since)
                      .order_by(Payment.id)).all()
    out = []
    for row in rows:
        if row.status in SETTLED or row.status == ABANDONED:
            continue
        provider = payments.get(row.provider)
        if provider is None or not provider.enabled():
            continue
        out.append(row)
    return out


def _abandoned(payment: Payment, provider) -> bool:
    """Счёт открыт дольше порога и всё ещё не оплачен — человек до формы не вернулся."""
    if payment.paid_at is not None or not provider.reusable(payment.status):
        return False
    age = (utcnow() - as_utc(payment.created_at)).total_seconds()
    return age >= settings.payment_abandon_seconds


def run(db: Session | None = None) -> PaymentSweep | None:
    own = db is None
    session = db or SessionLocal()
    try:
        waiting = pending(session)
        if not waiting:
            return None

        job = PaymentSweep(status="running", started_at=utcnow())
        session.add(job)
        session.commit()
        session.refresh(job)

        from .routers.payments import apply as apply_update

        entries: list[dict] = []
        changed = 0
        for payment in waiting:
            provider = payments.get(payment.provider)
            was = payment.status
            record = {"payment": payment.id, "external_id": payment.external_id,
                      "email": payment.user.email, "was": was}
            try:
                update = provider.state(payment.external_id)
                apply_update(session, payment, update)
                record["now"] = payment.status
                record["outcome"] = str(update.outcome)
                record["paid"] = payment.paid_at is not None
                if payment.status != was:
                    changed += 1
                elif _abandoned(payment, provider):
                    payment.status = ABANDONED
                    record["now"] = ABANDONED
                    record["abandoned"] = True
                    changed += 1
            except payments.PaymentError as exc:
                record["error"] = str(exc)[:200]
            entries.append(record)

        job.checked = len(entries)
        job.changed = changed
        job.log = json.dumps(entries, ensure_ascii=False)
        job.status = "done"
        job.finished_at = utcnow()
        session.commit()
        session.refresh(job)
        return job
    finally:
        if own:
            session.close()


def main() -> None:
    job = run()
    if job is None:
        print("досверять нечего: незакрытых платежей нет")
        return
    print(f"прогон {job.id}: проверено {job.checked}, изменилось {job.changed}, "
          f"{job.seconds()} c")
    for entry in job.entries():
        line = f"  платёж {entry['payment']} ({entry['email']}): {entry['was']}"
        line += f" → {entry['now']}" if "now" in entry else f" — ошибка: {entry.get('error')}"
        print(line)


if __name__ == "__main__":
    main()
