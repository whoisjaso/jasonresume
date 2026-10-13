/* After Hours: the lost temp tags. Paper temporary plates, the kind a dealer hands out with a car, dropped around
   the world: five on the night lot and the street, four in the office, three in the library memory. Each set draws
   its tags as one instanced mesh with one shared material (the paper from tex.js, TEMP and blank lines, no numbers),
   a second instanced pass for the glint that sweeps across a tag once you're within a few metres, and one flyer
   that lifts and fades the tag you just took. Three draw calls at most in any view, nothing allocated per frame.

   Each tag is a world spot of kind "pickup" (story/main.js lists it with the world's own things): { tag: true,
   label, p, stand, r, when? }. A tag behind something you open (the laundromat's door) has a when() that says
   whether you can reach it now.

   addTags(set, scene, label)   build a set's tags (the lot's tag on a wiper waits for the cars to land)
   syncTags(set, found)         hide what's been found, show the rest (an array of ids)
   takeTag(set, id, still)      the lift and fade; the tag's slot goes empty
   tickTags(set, me, t, dt)     the glint's reach and the flyer
   TAG_IDS, tagGen              every tag, and a counter that moves whenever the list of tags you can reach does */
import * as THREE from "../vendor/three-0.184.0/three.module.min.js";
import { pbr, glow } from "./paint.js";
import * as TX from "./tex.js";
import { lotReady, _debug as WD } from "./world.js";

const W = 0.26, H = 0.13, NEAR = 4.5;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const UPV = V3(0, 1, 0), ZV = V3(0, 0, 1);
/* where they lie: p, the face's normal n, a turn in its own plane, where you stand to take it.
   (The wiper's is worked out from the car it's on; see wiperTag below) */
const PLACES = {
  lot: [
    { id: "tag-wiper", wiper: true },
    // tucked behind the dumpster, on the wet ground by its back corner
    { id: "tag-dumpster", p: [-15.05, 0.012, -21.25], n: [0, 1, 0], spin: 0.7, stand: [-15.45, -20.15] },
    // under the end of the bus stop's bench
    { id: "tag-bus", p: [-18.75, 0.012, 40.0], n: [0, 1, 0], spin: -0.4, stand: [-18.75, 39.05] },
    // on the gravel by the taco truck's trash barrel
    { id: "tag-taco", p: [-36.35, 0.012, 46.35], n: [0, 1, 0], spin: 2.4, stand: [-36.0, 45.35] },
    // on the laundromat's floor, just inside its glass door: open the door and reach in
    { id: "tag-laundry", p: [-5.75, 0.02, 41.72], n: [0, 1, 0], spin: 0.25, stand: [-5.75, 40.35], when: "laundry-door" }
  ],
  office: [
    // leaning on the wall behind the coffee machine, its edge showing past the machine
    { id: "tag-coffee", p: [-6.76, 0.99, 2.33], n: [1, 0.22, 0], spin: 0.06, stand: [-5.55, 2.2] },
    // on the floor under the front edge of the desk, at the end away from the chair
    { id: "tag-desk", p: [-2.0, 0.016, -1.32], n: [0, 1, 0], spin: -0.5, stand: [-2.05, -0.25] },
    // on top of the filing cabinet, beside the tray
    { id: "tag-cabinet", p: [-6.43, 1.364, -2.36], n: [0, 1, 0], spin: 1.75, stand: [-5.5, -2.15] },
    // on the floor between the arcade cabinet and the wall
    { id: "tag-arcade", p: [6.25, 0.012, -3.85], n: [0, 1, 0], spin: 1.2, stand: [6.3, -2.9] }
  ],
  memory: [
    // on the far reading table, among the open books
    { id: "tag-table", p: [7.35, 0.818, -2.62], n: [0, 1, 0], spin: 0.35, stand: [7.35, -1.45] },
    // on the floor at the foot of the stacks
    { id: "tag-stacks", p: [-10.35, 0.012, -1.4], n: [0, 1, 0], spin: -1.2, stand: [-9.4, -1.4] },
    // on a window sill along the back wall, against the glass
    { id: "tag-sill", p: [4.35, 1.615, -8.88], n: [0, 1, 0], spin: 0.08, stand: [4.35, -7.85] }
  ]
};
export const TAG_IDS = Object.values(PLACES).flatMap(l => l.map(t => t.id));
export const tagGen = { n: 0 };

let geo = null, mat = null, glintMat = null, flyMat = null;
function shared() {
  if (geo) return;
  geo = new THREE.PlaneGeometry(W, H);
  const map = TX.tempTagTex();
  // the paper, lit like everything else, with a little light of its own so it reads in a dark corner
  mat = pbr({ map, color: "#ffffff", rough: 0.85, wet: 0.15, ao: 0, emit: "#1e1c17", side: THREE.DoubleSide });
  flyMat = glow("#f1ead8", { map, k: 0.85, alpha: 1, transparent: true, side: THREE.DoubleSide });
  // the glint: a soft band that sweeps across the paper, only within a few metres of you, each tag on its own beat
  glintMat = new THREE.ShaderMaterial({
    uniforms: { uMe: { value: new THREE.Vector3(0, -100, 0) }, uTime: { value: 0 }, uNear: { value: NEAR } },
    vertexShader: `uniform vec3 uMe; uniform float uNear; varying vec2 vUv; varying float vK; varying float vPh;
      void main(){ vUv = uv; mat4 M = modelMatrix * instanceMatrix; vec3 c = (M * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vK = smoothstep(uNear, uNear * 0.3, distance(c.xz, uMe.xz)); vPh = fract(sin(dot(c.xz, vec2(12.9898, 78.233))) * 43758.5453);
        gl_Position = projectionMatrix * viewMatrix * (M * vec4(position, 1.0)); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying float vK; varying float vPh;
      void main(){ float t = fract(uTime * 0.38 + vPh), x = (vUv.x + vUv.y * 0.6) / 1.6;
        float band = smoothstep(0.08, 0.0, abs(x - (t * 2.2 - 0.6)));
        float rim = smoothstep(0.42, 0.5, max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)));
        gl_FragColor = vec4(vec3(1.0, 0.92, 0.76) * vK * (band * 0.85 + rim * 0.12 + 0.04), 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
}

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), P0 = new THREE.Vector3(), N0 = new THREE.Vector3(), S1 = V3(1, 1, 1), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function compose(t) {
  N0.set(t.n[0], t.n[1], t.n[2]).normalize();
  Q.setFromUnitVectors(ZV, N0); Q2.setFromAxisAngle(ZV, t.spin || 0); Q.multiply(Q2);
  // a hair off the surface along its face, so it never fights what it lies on
  P0.set(t.p[0], t.p[1], t.p[2]).addScaledVector(N0, 0.003);
  return M4.compose(P0, Q, S1);
}
function free(set, x, z, r = 0.32) { for (const w of set.userData.walls || []) if (x > w.x0 - r && x < w.x1 + r && z > w.z0 - r && z < w.z1 + r) return false; return true; }

export function addTags(set, scene, label) {
  const list = PLACES[scene]; if (!list || set.userData.tags) return;
  shared();
  const im = new THREE.InstancedMesh(geo, mat, list.length), gl = new THREE.InstancedMesh(geo, glintMat, list.length);
  gl.instanceMatrix = im.instanceMatrix; // one set of slots: a tag taken is gone from both
  im.userData.keep = gl.userData.keep = true; gl.renderOrder = 3; gl.visible = false;
  const fly = new THREE.Mesh(geo, flyMat); fly.visible = false; fly.userData.keep = true; fly.renderOrder = 4; fly.frustumCulled = false;
  set.add(im, gl, fly);
  const T = { im, gl, fly, list: [], byId: {}, flyT: -1, flyFrom: new THREE.Matrix4(), flyN: new THREE.Vector3(), found: null };
  set.userData.tags = T;
  const put = (t, i) => {
    const e = { id: t.id, i, p: V3(t.p[0], t.p[1], t.p[2]), m: compose(t).clone(), n: N0.clone(), x: t.p[0], z: t.p[2] };
    T.list.push(e); T.byId[t.id] = e;
    im.setMatrixAt(i, e.m); im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); gl.boundingSphere = im.boundingSphere;
    const sp = { kind: "pickup", tag: true, label, p: e.p, stand: V3(t.stand[0], 0, t.stand[1]), r: 1.5 };
    if (t.when) sp.when = () => { const g = set.userData.spots[t.when]; return !!(g && g.on); };
    set.userData.spots[t.id] = sp;
    tagGen.n++;
  };
  list.forEach((t, i) => { if (!t.wiper) put(t, i); else im.setMatrixAt(i, ZERO); });
  const w = list.findIndex(t => t.wiper);
  if (w >= 0) lotReady.then(() => { const t = wiperTag(set, list[w].id); if (t) { put(t, w); if (T.found) syncTags(set, T.found); } });
}
/* the tag under a wiper: a parked car with a free side to stand on, the paper on the windshield's foot, lying on the glass */
function wiperTag(set, id) {
  const lib = WD.carLib, cars = set.userData.parked || [];
  let best = null, bd = 1e9;
  for (const c of cars) {
    const meta = (lib[c.kind] || {}).meta; if (!meta) continue;
    for (const side of [-1, 1]) {
      const zl = meta.L / 2 - meta.cab[0] - 0.05, xl = side * (meta.W / 2 + 0.62), cs = Math.cos(c.yaw), sn = Math.sin(c.yaw);
      const sx = c.x + xl * cs + zl * sn, sz = c.z - xl * sn + zl * cs;
      if (!free(set, sx, sz)) continue;
      // near the gate and the lot's middle, where a careful eye passes
      const d = Math.hypot(sx + 3.5, sz - 12.5);
      if (d < bd) { bd = d; best = { c, meta, side, sx, sz }; }
    }
  }
  if (!best) return null;
  const { c, meta, side, sx, sz } = best;
  const belt = (meta.belt || [0.9, 0.95])[1], top = meta.H || 1.45, [c0, c1] = meta.cab, sl = Math.atan2(c1 - c0, top - belt);
  // up the glass a little from its foot, toward the side you stand on, a hair proud of it
  const along = 0.16, lx = side * 0.36, ly = belt + Math.cos(sl) * along + Math.sin(sl) * 0.02, lz = meta.L / 2 - c0 - Math.sin(sl) * along + Math.cos(sl) * 0.02;
  const cs = Math.cos(c.yaw), sn = Math.sin(c.yaw);
  const nl = V3(0, Math.sin(sl), Math.cos(sl)).applyAxisAngle(UPV, c.yaw);
  return { id, p: [c.x + lx * cs + lz * sn, ly, c.z - lx * sn + lz * cs], n: [nl.x, nl.y, nl.z], spin: side * 0.12, stand: [sx, sz] };
}
export function syncTags(set, found) {
  const T = set && set.userData.tags; if (!T) return;
  T.found = found;
  for (const e of T.list) T.im.setMatrixAt(e.i, found.includes(e.id) ? ZERO : e.m);
  T.im.instanceMatrix.needsUpdate = true;
}
export function takeTag(set, id, still) {
  const T = set && set.userData.tags, e = T && T.byId[id]; if (!e) return false;
  T.im.setMatrixAt(e.i, ZERO); T.im.instanceMatrix.needsUpdate = true;
  T.flyFrom.copy(e.m); T.flyN.copy(e.n); T.flyT = 0; T.still = !!still;
  T.fly.matrixAutoUpdate = false; T.fly.matrix.copy(e.m); T.fly.matrixWorldNeedsUpdate = true; T.fly.visible = true; flyMat.uniforms.uA.value = 1;
  tagGen.n++;
  return true;
}
const FLY = 0.85, LIFT = new THREE.Vector3(), FQ = new THREE.Quaternion(), FP = new THREE.Vector3(), FS = new THREE.Vector3();
export function tickTags(set, me, t, dt) {
  const T = set && set.userData.tags; if (!T) return;
  // the glint pass is drawn only while a tag still lying there is within reach of the eye
  let near = false;
  if (me) for (const e of T.list) if ((!T.found || !T.found.includes(e.id)) && Math.abs(e.x - me.x) < NEAR && Math.abs(e.z - me.z) < NEAR) { near = true; break; }
  T.gl.visible = near;
  if (near) { glintMat.uniforms.uMe.value.copy(me); glintMat.uniforms.uTime.value = t; }
  // the one you took: up off where it lay, a quarter turn, and gone
  if (T.flyT >= 0) {
    T.flyT += dt; const u = Math.min(1, T.flyT / (T.still ? 0.4 : FLY)), e = 1 - Math.pow(1 - u, 3);
    T.flyFrom.decompose(FP, FQ, FS);
    if (!T.still) { LIFT.copy(T.flyN).multiplyScalar(0.08 * e); FP.add(LIFT); FP.y += 0.32 * e; FQ.multiply(Q2.setFromAxisAngle(ZV, 0.9 * e)); FS.setScalar(1 - 0.2 * e); }
    T.fly.matrix.compose(FP, FQ, FS); T.fly.matrixWorldNeedsUpdate = true;
    flyMat.uniforms.uA.value = 1 - u * u;
    if (u >= 1) { T.flyT = -1; T.fly.visible = false; }
  }
}
