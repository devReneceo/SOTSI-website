/* Soul Feed behavior (blog/ + blog/post/).
   List page: editorial Spotify-style directory rendered from
   assets/data/blog-index.json — hero cover stack, Editor's Picks, series
   shelves with scroll-snap, search + chips + sort grid view, batched
   "Load more", sessionStorage state restore. Detail shell: renders one post
   shard (?post=<slug>) with a YouTube facade, rich-text body, series
   prev/next cards, arrow keys and history.pushState navigation.
   Patterns ported from podcast/deepcast.js — nav wiring stays in internal.js. */
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
  const SERIES_ORDER = ["Soul Feast", "Soul Snack"];
  const SERIES_TAG = { "Soul Feast": "feast", "Soul Snack": "snack" };
  const BATCH = 24;
  const STORE_KEY = "bl:list:v1";
  const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;

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
      try { return JSON.parse(sessionStorage.getItem(STORE_KEY)); } catch { return null; }
    },
    set(value) {
      try { sessionStorage.setItem(STORE_KEY, JSON.stringify(value)); } catch { /* private mode */ }
    },
  };

  let indexPromise = null;
  const loadIndex = () => {
    indexPromise ||= fetch(DATA_URL).then((res) => {
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
    const { num, clean } = titleParts(post);
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
    const badge = el("span", `bl-badge bl-badge--${SERIES_TAG[post.series] || "other"}`, post.series);
    meta.appendChild(badge);
    if (num) meta.appendChild(el("span", "bl-card__num", `#${num}`));

    const title = el("span", "bl-card__title", clean);
    const sub = el("span", "bl-card__sub", `${fmtDate(post.date)} · ${post.readMins} min read`);

    link.append(cover, meta, title, sub);
    li.appendChild(link);
    return li;
  }

  /* ---------- list page ---------- */
  function initList() {
    const shelvesHost = $("[data-bl-shelves]");
    if (!shelvesHost) return;
    const gridView = $("[data-bl-gridview]");
    const grid = $("[data-bl-grid]");
    const searchInput = $("[data-bl-search]");
    const chips = [...document.querySelectorAll("[data-bl-filter]")];
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

    const state = { q: "", series: "all", sort: "new", shown: BATCH };
    const saved = store.get();
    if (saved && typeof saved === "object") {
      state.q = typeof saved.q === "string" ? saved.q : "";
      state.series = ["all", ...SERIES_ORDER].includes(saved.series) ? saved.series : "all";
      state.sort = ["new", "old", "rank", "az"].includes(saved.sort) ? saved.sort : "new";
      state.shown = Math.max(BATCH, saved.shown | 0);
    }
    if (searchInput) searchInput.value = state.q;
    chips.forEach((chip) => chip.classList.toggle("is-active", chip.dataset.blFilter === state.series));
    if (sortSel) sortSel.value = state.sort;

    let posts = [];
    const persist = () =>
      store.set({ q: state.q, series: state.series, sort: state.sort, shown: state.shown, scrollY: window.scrollY });
    const navPersist = () => persist();

    const isDefaultView = () => !state.q.trim() && state.series === "all" && state.sort === "new";

    const filtered = () => {
      const query = state.q.trim().toLowerCase();
      const subset = posts.filter(
        (post) =>
          (state.series === "all" || post.series === state.series) &&
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

    /* --- Editor's Picks (top 3 by editorial rank) --- */
    function buildPicks() {
      if (!picksHost) return;
      const ranked = posts.filter((p) => p.rank > 0).sort((a, b) => a.rank - b.rank).slice(0, 3);
      if (!ranked.length) { picksHost.closest("section")?.setAttribute("hidden", ""); return; }
      picksHost.textContent = "";
      ranked.forEach((post, i) => {
        const { num, clean } = titleParts(post);
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
        const meta = el("span", "bl-card__meta");
        meta.appendChild(el("span", `bl-badge bl-badge--${SERIES_TAG[post.series] || "other"}`, post.series));
        if (num) meta.appendChild(el("span", "bl-card__num", `#${num}`));
        body.appendChild(meta);
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

    /* --- shelves (Spotify home view) --- */
    function buildShelves() {
      shelvesHost.textContent = "";
      SERIES_ORDER.forEach((series) => {
        const items = posts.filter((p) => p.series === series);
        if (!items.length) return;
        const shelf = el("section", "bl-shelf");
        shelf.setAttribute("aria-label", `${series} reflections`);

        const head = el("div", "bl-shelf__head");
        const titleWrap = el("div", "bl-shelf__titles");
        titleWrap.appendChild(el("h3", "bl-shelf__title", series));
        titleWrap.appendChild(el("p", "bl-shelf__count", `${items.length} reflections`));
        const controls = el("div", "bl-shelf__controls");
        const showAll = el("button", "bl-shelf__all", "Show all");
        showAll.type = "button";
        showAll.addEventListener("click", () => {
          chips.forEach((c) => c.classList.toggle("is-active", c.dataset.blFilter === series));
          update({ series, shown: BATCH });
          $("#directory")?.scrollIntoView({ behavior: REDUCE ? "auto" : "smooth", block: "start" });
        });
        const mkArrow = (dir) => {
          const b = el("button", `bl-shelf__arrow bl-shelf__arrow--${dir}`);
          b.type = "button";
          b.setAttribute("aria-label", `Scroll ${series} ${dir === "prev" ? "backward" : "forward"}`);
          b.appendChild(svg(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${dir === "prev" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"}"/></svg>`));
          return b;
        };
        const prev = mkArrow("prev");
        const next = mkArrow("next");
        controls.append(showAll, prev, next);
        head.append(titleWrap, controls);

        const scroller = el("ol", "bl-shelf__scroller");
        scroller.setAttribute("tabindex", "0");
        scroller.setAttribute("aria-label", `${series} — horizontal list, scroll for more`);
        items.forEach((post, i) => scroller.appendChild(cardFor(post, { eager: i < 6, onNavigate: navPersist })));

        const page = () => Math.max(scroller.clientWidth * 0.85, 260);
        prev.addEventListener("click", () => scroller.scrollBy({ left: -page(), behavior: REDUCE ? "auto" : "smooth" }));
        next.addEventListener("click", () => scroller.scrollBy({ left: page(), behavior: REDUCE ? "auto" : "smooth" }));
        const syncArrows = () => {
          const max = scroller.scrollWidth - scroller.clientWidth - 4;
          prev.disabled = scroller.scrollLeft <= 4;
          next.disabled = scroller.scrollLeft >= max;
        };
        scroller.addEventListener("scroll", syncArrows, { passive: true });
        addEventListener("resize", syncArrows, { passive: true });
        requestAnimationFrame(syncArrows);

        shelf.append(head, scroller);
        shelvesHost.appendChild(shelf);
      });
    }

    /* --- grid view --- */
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
      const defaultView = isDefaultView();
      shelvesHost.hidden = !defaultView;
      if (gridView) gridView.hidden = defaultView;
      let visible = posts.length;
      if (!defaultView) visible = renderGrid();
      if (countEl) countEl.textContent = `${visible} reflection${visible === 1 ? "" : "s"}`;
    }

    const update = (patch) => {
      Object.assign(state, patch);
      persist();
      render();
    };

    let debounce = 0;
    searchInput?.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => update({ q: searchInput.value, shown: BATCH }), 130);
    });
    chips.forEach((chip) =>
      chip.addEventListener("click", () => {
        chips.forEach((c) => c.classList.toggle("is-active", c === chip));
        update({ series: chip.dataset.blFilter, shown: BATCH });
      })
    );
    sortSel?.addEventListener("change", () => update({ sort: sortSel.value, shown: BATCH }));
    moreBtn?.addEventListener("click", () => update({ shown: state.shown + BATCH }));
    clearBtn?.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      chips.forEach((c) => c.classList.toggle("is-active", c.dataset.blFilter === "all"));
      if (sortSel) sortSel.value = "new";
      update({ q: "", series: "all", sort: "new", shown: BATCH });
    });

    loadIndex()
      .then((data) => {
        posts = data.posts || [];
        if (totalEl) totalEl.textContent = String(posts.length);
        skel?.remove();
        buildStack();
        buildPicks();
        buildShelves();
        render();
        if (saved && saved.scrollY > 0) {
          requestAnimationFrame(() => window.scrollTo(0, saved.scrollY));
        }
      })
      .catch(() => {
        skel?.remove();
        shelvesHost.hidden = true;
        if (gridView) gridView.hidden = false;
        if (moreBtn) moreBtn.hidden = true;
        if (emptyEl) {
          emptyEl.hidden = false;
          const h3 = $("h3", emptyEl);
          const p = $("p", emptyEl);
          if (h3) h3.textContent = "The blog directory could not load.";
          if (p) p.textContent = "Please refresh the page, or read every reflection on seatofthesoul.com/blog.";
          clearBtn?.remove();
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
      const { num, clean } = titleParts(post);
      if (slots.badge) {
        slots.badge.className = `bl-badge bl-badge--${SERIES_TAG[post.series] || "other"}`;
        slots.badge.textContent = post.series;
      }
      if (slots.num) slots.num.textContent = num ? `Reflection #${num}` : "";
      if (slots.title) slots.title.textContent = clean;
      if (slots.editor) slots.editor.textContent = post.editor || "Gary Zukav";
      if (slots.facts) slots.facts.textContent = `${fmtDate(post.date)} · ${post.readMins} min read`;
      if (slots.crumb) slots.crumb.textContent = num ? `${post.series} #${num}` : clean.slice(0, 44);
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

    function sourceBlock(post) {
      if (!post.wpUrl) return null;
      const p = el("p", "bl-source");
      const a = el("a", "int-link");
      a.href = post.wpUrl;
      a.target = "_blank";
      a.rel = "noopener";
      a.append("Read on seatofthesoul.com ");
      a.appendChild(el("span", "arrow", "↗"));
      p.appendChild(a);
      return p;
    }

    function seriesNav(post) {
      if (!post.prevSlug && !post.nextSlug) return null;
      const wrap = el("nav", "bl-post-nav");
      wrap.setAttribute("aria-label", "Series navigation");
      wrap.appendChild(el("p", "bl-post-nav__kicker", `Continue the ${post.series} series`));
      const gridEl = el("div", "bl-post-nav__grid");
      const card = (slug, kind) => {
        const entry = posts.find((p) => p.slug === slug);
        if (!entry) return null;
        const { num, clean } = titleParts(entry);
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
        body.appendChild(el("p", "bl-post-nav__title", num ? `#${num} · ${clean}` : clean));
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
      hint.append(" to move through the series.");
      wrap.appendChild(hint);
      return wrap;
    }

    function moreFrom(post) {
      const others = posts.filter((p) => p.series === post.series && p.slug !== post.slug).slice(0, 3);
      if (!others.length) return null;
      const wrap = el("section", "bl-morefrom");
      wrap.setAttribute("aria-label", `More from ${post.series}`);
      const head = el("div", "bl-morefrom__head");
      head.appendChild(el("h2", "bl-morefrom__title", `More from ${post.series}`));
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
      const source = sourceBlock(post);
      if (source) inner.appendChild(source);
      const nav = seriesNav(post);
      if (nav) inner.appendChild(nav);
      mount.appendChild(inner);
      const more = moreFrom(post);
      if (more) mount.appendChild(more);
      mount.appendChild(backLink());
    }

    function show(slug, push) {
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
        posts = data.posts || [];
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
      const ordered = posts.filter((p) => p.series === current.series); // newest first
      const at = ordered.findIndex((p) => p.slug === current.slug);
      const next = shardDir === "prevSlug" ? ordered[at + 1] : ordered[at - 1];
      if (next) show(next.slug, true);
    });
  }

  /* ---------- boot ---------- */
  const boot = () => {
    initList();
    initPost();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
