"""Очередь задач MCP: watch → job → result. Типы задач обрабатываются явно;
чакры совместимости входят в статический корпус и не используют очередь.
"""
from __future__ import annotations

import datetime as dt
import json
import time

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .config import settings
from .models import WorkTask, utcnow

OPEN = ("queued", "signalled")
OFFLINE_AFTER = 240
_last_watch = 0.0


def seen() -> None:
    global _last_watch
    _last_watch = time.time()


def worker_status() -> dict:
    last = _last_watch or None
    return {"online": last is not None and time.time() - last <= OFFLINE_AFTER,
            "last_seen_at": dt.datetime.fromtimestamp(last, dt.timezone.utc).isoformat() if last else None,
            "offline_after": OFFLINE_AFTER}


def take(db: Session, max_jobs: int) -> list[dict]:
    """Сигнал выдаётся один раз; несданная за `task_lease_hours` задача выдаётся снова."""
    now = utcnow()
    stale = now - dt.timedelta(hours=settings.task_lease_hours)
    rows = db.scalars(select(WorkTask)
                      .where(or_(WorkTask.status == "queued",
                                 (WorkTask.status == "signalled") & (WorkTask.signalled_at < stale)))
                      .order_by(WorkTask.id).limit(max_jobs)).all()
    for row in rows:
        row.status = "signalled"
        row.signalled_at = now
        row.attempts += 1
    db.commit()
    return [{"job_id": str(row.id), "type": row.kind} for row in rows]


def pending(db: Session) -> int:
    return len(db.scalars(select(WorkTask.id).where(WorkTask.status.in_(OPEN))).all())


def job(db: Session, task_id: int) -> dict | None:
    task = db.get(WorkTask, task_id)
    if task is None or task.status not in OPEN:
        return None
    return {"job_id": str(task.id), "type": task.kind, "params": task.data(),
            "created_at": task.item()["created_at"], "due_at": task.item()["due_at"]}


def submit(db: Session, task_id: int, ok: bool, result: object = None, error: str | None = None) -> dict:
    task = db.get(WorkTask, task_id)
    if task is None or task.status not in OPEN:
        return {"accepted": False, "error": "задача неизвестна или уже закрыта"}
    if task.kind != "test":
        return {"accepted": False, "error": f"неподдерживаемый тип задачи: {task.kind}"}
    now = utcnow()
    if not ok:
        task.status, task.error, task.finished_at = "failed", (error or "без причины")[:500], now
        db.commit()
        return {"accepted": True}
    if not isinstance(result, str) or not 1 <= len(result.strip()) <= 200:
        return {"accepted": False, "problems": ["Нужен короткий ответ строкой (1–200 символов)"]}
    task.params = json.dumps({"response": result.strip()}, ensure_ascii=False)
    task.status, task.finished_at, task.problems, task.error = "done", now, None, None
    db.commit()
    return {"accepted": True}


if __name__ == "__main__":
    # Токен исполнителя стенда: docker compose exec api python -m app.worktasks
    from .security import create_worker_token
    print(create_worker_token())

