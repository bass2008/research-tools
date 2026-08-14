from sqlalchemy import func, select

from app.models import Lead


def test_lead_is_saved(client, db):
    r = client.post("/api/leads", json={"email": "lead@example.ru", "source": "hero"})
    assert r.status_code == 200
    assert r.json() == {"ok": True}
    lead = db.scalar(select(Lead).where(Lead.email == "lead@example.ru"))
    assert lead.source == "hero"


def test_lead_is_idempotent(client, db):
    for _ in range(3):
        r = client.post("/api/leads", json={"email": "Same@Example.RU", "source": "hero"})
        assert r.json() == {"ok": True}
    assert db.scalar(select(func.count(Lead.id))) == 1
    assert db.scalar(select(Lead)).email == "same@example.ru"


def test_source_fills_in_later(client, db):
    client.post("/api/leads", json={"email": "later@example.ru"})
    client.post("/api/leads", json={"email": "later@example.ru", "source": "plans"})
    lead = db.scalar(select(Lead).where(Lead.email == "later@example.ru"))
    assert lead.source == "plans"
    assert db.scalar(select(func.count(Lead.id))) == 1


def test_lead_without_source(client, db):
    assert client.post("/api/leads", json={"email": "bare@example.ru"}).status_code == 200
    assert db.scalar(select(Lead).where(Lead.email == "bare@example.ru")).source is None


def test_broken_email_is_422(client, db):
    assert client.post("/api/leads", json={"email": "nope"}).status_code == 422
    assert client.post("/api/leads", json={}).status_code == 422
    assert db.scalar(select(func.count(Lead.id))) == 0
