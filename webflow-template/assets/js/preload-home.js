/* SOTSI · Home preload — Webflow runtime v1.0.0 (handle sotsipreload)
   Se aplica SOLO en la Home. Cuando el navegador queda ocioso tras load:
   1) calienta el HTTP cache con los JSON que /blog y /deepcast van a pedir
      (feed del board: max-age=300 + stale-while-revalidate=3600; GH Pages:
      max-age=600) — mismas URLs que usan soulfeed/deepcast/post-reader, así
      la navegación siguiente resuelve del caché y el skeleton casi no se ve;
   2) inyecta Speculation Rules (prerender de /blog y /deepcast): Chrome
      pre-renderiza la página completa en background; los browsers sin
      soporte ignoran el tag y se quedan con el warm de JSON.
   Guards: Save-Data / red 2g → no hace nada. Todo best-effort y silencioso.
*/
(function () {
  "use strict";

  var BOARD_FEED = "https://trello-22d-juyszotmca-uc.a.run.app/feed/blog-index.json";
  var GH = "https://devreneceo.github.io/SOTSI-website/";
  var URLS = [
    BOARD_FEED,                                 // /blog y /post (feed del board, ~200 KB)
    GH + "assets/data/episodes-index.json",     // /deepcast (62 KB)
    GH + "assets/data/shorts-mapping.json"      // /deepcast lo baja siempre (chico)
  ];

  var conn = navigator.connection || {};
  if (conn.saveData || /(^|\b)2g/.test(String(conn.effectiveType || ""))) return;

  var warm = function () {
    for (var i = 0; i < URLS.length; i++) {
      try { fetch(URLS[i]).catch(function () {}); } catch (e) { /* best effort */ }
    }
    try {
      var s = document.createElement("script");
      s.type = "speculationrules";
      s.textContent = JSON.stringify({
        prerender: [{ source: "list", urls: ["/blog", "/deepcast"] }]
      });
      document.head.appendChild(s);
    } catch (e) { /* browsers sin soporte simplemente lo ignoran */ }
  };

  var idle = function () {
    if ("requestIdleCallback" in window) requestIdleCallback(warm, { timeout: 4000 });
    else setTimeout(warm, 1500);
  };

  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
})();
