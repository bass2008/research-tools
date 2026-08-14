import datetime as dt


def _parsed(value: str) -> dt.datetime:
    return dt.datetime.fromisoformat(value)


def test_created_at_carries_timezone(client, auth):
    headers = auth()
    user_created = client.get("/api/auth/me", headers=headers).json()["user"]["created_at"]
    assert _parsed(user_created).tzinfo is not None

    matrix = client.post("/api/matrices", json={"birth": "1987-06-14", "sex": "m"},
                         headers=headers).json()
    assert _parsed(matrix["created_at"]).tzinfo is not None
    item = client.get("/api/matrices", headers=headers).json()["items"][0]
    assert _parsed(item["created_at"]).tzinfo is not None


def test_created_at_is_close_to_now(client, auth):
    created = client.get("/api/auth/me", headers=auth()).json()["user"]["created_at"]
    delta = abs(_parsed(created) - dt.datetime.now(dt.timezone.utc))
    assert delta < dt.timedelta(minutes=5)
