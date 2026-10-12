/* After Hours: the way. A few soft chevrons laid on the ground ahead of you,
   leaning toward where the story wants you next, lit like a reflection of the
   lamps rather than a game marker; and the ring that lands where you tap to
   walk. Both live on layer 2, so the wet ground's mirror pass leaves them out.
   The arrow at the edge of the screen and the shimmer on things are DOM, in
   main.js; the path comes from nav.js.

   new Guide(world) .trail(path, k, t, still)  .ring(x, z) .land() .tick(dt, t, still) */
import * as THREE from "../vendor/three-0.184.0/three.module.min.js";
import { pathLen, pathAt } from "./nav.js";

const N = 7;           // chevrons
const GAP = 0.95;      // metres between them
const START = 1.1;     // the first one, ahead of your feet

const chevronMat = () => new THREE.ShaderMaterial({
  uniforms: { uCol: { value: new THREE.Color(1.0, 0.84, 0.62) } },
  vertexShader: `attribute float aK; attribute float aW; varying vec2 vUv; varying float vK; varying float vW;
    void main(){ vUv = uv; vK = aK; vW = aW; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 uCol; varying vec2 vUv; varying float vK; varying float vW;
    void main(){
      vec2 p = vUv * 2.0 - 1.0;            // x across, y along the way
      float arm = (p.y + abs(p.x) * 0.9 - 0.3) * 0.74;   // a shallow chevron, its point forward
      float d = abs(arm) - 0.085;
      float a = 1.0 - smoothstep(-0.02, 0.09, d);
      a *= 1.0 - smoothstep(0.62, 0.95, abs(p.x));
      a *= smoothstep(-0.95, -0.55, p.y) * (1.0 - smoothstep(0.55, 0.95, p.y));
      float glow = exp(-abs(arm) * 6.0) * 0.28 * (1.0 - smoothstep(0.5, 1.0, length(p)));
      gl_FragColor = vec4(uCol * (a * (0.6 + 0.4 * vW) + glow) * vK, 1.0);
    }`,
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, polygonOffset: true, polygonOffsetFactor: -2
});

const ringMat = () => new THREE.ShaderMaterial({
  uniforms: { uK: { value: 0 }, uS: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uK; uniform float uS; varying vec2 vUv;
    void main(){ float r = length(vUv * 2.0 - 1.0); float ring = exp(-pow((r - 0.62 * uS) * 16.0, 2.0)); float dot = exp(-pow(r * 9.0, 2.0)) * 0.6;
      gl_FragColor = vec4(vec3(1.0, 0.9, 0.72) * (ring + dot) * uK, 1.0); }`,
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2
});

export class Guide {
  constructor(world) {
    const geo = new THREE.PlaneGeometry(0.6, 0.5); geo.rotateX(-Math.PI / 2);
    // the plane's uv runs along +z after the turn; flip so the V points the way you walk
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    this.k = new Float32Array(N); this.w = new Float32Array(N);
    geo.setAttribute("aK", new THREE.InstancedBufferAttribute(this.k, 1));
    geo.setAttribute("aW", new THREE.InstancedBufferAttribute(this.w, 1));
    this.mesh = new THREE.InstancedMesh(geo, chevronMat(), N);
    this.mesh.frustumCulled = false; this.mesh.layers.set(2); this.mesh.renderOrder = 2;
    world.add(this.mesh);
    this.vis = 0; this.want = 0; this.pulse = 0;
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.up = new THREE.Vector3(0, 1, 0); this.s = new THREE.Vector3(1, 1, 1); this.v = new THREE.Vector3();
    const rg = new THREE.PlaneGeometry(0.9, 0.9); rg.rotateX(-Math.PI / 2);
    this.ringMesh = new THREE.Mesh(rg, ringMat()); this.ringMesh.layers.set(2); this.ringMesh.renderOrder = 2; this.ringMesh.visible = false; world.add(this.ringMesh);
    this.ringT = -1; this.landT = -1;
    this.count = 0; this.path = null;
  }
  /* lay the chevrons along the path; k is how strongly they show (0 hides) */
  trail(path, k) {
    this.path = path && path.length > 1 ? path : null;
    this.want = this.path ? k : 0;
  }
  ring(x, z) { this.ringMesh.position.set(x, 0.03, z); this.ringMesh.visible = true; this.ringT = 0; this.landT = -1; }
  land() { if (this.ringMesh.visible && this.landT < 0) this.landT = 0; }
  clearRing() { this.ringMesh.visible = false; this.ringT = -1; this.landT = -1; }
  /* the stuck helper: one brighter pass down the trail */
  nudge() { this.pulse = 1; }
  tick(dt, t, still) {
    this.vis += (this.want - this.vis) * (1 - Math.exp(-(this.want > this.vis ? 2.2 : 4) * dt));
    this.pulse = Math.max(0, this.pulse - dt * 0.7);
    const p = this.path, show = this.vis > 0.01 && p;
    this.count = 0;
    if (show) {
      const L = pathLen(p);
      for (let i = 0; i < N; i++) {
        const d = START + i * GAP;
        if (d > L - 0.6) { this.k[i] = 0; this.m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, this.m); continue; }
        const at = pathAt(p, d);
        const yaw = Math.atan2(at.dx, at.dz);
        this.q.setFromAxisAngle(this.up, yaw);
        this.v.set(at.x, 0.022, at.z);
        const sc = 1.3 - 0.45 * (i / (N - 1)); this.s.set(sc, 1, sc);
        this.m.compose(this.v, this.q, this.s); this.mesh.setMatrixAt(i, this.m);
        // a slow wave runs down the trail; the far end fades into the dark
        // the pulse travels along the route, toward where you are going
        const wave = still ? 0.6 : Math.max(0, Math.sin(t * 2.6 - i * 0.75));
        const tail = 1 - i / (N + 1);
        const pulse = this.pulse > 0 ? Math.max(0, 1 - Math.abs((1 - this.pulse) * (N + 2) - i) / 1.5) * 1.6 : 0;
        this.k[i] = this.vis * tail * (0.42 + 0.38 * wave * wave) + pulse * this.vis * 0.8;
        this.w[i] = wave;
        this.count++;
      }
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.geometry.attributes.aK.needsUpdate = true; this.mesh.geometry.attributes.aW.needsUpdate = true;
    }
    this.mesh.visible = !!show && this.count > 0;
    // the ring: drops in, breathes while you walk to it, closes when you get there
    const u = this.ringMesh.material.uniforms;
    if (this.ringMesh.visible) {
      if (this.landT >= 0) {
        this.landT += dt; const f = this.landT / 0.35;
        u.uS.value = 1 - 0.7 * Math.min(1, f); u.uK.value = Math.max(0, 1 - f) * 0.9;
        if (f >= 1) this.clearRing();
      } else {
        this.ringT += dt;
        const inF = Math.min(1, this.ringT / 0.25);
        u.uS.value = (1.5 - 0.5 * inF) * (still ? 1 : 1 + 0.05 * Math.sin(this.ringT * 5));
        u.uK.value = inF * 0.75;
      }
    }
  }
}
