// mshshuvo.com: all interactivity, client-side. No third-party scripts.
// Content still reads correctly without JavaScript.
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  initMenu();
  initProjectFilter();
  initReadinessCheck();
  initContactForm();
  initCopyButtons();
  initSkillMap();
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

// ---------------------------------------------------------------- tag filter (projects, insights)
function initProjectFilter() {
  const bar = document.querySelector(".filters");
  const grid = document.querySelector("[data-filter-grid]");
  const count = document.querySelector("[data-filter-count]");
  if (!bar || !grid) return;
  bar.hidden = false;
  const noun = grid.dataset.noun || "item";
  const buttons = [...bar.querySelectorAll(".filter")];
  const cards = [...grid.querySelectorAll("[data-tags]")];
  const known = new Set(buttons.map((b) => b.dataset.tag));

  const apply = (tag, push) => {
    let shown = 0;
    cards.forEach((c) => {
      const match = !tag || c.dataset.tags.split("|").includes(tag);
      c.hidden = !match;
      if (match) shown += 1;
    });
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tag === tag)));
    if (count) count.textContent = `${shown} ${noun}${shown === 1 ? "" : "s"}${tag ? " · " + tag : ""}`;
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

// ---------------------------------------------------------------- readiness checks
const SUMMARY_KEY = "mshshuvo:assessment-summary";

function initReadinessCheck() {
  const quiz = document.getElementById("quiz");
  if (!quiz) return;
  const qs = [...quiz.querySelectorAll("fieldset")];
  const el = (id) => document.getElementById(id);
  const CIRC = 301.6;
  const mins = JSON.parse(quiz.dataset.bands);
  const tones = JSON.parse(quiz.dataset.tones);
  const verdicts = JSON.parse(quiz.dataset.verdicts);
  let counted = false;

  quiz.addEventListener("change", () => {
    let earned = 0, answered = 0;
    const answers = [];
    const gaps = [];
    qs.forEach((fs, i) => {
      const picked = quiz.querySelector(`input[name="q${i}"]:checked`);
      const pts = picked ? Number(picked.value) : 0;
      if (picked) answered += 1;
      answers.push(pts);
      earned += pts;
      if (pts < 2) gaps.push({ fs, pts });
    });
    const pct = Math.round((100 * earned) / (2 * qs.length));
    const b = mins.findIndex((min) => pct >= min);
    const [verdict, advice] = verdicts[b];

    el("progress-bar").style.width = `${(100 * answered) / qs.length}%`;
    el("score-placeholder").hidden = true;
    el("score").hidden = false;
    el("score").className = `score score--${tones[b]}`;
    el("score-pct").textContent = String(pct);
    el("ring").setAttribute("stroke-dasharray", `${((CIRC * pct) / 100).toFixed(1)} ${CIRC}`);
    el("score-meta").textContent = `${answered} of ${qs.length} answered`;

    const done = answered === qs.length;
    el("score-band").textContent = done ? verdict : "Keep going…";
    el("score-done").hidden = !done;
    if (!done) return;
    el("score-advice").textContent = advice;
    // "No" answers first, then "Partly", in question order.
    gaps.sort((x, y) => x.pts - y.pts);
    el("gaps").replaceChildren(...gaps.slice(0, 4).map(({ fs }) => {
      const li = document.createElement("li");
      const clause = document.createElement("span");
      clause.className = "mono";
      clause.textContent = fs.dataset.clause;
      li.append(clause, document.createTextNode(fs.dataset.fix));
      return li;
    }));
    el("gaps-h").hidden = gaps.length === 0;

    // Hand-off to the contact form (stays in this browser tab until the visitor sends it).
    const lines = gaps.map(({ fs, pts }) => `- ${fs.dataset.clause} (${pts ? "partly" : "no"}): ${fs.dataset.fix}`);
    const summary = `My ${quiz.dataset.name} readiness check: ${pct}% (${verdict}).\n` +
      (lines.length ? `Gaps:\n${lines.join("\n")}\n` : "No gaps flagged.\n") +
      "\nI'd like to discuss: ";
    try { sessionStorage.setItem(SUMMARY_KEY, summary); } catch (_) { /* storage blocked: button still opens the form */ }

    // Count the completion anonymously, once per page view.
    if (!counted) {
      counted = true;
      fetch("/api/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ check: quiz.dataset.check, answers }),
        keepalive: true,
      }).catch(() => {});
    }
  });
}

// ---------------------------------------------------------------- contact form
function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;
  prefillFromAssessment(form);
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
      top.textContent = "Sorry, the message couldn't be sent. Please try again in a few minutes, or message me on LinkedIn.";
      top.hidden = false;
      btn.disabled = false;
      btn.textContent = "Send message";
    }
  });
}

// ---------------------------------------------------------------- copy buttons
function initCopyButtons() {
  if (!navigator.clipboard) return;
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    const source = document.getElementById(btn.dataset.copy);
    if (!source) return;
    btn.hidden = false;
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(source.textContent.trim());
        btn.textContent = "Copied";
      } catch {
        btn.textContent = "Select and copy";
      }
      setTimeout(() => { btn.textContent = "Copy"; }, 2000);
    });
  });
}

// ---------------------------------------------------------------- contact prefill from a readiness check
function prefillFromAssessment(form) {
  if (new URLSearchParams(window.location.search).get("from") !== "assessment") return;
  let summary = null;
  try { summary = sessionStorage.getItem(SUMMARY_KEY); } catch (_) { return; }
  if (!summary || form.message.value) return;
  form.message.value = summary.slice(0, 3800);
  const topic = form.querySelector('input[name="topic"][value="Consulting engagement"]');
  if (topic) topic.checked = true;
}

/* Skill map: clicking a circle shows that skill's proof panel. Without JS every panel is listed. */
function initSkillMap() {
  const map = document.querySelector("[data-skillmap]");
  if (!map) return;
  const nodes = [...map.querySelectorAll("[data-skill]")];
  const panels = [...map.querySelectorAll(".sm-panel")];
  map.classList.add("is-js");
  const show = (id, scroll) => {
    nodes.forEach((n) => n.classList.toggle("is-on", n.dataset.skill === id));
    panels.forEach((p) => p.classList.toggle("is-on", p.id === id));
    const panel = document.getElementById(id);
    if (scroll && panel && window.matchMedia("(max-width: 900px)").matches) {
      panel.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
    }
  };
  nodes.forEach((n) => n.addEventListener("click", (e) => { e.preventDefault(); show(n.dataset.skill, true); }));
  const fromHash = location.hash.slice(1);
  if (fromHash && panels.some((p) => p.id === fromHash)) show(fromHash, false);
}
