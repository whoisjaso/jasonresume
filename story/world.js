/* After Hours: the sets. The lot, the office and the library, built in code
   around first-party models and CC0 textures, lit by the shared lamps in
   story/paint.js. Each builder returns a group, the lamps that light it, the
   spots you can interact with, the walls you can't walk through, where people
   stand, and the hooks the rest of the episode reads (see
   tools/story/HANDOFF-world.md): surfaceAt(x, z) for footsteps, puddles, sounds
   (where things hum, idle and drip), nav, and ready (a promise that settles when
   the set's streamed assets are in).

   The lot: Triple J at night on Almeda Genoa Road. Wet asphalt with cracks,
   oil and puddles that mirror the lamps, painted bays, curbs and wheel stops,
   sodium lamps with their cones, rows of used cars (tools/story/world/cars.py),
   the showroom glowing, the sign, the sold board, the fence and the gate, palms
   and the city glow beyond.
   The office: the sale desk, the phone, the filing cabinet, the whiteboard, the
   laptop, the ledger, the shelf with the book, the break room's arcade cabinet,
   and a window onto the lot with the rain running down it.
   The library: a memory. Long tables, green lamps, the stacks, one desk.
   The morning lot: the same lot, dry, in the sun, lamps off (a memory too). */
import * as THREE from "../vendor/three-0.184.0/three.module.min.js";
import { paint as paint0, glow as glow0, coneMat as coneMat0, blobMat as blobMat0, pbr as pbr0, U } from "./paint.js";
import * as TX from "./tex.js";
import { mergeGeometries, mergeVertices } from "../vendor/three-0.184.0/addons/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "../vendor/three-0.184.0/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "../vendor/meshopt-0.22.0/meshopt_decoder.module.js";

/* the quality ladder's asset half: phones get the lighter cars and smaller textures; ?wq=lo|hi forces one */
const COARSE = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
const WQ = (typeof location !== "undefined" && (location.search.match(/[?&]wq=(lo|hi)/) || [])[1]) || (COARSE ? "lo" : "hi");
export const TIER = { name: WQ, carLo: WQ === "lo", tex: WQ === "lo" ? 512 : 1024, env: WQ === "lo" ? 64 : 128 };
const BASE = new URL("../assets/story/world/", import.meta.url).href;
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const texLoader = new THREE.TextureLoader();
const texCache = new Map();
/* a texture from assets/story/world, tiled, sRGB for colour and linear for data; resolves even when it fails (null) */
function loadTex(name, o = {}) {
  const url = BASE + name.replace("{s}", String(TIER.tex));
  if (texCache.has(url)) return texCache.get(url);
  const p = new Promise(res => texLoader.load(url, t => {
    t.colorSpace = o.data ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    res(t);
  }, undefined, () => res(null)));
  texCache.set(url, p); return p;
}
const T = {}; // loaded textures by key
async function loadSetTex(list) { await Promise.all(Object.entries(list).map(async ([k, [n, o]]) => { if (!(k in T)) T[k] = await loadTex(n, o); })); }
const LOT_TEX = {
  asphC: ["asphalt_col_{s}.webp"], asphN: ["asphalt_nor_512.webp", { data: true }], asphR: ["asphalt_arm_512.webp", { data: true }],
  concC: ["concrete_col_512.webp"], concN: ["concrete_nor_512.webp", { data: true }], concR: ["concrete_arm_512.webp", { data: true }]
};
const ROOM_TEX = {
  plasC: ["plaster_col_{s}.webp"], plasN: ["plaster_nor_512.webp", { data: true }],
  woodC: ["wood_col_{s}.webp"], woodN: ["wood_nor_512.webp", { data: true }], woodR: ["wood_arm_512.webp", { data: true }],
  carpC: ["carpet_col_{s}.webp"], carpN: ["carpet_nor_512.webp", { data: true }],
  floorC: ["floor_col_{s}.webp"], floorN: ["floor_nor_512.webp", { data: true }], floorR: ["floor_arm_512.webp", { data: true }],
  fabC: ["fabric_col_512.webp"], fabN: ["fabric_nor_512.webp", { data: true }]
};
/* the set's reflections: once the set is on screen, render a small cube from where the camera spends its time,
   blur it through the mips, and hand it to every PBR surface (uEnv). Each set keeps its own; the hook swaps it in. */
function envHook(set, at) {
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false }));
  m.frustumCulled = false; m.userData.keep = true; m.layers.enableAll(); m.renderOrder = -10;
  let pending = false;
  m.onBeforeRender = renderer => {
    const ud = set.userData;
    if (ud.envTex) { if (U.uEnv.value !== ud.envTex) { U.uEnv.value = ud.envTex; U.uEnvMax.value = Math.log2(TIER.env); } U.uEnvOn.value = 1; return; }
    U.uEnvOn.value = 0;
    if (pending || ud.baking) return;
    pending = true;
    // after this frame, outside any render call
    requestAnimationFrame(() => { pending = false; try { bakeEnv(renderer, set, at); } catch (e) { console.warn("[world] env", e); } });
  };
  set.add(m);
}
function bakeEnv(renderer, set, at) {
  const ud = set.userData; if (ud.envTex || !set.visible) return;
  let root = set; while (root.parent) root = root.parent;
  ud.baking = true;
  const rt = new THREE.WebGLCubeRenderTarget(TIER.env, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  const cam = new THREE.CubeCamera(0.1, 220, rt); cam.position.copy(at);
  for (const c of cam.children) { c.layers.set(0); c.layers.enable(1); c.layers.enable(4); }
  const gm = ud.groundMat, rk = gm ? gm.uniforms.uReflK.value : 0; if (gm) gm.uniforms.uReflK.value = 0;
  const env0 = U.uEnv.value, on0 = U.uEnvOn.value; U.uEnvOn.value = 0; U.uEnv.value = null;
  root.add(cam); cam.updateMatrixWorld(true);
  const prev = renderer.getRenderTarget();
  cam.update(renderer, root);
  renderer.setRenderTarget(prev);
  root.remove(cam);
  if (gm) gm.uniforms.uReflK.value = rk;
  U.uEnv.value = env0; U.uEnvOn.value = on0;
  ud.envTex = rt.texture; ud.baking = false;
}

/* one material per look, shared, so the static merge can fold meshes together */
const memo = new Map();
const keyOf = (n, a) => n + JSON.stringify(a, (k, v) => (v && v.isTexture ? "tex:" + v.uuid : v));
const paint = o => { const k = keyOf("p", o); if (!memo.has(k)) memo.set(k, paint0(o)); return memo.get(k); };
const pbr = o => { const k = keyOf("r", o); if (!memo.has(k)) memo.set(k, pbr0(o)); return memo.get(k); };
const glow = (c, o) => { const k = keyOf("g" + c, o || {}); if (!memo.has(k)) memo.set(k, glow0(c, o)); return memo.get(k); };
const coneMat = (c, k0) => { const k = "c" + c + k0; if (!memo.has(k)) memo.set(k, coneMat0(c, k0)); return memo.get(k); };
const blobMat = (k0, rect) => { const k = "b" + k0 + !!rect; if (!memo.has(k)) memo.set(k, blobMat0(k0, rect)); return memo.get(k); };

/* fold every static mesh that shares a material into one draw: bakes transforms relative to the set */
export function mergeStatic(set) {
  set.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(set.matrixWorld).invert();
  const groups = new Map(), drop = [];
  set.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.userData.keep) return;
    for (let p = o.parent; p && p !== set; p = p.parent) if (p.userData.keep) return;
    const k = o.material.uuid + ":" + o.layers.mask + ":" + o.renderOrder;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(o);
  });
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map(o => {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const a of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(a)) g.deleteAttribute(a);
      if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      return g;
    });
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, list[0].material); m.layers.mask = list[0].layers.mask; m.renderOrder = list[0].renderOrder;
    set.add(m); drop.push(...list);
  }
  for (const o of drop) o.parent.remove(o);
}

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function box(w, h, d, mat, x = 0, y = 0, z = 0, parent) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); if (parent) parent.add(m); return m; }
function plane(w, h, mat, parent) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); if (parent) parent.add(m); return m; }
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/* ---------- the wet ground: puddles, ripples, the lamps' pools and their streaked reflections ---------- */
export function groundMat(color, mask, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uCol: { value: color }, uMask: { value: mask }, uRefl: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uSize: { value: new THREE.Vector2(o.w || 70, o.h || 50) }, uRain: { value: o.rain != null ? o.rain : 1 }, uWet: { value: o.wet != null ? o.wet : 1 }, uReflK: { value: 1 } },
    vertexShader: `varying vec3 vWP; varying vec2 vUv; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uMoonDir; uniform vec3 uMoon;
      uniform vec4 uLampPos[8]; uniform vec4 uLampCol[8]; uniform int uLampN; uniform vec3 uFog; uniform float uFogDen;
      uniform sampler2D uCol; uniform sampler2D uMask; uniform sampler2D uRefl; uniform vec2 uRes; uniform float uRain; uniform float uWet; uniform float uReflK;
      varying vec3 vWP; varying vec2 vUv;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      // rain rings: each cell drops a ring at its own time
      vec2 ripple(vec2 p, float t){
        vec2 g = vec2(0.0);
        for (int k = 0; k < 2; k++) {
          vec2 q = p * (k == 0 ? 3.0 : 5.3) + float(k) * 17.0; vec2 c = floor(q), f = fract(q) - 0.5;
          vec2 o = vec2(h21(c), h21(c + 3.1)) - 0.5; float ph = fract(t * 0.9 + h21(c + 7.7));
          vec2 d = f - o * 0.6; float r = length(d);
          float ring = sin((r - ph * 0.5) * 60.0) * smoothstep(0.5, 0.0, ph) * smoothstep(0.02, 0.0, abs(r - ph * 0.5) - 0.02);
          g += normalize(d + 1e-4) * ring;
        }
        return g;
      }
      void main(){
        vec3 alb = texture2D(uCol, vUv).rgb;
        vec4 mk = texture2D(uMask, vUv);
        float pud = mk.r * uWet;
        // wet asphalt is darker, puddles darker still (until they reflect)
        alb *= mix(1.0, 0.55, uWet) * mix(1.0, 0.6, pud);
        vec2 rp = ripple(vWP.xz, uTime) * uRain;
        vec3 N = normalize(vec3(rp.x * (0.06 + pud * 0.12), 1.0, rp.y * (0.06 + pud * 0.12)));
        vec3 V = normalize(cameraPosition - vWP);
        vec3 light = mix(uGround, uSky, 0.55) + uMoon * max(dot(N, uMoonDir), 0.0) * 0.6;
        vec3 spec = vec3(0.0);
        for (int i = 0; i < 8; i++) {
          if (i >= uLampN) break;
          vec3 L = uLampPos[i].xyz - vWP; float d = length(L); L /= d;
          float att = clamp(1.0 - d / uLampPos[i].w, 0.0, 1.0); att *= att;
          float cone = 1.0; if (uLampCol[i].w > 0.0) cone = smoothstep(uLampCol[i].w, uLampCol[i].w + 0.25, dot(-L, vec3(0.0, -1.0, 0.0)));
          light += uLampCol[i].rgb * max(dot(N, L), 0.0) * att * cone;
          vec3 H = normalize(L + V);
          // long highlights on wet ground: a broad lobe stretched toward the viewer
          float sp = pow(max(dot(N, H), 0.0), mix(40.0, 160.0, pud));
          spec += uLampCol[i].rgb * sp * att * mix(0.35, 1.4, pud) * uWet * 1.6;
        }
        vec3 col = alb * light + spec;
        // the reflection: the mirrored scene, streaked downward the way wet asphalt smears light
        float fres = mix(0.06, 1.0, pow(1.0 - max(V.y, 0.0), 4.0));
        float rk = mix(0.18, 0.95, pud) * fres * uWet * uReflK;
        vec2 suv = gl_FragCoord.xy / uRes + N.xz * vec2(0.02, 0.05);
        vec3 rc = vec3(0.0); float tot = 0.0;
        for (int j = -3; j <= 3; j++) { float w = 1.0 - abs(float(j)) / 4.0; rc += texture2D(uRefl, suv + vec2(0.0, float(j) * mix(0.012, 0.004, pud))).rgb * w; tot += w; }
        rc /= tot;
        col = mix(col, rc, clamp(rk, 0.0, 0.92));
        col += mk.g * 0.0;
        float fd = length(vWP - cameraPosition); col = mix(col, uFog, clamp(1.0 - exp(-uFogDen * fd), 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`
  });
}

/* ---------- the cars: first-party models (tools/story/world/cars.py), instanced by kind and material ---------- */
const CAR_KINDS = ["sedan", "compact", "hatch", "suv", "truck"];
const carLib = {};
/* glTF from gltfpack is quantized; bring every attribute back to floats in the car's own space */
function floatGeo(mesh) {
  const g = mesh.geometry.clone();
  for (const k of Object.keys(g.attributes)) {
    const a = g.attributes[k];
    if (!(a.array instanceof Float32Array) || a.isInterleavedBufferAttribute) {
      const n = a.count, s = a.itemSize, f = new Float32Array(n * s);
      for (let i = 0; i < n; i++) for (let j = 0; j < s; j++) f[i * s + j] = a.getComponent ? a.getComponent(i, j) : [a.getX, a.getY, a.getZ, a.getW][j].call(a, i);
      g.setAttribute(k, new THREE.BufferAttribute(f, s));
    }
  }
  mesh.updateWorldMatrix(true, false);
  g.applyMatrix4(mesh.matrixWorld);
  if (g.attributes.normal) g.attributes.normal.needsUpdate = true;
  return g;
}
async function loadCars() {
  await Promise.all(CAR_KINDS.map(async kind => {
    const url = BASE + "car-" + kind + (TIER.carLo ? "-lo" : "") + "-v1.glb";
    const gltf = await loader.loadAsync(url);
    const byMat = new Map(); let meta = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o => {
      if (o.userData && o.userData.L) meta = o.userData;
      if (!o.isMesh) return;
      const name = (o.material && o.material.name || "trim").replace(/\.\d+$/, "");
      if (!byMat.has(name)) byMat.set(name, []);
      byMat.get(name).push(floatGeo(o));
    });
    const parts = {};
    for (const [name, list] of byMat) {
      for (const g of list) for (const k of Object.keys(g.attributes)) if (!["position", "normal", "color"].includes(k)) g.deleteAttribute(k);
      for (const g of list) if (!g.attributes.color) { const c = new Float32Array(g.attributes.position.count * 4).fill(1); g.setAttribute("color", new THREE.BufferAttribute(c, 4)); }
      const m = list.length > 1 ? mergeGeometries(list.map(g => (g.index ? g : g)), false) : list[0];
      m.computeBoundingSphere(); parts[name] = m;
    }
    carLib[kind] = { parts, meta: meta || { L: 4.7, W: 1.85, H: 1.45, cab: [1.5, 2.3, 3.3, 4.0], sg: [1.7, 3.6], pillars: [2.9], axles: [1, 3.8], tr: 0.33 } };
  }));
}
/* panel lines, door handle recesses and the fuel door, drawn from the car's own measurements */
function panelTex(meta) {
  const c = TX.cv(1024, 256), g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, 1024, 256);
  const L = meta.L, H = meta.H, X = x => (x / L) * 1024; // x from the front
  const sideY = y => 256 - (y / H) * 128;                 // lower half: side view, y up
  const [c0, c1, c2, c3] = meta.cab, [s0, s1] = meta.sg, belt = meta.belt || [0.85, 0.92, 0.95];
  const bel = x => belt[0] + (belt[2] - belt[0]) * (x / L);
  const bot = 0.24;
  g.strokeStyle = "#000"; g.lineWidth = 2.2; g.lineCap = "round";
  const line = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(X(x0), sideY(y0)); g.lineTo(X(x1), sideY(y1)); g.stroke(); };
  // the doors: front door from just behind the front wheel to the B pillar, rear from there to the rear wheel
  const fa = meta.axles[0] + (meta.arch || 0.4) + 0.02, ra = meta.axles[1] - (meta.arch || 0.4) - 0.02;
  const pB = meta.pillars[0];
  const doors = meta.pillars.length && s1 - s0 > 1.4 && L < 5.2 ? [[Math.max(fa, s0 - 0.05), pB], [pB, Math.min(ra + 0.12, s1 + 0.02)]] : [[Math.max(fa, s0 - 0.05), pB + 0.02]];
  for (const [a, b] of doors) {
    line(a, bot + 0.04, a + 0.03, bel(a) + 0.02); line(b, bot + 0.04, b, bel(b) + 0.02); line(a, bot + 0.05, b, bot + 0.05);
  }
  // the fuel door, on the rear quarter
  { const fx = Math.min(L - 0.75, meta.axles[1] + 0.35), fy = bel(fx) - 0.17; g.strokeRect(X(fx) - 9, sideY(fy) - 9, 18, 16); }
  // the hood's shut line and the trunk's, seen from above (upper half: plan view, centre line at the top edge)
  const planY = w => 128 - (w / (meta.W / 2)) * 128;
  g.lineWidth = 2;
  const hoodEnd = c0 - 0.06; g.beginPath(); g.moveTo(X(0.1), planY(0.66)); g.lineTo(X(hoodEnd), planY(0.62)); g.stroke();
  g.beginPath(); g.moveTo(X(hoodEnd), planY(0.62)); g.lineTo(X(hoodEnd), 0); g.stroke();
  if (c3 < L - 0.5) { g.beginPath(); g.moveTo(X(c3 + 0.05), 0); g.lineTo(X(c3 + 0.05), planY(0.62)); g.lineTo(X(L - 0.12), planY(0.62)); g.stroke(); }
  // soften: a shut line is a shadow, not ink
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; t.generateMipmaps = true;
  return t;
}
/* the shared car materials (paint is per kind, for its panel lines; its colour is per car) */
let CARM = null;
function carMats() {
  if (CARM) return CARM;
  const v = { vao: true };
  CARM = {
    glass: pbr({ ...v, color: "#0b0e10", rough: 0.035, wet: 1, drops: true, spec: 1.0, diff: 0.6 }),
    trim: pbr({ ...v, color: "#141516", rough: 0.55, wet: 0.8 }),
    chrome: pbr({ ...v, color: "#c9ccd0", metal: 1, rough: 0.14, wet: 0.6 }),
    tire: pbr({ ...v, color: "#141414", rough: 0.82, wet: 0.7 }),
    rim: pbr({ ...v, color: "#a3a7ab", metal: 1, rough: 0.28, wet: 0.6 }),
    disc: pbr({ ...v, color: "#4c4946", metal: 1, rough: 0.55, wet: 0.3 }),
    well: pbr({ ...v, color: "#060606", rough: 0.9, wet: 0.3, spec: 0.5 }),
    lamp_head: pbr({ ...v, color: "#b9bdc0", metal: 0.85, rough: 0.07, wet: 1, drops: true }),
    lamp_tail: pbr({ ...v, color: "#5a0806", rough: 0.08, wet: 1, drops: true, emit: "#120100" }),
    lamp_amber: pbr({ ...v, color: "#7a3c06", rough: 0.08, wet: 1, emit: "#0a0400" }),
    plate: pbr({ ...v, color: "#d9d3c6", rough: 0.45, wet: 0.6 }),
    interior: pbr({ ...v, color: "#0b0b0b", rough: 0.85, wet: 0, spec: 0.4 }),
    sticker: pbr({ color: "#ece5d4", rough: 0.6, wet: 0, ao: 0, emit: "#0c0a07" }),
    idleTail: pbr({ ...v, color: "#7a0a06", rough: 0.08, wet: 1, drops: true, emit: "#ff1408" }),
    idleHead: pbr({ ...v, color: "#e8ecf0", rough: 0.07, wet: 1, emit: "#fff4e0" }),
    paint: {}
  };
  return CARM;
}
function paintMat(kind, metallic) {
  const M = carMats(), key = kind + (metallic ? "-m" : "");
  if (!M.paint[key]) {
    const meta = carLib[kind].meta;
    M.paint[key] = pbr({ vao: true, color: "#ffffff", rough: metallic ? 0.38 : 0.5, metal: metallic ? 0.55 : 0.0, coat: 1, coatRough: 0.045, wet: 1, drops: true, ao: 1,
      panel: { tex: panelTex(meta), box: [-meta.L / 2, meta.L, meta.H, meta.W / 2] } });
  }
  return M.paint[key];
}
/* a used-car lot's colours: mostly white, silver, grey and black, then the few that sell on colour */
export const CAR_COLORS = [
  ["#d9d8d2", 0], ["#aeb2b5", 1], ["#6f7478", 1], ["#16181a", 0], ["#f0eee8", 0], ["#3a3f44", 1], ["#1d2b40", 1], ["#5b1416", 1],
  ["#8d8270", 1], ["#2c3a30", 0], ["#9b1b14", 0], ["#c5c7c9", 1], ["#4a5560", 1], ["#2a2a2c", 1], ["#e6e3dc", 0], ["#7d8b97", 1]
];
/* place cars: list of { kind, x, z, yaw, color, metal, idle } in the set's space; returns the instanced meshes */
function parkCars(set, list) {
  const M = carMats(), out = [];
  const byKind = {};
  for (const c of list) (byKind[c.kind] = byKind[c.kind] || []).push(c);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  for (const [kind, cars] of Object.entries(byKind)) {
    const lib = carLib[kind]; if (!lib) continue;
    for (const [name, geo] of Object.entries(lib.parts)) {
      if (name === "paint") {
        for (const metallic of [false, true]) {
          const sub = cars.filter(c => !!c.metal === metallic); if (!sub.length) continue;
          const im = new THREE.InstancedMesh(geo, paintMat(kind, metallic), sub.length);
          sub.forEach((c, i) => { m4.compose(new THREE.Vector3(c.x, c.y || 0, c.z), q.setFromAxisAngle(up, c.yaw), s1); im.setMatrixAt(i, m4); im.setColorAt(i, col.set(c.color).convertSRGBToLinear()); });
          im.userData.keep = true; set.add(im); out.push(im);
        }
        continue;
      }
      const idleSwap = name === "lamp_tail" ? M.idleTail : name === "lamp_head" ? M.idleHead : null;
      const groups = idleSwap ? [cars.filter(c => !c.idle), cars.filter(c => c.idle)] : [cars];
      groups.forEach((sub, gi) => {
        if (!sub.length) return;
        const im = new THREE.InstancedMesh(geo, gi === 1 ? idleSwap : (M[name] || M.trim), sub.length);
        sub.forEach((c, i) => { m4.compose(new THREE.Vector3(c.x, c.y || 0, c.z), q.setFromAxisAngle(up, c.yaw), s1); im.setMatrixAt(i, m4); });
        im.userData.keep = true; set.add(im); out.push(im);
      });
    }
    // a plain sticker inside each windshield, low on the passenger side: no figures on it
    const meta = lib.meta, [c0, c1] = meta.cab, belt = (meta.belt || [0.9, 0.95])[1];
    const top = meta.H || 1.45, sl = Math.atan2(c1 - c0, top - belt);
    const st = new THREE.InstancedMesh(STICKER_GEO, M.sticker, cars.length);
    cars.forEach((c, i) => {
      const local = new THREE.Matrix4().compose(new THREE.Vector3(-0.42, belt + 0.1, meta.L / 2 - c0 - (c1 - c0) * 0.18 - 0.03), new THREE.Quaternion().setFromEuler(new THREE.Euler(-sl, 0, 0)), s1);
      m4.compose(new THREE.Vector3(c.x, c.y || 0, c.z), q.setFromAxisAngle(up, c.yaw), s1).multiply(local); st.setMatrixAt(i, m4);
    });
    st.userData.keep = true; set.add(st); out.push(st);
    // the soft dark under each car (the ground bakes its own too; this one sits on anything)
    const sh = new THREE.InstancedMesh(BLOB_GEO, blobMat(0.8, true), cars.length);
    cars.forEach((c, i) => { m4.compose(new THREE.Vector3(c.x, 0.012, c.z), q.setFromAxisAngle(up, c.yaw), new THREE.Vector3(meta.W + 0.5, 1, meta.L + 0.5)); sh.setMatrixAt(i, m4); });
    sh.layers.set(2); sh.renderOrder = 1; sh.userData.keep = true; set.add(sh); out.push(sh);
  }
  for (const im of out) { im.computeBoundingSphere(); im.frustumCulled = true; }
  return out;
}
const STICKER_GEO = new THREE.PlaneGeometry(0.2, 0.14);
const BLOB_GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
/* the footprint of a parked car, for walls and the ground's shade */
function carSize(kind) { const m = carLib[kind] && carLib[kind].meta; return m ? [m.W, m.L] : [1.85, 4.7]; }

/* ---------- a sodium lamp post ---------- */
function lampPost(x, z, h, set, k = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const pole = paint({ color: "#1b1d1c", wet: 0.9, rim: 0.8, ao: 0.4 });
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, h, 8), pole); p.position.y = h / 2; g.add(p);
  box(0.9, 0.08, 0.08, pole, 0.35, h - 0.05, 0, g);
  const head = box(0.62, 0.14, 0.32, pole, 0.7, h - 0.12, 0, g);
  const lens = plane(0.54, 0.26, glow0("#ffd59a", { k: 3.0 }), g); lens.rotation.x = Math.PI / 2; lens.position.set(0.7, h - 0.2, 0); lens.userData.keep = true;
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 3.4 * k, h - 0.25, 28, 1, true), coneMat0("#ffb766", 0.9)); cone.userData.keep = true;
  cone.position.set(0.7, (h - 0.25) / 2, 0); g.add(cone); cone.layers.set(3);
  set.add(g);
  set.userData.lamps.push({ p: V3(x + 0.7, h - 0.22, z), range: 15 * k, col: [3.1 * k, 1.95 * k, 0.92 * k], cone: 0.32, glow: lens, coneMesh: cone });
  return g;
}

function palm(x, z, h, set, r) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const pts = []; const lean = (r() - 0.5) * 0.8;
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(V3(lean * t * t, t * h, lean * 0.3 * t * t)); }
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.16, 6), paint({ color: "#141210", rim: 0.4 }));
  g.add(trunk);
  const fm = paint({ color: "#0d120e", map: set.userData.frond, alphaTest: 0.5, side: THREE.DoubleSide, rim: 0.3 });
  const top = pts[pts.length - 1];
  for (let i = 0; i < 11; i++) {
    const f = plane(1.4, 3.2, fm, g); f.position.copy(top); f.geometry.translate(0, 1.5, 0);
    f.rotation.set(0, (i / 11) * Math.PI * 2 + r(), 0); f.rotateX(-1.1 - r() * 0.5);
  }
  set.add(g);
}

/* ================================================================
   THE LOT
   ================================================================ */
export function buildLot(o) {
  const set = new THREE.Group(); set.name = "lot";
  set.userData = { lamps: [], spots: {}, walls: [], frond: TX.frondTex() };
  const r = rng(53);
  const W = 70, H = 52;
  // parking lines: two rows of stalls facing each other, and a third along the fence
  const lines = [];
  for (const zRow of [-5.5, 4.5]) for (let x = -19.2; x <= 19.2; x += 3.2) lines.push([x, zRow - 2.6, x, zRow + 2.6]);
  for (let x = -19.2; x <= 19.2; x += 3.2) lines.push([x, 12, x, 16.5]);
  const asph = TX.asphalt(W, H, o.lowres ? 14 : 24, lines);
  const gm = groundMat(asph.color, asph.mask, { w: W, h: H, wet: o.day ? 0 : 1, rain: o.day ? 0 : 1 });
  const ground = plane(W, H, gm, set); ground.rotation.x = -Math.PI / 2; ground.layers.set(4);
  set.userData.groundMat = gm;
  // the showroom: a glass front glowing warm, the wordmark over it
  const wall = paint({ color: "#2b2f2c", wet: 0.3, rim: 0.4, ao: 0.6 }), trim = paint({ color: "#141716", wet: 0.6, rim: 0.6 });
  const sh = new THREE.Group(); sh.position.set(2, 0, -18); set.add(sh);
  // the body, hollow behind the glass: a lit room 3.6 m deep with cars in it, so the front has depth from every angle
  box(26, 5.2, 4.4, wall, 0, 2.6, -5.8, sh);
  box(26, 1.3, 3.6, wall, 0, 4.55, -1.8, sh);
  box(1, 5.2, 3.6, wall, -12.5, 2.6, -1.8, sh); box(3, 5.2, 3.6, wall, 11.5, 2.6, -1.8, sh);
  const roomFloor = plane(22, 3.6, paint({ color: "#6b5640", wet: 0.9, rim: 0.1, emit: "#3a2a1a" }), sh); roomFloor.rotation.x = -Math.PI / 2; roomFloor.position.set(-1, 0.02, -1.8);
  const roomCeil = plane(22, 3.6, glow("#f6e3c4", { k: o.day ? 0.25 : 0.55 }), sh); roomCeil.rotation.x = Math.PI / 2; roomCeil.position.set(-1, 3.88, -1.8);
  // three cars on the showroom floor, angled to the glass
  const showCars = [[-7.5, 0.5, "sedan", "#9b1b14", 0], [-2.2, -0.35, "suv", "#e6e3dc", 0], [3.6, 0.42, "compact", "#3a3f44", 1]].map(([x, yaw, kind, color, metal]) => ({ kind, x: x + 2, z: -1.9 - 18, yaw, color, metal: !!metal }));
  box(26.6, 0.5, 8.6, trim, 0, 5.4, -4, sh); // roof edge
  const glassIn = TX.cv(1024, 256); { const g = glassIn.getContext("2d"); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#f2c98d"); gr.addColorStop(1, "#b07a42"); g.fillStyle = gr; g.fillRect(0, 0, 1024, 256);
    g.fillStyle = "rgba(40,28,18,0.55)"; for (let i = 0; i < 5; i++) { const x = 80 + i * 200; g.beginPath(); g.ellipse(x, 210, 80, 24, 0, 0, 7); g.fill(); g.fillRect(x - 70, 170, 140, 40); }
    g.fillStyle = "rgba(255,240,210,0.6)"; for (let i = 0; i < 8; i++) g.fillRect(40 + i * 125, 10, 70, 6); }
  const gtex = new THREE.CanvasTexture(glassIn); gtex.colorSpace = THREE.SRGBColorSpace;
  const front = plane(22, 3.6, glow("#ffffff", { map: gtex, k: o.day ? 0.35 : 1.35 }), sh); front.position.set(-1, 1.95, -3.58);
  const pane = plane(22, 3.7, paint({ color: "#7d8c88", alpha: 0.1, wet: 2.2, rim: 0.8, depthWrite: false }), sh); pane.position.set(-1, 1.95, 0.03);
  for (let i = 0; i <= 8; i++) box(0.12, 3.8, 0.14, trim, -12 + i * 2.75, 1.95, 0.08, sh);
  box(22.4, 0.14, 0.16, trim, -1, 3.85, 0.08, sh); box(22.4, 0.14, 0.16, trim, -1, 0.06, 0.08, sh);
  // the office door, at the right end of the glass
  const door = box(1.4, 2.4, 0.1, paint({ color: "#0f1412", wet: 1.2, rim: 0.8 }), 11, 1.2, 0.06, sh);
  const doorGlow = plane(1.0, 1.9, glow("#f3d2a0", { k: o.day ? 0.3 : 1.0 }), sh); doorGlow.position.set(11, 1.25, 0.13);
  // the wordmark, lit
  const signT = TX.signTex(o.wordmark);
  const sign = plane(10, 2.5, glow("#ffffff", { map: signT, k: o.day ? 0.9 : 1.25 }), sh); sign.position.set(-1, 4.65, 0.32);
  // the sold board by the door
  // the sold board fills from June 2025; on the morning of the keys, August 2024, it is not up yet
  if (!o.day) { const sold = plane(1.6, 1.2, paint({ map: TX.soldTex(), color: "#fff", rim: 0.2, wet: 0.2 }), sh); sold.position.set(8.6, 1.55, 0.16); }
  set.userData.spots.sold = { p: V3(2 + 8.6, 1.5, -18 + 0.3), r: 2.4, stand: V3(10.6, 0, -16.2) };
  set.userData.spots.door = { p: V3(13, 1.3, -17.6), r: 2.4, stand: V3(13, 0, -16.3) };
  set.userData.walls.push({ x0: -11.3, x1: 15.3, z0: -26.3, z1: -17.7 });
  // the pylon sign and its banner
  const py = new THREE.Group(); py.position.set(-15, 0, -9); set.add(py);
  box(0.35, 6.4, 0.35, trim, -1.6, 3.2, 0, py); box(0.35, 6.4, 0.35, trim, 1.6, 3.2, 0, py);
  const ps = plane(3.6, 1.0, glow("#ffffff", { map: signT, k: o.day ? 0.9 : 1.3 }), py); ps.position.set(0, 5.9, 0.2);
  const ps2 = ps.clone(); ps2.rotation.y = Math.PI; ps2.position.z = -0.2; py.add(ps2);
  box(3.8, 1.2, 0.3, trim, 0, 5.9, 0, py);
  const ban = plane(3.4, 0.55, paint({ map: TX.bannerTex(), color: "#fff", rim: 0.3, wet: 0.3 }), py); ban.position.set(0, 4.7, 0.18);
  set.userData.spots.sign = { p: V3(-15, 4.7, -8.8), r: 4.5, stand: V3(-13.6, 0, -6.4) };
  set.userData.walls.push({ x0: -17, x1: -13, z0: -9.5, z1: -8.5 });
  // cars, two rows facing each other, and some along the fence
  const KINDS = ["sedan", "suv", "compact", "truck", "hatch", "sedan", "suv", "compact"];
  const lotCars = [];
  set.userData.cars = lotCars;
  const addCar = (x, z, yaw, kind, ci) => {
    const [color, metal] = CAR_COLORS[ci % CAR_COLORS.length];
    const c = { kind, x, z, yaw, color, metal: !!metal }; lotCars.push(c);
    const [w, l] = carSize(kind); const ca = Math.abs(Math.cos(yaw)), sa = Math.abs(Math.sin(yaw));
    const hw = (w * ca + l * sa) / 2 + 0.2, hl = (w * sa + l * ca) / 2 + 0.2;
    set.userData.walls.push({ x0: x - hw, x1: x + hw, z0: z - hl, z1: z + hl });
    return c;
  };
  let k = 0;
  // nose out, the way a lot shows its stock: the front row faces the road, the back row the showroom
  for (let x = -17.6; x <= 17.6; x += 3.2) { if (r() < 0.12) continue; addCar(x, -5.6 + (r() - 0.5) * 0.25, Math.PI + (r() - 0.5) * 0.05, KINDS[k % KINDS.length], k * 7 + 3); k++; }
  for (let x = -17.6; x <= 17.6; x += 3.2) { if (Math.abs(x - 1.6) < 1.7 || r() < 0.15) continue; const kd = x > 4 && x < 6 ? "truck" : KINDS[(k + 2) % KINDS.length]; addCar(x, 4.5 + (r() - 0.5) * 0.25, (r() - 0.5) * 0.05, kd, x > 4 && x < 6 ? 2 : k * 3 + 1); if (kd === "truck") set.userData.spots.truck = { p: V3(x, 1.3, 4.5 + 2.9), r: 3, stand: V3(x, 0, 8.8) }; k++; }
  for (let x = -17.6; x <= 9; x += 3.2) { if (r() < 0.25) continue; addCar(x, 14.4, Math.PI + (r() - 0.5) * 0.05, KINDS[(k + 1) % KINDS.length], k * 5); k++; }
  // one car by the showroom with its engine running and its lights on: someone's ride, waiting
  const idle = { kind: "sedan", x: 16.6, z: -11.2, yaw: -Math.PI / 2 + 0.12, color: "#16181a", metal: false, idle: true };
  lotCars.push(idle); set.userData.walls.push({ x0: 14.2, x1: 19.0, z0: -12.3, z1: -10.1 });
  parkCars(set, lotCars.concat(showCars));
  if (!set.userData.spots.truck) set.userData.spots.truck = { p: V3(4.8, 1.3, 7.1), r: 3, stand: V3(4.8, 0, 8.6) };
  // lamps
  [[-9, -1.2, 8], [8, -1.2, 8], [-1, 9.4, 8], [13, 9.4, 8], [-17, 12, 7.5], [11.6, -13.4, 6.5]].forEach(([x, z, h]) => lampPost(x, z, h, set));
  set.userData.walls.push(...set.userData.lamps.map(l => ({ x0: l.p.x - 1.0, x1: l.p.x - 0.4, z0: l.p.z - 0.3, z1: l.p.z + 0.3 })));
  // the showroom's own warmth spilling onto the lot
  set.userData.lamps.push({ p: V3(2, 2.2, -15.5), range: 13, col: [1.5, 1.05, 0.6], cone: 0, fixed: true });
  set.userData.lamps.push({ p: V3(13, 2.0, -16.2), range: 6, col: [1.0, 0.75, 0.45], cone: 0, fixed: true });
  // the puddle by the middle lamp
  set.userData.spots.puddle = { p: V3(-1.5, 0.05, 11.2), r: 2.2, stand: V3(-1.5, 0, 12.6) };
  // the fence and the gate
  const fence = paint({ color: "#25292a", wet: 0.8, rim: 0.7 });
  const chain = TX.cv(64, 64); { const g = chain.getContext("2d"); g.strokeStyle = "rgba(160,170,175,0.75)"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke(); }
  const ct = new THREE.CanvasTexture(chain); ct.wrapS = ct.wrapT = THREE.RepeatWrapping; ct.repeat.set(30, 1.2);
  const cm = paint({ color: "#7a8186", map: ct, alphaTest: 0.35, side: THREE.DoubleSide, rim: 0.5 });
  for (const [x0, x1] of [[-34, -3.2], [3.2, 34]]) {
    const len = x1 - x0; const f = plane(len, 1.9, cm.clone(), set); f.position.set((x0 + x1) / 2, 0.95, 21.5);
    for (let x = x0; x <= x1; x += 3) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 6), fence); p.position.set(x, 1, 21.5); set.add(p); }
    set.userData.walls.push({ x0, x1, z0: 21.2, z1: 21.8 });
  }
  // the rolling gate: open when you arrive, Dell half closing it later
  const gate = new THREE.Group(); gate.position.set(-3.2, 0, 21.9); set.add(gate); gate.userData.keep = true;
  for (let i = 0; i <= 6; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 6), fence); p.position.set(-i * 0.55, 0.95, 0); gate.add(p); }
  box(3.4, 0.06, 0.06, fence, -1.65, 1.85, 0, gate); box(3.4, 0.06, 0.06, fence, -1.65, 0.12, 0, gate);
  set.userData.gate = gate;
  set.userData.spots.gate = { p: V3(-3.4, 1.2, 21.9), r: 2.4, stand: V3(-2.6, 0, 20.4) };
  set.userData.walls.push({ x0: -35, x1: 35, z0: -27, z1: -26.4 }, { x0: -35, x1: -34.4, z0: -27, z1: 22 }, { x0: 34.4, x1: 35, z0: -27, z1: 22 }, { x0: -4, x1: 4, z0: 23.6, z1: 24.2 });
  // beyond the fence: palms, poles, the city
  for (let i = 0; i < 9; i++) palm(-30 + i * 7.5 + (r() - 0.5) * 3, 25 + r() * 4, 7 + r() * 4, set, r);
  for (let i = 0; i < 4; i++) palm(-38 - r() * 4, -20 + i * 11, 7 + r() * 4, set, r);
  const sky = new THREE.Mesh(new THREE.CylinderGeometry(90, 90, 40, 48, 1, true), new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color(o.day ? "#9fb6c8" : "#0b1116") }, uLow: { value: new THREE.Color(o.day ? "#e7dcc8" : "#2a2420") }, uMap: { value: TX.skylineTex() }, uDay: { value: o.day ? 1 : 0 } },
    vertexShader: `varying vec2 vUv; varying float vY; void main(){ vUv = uv; vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uTop; uniform vec3 uLow; uniform sampler2D uMap; uniform float uDay; varying vec2 vUv; varying float vY;
      void main(){ float t = smoothstep(-6.0, 14.0, vY); vec3 c = mix(uLow, uTop, t);
      vec2 su = vec2(vUv.x * 3.0, (vY + 14.0) / 11.0); vec4 s = texture2D(uMap, fract(su));
      if (su.y > 0.0 && su.y < 1.0) c = mix(c, s.rgb * mix(1.0, 0.6, uDay) + (uDay > 0.5 ? vec3(0.32, 0.34, 0.33) * s.a : vec3(0.0)), s.a);
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
      }`, side: THREE.BackSide, depthWrite: false }));
  sky.position.y = 6; set.add(sky); sky.renderOrder = -1;
  envHook(set, V3(1, 1.7, 3));
  mergeStatic(set);
  // where people stand
  set.userData.marks = {
    playerStart: V3(0.2, 0, 26.5), playerIn: V3(0.2, 0, 19.5),
    dell: V3(3.2, 0, 19.6), dellYaw: Math.PI * 0.9,
    jason: V3(10.2, 0, -14.6), jasonYaw: -0.3,
    decisionPlayer: V3(11, 0, -12.5), decisionJason: V3(9.4, 0, -11.2), dellGate: V3(-1.6, 0, 20.4)
  };
  set.userData.spots.dell = { who: "dell", r: 2.6 };
  set.userData.spots["jason-lot"] = { who: "jason", r: 2.8 };
  set.userData.spots["jason-end"] = { who: "jason", r: 3.0 };
  set.userData.camRail = [V3(-22, 1.0, 26), V3(-12, 0.7, 16), V3(-2, 1.3, 6), V3(6, 2.2, -3), V3(10, 2.0, -8.5)];
  set.userData.camLook = [V3(-6, 1.6, 8), V3(0, 1.2, -2), V3(6, 1.6, -10), V3(9, 2.2, -14), V3(10.2, 1.6, -14.6)];
  return set;
}

/* ================================================================
   THE OFFICE
   ================================================================ */
/* set dressing: an abstract canvas (colour fields, no words), rain on glass, a potted plant, a lamp */
function artTex(seed, pal) {
  const c = TX.cv(256, 320), g = c.getContext("2d"), r = rng(seed);
  g.fillStyle = pal[0]; g.fillRect(0, 0, 256, 320);
  for (let i = 0; i < 5; i++) { g.globalAlpha = 0.55 + r() * 0.4; g.fillStyle = pal[1 + (i % (pal.length - 1))]; const x = r() * 180, y = r() * 240; g.fillRect(x, y, 40 + r() * 120, 30 + r() * 140); }
  g.globalAlpha = 0.35; g.strokeStyle = "#f1ead8"; g.lineWidth = 3; g.beginPath(); g.moveTo(20, 280 * r() + 20); g.bezierCurveTo(90, 40, 160, 300, 236, 60 + r() * 200); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function rainTex() {
  const c = TX.cv(512, 256), g = c.getContext("2d"), r = rng(5);
  g.clearRect(0, 0, 512, 256);
  for (let i = 0; i < 260; i++) { const x = r() * 512, y = r() * 256, l = 4 + r() * 26; g.strokeStyle = "rgba(230,236,240," + (0.12 + r() * 0.35).toFixed(2) + ")"; g.lineWidth = 1 + r() * 1.4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 3, y + l / 2, x + (r() - 0.5) * 2, y + l); g.stroke(); }
  for (let i = 0; i < 120; i++) { g.fillStyle = "rgba(235,240,244," + (0.15 + r() * 0.3).toFixed(2) + ")"; g.beginPath(); g.arc(r() * 512, r() * 256, 0.8 + r() * 2.2, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function plant(x, z, h, parent, seed) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.42, 14), paint({ color: "#8a5a3c", rim: 0.4, wet: 0.3, ao: 0.4 })); pot.position.y = 0.21; g.add(pot);
  const leaf = paint({ color: "#2f5a36", rim: 0.6, wet: 0.4, side: THREE.DoubleSide }), r = rng(seed);
  for (let i = 0; i < 14; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5 + r() * h * 0.5, 4), leaf); const a = r() * Math.PI * 2, t = 0.25 + r() * 0.55; l.position.set(Math.cos(a) * 0.08, 0.42 + (0.25 + r() * h * 0.5) * 0.5, Math.sin(a) * 0.08); l.rotation.set(Math.sin(a) * t, 0, -Math.cos(a) * t); l.scale.set(1, 1, 0.25); g.add(l); }
  return g;
}

export function buildOffice(o) {
  const set = new THREE.Group(); set.name = "office";
  set.userData = { lamps: [], spots: {}, walls: [] };
  const floor = plane(14, 10, paint({ color: "#3b3229", wet: 0.35, rim: 0.2 }), set); floor.rotation.x = -Math.PI / 2;
  const wallM = paint({ color: "#d4ccbc", rim: 0.25, ao: 0.4 }), wains = paint({ color: "#1c3229", rim: 0.3, wet: 0.2 });
  const ceil = plane(14, 10, paint({ color: "#bdb6a8", rim: 0 }), set); ceil.rotation.x = Math.PI / 2; ceil.position.y = 3.1;
  // walls: back (north), sides; the front (south) wall has the big window onto the lot
  const back = plane(14, 3.1, wallM, set); back.position.set(0, 1.55, -5);
  const left = plane(10, 3.1, wallM, set); left.position.set(-7, 1.55, 0); left.rotation.y = Math.PI / 2;
  const right = plane(10, 3.1, wallM, set); right.position.set(7, 1.55, 0); right.rotation.y = -Math.PI / 2;
  box(14, 1.0, 0.04, wains, 0, 0.5, -4.98, set); box(0.04, 1.0, 10, wains, -6.98, 0.5, 0, set); box(0.04, 1.0, 10, wains, 6.98, 0.5, 0, set);
  const frontL = plane(4, 3.1, wallM, set); frontL.position.set(-5, 1.55, 5); frontL.rotation.y = Math.PI;
  const frontR = plane(4, 3.1, wallM, set); frontR.position.set(5, 1.55, 5); frontR.rotation.y = Math.PI;
  box(6, 0.9, 0.04, wallM, 0, 0.45, 5, set); box(6, 0.3, 0.04, wallM, 0, 2.95, 5, set);
  // the window: the lot's key art, outside, in the rain
  const winT = new THREE.TextureLoader().load(o.lotArt); winT.colorSpace = THREE.SRGBColorSpace;
  const win = plane(9.6, 4.6, glow("#ffffff", { map: winT, k: 0.85 }), set); win.position.set(0, 1.9, 7.5); win.rotation.y = Math.PI;
  const winF = paint({ color: "#141716", rim: 0.4, wet: 0.5 });
  for (let i = 0; i <= 3; i++) box(0.08, 2.0, 0.1, winF, -3 + i * 2, 1.85, 5, set);
  box(6.1, 0.08, 0.1, winF, 0, 2.82, 5, set); box(6.1, 0.08, 0.1, winF, 0, 0.88, 5, set);
  set.userData.window = win;
  set.userData.spots.window = { p: V3(0, 1.6, 4.8), r: 2.4, stand: V3(0.5, 0, 3.6) };
  // fluorescent panels
  for (const [x, z] of [[-3.5, -1.5], [3.5, -1.5], [0, 2.5]]) { const p = plane(1.2, 0.6, glow("#f4f1e8", { k: 1.6 }), set); p.rotation.x = Math.PI / 2; p.position.set(x, 3.08, z); set.userData.lamps.push({ p: V3(x, 2.9, z), range: 7.5, col: [0.85, 0.86, 0.84], cone: 0, fixed: true }); }
  // the sale desk: Renata in the chair, Jason behind it, the phone, the monitor, the ledger
  const wood = paint({ color: "#5a4636", wet: 0.5, rim: 0.4, ao: 0.5 }), dark = paint({ color: "#1b1e1d", wet: 0.6, rim: 0.5 });
  const desk = new THREE.Group(); desk.position.set(-1.0, 0, -1.8); set.add(desk);
  box(2.6, 0.06, 1.1, wood, 0, 0.76, 0, desk); box(0.06, 0.74, 1.0, wood, -1.25, 0.37, 0, desk); box(0.06, 0.74, 1.0, wood, 1.25, 0.37, 0, desk); box(2.5, 0.5, 0.04, wood, 0, 0.5, -0.5, desk);
  const mon = box(0.62, 0.38, 0.03, dark, 0.35, 1.08, -0.3, desk); box(0.06, 0.24, 0.06, dark, 0.35, 0.88, -0.32, desk);
  const monS = plane(0.58, 0.34, glow("#ffffff", { map: TX.screenTex("desk"), k: 0.9 }), desk); monS.position.set(0.35, 1.08, -0.284);
  set.userData.monitor = monS;
  const phone = new THREE.Group(); phone.position.set(-0.75, 0.8, 0.05); desk.add(phone); phone.userData.keep = true;
  box(0.24, 0.05, 0.2, dark, 0, 0, 0, phone); const hs = box(0.24, 0.05, 0.06, dark, 0, 0.05, -0.04, phone);
  const phoneLed = box(0.03, 0.01, 0.03, glow0("#c9a96a", { k: 0.4 }), 0.08, 0.03, 0.06, phone);
  set.userData.phone = { g: phone, led: phoneLed };
  set.userData.spots.phone = { p: V3(-1.75, 0.95, -1.75), r: 1.8, stand: V3(-1.9, 0, -0.5) };
  const ledger = box(0.3, 0.05, 0.4, paint({ color: "#24402f", rim: 0.5, wet: 0.4 }), 0.95, 0.81, 0.15, desk);
  set.userData.spots.ledger = { p: V3(-0.05, 0.9, -1.65), r: 1.6, stand: V3(0.2, 0, -0.5) };
  // two chairs: Jason's behind, the buyer's in front
  const chair = (x, z, yaw) => { const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = yaw; box(0.5, 0.06, 0.5, dark, 0, 0.46, 0, c); box(0.5, 0.5, 0.06, dark, 0, 0.74, -0.24, c); box(0.06, 0.44, 0.06, dark, 0, 0.22, 0, c); set.add(c); return c; };
  chair(-1.6, -0.75, Math.PI); chair(-0.2, -2.75, 0);
  set.userData.spots.desk = { p: V3(-1.0, 1.0, -1.8), r: 2.0, stand: V3(-0.6, 0, -0.4) };
  set.userData.walls.push({ x0: -2.4, x1: 0.4, z0: -2.45, z1: -1.2 });
  // the filing cabinet on the left wall
  const cab = new THREE.Group(); cab.position.set(-6.6, 0, -2.6); cab.rotation.y = Math.PI / 2; set.add(cab);
  box(0.9, 1.36, 0.62, paint({ color: "#4a5048", wet: 0.7, rim: 0.6, ao: 0.5 }), 0, 0.68, 0, cab);
  ["Form 130-U", "webDEALER", "Liens", "Temp tags"].forEach((t, i) => { const lb = plane(0.32, 0.08, paint({ map: TX.labelTex(t, { w: 256, h: 64 }), color: "#fff", rim: 0 }), cab); lb.position.set(0, 1.2 - i * 0.32, 0.315); box(0.3, 0.03, 0.03, dark, 0, 1.12 - i * 0.32, 0.33, cab); });
  set.userData.spots.cabinet = { p: V3(-6.3, 1.0, -2.6), r: 1.8, stand: V3(-5.4, 0, -2.6) };
  set.userData.walls.push({ x0: -7, x1: -6.2, z0: -3.1, z1: -2.1 });
  // the whiteboard on the back wall, with three notes
  const wb = new THREE.Group(); wb.position.set(2.6, 1.6, -4.96); set.add(wb);
  box(2.5, 1.5, 0.04, paint({ color: "#d8d8d2", rim: 0.2 }), 0, 0, 0, wb);
  const wbs = plane(2.4, 1.4, paint({ map: TX.boardTex(), color: "#fff", rim: 0.1, wet: 0.6 }), wb); wbs.position.z = 0.025;
  const notes = {};
  [["note-rls", "Row-level security", "#e7cf73", -0.8], ["note-valid", "Validation", "#e9b7a3", 0], ["note-migr", "Migrations", "#bcd9c0", 0.8]].forEach(([id, t, c, x]) => {
    const n = plane(0.3, 0.3, paint({ map: TX.noteTex(t, c), color: "#fff", rim: 0.1 }), wb); n.position.set(x, -0.46, 0.03); n.rotation.z = (x * 7 % 3 - 1) * 0.06; notes[id] = n;
    set.userData.spots[id] = { p: V3(2.6 + x, 1.6 - 0.46, -4.9), r: 0, close: true };
  });
  set.userData.notes = notes;
  set.userData.spots.board = { p: V3(2.6, 1.6, -4.9), r: 2.2, stand: V3(2.6, 0, -3.3), cam: { p: V3(2.6, 1.55, -2.55), t: V3(2.6, 1.42, -4.95) } };
  // the laptop on the side table by the right wall
  const tbl = new THREE.Group(); tbl.position.set(6.1, 0, 0.6); set.add(tbl);
  box(1.4, 0.05, 0.8, wood, 0, 0.74, 0, tbl); box(0.05, 0.72, 0.7, wood, -0.65, 0.36, 0, tbl); box(0.05, 0.72, 0.7, wood, 0.65, 0.36, 0, tbl);
  box(0.4, 0.02, 0.28, dark, 0, 0.775, 0.05, tbl);
  const lid = new THREE.Group(); lid.position.set(0, 0.78, -0.09); lid.rotation.x = -0.32; tbl.add(lid);
  box(0.4, 0.27, 0.015, dark, 0, 0.135, 0, lid); const ls = plane(0.37, 0.24, glow("#ffffff", { map: TX.screenTex("lead"), k: 0.95 }), lid); ls.position.set(0, 0.135, 0.009);
  tbl.rotation.y = -Math.PI / 2;
  set.userData.spots.laptop = { p: V3(6.1, 0.95, 0.6), r: 1.8, stand: V3(5.0, 0, 0.6) };
  set.userData.walls.push({ x0: 5.6, x1: 7, z0: -0.2, z1: 1.4 });
  // the bookshelf behind the desk, with the book
  const shelf = new THREE.Group(); shelf.position.set(-3.4, 0, -4.75); set.add(shelf);
  box(1.6, 2.0, 0.36, wood, 0, 1.0, 0, shelf);
  const r = rng(7), bcol = ["#6a2f2a", "#24402f", "#2d3b4f", "#8a7a5a", "#3a2a22", "#5a5a52"];
  for (let s = 0; s < 4; s++) { box(1.5, 0.03, 0.32, dark, 0, 0.3 + s * 0.45, 0.02, shelf); let x = -0.7; while (x < 0.65) { const w = 0.03 + r() * 0.04, h = 0.25 + r() * 0.12; box(w, h, 0.22, paint({ color: bcol[(r() * bcol.length) | 0], rim: 0.3 }), x + w / 2, 0.32 + s * 0.45 + h / 2, 0.04, shelf); x += w + 0.004; } }
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.24), [paint({ color: "#24402f" }), paint({ color: "#24402f" }), paint({ color: "#24402f" }), paint({ color: "#24402f" }), paint({ map: TX.docTex("book"), color: "#fff", rim: 0.3 }), paint({ color: "#24402f" })]);
  book.position.set(0.55, 1.4, 0.12); book.rotation.y = -0.5; shelf.add(book);
  set.userData.book = book;
  set.userData.spots.book = { p: V3(-2.85, 1.4, -4.6), r: 1.8, stand: V3(-2.9, 0, -3.5) };
  set.userData.walls.push({ x0: -4.3, x1: -2.5, z0: -5, z1: -4.4 });
  // the coffee machine
  const cof = new THREE.Group(); cof.position.set(-6.4, 0, 2.6); set.add(cof);
  box(0.8, 0.9, 0.6, wood, 0, 0.45, 0, cof); box(0.36, 0.44, 0.34, dark, 0, 1.12, 0, cof); box(0.06, 0.03, 0.02, glow("#c94a2a", { k: 1.2 }), 0.1, 1.25, 0.18, cof);
  set.userData.spots.coffee = { p: V3(-6.3, 1.1, 2.6), r: 1.7, stand: V3(-5.4, 0, 2.6) };
  set.userData.walls.push({ x0: -7, x1: -5.9, z0: 2.2, z1: 3.0 });
  // the break room through the opening in the right wall: the arcade cabinet
  const arc = new THREE.Group(); arc.position.set(5.6, 0, -4.1); set.add(arc);
  box(0.8, 1.9, 0.7, paint({ color: "#151a18", wet: 0.6, rim: 0.7 }), 0, 0.95, 0, arc);
  const scr = plane(0.6, 0.45, glow0("#ffffff", { map: o.arcadeTex || TX.screenTex("arcade"), k: 1.1 }), arc); scr.position.set(0, 1.38, 0.36); scr.rotation.x = -0.18; scr.userData.keep = true;
  const marq = plane(0.7, 0.16, glow("#ffffff", { map: TX.labelTex("AFTER HOURS", { bg: "#1c3229", fg: "#ede7db", w: 512, h: 112 }), k: 1.2 }), arc); marq.position.set(0, 1.8, 0.36);
  box(0.7, 0.06, 0.3, dark, 0, 1.05, 0.45, arc);
  set.userData.arcadeScreen = scr;
  set.userData.spots.arcade = { p: V3(5.6, 1.3, -3.7), r: 1.9, stand: V3(5.4, 0, -2.6) };
  set.userData.walls.push({ x0: 5.1, x1: 6.1, z0: -4.6, z1: -3.6 });
  set.userData.lamps.push({ p: V3(5.6, 1.5, -3.2), range: 3, col: [0.3, 0.4, 0.32], cone: 0, fixed: true });
  set.userData.lamps.push({ p: V3(0, 1.4, 6.5), range: 6, col: [0.5, 0.42, 0.32], cone: 0, fixed: true });
  set.userData.walls.push({ x0: -8, x1: 8, z0: -5.4, z1: -4.9 }, { x0: -7.4, x1: -6.9, z0: -6, z1: 6 }, { x0: 6.9, x1: 7.4, z0: -6, z1: 6 }, { x0: -8, x1: 8, z0: 4.85, z1: 5.4 });
  // lived in: a rug, the desk's clutter and its lamp, plants, pictures, a clock, chairs by the window, binders, cable, rain on the glass
  const rug = plane(3.8, 2.6, paint({ color: "#5c2e26", rim: 0.1, ao: 0.3 }), set); rug.rotation.x = -Math.PI / 2; rug.position.set(-1, 0.012, -1.6);
  const cream = paint({ color: "#e9e4d8", rim: 0.2 }), brass = paint({ color: "#b08a4a", wet: 2.2, rim: 0.5 });
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 12), cream); cup.position.set(0.85, 0.84, 0.2); desk.add(cup);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), paint({ color: "#2a1a10", wet: 2 })); coffee.rotation.x = -Math.PI / 2; coffee.position.set(0.85, 0.885, 0.2); desk.add(coffee);
  for (let i = 0; i < 3; i++) box(0.22, 0.012 + i * 0.01, 0.3, cream, -0.25 + i * 0.03, 0.8 + i * 0.012, 0.25 - i * 0.02, desk);
  box(0.24, 0.03, 0.31, paint({ color: "#2d3b4f", rim: 0.3 }), -0.28, 0.83, 0.24, desk);
  const pens = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 10), dark); pens.position.set(1.1, 0.84, -0.25); desk.add(pens);
  // the desk lamp, warm, the room's practical
  box(0.14, 0.02, 0.14, brass, -1.1, 0.8, -0.3, desk); box(0.02, 0.4, 0.02, brass, -1.1, 1.0, -0.3, desk);
  const dsh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.13, 0.12, 12, 1, true), paint({ color: "#1c3229", rim: 0.5, wet: 0.6, side: THREE.DoubleSide })); dsh.position.set(-1.1, 1.22, -0.25); desk.add(dsh);
  const dbulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), glow("#ffd9a0", { k: 2.4 })); dbulb.position.set(-1.1, 1.18, -0.25); desk.add(dbulb);
  set.userData.lamps.push({ p: V3(-2.1, 1.15, -2.05), range: 3.6, col: [1.5, 0.95, 0.5], cone: 0, fixed: true });
  box(0.02, 0.02, 1.4, dark, 0.2, 0.02, -2.0, set); // the monitor's cable along the floor
  plant(6.2, 3.9, 1.2, set, 3); plant(-6.2, -4.2, 1.6, set, 9); plant(1.4, -4.5, 0.9, set, 12);
  set.userData.walls.push({ x0: 5.8, x1: 6.6, z0: 3.5, z1: 4.3 }, { x0: -6.6, x1: -5.8, z0: -4.6, z1: -3.8 }, { x0: 1.0, x1: 1.8, z0: -4.9, z1: -4.1 });
  // pictures: colour fields, no words
  const frameM = paint({ color: "#151413", rim: 0.4, wet: 0.5 });
  for (const [x, y, z, ry, w, h, seed, pal] of [[6.96, 1.75, -1.6, -Math.PI / 2, 0.9, 1.1, 21, ["#d8cfbd", "#1c3229", "#a85a3a", "#c9a96a"]], [6.96, 1.6, 2.5, -Math.PI / 2, 0.7, 0.9, 33, ["#e3dccb", "#2d3b4f", "#8a7a5a"]], [-6.96, 1.75, 0.3, Math.PI / 2, 1.2, 0.85, 47, ["#cfc6b2", "#6a2f2a", "#24402f", "#d6b98a"]], [-0.9, 1.95, -4.97, 0, 0.8, 0.6, 58, ["#ddd5c4", "#1c3229", "#b07a42"]]]) {
    const f = new THREE.Group(); f.position.set(x, y, z); f.rotation.y = ry; set.add(f);
    box(w + 0.08, h + 0.08, 0.04, frameM, 0, 0, 0, f); const a = plane(w, h, paint({ map: artTex(seed, pal), color: "#fff", rim: 0.1, wet: 0.3 }), f); a.position.z = 0.025;
  }
  // a clock over the door to the break room
  const clk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 24), cream); clk.rotation.x = Math.PI / 2; clk.position.set(4.6, 2.5, -4.97); set.add(clk);
  box(0.012, 0.14, 0.01, dark, 4.6, 2.54, -4.94, set).rotation.z = 0.5; box(0.012, 0.1, 0.01, dark, 4.6, 2.52, -4.935, set).rotation.z = -1.2;
  // two armchairs by the window and a low table with a magazine
  const fab = paint({ color: "#3d4a40", rim: 0.4, ao: 0.5 });
  for (const [x, ry] of [[-2.2, 0.35], [2.2, -0.35]]) { const a = new THREE.Group(); a.position.set(x, 0, 3.9); a.rotation.y = Math.PI + ry; set.add(a); box(0.8, 0.4, 0.75, fab, 0, 0.22, 0, a); box(0.8, 0.5, 0.15, fab, 0, 0.62, -0.32, a); box(0.12, 0.25, 0.75, fab, -0.4, 0.5, 0, a); box(0.12, 0.25, 0.75, fab, 0.4, 0.5, 0, a); set.userData.walls.push({ x0: x - 0.5, x1: x + 0.5, z0: 3.45, z1: 4.4 }); }
  box(0.9, 0.04, 0.5, wood, 0, 0.42, 4.0, set); box(0.06, 0.4, 0.06, wood, -0.4, 0.2, 4.0, set); box(0.06, 0.4, 0.06, wood, 0.4, 0.2, 4.0, set); box(0.26, 0.01, 0.34, paint({ color: "#a85a3a", rim: 0.2 }), 0.15, 0.445, 4.0, set);
  set.userData.walls.push({ x0: -0.5, x1: 0.5, z0: 3.7, z1: 4.3 });
  // binders on a low shelf under the whiteboard
  box(1.8, 0.7, 0.36, wood, 2.6, 0.35, -4.78, set); set.userData.walls.push({ x0: 1.6, x1: 3.6, z0: -5, z1: -4.5 });
  { const rb = rng(17), bc2 = ["#1c3229", "#2d3b4f", "#6a2f2a", "#8a7a5a", "#e9e4d8"]; let x = 1.8; while (x < 3.35) { const w = 0.05 + rb() * 0.04; box(w, 0.3, 0.26, paint({ color: bc2[(rb() * bc2.length) | 0], rim: 0.3 }), x, 0.86, -4.76, set); x += w + 0.008; } }
  // a floor lamp in the coffee corner
  box(0.3, 0.03, 0.3, dark, -6.3, 0.015, 4.2, set); box(0.03, 1.5, 0.03, dark, -6.3, 0.76, 4.2, set);
  const fsh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 14, 1, true), glow("#f1d6a8", { k: 1.1, side: THREE.DoubleSide })); fsh.position.set(-6.3, 1.6, 4.2); set.add(fsh);
  set.userData.lamps.push({ p: V3(-6.3, 1.5, 4.2), range: 4.5, col: [1.2, 0.8, 0.45], cone: 0, fixed: true });
  set.userData.walls.push({ x0: -6.6, x1: -6.0, z0: 3.9, z1: 4.5 });
  // rain on the glass
  const wet = plane(6, 1.95, glow("#ffffff", { map: rainTex(), k: 0.4, alpha: 0.7 }), set); wet.position.set(0, 1.85, 4.96); wet.rotation.y = Math.PI;
  mergeStatic(set);
  set.userData.marks = {
    playerStart: V3(4.5, 0, 3.6), playerYaw: Math.PI,
    jason: V3(-1.3, 0, -0.55), jasonYaw: 0.4, jasonPhone: V3(-1.95, 0, -0.85),
    renata: V3(-0.2, 0, -2.75), renataYaw: 0
  };
  set.userData.spots.renata = { who: "renata", r: 2.0 };
  set.userData.bounds = { x0: -6.6, x1: 6.6, z0: -4.6, z1: 4.6 };
  return set;
}

/* ================================================================
   THE LIBRARY (a memory)
   ================================================================ */
export function buildLibrary(o) {
  const set = new THREE.Group(); set.name = "memory";
  set.userData = { lamps: [], spots: {}, walls: [] };
  const floor = plane(24, 18, paint({ color: "#4a3626", wet: 0.5, rim: 0.2 }), set); floor.rotation.x = -Math.PI / 2;
  const wallM = paint({ color: "#6a5a48", rim: 0.2, ao: 0.4 });
  const back = plane(24, 6, wallM, set); back.position.set(0, 3, -9);
  // tall windows, night outside
  for (let i = 0; i < 5; i++) { const w = plane(1.6, 3.6, glow("#1b2a3a", { k: 1 }), set); w.position.set(-8 + i * 4, 3.2, -8.98); box(1.8, 0.1, 0.1, paint({ color: "#2a2018" }), -8 + i * 4, 1.4, -8.95, set); }
  const wood = paint({ color: "#5a3e28", wet: 0.6, rim: 0.4, ao: 0.4 }), brass = paint({ color: "#b08a4a", wet: 2.2, rim: 0.5 });
  const shade = glow("#2f6a46", { k: 0.9 });
  // long tables with green lamps; one of them is the desk
  const r = rng(11);
  for (const [tx, tz] of [[-6, -3], [6, -3], [-6, 3], [6, 3], [0, 3]]) {
    const t = new THREE.Group(); t.position.set(tx, 0, tz); set.add(t);
    box(4.2, 0.08, 1.4, wood, 0, 0.78, 0, t); box(0.1, 0.76, 1.2, wood, -1.9, 0.38, 0, t); box(0.1, 0.76, 1.2, wood, 1.9, 0.38, 0, t);
    for (const lx of [-1.1, 1.1]) { box(0.04, 0.34, 0.04, brass, lx, 0.99, 0, t); const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 0.12, 10, 1, true), shade); sh.position.set(lx, 1.18, 0); t.add(sh); set.userData.lamps.push({ p: V3(tx + lx, 1.05, tz), range: 3.2, col: [1.25, 0.95, 0.55], cone: 0, fixed: true }); }
    set.userData.walls.push({ x0: tx - 2.2, x1: tx + 2.2, z0: tz - 0.8, z1: tz + 0.8 });
  }
  // the stacks, left and right
  const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), paint({ color: "#ffffff", vcol: false, rim: 0.3 }), 1400);
  const col = new THREE.Color(), m4 = new THREE.Matrix4(); let n = 0;
  const bc = ["#6a2f2a", "#24402f", "#2d3b4f", "#8a7a5a", "#3a2a22", "#5a5a52", "#7a5a3a"];
  for (const sx of [-11, 11]) for (let row = 0; row < 3; row++) {
    const zc = -6 + row * 5; box(0.5, 3.2, 4, wood, sx, 1.6, zc, set); set.userData.walls.push({ x0: sx - 0.4, x1: sx + 0.4, z0: zc - 2, z1: zc + 2 });
    for (let s = 0; s < 6; s++) { let z = zc - 1.9; while (z < zc + 1.85 && n < 1400) { const w = 0.03 + r() * 0.05, h = 0.22 + r() * 0.12; m4.compose(V3(sx + (sx < 0 ? 0.3 : -0.3), 0.3 + s * 0.5 + h / 2, z + w / 2), new THREE.Quaternion(), V3(0.2, h, w)); books.setMatrixAt(n, m4); books.setColorAt(n, col.set(bc[(r() * bc.length) | 0])); n++; z += w + 0.005; } }
  }
  books.count = n; set.add(books);
  books.material = paint({ color: "#ffffff", rim: 0.3 });
  // the desk where you sit: laptop, certificate, folder, letter, brain model, the lamp
  const D = V3(0, 0, 3);
  const lap = new THREE.Group(); lap.position.set(-0.7, 0.82, 3.1); set.add(lap);
  box(0.4, 0.02, 0.28, paint({ color: "#1b1e1d" }), 0, 0, 0, lap);
  const ld = new THREE.Group(); ld.position.set(0, 0.01, -0.13); ld.rotation.x = -0.3; lap.add(ld); box(0.4, 0.27, 0.015, paint({ color: "#1b1e1d" }), 0, 0.135, 0, ld);
  const lsc = plane(0.37, 0.24, glow("#ffffff", { map: TX.screenTex("courses"), k: 0.9 }), ld); lsc.position.set(0, 0.135, 0.009);
  const doc = (kind, x, z, rot) => { const d = plane(0.21, 0.28, paint({ map: TX.docTex(kind), color: "#fff", rim: 0.2 }), set); d.rotation.set(-Math.PI / 2, 0, rot); d.position.set(x, 0.825, z); return d; };
  doc("cert", 0.2, 3.25, 0.15); doc("folder", 0.62, 2.95, -0.2); doc("letter", -0.2, 2.8, 0.35);
  const brain = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 3), paint({ color: "#c9908a", rim: 0.6, wet: 0.5 }));
  { const p = brain.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const v = V3(p.getX(i), p.getY(i), p.getZ(i)); const k = 1 + 0.08 * Math.sin(v.x * 90) * Math.sin(v.y * 80 + v.z * 70); v.multiplyScalar(k); v.y *= 0.8; v.z *= 1.2; p.setXYZ(i, v.x, v.y, v.z); } brain.geometry.computeVertexNormals(); }
  brain.position.set(1.4, 0.9, 3.05); set.add(brain);
  set.userData.deskLamp = set.userData.lamps.find(l => Math.abs(l.p.x - 1.1) < 0.01 && Math.abs(l.p.z - 3) < 0.01) || null;
  set.userData.spots["mem-laptop"] = { p: V3(-0.7, 0.95, 3.0), r: 1.4, stand: V3(-0.7, 0, 4.1) };
  set.userData.spots["mem-cert"] = { p: V3(0.2, 0.85, 3.25), r: 1.3, stand: V3(0.2, 0, 4.1) };
  set.userData.spots["mem-folder"] = { p: V3(0.62, 0.85, 2.95), r: 1.3, stand: V3(0.6, 0, 4.1) };
  set.userData.spots["mem-letter"] = { p: V3(-0.2, 0.85, 2.8), r: 1.3, stand: V3(-0.2, 0, 4.1) };
  set.userData.spots["mem-brain"] = { p: V3(1.4, 0.95, 3.05), r: 1.3, stand: V3(1.4, 0, 4.1) };
  set.userData.spots["mem-lamp"] = { p: V3(1.1, 1.15, 3.0), r: 1.5, stand: V3(1.1, 0, 4.1) };
  set.userData.walls.push({ x0: -12, x1: 12, z0: -9.4, z1: -8.9 }, { x0: -12, x1: 12, z0: 8.9, z1: 9.4 }, { x0: -12.4, x1: -11.9, z0: -9, z1: 9 }, { x0: 11.9, x1: 12.4, z0: -9, z1: 9 });
  // a reading room someone uses: chairs pulled out, stacks left open, a cart, a runner, a clock, rain on the tall windows
  const chairM = paint({ color: "#3a2a1c", wet: 0.5, rim: 0.4, ao: 0.4 }), paper = paint({ color: "#e6dfcf", rim: 0.2 });
  const rr = rng(23);
  for (const [tx, tz] of [[-6, -3], [6, -3], [-6, 3], [6, 3], [0, 3]]) for (const side of [-1, 1]) for (const cx of [-1.2, 0, 1.2]) {
    if (tx === 0 && side > 0) continue; // your side of the desk stays open
    const c = new THREE.Group(); c.position.set(tx + cx + (rr() - 0.5) * 0.2, 0, tz + side * (0.95 + rr() * 0.25)); c.rotation.y = (side > 0 ? Math.PI : 0) + (rr() - 0.5) * 0.4; set.add(c);
    box(0.44, 0.05, 0.44, chairM, 0, 0.46, 0, c); box(0.44, 0.5, 0.05, chairM, 0, 0.72, 0.21, c); for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) box(0.04, 0.46, 0.04, chairM, lx, 0.23, lz, c);
  }
  for (const [tx, tz] of [[-6, -3], [6, -3], [-6, 3], [6, 3]]) for (let k = 0; k < 3; k++) {
    const x = tx - 1.5 + rr() * 3, z = tz + (rr() - 0.5) * 0.8; let y = 0.82;
    for (let b = 0; b < 2 + ((rr() * 3) | 0); b++) { const h = 0.03 + rr() * 0.03; const m = box(0.22 + rr() * 0.08, h, 0.3, paint({ color: bc[(rr() * bc.length) | 0], rim: 0.3 }), x, y + h / 2, z, set); m.rotation.y = (rr() - 0.5) * 0.5; y += h; }
    if (rr() < 0.6) { const pg = plane(0.42, 0.3, paper, set); pg.rotation.set(-Math.PI / 2, 0, (rr() - 0.5) * 0.6); pg.position.set(x + 0.4, 0.825, z + 0.1); }
  }
  // the cart of returns
  { const c = new THREE.Group(); c.position.set(-2.6, 0, 6.2); c.rotation.y = 0.3; set.add(c); box(1.0, 0.04, 0.45, wood, 0, 0.3, 0, c); box(1.0, 0.04, 0.45, wood, 0, 0.75, 0, c); for (const lx of [-0.48, 0.48]) box(0.04, 0.8, 0.45, wood, lx, 0.4, 0, c);
    let x = -0.44; while (x < 0.44) { const w = 0.04 + rr() * 0.04, h = 0.24 + rr() * 0.1; box(w, h, 0.2, paint({ color: bc[(rr() * bc.length) | 0], rim: 0.3 }), x, 0.77 + h / 2, 0, c); x += w + 0.01; }
    set.userData.walls.push({ x0: -3.3, x1: -1.9, z0: 5.8, z1: 6.6 }); }
  const runner = plane(3, 14, paint({ color: "#5a2a22", rim: 0.1, ao: 0.3 }), set); runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.012, 0);
  const clk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 28), paint({ color: "#e6dfcf", rim: 0.2 })); clk.rotation.x = Math.PI / 2; clk.position.set(0, 5.2, -8.95); set.add(clk);
  for (let i = 0; i < 5; i++) { const w = plane(1.6, 3.6, glow("#ffffff", { map: rainTex(), k: 0.35, alpha: 0.8 }), set); w.position.set(-8 + i * 4, 3.2, -8.94); }
  mergeStatic(set);
  set.userData.marks = { playerStart: V3(0, 0, 4.4), playerYaw: Math.PI };
  set.userData.bounds = { x0: -11.5, x1: 11.5, z0: -8.5, z1: 8.5 };
  return set;
}

/* the keys: a lockbox on the office door of the morning lot */
export function addKeys(set) {
  const g = new THREE.Group(); g.position.set(13.8, 1.3, -17.88); set.add(g);
  box(0.16, 0.2, 0.08, paint({ color: "#3a3a36", wet: 1.2 }), 0, 0, 0, g);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.005, 6, 16), paint({ color: "#c9a96a", wet: 2.5, emit: "#2a1e08" })); ring.position.set(0, -0.16, 0.05); g.add(ring);
  const key = box(0.012, 0.07, 0.004, paint({ color: "#c9c4b8", wet: 2.5 }), 0, -0.21, 0.05, g);
  set.userData.keys = g;
  set.userData.spots.keys = { p: V3(13.8, 1.2, -17.8), r: 2.2, stand: V3(13.6, 0, -16.3) };
}
/* the loads, last so everything above exists. The lot is the first scene: its cars and ground arrive before the module finishes (a slow line gives up after a while and the lot builds with what it has) */
export const lotReady = Promise.all([loadCars().catch(e => console.warn("[world] cars", e)), loadSetTex(LOT_TEX)]);
export const roomsReady = lotReady.then(() => loadSetTex(ROOM_TEX));
await Promise.race([lotReady, new Promise(r => setTimeout(r, 15000))]);
export const _debug = { carLib, T, TIER };
