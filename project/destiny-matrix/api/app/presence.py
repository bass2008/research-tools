"""Кто сейчас на сайте и когда в последний раз появлялся авторизованный пользователь.

Пульсы приходят раз в 45 секунд. Текущий онлайн целиком живёт в памяти, а последнее появление
зарегистрированных пользователей накапливается по ``user_id`` и одним коммитом сбрасывается в БД
раз в час. Так частый служебный сигнал не создаёт постоянную запись в WAL.
"""
from __future__ import annotations

import datetime as dt
import logging
import re
import threading
import time

from sqlalchemy import or_, update

from .config import settings
from .db import SessionLocal
from .models import User, utcnow

WINDOW = 90            # столько секунд отметка считается свежей: пульс раз в 45 с плюс запас
LIMIT = 5_000          # больше одновременных гостей не ждём; предел держит память конечной
FLUSH_INTERVAL_SECONDS = settings.presence_flush_seconds

ROBOT = re.compile(r"bot|crawler|spider|headless|phantom|curl|wget|python-requests|go-http|scan",
                   re.I)

_lock = threading.Lock()
_seen: dict[tuple[str, str], tuple[float, str, bool, str]] = {}
_user_lock = threading.Lock()
_user_seen: dict[int, dt.datetime] = {}
_thread_lock = threading.Lock()
_thread: threading.Thread | None = None
log = logging.getLogger("presence")


def touch(visitor: str, path: str, agent: str = "", now: float | None = None,
          tab: str | None = None) -> None:
    stamp = time.time() if now is None else now
    robot = bool(ROBOT.search(agent))
    # Старый клиент не присылает tab: его visitor раньше был уникален как раз для вкладки.
    key = (visitor, tab or visitor)
    with _lock:
        if len(_seen) >= LIMIT and key not in _seen:
            _drop_stale(stamp)
            if len(_seen) >= LIMIT:
                return
        _seen[key] = (stamp, path[:200], robot, visitor)


def touch_user(user_id: int, when: dt.datetime | None = None) -> None:
    """Запомнить только самую свежую отметку пользователя в текущем часовом окне."""
    stamp = when or utcnow()
    with _user_lock:
        previous = _user_seen.get(user_id)
        if previous is None or stamp > previous:
            _user_seen[user_id] = stamp


def flush(session_factory=None) -> int:
    """Атомарно забрать часовой буфер и записать его одним коммитом.

    Условие в UPDATE не даёт более старому буферу другого API-воркера затереть свежее время.
    При ошибке БД пакет возвращается в память и будет повторён в следующем цикле.
    """
    with _user_lock:
        pending = dict(_user_seen)
        _user_seen.clear()
    if not pending:
        return 0

    factory = session_factory or SessionLocal
    changed = 0
    try:
        with factory() as db:
            for user_id, stamp in pending.items():
                result = db.execute(
                    update(User)
                    .where(User.id == user_id)
                    .where(or_(User.last_seen_at.is_(None), User.last_seen_at < stamp))
                    .values(last_seen_at=stamp)
                )
                changed += int(result.rowcount or 0)
            db.commit()
    except Exception:
        with _user_lock:
            for user_id, stamp in pending.items():
                current = _user_seen.get(user_id)
                if current is None or stamp > current:
                    _user_seen[user_id] = stamp
        raise
    return changed


def _flush_loop() -> None:
    while True:
        time.sleep(FLUSH_INTERVAL_SECONDS)
        try:
            flush()
        except Exception:  # noqa: BLE001 — фоновая отметка не должна уронить API
            log.exception("последнее появление пользователей не записано; повторим через час")


def start() -> threading.Thread:
    """Запустить ровно один почасовой сброс на процесс API."""
    global _thread
    with _thread_lock:
        if _thread is None or not _thread.is_alive():
            _thread = threading.Thread(target=_flush_loop, name="last-seen", daemon=True)
            _thread.start()
            log.info("последнее появление записывается каждые %s с", FLUSH_INTERVAL_SECONDS)
        return _thread


def _drop_stale(now: float) -> None:
    for key in [k for k, (seen, _, _, _) in _seen.items() if now - seen > WINDOW]:
        _seen.pop(key, None)


def _fresh(now: float | None = None) -> list[tuple[float, str, bool, str]]:
    stamp = time.time() if now is None else now
    with _lock:
        _drop_stale(stamp)
        return list(_seen.values())


def online(now: float | None = None) -> int:
    return len({visitor for _, _, robot, visitor in _fresh(now) if not robot})


def tabs(now: float | None = None) -> int:
    return sum(1 for _, _, robot, _ in _fresh(now) if not robot)


def robots(now: float | None = None) -> int:
    return len({visitor for _, _, robot, visitor in _fresh(now) if robot})


def pages(now: float | None = None, top: int = 5) -> list[dict]:
    counts: dict[str, tuple[set[str], int]] = {}
    for _, path, robot, visitor in _fresh(now):
        if not robot:
            people, opened = counts.setdefault(path, (set(), 0))
            people.add(visitor)
            counts[path] = (people, opened + 1)
    best = sorted(counts.items(), key=lambda kv: (-kv[1][1], kv[0]))[:top]
    return [
        {"path": path, "people": len(people), "tabs": opened}
        for path, (people, opened) in best
    ]


def forget() -> None:
    with _lock:
        _seen.clear()
    with _user_lock:
        _user_seen.clear()
