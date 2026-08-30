"""Build report sections from the canonical ``spec/sections.json`` contract."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Literal

from .matrix import Matrix
from .spec import REPORT_SECTIONS

Access = Literal["free", "paid"]


@dataclass(frozen=True)
class Position:
    """One resolved report position."""

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
        return [position.arcanum for position in self.positions]

    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "title": self.title,
            "lead": self.lead,
            "access": self.access,
            "positions": [
                {"label": position.label, "arcanum": position.arcanum, "href": position.href}
                for position in self.positions
            ],
        }


_SELECTORS = frozenset({
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N",
    "P", "R", "R1", "R2", "reduce(C+D)", "reduce(L+M)", "sky.total", "ground.total",
    "social_male.total", "social_female.total", "harmony", "planetary",
    "purpose_personal", "purpose_social", "chakra_totals.physics", "chakra_totals.energy",
    "chakra_totals.emotions",
})
_EXPANSIONS = frozenset({"chakra_physics", "age_scale"})


def _resolve(matrix: Matrix, selector: str) -> int:
    values = {
        "A": matrix.day,
        "B": matrix.month,
        "C": matrix.year,
        "D": matrix.mission,
        "E": matrix.center,
        "F": matrix.father_line,
        "G": matrix.mother_line,
        "H": matrix.descendants,
        "I": matrix.inheritance,
        "J": matrix.comfort_west,
        "K": matrix.comfort_north,
        "L": matrix.comfort_east,
        "M": matrix.comfort_south,
        "N": matrix.karmic_tail[1],
        "P": matrix.talent[1],
        "R": matrix.money[2],
        "R1": matrix.love[1],
        "R2": matrix.money[1],
        "reduce(C+D)": matrix.chakras[6].emotions,
        "reduce(L+M)": matrix.chakras[5].emotions,
        "sky.total": matrix.sky.total,
        "ground.total": matrix.ground.total,
        "social_male.total": matrix.social_male.total,
        "social_female.total": matrix.social_female.total,
        "harmony": matrix.harmony,
        "planetary": matrix.planetary,
        "purpose_personal": matrix.purpose_personal,
        "purpose_social": matrix.purpose_social,
        "chakra_totals.physics": matrix.chakra_totals["physics"],
        "chakra_totals.energy": matrix.chakra_totals["energy"],
        "chakra_totals.emotions": matrix.chakra_totals["emotions"],
    }
    try:
        return values[selector]
    except KeyError as error:
        raise ValueError(f"unknown report selector: {selector}") from error


def _positions(matrix: Matrix, definition: dict) -> list[Position]:
    result: list[Position] = []
    for row in definition["positions"]:
        expansion = row.get("expand")
        if expansion == "chakra_physics":
            result.extend(Position(f"{chakra.title} · физика", chakra.physics)
                          for chakra in matrix.chakras)
        elif expansion == "age_scale":
            result.extend(Position(f"{period['from']}–{period['to']} лет", period["arcanum"])
                          for period in matrix.age_scale)
        elif expansion:
            raise ValueError(f"unknown report expansion: {expansion}")
        else:
            result.append(Position(row["label"], _resolve(matrix, row["selector"])))
    return result


def _validate_definitions() -> list[dict]:
    rows = REPORT_SECTIONS.get("sections")
    if not isinstance(rows, list) or len(rows) != 20:
        raise ValueError("spec/sections.json must contain exactly 20 sections")
    keys: set[str] = set()
    for definition in rows:
        key = definition.get("key")
        if not isinstance(key, str) or not key or key in keys:
            raise ValueError(f"invalid or duplicate report section key: {key!r}")
        keys.add(key)
        if definition.get("access") not in {"free", "paid"}:
            raise ValueError(f"section {key}: access must be free or paid")
        if not isinstance(definition.get("title"), str) or not isinstance(definition.get("lead"), str):
            raise ValueError(f"section {key}: title and lead are required")
        positions = definition.get("positions")
        if not isinstance(positions, list) or not positions:
            raise ValueError(f"section {key}: positions are required")
        for position in positions:
            selector, expansion = position.get("selector"), position.get("expand")
            if (selector is None) == (expansion is None):
                raise ValueError(f"section {key}: position needs exactly one selector or expand")
            if selector is not None and selector not in _SELECTORS:
                raise ValueError(f"section {key}: unknown selector {selector!r}")
            if expansion is not None and expansion not in _EXPANSIONS:
                raise ValueError(f"section {key}: unknown expansion {expansion!r}")
            if not isinstance(position.get("position_key"), str):
                raise ValueError(f"section {key}: position_key is required")
            if selector is not None and not isinstance(position.get("label"), str):
                raise ValueError(f"section {key}: selector position needs a label")
    return rows


DEFINITIONS = _validate_definitions()


def _factory(definition: dict) -> Callable[[Matrix], list[Position]]:
    return lambda matrix: _positions(matrix, definition)


# Compatibility contract consumed by content builders and existing tests.
SPEC: list[tuple[str, str, str, Access, Callable[[Matrix], list[Position]]]] = [
    (definition["key"], definition["title"], definition["lead"], definition["access"],
     _factory(definition))
    for definition in DEFINITIONS
]

FREE_KEYS = tuple(key for key, _title, _lead, access, _positions_fn in SPEC if access == "free")


def build(matrix: Matrix, unlocked: bool = False) -> list[dict]:
    """Build all sections, hiding paid positions unless access is unlocked."""
    result = []
    for key, title, lead, access, positions in SPEC:
        section = Section(key, title, lead, access, positions(matrix))
        value = section.to_dict()
        if access == "paid" and not unlocked:
            value["positions"] = []
            value["teaser"] = f"{len(section.positions)} позиций в полном разборе"
        result.append(value)
    return result


def referenced_arcana(matrix: Matrix) -> list[int]:
    """Return every arcanum linked by the report."""
    seen: dict[int, None] = {}
    for _key, _title, _lead, _access, positions in SPEC:
        for position in positions(matrix):
            seen.setdefault(position.arcanum, None)
    return sorted(seen)
