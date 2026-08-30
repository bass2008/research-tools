#!/usr/bin/env python3
"""Собрать локальное evidence единого релиза; сеть и окружения не изменяет."""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import subprocess
from pathlib import Path


PROJECT = Path(__file__).resolve().parents[2]
ROOT = PROJECT.parents[1]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True,
                          text=True).stdout.strip()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--preflight", choices=("passed", "failed"), default="passed")
    args = parser.parse_args()
    output = Path(args.output).resolve()
    sitemap = PROJECT / "web" / ".next" / "server" / "app" / "sitemap.xml.body"
    if not sitemap.exists():
        raise SystemExit("нет production build sitemap.xml.body")
    xml = sitemap.read_text(encoding="utf-8")
    content_files = sorted((PROJECT / "web" / "content").glob("*.json"))
    contract_files = [PROJECT / "spec" / "method.json", PROJECT / "spec" / "entities.json"]
    audit_files = sorted((ROOT / "tools" / "seo" / "audit").glob("*.json"))
    status = git("status", "--porcelain", "--", "project/destiny-matrix", "tools/seo")
    diff = git("diff", "--binary", "--", "project/destiny-matrix", "tools/seo")
    payload = {
        "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "release": "unified-method-content-seo",
        "preflight": args.preflight,
        "git": {
            "commit": git("rev-parse", "HEAD"),
            "branch": git("rev-parse", "--abbrev-ref", "HEAD"),
            "dirty": bool(status),
            "dirty_paths": status.splitlines(),
            "tracked_diff_sha256": hashlib.sha256(diff.encode()).hexdigest(),
        },
        "method": {str(path.relative_to(ROOT)): digest(path) for path in contract_files},
        "content": {str(path.relative_to(ROOT)): digest(path) for path in content_files},
        "seo_audit": {str(path.relative_to(ROOT)): digest(path) for path in audit_files},
        "sitemap": {
            "sha256": digest(sitemap),
            "url_count": xml.count("<loc>"),
            "last_modified_values": sorted(set(
                part.split("</lastmod>", 1)[0] for part in xml.split("<lastmod>")[1:])),
        },
        "release_allowed": args.preflight == "passed" and not bool(status),
        "release_blocker": None if not status else "dirty tree: сначала review и отдельный commit",
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"manifest: {output}; sitemap URL: {payload['sitemap']['url_count']}; dirty: {bool(status)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
