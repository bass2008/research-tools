"""Кто сейчас на сайте.

Держим в памяти процесса, а не в базе: запись раз в 45 секунд на каждого посетителя базе в WAL
не нужна, а история присутствия никому не нужна — важно только «сейчас». Цена — сброс при
перезапуске и то, что при нескольких воркерах каждый считает своих.
"""
from __future__ import annotations

import re
import threading
import time

WINDOW = 90            # столько секунд отметка считается свежей: пульс раз в 45 с плюс запас
LIMIT = 5_000          # больше одновременных гостей не ждём; предел держит память конечной

ROBOT = re.compile(r"bot|crawler|spider|headless|phantom|curl|wget|python-requests|go-http|scan",
                   re.I)

_lock = threading.Lock()
_seen: dict[str, tuple[float, str, bool]] = {}


def touch(visitor: str, path: str, agent: str = "", now: float | None = None) -> None:
    stamp = time.time() if now is None else now
    robot = bool(ROBOT.search(agent))
    with _lock:
        if len(_seen) >= LIMIT and visitor not in _seen:
            _drop_stale(stamp)
            if len(_seen) >= LIMIT:
                return
        _seen[visitor] = (stamp, path[:200], robot)


def _drop_stale(now: float) -> None:
    for key in [k for k, (seen, _, _) in _seen.items() if now - seen > WINDOW]:
        _seen.pop(key, None)


def _fresh(now: float | None = None) -> list[tuple[float, str, bool]]:
    stamp = time.time() if now is None else now
    with _lock:
        _drop_stale(stamp)
        return list(_seen.values())


def online(now: float | None = None) -> int:
    return sum(1 for _, _, robot in _fresh(now) if not robot)


def robots(now: float | None = None) -> int:
    return sum(1 for _, _, robot in _fresh(now) if robot)


def pages(now: float | None = None, top: int = 5) -> list[dict]:
    counts: dict[str, int] = {}
    for _, path, robot in _fresh(now):
        if not robot:
            counts[path] = counts.get(path, 0) + 1
    best = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:top]
    return [{"path": path, "people": count} for path, count in best]


def forget() -> None:
    with _lock:
        _seen.clear()
