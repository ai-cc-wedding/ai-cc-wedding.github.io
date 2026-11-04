/* Human SVM — pure, deterministic game core (no DOM).  Core v3.
 *
 * The same file is pasted into backend/Code.gs (Apps Script, V8) to replay a run:
 *   SVMCore.replay(seed, log) === submitted score          (see GAME.md · "Server-side checks")
 * Determinism: seeded PRNG (mulberry32 per round); only + − × ÷, Math.sqrt, Math.round and Math.imul
 * (no trigonometry, pow, exp or log); every coordinate quantised to 1e-4; time counted in 60 Hz ticks;
 * integer scores.
 */
(function (root) {
  'use strict';

  var Q = 10000;                       // coordinate quantum (1e-4 of the field)
  var TICK_MS = 1000 / 60;             // fixed logic step
  var MIN_INPUT_TICKS = 15;            // input is ignored for the first 250 ms of a round
  function sec(s) { return MIN_INPUT_TICKS + Math.round(s * 60); }

  // An unscored practice round (its own seed stream, never logged).
  var PRACTICE = Object.freeze({ per: 3, gap: 0.15, band: 0.28, minD: 0.08, ticks: sec(15), max: 55000, practice: true });

  // Ten scored rounds. per: guests on each side · gap: half-width of the empty corridor the generator keeps
  // (the SVM margin is at least this) · band: depth of the seating area beyond it · minD: spacing between guests ·
  // ticks: time limit (60 Hz, including the 250 ms lock) · blind: the live aisle preview is hidden ("double-blind") ·
  // max: the round's points (they rise from 55 000 to 145 000; 1 000 000 in total).
  var ROUNDS = [
    { per: 3, gap: 0.130, band: 0.30, minD: 0.078, ticks: sec(6.0), max: 55000 },
    { per: 4, gap: 0.110, band: 0.28, minD: 0.076, ticks: sec(5.5), max: 65000 },
    { per: 5, gap: 0.095, band: 0.26, minD: 0.074, ticks: sec(5.0), max: 75000 },
    { per: 6, gap: 0.080, band: 0.25, minD: 0.072, ticks: sec(4.5), max: 85000 },
    { per: 7, gap: 0.068, band: 0.24, minD: 0.070, ticks: sec(4.0), max: 95000 },
    { per: 8, gap: 0.058, band: 0.23, minD: 0.068, ticks: sec(4.0), max: 105000, blind: true },
    { per: 9, gap: 0.050, band: 0.23, minD: 0.066, ticks: sec(3.75), max: 115000, blind: true },
    { per: 10, gap: 0.044, band: 0.23, minD: 0.064, ticks: sec(3.5), max: 125000, blind: true },
    { per: 10, gap: 0.038, band: 0.23, minD: 0.064, ticks: sec(3.25), max: 135000, blind: true },
    { kernel: true, inner: 8, outer: 10, rIn: 0.205, rOut: 0.245, ticks: sec(5.0), max: 145000 },
  ];
  ROUNDS.forEach(Object.freeze);
  Object.freeze(ROUNDS);

  // Shares of a round's points: every guest on the right side 1/5, the aisle 2/5 × (m / m*)⁶, speed 2/5 × time left.
  var SHARE = Object.freeze({ sep: 0.2, margin: 0.4, speed: 0.4 });
  var MAX_SCORE = 0;
  ROUNDS.forEach(function (r) { MAX_SCORE += r.max; });  // 1 000 000

  function q(v) { return Math.round(v * Q) / Q; }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function roundRng(seed, r) {
    var s = ((seed >>> 0) ^ Math.imul(0x9E3779B1, r + 1)) >>> 0;
    var rng = mulberry32(s);
    rng(); rng(); // warm up
    return rng;
  }

  function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

  /** Kernel lift used in the last round: y' = f(r²), so the ring becomes linearly separable. */
  function lift(x, y) {
    var dx = x - 0.5, dy = y - 0.5;
    var r2 = dx * dx + dy * dy;
    var t = r2 / 0.1764; if (t > 1) t = 1;
    return 0.92 - 0.84 * t;
  }

  function genLinear(rng, cfg) {
    var nx, ny, l2;
    do { nx = rng() * 2 - 1; ny = rng() * 2 - 1; l2 = nx * nx + ny * ny; } while (l2 < 0.04 || l2 > 1);
    var l = Math.sqrt(l2); nx /= l; ny /= l;
    var cx = 0.5 + (rng() - 0.5) * 0.12, cy = 0.5 + (rng() - 0.5) * 0.12;
    var c = nx * cx + ny * cy;
    var posClass = rng() < 0.5 ? 0 : 1;
    var need = [cfg.per, cfg.per], near = [false, false], pts = [];
    var minD = cfg.minD, edge = cfg.gap + Math.min(0.035, cfg.gap * 0.6), tries = 0;
    while ((need[0] > 0 || need[1] > 0) && tries < 60000) {
      tries++;
      var relax = tries > 30000; // practically never; keeps any seed solvable
      var x = 0.07 + rng() * 0.86, y = 0.07 + rng() * 0.86;
      var d = nx * x + ny * y - c, ad = d < 0 ? -d : d;
      if (ad < cfg.gap || ad > cfg.gap + cfg.band + (relax ? 0.2 : 0)) continue;
      var cls = d > 0 ? posClass : 1 - posClass;
      if (need[cls] <= 0) continue;
      var isNear = ad <= edge;
      if (need[cls] === 1 && !near[cls] && !isNear && !relax) continue; // each class keeps one guest on the edge
      var ok = true, md2 = (relax ? minD * 0.7 : minD); md2 *= md2;
      for (var i = 0; i < pts.length; i++) if (dist2(pts[i].x, pts[i].y, x, y) < md2) { ok = false; break; }
      if (!ok) continue;
      pts.push({ x: q(x), y: q(y), c: cls });
      if (isNear) near[cls] = true;
      need[cls]--;
    }
    return pts;
  }

  /** A ring: `inner` guests within rIn of the centre, `outer` guests beyond rOut. */
  function genKernel(rng, cfg) {
    var inCls = rng() < 0.5 ? 0 : 1, nIn = cfg.inner, nOut = cfg.outer, pts = [], tries = 0;
    var r0 = 0.05, r2 = cfg.rOut, r3 = 0.41;
    var edgeIn = false, edgeOut = false;
    while ((nIn > 0 || nOut > 0) && tries < 60000) {
      tries++;
      var ux = rng() * 2 - 1, uy = rng() * 2 - 1, l2 = ux * ux + uy * uy;
      if (l2 > 1 || l2 < 0.0004) continue;
      var l = Math.sqrt(l2); ux /= l; uy /= l;
      var isIn = nIn > 0 && (nOut === 0 || rng() < 0.45);
      var r;
      if (isIn) r = nIn === 1 && !edgeIn ? cfg.rIn - 0.02 + rng() * 0.02 : r0 + rng() * (cfg.rIn - r0);
      else r = nOut === 1 && !edgeOut ? cfg.rOut + rng() * 0.02 : r2 + rng() * (r3 - r2);
      var x = q(0.5 + ux * r), y = q(0.5 + uy * r), ly = q(lift(x, y));
      var ok = true;
      for (var i = 0; i < pts.length; i++) {
        if (dist2(pts[i].x, pts[i].y, x, y) < 0.0049 || dist2(pts[i].x, pts[i].ly, x, ly) < 0.0030) { ok = false; break; }
      }
      if (!ok && tries < 40000) continue;
      pts.push({ x: x, y: y, ly: ly, c: isIn ? inCls : 1 - inCls });
      if (isIn) { nIn--; if (r >= cfg.rIn - 0.02) edgeIn = true; } else { nOut--; if (r <= cfg.rOut + 0.02) edgeOut = true; }
    }
    return pts;
  }

  /** Closest point of segment ab to p: [distance, cx, cy]. */
  function segClosest(px, py, ax, ay, bx, by) {
    var vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
    var L2 = vx * vx + vy * vy, t = L2 > 0 ? (wx * vx + wy * vy) / L2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    var cx = ax + t * vx, cy = ay + t * vy, dx = px - cx, dy = py - cy;
    return [Math.sqrt(dx * dx + dy * dy), cx, cy];
  }

  /**
   * Hard-margin SVM optimum in 2-D = half the distance between the two convex hulls.
   * Brute force over point-to-segment distances (n ≤ 20). Returns {margin, p, q} where p/q are
   * the closest points of the two hulls (the optimal line is their perpendicular bisector).
   */
  function optimum(pts, kernel) {
    var A = [], B = [];
    for (var i = 0; i < pts.length; i++) {
      var pt = [pts[i].x, kernel ? pts[i].ly : pts[i].y];
      (pts[i].c === 0 ? A : B).push(pt);
    }
    var best = Infinity, P = null, Qp = null;
    function scan(S, T, flip) {
      for (var a = 0; a < S.length; a++) {
        for (var j = 0; j < T.length; j++) {
          for (var k = j; k < T.length; k++) {
            var r = segClosest(S[a][0], S[a][1], T[j][0], T[j][1], T[k][0], T[k][1]);
            if (r[0] < best) {
              best = r[0];
              if (flip) { P = [r[1], r[2]]; Qp = S[a]; } else { P = S[a]; Qp = [r[1], r[2]]; }
            }
          }
        }
      }
    }
    scan(A, B, false);
    scan(B, A, true);
    return { margin: best / 2, p: P, q: Qp };
  }

  function build(index, cfg, rng) {
    var pts = cfg.kernel ? genKernel(rng, cfg) : genLinear(rng, cfg);
    return {
      index: index, kernel: !!cfg.kernel, blind: !!cfg.blind, practice: !!cfg.practice,
      pts: pts, ticks: cfg.ticks, max: cfg.max, opt: optimum(pts, !!cfg.kernel),
    };
  }
  /** The ten scored rounds of a seed. */
  function makeRounds(seed) {
    var out = [];
    for (var r = 0; r < ROUNDS.length; r++) out.push(build(r, ROUNDS[r], roundRng(seed, r)));
    return out;
  }
  /** The practice round of a seed (unscored). */
  function makePractice(seed) { return build(-1, PRACTICE, roundRng(seed, 100)); }

  var LO = -0.25, HI = 1.25; // logged endpoints stay inside this box (the field is [0, 1]²)
  /**
   * Quantise a line [x1, y1, x2, y2]. A stroke that starts or ends outside the box is clipped along itself
   * (Liang–Barsky), so the infinite line — the only thing that is scored — never tilts.
   */
  function quantLine(line) {
    if (!line) return null;
    var v = [], i;
    for (i = 0; i < 4; i++) { var n = Number(line[i]); if (!isFinite(n)) return null; v.push(n); }
    var inside = true;
    for (i = 0; i < 4; i++) if (v[i] < LO || v[i] > HI) inside = false;
    if (!inside) {
      var dx = v[2] - v[0], dy = v[3] - v[1], s0 = -Infinity, s1 = Infinity, ok = dx !== 0 || dy !== 0;
      var P = [-dx, dx, -dy, dy], Qv = [v[0] - LO, HI - v[0], v[1] - LO, HI - v[1]];
      for (i = 0; i < 4 && ok; i++) {
        if (P[i] === 0) { if (Qv[i] < 0) ok = false; continue; }
        var t = Qv[i] / P[i];
        if (P[i] < 0) { if (t > s0) s0 = t; } else if (t < s1) s1 = t;
      }
      if (ok && s0 <= s1) v = [v[0] + dx * s0, v[1] + dy * s0, v[0] + dx * s1, v[1] + dy * s1];
      for (i = 0; i < 4; i++) { if (v[i] < LO) v[i] = LO; else if (v[i] > HI) v[i] = HI; } // float dust; lines missing the box
    }
    return [q(v[0]), q(v[1]), q(v[2]), q(v[3])];
  }

  /**
   * Evaluate a line [x1, y1, x2, y2] (field units) against a round.
   * Returns null for a degenerate line, else {correct, n, margin, ok[], dist[], nx, ny, c, orient, line}.
   * orient 0: class 0 (♥) on the positive side of the normal.
   */
  function evaluate(round, line) {
    var L = quantLine(line);
    if (!L) return null;
    var dx = L[2] - L[0], dy = L[3] - L[1], len = Math.sqrt(dx * dx + dy * dy);
    if (!(len >= 0.02)) return null;
    var nx = -dy / len, ny = dx / len, c = nx * L[0] + ny * L[1];
    var pts = round.pts, s = [], cnt = [[0, 0], [0, 0]];
    for (var i = 0; i < pts.length; i++) {
      var py = round.kernel ? pts[i].ly : pts[i].y;
      var d = nx * pts[i].x + ny * py - c;
      s.push(d);
      cnt[pts[i].c][d > 0 ? 1 : 0]++;
    }
    var a = cnt[0][1] + cnt[1][0], b = cnt[0][0] + cnt[1][1];
    var orient = a >= b ? 0 : 1, correct = a >= b ? a : b;
    var ok = [], margin = Infinity;
    for (var j = 0; j < pts.length; j++) {
      var pos = s[j] > 0;
      var good = orient === 0 ? (pts[j].c === 0) === pos : (pts[j].c === 1) === pos;
      ok.push(good);
      var ad = s[j] < 0 ? -s[j] : s[j];
      if (ad < margin) margin = ad;
    }
    return { correct: correct, n: pts.length, margin: correct === pts.length ? margin : 0, ok: ok, dist: s,
      nx: nx, ny: ny, c: c, orient: orient, line: L };
  }

  /**
   * Integer score of one round (M = the round's points). tick = logic tick at which the line was committed.
   *  - every guest on the right side: M/5 + round(2M/5 × r⁶) + round(2M/5 × time left / time),
   *    with r = m / m* (your aisle ÷ the SVM's widest aisle, ≤ 1, kept to 6 decimals);
   *  - otherwise round(M/5 × (2·correct − n) / n): a coin-flip line earns 0, one wrong guest of 20 earns 90 % of M/5;
   *  - no line (time out): 0.
   */
  function scoreRound(round, line, tick) {
    var n = round.pts.length, M = round.max;
    var ev = line ? evaluate(round, line) : null;
    var out = { total: 0, sep: 0, mg: 0, sp: 0, ratio: 0, correct: 0, n: n, perfect: false, tick: 0, max: M, ev: ev };
    if (!ev) return out;
    out.correct = ev.correct;
    if (ev.correct < n) {
      out.sep = Math.round(M * (2 * ev.correct - n) / (5 * n));
      out.total = out.sep;
      return out;
    }
    var r = round.opt.margin > 0 ? ev.margin / round.opt.margin : 0;
    if (r > 1) r = 1;
    r = Math.round(r * 1e6) / 1e6;
    var r2 = r * r;
    var t = Math.max(MIN_INPUT_TICKS, Math.min(round.ticks, Math.floor(Number(tick) || 0)));
    out.perfect = true;
    out.ratio = r;
    out.tick = t;
    out.sep = Math.round(M / 5);
    out.mg = Math.round(2 * M * r2 * r2 * r2 / 5);
    out.sp = Math.round(2 * M * (round.ticks - t) / (5 * (round.ticks - MIN_INPUT_TICKS)));
    out.total = out.sep + out.mg + out.sp;
    return out;
  }

  function rowLine(e) { return e && e.length >= 5 ? [e[0] / Q, e[1] / Q, e[2] / Q, e[3] / Q] : null; }

  /** Server-side replay. log.r = [[x1,y1,x2,y2,tick,method,moves] | null, …] (coordinates ×10000). */
  function replay(seed, log) {
    var rounds = makeRounds(seed >>> 0), total = 0;
    var rows = (log && log.r) || [];
    for (var i = 0; i < rounds.length; i++) {
      var e = rows[i];
      total += scoreRound(rounds[i], rowLine(e), e ? e[4] : 0).total;
    }
    return total;
  }

  /** Per-round detail of a logged run, for checking the prize winners by hand. */
  function inspect(seed, log) {
    var rounds = makeRounds(seed >>> 0), rows = (log && log.r) || [], out = [], total = 0;
    for (var i = 0; i < rounds.length; i++) {
      var e = rows[i], res = scoreRound(rounds[i], rowLine(e), e ? e[4] : 0);
      total += res.total;
      out.push({ round: i + 1, total: res.total, perfect: res.perfect, ratio: res.ratio, correct: res.correct, n: res.n,
        seconds: e ? Math.round((e[4] - MIN_INPUT_TICKS) / 60 * 100) / 100 : null, method: e ? e[5] : -1 });
    }
    return { total: total, rounds: out };
  }

  root.SVMCore = Object.freeze({
    VERSION: 3,              // v3: practice + ten rounds, continuous (m/m*)⁶ margin and per-tick speed scoring, 1 000 000 max
    GAME_ID: 'v1-svm',
    Q: Q,
    TICK_MS: TICK_MS,
    MIN_INPUT_TICKS: MIN_INPUT_TICKS,
    ROUNDS: ROUNDS,
    PRACTICE: PRACTICE,
    SHARE: SHARE,
    MAX_SCORE: MAX_SCORE,
    lift: lift,
    makeRounds: makeRounds,
    makePractice: makePractice,
    evaluate: evaluate,
    scoreRound: scoreRound,
    quantLine: quantLine,
    replay: replay,
    inspect: inspect,
  });
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this); // window in browsers, the global object in Apps Script
