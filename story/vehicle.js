/* After Hours: a car you can drive. An arcade-real model: a bicycle model with weight transfer, tyres with a
   slip angle and a grip that falls away past the peak (so the rear can come round), speed-sensitive
   steering, an engine with a torque curve, an automatic box and rpm, brakes, a handbrake that locks the
   rear, reverse; the body pitches, rolls and bobs on its springs, the wheels spin and steer. It hits what's
   on the lot (set.userData.colliders: parked cars, poles, walls, the fence, the gate) and stays inside
   set.userData.driveBounds (the lot, the gate, Almeda Genoa Road; soft walls at the road's ends).
   The contract (fields, units, node names) is tools/story/HANDOFF-drive.md.

   Frame: a car's local +Z is forward, +X its left (the driver's side), +Y up. Inside, the model works in
   the car's frame with x forward and y to the left; yaw grows turning left. Inputs: steer +1 is right. */
import * as THREE from "../vendor/three-0.184.0/three.module.min.js";
import { carLights } from "./world.js";

const G = 9.81, DT = 1 / 120;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

/* by kind: mass (kg), engine peak torque (Nm), the centre of gravity's height (m), how far forward the
   weight sits (0..1 from the rear axle), the roll centre */
const SPECS = {
  sedan: { mass: 1520, torque: 330, cgH: 0.52, fwd: 0.54 },
  compact: { mass: 1320, torque: 260, cgH: 0.50, fwd: 0.57 },
  hatch: { mass: 1250, torque: 240, cgH: 0.52, fwd: 0.58 },
  suv: { mass: 1900, torque: 380, cgH: 0.68, fwd: 0.53 },
  truck: { mass: 2150, torque: 450, cgH: 0.72, fwd: 0.56 }
};
const GEARS = [3.4, 2.05, 1.42, 1.08, 0.86], REV = 3.3, FINAL = 3.7, EFF = 0.85;
const IDLE = 800, REDLINE = 6400, LIMIT = 6600;
/* torque against rpm, a fraction of the peak */
const CURVE = [[0, 0.5], [800, 0.55], [2000, 0.8], [3800, 1], [5200, 0.97], [6000, 0.86], [6800, 0.6]];
function torqueAt(rpm) {
  for (let i = 1; i < CURVE.length; i++) if (rpm <= CURVE[i][0]) { const [a, fa] = CURVE[i - 1], [b, fb] = CURVE[i]; return lerp(fa, fb, (rpm - a) / (b - a)); }
  return CURVE[CURVE.length - 1][1];
}
/* a tyre's lateral force against its slip angle: rises to a peak near 7 degrees, then falls to about 60% */
const TB = 11, TC = 1.55;
const tyre = a => Math.sin(TC * Math.atan(TB * a));
/* grip by surface (wet asphalt is the default at night) */
const MU = { wet: 0.82, puddle: 0.6, "wet-concrete": 0.8, concrete: 0.98, asphalt: 1.0, tile: 0.7 };

/* ---------- collision helpers (2D, in the set's xz plane) ---------- */
/* (allocation-free: these run for every nearby collider at 120 Hz, so they write into shared buffers) */
const CA = new Float64Array(8), CB = new Float64Array(8), AX = new Float64Array(8);
const HIT = { depth: 0, nx: 0, nz: 0, px: 0, pz: 0 };
function boxCorners(x, z, hw, hl, yaw, out) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  // local +X is (cos, -sin), local +Z is (sin, cos) in world xz for a rotation about +Y by yaw
  out[0] = x + hw * c + hl * s; out[1] = z - hw * s + hl * c;
  out[2] = x - hw * c + hl * s; out[3] = z + hw * s + hl * c;
  out[4] = x - hw * c - hl * s; out[5] = z + hw * s - hl * c;
  out[6] = x + hw * c - hl * s; out[7] = z - hw * s - hl * c;
  return out;
}
function inside(px, pz, ox, oz, hw, hl, yaw) { const c = Math.cos(yaw), s = Math.sin(yaw), dx = px - ox, dz = pz - oz; return Math.abs(dx * c - dz * s) <= hw + 1e-3 && Math.abs(dx * s + dz * c) <= hl + 1e-3; }
/* SAT between two oriented boxes (a: x z hw hl yaw; b: the same as numbers); fills HIT with n pointing from b to a, or returns null */
function satBox(a, bx, bz, bhw, bhl, byaw) {
  AX[0] = Math.cos(a.yaw); AX[1] = -Math.sin(a.yaw); AX[2] = Math.sin(a.yaw); AX[3] = Math.cos(a.yaw);
  AX[4] = Math.cos(byaw); AX[5] = -Math.sin(byaw); AX[6] = Math.sin(byaw); AX[7] = Math.cos(byaw);
  boxCorners(a.x, a.z, a.hw, a.hl, a.yaw, CA); boxCorners(bx, bz, bhw, bhl, byaw, CB);
  let best = 1e9, bnx = 0, bnz = 0;
  for (let k = 0; k < 8; k += 2) {
    const ax = AX[k], az = AX[k + 1];
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (let i = 0; i < 8; i += 2) { const p = CA[i] * ax + CA[i + 1] * az; if (p < a0) a0 = p; if (p > a1) a1 = p; const q = CB[i] * ax + CB[i + 1] * az; if (q < b0) b0 = q; if (q > b1) b1 = q; }
    const o = Math.min(a1, b1) - Math.max(a0, b0);
    if (o <= 0) return null;
    if (o < best) { best = o; const d = (a.x - bx) * ax + (a.z - bz) * az; bnx = d >= 0 ? ax : -ax; bnz = d >= 0 ? az : -az; }
  }
  // the contact: corners of one inside the other, averaged
  let cx = 0, cz = 0, n = 0;
  for (let i = 0; i < 8; i += 2) if (inside(CA[i], CA[i + 1], bx, bz, bhw, bhl, byaw)) { cx += CA[i]; cz += CA[i + 1]; n++; }
  for (let i = 0; i < 8; i += 2) if (inside(CB[i], CB[i + 1], a.x, a.z, a.hw, a.hl, a.yaw)) { cx += CB[i]; cz += CB[i + 1]; n++; }
  if (!n) { cx = (a.x + bx) / 2; cz = (a.z + bz) / 2; n = 1; }
  HIT.depth = best; HIT.nx = bnx; HIT.nz = bnz; HIT.px = cx / n; HIT.pz = cz / n;
  return HIT;
}
/* an oriented box (the car) against a circle; n points from the circle to the box */
function boxCircle(a, c) {
  const cs = Math.cos(a.yaw), sn = Math.sin(a.yaw), dx = c.x - a.x, dz = c.z - a.z;
  const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
  const qx = clamp(lx, -a.hw, a.hw), qz = clamp(lz, -a.hl, a.hl);
  let ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez), depth, nlx, nlz;
  if (d > c.r) return null;
  if (d > 1e-6) { nlx = -ex / d; nlz = -ez / d; depth = c.r - d; }
  else { // the centre is inside the box: out along the shallow side
    const px = a.hw - Math.abs(lx), pz = a.hl - Math.abs(lz);
    if (px < pz) { nlx = -Math.sign(lx) || 1; nlz = 0; depth = px + c.r; } else { nlx = 0; nlz = -Math.sign(lz) || 1; depth = pz + c.r; }
  }
  // local to world: local +X is (cos, -sin), +Z is (sin, cos)
  HIT.depth = depth; HIT.nx = nlx * cs + nlz * sn; HIT.nz = -nlx * sn + nlz * cs; HIT.px = a.x + qx * cs + qz * sn; HIT.pz = a.z - qx * sn + qz * cs;
  return HIT;
}

/* ---------- the car ---------- */
export function createVehicle(set, car, opts = {}) {
  const root = car.object, rig = root && root.userData.rig;
  if (!rig) throw new Error("vehicle: the car's rig is not built yet (await set.userData.ready)");
  const meta = rig.meta, kind = rig.kind, S = SPECS[kind] || SPECS.sedan;
  const wpos = rig.wheels.map(w => w.userData.rest.clone());
  const zf = (wpos[0].z + wpos[1].z) / 2, zr = (wpos[2].z + wpos[3].z) / 2, track = Math.abs(wpos[0].x - wpos[1].x);
  const Lw = zf - zr, cgz = zr + Lw * S.fwd, a = zf - cgz, b = cgz - zr;
  const R = meta.tr || 0.33, m = S.mass, Iz = m * (meta.L * meta.L + meta.W * meta.W) / 12 * 0.95;
  const hw = meta.W / 2, hl = meta.L / 2;
  const spec = { kind, mass: m, wheelbase: Lw, a, b, track, cgH: S.cgH, R, torque: S.torque, L: meta.L, W: meta.W, H: meta.H };
  const colliders = set.userData.colliders || [];
  const bounds = set.userData.driveBounds;

  // state: pose in the set, velocity in the car's frame (x forward, y left), yaw rate (left +)
  const st = { x: car.x, z: car.z, yaw: car.yaw, vx: 0, vy: 0, r: 0, ax: 0, ay: 0, delta: 0, gear: car.engine ? 1 : 0, rpm: car.engine ? IDLE : 0,
    shift: 0, revHold: 0, spinF: 0, spinR: 0, wheelspin: 0, slipF: 0, slipR: 0, hb: 0 };
  // the springs (visual): pitch, roll, heave, and each wheel's lift over a wheel stop
  const sp = { p: 0, pv: 0, r: 0, rv: 0, h: 0, hv: 0, lift: [0, 0, 0, 0], onBump: [false, false, false, false] };
  // someone's weight on a seat: the body settles toward that side (k 0..1, side +1 the driver's)
  const load = { r: 0, h: 0 };
  const engine = { on: !!car.engine, start() { if (!engine.on) { engine.on = true; st.rpm = IDLE + 400; if (st.gear === 0) st.gear = 1; } }, stop() { engine.on = false; st.rpm = 0; st.gear = 0; } };
  const light = { head: !!(car.lights && car.lights.head), tail: !!(car.lights && car.lights.tail), brake: 0, reverse: 0, cluster: !!(car.lights && car.lights.cluster) };
  let lamp = car.lamp || null;
  const lights = {
    auto: true,
    set(o) { Object.assign(light, o); applyLights(); place(); },
    get() { return { ...light }; }
  };
  // only when something changed (no per-frame colour parsing)
  const lit = { head: 0, tail: 0, brake: 0, reverse: 0, cluster: 0 }, was = { head: -1, tail: -1, brake: -1, reverse: -1, cluster: -1 };
  function applyLights() {
    lit.head = +light.head || 0; lit.tail = +light.tail || 0; lit.brake = +light.brake || 0; lit.reverse = +light.reverse || 0;
    lit.cluster = engine.on ? (light.cluster === false ? 0 : 1) : 0;
    if (lit.head !== was.head || lit.tail !== was.tail || lit.brake !== was.brake || lit.reverse !== was.reverse || lit.cluster !== was.cluster) { carLights(rig.own, lit); Object.assign(was, lit); }
    const lamps = set.userData.lamps;
    if (light.head && !lamp) { lamp = { p: new THREE.Vector3(), range: 8, col: [0.9, 0.85, 0.75], cone: 0, fixed: false, car: true }; car.lamp = lamp; }
    if (lamp) { const i = lamps.indexOf(lamp); if (light.head && i < 0) lamps.push(lamp); if (!light.head && i >= 0) lamps.splice(i, 1); }
  }
  // doors: t 0..1, eased toward a target; +X side (the driver's) swings out with a negative turn about Y
  const doorT = { L: 0, R: 0 }, doorGoal = { L: 0, R: 0 }, DOOR_MAX = 1.13;
  const sideKey = s => (s === "driver" || s === "left" || s === "L" ? "L" : "R");
  const events = [], impacts = [];
  const doors = {
    open(side, t = 1) { const k = sideKey(side); const g = clamp(t, 0, 1); if ((g > 0.02) !== (doorGoal[k] > 0.02)) events.push({ type: "door", side: k === "L" ? "driver" : "passenger", open: g > 0.02 }); doorGoal[k] = g; doorT[k] = g; place(); },
    close(side) { doors.open(side, 0); },
    get: side => doorT[sideKey(side)],
    node: side => rig.doors[sideKey(side)],
    handle(side, out) { const k = sideKey(side), n = rig.doors[k]; if (!n) return null; root.updateMatrixWorld(true); return handlePoint(k, 1, out).applyMatrix4(n.matrixWorld); },
    inner(side, out) { const k = sideKey(side), n = rig.doors[k]; if (!n) return null; root.updateMatrixWorld(true); return handlePoint(k, -1, out).applyMatrix4(n.matrixWorld); },
    // the top of the window frame near the back edge, from inside: where a hand holds an open door
    frame(side, out) { const k = sideKey(side), n = rig.doors[k]; if (!n) return null; root.updateMatrixWorld(true); return handlePoint(k, 0, out).applyMatrix4(n.matrixWorld); },
    // the swing in radians (0 shut, max fully open): set straight, so a caller can ease it its own way
    angle(side, a) { const k = sideKey(side); if (a == null) return DOOR_MAX * easeDoor(doorT[k]); const e = clamp(a / DOOR_MAX, 0, 1); doors.open(side, 0.5 - Math.sin(Math.asin(1 - 2 * e) / 3)); },
    max: DOOR_MAX, len: doorLen
  };
  // the front door's length, from the hinge back to the B pillar
  function doorLen() { const n = rig.doors.L || rig.doors.R; if (!n || !meta.pillars || !meta.pillars.length) return 1.1; return clamp(n.position.z - (meta.L / 2 - meta.pillars[0] - 0.03), 0.8, 1.4); }
  function handlePoint(k, where, out) {
    // in the door's frame (its pivot is the hinge): the outside handle a hand's width in from the back edge, below
    // the belt; the inside pull a little further forward on the armrest; the window frame's top at the back
    const n = rig.doors[k], s = k === "L" ? 1 : -1, b = meta.belt || [0.9, 0.95, 0.95], belt = b[1], L = doorLen();
    const v = out || new THREE.Vector3();
    if (where > 0) return v.set(0.03 * s, belt - 0.1 - n.position.y, -(L - 0.17));
    if (where < 0) return v.set(-0.12 * s, belt - 0.14 - n.position.y, -(L - 0.3));
    return v.set(-0.06 * s, belt + ((meta.H || 1.45) - belt) * 0.82 - n.position.y, -(L - 0.12));
  }

  /* ----- one step of the model ----- */
  function step(dt, inp) {
    const speed = Math.hypot(st.vx, st.vy), fwd = st.vx;
    const surf = surfaceMu();
    // gear logic: reverse is held brake from a stop; throttle from a stop pulls it back into first
    let thr = engine.on ? inp.throttle : 0, brk = inp.brake;
    if (engine.on) {
      if (st.gear >= 1 && brk > 0.1 && thr < 0.05 && Math.abs(fwd) < 0.6) { st.revHold += dt; if (st.revHold > 0.22) { st.gear = -1; st.revHold = 0; events.push({ type: "shift", gear: -1 }); } } else if (st.gear >= 0) st.revHold = 0;
      if (st.gear === -1 && thr > 0.1 && Math.abs(fwd) < 0.6) { st.gear = 1; events.push({ type: "shift", gear: 1 }); }
      if (st.gear === 0) st.gear = 1;
    }
    let drive = 0, brake = 0;
    if (st.gear === -1) { drive = brk; brake = thr; } else { drive = thr; brake = brk; }
    // the engine: rpm from the driven wheels, with a slipping clutch at walking pace
    const ratio = st.gear === -1 ? REV : st.gear >= 1 ? GEARS[st.gear - 1] : 0;
    const wheelRpm = Math.abs(st.spinR) * 60 / (2 * Math.PI) * ratio * FINAL;
    let target = engine.on ? Math.max(IDLE, wheelRpm) : 0;
    if (engine.on && Math.abs(fwd) < 7 && drive > 0) target = Math.max(target, IDLE + drive * 2600 * (1 - Math.abs(fwd) / 7));
    if (engine.on && st.shift > 0) target = Math.max(IDLE, target * 0.82);
    st.rpm = lerp(st.rpm, Math.min(target, LIMIT + 40), 1 - Math.exp(-dt * 14));
    let Fx = 0;
    if (engine.on && ratio && st.shift <= 0) {
      const cut = st.rpm > LIMIT ? 0 : 1;
      Fx = torqueAt(st.rpm) * S.torque * drive * ratio * FINAL * EFF / R * cut * (st.gear === -1 ? -1 : 1);
      // a little engine braking off the throttle
      if (drive < 0.02 && Math.abs(fwd) > 0.5) Fx -= Math.sign(fwd) * 120 * ratio;
    }
    // automatic box
    st.shift = Math.max(0, st.shift - dt);
    if (engine.on && st.gear >= 1 && st.shift <= 0) {
      if (st.rpm > 5900 && st.gear < 5 && drive > 0.1) { st.gear++; st.shift = 0.22; events.push({ type: "shift", gear: st.gear }); }
      else if (wheelRpm < 1900 && st.gear > 1) { st.gear--; st.shift = 0.12; events.push({ type: "shift", gear: st.gear }); }
    }
    // weight transfer (from last step's acceleration)
    const Wf0 = m * G * b / Lw, Wr0 = m * G * a / Lw, dW = m * st.ax * S.cgH / Lw;
    const Fzf = Math.max(0.15 * m * G, Wf0 - dW), Fzr = Math.max(0.15 * m * G, Wr0 + dW);
    // slip angles (left +), the car's frame
    const dir = fwd >= 0 ? 1 : -1, den = Math.max(Math.abs(fwd), 2.0);
    const dL = -st.delta;   // the model's steer angle, left +
    const af = Math.atan2(st.vy + a * st.r, den) - dL * dir;
    const ar = Math.atan2(st.vy - b * st.r, den);
    const hb = st.hb;
    const muF = surf.f, muR = surf.r * (1 - 0.42 * hb);
    // (at a standstill a turned wheel pushes nothing)
    const lowk = clamp(speed / 1.5, 0, 1);
    let Fyf = -muF * Fzf * tyre(af) * lowk, Fyr = -muR * Fzr * tyre(ar) * lowk;
    // brakes: 65/35 front to rear, the handbrake locks the rear
    const bmax = 1.05 * m * G;
    let Fbf = -Math.sign(fwd) * brake * bmax * 0.65, Fbr = -Math.sign(fwd) * (brake * bmax * 0.35 + hb * muR * Fzr * 0.9);
    if (Math.abs(fwd) < 0.3) { Fbf *= Math.abs(fwd) / 0.3; Fbr *= Math.abs(fwd) / 0.3; }
    Fbf = clamp(Fbf, -muF * Fzf, muF * Fzf);
    // the rear is driven: share its grip between pushing and holding the line (the friction circle)
    let Fxr = (hb > 0.5 ? 0 : Fx) + Fbr;
    const capR = muR * Fzr, useR = Math.hypot(Fxr, Fyr);
    st.wheelspin = 0;
    if (useR > capR) { const k = capR / useR; st.wheelspin = clamp((useR - capR) / capR, 0, 1) * (Math.abs(Fx) > Math.abs(Fbr) ? 1 : 0); Fxr *= k; Fyr *= k; }
    const capF = muF * Fzf, useF = Math.hypot(Fbf, Fyf);
    if (useF > capF) { const k = capF / useF; Fbf *= k; Fyf *= k; }
    // drag and rolling
    const Fd = -1.35 * fwd * Math.abs(fwd) - 0.016 * m * G * clamp(fwd, -1, 1);
    // the bicycle model
    const cs = Math.cos(dL), sn = Math.sin(dL);
    const FX = Fxr + Fbf * cs - Fyf * sn + Fd;
    const FY = Fyr + Fyf * cs + Fbf * sn;
    const ax = FX / m, ay = FY / m;
    st.vx += (ax + st.r * st.vy) * dt;
    st.vy += (ay - st.r * st.vx) * dt;
    st.r += ((a * (Fyf * cs + Fbf * sn) - b * Fyr) / Iz) * dt;
    // at walking pace a car goes where its wheels point (the tyre model is noisy there)
    const ks = clamp(1 - (Math.abs(st.vx) - 1.5) / 3.5, 0, 1) * (hb > 0.5 ? 0.3 : 1);
    if (ks > 0) { const rk = st.vx * Math.tan(dL) / Lw; st.r = lerp(st.r, rk, ks); st.vy = lerp(st.vy, st.r * b, ks); }
    // stopped means stopped
    if (Math.abs(st.vx) < 0.05 && drive < 0.02) { st.vx *= 0.8; st.vy *= 0.8; st.r *= 0.8; }
    st.ax = lerp(st.ax, ax, 1 - Math.exp(-dt * 8)); st.ay = lerp(st.ay, st.vx * st.r + ay * 0.2, 1 - Math.exp(-dt * 8));
    // integrate the pose
    st.yaw += st.r * dt;
    const c = Math.cos(st.yaw), s = Math.sin(st.yaw);
    // car x (forward) is world (sin yaw, cos yaw); car y (left) is world (cos yaw, -sin yaw)
    st.x += (st.vx * s + st.vy * c) * dt; st.z += (st.vx * c - st.vy * s) * dt;
    // what the tyres are doing, for sound and smoke
    st.slipF = clamp((Math.abs(af) - 0.12) / 0.22, 0, 1) * clamp(speed / 4, 0, 1);
    st.slipR = Math.max(clamp((Math.abs(ar) - 0.12) / 0.22, 0, 1) * clamp(speed / 4, 0, 1), st.wheelspin * 0.8, hb > 0.5 ? clamp(Math.abs(fwd) / 6, 0, 1) : 0);
    st.af = af; st.ar = ar;
    // wheel spin (rad/s): fronts roll, rears roll or spin up or lock
    st.spinF = st.vx / R;
    st.spinR = hb > 0.5 ? lerp(st.spinR, 0, 1 - Math.exp(-dt * 20)) : st.vx / R * (1 + st.wheelspin * 1.5 * Math.sign(Fx || 1) * Math.sign(st.vx || 1));
    collide(dt);
    keepIn(dt);
  }
  function surfaceMu() {
    const f = set.userData.surfaceAt;
    if (!f) return { f: 0.85, r: 0.85 };
    const c = Math.cos(st.yaw), s = Math.sin(st.yaw);
    const fx = st.x + s * a, fz = st.z + c * a, rx = st.x - s * b, rz = st.z - c * b;
    return { f: MU[f(fx, fz)] || 0.85, r: MU[f(rx, rz)] || 0.85 };
  }
  /* ----- collisions ----- */
  const me = { x: 0, z: 0, hw, hl, yaw: 0 };
  function collide() {
    me.x = st.x; me.z = st.z; me.yaw = st.yaw;
    for (let ci = 0; ci < colliders.length; ci++) {
      const o = colliders[ci];
      if (o.type === "bump") continue;
      const ox = o.x, oz = o.z;
      if (Math.abs(ox - st.x) > 40 || Math.abs(oz - st.z) > 40) continue;
      let hit = null;
      if (o.type === "circle") { if (Math.abs(ox - st.x) > hl + o.r + 0.5 || Math.abs(oz - st.z) > hl + o.r + 0.5) continue; hit = boxCircle(me, o); }
      else if (o.type === "box") { const rr = Math.hypot(o.hw, o.hl) + hl + 0.5; if (Math.abs(ox - st.x) > rr || Math.abs(oz - st.z) > rr) continue; hit = satBox(me, ox, oz, o.hw, o.hl, o.yaw || 0); }
      if (!hit) continue;
      resolve(hit, o);
      me.x = st.x; me.z = st.z; me.yaw = st.yaw;
    }
  }
  function resolve(hit, o) {
    // push out
    st.x += hit.nx * hit.depth; st.z += hit.nz * hit.depth;
    // velocity in the world, and at the contact point
    const c = Math.cos(st.yaw), s = Math.sin(st.yaw);
    let vxw = st.vx * s + st.vy * c, vzw = st.vx * c - st.vy * s;
    const rx = hit.px - st.x, rz = hit.pz - st.z;
    // yaw rate about +Y: v = w x r = (r_z w, -r_x w) in xz
    const vcx = vxw + st.r * rz, vcz = vzw - st.r * rx;
    const vn = vcx * hit.nx + vcz * hit.nz;
    if (vn >= 0) return;
    const e = o.what === "car" ? 0.28 : o.what === "fence" || o.what === "gate" ? 0.12 : 0.22;
    const rn = rz * hit.nx - rx * hit.nz;   // (r x n)_y
    const j = -(1 + e) * vn / (1 / m + rn * rn / Iz);
    vxw += j * hit.nx / m; vzw += j * hit.nz / m; st.r += rn * j / Iz;
    // scrape: friction along the surface
    const tx = -hit.nz, tz = hit.nx, vt = vcx * tx + vcz * tz;
    const jt = clamp(-vt / (1 / m + (rz * tx - rx * tz) ** 2 / Iz), -0.35 * j, 0.35 * j);
    vxw += jt * tx / m; vzw += jt * tz / m; st.r += (rz * tx - rx * tz) * jt / Iz;
    // a hard knock costs a little more (crumple)
    const strength = -vn;
    if (strength > 3) { const k = 1 - Math.min(0.25, (strength - 3) * 0.02); vxw *= k; vzw *= k; }
    st.vx = vxw * s + vzw * c; st.vy = vxw * c - vzw * s;
    if (strength > 0.25) {
      const ev = { type: "impact", strength: +strength.toFixed(2), x: hit.px, y: 0.5, z: hit.pz, nx: hit.nx, nz: hit.nz, what: o.what || "wall" };
      // one report per knock, not one per substep
      const last = impacts[impacts.length - 1];
      if (!last || last.what !== ev.what || st.time - last.t > 0.25 || ev.strength > last.strength * 1.5) { ev.t = st.time; events.push(ev); impacts.push(ev); if (impacts.length > 8) impacts.shift(); }
      if (o.what === "car" && o.car && set.userData.rockCar) set.userData.rockCar(o.car, strength, hit.nx, hit.nz);
      // a knock rocks this car too
      sp.rv += clamp(-(hit.nx * c - hit.nz * s), -1, 1) * strength * 0.08; sp.pv += clamp(-(hit.nx * s + hit.nz * c), -1, 1) * strength * 0.05;
    }
  }
  /* ----- the drivable area: inside a rect, or pulled back softly ----- */
  function keepIn(dt) {
    if (!bounds) return;
    let best = null, bd = 1e9;
    for (const q of bounds.rects) {
      const px = clamp(st.x, q.x0, q.x1), pz = clamp(st.z, q.z0, q.z1), d = Math.hypot(st.x - px, st.z - pz);
      if (d === 0) { st.outside = false; return; }
      if (d < bd) { bd = d; best = [px, pz]; }
    }
    const nx = (best[0] - st.x) / bd, nz = (best[1] - st.z) / bd;
    const c = Math.cos(st.yaw), s = Math.sin(st.yaw);
    let vxw = st.vx * s + st.vy * c, vzw = st.vx * c - st.vy * s;
    const vn = vxw * nx + vzw * nz;
    // a critically damped spring back in: no crash and no bounce, just a wall you can't see
    const k = 14 * bd - 7.5 * vn;
    vxw += nx * k * dt; vzw += nz * k * dt;
    if (bd > 1.5) { st.x += nx * (bd - 1.5); st.z += nz * (bd - 1.5); const v2 = vxw * nx + vzw * nz; if (v2 < 0) { vxw -= nx * v2; vzw -= nz * v2; } }
    st.vx = vxw * s + vzw * c; st.vy = vxw * c - vzw * s;
    if (!st.outside) { st.outside = true; const ev = { type: "impact", strength: +Math.max(0, -vn).toFixed(2), x: st.x, y: 0.5, z: st.z, nx, nz, what: "bound", t: st.time }; events.push(ev); impacts.push(ev); if (impacts.length > 8) impacts.shift(); }
  }
  /* ----- wheel stops: each wheel's lift ----- */
  const BUMPS = colliders.filter(o => o.type === "bump");
  const WHEEL = ["FL", "FR", "RL", "RR"], pud = [false, false, false, false];
  function bumps(dt) {
    const c = Math.cos(st.yaw), s = Math.sin(st.yaw);
    for (let i = 0; i < 4; i++) {
      const w = wpos[i], wx = st.x + w.x * c + w.z * s, wz = st.z - w.x * s + w.z * c;
      let h = 0;
      for (let bi = 0; bi < BUMPS.length; bi++) {
        const o = BUMPS[bi];
        if (Math.abs(o.x - wx) > o.hw + 0.4 || Math.abs(o.z - wz) > 0.6) continue;
        // a rounded profile: the tyre rolls up and over
        const dz = Math.abs(wz - o.z), dx = Math.abs(wx - o.x) - o.hw;
        if (dx > 0.1) continue;
        const reach = o.hl + R * 0.55;
        if (dz < reach) h = Math.max(h, o.h * Math.cos((dz / reach) * Math.PI / 2) ** 0.7 * clamp(1 - dx / 0.1, 0, 1));
      }
      const on = h > 0.02;
      if (on && !sp.onBump[i]) {
        const sv = Math.abs(st.vx);
        events.push({ type: "bump", wheel: WHEEL[i], strength: +sv.toFixed(2) });
        // climbing it costs speed (a lot at a crawl, a jolt at speed)
        st.vx *= sv < 1.2 ? 0.55 : 1 - Math.min(0.12, 0.25 / sv);
        sp.hv += 0.35 * Math.min(1, sv / 3); sp.pv += (i < 2 ? 1 : -1) * 0.25 * Math.min(1, sv / 3);
      }
      sp.onBump[i] = on; sp.lift[i] = h;
    }
  }
  /* ----- the springs (visual): pitch with braking and throttle, roll with cornering, a bob over bumps ----- */
  function springs(dt) {
    const lf = (sp.lift[0] + sp.lift[1]) / 2, lr = (sp.lift[2] + sp.lift[3]) / 2, ll = (sp.lift[0] + sp.lift[2]) / 2, lrt = (sp.lift[1] + sp.lift[3]) / 2;
    const pT = clamp(-st.ax * 0.0055, -0.07, 0.07) + Math.atan2(lr - lf, Lw);   // nose up is negative x rotation
    const rT = clamp(st.ay * 0.0085, -0.085, 0.085) * (S.cgH / 0.55) + Math.atan2(lrt - ll, track) * -1 + load.r;
    const hT = (lf + lr) / 2 * 0.8 + load.h;
    const w = 11, z = 0.32;
    sp.pv += (-(w * w) * (sp.p - pT) - 2 * z * w * sp.pv) * dt; sp.p += sp.pv * dt;
    sp.rv += (-(w * w) * (sp.r - rT) - 2 * z * w * sp.rv) * dt; sp.r += sp.rv * dt;
    sp.hv += (-(w * w) * (sp.h - hT) - 2 * z * w * sp.hv) * dt; sp.h += sp.hv * dt;
  }

  /* ----- put the rig where the model is ----- */
  const pivot = new THREE.Vector3(0, 0.38, cgz), qb = new THREE.Quaternion(), eb = new THREE.Euler(0, 0, 0, "XZY"), tmp = new THREE.Vector3();
  function place() {
    root.position.set(st.x, 0, st.z); root.rotation.set(0, st.yaw, 0);
    eb.set(sp.p, 0, sp.r); qb.setFromEuler(eb);
    rig.body.quaternion.copy(qb);
    tmp.copy(pivot).applyQuaternion(qb); rig.body.position.copy(pivot).sub(tmp); rig.body.position.y += sp.h;
    // wheels: front ones steer (right is a negative turn about +Y), all spin about X, each rides its own lift
    for (let i = 0; i < 4; i++) {
      const w = rig.wheels[i]; if (!w) continue;
      w.position.copy(w.userData.rest); w.position.y += sp.lift[i];
      w.rotation.y = i < 2 ? -st.delta : 0;
      w.rotation.x = i < 2 ? st.angF : st.angR;
    }
    if (rig.syncWheels) rig.syncWheels();
    if (rig.steer) { rig.steer.quaternion.copy(rig.steer.userData.q0).multiply(qs.setFromAxisAngle(ZA, st.delta * STEER_RATIO)); }
    for (const k of ["L", "R"]) { const d = rig.doors[k]; if (d) d.rotation.y = (k === "L" ? -1 : 1) * DOOR_MAX * easeDoor(doorT[k]); }
    if (rig.shadow) rig.shadow.position.y = 0;
    // its footprint for walking and nav
    if (car.wall) {
      const cs = Math.abs(Math.cos(st.yaw)), sn = Math.abs(Math.sin(st.yaw)), ex = (meta.W * cs + meta.L * sn) / 2 + 0.2, ez = (meta.W * sn + meta.L * cs) / 2 + 0.2;
      car.wall.x0 = st.x - ex; car.wall.x1 = st.x + ex; car.wall.z0 = st.z - ez; car.wall.z1 = st.z + ez;
      if (Math.hypot(st.x - (car._navX ?? car.x), st.z - (car._navZ ?? car.z)) > 0.5) { set.userData.navDirty = true; car._navX = st.x; car._navZ = st.z; }
    }
    car.x = st.x; car.z = st.z; car.yaw = st.yaw;
    // the headlights' spill on the ground ahead
    if (lamp) { const s = Math.sin(st.yaw), c = Math.cos(st.yaw); lamp.p.set(st.x + s * (hl + 0.6), 0.75, st.z + c * (hl + 0.6)); }
    if (car.id === "idle" && set.userData.sounds && set.userData.sounds.idle) { const s = set.userData.sounds.idle; s.x = st.x; s.z = st.z; }
  }
  const qs = new THREE.Quaternion(), ZA = new THREE.Vector3(0, 0, 1), STEER_RATIO = 14;
  const easeDoor = t => t * t * (3 - 2 * t);
  st.angF = 0; st.angR = 0; st.time = 0;

  let acc = 0;
  const IN = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
  const api = {
    spec, object: root, body: rig.body, seat: rig.seat, seatP: rig.seatP, steeringWheel: rig.steer, wheels: rig.wheels, doors, lights, engine, events, impacts,
    update(dt, inp = {}) {
      events.length = 0;
      dt = Math.min(Math.max(dt || 0, 0), 0.1);
      const i = IN; i.throttle = clamp(+inp.throttle || 0, 0, 1); i.brake = clamp(+inp.brake || 0, 0, 1); i.steer = clamp(+inp.steer || 0, -1, 1); i.handbrake = clamp(+inp.handbrake || 0, 0, 1);
      acc += dt;
      while (acc >= DT) {
        acc -= DT; st.time += DT;
        // the steering: speed-sensitive, rate-limited, and free to follow the slide when you catch it
        const v = Math.abs(st.vx);
        let max = 0.62 / (1 + Math.pow(v / 8.5, 1.35));
        max = Math.max(max, Math.min(0.5, Math.abs(st.ar || 0) + 0.08));
        const goal = i.steer * max, rate = (Math.abs(goal) < Math.abs(st.delta) ? 4.2 : 2.6) * (1 + v * 0.02);
        st.delta += clamp(goal - st.delta, -rate * DT, rate * DT);
        st.hb = lerp(st.hb, i.handbrake, 1 - Math.exp(-DT * 30));
        step(DT, i);
        bumps(DT); springs(DT);
        st.angF = (st.angF + st.spinF * DT) % (Math.PI * 2); st.angR = (st.angR + st.spinR * DT) % (Math.PI * 2);
      }
      if (lights.auto) {
        const br = st.gear === -1 ? i.throttle : i.brake;
        light.brake = br > 0.05 ? 1 : 0; light.reverse = st.gear === -1 ? 1 : 0;
      }
      applyLights();
      if (set.userData.tickCars) set.userData.tickCars(dt);
      // doors ease to where they were sent (doors.open sets them directly; a door left ajar swings shut with speed)
      for (const k of ["L", "R"]) if (doorT[k] > 0 && Math.abs(st.vx) > 3) { doorT[k] = Math.max(0, doorT[k] - dt * 1.5); doorGoal[k] = doorT[k]; }
      place();
      // splashes through the puddles
      if (set.userData.surfaceAt && Math.abs(st.vx) > 2) {
        const c = Math.cos(st.yaw), s = Math.sin(st.yaw);
        for (let k = 0; k < 4; k++) {
          const w = wpos[k], wx = st.x + w.x * c + w.z * s, wz = st.z - w.x * s + w.z * c;
          const wet = set.userData.surfaceAt(wx, wz) === "puddle";
          if (wet && !pud[k]) events.push({ type: "splash", wheel: WHEEL[k], strength: +Math.abs(st.vx).toFixed(2) });
          pud[k] = wet;
        }
      }
      return api;
    },
    reset(x, z, yaw) { Object.assign(st, { x, z, yaw, vx: 0, vy: 0, r: 0, ax: 0, ay: 0, delta: 0 }); place(); },
    park() { st.vx = st.vy = st.r = 0; st.hb = 1; place(); },
    /* a body on a seat (k 0..1, side "driver" or "passenger"): the springs take it, so the car dips as you sit in */
    weight(k, side = "driver") { const s = sideKey(side) === "L" ? 1 : -1; k = clamp(k || 0, 0, 1); load.r = -s * 0.011 * k * (1520 / S.mass); load.h = -0.009 * k * (1520 / S.mass); },
    /* a knock on the body (a door shut): roll and heave, in rad/s and m/s, and the springs ring it out */
    nudge(r = 0, h = 0) { sp.rv += r; sp.hv += h; },
    grips() {
      const n = rig.steer; if (!n) return null;
      root.updateMatrixWorld(true);
      const Rr = n.userData.rimR, s60 = Math.sin(Math.PI / 3), c60 = Math.cos(Math.PI / 3);
      // the wheel's face: local +Y is 12 o'clock, +X the driver's left, -Z points at the driver
      const left = new THREE.Vector3(Rr * s60, Rr * c60, 0).applyMatrix4(n.matrixWorld);
      const right = new THREE.Vector3(-Rr * s60, Rr * c60, 0).applyMatrix4(n.matrixWorld);
      const normal = new THREE.Vector3(0, 0, -1).transformDirection(n.matrixWorld);
      return { left, right, normal };
    },
    dispose() {
      st.vx = st.vy = st.r = 0; light.brake = 0; light.reverse = 0; applyLights(); place();
      // a parked car again where it stands: it's something the next car can hit
      if (!car.collider) { car.collider = { type: "box", x: st.x, z: st.z, hw, hl, yaw: st.yaw, h: 1.4, what: "car" }; }
      Object.assign(car.collider, { x: st.x, z: st.z, yaw: st.yaw });
      if (!colliders.includes(car.collider)) colliders.push(car.collider);
      // and drawn with the parked rows again, where it stands
      if (set.userData.showRig) set.userData.showRig(car, false);
    },
    get speed() { return st.vx; },
    get kmh() { return Math.abs(st.vx) * 3.6; },
    get mph() { return Math.abs(st.vx) * 2.23694; },
    get rpm() { return Math.round(st.rpm); },
    get gear() { return engine.on ? st.gear : 0; },
    get load() { return engine.on ? clamp(lastInp.t * torqueAt(st.rpm), 0, 1) : 0; },
    get slip() { return Math.max(st.slipF, st.slipR); },
    get slipF() { return st.slipF; },
    get slipR() { return st.slipR; },
    get drifting() { return Math.abs(st.ar || 0) > 0.21 && Math.abs(st.vx) > 5; },
    get steerAngle() { return st.delta; },
    get wheelAngle() { return st.delta * STEER_RATIO; },
    get onRoad() { return st.z > 22.4; },
    get surface() { return set.userData.surfaceAt ? set.userData.surfaceAt(st.x, st.z) : "wet"; },
    get pose() { return { x: st.x, y: sp.h, z: st.z, yaw: st.yaw, pitch: sp.p, roll: sp.r, vx: st.vx * Math.sin(st.yaw) + st.vy * Math.cos(st.yaw), vz: st.vx * Math.cos(st.yaw) - st.vy * Math.sin(st.yaw), speed: st.vx }; },
    _state: st
  };
  const lastInp = { t: 0 };
  const upd = api.update;
  api.update = (dt, inp = {}) => { lastInp.t = clamp(st.gear === -1 ? +inp.brake || 0 : +inp.throttle || 0, 0, 1); return upd(dt, inp); };
  // the rig takes over from the parked rows' copy of this car
  if (set.userData.showRig) set.userData.showRig(car, true);
  // this car is no longer something it can hit
  if (car.collider) { const i = colliders.indexOf(car.collider); if (i >= 0) colliders.splice(i, 1); }
  applyLights(); place();
  return api;
}
