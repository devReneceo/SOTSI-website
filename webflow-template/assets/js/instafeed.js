/* =============================================================================
 * Instagram Feed · @gary_zukav  (sección 7c del Home SOTSI)
 * -----------------------------------------------------------------------------
 * HOY: mockup con datos simulados (INSTAGRAM_POSTS) renderizados como tarjetas
 *      que reusan el chrome del Blog/Soul Feed (.post .post--glow).
 * MAÑANA: con acceso a Meta, poner IG_CONFIG.useMockData = false y el feed se
 *      sirve desde assets/data/instagram-feed.json (generado server-side con el
 *      token secreto — el token NUNCA va en el cliente). Ver bloque "MAÑANA" abajo.
 * ===========================================================================*/
(function () {
  'use strict';

  var IG_CONFIG = {
    useMockData: true,                               // ← mañana: false
    jsonUrl: 'assets/data/instagram-feed.json',      // feed estático seguro (server-side)
    limit: 3,                                        // ← 3 cards por pedido del cliente (2026-06-30)
    profileUrl: 'https://www.instagram.com/gary_zukav/'
  };

  /* --- MOCK ------------------------------------------------------------------
   * Misma forma que devuelve la Instagram Graph API (objeto "media"):
   *   { id, caption, media_type, media_url, permalink, timestamp,
   *     like_count, comments_count }
   * Fotos: reales de Gary ya presentes en assets/images/ (object-fit:cover → 1:1).
   * Captions: PLACEHOLDER en la voz de Gary (Authentic Power) — reemplazar por el
   * caption real del API. Sin fechas inventadas en la UI (timestamp solo para orden).
   * permalink → perfil real para no romper el mockup; el API trae el /p/<shortcode>/.
   * ------------------------------------------------------------------------- */
  var INSTAGRAM_POSTS = [
    {
      id: 'mock-1', media_type: 'IMAGE',
      media_url: 'assets/images/Gary_outside_smiling_cb_146-scaled.jpg',
      permalink: IG_CONFIG.profileUrl,
      caption: 'Authentic power is the alignment of your personality with your soul. Choose it, one decision at a time. 🌿',
      timestamp: '', like_count: 4820, comments_count: 186
    },
    {
      id: 'mock-2', media_type: 'IMAGE',
      media_url: 'assets/images/6a3342a6143842a748166468_gary-zukav-emotional-awareness-spiritual-growth.webp',
      permalink: IG_CONFIG.profileUrl,
      caption: 'Emotional awareness is the doorway. What you feel is showing you exactly where to grow.',
      timestamp: '', like_count: 3175, comments_count: 92
    },
    {
      id: 'mock-3', media_type: 'IMAGE',
      media_url: 'assets/images/greeting-poster.webp',
      permalink: IG_CONFIG.profileUrl,
      caption: 'Love is the antidote to fear. Every moment offers the choice again. 💛',
      timestamp: '', like_count: 6140, comments_count: 241
    },
    {
      id: 'mock-4', media_type: 'IMAGE',
      media_url: 'assets/images/6a3342a6143842a74816646a_gary-zukav-author-new-york-times-best-seller.webp',
      permalink: IG_CONFIG.profileUrl,
      caption: 'A new reflection on the spiritual partnership at the heart of The Seat of the Soul.',
      timestamp: '', like_count: 2890, comments_count: 74
    },
    {
      id: 'mock-5', media_type: 'IMAGE',
      media_url: 'assets/images/Gary_standing_smiling_cb_019-scaled.jpg',
      permalink: IG_CONFIG.profileUrl,
      caption: 'Reverence for life begins the moment you slow down enough to notice it.',
      timestamp: '', like_count: 3962, comments_count: 118
    },
    {
      id: 'mock-6', media_type: 'IMAGE',
      media_url: 'assets/images/latest-books.webp',
      permalink: IG_CONFIG.profileUrl,
      caption: 'For your journey: the books that have walked beside millions on the path to Authentic Power. 📚',
      timestamp: '', like_count: 5310, comments_count: 203
    }
  ];

  /* --- helpers --------------------------------------------------------------- */
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

  // Glifo IG grande para el tile placeholder (modo mockup, sin fotos)
  var IG_BIG_GLYPH =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/>' +
    '<circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>';

  var HEART_GLYPH =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2 5 5.3 5c2 0 3.4 1.2 4.7 2.8C11.3 6.2 12.7 5 14.7 5 18 5 19.6 8.4 22 11.7 19.5 16.4 12 21 12 21z"/></svg>';

  var CHAT_GLYPH =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 11.5a8.4 8.4 0 0 1-11.9 7.6L3 21l1.9-6.1A8.4 8.4 0 1 1 21 11.5z"/></svg>';

  /* --- media: en MOCKUP = tile placeholder con icono IG (todas iguales, sin
   *     fotos); con data real (useMockData:false) = la foto del post --------- */
  function mediaInner(p) {
    if (IG_CONFIG.useMockData) {
      return '<span class="post__ph-ico" aria-hidden="true">' + IG_BIG_GLYPH + '</span>' +
             '<span class="post__chip post__chip--insta">' + IG_GLYPH + 'Example</span>';
    }
    return '<img src="' + escapeHtml(p.media_url) + '" alt="" loading="lazy" ' +
              'width="1080" height="1080" decoding="async" />' +
           '<span class="post__chip post__chip--insta">' + IG_GLYPH + 'Instagram</span>';
  }

  /* --- card template (reusa .post del Blog/Soul Feed) ------------------------ */
  function cardHtml(p) {
    var href = p.permalink || IG_CONFIG.profileUrl;
    var caption = escapeHtml(p.caption || '');
    var phClass = IG_CONFIG.useMockData ? ' post__media--ph' : '';
    return '' +
      '<a class="post post--glow post--insta reveal" href="' + escapeHtml(href) + '" ' +
        'target="_blank" rel="noopener noreferrer">' +
        '<span class="post__media post__media--square' + phClass + '">' + mediaInner(p) + '</span>' +
        '<span class="post__body">' +
          '<h3 class="post__title post__title--insta">' + caption + '</h3>' +
          '<span class="post__meta instafeed__stats">' +
            '<span class="instafeed__stat">' + HEART_GLYPH + compactCount(p.like_count) + '</span>' +
            '<span class="instafeed__stat">' + CHAT_GLYPH + compactCount(p.comments_count) + '</span>' +
          '</span>' +
          '<span class="post__cta">View<span class="post__cta-ico" aria-hidden="true">→</span></span>' +
        '</span>' +
      '</a>';
  }

  /* --- glow que sigue el cursor (mismo patrón que index.html, para tarjetas
   *     inyectadas dinámicamente que el init global ya no alcanza) ------------ */
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

  function render(posts) {
    var grid = document.getElementById('instaFeedGrid');
    if (!grid || !posts || !posts.length) return;
    grid.innerHTML = posts.slice(0, IG_CONFIG.limit).map(cardHtml).join('');

    // brillo solo en punteros finos con hover (igual que el Soul Feed)
    if (window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches) {
      [].slice.call(grid.querySelectorAll('.post--glow')).forEach(bindGlow);
    }
    // En anim-ink (modo por defecto) las .reveal ya son visibles; solo anim-reveal/
    // anim-kinetic las ocultan hasta tener .in. Si en esos modos la sección YA está en
    // viewport al inyectar (caso borde), revelamos las tarjetas a mano para que no queden ocultas.
    var sec = grid.closest('.sec');
    var animated = document.body.classList.contains('anim-reveal') ||
                   document.body.classList.contains('anim-kinetic');
    if (animated && sec) {
      var r = sec.getBoundingClientRect();
      if (r.top < (window.innerHeight || 0) && r.bottom > 0) {
        [].slice.call(grid.querySelectorAll('.reveal')).forEach(function (el) { el.classList.add('in'); });
      }
    }
  }

  /* Mapea la respuesta de la Graph API ({ data:[...] }) a la forma de cardHtml */
  function normalize(api) {
    var rows = (api && api.data) ? api.data : (Array.isArray(api) ? api : []);
    return rows.map(function (m) {
      return {
        id: m.id,
        media_type: m.media_type,
        // los VIDEO traen thumbnail_url; las imágenes, media_url
        media_url: (m.media_type === 'VIDEO' && m.thumbnail_url) ? m.thumbnail_url : m.media_url,
        permalink: m.permalink,
        caption: m.caption,
        timestamp: m.timestamp,
        like_count: m.like_count,
        comments_count: m.comments_count
      };
    });
  }

  function load() {
    // El label "Mockup" solo vive mientras usemos datos de ejemplo
    var badge = document.querySelector('.instafeed__mockbadge');
    if (badge && !IG_CONFIG.useMockData) badge.style.display = 'none';

    if (IG_CONFIG.useMockData) { render(INSTAGRAM_POSTS); return; }
    fetch(IG_CONFIG.jsonUrl, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) { render(normalize(data)); })
      .catch(function () { render(INSTAGRAM_POSTS); });   // fallback elegante al mock
  }

  /* =========================================================================
   * MAÑANA · Conectar Meta / Instagram Graph API
   * -------------------------------------------------------------------------
   * La Instagram Basic Display API quedó deprecada (dic-2024). Ruta vigente:
   * Instagram Graph API sobre una cuenta IG Professional vinculada a una Página
   * de Facebook (Meta Business).
   *
   *   GET https://graph.instagram.com/v21.0/{ig-user-id}/media
   *       ?fields=id,caption,media_type,media_url,permalink,thumbnail_url,
   *               timestamp,like_count,comments_count
   *       &access_token={LONG_LIVED_TOKEN}
   *
   * SEGURIDAD (sitio estático en GitHub Pages):
   *   · El token NO puede vivir en el cliente. Patrón recomendado:
   *     un paso server-side / GitHub Action corre con el token como secreto,
   *     pega la respuesta del API y la escribe en assets/data/instagram-feed.json.
   *     El navegador solo hace fetch de ese JSON (sin token). → poner
   *     IG_CONFIG.useMockData = false y listo.
   *   · Alternativa: proxy serverless (Cloudflare Worker / Netlify function) que
   *     guarde el token y devuelva el JSON ya filtrado; apuntar IG_CONFIG.jsonUrl ahí.
   *   · El token largo dura ~60 días → refrescarlo en el job programado.
   * ========================================================================= */

  if (document.readyState !== 'loading') load();
  else document.addEventListener('DOMContentLoaded', load);
})();
