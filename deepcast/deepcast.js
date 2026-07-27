/* Deepcast page behavior (deepcast/ + deepcast/episode/).
   List page: renders the Spotify-style directory from assets/data/episodes-index.json
   (search, series chips, sort, batched "Load more", sessionStorage state restore,
   inline mp3 preview, artwork marquee, trailer). Detail shell: renders one episode
   shard (?ep=<slug>) with a YouTube facade, native audio whose chapters seek,
   prev/next cards, arrow keys and history.pushState navigation.
   The Soul Tide canvas is ported from about/about.js — do NOT load about.js here,
   its nav wiring would double-bind with internal.js. */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const IS_EPISODE = Boolean(document.querySelector("[data-dc-episode]"));
  const ROOT = IS_EPISODE ? "../../" : "../";
  const LIST_URL = IS_EPISODE ? "../" : "./";
  const DATA_URL = `${ROOT}assets/data/episodes-index.json`;
  const SHORTS_URL = `${ROOT}assets/data/shorts-mapping.json`;
  const SHORTS_ENABLED = false; // TEMP: off while matches are being validated — flip to true to re-enable
  const SHARD_URL = (slug) => `${ROOT}assets/data/episodes/${encodeURIComponent(slug)}.json`;
  const ART_DIR = `${ROOT}assets/images/episodes/`;
  const mp3Url = (megaId) => `https://traffic.megaphone.fm/${megaId}.mp3`;
  const artSrc = (ep) => ART_DIR + (ep.thumb || "_default.webp");
  const SERIES_LABEL = { feast: "Soul Feast", snack: "Soul Snack", special: "Special" };
  const BATCH = 30;
  const STORE_KEY = "dc:list:v1";

  const fmtDur = (sec) => {
    if (!sec) return "";
    const mins = Math.max(1, Math.round(sec / 60));
    return `${mins} min`;
  };
  const fmtDate = (iso) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const store = {
    get() {
      try { return JSON.parse(sessionStorage.getItem(STORE_KEY)); } catch (err) { return null; }
    },
    set(value) {
      try { sessionStorage.setItem(STORE_KEY, JSON.stringify(value)); } catch (err) { /* private mode */ }
    },
  };

  let indexPromise = null;
  const loadIndex = () => {
    // sin logical assignment de ES2021: Safari <14 no lo parsea y mataría todo el archivo
    indexPromise = indexPromise || fetch(DATA_URL).then((res) => {
      if (!res.ok) throw new Error(`episodes index ${res.status}`);
      return res.json();
    });
    return indexPromise;
  };

  let shortsPromise = null;
  const loadShorts = () => {
    // optional: a missing/failed fetch degrades to "no episode has shorts", never breaks the page
    shortsPromise = shortsPromise || fetch(SHORTS_URL)
      .then((res) => (res.ok ? res.json() : { bySlug: {} }))
      .catch(() => ({ bySlug: {} }));
    return shortsPromise;
  };
  const withShorts = (ep, shortsBySlug) => ({ ...ep, shorts: shortsBySlug[ep.slug] || [] });

  const svg = (markup) => {
    const span = document.createElement("span");
    span.innerHTML = markup; // static icon markup only — never episode data
    return span.firstElementChild;
  };
  const ICON_PLAY = '<svg class="ico-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
  const ICON_PAUSE = '<svg class="ico-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.5 5h4v14h-4zM13.5 5h4v14h-4z"/></svg>';

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  /* ---------- Shorts: shared inline click-to-play card (list modal + detail page) ---------- */
  function shortCard(short) {
    const box = el("div", "dc-short");
    const img = document.createElement("img");
    img.src = `https://i.ytimg.com/vi/${short.id}/hqdefault.jpg`;
    img.alt = "";
    img.loading = "lazy";
    const btn = el("button", "dc-short__btn");
    btn.type = "button";
    btn.setAttribute("aria-label", `Play the Short: ${short.title}`);
    const circle = el("span", "dc-trailer__play");
    circle.setAttribute("aria-hidden", "true");
    circle.appendChild(svg(ICON_PLAY.replace(' class="ico-play"', "")));
    btn.appendChild(circle);
    btn.addEventListener("click", () => {
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube-nocookie.com/embed/${short.id}?autoplay=1&rel=0`;
      iframe.title = short.title;
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      box.textContent = "";
      box.appendChild(iframe);
    }, { once: true });
    const label = el("p", "dc-short__label", short.title);
    box.append(img, btn, label);
    return box;
  }

  /* ---------- Shorts: shared modal (opened from the listing row badge, stays on-site) ---------- */
  let shortsModalEl = null;
  function openShortsModal(ep) {
    if (!shortsModalEl) {
      shortsModalEl = el("div", "dc-shmodal");
      shortsModalEl.setAttribute("role", "dialog");
      shortsModalEl.setAttribute("aria-modal", "true");
      shortsModalEl.hidden = true;
      const backdrop = el("div", "dc-shmodal__backdrop");
      const panel = el("div", "dc-shmodal__panel");
      const closeBtn = el("button", "dc-shmodal__close");
      closeBtn.type = "button";
      closeBtn.setAttribute("aria-label", "Close");
      closeBtn.textContent = "×";
      const title = el("p", "dc-shmodal__title");
      const row = el("div", "dc-shmodal__row");
      panel.append(closeBtn, title, row);
      shortsModalEl.append(backdrop, panel);
      document.body.appendChild(shortsModalEl);
      const close = () => {
        shortsModalEl.hidden = true;
        document.body.classList.remove("dc-shmodal-open");
        row.textContent = "";
      };
      backdrop.addEventListener("click", close);
      closeBtn.addEventListener("click", close);
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !shortsModalEl.hidden) close();
      });
      shortsModalEl._row = row;
      shortsModalEl._title = title;
    }
    shortsModalEl._title.textContent = ep.shorts.length > 1
      ? `Shorts from ${ep.fullTitle}`
      : `Short from ${ep.fullTitle}`;
    shortsModalEl._row.textContent = "";
    ep.shorts.forEach((short) => shortsModalEl._row.appendChild(shortCard(short)));
    shortsModalEl.hidden = false;
    document.body.classList.add("dc-shmodal-open");
  }

  /* ---------- display-word char split ([data-dc-split]) ---------- */
  function splitChars(el) {
    const label = el.getAttribute("aria-label") || el.textContent.trim();
    el.setAttribute("aria-label", label);
    let index = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) { walk(child); return; }
        if (child.nodeType !== Node.TEXT_NODE) return;
        const frag = document.createDocumentFragment();
        for (const ch of child.textContent) {
          if (/\s/.test(ch)) { frag.appendChild(document.createTextNode(ch)); continue; }
          const span = document.createElement("span");
          span.className = "dc-ch";
          span.setAttribute("aria-hidden", "true");
          span.style.setProperty("--ci", index++);
          span.textContent = ch;
          frag.appendChild(span);
        }
        child.replaceWith(frag);
      });
    };
    walk(el);
  }

  function observeSplits() {
    const targets = document.querySelectorAll("[data-dc-split]");
    if (!targets.length) return;
    if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      targets.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add("in"); io.unobserve(entry.target); }
      }),
      { threshold: 0.35 }
    );
    targets.forEach((el) => io.observe(el));
  }

  /* ---------- Soul Tide canvas — verbatim port of about/about.js:109-273 ---------- */
  function mountTideCanvas(section) {
    if (!section) return;
    const canvas = section.querySelector("canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const immersive = section.dataset && section.dataset.tide === "immersive";

    const COOL = [210, 204, 253]; // Soft Periwinkle #D2CCFD — valle
    const WARM = [254, 212, 87]; //  Golden Yellow  #FED457 — cresta
    const AMOUNTX = immersive ? 52 : 46,
      AMOUNTY = immersive ? 80 : 72,
      SEP = 150,
      WAVE = immersive ? 40 : 30;
    const DRIFT = immersive ? 0.036 : 0.028;
    const CAM_Y = 300,
      CAM_Z = 1180;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, cx = 0, cy = 0, focal = 0;
    let count = 0, raf = 0, running = false, inView = true;
    let pxTarget = 0, pyTarget = 0, pxCur = 0, pyCur = 0;

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
      const ecx = cx + pxCur;
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
          const a = (0.11 + 0.3 * crest) * (0.35 + 0.65 * fade);
          ctx.beginPath();
          ctx.fillStyle = "rgba(" + rC + "," + gC + "," + bC + "," + a.toFixed(3) + ")";
          ctx.arc(sx, sy, rad, 0, 6.2832);
          ctx.fill();
        }
      }
    }

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
      count += DRIFT + scrollBoost;
      scrollBoost *= 0.92;
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
    draw();
    if (!reduce) start();
    addEventListener("resize", () => { resize(); draw(); }, { passive: true });
    if (!reduce) addEventListener("scroll", onWaveScroll, { passive: true });
    if (immersive && !reduce) {
      const MAX_PX = 46,
        MAX_PY = 28;
      section.addEventListener(
        "pointermove",
        (e) => {
          const r = section.getBoundingClientRect();
          if (!r.width || !r.height) return;
          const nx = (e.clientX - r.left) / r.width - 0.5;
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

  /* ---------- trailer (click-to-play, pauses off-screen) ---------- */
  function initTrailer() {
    const wrap = $("[data-dc-trailer]");
    if (!wrap) return;
    const video = $("video", wrap);
    const overlay = $("[data-dc-trailer-play]", wrap);
    if (!video || !overlay) return;
    overlay.addEventListener("click", () => {
      wrap.classList.add("is-playing");
      video.controls = true;
      video.play().catch(() => {});
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        (entries) => entries.forEach((entry) => {
          if (!entry.isIntersecting && !video.paused) video.pause();
        }),
        { threshold: 0 }
      ).observe(wrap);
    }
  }

  /* ---------- shared one-at-a-time mp3 preview ---------- */
  function createPreview() {
    let audio = null;
    let activeBtn = null;
    const stop = () => {
      if (audio) audio.pause();
      if (activeBtn) {
        activeBtn.classList.remove("is-playing");
        activeBtn.setAttribute("aria-pressed", "false");
      }
      activeBtn = null;
    };
    return {
      stop,
      toggle(btn, megaId) {
        if (activeBtn === btn) { stop(); return; }
        stop();
        audio = audio || new Audio();
        audio.src = mp3Url(megaId);
        audio.play().catch(stop);
        audio.onended = stop;
        audio.onerror = stop;
        activeBtn = btn;
        btn.classList.add("is-playing");
        btn.setAttribute("aria-pressed", "true");
      },
    };
  }

  /* ---------- artwork marquee (Tune In) ---------- */
  function buildMarquee(episodes) {
    const host = $("[data-dc-marquee]");
    if (!host) return;
    const picks = episodes.filter((ep) => ep.thumb).slice(0, 14);
    if (!picks.length) return;
    const track = document.createElement("div");
    track.className = "dc-marquee__track";
    [false, true].forEach((isClone) => {
      const group = document.createElement("div");
      group.className = "dc-marquee__group";
      if (isClone) group.setAttribute("aria-hidden", "true");
      picks.forEach((ep) => {
        const item = document.createElement("a");
        item.className = "dc-marquee__item";
        item.href = `${LIST_URL}episode/?ep=${encodeURIComponent(ep.slug)}`;
        if (isClone) item.tabIndex = -1;
        const img = document.createElement("img");
        img.src = artSrc(ep);
        img.alt = isClone ? "" : ep.fullTitle;
        img.loading = "lazy";
        img.width = 210;
        img.height = 210;
        const tag = document.createElement("p");
        tag.className = "dc-marquee__tag";
        tag.textContent = `${SERIES_LABEL[ep.series] || "Episode"}${ep.number ? ` #${ep.number}` : ""}`;
        item.append(img, tag);
        group.appendChild(item);
      });
      track.appendChild(group);
    });
    host.appendChild(track);
    host.hidden = false;
  }

  /* ---------- list page ---------- */
  function initList() {
    const list = $("[data-dc-list]");
    if (!list) return;
    const searchInput = $("[data-dc-search]");
    const chips = [...document.querySelectorAll("[data-dc-filter]")];
    const sortSel = $("[data-dc-sort]");
    const countEl = $("[data-dc-count]");
    const moreBtn = $("[data-dc-more]");
    const moreNote = $("[data-dc-more-note]");
    const emptyEl = $("[data-dc-empty]");
    const clearBtn = $("[data-dc-clear]");
    const skel = $("[data-dc-skel]");
    const preview = createPreview();

    const state = { q: "", series: "all", sort: "new", shown: BATCH };
    const saved = store.get();
    if (saved && typeof saved === "object") {
      state.q = typeof saved.q === "string" ? saved.q : "";
      state.series = ["all", "feast", "snack", "special"].includes(saved.series) ? saved.series : "all";
      state.sort = saved.sort === "old" ? "old" : "new";
      state.shown = Math.max(BATCH, saved.shown | 0);
    }
    if (searchInput) searchInput.value = state.q;
    chips.forEach((chip) => chip.classList.toggle("is-active", chip.dataset.dcFilter === state.series));
    if (sortSel) sortSel.value = state.sort;

    let episodes = [];
    const persist = () =>
      store.set({ q: state.q, series: state.series, sort: state.sort, shown: state.shown, scrollY: window.scrollY });

    const filtered = () => {
      const query = state.q.trim().toLowerCase();
      const subset = episodes.filter(
        (ep) =>
          (state.series === "all" || ep.series === state.series) &&
          (!query || ep.fullTitle.toLowerCase().includes(query))
      );
      return state.sort === "old" ? [...subset].reverse() : subset;
    };

    function rowFor(ep, position) {
      const li = document.createElement("li");
      li.className = "dc-row dc-row--enter";
      li.style.animationDelay = `${Math.min(position, 10) * 28}ms`;

      const num = document.createElement("span");
      num.className = "dc-row__num";
      num.textContent = ep.number ? `#${ep.number}` : "·";

      const art = document.createElement("span");
      art.className = "dc-row__art";
      const img = document.createElement("img");
      img.src = artSrc(ep);
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.width = 56;
      img.height = 56;
      art.appendChild(img);

      const main = document.createElement("span");
      main.className = "dc-row__main";
      const link = document.createElement("a");
      link.className = "dc-row__link";
      link.href = `episode/?ep=${encodeURIComponent(ep.slug)}`;
      link.textContent = ep.title;
      link.addEventListener("click", persist);
      const sub = document.createElement("span");
      sub.className = "dc-row__sub";
      const badge = document.createElement("span");
      badge.className = `dc-badge dc-badge--${ep.series}`;
      badge.textContent = SERIES_LABEL[ep.series] || "Episode";
      const subdate = document.createElement("span");
      subdate.className = "dc-row__subdate";
      subdate.textContent = `${fmtDate(ep.date)}${ep.duration ? ` · ${fmtDur(ep.duration)}` : ""}`;
      sub.append(badge, subdate);
      if (SHORTS_ENABLED && ep.shorts && ep.shorts.length) {
        const shortsBtn = document.createElement("button");
        shortsBtn.type = "button";
        shortsBtn.className = "dc-badge dc-badge--shorts dc-row__shortslink";
        shortsBtn.textContent = ep.shorts.length > 1 ? `Shorts (${ep.shorts.length})` : "Short";
        shortsBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openShortsModal(ep);
        });
        sub.appendChild(shortsBtn);
      }
      main.append(link, sub);

      const date = document.createElement("span");
      date.className = "dc-row__date";
      date.textContent = fmtDate(ep.date);

      const dur = document.createElement("span");
      dur.className = "dc-row__dur";
      dur.textContent = fmtDur(ep.duration);

      li.append(num, art, main, date, dur);

      if (ep.megaId) {
        const play = document.createElement("button");
        play.type = "button";
        play.className = "dc-row__play";
        play.dataset.dcPlay = ep.megaId;
        play.setAttribute("aria-pressed", "false");
        play.setAttribute("aria-label", `Play a preview of ${ep.fullTitle}`);
        play.append(svg(ICON_PLAY), svg(ICON_PAUSE));
        li.appendChild(play);
      } else {
        li.appendChild(document.createElement("span"));
      }
      return li;
    }

    function render() {
      const subset = filtered();
      const slice = subset.slice(0, state.shown);
      preview.stop();
      list.textContent = "";
      const frag = document.createDocumentFragment();
      slice.forEach((ep, i) => frag.appendChild(rowFor(ep, i)));
      list.appendChild(frag);

      if (countEl) countEl.textContent = `${subset.length} episode${subset.length === 1 ? "" : "s"}`;
      const remaining = subset.length - slice.length;
      if (moreBtn) moreBtn.hidden = remaining <= 0;
      if (moreNote) moreNote.textContent = subset.length ? `Showing ${slice.length} of ${subset.length}` : "";
      if (emptyEl) emptyEl.hidden = subset.length > 0;
    }

    const update = (patch) => {
      Object.assign(state, patch);
      persist();
      render();
    };

    let debounce = 0;
    if (searchInput) searchInput.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => update({ q: searchInput.value, shown: BATCH }), 130);
    });
    chips.forEach((chip) =>
      chip.addEventListener("click", () => {
        chips.forEach((c) => c.classList.toggle("is-active", c === chip));
        update({ series: chip.dataset.dcFilter, shown: BATCH });
      })
    );
    if (sortSel) sortSel.addEventListener("change", () => update({ sort: sortSel.value, shown: BATCH }));
    if (moreBtn) moreBtn.addEventListener("click", () => update({ shown: state.shown + BATCH }));
    if (clearBtn) clearBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      chips.forEach((c) => c.classList.toggle("is-active", c.dataset.dcFilter === "all"));
      if (sortSel) sortSel.value = "new";
      update({ q: "", series: "all", sort: "new", shown: BATCH });
    });

    list.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-dc-play]");
      if (!btn) return;
      event.preventDefault();
      preview.toggle(btn, btn.dataset.dcPlay);
    });

    Promise.all([loadIndex(), loadShorts()])
      .then(([data, shortsData]) => {
        const shortsBySlug = (shortsData && shortsData.bySlug) || {};
        episodes = (data.episodes || []).map((ep) => withShorts(ep, shortsBySlug));
        if (skel) skel.remove();
        render();
        buildMarquee(episodes);
        if (saved && saved.scrollY > 0) {
          requestAnimationFrame(() => window.scrollTo(0, saved.scrollY));
        }
      })
      .catch(() => {
        if (skel) skel.remove();
        if (emptyEl) {
          emptyEl.hidden = false;
          const h3 = $("h3", emptyEl);
          const p = $("p", emptyEl);
          if (h3) h3.textContent = "The episode list could not load.";
          if (p) p.textContent = "Please refresh the page, or browse every episode on seatofthesoul.com/deepcast.";
          if (clearBtn) clearBtn.remove();
        }
      });

    window.addEventListener("pagehide", persist);
  }

  /* ---------- episode detail shell ---------- */
  function initEpisode() {
    const mount = $("[data-dc-episode]");
    if (!mount) return;
    const hero = $("[data-dc-ep-hero]");
    const slots = {
      badge: $("[data-ep-badge]"),
      num: $("[data-ep-num]"),
      title: $("[data-ep-title]"),
      facts: $("[data-ep-facts]"),
      crumb: $("[data-ep-crumb]"),
    };
    const getSlug = () => new URLSearchParams(location.search).get("ep") || "";

    let episodes = [];
    let detailAudio = null;
    let currentSlug = null;
    let renderSeq = 0; // guards against out-of-order shard fetches on rapid prev/next

    function fillHero(ep) {
      if (slots.badge) {
        slots.badge.className = `dc-badge dc-badge--${ep.series}`;
        slots.badge.textContent = SERIES_LABEL[ep.series] || "Episode";
      }
      if (slots.num) slots.num.textContent = ep.number ? `Episode #${ep.number}` : "";
      if (slots.title) slots.title.textContent = ep.title;
      if (slots.facts) {
        slots.facts.textContent = "";
        const bits = [fmtDate(ep.date)];
        if (ep.duration) bits.push(fmtDur(ep.duration));
        bits.push(ep.youtubeId ? "Video + audio" : "Audio");
        bits.forEach((bit, i) => {
          if (i) slots.facts.append(" · ");
          const strong = document.createElement("strong");
          strong.textContent = bit;
          slots.facts.appendChild(strong);
        });
      }
      if (slots.crumb) slots.crumb.textContent = ep.number ? `${SERIES_LABEL[ep.series]} #${ep.number}` : "Episode";
      if (hero && ep.thumb) hero.style.setProperty("--ep-art", `url("${ART_DIR}${ep.thumb}")`);
      document.title = `${ep.fullTitle} · The Gary Zukav Deepcast`;
    }

    function mediaBlock(ep) {
      if (!ep.youtubeId) return null;
      const box = el("div", "dc-yt");
      const img = document.createElement("img");
      img.src = artSrc(ep);
      img.alt = "";
      img.width = 1280;
      img.height = 720;
      const btn = el("button", "dc-yt__btn");
      btn.type = "button";
      btn.setAttribute("aria-label", `Play the video of ${ep.fullTitle}`);
      const circle = el("span", "dc-trailer__play");
      circle.setAttribute("aria-hidden", "true");
      circle.appendChild(svg(ICON_PLAY.replace(' class="ico-play"', "")));
      const label = el("p", "dc-yt__label", "Play the video");
      btn.append(circle, label);
      btn.addEventListener("click", () => {
        const iframe = document.createElement("iframe");
        iframe.src = `https://www.youtube-nocookie.com/embed/${ep.youtubeId}?autoplay=1&rel=0`;
        iframe.title = ep.fullTitle;
        iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        iframe.allowFullscreen = true;
        if (detailAudio) detailAudio.pause();
        box.textContent = "";
        box.appendChild(iframe);
      }, { once: true });
      box.append(img, btn);
      return box;
    }

    function audioBlock(ep) {
      if (!ep.megaId) return null;
      const card = el("div", "dc-audio");
      const icon = el("span", "dc-audio__icon");
      icon.setAttribute("aria-hidden", "true");
      icon.appendChild(svg('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.6"/><rect x="17" y="14" width="4" height="6" rx="1.6"/></svg>'));
      const body = el("div");
      body.appendChild(el("p", "dc-audio__label", "Listen to this episode"));
      detailAudio = document.createElement("audio");
      detailAudio.controls = true;
      detailAudio.preload = "none";
      detailAudio.src = mp3Url(ep.megaId);
      body.appendChild(detailAudio);
      card.append(icon, body);
      return card;
    }

    function shortsBlock(ep) {
      if (!SHORTS_ENABLED || !ep.shorts || !ep.shorts.length) return null;
      const wrap = el("aside", "dc-shorts");
      wrap.appendChild(el("p", "dc-shorts__label",
        ep.shorts.length > 1 ? "Watch the Shorts from this episode" : "Watch the Short from this episode"));
      const row = el("div", "dc-shorts__row");
      ep.shorts.forEach((short) => row.appendChild(shortCard(short)));
      wrap.appendChild(row);
      return wrap;
    }

    function chaptersBlock(ep) {
      if (!ep.chapters || !ep.chapters.length || !detailAudio) return null;
      const wrap = el("section", "dc-chapters");
      wrap.appendChild(el("h2", "dc-chapters__title", "What you'll discover in this episode"));
      const ol = document.createElement("ol");
      ep.chapters.forEach((chapter) => {
        const li = document.createElement("li");
        const btn = el("button", "dc-chapter");
        btn.type = "button";
        btn.append(
          el("span", "dc-chapter__time", chapter.label),
          el("span", "dc-chapter__title", chapter.title),
        );
        if (chapter.text) btn.appendChild(el("p", "dc-chapter__text", chapter.text));
        btn.addEventListener("click", () => {
          detailAudio.currentTime = chapter.t;
          detailAudio.play().catch(() => {});
          detailAudio.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        li.appendChild(btn);
        ol.appendChild(li);
      });
      wrap.appendChild(ol);
      wrap.appendChild(el("p", "dc-chapters__hint", "Select a moment to jump the audio player straight to it."));
      return wrap;
    }

    function descBlock(ep) {
      const paras = [...(ep.description || []), ...(ep.outro || [])];
      if (!paras.length) return null;
      const wrap = el("section", "dc-ep-desc");
      paras.forEach((text) => wrap.appendChild(el("p", "", text)));
      return wrap;
    }

    function promoBlock(ep) {
      if (!ep.promo || !ep.promo.url) return null;
      const wrap = el("aside", "dc-promo");
      wrap.appendChild(el("p", "", ep.promo.text));
      const link = document.createElement("a");
      link.className = "btn btn--gold";
      link.href = ep.promo.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Learn more ↗";
      wrap.appendChild(link);
      return wrap;
    }

    function navBlock(index) {
      const wrap = el("nav", "dc-ep-nav");
      wrap.setAttribute("aria-label", "Episode navigation");
      const grid = el("div", "dc-ep-nav__grid");
      const older = episodes[index + 1];
      const newer = episodes[index - 1];
      const card = (ep, kind) => {
        const a = el("a", `dc-ep-nav__card${kind === "next" ? " dc-ep-nav__card--next" : ""}`);
        a.href = `?ep=${encodeURIComponent(ep.slug)}`;
        a.dataset.dcNav = ep.slug;
        const img = document.createElement("img");
        img.src = artSrc(ep);
        img.alt = "";
        img.loading = "lazy";
        img.width = 64;
        img.height = 64;
        const body = el("span");
        body.appendChild(el("p", "dc-ep-nav__kicker", kind === "next" ? "Next episode →" : "← Previous episode"));
        body.appendChild(el("p", "dc-ep-nav__title", ep.number ? `${SERIES_LABEL[ep.series]} #${ep.number}: ${ep.title}` : ep.title));
        a.append(img, body);
        return a;
      };
      if (older) grid.appendChild(card(older, "prev"));
      if (newer) grid.appendChild(card(newer, "next"));
      wrap.appendChild(grid);
      const hint = el("p", "dc-ep-nav__hint");
      hint.append("Tip: use ");
      hint.appendChild(el("kbd", "", "←"));
      hint.append(" and ");
      hint.appendChild(el("kbd", "", "→"));
      hint.append(" to move between episodes.");
      wrap.appendChild(hint);
      return wrap;
    }

    function backLink() {
      const p = el("p");
      p.style.marginTop = "2.2rem";
      const a = el("a", "int-link");
      a.href = "../#episodes";
      a.append("Back to all episodes ");
      const arrow = el("span", "arrow", "→");
      a.appendChild(arrow);
      p.appendChild(a);
      return p;
    }

    function renderEpisode(ep, index, notFound) {
      detailAudio = null;
      fillHero(ep);
      mount.textContent = "";
      if (notFound) {
        const notice = el("p", "dc-notice", "That episode wasn't found — showing the latest one instead.");
        notice.setAttribute("role", "status");
        mount.appendChild(notice);
      }
      const media = mediaBlock(ep);
      if (media) mount.appendChild(media);
      const audio = audioBlock(ep);
      if (audio) mount.appendChild(audio);
      const shorts = shortsBlock(ep);
      if (shorts) mount.appendChild(shorts);
      const chapters = chaptersBlock(ep);
      if (chapters) mount.appendChild(chapters);
      const desc = descBlock(ep);
      if (desc) mount.appendChild(desc);
      const promo = promoBlock(ep);
      if (promo) mount.appendChild(promo);
      mount.appendChild(navBlock(index));
      mount.appendChild(backLink());
    }

    function show(slug, push) {
      const foundIndex = episodes.findIndex((ep) => ep.slug === slug);
      const index = Math.max(0, foundIndex);
      const entry = episodes[index];
      if (!entry) return;
      currentSlug = entry.slug;
      if (push) history.pushState({ ep: entry.slug }, "", `?ep=${encodeURIComponent(entry.slug)}`);
      const seq = ++renderSeq;
      fetch(SHARD_URL(entry.slug))
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .catch(() => entry) // index entry renders a minimal page if the shard is missing
        .then((full) => {
          if (seq !== renderSeq) return; // a newer navigation already superseded this one
          renderEpisode({ ...entry, ...full }, index, foundIndex === -1 && Boolean(slug));
          window.scrollTo({ top: 0, behavior: push ? "smooth" : "auto" });
        });
    }

    Promise.all([loadIndex(), loadShorts()])
      .then(([data, shortsData]) => {
        const shortsBySlug = (shortsData && shortsData.bySlug) || {};
        episodes = (data.episodes || []).map((ep) => withShorts(ep, shortsBySlug));
        if (!episodes.length) throw new Error("empty index");
        show(getSlug(), false);
      })
      .catch(() => {
        mount.textContent = "";
        const notice = el("p", "dc-notice", "This episode could not load. Please refresh, or browse all episodes.");
        mount.appendChild(notice);
        mount.appendChild(backLink());
      });

    // in-shell navigation without a full reload
    mount.addEventListener("click", (event) => {
      const nav = event.target.closest("[data-dc-nav]");
      if (!nav || event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      show(nav.dataset.dcNav, true);
    });
    window.addEventListener("popstate", () => show(getSlug(), false));
    document.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target;
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;
      const index = episodes.findIndex((ep) => ep.slug === currentSlug);
      if (index === -1) return;
      const next = event.key === "ArrowLeft" ? episodes[index + 1] : episodes[index - 1];
      if (next) show(next.slug, true);
    });
  }

  /* ---------- boot ---------- */
  const boot = () => {
    document.querySelectorAll("[data-dc-split]").forEach(splitChars);
    observeSplits();
    mountTideCanvas(document.querySelector(".dc-wave"));
    initTrailer();
    initList();
    initEpisode();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
