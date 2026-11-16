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
  const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const day = (s) => new Date(s + "T00:00:00");
  const fmtDate = (s) => { const d = day(s); return isNaN(d) ? s : d.toLocaleDateString("en-CA", { day: "numeric", month: "short", year: "numeric" }); };
  return { esc, html, join, $, dims, parseCSV, parseTable, toCSV, download, copy, readFile, store, tips, tabs, iso, day, fmtDate };
})();
