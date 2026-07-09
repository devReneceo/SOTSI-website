/* =============================================================================
 * Instagram · fila "The latest" (sección 7c del Home SOTSI)
 * -----------------------------------------------------------------------------
 * Lee assets/data/instagram-feed.json (generado por .github/scripts/
 * refresh_instafeed.py — Action diaria "Refresh Instagram latest reels";
 * el token NUNCA llega al cliente) y pinta las 3 tarjetas con el MISMO
 * formato de la fila estática "Most viewed" de index.html.
 * Si el JSON falta o falla, la fila queda oculta (hidden) sin errores.
 * ===========================================================================*/
(function () {
  'use strict';

  var JSON_URL = 'assets/data/instagram-feed.json';
  var LIMIT = 3;

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function compactCount(n) {
    n = Number(n) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  var IG_GLYPH =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/>' +
    '<circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>';

  var PLAY_GLYPH =
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>';

  var HEART_GLYPH =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2 5 5.3 5c2 0 3.4 1.2 4.7 2.8C11.3 6.2 12.7 5 14.7 5 18 5 19.6 8.4 22 11.7 19.5 16.4 12 21 12 21z"/></svg>';

  var CHAT_GLYPH =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 11.5a8.4 8.4 0 0 1-11.9 7.6L3 21l1.9-6.1A8.4 8.4 0 1 1 21 11.5z"/></svg>';

  /* --- tarjeta: espejo exacto del markup estático de la fila "Most viewed" --- */
  function cardHtml(item) {
    var chipLabel = item.media_type === 'VIDEO' ? 'Reel' : 'Post';
    var stats = '';
    if (item.likes != null) {
      stats =
        '<span class="post__meta instafeed__stats">' +
          '<span class="instafeed__stat">' + HEART_GLYPH + compactCount(item.likes) + '</span>' +
          (item.comments != null
            ? '<span class="instafeed__stat">' + CHAT_GLYPH + compactCount(item.comments) + '</span>'
            : '') +
        '</span>';
    }
    return '' +
      '<a class="post post--glow post--insta reveal" href="' + escapeHtml(item.permalink) + '" ' +
        'target="_blank" rel="noopener noreferrer">' +
        '<span class="post__media post__media--reel">' +
          '<img src="' + escapeHtml(item.image) + '" width="720" height="1280" ' +
            'decoding="async" loading="lazy" alt="' + escapeHtml(item.quote) + ' — on Instagram" />' +
          '<span class="post__play" aria-hidden="true">' + PLAY_GLYPH + '</span>' +
          '<span class="post__chip post__chip--insta">' + IG_GLYPH + chipLabel + '</span>' +
        '</span>' +
        '<span class="post__body">' +
          '<h3 class="post__title post__title--insta">&ldquo;' + escapeHtml(item.quote) + '&rdquo;</h3>' +
          stats +
          '<span class="post__cta">Watch on Instagram<span class="post__cta-ico" aria-hidden="true">↗</span></span>' +
        '</span>' +
      '</a>';
  }

  /* --- glow que sigue el cursor (mismo patrón del init global de index.html,
   *     necesario aquí porque estas tarjetas se inyectan después de ese init) --- */
  function bindGlow(card) {
    var raf = 0, mx = 0, my = 0;
    function apply() { raf = 0; card.style.setProperty('--mx', mx + 'px'); card.style.setProperty('--my', my + 'px'); }
    card.addEventListener('pointerenter', function () { card.style.setProperty('--glow', '1'); });
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    card.addEventListener('pointerleave', function () { card.style.setProperty('--glow', '0'); });
  }

  function render(items) {
    var row = document.getElementById('instaLatest');
    var grid = document.getElementById('instaLatestGrid');
    if (!row || !grid || !items.length) return;
    grid.innerHTML = items.slice(0, LIMIT).map(cardHtml).join('');
    row.hidden = false;

    if (window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches) {
      [].slice.call(grid.querySelectorAll('.post--glow')).forEach(bindGlow);
    }
    // En anim-reveal/anim-kinetic las .reveal nacen ocultas; si la sección ya está
    // en viewport al inyectar (caso borde), se revelan a mano para no quedar invisibles.
    var animated = document.body.classList.contains('anim-reveal') ||
                   document.body.classList.contains('anim-kinetic');
    if (animated) {
      var r = row.getBoundingClientRect();
      if (r.top < (window.innerHeight || 0) && r.bottom > 0) {
        [].slice.call(row.querySelectorAll('.reveal')).forEach(function (el) { el.classList.add('in'); });
      }
    }
  }

  function load() {
    fetch(JSON_URL, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        var items = (data && Array.isArray(data.items)) ? data.items.filter(function (it) {
          return it && it.permalink && it.image && it.quote;
        }) : [];
        render(items);
      })
      .catch(function () { /* sin feed → la fila queda oculta, sin ruido */ });
  }

  if (document.readyState !== 'loading') load();
  else document.addEventListener('DOMContentLoaded', load);
})();
