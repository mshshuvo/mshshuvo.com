// Tests for the Phishing Email Header Analyzer engine (static/toolkit/email-header-analyzer.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const sandbox = { document: { addEventListener() {} }, navigator: {}, localStorage: null, setTimeout, URL, Blob, TextEncoder, TextDecoder, atob };
vm.createContext(sandbox);
for (const f of ["tk-common.js", "email-header-analyzer.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../static/toolkit/${f}`, import.meta.url), "utf8"), sandbox);
}
vm.runInContext("this.TKP = TKP; this.TK = TK;", sandbox);
const { TKP } = sandbox;
const ids = (r) => r.findings.map((f) => f.id);

test("parse unfolds continuation lines and stops at the body", () => {
  const p = TKP.parse("Subject: one\r\n two\r\n\tthree\r\nFrom: a@b.example\r\n\r\nBody: not a header\r\n");
  assert.equal(p.headers.length, 2);
  assert.equal(p.headers[0].value, "one two three");
  assert.equal(p.body, true);
});

test("parse skips junk lines and caps input size", () => {
  const p = TKP.parse("hello there\nFrom: a@b.example");
  assert.equal(p.skipped, 1);
  assert.equal(p.headers.length, 1);
  const big = TKP.parse("X-A: " + "a".repeat(TKP.MAX_CHARS + 10));
  assert.equal(big.truncated, true);
});

test("RFC 2047 encoded words decode (B and Q)", () => {
  assert.equal(TKP.decodeWords("=?UTF-8?B?Q2Fmw6k=?="), "Café");
  assert.equal(TKP.decodeWords("=?iso-8859-1?Q?Caf=E9_ouvert?="), "Café ouvert");
  assert.equal(TKP.decodeWords("=?UTF-8?Q?a?= =?UTF-8?Q?b?="), "ab");
});

test("address splits display name, address and domain", () => {
  const a = TKP.address('"Pay, Roll" <Payroll@Mail.Example.co.uk>');
  assert.equal(a.display, "Pay, Roll");
  assert.equal(a.address, "payroll@mail.example.co.uk");
  assert.equal(a.domain, "mail.example.co.uk");
  assert.equal(TKP.orgDomain(a.domain), "example.co.uk");
  assert.equal(TKP.address("bob@x.example (Bob)").display, "Bob");
});

test("Authentication-Results are parsed from the top header only", () => {
  const h = TKP.parse([
    "Authentication-Results: mx.top.example; spf=pass smtp.mailfrom=a.example; dkim=pass header.d=a.example; dmarc=pass (p=REJECT) header.from=a.example",
    "Authentication-Results: forged.example; spf=fail; dmarc=fail",
  ].join("\n")).headers;
  const a = TKP.auth(h);
  assert.equal(a.spf.result, "pass");
  assert.equal(a.dkim[0].domain, "a.example");
  assert.equal(a.dmarc.result, "pass");
  assert.equal(a.dmarc.policy, "reject");
  assert.equal(a.by, "mx.top.example");
});

test("Received-SPF is used when there are no results", () => {
  const a = TKP.auth(TKP.parse("Received-SPF: Fail (domain does not designate) envelope-from=x@bad.example").headers);
  assert.equal(a.spf.result, "fail");
  assert.equal(a.spf.domain, "bad.example");
});

test("route is oldest first with delays", () => {
  const hops = TKP.route(TKP.parse([
    "Received: from b.example (b.example [198.51.100.2]) by c.example with ESMTPS; Wed, 18 Nov 2026 14:06:00 +0000",
    "Received: from a.example (a.example [10.0.0.5]) by b.example with SMTP; Wed, 18 Nov 2026 14:05:00 +0000",
  ].join("\n")).headers);
  assert.equal(hops[0].from, "a.example");
  assert.equal(hops[0].ip, "10.0.0.5");
  assert.equal(TKP.privateIp(hops[0].ip), true);
  assert.equal(hops[1].delay, 60);
  assert.equal(hops[1].tls, true);
});

test("look-alike domains are recognised", () => {
  assert.match(TKP.imitates("rnicrosoft.com", "microsoft.com"), /look-alike/);
  assert.match(TKP.imitates("paypa1.com", "paypal.com"), /look-alike/);
  assert.match(TKP.imitates("northgate.co", "northgate.example"), /different ending/);
  assert.match(TKP.imitates("northgaet.example", "northgate.example"), /letters away/);
  assert.equal(TKP.imitates("mail.northgate.example", "northgate.example"), "");
  assert.equal(TKP.imitates("example.org", "sample.org"), "");
  assert.equal(TKP.brandMatch("microsoft.com"), null);
  assert.equal(TKP.brandMatch("login.microsoftonline.com"), null);
  assert.equal(TKP.brandMatch("docusign-secure.example").brand.name, "DocuSign");
  assert.equal(TKP.brandMatch("harbourline.example"), null);
});

test("sample: fake Microsoft alert is phishing", () => {
  const s = TKP.samples().phish;
  const r = TKP.analyse(s.text, { orgDomain: s.org });
  assert.equal(r.verdict.level, "bad");
  for (const id of ["DMARC_FAIL", "SPF_SOFTFAIL", "COMPAUTH_FAIL", "BRAND_LOOKALIKE", "REPLY_TO", "MS_SPAM", "URGENT"]) assert.ok(ids(r).includes(id), id);
  assert.equal(r.hops.length, 2);
});

test("sample: CEO fraud passes authentication but is still flagged", () => {
  const s = TKP.samples().ceo;
  const r = TKP.analyse(s.text, { orgDomain: s.org });
  assert.equal(r.auth.dmarc.result, "pass");
  assert.ok(ids(r).includes("FREE_ROLE"));
  assert.ok(ids(r).includes("REPLY_TO"));
  assert.notEqual(r.verdict.level, "good");
});

test("sample: genuine supplier email is clean", () => {
  const s = TKP.samples().clean;
  const r = TKP.analyse(s.text, { orgDomain: s.org });
  assert.equal(r.verdict.level, "good");
  assert.equal(r.verdict.flags, 0);
  assert.equal(r.verdict.passed, true);
});

test("own-domain look-alike is critical", () => {
  const r = TKP.analyse('From: "Accounts" <ap@northgaet.example>\nSubject: Updated bank details', { orgDomain: "https://www.northgate.example/" });
  assert.equal(r.ownDomain, "northgate.example");
  assert.ok(ids(r).includes("OWN_LOOKALIKE"));
  assert.equal(r.verdict.level, "bad");
});

test("display-name tricks", () => {
  const r = TKP.analyse('From: "support@paypal.com" <x@random.example>');
  assert.ok(ids(r).includes("DISPLAY_ADDR"));
  const r2 = TKP.analyse('From: "PayPal Service" <service@random.example>');
  assert.ok(ids(r2).includes("BRAND_NAME"));
  const r3 = TKP.analyse('From: "Microsoft" <no-reply@microsoft.com>');
  assert.ok(!ids(r3).includes("BRAND_NAME"));
  const r4 = TKP.analyse("From: =?UTF-8?B?0JzQsNC5Y3Jvc29mdA==?= <a@b.example>");
  assert.ok(ids(r4).includes("MIXED_SCRIPT"));
});

test("empty and junk input give an empty result", () => {
  assert.equal(TKP.analyse("").empty, true);
  assert.equal(TKP.analyse("just some words\nand more").empty, true);
});

test("report is plain text and lists the flags", () => {
  const r = TKP.analyse(TKP.samples().phish.text);
  const t = TKP.report(r, "now");
  assert.match(t, /DMARC: fail/);
  assert.match(t, /\[High\]/);
  assert.match(t, /ROUTE/);
});

test("hostile header values are escaped when rendered", () => {
  const r = TKP.analyse('From: "<img src=x onerror=alert(1)>" <a@b.example>\nSubject: <script>x</script>');
  const out = String(sandbox.TK.html`<p>${r.meta.from.display}</p><p>${r.meta.subject}</p>`);
  assert.ok(!out.includes("<img"));
  assert.ok(!out.includes("<script"));
  assert.ok(out.includes("&lt;img"));
});

test("header.d=none is not treated as a signing domain", () => {
  const a = TKP.auth(TKP.parse("Authentication-Results: spf=pass; dkim=none (message not signed) header.d=none; dmarc=fail").headers);
  assert.equal(a.dkim[0].domain, "");
});

test("split Authentication-Results headers from one server are merged (Proton Mail style)", () => {
  const h = TKP.parse([
    "Authentication-Results: mail.protonmail.ch; dkim=pass (Good 2048 bit rsa-sha256 signature) header.d=email.shop.example header.a=rsa-sha256",
    "Authentication-Results: mail.protonmail.ch; dmarc=pass (p=reject dis=none) header.from=email.shop.example",
    "Authentication-Results: mail.protonmail.ch; spf=pass smtp.mailfrom=email.shop.example",
    "Authentication-Results: mail.protonmail.ch; arc=none smtp.remote-ip=198.51.100.9",
    "Authentication-Results: other.example; spf=fail smtp.mailfrom=email.shop.example",
  ].join("\n")).headers;
  const a = TKP.auth(h);
  assert.equal(a.spf.result, "pass");
  assert.equal(a.dkim[0].result, "pass");
  assert.equal(a.dkim[0].domain, "email.shop.example");
  assert.equal(a.dmarc.result, "pass");
  assert.equal(a.dmarc.policy, "reject");
});

test("long opaque server IDs are shortened in the route", () => {
  const hops = TKP.route(TKP.parse("Received: by " + "b77a".repeat(16) + " with HTTP; Sat, 21 Nov 2026 12:55:15 +0000").headers);
  assert.equal(hops[0].from, "");
  assert.match(hops[0].by, /^b77ab77ab77a… \(internal ID\)$/);
});
