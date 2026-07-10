/* In Celebration of Linda Francis — comportamiento propio (2026-07-03).
   about.js ya cubre: nav/burger, reveals [data-reveal], aria-current y la ola Soul Tide
   (#intro + data-tide="immersive"). Aquí: facade del video Vimeo, share bar (copy) y
   el read-more de las cards del muro de memorias (el slider se retiró — feedback UX). */

document.addEventListener("DOMContentLoaded", () => {
  /* ---------- Video Vimeo: facade → iframe al click (con autoplay) ---------- */
  const video = document.getElementById("rlVideo");
  const facade = document.getElementById("rlVideoPlay");
  if (video && facade) {
    facade.addEventListener("click", () => {
      const id = video.dataset.videoId;
      const hash = video.dataset.videoHash;
      const iframe = document.createElement("iframe");
      iframe.src =
        "https://player.vimeo.com/video/" + id +
        "?h=" + hash +
        "&autoplay=1&autopause=0&title=1&portrait=1&byline=1&color=fed457";
      iframe.title = "The Celebration of Linda Francis — video player";
      iframe.allow = "autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media";
      iframe.allowFullscreen = true;
      facade.replaceWith(iframe);
      iframe.focus();
    }, { once: true });
  }

  /* ---------- Share bar: copy link con aviso accesible ---------- */
  const live = document.querySelector(".rl-share__live");
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    const label = btn.querySelector(".rl-share__btn-label");
    const original = label ? label.textContent : "";
    let timer = 0;
    const flash = (msg) => {
      if (label) label.textContent = msg;
      btn.classList.add("is-copied");
      if (live) live.textContent = msg === "Copied ✓" ? "Link copied to clipboard" : msg;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (label) label.textContent = original;
        btn.classList.remove("is-copied");
        if (live) live.textContent = "";
      }, 1800);
    };
    btn.addEventListener("click", () => {
      const text = btn.getAttribute("data-copy");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          () => flash("Copied ✓"),
          () => flash("Press ⌘/Ctrl+C")
        );
      } else {
        flash("Copy manually");
      }
    });
  });

  /* ---------- Read more: clamp solo cuando el tributo desborda ---------- */
  document.querySelectorAll(".rl-card").forEach((card) => {
    const quote = card.querySelector("[data-clamp]");
    const more = card.querySelector(".rl-card__more");
    if (!quote || !more) return;
    quote.classList.add("is-clamped");
    // si no desborda, se retira el clamp y el botón queda oculto
    if (quote.scrollHeight <= quote.clientHeight + 8) {
      quote.classList.remove("is-clamped");
      return;
    }
    more.hidden = false;
    more.addEventListener("click", () => {
      const open = quote.classList.toggle("is-open");
      quote.classList.toggle("is-clamped", !open);
      more.setAttribute("aria-expanded", String(open));
      more.textContent = open ? "Read less" : "Read more";
    });
  });
});
