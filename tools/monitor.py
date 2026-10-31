"""Production health and security monitor (stdlib only; run by .github/workflows/monitor.yml).

Checks:
  - key pages return 200 over HTTPS
  - every security header is present with the expected value
  - HTTP redirects to HTTPS
  - TLS certificate has more than MIN_CERT_DAYS left
  - security.txt exists and its Expires date is more than 30 days away
  - the contact API rejects GET and cross-origin POSTs

Exit code 1 and a Markdown report on stdout when anything fails.

    python tools/monitor.py https://mshshuvo.com
"""
from __future__ import annotations

import json
import socket
import ssl
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
EXPECTED = json.loads((ROOT / "worker" / "site_headers.json").read_text())
PAGES = ["/", "/projects", "/experience", "/publications", "/contact"]
MIN_CERT_DAYS = 14
TIMEOUT = 20


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # noqa: D401 - urllib hook
        return None


def fetch(url: str, method: str = "GET", headers: dict | None = None, data: bytes | None = None,
          follow: bool = True):
    if not url.startswith(("https://", "http://")):
        raise ValueError("only http(s) URLs are monitored")
    req = urllib.request.Request(url, method=method, headers={"User-Agent": "mshshuvo-monitor/1.0", **(headers or {})},
                                 data=data)
    opener = urllib.request.build_opener() if follow else urllib.request.build_opener(NoRedirect)
    # Scheme is validated above, so B310 (arbitrary scheme) does not apply.
    try:
        with opener.open(req, timeout=TIMEOUT) as r:  # nosec B310
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()
    except (urllib.error.URLError, OSError):
        return 0, {}, b""  # unreachable: reported as a failed check


def cert_days_left(host: str) -> int:
    ctx = ssl.create_default_context()
    with socket.create_connection((host, 443), timeout=TIMEOUT) as sock:
        with ctx.wrap_socket(sock, server_hostname=host) as tls:
            not_after = tls.getpeercert()["notAfter"]
    expires = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
    return (expires - datetime.now(timezone.utc)).days


def main(base: str) -> int:
    base = base.rstrip("/")
    host = urlparse(base).hostname or ""
    failures: list[str] = []

    for path in PAGES:
        status, headers, _ = fetch(base + path)
        if status != 200:
            failures.append(f"`{path}` returned HTTP {status}")
            continue
        lower = {k.lower(): v for k, v in headers.items()}
        for name, value in EXPECTED.items():
            got = lower.get(name.lower())
            if got is None:
                failures.append(f"`{path}` is missing header `{name}`")
            elif got != value:
                failures.append(f"`{path}` header `{name}` changed: `{got}`")

    status, headers, _ = fetch("http://" + host + "/", follow=False)
    location = {k.lower(): v for k, v in headers.items()}.get("location", "")
    if status not in (301, 302, 307, 308) or not location.startswith("https://"):
        failures.append(f"HTTP is not redirected to HTTPS (status {status})")

    try:
        days = cert_days_left(host)
        if days < MIN_CERT_DAYS:
            failures.append(f"TLS certificate expires in {days} days")
    except (OSError, ssl.SSLError) as e:
        failures.append(f"TLS check failed: {e}")

    status, _, body = fetch(base + "/.well-known/security.txt")
    if status != 200:
        failures.append("security.txt is missing")
    else:
        for line in body.decode("utf-8", "replace").splitlines():
            if line.lower().startswith("expires:"):
                exp = datetime.fromisoformat(line.split(":", 1)[1].strip().replace("Z", "+00:00"))
                if (exp - datetime.now(timezone.utc)).days < 30:
                    failures.append("security.txt expires in under 30 days; redeploy to refresh it")

    status, _, _ = fetch(base + "/api/contact")
    if status != 405:
        failures.append(f"contact API accepted GET (HTTP {status})")
    status, _, _ = fetch(base + "/api/contact", method="POST", data=b"{}",
                         headers={"Origin": "https://evil.example", "Content-Type": "application/json"})
    if status not in (403, 429):
        failures.append(f"contact API did not block a cross-origin POST (HTTP {status})")

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    if failures:
        print(f"### Monitor failed at {stamp}\n\nTarget: {base}\n")
        print("\n".join(f"- {f}" for f in failures))
        return 1
    print(f"All checks passed for {base} at {stamp}.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "https://mshshuvo.com"))
