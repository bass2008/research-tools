"""MCP-сервер `arcana-tasks` (stdio): мост между Claude Code / Codex и очередью задач Arcana Sense.

Роли как у taskworker в корне research-tools: `status` — диспетчер; `get_job` / `submit_result` —
исполнитель. Ожидание работы — команда `arcana-tasks wait-jobs`, а не инструмент.
"""
from __future__ import annotations

import logging
from typing import Any

from mcp.server.fastmcp import FastMCP

from . import client
from .config import Stand, config_dir, log_dir, stand, stands

log_dir().mkdir(parents=True, exist_ok=True)
logging.basicConfig(filename=log_dir() / "mcp.log", level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("arcana-tasks")

mcp = FastMCP("arcana-tasks", instructions="""Очередь задач Arcana Sense (сервер `arcana-tasks`).

`status` — вызывает ДИСПЕТЧЕР: связь со стендами и сколько задач ждёт на каждом.
`get_job(job_id)` и `submit_result(job_id, ...)` — вызывает ИСПОЛНИТЕЛЬ, которому выдали job_id
вида `<стенд>:<номер>` (`test:1`, `prod:7`): по нему инструмент сам знает, куда сдавать.
Ожидание — команда `arcana-tasks wait-jobs` в фоне: не дольше 60 с, раньше — как только есть задачи.""")


def _split(job_id: str) -> tuple[Stand, str]:
    name, _, task_id = job_id.rpartition(":")
    return stand(name), task_id


@mcp.tool()
def status() -> str:
    """Связь со стендами и число задач в очереди каждого. Вызывает ДИСПЕТЧЕР; данных задач не отдаёт."""
    found = stands()
    if not found:
        return f"стендов нет: положи {config_dir()}/worker-<стенд>.env (см. worker/README.md)"
    lines = []
    for item in found.values():
        try:
            lines.append(f"{item.name}: доступен, {item.url}, задач ждёт: {client.status(item)['pending']}")
        except client.AppError as exc:
            lines.append(f"{item.name}: НЕДОСТУПЕН ({item.url}): {exc}")
    return "\n".join(lines)


@mcp.tool()
def get_job(job_id: str) -> dict:
    """Данные задачи: `{job_id, type, params, prompt, due_at}`. Вызывает ИСПОЛНИТЕЛЬ.

    `prompt` — полная инструкция; ссылки в ней ведут на файлы репозитория, их нужно прочитать.
    Поле `error` — данных нет (задача закрыта или нет связи): работу не выдумывать."""
    try:
        target, task_id = _split(job_id)
        job = client.get_job(target, task_id)
    except KeyError as exc:
        return {"job_id": job_id, "error": str(exc)}
    except client.JobUnknown:
        return {"job_id": job_id, "error": "задача неизвестна или уже закрыта"}
    except client.AppError as exc:
        return {"job_id": job_id, "error": f"нет связи со стендом: {exc}"}
    job["job_id"] = job_id
    job["prompt"] = (
        'Проверка связи через MCP. Сдай через submit_result короткую строку: "Связь с MCP работает." '
        'Других действий не требуется.' if job["type"] == "test"
        else f"неизвестный тип задачи {job['type']}"
    )
    log.info("get_job(%s) type=%s", job_id, job["type"])
    return job


@mcp.tool()
def submit_result(job_id: str, result: Any = None, error: str | None = None) -> dict:
    """Сдать результат (`result` по схеме из prompt) или причину неудачи (`error`) — ровно одно.

    `accepted: false` с `problems` — исправь перечисленное и сдай снова. Задача закрыта — повторять незачем."""
    if result is not None and error is not None:
        result = None
    try:
        target, task_id = _split(job_id)
        answer = client.submit_result(target, task_id, result=result, error=error)
    except KeyError as exc:
        return {"accepted": False, "error": str(exc)}
    except client.JobUnknown:
        return {"accepted": False, "error": "задача неизвестна или уже закрыта"}
    except client.AppError as exc:
        return {"accepted": False, "error": f"нет связи со стендом: {exc}"}
    log.info("submit_result(%s) accepted=%s", job_id, answer.get("accepted"))
    return answer


def main() -> None:
    mcp.run()
