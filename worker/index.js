// mshshuvo.com Worker.
// Static pages are served by Cloudflare's asset layer before this code runs;
// the Worker only handles POST /api/contact:
//   1. same-origin + content-type + size checks
//   2. Cloudflare Turnstile verification (server side)
//   3. input validation
//   4. email to the owner through Cloudflare Email Routing (free, verified address only)
// Every request is logged as structured JSON to Workers Logs.

import PAGE_HEADERS from "./site_headers.json" with { type: "json" };

// API responses: nothing to render, so the tightest possible CSP.
const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cache-Control": "no-store",
};

const ALLOWED_ORIGINS = new Set(["https://mshshuvo.com", "https://www.mshshuvo.com"]);
const MAX_BODY_BYTES = 16 * 1024;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TOPICS = new Set(["Job opportunity", "Consulting engagement", "Speaking or training", "Something else"]);

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS },
  });
}

function log(event, request, extra = {}) {
  console.log(JSON.stringify({
    event,
    ip: request.headers.get("CF-Connecting-IP"),
    country: request.cf && request.cf.country,
    asn: request.cf && request.cf.asn,
    ua: (request.headers.get("User-Agent") || "").slice(0, 200),
    ...extra,
  }));
}

// Single-line fields (name, email, subject parts): strip ALL control characters,
// including CR/LF, so nothing can inject extra email headers.
function cleanLine(value, max) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]+/g, " ").trim().slice(0, max);
}

// Multi-line message body: keep line breaks, drop other control characters.
function cleanText(value, max) {
  return String(value ?? "").replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").trim().slice(0, max);
}

async function verifyTurnstile(token, ip, secret) {
  if (!token || !secret) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    return data.success === true;
  } catch {
    return false;  // fail closed if Turnstile can't be reached
  }
}

async function handleContact(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowDev = env.ALLOW_DEV_ORIGIN === "true";
  if (!ALLOWED_ORIGINS.has(origin) && !(allowDev && origin.startsWith("http://localhost"))) {
    log("contact_rejected_origin", request, { origin });
    return json(403, { success: false, message: "Forbidden" });
  }
  if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) {
    return json(415, { success: false, message: "Unsupported content type" });
  }
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > MAX_BODY_BYTES) {
    log("contact_rejected_size", request, { length });
    return json(413, { success: false, message: "Message too large" });
  }

  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return json(413, { success: false, message: "Message too large" });
    body = JSON.parse(text);
  } catch {
    return json(400, { success: false, message: "Invalid request" });
  }

  if (body.botcheck) {  // honeypot: pretend success
    log("contact_honeypot", request);
    return json(200, { success: true });
  }

  const ip = request.headers.get("CF-Connecting-IP");
  if (!(await verifyTurnstile(body["cf-turnstile-response"], ip, env.TURNSTILE_SECRET))) {
    log("contact_turnstile_failed", request);
    return json(403, { success: false, message: "Verification failed. Please refresh and try again." });
  }

  const name = cleanLine(body.name, 100);
  const email = cleanLine(body.email, 200);
  const topic = TOPICS.has(body.topic) ? body.topic : "Something else";
  const message = cleanText(body.message, 4000);
  if (name.length < 2 || !EMAIL_RE.test(email) || message.length < 10) {
    log("contact_invalid", request);
    return json(422, { success: false, message: "Please check the form fields." });
  }

  try {
    await env.EMAIL.send({
      to: env.CONTACT_TO,
      from: env.CONTACT_FROM,
      replyTo: email,
      subject: `[mshshuvo.com] ${topic} from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\n${message}\n\n--\nSent from the contact form on mshshuvo.com`,
    });
  } catch (err) {
    log("contact_send_failed", request, { error: String(err).slice(0, 300) });
    return json(502, { success: false, message: "Could not send right now." });
  }
  log("contact_sent", request, { topic });
  return json(200, { success: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/contact") {
      if (request.method !== "POST") return json(405, { success: false, message: "Method not allowed" });
      return handleContact(request, env);
    }
    // Anything that reaches here is not a static asset and not the API.
    log("not_found", request, { path: url.pathname.slice(0, 200) });
    const page = await env.ASSETS.fetch(new Request(new URL("/404.html", url), request));
    const headers = new Headers(page.headers);
    for (const [k, v] of Object.entries(PAGE_HEADERS)) headers.set(k, v);  // set, never append
    return new Response(page.body, { status: 404, headers });
  },
};
