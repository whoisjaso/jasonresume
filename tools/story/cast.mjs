// After Hours: the cast, modelled in code.
//
//   node tools/story/cast.mjs            writes assets/story/cast-<v>.bin and cast-<v>.json
//
// Every character is a set of signed distance fields (tapered capsules,
// ellipsoids and rounded boxes, blended with smooth minimums), meshed with
// surface nets, coloured by region and skinned to a twenty-bone skeleton. Soft
// forms and readable silhouettes, the way a painted adventure game draws its
// people, with no photo anywhere. Two meshes per character: the body on a
// coarser grid and the head on a fine one, joined inside the collar.
// The face (eyes, lids, brows, mouth) and props (glasses, umbrella) are built at
// runtime in story/people.js, on the head bone, from the anchors written here.
//
// Binary layout per mesh: Int16 positions (1/8000 m), Int8 normals, Uint8
// palette index, Uint8 bone pair, Uint8 weight of the first bone; Uint16 indices.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MeshoptSimplifier as SIMP } from 'meshoptimizer/meshopt_simplifier.module.js';
import { MeshoptEncoder as ENC } from 'meshoptimizer/meshopt_encoder.module.js';
await SIMP.ready; await ENC.ready; SIMP.useExperimentalFeatures = true;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const V = 'v1';
const OUTDIR = path.join(ROOT, 'assets', 'story');

// ---------- distance functions ----------
const sq = x => x * x;
function roundCone(a, b, r1, r2) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  return (x, y, z) => {
    const pax = x - a[0], pay = y - a[1], paz = z - a[2];
    const yy = pax * bax + pay * bay + paz * baz, zz = yy - l2;
    const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy;
    const x2 = qx * qx + qy * qy + qz * qz, y2 = yy * yy * l2, z2 = zz * zz * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
  };
}
// rotation as a 3x3 from euler XYZ (radians)
function rot(rx = 0, ry = 0, rz = 0) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  // R = Rz * Ry * Rx, we need inverse (transpose) to bring p into local
  const m = [
    cy * cz, sx * sy * cz - cx * sz, cx * sy * cz + sx * sz,
    cy * sz, sx * sy * sz + cx * cz, cx * sy * sz - sx * cz,
    -sy, sx * cy, cx * cy
  ];
  return m;
}
function local(c, m, x, y, z) {
  const px = x - c[0], py = y - c[1], pz = z - c[2];
  if (!m) return [px, py, pz];
  // transpose multiply
  return [m[0] * px + m[3] * py + m[6] * pz, m[1] * px + m[4] * py + m[7] * pz, m[2] * px + m[5] * py + m[8] * pz];
}
function ellipsoid(c, r, e) {
  const m = e ? rot(...e) : null;
  return (x, y, z) => {
    const [px, py, pz] = local(c, m, x, y, z);
    const k0 = Math.sqrt(sq(px / r[0]) + sq(py / r[1]) + sq(pz / r[2]));
    const k1 = Math.sqrt(sq(px / (r[0] * r[0])) + sq(py / (r[1] * r[1])) + sq(pz / (r[2] * r[2])));
    return k1 < 1e-9 ? -Math.min(...r) : k0 * (k0 - 1) / k1;
  };
}
function rbox(c, b, rad, e) {
  const m = e ? rot(...e) : null;
  return (x, y, z) => {
    const [px, py, pz] = local(c, m, x, y, z);
    const qx = Math.abs(px) - b[0] + rad, qy = Math.abs(py) - b[1] + rad, qz = Math.abs(pz) - b[2] + rad;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - rad;
  };
}
const sphere = (c, r) => (x, y, z) => Math.hypot(x - c[0], y - c[1], z - c[2]) - r;
function smin(a, b, k) { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
function smax(a, b, k) { return -smin(-a, -b, k); }
// cut a shape by a half space: keep where dot(p - o, n) <= 0
const cut = (f, o, n, k = 0.004) => (x, y, z) => smax(f(x, y, z), (x - o[0]) * n[0] + (y - o[1]) * n[1] + (z - o[2]) * n[2], k);
const shell = (outer, inner) => (x, y, z) => Math.max(outer(x, y, z), -inner(x, y, z));

// ---------- skeleton ----------
const BONES = ['root', 'hips', 'spine', 'chest', 'neck', 'head', 'claviL', 'armL', 'foreL', 'handL', 'claviR', 'armR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
const PARENT = [-1, 0, 1, 2, 3, 4, 3, 6, 7, 8, 3, 10, 11, 12, 1, 14, 15, 1, 17, 18];
const B = Object.fromEntries(BONES.map((n, i) => [n, i]));

// ---------- one character from a spec ----------
// Character faces +Z, stands on y = 0; its left is +X.
function character(S) {
  const s = S.h / 1.8; // everything below is drawn for 1.80 m and scaled
  const P = (x, y, z) => [x * s, y * s, z * s];
  const R = r => r * s;
  const W = S.build || 1; // width factor for the torso
  const L = S.limb || 1; // limb thickness factor

  const J = {
    root: P(0, 0, 0), hips: P(0, 0.95, 0), spine: P(0, 1.08, 0), chest: P(0, 1.25, -0.005), neck: P(0, 1.47, -0.015), head: P(0, 1.585, -0.005),
    claviL: P(0.03, 1.43, -0.01), armL: P(0.195, 1.415, -0.015), foreL: P(0.24, 1.135, -0.035), handL: P(0.278, 0.875, -0.005),
    thighL: P(0.095, 0.92, 0), shinL: P(0.1, 0.5, 0.012), footL: P(0.105, 0.085, -0.012)
  };
  for (const k of ['clavi', 'arm', 'fore', 'hand', 'thigh', 'shin', 'foot']) { const v = J[k + 'L']; J[k + 'R'] = [-v[0], v[1], v[2]]; }
  const handEnd = side => P(0.296 * side, 0.715, 0.012);
  const toe = side => P(0.11 * side, 0.03, 0.14);

  const prims = []; // { f, bone, col, k, part: 'body'|'head', name }
  const add = (part, name, f, bone, col, k = 0.02) => prims.push({ part, name, f, bone: B[bone], col, k });
  const out = S.outfit;
  const top = out.top, sleeve = out.sleeve || top, pants = out.pants, shoe = out.shoe;

  // --- torso ---
  add('body', 'pelvis', ellipsoid(P(0, 0.97, 0), [R(0.158 * W), R(0.115), R(0.108 * W)]), 'hips', pants, 0.04);
  add('body', 'belly', ellipsoid(P(0, 1.1, 0.008 + (S.belly || 0)), [R(0.148 * W + (S.belly || 0) * 0.6), R(0.13), R(0.1 * W + (S.belly || 0))]), 'spine', top, 0.06);
  add('body', 'chest', ellipsoid(P(0, 1.29, 0.0), [R(0.17 * W), R(0.165), R(0.112 * W)]), 'chest', top, 0.06);
  add('body', 'shoulders', roundCone(P(-0.165, 1.415, -0.015), P(0.165, 1.415, -0.015), R(0.062 * L), R(0.062 * L)), 'chest', top, 0.05);
  add('body', 'deltL', sphere(P(0.198, 1.395, -0.012), R(0.062 * L)), 'armL', sleeve, 0.04);
  add('body', 'deltR', sphere(P(-0.198, 1.395, -0.012), R(0.062 * L)), 'armR', sleeve, 0.04);
  if (out.skirt) add('body', 'skirt', rbox(P(0, 0.875, 0.004), [R(0.172 * W), R(0.12), R(0.118 * W)], R(0.085)), 'hips', top, 0.05);
  if (out.longcoat) add('body', 'coat', roundCone(P(0, 1.02, 0.0), P(0, 0.62, -0.005), R(0.17 * W), R(0.2 * W)), 'hips', top, 0.06);
  // --- arms ---
  for (const side of [1, -1]) {
    const sx = side > 0 ? 'L' : 'R';
    add('body', 'upper' + sx, roundCone(J['arm' + sx], J['fore' + sx], R(0.052 * L), R(0.045 * L)), 'arm' + sx, sleeve, 0.03);
    add('body', 'fore' + sx, roundCone(J['fore' + sx], J['hand' + sx], R(0.045 * L), R(0.037 * L)), 'fore' + sx, sleeve, 0.025);
    if (out.cuff) add('body', 'cuff' + sx, roundCone(P(0.27 * side, 0.92, -0.01), P(0.276 * side, 0.89, -0.006), R(0.038 * L), R(0.036 * L)), 'fore' + sx, out.cuff, 0.006);
    // hand: palm, fingers as a mitten, thumb toward the front
    const w = J['hand' + sx], e = handEnd(side);
    const mid = [w[0] + (e[0] - w[0]) * 0.42, w[1] + (e[1] - w[1]) * 0.42, w[2] + (e[2] - w[2]) * 0.42];
    add('body', 'palm' + sx, ellipsoid(mid, [R(0.021), R(0.048), R(0.043)], [0, 0, side * 0.12]), 'hand' + sx, 'skin', 0.018);
    add('body', 'fingers' + sx, roundCone([mid[0], mid[1] - R(0.03), mid[2] + R(0.003)], e, R(0.017), R(0.013)), 'hand' + sx, 'skin', 0.02);
    add('body', 'thumb' + sx, roundCone([w[0] - side * R(0.004), w[1] - R(0.035), w[2] + R(0.024)], [w[0] - side * R(0.008), w[1] - R(0.085), w[2] + R(0.05)], R(0.011), R(0.009)), 'hand' + sx, 'skin', 0.012);
    add('body', 'wrist' + sx, roundCone([w[0], w[1] + R(0.02), w[2]], w, R(0.026), R(0.025)), 'hand' + sx, 'skin', 0.012);
  }
  // --- legs ---
  for (const side of [1, -1]) {
    const sx = side > 0 ? 'L' : 'R';
    add('body', 'thigh' + sx, roundCone(J['thigh' + sx], J['shin' + sx], R(0.083 * L * (S.hipsW || 1)), R(0.06 * L)), 'thigh' + sx, pants, 0.04);
    add('body', 'shin' + sx, roundCone(J['shin' + sx], [J['foot' + sx][0], J['foot' + sx][1] + R(0.03), J['foot' + sx][2]], R(0.058 * L), R(out.flare ? 0.054 : 0.046) * L), 'shin' + sx, pants, 0.03);
    const a = [J['foot' + sx][0], R(0.055), J['foot' + sx][2] - R(0.035)], t = toe(side);
    const shoeF = cut(roundCone(a, [t[0], R(0.045), t[2]], R(0.048), R(0.04)), [0, R(0.004), 0], [0, -1, 0], R(0.006));
    add('body', 'shoe' + sx, shoeF, 'foot' + sx, shoe, 0.02);
    add('body', 'sole' + sx, cut(roundCone([a[0], R(0.02), a[2] - R(0.01)], [t[0], R(0.02), t[2] + R(0.012)], R(0.05), R(0.043)), [0, R(0.03), 0], [0, 1, 0], R(0.003)), 'foot' + sx, out.sole || shoe, 0.006);
  }
  // --- collar and neckwear (body side of the seam) ---
  if (out.collar) add('body', 'collar', roundCone(P(0, 1.455, -0.022), P(0, 1.505, -0.016), R(0.062), R(0.056)), 'chest', out.collar, 0.012);
  if (out.scarf) {
    add('body', 'scarf', ellipsoid(P(0, 1.475, -0.005), [R(0.085), R(0.04), R(0.075)]), 'chest', out.scarf, 0.02);
    add('body', 'scarfTail', roundCone(P(0.03, 1.46, 0.06), P(0.05, 1.3, 0.1), R(0.03), R(0.026)), 'chest', out.scarf, 0.02);
  }
  if (out.hoodDown) add('body', 'hoodDown', ellipsoid(P(0, 1.47, -0.07), [R(0.13), R(0.06), R(0.085)], [0.3, 0, 0]), 'chest', top, 0.04);
  if (out.jacketCollar) add('body', 'jcollar', roundCone(P(0, 1.45, -0.03), P(0, 1.53, -0.04), R(0.075), R(0.07)), 'chest', top, 0.02);

  // --- head (fine grid) ---
  const hd = S.head || {};
  add('head', 'neck', roundCone(P(0, 1.42, -0.018), P(0, 1.63, -0.012), R(0.054 * (hd.neck || 1)), R(0.049 * (hd.neck || 1))), 'neck', 'skin', 0.02);
  add('head', 'skull', ellipsoid(P(0, 1.705, -0.008), [R(0.077), R(0.101), R(0.098)]), 'head', 'skin', 0.03);
  add('head', 'jaw', ellipsoid(P(0, 1.64, 0.022), [R(0.064 * (hd.jaw || 1)), R(0.062), R(0.07)]), 'head', 'skin', 0.04);
  add('head', 'chin', sphere(P(0, 1.6, 0.066), R(0.026 * (hd.chin || 1))), 'head', 'skin', 0.035);
  add('head', 'cheekL', ellipsoid(P(0.044, 1.672, 0.056), [R(0.034), R(0.028), R(0.032)]), 'head', 'skin', 0.03);
  add('head', 'cheekR', ellipsoid(P(-0.044, 1.672, 0.056), [R(0.034), R(0.028), R(0.032)]), 'head', 'skin', 0.03);
  add('head', 'brow', ellipsoid(P(0, 1.726, 0.07), [R(0.066), R(0.02), R(0.032)]), 'head', 'skin', 0.03);
  add('head', 'nose', roundCone(P(0, 1.704, 0.088), P(0, 1.655, 0.108 + (hd.nose || 0)), R(0.011), R(0.014 * (hd.noseW || 1))), 'head', 'skin', 0.018);
  add('head', 'nostrils', ellipsoid(P(0, 1.651, 0.098), [R(0.024 * (hd.noseW || 1)), R(0.012), R(0.013)]), 'head', 'skin', 0.014);
  add('head', 'lips', ellipsoid(P(0, 1.627, 0.091), [R(0.028), R(0.012), R(0.012)]), 'head', 'lip', 0.012);
  for (const side of [1, -1]) {
    add('head', 'ear' + side, ellipsoid(P(0.079 * side, 1.688, -0.005), [R(0.011), R(0.03), R(0.02)], [0, side * 0.3, 0]), 'head', 'skin', 0.012);
  }
  // hair, beard and headwear by style
  const hairC = 'hair';
  if (hd.hair === 'short') {
    add('head', 'hair', cut(cut(ellipsoid(P(0, 1.718, -0.012), [R(0.083), R(0.106), R(0.104)]), P(0, 0, 0.074), [0, 0.15, 1], R(0.01)), P(0, 1.655, 0), [0, -1, 0.35], R(0.012)), 'head', hairC, 0.008);
  } else if (hd.hair === 'bun') {
    add('head', 'hair', cut(cut(ellipsoid(P(0, 1.718, -0.014), [R(0.085), R(0.108), R(0.106)]), P(0, 0, 0.078), [0, 0.3, 1], R(0.01)), P(0, 1.62, 0), [0, -1, 0.5], R(0.015)), 'head', hairC, 0.01);
    add('head', 'bun', sphere(P(0, 1.665, -0.112), R(0.042)), 'head', hairC, 0.025);
    add('head', 'fringe', ellipsoid(P(0.03, 1.765, 0.07), [R(0.06), R(0.022), R(0.03)], [0.4, 0, -0.35]), 'head', hairC, 0.02);
  } else if (hd.hair === 'cap') {
    add('head', 'hair', cut(ellipsoid(P(0, 1.69, -0.02), [R(0.082), R(0.09), R(0.1)]), P(0, 1.66, 0), [0, -1, 0.6], R(0.01)), 'head', hairC, 0.008);
    add('head', 'cap', cut(ellipsoid(P(0, 1.752, -0.004), [R(0.094), R(0.068), R(0.108)], [-0.15, 0, 0]), P(0, 1.72, 0), [0, -1, 0], R(0.006)), 'head', 'hat', 0.006);
    add('head', 'brim', ellipsoid(P(0, 1.738, 0.083), [R(0.082), R(0.012), R(0.05)], [-0.12, 0, 0]), 'head', 'hat', 0.01);
  }
  if (hd.hood) {
    const hoodOuter = ellipsoid(P(0, 1.705, -0.022), [R(0.112), R(0.13), R(0.128)]);
    const opening = ellipsoid(P(0, 1.665, 0.12), [R(0.085), R(0.115), R(0.09)]);
    add('head', 'hood', (x, y, z) => smax(smax(hoodOuter(x, y, z), -opening(x, y, z), R(0.02)), -(y - R(1.52)), R(0.01)), 'head', S.outfit.hoodC || S.outfit.top, 0.012);
    add('head', 'hoodBack', ellipsoid(P(0, 1.56, -0.06), [R(0.1), R(0.07), R(0.09)]), 'neck', S.outfit.hoodC || S.outfit.top, 0.03);
  }
  if (hd.beard === 'full') {
    add('head', 'beard', cut(ellipsoid(P(0, 1.62, 0.04), [R(0.074), R(0.06), R(0.066)]), P(0, 1.655, 0), [0, 1, -0.15], R(0.01)), 'head', 'beard', 0.025);
  }

  // eye sockets: shallow, so the eyeballs (runtime) sit in them
  const eyeY = 1.698, eyeX = 0.032, eyeZ = 0.077;
  const sockets = [sphere(P(eyeX, eyeY, eyeZ + 0.012), R(0.019)), sphere(P(-eyeX, eyeY, eyeZ + 0.012), R(0.019))];

  // painted regions
  function paint(col, x, y, z, part) {
    const X = x / s, Y = y / s, Z = z / s, ax = Math.abs(X);
    if (col === 'skin' && part === 'head') {
      if (hd.beard === 'goatee') {
        // a short goatee on the chin, a thin moustache over the lip, a line along the jaw
        const chin = Y < 1.612 && Z > 0.035 && ax < 0.03 + (1.612 - Y) * 0.35;
        const mous = Y > 1.633 && Y < 1.646 && Z > 0.083 && ax < 0.03;
        if (chin || mous) return 'beard';
      }
      if (hd.beard === 'stubble') { if (Y < 1.64 && Z > 0.0 && Y > 1.585) return 'stubble'; }
    }
    if (out.suit && part === 'body' && Z > 0.03) {
      // the V of the jacket: the shirt, the tie inside it, lapels along its edges, two buttons below
      const yV = 1.17, yTop = 1.475;
      if (Y > yV && Y < yTop + 0.03) {
        const w = 0.085 * Math.min(1, (Y - yV) / (yTop - yV));
        if (ax < w) {
          const tw = Y > 1.43 ? 0.02 : 0.016 + (1.43 - Y) * 0.06;
          if (ax < tw && Y < 1.465) return 'tie';
          return 'shirt';
        }
        if (ax < w + 0.032 && Y < yTop - 0.01) return 'lapel';
      }
      if (ax < 0.009 && (Math.abs(Y - 1.13) < 0.009 || Math.abs(Y - 1.05) < 0.009)) return 'button';
      if (X > 0.07 && X < 0.13 && Y > 1.3 && Y < 1.325 && Z > 0.08) return 'pocket';
    }
    if (out.zip && part === 'body' && Z > 0.04 && ax < 0.006 && Y > 0.8 && Y < 1.47) return 'zip';
    if (out.cardigan && part === 'body' && Z > 0.03 && Y > 1.0 && Y < 1.47) {
      const w = 0.03 + Math.max(0, (Y - 1.12)) * 0.25;
      if (ax < w) return 'shirt';
      if (ax < w + 0.012) return 'lapel';
    }
    if (out.pocketsCoat && part === 'body' && Z > 0.05 && ax > 0.07 && ax < 0.13 && Y > 1.0 && Y < 1.012) return 'lapel';
    return col;
  }

  return { S, s, J, prims, sockets, paint, eye: { x: eyeX * s, y: eyeY * s, z: eyeZ * s, r: 0.0148 * s } };
}

// ---------- meshing ----------
function sdfFor(C, part) {
  const ps = C.prims.filter(p => p.part === part);
  return {
    d(x, y, z) {
      let d = 1e9;
      for (const p of ps) d = smin(d, p.f(x, y, z), p.k * C.s);
      if (part === 'head') for (const sk of C.sockets) d = smax(d, -sk(x, y, z), 0.01 * C.s);
      return d;
    },
    // nearest primitives: colour and bones
    near(x, y, z) {
      let best = null, bd = 1e9; const ds = [];
      for (const p of ps) { const v = p.f(x, y, z); ds.push(v); if (v < bd) { bd = v; best = p; } }
      return { best, bd, ds, ps };
    }
  };
}

function surfaceNets(F, lo, hi, cell) {
  const nx = Math.ceil((hi[0] - lo[0]) / cell) + 1, ny = Math.ceil((hi[1] - lo[1]) / cell) + 1, nz = Math.ceil((hi[2] - lo[2]) / cell) + 1;
  const G = new Float32Array(nx * ny * nz);
  const id = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) G[id(i, j, k)] = F(lo[0] + i * cell, lo[1] + j * cell, lo[2] + k * cell);
  const vid = new Int32Array(nx * ny * nz).fill(-1);
  const verts = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const v = C.map(c => G[id(i + c[0], j + c[1], k + c[2])]);
    let pos = 0, neg = 0; for (const x of v) { if (x < 0) neg++; else pos++; }
    if (!pos || !neg) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      sx += C[a][0] + (C[b][0] - C[a][0]) * t; sy += C[a][1] + (C[b][1] - C[a][1]) * t; sz += C[a][2] + (C[b][2] - C[a][2]) * t; n++;
    }
    vid[id(i, j, k)] = verts.length;
    verts.push([lo[0] + (i + sx / n) * cell, lo[1] + (j + sy / n) * cell, lo[2] + (k + sz / n) * cell]);
  }
  const tris = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) tris.push(a, c, b, a, d, c); else tris.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = G[id(i, j, k)], b = G[id(i + 1, j, k)]; if ((a < 0) === (b < 0)) continue;
    quad(vid[id(i, j - 1, k - 1)], vid[id(i, j, k - 1)], vid[id(i, j, k)], vid[id(i, j - 1, k)], a < 0);
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = G[id(i, j, k)], b = G[id(i, j + 1, k)]; if ((a < 0) === (b < 0)) continue;
    quad(vid[id(i - 1, j, k - 1)], vid[id(i - 1, j, k)], vid[id(i, j, k)], vid[id(i, j, k - 1)], a < 0);
  }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = G[id(i, j, k)], b = G[id(i, j, k + 1)]; if ((a < 0) === (b < 0)) continue;
    quad(vid[id(i - 1, j - 1, k)], vid[id(i, j - 1, k)], vid[id(i, j, k)], vid[id(i - 1, j, k)], a < 0);
  }
  return { verts, tris };
}

// gentle smoothing that keeps volume (Taubin), then reproject toward the surface
function smooth(M, F, iters = 2) {
  const n = M.verts.length, nb = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < M.tris.length; t += 3) { const a = M.tris[t], b = M.tris[t + 1], c = M.tris[t + 2]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
  const step = lam => {
    const nv = M.verts.map((v, i) => { if (!nb[i].size) return v; let x = 0, y = 0, z = 0; for (const j of nb[i]) { x += M.verts[j][0]; y += M.verts[j][1]; z += M.verts[j][2]; } const m = nb[i].size; return [v[0] + lam * (x / m - v[0]), v[1] + lam * (y / m - v[1]), v[2] + lam * (z / m - v[2])]; });
    M.verts = nv;
  };
  for (let i = 0; i < iters; i++) { step(0.5); step(-0.52); }
  // one Newton step back onto the zero set
  M.verts = M.verts.map(v => { const g = grad(F, v), d = F(...v); return [v[0] - g[0] * d, v[1] - g[1] * d, v[2] - g[2] * d]; });
}
function grad(F, v, e = 0.0006) {
  const gx = F(v[0] + e, v[1], v[2]) - F(v[0] - e, v[1], v[2]), gy = F(v[0], v[1] + e, v[2]) - F(v[0], v[1] - e, v[2]), gz = F(v[0], v[1], v[2] + e) - F(v[0], v[1], v[2] - e);
  const l = Math.hypot(gx, gy, gz) || 1; return [gx / l, gy / l, gz / l];
}

function buildMesh(C, part, cell, lo, hi, palette) {
  const sdf = sdfFor(C, part);
  const F = (x, y, z) => sdf.d(x, y, z);
  const M = surfaceNets(F, lo, hi, cell);
  smooth(M, F, 2);
  const nV = M.verts.length;
  const pos = new Float32Array(nV * 3), nor = new Float32Array(nV * 3), col = new Uint8Array(nV), bon = new Uint8Array(nV * 2), wt = new Uint8Array(nV);
  M.verts.forEach((v, i) => {
    pos.set(v, i * 3); nor.set(grad(F, v), i * 3);
    const nr = sdf.near(...v);
    const key = C.paint(nr.best.col, v[0], v[1], v[2], part);
    col[i] = palette.indexOf(key) >= 0 ? palette.indexOf(key) : palette.indexOf('skin');
    // skin weights from the primitives near this point, summed per bone
    const acc = {};
    const band = 0.03 * C.s;
    nr.ps.forEach((p, j) => { const dd = nr.ds[j] - nr.bd; if (dd > band) return; const w = Math.exp(-dd / (0.012 * C.s)); acc[p.bone] = (acc[p.bone] || 0) + w; });
    const top = Object.entries(acc).sort((a, b) => b[1] - a[1]);
    const b0 = +top[0][0], w0 = top[0][1], b1 = top[1] ? +top[1][0] : b0, w1 = top[1] ? top[1][1] : 0;
    bon[i * 2] = b0; bon[i * 2 + 1] = b1; wt[i] = Math.round(255 * w0 / (w0 + w1));
  });
  return { nV, pos, nor, col, bon, wt, idx: Uint32Array.from(M.tris) };
}

// simplify (keeping colour regions and normals), reorder for the vertex cache, quantize, compress
function pack(m, targetTris, palRGB) {
  const attr = new Float32Array(m.nV * 6);
  for (let i = 0; i < m.nV; i++) { attr.set(m.nor.subarray(i * 3, i * 3 + 3), i * 6); const c = palRGB[m.col[i]]; attr[i * 6 + 3] = c[0]; attr[i * 6 + 4] = c[1]; attr[i * 6 + 5] = c[2]; }
  const lock = new Uint8Array(m.nV);
  const [idx0] = SIMP.simplifyWithAttributes(m.idx, m.pos, 3, attr, 6, [0.25, 0.25, 0.25, 2, 2, 2], lock, targetTris * 3, 0.004);
  // reorder for the vertex cache and fetch: indices are rewritten in place, remap is old to new
  const idx1 = idx0.slice(); const [remapU, n] = ENC.reorderMesh(idx1, true, false);
  const remap = Int32Array.from(remapU, x => (x === 0xffffffff ? -1 : x));
  if (n > 65535) throw new Error('too many vertices ' + n);
  const stride = 16, vb = new Uint8Array(n * stride), dv = new DataView(vb.buffer);
  for (let i = 0; i < m.nV; i++) {
    const j = remap[i]; if (j < 0) continue; const o = j * stride;
    for (let a = 0; a < 3; a++) dv.setInt16(o + a * 2, Math.round(m.pos[i * 3 + a] * 8000), true);
    for (let a = 0; a < 3; a++) dv.setInt8(o + 8 + a, Math.round(m.nor[i * 3 + a] * 127));
    dv.setUint8(o + 11, m.col[i]); dv.setUint8(o + 12, m.bon[i * 2]); dv.setUint8(o + 13, m.bon[i * 2 + 1]); dv.setUint8(o + 14, m.wt[i]);
  }
  const ib = idx1;
  const vEnc = ENC.encodeVertexBuffer(vb, n, stride), iEnc = ENC.encodeIndexBuffer(new Uint8Array(ib.buffer), ib.length, 4);
  return { nV: n, nI: ib.length, vEnc, iEnc };
}

// ---------- the cast ----------
const SKIN_J = '#5f3d2b';
const CAST = {
  jason: {
    h: 1.8, build: 1, limb: 1,
    head: { hair: 'short', beard: 'goatee', nose: 0.002, noseW: 1.12, jaw: 1.0, chin: 1.0 },
    outfit: { suit: true, top: 'suit', pants: 'suit', shoe: 'shoe', sole: 'sole', collar: 'shirt', cuff: 'shirt', skirt: true },
    palette: { skin: SKIN_J, hair: '#121011', beard: '#17110f', lip: '#6e4038', suit: '#1f382d', lapel: '#1a2f26', shirt: '#e9e6de', tie: '#22463a', button: '#0f1a15', pocket: '#e9e6de', shoe: '#17120f', sole: '#0c0a09' },
    glasses: 'browline', studs: true
  },
  'jason-memory': {
    h: 1.8, headKey: 'jason', build: 1, limb: 1.04,
    head: { hair: 'short', beard: 'goatee', nose: 0.002, noseW: 1.12 },
    outfit: { top: 'hoodie', pants: 'jeans', shoe: 'sneaker', sole: 'sole', hoodDown: true, zip: true, flare: false },
    palette: { skin: SKIN_J, hair: '#121011', beard: '#17110f', lip: '#6e4038', hoodie: '#5a5d58', jeans: '#2c3546', sneaker: '#d8d2c6', sole: '#efe9dd', zip: '#3c3f3b' },
    glasses: 'browline'
  },
  player: {
    h: 1.72, build: 0.95, limb: 0.97,
    head: { hair: 'short', hood: true, noseW: 0.95, jaw: 0.95 },
    outfit: { top: 'coat', hoodC: 'coat', pants: 'jeans', shoe: 'sneaker', sole: 'sole', longcoat: true, zip: true, pocketsCoat: true },
    palette: { skin: '#8f6446', hair: '#2a1d16', lip: '#7a4a3e', coat: '#8a6328', lapel: '#6e4e1e', zip: '#4a3614', jeans: '#283041', sneaker: '#d5d0c6', sole: '#ece6da' }
  },
  dell: {
    h: 1.74, build: 1.08, limb: 1.05, belly: 0.025,
    head: { hair: 'cap', beard: 'full', jaw: 1.05, noseW: 1.15, nose: 0.004, neck: 1.1 },
    outfit: { top: 'jacket', pants: 'work', shoe: 'boot', sole: 'sole', jacketCollar: true, zip: true },
    palette: { skin: '#7a5038', hair: '#8f8a82', beard: '#a39d93', lip: '#6b4236', jacket: '#3a4232', work: '#2a2b28', boot: '#2b2119', sole: '#141110', hat: '#34342f', zip: '#24281f' },
    umbrella: true
  },
  renata: {
    h: 1.66, build: 0.9, limb: 0.9, hipsW: 1.05,
    head: { hair: 'bun', jaw: 0.92, chin: 0.9, noseW: 0.9, neck: 0.92 },
    outfit: { top: 'cardigan', pants: 'slacks', shoe: 'flat', sole: 'sole', cardigan: true, scarf: 'scarf' },
    palette: { skin: '#b0805c', hair: '#24170f', lip: '#8a4f48', cardigan: '#7d5a3e', lapel: '#6a4b33', shirt: '#e3dccd', slacks: '#25303c', flat: '#2a1f1a', sole: '#16110e', scarf: '#3e5a55' }
  }
};

fs.mkdirSync(OUTDIR, { recursive: true });
const manifest = { v: V, scale: 1 / 8000, bones: BONES, parent: PARENT, chars: {} };
const chunks = []; let offset = 0;
const push = arr => { const b = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength); const pad = (4 - (b.length % 4)) % 4; chunks.push(b, Buffer.alloc(pad)); const o = offset; offset += b.length + pad; return [o, arr.length]; };
const only = process.argv[2];
const headCache = {};
for (const [name, spec] of Object.entries(CAST)) {
  if (only && only !== name) continue;
  const t0 = Date.now();
  const C = character(spec);
  const palette = Object.keys(spec.palette);
  const s = C.s;
  const neckCut = 1.48 * s;
  const palRGB = Object.values(spec.palette).map(h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16) / 255));
  const body = pack(buildMesh(C, 'body', 0.0105 * s, [-0.42 * s, -0.01, -0.3 * s], [0.42 * s, neckCut + 0.06 * s, 0.32 * s], palette), 9000, palRGB);
  const head = headCache[spec.headKey || name] || pack(buildMesh(C, 'head', 0.0048 * s, [-0.15 * s, neckCut - 0.08 * s, -0.17 * s], [0.15 * s, 1.86 * s, 0.17 * s], palette), 7000, palRGB);
  headCache[spec.headKey || name] = head;
  const meshes = {};
  for (const [k, m] of Object.entries({ body, head })) meshes[k] = m.ref || (m.ref = { nV: m.nV, nI: m.nI, v: push(m.vEnc), i: push(m.iEnc) });
  manifest.chars[name] = {
    h: spec.h, palette: Object.values(spec.palette), keys: palette, joints: BONES.map(b => C.J[b].map(v => +v.toFixed(5))),
    eye: Object.fromEntries(Object.entries(C.eye).map(([k, v]) => [k, +v.toFixed(5)])), meshes,
    glasses: spec.glasses || null, studs: !!spec.studs, umbrella: !!spec.umbrella, hood: !!(spec.head && spec.head.hood)
  };
  console.log(`cast: ${name} body ${body.nV} verts ${body.nI / 3} tris, head ${head.nV} verts ${head.nI / 3} tris, ${Date.now() - t0} ms`);
}
const bin = Buffer.concat(chunks);
fs.writeFileSync(path.join(OUTDIR, `cast-${V}.bin`), bin);
fs.writeFileSync(path.join(OUTDIR, `cast-${V}.json`), JSON.stringify(manifest));
console.log(`cast: ${(bin.length / 1024).toFixed(0)} KB binary`);
