/* SOTSI · Soul Feed (blog listing) — Webflow runtime v1.5.0
   Paridad con el prototipo sotsi landing/blog/blog.js (2026-07-16).
   Página: /blog (proposal-03.webflow.io).

   v1.5.0 (2026-08-11) — QA C47: el restore de scroll (blw:list:v2) corría en
   CUALQUIER llegada a /blog (el scrollY se refrescaba incluso en pagehide y en
   cada update de filtros) => el visitante aterrizaba a media página o al footer.
   Ahora scrollY solo se guarda al navegar a una reflexión (flag one-shot blw:go)
   y el restore se re-aplica tras load para no clampearse pre-settle.

   v1.4.0 (2026-08-04) — el muro 3D (.is-wall) solo se arma cuando
   matchMedia("(min-width:1025px) and (hover:hover) and (pointer:fine)") —
   igual criterio que mountSpline() — en vez de solo por ancho. Motivo:
   confirmado con Playwright contra el sitio publicado que tablets landscape
   reales (iPad Air 1180, iPad Pro 11" 1194, iPad Pro 12.9" 1366 — todos
   ≥1025px) recibían el wall completo sin cambios (hover-tooltip, rotateX 3D,
   drift rAF, full-bleed) idéntico a desktop 1440px, con las fotos cortadas
   en seco al borde del viewport y el copy comprimido — eso es lo que se
   descompone en tablet, no la zona ≤1024 (que ya era un display:none limpio
   y uniforme, sin ningún camino de código que la rompiera visualmente).
   Cualquier caso que no cumpla el matchMedia (≤1024px, o ≥1025px sin puntero
   fino: tablet táctil en landscape) recibe buildShelf(): una tira compacta
   con scroll-snap nativo (.bl-wall__shelf, adaptado de .bl-shelf__scroller
   del prototipo — huérfano, nunca usado, blog/blog.css líneas ~679-697),
   sin rotateX/perspective/drift rAF/tooltip hover — conserva el fade de
   entrada blWallIn y el hover/tap-scale gratis, reusando las mismas clases
   .bl-wall__tile/.bl-wall__tile-in del wall. initHeroVisual() decide el modo
   y reconstruye en resize/orientationchange (debounce 180ms) + on "change"
   del propio matchMedia (cubre conectar/desconectar un trackpad en un iPad
   sin que dispare resize). makeWallTile() factoriza el tile compartido
   entre wall y shelf — ningún tile nuevo puede salir sin aria-label.
   animateWall() ahora devuelve {destroy} para desmontar limpio (rAF +
   ResizeObserver + IntersectionObserver + listeners) al cruzar de modo —
   evita fugas si alguien redimensiona/rota la pantalla repetidas veces.

   v1.3.0 (2026-07-27) — regla del cliente (1.png): los posts cuyo badge dice
   "Exclude" (categories[0] — show notes de Ginni Media, serie Miracle, Soul
   Thoughts) NO son blogs → fuera del listing. OJO dato del board: los 90
   posts Blog llevan "Exclude" en ALGUNA posición de categories (etiqueta
   interna) — filtrar por "contiene Exclude" vaciaría el blog; la regla es
   SOLO categories[0]. Además visibleCats sanea "Exclude" del badge en
   cualquier posición (paridad post-reader). Para revivir un post: en el
   board, quitar "Exclude" o ponerlo después de otra categoría.

   v1.2.0 (2026-07-25) — regla del cliente: el blog muestra SOLO los posts
   "Blog" (90). Los Soul Feast / Soul Snack viven en Deepcast (/podcast) con
   su propio filtro. El feed del board sigue trayendo los 275; se filtra a
   series==="Blog" al cargar y se retira el selector "Content type" del toolbar
   (ya no hay nada que elegir). Sin cambios de diseño.

   v1.1.0 — el board 22d-trello actúa de CMS headless: el índice se pide
   PRIMERO al feed live del board (Cloud Run, mismo contrato JSON) y cae a
   GitHub Pages si el feed no responde (pre-deploy / hiccup). El artículo
   abre en /post?slug=<slug> (reader estático en el dominio Webflow); el arte
   acepta thumbs absolutos (board) o filenames GH.

   Links slug-aware (sin cambios):
   - LIVE = slugs en las Collection Lists legacy OCULTAS (.blg_card_slug)
     → /blog/<slug> nativo.
   - ALL_LIVE: si las listas ocultas traen ≥20 cards (post-import CMS), TODO
     va nativo sin tocar este archivo (runbook §2d).

   ES2017-safe (sin ?., ??, ||=). Guard: window.__sotsiSoulFeed. */
(function () {
  "use strict";
  if (window.__sotsiSoulFeed) return;
  window.__sotsiSoulFeed = true;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var GH = "https://devreneceo.github.io/SOTSI-website/";
  var BOARD_FEED = "https://trello-22d-juyszotmca-uc.a.run.app/feed/"; // board = headless CMS
  var DATA_URL = BOARD_FEED + "blog-index.json";
  var DATA_URL_FALLBACK = GH + "assets/data/blog-index.json";
  var ART_DIR = GH + "assets/images/blog/";
  var READER_URL = "/post?slug=";
  var BATCH = 24;
  var STORE_KEY = "blw:list:v2"; // v2: sin `series` (estado viejo invalidado)
  var GO_KEY = "blw:go"; // one-shot: restaurar scroll SOLO al volver de una reflexión
  var REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;

  var WALL_COUNT = 42;
  var WALL_COLS = 6;
  var WALL_SPEED = 18;
  var WALL_GAP = 14;
  var SHELF_COUNT = 14;
  var HERO_DESKTOP_MQ = "(min-width: 1025px) and (hover: hover) and (pointer: fine)"; // igual criterio que mountSpline()
  var SPLINE_SCENE = "https://prod.spline.design/us3ALejTXl6usHZ7/scene.splinecode";
  var SPLINE_VIEWER_SRC = "https://unpkg.com/@splinetool/viewer@1.9.48/build/spline-viewer.js"; // pinned

  /* --- slugs vivos en CMS: sensor = Collection Lists legacy ocultas (Fase 7A) --- */
  var LIVE = {};
  $all(".blg_card_slug").forEach(function (el) {
    var slug = (el.textContent || "").trim();
    if (slug) LIVE[slug] = 1;
  });
  // OJO: se cuentan slugs ÚNICOS, no .blg_card — los 4 panes legacy duplican
  // cada post (hoy 10 posts = 20 cards; con cards crudas el flip dispararía en falso).
  var ALL_LIVE = Object.keys(LIVE).length >= 20; // post-import las listas se llenan solas

  var postHref = function (slug) {
    if (ALL_LIVE || LIVE[slug]) return { href: "/blog/" + encodeURIComponent(slug), ext: false };
    // v1.1.0: reader estático /post en el MISMO dominio Webflow (antes: GH _blank)
    return { href: READER_URL + encodeURIComponent(slug), ext: false };
  };
  var linkTo = function (a, slug) {
    var t = postHref(slug);
    a.href = t.href;
    if (t.ext) { a.target = "_blank"; a.rel = "noopener"; }
  };

  /* "Exclude" es etiqueta interna de triage del board — nunca se muestra */
  var visibleCats = function (post) {
    return (post.categories || []).filter(function (c) {
      return c && String(c).toLowerCase() !== "exclude";
    });
  };
  /* categories[0]==="Exclude" = show note / no-blog → fuera del listing */
  var isExcluded = function (post) {
    var first = post.categories && post.categories[0];
    return !!first && String(first).toLowerCase() === "exclude";
  };
  var primaryTopic = function (post) { return visibleCats(post)[0] || ""; };
  var fmtDate = function (iso) {
    return iso ? new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  };
  var titleParts = function (post) {
    var m = post.title.match(/^(Soul (?:Snack|Feast))\s*#(\d+)\s*[:–—-]\s*(.+)$/i);
    if (m) return { num: m[2], clean: m[3] };
    return { num: "", clean: post.title };
  };
  // El board emite thumbs como URL absoluta; GH Pages como filename relativo.
  var artSrc = function (post) {
    if (post.thumb && /^https?:\/\//i.test(post.thumb)) return post.thumb;
    return ART_DIR + (post.thumb || "_default.webp");
  };

  var store = {
    get: function () {
      try { return JSON.parse(sessionStorage.getItem(STORE_KEY)); } catch (err) { return null; }
    },
    set: function (value) {
      try { sessionStorage.setItem(STORE_KEY, JSON.stringify(value)); } catch (err) { /* private mode */ }
    }
  };

  var el = function (tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  var svg = function (markup) {
    var span = document.createElement("span");
    span.innerHTML = markup; // solo iconos estáticos, nunca datos de posts
    return span.firstElementChild;
  };
  var ICON_VIDEO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="m16 10 5-3v10l-5-3z"/></svg>';
  var ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg>';
  var ICON_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';

  var srOnly = function (node) {
    node.style.position = "absolute";
    node.style.width = "1px";
    node.style.height = "1px";
    node.style.overflow = "hidden";
    node.style.clip = "rect(0 0 0 0)";
    return node;
  };

  var fetchJson = function (url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("blog index " + res.status);
      return res.json();
    });
  };
  var indexPromise = null;
  var loadIndex = function () {
    if (!indexPromise) {
      // board primero (contenido live publicado desde 22d-trello); GH si falla.
      indexPromise = fetchJson(DATA_URL).catch(function () {
        return fetchJson(DATA_URL_FALLBACK);
      });
    }
    return indexPromise;
  };

  /* ---------- prep: ids, clase JS ---------- */
  function prep() {
    document.body.classList.add("blw-js");
    $all("[data-anchor]").forEach(function (node) {
      if (!node.id) node.id = node.getAttribute("data-anchor");
    });
    $all("[data-dom-id]").forEach(function (node) {
      if (!node.id) node.id = node.getAttribute("data-dom-id");
    });
  }

  /* ---------- reveals (.rv del prototipo → [data-rv]) ---------- */
  function observeReveals() {
    var nodes = $all("[data-rv]");
    if (!nodes.length) return;
    if (REDUCE || !("IntersectionObserver" in window)) {
      nodes.forEach(function (n) { n.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* ---------- shared card factory (blog.js · cardFor) ---------- */
  function cardFor(post, opts) {
    opts = opts || {};
    var parts = titleParts(post);
    var li = el("li", "bl-card");
    if (opts.enterIndex !== undefined && !REDUCE) {
      li.classList.add("bl-card--enter");
      li.style.animationDelay = Math.min(opts.enterIndex, 10) * 30 + "ms";
    }

    var link = el("a", "bl-card__link");
    linkTo(link, post.slug);
    if (opts.onNavigate) link.addEventListener("click", opts.onNavigate);

    var cover = el("span", "bl-card__cover");
    var img = document.createElement("img");
    img.src = artSrc(post);
    img.alt = "";
    img.loading = opts.eager ? "eager" : "lazy";
    img.decoding = "async";
    img.width = 320;
    img.height = 320;
    cover.appendChild(img);
    if (post.hasVideo) {
      var flag = el("span", "bl-card__flag");
      flag.appendChild(svg(ICON_VIDEO));
      flag.setAttribute("aria-hidden", "true");
      cover.appendChild(flag);
    }

    var meta = el("span", "bl-card__meta");
    var topic = primaryTopic(post);
    if (topic) meta.appendChild(el("span", "bl-badge bl-badge--topic", topic));

    var title = el("span", "bl-card__title", parts.clean);
    var sub = el("span", "bl-card__sub", fmtDate(post.date) + " · " + post.readMins + " min read");

    link.appendChild(cover);
    if (meta.childElementCount) link.appendChild(meta);
    link.appendChild(title);
    link.appendChild(sub);
    li.appendChild(link);
    return li;
  }

  /* ---------- toolbar (JS-rendered en el host vacío) ---------- */
  function buildToolbar(host, state) {
    host.textContent = "";

    var searchLabel = el("label", "bl-toolbar__search");
    var searchSr = srOnly(el("span", "", "Search reflections"));
    var searchIcon = svg(ICON_SEARCH);
    var input = document.createElement("input");
    input.type = "search";
    input.setAttribute("data-bl-search", "1");
    input.placeholder = "Search reflections — try 'intuition' or 'fear'";
    input.autocomplete = "off";
    input.value = state.q;
    searchLabel.appendChild(searchSr);
    searchLabel.appendChild(searchIcon);
    searchLabel.appendChild(input);

    var makeSelect = function (srText, dataAttr, options, current) {
      var wrap = el("span", "blw-selwrap");
      var label = el("label");
      label.appendChild(srOnly(el("span", "", srText)));
      var sel = document.createElement("select");
      sel.className = "bl-toolbar__sort";
      sel.setAttribute(dataAttr, "1");
      options.forEach(function (opt) {
        var o = document.createElement("option");
        o.value = opt[0];
        o.textContent = opt[1];
        sel.appendChild(o);
      });
      sel.value = current;
      label.appendChild(sel);
      wrap.appendChild(label);
      return { wrap: wrap, sel: sel };
    };

    // v1.2.0: se retira el selector "Content type" — el blog es solo Blogs.
    var sort = makeSelect("Sort reflections", "data-bl-sort", [
      ["new", "Newest first"],
      ["old", "Oldest first"],
      ["rank", "Editor's ranking"],
      ["az", "A → Z"]
    ], state.sort);

    var count = el("p", "bl-count");
    count.setAttribute("data-bl-count", "1");
    count.setAttribute("aria-live", "polite");

    host.appendChild(searchLabel);
    host.appendChild(sort.wrap);
    host.appendChild(count);

    return { search: input, sortSel: sort.sel, countEl: count };
  }

  /* ---------- gridview + empty + load-more (JS-rendered) ---------- */
  function buildListScaffold(host) {
    host.textContent = "";

    var gridView = el("div", "bl-gridview");
    gridView.setAttribute("data-bl-gridview", "1");
    gridView.hidden = true;

    var grid = el("ol", "bl-grid");
    grid.setAttribute("data-bl-grid", "1");

    var empty = el("div", "bl-empty");
    empty.setAttribute("data-bl-empty", "1");
    empty.hidden = true;
    empty.appendChild(el("h3", "", "No reflections match that yet."));
    empty.appendChild(el("p", "", "Try another word, or clear the search and filters."));
    var clearBtn = el("button", "btn btn--ghost", "Clear search & filters");
    clearBtn.type = "button";
    clearBtn.setAttribute("data-bl-clear", "1");
    empty.appendChild(clearBtn);

    var moreWrap = el("div", "bl-more-wrap");
    var moreBtn = el("button", "btn btn--ghost", "Load more reflections");
    moreBtn.type = "button";
    moreBtn.setAttribute("data-bl-more", "1");
    moreBtn.hidden = true;
    var moreNote = el("p", "bl-more-note");
    moreNote.setAttribute("data-bl-more-note", "1");
    moreNote.setAttribute("aria-live", "polite");
    moreWrap.appendChild(moreBtn);
    moreWrap.appendChild(moreNote);

    gridView.appendChild(grid);
    gridView.appendChild(empty);
    gridView.appendChild(moreWrap);
    host.appendChild(gridView);

    return { gridView: gridView, grid: grid, empty: empty, clearBtn: clearBtn, moreBtn: moreBtn, moreNote: moreNote };
  }

  /* ---------- shared tile factory (blog.js · buildWall, reusado por el shelf) ---------- */
  function makeWallTile(post, i, opts) {
    opts = opts || {};
    var tile = document.createElement("a");
    tile.className = "bl-wall__tile";
    linkTo(tile, post.slug);
    tile.setAttribute("aria-label", post.title || "Read post");
    if (opts.withTooltip) {
      var clean = titleParts(post).clean;
      tile.setAttribute("data-title", clean.length > 60 ? clean.slice(0, 57).replace(/\s+$/, "") + "…" : clean);
    }
    tile.style.setProperty("--ti", i);
    if (opts.duplicate) tile.tabIndex = -1;
    var inner = el("span", "bl-wall__tile-in");
    var img = document.createElement("img");
    img.src = artSrc(post);
    img.alt = "";
    img.loading = opts.eager ? "eager" : "lazy";
    img.decoding = "async";
    img.width = 160;
    img.height = 160;
    inner.appendChild(img);
    tile.appendChild(inner);
    return tile;
  }

  /* ---------- hero cover wall (blog.js · buildWall/animateWall) — solo
     desktop con puntero fino, ver HERO_DESKTOP_MQ / initHeroVisual ---------- */
  function buildWall(stackHost, posts) {
    if (!stackHost) return null;
    stackHost.classList.add("is-wall");
    stackHost.removeAttribute("aria-hidden"); // interactivo: cada tile enlaza a su post

    var picks = posts.slice(0, WALL_COUNT);
    var shortfall = picks.length % WALL_COLS;
    if (picks.length && shortfall) {
      for (var i = 0; i < WALL_COLS - shortfall; i++) picks.push(picks[i % picks.length]);
    }

    var makeGrid = function (copy) {
      var gridEl = el("div", "bl-wall__grid");
      if (copy > 0) gridEl.setAttribute("aria-hidden", "true");
      picks.forEach(function (post, i) {
        gridEl.appendChild(makeWallTile(post, i, {
          withTooltip: true,
          duplicate: copy > 0,
          eager: copy === 0 && i < 12
        }));
      });
      return gridEl;
    };

    var win = el("div", "bl-wall__window");
    if (REDUCE) {
      win.appendChild(makeGrid(0));
      stackHost.appendChild(win);
      return null; // sin listeners/observers/rAF en esta rama — nada que destruir
    }

    var plane = el("div", "bl-wall__plane");
    var track = el("div", "bl-wall__track");
    var first = makeGrid(0);
    track.appendChild(first);
    track.appendChild(makeGrid(1));
    plane.appendChild(track);
    win.appendChild(plane);

    var tip = el("div", "bl-wall__tip");
    tip.hidden = true;

    stackHost.appendChild(win);
    stackHost.appendChild(tip);
    return animateWall(stackHost, track, first, tip);
  }

  function animateWall(host, track, firstGrid, tip) {
    var wrap = 0;
    var y = 0;
    var rafId = 0;
    var last = 0;
    var hovered = false;
    var onscreen = true;
    var ro = null;
    var io = null;

    var canRun = function () { return wrap > 0 && !hovered && onscreen && !document.hidden; };

    var step = function (now) {
      rafId = 0;
      if (!canRun()) return;
      var dt = Math.min(64, now - last);
      last = now;
      y -= (WALL_SPEED * dt) / 1000;
      if (y <= -wrap) y += wrap;
      track.style.transform = "translate3d(0, " + y + "px, 0)";
      rafId = requestAnimationFrame(step);
    };
    var play = function () {
      if (rafId || !canRun()) return;
      last = performance.now();
      rafId = requestAnimationFrame(step);
    };
    var pause = function () {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    };

    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(function () {
        wrap = firstGrid.offsetHeight + WALL_GAP;
        play();
      });
      ro.observe(firstGrid);
    } else {
      wrap = firstGrid.offsetHeight + WALL_GAP;
    }

    var onPointerOver = function (event) {
      var tile = event.target.closest(".bl-wall__tile");
      if (!tile || !host.contains(tile)) return;
      hovered = true;
      pause();
      var tileBox = tile.getBoundingClientRect();
      var hostBox = host.getBoundingClientRect();
      tip.textContent = tile.getAttribute("data-title") || "";
      tip.hidden = !tip.textContent;
      tip.style.left = tileBox.left - hostBox.left + tileBox.width / 2 + "px";
      tip.style.top = tileBox.top - hostBox.top + "px";
    };
    var onPointerLeave = function () {
      hovered = false;
      tip.hidden = true;
      play();
    };
    var onVisibility = function () {
      if (document.hidden) pause(); else play();
    };

    host.addEventListener("pointerover", onPointerOver);
    host.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);

    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(function (entries) {
        onscreen = entries[0].isIntersecting;
        if (onscreen) play(); else pause();
      }, { rootMargin: "80px" });
      io.observe(host);
    }

    play();

    return {
      destroy: function () {
        pause();
        if (ro) ro.disconnect();
        if (io) io.disconnect();
        host.removeEventListener("pointerover", onPointerOver);
        host.removeEventListener("pointerleave", onPointerLeave);
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }

  /* ---------- compact touch shelf — ≤1024px, o ≥1025px sin puntero fino
     (tablet táctil en landscape). Scroll-snap nativo, sin JS de animación;
     adaptado de .bl-shelf__scroller (huérfano en el prototipo). ---------- */
  function buildShelf(stackHost, posts) {
    if (!stackHost) return null; // sin listeners/observers — nada que destruir
    stackHost.classList.add("is-shelf");
    stackHost.removeAttribute("aria-hidden");

    var picks = posts.slice(0, SHELF_COUNT);
    var shelf = el("div", "bl-wall__shelf");
    shelf.setAttribute("tabindex", "0");
    shelf.setAttribute("aria-label", "Recent posts");
    picks.forEach(function (post, i) {
      shelf.appendChild(makeWallTile(post, i, { eager: i < 4 }));
    });
    stackHost.appendChild(shelf);
    return null;
  }

  /* ---------- dispatcher: wall (desktop + puntero fino) vs shelf (todo lo
     demás) — reconstruye SOLO al cruzar HERO_DESKTOP_MQ, nunca en cada
     tick de resize dentro del mismo modo. ---------- */
  function initHeroVisual(stackHost, posts) {
    if (!stackHost) return;
    var mql = matchMedia(HERO_DESKTOP_MQ);
    var mode = null;
    var teardown = null;

    function apply() {
      var next = mql.matches ? "wall" : "shelf";
      if (next === mode) return;
      if (teardown) teardown();
      stackHost.textContent = "";
      stackHost.classList.remove("is-wall", "is-shelf");
      var handle = next === "wall" ? buildWall(stackHost, posts) : buildShelf(stackHost, posts);
      teardown = handle ? handle.destroy : null;
      mode = next;
    }

    apply();

    var t = 0;
    function onResize() { clearTimeout(t); t = setTimeout(apply, 180); }
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    if (mql.addEventListener) mql.addEventListener("change", onResize);
  }

  /* ---------- Editor's Picks (top 3 por rank editorial) ---------- */
  function buildPicks(picksHost, posts, navPersist) {
    if (!picksHost) return;
    var ranked = posts.filter(function (p) { return p.rank > 0; })
      .sort(function (a, b) { return a.rank - b.rank; })
      .slice(0, 3);
    if (!ranked.length) {
      var picksSection = picksHost.closest("section");
      if (picksSection) picksSection.setAttribute("hidden", "");
      return;
    }
    picksHost.textContent = "";
    ranked.forEach(function (post, i) {
      var parts = titleParts(post);
      var card = el("a", "bl-pick" + (i === 0 ? " bl-pick--lead" : ""));
      linkTo(card, post.slug);
      card.addEventListener("click", navPersist);

      var cover = el("span", "bl-pick__cover");
      var img = document.createElement("img");
      img.src = artSrc(post);
      img.alt = "";
      img.loading = "eager";
      img.decoding = "async";
      img.width = 320;
      img.height = 320;
      cover.appendChild(img);

      var body = el("span", "bl-pick__body");
      var topic = primaryTopic(post);
      if (topic) {
        var meta = el("span", "bl-card__meta");
        meta.appendChild(el("span", "bl-badge bl-badge--topic", topic));
        body.appendChild(meta);
      }
      body.appendChild(el("span", "bl-pick__title", parts.clean));
      if (i === 0 && post.excerpt) body.appendChild(el("span", "bl-pick__excerpt", post.excerpt));
      body.appendChild(el("span", "bl-card__sub", fmtDate(post.date) + " · " + post.readMins + " min read"));
      var cta = el("span", "bl-pick__cta", "Read the reflection");
      cta.appendChild(svg(ICON_ARROW));
      body.appendChild(cta);

      card.appendChild(cover);
      card.appendChild(body);
      picksHost.appendChild(card);
    });
  }

  function initResizeSync(picksHost) {
    if (!picksHost || typeof ResizeObserver === "undefined") return;
    var raf = 0;
    var apply = function () {
      raf = 0;
      picksHost.classList.toggle("bl-picks__grid--stack", picksHost.clientWidth < 620);
    };
    new ResizeObserver(function () {
      if (!raf) raf = requestAnimationFrame(apply);
    }).observe(picksHost);
  }

  /* ---------- list page ---------- */
  function initList() {
    var toolbarHost = $("[data-blw-toolbar]");
    var listHost = $("[data-blw-listhost]");
    if (!toolbarHost || !listHost) return;

    var skel = $("[data-bl-skel]");
    var picksHost = $("[data-bl-picks]");
    var stackHost = $("[data-bl-stack]");
    var totalEl = $("[data-bl-total]") || $(".bl-hero__micro strong");

    // v1.2.0: sin `series` — el directorio es solo Blogs.
    var state = { q: "", sort: "new", shown: BATCH };
    var saved = store.get();
    /* C47: el flag se consume aquí — sin click previo en una reflexión, la
       llegada (nav, link directo, refresh) SIEMPRE arranca arriba. */
    var wantScroll = false;
    try {
      wantScroll = sessionStorage.getItem(GO_KEY) === "1";
      if (wantScroll) sessionStorage.removeItem(GO_KEY);
    } catch (err) {}
    if (saved && typeof saved === "object") {
      state.q = typeof saved.q === "string" ? saved.q : "";
      state.sort = ["new", "old", "rank", "az"].indexOf(saved.sort) !== -1 ? saved.sort : "new";
      state.shown = Math.max(BATCH, saved.shown | 0);
    }

    var ui = buildToolbar(toolbarHost, state);
    var scaffold = buildListScaffold(listHost);
    var searchInput = ui.search;
    var sortSel = ui.sortSel;
    var countEl = ui.countEl;
    var gridView = scaffold.gridView;
    var grid = scaffold.grid;
    var emptyEl = scaffold.empty;
    var clearBtn = scaffold.clearBtn;
    var moreBtn = scaffold.moreBtn;
    var moreNote = scaffold.moreNote;

    var posts = [];
    /* persist = filtros (updates/pagehide); conserva el scrollY previo sin refrescarlo.
       navPersist = filtros + scrollY + flag GO — solo al navegar a una reflexión. */
    var persist = function () {
      var prev = store.get();
      store.set({ q: state.q, sort: state.sort, shown: state.shown, scrollY: prev && prev.scrollY > 0 ? prev.scrollY : 0 });
    };
    var navPersist = function () {
      store.set({ q: state.q, sort: state.sort, shown: state.shown, scrollY: window.scrollY });
      try { sessionStorage.setItem(GO_KEY, "1"); } catch (err) {}
    };

    var filtered = function () {
      var query = state.q.trim().toLowerCase();
      var subset = posts.filter(function (post) {
        return !query ||
          post.title.toLowerCase().indexOf(query) !== -1 ||
          (post.excerpt || "").toLowerCase().indexOf(query) !== -1;
      });
      switch (state.sort) {
        case "old": return subset.slice().reverse();
        case "az": return subset.slice().sort(function (a, b) { return titleParts(a).clean.localeCompare(titleParts(b).clean); });
        case "rank": return subset.slice().sort(function (a, b) { return (a.rank || 9999) - (b.rank || 9999); });
        default: return subset; // el índice viene newest-first
      }
    };

    function renderGrid() {
      var subset = filtered();
      var slice = subset.slice(0, state.shown);
      grid.textContent = "";
      var frag = document.createDocumentFragment();
      slice.forEach(function (post, i) {
        frag.appendChild(cardFor(post, { enterIndex: i, eager: i < 8, onNavigate: navPersist }));
      });
      grid.appendChild(frag);

      var remaining = subset.length - slice.length;
      moreBtn.hidden = remaining <= 0;
      moreNote.textContent = subset.length ? "Showing " + slice.length + " of " + subset.length : "";
      emptyEl.hidden = subset.length > 0;
      return subset.length;
    }

    function render() {
      gridView.hidden = false;
      var visible = renderGrid();
      countEl.textContent = visible + " reflection" + (visible === 1 ? "" : "s");
    }

    var update = function (patch) {
      Object.assign(state, patch);
      persist();
      render();
    };

    var debounce = 0;
    searchInput.addEventListener("input", function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () { update({ q: searchInput.value, shown: BATCH }); }, 130);
    });
    sortSel.addEventListener("change", function () { update({ sort: sortSel.value, shown: BATCH }); });
    moreBtn.addEventListener("click", function () { update({ shown: state.shown + BATCH }); });
    clearBtn.addEventListener("click", function () {
      searchInput.value = "";
      sortSel.value = "new";
      update({ q: "", sort: "new", shown: BATCH });
    });

    loadIndex()
      .then(function (data) {
        // v1.2.0: el feed trae los 275 (Blog + Soul Feast + Soul Snack);
        // el blog muestra SOLO "Blog" (los Soul viven en Deepcast /podcast).
        // v1.3.0: y sin los "Exclude" (show notes) — ver isExcluded arriba.
        posts = ((data && data.posts) || []).filter(function (p) {
          return p.series === "Blog" && !isExcluded(p);
        });
        if (totalEl) totalEl.textContent = String(posts.length);
        if (skel) skel.parentNode.removeChild(skel);
        initHeroVisual(stackHost, posts);
        buildPicks(picksHost, posts, navPersist);
        initResizeSync(picksHost);
        render();
        if (wantScroll && saved && saved.scrollY > 0) {
          var goY = saved.scrollY;
          var reScroll = function () { window.scrollTo(0, goY); };
          requestAnimationFrame(reScroll);
          /* re-aplicar tras load: el primer scroll puede clampearse antes de que
             las imágenes lazy asienten la altura del documento */
          if (document.readyState !== "complete") {
            window.addEventListener("load", function () { requestAnimationFrame(reScroll); }, { once: true });
          }
        }
        document.body.setAttribute("data-blw-ready", "1");
      })
      .catch(function () {
        if (skel && skel.parentNode) skel.parentNode.removeChild(skel);
        gridView.hidden = false;
        moreBtn.hidden = true;
        emptyEl.hidden = false;
        var h3 = $("h3", emptyEl);
        var p = $("p", emptyEl);
        if (h3) h3.textContent = "The blog directory could not load.";
        if (p) p.textContent = "Please refresh the page, or read every reflection on seatofthesoul.com/blog.";
        if (clearBtn.parentNode) clearBtn.parentNode.removeChild(clearBtn);
        document.body.setAttribute("data-blw-ready", "error");
      });

    window.addEventListener("pagehide", persist);
  }

  /* ---------- hero galaxy (Spline 3D · solo desktop capaz) ---------- */
  function mountSpline() {
    var host = $("[data-bl-spline]");
    if (!host) return;
    if (REDUCE) return;
    if (!matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)").matches) return;
    var conn = navigator.connection;
    if (conn && (conn.saveData || /^(slow-)?2g$/.test(conn.effectiveType || ""))) return;

    var loaded = false;
    var inView = false;

    function ensureViewerScript() {
      if (window.__splineViewerLoading) return window.__splineViewerLoading;
      window.__splineViewerLoading = new Promise(function (resolve, reject) {
        if (customElements.get("spline-viewer")) return resolve();
        var s = document.createElement("script");
        s.type = "module";
        s.src = SPLINE_VIEWER_SRC;
        s.onload = function () { resolve(); };
        s.onerror = reject;
        document.head.appendChild(s);
      });
      return window.__splineViewerLoading;
    }

    function mountViewer() {
      if (loaded) return;
      loaded = true;
      ensureViewerScript()
        .then(function () {
          var viewer = document.createElement("spline-viewer");
          viewer.setAttribute("url", SPLINE_SCENE);
          viewer.setAttribute("loading", "eager");
          viewer.setAttribute("loading-anim-type", "none");
          // "load-start"/"load" varían por versión → fade-in por evento o timeout.
          var reveal = function () { host.classList.add("is-ready"); };
          viewer.addEventListener("load-start", reveal, { once: true });
          viewer.addEventListener("load", reveal, { once: true });
          var revealTimer = setTimeout(reveal, 1000);
          viewer.addEventListener("error", function () {
            clearTimeout(revealTimer);
            host.classList.remove("is-ready");
          });
          host.appendChild(viewer);

          // WebGL en pausa fuera de viewport / tab oculto (display:none apaga raster)
          var setRunning = function (run) { viewer.style.display = run ? "" : "none"; };
          var visIO = new IntersectionObserver(function (entries) {
            inView = entries[0].isIntersecting;
            setRunning(inView && !document.hidden);
          }, { threshold: 0, rootMargin: "120px" });
          visIO.observe(host);
          document.addEventListener("visibilitychange", function () { setRunning(inView && !document.hidden); });

          // badge "Built with Spline" → fuera (shadow root + observer + hoja de estilo)
          var killBadge = function (root) {
            $all('#logo, a[href*="spline.design"]', root).forEach(function (n) { n.parentNode.removeChild(n); });
          };
          var badgeTries = 0;
          var badgeTimer = setInterval(function () {
            var root = viewer.shadowRoot;
            if (!root) { if (++badgeTries > 40) clearInterval(badgeTimer); return; }
            clearInterval(badgeTimer);
            if (!root.querySelector("style[data-hide-logo]")) {
              var st = document.createElement("style");
              st.setAttribute("data-hide-logo", "");
              st.textContent = '#logo,a[href*="spline.design"]{display:none!important}';
              root.appendChild(st);
            }
            killBadge(root);
            new MutationObserver(function () { killBadge(root); }).observe(root, { childList: true, subtree: true });
          }, 100);
        })
        .catch(function () {
          window.__splineViewerLoading = null;
          loaded = false; // CDN caído → queda el poster de marca
        });
    }

    var io = new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (inView) { mountViewer(); io.disconnect(); }
    }, { threshold: 0, rootMargin: "200px" });
    io.observe(host);
  }

  /* ---------- boot ---------- */
  var boot = function () {
    prep();
    observeReveals();
    mountSpline();
    initList();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
