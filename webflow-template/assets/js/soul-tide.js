/* SOTSI · soul-tide.js — efecto a medida (extraído de index.html #soul-tide).
   A) Campo de puntos en oleaje (Canvas 2D, perspectiva) en #aspire + .event.
   B) Text-wave con GSAP SplitText + ScrollTrigger (Aspiration / Tools / Event).
   REQUIERE GSAP + ScrollTrigger + SplitText cargados ANTES (ver custom code). */
(function(){
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- A · campo de puntos en oleaje (canvas 2D, perspectiva) ----------
     Adaptación del "dotted-surface" (Three.js) a Canvas — mismo look de oleaje
     pero sin dependencia 3D (más liviano, porta a Webflow como un solo embed).
     Color de marca: periwinkle en los valles → dorado en las crestas, sobre navy.
     Reutilizable → se monta en Aspiration y en Statement (mismo Soul Tide). */
  function mountTideCanvas(section){
    var canvas = section.querySelector('canvas');
    if(!canvas) return;
    var ctx = canvas.getContext('2d', {alpha:true});
    var inView = true;
    var COOL = [210,204,253];   /* Soft Periwinkle #D2CCFD — valle, frío, tenue */
    var WARM = [254,212,87];    /* Golden Yellow  #FED457 — cresta, cálido       */
    var AMOUNTX = 46, AMOUNTY = 72, SEP = 150, WAVE = 46;
    var CAM_Y = 300, CAM_Z = 1180;        /* cámara (mira por el plano de agua) */
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, cx = 0, cy = 0, focal = 0;
    var count = reduce ? 0.0 : 0.0, raf = 0, running = false;

    function resize(){
      var r = section.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W * 0.5; cy = H * 0.30; focal = H * 0.82;   /* ~fov 60 · horizonte subido para elevar el oleaje */
    }
    function lerp(a, b, t){ return a + (b - a) * t; }

    function draw(){
      ctx.clearRect(0, 0, W, H);
      var maxDepth = CAM_Z + (AMOUNTY * SEP) / 2;
      for(var ix = 0; ix < AMOUNTX; ix++){
        for(var iy = 0; iy < AMOUNTY; iy++){
          var wx = ix * SEP - (AMOUNTX * SEP) / 2;
          var wz = iy * SEP - (AMOUNTY * SEP) / 2;
          var wy = Math.sin((ix + count) * 0.3) * WAVE + Math.sin((iy + count) * 0.5) * WAVE;
          var depth = CAM_Z - wz;                 /* delante de la cámara si > 0 */
          if(depth < 70) continue;
          var f = focal / depth;
          var sx = cx + wx * f;
          var sy = cy - (wy - CAM_Y) * f;
          if(sx < -30 || sx > W + 30 || sy < -30 || sy > H + 30) continue;
          var rad = 0.55 * f * SEP * 0.12;
          if(rad < 0.35) rad = 0.35; else if(rad > 3.4) rad = 3.4;
          var crest = (wy + 2 * WAVE) / (4 * WAVE);            /* 0 valle · 1 cresta */
          if(crest < 0) crest = 0; else if(crest > 1) crest = 1;
          var t = crest * crest;                               /* dorado sólo arriba */
          var rC = (lerp(COOL[0], WARM[0], t)) | 0;
          var gC = (lerp(COOL[1], WARM[1], t)) | 0;
          var bC = (lerp(COOL[2], WARM[2], t)) | 0;
          var fade = 1 - depth / maxDepth;                     /* lejos = más tenue */
          if(fade < 0) fade = 0;
          var a = (0.16 + 0.42 * crest) * (0.35 + 0.65 * fade); /* sutil, bajo texto */
          ctx.beginPath();
          ctx.fillStyle = 'rgba(' + rC + ',' + gC + ',' + bC + ',' + a.toFixed(3) + ')';
          ctx.arc(sx, sy, rad, 0, 6.2832);
          ctx.fill();
        }
      }
    }
    /* el oleaje reacciona a la velocidad del scroll: empuja al BAJAR, retrocede al SUBIR */
    var scrollBoost = 0, lastY = window.pageYOffset || 0;
    function onWaveScroll(){
      var y = window.pageYOffset || 0, d = y - lastY; lastY = y;
      scrollBoost += d * 0.0016;
      if(scrollBoost > 0.9) scrollBoost = 0.9; else if(scrollBoost < -0.9) scrollBoost = -0.9;
    }
    function loop(){
      raf = requestAnimationFrame(loop);
      count += 0.04 + scrollBoost;             /* deriva calmada + reacción al scroll (ambos sentidos) */
      scrollBoost *= 0.92;                      /* decae suave hasta volver a la deriva */
      draw();
    }
    function start(){ if(running || reduce) return; running = true; loop(); }
    function stop(){ running = false; if(raf) cancelAnimationFrame(raf); raf = 0; }

    resize();
    draw();                                    /* primer frame estático siempre */
    if(!reduce) start();
    addEventListener('resize', function(){ resize(); draw(); }, {passive:true});
    if(!reduce) addEventListener('scroll', onWaveScroll, {passive:true});
    document.addEventListener('visibilitychange', function(){
      if(document.hidden) stop(); else if(inView) start();
    });
    /* pausa cuando la sección no está en pantalla (perf) */
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(es){
        es.forEach(function(e){ inView = e.isIntersecting; inView ? start() : stop(); });
      }, {threshold:0}).observe(section);
    }
  }

  /* montar el oleaje de puntos SÓLO en Aspiration (el Statement usa su propio shader de plasma) */
  var aspire = document.getElementById('aspire');
  if(aspire) mountTideCanvas(aspire);

  /* ---------- B · wave de texto (GSAP SplitText) — REUTILIZABLE ----------
     (1) ENTRADA en ola: cada letra sube + aparece (una vez). (2) COLOR ligado al
     SCROLL: una cresta (oro/púrpura) viaja por las letras al bajar y retrocede al
     subir. Se monta en Aspiration, Tools y Event. Respeta el switcher Animación + RM. */
  function mountTextWave(section, lineSel, colorsFor, splitType){
    if(!section || !window.gsap || !window.SplitText) return;
    gsap.registerPlugin(ScrollTrigger, SplitText);
    var lines = [].slice.call(section.querySelectorAll(lineSel));
    if(!lines.length) return;
    splitType = splitType || 'chars';

    function init(){
      var splits = lines.map(function(el){
        return new SplitText(el, {type: splitType, charsClass:'asp-char', wordsClass:'tw-word'});
      });
      var entrance = [], colorST = null, lastOn = null;

      function animOn(){ return !reduce && /\banim-(ink|reveal|kinetic)\b/.test(document.body.className); }

      /* parse '#rrggbb' o 'rgba(...)' → [r,g,b,a]; mezcla lineal entre dos */
      function parseColor(s){
        if(s.charAt(0) === '#') return [parseInt(s.substr(1,2),16), parseInt(s.substr(3,2),16), parseInt(s.substr(5,2),16), 1];
        var m = s.match(/[\d.]+/g) || [0,0,0]; return [+m[0]||0, +m[1]||0, +m[2]||0, m[3] != null ? +m[3] : 1];
      }
      function mix(a, b, t){ return [Math.round(a[0]+(b[0]-a[0])*t), Math.round(a[1]+(b[1]-a[1])*t),
        Math.round(a[2]+(b[2]-a[2])*t), (a[3]+(b[3]-a[3])*t)]; }

      function kill(){
        entrance.forEach(function(t){ if(t.scrollTrigger) t.scrollTrigger.kill(); t.kill(); });
        entrance = [];
        if(colorST){ colorST.kill(); colorST = null; }
        splits.forEach(function(s){ gsap.set(s.chars, {clearProps:'all'}); });   /* texto visible estático */
      }
      function build(){
        kill();
        /* (1) entrada en ola: sube + aparece (una vez, sin re-ocultarse → nunca "desaparece"). */
        lines.forEach(function(el, i){
          var tw = gsap.from(splits[i].chars, {
            yPercent: 120, autoAlpha: 0, filter: 'blur(8px)',
            duration: 0.7, ease: 'sine.out', delay: i * 0.08,
            stagger: {each: Math.min(0.045, 0.7 / Math.max(1, splits[i].chars.length)), from: 'start'},
            clearProps: 'transform,opacity,visibility,filter',
            scrollTrigger: {trigger: section, start: 'top 78%', toggleActions: 'restart none restart none'}
          });
          entrance.push(tw);
        });
        /* (2) color ligado al SCROLL: una banda dorada (feathered) recorre TODAS las
               letras en orden según la posición del scroll. Baja → avanza; sube →
               retrocede (scrub bidireccional). El color en reposo lo respeta el CSS. */
        var chars = [], bases = [], his = [];
        lines.forEach(function(el, li){
          var c = colorsFor(el), b = parseColor(c[0]), h = parseColor(c[1]);
          splits[li].chars.forEach(function(ch){ chars.push(ch); bases.push(b); his.push(h);
            ch.style.color = 'rgba(' + b[0] + ',' + b[1] + ',' + b[2] + ',' + b[3] + ')'; });
        });
        var N = chars.length, BAND = 8;                 /* ancho de la cresta (~8 letras) */
        colorST = ScrollTrigger.create({
          trigger: section, start: 'top 88%', end: 'bottom 42%', scrub: 0.5,
          onUpdate: function(self){
            var head = self.progress * (N + BAND * 2) - BAND;   /* cabeza de la ola: −BAND … N+BAND */
            for(var i = 0; i < N; i++){
              var d = Math.abs(i - head) / BAND;
              var g = d < 1 ? (1 - d) : 0; g = g * g * (3 - 2 * g);   /* smoothstep */
              var col = mix(bases[i], his[i], g);
              chars[i].style.color = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + col[3].toFixed(3) + ')';
            }
          }
        });
      }
      function sync(){ var on = animOn(); if(on === lastOn) return; lastOn = on; on ? build() : kill(); }

      sync();
      new MutationObserver(sync).observe(document.body, {attributes:true, attributeFilter:['class']});
      addEventListener('load', function(){ ScrollTrigger.refresh(); });
    }

    /* esperar las fuentes (Canela) para que SplitText mida bien los chars */
    if(document.fonts && document.fonts.ready){
      var done = false, go = function(){ if(done) return; done = true; init(); };
      document.fonts.ready.then(go);
      setTimeout(go, 1200);                        /* fallback si fonts.ready tarda */
    } else { init(); }
  }

  /* Aspiration — colores por clase (comportamiento original, intacto) */
  mountTextWave(aspire, '[data-asp-line]', function(el){
    if(el.classList.contains('aspire__word--accent')) return ['#FED457','#FFF3CC'];
    if(el.classList.contains('aspire__word'))          return ['#ffffff','#FED457'];
    if(el.classList.contains('aspire__tag'))           return ['rgba(255,255,255,0.6)','rgba(255,233,160,0.96)'];
    return ['rgba(255,255,255,0.55)','rgba(255,237,176,0.95)'];                   /* intro */
  });

  /* Tools + Event (y cualquier .textwave) — colores por data-attr; Event suma el canvas Soul Tide */
  function dataColors(el){
    return [el.getAttribute('data-wave-base') || '#ffffff', el.getAttribute('data-wave-crest') || '#FED457'];
  }
  [].slice.call(document.querySelectorAll('.textwave')).forEach(function(sec){
    if(sec === aspire) return;
    mountTextWave(sec, '[data-wave-line]', dataColors, 'words,chars');
    if(sec.querySelector('canvas.tw-tide')) mountTideCanvas(sec);
  });
})();
