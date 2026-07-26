#!/usr/bin/env python3
"""Фикстуры браузерных E2E (testing-plan §8).

Каждый сценарий получает: свежую засеянную БД, свой uvicorn на свободном порту и
СОБРАННЫЙ фронт, который отдаёт сам сервер, — тот же путь, что в бою.

Изоляция сделана «экземпляром приложения»: во временном каталоге лежат симлинки на
настоящие `server.py`/`tasks.py`/`wscore.py`/`frontend`/`task-worker-mcp`, своя копия
засеянной БД, свои `logs/` и `reports/`. `ROOT` у модулей считается от `__file__`, поэтому
боевые `semcore.db` и `logs/drill.log` тесты не трогают вообще.

LLM подменён фальшивым воркером (`e2e_worker.py`), XMLRiver — режимом
`XMLRIVER_CACHE_ONLY=1` плюс засеянной таблицей `serp`: платных запросов ноль (§3.1).

Артефакты падения (трассировка, скриншот, видео Playwright плюс `drill.log`,
вывод uvicorn и состояние воркера) складываются в каталог `--output`.
"""
import ctypes
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
import warnings
from pathlib import Path

import httpx
import pytest

import e2e_worker
import seed

E2E = Path(__file__).resolve().parent
ROOT = E2E.parent

TOKEN = "e2e-internal-token"          # общий секрет внутренних эндпоинтов на время теста
LLM_TIMEOUT = "20"                    # секунд: фальшивый воркер отвечает мгновенно
SERVER_START = 40                     # секунд на старт uvicorn
POLL = 0.05
LINKED = ("server.py", "tasks.py", "wscore.py", "task-worker-mcp", "frontend")

ENV_FILE = """# .env тестового экземпляра: боевых ключей здесь нет и быть не может
XMLRIVER_USER=e2e
XMLRIVER_KEY=e2e
XMLRIVER_YANDEX_URL=http://127.0.0.1:9/search_yandex/xml
XMLRIVER_GOOGLE_URL=http://127.0.0.1:9/search/xml
XMLRIVER_CACHE_ONLY=1
"""


# ---------- опции прогона ----------

def pytest_configure(config):
    config.addinivalue_line("markers",
                            "server_env(**env): переменные окружения для uvicorn этого теста")
    # на падении сохраняем трассировку, скриншот и видео (testing-plan §8 «Как гонять»)
    for opt, val in (("tracing", "retain-on-failure"), ("screenshot", "only-on-failure"),
                     ("video", "retain-on-failure")):
        if getattr(config.option, opt, None) in (None, "off"):
            setattr(config.option, opt, val)


@pytest.hookimpl(wrapper=True, tryfirst=True)
def pytest_runtest_makereport(item, call):
    rep = yield
    setattr(item, "rep_" + rep.when, rep)   # чтобы фикстура артефактов знала об исходе
    return rep


def _failed(request):
    rep = getattr(request.node, "rep_call", None) or getattr(request.node, "rep_setup", None)
    return rep is not None and rep.failed


# ---------- собранный фронт и шаблон БД (один раз на прогон) ----------

@pytest.fixture(scope="session", autouse=True)
def built_frontend():
    """Фронт берём собранный: `frontend/dist`, тот же артефакт, что раздаёт бой."""
    index = ROOT / "frontend" / "dist" / "index.html"
    if not index.exists():
        pytest.fail(f"нет собранного фронта {index} — соберите: cd frontend && npm run build")
    src = ROOT / "frontend" / "src"
    newest = max((p.stat().st_mtime for p in src.rglob("*")
                  if p.is_file() and "__tests__" not in p.parts
                  and ".test." not in p.name and ".spec." not in p.name), default=0)
    if newest > index.stat().st_mtime:
        warnings.warn(f"frontend/dist старше frontend/src — E2E гоняют предыдущую сборку "
                      f"({index}); пересоберите npm run build")
    return index


@pytest.fixture(scope="session")
def template_db(tmp_path_factory):
    """Засеянная БД-шаблон: копируется в каждый тест, поэтому засев считается один раз."""
    return seed.build(tmp_path_factory.mktemp("seed") / "semcore.db")


# ---------- экземпляр приложения ----------

@pytest.fixture
def instance(tmp_path, template_db, built_frontend):
    """Каталог-экземпляр: настоящий код по симлинкам, своя БД, свои logs/ и reports/."""
    inst = tmp_path / "app"
    inst.mkdir()
    for name in LINKED:
        (inst / name).symlink_to(ROOT / name)
    shutil.copy(E2E / "e2e_app.py", inst / "e2e_app.py")
    shutil.copy(template_db, inst / "semcore.db")
    (inst / "logs").mkdir()
    reports = inst / "reports"
    reports.mkdir()
    for name, html in seed.REPORT_FILES.items():   # засеянные отчёты — файлами на диске
        (reports / name).write_text(html, encoding="utf-8")
    for name, text in seed.needs_files().items():  # деревья потребностей — тоже файлами
        f = inst / "logs" / "needs-lab" / name
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(text, encoding="utf-8")
    (inst / ".env").write_text(ENV_FILE, encoding="utf-8")
    return inst


# ---------- сервер ----------

def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _read(path):
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


PR_SET_PDEATHSIG = 1


def _die_with_parent():   # выполняется в ребёнке между fork и exec
    """Просим ядро прибить сервер, когда умрёт pytest.

    `Server.stop()` снимает процесс при нормальном завершении, но убитый снаружи прогон
    (`timeout`, `kill`) до teardown не доходит и оставляет uvicorn сиротой: один такой
    случай оставил 17 живых серверов на несколько часов. PDEATHSIG срабатывает независимо
    от того, как умер родитель."""
    if sys.platform != "linux":
        return
    ctypes.CDLL("libc.so.6", use_errno=True).prctl(PR_SET_PDEATHSIG, signal.SIGTERM, 0, 0, 0)


class Server:
    """uvicorn в отдельном процессе: старт, перезапуск (сценарий 17), остановка."""

    def __init__(self, inst, port, env=None):
        self.inst = inst
        self.port = port
        self.url = f"http://127.0.0.1:{port}"
        self.extra_env = env or {}
        self.proc = None
        self.out = inst / "uvicorn.log"
        self.drill_log = inst / "logs" / "drill.log"

    def start(self):
        env = {**os.environ, "PYTHONPATH": str(self.inst), "PYTHONUNBUFFERED": "1",
               "APP_URL": self.url, "INTERNAL_TOKEN": TOKEN, "XMLRIVER_CACHE_ONLY": "1",
               "E2E_LLM_TIMEOUT": LLM_TIMEOUT, **self.extra_env}
        with open(self.out, "a", encoding="utf-8") as log:
            self.proc = subprocess.Popen(
                [sys.executable, "-m", "uvicorn", "e2e_app:app",
                 "--host", "127.0.0.1", "--port", str(self.port), "--log-level", "warning"],
                cwd=str(self.inst), env=env, stdout=log, stderr=subprocess.STDOUT,
                preexec_fn=_die_with_parent)
        self._wait_ready()
        return self

    def _wait_ready(self):
        """Готов = отвечает ручка И строка о старте уже в лог-файле (иначе клиент получит
        пустой хвост лога и сценарий 13 станет флаки)."""
        deadline = time.monotonic() + SERVER_START
        started = _read(self.drill_log).count("сервер запущен")
        while time.monotonic() < deadline:
            if self.proc.poll() is not None:
                raise RuntimeError(f"uvicorn упал (код {self.proc.returncode}):\n"
                                   f"{_read(self.out)[-3000:]}")
            try:
                # нейтральная проба: важно, что приложение отвечает, а не бизнес-семантика.
                # (Раньше дёргали /api/estimate и ждали 200 — но на неизвестную фразу он
                # законно отдаёт 404 по tech §6.1, и проба цеплялась за прежнее поведение.)
                r = httpx.get(f"{self.url}/openapi.json", timeout=2.0)
                if r.status_code == 200 and _read(self.drill_log).count("сервер запущен") > started:
                    return
            except httpx.HTTPError:
                pass
            time.sleep(POLL)
        raise RuntimeError(f"сервер не поднялся за {SERVER_START} c:\n{_read(self.out)[-3000:]}")

    def stop(self):
        if self.proc is None:
            return
        self.proc.terminate()
        try:
            self.proc.wait(15)
        except subprocess.TimeoutExpired:
            self.proc.kill()
            self.proc.wait(5)
        self.proc = None

    def restart(self):
        """Перезапуск при открытой странице: клиент должен переподключиться сам."""
        self.stop()
        self.start()

    def log_text(self):
        return _read(self.drill_log)


@pytest.fixture
def server_env(request):
    """Переменные окружения uvicorn: @pytest.mark.server_env(E2E_LLM_TIMEOUT="4")."""
    mark = request.node.get_closest_marker("server_env")
    return dict(mark.kwargs) if mark else {}


@pytest.fixture
def server(instance, server_env):
    srv = Server(instance, free_port(), server_env)
    srv.start()
    yield srv
    srv.stop()


@pytest.fixture
def worker(server):
    """Фальшивая LLM-петля (не запущена: сценарий 18 проверяет именно офлайн)."""
    w = e2e_worker.FakeWorker(server.url, TOKEN)
    yield w
    w.stop()


# ---------- артефакты падения ----------

@pytest.fixture(autouse=True)
def dump_on_failure(request, instance, output_path):
    """Упал тест — В ТОТ ЖЕ каталог, куда Playwright кладёт трассировку, скриншот и видео,
    добавляем лог сервера и состояние фальшивого воркера (testing-plan §12: артефакты
    падения лежат в одном месте)."""
    yield
    if not _failed(request):
        return
    dst = Path(output_path)
    dst.mkdir(parents=True, exist_ok=True)
    for name in ("logs/drill.log", "uvicorn.log"):
        src = instance / name
        if src.exists():
            shutil.copy(src, dst / Path(name).name)
    w = request.node.funcargs.get("worker")
    if isinstance(w, e2e_worker.FakeWorker):
        (dst / "e2e_worker.json").write_text(w.dump(), encoding="utf-8")
