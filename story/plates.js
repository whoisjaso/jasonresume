/* After Hours: Texas license plates. One plate model (tools/story/plate.py, built in Blender: the aluminium sheet,
   its rounded corners, the bead pressed in round the edge and the four bolt slots; assets/story/plate-v1.glb) and
   one atlas of faces (story/tex.js plateAtlas: the Texas standard design, letters only, a different pair in each
   cell). Every plate in a set is an instance of one mesh with one material, its face picked by its instance colour,
   so a lot full of cars, a plate on the front and the back of each, is one draw call.

   plateGeo()             the shared plate: 12 by 6 inches, +Z out of the face, +Y up it, the back on z = 0. A stand-in
                          (the same outline and slots, extruded) until the model lands, then the model in its place
   plateMat(lo)           the material for the plates on cars; lostMat(lo) for the ones lying about, with a little
                          light of their own so they read in a dark corner; lo: the phone tier's smaller atlas
   cellColor(i, lo, c)    cell i of the atlas as an instance colour (setColorAt)
   CELL                   whose cells are whose: the lost plates, the car going by on the street, then the lot's cars
   plateMounts(geo, meta) where a car kind's plates go (matrices in the car's space), from the plate patches its model
                          carries front and back (tools/story/world/cars.py), or from its size when it has none
   PLATE_W, PLATE_H       the plate's size in metres */
import * as THREE from "../vendor/three-0.184.0/three.module.min.js";
import { GLTFLoader } from "../vendor/three-0.184.0/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "../vendor/meshopt-0.22.0/meshopt_decoder.module.js";
import { pbr } from "./paint.js";
import * as TX from "./tex.js";

export const PLATE_W = 0.3048, PLATE_H = 0.1524;
export const CELL = { lost: 0, passing: 12, lot: 13 };
const URL0 = new URL("../assets/story/plate-v1.glb", import.meta.url).href;

/* the stand-in: the outline with its corners and slots, extruded a millimetre, mapped like the model */
function standIn() {
  const W = PLATE_W, H = PLATE_H, r = 0.0095, s = new THREE.Shape();
  s.moveTo(-W / 2 + r, -H / 2); s.lineTo(W / 2 - r, -H / 2); s.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + r);
  s.lineTo(W / 2, H / 2 - r); s.quadraticCurveTo(W / 2, H / 2, W / 2 - r, H / 2); s.lineTo(-W / 2 + r, H / 2);
  s.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - r); s.lineTo(-W / 2, -H / 2 + r); s.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + r, -H / 2);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const h = new THREE.Path(), cx = sx * 0.0889, cy = sy * 0.0603, l = 0.007 - 0.0033;
    h.absarc(cx + l, cy, 0.0033, -Math.PI / 2, Math.PI / 2, false); h.absarc(cx - l, cy, 0.0033, Math.PI / 2, Math.PI * 1.5, false);
    s.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.0008, bevelEnabled: true, bevelThickness: 0.0001, bevelSize: 0.0002, bevelSegments: 1, curveSegments: 3 });
  g.translate(0, 0, 0.0001); g.clearGroups();
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    if (n.getZ(i) < -0.5) uv.setXY(i, 0.004, 0.5);
    else uv.setXY(i, (p.getX(i) + W / 2) / W, (H / 2 - p.getY(i)) / H);
  }
  return g;
}
let GEO = null;
const users = [];
export function plateGeo() {
  if (GEO) return GEO;
  GEO = standIn(); GEO.computeBoundingSphere();
  const ld = new GLTFLoader(); ld.setMeshoptDecoder(MeshoptDecoder);
  ld.loadAsync(URL0).then(gltf => {
    let mesh = null; gltf.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
    if (!mesh || !mesh.geometry.attributes.uv) return;
    mesh.updateWorldMatrix(true, false);
    const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    // into the geometry every plate already shares, so nothing built with the stand-in needs rebuilding
    for (const k of Object.keys(GEO.attributes)) GEO.deleteAttribute(k);
    for (const k of ["position", "normal", "uv"]) GEO.setAttribute(k, g.attributes[k]);
    GEO.setIndex(g.index); GEO.computeBoundingSphere(); GEO.computeBoundingBox();
    for (const m of users) m.computeBoundingSphere();
  }).catch(e => console.warn("[plates] model", e && e.message));
  return GEO;
}
/* an instanced mesh of plates whose bounds follow the model when it lands */
export function plateMesh(mat, n) {
  const im = new THREE.InstancedMesh(plateGeo(), mat, n);
  im.userData.keep = true; users.push(im);
  return im;
}

const mats = {};
function make(lo, o) {
  const A = TX.plateAtlas(lo);
  return pbr({ map: A.map, nmap: A.nmap, nk: 0.9, cell: A.scale, color: "#ffffff", ao: 0, ...o });
}
// the reflective sheeting on the face: a smooth paint, darker and glossier where the rain sits
export function plateMat(lo) { return mats.car || (mats.car = make(lo, { rough: 0.38, wet: 0.55, spec: 1.1, emit: "#0b0c0c" })); }
export function lostMat(lo) { return mats.lost || (mats.lost = make(lo, { rough: 0.4, wet: 0.15, emit: "#1e1c17" })); }
export function flyMat(lo) { return mats.fly || (mats.fly = make(lo, { rough: 0.4, wet: 0, emit: "#2a2721", transparent: true, depthWrite: false, alpha: 1, side: THREE.DoubleSide })); }
export function cellColor(i, lo, c = new THREE.Color()) { const [u, v] = TX.plateAtlas(lo).cell(i); return c.setRGB(u, v, 0); }

/* a car kind's plates: the model's plate patches (front, +Z, and back) give each one's middle and the face of the
   bumper behind it; the plate stands a few millimetres proud of the body there, facing out */
export function plateMounts(geo, meta) {
  const sides = { 1: null, "-1": null };
  if (geo && geo.attributes.position) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i), k = z > 0 ? 1 : -1, b = sides[k] || (sides[k] = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z: 0 });
      b.x0 = Math.min(b.x0, p.getX(i)); b.x1 = Math.max(b.x1, p.getX(i)); b.y0 = Math.min(b.y0, p.getY(i)); b.y1 = Math.max(b.y1, p.getY(i));
      if (Math.abs(z) > Math.abs(b.z)) b.z = z;
    }
  }
  const L = (meta && meta.L) || 4.7, out = [], Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1);
  for (const k of [1, -1]) {
    const b = sides[k] || { x0: 0, x1: 0, y0: k > 0 ? 0.48 : 0.56, y1: k > 0 ? 0.48 : 0.56, z: k * L / 2 };
    Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), k > 0 ? 0 : Math.PI);
    out.push(new THREE.Matrix4().compose(new THREE.Vector3((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, b.z - k * (k > 0 ? 0.002 : 0.004)), Q, S));
  }
  return out;
}
