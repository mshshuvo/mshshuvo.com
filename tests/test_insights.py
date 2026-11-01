"""Tests for the Insights loader: front matter validation and HTML sanitising."""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import insights  # noqa: E402

GOOD = """---
title: Test post
date: 2026-01-02
tags: [AI Governance]
summary: A summary.
---

Hello **world**.
"""


def write(dirpath: Path, name: str, text: str) -> Path:
    path = dirpath / name
    path.write_text(text, encoding="utf-8")
    return path


class SanitiserTests(unittest.TestCase):
    def test_strips_script_and_handlers(self):
        html = insights.render_markdown('<script>alert(1)</script>\n\n<p onclick="x()">hi</p>')
        self.assertNotIn("<script", html)
        self.assertNotIn("onclick", html)

    def test_blocks_javascript_links(self):
        html = insights.render_markdown("[click](javascript:alert(1))")
        self.assertNotIn("javascript:", html)

    def test_strips_iframes_images_and_styles(self):
        html = insights.render_markdown('<iframe src="https://x"></iframe><img src="https://x/a.png"><style>p{}</style>')
        for bad in ("<iframe", "<img", "<style"):
            self.assertNotIn(bad, html)

    def test_only_local_insight_images_survive(self):
        html = insights.render_markdown(
            "![ok](/static/img/insights/the-ai-paradox-cover.webp)\n\n"
            "![remote](https://evil.example/x.png)\n\n"
            "![traversal](/static/img/insights/../../../app.py)\n\n"
            "![missing](/static/img/insights/does-not-exist.webp)\n\n"
            '<img src="/static/img/insights/the-ai-paradox-cover.webp" onerror="alert(1)">')
        self.assertEqual(html.count("<img"), 2)
        self.assertNotIn("evil.example", html)
        self.assertNotIn("onerror", html)
        self.assertNotIn("..", html)
        self.assertIn('loading="lazy"', html)

    def test_links_get_noopener(self):
        html = insights.render_markdown("[site](https://example.com)")
        self.assertIn('rel="noopener noreferrer"', html)

    def test_keeps_basic_formatting(self):
        html = insights.render_markdown("## Head\n\n- one\n- two\n\n> quote\n\n`code`")
        for good in ("<h2>", "<li>", "<blockquote>", "<code>"):
            self.assertIn(good, html)


class LoaderTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_parses_good_post(self):
        post = insights.parse_post(write(self.dir, "test-post.md", GOOD))
        self.assertEqual(post["slug"], "test-post")
        self.assertEqual(post["date_display"], "January 2, 2026")
        self.assertEqual(post["minutes"], 1)
        self.assertIn("<strong>world</strong>", post["html"])

    def test_rejects_bad_slug(self):
        with self.assertRaises(insights.PostError):
            insights.parse_post(write(self.dir, "Bad Name.md", GOOD))

    def test_rejects_missing_fields(self):
        with self.assertRaises(insights.PostError):
            insights.parse_post(write(self.dir, "no-summary.md", GOOD.replace("summary: A summary.\n", "")))

    def test_rejects_bad_date(self):
        with self.assertRaises(insights.PostError):
            insights.parse_post(write(self.dir, "bad-date.md", GOOD.replace("2026-01-02", "Jan 2")))

    def test_rejects_missing_cover(self):
        text = GOOD.replace("summary:", "cover: no-such-image\ncover_alt: x\nsummary:")
        with self.assertRaises(insights.PostError):
            insights.parse_post(write(self.dir, "bad-cover.md", text))

    def test_cover_needs_alt_text(self):
        text = GOOD.replace("summary:", "cover: the-ai-paradox-cover\nsummary:")
        with self.assertRaises(insights.PostError):
            insights.parse_post(write(self.dir, "no-alt.md", text))

    def test_rejects_non_https_canonical(self):
        text = GOOD.replace("summary:", "canonical_url: javascript:alert(1)\nsummary:")
        with self.assertRaises(insights.PostError):
            insights.parse_post(write(self.dir, "bad-url.md", text))

    def test_drafts_skipped_and_sorted_newest_first(self):
        write(self.dir, "older.md", GOOD)
        write(self.dir, "newer.md", GOOD.replace("2026-01-02", "2026-03-04"))
        write(self.dir, "draft.md", GOOD.replace("summary:", "draft: true\nsummary:"))
        slugs = [p["slug"] for p in insights.load_posts(self.dir)]
        self.assertEqual(slugs, ["newer", "older"])

    def test_real_posts_load(self):
        posts = insights.load_posts()
        self.assertGreaterEqual(len(posts), 10)
        self.assertTrue(all(p["canonical_url"] for p in posts))
        self.assertTrue(all(p["cover"] and p["cover_og"] and p["cover_alt"] for p in posts))


if __name__ == "__main__":
    unittest.main()
