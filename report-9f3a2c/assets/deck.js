/* SOTSI Report Decks — shared deck engine (vanilla, no deps) */
(function () {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const deck = document.querySelector(".deck");
  if (!deck) return;
  const slides = Array.from(deck.querySelectorAll(".slide"));
  const progress = document.querySelector(".progress");
  const countEl = document.querySelector(".nav__count");
  let idx = 0;

  /* ---- gauges: compute arc geometry ---- */
  slides.forEach((s) => {
    s.querySelectorAll(".gauge").forEach((g) => {
      const r = 54, C = 2 * Math.PI * r, arc = 0.75 * C;
      const val = parseFloat(g.dataset.value) || 0;
      g.style.setProperty("--circ", C.toFixed(2));
      g.style.setProperty("--off", (C - (val / 100) * arc).toFixed(2));
      const track = g.querySelector(".track");
      if (track) track.setAttribute("stroke-dasharray", `${arc.toFixed(2)} ${(C - arc).toFixed(2)}`);
    });
  });

  function animateCount(el) {
    const target = parseFloat(el.dataset.count);
    const dec = el.dataset.dec ? parseInt(el.dataset.dec) : 0;
    if (reduce) { el.textContent = target.toFixed(dec); return; }
    const dur = 1100, t0 = performance.now();
    function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * e).toFixed(dec);
      if (p < 1) requestAnimationFrame(step); else el.textContent = target.toFixed(dec);
    }
    requestAnimationFrame(step);
  }

  function enter(slide) {
    slide.querySelectorAll(".gauge, .vbar, .pbar").forEach((c) => c.classList.add("in"));
    slide.querySelectorAll("[data-count]").forEach(animateCount);
  }
  function leave(slide) {
    slide.querySelectorAll(".gauge, .vbar, .pbar").forEach((c) => c.classList.remove("in"));
  }

  function show(n) {
    n = Math.max(0, Math.min(slides.length - 1, n));
    if (n === idx) { /* still ensure animations on first load */ }
    slides.forEach((s, i) => {
      s.classList.toggle("is-active", i === n);
      s.classList.toggle("is-prev", i < n);
      if (i !== n) leave(s);
    });
    idx = n;
    enter(slides[idx]);
    if (progress) progress.style.width = ((idx) / (slides.length - 1) * 100) + "%";
    if (countEl) countEl.innerHTML = `<b>${String(idx + 1).padStart(2, "0")}</b> / ${String(slides.length).padStart(2, "0")}`;
    location.hash = "s" + (idx + 1);
  }
  const next = () => show(idx + 1);
  const prev = () => show(idx - 1);

  /* ---- keyboard ---- */
  window.addEventListener("keydown", (e) => {
    if (["ArrowRight", "PageDown", " ", "Spacebar"].includes(e.key)) { e.preventDefault(); next(); }
    else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); prev(); }
    else if (e.key === "Home") show(0);
    else if (e.key === "End") show(slides.length - 1);
    else if (e.key === "f" || e.key === "F") toggleFs();
  });

  /* ---- nav buttons ---- */
  const bPrev = document.querySelector("[data-prev]");
  const bNext = document.querySelector("[data-next]");
  const bFs = document.querySelector("[data-fs]");
  if (bPrev) bPrev.addEventListener("click", prev);
  if (bNext) bNext.addEventListener("click", next);
  function toggleFs() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
  if (bFs) bFs.addEventListener("click", toggleFs);

  /* ---- click to advance (skip interactive elements) ---- */
  deck.addEventListener("click", (e) => {
    if (e.target.closest("a,button,input,.ba,table,[data-no-nav]")) return;
    const x = e.clientX, w = window.innerWidth;
    if (x < w * 0.18) prev(); else next();
  });

  /* ---- touch swipe ---- */
  let tx = null;
  deck.addEventListener("touchstart", (e) => { tx = e.changedTouches[0].clientX; }, { passive: true });
  deck.addEventListener("touchend", (e) => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 50) (dx < 0 ? next() : prev());
    tx = null;
  }, { passive: true });

  /* ---- before/after sliders ---- */
  document.querySelectorAll(".ba").forEach((ba) => {
    const range = ba.querySelector(".ba__range");
    const set = (v) => ba.style.setProperty("--pos", v + "%");
    if (range) { range.addEventListener("input", () => set(range.value)); set(range.value || 50); }
  });

  /* ---- deep-link: respond to hash changes ---- */
  window.addEventListener("hashchange", () => {
    const m = parseInt((location.hash.match(/s(\d+)/) || [])[1]);
    if (m && m - 1 !== idx) show(m - 1);
  });

  /* ---- init (respect hash) ---- */
  const h = parseInt((location.hash.match(/s(\d+)/) || [])[1]);
  show(h ? h - 1 : 0);
})();

/* ---- PDF buttons open in an in-place, scrollable viewer (modal iframe) ---- */
(function () {
  "use strict";
  var btns = document.querySelectorAll('a.pdf-btn[href$=".pdf"]');
  if (!btns.length) return;
  var modal = document.createElement("div");
  modal.className = "pdfmodal";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML =
    '<div class="pdfmodal__panel" role="dialog" aria-modal="true" aria-label="Document viewer">' +
    '<div class="pdfmodal__bar"><span class="pdfmodal__title"></span>' +
    '<a class="pdfmodal__open" target="_blank" rel="noopener">Open in new tab ↗</a>' +
    '<button class="pdfmodal__close" type="button" aria-label="Close viewer">✕</button></div>' +
    '<iframe class="pdfmodal__frame" title="Document preview"></iframe></div>';
  document.body.appendChild(modal);
  var frame = modal.querySelector(".pdfmodal__frame"),
      title = modal.querySelector(".pdfmodal__title"),
      openA = modal.querySelector(".pdfmodal__open");
  function open(url, label) {
    frame.src = url; openA.href = url; title.textContent = label || "Document";
    modal.classList.add("is-open"); modal.setAttribute("aria-hidden", "false");
  }
  function close() {
    modal.classList.remove("is-open"); modal.setAttribute("aria-hidden", "true"); frame.src = "about:blank";
  }
  modal.querySelector(".pdfmodal__close").addEventListener("click", close);
  modal.addEventListener("click", function (e) { if (e.target === modal) close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modal.classList.contains("is-open")) close(); });
  Array.prototype.forEach.call(btns, function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      open(a.getAttribute("href"), (a.textContent || "Document").replace(/→|↗/g, "").trim());
    });
  });
})();

/* ---- view-source verify: copy the URL to the clipboard ---- */
(function () {
  "use strict";
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      var txt = btn.getAttribute("data-copy"), orig = btn.textContent;
      function flash(m) { btn.textContent = m; setTimeout(function () { btn.textContent = orig; }, 1500); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(function () { flash("Copied ✓"); }, function () { flash("Press ⌘/Ctrl+C"); });
      } else { flash("Copy manually"); }
    });
  });
})();
