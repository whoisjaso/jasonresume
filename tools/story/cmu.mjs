// After Hours: motion capture from the CMU Graphics Lab Motion Capture Database
// (mocap.cs.cmu.edu; "The motion capture data may be copied, modified, or
// redistributed without permission." The database was created with funding from
// NSF EIA-0196217). Reads a subject's ASF skeleton and a trial's AMC motion,
// finds a clean gait cycle, and retargets it onto the Universal Animation
// Library skeleton the episode's clips use, as an in-place loop. clips.mjs
// calls it; nothing here ships.
import * as THREE from '../../vendor/three-0.184.0/three.module.min.js';

const DEG = Math.PI / 180;
export const UNIT = (1 / 0.45) * 0.0254; // ASF length units to metres

export function parseASF(text) {
  const bones = { root: { name: 'root', dir: new THREE.Vector3(0, 1, 0), len: 0, axis: [0, 0, 0], dof: ['rx', 'ry', 'rz'], children: [] } };
  const lines = text.split(/\r?\n/);
  let i = 0, sec = '';
  while (i < lines.length) {
    const L = lines[i].trim();
    if (L.startsWith(':')) { sec = L.split(/\s+/)[0]; i++; continue; }
    if (sec === ':bonedata' && L === 'begin') {
      const b = { children: [], dof: [] };
      while (lines[++i].trim() !== 'end') {
        const t = lines[i].trim().split(/\s+/);
        if (t[0] === 'name') b.name = t[1];
        else if (t[0] === 'direction') b.dir = new THREE.Vector3(+t[1], +t[2], +t[3]).normalize();
        else if (t[0] === 'length') b.len = +t[1] * UNIT;
        else if (t[0] === 'axis') b.axis = [+t[1], +t[2], +t[3]];
        else if (t[0] === 'dof') b.dof = t.slice(1);
      }
      bones[b.name] = b; i++; continue;
    }
    if (sec === ':hierarchy' && L && L !== 'begin' && L !== 'end') {
      const [p, ...cs] = L.split(/\s+/);
      for (const c of cs) { bones[c].parent = p; bones[p].children.push(c); }
    }
    i++;
  }
  for (const b of Object.values(bones)) { b.C = new THREE.Quaternion().setFromEuler(new THREE.Euler(b.axis[0] * DEG, b.axis[1] * DEG, b.axis[2] * DEG, 'ZYX')); b.Ci = b.C.clone().invert(); }
  return bones;
}

export function parseAMC(text) {
  const frames = []; let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const L = line.trim();
    if (!L || L.startsWith('#') || L.startsWith(':')) continue;
    if (/^\d+$/.test(L)) { cur = {}; frames.push(cur); continue; }
    const [n, ...v] = L.split(/\s+/); if (cur) cur[n] = v.map(Number);
  }
  return frames;
}

/* one frame: each bone's world rotation (from the ASF rest frame) and its start and end points, in metres */
export function pose(asf, fr) {
  const out = {};
  const walk = (name, pq, pend) => {
    const b = asf[name], v = fr[name] || [];
    let rx = 0, ry = 0, rz = 0, tx = 0, ty = 0, tz = 0;
    if (name === 'root') { [tx, ty, tz, rx, ry, rz] = v; }
    else b.dof.forEach((d, k) => { if (d === 'rx') rx = v[k]; else if (d === 'ry') ry = v[k]; else if (d === 'rz') rz = v[k]; });
    const R = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx * DEG, ry * DEG, rz * DEG, 'ZYX'));
    const q = (pq ? pq.clone() : new THREE.Quaternion()).multiply(b.C).multiply(R).multiply(b.Ci);
    const start = name === 'root' ? new THREE.Vector3(tx, ty, tz).multiplyScalar(UNIT) : pend.clone();
    const end = start.clone().add(b.dir.clone().multiplyScalar(b.len).applyQuaternion(q));
    out[name] = { q, start, end };
    for (const c of b.children) walk(c, q, end);
  };
  walk('root', null, null);
  return out;
}

// which CMU bone drives which library bone, and the direction that bone's segment has at rest
export const MAP = {
  pelvis: 'root', spine_01: 'lowerback', spine_02: 'upperback', spine_03: 'thorax', neck_01: 'lowerneck', Head: 'head',
  clavicle_l: 'lclavicle', upperarm_l: 'lhumerus', lowerarm_l: 'lradius', hand_l: 'lhand',
  clavicle_r: 'rclavicle', upperarm_r: 'rhumerus', lowerarm_r: 'rradius', hand_r: 'rhand',
  thigh_l: 'lfemur', calf_l: 'ltibia', foot_l: 'lfoot', ball_l: 'ltoes',
  thigh_r: 'rfemur', calf_r: 'rtibia', foot_r: 'rfoot', ball_r: 'rtoes'
};

/* The library skeleton (from its GLB nodes): names, parents, rest locals, rest world frames */
export function ualSkeleton(nodes) {
  const arm = nodes.findIndex(n => n.name === 'Armature');
  const names = [], parent = [], lq = [], lp = [];
  (function walk(i, p) {
    const n = nodes[i]; if (n.mesh != null || /_leaf_/.test(n.name)) return;
    const k = names.length; names.push(n.name); parent.push(p);
    lq.push(new THREE.Quaternion().fromArray(n.rotation || [0, 0, 0, 1])); lp.push(new THREE.Vector3().fromArray(n.translation || [0, 0, 0]));
    for (const c of n.children || []) walk(c, k);
  })(arm, -1);
  const wq = [], wp = [];
  names.forEach((_, i) => { const p = parent[i]; if (p < 0) { wq.push(lq[i].clone()); wp.push(lp[i].clone()); } else { wq.push(wq[p].clone().multiply(lq[i])); wp.push(lp[i].clone().applyQuaternion(wq[p]).add(wp[p])); } });
  const ix = {}; names.forEach((n, i) => (ix[n] = i));
  return { names, parent, lq, lp, wq, wp, ix };
}

const CHILD = { pelvis: 'spine_01', spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'neck_01', neck_01: 'Head', clavicle_l: 'upperarm_l', upperarm_l: 'lowerarm_l', lowerarm_l: 'hand_l', hand_l: 'middle_01_l', clavicle_r: 'upperarm_r', upperarm_r: 'lowerarm_r', lowerarm_r: 'hand_r', hand_r: 'middle_01_r', thigh_l: 'calf_l', calf_l: 'foot_l', foot_l: 'ball_l', thigh_r: 'calf_r', calf_r: 'foot_r', foot_r: 'ball_r' };

/* Retarget a CMU trial's frames [a, b] (at 120 Hz) onto the library skeleton, resampled at fps.
   keep: the library pose (local quaternions) to hold for the bones CMU doesn't drive (fingers).
   Returns { t, rot: {bone: Float32Array}, pel: Float32Array, dist } with the loop closed and the travel removed. */
export function retarget(asf, frames, a, b, S, keep, o = {}) {
  const fps = o.fps || 30, src = o.src || 120;
  const n = Math.round(((b - a) / src) * fps) + 1;
  // the library's rest directions and the CMU rest directions per mapped bone
  const align = {};
  for (const [u, c] of Object.entries(MAP)) {
    const i = S.ix[u];
    let du;
    if (CHILD[u]) du = S.wp[S.ix[CHILD[u]]].clone().sub(S.wp[i]).normalize();
    else du = null;
    const dc = c === 'root' ? new THREE.Vector3(0, 1, 0) : asf[c].dir.clone();
    align[u] = du ? new THREE.Quaternion().setFromUnitVectors(dc, du) : null;
  }
  // leaves take their parent's alignment
  for (const u of Object.keys(MAP)) if (!align[u]) align[u] = align[S.names[S.parent[S.ix[u]]]] || new THREE.Quaternion();
  // proportions: the CMU leg (hip joint to ankle) to the library's
  const leg = asf.lfemur.len + asf.ltibia.len;
  const uleg = S.wp[S.ix.calf_l].distanceTo(S.wp[S.ix.thigh_l]) + S.wp[S.ix.foot_l].distanceTo(S.wp[S.ix.calf_l]);
  const scale = uleg / leg;
  // the library's pelvis sits this far from the middle of its hip joints, in the pelvis's own frame
  const hipMid0 = S.wp[S.ix.thigh_l].clone().add(S.wp[S.ix.thigh_r]).multiplyScalar(0.5);
  const pelOff = S.wp[S.ix.pelvis].clone().sub(hipMid0).applyQuaternion(S.wq[S.ix.pelvis].clone().invert());
  // sample CMU at the output times (linear between captured frames)
  const at = f => { const x = a + (f / (n - 1)) * (b - a), k = Math.min(frames.length - 2, Math.floor(x)), u = x - k; return { k, u }; };
  const P = [];
  for (let f = 0; f < n; f++) {
    const { k, u } = at(f), p0 = pose(asf, frames[k]), p1 = pose(asf, frames[k + 1]), m = {};
    for (const name of Object.keys(p0)) m[name] = { q: p0[name].q.clone().slerp(p1[name].q, u), start: p0[name].start.clone().lerp(p1[name].start, u), end: p0[name].end.clone().lerp(p1[name].end, u) };
    P.push(m);
  }
  // heading: the travel over the cycle, turned onto +z
  const mid = m => m.lhipjoint.end.clone().add(m.rhipjoint.end).multiplyScalar(0.5);
  const loop = o.loop !== false;
  let r0 = mid(P[0]), r1 = mid(P[n - 1]), trav = r1.clone().sub(r0); trav.y = 0;
  let yaw;
  if (o.walk !== false) yaw = Math.atan2(trav.x, trav.z);
  else {
    // standing: face the way the hips face on average, and stay where the hips are on average
    const f = new THREE.Vector3(); for (const m of P) f.add(new THREE.Vector3(0, 0, 1).applyQuaternion(m.root.q).setY(0).normalize());
    yaw = Math.atan2(f.x, f.z);
    r0 = new THREE.Vector3(); for (const m of P) r0.add(mid(m)); r0.multiplyScalar(1 / n); trav.set(0, 0, 0);
  }
  const H = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
  const dist = trav.length() * scale;
  // the ground: the lower of the ankles' lowest points sits where the library's walk puts it
  let ankleMin = Infinity; for (const m of P) ankleMin = Math.min(ankleMin, m.ltibia.end.y, m.rtibia.end.y);
  const groundTo = o.ankle != null ? o.ankle : S.wp[S.ix.foot_l].y;
  const rot = {}, pel = new Float32Array(n * 3);
  for (const nm of S.names) rot[nm] = new Float32Array(n * 4);
  const wq = S.names.map(() => new THREE.Quaternion());
  for (let f = 0; f < n; f++) {
    const m = P[f], u = f / (n - 1);
    S.names.forEach((nm, i) => {
      const c = MAP[nm], p = S.parent[i];
      let lq;
      if (c) { wq[i].copy(H).multiply(m[c].q).multiply(align[nm].clone().invert()).multiply(S.wq[i]); lq = (p < 0 ? new THREE.Quaternion() : wq[p].clone().invert()).multiply(wq[i]); }
      else { lq = (keep[nm] || S.lq[i]).clone(); wq[i].copy(p < 0 ? new THREE.Quaternion() : wq[p]).multiply(lq); }
      lq.toArray(rot[nm], f * 4);
    });
    // the hips: the middle of the hip joints, travel removed (linear), scaled, on the ground; the pelvis hangs from it
    const hm = mid(m), rp = hm.clone().sub(r0).applyQuaternion(H).multiplyScalar(scale);
    rp.z -= dist * u;
    rp.y = (hm.y - ankleMin) * scale + groundTo;
    rp.add(pelOff.clone().applyQuaternion(wq[S.ix.pelvis]));
    const ri = S.ix.root, pw = S.wp[ri], pq = S.wq[ri].clone().invert();
    const loc = rp.clone().sub(pw).applyQuaternion(pq);
    pel[f * 3] = loc.x; pel[f * 3 + 1] = loc.y; pel[f * 3 + 2] = loc.z;
  }
  // close the loop: spread each bone's end-to-start mismatch over the cycle
  if (loop) for (const nm of S.names) {
    const r = rot[nm], q0 = new THREE.Quaternion().fromArray(r, 0), q1 = new THREE.Quaternion().fromArray(r, (n - 1) * 4);
    const e = q0.clone().multiply(q1.clone().invert());
    for (let f = 0; f < n; f++) {
      const q = new THREE.Quaternion().fromArray(r, f * 4);
      const d = new THREE.Quaternion().slerp(e, f / (n - 1));
      d.multiply(q).normalize().toArray(r, f * 4);
    }
    for (let f = 1; f < n; f++) { const qa = new THREE.Quaternion().fromArray(r, (f - 1) * 4), qb = new THREE.Quaternion().fromArray(r, f * 4); if (qa.dot(qb) < 0) { qb.set(-qb.x, -qb.y, -qb.z, -qb.w); qb.toArray(r, f * 4); } }
  }
  if (loop) for (let k = 0; k < 3; k++) { const d = pel[k] - pel[(n - 1) * 3 + k]; for (let f = 0; f < n; f++) pel[f * 3 + k] += d * (f / (n - 1)); }
  for (const nm of S.names) { const r = rot[nm]; for (let f = 1; f < n; f++) { const qa = new THREE.Quaternion().fromArray(r, (f - 1) * 4), qb = new THREE.Quaternion().fromArray(r, f * 4); if (qa.dot(qb) < 0) { qb.set(-qb.x, -qb.y, -qb.z, -qb.w); qb.toArray(r, f * 4); } } }
  const t = new Float32Array(n); for (let f = 0; f < n; f++) t[f] = f / fps;
  return { t, rot, pel, dist, dur: (n - 1) / fps };
}

/* heel strikes of one foot in a trial (frame indices at 120 Hz): the ankle comes down and stops */
export function heelStrikes(asf, frames, side = 'l') {
  const y = [], vz = [];
  let prev = null;
  for (let f = 0; f < frames.length; f++) { const p = pose(asf, frames[f]), A = p[side + 'tibia'].end; y.push(A.y); vz.push(prev ? A.clone().sub(prev).setY(0).length() * 120 : 0); prev = A; }
  const lo = Math.min(...y);
  const hs = [];
  for (let f = 2; f < y.length; f++) {
    const c = y[f] < lo + 0.035 && vz[f] < 0.6, cp = y[f - 1] < lo + 0.035 && vz[f - 1] < 0.6;
    if (c && !cp && (!hs.length || f - hs[hs.length - 1] > 40)) hs.push(f);
  }
  return { hs, y, vz };
}
