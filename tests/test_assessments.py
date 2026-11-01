"""Readiness-check content stays consistent with the pages, services and the Worker's copy."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import app  # noqa: E402
from assessments import ASSESSMENTS, BANDS, worker_spec  # noqa: E402


class AssessmentTests(unittest.TestCase):
    def test_shape(self):
        self.assertEqual(len(ASSESSMENTS), len({a["slug"] for a in ASSESSMENTS}))
        for a in ASSESSMENTS:
            self.assertEqual(len(a["questions"]), 8, a["slug"])
            self.assertEqual(len(a["verdicts"]), len(BANDS), a["slug"])
            self.assertIn(a["service"], app.SERVICES_BY_SLUG, a["slug"])
            for q in a["questions"]:
                self.assertTrue(q["q"].endswith("?") and q["ref"] and q["fix"], q)

    def test_worker_copy_is_current(self):
        committed = json.loads((ROOT / "worker" / "assessments.json").read_text())
        self.assertEqual(committed, worker_spec(), "run python build.py and commit worker/assessments.json")

    def test_pages_render(self):
        client = app.app.test_client()
        self.assertEqual(client.get("/assessment").status_code, 200)
        for a in ASSESSMENTS:
            html = client.get(f"/assessment/{a['slug']}").get_data(as_text=True)
            self.assertIn(a["title"], html)
            self.assertEqual(html.count('class="q"'), 8)
        self.assertEqual(client.get("/assessment/nope").status_code, 404)


if __name__ == "__main__":
    unittest.main()
