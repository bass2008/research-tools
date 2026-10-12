"""Калькуляторы, которые продаются: чем каждый отличается от остальных.

Деньги, права, печать, кабинет и админка устроены одинаково для любого продукта и работают с
разбором (`Reading`) — продукт плюс введённые данные. Здесь лежит только то, что у продуктов
своё: какие данные вводят, когда два ввода — один и тот же разбор, как его подписать и где его
напечатать.
"""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import Callable

from engine.matrix import calculate

from .i18n import say

PERSONAL = "personal"
PAIR = "pair"
ANY = "*"

NAME_LIMIT = 60


@dataclass(frozen=True)
class Product:
    code: str
    # Проверить ввод и привести его к виду, который хранится. ValueError — ввод не годится.
    normalize: Callable[[dict], dict]
    # Два ввода с одним ключом — один разбор: повторное сохранение не плодит записи.
    subject_key: Callable[[dict], str]
    default_title: Callable[[dict], str]
    # Страница печати и имя параметра, в котором она ждёт номер разбора.
    print_path: str
    print_param: str
    # Куда ведёт письмо о покупке.
    page: Callable[[int], str]


def _birth(value: object) -> str:
    if isinstance(value, dt.date):
        birth = value
    else:
        try:
            birth = dt.date.fromisoformat(str(value))
        except ValueError:
            raise ValueError(say("reading.bad_date")) from None
    calculate(birth, "f")
    return birth.isoformat()


def _name(value: object) -> str | None:
    if value is None:
        return None
    name = " ".join(str(value).split())[:NAME_LIMIT]
    return name or None


def date_label(birth: str) -> str:
    day = dt.date.fromisoformat(birth)
    months = say("matrix.months").split()
    return say("reading.date", day=day.day, month=months[day.month - 1], year=day.year)


def _personal(inputs: dict) -> dict:
    sex = inputs.get("sex") or "f"
    if sex not in ("m", "f"):
        raise ValueError(say("matrix.invalid_sex"))
    return {"birth": _birth(inputs.get("birth")), "sex": sex}


def _personal_title(inputs: dict) -> str:
    day = dt.date.fromisoformat(inputs["birth"])
    months = say("matrix.months").split()
    return say("matrix.default_title", day=day.day, month=months[day.month - 1], year=day.year)


def _partner(value: object) -> dict:
    if not isinstance(value, dict):
        raise ValueError(say("reading.bad_date"))
    return {"birth": _birth(value.get("birth")), "name": _name(value.get("name"))}


def _pair(inputs: dict) -> dict:
    return {"a": _partner(inputs.get("a")), "b": _partner(inputs.get("b"))}


def _pair_title(inputs: dict) -> str:
    a, b = inputs["a"], inputs["b"]
    if a.get("name") and b.get("name"):
        return say("reading.pair_names", a=a["name"], b=b["name"])
    return say("reading.pair_dates", a=date_label(a["birth"]), b=date_label(b["birth"]))


PRODUCTS: dict[str, Product] = {
    PERSONAL: Product(
        code=PERSONAL,
        normalize=_personal,
        # Decision 1: пол не меняет разбор, но запись с другим полом — другая запись, как и раньше.
        subject_key=lambda inputs: f"{inputs['birth']}|{inputs['sex']}",
        default_title=_personal_title,
        print_path="/print/report",
        print_param="m",
        page=lambda reading_id: f"/report?m={reading_id}",
    ),
    PAIR: Product(
        code=PAIR,
        normalize=_pair,
        # Матрица пары — сумма двух матриц, порядок партнёров её не меняет.
        subject_key=lambda inputs: "|".join(sorted((inputs["a"]["birth"], inputs["b"]["birth"]))),
        default_title=_pair_title,
        print_path="/print/pair",
        print_param="r",
        page=lambda reading_id: f"/readings/{reading_id}",
    ),
}


def get(code: str | None) -> Product | None:
    return PRODUCTS.get(code or "")


def covers(products: list[str], code: str) -> bool:
    return ANY in products or code in products
