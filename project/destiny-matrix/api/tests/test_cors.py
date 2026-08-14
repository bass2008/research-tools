"""CORS по умолчанию выключен: браузер обращается только к своему origin через BFF."""
from fastapi.testclient import TestClient

from app.config import Settings, settings
from app.main import create_app


def test_default_allows_no_origin():
    assert Settings(_env_file=None).origins == []


def test_without_configured_origins_no_headers_and_no_preflight(client):
    r = client.get("/api/health", headers={"Origin": "http://evil.example"})
    assert r.status_code == 200
    assert "access-control-allow-origin" not in r.headers

    preflight = client.options("/api/auth/login",
                               headers={"Origin": "http://evil.example",
                                        "Access-Control-Request-Method": "POST"})
    assert preflight.status_code == 405   # мидлвари нет вообще, отвечать на preflight некому


def test_configured_origin_is_allowed_with_credentials(monkeypatch):
    monkeypatch.setattr(settings, "cors_origins", "http://admin.example")
    with TestClient(create_app()) as client:
        r = client.get("/api/health", headers={"Origin": "http://admin.example"})
        assert r.headers["access-control-allow-origin"] == "http://admin.example"
        assert r.headers["access-control-allow-credentials"] == "true"

        preflight = client.options("/api/auth/login",
                                   headers={"Origin": "http://admin.example",
                                            "Access-Control-Request-Method": "POST"})
        assert preflight.status_code == 200
        assert preflight.headers["access-control-allow-origin"] == "http://admin.example"


def test_foreign_origin_stays_forbidden_when_a_list_is_set(monkeypatch):
    monkeypatch.setattr(settings, "cors_origins", "http://admin.example")
    with TestClient(create_app()) as client:
        r = client.get("/api/health", headers={"Origin": "http://evil.example"})
        assert "access-control-allow-origin" not in r.headers
