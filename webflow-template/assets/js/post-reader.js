/* SOTSI · Post reader — Webflow runtime v2.0.0
   Página estática /post (proposal-03.webflow.io). Reader de artículos del blog
   EN el dominio Webflow: lee ?slug= (o ?post=, compat con el reader GH viejo),
   pide el shard al feed live del board 22d-trello (CMS headless, mismo contrato
   que GH Pages) con fallback a GH Pages, y llena los hosts [data-bpr-*].

   v2.0.0 — paridad con el detalle del prototipo (blog/post/ + blog.css §7):
   la portada NUNCA se muestra nítida (los uploads de WP son 371–806px verticales;
   un <img> cover los decapita y pixela) — va difuminada de fondo del hero navy.
   Badge de topic + byline con monograma + breadcrumbs + drop cap + facade de
   video navy/oro (click-to-load, youtube-nocookie) + tags + fuente + cards
   prev/next con thumb + flechas ← →. El CSS vive en el custom code de la
   página /post (patrón /blog); este runtime ya no inyecta estilos.

   El bodyHtml viene SANITIZADO server-side (EditorJs, allowlist) por el board /
   por build_blog.py — único innerHTML de datos; aquí además se retiran
   script/style/iframe (el video se re-emite como facade). SEO client-side:
   document.title, meta description y JSON-LD BlogPosting (transicional hasta
   el import CMS: los slugs live en CMS van directo a /blog/<slug> vía soulfeed).

   ES2017-safe (sin ?., ??, ||=). Guard: window.__sotsiPostReader. */
(function () {
  "use strict";
  if (window.__sotsiPostReader) return;
  window.__sotsiPostReader = true;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  var GH = "https://devreneceo.github.io/SOTSI-website/";
  var BOARD_FEED = "https://trello-22d-juyszotmca-uc.a.run.app/feed/";
  var ART_DIR = GH + "assets/images/blog/";
  var READER_URL = "/post?slug=";
  var DEFAULT_ART = "_default.webp";

  var params = new URLSearchParams(location.search);
  var slug = (params.get("slug") || params.get("post") || "").replace(/[^A-Za-z0-9\-]/g, "");

  var artSrc = function (post, hero) {
    var name = hero ? post.hero : post.thumb;
    if (name && /^https?:\/\//i.test(name)) return name;
    return ART_DIR + (name || DEFAULT_ART);
  };

  /* "Soul Snack #89: Is Your…" → "Is Your…" (los Blog llegan limpios; guard barato) */
  var cleanTitle = function (t) {
    var m = (t || "").match(/^Soul (?:Snack|Feast)\s*#?\d*\s*[:–—-]\s*(.+)$/i);
    return m ? m[1] : (t || "");
  };

  var fmtDate = function (iso) {
    return iso ? new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  };

  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  };

  var setText = function (attr, text) {
    var node = $("[" + attr + "]");
    if (node) node.textContent = text;
    return node;
  };

  var fetchJson = function (url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("feed " + res.status);
      return res.json();
    });
  };
  var loadShard = function () {
    return fetchJson(BOARD_FEED + "blog/" + slug + ".json").catch(function () {
      return fetchJson(GH + "assets/data/blog/" + slug + ".json");
    });
  };
  /* índice (mismo contrato que soulfeed: board-first, filtrado a series Blog) —
     solo alimenta las cards prev/next; si falla se degradan a links simples. */
  var loadIndex = function () {
    return fetchJson(BOARD_FEED + "blog-index.json")
      .catch(function () { return fetchJson(GH + "assets/data/blog-index.json"); })
      .then(function (data) {
        return ((data && data.posts) || []).filter(function (p) { return p.series === "Blog"; });
      })
      .catch(function () { return []; });
  };

  var seo = function (post) {
    document.title = post.title + " | The Seat of the Soul";
    var desc = $('meta[name="description"]');
    if (!desc) {
      desc = document.createElement("meta");
      desc.setAttribute("name", "description");
      document.head.appendChild(desc);
    }
    desc.setAttribute("content", post.excerpt || "");
    var ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.excerpt || "",
      image: artSrc(post, true),
      datePublished: post.date,
      author: { "@type": "Person", name: post.editor || "Gary Zukav" },
      publisher: { "@type": "Organization", name: "The Seat of the Soul Institute" },
      articleSection: post.series,
      mainEntityOfPage: location.origin + READER_URL + encodeURIComponent(slug)
    });
    document.head.appendChild(ld);
  };

  /* ---------- hero ---------- */
  var fillHero = function (post) {
    var badge = $("[data-bpr-kicker]");
    var topic = (post.categories && post.categories[0]) || post.series || "";
    if (badge) {
      badge.className = "bl-badge bl-badge--topic";
      badge.textContent = topic;
      badge.hidden = !topic;
    }
    setText("data-bpr-num", "");
    var clean = cleanTitle(post.title);
    setText("data-bpr-title", clean);
    setText("data-bpr-editor", post.editor || "Gary Zukav");
    setText("data-bpr-meta", fmtDate(post.date) + " · " + post.readMins + " min read");
    setText("data-bpr-crumb", clean.slice(0, 44));
    var art = $("[data-bpr-art]");
    if (art && post.hero && post.hero !== DEFAULT_ART) {
      art.style.backgroundImage = 'url("' + artSrc(post, true) + '")';
    }
  };

  /* ---------- video: youtubeId del shard ∥ primer embed/link del body ---------- */
  var extractVideoId = function (post, content) {
    if (post.youtubeId) return post.youtubeId;
    var ifr = content.querySelector('iframe[src*="youtube"]');
    var m = ifr && (ifr.getAttribute("src") || "").match(/\/embed\/([A-Za-z0-9_-]{6,})/);
    if (m) return m[1];
    var a = content.querySelector('a[href*="youtu.be/"], a[href*="youtube.com/watch"]');
    if (a) {
      m = (a.getAttribute("href") || "").match(/(?:youtu\.be\/|[?&]v=)([A-Za-z0-9_-]{6,})/);
      if (m) {
        /* si el párrafo era solo ese link, se retira (el facade lo reemplaza) */
        var p = a.parentElement;
        if (p && p.textContent.trim() === a.textContent.trim() && p.parentNode) p.parentNode.removeChild(p);
        return m[1];
      }
    }
    return "";
  };

  var ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';

  var videoBlock = function (post, videoId) {
    if (!videoId) return null;
    var box = el("div", "bl-video");
    var img = document.createElement("img");
    /* poster 16:9 del propio video (la portada del post es vertical y chica) */
    img.src = "https://i.ytimg.com/vi/" + videoId + "/maxresdefault.jpg";
    img.onerror = function () {
      img.onerror = null;
      img.src = "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg";
    };
    img.alt = "";
    img.width = 1280;
    img.height = 720;
    var btn = el("button", "bl-video__btn");
    btn.type = "button";
    btn.setAttribute("aria-label", "Play the video of " + post.title);
    var circle = el("span", "bl-video__play");
    circle.setAttribute("aria-hidden", "true");
    circle.innerHTML = ICON_PLAY;
    var label = el("p", "bl-video__label", "Watch this reflection");
    btn.appendChild(circle);
    btn.appendChild(label);
    btn.addEventListener("click", function () {
      var iframe = document.createElement("iframe");
      iframe.src = "https://www.youtube-nocookie.com/embed/" + videoId + "?autoplay=1&rel=0";
      iframe.title = post.title;
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      box.textContent = "";
      box.appendChild(iframe);
    }, { once: true });
    box.appendChild(img);
    box.appendChild(btn);
    return box;
  };

  /* ---------- prosa ---------- */
  var proseBlock = function (content) {
    if (!content.firstChild) return null;
    var wrap = el("div", "bl-prose");
    wrap.appendChild(content);
    return wrap;
  };

  var tagsBlock = function (post) {
    if (!post.categories || !post.categories.length) return null;
    var wrap = el("div", "bl-tags");
    wrap.setAttribute("aria-label", "Topics");
    post.categories.forEach(function (cat) { wrap.appendChild(el("span", "bl-tag", cat)); });
    return wrap;
  };

  var sourceBlock = function (post) {
    if (!post.wpUrl) return null;
    var p = el("p", "bl-source");
    var a = el("a", "int-link");
    a.href = post.wpUrl;
    a.target = "_blank";
    a.rel = "noopener";
    a.appendChild(document.createTextNode("Read on seatofthesoul.com "));
    a.appendChild(el("span", "arrow", "↗"));
    p.appendChild(a);
    return p;
  };

  /* ---------- prev / next ---------- */
  var navCard = function (index, slugTo, kind) {
    var entry = null;
    for (var i = 0; i < index.length; i++) if (index[i].slug === slugTo) { entry = index[i]; break; }
    var a = el("a", "bl-post-nav__card" + (kind === "next" ? " bl-post-nav__card--next" : ""));
    a.href = READER_URL + encodeURIComponent(slugTo);
    if (entry) {
      var img = document.createElement("img");
      img.src = artSrc(entry);
      img.alt = "";
      img.loading = "lazy";
      img.width = 64;
      img.height = 64;
      a.appendChild(img);
    }
    var body = el("span");
    body.appendChild(el("p", "bl-post-nav__dir", kind === "next" ? "Next reflection →" : "← Previous reflection"));
    body.appendChild(el("p", "bl-post-nav__title", entry ? cleanTitle(entry.title) : "Keep reading"));
    a.appendChild(body);
    return a;
  };

  var seriesNav = function (post, index) {
    if (!post.prevSlug && !post.nextSlug) return null;
    var wrap = el("nav", "bl-post-nav");
    wrap.setAttribute("aria-label", "More reflections");
    wrap.appendChild(el("p", "bl-post-nav__kicker", "Keep reading"));
    var grid = el("div", "bl-post-nav__grid");
    if (post.prevSlug) grid.appendChild(navCard(index, post.prevSlug, "prev"));
    if (post.nextSlug) grid.appendChild(navCard(index, post.nextSlug, "next"));
    wrap.appendChild(grid);
    var hint = el("p", "bl-post-nav__hint");
    hint.appendChild(document.createTextNode("Tip: use "));
    hint.appendChild(el("kbd", "", "←"));
    hint.appendChild(document.createTextNode(" and "));
    hint.appendChild(el("kbd", "", "→"));
    hint.appendChild(document.createTextNode(" to move between reflections."));
    wrap.appendChild(hint);
    return wrap;
  };

  var backLink = function () {
    var p = el("p", "bl-back");
    var a = el("a", "int-link");
    a.href = "/blog";
    a.appendChild(document.createTextNode("Back to all reflections "));
    a.appendChild(el("span", "arrow", "→"));
    p.appendChild(a);
    return p;
  };

  var wireArrows = function (post) {
    document.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      var t = event.target;
      if (t && /^(input|textarea|select)$/i.test(t.tagName)) return;
      var dest = event.key === "ArrowLeft" ? post.prevSlug : post.nextSlug;
      if (dest) location.href = READER_URL + encodeURIComponent(dest);
    });
  };

  /* ---------- render ---------- */
  var render = function (post, index) {
    fillHero(post);

    var inner = $("[data-bpr-inner]");
    if (inner) {
      inner.textContent = "";
      var tpl = document.createElement("template");
      tpl.innerHTML = post.bodyHtml || ""; // sanitizado server-side (allowlist)
      var videoId = extractVideoId(post, tpl.content);
      var junk = tpl.content.querySelectorAll("script, style, iframe");
      for (var i = 0; i < junk.length; i++) junk[i].parentNode.removeChild(junk[i]);
      var shells = tpl.content.querySelectorAll("figure.post-embed, .post-embed-frame");
      for (var j = 0; j < shells.length; j++) {
        if (!shells[j].textContent.trim() && shells[j].parentNode) shells[j].parentNode.removeChild(shells[j]);
      }
      var imgs = tpl.content.querySelectorAll("img");
      for (var k = 0; k < imgs.length; k++) {
        imgs[k].loading = "lazy";
        imgs[k].decoding = "async";
        imgs[k].removeAttribute("width");
        imgs[k].removeAttribute("height");
      }
      var links = tpl.content.querySelectorAll("a[href^='http']");
      for (var l = 0; l < links.length; l++) {
        links[l].target = "_blank";
        links[l].rel = "noopener";
      }

      var video = videoBlock(post, videoId);
      if (video) inner.appendChild(video);
      var prose = proseBlock(tpl.content);
      if (prose) inner.appendChild(prose);
      var tags = tagsBlock(post);
      if (tags) inner.appendChild(tags);
      var source = sourceBlock(post);
      if (source) inner.appendChild(source);
      var nav = seriesNav(post, index);
      if (nav) inner.appendChild(nav);
      inner.appendChild(backLink());
    }

    var state = $("[data-bpr-state]");
    if (state) state.hidden = true;
    var art = $("[data-bpr-article]");
    if (art) art.hidden = false;

    wireArrows(post);
    seo(post);
    document.body.setAttribute("data-bpr-ready", "1");
  };

  var fail = function () {
    setText("data-bpr-title", "This reflection could not load");
    setText("data-bpr-crumb", "Not found");
    var state = setText("data-bpr-state", "It may have been unpublished. ");
    if (state) {
      state.hidden = false;
      var a = document.createElement("a");
      a.href = "/blog";
      a.textContent = "← Back to the Soul Feed";
      state.appendChild(a);
    }
    document.body.setAttribute("data-bpr-ready", "error");
  };

  var boot = function () {
    if (!slug) { fail(); return; }
    setText("data-bpr-state", "Loading the reflection…");
    Promise.all([loadShard(), loadIndex()])
      .then(function (res) { render(res[0], res[1]); })
      .catch(fail);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
