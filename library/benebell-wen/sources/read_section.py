#!/usr/bin/env python3
"""Read a mapped section of the archived, user-provided EPUB without dependencies."""

import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from zipfile import BadZipFile, ZipFile


class SectionText(HTMLParser):
    BLOCKS = {"p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr", "blockquote"}
    HIDDEN = {"head", "script", "style"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.HIDDEN:
            self.hidden_depth += 1
        if self.hidden_depth:
            return
        if tag in self.BLOCKS or tag == "br":
            self.parts.append("\n")
        elif tag in {"td", "th"}:
            self.parts.append(" | ")
        elif tag == "img":
            attributes = dict(attrs)
            self.parts.append("\n[Иллюстрация: " + attributes.get("src", "без пути")
                              + ("; " + attributes["alt"] if attributes.get("alt") else "") + "]\n")

    def handle_endtag(self, tag):
        if tag in self.HIDDEN:
            self.hidden_depth = max(0, self.hidden_depth - 1)
            return
        if not self.hidden_depth and tag in self.BLOCKS:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.hidden_depth:
            self.parts.append(data)

    def text(self):
        lines = [re.sub(r"[\t \xa0]+", " ", line).strip()
                 for line in "".join(self.parts).splitlines()]
        return "\n\n".join(line for line in lines if line)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("section", nargs="?", help="Section key, e.g. 12-hanged-man or chakras")
    parser.add_argument("--list", action="store_true", help="List available section keys")
    args = parser.parse_args()
    base = Path(__file__).resolve().parent
    try:
        source = json.loads((base / "source-map.json").read_text(encoding="utf-8"))
        sections = source["sections"]
        if args.list:
            for key, value in sections.items():
                print(f"{key}\t{value['heading']}")
            return 0
        if not args.section:
            parser.error("Specify a section or --list")
        if args.section not in sections:
            parser.error("Unknown section; use --list")
        book = base / source["archive"]
        if hashlib.sha256(book.read_bytes()).hexdigest() != source["sha256"]:
            raise ValueError("EPUB checksum differs from source-map.json; verify the edition before reading")
        print(sections[args.section]["heading"])
        with ZipFile(book) as archive:
            for member in sections[args.section]["members"]:
                reader = SectionText()
                reader.feed(archive.read(member).decode("utf-8-sig"))
                reader.close()
                print(f"\nИсточник EPUB: {member}\n")
                print(reader.text())
        return 0
    except (OSError, ValueError, KeyError, BadZipFile, UnicodeError) as error:
        print(f"Cannot read source: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
