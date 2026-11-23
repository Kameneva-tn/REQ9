/* REQ9 Lab motion engine — shared by the inner pages.
   mount(root) wires: custom cursor, top progress bar, scroll reveals (.rv, .lh, .rows>.row),
   row-number scramble, hero-meta counters, velocity ticker, scrubbed manifesto (.mani h3.scrub, .mani-rule),
   cursor-following specimen (.spec), magnetic buttons ([data-magnet]). Returns an unmount function. */
(function () {
  function mount(root) {
    var win = window, doc = root.ownerDocument, host = doc.documentElement;
    var dead = false, timers = [], rafs = [], listens = [];
    var reduce = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fine = win.matchMedia && win.matchMedia('(hover:hover) and (pointer:fine)').matches;
    function on(el, ev, fn, o) { el.addEventListener(ev, fn, o); listens.push([el, ev, fn, o]); }
    function later(fn, ms) { timers.push(win.setTimeout(fn, ms)); }
    function loop(fn) { function f(t) { if (dead) return; fn(t); rafs.push(win.requestAnimationFrame(f)); } rafs.push(win.requestAnimationFrame(f)); }
    function q(s) { return Array.prototype.slice.call(root.querySelectorAll(s)); }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    var unmount = function () {
      dead = true;
      timers.forEach(function (id) { win.clearTimeout(id); win.clearInterval(id); });
      rafs.forEach(function (id) { win.cancelAnimationFrame(id); });
      listens.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
      if (io) io.disconnect();
      host.classList.remove('armed'); host.classList.remove('fine');
    };
    var io = null;
    if (reduce) return unmount;
    host.classList.add('armed');
    if (fine) host.classList.add('fine');

    function show(el) { el.classList.add('in'); }
    function scramble(el, delay) {
      var fin = el.textContent, A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/';
      later(function () {
        var n = 0, id = win.setInterval(function () {
          n++;
          if (n > 9) { win.clearInterval(id); el.textContent = fin; return; }
          el.textContent = fin.split('').map(function (c, i) { return (i < n - 2 || c === '/') ? c : A[Math.floor(Math.random() * A.length)]; }).join('');
        }, 45);
        timers.push(id);
      }, delay);
    }
    function countUp(meta) {
      Array.prototype.slice.call(meta.querySelectorAll('i[data-v]')).forEach(function (el, i) {
        var v = +el.dataset.v, k = 0, w = (el.dataset.v || '').length; el.textContent = '0'.repeat(w);
        later(function () { var id = win.setInterval(function () { k++; el.textContent = String(Math.round(v * Math.min(1, k / 18))).padStart(w, '0'); if (k >= 18) win.clearInterval(id); }, 55); timers.push(id); }, 500 + i * 120);
      });
    }
    // reveals
    var pending = q('.rv, .lh, .rows > .row');
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(function (en) {
        en.forEach(function (e) {
          if (!e.isIntersecting) return;
          var el = e.target; io.unobserve(el); show(el);
          if (el.classList.contains('row')) { var n = el.querySelector('.row-no'); if (n) scramble(n, 150); }
          if (el.classList.contains('hero-meta')) countUp(el);
        });
      }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
      later(function () { pending.forEach(function (el) { io.observe(el); }); }, 60);
    } else pending.forEach(show);

    // cursor
    var dot = root.querySelector('.cur-dot'), ring = root.querySelector('.cur-ring');
    if (fine && dot && ring) {
      var mx = win.innerWidth / 2, my = win.innerHeight / 2, rx = mx, ry = my;
      on(win, 'mousemove', function (e) { mx = e.clientX; my = e.clientY; dot.style.transform = 'translate(' + (mx - 3) + 'px,' + (my - 3) + 'px)'; }, { passive: true });
      loop(function () { rx += (mx - rx) * .14; ry += (my - ry) * .14; ring.style.transform = 'translate(' + (rx - 17) + 'px,' + (ry - 17) + 'px)'; });
      q('a,button,.row,input,textarea,select').forEach(function (el) { on(el, 'mouseenter', function () { ring.classList.add('is-hover'); }); on(el, 'mouseleave', function () { ring.classList.remove('is-hover'); }); });
    }
    // specimen follow
    var spec = root.querySelector('.spec');
    if (fine && spec) {
      var sx = null, sy = 0, cx = -9999, cy = -9999;
      on(win, 'mousemove', function (e) { cx = e.clientX; cy = e.clientY; }, { passive: true });
      loop(function () {
        var host = spec.offsetParent || root, r = host.getBoundingClientRect();
        var k = (r.width / (host.offsetWidth || r.width)) || 1; // canvas zoom correction
        var tx = (cx - r.left) / k + 30, ty = (cy - r.top) / k - 140;
        if (sx === null) { sx = tx; sy = ty; }
        sx += (tx - sx) * .14; sy += (ty - sy) * .14;
        spec.style.transform = 'translate(' + sx + 'px,' + sy + 'px)';
      });
    }
    // magnetic
    if (fine) q('[data-magnet]').forEach(function (b) {
      on(b, 'mousemove', function (e) { var r = b.getBoundingClientRect(); b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * .25) + 'px,' + ((e.clientY - r.top - r.height / 2) * .35) + 'px)'; });
      on(b, 'mouseleave', function () { b.style.transform = ''; });
    });
    // scroll-linked: progress, tickers, manifesto scrub
    var scroller = doc.scrollingElement || host, prog = root.querySelector('.progress');
    var lastY = scroller.scrollTop, vel = 0;
    on(win, 'scroll', function () { var y = scroller.scrollTop; vel += (y - lastY) * .6; lastY = y; }, { passive: true });
    var tracks = q('.ticker-track'), xs = tracks.map(function () { return 0; });
    var heads = q('.mani h3.scrub'), rules = q('.mani-rule');
    loop(function (t) {
      var H = win.innerHeight, max = scroller.scrollHeight - scroller.clientHeight, scrollable = max > 40;
      if (prog) prog.style.width = (max > 0 ? scroller.scrollTop / max * 100 : 0) + '%';
      tracks.forEach(function (tr, i) {
        var dir = tr.dataset.dir === 'r' ? -1 : 1;
        xs[i] -= (1 + Math.min(Math.abs(vel) * .06, 8)) * dir;
        var w = tr.scrollWidth / 3; if (xs[i] <= -w) xs[i] += w; if (xs[i] > 0) xs[i] -= w;
        tr.style.transform = 'translate3d(' + xs[i] + 'px,0,0) skewX(' + clamp(vel * .4, -8, 8) + 'deg)';
      });
      vel *= .9;
      heads.forEach(function (h) {
        var r = h.getBoundingClientRect(), p;
        if (scrollable) p = clamp((H * .85 - r.top) / (H * .3 + r.height), 0, 1);
        else { if (!h._t0 && r.top < H) h._t0 = t; p = h._t0 ? clamp((t - h._t0) / 1600, 0, 1) : 0; }
        var ws = h.querySelectorAll('.w'), n = ws.length;
        for (var i = 0; i < n; i++) { var k = clamp(p * (n + 2) - i, 0, 1); ws[i].style.opacity = (.12 + .88 * k).toFixed(3); }
      });
      rules.forEach(function (r) {
        var rect = r.getBoundingClientRect(), p;
        if (scrollable) p = clamp((H * .92 - rect.top) / (H * .42), 0, 1);
        else { if (!r._t0 && rect.top < H) r._t0 = t; p = r._t0 ? clamp((t - r._t0) / 1200, 0, 1) : 0; }
        var b = r.querySelector(':scope > b');
        if (b) { var kb = clamp(p / .3, 0, 1); b.style.opacity = kb; b.style.transform = 'translateX(' + (-16 * (1 - kb)) + 'px)'; }
        var wm = r.querySelectorAll('.wm>span');
        for (var i = 0; i < wm.length; i++) { var k = clamp((p - .05 - i * .05) / .5, 0, 1), e = 1 - Math.pow(1 - k, 3); wm[i].style.transform = 'translateY(' + (110 * (1 - e)) + '%)'; }
        var ws = r.querySelectorAll('.w');
        for (var j = 0; j < ws.length; j++) { var k2 = clamp((p - .3 - j * .02) / .5, 0, 1); ws[j].style.opacity = (.12 + .88 * k2).toFixed(3); }
      });
    });
    return unmount;
  }
  window.REQ9Lab = { mount: mount };
})();
