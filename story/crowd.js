/* After Hours: the passers-by. A handful of fictional people with somewhere to be: one walks the near
   sidewalk, one waits on the bus, one is in and out of the laundromat, one orders at the taco truck, one looks
   at the cars on the lot, and a few more on a desktop. Each is a cast body in its own colours (a look on a
   body, like Marisol), with a short loop of places to go and things to stand and do there.

   They step round you, look at you as you pass, give ground when you run into them, get out of the way of a
   car that comes close and turn their heads at a horn. Use one (the same button as any thing) and they stop,
   face you and say one of two or three small remarks, in order: the words are story.json's "ambient", every
   speaker fictional. There is no recorded voice for them yet, so main.js shows the remark as a caption over
   their head.

   Cost: a body is nine or ten draws. Off screen or far away a passer-by is not drawn and not animated (its
   place along the loop still moves, cheaply); at a middle distance it animates every other frame and drops
   its lashes, brows, teeth and eyes. A phone gets four of them, a desktop eight.

   createCrowd({ cast, world, LOOKS, defs, max, blob }) ->
     { on, list, enter(set, { day, nav, off }), tick(dt, ctx), spots(), say(id), honk(x, z), near(x, z, r) }
   ctx: { me, head (your head, a Vector3), cam (camera), fwd (its direction), car ({ x, z, speed } or null),
          calm (a conversation is on), blocked(x, z, r) } */
import * as THREE from "../vendor/three-0.184.0/three.module.min.js";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const rnd = (a, b) => a + Math.random() * (b - a);

/* a look per passer-by, on the body story.json names (people.js LOOKS takes them as they are) */
const WEAR = {
  walker: { skin: "#7b5338", beard: "#2b2622", hair: "#2b2622", brow: "#2b2622", wide: 0, cloth: { work: "#4a3b2c", shoes: "#1f1a16", hat: "#2a2d33" }, keep: "#bdb6a8", umbrella: true, stubble: true, tempo: 0.96 },
  rider: { skin: "#a87a58", lip: "#96594b", hair: "#1a1210", brow: "#2e2019", browTint: "#5a4032", wide: 0.04, cloth: { elegant: "#31405a", shoes: "#1c1a19" }, keep: "#d9d3c6" },
  wash: { skin: "#c09a7a", lip: "#9a6253", eyes: "#5a4636", wide: 0.03, hair: "#3a2a1c", brow: "#3a2a1c", cloth: { casual: "#5a6b52", shoes: "#c9c3b7" }, keep: "#d2ccbf" },
  taco: { skin: "#7a5236", lip: "#8a5244", hair: "#0f0b09", brow: "#1f1510", browTint: "#3d2a1f", wide: 0.07, cloth: { elegant: "#6e5a2e", shoes: "#231d19" }, keep: "#e0d9c9" },
  looker: { skin: "#b08566", beard: "#6a655d", hair: "#5a554e", brow: "#6f6a62", wide: 0, cloth: { work: "#3d4a3a", shoes: "#2a2019", hat: "#4a3f33" }, keep: "#c9c2b4", stubble: true, tempo: 0.9 },
  jogger: { skin: "#d0a686", lip: "#a86a5c", hair: "#5c3a22", brow: "#6a4a34", browTint: "#8a664a", wide: 0.03, cloth: { elegant: "#5a3550", shoes: "#2a2422" }, keep: "#e3dccd", tempo: 1.08 },
  smoker: { skin: "#6a4630", lip: "#7a4a40", eyes: "#4a3526", wide: 0.06, hair: "#15100d", brow: "#15100d", cloth: { casual: "#3a4250", shoes: "#2b2724" }, keep: "#c5c9cd" },
  late: { skin: "#8a6040", beard: "#3a332c", hair: "#2a2622", brow: "#2a2420", wide: 0, cloth: { work: "#5a2f2a", shoes: "#16130f", hat: "#22201e" }, keep: "#cfc7b6", umbrella: true, stubble: true }
};
const SMALL = /^(brow|lash|teeth|eyes)$/;

export function createCrowd(o) {
  const defs = (o.defs || []).filter(d => d && d.fictional && WEAR[d.id]).slice(0, o.max || 4);
  const list = [], spotList = [];
  const C = { on: false, list, set: null, day: false, nav: null, frame: 0, loading: false };
  for (const d of defs) o.LOOKS["amb-" + d.id] = WEAR[d.id];

  /* where each one goes: steps of { x, z, wait: [a, b], face: [x, z] | "road" | "car", act } */
  function plan(id, set) {
    const sp = set.userData.spots || {}, at = (k, dx = 0, dz = 0) => { const s = sp[k], q = s && (s.stand || s.p); return q ? { x: q.x + dx, z: q.z + dz } : null; };
    const faceOf = k => { const s = sp[k]; return s && s.p ? [s.p.x, s.p.z] : null; };
    const st = (q, wait, face, act) => (q ? { x: q.x, z: q.z, wait, face: face || null, act: act || null } : null);
    let r = [];
    if (id === "walker") r = [st({ x: -30, z: 23.4 }, [2, 5], "road"), st({ x: 30, z: 23.4 }, [2, 5], "road")];
    else if (id === "rider") r = [st(at("bus-bench", 1.5, 0.1), [7, 13], "road"), st(at("bus-bench", -1.7, -0.3), [4, 8], [60, 30], "look")];
    else if (id === "wash") r = [st(at("laundry-door", 0.2, -0.3), [5, 9], faceOf("laundry-door")), st(at("payphone", 0.3, -0.4), [4, 7], faceOf("payphone")), st(at("news-box", 0, -0.5), [3, 6], faceOf("news-box"), "look")];
    else if (id === "taco") r = [st(at("truck-bell", -0.5, -0.25), [7, 12], faceOf("truck-bell"), "order"), st(at("taco-menu", 0.2, -0.3), [4, 7], faceOf("taco-menu"), "look")];
    else if (id === "looker" && !C.day) r = [st({ x: -6, z: 9.6 }, [5, 9], "car", "look"), st({ x: 4.6, z: 9.6 }, [5, 9], "car", "look"), st({ x: 7, z: 0.4 }, [5, 8], "car", "look"), st({ x: -5, z: 0.4 }, [5, 9], "car", "look")];
    else if (id === "jogger") r = [st({ x: -40, z: 38.6 }, [1, 3], "road"), st({ x: 20, z: 38.6 }, [1, 3], "road")];
    else if (id === "smoker") r = [st(at("kiosk-door", 1.6, -1.2), [8, 14], "road"), st(at("kiosk-door", -1.4, -1.6), [5, 9], "road", "look")];
    else if (id === "late") r = [st(at("bus-bench", 3.2, -0.6), [5, 9], [-60, 30], "look"), st({ x: -7.5, z: 38.3 }, [1, 2], null), st({ x: -7.5, z: 24.3 }, [0.5, 1.5], null), st({ x: 12, z: 23.5 }, [3, 6], "road")];
    return r.filter(Boolean);
  }
  function nearestCar(set, x, z, out) {
    let bd = 1e9, ok = false;
    for (const c of set.userData.parked || []) { const d = (c.x - x) * (c.x - x) + (c.z - z) * (c.z - z); if (d < bd) { bd = d; out[0] = c.x; out[1] = c.z; ok = true; } }
    return ok;
  }

  async function spawn() {
    if (C.loading) return; C.loading = true;
    for (const d of defs) {
      if (list.some(n => n.def === d)) continue;
      let p;
      try { p = await o.cast.make(d.body || "dell", { look: "amb-" + d.id }); } catch (e) { continue; }
      p.group.visible = false; o.world.add(p.group);
      // on a phone the wet ground's mirror leaves them out (layer 4 is not in that pass): half the draws
      if (o.lite) for (const m of p.meshes) m.layers.set(4);
      const sh = o.blob ? o.blob() : null; if (sh) { sh.visible = false; o.world.add(sh); }
      const small = p.meshes.filter(m => SMALL.test(m.userData.role || ""));
      const n = { def: d, id: d.id, p, sh, small, steps: [], i: 0, path: null, pi: 0, wait: 0, face: [0, 0], faceOn: false, look: new THREE.Vector3(), lookT: 0, back: 0, bx: 0, bz: 0, say: 0, line: 0, live: false, shown: false, lod: 0, acc: 0, stuck: 0,
        spot: { id: "amb:" + d.id, o: { verb: o.verb || "Talk", label: d.name, who: "amb", amb: true }, sp: { r: 2.1, amb: true }, p: new THREE.Vector3() } };
      list.push(n);
      if (C.on && C.set) place(n);
      await new Promise(r => setTimeout(r, 120)); // one at a time, between frames
    }
    C.loading = false;
  }
  function place(n) {
    const set = C.set; n.steps = plan(n.id, set); n.live = n.steps.length > 0 && C.on;
    if (!n.live) { hide(n); return; }
    n.i = (Math.random() * n.steps.length) | 0;
    const s = n.steps[n.i], q = C.nav && C.nav.near ? C.nav.near(s.x, s.z) : s;
    n.p.pos.set(q ? q.x : s.x, 0, q ? q.z : s.z); n.p.yaw = n.p.wantYaw = Math.random() * 6.28; n.p.speed = 0; n.p.pose = "stand"; n.p.lookAtP = null; n.p.talk = 0;
    n.path = null; n.wait = rnd(1, 5); n.back = 0; n.say = 0; n.lookT = 0; n.faceOn = false;
    if (n.p.umbrella) { n.p.hold = C.day ? null : "umbrella"; n.p.umbrella.visible = !C.day; }
    n.spot.p.set(n.p.pos.x, 1.5, n.p.pos.z);
  }
  function hide(n) { n.p.group.visible = false; n.shown = false; if (n.sh) n.sh.visible = false; }

  C.enter = (set, e = {}) => {
    C.set = set; C.day = !!e.day; C.nav = e.nav || null;
    C.on = !e.off && !!set && !!set.userData.nav && !!(set.userData.spots && set.userData.spots["bus-bench"]);
    spotList.length = 0;
    for (const n of list) { if (C.on) place(n); else { n.live = false; hide(n); } }
    if (C.on && list.length < defs.length) spawn();
  };

  function leg(n) {
    const s = n.steps[n.i], nav = C.nav;
    const pts = nav ? nav.path(n.p.pos.x, n.p.pos.z, s.x, s.z) : null;
    n.path = pts && pts.length ? pts : [{ x: s.x, z: s.z }]; n.pi = pts && pts.length > 1 ? 1 : 0; n.stuck = 0; n.act = null;
  }
  function arrive(n) {
    const s = n.steps[n.i]; n.path = null; n.wait = rnd(s.wait[0], s.wait[1]); n.faceOn = false;
    if (s.face === "road") { n.face[0] = n.p.pos.x + rnd(-2, 2); n.face[1] = 30; n.faceOn = true; }
    else if (s.face === "car") n.faceOn = nearestCar(C.set, n.p.pos.x, n.p.pos.z, n.face);
    else if (s.face) { n.face[0] = s.face[0]; n.face[1] = s.face[1]; n.faceOn = true; }
    n.act = s.act;
  }
  /* give ground: a short step back from (x, z), then a look at it */
  function backOff(n, x, z, far, secs) {
    let dx = n.p.pos.x - x, dz = n.p.pos.z - z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    n.bx = dx * far; n.bz = dz * far; n.back = 0.45; n.look.set(x, 1.3, z); n.lookT = secs; n.wait = Math.max(n.wait, secs * 0.8); n.path = null;
  }

  C.tick = (dt, ctx) => {
    if (!C.on || !list.length) return;
    C.frame++;
    const me = ctx.me, cam = ctx.cam.position, fx = ctx.fwd.x, fz = ctx.fwd.z, car = ctx.car, far = o.far || 46;
    for (let k = 0; k < list.length; k++) {
      const n = list[k]; if (!n.live) continue;
      const p = n.p;
      // ---- the routine: wait, then walk the next leg
      let sp = 0;
      if (n.back > 0) {
        // stepping back from you or from a car
        const u = Math.min(dt, n.back) / 0.45; n.back -= dt;
        const nx = p.pos.x + n.bx * u, nz = p.pos.z + n.bz * u;
        if (!ctx.blocked(nx, nz, 0.26)) { p.pos.x = nx; p.pos.z = nz; }
      } else if (n.say > 0) { n.say -= dt; if (n.say <= 0) { p.talk = 0; n.lookT = 1.2; } }
      else if (n.path && ctx.calm && me && Math.hypot(me.pos.x - p.pos.x, me.pos.z - p.pos.z) < 7) { /* a conversation close by: they hold where they are until it is over */ }
      else if (n.path) {
        const q = n.path[n.pi]; let dx = q.x - p.pos.x, dz = q.z - p.pos.z; const L = Math.hypot(dx, dz);
        if (L < 0.18) { if (++n.pi >= n.path.length) arrive(n); }
        else {
          dx /= L; dz /= L; sp = Math.min(1.25 * (p.tempo || 1), L * 2.5 + 0.3);
          // you in the way: lean round you; right on top of you, wait
          if (me && !ctx.car) {
            const mx = me.pos.x - p.pos.x, mz = me.pos.z - p.pos.z, md = Math.hypot(mx, mz), ahead = mx * dx + mz * dz;
            if (md < 1.5 && ahead > 0) {
              const away = dx * mz - dz * mx >= 0 ? -1 : 1, w = clamp((1.5 - md) / 0.9, 0, 1) * 0.9;
              const ox = -dz * away * w, oz = dx * away * w; dx += ox; dz += oz; const l2 = Math.hypot(dx, dz) || 1; dx /= l2; dz /= l2;
              if (md < 0.62) sp = 0;
            }
          }
          const nx = p.pos.x + dx * sp * dt, nz = p.pos.z + dz * sp * dt;
          if (sp > 0 && !ctx.blocked(nx, nz, 0.24)) { p.pos.x = nx; p.pos.z = nz; n.stuck = 0; }
          else if (sp > 0 && (n.stuck += dt) > 1.5) leg(n); // boxed in: ask the way again
          if (sp > 0) p.wantYaw = Math.atan2(dx, dz);
        }
      } else if ((n.wait -= dt) <= 0) { n.i = (n.i + 1) % n.steps.length; leg(n); }
      else if (n.faceOn && n.lookT <= 0) p.wantYaw = Math.atan2(n.face[0] - p.pos.x, n.face[1] - p.pos.z);
      p.speed = damp(p.speed, sp, 8, dt);
      if (n.say <= 0) p.talk = !n.path && n.back <= 0 && n.act === "order" && n.wait > 0.8 ? 0.6 : 0; // (ordering at the window, they talk with their hands a little)
      // ---- what they notice: a car close by, you running into them, you passing
      const mdx = me ? me.pos.x - p.pos.x : 99, mdz = me ? me.pos.z - p.pos.z : 99, md = Math.hypot(mdx, mdz);
      if (car) {
        const cd = Math.hypot(car.x - p.pos.x, car.z - p.pos.z);
        if (cd < 3.4 && Math.abs(car.speed) > 1.5 && n.back <= 0 && n.lookT < 1.5) backOff(n, car.x, car.z, 1.1, 2.6);
        else if (cd < 9 && Math.abs(car.speed) > 3 && n.lookT <= 0) { n.look.set(car.x, 1.2, car.z); n.lookT = 1.6; }
        if (n.lookT > 0 && cd < 14) n.look.set(car.x, 1.2, car.z);
      } else if (me && md < 0.5 && me.speed > 1.7 && n.back <= 0 && n.say <= 0) { backOff(n, me.pos.x, me.pos.z, 0.6, 1.8); if (o.onBump) o.onBump(n); }
      // nobody walks through anybody: this close, you are eased back out of them
      if (me && !car && md < 0.42 && md > 0.001 && !me.inCar) { const k = (0.42 - md) / md, px = me.pos.x + mdx * k, pz = me.pos.z + mdz * k; if (!ctx.blocked(px, pz, 0.2)) { me.pos.x = px; me.pos.z = pz; } }
      if (n.lookT > 0) { n.lookT -= dt; p.lookAtP = n.look; if (!n.path && n.back <= 0) p.wantYaw = Math.atan2(n.look.x - p.pos.x, n.look.z - p.pos.z); }
      else if (n.say > 0 || (!car && md < 4.2)) { p.lookAtP = ctx.head; if (n.say > 0) p.wantYaw = Math.atan2(mdx, mdz); }
      else p.lookAtP = null;
      // ---- drawn or not, and how finely
      const cx = p.pos.x - cam.x, cz = p.pos.z - cam.z, d = Math.hypot(cx, cz), inView = d < 5 || (cx * fx + cz * fz) / (d || 1) > 0.25;
      const show = d < far && inView, lod = d > 16 ? 1 : 0;
      if (show !== n.shown) { n.shown = show; p.group.visible = show; if (n.sh) n.sh.visible = show; if (show) { n.acc = 0; p.update(0.001); } }
      if (!show) continue;
      if (lod !== n.lod) { n.lod = lod; for (let i = 0; i < n.small.length; i++) n.small[i].visible = !lod; }
      n.acc += dt;
      if (!lod || ((C.frame + k) & 1) === 0) { p.update(Math.min(n.acc, 0.1)); n.acc = 0; }
      if (n.sh) n.sh.position.set(p.pos.x, 0.016, p.pos.z);
      p.headWorld(n.spot.p); n.spot.p.y -= 0.12;
    }
  };

  /* the ones you could talk to now (main.js adds them to its spots); the array is reused */
  C.spots = () => {
    spotList.length = 0;
    if (C.on) for (let k = 0; k < list.length; k++) { const n = list[k]; if (n.live && n.shown && n.back <= 0) spotList.push(n.spot); }
    return spotList;
  };
  /* they stop, face you and say the next of their remarks; returns { n, name, text } for the caption */
  C.say = id => {
    const n = list.find(x => "amb:" + x.id === id || x.id === id); if (!n || !n.live) return null;
    const lines = (C.day ? n.def.day : n.def.night) || n.def.night || []; if (!lines.length) return null;
    const text = lines[n.line % lines.length]; n.line++;
    n.path = null; n.wait = Math.max(n.wait, 4.5); n.say = clamp(1.6 + text.length * 0.055, 2.4, 5); n.p.talk = 1; n.back = 0; n.lookT = 0;
    return { n, name: n.def.name, text, secs: n.say };
  };
  C.honk = (x, z) => { if (!C.on) return 0; let c = 0; for (const n of list) { if (!n.live) continue; const d = Math.hypot(n.p.pos.x - x, n.p.pos.z - z); if (d < 16) { c++; n.look.set(x, 1.2, z); n.lookT = 2.4; if (d < 4.5 && n.back <= 0) backOff(n, x, z, 0.9, 2.6); } } return c; };
  C.near = (x, z, r) => { for (const n of list) if (n.live && Math.hypot(n.p.pos.x - x, n.p.pos.z - z) < r) return n; return null; };
  return C;
}
