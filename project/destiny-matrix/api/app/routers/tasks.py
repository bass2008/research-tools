from __future__ import annotations

import asyncio
import time
from typing import Any, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import worktasks
from ..db import get_db
from ..models import User, WorkTask
from ..security import read_worker_token
from .admin import admin_user

router = APIRouter(tags=["tasks"])


def worker(x_internal_token: str | None = Header(default=None)) -> None:
    if not read_worker_token(x_internal_token):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "неверный или отсутствующий X-Internal-Token")


class ResultIn(BaseModel):
    job_id: str
    ok: bool
    result: Any = None
    error: str | None = None


def _task_id(job_id: str) -> int:
    try:
        return int(job_id)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"задача {job_id} неизвестна") from None


@router.get("/internal/tasks/watch", dependencies=[Depends(worker)])
async def watch(max_jobs: int = Query(8, ge=1, le=50), timeout: float = Query(20, ge=0, le=50),
                db: Session = Depends(get_db)) -> list[dict]:
    """Блокируется, пока задач нет; отдаёт только сигнал. Таймаут меньше прокси Next и nginx."""
    deadline = time.monotonic() + timeout
    while True:
        worktasks.seen()
        jobs = worktasks.take(db, max_jobs)
        if jobs or time.monotonic() >= deadline:
            return jobs
        await asyncio.sleep(1)


@router.get("/internal/tasks/status", dependencies=[Depends(worker)])
def task_status(db: Session = Depends(get_db)) -> dict:
    return {"pending": worktasks.pending(db)}


@router.get("/internal/tasks/job/{job_id}", dependencies=[Depends(worker)])
def task_job(job_id: str, db: Session = Depends(get_db)) -> dict:
    found = worktasks.job(db, _task_id(job_id))
    if found is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"задача {job_id} неизвестна или закрыта")
    return found


@router.post("/internal/tasks/result", dependencies=[Depends(worker)])
def task_result(body: ResultIn, db: Session = Depends(get_db)) -> dict:
    return worktasks.submit(db, _task_id(body.job_id), body.ok, body.result, body.error)


@router.get("/admin/tasks")
def admin_tasks(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    query = select(WorkTask).order_by(WorkTask.id.desc())
    rows = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [row.item() for row in rows], "pending": worktasks.pending(db),
            "total": len(db.scalars(select(WorkTask.id)).all()), "worker": worktasks.worker_status()}


class TaskIn(BaseModel):
    kind: Literal["test"] = "test"


@router.post("/admin/tasks")
def admin_create_task(body: TaskIn, _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    task = WorkTask(kind=body.kind)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task.item()


@router.delete("/admin/tasks/{task_id}")
def admin_delete_task(task_id: int, _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    task = db.get(WorkTask, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "задачи нет")
    db.delete(task)
    db.commit()
    return {"ok": True}


@router.post("/admin/tasks/{task_id}/retry")
def admin_retry(task_id: int, _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    task = db.get(WorkTask, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "задачи нет")
    task.status, task.error, task.finished_at, task.signalled_at = "queued", None, None, None
    db.commit()
    return task.item()
