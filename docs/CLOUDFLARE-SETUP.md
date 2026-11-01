# Cloudflare + GitHub setup checklist (all free)

Do these once. Nothing here asks for a payment method. If any screen asks you to upgrade or add a
card, stop: that feature is not part of this setup.

## 1. Add the domain to Cloudflare (Free plan)

1. dash.cloudflare.com → **Add a domain** → `mshshuvo.com` → choose **Free**.
2. Cloudflare imports your DNS records. Delete leftover A/AAAA/CNAME records from the old host.
3. Namecheap → Domain List → Manage → **Nameservers: Custom DNS** → enter the two Cloudflare nameservers.
4. Wait for Cloudflare to show the domain as **Active** (minutes to a few hours).

## 2. DNSSEC

1. Cloudflare → DNS → Settings → **Enable DNSSEC**. Copy the DS record details.
2. Namecheap → Manage → **Advanced DNS → DNSSEC** → add the DS record (Key Tag, Algorithm, Digest Type, Digest).

## 3. SSL/TLS

- SSL/TLS → Overview: **Full (strict)**
- SSL/TLS → Edge Certificates: **Always Use HTTPS** on, **Minimum TLS Version 1.2**, **TLS 1.3** on,
  **Automatic HTTPS Rewrites** on. (HSTS is already sent by the site itself.)

## 4. Security

- Security → **WAF → Managed rules**: turn on the *Cloudflare Free Managed Ruleset*.
- Security → **WAF → Rate limiting rules** (1 free rule): *If URI Path equals `/api/contact`*,
  then **Block** when one IP exceeds about 5 requests per 10 seconds.
- Security → **Bots**: **Bot Fight Mode** on.
- DDoS protection is automatic. Check Security → DDoS shows the HTTP DDoS ruleset enabled.

## 5. Email Routing (delivers contact-form messages)

1. Email → **Email Routing** → enable it. Cloudflare adds the needed MX/TXT records.
2. Add your Gmail address as a destination address and click the verification link in Gmail.
   Then add it to the Worker as a **Secret** named `CONTACT_TO` (Worker → Settings → Variables and Secrets).
   It is kept out of the public repo and never shown on the site.
3. Optional: route `hello@mshshuvo.com` to your Gmail as a public address.

## 6. Turnstile

1. Turnstile → **Add widget** → name `mshshuvo.com`, hostname `mshshuvo.com`, mode **Managed**.
2. Put the **Site key** (public) in `content.py` → `SITE["turnstile_sitekey"]`.
3. Keep the **Secret key** for step 8. Never commit it.

## 7. API token for GitHub deploys

My Profile → API Tokens → **Create token** → template **Edit Cloudflare Workers** → restrict to your
account and the `mshshuvo.com` zone → create. Copy the token and your **Account ID**.

## 8. Secrets

- GitHub repo → Settings → **Environments** → New environment `production` → add secrets
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- Turnstile secret, from your computer once: `npx wrangler secret put TURNSTILE_SECRET`
  (or Cloudflare → Workers → mshshuvo → Settings → Variables and Secrets → add as **Secret**).

## 9. Custom domain

Workers & Pages → **mshshuvo** → Settings → **Domains & Routes** → add `mshshuvo.com` and `www.mshshuvo.com`.
Then set `"workers_dev": false` in `wrangler.jsonc` so the site is only reachable through your domain.

## 10. GitHub security features (free on public repos)

Settings → **Code security**: enable Dependabot alerts, Dependabot security updates, secret scanning
and **push protection**. Settings → Branches → protect `main`: require the CI checks to pass.
Settings → Variables → Actions → add variable `SITE_URL` = `https://mshshuvo.com` to switch on monitoring.
