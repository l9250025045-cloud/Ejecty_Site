/* ============================================================
   Ejecty — landing interactions
   ============================================================ */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Hero: wipe the dust/blobs off the title with the cursor ---- */
  var hero = document.querySelector('.hero');
  var blobs = Array.prototype.slice.call(document.querySelectorAll('.mess .deco'));
  if (hero && blobs.length && !reduce) {
    var cleaned = 0, respawnT = null;

    function respawn() {
      blobs.forEach(function (b) {
        b.style.transition = 'transform .5s ease, opacity .5s ease';
        b.style.transform = '';
        b.style.opacity = '';
        b.dataset.clean = '0';
      });
      cleaned = 0;
      hero.classList.remove('is-clean');
    }

    function wipe(e) {
      var mx = e.clientX, my = e.clientY;
      blobs.forEach(function (b) {
        if (b.dataset.clean === '1') return;
        var r = b.getBoundingClientRect();
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var dx = cx - mx, dy = cy - my;
        var d = Math.hypot(dx, dy);
        if (d < 82) {
          var a = Math.atan2(dy, dx);
          var fly = 260;
          b.style.transition = 'transform .6s cubic-bezier(.2,.75,.25,1), opacity .55s ease';
          b.style.transform = 'translate(' + (Math.cos(a) * fly).toFixed(0) + 'px,' +
                              (Math.sin(a) * fly).toFixed(0) + 'px) scale(.35) rotate(40deg)';
          b.style.opacity = '0';
          b.dataset.clean = '1';
          cleaned++;
          if (cleaned === blobs.length) {
            hero.classList.add('is-clean');
            clearTimeout(respawnT);
            respawnT = setTimeout(respawn, 2400);
          }
        }
      });
    }
    hero.addEventListener('pointermove', wipe);
  }

  /* ---- Hero: steamed / fogged glass you can wipe clear ---- */
  var fog = document.getElementById('heroFog');
  if (fog && hero && !reduce) {
    var fctx = fog.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var lastX = null, lastY = null;

    /* paint the milky condensation, with a soft radial "clearer in the middle" look */
    function paintFog(alpha) {
      var w = fog.width, h = fog.height;
      fctx.globalCompositeOperation = 'source-over';
      fctx.globalAlpha = alpha;
      var g = fctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(233, 244, 255, 0.80)');
      g.addColorStop(1, 'rgba(210, 230, 250, 0.72)');
      fctx.fillStyle = g;
      fctx.fillRect(0, 0, w, h);
      /* condensation droplets/streaks for texture (only on full repaint) */
      if (alpha >= 0.9) {
        var i, n = Math.round((w * h) / (26000 * dpr));
        for (i = 0; i < n; i++) {
          var x = ((i * 9301 + 49297) % 233280) / 233280 * w;
          var y = ((i * 49297 + 9301) % 233280) / 233280 * h;
          var rr = 6 * dpr + ((i * 7) % 5) * dpr;
          fctx.beginPath();
          fctx.arc(x, y, rr, 0, Math.PI * 2);
          fctx.fillStyle = (i % 3 === 0)
            ? 'rgba(255,255,255,0.30)'
            : 'rgba(255,255,255,0.16)';
          fctx.fill();
        }
      }
      fctx.globalAlpha = 1;
    }

    function sizeFog() {
      var r = hero.getBoundingClientRect();
      fog.width = Math.max(1, Math.round(r.width * dpr));
      fog.height = Math.max(1, Math.round(r.height * dpr));
      paintFog(1);
    }

    /* erase a soft round patch, joining strokes so a drag clears a smooth trail */
    function clearAt(cx, cy) {
      fctx.globalCompositeOperation = 'destination-out';
      var brush = 90 * dpr;
      function dab(x, y) {
        var rg = fctx.createRadialGradient(x, y, 0, x, y, brush);
        rg.addColorStop(0, 'rgba(0,0,0,1)');
        rg.addColorStop(0.65, 'rgba(0,0,0,0.9)');
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        fctx.fillStyle = rg;
        fctx.beginPath();
        fctx.arc(x, y, brush, 0, Math.PI * 2);
        fctx.fill();
      }
      if (lastX !== null) {
        var dx = cx - lastX, dy = cy - lastY;
        var steps = Math.max(1, Math.round(Math.hypot(dx, dy) / (brush * 0.4)));
        for (var s = 1; s <= steps; s++) dab(lastX + dx * s / steps, lastY + dy * s / steps);
      } else {
        dab(cx, cy);
      }
      lastX = cx; lastY = cy;
      fctx.globalCompositeOperation = 'source-over';
    }

    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      clearAt((e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr);
    });
    hero.addEventListener('pointerleave', function () { lastX = lastY = null; });

    /* slowly steam back up so the fog keeps re-forming — like a real animation */
    setInterval(function () { paintFog(0.04); }, 260);

    sizeFog();
    window.addEventListener('resize', sizeFog);
    window.addEventListener('load', sizeFog);
  }

  /* ---- Capabilities carousel (seamless infinite loop) ---- */
  var stage = document.getElementById('capsStage');
  var track = document.getElementById('capsTrack');
  var dotsWrap = document.getElementById('capsDots');
  if (stage && track) {
    var baseItems = Array.prototype.slice.call(track.querySelectorAll('.feat'));
    var n = baseItems.length;
    // clone every card once and append, so the first screens seamlessly follow
    // the last one — after the last screen you already see the first coming in
    baseItems.forEach(function (it) {
      var c = it.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      track.appendChild(c);
    });
    var items = Array.prototype.slice.call(track.querySelectorAll('.feat'));

    var pos = 0, offset = 0;
    var down = false, moved = false, startX = 0, startOffset = 0, justDragged = false;
    var autoT = null;

    function leftPad() { return stage.clientWidth <= 700 ? 24 : 80; }
    // left-align the active screen (flush with the page gutter)
    function slotOffset(i) { return leftPad() - items[i].offsetLeft; }
    function apply() { track.style.transform = 'translateX(' + offset + 'px)'; }

    /* instantly (no animation) re-seat pos into the real [0, n) range —
       the clone at pos+n looks identical, so the jump is invisible */
    function normalize() {
      var norm = ((pos % n) + n) % n;
      if (norm === pos) return;
      pos = norm;
      track.classList.add('is-dragging');
      offset = slotOffset(pos); apply();
      void track.offsetWidth;
      track.classList.remove('is-dragging');
    }

    /* animate to slide position p (p may sit past the seam) */
    function slideTo(p) {
      pos = p;
      track.classList.remove('is-dragging');
      offset = slotOffset(pos); apply();
      updateDots();
    }

    function next() {
      if (pos >= n) normalize();      // keep pos within the cloned range
      slideTo(pos + 1);
    }
    function prev() {
      if (pos <= 0) {                 // hop into the clone region, then slide back
        track.classList.add('is-dragging');
        pos = n; offset = slotOffset(pos); apply();
        void track.offsetWidth;
        track.classList.remove('is-dragging');
      }
      slideTo(pos - 1);
    }

    /* once an animated slide finishes, snap back into the real range invisibly */
    track.addEventListener('transitionend', function (e) {
      if (e.target !== track || e.propertyName !== 'transform') return;
      if (!track.classList.contains('is-dragging')) normalize();
    });

    /* dots */
    var dots = [];
    if (dotsWrap) {
      for (var k = 0; k < n; k++) {
        var d = document.createElement('button');
        d.className = 'caps__dot';
        d.setAttribute('aria-label', 'Go to slide ' + (k + 1));
        (function (idx) { d.addEventListener('click', function () { stopAuto(); normalize(); slideTo(idx); startAuto(); }); })(k);
        dotsWrap.appendChild(d);
        dots.push(d);
      }
    }
    function updateDots() {
      var active = ((pos % n) + n) % n;
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === active); });
    }

    /* Back / Next buttons on the cards (present on clones too) */
    track.querySelectorAll('.pill[data-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (justDragged) return;
        stopAuto();
        if (btn.getAttribute('data-nav') === 'next') next(); else prev();
        startAuto();
      });
    });

    /* drag to scroll */
    track.addEventListener('pointerdown', function (e) {
      down = true; moved = false; startX = e.clientX; startOffset = offset; stopAuto();
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 6) { moved = true; track.classList.add('is-dragging'); }
      if (moved) { offset = startOffset + dx; apply(); }
    });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      down = false;
      if (moved) {
        track.classList.remove('is-dragging');
        // snap to the nearest slide (across the cloned range), then normalize
        var best = 0, bestD = Infinity;
        for (var i = 0; i < items.length; i++) {
          var dd = Math.abs(offset - slotOffset(i));
          if (dd < bestD) { bestD = dd; best = i; }
        }
        slideTo(best);
        justDragged = true; setTimeout(function () { justDragged = false; }, 260);
      }
      startAuto();
    });

    /* autoplay: always forward, seamlessly wrapping */
    function startAuto() { if (reduce) return; stopAuto(); autoT = setInterval(next, 4200); }
    function stopAuto() { clearInterval(autoT); }
    stage.addEventListener('mouseenter', stopAuto);
    stage.addEventListener('mouseleave', startAuto);

    function layout() { normalize(); offset = slotOffset(pos); apply(); }
    window.addEventListener('resize', layout);
    window.addEventListener('load', function () { offset = slotOffset(pos); apply(); updateDots(); });
    offset = slotOffset(0); apply(); updateDots();

    /* start autoplay + appearance zoom when section scrolls into view */
    if ('IntersectionObserver' in window) {
      var caps = document.querySelector('.caps');
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (en.isIntersecting) { document.querySelector('.caps').classList.add('in'); startAuto(); }
          else stopAuto();
        });
      }, { threshold: 0.2 });
      io.observe(caps);
    } else { startAuto(); }
  }

  /* ---- Support / FAQ accordion (one open at a time) ---- */
  var faqItems = Array.prototype.slice.call(document.querySelectorAll('.faq__item'));
  if (faqItems.length) {
    function faqClose(item) {
      item.classList.remove('is-open');
      item.querySelector('.faq__q').setAttribute('aria-expanded', 'false');
      item.querySelector('.faq__a').style.maxHeight = '';
    }
    function faqOpen(item) {
      item.classList.add('is-open');
      item.querySelector('.faq__q').setAttribute('aria-expanded', 'true');
      var a = item.querySelector('.faq__a');
      a.style.maxHeight = a.scrollHeight + 'px';
    }
    faqItems.forEach(function (item) {
      if (item.classList.contains('is-open')) faqOpen(item);
      item.querySelector('.faq__q').addEventListener('click', function () {
        if (item.classList.contains('is-open')) { faqClose(item); return; }
        faqItems.forEach(function (o) { if (o.classList.contains('is-open')) faqClose(o); });
        faqOpen(item);
      });
    });
    // keep open answers correctly sized after fonts load / on resize
    function faqResize() {
      faqItems.forEach(function (item) {
        if (!item.classList.contains('is-open')) return;
        var a = item.querySelector('.faq__a');
        a.style.maxHeight = 'none';
        var h = a.scrollHeight;
        a.style.maxHeight = h + 'px';
      });
    }
    window.addEventListener('load', faqResize);
    window.addEventListener('resize', faqResize);
  }

  /* ---- Video strip: highlight one clip at a time, others dim ---- */
  var vidsRow = document.getElementById('vidsRow');
  if (vidsRow) {
    var vids = Array.prototype.slice.call(vidsRow.querySelectorAll('.vid'));
    vids.forEach(function (v) {
      var el = v.querySelector('video');
      if (el) { var p = el.play(); if (p && p.catch) p.catch(function () {}); }
    });
    if (!reduce && vids.length) {
      var vi = 0;
      setInterval(function () {
        vids[vi].classList.remove('is-active');
        vi = (vi + 1) % vids.length;
        vids[vi].classList.add('is-active');
      }, 2800);
    }
  }

  /* ---- Reveal-on-scroll for headings ---- */
  var revealables = document.querySelectorAll('.capshead, .cta__inner');
  if ('IntersectionObserver' in window) {
    revealables.forEach(function (el) { el.classList.add('reveal'); });
    var io2 = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('reveal--in'); io2.unobserve(en.target); }
      });
    }, { threshold: 0.15 });
    revealables.forEach(function (el) { io2.observe(el); });
  }

  /* ---- Header shadow after scroll ---- */
  var header = document.querySelector('.header');
  if (header) {
    var onScroll = function () { header.classList.toggle('header--scrolled', window.scrollY > 10); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }
})();
