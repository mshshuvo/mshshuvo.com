# mshshuvo.com

Personal site for Md Sabbir Hossain: Flask + HTMX, hand-written CSS, no external CDNs.

## Run locally

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py            # http://127.0.0.1:5000
```

## Edit content

All text (bio, experience, services, quiz questions) lives in `content.py`.
Search for `TODO` to find the details only you can fill in.

## Pages and interactive features

| Route | What it does |
|---|---|
| `/` | Hero with animated risk heat map, services preview, recruiter / client split |
| `/experience` | Timeline; each role expands in place via HTMX |
| `/services` | Six services with outcomes |
| `/assessment` | ISO 27001 readiness check; scores live as you answer, nothing stored |
| `/contact` | HTMX form with validation, honeypot and per-IP rate limit |

Contact messages are appended to `data/messages.jsonl`. On Render's free tier the
disk resets on each deploy, so before launch we should wire this to email
(e.g. Resend or Postmark) — see "Next steps".

## Security

- Strict Content-Security-Policy (`'self'` only); htmx and fonts are self-hosted
- HSTS (on HTTPS), `nosniff`, `frame-ancestors 'none'`, Referrer- and Permissions-Policy
- No inline scripts or styles; htmx `allowEval` disabled
- Honeypot + rate limiting on the contact form

## Deploy (Render)

1. Push this folder to a GitHub repo.
2. In Render: **New → Blueprint**, pick the repo (it reads `render.yaml`).
3. Settings → Custom Domains → add `mshshuvo.com` and `www.mshshuvo.com`.
4. At your registrar, set the DNS records Render shows (A record for the apex,
   CNAME for `www`), and delete old records pointing at the previous host.
5. Render issues the HTTPS certificate automatically.

## Next steps

- Fill in the TODOs in `content.py` (LinkedIn URL, earlier roles, email)
- Send contact messages to your inbox instead of a file
- Add an Insights/blog section for your LinkedIn posts
- Add a headshot and a downloadable resume
