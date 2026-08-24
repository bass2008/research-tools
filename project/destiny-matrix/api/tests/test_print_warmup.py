"""Прогрев печати: после оплаты разбор печатается сам, к нажатию файл уже готов.

Здесь фоновый пул подменён синхронным: тесты проверяют решения («печатать ли», «второй раз или
готовый файл»), а не гонки потоков. Настоящая асинхронность — в браузерных сценариях на стенде
(e2e/test_report_and_admin.py), где работает живой процесс и настоящий Chromium.
"""
from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app import printing, reports
from app.models import ReportJob


class Inline:
    """Пул, который выполняет работу на месте: тесту не нужно ждать поток."""

    def submit(self, work, *args):
        work(*args)


@pytest.fixture
def printer(monkeypatch, db_engine, no_warmup):    # no_warmup первым: иначе он гасит прогрев после нас
    """Печать без браузера и без хранилища, прогрев — синхронный."""
    monkeypatch.setattr(reports.settings, "browser_url", "http://browser:3001")
    monkeypatch.setattr(reports.settings, "s3_reports_bucket", "test-bucket")
    monkeypatch.setattr(reports.settings, "s3_access_key", "key")
    monkeypatch.setattr(reports, "upload", lambda key, pdf: None)
    monkeypatch.setattr(reports, "link", lambda key: f"https://bucket/{key}")
    monkeypatch.setattr(printing.settings, "print_warmup", True)
    monkeypatch.setattr(printing, "_pool", Inline())
    monkeypatch.setattr(printing, "SessionLocal",
                        sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False))

    calls: list[str] = []
    monkeypatch.setattr(reports, "render", lambda url: (calls.append(url), b"%PDF-1.4 warm")[1])
    return calls


def buy(client, email="warm@example.ru", birth="1990-05-05"):
    body = client.post("/api/payments/mock",
                       json={"tariff": "single", "email": email, "birth": birth}).json()
    return body, {"Authorization": f"Bearer {body['token']}"}


def test_payment_starts_printing_by_itself(client, db, printer):
    """Человек только оплатил и никуда не нажимал — файл напечатан и лежит в хранилище."""
    buy(client)

    job = db.scalars(select(ReportJob)).one()
    assert job.status == "done", f"печать не дошла до конца: {job.status} {job.error}"
    assert job.object_key and job.size_bytes, "файл не сохранён"
    assert len(printer) == 1, f"рендеров: {len(printer)}"


def test_button_after_warmup_answers_from_cache(client, db, printer):
    """Нажатие после прогрева отдаёт готовый файл, а не печатает заново."""
    body, headers = buy(client, "warm2@example.ru", "1991-06-06")

    answer = client.post("/api/reports/render", json={"matrix_id": body["matrix_id"]},
                         headers=headers)
    assert answer.status_code == 200, answer.text
    assert answer.json()["cached"] is True, "второй рендер вместо готового файла"
    assert len(printer) == 1, f"рендеров: {len(printer)} — печатали дважды"
    assert len(db.scalars(select(ReportJob)).all()) == 1, "задач печати больше одной"


def test_warmup_does_not_print_the_same_report_twice(client, db, printer):
    """Повторное уведомление провайдера не запускает вторую печать: право выдаётся один раз."""
    body, headers = buy(client, "warm3@example.ru", "1992-07-07")

    again = client.post("/api/payments/sync", json={"order_id": body["order_id"]},
                        headers=headers)
    assert again.status_code == 200, again.text
    assert again.json()["paid"] is True

    assert len(printer) == 1, f"рендеров: {len(printer)} — повторная сверка напечатала снова"
    assert len(db.scalars(select(ReportJob)).all()) == 1


def test_warmup_can_be_switched_off(client, db, printer, monkeypatch):
    """Выключенный прогрев ничего не печатает: оплата остаётся оплатой."""
    monkeypatch.setattr(printing.settings, "print_warmup", False)
    body, headers = buy(client, "warm4@example.ru", "1993-08-08")

    assert db.scalars(select(ReportJob)).all() == [], "прогрев работал при выключенной настройке"
    assert printer == []
    me = client.get("/api/auth/me", headers=headers).json()
    assert me["access"]["scopes"], "доступ не выдан"


def test_failed_warmup_does_not_break_the_purchase(client, db, printer, monkeypatch):
    """Браузер упал — доступ всё равно выдан, а неудача видна в очереди печати."""
    def broken(url):
        raise reports.RenderError("браузер недоступен")

    monkeypatch.setattr(reports, "render", broken)
    body, headers = buy(client, "warm5@example.ru", "1994-09-09")
    assert body["paid"] is True

    job = db.scalars(select(ReportJob)).one()
    assert job.status == "failed" and job.error, f"неудача печати не записана: {job.status}"
    me = client.get("/api/auth/me", headers=headers).json()
    assert me["access"]["scopes"], f"доступ пропал: {me['access']}"


def test_warmup_waits_for_a_free_slot(monkeypatch):
    """Мест печати ограниченное число: когда все заняты, работа ждёт, а не идёт мимо очереди."""
    import threading

    monkeypatch.setattr(printing, "_slots", threading.BoundedSemaphore(1))
    monkeypatch.setattr(printing.settings, "print_wait_seconds", 1)
    printing._slots.acquire()                      # место занято другой печатью

    with pytest.raises(printing.Busy):
        printing.run(None, 1, 1)

    printing._slots.release()
