/* Books — efectos de scroll de la estantería (.bk-shelf).
   Parallax por columna: al hacer scroll, la columna central baja mientras las
   laterales suben (±26px), escribiendo --shelf-par en cada .bk-book (el CSS lo
   aplica al coverwrap). Adaptación mínima de mountThresholdParallax (about.js):
   rAF + gate de IntersectionObserver, apagado ≤1020px y con reduced-motion. */
(() => {
  "use strict";

  const shelf = document.querySelector(".bk-shelf");
  if (!shelf) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const books = Array.from(shelf.querySelectorAll(".bk-book"));
  if (!books.length) return;

  const AMPLITUDE = 26; // px
  const COLS = 3;
  let inView = false;
  let ticking = false;

  const apply = () => {
    ticking = false;
    if (window.innerWidth <= 1020) {
      books.forEach((b) => b.style.removeProperty("--shelf-par"));
      return;
    }
    const rect = shelf.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    // progreso -1..1 del centro de la sección respecto al centro del viewport
    const raw = (rect.top + rect.height / 2 - vh / 2) / (rect.height / 2 + vh / 2);
    const p = Math.max(-1, Math.min(1, raw));
    books.forEach((b, i) => {
      const dir = i % COLS === 1 ? 1 : -1; // centro baja, laterales suben
      b.style.setProperty("--shelf-par", (p * dir * AMPLITUDE).toFixed(1) + "px");
    });
  };

  const update = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(apply);
    }
  };

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        inView = entries[0].isIntersecting;
        if (inView) update();
      },
      { rootMargin: "12% 0px" }
    ).observe(shelf);
  } else {
    inView = true;
  }

  window.addEventListener("scroll", () => { if (inView) update(); }, { passive: true });
  window.addEventListener("resize", update);
  update();
})();
