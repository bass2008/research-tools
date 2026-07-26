"""Точка входа CLI.

    taskworker mcp           # stdio MCP-сервер (его поднимает Claude Code; регистрация user-scope)
    taskworker wait-jobs     # висит, пока джобов нет; появились — печатает [{job_id, type}] и выходит

Лаборатория типа `needs` (пока без конвейера, см. needs.py):

    taskworker needs-job <фраза>          # собрать ветку из БД (ro) и завести локальный джоб
    taskworker needs-diff <job_id> --ref  # сверить ответ агента с эталонной сборкой
    taskworker needs-show <job_id>        # что в джобе: вход, ответ, полнота
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


def _cmd_needs_job(args: argparse.Namespace) -> int:
    from . import needs

    payload = needs.build_payload(args.phrase, min_freq=args.min_freq, max_freq=args.max_freq)
    job_id = needs.create_job(payload, tag=args.tag)
    print(f"джоб: {job_id}")
    print(f"  ветка: {payload['root']!r} freq={payload['root_freq']} ({payload['status']})")
    print(f"  узлов в поддереве: {payload['subtree_total']}, в payload: {len(payload['nodes'])}"
          f" (freq >= {payload['min_freq']}"
          + (f", <= {payload['max_freq']}" if payload["max_freq"] else "") + ")")
    print(f"  файл: {needs._job_file(job_id)}")
    print(f"\nагенту: get_job(\"{job_id}\") -> работай строго по prompt -> "
          f"submit_result(\"{job_id}\", result)")
    return 0


def _cmd_needs_show(args: argparse.Namespace) -> int:
    from . import needs

    job = needs.load_job(args.job_id)
    p = job["params"]
    print(f"{job['job_id']} ({job['type']}) ветка {p['root']!r}, фраз {len(p['nodes'])}")
    if job.get("error"):
        print(f"  ошибка агента: {job['error']}")
    if not job.get("result"):
        print("  ответа ещё нет")
        return 0
    cov = needs.coverage(p, job["result"])
    print(f"  работ: {cov['works']}, сегментов: {cov['segments']}")
    print(f"  покрытие: {cov['placed']}/{cov['given']} фраз размещено; "
          f"потеряно {cov['missing_count']}, выдумано {cov['invented_count']}")
    for key in ("missing", "invented", "both_work_and_excluded"):
        if cov[key]:
            print(f"    {key}: {cov[key]}")
    for w in job["result"].get("works") or []:
        mark = " ЩЕЛЬ" if w.get("gap_candidate") else ""
        occ = f" занято: {w['occupied_by']}" if w.get("occupied_by") else ""
        print(f"    {w.get('top_freq', 0):>7} / {w.get('phrase_count', 0):>3}  "
              f"{w.get('name')}{mark}{occ}")
    return 0


def _cmd_needs_diff(args: argparse.Namespace) -> int:
    from . import needs

    job = needs.load_job(args.job_id)
    if not job.get("result"):
        print(f"в джобе {args.job_id} нет ответа агента"
              + (f" (ошибка: {job['error']})" if job.get("error") else ""))
        return 1
    if args.ref_job:
        other = needs.load_job(args.ref_job)
        if not other.get("result"):
            print(f"в джобе {args.ref_job} нет ответа агента")
            return 1
        ref = needs.as_reference(other["result"], source=args.ref_job)
    else:
        ref = needs.load_reference(args.ref)
    print(json.dumps(needs.compare(ref, job["result"]), ensure_ascii=False, indent=1))
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

    job = sub.add_parser("needs-job", help="собрать ветку из БД и завести локальный джоб needs")
    job.add_argument("phrase", help="фраза-корень ветки")
    job.add_argument("--min-freq", dest="min_freq", type=int, default=50,
                     help="нижняя граница частоты (по умолчанию FLOOR=50)")
    job.add_argument("--max-freq", dest="max_freq", type=int, default=None,
                     help="верхняя граница; 30000 = отрезать голову")
    job.add_argument("--tag", default="", help="метка в имени джоба, напр. версия промпта")
    job.set_defaults(func=_cmd_needs_job)

    show = sub.add_parser("needs-show", help="джоб: вход, ответ агента, полнота покрытия")
    show.add_argument("job_id")
    show.set_defaults(func=_cmd_needs_show)

    diff = sub.add_parser("needs-diff", help="сверить ответ агента с эталоном или с другим прогоном")
    diff.add_argument("job_id")
    diff.add_argument("--ref", help="имя файла в reference/ или путь к эталону")
    diff.add_argument("--ref-job", dest="ref_job",
                      help="сверять с другим локальным джобом (прогон против прогона)")
    diff.set_defaults(func=_cmd_needs_diff)
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    raise SystemExit(args.func(args))


if __name__ == "__main__":
    main()
