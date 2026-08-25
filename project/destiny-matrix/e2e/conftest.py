"""Браузерные сценарии: ходим по сайту так, как ходит человек — кликами, без подмены состояния.

Стенд поднимается заранее (compose/scripts/run.sh) и должен работать на мок-оплате:
PAYMENT_PROVIDER=mock, иначе тесты уйдут на живую форму банка.
"""
from __future__ import annotations

import os
import pathlib
import subprocess
import uuid

import pytest
from playwright.sync_api import Page, sync_playwright

BASE = os.environ.get("E2E_URL", "http://127.0.0.1:3000")
ADMIN = (os.environ.get("E2E_ADMIN", "snborodaenko@mail.ru"), os.environ.get("E2E_ADMIN_PASSWORD", "123"))

# Тестовый контур закрыт паролем на уровне nginx: боты и посторонние получают 401 вместо страниц.
# Прогоны про пароль знать не должны — читаем его сами из того же файла, где живут ключи банка.
# На локальном стенде пароля нет, файла может не быть: тогда ходим без него.
CREDENTIALS_FILE = pathlib.Path.home() / ".config" / "arcana" / "test-auth.env"


def _gate() -> tuple[str, str] | None:
    user = os.environ.get("E2E_BASIC_USER")
    if user:
        return user, os.environ.get("E2E_BASIC_PASSWORD", "")
    if "127.0.0.1" in BASE or "localhost" in BASE or not CREDENTIALS_FILE.exists():
        return None
    values: dict[str, str] = {}
    for line in CREDENTIALS_FILE.read_text().splitlines():
        name, _, value = line.partition("=")
        values[name.strip()] = value.strip().strip("'\"")
    if values.get("TEST_BASIC_USER"):
        return values["TEST_BASIC_USER"], values.get("TEST_BASIC_PASSWORD", "")
    return None


GATE = _gate()


def pytest_configure(config):
    import urllib.request
    try:
        # health открыт без пароля намеренно: снаружи должно быть видно, что контур жив
        urllib.request.urlopen(f"{BASE}/api/health", timeout=5)
    except OSError as exc:
        raise pytest.UsageError(f"стенд не отвечает на {BASE}: {exc}. Поднимите compose/scripts/run.sh")


# Счётчик Метрики в прогонах не должен срабатывать: иначе один цикл добавляет к статистике сайта
# восемь десятков «посетителей» с адреса машины, и отчёты перестают показывать живых людей.
# Глушим подменой адресов, а не перехватом запросов: перехват включает обработку всей сети в
# Playwright и под нагрузкой полного прогона регистрация не успевала за таймаут.
COUNTERS = "MAP mc.yandex.ru 0.0.0.0, MAP mc.yandex.com 0.0.0.0, MAP mc.webvisor.org 0.0.0.0"


def _credentials() -> dict | None:
    return None if GATE is None else {"username": GATE[0], "password": GATE[1]}


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as pw:
        instance = pw.chromium.launch(args=["--no-sandbox", f"--host-resolver-rules={COUNTERS}"])
        yield instance
        instance.close()


@pytest.fixture
def page(browser) -> Page:
    context = browser.new_context(viewport={"width": 1360, "height": 950}, locale="ru-RU",
                                  http_credentials=_credentials())
    page = context.new_page()
    page.set_default_timeout(15_000)
    yield page
    context.close()


@pytest.fixture
def mail() -> str:
    return f"e2e-{uuid.uuid4().hex[:10]}@example.ru"


@pytest.fixture
def api_log():
    """Письма на стенде не уходят по SMTP, а пишутся в лог — оттуда берём ссылку на сброс."""
    compose = pathlib.Path(__file__).resolve().parent.parent / "compose" / "docker-compose.yml"

    def read(pattern: str) -> str | None:
        out = subprocess.run(["docker", "compose", "-f", str(compose),
                              "logs", "--no-log-prefix", "--tail", "3000", "api"],
                             capture_output=True, text=True).stdout
        found = [line for line in out.splitlines() if pattern in line]
        return found[-1] if found else None
    return read


@pytest.fixture
def api_notify():
    """Послать стенду подписанное уведомление — то, что банк не может доставить на 127.0.0.1."""
    compose = pathlib.Path(__file__).resolve().parent.parent / "compose" / "docker-compose.yml"

    def send(payment_id: str, status: str = "CONFIRMED") -> str:
        done = subprocess.run(["docker", "compose", "-f", str(compose), "exec", "-T", "api",
                               "python", "-m", "app.selfnotify", str(payment_id), status],
                              capture_output=True, text=True)
        assert done.returncode == 0, done.stderr or done.stdout
        return done.stdout.strip()
    return send
