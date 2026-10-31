# Security controls: mshshuvo.com

**Constraint:** zero cost. Only free tiers and open-source tools are used. Nothing below has a
recurring fee. Anything that would need a paid plan is listed as *not implemented* with the reason,
and will only be added after the owner approves the cost.

## Architecture (why many origin controls do not apply)

```
Visitor ──HTTPS──▶ Cloudflare edge (DNS, TLS, DDoS, WAF, Bot Fight Mode)
                     ├─ static pages from Workers Static Assets (HTML/CSS/JS/fonts)
                     └─ Worker: POST /api/contact only
                          ├─ Turnstile siteverify
                          └─ Email Routing ──▶ owner's verified Gmail
```

There is **no origin server, no VM, no container, no database and no Python running in production**.
Python (Flask) only *builds* static HTML in CI. The only runtime code is a ~150-line Worker that
handles the contact form inside Cloudflare's isolated Workers runtime. Removing the origin removes
the largest attack surface entirely, which is stronger than hardening one.

## Control matrix

Status: **Done** = in this repo · **Dashboard** = one-time setting in Cloudflare/GitHub (see
`docs/CLOUDFLARE-SETUP.md`) · **N/A** = eliminated by design · **Not implemented** = needs a paid plan.

### External protection

| # | Requirement | Status | How |
|---|---|---|---|
| 1 | Cloudflare Free as CDN / reverse proxy | Dashboard | Zone on Cloudflare Free; site served from Cloudflare's network via Workers custom domain (always proxied). |
| 2 | Automatic DDoS protection | Dashboard (automatic) | Unmetered L3/4 and HTTP DDoS mitigation is on by default on every plan. Verify the HTTP DDoS managed ruleset is enabled. |
| 3 | Free WAF managed rules | Dashboard | Security → WAF → Managed rules → *Cloudflare Free Managed Ruleset* on. Plus **1 free rate-limiting rule** on `/api/contact`. |
| 4 | Bot Fight Mode | Dashboard | Security → Bots → Bot Fight Mode on. |
| 5 | Turnstile on contact form | **Done** + Dashboard | Widget on `/contact`; the Worker verifies every token server-side with `siteverify` and fails closed. Create the free widget to get the keys. |
| 6 | DNSSEC | Dashboard | DNS → Settings → Enable DNSSEC, then add the DS record at Namecheap. |
| 7 | Strict HTTPS / secure TLS | **Done** + Dashboard | HSTS (2 years, includeSubDomains) sent by the site. Dashboard: Always Use HTTPS, Minimum TLS 1.2, TLS 1.3 on, Automatic HTTPS Rewrites on. SSL mode *Full (strict)* (no origin exists, so nothing is ever sent unencrypted). |

### Origin security

| # | Requirement | Status | Notes |
|---|---|---|---|
| 1 | Restrict origin to Cloudflare IPs | N/A | No origin server. The Worker runs inside Cloudflare. |
| 2 | Disable direct public origin access | **Done** (after go-live) | The only non-Cloudflare-domain entry point is the default `*.workers.dev` URL. Set `"workers_dev": false` in `wrangler.jsonc` once the custom domain works; preview URLs are already off. |
| 3 | Host firewall | N/A | No host. Edge filtering is the WAF + rate-limit rule. |
| 4 | Python as non-root | N/A in production | No Python runs in production. In CI, Python runs as the unprivileged GitHub runner user with a read-only token. |
| 5 | Disable unnecessary services / ports | N/A | No host. Cloudflare only exposes 80 (redirected) and 443. |
| 6 | Private database access | N/A | No database. Contact messages are emailed, not stored. |
| 7 | Secrets and environment files | **Done** | `TURNSTILE_SECRET` stored as an encrypted Worker secret (`wrangler secret put`); `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub Actions secrets in a `production` environment, exposed only to the deploy job. `.env*`, `.dev.vars`, keys are git-ignored; Gitleaks scans full history on every push. The API token is scoped to *Workers Scripts: Edit* for one account only. |

### Application hardening (Done)

- Strict CSP: `'self'` plus Turnstile only; no inline scripts or styles, no third-party trackers or fonts.
- `X-Frame-Options: DENY` + `frame-ancestors 'none'`, `nosniff`, Referrer-Policy, Permissions-Policy, COOP.
- Contact API: POST-only, JSON-only, Origin allowlist (CSRF), 16 KB body limit, honeypot, Turnstile,
  input validation, CR/LF stripping on single-line fields (blocks email header injection), fails closed,
  `Cache-Control: no-store`, tightest CSP on API responses. Covered by 8 unit tests.
- Email can only be sent to the one verified address (`send_email.destination_address`), so the
  endpoint cannot be abused as an open mail relay.
- RFC 9116 `/.well-known/security.txt`, refreshed on every build.

### Python security testing and CI/CD (Done)

| Tool | What it checks | Where |
|---|---|---|
| Bandit | Python SAST | `ci.yml` → *Bandit + pip-audit* |
| pip-audit | Python dependency CVEs (`--strict`) | `ci.yml` |
| npm audit | Wrangler toolchain CVEs (high+) | `ci.yml` → *Worker unit tests* |
| Gitleaks | Secrets in full git history (pinned version, checksum-verified) | `ci.yml` → *Gitleaks* |
| Trivy | Vulnerabilities, secrets, misconfiguration (HIGH/CRITICAL fail) | `ci.yml` → *Trivy* |
| OWASP ZAP | DAST baseline on the built site before deploy; weekly against production | `ci.yml`, `monitor.yml` |
| CodeQL | Python + JavaScript SAST (security-extended) | `codeql.yml` |
| Dependabot | Weekly update PRs for pip, npm and Actions | `.github/dependabot.yml` |

**Deploy gate:** the `deploy` job runs only on `main` after *all* checks pass, rebuilds the same commit
and deploys with Wrangler. Pull requests run every check but never deploy.

**Supply chain:** every third-party action is pinned to a full commit SHA (not a tag). Trivy is pinned to
`trivy-action` v0.35.0, the release Aqua confirmed clean after the March 2026 tag-compromise incident.
Scan jobs run with a read-only token and no secrets; only the deploy job can read Cloudflare secrets.

### Monitoring (Done, free)

| What | How | Alert |
|---|---|---|
| Uptime, HTTPS redirect, all security headers, TLS expiry, security.txt expiry, API abuse checks | `tools/monitor.py`, hourly via `monitor.yml` | GitHub issue (emailed to owner), auto-closed on recovery |
| Weekly DAST of production | OWASP ZAP baseline | GitHub issue with findings |
| Application errors and suspicious activity | Worker writes structured JSON logs (`contact_turnstile_failed`, `contact_rejected_origin`, `contact_honeypot`, `contact_send_failed`, `not_found`) to **Workers Logs** | Review in dashboard; spikes visible in Workers analytics |
| Edge attacks | Cloudflare Security → Events (WAF, bot and rate-limit actions) | Dashboard; free Notifications where offered |
| Dependency and code alerts | Dependabot alerts, CodeQL, GitHub secret scanning + push protection | GitHub email |

## Free-tier limitations (accepted)

- **Workers Free:** 100,000 Worker requests/day. Static asset requests do not count; only `/api/contact`
  and 404s invoke the Worker. Exceeding it returns errors until the daily reset (no charge).
- **Workers Logs on Free:** short retention (days, not months) and a daily event cap. Long-term retention
  would need Logpush (paid). GitHub issues and Actions logs (90 days) are the durable alert record.
- **WAF:** Free gets the *Cloudflare Free Managed Ruleset* only, not the full Cloudflare Managed Ruleset
  or OWASP Core Ruleset (Pro and above). One rate-limiting rule, with basic matching.
- **Bots:** Bot Fight Mode only; it cannot be tuned or bypassed per path. Super Bot Fight Mode is Pro+.
- **Security event alerting:** advanced security-event notifications are on paid plans; on Free, alerts
  come from the GitHub monitor and Cloudflare's free notification types.
- **Email Routing sending:** Worker email goes only to verified addresses (fine here: the owner's Gmail).
- **GitHub:** Actions, CodeQL, secret scanning and Dependabot are free because the repository is public.
  Making it private would limit CodeQL and secret scanning.

## Not implemented (would require a paid service; not enabled)

| Control | Requires | Approx. cost |
|---|---|---|
| Full Cloudflare Managed Ruleset + OWASP CRS | Cloudflare Pro | ~US$20–25/month |
| Super Bot Fight Mode (tunable, per-path) | Cloudflare Pro | as above |
| Long-term log retention / SIEM export (Logpush) | Cloudflare Enterprise or Workers Paid + storage | varies |
| Advanced rate limiting (multiple rules, complex keys) | Cloudflare Pro/Business | varies |
| Commercial DAST/SAST (Burp Enterprise, Snyk paid tiers) | Licences | varies |

None of these are active, and none will be added without explicit approval.
