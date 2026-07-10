/* SOTSI internal pages (Prototype Fase 2) — shared behavior.
   Footer year, mobile nav, aria-current, scroll reveal,
   prototype form handling, and the podcast search/filter. */
document.addEventListener("DOMContentLoaded", () => {
  const year = document.getElementById("footYear");
  if (year) year.textContent = String(new Date().getFullYear());

  document.querySelectorAll("[data-burger]").forEach((button) => {
    // sin optional chaining: Safari <13.1 (iPads viejos) no lo parsea y mataría todo el archivo
    const nav = button.closest(".snav");
    const panel = nav && nav.querySelector("[data-mobile]");
    if (!panel) return;

    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      panel.hidden = expanded;
      // overlay state for the full-screen drawer (same as the Home inline JS)
      document.body.classList.toggle("menu-open", !expanded);
    });
  });

  // "About" del nav = solo dropdown (pedido cliente 2026-07-02): el trigger no navega
  document.querySelectorAll('.has-dd > .nlink[href="#"]').forEach((trigger) => {
    trigger.addEventListener("click", (event) => event.preventDefault());
  });

  // Nav parity con el Home: el nav transparente se solidifica al hacer scroll
  // (mismo umbral y clase .is-condensed que el script inline del Home).
  const navs = Array.from(document.querySelectorAll(".snav"));
  if (navs.length) {
    const applyCondensed = () => {
      const always = document.body.classList.contains("nav-solid-always");
      navs.forEach((nav) => {
        nav.classList.toggle("is-condensed", always || window.scrollY > 60);
      });
    };
    window.addEventListener("scroll", applyCondensed, { passive: true });
    applyCondensed();
  }

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
    } catch (err) {
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

  // Spotlight cards (.post--glow): the ring/wash follows the cursor — parity
  // with the Home inline handler (index.html "Spotlight cards" block).
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.querySelectorAll(".post--glow").forEach((card) => {
      let raf = 0;
      let mx = 0;
      let my = 0;
      const apply = () => {
        raf = 0;
        card.style.setProperty("--mx", `${mx}px`);
        card.style.setProperty("--my", `${my}px`);
      };
      card.addEventListener("pointerenter", () => card.style.setProperty("--glow", "1"));
      card.addEventListener("pointermove", (event) => {
        const rect = card.getBoundingClientRect();
        mx = event.clientX - rect.left;
        my = event.clientY - rect.top;
        if (!raf) raf = requestAnimationFrame(apply);
      });
      card.addEventListener("pointerleave", () => card.style.setProperty("--glow", "0"));
    });
  }

  // Prototype forms: never submit anywhere — show the success state.
  document.querySelectorAll(".form-card form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const card = form.closest(".form-card");
      if (card) card.classList.add("is-sent");
      const success = card ? card.querySelector(".form-success") : null;
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

  // Smart back — píldora sutil "Back to Get Started" (feedback Joel 2026-07-06).
  // Solo aparece si el usuario llegó DESDE la página origen (marker en sessionStorage
  // escrito por get-started.js + referrer que lo confirma); estas páginas también se
  // enlazan desde nav/footer/otros lados y ahí NO debe salir. El click regresa al
  // origen y get-started.js restaura el scroll exacto.
  const RETURN_KEY = "sotsi:return";
  const RETURN_GO = "sotsi:return-go";
  const RETURN_MAX_AGE_MS = 30 * 60 * 1000;
  try {
    const marker = JSON.parse(sessionStorage.getItem(RETURN_KEY) || "null");
    const herePath = window.location.pathname.replace(/index\.html$/, "");
    const fresh = marker && Date.now() - (marker.ts || 0) < RETURN_MAX_AGE_MS;
    const referrerPath = document.referrer
      ? new URL(document.referrer).pathname.replace(/index\.html$/, "")
      : "";
    const markerPath = marker ? String(marker.href).replace(/index\.html$/, "") : "";
    if (fresh && markerPath && markerPath !== herePath && referrerPath === markerPath) {
      const back = document.createElement("a");
      back.className = "smart-back";
      back.href = marker.href;
      back.setAttribute("aria-label", `Back to ${marker.label} — right where you left off`);
      back.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>' +
        `<span>Back to ${marker.label}</span>`;
      back.addEventListener("click", () => {
        try {
          sessionStorage.setItem(RETURN_GO, "1");
        } catch (err) {
          /* sin storage el link igual navega al origen */
        }
      });
      document.body.appendChild(back);
      requestAnimationFrame(() => back.classList.add("is-on"));
    }
  } catch (err) {
    /* referrer opaco o storage inaccesible — simplemente no hay píldora */
  }
});
