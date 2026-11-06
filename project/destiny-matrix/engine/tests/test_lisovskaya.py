"""Формулы Лисовской сверены с её собственными примерами, а не с выводом нашего кода."""
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from engine.lisovskaya import (age_points, family_lines, family_strength, material_karma, month_matrix,  # noqa: E402
                               year_matrix, year_periods, year_ring)
from engine.matrix import Matrix, calculate  # noqa: E402


def test_material_karma_matches_author_example():
    # «Для начинающих», материальная карма: пример автора 8-19-11 (C, Q, L).
    m = Matrix(birth=dt.date(2000, 1, 1), sex="f", year=8, comfort_east=11)
    assert material_karma(m) == [8, 19, 11]


def test_family_lines_match_author_example():
    # «Для начинающих», родовой квадрат: 14.08.1953 — углы 22, 8, 22, 18, сила рода 7,
    # линии 22-6-11, 8-5-15, 18-7-7.
    m = calculate("1953-08-14")
    assert [m.father_line, m.mother_line, m.descendants, m.inheritance] == [22, 8, 22, 18]
    assert family_strength(m) == 7
    lines = family_lines(m)
    assert lines["father_line"] == [22, 6, 11]
    assert lines["mother_line"] == [8, 5, 15]
    assert lines["inheritance"] == [18, 7, 7]


def test_age_points_match_author_example():
    # «Прогностика», годовой период: 31.10.1993 — 5 лет = 4 + 14 = 18, 15 лет = 6, 25 лет = 15.
    points = dict(age_points(calculate("1993-10-31")))
    assert (points[5], points[15], points[25]) == (18, 6, 15)
    assert points[2.5] == 22 and len(points) == 32


def test_year_matrix_matches_author_example():
    # «Прогностика», прогноз на год: 28.07.1991 на 2023 — дата года 14.19.2023,
    # точки А 6, Б 8, В 9, Г 5, Д 10, Е 14, Ё 17, Ж 14, З 11.
    y = year_matrix("1991-07-28", 2023)
    assert [y[k] for k in "ABCDEFGHI"] == [6, 8, 9, 5, 10, 14, 17, 14, 11]


def test_year_matrix_counts_leap_years():
    assert year_matrix("1991-07-28", 2024)["A"] == 6 + 1


def test_month_matrix_matches_author_example():
    # «Прогностика», прогноз на месяц: 30.06.1998 на июнь 2023 — дата месяца 13.06.2023,
    # точки А 7, Б 12, В 7, Г 8, Д 7, Е 19, Ё 19, Ж 15, З 15.
    m = month_matrix("1998-06-30", 2023, 6)
    assert [m[k] for k in "ABCDEFGHI"] == [7, 12, 7, 8, 7, 19, 19, 15, 15]


def test_year_periods_match_author_example():
    # «Прогностика», блок предназначений года для 28.07.1991 на 2023: 13 и 15 → 10;
    # 10 и 10 → 20; третий период 10 + 20 → 3.
    periods = year_periods(year_matrix("1991-07-28", 2023))
    assert [(p["parts"], p["total"]) for p in periods] == [([13, 15], 10), ([10, 10], 20), ([10, 20], 3)]


def test_year_ring_matches_author_example():
    # «Прогностика», годовой период: 31.10.1993 — 0 лет 4, 1 год 8, 2,5 года 22, 3,5 года 4,
    # 5 лет 18, 7,5 лет 5, 15 лет 6, 25 лет 15.
    ring = dict(year_ring(calculate("1993-10-31")))
    assert [ring[a] for a in (0, 1, 2.5, 3.5, 5, 7.5, 15, 25)] == [4, 8, 22, 4, 18, 5, 6, 15]


def test_month_day_is_added_whole_like_the_year_month():
    # Декабрь 2027: день месяца 11 + 12 = 23 складывается целиком, как 19 у месяца года: 23 + 7 = 30 → 3.
    assert month_matrix("1988-10-07", 2027, 12)["A"] == 3
