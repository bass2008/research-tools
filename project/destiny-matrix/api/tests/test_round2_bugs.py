"""Регрессия на дефект второго прогона, который видно по ответу api."""
from __future__ import annotations

import pytest

pytestmark = pytest.mark.bug


def test_c5_storage_limit_message_matches_reality(client):
    """C5. Человек ничего не покупал, а отказ по лимиту говорит «все оплаченные даты заняты» и
    обещает, что сохранённые «остаются открытыми»."""
    registered = client.post("/api/auth/register",
                             json={"email": "c5@example.ru", "password": "1234"})
    assert registered.status_code == 200, registered.text
    headers = {"Authorization": f"Bearer {registered.json()['token']}"}

    first = client.post("/api/matrices", json={"birth": "1990-01-01", "sex": "f"}, headers=headers)
    assert first.status_code == 200, first.text

    refused = client.post("/api/matrices", json={"birth": "1991-02-02", "sex": "m"},
                          headers=headers)
    assert refused.status_code == 402, refused.text
    detail = refused.json()["detail"]

    assert "оплаченны" not in detail, (
        f"человеку без платежей сказали про оплаченные даты: {detail!r}")
