"""Классическая матрица судьбы 22 энергий по буквенной схеме A–T.

Человекочитаемый контракт, обозначения и источники находятся в ``docs/methodology.md``,
машинный граф — в ``spec/method.json``. Этот модуль является каноническим исполняемым
движком; браузерный порт обязан проходить те же golden-векторы и полный parity-прогон.
"""
from __future__ import annotations

import datetime as _dt
from dataclasses import dataclass, field, asdict
from typing import Iterable

ARCANA_MAX = 22

CHAKRAS = (
    ("sahasrara", "Сахасрара", "связь с большим замыслом"),
    ("ajna", "Аджна", "видение и интуиция"),
    ("vishuddha", "Вишудха", "слово, честность, судьба"),
    ("anahata", "Анахата", "любовь и отношения"),
    ("manipura", "Манипура", "статус, воля, деньги"),
    ("svadhisthana", "Свадхистана", "радость, дети, творчество"),
    ("muladhara", "Муладхара", "тело, опора, материя"),
)

COLUMNS = (("physics", "Физика"), ("energy", "Энергия"), ("emotions", "Эмоции"))


def fold(n: int) -> int:
    """Свести положительное целое к 1..22 повторным сложением цифр.

    В отличие от остатка по модулю, 23 → 5, 31 → 4 и 44 → 8. Числа 1..22,
    включая самостоятельный 22-й аркан, остаются без изменения.
    """
    if not isinstance(n, int) or isinstance(n, bool) or n <= 0:
        raise ValueError(f"ожидалось положительное число, получено {n}")
    while n > ARCANA_MAX:
        n = digit_sum(n)
    return n


def digit_sum(n: int) -> int:
    return sum(int(c) for c in str(abs(n)))


def fold_year(year: int) -> int:
    """Год сворачивается по цифрам, пока не станет не больше 22: 1987 → 25 → 7."""
    return fold(digit_sum(year))


@dataclass(frozen=True)
class Triad:
    """Две линии и их сумма — так в методике устроены все парные блоки."""
    first: int
    second: int
    total: int

    @staticmethod
    def of(a: int, b: int) -> "Triad":
        return Triad(a, b, fold(a + b))

    def as_list(self) -> list[int]:
        return [self.first, self.second, self.total]


@dataclass(frozen=True)
class ChakraRow:
    key: str
    title: str
    hint: str
    physics: int
    energy: int
    emotions: int


@dataclass
class Matrix:
    birth: _dt.date
    sex: str

    # личностный квадрат: запад, север, восток, юг и центр
    day: int = 0
    month: int = 0
    year: int = 0
    mission: int = 0
    center: int = 0

    # духовный квадрат — исторические машинные ключи F–I сохранены для совместимости
    father_line: int = 0        # F, СЗ: духовная мужская линия рода
    mother_line: int = 0        # G, СВ: духовная женская линия рода
    descendants: int = 0        # H, ЮВ: материальная мужская линия рода
    inheritance: int = 0        # I, ЮЗ: материальная женская линия рода
    karmic_tail: list[int] = field(default_factory=list)

    # внутренние точки между внешними углами и центром J–M
    comfort_west: int = 0
    comfort_north: int = 0
    comfort_east: int = 0
    comfort_south: int = 0

    # предназначение
    sky: Triad | None = None            # небо: духовная задача
    ground: Triad | None = None         # земля: материальная задача
    social_male: Triad | None = None
    social_female: Triad | None = None
    harmony: int = 0                    # духовное предназначение
    planetary: int = 0                  # планетарное предназначение

    # линии
    money: list[int] = field(default_factory=list)
    love: list[int] = field(default_factory=list)
    talent: list[int] = field(default_factory=list)
    purpose_personal: int = 0
    purpose_social: int = 0

    chakras: list[ChakraRow] = field(default_factory=list)
    chakra_totals: dict[str, int] = field(default_factory=dict)
    age_scale: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["birth"] = self.birth.isoformat()
        for k in ("sky", "ground", "social_male", "social_female"):
            d[k] = self.__dict__[k].as_list() if self.__dict__[k] else None
        return d

    def values(self) -> Iterable[int]:
        """Все арканы матрицы — для проверок и для сбора ссылок в энциклопедию."""
        simple = [self.day, self.month, self.year, self.mission, self.center,
                  self.father_line, self.mother_line, self.descendants, self.inheritance,
                  self.comfort_west, self.comfort_north, self.comfort_east, self.comfort_south,
                  self.harmony, self.planetary, self.purpose_personal, self.purpose_social]
        for t in (self.sky, self.ground, self.social_male, self.social_female):
            if t:
                simple += t.as_list()
        simple += self.karmic_tail + self.money + self.love + self.talent
        for row in self.chakras:
            simple += [row.physics, row.energy, row.emotions]
        simple += list(self.chakra_totals.values())
        simple += [p["arcanum"] for p in self.age_scale]
        return simple


def _age_scale(m: Matrix) -> list[dict]:
    """Возрастная шкала: октаграмма проходится по кругу, каждый сектор — 10 лет.

    Восемь секторов по 10 лет закрывают 0–80. Внутри сектора аркан один: методика меняет
    энергию на границе, а не плавно, поэтому интерполяции здесь нет.
    """
    ring = [m.day, m.father_line, m.month, m.mother_line,
            m.year, m.descendants, m.mission, m.inheritance]
    out = []
    for i, arc in enumerate(ring):
        out.append({"from": i * 10, "to": i * 10 + 10, "arcanum": arc})
    return out


def _money_line(m: Matrix) -> list[int]:
    """Денежная программа L–R2–R: вход, направление и пересечение каналов."""
    crossing = fold(m.comfort_east + m.comfort_south)       # R = L + M
    direction = fold(m.comfort_east + crossing)             # R2 = L + R
    return [m.comfort_east, direction, crossing]             # L, R2, R


def _love_line(m: Matrix) -> list[int]:
    """Программа отношений M–R1–R: вход, партнёрская точка и пересечение."""
    crossing = fold(m.comfort_south + m.comfort_east)       # R = M + L
    partner = fold(m.comfort_south + crossing)               # R1 = M + R
    return [m.comfort_south, partner, crossing]               # M, R1, R


def _talent_line(m: Matrix) -> list[int]:
    """Личный талант по северному лучу B–P–K."""
    inner = m.comfort_north                                # K = B + E
    middle = fold(m.month + inner)                         # P = B + K
    return [m.month, middle, inner]                        # B, P, K


def _karmic_tail(m: Matrix) -> list[int]:
    """Кармический хвост M–N–D, в принятом продуктовом порядке от центра вниз."""
    inner = m.comfort_south                                # M = D + E
    middle = fold(m.mission + inner)                       # N = D + M
    return [inner, middle, m.mission]                      # M, N, D


def _chakras(m: Matrix) -> tuple[list[ChakraRow], dict[str, int]]:
    """Классическая чакровая таблица: семь горизонтальных пар схемы.

    Физика — точка слева/на материальной оси, энергия — парная точка сверху или
    справа; эмоции — их свёрнутая сумма. Никаких искусственных смещений по номеру
    строки в методике нет.
    """
    west_inner_2 = fold(m.day + m.comfort_west)             # O = A + J
    north_inner_2 = fold(m.month + m.comfort_north)         # P = B + K
    west_inner_3 = fold(m.comfort_west + m.center)           # S = J + E
    north_inner_3 = fold(m.comfort_north + m.center)         # T = K + E
    pairs = (
        (m.day, m.month),                                    # Сахасрара: A, B
        (west_inner_2, north_inner_2),                       # Аджна: O, P
        (m.comfort_west, m.comfort_north),                   # Вишудха: J, K
        (west_inner_3, north_inner_3),                       # Анахата: S, T
        (m.center, m.center),                                # Манипура: E, E
        (m.comfort_east, m.comfort_south),                   # Свадхистана: L, M
        (m.year, m.mission),                                 # Муладхара: C, D
    )
    rows: list[ChakraRow] = []
    for (key, title, hint), (physics, energy) in zip(CHAKRAS, pairs, strict=True):
        rows.append(ChakraRow(key, title, hint, physics, energy, fold(physics + energy)))
    totals = {
        "physics": fold(sum(r.physics for r in rows)),
        "energy": fold(sum(r.energy for r in rows)),
        "emotions": fold(sum(r.emotions for r in rows)),
    }
    return rows, totals


def calculate(birth: _dt.date | str, sex: str = "f") -> Matrix:
    """Полный расчёт. sex хранит идентичность карты, но не влияет ни на одно число."""
    if isinstance(birth, str):
        birth = _dt.date.fromisoformat(birth)
    if sex not in ("m", "f"):
        raise ValueError("sex должен быть 'm' или 'f'")
    today = _dt.date.today()
    if birth > today:
        raise ValueError("дата рождения в будущем")
    if birth.year < 1900:
        raise ValueError("поддерживаются даты рождения с 1900 года")

    m = Matrix(birth=birth, sex=sex)
    m.day = fold(birth.day)
    m.month = fold(birth.month)
    m.year = fold_year(birth.year)
    m.mission = fold(m.day + m.month + m.year)
    m.center = fold(m.day + m.month + m.year + m.mission)

    m.father_line = fold(m.day + m.month)
    m.mother_line = fold(m.month + m.year)
    m.descendants = fold(m.year + m.mission)
    m.inheritance = fold(m.mission + m.day)

    m.comfort_west = fold(m.day + m.center)
    m.comfort_north = fold(m.month + m.center)
    m.comfort_east = fold(m.year + m.center)
    m.comfort_south = fold(m.mission + m.center)

    # Предназначения считаются по диагоналям двух квадратов, а не по внутренним точкам.
    m.sky = Triad.of(m.month, m.mission)                      # B + D
    m.ground = Triad.of(m.day, m.year)                        # A + C
    m.social_male = Triad.of(m.father_line, m.descendants)
    m.social_female = Triad.of(m.mother_line, m.inheritance)
    m.purpose_personal = fold(m.sky.total + m.ground.total)
    m.purpose_social = fold(m.social_male.total + m.social_female.total)
    m.harmony = fold(m.purpose_personal + m.purpose_social)
    m.planetary = fold(m.purpose_social + m.harmony)

    m.money = _money_line(m)
    m.love = _love_line(m)
    m.talent = _talent_line(m)
    m.karmic_tail = _karmic_tail(m)
    m.chakras, m.chakra_totals = _chakras(m)
    m.age_scale = _age_scale(m)
    return m
