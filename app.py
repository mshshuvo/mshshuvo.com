"""mshshuvo.com — personal site for Md Sabbir Hossain (Ethan).

Flask + HTMX. No external CDNs: scripts and fonts are self-hosted so the
Content-Security-Policy can stay strict ('self' only).
"""
import json
import os
import re
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, abort, render_template, request

from content import (ARTICLES, CERTIFICATIONS, EARLY_WRITING, EDUCATION, EXPERIENCE, POLICIES, PRESS,
                     PROJECT_TAGS, PROJECTS, QUIZ, RECOMMENDATIONS, SERVICE, SERVICES, SITE)

PROJECTS_BY_SLUG = {p["slug"]: p for p in PROJECTS}

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-only-change-me")
MESSAGES_FILE = Path(os.environ.get("MESSAGES_FILE", "data/messages.jsonl"))


# ---------------------------------------------------------------- security
@app.after_request
def security_headers(resp):
    resp.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self'; style-src 'self'; "
        "img-src 'self' data:; font-src 'self'; connect-src 'self'; "
        "form-action 'self'; frame-ancestors 'none'; base-uri 'self'; "
        "object-src 'none'"
    )
    resp.vary.add("HX-Request")
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    resp.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    resp.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    if request.is_secure or request.headers.get("X-Forwarded-Proto") == "https":
        resp.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return resp


# Simple per-IP rate limit for form posts (in-memory; fine for one instance).
_hits: dict[str, deque] = defaultdict(deque)


def rate_limited(limit=5, window=600) -> bool:
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "?").split(",")[0]
    q, now = _hits[ip], time.time()
    while q and now - q[0] > window:
        q.popleft()
    if len(q) >= limit:
        return True
    q.append(now)
    return False


@app.context_processor
def inject_site():
    return {"site": SITE, "year": datetime.now().year}


# ---------------------------------------------------------------- pages
@app.get("/")
def home():
    return render_template("home.html",
                           projects=[p for p in PROJECTS if p.get("featured")],
                           recs=[r for r in RECOMMENDATIONS if r.get("featured")],
                           certs=CERTIFICATIONS)


@app.get("/projects")
def projects():
    """Full page, or just the card grid when HTMX asks for a filtered view."""
    tag = request.args.get("tag", "")
    items = [p for p in PROJECTS if not tag or tag in p["tags"]]
    if request.headers.get("HX-Request"):
        return render_template("partials/project_grid.html", projects=items, tag=tag)
    return render_template("projects.html", projects=items, tags=PROJECT_TAGS, tag=tag)


@app.get("/projects/<slug>")
def project_detail(slug):
    p = PROJECTS_BY_SLUG.get(slug) or abort(404)
    i = PROJECTS.index(p)
    nxt = PROJECTS[(i + 1) % len(PROJECTS)]
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


@app.get("/experience/<int:idx>")
def experience_detail(idx):
    """HTMX: expand one timeline entry."""
    if not 0 <= idx < len(EXPERIENCE):
        abort(404)
    return render_template("partials/exp_detail.html", item=EXPERIENCE[idx], idx=idx)


@app.get("/services")
def services():
    return render_template("services.html", services=SERVICES)


@app.get("/assessment")
def assessment():
    return render_template("assessment.html", quiz=QUIZ)


@app.post("/assessment/score")
def assessment_score():
    """HTMX: score the ISO 27001 readiness check and return the result card."""
    total, earned, gaps = 0, 0, []
    answered = sum(1 for i in range(len(QUIZ)) if request.form.get(f"q{i}") in ("0", "1", "2"))
    for i, q in enumerate(QUIZ):
        val = request.form.get(f"q{i}", "0")
        pts = {"2": 2, "1": 1}.get(val, 0)
        earned += pts
        total += 2
        if pts < 2:
            gaps.append(q)
    pct = round(100 * earned / total)
    if pct >= 80:
        band = ("Audit-ready", "good", "You're in strong shape. A pre-certification internal audit would confirm it.")
    elif pct >= 50:
        band = ("Building", "mid", "Solid foundations, but auditors will find gaps. Prioritise the items below.")
    else:
        band = ("Early stage", "low", "Start with scope, risk assessment and leadership buy-in before anything else.")
    return render_template("partials/score.html", pct=pct, band=band, gaps=gaps[:4],
                           answered=answered, total_q=len(QUIZ))


@app.get("/contact")
def contact():
    return render_template("contact.html")


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@app.post("/contact")
def contact_post():
    f = request.form
    if f.get("website"):  # honeypot field; humans never see it
        return render_template("partials/contact_ok.html")
    errors = {}
    name, email, topic, msg = (f.get(k, "").strip() for k in ("name", "email", "topic", "message"))
    if not 2 <= len(name) <= 100:
        errors["name"] = "Please enter your name."
    if not EMAIL_RE.match(email) or len(email) > 200:
        errors["email"] = "Please enter a valid email."
    if not 10 <= len(msg) <= 4000:
        errors["message"] = "A few more words, please (10–4000 characters)."
    if errors:
        return render_template("partials/contact_form.html", errors=errors, form=f)
    if rate_limited():
        return render_template("partials/contact_form.html",
                               errors={"form": "Too many messages. Please try again later."}, form=f)
    MESSAGES_FILE.parent.mkdir(parents=True, exist_ok=True)
    with MESSAGES_FILE.open("a") as fh:
        fh.write(json.dumps({"at": datetime.now(timezone.utc).isoformat(), "name": name,
                             "email": email, "topic": topic, "message": msg}) + "\n")
    return render_template("partials/contact_ok.html", name=name)


@app.errorhandler(404)
def not_found(_):
    return render_template("404.html"), 404


if __name__ == "__main__":
    app.run(debug=True, port=5000)
