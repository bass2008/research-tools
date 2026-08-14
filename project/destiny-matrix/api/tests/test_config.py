import pytest

from app.config import Settings


def test_defaults_are_dev_friendly():
    s = Settings(_env_file=None)
    assert s.jwt_ttl_days == 30
    assert s.mock_payments is True
    assert s.api_prefix == "/api"
    assert len(s.jwt_secret.encode()) >= 32   # иначе PyJWT предупреждает про слабый ключ
    s.check()


def test_secret_is_not_hardcoded():
    """Два процесса без JWT_SECRET обязаны получить разные ключи.

    Захардкоженный секрет в репозитории позволяет подделать токен на чужой user_id, поэтому
    ключа по умолчанию нет: он генерируется на процесс.
    """
    assert Settings(_env_file=None).jwt_secret != Settings(_env_file=None).jwt_secret


def test_prod_requires_explicit_secret(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    with pytest.raises(RuntimeError, match="обязателен"):
        Settings(_env_file=None, app_env="prod").check()


def test_prod_refuses_short_secret(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "short")
    with pytest.raises(RuntimeError, match="32"):
        Settings(_env_file=None, app_env="production", jwt_secret="short").check()


def test_prod_accepts_strong_secret(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "x" * 48)
    Settings(_env_file=None, app_env="prod", jwt_secret="x" * 48).check()


def test_origins_parsed():
    s = Settings(_env_file=None, cors_origins="http://a.ru, http://b.ru ,")
    assert s.origins == ["http://a.ru", "http://b.ru"]
