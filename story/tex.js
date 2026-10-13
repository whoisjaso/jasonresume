/* After Hours: textures, painted in code. Brush grain, the lot's ground as data
   over the tiled CC0 asphalt (patches, oil, worn lines, cracks, puddles, contact
   shade, the lamps' baked shadows), chain-link, tiles, ceilings, clocks, paper,
   the Texas license plates, and every sign, screen and label in the episode,
   drawn on canvases in the site's two typefaces (the plates in a face of their own). The photographic materials live in
   assets/story/world/tex-v1 (Poly Haven, CC0). */
import * as THREE from "../vendor/three-0.184.0/three.module.min.js";

const SERIF = '"Cormorant Garamond", Cormorant, Garamond, serif';
const SANS = '"Hanken Grotesk", system-ui, sans-serif';
export const INK = "#0a0f0d", BONE = "#ede7db", ASH = "#9a9890", BOTTLE = "#1c3229";

function cv(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function tex(c, o = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = o.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.anisotropy = 4; t.needsUpdate = true;
  return t;
}

/* value noise, tileable */
function noise2(w, h, cell, r) {
  const gx = Math.ceil(w / cell), gy = Math.ceil(h / cell), g = [];
  for (let i = 0; i < gx * gy; i++) g.push(r());
  const at = (x, y) => g[((y % gy) + gy) % gy * gx + (((x % gx) + gx) % gx)];
  return (x, y) => {
    const fx = x / cell, fy = y / cell, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

/* brush grain: three channels of short directional strokes, so each axis of the triplanar lookup has its own hand */
export function brush(size = 256) {
  const c = cv(size, size), g = c.getContext("2d"), r = rng(7);
  const img = g.createImageData(size, size), d = img.data;
  const ch = [0, 1, 2].map(k => {
    const n1 = noise2(size, size, 32, r), n2 = noise2(size, size, 8, r), n3 = noise2(size, size, 3, r);
    const ang = [0.3, 1.2, 2.2][k], ca = Math.cos(ang), sa = Math.sin(ang);
    return (x, y) => {
      // stretch along a stroke direction
      const u = x * ca + y * sa, v = -x * sa + y * ca;
      return 0.5 * n1(x, y) + 0.32 * n2(Math.round(u * 0.35 + size * 4) % size, Math.round(v * 1.6 + size * 4) % size) + 0.18 * n3(x, y);
    };
  });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    d[i] = ch[0](x, y) * 255; d[i + 1] = ch[1](x, y) * 255; d[i + 2] = ch[2](x, y) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c, { repeat: true, linear: true });
}

/* the lot's ground, as data over the tiled asphalt (assets/story/world/asphalt_*): two textures, linear, opaque
   (a canvas keeps colour premultiplied, so no channel can live in alpha).
   detail: R the albedo's multiplier (128 is 1: patched tar darker, faded areas lighter, oil under where cars stand),
           G painted lines (worn), B ambient occlusion (cars' footprints, curbs, walls).
   mask:   R standing water (puddles in the low spots), G how wet (the dry strip under the canopy),
           B 255 concrete instead of asphalt (walks, aprons), 128 a tar-sealed crack.
   o: { puddles: [[x, z, rx, rz]], lines: [[x0, z0, x1, z1]], cars: [{x, z, yaw, w, l}], conc: [[x0, z0, x1, z1]], dry: [[x0, z0, x1, z1]], ao: [[x0, z0, x1, z1, k]] }
   Returns the textures and the raw puddle and concrete grids for surfaceAt(). */
export function lotGround(W, H, px, o = {}) {
  const w = Math.round(W * px), h = Math.round(H * px);
  const r = rng(21);
  const P = (x, z) => [(x + W / 2) * px, (z + H / 2) * px];
  // detail
  const c = cv(w, h), g = c.getContext("2d");
  g.fillStyle = "rgb(128,0,255)"; g.fillRect(0, 0, w, h);
  // patches: older, greyer tar and newer, blacker tar, as soft blotches and as hard-edged rectangles (patched cuts)
  g.globalCompositeOperation = "source-over";
  for (let i = 0; i < 90; i++) {
    const x = r() * w, y = r() * h, rr = (0.8 + r() * 5) * px, dark = r() < 0.55;
    const gr = g.createRadialGradient(x, y, 0, x, y, rr);
    const v = dark ? 96 + r() * 20 : 150 + r() * 25;
    gr.addColorStop(0, `rgba(${v | 0},0,255,${(0.35 + r() * 0.4).toFixed(2)})`); gr.addColorStop(1, `rgba(${v | 0},0,255,0)`);
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rr, rr * (0.4 + r() * 0.8), r() * 3, 0, 7); g.fill();
  }
  for (let i = 0; i < 9; i++) {
    const x = r() * w, y = r() * h, ww = (1.2 + r() * 3.5) * px, hh = (0.8 + r() * 2.5) * px;
    g.save(); g.translate(x, y); g.rotate((r() - 0.5) * 0.08); g.fillStyle = `rgba(${(88 + r() * 14) | 0},0,255,0.85)`; g.fillRect(-ww / 2, -hh / 2, ww, hh); g.restore();
  }
  // oil: where engines sit, dark and a little sheen (the shader reads very low R as oil)
  for (const car of o.cars || []) {
    const [x, y] = P(car.x + Math.sin(car.yaw) * car.l * 0.28, car.z + Math.cos(car.yaw) * car.l * 0.28);
    for (let k = 0; k < 3; k++) {
      const rr = (0.25 + r() * 0.45) * px, ox = (r() - 0.5) * 0.6 * px, oy = (r() - 0.5) * 0.6 * px;
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr);
      gr.addColorStop(0, "rgba(40,0,255,0.7)"); gr.addColorStop(1, "rgba(40,0,255,0)"); g.fillStyle = gr; g.beginPath(); g.arc(x + ox, y + oy, rr, 0, 7); g.fill();
    }
  }
  // drips and tyre marks along the drive lanes
  g.lineCap = "round";
  for (let i = 0; i < 26; i++) {
    const x0 = r() * w, y0 = (0.42 + (r() - 0.5) * 0.15) * h, len = (3 + r() * 9) * px;
    g.strokeStyle = `rgba(${(100 + r() * 10) | 0},0,255,0.25)`; g.lineWidth = (0.18 + r() * 0.06) * px;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + len * 0.5, y0 + (r() - 0.5) * px * 2, x0 + len, y0 + (r() - 0.5) * px * 3); g.stroke();
  }
  // the painted lines into G, worn: broken by small gaps and scuffs
  g.globalCompositeOperation = "lighter";
  for (const L of o.lines || []) {
    const [x0, y0] = P(L[0], L[1]), [x1, y1] = P(L[2], L[3]);
    g.strokeStyle = "rgba(0,235,0,1)"; g.lineWidth = Math.max(1.5, 0.11 * px);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  g.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 3200; i++) { g.fillStyle = `rgba(0,0,0,${(0.1 + r() * 0.35).toFixed(2)})`; g.fillRect(r() * w, r() * h, (0.04 + r() * 0.25) * px, (0.03 + r() * 0.08) * px); }
  g.globalCompositeOperation = "source-over";
  // read back, then do AO and crack seal per pixel
  const img = g.getImageData(0, 0, w, h), d = img.data;
  const n1 = noise2(w, h, 7 * px, r), n2 = noise2(w, h, 1.8 * px, r), n3 = noise2(w, h, 0.5 * px, r);
  for (let i = 0; i < w * h; i++) { const x = i % w, y = (i / w) | 0; d[i * 4] = Math.max(0, Math.min(255, d[i * 4] + (n3(x, y) - 0.5) * 18)); if (d[i * 4 + 3] < 255) { d[i * 4 + 1] = Math.round(d[i * 4 + 1] * d[i * 4 + 3] / 255); d[i * 4 + 3] = 255; } d[i * 4 + 2] = 255; d[i * 4 + 3] = 255; }
  // AO: soft rounded rectangles under each car, darker at the wheels; plus walls and curbs
  const aoAt = new Float32Array(w * h).fill(1);
  const box = (cx, cz, hw, hl, yaw, k, soft) => {
    const ca = Math.cos(yaw), sa = Math.sin(yaw), rad = Math.hypot(hw, hl) + soft;
    const [px0, py0] = P(cx - rad, cz - rad), [px1, py1] = P(cx + rad, cz + rad);
    for (let y = Math.max(0, py0 | 0); y < Math.min(h, py1 + 1); y++) for (let x = Math.max(0, px0 | 0); x < Math.min(w, px1 + 1); x++) {
      const wx = x / px - W / 2 - cx, wz = y / px - H / 2 - cz;
      const lx = wx * ca - wz * sa, lz = wx * sa + wz * ca;
      const qx = Math.max(Math.abs(lx) - hw, 0), qz = Math.max(Math.abs(lz) - hl, 0), dd = Math.hypot(qx, qz);
      const a = 1 - k * Math.pow(Math.max(0, 1 - dd / soft), 2);
      const j = y * w + x; if (a < aoAt[j]) aoAt[j] = a;
    }
  };
  for (const car of o.cars || []) {
    box(car.x, car.z, car.w * 0.42, car.l * 0.44, car.yaw, 0.72, 0.9);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const lx = sx * (car.w / 2 - 0.15), lz = sz * (car.l / 2 - 0.95); const ca = Math.cos(car.yaw), sa = Math.sin(car.yaw); box(car.x + lx * ca + lz * sa, car.z - lx * sa + lz * ca, 0.08, 0.16, car.yaw, 0.9, 0.35); }
  }
  for (const a of o.ao || []) box((a[0] + a[2]) / 2, (a[1] + a[3]) / 2, Math.abs(a[2] - a[0]) / 2, Math.abs(a[3] - a[1]) / 2, 0, a[4] || 0.6, a[5] || 0.6);
  // cracks: long wandering tar-sealed lines (A)
  const seal = new Uint8Array(w * h);
  for (let i = 0; i < 34; i++) {
    let x = r() * w, y = r() * h, a = r() * 6.28; const n = 40 + r() * 140;
    for (let k = 0; k < n; k++) {
      a += (r() - 0.5) * 0.7; x += Math.cos(a) * px * 0.12; y += Math.sin(a) * px * 0.12;
      const wd = Math.max(1, Math.round(px * (0.03 + r() * 0.03)));
      for (let dy = -wd; dy <= wd; dy++) for (let dx = -wd; dx <= wd; dx++) { const xx = (x + dx) | 0, yy = (y + dy) | 0; if (xx >= 0 && yy >= 0 && xx < w && yy < h) seal[yy * w + xx] = 255; }
    }
  }
  for (let i = 0; i < w * h; i++) { d[i * 4 + 2] = Math.round(255 * aoAt[i]); d[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  // mask: puddles in the low spots (noise), more of them along the lines and the drive lane's crown; dry under the canopy; concrete
  const m = cv(w, h), mg = m.getContext("2d"), mi = mg.createImageData(w, h), md = mi.data;
  const conc = new Uint8Array(w * h), pud = new Uint8Array(w * h);
  const inR = (x, z, R) => x > R[0] && x < R[2] && z > R[1] && z < R[3];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, wx = x / px - W / 2, wz = y / px - H / 2;
    let v = n1(x, y) * 0.62 + n2(x, y) * 0.3 + n3(x, y) * 0.08;
    // water gathers where the asphalt dips: away from the cars' footprints, toward the lanes
    v += (1 - aoAt[i]) * -0.25;
    // puddles the story needs, where it needs them
    for (const q of o.puddles || []) { const dd = Math.hypot((wx - q[0]) / q[2], (wz - q[1]) / (q[3] || q[2])); if (dd < 1.6) v = Math.max(v, 0.66 + (1 - dd) * 0.25 + (n3(x, y) - 0.5) * 0.12); }
    const p = Math.max(0, Math.min(1, (v - 0.615) * 9));
    let wet = 1; for (const R of o.dry || []) if (inR(wx, wz, R)) wet = Math.min(wet, 0.15 + 0.85 * Math.min(1, Math.min(wz - R[1], R[3] - wz) * 0.6));
    let cc = 0; for (const R of o.conc || []) if (inR(wx, wz, R)) cc = 1;
    md[i * 4] = Math.round(255 * p * wet * (cc ? 0.2 : 1)); md[i * 4 + 1] = Math.round(255 * wet); md[i * 4 + 2] = cc ? 255 : seal[i] ? 128 : 0; md[i * 4 + 3] = 255;
    pud[i] = md[i * 4]; conc[i] = cc;
  }
  mg.putImageData(mi, 0, 0);
  const t1 = tex(c, { linear: true }), t2 = tex(m, { linear: true });
  return { detail: t1, mask: t2, w, h, px, W, H, pud, conc };
}
/* which lamp lights each texel of the ground: up to eight lamps, one channel each across two textures,
   visibility from the ground to the lamp through the boxes in the way (cars, walls), softened.
   lamps: [{ x, y, z, range }], boxes: [{ x, z, hw, hl, yaw, h, y0 }] */
export function lampShadows(W, H, px, lamps, boxes) {
  const w = Math.round(W * px), h = Math.round(H * px), n = Math.min(8, lamps.length);
  const vis = [new Uint8ClampedArray(w * h * 4).fill(255), new Uint8ClampedArray(w * h * 4).fill(255)];
  const pre = boxes.map(b => ({ ...b, ca: Math.cos(b.yaw || 0), sa: Math.sin(b.yaw || 0), rad: Math.hypot(b.hw, b.hl) }));
  for (let li = 0; li < n; li++) {
    const L = lamps[li], arr = vis[li >> 2], ch = li & 3;
    const near = pre.filter(b => Math.hypot(b.x - L.x, b.z - L.z) < L.range + b.rad);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const gx = x / px - W / 2 + 0.5 / px, gz = y / px - H / 2 + 0.5 / px;
      const dx = L.x - gx, dz = L.z - gz, dl = Math.hypot(dx, dz);
      if (dl > L.range) continue;
      let lit = 1;
      for (const b of near) {
        // quick reject: the box's centre far from the ground-to-lamp segment in plan
        const t = Math.max(0, Math.min(1, ((b.x - gx) * dx + (b.z - gz) * dz) / (dl * dl + 1e-6)));
        if (Math.hypot(gx + dx * t - b.x, gz + dz * t - b.z) > b.rad) continue;
        // slab test in the box's frame: ray from (gx, 0, gz) to (L.x, L.y, L.z)
        const ox = (gx - b.x) * b.ca - (gz - b.z) * b.sa, oz = (gx - b.x) * b.sa + (gz - b.z) * b.ca;
        const vx = dx * b.ca - dz * b.sa, vz = dx * b.sa + dz * b.ca, vy = L.y;
        let t0 = 0, t1 = 1;
        for (const [o0, v, lo, hi] of [[ox, vx, -b.hw, b.hw], [0, vy, b.y0 || 0, b.h], [oz, vz, -b.hl, b.hl]]) {
          if (Math.abs(v) < 1e-6) { if (o0 < lo || o0 > hi) { t0 = 2; break; } continue; }
          let a = (lo - o0) / v, c = (hi - o0) / v; if (a > c) [a, c] = [c, a];
          t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) break;
        }
        if (t0 <= t1) { lit = 0; break; }
      }
      arr[(y * w + x) * 4 + ch] = lit * 255;
    }
  }
  // soften: a small blur, the lamp head is not a point
  const out = vis.map(a => {
    const b = new Uint8ClampedArray(a.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) {
      let s = 0, k = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = Math.min(w - 1, Math.max(0, x + dx)), yy = Math.min(h - 1, Math.max(0, y + dy)); const wt = 3 - Math.abs(dx) * 0.5 - Math.abs(dy) * 0.5; s += a[(yy * w + xx) * 4 + c] * wt; k += wt; }
      b[(y * w + x) * 4 + c] = s / k;
    }
    const t = new THREE.DataTexture(b, w, h, THREE.RGBAFormat); t.colorSpace = THREE.NoColorSpace; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; t.flipY = false;
    return t;
  });
  return out;
}

/* chain-link: a tile of the diamond weave, wire in white on clear (alpha), two diamonds across */
export function chainTex() {
  const c = cv(128, 128), g = c.getContext("2d");
  g.clearRect(0, 0, 128, 128); g.strokeStyle = "rgba(255,255,255,1)"; g.lineWidth = 5; g.lineCap = "round";
  for (let k = -1; k <= 2; k++) { g.beginPath(); g.moveTo(k * 64 - 64, 0); g.lineTo(k * 64 + 64, 128); g.stroke(); g.beginPath(); g.moveTo(k * 64 + 64, 0); g.lineTo(k * 64 - 64, 128); g.stroke(); }
  const t = tex(c, { repeat: true }); t.anisotropy = 8; return t;
}
/* the showroom's floor: large porcelain tiles with grout lines, R grout */
export function tileTex(n = 4) {
  const c = cv(512, 512), g = c.getContext("2d"), r = rng(31);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const v = 196 + (r() - 0.5) * 18; g.fillStyle = `rgb(${v | 0},${(v * 0.97) | 0},${(v * 0.92) | 0})`; g.fillRect(i * 512 / n, j * 512 / n, 512 / n, 512 / n); }
  g.fillStyle = "rgba(90,84,76,1)"; for (let i = 0; i <= n; i++) { g.fillRect(i * 512 / n - 1.5, 0, 3, 512); g.fillRect(0, i * 512 / n - 1.5, 512, 3); }
  return tex(c, { repeat: true });
}
/* a poster with no words: a car in profile, lit, on a dark ground (the showroom's walls) */
export function posterTex(seed = 1) {
  const c = cv(256, 360), g = c.getContext("2d"), r = rng(seed);
  const gr = g.createLinearGradient(0, 0, 0, 360); gr.addColorStop(0, "#1c2420"); gr.addColorStop(1, "#0d1110"); g.fillStyle = gr; g.fillRect(0, 0, 256, 360);
  g.fillStyle = ["#9b1b14", "#d9d8d2", "#1d2b40", "#aeb2b5"][seed % 4];
  g.beginPath(); g.moveTo(30, 230); g.quadraticCurveTo(60, 196, 110, 192); g.quadraticCurveTo(140, 168, 180, 172); g.quadraticCurveTo(222, 190, 228, 228); g.lineTo(228, 238); g.lineTo(30, 240); g.closePath(); g.fill();
  g.fillStyle = "#0a0a0a"; for (const x of [72, 190]) { g.beginPath(); g.arc(x, 240, 17, 0, 7); g.fill(); }
  g.fillStyle = "rgba(237,231,219,0.8)"; g.fillRect(30, 300, 120, 6); g.fillRect(30, 316, 80, 4);
  return tex(c);
}

/* a suspended ceiling: 2 by 2 foot acoustic tiles in a white T-bar grid, fissured; tiled one tile per repeat */
export function ceilTex() {
  const c = cv(256, 256), g = c.getContext("2d"), r = rng(41);
  g.fillStyle = "#d9d6ce"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "120,116,108" : "250,248,240"},${(0.15 + r() * 0.35).toFixed(2)})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 1.5); }
  g.fillStyle = "#f2f0ea"; g.fillRect(0, 0, 256, 7); g.fillRect(0, 0, 7, 256);
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(7, 7, 249, 2); g.fillRect(7, 7, 2, 249);
  return tex(c, { repeat: true });
}
/* a troffer's lens: a prismatic diffuser in a white frame */
export function troffTex() {
  const c = cv(128, 256), g = c.getContext("2d");
  g.fillStyle = "#e8e6e0"; g.fillRect(0, 0, 128, 256);
  g.fillStyle = "#fffaf0"; g.fillRect(10, 10, 108, 236);
  g.fillStyle = "rgba(200,196,186,0.5)"; for (let y = 10; y < 246; y += 6) g.fillRect(10, y, 108, 1);
  return tex(c);
}
/* a wall clock's face: ticks and hands, no numerals */
export function clockTex(h = 10, m = 8) {
  const c = cv(256, 256), g = c.getContext("2d");
  g.fillStyle = "#f1eee6"; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
  g.strokeStyle = "#1b1d1a"; g.lineCap = "round";
  for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, l = i % 5 ? 8 : 20; g.lineWidth = i % 5 ? 2 : 5; g.beginPath(); g.moveTo(128 + Math.sin(a) * 112, 128 - Math.cos(a) * 112); g.lineTo(128 + Math.sin(a) * (112 - l), 128 - Math.cos(a) * (112 - l)); g.stroke(); }
  const hand = (a, l, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(a) * l, 128 - Math.cos(a) * l); g.stroke(); };
  hand((h + m / 60) / 12 * Math.PI * 2, 60, 8); hand(m / 60 * Math.PI * 2, 92, 5);
  g.fillStyle = "#1b1d1a"; g.beginPath(); g.arc(128, 128, 7, 0, 7); g.fill();
  return tex(c);
}
/* a brain scan on a light box: four axial slices on a sheet of film, white folds on black, no labels */
export function scanTex() {
  const c = cv(256, 256), g = c.getContext("2d"), r = rng(17);
  g.fillStyle = "#c8d4dc"; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#0c0f12"; g.fillRect(8, 8, 240, 240);
  for (let k = 0; k < 4; k++) {
    const cx = 68 + (k % 2) * 120, cy = 68 + ((k / 2) | 0) * 120, rx = 42 - k * 2, ry = 52 - k * 2;
    g.save(); g.translate(cx, cy);
    // the skull, the brain inside it, the fissure down the middle, the folds
    g.strokeStyle = "rgba(235,240,244,0.9)"; g.lineWidth = 3; g.beginPath(); g.ellipse(0, 0, rx + 5, ry + 5, 0, 0, 7); g.stroke();
    g.fillStyle = "rgba(150,160,168,0.75)"; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 7); g.fill();
    g.strokeStyle = "rgba(25,28,32,0.85)"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -ry); g.lineTo(0, ry); g.stroke();
    g.lineWidth = 1.2;
    for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, d = 0.35 + r() * 0.55; g.beginPath(); g.moveTo(Math.cos(a) * rx * d, Math.sin(a) * ry * d); g.quadraticCurveTo(Math.cos(a + 0.2) * rx * (d + 0.15), Math.sin(a + 0.2) * ry * (d + 0.15), Math.cos(a + 0.35) * rx * d, Math.sin(a + 0.35) * ry * d); g.stroke(); }
    // the ventricles, dark at the centre
    g.fillStyle = "rgba(20,22,26,0.9)"; g.beginPath(); g.ellipse(-7, -4, 5, 13, 0.2, 0, 7); g.ellipse(7, -4, 5, 13, -0.2, 0, 7); g.fill();
    g.restore();
  }
  return tex(c);
}

/* night through a library's tall window: a dark campus, a few warm windows and lamps, out of focus */
export function nightTex(seed = 3) {
  const c = cv(256, 512), g = c.getContext("2d"), r = rng(seed);
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#0b1018"); gr.addColorStop(0.65, "#18202a"); gr.addColorStop(1, "#0a0c0e"); g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
  g.fillStyle = "#07090b"; g.fillRect(0, 330, 256, 182); g.fillRect(20, 250, 120, 100); g.fillRect(170, 280, 90, 60);
  g.filter = "blur(3px)";
  for (let i = 0; i < 16; i++) { g.fillStyle = r() < 0.7 ? "rgba(255,196,120,0.75)" : "rgba(190,210,255,0.6)"; g.fillRect(r() * 250, 260 + r() * 120, 6 + r() * 6, 8 + r() * 6); }
  for (let i = 0; i < 5; i++) { const x = r() * 256, y = 360 + r() * 60; const rg = g.createRadialGradient(x, y, 0, x, y, 30); rg.addColorStop(0, "rgba(255,200,130,0.8)"); rg.addColorStop(1, "rgba(255,200,130,0)"); g.fillStyle = rg; g.fillRect(x - 30, y - 30, 60, 60); }
  g.filter = "none";
  return tex(c);
}

/* paper with a tooth, for the journal and the memory */
export function paper(w = 512, h = 512, tone = "#e9e1d0") {
  const c = cv(w, h), g = c.getContext("2d"), r = rng(5);
  g.fillStyle = tone; g.fillRect(0, 0, w, h);
  const img = g.getImageData(0, 0, w, h), d = img.data, n = noise2(w, h, 40, r);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, v = (r() - 0.5) * 14 + (n(x, y) - 0.5) * 18; d[i] += v; d[i + 1] += v; d[i + 2] += v * 0.9; }
  g.putImageData(img, 0, 0);
  return c;
}

/* text helpers */
function fit(g, text, font, size, maxW) { let s = size; g.font = font.replace("%", s + "px"); while (g.measureText(text).width > maxW && s > 8) { s -= 2; g.font = font.replace("%", s + "px"); } return s; }
function tracked(g, text, x, y, track, align = "center") {
  const chars = [...text]; const widths = chars.map(ch => g.measureText(ch).width); const total = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  g.textAlign = "left"; chars.forEach((ch, i) => { g.fillText(ch, cx, y); cx += widths[i] + track; });
}
function wrap(g, text, x, y, maxW, lh) {
  const words = text.split(" "); let line = "", yy = y;
  for (const w of words) { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t; }
  if (line) g.fillText(line, x, yy); return yy + lh;
}

/* the showroom sign: the real Triple J wordmark, lit */
export function signTex(img) {
  const c = cv(1024, 256), g = c.getContext("2d");
  g.fillStyle = "#0d1411"; g.fillRect(0, 0, 1024, 256);
  if (img) { const s = Math.min(900 / img.width, 200 / img.height); g.drawImage(img, 512 - img.width * s / 2, 128 - img.height * s / 2, img.width * s, img.height * s); }
  else { g.fillStyle = BONE; g.font = "600 120px " + SERIF; tracked(g, "TRIPLE J", 512, 150, 14); }
  return tex(c);
}
/* the bus stop's disc: a bus drawn in a circle, no words, no numbers */
export function busSignTex() {
  const c = cv(256, 256), g = c.getContext("2d");
  g.fillStyle = "#1d3b5a"; g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#ede7db"; g.lineWidth = 8; g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#ede7db"; g.beginPath(); g.roundRect ? g.roundRect(58, 78, 140, 86, 14) : g.rect(58, 78, 140, 86); g.fill();
  g.fillStyle = "#1d3b5a"; for (let i = 0; i < 3; i++) g.fillRect(68 + i * 42, 90, 34, 30); g.fillRect(70, 132, 116, 6);
  g.fillStyle = "#ede7db"; for (const x of [84, 172]) { g.beginPath(); g.arc(x, 170, 13, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "#1d3b5a"; for (const x of [84, 172]) { g.beginPath(); g.arc(x, 170, 6, 0, Math.PI * 2); g.fill(); }
  return tex(c);
}
/* the office's door sign: one word, lit from behind */
export function officeSignTex() {
  const c = cv(512, 144), g = c.getContext("2d");
  g.fillStyle = "#0d1411"; g.fillRect(0, 0, 512, 144);
  g.strokeStyle = "rgba(237,231,219,0.55)"; g.lineWidth = 3; g.strokeRect(10, 10, 492, 124);
  g.fillStyle = BONE; g.font = "600 76px " + SANS; tracked(g, "OFFICE", 256, 100, 16);
  return tex(c);
}
export function bannerTex() {
  const c = cv(1024, 160), g = c.getContext("2d");
  g.fillStyle = "#e6dfd0"; g.fillRect(0, 0, 1024, 160);
  g.fillStyle = "#1c3229"; g.font = "italic 600 70px " + SERIF; g.textAlign = "center"; g.textBaseline = "middle";
  fit(g, "Clear vehicles. Clear terms. Real people.", "italic 600 %px " + SERIF, 70, 960);
  g.fillText("Clear vehicles. Clear terms. Real people.", 512, 84);
  return tex(c);
}
/* the sold board: tags pinned in rows, no figures on them */
export function soldTex() {
  const c = cv(512, 384), g = c.getContext("2d"), r = rng(53);
  g.fillStyle = "#1b1d1a"; g.fillRect(0, 0, 512, 384);
  g.strokeStyle = "rgba(237,231,219,0.25)"; g.lineWidth = 3; g.strokeRect(8, 8, 496, 368);
  g.fillStyle = BONE; g.font = "600 34px " + SERIF; g.textBaseline = "alphabetic"; tracked(g, "SOLD", 256, 54, 10);
  let n = 0;
  for (let row = 0; row < 6; row++) for (let col = 0; col < 9 && n < 53; col++, n++) {
    const x = 34 + col * 50 + (r() - 0.5) * 6, y = 80 + row * 48 + (r() - 0.5) * 6;
    g.save(); g.translate(x + 18, y + 18); g.rotate((r() - 0.5) * 0.35);
    g.fillStyle = r() < 0.5 ? "#e8e0cd" : "#d9cfb8"; g.fillRect(-16, -18, 32, 38);
    g.fillStyle = "#8a2f25"; g.fillRect(-16, -18, 32, 9);
    g.fillStyle = "#4a463d"; for (let k = 0; k < 3; k++) g.fillRect(-11, -2 + k * 7, 22 - k * 5, 2);
    g.fillStyle = "#c9a96a"; g.beginPath(); g.arc(0, -13, 2.4, 0, 7); g.fill();
    g.restore();
  }
  return tex(c);
}
/* the whiteboard: lead, deal, title in marker, and three notes */
export function boardTex() {
  const c = cv(1024, 640), g = c.getContext("2d"), r = rng(3);
  g.fillStyle = "#e9ebe6"; g.fillRect(0, 0, 1024, 640);
  g.globalAlpha = 0.08; for (let i = 0; i < 40; i++) { g.fillStyle = "#6a7a8a"; g.beginPath(); g.ellipse(r() * 1024, r() * 640, 60 + r() * 200, 8 + r() * 30, r() * 3, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  const pen = (col, wdt) => { g.strokeStyle = col; g.fillStyle = col; g.lineWidth = wdt; g.lineCap = "round"; g.lineJoin = "round"; };
  const box = (x, y, t) => { pen("#1f3b63", 5); g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x + 200, y - 3); g.lineTo(x + 203, y + 92); g.lineTo(x - 2, y + 95); g.closePath(); g.stroke(); g.font = "italic 600 54px " + SERIF; g.textAlign = "center"; g.fillText(t, x + 100, y + 64); };
  box(70, 120, "Lead"); box(410, 120, "Deal"); box(750, 120, "Title");
  const arrow = (x0, x1, y) => { pen("#1f3b63", 5); g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo((x0 + x1) / 2, y - 18, x1, y); g.stroke(); g.beginPath(); g.moveTo(x1, y); g.lineTo(x1 - 18, y - 12); g.moveTo(x1, y); g.lineTo(x1 - 16, y + 12); g.stroke(); };
  arrow(285, 400, 170); arrow(625, 740, 170);
  pen("#7a2a22", 4); g.font = "italic 500 34px " + SERIF; g.textAlign = "left";
  g.fillText("roles", 120, 290); g.fillText("validation", 440, 290); g.fillText("one record per sale", 700, 290);
  pen("#1f3b63", 3); g.beginPath(); g.moveTo(100, 300); g.lineTo(940, 306); g.stroke();
  return tex(c);
}
export function noteTex(text, tint = "#e7cf73") {
  const c = cv(256, 256), g = c.getContext("2d");
  g.fillStyle = tint; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "rgba(0,0,0,0.06)"; g.fillRect(0, 0, 256, 34);
  g.fillStyle = "#2a2a28"; g.font = "italic 600 44px " + SERIF; g.textAlign = "center";
  wrap(g, text, 128, 110, 220, 50);
  return tex(c);
}
/* screens, lit from inside: the call log, the lead card, the course list */
export function screenTex(kind) {
  const c = cv(768, 480), g = c.getContext("2d");
  g.fillStyle = "#0f1613"; g.fillRect(0, 0, 768, 480);
  g.fillStyle = "#16221d"; g.fillRect(0, 0, 768, 54);
  g.fillStyle = BONE; g.font = "600 26px " + SANS; g.textAlign = "left"; g.textBaseline = "alphabetic";
  const row = (y, a, b, dim) => { g.fillStyle = dim ? ASH : BONE; g.font = "500 24px " + SANS; g.fillText(a, 34, y); if (b) { g.textAlign = "right"; g.fillStyle = ASH; g.fillText(b, 734, y); g.textAlign = "left"; } g.fillStyle = "rgba(237,231,219,0.1)"; g.fillRect(34, y + 16, 700, 1); };
  if (kind === "lead") {
    g.fillText("Lead research", 34, 36); g.fillStyle = ASH; g.font = "500 18px " + SANS; g.textAlign = "right"; g.fillText("Example lead, fictional seller", 734, 35); g.textAlign = "left";
    row(110, "Source", "Facebook Marketplace"); row(170, "Findings", "Written to the CRM"); row(230, "Reply", "Drafted from the SOP");
    g.fillStyle = "#1c3229"; g.fillRect(34, 290, 700, 150); g.fillStyle = BONE; g.font = "italic 500 30px " + SERIF; wrap(g, "Hi, thanks for listing it. Is it still available? We buy and trade, and we can come to you.", 56, 340, 650, 38);
  } else if (kind === "calls") {
    g.fillText("Inbound calls", 34, 36); g.fillStyle = ASH; g.font = "500 18px " + SANS; g.textAlign = "right"; g.fillText("Fictional call", 734, 35); g.textAlign = "left";
    row(110, "Answered by the voice agent", "Booked"); row(170, "Appointment written to the CRM", "Saturday"); row(230, "Hold request", "Transferred to staff");
    g.fillStyle = "#c9a96a"; g.beginPath(); g.arc(46, 300, 7, 0, 7); g.fill(); g.fillStyle = BONE; g.font = "500 24px " + SANS; g.fillText("Live transfer", 66, 308);
  } else if (kind === "courses") {
    g.fillText("Anthropic courses", 34, 36); g.textAlign = "right"; g.fillStyle = ASH; g.font = "500 18px " + SANS; g.fillText("Nineteen completed", 734, 35); g.textAlign = "left";
    ["Claude 101", "Claude Code in Action", "Building with the Claude API", "Introduction to Model Context Protocol", "AI Fluency: Framework and Foundations", "Introduction to agent skills"].forEach((t, i) => { g.fillStyle = "#c9a96a"; g.fillRect(34, 92 + i * 58, 10, 10); g.fillStyle = BONE; g.font = "500 24px " + SANS; g.fillText(t, 60, 102 + i * 58); });
  } else if (kind === "desk") {
    g.fillText("Handle a Sale", 34, 36); g.fillStyle = ASH; g.font = "500 18px " + SANS; g.textAlign = "right"; g.fillText("Fictional buyer, example figures", 734, 35); g.textAlign = "left";
    g.fillStyle = BONE; g.font = "600 40px " + SERIF; g.fillText("How is the buyer paying?", 34, 140);
    ["Cash", "Buy here pay here", "Bank financing"].forEach((t, i) => { g.strokeStyle = "rgba(237,231,219,0.4)"; g.lineWidth = 2; g.strokeRect(34, 180 + i * 84, 700, 64); g.fillStyle = BONE; g.font = "500 26px " + SANS; g.fillText(t, 60, 221 + i * 84); });
  } else if (kind === "arcade") {
    const gr = g.createLinearGradient(0, 0, 0, 480); gr.addColorStop(0, "#0d1a14"); gr.addColorStop(1, "#22140c"); g.fillStyle = gr; g.fillRect(0, 0, 768, 480);
    g.fillStyle = "#c9a96a"; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(120 + i * 105, 300 - (i % 2) * 40, 12, 0, 7); g.fill(); }
    g.fillStyle = BONE; g.font = "600 64px " + SERIF; g.textAlign = "center"; tracked(g, "AFTER HOURS", 384, 170, 8); g.font = "500 30px " + SANS; tracked(g, "THE RUN", 384, 220, 10);
    g.font = "500 22px " + SANS; g.fillStyle = ASH; g.fillText("Press start", 384, 420);
  }
  return tex(c);
}
export function labelTex(text, o = {}) {
  const w = o.w || 512, h = o.h || 128, c = cv(w, h), g = c.getContext("2d");
  g.fillStyle = o.bg || "#e6dfd0"; g.fillRect(0, 0, w, h);
  g.fillStyle = o.fg || "#1b1d1a"; g.textAlign = "center"; g.textBaseline = "middle";
  const font = o.font || ("600 % " + SERIF); // (fit() puts the size in for the %)
  fit(g, text, font, o.size || Math.round(h * 0.55), w - 24);
  g.fillText(text, w / 2, h / 2 + 4);
  return tex(c);
}
/* a book cover, a certificate, a letter: the memory's desk */
export function docTex(kind) {
  const c = cv(512, 680), g = c.getContext("2d"), pc = paper(512, 680, kind === "book" ? "#24402f" : "#ece4d2");
  g.drawImage(pc, 0, 0);
  g.textAlign = "center"; g.textBaseline = "alphabetic";
  if (kind === "book") { g.fillStyle = "#c9a96a"; g.font = "600 56px " + SERIF; tracked(g, "NEURO", 256, 250, 10); tracked(g, "SCIENCE", 256, 316, 10); g.fillRect(156, 350, 200, 3); }
  else if (kind === "cert") { g.strokeStyle = "#9c6b43"; g.lineWidth = 6; g.strokeRect(26, 26, 460, 628); g.fillStyle = "#1b1d1a"; g.font = "600 40px " + SERIF; g.fillText("Google AI Essentials", 256, 250); g.font = "500 26px " + SANS; g.fillStyle = "#4a463d"; g.fillText("Google, on Coursera", 256, 300); g.fillText("2026", 256, 340); }
  else if (kind === "letter") { g.fillStyle = "#1b1d1a"; g.font = "600 40px " + SERIF; g.fillText("Dean's Honor List", 256, 170); g.font = "500 24px " + SANS; g.fillStyle = "#4a463d"; g.fillText("San Jacinto College", 256, 214); g.fillText("GPA 3.63", 256, 254); g.fillStyle = "rgba(27,29,26,0.25)"; for (let i = 0; i < 9; i++) g.fillRect(70, 320 + i * 30, 372 - (i % 3) * 40, 6); }
  else if (kind === "folder") { g.fillStyle = "#1b1d1a"; g.font = "600 36px " + SERIF; g.fillText("Associate of Arts", 256, 250); g.fillText("in Business", 256, 296); g.font = "500 24px " + SANS; g.fillStyle = "#4a463d"; g.fillText("San Jacinto College", 256, 350); g.fillText("May 2026", 256, 390); }
  return tex(c);
}
/* palm fronds and the far tree line, as alpha cards */
export function frondTex() {
  const c = cv(256, 512), g = c.getContext("2d"), r = rng(11);
  g.strokeStyle = "#0b100d"; g.lineCap = "round";
  g.lineWidth = 6; g.beginPath(); g.moveTo(128, 512); g.quadraticCurveTo(120, 260, 128, 10); g.stroke();
  for (let i = 0; i < 46; i++) {
    const t = i / 46, y = 500 - t * 480, len = 110 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05));
    for (const s of [-1, 1]) { g.lineWidth = 3 + (1 - t) * 3; g.beginPath(); g.moveTo(126, y); g.quadraticCurveTo(126 + s * len * 0.5, y - 10, 126 + s * len, y + 30 + r() * 20); g.stroke(); }
  }
  return tex(c);
}
export function skylineTex() {
  const c = cv(2048, 256), g = c.getContext("2d"), r = rng(17);
  g.clearRect(0, 0, 2048, 256);
  g.fillStyle = "#070a09";
  let x = 0; while (x < 2048) { const w = 30 + r() * 120, h = 20 + r() * 70; g.fillRect(x, 256 - h, w, h); x += w + r() * 20; }
  // palms and poles
  for (let i = 0; i < 38; i++) {
    const px = r() * 2048, ph = 90 + r() * 120;
    g.fillRect(px, 256 - ph, 3, ph);
    g.beginPath(); for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 + (k - 4) * 0.36; g.moveTo(px + 1, 256 - ph); g.quadraticCurveTo(px + Math.cos(a) * 20, 256 - ph - 10, px + Math.cos(a) * 34, 256 - ph + 18 + Math.abs(k - 4) * 3); }
    g.strokeStyle = "#070a09"; g.lineWidth = 4; g.stroke();
  }
  // far windows and lamps, warm specks
  for (let i = 0; i < 140; i++) { g.fillStyle = r() < 0.7 ? "rgba(255,190,110," + (0.4 + r() * 0.6) + ")" : "rgba(200,220,255,0.6)"; g.fillRect(r() * 2048, 180 + r() * 70, 2, 2); }
  return tex(c);
}
/* the Texas standard plate, the black and white Lone Star design: a pale ground with a faint twisted ribbon down
   each edge, TEXAS across the top, the star top left, The Lone Star State along the bottom and a small barcode,
   and in the middle three letters, the state's outline and three more. Letters only, never a figure, so no plate
   in the episode is a real plate number. The big characters and TEXAS come from a stroke alphabet of their own
   (a heavy condensed plate face that looks the same on every device). Laid out in hundredths of an inch on a
   12 by 6 inch plate; story/plates.js gives each car and each lost plate its own cell of the atlas below */
const PL_INK = "#141617";
// the alphabet: centre lines in a 100 by 160 box, stroked with flat ends and clipped to the box (a line that runs
// past the box ends square on its edge; one that starts on another stroke starts inside its ink)
const PL_GLYPH = {
  A: "M10 160 L46 14 L54 14 L90 160 M27 102 L73 102",
  B: "M14 78 L58 78 Q84 78 84 50 L84 40 Q84 14 58 14 L14 14 L14 146 L58 146 Q86 146 86 118 L86 106 Q86 78 58 78",
  C: "M86 46 L86 42 Q86 14 58 14 L42 14 Q14 14 14 42 L14 118 Q14 146 42 146 L58 146 Q86 146 86 118 L86 114",
  D: "M14 14 L14 146 L54 146 Q86 146 86 114 L86 46 Q86 14 54 14 Z",
  E: "M104 14 L14 14 L14 146 L104 146 M14 80 L80 80",
  F: "M104 14 L14 14 L14 164 M14 80 L80 80",
  G: "M86 46 L86 42 Q86 14 58 14 L42 14 Q14 14 14 42 L14 118 Q14 146 42 146 L58 146 Q86 146 86 118 L86 84 L54 84",
  H: "M14 -4 L14 164 M86 -4 L86 164 M14 80 L86 80",
  I: "M22 14 L78 14 M50 14 L50 146 M22 146 L78 146",
  J: "M86 -4 L86 118 Q86 146 58 146 L42 146 Q14 146 14 118 L14 108",
  K: "M14 -4 L14 164 M100 -6 L20 92 M42 66 L100 168",
  L: "M14 -4 L14 146 L104 146",
  M: "M14 164 L14 14 L50 100 L86 14 L86 164",
  N: "M14 164 L14 -4 M86 164 L86 -4 M14 14 L86 146",
  O: "M42 14 L58 14 Q86 14 86 42 L86 118 Q86 146 58 146 L42 146 Q14 146 14 118 L14 42 Q14 14 42 14 Z",
  P: "M14 164 L14 14 L58 14 Q86 14 86 42 L86 56 Q86 84 58 84 L14 84",
  Q: "M42 14 L58 14 Q86 14 86 42 L86 118 Q86 146 58 146 L42 146 Q14 146 14 118 L14 42 Q14 14 42 14 Z M60 120 L94 164",
  R: "M14 164 L14 14 L58 14 Q86 14 86 42 L86 56 Q86 84 58 84 L14 84 M50 84 L94 164",
  S: "M86 46 L86 42 Q86 14 58 14 L42 14 Q14 14 14 40 L14 50 Q14 78 42 79 L58 81 Q86 82 86 110 L86 118 Q86 146 58 146 L42 146 Q14 146 14 118 L14 114",
  T: "M-4 14 L104 14 M50 14 L50 164",
  U: "M14 -4 L14 118 Q14 146 42 146 L58 146 Q86 146 86 118 L86 -4",
  V: "M10 -4 L44 146 L56 146 L90 -4",
  W: "M6 -4 L26 146 L50 56 L74 146 L94 -4",
  X: "M10 -4 L90 164 M90 -4 L10 164",
  Y: "M8 -4 L50 86 L92 -4 M50 80 L50 164",
  Z: "M-4 14 L86 14 L14 146 L104 146"
};
// the glyphs at one size: centre lines mapped so the stroke's outer edge meets the box
const plGlyphs = new Map();
function plGlyph(ch, w, h, sw) {
  const k = ch + w + "x" + h + "x" + sw;
  if (!plGlyphs.has(k)) {
    const a = (w - sw) / 72, d = (h - sw) / 132, p = new Path2D();
    p.addPath(new Path2D(PL_GLYPH[ch] || ""), new DOMMatrix([a, 0, 0, d, sw / 2 - 14 * a, sw / 2 - 14 * d]));
    plGlyphs.set(k, p);
  }
  return plGlyphs.get(k);
}
function plWord(g, text, x, y, w, h, sw, gap) {
  g.lineWidth = sw; g.lineCap = "butt"; g.lineJoin = "miter"; g.miterLimit = 2.2;
  for (let i = 0; i < text.length; i++) {
    const x0 = x + i * (w + gap);
    g.save(); g.beginPath(); g.rect(x0, y, w, h); g.clip(); g.translate(x0, y); g.stroke(plGlyph(text[i], w, h, sw)); g.restore();
  }
  return text.length * (w + gap) - gap;
}
// the state's outline (longitude, latitude), drawn into a box
const PL_TX = [[-106.62, 32.0], [-103.06, 32.0], [-103.04, 36.5], [-100.0, 36.5], [-100.0, 34.56], [-99.4, 34.38], [-98.9, 34.16], [-98.4, 34.06], [-97.95, 33.88], [-97.4, 33.82], [-96.9, 33.95], [-96.4, 33.75], [-95.9, 33.86], [-95.3, 33.88], [-94.7, 33.68], [-94.04, 33.55], [-94.04, 32.0], [-93.82, 31.6], [-93.55, 31.18], [-93.52, 30.6], [-93.72, 30.06], [-93.86, 29.72], [-94.6, 29.48], [-95.0, 29.22], [-95.4, 28.95], [-96.1, 28.55], [-96.8, 28.2], [-97.2, 27.75], [-97.42, 27.25], [-97.38, 26.65], [-97.15, 25.96], [-97.55, 25.9], [-98.2, 26.06], [-98.8, 26.36], [-99.2, 26.9], [-99.5, 27.5], [-99.95, 27.95], [-100.35, 28.5], [-100.7, 29.1], [-101.05, 29.45], [-101.4, 29.77], [-101.9, 29.8], [-102.35, 29.85], [-102.7, 29.4], [-103.0, 29.0], [-103.4, 29.02], [-103.8, 29.28], [-104.3, 29.55], [-104.65, 30.05], [-104.95, 30.6], [-105.5, 31.1], [-106.1, 31.45], [-106.53, 31.78]];
function plState(g, cx, cy, w) {
  const k = Math.cos(31.5 * Math.PI / 180), x0 = -106.62 * k, x1 = -93.52 * k, s = w / (x1 - x0), h = (36.5 - 25.9) * s;
  g.beginPath();
  PL_TX.forEach(([lo, la], i) => { const x = cx - w / 2 + (lo * k - x0) * s, y = cy - h / 2 + (36.5 - la) * s; i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.closePath(); g.fillStyle = PL_INK; g.fill();
}
// the Lone Star, outlined, each point split into a lit facet and a shaded one
function plStar(g, cx, cy, R) {
  const P = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * 0.4 : R; P.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  g.beginPath(); P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = "#fbfcfc"; g.fill();
  for (let i = 0; i < 10; i += 2) {
    const t = P[i], b = P[(i + 1) % 10];
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(t[0], t[1]); g.lineTo(b[0], b[1]); g.closePath(); g.fillStyle = "#8f9aa3"; g.fill();
  }
  g.strokeStyle = PL_INK; g.lineJoin = "miter"; g.lineWidth = 3;
  g.beginPath(); for (let i = 0; i < 10; i++) { g.moveTo(cx, cy); g.lineTo(P[i][0], P[i][1]); } g.stroke();
  g.lineWidth = 8; g.beginPath(); P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
}
/* the plate without its characters: the ground, the ribbons, the rim, the slots, TEXAS, the star, the line along
   the bottom and the barcode. g is in plate units (1200 by 600) */
function plBase(g) {
  const bg = g.createLinearGradient(0, 0, 0, 600); bg.addColorStop(0, "#f4f6f7"); bg.addColorStop(1, "#e8eef2");
  g.fillStyle = bg; g.fillRect(-40, -40, 1280, 680);
  // the twisted ribbon down each edge: a band whose width turns with its twist, its face and its back in two tints
  for (const cx of [62, 1138]) for (let y = 8; y < 592; y += 2) {
    const ph = (y + (cx > 600 ? 75 : 0)) * Math.PI * 2 / 150, c = Math.cos(ph), w = 34 * Math.abs(c) + 3, sx = Math.sin(ph) * 10;
    g.fillStyle = c > 0 ? "rgba(150,170,188,0.36)" : "rgba(175,192,206,0.28)"; g.fillRect(cx + sx - w, y, w * 2, 2.4);
  }
  // the pressed rim takes a little shade along its foot
  g.strokeStyle = "rgba(120,135,148,0.35)"; g.lineWidth = 5; g.beginPath(); g.roundRect(21.7, 21.7, 1156.6, 556.6, 18); g.stroke();
  // the bolt slots (cut through in the model; this is their walls)
  g.fillStyle = "#4a4f53";
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) { g.beginPath(); g.roundRect(600 + sx * 350 - 27.5, 300 + sy * 237.5 - 13, 55, 26, 13); g.fill(); }
  g.strokeStyle = PL_INK; plWord(g, "TEXAS", 448, 40, 52, 82, 16, 11);
  plStar(g, 148, 100, 60);
  g.fillStyle = PL_INK; g.textAlign = "center"; g.textBaseline = "alphabetic";
  g.font = '700 64px Arial, "Helvetica Neue", Helvetica, "Hanken Grotesk", sans-serif';
  const tw = g.measureText("The Lone Star State").width;
  g.save(); g.translate(600, 556); if (tw > 600) g.scale(600 / tw, 1); g.fillText("The Lone Star State", 0, 0); g.restore();
  // a small barcode, bottom right: bars only
  const r = rng(31); let x = 1012;
  while (x < 1118) { const w = 2 + Math.floor(r() * 3) * 2; if (r() < 0.62) g.fillRect(x, 512, w, 42); x += w + 2 + Math.floor(r() * 2) * 2; }
}
const PL_MID = { y: 166, h: 286, w: 128, sw: 38, gap: 16, mid: 128, pad: 30 };
function plChars(g, a, b) {
  const M = PL_MID, gw = 3 * M.w + 2 * M.gap, x0 = 600 - (2 * gw + 2 * M.pad + M.mid) / 2;
  plWord(g, a, x0, M.y, M.w, M.h, M.sw, M.gap);
  plWord(g, b, x0 + gw + 2 * M.pad + M.mid, M.y, M.w, M.h, M.sw, M.gap);
  return x0 + gw + M.pad + M.mid / 2;
}
/* one plate face, flat, at w pixels across (tools/verify/out/plate-texture.png and the atlas both draw with it) */
export function plateFace(a, b, w = 1200, base) {
  const c = cv(w, w / 2), g = c.getContext("2d");
  drawPlate(g, 0, 0, w, a, b, base);
  return c;
}
function drawPlate(g, x, y, w, a, b, base) {
  g.save(); g.translate(x, y); g.scale(w / 1200, w / 1200);
  if (base) g.drawImage(base, 0, 0, 1200, 600); else plBase(g);
  g.strokeStyle = PL_INK; const sx = plChars(g, a, b);
  plState(g, sx, PL_MID.y + PL_MID.h / 2, PL_MID.mid);
  g.restore();
}
/* the letter groups: consonants only (no words), none that reads as a slur or a crude abbreviation, never two plates
   the same; the first is the pair from Jason's note */
const PL_ABC = "BCDFGHJKLMNPRSTVWXYZ", PL_BAN = /GYP|FK|FC|FG|KK|SH|CN|NG|DK|DC|WTF|FML|KYS|SX|XX|TWT|PSS|PST|NSF|STD|BJ|DTF|FRK|MLF/;
export function plateLetters(n, seed = 77) {
  const r = rng(seed), out = [["TXJ", "LMR"]], seen = new Set(["TXJLMR"]);
  const grp = () => { let g; do g = PL_ABC[Math.floor(r() * 20)] + PL_ABC[Math.floor(r() * 20)] + PL_ABC[Math.floor(r() * 20)]; while (PL_BAN.test(g)); return g; };
  while (out.length < n) { const p = [grp(), grp()]; if (!seen.has(p[0] + p[1])) { seen.add(p[0] + p[1]); out.push(p); } }
  return out;
}
/* the atlas: PLATE_COLS by PLATE_ROWS cells, each a plate face with a margin of its own ground (so the small mips
   don't pull in a neighbour), 32 pixels to the inch (16 on phones), and the normal map of the embossed characters
   at half that. cell(i) is where cell i's face starts in UV (top left, the textures aren't flipped) and scale its size */
export const PLATE_COLS = 5, PLATE_ROWS = 10;
const plAtlas = {};
export function plateAtlas(lo) {
  const key = lo ? "lo" : "hi"; if (plAtlas[key]) return plAtlas[key];
  const s = lo ? 0.5 : 1, N = 2048 * s, fw = 384 * s, cw = 408 * s, ch = 204 * s, px = (cw - fw) / 2, py = (ch - fw / 2) / 2;
  const n = PLATE_COLS * PLATE_ROWS, letters = plateLetters(n);
  const base = cv(1200 * s, 600 * s); { const g = base.getContext("2d"); g.scale(s, s); plBase(g); }
  const c = cv(N, N), g = c.getContext("2d");
  g.fillStyle = "#eef2f4"; g.fillRect(0, 0, N, N);
  // the height of the embossed characters, at half size: mid grey ground, the strokes raised and softened a little
  const hN = N / 2, hc = cv(hN, hN), hg = hc.getContext("2d");
  hg.fillStyle = "#000"; hg.fillRect(0, 0, hN, hN);
  hg.filter = "blur(" + (1.2 * s) + "px)";
  for (let i = 0; i < n; i++) {
    const cx = (i % PLATE_COLS) * cw, cy = Math.floor(i / PLATE_COLS) * ch, [a, b] = letters[i];
    g.fillStyle = "#eef2f4"; g.fillRect(cx, cy, cw, ch);
    drawPlate(g, cx + px, cy + py, fw, a, b, base);
    hg.save(); hg.translate((cx + px) / 2, (cy + py) / 2); hg.scale(fw / 2400, fw / 2400); hg.strokeStyle = "#fff"; plChars(hg, a, b); hg.restore();
  }
  hg.filter = "none";
  // the normal map from the height (+u right, +v down the canvas)
  const H = hg.getImageData(0, 0, hN, hN).data, nc = cv(hN, hN), ng = nc.getContext("2d"), im = ng.createImageData(hN, hN), D = im.data, K = 2.6 * s;
  for (let y = 0; y < hN; y++) for (let x = 0; x < hN; x++) {
    const xl = x > 0 ? x - 1 : x, xr = x < hN - 1 ? x + 1 : x, yu = y > 0 ? y - 1 : y, yd = y < hN - 1 ? y + 1 : y;
    const dx = (H[(y * hN + xr) * 4] - H[(y * hN + xl) * 4]) / 255 * K, dy = (H[(yd * hN + x) * 4] - H[(yu * hN + x) * 4]) / 255 * K;
    const l = Math.sqrt(dx * dx + dy * dy + 1), i = (y * hN + x) * 4;
    D[i] = (-dx / l * 0.5 + 0.5) * 255; D[i + 1] = (-dy / l * 0.5 + 0.5) * 255; D[i + 2] = (1 / l * 0.5 + 0.5) * 255; D[i + 3] = 255;
  }
  ng.putImageData(im, 0, 0);
  const map = tex(c), nmap = tex(nc, { linear: true });
  map.flipY = nmap.flipY = false;
  return (plAtlas[key] = { map, nmap, canvas: c, letters, scale: [fw / N, fw / 2 / N], cell: i => { i = ((i % n) + n) % n; return [((i % PLATE_COLS) * cw + px) / N, (Math.floor(i / PLATE_COLS) * ch + py) / N]; } });
}
export { cv };
