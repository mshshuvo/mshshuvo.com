"""mshshuvo.com — personal site for Md Sabbir Hossain (Ethan).

Flask is used to *build* the site: `python build.py` renders every page to
static HTML in dist/, which Cloudflare Pages serves. `python app.py` runs a
local preview with the same security headers.

All interactivity runs in the browser from static/js/site.js. The only
server-side code is the Cloudflare Worker in worker/ (contact form).
"""
from datetime import datetime

from flask import Flask, abort, render_template

from content import (ARTICLES, CERTIFICATIONS, EARLY_WRITING, EDUCATION, EXPERIENCE, POLICIES, PRESS,
                     PROJECT_TAGS, PROJECTS, QUIZ, RECOMMENDATIONS, SERVICE, SERVICES, SITE)

PROJECTS_BY_SLUG = {p["slug"]: p for p in PROJECTS}

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


@app.context_processor
def inject_site():
    return {"site": SITE, "year": datetime.now().year, "turnstile_origin": TURNSTILE_ORIGIN}


@app.get("/")
def home():
    return render_template("home.html",
                           projects=[p for p in PROJECTS if p.get("featured")],
                           recs=[r for r in RECOMMENDATIONS if r.get("featured")],
                           certs=CERTIFICATIONS)


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


@app.get("/assessment")
def assessment():
    return render_template("assessment.html", quiz=QUIZ)


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
