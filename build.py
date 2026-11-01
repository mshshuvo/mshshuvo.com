"""Render the whole site to static files in dist/ for a Cloudflare Worker with static assets.

    python build.py            # writes dist/
    python -m http.server -d dist 8000   # quick local check (no security headers)

Each route is written as <path>.html; Cloudflare serves /projects from
projects.html, so links need no extension. The same security headers are
written to dist/_headers (static pages) and worker/site_headers.json (Worker 404s).
"""
import json
import shutil
from datetime import date, datetime, timedelta, timezone
from email.utils import format_datetime
from html import escape  # writes the RSS feed; nothing is parsed
from pathlib import Path

from app import POSTS, PROJECTS, SECURITY_HEADERS, SERVICES, SITE, app

ROOT = Path(__file__).parent
DIST = ROOT / "dist"
SITE_URL = "https://mshshuvo.com"
# IndexNow (Bing, Yandex, Seznam...): public by design, proves we own the host. Not a secret.
INDEXNOW_KEY = "53de5a436f6b78ef495a04f085b56ab9"  # gitleaks:allow (public verification key)

PAGES = ["/", "/projects", "/experience", "/publications", "/recommendations",
         "/services", "/assessment", "/contact", "/insights", "/insights/follow"] + \
        [f"/projects/{p['slug']}" for p in PROJECTS] + [f"/insights/{p['slug']}" for p in POSTS] + \
        [f"/services/{s['slug']}" for s in SERVICES]


def rss_feed() -> str:
    """RSS 2.0 feed of Insights, newest first."""
    def item(p):
        link = f"{SITE_URL}/insights/{p['slug']}"
        pub = format_datetime(datetime(p["date"].year, p["date"].month, p["date"].day, 12, tzinfo=timezone.utc))
        cats = "".join(f"<category>{escape(t)}</category>" for t in p["tags"])
        return (f"<item><title>{escape(p['title'])}</title><link>{link}</link>"
                f"<guid isPermaLink=\"true\">{link}</guid><pubDate>{pub}</pubDate>"
                f"<description>{escape(p['summary'])}</description>{cats}</item>")
    items = "\n    ".join(item(p) for p in POSTS)
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n'
            f"    <title>Insights · {escape(SITE['name'])}</title>\n"
            f"    <link>{SITE_URL}/insights</link>\n"
            f'    <atom:link href="{SITE_URL}/insights/feed.xml" rel="self" type="application/rss+xml"/>\n'
            "    <description>Writing on cybersecurity, GRC and AI governance.</description>\n"
            "    <language>en</language>\n"
            f"    {items}\n  </channel>\n</rss>\n")


def out_path(route: str) -> Path:
    return DIST / ("index.html" if route == "/" else route.strip("/") + ".html")


def main() -> None:
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()
    client = app.test_client()

    for route in PAGES:
        resp = client.get(route)
        if resp.status_code != 200:
            raise SystemExit(f"{route} returned {resp.status_code}")
        target = out_path(route)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(resp.data)

    resp = client.get("/__not_a_page__")
    (DIST / "404.html").write_bytes(resp.data)

    shutil.copytree(ROOT / "static", DIST / "static")

    # Response headers for static assets, and the same set for Worker-generated pages
    (ROOT / "worker" / "site_headers.json").write_text(json.dumps(SECURITY_HEADERS, indent=2) + "\n")
    lines = ["/*"] + [f"  {k}: {v}" for k, v in SECURITY_HEADERS.items()]
    lines += ["", "/static/*", "  Cache-Control: public, max-age=604800", ""]
    (DIST / "_headers").write_text("\n".join(lines))

    # RFC 9116 security.txt (Expires must be under a year away; refreshed on every build)
    wk = DIST / ".well-known"
    wk.mkdir()
    expires = (date.today() + timedelta(days=330)).isoformat() + "T00:00:00Z"
    (wk / "security.txt").write_text(
        f"Contact: {SITE_URL}/contact\n"
        "Policy: https://github.com/mshshuvo/mshshuvo.com/blob/main/SECURITY.md\n"
        f"Expires: {expires}\n"
        "Preferred-Languages: en\n"
        f"Canonical: {SITE_URL}/.well-known/security.txt\n")

    (DIST / "insights").mkdir(exist_ok=True)
    (DIST / "insights" / "feed.xml").write_text(rss_feed(), encoding="utf-8")

    (DIST / f"{INDEXNOW_KEY}.txt").write_text(INDEXNOW_KEY)

    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE_URL}/sitemap.xml\n")
    lastmod = {f"/insights/{p['slug']}": p["date"].isoformat() for p in POSTS}
    urls = "\n".join(
        f"  <url><loc>{SITE_URL}{'' if r == '/' else r}</loc>"
        + (f"<lastmod>{lastmod[r]}</lastmod>" if r in lastmod else "") + "</url>" for r in PAGES)
    (DIST / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}\n</urlset>\n')

    print(f"Built {len(PAGES) + 1} pages into {DIST}")


if __name__ == "__main__":
    main()
