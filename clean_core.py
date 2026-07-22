#!/usr/bin/env python3
"""
Стадия 1.3: чистка + кластеризация сырого ядра.

Вход:  cores/<slug>.json (сырой выход semcore.py)
Выход: cores/<slug>_clean.{csv,json} — только целевые фразы, разложенные по
       кластерам, с тегами интента (бесплатно/онлайн/нейросеть/платформа/...).

По умолчанию берём только kind=popular (фразы, содержащие запрос) и выкидываем
шумовые фразы (аудио, вотермарки и т.п.). Правила — константы ниже.
"""
import argparse
import csv
import json
import re
from datetime import datetime
from pathlib import Path

# фразы-исключения (не про удаление ВИЗУАЛЬНОГО фона)
NOISE = ("музык", "звук", "шум", "голос", "аудио", "вотермар", "логотип",
         "надпис", "субтитр", "водян", "мелоди", "песн")


def cluster_of(p):
    if any(w in p for w in ("помен", "смен", "замен")) or "цвет фона" in p:
        return "замена фона"
    return "удаление фона"


def tags_of(p):
    ai = bool(re.search(r"\b(ии|ai)\b", p)) or "нейросет" in p or "нейронк" in p
    platform = any(w in p for w in (
        "capcut", "кап кут", "капкут", "капкат", "телефон", "айфон", "андроид",
        "инстаграм", "сторис", "приложени", "программ", "скачать", "runway",
        "unscreen", "premiere", "премьер", "алайт"))
    return {
        "green": any(w in p for w in ("зелен", "хромакей", "зелён")),
        "free": "бесплат" in p,
        "online": "онлайн" in p,
        "ai": ai,
        "platform": platform,
        "howto": p.startswith("как "),
    }


def main():
    ap = argparse.ArgumentParser(description="Чистка + кластеризация ядра")
    ap.add_argument("--in", dest="inp", required=True, help="Сырой cores/<slug>.json")
    ap.add_argument("--include-associations", action="store_true",
                    help="Не только popular, но и все associations (шумно)")
    args = ap.parse_args()

    src = Path(args.inp)
    d = json.loads(src.read_text(encoding="utf-8"))
    kw = d["keywords"]

    kinds = ("popular", "association") if args.include_associations else ("popular",)
    rows = [k for k in kw if k["kind"] in kinds]
    rows = [k for k in rows if not any(n in k["phrase"] for n in NOISE)]

    clusters = {}
    for k in rows:
        c = cluster_of(k["phrase"])
        entry = {"phrase": k["phrase"], "freq": k["freq"], **tags_of(k["phrase"])}
        clusters.setdefault(c, []).append(entry)
    for c in clusters:
        clusters[c].sort(key=lambda x: x["freq"], reverse=True)

    total_demand = sum(k["freq"] for k in rows)
    out = {
        "topic": d["topic"],
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "total_phrases": len(rows),
        "total_demand": total_demand,
        "clusters": {
            c: {"count": len(items), "demand": sum(i["freq"] for i in items),
                "phrases": items}
            for c, items in sorted(clusters.items(),
                                   key=lambda kv: sum(i["freq"] for i in kv[1]),
                                   reverse=True)
        },
    }

    slug = src.stem
    json_path = src.with_name(f"{slug}_clean.json")
    json_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    csv_path = src.with_name(f"{slug}_clean.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["cluster", "phrase", "freq", "green", "free", "online", "ai", "platform", "howto"])
        for c, items in clusters.items():
            for i in items:
                w.writerow([c, i["phrase"], i["freq"], int(i["green"]), int(i["free"]),
                            int(i["online"]), int(i["ai"]), int(i["platform"]), int(i["howto"])])

    # сводка в консоль
    print(f"ЧИСТОЕ ЯДРО: {len(rows)} фраз | суммарный спрос ~{total_demand}/мес\n")
    for c, info in out["clusters"].items():
        print(f"  [{c}] {info['count']} фраз, спрос ~{info['demand']}")
    tagsum = {t: sum(1 for k in rows if tags_of(k["phrase"])[t])
              for t in ("green", "free", "online", "ai", "platform", "howto")}
    print("\n  теги (сколько фраз):", tagsum)
    print(f"\n  -> {json_path}\n  -> {csv_path}")


if __name__ == "__main__":
    main()
