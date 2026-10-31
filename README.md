# mshshuvo.com

Personal site of Md Sabbir Hossain. Python (Flask + Jinja) builds a fully static
site that Cloudflare Pages serves for free: no server, nothing sleeps.

## Edit content

All text lives in `content.py`: profile, projects, publications, recommendations,
experience, certifications and services. Push to `main` and Cloudflare rebuilds.

## Run locally

```bash
pip install -r requirements.txt
python app.py        # live preview at http://127.0.0.1:5000
python build.py      # writes the static site to dist/
```

## Deploy (Cloudflare Pages)

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `pip install -r requirements.txt && python build.py` |
| Build output directory | `dist` |
| Environment variable | `PYTHON_VERSION` = `3.12` |

Custom domain: Pages project → Custom domains → add `mshshuvo.com` and `www.mshshuvo.com`.

## Contact form

Set `SITE["form_key"]` in `content.py` to a free Web3Forms access key
(web3forms.com) and messages are emailed to you. Left empty, the contact page
shows email buttons instead.

## Security

- Strict Content-Security-Policy (`'self'` plus the form endpoint), HSTS,
  `nosniff`, `X-Frame-Options: DENY`, Referrer- and Permissions-Policy,
  set in `dist/_headers` by `build.py` from `SECURITY_HEADERS` in `app.py`
- No third-party scripts, fonts or trackers; everything is self-hosted
- No inline scripts or styles
