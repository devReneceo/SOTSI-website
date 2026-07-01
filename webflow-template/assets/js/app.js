/* SOTSI · app.js — interacciones (extraído de index.html, sin el DEV switcher).
   ink-drop · nav condense · drawer móvil · hero parallax · cursor lens · slider
   (.hslider/.oslider) · swipe · scroll-reveal · stats count-up · praise carousel.
   Cargar DESPUÉS del DOM (al final de <body>), ANTES de soul-tide.js. */
(function(){
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Footer copyright year (auto-updating via JS) ---- */
  (function(){ var y = document.getElementById('footYear'); if(y) y.textContent = new Date().getFullYear(); })();

  /* ---- Ink Drop Spread: split text into words and radiate from center ---- */
  function splitInto(el, byChar){
    if(el.__words) return el.__words;
    var words=[];
    (function walk(parent){
      [].slice.call(parent.childNodes).forEach(function(n){
        if(n.nodeType===3){
          var frag=document.createDocumentFragment();
          if(byChar){
            /* letra por letra: entrada más lenta y elegante, aprovecha el tracking del eyebrow */
            n.textContent.split('').forEach(function(c){
              if(/\s/.test(c)){ frag.appendChild(document.createTextNode(' ')); }
              else { var s=document.createElement('span'); s.className='word'; s.textContent=c; frag.appendChild(s); words.push(s); }
            });
          } else {
            var parts=n.textContent.split(/(\s+)/);
            parts.forEach(function(p){
              if(p==='') return;
              if(/^\s+$/.test(p)){ frag.appendChild(document.createTextNode(p)); }
              else { var s=document.createElement('span'); s.className='word'; s.textContent=p; frag.appendChild(s); words.push(s); }
            });
          }
          parent.replaceChild(frag,n);
        } else if(n.nodeType===1 && !n.classList.contains('word')){ walk(n); }
      });
    })(el);
    el.__words=words; return words;
  }
  function inkPlay(slide){
    var all=[]; [].slice.call(slide.querySelectorAll('.hslide__eyebrow,.hslide__title,.hslide__script,.hslide__lead,.oslide__title,.oslide__script,.oslide__lead,.oslide__note,.heroA__title,.heroA__sub,.heroA__body,.sec__eyebrow,.sec__title,.sec__lead,.sec__script,.statement__lead'))
      .forEach(function(el){ all=all.concat(splitInto(el, el.classList.contains('sec__eyebrow'))); });
    if(!all.length) return;
    var center=(all.length-1)/2;
    all.forEach(function(w){ w.classList.remove('in'); w.style.transition='none'; w.style.transitionDelay='0s'; });
    void slide.offsetWidth;
    all.forEach(function(w,i){
      w.style.transition='opacity .5s ease, transform .5s cubic-bezier(0.16,1,0.3,1), filter .5s ease';
      w.style.transitionDelay=(Math.abs(i-center)*0.03)+'s';
    });
    requestAnimationFrame(function(){ all.forEach(function(w){ w.classList.add('in'); }); });
  }
  function maybeInk(slide){ if(!reduce && slide && document.body.classList.contains('anim-ink')) inkPlay(slide); }

  /* nav condense (all headers) */
  var navs = [].slice.call(document.querySelectorAll('.snav'));
  function onScroll(){ var always=document.body.classList.contains('nav-solid-always'); navs.forEach(function(n){ n.classList.toggle('is-condensed', always || window.scrollY > 60); }); }
  addEventListener('scroll', onScroll, {passive:true}); onScroll();

  /* mobile drawers (each header) */
  document.querySelectorAll('[data-burger]').forEach(function(burger){
    var panel = burger.closest('header').querySelector('[data-mobile]');
    burger.addEventListener('click', function(){
      var open = panel.hasAttribute('hidden');
      if(open){ panel.removeAttribute('hidden'); burger.setAttribute('aria-expanded','true'); }
      else { panel.setAttribute('hidden',''); burger.setAttribute('aria-expanded','false'); }
      document.body.classList.toggle('menu-open', open);   /* overlay state (mobile drawer) */
    });
  });

  /* subtle hero media parallax (desktop only) */
  function bindHeroParallax(root){
    if(!root || reduce || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var raf = 0, targetX = 0, targetY = 0, currentX = 0, currentY = 0, active = false;
    function render(){
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      root.style.setProperty('--hero-pan-x', currentX.toFixed(2) + 'px');
      root.style.setProperty('--hero-pan-y', currentY.toFixed(2) + 'px');
      if(active || Math.abs(targetX - currentX) > 0.12 || Math.abs(targetY - currentY) > 0.12){
        raf = requestAnimationFrame(render);
      } else {
        raf = 0;
      }
    }
    function kick(){ if(!raf) raf = requestAnimationFrame(render); }
    root.addEventListener('pointerenter', function(){
      targetX = 4;
      targetY = 0;
      active = true;
      kick();
    });
    root.addEventListener('pointermove', function(e){
      var rect = root.getBoundingClientRect();
      var px = (e.clientX - rect.left) / rect.width - 0.5;
      var py = (e.clientY - rect.top) / rect.height - 0.5;
      root.style.setProperty('--mouse-x', ((px + 0.5) * 100).toFixed(2) + '%');
      root.style.setProperty('--mouse-y', ((py + 0.5) * 100).toFixed(2) + '%');
      targetX = 4 + (px * 10);
      targetY = py * 8;
      active = true;
      kick();
    });
    root.addEventListener('pointerleave', function(){
      targetX = 0;
      targetY = 0;
      active = false;
      kick();
    });
  }
  [].slice.call(document.querySelectorAll('.hslider,.oslider,.heroA')).forEach(bindHeroParallax);

  var waterNoise = document.getElementById('sotsiWaterNoise');
  var waterMap = document.getElementById('sotsiWaterMap');
  var waterRaf = 0;
  var waterSlides = [];
  function clearWaterSlides(){
    waterSlides.forEach(function(slide){ slide.classList.remove('is-fluid'); });
    waterSlides = [];
  }
  function waterPulse(slidesForFx){
    if(reduce || !waterNoise || !waterMap) return;
    if(waterRaf) cancelAnimationFrame(waterRaf);
    clearWaterSlides();
    waterSlides = slidesForFx.filter(Boolean);
    waterSlides.forEach(function(slide){ slide.classList.add('is-fluid'); });
    var start = null;
    function frame(ts){
      if(!start) start = ts;
      var p = Math.min((ts - start) / 860, 1);
      var wave = Math.sin(p * Math.PI);
      var freqX = 0.012 + (wave * 0.02);
      var freqY = 0.02 + (wave * 0.028);
      var scale = 2 + (wave * 34);
      waterNoise.setAttribute('baseFrequency', freqX.toFixed(4) + ' ' + freqY.toFixed(4));
      waterMap.setAttribute('scale', scale.toFixed(2));
      if(p < 1){
        waterRaf = requestAnimationFrame(frame);
      } else {
        waterNoise.setAttribute('baseFrequency', '0.012 0.02');
        waterMap.setAttribute('scale', '0');
        clearWaterSlides();
        waterRaf = 0;
      }
    }
    waterRaf = requestAnimationFrame(frame);
  }

  function resetSlideFx(slide){
    slide.classList.remove('is-entering','is-leaving','from-right','from-left','to-right','to-left');
  }
  function animateSlideSwap(slides, dots, state, nextIndex, dir){
    if(state.animating || nextIndex === state.cur) return;
    var current = slides[state.cur];
    var next = slides[nextIndex];
    if(reduce){
      current.classList.remove('is-active');
      current.setAttribute('hidden','');
      resetSlideFx(current);
      resetSlideFx(next);
      next.removeAttribute('hidden');
      next.classList.add('is-active');
      dots[state.cur].classList.remove('is-active');
      dots[nextIndex].classList.add('is-active');
      state.cur = nextIndex;
      if(state.onChange) state.onChange(nextIndex, current, next, dir);
      return;
    }
    state.animating = true;
    resetSlideFx(current);
    resetSlideFx(next);
    current.classList.remove('is-active');
    current.classList.add('is-leaving', dir > 0 ? 'to-left' : 'to-right');
    next.removeAttribute('hidden');
    next.classList.add('is-entering', dir > 0 ? 'from-right' : 'from-left');
    dots[state.cur].classList.remove('is-active');
    dots[nextIndex].classList.add('is-active');
    if(state.onTransition) state.onTransition(current, next, dir);
    if(state.onChange) state.onChange(nextIndex, current, next, dir);
    maybeInk(next);
    setTimeout(function(){
      current.setAttribute('hidden','');
      resetSlideFx(current);
      resetSlideFx(next);
      next.classList.add('is-active');
      state.cur = nextIndex;
      state.animating = false;
    }, state.fxMs);
  }

  /* reinicios de slider al slide 1 (asignados dentro de cada setup; el switcher los llama
     al cambiar de variante de hero). No-ops por defecto si un slider no existe. */
  var resetHeroSlider = function(){}, resetOriginalSlider = function(){};

  /* swipe táctil reutilizable (móvil/tablet): horizontal decisivo → onLeft/onRight;
     vertical o gesto ambiguo → no hace nada (deja el scroll normal). passive, sin libs. */
  function attachSwipe(el, onLeft, onRight){
    if(!el) return;
    var x0=null, y0=null, t0=0;
    el.addEventListener('touchstart', function(e){ var t=e.changedTouches[0]; x0=t.clientX; y0=t.clientY; t0=e.timeStamp; }, {passive:true});
    el.addEventListener('touchend', function(e){
      if(x0===null) return;
      var t=e.changedTouches[0], dx=t.clientX-x0, dy=t.clientY-y0, dt=e.timeStamp-t0;
      x0=null;
      if(dt<800 && Math.abs(dx)>42 && Math.abs(dx)>Math.abs(dy)*1.25){ if(dx<0) onLeft(); else onRight(); }
    }, {passive:true});
  }

  /* hero slider */
  var hsliderEl = document.querySelector('.hslider');
  var hcursor = document.getElementById('hcursor');
  var hcursorLabel = hcursor ? hcursor.querySelector('span') : null;
  var slides = [].slice.call(document.querySelectorAll('.hslide'));
  var dotsWrap = document.getElementById('hdots');
  var hcurrent = document.getElementById('hcurrent');
  var htotal = document.getElementById('htotal');
  var hprogress = document.getElementById('hprogress');
  var hstatus = document.querySelector('.hslider__status');
  var hprevLabel = document.getElementById('hprevLabel');
  var hnextLabel = document.getElementById('hnextLabel');
  function pad2(n){ return n < 10 ? '0' + n : '' + n; }
  function slideStatus(index){
    return slides[(index + slides.length) % slides.length].dataset.status || '';
  }
  function setArrowLabels(index){
    if(hprevLabel) hprevLabel.textContent = 'Back';   /* corto, sin subtítulo de slide */
    if(hnextLabel) hnextLabel.textContent = 'Next';
  }
  function syncHeroNavTheme(index){
    document.body.classList.toggle('hero-slide-light-nav', index === 0);
  }
  function syncHeroChrome(index){
    if(!slides.length) return;   /* páginas sin hslider (p.ej. build Webflow por rebanadas): .hslider__status del oslider matchea el selector → no derefear slides[] */
    if(hcurrent) hcurrent.textContent = pad2(index + 1);
    if(htotal) htotal.textContent = pad2(slides.length);
    if(hstatus) hstatus.textContent = slides[index].dataset.status || '';
    setArrowLabels(index);
    syncHeroNavTheme(index);
  }
  function restartHeroProgress(){
    if(!hprogress || reduce) return;
    hprogress.classList.remove('is-running');
    void hprogress.offsetWidth;
    hprogress.style.setProperty('--hero-delay', DELAY + 'ms');
    hprogress.classList.add('is-running');
  }
  function setHeroOrigin(x, y){
    if(!hsliderEl) return;
    hsliderEl.style.setProperty('--water-origin-x', x);
    hsliderEl.style.setProperty('--water-origin-y', y);
  }
  function triggerHeroRipple(){
    if(!hsliderEl || reduce) return;
    hsliderEl.classList.remove('is-rippling');
    void hsliderEl.offsetWidth;
    hsliderEl.classList.add('is-rippling');
    setTimeout(function(){ hsliderEl.classList.remove('is-rippling'); }, 1050);
  }
  var hstate = {
    cur: 0,
    animating: false,
    fxMs: 1080,
    onChange: function(nextIndex){ syncHeroChrome(nextIndex); },
    onTransition: function(current, next){
      triggerHeroRipple();
      waterPulse([current, next]);
    }
  };
  var timer=null, DELAY=12000;
  slides.forEach(function(s,i){ var b=document.createElement('button');
    b.className='hdot'+(i===0?' is-active':''); b.setAttribute('role','tab'); b.setAttribute('aria-label','Go to slide '+(i+1));
    b.addEventListener('click', function(){
      setHeroOrigin(i > hstate.cur ? '78%' : '22%', '50%');
      go(i, i > hstate.cur ? 1 : -1);
      restart();
    }); dotsWrap.appendChild(b); });
  var dots=dotsWrap?[].slice.call(dotsWrap.children):[];
  syncHeroChrome(0);
  function go(n, dir){ animateSlideSwap(slides, dots, hstate, (n + slides.length) % slides.length, dir || 1); }
  function next(originX, originY){ setHeroOrigin(originX || '78%', originY || '50%'); go(hstate.cur + 1, 1); }
  function prev(originX, originY){ setHeroOrigin(originX || '22%', originY || '50%'); go(hstate.cur - 1, -1); }
  function restart(){
    if(timer)clearInterval(timer);
    restartHeroProgress();
    if(!reduce) timer=setInterval(next,DELAY);
  }
  resetHeroSlider = function(){
    if(!slides.length) return;
    if(timer) clearInterval(timer);
    slides.forEach(function(s,i){
      s.classList.remove('is-active','is-leaving','is-entering','to-left','to-right','from-left','from-right');
      resetSlideFx(s);
      if(i===0){ s.removeAttribute('hidden'); s.classList.add('is-active'); }
      else { s.setAttribute('hidden',''); }
    });
    dots.forEach(function(d,i){ d.classList.toggle('is-active', i===0); });
    hstate.cur=0; hstate.animating=false;
    syncHeroChrome(0); restart(); maybeInk(slides[0]);
  };
  var hnextBtn = document.getElementById('hnext'), hprevBtn = document.getElementById('hprev');
  if(hnextBtn) hnextBtn.addEventListener('click', function(){ next('82%','50%'); restart(); });
  if(hprevBtn) hprevBtn.addEventListener('click', function(){ prev('18%','50%'); restart(); });
  if(hsliderEl && hcursor && hcursorLabel && !reduce && matchMedia('(hover: hover) and (pointer: fine)').matches){
    function cursorIntent(clientX){
      var rect = hsliderEl.getBoundingClientRect();
      return ((clientX - rect.left) / rect.width) < 0.5 ? 'prev' : 'next';
    }
    /* lente de cristal: círculo que des-difumina el video bajo el cursor.
       Throttle con rAF: re-rasterizar el backdrop-filter es caro, lo coalescemos a 1/frame. */
    var lensRaf = false, lensE = null;
    function setLens(e){
      lensE = e;
      if(lensRaf) return;
      lensRaf = true;
      requestAnimationFrame(function(){
        lensRaf = false;
        var r = hsliderEl.getBoundingClientRect();
        hsliderEl.style.setProperty('--mx', (lensE.clientX - r.left) + 'px');
        hsliderEl.style.setProperty('--my', (lensE.clientY - r.top) + 'px');
      });
    }
    function clearLens(){
      hsliderEl.style.setProperty('--mx', '-9999px');
      hsliderEl.style.setProperty('--my', '-9999px');
    }
    hsliderEl.addEventListener('pointerenter', function(e){
      hcursor.classList.add('is-visible');
      hcursor.style.left = e.clientX + 'px';
      hcursor.style.top = e.clientY + 'px';
      setLens(e);
    });
    hsliderEl.addEventListener('pointermove', function(e){
      var intent = cursorIntent(e.clientX);
      hcursor.style.left = e.clientX + 'px';
      hcursor.style.top = e.clientY + 'px';
      hcursorLabel.textContent = intent === 'prev' ? 'Back' : 'Next';
      setLens(e);
    });
    hsliderEl.addEventListener('pointerleave', function(){
      hcursor.classList.remove('is-visible');
      clearLens();
    });
    hsliderEl.addEventListener('click', function(e){
      if(e.target.closest('a,button,.vswitch')) return;
      var intent = cursorIntent(e.clientX);
      var rect = hsliderEl.getBoundingClientRect();
      var ox = (((e.clientX - rect.left) / rect.width) * 100).toFixed(2) + '%';
      var oy = (((e.clientY - rect.top) / rect.height) * 100).toFixed(2) + '%';
      if(intent === 'prev') prev(ox, oy);
      else next(ox, oy);
      restart();
    });
  }
  attachSwipe(hsliderEl, function(){ next('50%','50%'); restart(); }, function(){ prev('50%','50%'); restart(); });
  if(slides.length) restart();

  /* hero ORIGINAL slider (réplica fiel · 5 slides, self-contained) */
  var oslides=[].slice.call(document.querySelectorAll('.oslide'));
  if(oslides.length){
    var osliderEl = document.querySelector('.oslider');
    var ocursor = document.getElementById('ocursor');
    var ocursorLabel = ocursor ? ocursor.querySelector('span') : null;
    var odotsWrap=document.getElementById('odots');
    var ocurrent = document.getElementById('ocurrent');
    var ototal = document.getElementById('ototal');
    var oprogress = document.getElementById('oprogress');
    var ostatus = document.getElementById('ostatus');
    var oprevLabel = document.getElementById('oprevLabel');
    var onextLabel = document.getElementById('onextLabel');
    function oSlideStatus(index){
      return oslides[(index + oslides.length) % oslides.length].dataset.status || '';
    }
    function setOriginalArrowLabels(index){
      if(oprevLabel) oprevLabel.textContent = 'Back';   /* corto, sin subtítulo de slide */
      if(onextLabel) onextLabel.textContent = 'Next';
    }
    function syncOriginalChrome(index){
      if(ocurrent) ocurrent.textContent = pad2(index + 1);
      if(ototal) ototal.textContent = pad2(oslides.length);
      if(ostatus) ostatus.textContent = oslides[index].dataset.status || '';
      setOriginalArrowLabels(index);
    }
    function restartOriginalProgress(){
      if(!oprogress || reduce) return;
      oprogress.classList.remove('is-running');
      void oprogress.offsetWidth;
      oprogress.style.setProperty('--hero-delay', ODELAY + 'ms');
      oprogress.classList.add('is-running');
    }
    function setOriginalOrigin(x, y){
      if(!osliderEl) return;
      osliderEl.style.setProperty('--water-origin-x', x);
      osliderEl.style.setProperty('--water-origin-y', y);
    }
    function triggerOriginalRipple(){
      if(!osliderEl || reduce) return;
      osliderEl.classList.remove('is-rippling');
      void osliderEl.offsetWidth;
      osliderEl.classList.add('is-rippling');
      setTimeout(function(){ osliderEl.classList.remove('is-rippling'); }, 1050);
    }
    var ostate = {
      cur: 0,
      animating: false,
      fxMs: 1080,
      onChange: function(nextIndex){ syncOriginalChrome(nextIndex); },
      onTransition: function(){ triggerOriginalRipple(); }
    };
    var otimer=null, ODELAY=12000;
    oslides.forEach(function(s,i){ var b=document.createElement('button');
      b.className='hdot'+(i===0?' is-active':''); b.setAttribute('role','tab'); b.setAttribute('aria-label','Go to slide '+(i+1));
      b.addEventListener('click', function(){
        setOriginalOrigin(i > ostate.cur ? '78%' : '22%', '50%');
        ogo(i, i > ostate.cur ? 1 : -1);
        orestart();
      }); odotsWrap.appendChild(b); });
    var odots=[].slice.call(odotsWrap.children);
    function ogo(n, dir){ animateSlideSwap(oslides, odots, ostate, (n + oslides.length) % oslides.length, dir || 1); }
    function onext(originX, originY){ setOriginalOrigin(originX || '78%', originY || '50%'); ogo(ostate.cur + 1, 1); }
    function oprevf(originX, originY){ setOriginalOrigin(originX || '22%', originY || '50%'); ogo(ostate.cur - 1, -1); }
    function orestart(){
      if(otimer)clearInterval(otimer);
      restartOriginalProgress();
      if(!reduce) otimer=setInterval(onext,ODELAY);
    }
    resetOriginalSlider = function(){
      if(!oslides.length) return;
      if(otimer) clearInterval(otimer);
      oslides.forEach(function(s,i){
        s.classList.remove('is-active','is-leaving','is-entering','to-left','to-right','from-left','from-right');
        resetSlideFx(s);
        if(i===0){ s.removeAttribute('hidden'); s.classList.add('is-active'); }
        else { s.setAttribute('hidden',''); }
      });
      odots.forEach(function(d,i){ d.classList.toggle('is-active', i===0); });
      ostate.cur=0; ostate.animating=false;
      syncOriginalChrome(0); orestart(); maybeInk(oslides[0]);
    };
    syncOriginalChrome(0);
    var onextBtn = document.getElementById('onext'), oprevBtn = document.getElementById('oprev');
    if(onextBtn) onextBtn.addEventListener('click', function(){ onext('82%','50%'); orestart(); });
    if(oprevBtn) oprevBtn.addEventListener('click', function(){ oprevf('18%','50%'); orestart(); });
    if(osliderEl && ocursor && ocursorLabel && !reduce && matchMedia('(hover: hover) and (pointer: fine)').matches){
      function originalCursorIntent(clientX){
        var rect = osliderEl.getBoundingClientRect();
        return ((clientX - rect.left) / rect.width) < 0.5 ? 'prev' : 'next';
      }
      osliderEl.addEventListener('pointerenter', function(e){
        ocursor.classList.add('is-visible');
        ocursor.style.left = e.clientX + 'px';
        ocursor.style.top = e.clientY + 'px';
      });
      osliderEl.addEventListener('pointermove', function(e){
        var intent = originalCursorIntent(e.clientX);
        ocursor.style.left = e.clientX + 'px';
        ocursor.style.top = e.clientY + 'px';
        ocursorLabel.textContent = intent === 'prev' ? 'Back' : 'Next';
      });
      osliderEl.addEventListener('pointerleave', function(){
        ocursor.classList.remove('is-visible');
      });
      osliderEl.addEventListener('click', function(e){
        if(e.target.closest('a,button,.vswitch')) return;
        var intent = originalCursorIntent(e.clientX);
        var rect = osliderEl.getBoundingClientRect();
        var ox = (((e.clientX - rect.left) / rect.width) * 100).toFixed(2) + '%';
        var oy = (((e.clientY - rect.top) / rect.height) * 100).toFixed(2) + '%';
        if(intent === 'prev') oprevf(ox, oy);
        else onext(ox, oy);
        orestart();
      });
    }
    attachSwipe(osliderEl, function(){ onext('50%','50%'); orestart(); }, function(){ oprevf('50%','50%'); orestart(); });
    orestart();
  }

  /* Ink al cargar: anima la entrada del hero visible (default = original) */
  if(document.body.classList.contains('hero-original')) maybeInk(document.querySelector('.oslide.is-active'));
  else if(document.body.classList.contains('hero-static')) maybeInk(document.querySelector('.heroA'));
  else maybeInk(document.querySelector('.hero-slider-wrap .hslide.is-active'));

  /* ---- Secciones del Home: scroll-reveal que respeta el switcher de Animación ---- */
  var secs=[].slice.call(document.querySelectorAll('.sec'));
  function showSec(sec){
    if(document.body.classList.contains('anim-ink') && !reduce){
      sec.classList.add('ink-on'); inkPlay(sec);
    } else {
      [].slice.call(sec.querySelectorAll('.reveal')).forEach(function(el,i){
        el.style.transitionDelay=(Math.min(i,6)*0.08)+'s'; el.classList.add('in');
      });
    }
  }
  /* reset al SALIR del viewport → permite re-disparar la animación al volver a entrar (scroll up Y down) */
  function resetSec(sec){
    sec.classList.remove('ink-on');
    [].slice.call(sec.querySelectorAll('.word.in')).forEach(function(el){ el.style.transition='none'; el.classList.remove('in'); });
    [].slice.call(sec.querySelectorAll('.reveal.in')).forEach(function(el){ el.classList.remove('in'); });
  }
  if('IntersectionObserver' in window && !reduce){
    var io=new IntersectionObserver(function(ents){
      ents.forEach(function(e){ if(e.isIntersecting){ showSec(e.target); } else { resetSec(e.target); } });
    },{threshold:.16, rootMargin:'0px 0px -8% 0px'});
    secs.forEach(function(s){ io.observe(s); });
  } else { secs.forEach(function(s){ [].slice.call(s.querySelectorAll('.reveal')).forEach(function(el){ el.classList.add('in'); }); }); }

  /* Aspiration · "Soul Tide" — el campo de puntos (canvas) + el wave de texto
     (GSAP SplitText) viven en su propio bloque al final del documento, tras cargar
     GSAP por CDN. Ver <script id="soul-tide">. */

  /* ---- Stats count-up (al entrar en pantalla; respeta reduced-motion) ---- */
  function countUp(el){
    var target=parseFloat(el.getAttribute('data-count'))||0, suffix=el.getAttribute('data-suffix')||'';
    if(reduce){ el.textContent=target+suffix; return; }
    var start=null,dur=1400;
    function step(ts){ if(!start)start=ts; var p=Math.min((ts-start)/dur,1); var e=1-Math.pow(1-p,3);
      el.textContent=Math.round(target*e)+suffix; if(p<1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  }
  var nums=[].slice.call(document.querySelectorAll('.stat__num'));
  if('IntersectionObserver' in window && !reduce){
    var io2=new IntersectionObserver(function(ents){ ents.forEach(function(e){ if(e.isIntersecting){ countUp(e.target); io2.unobserve(e.target); } }); },{threshold:.5});
    nums.forEach(function(n){ io2.observe(n); });
  } else { nums.forEach(countUp); }

  /* ---- Praise · testimonios: carrusel de una cita (crossfade, autoplay pausable, swipe, reduced-motion safe) ---- */
  (function(){
    var car=document.getElementById('praiseCarousel'); if(!car) return;
    var slides=[].slice.call(car.querySelectorAll('.praise__slide'));
    var dotsWrap=document.getElementById('praiseDots');
    if(!slides.length || !dotsWrap) return;
    var cur=0, timer=null, DELAY=9000;
    slides.forEach(function(s,i){
      var b=document.createElement('button');
      b.type='button'; b.setAttribute('role','tab'); b.setAttribute('aria-label','Testimonial '+(i+1));
      b.addEventListener('click', function(){ go(i); restart(); });
      dotsWrap.appendChild(b);
    });
    var dots=[].slice.call(dotsWrap.children);
    function paint(){
      slides.forEach(function(s,i){ var on=i===cur; s.classList.toggle('is-active',on); s.setAttribute('aria-hidden', on?'false':'true'); });
      dots.forEach(function(d,i){ var on=i===cur; d.classList.toggle('is-active',on); d.setAttribute('aria-selected', on?'true':'false'); });
    }
    function go(n){ cur=(n+slides.length)%slides.length; paint(); }
    function next(){ go(cur+1); }
    function prev(){ go(cur-1); }
    function stop(){ if(timer){ clearInterval(timer); timer=null; } }
    function restart(){ stop(); if(!reduce) timer=setInterval(next,DELAY); }
    var pb=document.getElementById('prAprev'), nb=document.getElementById('prAnext');
    if(pb) pb.addEventListener('click', function(){ prev(); restart(); });
    if(nb) nb.addEventListener('click', function(){ next(); restart(); });
    car.addEventListener('mouseenter', stop);
    car.addEventListener('mouseleave', restart);
    car.addEventListener('focusin', stop);
    car.addEventListener('focusout', restart);
    if(typeof attachSwipe==='function') attachSwipe(car, function(){ next(); restart(); }, function(){ prev(); restart(); });
    paint();
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(es){ es.forEach(function(e){ e.isIntersecting ? restart() : stop(); }); },{threshold:.2}).observe(car);
    } else { restart(); }
  })();

  /* ---- Greeting: play → expand inmersivo + controles nativos (pausa/volumen). Backdrop o Esc = cerrar ---- */
  var gp=document.getElementById('greetPlay');
  if(gp){
    var gv=document.getElementById('greetVideo');
    var gsec=document.querySelector('.greeting');
    var gbd=document.getElementById('greetBackdrop');
    var gcard=document.getElementById('greetCard');
    var ghint=document.getElementById('greetHint');
    /* ---- Soft scroll-hold: al reproducir, el scroll fija el video + aviso cálido; si insiste → pausa y libera (nunca atrapa) ---- */
    var scrollAccum=0, holdOn=false, hintTimer=0;
    function showHint(){ if(!ghint) return; ghint.hidden=false; gsec.classList.add('is-hinting');
      clearTimeout(hintTimer); hintTimer=setTimeout(function(){ gsec.classList.remove('is-hinting'); }, 2600); }
    function hideHint(){ clearTimeout(hintTimer); gsec.classList.remove('is-hinting'); }
    function onHoldWheel(e){ if(gv.paused){ releaseHold(); return; }
      e.preventDefault(); showHint(); scrollAccum += Math.abs(e.deltaY||40);
      if(scrollAccum>700) greetPauseVid(); }                 /* sigue scrolleando → pausa + sale */
    function onHoldTouch(e){ if(gv.paused){ releaseHold(); return; }
      e.preventDefault(); showHint(); scrollAccum += 90;
      if(scrollAccum>700) greetPauseVid(); }
    function lockHold(){ if(holdOn) return; holdOn=true; scrollAccum=0;
      window.addEventListener('wheel', onHoldWheel, {passive:false});
      window.addEventListener('touchmove', onHoldTouch, {passive:false}); }
    function releaseHold(){ if(!holdOn) return; holdOn=false; scrollAccum=0;
      window.removeEventListener('wheel', onHoldWheel, {passive:false});
      window.removeEventListener('touchmove', onHoldTouch, {passive:false}); hideHint(); }
    function setLoading(on){ gsec.classList.toggle('is-loading', !!on); }   /* spinner ⟳ mientras bufferea */
    function greetBloom(){                                /* bloom dorado: nace del centro del play y se expande */
      gsec.classList.remove('is-blooming'); void gsec.offsetWidth; gsec.classList.add('is-blooming');
      setTimeout(function(){ gsec.classList.remove('is-blooming'); }, 900);
    }
    function greetCenter(){                               /* auto-centra el video en pantalla (modo "siéntate y ve") */
      if(!gcard) return;
      var smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      try{ gcard.scrollIntoView(smooth?{behavior:'smooth',block:'center'}:{block:'center'}); }
      catch(e){ try{ gcard.scrollIntoView(); }catch(_){} }
    }
    function greetPlay(){
      var opening=!gsec.classList.contains('is-playing');/* abrir desde el poster (no reanudar) */
      gv.muted=false;                                    /* asegura AUDIO (nunca silenciamos el saludo) */
      gsec.classList.add('is-playing');
      gsec.classList.remove('is-paused');
      if(gv.readyState < 3) setLoading(true);            /* aún sin buffer suficiente → muestra spinner */
      if(opening){ greetBloom(); greetCenter(); }        /* bienvenida: bloom + auto-centrar (solo al abrir) */
      var p=gv.play();                                   /* gesto de usuario → reproduce CON audio */
      if(p&&p.catch) p.catch(function(){ setLoading(false); gsec.classList.add('is-paused'); }); /* si falla → botón ▶ */
    }
    function greetPauseVid(){
      gv.pause();                                        /* CONGELA el cuadro (como darle a pausa) — no reinicia */
      setLoading(false);
      gsec.classList.add('is-paused');                   /* reaparece el botón ▶ para reanudar */
    }
    function greetToggle(){ if(gv.paused) greetPlay(); else greetPauseVid(); }
    function greetClose(){                               /* cerrar = volver al poster inicial */
      gv.pause(); try{ gv.currentTime=0; }catch(e){}
      gsec.classList.remove('is-playing','is-paused','is-loading');
    }
    gp.addEventListener('click', function(e){ e.stopPropagation(); greetToggle(); });   /* botón → play/pausa */
    gv.addEventListener('click', greetToggle);                                          /* clic en el video → play/pausa */
    if(gbd) gbd.addEventListener('click', greetClose);                                  /* clic fuera (backdrop) → cerrar */
    /* sincroniza las clases con el estado REAL del <video> (cubre cualquier ruta de pausa/play/buffer) */
    gv.addEventListener('play',    function(){ gsec.classList.add('is-playing'); gsec.classList.remove('is-paused'); lockHold(); });
    gv.addEventListener('playing', function(){ setLoading(false); });   /* ya renderiza fluido → quita spinner */
    gv.addEventListener('canplay', function(){ setLoading(false); });
    gv.addEventListener('waiting', function(){ if(gsec.classList.contains('is-playing') && !gv.paused) setLoading(true); }); /* buffer underrun → spinner */
    gv.addEventListener('pause',   function(){ if(gsec.classList.contains('is-playing') && !gv.ended) gsec.classList.add('is-paused'); releaseHold(); });
    gv.addEventListener('ended', greetClose);
    document.addEventListener('keydown', function(e){
      if(!gsec.classList.contains('is-playing')) return;
      if(e.key===' '||e.key==='Spacebar'){ e.preventDefault(); greetToggle(); }   /* barra espaciadora = play/pausa */
      else if(e.key==='Escape'){ greetClose(); }
    });
    /* lazy-preload: bufferiza por adelantado al acercarse al viewport → al dar click arranca instantáneo */
    if('IntersectionObserver' in window){
      var gpre=new IntersectionObserver(function(es){
        es.forEach(function(e){ if(e.isIntersecting){ try{ gv.preload='auto'; gv.load(); }catch(err){} gpre.disconnect(); } });
      },{ rootMargin:'400px 0px' });
      gpre.observe(gsec);
    } else { try{ gv.preload='auto'; }catch(err){} }
  }

  /* ---- Spotlight cards (.post--glow): el brillo del borde sigue al cursor — Soul Feed + Courses ---- */
  if(matchMedia('(hover:hover) and (pointer:fine)').matches){
    [].slice.call(document.querySelectorAll('.post--glow')).forEach(function(card){
      var raf=0,mx=0,my=0;
      function apply(){ raf=0; card.style.setProperty('--mx',mx+'px'); card.style.setProperty('--my',my+'px'); }
      card.addEventListener('pointerenter',function(){ card.style.setProperty('--glow','1'); });
      card.addEventListener('pointermove',function(e){
        var r=card.getBoundingClientRect(); mx=e.clientX-r.left; my=e.clientY-r.top;
        if(!raf) raf=requestAnimationFrame(apply);
      });
      card.addEventListener('pointerleave',function(){ card.style.setProperty('--glow','0'); });
    });
  }

  /* ---- Books: flowing background paths (port vanilla del efecto "Background Paths") → líneas que fluyen hacia el libro ---- */
  (function(){
    var host=document.getElementById('booksPaths');
    if(!host) return;
    var NS='http://www.w3.org/2000/svg';
    var svg=document.createElementNS(NS,'svg');
    svg.setAttribute('viewBox','-658 -67 907 454');
    svg.setAttribute('preserveAspectRatio','none');
    svg.setAttribute('fill','none');
    [1,-1].forEach(function(position){
      for(var i=0;i<11;i++){
        var d='M-'+(380-i*5*position)+' -'+(189+i*6)
          +'C-'+(380-i*5*position)+' -'+(189+i*6)
          +' -'+(312-i*5*position)+' '+(216-i*6)+' '+(152-i*5*position)+' '+(343-i*6)
          +'C'+(616-i*5*position)+' '+(470-i*6)+' '+(684-i*5*position)+' '+(875-i*6)+' '+(684-i*5*position)+' '+(875-i*6);
        var p=document.createElementNS(NS,'path');
        p.setAttribute('d',d);
        p.setAttribute('pathLength','1');
        p.setAttribute('stroke-width',(0.6+i*0.13).toFixed(2));
        p.setAttribute('stroke-opacity',(0.09+i*0.024).toFixed(3));
        if(!reduce){ p.style.animationDuration=(16+i*1.4+(position>0?0:4))+'s'; p.style.animationDelay=(-i*0.8)+'s'; }
        svg.appendChild(p);
      }
    });
    host.appendChild(svg);
  })();

  /* ---- Stories / testimonials: scroll horizontal siguiendo el mouse (port del efecto Webflow) ---- */
  (function(){
    var sec=document.getElementById('storiesWrap'); if(!sec) return;
    var track=document.getElementById('storiesTrack'); if(!track) return;
    var aL=document.getElementById('storiesPrev'), aR=document.getElementById('storiesNext');
    if(!matchMedia('(hover:hover) and (pointer:fine)').matches || reduce) return;  /* touch/reduced → scroll nativo */
    sec.classList.add('is-glide');
    var EASE=0.045, cur=0, tar=0, maxShift=0;   /* más bajo = glide más lento/suave */
    function measure(){ maxShift=Math.max(0, track.scrollWidth - sec.clientWidth + 24); }
    measure(); window.addEventListener('resize', measure);
    sec.addEventListener('mousemove', function(e){
      var r=sec.getBoundingClientRect(); var t=(e.clientX-r.left)/r.width; t=t<0?0:(t>1?1:t); tar=-t*maxShift;
    });
    function tick(){
      var d=tar-cur, moving=Math.abs(d)>1.5;
      if(aL) aL.classList.toggle('is-active', moving && d>0);
      if(aR) aR.classList.toggle('is-active', moving && d<0);
      cur+=d*EASE; if(Math.abs(tar-cur)<.2) cur=tar;
      track.style.transform='translateX('+cur.toFixed(1)+'px)';
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();

  /* ---- Stories / testimonials: entrada scroll-reveal (rise+fade) de fotos y bubbles ---- */
  (function(){
    if(reduce) return;                                   /* reduced → cards visibles (sin .rev-ready) */
    var wrap=document.getElementById('storiesWrap');
    if(!wrap || !('IntersectionObserver' in window)) return;
    var cards=[].slice.call(wrap.querySelectorAll('.story-photo,.story-quote'));
    if(!cards.length) return;
    wrap.classList.add('rev-ready');                     /* activa el estado oculto del CSS */
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){
        cards.forEach(function(c,i){ c.style.transitionDelay=(Math.min(i,8)*0.05)+'s'; c.classList.add('in'); });
        io.disconnect();
      }});
    },{threshold:.12, rootMargin:'0px 0px -8% 0px'});
    io.observe(wrap);
  })();
})();
