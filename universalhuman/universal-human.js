/* ============================================================================
   UNIVERSAL HUMAN · page-scoped motion
   Shared internal.js already handles: footer year, nav (solidify/burger/dropdown),
   aria-current, .rv scroll reveals. This file only adds:
     · reduced-motion pause of the background waves video (poster remains)
   (El tilt 3D del libro se retiró 2026-07-07: hero limpio y fiel al WP original.)
   ========================================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Background waves video: pause + drop autoplay for reduced-motion users.
  if (reduce) {
    Array.prototype.forEach.call(document.querySelectorAll('.uh-waves__vid'), function (v) {
      try { v.pause(); v.removeAttribute('autoplay'); } catch (e) { /* noop */ }
    });
  }
})();
