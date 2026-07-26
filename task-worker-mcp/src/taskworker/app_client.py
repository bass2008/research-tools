"""HTTP-клиент к внутренним эндпоинтам FastAPI (tech-design §6.3).

    GET  /internal/llm/watch?max_jobs=&timeout=   -> [{job_id, type}]   (висит, пока джобов нет)
    GET  /internal/llm/job/{job_id}               -> {job_id, type, params, prompt}
    POST /internal/llm/result {job_id, ok, ...}   -> {accepted}

Во всех запросах — `X-Internal-Token`. Плюс `X-Caller` (dispatcher|agent): по нему в логе сервера
видно, кто забирал данные джоба, — без этого правило «диспетчер за данными не ходит» не проверить
(testing-plan §1.2).
"""

from __future__ import annotations

import json
from typing import Any
from urllib.parse import quote

import httpx

from .config import app_url, internal_token

CONNECT_TIMEOUT = 10.0
WATCH_MARGIN = 30.0      # HTTP-таймаут watch = серверный timeout + запас: иначе клиент сам оборвёт
JOB_TIMEOUT = 60.0       # params джоба бывают крупными, но сервер локальный
RESULT_TIMEOUT = 300.0   # result у analyze — большой HTML, сервер его ещё и на диск пишет


class AppError(RuntimeError):
    """Не удалось поговорить с сервером: сеть, код ответа или ответ не JSON."""


class JobUnknown(AppError):
    """Джоб неизвестен или просрочен (404): его данные больше недоступны (tech §6.3)."""


def _request(method: str, path: str, *, caller: str, read_timeout: float,
             params: dict | None = None, json_body: dict | None = None) -> Any:
    url = f"{app_url()}{path}"
    headers = {"X-Internal-Token": internal_token(), "X-Caller": caller}
    timeout = httpx.Timeout(read_timeout, connect=CONNECT_TIMEOUT)
    try:
        with httpx.Client(timeout=timeout) as client:
            response = client.request(method, url, params=params, json=json_body, headers=headers)
    except httpx.HTTPError as exc:
        raise AppError(f"нет связи с {url}: {exc}") from exc
    if response.status_code in (401, 403):
        raise AppError(f"сервер отклонил INTERNAL_TOKEN (HTTP {response.status_code})")
    if response.status_code == 404:
        raise JobUnknown(f"{method} {path} -> HTTP 404: {response.text[:200]}")
    if response.status_code >= 400:
        raise AppError(f"{method} {path} -> HTTP {response.status_code}: {response.text[:200]}")
    try:
        return response.json()
    except ValueError as exc:
        raise AppError(f"{method} {path}: ответ не JSON ({response.text[:200]})") from exc


def watch(max_jobs: int = 10, timeout: float = 45.0, caller: str = "dispatcher") -> list[dict]:
    """Ожидание джобов: сервер держит запрос, пока их нет. Возвращает `[{job_id, type}]`.

    Серверный `timeout` никогда не отдаём нулём (у нуля легко получить смысл «ждать вечно»),
    а HTTP-таймаут держим заведомо больше него."""
    wait = max(1, int(timeout))
    data = _request("GET", "/internal/llm/watch", caller=caller,
                    read_timeout=wait + WATCH_MARGIN,
                    params={"max_jobs": int(max_jobs), "timeout": wait})
    if data is None:
        return []
    if not isinstance(data, list):
        raise AppError(f"watch вернул не список: {str(data)[:200]}")
    jobs = []
    for item in data:
        if isinstance(item, dict) and item.get("job_id"):
            jobs.append({"job_id": str(item["job_id"]), "type": str(item.get("type") or "")})
    return jobs


def get_job(job_id: str, caller: str = "agent") -> dict:
    """Полные данные джоба: `{job_id, type, params, prompt}`."""
    # job_id вида "{task_id}:{n}" — двоеточие в сегменте пути легально, не экранируем.
    data = _request("GET", f"/internal/llm/job/{quote(job_id, safe=':')}",
                    caller=caller, read_timeout=JOB_TIMEOUT)
    if not isinstance(data, dict):
        raise AppError(f"job вернул не объект: {str(data)[:200]}")
    return data


def submit_result(job_id: str, result: Any = None, error: str | None = None,
                  caller: str = "agent") -> dict:
    """Вернуть результат джоба (`ok=true`) или его ошибку (`ok=false`). Ответ — `{accepted}`."""
    body: dict[str, Any] = {"job_id": job_id, "ok": error is None}
    if error is None:
        body["result"] = _as_json(result)
    else:
        body["error"] = str(error)
    data = _request("POST", "/internal/llm/result", caller=caller,
                    read_timeout=RESULT_TIMEOUT, json_body=body)
    if not isinstance(data, dict):
        raise AppError(f"result вернул не объект: {str(data)[:200]}")
    return data


def _as_json(result: Any) -> Any:
    """Агент мог отдать результат строкой с JSON — разбираем, иначе шлём как есть."""
    if isinstance(result, str):
        try:
            return json.loads(result)
        except ValueError:
            return result
    return result
