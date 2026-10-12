/* After Hours: the people. The cast is built in Blender from MakeHuman's CC0
   assets (tools/story/mh_cast.py), one GLB each, compressed with meshopt
   (tools/story/pack_cast.mjs): a body with real eye sockets, eyes, brows,
   lashes, teeth, clothes, hair, the game_engine rig, and the face as shape
   keys. Here each one is painted with the episode's paint (story/paint.js) in
   its own colours, and animated in code: breathing idle, walk, turning in place,
   talking hands, nods, blinks, visemes, sitting, holding an umbrella. Poses are
   written in the character's own axes (x to its left, y up, z ahead), applied on
   top of each bone's rest. */
import * as THREE from "../vendor/three-0.184.0/three.module.min.js";
import { GLTFLoader } from "../vendor/three-0.184.0/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "../vendor/meshopt-0.22.0/meshopt_decoder.module.js";
import { paint } from "./paint.js";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }

/* each character's colours. Cloth textures keep their folds and light, recoloured */
export const LOOKS = {
  jason: { skin: "#56331f", lip: "#7a4741", eyes: "#7a5a48", wide: 0.55, pocket: true, nose: true, hair: "#19130f", brow: "#0d0b0b", tie: "#1f4a38", cloth: { suit: "#2a4c3a", shoes: "#16110e" }, keep: "#ece9e1", glasses: "browline", studs: true, goatee: true },
  "jason-memory": { skin: "#56331f", lip: "#7a4741", eyes: "#7a5a48", wide: 0.55, nose: true, hair: "#19130f", brow: "#0d0b0b", cloth: { casual: "#4d5a6a", shoes: "#d9d3c7" }, keep: "#b9bfc6", glasses: "browline", goatee: true },
  player: { skin: "#8a5d40", lip: "#8a5048", eyes: "#6a4a36", hair: "#22170f", brow: "#22170f", cloth: { casual: "#8a6428", shoes: "#d6d0c4" }, keep: "#ddd6c8" },
  dell: { skin: "#6e4631", beard: "#9b958c", hair: "#4a4640", brow: "#7d776e", cloth: { work: "#2f3a4a", shoes: "#2a2019", hat: "#34342f" }, keep: "#cfc9bd", umbrella: true, stubble: true },
  renata: { skin: "#b78a66", hair: "#24170f", brow: "#24170f", cloth: { elegant: "#7a3b30", shoes: "#2a1f1a" }, keep: "#e3dccd" }
};

export async function loadCast(base) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const cache = {};
  return {
    async make(name, o) {
      const g = cache[name] || (cache[name] = await loader.loadAsync(base + name + ".glb"));
      return new Person(name, g.scene, o || {});
    }
  };
}

const AX = new THREE.Vector3(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, "ZXY");

class Person {
  constructor(name, scene, o) {
    this.name = name.replace(/-v\d+$/, ""); this.L = LOOKS[this.name] || LOOKS.player;
    this.group = new THREE.Group(); this.group.name = name;
    this.root = scene; this.group.add(scene);
    this.bones = {}; this.meshes = []; this.morph = null;
    scene.traverse(n => {
      if (n.isBone) this.bones[n.name] = n;
      if (n.isMesh) { n.frustumCulled = false; n.layers.enable(1); this.meshes.push(n); }
    });
    this.paint();
    // rest: each bone's local rotation, and its orientation in character space
    scene.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(scene.matrixWorld).invert();
    this.rest = {};
    for (const [k, b] of Object.entries(this.bones)) {
      const m = new THREE.Matrix4().multiplyMatrices(inv, b.matrixWorld);
      const w = new THREE.Quaternion(); m.decompose(new THREE.Vector3(), w, new THREE.Vector3());
      this.rest[k] = { q: b.quaternion.clone(), w, wi: w.clone().invert(), p: b.position.clone(), at: new THREE.Vector3().setFromMatrixPosition(m) };
    }
    // the arms hang from the rest pose: the turn that brings each upper arm to hanging
    this.hang = {};
    for (const s of ["l", "r"]) {
      const a = this.rest["upperarm_" + s], f = this.rest["lowerarm_" + s];
      if (!a || !f) continue;
      const d0 = f.at.clone().sub(a.at).normalize();
      const d1 = new THREE.Vector3(s === "l" ? 0.12 : -0.12, -1, 0.02).normalize();
      this.hang[s] = new THREE.Quaternion().setFromUnitVectors(d0, d1);
      // the forearm, likewise, continues straight from the hung upper arm
      const h = this.rest["hand_" + s];
      // hang_f acts before hang in the chain, so it must aim the forearm at hang^-1 * d1
      if (h) { const e0 = h.at.clone().sub(f.at).normalize(); const want = d1.clone().applyQuaternion(this.hang[s].clone().invert()); this.hang["f" + s] = new THREE.Quaternion().setFromUnitVectors(e0, want); }
    }
    this.height = (this.rest.head ? this.rest.head.at.y : 1.6) + 0.18;
    this.props(o);
    // state
    this.pos = new THREE.Vector3(); this.yaw = 0; this.wantYaw = 0; this.speed = 0; this.phase = 0; this.t = Math.random() * 10;
    this.lookAtP = null; this.lookYaw = 0; this.lookPitch = 0; this.talk = 0; this.mouth = 0; this.blinkT = 2 + Math.random() * 3; this.blink = 0;
    this.gest = 0; this.gestT = 0; this.gestSide = 1; this.gestAmp = 0.6; this.nod = 0; this.brow = 0; this.browK = 0; this.smile = 0; this.smileK = 0;
    this.pose = "stand"; this.sitK = 0; this.hold = this.L.umbrella ? "umbrella" : null; this.turnStep = 0; this.vis = 0; this.visT = 0; this.visK = {};
  }

  paint() {
    const L = this.L;
    for (const m of this.meshes) {
      const name = (m.material && m.material.name) || "";
      const map = m.material && m.material.map;
      if (map) map.colorSpace = THREE.SRGBColorSpace;
      let mat;
      if (name === "skin") { if (map) map.colorSpace = THREE.NoColorSpace; mat = paint({ color: L.skin, skin: true, rim: 0.55, wet: 0.015, mask: map || null, beard: L.beard || L.hair, lip: L.lip || "#5e342b", curlK: 1400 * (m.scale.x || 1) }); this.morph = m; this.skinMat = mat; }
      else if (name === "hair" && !map) mat = paint({ color: L.hair, curl: true, curlK: 1100 * (m.scale.x || 1), rim: 0.15, wet: 0.0, hairline: !!m.geometry.attributes.color, keep: L.skin });
      else if (name === "hair") mat = paint({ color: L.hair, map, alphaTest: 0.5, rim: 0.25, wet: 0.1, side: THREE.DoubleSide, recolor: true, keep: L.hair });
      else if (name === "goatee") mat = paint({ color: L.hair, curl: true, curlK: 1400 * (m.scale.x || 1), rim: 0.4, wet: 0.2 });
      else if (name === "brow" || name === "lash") mat = paint({ color: L.brow, map, alphaTest: name === "brow" ? 0.28 : 0.5, rim: 0.2, side: THREE.DoubleSide, recolor: true, keep: L.brow, transparent: false });
      else if (name === "teeth") mat = paint({ color: "#d6cfc1", rim: 0 });
      else if (name === "eyes") mat = paint({ color: L.eyes || "#9a8a7a", map, wet: 2.6, rim: 0.15 });
      else if (name.startsWith("cloth")) {
        const key = Object.keys(L.cloth).find(k => name.includes(k)) || Object.keys(L.cloth)[0];
        mat = paint({ color: L.cloth[key], map, recolor: !!map, keep: key === "shoes" ? L.cloth.shoes : L.keep, tie: key === "suit" ? L.tie : null, rim: 0.4, wet: key === "shoes" ? 0.35 : 0.12 });
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
    // the face is about 0.1 above the head bone and 0.09 ahead of it; measured from the eye sockets
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
        // two small gold rivets on the bar, near the hinge
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
      // a catchlight in each eye: a tiny bright point up and to one side of the pupil, so the eyes read awake
      const cl = new THREE.MeshBasicMaterial({ color: "#f3e9d8", transparent: true, opacity: 0.55, depthWrite: false });
      for (const side of [1, -1]) { const d = new THREE.Mesh(new THREE.SphereGeometry(this.eyeR * 0.09, 6, 4), cl); d.position.copy(at(this.eyeX * side - this.eyeR * 0.22, this.eyeY + this.eyeR * 0.28, this.eyeZ + 0.0008)); head.add(d); }
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
      const u = new THREE.Group();
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.64, 0.24, 10, 1, true), paint({ color: "#151716", wet: 1.8, rim: 0.7, side: THREE.DoubleSide }));
      canopy.position.y = 0.92; u.add(canopy);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.0, 6), paint({ color: "#2a2a28", wet: 1 })); shaft.position.y = 0.42; u.add(shaft);
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 5, 10, Math.PI), paint({ color: "#3a2a1c" })); hook.position.y = -0.08; hook.rotation.z = Math.PI; u.add(hook);
      this.umbrella = u; this.add(u);
    }
  }
  add(o) { this.group.add(o); }

  /* set a bone from a rotation written in character axes, on top of its rest */
  rot(name, x, y, z, pre) {
    const b = this.bones[name], r = this.rest[name]; if (!b) return;
    E.set(x, y, z, "ZXY"); Q.setFromEuler(E);
    if (pre) Q.multiply(pre);
    // conjugate into the bone's rest frame: local = rest * (W^-1 * R * W)
    Q2.copy(r.wi).multiply(Q).multiply(r.w);
    b.quaternion.copy(r.q).multiply(Q2);
  }
  headWorld(v = new THREE.Vector3()) { const h = this.bones.head; if (h) { h.getWorldPosition(v); v.y += 0.08; } else v.copy(this.pos).setY(1.6); return v; }
  eyeLevel() { return this.height - 0.1; }
  setFx(k, v) { for (const m of this.morphs) { const i = m.morphTargetDictionary[k]; if (i != null) m.morphTargetInfluences[i] = v; } }

  update(dt) {
    const t = (this.t += dt);
    this.group.position.copy(this.pos);
    const dy = angDiff(this.yaw, this.wantYaw);
    const turnRate = this.speed > 0.2 ? 6 : 4;
    this.yaw += clamp(dy, -turnRate * dt, turnRate * dt);
    if (Math.abs(dy) > 0.35 && this.speed < 0.2 && this.pose === "stand") this.turnStep = Math.min(1, this.turnStep + dt * 4); else this.turnStep = Math.max(0, this.turnStep - dt * 3);
    this.group.rotation.y = this.yaw;
    const sp = this.speed, step = Math.max(clamp(sp / 1.3, 0, 1.6), this.turnStep * 0.45);
    this.phase += (sp * dt) / 0.62 * Math.PI + this.turnStep * dt * 7;
    const ph = this.phase, sn = Math.sin(ph), cs = Math.cos(ph), A = 0.42 * step;
    const sitK = (this.sitK = damp(this.sitK, this.pose === "sit" ? 1 : 0, 6, dt));
    const breathe = Math.sin(t * 1.55);
    this.mouth = damp(this.mouth, this.talk, 16, dt);
    this.gestT -= dt;
    if (this.talk > 0.05 && this.gestT <= 0) { this.gestT = 1.8 + Math.random() * 2.6; this.gestSide = this.hold === "umbrella" ? 1 : Math.random() < 0.5 ? 1 : -1; this.gestAmp = 0.45 + Math.random() * 0.55; }
    this.gest = damp(this.gest, this.talk > 0.05 && this.gestT > 0.8 ? this.gestAmp : 0, 3, dt);
    this.nod = damp(this.nod, 0, 4, dt);
    this.browK = damp(this.browK, this.brow, 8, dt);
    this.smileK = damp(this.smileK, this.smile, 3, dt);

    // hips and spine
    const hp = this.bones.pelvis, hr = this.rest.pelvis;
    if (hp) { hp.position.copy(hr.p); const drop = -0.02 * Math.abs(cs) * step - sitK * 0.45; hp.position.y += drop * (1 / (this.root.scale.y || 1)); }
    this.rot("pelvis", 0, 0.07 * sn * step, 0.02 * Math.sin(t * 0.4) * (1 - step));
    this.rot("spine_01", 0.03 * step + breathe * 0.006 - sitK * 0.05, -0.04 * sn * step, 0);
    this.rot("spine_02", -breathe * 0.008, -0.03 * sn * step, 0);
    this.rot("spine_03", -breathe * 0.01 + 0.02 * step, -0.04 * sn * step + this.gest * 0.05 * this.gestSide, 0);
    for (const side of [1, -1]) {
      const s = side > 0 ? "l" : "r", f = side;
      const sw = -A * sn * f, swing = Math.max(0, cs * f);
      // standing, the weight sits on one leg and the other knee eases, feet under the hips
      const rest = (1 - step) * (1 - sitK), easy = side < 0 ? 0.16 * rest : 0;
      const knee = 0.05 + easy + step * (0.1 + 0.62 * Math.pow(swing, 1.4));
      this.rot("thigh_" + s, lerp(sw - easy * 0.4, -1.5, sitK), 0, side * (0.015 - 0.075 * rest));
      this.rot("calf_" + s, lerp(knee, 1.48, sitK), 0, 0);
      this.rot("foot_" + s, lerp(-sw * 0.25 - knee * 0.3 + 0.1 * step * Math.max(0, -cs * f), 0.05, sitK), 0, 0);
    }
    for (const side of [1, -1]) {
      const s = side > 0 ? "l" : "r";
      const gsel = this.gestSide === side ? this.gest : this.gest * 0.2;
      // talking hands: the upper arm comes forward a little and the forearm lifts, palm in; no twist across the body
      let ax = 0.3 * sn * side * step - gsel * 0.32 - sitK * 0.6, ay = 0, az = side * gsel * 0.08 - side * breathe * 0.008;
      let fx = -0.14 - 0.12 * step - gsel * 0.85 - sitK * 0.8, fy = 0, hz = 0;
      if (this.hold === "umbrella" && side < 0) { ax = -0.42; az = -0.06; fx = -1.35; fy = -0.2; hz = 0; }
      if (this.hold === "phone" && side > 0) { ax = -0.3; az = 0.25; fx = -2.3; fy = -0.6; hz = 0.3; }
      this.rot("upperarm_" + s, ax, ay, az, this.hang[s]);
      this.rot("lowerarm_" + s, fx, fy, 0, this.hang["f" + s]);
      this.rot("hand_" + s, 0, 0, hz);
      // a relaxed hand: each finger a little curled
      for (const fg of ["index", "middle", "ring", "pinky"]) for (let k = 1; k <= 3; k++) { const b = this.bones[fg + "_0" + k + "_" + s]; if (b) { const r = this.rest[fg + "_0" + k + "_" + s]; b.quaternion.copy(r.q).multiply(Q.setFromAxisAngle(AX.set(1, 0, 0), 0.22 + k * 0.08 + gsel * -0.15)); } }
    }
    if (this.umbrella && this.bones.hand_r) {
      const hand = this.bones.hand_r; hand.updateWorldMatrix(true, false);
      const p = new THREE.Vector3().setFromMatrixPosition(hand.matrixWorld); this.group.worldToLocal(p);
      this.umbrella.position.copy(p).add(new THREE.Vector3(0, 0.02, 0.02)); this.umbrella.rotation.set(0.12, 0, -0.06);
    }
    // the head looks
    let wantY = 0, wantP = 0;
    if (this.lookAtP) {
      const hw = this.headWorld(new THREE.Vector3()), d = this.lookAtP.clone().sub(hw);
      const local = angDiff(0, Math.atan2(d.x, d.z) - this.yaw);
      wantY = Math.abs(local) > 2.3 ? 0 : clamp(local, -1.1, 1.1);
      wantP = clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.45, 0.5);
    }
    this.lookYaw = damp(this.lookYaw, wantY, 5, dt); this.lookPitch = damp(this.lookPitch, wantP, 5, dt);
    const idle = Math.sin(t * 0.37) * 0.05 + Math.sin(t * 0.91) * 0.025;
    this.rot("neck_01", this.lookPitch * 0.35 + breathe * 0.008, this.lookYaw * 0.4 + idle * 0.5, 0);
    this.rot("head", this.lookPitch * 0.55 + this.nod * 0.16 + Math.sin(t * 5.3) * 0.01 * this.mouth, this.lookYaw * 0.6 + idle * 0.5, Math.sin(t * 0.53) * 0.018 + this.gest * 0.025 * this.gestSide);
    // the face
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 1; this.blinkT = 2.2 + Math.random() * 3.8; if (Math.random() < 0.15) this.blinkT = 0.28; }
    this.blink = Math.max(0, this.blink - dt * 7);
    const close = Math.sin(Math.min(1, this.blink) * Math.PI);
    this.setFx("eyeBlinkLeft", close); this.setFx("eyeBlinkRight", close);
    // talking: a new mouth shape every syllable, eased
    this.visT -= dt;
    if (this.visT <= 0) { this.visT = 0.07 + Math.random() * 0.09; const keys = ["visAA", "visOW", "visEE", "visPBM", "visFV", "jawOpen"]; this.vis = keys[(Math.random() * keys.length) | 0]; }
    for (const k of ["visAA", "visOW", "visEE", "visPBM", "visFV", "jawOpen"]) {
      const want = this.mouth > 0.05 && this.vis === k ? (k === "jawOpen" ? 0.35 : 0.75) * this.mouth : 0;
      this.visK[k] = damp(this.visK[k] || 0, want, 22, dt); this.setFx(k, this.visK[k]);
    }
    this.setFx("browInnerUp", clamp(this.browK, 0, 1) * 0.8 + this.mouth * 0.08);
    this.setFx("browDownLeft", clamp(-this.browK, 0, 1) * 0.6); this.setFx("browDownRight", clamp(-this.browK, 0, 1) * 0.6);
    this.setFx("eyeWideLeft", this.L.wide != null ? this.L.wide : 0.4); this.setFx("eyeWideRight", this.L.wide != null ? this.L.wide : 0.4);
    this.setFx("mouthSmileLeft", this.smileK * 0.55); this.setFx("mouthSmileRight", this.smileK * 0.55);
  }
}
