/* Kit — small dependency-free helpers shared by every version.
 * Load after wedding-data.js (and js/photos-allowed.js if you use Kit.img / Kit.photo).
 */
(function () {
  'use strict';

  var W = window.WEDDING || {};
  var me = document.currentScript;
  // Site root = the folder above /shared/, so paths work from any page depth.
  var ROOT = me && me.src ? new URL('../', me.src).href : location.origin + '/';
  var ua = navigator.userAgent || '';
  var KST = 9 * 3600 * 1000;

  function photoEntry(id) {
    var list = window.PHOTOS || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  var Kit = {
    root: ROOT,
    ua: {
      kakao: /KAKAOTALK/i.test(ua),
      inApp: /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|DaumApps/i.test(ua),
      ios: /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
      android: /Android/i.test(ua),
    },
    reducedMotion: !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches),

    /** Escape text before putting it in innerHTML. Always use for guest-written content. */
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },

    // ------------------------------------------------------------ photos
    /** Absolute URL of a photo. size: 'sm' (640px) | 'md' (1280px) | 'lg' (2048px). */
    photo: function (id, size) {
      var e = photoEntry(id);
      return e ? ROOT + e.src[size || 'md'].url : '';
    },
    /** srcset string covering all sizes. */
    srcset: function (id) {
      var e = photoEntry(id);
      if (!e) return '';
      return ['sm', 'md', 'lg'].map(function (k) { return ROOT + e.src[k].url + ' ' + e.src[k].w + 'w'; }).join(', ');
    },
    photoInfo: photoEntry,
    /**
     * Ready-to-insert <img>: lazy, async-decoded, responsive, cropped around the couple's faces.
     * opts: {sizes, eager, className, alt}
     */
    img: function (id, opts) {
      opts = opts || {};
      var e = photoEntry(id);
      var el = document.createElement('img');
      if (!e) return el;
      // src last: WebKit starts a fetch as each attribute is set, so a lazy image set up the other way round downloads at
      // once, often in several sizes (13 MB on first open against 1 MB).
      if (!opts.eager) el.loading = 'lazy';
      el.decoding = 'async';
      el.width = e.src.md.w;
      el.height = e.src.md.h;
      el.alt = opts.alt != null ? opts.alt : e.alt;
      el.sizes = opts.sizes || '(min-width: 600px) 480px, 100vw';
      el.srcset = Kit.srcset(id);
      el.src = ROOT + e.src.md.url;
      el.style.objectPosition = e.focal[0] + '% ' + e.focal[1] + '%';
      if (opts.className) el.className = opts.className;
      return el;
    },

    // ------------------------------------------------------------ clipboard & share
    /** Copy text; works in KakaoTalk/iOS in-app browsers too. Resolves true/false. */
    copy: function (text) {
      function legacy() {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px;';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, text.length);
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        return ok;
      }
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacy(); });
      }
      return Promise.resolve(legacy());
    },

    /** The couple in this visit's order ([first, second]): index.html draws it once per visit, html.ord-bf = the bride first. */
    couple: function () {
      return document.documentElement.classList.contains('ord-bf') ? [W.bride, W.groom] : [W.groom, W.bride];
    },

    /** Native share sheet when available, otherwise copy the link. Resolves 'shared' | 'copied' | 'failed'. */
    share: function (o) {
      o = o || {};
      var url = o.url || (window.WEDDING_CONFIG && WEDDING_CONFIG.siteUrl) || location.href;
      var data = {
        title: o.title || (Kit.couple()[0].first + ' ♥ ' + Kit.couple()[1].first + ' 결혼합니다'),
        text: o.text || W.date.ko + ' · ' + W.venue.name,
        url: url,
      };
      if (navigator.share && !Kit.ua.kakao) {
        return navigator.share(data).then(function () { return 'shared'; }, function (err) {
          return err && err.name === 'AbortError' ? 'cancelled' : Kit.copy(url).then(function (ok) { return ok ? 'copied' : 'failed'; });
        });
      }
      return Kit.copy(url).then(function (ok) { return ok ? 'copied' : 'failed'; });
    },

    /**
     * TMAP has no web link. Android: an intent: link, which opens the Play Store by itself when TMAP is missing.
     * iOS: try the app; if the page never lost focus within 2 s, ASK before leaving for the App Store (an automatic
     * jump could replace the invitation while iOS is still showing its own "Open in TMAP?" sheet).
     * Returns false on desktop (hide the TMAP button there: `if (!Kit.ua.ios && !Kit.ua.android)`).
     */
    openTmap: function () {
      var links = W.mapLinks || {};
      if (!Kit.ua.ios && !Kit.ua.android) return false;
      if (Kit.ua.android) {
        location.href = 'intent:' + links.tmap.replace(/^tmap:/, '') + '#Intent;scheme=tmap;package=com.skt.tmap.ku;' +
          'S.browser_fallback_url=' + encodeURIComponent(links.tmapStore.android) + ';end';
        return true;
      }
      var left = false;
      var mark = function () { left = true; };
      var onVis = function () { if (document.hidden) left = true; };
      window.addEventListener('blur', mark);
      window.addEventListener('pagehide', mark);
      document.addEventListener('visibilitychange', onVis);
      setTimeout(function () {
        window.removeEventListener('blur', mark);
        window.removeEventListener('pagehide', mark);
        document.removeEventListener('visibilitychange', onVis);
        if (!left && !document.hidden && window.confirm('티맵 앱이 열리지 않았어요. 설치 페이지로 이동할까요?')) {
          location.href = links.tmapStore.ios;
        }
      }, 2000);
      location.href = links.tmap;
      return true;
    },

    /** Open a URL in the phone's default browser when inside KakaoTalk; normal navigation elsewhere. */
    openExternal: function (url) {
      if (Kit.ua.kakao) location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url);
      else window.open(url, '_blank', 'noopener');
    },

    // ------------------------------------------------------------ dates
    /** Countdown to the ceremony, measured in Korea time regardless of the device's time zone. */
    dday: function (now) {
      var target = new Date(W.date.iso).getTime();
      var t = now != null ? +now : Date.now();
      var ms = target - t;
      var dayOf = function (x) { return Math.floor((x + KST) / 86400000); };
      var days = dayOf(target) - dayOf(t);
      var abs = Math.abs(ms);
      return {
        ms: ms,
        days: days,                 // calendar days: 0 on the wedding day, negative afterwards
        label: days > 0 ? 'D-' + days : days === 0 ? 'D-DAY' : 'D+' + (-days),
        d: Math.floor(abs / 86400000),
        h: Math.floor(abs / 3600000) % 24,
        m: Math.floor(abs / 60000) % 60,
        s: Math.floor(abs / 1000) % 60,
        passed: ms <= 0,
      };
    },

    /** The month of the wedding as weeks of day numbers (null = blank cell), Sunday first. */
    calendarMonth: function () {
      var y = W.date.year, m = W.date.month;
      var first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
      var len = new Date(Date.UTC(y, m, 0)).getUTCDate();
      var cells = [];
      for (var i = 0; i < first; i++) cells.push(null);
      for (var d = 1; d <= len; d++) cells.push(d);
      while (cells.length % 7) cells.push(null);
      var weeks = [];
      for (var j = 0; j < cells.length; j += 7) weeks.push(cells.slice(j, j + 7));
      return weeks;
    },

    calendar: {
      /** Google Calendar "add event" link. */
      google: function () {
        var start = new Date(W.date.iso).getTime();
        var fmt = function (t) { return new Date(t).toISOString().replace(/[-:]|\.\d{3}/g, ''); };
        var p = new URLSearchParams({
          action: 'TEMPLATE',
          text: W.groom.name + ' ♥ ' + W.bride.name + ' 결혼식',
          dates: fmt(start) + '/' + fmt(start + 2 * 3600 * 1000),
          location: W.venue.display + (W.venue.hall ? ' ' + W.venue.hall : '') + ', ' + (W.venue.addressJibun || W.venue.address),
          details: ((window.WEDDING_CONFIG && WEDDING_CONFIG.siteUrl) || location.href),
        });
        return 'https://calendar.google.com/calendar/render?' + p.toString();
      },
      /** Static .ics file (opens the native calendar on iOS/Android/desktop). */
      ics: ROOT + 'assets/wedding.ics',
    },

    // ------------------------------------------------------------ misc
    /** '01012345678' -> '010-1234-5678'; '+82 10-…' or '0082 10-…' -> '010-…'. A number from abroad ('+44 …', '0044 …')
     *  keeps its digits, up to 15, after a '+'. Runs on every keystroke, so a bare '+82' stays as typed. */
    formatPhone: function (v) {
      var s = String(v || ''), d = s.replace(/\D/g, ''), intl = /^\s*\+/.test(s);
      if (/^00[1-9]/.test(d)) { d = d.slice(2); intl = true; } // 0044 … is +44 …
      if (intl ? d.indexOf('82') === 0 : /^82[1-9]/.test(d) && d.length >= 11) {
        d = d.slice(2);
        if (!d) return '+82';
        if (d.charAt(0) !== '0') d = '0' + d;
      } else if (d.charAt(0) !== '0') return (intl ? '+' : '') + d.slice(0, 15); // no Korean grouping abroad
      d = d.slice(0, 11);
      var head = d.indexOf('02') === 0 ? 2 : 3;
      if (d.length <= head) return d;
      var rest = d.slice(head);
      // 10-digit numbers split 3-3-4 (or 2-4-4 for Seoul), 11-digit numbers 3-4-4.
      var mid = rest.length > 7 ? 4 : rest.length === 7 ? 3 : Math.min(4, rest.length);
      return [d.slice(0, head), rest.slice(0, mid), rest.slice(mid)].filter(Boolean).join('-');
    },

    /** '방금 전', '3분 전', '2시간 전', '5일 전', or 'M월 D일'. */
    timeAgo: function (iso) {
      var t = new Date(iso).getTime();
      if (isNaN(t)) return '';
      var s = Math.max(0, (Date.now() - t) / 1000);
      if (s < 60) return '방금 전';
      if (s < 3600) return Math.floor(s / 60) + '분 전';
      if (s < 86400) return Math.floor(s / 3600) + '시간 전';
      if (s < 86400 * 7) return Math.floor(s / 86400) + '일 전';
      var d = new Date(t + KST);
      return (d.getUTCMonth() + 1) + '월 ' + d.getUTCDate() + '일';
    },

    /** Run cb(el) once when el scrolls into view (immediately if IntersectionObserver is missing). */
    onVisible: function (el, cb, rootMargin) {
      if (!('IntersectionObserver' in window)) { cb(el); return; }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { io.unobserve(en.target); cb(en.target); } });
      }, { rootMargin: rootMargin || '0px 0px -10% 0px' });
      io.observe(el);
    },
  };

  // Inside KakaoTalk, calendar links open in the phone's own browser: the in-app browser cannot hand an .ics file
  // to the Calendar app, and Google Calendar would ask guests to sign in again.
  if (Kit.ua.kakao) {
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      if (a.href === Kit.calendar.ics || a.href.indexOf('https://calendar.google.com/') === 0) {
        e.preventDefault();
        Kit.openExternal(a.href);
      }
    }, true);
  }

  window.Kit = Kit;
})();
