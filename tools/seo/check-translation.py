import importlib.util
import json
import re
import sys

ROOT = "/home/sergey/Personal/research-tools"
spec = importlib.util.spec_from_file_location("build", f"{ROOT}/tools/seo/build-content.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)
LINK = re.compile(r"\]\((/[^)\s]*)\)")
# сборка проверяет блоки толкования чакры по корпусу разборов; без него любой такой блок — ошибка
_readings = json.load(open(f"{ROOT}/project/destiny-matrix/web/content/en/chakra-personal.json", encoding="utf-8"))
build.CHAKRA_READINGS.update({key: set(chakra["readings"]) for key, chakra in _readings["chakras"].items()})


def load(path):
    return json.load(open(path, encoding="utf-8"))


def chakra_query(key):
    item = next(x for x in load(f"{ROOT}/project/destiny-matrix/web/content/en/chakras.json")["items"] if x["key"] == key)
    return item["seo"]["queries"][0]


CATEGORIES = {
    "arcana": {
        "source": lambda k: load(f"{ROOT}/tools/seo/content/ru/arcana/{k}.json")["article"],
        "result": "/home/sergey/Personal/arcanum-en/{}.json",
        "query": lambda k: f"destiny matrix {k}",
        "waite": True,
    },
    "chakras": {
        "source": lambda k: {f: v for f, v in load(f"{ROOT}/tools/seo/content/ru/chakras/{k}.json").items() if f in build.CHAKRA_ARTICLE},
        "result": "/home/sergey/Personal/chakra-en/{}.json",
        "query": chakra_query,
        "waite": False,
    },
}


def shape(block):
    if isinstance(block, str):
        return "p"
    kind = next(iter(block))
    if kind in ("ul", "ol"):
        return f"{kind}{len(block[kind])}"
    if kind == "table":
        return f"table{len(block[kind]['head'])}x{len(block[kind]['rows'])}"
    if kind == "chakra_reading":
        return f"reading:{block[kind].get('chakra')}:{block[kind].get('triple')}"
    if kind == "slot":
        return f"slot:{block[kind]}"
    return kind


def flat(value):
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return " ".join(flat(v) for v in value)
    if isinstance(value, dict):
        return " ".join(flat(v) for v in value.values())
    return ""


def check(category, key):
    conf = CATEGORIES[category]
    ru = conf["source"](key)
    try:
        en = load(conf["result"].format(key))
    except Exception as error:
        return [f"не читается: {error}"], [], 0, len(flat(ru).split())
    problems, warnings = [], []
    for field in ru:
        if field not in en:
            problems.append(f"нет поля {field}")
    if problems:
        return problems, warnings, 0, len(flat(ru).split())
    if len(en["sections"]) != len(ru["sections"]):
        problems.append(f"разделов {len(en['sections'])}, в русской {len(ru['sections'])}")
    for i, (r, e) in enumerate(zip(ru["sections"], en["sections"])):
        if [shape(p) for p in r["paragraphs"]] != [shape(p) for p in e["paragraphs"]]:
            problems.append(f"раздел {i + 1} «{e.get('h2', '')}»: блоки не совпадают с русскими")
    if "intro" in ru and [shape(p) for p in ru["intro"]] != [shape(p) for p in en["intro"]]:
        problems.append("вводные блоки не совпадают с русскими")
    if len(ru.get("faq", [])) != len(en.get("faq", [])):
        problems.append(f"вопросов FAQ {len(en.get('faq', []))}, в русской {len(ru.get('faq', []))}")
    links_ru = sorted(LINK.findall(json.dumps(ru, ensure_ascii=False)))
    links_en = sorted(LINK.findall(json.dumps(en, ensure_ascii=False)))
    if links_ru != links_en:
        problems.append(f"ссылки расходятся: лишние {sorted(set(links_en) - set(links_ru))}, нет {sorted(set(links_ru) - set(links_en))}")
    query = conf["query"](key)
    title, description = en["seo"].get("title", ""), en["seo"].get("description", "")
    if not title.lower().startswith(query.lower()):
        problems.append(f"seo.title не начинается с «{query}»: {title}")
    if len(title) > 70:
        problems.append(f"seo.title {len(title)} знаков, предел 70")
    if not description.lower().startswith(query.lower()):
        problems.append(f"seo.description не начинается с «{query}»")
    if not 100 <= len(description) <= 160:
        problems.append(f"seo.description {len(description)} знаков, нужно 100–160")
    if conf["waite"] and not any(re.search(r"waite", s["h2"], re.I) for s in en["sections"]):
        problems.append("нет раздела с Waite в заголовке")
    cyrillic = len(re.findall(r"[А-Яа-яЁё]", flat(en)))
    if cyrillic > 40:
        problems.append(f"кириллицы {cyrillic} знаков — перевод не закончен")
    elif cyrillic:
        warnings.append(f"кириллицы {cyrillic} знаков (допустимо для русских названий книг)")
    where = f"en/{category}/{key}"
    build.check_article(en, where, problems)
    build.check_links(en, where, problems, build.known_paths("en"))
    build.hygiene(en, where, "", warnings, "en")
    return problems, warnings, len(flat(en).split()), len(flat(ru).split())


def main():
    category, keys = sys.argv[1], sys.argv[2:]
    for key in keys:
        problems, warnings, words, words_ru = check(category, key)
        print(key, "OK" if not problems else "ОШИБКИ", f"слов {words} (в русской {words_ru})")
        for p in problems:
            print("  ✗", p)
        for w in warnings:
            print("  !", w)


if __name__ == "__main__":
    main()
