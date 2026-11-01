# mshshuvo.com

Personal site of Md Sabbir Hossain. Python (Flask + Jinja) builds a fully static site that runs on a
**Cloudflare Worker with static assets (Free plan)**: no server, nothing sleeps, no monthly cost.
A tiny Worker handles the contact form (Turnstile + Email Routing).

## Edit content

All text is in `content.py`. Push to `main`; CI runs every security check and deploys only if all pass.

## Publish an Insights article

1. Add a file to `posts/`, named like the URL you want: `posts/zero-trust-for-small-banks.md`
   becomes `mshshuvo.com/insights/zero-trust-for-small-banks` (lowercase words and hyphens only).
2. Start it with this header, then write the article in Markdown below it:

   ```markdown
   ---
   title: Zero Trust for Small Banks
   date: 2026-11-15
   tags: [Governance & Risk, Identity & Fraud]
   summary: One or two sentences shown on the list page, in RSS and in link previews.
   canonical_url: https://www.linkedin.com/pulse/...   # optional: if it also appeared on LinkedIn
   draft: true                                          # optional: hide until ready
   ---

   ## First heading

   Paragraphs, **bold**, *italics*, lists, > quotes, `code`, tables and [links](https://example.com).
   ```

3. Commit to `main` (GitHub's web editor works: *Add file → Create new file*). The build adds it to
   /insights, the homepage, the RSS feed and the sitemap, newest first.

**Images:** put them in `static/img/insights/` (lowercase-hyphen names; `.webp` preferred, keep them
under ~200 KB). Add a cover with `cover: zero-trust-for-small-banks-cover` and `cover_alt: what it shows`
in the header: it needs `<name>.webp`, plus `<name>.jpg` (about 1200 px wide) for LinkedIn link
previews. In the body use `![what it shows](/static/img/insights/my-diagram.webp)`.

Reuse existing tags where possible so the topic filter stays short. Images hosted elsewhere, embeds
and raw HTML such as scripts or iframes are stripped on purpose: every post is sanitised against an
allowlist, and the site only loads images from itself.

## Run locally

```bash
pip install -r requirements.txt
python app.py              # page preview at http://127.0.0.1:5000
python build.py            # static build into dist/
npm ci && npm test         # Worker unit tests
npx wrangler dev           # full site + contact API at http://127.0.0.1:8787
```

## Security

- How it is secured, free-tier limits, and what is deliberately not enabled: [docs/SECURITY-CONTROLS.md](docs/SECURITY-CONTROLS.md)
- One-time Cloudflare/GitHub setup: [docs/CLOUDFLARE-SETUP.md](docs/CLOUDFLARE-SETUP.md)
- Reporting a vulnerability: [SECURITY.md](SECURITY.md)

CI (`.github/workflows/ci.yml`): Bandit, pip-audit, Gitleaks, Trivy, npm audit, Worker unit tests,
OWASP ZAP baseline on the built site, then deploy. CodeQL and Dependabot run alongside.
Monitoring (`monitor.yml`): hourly health/header/TLS checks and a weekly ZAP scan of production,
alerting via GitHub issues.
