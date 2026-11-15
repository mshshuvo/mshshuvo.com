"""Toolkit: free interactive tools that run entirely in the visitor's browser.

Each tool is three static pieces, so the site's strict Content Security Policy needs no exceptions:
    templates/toolkit/<slug>.html   plain HTML markup (no template logic)
    static/toolkit/<slug>.js        the tool's behaviour
    static/toolkit/toolkit.css      shared styles (tk- prefix), with static/toolkit/tk-common.js

`standalone()` joins the same pieces into one self-contained HTML file that visitors can download
and open offline. That file makes no network requests.
"""
import re
from html import escape
from pathlib import Path

from content import SITE

ROOT = Path(__file__).parent
SITE_URL = "https://mshshuvo.com"
LICENCE = "Free to use and adapt, with attribution."

TOOLS = [
    {
        "slug": "cyber-risk-dashboard",
        "name": "Cyber Risk Register & Executive Dashboard",
        "title": "Cyber risk, on one page.",
        "seo_title": "Free Cyber Risk Register & Executive Dashboard",
        "short": "Turn a risk register into a one-page briefing: one sentence, four numbers, a heat map and the "
                 "decisions executives need to make.",
        "lead": "A risk register with a view built for executives: one sentence, four numbers, a heat map and the "
                "decisions that need making. Try it with the sample, then load your own risks.",
        "meta": "Free cyber risk register with an executive dashboard: heat map, top risks, decisions needed and "
                "trends. Runs in your browser, works offline, exports to CSV and PDF.",
        "facts": ["Risk management", "Board reporting", "5 × 5 heat map", "CSV in and out"],
        "privacy": "Your register never leaves your browser. It is saved on this device only, and nothing is sent "
                   "to this site or anyone else.",
    },
]
BY_SLUG = {t["slug"]: t for t in TOOLS}

_BASE_CSS = """
*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--color-background); color: var(--color-text); font: 400 16px/1.6 var(--font-body); }
a { color: var(--color-primary); }
h1, h2, h3 { font-family: var(--font-heading); color: var(--color-heading); line-height: 1.15; letter-spacing: -.02em; }
h1 { font-size: clamp(1.5rem, 4vw, 2.25rem); font-weight: 800; margin: 0 0 8px; }
:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; border-radius: 4px; }
.sa-wrap { width: min(1120px, 100% - 32px); margin-inline: auto; }
.page-head { padding: 32px 0 20px; }
.page-head p { margin: 0; color: var(--color-muted); max-width: 62ch; }
main.sa-wrap { padding-bottom: 48px; }
"""


def _tokens() -> str:
    """The site's design tokens, read from site.css so downloads always match the site."""
    css = (ROOT / "static" / "css" / "site.css").read_text(encoding="utf-8")
    block = re.search(r":root \{.*?\n\}", css, re.S)
    if not block:
        raise ValueError("design tokens not found in site.css")
    return block.group(0)


def fragment(slug: str) -> str:
    return (ROOT / "templates" / "toolkit" / f"{slug}.html").read_text(encoding="utf-8")


def credit_html() -> str:
    """Author credit shown under every tool, on the site and in downloaded copies."""
    return ('<footer class="tk-credit">'
            f'<span>Built by <b>{escape(SITE["name"])}</b></span>'
            f'<a href="{SITE_URL}/toolkit" rel="noopener">mshshuvo.com</a>'
            f'<a href="{escape(SITE["linkedin"])}" rel="noopener">LinkedIn</a>'
            f'<span>{LICENCE}</span></footer>')


def standalone(slug: str) -> str:
    """One self-contained HTML file for a tool: styles and scripts inlined, no network requests."""
    tool = BY_SLUG[slug]
    static = ROOT / "static" / "toolkit"
    css = _tokens() + _BASE_CSS + (static / "toolkit.css").read_text(encoding="utf-8")
    scripts = [(static / "tk-common.js").read_text(encoding="utf-8"), (static / f"{slug}.js").read_text(encoding="utf-8")]
    for text in scripts:
        if "</script" in text.lower():
            raise ValueError(f"{slug}: script text would close its own script element")
    name, author = escape(tool["name"]), escape(SITE["name"])
    return (
        "<!doctype html>\n"
        f"<!-- {name}. Built by {author}, {SITE_URL}/toolkit. {LICENCE} -->\n"
        '<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        f"<title>{name}</title>\n"
        f'<meta name="author" content="{author}, {SITE_URL}">\n'
        f"<style>\n{css}\n</style>\n</head>\n<body>\n"
        f'<header class="page-head"><div class="sa-wrap"><h1>{name}</h1><p>{escape(tool["lead"])}</p></div></header>\n'
        f'<main class="sa-wrap">\n{fragment(slug)}\n{credit_html()}\n</main>\n'
        + "".join(f"<script>\n{text}\n</script>\n" for text in scripts)
        + "</body>\n</html>\n")
