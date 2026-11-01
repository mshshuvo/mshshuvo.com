// mshshuvo.com Worker.
// Static pages are served by Cloudflare's asset layer before this code runs;
// the Worker only handles POST /api/contact:
//   1. same-origin + content-type + size checks
//   2. Cloudflare Turnstile verification (server side)
//   3. input validation
//   4. email to the owner through Cloudflare Email Routing (free, verified address only)
// It also handles POST /api/assessment (anonymous readiness-check counts, stored in a
// SQLite Durable Object) and a daily cron that emails the owner a digest of new completions.
// Every request is logged as structured JSON to Workers Logs.

import PAGE_HEADERS from "./site_headers.json" with { type: "json" };
import CHECKS from "./assessments.json" with { type: "json" };

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
// Conservative address check: no whitespace, quotes, commas, semicolons or angle brackets,
// so a submitted address can only ever be a single plain Reply-To mailbox.
const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const TOPICS = new Set(["Job opportunity", "Consulting engagement", "Speaking or training", "Something else"]);

function describe(err) {
  return `${err && err.code ? err.code + ": " : ""}${String(err && err.message || err)}`.slice(0, 300);
}

// RFC 2047 encoded-word for header text that may contain non-ASCII characters.
function encodeHeader(value) {
  return /^[\x20-\x7e]*$/.test(value) ? value
    : `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(value)))}?=`;
}

// Plain-text MIME message for the classic Email Routing send path.
export function buildMime({ to, from, replyTo, subject, text }, now = new Date(), id = crypto.randomUUID()) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const body = btoa(bin).replace(/.{1,76}/g, "$&\r\n");
  const domain = from.split("@")[1];
  return [
    `From: mshshuvo.com contact form <${from}>`,
    `To: <${to}>`,
    `Reply-To: <${replyTo}>`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${now.toUTCString()}`,
    `Message-ID: <${id}@${domain}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    body,
  ].join("\r\n");
}

// Send through the send_email binding. The structured API needs the domain onboarded to
// Email Service; if that is refused, fall back to the classic Email Routing path
// (raw MIME to a verified destination address), which is free on every plan.
async function sendMail(env, mail) {
  try {
    return await env.EMAIL.send(mail);
  } catch (first) {
    let EmailMessage;
    try {
      ({ EmailMessage } = await import("cloudflare:email"));
    } catch {
      throw first;
    }
    try {
      return await env.EMAIL.send(new EmailMessage(mail.from, mail.to, buildMime(mail)));
    } catch (second) {
      first.fallback = second;
      throw first;
    }
  }
}

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

async function readLimited(request, max) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) { buf.set(c, offset); offset += c.byteLength; }
  return new TextDecoder().decode(buf);
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

  // Read the body as a stream and stop at the limit, so an oversized (e.g. chunked) upload
  // is never buffered in full.
  const text = await readLimited(request, MAX_BODY_BYTES);
  if (text === null) {
    log("contact_rejected_size", request, { length: "stream" });
    return json(413, { success: false, message: "Message too large" });
  }
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { success: false, message: "Invalid request" });
  }
  // JSON.parse also accepts null, numbers, strings and arrays; only a plain object is valid here.
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
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

  if (!env.CONTACT_TO) {
    log("contact_misconfigured", request);
    return json(503, { success: false, message: "Could not send right now." });
  }
  const mail = {
    to: env.CONTACT_TO,
    from: env.CONTACT_FROM,
    replyTo: email,
    subject: `[mshshuvo.com] ${topic} from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\n${message}\n\n--\nSent from the contact form on mshshuvo.com`,
  };
  try {
    await sendMail(env, mail);
  } catch (err) {
    log("contact_send_failed", request, { error: describe(err), fallbackError: err.fallback ? describe(err.fallback) : undefined });
    return json(502, { success: false, message: "Could not send right now." });
  }
  log("contact_sent", request, { topic });
  return json(200, { success: true });
}

// ---------------------------------------------------------------- readiness-check counter
const MAX_ASSESSMENT_BYTES = 1024;

// Validate an anonymous completion: a known check and one 0/1/2 answer per question.
export function parseCompletion(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
  const spec = Object.hasOwn(CHECKS, body.check) ? CHECKS[body.check] : null;
  const answers = body.answers;
  if (!spec || !Array.isArray(answers) || answers.length !== spec.refs.length) return null;
  if (!answers.every((a) => a === 0 || a === 1 || a === 2)) return null;
  const score = Math.round((100 * answers.reduce((x, y) => x + y, 0)) / (2 * answers.length));
  return { check: body.check, answers, score };
}

async function handleAssessment(request, env) {
  if (!ALLOWED_ORIGINS.has(request.headers.get("Origin"))) {
    return json(403, { success: false, message: "Forbidden" });
  }
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
    return json(415, { success: false, message: "Unsupported content type" });
  }
  const raw = await readLimited(request, MAX_ASSESSMENT_BYTES);
  if (raw === null) return json(413, { success: false, message: "Too large" });
  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { success: false, message: "Invalid request" }); }
  const done = parseCompletion(body);
  if (!done) return json(400, { success: false, message: "Invalid request" });
  const country = (request.cf && request.cf.country) || "";
  try {
    await statsStub(env).fetch("https://stats/record", {
      method: "POST", body: JSON.stringify({ ...done, country: String(country).slice(0, 2) }),
    });
  } catch (err) {
    console.log(JSON.stringify({ event: "assessment_store_failed", error: describe(err) }));
    return json(503, { success: false, message: "Unavailable" });
  }
  // No IP or user agent here: the completion is meant to stay anonymous.
  console.log(JSON.stringify({ event: "assessment_completed", check: done.check, score: done.score }));
  return json(200, { success: true });
}

function statsStub(env) {
  return env.STATS.get(env.STATS.idFromName("global"));
}

function band(score) {
  return score >= 80 ? "high" : score >= 50 ? "mid" : "low";
}

// Plain-text digest email from the rows recorded since the last digest.
export function buildDigest(rows, totals, since, now) {
  const by = {};
  for (const r of rows) (by[r.check] ||= []).push(r);
  const day = (t) => new Date(t).toISOString().slice(0, 16).replace("T", " ") + " UTC";
  const lines = [
    `${rows.length} readiness check${rows.length === 1 ? "" : "s"} completed between ${day(since)} and ${day(now)}.`,
    "",
  ];
  for (const [check, list] of Object.entries(by)) {
    const spec = CHECKS[check];
    const avg = Math.round(list.reduce((x, r) => x + r.score, 0) / list.length);
    const bands = { high: 0, mid: 0, low: 0 };
    list.forEach((r) => { bands[band(r.score)] += 1; });
    const gapCount = spec.refs.map(() => 0);
    list.forEach((r) => JSON.parse(r.answers).forEach((a, i) => { if (a < 2) gapCount[i] += 1; }));
    const top = gapCount.map((n, i) => [n, i]).filter(([n]) => n > 0).sort((x, y) => y[0] - x[0]).slice(0, 3);
    const countries = [...new Set(list.map((r) => r.country).filter(Boolean))].join(", ") || "unknown";
    lines.push(`${spec.name}: ${list.length} completed, average ${avg}%`);
    lines.push(`  Scores: ${bands.high} at 80%+, ${bands.mid} at 50-79%, ${bands.low} below 50%`);
    if (top.length) {
      lines.push("  Most common gaps:");
      top.forEach(([n, i]) => lines.push(`    - ${spec.refs[i]} (${n}): ${spec.fixes[i]}`));
    }
    lines.push(`  Countries: ${countries}`, "");
  }
  lines.push("All-time totals:");
  for (const [check, spec] of Object.entries(CHECKS)) lines.push(`  ${spec.name}: ${totals[check] || 0}`);
  lines.push("", "--", "Daily digest from mshshuvo.com. Completions are anonymous: no names, emails or IP addresses are stored.");
  return lines.join("\n");
}

// SQLite-backed Durable Object: one global instance holds the completion log.
export class AssessmentStats {
  constructor(ctx) {
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS completions (id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL, check_slug TEXT NOT NULL, score INTEGER NOT NULL, answers TEXT NOT NULL, country TEXT)`);
    this.sql.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL)");
  }

  meta(key, fallback) {
    const row = this.sql.exec("SELECT value FROM meta WHERE key = ?", key).toArray()[0];
    return row ? row.value : fallback;
  }

  setMeta(key, value) {
    this.sql.exec("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);
  }

  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === "/record") {
      const r = await request.json();
      this.sql.exec("INSERT INTO completions (ts, check_slug, score, answers, country) VALUES (?, ?, ?, ?, ?)",
        Date.now(), r.check, r.score, JSON.stringify(r.answers), r.country || "");
      return new Response("ok");
    }
    if (pathname === "/digest") {
      // Rows after the last reported id; the cursor only moves on /ack, after the email went out.
      const now = Date.now();
      const rows = this.sql.exec(
        "SELECT id, check_slug AS \"check\", score, answers, country FROM completions WHERE id > ? ORDER BY id",
        this.meta("last_id", 0)).toArray();
      const totals = Object.fromEntries(this.sql.exec(
        "SELECT check_slug AS c, COUNT(*) AS n FROM completions GROUP BY check_slug").toArray().map((t) => [t.c, t.n]));
      const lastId = rows.length ? rows[rows.length - 1].id : this.meta("last_id", 0);
      return Response.json({ rows, totals, since: this.meta("last_ts", now - 86400000), now, lastId });
    }
    if (pathname === "/ack") {
      const { now, lastId } = await request.json();
      this.setMeta("last_id", lastId);
      this.setMeta("last_ts", now);
      return new Response("ok");
    }
    return new Response("not found", { status: 404 });
  }
}

export async function runDigest(env) {
  const res = await statsStub(env).fetch("https://stats/digest", { method: "POST" });
  const { rows, totals, since, now, lastId } = await res.json();
  if (!rows.length) {
    console.log(JSON.stringify({ event: "assessment_digest_skipped" }));
    return false;
  }
  if (!env.CONTACT_TO) throw new Error("CONTACT_TO not set");
  await sendMail(env, {
    to: env.CONTACT_TO,
    from: env.CONTACT_FROM,
    replyTo: env.CONTACT_FROM,
    subject: `[mshshuvo.com] ${rows.length} readiness check${rows.length === 1 ? "" : "s"} completed`,
    text: buildDigest(rows, totals, since, now),
  });
  await statsStub(env).fetch("https://stats/ack", { method: "POST", body: JSON.stringify({ now, lastId }) });
  console.log(JSON.stringify({ event: "assessment_digest_sent", count: rows.length }));
  return true;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/contact") {
      if (request.method !== "POST") return json(405, { success: false, message: "Method not allowed" });
      return handleContact(request, env);
    }
    if (url.pathname === "/api/assessment") {
      if (request.method !== "POST") return json(405, { success: false, message: "Method not allowed" });
      return handleAssessment(request, env);
    }
    // Anything that reaches here is not a static asset and not the API.
    log("not_found", request, { path: url.pathname.slice(0, 200) });
    // "/404" (not "/404.html"): with html_handling the .html URL answers with a redirect,
    // which left non-browser clients an empty 404 carrying a stray Location header.
    const page = await env.ASSETS.fetch(new Request(new URL("/404", url), { method: "GET" }));
    const headers = new Headers({ "Content-Type": "text/html; charset=utf-8" });
    for (const [k, v] of Object.entries(PAGE_HEADERS)) headers.set(k, v);
    const html = page.ok ? await page.text() : "<!doctype html><title>Not found</title><h1>Not found</h1>";
    return new Response(html, { status: 404, headers });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDigest(env).catch((err) => {
      console.log(JSON.stringify({ event: "assessment_digest_failed", error: describe(err) }));
    }));
  },
};
