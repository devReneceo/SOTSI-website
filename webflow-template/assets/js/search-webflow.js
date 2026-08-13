/* SOTSI · Whole-site search — Webflow runtime v1.1.0
   Paridad con el prototipo sotsi landing/search/search.js (2026-07-16).
   Página: /sotsi-search (proposal-03.webflow.io). Fuse.js (script registrado
   aparte, inyectado ANTES que este) sobre search-index.json servido client-side
   desde GitHub Pages (297 records: 20 pages + 90 blog + 187 episodes).

   v1.1.0 (2026-08-12) — post-import CMS (runbook §2d): blog y episode van a las
   páginas NATIVAS /blog/<slug> y /deepcast/<slug> en la MISMA tab (el _blank
   existía solo porque salían al dominio GH). El slug se parsea del ?post=/?ep=
   del index; si no parsea, fallback al reader GH en _blank (como antes).

   Links:
   - page    → ruta nativa Webflow ("/"+url sin trailing slash; home → "/").
   - blog    → /blog/<slug> nativo (CMS 96 items live).
   - episode → /deepcast/<slug> nativo (CMS 187 items live).

   ES2017-safe (sin ?., ??, ||=). Guard: window.__sotsiSearch. */
(function () {
  "use strict";
  if (window.__sotsiSearch) return;
  window.__sotsiSearch = true;

  var resultsEl = document.querySelector("[data-search-results]");
  if (!resultsEl) return;

  var GH = "https://devreneceo.github.io/SOTSI-website/";
  var BASE = resultsEl.getAttribute("data-base") || "/";
  var INDEX_URL =
    resultsEl.getAttribute("data-index") || GH + "assets/data/search-index.json";
  var MAX_RESULTS = 80;
  var MIN_CHARS = 2;

  var input = document.querySelector("[data-search-input]");
  var form = document.querySelector("[data-search-form]");
  var countEl = document.querySelector("[data-search-count]");
  var emptyEl = document.querySelector("[data-search-empty]");
  var chips = Array.prototype.slice.call(
    document.querySelectorAll("[data-search-filters] .chip")
  );

  var TYPE_LABEL = { page: "Page", blog: "Blog", episode: "Episode" };
  var SERIES_LABEL = { feast: "Soul Feast", snack: "Soul Snack", Blog: "Blog" };
  var ARROW =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';

  /* Leading type glyph per result kind — line icons, tinted by CSS.
     page = document, blog = feather/quill, episode = audio waveform. */
  var ICONS = {
    page:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/></svg>',
    blog:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><path d="M16 8 2 22"/><path d="M17.5 15H9"/></svg>',
    episode:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 10v4"/><path d="M6 6v12"/><path d="M10 3v18"/><path d="M14 8v8"/><path d="M18 5v14"/><path d="M22 10v4"/></svg>',
  };

  var fuse = null;
  var records = [];
  var activeType = "all";
  var query = "";

  /* ---------- helpers ---------- */

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name) || "";
    } catch (e) {
      return "";
    }
  }

  function syncUrl(q) {
    if (!window.history || !window.history.replaceState) return;
    var url = q
      ? window.location.pathname + "?q=" + encodeURIComponent(q)
      : window.location.pathname;
    window.history.replaceState(null, "", url);
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments,
        self = this;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(self, args);
      }, ms);
    };
  }

  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /* Build a regex from the typed query terms (2+ chars). Highlighting exactly
     what the visitor typed reads far cleaner than Fuse's fuzzy char indices. */
  function buildHighlighter(q) {
    var terms = String(q || "")
      .trim()
      .split(/\s+/)
      .filter(function (t) {
        return t.length >= 2;
      })
      .map(escapeRegExp);
    if (!terms.length) return null;
    return new RegExp("(" + terms.join("|") + ")", "gi");
  }

  function highlight(text, re) {
    var esc = escapeHtml(text);
    if (!re) return esc;
    return esc.replace(re, "<mark>$1</mark>");
  }

  function metaLine(rec) {
    if (rec.type === "blog") {
      var s = SERIES_LABEL[rec.series] || rec.series || "Blog";
      return [s, formatDate(rec.date)].filter(Boolean).join(" · ");
    }
    if (rec.type === "episode") {
      var es = SERIES_LABEL[rec.series] || "Episode";
      var num = rec.number != null ? " #" + rec.number : "";
      return [es + num, formatDate(rec.date)].filter(Boolean).join(" · ");
    }
    return ""; // pages: the KIND eyebrow already says "PAGE"
  }

  /* Up to 2 blog topic chips (categories) — untapped index data, blog only. */
  function topicChips(rec) {
    var cats = rec.categories;
    if (rec.type !== "blog" || !cats || !cats.length) return "";
    var out = "";
    for (var i = 0; i < cats.length && i < 2; i++) {
      out +=
        '<span class="srch-card__topic">' + escapeHtml(cats[i]) + "</span>";
    }
    return '<div class="srch-card__tags">' + out + "</div>";
  }

  /* page → Webflow nativo; blog/episode → detail nativa /blog/<slug> ·
     /deepcast/<slug> (slug parseado del ?post=/?ep= del index). Fallback:
     reader GH si el slug no parsea (index viejo/registro raro). */
  function slugFrom(url, key) {
    var m = String(url || "").match(new RegExp("[?&]" + key + "=([A-Za-z0-9\\-]+)"));
    return m ? m[1] : "";
  }

  function hrefFor(rec) {
    if (rec.type === "page") {
      var u = String(rec.url || "").replace(/\/+$/, "");
      return u ? BASE + u : BASE;
    }
    if (rec.type === "blog") {
      var ps = slugFrom(rec.url, "post");
      if (ps) return "/blog/" + ps;
    }
    if (rec.type === "episode") {
      var es2 = slugFrom(rec.url, "ep");
      if (es2) return "/deepcast/" + es2;
    }
    return GH + rec.url;
  }

  /* ---------- rendering ---------- */

  var SR_PREFIX = {
    page: "Page: ",
    blog: "Blog article: ",
    episode: "Deepcast episode: ",
  };

  function cardHtml(rec, re, i) {
    var href = hrefFor(rec);
    /* _blank solo para el fallback externo (GH); todo lo nativo, misma tab. */
    var ext = href.indexOf("http") === 0 ? ' target="_blank" rel="noopener"' : "";
    var titleHtml = highlight(rec.title, re);
    var meta = metaLine(rec);
    var metaHtml = meta
      ? '<span class="srch-card__meta">' + escapeHtml(meta) + "</span>"
      : "";
    var excerpt = rec.excerpt || "";
    var excerptHtml = excerpt
      ? '<p class="srch-card__excerpt">' + highlight(excerpt, re) + "</p>"
      : "";
    var icon = ICONS[rec.type] || ICONS.page;
    var lead = i === 0 ? " srch-card--lead" : ""; // hierarchy: first result only
    var delay = Math.min(i || 0, 10);
    return (
      '<li class="srch-card srch-card--in srch-card--' +
      rec.type +
      lead +
      '" style="--i:' +
      delay +
      '">' +
      '<a class="srch-card__link" href="' +
      escapeHtml(href) +
      '"' +
      ext +
      ">" +
      '<span class="srch-card__go" aria-hidden="true">' +
      ARROW +
      "</span>" +
      '<span class="srch-card__glyph srch-card__glyph--' +
      rec.type +
      '" aria-hidden="true">' +
      icon +
      "</span>" +
      '<div class="srch-card__main">' +
      '<p class="srch-card__head">' +
      '<span class="srch-card__sr">' +
      (SR_PREFIX[rec.type] || "") +
      "</span>" +
      '<span class="srch-card__kind">' +
      (TYPE_LABEL[rec.type] || rec.type) +
      "</span>" +
      metaHtml +
      "</p>" +
      '<h2 class="srch-card__title">' +
      titleHtml +
      "</h2>" +
      excerptHtml +
      topicChips(rec) +
      "</div>" +
      "</a>" +
      "</li>"
    );
  }

  /* Shimmer bars while the index loads — the site's own loading language. */
  function showSkeleton() {
    var bars = "";
    for (var i = 0; i < 6; i++) bars += '<li class="srch-skel__bar"></li>';
    resultsEl.innerHTML = bars;
  }

  function typeCounts(hits) {
    var c = { all: hits.length, page: 0, blog: 0, episode: 0 };
    for (var i = 0; i < hits.length; i++) {
      var t = hits[i].item.type;
      if (c[t] != null) c[t]++;
    }
    return c;
  }

  function updateChips(counts) {
    chips.forEach(function (chip) {
      var t = chip.getAttribute("data-type");
      var n = counts[t] != null ? counts[t] : 0;
      var base = chip.getAttribute("data-label");
      if (!base) {
        base = chip.textContent.replace(/\s*\(\d+\)\s*$/, "");
        chip.setAttribute("data-label", base);
      }
      chip.textContent = base + " (" + n + ")";
      var on = t === activeType;
      chip.classList.toggle("is-active", on);
      chip.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function render() {
    var q = query.trim();
    var browsing = q.length < MIN_CHARS;
    var hits;

    if (browsing) {
      // No query yet: browse the site's pages so the page isn't blank.
      hits = records
        .filter(function (r) {
          return r.type === "page";
        })
        .map(function (r) {
          return { item: r, matches: null };
        });
    } else {
      hits = fuse.search(q);
    }

    var counts = typeCounts(hits);
    updateChips(counts);

    var shown = hits;
    if (activeType !== "all") {
      shown = hits.filter(function (h) {
        return h.item.type === activeType;
      });
    }

    // Count / status line
    if (browsing) {
      countEl.textContent =
        "Browse the site — start typing to search " +
        records.length +
        " pages, articles & episodes.";
    } else if (shown.length) {
      countEl.textContent =
        shown.length +
        (shown.length === 1 ? " result" : " results") +
        ' for "' +
        q +
        '"';
    } else {
      countEl.textContent = 'No results for "' + q + '"';
    }

    // Empty state (only when actively searching)
    var isEmpty = !browsing && shown.length === 0;
    if (emptyEl) emptyEl.hidden = !isEmpty;

    if (isEmpty) {
      resultsEl.innerHTML = "";
      return;
    }

    var slice = shown.slice(0, MAX_RESULTS);
    var re = browsing ? null : buildHighlighter(q);
    var html = "";
    for (var i = 0; i < slice.length; i++) {
      html += cardHtml(slice[i].item, re, i);
    }
    if (shown.length > MAX_RESULTS) {
      html +=
        '<li class="srch-more">Showing the first ' +
        MAX_RESULTS +
        " of " +
        shown.length +
        " — refine your search to narrow it down.</li>";
    }
    resultsEl.innerHTML = html;
  }

  /* ---------- events ---------- */

  var debouncedRender = debounce(function () {
    syncUrl(query);
    render();
  }, 160);

  if (input) {
    input.addEventListener("input", function () {
      query = input.value;
      debouncedRender();
    });
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      query = input ? input.value : query;
      syncUrl(query);
      render();
      if (input) input.focus();
    });
  }

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      activeType = chip.getAttribute("data-type") || "all";
      render();
    });
  });

  if (emptyEl) {
    emptyEl.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-suggest]");
      if (!btn) return;
      query = btn.textContent.trim();
      if (input) input.value = query;
      activeType = "all";
      syncUrl(query);
      render();
      if (input) input.focus();
    });
  }

  /* Fuse llega como script registrado hermano (inyectado antes que este);
     el poll es cinturón por si el orden de inyección cambiara. */
  function whenFuse(cb, fail) {
    var tries = 0;
    (function poll() {
      if (window.Fuse) return cb();
      if (++tries > 25) return fail();
      setTimeout(poll, 80);
    })();
  }

  /* ---------- boot ---------- */

  showSkeleton();

  fetch(INDEX_URL)
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      records = (data && data.records) || [];
      whenFuse(
        function () {
          fuse = new Fuse(records, {
            keys: [
              { name: "title", weight: 0.7 },
              { name: "excerpt", weight: 0.2 },
              { name: "series", weight: 0.05 },
              { name: "categories", weight: 0.05 },
            ],
            threshold: 0.38,
            ignoreLocation: true,
            minMatchCharLength: MIN_CHARS,
            includeScore: true,
          });
          query = getParam("q");
          if (input) input.value = query;
          render();
        },
        function () {
          if (countEl)
            countEl.textContent =
              "Search is unavailable right now. Please try again later.";
          // eslint-disable-next-line no-console
          console.error("Fuse.js failed to load.");
        }
      );
    })
    .catch(function (err) {
      if (countEl)
        countEl.textContent =
          "Search is unavailable right now. Please try again later.";
      // eslint-disable-next-line no-console
      console.error("Search index failed to load:", err);
    });
})();
