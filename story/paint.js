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
  uSat: { value: 1 },
  // the wind's push on the rain, in metres a second along x and z (world.js gusts it on the lot)
  uWind: { value: new THREE.Vector2(0, 0) },
  // the set's own reflections: a cube rendered from the middle of the set once it is up (world.js), and how much to trust it
  uEnv: { value: null },
  uEnvOn: { value: 0 },
  uEnvMax: { value: 6 },
  uEnvK: { value: 1 }
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
#if defined(USE_VCOL) || defined(USE_HAIRLINE) || defined(USE_SKINAO)
attribute vec3 color;
#endif
#ifdef USE_BODY
// a body you can shape (the visitor's own): uObj takes the mesh to the body's rest space; uBody.x is the build in
// metres along the normal, .y the height of the neck; the face's own landmarks and how far each feature is pushed
uniform vec4 uObj; uniform vec4 uBody; uniform vec3 uNose; uniform vec3 uMouth; uniform vec4 uFaceA; uniform vec4 uFaceB;
float bell(vec3 q, vec3 r){ q /= r; return exp(-dot(q, q)); }
#endif
#ifdef USE_GROW
// a shell of hair that can be worn closer or fuller: each vertex knows the way back to the scalp
attribute vec3 _scalp; uniform float uGrow;
#endif
void main(){
  vUv = (uUvM * vec3(uv, 1.0)).xy; vC = cidx; vObj = position;
  #if defined(USE_VCOL) || defined(USE_HAIRLINE) || defined(USE_SKINAO)
  vCol = color;
  #else
  vCol = vec3(1.0);
  #endif
  #ifdef USE_INSTANCING_COLOR
  vCol = instanceColor;
  #endif
  #include <beginnormal_vertex>
  #include <morphinstance_vertex>
  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <morphtarget_vertex>
  #ifdef USE_GROW
  transformed += _scalp * (1.0 - uGrow);
  #endif
  #ifdef USE_BODY
  { vec3 rp = transformed * uObj.w + uObj.xyz, d = vec3(0.0), nn = normalize(objectNormal);
    // the build: everything below the neck but the hands and feet, most round the middle
    float wb = smoothstep(uBody.y + 0.02, uBody.y - 0.07, rp.y) * smoothstep(0.05, 0.16, rp.y) * (1.0 - smoothstep(0.36, 0.47, abs(rp.x)));
    float mid = 1.0 + 0.9 * exp(-pow((rp.y - uBody.y * 0.74) / 0.16, 2.0)) * (1.0 - smoothstep(0.22, 0.32, abs(rp.x)));
    d += nn * uBody.x * wb * mid * mix(0.5, 1.0, smoothstep(uBody.y * 0.45, uBody.y * 0.62, rp.y));
    #ifdef USE_FACE
    vec3 q = rp - uNose;
    d.x += q.x * 0.55 * uFaceA.x * bell(q - vec3(0.0, 0.004, -0.014), vec3(0.026, 0.026, 0.028));
    float gt = bell(q, vec3(0.02, 0.022, 0.024)); d.z += 0.011 * uFaceA.y * gt; d.y -= 0.004 * uFaceA.y * gt;
    vec3 m = rp - uMouth;
    // (narrower and thinner go half as far as wider and fuller: the teeth behind stay where they are)
    d.x += m.x * (uFaceA.z > 0.0 ? 0.34 : 0.15) * uFaceA.z * bell(m, vec3(0.042, 0.02, 0.036));
    d += nn * (uFaceA.w > 0.0 ? 0.0036 : 0.0012) * uFaceA.w * bell(m, vec3(0.03, 0.013, 0.022));
    vec3 j = m - vec3(0.0, -0.04, -0.035);
    d.x += j.x * 0.22 * uFaceB.x * bell(j, vec3(0.085, 0.045, 0.07));
    #endif
    transformed += d / uObj.w; }
  #endif
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
uniform vec3 uPal[16]; uniform vec4 uObj;
#ifdef USE_TMAP
uniform sampler2D uMap;
#endif
#ifdef USE_EMAP
uniform sampler2D uEMap;
#endif
#ifdef USE_MASK
uniform sampler2D uMask; uniform vec3 uBeard; uniform vec3 uLip;
#endif
#ifdef USE_EYE
uniform vec2 uEye; uniform vec4 uIris;
#endif
#ifdef USE_CROP
uniform vec4 uCrop;
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
  N = normalize(N + (vec3(cx, cy, cz) - c0) * 0.7);
  curl = mix(0.55, 1.25, smoothstep(0.25, 0.8, c0 * 0.6 + vnoise(cp * 2.3) * 0.4));
  #endif
  float br = brushAt(vWP, N);
  #ifdef USE_HAIRLINE
  // R: above the hairline (0.5 is the line); G: the crown, where the curls are full
  if (vCol.r < 0.5) discard;
  #ifdef USE_CURL
  // the crown's silhouette breaks up into curls: where the shell turns away from the eye, small-scale noise cuts it
  float ndv = abs(dot(normalize(vN), V)), edge = smoothstep(0.2, 0.6, vCol.g);
  if (edge > 0.0 && ndv < 0.24 && vnoise(cp * 0.9) * edge > 0.12 + ndv * 2.6) discard;
  #endif
  vec3 alb = mix(uKeep, uColor, smoothstep(0.5, 0.75, vCol.r) * mix(0.75, 1.0, vCol.g));
  #elif defined(USE_SKINAO)
  vec3 alb = uColor;
  #else
  vec3 alb = uColor * vCol;
  #endif
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
  alb = mix(alb, uTie * mix(1.0, clamp(tx.r * 2.0, 0.0, 1.5), 0.3), tk);
  #else
  alb *= tx.rgb;
  #ifdef USE_FEATHER
  // a brow thins into the skin at its edge instead of ending in a line
  alb = mix(uKeep * 0.8, alb, smoothstep(uAlphaTest, uAlphaTest + 0.5, tx.a));
  #endif
  #endif
  aout *= tx.a;
  if (aout < uAlphaTest) discard;
  #endif
  #ifdef USE_MASK
  // the face's painted detail: R beard, G lips, B a little warmth on the cheeks
  vec4 fm = texture2D(uMask, vUv);
  // lips: the upper at half strength in the mask and a little darker, the lower fuller and rosier
  vec3 lipC = mix(uLip * vec3(0.78, 0.72, 0.72), uLip, smoothstep(0.55, 0.95, fm.g));
  float lipK = smoothstep(0.1, 0.6, fm.g);
  alb = mix(alb, lipC, lipK * 0.82);
  alb *= 1.0 + fm.b * vec3(0.18, 0.03, -0.03);
  // the cooler, thinner skin under the eyes (A: 1 none, lower cooler)
  alb *= mix(vec3(0.9, 0.93, 1.0), vec3(1.0), fm.a);
  float stub = fm.r * mix(0.55, 1.0, vnoise(vObj * uCurlK * 1.7));
  alb = mix(alb, uBeard, clamp(stub * 1.15, 0.0, 1.0));
  #endif
  alb *= mix(0.86, 1.12, br) * curl;
  #ifdef USE_CLOTH
  // cloth: a fine weave in the colour, so wool and cotton never read as one moulded surface
  vec3 wp_ = (vObj * uObj.w + uObj.xyz) * 900.0;
  alb *= mix(0.9, 1.07, vnoise(vec3(wp_.x + wp_.z, wp_.y * 2.6, wp_.z - wp_.x)));
  #ifdef USE_BANDS
  // turnout gear: reflective bands round the chest, the hem, the cuffs and the ankles (the body's own rest space)
  vec3 rp = vObj * uObj.w + uObj.xyz; float ax_ = abs(rp.x);
  float arm = distance(vec3(ax_, rp.y, rp.z), vec3(0.175, 1.285, 0.018));
  float bd = 0.0;
  if (ax_ < 0.31) bd = max(step(abs(rp.y - 1.19), 0.03), step(abs(rp.y - 0.86), 0.03));
  if (ax_ > 0.33) bd = max(bd, step(abs(arm - 0.385), 0.028));
  bd = max(bd, step(abs(rp.y - 0.2), 0.03));
  float mid = 0.0;
  if (ax_ < 0.31) mid = max(step(abs(rp.y - 1.19), 0.011), step(abs(rp.y - 0.86), 0.011));
  if (ax_ > 0.33) mid = max(mid, step(abs(arm - 0.385), 0.01));
  mid = max(mid, step(abs(rp.y - 0.2), 0.011));
  alb = mix(alb, mix(vec3(0.78, 0.8, 0.22), vec3(0.74, 0.76, 0.78), mid), bd);
  #endif
  #endif
  #ifdef USE_CROP
  // hair worn cropped: whatever of it hangs clear of the head is not drawn (uCrop: the head's middle, and how far out)
  if (uCrop.w > 0.0 && distance(vObj * uObj.w + uObj.xyz, uCrop.xyz) > uCrop.w) discard;
  #endif
  #ifdef USE_EYE
  // an iris of another colour: the texture's own brown gives way to it, its light and its dark ring kept (uIris.a: how much)
  { float mx = max(alb.r, max(alb.g, alb.b)), mn = min(alb.r, min(alb.g, alb.b));
    float ik = smoothstep(0.3, 0.5, (mx - mn) / max(mx, 0.02) * step(0.02, mx)) * uIris.a;
    alb = mix(alb, uIris.rgb * clamp(mx * 3.4, 0.0, 1.5), ik); }
  // the eye: the lid's shadow across the top of the ball, a darker ring where the white meets the lid
  float ey = (vObj.y * uObj.w + uObj.y - uEye.x) / uEye.y;
  alb *= mix(1.0, 0.5, smoothstep(0.1, 0.85, ey)) * mix(1.0, 0.82, smoothstep(-0.2, -0.9, ey));
  #endif
  float wet = uWet * uWetAll;
  vec3 spec;
  vec3 light = lightAt(vWP, N, V, br, wet, spec);
  // contact shade: things darken toward the ground they stand on
  float ao = mix(1.0, smoothstep(-0.05, 0.55, vWP.y * (uMirror > 0.5 ? -1.0 : 1.0)) * 0.55 + 0.45, uAo);
  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  // skin: a warm wrap where light meets shadow, so faces never go blue-grey in the shade
  light += uSkin * vec3(0.11, 0.05, 0.03) * (1.0 - smoothstep(-0.3, 0.6, dot(N, uMoonDir)));
  // skin scatters: a softer, lower highlight than a wet surface's
  spec *= mix(1.0, 0.6, uSkin);
  #ifdef USE_SKIN
  // light goes a little way into skin and comes back red: a warm band along every terminator; and skin has its own
  // sheen, broad and low, on the brow, the bridge of the nose and the cheekbones
  { vec3 sss = vec3(0.0), sheen = vec3(0.0);
    vec3 L0 = vec3(uMoonDir.x, uMoonDir.y * (uMirror > 0.5 ? -1.0 : 1.0), uMoonDir.z);
    float t0 = dot(N, L0);
    sss += uMoon * smoothstep(-0.4, 0.05, t0) * (1.0 - smoothstep(0.05, 0.55, t0));
    sheen += uMoon * pow(max(dot(N, normalize(L0 + V)), 0.0), 18.0) * smoothstep(-0.1, 0.3, t0);
    for (int i = 0; i < ${MAXL}; i++) {
      if (i >= uLampN) break;
      vec3 lp = uLampPos[i].xyz; if (uMirror > 0.5) lp.y = -lp.y;
      vec3 L = lp - vWP; float d = length(L); L /= d;
      float att = clamp(1.0 - d / uLampPos[i].w, 0.0, 1.0); att *= att;
      if (uLampCol[i].w > 0.0) att *= smoothstep(uLampCol[i].w, uLampCol[i].w + 0.25, dot(-L, vec3(0.0, uMirror > 0.5 ? 1.0 : -1.0, 0.0)));
      float nl = dot(N, L);
      sss += uLampCol[i].rgb * att * smoothstep(-0.4, 0.05, nl) * (1.0 - smoothstep(0.05, 0.55, nl));
      sheen += uLampCol[i].rgb * att * pow(max(dot(N, normalize(L + V)), 0.0), 18.0) * smoothstep(-0.1, 0.3, nl);
    }
    // the sky's own soft sheen on what faces up and toward the eye
    sheen += mix(uGround, uSky, 0.5 + 0.5 * reflect(-V, N).y) * pow(1.0 - max(dot(N, V), 0.0), 2.0) * 0.5;
    light += sss * vec3(0.3, 0.07, 0.03);
    #ifdef USE_MASK
    float gloss = 1.0 + lipK * 1.6;
    #else
    float gloss = 1.0;
    #endif
    spec += sheen * 0.085 * gloss * mix(0.7, 1.2, br);
  }
  #endif
  #ifdef USE_SKINAO
  // the skin's baked shade: creases go a deep warm brown, never grey
  { float k = pow(smoothstep(0.12, 0.97, vCol.r), 1.25); k = mix(k, 1.0, 0.1);
    vec3 sh = mix(vec3(0.2, 0.085, 0.06), vec3(1.0), k);
    light *= sh; spec *= k * k; }
  #endif
  #ifdef USE_CLOTH
  // cloth catches light at its edge: a soft sheen in its own colour instead of a hard rim
  light += light * fr * 0.55;
  #endif
  light = mix(light, light * vec3(1.06, 0.98, 0.92) + vec3(0.03, 0.015, 0.008), uSkin);
  // a shoulder on strong light (the morning sun), so skin and cloth keep their colour instead of burning to one flat tone
  light *= 1.0 / (1.0 + 0.6 * max(dot(light, vec3(0.3333)) - 0.8, 0.0));
  vec3 col = alb * light * ao + spec + uRim * fr * uRimK * (0.5 + br) * mix(1.0, 0.45, uSkin);
  // skin under sodium light keeps some of its own colour
  col = mix(col, sat(col, 0.78), uSkin);
  col += uEmit;
  #ifdef USE_EMAP
  col += texture2D(uEMap, vUv).rgb * uTone;
  #endif
  col = sat(col, uSat);
  // keep every value finite and inside half-float range, so the blur passes never spread a bad pixel
  col = clamp(col, 0.0, 24.0);
  #ifdef USE_SOLID
  // a cut-out that is not blended is solid where it is drawn (a part-clear pixel washes pale when the frame is composited)
  aout = 1.0;
  #endif
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
    // the mesh's own space to the body's rest space: xyz an offset, w a scale (a quantized mesh's node transform)
    uObj: { value: new THREE.Vector4(0, 0, 0, 1) },
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
  if (o.hairline) defines.USE_HAIRLINE = "";
  if (o.vcol) defines.USE_VCOL = "";
  if (o.skin) defines.USE_SKIN = "";
  if (o.skinAo) defines.USE_SKINAO = "";
  if (o.cloth) defines.USE_CLOTH = "";
  if (o.feather) defines.USE_FEATHER = "";
  if (o.bands) defines.USE_BANDS = "";
  if (o.eye) { defines.USE_EYE = ""; uniforms.uEye = { value: new THREE.Vector2(o.eye[0], o.eye[1]) }; uniforms.uIris = { value: new THREE.Vector4(0, 0, 0, 0) }; }
  if (o.body) { defines.USE_BODY = ""; uniforms.uBody = { value: new THREE.Vector4(0, 1.38, 0, 0) }; uniforms.uNose = { value: new THREE.Vector3(0, 1.55, 0.12) }; uniforms.uMouth = { value: new THREE.Vector3(0, 1.5, 0.1) }; uniforms.uFaceA = { value: new THREE.Vector4() }; uniforms.uFaceB = { value: new THREE.Vector4() }; if (o.face) defines.USE_FACE = ""; }
  if (o.grow) { defines.USE_GROW = ""; uniforms.uGrow = { value: 1 }; }
  if (o.crop) { defines.USE_CROP = ""; uniforms.uCrop = { value: new THREE.Vector4(0, 0, 0, 0) }; }
  if (o.alphaTest && !o.transparent && !(o.alpha != null && o.alpha < 1)) defines.USE_SOLID = "";
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, defines, side: o.side || THREE.FrontSide, transparent: !!o.transparent || (o.alpha != null && o.alpha < 1), depthWrite: o.depthWrite != null ? o.depthWrite : true });
  m.userData.paint = true;
  return m;
}

/* ================================================================
   PBR: the sets' surfaces. Same lamps, moon, sky and fog as paint(), but a
   physically based response: GGX highlights that widen with each lamp's size,
   Schlick Fresnel, metal and dielectric, a clear coat over car paint, baked
   ambient occlusion (a vertex channel or a map), normal and roughness maps
   (by UV or projected from world space for tiled materials), water beading on
   wet up-facing surfaces, and reflections from the set's cube (uEnv), falling
   back to a sky-and-ground estimate before the cube exists.
   ================================================================ */
const vertPBR = /* glsl */`
#include <common>
varying vec3 vWP; varying vec3 vN; varying vec2 vUv; varying vec4 vC; varying vec3 vLocal; varying vec3 vLN;
uniform mat3 uUvM;
#ifdef USE_VAO
attribute vec4 color;
#endif
#ifdef USE_CELL
uniform vec2 uCellS;
#endif
void main(){
  vUv = (uUvM * vec3(uv, 1.0)).xy;
  vC = vec4(1.0);
  #ifdef USE_VAO
  vC.a = color.r;
  #endif
  #ifdef USE_INSTANCING_COLOR
  vC.rgb = instanceColor;
  #ifdef USE_CELL
  // an atlas: each instance's colour is where its cell starts, so one material draws a different face per instance
  vUv = instanceColor.rg + uv * uCellS; vC.rgb = vec3(1.0);
  #endif
  #endif
  vLocal = position; vLN = normal;
  mat4 M = modelMatrix;
  #ifdef USE_INSTANCING
  M = modelMatrix * instanceMatrix;
  #endif
  vec4 wp = M * vec4(position, 1.0); vWP = wp.xyz;
  vN = normalize(mat3(M) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const fragPBR = /* glsl */`
${common}
#define PI_ 3.14159265
uniform vec3 uColor; uniform vec3 uEmit; uniform float uRough; uniform float uMetal; uniform float uCoat; uniform float uCoatRough;
uniform float uWet; uniform float uAoK; uniform float uAlpha; uniform float uAlphaTest; uniform float uSpecK; uniform float uTri; uniform float uNK; uniform float uDiffK;
uniform samplerCube uEnv; uniform float uEnvOn; uniform float uEnvMax; uniform float uEnvK; uniform float uSelfEnv;
#ifdef USE_TMAP
uniform sampler2D uMap;
#endif
#ifdef USE_NMAP
uniform sampler2D uNMap;
#endif
#ifdef USE_RMAP
uniform sampler2D uRMap;
#endif
#ifdef USE_EMAP
uniform sampler2D uEMap; uniform float uEK;
#endif
#ifdef USE_PANEL
uniform sampler2D uPanel; uniform vec4 uPanelBox;
#endif
#ifdef USE_ROOMAO
uniform vec4 uRoom; uniform float uRoomH;
#endif
varying vec3 vWP; varying vec3 vN; varying vec2 vUv; varying vec4 vC; varying vec3 vLocal; varying vec3 vLN;

// sample a map by UV, or projected from world space (three planes blended by the normal)
vec4 tsample(sampler2D s, vec3 n){
  #ifdef USE_TRI
  vec3 b = pow(abs(n), vec3(6.0)); b /= (b.x + b.y + b.z);
  #ifdef USE_LOCALTRI
  vec3 p = vLocal * uTri; b = pow(abs(normalize(vLN)), vec3(6.0)); b /= (b.x + b.y + b.z);
  #else
  vec3 p = vWP * uTri;
  #endif
  return texture2D(s, p.zy) * b.x + texture2D(s, p.xz) * b.y + texture2D(s, p.xy) * b.z;
  #else
  return texture2D(s, vUv);
  #endif
}
vec3 envProc(vec3 r, float rough){
  // before the cube: sky above, a warm city glow on the horizon, the ground below
  float h = r.y * (uMirror > 0.5 ? -1.0 : 1.0);
  vec3 c = mix(uGround * 0.6, uSky * 0.9, smoothstep(-0.25, 0.35, h));
  c += uRim * 0.35 * exp(-abs(h) * mix(14.0, 3.0, rough));
  return c;
}
vec3 envAt(vec3 r, float rough){
  vec3 p = envProc(r, rough);
  if (uEnvOn < 0.5) return p;
  vec3 rr = r; if (uMirror > 0.5) rr.y = -rr.y;
  vec3 e = textureLod(uEnv, rr, clamp(rough * uEnvMax * 1.15, 0.0, uEnvMax)).rgb;
  return mix(p, e, uEnvOn) * uEnvK;
}
float D_GGX(float a, float nh){ float a2 = a * a; float d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (PI_ * d * d + 1e-6); }
float V_Smith(float a, float nv, float nl){ float a2 = a * a; float gv = nl * sqrt(nv * nv * (1.0 - a2) + a2); float gl = nv * sqrt(nl * nl * (1.0 - a2) + a2); return 0.5 / max(gv + gl, 1e-5); }
vec3 F_Sch(vec3 f0, float c){ return f0 + (1.0 - f0) * pow(1.0 - c, 5.0); }
vec3 envBRDF(vec3 f0, float rough, float nv){
  const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022); const vec4 c1 = vec4(1.0, 0.0425, 1.04, -0.04);
  vec4 r = rough * c0 + c1; float a004 = min(r.x * r.x, exp2(-9.28 * nv)) * r.x + r.y; vec2 ab = vec2(-1.04, 1.04) * a004 + r.zw;
  return f0 * ab.x + ab.y;
}
float h12(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
// water beads on a wet up-facing surface: a bumped normal and a mask (static; the rain keeps them full)
vec3 beads(vec3 p, out float m){
  vec2 q = p.xz * 46.0; vec2 c = floor(q), f = fract(q) - 0.5;
  vec2 o = vec2(h12(c), h12(c + 7.3)) - 0.5; float r = 0.08 + 0.18 * h12(c + 2.1);
  vec2 d = f - o * 0.4; float l = length(d);
  m = smoothstep(r, r * 0.6, l) * step(0.45, h12(c + 9.7));
  return vec3(d.x, 0.0, d.y) / max(r, 1e-3) * m * 0.6;
}
// specular from one lamp or the moon: GGX, widened by the lamp's size at this distance
vec3 specL(vec3 N, vec3 V, vec3 L, float a, vec3 f0, float dist){
  float ap = clamp(a + 0.18 / max(dist * 2.0, 0.5), 0.0, 1.0);
  vec3 H = normalize(L + V); float nl = max(dot(N, L), 0.0), nv = max(dot(N, V), 1e-3), nh = max(dot(N, H), 0.0), vh = max(dot(V, H), 0.0);
  float norm = (a * a) / max(ap * ap, 1e-4);
  // (held under a ceiling: a lamp in chrome or a wet rim is a hot glint, not a second lamp)
  return min(F_Sch(f0, vh) * D_GGX(ap, nh) * V_Smith(ap, nv, nl) * nl * norm * PI_, vec3(1.8));
}
void main(){
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWP);
  vec3 alb = uColor * vC.rgb;
  float rough = uRough, metal = uMetal, ao = mix(1.0, vC.a, uAoK), aout = uAlpha;
  #ifdef USE_TMAP
  vec4 tx = tsample(uMap, N); alb *= tx.rgb; aout *= tx.a;
  if (aout < uAlphaTest) discard;
  #endif
  #ifdef USE_RMAP
  vec3 arm = tsample(uRMap, N).rgb; ao *= mix(1.0, arm.r, uAoK); rough *= arm.g * 1.6; metal *= arm.b;
  #endif
  #ifdef USE_NMAP
  {
    #ifdef USE_TRI
    // projected normal maps: each plane's tangent-space normal swizzled into world space, blended (UDN)
    vec3 b = pow(abs(N), vec3(6.0)); b /= (b.x + b.y + b.z);
    #ifdef USE_LOCALTRI
    vec3 p = vLocal * uTri; b = pow(abs(normalize(vLN)), vec3(6.0)); b /= (b.x + b.y + b.z);
    #else
    vec3 p = vWP * uTri;
    #endif
    vec3 tx_ = texture2D(uNMap, p.zy).xyz * 2.0 - 1.0, ty_ = texture2D(uNMap, p.xz).xyz * 2.0 - 1.0, tz_ = texture2D(uNMap, p.xy).xyz * 2.0 - 1.0;
    vec3 nx = vec3(0.0, tx_.y, tx_.x) * uNK, ny = vec3(ty_.x, 0.0, ty_.y) * uNK, nz = vec3(tz_.x, tz_.y, 0.0) * uNK;
    N = normalize(N + nx * b.x + ny * b.y + nz * b.z);
    #else
    vec3 tn = texture2D(uNMap, vUv).xyz * 2.0 - 1.0; tn.xy *= uNK;
    vec3 dp1 = dFdx(vWP), dp2 = dFdy(vWP); vec2 du1 = dFdx(vUv), du2 = dFdy(vUv);
    vec3 dp2p = cross(dp2, N), dp1p = cross(N, dp1);
    vec3 T = dp2p * du1.x + dp1p * du2.x, B = dp2p * du1.y + dp1p * du2.y;
    float inv = inversesqrt(max(dot(T, T), dot(B, B)) + 1e-12);
    N = normalize(mat3(T * inv, B * inv, N) * tn);
    #endif
  }
  #endif
  #ifdef USE_PANEL
  {
    // panel lines, handles' recesses and the fuel door: a side view and a top view of the body, projected in the car's own space
    vec3 ln = normalize(vLN);
    vec2 su = vec2((uPanelBox.x - vLocal.z) / uPanelBox.y, vLocal.y / uPanelBox.z);
    float sideW = smoothstep(0.55, 0.85, abs(ln.x)), topW = smoothstep(0.6, 0.9, ln.y);
    float s1 = texture2D(uPanel, vec2(su.x, clamp(su.y * 0.5, 0.0, 0.499))).r;
    float s2 = texture2D(uPanel, vec2(su.x, clamp(0.5 + abs(vLocal.x) / uPanelBox.w * 0.5, 0.501, 1.0))).r;
    float seam = 1.0 - (1.0 - s1) * sideW - (1.0 - s2) * topW * (1.0 - sideW);
    ao *= mix(0.12, 1.0, seam); rough = mix(0.6, rough, seam);
  }
  #endif
  #ifdef USE_ROOMAO
  {
    // a box room's ambient occlusion, analytic: corners where two surfaces meet darken, and everything near the floor a little
    vec3 p = vWP; if (uMirror > 0.5) p.y = -p.y;
    float dx = min(p.x - uRoom.x, uRoom.y - p.x), dz = min(p.z - uRoom.z, uRoom.w - p.z), dy = p.y, dc = uRoomH - p.y;
    float fw = 1.0 - smoothstep(0.0, 0.7, min(dx, dz)), ff = 1.0 - smoothstep(0.0, 0.5, dy), fc = 1.0 - smoothstep(0.0, 0.6, dc);
    float wx = 1.0 - smoothstep(0.0, 0.7, dx), wz = 1.0 - smoothstep(0.0, 0.7, dz);
    ao *= (1.0 - 0.45 * fw * ff) * (1.0 - 0.35 * fw * fc) * (1.0 - 0.3 * wx * wz) * (1.0 - 0.12 * ff);
  }
  #endif
  float wet = uWet * uWetAll;
  float up = smoothstep(0.35, 0.85, N.y * (uMirror > 0.5 ? -1.0 : 1.0));
  #ifdef USE_DROPS
  float bm; vec3 bn = beads(vWP, bm); bm *= wet * up;
  N = normalize(N + bn * wet * up);
  #endif
  // wet: darker, glossier on what faces up
  alb *= mix(1.0, 0.62, wet * (1.0 - metal) * (0.4 + 0.6 * up));
  rough = mix(rough, rough * 0.35, wet * up);
  rough = clamp(rough, 0.04, 1.0);
  float a = rough * rough;
  vec3 f0 = mix(vec3(0.04), alb, metal) * uSpecK;
  vec3 diffC = alb * (1.0 - metal) * uDiffK;
  float nv = max(dot(N, V), 1e-3);
  // ambient: sky and ground, occluded
  float hemi = N.y * (uMirror > 0.5 ? -1.0 : 1.0) * 0.5 + 0.5;
  vec3 amb = mix(uGround, uSky, hemi) * ao;
  vec3 dif = diffC * amb, spec = vec3(0.0);
  // the moon
  vec3 L0 = vec3(uMoonDir.x, uMoonDir.y * (uMirror > 0.5 ? -1.0 : 1.0), uMoonDir.z);
  float nl0 = max(dot(N, L0), 0.0);
  dif += diffC * uMoon * nl0;
  spec += uMoon * specL(N, V, L0, a, f0, 50.0);
  // the lamps
  vec3 lampSum = vec3(0.0);
  for (int i = 0; i < ${MAXL}; i++) {
    if (i >= uLampN) break;
    vec3 lp = uLampPos[i].xyz; if (uMirror > 0.5) lp.y = -lp.y;
    vec3 L = lp - vWP; float d = length(L); L /= d;
    float att = clamp(1.0 - d / uLampPos[i].w, 0.0, 1.0); att *= att;
    float cone = 1.0;
    if (uLampCol[i].w > 0.0) { float cd = dot(-L, vec3(0.0, uMirror > 0.5 ? 1.0 : -1.0, 0.0)); cone = smoothstep(uLampCol[i].w, uLampCol[i].w + 0.25, cd); }
    vec3 lc = uLampCol[i].rgb * att * cone;
    if (dot(lc, lc) < 1e-7) continue;
    float nl = dot(N, L);
    dif += diffC * lc * max(nl, 0.0);
    spec += lc * specL(N, V, L, a, f0, d);
    lampSum += lc;
  }
  // reflections from the set
  vec3 R = reflect(-V, N);
  float specAO = clamp(pow(nv + ao, exp2(-16.0 * a - 1.0)) - 1.0 + ao, 0.0, 1.0);
  spec += envAt(R, rough) * envBRDF(f0, rough, nv) * specAO;
  vec3 col = dif + spec * uSpecK;
  // the clear coat: a second, glassy layer over paint
  if (uCoat > 0.0) {
    vec3 Nc = normalize(vN); if (!gl_FrontFacing) Nc = -Nc;
    #ifdef USE_DROPS
    Nc = normalize(Nc + bn * wet * up * 0.8);
    #endif
    float nvc = max(dot(Nc, V), 1e-3), ca = uCoatRough * uCoatRough;
    float fc = 0.04 + 0.96 * pow(1.0 - nvc, 5.0);
    col *= 1.0 - fc * uCoat;
    vec3 cs = envAt(reflect(-V, Nc), uCoatRough) * fc;
    #ifndef LOWQ
    for (int i = 0; i < ${MAXL}; i++) {
      if (i >= uLampN) break;
      vec3 lp = uLampPos[i].xyz; if (uMirror > 0.5) lp.y = -lp.y;
      vec3 L = lp - vWP; float d = length(L); L /= d;
      float att = clamp(1.0 - d / uLampPos[i].w, 0.0, 1.0); att *= att;
      float cone = 1.0;
      if (uLampCol[i].w > 0.0) { float cd = dot(-L, vec3(0.0, uMirror > 0.5 ? 1.0 : -1.0, 0.0)); cone = smoothstep(uLampCol[i].w, uLampCol[i].w + 0.25, cd); }
      cs += uLampCol[i].rgb * att * cone * specL(Nc, V, L, ca, vec3(0.04), d);
    }
    #endif
    col += cs * uCoat;
  }
  col += uEmit;
  #ifdef USE_EMAP
  col += tsample(uEMap, N).rgb * uEK;
  #endif
  #ifdef USE_GLASS
  // glass: what it reflects is opaque, what it doesn't lets the room through (Fresnel sets the mix)
  float fg = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
  aout = clamp(aout + fg * (1.0 - aout) + dot(col, vec3(0.3)) * 0.5, 0.0, 1.0);
  #endif
  col = sat(col, uSat);
  col = clamp(col, 0.0, 24.0);
  gl_FragColor = vec4(fogged(col, vWP), aout);
  #include <colorspace_fragment>
}`;

/* one physically based material.
   o: { color, map, nmap, rmap (AO, roughness, metal in R, G, B), emap, ek, emit, rough, metal, coat, coatRough, wet, ao (how much baked AO counts),
        vao (AO in the vertex colour's R), tri (world-space scale for projected maps, 1 / metres), nk (normal strength), spec, diff,
        drops (water beads), glass (Fresnel opacity), cell ([w, h]: an atlas cell's size in UV, its corner from each instance's colour), room ([x0, x1, z0, z1, height]: a box room's corner occlusion), panel ({ tex, box: [z0, length, height, halfWidth] }), alpha, alphaTest, side, transparent, depthWrite } */
/* phones (and ?wq=lo) skip the clear coat's own lamp highlights; the coat still reflects the set */
export const LOWQ = typeof location !== "undefined" && (/[?&]wq=lo/.test(location.search) || (/[?&]debug=story/.test(location.search) && /[?&]fast=1/.test(location.search) && !/[?&]wq=hi/.test(location.search))) || (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches && !/[?&]wq=hi/.test(location.search));
export function pbr(o = {}) {
  const defines = LOWQ ? { LOWQ: "" } : {};
  const uniforms = {
    ...U,
    uColor: { value: new THREE.Color(o.color || "#888") },
    uEmit: { value: new THREE.Color(o.emit || "#000") },
    uRough: { value: o.rough != null ? o.rough : 0.6 },
    uMetal: { value: o.metal || 0 },
    uCoat: { value: o.coat || 0 },
    uCoatRough: { value: o.coatRough != null ? o.coatRough : 0.06 },
    uWet: { value: o.wet != null ? o.wet : 0.5 },
    uAoK: { value: o.ao != null ? o.ao : 1 },
    uAlpha: { value: o.alpha != null ? o.alpha : 1 },
    uAlphaTest: { value: o.alphaTest || 0 },
    uSpecK: { value: o.spec != null ? o.spec : 1 },
    uDiffK: { value: o.diff != null ? o.diff : 1 },
    uTri: { value: o.tri || 1 },
    uNK: { value: o.nk != null ? o.nk : 1 },
    uEK: { value: o.ek != null ? o.ek : 1 },
    uUvM: { value: new THREE.Matrix3() }
  };
  const tx = (k, d, t) => { if (!t) return; defines[d] = ""; uniforms[k] = { value: t }; if (!o.tri && t.updateMatrix) { t.updateMatrix(); uniforms.uUvM.value.copy(t.matrix); } };
  tx("uMap", "USE_TMAP", o.map); tx("uNMap", "USE_NMAP", o.nmap); tx("uRMap", "USE_RMAP", o.rmap); tx("uEMap", "USE_EMAP", o.emap);
  if (o.tri) defines.USE_TRI = "";
  if (o.tri && o.local) defines.USE_LOCALTRI = "";
  if (o.vao) defines.USE_VAO = "";
  if (o.drops) defines.USE_DROPS = "";
  if (o.glass) defines.USE_GLASS = "";
  if (o.room) { defines.USE_ROOMAO = ""; uniforms.uRoom = { value: new THREE.Vector4(...o.room.slice(0, 4)) }; uniforms.uRoomH = { value: o.room[4] }; }
  if (o.cell) { defines.USE_CELL = ""; uniforms.uCellS = { value: new THREE.Vector2(o.cell[0], o.cell[1]) }; }
  if (o.panel) { defines.USE_PANEL = ""; uniforms.uPanel = { value: o.panel.tex }; uniforms.uPanelBox = { value: new THREE.Vector4(...o.panel.box) }; }
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: vertPBR, fragmentShader: fragPBR, defines, side: o.side || THREE.FrontSide,
    transparent: !!o.transparent || (o.alpha != null && o.alpha < 1), depthWrite: o.depthWrite != null ? o.depthWrite : true });
  m.userData.paint = true; m.userData.pbr = true;
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
      void main(){ vec3 V = normalize(cameraPosition - vWP); float edge = pow(abs(dot(normalize(vN), V)), 2.4);
        // brightest under the head, thinning toward the ground, so it reads as light in wet air and not as a solid shape
        float fall = smoothstep(0.0, 0.9, vH) * smoothstep(1.0, 0.82, vH); fall *= 0.35 + 0.65 * fall;
        float rain = 0.85 + 0.15 * h(floor(vec2(vWP.x * 30.0 + vWP.z * 30.0, vWP.y * 6.0 + uTime * 40.0)));
        gl_FragColor = vec4(uC * uK * edge * fall * 0.12 * rain, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
}

/* a headlight's beam in wet air: additive, brightest at the lamp, thinning along its length, soft whichever way you look at it */
export function beamMat(color, k = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uK: { value: k }, uTime: U.uTime },
    vertexShader: `varying vec3 vN; varying vec3 vWP; varying float vH; void main(){ vH = uv.y; vec4 wp = modelMatrix * vec4(position,1.0); vWP = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 uC; uniform float uK; uniform float uTime; varying vec3 vN; varying vec3 vWP; varying float vH;
      float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      void main(){ vec3 V = normalize(cameraPosition - vWP); float face = abs(dot(normalize(vN), V));
        float along = vH * vH * smoothstep(1.0, 0.94, vH);
        float rain = 0.8 + 0.2 * h(floor(vec2(vWP.x * 24.0 + vWP.z * 24.0, vWP.y * 8.0 + uTime * 40.0)));
        gl_FragColor = vec4(uC * uK * along * (0.3 + 0.7 * face * face) * 0.1 * rain, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
}

/* blob shade under people and cars: soft, painted, cheap */
export function blobMat(k = 0.55, rect = false) {
  return new THREE.ShaderMaterial({
    uniforms: { uK: { value: k } }, defines: rect ? { RECT: "" } : {},
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; vec4 p = vec4(position, 1.0);
      #ifdef USE_INSTANCING
      p = instanceMatrix * p;
      #endif
      gl_Position = projectionMatrix * modelViewMatrix * p; }`,
    // a disc (people), or with rect a rounded rectangle, square-ish in the middle and soft at the edges (cars, desks)
    fragmentShader: `uniform float uK; varying vec2 vUv; void main(){
      #ifdef RECT
      vec2 q = abs(vUv - 0.5) * 2.0; float d = length(max(q - 0.55, 0.0)) / 0.45; float a = smoothstep(1.0, 0.0, d) * smoothstep(1.0, 0.7, max(q.x, q.y));
      #else
      float d = length(vUv - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, d);
      #endif
      gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * uK); }`,
    transparent: true, depthWrite: false
  });
}
