/* ═══════════════════════════════════════════════════════════════
   Landing page interactions (index.html)
   Vanilla JS, no dependencies. Everything here is enhancement:
   the page reads and works fine if this file never loads.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ── Hero title: split into words so they can rise in sequence ── */
  (function splitTitle() {
    var h1 = $('.hero h1');
    if (!h1) return;
    var out = '';
    h1.textContent.trim().split(/\s+/).forEach(function (word, i) {
      var tint = /Gatepass/i.test(word) ? ' tint' : '';
      var delay = reduced ? 0 : 0.06 * i + 0.15;
      out += '<span class="word"><span class="' + tint.trim() + '" style="' +
             (reduced ? '' : 'transform:translateY(105%);transition:transform .9s cubic-bezier(.2,.75,.25,1) ' + delay + 's') +
             '">' + word + '</span></span> ';
    });
    h1.innerHTML = out.trim();
    if (!reduced) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          $$('.hero h1 .word > span').forEach(function (s) { s.style.transform = 'translateY(0)'; });
        });
      });
    }
  })();

  /* ── Scroll progress bar + sticky header state ── */
  var progress = $('.progress');
  var nav = $('.nav');
  var ticking = false;

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
    if (nav) nav.classList.toggle('stuck', y > 24);

    if (!reduced) {
      // Gentle parallax on the ambient blobs.
      $$('.aurora span').forEach(function (el, i) {
        el.style.transform = 'translate3d(0,' + (y * (0.04 + i * 0.03)).toFixed(1) + 'px,0)';
      });
    }
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ── Reveal on scroll ── */
  var targets = $$('.reveal');
  if ('IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var delay = parseFloat(el.getAttribute('data-delay') || 0);
        setTimeout(function () { el.classList.add('in'); }, delay * 1000);
        io.unobserve(el);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    targets.forEach(function (el) { io.observe(el); });
  } else {
    targets.forEach(function (el) { el.classList.add('in'); });
  }

  /* ── Seal: 3D tilt that follows the pointer ── */
  (function tiltSeal() {
    var plate = $('.seal-plate');
    if (!plate || reduced) return;
    var stage = $('.seal-stage');
    var frame;

    function move(e) {
      var p = e.touches ? e.touches[0] : e;
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(function () {
        var r = plate.getBoundingClientRect();
        var cx = r.left + r.width / 2;
        var cy = r.top + r.height / 2;
        // Normalised distance, clamped so the tilt stays subtle far from the seal.
        var dx = Math.max(-1, Math.min(1, (p.clientX - cx) / (window.innerWidth / 2)));
        var dy = Math.max(-1, Math.min(1, (p.clientY - cy) / (window.innerHeight / 2)));
        plate.style.transform = 'rotateY(' + (dx * 14).toFixed(2) + 'deg) rotateX(' + (-dy * 12).toFixed(2) + 'deg)';
      });
    }

    function reset() {
      if (frame) cancelAnimationFrame(frame);
      plate.style.transform = '';
    }

    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerleave', reset);
    if (stage) stage.addEventListener('pointerleave', function () { /* keep following */ });
  })();

  /* ── Page-wide glow that tracks the pointer ── */
  (function spotlight() {
    var el = $('#spotlight');
    if (!el || reduced) return;
    var frame;
    window.addEventListener('pointermove', function (e) {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(function () {
        el.classList.add('on');
        el.style.setProperty('--px', e.clientX + 'px');
        el.style.setProperty('--py', e.clientY + 'px');
      });
    }, { passive: true });
    window.addEventListener('pointerleave', function () { el.classList.remove('on'); });
  })();

  /* ── Step cards: spotlight follows the cursor ── */
  $$('.step').forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      if (reduced) return;
      var dx = (e.clientX - r.left) / r.width - 0.5;
      var dy = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = 'perspective(800px) rotateY(' + (dx * 6).toFixed(2) +
                             'deg) rotateX(' + (-dy * 6).toFixed(2) + 'deg) translateY(-4px)';
    });
    card.addEventListener('pointerleave', function () { card.style.transform = ''; });
  });

  /* ── Stat counters ── */
  (function counters() {
    var nums = $$('[data-count]');
    if (!nums.length) return;
    if (!('IntersectionObserver' in window) || reduced) {
      nums.forEach(function (n) { n.textContent = n.getAttribute('data-count'); });
      return;
    }
    var io2 = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var target = el.getAttribute('data-count');
        var suffix = target.replace(/[\d]/g, '');
        var end = parseInt(target, 10) || 0;
        var start = performance.now();
        var dur = 1100;
        (function step(now) {
          var t = Math.min(1, (now - start) / dur);
          var eased = 1 - Math.pow(1 - t, 3);
          el.textContent = Math.round(end * eased) + suffix;
          if (t < 1) requestAnimationFrame(step);
        })(start);
        io2.unobserve(el);
      });
    }, { threshold: 0.5 });
    nums.forEach(function (n) { io2.observe(n); });
  })();
})();
