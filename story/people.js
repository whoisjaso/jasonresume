/* After Hours: the people. Loads the cast built by tools/story/cast.mjs
   (meshopt-compressed, skinned to a twenty-bone skeleton), gives each one a
   face (eyes that look and blink, lids, brows, a mouth that talks) and the
   props they carry (Jason's browline glasses, Dell's umbrella), and animates
   them in code: breathing idle, walk, turning in place, talking hands, nods,
   sitting. Nothing is keyframed by hand; every pose is a small function. */
import * as THREE from "../vendor/three-0.184.0/three.module.min.js";
import { MeshoptDecoder } from "../vendor/meshopt-0.22.0/meshopt_decoder.module.js";
import { paint } from "./paint.js";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }

export async function loadCast(base) {
  const [man, bin] = await Promise.all([fetch(base + ".json").then(r => r.json()), fetch(base + ".bin").then(r => r.arrayBuffer())]);
  await MeshoptDecoder.ready;
  const geos = {};
  function geo(ref) {
    const key = ref.v[0];
    if (geos[key]) return geos[key];
    const vb = new Uint8Array(ref.nV * 16), ib = new Uint32Array(ref.nI);
    MeshoptDecoder.decodeVertexBuffer(vb, ref.nV, 16, new Uint8Array(bin, ref.v[0], ref.v[1]));
    MeshoptDecoder.decodeIndexBuffer(new Uint8Array(ib.buffer), ref.nI, 4, new Uint8Array(bin, ref.i[0], ref.i[1]));
    const dv = new DataView(vb.buffer), n = ref.nV;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), ci = new Float32Array(n), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const o = i * 16;
      for (let a = 0; a < 3; a++) { pos[i * 3 + a] = dv.getInt16(o + a * 2, true) / 8000; nor[i * 3 + a] = dv.getInt8(o + 8 + a) / 127; }
      ci[i] = dv.getUint8(o + 11);
      si[i * 4] = dv.getUint8(o + 12); si[i * 4 + 1] = dv.getUint8(o + 13);
      const w = dv.getUint8(o + 14) / 255; sw[i * 4] = w; sw[i * 4 + 1] = 1 - w;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.setAttribute("cidx", new THREE.BufferAttribute(ci, 1));
    g.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
    g.setIndex(new THREE.BufferAttribute(n > 65535 ? ib : Uint16Array.from(ib), 1));
    g.computeBoundingSphere(); g.boundingSphere.radius += 0.6;
    return (geos[key] = g);
  }
  return { man, make: (name, o) => new Person(man, man.chars[name], name, geo, o || {}) };
}

/* eyeball: vertex-coloured sphere, iris and pupil painted by angle from forward (+Z) */
function eyeGeo(r, iris) {
  const g = new THREE.SphereGeometry(r, 20, 14);
  g.rotateX(Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  const sclera = new THREE.Color("#d9d3c6"), ir = new THREE.Color(iris), pu = new THREE.Color("#060404"), ring = new THREE.Color(iris).multiplyScalar(0.45);
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i) / r, a = Math.acos(clamp(z, -1, 1));
    if (a < 0.24) c.copy(pu); else if (a < 0.5) c.copy(ir).lerp(ring, (a - 0.24) / 0.26 * 0.6); else if (a < 0.56) c.copy(ring); else c.copy(sclera);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

class Person {
  constructor(man, C, name, geo, o) {
    this.name = name; this.C = C;
    this.group = new THREE.Group(); this.group.name = name;
    // skeleton
    this.bones = man.bones.map(n => { const b = new THREE.Bone(); b.name = n; b.rotation.order = "ZXY"; return b; });
    man.parent.forEach((p, i) => {
      const j = C.joints[i];
      if (p < 0) { this.bones[i].position.set(j[0], j[1], j[2]); this.group.add(this.bones[i]); }
      else { const q = C.joints[p]; this.bones[i].position.set(j[0] - q[0], j[1] - q[1], j[2] - q[2]); this.bones[p].add(this.bones[i]); }
    });
    this.B = Object.fromEntries(man.bones.map((n, i) => [n, this.bones[i]]));
    this.rest = this.bones.map(b => b.position.clone());
    this.skeleton = new THREE.Skeleton(this.bones);
    this.pal = C.palette.slice();
    this.mat = paint({ pal: this.pal, rim: 0.85, wet: 0.08 });
    this.meshes = [];
    for (const k of ["body", "head"]) {
      const m = new THREE.SkinnedMesh(geo(C.meshes[k]), this.mat);
      m.frustumCulled = false; m.layers.enable(1);
      this.group.add(m); this.meshes.push(m);
    }
    this.group.updateMatrixWorld(true);
    this.meshes.forEach(m => m.bind(this.skeleton, new THREE.Matrix4()));
    this.buildFace(C, o);
    // state
    this.pos = new THREE.Vector3(); this.yaw = 0; this.wantYaw = 0; this.speed = 0; this.phase = 0; this.t = Math.random() * 10;
    this.lookAtP = null; this.lookYaw = 0; this.lookPitch = 0; this.talk = 0; this.mouth = 0; this.blinkT = 2 + Math.random() * 3; this.blink = 0;
    this.gest = 0; this.gestT = 0; this.gestSide = 1; this.nod = 0; this.brow = 0; this.browK = 0; this.pose = "stand"; this.sitK = 0; this.hold = o.hold || null; this.turnStep = 0;
    this.still = false;
  }

  skinIdx() { return this.C.keys.indexOf("skin"); }
  buildFace(C, o) {
    const head = this.B.head, hj = C.joints[5], e = C.eye;
    const skin = this.pal[this.skinIdx()], hair = this.pal[C.keys.indexOf("hair")] || "#111";
    const face = new THREE.Group(); face.position.set(0, 0, 0); head.add(face); this.face = face;
    const at = (x, y, z) => new THREE.Vector3(x - hj[0], y - hj[1], z - hj[2]);
    this.eyes = [];
    const eMat = paint({ vcol: true, color: "#fff", wet: 1.6, rim: 0.2 });
    const lidMat = paint({ color: skin, rim: 0.5, wet: 0.1, side: THREE.DoubleSide });
    for (const side of [1, -1]) {
      const pivot = new THREE.Group(); pivot.position.copy(at(e.x * side, e.y, e.z)); face.add(pivot);
      const ball = new THREE.Mesh(eyeGeo(e.r, o.iris || "#3a2414"), eMat); pivot.add(ball);
      // the upper lid: a shell over the top of the eye that rotates down to blink
      const lid = new THREE.Mesh(new THREE.SphereGeometry(e.r * 1.12, 18, 8, 0, TAU, 0, Math.PI * 0.5), lidMat);
      const lidP = new THREE.Group(); lidP.position.copy(pivot.position); face.add(lidP); lidP.add(lid);
      lid.rotation.x = -1.25;
      const low = new THREE.Mesh(new THREE.SphereGeometry(e.r * 1.1, 18, 6, 0, TAU, Math.PI * 0.68, Math.PI * 0.32), lidMat);
      low.position.copy(pivot.position); face.add(low);
      this.eyes.push({ pivot, ball, lid, side });
    }
    // brows
    const bMat = paint({ color: C.keys.includes("beard") ? this.pal[C.keys.indexOf("beard")] : hair, rim: 0.3 });
    this.brows = [];
    for (const side of [1, -1]) {
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(e.r * 0.2, e.r * 1.25, 3, 6), bMat);
      b.rotation.z = Math.PI / 2 + side * 0.08;
      const p = new THREE.Group(); p.position.copy(at(e.x * side * 1.02, e.y + e.r * 1.55, e.z + e.r * 0.62)); p.add(b); face.add(p);
      this.brows.push({ p, b, side, y0: p.position.y });
    }
    // mouth: a dark interior that opens, a hint of teeth
    const mouthP = new THREE.Group(); mouthP.position.copy(at(0, e.y - 0.069 * C.h / 1.8, e.z + 0.0105)); face.add(mouthP);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.0125 * C.h / 1.8, 14, 8), paint({ color: "#2a1210", rim: 0, wet: 0.4 }));
    inner.scale.set(1.5, 0.12, 0.45); mouthP.add(inner);
    const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.004, 0.004), paint({ color: "#d8d0c2", rim: 0 }));
    teeth.position.set(0, 0.0035, 0.003); mouthP.add(teeth);
    this.mouthM = { p: mouthP, inner, teeth };
    // glasses: browline (a heavy black brow bar, thin gold lower rims, gold bridge, black arms)
    if (C.glasses === "browline") {
      const black = paint({ color: "#0b0b0b", wet: 1.4, rim: 0.4 }), gold = paint({ color: "#c9a96a", wet: 2.2, rim: 0.4, emit: "#1a1206" });
      const lens = new THREE.MeshBasicMaterial({ color: "#9fb3c2", transparent: true, opacity: 0.1, depthWrite: false });
      const g = new THREE.Group(); face.add(g); this.glasses = g;
      const fz = e.z + e.r * 1.35, R = e.r * 1.55;
      for (const side of [1, -1]) {
        const cx = e.x * side, cy = e.y - e.r * 0.15;
        const top = new THREE.CatmullRomCurve3([at(cx - side * -R * 1.02, cy + R * 0.42, fz - 0.003), at(cx, cy + R * 0.62, fz), at(cx + side * R * 1.05, cy + R * 0.45, fz - 0.004)]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(top, 10, 0.0026, 5), black));
        const pts = []; for (let i = 0; i <= 12; i++) { const a = Math.PI * (i / 12); pts.push(at(cx + Math.cos(a) * R * 1.0, cy - Math.sin(a) * R * 0.78 + R * 0.38, fz - Math.sin(a) * 0.002)); }
        g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.0009, 4), gold));
        const lm = new THREE.Mesh(new THREE.CircleGeometry(R * 0.98, 16), lens); lm.position.copy(at(cx, cy + R * 0.02, fz - 0.001)); lm.scale.y = 0.82; g.add(lm);
        const arm = new THREE.CatmullRomCurve3([at(cx + side * R * 1.05, cy + R * 0.42, fz - 0.004), at(side * 0.074 * C.h / 1.8, cy + R * 0.35, e.z - 0.05), at(side * 0.076 * C.h / 1.8, cy + R * 0.1, -0.02)]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(arm, 8, 0.0016, 4), black));
      }
      const bridge = new THREE.CatmullRomCurve3([at(e.x - R * 1.0, e.y + R * 0.2, fz), at(0, e.y + R * 0.32, fz + 0.002), at(-e.x + R * 1.0, e.y + R * 0.2, fz)]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(bridge, 6, 0.0011, 4), gold));
    }
    if (C.studs) {
      const st = paint({ color: "#e8eef2", wet: 3, emit: "#30343a" });
      for (const side of [1, -1]) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 8, 6), st); s.position.copy(at(side * 0.081 * C.h / 1.8, 1.668 * C.h / 1.8, 0.004)); face.add(s); }
    }
    if (C.umbrella) {
      const u = new THREE.Group();
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.26, 8, 1, true), paint({ color: "#141615", wet: 1.8, rim: 0.7, side: THREE.DoubleSide }));
      canopy.position.y = 0.86; u.add(canopy);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.95, 6), paint({ color: "#2a2a28", wet: 1 }));
      shaft.position.y = 0.4; u.add(shaft);
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 5, 10, Math.PI), paint({ color: "#3a2a1c" })); hook.position.y = -0.06; hook.rotation.z = Math.PI; u.add(hook);
      this.B.handR.add(u); u.position.set(0, -0.06, 0.02); this.umbrella = u; this.hold = "umbrella";
    }
  }

  /* where a thing is in the world */
  headWorld(v = new THREE.Vector3()) { return this.B.head.getWorldPosition(v).add(new THREE.Vector3(0, 0.1 * this.C.h / 1.8, 0)); }
  eyeLevel() { return this.C.h * 0.94; }

  update(dt, cam) {
    const t = (this.t += dt), B = this.B, s = this.C.h / 1.8;
    this.group.position.copy(this.pos);
    // turn toward the wanted heading; a few shuffled steps when turning in place
    const dy = angDiff(this.yaw, this.wantYaw);
    const turnRate = this.speed > 0.2 ? 6 : 4;
    this.yaw += clamp(dy, -turnRate * dt, turnRate * dt);
    if (Math.abs(dy) > 0.35 && this.speed < 0.2 && this.pose === "stand") this.turnStep = Math.min(1, this.turnStep + dt * 4); else this.turnStep = Math.max(0, this.turnStep - dt * 3);
    this.group.rotation.y = this.yaw;
    // walk cycle: phase follows distance
    const sp = this.speed, walkK = clamp(sp / 1.3, 0, 1.6), step = Math.max(walkK, this.turnStep * 0.45);
    this.phase += (sp * dt) / (0.62 * s) * Math.PI + this.turnStep * dt * 7;
    const ph = this.phase;
    const sitK = (this.sitK = damp(this.sitK, this.pose === "sit" ? 1 : 0, 6, dt));
    const A = 0.44 * step, sn = Math.sin(ph), cs = Math.cos(ph);
    const breathe = Math.sin(t * 1.55) * (this.still ? 0.6 : 1);
    // talking: mouth, gestures, nods
    this.mouth = damp(this.mouth, this.talk, 18, dt);
    this.gestT -= dt;
    if (this.talk > 0.05 && this.gestT <= 0 && this.hold !== "umbrella" ? true : false) { this.gestT = 1.6 + Math.random() * 2.4; this.gestSide = Math.random() < 0.5 ? 1 : -1; this.gestAmp = 0.5 + Math.random() * 0.5; }
    const gTarget = this.talk > 0.05 && this.gestT > 0.7 ? this.gestAmp || 0.6 : 0;
    this.gest = damp(this.gest, gTarget, 3, dt);
    this.nod = damp(this.nod, 0, 4, dt);
    this.browK = damp(this.browK, this.brow, 8, dt);

    // ---- body ----
    const bob = -0.022 * s * Math.abs(cs) * step;
    B.hips.position.y = this.rest[1].y + bob - sitK * 0.44 * s;
    B.hips.position.z = this.rest[1].z + sitK * 0.06 * s;
    B.hips.rotation.set(0, 0.07 * sn * step, 0.025 * Math.sin(t * 0.4) * (1 - step));
    B.spine.rotation.set(0.04 * step + breathe * 0.008 - sitK * 0.04, -0.05 * sn * step, 0);
    B.chest.rotation.set(-breathe * 0.012 + 0.03 * step, -0.06 * sn * step + this.gest * 0.06 * this.gestSide, 0);
    // legs
    for (const side of [1, -1]) {
      const sx = side > 0 ? "L" : "R", f = side > 0 ? 1 : -1;
      const sw = -A * sn * f;
      const swing = Math.max(0, cs * f);
      const knee = 0.06 + step * (0.12 + 0.62 * Math.pow(swing, 1.4));
      B["thigh" + sx].rotation.set(lerp(sw, -1.52, sitK), 0, side * 0.02);
      B["shin" + sx].rotation.set(lerp(knee, 1.5, sitK), 0, 0);
      B["foot" + sx].rotation.set(lerp(-sw * 0.25 - knee * 0.3 + 0.1 * step * Math.max(0, -cs * f), 0.05, sitK), 0, 0);
    }
    // arms: hang inward from the A pose, swing against the legs, gesture when talking
    for (const side of [1, -1]) {
      const sx = side > 0 ? "L" : "R";
      const gsel = this.gestSide === side ? this.gest : this.gest * 0.25;
      let ax = 0.3 * sn * side * step - gsel * 0.55 - sitK * 0.55, az = -side * (0.13 - breathe * 0.01) + side * gsel * 0.18;
      let fx = -0.18 - 0.14 * step - gsel * 1.05 - sitK * 0.75, fy = side * gsel * 0.4;
      let hx = 0, hz = -side * gsel * 0.3;
      if (this.hold === "umbrella" && side < 0) { ax = -0.55; az = side * 0.1; fx = -1.45; fy = 0.15; hz = 0; }
      if (this.hold === "phone" && side > 0) { ax = -0.35; az = 0.2; fx = -2.35; fy = -0.5; hx = 0.2; }
      if (this.hold === "pockets") { ax = 0.05; az = -side * 0.02; fx = -0.35; fy = 0; }
      B["arm" + sx].rotation.set(ax, 0, az);
      B["fore" + sx].rotation.set(fx, fy, 0);
      B["hand" + sx].rotation.set(hx, 0, hz);
      B["clavi" + sx].rotation.set(0, 0, side * breathe * 0.006);
    }
    if (this.umbrella) this.umbrella.rotation.set(0.15, 0, -0.05);
    // ---- head: look at a point, neck takes some of it ----
    let wantY = 0, wantP = 0;
    if (this.lookAtP) {
      const hp = this.headWorld(new THREE.Vector3());
      const d = this.lookAtP.clone().sub(hp);
      const local = Math.atan2(d.x, d.z) - this.yaw;
      wantY = clamp(angDiff(0, local), -1.15, 1.15);
      wantP = clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.45, 0.5);
      if (Math.abs(angDiff(0, local)) > 2.2) wantY = 0;
    }
    this.lookYaw = damp(this.lookYaw, wantY, 5, dt); this.lookPitch = damp(this.lookPitch, wantP, 5, dt);
    const idleLook = Math.sin(t * 0.37) * 0.06 + Math.sin(t * 0.91) * 0.03;
    B.neck.rotation.set(this.lookPitch * 0.35 + breathe * 0.01, this.lookYaw * 0.4 + idleLook * 0.5, 0);
    B.head.rotation.set(this.lookPitch * 0.55 + this.nod * 0.18 + Math.sin(t * 5.3) * 0.012 * this.mouth, this.lookYaw * 0.6 + idleLook * 0.5, Math.sin(t * 0.53) * 0.02 + this.gest * 0.03 * this.gestSide);
    // ---- face ----
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 1; this.blinkT = 2.2 + Math.random() * 3.8; if (Math.random() < 0.15) this.blinkT = 0.25; }
    this.blink = Math.max(0, this.blink - dt * 7.5);
    const close = Math.sin(Math.min(1, this.blink) * Math.PI);
    for (const e of this.eyes) {
      e.lid.rotation.x = lerp(-1.25 + this.lookPitch * 0.25, 0.05, close);
      e.ball.rotation.set(this.lookPitch * 0.25 + Math.sin(t * 0.7 + e.side) * 0.02, (wantY - this.lookYaw) * 0.6 + Math.sin(t * 0.43) * 0.05, 0);
    }
    for (const b of this.brows) { b.p.position.y = b.y0 + this.browK * 0.004 + this.mouth * 0.0012; b.b.rotation.z = Math.PI / 2 + b.side * (0.08 - this.browK * 0.12); }
    const m = this.mouth, chatter = m > 0.02 ? 0.55 + 0.45 * Math.abs(Math.sin(t * 15.5) * Math.sin(t * 7.1 + 1)) : 0;
    const open = m * chatter;
    this.mouthM.inner.scale.set(1.5 - open * 0.35, 0.12 + open * 0.95, 0.45);
    this.mouthM.teeth.visible = open > 0.25;
  }
}
