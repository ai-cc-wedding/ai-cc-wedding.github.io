/* nurture cover (AI-CC 2026's journal cover) — progressive enhancement only (the cover is complete without it).
 * window.AICCCover.init(root, opts)
 *   - refreshes [data-w] facts inside the cover from window.WEDDING
 *   - sets data-phase = before | morning (12/19 from 06:00 KST) | evening (the ceremony, 18:00–20:00) | after (from
 *     20:00) on the host page's clock: opts.bounds = the times morning, evening and after begin. v1's app.js passes its
 *     own, so the cover, the wedding-day bar and the rest of the page flip together; the cover re-checks at each boundary
 *   - lets the masthead's hair cut-out and the once-per-session intro wait for the photo
 *   - fit(): with large system text, decorations step aside and the photo moves so both faces stay clear of the text
 * opts.phase forces a phase; opts.afterCue: the cue's words from 20:00, when the host page opens on a thank-you there
 * (v1 loaded after 20:00: 감사 인사 보기).
 * AICCCover.fit(root) re-measures (for example after v1 shows its wedding-day bar; a MutationObserver also catches that).
 */
(function () {
  'use strict';

  var NB = '\u00a0';
  var KEY = 'aicc:cover:nurture';
  var PHASES = ['before', 'morning', 'evening', 'after'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  // h11 (1365×2048) landmarks as fractions of the photo: his crown, her chin, the top of her hair, the left edges of his
  // hair and of hers (at her face), and the width/height ratio
  var CROWN = 0.2427, CHIN = 0.51, HER_TOP = 0.3936, HIS_L = 0.47, HER_L = 0.325, RATIO = 0.6665;
  var MAST = 0.17016, MAST_CROWN = 0.633389; // masthead height/width; his crown's depth into the masthead box
  var fits = [];

  function get(o, path) {
    return String(path).split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o);
  }
  function $(root, sel) { return root.querySelector(sel); }
  function $$(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** Same derived keys and line-break glue as v1-conf's app.js, so either script can fill the cover. */
  function derive(W, k) {
    if (k === 'venueHall') return W.venue.name + (W.venue.hall ? ' ' + W.venue.hall : '');
    if (k === 'dec19') return MONTHS[W.date.month - 1].slice(0, 3).toUpperCase() + NB + W.date.day;
    return get(W, k);
  }
  function glue(W, k, v) {
    v = String(v);
    if (k === 'date.ko') { // keep "오후 6시" together
      var t = v.split(' ');
      return t.length > 2 ? t.slice(0, -2).join(' ') + ' ' + t.slice(-2).join(NB) : v;
    }
    if (k === 'venueHall') {
      return W.venue.name.replace(/ /g, NB) + (W.venue.hall ? ' ' + W.venue.hall.replace(/ /g, NB) : '');
    }
    if (k === 'venue.formerName') return v.replace(/ /g, NB);
    return v;
  }

  /** The phase at time t: how many of the host's boundaries (morning, evening, after) have passed. */
  function phaseAt(bounds, t) {
    var i = 0;
    while (bounds && i < bounds.length && t >= bounds[i]) i++;
    return PHASES[i];
  }
  /** ms until the next boundary, or -1 when none is left. */
  function nextBoundary(bounds, now) {
    for (var i = 0; bounds && i < bounds.length; i++) if (bounds[i] > now) return bounds[i] - now;
    return -1;
  }

  /** How much the system text size inflates fonts (KakaoTalk 글자 크기, -webkit-text-size-adjust): 1 when it does not. */
  function textZoom(root) {
    var p = document.createElement('span');
    p.setAttribute('aria-hidden', 'true');
    p.style.cssText = 'position:absolute;left:0;top:0;display:block;visibility:hidden;pointer-events:none;font:100px/1 serif;white-space:nowrap';
    p.textContent = 'M';
    root.appendChild(p);
    var z = Math.max(parseFloat(getComputedStyle(p).fontSize) || 100, p.offsetHeight || 100) / 100;
    root.removeChild(p);
    return z > 1.01 && z < 4 ? Math.round(z * 1000) / 1000 : 1;
  }

  var AICCCover = {
    phaseAt: phaseAt,
    fit: function (root) { fits.forEach(function (f) { if (!root || f.root === root) f(); }); },

    init: function (root, opts) {
      root = root || document.querySelector('.jc--nurture');
      opts = opts || {};
      if (!root || root.getAttribute('data-jc-ready')) return;
      root.setAttribute('data-jc-ready', '1');
      var W = window.WEDDING, cl = root.classList, st = root.style, bounds = opts.bounds || null;

      // ---------------------------------------------------------- facts from WEDDING (static HTML already has them)
      if (W) {
        $$(root, '[data-w]').forEach(function (el) {
          var k = el.getAttribute('data-w');
          var v = derive(W, k);
          if (v != null && v !== '') el.textContent = glue(W, k, v);
        });
        var issueDate = $(root, '[data-jc-issue-date]');
        if (issueDate) issueDate.textContent = W.date.day + ' ' + MONTHS[W.date.month - 1] + ' ' + W.date.year;
      }

      // ---------------------------------------------------------- photo: the hair cut-out and the intro wait for it
      var img = $(root, '.jc__photo');
      var intro = cl.contains('jc--intro'), introDone = false;
      function introStart() { // the letters rise for 1.16 s once the photo is in
        if (introDone || !cl.contains('jc--intro')) return;
        introDone = true;
        try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* private mode */ }
        setTimeout(function () { cl.remove('jc--intro'); }, 1300);
      }
      function photoIn() { cl.add('is-photo'); if (intro) introStart(); }
      if (img) {
        if (img.complete && img.naturalWidth) photoIn();
        else img.addEventListener('load', photoIn);
      }
      if (intro && !cl.contains('is-photo')) {
        // the inline script already drops the intro after 0.7 s without the photo; this covers a late cover.js
        setTimeout(function () { if (!cl.contains('is-photo')) cl.remove('jc--intro'); }, 700);
      }

      // ---------------------------------------------------------- phase
      var kicker = $(root, '[data-jc-kicker]');
      var kickerText = kicker ? kicker.textContent : '';
      var verb = $(root, '[data-jc-verb]');
      var verbText = verb ? verb.textContent : '';
      var cue = $(root, '[data-jc-cue]');
      var cueText = cue ? cue.textContent : '';

      // On the wedding day the cover keeps its date and its cue: v1's day bar above it carries the day's news (오늘 오후
      // 6시 / 지금 예식 중 · 오시는 길), so nothing is said twice. Only the small kicker follows the day.
      function apply(phase) {
        root.setAttribute('data-phase', phase);
        if (kicker) {
          kicker.textContent = phase === 'morning' ? 'Out today' : phase === 'evening' ? 'Now in session'
            : phase === 'after' && W ? 'Published ' + W.date.year + '.' + pad(W.date.month) + '.' + pad(W.date.day) : kickerText;
        }
        if (verb) verb.textContent = phase === 'after' ? '결혼했습니다' : verbText;
        if (cue) cue.textContent = phase === 'after' && opts.afterCue || cueText;
        fit();
      }

      var timer = 0;
      function phaseNow() { return opts.phase || !bounds ? null : phaseAt(bounds, Date.now()); }
      function schedule() {
        if (opts.phase || !bounds) return;
        clearTimeout(timer);
        var ms = nextBoundary(bounds, Date.now());
        if (ms >= 0) timer = setTimeout(function () { apply(phaseNow()); schedule(); }, Math.min(ms + 500, 2147483000));
      }

      // ---------------------------------------------------------- fit: facts first, then both faces, then decoration
      var story = $(root, '.jc__story');
      var canvas = $(root, '.jc__canvas');
      var mast = $(root, '.jc__mast');
      var geo = !!(window.CSS && CSS.supports && CSS.supports('width', '1cqw'));
      var VARS = ['--jc-fade', '--jc-cap', '--jc-lt', '--jc-ll', '--jc-lh', '--jc-lmw', '--jc-lmt'];
      var busy = false;

      function fit() {
        if (busy || !story || !story.offsetHeight || !mast) return; // hidden (v1's developer mode shows the source)
        busy = true;
        cl.remove('is-tight', 'is-tighter', 'is-band', 'is-low', 'is-squeeze', 'is-bare');
        VARS.forEach(function (v) { st.removeProperty(v); });
        var tz = textZoom(root);
        if (tz !== 1) st.setProperty('--jc-tz', String(tz)); else st.removeProperty('--jc-tz');

        var cs = getComputedStyle(root);
        var land = cs.display === 'grid';
        // the first screen: the cover's own min-height (100svh, less v1's wedding-day bar), steady while toolbars hide
        var screenH = parseFloat(cs.minHeight) || window.innerHeight || 800;
        function y0() { return root.getBoundingClientRect().top; }
        function tooTall() { return root.offsetHeight > screenH + 1; }
        function fade() { return parseFloat(getComputedStyle(root).getPropertyValue('--jc-fade')) || 0; }
        function top() { return story.getBoundingClientRect().top - y0(); }
        function chin() {
          var c = canvas.getBoundingClientRect();
          return geo ? c.top - y0() + c.height * CHIN : root.offsetHeight * 0.5;
        }
        // her chin stays above the darker part of the scrim's fade
        function over() { return tooTall() || (!land && chin() > top() - fade() * 0.4); }

        if (over()) cl.add('is-tight');
        if (over()) cl.add('is-tighter');
        if (land) {
          if (over()) cl.add('is-squeeze');
          if (over()) cl.add('is-bare'); // the last resort: the facts keep the column, the English cover line steps aside
        } else if (over() && geo && canvas) {
          band();
        }
        if (!land) { // the scrim's fade never reaches up into the masthead
          var gap = top() - (mast.getBoundingClientRect().bottom - y0()) - 4;
          if (gap < fade()) st.setProperty('--jc-fade', Math.max(10, Math.round(gap)) + 'px');
        }
        busy = false;

        function band() {
          cl.add('is-band'); // short fade, opaque text panel
          var w = root.clientWidth, target = top() - fade() * 0.4 - 2;
          var m = mast.getBoundingClientRect(), crown = m.top - y0() + m.height * MAST_CROWN;
          var min = w / RATIO, cap = (target - crown) / (CHIN - CROWN);
          if (cap >= min) { // 1) a smaller photo, his crown still tucked under the masthead
            st.setProperty('--jc-cap', Math.floor(cap) + 'px');
            return;
          }
          // 2) not even the smallest photo fits under the full masthead: anchor it by her chin, and move a smaller
          //    masthead into the sky on her side (above her hair and left of his)
          cl.add('is-low');
          target = top() - fade() * 0.4 - 2;
          var hb = min, cw = hb * RATIO, t = target - hb * CHIN, l = (w - cw) * 0.52;
          st.setProperty('--jc-lh', Math.ceil(hb) + 'px');
          st.setProperty('--jc-lt', Math.round(t) + 'px');
          st.setProperty('--jc-ll', Math.round(l) + 'px');
          var g = Math.max(14, w * 0.045), mt = 12;
          var mw = Math.min(w * 0.46, l + cw * HIS_L - g - 8);
          if (mt + mw * MAST + 6 > t + hb * HER_TOP) mw = Math.min(mw, l + cw * HER_L - g - 8); // beside her face, not on it
          st.setProperty('--jc-lmw', Math.max(72, Math.floor(mw)) + 'px');
          st.setProperty('--jc-lmt', mt + 'px');
        }
      }
      fit.root = root;
      fits.push(fit);

      apply(opts.phase || phaseNow() || 'before');
      schedule();

      var raf = 0;
      function soon() { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); }
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(soon);
      window.addEventListener('resize', soon);
      if ('ResizeObserver' in window && story) {
        var last = 0;
        new ResizeObserver(function () {
          var h = story.offsetHeight;
          if (Math.abs(h - last) > 4) { last = h; soon(); }
        }).observe(story);
      }
      if ('MutationObserver' in window) { // v1's wedding-day bar: html.is-dday and --bar-h
        new MutationObserver(soon).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
      }
      document.addEventListener('visibilitychange', function () { // a page left in the background may have missed a boundary
        var p = !document.hidden && phaseNow();
        if (!p) return;
        if (p !== root.getAttribute('data-phase')) apply(p);
        schedule();
      });
    },
  };

  window.AICCCover = AICCCover;
})();
