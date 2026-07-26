/* SOTSI · deepcast-webflow.js v1.5.0 — /podcast parity with the static prototype.
   v1.5.0 (2026-07-25): filtro por serie en el toolbar — chips All · Soul Feast ·
   Soul Snack (los Soul Feast/Snack se movieron del blog a Deepcast). El resto
   del filtrado ya existía; solo faltaban los botones (antes solo "All").
   Adapts sotsi landing/podcast/deepcast.js to the Webflow-native page built by MCP:
   Soul Tide canvas (immersive) + trailer (lazy <video>) + split headings + artwork
   marquee + Spotify-style directory fetched from the GH Pages episodes index.
   Data + artwork stay on GH Pages (CORS *): the CMS import stays optional.
   Episode links are slug-aware: CMS template when the item is live, YouTube
   otherwise; ALL_LIVE auto-flips once the (hidden) legacy Collection List holds
   >= 20 pod_cards after the future CMS import. ES2017-safe. Served via jsDelivr
   (pinned by SHA), applied per page as a hosted script. */
(function () {
  "use strict";
  if (window.__sotsiDeepcast) return;
  window.__sotsiDeepcast = 1;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  var GH = "https://devreneceo.github.io/SOTSI-website/";
  var DATA_URL = GH + "assets/data/episodes-index.json";
  var SHORTS_URL = GH + "assets/data/shorts-mapping.json";
  var SHORTS_ENABLED = false; // TEMP: off while matches are being validated — flip to true to re-enable
  var ART_DIR = GH + "assets/images/episodes/";
  var TRAILER_MP4 = GH + "assets/Gary-Zukav-Podcast-Trailer-web.mp4";
  var mp3Url = function (megaId) { return "https://traffic.megaphone.fm/" + megaId + ".mp3"; };
  var artSrc = function (ep) { return ART_DIR + (ep.thumb || "_default.webp"); };
  var SERIES_LABEL = { feast: "Soul Feast", snack: "Soul Snack", special: "Special" };
  var BATCH = 30;
  var STORE_KEY = "dc:list:v1";

  /* CMS-aware episode links. LIVE_SLUGS = items already imported; once the
     hidden legacy Collection List renders >= 20 cards (post-import) every
     slug resolves to its native /podcast/<slug> template page. */
  var LIVE_SLUGS = { "soul-snack-74-every-moment-is-big": 1 };
  var ALL_LIVE = $all(".pod_card").length >= 20;
  var epHref = function (ep) {
    if (ALL_LIVE || LIVE_SLUGS[ep.slug]) return "/podcast/" + encodeURIComponent(ep.slug);
    if (ep.youtubeId) return "https://www.youtube.com/watch?v=" + encodeURIComponent(ep.youtubeId);
    return "";
  };
  var isExt = function (href) { return href.indexOf("http") === 0; };

  var fmtDur = function (sec) {
    if (!sec) return "";
    return Math.max(1, Math.round(sec / 60)) + " min";
  };
  var fmtDate = function (iso) {
    return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  var store = {
    get: function () { try { return JSON.parse(sessionStorage.getItem(STORE_KEY)); } catch (e) { return null; } },
    set: function (v) { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch (e) {} }
  };

  var indexPromise = null;
  var loadIndex = function () {
    indexPromise = indexPromise || fetch(DATA_URL).then(function (res) {
      if (!res.ok) throw new Error("episodes index " + res.status);
      return res.json();
    });
    return indexPromise;
  };

  var shortsPromise = null;
  var loadShorts = function () {
    shortsPromise = shortsPromise || fetch(SHORTS_URL).then(function (res) {
      return res.ok ? res.json() : { bySlug: {} };
    }).catch(function () { return { bySlug: {} }; });
    return shortsPromise;
  };
  var withShorts = function (ep, shortsBySlug) {
    ep.shorts = shortsBySlug[ep.slug] || [];
    return ep;
  };

  var el = function (tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  var svg = function (markup) {
    var span = document.createElement("span");
    span.innerHTML = markup; /* static icon markup only — never episode data */
    return span.firstElementChild;
  };
  var ICON_PLAY = '<svg class="ico-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
  var ICON_PAUSE = '<svg class="ico-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.5 5h4v14h-4zM13.5 5h4v14h-4z"/></svg>';
  var ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg>';

  /* ---------- Shorts: inline click-to-play card + on-site modal (never link out to youtube.com) ---------- */
  var shortCard = function (short) {
    var box = el("div", "dc-short");
    var img = document.createElement("img");
    img.src = "https://i.ytimg.com/vi/" + short.id + "/hqdefault.jpg";
    img.alt = "";
    img.loading = "lazy";
    var btn = el("button", "dc-short__btn");
    btn.type = "button";
    btn.setAttribute("aria-label", "Play the Short: " + short.title);
    var circle = el("span", "dc-trailer__play");
    circle.setAttribute("aria-hidden", "true");
    circle.appendChild(svg(ICON_PLAY.replace(' class="ico-play"', "")));
    btn.appendChild(circle);
    btn.addEventListener("click", function () {
      var iframe = document.createElement("iframe");
      iframe.src = "https://www.youtube-nocookie.com/embed/" + short.id + "?autoplay=1&rel=0";
      iframe.title = short.title;
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.setAttribute("allowfullscreen", "");
      box.innerHTML = "";
      box.appendChild(iframe);
    });
    var label = el("p", "dc-short__label", short.title);
    box.appendChild(img);
    box.appendChild(btn);
    box.appendChild(label);
    return box;
  };

  var shortsModalEl = null;
  var openShortsModal = function (ep) {
    if (!shortsModalEl) {
      shortsModalEl = el("div", "dc-shmodal");
      shortsModalEl.setAttribute("role", "dialog");
      shortsModalEl.setAttribute("aria-modal", "true");
      shortsModalEl.hidden = true;
      var backdrop = el("div", "dc-shmodal__backdrop");
      var panel = el("div", "dc-shmodal__panel");
      var closeBtn = el("button", "dc-shmodal__close");
      closeBtn.type = "button";
      closeBtn.setAttribute("aria-label", "Close");
      closeBtn.textContent = "×";
      var title = el("p", "dc-shmodal__title");
      var row = el("div", "dc-shmodal__row");
      panel.appendChild(closeBtn);
      panel.appendChild(title);
      panel.appendChild(row);
      shortsModalEl.appendChild(backdrop);
      shortsModalEl.appendChild(panel);
      document.body.appendChild(shortsModalEl);
      var close = function () {
        shortsModalEl.hidden = true;
        document.body.classList.remove("dc-shmodal-open");
        row.innerHTML = "";
      };
      backdrop.addEventListener("click", close);
      closeBtn.addEventListener("click", close);
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !shortsModalEl.hidden) close();
      });
      shortsModalEl._row = row;
      shortsModalEl._title = title;
    }
    shortsModalEl._title.textContent = ep.shorts.length > 1
      ? "Shorts from " + ep.fullTitle
      : "Short from " + ep.fullTitle;
    shortsModalEl._row.innerHTML = "";
    ep.shorts.forEach(function (short) { shortsModalEl._row.appendChild(shortCard(short)); });
    shortsModalEl.hidden = false;
    document.body.classList.add("dc-shmodal-open");
  };

  /* ---------- page prep: reveal gate, anchors, hero fetch priority, form ---------- */
  function prep() {
    document.body.classList.add("dcw-js");
    $all("[data-anchor]").forEach(function (sec) {
      var a = sec.getAttribute("data-anchor");
      if (a && sec.id !== a) sec.id = a;
    });
    var heroImg = $(".dc-hero__bg");
    if (heroImg) { heroImg.loading = "eager"; heroImg.setAttribute("fetchpriority", "high"); }
    var nameInput = $(".newsband .form-card input[type=\"text\"]");
    var mailInput = $(".newsband .form-card input[type=\"email\"]");
    if (nameInput) nameInput.placeholder = "Type your first name";
    if (mailInput) mailInput.placeholder = "Type your email";
  }

  /* ---------- reveal-on-scroll ([data-rv] -> .in) ---------- */
  function observeReveals() {
    var targets = $all("[data-rv]");
    if (!targets.length) return;
    if (reduce || !("IntersectionObserver" in window)) {
      targets.forEach(function (t) { t.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("in"); io.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    targets.forEach(function (t) { io.observe(t); });
  }

  /* ---------- display-word char split ([data-dc-split]) ---------- */
  function splitChars(root) {
    var label = root.getAttribute("aria-label") || root.textContent.trim();
    /* a11y: aria-label prohibido en p/span genéricos → texto a hermano .sr-only
       + aria-hidden en el contenedor spliteado (patrón soul-tide v1.1.1) */
    if (!root.getAttribute("data-srdone")) {
      var sr = document.createElement("span");
      sr.className = "sr-only";
      sr.textContent = label + " ";
      root.parentNode.insertBefore(sr, root);
      root.setAttribute("data-srdone", "1");
    }
    root.removeAttribute("aria-label");
    root.setAttribute("aria-hidden", "true");
    var index = 0;
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 1) { walk(child); return; }
        if (child.nodeType !== 3) return;
        var frag = document.createDocumentFragment();
        child.textContent.split("").forEach(function (ch) {
          if (/\s/.test(ch)) { frag.appendChild(document.createTextNode(ch)); return; }
          var span = document.createElement("span");
          span.className = "dc-ch";
          span.setAttribute("aria-hidden", "true");
          span.style.setProperty("--ci", index++);
          span.textContent = ch;
          frag.appendChild(span);
        });
        child.parentNode.replaceChild(frag, child);
      });
    };
    walk(root);
  }
  function observeSplits() {
    var targets = $all("[data-dc-split]");
    if (!targets.length) return;
    targets.forEach(splitChars);
    if (reduce || !("IntersectionObserver" in window)) {
      targets.forEach(function (t) { t.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("in"); io.unobserve(entry.target); }
      });
    }, { threshold: 0.35 });
    targets.forEach(function (t) { io.observe(t); });
  }

  /* ---------- Soul Tide canvas (immersive port of deepcast.js:102-246) ---------- */
  function mountTideCanvas(section) {
    if (!section) return;
    var canvas = document.createElement("canvas");
    canvas.className = "dcw-canvas";
    canvas.setAttribute("aria-hidden", "true");
    section.insertBefore(canvas, section.firstChild);
    var ctx = canvas.getContext("2d", { alpha: true });
    var COOL = [210, 204, 253], WARM = [254, 212, 87];
    var AMOUNTX = 52, AMOUNTY = 80, SEP = 150, WAVE = 40, DRIFT = 0.036;
    var CAM_Y = 300, CAM_Z = 1180;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, cx = 0, cy = 0, focal = 0;
    var count = 0, raf = 0, running = false, inView = true;
    var pxTarget = 0, pyTarget = 0, pxCur = 0, pyCur = 0;
    var lerp = function (a, b, t) { return a + (b - a) * t; };

    function resize() {
      var r = section.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W * 0.5; cy = H * 0.3; focal = H * 0.82;
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var ecx = cx + pxCur, ecy = cy + pyCur;
      var maxDepth = CAM_Z + (AMOUNTY * SEP) / 2;
      for (var ix = 0; ix < AMOUNTX; ix++) {
        for (var iy = 0; iy < AMOUNTY; iy++) {
          var wx = ix * SEP - (AMOUNTX * SEP) / 2;
          var wz = iy * SEP - (AMOUNTY * SEP) / 2;
          var wy = Math.sin((ix + count) * 0.3) * WAVE + Math.sin((iy + count) * 0.5) * WAVE;
          var depth = CAM_Z - wz;
          if (depth < 70) continue;
          var f = focal / depth;
          var sx = ecx + wx * f;
          var sy = ecy - (wy - CAM_Y) * f;
          if (sx < -30 || sx > W + 30 || sy < -30 || sy > H + 30) continue;
          var rad = 0.55 * f * SEP * 0.12;
          if (rad < 0.35) rad = 0.35; else if (rad > 3.4) rad = 3.4;
          var crest = (wy + 2 * WAVE) / (4 * WAVE);
          if (crest < 0) crest = 0; else if (crest > 1) crest = 1;
          var t = crest * crest;
          var rC = lerp(COOL[0], WARM[0], t) | 0;
          var gC = lerp(COOL[1], WARM[1], t) | 0;
          var bC = lerp(COOL[2], WARM[2], t) | 0;
          var fade = 1 - depth / maxDepth;
          if (fade < 0) fade = 0;
          var a = (0.11 + 0.3 * crest) * (0.35 + 0.65 * fade);
          ctx.beginPath();
          ctx.fillStyle = "rgba(" + rC + "," + gC + "," + bC + "," + a.toFixed(3) + ")";
          ctx.arc(sx, sy, rad, 0, 6.2832);
          ctx.fill();
        }
      }
    }
    var scrollBoost = 0, lastY = window.pageYOffset || 0;
    function onWaveScroll() {
      var y = window.pageYOffset || 0, d = y - lastY;
      lastY = y;
      scrollBoost += d * 0.0026;
      if (scrollBoost > 0.9) scrollBoost = 0.9; else if (scrollBoost < -0.9) scrollBoost = -0.9;
    }
    function loop() {
      raf = requestAnimationFrame(loop);
      count += DRIFT + scrollBoost;
      scrollBoost *= 0.92;
      pxCur = lerp(pxCur, pxTarget, 0.06);
      pyCur = lerp(pyCur, pyTarget, 0.06);
      draw();
    }
    function start() { if (running || reduce) return; running = true; loop(); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

    resize();
    draw();
    if (!reduce) start();
    addEventListener("resize", function () { resize(); draw(); }, { passive: true });
    if (!reduce) {
      addEventListener("scroll", onWaveScroll, { passive: true });
      var MAX_PX = 46, MAX_PY = 28;
      section.addEventListener("pointermove", function (e) {
        var r = section.getBoundingClientRect();
        if (!r.width || !r.height) return;
        pxTarget = ((e.clientX - r.left) / r.width - 0.5) * MAX_PX;
        pyTarget = ((e.clientY - r.top) / r.height - 0.5) * MAX_PY;
      }, { passive: true });
      section.addEventListener("pointerleave", function () { pxTarget = 0; pyTarget = 0; });
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else if (inView) start();
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { inView = e.isIntersecting; if (inView) start(); else stop(); });
      }, { threshold: 0 }).observe(section);
    }
  }

  /* ---------- trailer: lazy <video> injected on demand, pauses off-screen ---------- */
  function initTrailer() {
    var wrap = $("[data-dc-trailer]");
    if (!wrap) return;
    var card = $(".dc-trailer__card", wrap);
    var overlay = $("[data-dc-trailer-play]", wrap);
    if (!card || !overlay) return;
    overlay.setAttribute("role", "button");
    overlay.setAttribute("tabindex", "0");
    /* a11y (label-in-name): si el overlay tiene texto visible, el nombre accesible
       debe salir del contenido — se quita el aria-label del canvas. */
    if (overlay.textContent && overlay.textContent.trim()) overlay.removeAttribute("aria-label");
    var video = null;
    var play = function () {
      if (!video) {
        video = document.createElement("video");
        video.playsInline = true;
        video.setAttribute("playsinline", "");
        video.preload = "auto";
        video.controls = true;
        video.setAttribute("aria-label", "Deepcast trailer");
        video.src = TRAILER_MP4;
        card.insertBefore(video, overlay);
      }
      wrap.classList.add("is-playing");
      video.play().catch(function () {});
    };
    overlay.addEventListener("click", play);
    overlay.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); play(); }
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting && video && !video.paused) video.pause();
        });
      }, { threshold: 0 }).observe(wrap);
    }
  }

  /* ---------- shared one-at-a-time mp3 preview ---------- */
  function createPreview() {
    var audio = null, activeBtn = null;
    var stop = function () {
      if (audio) audio.pause();
      if (activeBtn) {
        activeBtn.classList.remove("is-playing");
        activeBtn.setAttribute("aria-pressed", "false");
      }
      activeBtn = null;
    };
    return {
      stop: stop,
      toggle: function (btn, megaId) {
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
      }
    };
  }

  /* ---------- artwork marquee (Tune In) ---------- */
  function buildMarquee(episodes) {
    var host = $("[data-dc-marquee]");
    if (!host) return;
    var picks = episodes.filter(function (ep) { return ep.thumb; }).slice(0, 14);
    if (!picks.length) return;
    var track = el("div", "dc-marquee__track");
    [false, true].forEach(function (isClone) {
      var group = el("div", "dc-marquee__group");
      if (isClone) group.setAttribute("aria-hidden", "true");
      picks.forEach(function (ep) {
        var href = epHref(ep);
        var item = el(href ? "a" : "span", "dc-marquee__item");
        if (href) {
          item.href = href;
          if (isExt(href)) { item.target = "_blank"; item.rel = "noopener"; }
        }
        if (isClone) item.tabIndex = -1;
        var img = document.createElement("img");
        img.src = artSrc(ep);
        img.alt = isClone ? "" : ep.fullTitle;
        img.loading = "lazy";
        img.width = 210; img.height = 210;
        var tag = el("p", "dc-marquee__tag", (SERIES_LABEL[ep.series] || "Episode") + (ep.number ? " #" + ep.number : ""));
        item.appendChild(img);
        item.appendChild(tag);
        group.appendChild(item);
      });
      track.appendChild(group);
    });
    host.appendChild(track);
  }

  /* ---------- toolbar + list scaffolding (the shells ship empty from Webflow) ---------- */
  function buildToolbar(host) {
    var label = el("label", "dc-toolbar__search");
    var sr = el("span", "dcw-hide", "Search episodes");
    var input = document.createElement("input");
    input.type = "search";
    input.setAttribute("data-dc-search", "");
    input.placeholder = "Search episodes — try 'temptation' or 'soulmate'";
    input.autocomplete = "off";
    label.appendChild(sr);
    label.appendChild(svg(ICON_SEARCH));
    label.appendChild(input);

    // v1.5.0: filtro por serie — Deepcast reúne Soul Feast + Soul Snack.
    var chipDefs = [["all", "All"], ["feast", "Soul Feast"], ["snack", "Soul Snack"]];
    var chipEls = chipDefs.map(function (def) {
      var c = el("button", def[0] === "all" ? "chip is-active" : "chip", def[1]);
      c.type = "button";
      c.setAttribute("data-dc-filter", def[0]);
      return c;
    });

    var sortLabel = el("label", "dcw-sortwrap");
    var sortSr = el("span", "dcw-hide", "Sort episodes");
    var select = document.createElement("select");
    select.className = "dc-toolbar__sort";
    select.setAttribute("data-dc-sort", "");
    [["new", "Newest first"], ["old", "Oldest first"]].forEach(function (opt) {
      var o = document.createElement("option");
      o.value = opt[0];
      o.textContent = opt[1];
      select.appendChild(o);
    });
    sortLabel.appendChild(sortSr);
    sortLabel.appendChild(select);

    var count = el("p", "dc-count");
    count.setAttribute("data-dc-count", "");
    count.setAttribute("aria-live", "polite");

    host.appendChild(label);
    chipEls.forEach(function (c) { host.appendChild(c); });
    host.appendChild(sortLabel);
    host.appendChild(count);
  }

  function buildListScaffold(host) {
    var list = document.createElement("ol");
    list.className = "dc-list";
    list.setAttribute("data-dc-list", "");

    var empty = el("div", "dc-empty");
    empty.setAttribute("data-dc-empty", "");
    empty.hidden = true;
    empty.appendChild(el("h3", null, "No episodes match that yet."));
    empty.appendChild(el("p", null, "Try another word, or clear the search and filters."));
    var clear = el("button", "dcw-btn-ghost", "Clear search & filters");
    clear.type = "button";
    clear.setAttribute("data-dc-clear", "");
    empty.appendChild(clear);

    var moreWrap = el("div", "dc-more-wrap");
    var more = el("button", "dcw-btn-ghost", "Load more episodes");
    more.type = "button";
    more.setAttribute("data-dc-more", "");
    more.hidden = true;
    var note = el("p", "dc-more-note");
    note.setAttribute("data-dc-more-note", "");
    note.setAttribute("aria-live", "polite");
    moreWrap.appendChild(more);
    moreWrap.appendChild(note);

    host.appendChild(list);
    host.appendChild(empty);
    host.appendChild(moreWrap);
  }

  /* ---------- directory ---------- */
  function initList() {
    var toolbarHost = $("[data-dc-toolbar]");
    var listHost = $("[data-dc-listhost]");
    if (!toolbarHost || !listHost) return;
    buildToolbar(toolbarHost);
    buildListScaffold(listHost);

    var list = $("[data-dc-list]");
    var searchInput = $("[data-dc-search]");
    var chips = $all("[data-dc-filter]");
    var sortSel = $("[data-dc-sort]");
    var countEl = $("[data-dc-count]");
    var moreBtn = $("[data-dc-more]");
    var moreNote = $("[data-dc-more-note]");
    var emptyEl = $("[data-dc-empty]");
    var clearBtn = $("[data-dc-clear]");
    var skel = $("[data-dc-skel]");
    var preview = createPreview();

    var state = { q: "", series: "all", sort: "new", shown: BATCH };
    var saved = store.get();
    if (saved && typeof saved === "object") {
      state.q = typeof saved.q === "string" ? saved.q : "";
      state.series = ["all", "feast", "snack", "special"].indexOf(saved.series) > -1 ? saved.series : "all";
      state.sort = saved.sort === "old" ? "old" : "new";
      state.shown = Math.max(BATCH, saved.shown | 0);
    }
    if (searchInput) searchInput.value = state.q;
    chips.forEach(function (chip) { chip.classList.toggle("is-active", chip.getAttribute("data-dc-filter") === state.series); });
    if (sortSel) sortSel.value = state.sort;

    var episodes = [];
    var persist = function () {
      store.set({ q: state.q, series: state.series, sort: state.sort, shown: state.shown, scrollY: window.scrollY });
    };

    var filtered = function () {
      var query = state.q.trim().toLowerCase();
      var subset = episodes.filter(function (ep) {
        return (state.series === "all" || ep.series === state.series) &&
          (!query || ep.fullTitle.toLowerCase().indexOf(query) > -1);
      });
      return state.sort === "old" ? subset.slice().reverse() : subset;
    };

    function rowFor(ep, position) {
      var li = el("li", "dc-row dc-row--enter");
      li.style.animationDelay = Math.min(position, 10) * 28 + "ms";

      var num = el("span", "dc-row__num", ep.number ? "#" + ep.number : "·");

      var art = el("span", "dc-row__art");
      var img = document.createElement("img");
      img.src = artSrc(ep);
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.width = 56; img.height = 56;
      art.appendChild(img);

      var main = el("span", "dc-row__main");
      var href = epHref(ep);
      var link = el(href ? "a" : "span", "dc-row__link", ep.title);
      if (href) {
        link.href = href;
        if (isExt(href)) { link.target = "_blank"; link.rel = "noopener"; }
        link.addEventListener("click", persist);
      }
      var sub = el("span", "dc-row__sub");
      var badge = el("span", "dc-badge dc-badge--" + ep.series, SERIES_LABEL[ep.series] || "Episode");
      var subdate = el("span", "dc-row__subdate", fmtDate(ep.date) + (ep.duration ? " · " + fmtDur(ep.duration) : ""));
      sub.appendChild(badge);
      sub.appendChild(subdate);
      if (SHORTS_ENABLED && ep.shorts && ep.shorts.length) {
        var shortsBtn = document.createElement("button");
        shortsBtn.type = "button";
        shortsBtn.className = "dc-badge dc-badge--shorts dc-row__shortslink";
        shortsBtn.textContent = ep.shorts.length > 1 ? "Shorts (" + ep.shorts.length + ")" : "Short";
        shortsBtn.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          openShortsModal(ep);
        });
        sub.appendChild(shortsBtn);
      }
      main.appendChild(link);
      main.appendChild(sub);

      var date = el("span", "dc-row__date", fmtDate(ep.date));
      var dur = el("span", "dc-row__dur", fmtDur(ep.duration));

      li.appendChild(num);
      li.appendChild(art);
      li.appendChild(main);
      li.appendChild(date);
      li.appendChild(dur);

      if (ep.megaId) {
        var play = document.createElement("button");
        play.type = "button";
        play.className = "dc-row__play";
        play.setAttribute("data-dc-play", ep.megaId);
        play.setAttribute("aria-pressed", "false");
        play.setAttribute("aria-label", "Play a preview of " + ep.fullTitle);
        play.appendChild(svg(ICON_PLAY));
        play.appendChild(svg(ICON_PAUSE));
        li.appendChild(play);
      } else {
        li.appendChild(document.createElement("span"));
      }
      return li;
    }

    function render() {
      var subset = filtered();
      var slice = subset.slice(0, state.shown);
      preview.stop();
      list.textContent = "";
      var frag = document.createDocumentFragment();
      slice.forEach(function (ep, i) { frag.appendChild(rowFor(ep, i)); });
      list.appendChild(frag);

      if (countEl) countEl.textContent = subset.length + " episode" + (subset.length === 1 ? "" : "s");
      var remaining = subset.length - slice.length;
      if (moreBtn) moreBtn.hidden = remaining <= 0;
      if (moreNote) moreNote.textContent = subset.length ? "Showing " + slice.length + " of " + subset.length : "";
      if (emptyEl) emptyEl.hidden = subset.length > 0;
    }

    var update = function (patch) {
      for (var k in patch) state[k] = patch[k];
      persist();
      render();
    };

    var debounce = 0;
    if (searchInput) searchInput.addEventListener("input", function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () { update({ q: searchInput.value, shown: BATCH }); }, 130);
    });
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) { c.classList.toggle("is-active", c === chip); });
        update({ series: chip.getAttribute("data-dc-filter"), shown: BATCH });
      });
    });
    if (sortSel) sortSel.addEventListener("change", function () { update({ sort: sortSel.value, shown: BATCH }); });
    if (moreBtn) moreBtn.addEventListener("click", function () { update({ shown: state.shown + BATCH }); });
    if (clearBtn) clearBtn.addEventListener("click", function () {
      if (searchInput) searchInput.value = "";
      chips.forEach(function (c) { c.classList.toggle("is-active", c.getAttribute("data-dc-filter") === "all"); });
      if (sortSel) sortSel.value = "new";
      update({ q: "", series: "all", sort: "new", shown: BATCH });
    });

    list.addEventListener("click", function (event) {
      var btn = event.target.closest ? event.target.closest("[data-dc-play]") : null;
      if (!btn) return;
      event.preventDefault();
      preview.toggle(btn, btn.getAttribute("data-dc-play"));
    });

    Promise.all([loadIndex(), loadShorts()])
      .then(function (results) {
        var data = results[0];
        var shortsBySlug = (results[1] && results[1].bySlug) || {};
        episodes = (data.episodes || []).map(function (ep) { return withShorts(ep, shortsBySlug); });
        if (skel) skel.parentNode.removeChild(skel);
        render();
        buildMarquee(episodes);
        document.body.setAttribute("data-dcw-ready", "1");
        if (saved && saved.scrollY > 0) {
          requestAnimationFrame(function () { window.scrollTo(0, saved.scrollY); });
        }
      })
      .catch(function () {
        if (skel) skel.parentNode.removeChild(skel);
        if (emptyEl) {
          emptyEl.hidden = false;
          var h3 = $("h3", emptyEl);
          var p = $("p", emptyEl);
          if (h3) h3.textContent = "The episode list could not load.";
          if (p) p.textContent = "Please refresh the page, or browse every episode on seatofthesoul.com/podcast.";
          if (clearBtn) clearBtn.parentNode.removeChild(clearBtn);
        }
        document.body.setAttribute("data-dcw-ready", "error");
      });

    window.addEventListener("pagehide", persist);
  }

  function boot() {
    prep();
    observeReveals();
    observeSplits();
    mountTideCanvas($(".dc-wave"));
    initTrailer();
    initList();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
