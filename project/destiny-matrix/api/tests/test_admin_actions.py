"""Действия админа над чужим аккаунтом: войти под ним, выдать матрицу, забрать его PDF."""
from __future__ import annotations

import pytest
from sqlalchemy.orm import sessionmaker

from app import audit, presence
from app.config import settings
from app.models import ReportJob, SavedMatrix, SecurityAudit, User, as_utc, utcnow


@pytest.fixture
def audit_db(monkeypatch, db_engine, db):
    """audit.record пишет отдельной сессией — в тесте направляем её в общую временную БД."""
    monkeypatch.setattr(audit, "SessionLocal",
                        sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False))
    return db


def buyer(client) -> dict:
    """Обычный покупатель с оплаченной матрицей."""
    paid = client.post("/api/payments/mock",
                       json={"tariff": "single", "email": "buyer@example.ru",
                             "birth": "1990-05-05"}).json()
    return {"token": paid["token"], "matrix_id": paid["matrix"]["id"]}


def user_id(db, email: str = "buyer@example.ru") -> int:
    return db.query(User).filter(User.email == email).one().id


def test_impersonation_gives_the_users_own_session(client, auth, db):
    buyer(client)
    admin = auth(settings.admins[0])
    target = user_id(db)

    answer = client.post(f"/api/admin/users/{target}/impersonate", headers=admin)
    assert answer.status_code == 200, answer.text
    body = answer.json()
    assert body["user"]["email"] == "buyer@example.ru"

    # выданным токеном сайт отвечает как самому покупателю, а не как админу
    as_user = {"Authorization": f"Bearer {body['token']}"}
    assert client.get("/api/auth/me", headers=as_user).json()["user"]["email"] == "buyer@example.ru"
    assert client.get("/api/admin/users", headers=as_user).status_code == 404


def test_impersonation_is_written_to_the_security_log(client, auth, audit_db):
    db = audit_db
    buyer(client)
    admin = auth(settings.admins[0])

    client.post(f"/api/admin/users/{user_id(db)}/impersonate", headers=admin)

    row = db.query(SecurityAudit).filter(SecurityAudit.action == "impersonate").one()
    assert (row.outcome, row.email) == ("success", "buyer@example.ru")


def test_only_admin_can_enter_as_someone_else(client, auth, audit_db):
    db = audit_db
    token = buyer(client)["token"]
    stranger = {"Authorization": f"Bearer {token}"}

    answer = client.post(f"/api/admin/users/{user_id(db)}/impersonate", headers=stranger)

    assert answer.status_code == 404
    assert db.query(SecurityAudit).filter(SecurityAudit.action == "impersonate").count() == 0


def test_granted_matrix_is_open_but_not_bought(client, auth, db):
    token = buyer(client)["token"]
    admin = auth(settings.admins[0])
    target = user_id(db)

    given = client.post(f"/api/admin/users/{target}/matrices",
                        json={"birth": "1984-03-17", "sex": "m"}, headers=admin)
    assert given.status_code == 200, given.text
    assert given.json()["access"] == "granted", "подарок не должен выглядеть купленным"

    # в кабинете покупателя она открыта и лежит рядом с купленной
    mine = client.get("/api/matrices", headers={"Authorization": f"Bearer {token}"}).json()["items"]
    by_birth = {m["birth"]: m["access"] for m in mine}
    assert by_birth == {"1984-03-17": "granted", "1990-05-05": "forever"}


def test_granting_the_same_date_twice_changes_nothing(client, auth, db):
    buyer(client)
    admin = auth(settings.admins[0])
    target = user_id(db)
    body = {"birth": "1984-03-17", "sex": "m"}

    first = client.post(f"/api/admin/users/{target}/matrices", json=body, headers=admin).json()
    second = client.post(f"/api/admin/users/{target}/matrices", json=body, headers=admin).json()

    assert first["id"] == second["id"]
    assert db.query(SavedMatrix).filter(SavedMatrix.user_id == target).count() == 2


def test_impossible_date_is_refused(client, auth, db):
    buyer(client)
    admin = auth(settings.admins[0])

    answer = client.post(f"/api/admin/users/{user_id(db)}/matrices",
                         json={"birth": "1830-01-01", "sex": "f"}, headers=admin)

    assert answer.status_code == 400


def test_report_link_returns_the_file_of_any_user(client, auth, db, monkeypatch):
    buyer(client)
    admin = auth(settings.admins[0])
    target = user_id(db)
    matrix = db.query(SavedMatrix).filter(SavedMatrix.user_id == target).one()
    db.add(ReportJob(user_id=target, matrix_id=matrix.id, status="done",
                     object_key=f"{target}/{matrix.id}/7.pdf", size_bytes=1_200_000))
    db.commit()
    job = db.query(ReportJob).one()

    from app.routers import admin as admin_router
    monkeypatch.setattr(admin_router.report_store, "link",
                        lambda key, name=None: f"https://storage/{key}?name={name}")

    answer = client.get(f"/api/admin/reports/{job.id}/link", headers=admin)

    assert answer.status_code == 200, answer.text
    assert answer.json()["url"].startswith(f"https://storage/{target}/{matrix.id}/7.pdf")
    assert "5 мая 1990" in answer.json()["url"], "имя файла — дата разбора, а не номер задачи"


def test_unfinished_report_has_nothing_to_download(client, auth, db):
    buyer(client)
    admin = auth(settings.admins[0])
    target = user_id(db)
    matrix = db.query(SavedMatrix).filter(SavedMatrix.user_id == target).one()
    db.add(ReportJob(user_id=target, matrix_id=matrix.id, status="running"))
    db.commit()

    answer = client.get(f"/api/admin/reports/{db.query(ReportJob).one().id}/link", headers=admin)

    assert answer.status_code == 409


def test_summary_does_not_call_a_gift_a_purchase(client, auth, db):
    """«Куплено 2 даты» там, где заплатили за одну, — ложь и покупателю, и админке."""
    token = buyer(client)["token"]
    admin = auth(settings.admins[0])
    target = user_id(db)

    client.post(f"/api/admin/users/{target}/matrices",
                json={"birth": "1984-03-17", "sex": "m"}, headers=admin)

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert me["owned"] == 1, "выданная дата попала в купленные"
    assert me["access"]["granted"] == 1

    row = next(r for r in client.get("/api/admin/users", headers=admin).json()["items"]
               if r["email"] == "buyer@example.ru")
    assert (row["owned"], row["granted"]) == (1, 1)


@pytest.fixture
def forget_presence():
    """Буфер присутствия живёт в модуле, а не в базе: соседний тест не должен его наследовать."""
    presence.forget()
    yield
    presence.forget()


def beat(client, token: str, visitor: str) -> None:
    answer = client.post("/api/pulse",
                         json={"visitor": visitor, "tab": visitor, "path": "/account"},
                         headers={"Authorization": f"Bearer {token}"})
    assert answer.status_code == 200, answer.text


def test_own_visit_moves_last_seen(client, db, db_engine, forget_presence):
    """Обычный вход — это появление человека, и оно обязано попасть в «последнее появление»."""
    token = buyer(client)["token"]
    maker = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)
    user = db.get(User, user_id(db))
    assert user.last_seen_at is None

    before = utcnow()
    beat(client, token, "сам-покупатель")
    assert presence.flush(maker) == 1
    db.refresh(user)
    assert user.last_seen_at is not None and as_utc(user.last_seen_at) >= before


def test_impersonated_visit_leaves_last_seen_alone(client, auth, db, db_engine, forget_presence):
    """Вход под пользователем — просмотр глазами админа: присутствие покупателя он не подделывает."""
    token = buyer(client)["token"]
    maker = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)
    target = user_id(db)
    user = db.get(User, target)
    beat(client, token, "сам-покупатель")
    assert presence.flush(maker) == 1
    db.refresh(user)
    was = user.last_seen_at
    assert was is not None

    admin = auth(settings.admins[0])
    ghost = client.post(f"/api/admin/users/{target}/impersonate", headers=admin).json()["token"]
    beat(client, ghost, "админ-под-покупателем")

    assert presence.flush(maker) == 0, "чужая сессия попала в буфер последнего появления"
    db.refresh(user)
    assert user.last_seen_at == was, "«последнее появление» показало визит админа"
