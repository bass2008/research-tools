"""Мониторинг: что видит админка и что уезжает в облако.

Сеть здесь не трогаем — отправка метрик проверяется отдельно и без неё: сборщик обязан работать
на стенде без облака, иначе локальная разработка зависела бы от чужого сервиса.
"""
from __future__ import annotations

import datetime as dt
import time

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app import monitor, presence
from app.config import settings
from app.models import ErrorLog, Payment, User, as_utc, utcnow


@pytest.fixture(autouse=True)
def empty_presence():
    presence.forget()
    yield
    presence.forget()


@pytest.fixture
def journal(monkeypatch, db_engine):
    """Журнал ошибок пишет через свой SessionLocal — направляем его в тестовую базу."""
    from app import errors

    monkeypatch.setattr(errors, "SessionLocal",
                        sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False))
    return errors


def test_data_dir_follows_the_database(monkeypatch, tmp_path):
    """Том с базой считается отдельно от корня: у него свой диск, и кончиться он может раньше.
    В строке подключения есть имя драйвера (sqlite+pysqlite), и разбор по префиксу его терял."""
    monkeypatch.setattr(monitor.settings, "database_url", f"sqlite+pysqlite:///{tmp_path}/api.db")
    assert monitor._data_dir() == str(tmp_path)

    monkeypatch.setattr(monitor.settings, "database_url", "sqlite+pysqlite:////нет/такого/api.db")
    assert monitor._data_dir() == "/"


def test_machine_numbers_look_sane():
    """Память гостя облако не видит, поэтому читаем сами — и значения обязаны быть осмысленными."""
    ram, load, space = monitor.memory(), monitor.cpu(), monitor.disk("/")

    assert ram["total_mb"] > 100 and 0 <= ram["percent"] <= 100
    assert ram["used_mb"] <= ram["total_mb"]
    assert load["cores"] >= 1 and load["load1"] >= 0
    assert space["total_gb"] > 0 and 0 <= space["percent"] <= 100


def test_pulse_counts_people_apart_from_robots(client):
    client.post("/api/pulse", json={"visitor": "человек-один", "path": "/"})
    client.post("/api/pulse", json={"visitor": "человек-два", "path": "/report"})
    client.post("/api/pulse", json={"visitor": "робот-краулер", "path": "/"},
                headers={"User-Agent": "Mozilla/5.0 (compatible; GPTBot/1.0)"})

    assert presence.online() == 2, "робот попал в число людей"
    assert presence.robots() == 1
    assert {"path": "/", "people": 1, "tabs": 1} in presence.pages(), presence.pages()


def test_five_tabs_of_one_browser_are_one_person(client):
    """Один браузер может смотреть несколько страниц: это один человек, но пять вкладок."""
    for index, path in enumerate(["/", "/", "/", "/account", "/admin"], start=1):
        answer = client.post(
            "/api/pulse",
            json={"visitor": "один-браузер", "tab": f"вкладка-{index}", "path": path},
        )
        assert answer.status_code == 200

    assert presence.online() == 1
    assert presence.tabs() == 5
    assert presence.pages() == [
        {"path": "/", "people": 1, "tabs": 3},
        {"path": "/account", "people": 1, "tabs": 1},
        {"path": "/admin", "people": 1, "tabs": 1},
    ]


def test_authenticated_pulse_is_buffered_until_hourly_flush(client, auth, db, db_engine):
    """45-секундный pulse не пишет users немедленно: за час остаётся один пакетный UPDATE."""
    headers = auth("seen@example.ru")
    user = db.scalar(select(User).where(User.email == "seen@example.ru"))
    assert user is not None and user.last_seen_at is None

    before = utcnow()
    answer = client.post(
        "/api/pulse",
        json={"visitor": "видел-пользователя", "tab": "вкладка-пользователя", "path": "/account"},
        headers=headers,
    )
    assert answer.status_code == 200
    db.refresh(user)
    assert user.last_seen_at is None, "pulse записал БД немедленно вместо часового буфера"

    maker = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)
    assert presence.FLUSH_INTERVAL_SECONDS == 3600
    assert presence.flush(maker) == 1
    db.refresh(user)
    assert user.last_seen_at is not None and as_utc(user.last_seen_at) >= before
    assert presence.flush(maker) == 0, "сброшенный пакет остался в памяти"


def test_last_seen_flush_keeps_latest_value_across_workers(auth, db, db_engine):
    """Старый пакет другого воркера не должен откатить уже записанное новое появление."""
    auth("latest@example.ru")
    user = db.scalar(select(User).where(User.email == "latest@example.ru"))
    assert user is not None
    old = dt.datetime(2026, 8, 30, 8, 0, tzinfo=dt.timezone.utc)
    latest = old + dt.timedelta(minutes=50)
    maker = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)

    presence.touch_user(user.id, latest)
    presence.touch_user(user.id, old)
    assert presence.flush(maker) == 1
    db.refresh(user)
    assert as_utc(user.last_seen_at) == latest

    presence.touch_user(user.id, old)
    assert presence.flush(maker) == 0
    db.refresh(user)
    assert as_utc(user.last_seen_at) == latest


def test_anonymous_pulse_does_not_create_user_update(client, db_engine):
    answer = client.post("/api/pulse", json={"visitor": "гость-без-сессии", "path": "/"})
    assert answer.status_code == 200
    maker = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)
    assert presence.flush(maker) == 0

def test_presence_forgets_those_who_left():
    """Отметка живёт 90 секунд: ушедший из вкладки перестаёт считаться сам."""
    long_ago = time.time() - presence.WINDOW - 5
    presence.touch("ушёл", "/", "", now=long_ago)
    presence.touch("остался", "/", "")

    assert presence.online() == 1


def test_stuck_payment_is_visible(client, db):
    """Человек ушёл с формы банка — деньги не дошли, и это видно без похода в банк."""
    from app import payments as gateway

    client.post("/api/payments/start",
                json={"tariff": "single", "email": "stuck@example.ru", "birth": "1990-01-01"})
    payment = db.scalars(select(Payment)).one()
    assert monitor.stuck_payments(db) == 0, "свежий платёж застрявшим не считается"

    payment.paid_at = None
    payment.status = "NEW"
    payment.created_at = payment.created_at - dt.timedelta(hours=2)
    db.commit()

    provider = gateway.active()
    expected = 1 if provider is not None and provider.reusable("NEW") else 0
    assert monitor.stuck_payments(db) == expected


def test_failures_are_written_without_personal_data(client, db, journal):
    """Пятисотка попадает в журнал: путь и текст ошибки есть, тела запроса и почты — нет."""
    app = client.app

    @app.get("/api/boom")
    def boom():
        raise RuntimeError("сломалось внутри")

    answer = client.get("/api/boom")
    assert answer.status_code == 500

    row = db.scalars(select(ErrorLog)).one()
    assert row.status == 500 and row.path == "/api/boom" and row.method == "GET"
    assert "сломалось внутри" in row.message
    assert row.trace and len(row.trace) <= 800
    assert monitor.errors(db, 10) == 1


def test_snapshot_shows_everything_the_admin_needs(client, db, auth):
    admin = auth(settings.admins[0])
    body = client.get("/api/admin/pulse", headers=admin).json()

    for key in ("memory", "cpu", "disk", "data_disk", "online", "print", "payments", "errors"):
        assert key in body, f"в сводке нет раздела {key}"
    assert body["online"]["people"] >= 0 and body["online"]["tabs"] >= body["online"]["people"]
    assert body["print"]["active"] >= 0
    assert client.get("/api/admin/pulse", headers=auth("stranger@example.ru")).status_code == 404


def test_only_numbers_leave_the_machine(client, db):
    """В облако уезжают числа, а не пути, адреса и имена страниц."""
    state = monitor.snapshot(db, with_crawlers=False)
    values = monitor.numbers(state)

    assert values and all(isinstance(v, (int, float)) for v in values.values())
    assert "memory_percent" in values and "payments_stuck" in values
    text = " ".join(map(str, values.values()))
    assert "/" not in text and "@" not in text


def test_nothing_is_sent_without_a_folder(monkeypatch):
    """Без настройки облака сборщик молчит и в сеть не ходит: так работает локальный стенд."""
    monkeypatch.setattr(monitor.settings, "monitoring_folder", "")
    monkeypatch.setattr(monitor, "iam_token", lambda: pytest.fail("сборщик полез за токеном"))

    assert monitor.push({"memory_percent": 42.0}) is False
    assert monitor.start() is None


def test_crawlers_are_counted_from_the_nginx_log(tmp_path):
    """Краулеры ходят по страницам, до api не доходят — считаем их по логу nginx."""
    now = dt.datetime.now(dt.timezone.utc).strftime("%d/%b/%Y:%H:%M:%S %z")
    old = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=5)).strftime("%d/%b/%Y:%H:%M:%S %z")
    log = tmp_path / "access.log"
    log.write_text("\n".join([
        f'1.1.1.1 - - [{now}] "GET / HTTP/1.1" 200 5000 "-" "Mozilla/5.0 (compatible; GPTBot/1.1)"',
        f'1.1.1.1 - - [{now}] "GET /a HTTP/1.1" 200 1000 "-" "Mozilla/5.0 (compatible; GPTBot/1.1)"',
        f'2.2.2.2 - - [{now}] "GET / HTTP/1.1" 200 2000 "-" "Mozilla/5.0 (compatible; AhrefsBot/7)"',
        f'3.3.3.3 - - [{now}] "GET / HTTP/1.1" 200 3000 "-" "Mozilla/5.0 (Macintosh) Safari/605"',
        f'4.4.4.4 - - [{old}] "GET / HTTP/1.1" 200 9000 "-" "Mozilla/5.0 (compatible; GPTBot/1.1)"',
    ]) + "\n")

    found = monitor.crawlers(hours=1, path=str(log))
    assert found is not None
    counts = {row["bot"]: row["requests"] for row in found}
    assert counts.get("GPTBot") == 2, f"старая строка попала в час или свежие потерялись: {found}"
    assert counts.get("AhrefsBot") == 1
    assert "прочие роботы" not in counts, "человек посчитан роботом"


def test_no_nginx_log_is_not_an_error():
    assert monitor.crawlers(path="/нет/такого/файла") is None
