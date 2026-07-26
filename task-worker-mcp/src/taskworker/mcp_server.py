"""MCP-сервер `taskworker` (stdio): мост между Claude Code и FastAPI конвейера.

Роли разведены (tech-design §6.3, `prompts/orchestrator.md`):

* `status` — **диспетчер**: есть ли связь с сервером и сколько джобов ждёт;
* `get_job` / `submit_result` — **агент-исполнитель**: забрать данные джоба и вернуть результат.

Через контекст диспетчера идут только `job_id` и `type`; тяжёлые `params`/`result` живут в
контексте агента. Ожидание работы инструментом не делаем — это команда `taskworker wait-jobs`.
"""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import FastMCP

from . import app_client
from .config import app_url, env_file, internal_token
from .logsetup import setup_logging

STATUS_PEEK_MAX = 10     # сколько джобов status готов принять, если они уже стоят в очереди
STATUS_PEEK_WAIT = 1     # проверка связи не должна висеть: ждём секунду и отвечаем

log = setup_logging("mcp")

_INSTRUCTIONS = """Транспорт LLM-задач конвейера ниш (сервер `taskworker`).

`status` — вызывает ДИСПЕТЧЕР: проверить связь с сервером конвейера и узнать, сколько джобов ждёт.
`get_job(job_id)` и `submit_result(job_id, ...)` — вызывает АГЕНТ-ИСПОЛНИТЕЛЬ, которому выдали
конкретный `job_id`. Диспетчеру `get_job` вызывать нельзя: данные джоба (сотня узлов с детьми,
полные выдачи) не должны попадать в его контекст.

Ожидание работы — не инструмент, а команда `taskworker wait-jobs`: её запускают в фоне, она
блокируется, пока джобов нет, и завершается ровно в момент их появления."""

mcp = FastMCP("taskworker", instructions=_INSTRUCTIONS)


@mcp.tool()
def status() -> str:
    """Проверка связи с сервером конвейера. Вызывает ДИСПЕТЧЕР (шаг 1 петли).

    Отдаёт: доступен ли сервер, куда стучимся (`APP_URL`), задан ли секрет, сколько джобов ждёт.

    ВНИМАНИЕ: если джобы уже стоят в очереди, этот вызов снимает их сигнал с очереди (сигнал
    выдаётся один раз) — их `job_id` перечислены в ответе. Раздай их агентам сразу же: повторного
    сигнала по этим джобам не будет, ни здесь, ни в `wait-jobs`."""
    url = app_url()
    token = "задан" if internal_token() else "НЕ ЗАДАН — пропиши INTERNAL_TOKEN в .env"
    env = env_file()
    head = [f"APP_URL: {url}", f"секрет: {token}", f".env: {env or 'не найден'}"]
    try:
        jobs = app_client.watch(max_jobs=STATUS_PEEK_MAX, timeout=STATUS_PEEK_WAIT,
                                caller="dispatcher")
    except app_client.AppError as exc:
        log.warning("tool status -> сервер недоступен: %s", exc)
        return "\n".join(["сервер: НЕДОСТУПЕН", f"причина: {exc}", *head,
                          "починить: подними приложение (uvicorn server:app --port 8000), "
                          "проверь APP_URL и INTERNAL_TOKEN в .env"])
    log.info("tool status -> сервер доступен, джобов ждёт: %d", len(jobs))
    lines = ["сервер: доступен", *head, f"джобов ждёт: {len(jobs)}"]
    if jobs:
        lines.append("эти джобы выданы этим вызовом — раздай их агентам сейчас же:")
        lines += [f"  {job['job_id']} ({job['type']})" for job in jobs]
    return "\n".join(lines)


@mcp.tool()
def get_job(job_id: str) -> dict:
    """Полные данные джоба: `{job_id, type, params, prompt}`.

    Вызывает АГЕНТ-ИСПОЛНИТЕЛЬ — тот, кому выдали этот `job_id`; диспетчеру вызывать запрещено.
    `params` — входные данные, `prompt` — самодостаточная инструкция: работай строго по ней, за
    промптами в репозиторий не ходи. Если в ответе есть поле `error` — данные не получены
    (джоб просрочен или нет связи), работу не выдумывай."""
    try:
        job = app_client.get_job(job_id, caller="agent")
    except app_client.JobUnknown as exc:
        log.warning("tool get_job(%s) -> джоб неизвестен или просрочен: %s", job_id, exc)
        return {"job_id": job_id,
                "error": "джоб неизвестен или просрочен — данные больше недоступны"}
    except app_client.AppError as exc:
        log.error("tool get_job(%s) -> ошибка: %s", job_id, exc)
        return {"job_id": job_id, "error": f"нет связи с сервером: {exc}"}
    log.info("tool get_job(%s) -> type=%s, params=%d симв., prompt=%d симв.",
             job_id, job.get("type"), len(str(job.get("params", ""))),
             len(str(job.get("prompt", ""))))
    return job


@mcp.tool()
def submit_result(job_id: str, result: Any = None, error: str | None = None) -> dict:
    """Вернуть результат джоба или его ошибку. Вызывает АГЕНТ-ИСПОЛНИТЕЛЬ, не диспетчер.

    Передай РОВНО ОДНО: `result` — валидный JSON по схеме из `prompt` (ничего не обрезая: большой
    `report_html` в `analyze` — норма), либо `error` — краткая причина неудачи (невалидный JSON,
    не хватает данных, ошибка). Ретраить и выдумывать данные нельзя: нет уверенного ответа — это
    `error`.

    Возвращает `{accepted}`. `accepted: false` — джоб просрочен или неизвестен, повторять
    бессмысленно: сообщи об этом диспетчеру."""
    if result is None and error is None:
        log.warning("tool submit_result(%s) -> ни result, ни error", job_id)
        return {"accepted": False, "error": "передай либо result, либо error"}
    if result is not None and error is not None:
        log.warning("tool submit_result(%s) -> переданы и result, и error: отправляю как ошибку",
                    job_id)
        result = None
    try:
        answer = app_client.submit_result(job_id, result=result, error=error, caller="agent")
    except app_client.JobUnknown:
        log.warning("tool submit_result(%s) -> джоб неизвестен или просрочен", job_id)
        return {"accepted": False, "error": "джоб неизвестен или просрочен"}
    except app_client.AppError as exc:
        log.error("tool submit_result(%s) -> ошибка: %s", job_id, exc)
        return {"accepted": False, "error": f"нет связи с сервером: {exc}"}
    log.info("tool submit_result(%s, %s) -> accepted=%s", job_id,
             "error" if error is not None else "result", answer.get("accepted"))
    return answer


def main() -> None:
    log.info("mcp: старт stdio-сервера (APP_URL=%s)", app_url())
    mcp.run()


if __name__ == "__main__":
    main()
