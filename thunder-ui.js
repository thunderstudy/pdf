/* ThunderStudy clay UI behaviour: loader, theme toggle, mobile menu, floating dock, sidebar rail, back-to-top.
   Works on any page that includes the matching markup; every block is skipped when its elements are missing.
   Call window.ThunderUI.refresh() after content is rendered late (React) so scroll-spy sees the sections. */
(function () {
  'use strict';
  var de = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- LOADER ---------- */
  var loader = document.getElementById('loader');
  function hideLoader() { if (loader) loader.classList.add('hide'); }
  window.addEventListener('DOMContentLoaded', function () { setTimeout(hideLoader, 200); });
  window.addEventListener('load', hideLoader);
  setTimeout(hideLoader, 1500);

  /* ---------- THEME (light = blue, dark = purple; saved choice only, never the system setting) ---------- */
  var themeBtn = document.getElementById('themeBtn');
  function setMetaTheme(t) {
    var mt = document.getElementById('metaTheme');
    if (mt) mt.setAttribute('content', t === 'dark' ? '#9A7AFB' : '#573AFC');
  }
  function syncTheme() {
    var dark = de.getAttribute('data-theme') === 'dark';
    if (themeBtn) themeBtn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    setMetaTheme(dark ? 'dark' : 'light');
  }
  syncTheme();
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = de.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      function apply() {
        de.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (e) {}
        syncTheme();
        document.dispatchEvent(new CustomEvent('thunder:theme', { detail: next }));
      }
      if (!document.startViewTransition || reduce) { apply(); return; }
      var r = themeBtn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      var rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      de.classList.add('theme-swap');
      var t = document.startViewTransition(apply);
      t.ready.then(function () {
        de.animate({ clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + rad + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 650, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)' });
      });
      var done = function () { de.classList.remove('theme-swap'); };
      t.finished.then(done, done);
    });
  }

  /* ---------- MOBILE MENU ---------- */
  var ham = document.getElementById('hamBtn'), menu = document.getElementById('mobileMenu');
  function closeMenu(focus) {
    if (!menu || !ham) return;
    menu.classList.remove('open');
    ham.setAttribute('aria-expanded', 'false');
    if (focus) ham.focus();
  }
  if (ham && menu) {
    ham.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      ham.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    menu.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) closeMenu(true);
    });
  }

  /* ---------- TOAST ---------- */
  var toast = document.getElementById('toast'), toastT;
  function say(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toast.classList.remove('show'); }, 2200);
  }

  /* ---------- BOTTOM DOCK ---------- */
  var dock = document.querySelector('.dock');
  var ind = dock && dock.querySelector('.dock-indicator');
  var dockBtns = dock ? [].slice.call(dock.querySelectorAll('.dock-btn')) : [];
  var dockActive = null;
  function dockX(b) { return b.offsetLeft + (b.offsetWidth - ind.offsetWidth) / 2; }
  function dockPlace() { if (ind && dockActive) ind.style.setProperty('--dx', dockX(dockActive) + 'px'); }
  function dockSet(b, animate) {
    if (!b || !ind) return;
    dockBtns.forEach(function (o) { o.removeAttribute('aria-current'); });
    b.setAttribute('aria-current', 'page');
    dockActive = b;
    if (animate === false) { ind.classList.add('no-anim'); dockPlace(); void ind.offsetWidth; ind.classList.remove('no-anim'); }
    else dockPlace();
  }
  if (dock && ind && dockBtns.length) {
    dockSet(dockBtns.filter(function (b) { return b.getAttribute('aria-current') === 'page'; })[0] || dockBtns[0], false);
    requestAnimationFrame(function () { requestAnimationFrame(dockPlace); });
    window.addEventListener('resize', dockPlace);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(dockPlace);
    dockBtns.forEach(function (b) {
      b.addEventListener('pointerdown', function () {
        var r = document.createElement('span');
        r.className = 'dock-ripple';
        b.appendChild(r);
        setTimeout(function () { r.remove(); }, 600);
      });
      b.addEventListener('click', function () {
        var h = b.getAttribute('href');
        if (h && h.charAt(0) === '#') dockSet(b);
        document.dispatchEvent(new CustomEvent('thunder:dock', { detail: b.getAttribute('data-tab') }));
      });
    });
    /* hide the dock while scrolling down, show it on scroll up or at the end of the page */
    var lastY = window.pageYOffset, tick = false;
    window.addEventListener('scroll', function () {
      if (tick) return;
      tick = true;
      requestAnimationFrame(function () {
        var y = window.pageYOffset, d = y - lastY;
        if (Math.abs(d) > 8) { dock.classList.toggle('hide', d > 0 && y > 160); lastY = y; }
        if ((window.innerHeight + y) >= document.documentElement.scrollHeight - 4) dock.classList.remove('hide');
        tick = false;
      });
    }, { passive: true });
  }

  /* ---------- SIDEBAR (1200px and up) ---------- */
  var side = document.getElementById('sideNav');
  var sideLinks = side ? [].slice.call(side.querySelectorAll('.side-link')) : [];
  var tg = document.getElementById('sideToggle');
  if (side && tg) {
    sideLinks.forEach(function (a, i) {
      a.style.setProperty('--i', i);
      var t = a.querySelector('.side-text');
      if (t) a.title = t.textContent;
    });
    var ST = ['min', 'rail', 'open'], LBL = { min: 'Show sidebar icons', rail: 'Show sidebar labels', open: 'Hide sidebar' };
    var state = function () { return side.classList.contains('open') ? 'open' : side.classList.contains('min') ? 'min' : 'rail'; };
    var setState = function (n) {
      side.classList.toggle('min', n === 'min');
      side.classList.toggle('open', n === 'open');
      tg.setAttribute('aria-expanded', n === 'min' ? 'false' : 'true');
      tg.setAttribute('aria-label', LBL[n]);
      tg.title = LBL[n];
    };
    setState('min');
    tg.addEventListener('click', function (e) { e.stopPropagation(); setState(ST[(ST.indexOf(state()) + 1) % 3]); });
    document.addEventListener('click', function (e) { if (state() === 'open' && !side.contains(e.target)) setState('rail'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state() === 'open') { setState('rail'); tg.focus(); } });
    var ft = document.querySelector('footer.wmf');
    if (ft && 'IntersectionObserver' in window) new IntersectionObserver(function (es) { side.classList.toggle('gone', es[0].isIntersecting); }).observe(ft);
  }

  /* ---------- SCROLL-SPY (sidebar + dock) ---------- */
  var spy = null;
  function markSpy(id) {
    sideLinks.forEach(function (a) { if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    var hit = dockBtns.filter(function (b) { return b.getAttribute('href') === '#' + id; })[0];
    if (hit && hit !== dockActive) dockSet(hit);
  }
  function refresh() {
    if (!('IntersectionObserver' in window)) return;
    if (spy) spy.disconnect();
    var targets = {};
    sideLinks.concat(dockBtns).forEach(function (a) {
      var h = a.getAttribute('href');
      if (h && h.length > 1 && h.charAt(0) === '#') { var el = document.getElementById(h.slice(1)); if (el) targets[h.slice(1)] = el; }
    });
    spy = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) markSpy(e.target.id); }); }, { rootMargin: '-25% 0px -65% 0px' });
    Object.keys(targets).forEach(function (k) { spy.observe(targets[k]); });
    dockPlace();
  }
  refresh();
  window.addEventListener('load', refresh);

  /* ---------- BACK TO TOP (below 1200px) ---------- */
  var tt = document.getElementById('toTop');
  if (tt) {
    var tk = false;
    var chk = function () { tt.classList.toggle('show', window.pageYOffset > 400); tk = false; };
    window.addEventListener('scroll', function () { if (!tk) { tk = true; requestAnimationFrame(chk); } }, { passive: true });
    chk();
  }

  window.ThunderUI = { refresh: refresh, say: say, closeMenu: closeMenu, dockSet: function (tab) {
    var b = dockBtns.filter(function (x) { return x.getAttribute('data-tab') === tab; })[0];
    if (b) dockSet(b);
  } };
})();
