document.addEventListener("DOMContentLoaded", () => {
  const year = document.getElementById("footYear");
  if (year) year.textContent = String(new Date().getFullYear());

  const burgers = document.querySelectorAll("[data-burger]");
  burgers.forEach((button) => {
    const panel = button.closest(".snav")?.querySelector("[data-mobile]");
    if (!panel) return;

    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      panel.hidden = expanded;
      document.body.classList.toggle("menu-open", !expanded);
    });
  });

  // "About" del nav = solo dropdown (pedido cliente 2026-07-02): el trigger no navega
  document.querySelectorAll('.has-dd > .nlink[href="#"]').forEach((trigger) => {
    trigger.addEventListener("click", (event) => event.preventDefault());
  });

  // Nav condensation on scroll — same behavior as the Home inline script
  const navs = document.querySelectorAll(".snav");
  const condenseNavs = () => {
    const always = document.body.classList.contains("nav-solid-always");
    navs.forEach((nav) => nav.classList.toggle("is-condensed", always || window.scrollY > 60));
  };
  addEventListener("scroll", condenseNavs, { passive: true });
  condenseNavs();

  // Scroll reveals — solo en páginas que marcan bloques con [data-reveal] (About SOTS).
  // El estado oculto inicial vive bajo .reveals-on, así que sin JS el contenido queda visible.
  const revealEls = document.querySelectorAll("[data-reveal]");
  if (revealEls.length && "IntersectionObserver" in window) {
    document.documentElement.classList.add("reveals-on");
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );
    revealEls.forEach((el) => revealObserver.observe(el));
  }

  // Soul Tide — campo de puntos en oleaje (portado del Home) tras la banda "Deep Wisdom".
  const emerge = document.getElementById("intro");
  if (emerge && emerge.querySelector("canvas")) mountTideCanvas(emerge);
  if (emerge) mountEmergeParallax(emerge);

  // Parallax de scroll sutil para la banda-CIELO "Threshold": el copy flota levemente al hacer scroll
  // (escribe --parx-copy en __inner). Sin canvas/wave (v2). Respeta reduced-motion dentro de la función.
  const threshold = document.querySelector(".about-threshold");
  if (threshold) mountThresholdParallax(threshold);

  // Rediseño 2026-07-02 — bandas nuevas del cierre: "Co-founder" (B) reusa el parallax de Deep Wisdom
  // con sus propios selectores; "Sundown" (C) reusa el parallax de copy del Threshold. Ambas sin canvas.
  const cofounder = document.querySelector(".about-cofounder");
  if (cofounder) mountEmergeParallax(cofounder, ".about-cofounder__media", ".about-cofounder__copy");
  const sundown = document.querySelector(".about-sundown");
  if (sundown) mountThresholdParallax(sundown, ".about-sundown__inner");

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

  // Soul Tide — campo de puntos en oleaje (canvas 2D), portado del Home (#soul-tide) y afinado
  // MÁS SUTIL para el hero de About Gary: deriva lenta, amplitud baja, puntos tenues (no compite
  // con las olas doradas ya integradas en gary-bg.webp). Sin dependencias 3D. Respeta reduced-motion.
  mountTideCanvas(document.querySelector(".about-hero__tide")?.closest(".about-hero"));

  // Hero video (About Gary): respeta reduced-motion → pausa y muestra un fotograma estático.
  const heroVideo = document.querySelector(".about-hero__video");
  if (heroVideo && matchMedia("(prefers-reduced-motion: reduce)").matches) {
    heroVideo.removeAttribute("autoplay");
    const freeze = () => {
      try {
        heroVideo.pause();
        heroVideo.currentTime = 0;
      } catch {
        /* currentTime puede no estar listo aún; el poster cubre ese caso */
      }
    };
    freeze();
    heroVideo.addEventListener("loadeddata", freeze, { once: true });
  }
});

/**
 * Monta el oleaje de puntos periwinkle→dorado sobre navy en la sección dada.
 * @param {Element|null|undefined} section - sección que contiene un <canvas>
 */
function mountTideCanvas(section) {
  if (!section) return;
  const canvas = section.querySelector("canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // La banda "Deep Wisdom" (#intro, data-tide="immersive") usa una ola más densa,
  // amplia y reactiva; el hero de About mantiene los valores sutiles originales.
  const immersive = section.dataset && section.dataset.tide === "immersive";

  const COOL = [210, 204, 253]; // Soft Periwinkle #D2CCFD — valle
  const WARM = [254, 212, 87]; //  Golden Yellow  #FED457 — cresta
  const AMOUNTX = immersive ? 52 : 46,
    AMOUNTY = immersive ? 80 : 72,
    SEP = 150,
    WAVE = immersive ? 40 : 30; // amplitud baja (afinado sutil vs 46 del Home)
  const DRIFT = immersive ? 0.036 : 0.028; // deriva base por frame
  const CAM_Y = 300,
    CAM_Z = 1180;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0,
    H = 0,
    cx = 0,
    cy = 0,
    focal = 0;
  let count = 0,
    raf = 0,
    running = false,
    inView = true;
  // reactividad al puntero (solo immersive): desplaza el CENTRO de proyección hacia el
  // cursor con lerp suave — sin recálculo por-partícula, coste ~cero.
  let pxTarget = 0,
    pyTarget = 0,
    pxCur = 0,
    pyCur = 0;

  const lerp = (a, b, t) => a + (b - a) * t;

  function resize() {
    const r = section.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W * 0.5;
    cy = H * 0.3;
    focal = H * 0.82;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const ecx = cx + pxCur; // centro efectivo (base + deriva hacia el puntero)
    const ecy = cy + pyCur;
    const maxDepth = CAM_Z + (AMOUNTY * SEP) / 2;
    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        const wx = ix * SEP - (AMOUNTX * SEP) / 2;
        const wz = iy * SEP - (AMOUNTY * SEP) / 2;
        const wy = Math.sin((ix + count) * 0.3) * WAVE + Math.sin((iy + count) * 0.5) * WAVE;
        const depth = CAM_Z - wz;
        if (depth < 70) continue;
        const f = focal / depth;
        const sx = ecx + wx * f;
        const sy = ecy - (wy - CAM_Y) * f;
        if (sx < -30 || sx > W + 30 || sy < -30 || sy > H + 30) continue;
        let rad = 0.55 * f * SEP * 0.12;
        if (rad < 0.35) rad = 0.35;
        else if (rad > 3.4) rad = 3.4;
        let crest = (wy + 2 * WAVE) / (4 * WAVE);
        if (crest < 0) crest = 0;
        else if (crest > 1) crest = 1;
        const t = crest * crest;
        const rC = lerp(COOL[0], WARM[0], t) | 0;
        const gC = lerp(COOL[1], WARM[1], t) | 0;
        const bC = lerp(COOL[2], WARM[2], t) | 0;
        let fade = 1 - depth / maxDepth;
        if (fade < 0) fade = 0;
        const a = (0.11 + 0.3 * crest) * (0.35 + 0.65 * fade); // ~30% más tenue que el Home
        ctx.beginPath();
        ctx.fillStyle = "rgba(" + rC + "," + gC + "," + bC + "," + a.toFixed(3) + ")";
        ctx.arc(sx, sy, rad, 0, 6.2832);
        ctx.fill();
      }
    }
  }

  // reacción suave a la velocidad del scroll (empuja al bajar, retrocede al subir)
  let scrollBoost = 0,
    lastY = window.pageYOffset || 0;
  function onWaveScroll() {
    const y = window.pageYOffset || 0,
      d = y - lastY;
    lastY = y;
    scrollBoost += d * (immersive ? 0.0026 : 0.0016);
    if (scrollBoost > 0.9) scrollBoost = 0.9;
    else if (scrollBoost < -0.9) scrollBoost = -0.9;
  }
  function loop() {
    raf = requestAnimationFrame(loop);
    count += DRIFT + scrollBoost; // deriva lenta (afinado sutil vs 0.04 del Home)
    scrollBoost *= 0.92;
    // el centro persigue al puntero con suavizado (immersive)
    pxCur = lerp(pxCur, pxTarget, 0.06);
    pyCur = lerp(pyCur, pyTarget, 0.06);
    draw();
  }
  function start() {
    if (running || reduce) return;
    running = true;
    loop();
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  resize();
  draw(); // primer frame estático siempre (también el único bajo reduced-motion)
  if (!reduce) start();
  addEventListener("resize", () => {
    resize();
    draw();
  }, { passive: true });
  if (!reduce) addEventListener("scroll", onWaveScroll, { passive: true });
  // El puntero empuja el centro de la ola (immersive): partículas "vivas" bajo el cursor.
  if (immersive && !reduce) {
    const MAX_PX = 46,
      MAX_PY = 28; // desplazamiento máx del centro (px)
    section.addEventListener(
      "pointermove",
      (e) => {
        const r = section.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const nx = (e.clientX - r.left) / r.width - 0.5; // -0.5..0.5
        const ny = (e.clientY - r.top) / r.height - 0.5;
        pxTarget = nx * MAX_PX;
        pyTarget = ny * MAX_PY;
      },
      { passive: true }
    );
    section.addEventListener("pointerleave", () => {
      pxTarget = 0;
      pyTarget = 0;
    });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (inView) start();
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          inView = e.isIntersecting;
          inView ? start() : stop();
        });
      },
      { threshold: 0 }
    ).observe(section);
  }
}

/**
 * Parallax al scroll para la banda "Deep Wisdom": Gary (recorte) y el copy se
 * desplazan a distinta velocidad conforme la sección cruza el viewport, sumando
 * profundidad. Solo desktop (≥1041px, donde Gary va absolute a sangre) y sin
 * reduced-motion. Escribe las vars CSS --parx-media / --parx-copy (fallback 0).
 * @param {Element} section
 */
function mountEmergeParallax(section, mediaSelector = ".about-emerge__media", copySelector = ".about-emerge__copy") {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  const media = section.querySelector(mediaSelector);
  const copy = section.querySelector(copySelector);
  if (!media && !copy) return;

  const desktop = matchMedia("(min-width: 1041px)");
  const MEDIA_AMT = 46; // px que sube/baja Gary (mayor → "más cerca")
  const COPY_AMT = -20; // el copy se mueve en sentido opuesto, sutil
  let raf = 0,
    inView = false,
    active = desktop.matches;

  function apply() {
    raf = 0;
    if (!active) return;
    const r = section.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    // progreso -1..1: -1 = sección entrando por abajo, +1 = saliendo por arriba
    const secCenter = r.top + r.height / 2;
    let p = (vh / 2 - secCenter) / (vh / 2 + r.height / 2);
    if (p < -1) p = -1;
    else if (p > 1) p = 1;
    if (media) media.style.setProperty("--parx-media", (p * MEDIA_AMT).toFixed(1) + "px");
    if (copy) copy.style.setProperty("--parx-copy", (p * COPY_AMT).toFixed(1) + "px");
  }
  function onScroll() {
    if (!raf && active && inView) raf = requestAnimationFrame(apply);
  }
  function reset() {
    if (media) media.style.setProperty("--parx-media", "0px");
    if (copy) copy.style.setProperty("--parx-copy", "0px");
  }

  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", () => {
    active = desktop.matches;
    if (!active) reset();
    else onScroll();
  }, { passive: true });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          inView = e.isIntersecting;
          if (inView) onScroll();
        });
      },
      { threshold: 0 }
    ).observe(section);
  } else {
    inView = true;
  }
  if (active) apply();
}

/**
 * Parallax de scroll sutil para la banda-CIELO "Threshold" (v2): el copy flota (sube/baja) conforme
 * la sección cruza el viewport, sumando profundidad al cielo. Todos los anchos; sin reduced-motion.
 * Escribe la var CSS --parx-copy en .about-threshold__inner (fallback 0).
 * @param {Element} section
 */
function mountThresholdParallax(section, innerSelector = ".about-threshold__inner") {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  const copy = section.querySelector(innerSelector);
  if (!copy) return;

  const COPY_AMT = 34; // px que flota el copy (mayor → más "juego")
  let raf = 0,
    inView = false;

  function apply() {
    raf = 0;
    const r = section.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    // progreso -1..1: -1 = sección entrando por abajo, +1 = saliendo por arriba
    const secCenter = r.top + r.height / 2;
    let p = (vh / 2 - secCenter) / (vh / 2 + r.height / 2);
    if (p < -1) p = -1;
    else if (p > 1) p = 1;
    copy.style.setProperty("--parx-copy", (p * COPY_AMT).toFixed(1) + "px");
  }
  function onScroll() {
    if (!raf && inView) raf = requestAnimationFrame(apply);
  }

  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          inView = e.isIntersecting;
          if (inView) onScroll();
        });
      },
      { threshold: 0 }
    ).observe(section);
  } else {
    inView = true;
  }
  apply();
}
