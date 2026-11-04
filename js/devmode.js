/* devmode.js — AI-CC 2026 (v1-conf) · 개발자 모드 / view source. Self-contained.
 * Injects a </> tab per section, a switch in the "☰ 전체" sheet and in the footer, and an exit pill. Every source face
 * is built from WEDDING / Kit / WeddingAPI / SVMCore and live state, never from page text. #gift never flips. */
(function () {
  'use strict';
  var W = window.WEDDING, K = window.Kit, A = window.WeddingAPI || {};
  if (!W || !K || window.AICCDev || !document.querySelector) return;
  var D = document, HTML = D.documentElement, RM = !!K.reducedMotion, NB = '\u00a0';
  var LOCAL = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname);
  var NAMES = { top: '표지', cfp: '초대의 글', dates: '예식 일시', venue: '오시는 길', gift: '마음 전하실 곳', rsvp: '참석 여부',
    speakers: '신랑·신부', gallery: '갤러리', reviews: '축하 리뷰', challenge: '미니 게임', closing: '감사 인사' };
  var Y = W.date.year, PID = String(W.date.month) + pad(W.date.day), TITLE = 'Attendance Is All We Need'; // No. 1219, the cover's issue
  var I_BACK = svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'), I_PLAY = svg('<path d="M7 4.5v15l12-7.5z"/>');

  function svg(p) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>'; }
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function mk(tag, cls, html) { var e = D.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  /** One line of data or guest text: no token delimiters, single spaces, optional length cap. */
  function clean(s, n) {
    s = String(s == null ? '' : s).replace(/`/g, "'").replace(/\s+/g, ' ').trim();
    return n && s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
  function q(s) { return '`s|"' + clean(s) + '"`'; }
  function cm(s) { return '`c|' + String(s).replace(/`/g, "'").replace(/^(#|\/\/|%) /, '$1' + NB) + '`'; } // "#" never dangles at a line end
  function hit(a, b, m) { return a.left < b.right + m && a.right > b.left - m && a.top < b.bottom + m && a.bottom > b.top - m; }
  function shown(e) { return !!(e && e.getClientRects().length); }
  function toast(m) {
    if (window.AICC && typeof AICC.toast === 'function') return AICC.toast(m);
    var t = $('#dmToast') || D.body.appendChild(mk('div', 'dm-exit'));
    t.id = 'dmToast'; t.setAttribute('role', 'status'); t.style.cssText = 'z-index:210;bottom:96px;pointer-events:none';
    t.textContent = m; t.hidden = false;
    clearTimeout(t.tm); t.tm = setTimeout(function () { t.hidden = true; }, 2400);
  }

  // ---------------------------------------------------------------- a tiny highlighter: `k|token` spans, coloured punctuation, all escaped
  var TOK = /`(\w+)\|([^`]*)`/g, OPS = /([{}[\]()=,:;|<>$*.]+)/;
  function plain(t) { return t.split(OPS).map(function (x, i) { return i % 2 ? '<span class="dm-o">' + esc(x) + '</span>' : esc(x); }).join(''); }
  function hl(src) {
    var out = '', last = 0, m;
    src = keep(String(src)); TOK.lastIndex = 0;
    while ((m = TOK.exec(src))) { out += plain(src.slice(last, m.index)) + '<span class="dm-' + m[1] + '">' + esc(m[2]) + '</span>'; last = TOK.lastIndex; }
    return (out + plain(src.slice(last))).replace(pairs(), '<span class="nb">$1</span>');
  }
  /** Code lines wrap like an editor's, but fixed phrases stay together, as on the front (app.js glue / textInto /
   *  addressInto): a date, a time, a one-syllable numeral or determiner and its noun ("두 사람", "한 세션", "내 길": cut
   *  off, "두" reads as the verb 두다), "참석 여부" and an "&" pair get no-break spaces; "신랑·신부" and the address's last
   *  two words ("소공동 1") a span.nb, so the address keeps its real space. */
  var KEEP = [[/(\d+월) (\d+일)/g, '$1' + NB + '$2'], [/(오전|오후) (\d+시)/g, '$1' + NB + '$2'], [/(\d+시) (\d+분)/g, '$1' + NB + '$2'],
    [/(^|[^가-힣])(한|두|세|네|새|첫|몇|각|온|내|옛|맨) (?=[가-힣])/g, '$1$2' + NB], [/참석 여부/g, '참석' + NB + '여부'],
    [/(\w) & (?=\w)/g, '$1' + NB + '&' + NB]], PAIRS = null;
  function keep(s) { KEEP.forEach(function (k) { s = s.replace(k[0], k[1]); }); return s; }
  function pairs() {
    if (!PAIRS) {
      var v = W.venue || {}, tails = [v.addressJibun, v.addressRoad, v.address].map(function (a) {
        a = clean(a).split(' ');
        return a.length > 1 ? a.slice(-2).join(' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
      }).filter(Boolean);
      PAIRS = new RegExp('(' + ['신랑·신부'].concat(tails).join('|') + ')', 'g');
    }
    return PAIRS;
  }
  /** Lines: markup strings (leading spaces = hanging indent) or {h: trusted html, i: indent, c: class}; null is skipped. */
  function code(list) {
    var n = 0;
    return '<ol class="dm-code">' + list.filter(function (l) { return l != null; }).map(function (l) {
      var o = typeof l === 'string' ? { s: l } : l, s = o.s, i = o.i || 0;
      if (s != null) { i += /^ */.exec(s)[0].length; s = s.trim(); }
      return '<li' + (o.c ? ' class="' + o.c + '"' : '') + ' style="--i:' + i + ';--n:' + (n++) + '">' + (o.h != null ? o.h : hl(s)) + '</li>';
    }).join('') + '</ol>';
  }
  function run(act, src) { return { c: 'dm-li-run', h: '<button type="button" class="dm-run" data-dm="' + act + '">' + hl(src) + '</button>' }; }
  /** A runnable line that is a real link (https, so it never dead-ends in the KakaoTalk in-app browser). */
  function link(href, src) { return { c: 'dm-li-run', h: '<a class="dm-run" href="' + esc(href) + '" target="_blank" rel="noopener">' + hl(src) + '</a>' }; }
  function editor(f) {
    return '<div class="dm-ed"><div class="dm-bar"><span class="dm-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="dm-file">' + esc(f.file) +
      '</span><button type="button" class="dm-front" data-dm="front">' + I_BACK + '청첩장 보기</button></div><div class="dm-body">' + code(f.lines) + (f.after || '') +
      '</div><div class="dm-foot"><span>' + esc(f.foot[0]) + '</span><span>' + esc(f.foot[1]) + '</span></div>' +
      '<button type="button" class="dm-front dm-front--foot" data-dm="front">' + I_BACK + '청첩장 보기</button></div>';
  }
  function wd(ymd) { return '일월화수목금토'.charAt(new Date(ymd + 'T12:00:00+09:00').getUTCDay()); }
  /** The live countdown: the D-label is the only day count (calendar days, like the desktop index's D-label), the clock
   *  runs in hours ("D-51 · 1219:57:29 남음", never "D-51 · 50일 …" with a second, different count of days). */
  function cd(d) {
    if (!d.passed) return d.label + ' · ' + pad(Math.floor(d.ms / 3600000)) + ':' + pad(d.m) + ':' + pad(d.s) + ' 남음';
    if (d.days !== 0) return d.label + ' · 결혼한 지 ' + (-d.days) + '일 ♥';
    return d.ms > -2 * 3600000 ? 'D-DAY · 예식이 시작되었어요 ♥' : 'D-DAY · 두 사람이 부부가 되었어요 ♥'; // 20:00, as the front
  }
  /** The front's phases (app.js): 'evening' from the ceremony (18:00), 'after' (Published, past tense) from 20:00. */
  function phase() {
    if (window.AICC && AICC.phase) return AICC.phase;
    var ms = K.dday().ms;
    return ms > 0 ? 'before' : ms > -2 * 3600000 ? 'evening' : 'after';
  }
  /** cover.tex follows the cover itself, which turns to Published live at 20:00 (js/cover.js sets its data-phase). */
  function coverPhase() { var c = D.getElementById('top'); return (c && c.getAttribute('data-phase')) || phase(); }

  // ---------------------------------------------------------------- the source of each section
  /** The journal cover (nurture): its masthead and issue line, the cover line as the title, the facts, the decision. */
  function gTop() {
    var d = K.dday(), v = W.venue, pub = coverPhase() === 'after';
    return { file: 'cover.tex', foot: ['LaTeX · pdfTeX', pub ? '✓ published' : '✓ 0 errors · 0 warnings'], lines: [
      cm('% cover.tex · nurture · AI-CC ' + Y + ' Special Issue'),
      '`k|\\documentclass`[final]{aicc' + Y + '}', '',
      '`k|\\journal`{`b|nurture`}  ' + cm('% The Journal of Growing Together'),
      '`k|\\volume`{`n|1`}  `k|\\number`{`n|' + PID + '`}  ' + cm('% ' + W.date.day + ' ' + MONTH_EN[W.date.month - 1] + ' ' + Y),
      '`k|\\title`{`b|' + TITLE + '`}',
      cm('% cf. Vaswani et al., 2017 · attention 말고 attendance'),
      '`k|\\author`{' + clean(K.couple()[0].name) + ' `k|\\and` ' + clean(K.couple()[1].name) + '}',
      W.story && W.story.now ? '`k|\\affiliation`{' + clean(W.story.now) + '}' : null,
      '`k|\\date`{' + clean(W.date.ko) + '}',
      '`k|\\venue`{' + clean(v.name + (v.hall ? ' ' + v.hall : '')) + '}',
      v.formerName ? cm('% (구 ' + v.formerName + ')') : null,
      '`k|\\access`{open}  ' + cm('% Open Access'),
      '`k|\\decision`{`ok|' + (pub ? 'Published' : 'Accepted') + '`}  ' + cm('% ' + d.label), '',
      '`k|\\begin`{document}', '  `k|\\maketitle`', '`k|\\end`{document}', '',
      '$ `f|pdflatex` cover.tex',
      cm('Output written on cover.pdf (1 page, ' + PID + ' bytes).'),
      { h: '<span class="dm-pdf" aria-hidden="true"><small>nurture · No. ' + PID + '</small><b>' + TITLE + '</b><span>' + esc(K.couple()[0].name + ' · ' + K.couple()[1].name) +
        '</span><i></i><i></i><i></i><em>' + esc(Y + '. ' + W.date.month + '. ' + W.date.day + '.') + '</em></span>' },
    ] };
  }

  function gCfp() {
    var g = W.groom, b = W.bride, me = A.myRSVP && A.myRSVP(), who = me && me.attending === 'yes' && me.name ? clean(me.name, 16) : '하객';
    var L = [cm('# invitation.py · Call for Participation'), '`s|"""`'];
    (W.greeting || []).forEach(function (l) { L.push(l ? '`s|' + clean(l) + '`' : ''); });
    return { file: 'invitation.py', foot: ['Python 3', '♥ 2 families · 1 promise'], lines: L.concat([
      '`s|"""`', '',
      'GENERAL_CHAIRS = [  ' + cm('# 혼주'),
      '    ' + q(g.father + ' · ' + g.mother + '의 ' + g.order + ' ' + g.first) + ',',
      '    ' + q(b.father + ' · ' + b.mother + '의 ' + b.order + ' ' + b.first) + ',',
      ']', '',
      '`k|def` `f|attend`(guest):  ' + cm('# attendance is all we need'),
      '    `k|return` `k|f``s|"{guest}님, 귀한 걸음 기다리겠습니다"`', '',
      '>>> `f|attend`(' + q(who) + ')',
      '`s|\'' + who + '님, 귀한 걸음 기다리겠습니다\'`',
    ]) };
  }

  var MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  /** `cal` output for the wedding month (the same calendar as the date card): the day boxed, Sundays and the 25th red.
   *  One block of 20 mono columns that never wraps; fitCal() shrinks it to the editor on tiny screens with huge text. */
  function calBlock() {
    var d = W.date, weeks = K.calendarMonth ? K.calendarMonth() : [], head = MONTH_EN[d.month - 1] + ' ' + d.year, rows = [];
    if (!weeks.length) return null;
    rows.push(esc(new Array(Math.max(1, Math.floor((20 - head.length) / 2)) + 1).join(' ') + head));
    rows.push('<span class="dm-s">Su</span> Mo Tu We Th Fr Sa');
    weeks.forEach(function (w) {
      rows.push(w.map(function (x, i) {
        var t = x ? (x < 10 ? ' ' : '') + x : '  ';
        if (x && x === d.day) return '<span class="dm-cal-on">' + t + '</span>';
        return x && (i === 0 || (d.month === 12 && x === 25)) ? '<span class="dm-s">' + t + '</span>' : t;
      }).join(' ').replace(/\s+$/, ''));
    });
    return { c: 'dm-li-cal', h: '<span class="dm-cal" role="img" aria-label="' + esc(d.year + '년 ' + d.month + '월 달력, ' + d.day + '일 표시') + '">' + rows.join('\n') + '</span>' };
  }
  function fitCal(back) {
    $$('.dm-cal', back).forEach(function (c) {
      c.style.zoom = '';
      if (!('zoom' in c.style)) return; // no CSS zoom: the block scrolls sideways instead
      for (var z = 1, i = 0; i < 4 && c.scrollWidth > c.clientWidth + 1; i++) { // both are in the block's own (zoomed) units
        z = Math.max(0.5, z * c.clientWidth / c.scrollWidth * 0.98);
        c.style.zoom = z.toFixed(3);
      }
    });
  }
  function gDates() {
    var d = W.date, day = d.iso.slice(0, 10), t = pad(d.hour) + ':' + pad(d.minute), dl = W.rsvp && W.rsvp.deadline, g = K.calendar && K.calendar.google;
    function col(x, n) { x = String(x); while (x.length < n) x += ' '; return x; }
    return { file: 'date.cron', foot: ['crontab · KST', d.dot || day], lines: [
      cm('# date.cron · Important Dates'),
      'CRON_TZ=`s|Asia/Seoul`',
      cm('# m  h   dom mon dow  command'),
      '  `n|' + col(d.minute, 3) + col(d.hour, 4) + col(d.day, 4) + col(d.month, 4) + '`*    `f|wedding` --with ' + q(K.couple()[0].first + '♥' + K.couple()[1].first),
      cm('# 매년 이날 이 시간, 평생 반복 실행됩니다'), '',
      '$ `f|date` -d `n|@' + Math.floor(Date.parse(d.iso) / 1000) + '` `s|+"%F %R %Z"`',
      day + ' ' + t + ' KST  ' + cm('# ' + d.ko), '',
      '$ `f|cal` ' + d.month + ' ' + d.year, calBlock(), '',
      '$ `f|./countdown` --live',
      { c: 'dm-li-hl', h: '<span class="dm-ok" data-dm-live="cd">' + esc(cd(K.dday())) + '</span>' }, '',
      '$ `f|cat` schedule.txt',
      dl ? dl + ' (' + wd(dl) + ')  참석 여부 회신 마감' : null,
      day + ' (' + wd(day) + ')  ' + t + ' 본식 (Main)',
      day + ' (' + wd(day) + ')  시상 (Best Reviewer · 미니 게임 1위)', '',
      { c: 'dm-li-run', h: '<a class="dm-run" href="' + esc(K.calendar && K.calendar.ics) + '">' + hl('$ `f|open` wedding.ics  ' + cm('# 휴대폰 캘린더에 추가')) + '</a>' },
      typeof g === 'function' ? { c: 'dm-li-run', h: '<a class="dm-run" href="' + esc(g()) + '" target="_blank" rel="noopener">' + hl('$ `f|open` calendar.google.com  ' + cm('# Google 캘린더에 추가')) + '</a>' } : null,
    ] };
  }

  function addr() { return W.venue.addressJibun || W.venue.address || ''; }
  function gVenue() {
    var v = W.venue, dr = W.directions || {}, nm = v.name.replace(/\s/g, ''), ji = addr(), road = v.addressRoad || v.address;
    var L = [cm('# location.sh · Venue & Travel')];
    L.push('$ `f|whereis` ' + nm, v.formerName ? cm('# (구 ' + clean(v.formerName) + ')') : null,
      '`p|주소`    ' + clean(ji), road && road !== ji ? '`p|도로명`  ' + clean(road) : null,
      v.hall ? '`p|예식홀`  ' + clean(v.hall) : null, v.tel ? '`p|전화`    ' + clean(v.tel) : null,
      '`p|좌표`    `n|' + (+v.lat).toFixed(5) + ', ' + (+v.lng).toFixed(5) + '`',
      run('copy', '$ `f|pbcopy` <<< ' + q(ji) + '  ' + cm('# 주소 복사')));
    ['subway', 'train', 'bus', 'car'].forEach(function (k) {
      if (!(dr[k] || []).length) return;
      L.push('', '$ `f|route` `a|--' + k + '`');
      dr[k].forEach(function (x) { L.push('  ' + clean(x)); });
    });
    if (dr.note) L.push('', cm('# ' + dr.note));
    var ml = W.mapLinks || {};
    if (ml.naver || ml.kakao) L.push('');
    var nv = (K.ua.ios || K.ua.android) && ml.naverMobile || ml.naver; // phones: the place page, never an app-install wall
    if (nv) L.push(link(nv, '$ `f|open` ' + nv.split('/')[2] + '  ' + cm('# 네이버 지도에서 보기')));
    if (ml.kakao) L.push(link(ml.kakaoRoute || ml.kakao, '$ `f|open` map.kakao.com  ' + cm('# 카카오맵으로 길찾기')));
    L.push('', '$ `f|ping` ' + nm, { h: hl('64 bytes from ' + clean(ji).split(' ').slice(-2).join(' ') + ': time=') +
      '<span class="dm-n" data-dm-live="dday">' + esc(K.dday().label) + '</span>' });
    return { file: 'location.sh', foot: ['bash', (+v.lat).toFixed(4) + '°N, ' + (+v.lng).toFixed(4) + '°E'], lines: L };
  }

  // rsvp.http — built once (it keeps what the guest typed), sent through WeddingAPI.submitRSVP. `edit`: it holds the
  // front's unsent edit (handOver), made against the saved answer of time `from`.
  var R = { att: null, side: '', name: '', phone: '', msg: '', dirty: false, busy: false, edit: false, from: null };
  function rsvpFrom() {
    var m = !R.dirty && A.myRSVP && A.myRSVP();
    if (!m) return false;
    R.att = m.attending === 'yes' ? true : m.attending === 'no' ? false : null;
    R.side = m.side || ''; R.name = m.name || ''; R.phone = m.phone ? K.formatPhone(/^[1-9]/.test(m.phone) && String(m.phone).indexOf('82') !== 0 ? '+' + m.phone : m.phone) : ''; R.msg = m.message || '';
    return true;
  }
  function apiUrl() {
    var u = String((window.WEDDING_CONFIG && WEDDING_CONFIG.apiUrl) || '').trim();
    try { if (LOCAL) u = new URLSearchParams(location.search).get('api') || u; return u ? new URL(u, location.href) : null; } catch (e) { return null; }
  }
  function tok(k, v, label) {
    return '<button type="button" class="dm-tok" role="radio" data-dm="' + k + '" data-v="' + v + '" aria-checked="' +
      (k === 'att' ? R.att === (v === 'true') : R.side === v) + '">' + label + '</button>';
  }
  function inp(k, type, ph, label, max, extra) {
    return hl('`s|"`') + '<input class="dm-in" data-k="' + k + '" type="' + type + '" maxlength="' + max + '" placeholder="' + ph + '" aria-label="' + label +
      '" value="' + esc(R[k]) + '"' + (extra || '') + '>' + hl('`s|"`');
  }
  /** The front closes registration from the ceremony on (#rsvpClosed shows); then the source is read-only too. */
  function rsvpClosed() {
    var c = D.getElementById('rsvpClosed');
    return c ? !c.hidden : K.dday().passed;
  }
  function gRsvpClosed() {
    var me = A.myRSVP && A.myRSVP();
    return { file: 'rsvp.http', foot: ['HTTP · JSON', 'closed · ' + (W.date.dot || W.date.iso.slice(0, 10))], lines: [
      cm('# rsvp.http · Registration'),
      '`k|POST` `f|/rsvp` HTTP/1.1', '',
      '`err|HTTP/1.1 410 Gone`', '{',
      '  `p|"ok"`: `k|false`,',
      '  `p|"message"`: ' + q('참석 여부 접수를 마감했습니다') + ',',
      me && me.name ? '  `p|"yours"`: { `p|"name"`: ' + q(clean(me.name, 20)) + ', `p|"attending"`: `k|' + (me.attending === 'yes') + '` },' : null,
      '  `p|"thanks"`: ' + q('함께 축하해 주신 모든 분께 진심으로 감사드립니다'),
      '}', '', cm('// 축하 리뷰(방명록)는 언제든 남기실 수 있어요'),
    ] };
  }
  function gRsvp() {
    if (rsvpClosed()) return gRsvpClosed();
    var had = rsvpFrom(), u = apiUrl(), live = A.mode === 'live' && u, path = live ? u.pathname : '/rsvp';
    if (path.length > 22) path = path.split('/').slice(0, 3).join('/') + '/…/' + path.split('/').pop();
    function ctl(h) { return { i: 4, c: 'dm-li-ctl', h: h }; }
    return { file: 'rsvp.http', foot: ['HTTP · JSON', live ? 'live · ' + u.host : 'demo · 이 브라우저에만 저장'], lines: [
      cm('# rsvp.http · Registration'),
      '`k|POST` `f|' + path + '` HTTP/1.1',
      '`p|Host`: ' + (live ? u.host : location.host || 'localhost'),
      '`p|Content-Type`: text/plain;charset=utf-8', '', '{',
      '  `p|"action"`: `s|"rsvp"`,',
      '  `p|"attending"`:',
      ctl('<span role="radiogroup" aria-label="참석 여부">' + tok('att', 'true', 'true') + hl(' | ') + tok('att', 'false', 'false') + '</span>' + hl(',')),
      '  `p|"name"`:', ctl(inp('name', 'text', '홍길동', '성함', 30, ' autocomplete="name"') + hl(',')),
      '  `p|"phone"`:', ctl(inp('phone', 'tel', '010-1234-5678', '연락처', 20, ' inputmode="tel" autocomplete="tel"') + hl(',')),
      '  `p|"side"`:',
      ctl('<span role="radiogroup" aria-label="신랑측 또는 신부측 (선택)">' + tok('side', 'groom', '"groom"') + hl(' | ') + tok('side', 'bride', '"bride"') + '</span>' + hl(',')),
      '  `p|"message"`:', ctl(inp('msg', 'text', '(선택)', '전하고 싶은 말 (선택)', 500)),
      '}',
    ], after: '<div class="dm-send"><button type="button" class="dm-btn" data-dm="send">' + I_PLAY + 'Send Request</button></div><div class="dm-out" id="dmRsvpOut" aria-live="polite">' +
      hl(cm(had ? '// 이미 응답하셨어요 · 고쳐서 다시 보내셔도 돼요' : '// Send Request를 누르면 응답이 여기에 표시돼요')) + '</div>' };
  }
  function rsvpSync(back) { // the guest may have answered on the front since the last flip, or an edit moved in
    rsvpFrom();
    $$('.dm-in', back).forEach(function (i) { i.value = R[i.getAttribute('data-k')] || ''; });
    rsvpToks(back);
  }
  /* rsvp.http and the front's RSVP edit (app.js, AICC.rsvp) hold one unsent edit between them. Flipping 참석 여부 over an
     open edit ends the edit and moves its values here, so no edit stays open behind this face, where the next Back
     would close it unseen and drop what was typed. Flipping back opens the edit again with what rsvp.http holds by
     then, unless it was sent from here, or is on its way (then the front shows the answer card, as after any send). */
  var rearm = null;
  function handOver(back) {
    var F = window.AICC && AICC.rsvp, m = A.myRSVP && A.myRSVP(), r;
    if (!F) return;
    if (back) {
      if (!(r = F.take(!H.on))) return; // no entry of ours yet: it goes on top next, and the edit's stays under it
      R.att = r.attending === 'yes' ? true : r.attending === 'no' ? false : null;
      R.side = r.side; R.name = r.name; R.phone = r.phone; R.msg = r.message;
      R.dirty = R.edit = true; R.from = m && m.at;
    } else if (R.edit && !R.busy) {
      R.edit = R.dirty = false;
      if (m && m.at === R.from) { // else an answer was saved since (a front send still on its way): the card shows it
        rearm = F.give({ name: R.name, phone: R.phone, attending: R.att === true ? 'yes' : R.att === false ? 'no' : '', side: R.side, message: R.msg });
      }
    }
  }
  /** The edit given back to the front gets its Back entry once our own step back (if any) has landed. */
  function rearmed() { var f = rearm; rearm = null; if (f) f(); }
  function rsvpToks(back) {
    $$('.dm-tok', back).forEach(function (b) {
      var v = b.getAttribute('data-v');
      b.setAttribute('aria-checked', String(b.getAttribute('data-dm') === 'att' ? R.att === (v === 'true') : R.side === v));
    });
  }
  function rsvpOut(no, body, extra) {
    var o = $('#dmRsvpOut'), h = hl({ 0: cm('// 보내는 중…'), 201: '`ok|HTTP/1.1 201 Created`', 422: '`err|HTTP/1.1 422 Unprocessable Entity`' }[no] || '`err|HTTP/1.1 503 Service Unavailable`');
    if (!o) return;
    if (body) h += '\n' + hl('{') + '\n' + Object.keys(body).map(function (k) { var v = body[k]; return '  ' + hl('`p|"' + k + '"`: ' + (typeof v === 'boolean' ? '`k|' + v + '`' : q(v))); }).join(hl(',') + '\n') + '\n' + hl('}');
    o.innerHTML = h + (extra || '');
  }
  function rsvpSend(btn) {
    if (R.busy) return;
    R.busy = btn.disabled = true;
    rsvpOut(0);
    // a corrected number names the answer it replaces, as the front's edit does (api.js drops it when unchanged)
    var prev = (A.myRSVP && A.myRSVP()) || {};
    A.submitRSVP({ name: R.name, phone: R.phone, attending: R.att === null ? '' : R.att, side: R.side, message: R.msg, prevPhone: prev.phone }).then(function () {
      R.dirty = R.edit = false;
      // app.js may listen and refresh its own RSVP card; preventDefault() tells us it did
      var ev = null; try { ev = new CustomEvent('aicc:rsvp', { cancelable: true, detail: A.myRSVP && A.myRSVP() }); } catch (e) { /* old engine */ }
      var handled = ev ? !window.dispatchEvent(ev) : false;
      rsvpOut(201, { ok: true, message: R.att ? '참석 의사가 성공적으로 전달되었습니다.' : '알려 주셔서 감사합니다. 멀리서 보내 주시는 축하만으로도 큰 힘이 됩니다.' }, handled ? '' :
        '\n' + hl(cm('// 앞면의 응답 카드는 새로고침하면 반영돼요')) + '<button type="button" class="dm-run" data-dm="reload">' + hl('location.`f|reload`()') + '</button>');
    }, function (e) {
      rsvpOut(e && e.code === 'invalid' ? 422 : 503, { ok: false, error: (e && e.message) || '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.' });
    }).then(function () { R.busy = btn.disabled = false; });
  }

  function gSpeakers() {
    var L = [cm('// speakers.json · Keynote Speakers'), '['];
    (K.couple()[0] === W.groom ? [['신랑', W.groom], ['신부', W.bride]] : [['신부', W.bride], ['신랑', W.groom]]).forEach(function (p, i) {
      L.push('  { `p|"role"`: ' + q(p[0]) + ', `p|"name"`: ' + q(p[1].name) + ',', '    `p|"en"`: ' + q(p[1].en) + ',',
        { i: 4, h: hl('`p|"homepage"`: ') + '<a class="dm-s" href="' + esc(p[1].homepage) + '" target="_blank" rel="noopener">"' + esc(p[1].homepage) + '"</a>' + hl(' }' + (i ? '' : ',')) });
    });
    var days = K.dday().days, when = W.date.month + '월 ' + W.date.day + '일';
    var session = days > 0 ? when + '엔 둘이서 한 세션' : days === 0 ? '오늘은 둘이서 한 세션' : when + ', 둘이서 한 세션';
    return { file: 'speakers.json', foot: ['JSON', '2 keynotes · 1 session'], lines: L.concat([']', '',
      cm('// ' + session)]) };
  }

  // gallery.py — the allowed photos as a tiny dataset.
  // The first three of each city are the thumbnails: photos only the gallery shows (its front is hidden meanwhile), never
  // the cover's h11, the closing's h17 or the desktop poster's h01 on the same screen.
  var SETS = null;
  function photoSets() {
    return SETS || (SETS = [['서울', '하늘공원 · golden hour', 'h09 h18 h03 h01 h17 h11 h00 h15 h16'], ['싱가포르', '마리나베이 · sunset', 's5 s8 s3 s6 s1 s2 s4'],
      ['시애틀', '가스 웍스 파크 · behind the scenes', 'w10 w00 w09 w21 w07 w13 w02 w06 w08 w18 w20 w11 w12']].map(function (a) {
      return { city: a[0], note: a[1], ids: a[2].split(' ').filter(function (id) { return K.photoInfo(id); }) };
    }));
  }
  function thumb(si, i, id, label) {
    var p = id && K.photoInfo(id);
    return '<button type="button" class="dm-thumb" data-dm="photo" data-set="' + si + '" data-i="' + i + '" aria-label="' + esc(p ? (p.alt || id) + ' · 크게 보기' : label) + '">' +
      (p ? '<img src="' + esc(K.photo(id, 'sm')) + '" alt="" loading="lazy" decoding="async" style="object-position:' + p.focal[0] + '% ' + p.focal[1] + '%">' : esc(label.split(' ')[0])) + '</button>';
  }
  function gGallery() {
    var sets = photoSets(), n = 0;
    sets.forEach(function (s) { n += s.ids.length; });
    var L = [cm('# gallery.py · Past Venues'), '`k|from` aicc.datasets `k|import` `f|Photos`', '',
      'ds = `f|Photos`(`s|"aicc-' + Y + '"`)', '>>> ds',
      'Photos(n=`n|' + n + '`, cities=[' + sets.map(function (s) { return q(s.city); }).join(', ') + '])'];
    sets.forEach(function (s, si) {
      if (!s.ids.length) return;
      var more = s.ids.length - 3;
      L.push('', '>>> ds.`f|filter`(city=' + q(s.city) + ')  ' + cm('# ' + s.note), { h: '<span class="dm-thumbs">' +
        s.ids.slice(0, 3).map(function (id, i) { return thumb(si, i, id); }).join('') + (more > 0 ? thumb(si, 3, '', '+' + more + ' ' + s.city + ' 사진 ' + more + '장 더 보기') : '') + '</span>' });
    });
    L.push('', cm('# 사진을 누르면 크게 볼 수 있어요'));
    return { file: 'gallery.py', foot: ['Python 3 · dataset', n + ' photos · ' + sets.length + ' cities'], lines: L };
  }

  // reviews.json + svm.py read live data at most every 30 s, and only once the guest opens them
  var RV = { t: 0 }, LB = { t: 0 };
  function fetchOnce(st, get, id, force) {
    if (st.busy || (!force && Date.now() - st.t < 30000 && (st.list || st.err))) return;
    st.busy = true;
    new Promise(function (ok) { ok(get()); }).then(function (l) { st.list = l || []; st.err = false; }, function () { st.err = true; }).then(function () {
      st.busy = false; st.t = Date.now();
      var s = byId(id);
      if (s && s.on) render(s);
    });
  }
  function gReviews() {
    fetchOnce(RV, function () { return A.listReviews({ limit: 200 }); }, 'reviews');
    var l = RV.list, k = l ? Math.min(l.length, 3) : 0;
    var L = [cm('// reviews.json · Official Reviews'), cm('// GET /forum?id=AICC' + Y + '-' + PID + ' (OpenReview 스타일)'), '{',
      '  `p|"venue"`: ' + q('AI-CC ' + Y + ' · Main Track') + ',',
      '  `p|"title"`: ' + q(TITLE) + ',',
      '  `p|"decision"`: ' + q(phase() === 'after' ? 'Published' : 'Accept (Oral)') + ',',
      '  `p|"num_reviews"`: ' + (l ? '`n|' + l.length + '`' : RV.err ? '`k|null`  ' + cm('// 불러오지 못했어요') : cm('/* 불러오는 중… */')) + ','];
    if (l) {
      L.push('  `p|"latest"`: [' + (k ? '' : '],  ' + cm('// 첫 리뷰를 기다리고 있어요')));
      l.slice(0, k).forEach(function (r, i) {
        L.push('    { `p|"reviewer"`: ' + q(clean(r.name, 20)) + ',', r.rating ? '      `p|"rating"`: ' + q(r.rating + (r.title ? ': ' + clean(r.title, 24) : '')) + ',' : null,
          '      `p|"summary"`: ' + q(clean(r.text, 46)) + ' }' + (i < k - 1 ? ',' : ''));
      });
      if (k) L.push('  ],');
    }
    L.push('  `p|"award"`: ' + q('Best Reviewer'), '}', '',
      run('reviews', '$ `f|curl` -s /forum | `f|jq` .num_reviews  ' + cm('# 다시 불러오기')));
    return { file: 'reviews.json', foot: ['JSON · OpenReview', l ? l.length + ' reviews' : '…'], lines: L };
  }
  function num(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function gSvm() {
    var C = window.SVMCore || {}, RD = C.ROUNDS || [], SH = C.SHARE, b = LB.list, blind = [], kernel = false;
    fetchOnce(LB, function () { return A.leaderboard(C.GAME_ID || 'v1-svm', { limit: 3 }); }, 'challenge');
    RD.forEach(function (r, i) { if (r && r.blind) blind.push(i + 1); if (r && r.kernel) kernel = true; });
    var L = [cm('# svm.py · Challenge Track · Human SVM'), '`k|import` numpy `k|as` np', '`k|from` sklearn.svm `k|import` `f|SVC`', '',
      'X, y = `f|guests`()  ' + cm('# ♥ = +1, ★ = −1'),
      cm('# hard margin: 한 분도 반대편에 앉으면 안 돼요'),
      'clf = `f|SVC`(kernel=`s|"linear"`, C=`n|1e6`)', 'clf.`f|fit`(X, y)', '',
      'aisle = `n|2` / np.linalg.`f|norm`(clf.coef_)',
      cm('# 마진 = 두 사람이 걸어갈 길의 폭 · 넓을수록 좋아요')];
    if (SH) L.push('', // the scoring rule of the game core, with its own shares
      '`k|def` `f|points`(M, you):  ' + cm('# 라운드 점수'),
      '    `k|if` you.wrong_side:  ' + cm('# 반대편 하객이 있으면'),
      '        `k|return` M*`n|' + SH.sep + '`*(`n|2`*you.seated - n)/n',
      '    r = you.aisle / aisle  ' + cm('# 내 길 ÷ SVM 길'),
      '    t = you.time_left  ' + cm('# 남은 시간 비율'),
      '    `k|return` M*(`n|' + SH.sep + '` + `n|' + SH.margin + '`*r**`n|6` + `n|' + SH.speed + '`*t)');
    if (RD.length) {
      L.push('', cm('# ' + RD.length + '라운드'));
      if (blind.length) L.push(cm('# ' + blind[0] + (blind.length > 1 ? '~' + blind[blind.length - 1] : '') + '라운드: double-blind (미리보기 없음)'));
      if (kernel) L.push(cm('# 마지막 판: kernel trick φ = (x, x²+y²)'));
      if (C.MAX_SCORE) L.push(cm('# 배점 ' + num(RD[0].max) + ' → ' + num(RD[RD.length - 1].max) + '점'), cm('# 합계 최대 ' + num(C.MAX_SCORE) + '점'));
    }
    if (W.contest && Date.now() > Date.parse(W.contest.gameCutoff)) L.push(cm('# 순위 마감 · 지금부터는 연습 모드예요'));
    L.push('', run('play', '>>> clf.`f|fit`(you)  ' + cm('# 직접 그어 보기')), '', '>>> `f|leaderboard`(top=`n|3`)');
    if (!b || !b.length) L.push(cm(!b ? (LB.err ? '# 순위를 불러오지 못했어요' : '# 불러오는 중…') : '# 아직 기록이 없어요 · 첫 SOTA의 주인공은?'));
    else b.slice(0, 3).forEach(function (r) { L.push('`n|' + r.rank + '`  ' + clean(r.name, 16) + '  `a|' + num(r.score) + '`' + (r.mine ? '  ' + cm('# ← 나') : '')); });
    return { file: 'svm.py', foot: ['Python 3 · scikit-learn', C.GAME_ID || 'v1-svm'], lines: L };
  }

  function gClosing() {
    var d = K.dday(), came = /^(evening|after)$/.test(phase());
    return { file: 'thanks.js', foot: ['JavaScript', '♥ forever'], lines: [
      cm('// thanks.js · Closing Ceremony'), '`k|export default` {',
      '  `p|message`: ' + q(came ? '와 주셔서, 축하해 주셔서 고맙습니다' : '끝까지 읽어 주셔서, 축하해 주셔서 고맙습니다') + ',',
      '  `p|from`: [' + q(K.couple()[0].first) + ', ' + q(K.couple()[1].first) + '],',
      W.story && W.story.metAt ? '  `p|metAt`: ' + q(W.story.metAt) + ',' : null,
      '  `p|license`: `s|"CC-FOREVER"`,  ' + cm('// CC = Campus Couple'),
      '  `p|dependencies`: [' + q('양가 가족') + ', ' + q('그리고 당신') + '],',
      d.passed ? { i: 2, h: hl('`p|married`: ') + '<span class="dm-s" data-dm-live="dday">' + esc(d.label) + '</span>' + hl(',') } : null,
      '};', '', cm('// 프레임워크 없이 HTML · CSS · vanilla JS로 만들었어요'),
      { c: 'dm-li-run', h: '<a class="dm-run" href="https://github.com/ai-cc-wedding" target="_blank" rel="noopener">' + hl(cm('// view-source: github.com/ai-cc-wedding ↗')) + '</a>' },
      run('share', '`f|share`(location.href)  ' + cm('// 청첩장 공유하기')),
    ] };
  }
  var GEN = { top: gTop, cfp: gCfp, dates: gDates, venue: gVenue, rsvp: gRsvp, speakers: gSpeakers, gallery: gGallery, reviews: gReviews, challenge: gSvm, closing: gClosing };

  // ---------------------------------------------------------------- injected UI (cheap; nothing above runs before first use)
  var S = [], global = false, baseTitle = D.title, SW = [], exitBtn = null, sheet = D.getElementById('navSheet');
  // The cover's first screen stays the invitation (a </> there, by the thumb, is easily tapped by mistake);
  // the speakers interlude and the footer would carry a lone tab in empty space, and the footer has the switch itself.
  var NO_TAB = { top: 1, speakers: 1, closing: 1 };
  function byId(id) { return S.filter(function (s) { return s.id === id; })[0]; }
  function secOf(el) { return S.filter(function (s) { return s.el.contains(el); })[0]; }
  function anyOn() { return global || S.some(function (s) { return s.on; }); }

  Object.keys(NAMES).forEach(function (id) {
    var e = D.getElementById(id);
    if (!e) return;
    var s = { id: id, el: e, name: NAMES[id], on: false, never: id === 'gift' }, head = null, k;
    S.push(s);
    e.classList.add('dm-sec');
    if (s.never) { // the accounts stay readable and usable, always
      e.classList.add('dm-never');
      e.appendChild(mk('p', 'dm-note', esc('/* 마음 전하실 곳은 소스 보기 없이 그대로 둡니다 */')));
      if (getComputedStyle(e).position === 'static') e.style.position = 'relative';
      return;
    }
    if (NO_TAB[id]) { // flips with the global switch only; its editor is centred like a corner section's
      e.classList.add('dm-corner');
      if (getComputedStyle(e).position === 'static') e.style.position = 'relative';
      return;
    }
    var t = s.tab = mk('button', 'dm-tab', '<span aria-hidden="true">&lt;/&gt;</span>');
    t.type = 'button'; t.title = '소스 보기 · view source';
    t.setAttribute('data-dm', 'tab'); t.setAttribute('aria-pressed', 'false'); t.setAttribute('aria-label', s.name + ' 소스 코드 보기');
    for (k = id === 'top' ? null : e.firstElementChild; k; k = k.nextElementSibling) if (k.matches('.sec-head, header')) { head = k; break; } // a cover always uses a corner
    var slot = $('[data-dev-slot]', e), m = /rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?/.exec(getComputedStyle(e).backgroundColor);
    if (slot) { s.slot = slot; slot.appendChild(t); }
    else if (head) { s.head = head; head.classList.add('dm-keep', 'dm-head'); head.appendChild(t); }
    else {
      e.classList.add('dm-corner'); t.classList.add('dm-keep'); t.setAttribute('data-corner', id === 'top' ? 'br' : 'tr'); e.appendChild(t);
      if (getComputedStyle(e).position === 'static') e.style.position = 'relative';
    }
    var dark = m && !(+m[4] < 0.5) && 0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3] < 115; // the navy cover, challenge band, footer
    if (slot || (dark && !head)) t.classList.add('dm-tab--glass'); else if (dark) t.classList.add('dm-tab--dark');
  });
  if (!S.length) return;

  function makeSwitch(dark, small) {
    var b = mk('button', 'dm-switch' + (dark ? ' dm-switch--dark' : ''), '<span class="dm-switch__l"><span>개발자 모드</span><small>' + esc(small || '</> 소스 코드로 보기') + '</small></span><span class="dm-track" aria-hidden="true"></span>');
    b.type = 'button'; b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', 'false'); b.setAttribute('data-dm', 'switch');
    SW.push(b);
    return b;
  }
  // In the "☰ 전체" sheet (a guest's way around the page) the switch sits apart in its own dashed box, labelled as an
  // extra for developer guests, so it never reads as one more section link.
  if (sheet) sheet.appendChild(makeSwitch(false, '개발자 하객용 · </> 소스 코드로 보기'));
  var closing = D.getElementById('closing');
  if (closing) {
    var row = mk('div', 'dm-switch-row'), colo = $('.colophon', closing);
    row.appendChild(makeSwitch(true, '개발자 하객용 · </> 소스 코드로 보기'));
    if (colo) colo.parentNode.insertBefore(row, colo.nextSibling);
    else { row.classList.add('dm-keep'); closing.appendChild(row); }
  }

  // ---------------------------------------------------------------- tab placement, measured at idle and on resize
  function contentRects(root, big) { // text lines and small media of a full-bleed section (its photo and backdrops ignored)
    var out = [], rg = D.createRange(), n, l, i;
    var tw = D.createTreeWalker(root, 5, { acceptNode: function (x) { return x.nodeType === 1 && (x.classList.contains('dm-tab') || x.classList.contains('dm-back')) ? 2 : 1; } });
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) {
        if (!/\S/.test(n.data)) continue;
        rg.selectNodeContents(n); l = rg.getClientRects();
        for (i = 0; i < l.length; i++) if (l[i].width) out.push(l[i]);
      } else if (/^(img|svg|canvas|video|button|input|a)$/i.test(n.tagName)) {
        var r = n.getBoundingClientRect();
        if (r.width && r.width * r.height < big) out.push(r);
      }
    }
    return out;
  }
  function fitTabs() {
    S.forEach(function (s) {
      var t = s.tab;
      if (!t || s.slot) return;
      if (s.head) { // on the eyebrow row at the right, or just above the head when that row is full
        var h = s.head, f = h.firstElementChild, hr = h.getBoundingClientRect(), rg = D.createRange(), fr;
        t.classList.remove('is-above'); t.style.top = '';
        if (!f || f === t || !hr.height) return;
        rg.selectNodeContents(f); fr = rg.getBoundingClientRect();
        if (!fr.height) fr = f.getBoundingClientRect();
        t.style.top = Math.round(fr.top - hr.top + fr.height / 2 - 22) + 'px';
        t.style.right = '';
        if (hit(t.firstChild.getBoundingClientRect(), fr, 8)) { // the eyebrow row is full: the section's top-right corner
          var sr = s.el.getBoundingClientRect();
          t.style.top = Math.round(sr.top - hr.top + 4) + 'px';
          t.style.right = Math.round(hr.right - sr.right + 2) + 'px';
          t.classList.add('is-above');
        }
      } else if (!s.on) corner(s);
    });
    S.forEach(gutter);
    S.forEach(function (s) { if (s.on && s.back) fitCal(s.back); });
  }
  /** A cover (or photo footer) has no head: take its first free corner, then a free corner of its main photo. Journal-style
   *  covers often fill every corner (masthead, issue line, barcode): then the tab stays hidden rather than cover anything,
   *  unless the page marks a spot with [data-dev-slot]. */
  function corner(s) {
    var t = s.tab, sr = s.el.getBoundingClientRect(), area = sr.width * sr.height, img = null, ia = 0, i, c;
    if (!area) return;
    $$('img, video, canvas', s.el).forEach(function (x) { // the visible part of the biggest picture
      var r = x.getBoundingClientRect(), p = x.parentNode.getBoundingClientRect(), v = { left: Math.max(r.left, p.left, sr.left), top: Math.max(r.top, p.top, sr.top),
        right: Math.min(r.right, p.right, sr.right, innerWidth), bottom: Math.min(r.bottom, p.bottom, sr.bottom) }, a = (v.right - v.left) * (v.bottom - v.top);
      if (a > ia) { ia = a; img = v; }
    });
    var bg = Math.min(area * 0.4, ia ? ia * 0.9 : area), rects = contentRects(s.el, bg);
    var order = (s.id === 'top' ? ['br', 'bl', 'tr', 'tl'] : ['tr', 'tl', 'br', 'bl']).concat(img && ia < area * 0.85 ? ['ibr', 'itr', 'ibl', 'itl'] : []);
    t.hidden = false;
    for (i = 0; i < order.length; i++) {
      c = order[i];
      t.style.left = t.style.top = '';
      if (c.charAt(0) === 'i') { // inside the photo, 2 px from its corner
        t.removeAttribute('data-corner');
        t.style.left = Math.round((c.charAt(2) === 'r' ? img.right - 46 : img.left + 2) - sr.left) + 'px';
        t.style.top = Math.round((c.charAt(1) === 'b' ? img.bottom - 46 : img.top + 2) - sr.top) + 'px';
      } else t.setAttribute('data-corner', c);
      if (free(t, s.el, rects, bg)) return;
    }
    t.hidden = true;
  }
  /** Nothing but background under the chip: no text line, and (when on screen) hit-testing finds nothing that paints there
   *  except the section, its photo or a backdrop layer (a CSS barcode, a stamp, a link or a button all count as content). */
  function free(t, sec, rects, big) {
    var c = t.firstChild.getBoundingClientRect(), sr = sec.getBoundingClientRect();
    if (c.left < sr.left || c.right > Math.min(sr.right, innerWidth) || c.top < sr.top || c.bottom > sr.bottom || rects.some(function (r) { return hit(c, r, 6); })) return false;
    if (!D.elementsFromPoint || c.top < 0 || c.bottom > innerHeight) return true; // off screen: the text check is all we can do
    return [[c.left + 1, c.top + 1], [c.right - 1, c.top + 1], [c.left + 1, c.bottom - 1], [c.right - 1, c.bottom - 1], [(c.left + c.right) / 2, (c.top + c.bottom) / 2]].every(function (p) {
      var e = D.elementsFromPoint(p[0], p[1]).filter(function (x) { return !t.contains(x); })[0], r, cs;
      if (!e || e === sec || !sec.contains(e)) return true;
      r = e.getBoundingClientRect();
      if (r.width * r.height >= big) return true; // the photo, a shade or a backdrop layer
      if (/^(img|svg|canvas|video|button|input|a)$/i.test(e.tagName) || e.closest('svg, a, button')) return false;
      cs = getComputedStyle(e);
      return cs.backgroundImage === 'none' && /^(transparent|rgba\(.*, 0\))$/.test(cs.backgroundColor); // a transparent row is not content
    });
  }
  function gutter(s) { // on phones the editor reaches 8 px from the screen edge (never past the section's own padding)
    if (!s.on || !s.back || s.el.classList.contains('dm-corner')) return;
    var cs = getComputedStyle(s.el), ph = innerWidth < 560;
    s.back.style.marginLeft = (ph ? Math.min(0, 8 - (parseFloat(cs.paddingLeft) || 0)) : 0) + 'px';
    s.back.style.marginRight = (ph ? Math.min(0, 8 - (parseFloat(cs.paddingRight) || 0)) : 0) + 'px';
  }
  var fitT = 0;
  function fitSoon() { clearTimeout(fitT); fitT = setTimeout(fitTabs, 140); }
  window.addEventListener('resize', fitSoon);
  window.addEventListener('load', function () { fitSoon(); setTimeout(fitSoon, 1500); setTimeout(fitSoon, 4000); }); // after cover intros
  if (window.IntersectionObserver) { // hit-testing needs the cover / footer on screen
    var io = new IntersectionObserver(function (en) { if (en.some(function (x) { return x.isIntersecting; })) fitSoon(); });
    S.forEach(function (s) { if (s.el.classList.contains('dm-corner')) io.observe(s.el); });
  }
  if (D.fonts && D.fonts.ready) D.fonts.ready.then(fitSoon);
  (window.requestIdleCallback || function (f) { setTimeout(f, 300); })(fitTabs);

  // ---------------------------------------------------------------- flipping
  function render(s) {
    var f = GEN[s.id]();
    s.back.setAttribute('aria-label', f.file + ' · ' + s.name + ' 소스 코드');
    s.back.innerHTML = editor(f);
  }
  function build(s) {
    if (s.back) { if (s.id === 'rsvp') rsvpSync(s.back); else render(s); return; } // fresh D-day, RSVP, counts each time
    s.back = mk('div', 'dm-back');
    s.back.id = 'dm-' + s.id; s.back.hidden = true; s.back.setAttribute('role', 'region');
    s.el.appendChild(s.back);
    if (s.tab) s.tab.setAttribute('aria-controls', s.back.id);
    render(s);
    if (s.id === 'rsvp') bindRsvp(s.back);
  }
  function face(s, back, anim) {
    if (s.never || s.on === back) return;
    if (s.id === 'rsvp') handOver(back); // before build: rsvp.http starts from what the open edit held
    if (back) build(s);
    s.on = back;
    s.el.classList.toggle('dm-flipped', back);
    Array.prototype.forEach.call(s.el.children, function (k) { // the front: display:none (CSS) + inert
      if (k.classList.contains('dm-back') || k.classList.contains('dm-keep')) return;
      if (back) { k.dmInert = k.inert; k.inert = true; } else k.inert = !!k.dmInert;
    });
    s.back.hidden = s.back.inert = !back;
    if (s.tab) s.tab.setAttribute('aria-pressed', String(back));
    gutter(s);
    if (anim && !RM) {
      var e = s.el, cls = back ? 'dm-anim' : 'dm-anim-front';
      e.classList.remove('dm-anim', 'dm-anim-front'); void e.offsetWidth; e.classList.add(cls);
      clearTimeout(s.tm); s.tm = setTimeout(function () { e.classList.remove(cls); }, 700);
    }
    if (back) { fitCal(s.back); live(); }
    else { clearTimeout(face.t); face.t = setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (x) { /* old engine */ } }, 60); } // maps measured while hidden
  }
  function navH() { var p = parseFloat(getComputedStyle(HTML).scrollPaddingTop); return isNaN(p) ? 0 : p; }
  function scrollFix(dy) { if (Math.abs(dy) > 1) window.scrollBy(0, dy); }
  /** The sections in page order (a wedding-day layout may move them), and the first one reaching below a line `y` down. */
  function inOrder() { return S.slice().sort(function (a, b) { return a.el.compareDocumentPosition(b.el) & 4 ? -1 : 1; }); }
  function reading(y) { return inOrder().filter(function (s) { return s.el.getBoundingClientRect().bottom > y; })[0] || null; }

  /** One section, from its tab or its "청첩장 보기" button: the head stays where the guest's finger was. */
  function flip(s, back, focus) {
    if (!s || s.never) return;
    if (back && H.skip) { H.then = function () { flip(s, true, focus); }; return; } // see syncHistory
    var ref = s.head || s.el, y0 = ref.getBoundingClientRect().top;
    face(s, back, true);
    scrollFix(ref.getBoundingClientRect().top - Math.max(y0, navH()));
    syncHistory(rearmed);
    var f = focus && (shown(s.tab) ? s.tab : back && $('.dm-front', s.back));
    if (f) f.focus({ preventScroll: true });
  }

  /** Everything (the switches, the exit pill, Escape, Android Back): the section being read keeps its place. */
  function setAll(on, o) {
    o = o || {};
    if (on && H.skip) { H.then = function () { setAll(true, o); }; return; } // see syncHistory
    if (on ? global : !anyOn()) return;
    var nav = navH(), ref = reading(nav + 1), y0 = ref ? ref.el.getBoundingClientRect().top : 0, from = secOf(D.activeElement);
    var near = S.filter(function (s) { var r = s.el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
    var was = ref && ref.on, wasGlobal = global;
    global = on;
    HTML.classList.toggle('dm-on', on);
    D.title = on ? 'view-source: ' + baseTitle : baseTitle;
    SW.forEach(function (b) { b.setAttribute('aria-checked', String(on)); });
    if (on && !exitBtn) {
      exitBtn = D.body.appendChild(mk('button', 'dm-exit', I_BACK + '<span>청첩장으로 돌아가기</span>'));
      exitBtn.type = 'button'; exitBtn.setAttribute('data-dm', 'exit');
    }
    if (exitBtn) exitBtn.hidden = !on;
    watchSheet();
    S.forEach(function (s) { face(s, on, near.indexOf(s) >= 0); });
    if (ref) scrollFix(ref.el.getBoundingClientRect().top - (y0 < nav && was !== ref.on ? nav : y0));
    if (!o.fromPop) syncHistory(rearmed); else rearmed(); // Back has already taken our entry
    toast((on ? '개발자 모드 ON · 소스 코드로 보여 드려요' : (wasGlobal ? '개발자 모드 OFF · ' : '') + '청첩장으로 돌아왔어요').replace(/ /g, NB).replace(/·\u00a0/g, '· ')); // breaks only after "·"
    if (on) try { console.log('%c</> 개발자 모드', 'font:700 12px monospace;color:#A88E59', '· 마음 전하실 곳만은 소스 없이 그대로 둡니다.'); } catch (x) { /* no console */ }
    var a = D.activeElement; // never leave focus on something that just disappeared
    if (a && a !== D.body && !shown(a)) {
      var t = from && shown(from.tab) ? from.tab : on ? exitBtn : ref && shown(ref.tab) ? ref.tab : null;
      if (t) t.focus({ preventScroll: true });
    }
    if (o.from && sheet && sheet.contains(o.from)) setTimeout(function () { // from the "☰ 전체" sheet: close it so the page shows
      var b = $('[aria-controls="navSheet"][aria-expanded="true"]');
      if (b) { b.click(); b.focus({ preventScroll: true }); }
    }, 380);
  }
  var mo = null; // the exit pill steps aside while the sheet is open (it would cover the last rows on small phones)
  function watchSheet() {
    if (!sheet || !window.MutationObserver) return;
    if (!mo) (mo = new MutationObserver(watchSheet)).observe(sheet, { attributes: true, attributeFilter: ['hidden'] });
    HTML.classList.toggle('dm-sheet', global && !sheet.hidden);
  }

  // ---------------------------------------------------------------- live values (countdown, D-day) while they show
  var tick = 0;
  function live() {
    var els = $$('.dm-flipped [data-dm-live]'), d = K.dday();
    if (!els.length || D.hidden) { clearInterval(tick); tick = 0; return; }
    els.forEach(function (x) { var v = x.getAttribute('data-dm-live') === 'cd' ? cd(d) : d.label; if (x.textContent !== v) x.textContent = v; });
    if (!tick) tick = setInterval(live, 1000);
  }
  D.addEventListener('visibilitychange', function () { if (!D.hidden && anyOn()) live(); });
  // cover.tex follows the cover, which a page left open turns to Published at 20:00 (js/cover.js sets its data-phase)
  var cover = byId('top');
  if (cover && window.MutationObserver) {
    new MutationObserver(function () {
      if (!cover.on || !cover.back) return;
      var had = cover.back.contains(D.activeElement);
      render(cover);
      if (had) { var b = $('.dm-front', cover.back); if (b) b.focus({ preventScroll: true }); }
    }).observe(cover.el, { attributes: true, attributeFilter: ['data-phase'] });
  }

  // ---------------------------------------------------------------- Android Back / iOS swipe-back: one history entry while any source shows
  var H = { on: false, skip: false, then: null, n: 0 };
  try { if (history.state && history.state.aiccDev) history.replaceState(null, ''); } catch (e) { /* noop */ }
  /** Coming back must not jump to an old scroll position: manual while a source shows (Back keeps the section being
   *  read in place). app.js owns the mode for every layer (AICC.restore), and turns it 'auto' whenever the page is left,
   *  so a reload or a map trip with a source open still lands in place; a value saved here and put back later once
   *  caught the closing sheet's 'manual' for good. Returns our entry's number among the layers' (see AICC.back). */
  function holdMode() {
    if (window.AICC && AICC.restore) return AICC.restore.hold('dev');
    try { history.scrollRestoration = 'manual'; } catch (e) { /* noop */ }
    return 0;
  }
  function restoreMode() {
    if (window.AICC && AICC.restore) AICC.restore.release('dev', 120);
    else setTimeout(function () { try { history.scrollRestoration = 'auto'; } catch (e) { /* noop */ } }, 120);
  }
  /** Our entry carries its number (and, from app.js, the page load's token): an older {aiccDev} entry left in the
   *  history (closed under the RSVP edit's entry, or pushed before a reload) is never taken for the open one. */
  function entry() { var B = window.AICC && AICC.back, o = { aiccDev: 1, n: H.n }; return B && B.entry ? B.entry(o, H.n) : o; }
  function ours(s) { return !!(s && s.aiccDev) && s.n === H.n; }
  /** While our own step back is under way, a source turned on waits for it to land (H.then, from flip / setAll): an
   *  entry pushed meanwhile would be the one that step takes, and the source would show with no entry under it. */
  function syncHistory(after) {
    var want = anyOn();
    try {
      if (want && !H.on) {
        H.n = holdMode();
        history.pushState(entry(), '');
        H.on = true;
      } else if (!want && H.on) {
        H.on = false;
        if (ours(history.state)) {
          H.skip = after || true;
          history.back();
          return setTimeout(function () { if (H.skip) stepped(false); }, 700);
        }
        restoreMode(); // under another layer's entry (the RSVP edit's): app.js steps over ours once Back reaches it
      }
    } catch (e) { /* sandboxed history */ }
    if (after) after();
  }
  /** After our own step back: app.js may step once more over an entry left behind (the RSVP edit answered here), and
   *  ▶ play must not push the game's entry before that step has landed. */
  function landed(f) { if (window.AICC && AICC.back && AICC.back.settled) AICC.back.settled(f); else f(); }
  /** Our step back has landed (its popstate, or none came within 700 ms): what waited for it runs now. */
  function stepped(pop) {
    var todo = [H.skip, H.then];
    H.skip = false; H.then = null;
    restoreMode();
    todo.forEach(function (f) { if (f && f.call) { if (pop) setTimeout(function () { landed(f); }, 0); else f(); } });
  }
  /** Back with every source turned by its tab out of sight (the guest read on) would turn them back unseen: the
   *  nearest is brought into view instead, still showing its code, and the next Back turns it back. */
  function outOfSight() {
    var nav = navH(), vh = innerHeight, on = S.filter(function (s) { return s.on; });
    function gap(s) { var r = s.el.getBoundingClientRect(); return r.top >= vh ? r.top - vh : r.bottom <= nav ? nav - r.bottom : 0; }
    if (!on.length || on.some(function (s) { return !gap(s); })) return null;
    return on.sort(function (a, b) { return gap(a) - gap(b); })[0];
  }
  window.addEventListener('popstate', function (e) {
    if (H.skip) return stepped(true);
    if (!H.on) return;
    if (window.AICC && AICC.back && AICC.back.at) { // only a Back below our entry (app.js numbers them), where it lands
      var at = AICC.back.at();
      if (at < 0 || at >= H.n) return; // a step on past a closed entry, or a landing on / above ours (a photo closed, Forward)
    } else if (e.state && e.state.aiccDev) return; // e.g. the photo viewer closed on top of our entry
    H.on = false;
    restoreMode();
    var far = !global && outOfSight();
    if (far) { // our entry goes on again once the other popstate listeners have run
      (far.head || far.el).scrollIntoView({ block: 'start', behavior: RM ? 'auto' : 'smooth' });
      return setTimeout(function () { if (anyOn() && !H.on) syncHistory(); }, 0);
    }
    setAll(false, { fromPop: true });
  });
  // A reload, a discarded tab or a map trip the back-forward cache does not keep: the page comes back with every front
  // showing, at the scroll position saved now. Turn them back first, keeping the section being read (the one across a
  // quarter of the way down) in place, so that position is the guest's (no history step or toast: the page is going;
  // an edit rsvp.http holds is not handed back).
  window.addEventListener('pagehide', function (e) {
    if (e.persisted || !anyOn()) return;
    var nav = navH(), ref = reading(nav + (innerHeight - nav) / 4), y0 = ref ? ref.el.getBoundingClientRect().top : 0;
    R.edit = false;
    HTML.classList.remove('dm-on');
    S.forEach(function (s) { face(s, false); });
    if (ref) scrollFix(ref.el.getBoundingClientRect().top - y0);
  });
  // our entry is ours while a source shows; once closed, app.js steps over it (left under the RSVP edit's, or Forward)
  if (window.AICC && AICC.back && AICC.back.own) AICC.back.own(function (s) { return H.on && ours(s) ? H.n : 0; });
  D.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || e.defaultPrevented || !anyOn() || $('[aria-modal="true"]:not([hidden])') || (sheet && !sheet.hidden)) return; // dialogs close first
    setAll(false);
  });

  // ---------------------------------------------------------------- clicks (one delegated listener)
  var ACT = {
    tab: function (t, s) { flip(s, !s.on, true); },
    front: function (t, s) { flip(s, false, true); },
    'switch': function (t) {
      if (sheet && !sheet.hidden && sheet.contains(t) && window.AICC && typeof AICC.closeSheet === 'function') {
        return AICC.closeSheet(function () { setAll(!global); });
      }
      setAll(!global, { from: t });
    },
    exit: function () { setAll(false); },
    copy: function () { K.copy(addr()).then(function (ok) { toast(ok ? '주소가 복사되었습니다' : '주소를 복사하지 못했어요'); }); },
    share: function () { K.share().then(function (r) { if (r === 'copied') toast('링크가 복사되었습니다'); else if (r === 'failed') toast('링크를 복사하지 못했어요'); }); },
    reload: function () { location.reload(); },
    reviews: function () { fetchOnce(RV, function () { return A.listReviews({ limit: 200 }); }, 'reviews', true); },
    play: function (t, s) { // the result card lives on the front, so show it first
      face(s, false);
      syncHistory(function () {
        try { if (window.HumanSVM && HumanSVM.start) return HumanSVM.start(); } catch (e) { /* fall back */ }
        var b = D.getElementById('playBtn');
        if (b) { b.scrollIntoView({ block: 'center' }); b.focus({ preventScroll: true }); }
      });
    },
    photo: function (t, s) {
      var set = photoSets()[+t.getAttribute('data-set')], lb = window.AICC && AICC.lightbox;
      try {
        if (set && lb && lb.open) return lb.open(set.ids.slice(), +t.getAttribute('data-i'), function (id) {
          return { sess: set.city + ' · ' + set.note.split(' · ')[0], cap: (K.photoInfo(id) || {}).alt || '' };
        }, t);
      } catch (e) { /* fall back to the front */ }
      flip(s, false, true);
    },
    send: function (t) { rsvpSend(t); },
    att: function (t) { R.att = t.getAttribute('data-v') === 'true'; R.dirty = true; rsvpToks(secOf(t).back); },
    side: function (t) { var v = t.getAttribute('data-v'); R.side = R.side === v ? '' : v; R.dirty = true; rsvpToks(secOf(t).back); },
  };
  D.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-dm]') : null, f = t && ACT[t.getAttribute('data-dm')];
    if (f) f(t, secOf(t), e);
  });
  function bindRsvp(back) {
    back.addEventListener('input', function (e) {
      var i = e.target, k = i.getAttribute('data-k');
      if (!k) return;
      if (k === 'phone' && i.selectionStart === i.value.length) i.value = K.formatPhone(i.value);
      R[k] = i.value; R.dirty = true;
    });
    back.addEventListener('focusin', function (e) { // KakaoTalk on Android does not resize for the keyboard
      var i = e.target;
      if (i.classList.contains('dm-in')) setTimeout(function () { i.scrollIntoView({ block: 'center', behavior: RM ? 'auto' : 'smooth' }); }, 300);
    });
  }

  // ---------------------------------------------------------------- for the devtools crowd
  window.AICCDev = {
    on: function () { setAll(true); }, off: function () { setAll(false); },
    flip: function (id, back) { var s = byId(id); if (s) flip(s, back == null ? !s.on : !!back); },
    state: function () { return { global: global, flipped: S.filter(function (s) { return s.on; }).map(function (s) { return s.id; }) }; },
  };
  try {
    console.log('%c</> view-source %c AI-CC ' + Y + ' ', 'background:#E2CFA4;color:#18213B;font:700 12px/1.9 monospace;padding:1px 7px;border-radius:5px 0 0 5px',
      'background:#18213B;color:#E2CFA4;font:700 12px/1.9 monospace;padding:1px 7px;border-radius:0 5px 5px 0',
      '\n개발자 하객님, 반가워요 👋 섹션마다 오른쪽 위의 </> 를 누르면 그 섹션을 그리는 코드가 보여요.\n한 번에 보려면 ☰ 전체 → 개발자 모드, 또는 여기서 AICCDev.on()  (마음 전하실 곳은 소스 없이 그대로 둡니다)');
  } catch (e) { /* no console */ }
})();
