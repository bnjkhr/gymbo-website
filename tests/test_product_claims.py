from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "validate_product_claims", ROOT / "scripts" / "validate_product_claims.py"
)
assert SPEC and SPEC.loader
VALIDATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VALIDATOR)


class ProductClaimValidatorTests(unittest.TestCase):
    def test_repository_claims_match_contract(self) -> None:
        self.assertEqual(VALIDATOR.validate(ROOT), [])

    def test_stale_price_and_exercise_count_are_rejected(self) -> None:
        source = "<main><p>217+ exercises for €4.99</p></main>"
        errors = VALIDATOR.validate_page("en/index.html", source)
        self.assertTrue(any("exercise count" in error for error in errors))
        self.assertTrue(any("product price" in error for error in errors))

    def test_amber_primary_effect_is_rejected(self) -> None:
        source = "<style>:root { --accent: #4ADE80; --accent-glow: rgba(245, 158, 11, 0.4); }</style>"
        errors = VALIDATOR.validate_page("index.html", source)
        self.assertTrue(any("Amber used as primary accent" in error for error in errors))

    def test_invalid_contract_is_rejected(self) -> None:
        contract = {
            "exerciseCatalogCount": 217,
            "watch": {"workoutExecutionIsFree": False, "independentInstallationVerified": True},
            "monetization": {"subscription": True, "priceSource": "Website"},
        }
        self.assertGreaterEqual(len(VALIDATOR.validate_contract(contract)), 5)


if __name__ == "__main__":
    unittest.main()
