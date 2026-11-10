"""Точки из книг Юлианы Лисовской, которых нет на схеме сайта: материальная карма, родовые линии,
промежуточные точки возрастной шкалы и матрица прогноза на год. Каждая формула сверена с
примером автора в `engine/tests/test_lisovskaya.py`."""
from __future__ import annotations

import calendar
import datetime as _dt

from .matrix import Matrix, _material_karma, digit_sum, fold

CORNERS = ("father_line", "mother_line", "descendants", "inheritance")


def material_karma(m: Matrix) -> list[int]:
    """C → Q → L: материальная задача, «отношение к материальному» (C + L), вход денег."""
    return _material_karma(m)


def parent_child_line(m: Matrix) -> list[int]:
    """A → O → J: внешнее проявление, отношение к детям (A + J), родители."""
    return [m.day, fold(m.day + m.comfort_west), m.comfort_west]


def family_strength(m: Matrix) -> int:
    """Центр родового квадрата: сумма четырёх угловых точек."""
    return fold(sum(getattr(m, key) for key in CORNERS))


def family_lines(m: Matrix) -> dict[str, list[int]]:
    """Линия от угла к силе рода в записи автора: угол → дальняя → ближняя к центру рода."""
    strength = family_strength(m)
    lines = {}
    for key in CORNERS:
        corner = getattr(m, key)
        near = fold(corner + strength)
        lines[key] = [corner, fold(corner + near), near]
    return lines


def age_points(m: Matrix) -> list[tuple[float, int]]:
    """Шкала по 2,5 года: десятилетия — из расчёта, середины — суммы ближайших известных точек.
    Круг замкнут: после 70 лет следующая известная точка — снова портрет (80 = 0)."""
    decades = [(p["from"], p["arcanum"]) for p in m.age_scale]
    points = []
    for (start, first), (_, second) in zip(decades, decades[1:] + decades[:1]):
        middle = fold(first + second)
        points += [(start, first), (start + 2.5, fold(first + middle)), (start + 5, middle),
                   (start + 7.5, fold(middle + second))]
    return points


def year_matrix(birth: _dt.date | str, year: int) -> dict[str, int]:
    """Индивидуальный прогноз на календарный год («Прогностика», «Прогноз на год»): к дате
    рождения прибавляется «дата года» — день = сумма дней года, месяц = сумма цифр года + 12."""
    born = birth if isinstance(birth, _dt.date) else _dt.date.fromisoformat(str(birth)[:10])
    days = 366 if calendar.isleap(year) else 365
    a = fold(fold(digit_sum(days)) + born.day)
    b = fold(digit_sum(year) + 12 + born.month)
    c = fold(digit_sum(born.year + year))
    d = fold(a + b + c)
    e = fold(a + b + c + d)
    points = {"A": a, "B": b, "C": c, "D": d, "E": e,
              "F": fold(a + b), "G": fold(b + c), "H": fold(c + d), "I": fold(d + a)}
    points["total"] = fold(sum(points.values()))
    return points


def _forecast(a: int, b: int, c: int) -> dict[str, int]:
    d = fold(a + b + c)
    e = fold(a + b + c + d)
    return {"A": a, "B": b, "C": c, "D": d, "E": e,
            "F": fold(a + b), "G": fold(b + c), "H": fold(c + d), "I": fold(d + a)}


def month_matrix(birth: _dt.date | str, year: int, month: int) -> dict[str, int]:
    """Индивидуальный прогноз на месяц: день месяца = сумма цифр года + номер месяца, правило
    12 месяцев не действует; дата месяца складывается с датой рождения."""
    born = birth if isinstance(birth, _dt.date) else _dt.date.fromisoformat(str(birth)[:10])
    # Like the year's month (7 + 12 = 19), the month's day is added whole, folded only in the sum.
    day = digit_sum(year) + month
    return _forecast(fold(day + born.day), fold(month + born.month), fold(digit_sum(born.year + year)))


def year_periods(y: dict[str, int]) -> list[dict[str, int]]:
    """Блок предназначений матрицы года, прочитанный по третям года: январь–апрель (Б+Г и А+В),
    май–август (Е+Ж и Ё+З), сентябрь–декабрь (сумма двух первых итогов)."""
    first = [fold(y["B"] + y["D"]), fold(y["A"] + y["C"])]
    second = [fold(y["F"] + y["H"]), fold(y["G"] + y["I"])]
    p1, p2 = fold(sum(first)), fold(sum(second))
    return [{"months": "01-04", "parts": first, "total": p1},
            {"months": "05-08", "parts": second, "total": p2},
            {"months": "09-12", "parts": [p1, p2], "total": fold(p1 + p2)}]


def year_ring(m: Matrix) -> list[tuple[float, int]]:
    """Годовые периоды на кольце: между точками через 2,5 года — ещё одна, через год после
    начала отрезка (1 = 0 + 2,5; 3,5 = 2,5 + 5)."""
    points = age_points(m)
    ring = []
    for (start, first), (_, second) in zip(points, points[1:] + points[:1]):
        ring += [(start, first), (start + 1, fold(first + second))]
    return ring
