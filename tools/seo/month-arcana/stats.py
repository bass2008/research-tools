import datetime as dt
import hashlib
import sys
import types
from collections import Counter, defaultdict
from itertools import product
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
ENGINE = ROOT / "project/destiny-matrix/engine"
# Load only the formula modules: engine/__init__ also validates spec files unrelated to these numbers.
_pkg = types.ModuleType("engine")
_pkg.__path__ = [str(ENGINE)]
sys.modules["engine"] = _pkg

from engine.lisovskaya import month_matrix, year_matrix  # noqa: E402
from engine.matrix import digit_sum, fold, fold_year  # noqa: E402

NAMES = {1: "Маг", 2: "Жрица", 3: "Императрица", 4: "Император", 5: "Иерофант", 6: "Влюблённые",
         7: "Колесница", 8: "Справедливость", 9: "Отшельник", 10: "Колесо Фортуны", 11: "Сила",
         12: "Повешенный", 13: "Смерть", 14: "Умеренность", 15: "Дьявол", 16: "Башня", 17: "Звезда",
         18: "Луна", 19: "Солнце", 20: "Суд", 21: "Мир", 22: "Шут"}
MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь",
          "октябрь", "ноябрь", "декабрь"]
YEAR = 2026
FIRST, LAST = dt.date(1900, 1, 1), dt.date(2025, 12, 31)


def name(n):
    return f"{n} · {NAMES[n]}"


def pct(a, b, digits=2):
    return f"{100 * a / b:.{digits}f}".replace(".", ",") + "%"


def personal_center(b):
    a, m, y = fold(b.day), b.month, fold_year(b.year)
    d = fold(a + m + y)
    return fold(a + m + y + d)


def personal_year(b, year):
    # /year page and most calculators: day + month + digits of the year
    return fold(fold(fold(b.day) + b.month) + fold(digit_sum(year)))


def dates():
    d = FIRST
    while d <= LAST:
        yield d
        d += dt.timedelta(days=1)


def steps(birth, year, month):
    b = dt.date.fromisoformat(birth)
    ys = digit_sum(year)
    day = ys + month
    p = month_matrix(birth, year, month)
    lines = [
        f"Дата рождения {b:%d.%m.%Y}, месяц — {MONTHS[month - 1]} {year}.",
        f"- день месяца: сумма цифр {year} = {ys}, плюс номер месяца {month} = {day}; дата месяца {day}.{month:02d}.{year}",
        f"- A = {day} + {b.day} = {day + b.day}" + (f" → {p['A']}" if day + b.day > 22 else ""),
        f"- B = {month} + {b.month} = {month + b.month}" + (f" → {p['B']}" if month + b.month > 22 else ""),
        f"- C = {b.year} + {year} = {b.year + year} → {digit_sum(b.year + year)}"
        + (f" → {p['C']}" if digit_sum(b.year + year) > 22 else ""),
        f"- D = A + B + C = {p['A'] + p['B'] + p['C']}" + (f" → {p['D']}" if p['A'] + p['B'] + p['C'] > 22 else ""),
        f"- E = A + B + C + D = {p['A'] + p['B'] + p['C'] + p['D']}"
        + (f" → {p['E']}" if p['A'] + p['B'] + p['C'] + p['D'] > 22 else "") + f" — **центр месяца, {name(p['E'])}**",
        f"- F = A + B = {p['F']}, G = B + C = {p['G']}, H = C + D = {p['H']}, I = D + A = {p['I']}",
    ]
    return lines, p


out = []
w = out.append
w("# Аркан на месяц: числа из движка")
w("")
w("Скрипт: `tools/seo/month-arcana/stats.py`, движок — `month_matrix(birth, year, month)` и")
w("`year_matrix(birth, year)` из `project/destiny-matrix/engine/lisovskaya.py`.")
w("SHA-256 модулей при расчёте: " + ", ".join(
    f"`{f}` {hashlib.sha256((ENGINE / f).read_bytes()).hexdigest()[:16]}" for f in ("lisovskaya.py", "matrix.py")) + ".")
w("Запуск: `/home/sergey/miniconda3/envs/research3.12/bin/python tools/seo/month-arcana/stats.py > tools/seo/month-arcana/stats.md`.")
w(f"Население — все даты рождения с {FIRST:%d.%m.%Y} по {LAST:%d.%m.%Y}, месяцы — двенадцать месяцев {YEAR} года,")
w("если не сказано иное. Буквы — как в движке: A день, B месяц, C год, D нижняя точка, E центр,")
w("F = A + B, G = B + C, H = C + D, I = D + A.")
w("")

w("## 1. Примеры расчёта")
w("")
for birth, year, month, title in [("1975-01-19", 2026, 1, "Основной пример статьи"),
                                  ("1988-10-07", 2026, 11, "Контроль"),
                                  ("1998-06-30", 2023, 6, "Пример из книги Лисовской («Прогноз на месяц»: центр 7)")]:
    w(f"### {title}")
    w("")
    lines, p = steps(birth, year, month)
    for line in lines:
        w(line)
    w("")
assert month_matrix("1975-01-19", 2026, 1)["E"] == 20
assert month_matrix("1988-10-07", 2026, 11)["E"] == 8
assert month_matrix("1998-06-30", 2023, 6)["E"] == 7

w("### Девять точек основного примера и их роли на сайте (глава месяца в разборе года)")
w("")
p = month_matrix("1975-01-19", 2026, 1)
w("| Точка | Роль в разборе года | Аркан |")
w("|---|---|---|")
for key, role in [("E", "Центр — фон"), ("B", "Плюс"), ("F", "Плюс"), ("C", "Минус"), ("D", "Минус"),
                  ("A", "Люди"), ("G", "Слабое место"), ("H", "Нижний угол"), ("I", "Нижний угол")]:
    w(f"| {key} | {role} | {name(p[key])} |")
w("")

b = dt.date(1975, 1, 19)
w(f"### Двенадцать месяцев {YEAR} года для 19.01.1975 и другие способы счёта")
w("")
w(f"Личный центр 19.01.1975: {name(personal_center(b))}. Центр матрицы {YEAR} года по Лисовской: "
  f"{name(year_matrix(b, YEAR)['E'])}. Аркан года по странице /year: {name(personal_year(b, YEAR))}.")
w("")
w("| Месяц | Центр месяца (наш метод) | Аркан года + номер месяца | Номер месяца + сумма цифр года |")
w("|---|---|---|---|")
for m in range(1, 13):
    e = month_matrix(b, YEAR, m)["E"]
    alt = fold(personal_year(b, YEAR) + m)
    general = fold(m + digit_sum(YEAR))
    w(f"| {MONTHS[m - 1]} | {name(e)} | {name(alt)} | {name(general)} |")
w("")

w("## 2. Какие центры месяца возможны")
w("")
bound = Counter()
by_sum = defaultdict(set)
for a, bb, c in product(range(1, 23), repeat=3):
    s = a + bb + c
    e = fold(s + fold(s))
    bound[e] += 1
    by_sum[e].add(s)
possible = sorted(bound)
impossible = [n for n in range(1, 23) if n not in bound]
w(f"Перебор всех A, B, C от 1 до 22 ({22 ** 3} сочетаний): центр бывает {len(possible)} значений — "
  f"{', '.join(map(str, possible))}. Не бывает никогда: {', '.join(map(str, impossible))}.")
w("")
w("Какие суммы S = A + B + C дают каждый центр (E = свёртка S + свёртка S):")
w("")
w("| Центр | Суммы A + B + C |")
w("|---|---|")
for e in possible:
    w(f"| {e} | {', '.join(map(str, sorted(by_sum[e])))} |")
w("")
small = {e for e in possible if all(s <= 22 for s in by_sum[e])}
w(f"Центры, которые дают только суммы не больше 22 (центр = 2 × S): {', '.join(map(str, sorted(small)))}.")
big_max = max(fold(s + fold(s)) for s in range(23, 67))
w(f"При S от 23 до 66 центр не бывает больше {big_max}; S + свёртка S не больше "
  f"{max(s + fold(s) for s in range(23, 67))}.")
w("")

w(f"## 3. Как часто встречается каждый центр ({YEAR} год)")
w("")
births = list(dates())
freq = Counter()
per_person_distinct = Counter()
per_person_maxrep = Counter()
equal_personal = 0
persons_with_personal = 0
equal_year_centre = 0
equal_alt = 0
equal_general = 0
equal_birth_month = 0
nine_apart = Counter()
people_with = Counter()
total = 0
for bd in births:
    centres = [month_matrix(bd, YEAR, m)["E"] for m in range(1, 13)]
    pc = personal_center(bd)
    yc = year_matrix(bd, YEAR)["E"]
    py = personal_year(bd, YEAR)
    for m, e in enumerate(centres, 1):
        freq[e] += 1
        total += 1
        equal_personal += e == pc
        equal_year_centre += e == yc
        equal_alt += e == fold(py + m)
        equal_general += e == fold(m + digit_sum(YEAR))
        equal_birth_month += e == bd.month
    persons_with_personal += pc in centres
    per_person_distinct[len(set(centres))] += 1
    per_person_maxrep[max(Counter(centres).values())] += 1
    for x in set(centres):
        people_with[x] += 1
    for m1, m2 in [(1, 10), (2, 11), (3, 12)]:
        nine_apart[(m1, m2)] += centres[m1 - 1] == centres[m2 - 1]

n_people = len(births)
w(f"Дат рождения: {n_people}, пар «дата × месяц»: {total}.")
w("")
w("| Место | Центр | Доля месяцев | Примерно | Доля людей, у кого он есть хотя бы в одном месяце года |")
w("|---|---|---|---|---|")
for rank, (e, c) in enumerate(freq.most_common(), 1):
    w(f"| {rank} | {name(e)} | {pct(c, total)} | раз в {round(total / c)} месяцев | {pct(people_with[e], n_people, 1)} |")
w("")
never = [n for n in range(1, 23) if n not in freq]
w(f"На реальных датах не выпало: {', '.join(map(str, never))}.")
w("")

w("### Устойчивость по годам")
w("")
w("| Год | 7–11 вместе | 14 | 15 | пар с 16 / 18 / 20 / 22 | месяцы с 20 | невозможные |")
w("|---|---|---|---|---|---|---|")
for year in (2024, 2025, 2026, 2027, 2028):
    f = Counter()
    m20 = set()
    for bd in births:
        for m in range(1, 13):
            e = month_matrix(bd, year, m)["E"]
            f[e] += 1
            if e == 20:
                m20.add(m)
    t = sum(f.values())
    w(f"| {year} | {pct(sum(f[k] for k in range(7, 12)), t)} | {pct(f[14], t)} | {pct(f[15], t, 3)} | "
      f"{f[16]} / {f[18]} / {f[20]} / {f[22]} | {', '.join(MONTHS[m - 1] for m in sorted(m20)) or '—'} | "
      f"{', '.join(str(n) for n in range(1, 23) if not f[n])} |")
w("")
born_now = [bd for bd in births if 1950 <= bd.year <= 2010]
f = Counter(month_matrix(bd, YEAR, m)["E"] for bd in born_now for m in range(1, 13))
t = sum(f.values())
w(f"Только родившиеся в 1950–2010 годах, {YEAR}: 7–11 — {pct(sum(f[k] for k in range(7, 12)), t)}, "
  f"5, 6, 12 — {pct(f[5] + f[6] + f[12], t)}, 20 — {f[20]} пар, 15 — {pct(f[15], t, 3)}.")
w("")

w("### Пятнадцать: когда бывает")
w("")
ex15 = [(bd, m) for bd in births for m in range(1, 13) if month_matrix(bd, YEAR, m)["E"] == 15]
w(f"В {YEAR} году центр 15 — у {len(ex15)} пар «дата × месяц» из {total} ({pct(len(ex15), total, 3)}).")
if ex15:
    months15 = Counter(m for _, m in ex15)
    w(f"Месяцы: {', '.join(f'{MONTHS[m - 1]} {c}' for m, c in sorted(months15.items()))}.")
    w(f"Примеры: {', '.join(f'{bd:%d.%m.%Y} в {MONTHS[m - 1][:-1] + 'е' if MONTHS[m - 1].endswith('ь') else MONTHS[m - 1]}' for bd, m in ex15[:5])}.")
w("")

w(f"### Редкие центры {YEAR} года: 16, 18, 20, 22")
w("")
sums = Counter()
rare = defaultdict(list)
for bd in births:
    for m in range(1, 13):
        p = month_matrix(bd, YEAR, m)
        sums[p["A"] + p["B"] + p["C"]] += 1
        if p["E"] in (16, 18, 20, 22):
            rare[p["E"]].append((bd, m, p["A"], p["B"], p["C"]))
for e in (16, 18, 20, 22):
    rows = rare[e]
    w(f"- {name(e)}: {len(rows)} пар «дата × месяц»; людей {len({r[0] for r in rows})}; "
      f"месяцы: {', '.join(sorted({MONTHS[r[1] - 1] for r in rows}, key=MONTHS.index))}")
    w("  примеры: " + "; ".join(f"{bd:%d.%m.%Y}, {MONTHS[m - 1]} (A {a}, B {b_}, C {c})" for bd, m, a, b_, c in rows[:8]))
small_s = sum(c for s, c in sums.items() if s <= 11)
w(f"- сумма A + B + C не больше 11 — у {small_s} пар из {total} ({pct(small_s, total, 3)}); "
  f"самая частая сумма — {sums.most_common(1)[0][0]}, минимальная — {min(sums)}")
w("")
check = all((month_matrix(bd, YEAR, m)["E"] - 2 * month_matrix(bd, YEAR, m)["D"]) % 9 == 0
            for bd in births[::5] for m in range(1, 13))
w(f"Проверка «центр − 2 × нижняя точка делится на 9» на каждой пятой дате и всех месяцах {YEAR}: "
  f"{'выполняется всегда' if check else 'НАРУШЕНА'}.")
w("")

w(f"## 4. Сколько разных арканов у человека за {YEAR} год")
w("")
w("| Разных центров за 12 месяцев | Доля людей |")
w("|---|---|")
for k in sorted(per_person_distinct):
    w(f"| {k} | {pct(per_person_distinct[k], n_people, 1)} |")
w("")
w("| Самый частый центр повторяется за год | Доля людей |")
w("|---|---|")
for k in sorted(per_person_maxrep):
    w(f"| {k} раз | {pct(per_person_maxrep[k], n_people, 1)} |")
w("")
w("Месяцы, разнесённые на девять (номер месяца входит в A и B, а свёртка сохраняет остаток от деления на 9):")
w("")
for (m1, m2), c in nine_apart.items():
    w(f"- {MONTHS[m1 - 1]} и {MONTHS[m2 - 1]}: центр совпадает у {pct(c, n_people, 1)} людей")
other = Counter()
for bd in births[::7]:
    c = [month_matrix(bd, YEAR, m)["E"] for m in range(1, 13)]
    for i in range(12):
        for j in range(i + 1, 12):
            if j - i != 9:
                other["pairs"] += 1
                other["eq"] += c[i] == c[j]
w(f"- для сравнения, любые два месяца не через девять: {pct(other['eq'], other['pairs'], 1)} (каждая седьмая дата)")
w("")

w("## 5. Совпадения с другими числами")
w("")
w(f"- центр месяца = личный центр матрицы: {pct(equal_personal, total)} месяцев; хотя бы один такой месяц в {YEAR} "
  f"году — у {pct(persons_with_personal, n_people, 1)} людей")
w(f"- центр месяца = центр матрицы {YEAR} года по Лисовской: {pct(equal_year_centre, total)}")
w(f"- центр месяца = «аркан года (/year) + номер месяца»: {pct(equal_alt, total)}")
w(f"- центр месяца = «номер месяца + сумма цифр года» (общий для всех): {pct(equal_general, total)}")
w(f"- центр месяца = номер месяца рождения: {pct(equal_birth_month, total)}")
w("")

w("## 6. От чего зависит центр")
w("")
w("A зависит от дня рождения и выбранного месяца, B — от месяца рождения и выбранного месяца, C — от года")
w("рождения и выбранного года и весь год одна и та же. У родившихся в один день и месяц разных лет")
w("различается только C.")
w("")
for bd_md, m in [((1, 19), 1), ((10, 7), 11)]:
    c = Counter()
    for y in range(1900, 2026):
        c[month_matrix(dt.date(y, *bd_md), YEAR, m)["E"]] += 1
    w(f"- родившиеся {bd_md[1]:02d}.{bd_md[0]:02d} любого года, {MONTHS[m - 1]} {YEAR}: "
      + ", ".join(f"{e} — {k}" for e, k in sorted(c.items())) + " (центр — число лет)")
w("")

print("\n".join(out))
