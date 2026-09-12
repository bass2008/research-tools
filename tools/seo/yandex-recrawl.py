#!/usr/bin/env python3
"""Очередь переобхода Яндекс.Вебмастера: что слать сегодня и что уже слали.

Робот дошёл сам до 90 адресов карты из 444, поэтому остальное показываем ему адресно. Квота —
150 адресов в сутки, не накапливается; план разбивки на три дня —
project/destiny-matrix/docs/yandex-recrawl-plan.md.

Порядок задаёт спрос: сумма частот запросов, ведущих на адрес. Журнал отправленного лежит рядом
с артефактами аудита, поэтому повторный запуск в тот же день ничего не дублирует.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AUDIT = ROOT / "tools/seo/audit"
CONTENT = ROOT / "project/destiny-matrix/web/content"
LOG = AUDIT / "recrawl-log.csv"
TOKEN = Path.home() / ".config/arcana/webmaster.token"
CRAWLED = AUDIT / "yandex-crawled.txt"

API = "https://api.webmaster.yandex.net/v4"
SITE = "https://arcana-sense.ru"
LOG_FIELDS = ("sent_at", "url", "priority", "result", "task_id")

# Границы взяты из отдачи: выше 2000 показов лежат хвосты и позиции, ради которых корпус и
# писался, 500 — порог, по которому страница вообще появляется (build-position-arcanum.py).
P1_MIN, P2_MIN = 2000, 500


def token() -> str:
    env = os.environ.get("YANDEX_WEBMASTER_TOKEN")
    if env:
        return env.strip()
    if not TOKEN.exists():
        sys.exit(f"нет токена: {TOKEN} (или переменная YANDEX_WEBMASTER_TOKEN)")
    return TOKEN.read_text().strip()


def api(path: str, data: dict | None = None) -> tuple[int, dict]:
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(data).encode() if data is not None else None,
        headers={"Authorization": f"OAuth {token()}", "Content-Type": "application/json"},
        method="POST" if data is not None else "GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        body = e.read()
        try:
            return e.code, json.loads(body or b"{}")
        except json.JSONDecodeError:
            return e.code, {"raw": body.decode("utf-8", "replace")[:200]}


def host_ids(host: str) -> tuple[str, str]:
    status, user = api("/user/")
    if status != 200:
        sys.exit(f"{status} на /user/: {user}")
    uid = user["user_id"]
    status, hosts = api(f"/user/{uid}/hosts")
    for h in hosts.get("hosts", []):
        if host in h["ascii_host_url"]:
            if not h.get("verified"):
                sys.exit(f"{host}: права в Вебмастере не подтверждены")
            return str(uid), h["host_id"]
    sys.exit(f"{host} не найден среди сайтов пользователя {uid}")


def sitemap_urls(source: str) -> list[str]:
    raw = Path(source).read_text() if Path(source).exists() else _get(source)
    return [m.group(1) or "/" for m in re.finditer(r"<loc>https?://[^/]+([^<]*)</loc>", raw)]


def _get(url: str) -> str:
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read().decode()


def demand() -> Counter:
    """Спрос на адрес: сумма частот запросов, которые на него ведут."""
    out: Counter = Counter()
    core = AUDIT / "semantic-core.csv"
    if core.exists():
        for row in csv.DictReader(core.open()):
            url = (row.get("landing_url") or "").strip()
            if url.startswith("/"):
                try:
                    out[url] += int(row["frequency"])
                except (KeyError, ValueError):
                    continue
    pa = CONTENT / "position-arcanum.json"
    if pa.exists():
        for it in json.loads(pa.read_text())["items"]:
            out[f"/encyclopedia/position/{it['position']}/{it['arcanum']}"] += it["frequency"]
    kt = CONTENT / "karmic-tails.json"
    if kt.exists():
        for it in json.loads(kt.read_text())["items"]:
            freq = it.get("publication", {}).get("exact_frequency")
            if freq:
                out[f"/encyclopedia/karmic-tail/{it['key']}"] += freq
    return out


def crawled(path: Path) -> set[str]:
    if not path.exists():
        return set()
    return {l.strip() for l in path.read_text().splitlines() if l.strip() and not l.startswith("#")}


def priority(url: str, freq: int, seen: set[str]) -> str:
    if freq >= P1_MIN:
        return "P1"
    if freq >= P2_MIN:
        return "P2"
    if url.count("/") <= 2 and not url.startswith("/encyclopedia/"):
        return "P3"
    return "P5" if url in seen else "P4"


def build_queue(sitemap: str, seen_file: Path) -> list[tuple[str, str, int]]:
    freqs, seen = demand(), crawled(seen_file)
    rows = [(priority(u, freqs.get(u, 0), seen), u, freqs.get(u, 0)) for u in sitemap_urls(sitemap)]
    # Внутри приоритета — по спросу, а при равном спросе сочетания уходят в конец: их 231, и без
    # этого они вытеснили бы всё остальное из первых суток.
    return sorted(rows, key=lambda r: (r[0], -r[2], r[1].startswith("/encyclopedia/combination/"), r[1]))


def journal() -> dict[str, str]:
    if not LOG.exists():
        return {}
    return {r["url"]: r["result"] for r in csv.DictReader(LOG.open())}


def remember(rows: list[dict]) -> None:
    fresh = not LOG.exists()
    with LOG.open("a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=LOG_FIELDS)
        if fresh:
            w.writeheader()
        w.writerows(rows)


def cmd_status(args) -> int:
    uid, hid = host_ids(args.host)
    _, quota = api(f"/user/{uid}/hosts/{hid}/recrawl/quota")
    _, summary = api(f"/user/{uid}/hosts/{hid}/summary")
    print(f"user_id {uid}  host_id {hid}")
    print(f"квота сутки {quota.get('daily_quota')}, остаток {quota.get('quota_remainder')}")
    print(f"страниц в поиске {summary.get('searchable_pages_count')}, "
          f"исключено {summary.get('excluded_pages_count')}")
    done = journal()
    if done:
        print("журнал:", dict(Counter(done.values())))
    return 0


def cmd_queue(args) -> int:
    done = journal()
    rows = build_queue(args.sitemap, args.seen)
    left = [r for r in rows if r[1] not in done]
    print(f"адресов в карте {len(rows)}, уже отправлено {len(rows) - len(left)}")
    for p, group in sorted(Counter(r[0] for r in left).items()):
        print(f"  {p}: {group}")
    for p, url, freq in left[:args.show]:
        print(f"  {p}  {freq:6}  {url}")
    if len(left) > args.show:
        print(f"  … ещё {len(left) - args.show}")
    return 0


def cmd_send(args) -> int:
    uid, hid = host_ids(args.host)
    status, quota = api(f"/user/{uid}/hosts/{hid}/recrawl/quota")
    if status != 200:
        sys.exit(f"{status} на /recrawl/quota: {quota}")
    left_today = quota.get("quota_remainder", 0)
    done = journal()
    queue = [r for r in build_queue(args.sitemap, args.seen) if r[1] not in done]
    if args.priority:
        wanted = set(args.priority.split(","))
        queue = [r for r in queue if r[0] in wanted]
    plan = queue[:min(left_today, args.limit or left_today)]
    print(f"квота {quota.get('daily_quota')}, остаток {left_today}; к отправке {len(plan)} из {len(queue)}")
    if args.dry_run:
        for p, url, freq in plan:
            print(f"  {p}  {freq:6}  {url}")
        return 0

    written: list[dict] = []
    counts: Counter = Counter()
    for p, url, _ in plan:
        code, body = api(f"/user/{uid}/hosts/{hid}/recrawl/queue", {"url": SITE + url})
        result = {202: "ok", 409: "duplicate"}.get(code, f"error {code}")
        if code == 429:
            print(f"квота кончилась: {body}")
            break
        counts[result] += 1
        written.append({"sent_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                        "url": url, "priority": p, "result": result,
                        "task_id": body.get("task_id", "")})
        if result.startswith("error"):
            print(f"  {code} {url}: {body}")
        time.sleep(args.pause)
    if written:
        remember(written)
    print("итог:", dict(counts), f"| журнал: {LOG}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="переобход адресов сайта в Яндекс.Вебмастере")
    parser.add_argument("--host", default="arcana-sense.ru")
    parser.add_argument("--sitemap", default=f"{SITE}/sitemap.xml")
    parser.add_argument("--seen", type=Path, default=CRAWLED,
                        help="файл со списком адресов, куда робот уже заходил (снимок логов)")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status").set_defaults(fn=cmd_status)
    q = sub.add_parser("queue")
    q.add_argument("--show", type=int, default=20)
    q.set_defaults(fn=cmd_queue)
    s = sub.add_parser("send")
    s.add_argument("--limit", type=int, default=0, help="не больше этого числа за запуск")
    s.add_argument("--priority", help="только эти группы, например P1,P2,P3")
    s.add_argument("--pause", type=float, default=0.3)
    s.add_argument("--dry-run", action="store_true")
    s.set_defaults(fn=cmd_send)
    args = parser.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    raise SystemExit(main())
