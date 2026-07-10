/* Starfield twinkle sobre el cielo real (evening-with-gary) — 2026-07-04.
   ~140 estrellas, un solo rAF; pausa con document.hidden; con
   prefers-reduced-motion dibuja un único frame estático. */
(function () {
  var canvas = document.getElementById("evStars");
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var STAR_COUNT = 140;
  var stars = [];
  var rafId = null;
  var w = 0;
  var h = 0;
  var dpr = 1;

  function seed() {
    stars = [];
    for (var i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random() * 0.92,
        r: 0.4 + Math.random() * 0.95,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.9,
        drift: 0.002 + Math.random() * 0.006,
        warm: Math.random() < 0.22
      });
    }
  }

  function resize() {
    var host = canvas.parentElement;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = host.clientWidth;
    h = host.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var alpha = reduceMotion ? 0.6 : 0.32 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.001 * s.speed + s.phase));
      var x = ((s.x + (reduceMotion ? 0 : t * 0.0000015 * s.drift * 1000)) % 1) * w;
      var y = s.y * h;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.warm ? "#ffeccb" : "#eef1ff";
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function loop(t) {
    draw(t);
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (rafId !== null || reduceMotion) return;
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  seed();
  resize();

  if (reduceMotion) {
    draw(0);
  } else {
    start();
  }

  window.addEventListener("resize", function () {
    resize();
    if (reduceMotion) draw(0);
  }, { passive: true });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  });
})();
