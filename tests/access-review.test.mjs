// Tests for the Access Review & SoD Analyzer engine (static/toolkit/access-review.js). They load the real
// browser files into a sandbox, so what is tested is exactly what visitors run.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const sandbox = { document: { addEventListener() {} }, navigator: {}, localStorage: null, setTimeout, URL, Blob, TextEncoder };
vm.createContext(sandbox);
for (const f of ["tk-common.js", "access-review-data.js", "access-review.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../static/toolkit/${f}`, import.meta.url), "utf8"), sandbox);
}
vm.runInContext("this.TKA = TKA; this.TK = TK;", sandbox);
const { TKA } = sandbox;
const AS_OF = "2026-11-17";

function run(files, opt = {}) {
  return TKA.analyse({
    people: TKA.table(files.people.text),
    access: files.access.map((f) => ({ name: f.name, table: TKA.table(f.text) })),
    roleMap: files.roleMap ? TKA.table(files.roleMap.text) : null,
    rules: files.rules ? TKA.table(files.rules.text) : null,
  }, { asOf: AS_OF, dormantDays: 90, ...opt });
}
const sample = () => TKA.sampleFiles(AS_OF);
const pick = (r, check) => [...r.findings].filter((f) => f.check === check).map((f) => f.kind === "sod" ? `${f.rule.id}:${f.person ? f.person.name : "?"}` : `${f.system}:${f.account}`).sort();
const withCheck = (r, check) => r.findings.filter((f) => f.checks.includes(check)).length;

test("sample: totals by severity", () => {
  const r = run(sample());
  const by = {};
  r.findings.forEach((f) => { by[f.sev] = (by[f.sev] || 0) + 1; });
  assert.deepEqual(JSON.parse(JSON.stringify(by)), { crit: 4, high: 13, med: 5, low: 6 });
  assert.equal(r.systems.length, 5);
  assert.equal(r.stats.disabled, 4);
});

test("sample: people who left but can still sign in", () => {
  const r = run(sample());
  assert.deepEqual(pick(r, "LEAVER"), ["Directory (SSO):lpelletier", "Directory (SSO):vsantos", "Finance ERP:KLIU", "Loan Origination:lucas.pelletier@northgate.example"]);
  const kevin = r.findings.find((f) => f.account === "KLIU");
  assert.ok(kevin.tags.includes("Signed in 5 days after leaving"), kevin.tags.join("|"));
  assert.equal(kevin.sev, "crit");
});

test("sample: unowned, unused, on leave and privileged accounts", () => {
  const r = run(sample());
  assert.deepEqual(pick(r, "ORPHANED"), ["Directory (SSO):jsmith", "Finance ERP:TEMP.AUDIT"]);
  assert.deepEqual(pick(r, "OWNER_LEFT"), ["Finance ERP:SVC_BANKFEED"]);
  assert.deepEqual(pick(r, "NO_OWNER"), ["DevOps Pipeline:svc-deploy"]);
  assert.equal(r.findings.find((f) => f.account === "svc-deploy").sev, "high", "privileged service account with no owner");
  assert.deepEqual(pick(r, "DORMANT"), ["DevOps Pipeline:obrown", "Loan Origination:mei.wong@northgate.example"]);
  assert.equal(r.findings.find((f) => f.account === "obrown").sev, "high", "unused admin access");
  assert.deepEqual(pick(r, "NEVER_USED"), ["Core Banking:U1024"]);
  assert.deepEqual(pick(r, "ON_LEAVE"), ["Directory (SSO):roneill", "Loan Origination:ryan.oneill@northgate.example"]);
  assert.deepEqual(pick(r, "PRIVILEGED"), ["Core Banking:U1031", "Directory (SSO):apatel-adm", "Finance ERP:APATEL", "Loan Origination:emily.johnson@northgate.example"]);
  assert.ok(r.findings.find((f) => f.account === "TEMP.AUDIT").tags.includes("Not used for 95 days"));
});

test("sample: segregation of duties, including across systems and inside one role", () => {
  const r = run(sample());
  assert.deepEqual(pick(r, "SOD"), ["SOD-01:Marc Tremblay", "SOD-04:Daniel Okafor", "SOD-05:Sophie Martin", "SOD-06:Omar Haddad",
    "SOD-07:Fatima Siddiqui", "SOD-08:Thomas Bergeron", "SOD-09:Arjun Patel", "SOD-10:Noah Williams", "SOD-11:Ben Cohen",
    "SOD-12:Arjun Patel", "SOD-12:Emily Johnson"]);
  const fatima = r.findings.find((f) => f.key.startsWith("sod|SOD-07"));
  assert.ok(fatima.tags.includes("Across systems"));
  const omar = r.findings.find((f) => f.key.startsWith("sod|SOD-06"));
  assert.ok(omar.sameRole && omar.tags.includes("One role grants both"));
  // Arjun's conflict needs both his normal account and his admin account (matched by name: apatel-adm).
  const arjun = r.findings.find((f) => f.key.startsWith("sod|SOD-09"));
  assert.deepEqual([...new Set(arjun.viaA.concat(arjun.viaB).map((v) => v.account))].sort(), ["APATEL", "apatel", "apatel-adm"]);
});

test("sample: data checks explain what could not be checked", () => {
  const r = run(sample());
  const notes = r.notes.join("\n");
  assert.match(notes, /1 role isn't in the role map.*Core Banking · Branch Ops/);
  assert.match(notes, /7 accounts were matched to a person by account name only/);
  assert.match(notes, /1 person has a leaving date after the review date/);
});

test("disabled accounts, and leavers whose access is gone, raise nothing", () => {
  const r = run(sample());
  assert.ok(!r.findings.some((f) => f.person && f.person.name === "Paul Girard"));
  assert.ok(!r.findings.some((f) => f.account === "kliu"), "Kevin's directory account is disabled");
});

test("dormancy threshold changes what counts as unused", () => {
  assert.equal(withCheck(run(sample(), { dormantDays: 30 }), "DORMANT"), 7);
  assert.equal(withCheck(run(sample()), "DORMANT"), 3);
  assert.equal(withCheck(run(sample(), { dormantDays: 365 }), "DORMANT"), 0);
});

test("column names are matched loosely and roles can be split across rows", () => {
  const people = "Employee Number,Full Name,Work Email,Employment Status,Last Day\n7,Ana Silva,ana@x.example,Terminated,2026-10-01\n8,Bo Li,bo@x.example,Active,\n";
  const access = "Application,User Name,Mail,Entitlement,Account Status,Last Logon\nPay,asilva,,Payer,Active,2026-11-01T09:00:00Z\nPay,asilva,,Vendor Admin,Active,\nPay,bli,bo@x.example,Payer,Active,2026-11-10\n";
  const map = "System,Role,Function,Privileged\nPay,Payer,Release payments,no\nPay,Vendor Admin,Maintain vendors,yes\n";
  const r = run({ people: { text: people }, access: [{ name: "pay.csv", text: access }], roleMap: { text: map }, rules: { text: TKA.starterRulesCSV() } });
  const ana = r.findings.find((f) => f.account === "asilva" && f.kind === "account");
  assert.equal(ana.check, "LEAVER");
  assert.ok(ana.tags.includes("Signed in 31 days after leaving"));
  assert.ok(ana.checks.includes("PRIVILEGED"));
  assert.deepEqual(pick(r, "SOD"), ["SOD-01:Ana Silva"]);
});

test("missing columns give a clear error instead of wrong results", () => {
  assert.match(TKA.analyse({ people: TKA.table("name\nA\n"), access: [] }, { asOf: AS_OF, dormantDays: 90 }).error, /employee_id or email/);
  assert.match(TKA.analyse({ people: TKA.table("email\na@x\n"), access: [{ name: "x.csv", table: TKA.table("role\nA\n") }] }, { asOf: AS_OF, dormantDays: 90 }).error, /x\.csv needs an account or email column/);
});

test("hostile values stay data", () => {
  const r = run({ people: { text: "email,name\n\"<img src=x onerror=alert(1)>@x\",\"=HYPERLINK(1)\"\n" },
    access: [{ name: "a.csv", text: "system,account,__proto__,constructor\nS,<script>,1,2\n" }] });
  assert.equal(r.findings[0].account, "<script>");
  assert.equal(Object.getPrototypeOf({}).polluted, undefined);
});
