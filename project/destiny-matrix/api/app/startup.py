from __future__ import annotations

import logging
import threading
import time
import urllib.request

from . import monitor, presence, printing
from .config import settings

log = logging.getLogger("arcana.startup")

WEB_WAIT_SECONDS = 300
WEB_POLL_SECONDS = 5


def startup() -> None:
    """Всё, что API делает при старте. Работа, которой нужен сайт, ждёт его в фоне: API поднимается
    на релизе раньше сайта, и печать, отправленная сразу, падает на ненайденном адресе."""
    monitor.start()
    presence.start()
    threading.Thread(target=when_web_is_up, name="startup", daemon=True).start()


def when_web_is_up() -> None:
    if not printing.stale():
        return
    if not wait_for_web():
        log.warning("сайт не ответил за %s с — перепечатка отложена до следующего старта", WEB_WAIT_SECONDS)
        return
    printing.reprint_stale()


def web_ready() -> bool:
    try:
        with urllib.request.urlopen(f"{settings.web_internal_url.rstrip('/')}/health", timeout=3) as response:
            return response.status == 200
    except Exception:                              # noqa: BLE001
        return False


def wait_for_web() -> bool:
    deadline = time.monotonic() + WEB_WAIT_SECONDS
    while not web_ready():
        if time.monotonic() >= deadline:
            return False
        time.sleep(WEB_POLL_SECONDS)
    return True
