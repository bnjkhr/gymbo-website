from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "check_no_plaintext_email", ROOT / "scripts" / "check_no_plaintext_email.py"
)
assert SPEC and SPEC.loader
CHECK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECK)


class PlaintextEmailTests(unittest.TestCase):
    def test_repository_has_no_plaintext_email(self) -> None:
        self.assertEqual(CHECK.validate(ROOT), [])

    def test_detects_variants(self) -> None:
        for sample in ('mail@benkohler.de', 'a＠b.de', 'x&#64;y.de', '<a href="mailto:z">', 'x%40y.de'):
            self.assertTrue(CHECK.scan(sample), sample)

    def test_obfuscated_form_is_clean(self) -> None:
        sample = '<span data-mail-user="mail" data-mail-domain="benkohler.de">mail [at] benkohler [punkt] de</span>'
        self.assertEqual(CHECK.scan(sample), [])
