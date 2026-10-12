// After Hours: the cast's motion. Takes the clips the episode uses from
// Quaternius's Universal Animation Library 1 and 2 (CC0, quaternius.com, the
// "Standard" Unreal-Godot GLBs, in-place versions) and writes one shared clip
// file: the source skeleton (no mesh) and its animations, compressed with
// gltfpack (meshoptimizer, MIT). story/people.js retargets them at runtime onto
// each character's game_engine rig, so every person shares the same file.
//   node tools/story/clips.mjs <UAL1_Standard.glb> <UAL2_Standard.glb> [v]
// Writes assets/story/cast/clips-<v>.glb.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const [ual1, ual2, v = 'v2'] = process.argv.slice(2);
if (!ual1 || !ual2) { console.error('usage: node tools/story/clips.mjs <UAL1_Standard.glb> <UAL2_Standard.glb> [v]'); process.exit(1); }

// the clips the episode uses: our name <- the library's name
export const CLIPS = {
  idle: 'Idle_Loop', talk: 'Idle_Talking_Loop', phone: 'Idle_TalkingPhone_Loop', fold: 'Idle_FoldArms_Loop',
  no: 'Idle_No_Loop', yes: 'Yes', walk: 'Walk_Loop', walkf: 'Walk_Formal_Loop', jog: 'Jog_Fwd_Loop',
  sitIn: 'Sitting_Enter', sit: 'Sitting_Idle_Loop', sitTalk: 'Sitting_Talking_Loop', sitOut: 'Sitting_Exit',
  interact: 'Interact', pickup: 'PickUp_Table', lantern: 'Idle_Lantern_Loop', rail: 'Idle_Rail_Loop'
};

function readGlb(f) {
  const b = fs.readFileSync(f);
  const len = b.readUInt32LE(12); const j = JSON.parse(b.slice(20, 20 + len).toString());
  const bin = b.slice(20 + len + 8);
  const N = { SCALAR: 1, VEC3: 3, VEC4: 4 };
  j.read = i => {
    const a = j.accessors[i], bv = j.bufferViews[a.bufferView], n = N[a.type];
    if (a.componentType !== 5126) throw new Error('unexpected component type ' + a.componentType);
    const off = (bv.byteOffset || 0) + (a.byteOffset || 0), st = bv.byteStride || n * 4, out = new Float32Array(a.count * n);
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = bin.readFloatLE(off + k * st + c * 4);
    return out;
  };
  return j;
}

const A = readGlb(ual1), B = readGlb(ual2);
// the skeleton: the Armature node and everything under it, minus meshes and leaf bones
const keep = [], idx = new Map();
(function walk(i) {
  const n = A.nodes[i];
  if (n.mesh != null || /_leaf_/.test(n.name)) return;
  idx.set(i, keep.length); keep.push(i);
  for (const c of n.children || []) walk(c);
})(A.nodes.findIndex(n => n.name === 'Armature'));
const nodes = keep.map(i => {
  const n = A.nodes[i], o = { name: n.name };
  for (const k of ['translation', 'rotation', 'scale']) if (n[k]) o[k] = n[k];
  const ch = (n.children || []).filter(c => idx.has(c)).map(c => idx.get(c));
  if (ch.length) o.children = ch;
  return o;
});
const byName = new Map(nodes.map((n, i) => [n.name, i]));

const chunks = []; let off = 0;
const accessors = [], bufferViews = [];
function put(arr, type, minmax) {
  const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  bufferViews.push({ buffer: 0, byteOffset: off, byteLength: buf.length });
  chunks.push(buf); off += buf.length; while (off % 4) { chunks.push(Buffer.alloc(1)); off++; }
  const n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type], acc = { bufferView: bufferViews.length - 1, componentType: 5126, count: arr.length / n, type };
  if (minmax) { acc.min = [Math.min(...arr)]; acc.max = [Math.max(...arr)]; }
  accessors.push(acc); return accessors.length - 1;
}

const animations = [];
for (const [ours, theirs] of Object.entries(CLIPS)) {
  const src = A.animations.find(a => a.name === theirs) ? A : B;
  const a = src.animations.find(x => x.name === theirs);
  if (!a) throw new Error('missing clip ' + theirs);
  const samplers = [], channels = [];
  for (const c of a.channels) {
    const name = src.nodes[c.target.node].name;
    if (!byName.has(name)) continue;
    // rotations for every bone; translation only for the pelvis (the clips are in place)
    if (c.target.path === 'scale') continue;
    if (c.target.path === 'translation' && name !== 'pelvis') continue;
    const s = a.samplers[c.sampler];
    const t = src.read(s.input), val = src.read(s.output);
    samplers.push({ input: put(t, 'SCALAR', true), output: put(val, c.target.path === 'rotation' ? 'VEC4' : 'VEC3'), interpolation: s.interpolation || 'LINEAR' });
    channels.push({ sampler: samplers.length - 1, target: { node: byName.get(name), path: c.target.path } });
  }
  animations.push({ name: ours, samplers, channels });
}

const json = {
  asset: { version: '2.0', generator: 'tools/story/clips.mjs', copyright: 'Animations: Universal Animation Library 1 and 2 by Quaternius, CC0 1.0' },
  scene: 0, scenes: [{ nodes: [0] }], nodes, animations, accessors, bufferViews,
  buffers: [{ byteLength: off }]
};
const bin = Buffer.concat(chunks);
let js = Buffer.from(JSON.stringify(json)); while (js.length % 4) js = Buffer.concat([js, Buffer.from(' ')]);
const glb = Buffer.alloc(12 + 8 + js.length + 8 + bin.length);
glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8);
glb.writeUInt32LE(js.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); js.copy(glb, 20);
glb.writeUInt32LE(bin.length, 20 + js.length); glb.writeUInt32LE(0x004e4942, 24 + js.length); bin.copy(glb, 28 + js.length);
const raw = path.join(os.tmpdir(), 'clips-raw.glb');
fs.writeFileSync(raw, glb);
const dst = path.join(ROOT, 'assets', 'story', 'cast', `clips-${v}.glb`);
// rotations at 14 bits keep the fingers and the slow idles free of stepping
execFileSync(path.join(HERE, 'node_modules', '.bin', 'gltfpack'), ['-i', raw, '-o', dst, '-cc', '-kn', '-ar', '14', '-at', '16', '-af', '30'], { stdio: 'inherit' });
console.log('clips:', Object.keys(CLIPS).length, (glb.length / 1024).toFixed(0), 'KB raw ->', (fs.statSync(dst).size / 1024).toFixed(0), 'KB', dst);
