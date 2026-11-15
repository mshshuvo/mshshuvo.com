"""Toolkit pages render, respect the site's Content Security Policy, and the downloads are self-contained."""
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import app  # noqa: E402
import toolkit  # noqa: E402


class ToolkitTests(unittest.TestCase):
    def test_shape(self):
        self.assertEqual(len(toolkit.TOOLS), len(toolkit.BY_SLUG))
        for t in toolkit.TOOLS:
            for key in ("name", "title", "seo_title", "short", "lead", "meta", "facts", "privacy"):
                self.assertTrue(t[key], f"{t['slug']}: {key}")
            for name in toolkit.script_files(t):
                self.assertTrue((ROOT / "static" / "toolkit" / name).is_file(), name)
            self.assertTrue((ROOT / "templates" / "toolkit" / f"{t['slug']}.html").is_file(), t["slug"])

    def test_pages_render(self):
        client = app.app.test_client()
        index = client.get("/toolkit").get_data(as_text=True)
        for t in toolkit.TOOLS:
            self.assertIn(f"/toolkit/{t['slug']}", index)
            html = client.get(f"/toolkit/{t['slug']}").get_data(as_text=True)
            self.assertIn(t["title"], html)
            self.assertIn(f'/downloads/{t["slug"]}.html', html)
            for name in toolkit.script_files(t):
                self.assertIn(f"/static/toolkit/{name}?v=", html)
        self.assertEqual(client.get("/toolkit/nope").status_code, 404)
        self.assertEqual(client.get("/downloads/nope.html").status_code, 404)

    def test_markup_obeys_csp(self):
        """style-src 'self' and script-src 'self': no inline styles, scripts or event handlers."""
        for t in toolkit.TOOLS:
            markup = toolkit.fragment(t["slug"])
            self.assertNotRegex(markup, r"(?i)<script|<style|\sstyle\s*=|\son[a-z]+\s*=", t["slug"])
            self.assertNotIn("{{", markup, "fragments are plain HTML so the download can reuse them")
            self.assertNotIn("{%", markup)
        for js in (ROOT / "static" / "toolkit").glob("*.js"):
            text = js.read_text(encoding="utf-8")
            self.assertNotRegex(text, r"""style\s*=\s*["'`$]""", f"{js.name}: write sizes as data-w / data-h")
            self.assertNotRegex(text, r"\beval\(|new Function\(", js.name)

    def test_download_is_self_contained(self):
        client = app.app.test_client()
        for t in toolkit.TOOLS:
            resp = client.get(f"/downloads/{t['slug']}.html")
            self.assertIn("attachment", resp.headers["Content-Disposition"])
            html = resp.get_data(as_text=True)
            self.assertEqual(html.count("<script>"), html.count("</script>"))
            self.assertNotRegex(html, r"(?i)<script[^>]+src=|<link[^>]+href=|@import")
            self.assertNotRegex(html, r"[\s:,]url\(", "no external CSS resources")
            self.assertNotRegex(html, r"\b(fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(")
            links = set(re.findall(r'href="(https?://[^"]+)"', html))
            self.assertEqual(links, {f"{toolkit.SITE_URL}/toolkit", toolkit.SITE["linkedin"]})
            self.assertIn("Built by", html)
            self.assertIn(toolkit.LICENCE, html)


if __name__ == "__main__":
    unittest.main()
