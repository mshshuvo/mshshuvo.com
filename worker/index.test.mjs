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
