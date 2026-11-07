import json

from sqlalchemy import select

from app.config import settings
from app.models import IndividualReading, User
from app.security import create_share_token

ARTICLE = {"title": "Королю нужен Шут", "lead": "Лид.", "sections": [{"h2": "Глава", "paragraphs": ["Текст."]}]}


def buy(client, email, birth="1990-01-01"):
    paid = client.post("/api/payments/mock", json={"tariff": "single", "email": email, "birth": birth}).json()
    return {"Authorization": f"Bearer {paid['token']}"}, paid["matrix_id"]


def test_owner_shares_a_reading_and_anyone_opens_it(client):
    headers, mid = buy(client, "share@example.ru")
    r = client.post(f"/api/readings/{mid}/share", headers=headers)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    opened = client.get(f"/api/shared/{token}")
    assert opened.status_code == 200
    body = opened.json()
    assert body["shared"] == "reading" and body["id"] == mid and body["birth"] == "1990-01-01" and body["unlocked"] is True
    assert opened.headers["cache-control"] == "private, no-store"


def test_a_stranger_cannot_share_someone_elses_reading(client, auth):
    _, mid = buy(client, "owner-share@example.ru")
    stranger = auth("stranger@example.ru")
    assert client.post(f"/api/readings/{mid}/share", headers=stranger).status_code == 404
    assert client.post(f"/api/readings/{mid}/share").status_code == 401


def test_removing_a_reading_closes_its_link(client, auth, db):
    headers, admin = auth(), auth(settings.admins[0])
    uid = db.scalar(select(User).where(User.email == "user@example.ru")).id
    rid = client.post(f"/api/admin/users/{uid}/readings", json={"product": "personal", "inputs": {"birth": "1996-04-01", "sex": "f"}},
                      headers=admin).json()["id"]
    token = client.post(f"/api/readings/{rid}/share", headers=headers).json()["token"]
    assert client.get(f"/api/shared/{token}").status_code == 200
    assert client.delete(f"/api/readings/{rid}", headers=headers).status_code == 204
    assert client.get(f"/api/shared/{token}").status_code == 404


def test_a_forged_or_foreign_link_opens_nothing(client):
    _, mid = buy(client, "forge@example.ru")
    assert client.get("/api/shared/nonsense").status_code == 404
    # the owner in the link must own the reading
    assert client.get(f"/api/shared/{create_share_token('reading', mid, 999999)}").status_code == 404


def test_finished_individual_reading_is_shared_with_its_article(client, auth, db):
    owner = auth("ind-share@example.ru")
    user = db.scalar(select(User).where(User.email == "ind-share@example.ru"))
    row = IndividualReading(user_id=user.id, product="personal", kind="personal", inputs=json.dumps({"birth": "1993-03-31", "sex": "m"}),
                            automatic_reading=json.dumps({"matrix": {}}), status="done", title=ARTICLE["title"],
                            article=json.dumps(ARTICLE, ensure_ascii=False))
    pending = IndividualReading(user_id=user.id, product="personal", kind="personal", inputs=json.dumps({"birth": "1993-03-31", "sex": "m"}),
                                automatic_reading=json.dumps({"matrix": {}}), status="pending")
    db.add_all([row, pending])
    db.commit()
    token = client.post(f"/api/individual-readings/{row.id}/share", headers=owner).json()["token"]
    body = client.get(f"/api/shared/{token}").json()
    assert body["shared"] == "individual" and body["id"] == row.id and body["article"]["title"] == ARTICLE["title"]
    assert client.post(f"/api/individual-readings/{pending.id}/share", headers=owner).status_code == 409
    assert client.post(f"/api/individual-readings/{row.id}/share", headers=auth("other@example.ru")).status_code == 403
