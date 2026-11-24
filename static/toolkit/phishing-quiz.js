// "Real or Phish?" phishing awareness quiz. Shows realistic (fictional) emails one at a time; the player
// decides whether each is genuine or a phish, can reveal where links really go, and gets the tell-tale
// signs explained after each answer. Runs in the browser; only the best score is kept, on this device.
"use strict";

// ---------------------------------------------------------------- engine (no page access)
const TKQ = (() => {
  const ROUND = 10, PHISH_IN_ROUND = 6;

  function shuffle(list, rnd = Math.random) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  // A round: 6 phish and 4 real emails, in random order, no repeats.
  function pick(bank, rnd = Math.random) {
    const phish = shuffle(bank.filter((q) => q.kind === "phish"), rnd).slice(0, PHISH_IN_ROUND);
    const real = shuffle(bank.filter((q) => q.kind === "real"), rnd).slice(0, ROUND - phish.length);
    return shuffle([...phish, ...real], rnd);
  }
  function grade(score, total) {
    const pct = total ? score / total : 0;
    if (pct === 1) return { band: "Phish-proof", note: "A perfect round. You check the details scammers count on people skipping." };
    if (pct >= 0.8) return { band: "Sharp eye", note: "Very good. Review the ones you missed: they're the tricks that catch careful people." };
    if (pct >= 0.6) return { band: "Getting there", note: "Decent, but a few would have got through. The six signs below are worth a minute." };
    return { band: "Worth a refresher", note: "Phishing is designed to look normal. The six signs below will make the next round much easier." };
  }
  function shareText(score, total) {
    return `I scored ${score}/${total} on "Real or Phish?", a free phishing awareness quiz. Can you beat it? https://mshshuvo.com/toolkit/phishing-quiz`;
  }
  // Domain that really owns an address or URL host, for the "where it goes" reveal.
  function host(href) {
    try { return new URL(href).hostname; } catch (e) { return ""; }
  }
  // Deterministic QR-like pattern (decoration only; it encodes nothing).
  function qrCells(seed, size = 21) {
    let h = 2166136261;
    for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    const cells = [];
    const finder = (x, y) => [[0, 0], [size - 7, 0], [0, size - 7]].some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
    const finderOn = (x, y) => {
      for (const [fx, fy] of [[0, 0], [size - 7, 0], [0, size - 7]]) {
        const dx = x - fx, dy = y - fy;
        if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
      }
      return false;
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let on;
        if (finder(x, y)) on = finderOn(x, y);
        else { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; on = (h >>> 0) % 100 < 48; }
        if (on) cells.push([x, y]);
      }
    }
    return cells;
  }
  return { ROUND, pick, shuffle, grade, shareText, host, qrCells };
})();

// ---------------------------------------------------------------- page
document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("tk-quiz")) return;
  const { $ } = TK;
  const html = TK.html;
  const db = TK.store("mshshuvo:toolkit:phishing-quiz:v1");  // best score and rounds played only
  const saved = db.get() || {};
  const state = { best: Number.isInteger(saved.best) ? Math.min(Math.max(saved.best, 0), TKQ.ROUND) : null, played: Number.isInteger(saved.played) ? Math.max(saved.played, 0) : 0 };
  let round = [], i = 0, answers = [], revealed = new Set();

  const show = (id) => ["pq-intro", "pq-play", "pq-end"].forEach((v) => { $(v).hidden = v !== id; });
  const bestText = () => (state.best === null ? "" : `Your best: ${state.best}/${TKQ.ROUND} over ${state.played} round${state.played === 1 ? "" : "s"}.`);

  function qr(href) {
    const cells = TKQ.qrCells(href);
    return html`<svg class="pq-qr" viewBox="-1 -1 23 23" role="img" aria-label="QR code image"><rect x="-1" y="-1" width="23" height="23" class="pq-qr__bg"/>${cells.map(([x, y]) => html`<rect x="${x}" y="${y}" width="1" height="1"/>`)}</svg>`;
  }
  function bodyItem(b, k) {
    if (typeof b === "string") return html`<p>${b}</p>`;
    if (b.link) {
      return html`<p><button type="button" class="pq-link" data-k="${k}" aria-expanded="${revealed.has(k)}">${b.link}</button></p>
        <p class="pq-reveal" ${revealed.has(k) ? "" : "hidden"} id="pq-rev-${k}">This link really goes to <span class="tk-code">${b.href}</span>
        (owned by <b>${TKQ.host(b.href).split(".").slice(-2).join(".")}</b>)</p>`;
    }
    if (b.qr) {
      return html`<div class="pq-qrwrap">${qr(b.qr)}<button type="button" class="pq-link" data-k="${k}" aria-expanded="${revealed.has(k)}">What's in this QR code?</button></div>
        <p class="pq-reveal" ${revealed.has(k) ? "" : "hidden"} id="pq-rev-${k}">Scanned, it opens <span class="tk-code">${b.qr}</span></p>`;
    }
    return "";
  }
  function mail(q) {
    return html`<article class="pq-mail" aria-label="Email ${i + 1} of ${round.length}">
      <dl class="pq-mail__head">
        <dt>From</dt><dd><b>${q.from}</b> <span class="pq-addr">&lt;${q.addr}&gt;</span></dd>
        ${q.replyTo ? html`<dt>Reply-To</dt><dd><span class="pq-addr">${q.replyTo}</span></dd>` : ""}
        <dt>To</dt><dd>Sam Taylor <span class="pq-addr">&lt;sam.taylor@northgate.example&gt;</span></dd>
        <dt>Subject</dt><dd><b>${q.subject}</b></dd>
      </dl>
      ${q.attach ? html`<div class="pq-attach">${q.attach.map((a) => html`<span class="pq-file">📎 ${a}</span>`)}</div>` : ""}
      <div class="pq-mail__body">${q.body.map((b, k) => bodyItem(b, `${i}-${k}`))}</div>
    </article>`;
  }

  function renderQuestion() {
    const q = round[i];
    const a = answers[i];
    $("pq-progress").textContent = `Email ${i + 1} of ${round.length}`;
    $("pq-score").textContent = `Score: ${answers.filter((x) => x && x.correct).length}`;
    $("pq-bar").value = i + (a ? 1 : 0);
    $("pq-mailbox").innerHTML = html`${mail(q)}`;
    const done = !!a;
    $("pq-real").disabled = done;
    $("pq-phish").disabled = done;
    $("pq-real").setAttribute("aria-pressed", String(done && a.choice === "real"));
    $("pq-phish").setAttribute("aria-pressed", String(done && a.choice === "phish"));
    const fb = $("pq-feedback");
    fb.hidden = !done;
    if (done) {
      fb.className = "tk-card pq-feedback " + (a.correct ? "pq-feedback--ok" : "pq-feedback--miss");
      fb.innerHTML = html`<p class="pq-feedback__verdict">${a.correct ? "Correct" : "Not quite"}: this one is ${q.kind === "phish" ? "a phish" : "real"}.</p>
        <ul class="pq-clues">${q.clues.map(([where, text]) => html`<li><b>${where}:</b> ${text}</li>`)}</ul>
        <p class="pq-lesson">${q.lesson}</p>
        <button type="button" class="tk-btn" id="pq-next">${i + 1 < round.length ? "Next email" : "See my score"}</button>`;
      $("pq-next").addEventListener("click", next);
    }
  }
  function answer(choice) {
    if (answers[i]) return;
    const q = round[i];
    answers[i] = { choice, correct: choice === q.kind };
    renderQuestion();
    $("pq-feedback").focus();
  }
  function next() {
    if (i + 1 < round.length) { i++; renderQuestion(); $("pq-progress").focus(); return; }
    finish();
  }
  function finish() {
    const score = answers.filter((a) => a.correct).length;
    state.played += 1;
    state.best = state.best === null ? score : Math.max(state.best, score);
    db.set(state);
    const g = TKQ.grade(score, round.length);
    $("pq-final").textContent = `${score}/${round.length}`;
    $("pq-band").textContent = g.band;
    $("pq-note").textContent = g.note;
    $("pq-best").textContent = bestText();
    $("pq-review").innerHTML = html`${round.map((q, k) => html`<li class="${answers[k].correct ? "pq-ok" : "pq-miss"}">
      <span class="pq-mark" aria-hidden="true">${answers[k].correct ? "✓" : "✗"}</span>
      <div><p><b>${q.topic}</b> <span class="tk-muted">was ${q.kind === "phish" ? "a phish" : "real"}${answers[k].correct ? "" : `; you said ${answers[k].choice === "phish" ? "phish" : "real"}`}</span></p>
      <p class="tk-muted">${q.lesson}</p></div></li>`)}`;
    $("pq-share-msg").textContent = "";
    show("pq-end");
    $("pq-final").focus();
  }
  function start() {
    round = TKQ.pick(PQ_BANK);
    i = 0; answers = []; revealed = new Set();
    $("pq-bar").max = round.length;
    show("pq-play");
    renderQuestion();
    $("pq-progress").focus();
  }

  $("pq-mailbox").addEventListener("click", (e) => {
    const b = e.target.closest(".pq-link");
    if (!b) return;
    const k = b.dataset.k;
    revealed.add(k);
    b.setAttribute("aria-expanded", "true");
    const r = document.getElementById(`pq-rev-${k}`);
    if (r) r.hidden = false;
  });
  $("pq-start").addEventListener("click", start);
  $("pq-again").addEventListener("click", start);
  $("pq-real").addEventListener("click", () => answer("real"));
  $("pq-phish").addEventListener("click", () => answer("phish"));
  $("pq-share").addEventListener("click", async () => {
    const score = answers.filter((a) => a && a.correct).length;
    const ok = await TK.copy(TKQ.shareText(score, round.length));
    $("pq-share-msg").textContent = ok ? "Copied. Paste it into a post or a team chat." : "Copy isn't available here.";
  });
  $("pq-intro-best").textContent = bestText();
  show("pq-intro");
});
