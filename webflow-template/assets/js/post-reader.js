/* SOTSI · Post reader — Webflow runtime v1.0.0
   Página estática /post (proposal-03.webflow.io). Reader de artículos del blog
   EN el dominio Webflow: lee ?slug= (o ?post=, compat con el reader GH viejo),
   pide el shard al feed live del board 22d-trello (CMS headless, mismo contrato
   que GH Pages) con fallback a GH Pages, y llena los hosts [data-bpr-*].

   El bodyHtml viene SANITIZADO server-side (EditorJs, allowlist) por el board /
   por build_blog.py — único innerHTML de datos. SEO client-side: document.title,
   meta description y JSON-LD BlogPosting (transicional hasta el import CMS:
   los slugs live en CMS van directo a /blog/<slug> vía soulfeed).

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

  var params = new URLSearchParams(location.search);
  var slug = (params.get("slug") || params.get("post") || "").replace(/[^A-Za-z0-9\-]/g, "");

  var heroSrc = function (post) {
    if (post.hero && /^https?:\/\//i.test(post.hero)) return post.hero;
    if (post.hero) return ART_DIR + post.hero;
    return ART_DIR + slug + "-hero.webp";
  };

  var fmtDate = function (iso) {
    return iso ? new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
  };

  var fetchJson = function (url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("shard " + res.status);
      return res.json();
    });
  };
  var loadShard = function () {
    return fetchJson(BOARD_FEED + "blog/" + slug + ".json").catch(function () {
      return fetchJson(GH + "assets/data/blog/" + slug + ".json");
    });
  };

  /* estilos propios del reader — inyectados por runtime (sin embed en la página) */
  var injectCss = function () {
    if ($("style[data-bpr-css]")) return;
    var st = document.createElement("style");
    st.setAttribute("data-bpr-css", "");
    st.textContent =
      "[data-bpr-state]{text-align:center;padding:72px 20px;font-size:1.1rem}" +
      "[data-bpr-hero] img{width:100%;max-height:440px;object-fit:cover;border-radius:18px;display:block}" +
      "[data-bpr-body]{max-width:720px;margin:0 auto}" +
      "[data-bpr-body] p{margin:0 0 1.15em;line-height:1.75}" +
      "[data-bpr-body] h2,[data-bpr-body] h3{margin:1.6em 0 .6em;line-height:1.25}" +
      "[data-bpr-body] blockquote{margin:1.4em 0;padding:.4em 0 .4em 1.2em;border-left:3px solid #b48d3e;font-style:italic}" +
      "[data-bpr-body] img{max-width:100%;height:auto;border-radius:12px}" +
      "[data-bpr-body] figure{margin:1.6em 0}" +
      "[data-bpr-body] figcaption{font-size:.85em;opacity:.7;margin-top:.4em}" +
      "[data-bpr-body] .post-embed-frame{position:relative;padding-top:56.25%;border-radius:12px;overflow:hidden}" +
      "[data-bpr-body] .post-embed-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}" +
      "[data-bpr-nav]{display:flex;justify-content:space-between;gap:16px;max-width:720px;margin:48px auto 0;flex-wrap:wrap}" +
      "[data-bpr-nav] a{text-decoration:none;font-weight:600}";
    document.head.appendChild(st);
  };

  var setText = function (attr, text) {
    var node = $("[" + attr + "]");
    if (node) node.textContent = text;
    return node;
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
      image: heroSrc(post),
      datePublished: post.date,
      author: { "@type": "Person", name: post.editor || "Gary Zukav" },
      publisher: { "@type": "Organization", name: "The Seat of the Soul Institute" },
      articleSection: post.series,
      mainEntityOfPage: location.origin + READER_URL + encodeURIComponent(slug)
    });
    document.head.appendChild(ld);
  };

  var render = function (post) {
    injectCss();
    setText("data-bpr-kicker", post.series || "");
    setText("data-bpr-title", post.title || "");
    setText("data-bpr-meta", "By " + (post.editor || "Gary Zukav") + " · " + fmtDate(post.date) + " · " + post.readMins + " min read");

    var hero = $("[data-bpr-hero]");
    if (hero) {
      var src = heroSrc(post);
      if (src) {
        var img = document.createElement("img");
        img.src = src;
        img.alt = post.title || "";
        img.width = 1600;
        img.height = 900;
        img.setAttribute("fetchpriority", "high");
        img.onerror = function () { hero.removeChild(img); };
        hero.textContent = "";
        hero.appendChild(img);
      }
    }

    var body = $("[data-bpr-body]");
    if (body) {
      body.innerHTML = post.bodyHtml || ""; // sanitizado server-side (allowlist)
      // video del post: si el shard trae youtubeId reproducible y el cuerpo no
      // incluye ya un iframe, se añade el player al final.
      if (post.youtubeId && !body.querySelector("iframe")) {
        var fig = document.createElement("figure");
        fig.className = "post-embed";
        var frame = document.createElement("div");
        frame.className = "post-embed-frame";
        var ifr = document.createElement("iframe");
        ifr.src = "https://www.youtube.com/embed/" + post.youtubeId;
        ifr.loading = "lazy";
        ifr.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        ifr.allowFullscreen = true;
        frame.appendChild(ifr);
        fig.appendChild(frame);
        body.appendChild(fig);
      }
    }

    var nav = $("[data-bpr-nav]");
    if (nav) {
      nav.textContent = "";
      if (post.prevSlug) {
        var prev = document.createElement("a");
        prev.href = READER_URL + encodeURIComponent(post.prevSlug);
        prev.textContent = "← Previous reflection";
        nav.appendChild(prev);
      }
      nav.appendChild(document.createElement("span"));
      if (post.nextSlug) {
        var next = document.createElement("a");
        next.href = READER_URL + encodeURIComponent(post.nextSlug);
        next.textContent = "Next reflection →";
        nav.appendChild(next);
      }
    }

    var state = $("[data-bpr-state]");
    if (state) state.hidden = true;
    var art = $("[data-bpr-article]");
    if (art) art.hidden = false;

    seo(post);
    document.body.setAttribute("data-bpr-ready", "1");
  };

  var fail = function () {
    var state = setText("data-bpr-state", "This reflection could not load. It may have been unpublished.");
    if (state) {
      state.hidden = false;
      var back = document.createElement("p");
      var a = document.createElement("a");
      a.href = "/blog";
      a.textContent = "← Back to the Soul Feed";
      back.appendChild(a);
      state.appendChild(back);
    }
    document.body.setAttribute("data-bpr-ready", "error");
  };

  var boot = function () {
    if (!slug) { fail(); return; }
    setText("data-bpr-state", "Loading the reflection…");
    loadShard().then(render).catch(fail);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
