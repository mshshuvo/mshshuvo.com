// Unit tests for the contact Worker: node --test worker/
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index.js";

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
