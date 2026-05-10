#!/usr/bin/env python3
"""niche-finder — ищет прибыльные ниши для pet-проектов."""

import argparse
import csv
import functools
import json
import os
import string
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

# ─── Config ──────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "output"
DOTENV_PATH = BASE_DIR / ".env"

RUSSIAN_ALPHABET = "абвгдежзиклмнопрстуфхцчшщэюя"
MODIFIERS_RU = [
    "как", "где", "что", "какой", "лучший", "топ", "бесплатно",
    "онлайн", "сервис", "программа", "приложение", "инструмент",
    "для бизнеса", "с нуля", "отзывы", "аналог", "альтернатива",
]
MODIFIERS_EN = [
    "how", "what", "best", "top", "free", "online", "tool",
    "service", "app", "software", "alternative", "vs", "review",
]

AUTOCOMPLETE_DELAY = 0.15  # seconds between requests
XMLRIVER_DELAY = 0.5
MIN_FREQUENCY = 50
TOP_KEYWORDS_FOR_SERP = 100


# ─── Retry decorator ─────────────────────────────────────────────────────────

def retry(max_attempts: int = 3, base_delay: float = 2.0, backoff: float = 2.0,
          exceptions: tuple = (Exception,)):
    """Retry decorator with exponential backoff."""
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(max_attempts):
                try:
                    return fn(*args, **kwargs)
                except exceptions as e:
                    last_exc = e
                    if attempt < max_attempts - 1:
                        delay = base_delay * (backoff ** attempt)
                        log(f"[retry] {fn.__name__} attempt {attempt+1} failed: {e} — waiting {delay:.0f}s")
                        time.sleep(delay)
                    else:
                        log(f"[retry] {fn.__name__} failed after {max_attempts} attempts: {e}")
            raise last_exc
        return wrapper
    return decorator


# ─── Helpers ─────────────────────────────────────────────────────────────────

def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


def http_get_json(url: str, timeout: int = 30) -> object:
    req = urllib.request.Request(url, headers={"User-Agent": "niche-finder/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        # Google Suggest returns ISO-8859-1 for non-ASCII queries
        charset = resp.headers.get_content_charset() or "utf-8"
        try:
            return json.loads(raw.decode(charset))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return json.loads(raw.decode("latin-1"))


def log(msg: str) -> None:
    print(f"  {msg}", file=sys.stderr)


# ─── Step 1: Google Autocomplete ────────────────────────────────────────────

@retry(max_attempts=3, base_delay=1.0)
def google_suggest(query: str, lang: str = "ru", country: str = "ru") -> list[str]:
    url = (
        "https://suggestqueries.google.com/complete/search?"
        + urllib.parse.urlencode({"client": "firefox", "q": query, "hl": lang, "gl": country})
    )
    data = http_get_json(url)
    return data[1] if isinstance(data, list) and len(data) > 1 else []


def expand_keywords(seeds: list[str], lang: str = "ru", country: str = "ru", depth: int = 1) -> set[str]:
    modifiers = MODIFIERS_RU if lang == "ru" else MODIFIERS_EN
    alphabet = RUSSIAN_ALPHABET if lang == "ru" else string.ascii_lowercase

    seen: set[str] = set()
    queue: list[tuple[str, int]] = [(s, 0) for s in seeds]

    while queue:
        query, level = queue.pop(0)
        if query in seen:
            continue
        seen.add(query)

        # base suggest
        suggestions = google_suggest(query, lang, country)
        time.sleep(AUTOCOMPLETE_DELAY)

        for s in suggestions:
            if s not in seen:
                seen.add(s)
                if level < depth:
                    queue.append((s, level + 1))

        # alphabet expansion
        for letter in alphabet:
            expanded = f"{query} {letter}"
            subs = google_suggest(expanded, lang, country)
            time.sleep(AUTOCOMPLETE_DELAY)
            for s in subs:
                if s not in seen:
                    seen.add(s)

        # modifier expansion
        if level == 0:
            for mod in modifiers:
                expanded = f"{query} {mod}"
                subs = google_suggest(expanded, lang, country)
                time.sleep(AUTOCOMPLETE_DELAY)
                for s in subs:
                    if s not in seen:
                        seen.add(s)

        log(f"[autocomplete] '{query}' → {len(seen)} total keywords")

    return seen


# ─── Step 2: XMLRiver Wordstat (frequency) ──────────────────────────────────

def xmlriver_configured() -> bool:
    return bool(os.environ.get("XMLRIVER_USER_ID")) and bool(os.environ.get("XMLRIVER_API_KEY"))


@retry(max_attempts=3, base_delay=2.0)
def wordstat_query(query: str) -> dict[str, int]:
    """One Wordstat request returns top keywords with frequencies for the query."""
    user_id = os.environ["XMLRIVER_USER_ID"]
    api_key = os.environ["XMLRIVER_API_KEY"]
    url = (
        "https://xmlriver.com/wordstat/new/json?"
        + urllib.parse.urlencode({"user": user_id, "key": api_key, "query": query})
    )
    data = http_get_json(url)
    result: dict[str, int] = {}
    if isinstance(data, dict):
        for section in ("popular", "associations"):
            for item in data.get(section, []):
                text = item.get("text", "")
                value = int(item.get("value", 0))
                if text and value >= MIN_FREQUENCY:
                    result[text] = value
    return result


def fetch_frequencies(seeds: list[str], keywords: set[str]) -> dict[str, int]:
    if not xmlriver_configured():
        log("[wordstat] XMLRiver not configured — skipping frequency check")
        return {}

    result: dict[str, int] = {}

    # Query Wordstat for each seed — one request per seed gives us top keywords
    for seed in seeds:
        log(f"[wordstat] querying '{seed}'...")
        freqs = wordstat_query(seed)
        result.update(freqs)
        time.sleep(XMLRIVER_DELAY)

    # Query every autocomplete keyword that doesn't have frequency yet
    remaining = sorted(kw for kw in keywords if kw not in result and kw not in seeds)
    log(f"[wordstat] querying {len(remaining)} remaining autocomplete keywords...")
    for i, kw in enumerate(remaining, 1):
        try:
            freqs = wordstat_query(kw)
            result.update(freqs)
        except Exception:
            pass
        if i % 20 == 0:
            log(f"[wordstat] {i}/{len(remaining)} done")
        time.sleep(XMLRIVER_DELAY)

    log(f"[wordstat] {len(result)} keywords with frequency >= {MIN_FREQUENCY}")
    return result


# ─── Step 3: XMLRiver SERP (competition) ────────────────────────────────────

@retry(max_attempts=3, base_delay=3.0)
def get_serp(keyword: str) -> list[dict]:
    user_id = os.environ["XMLRIVER_USER_ID"]
    api_key = os.environ["XMLRIVER_API_KEY"]
    url = (
        "https://xmlriver.com/search/xml?"
        + urllib.parse.urlencode({
            "user": user_id, "key": api_key,
            "query": keyword, "groupby": 10,
        })
    )
    req = urllib.request.Request(url, headers={"User-Agent": "niche-finder/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = resp.read().decode()
    root = ET.fromstring(raw)
    results = []
    for doc in root.iter("doc"):
        url_el = doc.find("url")
        title_el = doc.find("title")
        snippet_el = doc.find("snippet")
        results.append({
            "title": title_el.text if title_el is not None else "",
            "url": url_el.text if url_el is not None else "",
            "snippet": snippet_el.text if snippet_el is not None else "",
        })
    return results[:10]


def filter_relevant(frequencies: dict[str, int], seeds: list[str]) -> dict[str, int]:
    """Remove Wordstat noise — keep only keywords related to seeds."""
    seed_words = set()
    for s in seeds:
        seed_words.update(s.lower().split())
    # Also always keep these AI-related terms
    seed_words.update(["ии", "ai", "нейросеть", "нейросети", "генератор", "генерация",
                        "генерации", "бесплатно", "онлайн", "nsfw"])

    result = {}
    for kw, freq in frequencies.items():
        kw_words = set(kw.lower().split())
        # Keep if at least 1 seed word appears in the keyword
        if kw_words & seed_words:
            result[kw] = freq
    return result


def fetch_serps(keywords_by_freq: dict[str, int], seeds: list[str]) -> dict[str, list[dict]]:
    if not xmlriver_configured() or not keywords_by_freq:
        log("[serp] skipping SERP analysis")
        return {}

    clean = filter_relevant(keywords_by_freq, seeds)
    log(f"[serp] filtered {len(keywords_by_freq)} → {len(clean)} relevant keywords")
    top_keywords = sorted(clean, key=clean.get, reverse=True)[:TOP_KEYWORDS_FOR_SERP]
    log(f"[serp] fetching SERP for top {len(top_keywords)} keywords...")

    result: dict[str, list[dict]] = {}
    for i, kw in enumerate(top_keywords, 1):
        try:
            serp = get_serp(kw)
            if serp:
                result[kw] = serp
        except Exception:
            pass  # retry exhausted, skip this keyword
        if i % 10 == 0:
            log(f"[serp] {i}/{len(top_keywords)} done")
        time.sleep(1.0)

    return result




# ─── Output ──────────────────────────────────────────────────────────────────

def save_results(
    keywords: set[str],
    frequencies: dict[str, int],
    serps: dict[str, list[dict]],
) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # CSV with keywords — merge autocomplete + wordstat keys
    all_keywords = set(keywords) | set(frequencies.keys())
    csv_path = OUTPUT_DIR / "keywords.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["keyword", "frequency"])
        for kw in sorted(all_keywords, key=lambda k: -frequencies.get(k, 0)):
            writer.writerow([kw, frequencies.get(kw, "")])
    log(f"[output] {csv_path}")

    # JSON with full data
    json_path = OUTPUT_DIR / "data.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({
            "keywords": sorted(keywords),
            "frequencies": frequencies,
            "serps": serps,
        }, f, ensure_ascii=False, indent=2)
    log(f"[output] {json_path}")


# ─── Main ────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="niche-finder: find profitable niches for pet projects")
    parser.add_argument("--seeds", nargs="+", required=True, help="Seed queries to start from")
    parser.add_argument("--lang", default="ru", help="Language (ru/en)")
    parser.add_argument("--country", default="ru", help="Country code")
    parser.add_argument("--depth", type=int, default=1, help="Recursion depth for autocomplete")
    args = parser.parse_args()

    load_dotenv(DOTENV_PATH)

    log(f"Seeds: {args.seeds}")
    log(f"Lang: {args.lang}, Country: {args.country}, Depth: {args.depth}")

    # Step 1: Autocomplete
    log("\n=== Step 1: Google Autocomplete ===")
    keywords = expand_keywords(args.seeds, args.lang, args.country, args.depth)
    log(f"Collected {len(keywords)} unique keywords")

    # Step 2: Frequency
    log("\n=== Step 2: Wordstat Frequency ===")
    frequencies = fetch_frequencies(args.seeds, keywords)

    # Step 3: SERP
    log("\n=== Step 3: SERP Analysis ===")
    serps = fetch_serps(frequencies, args.seeds)

    # Filter frequencies for output
    clean_frequencies = filter_relevant(frequencies, args.seeds)

    # Save
    log("\n=== Saving Results ===")
    save_results(keywords, clean_frequencies, serps)

    log("\nDone!")


if __name__ == "__main__":
    main()
