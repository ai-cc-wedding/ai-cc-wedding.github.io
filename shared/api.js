/* WeddingAPI — RSVP, guest reviews and mini-game scores.
 *
 * live mode: talks to the Google Apps Script web app in backend/Code.gs
 *            (set WEDDING_CONFIG.apiUrl in shared/config.js).
 * demo mode: apiUrl is empty — everything is kept in this browser's localStorage,
 *            so pages can be previewed before the backend exists. On a published site
 *            (not localhost) RSVPs, reviews and scores are refused unless the URL has ?demo,
 *            so a missing apiUrl can never quietly keep guests' answers on their own phones.
 *
 * Every method returns a Promise. Validation problems reject with an Error whose
 * .message is a Korean sentence that can be shown to the guest as-is, and whose
 * .code is one of: invalid, rate, network, server.
 *
 * Load order: config.js -> api.js. Set WeddingAPI.version = 'v3' to tag submissions.
 */
(function () {
  'use strict';

  var cfg = window.WEDDING_CONFIG || {};
  var LOCAL = location.protocol === 'file:' ||
    /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname);
  var query = new URLSearchParams(location.search);
  var API = String(cfg.apiUrl || '').trim();
  // ?api=... is honoured only on localhost, so nobody can redirect real guests' data elsewhere.
  if (LOCAL && query.get('api')) API = query.get('api');
  var MODE = API ? 'live' : 'demo';
  // Sample reviews/scores appear only in local previews (or with ?demo), never for real guests.
  var SAMPLES = MODE === 'demo' && (LOCAL || query.has('demo'));
  var UNSET = MODE === 'demo' && !LOCAL && !query.has('demo');
  if (UNSET && window.console) {
    console.error('[WeddingAPI] WEDDING_CONFIG.apiUrl is empty: set it in shared/config.js (see backend/README.md).');
  }
  var NS = 'aicc-wedding:';

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(NS + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  var clientId = load('cid', null);
  if (!clientId) { clientId = uid(); save('cid', clientId); }

  function fail(code, message) {
    var e = new Error(message);
    e.code = code;
    return e;
  }
  function line(s, max) {
    return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
  }
  function para(s, max) {
    return String(s == null ? '' : s).replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{4,}/g, '\n\n\n').trim().slice(0, max);
  }
  function digits(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
  /** A name as a guest may retype it, as the server's nameKey_ compares names: spaces and letter case ignored. */
  function nameKey(s) { return String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase(); }
  function rating(v) {
    var n = parseInt(v, 10);
    return isNaN(n) ? '' : Math.max(1, Math.min(10, n));
  }

  // ---------------------------------------------------------------- transport
  function request(url, init) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 20000) : null;
    init = Object.assign({ redirect: 'follow', cache: 'no-store' }, init || {});
    if (ctl) init.signal = ctl.signal;
    return fetch(url, init)
      .then(function (res) {
        if (!res.ok) throw fail('server', '서버 응답이 올바르지 않아요. 잠시 후 다시 시도해 주세요.');
        // a reply cut off mid-body, the 20 s abort while it downloads, or a page that is not JSON: never the engine's English
        return res.json().catch(function (e) {
          throw e && e.name === 'SyntaxError' ? fail('server', '서버 응답이 올바르지 않아요. 잠시 후 다시 시도해 주세요.')
            : fail('network', '네트워크 연결을 확인한 뒤 다시 시도해 주세요.');
        });
      }, function () {
        throw fail('network', '네트워크 연결을 확인한 뒤 다시 시도해 주세요.');
      })
      .then(function (data) {
        if (!data || data.ok !== true) {
          throw fail(data && data.code || 'server', data && data.error || '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
        }
        return data;
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }
  function get(params) {
    params.cid = clientId;
    return request(API + (API.indexOf('?') < 0 ? '?' : '&') + new URLSearchParams(params).toString(), { method: 'GET' });
  }
  function post(body) {
    body.cid = clientId;
    body.v = api.version;
    // text/plain keeps this a "simple" CORS request (no preflight), which Apps Script requires.
    return request(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    });
  }
  function notReady() {
    return Promise.reject(fail('server', '아직 접수 준비 중이에요. 잠시 후 다시 시도해 주세요.'));
  }
  function later(value) {
    return new Promise(function (resolve) { setTimeout(function () { resolve(value); }, 250 + Math.random() * 250); });
  }

  // ---------------------------------------------------------------- demo data
  var SAMPLE_REVIEWS = [
    { id: 'sample-1', name: '예시) 연구실 동료', rating: 10, title: 'Strong Accept',
      text: '두 저자의 오랜 협업이 드디어 결실을 맺었네요. 재현성 100%의 행복을 기대합니다!',
      extra: {}, likes: 12, createdAt: '2026-10-20T10:00:00+09:00', sample: true, mine: false },
    { id: 'sample-2', name: '예시) 학부 동기', rating: 9, title: 'Accept',
      text: '고려대 컴퓨터학과 시절부터 지켜봤습니다. 이 논문은 무조건 Oral입니다 👏',
      extra: {}, likes: 7, createdAt: '2026-10-18T21:30:00+09:00', sample: true, mine: false },
  ];
  var SAMPLE_SCORES = [
    { name: '예시) Reviewer 2', score: 0, at: '2026-10-20T10:00:00+09:00' },
  ];

  function demoReviews() {
    var mine = load('demo:reviews', []);
    return mine.concat(SAMPLES ? SAMPLE_REVIEWS : []).filter(function (r) { return !r.hidden; });
  }
  function demoBoard(game) {
    var all = load('demo:scores', []).filter(function (s) { return s.game === game && s.valid !== false; });
    if (SAMPLES) {
      all = all.concat(SAMPLE_SCORES.map(function (s) {
        return { game: game, name: s.name, phone4: '0000', score: s.score, at: s.at, cid: 'sample' };
      }));
    }
    return rankScores(all);
  }
  function rankScores(rows) {
    var best = {};
    rows.forEach(function (r) {
      var key = r.name + '|' + r.phone4;
      var cur = best[key];
      if (!cur || r.score > cur.score || (r.score === cur.score && r.at < cur.at)) best[key] = r;
    });
    return Object.keys(best).map(function (k) { return best[k]; })
      .sort(function (a, b) { return b.score - a.score || (a.at < b.at ? -1 : 1); })
      .map(function (r, i) { return { rank: i + 1, name: r.name, score: r.score, at: r.at, mine: r.cid === clientId }; });
  }

  // ---------------------------------------------------------------- validation
  function checkName(name) {
    var n = line(name, 30);
    if (!n) throw fail('invalid', '성함을 입력해 주세요.');
    return n;
  }
  function checkPhone(phone) {
    var d = digits(phone);
    // A Korean number written with the country code (+82 10-1234-5678) is stored as 01012345678.
    if (/^82[1-9]/.test(d) && d.length >= 11) d = '0' + d.slice(2);
    // Korean numbers start with 0 and have 9-11 digits; anything else must be a full international number.
    if (d.charAt(0) === '0' ? d.length < 9 || d.length > 11 : d.length < 10 || d.length > 15) {
      throw fail('invalid', '연락처를 정확히 입력해 주세요.');
    }
    return d;
  }

  // ---------------------------------------------------------------- public API
  var api = {
    mode: MODE,          // 'live' | 'demo'
    samples: SAMPLES,    // true when sample entries are mixed in (local preview only)
    clientId: clientId,
    version: '',

    /** Wake the Apps Script container early so the first real submit is fast. */
    warmup: function () {
      if (MODE !== 'live' || api._warm) return Promise.resolve();
      api._warm = true;
      return get({ action: 'ping' }).catch(function () { api._warm = false; });
    },

    /**
     * RSVP. attending: true/false. side: 'groom' | 'bride' | ''. count (total people incl. guest) and meal ('yes' |
     * 'no') are optional: sent and kept only when the page asks for them (v1-conf asks neither).
     * Re-submitting updates the earlier answer only when it carries the same phone number and either the same name
     * (spaces and letter case ignored) or comes from the same browser; anyone else gets an answer of their own
     * (backend/README.md §3).
     * prevPhone: the number of the answer being edited, when the guest corrected it, so the server can update that
     * answer instead of adding a second one.
     */
    submitRSVP: function (o) {
      o = o || {};
      try {
        var rec = {
          action: 'rsvp',
          name: checkName(o.name),
          phone: checkPhone(o.phone),
          attending: o.attending === true || o.attending === 'yes' ? 'yes' : o.attending === false || o.attending === 'no' ? 'no' : '',
          side: o.side === 'groom' || o.side === 'bride' ? o.side : '',
          message: para(o.message, 500),
        };
        if (!rec.attending) throw fail('invalid', '참석 여부를 선택해 주세요.');
        if (o.count != null && o.count !== '') {
          rec.count = Math.max(0, Math.min(20, parseInt(o.count, 10) || (rec.attending === 'no' ? 0 : 1)));
        }
        if (o.meal === 'yes' || o.meal === 'no') rec.meal = o.meal;
        var prevPhone = digits(o.prevPhone);
        if (prevPhone && prevPhone !== rec.phone) rec.prevPhone = prevPhone;
      } catch (e) { return Promise.reject(e); }
      if (UNSET) return notReady();
      var done = function () {
        // Keep meal and message too, so an edit form can prefill them instead of sending them blank.
        // Like the server, an edit without a message keeps the earlier one, but only under the same name: on a phone
        // two guests share, 응답 수정하기 never prefills the other guest's message.
        var prev = load('rsvp', null);
        var same = prev && (prev.phone === rec.phone || prev.phone === rec.prevPhone) && nameKey(prev.name) === nameKey(rec.name);
        var message = rec.message || (same && prev.message) || '';
        save('rsvp', { name: rec.name, phone: rec.phone, attending: rec.attending, side: rec.side, count: rec.count, meal: rec.meal, message: message, at: new Date().toISOString() });
        return { ok: true };
      };
      if (MODE === 'demo') return later().then(done);
      return post(rec).then(done);
    },

    /** The RSVP this browser sent before (or null) — handy for "이미 응답하셨어요". */
    myRSVP: function () { return load('rsvp', null); },

    /**
     * Guest review. rating: optional integer 1-10. extra: optional small object
     * (e.g. { confidence: 5, decision: 'Accept' }) for version-specific fields.
     */
    submitReview: function (o) {
      o = o || {};
      var rec;
      try {
        rec = {
          action: 'review',
          name: checkName(o.name),
          text: para(o.text, 1500),
          title: line(o.title, 60),
          rating: rating(o.rating),
          extra: o.extra && typeof o.extra === 'object' ? o.extra : {},
        };
        if (!rec.text) throw fail('invalid', '내용을 입력해 주세요.');
        if (JSON.stringify(rec.extra).length > 1000) throw fail('invalid', '추가 정보가 너무 길어요.');
      } catch (e) { return Promise.reject(e); }
      if (UNSET) return notReady();
      if (MODE === 'demo') {
        var review = {
          id: uid().replace(/-/g, '').slice(0, 10), name: rec.name, rating: rec.rating, title: rec.title, text: rec.text,
          extra: rec.extra, likes: 0, createdAt: new Date().toISOString(), mine: true,
        };
        var list = load('demo:reviews', []);
        list.unshift(review);
        save('demo:reviews', list);
        return later({ ok: true, review: review });
      }
      return post(rec).then(function (d) { return { ok: true, review: d.review }; });
    },

    /** Newest first. Each item: {id, name, rating, title, text, extra, likes, createdAt, mine, liked}. */
    listReviews: function (o) {
      var limit = (o && o.limit) || 200;
      if (MODE === 'demo') {
        var liked = load('demo:liked', {});
        return later(demoReviews().slice(0, limit).map(function (r) {
          // Sample reviews are never saved, so a like on one is added back here.
          return Object.assign({}, r, { liked: !!liked[r.id], likes: (r.likes || 0) + (r.sample && liked[r.id] ? 1 : 0) });
        }));
      }
      return get({ action: 'reviews', limit: limit }).then(function (d) {
        var liked = load('liked', {});
        return (d.reviews || []).map(function (r) { r.liked = !!(r.liked || liked[r.id]); return r; });
      });
    },

    /** Toggle-free "like" (once per browser). Resolves to {likes}. */
    likeReview: function (id) {
      if (MODE === 'demo') {
        var liked = load('demo:liked', {});
        var list = load('demo:reviews', []);
        var r = list.filter(function (x) { return x.id === id; })[0] ||
          SAMPLE_REVIEWS.filter(function (x) { return x.id === id; })[0];
        if (!r) return Promise.reject(fail('invalid', '리뷰를 찾을 수 없어요.'));
        if (!liked[id]) {
          liked[id] = true; save('demo:liked', liked);
          if (!r.sample) { r.likes = (r.likes || 0) + 1; save('demo:reviews', list); }
        }
        return later({ likes: (r.likes || 0) + (r.sample ? 1 : 0) });
      }
      return post({ action: 'like', id: String(id) }).then(function (d) {
        var liked = load('liked', {});
        liked[id] = true;
        save('liked', liked);
        return { likes: d.likes };
      });
    },

    /** Hide a review written from this browser. */
    deleteReview: function (id) {
      if (MODE === 'demo') {
        save('demo:reviews', load('demo:reviews', []).filter(function (r) { return r.id !== id; }));
        return later({ ok: true });
      }
      return post({ action: 'delete', id: String(id) }).then(function () { return { ok: true }; });
    },

    /**
     * Call right before a round starts; pass the returned sessionId to submitScore.
     * Resolves to {sessionId, seed}. If the network fails, still resolves (sessionId: null)
     * so the game remains playable — such scores are stored but not ranked.
     */
    startGame: function (game) {
      var g = line(game, 40) || 'game';
      if (MODE === 'demo') return Promise.resolve({ sessionId: 'demo-' + uid(), seed: Math.floor(Math.random() * 2147483647), demo: true });
      return post({ action: 'start', game: g })
        .then(function (d) { return { sessionId: d.sessionId, seed: d.seed }; })
        .catch(function () { return { sessionId: null, seed: Math.floor(Math.random() * 2147483647), offline: true }; });
    },

    /**
     * Submit a finished round. phone4: last 4 digits of the player's phone (to find the winner).
     * Resolves to {valid, reason, rank, best, leaderboard}.
     */
    submitScore: function (o) {
      o = o || {};
      var rec;
      try {
        rec = {
          action: 'score',
          game: line(o.game, 40) || 'game',
          sessionId: o.sessionId || '',
          name: checkName(o.name),
          phone4: digits(o.phone4).slice(-4),
          score: Math.floor(Number(o.score)),
          durationMs: Math.max(0, Math.floor(Number(o.durationMs) || 0)),
          extra: o.extra && typeof o.extra === 'object' ? o.extra : {},
        };
        if (rec.phone4.length !== 4) throw fail('invalid', '연락처 뒤 4자리를 입력해 주세요.');
        if (JSON.stringify(rec.extra).length > 8000) rec.extra = { truncated: true };
        if (!isFinite(rec.score) || rec.score < 0) throw fail('invalid', '점수가 올바르지 않아요.');
      } catch (e) { return Promise.reject(e); }
      if (UNSET) return notReady();
      save('player', { name: rec.name, phone4: rec.phone4 });
      if (MODE === 'demo') {
        // as Code.gs does: after the cutoff a run is kept but not ranked
        var W = window.WEDDING, late = !!(W && W.contest && Date.now() > new Date(W.contest.gameCutoff).getTime());
        var all = load('demo:scores', []);
        all.push({ game: rec.game, name: rec.name, phone4: rec.phone4, score: rec.score, at: new Date().toISOString(), cid: clientId, valid: !late });
        save('demo:scores', all);
        var board = demoBoard(rec.game);
        if (late) return later({ valid: false, reason: 'after cutoff', rank: null, best: null, leaderboard: board.slice(0, 20) });
        var me = board.filter(function (r) { return r.mine; })[0];
        return later({ valid: true, rank: me ? me.rank : null, best: me ? me.score : rec.score, leaderboard: board.slice(0, 20) });
      }
      return post(rec).then(function (d) {
        return { valid: !!d.valid, reason: d.reason || '', rank: d.rank || null, best: d.best, leaderboard: d.leaderboard || [] };
      });
    },

    /** Best score per player, highest first: [{rank, name, score, at, mine}]. */
    leaderboard: function (game, o) {
      var g = line(game, 40) || 'game';
      var limit = (o && o.limit) || 20;
      if (MODE === 'demo') return later(demoBoard(g).slice(0, limit));
      return get({ action: 'leaderboard', game: g, limit: limit }).then(function (d) { return d.leaderboard || []; });
    },

    /** Name + last-4 the player used last time, to prefill the form. */
    lastPlayer: function () { return load('player', null); },
  };

  window.WeddingAPI = api;
  if (MODE === 'demo' && window.console) {
    console.info('[WeddingAPI] demo mode — set WEDDING_CONFIG.apiUrl to store RSVPs, reviews and scores for real.');
  }
})();
