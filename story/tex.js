/* After Hours: textures, painted in code. Brush grain, the lot's ground as data
   over the tiled CC0 asphalt (patches, oil, worn lines, cracks, puddles, contact
   shade, the lamps' baked shadows), chain-link, tiles, plates, ceilings, clocks,
   paper, and every sign, screen and label in the episode, drawn on canvases in
   the site's two typefaces. The photographic materials live in
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

/* a plate's face: an embossed rim and rows of raised marks that read as characters from a distance and as
   nothing up close (no real plate numbers). nrm: the same as a normal map. Tiled in the car's own space. */
let plateC = null;
export function plateTex(nrm) {
  if (!plateC) {
    const c = cv(256, 256), g = c.getContext("2d"), r = rng(9);
    g.fillStyle = "#808080"; g.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 4; row++) for (let i = 0; i < 7; i++) {
      const x = 14 + i * 34, y = 18 + row * 62, w = 18 + r() * 8, hh = 34;
      g.fillStyle = "#b8b8b8"; g.beginPath(); g.roundRect(x, y, w, hh, 5); g.fill();
      g.fillStyle = "#808080"; g.beginPath(); g.roundRect(x + 5, y + 6 + r() * 8, w - 10, 6 + r() * 10, 3); g.fill();
    }
    plateC = c;
  }
  if (!nrm) { const t = tex(plateC, { repeat: true }); return t; }
  // a normal map from the height in R
  const s = plateC.getContext("2d").getImageData(0, 0, 256, 256).data, c2 = cv(256, 256), g2 = c2.getContext("2d"), im = g2.createImageData(256, 256);
  const H = (x, y) => s[(((y + 256) % 256) * 256 + ((x + 256) % 256)) * 4] / 255;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * 2.0, dy = (H(x, y + 1) - H(x, y - 1)) * 2.0, i = (y * 256 + x) * 4;
    const n = [-dx, dy, 1], l = Math.hypot(...n);
    im.data[i] = (n[0] / l * 0.5 + 0.5) * 255; im.data[i + 1] = (n[1] / l * 0.5 + 0.5) * 255; im.data[i + 2] = (n[2] / l * 0.5 + 0.5) * 255; im.data[i + 3] = 255;
  }
  g2.putImageData(im, 0, 0);
  return tex(c2, { repeat: true, linear: true });
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
  const font = o.font || ("600 % " + SERIF).replace("% ", "%px ");
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
export { cv };
