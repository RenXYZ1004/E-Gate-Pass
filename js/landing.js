/* Minimal public-page enhancement: subtle header shadow after scroll. */
(function () {
  'use strict';
  var header = document.querySelector('.nav');
  if (!header) return;
  var ticking = false;
  function updateHeader() {
    header.classList.toggle('stuck', window.scrollY > 8);
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(updateHeader); }
  }, { passive: true });
  updateHeader();
})();
