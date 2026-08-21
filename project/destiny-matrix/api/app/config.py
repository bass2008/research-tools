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

    # Почта. Без smtp_user и smtp_password отправка выключена: локально и в тестах письма
    # только пишутся в лог.
    smtp_host: str = "postbox.cloud.yandex.net"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    mail_from: str = "noreply@arcana-sense.ru"
    mail_from_name: str = "Arcana Sense"
    mail_reply_to: str = "hello@arcana-sense.ru"
    site_url: str = "https://arcana-sense.ru"

    # срок жизни ссылки на сброс пароля
    reset_ttl_hours: int = Field(default=4, ge=1, le=72)

    # Печать PDF. Браузер живёт отдельным контейнером: повышенные права нужны только ему,
    # и наши секреты он не видит. Без browser_url печать отключена.
    browser_url: str = ""
    browser_secret: str = ""
    browser_timeout_seconds: int = Field(default=180, ge=10, le=900)
    # адрес, по которому браузер видит фронт (внутренняя сеть compose)
    web_internal_url: str = "http://web:3000"
    print_token_ttl_seconds: int = Field(default=120, ge=30, le=900)

    # Object Storage под готовые отчёты. Без ключей печать отключена — файлу негде лежать.
    s3_endpoint: str = "https://storage.yandexcloud.net"
    s3_region: str = "ru-central1"
    s3_reports_bucket: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    report_link_ttl_seconds: int = Field(default=3600, ge=60, le=86_400)

    # Админ — это конфиг, а не колонка в users: схема без миграций, и новая колонка заставила бы
    # пересоздавать таблицу. Список почт через запятую; сид создаёт первую из них, чтобы после
    # чистки базы админ существовал всегда.
    admin_emails: str = "snborodaenko@mail.ru"
    admin_password: str = "123"


    @field_validator("database_url")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @property
    def admins(self) -> list[str]:
        return [e.strip().lower() for e in self.admin_emails.split(",") if e.strip()]

    @property
    def pdf_enabled(self) -> bool:
        return bool(self.browser_url and self.s3_reports_bucket and self.s3_access_key)

    def is_admin(self, email: str | None) -> bool:
        return bool(email) and email.strip().lower() in self.admins

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
        # печать включена, а секрет браузерного сервиса дефолтный — значит напечатать что угодно
        # может любой, кто попал во внутреннюю сеть
        if self.browser_url and self.browser_secret in ("", "dev-browser-secret"):
            raise RuntimeError("BROWSER_SECRET не задан: печать в проде без него открыта всем")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
