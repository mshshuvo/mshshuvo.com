"""Insights: articles written as Markdown files in posts/.

Each file is posts/<slug>.md with YAML front matter:

    ---
    title: My article
    date: 2026-11-01            # publication date (YYYY-MM-DD)
    tags: [AI Governance, Risk]
    summary: One or two sentences for the list page, RSS and link previews.
    canonical_url: https://www.linkedin.com/pulse/...   # optional: where it first appeared
    cover: my-article-cover     # optional: static/img/insights/<cover>.webp (+ .jpg for link previews)
    cover_alt: What the cover image shows
    lang: bn                    # optional: language if not English
    draft: true                 # optional: skipped by the build
    ---

    Body in Markdown. Images: ![alt text](/static/img/insights/my-image.webp)

The body is converted to HTML and then sanitised with an allowlist (nh3), so a
post can never inject scripts, iframes, styles or event handlers into the site.
Images must be files in static/img/insights/; anything else is removed, which
keeps the strict Content-Security-Policy (img-src 'self') intact.
"""
from __future__ import annotations

import datetime as dt
import math
import re
from pathlib import Path

import markdown
import nh3
import yaml

ROOT = Path(__file__).parent
POSTS_DIR = ROOT / "posts"
IMG_DIR = ROOT / "static" / "img" / "insights"
IMG_PREFIX = "/static/img/insights/"
IMG_RE = re.compile(r"^/static/img/insights/[a-z0-9][a-z0-9-]*\.(?:webp|jpg|png)$")
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
FRONT_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*\n(.*)\Z", re.S)
WORDS_PER_MINUTE = 220

ALLOWED_TAGS = {"p", "br", "hr", "h2", "h3", "h4", "strong", "em", "code", "pre", "blockquote",
                "ul", "ol", "li", "a", "img", "table", "thead", "tbody", "tr", "th", "td"}
ALLOWED_ATTRS = {"a": {"href", "title"}, "img": {"src", "alt"}, "th": {"align"}, "td": {"align"}}
REQUIRED = ("title", "date", "summary")


class PostError(ValueError):
    pass


def _attribute_filter(tag: str, attr: str, value: str):
    if tag == "img" and attr == "src":
        return value if IMG_RE.match(value) and (ROOT / value.lstrip("/")).is_file() else None
    return value


def render_markdown(text: str) -> str:
    html = markdown.markdown(text, extensions=["tables", "sane_lists"], output_format="html")
    html = nh3.clean(html, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, attribute_filter=_attribute_filter,
                     url_schemes={"https", "http", "mailto"}, link_rel="noopener noreferrer",
                     set_tag_attribute_values={"img": {"loading": "lazy", "decoding": "async"}})
    # An <img> whose src was rejected is useless; drop it rather than leave a broken image.
    html = re.sub(r"<img(?![^>]*\ssrc=)[^>]*>", "", html)
    return re.sub(r"<p>\s*</p>\n?", "", html)


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
    cover = meta.get("cover")
    if cover:
        cover = str(cover)
        if not SLUG_RE.match(cover) or not (IMG_DIR / f"{cover}.webp").is_file():
            raise PostError(f"{path.name}: cover image static/img/insights/{cover}.webp not found")
        if not meta.get("cover_alt"):
            raise PostError(f"{path.name}: cover_alt is required when there is a cover image")
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
        "cover": f"{IMG_PREFIX}{cover}.webp" if cover else None,
        "cover_og": f"{IMG_PREFIX}{cover}.jpg" if cover and (IMG_DIR / f"{cover}.jpg").is_file() else None,
        "cover_alt": str(meta.get("cover_alt") or ""),
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
