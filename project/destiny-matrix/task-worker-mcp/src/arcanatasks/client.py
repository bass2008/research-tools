"""HTTP-клиент к очереди API стенда (через сайт: `/api/internal/tasks/*` — прокси в API).

    GET  /api/internal/tasks/watch?max_jobs=&timeout=  -> [{job_id, type}]
    GET  /api/internal/tasks/job/{job_id}              -> {job_id, type, params, due_at}
    POST /api/internal/tasks/result {job_id, ok, ...}  -> {accepted, problems?}
    GET  /api/internal/tasks/status                    -> {pending}
"""
from __future__ import annotations

import json
from typing import Any

import httpx

from .config import Stand

CONNECT_TIMEOUT = 10.0
WATCH_MARGIN = 15.0


class AppError(RuntimeError):
    pass


class JobUnknown(AppError):
    pass


def _request(stand: Stand, method: str, path: str, *, read_timeout: float = 60.0, params: dict | None = None,
             json_body: dict | None = None) -> Any:
    url = f"{stand.url}/api/internal/tasks{path}"
    try:
        with httpx.Client(timeout=httpx.Timeout(read_timeout, connect=CONNECT_TIMEOUT), auth=stand.basic) as client:
            response = client.request(method, url, params=params, json=json_body,
                                      headers={"X-Internal-Token": stand.token})
    except httpx.HTTPError as exc:
        raise AppError(f"нет связи с {url}: {exc}") from exc
    if response.status_code == 401:
        raise AppError(f"{url}: токен исполнителя не принят (HTTP 401) — выпусти новый в админке")
    if response.status_code == 404:
        raise JobUnknown(f"{method} {path} -> HTTP 404: {response.text[:200]}")
    if response.status_code >= 400:
        raise AppError(f"{method} {path} -> HTTP {response.status_code}: {response.text[:200]}")
    try:
        return response.json()
    except ValueError as exc:
        raise AppError(f"{method} {path}: ответ не JSON ({response.text[:200]})") from exc


def watch(stand: Stand, max_jobs: int = 8, timeout: float = 0) -> list[dict]:
    data = _request(stand, "GET", "/watch", read_timeout=timeout + WATCH_MARGIN,
                    params={"max_jobs": max_jobs, "timeout": max(0, int(timeout))})
    return [{"job_id": f"{stand.name}:{j['job_id']}", "type": str(j.get("type") or "")}
            for j in data or [] if j.get("job_id")]


def status(stand: Stand) -> dict:
    return _request(stand, "GET", "/status")


def get_job(stand: Stand, task_id: str) -> dict:
    return _request(stand, "GET", f"/job/{task_id}")


def submit_result(stand: Stand, task_id: str, result: Any = None, error: str | None = None) -> dict:
    if isinstance(result, str):
        try:
            result = json.loads(result)
        except ValueError:
            pass
    body: dict[str, Any] = {"job_id": task_id, "ok": error is None}
    if error is None:
        body["result"] = result
    else:
        body["error"] = str(error)
    return _request(stand, "POST", "/result", read_timeout=120.0, json_body=body)
