"""Insights: articles written as Markdown files in posts/.

Each file is posts/<slug>.md with YAML front matter:

    ---
    title: My article
    date: 2026-11-01            # publication date (YYYY-MM-DD)
    tags: [AI Governance, Risk]
    summary: One or two sentences for the list page, RSS and link previews.
    canonical_url: https://www.linkedin.com/pulse/...   # optional: where it first appeared
    lang: bn                    # optional: language if not English
    draft: true                 # optional: skipped by the build
    ---

    Body in Markdown...

The body is converted to HTML and then sanitised with an allowlist (nh3), so a
post can never inject scripts, iframes, styles or event handlers into the site.
"""
from __future__ import annotations

import datetime as dt
import math
import re
from pathlib import Path

import markdown
import nh3
import yaml

POSTS_DIR = Path(__file__).parent / "posts"
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
FRONT_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*\n(.*)\Z", re.S)
WORDS_PER_MINUTE = 220

ALLOWED_TAGS = {"p", "br", "hr", "h2", "h3", "h4", "strong", "em", "code", "pre", "blockquote",
                "ul", "ol", "li", "a", "table", "thead", "tbody", "tr", "th", "td"}
ALLOWED_ATTRS = {"a": {"href", "title"}, "th": {"align"}, "td": {"align"}}
REQUIRED = ("title", "date", "summary")


class PostError(ValueError):
    pass


def render_markdown(text: str) -> str:
    html = markdown.markdown(text, extensions=["tables", "sane_lists"], output_format="html")
    return nh3.clean(html, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS,
                     url_schemes={"https", "http", "mailto"}, link_rel="noopener noreferrer")


def reading_minutes(text: str) -> int:
    return max(1, math.ceil(len(text.split()) / WORDS_PER_MINUTE))


def parse_post(path: Path) -> dict:
    slug = path.stem
    if not SLUG_RE.match(slug):
        raise PostError(f"{path.name}: file name must be lowercase-words-with-hyphens")
    m = FRONT_RE.match(path.read_text(encoding="utf-8"))
    if not m:
        raise PostError(f"{path.name}: missing '---' front matter block")
    meta = yaml.safe_load(m.group(1)) or {}
    body = m.group(2).strip()
    missing = [k for k in REQUIRED if not meta.get(k)]
    if missing:
        raise PostError(f"{path.name}: missing {', '.join(missing)}")
    date = meta["date"]
    if not isinstance(date, dt.date):
        raise PostError(f"{path.name}: date must be YYYY-MM-DD")
    canonical = meta.get("canonical_url")
    if canonical and not str(canonical).startswith("https://"):
        raise PostError(f"{path.name}: canonical_url must be https")
    tags = meta.get("tags") or []
    if not isinstance(tags, list):
        raise PostError(f"{path.name}: tags must be a list, e.g. [AI, Risk]")
    return {
        "slug": slug,
        "title": str(meta["title"]).strip(),
        "date": date,
        "date_display": f"{date:%B} {date.day}, {date.year}",
        "tags": [str(t).strip() for t in tags],
        "summary": str(meta["summary"]).strip(),
        "canonical_url": canonical,
        "lang": meta.get("lang"),
        "draft": bool(meta.get("draft")),
        "minutes": reading_minutes(body),
        "html": render_markdown(body),
    }


def load_posts(directory: Path = POSTS_DIR) -> list[dict]:
    posts = [parse_post(p) for p in sorted(directory.glob("*.md"))]
    posts = [p for p in posts if not p["draft"]]
    return sorted(posts, key=lambda p: (p["date"], p["slug"]), reverse=True)


def all_tags(posts: list[dict]) -> list[str]:
    counts: dict[str, int] = {}
    for p in posts:
        for t in p["tags"]:
            counts[t] = counts.get(t, 0) + 1
    return sorted(counts, key=lambda t: (-counts[t], t.lower()))
