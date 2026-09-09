"""Почта на всех входах сервера.

8 сентября 2026 покупатель ввёл адрес с точкой перед @ (`tatyana123.@mail.ru`). Фронт и BFF
проверяли почту шаблоном `\\S+@\\S+\\.\\S+`, он такой адрес пропускал, и отказ приходил только
от сервера: `POST /api/auth/register` → 422, платёж не начинался вовсе. Здесь закреплено, что
сервер отвергает каждый адрес из общего корпуса и принимает каждый допустимый — тот же корпус
гоняет фронт (`web/lib/email.test.ts`) и BFF (`web/app/api/_lib/routes.test.ts`).
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select

from app.models import User
from app.schemas import Credentials, PaymentIn, ResetRequest

CORPUS = json.loads(
    (Path(__file__).resolve().parents[2] / "spec" / "email-cases.json").read_text(encoding="utf-8")
)
VALID = CORPUS["valid"]
INVALID = [case["value"] for case in CORPUS["invalid"] if case["value"] != ""]
BROKEN = "tatyana123.@mail.ru"


@pytest.mark.parametrize("email", VALID)
def test_schema_accepts_valid(email):
    assert Credentials(email=email, password="secret123").email
    assert ResetRequest(email=email).email
    assert PaymentIn(tariff="single", email=email).email


@pytest.mark.parametrize("email", INVALID)
def test_schema_rejects_invalid(email):
    for schema, payload in (
        (Credentials, {"email": email, "password": "secret123"}),
        (ResetRequest, {"email": email}),
        (PaymentIn, {"tariff": "single", "email": email}),
    ):
        with pytest.raises(ValidationError):
            schema(**payload)


@pytest.mark.parametrize("email", VALID)
def test_register_accepts_valid(client, email):
    r = client.post("/api/auth/register", json={"email": email, "password": "secret123"})
    assert r.status_code == 200, f"{email}: {r.text}"


@pytest.mark.parametrize("email", INVALID)
def test_register_rejects_invalid(client, email):
    r = client.post("/api/auth/register", json={"email": email, "password": "secret123"})
    assert r.status_code == 422, f"{email}: {r.status_code} {r.text}"
    assert "почту" in r.json()["detail"], r.text


@pytest.mark.parametrize("email", INVALID)
def test_login_rejects_invalid(client, email):
    r = client.post("/api/auth/login", json={"email": email, "password": "secret123"})
    assert r.status_code == 422, f"{email}: {r.status_code} {r.text}"


@pytest.mark.parametrize("email", INVALID)
def test_reset_request_rejects_invalid(client, email):
    r = client.post("/api/auth/reset/request", json={"email": email})
    assert r.status_code == 422, f"{email}: {r.status_code} {r.text}"


@pytest.mark.parametrize("email", INVALID)
def test_payment_rejects_invalid(client, db, email):
    r = client.post("/api/payments/mock",
                    json={"tariff": "single", "email": email, "birth": "1993-03-31", "sex": "f"})
    assert r.status_code == 422, f"{email}: {r.status_code} {r.text}"
    assert db.scalar(select(func.count(User.id))) == 0, f"{email} завёл пользователя"


class TestBrokenAddress:
    """Ровно тот случай, что был на проде."""

    def test_register_refuses(self, client):
        r = client.post("/api/auth/register", json={"email": BROKEN, "password": "secret123"})
        assert r.status_code == 422

    def test_message_names_the_field(self, client):
        r = client.post("/api/auth/register", json={"email": BROKEN, "password": "secret123"})
        detail = r.json()["detail"]
        assert "почту" in detail and "you@mail.ru" in detail

    def test_payment_does_not_start(self, client, db):
        r = client.post("/api/payments/mock",
                        json={"tariff": "single", "email": BROKEN, "birth": "1993-03-31",
                              "sex": "f"})
        assert r.status_code == 422
        assert db.scalar(select(func.count(User.id))) == 0

    def test_same_address_without_the_dot_works(self, client):
        r = client.post("/api/auth/register",
                        json={"email": "tatyana123@mail.ru", "password": "secret123"})
        assert r.status_code == 200, r.text


class TestNormalization:
    """Один человек — один аккаунт, как бы он ни набрал адрес."""

    @pytest.mark.parametrize("raw,stored", [
        ("User@Mail.RU", "user@mail.ru"),
        ("  user@mail.ru  ", "user@mail.ru"),
        ("USER@MAIL.RU", "user@mail.ru"),
        ("Ivan.Petrov@Mail.ru", "ivan.petrov@mail.ru"),
    ])
    def test_register_stores_normalized(self, client, db, raw, stored):
        r = client.post("/api/auth/register", json={"email": raw, "password": "secret123"})
        assert r.status_code == 200, r.text
        assert r.json()["user"]["email"] == stored
        assert db.scalar(select(User.email)) == stored

    def test_login_finds_account_in_any_case(self, client):
        client.post("/api/auth/register", json={"email": "user@mail.ru", "password": "secret123"})
        r = client.post("/api/auth/login", json={"email": "USER@Mail.RU", "password": "secret123"})
        assert r.status_code == 200, r.text

    def test_payment_does_not_split_account_by_case(self, client, db):
        client.post("/api/auth/register", json={"email": "buyer@mail.ru", "password": "secret123"})
        r = client.post("/api/payments/mock",
                        json={"tariff": "single", "email": "BUYER@MAIL.RU",
                              "birth": "1993-03-31", "sex": "f"})
        assert r.status_code == 200, r.text
        assert db.scalar(select(func.count(User.id))) == 1, "почта в другом регистре завела второй аккаунт"

    def test_second_registration_of_the_same_address_is_refused(self, client):
        client.post("/api/auth/register", json={"email": "dup@mail.ru", "password": "secret123"})
        again = client.post("/api/auth/register",
                            json={"email": " DUP@Mail.ru ", "password": "secret123"})
        assert again.status_code == 400
        assert "уже зарегистрирована" in again.json()["detail"]


class TestServerStaysTheSourceOfTruth:
    """Проверку нельзя «починить», ослабив сервер: тогда в базу поедут адреса, на которые
    не уходит письмо о покупке."""

    @pytest.mark.parametrize("schema", [Credentials, ResetRequest, PaymentIn])
    def test_email_field_is_a_validated_type(self, schema):
        annotation = schema.model_fields["email"].annotation
        assert annotation is not str, f"{schema.__name__}.email принимает любую строку"

    @pytest.mark.parametrize("schema,payload", [
        (Credentials, {"password": "secret123"}),
        (ResetRequest, {}),
        (PaymentIn, {"tariff": "single"}),
    ])
    def test_every_schema_normalizes(self, schema, payload):
        assert schema(email="  User@Mail.RU  ", **payload).email == "user@mail.ru"

    def test_corpus_is_the_same_file_the_front_reads(self):
        shared = Path(__file__).resolve().parents[2] / "spec" / "email-cases.json"
        assert shared.exists(), "корпус адресов общий для фронта, BFF и сервера"
        assert VALID and INVALID and CORPUS["normalize"]


class TestErrorShape:
    """Ответ 422 читает человек, а не только фронт: `detail` — строка, а не список Pydantic."""

    def test_detail_is_a_string(self, client):
        r = client.post("/api/auth/register", json={"email": BROKEN, "password": "secret123"})
        assert isinstance(r.json()["detail"], str)

    def test_password_problem_names_password(self, client):
        r = client.post("/api/auth/register", json={"email": "user@mail.ru", "password": "x"})
        assert r.status_code == 422
        assert "пароль" in r.json()["detail"]

    def test_both_fields_are_named_at_once(self, client):
        r = client.post("/api/auth/register", json={"email": BROKEN, "password": "x"})
        detail = r.json()["detail"]
        assert "почту" in detail and "пароль" in detail

    def test_missing_email_is_not_a_five_hundred(self, client):
        r = client.post("/api/auth/register", json={"password": "secret123"})
        assert r.status_code == 422
        assert "почту" in r.json()["detail"]
