from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

API_DIR = Path(__file__).resolve().parents[1]
PRODUCT_ROOT = API_DIR.parent   # project/destiny-matrix

# Ключа по умолчанию нет намеренно: захардкоженный секрет в репозитории означает, что любой
# читатель кода подделает токен на чужой user_id. Если JWT_SECRET не задан, ключ генерируется
# на процесс — токены переживают до перезапуска, чего для разработки достаточно, а прод
# обязан задать переменную явно.
def _generated_secret() -> str:
    import secrets
    return secrets.token_urlsafe(48)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")

    app_env: str = "dev"
    app_name: str = "Матрица судьбы — API"

    # прод ставит postgresql+psycopg2://…; sqlite по умолчанию, чтобы сервер поднимался
    # без внешней БД (контракт требует Postgres только на стенде)
    database_url: str = f"sqlite+pysqlite:///{API_DIR / 'var' / 'api.db'}"

    jwt_secret: str = Field(default_factory=_generated_secret)
    jwt_algorithm: str = "HS256"
    jwt_ttl_days: int = 30

    mock_payments: bool = True

    encyclopedia_dir: Path = PRODUCT_ROOT / "web" / "content"

    # Пусто = кросс-доменных запросов нет вообще. Браузер обращается только к своему origin:
    # страницы отдаёт node-сервер Next.js, а его BFF ходит в API с сервера, где CORS не
    # действует. Заполнять только под служебный клиент на другом домене (см. README).
    cors_origins: str = ""

    log_level: str = "info"

    api_prefix: str = "/api"

    matrices_hard_cap: int = Field(default=2000, ge=1)

    @field_validator("database_url")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_prod(self) -> bool:
        return self.app_env.lower() in ("prod", "production")

    def check(self) -> None:
        if not self.is_prod:
            return
        import os
        if not os.environ.get("JWT_SECRET"):
            raise RuntimeError("JWT_SECRET не задан: в проде ключ обязателен явно")
        if len(self.jwt_secret.encode()) < 32:
            raise RuntimeError("JWT_SECRET короче 32 байт: для HS256 этого мало")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
