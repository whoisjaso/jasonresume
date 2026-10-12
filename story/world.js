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
import { RoundedBoxGeometry } from "../vendor/three-0.184.0/addons/geometries/RoundedBoxGeometry.js";

/* the quality ladder's asset half: phones get the lighter cars and smaller textures; ?wq=lo|hi forces one */
const COARSE = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
// the test harness (?debug=story&fast=1) plays on a software renderer: it gets the light tier so the game clock keeps up
const HARNESS = typeof location !== "undefined" && /[?&]debug=story/.test(location.search) && /[?&]fast=1/.test(location.search);
const WQ = (typeof location !== "undefined" && (location.search.match(/[?&]wq=(lo|hi)/) || [])[1]) || (COARSE || HARNESS ? "lo" : "hi");
export const TIER = { name: WQ, carLo: WQ === "lo", tex: WQ === "lo" ? 512 : 1024, env: WQ === "lo" ? 64 : 128 };
const BASE = new URL("../assets/story/world/", import.meta.url).href;
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const texLoader = new THREE.TextureLoader();
const texCache = new Map();
/* a texture from assets/story/world, tiled, sRGB for colour and linear for data; resolves even when it fails (null) */
/* progress for the loading screen: document event jg:world-load, detail { f: 0..1, done, total } */
let loadDone = 0, loadTotal = 0;
function progress() {
  loadDone++;
  try { document.dispatchEvent(new CustomEvent("jg:world-load", { detail: { f: loadTotal ? Math.min(1, loadDone / loadTotal) : 1, done: loadDone, total: loadTotal } })); } catch (e) {}
}
function loadTex(name, o = {}) {
  const url = BASE + "tex-v1/" + name.replace("{s}", String(TIER.tex));
  if (texCache.has(url)) return texCache.get(url);
  loadTotal++;
  // a texture that fails or stalls resolves to null after a while; the material falls back to a flat colour
  const p = new Promise(res => {
    const to = setTimeout(() => { console.warn("[world] slow texture", url); res(null); }, 12000);
    texLoader.load(url, t => { clearTimeout(to); t.colorSpace = o.data ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; res(t); },
      undefined, () => { clearTimeout(to); console.warn("[world] texture failed", url); res(null); });
  }).finally(progress);
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
    if (ud.fogDen != null) U.uFogDen.value = ud.fogDen;
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
export function groundMat(g, o = {}) {
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); white.needsUpdate = true;
  const flat = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1); flat.needsUpdate = true;
  const grey = new THREE.DataTexture(new Uint8Array([60, 60, 60, 255]), 1, 1); grey.colorSpace = THREE.SRGBColorSpace; grey.needsUpdate = true;
  const arm0 = new THREE.DataTexture(new Uint8Array([255, 200, 0, 255]), 1, 1); arm0.needsUpdate = true;
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uDetail: { value: g.detail }, uMask: { value: g.mask }, uRefl: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
      uSize: { value: new THREE.Vector2(g.W, g.H) }, uRain: { value: o.rain != null ? o.rain : 1 }, uWet: { value: o.wet != null ? o.wet : 1 }, uReflK: { value: 1 },
      uAsC: { value: T.asphC || grey }, uAsN: { value: T.asphN || flat }, uAsR: { value: T.asphR || arm0 },
      uCoC: { value: T.concC || grey }, uCoN: { value: T.concN || flat }, uCoR: { value: T.concR || arm0 },
      uSh0: { value: o.sh ? o.sh[0] : white }, uSh1: { value: o.sh ? o.sh[1] : white }, uShLamp: { value: (o.shLamps || []).concat(Array(8).fill(new THREE.Vector3(0, -999, 0))).slice(0, 8) },
      uTile: { value: 3.6 }, uDay: { value: o.day ? 1 : 0 } },
    vertexShader: `varying vec3 vWP; varying vec2 vUv; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `
      #define PI_ 3.14159265
      uniform float uTime; uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uMoonDir; uniform vec3 uMoon; uniform vec3 uRim;
      uniform vec4 uLampPos[8]; uniform vec4 uLampCol[8]; uniform int uLampN; uniform vec3 uFog; uniform float uFogDen; uniform float uSat;
      uniform sampler2D uDetail; uniform sampler2D uMask; uniform sampler2D uRefl; uniform vec2 uRes; uniform vec2 uSize; uniform float uRain; uniform float uWet; uniform float uReflK;
      uniform sampler2D uAsC; uniform sampler2D uAsN; uniform sampler2D uAsR; uniform sampler2D uCoC; uniform sampler2D uCoN; uniform sampler2D uCoR;
      uniform sampler2D uSh0; uniform sampler2D uSh1; uniform vec3 uShLamp[8]; uniform float uTile; uniform float uDay;
      uniform samplerCube uEnv; uniform float uEnvOn; uniform float uEnvMax;
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
      // splashes: a drop lands and throws up a bright point for a few frames
      float splash(vec2 p, float t){
        vec2 q = p * 2.2; vec2 c = floor(q), f = fract(q);
        float ph = fract(t * 1.7 + h21(c + 1.3)); vec2 o = vec2(h21(c + 5.1), h21(c + 9.2));
        return smoothstep(0.06, 0.0, length(f - o)) * smoothstep(0.12, 0.0, ph);
      }
      float D_GGX(float a, float nh){ float a2 = a * a; float d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (PI_ * d * d + 1e-6); }
      float V_Smith(float a, float nv, float nl){ float a2 = a * a; float gv = nl * sqrt(nv * nv * (1.0 - a2) + a2); float gl = nv * sqrt(nl * nl * (1.0 - a2) + a2); return 0.5 / max(gv + gl, 1e-5); }
      float shadowOf(vec3 lp, vec4 s0, vec4 s1){
        for (int k = 0; k < 8; k++) { if (distance(lp, uShLamp[k]) < 0.05) { return k < 4 ? s0[k] : s1[k - 4]; } }
        return 1.0;
      }
      void main(){
        vec2 wuv = vWP.xz / uTile;
        vec4 dt = texture2D(uDetail, vUv), mk = texture2D(uMask, vUv);
        float conc = step(0.75, mk.b), seal = step(0.3, mk.b) * (1.0 - conc);
        // the asphalt, tiled at two scales against repetition; concrete where the mask says so
        vec3 asC = texture2D(uAsC, wuv).rgb * mix(0.82, 1.18, texture2D(uAsC, wuv * 0.173 + 0.37).g * 2.0 - 0.4);
        vec3 coC = texture2D(uCoC, wuv * 0.8).rgb;
        vec3 alb = mix(asC * 0.85, coC * 1.05, conc);
        vec3 arm = mix(texture2D(uAsR, wuv).rgb, texture2D(uCoR, wuv * 0.8).rgb, conc);
        vec3 tn = mix(texture2D(uAsN, wuv).xyz, texture2D(uCoN, wuv * 0.8).xyz, conc) * 2.0 - 1.0;
        // patches and oil (R), worn paint (G), tar seal (A)
        float mul = dt.r * 2.0; alb *= mix(1.0, mul, 1.0 - conc);
        float oil = smoothstep(0.42, 0.2, dt.r) * (1.0 - conc);
        vec3 paintC = vec3(0.78, 0.74, 0.62) * mix(0.75, 1.0, texture2D(uAsC, wuv * 3.1).r * 2.0);
        float pnt = smoothstep(0.15, 0.6, dt.g);
        alb = mix(alb, paintC, pnt);
        alb = mix(alb, vec3(0.025), seal * 0.85);
        float ao = dt.b * mix(1.0, arm.r, 0.6);
        float rough = mix(arm.g, 0.55, pnt * 0.5); rough = mix(rough, 0.32, seal * 0.6);
        // water: the whole lot is wet, the low spots stand in puddles
        float wet = uWet * mk.g;
        float pud = smoothstep(0.32, 0.62, mk.r) * uWet;
        float damp = clamp(wet * (0.7 + 0.3 * (1.0 - arm.g)), 0.0, 1.0);
        alb *= mix(1.0, 0.5, damp * (1.0 - pud * 0.3)); alb *= mix(1.0, 0.75, pud);
        rough = mix(rough, mix(0.32, 0.18, oil), damp); rough = mix(rough, 0.02, pud);
        // normal: the asphalt's grain flattens under water; rain rings in puddles, finer pitting elsewhere
        vec2 rp = ripple(vWP.xz, uTime) * uRain;
        vec3 N = normalize(vec3(tn.x * (1.0 - pud) * 0.9, 1.0, tn.y * (1.0 - pud) * 0.9));
        N = normalize(N + vec3(rp.x, 0.0, rp.y) * (0.03 + pud * 0.14));
        vec3 V = normalize(cameraPosition - vWP);
        float nv = max(dot(N, V), 1e-3);
        vec4 s0 = texture2D(uSh0, (vWP.xz + uSize * 0.5) / uSize), s1 = texture2D(uSh1, (vWP.xz + uSize * 0.5) / uSize);
        // light: sky and ground fill, the moon, the lamps with their baked shadows
        vec3 dif = mix(uGround, uSky, 0.55) * ao + uMoon * max(dot(N, uMoonDir), 0.0) * 0.6;
        vec3 spec = vec3(0.0);
        float a = max(rough * rough, 0.002);
        for (int i = 0; i < 8; i++) {
          if (i >= uLampN) break;
          vec3 L = uLampPos[i].xyz - vWP; float d = length(L); L /= d;
          float att = clamp(1.0 - d / uLampPos[i].w, 0.0, 1.0); att *= att;
          float cone = 1.0; if (uLampCol[i].w > 0.0) cone = smoothstep(uLampCol[i].w, uLampCol[i].w + 0.25, dot(-L, vec3(0.0, -1.0, 0.0)));
          vec3 lc = uLampCol[i].rgb * att * cone * shadowOf(uLampPos[i].xyz, s0, s1);
          float nl = max(dot(N, L), 0.0);
          dif += lc * nl;
          // the lamp's highlight: GGX, widened by the lamp's size; wet asphalt stretches it toward you
          float ap = clamp(a + 0.2 / max(d * 2.0, 0.5), 0.0, 1.0);
          vec3 H = normalize(L + V); float nh = max(dot(N, H), 0.0), vh = max(dot(V, H), 0.0);
          float F = 0.03 + 0.97 * pow(1.0 - vh, 5.0);
          spec += lc * D_GGX(ap, nh) * V_Smith(ap, nv, nl) * nl * F * PI_ * (a * a / max(ap * ap, 1e-4) * 0.7 + 0.3) * (0.4 + 0.6 * damp);
        }
        vec3 col = alb * dif * (1.0 - pud * 0.25) + spec;
        // the reflection: the mirrored scene, sharp in puddles, smeared downward on wet asphalt
        float fres = 0.025 + 0.975 * pow(1.0 - nv, 5.0);
        float rk = mix(mix(0.05, 0.7, damp) * (1.0 - rough), 0.98, pud) * fres * uReflK;
        rk = mix(rk, max(rk, 0.18 * damp * (1.0 - rough)), 0.6);
        vec2 suv = gl_FragCoord.xy / uRes + N.xz * vec2(0.012, 0.03) * (1.0 + pud);
        vec3 rc = vec3(0.0); float tot = 0.0; float spread = mix(0.03, 0.002, pud) * (0.4 + rough);
        for (int j = -3; j <= 3; j++) { float w = 1.0 - abs(float(j)) / 4.0; rc += texture2D(uRefl, suv + vec2(0.0, float(j) * spread)).rgb * w; tot += w; }
        rc /= tot;
        // before the mirror has a frame (or on a low tier), the set's cube stands in
        if (uReflK < 0.01 && uEnvOn > 0.5) { vec3 R = reflect(-V, N); rc = textureLod(uEnv, R, rough * uEnvMax).rgb; rk = mix(0.04, 0.9, pud) * fres * damp; }
        col = mix(col, rc, clamp(rk, 0.0, 0.95));
        // oil on water: a faint film where the oil is
        col += oil * pud * vec3(0.02, 0.012, 0.03) * (0.5 + 0.5 * sin(dot(vWP.xz, vec2(9.0, 13.0)) + uTime * 0.3));
        col += vec3(1.0, 0.85, 0.65) * splash(vWP.xz, uTime) * uRain * length(dif) * 0.6;
        float l = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(l), col, uSat);
        float fd = length(vWP - cameraPosition); col = mix(col, uFog, clamp(1.0 - exp(-uFogDen * fd), 0.0, 1.0));
        gl_FragColor = vec4(clamp(col, 0.0, 24.0), 1.0);
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
/* a node's own meshes (not those of the moving parts hung from it), merged by material, in the car's space */
function nodeParts(node) {
  const byMat = new Map();
  const walk = o => {
    if (o !== node && MOVING.test(o.name)) return;
    if (o.isMesh) {
      const name = (o.material && o.material.name || "trim").replace(/\.\d+$/, "");
      if (!byMat.has(name)) byMat.set(name, []);
      byMat.get(name).push(floatGeo(o));
    }
    for (const c of o.children) walk(c);
  };
  walk(node);
  const parts = {};
  for (const [name, list] of byMat) {
    for (const g of list) for (const k of Object.keys(g.attributes)) if (!["position", "normal", "color"].includes(k)) g.deleteAttribute(k);
    for (const g of list) if (!g.attributes.color) { const c = new Float32Array(g.attributes.position.count * 4).fill(1); g.setAttribute("color", new THREE.BufferAttribute(c, 4)); }
    const m = list.length > 1 ? mergeGeometries(list, false) : list[0];
    if (m) { m.computeBoundingSphere(); parts[name] = m; }
  }
  return parts;
}
const MOVING = /^(door_[LR]|wheel_[FR][LR]|steer)$/;
async function loadCars() {
  await Promise.allSettled(CAR_KINDS.map(async kind => {
    const url = BASE + "car-" + kind + (TIER.carLo ? "-lo" : "") + "-v2.glb";
    let gltf;
    try { gltf = await Promise.race([loader.loadAsync(url), new Promise((_, rej) => setTimeout(() => rej(new Error("timed out")), 12000))]); } catch (e) { console.warn("[world] car " + kind, e && e.message); return; } finally { progress(); }
    let meta = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o => { if (o.userData && o.userData.L) meta = o.userData; });
    // parked: every part in place, merged by material (doors shut, wheels straight), for instancing
    const parts = {};
    const all = new Map();
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      const name = (o.material && o.material.name || "trim").replace(/\.\d+$/, "");
      if (!all.has(name)) all.set(name, []);
      all.get(name).push(floatGeo(o));
    });
    for (const [name, list] of all) {
      for (const g of list) for (const k of Object.keys(g.attributes)) if (!["position", "normal", "color"].includes(k)) g.deleteAttribute(k);
      for (const g of list) if (!g.attributes.color) { const c = new Float32Array(g.attributes.position.count * 4).fill(1); g.setAttribute("color", new THREE.BufferAttribute(c, 4)); }
      const m = list.length > 1 ? mergeGeometries(list.map(g => (g.index ? g : g)), false) : list[0];
      if (!m) { console.warn("[world] car " + kind + " " + name + " did not merge"); continue; }
      m.computeBoundingSphere(); parts[name] = m;
    }
    // drivable: each moving node on its own (its meshes in the car's space, so the paint's panel lines stay put)
    const nodes = {};
    gltf.scene.traverse(o => { if (MOVING.test(o.name) || o.name === "body" || /^seat_[DP]$/.test(o.name)) nodes[o.name] = o; });
    carLib[kind] = { parts, nodes, scene: gltf.scene, meta: meta || { L: 4.7, W: 1.85, H: 1.45, cab: [1.5, 2.3, 3.3, 4.0], sg: [1.7, 3.6], pillars: [2.9], axles: [1, 3.8], tr: 0.33 } };
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
    // tinted and see-through, so the cabin reads: the seats, the dash, the wheel
    glass: pbr({ ...v, color: "#0b0e10", rough: 0.035, wet: 1, drops: true, spec: 1.0, diff: 0.6, alpha: 0.42, glass: true, depthWrite: false, ao: 0 }),
    trim: pbr({ ...v, color: "#141516", rough: 0.55, wet: 0.8 }),
    chrome: pbr({ ...v, color: "#c9ccd0", metal: 1, rough: 0.14, wet: 0.6 }),
    tire: pbr({ ...v, color: "#141414", rough: 0.82, wet: 0.7 }),
    rim: pbr({ ...v, color: "#a3a7ab", metal: 1, rough: 0.28, wet: 0.6 }),
    disc: pbr({ ...v, color: "#4c4946", metal: 1, rough: 0.55, wet: 0.3 }),
    well: pbr({ ...v, color: "#060606", rough: 0.9, wet: 0.3, spec: 0.5 }),
    lamp_head: pbr({ ...v, color: "#b9bdc0", metal: 0.85, rough: 0.07, wet: 1, drops: true }),
    lamp_tail: pbr({ ...v, color: "#3a0605", rough: 0.05, wet: 1, drops: true, spec: 1.2, diff: 0.6 }),
    lamp_tail_in: pbr({ ...v, color: "#8a1410", rough: 0.3, wet: 0.3, emit: "#1c0201" }),
    lamp_head_in: pbr({ ...v, color: "#d8d8d0", metal: 0.9, rough: 0.12, wet: 0.3 }),
    lamp_amber: pbr({ ...v, color: "#7a3c06", rough: 0.08, wet: 1, emit: "#0a0400" }),
    plate: pbr({ ...v, color: "#9a968c", map: TX.plateTex(), nmap: TX.plateTex(true), tri: 4, local: true, nk: 0.8, rough: 0.5, wet: 0.6 }),
    interior: pbr({ ...v, color: "#141414", rough: 0.85, wet: 0, spec: 0.4 }),
    seat: pbr({ ...v, color: "#1c1c1d", rough: 0.92, wet: 0, spec: 0.3 }),
    dash: pbr({ ...v, color: "#111213", rough: 0.6, wet: 0, spec: 0.6 }),
    cluster: pbr({ ...v, color: "#08090a", rough: 0.2, wet: 0, spec: 0.8 }),
    lamp_rev: pbr({ ...v, color: "#c8c8c4", metal: 0.6, rough: 0.12, wet: 0.6, drops: true }),
    lamp_brake: pbr({ ...v, color: "#3a0605", rough: 0.08, wet: 0.8, spec: 1.1 }),
    sticker: pbr({ color: "#ece5d4", rough: 0.6, wet: 0, ao: 0, emit: "#0c0a07" }),
    idleTail: pbr({ ...v, color: "#5a0806", rough: 0.05, wet: 1, drops: true, emit: "#3a0302" }),
    idleTailIn: pbr({ ...v, color: "#8a1410", rough: 0.3, wet: 0.3, emit: "#ff1a0a" }),
    idleHeadIn: pbr({ ...v, color: "#ffffff", rough: 0.1, wet: 0.3, emit: "#fff6e6" }),
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
      panel: { tex: panelTex(meta), box: [meta.L / 2, meta.L, meta.H, meta.W / 2] } });
  }
  return M.paint[key];
}
/* a used-car lot's colours: mostly white, silver, grey and black, then the few that sell on colour */
export const CAR_COLORS = [
  ["#d9d8d2", 0], ["#aeb2b5", 1], ["#6f7478", 1], ["#16181a", 0], ["#f0eee8", 0], ["#3a3f44", 1], ["#1d2b40", 1], ["#5b1416", 1],
  ["#8d8270", 1], ["#2c3a30", 0], ["#9b1b14", 0], ["#c5c7c9", 1], ["#4a5560", 1], ["#2a2a2c", 1], ["#e6e3dc", 0], ["#7d8b97", 1]
];
/* where each parked car lives in the instanced meshes, so a knock can rock it (rockCar / tickCars below) */
function slotOf(c, im, i, local) { Object.defineProperty(c, "_slots", { value: c._slots || [], enumerable: false, writable: true }); c._slots.push([im, i, local]); }
/* a parked car that was hit rocks on its springs and creeps a few centimetres; it never drives off */
function rockCar(c, strength, nx, nz) {
  if (!c._slots) return;
  const r = c._rock || (c._rock = { t: 0, ax: 0, az: 0, live: false });
  const k = Math.min(1, strength / 6);
  // in the car's frame: a push along its length pitches it, across it rolls it
  const cs = Math.cos(c.yaw), sn = Math.sin(c.yaw), along = nx * sn + nz * cs, across = nx * cs - nz * sn;
  r.ax += -along * 0.05 * k; r.az += across * 0.06 * k; r.live = true;
  const shove = Math.min(0.04 * k, Math.max(0, 0.25 - (c._shoved || 0)));
  c._shoved = (c._shoved || 0) + shove; c.x -= nx * shove; c.z -= nz * shove;
  if (c.collider) { c.collider.x = c.x; c.collider.z = c.z; }
}
function tickCars(list, dt) {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, "YXZ"), s1 = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  for (const c of list) {
    const r = c._rock; if (!r || !r.live) continue;
    // a damped spring on each axis (about 1.6 Hz, settles in a second or so)
    r.t += dt; const w = 10, z = 0.18;
    r.vx = (r.vx || 0) + (-w * w * r.ax - 2 * z * w * (r.vx || 0)) * dt; r.ax += r.vx * dt;
    r.vz = (r.vz || 0) + (-w * w * r.az - 2 * z * w * (r.vz || 0)) * dt; r.az += r.vz * dt;
    if (Math.abs(r.ax) + Math.abs(r.az) + Math.abs(r.vx) + Math.abs(r.vz) < 1e-4) { r.ax = r.az = r.vx = r.vz = 0; r.live = false; }
    e.set(r.ax, c.yaw, r.az); q.setFromEuler(e); p.set(c.x, (c.y || 0) + Math.abs(r.az) * 0.4, c.z);
    for (const [im, i, local] of c._slots) {
      m4.compose(p, q, s1); if (local) m4.multiply(local);
      im.setMatrixAt(i, m4); im.instanceMatrix.needsUpdate = true;
    }
  }
}
/* place cars: list of { kind, x, z, yaw, color, metal, idle } in the set's space; returns the instanced meshes */
function parkCars(set, list) {
  const M = carMats(), out = [];
  const byKind = {};
  for (const c of list) (byKind[c.kind] = byKind[c.kind] || []).push(c);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  for (const [kind, cars] of Object.entries(byKind)) {
    // a kind whose file failed falls back to one that loaded, so a slow line never leaves a lot of wheels
    const lib = carLib[kind] || carLib[Object.keys(carLib)[0]]; if (!lib) continue;
    for (const [name, geo] of Object.entries(lib.parts)) {
      if (name === "paint") {
        for (const metallic of [false, true]) {
          const sub = cars.filter(c => !!c.metal === metallic); if (!sub.length) continue;
          const im = new THREE.InstancedMesh(geo, paintMat(carLib[kind] ? kind : Object.keys(carLib)[0], metallic), sub.length);
          sub.forEach((c, i) => { m4.compose(new THREE.Vector3(c.x, c.y || 0, c.z), q.setFromAxisAngle(up, c.yaw), s1); im.setMatrixAt(i, m4); im.setColorAt(i, col.set(c.color).convertSRGBToLinear()); slotOf(c, im, i, null); });
          im.userData.keep = true; set.add(im); out.push(im);
        }
        continue;
      }
      const idleSwap = { lamp_tail: M.idleTail, lamp_head: M.idleHead, lamp_tail_in: M.idleTailIn, lamp_head_in: M.idleHeadIn }[name] || null;
      const groups = idleSwap ? [cars.filter(c => !c.idle), cars.filter(c => c.idle)] : [cars];
      groups.forEach((sub, gi) => {
        if (!sub.length) return;
        const im = new THREE.InstancedMesh(geo, gi === 1 ? idleSwap : (M[name] || M.trim), sub.length);
        sub.forEach((c, i) => { m4.compose(new THREE.Vector3(c.x, c.y || 0, c.z), q.setFromAxisAngle(up, c.yaw), s1); im.setMatrixAt(i, m4); slotOf(c, im, i, null); });
        im.userData.keep = true; set.add(im); out.push(im);
      });
    }
    // a plain sticker inside each windshield, low on the passenger side: no figures on it
    const meta = lib.meta, [c0, c1] = meta.cab, belt = (meta.belt || [0.9, 0.95])[1];
    const top = meta.H || 1.45, sl = Math.atan2(c1 - c0, top - belt);
    const st = new THREE.InstancedMesh(STICKER_GEO, M.sticker, cars.length);
    cars.forEach((c, i) => {
      const local = new THREE.Matrix4().compose(new THREE.Vector3(-0.42, belt + 0.1, meta.L / 2 - c0 - (c1 - c0) * 0.18 - 0.03), new THREE.Quaternion().setFromEuler(new THREE.Euler(-sl, 0, 0)), s1);
      m4.compose(new THREE.Vector3(c.x, c.y || 0, c.z), q.setFromAxisAngle(up, c.yaw), s1).multiply(local); st.setMatrixAt(i, m4); slotOf(c, st, i, local);
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
/* ---------- a car you can drive: the same model as a rig (body, doors on hinges, wheels on hubs, the steering
   wheel on its column, the seats), each part an instance of one so it paints exactly like the parked rows.
   story/vehicle.js moves it; tools/story/HANDOFF-drive.md is the contract. ---------- */
/* each drivable car owns its lamps and its cluster, so one car's brake lights are its own */
const OWN = {
  lamp_head: { vao: true, color: "#b9bdc0", metal: 0.85, rough: 0.07, wet: 1, drops: true },
  lamp_head_in: { vao: true, color: "#d8d8d0", metal: 0.9, rough: 0.12, wet: 0.3 },
  lamp_tail: { vao: true, color: "#3a0605", rough: 0.05, wet: 1, drops: true, spec: 1.2, diff: 0.6 },
  lamp_tail_in: { vao: true, color: "#8a1410", rough: 0.3, wet: 0.3 },
  lamp_brake: { vao: true, color: "#3a0605", rough: 0.08, wet: 0.8, spec: 1.1 },
  lamp_rev: { vao: true, color: "#c8c8c4", metal: 0.6, rough: 0.12, wet: 0.6, drops: true },
  cluster: { vao: true, color: "#08090a", rough: 0.2, wet: 0, spec: 0.8 }
};
/* the lamps' glow by state, linear colours times a strength (vehicle.js and the idle car use this) */
export function carLights(own, o) {
  const k = (v) => (v === true ? 1 : v ? +v : 0);
  const head = k(o.head), tail = Math.max(k(o.tail), head * 0.6), brake = k(o.brake), rev = k(o.reverse), cl = k(o.cluster);
  const set = (m, hex, f) => { if (m) m.uniforms.uEmit.value.set(hex).multiplyScalar(f); };
  set(own.lamp_head_in, "#fff6e6", head * 1.4); set(own.lamp_head, "#fff4e0", head * 0.55);
  set(own.lamp_tail_in, "#ff1a0a", Math.max(tail * 0.45, brake * 1.6)); set(own.lamp_tail, "#5a0604", Math.max(tail * 0.35, brake * 1.0));
  set(own.lamp_brake, "#ff1a0a", brake * 1.5); set(own.lamp_rev, "#fff4ea", rev * 1.3);
  set(own.cluster, "#8fb4c8", cl * 0.22);
}
function buildRig(set, c) {
  const lib = carLib[c.kind] || carLib[Object.keys(carLib)[0]]; if (!lib || !lib.nodes || !lib.nodes.body) return null;
  const meta = lib.meta, M = carMats(), root = c.object;
  const col = new THREE.Color().set(c.color).convertSRGBToLinear(), I = new THREE.Matrix4();
  const own = {}; for (const [k, o] of Object.entries(OWN)) own[k] = pbr0(o);
  const kindKey = carLib[c.kind] ? c.kind : Object.keys(carLib)[0];
  const inst = (geo, name, parent, offset) => {
    const mat = name === "paint" ? paintMat(kindKey, !!c.metal) : own[name] || M[name] || M.trim;
    const im = new THREE.InstancedMesh(geo, mat, 1); im.setMatrixAt(0, I);
    if (name === "paint") im.setColorAt(0, col);
    im.computeBoundingSphere(); im.userData.keep = true; im.name = name;
    if (offset) im.position.copy(offset).negate();
    parent.add(im); return im;
  };
  const body = new THREE.Group(); body.name = "body"; root.add(body);
  for (const [name, geo] of Object.entries(nodeParts(lib.nodes.body))) inst(geo, name, body);
  const at = n => { const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); n.matrixWorld.decompose(p, q, sc); return { p, q }; };
  const doors = {};
  for (const side of ["L", "R"]) {
    const n = lib.nodes["door_" + side]; if (!n) continue;
    const { p } = at(n), pivot = new THREE.Group(); pivot.name = "door_" + side; pivot.position.copy(p); body.add(pivot);
    for (const [name, geo] of Object.entries(nodeParts(n))) inst(geo, name, pivot, p);
    doors[side] = pivot;
  }
  const wheels = [];
  for (const nm of ["wheel_FL", "wheel_FR", "wheel_RL", "wheel_RR"]) {
    const n = lib.nodes[nm]; if (!n) continue;
    const { p } = at(n), pivot = new THREE.Group(); pivot.name = nm; pivot.position.copy(p); pivot.rotation.order = "YXZ"; root.add(pivot);
    for (const [name, geo] of Object.entries(nodeParts(n))) inst(geo, name, pivot, p);
    pivot.userData.rest = p.clone(); wheels.push(pivot);
  }
  let steer = null;
  if (lib.nodes.steer) {
    const { p, q } = at(lib.nodes.steer);
    steer = new THREE.Group(); steer.name = "steer"; steer.position.copy(p); steer.quaternion.copy(q); body.add(steer);
    const inv = new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)).invert();
    for (const [name, geo] of Object.entries(nodeParts(lib.nodes.steer))) { const g = geo.clone().applyMatrix4(inv); inst(g, name, steer); }
    steer.userData.rimR = meta.rimR || 0.185; steer.userData.q0 = q.clone();
  }
  const seat = new THREE.Object3D(); seat.name = "seat_D"; const seatP = new THREE.Object3D(); seatP.name = "seat_P";
  if (lib.nodes.seat_D) seat.position.copy(at(lib.nodes.seat_D).p); if (lib.nodes.seat_P) seatP.position.copy(at(lib.nodes.seat_P).p);
  body.add(seat, seatP);
  // the soft dark under it, which goes where it goes
  const sh = new THREE.InstancedMesh(BLOB_GEO, blobMat(0.8, true), 1);
  sh.setMatrixAt(0, new THREE.Matrix4().compose(new THREE.Vector3(0, 0.012, 0), new THREE.Quaternion(), new THREE.Vector3(meta.W + 0.5, 1, meta.L + 0.5)));
  sh.layers.set(2); sh.renderOrder = 1; sh.userData.keep = true; sh.computeBoundingSphere(); root.add(sh);
  root.userData.rig = { body, doors, wheels, steer, seat, seatP, own, meta, shadow: sh, kind: kindKey };
  carLights(own, c.lights || {});
  return root.userData.rig;
}
const STICKER_GEO = new THREE.PlaneGeometry(0.2, 0.14);
const BLOB_GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
/* the footprint of a parked car, for walls and the ground's shade */
function carSize(kind) { const m = carLib[kind] && carLib[kind].meta; return m ? [m.W, m.L] : [1.85, 4.7]; }

/* ---------- a lot light: a square steel pole on a concrete base, a shoebox head (or two, back to back) ---------- */
function lampPost(x, z, h, set, o = {}) {
  const k = o.k || 1, day = !!o.day;
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const steel = pbr({ color: "#3a3d3f", metal: 0.7, rough: 0.45, wet: 0.9, drops: false });
  const conc = rmat({ color: "#8d8a82", rough: 0.85, wet: 0.8, mapK: "concC", tri: 0.9, nmapK: "concN" });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.75, 16), conc); base.position.y = 0.375; g.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, h - 0.75, 4, 1), steel); pole.rotation.y = Math.PI / 4; pole.position.y = 0.75 + (h - 0.75) / 2; g.add(pole);
  box(0.26, 0.04, 0.26, steel, 0, 0.77, 0, g);
  const heads = o.twin ? [1, -1] : [1];
  const lamps = [];
  for (const s of heads) {
    box(0.55, 0.07, 0.07, steel, s * 0.3, h - 0.06, 0, g);
    // the head: a low box with a chamfered top, the lens flush underneath
    const hd = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.13, 0.42), steel); hd.position.set(s * 0.82, h - 0.1, 0); g.add(hd);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.36), steel); top.position.set(s * 0.82, h - 0.01, 0); g.add(top);
    const lens = plane(0.6, 0.32, glow0(day ? "#c8c4b8" : "#ffd08a", { k: day ? 0.15 : 3.2 }), g); lens.rotation.x = Math.PI / 2; lens.position.set(s * 0.82, h - 0.168, 0); lens.userData.keep = true;
    // the cone of light in the rain
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 4.2 * k, h - 0.2, 32, 1, true), coneMat0("#ffb466", 0.75)); cone.userData.keep = true;
    cone.position.set(s * 0.82, (h - 0.2) / 2, 0); g.add(cone); cone.layers.set(3); cone.visible = !day;
    const L = { p: V3(x + s * 0.82, h - 0.2, z), range: 21 * k, col: [3.3 * k, 2.05 * k, 0.95 * k], cone: 0.28, glow: lens, coneMesh: cone };
    set.userData.lamps.push(L); lamps.push(L);
  }
  set.add(g);
  set.userData.walls.push({ x0: x - 0.4, x1: x + 0.4, z0: z - 0.4, z1: z + 0.4 });
  if (set.userData.colliders) set.userData.colliders.push({ type: "circle", x, z, r: 0.34, what: "pole" });
  return lamps;
}

function palm(x, z, h, set, r) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  if (set.userData.colliders) set.userData.colliders.push({ type: "circle", x, z, r: 0.24, what: "pole" });
  const pts = []; const lean = (r() - 0.5) * 0.8;
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(V3(lean * t * t, t * h, lean * 0.3 * t * t)); }
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.17, 7), pbr({ color: "#2b2620", rough: 0.9, wet: 0.6 }));
  g.add(trunk);
  const fm = paint({ color: "#141a14", map: set.userData.frond, alphaTest: 0.5, side: THREE.DoubleSide, rim: 0.3 });
  const top = pts[pts.length - 1];
  for (let i = 0; i < 13; i++) {
    const f = plane(1.4, 3.3, fm, g); f.position.copy(top); f.geometry.translate(0, 1.55, 0);
    f.rotation.set(0, (i / 13) * Math.PI * 2 + r(), 0); f.rotateX(-1.0 - r() * 0.7);
  }
  set.add(g);
}

/* the sky over Houston on a rainy night: low cloud lit orange from below by the city, darker overhead,
   the city's edge on the horizon (buildings, towers, a few lit windows and beacons) */
function skyDome(o) {
  return new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.62), new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uFog: U.uFog, uDay: { value: o.day ? 1 : 0 }, uMap: { value: TX.skylineTex() } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; uniform float uDay; uniform vec3 uFog; uniform sampler2D uMap; varying vec3 vD;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vD); float y = max(d.y, 0.0);
        // clouds: a slow-moving deck, projected onto a plane overhead
        vec2 cp = d.xz / max(d.y + 0.08, 0.04) * 0.35 + vec2(uTime * 0.004, uTime * 0.002);
        float cl = smoothstep(0.35, 0.8, fbm(cp));
        // the haze at the horizon is the scene's fog, so the ground meets the sky without a seam
        vec3 night = mix(uFog * 1.15 + vec3(0.012, 0.008, 0.004), vec3(0.006, 0.008, 0.011), smoothstep(0.0, 0.45, y));
        night += vec3(0.034, 0.021, 0.012) * cl * (1.0 - smoothstep(0.0, 0.6, y)) + vec3(0.008, 0.006, 0.005) * cl;
        vec3 day = mix(vec3(0.66, 0.66, 0.62), vec3(0.3, 0.45, 0.62), smoothstep(0.0, 0.5, y)) * mix(1.0, 1.15, cl);
        vec3 c = mix(night, day, uDay);
        // the skyline on the horizon
        float az = atan(d.z, d.x) / 6.2831853 + 0.5;
        float sy = d.y / 0.09;
        if (sy > 0.0 && sy < 1.0) { vec4 s = texture2D(uMap, vec2(fract(az * 3.0), sy)); c = mix(c, s.rgb * mix(1.0, 0.0, uDay) + mix(vec3(0.0), vec3(0.42, 0.45, 0.46), uDay), s.a); }
        if (d.y < 0.0) c = mix(c, vec3(0.03, 0.025, 0.022) * (1.0 - uDay) + vec3(0.45, 0.44, 0.4) * uDay, smoothstep(0.0, -0.05, d.y));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`, side: THREE.BackSide, depthWrite: false, fog: false
  }));
}

/* ================================================================
   THE LOT
   ================================================================ */
export function buildLot(o) {
  const set = new THREE.Group(); set.name = "lot";
  set.userData = { lamps: [], spots: {}, walls: [], frond: TX.frondTex(), sounds: {}, colliders: [] };
  const r = rng(53), day = !!o.day;
  const CO = set.userData.colliders;
  const W = 70, H = 52;
  // parking lines: two rows of stalls back to back across the drive lane, and a third along the fence
  const lines = [];
  for (const zRow of [-5.5, 4.5]) for (let x = -19.2; x <= 19.2; x += 3.2) lines.push([x, zRow - 2.6, x, zRow + 2.6]);
  for (let x = -19.2; x <= 19.2; x += 3.2) lines.push([x, 12, x, 16.8]);
  lines.push([-19.2, -8.1, 19.2, -8.1], [-19.2, 7.1, 19.2, 7.1]);
  // the ground's material waits for the cars and lamps (it bakes their shade and shadows); see the end of buildLot
  const ground = plane(W, H, null, set); ground.rotation.x = -Math.PI / 2; ground.layers.set(4);

  /* --- the showroom: a glass front under a canopy, a real room behind it --- */
  const stucco = rmat({ color: "#4b4d4a", rough: 0.88, wet: 0.5, mapK: "concC", nmapK: "concN", tri: 0.35, nk: 0.6 });
  const fascia = pbr({ color: "#1b1e1d", rough: 0.4, metal: 0.4, wet: 0.9 });
  const alu = pbr({ color: "#2b2925", rough: 0.32, metal: 0.85, wet: 0.8 });
  const sh = new THREE.Group(); sh.position.set(2, 0, -18); set.add(sh);
  // shell: back block, side walls, the fascia band over the glass
  box(26.6, 5.6, 2.4, stucco, 0, 2.8, -7.1, sh);
  box(1.3, 5.6, 6.3, stucco, -12.65, 2.8, -2.95, sh); box(3.3, 5.6, 6.3, stucco, 11.65, 2.8, -2.95, sh);
  box(26.6, 1.5, 6.3, stucco, 0, 4.85, -2.95, sh);
  box(27.2, 0.9, 0.5, fascia, 0, 4.55, 0.25, sh);
  // the canopy over the walk, with its downlights
  box(27.2, 0.22, 1.9, fascia, 0, 3.98, 1.15, sh);
  const dl = glow("#ffe2b8", { k: day ? 0.2 : 2.2 });
  for (let i = 0; i < 9; i++) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), dl); d.rotation.x = Math.PI / 2; d.position.set(-12 + i * 3, 3.865, 1.25); sh.add(d); }
  // the room: polished tile, a white ceiling with light panels, a back wall with a counter, posters and a plant
  const floorT = TX.tileTex(4);
  const tile = pbr({ color: "#ffffff", map: floorT, tri: 0.42, rough: 0.12, wet: 0, spec: 1 });
  const fl = plane(22.8, 5.8, tile, sh); fl.rotation.x = -Math.PI / 2; fl.position.set(-1, 0.01, -3.0);
  const ceilM = pbr({ color: "#d9d6cf", rough: 0.9, wet: 0 });
  const ce = plane(22.8, 5.8, ceilM, sh); ce.rotation.x = Math.PI / 2; ce.position.set(-1, 4.0, -3.0);
  const panelM = glow("#fff3e0", { k: day ? 0.6 : 2.0 });
  for (let i = 0; i < 7; i++) for (const zz of [-1.6, -4.2]) { const p0 = plane(1.2, 0.6, panelM, sh); p0.rotation.x = Math.PI / 2; p0.position.set(-11 + i * 3.3, 3.98, zz); }
  const wallIn = pbr({ color: "#e4ddd0", rough: 0.85, wet: 0 });
  const bw = plane(22.8, 4.0, wallIn, sh); bw.position.set(-1, 2.0, -5.88);
  // an accent wall in the brand's green behind the counter, the wordmark small on it
  const acc = pbr({ color: "#1c3229", rough: 0.7, wet: 0 }); box(6, 3.0, 0.06, acc, 4.5, 1.9, -5.84, sh);
  const sm = plane(3.2, 0.8, glow("#ffffff", { map: TX.signTex(o.wordmark), k: day ? 0.7 : 1.0 }), sh); sm.position.set(4.5, 2.6, -5.80);
  // the counter: a wood top on a dark base, a monitor's glow, two chairs
  const woodTop = pbr({ color: "#8a6a4a", rough: 0.45, wet: 0 }), dark = pbr({ color: "#1a1b1b", rough: 0.5, wet: 0 });
  box(3.2, 1.0, 0.7, dark, 4.5, 0.5, -4.6, sh); box(3.4, 0.05, 0.8, woodTop, 4.5, 1.02, -4.6, sh);
  const mon = box(0.55, 0.34, 0.03, dark, 4.0, 1.3, -4.75, sh); const ms = plane(0.5, 0.29, glow("#cfe0ff", { k: day ? 0.3 : 0.9 }), sh); ms.position.set(4.0, 1.3, -4.733);
  for (const cx of [3.6, 5.4]) { const c = new THREE.Group(); c.position.set(cx, 0, -3.7); sh.add(c); box(0.48, 0.06, 0.48, dark, 0, 0.46, 0, c); box(0.48, 0.5, 0.06, dark, 0, 0.74, 0.22, c); box(0.05, 0.44, 0.05, alu, 0, 0.22, 0, c); }
  // posters and a door to the back
  for (let i = 0; i < 3; i++) { const pm = pbr({ color: "#ffffff", map: TX.posterTex(i + 1), rough: 0.35, wet: 0, ao: 0 }); const pp = plane(1.0, 1.4, pm, sh); pp.position.set(-10 + i * 3.4, 1.9, -5.86); box(1.06, 1.46, 0.02, alu, -10 + i * 3.4, 1.9, -5.875, sh); }
  box(1.0, 2.2, 0.05, pbr({ color: "#5a4a3a", rough: 0.6, wet: 0 }), 9.2, 1.1, -5.86, sh);
  plantPot(-1.2, -5.2, 1.3, sh, 7); plantPot(8.0, -5.2, 1.1, sh, 13);
  // the glass: storefront panes between bronze mullions, the room's light behind them
  const glassM = pbr({ color: "#0b0f10", rough: 0.03, wet: 0.6, alpha: 0.12, glass: true, depthWrite: false, spec: 1, diff: 0.2 });
  const pane = plane(22.0, 3.75, glassM, sh); pane.position.set(-1, 1.92, 0.02); pane.renderOrder = 2; pane.userData.keep = true;
  for (let i = 0; i <= 8; i++) box(0.1, 3.85, 0.18, alu, -12 + i * 2.75, 1.92, 0.05, sh);
  box(22.4, 0.12, 0.2, alu, -1, 3.86, 0.05, sh); box(22.4, 0.14, 0.2, alu, -1, 0.07, 0.05, sh);
  // the office door at the right end, lit from inside
  box(1.5, 2.5, 0.14, alu, 11, 1.25, 0.05, sh);
  const doorGlow = plane(1.1, 2.0, glow("#f3d2a0", { k: day ? 0.3 : 1.1 }), sh); doorGlow.position.set(11, 1.2, 0.13);
  box(0.04, 0.5, 0.06, pbr({ color: "#c9ccd0", metal: 1, rough: 0.2 }), 10.55, 1.15, 0.19, sh);
  // the wordmark over the canopy, lit
  const signT = TX.signTex(o.wordmark);
  const sign = plane(7.2, 1.8, glow("#ffffff", { map: signT, k: day ? 0.9 : 1.25 }), sh); sign.position.set(-1, 5.0, 0.51);
  // the sold board by the door; it fills from June 2025, so on the morning of the keys (August 2024) it is not up yet
  if (!day) { const sold = plane(1.6, 1.2, pbr({ map: TX.soldTex(), color: "#fff", rough: 0.5, wet: 0.3 }), sh); sold.position.set(8.6, 1.55, 0.16); }
  set.userData.spots.sold = { p: V3(2 + 8.6, 1.5, -18 + 0.3), r: 2.4, stand: V3(10.6, 0, -16.2) };
  set.userData.spots.door = { p: V3(13, 1.3, -17.6), r: 2.4, stand: V3(13, 0, -16.3) };
  set.userData.walls.push({ x0: -11.3, x1: 15.3, z0: -26.3, z1: -17.7 });
  // a trash can and a bench by the door
  { const can = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.85, 16, 1, true), pbr({ color: "#2a2c2b", metal: 0.6, rough: 0.4, wet: 1, side: THREE.DoubleSide })); can.position.set(14.6, 0.425, -17.2); set.add(can);
    box(0.54, 0.04, 0.54, pbr({ color: "#1d1f1e", rough: 0.6, wet: 1 }), 14.6, 0.86, -17.2, set); set.userData.walls.push({ x0: 14.3, x1: 14.9, z0: -17.5, z1: -16.9 }); }

  /* --- the pylon sign and its banner --- */
  const py = new THREE.Group(); py.position.set(-15, 0, -9); set.add(py);
  const pylonM = pbr({ color: "#202322", metal: 0.5, rough: 0.45, wet: 1 });
  box(0.36, 6.4, 0.36, pylonM, -1.6, 3.2, 0, py); box(0.36, 6.4, 0.36, pylonM, 1.6, 3.2, 0, py);
  box(0.8, 0.5, 0.8, rmat({ color: "#8d8a82", rough: 0.85, wet: 0.8, mapK: "concC", tri: 0.9 }), -1.6, 0.25, 0, py); box(0.8, 0.5, 0.8, rmat({ color: "#8d8a82", rough: 0.85, wet: 0.8, mapK: "concC", tri: 0.9 }), 1.6, 0.25, 0, py);
  const ps = plane(3.6, 1.0, glow("#ffffff", { map: signT, k: day ? 0.9 : 1.3 }), py); ps.position.set(0, 5.9, 0.2);
  const ps2 = ps.clone(); ps2.rotation.y = Math.PI; ps2.position.z = -0.2; py.add(ps2);
  box(3.9, 1.25, 0.34, pylonM, 0, 5.9, 0, py);
  const ban = plane(3.4, 0.55, pbr({ map: TX.bannerTex(), color: "#fff", rough: 0.55, wet: 0.5 }), py); ban.position.set(0, 4.7, 0.19);
  set.userData.spots.sign = { p: V3(-15, 4.7, -8.8), r: 4.5, stand: V3(-13.6, 0, -6.4) };
  set.userData.walls.push({ x0: -17, x1: -13, z0: -9.5, z1: -8.5 });

  /* --- the cars: two rows back to back across the lane, one along the fence, three in the showroom --- */
  const showCars = [[-7.5, 0.5, "sedan", "#9b1b14", 0], [-2.2, -0.35, "suv", "#e6e3dc", 0], [3.6, 0.42, "compact", "#3a3f44", 1]].map(([x, yaw, kind, color, metal]) => ({ kind, x: x + 2, z: -21.0, yaw, color, metal: !!metal }));
  const KINDS = ["sedan", "suv", "compact", "truck", "hatch", "sedan", "suv", "compact"];
  const lotCars = [];
  set.userData.cars = lotCars;
  const addCar = (x, z, yaw, kind, ci) => {
    const [color, metal] = CAR_COLORS[ci % CAR_COLORS.length];
    const c = { kind, x, z, yaw, color, metal: !!metal }; lotCars.push(c);
    const [w, l] = carSize(kind); const ca = Math.abs(Math.cos(yaw)), sa = Math.abs(Math.sin(yaw));
    const hw = (w * ca + l * sa) / 2 + 0.2, hl = (w * sa + l * ca) / 2 + 0.2;
    c.wall = { x0: x - hw, x1: x + hw, z0: z - hl, z1: z + hl }; set.userData.walls.push(c.wall);
    return c;
  };
  let k = 0;
  for (let x = -17.6; x <= 17.6; x += 3.2) { if (r() < 0.12) continue; addCar(x + (r() - 0.5) * 0.12, -5.6 + (r() - 0.5) * 0.25, Math.PI + (r() - 0.5) * 0.05, KINDS[k % KINDS.length], k * 7 + 3); k++; }
  for (let x = -17.6; x <= 17.6; x += 3.2) { if (Math.abs(x - 1.6) < 1.7 || r() < 0.15) continue; const kd = x > 4 && x < 6 ? "truck" : KINDS[(k + 2) % KINDS.length]; addCar(x + (r() - 0.5) * 0.12, 4.5 + (r() - 0.5) * 0.25, (r() - 0.5) * 0.05, kd, x > 4 && x < 6 ? 2 : k * 3 + 1); if (kd === "truck") set.userData.spots.truck = { p: V3(x, 1.3, 4.5 + 2.9), r: 3, stand: V3(x, 0, 8.8) }; k++; }
  for (let x = -17.6; x <= 9; x += 3.2) { if (r() < 0.25) continue; addCar(x + (r() - 0.5) * 0.12, 14.4, Math.PI + (r() - 0.5) * 0.05, KINDS[(k + 1) % KINDS.length], k * 5); k++; }
  // one car by the showroom with its engine running and its lights on: someone's ride, waiting (not in the morning)
  let idleCar = null;
  if (!day) { const idle = idleCar = { kind: "sedan", x: 16.6, z: -11.2, yaw: -Math.PI / 2 + 0.12, color: "#16181a", metal: false, idle: true }; lotCars.push(idle); idle.wall = { x0: 14.2, x1: 19.0, z0: -12.3, z1: -10.1 }; set.userData.walls.push(idle.wall);
    set.userData.sounds.idle = { x: 16.6 + 2.2, y: 0.4, z: -11.5, kind: "engine-idle" };
    // its lights on the wet ground ahead of it and the tail lights' red behind
    idle.lamp = { p: V3(13.6, 0.75, -10.8), range: 7, col: [0.9, 0.85, 0.75], cone: 0, fixed: false, car: true };
    set.userData.lamps.push(idle.lamp);
  }
  /* the cars you can drive (story/vehicle.js, tools/story/HANDOFF-drive.md): the idling sedan, a car by the
     entrance aisle and the pickup at the truck spot; drawn as rigs, not in the instanced rows */
  const drivable = [];
  { const pick = (id, f) => { let best = null, bd = 1e9; for (const c of lotCars) { if (c.drivable) continue; const d = f(c); if (d < bd) { bd = d; best = c; } } if (best) { best.drivable = true; best.id = id; drivable.push(best); } };
    if (idleCar) { idleCar.drivable = true; idleCar.id = "idle"; idleCar.engine = true; idleCar.lights = { head: true, tail: true, cluster: true }; drivable.push(idleCar); }
    pick("car", c => (Math.abs(c.z - 4.5) < 1 && c.kind !== "truck" && c.kind !== "suv" ? Math.abs(c.x + 1.6) : 1e9));
    pick("truck", c => (c.kind === "truck" && Math.abs(c.z - 4.5) < 1 ? Math.abs(c.x - 4.8) : 1e9));
    for (const c of drivable) { const g = new THREE.Group(); g.name = "car-" + c.id; g.position.set(c.x, 0, c.z); g.rotation.y = c.yaw; g.userData.keep = true; set.add(g); c.object = g; }
  }
  set.userData.drivable = drivable;
  const parked = lotCars.filter(c => !c.drivable);
  set.userData.parked = parked;
  set.userData.rockCar = rockCar;
  set.userData.tickCars = dt => tickCars(parked, dt);
  // the cars, now or when they land
  const land = () => { parkCars(set, parked.concat(showCars)); for (const c of drivable) buildRig(set, c); for (const c of parked) { const [w, l] = carSize(c.kind); c.collider.hw = w / 2; c.collider.hl = l / 2; } };
  if (Object.keys(carLib).length) land();
  else lotReady.then(() => { land(); set.userData.envTex = null; });
  if (!set.userData.spots.truck) set.userData.spots.truck = { p: V3(4.8, 1.3, 7.1), r: 3, stand: V3(4.8, 0, 8.6) };
  // wheel stops at the head of each stall, concrete
  { const ws = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 0.13, 0.16), rmat({ color: "#9b968c", rough: 0.85, wet: 0.8, mapK: "concC", tri: 1.2 }), 40); let n = 0; const m4 = new THREE.Matrix4();
    for (let x = -17.6; x <= 17.6; x += 3.2) { m4.makeTranslation(x, 0.065, -7.75); ws.setMatrixAt(n++, m4); m4.makeTranslation(x, 0.065, 6.75); ws.setMatrixAt(n++, m4); }
    ws.count = n; ws.userData.keep = true; set.add(ws); }

  /* --- what a car you drive can hit (story/vehicle.js): parked cars, the showroom, the pylon's legs, the can, wheel stops --- */
  for (const c of parked) { const [w, l] = carSize(c.kind); c.collider = { type: "box", x: c.x, z: c.z, hw: w / 2, hl: l / 2, yaw: c.yaw, h: 1.4, what: "car", car: c }; CO.push(c.collider); }
  CO.push({ type: "box", x: 2, z: -22.0, hw: 13.3, hl: 4.3, yaw: 0, h: 5.6, what: "wall" });
  CO.push({ type: "circle", x: -16.6, z: -9, r: 0.45, what: "pole" }, { type: "circle", x: -13.4, z: -9, r: 0.45, what: "pole" }, { type: "circle", x: 14.6, z: -17.2, r: 0.3, what: "wall" });
  for (let x = -17.6; x <= 17.6; x += 3.2) for (const zz of [-7.75, 6.75]) CO.push({ type: "bump", x, z: zz, hw: 0.9, hl: 0.08, h: 0.13 });
  /* --- lamps --- */
  [[-9, -1.2, 8.5, 1], [8, -1.2, 8.5, 1], [-1, 9.4, 8.5, 1], [13, 9.4, 8.5, 0], [-17, 12, 8, 0], [11.6, -13.4, 7, 0], [6.2, 18.6, 7.5, 0]].forEach(([x, z, h, twin]) => lampPost(x, z, h, set, { day, twin: false }));
  // the showroom's own light: spilling out through the glass, and the room inside it
  set.userData.lamps.push({ p: V3(2, 2.4, -16.4), range: 15, col: [1.6, 1.15, 0.7], cone: 0, fixed: true });
  set.userData.lamps.push({ p: V3(1, 3.3, -21.0), range: 13, col: [2.2, 1.9, 1.5], cone: 0, fixed: true });
  set.userData.lamps.push({ p: V3(13, 2.2, -16.4), range: 6, col: [1.0, 0.75, 0.45], cone: 0, fixed: true });
  set.userData.sounds.lamps = set.userData.lamps.filter(l => l.coneMesh).map(l => ({ x: l.p.x, y: l.p.y, z: l.p.z, kind: "sodium-hum" }));
  // the puddle by the middle lamp
  set.userData.spots.puddle = { p: V3(-1.5, 0.05, 11.2), r: 2.2, stand: V3(-1.5, 0, 12.6) };

  /* --- the fence: galvanized posts, a top rail, the chain-link, three strands of barbed wire, and the rolling gate --- */
  const galv = pbr({ color: "#8a8f92", metal: 0.9, rough: 0.42, wet: 0.9 });
  const ct = TX.chainTex();
  for (const [x0, x1] of [[-34, -3.2], [3.2, 34]]) {
    const len = x1 - x0, t = ct.clone(); t.needsUpdate = true; t.repeat.set(len / 0.11, 1.9 / 0.11);
    const mesh = pbr({ color: "#9aa0a3", map: t, metal: 0.8, rough: 0.45, wet: 0.6, side: THREE.DoubleSide, transparent: true, depthWrite: false, ao: 0 });
    const f = plane(len, 1.9, mesh, set); f.position.set((x0 + x1) / 2, 0.97, 21.5); f.userData.keep = true; f.renderOrder = 1;
    for (let x = x0; x <= x1 + 0.01; x += 3) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.05, 8), galv); p.position.set(x, 1.02, 21.5); set.add(p);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 0.03), galv); arm.position.set(x, 2.18, 21.62); arm.rotation.x = 0.7; set.add(arm); }
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 8), galv); rail.rotation.z = Math.PI / 2; rail.position.set((x0 + x1) / 2, 1.95, 21.5); set.add(rail);
    for (let s = 0; s < 3; s++) { const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, len, 4), galv); wire.rotation.z = Math.PI / 2; wire.position.set((x0 + x1) / 2, 2.07 + s * 0.11, 21.55 + s * 0.09); set.add(wire); }
    set.userData.walls.push({ x0, x1, z0: 21.2, z1: 21.8 });
    CO.push({ type: "box", x: (x0 + x1) / 2, z: 21.5, hw: (x1 - x0) / 2, hl: 0.08, yaw: 0, h: 2, what: "fence" });
  }
  const gate = new THREE.Group(); gate.position.set(-3.2, 0, 21.9); set.add(gate); gate.userData.keep = true;
  { const t = ct.clone(); t.needsUpdate = true; t.repeat.set(3.4 / 0.11, 1.8 / 0.11);
    const gm = plane(3.4, 1.8, pbr({ color: "#9aa0a3", map: t, metal: 0.8, rough: 0.45, wet: 0.6, side: THREE.DoubleSide, transparent: true, depthWrite: false, ao: 0 }), gate); gm.position.set(-1.7, 1.0, 0); gm.renderOrder = 1;
    for (const x of [0, -3.4]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.95, 8), galv); p.position.set(x, 1.0, 0); gate.add(p); }
    for (const y of [0.1, 1.92]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 3.4, 8), galv); b.rotation.z = Math.PI / 2; b.position.set(-1.7, y, 0); gate.add(b); }
    const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 3.85, 6), galv); brace.rotation.z = Math.atan2(1.8, 3.4) + Math.PI / 2; brace.position.set(-1.7, 1.0, 0.02); gate.add(brace);
    for (const x of [-0.4, -3.0]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 12), pbr({ color: "#202020", rough: 0.8 })); w.rotation.x = Math.PI / 2; w.position.set(x, 0.08, 0); gate.add(w); } }
  set.userData.gate = gate;
  // the gate is live: its box follows the gate wherever main.js rolls it (it spans gate.x - 3.4 to gate.x)
  { const gc = { type: "box", x: -4.9, z: 21.9, hw: 1.7, hl: 0.08, yaw: 0, h: 2, what: "gate" };
    Object.defineProperty(gc, "x", { get: () => gate.position.x - 1.7, enumerable: true }); Object.defineProperty(gc, "z", { get: () => gate.position.z, enumerable: true }); CO.push(gc); }
  set.userData.sounds.gate = { x: -3.2, y: 1.0, z: 21.9, kind: "chain-link" };
  set.userData.spots.gate = { p: V3(-3.4, 1.2, 21.9), r: 2.4, stand: V3(-2.6, 0, 20.4) };
  set.userData.walls.push({ x0: -35, x1: 35, z0: -27, z1: -26.4 }, { x0: -35, x1: -34.4, z0: -27, z1: 22 }, { x0: 34.4, x1: 35, z0: -27, z1: 22 }, { x0: -4, x1: 4, z0: 23.6, z1: 24.2 });
  CO.push({ type: "box", x: 0, z: -26.7, hw: 35, hl: 0.3, yaw: 0, h: 3, what: "wall" }, { type: "box", x: -34.7, z: -2.5, hw: 0.3, hl: 24.5, yaw: 0, h: 3, what: "fence" }, { type: "box", x: 34.7, z: -2.5, hw: 0.3, hl: 24.5, yaw: 0, h: 3, what: "fence" });
  // where a car may be: the lot inside the fence, the gate's opening, and Almeda Genoa Road; past the road's ends a soft wall turns you round
  set.userData.driveBounds = { rects: [{ x0: -34.4, x1: 34.4, z0: -26.4, z1: 21.5, name: "lot" }, { x0: -3.2, x1: 3.2, z0: 21.0, z1: 24.6, name: "gate" }, { x0: -60, x1: 60, z0: 22.4, z1: 37.6, name: "road" }] };
  set.userData.inDriveBounds = (x, z) => set.userData.driveBounds.rects.some(b => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1);

  /* --- beyond the fence: Almeda Genoa Road, its street lights and power poles, palms, the buildings across it, the sky --- */
  {
    const road = rmat({ color: "#ffffff", mapK: "asphC", tri: 1 / 3.6, rough: 0.35, wet: day ? 0 : 1, spec: 1 });
    const rd = plane(160, 14, road, set); rd.rotation.x = -Math.PI / 2; rd.position.set(0, -0.02, 31);
    const yel = pbr({ color: "#b8902e", rough: 0.5, wet: day ? 0 : 1 });
    for (const dz of [-0.08, 0.08]) { const l = plane(160, 0.1, yel, set); l.rotation.x = -Math.PI / 2; l.position.set(0, -0.005, 31 + dz); }
    const sw = plane(160, 3.4, rmat({ color: "#a9a59c", mapK: "concC", tri: 0.6, rough: 0.8, wet: day ? 0 : 0.9 }), set); sw.rotation.x = -Math.PI / 2; sw.position.set(0, -0.01, 23.4);
    const sw2 = plane(160, 3, rmat({ color: "#a9a59c", mapK: "concC", tri: 0.6, rough: 0.8, wet: day ? 0 : 0.9 }), set); sw2.rotation.x = -Math.PI / 2; sw2.position.set(0, -0.01, 39.5);
    // cobra-head street lights along the far side, glowing (their light is the lens and its halo; the lot's lamps do the lighting)
    const pole = pbr({ color: "#6f7376", metal: 0.8, rough: 0.5, wet: 1 });
    const lensM = glow0(day ? "#c8c4b8" : "#ffcc80", { k: day ? 0.1 : 4.0 });
    for (let x = -60; x <= 60; x += 30) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 9, 8), pole); p.position.set(x, 4.5, 38.6); set.add(p); CO.push({ type: "circle", x, z: 38.6, r: 0.16, what: "pole" });
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), pole); a.rotation.x = Math.PI / 2; a.position.set(x, 8.9, 37.4); set.add(a);
      const hd = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.8), pole); hd.position.set(x, 8.85, 36.1); set.add(hd);
      const ln = plane(0.3, 0.6, lensM, set); ln.rotation.x = Math.PI / 2; ln.position.set(x, 8.76, 36.1); ln.userData.keep = true;
    }
    // power poles and their wires, along the lot's side of the road
    const wood = pbr({ color: "#3b3027", rough: 0.9, wet: 0.8 });
    for (let x = -66; x <= 66; x += 22) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 11, 8), wood); p.position.set(x, 5.5, 25.4); set.add(p); box(2.4, 0.12, 0.12, wood, x, 10.2, 25.4, set); CO.push({ type: "circle", x, z: 25.4, r: 0.2, what: "pole" }); }
    for (const [dx, y] of [[-1.0, 10.3], [1.0, 10.3], [0, 9.2]]) {
      for (let x = -66; x < 66; x += 22) {
        const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(V3(x + t * 22, y - Math.sin(t * Math.PI) * 0.45, 25.4 + dx * 0.05)); }
        const wm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.012, 3), pbr({ color: "#111", rough: 0.6, wet: 0.5 })); set.add(wm);
      }
    }
    // across the road: a strip of low buildings, dark at this hour, a few signs and windows still lit
    const bldg = rmat({ color: "#3a3936", rough: 0.9, wet: 0.6, mapK: "concC", tri: 0.25 });
    const rb = rng(77);
    for (let x = -70; x < 70;) {
      const w = 9 + rb() * 14, h = 4 + rb() * 4.5, d = 10;
      box(w - 0.6, h, d, bldg, x + w / 2, h / 2, 46 + rb() * 3, set);
      if (!day && rb() < 0.6) { const s = plane(w * 0.5, 0.7, glow(["#e8d9b8", "#b8d0e8", "#f0b878"][(rb() * 3) | 0], { k: 0.5 + rb() * 0.6 }), set); s.rotation.y = Math.PI; s.position.set(x + w / 2, h - 0.9, 46 - 5.05); }
      if (!day && rb() < 0.5) { const s = plane(1.4, 1.1, glow("#f1d6a0", { k: 0.35 }), set); s.rotation.y = Math.PI; s.position.set(x + w * (0.25 + rb() * 0.5), 1.4, 46 - 5.05); }
      x += w;
    }
    // palms along the road and the lot's west side
    for (let i = 0; i < 9; i++) palm(-30 + i * 7.5 + (r() - 0.5) * 3, 24.8 + r() * 1.0, 8 + r() * 4, set, r);
    for (let i = 0; i < 4; i++) palm(-38 - r() * 4, -20 + i * 11, 7 + r() * 4, set, r);
    const sky = skyDome(o); sky.renderOrder = -1; set.add(sky);
    set.userData.sounds.road = { x: 0, y: 0.5, z: 31, kind: "traffic" };
  }

  /* --- the ground, now that everything standing on it is known --- */
  {
    const px = o.lowres ? 14 : 24;
    const carsG = parked.map(c => { const [w, l] = carSize(c.kind); return { x: c.x, z: c.z, yaw: c.yaw, w, l }; });
    const conc = [[-12.4, -17.9, 16.4, -15.6]];
    const g = TX.lotGround(W, H, px, { puddles: [[-1.5, 11.2, 1.9, 1.3], [-0.6, 10.2, 0.8, 0.6]], lines, cars: carsG, conc, dry: [[-12.4, -17.9, 16.4, -16.0]], ao: [[-11.4, -18.0, 15.4, -17.6, 0.7, 0.9], [-12.4, -15.75, 16.4, -15.55, 0.35, 0.25], [-34, 21.4, 34, 21.6, 0.3, 0.3]].concat(set.userData.lamps.filter(l => l.coneMesh).map(l => [l.p.x - 0.82 - 0.3, l.p.z - 0.3, l.p.x - 0.82 + 0.3, l.p.z + 0.3, 0.6, 0.45])) });
    const shBoxes = parked.map(c => { const [w, l] = carSize(c.kind); const m = carLib[c.kind] && carLib[c.kind].meta; return { x: c.x, z: c.z, yaw: c.yaw, hw: w / 2 - 0.05, hl: l / 2 - 0.15, h: (m ? m.H : 1.45) - 0.1, y0: 0.18 }; })
      .concat([{ x: 2, z: -22.6, hw: 13.3, hl: 3.7, h: 5.6, yaw: 0 }, { x: -15, z: -9, hw: 1.9, hl: 0.2, h: 6.5, y0: 5.3, yaw: 0 }, { x: 2, z: -16.9, hw: 13.6, hl: 0.95, h: 4.1, y0: 3.87, yaw: 0 }]);
    const shL = set.userData.lamps.filter(l => !l.car).slice(0, 8);
    const sh = day ? null : TX.lampShadows(W, H, o.lowres ? 2.5 : 4, shL.map(l => ({ x: l.p.x, y: l.p.y, z: l.p.z, range: l.range })), shBoxes);
    const gm = groundMat(g, { wet: day ? 0 : 1, rain: day ? 0 : 1, sh, shLamps: shL.map(l => l.p.clone()), day });
    ground.material = gm; set.userData.groundMat = gm;
    // textures that were not in yet when the lot was built
    lotReady.then(() => { const u = gm.uniforms; for (const [k, t] of [["uAsC", "asphC"], ["uAsN", "asphN"], ["uAsR", "asphR"], ["uCoC", "concC"], ["uCoN", "concN"], ["uCoR", "concR"]]) if (T[t] && u[k].value !== T[t]) u[k].value = T[t]; });
    // what's underfoot, for footsteps: puddle, concrete, wet asphalt (dry in the morning), tile inside the showroom
    set.userData.surfaceAt = (x, z) => {
      if (z < -17.7 && x > -11.3 && x < 15.3) return "tile";
      const i = Math.floor((x + W / 2) * g.px), j = Math.floor((z + H / 2) * g.px);
      if (i < 0 || j < 0 || i >= g.w || j >= g.h) return day ? "asphalt" : "wet";
      const kk = j * g.w + i;
      if (g.conc[kk]) return day ? "concrete" : "wet-concrete";
      if (!day && g.pud[kk] > 110) return "puddle";
      return day ? "asphalt" : "wet";
    };
    // the bigger puddles, for anyone who wants them as circles
    const pz = []; for (let z = -H / 2 + 1; z < H / 2; z += 1.2) for (let x = -W / 2 + 1; x < W / 2; x += 1.2) { const kk = Math.floor((z + H / 2) * g.px) * g.w + Math.floor((x + W / 2) * g.px); if (g.pud[kk] > 170) pz.push({ x: +x.toFixed(2), z: +z.toFixed(2), r: 0.7 }); }
    set.userData.puddles = day ? [] : pz;
    // rain on things: the canopy, the cars' roofs, the showroom's glass
    set.userData.sounds.rain = day ? [] : [{ x: 2, y: 4.0, z: -16.9, kind: "rain-canopy", w: 27 }, { x: 0, y: 1.4, z: 0, kind: "rain-cars", w: 36 }, { x: 1, y: 1.9, z: -17.98, kind: "rain-glass", w: 22 }];
  }
  envHook(set, V3(1, 1.7, 1));
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
  set.userData.ready = lotReady;
  return set;
}

/* ================================================================
   ROOMS: shared pieces for the office and the library
   ================================================================ */
/* a material whose tiled textures stream in after the lot: keys into T (mapK, nmapK, rmapK); patched in when they land */
const lateMats = [];
function rmat(o) {
  const q = { ...o }; delete q.mapK; delete q.nmapK; delete q.rmapK;
  if (o.mapK && T[o.mapK]) q.map = T[o.mapK];
  if (o.nmapK && T[o.nmapK]) q.nmap = T[o.nmapK];
  if (o.rmapK && T[o.rmapK]) q.rmap = T[o.rmapK];
  const m = pbr(q);
  if ((o.mapK && !T[o.mapK]) || (o.nmapK && !T[o.nmapK]) || (o.rmapK && !T[o.rmapK])) lateMats.push([m, o]);
  return m;
}
function patchLate() {
  for (const [m, o] of lateMats.splice(0)) {
    for (const [k, u, d] of [["mapK", "uMap", "USE_TMAP"], ["nmapK", "uNMap", "USE_NMAP"], ["rmapK", "uRMap", "USE_RMAP"]]) {
      const t = o[k] && T[o[k]]; if (!t || m.defines[d] !== undefined) continue;
      m.uniforms[u] = { value: t }; m.defines[d] = ""; m.needsUpdate = true;
    }
  }
}
function rbox(w, h, d, r, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)), mat); m.position.set(x, y, z); if (parent) parent.add(m); return m;
}
function cyl(rt, rb, h, mat, x, y, z, parent, seg = 16) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); if (parent) parent.add(m); return m; }
/* rain on a window: the view behind it (a texture) through clinging drops and runs that slide down, a little fogged */
function rainGlassMat(map, k = 1, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uTime: U.uTime, uK: { value: k }, uFog: U.uFog, uFogDen: U.uFogDen, uAsp: { value: o.aspect || 2 }, uRain: { value: o.rain != null ? o.rain : 1 } },
    vertexShader: `varying vec2 vUv; varying vec3 vWP; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform sampler2D uMap; uniform float uTime; uniform float uK; uniform float uAsp; uniform float uRain; varying vec2 vUv; varying vec3 vWP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      // static drops: a cell each, some empty
      vec3 still(vec2 uv, float sc){
        vec2 q = uv * vec2(uAsp, 1.0) * sc; vec2 c = floor(q), f = fract(q) - 0.5;
        vec2 o = (vec2(h(c), h(c + 3.7)) - 0.5) * 0.6; float r = 0.1 + 0.18 * h(c + 1.9);
        vec2 d = f - o; float m = smoothstep(r, r * 0.75, length(d)) * step(0.4, h(c + 8.1));
        return vec3(d / r * m, m);
      }
      // runs: drops that slide down their column now and then, leaving a trail
      vec3 run(vec2 uv, float t){
        vec2 q = uv * vec2(uAsp * 7.0, 1.4); float col = floor(q.x), fx = fract(q.x) - 0.5;
        float sp = 0.25 + h(vec2(col, 2.0)) * 0.35, ph = fract(-t * sp * 0.25 + h(vec2(col, 5.0)));
        float y = fract(q.y); float dy = y - ph;
        float wob = sin(y * 23.0 + col) * 0.07;
        float head = smoothstep(0.16, 0.1, length(vec2((fx - wob) * 1.3, dy * 4.0)));
        float trail = smoothstep(0.07, 0.03, abs(fx - wob)) * smoothstep(0.0, 0.05, dy) * smoothstep(0.35, 0.0, dy) * step(0.45, h(vec2(col, floor(y * 9.0))));
        return vec3(vec2(fx - wob, dy * 0.4) * head * 2.0, max(head, trail * 0.5));
      }
      void main(){
        vec3 a = still(vUv, 16.0), b = still(vUv + 0.37, 31.0), c = run(vUv, uTime);
        vec2 off = (a.xy * 0.012 + b.xy * 0.007 + c.xy * 0.02) * uRain;
        float wet = max(max(a.z, b.z), c.z) * uRain;
        // the glass is fogged a touch away from the drops: a soft copy; through a drop, sharp and inverted a little
        vec2 uv = vUv + off;
        vec3 soft = (texture2D(uMap, uv + vec2(0.004, 0.0)).rgb + texture2D(uMap, uv - vec2(0.004, 0.0)).rgb + texture2D(uMap, uv + vec2(0.0, 0.006)).rgb + texture2D(uMap, uv - vec2(0.0, 0.006)).rgb) * 0.25;
        vec3 sharp = texture2D(uMap, uv - off * 2.0).rgb;
        vec3 col = mix(soft, sharp, wet) * uK;
        col *= 1.0 - wet * 0.15; col += wet * 0.02;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`
  });
}
function plant(x, z, h, parent, seed) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.16, 0.4, 20), pbr({ color: "#d8d2c6", rough: 0.35, wet: 0 })); pot.position.y = 0.2; g.add(pot);
  cyl(0.2, 0.2, 0.02, pbr({ color: "#2a2018", rough: 0.95, wet: 0 }), 0, 0.39, 0, g);
  const leaf = pbr({ color: "#2e4a2c", rough: 0.55, wet: 0, side: THREE.DoubleSide, spec: 0.7 }), stem = pbr({ color: "#3b3a24", rough: 0.8, wet: 0 }), r = rng(seed);
  // stems and broad leaves (a rubber plant, more or less)
  const lg = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5); lg.scale(0.07, 0.015, 0.16); lg.translate(0, 0, 0.13);
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2, hh = 0.4 + r() * h * 0.6, t = 0.1 + r() * 0.25;
    const s = cyl(0.007, 0.01, hh, stem, Math.cos(a) * 0.04, 0.4 + hh / 2, Math.sin(a) * 0.04, g, 5); s.rotation.set(Math.sin(a) * t, 0, -Math.cos(a) * t);
    for (let k = 0; k < 4; k++) {
      const yy = 0.4 + hh * (0.45 + k * 0.17), l = new THREE.Mesh(lg, leaf);
      l.position.set(Math.cos(a) * (0.04 + Math.sin(t) * (yy - 0.4)), yy, Math.sin(a) * (0.04 + Math.sin(t) * (yy - 0.4)));
      l.rotation.set(-0.3 - r() * 0.5, a + (r() - 0.5) * 2.4, 0); g.add(l);
    }
  }
  const sh = new THREE.Mesh(BLOB_GEO, blobMat(0.5)); sh.scale.set(0.8, 1, 0.8); sh.position.y = 0.01; sh.layers.set(2); g.add(sh);
  return g;
}
function plantPot(x, z, h, parent, seed) { return plant(x, z, h, parent, seed); }
/* a task chair: five-star base on casters, gas lift, a cushioned seat and back, arms */
function taskChair(x, z, yaw, parent, M) {
  const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = yaw; parent.add(c);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const leg = rbox(0.33, 0.035, 0.05, 0.015, M.plastic, Math.cos(a) * 0.17, 0.08, Math.sin(a) * 0.17, c); leg.rotation.y = -a; cyl(0.025, 0.025, 0.04, M.plastic, Math.cos(a) * 0.32, 0.03, Math.sin(a) * 0.32, c, 8); }
  cyl(0.025, 0.03, 0.32, M.chrome, 0, 0.26, 0, c, 10);
  rbox(0.5, 0.08, 0.48, 0.035, M.seat, 0, 0.46, 0.02, c);
  const back = rbox(0.46, 0.5, 0.06, 0.03, M.seat, 0, 0.78, -0.24, c); back.rotation.x = -0.12;
  cyl(0.015, 0.015, 0.3, M.plastic, 0, 0.58, -0.25, c, 6);
  for (const s of [-1, 1]) { rbox(0.05, 0.03, 0.26, 0.012, M.plastic, s * 0.27, 0.66, 0.02, c); rbox(0.03, 0.18, 0.03, 0.01, M.plastic, s * 0.27, 0.56, -0.05, c); }
  const sh = new THREE.Mesh(BLOB_GEO, blobMat(0.45)); sh.scale.set(0.8, 1, 0.8); sh.position.y = 0.01; sh.layers.set(2); c.add(sh);
  return c;
}

/* ================================================================
   THE OFFICE
   ================================================================ */
/* set dressing: an abstract canvas (colour fields, no words) */
function artTex(seed, pal) {
  const c = TX.cv(256, 320), g = c.getContext("2d"), r = rng(seed);
  g.fillStyle = pal[0]; g.fillRect(0, 0, 256, 320);
  for (let i = 0; i < 5; i++) { g.globalAlpha = 0.55 + r() * 0.4; g.fillStyle = pal[1 + (i % (pal.length - 1))]; const x = r() * 180, y = r() * 240; g.fillRect(x, y, 40 + r() * 120, 30 + r() * 140); }
  g.globalAlpha = 0.35; g.strokeStyle = "#f1ead8"; g.lineWidth = 3; g.beginPath(); g.moveTo(20, 280 * r() + 20); g.bezierCurveTo(90, 40, 160, 300, 236, 60 + r() * 200); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildOffice(o) {
  const set = new THREE.Group(); set.name = "office";
  set.userData = { lamps: [], spots: {}, walls: [], sounds: {} };
  const ROOM = [-7, 7, -5, 5, 3.1];
  const M = {
    carpet: rmat({ color: "#ffffff", mapK: "carpC", nmapK: "carpN", tri: 0.7, nk: 0.8, rough: 0.95, wet: 0, room: ROOM }),
    vinyl: pbr({ color: "#ffffff", map: TX.tileTex(8), tri: 0.42, rough: 0.35, wet: 0, room: ROOM }),
    wall: rmat({ color: "#efe7d8", mapK: "plasC", nmapK: "plasN", tri: 0.45, nk: 0.5, rough: 0.9, wet: 0, room: ROOM }),
    base: pbr({ color: "#2a2622", rough: 0.55, wet: 0, room: ROOM }),
    ceil: pbr({ color: "#ffffff", map: TX.ceilTex(), tri: 1 / 0.61, rough: 0.95, wet: 0, room: ROOM }),
    wood: rmat({ color: "#b89a7a", mapK: "woodC", nmapK: "woodN", rmapK: "woodR", tri: 0.9, nk: 0.5, rough: 0.5, wet: 0, room: ROOM }),
    steel: pbr({ color: "#2b2d2e", metal: 0.6, rough: 0.45, wet: 0, room: ROOM }),
    putty: pbr({ color: "#a29d90", metal: 0.35, rough: 0.5, wet: 0, room: ROOM }),
    chrome: pbr({ color: "#c9ccd0", metal: 1, rough: 0.18, wet: 0 }),
    plastic: pbr({ color: "#1c1d1e", rough: 0.45, wet: 0 }),
    seat: rmat({ color: "#2d3133", mapK: "fabC", nmapK: "fabN", tri: 3, nk: 0.6, rough: 0.9, wet: 0 }),
    fabric: rmat({ color: "#4f5b50", mapK: "fabC", nmapK: "fabN", tri: 2.5, nk: 0.6, rough: 0.92, wet: 0, room: ROOM }),
    paper: pbr({ color: "#ece8de", rough: 0.8, wet: 0 }),
    alu: pbr({ color: "#a9adb0", metal: 0.9, rough: 0.3, wet: 0 })
  };
  // the shell: floor (carpet, vinyl in the coffee corner), walls with a baseboard, a suspended ceiling
  const fl = plane(14, 10, M.carpet, set); fl.rotation.x = -Math.PI / 2;
  // the kitchenette in the corner: vinyl tile behind a metal threshold, the fridge, the counter (below)
  const vin = plane(2.2, 4.0, M.vinyl, set); vin.rotation.x = -Math.PI / 2; vin.position.set(-5.9, 0.004, 3.0);
  box(0.03, 0.008, 4.0, M.alu, -4.8, 0.004, 3.0, set); box(2.2, 0.008, 0.03, M.alu, -5.9, 0.004, 1.0, set);
  const ce = plane(14, 10, M.ceil, set); ce.rotation.x = Math.PI / 2; ce.position.y = 3.1;
  const back = plane(14, 3.1, M.wall, set); back.position.set(0, 1.55, -5);
  const left = plane(10, 3.1, M.wall, set); left.position.set(-7, 1.55, 0); left.rotation.y = Math.PI / 2;
  const right = plane(10, 3.1, M.wall, set); right.position.set(7, 1.55, 0); right.rotation.y = -Math.PI / 2;
  box(14, 0.1, 0.02, M.base, 0, 0.05, -4.99, set); box(0.02, 0.1, 10, M.base, -6.99, 0.05, 0, set); box(0.02, 0.1, 10, M.base, 6.99, 0.05, 0, set);
  // the front wall, with the window onto the lot
  const frontL = plane(4, 3.1, M.wall, set); frontL.position.set(-5, 1.55, 5); frontL.rotation.y = Math.PI;
  const frontR = plane(4, 3.1, M.wall, set); frontR.position.set(5, 1.55, 5); frontR.rotation.y = Math.PI;
  box(6, 0.9, 0.2, M.wall, 0, 0.45, 5.08, set); box(6, 0.3, 0.2, M.wall, 0, 2.95, 5.08, set);
  box(14, 0.1, 0.02, M.base, 0, 0.05, 4.97, set);
  // the window: the lot outside in the rain (the lot's key art, graded the same way), through drops that run
  const winT = new THREE.TextureLoader().load(o.lotArt); winT.colorSpace = THREE.SRGBColorSpace;
  const win = plane(6, 1.9, rainGlassMat(winT, 0.9, { aspect: 6 / 1.9 }), set); win.position.set(0, 1.85, 5.12); win.rotation.y = Math.PI;
  for (let i = 0; i <= 3; i++) box(0.06, 1.95, 0.08, M.alu, -3 + i * 2, 1.85, 5.02, set);
  box(6.1, 0.06, 0.08, M.alu, 0, 2.81, 5.02, set); box(6.1, 0.05, 0.08, M.alu, 0, 0.88, 5.02, set);
  box(6.3, 0.03, 0.22, M.paper, 0, 0.9, 4.92, set); // the sill
  // blinds, pulled most of the way up
  { const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(6.0, 0.003, 0.025), pbr({ color: "#e7e2d6", rough: 0.6, wet: 0 }), 14); const m4 = new THREE.Matrix4();
    for (let i = 0; i < 14; i++) { m4.makeRotationX(0.3); m4.setPosition(0, 2.78 - i * 0.022, 4.95); sl.setMatrixAt(i, m4); } sl.userData.keep = true; set.add(sl);
    box(6.05, 0.05, 0.05, M.alu, 0, 2.8, 4.95, set); }
  set.userData.window = win;
  set.userData.spots.window = { p: V3(0, 1.6, 4.8), r: 2.4, stand: V3(0.5, 0, 3.6) };
  set.userData.sounds.window = { x: 0, y: 1.85, z: 5.0, kind: "rain-glass", w: 6 };
  // the troffers: three 2 by 4 panels, the room's light
  const trof = glow("#ffffff", { map: TX.troffTex(), k: 1.7 });
  for (const [x, z] of [[-3.5, -1.5], [3.5, -1.5], [0, 2.5]]) {
    const p0 = plane(0.6, 1.2, trof, set); p0.rotation.x = Math.PI / 2; p0.position.set(x, 3.095, z);
    set.userData.lamps.push({ p: V3(x, 2.95, z), range: 9.5, col: [2.0, 2.05, 2.1], cone: 0, fixed: true });
  }
  set.userData.sounds.lamps = set.userData.lamps.map(l => ({ x: l.p.x, y: 3.05, z: l.p.z, kind: "fluorescent-hum" }));

  // the sale desk: Renata in the chair, Jason behind it, the phone, the monitor, the ledger
  const desk = new THREE.Group(); desk.position.set(-1.0, 0, -1.8); set.add(desk);
  rbox(2.6, 0.04, 1.1, 0.012, M.wood, 0, 0.75, 0, desk);
  for (const s of [-1, 1]) { box(0.05, 0.73, 1.0, M.steel, s * 1.22, 0.365, 0, desk); }
  box(2.4, 0.45, 0.02, M.steel, 0, 0.5, -0.48, desk);
  // the drawer pedestal on Jason's side
  rbox(0.42, 0.66, 0.9, 0.01, M.putty, 0.95, 0.33, -0.02, desk); for (let i = 0; i < 3; i++) box(0.12, 0.015, 0.015, M.chrome, 0.95, 0.55 - i * 0.2, 0.44, desk);
  const sh0 = new THREE.Mesh(BLOB_GEO, blobMat(0.5, true)); sh0.scale.set(3.0, 1, 1.5); sh0.position.y = 0.012; sh0.layers.set(2); desk.add(sh0);
  // the monitor on its stand, the keyboard and the mouse
  const mon = rbox(0.62, 0.38, 0.025, 0.008, M.plastic, 0.35, 1.08, -0.3, desk);
  box(0.06, 0.22, 0.04, M.plastic, 0.35, 0.86, -0.34, desk); rbox(0.22, 0.015, 0.16, 0.006, M.plastic, 0.35, 0.775, -0.33, desk);
  const monS = plane(0.585, 0.345, glow("#ffffff", { map: TX.screenTex("desk"), k: 0.95 }), desk); monS.position.set(0.35, 1.08, -0.286);
  set.userData.monitor = monS;
  rbox(0.44, 0.02, 0.14, 0.006, M.plastic, 0.35, 0.78, 0.05, desk); rbox(0.06, 0.02, 0.1, 0.01, M.plastic, 0.68, 0.78, 0.06, desk);
  // the phone: a desk set with its handset in the cradle
  const phone = new THREE.Group(); phone.position.set(-0.75, 0.77, 0.05); desk.add(phone); phone.userData.keep = true;
  rbox(0.22, 0.06, 0.2, 0.02, M.plastic, 0, 0.03, 0, phone); const hs = rbox(0.22, 0.045, 0.055, 0.02, M.plastic, 0, 0.08, -0.06, phone);
  for (let i = 0; i < 12; i++) box(0.022, 0.006, 0.016, M.alu, -0.03 + (i % 3) * 0.03, 0.062, 0.0 + Math.floor(i / 3) * 0.025, phone);
  const phoneLed = box(0.02, 0.008, 0.02, glow0("#c9a96a", { k: 0.4 }), 0.08, 0.064, 0.07, phone);
  set.userData.phone = { g: phone, led: phoneLed };
  set.userData.sounds.phone = { x: -1.75, y: 0.85, z: -1.75, kind: "desk-phone" };
  set.userData.spots.phone = { p: V3(-1.75, 0.95, -1.75), r: 1.8, stand: V3(-1.9, 0, -0.5) };
  const ledger = rbox(0.3, 0.035, 0.4, 0.008, pbr({ color: "#24402f", rough: 0.6, wet: 0 }), 0.95, 0.79, 0.15, desk);
  box(0.28, 0.02, 0.38, M.paper, 0.95, 0.785, 0.15, desk);
  set.userData.spots.ledger = { p: V3(-0.05, 0.9, -1.65), r: 1.6, stand: V3(0.2, 0, -0.5) };
  // clutter at human scale: papers, a folder, a pen cup, a mug of coffee, a stapler, sticky notes
  for (let i = 0; i < 3; i++) box(0.215, 0.004 + i * 0.002, 0.28, M.paper, -0.25 + i * 0.03, 0.774 + i * 0.006, 0.25 - i * 0.02, desk).rotation.y = (i - 1) * 0.08;
  box(0.24, 0.012, 0.31, pbr({ color: "#2d3b4f", rough: 0.6, wet: 0 }), -0.28, 0.79, 0.24, desk);
  cyl(0.035, 0.035, 0.1, M.plastic, 1.1, 0.82, -0.25, desk, 12);
  for (let i = 0; i < 4; i++) { const pn = cyl(0.004, 0.004, 0.14, pbr({ color: ["#1f3b63", "#111", "#7a2a22", "#c9a96a"][i], rough: 0.4, wet: 0 }), 1.1 + (i - 1.5) * 0.012, 0.88, -0.25, desk, 6); pn.rotation.z = (i - 1.5) * 0.12; }
  const mug = cyl(0.042, 0.038, 0.095, pbr({ color: "#ece8de", rough: 0.25, wet: 0 }), 0.85, 0.815, 0.2, desk, 16);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.037, 16), pbr({ color: "#1d120a", rough: 0.05, wet: 0 })); coffee.rotation.x = -Math.PI / 2; coffee.position.set(0.85, 0.855, 0.2); desk.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 6, 12), pbr({ color: "#ece8de", rough: 0.25, wet: 0 })); handle.position.set(0.895, 0.815, 0.2); handle.rotation.y = Math.PI / 2; desk.add(handle);
  rbox(0.16, 0.04, 0.04, 0.01, M.plastic, -0.6, 0.79, -0.3, desk);
  box(0.075, 0.004, 0.075, pbr({ color: "#e7cf73", rough: 0.7, wet: 0 }), 0.62, 0.774, 0.3, desk).rotation.y = 0.2;
  // the desk lamp, an arm lamp, warm: the room's practical
  { const L = new THREE.Group(); L.position.set(-1.1, 0.77, -0.3); desk.add(L);
    cyl(0.07, 0.08, 0.02, M.steel, 0, 0.01, 0, L, 16);
    const a1 = cyl(0.009, 0.009, 0.42, M.steel, 0, 0.2, 0.05, L, 6); a1.rotation.x = 0.25;
    const a2 = cyl(0.009, 0.009, 0.36, M.steel, 0, 0.44, 0.18, L, 6); a2.rotation.x = -1.0;
    const dsh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.1, 0.14, 16, 1, true), pbr({ color: "#1c3229", rough: 0.4, metal: 0.4, wet: 0, side: THREE.DoubleSide })); dsh.position.set(0, 0.42, 0.36); dsh.rotation.x = 0.35; L.add(dsh);
    const dbulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), glow("#ffd9a0", { k: 2.6 })); dbulb.position.set(0, 0.39, 0.37); L.add(dbulb); }
  set.userData.lamps.push({ p: V3(-2.1, 1.12, -1.72), range: 3.8, col: [1.6, 1.0, 0.52], cone: 0, fixed: true });
  // the monitor's cable along the floor to the wall
  box(0.012, 0.012, 1.4, M.plastic, 0.2, 0.006, -2.9, set);
  // two chairs: Jason's behind, the buyer's in front
  taskChair(-1.6, -0.75, Math.PI, set, M); taskChair(-0.2, -2.75, 0, set, M);
  set.userData.spots.desk = { p: V3(-1.0, 1.0, -1.8), r: 2.0, stand: V3(-0.6, 0, -0.4) };
  set.userData.walls.push({ x0: -2.4, x1: 0.4, z0: -2.45, z1: -1.2 });
  // a rug under the desk
  const rug = plane(3.8, 2.6, rmat({ color: "#6a3a2e", mapK: "fabC", tri: 2, rough: 0.95, wet: 0, room: ROOM }), set); rug.rotation.x = -Math.PI / 2; rug.position.set(-1, 0.008, -1.6);

  // the filing cabinet on the left wall: four drawers, label holders, handles
  const cab = new THREE.Group(); cab.position.set(-6.6, 0, -2.6); cab.rotation.y = Math.PI / 2; set.add(cab);
  rbox(0.46, 1.36, 0.62, 0.01, M.putty, 0, 0.68, 0, cab);
  ["Form 130-U", "webDEALER", "Liens", "Temp tags"].forEach((t, i) => {
    const y = 1.18 - i * 0.32;
    box(0.43, 0.3, 0.012, M.putty, 0, y - 0.04, 0.312, cab);
    const lb = plane(0.11, 0.035, pbr({ map: TX.labelTex(t, { w: 256, h: 80 }), color: "#fff", rough: 0.7, wet: 0, ao: 0 }), cab); lb.position.set(0, y + 0.06, 0.32);
    box(0.13, 0.05, 0.004, M.chrome, 0, y + 0.06, 0.319, cab);
    rbox(0.16, 0.025, 0.03, 0.01, M.chrome, 0, y - 0.03, 0.33, cab);
  });
  // a scale model's worth of clutter on top: a tray of folders
  box(0.32, 0.08, 0.26, M.plastic, 0, 1.4, 0, cab); for (let i = 0; i < 4; i++) box(0.3, 0.004, 0.23, M.paper, 0, 1.38 + i * 0.012, 0.01, cab);
  set.userData.spots.cabinet = { p: V3(-6.3, 1.0, -2.6), r: 1.8, stand: V3(-5.4, 0, -2.6) };
  set.userData.walls.push({ x0: -7, x1: -6.2, z0: -3.1, z1: -2.1 });

  // the whiteboard on the back wall, with three notes
  const wb = new THREE.Group(); wb.position.set(2.6, 1.6, -4.96); set.add(wb);
  rbox(2.5, 1.5, 0.03, 0.01, M.alu, 0, 0, 0, wb);
  const wbs = plane(2.42, 1.42, pbr({ map: TX.boardTex(), color: "#fff", rough: 0.15, wet: 0, ao: 0 }), wb); wbs.position.z = 0.017;
  box(2.0, 0.03, 0.08, M.alu, 0, -0.77, 0.05, wb);
  for (let i = 0; i < 3; i++) { const mk = cyl(0.009, 0.009, 0.13, pbr({ color: ["#1f3b63", "#7a2a22", "#1b1d1a"][i], rough: 0.4, wet: 0 }), -0.5 + i * 0.18, -0.745, 0.06, wb, 8); mk.rotation.z = Math.PI / 2; }
  const notes = {};
  [["note-rls", "Row-level security", "#e7cf73", -0.8], ["note-valid", "Validation", "#e9b7a3", 0], ["note-migr", "Migrations", "#bcd9c0", 0.8]].forEach(([id, t, c, x]) => {
    const n = plane(0.3, 0.3, pbr({ map: TX.noteTex(t, c), color: "#fff", rough: 0.8, wet: 0, ao: 0 }), wb); n.position.set(x, -0.46, 0.02); n.rotation.z = (x * 7 % 3 - 1) * 0.06; notes[id] = n;
    set.userData.spots[id] = { p: V3(2.6 + x, 1.6 - 0.46, -4.9), r: 0, close: true };
  });
  set.userData.notes = notes;
  set.userData.spots.board = { p: V3(2.6, 1.6, -4.9), r: 2.2, stand: V3(2.6, 0, -3.3), cam: { p: V3(2.6, 1.55, -2.55), t: V3(2.6, 1.42, -4.95) } };

  // the laptop on the side table by the right wall
  const tbl = new THREE.Group(); tbl.position.set(6.1, 0, 0.6); set.add(tbl);
  rbox(1.4, 0.04, 0.8, 0.01, M.wood, 0, 0.73, 0, tbl); for (const [sx, sz] of [[-0.64, -0.34], [0.64, -0.34], [-0.64, 0.34], [0.64, 0.34]]) box(0.04, 0.71, 0.04, M.steel, sx, 0.355, sz, tbl);
  rbox(0.34, 0.016, 0.24, 0.006, M.alu, 0, 0.758, 0.05, tbl);
  const lid = new THREE.Group(); lid.position.set(0, 0.765, -0.07); lid.rotation.x = -0.32; tbl.add(lid);
  rbox(0.34, 0.23, 0.01, 0.006, M.alu, 0, 0.115, 0, lid); const ls = plane(0.31, 0.2, glow("#ffffff", { map: TX.screenTex("lead"), k: 0.95 }), lid); ls.position.set(0, 0.118, 0.006);
  box(0.26, 0.002, 0.1, M.plastic, 0, 0.767, 0.07, tbl);
  tbl.rotation.y = -Math.PI / 2;
  set.userData.spots.laptop = { p: V3(6.1, 0.95, 0.6), r: 1.8, stand: V3(5.0, 0, 0.6) };
  set.userData.sounds.laptop = { x: 6.1, y: 0.8, z: 0.6, kind: "laptop-fan" };
  set.userData.walls.push({ x0: 5.6, x1: 7, z0: -0.2, z1: 1.4 });
  // the printer beside it, on a low cabinet
  rbox(0.6, 0.6, 0.5, 0.01, M.wood, 6.5, 0.3, 2.3, set); rbox(0.5, 0.3, 0.42, 0.03, pbr({ color: "#d9d6cf", rough: 0.5, wet: 0 }), 6.5, 0.75, 2.3, set); box(0.3, 0.005, 0.2, M.paper, 6.5, 0.905, 2.25, set);
  set.userData.walls.push({ x0: 6.15, x1: 6.85, z0: 2.0, z1: 2.6 });

  // the bookshelf behind the desk, with the book
  const shelf = new THREE.Group(); shelf.position.set(-3.4, 0, -4.75); set.add(shelf);
  box(1.6, 2.0, 0.02, M.wood, 0, 1.0, -0.17, shelf); box(0.03, 2.0, 0.36, M.wood, -0.785, 1.0, 0, shelf); box(0.03, 2.0, 0.36, M.wood, 0.785, 1.0, 0, shelf); box(1.6, 0.03, 0.36, M.wood, 0, 1.985, 0, shelf);
  { const r = rng(7), bcol = ["#6a2f2a", "#24402f", "#2d3b4f", "#8a7a5a", "#3a2a22", "#5a5a52", "#c9bfa8"];
    const bk = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), pbr({ color: "#ffffff", rough: 0.7, wet: 0, room: ROOM }), 200); const m4 = new THREE.Matrix4(), col = new THREE.Color(); let n = 0;
    for (let s = 0; s < 4; s++) { box(1.54, 0.025, 0.32, M.wood, 0, 0.1 + s * 0.47, 0.02, shelf); let x = -0.72; while (x < 0.62 && n < 200) { const w = 0.025 + r() * 0.035, h = 0.22 + r() * 0.12, lean = r() < 0.08 ? 0.18 : 0; m4.makeRotationZ(lean); m4.setPosition(x + w / 2, 0.115 + s * 0.47 + h / 2, 0.03); m4.scale(V3(w, h, 0.2 + r() * 0.04)); bk.setMatrixAt(n, m4); bk.setColorAt(n, col.set(bcol[(r() * bcol.length) | 0]).convertSRGBToLinear()); n++; x += w + 0.003 + lean * 0.1; } }
    bk.count = n; bk.userData.keep = true; shelf.add(bk); }
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.24), [pbr({ color: "#24402f", rough: 0.6, wet: 0 }), pbr({ color: "#24402f", rough: 0.6, wet: 0 }), pbr({ color: "#24402f", rough: 0.6, wet: 0 }), pbr({ color: "#24402f", rough: 0.6, wet: 0 }), pbr({ map: TX.docTex("book"), color: "#fff", rough: 0.6, wet: 0 }), pbr({ color: "#24402f", rough: 0.6, wet: 0 })]);
  book.position.set(0.55, 1.4, 0.12); book.rotation.y = -0.5; shelf.add(book);
  set.userData.book = book;
  set.userData.spots.book = { p: V3(-2.85, 1.4, -4.6), r: 1.8, stand: V3(-2.9, 0, -3.5) };
  set.userData.walls.push({ x0: -4.3, x1: -2.5, z0: -5, z1: -4.4 });

  // the coffee corner: a counter, the machine, mugs
  const cof = new THREE.Group(); cof.position.set(-6.4, 0, 2.6); set.add(cof);
  rbox(0.8, 0.88, 0.6, 0.01, M.wood, 0, 0.44, 0, cof); rbox(0.84, 0.04, 0.64, 0.01, pbr({ color: "#2a2928", rough: 0.3, wet: 0 }), 0, 0.9, 0, cof);
  rbox(0.32, 0.42, 0.3, 0.02, M.plastic, 0, 1.13, -0.05, cof); box(0.16, 0.02, 0.12, M.chrome, 0, 0.94, 0.08, cof); cyl(0.06, 0.05, 0.14, pbr({ color: "#202224", rough: 0.08, wet: 0 }), 0, 1.0, 0.06, cof, 16);
  box(0.06, 0.03, 0.02, glow("#c94a2a", { k: 1.2 }), 0.1, 1.25, 0.11, cof);
  for (let i = 0; i < 3; i++) cyl(0.04, 0.036, 0.09, pbr({ color: ["#ece8de", "#1c3229", "#ece8de"][i], rough: 0.25, wet: 0 }), -0.28 + i * 0.1, 0.965, 0.18, cof, 14);
  set.userData.spots.coffee = { p: V3(-6.3, 1.1, 2.6), r: 1.7, stand: V3(-5.4, 0, 2.6) };
  // the fridge beside it
  { const fr = new THREE.Group(); fr.position.set(-6.62, 0, 1.45); fr.rotation.y = Math.PI / 2; set.add(fr);
    const enamel = pbr({ color: "#e4e2dc", rough: 0.25, wet: 0, room: ROOM }); rbox(0.7, 1.72, 0.66, 0.03, enamel, 0, 0.86, 0, fr);
    box(0.68, 0.006, 0.01, M.plastic, 0, 1.2, 0.335, fr); rbox(0.03, 0.42, 0.04, 0.012, M.chrome, -0.28, 1.45, 0.35, fr); rbox(0.03, 0.3, 0.04, 0.012, M.chrome, -0.28, 0.95, 0.35, fr);
    for (let i = 0; i < 3; i++) box(0.06, 0.06, 0.004, pbr({ color: ["#c9a96a", "#1c3229", "#a85a3a"][i], rough: 0.5, wet: 0 }), 0.1 + i * 0.08, 1.5 - i * 0.05, 0.336, fr);
    set.userData.walls.push({ x0: -7, x1: -6.25, z0: 1.05, z1: 1.85 }); set.userData.sounds.fridge = { x: -6.62, y: 0.9, z: 1.45, kind: "fridge-hum" }; }
  set.userData.sounds.coffee = { x: -6.4, y: 1.1, z: 2.6, kind: "coffee-machine" };
  set.userData.walls.push({ x0: -7, x1: -5.9, z0: 2.2, z1: 3.0 });

  // the break room's arcade cabinet
  const arc = new THREE.Group(); arc.position.set(5.6, 0, -4.1); set.add(arc);
  const arcM = pbr({ color: "#151a18", rough: 0.35, wet: 0 });
  rbox(0.78, 1.9, 0.72, 0.02, arcM, 0, 0.95, 0, arc);
  const scr = plane(0.6, 0.45, glow0("#ffffff", { map: o.arcadeTex || TX.screenTex("arcade"), k: 1.1 }), arc); scr.position.set(0, 1.38, 0.365); scr.rotation.x = -0.18; scr.userData.keep = true;
  const marq = plane(0.7, 0.16, glow("#ffffff", { map: TX.labelTex("AFTER HOURS", { bg: "#1c3229", fg: "#ede7db", w: 512, h: 112 }), k: 1.2 }), arc); marq.position.set(0, 1.8, 0.365);
  rbox(0.72, 0.06, 0.3, 0.015, M.plastic, 0, 1.05, 0.45, arc);
  for (let i = 0; i < 4; i++) cyl(0.018, 0.018, 0.02, pbr({ color: ["#c9a96a", "#ede7db", "#c9a96a", "#ede7db"][i], rough: 0.3, wet: 0 }), 0.06 + i * 0.07, 1.09, 0.48, arc, 10);
  cyl(0.008, 0.008, 0.07, M.chrome, -0.18, 1.11, 0.46, arc, 6); const ball = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), pbr({ color: "#7a1a14", rough: 0.2, wet: 0 })); ball.position.set(-0.18, 1.15, 0.46); arc.add(ball);
  set.userData.arcadeScreen = scr;
  set.userData.spots.arcade = { p: V3(5.6, 1.3, -3.7), r: 1.9, stand: V3(5.4, 0, -2.6) };
  set.userData.sounds.arcade = { x: 5.6, y: 1.3, z: -3.7, kind: "arcade-attract" };
  set.userData.walls.push({ x0: 5.1, x1: 6.1, z0: -4.6, z1: -3.6 });
  set.userData.lamps.push({ p: V3(5.6, 1.5, -3.2), range: 3, col: [0.3, 0.4, 0.32], cone: 0, fixed: true });
  set.userData.lamps.push({ p: V3(0, 1.6, 5.6), range: 6.5, col: [0.55, 0.42, 0.3], cone: 0, fixed: true });
  set.userData.walls.push({ x0: -8, x1: 8, z0: -5.4, z1: -4.9 }, { x0: -7.4, x1: -6.9, z0: -6, z1: 6 }, { x0: 6.9, x1: 7.4, z0: -6, z1: 6 }, { x0: -8, x1: 8, z0: 4.85, z1: 5.4 });

  // plants, pictures, a clock, two armchairs by the window with a low table, binders, a floor lamp, a waste basket, a door
  plant(6.2, 3.9, 1.2, set, 3); plant(-6.2, -4.2, 1.6, set, 9); plant(1.4, -4.5, 0.9, set, 12);
  set.userData.walls.push({ x0: 5.8, x1: 6.6, z0: 3.5, z1: 4.3 }, { x0: -6.6, x1: -5.8, z0: -4.6, z1: -3.8 }, { x0: 1.0, x1: 1.8, z0: -4.9, z1: -4.1 });
  const frameM = pbr({ color: "#151413", rough: 0.4, wet: 0 });
  for (const [x, y, z, ry, w, h, seed, pal] of [[6.96, 1.75, -1.6, -Math.PI / 2, 0.9, 1.1, 21, ["#d8cfbd", "#1c3229", "#a85a3a", "#c9a96a"]], [6.96, 1.6, 2.5, -Math.PI / 2, 0.7, 0.9, 33, ["#e3dccb", "#2d3b4f", "#8a7a5a"]], [-6.96, 1.75, 0.3, Math.PI / 2, 1.2, 0.85, 47, ["#cfc6b2", "#6a2f2a", "#24402f", "#d6b98a"]], [-0.9, 1.95, -4.97, 0, 0.8, 0.6, 58, ["#ddd5c4", "#1c3229", "#b07a42"]]]) {
    const f = new THREE.Group(); f.position.set(x, y, z); f.rotation.y = ry; set.add(f);
    rbox(w + 0.08, h + 0.08, 0.035, 0.008, frameM, 0, 0, 0, f); box(w + 0.01, h + 0.01, 0.002, M.paper, 0, 0, 0.018, f);
    const a = plane(w - 0.08, h - 0.08, pbr({ map: artTex(seed, pal), color: "#fff", rough: 0.6, wet: 0, ao: 0 }), f); a.position.z = 0.0195;
  }
  { const clk = new THREE.Group(); clk.position.set(4.6, 2.5, -4.97); set.add(clk);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 8, 32), M.plastic); clk.add(rim);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.195, 32), pbr({ map: TX.clockTex(10, 8), color: "#fff", rough: 0.4, wet: 0, ao: 0 })); face.position.z = 0.005; clk.add(face);
    set.userData.sounds.clock = { x: 4.6, y: 2.5, z: -4.95, kind: "clock-tick" }; }
  for (const [x, ry] of [[-2.2, 0.35], [2.2, -0.35]]) {
    const a = new THREE.Group(); a.position.set(x, 0, 3.9); a.rotation.y = Math.PI + ry; set.add(a);
    rbox(0.82, 0.24, 0.78, 0.05, M.fabric, 0, 0.2, 0, a); rbox(0.66, 0.12, 0.62, 0.05, M.fabric, 0, 0.37, 0.04, a);
    rbox(0.82, 0.5, 0.16, 0.06, M.fabric, 0, 0.6, -0.31, a); rbox(0.13, 0.3, 0.74, 0.05, M.fabric, -0.36, 0.42, 0, a); rbox(0.13, 0.3, 0.74, 0.05, M.fabric, 0.36, 0.42, 0, a);
    for (const [lx, lz] of [[-0.35, -0.33], [0.35, -0.33], [-0.35, 0.33], [0.35, 0.33]]) cyl(0.018, 0.012, 0.08, M.wood, lx, 0.04, lz, a, 8);
    const s2 = new THREE.Mesh(BLOB_GEO, blobMat(0.4, true)); s2.scale.set(1.1, 1, 1.05); s2.position.y = 0.01; s2.layers.set(2); a.add(s2);
    set.userData.walls.push({ x0: x - 0.5, x1: x + 0.5, z0: 3.45, z1: 4.4 });
  }
  rbox(0.9, 0.035, 0.5, 0.01, M.wood, 0, 0.42, 4.0, set); for (const lx of [-0.4, 0.4]) for (const lz of [-0.2, 0.2]) cyl(0.015, 0.015, 0.4, M.steel, lx, 0.2, 4.0 + lz, set, 8);
  box(0.26, 0.01, 0.34, pbr({ color: "#a85a3a", rough: 0.6, wet: 0 }), 0.15, 0.443, 4.0, set);
  set.userData.walls.push({ x0: -0.5, x1: 0.5, z0: 3.7, z1: 4.3 });
  // binders on a low credenza under the whiteboard
  rbox(1.8, 0.7, 0.36, 0.01, M.wood, 2.6, 0.35, -4.78, set); set.userData.walls.push({ x0: 1.6, x1: 3.6, z0: -5, z1: -4.5 });
  { const rb = rng(17), bc2 = ["#1c3229", "#2d3b4f", "#6a2f2a", "#8a7a5a", "#e9e4d8"]; let x = 1.8; while (x < 3.35) { const w = 0.05 + rb() * 0.04; rbox(w, 0.3, 0.26, 0.006, pbr({ color: bc2[(rb() * bc2.length) | 0], rough: 0.5, wet: 0 }), x, 0.86, -4.76, set); x += w + 0.008; } }
  // a floor lamp in the coffee corner
  cyl(0.15, 0.16, 0.025, M.steel, -6.3, 0.012, 4.2, set, 20); cyl(0.012, 0.012, 1.5, M.steel, -6.3, 0.76, 4.2, set, 8);
  const fsh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.3, 20, 1, true), glow("#f1d6a8", { k: 1.1, side: THREE.DoubleSide })); fsh.position.set(-6.3, 1.6, 4.2); set.add(fsh);
  set.userData.lamps.push({ p: V3(-6.3, 1.5, 4.2), range: 4.5, col: [1.2, 0.8, 0.45], cone: 0, fixed: true });
  set.userData.walls.push({ x0: -6.6, x1: -6.0, z0: 3.9, z1: 4.5 });
  // a second desk at the back for whoever works the phones in the day, its chair pushed in, a coat stand by the right wall
  { const d2 = new THREE.Group(); d2.position.set(3.3, 0, -1.4); set.add(d2);
    rbox(1.6, 0.035, 0.75, 0.01, M.wood, 0, 0.74, 0, d2); for (const sx of [-0.76, 0.76]) box(0.04, 0.72, 0.7, M.steel, sx, 0.36, 0, d2); box(1.5, 0.4, 0.02, M.steel, 0, 0.5, -0.34, d2);
    rbox(0.5, 0.32, 0.02, 0.006, M.plastic, -0.2, 1.0, -0.2, d2); box(0.05, 0.2, 0.05, M.plastic, -0.2, 0.84, -0.22, d2);
    const sc2 = plane(0.47, 0.29, glow("#22303a", { k: 0.5 }), d2); sc2.position.set(-0.2, 1.0, -0.188);
    for (let i = 0; i < 2; i++) box(0.215, 0.006, 0.28, M.paper, 0.4 + i * 0.03, 0.76 + i * 0.006, 0.05, d2).rotation.y = 0.1 * i;
    plantPot(0.62, -0.22, 0.3, d2, 21).scale.setScalar(0.45); d2.children[d2.children.length - 1].position.y = 0.76;
    taskChair(3.4, -0.75, Math.PI + 0.2, set, M);
    const sh3 = new THREE.Mesh(BLOB_GEO, blobMat(0.45, true)); sh3.scale.set(1.9, 1, 1.0); sh3.position.y = 0.011; sh3.layers.set(2); d2.add(sh3);
    set.userData.walls.push({ x0: 2.4, x1: 4.2, z0: -1.85, z1: -0.95 }, { x0: 3.05, x1: 3.75, z0: -1.05, z1: -0.4 }); }
  { const cs = new THREE.Group(); cs.position.set(6.45, 0, -1.5); set.add(cs);
    for (let i = 0; i < 4; i++) { const leg = cyl(0.012, 0.012, 0.42, M.wood, Math.cos(i * 1.57) * 0.16, 0.12, Math.sin(i * 1.57) * 0.16, cs, 6); leg.rotation.set(Math.sin(i * 1.57) * 0.9, 0, -Math.cos(i * 1.57) * 0.9); }
    cyl(0.018, 0.022, 1.75, M.wood, 0, 0.9, 0, cs, 8);
    for (let i = 0; i < 4; i++) { const hk = cyl(0.008, 0.008, 0.16, M.wood, Math.cos(i * 1.57 + 0.6) * 0.06, 1.68, Math.sin(i * 1.57 + 0.6) * 0.06, cs, 5); hk.rotation.set(Math.sin(i * 1.57 + 0.6) * 0.8, 0, -Math.cos(i * 1.57 + 0.6) * 0.8); }
    // a raincoat on one hook, an umbrella leaning on the pole
    const coat = rbox(0.42, 0.9, 0.2, 0.08, pbr({ color: "#3a3f36", rough: 0.6, wet: 0.4 }), 0.08, 1.25, 0.05, cs); coat.rotation.z = 0.05;
    const um = cyl(0.035, 0.015, 0.85, pbr({ color: "#151716", rough: 0.4, wet: 0.6 }), -0.1, 0.42, 0.1, cs, 8); um.rotation.z = 0.15;
    set.userData.walls.push({ x0: 6.15, x1: 6.75, z0: -1.8, z1: -1.2 }); }
  // a waste basket by the desk, the door out to the lot on the left wall, a thermostat
  { const wbk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.32, 16, 1, true), pbr({ color: "#2a2b2c", rough: 0.5, wet: 0, side: THREE.DoubleSide })); wbk.position.set(0.55, 0.16, -2.3); set.add(wbk); }
  { const d = new THREE.Group(); d.position.set(-6.98, 0, 4.2); d.rotation.y = Math.PI / 2; set.add(d); box(1.0, 2.1, 0.04, rmat({ color: "#6b5440", mapK: "woodC", tri: 1.2, rough: 0.5, wet: 0 }), 0, 1.05, 0.02, d); box(1.1, 2.18, 0.03, M.steel, 0, 1.09, 0.0, d); rbox(0.12, 0.03, 0.05, 0.01, M.chrome, 0.38, 1.0, 0.07, d); }
  box(0.08, 0.12, 0.025, pbr({ color: "#e9e6de", rough: 0.4, wet: 0 }), -6.98, 1.5, 1.3, set).rotation.y = Math.PI / 2;
  mergeStatic(set);
  envHook(set, V3(0, 1.6, 0.5));
  set.userData.marks = {
    playerStart: V3(4.5, 0, 3.6), playerYaw: Math.PI,
    jason: V3(-1.3, 0, -0.55), jasonYaw: 0.4, jasonPhone: V3(-1.95, 0, -0.85),
    renata: V3(-0.2, 0, -2.75), renataYaw: 0
  };
  set.userData.spots.renata = { who: "renata", r: 2.0 };
  set.userData.bounds = { x0: -6.6, x1: 6.6, z0: -4.6, z1: 4.6 };
  set.userData.surfaceAt = (x, z) => (x < -4.8 && z > 1.0 ? "tile" : "carpet");
  set.userData.fogDen = 0.006;
  set.userData.ready = roomsReady;
  return set;
}

/* ================================================================
   THE LIBRARY (a memory)
   ================================================================ */
export function buildLibrary(o) {
  const set = new THREE.Group(); set.name = "memory";
  set.userData = { lamps: [], spots: {}, walls: [], sounds: {} };
  const ROOM = [-12, 12, -9, 9, 6.5];
  const M = {
    floor: rmat({ color: "#a88a6a", mapK: "floorC", nmapK: "floorN", rmapK: "floorR", tri: 0.45, nk: 0.6, rough: 0.35, wet: 0, room: ROOM }),
    panel: rmat({ color: "#7a5a3e", mapK: "woodC", nmapK: "woodN", rmapK: "woodR", tri: 0.6, nk: 0.5, rough: 0.45, wet: 0, room: ROOM }),
    wall: rmat({ color: "#b8a68c", mapK: "plasC", nmapK: "plasN", tri: 0.35, nk: 0.4, rough: 0.9, wet: 0, room: ROOM }),
    wood: rmat({ color: "#8a6444", mapK: "woodC", nmapK: "woodN", rmapK: "woodR", tri: 0.9, nk: 0.5, rough: 0.4, wet: 0, room: ROOM }),
    dark: rmat({ color: "#4a3424", mapK: "woodC", tri: 0.9, rough: 0.5, wet: 0, room: ROOM }),
    brass: pbr({ color: "#b08a4a", metal: 1, rough: 0.3, wet: 0 }),
    paper: pbr({ color: "#e6dfcf", rough: 0.8, wet: 0 }),
    runner: rmat({ color: "#6a2c24", mapK: "carpC", nmapK: "carpN", tri: 1, rough: 0.95, wet: 0, room: ROOM })
  };
  const fl = plane(24, 18, M.floor, set); fl.rotation.x = -Math.PI / 2;
  const ceil = plane(24, 18, pbr({ color: "#3a2c20", rough: 0.8, wet: 0, room: ROOM }), set); ceil.rotation.x = Math.PI / 2; ceil.position.y = 6.5;
  for (let i = -2; i <= 2; i++) box(0.3, 0.35, 18, M.dark, i * 4.8, 6.3, 0, set);
  // walls: wood wainscot to the rail, plaster above
  for (const [x, z, ry, w] of [[0, -9, 0, 24], [0, 9, Math.PI, 24], [-12, 0, Math.PI / 2, 18], [12, 0, -Math.PI / 2, 18]]) {
    const up = plane(w, 5.2, M.wall, set); up.position.set(x, 3.9, z); up.rotation.y = ry;
    const lo = plane(w, 1.3, M.panel, set); lo.position.set(x, 0.65, z); lo.rotation.y = ry;
    const rail = box(ry === 0 || ry === Math.PI ? w : 0.06, 0.07, ry === 0 || ry === Math.PI ? 0.06 : w, M.dark, x, 1.32, z, set);
  }
  // tall windows on the back wall, night outside and rain on the glass
  for (let i = 0; i < 5; i++) {
    const x = -8 + i * 4;
    const w = plane(1.6, 3.6, rainGlassMat(TX.nightTex(i + 2), 1.0, { aspect: 1.6 / 3.6 }), set); w.position.set(x, 3.4, -8.97);
    box(1.8, 0.12, 0.16, M.dark, x, 1.55, -8.93, set); box(1.8, 0.12, 0.12, M.dark, x, 5.25, -8.94, set);
    box(0.08, 3.7, 0.1, M.dark, x - 0.84, 3.4, -8.94, set); box(0.08, 3.7, 0.1, M.dark, x + 0.84, 3.4, -8.94, set); box(1.6, 0.05, 0.06, M.dark, x, 4.3, -8.94, set); box(0.04, 3.6, 0.06, M.dark, x, 3.4, -8.94, set);
  }
  set.userData.sounds.windows = { x: 0, y: 3.4, z: -8.9, kind: "rain-glass", w: 18 };
  const shade = glow("#2f6a46", { k: 0.9 });
  // long tables with green banker's lamps; one of them is the desk
  const r = rng(11);
  for (const [tx, tz] of [[-6, -3], [6, -3], [-6, 3], [6, 3], [0, 3]]) {
    const t = new THREE.Group(); t.position.set(tx, 0, tz); set.add(t);
    rbox(4.2, 0.07, 1.4, 0.015, M.wood, 0, 0.78, 0, t); box(4.0, 0.12, 1.25, M.dark, 0, 0.69, 0, t);
    for (const sx of [-1.9, 1.9]) { rbox(0.1, 0.72, 1.2, 0.01, M.dark, sx, 0.36, 0, t); }
    for (const lx of [-1.1, 1.1]) {
      cyl(0.07, 0.08, 0.02, M.brass, lx, 0.825, 0, t, 16); cyl(0.01, 0.01, 0.3, M.brass, lx, 0.97, -0.05, t, 6);
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.08, 20, 1, true, 0, Math.PI), shade); sh.rotation.z = Math.PI / 2; sh.rotation.y = Math.PI / 2; sh.position.set(lx, 1.13, 0.0); t.add(sh);
      const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 8), glow("#ffe2b0", { k: 2.4 })); bulb.rotation.z = Math.PI / 2; bulb.position.set(lx, 1.1, 0.0); t.add(bulb);
      set.userData.lamps.push({ p: V3(tx + lx, 1.08, tz), range: 3.6, col: [2.4, 1.75, 0.9], cone: 0, fixed: true });
    }
    const sh2 = new THREE.Mesh(BLOB_GEO, blobMat(0.5, true)); sh2.scale.set(4.6, 1, 1.8); sh2.position.y = 0.01; sh2.layers.set(2); t.add(sh2);
    set.userData.walls.push({ x0: tx - 2.2, x1: tx + 2.2, z0: tz - 0.8, z1: tz + 0.8 });
  }
  // pendants overhead, dimmed for the night
  for (const [x, z] of [[-6, 0], [6, 0], [0, -4], [0, 6]]) { cyl(0.006, 0.006, 2.4, M.brass, x, 5.3, z, set, 4); const pd = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), glow("#f6dcae", { k: 0.9 })); pd.position.set(x, 4.0, z); set.add(pd); }
  set.userData.lamps.push({ p: V3(0, 4.0, 0), range: 16, col: [0.9, 0.68, 0.42], cone: 0, fixed: true });
  // the stacks, left and right, full of books
  const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), pbr({ color: "#ffffff", rough: 0.7, wet: 0, room: ROOM }), 1600);
  const col = new THREE.Color(), m4 = new THREE.Matrix4(); let n = 0;
  const bc = ["#6a2f2a", "#24402f", "#2d3b4f", "#8a7a5a", "#3a2a22", "#5a5a52", "#7a5a3a", "#c9bfa8"];
  for (const sx of [-11, 11]) for (let row = 0; row < 3; row++) {
    const zc = -6 + row * 5;
    box(0.5, 3.4, 0.06, M.dark, sx, 1.7, zc - 2, set); box(0.5, 3.4, 0.06, M.dark, sx, 1.7, zc + 2, set); box(0.06, 3.4, 4, M.dark, sx + (sx < 0 ? -0.22 : 0.22), 1.7, zc, set); box(0.5, 0.08, 4.06, M.dark, sx, 3.42, zc, set);
    set.userData.walls.push({ x0: sx - 0.4, x1: sx + 0.4, z0: zc - 2, z1: zc + 2 });
    for (let s = 0; s < 6; s++) { box(0.46, 0.03, 3.94, M.dark, sx, 0.28 + s * 0.52, zc, set); let z = zc - 1.92; while (z < zc + 1.88 && n < 1600) { const w = 0.025 + r() * 0.045, h = 0.24 + r() * 0.16; m4.makeScale(0.2 + r() * 0.06, h, w); m4.setPosition(sx + (sx < 0 ? 0.04 : -0.04), 0.3 + s * 0.52 + h / 2, z + w / 2); books.setMatrixAt(n, m4); books.setColorAt(n, col.set(bc[(r() * bc.length) | 0]).convertSRGBToLinear().multiplyScalar(0.7 + r() * 0.5)); n++; z += w + 0.003; } }
  }
  books.count = n; books.userData.keep = true; set.add(books);
  // the desk where you sit: laptop, certificate, folder, letter, brain model, the lamp
  const lap = new THREE.Group(); lap.position.set(-0.7, 0.815, 3.1); set.add(lap);
  rbox(0.34, 0.016, 0.24, 0.006, pbr({ color: "#2b2d2f", metal: 0.6, rough: 0.35, wet: 0 }), 0, 0.008, 0, lap);
  const ld = new THREE.Group(); ld.position.set(0, 0.015, -0.12); ld.rotation.x = -0.3; lap.add(ld); rbox(0.34, 0.23, 0.01, 0.006, pbr({ color: "#2b2d2f", metal: 0.6, rough: 0.35, wet: 0 }), 0, 0.115, 0, ld);
  const lsc = plane(0.31, 0.2, glow("#ffffff", { map: TX.screenTex("courses"), k: 0.9 }), ld); lsc.position.set(0, 0.118, 0.006);
  const doc = (kind, x, z, rot) => { const d = plane(0.21, 0.28, pbr({ map: TX.docTex(kind), color: "#fff", rough: 0.8, wet: 0, ao: 0 }), set); d.rotation.set(-Math.PI / 2, 0, rot); d.position.set(x, 0.817, z); return d; };
  doc("cert", 0.2, 3.25, 0.15); doc("folder", 0.62, 2.95, -0.2); doc("letter", -0.2, 2.8, 0.35);
  const brain = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 4), pbr({ color: "#c9908a", rough: 0.45, wet: 0 }));
  { const p = brain.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const v = V3(p.getX(i), p.getY(i), p.getZ(i)); const k = 1 + 0.07 * Math.sin(v.x * 90) * Math.sin(v.y * 80 + v.z * 70) + 0.03 * Math.sin(v.z * 200); v.multiplyScalar(k); v.y *= 0.8; v.z *= 1.2; p.setXYZ(i, v.x, v.y, v.z); } brain.geometry.computeVertexNormals(); }
  brain.position.set(1.4, 0.9, 3.05); set.add(brain); cyl(0.06, 0.07, 0.02, M.dark, 1.4, 0.825, 3.05, set, 16);
  set.userData.deskLamp = set.userData.lamps.find(l => Math.abs(l.p.x - 1.1) < 0.01 && Math.abs(l.p.z - 3) < 0.01) || null;
  set.userData.spots["mem-laptop"] = { p: V3(-0.7, 0.95, 3.0), r: 1.4, stand: V3(-0.7, 0, 4.1) };
  set.userData.spots["mem-cert"] = { p: V3(0.2, 0.85, 3.25), r: 1.3, stand: V3(0.2, 0, 4.1) };
  set.userData.spots["mem-folder"] = { p: V3(0.62, 0.85, 2.95), r: 1.3, stand: V3(0.6, 0, 4.1) };
  set.userData.spots["mem-letter"] = { p: V3(-0.2, 0.85, 2.8), r: 1.3, stand: V3(-0.2, 0, 4.1) };
  set.userData.spots["mem-brain"] = { p: V3(1.4, 0.95, 3.05), r: 1.3, stand: V3(1.4, 0, 4.1) };
  set.userData.spots["mem-lamp"] = { p: V3(1.1, 1.15, 3.0), r: 1.5, stand: V3(1.1, 0, 4.1) };
  set.userData.walls.push({ x0: -12, x1: 12, z0: -9.4, z1: -8.9 }, { x0: -12, x1: 12, z0: 8.9, z1: 9.4 }, { x0: -12.4, x1: -11.9, z0: -9, z1: 9 }, { x0: 11.9, x1: 12.4, z0: -9, z1: 9 });
  // a reading room someone uses: chairs pulled out, stacks left open, a cart, a runner, a clock
  const rr = rng(23);
  const chairM = M.wood;
  for (const [tx, tz] of [[-6, -3], [6, -3], [-6, 3], [6, 3], [0, 3]]) for (const side of [-1, 1]) for (const cx of [-1.2, 0, 1.2]) {
    if (tx === 0 && side > 0) continue; // your side of the desk stays open
    const c = new THREE.Group(); c.position.set(tx + cx + (rr() - 0.5) * 0.2, 0, tz + side * (0.95 + rr() * 0.25)); c.rotation.y = (side > 0 ? Math.PI : 0) + (rr() - 0.5) * 0.4; set.add(c);
    rbox(0.44, 0.045, 0.42, 0.012, chairM, 0, 0.46, 0, c);
    for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) cyl(0.018, 0.015, 0.46, chairM, lx, 0.23, lz, c, 8);
    for (const lx of [-0.19, 0.19]) cyl(0.015, 0.015, 0.5, chairM, lx, 0.72, 0.19, c, 8);
    rbox(0.42, 0.12, 0.025, 0.01, chairM, 0, 0.92, 0.19, c); for (let k = -1; k <= 1; k++) box(0.025, 0.36, 0.015, chairM, k * 0.09, 0.69, 0.19, c);
  }
  for (const [tx, tz] of [[-6, -3], [6, -3], [-6, 3], [6, 3]]) for (let k = 0; k < 3; k++) {
    const x = tx - 1.5 + rr() * 3, z = tz + (rr() - 0.5) * 0.8; let y = 0.815;
    for (let b = 0; b < 2 + ((rr() * 3) | 0); b++) { const h = 0.03 + rr() * 0.03; const m = rbox(0.22 + rr() * 0.08, h, 0.3, 0.004, pbr({ color: bc[(rr() * bc.length) | 0], rough: 0.6, wet: 0 }), x, y + h / 2, z, set); m.rotation.y = (rr() - 0.5) * 0.5; y += h; }
    if (rr() < 0.6) { const pg = plane(0.42, 0.3, M.paper, set); pg.rotation.set(-Math.PI / 2, 0, (rr() - 0.5) * 0.6); pg.position.set(x + 0.4, 0.817, z + 0.1); }
  }
  { const c = new THREE.Group(); c.position.set(-2.6, 0, 6.2); c.rotation.y = 0.3; set.add(c); rbox(1.0, 0.04, 0.45, 0.01, M.wood, 0, 0.3, 0, c); rbox(1.0, 0.04, 0.45, 0.01, M.wood, 0, 0.75, 0, c); for (const lx of [-0.48, 0.48]) box(0.04, 0.8, 0.45, M.wood, lx, 0.4, 0, c);
    for (const [wx, wz] of [[-0.42, -0.18], [0.42, -0.18], [-0.42, 0.18], [0.42, 0.18]]) { const wh = cyl(0.04, 0.04, 0.03, pbr({ color: "#1a1a1a", rough: 0.7, wet: 0 }), wx, 0.04, wz, c, 12); wh.rotation.z = Math.PI / 2; }
    let x = -0.44; while (x < 0.44) { const w = 0.04 + rr() * 0.04, h = 0.24 + rr() * 0.1; rbox(w, h, 0.2, 0.004, pbr({ color: bc[(rr() * bc.length) | 0], rough: 0.6, wet: 0 }), x, 0.77 + h / 2, 0, c); x += w + 0.01; }
    set.userData.walls.push({ x0: -3.3, x1: -1.9, z0: 5.8, z1: 6.6 }); }
  const runner = plane(3, 14, M.runner, set); runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.008, 0);
  { const clk = new THREE.Group(); clk.position.set(0, 5.6, -8.95); set.add(clk); const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.03, 8, 40), M.brass); clk.add(rim); const face = new THREE.Mesh(new THREE.CircleGeometry(0.35, 40), pbr({ map: TX.clockTex(11, 40), color: "#fff", rough: 0.4, wet: 0, ao: 0 })); face.position.z = 0.01; clk.add(face); set.userData.sounds.clock = { x: 0, y: 5.6, z: -8.9, kind: "clock-tick" }; }
  mergeStatic(set);
  envHook(set, V3(0, 1.6, 4));
  set.userData.marks = { playerStart: V3(0, 0, 4.4), playerYaw: Math.PI };
  set.userData.fogDen = 0.006; // a big quiet room: clear air, the windows' bokeh still soft
  set.userData.bounds = { x0: -11.5, x1: 11.5, z0: -8.5, z1: 8.5 };
  set.userData.surfaceAt = (x, z) => (Math.abs(x) < 1.5 && Math.abs(z) < 7 ? "carpet" : "wood");
  set.userData.ready = roomsReady;
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
/* the loads, last so everything above exists. main.js awaits lotReady (with its own cap) before it builds the lot; a lot built before
   it settles parks its cars and patches its textures in when they land (buildLot never assumes they are there) */
loadTotal += CAR_KINDS.length;
export const lotReady = Promise.all([loadCars().catch(e => console.warn("[world] cars", e)), loadSetTex(LOT_TEX)]);
lotReady.then(patchLate);
export const roomsReady = lotReady.then(() => loadSetTex(ROOM_TEX)).then(patchLate);
export const _debug = { carLib, T, TIER };
