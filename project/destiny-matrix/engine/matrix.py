"""Расчёт матрицы судьбы: 22 энергии, октаграмма, чакры, линии, возрастная шкала.

Все значения приводятся к диапазону 1..22 функцией `fold`: в методике нет нулевого аркана,
Шут стоит двадцать вторым, поэтому кратные 22 сводятся к 22, а не к нулю.

Формулы собраны здесь намеренно: методика существует в нескольких пересказах, и когда
понадобится сверить её с источником, править нужно одно место, а не весь код. Каждая
формула названа так же, как позиция в отчёте.
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
    """Свести число к 1..22. Кратные 22 дают 22: нулевого аркана в матрице нет."""
    if n <= 0:
        raise ValueError(f"ожидалось положительное число, получено {n}")
    r = n % ARCANA_MAX
    return r if r else ARCANA_MAX


def digit_sum(n: int) -> int:
    return sum(int(c) for c in str(abs(n)))


def fold_year(year: int) -> int:
    """Год сворачивается по цифрам, пока не станет не больше 22: 1987 → 25 → 7."""
    n = digit_sum(year)
    while n > ARCANA_MAX:
        n = digit_sum(n)
    return n


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

    # духовный квадрат — диагонали, по часовой от северо-запада
    father_line: int = 0        # СЗ: мужская линия рода
    mother_line: int = 0        # СВ: женская линия рода
    descendants: int = 0        # ЮВ: то, что уходит дальше по роду
    inheritance: int = 0        # ЮЗ: то, что получено родом
    karmic_tail: list[int] = field(default_factory=list)

    # точки между углами и центром — «зоны комфорта»
    comfort_west: int = 0
    comfort_north: int = 0
    comfort_east: int = 0
    comfort_south: int = 0

    # предназначение
    sky: Triad | None = None            # небо: духовная задача
    ground: Triad | None = None         # земля: материальная задача
    social_male: Triad | None = None
    social_female: Triad | None = None
    harmony: int = 0                    # духовная гармония
    planetary: int = 0                  # планетарная задача

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
    """Денежный канал: юго-восточная диагональ, её связь с центром и итог."""
    a = m.descendants
    b = fold(a + m.center)
    return [a, b, fold(a + b)]


def _love_line(m: Matrix) -> list[int]:
    """Линия отношений: северо-восток (женская линия), связь с центром и итог."""
    a = m.mother_line
    b = fold(a + m.center)
    return [a, b, fold(a + b)]


def _talent_line(m: Matrix) -> list[int]:
    """Таланты: север (что дано) в связке с центром."""
    a = m.month
    b = fold(a + m.center)
    return [a, b, fold(a + b)]


def _karmic_tail(m: Matrix) -> list[int]:
    """Кармический хвост: род, полученное наследие и их сумма."""
    return [m.year, m.inheritance, fold(m.year + m.inheritance)]


def _chakras(m: Matrix) -> tuple[list[ChakraRow], dict[str, int]]:
    """Семь чакр в трёх колонках.

    Физика идёт от линии запад-восток (что есть в материи), энергия — от линии
    север-юг (что дано и куда идём), эмоции — сумма первых двух, как в таблице методики.
    Сдвиг по номеру чакры разводит строки: без него все семь были бы одинаковыми.
    """
    rows: list[ChakraRow] = []
    for i, (key, title, hint) in enumerate(CHAKRAS, start=1):
        physics = fold(m.day + m.year + i)
        energy = fold(m.month + m.mission + i)
        rows.append(ChakraRow(key, title, hint, physics, energy, fold(physics + energy)))
    totals = {
        "physics": fold(sum(r.physics for r in rows)),
        "energy": fold(sum(r.energy for r in rows)),
        "emotions": fold(sum(r.emotions for r in rows)),
    }
    return rows, totals


def calculate(birth: _dt.date | str, sex: str = "f") -> Matrix:
    """Полный расчёт по дате рождения. sex влияет только на подписи родовых линий."""
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

    m.sky = Triad.of(m.comfort_north, m.comfort_south)
    m.ground = Triad.of(m.comfort_west, m.comfort_east)
    m.social_male = Triad.of(m.father_line, m.descendants)
    m.social_female = Triad.of(m.mother_line, m.inheritance)
    m.harmony = fold(m.sky.total + m.ground.total)
    m.planetary = fold(m.social_male.total + m.social_female.total)

    m.purpose_personal = fold(m.day + m.year)
    m.purpose_social = fold(m.month + m.mission)

    m.money = _money_line(m)
    m.love = _love_line(m)
    m.talent = _talent_line(m)
    m.karmic_tail = _karmic_tail(m)
    m.chakras, m.chakra_totals = _chakras(m)
    m.age_scale = _age_scale(m)
    return m
