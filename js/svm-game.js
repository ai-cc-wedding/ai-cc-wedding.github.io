/* Human SVM — "버진로드를 열어라!" game UI (canvas overlay). Logic and scoring live in svm-core.js (core v3).
 * Works with the overlay markup of index.html (#game …) and patches what it needs at start-up
 * (round count, pills, pause buttons, practice skip), so the markup itself never has to change.
 */
(function () {
  'use strict';

  var C = window.SVMCore, K = window.Kit, API = window.WeddingAPI, A = window.AICC;
  if (!C || !A) return;
  function $(s) { return document.querySelector(s); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var N = C.ROUNDS.length;
  var reduced = !!(K && K.reducedMotion);

  var game = $('#game'), panel = $('#gPanel'), canvas = $('#gCanvas'), stage = $('#gStage'), ctx = canvas.getContext('2d');
  var elScore = $('#gScore'), elTimer = $('#gTimer'), elMsg = $('#gMsg'), elPlus = $('#gPlus');
  var elBanner = $('#gBanner'), elPause = $('#gPause'), elCapT = $('#gCapT'), elCapS = $('#gCapS');
  var timerWrap = elTimer.parentNode;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '게임 화면: 하트 하객과 별 하객 사이로 길을 내는 직선을 그어 주세요');

  // ---------------------------------------------------------------- overlay patches (idempotent)
  // HUD title: Round n/N, or "연습" during the practice round
  var elTitle = $('#gameTitle');
  elTitle.textContent = '';
  var tLab = el('span', 'mono', 'Round'), tNum = el('b', null, '1'), tOf = el('span', 'mono', '/' + N);
  tNum.id = 'gRound';
  elTitle.appendChild(tLab); elTitle.appendChild(document.createTextNode(' ')); elTitle.appendChild(tNum); elTitle.appendChild(tOf);
  function title(practice, i) {
    tLab.textContent = practice ? '' : 'Round';
    tNum.textContent = practice ? '연습' : String(i + 1);
    tOf.textContent = practice ? '' : '/' + N;
  }
  // one pill per round; each fills with that round's share of its maximum
  var pillWrap = $('#gPills');
  pillWrap.textContent = '';
  pillWrap.style.setProperty('--n', N);
  var pills = [];
  for (var pi = 0; pi < N; pi++) {
    var li = el('li'), lab = el('span');
    li.appendChild(el('i'));
    if (C.ROUNDS[pi].kernel) lab.textContent = 'K';
    else { lab.appendChild(el('small', 'game__pill-r', 'R')); lab.appendChild(document.createTextNode(String(pi + 1))); }
    li.appendChild(lab);
    pillWrap.appendChild(li); pills.push(li);
  }
  function resetPills() { pills.forEach(function (li) { li.className = ''; li.style.removeProperty('--f'); }); }
  // pause sheet: a reason line, 계속하기 and 그만하기
  var pauseText = elPause.querySelector('p') || elPause.insertBefore(el('p'), elPause.firstChild);
  var pauseSub = el('small', 'game__pause-sub');
  pauseText.appendChild(pauseSub);
  var pauseTitle = document.createTextNode('잠시 멈췄어요');
  pauseText.insertBefore(pauseTitle, pauseSub);
  for (var ci = pauseText.childNodes.length - 1; ci >= 0; ci--) {
    var nd = pauseText.childNodes[ci];
    if (nd !== pauseTitle && nd !== pauseSub) pauseText.removeChild(nd);
  }
  var btnResume = $('#gResume');
  var pauseBtns = el('div', 'game__pause-btns');
  elPause.insertBefore(pauseBtns, btnResume);
  pauseBtns.appendChild(btnResume);
  var btnQuit = el('button', 'btn btn--glass', '그만하기');
  btnQuit.type = 'button'; btnQuit.id = 'gQuit';
  pauseBtns.appendChild(btnQuit);
  // practice skip
  var foot = elMsg.parentNode;
  var btnSkip = el('button', 'game__skip', '연습 건너뛰기 ›');
  btnSkip.type = 'button'; btnSkip.id = 'gSkip'; btnSkip.hidden = true;
  foot.insertBefore(btnSkip, pillWrap);
  var keysHint = foot.querySelector('.game__keys');
  if (keysHint) keysHint.textContent = '키보드: ← → 회전 · ↑ ↓ 이동 · Shift 누르고 미세 조정 · Enter 확정';

  function cap(t, s) { elCapT.textContent = t; elCapS.textContent = s || ''; }

  // the field's colours follow the page's theme tokens (css/style.css :root); the literals are the fallbacks
  var COL = {};
  function readCol() {
    var cs = getComputedStyle(document.documentElement);
    function v(n, d) { var x = cs.getPropertyValue(n).trim(); return x || d; }
    var inkRgb = v('--ink-rgb', '24, 33, 59').replace(/\s+/g, ''), accRgb = v('--amber-rgb', '226, 207, 164').replace(/\s+/g, '');
    COL = {
      g: v('--groom', '#2F5FA8'), b: v('--bride', '#B03A48'), ink: v('--ink', '#18213B'), amber: v('--amber', '#E2CFA4'),
      amber2: v('--amber-line', '#A88E59'), field: v('--paper', '#FFFFFF'), light: v('--amber-light', '#F0E4C6'),
      grid: 'rgba(' + inkRgb + ',.07)', bad: '#E5484D', tintG: 'rgba(47,95,168,.085)', tintB: 'rgba(176,58,72,.085)',
      inkA: function (a) { return 'rgba(' + inkRgb + ',' + a + ')'; }, accA: function (a) { return 'rgba(' + accRgb + ',' + a + ')'; },
    };
  }
  readCol();
  var DUR = {
    intro: 1100, introMax: 2600, wait: 2600, banner: 950, bannerFirst: 1300, kernelShow: 1300, kernelLift: 2000,
    review: 1600, reviewMiss: 1300, reviewSkip: 600, finish: 1100,
  };
  var PRACTICE_INFO = { t: '연습 판', s: '점수에 들어가지 않아요 · 편하게 그어 보세요', m: '화면을 한 번 쭉 그어 보세요 👆' };
  var INFO = [
    { t: '워밍업', s: '이제부터 점수가 쌓여요', m: '♥와 ★ 사이로 길을 내 주세요' },
    { t: '조금 더 가까이', s: '하객이 늘었어요', m: '가운데 길이 넓을수록 높은 점수!' },
    { t: '사이가 좁아져요', s: '가장 넓은 길은 어디일까요?', m: '빨리 그을수록 보너스도 있어요' },
    { t: '빈자리가 줄어요', s: '시간도 조금씩 짧아져요', m: '♥와 ★ 사이로 길을 내 주세요' },
    { t: '아슬아슬', s: '가장 넓은 길을 노려 보세요', m: '침착하게, 하지만 빠르게!' },
    { t: 'Double-blind 🙈', s: '이제 길 미리보기가 사라져요', m: '눈대중으로 가장 넓은 길을!' },
    { t: 'Double-blind 🙈', s: '하객이 더 빽빽해요', m: '반대편에 앉으면 빨간 동그라미가 떠요' },
    { t: 'Double-blind 🙈', s: '빈틈이 거의 없어요', m: '두 무리 사이 한가운데를 노려 보세요' },
    { t: '마지막 직선 라운드', s: '가장 좁고, 가장 짧아요', m: '숨 한 번 고르고 — 쭉!' },
    { t: 'Kernel Trick ✨', s: '마지막 판에는 반전이 있어요', m: '' },
  ];
  /** Banner text for scored round i (falls back on the round's kind if the core ever gains or loses rounds). */
  function infoFor(i) {
    var cfg = C.ROUNDS[i] || {};
    if (cfg.kernel) return INFO[INFO.length - 1];
    if (INFO.length === N) return INFO[i];
    return cfg.blind ? INFO[5] : INFO[Math.min(i, 4)];
  }
  var PAD = 4; // canvas padding around the square field

  var view = { w: 300, h: 300, dpr: 1, S: 280, ox: 10, oy: 10, r: 11 };
  var run = null, raf = 0, lastT = 0, paused = false, pauseAt = 0, pauseWhy = '', opener = null, practiced = false, anchor = null;

  // the pixel couple walks down the aisle after a perfect round (loaded when the game first opens)
  var sprite = new Image(), spriteReady = false;
  sprite.onload = function () { spriteReady = true; };

  // ---------------------------------------------------------------- helpers
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function backOut(t) { t = clamp(t, 0, 1); var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function pct(r) { return (Math.floor(r * 1000) / 10).toFixed(1) + '%'; }
  function secs(R, tick) { return ((Math.max(C.MIN_INPUT_TICKS, tick) - C.MIN_INPUT_TICKS) / 60).toFixed(2) + '초'; }
  function fx(x) { return view.ox + x * view.S; }
  function fy(y) { return view.oy + y * view.S; }
  function msg(t, sub) {
    elMsg.textContent = t;
    if (sub) { var s = document.createElement('small'); s.textContent = sub; elMsg.appendChild(s); }
  }
  function setTimer(frac) {
    elTimer.style.transform = 'scaleX(' + clamp(frac, 0, 1).toFixed(4) + ')';
    timerWrap.classList.toggle('is-low', frac < 0.3 && frac > 0);
  }
  function showBanner(k, t, s) {
    elBanner.textContent = '';
    elBanner.appendChild(el('span', 'k', k));
    elBanner.appendChild(el('span', 't', t));
    if (s) {
      var c = el('span', 's');
      if (typeof s === 'string') c.textContent = s; else c.appendChild(s);
      elBanner.appendChild(c);
    }
    elBanner.classList.add('is-on');
    game.classList.add('is-banner');
  }
  function hideBanner() { elBanner.classList.remove('is-on'); game.classList.remove('is-banner'); }
  function setPhase(p) { run.phase = p; run.pt = 0; game.setAttribute('data-phase', p); }
  function plus(res) {
    elPlus.textContent = '+' + fmt(res.total);
    elPlus.classList.toggle('is-miss', !res.perfect);
    elPlus.classList.remove('is-on');
    void elPlus.offsetWidth; // restart the animation
    elPlus.classList.add('is-on');
  }
  function roundMax(R) { return R.max || 1; }

  // ---------------------------------------------------------------- sizing
  function resize() {
    var rect = stage.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    view.w = Math.max(120, rect.width); view.h = Math.max(120, rect.height); view.dpr = dpr;
    canvas.width = Math.round(view.w * dpr); canvas.height = Math.round(view.h * dpr);
    view.S = Math.max(100, Math.min(view.w, view.h) - PAD * 2);
    view.ox = (view.w - view.S) / 2; view.oy = (view.h - view.S) / 2;
    view.r = clamp(view.S * 0.032, 9, 15);
  }
  if ('ResizeObserver' in window) new ResizeObserver(function () { if (!game.hidden) resize(); }).observe(stage);
  window.addEventListener('resize', function () { if (!game.hidden) resize(); });

  // ---------------------------------------------------------------- history: Back pauses first, a second Back leaves
  var Hist = (function () {
    var armed = false, cb = null, n = 0, SR = A.restore || { hold: function () { return 1; }, release: function () {} };
    try { if (history.state && history.state.aiccGame) history.replaceState(null, ''); } catch (e) { /* noop */ }
    window.addEventListener('popstate', function () {
      // app.js says where Back landed: only below our entry is a Back for us, and a step on past a closed entry
      // (at -1) is acted on where it lands
      var at = A.back && A.back.at ? A.back.at() : 0;
      if (!armed || at < 0 || at >= n) return;
      armed = false;
      var f = cb; cb = null;
      if (f) f();
    });
    // our entry is ours while the game is open; once it has closed, app.js steps over it (Forward reaches it after ✕).
    // It carries its number (and app.js's page-load token), so an older {aiccGame} entry is never taken for it.
    function ours(s) { return !!(s && s.aiccGame) && s.n === n; }
    if (A.back && A.back.own) A.back.own(function (s) { return armed && ours(s) ? n : 0; });
    return {
      arm: function (f) {
        cb = f;
        if (armed) return;
        try {
          // our own scroll restore runs on close (unlockScroll); the browser's would fight it. app.js owns the mode
          // for every layer (Restore), so a hand-over from developer mode can no longer leave the page 'manual'.
          n = SR.hold('game');
          history.pushState(A.back && A.back.entry ? A.back.entry({ aiccGame: 1 }, n) : { aiccGame: 1, n: n }, '');
          armed = true;
        } catch (e) { armed = false; }
      },
      release: function () {
        cb = null;
        if (armed) {
          armed = false;
          try { if (ours(history.state)) history.back(); } catch (e) { /* noop */ }
        }
        SR.release('game', 400);
      },
    };
  })();
  function onBack() {
    // the first Back pauses (and re-arms Back); Back on the pause sheet, or after the finish, closes the game
    if (run && run.phase !== 'done' && !paused) { pause('back'); Hist.arm(onBack); return; }
    close(true);
  }

  // ---------------------------------------------------------------- lifecycle
  function start(opts) {
    if (run && run.phase !== 'done') return;
    var wantPractice = !(opts && opts.practice === false) && !practiced;
    opener = document.activeElement;
    if (!sprite.src) sprite.src = K.root + 'assets/art/pixel-couple.png';
    // remember where the guest was (relative to the button they pressed): images or reviews that finish loading
    // above while the game is open would otherwise leave them somewhere else when it closes
    var anc = opener && opener !== document.body && opener.getBoundingClientRect && opener.getBoundingClientRect().height ? opener : $('#playBtn');
    var ar = anc && anc.getBoundingClientRect();
    anchor = ar && ar.bottom > 0 && ar.top < window.innerHeight ? { el: anc, top: ar.top } : null; // only an anchor the guest could see
    Hist.arm(onBack);
    readCol();
    game.hidden = false;
    A.lockScroll();
    resize();
    paused = false; pauseWhy = ''; elPause.hidden = true;
    run = {
      phase: 'intro', pt: 0, ri: -1, R: null, rounds: null, results: [], log: [], total: 0, shown: 0,
      seed: null, practiceSeed: null, sessionId: null, seedSource: 'local', session: null, sessionDone: false,
      wantPractice: wantPractice, didPractice: false, practiceRes: null,
      tick: 0, playT0: 0, pausedMs: 0, drag: null, anchor: null, hover: null, kb: null, committed: null, res: null,
      reviewDur: DUR.review, startMs: performance.now(), appearAt: 0, touched: false, sparks: [], liftDone: false, payload: null,
      inputs: {},
    };
    game.setAttribute('data-phase', 'intro');
    game.setAttribute('data-round', '0');
    game.removeAttribute('data-blind');
    title(wantPractice, 0);
    elScore.textContent = '0'; setTimer(1);
    elPlus.classList.remove('is-on');
    resetPills();
    btnSkip.hidden = true;
    var lead = document.createDocumentFragment();
    // "두 사람" (the couple) and "내 주세요" never split: a line ending in "두" reads as the verb 두다
    [['신랑측 '], ['♥', 'cls--g'], [' 하객과 신부측 '], ['★', 'cls--b'], [' 하객 사이로, 두\u00a0사람이 걸어갈 길을 내\u00a0주세요']].forEach(function (p) {
      var n = p[1] ? el('b', 'cls ' + p[1], p[0]) : document.createTextNode(p[0]);
      lead.appendChild(n);
    });
    showBanner('Human SVM Challenge', wantPractice ? '연습 한 판부터!' : '준비되셨나요?', lead);
    cap('Human SVM Challenge', '양가 하객 사이로 길을 내 주세요');
    msg('곧 시작합니다');
    var r = run;
    API.startGame(C.GAME_ID).then(function (s) {
      r.session = s; r.sessionDone = true;
      // the server answered after the rounds already began on a local seed: keep the session so the score still ranks
      if (r.rounds && !r.sessionId && s && s.sessionId) {
        r.sessionId = s.sessionId; r.seedSource = 'local-late';
        if (r.payload) { r.payload.sessionId = s.sessionId; r.payload.seedSource = 'local-late'; }
      }
    }, function () { r.sessionDone = true; });
    lastT = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('visibilitychange', onVis);
    setTimeout(function () { try { canvas.focus({ preventScroll: true }); } catch (e) { /* noop */ } }, 60);
  }

  function localSeed() {
    var u = new Uint32Array(1);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(u); else u[0] = Math.floor(Math.random() * 4294967295);
    return u[0] >>> 0;
  }

  function startPractice() {
    run.practiceSeed = localSeed();
    run.ri = -1;
    setRound(C.makePractice(run.practiceSeed));
  }
  function afterPractice() {
    run.didPractice = true;
    practiced = true;
    btnSkip.hidden = true;
    if (run.sessionDone) beginRounds();
    else { setPhase('wait'); run.R = null; msg('점수판을 준비하고 있어요…'); }
  }

  function beginRounds() {
    var s = run.session, seed;
    if (s && s.seed != null) {
      seed = s.seed >>> 0;
      run.sessionId = s.sessionId || null;
      run.seedSource = s.sessionId ? (s.demo ? 'demo' : 'server') : (s.offline ? 'offline' : 'local');
    } else {
      seed = localSeed();
      run.seedSource = 'local';
    }
    run.seed = seed;
    run.rounds = C.makeRounds(seed);
    run.ri = -1;
    nextRound();
  }

  function nextRound() {
    run.ri++;
    if (run.ri >= run.rounds.length) { finish(); return; }
    setRound(run.rounds[run.ri]);
  }

  function setRound(R) {
    run.R = R;
    run.tick = 0;
    run.drag = run.anchor = run.hover = run.kb = run.committed = run.res = null;
    run.touched = false; run.sparks = []; run.liftDone = false;
    setPhase('banner');
    game.setAttribute('data-round', R.practice ? 'practice' : String(run.ri + 1));
    if (R.blind) game.setAttribute('data-blind', ''); else game.removeAttribute('data-blind');
    title(R.practice, run.ri);
    setTimer(1);
    pills.forEach(function (li, i) { li.classList.toggle('is-now', !R.practice && i === run.ri); });
    btnSkip.hidden = !R.practice;
    btnSkip.textContent = '연습 건너뛰기 ›';
    var info = R.practice ? PRACTICE_INFO : infoFor(run.ri);
    var k = R.practice ? 'Practice Round' : 'Round ' + (run.ri + 1) + ' / ' + N;
    showBanner(k, info.t, info.s);
    cap(info.t, info.s);
    msg(info.m || ' ');
  }

  function bannerDur() { return run.R && (run.R.practice || (run.ri === 0 && !run.didPractice)) ? DUR.bannerFirst : DUR.banner; }
  function enterPlay(now) { setPhase('play'); run.playT0 = now; run.pausedMs = 0; run.tick = 0; }

  function commit(line, method, moves, ptype) {
    if (!run || run.phase !== 'play') return;
    var R = run.R;
    if (!R.practice && method >= 0) { var kind = method === 2 ? 'keys' : ptype || 'touch'; run.inputs[kind] = (run.inputs[kind] || 0) + 1; }
    var L = C.quantLine(line);
    var res = C.scoreRound(R, L, run.tick);
    if (!res.ev) L = null;
    run.committed = L; run.res = res;
    run.drag = run.anchor = run.hover = run.kb = null;
    setPhase('review');
    run.reviewDur = res.perfect ? DUR.review : DUR.reviewMiss;
    if (R.practice) {
      run.practiceRes = res;
      btnSkip.textContent = '바로 실전 시작 ›';
      if (!res.ev) msg('연습이라 괜찮아요! 실전에선 시간 안에 쭉 그어 주세요');
      else if (!res.perfect) msg('연습이라 괜찮아요! 반대편에 앉은 하객은 빨간 동그라미로 보여요');
      else msg('연습 성공! 길 폭 ' + pct(res.ratio) + ' · ' + secs(R, res.tick), '실전이었다면 +' + fmt(res.total) + '점');
      return;
    }
    run.results.push(res);
    run.total += res.total;
    run.log.push(L ? [Math.round(L[0] * C.Q), Math.round(L[1] * C.Q), Math.round(L[2] * C.Q), Math.round(L[3] * C.Q), run.tick, method, moves | 0] : null);
    plus(res);
    var pill = pills[run.ri];
    if (pill) {
      pill.style.setProperty('--f', clamp(res.total / roundMax(R), 0, 1).toFixed(3));
      pill.className = res.perfect ? 'is-done is-perfect' : 'is-done';
    }
    if (!res.ev) msg('시간 초과! 다음 판엔 쭉 그어 주세요 (+0)');
    else if (!res.perfect) msg('정확도 ' + Math.round(100 * res.correct / res.n) + '% · ' + (res.n - res.correct) + '명이 반대편 자리에 있어요', '+' + fmt(res.total));
    // every guest seated is only the start: the message follows the aisle's width, so a narrow aisle is never "perfect"
    else if (res.ratio >= 0.98) msg('SVM급 최대 마진! 🤖', '길 폭 ' + pct(res.ratio) + ' · ' + secs(R, res.tick) + ' · +' + fmt(res.total));
    else if (res.ratio >= 0.9) msg('넓고 반듯한 길이에요!', '길 폭 ' + pct(res.ratio) + ' · ' + secs(R, res.tick) + ' · 점선이\u00a0SVM\u00a0정답');
    else if (res.ratio >= 0.7) msg('좋아요! 조금 더 가운데로', '길 폭 ' + pct(res.ratio) + ' · ' + secs(R, res.tick) + ' · 점선이\u00a0SVM\u00a0정답');
    else msg('모두 제자리! 그런데 길이 좁아요', '두 무리 한가운데를 노려 보세요 · 길 폭 ' + pct(res.ratio));
  }

  function timeout() {
    var d = run.drag;
    if (d && d.moved >= 16 && segHitsField(d)) commit([d.x0, d.y0, d.x1, d.y1], 0, d.moves, d.pt);
    else if (run.kb) commit(kbLine(), 2, 0);
    else commit(null, -1, 0);
  }

  function finish() {
    setPhase('done');
    pills.forEach(function (li) { li.classList.remove('is-now'); });
    var r = run;
    var payload = {
      v: C.VERSION, total: r.total, max: C.MAX_SCORE,
      rounds: r.results.map(function (x, i) {
        return { total: x.total, sep: x.sep, mg: x.mg, sp: x.sp, perfect: x.perfect, ratio: x.ratio,
          sec: x.perfect ? (x.tick - C.MIN_INPUT_TICKS) / 60 : null, max: roundMax(r.rounds[i]), kernel: r.rounds[i].kernel, blind: r.rounds[i].blind };
      }),
      sessionId: r.sessionId, seed: r.seed, seedSource: r.seedSource,
      log: { r: r.log }, durationMs: Math.round(performance.now() - r.startMs),
      input: Object.keys(r.inputs).sort().map(function (k) { return k + ':' + r.inputs[k]; }).join(' ') || '',
    };
    if (C.replay(r.seed, payload.log) !== r.total && window.console) console.warn('[v1-svm] replay mismatch');
    r.payload = payload;
    showBanner('Finish!', fmt(r.total) + '점', '수고하셨어요! 결과를 정리하고 있어요…');
    msg(' ');
    setTimeout(function () { if (run === r) deliver(); }, DUR.finish);
  }
  function deliver(fromBack) {
    var p = run && run.payload;
    stop(fromBack);
    if (p) A.showResult(p);
  }

  function stop() {
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('visibilitychange', onVis);
    hideBanner();
    game.hidden = true;
    game.removeAttribute('data-phase');
    game.removeAttribute('data-blind');
    A.unlockScroll();
    if (anchor && anchor.el.isConnected) {
      var drift = anchor.el.getBoundingClientRect().top - anchor.top, html = document.documentElement.style, prev = html.scrollBehavior;
      if (Math.abs(drift) > 2) { html.scrollBehavior = 'auto'; window.scrollBy(0, drift); html.scrollBehavior = prev; }
    }
    anchor = null;
    run = null; paused = false; pauseWhy = ''; elPause.hidden = true; btnSkip.hidden = true;
    Hist.release(); // after a Back the entry is already gone, so this only restores scrolling behaviour
  }
  function close(fromBack) {
    if (run && run.payload) { deliver(fromBack); return; } // closing on the "Finish!" card still keeps the result
    var o = opener;
    stop(fromBack);
    if (o && o.focus) { try { o.focus({ preventScroll: true }); } catch (e) { /* noop */ } }
  }

  function pause(why) {
    if (!run) return;
    if (!paused) { paused = true; pauseAt = performance.now(); }
    pauseWhy = why;
    run.drag = null; // a finger that was down when the pause came never commits a line
    pauseTitle.nodeValue = why === 'hidden' ? '잠시 멈췄어요' : '게임을 그만할까요?';
    pauseSub.textContent = why === 'back' ? '한 번 더 뒤로 가면 게임이 닫혀요' : why === 'esc' ? 'Esc를 한 번 더 누르면 게임이 닫혀요' : '시간도 함께 멈췄어요';
    elPause.hidden = false;
    try { btnResume.focus({ preventScroll: true }); } catch (e) { /* noop */ }
  }
  function resume() {
    if (paused && run && run.phase === 'play') run.pausedMs += performance.now() - pauseAt;
    paused = false; pauseWhy = ''; elPause.hidden = true; lastT = performance.now();
    try { canvas.focus({ preventScroll: true }); } catch (e) { /* noop */ }
  }

  // ---------------------------------------------------------------- loop
  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min(100, Math.max(0, now - lastT));
    lastT = now;
    if (!run) return;
    if (!paused) update(dt, now);
    draw(now);
  }

  function update(dt, now) {
    run.pt += dt;
    if (run.shown !== run.total) {
      run.shown += Math.max(1, Math.round((run.total - run.shown) * Math.min(1, dt / 120)));
      if (run.shown > run.total) run.shown = run.total;
      elScore.textContent = fmt(run.shown);
    }
    var R = run.R;
    switch (run.phase) {
      case 'intro':
        if (run.pt >= DUR.intro) {
          if (run.wantPractice) { hideBanner(); startPractice(); }
          else if (run.sessionDone || run.pt >= DUR.introMax) { hideBanner(); beginRounds(); }
        }
        break;
      case 'wait':
        if (run.sessionDone || run.pt >= DUR.wait) beginRounds();
        break;
      case 'banner':
        if (run.pt >= bannerDur()) {
          hideBanner();
          run.appearAt = now;
          if (R.kernel) { setPhase('kernel'); msg('직선 하나로는 길이 안 나죠? 🤔'); }
          else enterPlay(now);
        }
        break;
      case 'kernel':
        if (run.pt >= DUR.kernelShow && run.pt - dt < DUR.kernelShow) msg('평면에선 길이 안 나지만, 높이를 더하면 길이 생겨요 ✨', 'φ(x, y) = (x, x² + y²)');
        if (!run.liftDone && run.pt >= DUR.kernelShow + DUR.kernelLift * 0.9) { run.liftDone = true; if (!reduced) spawnSparks(R, now); }
        if (run.pt >= DUR.kernelShow + DUR.kernelLift) { enterPlay(now); msg('이제 한 줄로 길을 낼 수 있어요!'); }
        break;
      case 'play':
        // wall-clock ticks: a throttled requestAnimationFrame cannot slow the round down
        var tk = Math.floor((now - run.playT0 - run.pausedMs) / C.TICK_MS);
        if (tk > run.tick) run.tick = tk;
        if (run.tick >= R.ticks) { run.tick = R.ticks; setTimer(0); timeout(); return; }
        setTimer(1 - run.tick / R.ticks);
        break;
      case 'review':
        if (run.pt >= run.reviewDur) { if (R.practice) afterPractice(); else nextRound(); }
        break;
    }
  }
  function skipReview() { if (run && run.phase === 'review' && run.pt >= DUR.reviewSkip) run.pt = run.reviewDur; }

  // ---------------------------------------------------------------- input (anywhere on the panel, not only on the field)
  function toField(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left - view.ox) / view.S, y: (e.clientY - rect.top - view.oy) / view.S };
  }
  function inField(p, m) { return p.x >= -m && p.x <= 1 + m && p.y >= -m && p.y <= 1 + m; }
  /** Does the drawn segment cross the field at all? (Liang–Barsky on t ∈ [0, 1]) */
  function segHitsField(d) {
    var dx = d.x1 - d.x0, dy = d.y1 - d.y0, t0 = 0, t1 = 1, lo = -0.02, hi = 1.02;
    var P = [-dx, dx, -dy, dy], Qv = [d.x0 - lo, hi - d.x0, d.y0 - lo, hi - d.y0];
    for (var i = 0; i < 4; i++) {
      if (P[i] === 0) { if (Qv[i] < 0) return false; continue; }
      var t = Qv[i] / P[i];
      if (P[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return t0 <= t1;
  }
  function isUi(t) { return !!(t && t.closest && (t.closest('button') || t.closest('.game__hud'))); }
  panel.addEventListener('pointerdown', function (e) {
    if (!run || paused || !e.isPrimary || isUi(e.target)) return;
    if (run.phase === 'review') { skipReview(); return; } // impatient players tap through the review
    if (run.phase !== 'play') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    var p = toField(e);
    run.touched = true;
    run.drag = { id: e.pointerId, x0: p.x, y0: p.y, x1: p.x, y1: p.y, cx: e.clientX, cy: e.clientY, moved: 0, moves: 0, pt: e.pointerType };
    try { panel.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
  });
  panel.addEventListener('pointermove', function (e) {
    if (!run) return;
    if (run.drag && e.pointerId === run.drag.id) {
      e.preventDefault();
      var p = toField(e), d = run.drag;
      d.x1 = p.x; d.y1 = p.y; d.moves++;
      var m = Math.sqrt((e.clientX - d.cx) * (e.clientX - d.cx) + (e.clientY - d.cy) * (e.clientY - d.cy));
      if (m > d.moved) d.moved = m;
    } else if (run.anchor && e.pointerType === 'mouse') {
      run.hover = toField(e);
    }
  });
  function pointerEnd(e) {
    if (!run || !run.drag || e.pointerId !== run.drag.id) return;
    var d = run.drag;
    run.drag = null;
    if (run.phase !== 'play') return;
    if (e.type === 'pointercancel') return;
    if (run.tick < C.MIN_INPUT_TICKS) { msg('조금만 천천히! 다시 한 번 그어 주세요'); return; }
    if (d.moved >= 16) {
      if (!segHitsField(d)) { msg('네모난 칸을 가로지르게 그어 주세요'); return; }
      commit([d.x0, d.y0, d.x1, d.y1], 0, d.moves, d.pt);
      return;
    }
    var p = { x: d.x0, y: d.y0 };
    if (!inField(p, 0.04)) return; // a stray tap outside the field does nothing
    if (run.anchor) {
      var px = Math.sqrt(Math.pow((p.x - run.anchor.x) * view.S, 2) + Math.pow((p.y - run.anchor.y) * view.S, 2));
      if (px >= 16) commit([run.anchor.x, run.anchor.y, p.x, p.y], 1, 2, d.pt);
      else { run.anchor = null; msg('점을 다시 찍어 주세요'); }
    } else {
      run.anchor = p;
      msg('좋아요! 한 곳을 더 누르면 직선이 완성돼요');
    }
  }
  panel.addEventListener('pointerup', pointerEnd);
  panel.addEventListener('pointercancel', pointerEnd);
  panel.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  // Belt and braces for iOS: never let a touch in the game scroll or zoom the page underneath.
  panel.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

  function kbLine() {
    var a = run.kb.a * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    var cx = 0.5 + nx * run.kb.o, cy = 0.5 + ny * run.kb.o;
    return [cx - dx * 0.7, cy - dy * 0.7, cx + dx * 0.7, cy + dy * 0.7];
  }
  function onKey(e) {
    if (game.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); if (paused || !run || run.phase === 'done') close(); else pause('esc'); return; }
    if (e.key === 'Tab') {
      var f = [$('#gameClose')];
      if (!btnSkip.hidden) f.push(btnSkip);
      f.push(canvas);
      if (!elPause.hidden) f = [btnResume, btnQuit];
      var at = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(at + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      return;
    }
    if (!run || paused) return;
    var k = e.key;
    if (run.phase === 'review' && (k === 'Enter' || k === ' ')) { e.preventDefault(); skipReview(); return; }
    if (run.phase !== 'play') return;
    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
      e.preventDefault();
      if (!run.kb) { run.kb = { a: 0, o: 0 }; run.touched = true; }
      var da = e.shiftKey ? 0.5 : 2, dof = e.shiftKey ? 0.002 : 0.008;
      if (k === 'ArrowLeft') run.kb.a -= da;
      if (k === 'ArrowRight') run.kb.a += da;
      if (k === 'ArrowUp') run.kb.o = clamp(run.kb.o - dof, -0.6, 0.6);
      if (k === 'ArrowDown') run.kb.o = clamp(run.kb.o + dof, -0.6, 0.6);
    } else if ((k === 'Enter' || k === ' ') && run.kb) {
      e.preventDefault();
      if (run.tick >= C.MIN_INPUT_TICKS) commit(kbLine(), 2, 0);
    }
  }
  function onVis() {
    if (document.hidden && run && run.phase !== 'done' && !paused) pause('hidden');
  }
  btnResume.addEventListener('click', resume);
  btnQuit.addEventListener('click', function () { close(); });
  btnSkip.addEventListener('click', function () {
    if (!run || !run.R || !run.R.practice) return;
    afterPractice();
    try { canvas.focus({ preventScroll: true }); } catch (e) { /* noop */ }
  });
  $('#gameClose').addEventListener('click', function () { close(); });

  // ---------------------------------------------------------------- drawing
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function heart(c, x, y, r) {
    c.beginPath();
    c.moveTo(x, y + r * 0.95);
    c.bezierCurveTo(x - r * 1.3, y + r * 0.1, x - r * 1.05, y - r * 1.0, x, y - r * 0.38);
    c.bezierCurveTo(x + r * 1.05, y - r * 1.0, x + r * 1.3, y + r * 0.1, x, y + r * 0.95);
    c.closePath();
  }
  var STAR = (function () {
    var pts = [];
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? 0.48 : 1.12; pts.push([Math.cos(a) * rad, Math.sin(a) * rad]); }
    return pts;
  })();
  function star(c, x, y, r) {
    c.beginPath();
    STAR.forEach(function (p, i) { if (i) c.lineTo(x + p[0] * r, y + p[1] * r); else c.moveTo(x + p[0] * r, y + p[1] * r); });
    c.closePath();
  }
  function sparkle(c, x, y, r) { // 4-point glint
    c.beginPath();
    c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r);
    c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.closePath();
  }
  /** Polygon between two offsets (o0 → o1) measured along the line's normal (line: nx*x + ny*y = c). */
  function strip(c, ev, o0, o1) {
    var bx = ev.nx * ev.c, by = ev.ny * ev.c, tx = -ev.ny, ty = ev.nx, F = 4;
    c.beginPath();
    c.moveTo(fx(bx - tx * F + ev.nx * o0), fy(by - ty * F + ev.ny * o0));
    c.lineTo(fx(bx + tx * F + ev.nx * o0), fy(by + ty * F + ev.ny * o0));
    c.lineTo(fx(bx + tx * F + ev.nx * o1), fy(by + ty * F + ev.ny * o1));
    c.lineTo(fx(bx - tx * F + ev.nx * o1), fy(by - ty * F + ev.ny * o1));
    c.closePath();
  }
  /** Parameter range [s0, s1] of p + s·d that lies inside [lo, hi]² (Liang–Barsky), or null. */
  function clipParam(px, py, dx, dy, lo, hi) {
    var s0 = -10, s1 = 10, P = [-dx, dx, -dy, dy], Qv = [px - lo, hi - px, py - lo, hi - py];
    for (var i = 0; i < 4; i++) {
      if (P[i] === 0) { if (Qv[i] < 0) return null; continue; }
      var t = Qv[i] / P[i];
      if (P[i] < 0) { if (t > s0) s0 = t; } else if (t < s1) s1 = t;
    }
    return s0 <= s1 ? [s0, s1] : null;
  }
  function lineThrough(c, px, py, dx, dy) {
    var F = 4;
    c.beginPath();
    c.moveTo(fx(px - dx * F), fy(py - dy * F));
    c.lineTo(fx(px + dx * F), fy(py + dy * F));
  }

  function liveLine() {
    if (!run) return null;
    var d = run.drag;
    if (d && d.moved >= 16) return { line: [d.x0, d.y0, d.x1, d.y1], dashed: false, a: [d.x0, d.y0], b: [d.x1, d.y1] };
    if (run.anchor && run.hover) return { line: [run.anchor.x, run.anchor.y, run.hover.x, run.hover.y], dashed: true, a: [run.anchor.x, run.anchor.y] };
    if (run.kb) return { line: kbLine(), dashed: false };
    return null;
  }

  /** Kernel view: 0 = flat (top view), 1 = fully lifted (side view of the paraboloid). */
  function liftK(R) {
    if (!R.kernel) return 0;
    if (run.phase === 'kernel') {
      if (reduced) return run.pt >= DUR.kernelShow + DUR.kernelLift * 0.5 ? 1 : 0;
      return ease((run.pt - DUR.kernelShow) / DUR.kernelLift);
    }
    return run.phase === 'play' || run.phase === 'review' || run.phase === 'done' ? 1 : 0;
  }
  /** Screen y of a guest while the camera tilts from the top view (y) to the side view (lifted height). */
  function projY(pt, k) {
    if (k <= 0) return pt.y;
    if (k >= 1) return pt.ly;
    var th = k * Math.PI / 2;
    return 0.5 + (pt.y - 0.5) * Math.cos(th) + (pt.ly - 0.5) * Math.sin(th);
  }
  function spawnSparks(R, now) {
    run.sparks = [];
    var n = Math.min(14, R.pts.length);
    for (var i = 0; i < n; i++) {
      var pt = R.pts[(i * 5) % R.pts.length], a = i * 2.4;
      run.sparks.push({ x: pt.x + Math.cos(a) * 0.04, y: pt.ly + Math.sin(a) * 0.04, t0: now + i * 35, r: 5 + (i % 3) * 2 });
    }
  }

  function draw(now) {
    var c = ctx;
    c.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    c.clearRect(0, 0, view.w, view.h);
    if (!run) return;
    var S = view.S;

    // field: a tidy scatter-plot "figure"
    c.save();
    rr(c, view.ox, view.oy, S, S, 16);
    c.fillStyle = COL.field; c.fill();
    c.clip();
    c.strokeStyle = COL.grid; c.lineWidth = 1;
    for (var g = 1; g < 10; g++) {
      c.beginPath(); c.moveTo(fx(g / 10), view.oy); c.lineTo(fx(g / 10), view.oy + S); c.stroke();
      c.beginPath(); c.moveTo(view.ox, fy(g / 10)); c.lineTo(view.ox + S, fy(g / 10)); c.stroke();
    }

    var R = run.R;
    var showPts = R && run.phase !== 'banner' && run.phase !== 'intro' && run.phase !== 'wait';
    var committed = run.phase === 'review' || run.phase === 'done';
    var live = null, ev = null, L = null, k = 0;
    if (R && run.phase !== 'intro' && run.phase !== 'wait') {
      k = liftK(R);
      if (R.kernel && showPts) drawKernel(c, R, k, now);

      if (committed && run.res && run.res.ev) { ev = run.res.ev; }
      else if (run.phase === 'play') { live = liveLine(); ev = live ? C.evaluate(R, live.line) : null; }

      if (ev) {
        var gSign = ev.orient === 0 ? 1 : -1; // side where ♥ (class 0) should be
        strip(c, ev, 0, gSign * 4); c.fillStyle = COL.tintG; c.fill();
        strip(c, ev, 0, -gSign * 4); c.fillStyle = COL.tintB; c.fill();
        // the aisle (버진로드): margin band around the line — hidden while drawing in double-blind rounds
        if (ev.correct === ev.n && ev.margin > 0 && (committed || !R.blind)) {
          c.save();
          strip(c, ev, -ev.margin, ev.margin);
          c.fillStyle = committed ? COL.accA(.62) : COL.accA(.45); // champagne is pale: a stronger band than amber needed
          c.fill();
          c.setLineDash([6, 6]); c.lineWidth = 1.5; c.strokeStyle = COL.amber2;
          var tx = -ev.ny, ty = ev.nx, bx = ev.nx * ev.c, by = ev.ny * ev.c;
          lineThrough(c, bx + ev.nx * ev.margin, by + ev.ny * ev.margin, tx, ty); c.stroke();
          lineThrough(c, bx - ev.nx * ev.margin, by - ev.ny * ev.margin, tx, ty); c.stroke();
          c.restore();
        }
      }

      // optimal SVM line after the commit (its label is drawn last, see below)
      var fade = reduced ? 1 : clamp(run.pt / 400, 0, 1);
      if (committed && R.opt && R.opt.p) {
        var o = optLine(R);
        c.save();
        c.globalAlpha = 0.65 * fade;
        c.setLineDash([3, 6]); c.lineWidth = 2; c.strokeStyle = COL.ink;
        lineThrough(c, o.mx, o.my, o.dx, o.dy); c.stroke();
        c.restore();
      }

      // the player's line
      L = committed ? run.committed : live && live.line;
      if (L) {
        var ldx = L[2] - L[0], ldy = L[3] - L[1], ll = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
        c.save();
        c.lineCap = 'round';
        c.lineWidth = 3.2;
        c.strokeStyle = committed && ev && ev.correct === ev.n ? COL.amber2 : COL.ink;
        if (live && live.dashed) c.setLineDash([8, 7]);
        lineThrough(c, L[0], L[1], ldx / ll, ldy / ll); c.stroke();
        c.restore();
      }
      if (live && live.a) {
        c.beginPath(); c.arc(fx(live.a[0]), fy(live.a[1]), 6, 0, Math.PI * 2); c.fillStyle = COL.ink; c.fill();
      }
      if (live && live.b) {
        c.beginPath(); c.arc(fx(live.b[0]), fy(live.b[1]), 7, 0, Math.PI * 2); c.fillStyle = COL.amber; c.fill();
        c.lineWidth = 2; c.strokeStyle = COL.ink; c.stroke();
      }
      if (run.phase === 'play' && run.anchor && !run.hover) {
        var pulse = reduced ? 7 : 7 + Math.sin(now / 160) * 2;
        c.beginPath(); c.arc(fx(run.anchor.x), fy(run.anchor.y), pulse, 0, Math.PI * 2); c.fillStyle = COL.amber; c.fill();
        c.lineWidth = 2; c.strokeStyle = COL.ink; c.stroke();
      }

      // guests (a little smaller when the room is crowded)
      if (showPts) {
        var r = view.r * (R.pts.length >= 18 ? 0.88 : R.pts.length >= 14 ? 0.94 : 1), th = k * Math.PI / 2;
        R.pts.forEach(function (pt, i) {
          var y = R.kernel ? projY(pt, k) : pt.y;
          var sc = reduced ? 1 : backOut((now - run.appearAt - i * 22) / 320);
          if (sc <= 0.01) return;
          var depth = R.kernel ? 1 + 0.32 * (pt.y - 0.5) * Math.sin(2 * th) : 1; // nearer guests look bigger mid-tilt
          var X = fx(pt.x), Y = fy(y), rad = r * sc * depth;
          var bad = ev && ev.ok && !ev.ok[i];
          var sv = committed && ev && ev.correct === ev.n && Math.abs(Math.abs(ev.dist[i]) - ev.margin) < 0.0015;
          if (sv) {
            c.beginPath(); c.arc(X, Y, rad * (1.75 + (reduced ? 0 : 0.12 * Math.sin(now / 140))), 0, Math.PI * 2);
            c.lineWidth = 2.5; c.strokeStyle = COL.amber2; c.stroke();
          }
          if (bad) {
            var sh = committed && !reduced ? Math.sin(now / 30) * 2 * Math.max(0, 1 - run.pt / 600) : 0;
            X += sh;
            c.beginPath(); c.arc(X, Y, rad * 1.65, 0, Math.PI * 2);
            c.lineWidth = 2.5; c.strokeStyle = COL.bad; c.stroke();
          }
          if (pt.c === 0) heart(c, X, Y, rad); else star(c, X, Y, rad);
          c.fillStyle = pt.c === 0 ? COL.g : COL.b; c.fill();
          c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke();
        });
      }

      // sparkles when the kernel lift lands
      if (run.sparks.length) {
        c.save();
        run.sparks.forEach(function (s) {
          var t = (now - s.t0) / 750;
          if (t < 0 || t > 1) return;
          c.globalAlpha = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;
          sparkle(c, fx(s.x), fy(s.y), s.r * (0.6 + t * 0.8));
          c.fillStyle = COL.amber2; c.fill();
        });
        c.restore();
      }

      // first-round affordance: a finger that swipes across
      var hintRound = R.practice || (run.ri === 0 && !run.didPractice);
      if (run.phase === 'play' && hintRound && !run.touched && run.pt > 900) {
        var tt = ((run.pt - 900) % 1800) / 1800, e1 = reduced ? 1 : ease(Math.min(1, tt / 0.8));
        var ax = 0.12 + 0.76 * e1, ay = 0.9 - 0.04 * Math.sin(e1 * Math.PI);
        c.save();
        c.globalAlpha = reduced ? 0.85 : tt < 0.85 ? 0.85 : Math.max(0, 0.85 - (tt - 0.85) * 6);
        c.setLineDash([6, 6]); c.lineWidth = 3; c.strokeStyle = COL.amber2;
        c.beginPath(); c.moveTo(fx(0.12), fy(0.9)); c.lineTo(fx(ax), fy(ay)); c.stroke();
        c.setLineDash([]);
        c.beginPath(); c.arc(fx(ax), fy(ay), 14, 0, Math.PI * 2);
        c.fillStyle = COL.inkA(.18); c.fill(); c.lineWidth = 2; c.strokeStyle = COL.ink; c.stroke();
        c.restore();
      }

      // the couple walks down the aisle the guest just drew (perfect rounds only)
      if (run.phase === 'review' && ev && ev.correct === ev.n && L) drawWalk(c, L, now);
    }
    c.restore();

    // field frame
    rr(c, view.ox + 0.5, view.oy + 0.5, S - 1, S - 1, 16);
    c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,.25)'; c.stroke();

    // labels go on top of everything
    if (R && committed && R.opt && R.opt.p) drawSvmTag(c, R, L, reduced ? 1 : clamp(run.pt / 400, 0, 1));
    if (R && R.kernel && k > 0.02 && showPts) drawTag(c, R, 1, 'φ(x, y) = (x, x² + y²)', Math.min(1, k * 1.6), COL.amber);
    else if (R && showPts && (R.blind || R.practice) && run.phase === 'play') {
      // a reminder that fades out after 2.4 s so it never sits on top of the guests for long
      var ta = reduced ? (run.pt < 2400 ? 1 : 0) : clamp((2400 - run.pt) / 600, 0, 1);
      if (ta > 0) drawTag(c, R, 0, R.blind ? 'Double-blind · 길 미리보기 없음' : 'Practice · 연습', ta, COL.light);
    }
  }

  function optLine(R) {
    var p = R.opt.p, q = R.opt.q, mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    var vx = q[0] - p[0], vy = q[1] - p[1], vl = Math.sqrt(vx * vx + vy * vy) || 1;
    return { mx: mx, my: my, dx: -vy / vl, dy: vx / vl, nx: vx / vl, ny: vy / vl };
  }
  /**
   * "SVM" tag on the dashed optimum. Candidate spots along the line (both sides of it) are scored by their clearance
   * from the guests and from the player's line; the first spot with enough room wins, else the roomiest one.
   */
  function drawSvmTag(c, R, L, fade) {
    var o = optLine(R);
    var span = clipParam(o.mx, o.my, o.dx, o.dy, 0.12, 0.88) || [0, 0];
    var off = 20 / view.S, best = null, bestScore = -Infinity; // a crowded field still gets the roomiest spot (never none)
    var ln = null;
    if (L) {
      var dx = L[2] - L[0], dy = L[3] - L[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
      ln = { nx: -dy / l, ny: dx / l, c: (-dy / l) * L[0] + (dx / l) * L[1] };
    }
    var fr = [0.84, 0.16, 0.68, 0.32, 0.5];
    for (var i = 0; i < fr.length && bestScore < 30; i++) {
      var sAt = span[0] + (span[1] - span[0]) * fr[i], lx = o.mx + o.dx * sAt, ly = o.my + o.dy * sAt;
      for (var sgn = 1; sgn >= -1; sgn -= 2) {
        var px = lx + o.nx * off * sgn, py = ly + o.ny * off * sgn;
        var X0 = clamp(fx(px), view.ox + 26, view.ox + view.S - 26), Y0 = clamp(fy(py), view.oy + 14, view.oy + view.S - 14);
        var room = 99;
        R.pts.forEach(function (pt) {
          var gx = fx(pt.x), gy = fy(R.kernel ? pt.ly : pt.y);
          // distance from the guest to the tag box (≈ 44 × 20 px)
          var ddx = Math.max(0, Math.abs(gx - X0) - 22), ddy = Math.max(0, Math.abs(gy - Y0) - 10);
          room = Math.min(room, Math.sqrt(ddx * ddx + ddy * ddy) - view.r);
        });
        if (ln) room = Math.min(room, Math.abs(ln.nx * ((X0 - view.ox) / view.S) + ln.ny * ((Y0 - view.oy) / view.S) - ln.c) * view.S - 10);
        if (room > bestScore || !best) { bestScore = room; best = [X0, Y0]; }
      }
    }
    var X = best[0], Y = best[1];
    c.save();
    c.font = '600 12px "JetBrains Mono", ui-monospace, monospace';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    var wTxt = c.measureText('SVM').width + 12;
    c.globalAlpha = 0.92 * fade;
    rr(c, X - wTxt / 2, Y - 10, wTxt, 20, 6); c.fillStyle = COL.ink; c.fill();
    c.fillStyle = '#fff'; c.fillText('SVM', X, Y + 0.5);
    c.restore();
  }
  /** A small dark pill in the corner of the field with the fewest guests under it (formula, double-blind, practice). */
  function drawTag(c, R, k, txt, a, color) {
    c.save();
    var fs = Math.round(clamp(view.S * 0.034, 11, 14)), h = fs + 11;
    c.font = '600 ' + fs + 'px "JetBrains Mono", ui-monospace, "AICC Sans", "Pretendard Variable", sans-serif'; // AICC Sans: the page's own Korean subset
    c.textAlign = 'left'; c.textBaseline = 'middle';
    var w = Math.min(c.measureText(txt).width + 16, view.S - 16);
    var spots = [[view.ox + 8, view.oy + 8], [view.ox + view.S - 8 - w, view.oy + 8],
      [view.ox + 8, view.oy + view.S - 8 - h], [view.ox + view.S - 8 - w, view.oy + view.S - 8 - h]];
    var pick = spots[0], least = Infinity, pad = view.r + 2;
    for (var i = 0; i < spots.length && least > 0; i++) {
      var sx = spots[i][0], sy = spots[i][1], hits = 0;
      R.pts.forEach(function (pt) {
        var gx = fx(pt.x), gy = fy(R.kernel ? projY(pt, k) : pt.y);
        if (gx > sx - pad && gx < sx + w + pad && gy > sy - pad && gy < sy + h + pad) hits++;
      });
      if (hits < least) { least = hits; pick = spots[i]; }
    }
    c.globalAlpha = a;
    rr(c, pick[0], pick[1], w, h, 8); c.fillStyle = COL.ink; c.fill();
    c.fillStyle = color; c.fillText(txt, pick[0] + 8, pick[1] + h / 2 + 0.5, w - 16);
    c.restore();
  }
  /** Concentric contour rings that tilt into a glowing paraboloid bowl while the guests are lifted. */
  function drawKernel(c, R, k) {
    var th = k * Math.PI / 2, cos = Math.cos(th), sin = Math.sin(th);
    var lifting = run.phase === 'kernel';
    if (lifting || k < 1) {
      var a = (0.16 + 0.5 * Math.sin(k * Math.PI)) * (1 - Math.pow(k, 6));
      if (a > 0.01) {
        c.save();
        c.globalAlpha = a;
        c.strokeStyle = COL.amber2; c.lineWidth = 1.6;
        c.shadowColor = COL.accA(.9); c.shadowBlur = 10 * Math.sin(k * Math.PI);
        [0.08, 0.16, 0.24, 0.32, 0.4].forEach(function (rr0) {
          var lyR = C.lift(0.5 + rr0, 0.5), yc = 0.5 + (lyR - 0.5) * sin, ry = Math.max(0.6, rr0 * cos * view.S);
          c.beginPath(); c.ellipse(fx(0.5), fy(yc), rr0 * view.S, ry, 0, 0, Math.PI * 2); c.stroke();
        });
        c.restore();
      }
    }
    // side view of the bowl (the curve every guest now sits on)
    var g = clamp((k - 0.55) / 0.45, 0, 1);
    if (g > 0) {
      c.save();
      c.globalAlpha = 0.55 * g;
      c.strokeStyle = COL.amber2; c.setLineDash([4, 5]); c.lineWidth = 1.6;
      c.shadowColor = COL.accA(.8); c.shadowBlur = lifting ? 8 : 0;
      c.beginPath();
      for (var s = 0; s <= 40; s++) {
        var xx = s / 40, yy = C.lift(xx, 0.5);
        if (s) c.lineTo(fx(xx), fy(yy)); else c.moveTo(fx(xx), fy(yy));
      }
      c.stroke();
      c.restore();
    }
  }
  function drawWalk(c, L) {
    if (!spriteReady) return;
    var u = reduced ? 0.5 : clamp((run.pt - 220) / 1250, 0, 1);
    if (u <= 0) return;
    var dx = L[2] - L[0], dy = L[3] - L[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= l; dy /= l;
    var span = clipParam(L[0], L[1], dx, dy, 0.1, 0.9);
    if (!span) return;
    var a = [L[0] + dx * span[0], L[1] + dy * span[0]], b = [L[0] + dx * span[1], L[1] + dy * span[1]];
    // walk from the near (lower) end of the aisle toward the far end; left to right when it is flat
    if (a[1] < b[1] - 0.02 || (Math.abs(a[1] - b[1]) <= 0.02 && a[0] > b[0])) { var t = a; a = b; b = t; }
    var e = reduced ? 0.5 : ease(u);
    c.save();
    if (!reduced) {
      for (var i = 6; i >= 1; i--) { // petal trail
        var ue = ease(Math.max(0, u - i * 0.045));
        if (ue <= 0) continue;
        c.globalAlpha = 0.5 * (1 - i / 7);
        c.beginPath();
        c.arc(fx(a[0] + (b[0] - a[0]) * ue) + (i % 2 ? 4 : -4), fy(a[1] + (b[1] - a[1]) * ue) - 2, 3, 0, Math.PI * 2);
        c.fillStyle = i % 2 ? '#F2A7B5' : COL.amber2; c.fill();
      }
    }
    var x = a[0] + (b[0] - a[0]) * e, y = a[1] + (b[1] - a[1]) * e;
    var hgt = clamp(view.S * 0.12, 34, 60), wdt = hgt * 77 / 86;
    var bob = reduced ? 0 : Math.abs(Math.sin(u * Math.PI * 7)) * 2;
    c.globalAlpha = reduced ? 1 : u > 0.9 ? Math.max(0, 1 - (u - 0.9) / 0.1) : Math.min(1, u * 8);
    c.imageSmoothingEnabled = false;
    c.drawImage(sprite, fx(x) - wdt / 2, fy(y) - hgt * 0.92 - bob, wdt, hgt);
    c.restore();
  }

  // ---------------------------------------------------------------- public
  $('#playBtn').addEventListener('click', function () { start({ practice: true }); });
  $('#againBtn').addEventListener('click', function () { start({ practice: false }); });
  window.HumanSVM = {
    start: start, close: close,
    state: function () {
      return run ? { phase: run.phase, round: run.ri + 1, practice: !!(run.R && run.R.practice), total: run.total, seed: run.seed,
        practiceSeed: run.practiceSeed, tick: run.tick, sessionId: run.sessionId, src: run.seedSource, paused: paused } : null;
    },
    geom: function () { return { S: view.S, ox: view.ox, oy: view.oy }; },
  };

  // ---------------------------------------------------------------- for the devtools crowd
  if (window.console && console.log) {
    console.log('%c AI-CC 2026 %c Human SVM Challenge ', 'background:#18213B;color:#E2CFA4;font:700 16px/2 sans-serif;padding:2px 8px;border-radius:6px 0 0 6px', 'background:#E2CFA4;color:#18213B;font:700 16px/2 sans-serif;padding:2px 8px;border-radius:0 6px 6px 0');
    console.log('👀 Reviewer #2 is watching.\n점수와 입력 기록(seed + 라운드마다 그은 직선과 시각)은 함께 저장되고, 시상 전에 서버에서 다시 계산(replay)해 봅니다.\nSVMCore.replay(seed, log) 로 직접 확인해 보셔도 좋아요.');
  }
  window.aicc = Object.freeze({
    submitScore: function (n) {
      A.toast('🍯 Nice try! test-set leakage detected — Overfitting Hall of Fame 등재');
      if (window.console) console.log('%c🍯 Nice try! 제출 완료… 는 아니고요, Overfitting Hall of Fame에 이름을 올렸습니다. (score ' + n + ' ignored)', 'color:#A88E59;font-weight:700');
      return Promise.resolve({ ok: true, valid: false, rank: null, message: 'Nice try! 🍯' });
    },
    rules: 'round points M = 55,000 … 145,000 (10 rounds, 1,000,000 in all). All seated: M/5 + 2M/5 × (m/m*)^6 + 2M/5 × time left; otherwise M/5 × (2·correct − n)/n',
  });
})();
