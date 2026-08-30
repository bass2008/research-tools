import pytest
import re
from pathlib import Path

from app.config import SettingManager, Settings, settings


def test_defaults_are_dev_friendly():
    s = Settings(_env_file=None)
    assert s.jwt_ttl_days == 30
    assert s.mock_payments is True
    assert s.api_prefix == "/api"
    assert s.presence_flush_seconds == 3600
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


def test_setting_manager_is_the_runtime_entry_point():
    manager = SettingManager(Settings(_env_file=None, app_name="test application"))
    assert manager.get("app_name") == "test application"
    assert manager.app_name == "test application"
    assert isinstance(settings, SettingManager)
    with pytest.raises(KeyError, match="Неизвестная"):
        manager.get("does_not_exist")


def test_setting_snapshot_masks_secrets_and_reports_sources():
    secret = "secret-value-that-must-never-leak"
    manager = SettingManager(Settings(_env_file=None, jwt_secret=secret, admin_password="123"))
    rows = {row["name"]: row for row in manager.snapshot()}

    assert rows["JWT_SECRET"]["value"] == "secret…"
    assert secret not in str(rows)
    assert rows["JWT_SECRET"]["source"] == "environment"
    assert rows["JWT_SECRET"]["sensitive"] is True
    assert rows["SMTP_USER"]["sensitive"] is True
    assert rows["ADMIN_PASSWORD"]["value"] == "••••••"
    assert rows["APP_NAME"]["sensitive"] is False
    assert rows["PRINT_TOKEN_TTL_SECONDS"]["sensitive"] is False


def test_setting_manager_prod_check_uses_loaded_snapshot(monkeypatch):
    # После startup окружение не читается повторно: проверяется значение в manager.
    monkeypatch.delenv("JWT_SECRET", raising=False)
    manager = SettingManager(Settings(_env_file=None, app_env="prod", jwt_secret="x" * 48))
    manager.check()


def test_application_does_not_read_environment_outside_config_manager():
    app_dir = Path(__file__).resolve().parents[1] / "app"
    direct_read = re.compile(r"os\.(?:getenv\s*\(|environ\s*\[|environ\.get\s*\()")
    violations = [str(path.relative_to(app_dir)) for path in app_dir.rglob("*.py")
                  if direct_read.search(path.read_text())]
    assert violations == []
