import datetime as dt
from concurrent.futures import ThreadPoolExecutor

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from google.auth import crypt, jwt
from google.oauth2 import id_token
from sqlalchemy import func, select

from app import account_deletion, audit, google_sign_in as google, mail
from app.config import settings
from app.models import GoogleAuthChallenge, GoogleIdentity, User, utcnow
from app.security import create_reset_token

AUDIENCE = "123-arcana.apps.googleusercontent.com"


@pytest.fixture(scope="module")
def keys():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                serialization.NoEncryption())
    public = key.public_key().public_bytes(serialization.Encoding.PEM,
                                           serialization.PublicFormat.SubjectPublicKeyInfo)
    return crypt.RSASigner.from_string(private, key_id="test-key"), public.decode()


@pytest.fixture(autouse=True)
def isolated_google(monkeypatch, keys):
    monkeypatch.setattr(settings, "google_sign_in_client_id", AUDIENCE)
    monkeypatch.setattr("app.main.startup", lambda: None)
    monkeypatch.setattr(audit, "record", lambda *args, **kwargs: None)
    monkeypatch.setattr(mail, "send", lambda *args, **kwargs: True)
    # Exercise Google's real signature/audience/expiry verifier; only the public-key
    # download is replaced, so these tests make no network calls or console changes.
    monkeypatch.setattr(id_token, "_fetch_certs", lambda *args, **kwargs: {"test-key": keys[1]})
    google._rates.clear()
    yield
    google._rates.clear()


def issued(client):
    response = client.post("/api/auth/google/challenge", json={})
    assert response.status_code == 200, response.text
    return response.json()


def signed(keys, challenge, **overrides):
    now = int(utcnow().timestamp())
    claims = {"iss": "https://accounts.google.com", "aud": AUDIENCE, "iat": now,
              "exp": now + 3600, "sub": "google-subject-1", "email": "owner@gmail.com",
              "email_verified": True, "nonce": challenge["nonce"], **overrides}
    return jwt.encode(keys[0], claims).decode()


def payload(keys, challenge, **claims):
    return {"challenge": challenge["challenge"], "credential": signed(keys, challenge, **claims)}


def password_user(client, db, email="owner@gmail.com", verified=False):
    response = client.post("/api/auth/register", json={"email": email, "password": "secret123"})
    assert response.status_code == 200
    user = db.get(User, response.json()["user"]["id"])
    if verified:
        user.email_verified_at = utcnow()
        db.commit()
    return user, response.json()["token"]


def test_disabled_and_misconfigured_google_fail_closed(client, monkeypatch, keys):
    for value in ("", "wrong-client-id"):
        monkeypatch.setattr(settings, "google_sign_in_client_id", value)
        assert client.get("/api/auth/google/config").json() == {"enabled": False, "client_id": None}
        assert client.post("/api/auth/google/challenge", json={}).status_code == 503
        assert client.post("/api/auth/google", json={"challenge": "A" * 43, "credential": "x" * 20}).status_code == 503


def test_challenge_is_bounded_and_stores_only_hashes(client, db):
    assert client.get("/api/auth/google/config").json() == {"enabled": True, "client_id": AUDIENCE}
    issued_at = utcnow()
    item = issued(client)
    row = db.get(GoogleAuthChallenge, google.digest(item["challenge"]))
    assert row.nonce_hash == google.digest(item["nonce"])
    assert row.site_origin == "http://testserver" and row.attempts == 0
    from app.models import as_utc
    assert 299 <= (as_utc(row.expires_at) - issued_at).total_seconds() <= 301
    assert item["challenge"] not in repr(row.__dict__) and item["nonce"] not in repr(row.__dict__)


@pytest.mark.parametrize("claim", [
    {"aud": "attacker.apps.googleusercontent.com"}, {"iss": "https://evil.example"},
    {"exp": 1}, {"exp": None}, {"iat": 4102444800}, {"nonce": "wrong"},
    {"nonce": None}, {"email_verified": False}, {"email_verified": "true"},
    {"sub": ""}, {"sub": "x" * 256}, {"sub": ["google-subject-1"]},
    {"email": "not-an-email"}, {"email": "a" * 321}, {"hd": ["example.com"]},
])
def test_rejects_invalid_signed_claims_without_creating_account(client, db, keys, claim):
    item = issued(client)
    response = client.post("/api/auth/google", json=payload(keys, item, **claim))
    assert response.status_code == 401, response.text
    assert db.scalar(select(func.count()).select_from(User)) == 0
    assert db.scalar(select(func.count()).select_from(GoogleIdentity)) == 0
    assert "credential" not in response.text and item["nonce"] not in response.text


def test_rejects_bad_signature_and_unbounded_request(client, keys):
    item = issued(client)
    data = payload(keys, item)
    head, body, signature = data["credential"].split(".")
    data["credential"] = ".".join([head, body, ("B" if signature[0] != "B" else "C") + signature[1:]])
    assert client.post("/api/auth/google", json=data).status_code == 401
    for changes in ({"credential": "x" * 8193}, {"current_password": "x" * 201},
                    {"credential": [data["credential"]]}, {"unexpected": "private-value"}):
        response = client.post("/api/auth/google", json={**data, **changes})
        assert response.status_code == 422 and "private-value" not in response.text


def test_google_transport_failure_is_sanitized_and_retryable(client, keys, monkeypatch):
    from google.auth.exceptions import TransportError
    item = issued(client)
    def unavailable(*args, **kwargs):
        raise TransportError("secret-provider-credential")
    monkeypatch.setattr(id_token, "_fetch_certs", unavailable)
    response = client.post("/api/auth/google", json=payload(keys, item))
    assert response.status_code == 503 and "secret-provider" not in response.text
    monkeypatch.setattr(id_token, "_fetch_certs", lambda *args, **kwargs: {"test-key": keys[1]})
    assert client.post("/api/auth/google", json=payload(keys, item)).status_code == 200


def test_new_google_account_has_shared_session_without_password(client, db, keys):
    item = issued(client)
    result = client.post("/api/auth/google", json=payload(keys, item, email="OWNER@GMAIL.COM"))
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["user"]["email"] == "owner@gmail.com" and body["user"]["has_password"] is False
    assert body["user"]["email_verified_at"]
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['token']}"}).status_code == 200
    assert db.get(GoogleIdentity, "google-subject-1").user_id == body["user"]["id"]
    assert set(body["user"]) == {"id", "email", "created_at", "email_verified_at", "has_password"}
    assert client.post("/api/auth/google", json=payload(keys, item)).status_code == 401


@pytest.mark.parametrize("email,claims", [("owner@gmail.com", {}), ("owner@example.com", {"hd": "example.com"})])
def test_verified_authoritative_email_links_existing_account_and_preserves_password(client, db, keys, email, claims):
    user, old_token = password_user(client, db, email, verified=True)
    item = issued(client)
    result = client.post("/api/auth/google", json=payload(keys, item, email=email.upper(), **claims))
    assert result.status_code == 200, result.text
    assert result.json()["user"]["id"] == user.id and result.json()["user"]["has_password"] is True
    assert db.scalar(select(func.count()).select_from(User)) == 1
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {old_token}"}).status_code == 200
    assert client.post("/api/auth/login", json={"email": email, "password": "secret123"}).status_code == 200


@pytest.mark.parametrize("email,verified", [("owner@gmail.com", False), ("owner@example.com", True)])
def test_unverified_existing_or_third_party_email_requires_password_and_allows_retry(client, db, keys, email, verified):
    user, _ = password_user(client, db, email, verified)
    item = issued(client)
    data = payload(keys, item, email=email)
    first = client.post("/api/auth/google", json=data)
    assert first.status_code == 409 and first.json()["code"] == "google_link_required"
    assert db.get(GoogleIdentity, "google-subject-1") is None
    assert client.post("/api/auth/google", json={**data, "current_password": "wrong"}).status_code == 401
    success = client.post("/api/auth/google", json={**data, "current_password": "secret123"})
    assert success.status_code == 200 and success.json()["user"]["id"] == user.id
    assert client.post("/api/auth/google", json={**data, "current_password": "secret123"}).status_code == 401


def test_password_retry_cannot_switch_google_subject(client, db, keys):
    password_user(client, db)
    item = issued(client)
    assert client.post("/api/auth/google", json=payload(keys, item)).status_code == 409
    switched = payload(keys, item, sub="another-subject")
    assert client.post("/api/auth/google", json={**switched, "current_password": "secret123"}).status_code == 401
    assert client.post("/api/auth/google", json={**payload(keys, item), "current_password": "secret123"}).status_code == 200


def test_reset_establishes_google_password_and_invalidates_old_session(client, db, keys):
    result = client.post("/api/auth/google", json=payload(keys, issued(client))).json()
    user = db.get(User, result["user"]["id"])
    headers = {"Authorization": f"Bearer {result['token']}"}
    assert client.post("/api/mobile/account/delete", headers=headers, json={"current_password": "anything"}).status_code == 400
    reset = create_reset_token(user.id, user.password_hash, user.email, user.auth_version)
    changed = client.post("/api/auth/reset/apply", json={"token": reset, "password": "new-secret"})
    assert changed.status_code == 200 and changed.json()["user"]["has_password"] is True
    assert client.get("/api/auth/me", headers=headers).status_code == 401
    assert client.post("/api/auth/login", json={"email": user.email, "password": "new-secret"}).status_code == 200
    assert client.post("/api/mobile/account/delete", headers={"Authorization": f"Bearer {changed.json()['token']}"},
                       json={"current_password": "new-secret"}).status_code == 200


def test_password_reset_after_link_prompt_requires_fresh_challenge(client, db, keys):
    user, _ = password_user(client, db)
    item = issued(client)
    assert client.post("/api/auth/google", json=payload(keys, item)).status_code == 409
    reset = create_reset_token(user.id, user.password_hash, user.email, user.auth_version)
    assert client.post("/api/auth/reset/apply", json={"token": reset, "password": "new-secret"}).status_code == 200
    assert client.post("/api/auth/google", json={**payload(keys, item), "current_password": "new-secret"}).status_code == 401
    assert client.post("/api/auth/google", json=payload(keys, issued(client))).status_code == 200


def test_google_email_changes_never_move_a_link_to_another_account(client, db, keys):
    first = client.post("/api/auth/google", json=payload(keys, issued(client))).json()
    changed = client.post("/api/auth/google", json=payload(keys, issued(client), email="renamed@gmail.com"))
    assert changed.status_code == 200 and changed.json()["user"]["id"] == first["user"]["id"]
    assert changed.json()["user"]["email"] == "owner@gmail.com"
    password_user(client, db, "other@gmail.com", verified=True)
    assert client.post("/api/auth/google", json=payload(keys, issued(client), email="other@gmail.com")).status_code == 401


def test_gmail_aliases_are_not_collapsed(client, db, keys):
    user, _ = password_user(client, db, "first.last@gmail.com", verified=True)
    result = client.post("/api/auth/google", json=payload(keys, issued(client), email="firstlast@gmail.com"))
    assert result.status_code == 200 and result.json()["user"]["id"] != user.id


def test_new_third_party_google_email_cannot_create_a_persistent_login(client, db, keys):
    result = client.post("/api/auth/google", json=payload(keys, issued(client), email="new@example.com"))
    assert result.status_code == 403 and result.json()["code"] == "google_email_verification_required"
    assert db.scalar(select(func.count()).select_from(User)) == 0
    assert db.scalar(select(func.count()).select_from(GoogleIdentity)) == 0


def test_unverified_third_party_password_cannot_pre_hijack_google_link_before_email_reset(client, db, keys):
    user, _ = password_user(client, db, "new@example.com")
    item = issued(client)
    data = {**payload(keys, item, email=user.email), "current_password": "secret123"}
    response = client.post("/api/auth/google", json=data)
    assert response.status_code == 403 and response.json()["code"] == "google_email_verification_required"
    assert db.get(GoogleIdentity, "google-subject-1") is None
    reset = create_reset_token(user.id, user.password_hash, user.email, user.auth_version)
    assert client.post("/api/auth/reset/apply", json={"token": reset, "password": "mailbox-owner-password"}).status_code == 200
    # The old Google account and the pre-registered password still cannot enter.
    retry = payload(keys, issued(client), email=user.email)
    assert client.post("/api/auth/google", json=retry).status_code == 409
    assert client.post("/api/auth/google", json={**retry, "current_password": "secret123"}).status_code == 401
    assert db.get(GoogleIdentity, "google-subject-1") is None


@pytest.mark.parametrize("existing", [False, True])
def test_admin_google_sign_in_is_disabled_without_changing_password_login(client, db, keys, monkeypatch, existing):
    monkeypatch.setattr(settings, "admin_emails", "admin@gmail.com")
    if existing:
        password_user(client, db, "admin@gmail.com", verified=True)
    response = client.post("/api/auth/google", json=payload(keys, issued(client), email="admin@gmail.com"))
    assert response.status_code == 403
    assert db.scalar(select(func.count()).select_from(GoogleIdentity)) == 0
    if existing:
        assert client.post("/api/auth/login", json={"email": "admin@gmail.com", "password": "secret123"}).status_code == 200


def test_pending_deletion_returns_only_restore_session_and_expired_or_deleted_account_fails(client, db, keys):
    body = client.post("/api/auth/google", json=payload(keys, issued(client))).json()
    user = db.get(User, body["user"]["id"])
    user.deletion_requested_at = utcnow(); user.auth_version += 1; db.commit()
    result = client.post("/api/auth/google", json=payload(keys, issued(client)))
    assert result.status_code == 200 and result.json()["deletion"]["delete_at"]
    headers = {"Authorization": f"Bearer {result.json()['token']}"}
    assert client.get("/api/auth/me", headers=headers).status_code == 401
    assert client.get("/api/mobile/account/deletion", headers=headers).status_code == 200
    assert client.post("/api/mobile/account/restore", headers=headers).status_code == 200
    db.refresh(user); user.deletion_requested_at = utcnow() - dt.timedelta(days=31); db.commit()
    assert client.post("/api/auth/google", json=payload(keys, issued(client))).status_code == 403
    user.deleted_at = utcnow(); db.commit()
    assert client.post("/api/auth/google", json=payload(keys, issued(client))).status_code == 401


def test_final_deletion_removes_google_identity_and_bound_challenges(client, db, keys, monkeypatch):
    body = client.post("/api/auth/google", json=payload(keys, issued(client))).json()
    user = db.get(User, body["user"]["id"])
    user.deletion_requested_at = utcnow() - dt.timedelta(days=31); db.commit()
    class NoFiles:
        def delete_account(self, *args): pass
    monkeypatch.setattr(account_deletion, "store", lambda: NoFiles())
    assert account_deletion.purge(db, user.id)
    db.expire_all()
    assert db.get(GoogleIdentity, "google-subject-1") is None
    assert db.scalar(select(func.count()).select_from(GoogleAuthChallenge).where(GoogleAuthChallenge.user_id == user.id)) == 0
    assert db.get(User, user.id).deleted_at is not None


@pytest.mark.parametrize("change", ["expiry", "origin", "audience"])
def test_challenge_cannot_outlive_expiry_site_or_client_configuration(client, db, keys, monkeypatch, change):
    item = issued(client)
    row = db.get(GoogleAuthChallenge, google.digest(item["challenge"]))
    if change == "expiry": row.expires_at = utcnow() - dt.timedelta(seconds=1)
    elif change == "origin": row.site_origin = "https://other.example"
    else: monkeypatch.setattr(settings, "google_sign_in_client_id", "rotated.apps.googleusercontent.com")
    db.commit()
    assert client.post("/api/auth/google", json=payload(keys, item)).status_code == 401


def test_password_guessing_exhausts_challenge_even_if_password_later_correct(client, db, keys):
    password_user(client, db)
    item = issued(client)
    data = payload(keys, item)
    for _ in range(google.MAX_ATTEMPTS):
        assert client.post("/api/auth/google", json={**data, "current_password": "wrong"}).status_code == 401
    assert client.post("/api/auth/google", json={**data, "current_password": "secret123"}).status_code == 401
    assert db.scalar(select(func.count()).select_from(GoogleIdentity)) == 0


def test_challenge_storage_cap_and_expired_cleanup(client, db, monkeypatch):
    monkeypatch.setattr(google, "MAX_CHALLENGES", 2)
    first, second = issued(client), issued(client)
    assert client.post("/api/auth/google/challenge", json={}).status_code == 429
    row = db.get(GoogleAuthChallenge, google.digest(first["challenge"]))
    row.expires_at = utcnow() - dt.timedelta(seconds=1); db.commit()
    issued(client)
    db.expire_all()
    assert db.get(GoogleAuthChallenge, google.digest(first["challenge"])) is None


def test_new_auth_routes_have_ip_rate_limits(client):
    for _ in range(120): assert client.get("/api/auth/google/config").status_code == 200
    assert client.get("/api/auth/google/config").status_code == 429
    for _ in range(30):
        assert client.post("/api/auth/google", json={"challenge": "A" * 43, "credential": "x" * 20}).status_code == 401
    assert client.post("/api/auth/google", json={"challenge": "A" * 43, "credential": "x" * 20}).status_code == 429


def test_concurrent_replay_succeeds_only_once(client, db, keys):
    data = payload(keys, issued(client))
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: client.post("/api/auth/google", json=data), range(2)))
    assert sorted(r.status_code for r in responses) == [200, 401]
    assert db.scalar(select(func.count()).select_from(User)) == 1


def test_two_different_subjects_cannot_race_to_link_one_existing_account(client, db, keys):
    user, _ = password_user(client, db, verified=True)
    data = [payload(keys, issued(client), sub=f"subject-{i}") for i in range(2)]
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda item: client.post("/api/auth/google", json=item), data))
    assert sorted(r.status_code for r in responses) == [200, 409]
    assert db.scalar(select(func.count()).select_from(GoogleIdentity).where(GoogleIdentity.user_id == user.id)) == 1
    assert db.scalar(select(func.count()).select_from(User)) == 1


def test_new_account_race_for_same_google_subject_keeps_one_user(client, db, keys):
    data = [payload(keys, issued(client)) for _ in range(2)]
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda item: client.post("/api/auth/google", json=item), data))
    assert [r.status_code for r in responses] == [200, 200]
    assert len({r.json()["user"]["id"] for r in responses}) == 1
    assert db.scalar(select(func.count()).select_from(User)) == 1
    assert db.scalar(select(func.count()).select_from(GoogleIdentity)) == 1


def test_verifier_uses_rotated_google_keys_without_accepting_retired_key(client, keys, monkeypatch):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                serialization.NoEncryption())
    public = key.public_key().public_bytes(serialization.Encoding.PEM,
                                           serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    rotated = crypt.RSASigner.from_string(private, key_id="rotated-key"), public
    item = issued(client)
    data = payload(rotated, item)
    assert client.post("/api/auth/google", json=data).status_code == 401
    monkeypatch.setattr(id_token, "_fetch_certs", lambda *args, **kwargs: {"rotated-key": public})
    assert client.post("/api/auth/google", json=data).status_code == 200
    assert client.post("/api/auth/google", json=payload(keys, issued(client))).status_code == 401
