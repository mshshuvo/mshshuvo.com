# mshshuvo.com

Personal site of Md Sabbir Hossain. Python (Flask + Jinja) builds a fully static site that runs on a
**Cloudflare Worker with static assets (Free plan)**: no server, nothing sleeps, no monthly cost.
A tiny Worker handles the contact form (Turnstile + Email Routing).

## Edit content

All text is in `content.py`. Push to `main`; CI runs every security check and deploys only if all pass.

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
