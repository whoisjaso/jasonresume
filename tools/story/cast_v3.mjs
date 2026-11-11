// After Hours: the cast, a second pass over the packed bodies (no Blender needed, the rig is untouched).
//   node tools/story/cast_v3.mjs [name ...]
// Reads assets/story/cast/<name>-v2.glb and writes <name>-v3.glb (the old files stay: /assets is cached
// for a year, so a changed asset is a new file). For each body:
// - the skin gets its own shade baked into a vertex colour: how much of the sky each point of skin can
//   see within a few centimetres (rays against the skin, teeth, eyes and clothes), so the eye sockets,
//   the wings of the nose, the line between the lips, the ears, the fingers and the neck inside its
//   collar sit in soft shadow in any light. story/paint.js reads it (USE_SKINAO).
// - my own hair (jason, jason-memory) is cut short: the shell is drawn in toward the scalp, full on top
//   and close at the sides, and its hairline is redrawn straight across the forehead with a square
//   corner at each temple (the colour's R is the height over that line; the shader trims on it).
// - the visitor's hair (player) carries, for each vertex of its shell, the way back to the scalp (_SCALP), so
//   the character creator can wear it cropped close, as it is, or grown out, from the one mesh.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, '..', '..', 'assets', 'story', 'cast');
const NAMES = process.argv.slice(2).length ? process.argv.slice(2) : ['jason', 'jason-memory', 'player', 'dell', 'renata'];
// how far my hair comes in: [the factor where the shell was thinnest, the factor where it was fullest]
const CUT = { jason: [0.8, 0.42], 'jason-memory': [0.8, 0.34] };
const RAYS = 96, REACH = 0.05, CELL = 0.0125;

await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function xf(m, p, w) { const [x, y, z] = p; return [m[0] * x + m[4] * y + m[8] * z + w * m[12], m[1] * x + m[5] * y + m[9] * z + w * m[13], m[2] * x + m[6] * y + m[10] * z + w * m[14]]; }
function inv(m) {
  // the inverse of an affine matrix (column major)
  const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  const r = [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, 0, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, 0, C / det, -(a * h - b * g) / det, (a * e - b * d) / det, 0, 0, 0, 0, 1];
  const t = xf(r, [m[12], m[13], m[14]], 0); r[12] = -t[0]; r[13] = -t[1]; r[14] = -t[2]; return r;
}

/* a uniform grid over triangles: rays that stop short, and the closest point on the surface */
class Grid {
  constructor(tris) {
    this.t = tris; this.n = tris.length / 9; this.map = new Map(); this.stamp = new Int32Array(this.n); this.tick = 0;
    for (let k = 0; k < this.n; k++) {
      const o = k * 9; const lo = [0, 1, 2].map(a => Math.floor(Math.min(tris[o + a], tris[o + 3 + a], tris[o + 6 + a]) / CELL)), hi = [0, 1, 2].map(a => Math.floor(Math.max(tris[o + a], tris[o + 3 + a], tris[o + 6 + a]) / CELL));
      for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const key = (x + 512) * 1048576 + (y + 512) * 1024 + (z + 512); let l = this.map.get(key); if (!l) this.map.set(key, l = []); l.push(k); }
    }
  }
  cell(x, y, z) { return this.map.get((x + 512) * 1048576 + (y + 512) * 1024 + (z + 512)); }
  /* the distance along a ray to the first hit within max, or Infinity */
  ray(o, d, max) {
    const t = this.t, id = ++this.tick; let best = Infinity;
    const steps = Math.ceil(max / (CELL * 0.5));
    let lx = 1e9, ly = 1e9, lz = 1e9;
    for (let s = 0; s <= steps; s++) {
      const u = Math.min(max, s * CELL * 0.5), cx = Math.floor((o[0] + d[0] * u) / CELL), cy = Math.floor((o[1] + d[1] * u) / CELL), cz = Math.floor((o[2] + d[2] * u) / CELL);
      if (cx === lx && cy === ly && cz === lz) continue; lx = cx; ly = cy; lz = cz;
      const l = this.cell(cx, cy, cz); if (!l) continue;
      for (const k of l) {
        if (this.stamp[k] === id) continue; this.stamp[k] = id;
        const i = k * 9;
        const e1x = t[i + 3] - t[i], e1y = t[i + 4] - t[i + 1], e1z = t[i + 5] - t[i + 2], e2x = t[i + 6] - t[i], e2y = t[i + 7] - t[i + 1], e2z = t[i + 8] - t[i + 2];
        const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
        const det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-12) continue;
        const f = 1 / det, sx = o[0] - t[i], sy = o[1] - t[i + 1], sz = o[2] - t[i + 2];
        const uu = f * (sx * px + sy * py + sz * pz); if (uu < 0 || uu > 1) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
        const vv = f * (d[0] * qx + d[1] * qy + d[2] * qz); if (vv < 0 || uu + vv > 1) continue;
        const tt = f * (e2x * qx + e2y * qy + e2z * qz);
        if (tt > 1e-5 && tt < best) best = tt;
      }
      if (best <= u) break;
    }
    return best <= max ? best : Infinity;
  }
  /* the closest point on the surface to p, looking no further than max */
  closest(p, max) {
    const t = this.t, id = ++this.tick, R = Math.ceil(max / CELL); let bd = max * max, bp = null;
    const c = p.map(v => Math.floor(v / CELL));
    for (let x = -R; x <= R; x++) for (let y = -R; y <= R; y++) for (let z = -R; z <= R; z++) {
      const l = this.cell(c[0] + x, c[1] + y, c[2] + z); if (!l) continue;
      for (const k of l) {
        if (this.stamp[k] === id) continue; this.stamp[k] = id;
        const q = closestOnTri(p, t, k * 9), dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], dd = dx * dx + dy * dy + dz * dz;
        if (dd < bd) { bd = dd; bp = q; }
      }
    }
    return bp;
  }
}
function closestOnTri(p, t, i) {
  const ax = t[i], ay = t[i + 1], az = t[i + 2], abx = t[i + 3] - ax, aby = t[i + 4] - ay, abz = t[i + 5] - az, acx = t[i + 6] - ax, acy = t[i + 7] - ay, acz = t[i + 8] - az;
  const apx = p[0] - ax, apy = p[1] - ay, apz = p[2] - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) return [ax, ay, az];
  const bpx = apx - abx, bpy = apy - aby, bpz = apz - abz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return [ax + abx, ay + aby, az + abz];
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [ax + abx * v, ay + aby * v, az + abz * v]; }
  const cpx = apx - acx, cpy = apy - acy, cpz = apz - acz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return [ax + acx, ay + acy, az + acz];
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [ax + acx * w, ay + acy * w, az + acz * w]; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); return [ax + abx + (acx - abx) * w, ay + aby + (acy - aby) * w, az + abz + (acz - abz) * w]; }
  const dn = 1 / (va + vb + vc), v = vb * dn, w = vc * dn;
  return [ax + abx * v + acx * w, ay + aby * v + acy * w, az + abz * v + acz * w];
}

/* the same directions for every vertex: a cosine-weighted hemisphere round +z, turned to each normal */
const DIRS = []; { let s = 12345; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < RAYS; i++) { const u = (i + r()) / RAYS, a = r() * Math.PI * 2, rr = Math.sqrt(u); DIRS.push([rr * Math.cos(a), rr * Math.sin(a), Math.sqrt(1 - u)]); } }
function basis(n) { const a = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; let t = [a[1] * n[2] - a[2] * n[1], a[2] * n[0] - a[0] * n[2], a[0] * n[1] - a[1] * n[0]]; const l = Math.hypot(...t); t = t.map(v => v / l); const b = [n[1] * t[2] - n[2] * t[1], n[2] * t[0] - n[0] * t[2], n[0] * t[1] - n[1] * t[0]]; return [t, b]; }

for (const name of NAMES) {
  const doc = await io.read(path.join(DIR, name + '-v2.glb'));
  const prims = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const M = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const role = (prim.getMaterial() && prim.getMaterial().getName()) || '';
      const P = prim.getAttribute('POSITION'), n = P.getCount(), pos = new Float32Array(n * 3), e = [0, 0, 0];
      for (let i = 0; i < n; i++) { P.getElement(i, e); const w = xf(M, e, 1); pos[i * 3] = w[0]; pos[i * 3 + 1] = w[1]; pos[i * 3 + 2] = w[2]; }
      const idx = prim.getIndices().getArray();
      prims.push({ role, prim, node, M, pos, idx, n });
    }
  }
  const trisOf = list => { let c = 0; for (const p of list) c += p.idx.length; const t = new Float32Array(c * 3); let o = 0; for (const p of list) for (let i = 0; i < p.idx.length; i++) { const v = p.idx[i] * 3; t[o++] = p.pos[v]; t[o++] = p.pos[v + 1]; t[o++] = p.pos[v + 2]; } return t; };
  const skin = prims.find(p => p.role === 'skin');

  // ---- my hair, cut short
  const hair = prims.find(p => p.role === 'hair' && p.prim.getAttribute('COLOR_0') && !p.prim.getMaterial().getBaseColorTexture());
  if (CUT[name] && hair) {
    const g = new Grid(trisOf([skin])), Mi = inv(hair.M), P = hair.prim.getAttribute('POSITION'), C = hair.prim.getAttribute('COLOR_0');
    let top = -1e9; for (let i = 0; i < skin.n; i++) top = Math.max(top, skin.pos[i * 3 + 1]);
    let cx = 0, cz = 0, cn = 0; for (let i = 0; i < skin.n; i++) if (skin.pos[i * 3 + 1] > top - 0.26) { cx += skin.pos[i * 3]; cz += skin.pos[i * 3 + 2]; cn++; } cx /= cn; cz /= cn;
    // how far below the crown the hairline sits, by the angle round the head from straight ahead: level across the
    // forehead, a square corner at the temple, down behind the ear to the nape
    const line = th => 0.067 + 0.03 * ss(0.78, 0.98, th) + 0.008 * ss(1.0, 1.5, th) - 0.014 * ss(1.15, 1.45, th) * (1 - ss(1.75, 2.05, th)) + 0.06 * ss(1.8, 2.7, th);
    const [k0, k1] = CUT[name]; let moved = 0, maxd = 0; const col = [0, 0, 0, 0];
    for (let i = 0; i < hair.n; i++) {
      const p = [hair.pos[i * 3], hair.pos[i * 3 + 1], hair.pos[i * 3 + 2]], f = g.closest(p, 0.09); if (!f) continue;
      const d = Math.hypot(p[0] - f[0], p[1] - f[1], p[2] - f[2]); maxd = Math.max(maxd, d);
      const k = k0 + (k1 - k0) * ss(0.008, 0.03, d);
      const w = [f[0] + (p[0] - f[0]) * k, f[1] + (p[1] - f[1]) * k, f[2] + (p[2] - f[2]) * k];
      P.setElement(i, xf(Mi, w, 1)); moved++;
      const th = Math.abs(Math.atan2(f[0] - cx, f[2] - cz)), above = f[1] - (top - line(th));
      C.getElement(i, col); col[0] = Math.min(1, Math.max(0, 0.5 + above / 0.012)); C.setElement(i, col);
    }
    console.log(name, 'hair: drew in', moved, 'of', hair.n, 'vertices; it stood', (maxd * 100).toFixed(1), 'cm at its fullest, now', (maxd * k1 * 100).toFixed(1));
  }

  // ---- the visitor's hair: each vertex's way back to the scalp, in the mesh's own units
  if (name === 'player' && hair) {
    const g = new Grid(trisOf([skin])), Mi = inv(hair.M), arr = new Float32Array(hair.n * 3);
    for (let i = 0; i < hair.n; i++) {
      const p = [hair.pos[i * 3], hair.pos[i * 3 + 1], hair.pos[i * 3 + 2]], f = g.closest(p, 0.09); if (!f) continue;
      const d = xf(Mi, [f[0] - p[0], f[1] - p[1], f[2] - p[2]], 0); arr[i * 3] = d[0]; arr[i * 3 + 1] = d[1]; arr[i * 3 + 2] = d[2];
    }
    hair.prim.setAttribute('_SCALP', doc.createAccessor('hair_scalp').setType('VEC3').setArray(arr).setBuffer(doc.getRoot().listBuffers()[0]));
    console.log(name, 'hair: the way to the scalp for', hair.n, 'vertices');
  }

  // ---- the skin's own shade
  const occ = prims.filter(p => p.role === 'skin' || p.role === 'teeth' || p.role === 'eyes' || p.role.startsWith('cloth'));
  const g = new Grid(trisOf(occ));
  const N = skin.prim.getAttribute('NORMAL'), ao = new Float32Array(skin.n), e = [0, 0, 0];
  for (let i = 0; i < skin.n; i++) {
    N.getElement(i, e); let n = xf(skin.M, e, 0); const l = Math.hypot(...n) || 1; n = n.map(v => v / l);
    const [t, b] = basis(n), o = [skin.pos[i * 3] + n[0] * 0.0012, skin.pos[i * 3 + 1] + n[1] * 0.0012, skin.pos[i * 3 + 2] + n[2] * 0.0012];
    let open = 0;
    for (const d of DIRS) {
      const dir = [t[0] * d[0] + b[0] * d[1] + n[0] * d[2], t[1] * d[0] + b[1] * d[1] + n[1] * d[2], t[2] * d[0] + b[2] * d[1] + n[2] * d[2]];
      const h = g.ray(o, dir, REACH);
      open += h === Infinity ? 1 : Math.pow(h / REACH, 0.7) * 0.85;
    }
    ao[i] = open / RAYS;
  }
  // soften it across the mesh, so no single vertex is a speck
  { const nb = Array.from({ length: skin.n }, () => new Set()); const ix = skin.idx;
    for (let i = 0; i < ix.length; i += 3) { const a = ix[i], b = ix[i + 1], c = ix[i + 2]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
    // vertices split at a seam share a place: fold them together first
    const at = new Map(), same = new Int32Array(skin.n);
    for (let i = 0; i < skin.n; i++) { const k = skin.pos[i * 3].toFixed(5) + ',' + skin.pos[i * 3 + 1].toFixed(5) + ',' + skin.pos[i * 3 + 2].toFixed(5); if (!at.has(k)) at.set(k, i); same[i] = at.get(k); }
    for (let i = 0; i < skin.n; i++) if (same[i] !== i) { for (const j of nb[i]) nb[same[i]].add(same[j]); }
    for (let pass = 0; pass < 2; pass++) { const out = new Float32Array(skin.n);
      for (let i = 0; i < skin.n; i++) { const r = same[i]; let s = ao[r] * 2, w = 2; for (const j of nb[r]) { s += ao[same[j]]; w++; } out[i] = s / w; }
      for (let i = 0; i < skin.n; i++) ao[i] = out[same[i]]; } }
  const arr = new Uint8Array(skin.n * 4); let lo = 1, sum = 0;
  for (let i = 0; i < skin.n; i++) { const v = Math.min(1, Math.max(0, ao[i])); lo = Math.min(lo, v); sum += v; arr[i * 4] = arr[i * 4 + 1] = arr[i * 4 + 2] = Math.round(v * 255); arr[i * 4 + 3] = 255; }
  const acc = doc.createAccessor('skin_shade').setType('VEC4').setNormalized(true).setArray(arr).setBuffer(doc.getRoot().listBuffers()[0]);
  skin.prim.setAttribute('COLOR_0', acc);
  console.log(name, 'skin shade:', skin.n, 'vertices, darkest', lo.toFixed(2), 'mean', (sum / skin.n).toFixed(2));

  const out = path.join(DIR, name + '-v3.glb');
  await io.write(out, doc);
  console.log(name, (fs.statSync(path.join(DIR, name + '-v2.glb')).size / 1024).toFixed(0), 'KB ->', (fs.statSync(out).size / 1024).toFixed(0), 'KB');
}
