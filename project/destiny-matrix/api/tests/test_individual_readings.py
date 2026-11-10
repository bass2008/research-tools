import pytest
from sqlalchemy import func, select

from app import mail
from app.config import settings
from app.models import Notification
from app.security import create_worker_token

ARTICLE = {"title": "Королю нужен Шут", "lead": "Лид.", "sections": [{"h2": "Глава", "paragraphs": ["Текст."]}]}
REQUEST = {"kind": "personal", "year": None, "inputs": {"birth": "1993-03-31", "sex": "m"}, "locale": "ru",
           "comment": "", "automatic_reading": {"matrix": {"day": 4}, "sections": []}}


@pytest.fixture()
def letters(monkeypatch):
    sent = []
    monkeypatch.setattr(mail, "send", lambda to, subject, body: sent.append((to, subject, body)) or True)
    return sent


@pytest.fixture()
def worker():
    return {"X-Internal-Token": create_worker_token()}


@pytest.fixture()
def request_id(client, auth):
    owner, admin = auth("owner@example.ru"), auth(settings.admins[0])
    me = client.get("/api/auth/me", headers=owner).json()["user"]["id"]
    r = client.post("/api/admin/individual-readings", headers=admin, json={**REQUEST, "userId": me})
    assert r.status_code == 200, r.text
    return r.json()["id"], owner, admin


def test_only_admin_creates_and_only_worker_reads_the_task(client, auth, request_id, worker):
    rid, owner, _ = request_id
    assert client.post("/api/admin/individual-readings", headers=owner, json={**REQUEST, "userId": 1}).status_code == 404
    assert client.get(f"/api/internal/individual-readings/{rid}").status_code == 401
    task = client.get(f"/api/internal/individual-readings/{rid}", headers=worker).json()
    assert task["status"] == "pending" and task["automatic_reading"]["matrix"] == {"day": 4}
    assert task["prompt"].endswith("individual-reading-prompt.md") and "email" not in task
    assert task["created_at"][:4].isdigit()  # the author's check takes the child's age on the order day from it
    assert [x["id"] for x in client.get("/api/internal/individual-readings?status=pending", headers=worker).json()["items"]] == [rid]


def test_draft_is_private_and_out_of_the_cabinet_until_approval(client, auth, request_id, worker):
    rid, owner, admin = request_id
    bad = client.post(f"/api/internal/individual-readings/{rid}/article", headers=worker, json={**ARTICLE, "html": "<b>"})
    assert bad.status_code == 422
    card = {"arcanum": 20, "label": "Под сердцем", "caption": "Подпись."}
    with_cards = lambda points: {**ARTICLE, "sections": [{**ARTICLE["sections"][0], "cards": [{**card, "points": points}]}]}
    url = f"/api/internal/individual-readings/{rid}/article"
    assert client.post(url, headers=worker, json=with_cards(["Z"])).status_code == 422
    assert client.post(url, headers=worker, json=with_cards(["R1"])).json()["status"] == "review"
    chakra = lambda key: {**ARTICLE, "sections": [{"h2": "Чакры", "paragraphs": [{"h3": "Муладхара"}, {"chakra": key}, "Текст."]}]}
    assert client.post(url, headers=worker, json=chakra("heart")).status_code == 422
    assert client.post(url, headers=worker, json=chakra("muladhara")).json()["status"] == "review"
    assert client.post(f"/api/internal/individual-readings/{rid}/article", headers=worker, json=ARTICLE).json()["status"] == "review"
    opened = client.post(f"/api/individual-readings/{rid}/open", headers=owner, json={}).json()
    assert opened["article"]["title"] == ARTICLE["title"] and opened["can_pdf"] is False
    assert client.post(f"/api/individual-readings/{rid}/pdf", headers=owner).status_code == 409
    assert client.post(f"/api/individual-readings/{rid}/pdf", headers=admin).status_code != 409
    assert client.post(f"/api/individual-readings/{rid}/open", headers=auth("stranger@example.ru"), json={}).status_code == 403
    listed = client.get("/api/individual-readings", headers=owner).json()["items"]
    assert [(x["id"], x["status"], x["title"]) for x in listed] == [(rid, "review", None)]


def test_approval_notifies_once_and_the_email_link_opens_only_this_article(client, auth, request_id, worker, letters, db):
    rid, owner, admin = request_id
    assert client.post(f"/api/admin/individual-readings/{rid}/approve", headers=admin).status_code == 409
    client.post(f"/api/internal/individual-readings/{rid}/article", headers=worker, json=ARTICLE)
    done = client.post(f"/api/admin/individual-readings/{rid}/approve", headers=admin).json()
    assert done["status"] == "done" and done["email_errors"] == 0
    assert client.post(f"/api/admin/individual-readings/{rid}/approve", headers=admin).json()["already_approved"]
    assert db.scalar(select(func.count(Notification.id)).where(Notification.type == "individual_reading_ready")) == 1
    (to, subject, body), = [x for x in letters if x[0] == "owner@example.ru" and "индивидуальный" in x[1]]
    token = body.split("#token=")[1].split()[0]
    assert f"/matrix/individual/{rid}#token=" in body
    assert client.post(f"/api/individual-readings/{rid}/open", headers=owner, json={}).json()["can_pdf"] is True
    assert client.post(f"/api/individual-readings/{rid}/open", json={"token": token}).json()["can_pdf"] is False
    stranger = auth("stranger@example.ru")
    assert client.post(f"/api/individual-readings/{rid}/open", headers=stranger, json={"token": token}).json()["can_pdf"] is False
    assert client.post(f"/api/individual-readings/{rid}/pdf", headers=stranger).status_code == 403
    assert client.post(f"/api/individual-readings/{rid}/open", json={"token": "nonsense"}).status_code == 403
    assert client.get("/api/individual-readings", headers=owner).json()["total"] == 1
    fixed = client.post(f"/api/internal/individual-readings/{rid}/article", headers=worker, json={**ARTICLE, "title": "Исправлено"})
    assert fixed.json()["status"] == "done"
    assert client.post(f"/api/individual-readings/{rid}/open", headers=owner, json={}).json()["article"]["title"] == "Исправлено"
    assert db.scalar(select(func.count(Notification.id)).where(Notification.type == "individual_reading_ready")) == 1
    assert len([x for x in letters if x[0] == "owner@example.ru" and "индивидуальный" in x[1]]) == 1


def test_request_opens_the_automatic_reading_as_a_gift(client, request_id, db):
    rid, owner, admin = request_id
    readings = client.get("/api/readings", headers=owner).json()
    items = readings["items"] if isinstance(readings, dict) else readings
    assert [(x["product"], x["inputs"]["birth"]) for x in items] == [("personal", "1993-03-31")]
    assert db.scalar(select(func.count(Notification.id)).where(Notification.type == "reading_available")) == 1
    me = client.get("/api/auth/me", headers=owner).json()["user"]["id"]
    client.post("/api/admin/individual-readings", headers=admin, json={**REQUEST, "userId": me, "comment": "ещё"})
    again = client.get("/api/readings", headers=owner).json()
    assert len(again["items"] if isinstance(again, dict) else again) == 1
    assert db.scalar(select(func.count(Notification.id)).where(Notification.type == "reading_available")) == 1


def test_report_v2_shows_the_saved_chakras_and_tail_unchanged(client, auth):
    owner, admin = auth("owner@example.ru"), auth(settings.admins[0])
    me = client.get("/api/auth/me", headers=owner).json()["user"]["id"]
    chakras = {"layout": "chakras", "chakraRows": [{"key": "muladhara", "title": "Муладхара", "cells": [], "paragraphs": ["Опора."]}]}
    snapshot = {"matrix": {"day": 4}, "sections": [{"key": "chakras", "longform": chakras},
                                                   {"key": "past_lives", "title": "Кармический хвост", "tailReading": {"paragraphs": ["Басня."]}}]}
    rid = client.post("/api/admin/individual-readings", headers=admin,
                      json={**REQUEST, "userId": me, "automatic_reading": snapshot}).json()["id"]
    worker = {"X-Internal-Token": create_worker_token()}
    url = f"/api/internal/individual-readings/{rid}/article"
    match = {"items": [{"arcanum": 4, "label": "Маска", "points": ["A"]}, "=", {"arcanum": 4, "label": "Центр", "points": ["E"]}]}
    report = {"version": 2, "title": "Королю нужен Шут", "lead": "Лид.", "summary": ["Раз.", "Два.", "Три."],
              "chapters": [{"kind": "key", "h2": "Ключ", "conclusion": "Маска и центр совпадают.",
                            "blocks": ["Текст.", {"formula": match}]},
                           {"kind": "chakras", "h2": "Чакры", "conclusion": "Вывод.", "blocks": [{"insert": "chakras"}]}],
              "faq": [{"q": "Что делать с Шутом?", "a": ["Открыть ворота."]}]}
    assert client.post(url, headers=worker, json=report).json()["status"] == "review"
    assert client.post(url, headers=worker, json={**report, "chapters": [{**report["chapters"][0], "kind": "astrology"}]}).status_code == 422
    broken = {"items": [{"arcanum": 4, "label": "Маска", "points": ["Z"]}, "="]}
    assert client.post(url, headers=worker, json={**report, "chapters": [{**report["chapters"][0], "blocks": [{"formula": broken}]}]}).status_code == 422
    assert client.post(url, headers=worker, json={**report, "sections": []}).status_code == 422
    opened = client.post(f"/api/individual-readings/{rid}/open", headers=admin, json={}).json()
    assert opened["article"]["chapters"][0]["blocks"][1]["formula"]["items"][1] == "="
    assert opened["inserts"] == {"chakras": chakras, "karmic_tail": {"title": "Кармический хвост", "paragraphs": ["Басня."]}}
