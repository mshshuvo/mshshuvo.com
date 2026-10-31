// mshshuvo.com: all interactivity, client-side. No third-party scripts.
// Content still reads correctly without JavaScript.
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  initMenu();
  initProjectFilter();
  initReadinessCheck();
  initContactForm();
});

// ---------------------------------------------------------------- mobile menu
function initMenu() {
  const toggle = document.querySelector(".nav__toggle");
  const menu = document.getElementById("menu");
  if (!toggle || !menu) return;
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    menu.classList.toggle("is-open", !open);
  });
}

// ---------------------------------------------------------------- project filter
function initProjectFilter() {
  const bar = document.querySelector(".filters");
  const grid = document.getElementById("project-grid");
  const count = document.getElementById("project-count");
  if (!bar || !grid) return;
  bar.hidden = false;
  const buttons = [...bar.querySelectorAll(".filter")];
  const cards = [...grid.querySelectorAll(".project")];
  const known = new Set(buttons.map((b) => b.dataset.tag));

  const apply = (tag, push) => {
    let shown = 0;
    cards.forEach((c) => {
      const match = !tag || c.dataset.tags.split("|").includes(tag);
      c.hidden = !match;
      if (match) shown += 1;
    });
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tag === tag)));
    count.textContent = `${shown} project${shown === 1 ? "" : "s"}${tag ? " · " + tag : ""}`;
    if (push) {
      const url = new URL(window.location.href);
      if (tag) url.searchParams.set("tag", tag); else url.searchParams.delete("tag");
      history.pushState({ tag }, "", url);
    }
  };

  buttons.forEach((b) => b.addEventListener("click", () => apply(b.dataset.tag, true)));
  window.addEventListener("popstate", () => {
    const t = new URL(window.location.href).searchParams.get("tag") || "";
    apply(known.has(t) ? t : "", false);
  });
  const initial = new URL(window.location.href).searchParams.get("tag") || "";
  apply(known.has(initial) ? initial : "", false);
}

// ---------------------------------------------------------------- readiness check
function initReadinessCheck() {
  const quiz = document.getElementById("quiz");
  if (!quiz) return;
  const qs = [...quiz.querySelectorAll("fieldset")];
  const el = (id) => document.getElementById(id);
  const CIRC = 301.6;
  const BANDS = [
    [80, "Audit-ready", "good", "You're in strong shape. A pre-certification internal audit would confirm it."],
    [50, "Building", "mid", "Solid foundations, but auditors will find gaps. Prioritise the items below."],
    [0, "Early stage", "low", "Start with scope, risk assessment and leadership buy-in before anything else."],
  ];

  quiz.addEventListener("change", () => {
    let earned = 0, answered = 0;
    const gaps = [];
    qs.forEach((fs, i) => {
      const picked = quiz.querySelector(`input[name="q${i}"]:checked`);
      const pts = picked ? Number(picked.value) : 0;
      if (picked) answered += 1;
      earned += pts;
      if (pts < 2) gaps.push(fs);
    });
    const pct = Math.round((100 * earned) / (2 * qs.length));
    const band = BANDS.find(([min]) => pct >= min);

    el("progress-bar").style.width = `${(100 * answered) / qs.length}%`;
    el("score-placeholder").hidden = true;
    el("score").hidden = false;
    el("score").className = `score score--${band[2]}`;
    el("score-pct").textContent = String(pct);
    el("ring").setAttribute("stroke-dasharray", `${((CIRC * pct) / 100).toFixed(1)} ${CIRC}`);
    el("score-meta").textContent = `${answered} of ${qs.length} answered`;

    const done = answered === qs.length;
    el("score-band").textContent = done ? band[1] : "Keep going…";
    el("score-done").hidden = !done;
    if (!done) return;
    el("score-advice").textContent = band[3];
    const list = el("gaps");
    list.replaceChildren(...gaps.slice(0, 4).map((fs) => {
      const li = document.createElement("li");
      const clause = document.createElement("span");
      clause.className = "mono";
      clause.textContent = fs.dataset.clause;
      li.append(clause, document.createTextNode(fs.dataset.fix));
      return li;
    }));
    el("gaps-h").hidden = gaps.length === 0;
  });
}

// ---------------------------------------------------------------- contact form
function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;
  const err = (id, show) => { document.getElementById(id).hidden = !show; };
  const emailOk = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const msg = form.message.value.trim();
    const bad = { "name-err": name.length < 2, "email-err": !emailOk(email), "message-err": msg.length < 10 };
    Object.entries(bad).forEach(([id, b]) => {
      err(id, b);
      document.getElementById(id.replace("-err", "")).setAttribute("aria-invalid", String(b));
    });
    if (Object.values(bad).some(Boolean)) return;

    const btn = document.getElementById("contact-submit");
    const top = document.getElementById("form-error");
    btn.disabled = true;
    btn.textContent = "Sending…";
    top.hidden = true;
    try {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.message || "Send failed");
      if (window.turnstile) window.turnstile.remove();
      form.hidden = true;
      document.getElementById("contact-sent").hidden = false;
    } catch (_) {
      if (window.turnstile) window.turnstile.reset();
      top.textContent = "Sorry, the message couldn't be sent. Please try again or email me directly.";
      top.hidden = false;
      btn.disabled = false;
      btn.textContent = "Send message";
    }
  });
}
