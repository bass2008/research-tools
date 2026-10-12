"""Общая очередь MCP и отсутствие генерации чакр при открытии доступа."""
from __future__ import annotations

import datetime as dt

import pytest
from sqlalchemy import select

from app import printing, worktasks
from app.config import settings
from app.models import Reading, ReportJob, User, WorkTask
from app.security import create_worker_token

PAIR = {"a": {"birth": "1993-03-31", "name": "Сергей"}, "b": {"birth": "1994-12-28", "name": "Виктория"}}


def worker() -> dict:
    return {"X-Internal-Token": create_worker_token()}


def buy_pair(client, email="pair@example.ru"):
    answer = client.post("/api/payments/mock", json={"tariff": "pair", "email": email, "inputs": PAIR})
    assert answer.status_code == 200, answer.text
    return answer.json(), {"Authorization": f"Bearer {answer.json()['token']}"}


def tasks(db):
    db.expire_all()
    return db.scalars(select(WorkTask).order_by(WorkTask.id)).all()


def test_paid_pair_opens_without_generation(client, db):
    body, owner = buy_pair(client)
    assert client.get(f"/api/readings/{body['reading_id']}", headers=owner).json()["unlocked"]
    assert tasks(db) == []


def test_subscription_opens_saved_and_new_pairs_without_generation(client, auth, db):
    email = "static-sub@example.ru"
    headers = auth(email)
    saved = client.post("/api/readings", json={"product": "pair", "inputs": PAIR}, headers=headers).json()
    assert not saved["unlocked"]
    assert client.post("/api/payments/mock", json={"tariff": "month", "email": email}, headers=headers).status_code == 200
    assert client.get(f"/api/readings/{saved['id']}", headers=headers).json()["unlocked"]
    other = {**PAIR, "a": {"birth": "1990-01-01"}}
    assert client.post("/api/readings", json={"product": "pair", "inputs": other}, headers=headers).json()["unlocked"]
    assert tasks(db) == []


def test_admin_grants_pair_and_subscription_without_generation(client, auth, db):
    email = "static-grant@example.ru"
    auth(email)
    user = db.scalar(select(User).where(User.email == email))
    admin = auth(settings.admins[0])
    answer = client.post(f"/api/admin/users/{user.id}/readings", json={"product": "pair", "inputs": PAIR}, headers=admin)
    assert answer.status_code == 200, answer.text
    assert client.post(f"/api/admin/users/{user.id}/subscription", headers=admin).status_code == 200
    assert tasks(db) == []


def test_worker_endpoints_need_worker_not_session_token(client, auth):
    for headers in ({}, {"X-Internal-Token": "x"}, {"X-Internal-Token": auth()["Authorization"].split()[1]}):
        assert client.get("/api/internal/tasks/watch?timeout=0", headers=headers).status_code == 401


def test_watch_job_lease_and_failed_submission(client, auth, db):
    admin = auth(settings.admins[0])
    task = client.post("/api/admin/tasks", json={"kind": "test"}, headers=admin).json()
    task_id = str(task["id"])
    assert client.get("/api/internal/tasks/watch?timeout=0", headers=worker()).json() == [{"job_id": task_id, "type": "test"}]
    assert client.get("/api/internal/tasks/watch?timeout=0", headers=worker()).json() == []
    assert client.get(f"/api/internal/tasks/job/{task_id}", headers=worker()).json()["params"] == {}
    row = db.get(WorkTask, task["id"])
    row.signalled_at -= dt.timedelta(hours=settings.task_lease_hours + 1)
    db.commit()
    assert client.get("/api/internal/tasks/watch?timeout=0", headers=worker()).json() == [{"job_id": task_id, "type": "test"}]
    assert client.post("/api/internal/tasks/result", json={"job_id": task_id, "ok": False, "error": "нет связи"}, headers=worker()).json()["accepted"]
    assert tasks(db)[0].status == "failed"
    assert not client.post("/api/internal/tasks/result", json={"job_id": task_id, "ok": True, "result": "ok"}, headers=worker()).json()["accepted"]
    assert client.post(f"/api/admin/tasks/{task_id}/retry", headers=admin).status_code == 200
    assert client.get("/api/internal/tasks/watch?timeout=0", headers=worker()).json()[0]["job_id"] == task_id


def test_unknown_task_kind_is_not_accepted_as_content(client, db):
    task = WorkTask(kind="unknown")
    db.add(task)
    db.commit()
    assert not worktasks.submit(db, task.id, True, {"ru": [], "en": []})["accepted"]
    assert tasks(db)[0].status == "queued"


def test_pair_pdf_uses_standard_revision_cache(client, db, monkeypatch):
    body, _ = buy_pair(client)
    reading = db.get(Reading, body["reading_id"])
    now = dt.datetime.now(dt.timezone.utc)
    job = ReportJob(user_id=reading.user_id, reading_id=reading.id, locale="ru", status="done",
                    object_key=f"{printing.PDF_REVISION}/x.pdf", created_at=now, finished_at=now)
    db.add(job)
    db.commit()
    monkeypatch.setattr(printing, "store", lambda: type("S", (), {"exists": staticmethod(lambda key: True)})())
    assert printing.ready(db, reading.user_id, reading.id) is not None
    job.object_key = "v8/old-incomplete.pdf"
    db.commit()
    assert printing.ready(db, reading.user_id, reading.id) is None


def test_admin_sees_whether_the_worker_comes_for_tasks(client, auth, monkeypatch):
    monkeypatch.setattr(worktasks, "_last_watch", 0.0)
    admin = auth(settings.admins[0])
    assert client.get("/api/admin/tasks", headers=admin).json()["worker"] == {
        "online": False, "last_seen_at": None, "offline_after": worktasks.OFFLINE_AFTER}
    client.get("/api/internal/tasks/watch?timeout=0", headers=worker())
    status = client.get("/api/admin/tasks", headers=admin).json()["worker"]
    assert status["online"] is True and status["last_seen_at"]
    monkeypatch.setattr(worktasks, "_last_watch", worktasks._last_watch - worktasks.OFFLINE_AFTER - 1)
    assert client.get("/api/admin/tasks", headers=admin).json()["worker"]["online"] is False


def test_admin_test_task_roundtrip_has_no_content_or_mail(client, auth, monkeypatch):
    admin = auth(settings.admins[0])
    def forbidden(*a, **kw):
        raise AssertionError('test task must not publish content or notify buyers')
    monkeypatch.setattr('app.mail.send', forbidden)
    task = client.post('/api/admin/tasks', json={'kind': 'test'}, headers=admin).json()
    assert task['kind'] == 'test' and task['status'] == 'queued'
    jobs = client.get('/api/internal/tasks/watch?timeout=0', headers=worker()).json()
    assert jobs == [{'job_id': str(task['id']), 'type': 'test'}]
    assert client.get(f"/api/internal/tasks/job/{task['id']}", headers=worker()).json()['type'] == 'test'
    url = '/api/internal/tasks/result'
    assert not client.post(url, json={'job_id': str(task['id']), 'ok': True, 'result': {}}, headers=worker()).json()['accepted']
    assert client.post(url, json={'job_id': str(task['id']), 'ok': True, 'result': 'Связь с MCP работает.'}, headers=worker()).json()['accepted']
    row = client.get('/api/admin/tasks', headers=admin).json()['items'][0]
    assert row['status'] == 'done' and row['params']['response'] == 'Связь с MCP работает.'


@pytest.mark.parametrize('state', ['queued', 'signalled', 'done', 'failed'])
def test_admin_can_delete_task_and_late_result_is_rejected(client, auth, db, state):
    admin = auth(settings.admins[0])
    task = WorkTask(kind='test', status=state)
    db.add(task)
    db.commit()
    task_id = task.id
    assert client.delete(f'/api/admin/tasks/{task_id}', headers=admin).status_code == 200
    assert client.get('/api/admin/tasks', headers=admin).json()['total'] == 0
    assert client.get(f'/api/internal/tasks/job/{task_id}', headers=worker()).status_code == 404
    assert not client.post('/api/internal/tasks/result', headers=worker(), json={'job_id': str(task_id), 'ok': True, 'result': 'ok'}).json()['accepted']


def test_task_mutations_require_admin_and_only_test_can_be_created(client, auth):
    ordinary = auth('ordinary-worker@example.ru')
    assert client.post('/api/admin/tasks', json={'kind': 'test'}, headers=ordinary).status_code == 404
    assert client.delete('/api/admin/tasks/1', headers=ordinary).status_code == 404
    assert client.post('/api/admin/tasks', json={'kind': 'pair_chakras'}, headers=auth(settings.admins[0])).status_code == 422


def test_deleted_task_result_cannot_complete_its_replacement(client, auth):
    admin = auth(settings.admins[0])
    first = client.post('/api/admin/tasks', json={'kind': 'test'}, headers=admin).json()
    old_id = str(first['id'])
    assert client.get('/api/internal/tasks/watch?timeout=0', headers=worker()).json()[0]['job_id'] == old_id
    assert client.get(f'/api/internal/tasks/job/{old_id}', headers=worker()).status_code == 200
    assert client.delete(f'/api/admin/tasks/{old_id}', headers=admin).status_code == 200
    replacement = client.post('/api/admin/tasks', json={'kind': 'test'}, headers=admin).json()
    late = client.post('/api/internal/tasks/result', headers=worker(),
                       json={'job_id': old_id, 'ok': True, 'result': 'Ответ удалённой задачи'}).json()
    assert late['accepted'] is False
    assert replacement['id'] != first['id']
    current = client.get('/api/admin/tasks', headers=admin).json()['items'][0]
    assert current['status'] == 'queued' and current['params'] == {} and current['attempts'] == 0
    new_id = str(replacement['id'])
    assert client.get('/api/internal/tasks/watch?timeout=0', headers=worker()).json()[0]['job_id'] == new_id
    assert client.post('/api/internal/tasks/result', headers=worker(),
                       json={'job_id': new_id, 'ok': True, 'result': 'Связь работает'}).json()['accepted']
