"""Разделы отчёта: из позиций матрицы собираются блоки, которые видит человек.

Каждый раздел знает свои позиции, уровень доступа и ссылки в энциклопедию — фронту остаётся
только отрисовать. Медицинские формулировки исходного макета переписаны: реклама
«народной медицины и целительства» в Директе требует разрешения органа власти субъекта РФ,
а гадание разрешено без документов. Разделы про набор веса и алкоголь убраны совсем.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Literal

from .matrix import Matrix

Access = Literal["free", "paid"]


@dataclass(frozen=True)
class Position:
    """Одна позиция раздела: подпись, аркан и ссылка на полное толкование."""
    label: str
    arcanum: int

    @property
    def href(self) -> str:
        return f"/encyclopedia/arcanum/{self.arcanum}"


@dataclass(frozen=True)
class Section:
    key: str
    title: str
    lead: str
    access: Access
    positions: list[Position]

    @property
    def arcana(self) -> list[int]:
        return [p.arcanum for p in self.positions]

    def to_dict(self) -> dict:
        return {
            "key": self.key, "title": self.title, "lead": self.lead, "access": self.access,
            "positions": [{"label": p.label, "arcanum": p.arcanum, "href": p.href}
                          for p in self.positions],
        }


def _p(label: str, arcanum: int) -> Position:
    return Position(label, arcanum)


# key, заголовок, вводка, доступ, функция позиций
SPEC: list[tuple[str, str, str, Access, Callable[[Matrix], list[Position]]]] = [
    ("character", "Характер и личные качества",
     "Как вы устроены и что в вас видят люди с первого взгляда.", "free",
     lambda m: [_p("Личность", m.day), _p("Дано от рождения", m.month),
                _p("Опора рода", m.year)]),
    ("comfort", "Что даёт вам внутренний комфорт",
     "Состояние, в котором вы восстанавливаетесь, а не тратитесь.", "free",
     lambda m: [_p("Центр карты", m.center),
                _p("Комфорт в деле", m.comfort_south), _p("Комфорт в отношениях", m.comfort_north)]),
    ("profession", "Профессия и дело по душе",
     "Через какое дело ваша энергия превращается в результат.", "paid",
     lambda m: [_p("Талант", m.talent[0]), _p("Как раскрывается талант", m.talent[1]),
                _p("Итог линии таланта", m.talent[2])]),
    ("realisation", "Путь самореализации",
     "Куда ведёт ваша линия, если не сопротивляться.", "paid",
     lambda m: [_p("Миссия", m.mission), _p("Личное предназначение", m.purpose_personal),
                _p("Социальное предназначение", m.purpose_social)]),
    ("karma40", "Кармическая задача до 40 лет",
     "Что нужно пройти в первой половине пути.", "paid",
     lambda m: [_p("Полученное наследие", m.inheritance), _p("Комфорт через личность", m.comfort_west)]),
    ("resources", "Что открывает вам блага и ресурс",
     "Канал, по которому в жизнь приходит достаток.", "paid",
     lambda m: [_p("Денежный канал", m.money[0]), _p("Условие потока", m.money[1])]),
    ("family_gifts", "Поддержка и дары вашего рода",
     "Что род передал вам как силу.", "paid",
     lambda m: [_p("Мужская линия рода", m.father_line), _p("Женская линия рода", m.mother_line),
                _p("Итог мужской ветви", m.social_male.total),
                _p("Итог женской ветви", m.social_female.total)]),
    ("soul_tasks", "Духовные задачи и уроки души",
     "Работа, которую видно только изнутри.", "paid",
     lambda m: [_p("Итог неба", m.sky.total), _p("Первая задача неба", m.sky.first),
                _p("Вторая задача неба", m.sky.second)]),
    ("past_lives", "Задачи прошлых воплощений",
     "Кармический хвост: то, что пришло с вами.", "paid",
     lambda m: [_p("Корень хвоста", m.karmic_tail[0]), _p("Проявление хвоста", m.karmic_tail[1]),
                _p("Итог хвоста", m.karmic_tail[2])]),
    ("purpose", "Ваше предназначение",
     "Четыре уровня: личный, социальный, духовный и планетарный.", "paid",
     lambda m: [_p("Личное предназначение", m.purpose_personal),
                _p("Социальное предназначение", m.purpose_social),
                _p("Духовная гармония", m.harmony), _p("Планетарная задача", m.planetary)]),
    ("money", "Деньги в матрице судьбы",
     "Где деньги приходят легко, а где перекрыт канал.", "paid",
     lambda m: [_p("Денежный канал", m.money[0]), _p("Условие потока", m.money[1]),
                _p("Итог денежной линии", m.money[2]), _p("Итог земли", m.ground.total)]),
    ("money40", "Как меняются деньги после 40 лет",
     "Вторая половина пути живёт по другой энергии.", "paid",
     lambda m: [_p("Условие потока", m.money[1]), _p("Опора в материальном", m.comfort_east)]),
    ("relations", "Отношения в матрице судьбы",
     "Что вы приносите в пару и что ищете в другом.", "paid",
     lambda m: [_p("Линия отношений", m.love[0]), _p("Как проявляется линия", m.love[1]),
                _p("Итог линии отношений", m.love[2]),
                _p("Комфорт в отношениях", m.comfort_north)]),
    ("parents_children", "Карма отношений с родителями и детьми",
     "Что передано вам и что вы передаёте дальше.", "paid",
     lambda m: [_p("Мужская линия рода", m.father_line),
                _p("Женская линия рода", m.mother_line),
                _p("Дети и продолжение", m.descendants)]),
    ("ancestry", "Родовые задачи до седьмого колена",
     "Программа рода и ваша роль в ней.", "paid",
     lambda m: [_p("Полученное наследие", m.inheritance),
                _p("Итог мужской ветви", m.social_male.total),
                _p("Итог женской ветви", m.social_female.total),
                _p("Планетарная задача", m.planetary)]),
    ("body_resource", "Ресурс тела и восстановление",
     "Как вы наполняетесь и где теряете силы. Это не медицинская рекомендация.", "paid",
     lambda m: [_p("Опора тела", m.chakras[6].physics),
                _p("Энергия опоры", m.chakras[6].energy),
                _p("Итог опоры тела", m.chakras[6].emotions)]),
    ("chakras", "Карта энергий по чакрам",
     "Семь уровней в трёх колонках: материя, энергия и чувства.", "paid",
     lambda m: [_p(f"{r.title} · физика", r.physics) for r in m.chakras]
               + [_p("Итог физики", m.chakra_totals["physics"]),
                  _p("Итог энергии", m.chakra_totals["energy"]),
                  _p("Итог эмоций", m.chakra_totals["emotions"])]),
    ("rest", "Ваш идеальный формат отдыха",
     "Чем вы восстанавливаетесь по-настоящему.", "paid",
     lambda m: [_p("Радость и творчество", m.chakras[5].emotions),
                _p("Центр карты", m.center)]),
    ("loops", "Программы: что повторяется по кругу",
     "Сюжеты, которые возвращаются, пока не пройдены.", "paid",
     lambda m: [_p("Итог хвоста", m.karmic_tail[2]), _p("Центр карты", m.center),
                _p("Духовная гармония", m.harmony)]),
    ("years", "Разбор по годам до 80 лет",
     "Какая энергия ведёт вас в каждом десятилетии.", "paid",
     lambda m: [_p(f"{p['from']}–{p['to']} лет", p["arcanum"]) for p in m.age_scale]),
]

FREE_KEYS = tuple(k for k, *_rest in SPEC if _rest[2] == "free")


def build(m: Matrix, unlocked: bool = False) -> list[dict]:
    """Собрать разделы. При unlocked=False платные приходят без позиций — только анонс."""
    out = []
    for key, title, lead, access, positions in SPEC:
        section = Section(key, title, lead, access, positions(m))
        d = section.to_dict()
        if access == "paid" and not unlocked:
            d["positions"] = []
            d["teaser"] = f"{len(section.positions)} позиций в полном разборе"
        out.append(d)
    return out


def referenced_arcana(m: Matrix) -> list[int]:
    """Все арканы, на которые ссылается отчёт — для перелинковки с энциклопедией."""
    seen: dict[int, None] = {}
    for _key, _t, _l, _a, positions in SPEC:
        for p in positions(m):
            seen.setdefault(p.arcanum, None)
    return sorted(seen)
