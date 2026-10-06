#!/usr/bin/env python3
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(
        description="Print a mapped section of the archived PDF (needs pdftotext from poppler-utils)")
    parser.add_argument("section", nargs="?", help="Section key, e.g. 15 or calculation")
    parser.add_argument("--list", action="store_true", help="List available section keys")
    parser.add_argument("--layout", action="store_true", help="Keep the PDF line layout")
    args = parser.parse_args()
    base = Path(__file__).resolve().parent
    try:
        source = json.loads((base / "source-map.json").read_text(encoding="utf-8"))
        sections = source["sections"]
        if args.list:
            for key, value in sections.items():
                first, last = value["pages"]
                print(f"{key}\t{first}–{last}\t{value['heading']}")
            return 0
        if not args.section:
            parser.error("Specify a section or --list")
        if args.section not in sections:
            parser.error("Unknown section; use --list")
        if not shutil.which("pdftotext"):
            raise OSError("pdftotext not found; install poppler-utils")
        book = base / source["archive"]
        if hashlib.sha256(book.read_bytes()).hexdigest() != source["sha256"]:
            raise ValueError("PDF checksum differs from source-map.json; verify the edition before reading")
        first, last = sections[args.section]["pages"]
        command = ["pdftotext", "-f", str(first), "-l", str(last)]
        if args.layout:
            command.append("-layout")
        result = subprocess.run(command + [str(book), "-"], capture_output=True, text=True, check=True)
        print(sections[args.section]["heading"])
        print(f"\nИсточник PDF: страницы {first}–{last}\n")
        print(result.stdout)
        return 0
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f"Cannot read source: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
