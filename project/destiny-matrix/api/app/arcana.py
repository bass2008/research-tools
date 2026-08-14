from __future__ import annotations

# Названия и слаги 22 арканов. Шут стоит двадцать вторым — как в engine.matrix.fold.
ARCANA: tuple[tuple[int, str, str], ...] = (
    (1, "magician", "Маг"),
    (2, "high-priestess", "Жрица"),
    (3, "empress", "Императрица"),
    (4, "emperor", "Император"),
    (5, "hierophant", "Иерофант"),
    (6, "lovers", "Влюблённые"),
    (7, "chariot", "Колесница"),
    (8, "justice", "Справедливость"),
    (9, "hermit", "Отшельник"),
    (10, "wheel-of-fortune", "Колесо Фортуны"),
    (11, "strength", "Сила"),
    (12, "hanged-man", "Повешенный"),
    (13, "death", "Смерть"),
    (14, "temperance", "Умеренность"),
    (15, "devil", "Дьявол"),
    (16, "tower", "Башня"),
    (17, "star", "Звезда"),
    (18, "moon", "Луна"),
    (19, "sun", "Солнце"),
    (20, "judgement", "Суд"),
    (21, "world", "Мир"),
    (22, "fool", "Шут"),
)

BY_N: dict[int, tuple[int, str, str]] = {row[0]: row for row in ARCANA}

ROMAN: dict[int, str] = {
    1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII", 8: "VIII", 9: "IX",
    10: "X", 11: "XI", 12: "XII", 13: "XIII", 14: "XIV", 15: "XV", 16: "XVI", 17: "XVII",
    18: "XVIII", 19: "XIX", 20: "XX", 21: "XXI", 22: "XXII",
}

# 17 позиций матрицы: имена совпадают с полями engine.matrix.Matrix
POSITION_TITLES: dict[str, str] = {
    "day": "День рождения",
    "month": "Месяц рождения",
    "year": "Год рождения",
    "mission": "Миссия",
    "center": "Центр матрицы",
    "father_line": "Мужская линия рода",
    "mother_line": "Женская линия рода",
    "descendants": "Линия детей и продолжения",
    "inheritance": "Полученное наследие",
    "comfort_west": "Зона комфорта: запад",
    "comfort_north": "Зона комфорта: север",
    "comfort_east": "Зона комфорта: восток",
    "comfort_south": "Зона комфорта: юг",
    "harmony": "Духовная гармония",
    "planetary": "Планетарная задача",
    "purpose_personal": "Личное предназначение",
    "purpose_social": "Социальное предназначение",
}

CHAKRA_KEYS: tuple[str, ...] = (
    "sahasrara", "ajna", "vishuddha", "anahata", "manipura", "svadhisthana", "muladhara",
)
