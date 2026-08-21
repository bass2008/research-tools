"""Печать PDF: права, очередь, повторное нажатие. Сам Chromium в тестах не поднимаем — печать
подменяется, потому что проверяем не браузер, а контракт вокруг него."""
from __future__ import annotations

import pytest
from sqlalchemy import select

from app import reports
from app.models import ReportJob
from app.security import create_print_token


@pytest.fixture
def printing(monkeypatch):
    """Печать и хранилище — заглушками; список вызовов возвращаем наружу."""
    calls = {"render": [], "upload": []}
    monkeypatch.setattr(reports.settings, "browser_url", "http://browser:3001")
    monkeypatch.setattr(reports.settings, "s3_reports_bucket", "test-bucket")
    monkeypatch.setattr(reports.settings, "s3_access_key", "key")
    monkeypatch.setattr(reports, "render", lambda url: calls["render"].append(url) or b"%PDF-1.4 test")
    monkeypatch.setattr(reports, "upload", lambda key, pdf: calls["upload"].append((key, len(pdf))))
    monkeypatch.setattr(reports, "link", lambda key: f"https://bucket.example/{key}?sig=1")
    return calls


def buy(client, email="pdf@example.ru", birth="1990-01-01"):
    paid = client.post("/api/payments/mock",
                       json={"tariff": "single", "email": email, "birth": birth}).json()
    return {"Authorization": f"Bearer {paid['token']}"}, paid["matrix_id"]


def test_render_prints_and_stores(client, db, printing):
    headers, mid = buy(client)
    r = client.post("/api/reports/render", json={"matrix_id": mid}, headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "done" and body["cached"] is False and body["url"].startswith("https://")
    # печатали страницу печати с пропуском, а не обычный разбор
    assert f"/print/report?m={mid}&t=" in printing["render"][0]
    job = db.scalars(select(ReportJob)).one()
    assert job.status == "done" and job.object_key.endswith(f"/{job.id}.pdf")
    assert job.size_bytes == len(b"%PDF-1.4 test") and job.seconds() is not None


def test_second_click_returns_the_same_file(client, db, printing):
    headers, mid = buy(client, "again@example.ru")
    first = client.post("/api/reports/render", json={"matrix_id": mid}, headers=headers).json()
    second = client.post("/api/reports/render", json={"matrix_id": mid}, headers=headers).json()
    assert second["cached"] is True and second["job_id"] == first["job_id"]
    # повторное нажатие не печатает заново: один вызов браузера на две кнопки
    assert len(printing["render"]) == 1
    assert len(db.scalars(select(ReportJob)).all()) == 1


def test_unpaid_matrix_is_402(client, auth, printing):
    headers = auth("free@example.ru")
    saved = client.post("/api/matrices", json={"birth": "1991-02-02", "sex": "f"},
                        headers=headers).json()
    r = client.post("/api/reports/render", json={"matrix_id": saved["id"]}, headers=headers)
    assert r.status_code == 402 and "не оплачен" in r.json()["detail"]
    assert printing["render"] == []


def test_someone_elses_matrix_is_404(client, auth, printing):
    _, mid = buy(client, "owner@example.ru")
    stranger = auth("stranger@example.ru")
    r = client.post("/api/reports/render", json={"matrix_id": mid}, headers=stranger)
    assert r.status_code == 404


def test_failed_print_keeps_the_reason(client, db, printing, monkeypatch):
    headers, mid = buy(client, "broken@example.ru")

    def boom(_url):
        raise reports.RenderError("браузер недоступен: timed out")

    monkeypatch.setattr(reports, "render", boom)
    r = client.post("/api/reports/render", json={"matrix_id": mid}, headers=headers)
    assert r.status_code == 502
    job = db.scalars(select(ReportJob)).one()
    assert job.status == "failed" and "timed out" in job.error and job.finished_at is not None


def test_print_page_needs_matching_pass(client, db):
    headers, mid = buy(client, "pass@example.ru")
    uid = client.get("/api/auth/me", headers=headers).json()["user"]["id"]
    good = create_print_token(mid, uid)
    r = client.get(f"/api/reports/page/{mid}?t={good}")
    assert r.status_code == 200 and r.json()["unlocked"] is True and r.json()["birth"]
    # пропуск на другую матрицу к этой не подходит
    other = create_print_token(mid + 999, uid)
    assert client.get(f"/api/reports/page/{mid}?t={other}").status_code == 403
    assert client.get(f"/api/reports/page/{mid}?t=nonsense").status_code == 401


def test_print_disabled_without_browser(client, monkeypatch):
    headers, mid = buy(client, "off@example.ru")
    monkeypatch.setattr(reports.settings, "browser_url", "")
    r = client.post("/api/reports/render", json={"matrix_id": mid}, headers=headers)
    assert r.status_code == 503


def test_admin_sees_the_queue(client, auth, db, printing):
    from app.config import settings
    headers, mid = buy(client, "queue@example.ru")
    client.post("/api/reports/render", json={"matrix_id": mid}, headers=headers)
    admin = auth(settings.admins[0])
    body = client.get("/api/admin/reports", headers=admin).json()
    assert body["running"] == 0 and body["failed"] == 0
    assert [row["email"] for row in body["items"]] == ["queue@example.ru"]
