"""Serve dist/ like Cloudflare does (extensionless .html, _headers, 404 page) for local tests and ZAP.

    python tools/serve_dist.py dist   # http://127.0.0.1:8000
"""
import http.server, os, sys
from pathlib import Path

ROOT = Path(sys.argv[1])
HEADERS = {}
for line in (ROOT / "_headers").read_text().split("\n\n")[0].splitlines()[1:]:
    k, v = line.strip().split(": ", 1)
    HEADERS[k] = v


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def end_headers(self):
        for k, v in HEADERS.items():
            self.send_header(k, v)
        super().end_headers()

    def send_head(self):
        path = self.path.split("?")[0].split("#")[0]
        p = ROOT / path.lstrip("/")
        if path == "/" or p.is_file():
            return super().send_head()
        if (ROOT / (path.strip("/") + ".html")).is_file():
            self.path = path.rstrip("/") + ".html"
            return super().send_head()
        self.send_response(404)
        body = (ROOT / "404.html").read_bytes()
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        return None


if __name__ == "__main__":
    http.server.ThreadingHTTPServer((os.environ.get("SERVE_HOST", "127.0.0.1"), 8000), H).serve_forever()
