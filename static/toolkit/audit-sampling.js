// Audit Sampling Calculator. Sizes a control-test sample with exact attribute-sampling maths,
// draws a sample anyone can re-perform, and says what the results let you conclude.
// Runs in the browser; the population you load is never sent anywhere.
"use strict";

// ---------------------------------------------------------------- maths (no page access)
const TKS = (() => {
  // log-gamma (Lanczos, g = 7), accurate to about 1e-14 for the values used here
  const LG = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  function lgamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1;
    let a = LG[0];
    const t = x + 7.5;
    for (let i = 1; i < 9; i++) a += LG[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  const logComb = (n, k) => (k < 0 || k > n ? -Infinity : lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1));

  function binomCdf(k, n, p) {
    if (k < 0) return 0;
    if (k >= n || p <= 0) return 1;
    if (p >= 1) return 0;
    const lp = Math.log(p), lq = Math.log1p(-p);
    let total = 0;
    for (let i = 0; i <= k; i++) total += Math.exp(logComb(n, i) + i * lp + (n - i) * lq);
    return Math.min(1, total);
  }
  function hyperCdf(k, population, defects, n) {
    if (k < 0) return 0;
    const lo = Math.max(0, n - (population - defects)), hi = Math.min(n, defects);
    if (k >= hi) return 1;
    if (k < lo) return 0;
    const logTotal = logComb(population, n);
    let total = 0;
    for (let i = lo; i <= k; i++) total += Math.exp(logComb(defects, i) + logComb(population - defects, n - i) - logTotal);
    return Math.min(1, total);
  }
  const tolerableDefects = (population, tolerable) => Math.max(1, Math.floor(tolerable * population + 1e-9));

  // Smallest n such that, if the true deviation rate were the tolerable rate, the chance of
  // seeing no more than k = ceil(n * expected) deviations is at most 1 - confidence.
  function attributeSize(confidence, tolerable, expected, population, maxN = 5000) {
    if (!(confidence >= 0.5 && confidence < 1)) throw new Error("Confidence must be between 50% and 99.9%.");
    if (!(tolerable > 0 && tolerable < 1)) throw new Error("Tolerable rate must be above 0% and below 100%.");
    if (!(expected >= 0 && expected < tolerable)) throw new Error("Expected rate must be below the tolerable rate. If you expect that many exceptions, do not plan to rely on the control.");
    if (population != null && population < 1) throw new Error("Population must be at least 1.");
    const alpha = 1 - confidence, limit = population ? Math.min(maxN, population) : maxN;
    const dTol = population ? tolerableDefects(population, tolerable) : null;
    const method = population ? "attribute-hypergeometric" : "attribute-binomial";
    const base = { method, confidence, tolerable_rate: tolerable, expected_rate: expected, population: population || null };
    for (let n = 1; n <= limit; n++) {
      const k = Math.ceil(n * expected - 1e-9);
      const risk = population ? hyperCdf(k, population, dTol, n) : binomCdf(k, n, tolerable);
      if (risk <= alpha) return { ...base, n, allowed_deviations: k, test_all: Boolean(population && n >= population) };
    }
    if (population && limit === population) return { ...base, n: population, allowed_deviations: 0, test_all: true };
    throw new Error(`No sample up to ${maxN} items meets these settings. Widen the tolerable rate or lower the confidence.`);
  }

  // Practitioner convention for manual controls: (lower risk, higher risk, typical yearly population).
  const FREQUENCY = { "annual": [1, 1, 1], "semi-annual": [1, 2, 2], "quarterly": [2, 2, 4], "monthly": [2, 5, 12],
    "weekly": [5, 15, 52], "daily": [20, 40, 250], "multiple-daily": [25, 60, 1000] };
  function frequencySize(frequency, risk, population) {
    const [low, high, typical] = FREQUENCY[frequency];
    const n = { lower: low, higher: high, moderate: Math.ceil((low + high) / 2) }[risk];
    const pop = population || typical;
    return { method: "frequency", n: Math.min(n, pop), allowed_deviations: 0, population: pop, test_all: n >= pop,
      confidence: null, tolerable_rate: null, expected_rate: null, range: [low, high] };
  }

  function upperLimit(deviations, n, confidence, population) {
    if (n <= 0 || deviations >= n) return 1;
    const alpha = 1 - confidence;
    if (population) {
      for (let d = deviations + 1; d <= population; d++) if (hyperCdf(deviations, population, d, n) <= alpha) return d / population;
      return 1;
    }
    let lo = deviations / n, hi = 1;
    for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (binomCdf(deviations, n, mid) > alpha) lo = mid; else hi = mid; }
    return hi;
  }
  function supportsReliance(deviations, n, confidence, tolerable, population) {
    const alpha = 1 - confidence;
    return (population ? hyperCdf(deviations, population, tolerableDefects(population, tolerable), n) : binomCdf(deviations, n, tolerable)) <= alpha;
  }
  // Rates are rounded up so assurance is never overstated.
  const upPct = (x) => (Math.ceil(x * 1000 - 1e-9) / 10).toFixed(1) + "%";

  function evaluate(size, planned, tested, exceptions) {
    const statistical = size.method.startsWith("attribute"), allowed = size.allowed_deviations;
    const upper = statistical && tested > 0 ? upperLimit(exceptions, tested, size.confidence, size.population) : null;
    if (exceptions > allowed) return { conclusion: "NOT EFFECTIVE", upper, why: `${exceptions} exception${exceptions === 1 ? "" : "s"} found, more than the ${allowed} the sample design allows. Further testing cannot change this outcome: stop, report the deficiency and assess compensating controls.` };
    if (tested < planned || planned <= 0) return { conclusion: "INCOMPLETE", upper, why: `${tested} of ${planned} items tested. No conclusion until every selected item is tested. Do not substitute items.` };
    if (statistical) {
      const ok = supportsReliance(exceptions, planned, size.confidence, size.tolerable_rate, size.population);
      return { conclusion: ok ? "EFFECTIVE" : "NOT EFFECTIVE", upper,
        why: `${exceptions} exception${exceptions === 1 ? "" : "s"} in ${planned}. The upper deviation limit of ${upPct(upper)} ${ok ? "is within" : "exceeds"} the tolerable rate of ${(size.tolerable_rate * 100).toFixed(1)}% at ${Math.round(size.confidence * 100)}% confidence.` };
    }
    return { conclusion: "EFFECTIVE", upper, why: `No exceptions in ${planned} items. This is a judgmental sample, so the conclusion rests on auditor judgment, not a statistical limit.` };
  }

  // SHA-256 (FIPS 180-4), synchronous so it also works in a downloaded copy opened from disk.
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

  // Hash ranking: every item gets SHA-256("<seed>:<id>") and the n lowest keys are chosen.
  // Re-performable with any SHA-256 tool, and unaffected by the order of the population file.
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  function select(ids, n, seed) {
    const ranked = [...new Set(ids)].sort(cmp).map((id) => [sha256(seed + ":" + id), id]).sort((a, b) => cmp(a[0], b[0]));
    return ranked.slice(0, Math.max(0, n)).map((x) => x[1]);
  }
  // Split n across groups in proportion to size (largest remainder); each group gets at least one when n allows.
  function allocate(sizes, n) {
    const keys = Object.keys(sizes).filter((k) => sizes[k] > 0), total = keys.reduce((a, k) => a + sizes[k], 0), alloc = {};
    if (!total) return alloc;
    n = Math.min(n, total);
    keys.forEach((k) => { alloc[k] = n >= keys.length ? 1 : 0; });
    const sum = () => keys.reduce((a, k) => a + alloc[k], 0), remaining = n - sum(), shares = {};
    keys.forEach((k) => { shares[k] = (remaining * sizes[k]) / total; alloc[k] += Math.min(Math.floor(shares[k]), sizes[k] - alloc[k]); });
    let leftover = n - sum();
    const frac = (k) => shares[k] - Math.floor(shares[k]);
    const order = keys.slice().sort((a, b) => frac(b) - frac(a) || sizes[b] - sizes[a] || cmp(a, b));
    while (leftover > 0) {
      let progressed = false;
      for (const k of order) if (leftover && alloc[k] < sizes[k]) { alloc[k]++; leftover--; progressed = true; }
      if (!progressed) break;
    }
    return alloc;
  }
  const parseDate = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((v || "").trim()); return m ? m[0] : null; };

  // Build the sampling frame from rows; problems become issues, the way an auditor would log them.
  function frame(rows, idCol, dateCol, start, end) {
    const issues = [], out = [], seen = new Map();
    rows.forEach((row, i) => {
      const line = i + 2, id = row[idCol] || "";
      if (!id) { issues.push(["BLANK_ID", "High", "line " + line, "Row has no item ID, so it cannot be selected or traced."]); return; }
      if (seen.has(id)) { issues.push(["DUPLICATE_ID", "High", id, `ID appears on lines ${seen.get(id)} and ${line}; duplicates distort selection probability.`]); return; }
      seen.set(id, line);
      if (dateCol) {
        const d = parseDate(row[dateCol]);
        if (!d) { issues.push(["UNREADABLE_DATE", "Medium", id, `Date '${row[dateCol] || ""}' is blank or unreadable; item excluded.`]); return; }
        if ((start && d < start) || (end && d > end)) { issues.push(["OUT_OF_PERIOD", "Medium", id, `Dated ${d}, outside the audit period ${start || "..."} to ${end || "..."}; excluded.`]); return; }
      }
      out.push(row);
    });
    return { frame: out, issues };
  }
  function draw(fr, idCol, groupCol, size, seed) {
    const n = size.test_all ? fr.length : Math.min(size.n, fr.length);
    if (!groupCol) return { n, allocation: {}, selected: select(fr.map((r) => r[idCol]), n, seed).map((id) => ({ item_id: id, stratum: "" })) };
    const groups = {};
    fr.forEach((r) => { (groups[r[groupCol] || "(blank)"] ||= []).push(r[idCol]); });
    const allocation = allocate(Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])), n), selected = [];
    Object.keys(groups).sort(cmp).forEach((g) => select(groups[g], allocation[g] || 0, seed).forEach((id) => selected.push({ item_id: id, stratum: g })));
    return { n, allocation, selected };
  }
  return { attributeSize, frequencySize, FREQUENCY, upperLimit, supportsReliance, evaluate, upPct, sha256, select, allocate, frame, draw, binomCdf, hyperCdf };
})();

// ---------------------------------------------------------------- page
document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("tk-sampling")) return;
  const { esc, $, dims } = TK;
  const st = { method: "stat", pop: null, size: null, fr: null, drawn: null, err: "" };
  const num = (id) => { const v = parseFloat($(id).value); return Number.isFinite(v) ? v : null; };
  const pct = (x) => (x * 100).toFixed(x * 100 % 1 ? 1 : 0) + "%";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  function setPopulation(text, name) {
    const t = TK.parseTable(text);
    if (!t.rows.length) { $("as-pop-msg").textContent = "That file has no rows under its header."; return false; }
    st.pop = { text, name, headers: t.headers, rows: t.rows };
    const lower = t.headers.map((h) => h.toLowerCase());
    const guess = (re) => t.headers[lower.findIndex((h) => re.test(h))] || "";
    const fill = (id, optional, pick) => {
      $(id).innerHTML = TK.html`${optional ? TK.html`<option value="">None</option>` : ""}${t.headers.map((h) => TK.html`<option value="${esc(h)}"${h === pick ? " selected" : ""}>${esc(h)}</option>`)}`;
    };
    fill("as-idcol", false, guess(/(^|_)id$|number|ticket|ref/) || t.headers[0]);
    fill("as-groupcol", true, guess(/risk|tier|group|strat/));
    fill("as-datecol", true, guess(/date|_on$|_at$|deployed|created/));
    $("as-pop-msg").textContent = `Loaded ${name}.`;
    return true;
  }
  function loadSample() {
    // The sample file uses Windows line endings; restoring them reproduces its published fingerprint.
    setPopulation(TK_SAMPLE_POPULATION.replace(/\n/g, "\r\n"), "change_tickets.csv (sample)");
    $("as-from").value = "2026-01-01"; $("as-to").value = "2026-09-30"; $("as-seed").value = "MRCU-ITGC-CM02-FY26";
    $("as-conf").value = "0.95"; $("as-tol").value = "10"; $("as-exp").value = "1";
    $("as-tested").value = "36"; $("as-exc").value = "2";
    setMethod("stat");
  }
  function setMethod(m) {
    st.method = m;
    $("as-m-stat").setAttribute("aria-pressed", String(m === "stat")); $("as-m-freq").setAttribute("aria-pressed", String(m === "freq"));
    $("as-stat").hidden = m !== "stat"; $("as-freq").hidden = m !== "freq";
  }

  function compute() {
    // frame first, because a loaded population sets the population size
    st.fr = null;
    if (st.pop) {
      const low = (v) => v.toLowerCase();
      st.fr = TKS.frame(st.pop.rows, low($("as-idcol").value), $("as-datecol").value ? low($("as-datecol").value) : "", $("as-from").value, $("as-to").value);
    }
    const frameN = st.fr ? st.fr.frame.length : null;
    $("as-pop").disabled = Boolean(st.fr); $("as-fpop").disabled = Boolean(st.fr);
    if (st.fr) { $("as-pop").value = frameN || ""; $("as-fpop").value = frameN || ""; }
    st.err = ""; st.size = null;
    try {
      if (st.method === "stat") {
        const tol = num("as-tol"), exp = num("as-exp") || 0, pop = num("as-pop");
        if (tol === null) throw new Error("Enter a tolerable exception rate.");
        st.size = TKS.attributeSize(parseFloat($("as-conf").value), tol / 100, exp / 100, pop ? Math.floor(pop) : null);
      } else st.size = TKS.frequencySize($("as-frequency").value, $("as-risk").value, num("as-fpop") ? Math.floor(num("as-fpop")) : null);
    } catch (e) { st.err = e.message; }
    st.drawn = st.size && st.fr && st.fr.frame.length
      ? TKS.draw(st.fr.frame, $("as-idcol").value.toLowerCase(), $("as-groupcol").value.toLowerCase(), st.size, $("as-seed").value || "seed") : null;
  }

  function renderSize() {
    const s = st.size;
    $("as-size-note").textContent = st.err;
    $("as-size-note").className = "tk-msg" + (st.err ? " tk-msg--err" : "");
    if (!s) { $("as-n").textContent = "–"; $("as-n-text").textContent = ""; $("as-n-tags").innerHTML = ""; $("as-compare").innerHTML = ""; return; }
    $("as-n").textContent = s.n;
    if (s.method === "frequency") {
      $("as-n-text").textContent = s.test_all ? `Test all ${plural(s.n, "occurrence")}: the population is no larger than the sample.`
        : `Test ${plural(s.n, "item")}. Any exception means the control cannot be relied on without more work.`;
      $("as-n-tags").innerHTML = TK.html`<span class="tk-tag">Guide range ${s.range[0]}–${s.range[1]}</span><span class="tk-tag">Judgmental, not statistical</span>`;
      $("as-compare").innerHTML = "";
      $("as-size-note").textContent = "A common practitioner convention, not set by any standard. Record your own basis.";
      return;
    }
    const k = s.allowed_deviations;
    $("as-n-text").textContent = s.test_all ? `The population is too small for sampling to give this assurance. Test every item.`
      : `Test ${plural(s.n, "item")}. If you find no more than ${plural(k, "exception")}, you can say with ${pct(s.confidence)} confidence that fewer than ${pct(s.tolerable_rate)} of all items fail.`;
    $("as-n-tags").innerHTML = TK.html`<span class="tk-tag">Exceptions allowed: ${k}</span><span class="tk-tag">${s.population ? "Exact, for a population of " + s.population : "Large-population model"}</span>`;
    const rows = [0.9, 0.95, 0.99].map((c) => { try { return [c, TKS.attributeSize(c, s.tolerable_rate, s.expected_rate, s.population).n]; } catch (e) { return [c, null]; } });
    const max = Math.max(1, ...rows.map((r) => r[1] || 0));
    $("as-compare").innerHTML = TK.html`${rows.map(([c, n]) => TK.html`<div class="tk-bar ${c === s.confidence ? "tk-bar--on" : ""}" data-tip="${pct(c)} confidence needs ${n ?? "more than 5000"} items">
      <span>${pct(c)} confidence</span><span class="tk-bar__track"><i class="tk-s-b" data-w="${n ? (n / max) * 100 : 100}"></i></span><span class="tk-num tk-muted">${n ?? "–"}</span></div>`)}`;
  }

  function renderDraw() {
    const has = Boolean(st.pop), d = st.drawn, fr = st.fr;
    $("as-pop-tags").innerHTML = TK.html`${has
      ? TK.html`<span class="tk-tag">${plural(st.pop.rows.length, "row")} read</span><span class="tk-tag">${fr.frame.length} eligible</span>
         <span class="tk-tag">Fingerprint <span class="tk-num">${TKS.sha256(st.pop.text).slice(0, 16)}…</span></span>` : ""}`;
    $("as-issues").innerHTML = TK.html`${!has ? TK.html`<p class="tk-muted">Load a population to check it.</p>` : fr.issues.length
      ? TK.html`${fr.issues.slice(0, 50).map(([check, sev, ref, msg]) => TK.html`<p class="tk-issue"><span class="tk-pill ${sev === "High" ? "tk-b-crit" : "tk-b-med"} tk-t-pill">${sev}</span><b>${esc(ref)}</b><span>${esc(msg)}</span></p>`)}${fr.issues.length > 50 ? TK.html`<p class="tk-muted">and ${fr.issues.length - 50} more.</p>` : ""}`
      : TK.html`<p class="tk-issue"><span class="tk-tag tk-tag--ok">Clean</span><span>No blank or duplicate IDs, and every item is inside the period.</span></p>`}`;
    const alloc = d ? Object.entries(d.allocation) : [];
    $("as-alloc-h").hidden = !alloc.length;
    const amax = Math.max(1, ...alloc.map((a) => a[1]));
    $("as-alloc").innerHTML = TK.html`${alloc.sort((a, b) => b[1] - a[1]).map(([g, n]) =>
      TK.html`<div class="tk-bar"><span>${esc(g)}</span><span class="tk-bar__track" data-tip="${esc(g)}: ${n} of the sample"><i class="tk-s-a" data-w="${(n / amax) * 100}"></i></span><span class="tk-num tk-muted">${n}</span></div>`)}`;
    $("as-sel-h").textContent = d ? `Selected items (${d.selected.length})` : "Selected items";
    $("as-selected").innerHTML = TK.html`${d ? d.selected.map((s, i) => TK.html`<tr><td class="tk-num">${i + 1}</td><td class="tk-num">${esc(s.item_id)}</td><td>${esc(s.stratum)}</td></tr>`)
      : TK.html`<tr><td colspan="3" class="tk-muted">${has ? "Nothing to select yet." : "Load a population to draw the sample."}</td></tr>`}`;
    ["as-dl-tracker", "as-dl-record", "as-copy"].forEach((id) => { $(id).disabled = !d; });
  }

  function renderVerdict() {
    const s = st.size, box = $("as-verdict");
    box.className = "tk-card tk-verdict";
    if (!s) { $("as-conclusion").textContent = ""; $("as-why").textContent = "Set a sample size first."; $("as-meter").innerHTML = ""; return; }
    const planned = st.drawn ? st.drawn.selected.length : s.n;
    const tested = Math.min(planned, Math.max(0, Math.floor(num("as-tested") ?? 0))), exc = Math.min(tested, Math.max(0, Math.floor(num("as-exc") ?? 0)));
    const e = TKS.evaluate(s, planned, tested, exc);
    box.classList.add(e.conclusion === "EFFECTIVE" ? "tk-verdict--good" : e.conclusion === "INCOMPLETE" ? "tk-verdict--wait" : "tk-verdict--bad");
    $("as-conclusion").textContent = { "EFFECTIVE": "Effective", "NOT EFFECTIVE": "Not effective", "INCOMPLETE": "Not finished yet" }[e.conclusion];
    $("as-why").textContent = e.why;
    if (e.upper === null) { $("as-meter").innerHTML = ""; return; }
    const max = Math.max(e.upper, s.tolerable_rate) * 1.1, over = e.upper > s.tolerable_rate;
    $("as-meter").innerHTML =
      TK.html`<div class="tk-bar ${over ? "tk-bar--bad" : "tk-bar--on"}" data-tip="Worst rate the results cannot rule out at ${pct(s.confidence)} confidence"><span>Could be as high as</span><span class="tk-bar__track"><i class="tk-s-b" data-w="${(e.upper / max) * 100}"></i></span><span class="tk-num tk-muted">${TKS.upPct(e.upper)}</span></div>
       <div class="tk-bar" data-tip="The most you said you can tolerate"><span>Tolerable rate</span><span class="tk-bar__track"><i class="tk-s-b" data-w="${(s.tolerable_rate / max) * 100}"></i></span><span class="tk-num tk-muted">${(s.tolerable_rate * 100).toFixed(1)}%</span></div>`;
  }
  function refresh() { compute(); renderSize(); renderDraw(); renderVerdict(); dims($("tk-sampling")); }

  // ---- downloads
  function record() {
    const s = st.size, d = st.drawn;
    const basis = s.method === "frequency" ? `${$("as-frequency").value} control, ${$("as-risk").value} risk: practitioner guide`
      : `${Math.round(s.confidence * 100)}% confidence that the deviation rate is below ${(s.tolerable_rate * 100).toFixed(1)}% if no more than ${s.allowed_deviations} deviation(s) are found`;
    return {
      control_id: "", control_description: "", seed: $("as-seed").value || "seed", drawn_on: TK.iso(new Date()),
      population_file: st.pop.name, population_sha256: TKS.sha256(st.pop.text), population_rows: st.pop.rows.length,
      frame_size: st.fr.frame.length, id_column: $("as-idcol").value,
      sample_size: { n: d.n, allowed_deviations: s.allowed_deviations, method: s.method, confidence: s.confidence, tolerable_rate: s.tolerable_rate,
        expected_rate: s.expected_rate, population: s.population, test_all: s.test_all, basis },
      stratify_by: $("as-groupcol").value || null, allocation: d.allocation, selected: d.selected,
      population_issues: st.fr.issues.map(([check, severity, ref, message]) => ({ check, severity, ref, message })), version: 1,
    };
  }
  $("as-dl-tracker").addEventListener("click", () => {
    const core = ["sample_no", "item_id", "stratum", "status", "result", "evidence_ref", "requested_on", "received_on", "tester", "notes"];
    const idc = $("as-idcol").value.toLowerCase(), extra = st.pop.headers.filter((h) => h.toLowerCase() !== idc && !core.includes(h.toLowerCase()));
    const byId = new Map(st.fr.frame.map((r) => [r[idc], r]));
    TK.download("sample-tracker.csv", TK.toCSV([core.concat(extra)].concat(st.drawn.selected.map((s, i) =>
      [i + 1, s.item_id, s.stratum, "not started", "", "", "", "", "", ""].concat(extra.map((h) => (byId.get(s.item_id) || {})[h.toLowerCase()] ?? ""))))));
    $("as-dl-msg").textContent = "Tracker downloaded: one row per selected item.";
  });
  $("as-dl-record").addEventListener("click", () => {
    TK.download("sample-draw-record.json", JSON.stringify(record(), null, 2), "application/json");
    $("as-dl-msg").textContent = "Draw record downloaded. It holds the seed and fingerprint needed to re-perform the sample.";
  });
  $("as-copy").addEventListener("click", async () => {
    const ok = await TK.copy(st.drawn.selected.map((s) => s.item_id).join("\n"));
    $("as-dl-msg").textContent = ok ? "Item list copied." : "Copying was blocked here. Use the tracker download.";
  });

  // ---- events
  $("as-m-stat").addEventListener("click", () => { setMethod("stat"); refresh(); });
  $("as-m-freq").addEventListener("click", () => { setMethod("freq"); refresh(); });
  ["as-conf", "as-pop", "as-tol", "as-exp", "as-frequency", "as-risk", "as-fpop", "as-idcol", "as-groupcol", "as-datecol", "as-seed", "as-from", "as-to", "as-tested", "as-exc"]
    .forEach((id) => { $(id).addEventListener("input", refresh); $(id).addEventListener("change", refresh); });
  $("as-newseed").addEventListener("click", () => {
    const b = new Uint8Array(8); crypto.getRandomValues(b);
    $("as-seed").value = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join(""); refresh();
  });
  $("as-file").addEventListener("change", (e) => TK.readFile(e.target, (text, name, err) => { if (err) { $("as-pop-msg").textContent = err; return; } if (setPopulation(text, name)) { $("as-from").value = ""; $("as-to").value = ""; refresh(); } }));
  $("as-paste-open").addEventListener("click", () => { $("as-paste").hidden = false; $("as-paste-text").focus(); });
  $("as-paste-cancel").addEventListener("click", () => { $("as-paste").hidden = true; });
  $("as-paste-use").addEventListener("click", () => {
    let text = $("as-paste-text").value.trim();
    if (!text) return;
    if (!text.split(/\r?\n/)[0].includes(",")) text = "item_id\n" + text;
    if (setPopulation(text + "\n", "pasted list")) { $("as-from").value = ""; $("as-to").value = ""; $("as-paste").hidden = true; refresh(); }
  });
  $("as-sample").addEventListener("click", () => { loadSample(); refresh(); });
  $("as-print").addEventListener("click", () => { try { window.print(); } catch (e) { /* printing blocked in this viewer */ } });

  TK.tips(); loadSample(); refresh();
});
