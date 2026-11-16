## What and why


## Security checklist ([full list](../SECURITY-CHECKLIST.md))
- [ ] Data flow: I know what this receives, where it goes and how long it's kept; the site security page is still true
- [ ] Input: untrusted values are escaped (`TK.html` / `esc`), clamped and size-limited; endpoints fail closed
- [ ] CSP: no inline scripts or styles, no new third-party hosts
- [ ] Dependencies and secrets: nothing new without a reason; no secrets committed
- [ ] Abuse: can't be triggered cross-site or made to do unbounded work
- [ ] Monitoring: new pages/endpoints added to the security monitor's `config/target.yml`
