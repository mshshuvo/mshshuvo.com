"""Toolkit: free interactive tools that run entirely in the visitor's browser.

Each tool is three static pieces, so the site's strict Content Security Policy needs no exceptions:
    templates/toolkit/<slug>.html   plain HTML markup (no template logic)
    static/toolkit/<slug>.js        the tool's behaviour (plus optional data scripts listed under "scripts")
    static/toolkit/toolkit.css      shared styles (tk- prefix), with static/toolkit/tk-common.js

`standalone()` joins the same pieces into one self-contained HTML file that visitors can download
and open offline. That file makes no network requests.
"""
import base64
import hashlib
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
    {
        "slug": "audit-sampling",
        "name": "Audit Sampling Calculator",
        "title": "How many to test, and which ones.",
        "seo_title": "Free Audit Sampling Calculator for Control Testing",
        "short": "Size a control-test sample with exact attribute-sampling maths, draw a selection anyone can "
                 "re-perform, and see what your results let you conclude.",
        "lead": "Three steps: size the sample from the assurance you need, draw the items with a repeatable seed, "
                "then enter your results to see whether the control can be relied on.",
        "meta": "Free audit sampling calculator: attribute sample sizes at 90, 95 or 99% confidence, re-performable "
                "random selection with stratification, and an upper deviation limit. Runs in your browser.",
        "facts": ["Internal audit", "ITGC and SOX testing", "Attribute sampling", "Re-performable selection"],
        "privacy": "The population you load never leaves your browser, and nothing is sent to this site or anyone else.",
        "scripts": ["audit-sampling-data.js"],
    },
    {
        "slug": "control-crosswalk",
        "name": "Control Crosswalk Explorer",
        "title": "Test once, satisfy many.",
        "seo_title": "Free Control Crosswalk: ISO 27001, SOC 2, NIST CSF 2.0 and CIS Controls",
        "short": "See what one control proves across ISO 27001, SOC 2, NIST CSF 2.0 and CIS Controls, translate a "
                 "requirement between frameworks, and test what breaks when evidence fails.",
        "lead": "A worked crosswalk for a fictional payments company: 41 common controls mapped to four frameworks. "
                "Explore coverage, translate requirements, and see the blast radius of a failed test.",
        "meta": "Free interactive control crosswalk across ISO/IEC 27001:2022, SOC 2, NIST CSF 2.0 and CIS Controls "
                "v8.1. See coverage, map requirements between frameworks and test what-if failures.",
        "facts": ["ISO/IEC 27001:2022", "SOC 2", "NIST CSF 2.0", "CIS Controls v8.1"],
        "privacy": "It uses built-in sample data and sends nothing to this site or anyone else.",
        "scripts": ["control-crosswalk-data.js"],
    },
    {
        "slug": "access-review",
        "name": "Access Review & SoD Analyzer",
        "title": "Who still has access, and who has too much.",
        "seo_title": "Free User Access Review & Segregation of Duties (SoD) Analyzer",
        "short": "Match system access exports to your staff list. Find leavers who can still sign in, accounts "
                 "nobody owns, unused and admin access, and segregation-of-duties conflicts across systems.",
        "lead": "Load your staff list and access exports. In seconds you see who has left but can still sign in, "
                "accounts nobody owns, unused and admin access, and people who can do both halves of a task that "
                "should be split. Record decisions and export the evidence.",
        "meta": "Free user access review and segregation of duties analyzer: leavers with active accounts, orphaned "
                "and dormant accounts, privileged access and SoD conflicts across systems. Runs in your browser; "
                "your files never leave your device.",
        "facts": ["User access reviews", "Segregation of duties", "ITGC and SOX", "Files stay on your device"],
        "privacy": "Your files are read in your browser and held in memory only; nothing is uploaded. Review "
                   "decisions are saved on this device so you can pick up where you left off.",
        "scripts": ["access-review-data.js"],
    },
    {
        "slug": "email-header-analyzer",
        "name": "Phishing Email Header Analyzer",
        "title": "Is this email really from who it says?",
        "seo_title": "Free Phishing Email Header Analyzer: SPF, DKIM, DMARC Checker",
        "short": "Paste a suspicious email's headers and see, in plain English, who really sent it, whether it "
                 "passed SPF, DKIM and DMARC, and the red flags that point to phishing.",
        "lead": "Paste the headers of a suspicious email. You get a plain-English verdict, the SPF, DKIM and DMARC "
                "results, look-alike domains, mismatched reply addresses and the route it took, ready to send to IT.",
        "meta": "Free phishing email header analyzer: SPF, DKIM and DMARC results, look-alike domains and Reply-To "
                "tricks in plain English. Runs in your browser.",
        "facts": ["Phishing triage", "SPF, DKIM and DMARC", "Look-alike domains", "Nothing is uploaded"],
        "privacy": "The headers you paste are analysed in your browser and never sent or saved. Only your "
                   "organisation's domain, if you enter one, is remembered on this device.",
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


def script_files(tool: dict) -> list[str]:
    """Scripts a tool needs, in load order: shared helpers, any data files, then the tool itself."""
    return ["tk-common.js", *tool.get("scripts", []), f"{tool['slug']}.js"]


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
    scripts = [(static / name).read_text(encoding="utf-8") for name in script_files(tool)]
    for text in scripts:
        if "</script" in text.lower():
            raise ValueError(f"{slug}: script text would close its own script element")
    name, author = escape(tool["name"]), escape(SITE["name"])
    style_body = f"\n{css}\n"
    script_bodies = [f"\n{text}\n" for text in scripts]
    return (
        "<!doctype html>\n"
        f"<!-- {name}. Built by {author}, {SITE_URL}/toolkit. {LICENCE} -->\n"
        '<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        f'<meta http-equiv="Content-Security-Policy" content="{offline_csp(style_body, script_bodies)}">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        f"<title>{name}</title>\n"
        f'<meta name="author" content="{author}, {SITE_URL}">\n'
        f"<style>{style_body}</style>\n</head>\n<body>\n"
        f'<header class="page-head"><div class="sa-wrap"><h1>{name}</h1><p>{escape(tool["lead"])}</p></div></header>\n'
        f'<main class="sa-wrap">\n{fragment(slug)}\n{credit_html()}\n</main>\n'
        + "".join(f"<script>{body}</script>\n" for body in script_bodies)
        + "</body>\n</html>\n")


def _sha256(text: str) -> str:
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode("utf-8")).digest()).decode() + "'"


def offline_csp(style_body: str, script_bodies: list[str]) -> str:
    """Policy for the downloaded file: only its own inline style and scripts (pinned by hash) may run, and it
    can make no network connection at all, so it provably cannot send anything anywhere."""
    return "; ".join([
        "default-src 'none'",
        "script-src " + " ".join(_sha256(b) for b in script_bodies),
        "style-src " + _sha256(style_body),
        "img-src data:",
        "connect-src 'none'",
        "form-action 'none'",
        "base-uri 'none'",
    ])
