/**
 * Get Started — page-specific init.
 * Reuses the global helpers defined in ../about/about.js (loaded first):
 *   mountTideCanvas(section)      — Soul Tide dotted wave (halo) on a section w/ <canvas>
 *   mountThresholdParallax(sec, sel) — subtle scroll float (writes --parx-copy)
 * about.js also wires nav (burger, condensation), aria-current and the
 * [data-reveal] observer, so internal.js is intentionally NOT loaded here
 * (its burger handler would double-toggle the menu).
 */
/**
 * Envuelve cada palabra de `el` en <span class="gs-w" style="--wi:i"> para el
 * reveal escalonado (CSS). Conserva intactos los elementos inline (p.ej. el
 * <span class="gold gs-you">YOU</span> o <span class="accent gs-glow">…</span>):
 * cada nodo-elemento cuenta como una "palabra".
 * @param {Element} el
 */
function splitWords(el) {
  const nodes = Array.from(el.childNodes);
  el.textContent = "";
  let i = 0;
  nodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (part === "") return;
        if (/^\s+$/.test(part)) {
          el.appendChild(document.createTextNode(part));
          return;
        }
        const w = document.createElement("span");
        w.className = "gs-w";
        w.style.setProperty("--wi", i++);
        w.textContent = part;
        el.appendChild(w);
      });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const w = document.createElement("span");
      w.className = "gs-w";
      w.style.setProperty("--wi", i++);
      w.appendChild(node);
      el.appendChild(w);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // Word-by-word reveal — divide los titulares marcados con [data-words]
  // antes de que el observer de about.js los cruce (están bajo el fold).
  document.querySelectorAll("[data-words]").forEach(splitWords);

  // Section 2 — halo wave (Soul Tide) tras la declaración + offerings (kinetic type,
  // ahora dentro del wave). Cada bloque flota por su cuenta con --parx-copy.
  const wave = document.querySelector(".gs-wave");
  if (wave && typeof mountTideCanvas === "function") mountTideCanvas(wave);
  if (wave && typeof mountThresholdParallax === "function") {
    mountThresholdParallax(wave, ".gs-wave__provide");  // lift de "We provide…"
    mountThresholdParallax(wave, ".gs-kinetic__inner"); // float de las offerings
  }

  // Section 3 — float sutil de la copy de cierre.
  const closing = document.querySelector(".gs-kinetic");
  if (closing && typeof mountThresholdParallax === "function") {
    mountThresholdParallax(closing, ".gs-kinetic__copy");
  }

  // Section 1 — video hero respects reduced-motion (freeze to poster frame).
  const heroVideo = document.querySelector(".gs-hero__video");
  if (heroVideo && matchMedia("(prefers-reduced-motion: reduce)").matches) {
    heroVideo.removeAttribute("autoplay");
    const freeze = () => {
      try {
        heroVideo.pause();
        heroVideo.currentTime = 0;
      } catch {
        /* currentTime may not be ready; the poster covers that case */
      }
    };
    freeze();
    heroVideo.addEventListener("loadeddata", freeze, { once: true });
  }
});
