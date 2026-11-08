import datetime as dt
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "project/destiny-matrix"))

from engine.lisovskaya import material_karma  # noqa: E402
from engine.matrix import calculate, fold  # noqa: E402

NAMES = {
    1: "Маг", 2: "Жрица", 3: "Императрица", 4: "Император", 5: "Иерофант", 6: "Влюблённые",
    7: "Колесница", 8: "Справедливость", 9: "Отшельник", 10: "Колесо Фортуны", 11: "Сила",
    12: "Повешенный", 13: "Смерть", 14: "Умеренность", 15: "Дьявол", 16: "Башня", 17: "Звезда",
    18: "Луна", 19: "Солнце", 20: "Суд", 21: "Мир", 22: "Шут",
}
START = dt.date(1900, 1, 1)
END = dt.date.today()

rows = []
d = START
while d <= END:
    m = calculate(d)
    c, q, l = material_karma(m)
    rows.append({
        "date": d, "C": c, "Q": q, "L": l, "E": m.center, "B": m.month, "D": m.mission,
        "tail": tuple(m.karmic_tail), "talent": tuple(m.talent), "money": tuple(m.money),
    })
    d += dt.timedelta(days=1)

N = len(rows)
key = lambda r: (r["C"], r["Q"], r["L"])
triples = Counter(key(r) for r in rows)
first_date = {}
dates_of = defaultdict(list)
for r in rows:
    dates_of[key(r)].append(r["date"])
    first_date.setdefault(key(r), r["date"])


def t(k):
    return "-".join(map(str, k))


def names(k):
    return ", ".join(NAMES[x] for x in k)


def pct(x, total=N, digits=2):
    return f"{100 * x / total:.{digits}f}".replace(".", ",") + "%"


def one_in(x, total=N):
    return round(total / x)


def fmt(d):
    return d.strftime("%d.%m.%Y")


out = []
w = out.append

w("# Материальная карма C–Q–L: статистика по движку")
w("")
total = f"{N:,}".replace(",", " ")
w(f"Скрипт `stats.py`, движок `project/destiny-matrix/engine` (`calculate`, `material_karma`). "
  f"Перебор всех дат с {fmt(START)} по {fmt(END)}: **{total} дат**. "
  "Доли — доли календарных дат, а не людей: рождаемость по годам разная.")
w("")

w("## 1. Пример расчёта")
w("")
for ds in ("1992-08-12", "1992-01-01", "1988-01-06", "1993-03-31", "1989-09-09",
           "2001-01-05", "1929-01-05", "1986-04-23", "1992-07-15", "1984-03-10"):
    m = calculate(ds)
    c, q, l = material_karma(m)
    w(f"- {fmt(dt.date.fromisoformat(ds))}: A={m.day}, B={m.month}, C={m.year}, D={m.mission}, "
      f"E={m.center}; L=C+E={c}+{m.center}={c + m.center}→{l}; Q=C+L={c}+{l}={c + l}→{q}. "
      f"**C–Q–L = {c}-{q}-{l}** ({names((c, q, l))}). Хвост M–N–D {t(m.karmic_tail)}, "
      f"денежная L–R2–R {t(m.money)}, таланты B–P–K {t(m.talent)}.")
w("")

w("## 2. Сколько троек и какие числа бывают")
w("")
w(f"- Разных упорядоченных троек C–Q–L: **{len(triples)}**.")
for pos in ("C", "Q", "L"):
    vals = sorted({r[pos] for r in rows})
    missing = [n for n in range(1, 23) if n not in vals]
    w(f"- {pos}: {vals[0]}–{vals[-1]}, всего {len(vals)} значений; не бывает: {missing}.")
cnt = sorted(triples.values())
w(f"- Дат на тройку: медиана {statistics.median(cnt):.0f}, минимум {cnt[0]}, максимум {cnt[-1]}.")
for lim in (10, 50):
    k = sum(1 for v in cnt if v < lim)
    w(f"- Троек, у которых меньше {lim} дат: {k}.")
w("")

w("### Частоты по позициям")
w("")
w("| Аркан | C | Q | L |")
w("|---|---:|---:|---:|")
pos_cnt = {p: Counter(r[p] for r in rows) for p in ("C", "Q", "L")}
for n in range(1, 23):
    cells = [pct(pos_cnt[p][n], digits=1) if pos_cnt[p][n] else "—" for p in ("C", "Q", "L")]
    w(f"| {n} · {NAMES[n]} | " + " | ".join(cells) + " |")
w("")

w("## 3. Самые частые и самые редкие тройки")
w("")
w("| Место | Тройка | Арканы | Дат | Доля | Примерно | Пример даты |")
w("|---:|---|---|---:|---:|---|---|")
for i, (k, v) in enumerate(triples.most_common(15), 1):
    w(f"| {i} | {t(k)} | {names(k)} | {v} | {pct(v)} | каждая {one_in(v)}-я дата | {fmt(first_date[k])} |")
w("")
top10 = sum(v for _, v in triples.most_common(10))
top50 = sum(v for _, v in triples.most_common(50))
w(f"- Десять самых частых троек покрывают {pct(top10, digits=1)} дат, пятьдесят — {pct(top50, digits=1)}.")
w("")
w("Самые редкие:")
w("")
w("| Тройка | Арканы | Дат | Даты (до 6) |")
w("|---|---|---:|---|")
for k, v in sorted(triples.items(), key=lambda kv: (kv[1], kv[0]))[:12]:
    ds = ", ".join(fmt(x) for x in dates_of[k][:6])
    w(f"| {t(k)} | {names(k)} | {v} | {ds} |")
w("")

w("## 4. Тройка привязана к году рождения")
w("")
years_by_c = defaultdict(list)
for y in range(START.year, END.year + 1):
    years_by_c[fold(sum(int(ch) for ch in str(y)))].append(y)
w("| C | Аркан | Лет в диапазоне | Годы (до 8) | Троек с этой C |")
w("|---:|---|---:|---|---:|")
triples_by_c = Counter(k[0] for k in triples)
for c in sorted(years_by_c):
    ys = years_by_c[c]
    w(f"| {c} | {NAMES[c]} | {len(ys)} | {', '.join(map(str, ys[:8]))}{' …' if len(ys) > 8 else ''} | {triples_by_c[c]} |")
w("")
c20 = sorted({r["C"] for r in rows if r["date"].year < 2000})
c21 = sorted({r["C"] for r in rows if r["date"].year >= 2000})
w(f"- C у родившихся в 1900–1999: {c20[0]}–{c20[-1]} ({c20}).")
w(f"- C у родившихся с 2000 года: {c21}.")
only21 = [c for c in c21 if c not in c20]
w(f"- Только в XXI веке: C = {only21}. Только в XX веке: C = {[c for c in c20 if c not in c21]}.")
per_year = defaultdict(set)
centers_year = defaultdict(set)
for r in rows:
    per_year[r["date"].year].add(key(r))
    centers_year[r["date"].year].add(r["E"])
sizes = [len(v) for y, v in per_year.items() if y < END.year]
w(f"- В одном году (полные годы) разных троек: от {min(sizes)} до {max(sizes)}, медиана "
  f"{statistics.median(sizes):.0f}. Внутри года тройку определяет только центр E: "
  f"одинаковые C и E дают одинаковую тройку.")
by_ce = defaultdict(set)
for r in rows:
    by_ce[(r["C"], r["E"])].add(key(r))
w(f"- Проверка «одинаковые C и E всегда дают одну тройку»: {all(len(v) == 1 for v in by_ce.values())}.")
top_share, pair_same = [], []
for y in range(START.year, END.year):
    c_y = Counter(key(r) for r in rows if r["date"].year == y)
    tot = sum(c_y.values())
    top_share.append(max(c_y.values()) / tot)
    pair_same.append(sum((v / tot) ** 2 for v in c_y.values()))
all_same = sum((v / N) ** 2 for v in triples.values())
w(f"- Самая частая тройка внутри одного года: медиана {100 * statistics.median(top_share):.0f}% дат года "
  f"(от {100 * min(top_share):.0f}% до {100 * max(top_share):.0f}%).")
w(f"- Двое родившихся в один год: тройка совпадает с вероятностью {100 * statistics.median(pair_same):.0f}% "
  f"(медиана по годам). Две случайные даты всего диапазона: {100 * all_same:.1f}%.")
r1992 = sum(1 for r in rows if r["date"].year == 1992 and key(r) == (21, 7, 4))
w(f"- 21-7-4 в 1992 году: {r1992} дат из 366; во всём диапазоне — {triples[(21, 7, 4)]}.")
w("")

w("## 5. Повторы чисел")
w("")
kinds = {
    "C = Q": lambda k: k[0] == k[1],
    "Q = L": lambda k: k[1] == k[2],
    "C = L": lambda k: k[0] == k[2],
    "все три равны": lambda k: k[0] == k[1] == k[2],
}
for name, f in kinds.items():
    ks = [k for k in triples if f(k)]
    v = sum(triples[k] for k in ks)
    w(f"- {name}: {len(ks)} троек, {pct(v)} дат; {', '.join(t(k) for k in sorted(ks))}.")
w("")

w("## 6. Перестановки: одинаковые числа в другом порядке")
w("")
rev = sorted(k for k in triples if (k[2], k[1], k[0]) in triples and k[0] < k[2])
w(f"- Пар «C и L поменялись местами», где достижимы оба порядка: {len(rev)}. "
  f"Например: {', '.join(t(k) + ' / ' + t((k[2], k[1], k[0])) for k in rev[:8])}.")
w(f"- 3-6-21: {triples[(3, 6, 21)]} дат (первая {fmt(first_date[(3, 6, 21)])}); "
  f"21-6-3: {triples[(21, 6, 3)]} дат (первая {fmt(first_date[(21, 6, 3)])}).")
w("")

w("## 7. Совпадения с другими линиями")
w("")
tails = Counter(r["tail"] for r in rows)
both = sorted(k for k in triples if k in tails)
w(f"- Разных кармических хвостов M–N–D на тех же датах: {len(tails)}.")
w(f"- Записей «a-b-c», которые встречаются и как C–Q–L, и как хвост M–N–D: {len(both)} — "
  f"{', '.join(t(k) for k in both)}.")
w("  Порядок у линий противоположный: хвост пишут от центра наружу (M — у центра, D — "
  "внешний угол), материальную карму — снаружи к центру (C — внешний угол, L — у центра).")
for k in [(12, 19, 7), (18, 9, 9), (6, 5, 17), (9, 12, 3)]:
    w(f"  - {t(k)}: как C–Q–L — {triples.get(k, 0)} дат, как хвост — {tails.get(k, 0)} дат.")
same_tail = sum(1 for r in rows if key(r) == r["tail"])
w(f"- У одного человека C–Q–L совпадает с собственным хвостом M–N–D в той же записи: "
  f"{same_tail} дат ({pct(same_tail)}).")
mirror_tail = sum(1 for r in rows if r["C"] == r["D"])
check_tail = all((r["C"], r["Q"], r["L"]) == (r["tail"][2], r["tail"][1], r["tail"][0])
                 for r in rows if r["C"] == r["D"])
w(f"- C = D (материальная карма повторяет хвост, прочитанный от внешнего угла: C–Q–L = D–N–M): "
  f"{mirror_tail} дат, {pct(mirror_tail)}; проверка тождества: {check_tail}.")
mirror_tal = sum(1 for r in rows if key(r) == r["talent"])
check_tal = all(key(r) == r["talent"] for r in rows if r["C"] == r["B"]) and \
    mirror_tal == sum(1 for r in rows if r["C"] == r["B"])
w(f"- C–Q–L = линия талантов B–P–K: {mirror_tal} дат, {pct(mirror_tal)}; это ровно даты, "
  f"где аркан года равен номеру месяца (проверка: {check_tal}).")
same_l = all(r["L"] == r["money"][0] for r in rows)
w(f"- L материальной кармы = первая точка денежной линии L–R2–R у всех дат: {same_l}.")
w("")

w("## 8. Одно число: где оно стоит")
w("")
w("Доля дат, у которых число стоит в C, в Q, в L и хотя бы где-то в тройке.")
w("")
w("| Число | В C | В Q | В L | Где-нибудь |")
w("|---:|---:|---:|---:|---:|")
for n in (4, 6, 7, 8, 9, 10, 11, 21, 12, 19, 20, 22):
    anyw = sum(1 for r in rows if n in (r["C"], r["Q"], r["L"]))
    w(f"| {n} · {NAMES[n]} | {pct(pos_cnt['C'][n], digits=1)} | {pct(pos_cnt['Q'][n], digits=1)} | "
      f"{pct(pos_cnt['L'][n], digits=1)} | {pct(anyw, digits=1)} |")
w("")

w("## 9. Тройки из Вордстата")
w("")
for k in [(12, 19, 7), (4, 17, 13), (20, 11, 9), (8, 19, 11), (21, 7, 4), (22, 3, 8), (9, 9, 18),
          (8, 21, 13)]:
    if k in triples:
        rank = sorted(triples.values(), reverse=True).index(triples[k]) + 1
        ds = ", ".join(fmt(x) for x in dates_of[k][:3])
        yc = Counter(x.year for x in dates_of[k])
        yrs = [f"{y} ({yc[y]})" for y in sorted(yc)]
        w(f"- {t(k)} ({names(k)}): {triples[k]} дат, {pct(triples[k])}, место ~{rank} из {len(triples)}; "
          f"годы рождения: {', '.join(map(str, yrs))}; даты: {ds}.")
    else:
        w(f"- {t(k)}: не встречается.")
w("")

print("\n".join(out))
