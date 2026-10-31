"""Render the whole site to static files in dist/ for Cloudflare Pages.

    python build.py            # writes dist/
    python -m http.server -d dist 8000   # quick local check (no security headers)

Each route is written as <path>.html; Cloudflare Pages serves /projects from
projects.html, so links need no extension.
"""
import shutil
from pathlib import Path

from app import PROJECTS, SECURITY_HEADERS, app

ROOT = Path(__file__).parent
DIST = ROOT / "dist"
SITE_URL = "https://mshshuvo.com"

PAGES = ["/", "/projects", "/experience", "/publications", "/recommendations",
         "/services", "/assessment", "/contact"] + [f"/projects/{p['slug']}" for p in PROJECTS]


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

    # Cloudflare Pages response headers
    lines = ["/*"] + [f"  {k}: {v}" for k, v in SECURITY_HEADERS.items()]
    lines += ["", "/static/*", "  Cache-Control: public, max-age=604800", ""]
    (DIST / "_headers").write_text("\n".join(lines))

    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE_URL}/sitemap.xml\n")
    urls = "\n".join(f"  <url><loc>{SITE_URL}{'' if r == '/' else r}</loc></url>" for r in PAGES)
    (DIST / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}\n</urlset>\n')

    print(f"Built {len(PAGES) + 1} pages into {DIST}")


if __name__ == "__main__":
    main()
