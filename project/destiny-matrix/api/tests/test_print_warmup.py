"""Прогрев печати: после оплаты разбор печатается сам, к нажатию файл уже готов.

Здесь фоновый пул подменён синхронным: тесты проверяют решения («печатать ли», «второй раз или
готовый файл»), а не гонки потоков. Настоящая асинхронность — в браузерных сценариях на стенде
(e2e/test_report_and_admin.py), где работает живой процесс и настоящий Chromium.
"""
from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app import monitor, printing, report_check, reports, startup
from app.config import settings
from app.models import ReportJob, User


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
    monkeypatch.setattr(reports, "link", lambda key, filename=None: f"https://bucket/{key}")
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


def test_granted_matrix_is_printed_too(client, db, printer, auth):
    """Матрица, выданная админом без оплаты: печать должна начаться так же, как после покупки."""
    client.post("/api/payments/mock",
                json={"tariff": "single", "email": "gift@example.ru", "birth": "1990-05-05"})
    target = db.query(User).filter(User.email == "gift@example.ru").one().id
    printer.clear()

    given = client.post(f"/api/admin/users/{target}/matrices",
                        json={"birth": "1984-03-17", "sex": "m"}, headers=auth(settings.admins[0]))

    assert given.status_code == 200, given.text
    job = db.scalars(select(ReportJob).where(ReportJob.matrix_id == given.json()["id"])).one()
    assert job.status == "done", f"печать не дошла до конца: {job.status} {job.error}"
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


def test_pulse_does_not_count_one_print_twice(client, db, printer, monkeypatch):
    """Пульс показывал «1 печатается, 1 в очереди» на одну печать: печатающийся прогрев числился и
    в идущих, и в наборе прогревов «в работе», который админка подписывала как очередь."""
    seen: list[dict] = []
    original = reports.render
    # читаем именно пульс, а не счётчики печати: дефект был в том, какое число админка называет
    # очередью, а не в самих счётчиках
    monkeypatch.setattr(reports, "render",
                        lambda url: (seen.append(monitor.snapshot(db)["print"]), original(url))[1])

    buy(client, "pulse@example.ru", "1993-08-08")

    assert seen, "печать не запускалась — проверять нечего"
    active, waiting = seen[0]["active"], seen[0]["waiting"]
    assert active == 1, f"идущих печатей {active}, ожидалась одна"
    assert waiting == 0, (
        f"во время единственной печати очередь показывает {waiting}: "
        "та же печать посчитана дважды")


def test_release_reprints_stale_pdfs_once(client, db, printer):
    """Поднятый PDF_REVISION: старый файл перепечатан при старте, повторный старт ничего не делает."""
    buy(client)
    old = db.scalars(select(ReportJob)).one()
    old.object_key = "v0/" + old.object_key.split("/", 1)[1]
    db.commit()

    assert printing.reprint_stale() == 1
    db.expire_all()
    jobs = db.scalars(select(ReportJob).order_by(ReportJob.id)).all()
    assert [j.status for j in jobs] == ["expired", "done"]
    assert jobs[1].object_key.startswith(f"{printing.PDF_REVISION}/")
    assert len(printer) == 2
    assert printing.reprint_stale() == 0


def test_failed_reprint_is_retried_and_keeps_the_old_file(client, db, printer, monkeypatch):
    buy(client)
    old = db.scalars(select(ReportJob)).one()
    old.object_key = "v0/" + old.object_key.split("/", 1)[1]
    db.commit()
    monkeypatch.setattr(printing, "REPRINT_PAUSE_SECONDS", 0)
    monkeypatch.setattr(reports, "render", lambda url: (_ for _ in ()).throw(RuntimeError("web ещё не поднялся")))

    printing.reprint_stale()
    db.expire_all()
    statuses = [j.status for j in db.scalars(select(ReportJob).order_by(ReportJob.id))]
    assert statuses == ["done"] + ["failed"] * printing.REPRINT_ATTEMPTS
    assert printing.reprint_stale() == 1, "неудачная перепечатка должна повториться при следующем старте"


def test_startup_waits_for_web_before_reprinting(client, db, printer, monkeypatch):
    """On a release the API came up before web: the first print failed on an unresolved host."""
    buy(client)
    old = db.scalars(select(ReportJob)).one()
    old.object_key = "v0/" + old.object_key.split("/", 1)[1]
    db.commit()
    answers = iter([False, False, True])
    monkeypatch.setattr(startup, "web_ready", lambda: next(answers))
    monkeypatch.setattr(startup, "WEB_POLL_SECONDS", 0)

    startup.when_web_is_up()
    db.expire_all()
    assert [j.status for j in db.scalars(select(ReportJob).order_by(ReportJob.id))] == ["expired", "done"]
    assert len(printer) == 2


def test_startup_postpones_reprint_while_web_is_down(client, db, printer, monkeypatch):
    buy(client)
    old = db.scalars(select(ReportJob)).one()
    old.object_key = "v0/" + old.object_key.split("/", 1)[1]
    db.commit()
    monkeypatch.setattr(startup, "web_ready", lambda: False)
    monkeypatch.setattr(startup, "WEB_WAIT_SECONDS", 0)
    monkeypatch.setattr(startup, "WEB_POLL_SECONDS", 0)

    startup.when_web_is_up()
    db.expire_all()
    assert [j.status for j in db.scalars(select(ReportJob))] == ["done"], "без сайта печать не начинается"
    assert len(printer) == 1
    assert len(printing.stale()) == 1, "отложенная перепечатка должна повториться при следующем старте"


def test_startup_does_not_wait_for_web_without_stale_pdfs(client, db, printer, monkeypatch):
    buy(client)
    monkeypatch.setattr(startup, "web_ready", lambda: pytest.fail("ждать сайт незачем"))

    startup.when_web_is_up()
    assert len(printer) == 1


def test_reprint_skips_a_report_the_owner_already_reprinted(client, db, printer):
    buy(client)
    fresh = db.scalars(select(ReportJob)).one()
    stale = ReportJob(user_id=fresh.user_id, matrix_id=fresh.matrix_id, locale=fresh.locale,
                      status="done", object_key="v0/old.pdf", size_bytes=1)
    db.add(stale)
    db.commit()

    assert printing.reprint_stale() == 1
    db.expire_all()
    assert len(printer) == 1, "свежий файл уже был — второй печати быть не должно"
    assert db.get(ReportJob, stale.id).status == "expired"
    assert db.get(ReportJob, fresh.id).status == "done"


def test_report_check_does_not_wait_for_wiped_local_pdfs(client, db, printer, monkeypatch, tmp_path, capsys):
    """Test contour: local PDFs are wiped on restart and never reprinted, so there is nothing to wait for."""
    buy(client)
    old = db.scalars(select(ReportJob)).one()
    old.object_key = "v0/" + old.object_key.split("/", 1)[1]
    db.commit()
    monkeypatch.setattr(report_check.settings, "reports_store", "local")
    monkeypatch.setattr(report_check.settings, "reports_dir", str(tmp_path))
    monkeypatch.setattr(report_check, "SessionLocal", printing.SessionLocal)
    monkeypatch.setattr("sys.argv", ["report_check", "--wait", "900"])
    monkeypatch.setattr(report_check.time, "sleep", lambda s: pytest.fail("waited for a wiped PDF"))

    assert report_check.main() == 0
    assert "стёрты при перезапуске 1" in capsys.readouterr().out
