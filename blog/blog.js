/* Soul Feed behavior (blog/ + blog/post/).
   List page: editorial Spotify-style directory rendered from
   assets/data/blog-index.json — hero cover stack, Editor's Picks, series
   shelves with scroll-snap, search + chips + sort grid view, batched
   "Load more", sessionStorage state restore. Detail shell: renders one post
   shard (?post=<slug>) with a YouTube facade, rich-text body, series
   prev/next cards, arrow keys and history.pushState navigation.
   Patterns ported from deepcast/deepcast.js — nav wiring stays in internal.js. */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const IS_POST = Boolean(document.querySelector("[data-bl-post]"));
  const ROOT = IS_POST ? "../../" : "../";
  const LIST_URL = IS_POST ? "../" : "./";
  const DATA_URL = `${ROOT}assets/data/blog-index.json`;
  const SHARD_URL = (slug) => `${ROOT}assets/data/blog/${encodeURIComponent(slug)}.json`;
  const ART_DIR = `${ROOT}assets/images/blog/`;
  const artSrc = (post, hero) => ART_DIR + ((hero ? post.hero : post.thumb) || "_default.webp");
  const BATCH = 24;
  const TOPIC_CHIPS = 6;                 // how many topic filters to surface in the toolbar
  const STORE_KEY = "bl:list:v5";        // v5 — Exclude posts hidden; v4 — Soul Feast/Snack moved to Deepcast
  // Regla del cliente (2026-07-27): estos posts son Deepcast Show Notes (Ginni
  // Media) / serie Miracle / Soul Thoughts — NO blogs. En el board 22d-trello
  // llevan categories[0]="Exclude" y el sitio Webflow los filtra por ese dato
  // (soulfeed-webflow v1.3.0); los datos del proto vienen de WP y no traen el
  // flag, así que aquí va el snapshot de slugs (fuente de verdad = el board).
  // Fuera del LISTING; el detalle por link directo sigue abriendo (a propósito).
  const EXCLUDED_SLUGS = new Set([
    "moments-with-marianne-internet",
    "explore-multisensory-perception-and-spiritual-partnership",
    "gary-zukav-and-linda-francis-share-their-insight",
    "the-ongoing-conversation",
    "the-new-male-and-authentic-power-internet",
    "the-catherine-bradford-show-seattle",
    "rhythm-flow-radio-dallas",
    "im-thankful-network-seattle",
    "the-miracle-of-the-coronavirus-part-3",
    "the-miracle-of-the-coronavirus-part-2",
    "the-miracle-of-the-coronavirus-part-1",
    "coronavirus-the-heart-of-the-matter",
    "coronavirus-opportunity-or-obstacle",
    "keep-your-eye-on-the-ball",
    "coronavirus-and-karma",
    "love-in-or-lock-down",
    "winter-solstice",
    "universal-human",
  ]);
  const SERIES_VALUES = ["Blog", "Soul Feast", "Soul Snack", "all"]; // JSON values + "all"
  const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Hero visual mode: "wall" = 3D auto-scrolling mosaic of recent covers (21st-inspired),
  // "stack" = original 3-card tilt. Flip to "stack" (or restore blog/_hero-backup/) to revert.
  const HERO_VISUAL = "wall";
  const WALL_COUNT = 42;                 // 6 cols × 7 rows — one grid copy must outgrow the window so the loop hides its seam
  const WALL_COLS = 6;
  const WALL_SPEED = 18;                 // px/s — slow upward drift
  const WALL_GAP = 14;                   // must match the CSS gap of .bl-wall__track / .bl-wall__grid
  // Hero background: interactive Spline 3D galaxy over a brand-colored CSS fallback.
  // false = ship only the brand fallback (poster + aurora), no external Spline load.
  const HERO_SPLINE = true;
  const SPLINE_SCENE = "https://prod.spline.design/us3ALejTXl6usHZ7/scene.splinecode";
  const SPLINE_VIEWER_SRC = "https://unpkg.com/@splinetool/viewer@1.9.48/build/spline-viewer.js"; // pinned

  // Primary reader-facing topic for a post's badge (first cleaned category, if any).
  const primaryTopic = (post) => (post.categories && post.categories[0]) || "";

  const fmtDate = (iso) =>
    iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

  // "Soul Snack #89: Is Your…" → { num: 89, clean: "Is Your…" }
  const titleParts = (post) => {
    const m = post.title.match(/^(Soul (?:Snack|Feast))\s*#(\d+)\s*[:–—-]\s*(.+)$/i);
    if (m) return { num: m[2], clean: m[3] };
    return { num: "", clean: post.title };
  };

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
      if (!res.ok) throw new Error(`blog index ${res.status}`);
      return res.json();
    });
    return indexPromise;
  };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const svg = (markup) => {
    const span = document.createElement("span");
    span.innerHTML = markup; // static icon markup only — never post data
    return span.firstElementChild;
  };
  const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
  const ICON_VIDEO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="m16 10 5-3v10l-5-3z"/></svg>';

  /* ---------- shared card factory ---------- */
  function cardFor(post, opts = {}) {
    const { clean } = titleParts(post);
    const li = el(opts.tag || "li", `bl-card${opts.extraClass ? ` ${opts.extraClass}` : ""}`);
    if (opts.enterIndex !== undefined && !REDUCE) {
      li.classList.add("bl-card--enter");
      li.style.animationDelay = `${Math.min(opts.enterIndex, 10) * 30}ms`;
    }

    const link = el("a", "bl-card__link");
    link.href = `${opts.postBase ?? "post/"}?post=${encodeURIComponent(post.slug)}`;
    if (opts.onNavigate) link.addEventListener("click", opts.onNavigate);

    const cover = el("span", "bl-card__cover");
    const img = document.createElement("img");
    img.src = artSrc(post);
    img.alt = "";
    img.loading = opts.eager ? "eager" : "lazy";
    img.decoding = "async";
    img.width = 320;
    img.height = 320;
    cover.appendChild(img);
    if (post.hasVideo) {
      const flag = el("span", "bl-card__flag");
      flag.appendChild(svg(ICON_VIDEO));
      flag.setAttribute("aria-hidden", "true");
      cover.appendChild(flag);
    }

    const meta = el("span", "bl-card__meta");
    const topic = primaryTopic(post);
    if (topic) meta.appendChild(el("span", "bl-badge bl-badge--topic", topic));

    const title = el("span", "bl-card__title", clean);
    const sub = el("span", "bl-card__sub", `${fmtDate(post.date)} · ${post.readMins} min read`);

    link.append(cover);
    if (meta.childElementCount) link.append(meta);
    link.append(title, sub);
    li.appendChild(link);
    return li;
  }

  /* ---------- list page ---------- */
  function initList() {
    const gridView = $("[data-bl-gridview]");
    if (!gridView) return;
    const grid = $("[data-bl-grid]");
    const searchInput = $("[data-bl-search]");
    const chipsHost = $("[data-bl-chips]");
    const seriesSel = $("[data-bl-series]");
    const sortSel = $("[data-bl-sort]");
    const countEl = $("[data-bl-count]");
    const moreBtn = $("[data-bl-more]");
    const moreNote = $("[data-bl-more-note]");
    const emptyEl = $("[data-bl-empty]");
    const clearBtn = $("[data-bl-clear]");
    const skel = $("[data-bl-skel]");
    const picksHost = $("[data-bl-picks]");
    const stackHost = $("[data-bl-stack]");
    const totalEl = $("[data-bl-total]");

    // Soul Feast/Snack moved to Deepcast — the blog index is now Blog-only, so series is always "all".
    const state = { q: "", topic: "all", series: "all", sort: "new", shown: BATCH };
    const saved = store.get();
    if (saved && typeof saved === "object") {
      state.q = typeof saved.q === "string" ? saved.q : "";
      state.topic = typeof saved.topic === "string" ? saved.topic : "all"; // re-validated after load
      state.series = SERIES_VALUES.includes(saved.series) ? saved.series : "Blog";
      state.sort = ["new", "old", "rank", "az"].includes(saved.sort) ? saved.sort : "new";
      state.shown = Math.max(BATCH, saved.shown | 0);
    }
    if (searchInput) searchInput.value = state.q;
    if (seriesSel) seriesSel.value = state.series;
    if (sortSel) sortSel.value = state.sort;

    let posts = [];
    let chips = [];
    const persist = () =>
      store.set({ q: state.q, topic: state.topic, series: state.series, sort: state.sort, shown: state.shown, scrollY: window.scrollY });
    const navPersist = () => persist();

    const syncChips = () =>
      chips.forEach((chip) => chip.classList.toggle("is-active", chip.dataset.blFilter === state.topic));

    /* --- topic chips (top categories by frequency) --- */
    function buildChips() {
      if (!chipsHost) return;
      const counts = new Map();
      posts.forEach((p) => (p.categories || []).forEach((c) => counts.set(c, (counts.get(c) || 0) + 1)));
      const topics = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOPIC_CHIPS).map(([c]) => c);
      if (!topics.includes(state.topic)) state.topic = "all"; // drop a stale saved topic
      chipsHost.textContent = "";
      chips = ["all", ...topics].map((topic) => {
        const chip = el("button", "chip", topic === "all" ? "All" : topic);
        chip.type = "button";
        chip.dataset.blFilter = topic;
        chip.addEventListener("click", () => {
          state.topic = topic;
          syncChips();
          update({ shown: BATCH });
        });
        chipsHost.appendChild(chip);
        return chip;
      });
      syncChips();
    }

    const matchesTopic = (post) => state.topic === "all" || (post.categories || []).includes(state.topic);
    const matchesSeries = (post) => state.series === "all" || post.series === state.series;

    /* --- content-type select: refresh the option labels with live counts --- */
    function buildSeriesOptions() {
      if (!seriesSel) return;
      const counts = {};
      posts.forEach((p) => { counts[p.series] = (counts[p.series] || 0) + 1; });
      const labels = { Blog: "Blogs", "Soul Feast": "Soul Feasts", "Soul Snack": "Soul Snacks", all: "All posts" };
      Array.prototype.forEach.call(seriesSel.options, (opt) => {
        const n = opt.value === "all" ? posts.length : (counts[opt.value] || 0);
        opt.textContent = `${labels[opt.value] || opt.value} (${n})`;
      });
      seriesSel.value = state.series;
    }

    const filtered = () => {
      const query = state.q.trim().toLowerCase();
      const subset = posts.filter(
        (post) =>
          matchesSeries(post) &&
          matchesTopic(post) &&
          (!query ||
            post.title.toLowerCase().includes(query) ||
            (post.excerpt || "").toLowerCase().includes(query))
      );
      switch (state.sort) {
        case "old": return [...subset].reverse();
        case "az": return [...subset].sort((a, b) => titleParts(a).clean.localeCompare(titleParts(b).clean));
        case "rank": return [...subset].sort((a, b) => (a.rank || 9999) - (b.rank || 9999));
        default: return subset; // index ships newest-first
      }
    };

    /* --- hero cover stack (3 latest) --- */
    function buildStack() {
      if (!stackHost) return;
      posts.slice(0, 3).forEach((post, i) => {
        const img = document.createElement("img");
        img.src = artSrc(post);
        img.alt = "";
        img.loading = i === 0 ? "eager" : "lazy";
        img.decoding = "async";
        img.width = 320;
        img.height = 320;
        img.className = `bl-stack__art bl-stack__art--${i}`;
        stackHost.appendChild(img);
      });
    }

    /* --- hero cover wall: 3D tilted plane with an infinite upward drift
       (vanilla port of 21st's ContributorsWall — two stacked grid copies loop
       via rAF; hover pauses, lifts the cover to full color and shows a title
       tooltip). Reduced motion gets a single static grid instead. --- */
    function buildWall() {
      if (!stackHost) return;
      stackHost.classList.add("is-wall");
      stackHost.removeAttribute("aria-hidden"); // now interactive: each tile links to its post

      // pad to full rows so the looping grid stays rectangular (repeat from the start)
      const picks = posts.slice(0, WALL_COUNT);
      const shortfall = picks.length % WALL_COLS;
      if (picks.length && shortfall) {
        for (let i = 0; i < WALL_COLS - shortfall; i++) picks.push(picks[i % picks.length]);
      }

      // copy 1 is purely visual — hidden from the a11y tree and the tab order
      const makeGrid = (copy) => {
        const gridEl = el("div", "bl-wall__grid");
        if (copy > 0) gridEl.setAttribute("aria-hidden", "true");
        picks.forEach((post, i) => {
          const tile = document.createElement("a");
          tile.className = "bl-wall__tile";
          tile.href = `post/?post=${encodeURIComponent(post.slug)}`;
          tile.setAttribute("aria-label", post.title || "Read post");
          const clean = titleParts(post).clean; // tooltip corto: 2 líneas máx
          tile.dataset.title = clean.length > 60 ? `${clean.slice(0, 57).trimEnd()}…` : clean;
          tile.style.setProperty("--ti", i);
          if (copy > 0) tile.tabIndex = -1;
          const inner = el("span", "bl-wall__tile-in");
          const img = document.createElement("img");
          img.src = artSrc(post);
          img.alt = "";
          img.loading = copy === 0 && i < 12 ? "eager" : "lazy";
          img.decoding = "async";
          img.width = 160;
          img.height = 160;
          inner.appendChild(img);
          tile.appendChild(inner);
          gridEl.appendChild(tile);
        });
        return gridEl;
      };

      // the window owns overflow + mask + perspective; the tooltip lives outside
      // it so the edge fade never eats it
      const win = el("div", "bl-wall__window");
      if (REDUCE) {
        win.appendChild(makeGrid(0));
        stackHost.appendChild(win);
        return;
      }

      const plane = el("div", "bl-wall__plane");
      const track = el("div", "bl-wall__track");
      const first = makeGrid(0);
      track.append(first, makeGrid(1));
      plane.appendChild(track);
      win.appendChild(plane);

      const tip = el("div", "bl-wall__tip");
      tip.hidden = true;

      stackHost.append(win, tip);
      animateWall(stackHost, track, first, tip);
    }

    /* --- wall motion: rAF drift, paused on hover / hidden tab / offscreen hero --- */
    function animateWall(host, track, firstGrid, tip) {
      let wrap = 0; // height of one grid copy + gap — the seamless loop period
      let y = 0;
      let rafId = 0;
      let last = 0;
      let hovered = false;
      let onscreen = true;

      const canRun = () => wrap > 0 && !hovered && onscreen && !document.hidden;

      const step = (now) => {
        rafId = 0;
        if (!canRun()) return;
        const dt = Math.min(64, now - last); // clamp the jump when a tab wakes up
        last = now;
        y -= (WALL_SPEED * dt) / 1000;
        if (y <= -wrap) y += wrap;
        track.style.transform = `translate3d(0, ${y}px, 0)`;
        rafId = requestAnimationFrame(step);
      };

      const play = () => {
        if (rafId || !canRun()) return;
        last = performance.now();
        rafId = requestAnimationFrame(step);
      };
      const pause = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
      };

      if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(() => {
          wrap = firstGrid.offsetHeight + WALL_GAP;
          play();
        }).observe(firstGrid);
      } else {
        wrap = firstGrid.offsetHeight + WALL_GAP;
      }

      // tooltip anchored to the hovered tile; the drift pauses while it shows
      // (mirrors the source component). It survives until the pointer leaves
      // the wall, so the paused grid stays readable.
      host.addEventListener("pointerover", (event) => {
        const tile = event.target.closest(".bl-wall__tile");
        if (!tile || !host.contains(tile)) return;
        hovered = true;
        pause();
        const tileBox = tile.getBoundingClientRect();
        const hostBox = host.getBoundingClientRect();
        tip.textContent = tile.dataset.title || "";
        tip.hidden = !tip.textContent;
        tip.style.left = `${tileBox.left - hostBox.left + tileBox.width / 2}px`;
        tip.style.top = `${tileBox.top - hostBox.top}px`;
      });
      host.addEventListener("pointerleave", () => {
        hovered = false;
        tip.hidden = true;
        play();
      });

      document.addEventListener("visibilitychange", () => (document.hidden ? pause() : play()));

      if ("IntersectionObserver" in window) {
        new IntersectionObserver(
          (entries) => {
            onscreen = entries[0].isIntersecting;
            if (onscreen) play(); else pause();
          },
          { rootMargin: "80px" }
        ).observe(host);
      }

      play();
    }

    /* --- pick hero visual per HERO_VISUAL flag --- */
    function buildHeroVisual() {
      if (HERO_VISUAL === "wall") buildWall();
      else buildStack();
    }

    /* --- Editor's Picks (top 3 by editorial rank) --- */
    function buildPicks() {
      if (!picksHost) return;
      const ranked = posts.filter((p) => p.rank > 0).sort((a, b) => a.rank - b.rank).slice(0, 3);
      if (!ranked.length) {
        const picksSection = picksHost.closest("section");
        if (picksSection) picksSection.setAttribute("hidden", "");
        return;
      }
      picksHost.textContent = "";
      ranked.forEach((post, i) => {
        const { clean } = titleParts(post);
        const card = el("a", `bl-pick${i === 0 ? " bl-pick--lead" : ""}`);
        card.href = `post/?post=${encodeURIComponent(post.slug)}`;
        card.addEventListener("click", navPersist);

        const cover = el("span", "bl-pick__cover");
        const img = document.createElement("img");
        img.src = artSrc(post); // el índice ligero solo trae thumb (640w — sobra para ≤330px)
        img.alt = "";
        img.loading = "eager";
        img.decoding = "async";
        img.width = 320;
        img.height = 320;
        cover.appendChild(img);

        const body = el("span", "bl-pick__body");
        const topic = primaryTopic(post);
        if (topic) {
          const meta = el("span", "bl-card__meta");
          meta.appendChild(el("span", "bl-badge bl-badge--topic", topic));
          body.appendChild(meta);
        }
        body.appendChild(el("span", "bl-pick__title", clean));
        if (i === 0 && post.excerpt) body.appendChild(el("span", "bl-pick__excerpt", post.excerpt));
        body.appendChild(el("span", "bl-card__sub", `${fmtDate(post.date)} · ${post.readMins} min read`));
        const cta = el("span", "bl-pick__cta", "Read the reflection");
        cta.appendChild(svg('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>'));
        body.appendChild(cta);

        card.append(cover, body);
        picksHost.appendChild(card);
      });
    }

    /* --- precise, rAF-debounced layout sync ---
       observes the picks grid's own width (not the viewport) so the lead
       card stacks at exactly the point its columns stop fitting. rAF
       coalesces resize bursts into one paint, so dragging never janks. */
    function initResizeSync() {
      if (!picksHost || typeof ResizeObserver === "undefined") return;
      let raf = 0;
      const apply = () => {
        raf = 0;
        picksHost.classList.toggle("bl-picks__grid--stack", picksHost.clientWidth < 620);
      };
      new ResizeObserver(() => {
        if (!raf) raf = requestAnimationFrame(apply);
      }).observe(picksHost);
    }

    /* --- grid view (the unified archive) --- */
    function renderGrid() {
      const subset = filtered();
      const slice = subset.slice(0, state.shown);
      grid.textContent = "";
      const frag = document.createDocumentFragment();
      slice.forEach((post, i) => frag.appendChild(cardFor(post, { enterIndex: i, eager: i < 8, onNavigate: navPersist })));
      grid.appendChild(frag);

      const remaining = subset.length - slice.length;
      if (moreBtn) moreBtn.hidden = remaining <= 0;
      if (moreNote) moreNote.textContent = subset.length ? `Showing ${slice.length} of ${subset.length}` : "";
      if (emptyEl) emptyEl.hidden = subset.length > 0;
      return subset.length;
    }

    function render() {
      if (gridView) gridView.hidden = false;
      const visible = renderGrid();
      if (countEl) countEl.textContent = `${visible} reflection${visible === 1 ? "" : "s"}`;
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
    if (seriesSel) seriesSel.addEventListener("change", () => update({ series: seriesSel.value, shown: BATCH }));
    if (sortSel) sortSel.addEventListener("change", () => update({ sort: sortSel.value, shown: BATCH }));
    if (moreBtn) moreBtn.addEventListener("click", () => update({ shown: state.shown + BATCH }));
    if (clearBtn) clearBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      state.topic = "all";
      syncChips();
      if (seriesSel) seriesSel.value = "all"; // widen so the reader always lands on results
      if (sortSel) sortSel.value = "new";
      update({ q: "", series: "all", sort: "new", shown: BATCH });
    });

    loadIndex()
      .then((data) => {
        // Soul Feast/Snack viven en Deepcast (/deepcast): el blog es solo "Blog".
        // Se filtra aquí client-side (además del filtro en build_blog.py) para que
        // el listado, el hero total y el redirect de artículos sean correctos
        // aunque el índice traiga las 3 series. Paridad con soulfeed-webflow.
        // v5: y sin los show notes / Exclude (ver EXCLUDED_SLUGS arriba).
        posts = (data.posts || []).filter((p) => p.series === "Blog" && !EXCLUDED_SLUGS.has(p.slug));
        if (totalEl) totalEl.textContent = String(posts.length);
        if (skel) skel.remove();
        buildChips();
        buildSeriesOptions();
        buildHeroVisual();
        buildPicks();
        initResizeSync();
        render();
        if (saved && saved.scrollY > 0) {
          requestAnimationFrame(() => window.scrollTo(0, saved.scrollY));
        }
      })
      .catch(() => {
        if (skel) skel.remove();
        if (gridView) gridView.hidden = false;
        if (moreBtn) moreBtn.hidden = true;
        if (emptyEl) {
          emptyEl.hidden = false;
          const h3 = $("h3", emptyEl);
          const p = $("p", emptyEl);
          if (h3) h3.textContent = "The blog directory could not load.";
          if (p) p.textContent = "Please refresh the page, or read every reflection on seatofthesoul.com/blog.";
          if (clearBtn) clearBtn.remove();
        }
      });

    window.addEventListener("pagehide", persist);
  }

  /* ---------- post detail shell ---------- */
  function initPost() {
    const mount = $("[data-bl-post]");
    if (!mount) return;
    const hero = $("[data-bl-post-hero]");
    const slots = {
      badge: $("[data-post-badge]"),
      num: $("[data-post-num]"),
      title: $("[data-post-title]"),
      editor: $("[data-post-editor]"),
      facts: $("[data-post-facts]"),
      crumb: $("[data-post-crumb]"),
    };
    const getSlug = () => new URLSearchParams(location.search).get("post") || "";

    let posts = [];
    let currentSlug = null;
    let renderSeq = 0; // guards against out-of-order shard fetches on rapid prev/next

    function fillHero(post) {
      const { clean } = titleParts(post);
      const topic = primaryTopic(post);
      if (slots.badge) {
        slots.badge.className = "bl-badge bl-badge--topic";
        slots.badge.textContent = topic;
        slots.badge.hidden = !topic;
      }
      if (slots.num) slots.num.textContent = "";
      if (slots.title) slots.title.textContent = clean;
      if (slots.editor) slots.editor.textContent = post.editor || "Gary Zukav";
      if (slots.facts) slots.facts.textContent = `${fmtDate(post.date)} · ${post.readMins} min read`;
      if (slots.crumb) slots.crumb.textContent = clean.slice(0, 44);
      if (hero) hero.style.setProperty("--post-art", `url("${artSrc(post, true)}")`);
      document.title = `${post.title} · Soul Feed`;
    }

    function videoBlock(post) {
      if (!post.youtubeId) return null;
      const box = el("div", "bl-video");
      const img = document.createElement("img");
      img.src = artSrc(post, true);
      img.alt = "";
      img.width = 1280;
      img.height = 720;
      const btn = el("button", "bl-video__btn");
      btn.type = "button";
      btn.setAttribute("aria-label", `Play the video of ${post.title}`);
      const circle = el("span", "bl-video__play");
      circle.setAttribute("aria-hidden", "true");
      circle.appendChild(svg(ICON_PLAY));
      const label = el("p", "bl-video__label", "Watch this reflection");
      btn.append(circle, label);
      btn.addEventListener("click", () => {
        const iframe = document.createElement("iframe");
        iframe.src = `https://www.youtube-nocookie.com/embed/${post.youtubeId}?autoplay=1&rel=0`;
        iframe.title = post.title;
        iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        iframe.allowFullscreen = true;
        box.textContent = "";
        box.appendChild(iframe);
      }, { once: true });
      box.append(img, btn);
      return box;
    }

    function proseBlock(post) {
      if (!post.bodyHtml) return null;
      const wrap = el("div", "bl-prose");
      const tpl = document.createElement("template");
      tpl.innerHTML = post.bodyHtml; // first-party rich text from tools/build_blog.py
      tpl.content.querySelectorAll("script, style, iframe").forEach((n) => n.remove());
      tpl.content.querySelectorAll("img").forEach((img) => {
        img.loading = "lazy";
        img.decoding = "async";
        img.removeAttribute("width");
        img.removeAttribute("height");
      });
      tpl.content.querySelectorAll("a[href^='http']").forEach((a) => {
        a.target = "_blank";
        a.rel = "noopener";
      });
      wrap.appendChild(tpl.content);
      return wrap;
    }

    function tagsBlock(post) {
      if (!post.categories || !post.categories.length) return null;
      const wrap = el("div", "bl-tags");
      wrap.setAttribute("aria-label", "Topics");
      post.categories.forEach((cat) => wrap.appendChild(el("span", "bl-tag", cat)));
      return wrap;
    }

    function seriesNav(post) {
      if (!post.prevSlug && !post.nextSlug) return null;
      const wrap = el("nav", "bl-post-nav");
      wrap.setAttribute("aria-label", "More reflections");
      wrap.appendChild(el("p", "bl-post-nav__kicker", "Keep reading"));
      const gridEl = el("div", "bl-post-nav__grid");
      const card = (slug, kind) => {
        const entry = posts.find((p) => p.slug === slug);
        // los Exclude no se ofrecen en prev/next (siguen abriendo por link directo)
        if (!entry || EXCLUDED_SLUGS.has(slug)) return null;
        const { clean } = titleParts(entry);
        const a = el("a", `bl-post-nav__card${kind === "next" ? " bl-post-nav__card--next" : ""}`);
        a.href = `?post=${encodeURIComponent(entry.slug)}`;
        a.dataset.blNav = entry.slug;
        const img = document.createElement("img");
        img.src = artSrc(entry);
        img.alt = "";
        img.loading = "lazy";
        img.width = 64;
        img.height = 64;
        const body = el("span");
        body.appendChild(el("p", "bl-post-nav__dir", kind === "next" ? "Next reflection →" : "← Previous reflection"));
        body.appendChild(el("p", "bl-post-nav__title", clean));
        a.append(img, body);
        return a;
      };
      const prev = card(post.prevSlug, "prev");
      const next = card(post.nextSlug, "next");
      if (prev) gridEl.appendChild(prev);
      if (next) gridEl.appendChild(next);
      wrap.appendChild(gridEl);
      const hint = el("p", "bl-post-nav__hint");
      hint.append("Tip: use ");
      hint.appendChild(el("kbd", "", "←"));
      hint.append(" and ");
      hint.appendChild(el("kbd", "", "→"));
      hint.append(" to move between reflections.");
      wrap.appendChild(hint);
      return wrap;
    }

    function moreFrom(post) {
      // Prefer posts that share the lead topic; fall back to the same series.
      const topic = primaryTopic(post);
      const pool = topic
        ? posts.filter((p) => p.slug !== post.slug && (p.categories || []).includes(topic))
        : [];
      const others = (pool.length >= 3 ? pool
        : posts.filter((p) => p.series === post.series && p.slug !== post.slug)).slice(0, 3);
      if (!others.length) return null;
      const label = topic && pool.length >= 3 ? topic : "More reflections";
      const wrap = el("section", "bl-morefrom");
      wrap.setAttribute("aria-label", label);
      const head = el("div", "bl-morefrom__head");
      head.appendChild(el("h2", "bl-morefrom__title", topic && pool.length >= 3 ? `More on ${topic}` : "More reflections"));
      const all = el("a", "bl-shelf__all", "View the archive");
      all.href = `../#directory`;
      head.appendChild(all);
      wrap.appendChild(head);
      const listEl = el("ol", "bl-grid bl-grid--compact");
      others.forEach((p) => listEl.appendChild(cardFor(p, { postBase: "", onNavigate: null })));
      wrap.appendChild(listEl);
      return wrap;
    }

    function backLink() {
      const p = el("p", "bl-back");
      const a = el("a", "int-link");
      a.href = "../#directory";
      a.append("Back to all reflections ");
      a.appendChild(el("span", "arrow", "→"));
      p.appendChild(a);
      return p;
    }

    function renderPost(post, notFound) {
      fillHero(post);
      mount.textContent = "";
      if (notFound) {
        const notice = el("p", "bl-notice", "That reflection wasn't found — showing the latest one instead.");
        notice.setAttribute("role", "status");
        mount.appendChild(notice);
      }
      const inner = el("div", "bl-post__inner");
      const video = videoBlock(post);
      if (video) inner.appendChild(video);
      const prose = proseBlock(post);
      if (prose) inner.appendChild(prose);
      const tags = tagsBlock(post);
      if (tags) inner.appendChild(tags);
      const nav = seriesNav(post);
      if (nav) inner.appendChild(nav);
      mount.appendChild(inner);
      const more = moreFrom(post);
      if (more) mount.appendChild(more);
      mount.appendChild(backLink());
    }

    function show(slug, push) {
      // Soul Feast/Snack moved to Deepcast — redirect their old blog URLs to the episode reader.
      if (slug && /^soul-(feast|snack)-/i.test(slug) && !posts.some((p) => p.slug === slug)) {
        location.replace("../../deepcast/episode/?ep=" + encodeURIComponent(slug));
        return;
      }
      const foundIndex = posts.findIndex((p) => p.slug === slug);
      const index = Math.max(0, foundIndex);
      const entry = posts[index];
      if (!entry) return;
      currentSlug = entry.slug;
      if (push) history.pushState({ post: entry.slug }, "", `?post=${encodeURIComponent(entry.slug)}`);
      const seq = ++renderSeq;
      fetch(SHARD_URL(entry.slug))
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .catch(() => entry) // index entry renders a minimal page if the shard is missing
        .then((full) => {
          if (seq !== renderSeq) return; // a newer navigation already superseded this one
          renderPost({ ...entry, ...full }, foundIndex === -1 && Boolean(slug));
          window.scrollTo({ top: 0, behavior: push && !REDUCE ? "smooth" : "auto" });
        });
    }

    loadIndex()
      .then((data) => {
        // Soul Feast/Snack viven en Deepcast (/deepcast): el blog es solo "Blog".
        // Se filtra aquí client-side (además del filtro en build_blog.py) para que
        // el listado, el hero total y el redirect de artículos sean correctos
        // aunque el índice traiga las 3 series. Paridad con soulfeed-webflow.
        posts = (data.posts || []).filter((p) => p.series === "Blog");
        if (!posts.length) throw new Error("empty index");
        show(getSlug(), false);
      })
      .catch(() => {
        mount.textContent = "";
        const notice = el("p", "bl-notice", "This reflection could not load. Please refresh, or browse all reflections.");
        mount.appendChild(notice);
        mount.appendChild(backLink());
      });

    // in-shell navigation without a full reload
    mount.addEventListener("click", (event) => {
      const nav = event.target.closest("[data-bl-nav]");
      if (!nav || event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      show(nav.dataset.blNav, true);
    });
    window.addEventListener("popstate", () => show(getSlug(), false));
    document.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target;
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;
      const current = posts.find((p) => p.slug === currentSlug);
      if (!current) return;
      // arrows walk the series (prev = older), mirroring the on-page cards
      const shardDir = event.key === "ArrowLeft" ? "prevSlug" : "nextSlug";
      const ordered = posts.filter((p) => p.series === current.series && !EXCLUDED_SLUGS.has(p.slug)); // newest first, sin Exclude
      const at = ordered.findIndex((p) => p.slug === current.slug);
      const next = shardDir === "prevSlug" ? ordered[at + 1] : ordered[at - 1];
      if (next) show(next.slug, true);
    });
  }

  /* ---------- hero galaxy (interactive Spline 3D · list masthead only) ----------
     Layered: --grad-deep (back) → aurora → .bl-hero__nebula (static brand poster)
     → this Spline viewer (fades in when ready) → scrim → copy/wall.
     The CSS poster + aurora are the always-on brand fallback. Spline is loaded
     lazily and only on capable devices, so a slow/failed/absent CDN, a touch
     device, reduced-motion, or Save-Data all degrade to the brand fallback —
     the hero is never empty and never blocks first paint. */
  function mountSpline() {
    const host = $("[data-bl-spline]");
    if (!host) return;
    if (!HERO_SPLINE) return;             // brand fallback (poster + aurora) already renders

    // Gate: skip the heavy WebGL runtime where it doesn't belong.
    if (REDUCE) return;                                        // honor reduced-motion
    if (!matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)").matches) return; // desktop pointer only
    const conn = navigator.connection;
    if (conn && (conn.saveData || /^(slow-)?2g$/.test(conn.effectiveType || ""))) return; // slow/metered

    let loaded = false;                   // whether we've kicked off the viewer script
    let inView = false;

    function ensureViewerScript() {
      // Single shared <script> for the whole page (guarded by a data flag).
      if (window.__splineViewerLoading) return window.__splineViewerLoading;
      window.__splineViewerLoading = new Promise((resolve, reject) => {
        if (customElements.get("spline-viewer")) return resolve();
        const s = document.createElement("script");
        s.type = "module";
        s.src = SPLINE_VIEWER_SRC;
        s.onload = () => resolve();
        s.onerror = reject;
        document.head.appendChild(s);
      });
      return window.__splineViewerLoading;
    }

    function mountViewer() {
      if (loaded) return;
      loaded = true;
      ensureViewerScript()
        .then(() => {
          const viewer = document.createElement("spline-viewer");
          viewer.setAttribute("url", SPLINE_SCENE);
          viewer.setAttribute("loading", "eager");        // we already gate load ourselves
          viewer.setAttribute("loading-anim-type", "none");
          // Reveal robustly: <spline-viewer> emits "load-start" (not "load"), and the
          // event name has drifted across versions — so fade in on any of them, with a
          // guaranteed timeout fallback. The scene is tiny (36 KB), painted well under 1s.
          const reveal = () => host.classList.add("is-ready");
          viewer.addEventListener("load-start", reveal, { once: true });
          viewer.addEventListener("load", reveal, { once: true });
          const revealTimer = setTimeout(reveal, 1000);
          viewer.addEventListener("error", () => {
            clearTimeout(revealTimer);
            host.classList.remove("is-ready");
          });
          host.appendChild(viewer);

          // QA 2026-07-09: tras montar, el WebGL corría en continuo. display:none apaga
          // raster/composición cuando el hero sale del viewport o el tab se oculta
          // (el poster de marca queda detrás); al volver se muestra sin re-init.
          const setRunning = (run) => { viewer.style.display = run ? "" : "none"; };
          const visIO = new IntersectionObserver(([e]) => {
            inView = e.isIntersecting;
            setRunning(inView && !document.hidden);
          }, { threshold: 0, rootMargin: "120px" });
          visIO.observe(host);
          document.addEventListener("visibilitychange", () => setRunning(inView && !document.hidden));

          // Kill the "Built with Spline" badge. It's added to the viewer's open
          // shadow root as #logo — sometimes only AFTER the scene finishes
          // loading, so a one-shot removal misses it. Remove it on sight and keep
          // a MutationObserver alive to catch late/re-added instances, plus inject
          // a hiding stylesheet as a belt-and-suspenders against re-styling.
          const killBadge = (root) =>
            root.querySelectorAll('#logo, a[href*="spline.design"]').forEach((el) => el.remove());
          let badgeTries = 0;
          const badgeTimer = setInterval(() => {
            const root = viewer.shadowRoot;
            if (!root) { if (++badgeTries > 40) clearInterval(badgeTimer); return; }
            clearInterval(badgeTimer);
            if (!root.querySelector("style[data-hide-logo]")) {
              const st = document.createElement("style");
              st.setAttribute("data-hide-logo", "");
              st.textContent = '#logo,a[href*="spline.design"]{display:none!important}';
              root.appendChild(st);
            }
            killBadge(root);
            new MutationObserver(() => killBadge(root)).observe(root, { childList: true, subtree: true });
          }, 100);
        })
        .catch(() => {
          // Script/CDN failed → leave the brand fallback untouched.
          window.__splineViewerLoading = null;
          loaded = false;
        });
    }

    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) { mountViewer(); io.disconnect(); }
    }, { threshold: 0, rootMargin: "200px" });
    io.observe(host);
  }

  /* ---------- boot ---------- */
  const boot = () => {
    mountSpline();
    initList();
    initPost();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
