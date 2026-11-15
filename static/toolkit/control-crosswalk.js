// Control Crosswalk: test a control once and see what its evidence proves across ISO/IEC 27001,
// SOC 2, NIST CSF 2.0 and CIS Controls. Runs in the browser on the reference data in
// control-crosswalk-data.js; nothing is sent anywhere.
"use strict";

// ---------------------------------------------------------------- engine (no page access)
const TKC = (() => {
  const RANK = { "Effective": 0, "Exception": 1, "Stale": 2, "Untested": 3, "No evidence": 4, "Failed": 5 };
  // Evidence dates are day offsets from the assessment date, so "today" is 0.
  function evidenceState(collected, valid, result) {
    if (collected === null || collected > 0) return "Untested";
    if (valid !== null && valid < 0) return "Stale";
    return { pass: "Effective", pass_with_exceptions: "Exception", fail: "Failed" }[result] || "Untested";
  }
  // One failed test is not cancelled out by another that passed.
  function controlState(states) {
    for (const s of ["Failed", "Exception", "Effective", "Stale", "Untested"]) if (states.includes(s)) return s;
    return "No evidence";
  }
  // Satisfied only when a full-strength control is effective: two partial controls do not prove the whole requirement.
  function requirementStatus(maps, cstate) {
    if (!maps.length) return ["Unmapped", "No common control is mapped to this requirement."];
    const st = (m) => cstate[m[0]] || "No evidence";
    const failed = maps.filter((m) => st(m) === "Failed").map((m) => m[0]);
    if (failed.length) return ["Deficient", `Mapped control failed testing: ${failed.join(", ")}.`];
    const full = maps.filter((m) => m[3]);
    const best = full.length ? full.map(st).reduce((a, b) => (RANK[b] < RANK[a] ? b : a)) : null;
    if (best === "Effective") return ["Satisfied", ""];
    if (best === "Exception") return ["Satisfied with exceptions", "Best full-strength control passed with exceptions."];
    if (maps.some((m) => !m[3] && ["Effective", "Exception"].includes(st(m)))) {
      return ["Partial", "Only partial-strength controls are effective" + (full.length ? `; full-strength control(s) ${full.map((m) => m[0]).join(", ")} are ${best.toLowerCase()}` : "") + "."];
    }
    const states = maps.map(st);
    if (states.includes("Stale")) return ["Evidence stale", "Evidence for every mapped control is outside its validity window."];
    if (states.includes("Untested")) return ["Not tested", "Evidence exists but has not been tested yet."];
    return ["No evidence", "Mapped controls have no evidence in the register."];
  }
  const STATUSES = ["Satisfied", "Satisfied with exceptions", "Partial", "Deficient", "Evidence stale", "Not tested", "No evidence", "Unmapped", "Excluded"];

  // overrides: evidence id -> state, for what-if analysis
  function assess(data, overrides = {}) {
    const evState = {}, byControl = {};
    data.evidence.forEach(([id, , controls, result, collected, valid]) => {
      evState[id] = overrides[id] || evidenceState(collected, valid, result);
      controls.forEach((c) => { (byControl[c] ||= []).push(id); });
    });
    const cstate = {};
    const ids = new Set(data.controls.map((c) => c[0]).concat(Object.keys(byControl), data.mappings.map((m) => m[0])));
    ids.forEach((c) => { cstate[c] = controlState((byControl[c] || []).map((e) => evState[e])); });
    const mapsByReq = {};
    data.mappings.forEach((m) => { (mapsByReq[m[1] + "|" + m[2]] ||= []).push(m); });
    const results = {}, inScope = {};
    data.frameworks.forEach((fw) => {
      inScope[fw.key] = new Set();
      results[fw.key] = fw.reqs.map(([rid, title]) => {
        const maps = mapsByReq[fw.key + "|" + rid] || [];
        if (rid in fw.excluded) return { fw: fw.key, id: rid, title, status: "Excluded", maps, reason: fw.excluded[rid] };
        inScope[fw.key].add(rid);
        const [status, reason] = requirementStatus(maps, cstate);
        return { fw: fw.key, id: rid, title, status, maps, reason };
      });
    });
    const impacts = data.evidence.map(([id, , controls]) => {
      const reqs = {}; let total = 0;
      data.frameworks.forEach((fw) => {
        const set = new Set(data.mappings.filter((m) => m[1] === fw.key && controls.includes(m[0]) && inScope[fw.key].has(m[2])).map((m) => m[2]));
        if (set.size) { reqs[fw.key] = fw.reqs.map((r) => r[0]).filter((r) => set.has(r)); total += set.size; }
      });
      return { id, state: evState[id], reqs, total };
    });
    const summary = (key) => { const c = Object.fromEntries(STATUSES.map((s) => [s, 0])); results[key].forEach((r) => { c[r.status]++; }); return c; };
    const coverage = (key) => { const c = summary(key), denom = results[key].length - c.Excluded; return denom ? (100 * (c.Satisfied + c["Satisfied with exceptions"])) / denom : 0; };
    const used = impacts.filter((i) => ["Effective", "Exception"].includes(i.state) && i.total);
    return { evState, cstate, byControl, results, impacts, summary, coverage, ratio: used.length ? used.reduce((a, i) => a + i.total, 0) / used.length : 0 };
  }
  // Requirements in other frameworks that share a common control with this one.
  function equivalents(data, fw, rid) {
    const controls = new Set(data.mappings.filter((m) => m[1] === fw && m[2] === rid).map((m) => m[0])), out = {};
    data.mappings.forEach((m) => { if (controls.has(m[0]) && !(m[1] === fw && m[2] === rid)) (out[m[1]] ||= new Set()).add(m[2]); });
    return out;
  }
  return { evidenceState, controlState, requirementStatus, assess, equivalents, STATUSES };
})();

// ---------------------------------------------------------------- page
document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("tk-crosswalk")) return;
  const { esc, $, dims } = TK, D = TK_CROSSWALK;
  const FW = Object.fromEntries(D.frameworks.map((f) => [f.key, f]));
  const TITLE = {}; D.frameworks.forEach((f) => f.reqs.forEach(([id, t]) => { TITLE[f.key + "|" + id] = t; }));
  const CTL = Object.fromEntries(D.controls.map((c) => [c[0], { id: c[0], title: c[1], domain: c[2], owner: c[3], freq: c[4] }]));
  const EV = Object.fromEntries(D.evidence.map((e) => [e[0], { id: e[0], title: e[1], controls: e[2], valid: e[5] }]));
  const LABEL = { "Partial": "Partly covered", "Unmapped": "No control mapped", "Evidence stale": "Evidence out of date", "Stale": "Out of date",
    "Effective": "Passed", "Exception": "Passed with exceptions", "Untested": "Not tested" };
  const label = (s) => LABEL[s] || s;
  const CLS = { "Satisfied": "tk-b-low", "Satisfied with exceptions": "tk-b-med", "Partial": "tk-b-high", "Deficient": "tk-b-crit",
    "Effective": "tk-b-low", "Exception": "tk-b-med", "Failed": "tk-b-crit" };
  const pill = (s) => `<span class="tk-pill ${CLS[s] || "tk-b-none"} tk-t-pill">${esc(label(s))}</span>`;
  const PROOF = ["Evidence stale", "Not tested", "No evidence"], OK = ["Satisfied", "Satisfied with exceptions"];
  const isGap = (s) => !OK.includes(s) && s !== "Excluded";
  const EV_STATES = ["Effective", "Exception", "Failed", "Stale", "Untested"];
  const dateIn = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return TK.fmtDate(TK.iso(d)); };

  const base = TKC.assess(D);
  const st = { ovr: {}, fw: "", status: "gaps", q: "", open: null, all: false, control: D.controls[0][0], tfw: D.frameworks[0].key, treq: "" };
  let cur = base;
  const changed = () => Object.keys(st.ovr).length;

  function renderTop() {
    $("cw-meta").innerHTML = `<b>${esc(D.org)}</b> · sample data · as of ${TK.fmtDate(TK.iso(new Date()))}`;
    let ok = 0;
    D.frameworks.forEach((f) => { const c = cur.summary(f.key); ok += c.Satisfied + c["Satisfied with exceptions"]; });
    $("cw-headline").textContent = `${D.evidence.length} pieces of evidence satisfy ${ok} requirements across ${D.frameworks.length} frameworks. ` +
      `Each passing test supports ${cur.ratio.toFixed(1)} requirements on average.`;
    const n = (s) => Object.values(cur.evState).filter((x) => x === s).length;
    $("cw-headfoot").textContent = `Evidence: ${n("Effective")} passed, ${n("Exception")} passed with exceptions, ${n("Failed")} failed, ${n("Stale")} out of date, ${n("Untested")} not tested.`;
    $("cw-whatif-banner").hidden = !changed();
    $("cw-whatif-text").textContent = `What-if mode: you changed ${changed()} evidence result${changed() === 1 ? "" : "s"}. Every tab shows the effect.`;
  }

  function renderCoverage() {
    $("cw-tiles").innerHTML = D.frameworks.map((f) => {
      const c = cur.summary(f.key), total = cur.results[f.key].length - c.Excluded, cov = cur.coverage(f.key);
      const proof = PROOF.reduce((a, s) => a + c[s], 0);
      const seg = (cls, v, name) => (v ? `<i class="${cls}" data-w="${(v / total) * 100}" data-tip="${v} ${name}"></i>` : "");
      const delta = cov - base.coverage(f.key);
      return `<button type="button" class="tk-kpi" data-fw="${f.key}" aria-pressed="${st.fw === f.key}">
        <span class="tk-kpi__lab">${esc(f.name)}</span>
        <span class="tk-kpi__val tk-num">${cov.toFixed(0)}%</span>
        <span class="tk-stackbar">${seg("tk-b-low tk-t-solid", c.Satisfied, "satisfied")}${seg("tk-b-med tk-t-solid", c["Satisfied with exceptions"], "satisfied with exceptions")}${seg("tk-b-high tk-t-solid", c.Partial, "partly covered")}${seg("tk-b-crit tk-t-solid", c.Deficient, "deficient")}${seg("tk-st-proof", proof, "with no current proof")}${seg("tk-st-unmapped", c.Unmapped, "with no control mapped")}</span>
        <span class="tk-kpi__delta">${c.Satisfied + c["Satisfied with exceptions"]} of ${total} satisfied · ${c.Deficient} deficient${Math.abs(delta) > 0.05 ? ` · ${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(0)} pts` : ""}</span></button>`;
    }).join("");

    const q = st.q.toLowerCase();
    const rows = D.frameworks.filter((f) => !st.fw || f.key === st.fw).flatMap((f) => cur.results[f.key]).filter((r) =>
      r.status !== "Excluded" && (st.status === "all" || (st.status === "gaps" ? isGap(r.status) : st.status === "proof" ? PROOF.includes(r.status) : r.status === st.status))
      && (!q || (r.id + " " + r.title).toLowerCase().includes(q)));
    if (st.status === "gaps") {
      const order = (x) => (x === "Deficient" ? 0 : PROOF.includes(x) ? 1 : x === "Partial" ? 2 : 3);
      rows.sort((a, b) => order(a.status) - order(b.status));   // stable: catalog order within each group
    }
    st.rows = rows;
    $("cw-req-title").textContent = `${rows.length} requirement${rows.length === 1 ? "" : "s"}` + (st.fw ? " in " + FW[st.fw].name : "");
    const show = st.all ? rows : rows.slice(0, 40);
    $("cw-reqs").innerHTML = show.map((r) => {
      const key = r.fw + "|" + r.id, open = st.open === key;
      let h = `<tr class="${open ? "tk-open" : ""}"><td><button type="button" class="tk-rowbtn" data-req="${esc(key)}" aria-expanded="${open}"><b class="tk-num">${esc(r.id)}</b> ${esc(r.title)}
          ${st.fw ? "" : `<span class="tk-muted">· ${esc(FW[r.fw].name)}</span>`}</button></td>
        <td>${pill(r.status)}</td>
        <td><div class="tk-chiprow">${r.maps.map((m) => `<span class="tk-chip tk-chip--static ${m[3] ? "" : "tk-chip--partial"}" data-tip="${esc((CTL[m[0]] || {}).title || "Control not defined")}${m[3] ? "" : " (partial)"}">${esc(m[0])}</span>`).join("") || '<span class="tk-muted">None</span>'}</div></td>
        <td class="tk-muted">${esc(r.reason)}</td></tr>`;
      if (open) {
        h += `<tr class="tk-open"><td colspan="4">${r.maps.map((m) => {
          const c = CTL[m[0]], evs = cur.byControl[m[0]] || [];
          return `<p class="tk-issue">${pill(cur.cstate[m[0]])}<b>${esc(m[0])}</b><span>${esc(c ? c.title : "Control not defined")} (${m[3] ? "full" : "partial"} match)</span>
            <span class="tk-muted">${evs.length ? "Evidence: " + evs.map((e) => esc(e + " " + label(cur.evState[e]).toLowerCase())).join(", ") : "No evidence on file"}</span></p>`;
        }).join("") || '<p class="tk-muted">No control is mapped. Add one, or record why the requirement does not apply.</p>'}
          <p><button type="button" class="tk-link" data-translate="${esc(key)}">See counterparts in other frameworks</button></p></td></tr>`;
      }
      return h;
    }).join("") || '<tr><td colspan="4" class="tk-muted">Nothing matches these filters.</td></tr>';
    $("cw-req-more").innerHTML = rows.length > show.length ? `Showing 40 of ${rows.length}. <button type="button" class="tk-link" id="cw-showall">Show all</button>` : "";
  }

  const supported = (cid) => { const out = {}; D.mappings.forEach((m) => { if (m[0] === cid && TITLE[m[1] + "|" + m[2]] && !(m[2] in FW[m[1]].excluded)) (out[m[1]] ||= []).push(m); }); return out; };
  function renderControls() {
    const c = CTL[st.control], sup = supported(c.id), total = Object.values(sup).reduce((a, v) => a + v.length, 0), evs = cur.byControl[c.id] || [];
    $("cw-control-body").innerHTML = `<p class="tk-dec__ask">${esc(c.title)}</p>
      <div class="tk-tags">${pill(cur.cstate[c.id])}<span class="tk-tag">Owner: ${esc(c.owner || "not set")}</span><span class="tk-tag">${esc(c.freq || "No frequency set")}</span><span class="tk-tag">${esc(c.domain)}</span></div>
      <p>Test this once and it supports <b>${total}</b> requirement${total === 1 ? "" : "s"} in ${Object.keys(sup).length} framework${Object.keys(sup).length === 1 ? "" : "s"}.</p>
      ${evs.map((e) => `<p class="tk-issue">${pill(cur.evState[e])}<b>${esc(e)}</b><span>${esc(EV[e].title)}</span>${EV[e].valid === null ? "" : `<span class="tk-muted">valid until ${dateIn(EV[e].valid)}</span>`}</p>`).join("") || '<p class="tk-muted">No evidence on file for this control.</p>'}
      <div class="tk-cols">${D.frameworks.map((f) => `<div><h3>${esc(f.name)} <span class="tk-muted">${(sup[f.key] || []).length}</span></h3><div class="tk-chiprow">${(sup[f.key] || []).map((m) =>
        `<span class="tk-chip tk-chip--static ${m[3] ? "" : "tk-chip--partial"}" data-tip="${esc(TITLE[f.key + "|" + m[2]])}${m[3] ? "" : " (partial)"}">${esc(m[2])}</span>`).join("") || '<span class="tk-muted">None</span>'}</div></div>`).join("")}</div>
      <p class="tk-muted">Dashed chips are partial matches: they contribute but do not meet the requirement alone. Hover or focus a chip for its title.</p>`;
    const rank = D.controls.map((x) => [x[0], Object.values(supported(x[0])).reduce((a, v) => a + v.length, 0)]).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const max = Math.max(1, rank[0][1]);
    $("cw-control-rank").innerHTML = rank.map(([id, n]) => `<div class="tk-bar ${id === st.control ? "tk-bar--on" : ""}" data-tip="${esc(CTL[id].title)}">
      <button type="button" class="tk-link" data-control="${esc(id)}">${esc(id)}</button><span class="tk-bar__track"><i class="tk-s-b" data-w="${(n / max) * 100}"></i></span><span class="tk-num tk-muted">${n}</span></div>`).join("");
  }

  function renderTranslate() {
    const f = FW[st.tfw];
    if (!f.reqs.some((r) => r[0] === st.treq)) st.treq = (f.reqs.find((r) => D.mappings.some((m) => m[1] === f.key && m[2] === r[0])) || f.reqs[0])[0];
    $("cw-t-fw").innerHTML = D.frameworks.map((x) => `<option value="${x.key}"${x.key === st.tfw ? " selected" : ""}>${esc(x.name)}</option>`).join("");
    $("cw-t-req").innerHTML = f.reqs.map(([id, t]) => `<option value="${esc(id)}"${id === st.treq ? " selected" : ""}>${esc(id + " · " + t)}</option>`).join("");
    const res = cur.results[f.key].find((r) => r.id === st.treq), eq = TKC.equivalents(D, f.key, st.treq);
    const others = D.frameworks.filter((x) => x.key !== f.key);
    $("cw-translate-body").innerHTML = `<p class="tk-dec__ask"><span class="tk-num">${esc(st.treq)}</span> ${esc(TITLE[f.key + "|" + st.treq])}</p>
      <div class="tk-tags">${pill(res.status)}${res.maps.map((m) => `<span class="tk-tag" data-tip="${esc((CTL[m[0]] || {}).title || "")}">Met by ${esc(m[0])}${m[3] ? "" : " (partial)"}</span>`).join("")}</div>
      ${res.maps.length ? "" : '<p class="tk-muted">No control is mapped to this requirement, so it has no counterparts yet.</p>'}
      <div class="tk-cols">${others.map((x) => {
        const ids = x.reqs.map((r) => r[0]).filter((id) => eq[x.key] && eq[x.key].has(id));
        return `<div><h3>${esc(x.name)} <span class="tk-muted">${ids.length}</span></h3>${ids.map((id) => `<p class="tk-issue"><b class="tk-num">${esc(id)}</b><span class="tk-muted">${esc(TITLE[x.key + "|" + id])}</span></p>`).join("") || '<p class="tk-muted">No counterpart.</p>'}</div>`;
      }).join("")}</div>
      <p class="tk-muted">Counterparts share a control with this requirement. They are related, not identical: check the wording before relying on one for the other.</p>`;
  }

  function renderWhatIf() {
    const max = Math.max(1, ...cur.impacts.map((i) => i.total));
    $("cw-evidence").innerHTML = cur.impacts.map((i) => {
      const e = EV[i.id];
      return `<tr><td><b class="tk-num">${esc(i.id)}</b> ${esc(e.title)}</td><td class="tk-muted">${esc(e.controls.join(", "))}</td>
        <td><select id="cw-ev-${esc(i.id)}" data-ev="${esc(i.id)}" aria-label="Result of ${esc(i.id)}">${EV_STATES.map((s) => `<option value="${s}"${s === i.state ? " selected" : ""}>${label(s)}</option>`).join("")}</select>
          ${st.ovr[i.id] ? '<span class="tk-tag tk-tag--over">changed</span>' : ""}</td>
        <td><div class="tk-bar"><span class="tk-num">${i.total}</span><span class="tk-bar__track" data-tip="${Object.entries(i.reqs).map(([k, v]) => FW[k].name + ": " + v.length).join(" · ") || "Supports nothing in scope"}"><i class="tk-s-a" data-w="${(i.total / max) * 100}"></i></span><span></span></div></td></tr>`;
    }).join("");
    if (!changed()) { $("cw-impact").innerHTML = '<p class="tk-muted">Nothing changed yet. Set any result to Failed to see what it breaks.</p>'; return; }
    const diffs = D.frameworks.flatMap((f) => cur.results[f.key].map((r, i) => [r, base.results[f.key][i].status]).filter(([r, was]) => r.status !== was));
    $("cw-impact").innerHTML = `<div class="tk-tags">${D.frameworks.map((f) => `<span class="tk-tag">${esc(f.name)}: ${base.coverage(f.key).toFixed(0)}% → ${cur.coverage(f.key).toFixed(0)}%</span>`).join("")}</div>
      <p><b>${diffs.length}</b> requirement${diffs.length === 1 ? "" : "s"} changed status.</p>
      ${diffs.slice(0, 30).map(([r, was]) => `<p class="tk-issue"><b class="tk-num">${esc(r.id)}</b><span class="tk-muted">${esc(FW[r.fw].name)}</span>${pill(was)}<span>→</span>${pill(r.status)}</p>`).join("")}
      ${diffs.length > 30 ? `<p class="tk-muted">and ${diffs.length - 30} more.</p>` : ""}`;
  }
  function render() { cur = changed() ? TKC.assess(D, st.ovr) : base; renderTop(); renderCoverage(); renderControls(); renderTranslate(); renderWhatIf(); dims($("tk-crosswalk")); }

  // ---- events
  $("tk-crosswalk").addEventListener("click", (e) => {
    const t = e.target.closest("[data-fw],[data-req],[data-translate],[data-control],#cw-showall,#cw-reset");
    if (!t) return;
    if (t.dataset.fw) { st.fw = st.fw === t.dataset.fw ? "" : t.dataset.fw; $("cw-fw").value = st.fw; st.all = false; }
    else if (t.dataset.req) st.open = st.open === t.dataset.req ? null : t.dataset.req;
    else if (t.dataset.translate) { [st.tfw, st.treq] = t.dataset.translate.split("|"); location.hash = "#translate"; }
    else if (t.dataset.control) { st.control = t.dataset.control; $("cw-control").value = st.control; }
    else if (t.id === "cw-showall") st.all = true;
    else if (t.id === "cw-reset") st.ovr = {};
    render();
  });
  $("cw-fw").addEventListener("change", (e) => { st.fw = e.target.value; st.all = false; render(); });
  $("cw-status").addEventListener("change", (e) => { st.status = e.target.value; st.all = false; render(); });
  $("cw-q").addEventListener("input", (e) => { st.q = e.target.value; renderCoverage(); dims($("view-coverage")); });
  $("cw-control").addEventListener("change", (e) => { st.control = e.target.value; render(); });
  $("cw-t-fw").addEventListener("change", (e) => { st.tfw = e.target.value; st.treq = ""; render(); });
  $("cw-t-req").addEventListener("change", (e) => { st.treq = e.target.value; render(); });
  $("cw-evidence").addEventListener("change", (e) => {
    const id = e.target.dataset.ev;
    if (!id) return;
    if (e.target.value === base.evState[id]) delete st.ovr[id]; else st.ovr[id] = e.target.value;
    render();
  });
  $("cw-dl-status").addEventListener("click", () => TK.download("requirement-status.csv", TK.toCSV([["framework", "requirement_id", "requirement", "status", "controls", "why"]]
    .concat(st.rows.map((r) => [FW[r.fw].name, r.id, r.title, label(r.status), r.maps.map((m) => m[0] + (m[3] ? "" : " (partial)")).join("; "), r.reason])))));
  $("cw-dl-map").addEventListener("click", () => TK.download("control-crosswalk.csv", TK.toCSV([["control_id", "control", "framework", "requirement_id", "requirement", "strength"]]
    .concat(D.mappings.filter((m) => TITLE[m[1] + "|" + m[2]]).map((m) => [m[0], (CTL[m[0]] || {}).title || "", FW[m[1]].name, m[2], TITLE[m[1] + "|" + m[2]], m[3] ? "full" : "partial"])))));

  $("cw-fw").innerHTML = '<option value="">All frameworks</option>' + D.frameworks.map((f) => `<option value="${f.key}">${esc(f.name)}</option>`).join("");
  const domains = [...new Set(D.controls.map((c) => c[2]))];
  $("cw-control").innerHTML = domains.map((d) => `<optgroup label="${esc(d)}">${D.controls.filter((c) => c[2] === d).map((c) => `<option value="${esc(c[0])}">${esc(c[0] + " · " + c[1])}</option>`).join("")}</optgroup>`).join("");
  st.control = D.controls.map((x) => [x[0], Object.values(supported(x[0])).reduce((a, v) => a + v.length, 0)]).sort((a, b) => b[1] - a[1])[0][0];
  $("cw-control").value = st.control;
  TK.tips(); TK.tabs(["coverage", "controls", "translate", "what-if"]); render();
});
