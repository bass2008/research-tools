from __future__ import annotations

import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.db import Base, get_db  # noqa: E402
from app.main import create_app  # noqa: E402
from app import tariffs  # noqa: E402


@pytest.fixture(autouse=True)
def no_warmup(monkeypatch):
    """Прогрев печати после оплаты в контрактных тестах выключен: браузера здесь нет, а фоновый
    поток переживал свой тест и мешал следующему. Тесты самого прогрева включают его сами."""
    from app import printing

    monkeypatch.setattr(printing.settings, "print_warmup", False)
    yield
    deadline = time.monotonic() + 30
    while printing.pending() and time.monotonic() < deadline:
        time.sleep(0.05)


@pytest.fixture()
def db_engine():
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True,
                           connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    # тарифы теперь в базе, а не в коде: без справочника оплата отвечает 404
    with sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)() as session:
        tariffs.seed(session)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def db(db_engine) -> Session:
    maker = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)
    with maker() as session:
        yield session


@pytest.fixture()
def client(db_engine) -> TestClient:
    app = create_app()
    maker = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)

    def override():
        with maker() as session:
            yield session

    app.dependency_overrides[get_db] = override
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def auth(client):
    """Регистрация пользователя, возврат заголовка с токеном."""
    def make(email: str = "user@example.ru", password: str = "secret123") -> dict:
        response = client.post("/api/auth/register", json={"email": email, "password": password})
        assert response.status_code == 200, response.text
        return {"Authorization": f"Bearer {response.json()['token']}"}
    return make


@pytest.fixture()
def paid(client):
    """Мок-оплата тарифа: возвращает заголовок с токеном купившего."""
    def make(tariff: str = "month", email: str = "buyer@example.ru",
             birth: str | None = None, sex: str = "m") -> dict:
        body = {"tariff": tariff, "email": email}
        # разовый тариф привязывается к матрице, поэтому дату передаём вместе с оплатой
        if birth:
            body |= {"birth": birth, "sex": sex}
        response = client.post("/api/payments/mock", json=body)
        assert response.status_code == 200, response.text
        return {"Authorization": f"Bearer {response.json()['token']}"}
    return make
