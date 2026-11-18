// Toolkit helpers shared by every tool. Everything runs in the browser; nothing is sent anywhere.
"use strict";
const TK = (() => {
  // Markup is only ever built with the html`...` tag: every value placed in it is escaped unless it is
  // itself markup made by html`...` or esc(). Arrays are joined. This makes injection from imported
  // CSV files or stored data impossible by construction, and the lint rule enforces the pattern.
  class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
  const escText = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const esc = (s) => (s instanceof Safe ? s : new Safe(escText(s)));
  const part = (v) => (v instanceof Safe ? v.s : Array.isArray(v) ? v.map(part).join("") : v === null || v === undefined ? "" : escText(v));
  const join = (list) => (list.length ? new Safe(part(list)) : "");  // empty list stays falsy for "list || fallback"
  const html = (strings, ...values) => new Safe(strings.reduce((out, s, i) => out + s + (i < values.length ? part(values[i]) : ""), ""));
  const $ = (id) => document.getElementById(id);

  // The site's Content Security Policy blocks style attributes in markup, so sizes are
  // written as data-w / data-h (percent) and applied here through the style object.
  function dims(root) {
    root.querySelectorAll("[data-w]").forEach((e) => { e.style.width = e.dataset.w + "%"; });
    root.querySelectorAll("[data-h]").forEach((e) => { e.style.height = e.dataset.h + "%"; });
  }

  function parseCSV(text) {
    const rows = []; let row = [], cell = "", q = false;
    text = text.replace(/^﻿/, "");
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        if (row.some((v) => v.trim() !== "")) rows.push(row);
        row = [];
      } else cell += c;
    }
    row.push(cell);
    if (row.some((v) => v.trim() !== "")) rows.push(row);
    return rows;
  }
  // Rows of objects keyed by lower-case header.
  function parseTable(text) {
    const rows = parseCSV(text);
    if (!rows.length) return { headers: [], rows: [] };
    const headers = rows[0].map((h) => h.trim());
    return { headers, rows: rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h.toLowerCase(), (r[i] ?? "").trim()]))) };
  }
  // Text that a spreadsheet would run as a formula is prefixed with an apostrophe.
  const cell = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const toCSV = (rows) => rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

  function download(name, text, mime) {
    const url = URL.createObjectURL(new Blob([text], { type: mime || "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
  }
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  function readFile(input, done) {
    const f = input.files && input.files[0];
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {  // protects the visitor's own tab from freezing on a huge file
      input.value = "";
      done(null, f.name, `That file is ${(f.size / 1048576).toFixed(1)} MB. The limit is 5 MB; split it or remove unused columns.`);
      return;
    }
    const r = new FileReader();
    r.onload = () => { done(String(r.result), f.name); input.value = ""; };
    r.readAsText(f);
  }
  function store(key) {
    return {
      get() { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
      set(v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage is optional */ } },
      clear() { try { localStorage.removeItem(key); } catch (e) { /* storage is optional */ } },
    };
  }
  function tips() {
    let tip = $("tk-tip");
    if (!tip) { tip = document.createElement("div"); tip.id = "tk-tip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip); }
    document.addEventListener("pointermove", (e) => {
      const t = e.target.closest && e.target.closest("[data-tip]");
      if (!t || !t.dataset.tip) { tip.style.display = "none"; return; }
      tip.textContent = t.dataset.tip; tip.style.display = "block";
      tip.style.left = Math.max(8, Math.min(e.clientX + 12, window.innerWidth - tip.offsetWidth - 8)) + "px";
      tip.style.top = (e.clientY + 14) + "px";
    });
  }
  // Views are sections named view-<name>; tabs are links with href="#<name>".
  function tabs(names) {
    const route = () => {
      const want = location.hash.slice(1);
      const v = names.includes(want) ? want : names[0];
      names.forEach((n) => {
        $("view-" + n).hidden = n !== v;
        const t = $("tab-" + n);
        if (n === v) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current");
      });
    };
    window.addEventListener("hashchange", route); route();
  }
  // SHA-256 (FIPS 180-4), synchronous so it also works in a downloaded copy opened from disk.
  // Used to fingerprint loaded files so a reviewer can prove which data a result came from.
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256(text) {
    const msg = new TextEncoder().encode(text), bits = msg.length * 8;
    const len = ((msg.length + 9 + 63) >> 6) << 6, buf = new Uint8Array(len), view = new DataView(buf.buffer);
    buf.set(msg); buf[msg.length] = 0x80;
    view.setUint32(len - 8, Math.floor(bits / 4294967296)); view.setUint32(len - 4, bits >>> 0);
    const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const w = new Uint32Array(64), rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < len; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
    }
    return Array.from(h, (x) => x.toString(16).padStart(8, "0")).join("");
  }

  const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const day = (s) => new Date(s + "T00:00:00");
  const fmtDate = (s) => { const d = day(s); return isNaN(d) ? s : d.toLocaleDateString("en-CA", { day: "numeric", month: "short", year: "numeric" }); };
  return { esc, html, join, $, dims, parseCSV, parseTable, toCSV, download, copy, readFile, store, tips, tabs, iso, day, fmtDate, sha256 };
})();
