#!/usr/bin/env python3
import argparse
import hashlib
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

BLOCKS = {"p", "subtitle", "v", "text-author", "td", "th"}


def section_at(body, path, ns):
    node = body
    for index in path:
        node = node.findall("f:section", ns)[index]
    return node


def render(node, ns, out):
    tag = node.tag.split("}")[1]
    if tag == "title":
        out.append("\n## " + " ".join("".join(p.itertext()).strip() for p in node) + "\n")
        return
    if tag == "image":
        out.append("[Иллюстрация]")
        return
    if tag in BLOCKS:
        text = " ".join("".join(node.itertext()).split())
        if text:
            out.append(text)
        return
    if tag == "empty-line":
        return
    for child in node:
        render(child, ns, out)


def main():
    parser = argparse.ArgumentParser(description="Read a mapped section of the archived, user-provided FB2.")
    parser.add_argument("section", nargs="?", help="Section key; --list shows all")
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
        data = (base / source["archive"]).read_bytes()
        if hashlib.sha256(data).hexdigest() != source["sha256"]:
            raise ValueError("FB2 checksum differs from source-map.json; verify the edition before reading")
        root = ET.fromstring(data)
        ns = {"f": root.tag.split("}")[0].strip("{")}
        body = root.find("f:body", ns)
        print(sections[args.section]["heading"])
        for path in sections[args.section]["paths"]:
            out = []
            render(section_at(body, path, ns), ns, out)
            print(f"\nИсточник FB2: раздел {'.'.join(map(str, path))}\n")
            print("\n\n".join(out))
        return 0
    except (OSError, ValueError, KeyError, IndexError, ET.ParseError) as error:
        print(f"Cannot read source: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
