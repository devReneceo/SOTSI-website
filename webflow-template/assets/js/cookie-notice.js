/* SOTSI · Cookie notice — Webflow runtime v1.0.0 (handle sotsicookies)
   Paridad con el aviso del WordPress vivo (barra inferior "This website uses
   cookies… ACCEPT / Learn more"), re-estilado a la marca: card navy glass,
   texto marfil, ACCEPT dorado (oro como único acento), "Learn more" →
   /privacy-policy#sec-6 (la sección "Cookies" de la Privacy Policy).

   - Aviso informativo (igual que el WP actual), no un CMP: aquí no corre
     analytics y los embeds de YouTube usan facade click-to-play (no sueltan
     cookies hasta que el usuario da play).
   - La aceptación se guarda en localStorage bajo clave VERSIONADA
     (sotsi_cc_v1) — no bloquea ver cambios nuevos del sitio.
   - Para re-mostrarlo en pruebas: abrir cualquier página con ?cookies=reset
     (limpia el flag y vuelve a salir), o borrar Site Data del navegador.
   - 0 CLS (position:fixed), animación transform/opacity, respeta
     prefers-reduced-motion, botones focusables y aria-label.
*/
(function () {
  "use strict";

  var KEY = "sotsi_cc_v1";
  var PRIVACY_HREF = "/privacy-policy#sec-6";
  var COPY = "This website uses cookies to improve your experience. " +
    "We'll assume you're ok with this, but you can opt-out if you wish.";

  /* ?cookies=reset → limpiar y volver a mostrar (testing) */
  try {
    if (new URLSearchParams(location.search).get("cookies") === "reset") {
      localStorage.removeItem(KEY);
    }
  } catch (e) { /* URL rara: seguimos */ }

  var accepted = null;
  try { accepted = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  if (accepted && accepted.choice === "accepted") return;

  var CSS = "" +
    ".sotsi-cc{position:fixed;left:50%;bottom:max(16px,env(safe-area-inset-bottom,16px));" +
    "transform:translate(-50%,18px);opacity:0;z-index:9990;box-sizing:border-box;" +
    "display:flex;flex-wrap:wrap;gap:10px 22px;align-items:center;justify-content:center;" +
    "width:calc(100vw - 32px);max-width:860px;padding:16px 22px;border-radius:16px;" +
    "background:rgba(14,22,49,.94);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);" +
    "border:1px solid rgba(254,212,87,.26);box-shadow:0 18px 48px rgba(5,10,25,.45);" +
    "color:#f6f1e7;font-size:.92rem;line-height:1.5;" +
    "transition:transform .5s cubic-bezier(.16,1,.3,1),opacity .5s ease}" +
    ".sotsi-cc.is-in{transform:translate(-50%,0);opacity:1}" +
    ".sotsi-cc__text{margin:0;flex:1 1 26rem;min-width:15rem}" +
    ".sotsi-cc__actions{display:flex;align-items:center;gap:18px;flex:0 0 auto}" +
    ".sotsi-cc__accept{cursor:pointer;border:0;border-radius:999px;padding:.62em 1.5em;" +
    "background:var(--gold,#fed457);color:var(--navy,#0e1631);font:inherit;font-weight:700;" +
    "font-size:.82rem;letter-spacing:.14em;text-transform:uppercase;" +
    "transition:transform .2s ease,box-shadow .2s ease}" +
    ".sotsi-cc__accept:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(254,212,87,.35)}" +
    ".sotsi-cc__accept:focus-visible{outline:2px solid var(--gold,#fed457);outline-offset:3px}" +
    ".sotsi-cc__more{color:#f6f1e7;opacity:.85;text-decoration:underline;" +
    "text-underline-offset:3px;white-space:nowrap}" +
    ".sotsi-cc__more:hover{opacity:1;color:var(--gold,#fed457)}" +
    "@media(prefers-reduced-motion:reduce){.sotsi-cc{transition:none}}" +
    "@media(max-width:560px){.sotsi-cc{gap:12px;padding:14px 18px;font-size:.88rem}" +
    ".sotsi-cc__actions{width:100%;justify-content:space-between}}";

  var show = function () {
    if (document.getElementById("sotsi-cc")) return;

    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var bar = document.createElement("div");
    bar.id = "sotsi-cc";
    bar.className = "sotsi-cc";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Cookies notice");

    var text = document.createElement("p");
    text.className = "sotsi-cc__text";
    text.textContent = COPY;

    var actions = document.createElement("div");
    actions.className = "sotsi-cc__actions";

    var accept = document.createElement("button");
    accept.type = "button";
    accept.className = "sotsi-cc__accept";
    accept.textContent = "Accept";

    var more = document.createElement("a");
    more.className = "sotsi-cc__more";
    more.href = PRIVACY_HREF;
    more.textContent = "Learn more";

    actions.appendChild(accept);
    actions.appendChild(more);
    bar.appendChild(text);
    bar.appendChild(actions);
    document.body.appendChild(bar);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () { bar.classList.add("is-in"); });
    });

    accept.addEventListener("click", function () {
      try {
        localStorage.setItem(KEY, JSON.stringify({ v: 1, choice: "accepted", ts: Date.now() }));
      } catch (e) { /* modo privado: el banner igual se cierra esta sesión */ }
      bar.classList.remove("is-in");
      var gone = function () { if (bar.parentNode) bar.parentNode.removeChild(bar); };
      bar.addEventListener("transitionend", gone, { once: true });
      setTimeout(gone, 600);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(show, 600); }, { once: true });
  } else {
    setTimeout(show, 600);
  }
})();
