"""Тесты движка матрицы. Гоняются отдельно от наборов конвейера ниш:

    conda run -n research3.12 python -m pytest engine/tests -q
"""
import datetime as dt
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from engine.matrix import (ARCANA_MAX, CHAKRAS, Matrix, Triad, calculate, digit_sum,  # noqa: E402
                           fold, fold_year)


class TestFold:
    def test_range(self):
        assert [fold(n) for n in (1, 21, 22, 23, 44, 45)] == [1, 21, 22, 1, 22, 1]

    def test_no_zero_arcanum(self):
        """Ноль недопустим: Шут в матрице двадцать второй, а не нулевой."""
        assert all(fold(22 * k) == 22 for k in range(1, 20))

    def test_rejects_nonpositive(self):
        for bad in (0, -1, -22):
            with pytest.raises(ValueError):
                fold(bad)

    def test_idempotent_on_range(self):
        assert all(fold(fold(n)) == fold(n) for n in range(1, 200))


class TestYear:
    def test_examples(self):
        assert fold_year(1987) == 7      # 1+9+8+7=25 → 2+5=7
        assert fold_year(2000) == 2
        # 1999 → 28 → 10 и на этом останов: 10 — валидный аркан, сворачивать до одной цифры
        # нельзя, иначе в позиции года никогда не появятся арканы с 10 по 22
        assert fold_year(1999) == 10

    def test_always_in_range(self):
        assert all(1 <= fold_year(y) <= ARCANA_MAX for y in range(1900, 2031))

    def test_digit_sum(self):
        assert digit_sum(1987) == 25 and digit_sum(0) == 0


class TestValidation:
    def test_future_date_rejected(self):
        with pytest.raises(ValueError, match="будущем"):
            calculate(dt.date.today() + dt.timedelta(days=1))

    def test_too_old_rejected(self):
        with pytest.raises(ValueError, match="1900"):
            calculate("1899-12-31")

    def test_bad_sex_rejected(self):
        with pytest.raises(ValueError, match="sex"):
            calculate("1987-06-14", sex="x")

    def test_accepts_string_and_date(self):
        a = calculate("1987-06-14")
        b = calculate(dt.date(1987, 6, 14))
        assert a.to_dict() == b.to_dict()


class TestStructure:
    @pytest.fixture
    def m(self) -> Matrix:
        return calculate("1987-06-14", "m")

    def test_base_square(self, m):
        assert (m.day, m.month, m.year) == (14, 6, 7)
        assert m.mission == fold(m.day + m.month + m.year)
        assert m.center == fold(m.day + m.month + m.year + m.mission)

    def test_diagonals_are_sums_of_neighbours(self, m):
        assert m.father_line == fold(m.day + m.month)
        assert m.mother_line == fold(m.month + m.year)
        assert m.descendants == fold(m.year + m.mission)
        assert m.inheritance == fold(m.mission + m.day)

    def test_triads_sum_up(self, m):
        for t in (m.sky, m.ground, m.social_male, m.social_female):
            assert t.total == fold(t.first + t.second)

    def test_purpose_derived_from_triads(self, m):
        assert m.harmony == fold(m.sky.total + m.ground.total)
        assert m.planetary == fold(m.social_male.total + m.social_female.total)

    def test_chakras_shape(self, m):
        assert len(m.chakras) == len(CHAKRAS) == 7
        assert [r.key for r in m.chakras] == [c[0] for c in CHAKRAS]
        for r in m.chakras:
            assert r.emotions == fold(r.physics + r.energy)

    def test_chakra_rows_differ(self, m):
        """Сдвиг по номеру чакры обязан разводить строки, иначе таблица бессмысленна."""
        assert len({(r.physics, r.energy) for r in m.chakras}) == 7

    def test_lines_have_three_values(self, m):
        for line in (m.money, m.love, m.talent, m.karmic_tail):
            assert len(line) == 3
            assert line[2] == fold(line[0] + line[1])

    def test_age_scale_covers_eighty_years(self, m):
        assert len(m.age_scale) == 8
        assert m.age_scale[0]["from"] == 0 and m.age_scale[-1]["to"] == 80
        bounds = [(p["from"], p["to"]) for p in m.age_scale]
        assert all(b[1] == bounds[i + 1][0] for i, b in enumerate(bounds[:-1]))


class TestInvariantsOverAllDates:
    """Свойства, которые обязаны держаться на любой дате, а не на одной удачной."""

    DATES = [dt.date(y, mth, d)
             for y in (1900, 1953, 1987, 2000, 2024)
             for mth in (1, 2, 6, 12)
             for d in (1, 9, 22, 28)]

    def test_every_value_in_range(self):
        for b in self.DATES:
            m = calculate(b)
            bad = [v for v in m.values() if not 1 <= v <= ARCANA_MAX]
            assert not bad, f"{b}: вне диапазона {bad}"

    def test_deterministic(self):
        for b in self.DATES[:8]:
            assert calculate(b).to_dict() == calculate(b).to_dict()

    def test_sex_does_not_change_numbers(self):
        """Пол влияет на подписи родовых линий, но не на арифметику."""
        for b in self.DATES[:8]:
            male, female = calculate(b, "m"), calculate(b, "f")
            assert list(male.values()) == list(female.values())

    def test_february_29_supported(self):
        m = calculate("2000-02-29")
        assert m.day == fold(29) == 7

    def test_different_dates_give_different_matrices(self):
        seen = {tuple(calculate(b).values()) for b in self.DATES}
        assert len(seen) > len(self.DATES) * 0.8, "слишком много совпадений — формулы теряют вход"

    def test_serialisation_round_trip(self):
        d = calculate("1987-06-14", "f").to_dict()
        assert d["birth"] == "1987-06-14" and d["sex"] == "f"
        assert d["sky"] == [d["comfort_north"], d["comfort_south"],
                            fold(d["comfort_north"] + d["comfort_south"])]
        assert len(d["chakras"]) == 7


class TestTriad:
    def test_of_and_as_list(self):
        t = Triad.of(20, 15)
        assert t.as_list() == [20, 15, fold(35)] == [20, 15, 13]

    def test_frozen(self):
        with pytest.raises(Exception):
            Triad.of(1, 2).first = 5
