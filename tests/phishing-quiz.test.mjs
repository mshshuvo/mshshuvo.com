// Tests for the "Real or Phish?" quiz engine and question bank.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const sandbox = { document: { addEventListener() {} }, navigator: {}, localStorage: null, setTimeout, URL, Blob, TextEncoder };
vm.createContext(sandbox);
for (const f of ["tk-common.js", "phishing-quiz-data.js", "phishing-quiz.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../static/toolkit/${f}`, import.meta.url), "utf8"), sandbox);
}
vm.runInContext("this.TKQ = TKQ; this.TK = TK; this.PQ_BANK = PQ_BANK;", sandbox);
const { TKQ, PQ_BANK } = sandbox;

// Only fictional .example domains, plus the two public webmail services used to show personal-account tricks.
const ALLOWED_REAL = new Set(["gmail.com", "outlook.com"]);
const domainOk = (d) => d.endsWith(".example") || ALLOWED_REAL.has(d);
function seeded(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }

test("bank is well formed", () => {
  const ids = new Set();
  for (const q of PQ_BANK) {
    assert.ok(!ids.has(q.id), `duplicate ${q.id}`); ids.add(q.id);
    assert.ok(q.kind === "phish" || q.kind === "real", q.id);
    for (const k of ["topic", "from", "addr", "subject", "lesson"]) assert.ok(typeof q[k] === "string" && q[k].length, `${q.id}.${k}`);
    assert.ok(Array.isArray(q.body) && q.body.length, q.id);
    assert.ok(q.clues.length >= 2 && q.clues.every((c) => c.length === 2 && c[0] && c[1]), `${q.id} clues`);
  }
  assert.ok(PQ_BANK.filter((q) => q.kind === "phish").length >= 6);
  assert.ok(PQ_BANK.filter((q) => q.kind === "real").length >= 4);
});

test("every address and link uses a fictional domain", () => {
  for (const q of PQ_BANK) {
    for (const a of [q.addr, q.replyTo].filter(Boolean)) assert.ok(domainOk(a.split("@")[1]), `${q.id}: ${a}`);
    for (const b of q.body) {
      const href = b.link ? b.href : b.qr;
      if (!href) continue;
      assert.match(href, /^https:\/\//, q.id);
      assert.ok(domainOk(TKQ.host(href)), `${q.id}: ${href}`);
    }
  }
});

test("a round has 10 unique emails, 6 phish and 4 real", () => {
  for (let s = 1; s < 30; s++) {
    const r = TKQ.pick(PQ_BANK, seeded(s));
    assert.equal(r.length, 10);
    assert.equal(new Set(r.map((q) => q.id)).size, 10);
    assert.equal(r.filter((q) => q.kind === "phish").length, 6);
  }
});

test("rounds vary", () => {
  const a = TKQ.pick(PQ_BANK, seeded(1)).map((q) => q.id).join();
  const b = TKQ.pick(PQ_BANK, seeded(2)).map((q) => q.id).join();
  assert.notEqual(a, b);
});

test("grades", () => {
  assert.equal(TKQ.grade(10, 10).band, "Phish-proof");
  assert.equal(TKQ.grade(8, 10).band, "Sharp eye");
  assert.equal(TKQ.grade(6, 10).band, "Getting there");
  assert.equal(TKQ.grade(3, 10).band, "Worth a refresher");
  assert.match(TKQ.shareText(7, 10), /7\/10.*mshshuvo\.com\/toolkit\/phishing-quiz/);
});

test("QR pattern is deterministic and has finder squares", () => {
  const a = TKQ.qrCells("x"), b = TKQ.qrCells("x");
  assert.deepEqual(a, b);
  const has = (x, y) => a.some(([cx, cy]) => cx === x && cy === y);
  assert.ok(has(0, 0) && has(6, 6) && has(20, 0) && has(0, 20) && has(3, 3));
  assert.ok(!has(1, 1));
});

test("quiz text is escaped when rendered", () => {
  const out = String(sandbox.TK.html`<b>${'<img src=x onerror=alert(1)>'}</b>`);
  assert.ok(!out.includes("<img"));
});
