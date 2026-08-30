"""Доверенная цепочка адреса клиента: nginx → BFF → FastAPI → security_audit."""
from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app import audit
from app.models import SecurityAudit
from app.config import settings


@pytest.fixture
def audit_db(monkeypatch, db_engine, db):
    """audit.record пишет отдельной сессией — в тесте направляем её в общую временную БД."""
    monkeypatch.setattr(
        audit,
        "SessionLocal",
        sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False),
    )
    return db


def test_auth_audit_prefers_bff_real_ip_over_forged_forwarded_for(client, audit_db):
    response = client.post(
        "/api/auth/register",
        json={"email": "real-ip@example.ru", "password": "secret123"},
        headers={
            "X-Real-IP": "40.69.0.186",
            "X-Forwarded-For": "203.0.113.77, 40.69.0.186",
        },
    )

    assert response.status_code == 200
    row = audit_db.scalar(select(SecurityAudit).where(SecurityAudit.email == "real-ip@example.ru"))
    assert row is not None
    assert row.ip == "40.69.0.186"


def test_auth_audit_ignores_forwarded_for_without_bff_real_ip(client, audit_db):
    response = client.post(
        "/api/auth/login",
        json={"email": "forged-ip@example.ru", "password": "wrong-password"},
        headers={"X-Forwarded-For": "203.0.113.77"},
    )

    assert response.status_code == 401
    row = audit_db.scalar(select(SecurityAudit).where(SecurityAudit.email == "forged-ip@example.ru"))
    assert row is not None
    assert row.ip == "testclient"
    assert row.ip != "203.0.113.77"


def test_security_audit_default_page_contains_ten_rows(client, auth, db, audit_db):
    admin = auth(settings.admins[0])
    db.add_all([
        SecurityAudit(action="login", outcome="failed", email=f"attempt-{i}@example.ru",
                      ip="192.0.2.1")
        for i in range(12)
    ])
    db.commit()

    response = client.get("/api/admin/security-audit", headers=admin)
    assert response.status_code == 200
    body = response.json()
    # Регистрация админа добавляет ещё одну запись; размер страницы от total не зависит.
    assert body["page_size"] == 10
    assert len(body["items"]) == 10
    assert body["total"] == 13
