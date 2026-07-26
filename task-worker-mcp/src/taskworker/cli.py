"""Точка входа CLI.

    taskworker mcp        # stdio MCP-сервер (его поднимает Claude Code; регистрация user-scope)
    taskworker wait-jobs  # висит, пока джобов нет; появились — печатает [{job_id, type}] и выходит
"""

from __future__ import annotations

import argparse
import json
import time

WATCH_SLICE = 45      # секунд на одно обращение к watch: меньше минуты, чтобы сервер видел петлю
                      # живой и не гасил индикатор LLM (tech §6 «LLM offline»)
RETRY_PAUSE = 5.0     # пауза перед повтором, если сервер сейчас недоступен
ERROR_GRACE = 60.0    # столько терпим недоступный сервер (рестарт), дальше выходим с ошибкой


def _cmd_mcp(args: argparse.Namespace) -> int:
    # Логи уходят в файл, stdout остаётся чистым — по нему идёт MCP-протокол.
    from . import mcp_server

    mcp_server.main()
    return 0


def _cmd_wait_jobs(args: argparse.Namespace) -> int:
    """Блокирующее ожидание работы: висит, пока джобов нет; при появлении печатает короткий JSON
    `[{job_id, type}]` и завершается. Пусто по таймауту — печатает `[]`.

    Сигнал для Claude Code — само завершение процесса, поэтому stdout не буферизуем. Длинное
    ожидание нарезано на куски по WATCH_SLICE: процесс всё равно висит до появления джобов, но
    сервер регулярно видит, что петля жива."""
    from . import app_client
    from .logsetup import setup_logging

    log = setup_logging("wait", stderr=True)
    deadline = time.monotonic() + args.timeout if args.timeout else None
    log.info("wait-jobs: ждём джобы (max_jobs=%d, timeout=%s)",
             args.max_jobs, args.timeout or "бесконечно")
    failing_since: float | None = None
    try:
        while True:
            left = WATCH_SLICE if deadline is None else min(WATCH_SLICE, deadline - time.monotonic())
            if left <= 0:
                break
            try:
                jobs = app_client.watch(max_jobs=args.max_jobs, timeout=left)
                failing_since = None
            except app_client.AppError as exc:
                now = time.monotonic()
                failing_since = failing_since or now
                if now - failing_since >= ERROR_GRACE:
                    log.error("wait-jobs: сервер недоступен %.0f с, выходим: %s",
                              now - failing_since, exc)
                    return 1
                log.warning("wait-jobs: %s — повтор через %.0f с", exc, RETRY_PAUSE)
                time.sleep(RETRY_PAUSE)
                continue
            if jobs:
                log.info("wait-jobs: джобов %d: %s", len(jobs),
                         ", ".join(f"{j['job_id']}({j['type']})" for j in jobs))
                print(json.dumps(jobs, ensure_ascii=False), flush=True)
                return 0
    except KeyboardInterrupt:
        return 130
    if failing_since is not None:
        log.error("wait-jobs: таймаут при недоступном сервере")
        return 1
    log.info("wait-jobs: таймаут, джобов нет")
    print("[]", flush=True)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="taskworker", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("mcp", help="stdio MCP-сервер: status, get_job, submit_result").set_defaults(
        func=_cmd_mcp)

    wait = sub.add_parser("wait-jobs", help="блокироваться до появления джобов, напечатать их и выйти")
    wait.add_argument("--max-jobs", dest="max_jobs", type=int, default=10,
                      help="сколько джобов забрать за раз (по умолчанию 10)")
    wait.add_argument("--timeout", type=float, default=0,
                      help="максимум секунд ожидания (0 = бесконечно)")
    wait.set_defaults(func=_cmd_wait_jobs)
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    raise SystemExit(args.func(args))


if __name__ == "__main__":
    main()
