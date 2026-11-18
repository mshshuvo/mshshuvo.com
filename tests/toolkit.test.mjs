// Unit tests for the toolkit's shared browser helpers (static/toolkit/tk-common.js).
// They load the real file into a sandbox, so what is tested is exactly what visitors run.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const code = fs.readFileSync(new URL("../static/toolkit/tk-common.js", import.meta.url), "utf8");
const sandbox = { document: {}, navigator: {}, localStorage: null, setTimeout, URL, Blob, TextEncoder };
vm.createContext(sandbox);
vm.runInContext(code + "\nthis.TK = TK;", sandbox);
const { TK } = sandbox;
const XSS = `<img src=x onerror="alert(1)">`;

test("html`` escapes every value placed in markup", () => {
  const out = String(TK.html`<p title="${XSS}">${XSS}</p>`);
  assert.equal(out, '<p title="&lt;img src=x onerror=&quot;alert(1)&quot;&gt;">&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>');
  assert.doesNotMatch(out, /<img/);
});

test("quotes cannot break out of attributes", () => {
  assert.match(String(TK.html`<a data-x="${`" onmouseover="x()`}">`), /data-x="&quot; onmouseover=&quot;x\(\)">/);
  assert.match(String(TK.html`<a data-x='${"' onclick='x()"}'>`), /&#39; onclick=&#39;x\(\)/);
});

test("nested markup and lists are kept, values inside them are still escaped", () => {
  const rows = ["a&b", XSS].map((v) => TK.html`<li>${v}</li>`);
  assert.equal(String(TK.html`<ul>${rows}</ul>`), "<ul><li>a&amp;b</li><li>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</li></ul>");
});

test("esc() output is not escaped twice", () => {
  assert.equal(String(TK.html`<b>${TK.esc("Tom & Jerry")}</b>`), "<b>Tom &amp; Jerry</b>");
});

test("numbers, booleans and empty values render as before", () => {
  assert.equal(String(TK.html`${0}|${12.5}|${false}|${true}|${null}|${undefined}`), "0|12.5|false|true||");
});

test("empty lists stay falsy so 'list || fallback' shows the fallback", () => {
  assert.equal(TK.join([]), "");
  assert.equal(String(TK.html`${TK.join([]) || TK.html`<p>None</p>`}`), "<p>None</p>");
  assert.equal(String(TK.join([TK.html`<i>1</i>`, "<x>"])), "<i>1</i>&lt;x&gt;");
});

test("CSV export neutralises spreadsheet formulas", () => {
  const csv = TK.toCSV([["=HYPERLINK(\"http://evil\")", "+1+1", "-2", "@SUM(A1)", "-5", "3.5", "plain"]]);
  assert.equal(csv, `"'=HYPERLINK(""http://evil"")",'+1+1,-2,'@SUM(A1),-5,3.5,plain\r\n`);
});

test("CSV parsing handles quotes, commas and line breaks inside cells", () => {
  const rows = TK.parseCSV('id,note\r\n1,"a, ""b""\nc"\r\n\r\n2,x');
  assert.deepEqual(JSON.parse(JSON.stringify(rows)), [["id", "note"], ["1", 'a, "b"\nc'], ["2", "x"]]);
});

test("files over 5 MB are refused before they are read", () => {
  let result = null;
  const input = { files: [{ size: 6 * 1024 * 1024, name: "big.csv" }], value: "big.csv" };
  TK.readFile(input, (text, name, err) => { result = { text, name, err }; });
  assert.equal(result.text, null);
  assert.match(result.err, /limit is 5 MB/);
  assert.equal(input.value, "");
});

test("sha256 matches the standard test vectors", () => {
  assert.equal(TK.sha256(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(TK.sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(TK.sha256("a".repeat(1000)), "41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3");
});
