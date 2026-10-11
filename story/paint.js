/* After Hours: the paint. One lighting model for every surface in the
   episode, so the world reads as one painting: a soft ramp with a brushed
   terminator, hemisphere ambient, sodium lamps and a moon, a rim of cool light,
   a grain of brush strokes in the albedo, contact shade near the ground, a wet
   sheen where the rain sits, and fog. Lamps are uniforms shared by every
   material (no three.js lights), so the reflection pass can mirror them. */
import * as THREE from "../vendor/three-0.184.0/three.module.min.js";

export const MAXL = 8;
export const U = {
  uTime: { value: 0 },
  uSky: { value: new THREE.Color("#22303a") },
  uGround: { value: new THREE.Color("#0c0f0d") },
  uMoonDir: { value: new THREE.Vector3(-0.4, 0.75, -0.5).normalize() },
  uMoon: { value: new THREE.Color("#3a4a5c") },
  uRim: { value: new THREE.Color("#5b7385") },
  uLampPos: { value: Array.from({ length: MAXL }, () => new THREE.Vector4(0, -100, 0, 1)) },
  uLampCol: { value: Array.from({ length: MAXL }, () => new THREE.Vector4(0, 0, 0, 0)) },
  uLampN: { value: 0 },
  uFog: { value: new THREE.Color("#0b1012") },
  uFogDen: { value: 0.035 },
  uBrush: { value: null },
  uMirror: { value: 0 },
  uWetAll: { value: 0.6 },
  uSat: { value: 1 }
};

const common = /* glsl */`
uniform float uTime; uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uMoonDir; uniform vec3 uMoon; uniform vec3 uRim;
uniform vec4 uLampPos[${MAXL}]; uniform vec4 uLampCol[${MAXL}]; uniform int uLampN;
uniform vec3 uFog; uniform float uFogDen; uniform sampler2D uBrush; uniform float uMirror; uniform float uWetAll; uniform float uSat;
float brushAt(vec3 wp, vec3 n){
  vec3 b = pow(abs(n), vec3(4.0)); b /= (b.x + b.y + b.z);
  float x = texture2D(uBrush, wp.zy * 0.9).r, y = texture2D(uBrush, wp.xz * 0.9).g, z = texture2D(uBrush, wp.xy * 0.9).b;
  return x * b.x + y * b.y + z * b.z;
}
float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z); }
float ramp(float x, float n){
  // a soft terminator, nudged by the brush so the edge reads as painted
  float a = smoothstep(-0.12 + n * 0.22, 0.28 + n * 0.22, x);
  float b = smoothstep(0.45, 0.85, x);
  return a * 0.78 + b * 0.22;
}
vec3 lightAt(vec3 wp, vec3 N, vec3 V, float br, float wet, out vec3 spec){
  vec3 L0 = vec3(uMoonDir.x, uMoonDir.y * (uMirror > 0.5 ? -1.0 : 1.0), uMoonDir.z);
  float hemi = N.y * 0.5 + 0.5;
  vec3 c = mix(uGround, uSky, hemi);
  c += uMoon * ramp(dot(N, L0), br);
  spec = vec3(0.0);
  for (int i = 0; i < ${MAXL}; i++) {
    if (i >= uLampN) break;
    vec3 lp = uLampPos[i].xyz; if (uMirror > 0.5) lp.y = -lp.y;
    vec3 L = lp - wp; float d = length(L); L /= d;
    float r = uLampPos[i].w;
    float att = clamp(1.0 - d / r, 0.0, 1.0); att *= att;
    // a lamp's colour carries its strength; .w > 0 makes it a downlight with a cone
    float cone = 1.0;
    if (uLampCol[i].w > 0.0) { float cd = dot(-L, vec3(0.0, uMirror > 0.5 ? 1.0 : -1.0, 0.0)); cone = smoothstep(uLampCol[i].w, uLampCol[i].w + 0.25, cd); }
    float nl = dot(N, L);
    c += uLampCol[i].rgb * ramp(nl, br) * att * cone;
    vec3 H = normalize(L + V);
    spec += uLampCol[i].rgb * pow(max(dot(N, H), 0.0), 60.0) * att * cone * wet * 1.6;
  }
  return c;
}
vec3 fogged(vec3 col, vec3 wp){
  float d = length(wp - cameraPosition);
  float f = 1.0 - exp(-uFogDen * d);
  return mix(col, uFog, clamp(f, 0.0, 1.0));
}
vec3 sat(vec3 c, float s){ float l = dot(c, vec3(0.299, 0.587, 0.114)); return mix(vec3(l), c, s); }
`;

const vert = /* glsl */`
#include <common>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
attribute float cidx;
varying vec3 vWP; varying vec3 vN; varying vec2 vUv; varying float vC; varying vec3 vObj; varying vec3 vCol;
uniform mat3 uUvM;
#ifdef USE_VCOL
attribute vec3 color;
#endif
void main(){
  vUv = (uUvM * vec3(uv, 1.0)).xy; vC = cidx; vObj = position;
  #ifdef USE_VCOL
  vCol = color;
  #else
  vCol = vec3(1.0);
  #endif
  #include <beginnormal_vertex>
  #include <morphinstance_vertex>
  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <morphtarget_vertex>
  #include <skinning_vertex>
  vec4 wp = modelMatrix * vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
  objectNormal = mat3(instanceMatrix) * objectNormal;
  #endif
  vWP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * objectNormal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const frag = /* glsl */`
${common}
uniform vec3 uColor; uniform vec3 uEmit; uniform float uWet; uniform float uAo; uniform float uRimK; uniform float uAlpha; uniform float uTone; uniform float uAlphaTest; uniform float uSkin; uniform vec3 uKeep; uniform float uCurlK; uniform vec3 uTie;
uniform vec3 uPal[16];
#ifdef USE_TMAP
uniform sampler2D uMap;
#endif
#ifdef USE_EMAP
uniform sampler2D uEMap;
#endif
#ifdef USE_MASK
uniform sampler2D uMask; uniform vec3 uBeard; uniform vec3 uLip;
#endif
varying vec3 vWP; varying vec3 vN; varying vec2 vUv; varying float vC; varying vec3 vObj; varying vec3 vCol;
void main(){
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWP);
  float curl = 1.0;
  #ifdef USE_CURL
  // tight curls: a bumped normal and dark crevices from small-scale noise in object space
  vec3 cp = vObj * uCurlK;
  float c0 = vnoise(cp), cx = vnoise(cp + vec3(0.37, 0.0, 0.0)), cy = vnoise(cp + vec3(0.0, 0.37, 0.0)), cz = vnoise(cp + vec3(0.0, 0.0, 0.37));
  N = normalize(N + (vec3(cx, cy, cz) - c0) * 1.3);
  curl = mix(0.55, 1.25, smoothstep(0.25, 0.8, c0 * 0.6 + vnoise(cp * 2.3) * 0.4));
  #endif
  float br = brushAt(vWP, N);
  vec3 alb = uColor * vCol;
  #ifdef USE_PAL
  alb = uPal[int(vC + 0.5)];
  #endif
  float aout = uAlpha;
  #ifdef USE_TMAP
  vec4 tx = texture2D(uMap, vUv);
  #ifdef USE_RECOLOR
  // recolour a fabric texture: its light and folds, in a new colour; very light areas (a white shirt) keep their own colour
  float lum = dot(tx.rgb, vec3(0.299, 0.587, 0.114));
  vec3 rc = uColor * clamp(lum * 2.4, 0.0, 1.6);
  alb = mix(rc, uKeep * clamp(lum * 1.15, 0.0, 1.2), smoothstep(0.42, 0.62, lum));
  // a region marked red in the texture (a tie) takes its own colour
  float tk = smoothstep(0.12, 0.22, tx.r - max(tx.g, tx.b));
  alb = mix(alb, uTie * clamp(tx.r * 2.0, 0.0, 1.5), tk);
  #else
  alb *= tx.rgb;
  #endif
  aout *= tx.a;
  if (aout < uAlphaTest) discard;
  #endif
  #ifdef USE_MASK
  // the face's painted detail: R beard, G lips, B a little warmth on the cheeks
  vec4 fm = texture2D(uMask, vUv);
  alb = mix(alb, uLip, fm.g * 0.85);
  alb *= 1.0 + fm.b * vec3(0.12, 0.02, -0.02);
  float stub = fm.r * mix(0.55, 1.0, vnoise(vObj * uCurlK * 1.7));
  alb = mix(alb, uBeard, clamp(stub * 1.15, 0.0, 1.0));
  #endif
  alb *= mix(0.86, 1.12, br) * curl;
  float wet = uWet * uWetAll;
  vec3 spec;
  vec3 light = lightAt(vWP, N, V, br, wet, spec);
  // contact shade: things darken toward the ground they stand on
  float ao = mix(1.0, smoothstep(-0.05, 0.55, vWP.y * (uMirror > 0.5 ? -1.0 : 1.0)) * 0.55 + 0.45, uAo);
  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  // skin: a warm wrap where light meets shadow, so faces never go blue-grey in the shade
  light += uSkin * vec3(0.09, 0.04, 0.025) * (1.0 - smoothstep(-0.2, 0.6, dot(N, uMoonDir))) ;
  light = mix(light, light * vec3(1.06, 0.98, 0.92) + vec3(0.03, 0.015, 0.008), uSkin);
  vec3 col = alb * light * ao + spec + uRim * fr * uRimK * (0.5 + br) * mix(1.0, 0.45, uSkin);
  col += uEmit;
  #ifdef USE_EMAP
  col += texture2D(uEMap, vUv).rgb * uTone;
  #endif
  col = sat(col, uSat);
  gl_FragColor = vec4(fogged(col, vWP), aout);
  #include <colorspace_fragment>
}`;

/* One material. o: { color, map, emap, emit, pal (array of hex), wet, ao, rim, alpha, skinned, vcol, side, tone } */
export function paint(o = {}) {
  const defines = {};
  const uniforms = {
    ...U,
    uColor: { value: new THREE.Color(o.color || "#888") },
    uEmit: { value: new THREE.Color(o.emit || "#000") },
    uWet: { value: o.wet != null ? o.wet : 0.15 },
    uAo: { value: o.ao != null ? o.ao : 0 },
    uRimK: { value: o.rim != null ? o.rim : 0.6 },
    uAlpha: { value: o.alpha != null ? o.alpha : 1 },
    uTone: { value: o.tone != null ? o.tone : 1 },
    uAlphaTest: { value: o.alphaTest || 0 },
    uSkin: { value: o.skin ? 1 : 0 },
    uKeep: { value: new THREE.Color(o.keep || "#e9e6de") },
    uCurlK: { value: o.curlK || 900 },
    uUvM: { value: new THREE.Matrix3() },
    uTie: { value: new THREE.Color(o.tie || "#1d4434") },
    uPal: { value: Array.from({ length: 16 }, (_, i) => new THREE.Color((o.pal && o.pal[i]) || "#ff00ff")) }
  };
  if (o.map) {
    defines.USE_TMAP = ""; uniforms.uMap = { value: o.map }; if (o.recolor) defines.USE_RECOLOR = "";
    // gltfpack quantizes UVs and undoes it with a texture transform: honour it
    o.map.updateMatrix(); uniforms.uUvM.value.copy(o.map.matrix);
  }
  if (o.mask) { defines.USE_MASK = ""; uniforms.uMask = { value: o.mask }; uniforms.uBeard = { value: new THREE.Color(o.beard || "#120d0b") }; uniforms.uLip = { value: new THREE.Color(o.lip || "#5a3028") }; o.mask.updateMatrix(); uniforms.uUvM.value.copy(o.mask.matrix); }
  if (o.emap) { defines.USE_EMAP = ""; uniforms.uEMap = { value: o.emap }; }
  if (o.pal) defines.USE_PAL = "";
  if (o.curl) defines.USE_CURL = "";
  if (o.vcol) defines.USE_VCOL = "";
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, defines, side: o.side || THREE.FrontSide, transparent: !!o.transparent || (o.alpha != null && o.alpha < 1), depthWrite: o.depthWrite != null ? o.depthWrite : true });
  m.userData.paint = true;
  return m;
}

/* glow: unlit, for lamp heads, screens and signs; additive optional */
export function glow(color, o = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uK: { value: o.k || 1 }, uMap: { value: o.map || null }, uFog: U.uFog, uFogDen: U.uFogDen, uA: { value: o.alpha != null ? o.alpha : 1 } },
    defines: o.map ? { USE_MAP: "" } : {},
    vertexShader: `varying vec2 vUv; varying vec3 vWP; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0);
      #ifdef USE_INSTANCING
      wp = modelMatrix * instanceMatrix * vec4(position,1.0);
      #endif
      vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 uC; uniform float uK; uniform float uA; uniform sampler2D uMap; uniform vec3 uFog; uniform float uFogDen; varying vec2 vUv; varying vec3 vWP;
      void main(){ vec3 c = uC * uK; float a = uA;
      #ifdef USE_MAP
      vec4 t = texture2D(uMap, vUv); c *= t.rgb; a *= t.a;
      #endif
      float f = 1.0 - exp(-uFogDen * 0.5 * length(vWP - cameraPosition)); gl_FragColor = vec4(mix(c, uFog, f * 0.6), a);
      #include <colorspace_fragment>
      }`,
    transparent: !!o.transparent || o.alpha != null || !!o.additive, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !o.additive && !o.transparent, side: o.side || THREE.FrontSide
  });
  return m;
}

/* the volumetric-feeling lamp cone: additive, brightest along its axis, fading with height and at grazing angles */
export function coneMat(color, k = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uK: { value: k }, uTime: U.uTime },
    vertexShader: `varying vec3 vN; varying vec3 vWP; varying float vH; void main(){ vH = uv.y; vec4 wp = modelMatrix * vec4(position,1.0); vWP = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 uC; uniform float uK; uniform float uTime; varying vec3 vN; varying vec3 vWP; varying float vH;
      float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      void main(){ vec3 V = normalize(cameraPosition - vWP); float edge = pow(abs(dot(normalize(vN), V)), 1.6);
        float fall = smoothstep(0.0, 0.9, vH) * smoothstep(1.0, 0.82, vH);
        float rain = 0.85 + 0.15 * h(floor(vec2(vWP.x * 30.0 + vWP.z * 30.0, vWP.y * 6.0 + uTime * 40.0)));
        gl_FragColor = vec4(uC * uK * edge * fall * 0.16 * rain, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
}

/* blob shade under people and cars: soft, painted, cheap */
export function blobMat(k = 0.55) {
  return new THREE.ShaderMaterial({
    uniforms: { uK: { value: k } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uK; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, d); gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * uK); }`,
    transparent: true, depthWrite: false
  });
}
