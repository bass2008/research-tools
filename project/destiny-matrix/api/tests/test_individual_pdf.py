import json

import pytest
from sqlalchemy import select

from app import individual_readings, reports
from app.config import settings
from app.models import IndividualReading, User

ARTICLE = {"title": "Королю нужен Шут", "lead": "Лид.", "sections": [{"h2": "Глава", "paragraphs": ["Текст."]}]}


@pytest.fixture()
def reading(client, auth, db):
    owner = auth("owner@example.ru")
    user = db.scalar(select(User).where(User.email == "owner@example.ru"))
    row = IndividualReading(user_id=user.id, product="personal", kind="personal", inputs=json.dumps({"birth": "1993-03-31", "sex": "m"}),
                            automatic_reading=json.dumps({"matrix": {}}), status="done", title=ARTICLE["title"],
                            article=json.dumps(ARTICLE, ensure_ascii=False))
    db.add(row)
    db.commit()
    return row, owner


@pytest.fixture()
def printer(monkeypatch):
    files, rendered = {}, []
    monkeypatch.setattr(type(settings), "pdf_enabled", property(lambda self: True))
    monkeypatch.setattr(reports, "render", lambda url: rendered.append(url) or b"%PDF-1.7")
    monkeypatch.setattr(reports, "upload", lambda key, pdf: files.__setitem__(key, pdf))
    monkeypatch.setattr(reports, "link", lambda key, filename=None: f"https://files.test/{key}?name={filename}")
    monkeypatch.setattr(reports, "store", lambda: type("Store", (), {"exists": lambda self, key: key in files})())
    return files, rendered


def test_owner_gets_pdf_once_and_reuses_the_file(client, reading, printer):
    row, owner = reading
    files, rendered = printer
    first = client.post(f"/api/individual-readings/{row.id}/pdf", headers=owner)
    assert first.status_code == 200, first.text
    assert first.json()["url"].endswith("name=Королю нужен Шут.pdf")
    assert len(rendered) == 1 and f"/print/individual?r={row.id}&t=" in rendered[0]
    again = client.post(f"/api/individual-readings/{row.id}/pdf", headers=owner)
    assert again.json()["url"] == first.json()["url"]
    assert len(rendered) == 1 and len(files) == 1


def test_pdf_is_private(client, auth, reading, printer):
    row, _ = reading
    assert client.post(f"/api/individual-readings/{row.id}/pdf").status_code == 401
    assert client.post(f"/api/individual-readings/{row.id}/pdf", headers=auth("stranger@example.ru")).status_code == 403
    assert printer[1] == []


def test_print_page_needs_a_pass_for_this_reading(client, reading, db):
    row, _ = reading
    ok = client.get(f"/api/individual-readings/{row.id}/print", params={"t": individual_readings.print_token(row)})
    assert ok.status_code == 200 and ok.json()["article"]["title"] == ARTICLE["title"]
    email_pass = individual_readings.link_token(row.id, row.user_id)
    assert client.get(f"/api/individual-readings/{row.id}/print", params={"t": email_pass}).status_code == 403
    other = IndividualReading(user_id=row.user_id, product="personal", kind="personal", inputs=row.inputs,
                              automatic_reading=row.automatic_reading, status="done", article=row.article)
    db.add(other)
    db.commit()
    assert client.get(f"/api/individual-readings/{other.id}/print", params={"t": individual_readings.print_token(row)}).status_code == 403



class Inline:
    def submit(self, fn, *args):
        fn(*args)


def test_only_a_published_article_is_printed_ahead(client, auth, db, db_engine, printer, monkeypatch):
    from sqlalchemy.orm import sessionmaker
    from app import printing
    from app.security import create_worker_token
    files, rendered = printer
    monkeypatch.setattr(printing.settings, "print_warmup", True)
    monkeypatch.setattr(printing, "_pool", Inline())
    monkeypatch.setattr(individual_readings, "SessionLocal", sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False))
    owner, admin, worker = auth("owner@example.ru"), auth(settings.admins[0]), {"X-Internal-Token": create_worker_token()}
    me = client.get("/api/auth/me", headers=owner).json()["user"]["id"]
    request = {"kind": "personal", "year": None, "inputs": {"birth": "1993-03-31", "sex": "m"}, "locale": "ru", "comment": "",
               "automatic_reading": {"matrix": {"day": 4}, "sections": []}, "userId": me}
    created = client.post("/api/admin/individual-readings", headers=admin, json=request)
    assert created.status_code == 200, created.text
    rid = created.json()["id"]
    client.post(f"/api/internal/individual-readings/{rid}/article", headers=worker, json=ARTICLE)
    individual = lambda: [url for url in rendered if "/print/individual" in url]
    assert individual() == []
    client.post(f"/api/admin/individual-readings/{rid}/approve", headers=admin)
    assert len(individual()) == 1
    assert client.post(f"/api/individual-readings/{rid}/pdf", headers=owner).status_code == 200 and len(individual()) == 1
    client.post(f"/api/internal/individual-readings/{rid}/article", headers=worker, json={**ARTICLE, "title": "Исправлено"})
    assert len(individual()) == 2


def test_admin_preview_is_the_print_page_itself(client, auth, reading):
    row, owner = reading
    assert client.get(f"/api/admin/individual-readings/{row.id}/preview", headers=owner).status_code == 404
    url = client.get(f"/api/admin/individual-readings/{row.id}/preview", headers=auth(settings.admins[0])).json()["url"]
    assert url.startswith(f"/ru/print/individual?r={row.id}&t=")
    page = client.get(f"/api/individual-readings/{row.id}/print", params={"t": url.split("&t=")[1]})
    assert page.status_code == 200 and page.json()["article"]["title"] == ARTICLE["title"]


def test_anyone_gets_the_example_pdf_printed_once_per_language(client, printer):
    files, rendered = printer
    first = client.post("/api/individual-examples/pair/pdf", headers={"Accept-Language": "ru"})
    assert first.status_code == 200, first.text
    assert first.json()["url"].endswith("name=Пример разбора — совместимость пары.pdf")
    assert len(rendered) == 1 and rendered[0].endswith("/ru/print/individual?example=pair")
    assert client.post("/api/individual-examples/pair/pdf", headers={"Accept-Language": "ru"}).json() == first.json()
    assert len(rendered) == 1
    english = client.post("/api/individual-examples/pair/pdf", headers={"Accept-Language": "en"})
    assert english.json()["url"].endswith("name=Sample reading — couple compatibility.pdf")
    assert len(rendered) == 2 and len(files) == 2


def test_an_unknown_example_prints_nothing(client, printer):
    assert client.post("/api/individual-examples/secret/pdf").status_code == 404
    assert printer[1] == []
