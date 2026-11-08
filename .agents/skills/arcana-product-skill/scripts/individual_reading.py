import argparse
import calendar
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
PROJECT = ROOT / "project/destiny-matrix"
sys.path.insert(0, str(PROJECT))

from engine import lisovskaya  # noqa: E402
from engine.matrix import calculate, digit_sum, fold  # noqa: E402
WORK = Path(os.environ["ARCANA_REPORTS_DIR"]) if os.environ.get("ARCANA_REPORTS_DIR") else PROJECT / "reports/individual"
LOCAL = re.compile(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$")

def material_attitude(m):
    # Q = C + L; matrices saved before 08.11.2026 have no material_karma field.
    karma = m.get("material_karma")
    if isinstance(karma, list) and len(karma) == 3:
        return karma[1]
    c, l = m.get("year"), m.get("comfort_east")
    if not (isinstance(c, int) and isinstance(l, int)):
        return None
    q = c + l
    while q > 22:
        q = sum(map(int, str(q)))
    return q


POINTS = [
    ("A", "day", "Портрет личности", "крупный круг слева"),
    ("B", "month", "Духовная задача", "крупный круг сверху"),
    ("C", "year", "Материальная задача", "крупный круг справа"),
    ("D", "mission", "Кармическая задача", "крупный круг снизу"),
    ("E", "center", "Центр карты · зона комфорта", "крупный круг в центре"),
    ("F", "father_line", "Духовная мужская линия рода", "круг в левом верхнем углу"),
    ("G", "mother_line", "Духовная женская линия рода", "круг в правом верхнем углу"),
    ("H", "descendants", "Материальная мужская линия рода", "круг в правом нижнем углу"),
    ("I", "inheritance", "Материальная женская линия рода", "круг в левом нижнем углу"),
    ("J", "comfort_west", "Внутренняя левая точка", "внутренний круг слева от центра"),
    ("K", "comfort_north", "Внутренняя точка таланта", "внутренний круг над центром"),
    ("L", "comfort_east", "Вход денежной линии", "внутренний круг справа от центра"),
    ("M", "comfort_south", "Вход отношений и хвоста", "внутренний круг под центром"),
    ("N", ("karmic_tail", 1), "Середина кармического хвоста", "малая точка между внутренним и крупным кругом снизу"),
    ("O", ("chakras", 1, "physics"), "Аджна · физика", "малая точка между крупным и внутренним кругом слева"),
    ("P", ("talent", 1), "Аджна · энергия, середина линии талантов", "малая точка между крупным и внутренним кругом сверху"),
    ("Q", material_attitude, "Отношение к материальному", "малая точка на правом луче между крупным правым и внутренним правым кругом"),
    ("S", ("chakras", 3, "physics"), "Анахата · физика", "малая точка слева, ближе к центру"),
    ("T", ("chakras", 3, "energy"), "Анахата · энергия", "малая точка сверху, ближе к центру"),
    ("R2", ("money", 1), "Середина денежной линии", "малая точка справа снизу от центра, ближе к правому кругу"),
    ("R", ("money", 2), "Скрещение денег и отношений", "малая точка на диагонали справа снизу от центра"),
    ("R1", ("love", 1), "Середина линии отношений", "малая точка справа снизу от центра, ближе к нижнему кругу"),
    ("", "purpose_personal", "Личное предназначение", "на схеме нет"),
    ("", "purpose_social", "Социальное предназначение", "на схеме нет"),
    ("", "harmony", "Гармония · духовное предназначение", "на схеме нет"),
    ("", "planetary", "Планетарное предназначение", "на схеме нет"),
]
LISOVSKAYA = {"A": "маска, внешнее проявление", "B": "главный талант", "C": "материальная карма",
              "D": "кармическая задача", "E": "центр, «наше Я»", "F": "вдохновение", "G": "триггер",
              "H": "усилитель", "I": "усилитель", "J": "родители", "O": "дети", "P": "дополнительный талант",
              "K": "дополнительный талант", "L": "вход в финансы", "Q": "отношение к материальному", "N": "помощница кармического хвоста",
              "M": "чего хочет от отношений", "R1": "взаимоотношения: через что можно примириться",
              "R": "дуал", "R2": "прибыль и заработок"}
SCHEME = ("Над статьёй читатель видит схему своей матрицы без букв: только числа в кругах, подписи «небо» "
          "на вертикали и «земля» на горизонтали, а по внешнему кругу — возрастные отметки: в левом верхнем углу 10, "
          "сверху 20, в правом верхнем 30, справа 40, в правом нижнем 50, снизу 60, в левом нижнем 70; у крупного "
          "круга слева возраст 0, но отметки «0» на схеме нет. "
          "Числа колонки «физика» у чакр лежат на горизонтали (верхние чакры — слева, нижние — справа), «энергия» — "
          "на вертикали; «эмоций» и предназначений на схеме нет. Буквы ниже — для тебя: читателю они ничего не скажут, "
          "точку ему называй по месту на схеме и по смыслу.")
LINES = [("talent", "Таланты B → P → K"), ("money", "Деньги L → R2 → R"),
         ("love", "Отношения M → R1 → R"), ("karmic_tail", "Кармический хвост M → N → D")]
TRIADS = [("sky", "Небо B + D"), ("ground", "Земля A + C"),
          ("social_male", "Мужская социальная F + H"), ("social_female", "Женская социальная G + I")]
CHAKRAS = {"ru": ("Сахасрар", "Аджн", "Вишудх", "Анахат", "Манипур", "Свадхистан", "Муладхар"),
           "en": ("Sahasrara", "Ajna", "Vishuddha", "Anahata", "Manipura", "Svadhisthana", "Muladhara")}
CHAKRA_BLOCKS = ("muladhara", "svadhisthana", "manipura", "anahata", "vishuddha", "ajna", "sahasrara", "total")
LOCAL_TRACE = re.compile(r"(library/|file://|/home/|\.agents/|reports/individual|automatic_reading|brief\.md)")
CHAPTER_KINDS = ("key", "findings", "character", "talents", "money", "relations", "family", "karma", "body",
                 "chakras", "zodiac", "close", "time", "selfcheck", "plan", "year", "quarter", "month", "other")
PERSONAL_SKELETON = ("key", "findings", "character", "talents", "money", "relations", "family", "karma", "body",
                     "chakras", "zodiac", "close", "time", "selfcheck", "plan")
YEAR_SKELETON = ("key", "year", "time", "quarter", "relations", "money", "plan")
PAIR_SKELETON = ("key", "findings", "talents", "character", "body", "money", "relations", "family", "karma", "close",
                 "selfcheck", "plan")
OPERATORS = ("+", "=", "↔", "→")
# year matrix points as the site draws them; P1–P3 are the thirds of the year
YEAR_LETTERS = ("A", "B", "C", "D", "E", "F", "G", "H", "I", "P1", "P2", "P3")
MONTH_LETTERS = YEAR_LETTERS[:9]
POINT_LETTERS = {"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q",
                 "R", "R1", "R2", "S", "T"}
SIGNS = [  # sign, start (month, day), element, Golden Dawn trump (site numbering), traditional ruler
    ("Козерог", (12, 22), "земля", 15, "Сатурн"), ("Водолей", (1, 20), "воздух", 17, "Сатурн"),
    ("Рыбы", (2, 19), "вода", 18, "Юпитер"), ("Овен", (3, 21), "огонь", 4, "Марс"),
    ("Телец", (4, 20), "земля", 5, "Венера"), ("Близнецы", (5, 21), "воздух", 6, "Меркурий"),
    ("Рак", (6, 21), "вода", 7, "Луна"), ("Лев", (7, 23), "огонь", 11, "Солнце"),
    ("Дева", (8, 23), "земля", 9, "Меркурий"), ("Весы", (9, 23), "воздух", 8, "Венера"),
    ("Скорпион", (10, 23), "вода", 13, "Марс"), ("Стрелец", (11, 22), "огонь", 14, "Юпитер"),
]
PLANETS = {"Меркурий": 1, "Луна": 2, "Венера": 3, "Юпитер": 10, "Марс": 16, "Солнце": 19, "Сатурн": 21}
ELEMENT_TRUMPS = {"воздух": 22, "вода": 12, "огонь": 20}
SYMMETRIC = [("A", "C", "крупные круги слева и справа"), ("B", "D", "крупные круги сверху и снизу"),
             ("F", "G", "верхние углы"), ("I", "H", "нижние углы"), ("F", "I", "левые углы"), ("G", "H", "правые углы"),
             ("J", "L", "внутренние круги слева и справа от центра"), ("K", "M", "внутренние круги над и под центром")]


def names(locale):
    path = PROJECT / f"web/content/{locale}/arcana-catalog.json"
    items = json.loads(path.read_text())["items"] if path.exists() else []
    table = {i["n"]: i["title"] for i in items}
    return lambda n: table.get(n, "")


def worker_token(base):
    if os.environ.get("ARCANA_INTERNAL_TOKEN"):
        return os.environ["ARCANA_INTERNAL_TOKEN"]
    if not LOCAL.match(base):
        raise SystemExit("для удалённого стенда задайте ARCANA_INTERNAL_TOKEN")
    for proc in Path("/proc").iterdir():
        try:
            if b"uvicorn" not in (proc / "cmdline").read_bytes() or b"app.main:app" not in (proc / "cmdline").read_bytes():
                continue
            env = dict(s.decode().split("=", 1) for s in (proc / "environ").read_bytes().split(b"\0") if b"=" in s)
        except OSError:
            continue
        if env.get("JWT_SECRET"):
            import jwt
            now = int(time.time())
            return jwt.encode({"sub": "worker", "typ": "worker", "iat": now, "exp": now + 3600},
                              env["JWT_SECRET"], algorithm="HS256")
    raise SystemExit("не нашёл локальный API с JWT_SECRET; задайте ARCANA_INTERNAL_TOKEN")


def api(base, path, body=None):
    headers = {"Accept": "application/json", "X-Internal-Token": worker_token(base)}
    data = None
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(f"{base}/api/internal/individual-readings{path}", data, headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{e.code}: {e.read().decode()[:2000]}")


YEAR_ROLES = [
    ("E", "центр", "главный фон и события года: что ждать в плюсе и минусе, на что смотреть"),
    ("A", "крупный круг слева", "как взаимодействовать с миром и людьми: чего ждут от вас, что вы можете дать, где ошибиться"),
    ("B", "крупный круг сверху", "чистый плюс: сильные стороны года, идеи в приоритете"),
    ("F", "левый верхний угол", "чистый плюс: на что опираться, где проявиться и реализоваться"),
    ("C", "крупный круг справа", "чистый минус: материальная сторона, финансы, как реагировать на трудности; читается вместе с нижним"),
    ("D", "крупный круг снизу", "чистый минус: испытания и задачи года, что стоит пересмотреть"),
    ("G", "правый верхний угол", "слабые места перед другими: что отложить, что может сбить настрой"),
    ("H", "правый нижний угол", "для чего хорош год и чего остеречься"),
    ("I", "левый нижний угол", "для чего хорош год и чего остеречься"),
]


def year_blocks(task, name):
    inputs, year = task["inputs"], task["year"]
    if inputs.get("birth"):
        return year_block(inputs["birth"], year, name, drawn=True)
    roles = (task.get("automatic_reading") or {}).get("roles") or {}
    who = {"parent": "родитель", "child": "ребёнок"}
    out = [f"## Год {year} для двоих", "",
           "«Прогноз на год» у Лисовской — личный метод, годового прогноза для пары в книге нет. Ниже матрица года "
           "каждого; год пары — это встреча двух личных годов в матрице пары. Возрастной шкалы у пары нет.", ""]
    for key, default in (("a", "первая дата"), ("b", "вторая дата")):
        birth = (inputs.get(key) or {}).get("birth")
        if birth:
            out += year_block(birth, year, name, f"{who.get(roles.get(key), default)}, {birth}")
    return out


MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]
LOVE_ROLES = [
    ("B, F", "плюс личной жизни: чего ждать, как развиваются отношения, как их поддерживать, что вдохновляет"),
    ("C, D", "минус: задачи, испытания, сложности и ошибки, что может напрягать"),
    ("G", "слабые места и тайные желания, которые уводят не туда; минусы характера, которые бьют по самому человеку в отношениях"),
    ("A", "как настраивать отношения, через что и где; на какие качества мужчин или женщин смотреть в этот период"),
    ("E", "истинные желания по отношению к мужчинам или женщинам в этот период: мечта, ценность"),
    ("H, I", "внутренние, интуитивные импульсы в поведении по отношению к другому"),
]


def year_details(task, name):
    """Material for a calendar-year reading of one date: meeting with the natal chart, thirds, months, age ring."""
    birth, year = task["inputs"]["birth"], task["year"]
    m = (task.get("automatic_reading") or {}).get("matrix") or {}
    y = lisovskaya.year_matrix(birth, year)
    natal = {}
    for letter, key, role, place in POINTS:
        value = point_value(m, key)
        if letter and isinstance(value, int):
            natal.setdefault(value, []).append(f"{letter} {role.lower()}" + (f" («{LISOVSKAYA[letter]}» у Лисовской)" if letter in LISOVSKAYA else ""))
    places = {letter: place for letter, place, _ in YEAR_ROLES}
    out = ["### Встреча матрицы года с личной матрицей", "",
           "Где арканы матрицы года стоят на личной схеме (видимые точки). Совпадение — повод связать год с тем, что в человеке "
           "уже есть; само по себе это не событие.", "",
           "| Точка года | Аркан | Где этот аркан в личной матрице |", "|---|---|---|"]
    for letter in "EABFCDGHI":
        out.append(f"| {letter} ({places[letter]}) | {y[letter]} {name(y[letter])} | {'; '.join(natal.get(y[letter], [])) or '—'} |")
    out += ["", "### Три периода года (блок предназначений матрицы года)", "",
            "По книге блок предназначений в матрице года читают по третям года. Первые два периода — события и задачи, "
            "третий — итог того, что начато в первых двух, и свои задачи. Пары внутри периода в этой матрице — духовная и "
            "материальная стороны (`read_section.py forecast`, «Что делать с блоком предназначений»).", "",
            "| Период | Как считается | Составляющие | Итог периода (точка на колесе третей) |", "|---|---|---|---|"]
    how = ["B + D и A + C", "F + H и G + I", "итог первого + итог второго"]
    for j, ((label, rule), p) in enumerate(zip(zip(["январь–апрель", "май–август", "сентябрь–декабрь"], how), lisovskaya.year_periods(y)), 1):
        out.append(f"| {label} | {rule} | {', '.join(f'{n} {name(n)}' for n in p['parts'])} | {p['total']} {name(p['total'])} · `P{j}` |")
    out += ["", "### Матрицы месяцев", "",
            f"По книге («Прогноз на месяц»): дата месяца — день = сумма цифр года ({digit_sum(year)}) + номер месяца, месяц = номер "
            "месяца, год = год; она складывается с датой рождения, остальные точки — как в матрице года. Значения точек те же, "
            "что в матрице года. Повторы внутри месяца и совпадения с матрицей года и личной — главное, на что смотреть.", "",
            "| Месяц | E центр | B плюс | F плюс | C минус | D минус | A люди | G слабые места | H | I |", "|---|---|---|---|---|---|---|---|---|---|"]
    for i, title in enumerate(MONTHS, 1):
        mm = lisovskaya.month_matrix(birth, year, i)
        out.append(f"| {title} | " + " | ".join(f"{mm[k]} {name(mm[k])}" for k in "EBFCDAGHI") + " |")
    out += ["", "### Значения точек матрицы года для любви и денег", "",
            "В прогнозе на личную жизнь и финансы точки «немного меняют значение» (`read_section.py place`, «Значение точек в "
            "прогнозе на любовь и финансы»). Читай по ним ту же матрицу года для глав об отношениях и деньгах; рядом — личные "
            "линии отношений и финансов, хвост и материальная карма из расчёта выше.", "",
            "| Точки | Значение |", "|---|---|", *[f"| {k} | {v} |" for k, v in LOVE_ROLES]]
    born = dt.date.fromisoformat(str(birth)[:10])
    start = year - born.year - (1 if (born.month, born.day) > (1, 1) else 0)
    end = year - born.year
    ring = lisovskaya.year_ring(calculate(born.isoformat()))
    near = [(age, n) for age, n in ring if start - 1.5 <= age % 80 + 80 * (start // 80) <= end + 1.5]
    out += ["", "### Возраст в этом году на кольце (годовые периоды)", "",
            f"В {year} году человеку {start} → {end} (день рождения {born.day:02d}.{born.month:02d}). Годовые точки кольца рядом "
            "(по книге, «Годовой период»: между точками через 2,5 года — ещё одна через год после начала отрезка). Это фон "
            "года, а не основа: " + "; ".join(f"{age:g} — {n} {name(n)}" for age, n in near), ""]
    out += year_block(birth, year + 1, name)
    return out


def year_block(birth, year, name, person=None, drawn=False):
    y = lisovskaya.year_matrix(birth, year)
    born = dt.date.fromisoformat(str(birth))
    days = 366 if calendar.isleap(year) else 365
    site = fold(fold(born.day) + born.month + fold(digit_sum(year)))
    out = [f"{'###' if person else '##'} Матрица {year} года{f' — {person}' if person else ''}", "",
           "Основа годового разбора — «Прогноз на год» Лисовской (`library/lisovskaya-prognosis`, `read_section.py year`). "
           f"Дата года: день — сумма дней года ({days}) → {fold(digit_sum(days))}, месяц — сумма цифр года + 12 = "
           f"{digit_sum(year) + 12} (не сворачивается до сложения с месяцем рождения, как 19 в примере книги); она складывается с датой рождения, остальные точки — суммы соседних. "
           + ("Над статьёй сайт рисует эту матрицу, как виджет страниц года: девять точек и колесо третей. У карт её точек пиши "
            "`year` с буквами из таблицы (трети — `P1`–`P3`), у карт матрицы месяца — `month`: `{\"n\": 1, \"points\": [\"E\"]}`."
            if drawn else "На схеме над статьёй этой матрицы нет: у её карт `year` не пиши."), "",
           "| Точка (буква сайта) | Место в матрице года | Аркан | Что значит в прогнозе (по книге) |", "|---|---|---|---|"]
    for letter, place, role in YEAR_ROLES:
        out.append(f"| {letter} | {place} | {y[letter]} {name(y[letter])} | {role} |")
    out += [f"| — | общая энергия года: сумма девяти точек | {y['total']} {name(y['total'])} | подсказка к году в целом "
            "(в примере книги в этой сумме центр взят как 3 вместо рассчитанного 10; здесь — по рассчитанным точкам) |", "",
            "Плюс в прогнозе читается по верхней точке и левому верхнему углу, минус — по правой и нижней точкам; центр и "
            "правый верхний угол влияют на всю матрицу, их читают в паре с другими. Смотри, какие арканы повторяются.", "",
            "Аркан года по короткой формуле страниц сайта «N на год» (день + месяц + сумма цифр года): "
            f"{fold(born.day)} + {born.month} + {fold(digit_sum(year))} → {site} {name(site)}. Читатель мог его видеть — "
            "назови и объясни, чем он отличается от матрицы года.", ""]
    return out


def deck_notes(numbers):
    path = Path(__file__).resolve().parents[1] / "references/deck-images.md"
    blocks, current = {}, None
    for line in path.read_text().splitlines():
        head = re.match(r"^## (\d+) · ", line)
        if head:
            current = int(head.group(1))
            blocks[current] = []
        elif current is not None and line.strip():
            if not line.startswith("- ") and blocks[current] and blocks[current][-1]:
                blocks[current][-1] += " " + line.strip()
            else:
                blocks[current].append(line.lstrip("- ").strip())
        elif current is not None:
            blocks[current].append("")
    return {n: [x for x in lines if "Уэйт" in x] for n, lines in blocks.items()
            if n in numbers and any("Уэйт" in x for x in lines)}


def extra_block(m, name):
    out = []
    visible = {}
    for letter, key, _, place in POINTS:
        value = point_value(m, key)
        if letter and isinstance(value, int):
            visible.setdefault(value, []).append(f"{letter} ({place})")
    repeats = [f"- {n} {name(n)}: {len(v)} раза — " + "; ".join(v) for n, v in sorted(visible.items()) if len(v) > 1]
    if repeats:
        out += ["", "Повторы на видимой схеме (считай по этому списку, когда пишешь «стоит N раз»):", *repeats]
    if m.get("birth") and m.get("chakras"):
        mx = calculate(str(m["birth"]), m.get("sex") or "f")
        karma = lisovskaya.material_karma(mx)
        strength = lisovskaya.family_strength(mx)
        family = dict(zip("FGHI", lisovskaya.family_lines(mx).values()))
        out += ["", "Материальная карма C → Q → L — на схеме и в разделе «Материальная карма» автоматического разбора "
                "(с 08.11.2026; Q не называть «досчитанной»): " + " → ".join(f"{n} {name(n)}" for n in karma),
                "", "Досчитано по книгам Лисовской (`engine/lisovskaya.py`, формулы сверены с примерами автора; на схеме сайта нет):",
                f"- сила рода = F + G + H + I: {strength} {name(strength)}"
                + (" — совпадает с социальным предназначением (так у 68 % дат: оба числа собраны из тех же четырёх углов), "
                   "отдельным открытием это не считается" if strength == mx.purpose_social else
                   " — у этого читателя отличается от социального предназначения (совпадают у 68 % дат)")]
        out += [f"- родовая линия от {letter}: {' → '.join(map(str, line))} (угол → дальняя → ближняя к силе рода)"
                for letter, line in family.items()]
        out.append("- периоды предназначений: личное до 40, социальное 40–60, духовное после 60; "
                   "смена личного на социальное — примерно с 37 до 43 лет")
        lines = {"таланты": mx.talent, "деньги": mx.money, "отношения": mx.love, "кармический хвост": mx.karmic_tail,
                 "материальная карма": karma, **{f"родовая линия от {k}": v for k, v in family.items()}}
        seen = {}
        for title, triad in lines.items():
            seen.setdefault(tuple(triad), []).append(title)
        same = [f"{'-'.join(map(str, k))}: " + ", ".join(v) for k, v in seen.items() if len(v) > 1]
        if same:
            out.append("- совпадающие линии: " + "; ".join(same))
        out += ["", "Промежуточные точки возрастной шкалы (по «Прогностике» Лисовской: точка — сумма двух соседних; "
                "описание периода, а не прогноз года): " + "; ".join(f"{age:g}: {n}" for age, n in lisovskaya.age_points(mx))]
    if m.get("chakras"):
        out += ["", "Тождества схемы — верны для любой даты, поэтому не открытия: Сахасрара — A, B и их сумма F; "
                "Аджна — O, P; Вишудха — J, K; Анахата — S, T; Манипура — дважды E; Свадхистана — L, M и их сумма R; "
                "Муладхара — C, D и их сумма H; эмоции любой чакры — сумма её физики и энергии. Отметки возраста стоят у "
                "внешних точек: A — 0, F — 10, B — 20, G — 30, C — 40, H — 50, D — 60, I — 70. Открытие — что за "
                "арканы стоят в этих местах у читателя, а не то, что места совпадают."]
    if m.get("birth") and m.get("chakras"):
        out += zodiac_block(m, name, visible) + matrix_type_block(m, name, visible)
    notes = deck_notes(numbers(m))
    if notes:
        out += ["", "Наша колода против Уэйта для арканов этой матрицы (читатель видит нашу карту — `references/deck-images.md`):"]
        out += [f"- {n} {name(n)}: " + " ".join(v) for n, v in sorted(notes.items())]
    return out


def zodiac_block(m, name, visible):
    born = dt.date.fromisoformat(str(m["birth"]))
    sign = max((x for x in SIGNS if (born.month, born.day) >= x[1]), key=lambda x: x[1], default=SIGNS[0])
    title, start, element, trump, ruler = sign
    edge = any(abs((dt.date(2000, born.month, born.day) - dt.date(2000, *x[1])).days) <= 1 for x in SIGNS)
    planet = PLANETS[ruler]
    where = lambda n: "; ".join(visible.get(n, [])) or "на видимой схеме нет"
    out = ["", f"Знак в Таро (система соответствий Золотой Зари, как у Бенебелл Вэнь в «Holistic Tarot»; это не метод "
           f"матрицы — так и подписывай, сверь соответствия по `library/benebell-wen`): {born:%d.%m} — {title}"
           + (" (дата на границе знаков: границы сдвигаются на день по годам — скажи об этом)" if edge else "")
           + f", стихия — {element}.",
           f"- карта знака: {trump} {name(trump)} — где на схеме: {where(trump)}",
           f"- управитель (традиционный): {ruler} → {planet} {name(planet)} — где на схеме: {where(planet)}"]
    if element in ELEMENT_TRUMPS:
        n = ELEMENT_TRUMPS[element]
        out.append(f"- карта стихии: {n} {name(n)} — где на схеме: {where(n)}")
    out.append("- в колоде сайта только старшие арканы: деканы и младшие арканы не используй")
    return out


def matrix_type_block(m, name, visible):
    keys = {letter: key for letter, key, *_ in POINTS if letter}
    values = {letter: point_value(m, key) for letter, key in keys.items()}
    values = {k: v for k, v in values.items() if isinstance(v, int)}
    equal = [f"{a} = {b} = {values[a]} {name(values[a])} ({where})" for a, b, where in SYMMETRIC
             if a in values and b in values and values[a] == values[b]]
    main = [values[k] for k in "ABCDEFGHI" if k in values]
    out = ["", "Тип матрицы (глава 10 «Виды матриц» Лисовской, `read_section.py types` — сверь определения с книгой):",
           "- равные симметричные точки: " + ("; ".join(equal) if equal else "нет"),
           f"- все девять внешних точек кратны трём: {'да' if main and all(v % 3 == 0 for v in main) else 'нет'}",
           f"- 9 и 18 на схеме: 9 — {'есть' if 9 in visible else 'нет'}, 18 — {'есть' if 18 in visible else 'нет'}",
           f"- разных арканов на видимой схеме: {len(visible)} из 22; самые частые: "
           + ", ".join(f"{n} {name(n)} ×{len(v)}" for n, v in sorted(visible.items(), key=lambda x: -len(x[1]))[:5])]
    if m.get("_year_request"):
        return out
    today = dt.date.today()
    out += ["", f"Год сейчас и следующий — для главы «Время» (коротко, без обещаний событий):", ""]
    for year in (today.year, today.year + 1):
        out += year_block(m["birth"], year, name)
    return out


def point_value(m, key):
    if callable(key):
        return key(m)
    if isinstance(key, str):
        return m.get(key)
    value = m
    for part in key:
        try:
            value = value[part]
        except (KeyError, IndexError, TypeError):
            return None
    return value


def age_line(m, name):
    try:
        born = dt.date.fromisoformat(str(m.get("birth")))
    except ValueError:
        return []
    today = dt.date.today()
    age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    scale = m.get("age_scale") or []
    now = next((a for a in scale if a["from"] <= age < a["to"]), None)
    after = next((a for a in scale if now and a["from"] == now["to"]), None)
    line = f"Читателю сейчас {age} (на {today:%d.%m.%Y})"
    if now:
        line += f": десятилетие {now['from']}–{now['to']} — {now['arcanum']} {name(now['arcanum'])}"
    if after:
        line += f", следующее {after['from']}–{after['to']} — {after['arcanum']} {name(after['arcanum'])}"
    return ["", line + "."]


def points_block(m, name):
    out = [SCHEME, "", "| Буква | Точка | Аркан | Где на схеме | У Лисовской |", "|---|---|---|---|---|"]
    for letter, key, label, place in POINTS:
        value = point_value(m, key)
        if isinstance(value, int):
            out.append(f"| {letter} | {label} | {value} {name(value)} | {place} | {LISOVSKAYA.get(letter, '')} |")
    out += ["", "| Линия | Числа по порядку |", "|---|---|"]
    out += [f"| {label} | {' → '.join(f'{n} {name(n)}' for n in m[key])} |" for key, label in LINES if key in m]
    out += ["", "| Составляющая предназначения | Первое | Второе | Итог |", "|---|---|---|---|"]
    for key, label in TRIADS:
        if m.get(key):
            first, second, total = m[key].values() if isinstance(m[key], dict) else m[key]
            out.append(f"| {label} | {first} | {second} | {total} {name(total)} |")
    if m.get("chakras"):
        out += ["", "| Чакра | Физика | Энергия | Эмоции |", "|---|---|---|---|"]
        out += [f"| {c['title']} ({c.get('hint', '')}) | {c['physics']} {name(c['physics'])} | {c['energy']} {name(c['energy'])} "
                f"| {c['emotions']} {name(c['emotions'])} |" for c in m["chakras"]]
        t = m.get("chakra_totals") or {}
        if t:
            out.append(f"| Итог энергополя | {t['physics']} {name(t['physics'])} | {t['energy']} {name(t['energy'])} "
                       f"| {t['emotions']} {name(t['emotions'])} |")
    if m.get("age_scale"):
        out += ["", "Возрастная шкала: " + "; ".join(f"{a['from']}–{a['to']}: {a['arcanum']} {name(a['arcanum'])}"
                                                     for a in m["age_scale"])]
        out += age_line(m, name)
    return out + extra_block(m, name)


PAIR_ROLES = {"A": "образ пары для других", "B": "что паре нужно создать вместе", "C": "материальное",
              "D": "главная задача пары", "E": "атмосфера, общий фон", "F": "что наполняет союз",
              "G": "что может испортить", "J": "пара как родители", "O": "отношение к ребёнку",
              "L": "вход денег: трудности с доходом", "R2": "через что придёт достаток",
              "R": "скрещение денег и отношений", "R1": "что соединяет", "M": "вход отношений и задач пары",
              "N": "середина задач пары", "Q": "дополнение к материальной точке", "spiritual": "ценности пары"}


def pair_details(m, name):
    """Lisovskaya's consultation order: repeats of the couple chart and where they sit in each partner's chart."""
    a, b, p = m.get("a", {}), m.get("b", {}), m.get("p", {})
    labels = {letter: label for letter, _, label, _ in POINTS if letter}
    role = lambda k: PAIR_ROLES.get(k) or ("усилитель, необязательная точка" if k in ("H", "I") else labels.get(k, k))
    # Green points (S, T) belong to chakras and are not read in a couple chart.
    visible = [k for k in p if k in labels and k not in ("S", "T") and isinstance(p.get(k), int)]
    where = lambda chart, n: [f"{k} {labels[k].lower()}" for k in labels if isinstance(chart.get(k), int) and chart[k] == n]
    counts = {}
    for k in visible:
        counts.setdefault(p[k], []).append(k)
    out = ["", "### Повторы в матрице пары и где эти арканы у каждого из двоих", "",
           "По книге (глава 5, разбор Марии и Алексея): повторяющиеся энергии пары ищут в матрицах партнёров. Это ресурс и "
           "тема, которую человек приносит в пару, — не вина и не «кто создаёт трудности».", "",
           "| Аркан | Где в паре | У первого | У второго |", "|---|---|---|---|"]
    for n, keys in sorted(counts.items(), key=lambda x: -len(x[1])):
        if len(keys) < 2:
            continue
        out.append(f"| {n} {name(n)} ×{len(keys)} | {'; '.join(f'{k} ({role(k)})' for k in keys)} | "
                   f"{'; '.join(where(a, n)) or '—'} | {'; '.join(where(b, n)) or '—'} |")
    out += ["", "Дуал (R) и полудуал (M) каждого — совместимость характеров по книге, не приговор союзу:"]
    for who, chart, other in (("первый", a, b), ("второй", b, a)):
        for k in ("R", "M"):
            n = chart.get(k)
            if isinstance(n, int):
                out.append(f"- {who}, {'дуал' if k == 'R' else 'полудуал'}: {n} {name(n)}; у другого этот аркан — "
                           f"{'; '.join(where(other, n)) or 'нет на видимой схеме'}")
    spirit = [(w, c.get("spiritual")) for w, c in (("первый", a), ("второй", b), ("пара", p))]
    out.append("- духовные предназначения: " + "; ".join(f"{w} {n} {name(n)}" for w, n in spirit if isinstance(n, int)))
    return out


def pair_block(m, name):
    places = {letter: place for letter, _, _, place in POINTS if letter}
    labels = {letter: label for letter, _, label, _ in POINTS if letter}
    out = ["Над статьёй — схема матрицы пары (третья колонка) без букв, точки на тех же местах, что в личной схеме. "
           "Чакр и возрастной шкалы у пары нет. Буквы — для тебя; читателю называй точку по месту и смыслу.", "",
           "| Буква | Роль в паре | Где на схеме | Первый | Второй | Пара |", "|---|---|---|---|---|---|"]
    a, b, pair = m.get("a", {}), m.get("b", {}), m.get("p", {})
    for key in pair:
        if not all(isinstance(x.get(key), int) for x in (a, b, pair)):
            continue
        role = PAIR_ROLES.get(key) or labels.get(key, key)
        out.append(f"| {key if key in places else ''} | {role} | {places.get(key, 'на схеме нет')} "
                   f"| {a[key]} {name(a[key])} | {b[key]} {name(b[key])} | {pair[key]} {name(pair[key])} |")
    return out


def units_block(units, name):
    out = []
    for key, u in (units.items() if isinstance(units, dict) else enumerate(units)):
        if not isinstance(u, dict):
            continue
        nums = ", ".join(f"{n} {name(n)}" for n in u.get("numbers", []) if isinstance(n, int))
        out += [f"### {u.get('sphere') or str(key).split(':')[0]}: {u.get('title') or ''} ({nums})"]
        if u.get("meaning"):
            out.append(f"**Главное.** {u['meaning']}")
        for point, caption in (u.get("captions") or {}).items():
            out.append(f"- {point}: {caption}")
        text = u.get("text") or []
        out += [md(t) for t in (text if isinstance(text, list) else [text])]
        out.append("")
    return out


def matrix_block(m, name):
    if "day" in m:
        return points_block(m, name)
    if {"a", "b", "p"} <= set(m):
        return pair_block(m, name) + pair_details(m, name)
    out = []
    for key, sub in m.items():
        if isinstance(sub, dict) and "day" in sub:
            out += [f"#### Матрица `{key}`", *points_block(sub, name), ""]
        elif isinstance(sub, dict):
            out += [f"#### Матрица `{key}`", "```json", json.dumps(sub, ensure_ascii=False, indent=1), "```", ""]
    return out or ["```json", json.dumps(m, ensure_ascii=False, indent=1), "```"]


def md(p):
    if isinstance(p, str):
        return p
    if "h3" in p:
        return f"#### {p['h3']}"
    if "ul" in p or "ol" in p:
        return "\n".join(f"- {x}" for x in p.get("ul") or p.get("ol"))
    if "table" in p:
        rows = [p["table"]["head"], *p["table"]["rows"]]
        return "\n".join("| " + " | ".join(map(str, r)) + " |" for r in rows)
    return json.dumps(p, ensure_ascii=False)


def section_block(s, name):
    out = [f"### {s.get('title', s.get('key'))}", s.get("lead", "")]
    for p in s.get("positions", []):
        tail = f": {p['text']}" if p.get("text") else ""
        out.append(f"- **{p['label']}** — {p['arcanum']} {name(p['arcanum'])}{tail}")
    lf = s.get("longform") or {}
    if lf.get("lead"):
        out += ["", lf["lead"]]
    if not lf.get("agePeriods"):
        for r in lf.get("roles", []):
            parts = " ".join(r[k] for k in ("question", "essence", "strength", "risk", "action") if r.get(k))
            out.append(f"- **{r['label']} · {r['arcanum']} {name(r['arcanum'])}** — {parts}")
    for it in lf.get("interactions", []):
        out += ["", f"#### {it['title']}", *map(md, it.get("paragraphs", []))]
    for row in lf.get("chakraRows", []) + ([lf["energyField"]] if lf.get("energyField") else []):
        cells = ", ".join(f"{c.get('title') or c.get('column')} {c['arcanum']} {name(c['arcanum'])}" for c in row.get("cells", []))
        out += ["", f"#### {row['title']}: {row.get('topic', '')} ({cells})", f"*{row.get('heading', '')}*", *map(md, row.get("paragraphs", []))]
    out += map(md, (s.get("tailReading") or {}).get("paragraphs", []))
    for a in lf.get("agePeriods", []):
        parts = " ".join(a[k] for k in ("essence", "strength", "risk", "action") if a.get(k))
        out.append(f"- **{a['from']}–{a['to']} лет · {a['arcanum']} {name(a['arcanum'])}** — {parts}")
    for key, label in (("summary", "Итог"), ("strength", "Сила"), ("tension", "Напряжение"), ("practice", "Практика")):
        if lf.get(key):
            out += ["", f"**{label}.** {lf[key]}"]
    return out + [""]


SENTENCE = re.compile(r"(?<=[.!?…])\s+")


def dedupe(lines):
    count = {}
    for line in lines:
        for part in SENTENCE.split(line):
            if len(part) > 40:
                count[part] = count.get(part, 0) + 1
    seen, out = set(), []
    for line in lines:
        kept = []
        for part in SENTENCE.split(line):
            if len(part) <= 40:
                kept.append(part)
            elif part not in seen:
                seen.add(part)
                kept.append(part + (f" (×{count[part]})" if count[part] > 1 else ""))
        if any(len(k) > 40 for k in kept) or not line.strip() or line.startswith(("#", "*")):
            out.append(" ".join(kept))
    return out


def brief(task):
    auto = task.get("automatic_reading") or {}
    name = names("ru")
    head = [f"# Заявка {task['id']}: {task['kind']}",
            "",
            f"- Язык статьи: {task['locale']}",
            f"- Период: {task['year'] or 'обычный разбор, без прогноза на год'}",
            f"- Данные: {json.dumps(task['inputs'], ensure_ascii=False)}",
            f"- Комментарий заказчика: {task['comment'] or 'нет'}",
            f"- Статус: {task['status']}{' (черновик уже сдан)' if task.get('article') else ''}",
            "",
            "## Расчёт",
            "",
            "Числа верные: это выход движка сайта. Пересчитывать их не нужно.",
            "",
            *matrix_block({**(auto.get("matrix") or {}), **({"_year_request": task["year"]} if task.get("year") else {})}, name),
            "",
            *(year_blocks(task, name) if task.get("year") else []),
            *(year_details(task, name) if task.get("year") and task["inputs"].get("birth") else []),
            "## Автоматический разбор: подарок рядом с отчётом",
            "",
            "Тексты собраны калькулятором из готовых кусков по каждой позиции и паре позиций. Отчёт самодостаточен: "
            "основы можно назвать своими словами, но ценность — в связях и выводах, которых здесь нет. Два блока "
            "отчёт показывает как есть: тексты чакр (`{\"insert\": \"chakras\"}`) и текст кармического хвоста "
            "(`{\"insert\": \"karmic_tail\"}`) — они ниже, в разделах «Чакры» и «Кармический хвост»; их не пересказывай. "
            "Повторы убраны: каждая фраза оставлена один раз, а (×N) значит, что читатель встретил её N раз.",
            ""]
    body = []
    for s in auto.get("sections", []):
        body += section_block(s, name)
    if auto.get("units"):
        body += units_block(auto["units"], name)
    if auto.get("business"):
        body += ["## Совместимость в работе (деловой расчёт)", ""]
        business = auto["business"]
        if isinstance(business, dict) and any(isinstance(v, dict) and "text" in v for v in business.values()):
            body += units_block(business, name)
        else:
            body += ["```json", json.dumps(business, ensure_ascii=False, indent=1), "```", ""]
    if auto.get("roles"):
        head += [f"Роли: {json.dumps(auto['roles'], ensure_ascii=False)} (a — первая дата, b — вторая)", ""]
    return "\n".join(head + dedupe(body))


def paragraph_text(p):
    if isinstance(p, str):
        return p
    if "h3" in p:
        return p["h3"]
    if "ul" in p or "ol" in p:
        return " ".join(p.get("ul") or p.get("ol"))
    if "table" in p:
        return " ".join(" ".join(r) for r in [p["table"]["head"], *p["table"]["rows"]])
    return ""


def numbers(x):
    if isinstance(x, bool):
        return set()
    if isinstance(x, int):
        return {x} if 1 <= x <= 22 else set()
    if isinstance(x, dict):
        return set().union(*map(numbers, x.values())) if x else set()
    if isinstance(x, list):
        return set().union(*map(numbers, x)) if x else set()
    return set()


def formula_text(f):
    return " ".join(x if isinstance(x, str) else x.get("label", "") for x in f.get("items", [])) + " " + f.get("caption", "")


def block_text(b):
    if isinstance(b, str) or not isinstance(b, dict) or set(b) & {"h3", "ul", "ol", "table"}:
        return paragraph_text(b)
    if "formula" in b:
        return formula_text(b["formula"])
    if "finding" in b:
        f = b["finding"]
        return " ".join([f.get("title", ""), formula_text(f["formula"]) if f.get("formula") else "", *f.get("text", []),
                         f.get("action", "")])
    if "timeline" in b:
        return " ".join(f"{t.get('age', '')} {t.get('title', '')} {t.get('text', '')}" for t in b["timeline"])
    if "selfcheck" in b:
        return " ".join(" ".join([c.get("label", ""), *c.get("plus", []), *c.get("minus", [])]) for c in b["selfcheck"])
    return ""


def report_strings(a):
    yield a["title"]
    yield a["lead"]
    yield from a.get("summary", [])
    for c in a["chapters"]:
        yield c["h2"]
        yield c["conclusion"]
        for card in c.get("cards", []):
            yield card["label"]
            yield card["caption"]
        yield from (block_text(b) for b in c["blocks"])
        yield from c.get("actions", [])
    for q in a.get("faq", []):
        yield q["q"]
        yield from (paragraph_text(x) for x in q["a"])
    for src in a.get("sources", []):
        yield src["title"]
        yield src["note"]


def strings(article):
    if article.get("version") == 2:
        yield from report_strings(article)
        return
    yield article["title"]
    yield article["lead"]
    for s in article["sections"]:
        yield s["h2"]
        yield from (paragraph_text(p) for p in s["paragraphs"])
        for c in s.get("cards", []):
            yield c["label"]
            yield c["caption"]
        for src in s.get("sources", []):
            yield src["title"]
            yield src["note"]


def text_ok(x, limit):
    return isinstance(x, str) and 0 < len(x.strip()) and len(x) <= limit


def paragraph_ok(p):
    return isinstance(p, str) and p.strip() or isinstance(p, dict) and (
        set(p) == {"h3"} and text_ok(p["h3"], 300)
        or set(p) in ({"ul"}, {"ol"}) and isinstance(next(iter(p.values())), list) and next(iter(p.values()))
        and all(text_ok(x, 5000) for x in next(iter(p.values())))
        or set(p) == {"table"} and isinstance(p["table"], dict) and set(p["table"]) == {"head", "rows"}
        and p["table"]["head"] and all(isinstance(r, list) for r in p["table"]["rows"]))


def points_ok(points):
    return isinstance(points, list) and len(points) <= 6 and all(x in POINT_LETTERS for x in points)


def forecast_ok(x):
    year, month = x.get("year", []), x.get("month")
    return isinstance(year, list) and len(year) <= 6 and all(v in YEAR_LETTERS for v in year) and (
        month is None or isinstance(month, dict) and set(month) == {"n", "points"} and isinstance(month["n"], int)
        and 1 <= month["n"] <= 12 and isinstance(month["points"], list) and 1 <= len(month["points"]) <= 6
        and all(v in MONTH_LETTERS for v in month["points"]))


def formula_errors(f, where):
    if not isinstance(f, dict) or set(f) - {"items", "caption"} or not isinstance(f.get("items"), list) \
            or not 2 <= len(f["items"]) <= 9 or len(str(f.get("caption", ""))) > 1000:
        return [f"{where}: формула {json.dumps(f, ensure_ascii=False)[:160]}"]
    errors = []
    for x in f["items"]:
        if isinstance(x, str):
            if x not in OPERATORS:
                errors.append(f"{where}: знак формулы «{x}» — допустимы {' '.join(OPERATORS)}")
        elif not isinstance(x, dict) or set(x) - {"points", "year", "month"} != {"arcanum", "label"} or not isinstance(x.get("arcanum"), int) \
                or not 1 <= x["arcanum"] <= 22 or not text_ok(x.get("label"), 120) or not points_ok(x.get("points", [])) \
                or not forecast_ok(x):
            errors.append(f"{where}: карта формулы {json.dumps(x, ensure_ascii=False)[:120]}")
    return errors


def report_shape_errors(a):
    errors = []
    allowed = {"version", "title", "lead", "summary", "chapters", "faq", "sources"}
    if set(a) - allowed:
        errors.append(f"лишние поля отчёта: {sorted(set(a) - allowed)}")
    if not text_ok(a.get("title"), 300) or not text_ok(a.get("lead"), 5000):
        errors.append("title до 300 и lead до 5000 символов — непустые строки")
    if not isinstance(a.get("summary"), list) or not 3 <= len(a["summary"]) <= 9 or not all(text_ok(x, 2000) for x in a["summary"]):
        errors.append("summary: 3–9 строк «Главного за минуту»")
    chapters = a.get("chapters")
    if not isinstance(chapters, list) or not 1 <= len(chapters) <= 30:
        return errors + ["chapters: список из 1–30 глав"]
    for i, c in enumerate(chapters, 1):
        where = f"глава {i}"
        extra = set(c) - {"kind", "h2", "conclusion", "cards", "blocks", "actions"}
        if extra:
            errors.append(f"{where}: лишние поля {sorted(extra)}")
        if c.get("kind") not in CHAPTER_KINDS:
            errors.append(f"{where}: kind — одно из {', '.join(CHAPTER_KINDS)}")
        if not text_ok(c.get("h2"), 300) or not text_ok(c.get("conclusion"), 2000):
            errors.append(f"{where}: h2 до 300 и conclusion до 2000 символов — непустые строки")
        cards = c.get("cards", [])
        if not isinstance(cards, list) or len(cards) > 4:
            errors.append(f"{where}: cards — до четырёх карт")
        for card in cards if isinstance(cards, list) else []:
            if set(card) - {"points", "year", "month"} != {"arcanum", "label", "caption"} or not isinstance(card.get("arcanum"), int) \
                    or not 1 <= card["arcanum"] <= 22 or not text_ok(card.get("label"), 150) \
                    or not text_ok(card.get("caption"), 1000) or not points_ok(card.get("points", [])) or not forecast_ok(card):
                errors.append(f"{where}: карта {json.dumps(card, ensure_ascii=False)[:120]}")
        actions = c.get("actions", [])
        if not isinstance(actions, list) or len(actions) > 8 or not all(text_ok(x, 2000) for x in actions):
            errors.append(f"{where}: actions — до восьми строк")
        blocks = c.get("blocks")
        if not isinstance(blocks, list) or not blocks:
            errors.append(f"{where}: blocks — непустой список")
            continue
        for b in blocks:
            if paragraph_ok(b):
                continue
            if not isinstance(b, dict) or len(b) != 1:
                errors.append(f"{where}: неверный блок {json.dumps(b, ensure_ascii=False)[:120]}")
                continue
            kind, value = next(iter(b.items()))
            if kind == "chakra":
                if value not in CHAKRA_BLOCKS:
                    errors.append(f"{where}: чакра {value}")
            elif kind == "insert":
                if value not in ("chakras", "karmic_tail"):
                    errors.append(f"{where}: вставка {value} — допустимы chakras, karmic_tail")
            elif kind == "formula":
                errors += formula_errors(value, where)
            elif kind == "finding":
                if not isinstance(value, dict) or set(value) - {"title", "formula", "text", "action"} \
                        or not text_ok(value.get("title"), 200) or not isinstance(value.get("text"), list) \
                        or not 1 <= len(value["text"]) <= 6 or not all(text_ok(x, 5000) for x in value["text"]) \
                        or len(str(value.get("action", ""))) > 800:
                    errors.append(f"{where}: находка {json.dumps(value, ensure_ascii=False)[:160]}")
                elif value.get("formula"):
                    errors += formula_errors(value["formula"], where)
            elif kind == "timeline":
                if not isinstance(value, list) or not 1 <= len(value) <= 24 or not all(
                        isinstance(t, dict) and not set(t) - {"age", "arcanum", "title", "text", "now"}
                        and text_ok(t.get("age"), 20) and isinstance(t.get("arcanum"), int) and 1 <= t["arcanum"] <= 22
                        and text_ok(t.get("title"), 150) and text_ok(t.get("text"), 2000) for t in value):
                    errors.append(f"{where}: шкала времени {json.dumps(value, ensure_ascii=False)[:160]}")
            elif kind == "selfcheck":
                if not isinstance(value, list) or not 1 <= len(value) <= 12 or not all(
                        isinstance(x, dict) and set(x) - {"points", "year", "month"} == {"arcanum", "label", "plus", "minus"}
                        and isinstance(x.get("arcanum"), int) and 1 <= x["arcanum"] <= 22 and text_ok(x.get("label"), 120)
                        and points_ok(x.get("points", [])) and forecast_ok(x) and all(isinstance(x.get(k), list) and 1 <= len(x[k]) <= 6
                                                                  and all(text_ok(y, 1000) for y in x[k]) for k in ("plus", "minus"))
                        for x in value):
                    errors.append(f"{where}: самопроверка {json.dumps(value, ensure_ascii=False)[:160]}")
            else:
                errors.append(f"{where}: неизвестный блок {kind}")
    faq = a.get("faq", [])
    if not isinstance(faq, list) or len(faq) > 20 or not all(
            isinstance(q, dict) and set(q) == {"q", "a"} and text_ok(q["q"], 300) and isinstance(q["a"], list)
            and 1 <= len(q["a"]) <= 8 and all(isinstance(x, str) and x.strip() or isinstance(x, dict) and set(x) in ({"ul"}, {"ol"})
                                             and paragraph_ok(x) for x in q["a"]) for q in faq):
        errors.append("faq: до 20 вопросов {q, a}; a — абзацы и списки")
    sources = a.get("sources", [])
    if not isinstance(sources, list) or len(sources) > 20:
        errors.append("sources: до 20 источников")
    for src in sources if isinstance(sources, list) else []:
        if set(src) != {"title", "url", "note"} or not re.match(r"^https?://", str(src.get("url", ""))) \
                or not text_ok(src.get("title"), 300) or not text_ok(src.get("note"), 1500):
            errors.append(f"источник {json.dumps(src, ensure_ascii=False)[:160]}")
    return errors


def shape_errors(a):
    if a.get("version") == 2:
        return report_shape_errors(a)
    errors = []
    allowed = {"title": 300, "lead": 5000}
    if set(a) - {"title", "lead", "sections"}:
        errors.append(f"лишние поля статьи: {sorted(set(a) - {'title', 'lead', 'sections'})}")
    for key, limit in allowed.items():
        if not isinstance(a.get(key), str) or not a[key].strip() or len(a[key]) > limit:
            errors.append(f"{key}: строка 1–{limit} символов")
    sections = a.get("sections")
    if not isinstance(sections, list) or not 1 <= len(sections) <= 50:
        return errors + ["sections: список из 1–50 разделов"]
    for i, s in enumerate(sections, 1):
        where = f"раздел {i}"
        if set(s) - {"h2", "paragraphs", "cards", "sources"}:
            errors.append(f"{where}: лишние поля {sorted(set(s) - {'h2', 'paragraphs', 'cards', 'sources'})}")
        if not isinstance(s.get("h2"), str) or not s["h2"].strip() or len(s["h2"]) > 300:
            errors.append(f"{where}: h2 — строка до 300 символов")
        if not isinstance(s.get("paragraphs"), list) or not s["paragraphs"]:
            errors.append(f"{where}: paragraphs — непустой список")
        for p in s.get("paragraphs") or []:
            ok = isinstance(p, str) and p.strip() or isinstance(p, dict) and (
                set(p) == {"h3"} and isinstance(p["h3"], str) and 0 < len(p["h3"]) <= 300
                or set(p) in ({"ul"}, {"ol"}) and isinstance(next(iter(p.values())), list) and next(iter(p.values()))
                and all(isinstance(x, str) and x.strip() for x in next(iter(p.values())))
                or set(p) == {"table"} and isinstance(p["table"], dict) and set(p["table"]) == {"head", "rows"}
                and p["table"]["head"] and all(isinstance(r, list) for r in p["table"]["rows"])
                or set(p) == {"chakra"} and p["chakra"] in CHAKRA_BLOCKS)
            if not ok:
                errors.append(f"{where}: неверный абзац {json.dumps(p, ensure_ascii=False)[:120]}")
        cards = s.get("cards", [])
        if not isinstance(cards, list) or len(cards) > 4:
            errors.append(f"{where}: cards — до четырёх карт")
        for c in cards if isinstance(cards, list) else []:
            points = c.get("points", [])
            if set(c) - {"points"} != {"arcanum", "label", "caption"} or not isinstance(c.get("arcanum"), int) \
                    or not isinstance(points, list) or len(points) > 6 or not all(isinstance(x, str) for x in points) \
                    or not 1 <= c["arcanum"] <= 22 or not 0 < len(str(c.get("label", ""))) <= 150 \
                    or not 0 < len(str(c.get("caption", ""))) <= 1000:
                errors.append(f"{where}: карта {json.dumps(c, ensure_ascii=False)[:120]}")
        sources = s.get("sources", [])
        if not isinstance(sources, list) or len(sources) > 8:
            errors.append(f"{where}: sources — до восьми источников")
        for src in sources if isinstance(sources, list) else []:
            if set(src) != {"title", "url", "note"} or not re.match(r"^https?://", str(src.get("url", ""))) \
                    or not 0 < len(str(src.get("title", ""))) <= 300 or not 0 < len(str(src.get("note", ""))) <= 1500:
                errors.append(f"{where}: источник {json.dumps(src, ensure_ascii=False)[:160]}")
    return errors


def url_status(url):
    url = urllib.parse.quote(url, safe=":/?#[]@!$&'()*+,;=%~")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/130 Safari/537.36"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:
        return type(e).__name__


def chakra_paragraphs(a):
    counts, current = {}, None
    for s in a["sections"]:
        for p in s["paragraphs"]:
            if isinstance(p, dict) and "chakra" in p:
                current = p["chakra"]
                counts[current] = 0
            elif isinstance(p, dict) and "h3" in p:
                current = None
            elif isinstance(p, str) and current:
                counts[current] += 1
        current = None
    return counts


def report_items(a):
    for i, c in enumerate(a["chapters"], 1):
        for card in c.get("cards", []):
            yield i, card
        for b in c["blocks"]:
            if not isinstance(b, dict):
                continue
            formulas = [b["formula"]] if "formula" in b else [b["finding"]["formula"]] if b.get("finding", {}).get("formula") else []
            for f in formulas:
                for x in f["items"]:
                    if isinstance(x, dict):
                        yield i, x
            for x in b.get("selfcheck", []):
                yield i, x


def report_points(a):
    for i, x in report_items(a):
        yield i, x["arcanum"], x.get("points", [])


def forecast_errors(a, task):
    """`year` and `month` name points of the year and month matrices the site draws over a year reading."""
    errors, warnings = [], []
    birth, year = ((task or {}).get("inputs") or {}).get("birth"), (task or {}).get("year")
    used = [(i, x) for i, x in report_items(a) if x.get("year") or x.get("month")]
    if not (birth and year):
        return ([f"глава {i}: year и month — только в разборе на год одной даты" for i, _ in used[:3]] if task else []), []
    y = lisovskaya.year_matrix(birth, year)
    values = {**{k: y[k] for k in MONTH_LETTERS}, **{f"P{j}": p["total"] for j, p in enumerate(lisovskaya.year_periods(y), 1)}}
    for i, x in used:
        for letter in x.get("year", []):
            if values[letter] != x["arcanum"]:
                errors.append(f"глава {i}: в точке {letter} матрицы {year} года стоит {values[letter]}, а карта — {x['arcanum']}")
        month = x.get("month")
        if month:
            m = {k: v for k, v in lisovskaya.month_matrix(birth, year, month["n"]).items() if k in MONTH_LETTERS}
            for letter in month["points"]:
                if m[letter] != x["arcanum"]:
                    errors.append(f"глава {i}: в точке {letter} матрицы месяца {month['n']} стоит {m[letter]}, а карта — {x['arcanum']}")
    if not used:
        warnings.append("ни у одной карты нет year или month: схем матрицы года и месяцев рядом с картами не будет")
    # A repeat is drawn as an arc only through the named points: a card, a self-check line or a whole formula
    # shares one map, so the points are gathered over it.
    for i, group in forecast_groups(a):
        for (scope, n), listed in group.items():
            matrix = values if scope == "year" else {k: v for k, v in lisovskaya.month_matrix(birth, year, scope).items() if k in MONTH_LETTERS}
            rest = [k for k, v in matrix.items() if v == n and k not in listed]
            if rest:
                where = f"матрице {year} года" if scope == "year" else f"матрице месяца {scope}"
                warnings.append(f"глава {i}: карта {n} стоит в {where} ещё в {', '.join(rest)} — назови все точки, чтобы связь "
                                "нарисовалась линией")
    return errors, warnings


def forecast_groups(a):
    def gather(items):
        out = {}
        for x in items:
            if x.get("year"):
                out.setdefault(("year", x["arcanum"]), set()).update(x["year"])
            if x.get("month"):
                out.setdefault((x["month"]["n"], x["arcanum"]), set()).update(x["month"]["points"])
        return out
    for i, c in enumerate(a["chapters"], 1):
        for card in c.get("cards", []):
            yield i, gather([card])
        for b in c["blocks"]:
            if not isinstance(b, dict):
                continue
            formulas = [b["formula"]] if "formula" in b else [b["finding"]["formula"]] if b.get("finding", {}).get("formula") else []
            for f in formulas:
                yield i, gather([x for x in f["items"] if isinstance(x, dict)])
            for x in b.get("selfcheck", []):
                yield i, gather([x])


def check_report(a, task, online):
    errors, warnings = [], []
    texts = list(report_strings(a))
    traces = sorted({m.group(0) for t in texts for m in LOCAL_TRACE.finditer(t)})
    if traces:
        errors.append(f"в тексте служебные пути или имена файлов: {traces}")
    matrix = (task or {}).get("automatic_reading", {}).get("matrix") or {}
    pair, keys = "p" in matrix, {letter: key for letter, key, *_ in POINTS if letter}
    allowed = numbers(matrix) | set(map(int, re.findall(r"(?<![\d.])(\d{1,2})(?![\d.])", " ".join(extra_block(matrix, lambda n: ""))))) \
        if task else set()
    for i, arcanum, points in report_points(a):
        for letter in points if task else []:
            value = point_value(matrix["p"], letter) if pair else point_value(matrix, keys.get(letter, ""))
            if value is None:
                errors.append(f"глава {i}: точки {letter} нет на схеме над статьёй")
            elif value != arcanum:
                errors.append(f"глава {i}: в точке {letter} стоит {value}, а карта — {arcanum}")
        if allowed and arcanum not in allowed:
            warnings.append(f"глава {i}: карты {arcanum} нет в расчёте и в досчитанных точках — формула должна быть в тексте")
    if task:
        more_errors, more_warnings = forecast_errors(a, task)
        errors += more_errors
        warnings += more_warnings
    kinds = [c["kind"] for c in a["chapters"]]
    blocks = [b for c in a["chapters"] for b in c["blocks"] if isinstance(b, dict)]
    inserted = {b["insert"] for b in blocks if "insert" in b}
    if (pair or not matrix.get("chakras")) and ({b.get("chakra") for b in blocks} - {None} or "chakras" in inserted):
        errors.append("чакры есть только у личной схемы")
    if task and task.get("kind") == "personal" and not task.get("year"):
        missing = [k for k in PERSONAL_SKELETON if k not in kinds]
        if missing:
            errors.append(f"в полном личном разборе нет глав: {missing}")
        if "chakras" not in inserted:
            errors.append("нет вставки {\"insert\": \"chakras\"} — блок чакр автоматического разбора")
        if "karmic_tail" not in inserted:
            warnings.append("нет вставки {\"insert\": \"karmic_tail\"} — текст кармического хвоста")
        if not any("formula" in b or b.get("finding", {}).get("formula") for b in blocks):
            warnings.append("нет ни одной формулы: совпадения и суммы показываются картами (4 = 4, 8 ↔ 8, 14 + 8 = 22)")
        if not any("timeline" in b for b in blocks):
            warnings.append("нет шкалы времени в главе «Время»")
        if not any("selfcheck" in b for b in blocks):
            warnings.append("нет блока самопроверки")
        findings = sum("finding" in b for b in blocks)
        if findings < 5:
            warnings.append(f"находок в главе «Чего нет в автоматическом разборе»: {findings}, нужно 5–8")
        if len(a.get("faq", [])) < 6:
            warnings.append(f"вопросов в конце: {len(a.get('faq', []))}, нужно 6–10")
        if not 5 <= len(a["summary"]) <= 7:
            warnings.append(f"пунктов «Главного за минуту»: {len(a['summary'])}, нужно 5–7")
    if task and task.get("kind") == "pair":
        missing = [k for k in PAIR_SKELETON if k not in kinds]
        if missing:
            errors.append(f"в совместимости нет глав: {missing}")
        findings = sum("finding" in b for b in blocks)
        if findings < 5:
            warnings.append(f"находок в главе «Чего нет в автоматическом разборе»: {findings}, нужно 5–8")
        if not any("selfcheck" in b for b in blocks):
            warnings.append("нет блока самопроверки")
        if len(a.get("faq", [])) < 6:
            warnings.append(f"вопросов в конце: {len(a.get('faq', []))}, нужно 6–10")
        if not 5 <= len(a["summary"]) <= 7:
            warnings.append(f"пунктов «Главного за минуту»: {len(a['summary'])}, нужно 5–7")
    if task and task.get("year") and (task.get("inputs") or {}).get("birth"):
        missing = [k for k in YEAR_SKELETON if k not in kinds]
        if missing:
            errors.append(f"в разборе на год нет глав: {missing}")
        months = sum(k == "month" for k in kinds)
        if months != 12:
            errors.append(f"глав «Месяц»: {months}, нужно 12 — по одной на каждый месяц года")
        if inserted:
            warnings.append(f"вставки {sorted(inserted)} — часть личного разбора; в разборе на год их нет")
        if len(a.get("faq", [])) < 6:
            warnings.append(f"вопросов в конце: {len(a.get('faq', []))}, нужно 6–10")
        if not 5 <= len(a["summary"]) <= 7:
            warnings.append(f"пунктов «Главного за минуту»: {len(a['summary'])}, нужно 5–7")
    if task and not task.get("year") and not any(points for _, _, points in report_points(a)):
        warnings.append("ни у одной карты нет points: мини-схем рядом с картами не будет")
    for i, c in enumerate(a["chapters"], 1):
        if len(c.get("cards", [])) > 2:
            warnings.append(f"глава {i}: {len(c['cards'])} крупные карты — на телефоне несколько экранов до текста")
        for b in c["blocks"]:
            if isinstance(b, dict) and "table" in b:
                cols = len(b["table"]["head"])
                longest = max((len(str(x)) for r in b["table"]["rows"] for x in r), default=0)
                if cols > 3 or cols == 3 and longest > 40:
                    warnings.append(f"глава {i}: таблица в {cols} колонки, ячейки до {longest} знаков — на телефоне обрежется")
    urls = sorted({src["url"] for src in a.get("sources", [])})
    if not urls:
        errors.append("нет ни одного источника")
    if online:
        for url in urls:
            status = url_status(url)
            if status != 200:
                warnings.append(f"ссылка {url} ответила {status}")
    body = " ".join(texts)
    for label, pattern, limit in (("оборотов «не X, а Y»", r"\bне [а-яё]+, а ", 8),
                                  ("«калькулятор», «сайт»", r"калькулятор|\bсайт", 2),
                                  ("«полный разбор» вместо «автоматический разбор»", r"полн\w+ разбор", 0),
                                  ("упоминаний автоматического разбора", r"автоматическ", 4)):
        found = len(re.findall(pattern, body, re.I))
        if found > limit:
            warnings.append(f"{label}: {found}")
    words = sum(len(t.split()) for t in texts)
    if task and task.get("kind") == "pair" and words < 15000:
        warnings.append(f"слов {words}: совместимость — 16–20 тысяч слов своего текста")
    elif task and task.get("year") and words < 12000:
        warnings.append(f"слов {words}: разбор на год — 14–18 тысяч слов своего текста")
    elif task and task.get("kind") == "personal" and words < 9000:
        warnings.append(f"слов {words}: полный личный отчёт — 12–16 тысяч слов своего текста")
    per = {f"{i}. {c['kind']}": sum(len(t.split()) for t in [c["conclusion"], *map(block_text, c["blocks"]), *c.get("actions", []),
                                                             *[x["caption"] for x in c.get("cards", [])]])
           for i, c in enumerate(a["chapters"], 1)}
    stats = {"слов": words, "глав": len(a["chapters"]), "слов по главам": per, "вопросов": len(a.get("faq", [])),
             "вставки": sorted(inserted), "ссылки": urls}
    return errors, warnings, stats


def check(article_path, task, online=True):
    a = json.loads(Path(article_path).read_text())
    errors = shape_errors(a)
    if errors:
        return errors, [], {}
    if a.get("version") == 2:
        return check_report(a, task, online)
    warnings = []
    texts = list(strings(a))
    traces = sorted({m.group(0) for t in texts for m in LOCAL_TRACE.finditer(t)})
    if traces:
        errors.append(f"в тексте служебные пути или имена файлов: {traces}")
    matrix = (task or {}).get("automatic_reading", {}).get("matrix") or {}
    allowed = numbers(matrix) | set(map(int, re.findall(r"(?<![\d.])(\d{1,2})(?![\d.])", " ".join(extra_block(matrix, lambda n: ""))))) \
        if task else set()
    pair, keys = "p" in matrix, {letter: key for letter, key, *_ in POINTS if letter}
    for i, s in enumerate(a["sections"], 1):
        for c in s.get("cards", []) if task else []:
            for letter in c.get("points", []):
                value = point_value(matrix["p"], letter) if pair else point_value(matrix, keys.get(letter, ""))
                if value is None:
                    errors.append(f"раздел {i}: точки {letter} нет на схеме над статьёй")
                elif value != c["arcanum"]:
                    errors.append(f"раздел {i}: в точке {letter} стоит {value}, а карта — {c['arcanum']}")
    blocks = [p["chakra"] for s in a["sections"] for p in s["paragraphs"] if isinstance(p, dict) and "chakra" in p]
    if blocks and (pair or not matrix.get("chakras")):
        errors.append("блоки чакр есть только у личной схемы, у пары чакр нет")
    if task and not pair and matrix.get("chakras"):
        missing = [k for k in CHAKRA_BLOCKS if k not in blocks]
        if task.get("kind") == "personal" and missing:
            warnings.append(f"нет блоков чакр {missing}: под подзаголовком чакры читатель не увидит её карт и точек")
        essays = [k for k, n in chakra_paragraphs(a).items() if n >= 3]
        if len(essays) >= 4:
            warnings.append(f"у чакр {essays} по три абзаца и больше — похоже на семь очерков, как в полном разборе")
    if task and not any(c.get("points") for s in a["sections"] for c in s.get("cards", [])):
        warnings.append("ни у одной карты нет points: мини-схемы рядом с картами и ссылок на «аркан в позиции» не будет")
    for i, s in enumerate(a["sections"], 1):
        for c in s.get("cards", []):
            if allowed and c["arcanum"] not in allowed:
                warnings.append(f"раздел {i}: карты {c['arcanum']} нет в расчёте — это точка, которую вы досчитали сами? "
                                "Тогда формула должна быть в тексте")
    if task and task.get("kind") == "personal":
        body = " ".join(texts)
        missing = [c for c in CHAKRAS.get(task.get("locale", "ru"), CHAKRAS["ru"]) if c not in body]
        if missing:
            warnings.append(f"не упомянуты чакры: {missing}")
    for i, s in enumerate(a["sections"], 1):
        for p in s["paragraphs"]:
            if isinstance(p, dict) and "table" in p:
                cols = len(p["table"]["head"])
                longest = max((len(str(c)) for r in p["table"]["rows"] for c in r), default=0)
                if cols > 3 or cols == 3 and longest > 40:
                    warnings.append(f"раздел {i}: таблица в {cols} колонки, ячейки до {longest} знаков — на телефоне обрежется")
    unsourced = [f"{i}. {s['h2']}" for i, s in enumerate(a["sections"], 1) if not s.get("sources")]
    urls = sorted({src["url"] for s in a["sections"] for src in s.get("sources", [])})
    if not urls:
        errors.append("нет ни одного источника")
    if online:
        for url in urls:
            status = url_status(url)
            if status != 200:
                warnings.append(f"ссылка {url} ответила {status}")
    body = " ".join(texts)
    for label, pattern in (("оборотов «не X, а Y»", r"\bне [а-яё]+, а "), ("упоминаний полного разбора", r"полн\w+ разбор"),
                           ("«калькулятор», «сайт», «автоматический»", r"калькулятор|\bсайт|автоматическ")):
        found = len(re.findall(pattern, body, re.I))
        if found:
            warnings.append(f"{label}: {found}") if found > (6 if "не X" in label else 2) else None
    words = sum(len(t.split()) for t in texts)
    stats = {"слов": words, "разделов": len(a["sections"]),
             "карт": sum(len(s.get("cards", [])) for s in a["sections"]),
             "разделы с 3–4 картами (на телефоне несколько экранов до текста)":
                 [f"{i}. {s['h2']}" for i, s in enumerate(a["sections"], 1) if len(s.get("cards", [])) > 2],
             "разделы без источников": unsourced, "ссылки": urls}
    return errors, warnings, stats


def workdir(row_id):
    path = WORK / str(row_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def load_task(row_id):
    path = WORK / str(row_id) / "task.json"
    return json.loads(path.read_text()) if path.exists() else None


def report(errors, warnings, stats):
    for key, value in stats.items():
        print(f"{key}: {value}")
    for w in warnings:
        print("ЗАМЕЧАНИЕ", w)
    for e in errors:
        print("ОШИБКА", e)
    print("ИТОГ:", "можно сдавать" if not errors else "исправьте ошибки")


def shots(base, row_id, locale, out):
    from playwright.sync_api import sync_playwright
    # A print pass opens only the print layout, so the phone view needs an admin session.
    token = print_pass(base, row_id)
    email, password = os.environ.get("ARCANA_ADMIN_EMAIL"), os.environ.get("ARCANA_ADMIN_PASSWORD")
    if not token and (not email or not password):
        raise SystemExit("нет пропуска печати в ~/.config/arcana/print-pass/ и не заданы ARCANA_ADMIN_EMAIL, ARCANA_ADMIN_PASSWORD")
    out.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for label, size in (("desktop", (1360, 950)),) + (() if token else (("mobile", (390, 844)),)):
            page = browser.new_page(viewport={"width": size[0], "height": size[1]}, is_mobile=label == "mobile")
            page.route("**/*", only_site(base))
            if token:
                page.goto(base + print_url(base, row_id, locale), wait_until="load")
            else:
                page.goto(f"{base}/{locale}/login")
                page.get_by_test_id("auth-email").wait_for()
                page.wait_for_timeout(2500)
                page.get_by_test_id("auth-email").fill(email)
                page.get_by_test_id("auth-password").fill(password)
                page.get_by_test_id("auth-submit").click()
                page.wait_for_selector(".cabinet-heading", timeout=30_000)
                page.goto(f"{base}/{locale}/matrix/individual/{row_id}", wait_until="load")
            page.wait_for_selector("[data-testid=individual-article] h1", timeout=30_000)
            page.evaluate("""async () => {
                const images = [...document.querySelectorAll('[data-testid=individual-article] img')];
                images.forEach(i => { i.loading = 'eager'; });
                await Promise.all(images.map(i => i.decode().catch(() => null))); }""")
            page.wait_for_function("[...document.querySelectorAll('[data-testid=individual-article] img')]"
                                   ".every(i => i.complete && i.naturalWidth > 0)", timeout=60_000)

            def frame(selector, index, path):
                y = page.evaluate("([sel, i]) => { const r = document.querySelectorAll(sel)[i].getBoundingClientRect();"
                                  " return Math.max(0, r.top + window.scrollY - 8); }", [selector, index])
                height = min(size[1], page.evaluate("document.documentElement.scrollHeight") - y)
                page.screenshot(path=str(path), full_page=True, clip={"x": 0, "y": y, "width": size[0], "height": height})
            frame("[data-testid=individual-article] h1", 0, out / f"{label}-00-title.png")
            heads = "[data-testid=individual-article] h2[data-toc]"
            for i in range(page.locator(heads).count()):
                frame(heads, i, out / f"{label}-{i + 1:02d}.png")
            if label == "mobile":
                tables = page.locator("[data-testid=individual-article] table")
                for i in range(tables.count()):
                    tables.nth(i).scroll_into_view_if_needed()
                    tables.nth(i).screenshot(path=str(out / f"mobile-table-{i + 1}.png"))
            state = page.evaluate("""() => ({
                overflow: document.documentElement.scrollWidth - window.innerWidth,
                broken: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src),
                toc: document.querySelectorAll('[data-toc-root] h2').length })""")
            print(label, "горизонтальное переполнение:", state["overflow"], "px; битых картинок:", len(state["broken"]),
                  "; заголовков в оглавлении:", state["toc"])
            for src in state["broken"]:
                print("  битая картинка", src)
            page.close()
        browser.close()
    print("скриншоты:", out)


MIN_PAGES = 60
EXAMPLES = PROJECT / "web/content/individual-examples"


def export_example(base, row_id, slug):
    """Public sale example: the approved article with its inserts, without owner data."""
    if not LOCAL.match(base):
        raise SystemExit("пример выгружается только с локального стенда")
    import http.cookiejar
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(path, body=None):
        req = urllib.request.Request(base + path, json.dumps(body).encode() if body is not None else None,
                                     {"Content-Type": "application/json"})
        with opener.open(req, timeout=60) as resp:
            return json.load(resp)
    call("/api/auth/login", {"email": os.environ["ARCANA_ADMIN_EMAIL"], "password": os.environ["ARCANA_ADMIN_PASSWORD"]})
    row = call(f"/api/individual-readings/{row_id}/open", {"token": ""})
    if not row.get("article"):
        raise SystemExit("у заявки нет статьи")
    keep = ("product", "kind", "year", "inputs", "locale", "title", "article", "matrix", "inserts")
    example = {**{k: row.get(k) for k in keep}, "id": 0, "status": "done", "created_at": row.get("created_at"),
               "approved_at": row.get("approved_at") or row.get("created_at"), "href": f"/matrix/individual-example/{slug}",
               "can_pdf": False}
    EXAMPLES.mkdir(parents=True, exist_ok=True)
    out = EXAMPLES / f"{slug}.json"
    out.write_text(json.dumps(example, ensure_ascii=False, indent=1))
    print(f"пример: {out} ({out.stat().st_size // 1024} КБ)")


def only_site(base):
    # Like the print service: analytics and other domains must not see our checks.
    origin = urllib.parse.urlsplit(base)._replace(path="", query="", fragment="").geturl()
    return lambda route: route.continue_() if route.request.url.startswith((origin, "data:")) else route.abort()


def print_pass(base, row_id):
    path = Path.home() / ".config/arcana/print-pass" / f"{urllib.parse.urlsplit(base).hostname}-{row_id}.token"
    return path.read_text().strip() if path.exists() else None


def print_url(base, row_id, locale):
    token = print_pass(base, row_id)
    if token:
        return f"/{locale}/print/individual?r={row_id}&t={token}"
    import http.cookiejar
    email, password = os.environ.get("ARCANA_ADMIN_EMAIL"), os.environ.get("ARCANA_ADMIN_PASSWORD")
    if not email or not password:
        raise SystemExit("нет пропуска печати в ~/.config/arcana/print-pass/ и не заданы ARCANA_ADMIN_EMAIL, ARCANA_ADMIN_PASSWORD")
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(base + path, data, {"Content-Type": "application/json"})
        try:
            with opener.open(req, timeout=60) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            raise SystemExit(f"{path}: {e.code} {e.read().decode()[:500]}")
    call("/api/auth/login", {"email": email, "password": password})
    return call(f"/api/admin/individual-readings/{row_id}/preview")["url"]


def pages(base, row_id, locale, out):
    from playwright.sync_api import sync_playwright
    url = print_url(base, row_id, locale)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 1800})
        page.route("**/*", only_site(base))
        page.goto(base + url, wait_until="load")
        page.wait_for_selector("[data-print-ready]", timeout=120_000)
        page.evaluate("async () => { const im = [...document.images]; im.forEach(i => { i.loading = 'eager'; });"
                      " await Promise.all(im.map(i => i.decode().catch(() => null))); }")
        page.pdf(path=str(out), format="A4", print_background=True)
        browser.close()
    count = len(re.findall(rb"/Type\s*/Page(?![a-zA-Z])", out.read_bytes()))
    print(f"страниц A4: {count} (минимум {MIN_PAGES}); PDF: {out}")
    print("ИТОГ:", "объём есть" if count >= MIN_PAGES else f"не хватает {MIN_PAGES - count} стр.")
    return count


def main():
    parser = argparse.ArgumentParser(description="Индивидуальный разбор: задание, проверка, сдача, скриншоты, страницы.")
    parser.add_argument("--base", default=os.environ.get("ARCANA_BASE", "http://localhost:3000"))
    sub = parser.add_subparsers(dest="cmd", required=True)
    for cmd in ("brief", "check", "submit", "shots", "pages", "export"):
        p = sub.add_parser(cmd)
        p.add_argument("id", type=int)
        if cmd == "export":
            p.add_argument("slug", choices=("personal", "pair", "year"))
        if cmd in ("check", "submit"):
            p.add_argument("article", nargs="?")
            p.add_argument("--offline", action="store_true", help="не проверять ссылки")
    args = parser.parse_args()
    base = args.base.rstrip("/")
    work = workdir(args.id)
    if args.cmd == "brief":
        task = api(base, f"/{args.id}")
        previous = load_task(args.id)
        same = ("kind", "inputs", "locale", "comment", "year")
        if previous and any(previous.get(k) != task.get(k) for k in same):
            stale = work.with_name(f"{args.id}-old-{time.strftime('%Y%m%d-%H%M%S')}")
            work.rename(stale)
            print(f"в папке была другая заявка с этим номером, она перенесена в {stale}")
            work = workdir(args.id)
        for old in (work / "shots").glob("*.png"):
            old.unlink()
        (work / "task.json").write_text(json.dumps(task, ensure_ascii=False, indent=1))
        (work / "brief.md").write_text(brief(task))
        if task.get("article"):
            (work / "current-article.json").write_text(json.dumps(task["article"], ensure_ascii=False, indent=1))
        print(f"задание: {work / 'task.json'}\nбриф: {work / 'brief.md'}\nпромпт: {ROOT / task['prompt']}")
        return
    if args.cmd == "shots":
        task = load_task(args.id) or api(base, f"/{args.id}")
        shots(base, args.id, task["locale"], work / "shots")
        return
    if args.cmd == "export":
        export_example(base, args.id, args.slug)
        return
    if args.cmd == "pages":
        task = load_task(args.id) or api(base, f"/{args.id}")
        if pages(base, args.id, task["locale"], work / "print-a4.pdf") < MIN_PAGES:
            sys.exit(1)
        return
    article = Path(args.article or work / "article.json")
    task = load_task(args.id)
    errors, warnings, stats = check(article, task, online=not args.offline)
    report(errors, warnings, stats)
    if errors:
        sys.exit(1)
    if args.cmd == "submit":
        result = api(base, f"/{args.id}/article", json.loads(article.read_text()))
        locale = (task or {}).get("locale", "ru")
        print("сдано, статус:", result.get("status"))
        if result.get("status") == "done":
            print("статья уже одобрена: правка видна владельцу сразу, письма нет, PDF перепечатывается сам")
        print("ревью:", f"{base}/{locale}/matrix/individual/{args.id}")


if __name__ == "__main__":
    main()
