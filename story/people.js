/* After Hours: the people. The cast is built in Blender from MakeHuman's CC0
   assets (tools/story/mh_cast.py), one GLB each, compressed with meshopt
   (tools/story/pack_cast.mjs): a body with real eye sockets, eyes on their own
   bones, brows, lashes, teeth, clothes, hair, the game_engine rig, and the face
   as shape keys. Here each one is painted with the episode's paint
   (story/paint.js) in its own colours.

   They move with motion capture style clips, not sine waves: one shared clip file
   (assets/story/cast/clips-<v>.glb, tools/story/clips.mjs, from Quaternius's
   Universal Animation Library, CC0) is retargeted at runtime onto each body, so a
   heavy man and a slight woman walk with the same data in their own proportions.
   On top of the clips, in this order:
   - locomotion: a 1D blend from idle to walk to jog driven by the speed the body
     really moves at (measured from its position, so a blocked walk never treads
     water), the walk and the jog phase locked on their foot contacts; the cadence
     follows the speed and the stride is warped to match it exactly
   - feet: each foot is locked to the ground while it bears weight and the legs
     reach it with two-bone IK, so feet never slide; standing still, a foot that
     ends up twisted or out of place takes a real step back under the body, which
     is also how a turn in place happens
   - leaning into turns and into a start, a breathing chest, weight shifts
   - upper-body layers: talking gestures, a phone at the ear, an umbrella held up,
     one-shot moves (reach, pick up, hand over, nod, shake), with arm IK for props
   - the head and eyes look at whoever is speaking or what is in focus, eyes lead
     and saccade, lids blink and track
   - the face: visemes from the voice's word timings, brows that react, a smile
   Poses written in character axes (x to its left, y up, z ahead) go on top. */
import * as THREE from "../vendor/three-0.184.0/three.module.min.js";
import { GLTFLoader } from "../vendor/three-0.184.0/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "../vendor/meshopt-0.22.0/meshopt_decoder.module.js";
import { paint } from "./paint.js";

/* the cast's version: assets/story/cast/<name>-<CAST_VER>.glb and clips-<CAST_VER>.glb */
export const CAST_VER = "v2";
/* switches for the cast lab (tools/story/lab.html) */
export const DEBUG = { ik: true };

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
const G = 9.81;

/* each character's colours. Cloth textures keep their folds and light, recoloured */
export const LOOKS = {
  jason: { skin: "#56331f", lip: "#7a4741", eyes: "#7a5a48", wide: 0.1, pocket: true, nose: true, hair: "#19130f", brow: "#0d0b0b", tie: "#1f4a38", cloth: { suit: "#2a4c3a", shoes: "#16110e" }, keep: "#ece9e1", glasses: "browline", studs: true, goatee: true },
  "jason-memory": { skin: "#56331f", lip: "#7a4741", eyes: "#7a5a48", wide: 0.1, nose: true, hair: "#19130f", brow: "#0d0b0b", cloth: { casual: "#4d5a6a", shoes: "#d9d3c7" }, keep: "#b9bfc6", glasses: "browline", goatee: true },
  player: { skin: "#8a5d40", lip: "#7f4c3c", eyes: "#6a4a36", wide: 0.05, hair: "#22170f", brow: "#22170f", cloth: { casual: "#8a6428", shoes: "#d6d0c4" }, keep: "#ddd6c8" },
  dell: { skin: "#6e4631", beard: "#6f6a62", hair: "#4a4640", brow: "#7d776e", wide: 0, cloth: { work: "#2f3a4a", shoes: "#2a2019", hat: "#34342f" }, keep: "#cfc9bd", umbrella: true, stubble: true, tempo: 0.92 },
  renata: { skin: "#b78a66", lip: "#a66a5a", hair: "#24170f", brow: "#5c4232", browTint: "#8a6248", wide: 0.05, cloth: { elegant: "#7a3b30", shoes: "#2a1f1a" }, keep: "#e3dccd" }
};

export async function loadCast(base, o = {}) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const motion = new Motion(await loader.loadAsync(o.clips || base + "clips-" + CAST_VER + ".glb"));
  const cache = {};
  return {
    motion,
    async make(name, o) {
      // every cast file ships under the cast's version, whatever version the caller asks for
      const file = name.replace(/-v\d+$/, "") + "-" + CAST_VER;
      const g = cache[file] || (cache[file] = loader.loadAsync(base + file + ".glb"));
      return new Person(file, (await g).scene, o || {}, motion);
    }
  };
}

/* ================================================================
   MOTION: the shared clips, resampled at 30 Hz on the source skeleton
   ================================================================ */
const FPS = 30;
const LOCO = ["walk", "walkb", "jog"];
class Motion {
  constructor(gltf) {
    const arm = gltf.scene.getObjectByName("Armature") || gltf.scene;
    const names = [], parent = [], lq = [], lp = [];
    arm.traverse(o => {
      if (o === arm) return;
      names.push(o.name); parent.push(o.parent === arm ? -1 : names.indexOf(o.parent.name));
      lq.push(o.quaternion.clone()); lp.push(o.position.clone());
    });
    this.names = names; this.parent = parent; this.n = names.length; this.base = arm.quaternion.clone();
    this.ix = {}; names.forEach((n, i) => (this.ix[n.toLowerCase()] = i));
    this.rest = this.pose(); for (let i = 0; i < this.n; i++) lq[i].toArray(this.rest.q, i * 4);
    this.pel = this.ix.pelvis; lp[this.pel].toArray(this.rest.p, 0);
    this.lp = lp;
    // the rest pose's world frames
    this.restW = this.fk(this.rest);
    this.clips = {};
    for (const a of gltf.animations) {
      const dur = a.duration, nf = Math.max(2, Math.round(dur * FPS) + 1);
      const q = new Float32Array(nf * this.n * 4), p = new Float32Array(nf * 3);
      for (let f = 0; f < nf; f++) { q.set(this.rest.q, f * this.n * 4); p.set(this.rest.p, f * 3); }
      for (const tr of a.tracks) {
        const [node, prop] = tr.name.split(".");
        const i = this.ix[node.toLowerCase()]; if (i == null) continue;
        const it = tr.createInterpolant();
        for (let f = 0; f < nf; f++) {
          const v = it.evaluate(Math.min(dur, f / FPS));
          if (prop === "quaternion") { const o = (f * this.n + i) * 4; let x = v[0], y = v[1], z = v[2], w = v[3]; const L = Math.hypot(x, y, z, w) || 1; q[o] = x / L; q[o + 1] = y / L; q[o + 2] = z / L; q[o + 3] = w / L; }
          else if (prop === "position" && i === this.pel) { p[f * 3] = v[0]; p[f * 3 + 1] = v[1]; p[f * 3 + 2] = v[2]; }
        }
      }
      this.clips[a.name] = { name: a.name, dur, nf, q, p, loop: /^(idle|converse|talk|phone|fold|walk|walkb|jog|sit|sitTalk|lean)$/.test(a.name) };
    }
    // locomotion clips: how far a cycle travels (from the stance foot), and when each foot bears weight
    for (const k of LOCO) if (this.clips[k]) this.analyse(this.clips[k]);
  }
  pose() { return { q: new Float32Array(this.n * 4), p: new Float32Array(3) }; }
  /* sample a clip at time t (seconds) into out */
  sample(c, t, out) {
    const last = c.nf - 1;
    let u = t * FPS;
    if (c.loop) { u %= last; if (u < 0) u += last; } else u = clamp(u, 0, last);
    const f0 = Math.min(last, Math.floor(u)), f1 = Math.min(last, f0 + 1), a = u - f0, n = this.n;
    const q = c.q, o0 = f0 * n * 4, o1 = f1 * n * 4, oq = out.q;
    for (let i = 0; i < n * 4; i += 4) {
      let x1 = q[o1 + i], y1 = q[o1 + i + 1], z1 = q[o1 + i + 2], w1 = q[o1 + i + 3];
      const x0 = q[o0 + i], y0 = q[o0 + i + 1], z0 = q[o0 + i + 2], w0 = q[o0 + i + 3];
      if (x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1 < 0) { x1 = -x1; y1 = -y1; z1 = -z1; w1 = -w1; }
      const x = x0 + (x1 - x0) * a, y = y0 + (y1 - y0) * a, z = z0 + (z1 - z0) * a, w = w0 + (w1 - w0) * a, L = 1 / (Math.hypot(x, y, z, w) || 1);
      oq[i] = x * L; oq[i + 1] = y * L; oq[i + 2] = z * L; oq[i + 3] = w * L;
    }
    const p = c.p; for (let k = 0; k < 3; k++) out.p[k] = p[f0 * 3 + k] + (p[f1 * 3 + k] - p[f0 * 3 + k]) * a;
    return out;
  }
  /* world (armature space) frames of a pose: quaternions and positions */
  fk(pose, out) {
    const n = this.n; out = out || { q: Array.from({ length: n }, () => new THREE.Quaternion()), p: Array.from({ length: n }, () => new THREE.Vector3()) };
    for (let i = 0; i < n; i++) {
      const pi = this.parent[i], lq = _q1.fromArray(pose.q, i * 4), lp = i === this.pel ? _v1.fromArray(pose.p, 0) : _v1.copy(this.lp[i]);
      if (pi < 0) { out.q[i].copy(this.base).multiply(lq); out.p[i].copy(lp).applyQuaternion(this.base); }
      else { out.q[i].copy(out.q[pi]).multiply(lq); out.p[i].copy(lp).applyQuaternion(out.q[pi]).add(out.p[pi]); }
    }
    return out;
  }
  analyse(c) {
    const pose = this.pose(), W = { q: Array.from({ length: this.n }, () => new THREE.Quaternion()), p: Array.from({ length: this.n }, () => new THREE.Vector3()) };
    const fl = this.ix.foot_l, fr = this.ix.foot_r, last = c.nf - 1;
    const ys = { l: [], r: [] }, zs = { l: [], r: [] };
    for (let f = 0; f < last; f++) { this.sample(c, f / FPS, pose); this.fk(pose, W); ys.l.push(W.p[fl].y); ys.r.push(W.p[fr].y); zs.l.push(W.p[fl].z); zs.r.push(W.p[fr].z); }
    const contact = {};
    let dist = 0;
    for (const s of ["l", "r"]) {
      const y = ys[s], z = zs[s], lo = Math.min(...y);
      // bearing weight: low, and moving back under the body as the body passes over it
      contact[s] = y.map((v, f) => (v < lo + 0.03 && z[(f + 1) % last] - z[f] < 0.004 ? 1 : 0));
      // the distance a cycle travels: how far the stance foot slides back per frame, times the frames
      let sum = 0, cnt = 0; for (let f = 0; f < last; f++) if (contact[s][f] && contact[s][(f + 1) % last]) { sum += z[f] - z[(f + 1) % last]; cnt++; }
      if (cnt) dist = Math.max(dist, (sum / cnt) * last);
    }
    // the cycle's phase origin: the left heel strike
    let h = 0; for (let f = 0; f < last; f++) if (contact.l[f] && !contact.l[(f - 1 + last) % last]) { h = f; break; }
    c.dist = dist; c.heel = h / last; c.contact = contact; c.footY = ys; c.lo = { l: Math.min(...ys.l), r: Math.min(...ys.r) };
  }
}
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _e = new THREE.Euler(0, 0, 0, "ZXY"), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const _k1 = new THREE.Vector3(), _k2 = new THREE.Vector3(), _k3 = new THREE.Vector3(), _k4 = new THREE.Vector3(), _kq = new THREE.Quaternion(), _kq2 = new THREE.Quaternion();
const _f1 = new THREE.Vector3(), _f2 = new THREE.Vector3(), _f3 = new THREE.Vector3(), _f4 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/* which bones a layer moves: masks over the source skeleton */
function mask(motion, fn) { const m = new Float32Array(motion.n); motion.names.forEach((n, i) => (m[i] = fn(n.toLowerCase()))); return m; }
function chainOf(name) {
  if (/^(root|pelvis)$/.test(name)) return "hips";
  if (/^(thigh|calf|foot|ball)_/.test(name)) return "legs";
  if (/^spine_01$/.test(name)) return "spine1";
  if (/^spine_0[23]$/.test(name)) return "spine";
  if (/^(neck_01|head)$/.test(name)) return "head";
  if (/_r$/.test(name)) return "armR";
  if (/_l$/.test(name)) return "armL";
  return "other";
}
const MASKS = {
  calm: c => ({ armL: 0.4, armR: 0.4 })[c] || 1,
  upper: c => ({ spine1: 0.35, spine: 1, head: 1, armL: 1, armR: 1 })[c] || 0,
  upperL: c => ({ spine1: 0.3, spine: 0.8, head: 1, armL: 1 })[c] || 0,
  arms: c => ({ spine: 0.4, head: 0.6, armL: 1, armR: 1 })[c] || 0,
  armR: c => ({ armR: 1, spine: 0.15 })[c] || 0,
  armL: c => ({ armL: 1, spine: 0.15 })[c] || 0,
  head: c => ({ head: 1, spine: 0.3 })[c] || 0
};

/* ================================================================
   A PERSON
   ================================================================ */
class Person {
  constructor(name, scene, o, motion) {
    this.name = name.replace(/-v\d+$/, ""); this.L = LOOKS[this.name] || LOOKS.player;
    this.M = motion;
    this.group = new THREE.Group(); this.group.name = name;
    this.root = scene; this.group.add(scene);
    this.bones = {}; this.meshes = []; this.morph = null;
    scene.traverse(n => {
      if (n.isBone) this.bones[n.name] = n;
      if (n.isMesh) { n.frustumCulled = false; n.layers.enable(1); this.meshes.push(n); }
    });
    this.paint();
    // rest: each bone's local rotation, and its frame in character space (the scene's space)
    scene.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(scene.matrixWorld).invert();
    this.rest = {};
    for (const [k, b] of Object.entries(this.bones)) {
      const m = new THREE.Matrix4().multiplyMatrices(inv, b.matrixWorld);
      const w = new THREE.Quaternion(); m.decompose(new THREE.Vector3(), w, new THREE.Vector3());
      this.rest[k] = { q: b.quaternion.clone(), w, wi: w.clone().invert(), p: b.position.clone(), at: new THREE.Vector3().setFromMatrixPosition(m) };
    }
    this.height = (this.rest.head ? this.rest.head.at.y : 1.6) + 0.18;
    this.rig();
    this.props(o);
    // state the episode drives
    this.pos = new THREE.Vector3(); this.yaw = 0; this.wantYaw = 0; this.speed = 0; this.phase = 0; this.t = Math.random() * 10;
    this.lookAtP = null; this.talk = 0; this.nod = 0; this.brow = 0; this.smile = 0;
    this.pose = "stand"; this.hold = this.L.umbrella ? "umbrella" : null;
    // internal
    this.lookYaw = 0; this.lookPitch = 0; this.mouth = 0; this.blinkT = 2 + Math.random() * 3; this.blink = 0;
    this.browK = 0; this.smileK = 0; this.visK = {}; this.vis = null; this.visT = 0; this.words = null;
    this.vel = new THREE.Vector3(); this.lastPos = null; this.gs = 0; this.gsF = 0; this.yawRate = 0; this.lean = 0; this.leanF = 0;
    this.locoW = 0; this.jogW = 0; this.lw = [1, 0, 0]; this.gPhase = Math.random(); this.idleT = Math.random() * 10; this.talkT = Math.random() * 3; this.talkW = 0;
    this.sitK = 0; this.sitT = 0; this.sitState = "out"; this.holdK = {}; this.shot = null; this.shotT = 0;
    this.eye = { x: 0, y: 0, tx: 0, ty: 0, t: 0.5 };
    this.feet = { l: this.foot("l"), r: this.foot("r") };
    this.tempo = (this.L.tempo || 1) * (0.96 + Math.random() * 0.08);
    this.lod = 0; this._hip = new THREE.Vector3();
    // the debug view (?debug=story) can reach the cast from the console and the harness
    if (typeof location !== "undefined" && /debug=story/.test(location.search)) (window.__people || (window.__people = {}))[this.name] = this;
  }

  /* map the source skeleton onto this body: per bone, the constant K with  T_world = S_world * K */
  rig() {
    const M = this.M, R = this.rest;
    // our bones in parent-first order, from the rig's Root
    const order = [], par = [];
    const rootB = Object.values(this.bones).find(b => !b.parent || !b.parent.isBone);
    (function walk(b, p) { if (!b.isBone) return; const i = order.length; order.push(b); par.push(p); for (const c of b.children) walk(c, i); })(rootB, -1);
    this.order = order; this.par = par; this.nb = order.length;
    this.bi = {}; order.forEach((b, i) => (this.bi[b.name] = i));
    // the frame of the Root's parent in character space (the rig node; static)
    const baseM = new THREE.Matrix4().copy(this.root.matrixWorld).invert().multiply(rootB.parent.matrixWorld);
    this.baseQ = new THREE.Quaternion(); this.baseP = new THREE.Vector3(); baseM.decompose(this.baseP, this.baseQ, new THREE.Vector3());
    this.lq = order.map(b => b.quaternion.clone());
    this.lp = order.map(b => b.position.clone());
    this.wq = order.map(() => new THREE.Quaternion()); this.wp = order.map(() => new THREE.Vector3());
    this.src = order.map(b => (M.ix[b.name.toLowerCase()] != null ? M.ix[b.name.toLowerCase()] : -1));
    // principal child for a bone's direction
    const child = n => ({ pelvis: "spine_01", spine_01: "spine_02", spine_02: "spine_03", spine_03: "neck_01", neck_01: "head", hand_l: "middle_01_l", hand_r: "middle_01_r", foot_l: "ball_l", foot_r: "ball_r" })[n] ||
      (this.bones[n] && this.bones[n].children.find(c => c.isBone) ? this.bones[n].children.find(c => c.isBone).name : null);
    const SW = M.restW;
    this.K = order.map(() => new THREE.Quaternion());
    const C = order.map(() => new THREE.Quaternion());
    order.forEach((b, i) => {
      const s = this.src[i]; if (s < 0) return;
      const ch = child(b.name), sc = ch != null ? M.ix[ch.toLowerCase()] : null;
      if (ch && R[ch] && sc != null) {
        const dt = R[ch].at.clone().sub(R[b.name].at).normalize(), ds = SW.p[sc].clone().sub(SW.p[s]).normalize();
        C[i].setFromUnitVectors(ds, dt);
      } else if (par[i] >= 0) C[i].copy(C[par[i]]);
      // K = S_rest^-1 * C^-1 * T_rest
      this.K[i].copy(SW.q[s]).invert().multiply(C[i].clone().invert()).multiply(R[b.name].w);
    });
    // proportions: the source scaled to this body by hip height
    const sp = SW.p[M.pel];
    // the source's leg (hip joint to ankle) to this body's, and where each pelvis hangs from the middle of its hip joints
    const sLeg = SW.p[M.ix.calf_l].distanceTo(SW.p[M.ix.thigh_l]) + SW.p[M.ix.foot_l].distanceTo(SW.p[M.ix.calf_l]);
    const tLeg = R.calf_l.at.distanceTo(R.thigh_l.at) + R.foot_l.at.distanceTo(R.calf_l.at);
    this.hipS = tLeg / sLeg;
    this.sHip0 = SW.p[M.ix.thigh_l].clone().add(SW.p[M.ix.thigh_r]).multiplyScalar(0.5);
    this.tHip0 = R.thigh_l.at.clone().add(R.thigh_r.at).multiplyScalar(0.5);
    this.pelOff = R.pelvis.at.clone().sub(this.tHip0).applyQuaternion(R.pelvis.wi);
    this.sHip = new THREE.Vector3();
    // the legs, for IK
    this.leg = {};
    for (const s of ["l", "r"]) {
      const th = this.bi["thigh_" + s], ca = this.bi["calf_" + s], fo = this.bi["foot_" + s], ba = this.bi["ball_" + s];
      this.leg[s] = { th, ca, fo, ba, l1: R["calf_" + s].at.distanceTo(R["thigh_" + s].at), l2: R["foot_" + s].at.distanceTo(R["calf_" + s].at), ankle: R["foot_" + s].at.y, sTh: M.ix["thigh_" + s], sFo: M.ix["foot_" + s] };
    }
    this.arm = {};
    for (const s of ["l", "r"]) {
      const ua = this.bi["upperarm_" + s], la = this.bi["lowerarm_" + s], ha = this.bi["hand_" + s];
      if (ua == null) continue;
      this.arm[s] = { ua, la, ha, l1: R["lowerarm_" + s].at.distanceTo(R["upperarm_" + s].at), l2: R["hand_" + s].at.distanceTo(R["lowerarm_" + s].at),
        dir: R["lowerarm_" + s].at.clone().sub(R["upperarm_" + s].at).normalize().applyQuaternion(R["upperarm_" + s].wi) };
    }
    // eyes, when the body has eye bones
    this.eyeB = ["eye_l", "eye_r"].map(n => this.bones[n]).filter(Boolean);
    // layer masks and pose buffers
    this.mk = {}; for (const [k, f] of Object.entries(MASKS)) this.mk[k] = mask(M, n => f(chainOf(n)));
    this.P = { a: M.pose(), b: M.pose(), c: M.pose(), acc: M.pose(), tmp: M.pose() };
    this.SW = M.fk(M.rest);
    this.headFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(M.restW.q[M.ix.head].clone().invert());
  }

  under(k, a) { for (let p = this.par[k]; p >= 0; p = this.par[p]) if (p === a) return true; return false; }
  foot(s) { return { lock: false, w: 0, pos: new THREE.Vector3(), yaw: 0, step: 0, from: new THREE.Vector3(), fromYaw: 0, to: new THREE.Vector3(), toYaw: 0, init: false }; }

  paint() {
    const L = this.L;
    for (const m of this.meshes) {
      const name = (m.material && m.material.name) || "";
      const map = m.material && m.material.map;
      if (map) map.colorSpace = THREE.SRGBColorSpace;
      let mat;
      if (name === "skin") { if (map) map.colorSpace = THREE.NoColorSpace; mat = paint({ color: L.skin, skin: true, rim: 0.55, wet: 0.015, mask: map || null, beard: L.beard || L.hair, lip: L.lip || "#5e342b", curlK: 1400 * (m.scale.x || 1) }); this.morph = m; this.skinMat = mat; }
      else if (name === "hair" && !map) mat = paint({ color: L.hair, curl: true, curlK: 1100 * (m.scale.x || 1), rim: 0.15, wet: 0.0, hairline: !!m.geometry.attributes.color, keep: L.skin });
      // card hair, painted as one mass: the strand texture's cut-outs shimmer into a grid of cards at a distance, so the
      // cards are drawn solid with the painted strand grain on them instead
      else if (name === "hair") mat = paint({ color: L.hair, curl: true, curlK: 700 * (m.scale.x || 1), rim: 0.3, wet: 0.12, side: THREE.DoubleSide });
      else if (name === "goatee") mat = paint({ color: L.hair, curl: true, curlK: 1400 * (m.scale.x || 1), rim: 0.4, wet: 0.2 });
      // brows: the strand texture tinted (not recoloured) so a lighter brow keeps its hairs and tapers where the texture thins
      else if (name === "brow") mat = paint({ color: L.browTint || L.brow, map, alphaTest: 0.22, rim: 0, wet: 0, side: THREE.DoubleSide, transparent: false });
      // lashes: drawn before the brows and without writing depth (drawn after them, the lash cards wash the brows out pale)
      else if (name === "lash") { mat = paint({ color: L.brow, map, alphaTest: 0.5, rim: 0, wet: 0, side: THREE.DoubleSide, recolor: true, keep: L.brow, depthWrite: false }); m.renderOrder = -1; }
      else if (name === "teeth") mat = paint({ color: "#d6cfc1", rim: 0 });
      // the eye texture carries its own white and brown iris: a near-white tint keeps the whites white
      else if (name === "eyes") mat = paint({ color: "#e8e6e2", map, wet: 2.6, rim: 0.1 });
      else if (name.startsWith("cloth")) {
        const key = Object.keys(L.cloth).find(k => name.includes(k)) || Object.keys(L.cloth)[0];
        // wool and cotton are matte: no wet sheen, a soft rim at grazing angles only; shoes keep a little polish
        mat = paint({ color: L.cloth[key], map, recolor: !!map, keep: key === "shoes" ? L.cloth.shoes : L.keep, tie: key === "suit" ? L.tie : null, rim: key === "shoes" ? 0.4 : 0.22, wet: key === "shoes" ? 0.35 : 0.0 });
      } else mat = paint({ color: "#777" });
      m.material = mat; m.userData.role = name;
    }
    this.fx = {};
    this.morphs = this.meshes.filter(m => m.morphTargetDictionary && m.morphTargetInfluences);
  }

  props(o) {
    const head = this.bones.head, L = this.L;
    if (!head) return;
    const hs = this.rest.head;
    const at = (x, y, z) => { const v = new THREE.Vector3(x, y, z); return v.applyQuaternion(hs.wi); };
    // the eyes: their box in character space, relative to the head bone (for the glasses, the catchlights, the nose stud)
    let ex = 0.0315, ey = 0.075, ez = 0.098, R = 0.0205;
    {
      const eyes = this.meshes.find(m => m.userData.role === "eyes");
      if (eyes) {
        const bb = new THREE.Box3().setFromBufferAttribute(eyes.geometry.attributes.position).applyMatrix4(eyes.matrixWorld);
        const r = (bb.max.y - bb.min.y) / 2;
        ex = (bb.max.x - bb.min.x) / 2 - r; ey = (bb.max.y + bb.min.y) / 2 - hs.at.y; ez = bb.max.z - hs.at.z + 0.011; R = r * 1.45;
        this.eyeR = r; this.noseY = ey - 0.04; this.noseZ = bb.max.z - hs.at.z + 0.001;
        this.eyeX = ex; this.eyeY = ey; this.eyeZ = bb.max.z - hs.at.z;
      }
    }
    if (L.glasses === "browline") {
      const g = new THREE.Group(); this.glasses = g; head.add(g);
      const black = paint({ color: "#0a0a0a", wet: 1.6, rim: 0.5 }), gold = paint({ color: "#c9a96a", wet: 2.4, rim: 0.4, emit: "#150f05" });
      const lens = new THREE.MeshBasicMaterial({ color: "#a9bccb", transparent: true, opacity: 0.08, depthWrite: false });
      // squarer and wider, like his: a straight black brow bar across the top, thin gold rims round the sides and bottom
      const Rw = R * 1.18, Rh = R * 0.82, bridgeY = ey + Rh * 0.55;
      const rrect = (cx, cy, w, h, rr, n, from, to) => { const pts = []; for (let i = 0; i <= n; i++) { const a = from + (to - from) * i / n, c = Math.cos(a), s2 = Math.sin(a); const px = Math.sign(c) * Math.pow(Math.abs(c), 0.4) * w, py = Math.sign(s2) * Math.pow(Math.abs(s2), 0.4) * h; pts.push(new THREE.Vector3(cx + px, cy + py, ez - Math.max(0, -s2) * 0.002)); } return pts; };
      for (const side of [1, -1]) {
        const cx = (ex + R * 0.12) * side, cy = ey - Rh * 0.08;
        const top = new THREE.CatmullRomCurve3([new THREE.Vector3(cx - Rw * 1.02, cy + Rh * 0.78, ez - 0.002), new THREE.Vector3(cx, cy + Rh * 1.0, ez + 0.001), new THREE.Vector3(cx + Rw * 1.04, cy + Rh * 0.82, ez - 0.004)]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(top, 12, 0.0032, 6), black));
        g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rrect(cx, cy, Rw, Rh, 0.3, 24, Math.PI * 1.02, Math.PI * 1.98)), 24, 0.0008, 4), gold));
        const lm = new THREE.Mesh(new THREE.PlaneGeometry(Rw * 2, Rh * 1.9), lens); lm.position.set(cx, cy, ez - 0.0015); g.add(lm);
        const arm = new THREE.CatmullRomCurve3([new THREE.Vector3(cx + side * Rw * 1.04, cy + Rh * 0.8, ez - 0.004), new THREE.Vector3(side * 0.071, cy + Rh * 0.75, ez - 0.05), new THREE.Vector3(side * 0.073, cy + Rh * 0.3, ez - 0.1)]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(arm, 8, 0.0017, 4), gold));
        for (const k of [0.62, 0.8]) { const rv = new THREE.Mesh(new THREE.SphereGeometry(0.0011, 6, 4), gold); rv.position.set(cx + side * Rw * k, cy + Rh * 0.9, ez + 0.0026); g.add(rv); }
      }
      const bridge = new THREE.CatmullRomCurve3([new THREE.Vector3(ex - R * 0.95, bridgeY, ez), new THREE.Vector3(0, bridgeY + 0.002, ez + 0.003), new THREE.Vector3(-ex + R * 0.95, bridgeY, ez)]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(bridge, 6, 0.0012, 4), gold));
      g.quaternion.copy(hs.wi);
      this.glassesFit = g;
    }
    if (L.studs) {
      const st = paint({ color: "#eef3f6", wet: 3, emit: "#2a2e33" });
      this.studs = [];
      // a diamond stud in his left ear only
      const s1 = new THREE.Mesh(new THREE.OctahedronGeometry(0.0032, 0), st); s1.position.copy(at(0.074, 0.032, 0.014)); head.add(s1); this.studs.push(s1);
    }
    if (this.eyeR) {
      // a catchlight in each eye, on the eye itself when it has a bone so it moves with the look
      const cl = new THREE.MeshBasicMaterial({ color: "#f3e9d8", transparent: true, opacity: 0.55, depthWrite: false });
      for (const side of [1, -1]) {
        const d = new THREE.Mesh(new THREE.SphereGeometry(this.eyeR * 0.07, 6, 4), cl);
        const eb = this.bones[side > 0 ? "eye_l" : "eye_r"];
        const p = at(this.eyeX * side - this.eyeR * 0.12, this.eyeY + this.eyeR * 0.14, this.eyeZ + 0.0004);
        if (eb) { const r = this.rest[eb.name]; const pw = p.clone().applyQuaternion(hs.w).add(hs.at); d.position.copy(pw.sub(r.at).applyQuaternion(r.wi)); eb.add(d); }
        else { d.position.copy(p); head.add(d); }
      }
    }
    if (L.nose && this.eyeR) {
      const ns = new THREE.Mesh(new THREE.SphereGeometry(0.0013, 6, 5), paint({ color: "#eef3f6", wet: 3, emit: "#30343a" }));
      ns.position.copy(at(0.0145, this.noseY || 0.03, this.noseZ || 0.12)); head.add(ns); this.noseStud = ns;
    }
    if (L.pocket && this.bones.spine_03) {
      // a white pocket square in the jacket's left breast pocket
      const sp = this.rest.spine_03, ps = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.016, 0.006), paint({ color: "#ece9e1", rim: 0.3 }));
      const w = this.chestPocket || new THREE.Vector3(0.1, 0.12, 0.125);
      ps.position.copy(w.clone().applyQuaternion(sp.wi)); ps.quaternion.copy(sp.wi); this.bones.spine_03.add(ps);
    }
    if (L.umbrella && this.bones.hand_r) {
      // a long umbrella, held by its hook at about chest height; the shaft runs down through the fist and the canopy rides above the head
      const u = new THREE.Group();
      // the canopy: eight panels that sag between the ribs, a little dome
      const cg = new THREE.ConeGeometry(0.6, 0.3, 32, 4, true), cp = cg.attributes.position;
      for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), z = cp.getZ(i), y = cp.getY(i), r = Math.hypot(x, z), a = Math.atan2(z, x); const sag = (1 - Math.abs(Math.cos(a * 4))) * 0.035 * (r / 0.6); const dome = Math.sin((r / 0.6) * Math.PI) * 0.05; cp.setY(i, y - sag + dome); }
      cg.computeVertexNormals();
      const canopy = new THREE.Mesh(cg, paint({ color: "#151716", wet: 1.8, rim: 0.7, side: THREE.DoubleSide }));
      canopy.position.y = 0.74; u.add(canopy);
      const rib = paint({ color: "#2a2a28", wet: 1 });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.86, 6), rib); shaft.position.y = 0.35; u.add(shaft);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.12, 8), paint({ color: "#3a2a1c", wet: 0.6 })); grip.position.y = -0.02; u.add(grip);
      this.umbrella = u; this.add(u);
    }
  }
  add(o) { this.group.add(o); }

  /* set a bone from a rotation written in character axes, on top of its current local rotation (or of its rest when abs) */
  rot(name, x, y, z, abs) {
    const i = this.bi[name], r = this.rest[name]; if (i == null) return;
    _e.set(x, y, z, "ZXY"); _q1.setFromEuler(_e);
    _q2.copy(r.wi).multiply(_q1).multiply(r.w);
    if (abs) this.lq[i].copy(r.q).multiply(_q2); else this.lq[i].multiply(_q2);
  }
  headWorld(v = new THREE.Vector3()) { const h = this.bones.head; if (h) { h.getWorldPosition(v); v.y += 0.08; } else v.copy(this.pos).setY(1.6); return v; }
  eyeLevel() { return this.height - 0.1; }
  setFx(k, v) { for (const m of this.morphs) { const i = m.morphTargetDictionary[k]; if (i != null) m.morphTargetInfluences[i] = v; } }

  /* one-shot moves: "interact" (reach and touch), "pickup", "give" (hand something over), "yes", "no" */
  play(kind) {
    if (kind === "yes") { this.nodK = { t: 0, d: 0.9, a: 1 }; return 0.9; }
    if (kind === "no") { this.shakeK = { t: 0, d: 1.1, a: 1 }; return 1.1; }
    const c = { interact: "interact", pickup: "pickup", give: "give", reach: "interact" }[kind];
    if (!c || !this.M.clips[c]) return 0;
    this.shot = { c: this.M.clips[c], t: 0, kind, mask: kind === "pickup" ? null : "arms" };
    return this.shot.c.dur;
  }
  /* the voice's word timings drive the mouth: call every frame while a line plays */
  speak(words, now) { this.words = words || null; this.wordsNow = now; this.wordsAt = this.t; }

  /* ================================================================ */
  update(dt) {
    dt = Math.min(dt, 0.1);
    const t = (this.t += dt), M = this.M, L = this.L;
    // ---- where the body is and how fast it really moves
    if (!this.lastPos || this.lastPos.distanceTo(this.pos) > 3) { this.lastPos = this.pos.clone(); this.vel.set(0, 0, 0); this.feet.l.init = this.feet.r.init = false; }
    if (dt > 0) { _v1.copy(this.pos).sub(this.lastPos).divideScalar(dt); _v1.y = 0; this.vel.lerp(_v1, 1 - Math.exp(-14 * dt)); }
    this.lastPos.copy(this.pos);
    this.group.position.copy(this.pos);
    const prevYaw = this.yaw;
    const dy = angDiff(this.yaw, this.wantYaw);
    const moving = this.gs > 0.25;
    // standing turns are slower than walking ones, and start and stop softly
    const turnRate = moving ? 6 : this.sitK > 0.3 ? 0 : 3.2 * sstep(0.02, 0.35, Math.abs(dy)) + 0.6;
    this.yaw += clamp(dy, -turnRate * dt, turnRate * dt);
    this.group.rotation.y = this.yaw; this.group.updateMatrix();
    this.yawRate = damp(this.yawRate, dt > 0 ? angDiff(prevYaw, this.yaw) / dt : 0, 8, dt);
    // forward speed along the facing (strafing during a sharp turn counts less)
    const fwd = _v2.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const v = Math.max(0, this.vel.dot(fwd)) * 0.85 + this.vel.length() * 0.15;
    const prevGs = this.gs;
    this.gs = damp(this.gs, v, 10, dt);
    const acc = dt > 0 ? (this.gs - prevGs) / dt : 0;
    this.gsF = damp(this.gsF, acc, 4, dt);

    // ---- sitting
    const wantSit = this.pose === "sit";
    if (wantSit && this.sitState === "out") { this.sitState = "in"; this.sitT = this.sitK > 0.5 ? 9 : 0; }
    if (!wantSit && this.sitState !== "out") { this.sitState = this.sitState === "sit" ? "up" : "out"; this.sitT = 0; }
    this.sitT += dt;
    if (this.sitState === "in" && this.sitT > (M.clips.sitIn ? M.clips.sitIn.dur : 0)) this.sitState = "sit";
    if (this.sitState === "up" && this.sitT > (M.clips.sitOut ? M.clips.sitOut.dur * 0.9 : 0)) this.sitState = "out";
    this.sitK = damp(this.sitK, this.sitState === "out" ? 0 : 1, this.sitT < 0.05 && this.sitState === "sit" ? 50 : 8, dt);

    // ---- locomotion: a 1D blend over speed through the walk, the brisk walk and the jog, at their own speeds,
    // phase locked on the heel strike; the cadence follows the speed and the stride is warped to match it exactly
    const LC = this.locoClips || (this.locoClips = LOCO.map(k => M.clips[k]).filter(Boolean));
    const hs = this.hipS;
    const gs = this.gs * (1 - this.sitK);
    const nv = LC.map(c => (c.dist * hs) / c.dur), nf = LC.map(c => 1 / c.dur);
    const w = [0, 0, 0];
    if (gs <= nv[0]) w[0] = 1;
    else if (gs >= nv[LC.length - 1]) w[LC.length - 1] = 1;
    else for (let i = 0; i + 1 < LC.length; i++) if (gs >= nv[i] && gs <= nv[i + 1]) { const u = sstep(0, 1, (gs - nv[i]) / (nv[i + 1] - nv[i])); w[i] = 1 - u; w[i + 1] = u; }
    for (let i = 0; i < LC.length; i++) this.lw[i] = damp(this.lw[i], w[i], 7, dt);
    const ws = this.lw[0] + this.lw[1] + this.lw[2] || 1;
    for (let i = 0; i < 3; i++) this.lw[i] /= ws;
    this.jogW = this.lw[2] || 0;
    this.locoW = damp(this.locoW, sstep(0.05, 0.45, gs), 12, dt);
    // cadence: slower than the clip's below its speed (down to about 85 steps a minute), quicker above it
    let f = 0; for (let i = 0; i < LC.length; i++) f += this.lw[i] * nf[i];
    const v0 = nv[0], vN = nv[LC.length - 1];
    f *= gs < v0 ? clamp(Math.sqrt(gs / v0), 0.75, 1) : gs > vN ? clamp(Math.sqrt(gs / vN), 1, 1.2) : 1;
    f *= this.tempo;
    if (this.locoW > 0.01) this.gPhase = (this.gPhase + f * dt) % 1;
    // the phase the episode listens to for footsteps: each heel strike is a multiple of pi
    this.phase = this.gPhase * TAU;
    // stride warp: the blended stride scaled so that the feet travel exactly with the ground
    let dist = 0; for (let i = 0; i < LC.length; i++) dist += this.lw[i] * LC[i].dist * hs;
    this.stride = clamp(gs / Math.max(0.05, dist * f), 0, 1.3);

    // ---- sample and blend the clips into the source pose
    const P = this.P, acc0 = P.acc;
    // standing: the calm idle take, turning into the conversational one when engaged with someone
    this.idleT += dt * this.tempo;
    M.sample(this.hold === "phone" && M.clips.phone ? M.clips.phone : M.clips.idle, this.idleT, acc0);
    this.engW = damp(this.engW || 0, this.lookAtP && this.hold !== "phone" ? 1 : 0, 1.5, dt);
    // a standing style the episode can set: "fold" (arms folded) or "lean" (forearms on a rail or a car roof)
    this.styleW = damp(this.styleW || 0, this.idleStyle && M.clips[this.idleStyle] ? 1 : 0, 2, dt);
    if (this.styleW > 0.01) { const c = M.clips[this.idleStyle || this.lastStyle]; if (c) { this.lastStyle = c.name; M.sample(c, this.idleT, P.b); blendPose(acc0, P.b, this.styleW, c.name === "fold" ? this.mk.upper : null); } }
    if (this.engW > 0.01 && M.clips.converse) { this.convT = (this.convT || Math.random() * 9) + dt * this.tempo; M.sample(M.clips.converse, this.convT, P.c); blendPose(acc0, P.c, this.engW * 0.85, this.mk.calm); }
    if (this.locoW > 0.001) {
      let tot = 0, first = true;
      for (let i = 0; i < LC.length; i++) {
        const k = this.lw[i]; if (k < 0.002) continue;
        const c = LC[i], dst = first ? P.a : P.b;
        M.sample(c, ((this.gPhase + c.heel) % 1) * c.dur, dst);
        if (!first) blendPose(P.a, P.b, k / (tot + k), null);
        tot += k; first = false;
      }
      blendPose(acc0, P.a, this.locoW, null);
    }
    // a phone stays at the ear when walking
    if (this.hold === "phone" && this.locoW > 0.01 && M.clips.phone) { M.sample(M.clips.phone, this.idleT, P.c); blendPose(acc0, P.c, this.locoW, this.mk.armR); }
    // talking hands, standing (the gesture loop slows and quickens with the voice, and fades walking)
    const talking = this.talk > 0.05 && this.sitK < 0.5;
    this.talkW = damp(this.talkW, talking ? 1 : 0, talking ? 2.2 : 1.2, dt);
    // speaking: the captured conversation's hands come through more strongly (they stay inside the arm limits below)
    if (this.talkW > 0.01 && M.clips.converse) { M.sample(M.clips.converse, this.convT || 0, P.c); blendPose(acc0, P.c, this.talkW * 0.6 * (1 - this.locoW), this.hold === "umbrella" ? this.mk.armL : this.mk.arms); }
    // sitting: down, settled (talking when talking), and up
    if (this.sitK > 0.001 && M.clips.sit) {
      const st = this.sitState;
      if (st === "in") M.sample(M.clips.sitIn, this.sitT, P.b);
      else if (st === "up") M.sample(M.clips.sitOut, this.sitT, P.b);
      else { M.sample(M.clips.sit, t, P.b); if (M.clips.sitTalk && this.talk > 0.05) { M.sample(M.clips.sitTalk, t, P.c); blendPose(P.b, P.c, 0.8, this.mk.upper); } }
      blendPose(acc0, P.b, this.sitK, null);
    }
    // a one-shot over everything, eased in and out
    if (this.shot) {
      const s = this.shot; s.t += dt;
      const d = s.c.dur, w = sstep(0, 0.25, s.t) * (1 - sstep(d - 0.3, d, s.t));
      M.sample(s.c, s.t, P.c); blendPose(acc0, P.c, w * (1 - this.locoW * 0.6), s.mask ? this.mk[s.mask] : null);
      if (s.t >= d) this.shot = null;
    }

    // ---- retarget onto this body
    const SW = M.fk(acc0, this.SW);
    const n = this.nb, wq = this.wq, wp = this.wp, lq = this.lq, par = this.par;
    for (let i = 0; i < n; i++) {
      const s = this.src[i];
      if (s >= 0) wq[i].copy(SW.q[s]).multiply(this.K[i]);
      else if (par[i] >= 0) wq[i].copy(wq[par[i]]).multiply(this.rest[this.order[i].name].q);
      else wq[i].copy(this.baseQ).multiply(this.rest[this.order[i].name].q);
    }
    // the upper arms stay within a cone round hanging: the captured talker throws his arms up and out, and these
    // jackets are weighted for a man at ease, so past about 55 degrees the cloth balloons at the shoulder
    for (const sd of ["l", "r"]) {
      const g = this.arm[sd]; if (!g) continue;
      const d = _v1.copy(g.dir).applyQuaternion(wq[g.ua]);
      const lim = this.hold === "phone" && sd === "r" ? -0.1 : -0.57;
      if (d.y > lim) {
        const h = Math.hypot(d.x, d.z) || 1, want = _v2.set(d.x / h * Math.sqrt(1 - lim * lim), lim, d.z / h * Math.sqrt(1 - lim * lim));
        _q3.setFromUnitVectors(d, want);
        for (let k = g.ua; k < n; k++) { if (k !== g.ua && !this.under(k, g.ua)) break; wq[k].premultiply(_q3); }
      }
    }
    for (let i = 0; i < n; i++) {
      const pq = par[i] >= 0 ? wq[par[i]] : this.baseQ;
      lq[i].copy(pq).invert().multiply(wq[i]);
    }
    // relaxed hands: the library's idle hand is half a fist; open it toward a resting curl
    if (!this.fingers) this.fingers = this.order.map((b, i) => (/^(index|middle|ring|pinky|thumb)_0[123]_[lr]$/.test(b.name) ? i : -1)).filter(i => i >= 0);
    for (const i of this.fingers) lq[i].slerp(this.rest[this.order[i].name].q, /thumb/.test(this.order[i].name) ? 0.25 : 0.45);
    // the collarbones: captured shoulders shrug and roll more than these jackets can take; keep most of their rest
    for (const sd of ["l", "r"]) { const i = this.bi["clavicle_" + sd]; if (i != null && DEBUG.clav !== 0) lq[i].slerp(this.rest["clavicle_" + sd].q, DEBUG.clav == null ? 0.65 : DEBUG.clav); }
    // the hips: the source's hip travel, scaled to this body
    const pi = this.bi.pelvis, sp = SW.p[M.pel];
    const sHip = this.sHip.copy(SW.p[M.ix.thigh_l]).add(SW.p[M.ix.thigh_r]).multiplyScalar(0.5);
    const hipC = this._hip.copy(sHip).sub(this.sHip0).multiplyScalar(hs).add(this.tHip0);
    // sitting: the seat is 0.49 high; settle the hips on it whatever this body's legs
    if (this.sitK > 0.001) hipC.y += this.sitK * this.seatFix(sHip);
    this.hipC = hipC;

    // ---- procedural layers in character axes
    const breathe = Math.sin(t * TAU * 0.24 + this.tempo * 5);
    const still = (1 - this.locoW) * (1 - this.sitK);
    // lean into the turn (centripetal) and into the start (acceleration); never more than a few degrees
    this.lean = damp(this.lean, clamp(Math.atan(this.gs * this.yawRate / G) * 0.9, -0.22, 0.22), 6, dt);
    this.leanF = damp(this.leanF, clamp(this.gsF / G * 0.7, -0.08, 0.12), 5, dt);
    this.rot("pelvis", this.leanF * 0.4, 0, -this.lean * 0.6);
    this.rot("spine_01", this.leanF * 0.3 + breathe * 0.004, 0, -this.lean * 0.25);
    this.rot("spine_02", -breathe * 0.006, 0, -this.lean * 0.15);
    this.rot("spine_03", -breathe * 0.012, 0, 0);
    this.rot("clavicle_l", 0, 0, breathe * 0.012); this.rot("clavicle_r", 0, 0, -breathe * 0.012);
    // a slow weight shift when standing a long time
    const sway = Math.sin(t * 0.21 + this.tempo * 9) * still;
    this.rot("pelvis", 0, sway * 0.03, sway * 0.015); hipC.x += sway * 0.012;
    // contrapposto: the weight sits on one leg (that hip up and out, the other knee easy, the shoulders the other way),
    // and moves to the other leg every so often, each person on their own clock
    this.wT = (this.wT == null ? 2 + Math.random() * 6 : this.wT) - dt;
    if (this.wT <= 0) { this.wSide = -(this.wSide || (Math.random() < 0.5 ? 1 : -1)); this.wT = 6 + Math.random() * 9; }
    this.wK = damp(this.wK || 0, (this.wSide || 1) * (0.7 + 0.3 * Math.sin(t * 0.13 + this.tempo * 3)), 0.9, dt);
    const cp = this.wK * still;
    hipC.x += cp * 0.032; hipC.y -= Math.abs(cp) * 0.012;
    this.rot("pelvis", 0, -cp * 0.04, cp * 0.055);
    this.rot("spine_02", 0, 0, -cp * 0.035); this.rot("spine_03", 0, 0, -cp * 0.02);
    // relaxed arms: a soft bend at the elbow, the hands a little in front of the thighs
    const elb = still * (1 - this.talkW * 0.5) * (1 - this.engW * 0.3);
    for (const sd of ["l", "r"]) { if (this.hold === "umbrella" && sd === "r") continue; const k = sd === "l" ? 1 : 0.85; this.rot("upperarm_" + sd, -0.07 * elb, 0, 0); this.rot("lowerarm_" + sd, -0.3 * k * elb, 0, 0); }
    // running: the arms drive and the shoulders counter the hips
    const jw = this.jogW * this.locoW;
    if (jw > 0.01) {
      const c = Math.cos(this.gPhase * TAU);
      this.rot("upperarm_l", 0.3 * c * jw, 0, 0); this.rot("upperarm_r", -0.3 * c * jw, 0, 0);
      this.rot("lowerarm_l", -0.25 * jw, 0, 0); this.rot("lowerarm_r", -0.25 * jw, 0, 0);
      this.rot("spine_03", 0, 0.12 * c * jw, 0); this.rot("pelvis", 0, -0.06 * c * jw, 0);
    }

    // ---- the head looks
    let wantY = 0, wantP = 0;
    // idle glances: now and then a look off to one side and back, when nobody holds the eye
    this.gT = (this.gT == null ? 3 + Math.random() * 5 : this.gT) - dt;
    if (this.gT <= 0) { this.glance = this.glance ? 0 : (Math.random() - 0.5) * 1.3; this.gT = this.glance ? 1 + Math.random() * 1.6 : 4 + Math.random() * 6; }
    if (!this.lookAtP) wantY = (this.glance || 0) * still;
    if (this.lookAtP) {
      const hw = this.headWorld(_v4), d = _v1.copy(this.lookAtP).sub(hw);
      const local = angDiff(0, Math.atan2(d.x, d.z) - this.yaw);
      wantY = Math.abs(local) > 2.3 ? 0 : clamp(local, -1.2, 1.2);
      wantP = clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.45, 0.5);
    }
    // the head turns slower than the eyes, and less when walking
    const lk = this.lookAtP ? 4 : 2.5;
    this.lookYaw = damp(this.lookYaw, wantY * (1 - this.locoW * 0.4), lk, dt); this.lookPitch = damp(this.lookPitch, wantP, lk, dt);
    // a nod when a line starts (the episode sets nod to 1): down and back up, once; or a full yes / no from play()
    if (this.nod > 0.5) { this.nodK = this.nodK && this.nodK.a > 0.5 ? this.nodK : { t: 0, d: 0.55, a: 0.45 }; this.nod = 0; }
    let nodA = 0, shakeA = 0;
    if (this.nodK) { const k = this.nodK; k.t += dt; const u = k.t / k.d; nodA = u < 1 ? Math.sin(u * Math.PI * (k.a > 0.5 ? 2 : 1)) * (1 - u * 0.5) * 0.12 * k.a : 0; if (u >= 1) this.nodK = null; }
    if (this.shakeK) { const k = this.shakeK; k.t += dt; const u = k.t / k.d; shakeA = u < 1 ? Math.sin(u * Math.PI * 3) * (1 - u) * 0.16 : 0; if (u >= 1) this.shakeK = null; }
    const idleH = (Math.sin(t * 0.37) * 0.04 + Math.sin(t * 0.91) * 0.02) * (1 - this.locoW);
    // the clips look at the floor now and then; people in a scene keep their eyes up: level the gaze (fully when looking at someone)
    const hf = _v1.copy(this.headFwd).applyQuaternion(SW.q[M.ix.head]);
    const level = Math.asin(clamp(hf.y, -1, 1)) * (this.lookAtP ? 1 : 0.7) * (1 - this.sitK * 0.5);
    this.rot("neck_01", level * 0.4, 0, 0); this.rot("head", level * 0.6, 0, 0);
    this.rot("spine_03", this.lookPitch * 0.1, this.lookYaw * 0.15, 0);
    this.rot("neck_01", this.lookPitch * 0.35, this.lookYaw * 0.35 + idleH * 0.5, 0);
    this.rot("head", this.lookPitch * 0.5 + Math.abs(nodA) + Math.sin(t * 5.3) * 0.008 * this.mouth, this.lookYaw * 0.5 + idleH * 0.5 + shakeA, Math.sin(t * 0.53) * 0.015 * (1 - this.locoW));

    // ---- forward kinematics with the hips in place, then the feet and the hands
    this.fk(hipC);
    if (DEBUG.ik) { this.legs(dt); this.arms(dt); }
    // write the bones
    for (let i = 0; i < n; i++) this.order[i].quaternion.copy(lq[i]);
    const pb = this.order[pi], pp = par[pi] >= 0 ? par[pi] : -1;
    _v1.copy(wp[pi]); if (pp >= 0) _v1.sub(wp[pp]).applyQuaternion(_q1.copy(wq[pp]).invert()); else _v1.sub(this.baseP).applyQuaternion(_q1.copy(this.baseQ).invert());
    pb.position.copy(_v1);
    this.eyes(dt, wantY, wantP);
    this.face(dt);
    if (this.umbrella && this.bones.hand_r) {
      const hp = this.wp[this.bi.hand_r];
      this.umbrella.position.copy(hp).applyMatrix4(this.root.matrix).add(_v1.set(0, 0.03, 0));
      this.umbrella.rotation.set(-0.12 + this.leanF + this.locoW * 0.1, 0, 0.1 + this.lean * 0.5);
    }
  }

  /* how far to move the hips so a seated body rests on a 0.49 seat: from the source's sit pose */
  seatFix(sp) { return (0.49 - (sp.y * this.hipS - 0.02)) * 0 + 0; }

  /* positions and world rotations for the whole body in character space */
  fk(hipC) {
    const n = this.nb, wq = this.wq, wp = this.wp, lq = this.lq, par = this.par, pi = this.bi.pelvis;
    for (let i = 0; i < n; i++) {
      const p = par[i];
      if (p < 0) { wq[i].copy(this.baseQ).multiply(lq[i]); wp[i].copy(this.lp[i]).applyQuaternion(this.baseQ).add(this.baseP); }
      else { wq[i].copy(wq[p]).multiply(lq[i]); if (i === pi) wp[i].copy(this.pelOff).applyQuaternion(wq[i]).add(hipC); else wp[i].copy(this.lp[i]).applyQuaternion(wq[p]).add(wp[p]); }
    }
  }
  /* recompute a chain below bone i (after its local changed) */
  fkFrom(i) {
    const n = this.nb, wq = this.wq, wp = this.wp, lq = this.lq, par = this.par;
    const p = par[i]; wq[i].copy(wq[p]).multiply(lq[i]);
    for (let k = i + 1; k < n; k++) { const q = par[k]; if (q < i) break; wq[k].copy(wq[q]).multiply(lq[k]); wp[k].copy(this.lp[k]).applyQuaternion(wq[q]).add(wp[q]); }
  }

  /* ---- the legs: stride warp, foot locks, little steps, two-bone IK ---- */
  legs(dt) {
    if (this.sitK > 0.05) { this.feet.l.init = this.feet.r.init = false; return; }
    const M = this.M, LC = this.locoClips, SW = this.SW;
    // character space to the space the body stands in (its parent's), and back
    const toP = _m.multiplyMatrices(this.group.matrix, this.root.matrix), fromP = _m2.copy(toP).invert();
    this.loco = this.locoW > (this.loco ? 0.25 : 0.4);
    const t = this.t;
    for (const s of ["l", "r"]) {
      const g = this.leg[s], F = this.feet[s], other = this.feet[s === "l" ? "r" : "l"];
      // where the clip puts this ankle, scaled to this body and warped to the real stride
      const sa = SW.p[g.sFo], sh = SW.p[g.sTh];
      // the height over the floor the clip gives this ankle, from where the clip plants it
      let lo = this.srcAnkle(s) * (1 - this.locoW);
      for (let i = 0; i < LC.length; i++) lo += this.lw[i] * this.locoW * LC[i].lo[s];
      // standing, the feet come in under the hips (the capture stands a little wide for a man in a suit)
      const want = _f1.set(this.wp[g.th].x + (sa.x - sh.x) * this.hipS * lerp(0.55, 1, this.locoW) + (s === "l" ? 0.012 : -0.012) * (1 - this.locoW),
        this.rest["foot_" + s].at.y + (sa.y - lo) * this.hipS,
        this.wp[g.th].z + (sa.z - sh.z) * this.hipS * lerp(1, this.stride, this.locoW));
      const wantYaw = this.yaw;
      const wantW = _f2.copy(want).applyMatrix4(toP);
      if (!F.init) { F.pos.copy(wantW); F.yaw = wantYaw; F.lock = true; F.step = 0; F.init = true; F.w = 1; }
      if (this.loco) {
        // the clip says whether this foot bears weight now
        let cs = 0; for (let i = 0; i < LC.length; i++) if (this.lw[i] > 0.002) cs += this.lw[i] * contactAt(LC[i], (this.gPhase + LC[i].heel) % 1, s);
        const contact = cs > 0.5;
        F.step = 0;
        if (contact && !F.lock) { F.lock = true; F.pos.copy(wantW); F.yaw = wantYaw; if (this.onFoot) this.onFoot(s === "l" ? "L" : "R", clamp(0.35 + this.gs * 0.25, 0, 1)); }
        if (!contact) F.lock = false;
        // a lock that drifts too far (a sharp turn mid stride) gives way
        if (F.lock && F.pos.distanceTo(wantW) > 0.3) { F.pos.copy(wantW); F.yaw = wantYaw; }
        F.w = damp(F.w, F.lock ? 1 : 0, F.lock ? 40 : 12, dt);
      } else {
        // standing: feet stay put until one is out of place, then it steps; one foot at a time
        F.w = damp(F.w, 1, 12, dt);
        if (F.step > 0) {
          F.step = Math.min(1, F.step + dt / 0.28);
          const u = sstep(0, 1, F.step);
          F.pos.lerpVectors(F.from, wantW, u); F.pos.y = wantW.y + Math.sin(u * Math.PI) * 0.06;
          F.yaw = F.fromYaw + angDiff(F.fromYaw, wantYaw) * u;
          if (F.step >= 1) { F.step = 0; F.pos.copy(wantW); F.yaw = wantYaw; if (this.onFoot) this.onFoot(s === "l" ? "L" : "R", 0.2); }
        } else {
          if (!F.lock) { F.lock = true; }
          const off = Math.hypot(F.pos.x - wantW.x, F.pos.z - wantW.z), tw = Math.abs(angDiff(F.yaw, wantYaw));
          const free = other.step === 0 || other.step > 0.65;
          if ((off > 0.09 || tw > 0.45) && free && t - (this.lastStep || -9) > 0.1) {
            // the foot that is furthest out goes first
            const oOff = Math.hypot(other.pos.x - wantW.x, other.pos.z - wantW.z);
            if (other.step === 0 && oOff > off * 1.5 && Math.abs(angDiff(other.yaw, wantYaw)) > tw) { /* wait for the other */ }
            else { F.step = 0.001; F.from.copy(F.pos); F.fromYaw = F.yaw; this.lastStep = t; }
          }
        }
      }
      // the target in character space
      const lockC = _f3.copy(F.pos).applyMatrix4(fromP);
      const tgt = _f4.copy(want).lerp(lockC, F.w);
      // never through the floor
      tgt.y = Math.max(tgt.y, this.rest["foot_" + s].at.y * 0.9);
      this.ik2(g.th, g.ca, g.fo, g.l1, g.l2, tgt, angDiff(this.yaw, F.yaw) * F.w);
    }
  }
  srcAnkle(s) { if (this._srcAnkle == null) { const M = this.M; this._srcAnkle = { l: M.restW.p[M.ix.foot_l].y, r: M.restW.p[M.ix.foot_r].y }; } return this._srcAnkle[s]; }

  /* two-bone IK: thigh/upper arm a, knee/elbow b, ankle/wrist c reach tgt (character space); the end keeps its world rotation, turned by yawOff about up */
  ik2(a, b, c, l1, l2, tgt, yawOff) {
    const wq = this.wq, wp = this.wp, lq = this.lq, par = this.par;
    const endQ = _kq2.copy(wq[c]);
    if (yawOff) endQ.premultiply(_kq.setFromAxisAngle(UP, yawOff));
    const A = wp[a];
    const d = clamp(_k1.copy(tgt).sub(A).length(), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.002);
    // the bend: rotate the middle joint about its hinge to get the right reach
    const ab = _k2.copy(wp[b]).sub(A), bc = _k3.copy(wp[c]).sub(wp[b]);
    const cur = Math.acos(clamp(-ab.dot(bc) / (ab.length() * bc.length() || 1), -1, 1));
    const want = Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
    const axis = _k4.crossVectors(ab, bc);
    if (axis.lengthSq() < 1e-10) axis.set(1, 0, 0).applyQuaternion(wq[b]); // straight: bend about the joint's own x
    axis.normalize();
    _kq.setFromAxisAngle(axis, cur - want);
    wq[b].premultiply(_kq);
    lq[b].copy(wq[a]).invert().multiply(wq[b]);
    this.fkFrom(b);
    // then swing the whole limb so the end lands on the target
    const ac = _k2.copy(wp[c]).sub(A).normalize(), at = _k3.copy(tgt).sub(A).normalize();
    _kq.setFromUnitVectors(ac, at);
    wq[a].premultiply(_kq);
    lq[a].copy(wq[par[a]]).invert().multiply(wq[a]);
    this.fkFrom(a);
    // the end keeps its own orientation
    lq[c].copy(wq[b]).invert().multiply(endQ);
    this.fkFrom(c);
  }

  /* ---- the arms: props and holds, by IK on top of the clip ---- */
  arms(dt) {
    const want = { umbrella: this.hold === "umbrella" ? 1 : 0, phone: this.hold === "phone" ? 1 : 0 };
    for (const k of ["umbrella", "phone"]) this.holdK[k] = damp(this.holdK[k] || 0, want[k] * (1 - this.sitK), 5, dt);
    const uk = this.holdK.umbrella;
    if (uk > 0.01 && this.arm.r) {
      // the right fist in front of the chest, the forearm up, the elbow by the ribs
      const g = this.arm.r, R = this.rest;
      const sh = this.wp[g.ua];
      const tgt = _f1.set(R.upperarm_r.at.x * 0.7, R.upperarm_r.at.y - 0.16, R.upperarm_r.at.z + 0.27);
      tgt.y += Math.sin(this.t * 2.1) * 0.006 + this.locoW * 0.01 * Math.sin(this.phase * 2);
      const tg = _f2.copy(this.wp[g.ha]).lerp(tgt, uk);
      this.ik2(g.ua, g.la, g.ha, g.l1, g.l2, tg, 0);
      // the fist closes round the handle
      this.curl("r", 0.9 * uk);
    }
  }
  curl(s, k) {
    for (const fg of ["index", "middle", "ring", "pinky"]) for (let j = 1; j <= 3; j++) {
      const n = fg + "_0" + j + "_" + s, i = this.bi[n]; if (i == null) continue;
      this.lq[i].multiply(_q1.setFromAxisAngle(_v1.set(0, 0, s === "l" ? 1 : -1), k * (j === 1 ? 0.9 : 1.1)));
    }
  }

  /* ---- eyes: they lead the head, hold on the face they look at, and dart now and then ---- */
  eyes(dt, wantY, wantP) {
    const E = this.eye;
    E.t -= dt;
    if (E.t <= 0) {
      // a saccade: small when looking at someone (eye to eye to mouth), larger when idle
      const sm = this.lookAtP ? 0.05 : 0.14;
      E.tx = (Math.random() - 0.5) * sm * 2; E.ty = (Math.random() - 0.5) * sm;
      E.t = this.lookAtP ? 0.4 + Math.random() * 1.4 : 0.8 + Math.random() * 2.5;
    }
    // the eyes cover what the head hasn't turned yet
    const ly = clamp(wantY - this.lookYaw * 1.2, -0.45, 0.45), lp = clamp(wantP - this.lookPitch * 0.95, -0.3, 0.3);
    E.x = damp(E.x, ly + E.tx, 30, dt); E.y = damp(E.y, lp + E.ty, 30, dt);
    this.eyeLook = E;
    for (const b of this.eyeB) { const r = this.rest[b.name]; _e.set(E.y, E.x, 0, "YXZ"); _q1.setFromEuler(_e); _q2.copy(r.wi).multiply(_q1).multiply(r.w); b.quaternion.copy(r.q).multiply(_q2); }
  }

  /* ---- the face ---- */
  face(dt) {
    const L = this.L;
    this.mouth = damp(this.mouth, this.talk, 16, dt);
    this.browK = damp(this.browK, this.brow, 6, dt);
    this.smileK = damp(this.smileK, this.smile, 3, dt);
    // blinks: every few seconds, sometimes twice, and with every big glance
    this.blinkT -= dt;
    if (this.blinkT <= 0 || (this.eye && Math.abs(this.eye.tx) > 0.1 && this.eye.t > 1.9 && this.blink <= 0)) { this.blink = 1; this.blinkT = 2.4 + Math.random() * 3.6; if (Math.random() < 0.15) this.blinkT = 0.3; }
    this.blink = Math.max(0, this.blink - dt * 6.5);
    const close = Math.sin(Math.min(1, this.blink) * Math.PI);
    // the lids follow the eyes a little: down when they look down
    const lid = clamp(-(this.eyeLook ? this.eyeLook.y : 0) * 0.8, 0, 0.35);
    this.setFx("eyeBlinkLeft", Math.max(close, lid)); this.setFx("eyeBlinkRight", Math.max(close, lid));
    // the mouth: visemes from the voice's words when they're known, else syllables at speech rate
    const K = ["visAA", "visOW", "visEE", "visPBM", "visFV", "jawOpen"], tgt = { visAA: 0, visOW: 0, visEE: 0, visPBM: 0, visFV: 0, jawOpen: 0 };
    const words = this.words && this.t - this.wordsAt < 0.25 ? this.words : null;
    if (words) {
      const now = this.wordsNow + (this.t - this.wordsAt);
      const w = words.find(x => now >= x.s - 0.02 && now <= x.e);
      if (w && w !== this.lastWord) {
        // a long or stressed word lifts the brows a touch, and the head marks the beat
        this.lastWord = w;
        if (w.w.replace(/[^a-z]/gi, "").length >= 6 || /[!?]$/.test(w.w)) { this.browPulse = 0.35 + Math.random() * 0.25; if (Math.random() < 0.4 && !this.nodK) this.nodK = { t: 0, d: 0.4, a: 0.25 }; }
      }
      if (w) {
        const seq = visemes(w.w), u = clamp((now - w.s) / Math.max(0.05, w.e - w.s), 0, 0.999), k = seq[Math.floor(u * seq.length)];
        if (k) { tgt[k[0]] = k[1]; tgt.jawOpen = k[2]; }
      }
    } else if (this.mouth > 0.05) {
      this.visT -= dt;
      if (this.visT <= 0) { this.visT = 0.08 + Math.random() * 0.1; const pick = [["visAA", 0.7, 0.25], ["visOW", 0.6, 0.15], ["visEE", 0.6, 0.08], ["visPBM", 0.8, 0], ["visFV", 0.6, 0.04], ["visEE", 0.3, 0.12], [null, 0, 0.1]]; this.vis = pick[(Math.random() * pick.length) | 0]; }
      if (this.vis && this.vis[0]) { tgt[this.vis[0]] = this.vis[1] * this.mouth; }
      if (this.vis) tgt.jawOpen = this.vis[2] * this.mouth;
    }
    for (const k of K) { this.visK[k] = damp(this.visK[k] || 0, tgt[k], k === "visPBM" ? 30 : 20, dt); this.setFx(k, this.visK[k]); }
    // at rest the lips meet: the base face sits a little parted
    this.restLip = damp(this.restLip || 0, this.mouth < 0.05 && !words ? 1 : 0, 6, dt);
    this.setFx("mouthClose", 0); this.setFx("mouthPressLeft", this.restLip * 0.3); this.setFx("mouthPressRight", this.restLip * 0.3);
    // brows: up on a question and on stressed words, a touch of a frown when listening hard
    this.browPulse = damp(this.browPulse || 0, 0, 3, dt);
    const stress = this.browPulse;
    this.setFx("browInnerUp", clamp(this.browK, 0, 1) * 0.7 + this.mouth * 0.06 + stress);
    this.setFx("browOuterUpLeft", clamp(this.browK, 0, 1) * 0.35); this.setFx("browOuterUpRight", clamp(this.browK, 0, 1) * 0.35);
    this.setFx("browDownLeft", clamp(-this.browK, 0, 1) * 0.5); this.setFx("browDownRight", clamp(-this.browK, 0, 1) * 0.5);
    const wide = 0.14 + (L.wide || 0);
    this.setFx("eyeWideLeft", wide); this.setFx("eyeWideRight", wide);
    this.setFx("mouthSmileLeft", this.smileK * 0.5); this.setFx("mouthSmileRight", this.smileK * 0.5);
  }
}
function t0(p) { return p.t; }

/* blend pose b into a with weight w (per bone mask m), all in local quaternions */
function blendPose(a, b, w, m) {
  if (w <= 0) return;
  const qa = a.q, qb = b.q, n = qa.length / 4;
  for (let i = 0; i < n; i++) {
    const k = m ? w * m[i] : w; if (k <= 0) continue;
    const o = i * 4;
    let x = qb[o], y = qb[o + 1], z = qb[o + 2], ww = qb[o + 3];
    if (qa[o] * x + qa[o + 1] * y + qa[o + 2] * z + qa[o + 3] * ww < 0) { x = -x; y = -y; z = -z; ww = -ww; }
    const X = qa[o] + (x - qa[o]) * k, Y = qa[o + 1] + (y - qa[o + 1]) * k, Z = qa[o + 2] + (z - qa[o + 2]) * k, W = qa[o + 3] + (ww - qa[o + 3]) * k, L = 1 / (Math.hypot(X, Y, Z, W) || 1);
    qa[o] = X * L; qa[o + 1] = Y * L; qa[o + 2] = Z * L; qa[o + 3] = W * L;
  }
  const k = m ? 0 : w;
  if (k > 0) for (let j = 0; j < 3; j++) a.p[j] += (b.p[j] - a.p[j]) * k;
}
function contactAt(c, u, s) { const arr = c.contact[s], n = arr.length; return arr[Math.floor(u * n) % n]; }

/* a word's mouth shapes, a rough guess from its spelling: [viseme, amount, jaw] per sound */
const VIS = { a: ["visAA", 0.8, 0.3], o: ["visOW", 0.75, 0.2], u: ["visOW", 0.6, 0.1], w: ["visOW", 0.5, 0.05], e: ["visEE", 0.6, 0.15], i: ["visEE", 0.65, 0.1], y: ["visEE", 0.5, 0.08],
  b: ["visPBM", 0.9, 0], p: ["visPBM", 0.9, 0], m: ["visPBM", 0.9, 0], f: ["visFV", 0.75, 0.03], v: ["visFV", 0.7, 0.03],
  t: ["visEE", 0.25, 0.1], d: ["visEE", 0.25, 0.1], n: ["visEE", 0.2, 0.1], s: ["visEE", 0.35, 0.04], z: ["visEE", 0.35, 0.04], c: ["visEE", 0.3, 0.08], k: ["visAA", 0.2, 0.12], g: ["visAA", 0.2, 0.12],
  l: ["visAA", 0.3, 0.14], r: ["visOW", 0.3, 0.08], h: ["visAA", 0.3, 0.15], j: ["visOW", 0.35, 0.06], q: ["visOW", 0.5, 0.06], x: ["visEE", 0.3, 0.06] };
const _vcache = new Map();
function visemes(word) {
  let s = _vcache.get(word); if (s) return s;
  const w = String(word).toLowerCase().replace(/[^a-z0-9]/g, "")
    .replace(/th/g, "t").replace(/sh|ch/g, "j").replace(/ph/g, "f").replace(/ee|ea|ie/g, "i").replace(/oo|ou|ow/g, "o").replace(/([a-z])\1/g, "$1");
  s = [];
  for (const ch of w) { if (/[0-9]/.test(ch)) { s.push(VIS.a, VIS.t); continue; } const v = VIS[ch]; if (v) s.push(v); }
  if (!s.length) s = [VIS.a];
  // a word ends with the lips closing towards rest
  s.push([null, 0, 0.04]);
  _vcache.set(word, s); return s;
}
