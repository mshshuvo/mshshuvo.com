// Small progressive enhancements. Everything works without this file.
document.addEventListener("DOMContentLoaded", () => {
  // Mobile menu
  const toggle = document.querySelector(".nav__toggle");
  const menu = document.getElementById("menu");
  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      menu.classList.toggle("is-open", !open);
    });
  }

  // Timeline: second click collapses instead of re-fetching
  document.body.addEventListener("htmx:beforeRequest", (e) => {
    const btn = e.detail.elt;
    if (!btn.classList || !btn.classList.contains("tl__head")) return;
    const target = document.getElementById(btn.getAttribute("aria-controls"));
    if (btn.getAttribute("aria-expanded") === "true") {
      e.preventDefault();
      target.innerHTML = "";
      btn.setAttribute("aria-expanded", "false");
      btn.closest(".tl").classList.remove("is-open");
      btn.querySelector(".tl__more").textContent = "details +";
    }
  });
  document.body.addEventListener("htmx:afterSwap", (e) => {
    const t = e.detail.target;
    if (t.classList.contains("tl__body")) {
      const btn = document.querySelector(`[aria-controls="${t.id}"]`);
      btn.setAttribute("aria-expanded", "true");
      btn.closest(".tl").classList.add("is-open");
      btn.querySelector(".tl__more").textContent = "hide −";
    }
  });

  // Project filters: keep the active filter in sync after an HTMX swap
  document.body.addEventListener("htmx:afterRequest", (e) => {
    const el = e.detail.elt;
    if (!el.classList || !el.classList.contains("filter")) return;
    document.querySelectorAll(".filter").forEach((f) => f.removeAttribute("aria-current"));
    el.setAttribute("aria-current", "true");
  });

  // Readiness check progress bar
  const quiz = document.querySelector(".quiz");
  const bar = document.getElementById("progress-bar");
  if (quiz && bar) {
    const total = quiz.querySelectorAll("fieldset").length;
    quiz.addEventListener("change", () => {
      const done = new Set([...quiz.querySelectorAll("input:checked")].map((i) => i.name)).size;
      bar.style.width = `${(100 * done) / total}%`;
    });
  }
});
