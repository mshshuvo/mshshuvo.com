// Unit tests for the contact Worker: node --test worker/
import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { buildMime } from "./index.js";

const ORIGIN = "https://mshshuvo.com";
const good = { name: "Jane Doe", email: "jane@example.com", topic: "Job opportunity",
  message: "Hello, I'd like to talk about a GRC role.", "cf-turnstile-response": "tok" };

function req(body, { origin = ORIGIN, method = "POST", type = "application/json" } = {}) {
  return new Request("https://mshshuvo.com/api/contact", {
    method, headers: { Origin: origin, "Content-Type": type, "CF-Connecting-IP": "203.0.113.9" },
    body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });
}

function env(sent) {
  return { TURNSTILE_SECRET: "secret", CONTACT_TO: "to@example.com", CONTACT_FROM: "from@mshshuvo.com",
    EMAIL: { send: async (m) => { sent.push(m); return { messageId: "1" }; } } };
}

function mockTurnstile(success) {
  globalThis.fetch = async () => new Response(JSON.stringify({ success }));
}

test("rejects wrong method", async () => {
  const r = await worker.fetch(req(null, { method: "GET" }), env([]));
  assert.equal(r.status, 405);
});

test("rejects cross-origin posts", async () => {
  const r = await worker.fetch(req(good, { origin: "https://evil.example" }), env([]));
  assert.equal(r.status, 403);
});

test("rejects non-JSON content type", async () => {
  const r = await worker.fetch(req("a=b", { type: "application/x-www-form-urlencoded" }), env([]));
  assert.equal(r.status, 415);
});

test("rejects oversized bodies", async () => {
  const r = await worker.fetch(req({ ...good, message: "x".repeat(20000) }), env([]));
  assert.equal(r.status, 413);
});

test("honeypot pretends success but sends nothing", async () => {
  const sent = [];
  const r = await worker.fetch(req({ ...good, botcheck: "on" }), env(sent));
  assert.equal(r.status, 200);
  assert.equal(sent.length, 0);
});

test("failed Turnstile blocks the message", async () => {
  mockTurnstile(false);
  const sent = [];
  const r = await worker.fetch(req(good), env(sent));
  assert.equal(r.status, 403);
  assert.equal(sent.length, 0);
});

test("invalid fields are rejected", async () => {
  mockTurnstile(true);
  const r = await worker.fetch(req({ ...good, email: "nope" }), env([]));
  assert.equal(r.status, 422);
});

test("non-object JSON bodies are rejected with 400, not a crash", async () => {
  for (const raw of ["null", "[]", "42", "\"text\"", "true"]) {
    const r = await worker.fetch(req(raw), env([]));
    assert.equal(r.status, 400, raw);
  }
});

test("chunked bodies over the limit are rejected without full buffering", async () => {
  const big = "x".repeat(20000);
  const stream = new ReadableStream({ start(c) { for (let i = 0; i < 20; i++) c.enqueue(new TextEncoder().encode(big.slice(i * 1000, (i + 1) * 1000))); c.close(); } });
  const r = await worker.fetch(new Request("https://mshshuvo.com/api/contact", {
    method: "POST", body: stream, duplex: "half",
    headers: { Origin: ORIGIN, "Content-Type": "application/json" } }), env([]));
  assert.equal(r.status, 413);
});

test("reply-to addresses with list or header syntax are rejected", async () => {
  mockTurnstile(true);
  for (const email of ["a@b.co, c@d.co", "\"x\"@b.co", "a@b.co>", "a;b@c.co", "a@b"]) {
    const r = await worker.fetch(req({ ...good, email }), env([]));
    assert.equal(r.status, 422, email);
  }
});

test("unknown paths return the 404 page with site headers and no redirect", async () => {
  const assets = { fetch: async (r) => new URL(r.url).pathname === "/404"
    ? new Response("<h1>Not found</h1>", { status: 200, headers: { "Content-Type": "text/html" } })
    : new Response(null, { status: 307, headers: { Location: "/404" } }) };
  const r = await worker.fetch(new Request("https://mshshuvo.com/.env"), { ...env([]), ASSETS: assets });
  assert.equal(r.status, 404);
  assert.equal(r.headers.get("Location"), null);
  assert.match(await r.text(), /Not found/);
  assert.match(r.headers.get("Content-Security-Policy"), /default-src 'self'/);
});

test("valid message is emailed with sanitised fields and security headers", async () => {
  mockTurnstile(true);
  const sent = [];
  const r = await worker.fetch(req({ ...good, name: "Jane\r\nBcc: x@evil.example" }), env(sent));
  assert.equal(r.status, 200);
  assert.equal(sent.length, 1);
  assert.ok(!sent[0].subject.includes("\n") && !sent[0].subject.includes("\r"));
  assert.equal(sent[0].replyTo, "jane@example.com");
  assert.equal(r.headers.get("X-Frame-Options"), "DENY");
  assert.match(r.headers.get("Content-Security-Policy"), /default-src 'none'/);
});

test("MIME fallback message is well-formed and header-safe", () => {
  const raw = buildMime({ to: "to@example.com", from: "contact@mshshuvo.com", replyTo: "jane@example.com",
    subject: "[mshshuvo.com] Job opportunity from Jöhn", text: "Héllo\nworld" }, new Date(0), "abc");
  const [head, body] = raw.split("\r\n\r\n");
  assert.match(head, /^From: .*<contact@mshshuvo.com>$/m);
  assert.match(head, /^Reply-To: <jane@example.com>$/m);
  assert.match(head, /^Message-ID: <abc@mshshuvo.com>$/m);
  assert.match(head, /^Subject: =\?UTF-8\?B\?/m);
  assert.equal(Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8"), "Héllo\nworld");
});

// ---------------------------------------------------------------- readiness-check counter
import { parseCompletion, buildDigest, AssessmentStats, runDigest } from "./index.js";
import { DatabaseSync } from "node:sqlite";

function areq(body, { origin = ORIGIN, type = "application/json" } = {}) {
  return new Request("https://mshshuvo.com/api/assessment", {
    method: "POST", headers: { Origin: origin, "Content-Type": type },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// In-memory stand-in for ctx.storage.sql, backed by real SQLite so the SQL itself is tested.
function fakeSql() {
  const db = new DatabaseSync(":memory:");
  return {
    exec(query, ...bindings) {
      const stmt = db.prepare(query);
      const rows = /^\s*(SELECT|WITH)/i.test(query) ? stmt.all(...bindings) : (stmt.run(...bindings), []);
      return { toArray: () => rows.map((r) => ({ ...r })) };
    },
  };
}

function statsEnv(sent = []) {
  const obj = new AssessmentStats({ storage: { sql: fakeSql() } });
  return {
    obj, sent,
    env: {
      CONTACT_TO: "to@example.com", CONTACT_FROM: "contact@mshshuvo.com",
      EMAIL: { send: async (m) => { sent.push(m); return { messageId: "1" }; } },
      STATS: { idFromName: () => "global", get: () => ({ fetch: (u, init) => obj.fetch(new Request(u, init)) }) },
    },
  };
}

test("completion validation accepts only known checks with 8 answers of 0, 1 or 2", () => {
  assert.deepEqual(parseCompletion({ check: "iso-42001", answers: [2, 2, 2, 2, 1, 1, 0, 0] }),
    { check: "iso-42001", answers: [2, 2, 2, 2, 1, 1, 0, 0], score: 63 });
  for (const bad of [null, [], "x", { check: "nope", answers: [2, 2, 2, 2, 2, 2, 2, 2] },
    { check: "iso-27001", answers: [2, 2] }, { check: "iso-27001", answers: [3, 2, 2, 2, 2, 2, 2, 2] },
    { check: "__proto__", answers: [] }, { check: "toString", answers: [] }]) {
    assert.equal(parseCompletion(bad), null);
  }
});

test("assessment API refuses cross-origin, wrong type, junk and oversize", async () => {
  const { env } = statsEnv();
  assert.equal((await worker.fetch(areq({}, { origin: "https://evil.example" }), env)).status, 403);
  assert.equal((await worker.fetch(areq("{}", { type: "text/plain" }), env)).status, 415);
  assert.equal((await worker.fetch(areq("{bad"), env)).status, 400);
  assert.equal((await worker.fetch(areq({ check: "iso-27001", answers: [9] }), env)).status, 400);
  assert.equal((await worker.fetch(areq({ check: "iso-27001", answers: [], pad: "x".repeat(2000) }), env)).status, 413);
});

test("completions are stored and the digest emails once, then only new ones", async () => {
  const { env, sent } = statsEnv();
  assert.equal(await runDigest(env), false, "no digest without completions");
  for (const answers of [[2, 2, 2, 2, 2, 2, 2, 2], [0, 1, 2, 2, 2, 2, 0, 2], [0, 0, 0, 1, 1, 2, 2, 2]]) {
    const r = await worker.fetch(areq({ check: "ransomware", answers }), env);
    assert.equal(r.status, 200);
  }
  assert.equal(await runDigest(env), true);
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /3 readiness checks completed/);
  assert.match(sent[0].text, /Ransomware & incident readiness: 3 completed, average 73%/);
  assert.match(sent[0].text, /- Recovery \(2\):/);
  assert.match(sent[0].text, /All-time totals:[\s\S]*Ransomware & incident readiness: 3/);
  assert.equal(await runDigest(env), false, "already reported");
  await worker.fetch(areq({ check: "nist-csf", answers: [1, 1, 1, 1, 1, 1, 1, 1] }), env);
  assert.equal(await runDigest(env), true);
  assert.match(sent[1].subject, /1 readiness check completed/);
  assert.match(sent[1].text, /Ransomware & incident readiness: 3\n/);
});

test("a failed digest email is retried next time", async () => {
  const { env, sent } = statsEnv();
  await worker.fetch(areq({ check: "iso-27001", answers: [2, 2, 2, 2, 2, 2, 2, 0] }), env);
  const ok = env.EMAIL.send;
  env.EMAIL.send = async () => { throw new Error("down"); };
  await assert.rejects(runDigest(env));
  env.EMAIL.send = ok;
  assert.equal(await runDigest(env), true);
  assert.match(sent[0].text, /ISO 27001: 1 completed, average 88%/);
});

test("digest text never contains HTML or more than counts", () => {
  const text = buildDigest([{ check: "iso-27001", score: 50, answers: "[1,1,1,1,1,1,1,1]", country: "CA" }],
    { "iso-27001": 1 }, 0, 86400000);
  assert.match(text, /1 readiness check completed/);
  assert.match(text, /Countries: CA/);
  assert.doesNotMatch(text, /</);
});
