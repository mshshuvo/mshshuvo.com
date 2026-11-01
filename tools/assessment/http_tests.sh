#!/usr/bin/env bash
# Low-impact HTTP security checks against mshshuvo.com (owner-authorized, production).
# One request at a time with a pause between requests. No payload is destructive, no test
# can send an email (every contact POST lacks a valid Turnstile token), and the only
# burst is a final 8-request rate-limit check at 1 request/second.
set -u
BASE="${1:-https://mshshuvo.com}"
OUT="${2:-results/http.txt}"
UA="mshshuvo-security-assessment/1.0 (owner-authorized)"
ORIGIN_OK="https://mshshuvo.com"
: > "$OUT"

log() { printf '%s\n' "$*" >> "$OUT"; }

req() {  # req <label> <curl args...>
  local label="$1"; shift
  log "=== $label"
  log "\$ curl $*"
  curl -sS -o /tmp/body -D /tmp/hdr --max-time 20 -A "$UA" "$@" 2>>"$OUT"
  local code=$?
  log "exit=$code"
  sed 's/\r$//' /tmp/hdr | grep -iE '^(HTTP/|location|content-type|content-length|content-security-policy|strict-transport-security|x-frame-options|x-content-type-options|referrer-policy|permissions-policy|cross-origin-|access-control-|set-cookie|cache-control|server|cf-mitigated|allow|x-powered-by)' >> "$OUT"
  log "--- body (first 300 bytes, control chars stripped)"
  head -c 300 /tmp/body | tr -d '\000-\010\013\014\016-\037' >> "$OUT"; log ""
  sleep 2
}

# --- Pages and well-known files
for p in / /projects /projects/national-cirt /contact /assessment /insights /insights/the-ai-paradox \
         /insights/follow /insights/feed.xml /services/iso-27001-grc-audit /index.html /404.html \
         /.well-known/security.txt /robots.txt /sitemap.xml /static/js/site.js /BingSiteAuth.xml; do
  req "GET $p" "$BASE$p"
done

# --- Transport
req "HTTP apex redirect" "http://mshshuvo.com/"
req "HTTP www redirect" "http://www.mshshuvo.com/"
req "HTTPS www" "https://www.mshshuvo.com/"
req "workers.dev disabled" "https://mshshuvo.mshshuvo.workers.dev/"

# --- Sensitive file exposure (expect 404, no content)
for p in /.env /.git/HEAD /.git/config /.dev.vars /wrangler.jsonc /package.json /package-lock.json \
         /content.py /app.py /build.py /requirements.txt /worker/index.js /worker/site_headers.json \
         /_headers /.github/workflows/ci.yml /node_modules/ /dist/ /static/ /static/js/ /templates/base.html \
         /.DS_Store /backup.zip /backup.sql /db.sqlite3 /dump.sql /.env.production /config.json /insights.py /posts/the-ai-paradox.md \
         /admin /wp-admin/ /wp-login.php /server-status /debug /console /.well-known/; do
  req "Exposure $p" "$BASE$p"
done

# --- Path traversal / normalisation (expect 404 or normalised)
for p in "/static/..%2f..%2fapp.py" "/static/%2e%2e/%2e%2e/wrangler.jsonc" "/static/..;/app.py" \
         "/%2e%2e/%2e%2e/etc/passwd" "/static//..//..//content.py"; do
  req "Traversal $p" --path-as-is "$BASE$p"
done

# --- Reflected input (client-side filter only; expect static page, no reflection)
req "Reflection ?tag=" "$BASE/projects?tag=%3Cscript%3Ealert(1)%3C%2Fscript%3E"
req "Reflection 404 path" "$BASE/%3Cscript%3Ealert(1)%3C%2Fscript%3E"

# --- CORS, methods, host header
req "CORS GET from foreign origin" -H "Origin: https://evil.example" "$BASE/"
req "CORS preflight API" -X OPTIONS -H "Origin: https://evil.example" -H "Access-Control-Request-Method: POST" "$BASE/api/contact"
req "TRACE /" -X TRACE "$BASE/"
req "PUT /" -X PUT --data "x" "$BASE/"
req "Host header injection" -H "Host: evil.example" "$BASE/"
req "X-Forwarded-Host injection" -H "X-Forwarded-Host: evil.example" "$BASE/contact"

# --- Contact API abuse cases (no valid Turnstile token anywhere, so no email can be sent)
API="$BASE/api/contact"
J="Content-Type: application/json"
req "API GET" "$API"
req "API POST no Origin" -X POST -H "$J" --data '{}' "$API"
req "API POST foreign Origin" -X POST -H "$J" -H "Origin: https://evil.example" --data '{}' "$API"
req "API POST text/plain" -X POST -H "Content-Type: text/plain" -H "Origin: $ORIGIN_OK" --data '{}' "$API"
req "API POST form-encoded (CSRF shape)" -X POST -H "Content-Type: application/x-www-form-urlencoded" -H "Origin: $ORIGIN_OK" --data 'name=a' "$API"
req "API POST malformed JSON" -X POST -H "$J" -H "Origin: $ORIGIN_OK" --data '{bad' "$API"
req "API POST JSON null" -X POST -H "$J" -H "Origin: $ORIGIN_OK" --data 'null' "$API"
req "API POST JSON array" -X POST -H "$J" -H "Origin: $ORIGIN_OK" --data '[]' "$API"
req "API POST empty object (no token)" -X POST -H "$J" -H "Origin: $ORIGIN_OK" --data '{}' "$API"
req "API POST forged token" -X POST -H "$J" -H "Origin: $ORIGIN_OK" \
  --data '{"name":"Test","email":"t@example.com","message":"assessment test only","cf-turnstile-response":"forged-token"}' "$API"
req "API POST header-injection payload, forged token" -X POST -H "$J" -H "Origin: $ORIGIN_OK" \
  --data '{"name":"A\r\nBcc: x@example.com","email":"t@example.com","message":"assessment test only","cf-turnstile-response":"forged"}' "$API"
req "API POST honeypot set" -X POST -H "$J" -H "Origin: $ORIGIN_OK" --data '{"botcheck":"on"}' "$API"
req "API POST declared oversize" -X POST -H "$J" -H "Origin: $ORIGIN_OK" -H "Content-Length: 20000" --data '{}' "$API"
head -c 20000 /dev/zero | tr '\0' 'a' | sed 's/^/{"message":"/; s/$/"}/' > /tmp/big.json
req "API POST actual 20KB body" -X POST -H "$J" -H "Origin: $ORIGIN_OK" --data-binary @/tmp/big.json "$API"
req "API POST chunked 20KB body" -X POST -H "$J" -H "Origin: $ORIGIN_OK" -H "Transfer-Encoding: chunked" --data-binary @/tmp/big.json "$API"

# --- Rate limit: 10 requests in about 5 s (a typical free rule blocks > 5 per 10 s per IP).
# A 429 or a cf-mitigated response means an edge rule fired; 403 is the Worker rejecting the empty token.
log "=== RATE LIMIT BURST"
for i in 1 2 3 4 5 6 7 8 9 10; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -A "$UA" -X POST -H "$J" -H "Origin: $ORIGIN_OK" --data '{}' "$API")
  log "request $i -> $code"
  sleep 0.5
done
log "=== DONE"
# retest run
