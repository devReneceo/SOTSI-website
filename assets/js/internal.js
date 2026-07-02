/* SOTSI internal pages (Prototype Fase 2) — shared behavior.
   Footer year, mobile nav, aria-current, scroll reveal,
   prototype form handling, and the podcast search/filter. */
document.addEventListener("DOMContentLoaded", () => {
  const year = document.getElementById("footYear");
  if (year) year.textContent = String(new Date().getFullYear());

  document.querySelectorAll("[data-burger]").forEach((button) => {
    const panel = button.closest(".snav")?.querySelector("[data-mobile]");
    if (!panel) return;

    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      panel.hidden = expanded;
    });
  });

  // "About" del nav = solo dropdown (pedido cliente 2026-07-02): el trigger no navega
  document.querySelectorAll('.has-dd > .nlink[href="#"]').forEach((trigger) => {
    trigger.addEventListener("click", (event) => event.preventDefault());
  });

  const currentPath = window.location.pathname.replace(/index\.html$/, "");
  document.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;

    try {
      const url = new URL(href, window.location.href);
      const linkPath = url.pathname.replace(/index\.html$/, "");
      if (linkPath === currentPath) {
        link.setAttribute("aria-current", "page");
      }
    } catch {
      // ignore malformed relative hrefs
    }
  });

  const revealables = document.querySelectorAll(".rv");
  if (revealables.length) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) {
      revealables.forEach((el) => el.classList.add("in"));
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              observer.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.12 }
      );
      revealables.forEach((el) => observer.observe(el));
    }
  }

  // Prototype forms: never submit anywhere — show the success state.
  document.querySelectorAll(".form-card form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const card = form.closest(".form-card");
      if (card) card.classList.add("is-sent");
      const success = card?.querySelector(".form-success");
      if (success) success.setAttribute("role", "status");
    });
  });

  // Episode directory: text search + series chips (podcast page).
  const search = document.querySelector("[data-ep-search]");
  const chips = document.querySelectorAll("[data-ep-filter]");
  const episodes = document.querySelectorAll("[data-ep]");
  if (episodes.length) {
    const state = { query: "", series: "all" };

    const apply = () => {
      episodes.forEach((row) => {
        const matchesSeries = state.series === "all" || row.dataset.ep === state.series;
        const matchesQuery = !state.query || row.textContent.toLowerCase().includes(state.query);
        row.classList.toggle("is-hidden", !(matchesSeries && matchesQuery));
      });
    };

    if (search) {
      search.addEventListener("input", () => {
        state.query = search.value.trim().toLowerCase();
        apply();
      });
    }

    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        state.series = chip.dataset.epFilter;
        chips.forEach((c) => c.classList.toggle("is-active", c === chip));
        apply();
      });
    });
  }
});
