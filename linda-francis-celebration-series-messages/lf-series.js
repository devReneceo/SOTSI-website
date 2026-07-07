/* Linda Francis Celebration Series — wayfinding.
   Scroll-spy del rail, contador "N / 11", barra de progreso de lectura
   y botón flotante al índice en móvil. internal.js ya maneja nav/reveals. */
document.addEventListener("DOMContentLoaded", () => {
  const letters = Array.from(document.querySelectorAll(".lf-letter[id]"));
  const spyLinks = new Map(
    Array.from(document.querySelectorAll("[data-lf-spy]")).map((a) => [a.dataset.lfSpy, a])
  );
  const counter = document.querySelector("[data-lf-count]");

  // Scroll-spy: la carta más cercana al tercio superior del viewport manda.
  if (letters.length && "IntersectionObserver" in window) {
    let current = "";
    const setCurrent = (id) => {
      if (!id || id === current) return;
      current = id;
      spyLinks.forEach((link, key) => link.classList.toggle("is-current", key === id));
      if (counter) counter.textContent = String(letters.findIndex((l) => l.id === id) + 1);
    };
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setCurrent(entry.target.id);
        });
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 }
    );
    letters.forEach((letter) => spy.observe(letter));
    setCurrent(letters[0].id);
  }

  // Barra de progreso — transform-only, rAF-throttled.
  const bar = document.querySelector(".lf-progress i");
  const jump = document.querySelector(".lf-jump");
  const JUMP_AFTER_PX = 900;
  if (bar || jump) {
    let raf = 0;
    const paint = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar && max > 0) bar.style.transform = `scaleX(${Math.min(1, window.scrollY / max)})`;
      if (jump) jump.classList.toggle("is-on", window.scrollY > JUMP_AFTER_PX);
    };
    window.addEventListener(
      "scroll",
      () => {
        if (!raf) raf = requestAnimationFrame(paint);
      },
      { passive: true }
    );
    paint();
  }
});
