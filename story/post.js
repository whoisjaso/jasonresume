/* After Hours: the lens. The scene renders into a float buffer; lamps bloom
   (a threshold, then a five-step blur pyramid); depth of field softens what is
   far from the subject; then one composite pass tone maps, grades the scene
   warm or cool (or into a memory: warm paper, soft edges, a little bleach),
   adds a vignette and a moving film grain, and draws the letterbox for
   cinematics. A planar mirror pass gives the wet lot its reflections.
   Quality steps down (resolution, bloom, depth of field, reflections) when the
   frame rate does. */
import * as THREE from "../vendor/three-0.184.0/three.module.min.js";
import { U } from "./paint.js";

const FS = new THREE.BufferGeometry();
FS.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
FS.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
function pass(frag, uniforms) {
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: frag, depthTest: false, depthWrite: false });
  const mesh = new THREE.Mesh(FS, m); mesh.frustumCulled = false;
  const sc = new THREE.Scene(); sc.add(mesh);
  return { m, sc, u: uniforms };
}
const CAM = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

export class Post {
  constructor(renderer, o = {}) {
    this.R = renderer; this.q = o.quality || 2;
    const opt = { type: THREE.HalfFloatType, depthBuffer: true };
    this.main = new THREE.WebGLRenderTarget(4, 4, { ...opt, samples: this.q >= 2 && !/[?&]msaa=0/.test(location.search) ? 4 : 0 });
    this.main.depthTexture = new THREE.DepthTexture(4, 4); this.main.depthTexture.type = THREE.UnsignedIntType;
    this.refl = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
    this.mips = []; for (let i = 0; i < 5; i++) { const a = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }), b = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }); this.mips.push([a, b]); }
    this.dof = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
    this.bright = pass(`uniform sampler2D t; uniform float th; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(th, th + 0.8, l), 1.0); }`, { t: { value: null }, th: { value: 0.9 } });
    this.down = pass(`uniform sampler2D t; uniform vec2 px; varying vec2 vUv; void main(){
      vec3 c = texture2D(t, vUv).rgb * 0.5;
      c += texture2D(t, vUv + vec2(-px.x, -px.y)).rgb * 0.125; c += texture2D(t, vUv + vec2(px.x, -px.y)).rgb * 0.125;
      c += texture2D(t, vUv + vec2(-px.x, px.y)).rgb * 0.125; c += texture2D(t, vUv + vec2(px.x, px.y)).rgb * 0.125;
      gl_FragColor = vec4(c, 1.0); }`, { t: { value: null }, px: { value: new THREE.Vector2() } });
    this.blur = pass(`uniform sampler2D t; uniform vec2 dir; varying vec2 vUv; void main(){
      vec3 c = texture2D(t, vUv).rgb * 0.2270;
      c += (texture2D(t, vUv + dir * 1.3846).rgb + texture2D(t, vUv - dir * 1.3846).rgb) * 0.3162;
      c += (texture2D(t, vUv + dir * 3.2308).rgb + texture2D(t, vUv - dir * 3.2308).rgb) * 0.0703;
      gl_FragColor = vec4(c, 1.0); }`, { t: { value: null }, dir: { value: new THREE.Vector2() } });
    this.up = pass(`uniform sampler2D t; uniform sampler2D lo; uniform float k; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb + texture2D(lo, vUv).rgb * k, 1.0); }`, { t: { value: null }, lo: { value: null }, k: { value: 1 } });
    this.comp = pass(`
      uniform sampler2D tCol; uniform sampler2D tBloom; uniform sampler2D tDof; uniform sampler2D tDepth;
      uniform float uExp; uniform vec3 uLift; uniform vec3 uGamma; uniform vec3 uGain; uniform float uSat; uniform float uVig; uniform float uGrain; uniform float uTime;
      uniform float uBloom; uniform float uBox; uniform float uMem; uniform float uFocus; uniform float uRange; uniform float uDofK; uniform float uNear; uniform float uFar;
      uniform float uFade; uniform vec3 uFadeCol; uniform float uAspect; uniform vec3 uShadowTint; uniform vec3 uHiTint;
      varying vec2 vUv;
      float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
      vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      void main(){
        vec2 uv = vUv;
        vec3 c = texture2D(tCol, uv).rgb;
        // depth of field: blend toward the soft copy by distance from the focal plane
        if (uDofK > 0.0) { float d = lin(texture2D(tDepth, uv).r); float coc = clamp(abs(d - uFocus) / uRange, 0.0, 1.0); coc = coc * coc * uDofK; c = mix(c, texture2D(tDof, uv).rgb, coc); }
        // memory: the frame's edges dissolve into the soft copy, like an old print
        vec2 q = uv - 0.5; q.x *= uAspect; float rr = length(q);
        if (uMem > 0.0) c = mix(c, texture2D(tDof, uv).rgb, smoothstep(0.25, 0.75, rr) * uMem);
        c += texture2D(tBloom, uv).rgb * uBloom;
        c *= uExp;
        c = aces(c);
        // grade: lift, gamma, gain; split toning; saturation
        c = pow(max(c * uGain + uLift * (1.0 - c), 0.0), 1.0 / uGamma);
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c += uShadowTint * (1.0 - l) * 0.06 + uHiTint * l * 0.05;
        c = mix(vec3(l), c, uSat);
        if (uMem > 0.0) { vec3 sep = vec3(l) * vec3(1.08, 0.97, 0.82) + vec3(0.04, 0.03, 0.0); c = mix(c, sep, 0.55 * uMem); c = mix(c, vec3(0.93, 0.88, 0.78), 0.06 * uMem); }
        c *= mix(1.0, smoothstep(1.05, 0.25, rr), uVig);
        c = toSRGB(c);
        c += (h(uv * vec2(1931.0, 1173.0) + fract(uTime * 7.13)) - 0.5) * uGrain;
        c = mix(c, uFadeCol, uFade);
        // letterbox
        float bar = uBox * 0.115; if (uv.y < bar || uv.y > 1.0 - bar) c = vec3(0.0);
        gl_FragColor = vec4(c, 1.0);
      }`, {
      tCol: { value: null }, tBloom: { value: null }, tDof: { value: null }, tDepth: { value: null },
      uExp: { value: 1.0 }, uLift: { value: new THREE.Vector3(0.01, 0.012, 0.014) }, uGamma: { value: new THREE.Vector3(1, 1, 1) }, uGain: { value: new THREE.Vector3(1, 1, 1) },
      uSat: { value: 0.92 }, uVig: { value: 0.75 }, uGrain: { value: 0.035 }, uTime: { value: 0 }, uBloom: { value: 0.9 }, uBox: { value: 0 }, uMem: { value: 0 },
      uFocus: { value: 4 }, uRange: { value: 8 }, uDofK: { value: 0.0 }, uNear: { value: 0.1 }, uFar: { value: 200 }, uFade: { value: 0 }, uFadeCol: { value: new THREE.Vector3(0, 0, 0) },
      uAspect: { value: 1.6 }, uShadowTint: { value: new THREE.Vector3(-0.2, 0.0, 0.25) }, uHiTint: { value: new THREE.Vector3(0.25, 0.08, -0.15) }
    });
    this.copy = pass(`uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb, 1.0); }`, { t: { value: null } });
    this.w = 4; this.h = 4;
  }
  setSize(w, h) {
    this.w = w; this.h = h;
    this.main.setSize(w, h); this.main.depthTexture.image.width = w; this.main.depthTexture.image.height = h;
    this.refl.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1));
    let mw = w >> 1, mh = h >> 1;
    for (const [a, b] of this.mips) { a.setSize(Math.max(2, mw), Math.max(2, mh)); b.setSize(Math.max(2, mw), Math.max(2, mh)); mw >>= 1; mh >>= 1; }
    this.dof.setSize(Math.max(2, w >> 2), Math.max(2, h >> 2));
    this.comp.u.uAspect.value = w / h;
  }
  run(m, target) { this.R.setRenderTarget(target); this.R.render(m.sc, CAM); }
  /* render the mirrored world for the wet ground: the world flips under y = 0, the lamps flip with it */
  reflect(scene, cam, world, ground) {
    if (!ground || this.q < 1) return;
    const R = this.R; const mask = cam.layers.mask;
    world.scale.y = -1; world.updateMatrixWorld(true); U.uMirror.value = 1;
    ground.visible = false;
    cam.layers.disable(2); cam.layers.disable(3); cam.layers.disable(4);
    R.setRenderTarget(this.refl); R.setClearColor(0x000000, 1); R.clear(); R.render(scene, cam);
    world.scale.y = 1; world.updateMatrixWorld(true); U.uMirror.value = 0;
    ground.visible = true; cam.layers.mask = mask;
    ground.material.uniforms.uRefl.value = this.refl.texture;
    ground.material.uniforms.uRes.value.set(this.refl.width * 2, this.refl.height * 2);
  }
  render(scene, cam, t) {
    const R = this.R;
    R.setRenderTarget(this.main); R.clear(); R.render(scene, cam);
    // bloom pyramid
    const bloomOn = this.q >= 1;
    if (bloomOn) {
      this.bright.u.t.value = this.main.texture; this.run(this.bright, this.mips[0][0]);
      for (let i = 1; i < this.mips.length; i++) { this.down.u.t.value = this.mips[i - 1][0].texture; this.down.u.px.value.set(1 / this.mips[i - 1][0].width, 1 / this.mips[i - 1][0].height); this.run(this.down, this.mips[i][0]); }
      for (let i = 0; i < this.mips.length; i++) {
        const [a, b] = this.mips[i];
        this.blur.u.t.value = a.texture; this.blur.u.dir.value.set(1 / a.width, 0); this.run(this.blur, b);
        this.blur.u.t.value = b.texture; this.blur.u.dir.value.set(0, 1 / a.height); this.run(this.blur, a);
      }
      for (let i = this.mips.length - 2; i >= 0; i--) { this.up.u.t.value = this.mips[i][0].texture; this.up.u.lo.value = this.mips[i + 1][0].texture; this.up.u.k.value = 0.8; this.run(this.up, this.mips[i][1]); this.copy.u.t.value = this.mips[i][1].texture; this.run(this.copy, this.mips[i][0]); }
    }
    // the soft copy for depth of field and the memory's edges
    const soft = this.comp.u.uDofK.value > 0 || this.comp.u.uMem.value > 0;
    if (soft) {
      this.down.u.t.value = this.main.texture; this.down.u.px.value.set(1 / this.w, 1 / this.h); this.run(this.down, this.dof);
      const tmp = this.mips[1][1];
      this.blur.u.t.value = this.dof.texture; this.blur.u.dir.value.set(1.5 / this.dof.width, 0); this.run(this.blur, tmp);
      this.blur.u.t.value = tmp.texture; this.blur.u.dir.value.set(0, 1.5 / this.dof.height); this.run(this.blur, this.dof);
    }
    const u = this.comp.u;
    u.tCol.value = this.main.texture; u.tBloom.value = bloomOn ? this.mips[0][0].texture : this.mips[4][0].texture; u.uBloom.value = bloomOn ? u.uBloom.value : 0;
    u.tDof.value = this.dof.texture; u.tDepth.value = this.main.depthTexture; u.uTime.value = t; u.uNear.value = cam.near; u.uFar.value = cam.far;
    this.run(this.comp, null);
  }
}

/* the looks, per scene: exposure, lift/gamma/gain, saturation, tints, bloom, vignette, grain, memory */
export const GRADES = {
  lot: { exp: 1.15, lift: [0.012, 0.016, 0.02], gamma: [1.0, 1.0, 1.02], gain: [1.04, 1.0, 0.96], sat: 0.9, bloom: 0.95, vig: 0.8, grain: 0.03, mem: 0, sh: [-0.25, 0.05, 0.3], hi: [0.3, 0.12, -0.2] },
  office: { exp: 1.05, lift: [0.02, 0.018, 0.016], gamma: [1.02, 1.0, 0.98], gain: [1.03, 1.0, 0.95], sat: 0.9, bloom: 0.6, vig: 0.65, grain: 0.025, mem: 0, sh: [-0.1, 0.05, 0.15], hi: [0.25, 0.1, -0.1] },
  memory: { exp: 1.2, lift: [0.05, 0.04, 0.03], gamma: [1.05, 1.0, 0.94], gain: [1.05, 1.0, 0.9], sat: 0.7, bloom: 1.2, vig: 0.9, grain: 0.05, mem: 1, sh: [0.1, 0.05, -0.05], hi: [0.3, 0.15, -0.1] },
  keys: { exp: 1.0, lift: [0.04, 0.035, 0.03], gamma: [1.0, 1.0, 0.97], gain: [1.05, 1.02, 0.95], sat: 0.75, bloom: 0.5, vig: 0.85, grain: 0.05, mem: 0.8, sh: [0.05, 0.02, -0.05], hi: [0.3, 0.2, 0.0] },
  decision: { exp: 1.2, lift: [0.014, 0.017, 0.02], gamma: [1.0, 1.0, 1.01], gain: [1.05, 1.0, 0.95], sat: 0.92, bloom: 1.0, vig: 0.78, grain: 0.03, mem: 0, sh: [-0.2, 0.05, 0.25], hi: [0.32, 0.14, -0.18] }
};
export function applyGrade(post, g) {
  const u = post.comp.u;
  u.uExp.value = g.exp; u.uLift.value.set(...g.lift); u.uGamma.value.set(...g.gamma); u.uGain.value.set(...g.gain); u.uSat.value = g.sat;
  u.uBloom.value = g.bloom; u.uVig.value = g.vig; u.uGrain.value = g.grain; u.uMem.value = g.mem; u.uShadowTint.value.set(...g.sh); u.uHiTint.value.set(...g.hi);
}
