#!/usr/bin/env python3
"""Schlägt fehl, wenn im ausgelieferten Quelltext eine E-Mail-Adresse im Klartext steht."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SUFFIXES = {".html", ".js", ".css", ".json", ".xml", ".txt", ".svg", ".php", ".py"}
SKIP_DIRS = {".git", ".claude", "node_modules", "docs", "supabase", "tests", "scripts", "screenshots"}
ALLOWED = {"example.com", "example.org", "email.com"}
AT = r"(?:@|＠|&#0*64;|&#x0*40;|&commat;|%40)"
EMAIL = re.compile(rf"[\w.+-]+{AT}([\w-]+(?:\.[\w-]+)+)", re.IGNORECASE)
MAILTO = re.compile(r"mailto:", re.IGNORECASE)


def scan(text: str) -> list[str]:
    hits = [m.group(0) for m in EMAIL.finditer(text) if m.group(1).lower() not in ALLOWED]
    hits += [m.group(0) for m in MAILTO.finditer(text)]
    return hits


def files(root: Path):
    for path in sorted(root.rglob("*")):
        rel = path.relative_to(root)
        if path.is_file() and path.suffix in SUFFIXES and not (set(rel.parts[:-1]) & SKIP_DIRS):
            yield path


def validate(root: Path = ROOT) -> list[str]:
    errors = []
    for path in files(root):
        # contact.js baut „mailto:“ zur Laufzeit; die Adresse selbst steht nie darin.
        text = path.read_text(encoding="utf-8", errors="ignore")
        if path.name == "contact.js":
            text = text.replace("'mailto:'", "")
        for hit in scan(text):
            errors.append(f"{path.relative_to(root)}: Klartext-Adresse gefunden: {hit}")
    return errors


if __name__ == "__main__":
    problems = validate()
    print("\n".join(problems) if problems else "OK: keine Klartext-E-Mail-Adressen.")
    sys.exit(1 if problems else 0)
