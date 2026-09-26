"""Что происходит с машиной и с продуктом прямо сейчас.

Метрики виртуалки (процессор, диски, сеть) облако собирает само, а память гостя ему не видна —
её и всё прикладное (онлайн, печать, платежи, ошибки) отправляем отсюда. Агента на машине нет
намеренно: при 2 ГБ памяти лишний процесс дороже, чем один POST раз в минуту.
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import os
import re
import threading
import time
import urllib.error
import urllib.request

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import payments as gateway
from . import printing
from .config import settings
from .db import SessionLocal
from .models import ErrorLog, Payment, ReportJob, as_utc, utcnow, iso

log = logging.getLogger("monitor")

METADATA = "http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token"
WRITE_URL = "https://monitoring.api.cloud.yandex.net/monitoring/v2/data/write"
NGINX_LOG = "/var/log/nginx/access.log"
LOG_LINE = re.compile(r'^(\S+) \S+ \S+ \[([^\]]+)\].*?" \d+ (\d+) "[^"]*" "([^"]*)"')


def memory() -> dict:
    """Память гостя: гипервизор её не видит, поэтому читаем сами."""
    values: dict[str, int] = {}
    with open("/proc/meminfo", encoding="utf-8") as f:
        for line in f:
            name, _, rest = line.partition(":")
            if name in ("MemTotal", "MemAvailable", "SwapTotal", "SwapFree"):
                values[name] = int(rest.strip().split()[0])
    total = values.get("MemTotal", 0)
    free = values.get("MemAvailable", 0)
    used = max(total - free, 0)
    swap_total = values.get("SwapTotal", 0)
    swap_used = max(swap_total - values.get("SwapFree", 0), 0)
    return {"total_mb": total // 1024, "used_mb": used // 1024,
            "percent": round(used * 100 / total, 1) if total else 0.0,
            "swap_total_mb": swap_total // 1024, "swap_used_mb": swap_used // 1024,
            "swap_percent": round(swap_used * 100 / swap_total, 1) if swap_total else 0.0}


def _cpu_ticks() -> tuple[int, int]:
    """Занятые и все тики процессора с загрузки машины: строка `cpu` из `/proc/stat`."""
    with open("/proc/stat", encoding="utf-8") as f:
        fields = [int(x) for x in f.readline().split()[1:9]]
    total = sum(fields)
    return total - fields[3] - fields[4], total


CPU_WINDOW = 60
_cpu_marks: list[tuple[float, int, int]] = []


def cpu() -> dict:
    """Загрузка процессора за последнюю минуту — доля занятых тиков, 0–100 % на ядро.

    Раньше здесь печатался `load1 * 100 / ядра`, и на одном ядре панель показывала «136 %».
    Load — длина очереди, а не проценты: он считает и тех, кто ждёт диск, и превышает сотню
    там, где процессор наполовину свободен.

    Окно фиксированное, а не «от прошлого опроса»: админку опрашивают раз в десять секунд,
    фоновый мониторинг — раз в минуту, и при общей отметке интервал зависел бы от того, кто
    спросил последним. Храним снимки и считаем от самого раннего в пределах минуты; пока
    истории меньше, окно короче, и настоящую длину отдаём рядом с числом.
    """
    now = time.time()
    busy, total = _cpu_ticks()
    _cpu_marks.append((now, busy, total))
    while len(_cpu_marks) > 2 and _cpu_marks[1][0] >= now - CPU_WINDOW:
        _cpu_marks.pop(0)
    while len(_cpu_marks) > 120:
        _cpu_marks.pop(0)

    first = _cpu_marks[0]
    window_ticks = total - first[2]
    percent = round((busy - first[1]) * 100 / window_ticks, 1) if window_ticks > 0 else 0.0
    window_seconds = round(now - first[0], 1)

    with open("/proc/loadavg", encoding="utf-8") as f:
        one, five, fifteen = f.read().split()[:3]
    cores = os.cpu_count() or 1
    return {"load1": float(one), "load5": float(five), "load15": float(fifteen),
            "cores": cores, "percent": percent, "window_seconds": window_seconds}


# Контейнеры соседних контуров видны только через хостовые cgroup: имя и потребление лежат в
# разных местах, поэтому каталог docker монтируется на чтение (`HOST_CONTAINERS`), а счётчики —
# из `HOST_CGROUP`. Без монтирования разбивки просто нет, общая загрузка машины остаётся.
HOST_CGROUP = "/host/cgroup"
HOST_CONTAINERS = "/host/containers"
# Где лежат счётчики контейнера, зависит от того, кто ими управляет: systemd на сервере кладёт
# их в `system.slice/docker-<id>.scope`, Docker Desktop — в `docker/<id>`.
CGROUP_LAYOUTS = ("{root}/system.slice/docker-{cid}.scope", "{root}/docker/{cid}")

_container_mark: dict[str, tuple[float, int]] = {}


def _container_metadata() -> dict[str, dict[str, str]]:
    """Имя и compose-проект из метаданных Docker, без доступа к его сокету."""
    metadata: dict[str, dict[str, str]] = {}
    try:
        ids = os.listdir(HOST_CONTAINERS)
    except OSError:
        return metadata
    for cid in ids:
        try:
            with open(f"{HOST_CONTAINERS}/{cid}/config.v2.json", encoding="utf-8") as f:
                config = json.load(f)
            labels = (config.get("Config") or {}).get("Labels") or {}
            metadata[cid] = {
                "name": config.get("Name", "").lstrip("/") or cid[:12],
                "project": labels.get("com.docker.compose.project", ""),
            }
        except (OSError, ValueError):
            continue
    return metadata


def containers() -> list[dict]:
    """Сколько процессора и памяти ест каждый контейнер: доля за время с прошлого опроса."""
    rows: list[dict] = []
    now = time.time()
    for cid, metadata in _container_metadata().items():
        base = next((path for path in
                     (layout.format(root=HOST_CGROUP, cid=cid) for layout in CGROUP_LAYOUTS)
                     if os.path.isdir(path)), None)
        if base is None:
            continue
        try:
            with open(f"{base}/cpu.stat", encoding="utf-8") as f:
                usec = next(int(line.split()[1]) for line in f if line.startswith("usage_usec"))
            with open(f"{base}/memory.current", encoding="utf-8") as f:
                memory_bytes = int(f.read().strip())
        except (OSError, StopIteration, ValueError):
            continue
        percent = 0.0
        was = _container_mark.get(cid)
        if was:
            elapsed = now - was[0]
            if elapsed > 0.5:
                percent = round((usec - was[1]) / (elapsed * 10_000), 1)
        _container_mark[cid] = (now, usec)
        rows.append({**metadata, "percent": percent,
                     "memory_mb": round(memory_bytes / 2**20)})
    return sorted(rows, key=lambda r: -r["percent"])


def contours(rows: list[dict]) -> list[dict]:
    """Основной и тестовый сайты определяются проектом Compose, а не языком в имени."""
    groups = (
        ("Основной сайт", "arcana"),
        ("Тестовый сайт", "arcana-test"),
    )
    out = []
    for title, project in groups:
        mine = [r for r in rows if r.get("project") == project]
        if mine:
            out.append({"title": title,
                        "percent": round(sum(r["percent"] for r in mine), 1),
                        "memory_mb": sum(r["memory_mb"] for r in mine),
                        "items": mine})
    known = {r["name"] for g in out for r in g["items"]}
    rest = [r for r in rows if r["name"] not in known]
    if rest:
        out.append({"title": "Прочее", "percent": round(sum(r["percent"] for r in rest), 1),
                    "memory_mb": sum(r["memory_mb"] for r in rest), "items": rest})
    return out


def disk(path: str = "/") -> dict:
    st = os.statvfs(path)
    total = st.f_blocks * st.f_frsize
    free = st.f_bavail * st.f_frsize
    used = total - free
    # проценты и подписи в панели говорят об одном и том же — о занятом месте; свободное оставляем
    # рядом, потому что решение «чистить или нет» принимается по нему
    return {"path": path, "total_gb": round(total / 2**30, 1), "free_gb": round(free / 2**30, 1),
            "used_gb": round(used / 2**30, 1),
            "percent": round(used * 100 / total, 1) if total else 0.0}


def _data_dir() -> str:
    """Каталог базы: у него свой том, и кончиться он может раньше корня. Адрес разбираем движком —
    в строке подключения есть имя драйвера (sqlite+pysqlite), и разбор «по префиксу» его терял."""
    from sqlalchemy.engine import make_url

    try:
        path = make_url(settings.database_url).database
    except Exception:                              # noqa: BLE001 — путь не важнее работы сборщика
        return "/"
    folder = os.path.dirname(path or "")
    return folder if folder and os.path.isdir(folder) else "/"


def errors(db: Session, minutes: int = 10) -> int:
    since = utcnow() - dt.timedelta(minutes=minutes)
    return db.scalar(select(func.count(ErrorLog.id)).where(ErrorLog.at >= since)) or 0


def last_errors(db: Session, limit: int = 20) -> list[dict]:
    rows = db.scalars(select(ErrorLog).order_by(ErrorLog.id.desc()).limit(limit)).all()
    return [row.item() for row in rows]


def stuck_payments(db: Session, minutes: int = 30) -> int:
    """Платежи, застрявшие на форме банка: человек ушёл, деньги не дошли. Какие статусы считать
    незавершёнными, решает провайдер — знание о банке в этот модуль не переезжает."""
    edge = utcnow() - dt.timedelta(minutes=minutes)
    rows = db.scalars(select(Payment).where(Payment.paid_at.is_(None),
                                            Payment.refunded_at.is_(None))).all()
    return sum(1 for p in rows if as_utc(p.created_at) < edge
               and (provider := gateway.for_payment(p)) is not None and provider.reusable(p.status))


def print_failures(db: Session, hours: int = 1) -> int:
    since = utcnow() - dt.timedelta(hours=hours)
    return db.scalar(select(func.count(ReportJob.id))
                     .where(ReportJob.status == "failed", ReportJob.created_at >= since)) or 0


def crawlers(hours: int = 1, path: str = NGINX_LOG) -> list[dict] | None:
    """Кто обходит сайт. Читаем лог nginx, если он смонтирован: краулеры ходят по страницам,
    которые печатает web, и до api не доходят — иначе их не увидеть вовсе."""
    if not os.path.exists(path):
        return None
    edge = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=hours)
    counts: dict[str, list[int]] = {}
    try:
        with open(path, "rb") as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            back = min(size, 40 * 2**20)              # хвост в 40 МБ: час обхода в него влезает
            f.seek(-back, os.SEEK_END)
            lines = f.read().decode("utf-8", "replace").splitlines()
        if back < size:
            lines = lines[1:]                         # первая строка обрезана серединой — не разбираем
    except OSError as exc:
        log.warning("лог nginx не прочитан: %s", exc)
        return None
    for line in lines:
        found = LOG_LINE.match(line)
        if not found:
            continue
        when, size, agent = found.group(2), found.group(3), found.group(4)
        try:
            stamp = dt.datetime.strptime(when, "%d/%b/%Y:%H:%M:%S %z")
        except ValueError:
            continue
        if stamp < edge:
            continue
        name = _crawler_name(agent)
        if name is None:
            continue
        seen = counts.setdefault(name, [0, 0])
        seen[0] += 1
        seen[1] += int(size)
    best = sorted(counts.items(), key=lambda kv: -kv[1][0])[:10]
    return [{"bot": name, "requests": n, "mb": round(size / 2**20, 1)} for name, (n, size) in best]


KNOWN = ("GPTBot", "ClaudeBot", "CCBot", "AhrefsBot", "Googlebot", "YandexBot", "Amazonbot",
         "Amzn-SearchBot", "MJ12bot", "SemrushBot", "PerplexityBot", "OAI-SearchBot",
         "ChatGPT-User", "bingbot", "Applebot", "DotBot", "PetalBot", "serpstatbot")


def _crawler_name(agent: str) -> str | None:
    for name in KNOWN:
        if name.lower() in agent.lower():
            return name
    return "прочие роботы" if presence_robot(agent) else None


def presence_robot(agent: str) -> bool:
    from .presence import ROBOT
    return bool(ROBOT.search(agent))


def snapshot(db: Session, with_crawlers: bool = True) -> dict:
    """Полная картина для админки и для отправки в облако."""
    from . import presence

    return {
        "at": iso(utcnow()),
        "memory": memory(),
        "cpu": cpu(),
        "contours": contours(containers()),
        "disk": disk("/"),
        "data_disk": disk(_data_dir()),
        "online": {"people": presence.online(), "tabs": presence.tabs(),
                   "robots": presence.robots(),
                   "pages": presence.pages()},
        "print": {"active": printing.active(), "waiting": printing.waiting(),
                  "failures_hour": print_failures(db)},
        "payments": {"stuck": stuck_payments(db)},
        "errors": {"last10min": errors(db, 10), "hour": errors(db, 60)},
        "crawlers": crawlers() if with_crawlers else None,
        "version": settings.build_commit,
    }


def numbers(state: dict) -> dict[str, float]:
    """Что уезжает в облако: только числа, без путей, адресов и имён."""
    return {
        "memory_percent": state["memory"]["percent"],
        "memory_used_mb": state["memory"]["used_mb"],
        "cpu_percent": state["cpu"]["percent"],
        "disk_percent": state["disk"]["percent"],
        "data_disk_percent": state["data_disk"]["percent"],
        "online_people": state["online"]["people"],
        "online_tabs": state["online"]["tabs"],
        "online_robots": state["online"]["robots"],
        "print_active": state["print"]["active"],
        "print_waiting": state["print"]["waiting"],
        "print_failures_hour": state["print"]["failures_hour"],
        "payments_stuck": state["payments"]["stuck"],
        "http_5xx_10min": state["errors"]["last10min"],
    }


_token: tuple[str, float] | None = None
_token_lock = threading.Lock()


def iam_token() -> str | None:
    """Токен сервисного аккаунта из метаданных виртуалки: ключей в файлах не держим."""
    global _token
    with _token_lock:
        if _token and _token[1] > time.time() + 60:
            return _token[0]
    request = urllib.request.Request(METADATA, headers={"Metadata-Flavor": "Google"})
    try:
        with urllib.request.urlopen(request, timeout=5) as answer:
            body = json.loads(answer.read())
    except (OSError, ValueError) as exc:
        log.warning("IAM-токен не получен: %s", exc)
        return None
    token, ttl = body.get("access_token"), int(body.get("expires_in", 600))
    if not token:
        return None
    with _token_lock:
        _token = (token, time.time() + ttl)
    return token


def push(values: dict[str, float]) -> bool:
    if not settings.monitoring_folder:
        return False
    token = iam_token()
    if not token:
        return False
    body = {"metrics": [{"name": name, "value": float(value)} for name, value in values.items()]}
    request = urllib.request.Request(
        f"{WRITE_URL}?folderId={settings.monitoring_folder}&service=custom",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(request, timeout=10) as answer:
            answer.read()
        return True
    except urllib.error.HTTPError as exc:
        log.warning("метрики не приняты (%s): %s", exc.code, exc.read()[:200])
    except OSError as exc:
        log.warning("метрики не отправлены: %s", exc)
    return False


def collect_and_push() -> bool:
    """Один цикл сбора. Ошибка отправки не должна касаться сайта, поэтому глушится здесь."""
    try:
        with SessionLocal() as db:
            state = snapshot(db, with_crawlers=False)
        return push(numbers(state))
    except Exception as exc:                       # noqa: BLE001 — сторож не имеет права падать
        log.warning("сбор метрик не удался: %s", exc)
        return False


def start() -> threading.Thread | None:
    if not settings.monitoring_folder:
        log.info("метрики никуда не отправляются: MONITORING_FOLDER не задан")
        return None

    def loop() -> None:
        while True:
            collect_and_push()
            time.sleep(settings.monitoring_interval_seconds)

    thread = threading.Thread(target=loop, name="monitor", daemon=True)
    thread.start()
    return thread
