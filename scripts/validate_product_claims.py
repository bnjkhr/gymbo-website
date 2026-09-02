#!/usr/bin/env python3
"""Validate public GymBo claims against the checked-in product contract."""

from __future__ import annotations

import argparse
import json
import re
import sys
from html import unescape
from pathlib import Path


PAGES = (
    "index.html",
    "en/index.html",
    "faq.html",
    "en/faq.html",
    "manifest.html",
    "en/manifest.html",
    "og-image.svg",
    "en/og-image.svg",
)

BLOCKED_PATTERNS = {
    "stale exercise count 217": r"\b217\+?\b",
    "stale exercise count 190": r"\b190\+?\b",
    "hard-coded product price": r"(?:4[,.]99\s*(?:€|EUR)|(?:€|EUR|\$)\s*4[,.]99)",
    "stale version campaign": r"\b(?:version\s*)?3\.0\b|\bv3\.0\b",
    "absolute privacy claim": r"100\s*%\s*(?:privat|private)",
    "iPhone-only data claim": r"(?:trainings|workout)daten?\s+bleib(?:en|t)\s+(?:lokal\s+)?auf\s+deinem\s+iPhone|(?:your\s+)?workout\s+data\s+stays\s+(?:locally\s+)?on\s+your\s+iPhone",
    "unverified independent-install claim": r"\bstandalone\b|independently install(?:able|ed)|unabhängig installierbar",
    "unshipped social feature": r"\b(?:challenges?|achievements?|leaderboards?)\b|Leaderboard\s*&\s*Freunde",
    "Amber used as primary accent": r"--accent-(?:soft|glow(?:-strong)?)\s*:\s*rgba\(245,\s*158,\s*11|--accent-(?:light|dark|darker)\s*:\s*#(?:FBBF24|F59E0B|B45309)",
}

REQUIRED_PHRASES = {
    "index.html": ("145 Übungen", "ohne iPhone in der Nähe", "Watch-Training ist kostenlos"),
    "en/index.html": ("145 exercises", "without your iPhone nearby", "Watch training is free"),
    "faq.html": ("145 vorinstallierte Übungen", "Watch-Training gehört zur kostenlosen Basis"),
    "en/faq.html": ("145 pre-installed exercises", "Watch training is part of the free core"),
    "manifest.html": ("Watch-Training", "kostenlosen Basis"),
    "en/manifest.html": ("Watch training", "free core"),
    "og-image.svg": ("145 Übungen", "Watch-Training kostenlos"),
    "en/og-image.svg": ("145 Exercises", "Watch Training Free"),
}


def visible_text(source: str) -> str:
    without_scripts = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", " ", source, flags=re.I | re.S)
    without_tags = re.sub(r"<[^>]+>", " ", without_scripts)
    return re.sub(r"\s+", " ", unescape(without_tags)).strip()


def validate_contract(contract: dict) -> list[str]:
    errors: list[str] = []
    if contract.get("exerciseCatalogCount") != 145:
        errors.append("product-claims.json: exerciseCatalogCount must be 145")
    watch = contract.get("watch", {})
    if watch.get("workoutExecutionIsFree") is not True:
        errors.append("product-claims.json: Watch workout execution must stay free")
    if watch.get("independentInstallationVerified") is not False:
        errors.append("product-claims.json: independent installation is not yet verified")
    monetization = contract.get("monetization", {})
    if monetization.get("subscription") is not False:
        errors.append("product-claims.json: GymBo must not claim a subscription")
    if monetization.get("priceSource") != "App Store":
        errors.append("product-claims.json: the App Store must remain the price source")
    return errors


def validate_page(relative_path: str, source: str) -> list[str]:
    errors: list[str] = []
    searchable = unescape(source)
    for label, pattern in BLOCKED_PATTERNS.items():
        if re.search(pattern, searchable, flags=re.I):
            errors.append(f"{relative_path}: {label}")

    page_text = visible_text(source)
    for phrase in REQUIRED_PHRASES[relative_path]:
        if phrase not in page_text:
            errors.append(f'{relative_path}: required claim missing: "{phrase}"')

    if relative_path.endswith(".html"):
        if "--accent: #4ADE80" not in source:
            errors.append(f"{relative_path}: primary accent must be GymBo Green #4ADE80")
        for payload in re.findall(
            r'<script\s+type="application/ld\+json"\s*>(.*?)</script>',
            source,
            flags=re.I | re.S,
        ):
            try:
                json.loads(payload)
            except json.JSONDecodeError as error:
                errors.append(f"{relative_path}: invalid JSON-LD: {error.msg}")
    return errors


def validate(root: Path) -> list[str]:
    contract_path = root / "product-claims.json"
    if not contract_path.is_file():
        return ["product-claims.json: file is missing"]

    try:
        contract = json.loads(contract_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        return [f"product-claims.json: invalid JSON: {error.msg}"]

    errors = validate_contract(contract)
    for relative_path in PAGES:
        path = root / relative_path
        if not path.is_file():
            errors.append(f"{relative_path}: file is missing")
            continue
        errors.extend(validate_page(relative_path, path.read_text(encoding="utf-8")))
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()

    errors = validate(args.root.resolve())
    if errors:
        print("Product claim validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Product claim validation passed for {len(PAGES)} public assets.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
