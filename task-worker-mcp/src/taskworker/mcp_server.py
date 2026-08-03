"""MCP-сервер `taskworker` (stdio): мост между LLM-клиентом и FastAPI конвейера.

Роли разведены (tech-design §6.3, `prompts/orchestrator.md`):

* `status` — **диспетчер**: есть ли связь с сервером и сколько джобов ждёт;
* `get_job` / `submit_result` — **агент-исполнитель**: забрать данные джоба и вернуть результат.

Через контекст диспетчера идут только `job_id` и `type`; тяжёлые `params`/`result` живут в
контексте агента. Ожидание работы инструментом не делаем — это команда `taskworker wait-jobs`.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
from typing import Any

from mcp.server.fastmcp import FastMCP

from . import app_client
from .config import app_url, env_file, internal_token, log_dir
from .logsetup import setup_logging

STATUS_PEEK_MAX = 10     # сколько джобов status готов принять, если они уже стоят в очереди
STATUS_PEEK_WAIT = 1     # проверка связи не должна висеть: ждём секунду и отвечаем
INLINE_JOB_MAX_BYTES = 48 * 1024

log = setup_logging("mcp")

_INSTRUCTIONS = """Транспорт LLM-задач конвейера ниш (сервер `taskworker`).

`status` — вызывает ДИСПЕТЧЕР: проверить связь с сервером конвейера и узнать, сколько джобов ждёт.
`get_job(job_id)` и `submit_result(job_id, ...)` — вызывает АГЕНТ-ИСПОЛНИТЕЛЬ, которому выдали
конкретный `job_id`. Диспетчеру `get_job` вызывать нельзя: данные джоба (сотня узлов с детьми,
полные выдачи) не должны попадать в его контекст.

Ожидание работы — не инструмент, а команда `taskworker wait-jobs`: её запускают в фоне, она
блокируется, пока джобов нет, и завершается ровно в момент их появления."""

mcp = FastMCP("taskworker", instructions=_INSTRUCTIONS)


def _server_job_dir(job_id: str) -> Path:
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", job_id)
    return log_dir() / "codex-dispatcher" / "job-files" / safe


def _atomic_bytes(path: Path, payload: bytes) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(path.parent, 0o700)
    tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    tmp.write_bytes(payload)
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)


def _job_for_agent(job: dict, max_inline_bytes: int = INLINE_JOB_MAX_BYTES) -> dict:
    """Большой server payload передать файлом, не через обрезаемый MCP tool result."""
    payload = json.dumps(job, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(payload) <= max_inline_bytes:
        return job
    directory = _server_job_dir(str(job["job_id"]))
    input_file = directory / "input.json"
    result_file = directory / "result.json"
    _atomic_bytes(input_file, payload)
    result_file.unlink(missing_ok=True)
    digest = hashlib.sha256(payload).hexdigest()
    return {
        "job_id": job["job_id"],
        "type": job["type"],
        "params": {
            "input_file": str(input_file),
            "input_sha256": digest,
            "input_bytes": len(payload),
        },
        "prompt": "Полный неизменённый server payload находится в params.input_file. "
                  "Прочитай весь JSON, проверь job_id/type и SHA-256, затем выполни его поле "
                  "prompt над его params. Не подменяй файл другими данными.",
        "result_file": str(result_file),
        "как отдать ответ": "запиши полный JSON в result_file и вызови submit_result(job_id) "
                            "без параметра result",
    }


def _result_from_server_file(job_id: str) -> tuple[Any, str | None]:
    directory = _server_job_dir(job_id)
    input_file, result_file = directory / "input.json", directory / "result.json"
    if not input_file.is_file():
        return None, "для этого джоба result_file не объявлен"
    try:
        source = json.loads(input_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return None, f"не удалось проверить объявленный input_file: {exc}"
    if source.get("job_id") != job_id:
        return None, "job_id в объявленном input_file не совпадает"
    if not result_file.is_file():
        return None, f"файла ответа нет: {result_file}"
    try:
        return json.loads(result_file.read_text(encoding="utf-8")), None
    except json.JSONDecodeError as exc:
        return None, f"в {result_file.name} невалидный JSON: {exc}"


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
    from . import needs

    if needs.is_local(job_id):     # лаборатория промптов: джоб лежит файлом, сервер не нужен
        try:
            job = needs.job_for_agent(job_id)
        except (LookupError, OSError) as exc:
            log.warning("tool get_job(%s) -> локального джоба нет: %s", job_id, exc)
            return {"job_id": job_id, "error": f"локального джоба нет: {job_id}"}
        log.info("tool get_job(%s) -> локальный, type=%s, вход файлом: %s",
                 job_id, job.get("type"), job["params"]["input_file"])
        return job
    try:
        job = app_client.get_job(job_id, caller="agent")
    except app_client.JobUnknown as exc:
        log.warning("tool get_job(%s) -> джоб неизвестен или просрочен: %s", job_id, exc)
        return {"job_id": job_id,
                "error": "джоб неизвестен или просрочен — данные больше недоступны"}
    except app_client.AppError as exc:
        log.error("tool get_job(%s) -> ошибка: %s", job_id, exc)
        return {"job_id": job_id, "error": f"нет связи с сервером: {exc}"}
    compact = _job_for_agent(job)
    if compact is job:
        log.info("tool get_job(%s) -> type=%s, params=%d симв., prompt=%d симв.",
                 job_id, job.get("type"), len(str(job.get("params", ""))),
                 len(str(job.get("prompt", ""))))
    else:
        log.info("tool get_job(%s) -> type=%s, большой вход %d байт файлом: %s",
                 job_id, job.get("type"), compact["params"]["input_bytes"],
                 compact["params"]["input_file"])
    return compact


@mcp.tool()
def submit_result(job_id: str, result: Any = None, error: str | None = None) -> dict:
    """Вернуть результат джоба или его ошибку. Вызывает АГЕНТ-ИСПОЛНИТЕЛЬ, не диспетчер.

    Передай РОВНО ОДНО: `result` — валидный JSON по схеме из `prompt` (ничего не обрезая: большой
    `report_html` в `analyze` — норма), либо `error` — краткая причина неудачи (невалидный JSON,
    не хватает данных, ошибка). Ретраить и выдумывать данные нельзя: нет уверенного ответа — это
    `error`.

    **Если у джоба есть `result_file`** (большой ответ): запиши JSON в ЭТОТ файл и вызови
    `submit_result(job_id)` без `result` — обвязка прочитает файл сама. Так ответ не поедет
    через вызов инструмента и не обрежется по длине. Свой путь подставлять нельзя.

    Возвращает `{accepted}`. `accepted: false` — смотри `problems`: там перечислено, что не так
    (потерянные или выдуманные фразы, несходящиеся счётчики). Это можно починить и вызвать снова.
    Если джоб просрочен или неизвестен — повторять бессмысленно, сообщи диспетчеру."""
    from . import needs

    if needs.is_local(job_id):
        try:
            answer = needs.save_result(job_id, result=result, error=error)
        except (LookupError, OSError) as exc:
            log.warning("tool submit_result(%s) -> локального джоба нет: %s", job_id, exc)
            return {"accepted": False, "error": f"локального джоба нет: {job_id}"}
        log.info("tool submit_result(%s) -> accepted=%s%s", job_id, answer.get("accepted"),
                 "" if answer.get("accepted") else f", проблем: {len(answer.get('problems', []))}")
        return answer
    if result is None and error is None:
        result, problem = _result_from_server_file(job_id)
        if problem:
            log.warning("tool submit_result(%s) -> %s", job_id, problem)
            return {"accepted": False, "error": problem}
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
