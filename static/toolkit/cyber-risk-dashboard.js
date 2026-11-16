// Cyber Risk Register & Executive Dashboard. Runs in the browser; the register is kept in
// this browser's storage only and is never sent anywhere.
"use strict";
document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("tk-risk")) return;
  const { esc, $, dims, fmtDate, iso, day } = TK;
  const CATS = ["Resilience", "Third party", "Data protection", "Compliance", "Technology", "Identity & fraud", "People"];
  const L_LABEL = { 5: "Almost certain", 4: "Likely", 3: "Possible", 2: "Unlikely", 1: "Rare" };
  const I_LABEL = { 1: "Minor", 2: "Moderate", 3: "Significant", 4: "Major", 5: "Severe" };
  const BAND = { crit: "Critical", high: "High", med: "Medium", low: "Low" };
  const TODAY = day(iso(new Date()));
  const plus = (n) => { const d = new Date(TODAY); d.setDate(d.getDate() + n); return iso(d); };

  // Fictional lender. Dates are set relative to today so the sample always tells the same story.
  const sample = () => ({
    org: "Northgate Lending (sample data)", appetite: 10, history: [9, 8, 8, 7],
    risks: [
      ["R-01", "Ransomware halts loan servicing for days", "Resilience", "CISO", 4, 5, 3, 5, 15, 6.2, "Tamper-proof backups and a tested restore of core servicing", 55, 78, "Customers cannot make payments or get payouts; recovery could take a week or more.", "Approve $420K for tamper-proof backups and a quarterly restore test", "$420K one-time", 26],
      ["R-02", "Loan origination vendor goes down with no fallback", "Third party", "COO", 4, 4, 4, 4, 12, 4.8, "Agree an exit plan and line up a secondary provider", 20, -14, "New lending stops while the vendor is out. Two outages this year already.", "Fund a secondary provider or formally accept the risk", "$310K per year", 16],
      ["R-03", "Customer data stolen through a phished staff account", "Data protection", "CISO", 5, 4, 3, 4, 16, 5.5, "Phishing-resistant sign-in for all staff", 80, 31, "Breach notification to customers and the regulator, plus remediation costs."],
      ["R-04", "Card data stored outside the secured environment", "Compliance", "CFO", 3, 5, 2, 5, 10, 2.1, "Scan file shares and remove stored card numbers", 65, 36, "A PCI DSS failure and possible fines from card brands."],
      ["R-05", "Internet-facing systems left unpatched", "Technology", "CIO", 4, 4, 3, 4, 12, 1.9, "Fix critical flaws within 14 days", 40, -13, "Known flaws give attackers the easiest way in."],
      ["R-06", "Administrator access not reviewed", "Identity & fraud", "CIO", 4, 4, 2, 4, 12, 0.9, "Quarterly review of powerful accounts", 90, 16, "Former staff or contractors may still hold powerful access."],
      ["R-07", "Regulator finds gaps in vendor oversight (OSFI B-10)", "Compliance", "CRO", 3, 4, 3, 4, 9, 1.5, "Finish assessments of all critical vendors", 35, 106, "A supervisory finding and a mandated remediation programme.", "Name one executive owner for third-party risk", "No cost", 17],
      ["R-08", "Customer accounts taken over on the portal", "Identity & fraud", "Head of Fraud", 4, 4, 3, 3, 9, 1.2, "Step-up checks on payout changes", 70, 47, "Fraud losses and customer reimbursement."],
      ["R-09", "Staff misuse customer records", "Data protection", "CHRO", 3, 4, 2, 4, 8, 0.8, "Access logging and alerts on bulk lookups", 60, 62, "Privacy complaints and regulator attention."],
      ["R-10", "Cloud storage set up wrongly exposes data", "Technology", "CIO", 4, 4, 2, 4, 12, 2.4, "Automated checks on every cloud change", 85, 14, "Data visible on the internet until someone notices."],
      ["R-11", "Staff paste customer data into unapproved AI tools", "Data protection", "CISO", 4, 3, 4, 3, 6, 1.1, "AI use policy and a list of approved tools", 15, 47, "Customer data leaves our control with no record of where it went."],
      ["R-12", "Branch recovery plans never tested", "Resilience", "COO", 3, 4, 3, 3, 9, 0.7, "Run a recovery exercise at two branches", 50, 137, "Branches may stay closed longer than planned after an outage."],
      ["R-13", "Customer portal knocked offline by traffic flood", "Technology", "CIO", 3, 3, 2, 2, 4, 0.3, "Protection service in place", 100, -45, "Short outage of online payments."],
      ["R-14", "Key security staff leave", "People", "CISO", 3, 3, 3, 2, 6, 0.4, "Cross-training and documented procedures", 30, 137, "Slower response to incidents for several months."],
      ["R-15", "Laptop lost or stolen", "Technology", "CIO", 3, 2, 1, 2, 2, 0.1, "Disk encryption on all laptops", 100, -137, "Minor: devices are encrypted."],
      ["R-16", "Money-laundering checks miss cases after system change", "Compliance", "CAMLO", 3, 5, 2, 4, 8, 1.8, "Re-test monitoring rules after the migration", 75, 28, "Missed reports to FINTRAC and possible penalties."],
    ].map(([id, title, cat, owner, iL, iI, L, I, prev, exp, plan, prog, dueIn, means, ask, cost, byIn]) =>
      ({ id, title, cat, owner, iL, iI, L, I, prev, exp, plan, prog, due: plus(dueIn), means, ask: ask || "", cost: cost || "", by: ask ? plus(byIn) : "" })),
  });

  const db = TK.store("mshshuvo:toolkit:risk-register:v1");
  let data = db.get() || sample();
  const st = { mode: "res", cell: null, open: null, all: false, q: "", cat: "", sort: "score", dir: -1 };
  const save = () => db.set(data);

  const clamp = (v, lo, hi, dflt) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; };
  const score = (r) => r.L * r.I;
  const shown = (r) => (st.mode === "res" ? [r.L, r.I] : [r.iL, r.iI]);
  const band = (s) => (s >= 16 ? "crit" : s >= 10 ? "high" : s >= 5 ? "med" : "low");
  const above = (r) => score(r) >= data.appetite;
  const overdue = (r) => r.prog < 100 && r.due && day(r.due) < TODAY;
  const money = (m) => "$" + (m >= 10 ? m.toFixed(0) : m.toFixed(1)) + "M";
  const trendOf = (r) => { const d = score(r) - (r.prev || score(r)); return d > 0 ? ["↑", "Getting worse"] : d < 0 ? ["↓", "Improving"] : ["→", "No change"]; };
  const cats = () => [...new Set(CATS.concat(data.risks.map((r) => r.cat).filter(Boolean)))];
  const pill = (b) => TK.html`<span class="tk-pill tk-b-${b} tk-t-pill">${BAND[b]}</span>`;

  // Last four quarter labels, oldest first, then the current one.
  function quarters() {
    const out = []; let q = Math.floor(TODAY.getMonth() / 3), y = TODAY.getFullYear();
    for (let i = 0; i < 5; i++) { out.unshift([q + 1, y]); q--; if (q < 0) { q = 3; y--; } }
    return out;
  }

  function renderExec() {
    const risks = data.risks;
    const ab = risks.filter(above), crit = risks.filter((r) => score(r) >= 16), od = risks.filter(overdue);
    const decs = risks.filter((r) => r.ask);
    const prevAb = risks.filter((r) => (r.prev || score(r)) >= data.appetite).length;
    const exp = ab.reduce((a, r) => a + (Number(r.exp) || 0), 0);
    const diff = ab.length - prevAb;
    const qs = quarters(), now = qs[4];
    $("rd-meta").innerHTML = TK.html`<b>${esc(data.org || "Your organisation")}</b> · Q${now[0]} ${now[1]} · as of ${fmtDate(iso(TODAY))}`;

    if (!risks.length) {
      $("rd-headline").textContent = "The register is empty. Add your first risk in the Risk register tab.";
      $("rd-headfoot").textContent = "";
    } else {
      const move = diff === 0 ? "the same number as last quarter" : Math.abs(diff) + (diff > 0 ? " more" : " fewer") + " than last quarter";
      $("rd-headline").textContent =
        `${ab.length} of ${risks.length} cyber risks are higher than the board is willing to accept, ${move}. ` +
        (decs.length ? `${decs.length} need${decs.length === 1 ? "s" : ""} a decision from you this quarter.` : "None need a decision from you this quarter.");
      $("rd-headfoot").textContent =
        `Estimated loss if the risks above appetite happened: about ${money(exp)}. ` +
        `${od.length} action plan${od.length === 1 ? " is" : "s are"} past due.`;
    }

    const k = (cls, lab, val, delta) => TK.html`<div class="tk-kpi tk-kpi--${cls}"><span class="tk-kpi__lab">${lab}</span><span class="tk-kpi__val tk-num">${val}</span><span class="tk-kpi__delta">${delta}</span></div>`;
    $("rd-kpis").innerHTML = TK.html`${k(ab.length ? "watch" : "calm", "Above appetite", ab.length, diff === 0 ? "Same as last quarter" : (diff > 0 ? "▲ " : "▼ ") + Math.abs(diff) + " vs last quarter")}${
      k(crit.length ? "alert" : "calm", "Critical", crit.length, crit.length ? crit[0].title + (crit.length > 1 ? ` and ${crit.length - 1} more` : "") : "None right now")}${
      k(od.length ? "alert" : "calm", "Plans past due", od.length, od.length ? od.map((r) => r.id).join(", ") : "All plans on schedule")}${
      k("plain", "Potential loss", money(exp), "Estimate, risks above appetite")}`;

    let h = "";
    for (let l = 5; l >= 1; l--) {
      h = TK.html`${h}${TK.html`<div class="tk-ax tk-ax--y"><b>${l}</b>&nbsp;${L_LABEL[l]}</div>`}`;
      for (let i = 1; i <= 5; i++) {
        const n = risks.filter((r) => { const [a, b] = shown(r); return a === l && b === i; }).length;
        const b = band(l * i), key = l + "-" + i;
        h = TK.html`${h}${n
          ? TK.html`<button type="button" class="tk-cell tk-b-${b} tk-t-full" data-cell="${key}" aria-pressed="${st.cell === key}"
               aria-label="${n} risk${n > 1 ? "s" : ""}, likelihood ${L_LABEL[l]}, impact ${I_LABEL[i]}"
               data-tip="${n} risk${n > 1 ? "s" : ""} · ${BAND[b]} · ${L_LABEL[l]} × ${I_LABEL[i]}">${n}</button>`
          : TK.html`<div class="tk-cell tk-cell--empty tk-b-${b} tk-t-empty" aria-hidden="true"></div>`}`;
      }
    }
    h = TK.html`${h}${TK.html`${TK.html`<div class="tk-ax tk-ax--y"><b>↑</b>&nbsp;Likelihood</div>`}${[1, 2, 3, 4, 5].map((i) => TK.html`<div class="tk-ax">${I_LABEL[i]}</div>`)}`}`;
    $("rd-heat").innerHTML = TK.html`${h}`;

    $("rd-decisions").innerHTML = TK.html`${decs.length ? decs.slice().sort((a, b) => (a.by || "9").localeCompare(b.by || "9")).map((r) => {
      const late = r.by && day(r.by) < TODAY;
      return TK.html`<div class="tk-dec"><p class="tk-dec__ask">${esc(r.ask)}</p>
        <p class="tk-dec__why">${esc(r.title)}. ${esc(r.means)}</p>
        <div class="tk-tags">${pill(band(score(r)))}${r.cost ? TK.html`<span class="tk-tag">${esc(r.cost)}</span>` : ""}
        ${r.by ? TK.html`<span class="tk-tag ${late ? "tk-tag--over" : ""}">Decide by ${fmtDate(r.by)}</span>` : ""}<span class="tk-tag">Owner: ${esc(r.owner || "not set")}</span></div></div>`;
    }) : TK.html`<p class="tk-muted">Nothing is waiting on you.</p>`}`;

    let list = risks.slice().sort((a, b) => score(b) - score(a) || (b.exp || 0) - (a.exp || 0));
    if (st.cell) {
      const [l, i] = st.cell.split("-").map(Number);
      list = risks.filter((r) => { const [a, b] = shown(r); return a === l && b === i; });
      $("rd-risks-title").textContent = `Risks rated ${L_LABEL[l]} × ${I_LABEL[i]}`;
      $("rd-filternote").innerHTML = TK.html`<button type="button" class="tk-link" id="rd-clearcell">Show top risks</button>`;
    } else {
      $("rd-risks-title").textContent = st.all ? "All risks" : "Top risks";
      $("rd-filternote").innerHTML = TK.html`${risks.length > 6 ? TK.html`<button type="button" class="tk-link" id="rd-toggleall">${st.all ? "Show top 6 only" : "Show all " + risks.length}</button>` : ""}`;
      if (!st.all) list = list.slice(0, 6);
    }
    $("rd-risks").innerHTML = TK.html`${TK.join(list.map((r) => {
      const s = score(r), b = band(s), [arrow, word] = trendOf(r), open = st.open === r.id;
      return TK.html`<div class="tk-risk"><button type="button" aria-expanded="${open}" data-open="${esc(r.id)}">
        <span class="tk-b-${b} tk-t-solid"></span>
        <span class="tk-risk__main"><span class="tk-risk__title">${esc(r.title)}</span>
          <span class="tk-tags">${pill(b)}<span>${esc(r.cat)}</span><span>Owner: ${esc(r.owner || "not set")}</span><span>${arrow} ${word}</span>
          ${overdue(r) ? TK.html`<span class="tk-tag tk-tag--over">Plan past due</span>` : ""}${above(r) ? "" : TK.html`<span class="tk-tag">Within appetite</span>`}</span></span>
        <span class="tk-risk__side"><span class="tk-score tk-num">${s}</span><span>of 25</span></span></button>
        ${open ? TK.html`<dl class="tk-detail">
          <div><dt>What it means</dt><dd>${esc(r.means || "Not described yet.")}</dd></div>
          <div><dt>What we are doing</dt><dd>${esc(r.plan || "No plan recorded.")}<div class="tk-prog" role="img" aria-label="${r.prog}% complete"><i data-w="${r.prog}"></i></div>
            <span class="tk-muted">${r.prog}% done${r.due ? " · due " + fmtDate(r.due) : ""}</span></dd></div>
          <div><dt>Numbers</dt><dd>Without controls: ${r.iL * r.iI} · With controls: ${s} · Last quarter: ${r.prev || s}<br>Potential loss: about ${money(Number(r.exp) || 0)}</dd></div>
        </dl>` : ""}</div>`;
    })) || TK.html`<p class="tk-muted">No risks here.</p>`}`;

    const perCat = cats().map((c) => [c, risks.filter((r) => r.cat === c)]).filter((x) => x[1].length);
    const max = Math.max(1, ...perCat.map((x) => x[1].length));
    $("rd-bars").innerHTML = TK.html`${TK.join(perCat.map(([c, all]) => {
      const a = all.filter(above).length, w = all.length - a;
      return TK.html`<div class="tk-bar"><span>${esc(c)}</span><span class="tk-bar__track" data-tip="${esc(c)}: ${a} above appetite, ${w} within">
        ${a ? TK.html`<i class="tk-s-a" data-w="${(a / max) * 100}"></i>` : ""}${w ? TK.html`<i class="tk-s-b" data-w="${(w / max) * 100}"></i>` : ""}</span>
        <span class="tk-num tk-muted">${a}</span></div>`;
    })) || TK.html`<p class="tk-muted">No risks yet.</p>`}`;

    const series = data.history.map((v, i) => [`Q${qs[i][0]} ${String(qs[i][1]).slice(2)}`, v]).concat([["Now", ab.length]]);
    const tmax = Math.max(1, ...series.map((x) => x[1]));
    $("rd-trend").innerHTML = TK.html`${series.map((x, i) =>
      TK.html`<div class="tk-trend__col ${i === 4 ? "tk-trend__col--now" : ""}" data-tip="${x[0]}: ${x[1]} above appetite"><span class="tk-trend__v tk-num">${x[1]}</span><span class="tk-trend__bar" data-h="${(x[1] / tmax) * 78}"></span></div>`)}`;
    $("rd-trendx").innerHTML = TK.html`${series.map((x) => TK.html`<span>${x[0]}</span>`)}`;
    dims($("view-executive"));
  }

  const opts = (n) => [1, 2, 3, 4, 5].map((v) => TK.html`<option${v === n ? " selected" : ""}>${v}</option>`);
  function renderRegister() {
    const q = st.q.toLowerCase();
    const list = data.risks.filter((r) => (!st.cat || r.cat === st.cat) && (!q || (r.title + " " + r.owner + " " + r.id).toLowerCase().includes(q)));
    const val = (r) => (st.sort === "score" ? score(r) : String(r[st.sort] ?? "").toLowerCase());
    list.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * st.dir);
    $("rd-rows").innerHTML = TK.html`${TK.join(list.map((r) => {
      const s = score(r), b = band(s), id = esc(r.id);
      return TK.html`<tr><td class="tk-num">${id}</td><td>${esc(r.title)}</td><td>${esc(r.cat)}</td><td>${esc(r.owner)}</td>
        <td><select id="rd-L-${id}" data-edit="L" data-id="${id}" aria-label="Likelihood for ${id}">${opts(r.L)}</select></td>
        <td><select id="rd-I-${id}" data-edit="I" data-id="${id}" aria-label="Impact for ${id}">${opts(r.I)}</select></td>
        <td><span class="tk-pill tk-b-${b} tk-t-pill"><span class="tk-num">${s}</span> ${BAND[b]}</span></td>
        <td><div class="tk-prog"><i data-w="${r.prog}"></i></div><span class="tk-muted">${r.prog}%</span></td>
        <td class="tk-num">${r.due ? fmtDate(r.due) : ""}${overdue(r) ? TK.html` <span class="tk-tag tk-tag--over">Past due</span>` : ""}</td>
        <td><button type="button" class="tk-link" data-editrow="${id}">Edit</button> · <button type="button" class="tk-link" data-del="${id}" aria-label="Remove ${id}">Remove</button></td></tr>`;
    })) || TK.html`<tr><td colspan="10" class="tk-muted">No risks match. Add one, or import a register.</td></tr>`}`;
    dims($("rd-rows"));
    const c = cats();
    $("rd-fcat").innerHTML = TK.html`${TK.html`<option value="">All areas</option>`}${c.map((x) => TK.html`<option${x === st.cat ? " selected" : ""}>${esc(x)}</option>`)}`;
    $("rd-cats").innerHTML = TK.html`${c.map((x) => TK.html`<option value="${esc(x)}">`)}`;
  }
  function renderSettings() {
    $("rd-org").value = data.org || "";
    $("rd-appetite").value = String(data.appetite);
    const qs = quarters();
    data.history.forEach((v, i) => { $("rd-h" + i).value = v; $("rd-hl" + i).textContent = `Q${qs[i][0]} ${qs[i][1]}`; });
  }
  const render = () => { renderExec(); renderRegister(); };

  // ---- editor
  const FIELDS = ["title", "means", "cat", "owner", "iL", "iI", "L", "I", "prev", "exp", "plan", "prog", "due", "ask", "cost", "by"];
  function openEditor(r) {
    $("rd-editor").hidden = false;
    $("rd-editor-title").textContent = r ? "Edit " + r.id : "Add a risk";
    $("f-id").value = r ? r.id : "";
    const base = r || { title: "", means: "", cat: "", owner: "", iL: 3, iI: 3, L: 3, I: 3, prev: "", exp: "", plan: "", prog: 0, due: "", ask: "", cost: "", by: "" };
    ["iL", "iI", "L", "I"].forEach((f) => { $("f-" + f).innerHTML = TK.html`${opts(Number(base[f]))}`; });
    FIELDS.forEach((f) => { if (!["iL", "iI", "L", "I"].includes(f)) $("f-" + f).value = base[f] ?? ""; });
    $("rd-form-err").hidden = true;
    $("rd-editor").scrollIntoView({ block: "nearest" });
    $("f-title").focus();
  }
  function nextId() {
    const n = Math.max(0, ...data.risks.map((r) => Number(String(r.id).replace(/\D/g, "")) || 0)) + 1;
    return "R-" + String(n).padStart(2, "0");
  }
  function clean(raw, id) {
    const L = clamp(raw.L, 1, 5, 3), I = clamp(raw.I, 1, 5, 3);
    return {
      id, title: String(raw.title || "").trim().slice(0, 140), means: String(raw.means || "").trim().slice(0, 240),
      cat: String(raw.cat || "").trim().slice(0, 40) || "Other", owner: String(raw.owner || "").trim().slice(0, 60),
      iL: clamp(raw.iL, 1, 5, L), iI: clamp(raw.iI, 1, 5, I), L, I, prev: clamp(raw.prev, 1, 25, L * I),
      exp: Math.max(0, Number(raw.exp) || 0), plan: String(raw.plan || "").trim().slice(0, 200), prog: clamp(raw.prog, 0, 100, 0),
      due: /^\d{4}-\d{2}-\d{2}$/.test(raw.due || "") ? raw.due : "", ask: String(raw.ask || "").trim().slice(0, 160),
      cost: String(raw.cost || "").trim().slice(0, 40), by: /^\d{4}-\d{2}-\d{2}$/.test(raw.by || "") ? raw.by : "",
    };
  }
  $("rd-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = Object.fromEntries(FIELDS.map((f) => [f, $("f-" + f).value]));
    if (!raw.title.trim()) { $("rd-form-err").hidden = false; return; }
    const id = $("f-id").value, r = clean(raw, id || nextId());
    const at = data.risks.findIndex((x) => x.id === id);
    if (at >= 0) data.risks[at] = r; else data.risks.push(r);
    save(); $("rd-editor").hidden = true; render();
    $("rd-msg").textContent = `Saved ${r.id}.`;
  });
  $("rd-cancel").addEventListener("click", () => { $("rd-editor").hidden = true; });
  $("rd-new").addEventListener("click", () => openEditor(null));

  // ---- import / export
  const COLS = [["id", "id"], ["risk", "title"], ["area", "cat"], ["owner", "owner"], ["inherent_likelihood", "iL"], ["inherent_impact", "iI"],
    ["likelihood", "L"], ["impact", "I"], ["last_quarter_score", "prev"], ["potential_loss_millions", "exp"], ["plan", "plan"],
    ["progress_percent", "prog"], ["due", "due"], ["what_it_means", "means"], ["decision_ask", "ask"], ["decision_cost", "cost"], ["decision_by", "by"]];
  $("rd-export").addEventListener("click", () => {
    TK.download("cyber-risk-register.csv", TK.toCSV([COLS.map((c) => c[0])].concat(data.risks.map((r) => COLS.map((c) => r[c[1]])))));
    $("rd-msg").textContent = "Register downloaded. Edit it in Excel and import it back any time.";
  });
  $("rd-file").addEventListener("change", (e) => TK.readFile(e.target, (text, name, err) => {
    if (err) { $("rd-msg").textContent = err; return; }
    const t = TK.parseTable(text), msg = $("rd-msg");
    if (!t.headers.map((h) => h.toLowerCase()).includes("risk")) { msg.textContent = 'That file has no "risk" column. Download the register once to get the expected columns.'; return; }
    const seen = new Set(), out = [];
    t.rows.forEach((row) => {
      if (!row.risk) return;
      const raw = Object.fromEntries(COLS.map((c) => [c[1], row[c[0]] ?? ""]));
      let id = String(raw.id || "").trim().slice(0, 12);
      if (!id || seen.has(id)) id = "R-" + String(out.length + 1).padStart(2, "0") + (seen.has("R-" + String(out.length + 1).padStart(2, "0")) ? "b" : "");
      seen.add(id); out.push(clean(raw, id));
    });
    if (!out.length) { msg.textContent = "No risks found in that file."; return; }
    data.risks = out; save(); st.cell = st.open = null; render();
    msg.textContent = `Imported ${out.length} risk${out.length === 1 ? "" : "s"}. They replaced the previous register.`;
  }));
  $("rd-blank").addEventListener("click", () => {
    data = { org: "", appetite: data.appetite, history: [0, 0, 0, 0], risks: [] }; save(); st.cell = st.open = null; render(); renderSettings();
    $("rd-msg").textContent = "Register cleared. Add a risk or import a CSV.";
  });
  $("rd-reset").addEventListener("click", () => {
    data = sample(); save(); st.cell = st.open = null; render(); renderSettings();
    $("rd-msg").textContent = "Sample data loaded.";
  });
  $("rd-print").addEventListener("click", () => { try { window.print(); } catch (e) { /* printing blocked in this viewer */ } });

  // ---- events
  document.getElementById("tk-risk").addEventListener("click", (e) => {
    const t = e.target.closest("[data-cell],[data-open],[data-del],[data-editrow],[data-sort],#rd-clearcell,#rd-toggleall");
    if (!t) return;
    if (t.dataset.cell) { st.cell = st.cell === t.dataset.cell ? null : t.dataset.cell; st.open = null; }
    else if (t.dataset.open) st.open = st.open === t.dataset.open ? null : t.dataset.open;
    else if (t.dataset.del) { data.risks = data.risks.filter((r) => r.id !== t.dataset.del); save(); $("rd-msg").textContent = `Removed ${t.dataset.del}.`; }
    else if (t.dataset.editrow) { openEditor(data.risks.find((r) => r.id === t.dataset.editrow)); return; }
    else if (t.dataset.sort) { st.dir = st.sort === t.dataset.sort ? -st.dir : 1; st.sort = t.dataset.sort; }
    else if (t.id === "rd-clearcell") st.cell = null;
    else if (t.id === "rd-toggleall") st.all = !st.all;
    render();
  });
  $("rd-rows").addEventListener("change", (e) => {
    const t = e.target;
    if (!t.dataset.edit) return;
    const r = data.risks.find((x) => x.id === t.dataset.id);
    if (r) { r[t.dataset.edit] = clamp(t.value, 1, 5, 3); save(); render(); }
  });
  [["rd-seg-res", "res"], ["rd-seg-inh", "inh"]].forEach(([id, mode]) => $(id).addEventListener("click", () => {
    st.mode = mode; st.cell = null;
    $("rd-seg-res").setAttribute("aria-pressed", String(mode === "res"));
    $("rd-seg-inh").setAttribute("aria-pressed", String(mode === "inh"));
    renderExec();
  }));
  $("rd-q").addEventListener("input", (e) => { st.q = e.target.value; renderRegister(); });
  $("rd-fcat").addEventListener("change", (e) => { st.cat = e.target.value; renderRegister(); });
  $("rd-org").addEventListener("input", (e) => { data.org = e.target.value.slice(0, 60); save(); renderExec(); });
  $("rd-appetite").addEventListener("change", (e) => { data.appetite = Number(e.target.value); save(); render(); });
  [0, 1, 2, 3].forEach((i) => $("rd-h" + i).addEventListener("input", (e) => { data.history[i] = clamp(e.target.value, 0, 999, 0); save(); renderExec(); }));

  TK.tips(); TK.tabs(["executive", "register"]); renderSettings(); render();
});
