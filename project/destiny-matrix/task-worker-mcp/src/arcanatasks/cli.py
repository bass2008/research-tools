"""    arcana-tasks mcp                       # stdio MCP-сервер (его поднимает Claude Code)
    arcana-tasks wait-jobs                 # до 60 с ждёт задачи на всех стендах; печатает [{job_id, type}]
    arcana-tasks get-job test:1            # то же, что MCP get_job: данные и промпт
    arcana-tasks submit test:1 result.json # то же, что MCP submit_result; --error "причина" вместо файла
"""
from __future__ import annotations

import argparse
import json
import sys
import time

POLL = 2.0            # пауза между опросами стендов


def _wait_jobs(args: argparse.Namespace) -> int:
    from . import client
    from .config import config_dir, stands

    found = list(stands().values())
    if not found:
        print(f"стендов нет: положи {config_dir()}/worker-<стенд>.env", file=sys.stderr)
        return 1
    deadline = time.monotonic() + args.timeout
    reached = False
    while True:
        jobs, failed = [], 0
        for stand in found:
            try:
                jobs += client.watch(stand, max_jobs=args.max_jobs)
            except client.AppError as exc:
                failed += 1
                print(f"{stand.name}: {exc}", file=sys.stderr)
        if jobs:
            print(json.dumps(jobs, ensure_ascii=False), flush=True)
            return 0
        reached = reached or failed < len(found)
        now = time.monotonic()
        if now >= deadline:
            if not reached:
                print(f"ни один стенд не ответил за {args.timeout:.0f} с", file=sys.stderr)
                return 1
            print("[]", flush=True)
            return 0
        time.sleep(min(POLL, deadline - now))


def main() -> int:
    parser = argparse.ArgumentParser(prog="arcana-tasks")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("mcp")
    wait = sub.add_parser("wait-jobs")
    wait.add_argument("--max-jobs", type=int, default=8)
    wait.add_argument("--timeout", type=float, default=60, help="секунд; по умолчанию 60")
    job = sub.add_parser("get-job")
    job.add_argument("job_id")
    submit = sub.add_parser("submit")
    submit.add_argument("job_id")
    submit.add_argument("result", nargs="?", help="JSON-файл с результатом")
    submit.add_argument("--error")
    args = parser.parse_args()
    if args.cmd == "mcp":
        from . import mcp_server
        mcp_server.main()
        return 0
    if args.cmd in ("get-job", "submit"):
        from pathlib import Path
        from . import mcp_server
        if args.cmd == "get-job":
            answer = mcp_server.get_job(args.job_id)
        elif bool(args.result) == bool(args.error):
            parser.error("нужен ровно один из: файл результата или --error")
        else:
            result = json.loads(Path(args.result).read_text(encoding="utf-8")) if args.result else None
            answer = mcp_server.submit_result(args.job_id, result=result, error=args.error)
        print(json.dumps(answer, ensure_ascii=False, indent=1))
        return 0 if "error" not in answer or answer.get("accepted") else 1
    try:
        return _wait_jobs(args)
    except KeyboardInterrupt:
        return 130
