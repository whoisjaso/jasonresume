/* After Hours: the lost license plates. Texas plates (the standard Lone Star design, letters only) come loose and
   end up anywhere: five on the night lot and the street, four in the office, three in the library memory. Each set
   draws its plates as one instanced mesh of the plate model with one shared material (story/plates.js: the face of
   each from its own cell of the atlas in tex.js), a second instanced pass for the glint that sweeps across a plate
   once you're within a few metres, and one flyer that lifts and fades the plate you just took. Three draw calls at
   most in any view, nothing allocated per frame. (The data keeps its first name: the ids, the save and story.json
   say "tags".)

   Each plate is a world spot of kind "pickup" (story/main.js lists it with the world's own things): { tag: true,
   label, p, stand, r, when? }. A plate behind something you open (the laundromat's door) has a when() that says
   whether you can reach it now.

   addLostPlates(set, scene, label)   build a set's plates (the lot's one on a windshield waits for the cars to land)
   syncLostPlates(set, found)         hide what's been found, show the rest (an array of ids)
   takeLostPlate(set, id, still)      the lift and fade; the plate's slot goes empty
   tickLostPlates(set, me, t, dt)     the glint's reach and the flyer
   LOST_IDS, lostGen                  every plate, and a counter that moves whenever the list you can reach does */
import * as THREE from "../vendor/three-0.184.0/three.module.min.js";
import { lotReady, _debug as WD } from "./world.js";
import { plateGeo, plateMesh, lostMat, flyMat as plateFlyMat, cellColor, CELL } from "./plates.js";

const NEAR = 4.5;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const UPV = V3(0, 1, 0), ZV = V3(0, 0, 1);
/* where they lie: p, the face's normal n, a turn in its own plane, where you stand to take it.
   (The windshield's is worked out from the car it's on; see wiperPlate below) */
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
    // stood on the counter and leaning on the wall behind the coffee machine, its end showing past the machine
    { id: "tag-coffee", p: [-6.76, 1.0, 2.45], n: [1, 0.22, 0], spin: 0.06, stand: [-5.55, 2.2] },
    // on the floor under the front edge of the desk, at the end away from the chair
    { id: "tag-desk", p: [-2.0, 0.016, -1.32], n: [0, 1, 0], spin: -0.5, stand: [-2.05, -0.25] },
    // on top of the filing cabinet, beside the tray, its length along the cabinet's
    { id: "tag-cabinet", p: [-6.38, 1.362, -2.6], n: [0, 1, 0], spin: 1.6, stand: [-5.5, -2.2] },
    // on the floor between the arcade cabinet and the wall
    { id: "tag-arcade", p: [6.25, 0.012, -3.85], n: [0, 1, 0], spin: 1.2, stand: [6.3, -2.9] }
  ],
  memory: [
    // on the far reading table, beside a stack of books
    { id: "tag-table", p: [7.08, 0.818, -2.62], n: [0, 1, 0], spin: 0.35, stand: [7.1, -1.45] },
    // on the floor at the foot of the stacks
    { id: "tag-stacks", p: [-10.35, 0.012, -1.4], n: [0, 1, 0], spin: -1.2, stand: [-9.4, -1.4] },
    // on a window sill along the back wall, against the glass
    { id: "tag-sill", p: [4.35, 1.615, -8.935], n: [0, 1, 0], spin: 0.02, stand: [4.35, -7.85] }
  ]
};
export const LOST_IDS = Object.values(PLACES).flatMap(l => l.map(t => t.id));
export const lostGen = { n: 0 };

let geo = null, mat = null, glintMat = null, flyMat = null;
function shared() {
  if (geo) return;
  const lo = WD.TIER.carLo;
  geo = plateGeo();
  // the plate, lit like everything else, with a little light of its own so it reads in a dark corner
  mat = lostMat(lo); flyMat = plateFlyMat(lo);
  // the glint: a soft band that sweeps across the plate's face, only within a few metres of you, each on its own beat
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
  // its back a hair off the surface, so it never fights what it lies on
  P0.set(t.p[0], t.p[1], t.p[2]).addScaledVector(N0, 0.0015);
  return M4.compose(P0, Q, S1);
}
function free(set, x, z, r = 0.32) { for (const w of set.userData.walls || []) if (x > w.x0 - r && x < w.x1 + r && z > w.z0 - r && z < w.z1 + r) return false; return true; }

export function addLostPlates(set, scene, label) {
  const list = PLACES[scene]; if (!list || set.userData.tags) return;
  shared();
  const lo = WD.TIER.carLo, cc = new THREE.Color();
  const im = plateMesh(mat, list.length), gl = plateMesh(glintMat, list.length);
  gl.instanceMatrix = im.instanceMatrix; // one set of slots: a plate taken is gone from both
  // each plate its own letters: the lost plates have the atlas's first cells, one each
  list.forEach((t, i) => im.setColorAt(i, cellColor(CELL.lost + LOST_IDS.indexOf(t.id), lo, cc)));
  gl.renderOrder = 3; gl.visible = false;
  const fly = plateMesh(flyMat, 1); fly.setMatrixAt(0, new THREE.Matrix4()); fly.setColorAt(0, cc);
  fly.visible = false; fly.renderOrder = 4; fly.frustumCulled = false;
  set.add(im, gl, fly);
  const T = { im, gl, fly, list: [], byId: {}, flyT: -1, flyFrom: new THREE.Matrix4(), flyN: new THREE.Vector3(), found: null, cells: list.map(t => CELL.lost + LOST_IDS.indexOf(t.id)) };
  set.userData.tags = T;
  const put = (t, i) => {
    const e = { id: t.id, i, p: V3(t.p[0], t.p[1], t.p[2]), m: compose(t).clone(), n: N0.clone(), x: t.p[0], z: t.p[2] };
    T.list.push(e); T.byId[t.id] = e;
    im.setMatrixAt(i, e.m); im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); gl.boundingSphere = im.boundingSphere;
    const sp = { kind: "pickup", tag: true, label, p: e.p, stand: V3(t.stand[0], 0, t.stand[1]), r: 1.5 };
    if (t.when) sp.when = () => { const g = set.userData.spots[t.when]; return !!(g && g.on); };
    set.userData.spots[t.id] = sp;
    lostGen.n++;
  };
  list.forEach((t, i) => { if (!t.wiper) put(t, i); else im.setMatrixAt(i, ZERO); });
  const w = list.findIndex(t => t.wiper);
  if (w >= 0) lotReady.then(() => { const t = wiperPlate(set, list[w].id); if (t) { put(t, w); if (T.found) syncLostPlates(set, T.found); } });
}
/* the plate left on a windshield: a parked car with a free side to stand on, the plate at the glass's foot, against the wiper */
function wiperPlate(set, id) {
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
export function syncLostPlates(set, found) {
  const T = set && set.userData.tags; if (!T) return;
  T.found = found;
  for (const e of T.list) T.im.setMatrixAt(e.i, found.includes(e.id) ? ZERO : e.m);
  T.im.instanceMatrix.needsUpdate = true;
}
export function takeLostPlate(set, id, still) {
  const T = set && set.userData.tags, e = T && T.byId[id]; if (!e) return false;
  T.im.setMatrixAt(e.i, ZERO); T.im.instanceMatrix.needsUpdate = true;
  T.flyFrom.copy(e.m); T.flyN.copy(e.n); T.flyT = 0; T.still = !!still;
  T.fly.setColorAt(0, cellColor(T.cells[e.i], WD.TIER.carLo, FC)); T.fly.instanceColor.needsUpdate = true;
  T.fly.matrixAutoUpdate = false; T.fly.matrix.copy(e.m); T.fly.matrixWorldNeedsUpdate = true; T.fly.visible = true; flyMat.uniforms.uAlpha.value = 1;
  lostGen.n++;
  return true;
}
const FLY = 0.85, LIFT = new THREE.Vector3(), FQ = new THREE.Quaternion(), FP = new THREE.Vector3(), FS = new THREE.Vector3(), FC = new THREE.Color();
export function tickLostPlates(set, me, t, dt) {
  const T = set && set.userData.tags; if (!T) return;
  // the glint pass is drawn only while a plate still lying there is within reach of the eye
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
    flyMat.uniforms.uAlpha.value = 1 - u * u;
    if (u >= 1) { T.flyT = -1; T.fly.visible = false; }
  }
}
