/* AI-CC 2026 · v1-conf — page logic. Every fact comes from window.WEDDING; index.html carries the same facts as static
   text (first paint, no-JS), and the renderers below rebuild them from WEDDING so one data fix updates everything. */
(function () {
  'use strict';

  /** Every block below runs on its own: one that fails (a cover swapped in without the old cover's hooks, a shared file
   *  that did not load) is logged and skipped, and the rest of the page keeps working. */
  function safe(name, fn) {
    try { return fn(); } catch (e) { try { console.error('[v1-conf] ' + name + ':', e); } catch (x) { /* no console */ } return null; }
  }

  // ------------------------------------------------------------------ reveal on scroll (first: it needs nothing else)
  /* A frame-throttled position check instead of one observer per block: a fast fling (or a busy phone) can carry a
     block past the screen between two frames, and an observer would then never report it; here everything that is
     above the bottom of the screen is revealed, wherever it is. html.rv-on tells the CSS that this is running (without
     it, a CSS fallback fades every block in after a few seconds, so a failed script never leaves the page blank). */
  var Reveal = safe('reveal', function () {
    var pending = Array.prototype.slice.call(document.querySelectorAll('.reveal')), queued = false;
    var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    document.documentElement.classList.add('rv-on');
    // WebKit's scroll anchoring follows a block's 18 px rise and pulls the page back by it (a jump to 오시는 길 stopped
    // that far short): a block takes no part in anchoring until its rise is over (.is-still, style.css)
    function show(el) {
      if (el.classList.contains('is-in')) return;
      el.classList.add('is-in');
      setTimeout(function () { el.classList.add('is-still'); }, 900);
    }
    document.addEventListener('focusin', function (e) { // never leave a focused block faded
      var r = e.target && e.target.closest && e.target.closest('.reveal');
      if (r) show(r);
    });
    if (reduce || !window.requestAnimationFrame) { pending.forEach(show); return { check: function () {} }; }
    function check() {
      queued = false;
      var line = (window.innerHeight || document.documentElement.clientHeight || 700) * 0.94;
      pending = pending.filter(function (el) {
        if (el.getBoundingClientRect().top < line) { show(el); return false; }
        return true;
      });
      if (!pending.length) { window.removeEventListener('scroll', soon); window.removeEventListener('resize', soon); }
    }
    function soon() { if (!queued) { queued = true; requestAnimationFrame(check); } }
    window.addEventListener('scroll', soon, { passive: true });
    window.addEventListener('resize', soon);
    window.addEventListener('load', soon);
    check();
    return { check: soon };
  });

  var W = window.WEDDING, K = window.Kit, API = window.WeddingAPI;
  if (API) API.version = 'v1-conf';

  var WD_KO = ['일', '월', '화', '수', '목', '금', '토'];
  var WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  var MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  var mobileOS = !!(K && K.ua && (K.ua.ios || K.ua.android));
  var LOCALHOST = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname);
  var NB = '\u00a0';
  var NS = 'aicc-v1conf:';
  var root = document.documentElement;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function get(o, path) { return path.split('.').reduce(function (v, k) { return v == null ? v : v[k]; }, o); }
  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  /** Set text, keeping pairs joined by a middle dot on one line: a line never ends at "신랑·" with "신부가" below. */
  var PAIRS = /(신랑·신부|길 폭·속도)/;
  function textInto(el, s) {
    el.textContent = '';
    String(s).split(PAIRS).forEach(function (part, i) {
      if (part) el.appendChild(i % 2 ? h('span', 'nb', part) : document.createTextNode(part));
    });
    return el;
  }
  function store(k, v) { try { if (v == null || v === '') localStorage.removeItem(NS + k); else localStorage.setItem(NS + k, v); } catch (e) { /* private mode */ } }
  function recall(k) { try { return localStorage.getItem(NS + k) || ''; } catch (e) { return ''; } }
  function koTime(hh, mi) {
    var ap = hh < 12 ? '오전' : '오후', h12 = hh % 12 === 0 ? 12 : hh % 12;
    return ap + ' ' + h12 + '시' + (mi ? ' ' + mi + '분' : '');
  }
  function lazyImg(img) {
    img.addEventListener('load', function () { img.classList.add('is-loaded'); });
    if (img.complete && img.naturalWidth) img.classList.add('is-loaded');
    return img;
  }

  /* Where we are relative to the wedding (Korea time), decided once per page load:
     'before' · 'morning' (the wedding day from 06:00 until the ceremony: day bar + 오시는 길 first) · 'evening' (the
     ceremony, 18:00 until 20:00; there is no separate reception: still the day bar and 오시는 길 first for late guests; RSVP
     closes at 18:00, the game ranking already at the end of 12/18) · 'after' (from 20:00: the thank-you state). The cover flips on the same clock
     (BOUNDS). */
  var START = new Date(W.date.iso).getTime(), EVENING_MS = 2 * 3600000;
  var MORNING = START - ((W.date.hour - 6) * 60 + W.date.minute) * 60000; // 06:00 KST on the wedding day
  var BOUNDS = [MORNING, START, START + EVENING_MS]; // where 'morning', 'evening' and 'after' begin
  function phaseAt(t) { return t >= BOUNDS[2] ? 'after' : t >= BOUNDS[1] ? 'evening' : t >= BOUNDS[0] ? 'morning' : 'before'; }
  var PHASE = phaseAt(Date.now());
  var STARTED = PHASE === 'evening' || PHASE === 'after'; // registration closed

  // ------------------------------------------------------------------ real QR code of the invitation (siteUrl)
  // Generated once (segno 1.6.1, version 3, EC level Q) for the URL below and verified module by module.
  // If WEDDING_CONFIG.siteUrl ever changes, the QR is hidden instead of pointing somewhere stale.
  var QR = {
    url: 'https://ai-cc-wedding.github.io/', n: 29,
    d: 'M0 0h7v1h-7zM8 0h1v1h-1zM10 0h1v1h-1zM14 0h1v1h-1zM16 0h5v1h-5zM22 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM11 1h2v1h-2zM16 1h1v1h-1zM20 1h1v1h-1zM22 1h1v1h-1zM28 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM9 2h1v1h-1zM11 2h2v1h-2zM14 2h2v1h-2zM20 2h1v1h-1zM22 2h1v1h-1zM24 2h3v1h-3zM28 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM9 3h1v1h-1zM12 3h6v1h-6zM22 3h1v1h-1zM24 3h3v1h-3zM28 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM8 4h1v1h-1zM11 4h3v1h-3zM16 4h1v1h-1zM18 4h2v1h-2zM22 4h1v1h-1zM24 4h3v1h-3zM28 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM8 5h3v1h-3zM12 5h3v1h-3zM17 5h2v1h-2zM20 5h1v1h-1zM22 5h1v1h-1zM28 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM22 6h7v1h-7zM11 7h4v1h-4zM16 7h1v1h-1zM18 7h1v1h-1zM1 8h7v1h-7zM9 8h1v1h-1zM13 8h2v1h-2zM16 8h5v1h-5zM23 8h2v1h-2zM28 8h1v1h-1zM0 9h3v1h-3zM4 9h1v1h-1zM8 9h2v1h-2zM12 9h1v1h-1zM16 9h1v1h-1zM18 9h8v1h-8zM28 9h1v1h-1zM0 10h2v1h-2zM6 10h3v1h-3zM13 10h3v1h-3zM17 10h2v1h-2zM21 10h2v1h-2zM3 11h3v1h-3zM10 11h1v1h-1zM14 11h1v1h-1zM16 11h1v1h-1zM21 11h3v1h-3zM25 11h1v1h-1zM27 11h1v1h-1zM2 12h1v1h-1zM5 12h2v1h-2zM8 12h1v1h-1zM10 12h4v1h-4zM17 12h1v1h-1zM19 12h1v1h-1zM21 12h1v1h-1zM23 12h1v1h-1zM26 12h3v1h-3zM3 13h1v1h-1zM8 13h1v1h-1zM12 13h1v1h-1zM14 13h2v1h-2zM17 13h6v1h-6zM24 13h2v1h-2zM27 13h2v1h-2zM1 14h1v1h-1zM4 14h7v1h-7zM13 14h5v1h-5zM20 14h1v1h-1zM23 14h1v1h-1zM2 15h2v1h-2zM5 15h1v1h-1zM8 15h1v1h-1zM11 15h2v1h-2zM15 15h1v1h-1zM18 15h1v1h-1zM22 15h1v1h-1zM24 15h2v1h-2zM27 15h1v1h-1zM0 16h1v1h-1zM2 16h1v1h-1zM4 16h1v1h-1zM6 16h1v1h-1zM9 16h3v1h-3zM14 16h1v1h-1zM17 16h1v1h-1zM25 16h2v1h-2zM0 17h2v1h-2zM5 17h1v1h-1zM10 17h3v1h-3zM15 17h1v1h-1zM18 17h5v1h-5zM24 17h1v1h-1zM26 17h3v1h-3zM0 18h1v1h-1zM3 18h1v1h-1zM5 18h3v1h-3zM13 18h6v1h-6zM22 18h2v1h-2zM25 18h1v1h-1zM0 19h1v1h-1zM2 19h4v1h-4zM7 19h1v1h-1zM9 19h1v1h-1zM11 19h2v1h-2zM16 19h1v1h-1zM20 19h1v1h-1zM22 19h4v1h-4zM27 19h1v1h-1zM0 20h1v1h-1zM3 20h1v1h-1zM6 20h1v1h-1zM8 20h1v1h-1zM11 20h4v1h-4zM17 20h2v1h-2zM20 20h5v1h-5zM26 20h2v1h-2zM8 21h1v1h-1zM12 21h3v1h-3zM16 21h3v1h-3zM20 21h1v1h-1zM24 21h2v1h-2zM27 21h2v1h-2zM0 22h7v1h-7zM8 22h2v1h-2zM11 22h2v1h-2zM15 22h2v1h-2zM18 22h3v1h-3zM22 22h1v1h-1zM24 22h1v1h-1zM0 23h1v1h-1zM6 23h1v1h-1zM8 23h1v1h-1zM10 23h2v1h-2zM13 23h2v1h-2zM16 23h1v1h-1zM19 23h2v1h-2zM24 23h2v1h-2zM0 24h1v1h-1zM2 24h3v1h-3zM6 24h1v1h-1zM8 24h5v1h-5zM14 24h2v1h-2zM17 24h1v1h-1zM20 24h7v1h-7zM0 25h1v1h-1zM2 25h3v1h-3zM6 25h1v1h-1zM8 25h1v1h-1zM10 25h1v1h-1zM12 25h1v1h-1zM14 25h1v1h-1zM17 25h5v1h-5zM23 25h1v1h-1zM25 25h4v1h-4zM0 26h1v1h-1zM2 26h3v1h-3zM6 26h1v1h-1zM8 26h3v1h-3zM12 26h2v1h-2zM15 26h2v1h-2zM19 26h6v1h-6zM26 26h2v1h-2zM0 27h1v1h-1zM6 27h1v1h-1zM8 27h6v1h-6zM16 27h1v1h-1zM19 27h4v1h-4zM24 27h2v1h-2zM27 27h1v1h-1zM0 28h7v1h-7zM9 28h5v1h-5zM16 28h2v1h-2zM19 28h1v1h-1zM24 28h1v1h-1zM26 28h1v1h-1z',
  };
  function qrSvg(border) {
    var site = (window.WEDDING_CONFIG && WEDDING_CONFIG.siteUrl) || '';
    if (site !== QR.url) return '';
    var b = border == null ? 2 : border, s = QR.n + 2 * b;
    return '<svg viewBox="' + -b + ' ' + -b + ' ' + s + ' ' + s + '" shape-rendering="crispEdges" role="img" aria-label="청첩장 주소 QR 코드">' +
      '<rect x="' + -b + '" y="' + -b + '" width="' + s + '" height="' + s + '" fill="#fff"/><path d="' + QR.d + '" style="fill: var(--ink)"/></svg>';
  }

  // ------------------------------------------------------------------ history.scrollRestoration: one owner for every layer
  /* The mode belongs to each history entry, and four layers push entries of their own (the ☰ sheet, the photo viewer
     and the RSVP edit here, the game in svm-game.js, developer mode in devmode.js). While any of them is open it stays
     'manual' (our own scroll restore runs on close; the browser's would fight it); a moment after the last one has
     closed, the page's entry gets 'auto' back, so a guest returning from a map app lands where they were. Layers only
     hold and release: one that saved the mode and put it back later could catch another layer's 'manual' in a
     hand-over (the sheet closing as developer mode opens) or write it onto the wrong entry, leaving the page manual.
     A guest can also leave with a layer open (a map link, a reload, a tab the phone discards); that entry must not
     come back 'manual' either. So the mode is 'auto' on load (nothing is open then) and whenever the page is hidden or
     left, and 'manual' again when the page shows once more (back-forward cache) with a layer still open. */
  var Restore = (function () {
    var held = {}, timer = 0, due = 0;
    function set(v) { try { if ('scrollRestoration' in history && history.scrollRestoration !== v) history.scrollRestoration = v; } catch (e) { /* noop */ } }
    function idle() { for (var k in held) if (held[k]) return false; return true; }
    function again() { if (!idle()) set('manual'); }
    set('auto');
    window.addEventListener('pagehide', function () { set('auto'); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) again(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) set('auto'); else again(); });
    return {
      /** Every layer holds just before it pushes its entry (pushState copies the mode), so Back hears of each push. The
       *  number returned is the new entry's place among the layers' entries (see Back). */
      hold: function (who) { held[who] = true; clearTimeout(timer); due = 0; set('manual'); return Back ? Back.pushed() : 0; },
      /** Call once the layer's step back is under way; 'auto' follows after `wait` ms unless a layer is open again. */
      release: function (who, wait) {
        held[who] = false;
        due = Math.max(due, Date.now() + (wait || 80));
        clearTimeout(timer);
        timer = setTimeout(function () { due = 0; if (idle()) set('auto'); }, Math.max(0, due - Date.now()));
      },
    };
  })();

  // ------------------------------------------------------------------ Android back / iOS swipe-back closes overlays
  /* Each layer (the ☰ sheet, the photo viewer, the RSVP edit) owns one history entry {aicc: name}; the game's is
     {aiccGame: 1}, developer mode's {aiccDev: 1}. Each push also gets a rising number from Restore.hold, kept here (the
     game and developer mode keep theirs and tell `own` which entry is their open one), so wherever Back lands, every
     layer pushed after that entry closes, newest first: a photo opened during the RSVP edit closes before the edit, and
     Back from a photo opened in developer mode leaves an edit opened before developer mode alone.
     The entry itself carries that number and this page load's token ({aicc: name, n, k}, see `entry`): an entry is a
     layer's only while that layer is open with that very number, so an older entry of the same name (the edit closed
     under developer mode's entry and opened again, or one an earlier load pushed before a reload) is never taken for it.
     Every Back press must change something, so two kinds of entry are stepped over, silently (the entry below is
     'manual': the layer held it before pushing):
     - an entry no open layer owns: one left under another layer's entry (the RSVP edit answered from developer mode,
       developer mode closed while the edit was open), or one that Forward reached once its layer had closed. Back and
       Forward look alike there, so nothing closes until the step lands on an open layer's entry or the page's own
       (Forward then closes nothing, and unsent changes in the edit stay);
     - the page loaded into a layer's entry (a reload or a discarded tab with a layer open, or back from a map app
       without the back-forward cache): it is a copy of the page, so Back from it goes on until the guest has left. */
  var Back = (function () {
    var stack = [], owners = [], seq = 0, at = 0, steps = 0, waiting = [], stepTimer = 0, onCopy = false, leaving = false;
    var LOAD = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); // this page load's token
    function state() { try { return history.state || {}; } catch (e) { return {}; } }
    function entry(o, n) { o.n = n; o.k = LOAD; return o; }
    function find(name) { for (var i = 0; i < stack.length; i++) if (stack[i].name === name) return i; return -1; }
    /** The number of the entry landed on: 0 for the page's own (or its copy), -1 when no open layer owns it. */
    function where(s) {
      if (!s.aicc && !s.aiccGame && !s.aiccDev) return 0;
      if (s.k !== LOAD) return -1; // pushed before a reload: nothing of this load owns it
      if (s.aicc) { var i = find(s.aicc); return i >= 0 && stack[i].n === s.n ? s.n : -1; }
      for (var j = 0; j < owners.length; j++) { try { var n = owners[j](s); if (n > 0) return n; } catch (e) { /* noop */ } }
      return -1;
    }
    var s0 = state();
    if (s0.aicc || s0.aiccDev || s0.aiccGame || s0.aiccCopy) {
      try { history.replaceState({ aiccCopy: LOAD }, ''); onCopy = true; } catch (e) { /* noop */ }
    }
    function settle() { if (steps) return; var w = waiting; waiting = []; w.forEach(function (f) { try { f(); } catch (e) { /* noop */ } }); }
    function step() {
      steps++;
      try { history.back(); } catch (e) { /* noop */ }
      clearTimeout(stepTimer);
      stepTimer = setTimeout(function () { // no popstate: nothing below (an in-app browser's first page)
        steps = 0;
        if (!stack.length) Restore.release('back');
        settle();
      }, 600);
    }
    window.addEventListener('popstate', function () {
      var s = state(), copy = s.aiccCopy === LOAD;
      if (steps && !--steps) clearTimeout(stepTimer);
      if (onCopy && !copy) leaving = true; // Back (or Forward, which steps back onto the copy again) off the copy
      onCopy = copy;
      at = (leaving && !copy) || (s.aiccCopy && !copy) ? -1 : where(s);
      if (at < 0) return step();
      leaving = false;
      // every layer pushed after the entry we landed on closes (a close() below has already taken its own layer off the
      // stack); the game and developer mode close theirs by the same rule in their own listeners (at())
      while (stack.length && stack[stack.length - 1].n > at) {
        var c = stack.pop();
        try { c.onBack(); } catch (e) { /* noop */ }
      }
      if (!stack.length) Restore.release('back');
      if (waiting.length) setTimeout(settle, 0); // after the other listeners (the game's would take a fresh entry as Back)
    });
    return {
      /** Restore.hold calls this just before an entry (ours, the game's or developer mode's) goes on top: its number. */
      pushed: function () { onCopy = false; leaving = false; return ++seq; },
      /** The state to push for a layer's entry: its own key, its number from Restore.hold and this load's token. */
      entry: entry,
      /** The game and developer mode: fn(state) returns their open entry's number when the state is that entry's (the
       *  same number), else 0. A state another load pushed never reaches fn. */
      own: function (fn) { owners.push(fn); },
      /** For the other popstate listeners: the number of the entry landed on, or -1 while a step goes on past it. */
      at: function () { return at; },
      /** Run fn once a silent step under way has landed (developer mode starts the game after its own step back; the
       *  game's entry pushed mid-step would be the one that step takes). */
      settled: function (fn) { if (steps) waiting.push(fn); else fn(); },
      open: function (name, onBack) {
        if (find(name) >= 0) return;
        try {
          var n = Restore.hold('back'); // before the push, so the page's own entry is manual too
          history.pushState(entry({ aicc: name }, n), '');
          stack.push({ name: name, n: n, onBack: onBack });
        } catch (e) { if (!stack.length) Restore.release('back'); }
      },
      /** Returns true when it stepped back through history (the caller may wait for that popstate). Under another
       *  script's entry (developer mode's) the layer's own entry stays behind, and popstate steps over it later; so it
       *  does with `stay`, when another entry goes on top right after (a step back would race that push). */
      close: function (name, stay) {
        var i = find(name);
        if (i < 0) return false;
        var n = stack.splice(i, 1)[0].n, s = state();
        if (!stay && s.aicc === name && s.n === n && s.k === LOAD) { try { history.back(); return true; } catch (e) { /* noop */ } }
        if (!stack.length) Restore.release('back');
        return false;
      },
    };
  })();

  // ------------------------------------------------------------------ toast
  var toastTimer = 0;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 2400);
  }

  // ------------------------------------------------------------------ scroll lock (lightbox / game)
  var lockY = 0, locks = 0;
  function lockScroll() {
    if (locks++) return;
    lockY = window.scrollY || window.pageYOffset || 0;
    var b = document.body.style;
    b.position = 'fixed'; b.top = -lockY + 'px'; b.left = '0'; b.right = '0'; b.width = '100%';
    document.documentElement.style.overflow = 'hidden';
  }
  function unlockScroll() {
    if (!locks || --locks) return;
    var b = document.body.style, html = document.documentElement.style;
    b.position = ''; b.top = ''; b.left = ''; b.right = ''; b.width = '';
    html.overflow = '';
    var prev = html.scrollBehavior;
    html.scrollBehavior = 'auto';
    window.scrollTo(0, lockY);
    html.scrollBehavior = prev;
  }
  // A reload (or a page the back-forward cache will not keep) with the photo viewer or the game open: the page is
  // pinned at top 0, so the place saved with the entry would be the cover. Let go first; a cached page stays as it is.
  window.addEventListener('pagehide', function (e) { if (locks && !e.persisted) { locks = 1; unlockScroll(); } });

  /** Scroll by dy at once (never smoothly), unless it is a rounding error. */
  function nudge(dy) {
    if (Math.abs(dy) <= 1) return;
    var st = document.documentElement.style, prev = st.scrollBehavior;
    st.scrollBehavior = 'auto';
    window.scrollBy(0, dy);
    st.scrollBehavior = prev;
  }
  /** Run fn, a change of layout around the guest's place, then put back the block being read (the one across a quarter
   *  of the way down the screen). At 20:00 the day bar goes and the cover grows by as much, yet WebKit's scroll anchoring
   *  moved the page 30–48 px; a block below the change moves only by what really moved.
   *  below: the first block after a change inside a section. Only a guest reading at or past it is put back, measured on
   *  it (a section around the change would also count what the browser's own scroll anchoring already made good). */
  function keepPlace(fn, below) {
    var ref = null, y0 = 0, line = (window.innerHeight || 700) / 4;
    if (below) {
      var b = below.getBoundingClientRect();
      if (b.top < line) { ref = below; y0 = b.top; }
    } else {
      $$('#main > *, #closing').some(function (el) {
        var r = el.getBoundingClientRect();
        if (r.height && r.bottom > line) { ref = el; y0 = r.top; }
        return !!ref;
      });
    }
    fn();
    if (ref) nudge(ref.getBoundingClientRect().top - y0);
  }

  // ------------------------------------------------------------------ data bindings
  var derived = {
    dec19: MONTHS[W.date.month - 1] + NB + W.date.day, // the poster's kicker never leaves "19" alone
    venueHall: W.venue.name + (W.venue.hall ? ' ' + W.venue.hall : ''),
  };
  /** Keep short phrases together so Korean lines break in sensible places on narrow screens. */
  function glue(k, v) {
    if (k === 'date.ko') { // "… 토요일 오후 6시": never strand "6시" alone
      var t = String(v).split(' ');
      return t.length > 2 ? t.slice(0, -2).join(' ') + ' ' + t.slice(-2).join(NB) : v;
    }
    if (k === 'venueHall') { // "더그랜드롯데 서울 · 3층 사파이어볼룸" breaks only between the name and the hall
      return W.venue.name.replace(/ /g, NB) + (W.venue.hall ? ' ' + W.venue.hall.replace(/ /g, NB) : '');
    }
    if (k === 'venue.formerName') return String(v).replace(/ /g, NB);
    if (k === 'contest.reviewPrize') return String(v).replace(/Best Reviewer/g, 'Best' + NB + 'Reviewer');
    return v;
  }
  safe('bindings', function () {
    $$('[data-w]').forEach(function (el) {
      var k = el.getAttribute('data-w');
      var v = derived.hasOwnProperty(k) ? derived[k] : get(W, k);
      if (v != null) textInto(el, glue(k, v));
      if (v === '') el.hidden = true; // e.g. no hall name
    });
  });
  var VENUE_HALL = glue('venueHall', derived.venueHall);
  var ADDRESS = W.venue.addressJibun || W.venue.address; // the couple's choice: the 지번 address is THE address
  /** Address text with its last two words kept together ("소공동 1" never leaves the "1" alone); real spaces stay. */
  function addressInto(el, text) {
    var m = String(text).match(/^(.*\S)\s+(\S+\s+\S+)$/);
    el.textContent = '';
    if (!m) { el.textContent = text; return el; }
    el.appendChild(document.createTextNode(m[1] + ' '));
    el.appendChild(h('span', 'nb', m[2]));
    return el;
  }
  // ------------------------------------------------------------------ cover (nurture, the journal cover: js/cover.js)
  // The cover keeps its own words for each phase (Out today, Now in session, Published …) but flips on this page's
  // clock, so it always agrees with the day bar and the sections below. Without cover.js the static cover reads in full.
  // A page loaded after 20:00 opens on the thank-you row, so the cue says so (one left open across 20:00 has no such row).
  safe('cover', function () {
    var top = $('#top');
    if (top && window.AICCCover) AICCCover.init(top, { bounds: BOUNDS, afterCue: PHASE === 'after' ? '감사 인사 보기' : '' });
  });

  /* Photos the cover already shows (whatever cover is in place: its <img> src/srcset or inline backgrounds), so the
     gallery, the closing photo and the desktop poster never repeat them. */
  var COVER_IDS = safe('coverIds', function () {
    var ids = {}, top = $('#top'), re = /photos\/([a-z]\d{1,2})-(?:sm|md|lg)\.(?:jpe?g|webp|avif|png)/g, m;
    if (!top) return ids;
    $$('img, source, [style]', top).forEach(function (el) {
      var s = [el.getAttribute('src'), el.getAttribute('srcset'), el.getAttribute('style')].join(' ');
      re.lastIndex = 0;
      while ((m = re.exec(s))) ids[m[1]] = true;
    });
    return ids;
  }) || {};
  // The closing photo is h17, the moment the 초대의 글 drawing was traced from; if the cover took it, h00 (waving goodbye).
  var CLOSING_ID = COVER_IDS.h17 ? 'h00' : 'h17';
  // The desktop poster shows h01, revision 1's golden-hour cover (h16 if a cover takes h01). It is on screen from 1100 px
  // (the same query as the CSS), and while it is, the gallery leaves that photo out.
  var POSTER_ID = COVER_IDS.h01 ? 'h16' : 'h01';
  var POSTER_MQ = window.matchMedia ? matchMedia('(min-width: 1100px)') : null;
  function posterOn() { return !!(POSTER_MQ && POSTER_MQ.matches); }
  /** fn runs whenever the poster comes or goes (a window resized across 1100 px, a tablet turned). */
  function onPoster(fn) {
    if (POSTER_MQ && POSTER_MQ.addEventListener) POSTER_MQ.addEventListener('change', fn);
    else if (POSTER_MQ && POSTER_MQ.addListener) POSTER_MQ.addListener(fn);
  }

  // ------------------------------------------------------------------ desktop poster (photo + "open on your phone" QR)
  safe('poster', function () {
    var built = false;
    function build() {
      if (built || !posterOn()) return;
      built = true;
      var img = K.img(POSTER_ID, { sizes: '320px', alt: '' }), e = K.photoInfo(POSTER_ID);
      if (e) img.srcset = ['sm', 'md'].map(function (k) { return K.root + e.src[k].url + ' ' + e.src[k].w + 'w'; }).join(', '); // 853px is plenty for 320px
      $('#posterPhoto').appendChild(img);
      var svg = qrSvg(3);
      if (svg) { $('#posterQrCode').innerHTML = svg; $('#posterQr').hidden = false; }
    }
    build();
    onPoster(build);
  });

  // ------------------------------------------------------------------ 01 greeting (the couple's own words), chairs, speakers
  /* Each line of the greeting stays exactly as the couple wrote it. A line that is too wide for the screen (narrow
     phones, large system text) breaks once, at a natural phrase boundary near its middle: the two halves are
     inline-blocks, so nothing is ever stranded alone ("만나", "합니다.") and no browser needs text-wrap: balance. */
  var CONNECT = /(며|고|서|면|어|여|니|게|도록|지만)[.,!?]?$/;
  var PARTICLE = /(에게|으로|로|을|를|은|는|이|가|의|과|와|도|에)[.,!?]?$/;
  function textWidth(s) {
    var w = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      w += c >= 0xAC00 && c <= 0xD7A3 ? 1 : c === 32 ? 0.3 : c >= 65 && c <= 90 ? 0.68 : 0.55;
    }
    return w;
  }
  function halves(line) {
    var words = String(line).split(' ');
    if (words.length < 2) return [line];
    var total = textWidth(line), best = null;
    for (var i = 1; i < words.length; i++) {
      var a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
      var end = words[i - 1];
      var score = Math.abs(textWidth(a) - textWidth(b)) / total + (CONNECT.test(end) ? 0 : PARTICLE.test(end) ? 0.25 : 0.35);
      if (!best || score < best.s) best = { s: score, a: a, b: b };
    }
    return [best.a, best.b];
  }
  safe('greeting', function () {
    var box = $('#greeting'), lines = Array.isArray(W.greeting) ? W.greeting : [], p = null;
    if (lines.length) { // otherwise keep the static text
      box.textContent = '';
      lines.forEach(function (line) {
        if (!line) { p = null; return; } // '' = paragraph break
        if (!p) { p = h('p'); box.appendChild(p); }
        var span = h('span', 'gline');
        halves(line).forEach(function (part, i) {
          if (i) span.appendChild(document.createTextNode(' '));
          span.appendChild(h('span', 'gh', part));
        });
        p.appendChild(span);
      });
    }

    function chair(el, who) {
      el.textContent = '';
      el.appendChild(h('span', 'parents', who.father + ' · ' + who.mother));
      el.appendChild(h('span', 'rel', '의 ' + who.order));
      el.appendChild(document.createTextNode(' '));
      el.appendChild(h('strong', '', who.first));
    }
    chair($('#chairGroom'), W.groom);
    chair($('#chairBride'), W.bride);

    $('#spkGroom').href = W.groom.homepage;
    $('#spkGroom').setAttribute('aria-label', '신랑 ' + W.groom.name + ' 홈페이지 (새 창)');
    $('#spkBride').href = W.bride.homepage;
    $('#spkBride').setAttribute('aria-label', '신부 ' + W.bride.name + ' 홈페이지 (새 창)');
  });

  // ------------------------------------------------------------------ 02 date card (calendar, D-day, countdown) + Important Dates
  safe('dates', function () {
    var D = W.date, wd = new Date(Date.UTC(D.year, D.month - 1, D.day)).getUTCDay();

    // "2026년 12월 19일" / "토요일 오후 6시"
    var big = $('#whenDate'), m = String(D.ko).match(/^(.*?일)\s+(.+)$/);
    big.textContent = '';
    big.appendChild(h('span', '', (m ? m[1] : D.ko).replace(/ (\d+일)$/, NB + '$1'))); // "12월 19일" stays together at large text
    if (m) { big.appendChild(document.createTextNode(' ')); big.appendChild(h('span', '', m[2].replace(/(오[전후]) /, '$1' + NB))); }
    $('#whenEn').textContent = D.year + '-' + pad(D.month) + '-' + pad(D.day) + NB + WD_EN[wd] + ' · ' + pad(D.hour) + ':' + pad(D.minute) + NB + 'KST';

    // month calendar, the 19th marked
    var cal = $('#calendar');
    cal.textContent = '';
    var title = h('p', 'cal__title');
    title.appendChild(h('b', '', D.year + '년 ' + D.month + '월'));
    var en = h('span', '', MONTHS_EN[D.month - 1]); en.lang = 'en';
    title.appendChild(en);
    cal.appendChild(title);
    var table = h('table');
    table.setAttribute('aria-label', D.year + '년 ' + D.month + '월 달력, ' + D.day + '일 예식');
    var thead = h('thead'), trh = h('tr');
    WD_KO.forEach(function (n, i) { var th = h('th', i === 0 ? 'sun' : i === 6 ? 'sat' : '', n); th.scope = 'col'; trh.appendChild(th); });
    thead.appendChild(trh); table.appendChild(thead);
    var tb = h('tbody');
    K.calendarMonth().forEach(function (week) {
      var tr = h('tr');
      week.forEach(function (day, i) {
        var td = h('td');
        if (day) {
          var cls = [];
          if (i === 0) cls.push('sun');
          if (i === 6) cls.push('sat');
          if (D.month === 12 && day === 25) cls.push('hol');
          if (day === D.day) cls.push('is-day');
          if (cls.length) td.className = cls.join(' ');
          td.appendChild(h('span', '', String(day)));
          if (day === D.day) td.appendChild(h('b', 'vh', '예식일')); // read "19 예식일" (aria-current="date" would say today)
        }
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    cal.appendChild(table);

    // The live countdown (the exact time to the ceremony) is the card's only count: no D-day badge, no caption. A line of
    // words joins it on the last two days, and replaces it from the ceremony on. Screen readers get one plain sentence
    // (#cdD) instead of the ticking boxes; the desktop index keeps its short D-label.
    var sr = $('#cdD'), say = $('#cdKo'), units = $('#cdUnits'), calsave = $('.calsave'), idates = $('#idates');
    var cdDays = $('#cdDays'), cdHours = $('#cdHours'), cdMins = $('#cdMins'), cdSecs = $('#cdSecs');
    var progLabel = $('[data-dday-label]'), progKo = $('[data-dday-ko]');
    var shown = '';
    function tick() {
      var d = K.dday(), now = Date.now(), words;
      if (!d.passed) {
        cdDays.textContent = d.d; cdHours.textContent = pad(d.h); cdMins.textContent = pad(d.m); cdSecs.textContent = pad(d.s);
        words = d.days > 1 ? '' : d.days === 1 ? '내일이 바로 결혼식입니다 ♥' : '오늘 ' + koTime(D.hour, D.minute) + ', 기다리고 있을게요!';
      } else if (now < START + EVENING_MS) {
        words = '지금 예식이 진행되고 있어요 ♥';
      } else {
        words = d.days === 0 ? '오늘, 두 사람이 부부가 되었습니다 ♥' : '함께 축하해 주셔서 감사합니다';
      }
      // the two largest units, zeros left out; under a minute there is nothing left to count
      var span = d.d ? d.d + '일' + (d.h ? ' ' + d.h + '시간' : '') : d.h ? d.h + '시간' + (d.m ? ' ' + d.m + '분' : '') : d.m ? d.m + '분' : '';
      var left = d.passed ? '' : span ? '결혼식까지 ' + span + ' 남았어요' : '곧 결혼식이 시작돼요';
      var key = d.label + words + left;
      if (key === shown) return;
      var open = !!shown; // a page left open, not the first paint
      shown = key;
      sr.textContent = left;
      function layout() {
        say.textContent = words;
        say.hidden = !words;
        units.hidden = d.passed;
        if (calsave) calsave.hidden = d.passed; // nothing left to save to a calendar once the ceremony has begun
        units.classList.toggle('is-today', !d.passed && d.d === 0); // no empty 0일 box on the day
      }
      // on a page left open, blocks come or go (midnight before the day, 18:00): a guest reading below keeps their place
      if (open && (units.hidden !== d.passed || say.hidden !== !words)) keepPlace(layout, idates); else layout();
      if (progLabel) progLabel.textContent = d.label;
      if (progKo) progKo.textContent = !d.passed ? (d.days > 0 ? '' : '오늘 결혼합니다') : now < START + EVENING_MS ? '지금 예식 중' : '감사합니다';
    }
    tick();
    setInterval(tick, 1000);

    var g = $('#calGoogle'); g.href = K.calendar.google(); g.setAttribute('aria-label', 'Google 캘린더에 일정 추가 (새 창)');
    var ics = $('#calIcs'); ics.href = K.calendar.ics; ics.setAttribute('aria-label', '휴대폰 캘린더에 일정 추가');

    // Important Dates: short, plain dates (no AoE conversion), awards on the day
    var dl = String(W.rsvp.deadline).split('-').map(Number);
    var dlWd = new Date(Date.UTC(dl[0], dl[1] - 1, dl[2])).getUTCDay();
    var rows = [
      { when: dl[1] + '월 ' + dl[2] + '일(' + WD_KO[dlWd] + ')까지', what: '참석 회신 마감', en: 'Registration' },
      { when: D.month + '월 ' + D.day + '일(' + WD_KO[wd] + ') ' + koTime(D.hour, D.minute).replace(' ', NB), what: '본식', en: 'Main Conference', main: true },
      // the dot stays with the word before it (a line never starts with "·"), and this row fills its first line
      // (.idate--awards): the parenthesis breaks only when it cannot fit
      { when: '예식 당일', what: '시상 (' + ['Best Reviewer', '미니 게임 1위'].map(function (s) { return s.replace(/ /g, NB); }).join(NB + '· ') + ')', en: 'Closing Ceremony', awards: true },
    ];
    var ol = $('#idates');
    ol.textContent = '';
    rows.forEach(function (r) {
      var li = h('li', 'idate' + (r.main ? ' idate--main' : '') + (r.awards ? ' idate--awards' : ''));
      var w = h('p', 'idate__when', r.when);
      if (r.main) w.appendChild(h('span', 'idate__tag', 'Main'));
      var a = h('p', 'idate__what', r.what);
      var e2 = h('span', 'en', r.en); e2.lang = 'en';
      a.appendChild(e2);
      li.appendChild(w); li.appendChild(a);
      ol.appendChild(li);
    });
  });

  // ------------------------------------------------------------------ 03 venue
  /** Directions keep their short phrases whole on narrow screens: "도보 약 7~10분", "지하 통로로". */
  function bindPhrases(s) {
    return String(s).replace(/도보 약 (\S+)/g, '도보' + NB + '약' + NB + '$1').replace(/약 (?=\d)/g, '약' + NB)
      .replace(/지하 통로/g, '지하' + NB + '통로');
  }
  safe('venue', function () {
    var V = W.venue;
    addressInto($('#addrMain'), ADDRESS);
    var road = V.addressRoad || (V.addressJibun ? V.address : '');
    if (road && road !== ADDRESS) $('#addrRoadText').textContent = road; else $('#addrRoad').hidden = true;
    var tel = $('#venueTel');
    tel.href = 'tel:' + String(V.tel).replace(/[^\d+]/g, '');
    tel.setAttribute('aria-label', '호텔에 전화하기 (대표번호 ' + V.tel + ')'); // no particle after the number (로/으로 depends on how it is read)

    $('#copyAddr').addEventListener('click', function () {
      K.copy(ADDRESS).then(function (ok) { toast(ok ? '📍 주소가 복사되었습니다' : '복사에 실패했어요. 주소를 길게 눌러 복사해 주세요.'); });
    });

    // map app buttons (TMAP only on phones)
    var L = W.mapLinks, box = $('#mapLinks');
    box.textContent = '';
    function link(cls, mark, label, href) {
      var a = h('a', 'maplink maplink--' + cls);
      a.href = href;
      if (!mobileOS) { a.target = '_blank'; a.rel = 'noopener'; }
      var i = h('i', '', mark); i.setAttribute('aria-hidden', 'true');
      a.appendChild(i); a.appendChild(document.createTextNode(label));
      box.appendChild(a);
      return a;
    }
    link('naver', 'N', '네이버 지도', mobileOS && L.naverMobile || L.naver); // phones: the place page, never an app-install wall
    link('kakao', 'K', '카카오맵', L.kakao);
    if (mobileOS) {
      var t = h('button', 'maplink maplink--tmap');
      t.type = 'button';
      var ti = h('i', '', 'T'); ti.setAttribute('aria-hidden', 'true');
      t.appendChild(ti); t.appendChild(document.createTextNode('티맵'));
      t.addEventListener('click', function () { if (K.openTmap && !K.openTmap()) toast('티맵은 휴대폰에서 열 수 있어요'); });
      box.appendChild(t);
    }
    link('google', 'G', 'Google 지도', L.google);
    box.classList.toggle('maplinks--3', box.children.length === 3);

    // directions: one list; subway stays open, the rest folds away (CSS keeps everything open without JS)
    var routes = $('#routes'), Dn = W.directions;
    var ICONS = {
      subway: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="14" rx="3.5"/><path d="M5 11h14M8.5 14h.01M15.5 14h.01M8 21l2-4M16 21l-2-4"/></svg>',
      train: '<svg viewBox="0 0 24 24"><path d="M4 15.5V9a5 5 0 0 1 5-5h9.5L20 9.5v6a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 15.5Z"/><path d="M4 11h16M8 20l1.5-3M16 20l-1.5-3M13 4v7"/></svg>',
      bus: '<svg viewBox="0 0 24 24"><rect x="4" y="3.5" width="16" height="14" rx="3"/><path d="M4 10h16M8 14h.01M16 14h.01M7 17.5V20M17 17.5V20"/></svg>',
      car: '<svg viewBox="0 0 24 24"><path d="M5 16.5v2.5M19 16.5v2.5M3.5 16.5h17v-4l-2-5.5h-13l-2 5.5Z"/><path d="M3.5 12.5h17M7.5 14.5h.01M16.5 14.5h.01"/></svg>',
    };
    var defs = [['subway', '지하철', 'Subway'], ['train', '기차 · KTX', 'Train'], ['bus', '버스', 'Bus'], ['car', '자가용', 'Car']]
      .filter(function (d) { return Dn[d[0]] && Dn[d[0]].length; });
    function route(d) {
      var row = h('div', 'route');
      var ic = h('span', 'route__ico'); ic.innerHTML = ICONS[d[0]]; ic.setAttribute('aria-hidden', 'true');
      var body = h('div');
      var t2 = h('p', 'route__title', d[1]); t2.appendChild(h('small', '', d[2]));
      var ul = h('ul');
      Dn[d[0]].forEach(function (s) { ul.appendChild(h('li', '', bindPhrases(s))); });
      body.appendChild(t2); body.appendChild(ul);
      row.appendChild(ic); row.appendChild(body);
      return row;
    }
    routes.textContent = '';
    routes.classList.remove('is-open');
    if (defs.length) routes.appendChild(route(defs[0]));
    var rest = defs.slice(1);
    if (rest.length) {
      var more = h('div', 'routes__rest');
      more.id = 'routesMore';
      rest.forEach(function (d) { more.appendChild(route(d)); });
      var btn = h('button', 'routes__more');
      btn.type = 'button';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', 'routesMore');
      var lab = h('span', '', '다른 교통편 보기');
      lab.appendChild(h('small', '', '(' + rest.map(function (d) { return d[1].split(' ')[0]; }).join(' · ') + ')'));
      var chev = h('span', 'chev', '▾'); chev.setAttribute('aria-hidden', 'true');
      btn.appendChild(lab); btn.appendChild(chev);
      btn.addEventListener('click', function () {
        var open = !routes.classList.contains('is-open');
        routes.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        lab.firstChild.textContent = open ? '다른 교통편 접기' : '다른 교통편 보기';
      });
      routes.appendChild(btn);
      routes.appendChild(more);
    }
    if (Dn.note) routes.appendChild(h('p', 'route-note', '💡 ' + Dn.note));

    // Leaflet map, loaded only when the section approaches.
    var wrap = $('#mapWrap'), mapEl = $('#map'), fb = $('#mapFallback');
    function fallback(why) { fb.hidden = false; if (window.console) console.warn('[map] fallback:', why && why.message || why); }
    function loadLeaflet() {
      return new Promise(function (resolve, reject) {
        if (window.L && window.L.map) return resolve(window.L);
        var css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        css.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        css.crossOrigin = '';
        var mine = document.querySelector('link[href="css/style.css"]');
        document.head.insertBefore(css, mine);
        var s = document.createElement('script');
        s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        s.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
        s.crossOrigin = '';
        s.async = true;
        s.onload = function () { window.L && window.L.map ? resolve(window.L) : reject(new Error('no leaflet')); };
        s.onerror = function () { reject(new Error('leaflet load failed')); };
        document.head.appendChild(s);
        setTimeout(function () { reject(new Error('timeout')); }, 15000);
      });
    }
    K.onVisible(wrap, function () {
      loadLeaflet().then(function (Lf) {
        var center = [V.lat, V.lng];
        var map = Lf.map(mapEl, {
          center: center, zoom: 16, scrollWheelZoom: false, dragging: !Lf.Browser.mobile, tap: false, keyboard: false,
          zoomControl: true, attributionControl: true,
        });
        map.attributionControl.setPrefix(false);
        var loaded = 0, errors = 0;
        Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).on('tileload', function () { loaded++; })
          .on('tileerror', function () { if (++errors >= 6 && !loaded) fallback('tile errors'); })
          .addTo(map);
        var icon = Lf.divIcon({ className: '', html: '<div class="map-pin"><span>♥</span></div>', iconSize: [46, 46], iconAnchor: [23, 55], popupAnchor: [0, -50] });
        var popup = document.createElement('div');
        popup.appendChild(h('b', '', V.name));
        popup.appendChild(document.createElement('br'));
        popup.appendChild(document.createTextNode('(구 ' + V.formerName + ')'));
        Lf.marker(center, { icon: icon, keyboard: false, title: V.display }).addTo(map).bindPopup(popup, { closeButton: false, autoPan: false }).openPopup();
        setTimeout(function () { map.invalidateSize(); if (!loaded) setTimeout(function () { if (!loaded) fallback('no tiles after 9s'); }, 9000); }, 400);
      }).catch(fallback);
    }, '600px 0px');
  });

  // ------------------------------------------------------------------ 04 accounts
  safe('accounts', function () {
    var note = $('#giftNote');
    note.textContent = '';
    W.giftNote.forEach(function (line) { note.appendChild(h('p', '', line)); });
    var box = $('#accounts');
    box.textContent = '';
    [['groom', '신랑측 계좌번호'], ['bride', '신부측 계좌번호']].forEach(function (g) {
      var wrap = h('div', 'acct');
      var head = h('button', 'acct__head');
      head.type = 'button';
      head.setAttribute('aria-expanded', 'false');
      head.setAttribute('aria-controls', 'acct-' + g[0]);
      head.appendChild(h('span', '', g[1]));
      var chev = h('span', 'chev', '▾'); chev.setAttribute('aria-hidden', 'true');
      head.appendChild(chev);
      var body = h('div', 'acct__body');
      body.id = 'acct-' + g[0];
      W.accounts[g[0]].forEach(function (a) {
        var row = h('div', 'acct-row');
        var left = h('div');
        var who = h('p', 'acct-row__who', a.role); who.appendChild(h('b', '', a.name));
        var num = h('p', 'acct-row__num');
        num.appendChild(h('span', 'bank', a.bank));
        var digits = h('span', 'mono'); // "717-<wbr>910910-<wbr>86807": a very large system font may break it at a hyphen
        String(a.number).split('-').forEach(function (part, i, all) {
          digits.appendChild(document.createTextNode(part + (i < all.length - 1 ? '-' : '')));
          if (i < all.length - 1) digits.appendChild(document.createElement('wbr'));
        });
        num.appendChild(digits);
        left.appendChild(who); left.appendChild(num);
        var btn = h('button', 'btn btn--ink', '복사');
        btn.type = 'button';
        btn.setAttribute('aria-label', a.role + ' ' + a.name + ' 계좌번호 복사');
        btn.addEventListener('click', function () {
          K.copy(a.copy).then(function (ok) { toast(ok ? '계좌번호가 복사되었습니다' : '복사에 실패했어요. 번호를 길게 눌러 복사해 주세요.'); });
        });
        row.appendChild(left); row.appendChild(btn);
        body.appendChild(row);
      });
      head.addEventListener('click', function () {
        var open = !wrap.classList.contains('is-open');
        wrap.classList.toggle('is-open', open);
        head.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      wrap.appendChild(head); wrap.appendChild(body);
      box.appendChild(wrap);
    });
  });

  // ------------------------------------------------------------------ keyboard-safe focus (KakaoTalk Android)
  if (coarse) {
    document.addEventListener('focusin', function (e) {
      var t = e.target;
      if (!t || !/^(INPUT|TEXTAREA)$/.test(t.tagName) || t.type === 'radio') return;
      setTimeout(function () { try { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (err) { t.scrollIntoView(); } }, 320);
    });
  }

  // ------------------------------------------------------------------ 05 RSVP + attendee badge
  /** The RSVP phone field as the guest types or pastes it: Kit.formatPhone ("+82 10-9876-5432" -> "010-9876-5432", a
      number from abroad keeps its digits and its "+"). */
  function normPhone(v) { return K.formatPhone(v); }
  /** A saved number (digits only, as api.js stores it) for the field: one from abroad gets its "+" back. */
  function shownPhone(p) { p = String(p || ''); return normPhone(/^[1-9]/.test(p) && p.indexOf('82') !== 0 ? '+' + p : p); }
  function renderBadge(r) {
    var att = r.attending === 'yes';
    var side = r.side === 'groom' ? '신랑측 하객' : r.side === 'bride' ? '신부측 하객' : '';
    var badge = h('div', 'badge' + (att ? '' : ' badge--remote'));
    var top = h('div', 'badge__top');
    top.appendChild(h('span', 'badge__conf', 'AI-CC ' + W.date.year));
    top.appendChild(h('span', 'badge__city', 'Seoul'));
    badge.appendChild(top);
    badge.appendChild(h('p', 'badge__sub', 'The First Conference on AI Campus Couples'));
    badge.appendChild(h('p', 'badge__role', att ? 'Attendee' : 'Remote'));
    badge.appendChild(h('p', 'badge__name', r.name));
    badge.appendChild(h('p', 'badge__meta', att ? side || '함께해 주셔서 감사합니다' : '멀리서 마음으로 함께해요'));
    var foot = h('div', 'badge__foot');
    var svg = qrSvg(2);
    if (svg) { var qr = h('div', 'badge__qr'); qr.innerHTML = svg; foot.appendChild(qr); } else foot.classList.add('badge__foot--noqr');
    var when = h('p', 'badge__when', W.date.koShort);
    when.appendChild(h('span', 'v', VENUE_HALL));
    when.appendChild(addressInto(h('span', 'a'), ADDRESS));
    if (svg) when.appendChild(h('span', 'q', 'QR → 청첩장'));
    foot.appendChild(when);
    badge.appendChild(foot);
    var band = h('p', 'badge__band'); // Latin in the mono face, the names in Korean type (no letter-spaced Hangul)
    band.appendChild(h('span', 'mono', 'Main Track'));
    band.appendChild(document.createTextNode(' · ' + K.couple()[0].first + ' ♥ ' + K.couple()[1].first));
    badge.appendChild(band);
    return badge;
  }

  var Game = null; // set below; the RSVP form refreshes the game's name fields through it

  var Rsvp = safe('rsvp', function () {
    var form = $('#rsvpForm'), done = $('#rsvpDone'), err = $('#rsvpErr');
    var lead = $('#rsvpLead'), submit = $('#rsvpSubmit'), cancel = $('#rsvpCancel');
    var name = $('#rName'), phone = $('#rPhone'), msg = $('#rMsg');
    var SEND = submit.textContent, editing = false;

    function attending() { var c = form.querySelector('input[name=attending]:checked'); return c ? c.value : ''; }
    function side() { var c = form.querySelector('input[name=side]:checked'); return c ? c.value : ''; }
    $$('input[name=attending]', form).forEach(function (r) {
      r.addEventListener('change', function () { fieldErr('errAttending', null, ''); });
    });
    phone.addEventListener('input', function () {
      var f = normPhone(phone.value);
      if (f !== phone.value) phone.value = f;
      if (phone.getAttribute('aria-invalid')) fieldErr('errPhone', phone, '');
    });
    name.addEventListener('input', function () { if (name.getAttribute('aria-invalid')) fieldErr('errName', name, ''); });

    function fieldErr(id, input, text) {
      $('#' + id).textContent = text;
      if (input) { if (text) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
    }
    /** how: 'fresh' (just sent) | 'again' (answered before) | 'closed' (after the wedding: a keepsake, no editing) */
    function showDone(r, how) {
      done.hidden = false;
      form.hidden = true;
      // the keepsake opens with the success sentence and the badge, not with an instruction that no longer applies
      if (lead) lead.hidden = true;
      var q = $('#quickRsvpLabel');
      if (q) { q.parentNode.classList.add('is-done'); q.textContent = '응답 완료 ✓'; }
      var m = $('#rsvpDoneMsg');
      m.textContent = '';
      if (how === 'fresh') {
        // the judges' exact sentence for an attendee; a decline is never told its "참석 의사" (intention to attend) went
        // through, and is not thanked for its "마음" (on this page, the word for the gift accounts)
        if (r.attending === 'yes') {
          m.appendChild(h('b', '', '참석 의사가 성공적으로 전달되었습니다.'));
          m.appendChild(h('span', '', '감사합니다! 그날 반갑게 뵐게요 🎉'));
        } else {
          m.appendChild(h('b', '', '참석 여부가 성공적으로 전달되었습니다.'));
          m.appendChild(h('span', '', '알려 주셔서 감사합니다. 멀리서 보내 주시는 축하만으로도 큰 힘이 됩니다.'));
        }
      } else if (how === 'closed') {
        m.appendChild(h('span', '', '응답해 주셔서 감사합니다 💐'));
      } else {
        m.appendChild(h('span', '', '이미 응답하셨어요 · 수정이 필요하면 아래 버튼을 눌러 주세요'));
      }
      $('#rsvpEdit').hidden = how === 'closed';
      var wrap = $('#badgeWrap');
      wrap.textContent = '';
      wrap.appendChild(renderBadge(r));
    }
    /** `exact`: an unsent edit coming back as it was (a message the guest cleared stays empty). */
    function fill(r, exact) {
      name.value = r.name || '';
      phone.value = shownPhone(r.phone);
      $$('input[name=attending]', form).forEach(function (i) { i.checked = i.value === r.attending; });
      $$('input[name=side]', form).forEach(function (i) { i.checked = i.value === r.side; });
      msg.value = r.message || (exact ? '' : recall('rsvp-msg')); // older answers kept the message only in this page's storage
    }
    function editMode() {
      done.hidden = true;
      form.hidden = false;
      form.classList.add('is-in');
      if (lead) lead.hidden = false;
      submit.textContent = '수정한 내용 전달하기';
      editing = true;
      if (cancel) cancel.hidden = false;
    }
    // a layer like the photo viewer: Android Back / iOS swipe-back returns to the answer card, not off the invitation.
    // With the form out of sight (the guest went up to check the venue) that Back would close it unseen, with what was
    // typed: it brings the form back into view instead, still open, and the next Back closes it.
    function editEntry() {
      Back.open('rsvpEdit', function () {
        var r = form.getBoundingClientRect(), top = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
        if (r.bottom > top && r.top < (window.innerHeight || 700)) return endEdit(true);
        form.scrollIntoView({ block: 'start', behavior: K.reducedMotion ? 'auto' : 'smooth' });
        setTimeout(function () { if (editing) editEntry(); }, 0); // its entry again, once this Back has been handled
      });
    }
    $('#rsvpEdit').addEventListener('click', function () {
      var r = API.myRSVP();
      if (r) fill(r);
      editMode();
      editEntry();
      // focus the answer, not the name: no keyboard over the 참석 / 측 choices of a guest who came to change those
      var first = form.querySelector('input[name=attending]:checked') || form.querySelector('input[name=attending]');
      try { first.focus({ preventScroll: true }); } catch (x) { /* noop */ }
      form.scrollIntoView({ block: 'start', behavior: K.reducedMotion ? 'auto' : 'smooth' });
    });
    /** Leave the edit: 「수정 취소」, Android Back, a sent edit (then `sent` is the new answer), or rsvp.http taking the
     *  section's place (`handed`: 'step' or 'stay', see `take` below; no scroll then). Returns true when the edit's
     *  history entry is being stepped back (scroll only after that, or the step would cut a smooth scroll short). */
    function endEdit(fromBack, sent, handed) {
      if (!editing) return false;
      editing = false;
      if (cancel) cancel.hidden = true;
      submit.textContent = SEND;
      err.textContent = '';
      ['errAttending', 'errName', 'errPhone'].forEach(function (id) { fieldErr(id, id === 'errName' ? name : id === 'errPhone' ? phone : null, ''); });
      var went = fromBack === true ? false : Back.close('rsvpEdit', handed === 'stay');
      if (!sent) {
        var r = API.myRSVP();
        if (r) showDone(r, 'again');
        if (!handed && done.getBoundingClientRect().top < 0) whenBack(went, function () { done.scrollIntoView({ block: 'start' }); });
      }
      return went;
    }
    function whenBack(went, fn) {
      if (!went) return fn();
      var t = 0, once = function () { window.removeEventListener('popstate', once); clearTimeout(t); fn(); };
      window.addEventListener('popstate', once);
      t = setTimeout(once, 400);
    }
    if (cancel) cancel.addEventListener('click', function () { endEdit(false); $('#rsvpEdit').focus({ preventScroll: true }); });
    // A reload (or a page the back-forward cache will not keep) with the edit open comes back showing the shorter answer
    // card, at the scroll position saved now: close the edit first, keeping the guest's place (what was typed goes
    // with the page either way; no history step, the page is going)
    window.addEventListener('pagehide', function (e) { if (!e.persisted && editing) keepPlace(function () { endEdit(true, false, 'stay'); }); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.textContent = '';
      // a page opened before the ceremony: registration still closes at 18:00 (the form itself stays put until a reload)
      if (Date.now() >= START) {
        fieldErr('errAttending', null, ''); fieldErr('errName', name, ''); fieldErr('errPhone', phone, '');
        err.textContent = '참석 여부 접수를 마감했습니다.';
        return;
      }
      var bad = null;
      var att = attending();
      fieldErr('errAttending', null, att ? '' : '참석 여부를 선택해 주세요.');
      if (!att) bad = bad || form.querySelector('input[name=attending]');
      var nm = name.value.trim();
      fieldErr('errName', name, nm ? '' : '성함을 입력해 주세요.');
      if (!nm) bad = bad || name;
      var digits = normPhone(phone.value).replace(/\D/g, '');
      // as shared/api.js checks: a Korean number starts with 0 (9-11 digits); one from abroad carries its country code (10-15)
      var home = digits.charAt(0) === '0';
      var phoneOk = home ? digits.length >= 9 && digits.length <= 11 : digits.length >= 10 && digits.length <= 15;
      fieldErr('errPhone', phone, phoneOk ? '' : !digits ? '연락처를 입력해 주세요.'
        : home ? '연락처를 정확히 입력해 주세요.' : '연락처를 정확히 입력해 주세요.\n해외 번호는 +국가번호부터 적어 주세요.');
      if (!phoneOk) bad = bad || phone;
      if (bad) { bad.focus(); return; }

      var btn = submit, label = btn.textContent;
      btn.disabled = true; btn.textContent = '전달하는 중…';
      var rec = { name: nm, phone: digits, attending: att === 'yes', side: side(), message: msg.value };
      // an edit that corrects the phone number names the answer it replaces (the server matches answers by number)
      var before = editing && API.myRSVP();
      if (before && before.phone) rec.prevPhone = before.phone;
      API.submitRSVP(rec).then(function () {
        store('rsvp-msg', '');
        var saved = API.myRSVP() || { name: nm, phone: digits, attending: att, side: side(), message: msg.value.trim() };
        label = SEND;
        var went = endEdit(false, true);
        showDone(saved, 'fresh');
        whenBack(went, function () { done.scrollIntoView({ block: 'start', behavior: K.reducedMotion ? 'auto' : 'smooth' }); });
        afterAnswer(nm);
      }, function (ex) {
        err.textContent = (ex && ex.message) || '참석 여부를 전달하지 못했어요. 잠시 후 다시 시도해 주세요.';
      }).then(reset, reset);
      function reset() { btn.disabled = false; btn.textContent = label; }
    });
    /** The game's and the review form's name fields follow a fresh answer (never an error for a saved answer). */
    function afterAnswer(nm) {
      try { if (Game && Game.prefill) Game.prefill(true); } catch (e) { /* the game block may be missing */ }
      var rvName = $('#rvName');
      if (rvName && !rvName.value) rvName.value = nm || '';
    }

    // An answer sent from developer mode (rsvp.http in js/devmode.js): refresh this card too, so no reload is needed.
    window.addEventListener('aicc:rsvp', function (e) {
      var r = (e && e.detail) || API.myRSVP();
      if (!r || STARTED) return;
      fill(r);
      endEdit(false, true); // an edit left open on the front is answered too
      showDone(r, 'fresh');
      afterAnswer(r.name);
      if (e && e.preventDefault) e.preventDefault();
    });

    var mine = API.myRSVP();
    if (STARTED) { // the ceremony has started: registration is closed, politely
      form.hidden = true;
      if (lead) lead.hidden = true;
      $('#rsvpClosed').hidden = false;
      if (mine) showDone(mine, 'closed');
    } else if (mine) { fill(mine); showDone(mine, 'again'); }

    /* Developer mode's rsvp.http and this edit hold one unsent edit between them (js/devmode.js). When rsvp.http takes
       the section's place over an open edit, the edit ends and its values move there: an edit left open behind the code
       face would be closed, unseen, by the next Back, with what the guest had typed. When the front shows again, an edit
       rsvp.http did not send opens again with what rsvp.http holds by then. */
    return {
      /** End an open edit and return what it holds (null when none is open). `stay`: developer mode's entry goes on top
       *  right after, so the edit's own entry stays under it (popstate steps over it later); otherwise an entry of the
       *  edit's on top is stepped back. */
      take: function (stay) {
        if (!editing) return null;
        var r = { name: name.value, phone: phone.value, attending: attending(), side: side(), message: msg.value };
        endEdit(false, false, stay ? 'stay' : 'step');
        return r;
      },
      /** Open the edit again with `r`, where the guest is (no scroll, no focus move). Returns the function that gives it
       *  its Back entry, to call once developer mode's own step back (if any) has landed; null if there is no answer to edit. */
      give: function (r) {
        if (editing || STARTED || !API.myRSVP()) return null;
        fill(r, true);
        editMode();
        return function () { if (editing) editEntry(); };
      },
    };
  });

  // ------------------------------------------------------------------ 06 gallery: three stacked sessions + one lightbox for all
  // The couple's picks (js/photos-allowed.js). Each session: the first available lead, then the rest poured into rows of the given sizes
  // (`shape` shows at once, `more` behind "사진 n장 더 보기"). A photo the cover (h11) or the closing (h17) shows is left out
  // and the rows close up, so swapping the cover never repeats a photo; so is the desktop poster's (h01) while the poster
  // is on screen. Session A on a phone: h09 · h01 h18 h03 · more h16 h15 h00; beside the poster: h09 · h18 h03 h16 · more
  // h15 h00.
  var SETS = [
    { id: 'seoul', tab: '서울', en: 'Haneul Park', letter: 'A', name: '하늘공원, 서울',
      lead: ['h09', 'h18'], rest: ['h01', 'h11', 'h18', 'h03', 'h16', 'h15', 'h00'], shape: [3], more: [3] },
    { id: 'singapore', tab: '싱가포르', en: 'Marina Bay', letter: 'B', name: '마리나베이, 싱가포르', // one word, as in the photo captions
      lead: ['s8', 's6'], rest: ['s3', 's2', 's6', 's1', 's5'], shape: [2], more: [2, 1] },
    { id: 'seattle', tab: '시애틀', en: 'Gas Works Park', letter: 'C', name: '가스 웍스 파크, 시애틀',
      lead: ['w10', 'w00'], rest: ['w00', 'w07', 'w09', 'w18', 'w08'], shape: [3], more: [2] },
  ];

  var Lightbox = safe('lightbox', function () {
    var box = $('#lightbox'), track = $('#lbxTrack'), stage = $('#lbxStage');
    var countEl = $('#lbxCount'), capEl = $('#lbxCap'), sessEl = $('#lbxSess'), hintEl = $('#lbxHint');
    var list = [], idx = 0, opener = null, openerTop = 0, labelOf = null, drag = null, suppressClick = 0, hintTimer = 0;

    function render() {
      track.textContent = '';
      list.forEach(function (id, i) {
        var slide = h('div', 'lightbox__slide');
        var img = K.img(id, { sizes: 'min(100vw, 1100px)', eager: Math.abs(i - idx) <= 1 });
        img.removeAttribute('width'); img.removeAttribute('height');
        img.style.objectPosition = '';
        img.draggable = false;
        slide.appendChild(img);
        slide.setAttribute('aria-hidden', i === idx ? 'false' : 'true');
        track.appendChild(slide);
      });
    }
    function hint(off) {
      clearTimeout(hintTimer);
      hintEl.classList.toggle('is-off', !!off);
      if (!off) hintTimer = setTimeout(function () { hintEl.classList.add('is-off'); }, 3400);
    }
    function go(i, animate) {
      idx = Math.max(0, Math.min(list.length - 1, i));
      track.style.transition = animate === false || K.reducedMotion ? 'none' : 'transform .32s cubic-bezier(.2,.7,.2,1)';
      track.style.transform = 'translate3d(' + (-idx * 100) + '%,0,0)';
      countEl.textContent = (idx + 1) + ' / ' + list.length;
      var lab = labelOf ? labelOf(list[idx]) : { sess: '', cap: '' };
      sessEl.textContent = lab.sess;
      capEl.textContent = lab.cap;
      $$('.lightbox__slide', track).forEach(function (s, j) {
        s.setAttribute('aria-hidden', j === idx ? 'false' : 'true');
        if (Math.abs(j - idx) <= 1) { var im = s.querySelector('img'); if (im) im.loading = 'eager'; }
      });
      $('#lbxPrev').disabled = idx === 0;
      $('#lbxNext').disabled = idx === list.length - 1;
    }
    function open(ids, i, labeler, from) {
      if (!box.hidden) return;
      list = ids; idx = i; labelOf = labeler; opener = from || document.activeElement;
      openerTop = opener && opener.getBoundingClientRect ? opener.getBoundingClientRect().top : 0;
      Back.open('lightbox', function () { close(true); }); // before the scroll lock, so the entry keeps the real position
      render();
      box.hidden = false;
      lockScroll();
      go(i, false);
      hint(false);
      $('#lbxClose').focus({ preventScroll: true });
      document.addEventListener('keydown', onKey);
    }
    function close(fromBack) {
      if (box.hidden) return;
      box.hidden = true;
      track.textContent = '';
      drag = null;
      clearTimeout(hintTimer);
      document.removeEventListener('keydown', onKey);
      unlockScroll();
      // the page may have changed above while the photo was open (at 18:00 the countdown folds away): the photo it was
      // opened from comes back where it was, like the game's place
      if (!locks && opener && opener.isConnected && opener.getBoundingClientRect) nudge(opener.getBoundingClientRect().top - openerTop);
      if (fromBack !== true) Back.close('lightbox');
      if (opener && opener.focus) opener.focus({ preventScroll: true });
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
      else if (e.key === 'Tab') { // keep focus inside the dialog
        var f = [$('#lbxClose'), $('#lbxPrev'), $('#lbxNext')].filter(function (b) { return !b.disabled && b.offsetParent; });
        if (!f.length) return;
        var at = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(at + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    }
    function zoomed() { return window.visualViewport && window.visualViewport.scale > 1.05; }
    stage.addEventListener('pointerdown', function (e) {
      if (!e.isPrimary || zoomed()) return;
      if (e.pointerType === 'mouse') { if (e.button !== 0) return; e.preventDefault(); }
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, active: false };
    });
    stage.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.active) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { drag.active = true; try { stage.setPointerCapture(e.pointerId); } catch (err) { /* noop */ } }
        else if (Math.abs(dy) > 12) { drag = null; return; }
        else return;
      }
      drag.dx = dx;
      var edge = (idx === 0 && dx > 0) || (idx === list.length - 1 && dx < 0) ? 0.35 : 1;
      track.style.transition = 'none';
      track.style.transform = 'translate3d(calc(' + (-idx * 100) + '% + ' + (dx * edge) + 'px),0,0)';
      e.preventDefault();
    });
    function end(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      var d = drag; drag = null;
      if (!d.active) return;
      suppressClick = performance.now() + 450; // the click that follows a drag must not close the photo
      var v = d.dx / Math.max(1, performance.now() - d.t);
      var w = stage.clientWidth || 300;
      if ((d.dx < -w * 0.15 || v < -0.45) && idx < list.length - 1) { go(idx + 1); hint(true); }
      else if ((d.dx > w * 0.15 || v > 0.45) && idx > 0) { go(idx - 1); hint(true); }
      else go(idx);
    }
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    stage.addEventListener('click', function (e) { // a tap on the dark area closes (not on the photo, never after a drag)
      if (performance.now() < suppressClick) return;
      if (e.target === stage || e.target.classList.contains('lightbox__slide')) close();
    });
    $('#lbxClose').addEventListener('click', function () { close(); });
    $('#lbxPrev').addEventListener('click', function () { go(idx - 1); });
    $('#lbxNext').addEventListener('click', function () { go(idx + 1); });
    return { open: open, close: close, next: function () { go(idx + 1); }, isOpen: function () { return !box.hidden; } };
  });

  safe('gallery', function () {
    var tabs = $('#galleryTabs'), root2 = $('#gallerySessions');
    var view = null; // the photos shown now, in order: the viewer's list and its captions
    /** Pour each session into its rows. Left out: the cover's photos, the closing's and, while the poster is on screen,
     *  the poster's; the rows close up. */
    function plan() {
      var all = [], where = {}, skip = posterOn() ? POSTER_ID : null;
      function usable(id) { return !!K.photoInfo(id) && !COVER_IDS[id] && id !== CLOSING_ID && id !== skip; }
      SETS.forEach(function (set) {
        var lead = set.lead.filter(usable)[0] || null;
        var rest = set.rest.filter(function (id, i, a) { return usable(id) && id !== lead && a.indexOf(id) === i; });
        if (!lead) lead = rest.shift() || null;
        function pour(sizes) {
          return sizes.map(function (n) { return rest.splice(0, n); }).filter(function (r) { return r.length; });
        }
        set.leadId = lead;
        set.rows = pour(set.shape);
        set.extra = pour(set.more);
        if (rest.length) set.extra.push(rest.splice(0)); // more photos than slots: one last row
        var ids = (lead ? [lead] : []);
        set.rows.concat(set.extra).forEach(function (r) { r.forEach(function (id) { ids.push(id); }); });
        ids.forEach(function (id, i) { where[id] = { set: set, n: i + 1 }; all.push(id); });
        set.ids = ids;
      });
      return {
        all: all,
        label: function (id) {
          var w = where[id], info = K.photoInfo(id);
          return { sess: w ? 'Session ' + w.set.letter + ' · ' + w.set.name : '', cap: (w ? w.set.letter + w.n + ' · ' : '') + (info && info.alt ? info.alt : '') };
        },
      };
    }
    function row(ids, set, extra) {
      var r = h('div', 'grow' + (extra ? ' is-extra' : ''));
      ids = ids.filter(function (id) { return !!K.photoInfo(id); });
      var ars = ids.map(function (id) { var e = K.photoInfo(id); return e.src.md.w / e.src.md.h; });
      var sum = ars.reduce(function (a, b) { return a + b; }, 0);
      ids.forEach(function (id, j) {
        var info = K.photoInfo(id);
        var frac = ars[j] / sum;
        var fig = h('button', 'fig');
        fig.type = 'button';
        fig.setAttribute('data-id', id);
        fig.style.setProperty('--ar', ars[j].toFixed(4));
        if (info.lqip) fig.style.backgroundImage = 'url("' + info.lqip + '")';
        fig.setAttribute('aria-label', (info.alt || '사진') + ' — 크게 보기');
        fig.appendChild(lazyImg(K.img(id, { sizes: '(min-width: 520px) ' + Math.round(440 * frac) + 'px, ' + Math.round(92 * frac) + 'vw', alt: '' })));
        // (the A1 / B2 figure numbers live in the photo viewer's caption, not as badges on the photos)
        fig.addEventListener('click', function () { var v = view; Lightbox.open(v.all, v.all.indexOf(id), v.label, fig); });
        r.appendChild(fig);
      });
      return r;
    }
    /** The session's "사진 n장 더 보기" toggle: made once and kept through rebuilds (it may hold focus). */
    function toggleOf(sess) {
      var t = $('.session__toggle', sess);
      if (t) return t;
      t = h('button', 'session__toggle');
      t.type = 'button';
      t.appendChild(h('span'));
      var chev = h('span', 'chev', '▾'); chev.setAttribute('aria-hidden', 'true');
      t.appendChild(chev);
      t.addEventListener('click', function () {
        sess.classList.toggle('is-open');
        label(t, sess);
        if (!sess.classList.contains('is-open')) { var r2 = sess.getBoundingClientRect(); if (r2.top < 0) sess.scrollIntoView({ block: 'start' }); }
      });
      return t;
    }
    function label(t, sess) {
      var open = sess.classList.contains('is-open');
      t.setAttribute('aria-expanded', open ? 'true' : 'false');
      t.firstChild.textContent = open ? '접기' : '사진 ' + t.getAttribute('data-n') + '장 더 보기';
    }
    /** What the guest sees of a session about to be rebuilt, to put back afterwards: a photo that stays, the toggle, or
     *  (the session above the screen) everything below it. Returns that function, or null when nothing on screen moves. */
    function hold(sess, ids) {
      var vh = window.innerHeight || 700, s = sess.getBoundingClientRect(), at = null;
      if (s.top >= vh || !$('.grow', sess)) return null;
      if (s.bottom <= 0) at = function () { return sess.getBoundingClientRect().bottom; };
      else {
        var e = $$('.fig, .session__toggle', sess).filter(function (x) {
          var r = x.getBoundingClientRect(), id = x.getAttribute('data-id');
          return r.bottom > 0 && r.top < vh && (!id || ids.indexOf(id) >= 0);
        })[0], id = e && e.getAttribute('data-id');
        at = !e ? function () { return sess.getBoundingClientRect().top; }
          : id ? function () { var f = $('.fig[data-id="' + id + '"]', sess); return f ? f.getBoundingClientRect().top : y0; }
          : function () { return e.getBoundingClientRect().top; };
      }
      var y0 = at();
      return function () { nudge(at() - y0); };
    }
    /** (Re)build a session's rows: an opened session stays open, a focused photo keeps focus and what the guest sees
     *  stays put. The old rows go, and with them any scroll anchor of the browser's (Chromium also jumped ~840 px when the
     *  focused tile was taken out of the page: it is let go first). */
    function fill(set, sess) {
      var a = document.activeElement, had = a && a !== sess && sess.contains(a) ? a.getAttribute('data-id') || 'toggle' : null;
      var back = hold(sess, set.ids);
      if (had && had !== 'toggle') a.blur();
      $$('.grow', sess).forEach(function (el) { sess.removeChild(el); });
      $('.session__meta', sess).textContent = set.ids.length + ' photos';
      var t = toggleOf(sess), at = t.parentNode === sess ? t : null;
      if (set.leadId) sess.insertBefore(row([set.leadId], set), at);
      set.rows.forEach(function (r) { sess.insertBefore(row(r, set), at); });
      set.extra.forEach(function (r) { sess.insertBefore(row(r, set, true), at); });
      var hiddenN = set.extra.reduce(function (n, r) { return n + r.filter(function (id) { return !!K.photoInfo(id); }).length; }, 0);
      if (hiddenN) {
        t.setAttribute('data-n', hiddenN);
        label(t, sess);
        if (!at) sess.appendChild(t);
      } else {
        if (at) { if (had === 'toggle') t.blur(); sess.removeChild(t); }
        sess.classList.remove('is-open');
      }
      if (back) back();
      if (had) { // that photo's new tile (or the toggle), else the session's first photo
        var f = had === 'toggle' && t.parentNode ? t : $('.fig[data-id="' + had + '"]', sess);
        if (f || (f = $('.fig', sess))) f.focus({ preventScroll: true });
      }
    }
    view = plan();
    SETS.forEach(function (set) {
      var a = h('a', 'tab');
      a.href = '#gs-' + set.id;
      a.appendChild(h('b', '', set.tab));
      var en = h('small', '', set.en); en.lang = 'en';
      a.appendChild(en);
      tabs.appendChild(a);

      var sess = set.el = h('div', 'session');
      sess.id = 'gs-' + set.id;
      sess.setAttribute('role', 'group');
      sess.setAttribute('aria-label', 'Session ' + set.letter + ' · ' + set.name);
      var head = h('div', 'session__head');
      var nm = h('p', 'session__name');
      nm.appendChild(h('span', 'mono', 'Session' + NB + set.letter)); // "Session B" stays together; a narrow screen breaks before the place
      nm.appendChild(document.createTextNode(' ' + set.name.split(', ').map(function (s) { return s.replace(/ /g, NB); }).join(', '))); // breaks only after the comma
      head.appendChild(nm);
      head.appendChild(h('p', 'session__meta'));
      sess.appendChild(head);
      fill(set, sess);
      root2.appendChild(sess);
    });
    // The poster came or went: rebuild the sessions it changes. An open photo keeps the list it was opened with; the
    // page follows once it closes (after the viewer has handed focus back to the tile it came from).
    var waiting = 0;
    onPoster(function again() {
      clearTimeout(waiting);
      if (Lightbox && Lightbox.isOpen()) { waiting = setTimeout(again, 400); return; }
      var was = SETS.map(function (s) { return s.ids.join(' '); });
      view = plan();
      SETS.forEach(function (s, i) { if (s.ids.join(' ') !== was[i]) fill(s, s.el); });
    });

    // the session tabs follow the scroll: the last session whose top is above 40 % of the screen (also right after an
    // instant jump, which an IntersectionObserver may never report)
    var tabEls = $$('.tab', tabs), sessions = $$('.session', root2), queued = false, cur = null;
    function spy() {
      queued = false;
      var line = (window.innerHeight || 700) * 0.4, on = sessions[0];
      sessions.forEach(function (s) { if (s.getBoundingClientRect().top <= line) on = s; });
      if (!on || on === cur) return;
      cur = on;
      tabEls.forEach(function (t) { if (t.getAttribute('href') === '#' + on.id) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current'); });
    }
    function soon() { if (!queued) { queued = true; requestAnimationFrame(spy); } }
    window.addEventListener('scroll', soon, { passive: true });
    window.addEventListener('resize', soon);
    spy();
  });

  // ------------------------------------------------------------------ 07 reviews
  safe('reviews', function () {
    var RATINGS = [
      { n: 6, t: 'Strong Accept' }, { n: 5, t: 'Accept' }, { n: 4, t: 'Borderline Accept' },
      { n: 3, t: 'Borderline Reject', lock: true }, { n: 2, t: 'Reject', lock: true }, { n: 1, t: 'Strong Reject', lock: true },
    ];
    var CONF = [
      { n: 5, t: '확신해요 — 둘을 오래 봐 왔어요' },
      { n: 4, t: '꽤 확신해요 — 자주 만났어요' },
      { n: 3, t: '어느 정도요 — 몇 번 만났어요' },
      { n: 2, t: '잘은 몰라요 — 이야기만 들었어요' },
      { n: 1, t: '추측이에요 — 청첩장 보고 처음 알았어요' },
    ];
    // one-tap phrases, so nobody has to type more than a name
    var QUICK = [
      { t: '🎉 결혼 축하해요', s: '결혼 축하해요! 🎉' },
      { t: '😍 잘 어울려요', s: '두 분 정말 잘 어울려요 😍' },
      { t: '🤝 최고의 공동 저자', s: '평생 최고의 공동 저자가 되세요 🤝' },
      { t: '💐 행복하세요', s: '오래오래 행복하세요 💐' },
    ];
    var LOCK_TIP = '이 논문은 이미 양가에서 Accept되었습니다 🙂';
    var rating = null, conf = null;
    var ratingBox = $('#rvRating'), confBox = $('#rvConf'), tip = $('#rvRatingTip');

    // the prize was given on the wedding day: past tense
    if (PHASE === 'after') $('.award__text').textContent = 'Best' + NB + 'Reviewer 시상을 마쳤어요. 정성 가득한 리뷰에 감사드려요.';

    RATINGS.forEach(function (r) {
      var c = h('button', 'chip' + (r.lock ? ' is-locked' : ''));
      c.type = 'button';
      c.appendChild(h('span', 'mono', String(r.n)));
      c.appendChild(document.createTextNode(r.t));
      if (r.lock) { c.setAttribute('aria-disabled', 'true'); c.title = LOCK_TIP; }
      else c.setAttribute('aria-pressed', 'false');
      c.addEventListener('click', function () {
        if (r.lock) { tip.textContent = LOCK_TIP; return; }
        tip.textContent = '';
        rating = rating === r ? null : r;
        $$('.chip', ratingBox).forEach(function (x, i) { if (!RATINGS[i].lock) x.setAttribute('aria-pressed', RATINGS[i] === rating ? 'true' : 'false'); });
      });
      ratingBox.appendChild(c);
    });
    CONF.forEach(function (r) {
      var c = h('button', 'chip');
      c.type = 'button';
      c.setAttribute('aria-pressed', 'false');
      c.appendChild(h('span', 'mono', String(r.n)));
      c.appendChild(document.createTextNode(r.t));
      c.addEventListener('click', function () {
        conf = conf === r ? null : r;
        $$('.chip', confBox).forEach(function (x, i) { x.setAttribute('aria-pressed', CONF[i] === conf ? 'true' : 'false'); });
      });
      confBox.appendChild(c);
    });
    var moreBtn = $('#rvMoreBtn'), more = $('#rvMore');
    moreBtn.addEventListener('click', function () {
      var open = moreBtn.getAttribute('aria-expanded') !== 'true';
      moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      more.hidden = !open;
    });

    var list = $('#rvList'), countEl = $('#rvCount'), moreList = $('#rvMore2');
    var all = [], shown = 6;

    function decisionOf(r) {
      if (r.title) return r.title;
      var ex = r.extra || {};
      if (ex.scale === 'neurips6' && r.rating) { var m = RATINGS.filter(function (x) { return x.n === +r.rating; })[0]; return m ? m.t : ''; }
      return r.rating ? 'Rating ' + r.rating + '/10' : '';
    }
    function card(r) {
      var a = h('article', 'rv' + (r.mine ? ' rv--mine' : ''));
      var head = h('div', 'rv__head');
      head.appendChild(h('span', 'rv__name', r.name));
      if (r.mine) head.appendChild(h('span', 'rv__mine', '내 리뷰'));
      head.appendChild(h('span', 'rv__time', K.timeAgo(r.createdAt)));
      a.appendChild(head);
      var ex = r.extra || {}, dec = decisionOf(r);
      if (dec || ex.confidence) {
        var chips = h('div', 'rv__chips');
        if (dec) chips.appendChild(h('span', 'rv__chip' + (/accept/i.test(dec) ? ' rv__chip--accept' : ''), dec));
        if (ex.confidence) chips.appendChild(h('span', 'rv__chip', 'Confidence ' + ex.confidence));
        a.appendChild(chips);
      }
      a.appendChild(h('p', 'rv__text', r.text));
      if (ex.strengths) {
        var s = h('p', 'rv__strength'); s.appendChild(h('b', '', 'Strengths')); s.appendChild(document.createTextNode(String(ex.strengths)));
        a.appendChild(s);
      }
      var foot = h('div', 'rv__foot');
      var like = h('button', 'rv__like');
      like.type = 'button';
      like.setAttribute('aria-pressed', r.liked ? 'true' : 'false');
      like.setAttribute('aria-label', '공감 (Helpful)');
      like.appendChild(document.createTextNode('👍 Helpful '));
      var n = h('span', 'n', String(r.likes || 0));
      like.appendChild(n);
      like.addEventListener('click', function () {
        if (r.liked) { toast('이미 공감하셨어요 👍'); return; }
        r.liked = true; r.likes = (r.likes || 0) + 1;
        like.setAttribute('aria-pressed', 'true'); n.textContent = r.likes;
        API.likeReview(r.id).then(function (res) {
          if (res && res.likes != null) { r.likes = res.likes; n.textContent = res.likes; }
        }).catch(function (ex2) {
          r.liked = false; r.likes = Math.max(0, r.likes - 1);
          like.setAttribute('aria-pressed', 'false'); n.textContent = r.likes;
          toast((ex2 && ex2.message) || '잠시 후 다시 시도해 주세요.');
        });
      });
      foot.appendChild(like);
      if (r.mine) {
        var del = h('button', 'rv__del', '삭제');
        del.type = 'button';
        del.setAttribute('aria-label', '내 리뷰 삭제');
        del.addEventListener('click', function () {
          var conf2 = h('span', 'rv__confirm');
          conf2.appendChild(document.createTextNode('삭제할까요?'));
          var yes = h('button', 'danger', '삭제'); yes.type = 'button';
          var no = h('button', '', '취소'); no.type = 'button';
          conf2.appendChild(yes); conf2.appendChild(no);
          foot.replaceChild(conf2, del);
          no.focus();
          no.addEventListener('click', function () { foot.replaceChild(del, conf2); del.focus(); });
          yes.addEventListener('click', function () {
            yes.disabled = true; no.disabled = true;
            API.deleteReview(r.id).then(function () {
              all = all.filter(function (x) { return x !== r; });
              render();
              toast('리뷰가 삭제되었습니다');
            }).catch(function (ex3) {
              yes.disabled = false; no.disabled = false;
              toast((ex3 && ex3.message) || '삭제하지 못했어요. 잠시 후 다시 시도해 주세요.');
            });
          });
        });
        foot.appendChild(del);
      }
      a.appendChild(foot);
      return a;
    }
    function render() {
      list.setAttribute('aria-busy', 'false');
      list.textContent = '';
      countEl.textContent = all.length ? '(' + all.length + ')' : '';
      if (!all.length) {
        var e = h('div', 'rv-state');
        e.appendChild(h('p', '', '아직 리뷰가 없어요. 첫 번째 리뷰어가 되어 주세요! ✍️'));
        list.appendChild(e);
      }
      all.slice(0, shown).forEach(function (r) { list.appendChild(card(r)); });
      moreList.hidden = all.length <= shown;
    }
    function load() {
      list.setAttribute('aria-busy', 'true');
      list.textContent = '';
      list.appendChild(h('div', 'rv-skel')); list.appendChild(h('div', 'rv-skel'));
      API.listReviews().then(function (rows) { all = rows || []; render(); }).catch(function (ex) {
        list.setAttribute('aria-busy', 'false');
        list.textContent = '';
        var e = h('div', 'rv-state');
        e.appendChild(h('p', '', (ex && ex.message) || '리뷰를 불러오지 못했어요.'));
        var b = h('button', 'btn btn--line', '다시 시도'); b.type = 'button';
        b.addEventListener('click', load);
        e.appendChild(b);
        list.appendChild(e);
      });
    }
    moreList.addEventListener('click', function () { shown += 6; render(); });
    K.onVisible($('#reviews'), load, '400px 0px');

    var form = $('#reviewForm'), nameIn = $('#rvName'), textIn = $('#rvText'), err = $('#reviewErr');

    // quick phrases: a chip adds its sentence to the text (tap again to take it out); typing keeps the chips in sync
    var qbox = $('#rvQuick'), qrow = $('.qchips__row', qbox), qchips = [];
    QUICK.forEach(function (q) {
      var c = h('button', 'qchip', q.t);
      c.type = 'button';
      c.setAttribute('aria-pressed', 'false');
      c.addEventListener('click', function () {
        var v = textIn.value, has = v.indexOf(q.s) >= 0;
        v = has ? v.replace(q.s, '') : (v.trim() ? v.replace(/\s+$/, '') + ' ' : '') + q.s;
        textIn.value = v.replace(/[ \t]{2,}/g, ' ').replace(/^\s+|\s+$/g, '');
        fe('errRvText', textIn, '');
        syncQuick();
      });
      qrow.appendChild(c);
      qchips.push({ el: c, s: q.s });
    });
    function syncQuick() { qchips.forEach(function (q) { q.el.setAttribute('aria-pressed', textIn.value.indexOf(q.s) >= 0 ? 'true' : 'false'); }); }
    qbox.hidden = false;

    var who = API.myRSVP();
    if (who && who.name) nameIn.value = who.name;
    function fe(id, input, t) { $('#' + id).textContent = t; if (t) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
    nameIn.addEventListener('input', function () { fe('errRvName', nameIn, ''); });
    textIn.addEventListener('input', function () { fe('errRvText', textIn, ''); syncQuick(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.textContent = '';
      var nm = nameIn.value.trim(), tx = textIn.value.trim(), bad = null;
      fe('errRvName', nameIn, nm ? '' : '성함을 입력해 주세요.'); if (!nm) bad = nameIn;
      fe('errRvText', textIn, tx ? '' : '축하 한마디를 적거나 위의 문구를 눌러 주세요.'); if (!tx) bad = bad || textIn;
      if (bad) { bad.focus(); return; }
      var extra = { scale: 'neurips6' };
      if (conf) extra.confidence = conf.n;
      var st = $('#rvStrength').value.trim();
      if (st) extra.strengths = st.slice(0, 80);
      var btn = $('#reviewSubmit'); btn.disabled = true; btn.textContent = '등록하는 중…';
      API.submitReview({ name: nm, text: tx, title: rating ? rating.t : '', rating: rating ? rating.n : '', extra: extra })
        .then(function (res) {
          var r = res.review || { name: nm, text: tx, likes: 0, createdAt: new Date().toISOString(), mine: true, extra: extra };
          r.mine = true;
          all.unshift(r);
          shown = Math.max(shown, 6);
          render();
          textIn.value = ''; $('#rvStrength').value = '';
          rating = null; conf = null;
          $$('.chip[aria-pressed]', form).forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
          syncQuick();
          toast('리뷰가 등록되었습니다. 감사합니다! 🙏');
          var first = list.firstElementChild;
          if (first) first.scrollIntoView({ block: 'center', behavior: K.reducedMotion ? 'auto' : 'smooth' });
        })
        .catch(function (ex) { err.textContent = (ex && ex.message) || '리뷰를 등록하지 못했어요. 잠시 후 다시 시도해 주세요.'; })
        .then(function () { btn.disabled = false; btn.textContent = '리뷰 등록하기'; });
    });
  });

  // ------------------------------------------------------------------ 08 challenge: banner, leaderboard, results
  Game = safe('game', function () {
    var SC = window.SVMCore || null;
    var GAME_ID = (SC && SC.GAME_ID) || 'v1-svm';
    function fmt(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
    function pct(r) { return (Math.floor(r * 1000) / 10).toFixed(1) + '%'; }

    var banner = $('#chBanner');
    var bImg = K.img('w21', { sizes: '(min-width: 520px) 440px, 92vw' });
    banner.insertBefore(bImg, banner.firstChild);
    // tiny scatter plot on the banner: the aisle between the two families
    var plot = h('div', 'ch-banner__plot');
    plot.setAttribute('aria-hidden', 'true');
    plot.innerHTML = '<svg viewBox="0 0 88 88"><path d="M10 78 78 10" style="stroke: var(--amber)" stroke-width="16" stroke-opacity=".35"/><path d="M10 78 78 10" style="stroke: var(--ink)" stroke-width="2.4" stroke-linecap="round"/>' +
      '<g style="fill: var(--groom)" font-size="13" font-family="sans-serif" text-anchor="middle"><text x="22" y="30">♥</text><text x="38" y="20">♥</text><text x="18" y="50">♥</text></g>' +
      '<g style="fill: var(--bride)" font-size="13" font-family="sans-serif" text-anchor="middle"><text x="68" y="58">★</text><text x="52" y="76">★</text><text x="72" y="78">★</text></g></svg>';
    banner.appendChild(plot);

    var CUTOFF = new Date(W.contest.gameCutoff).getTime();
    // from the cutoff the board is final; checked on every load too, as a page may be left open across it
    function boardTitle() { if (Date.now() > CUTOFF) { $('#lbTitle').textContent = 'Final Results'; $('#lbTitleKo').textContent = '최종 순위'; } }
    boardTitle();
    var toCut = CUTOFF - Date.now(); // a page left open at midnight turns final on time (a sleeping phone catches up on waking)
    if (toCut > 0 && toCut < 2147483647) setTimeout(boardTitle, toCut + 50);
    // after the ceremony the gift has been given, as on the Best Reviewer card (the folded rules stay as a record)
    if (PHASE === 'after') $('.prize__text').textContent = '미니 게임 시상을 마쳤어요. 함께 즐겨 주셔서 감사드려요.';

    var tbody = $('#lbBody');
    function renderBoard(rows) {
      boardTitle();
      tbody.textContent = '';
      rows = (rows || []).slice(0, 10);
      if (!rows.length) {
        var tr0 = h('tr'), td0 = h('td', 'lb__empty', '아직 기록이 없어요. 첫 1위(SOTA)의 주인공이 되어 보세요!');
        td0.colSpan = 3; tr0.appendChild(td0); tbody.appendChild(tr0);
        return;
      }
      rows.forEach(function (r) {
        var tr = h('tr', (r.rank === 1 ? 'is-top' : '') + (r.mine ? ' is-mine' : ''));
        tr.appendChild(h('td', 'rk', r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : String(r.rank)));
        var nm = h('td', 'nm'), wrap = h('span', 'lb__nm');
        wrap.appendChild(h('span', 't', r.name));
        if (r.rank === 1 && r.score > 0) wrap.appendChild(h('span', 'lb__sota', 'SOTA'));
        if (r.mine) wrap.appendChild(h('span', 'lb__me', '나'));
        nm.appendChild(wrap);
        tr.appendChild(nm);
        tr.appendChild(h('td', 'num', fmt(r.score)));
        tbody.appendChild(tr);
      });
    }
    // a slower, older leaderboard response must never overwrite a newer board (e.g. the one returned with a fresh score)
    var boardSeq = 0;
    function loadBoard() {
      var mine = ++boardSeq;
      boardTitle();
      return API.leaderboard(GAME_ID, { limit: 10 }).then(function (rows) { if (mine === boardSeq) renderBoard(rows); }).catch(function (ex) {
        if (mine !== boardSeq) return false;
        tbody.textContent = '';
        var tr = h('tr'), td = h('td', 'lb__empty', (ex && ex.message) || '순위를 불러오지 못했어요.');
        td.colSpan = 3; tr.appendChild(td); tbody.appendChild(tr);
        return false;
      });
    }
    K.onVisible($('#leaderboard'), loadBoard, '300px 0px');
    $('#lbRefresh').addEventListener('click', function () { loadBoard().then(function (ok) { if (ok !== false) toast('순위를 새로 불러왔어요'); }); });

    var result = $('#result'), form = $('#scoreForm'), sName = $('#sName'), sPhone = $('#sPhone4'), sErr = $('#scoreErr');
    var rankEl = $('#resultRank'), run = null, best = null, againBtn = $('#againBtn');
    var keep = $('#resultKeep') || h('p'); // "기념으로 화면을 캡처해 두셔도 좋아요" once the score is in
    var bestEl = $('#resultBest') || h('p'), rsvpEl = $('#resultRsvp') || h('p');
    function again(primary) { if (againBtn) againBtn.className = 'btn btn--block btn--lg ' + (primary ? 'btn--amber' : 'btn--line'); }
    // without the game script (blocked or failed to load) the button still answers
    var playBtn = $('#playBtn');
    if (playBtn) playBtn.addEventListener('click', function () { if (!window.HumanSVM) toast('게임을 불러오지 못했어요. 잠시 후 새로고침해 주세요.'); });
    var stats = $('#resultStats');
    if (!stats) { // older markup: add the stats line under the score
      stats = h('p', 'result__stats');
      stats.id = 'resultStats';
      var sc = $('.result__score', result);
      sc.parentNode.insertBefore(stats, sc.nextSibling);
    }
    function prefill(force) {
      var p = API.lastPlayer(), r = API.myRSVP();
      if (!force && sName.value) return;
      if (p) { sName.value = p.name || ''; sPhone.value = p.phone4 || ''; }
      else if (r) { sName.value = r.name || ''; sPhone.value = String(r.phone || '').replace(/\D/g, '').slice(-4); }
    }
    sPhone.addEventListener('input', function () { var v = sPhone.value.replace(/\D/g, '').slice(0, 4); if (v !== sPhone.value) sPhone.value = v; });

    // titles by share of the maximum, from the simulation in GAME.md: a typical winner of 150 guests ≈ 77 %,
    // expert median ≈ 67 %, good median ≈ 56 %, first-time casual median ≈ 40 %; nobody reaches 100 %
    var TITLES = [
      [0.75, 'Support Vector Machine 🤖', '혹시… 사람 맞으시죠? 거의 SVM 그 자체'],
      [0.68, 'Max-Margin Master', '하객 배치의 달인 — 버진로드가 시원하게 넓어요'],
      [0.60, 'Kernel Trickster', '차원을 넘나드는 감각, 아주 훌륭해요'],
      [0.50, 'Linear Separator', '길은 잘 냈어요! 조금만 더 넓게'],
      [0.37, 'Gradient Descender', '점점 수렴하는 중 — 한 번 더 해 볼까요?'],
      [0, 'Warm-up Epoch', '첫 판은 원래 이래요. 다시 도전!'],
    ];
    function show(r) {
      boardTitle();
      // 다시 하기 before 기록 등록하기: the better run of this visit is kept and offered, never silently lost
      var closed = Date.now() > new Date(W.contest.gameCutoff).getTime();
      if (run && !run.submitting && (!best || run.total > best.total)) best = run;
      if (closed || (best && best.total <= r.total)) best = null;
      run = r;
      var max = r.max || (SC && SC.MAX_SCORE) || 1;
      var t = TITLES.filter(function (x) { return r.total >= x[0] * max; })[0];
      var title = $('#resultTitle');
      title.textContent = t[1];
      title.appendChild(h('small', '', t[2]));
      $('#resultScore').textContent = fmt(r.total);
      $('#resultMax').textContent = fmt(max);
      // "모두 제자리" (every guest on the right side) is the entry ticket; the aisle's width and the speed make the score
      var perfect = r.rounds.filter(function (x) { return x.perfect; });
      stats.textContent = '';
      stats.appendChild(document.createTextNode('모두' + NB + '제자리' + NB));
      stats.appendChild(h('b', '', perfect.length + '/' + r.rounds.length));
      if (perfect.length) {
        var mr = 0, ms = 0;
        perfect.forEach(function (x) { mr += x.ratio; ms += x.sec || 0; });
        stats.appendChild(document.createTextNode(' · 평균' + NB + '길' + NB + '폭' + NB)); // the rules' word, not "마진"
        stats.appendChild(h('b', '', pct(mr / perfect.length)));
        stats.appendChild(document.createTextNode(' · 평균' + NB));
        stats.appendChild(h('b', '', (ms / perfect.length).toFixed(2) + '초'));
      }
      var ol = $('#resultRounds'); ol.textContent = '';
      ol.setAttribute('aria-label', '라운드별 점수 (배점 대비)');
      r.rounds.forEach(function (x, i) {
        var li = h('li', x.perfect ? 'is-perfect' : x.total ? '' : 'is-zero');
        var share = Math.max(0, Math.min(1, x.total / (x.max || 1)));
        li.appendChild(h('span', '', x.kernel ? 'K' : 'R' + (i + 1)));
        var v = h('b', '', String(Math.floor(share * 100)));
        v.appendChild(h('small', '', '%'));
        li.appendChild(v);
        li.appendChild(h('i'));
        li.style.setProperty('--f', share.toFixed(3));
        li.title = fmt(x.total) + ' / ' + fmt(x.max) + '점';
        li.setAttribute('aria-label', (i + 1) + '라운드 ' + fmt(x.total) + '점, 배점 ' + fmt(x.max) + '점의 ' + Math.floor(share * 100) + '%' + (x.perfect ? ', 길 폭 ' + pct(x.ratio) : ''));
        ol.appendChild(li);
      });
      rankEl.textContent = '';
      sErr.textContent = '';
      keep.hidden = true;
      rsvpEl.hidden = true;
      bestEl.hidden = !best;
      if (best) bestEl.textContent = '등록하면 이번 방문 최고 기록 ' + fmt(best.total) + '점이 올라가요.';
      // from the cutoff (the end of 12/18) the ranking is final (the server refuses later runs): play on for fun, no submission
      form.hidden = closed;
      if (closed) rankEl.textContent = '순위가 확정되었어요. 이번 판은 연습으로 즐겨 주세요 🙂';
      again(closed); // the retry stays quieter than "기록 등록하기" until there is nothing left to submit
      $('#scoreSubmit').disabled = false;
      $('#scoreSubmit').textContent = '기록 등록하기';
      prefill(false);
      result.hidden = false;
      requestAnimationFrame(function () {
        result.scrollIntoView({ block: 'start', behavior: K.reducedMotion ? 'auto' : 'smooth' });
        result.focus({ preventScroll: true });
      });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!run || run.submitting || (best && best.submitting)) return;
      sErr.textContent = '';
      var nm = sName.value.trim(), p4 = sPhone.value.replace(/\D/g, '');
      if (!nm) { sErr.textContent = '성함을 입력해 주세요.'; sName.focus(); return; }
      if (p4.length !== 4) { sErr.textContent = '연락처 뒤 4자리를 입력해 주세요.'; sPhone.focus(); return; }
      var btn = $('#scoreSubmit'); btn.disabled = true; btn.textContent = '등록하는 중…';
      var shown = run, r = best || run; // the best run of this visit (see show())
      r.submitting = true;
      var extra = { v: r.v, seed: r.seed, src: r.seedSource, log: r.log };
      if (r.input) extra.input = r.input; // touch / mouse / pen / keys: how the lines were drawn (for the couple's check)
      API.submitScore({
        game: GAME_ID, sessionId: r.sessionId, name: nm, phone4: p4, score: r.total, durationMs: r.durationMs, extra: extra,
      }).then(function (res) {
        form.hidden = true;
        // a card shown before the cutoff and sent after it: the server keeps the run as a record only (backend/README.md §4)
        var late = !res.valid && (res.reason === 'after cutoff' || Date.now() > CUTOFF);
        if (res.valid) {
          rankEl.textContent = res.rank ? '🎉 현재 ' + res.rank + '위! (내 최고 기록 ' + fmt(res.best) + '점)' : '기록이 등록되었어요!';
        } else if (late) {
          rankEl.textContent = '기록은 저장했어요. 순위는 이미 확정되었어요 🙂';
        } else {
          // the record is in the sheet either way; the couple look at unranked runs before the prize (never "try again")
          textInto(rankEl, '기록은 저장했어요. 순위표에는 신랑·신부가 확인한 뒤 올라가요 🙂');
        }
        // the prize goes to a guest who replied as attending: one who has not replied on this phone is told where
        rsvpEl.hidden = late || !!API.myRSVP();
        keep.hidden = false;
        again(true);
        boardSeq++;
        if (res.leaderboard && res.leaderboard.length) renderBoard(res.leaderboard); else loadBoard();
        if (run === shown) run = null;
        if (best === r) best = null;
      }).catch(function (ex) {
        r.submitting = false;
        sErr.textContent = (ex && ex.message) || '기록을 등록하지 못했어요. 잠시 후 다시 시도해 주세요.';
        btn.disabled = false; btn.textContent = '기록 등록하기';
      });
    });
    return { show: show, prefill: prefill, loadBoard: loadBoard, GAME_ID: GAME_ID };
  });

  // ------------------------------------------------------------------ closing + share
  safe('closing', function () {
    var img = K.img(CLOSING_ID, { sizes: '(min-width: 520px) 480px, 100vw' });
    if (CLOSING_ID === 'h17') img.style.objectPosition = '50% 40%';
    $('#closingMedia').appendChild(img);
    if (STARTED) { // from the ceremony on, "뵙기를 기다리겠습니다" no longer fits: the guests are there, or it is over
      var t = $('#closingText');
      t.textContent = '';
      t.appendChild(document.createTextNode('함께 축하해 주셔서 진심으로 감사합니다.'));
      t.appendChild(document.createElement('br'));
      t.appendChild(document.createTextNode('보내 주신 마음, 오래 간직하겠습니다.'));
    }
    $('#shareBtn').addEventListener('click', function () {
      K.share().then(function (r) {
        if (r === 'copied') toast('링크가 복사되었습니다');
        else if (r === 'failed') toast('링크를 복사하지 못했어요');
      });
    });
    $('#copyLinkBtn').addEventListener('click', function () {
      var url = (window.WEDDING_CONFIG && WEDDING_CONFIG.siteUrl) || location.href;
      K.copy(url).then(function (ok) { toast(ok ? '링크가 복사되었습니다' : '링크를 복사하지 못했어요'); });
    });
  });

  // ------------------------------------------------------------------ the wedding day (KST): directions first, then thanks
  /** Put the nav chips, the "전체" sheet and the desktop program in the page's order. */
  function reorderNav(order) {
    var scroller = $('#topnavScroller');
    order.forEach(function (id) { var a = $('a[href="#' + id + '"]', scroller); if (a) scroller.appendChild(a); });
    ['.navsheet__list', '.program__list'].forEach(function (sel) {
      var ol = $(sel);
      if (!ol) return;
      order.forEach(function (id) { var a = $('a[href="#' + id + '"]', ol); if (a) ol.appendChild(a.parentNode); });
    });
  }
  /** Section numbers follow the page's order (on the wedding day 오시는 길 comes first and reads 01, not 03). */
  function renumber() {
    var n = 0;
    $$('#main > .sec').forEach(function (s) { var no = $('.eyebrow__no', s); if (no) no.textContent = pad(++n); });
    ['.navsheet__list', '.program__list'].forEach(function (sel) {
      $$(sel + ' > li > a > span').forEach(function (sp, i) { sp.textContent = pad(i + 1); });
    });
  }
  var ICON = {
    review: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-7l-4.5 3.5V16.5H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5Z"/><path d="M8 9h8M8 12.5h5"/></svg>',
    photo: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4"/></svg>',
  };
  safe('phaseLayout', function () {
    if (PHASE === 'before') return;
    var main = $('#main'), quick = $('#quick'), bar = $('#dayBar');
    function barText(ph) {
      var when = ph === 'evening' ? '지금 예식 중' : '오늘 ' + koTime(W.date.hour, W.date.minute), el = $('#dayBarWhen'), cut = when.indexOf(' ');
      el.textContent = ''; // "오늘 | 오후 6시", "지금 | 예식 중": where the tightest bar may wrap it (.is-tight)
      el.appendChild(h('span', 'nb', when.slice(0, cut)));
      el.appendChild(document.createTextNode(' '));
      el.appendChild(h('span', 'nb', when.slice(cut + 1)));
      bar.setAttribute('aria-label', when + ' · ' + VENUE_HALL.replace(/ /g, ' ') + ' · 오시는 길 보기');
    }
    if (PHASE === 'morning' || PHASE === 'evening') {
      // from 06:00 until the ceremony ends (20:00): late guests still find the way first
      root.classList.add('is-dday');
      if (W.venue.hall) $('#dayBarHall').textContent = W.venue.hall;
      else { $('#dayBarHall').hidden = true; $('.daybar__dot', bar).hidden = true; }
      barText(PHASE);
      bar.hidden = false;
      // the cover gives up the bar's height (--bar-h); a late web font, a text-size change or the 18:00 text can re-wrap
      // the bar, so it is watched, not just measured once. The hall steps aside (.is-tight) where it would slide under
      // 오시는 길 (very large text on a narrow phone) or, on a phone in landscape, take a second line from the cover's
      // facts: the cover and 오시는 길 name it anyway, and so does the bar's label
      var info = $('.daybar__info', bar), hall = $('#dayBarHall'), when = $('#dayBarWhen');
      var LAND = window.matchMedia ? matchMedia('(orientation: landscape) and (max-height: 520px)') : null;
      var setBar = function () {
        if (bar.hidden) return;
        bar.classList.remove('is-tight');
        if (!hall.hidden && (info.scrollWidth > info.clientWidth + 1 ||
            (LAND && LAND.matches && hall.getBoundingClientRect().top > when.getBoundingClientRect().top + 2))) bar.classList.add('is-tight');
        root.style.setProperty('--bar-h', bar.offsetHeight + 'px');
      };
      setBar();
      // a frame later: .is-tight set inside the observer's own callback would resize the bar it watches (a loop error)
      if ('ResizeObserver' in window) new ResizeObserver(function () { requestAnimationFrame(setBar); }).observe(bar);
      else window.addEventListener('resize', setBar);
      main.insertBefore($('#venue'), main.firstChild); // 오시는 길 directly under the cover
      quick.hidden = true; // the bar above is the shortcut today
      reorderNav(['venue', 'cfp', 'dates', 'gift', 'rsvp', 'gallery', 'reviews', 'challenge']);
      // A page left open: at 18:00 the bar says the ceremony has begun; at 20:00 it steps aside (the rest waits for a reload).
      // Checked every second against the wall clock, like the countdown: a phone woken from sleep has timers that lag it.
      var barPhase = PHASE, barTick = setInterval(function () {
        var ph = phaseAt(Date.now());
        if (ph === barPhase) return;
        barPhase = ph;
        if (ph === 'evening') barText('evening');
        else if (ph === 'after') { clearInterval(barTick); keepPlace(function () { bar.hidden = true; root.classList.remove('is-dday'); }); }
      }, 1000);
    } else {
      root.classList.add('is-after');
      quick.textContent = '';
      var note = h('p', 'quick__note');
      note.appendChild(h('b', '', '함께해 주셔서 감사합니다'));
      // "오늘" only on the day itself (from D+1 the wedding is "그날"); guests leave wishes here, not photos
      note.appendChild(h('span', '', '남겨 주신 축하 덕분에 ' + (K.dday().days === 0 ? '오늘을' : '그날을') + ' 오래 기억할게요.'));
      quick.appendChild(note);
      [['#reviews', ICON.review, '축하 리뷰'], ['#gallery', ICON.photo, '사진 보기'], ['#gift', null, '마음 전하기']].forEach(function (q) {
        var a = h('a', 'quick__btn');
        a.href = q[0];
        a.innerHTML = q[1] || '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6" width="17" height="13" rx="2.5"/><path d="m4 7.5 8 6 8-6"/></svg>';
        a.appendChild(h('span', '', q[2]));
        quick.appendChild(a);
      });
      // reviews and photos first
      main.insertBefore($('#gallery'), quick.nextSibling);
      main.insertBefore($('#reviews'), quick.nextSibling);
      reorderNav(['reviews', 'gallery', 'cfp', 'dates', 'venue', 'gift', 'rsvp', 'challenge']);
    }
    renumber();
  });

  // ------------------------------------------------------------------ nav: scroll-spy, the sticky bar's entrance, the "전체" sheet
  var Nav = safe('nav', function () {
    var ids = ['cfp', 'dates', 'venue', 'gift', 'rsvp', 'gallery', 'reviews', 'challenge'];
    var chips = $$('#topnavScroller a'), others = $$('.program__list a, .navsheet__list a'), scroller = $('#topnavScroller');
    var current = '';
    function set(id) {
      if (id === current) return;
      current = id;
      if (id === 'top' && scroller) scroller.scrollLeft = 0;
      chips.forEach(function (a) {
        var on = a.getAttribute('href') === '#' + id;
        if (on) {
          a.setAttribute('aria-current', 'true');
          // instant on purpose: a smooth scroll here would cancel an in-flight smooth page scroll in Chromium
          scroller.scrollLeft = Math.max(0, a.offsetLeft - (scroller.clientWidth - a.offsetWidth) / 2);
        } else a.removeAttribute('aria-current');
      });
      others.forEach(function (a) { if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) set(en.target.id); });
      }, { rootMargin: '-40% 0px -55% 0px' });
      ids.concat(['top', 'closing']).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
    }

    // The sticky bar comes in only once the quick row (or, when that is hidden, the cover) has scrolled away, so the
    // first thing after the cover is the invitation, not two navigation systems.
    var bar = $('#topnav'), quick = $('#quick'), cover = $('#top'), dayBar = $('#dayBar'), queued = false;
    var btn = $('#navAll'), sheet = $('#navSheet'), y0 = 0;
    function place() {
      queued = false;
      var a = quick && !quick.hidden && quick.offsetHeight ? quick : cover, top = dayBar && !dayBar.hidden ? dayBar.offsetHeight : 0;
      var show = !a || a.getBoundingClientRect().bottom <= top + 1 || !sheet.hidden || keyboardIn();
      if (show !== bar.classList.contains('is-shown')) bar.classList.toggle('is-shown', show);
    }
    // Keyboard focus keeps the bar on screen; focus left there by a tap (the ♪, ☰ then ✕) must not hold it over the quick row.
    function keyboardIn() {
      try { return !!bar.querySelector(':focus-visible'); } catch (e) { return bar.contains(document.activeElement); }
    }
    function soon() { if (!queued) { queued = true; requestAnimationFrame(place); } }
    root.classList.add('nav-auto');
    place();
    window.addEventListener('scroll', soon, { passive: true });
    window.addEventListener('resize', soon);
    bar.addEventListener('focusin', soon);
    // a chip reached by the keyboard comes to the middle of the strip (a tap or a click leaves the strip where it is)
    if (scroller) scroller.addEventListener('focusin', function (e) {
      var a = e.target;
      try { if (!a.matches(':focus-visible')) return; } catch (err) { return; }
      scroller.scrollLeft = Math.max(0, a.offsetLeft - (scroller.clientWidth - a.offsetWidth) / 2);
    });
    bar.addEventListener('focusout', function () { setTimeout(soon, 0); });

    // A tap outside only closes the sheet: the click that follows must not also open a photo or the game, whose own
    // history entry would then be taken by the sheet's step back.
    var swallowUntil = 0;
    function onDown(e) {
      if (sheet.contains(e.target) || btn.contains(e.target)) return;
      if (!bar.contains(e.target)) swallowUntil = Date.now() + 600; // a chip in the bar still navigates (after the step back)
      toggle(false);
    }
    document.addEventListener('click', function (e) {
      if (Date.now() > swallowUntil) return;
      swallowUntil = 0;
      e.preventDefault(); e.stopPropagation();
    }, true);
    document.addEventListener('pointercancel', function () { swallowUntil = 0; }, true); // that touch became a scroll
    function onKey(e) { if (e.key === 'Escape') { toggle(false); btn.focus(); } }
    function onScroll() { if (Math.abs((window.scrollY || 0) - y0) > 80) toggle(false); }
    /** Returns true when closing went back through history (its own entry), so callers can wait for that step. */
    function toggle(open, fromBack) {
      if (open === !sheet.hidden) return false;
      sheet.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      var m = open ? 'addEventListener' : 'removeEventListener', went = false;
      document[m]('pointerdown', onDown, true);
      document[m]('keydown', onKey);
      window[m]('scroll', onScroll, { passive: true });
      // Android Back / iOS swipe-back closes the sheet (at large text sizes it fills the screen) instead of the invitation
      if (open) Back.open('sheet', function () { toggle(false, true); });
      else if (!fromBack) went = Back.close('sheet');
      if (went && !settling) {
        settling = [];
        var flush = function () {
          if (!settling) return;
          var q = settling; settling = null; window.removeEventListener('popstate', flush);
          q.forEach(function (f) { try { f(); } catch (e) { /* noop */ } });
        };
        window.addEventListener('popstate', flush);
        setTimeout(flush, 300);
      }
      soon();
      if (open) { y0 = window.scrollY || 0; var cur = $('a[aria-current="true"]', sheet) || $('a', sheet); if (cur) cur.focus({ preventScroll: true }); }
      return went;
    }
    /** Run fn once the sheet's own history step (if one is under way) is done: a step back must not race a smooth scroll. */
    var settling = null;
    function whenSettled(fn) {
      if (!settling) return fn();
      settling.push(fn);
    }
    function closeThen(fn) { toggle(false); whenSettled(fn); }
    btn.addEventListener('click', function () { toggle(sheet.hidden); });
    var x = $('#navClose');
    if (x) x.addEventListener('click', function () { toggle(false); btn.focus({ preventScroll: true }); });
    $$('a', sheet).forEach(function (a) {
      a.addEventListener('click', function (e) {
        var t = document.getElementById(a.getAttribute('href').slice(1));
        if (!t || e.metaKey || e.ctrlKey) { toggle(false); return; }
        e.preventDefault();
        closeThen(function () { goTo(t); });
      });
    });
    return { close: closeThen, place: soon, whenSettled: whenSettled };
  });

  // ------------------------------------------------------------------ background music: ♪ on the cover and in the bar
  /* WEDDING.music: one looping track, fetched only once it plays. It starts by
     itself only where the browser allows sound without a tap (KakaoTalk's browser may); everywhere else the ♪ buttons
     start it, and no other tap does. It never starts by itself during the ceremony, and music already playing stops when
     the ceremony begins (unless the guest pressed ♪ after 18:00). Never on a device whose guest turned it off, and in
     test browsers only when the test stores 'on'. It pauses while the page is hidden (a map app, the chat list) and comes
     back with it, except during the ceremony (even music the guest turned on after 18:00 stays off until pressed again),
     when the ceremony began meanwhile (hidden before 18:00, back after), or when the guest turned it off in another tab. */
  safe('music', function () {
    var M = W.music, btns = $$('[data-bgm]'), name = document.title.split(' · ')[0]; // read before developer mode can retitle
    if (!M || !M.src || !btns.length || !window.Audio) { root.classList.remove('has-bgm'); return; }
    var audio = null, on = false, held = false, ramp = 0, since = 0, hiddenAt = 0, later = false;
    function quiet() { return phaseAt(Date.now()) === 'evening'; }
    function set(v) {
      if (on === v) return;
      on = v;
      btns.forEach(function (b) { b.setAttribute('aria-pressed', v ? 'true' : 'false'); });
    }
    function el() {
      if (audio) return audio;
      audio = new Audio();
      audio.loop = true;
      audio.preload = 'none';
      audio.src = M.src;
      // the phone paused or resumed it (a call, another app's sound, the lock-screen controls): the buttons follow
      audio.addEventListener('pause', function () { if (!held) set(false); });
      audio.addEventListener('play', function () { held = false; set(true); });
      // a file that cannot load or play (gone, cut off): off, so the next press fetches it again and says so if it fails
      audio.addEventListener('error', function () { clearInterval(ramp); held = false; set(false); });
      // 18:00: the ceremony begins in the hall. Music begun before it stops, also if the phone's own controls bring it back
      // after 18:00; music the guest started with ♪ during the ceremony stays their choice.
      audio.addEventListener('timeupdate', function () {
        if (on && quiet() && phaseAt(since) !== 'evening') { stop(); toast('예식이 시작되어 배경음악을' + NB + '껐어요'); }
      });
      if (navigator.mediaSession && window.MediaMetadata) { // the lock screen names the invitation, not the file
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: name, artist: M.title + ' · ' + M.artist,
            artwork: [{ src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
          });
        } catch (e) { /* noop */ }
      }
      return audio;
    }
    /** byGuest: the ♪ button, which turns on at once (and says so if the track cannot play) */
    function play(byGuest) {
      var a = el(), p, soft = false;
      since = Date.now();
      if (byGuest) set(true);
      if (a.error) { try { a.load(); } catch (e) { /* noop */ } }
      clearInterval(ramp);
      // A quiet start that every browser still counts as sound: at volume 0, Safari and Firefox would start it without
      // a tap and pause it again as it fades in. iOS keeps the phone's own volume (no fade there).
      try { a.volume = 0.05; soft = a.volume < 0.5; } catch (e) { /* noop */ }
      try { p = a.play(); } catch (e) { p = null; }
      if (!p || !p.then) { a.volume = 1; return; }
      p.then(function () {
        clearInterval(ramp);
        if (!soft) return;
        var id = ramp = setInterval(function () {
          a.volume = Math.min(1, a.volume + 0.1);
          if (a.volume >= 1) clearInterval(id);
        }, 100);
      }, function (e) {
        a.volume = 1;
        if (!byGuest || (e && e.name === 'AbortError')) return; // not allowed by itself, or paused while it loaded
        set(false);
        toast('배경음악을 틀지 못했어요');
      });
    }
    function stop() {
      set(false);
      clearInterval(ramp);
      if (audio) { audio.pause(); audio.volume = 1; } // the phone's own play must not resume a fade cut short
    }
    btns.forEach(function (b) {
      b.hidden = false;
      b.addEventListener('click', function () {
        if (on) { stop(); store('bgm', 'off'); } else { play(true); store('bgm', 'on'); }
      });
    });
    window.addEventListener('storage', function (e) { // turned off in another tab
      if (e.key === NS + 'bgm' && e.newValue === 'off' && on) stop();
    });
    function away() {
      hiddenAt = Date.now();
      if (audio && on) { held = true; clearInterval(ramp); audio.volume = 1; audio.pause(); }
    }
    function back() {
      if (later) { later = false; auto(); return; }
      if (!held) return;
      held = false;
      if (!on) return;
      // back during the ceremony, hidden before 18:00 and back after, or turned off in another tab meanwhile: it stays off
      if (quiet() || (hiddenAt < BOUNDS[1] && Date.now() >= BOUNDS[1]) || recall('bgm') === 'off') { set(false); return; }
      var p;
      try { p = audio.play(); } catch (e) { p = null; }
      if (p && p.then) p.then(null, function (e) { if (!e || e.name !== 'AbortError') set(false); });
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) away(); else back(); });
    // a same-tab trip (a map link) and Back: a page restored from the back-forward cache may get no visibility event
    window.addEventListener('pagehide', away);
    window.addEventListener('pageshow', function (e) { if (e.persisted && !document.hidden) back(); });

    function auto() { if (!quiet() && recall('bgm') !== 'off') play(false); }
    var saved = recall('bgm');
    if (M.autoplay === false || saved === 'off' || (navigator.webdriver && saved !== 'on')) return;
    if (document.hidden) later = true; // opened in the background: it tries when the guest first looks
    else auto();
  });

  // ------------------------------------------------------------------ in-page anchors: smooth, focus-friendly
  /** Smooth-scroll to an element, then re-aim once it settles (content above may still be loading, e.g. reviews). */
  var stopAim = null;
  /** Where t lands: below the bar(s) by the scroll padding, except right after the cover. The sticky bar comes in only
   *  once the cover has gone, so a section that follows it (오시는 길 on the wedding day) lands just as the cover leaves,
   *  never under a strip of the cover with its own "오시는 길 보기" cue. */
  function landing(t, pad) {
    var sy = window.scrollY || 0, top = t.getBoundingClientRect().top + sy, y = top - pad, cov = $('#top'), bar = $('#dayBar');
    if (cov) {
      var barH = bar && !bar.hidden ? bar.offsetHeight : 0, gone = cov.getBoundingClientRect().bottom + sy - barH;
      if (y < gone) y = Math.min(gone, top - barH);
    }
    return Math.max(0, Math.round(y));
  }
  function scrollToEl(t) {
    if (stopAim) stopAim();
    var smooth = !K.reducedMotion, tries = 0, last = -1, still = 0, timer = 0, killer = 0;
    var want = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    function done() {
      clearInterval(timer); clearTimeout(killer); stopAim = null;
      ['wheel', 'touchstart', 'keydown'].forEach(function (ev) { window.removeEventListener(ev, done, true); });
    }
    function go(behavior) { var y = landing(t, want); try { window.scrollTo({ top: y, behavior: behavior }); } catch (e) { window.scrollTo(0, y); } }
    stopAim = done;
    ['wheel', 'touchstart', 'keydown'].forEach(function (ev) { window.addEventListener(ev, done, true); }); // the guest takes over
    go(smooth ? 'smooth' : 'auto');
    timer = setInterval(function () {
      var y = Math.round(window.scrollY);
      still = y === last ? still + 1 : 0;
      last = y;
      if (still < 2) return;
      var off = landing(t, want) - y;
      if (Math.abs(off) > 6 && tries++ < 3) { still = 0; go(smooth && Math.abs(off) < 1500 ? 'smooth' : 'auto'); }
      else done();
    }, 110);
    killer = setTimeout(done, 7000);
  }
  /** "초대장 보기" (#main): the cover leaves the screen entirely, with no sliver of it above the bar. */
  function toMain(t) {
    if (stopAim) stopAim();
    var bar = $('#dayBar'), off = bar && !bar.hidden ? bar.offsetHeight : 0;
    var y = Math.max(0, Math.round(t.getBoundingClientRect().top + (window.scrollY || 0) - off));
    try { window.scrollTo({ top: y, behavior: K.reducedMotion ? 'auto' : 'smooth' }); } catch (e) { window.scrollTo(0, y); }
  }
  function goTo(t) {
    if (t.id === 'main') toMain(t); else scrollToEl(t);
    if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
    try { t.focus({ preventScroll: true }); } catch (err) { /* noop */ }
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    var id = a.getAttribute('href').slice(1), t = id && document.getElementById(id);
    if (!t) return;
    e.preventDefault();
    if (Nav && Nav.whenSettled) Nav.whenSettled(function () { goTo(t); }); else goTo(t);
  });

  // ------------------------------------------------------------------ very large system text on the narrowest phones
  /* A two- or three-up control whose label is one word that cannot fit its box ("참석할게요", "싱가포르" at 160 % on a
     280 px phone) stacks to one column instead of breaking the word in two. Measured, so it works whichever way the
     phone enlarges text (html font size or text-size-adjust). */
  var Fit = safe('fitWords', function () {
    // [group, label, the box whose content width the label may use]
    var GROUPS = [['.seg', '.seg__opt span', '.seg__opt span'], ['#galleryTabs', '.tab b', '.tab']];
    var cv = document.createElement('canvas').getContext('2d');
    function wordsFit(box, sel, boxSel) {
      return $$(sel, box).every(function (el) {
        var room = el.closest(boxSel), cs = getComputedStyle(el), rs = getComputedStyle(room);
        var avail = room.clientWidth - parseFloat(rs.paddingLeft) - parseFloat(rs.paddingRight);
        if (!cv || avail <= 0) return true;
        cv.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
        var ls = parseFloat(cs.letterSpacing) || 0; // the canvas does not track: add the page's letter spacing per character
        return el.textContent.trim().split(/\s+/).every(function (w) { return cv.measureText(w).width + ls * w.length <= avail + 0.5; });
      });
    }
    function fit() {
      GROUPS.forEach(function (g) {
        $$(g[0]).forEach(function (box) {
          if (!box.offsetWidth) return; // hidden now; measured when it shows
          box.classList.remove('is-stack');
          if (!wordsFit(box, g[1], g[2])) box.classList.add('is-stack');
        });
      });
    }
    var tm = 0;
    function soon() { clearTimeout(tm); tm = setTimeout(fit, 120); }
    fit();
    window.addEventListener('resize', soon);
    window.addEventListener('load', soon);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(soon);
    var edit = $('#rsvpEdit');
    if (edit) edit.addEventListener('click', function () { setTimeout(fit, 0); });
    if ('ResizeObserver' in window) { // the text size can change after load (rotation, a zoom setting, late fonts)
      var ro = new ResizeObserver(soon);
      GROUPS.forEach(function (g) { $$(g[0] + ' ' + g[1]).forEach(function (el) { ro.observe(el); }); });
    }
    return { fit: soon };
  });

  // ------------------------------------------------------------------ safety net: a deployed page without a backend says so
  safe('demoNote', function () {
    if (API.mode === 'demo' && !LOCALHOST) {
      var preview = /[?&]demo\b/.test(location.search);
      $$('[data-demo-note]').forEach(function (el) {
        el.textContent = preview
          ? '미리보기 모드예요 · 남기신 내용은 이 기기에만 저장됩니다.'
          : '아직 접수 준비 중이에요 · 잠시 후 다시 들러 주세요.';
        el.hidden = false;
      });
    }
    API.warmup();
  });

  function noop() {}
  window.AICC = {
    toast: toast, lockScroll: lockScroll, unlockScroll: unlockScroll, back: Back, restore: Restore, phase: PHASE,
    showResult: Game ? Game.show : noop, prefill: Game ? Game.prefill : noop, loadBoard: Game ? Game.loadBoard : noop,
    lightbox: Lightbox, closeSheet: Nav ? Nav.close : null, rsvp: Rsvp,
  };
  if (Reveal) Reveal.check(); // sections may have moved (wedding-day order)
})();
