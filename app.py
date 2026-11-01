"""mshshuvo.com — personal site for Md Sabbir Hossain (Ethan).

Flask is used to *build* the site: `python build.py` renders every page to
static HTML in dist/, which Cloudflare Pages serves. `python app.py` runs a
local preview with the same security headers.

All interactivity runs in the browser from static/js/site.js. The only
server-side code is the Cloudflare Worker in worker/ (contact form).
"""
import hashlib
import json
from datetime import datetime
from functools import lru_cache
from pathlib import Path

from flask import Flask, abort, render_template
from markupsafe import Markup

from content import (ARTICLES, CERTIFICATIONS, EARLY_WRITING, EDUCATION, EXPERIENCE, POLICIES, PRESS,
                     PROJECT_TAGS, PROJECTS, RECOMMENDATIONS, SERVICE, SERVICES, SITE)
from assessments import ASSESSMENTS, BANDS
from assessments import BY_SLUG as ASSESSMENTS_BY_SLUG
from insights import all_tags, load_posts

PROJECTS_BY_SLUG = {p["slug"]: p for p in PROJECTS}
SERVICES_BY_SLUG = {s["slug"]: s for s in SERVICES}
SITE_URL = "https://mshshuvo.com"
POSTS = load_posts()
POSTS_BY_SLUG = {p["slug"]: p for p in POSTS}

# Cloudflare Turnstile (contact form bot check) loads a script and an iframe from here.
TURNSTILE_ORIGIN = "https://challenges.cloudflare.com"

CSP = (
    f"default-src 'self'; script-src 'self' {TURNSTILE_ORIGIN}; frame-src {TURNSTILE_ORIGIN}; "
    "style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; "
    "form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; "
    "upgrade-insecure-requests"
)

SECURITY_HEADERS = {
    "Content-Security-Policy": CSP,
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
}

app = Flask(__name__)


@app.after_request
def security_headers(resp):
    for k, v in SECURITY_HEADERS.items():
        if k != "Strict-Transport-Security":  # local preview is plain http
            resp.headers[k] = v
    return resp


@lru_cache(maxsize=None)
def asset(filename: str) -> str:
    """Static URL with a content hash, so browsers fetch new CSS/JS after each deploy
    even though /static/* is cached for a week."""
    digest = hashlib.sha256((Path(app.static_folder) / filename).read_bytes()).hexdigest()[:10]
    return f"/static/{filename}?v={digest}"


@app.template_filter("ldjson")
def ldjson(data) -> Markup:
    """Serialise schema.org data for a <script type="application/ld+json"> block.
    '<', '>' and '&' are escaped so text can never close the script element."""
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    text = text.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    # Escaped above; a JSON data block is never executed.
    return Markup(text)  # nosec B704


def person_ld() -> dict:
    return {
        "@type": "Person", "@id": f"{SITE_URL}/#person", "name": SITE["name"],
        "alternateName": ["Sabbir Hossain", "mshshuvo"],
        "jobTitle": "Cybersecurity Leader, GRC & AI Governance", "url": f"{SITE_URL}/",
        "address": {"@type": "PostalAddress", "addressLocality": "Ottawa", "addressRegion": "ON", "addressCountry": "CA"},
        "sameAs": [SITE["linkedin"], SITE["github"], "https://medium.com/@mshshuvo"],
        "alumniOf": {"@type": "CollegeOrUniversity", "name": "University of Ottawa"},
        "knowsAbout": ["Cybersecurity", "Governance, risk and compliance (GRC)", "ISO/IEC 27001", "ISO/IEC 42001",
                       "AI governance", "NIST Cybersecurity Framework", "Incident response", "CIRT and SOC design",
                       "Penetration testing", "Digital forensics", "Cyber risk assessment", "AML/KYC"],
        "hasCredential": [{"@type": "EducationalOccupationalCredential", "name": c}
                          for c in ["EC-Council Certified CISO (C|CISO)", "ISO/IEC 27001 Senior Lead Auditor",
                                    "ISO/IEC 42001 AI Lead Auditor", "ISO/IEC 27701 Lead Auditor",
                                    "Certified Ethical Hacker (CEH)"]],
    }


def service_ld(svc: dict) -> dict:
    return {"@type": "Service", "@id": f"{SITE_URL}/services/{svc['slug']}#service", "name": svc["seo_title"],
            "serviceType": svc["name"], "description": svc["meta"], "url": f"{SITE_URL}/services/{svc['slug']}",
            "provider": {"@id": f"{SITE_URL}/#person"}, "areaServed": ["Canada", "Bangladesh"]}


@app.template_filter("service_ld_offer")
def service_ld_offer(svc: dict) -> dict:
    return {"@type": "Offer", "itemOffered": service_ld(svc)}


@app.template_filter("insight_url")
def insight_url(slug: str) -> dict:
    return {"@type": "BlogPosting", "url": f"{SITE_URL}/insights/{slug}"}


def breadcrumb_ld(*crumbs) -> dict:
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i, "name": name, "item": f"{SITE_URL}{path}"}
        for i, (name, path) in enumerate(crumbs, 1)]}


@app.context_processor
def inject_site():
    return {"site": SITE, "year": datetime.now().year, "turnstile_origin": TURNSTILE_ORIGIN, "asset": asset,
            "site_url": SITE_URL, "person_ld": person_ld, "breadcrumb_ld": breadcrumb_ld,
            "service_ld": service_ld}


@app.get("/")
def home():
    return render_template("home.html",
                           projects=[p for p in PROJECTS if p.get("featured")],
                           recs=[r for r in RECOMMENDATIONS if r.get("featured")],
                           certs=CERTIFICATIONS, posts=POSTS[:3])


@app.get("/projects")
def projects():
    return render_template("projects.html", projects=PROJECTS, tags=PROJECT_TAGS)


@app.get("/projects/<slug>")
def project_detail(slug):
    p = PROJECTS_BY_SLUG.get(slug) or abort(404)
    nxt = PROJECTS[(PROJECTS.index(p) + 1) % len(PROJECTS)]
    return render_template("project.html", p=p, nxt=nxt)


@app.get("/publications")
def publications():
    return render_template("publications.html", policies=POLICIES, articles=ARTICLES,
                           early=EARLY_WRITING, press=PRESS)


@app.get("/insights")
def insights():
    return render_template("insights.html", posts=POSTS, tags=all_tags(POSTS))


@app.get("/insights/follow")
def subscribe():
    return render_template("subscribe.html")


@app.get("/insights/<slug>")
def insight_detail(slug):
    post = POSTS_BY_SLUG.get(slug) or abort(404)
    i = POSTS.index(post)
    newer = POSTS[i - 1] if i > 0 else None
    older = POSTS[i + 1] if i + 1 < len(POSTS) else None
    services = [s for s in SERVICES if set(s["insight_tags"]) & set(post["tags"])][:2]
    return render_template("insight.html", post=post, newer=newer, older=older, services=services)


@app.get("/recommendations")
def recommendations():
    return render_template("recommendations.html", recs=RECOMMENDATIONS)


@app.get("/experience")
def experience():
    return render_template("experience.html", items=EXPERIENCE, certs=CERTIFICATIONS,
                           education=EDUCATION, service=SERVICE)


@app.get("/services")
def services():
    return render_template("services.html", services=SERVICES)


@app.get("/services/<slug>")
def service_detail(slug):
    svc = SERVICES_BY_SLUG.get(slug) or abort(404)
    projects = [PROJECTS_BY_SLUG[p] for p in svc["projects"]]
    posts = [p for p in POSTS if set(p["tags"]) & set(svc["insight_tags"])][:3]
    others = [s for s in SERVICES if s is not svc]
    check = next((a for a in ASSESSMENTS if a["service"] == slug), None)
    return render_template("service.html", s=svc, projects=projects, posts=posts, others=others, check=check)


@app.get("/assessment")
def assessment():
    return render_template("assessment.html", checks=ASSESSMENTS)


@app.get("/assessment/<slug>")
def assessment_check(slug):
    check = ASSESSMENTS_BY_SLUG.get(slug) or abort(404)
    others = [a for a in ASSESSMENTS if a is not check]
    service = SERVICES_BY_SLUG.get(check["service"])
    return render_template("assessment_check.html", check=check, bands=BANDS, others=others, service=service)


@app.get("/contact")
def contact():
    return render_template("contact.html")


@app.errorhandler(404)
def not_found(_):
    return render_template("404.html"), 404


if __name__ == "__main__":
    import os
    # Local preview only; debug mode is opt-in and the server binds to localhost.
    app.run(host="127.0.0.1", port=5000, debug=os.environ.get("FLASK_DEBUG") == "1")
