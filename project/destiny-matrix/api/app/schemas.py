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


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)

    @field_validator("email")
    @classmethod
    def _normalize(cls, v: str) -> str:
        return v.strip().lower()


class PaymentIn(BaseModel):
    tariff: TariffId
    email: EmailStr
    # разовый тариф привязывается к матрице: либо она уже сохранена, либо сервер создаст её сам
    matrix_id: int | None = None
    birth: dt.date | None = None
    sex: Sex | None = None

    @field_validator("email")
    @classmethod
    def _normalize(cls, v: str) -> str:
        return v.strip().lower()


class LeadIn(BaseModel):
    email: EmailStr
    source: str | None = Field(default=None, max_length=64)

    @field_validator("email")
    @classmethod
    def _normalize(cls, v: str) -> str:
        return v.strip().lower()
