from __future__ import annotations

import sys
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

API_DIR = Path(__file__).resolve().parents[1]
PRODUCT_ROOT = API_DIR.parent   # project/destiny-matrix

# Движок лежит рядом с сервисом, а не ставится пакетом. Путь добавляется здесь: config
# импортируют все, поэтому `import engine.*` работает независимо от порядка импортов.
if str(PRODUCT_ROOT) not in sys.path:
    sys.path.insert(0, str(PRODUCT_ROOT))

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

    # Пусто = кросс-доменных запросов нет вообще. Браузер обращается только к своему origin:
    # страницы отдаёт node-сервер Next.js, а его BFF ходит в API с сервера, где CORS не
    # действует. Заполнять только под служебный клиент на другом домене (см. README).
    cors_origins: str = ""

    log_level: str = "info"

    api_prefix: str = "/api"

    matrices_hard_cap: int = Field(default=2000, ge=1)

    # Боевой pulse пишет последнее появление пакетно раз в час. Локальный compose переопределяет
    # интервал на минуту, чтобы поведение можно было проверить без часового ожидания.
    presence_flush_seconds: int = Field(default=3600, ge=60, le=86_400)

    # Почта. Без smtp_user и smtp_password отправка выключена: локально и в тестах письма
    # только пишутся в лог.
    smtp_host: str = "postbox.cloud.yandex.net"
    smtp_port: int = 587
    # стенд и браузерные сценарии не должны слать письма людям: письмо уходит в лог
    mail_to_log: bool = False
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
    # сколько ждать печать, уже запущенную другим запросом, прежде чем печатать самим
    print_wait_seconds: int = Field(default=120, ge=1, le=600)
    # печатать разбор сразу после оплаты, не дожидаясь нажатия «Сохранить как PDF»
    print_warmup: bool = True
    # сколько печатей идёт одновременно: каждая держит около 65 МБ в браузерном контейнере, а он
    # ограничен 512 МБ. Замер на проде: пять печатей — 352 МБ, то есть семь уже убили бы браузер
    print_slots: int = Field(default=3, ge=1, le=16)
    # сколько живёт начатый, но не оплаченный платёж: в это окно человека возвращают к нему,
    # а не выставляют второй счёт за ту же дату
    payment_reuse_seconds: int = Field(default=1800, ge=60, le=86_400)

    # Через сколько считать неоплаченный платёж брошенным. Человек ушёл с формы банка — счёт
    # больше не спрашиваем: иначе досверка сутки дёргает банк каждые пять минут и плодит записи.
    # Настоящий случай «оплатил, а уведомление не дошло» ловится в первые минуты.
    payment_abandon_seconds: int = Field(default=1800, ge=300, le=86_400)

    # Кем принимать оплату: пусто — живым эквайрингом, если он настроен, иначе моком. Явное имя
    # нужно браузерным сценариям: они не должны ходить в банк.
    payment_provider: str = ""

    # Эквайринг Т-Банка. Без ключей приём оплаты остаётся мок-режимом.
    tbank_terminal_key: str = ""
    tbank_password: str = ""
    tbank_api_url: str = "https://securepay.tinkoff.ru/v2"
    tbank_timeout_seconds: int = Field(default=20, ge=5, le=120)

    # Чек в налоговую отправляет банк, но состав чека передаём мы: боевой терминал с включённой
    # фискализацией отклоняет платёж без него (код 309). Значения зависят от режима ИП и потому
    # лежат здесь — переход с патента на УСН правится в .env на машине, без релиза.
    tbank_taxation: str = "patent"
    tbank_vat: str = "none"
    # Патент выдан на разработку ПО (пп. 62 п. 2 ст. 346.43 НК РФ), и предмет договора — работы по
    # адаптации web-страницы под параметры заказчика. Поэтому в чеке «работа», а не «услуга», а
    # наименование позиции задаётся здесь и не зависит от витринного названия тарифа.
    # «job» — это и есть «работа» по ФФД. Похожее «work» тестовый терминал принимает молча, а
    # боевой с фискализацией отвечает «поле paymentObject не должно быть пустым»: неизвестное
    # значение он считает пустым, и платёж не начинается вовсе.
    tbank_payment_object: str = "job"
    tbank_payment_method: str = "full_payment"
    # Наименование читают двое: налоговая должна увидеть вид деятельности из патента,
    # покупатель — за что он заплатил. Поэтому в одной строке и то, и другое.
    tbank_item_name: str = ("Адаптация web-страницы: персональный расчёт матрицы судьбы "
                            "по дате рождения")
    # Описание заказа на форме банка видит только покупатель, никакой отчётности в нём нет —
    # поэтому здесь язык продукта, а вид деятельности остаётся в наименовании позиции чека.
    tbank_order_description: str = "Матрица судьбы — персональный разбор по дате рождения"

    # Админ — оперативный список доступа, а не свойство профиля в users. Список почт через
    # запятую; сид создаёт первую из них, чтобы после чистки базы админ существовал всегда.
    admin_emails: str = "snborodaenko@mail.ru"
    admin_password: str = "123"

    # Куда отправлять свои метрики: folderId в Yandex Cloud. Пусто — собираем для админки, но
    # никуда не шлём (так работает локальный стенд и тесты). Токен берётся из метаданных
    # виртуалки, ключей в файлах нет.
    monitoring_folder: str = ""
    monitoring_interval_seconds: int = Field(default=60, ge=15, le=600)
    build_commit: str = "—"


    @field_validator("database_url")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @property
    def admins(self) -> list[str]:
        return [e.strip().lower() for e in self.admin_emails.split(",") if e.strip()]

    @property
    def tbank_enabled(self) -> bool:
        return bool(self.tbank_terminal_key and self.tbank_password)

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
        if "jwt_secret" not in self.model_fields_set or not self.jwt_secret:
            raise RuntimeError("JWT_SECRET не задан: в проде ключ обязателен явно")
        if len(self.jwt_secret.encode()) < 32:
            raise RuntimeError("JWT_SECRET короче 32 байт: для HS256 этого мало")
        # печать включена, а секрет браузерного сервиса дефолтный — значит напечатать что угодно
        # может любой, кто попал во внутреннюю сеть
        if self.browser_url and self.browser_secret in ("", "dev-browser-secret"):
            raise RuntimeError("BROWSER_SECRET не задан: печать в проде без него открыта всем")


SENSITIVE_SETTINGS = frozenset({
    "database_url",
    "jwt_secret",
    "smtp_user",
    "smtp_password",
    "browser_secret",
    "s3_access_key",
    "s3_secret_key",
    "tbank_terminal_key",
    "tbank_password",
    "admin_password",
    "monitoring_folder",
})


def _setting_text(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return ""
    return str(value)


def _masked_setting(value: Any) -> str:
    """Админ видит, какой секрет загружен, но не получает секрет целиком.

    У длинных значений оставляем шесть первых символов — этого хватает, чтобы отличить два
    ключа при настройке стенда. Короткий секрет скрываем целиком: иначе «обрезка» раскрыла бы
    его полностью (в частности, старый локальный ADMIN_PASSWORD=123).
    """
    text = _setting_text(value)
    if not text:
        return "не задано"
    return f"{text[:6]}…" if len(text) > 6 else "••••••"


class SettingManager:
    """Единственная runtime-точка чтения backend-настроек.

    Pydantic один раз загружает и валидирует окружение при старте процесса. Дальше приложение
    читает неизменяемый снимок из памяти через этот объект, а не обращается к ``os.environ``.
    """

    def __init__(self, loaded: Settings):
        self._values = loaded.model_dump()
        self._provided = frozenset(loaded.model_fields_set)

    def __setattr__(self, name: str, value: Any) -> None:
        # pytest подменяет настройки через monkeypatch. Даже такой override должен менять
        # хранилище manager-а, а не создавать рядом теневой атрибут в обход get()/snapshot().
        values = self.__dict__.get("_values")
        if values is not None and name in values:
            values[name] = value
            return
        object.__setattr__(self, name, value)

    def get(self, name: str) -> Any:
        if name not in self._values:
            raise KeyError(f"Неизвестная backend-настройка: {name}")
        return self._values[name]

    def __getattr__(self, name: str) -> Any:
        # Старый читаемый интерфейс settings.foo сохраняется, но фактически тоже проходит через
        # manager. Методы ниже объявлены явно и не попадают в эту ветку.
        if name in self._values:
            return self.get(name)
        raise AttributeError(name)

    @property
    def admins(self) -> list[str]:
        return [e.strip().lower() for e in self.get("admin_emails").split(",") if e.strip()]

    @property
    def tbank_enabled(self) -> bool:
        return bool(self.get("tbank_terminal_key") and self.get("tbank_password"))

    @property
    def pdf_enabled(self) -> bool:
        return bool(self.get("browser_url") and self.get("s3_reports_bucket")
                    and self.get("s3_access_key"))

    def is_admin(self, email: str | None) -> bool:
        return bool(email) and email.strip().lower() in self.admins

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.get("cors_origins").split(",") if o.strip()]

    @property
    def is_prod(self) -> bool:
        return self.get("app_env").lower() in ("prod", "production")

    def check(self) -> None:
        if not self.is_prod:
            return
        if "jwt_secret" not in self._provided or not self.get("jwt_secret"):
            raise RuntimeError("JWT_SECRET не задан: в проде ключ обязателен явно")
        if len(self.get("jwt_secret").encode()) < 32:
            raise RuntimeError("JWT_SECRET короче 32 байт: для HS256 этого мало")
        if self.get("browser_url") and self.get("browser_secret") in ("", "dev-browser-secret"):
            raise RuntimeError("BROWSER_SECRET не задан: печать в проде без него открыта всем")

    def snapshot(self) -> list[dict[str, Any]]:
        """Безопасное представление всех известных backend-переменных для админки."""
        rows: list[dict[str, Any]] = []
        for name, value in self._values.items():
            sensitive = (name in SENSITIVE_SETTINGS or "password" in name or "secret" in name
                         or name.endswith("_token") or name.endswith("_key")
                         or "access_key" in name)
            source = ("environment" if name in self._provided else
                      "generated" if name == "jwt_secret" else "default")
            rows.append({
                "component": "api",
                "name": name.upper(),
                "value": _masked_setting(value) if sensitive else _setting_text(value),
                "source": source,
                "sensitive": sensitive,
                "configured": bool(_setting_text(value)),
            })
        return rows


@lru_cache
def get_settings() -> SettingManager:
    return SettingManager(Settings())


settings = get_settings()
