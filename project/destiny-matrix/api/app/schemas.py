from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

Sex = Literal["m", "f"]
# идентификаторы тарифов лежат в базе, поэтому здесь свободная строка:
# существование проверяет роутер и отвечает 404, а не 422
TariffId = str


class BirthIn(BaseModel):
    birth: dt.date
    sex: Sex = "f"


class MatrixIn(BirthIn):
    title: str | None = Field(default=None, max_length=200)


class MatrixTitleIn(BaseModel):
    # пустая строка — сброс подписи: в кабинете тогда снова показывается дата
    title: str | None = Field(default=None, max_length=200)


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=3, max_length=200)

    @field_validator("email")
    @classmethod
    def _normalize(cls, v: str) -> str:
        return v.strip().lower()


class ResetRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def _normalize(cls, v: str) -> str:
        return v.strip().lower()


class ResetApply(BaseModel):
    token: str = Field(min_length=20, max_length=2000)
    password: str = Field(min_length=3, max_length=200)


class ReadingIn(BaseModel):
    product: str = Field(min_length=1, max_length=32)
    # ввод продукта; проверяет и приводит к хранимому виду сам продукт (`products.py`)
    inputs: dict
    title: str | None = Field(default=None, max_length=200)


class PaymentIn(BaseModel):
    provider: str | None = Field(default=None, pattern=r"^[a-z][a-z0-9_-]{0,31}$")
    # код предложения; поле зовётся по-старому, потому что так его шлёт фронт
    tariff: TariffId
    email: EmailStr
    # разовое предложение привязывается к разбору: либо он уже сохранён, либо сервер создаст его
    # из ввода. matrix_id и birth/sex — прежняя форма для личного разбора
    reading_id: int | None = None
    inputs: dict | None = None
    matrix_id: int | None = None
    birth: dt.date | None = None
    sex: Sex | None = None
    @field_validator("email")
    @classmethod
    def _normalize(cls, v: str) -> str:
        return v.strip().lower()


class ReportRequest(BaseModel):
    reading_id: int | None = None
    # прежнее имя поля для личного разбора
    matrix_id: int | None = None
    # печать заново поверх готового файла: нужна, когда в отчёте оказалось не то
    fresh: bool = False


class PaymentRef(BaseModel):
    order_id: str


class PulseIn(BaseModel):
    """Отметка присутствия: идентификаторы анонимны, аккаунт определяется только по JWT."""
    visitor: str = Field(min_length=6, max_length=64)
    # Необязателен на время обновления: уже открытые страницы старой версии ещё 45 секунд
    # присылают только visitor. Для них visitor одновременно служит ключом вкладки.
    tab: str | None = Field(default=None, min_length=6, max_length=64)
    path: str = Field(default="/", max_length=200)


class MetrikaClientIn(BaseModel):
    counter_id: int = Field(gt=0, le=9007199254740991)
    client_id: str = Field(pattern=r"^[0-9]{1,64}$")
