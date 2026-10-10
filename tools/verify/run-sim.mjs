// A frame-exact copy of the physics in game-run.js, and a planner over it, for
// tools/verify/run-bot.mjs. The level and the player come from the page's
// read-only ?debug=run hook (window.JG_RUN_DEBUG), so the geometry is never
// copied by hand. If game-run.js changes how the player moves, change step()
// here too: the bot checks every frame it plays against this copy and says so
// when they part.
//
// One frame is what the page does in one requestAnimationFrame under the bot's
// paused clock: 16 ms, the fixed 120 Hz steps that fit, a hitstop when a medal
// is first picked up. Inputs change only between frames, as real key and touch
// events do.

export const FRAME = 0.016;

export function makeWorld(L, P, STEP, TS, still, touch) {
  return { L, P, STEP, TS, still: !!still, touch: !!touch, hasMovers: L.movers.length > 0 };
}
// the stick pushed all the way reads exactly as game-run.js computes it
const stickX = d => d ? (d - Math.sign(d) * 0.18) / 0.82 : 0;

export function initState(W, s) {
  return {
    x: s.pl.x, y: s.pl.y, vx: s.pl.vx, vy: s.pl.vy, ground: s.pl.ground, on: s.pl.on, face: s.pl.face,
    coyote: s.pl.coyote, buf: s.pl.buf, boost: s.pl.boost || 0, drop: s.pl.drop || 0, fallV: s.pl.fallV || 0,
    t: s.t, acc: s.acc, hitstop: s.hitstop, jh: !!s.input.jump, jp: !!s.input.jumpPress,
    groups: Object.assign({}, s.groups), ghosts: s.ghosts.map(g => ({ on: g.on, a: g.a })), doors: s.doors.slice(),
    got: s.medals.map(m => m.got || m.now), dead: s.pl.dead > 0, finished: s.finished, frames: 0, steps: s.steps, picked: []
  };
}

export function clone(S) {
  return { ...S, groups: { ...S.groups }, ghosts: S.ghosts.map(g => ({ on: g.on, a: g.a })), doors: S.doors.slice(), got: S.got.slice(), picked: S.picked.slice() };
}

function moverAt(m, t) { const f = 0.5 - 0.5 * Math.cos(2 * Math.PI * (t / m.per + m.ph)); return { x: m.x0 + m.dx * f, y: m.y0 + m.dy * f }; }
function approach(v, t, d) { return v < t ? Math.min(v + d, t) : Math.max(v - d, t); }
function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

// one frame of input: { x: -1|0|1, run: bool, jump: bool }
export function frame(W, S, inp) {
  if (S.dead || S.finished) { S.frames++; return S; }
  if (inp.jump && !S.jh) S.jp = true;
  S.jh = !!inp.jump;
  const dt = FRAME;
  if (S.hitstop > 0) S.hitstop -= dt;
  else {
    S.acc += dt; let n = 0;
    while (S.acc >= W.STEP && n++ < 6) { step(W, S, W.STEP, inp); S.acc -= W.STEP; if (S.dead || S.finished) break; }
    if (n >= 6) S.acc = 0;
  }
  S.frames++;
  return S;
}

function step(W, S, dt, inp0) {
  const { P, L, TS } = W;
  const inp = W.touch ? { x: stickX(inp0.x), run: Math.abs(stickX(inp0.x)) > 0.86, jump: inp0.jump } : inp0;
  S.t += dt; S.steps++;
  const mv = L.movers.map(m => { const a = moverAt(m, S.t - dt), b = moverAt(m, S.t); return { x: b.x, y: b.y, px: a.x, py: a.y, w: m.w, mover: 1 }; });
  // carried by a mover
  if (S.ground && S.on && S.on.k === 'mover') { const m = mv[S.on.i]; S.x += m.x - m.px; S.y += m.y - m.py; }
  // run
  const max = inp.run ? P.run : P.walk, tgt = inp.x * max;
  let a;
  if (S.ground) a = inp.x ? ((tgt > 0) !== (S.vx > 0) && Math.abs(S.vx) > 20 ? P.accTurn : P.accG) : P.decG;
  else a = inp.x ? P.accA : P.decA;
  S.vx = approach(S.vx, tgt, a * dt);
  if (inp.x) S.face = inp.x > 0 ? 1 : -1;
  // jump
  if (S.jp) { S.buf = P.buffer; S.jp = false; }
  S.buf -= dt; S.coyote = S.ground ? P.coyote : S.coyote - dt;
  if (S.buf > 0 && S.coyote > 0) { S.vy = -P.v0; S.ground = false; S.on = null; S.coyote = 0; S.buf = 0; S.jumps = (S.jumps || 0) + 1; }
  // gravity
  if (S.boost > 0) S.boost -= dt;
  let g;
  if (S.vy < 0) g = (inp.jump || S.boost > 0) ? (S.vy > -90 ? P.gUp * P.apex : P.gUp) : P.gCut;
  else g = (inp.jump && S.vy < 90) ? P.gFall * 0.6 : P.gFall;
  S.vy = Math.min(S.vy + g * dt, P.maxFall);
  // x
  S.x += S.vx * dt;
  const sol = L.solids.slice();
  L.doors.forEach((d, i) => { if (S.doors[i] < 0.8) sol.push({ x: d.x, y: d.y, w: d.w, h: d.h * (1 - S.doors[i]) }); });
  for (const s of sol) {
    if (overlap({ x: S.x, y: S.y, w: P.w, h: P.h }, s)) {
      if (S.vx > 0 || (S.x + P.w / 2) < s.x + s.w / 2) S.x = s.x - P.w; else S.x = s.x + s.w;
      S.vx = 0;
    }
  }
  S.x = Math.min(Math.max(S.x, 0), L.w - P.w);
  // y
  const prevB = S.y + P.h, wasGround = S.ground;
  S.y += S.vy * dt;
  S.ground = false; let on = null;
  for (const s of sol) {
    if (overlap({ x: S.x, y: S.y, w: P.w, h: P.h }, s)) {
      if (S.vy >= 0 && prevB <= s.y + 12) { S.y = s.y - P.h; on = { k: 'solid' }; }
      else if (S.vy < 0) { S.y = s.y + s.h; S.vy = 30; }
      else { S.y = s.y - P.h; on = { k: 'solid' }; }
    }
  }
  if (S.drop > 0) S.drop -= dt;
  if (S.vy >= 0 && !(S.drop > 0)) {
    const ones = [];
    L.ones.forEach((o, i) => ones.push({ o, ref: { k: 'one', i } }));
    L.ghosts.forEach((gh, i) => { if (S.ghosts[i].on && S.ghosts[i].a > 0.3) ones.push({ o: gh, ref: { k: 'ghost', i } }); });
    mv.forEach((m, i) => ones.push({ o: m, ref: { k: 'mover', i } }));
    for (const { o, ref } of ones) {
      const top = o.y, ptop = o.mover ? o.py : o.y;
      if (S.x + P.w > o.x + 2 && S.x < o.x + o.w - 2 && prevB <= ptop + 4 + Math.max(0, o.y - (o.py || o.y)) && S.y + P.h >= top) { S.y = top - P.h; on = ref; }
    }
  }
  if (S.vy > 0) for (const p of L.pads) {
    const feet = S.y + P.h, over = S.x + P.w > p.x + 4 && S.x < p.x + p.w - 4;
    if (over && ((prevB <= p.y + 10 && feet >= p.y) || (wasGround && prevB >= p.y && prevB <= p.y + 16))) {
      S.y = p.y - P.h; S.vy = -P.pad * (inp.jump ? 1.06 : 1); S.boost = 0.6; on = null; S.pads = (S.pads || 0) + 1;
    }
  }
  if (on) { S.vy = 0; S.ground = true; S.on = on; }
  if (S.vy > 0) S.fallV = S.vy; else if (S.ground) S.fallV = 0;
  // the world
  const cx = S.x + P.w / 2, cy = S.y + P.h / 2, box = { x: S.x, y: S.y, w: P.w, h: P.h };
  L.trigs.forEach(t => {
    if (!S.groups[t.g] && overlap(box, t)) { S.groups[t.g] = 1; L.ghosts.forEach((gh, i) => { if (gh.g === t.g) S.ghosts[i].on = true; }); }
  });
  L.ghosts.forEach((gh, i) => {
    const st = S.ghosts[i];
    if (!st.on && gh.g === '~' && Math.abs(cx - (gh.x + gh.w / 2)) < TS * 6.5 && cy > gh.y - TS * 7) st.on = true;
    if (st.on) st.a = Math.min(1, st.a + dt * 2.4);
  });
  L.doors.forEach((d, i) => { if (S.groups[d.g]) S.doors[i] = Math.min(1, S.doors[i] + dt * 1.6); });
  L.medals.forEach((m, i) => {
    if (S.got[i]) return;
    if (Math.abs(cx - m.x) < 26 && Math.abs(cy - m.y) < 32) { S.got[i] = true; S.picked.push(m.slug); if (!W.still) S.hitstop = 0.09; }
  });
  if (L.goal && overlap(box, { x: L.goal.x + TS * 0.4, y: L.goal.y - L.goal.h, w: L.goal.w - TS * 0.8, h: L.goal.h })) S.finished = true;
  if (S.y > L.bot + TS * 2) S.dead = true;
}

// ---------- the planner ----------
// Macro actions from a standing (or just-landed) state. Each is a list of frame
// inputs; the search plays them through the copy and keeps the ones that land.
function macros(touch, walkOnly) {
  const out = [];
  const run = d => touch ? d !== 0 : (!walkOnly && d !== 0);
  for (const d of [1, -1]) out.push({ kind: 'move', d, k: 4, air: d, gen: f => ({ x: d, run: run(d), jump: false }) });
  for (const d of [1, -1]) out.push({ kind: 'move', d, k: 4, air: 0, gen: (f, air) => ({ x: air ? 0 : d, run: run(air ? 0 : d), jump: false }) });
  out.push({ kind: 'wait', k: 6, gen: () => ({ x: 0, run: false, jump: false }) });
  out.push({ kind: 'wait', k: 18, gen: () => ({ x: 0, run: false, jump: false }) });
  for (const d of [1, 0, -1]) for (const h of [1, 4, 8, 13, 20, 40]) {
    const airs = [[d, 1e9]];
    for (const a of [1, 0, -1]) if (a !== d) for (const s of [3, 8, 16, 30]) airs.push([a, s]);
    for (const [a, s] of airs) out.push({ kind: 'jump', d, h, a, s, gen: f => { const x = f < s ? d : a; return { x, run: run(x), jump: f < h }; } });
  }
  return out;
}

function landedY(S) { return S.y; }

// play one macro; stops on landing (after leaving the ground), death, the finish, or a target medal
export function playMacro(W, S0, mac, isTarget, maxF = 260) {
  const S = clone(S0), inputs = [];
  let left = false, air = false;
  for (let f = 0; f < maxF; f++) {
    let inp;
    if (mac.kind === 'move') inp = mac.gen(f, air && mac.air === 0);
    else inp = mac.gen(f);
    inputs.push(inp);
    frame(W, S, inp);
    if (!S.ground) { left = true; air = true; }
    if (S.dead) return { S, inputs, dead: true };
    if (isTarget(S)) return { S, inputs, hit: true };
    if (S.finished) return { S, inputs };
    const minF = mac.kind === 'jump' ? Math.max(mac.h, 2) : mac.k;
    if (f + 1 >= minF && S.ground && (left || mac.kind !== 'jump')) return { S, inputs };
  }
  return { S, inputs, timeout: true };
}

class Heap {
  constructor() { this.a = []; }
  push(v, p) { const a = this.a; a.push([p, v]); let i = a.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (a[j][0] <= a[i][0]) break; [a[i], a[j]] = [a[j], a[i]]; i = j; } }
  pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } } return top && top[1]; }
  get size() { return this.a.length; }
}

// target: { kind: 'medal', i, x, y } or { kind: 'goal', x, y }
export function plan(W, S0, target, opts = {}) {
  const { P, TS, L } = W;
  const touch = !!opts.touch, walkOnly = !!opts.walkOnly, budget = opts.budget || 40000, weight = opts.weight || 2.5;
  const MAC = macros(touch, walkOnly);
  const isTarget = target.kind === 'medal' ? (S => S.got[target.i]) : (S => S.finished);
  if (isTarget(S0)) return { macros: [], inputs: [], S: S0, expanded: 0 };
  const h = S => {
    const cx = S.x + P.w / 2, cy = S.y + P.h / 2, dx = Math.abs(target.x - cx), dy = target.y - cy;
    return (dx + (dy < 0 ? -dy * 1.6 : dy * 0.4)) / 5;
  };
  const key = S => {
    const nearMover = W.hasMovers && L.movers.some(m => Math.abs(S.x - (m.x0 + m.dx / 2)) < TS * 12);
    const g = Object.keys(S.groups).length + ':' + S.ghosts.filter(x => x.on).length + ':' + S.got.filter(Boolean).length;
    return [Math.round(S.x / 5), Math.round(S.y / 5), Math.round(S.vx / 60), S.ground ? 1 : 0, nearMover ? Math.floor(S.t / 0.2) : 0, g].join(',');
  };
  const heap = new Heap(), seen = new Set();
  const root = { S: S0, parent: null, mac: null, inputs: null, g: 0 };
  heap.push(root, h(S0) * weight);
  seen.add(key(S0));
  let expanded = 0, best = root, bestH = h(S0);
  while (heap.size && expanded < budget) {
    const n = heap.pop(); expanded++;
    for (const mac of MAC) {
      if (mac.kind === 'wait' && !W.hasMovers && !L.ghosts.length && !L.doors.length) continue;
      const r = playMacro(W, n.S, mac, isTarget);
      if (r.dead || r.timeout) continue;
      // a careful player: a jump that dies when pressed a little late, or held a little
      // shorter or longer, costs extra, so the plan takes the safe way where there is one
      let risk = 0;
      if (opts.robust && mac.kind === 'jump' && !r.hit) {
        const late = clone(n.S); for (let f = 0; f < 3; f++) frame(W, late, { x: mac.d, run: mac.d !== 0 && !walkOnly, jump: false });
        // pressed a little early: the same take-off from three frames back along the run
        const early = clone(n.S); early.x -= early.vx * FRAME * 3; early.t -= FRAME * 3;
        for (const [S1, m1] of [[late, mac], [early, mac], [n.S, { ...mac, h: mac.h + 4, gen: f => { const x = f < mac.s ? mac.d : mac.a; return { x, run: x !== 0 && (touch || !walkOnly), jump: f < mac.h + 4 }; } }], [n.S, { ...mac, h: Math.max(1, mac.h - 4), gen: f => { const x = f < mac.s ? mac.d : mac.a; return { x, run: x !== 0 && (touch || !walkOnly), jump: f < Math.max(1, mac.h - 4) }; } }]]) {
          if (S1.dead) { risk += 60; continue; }
          const r2 = playMacro(W, S1, m1, () => false);
          if (r2.dead || r2.timeout) risk += 60;
        }
      }
      const child = { S: r.S, parent: n, mac, inputs: r.inputs, g: n.g + r.inputs.length + risk };
      if (r.hit) return unwind(child, expanded);
      if (r.S.finished && target.kind !== 'goal') continue; // finishing early would end the level
      const k = key(r.S); if (seen.has(k)) continue; seen.add(k);
      const hv = h(r.S);
      if (hv < bestH) { bestH = hv; best = child; }
      heap.push(child, child.g + hv * weight);
    }
  }
  return { fail: true, expanded, closest: best ? { x: best.S.x, y: best.S.y } : null };
}

function unwind(n, expanded) {
  const chain = [];
  for (let c = n; c && c.parent; c = c.parent) chain.push(c);
  chain.reverse();
  return { macros: chain.map(c => ({ mac: c.mac, inputs: c.inputs, S: c.S })), inputs: chain.flatMap(c => c.inputs), S: n.S, expanded };
}

// how forgiving each jump on a route is: play the route with the jump pressed
// up to three frames early or late and held up to three frames shorter or
// longer; a jump that only works one way is a pixel-perfect jump
export function tolerance(W, S0, route, isTarget = () => false) {
  const out = [];
  let S = clone(S0);
  for (let i = 0; i < route.length; i++) {
    const seg = route[i];
    if (seg.mac.kind === 'jump') {
      let ok = 0, tot = 0;
      const want = seg.S;
      for (const dt of [-3, -2, -1, 0, 1, 2, 3]) for (const dh of [-3, 0, 3]) {
        tot++;
        let T = clone(S);
        // shift the take-off: borrow frames from (or give frames to) the run before it
        const pre = dt > 0 ? Array(dt).fill({ x: seg.mac.d, run: seg.inputs[0].run, jump: false }) : [];
        const ins = seg.inputs.slice();
        if (dt < 0 && i > 0) { const prev = route[i - 1]; const cut = Math.min(-dt, prev.inputs.length); T = replayTo(W, S0, route, i - 1, prev.inputs.length - cut); }
        const h = Math.max(1, seg.mac.h + dh);
        const mac = { ...seg.mac, h, gen: f => { const x = f < seg.mac.s ? seg.mac.d : seg.mac.a; return { x, run: seg.inputs[0].run || (x !== 0 && seg.inputs.some(q => q.run)), jump: f < h }; } };
        for (const q of pre) frame(W, T, q);
        if (T.dead) continue;
        const last = i === route.length - 1;
        const r = playMacro(W, T, mac, last ? isTarget : () => false);
        if (last ? (!r.dead && isTarget(r.S)) : (!r.dead && !r.timeout && Math.abs(r.S.y - want.y) < 3 && Math.abs(r.S.x - want.x) < W.TS * 3)) ok++;
      }
      out.push({ at: Math.round(S.x / W.TS * 10) / 10, ok, of: tot });
    }
    S = clone(seg.S);
  }
  return out;
}
function replayTo(W, S0, route, iSeg, nInputs) {
  const S = clone(S0);
  for (let i = 0; i < iSeg; i++) for (const q of route[i].inputs) frame(W, S, q);
  for (let k = 0; k < nInputs; k++) frame(W, S, route[iSeg].inputs[k]);
  return S;
}

// ---------- a human, roughly: the same plan, played with shaky timing ----------
// Every press and release lands up to k frames (16 ms each) early or late. After
// each move the player looks at where they are; if it isn't where they meant to
// be, they plan again from there. A fall costs a respawn at the last lamp, as
// in the game. Returns deaths, frames, and whether they got there at all.
export function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
export function humanTrial(W, spawnS, { k = 2, touch = true, walkOnly = false, rand = Math.random, maxDeaths = 12, maxFrames = 3750 * 2, budget = 20000, robust = true } = {}) {
  const { L, P, TS } = W;
  const goal = { kind: 'goal', x: L.goal.x + L.goal.w / 2, y: L.goal.y - 40 };
  let S = clone(spawnS), deaths = 0, replans = 0, check = null;
  const deathsAt = [];
  const lamp = () => { const cx = S.x + P.w / 2; for (const l of L.lamps) if (cx > l.x - 8 && Math.abs(S.y + P.h - l.y) < TS * 5 && (!check || l.x > check.x || check !== l) ) { if (!check || L.lamps.indexOf(l) >= L.lamps.indexOf(check)) check = l; } };
  function respawn() {
    deaths++; deathsAt.push(Math.round(S.x / TS));
    const c = check || { x: L.spawn[0] * TS, y: L.spawn[1] * TS };
    Object.assign(S, { x: c.x + (check ? 18 : 0) - P.w / 2, y: c.y - P.h, vx: 0, vy: 0, ground: true, on: null, coyote: 0, buf: 0, boost: 0, drop: 0, fallV: 0, dead: false, t: S.t + 0.85, jp: false });
  }
  while (!S.finished && deaths <= maxDeaths && S.frames < maxFrames) {
    let r = plan(W, S, goal, { touch, walkOnly, budget, robust });
    replans++;
    if (r.fail && !S.ground) {
      // already falling where nothing can save it: let it fall
      for (let i = 0; i < 400 && !S.ground && !S.dead; i++) frame(W, S, { x: 0, run: false, jump: false });
      if (S.dead) { respawn(); continue; }
      r = plan(W, S, goal, { touch, walkOnly, budget, robust }); replans++;
    }
    if (r.fail) return { ok: false, stuck: true, deaths, frames: S.frames, replans, at: [Math.round(S.x / TS * 10) / 10, Math.round(S.y / TS * 10) / 10, S.ground, S.on, Math.round(S.t*100)/100], expanded: r.expanded, closest: r.closest, deathsAt };
    // the plan as one timeline, every change of input moved by up to k frames
    const F = r.inputs, bounds = []; let acc = 0; for (const m of r.macros) { acc += m.inputs.length; bounds.push(acc); }
    const ch = [0]; for (let i = 1; i < F.length; i++) { const a = F[i], b = F[i - 1]; if (a.x !== b.x || a.run !== b.run || a.jump !== b.jump) ch.push(i); }
    const moved = ch.map((c, j) => j === 0 ? 0 : c + Math.round((rand() * 2 - 1) * k));
    for (let j = 1; j < moved.length; j++) moved[j] = Math.max(moved[j], moved[j - 1] + 1);
    const G = []; let seg = 0;
    for (let i = 0; i < F.length; i++) { while (seg + 1 < moved.length && moved[seg + 1] <= i) seg++; G.push(F[ch[seg]]); }
    let mi = 0, redo = false;
    for (let i = 0; i < G.length; i++) {
      frame(W, S, G[i]); lamp();
      if (S.dead) { respawn(); redo = true; break; }
      if (S.finished) break;
      if (i + 1 === bounds[mi]) {
        const want = r.macros[mi].S; mi++;
        if (Math.abs(S.y - want.y) > 3 || Math.abs(S.x - want.x) > 10) { redo = true; break; }
      }
    }
    if (!redo && !S.finished && r.inputs.length === 0) break;
  }
  return { ok: S.finished, deaths, frames: S.frames, replans, deathsAt };
}
