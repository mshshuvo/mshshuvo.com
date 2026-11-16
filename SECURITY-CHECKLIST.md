# Security checklist for every change

Every new page, tool, endpoint or script on mshshuvo.com passes this list before it is merged.
The pull request template repeats it, so nothing ships on habit alone. Items marked **(CI)** are
enforced automatically; the rest need a reviewer's tick.

## 1. Data flow and privacy
- [ ] I can say what data the feature receives, where it goes and how long it is kept.
- [ ] Nothing leaves the visitor's browser unless the feature exists to send it (contact form, counters).
- [ ] No personal data (IP address, email, identifiers) is stored unless it is essential, and none is logged.
- [ ] The "How this site protects you" page (`templates/site_security.html`) is still true; update it if not.

## 2. Input handling
- [ ] Every value from a visitor, a file, a URL or storage is treated as untrusted.
- [ ] Browser markup is built only with `TK.html\`...\`` or `esc()`; never by joining strings. **(CI: eslint no-unsanitized)**
- [ ] No `eval`, `new Function`, string `setTimeout` or `javascript:` URLs. **(CI: eslint, tests)**
- [ ] Numbers are clamped to sensible ranges and text is length-limited before use.
- [ ] File uploads have a size limit; CSV exports neutralise spreadsheet formulas (`TK.toCSV`).
- [ ] Worker endpoints check method, Origin, Content-Type and body size before doing anything, and fail closed.

## 3. Browser security policy
- [ ] No inline scripts, inline styles or `style=` attributes; no new third-party script, style, font or image hosts.
      **(CI: tests/test_toolkit.py, ZAP)**
- [ ] If the CSP really must change, the change is reviewed on its own and the reason is written in the PR.
- [ ] Downloadable files carry their own hash-pinned CSP with `connect-src 'none'`. **(CI: tests/test_toolkit.py)**

## 4. Dependencies and secrets
- [ ] No new runtime dependency in the Worker or the browser without a reason in the PR.
- [ ] New dev dependencies are pinned to an exact version at least two weeks old. **(CI: npm audit, pip-audit, Trivy)**
- [ ] No secrets, tokens or keys in code, fixtures or commit history. **(CI: Gitleaks, Trivy secrets)**

## 5. Abuse and availability
- [ ] Anything that writes data or sends email cannot be triggered from another site and is covered by the
      Cloudflare rate-limit rule, or has its own limit.
- [ ] A visitor can't make the feature do unbounded work (huge inputs, loops, storage growth).

## 6. Monitoring
- [ ] New public pages and endpoints are added to `config/target.yml` in the private security-monitor repo,
      with endpoints listed under `protected_endpoints` so they are only probed safely.
- [ ] After deploy, the next daily scan report is checked for new findings.
