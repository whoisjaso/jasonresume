/* After Hours: textures, painted in code. Brush grain, wet asphalt with its
   lines and puddles, paper, and every sign, screen and label in the episode,
   drawn on canvases in the site's two typefaces. Nothing here is a photo. */
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

/* the lot's asphalt: colour in RGB, puddles in a second texture (R puddle, G paint, B cracks) */
export function asphalt(W, H, px, lines) {
  const w = Math.round(W * px), h = Math.round(H * px);
  const c = cv(w, h), g = c.getContext("2d"), r = rng(21);
  g.fillStyle = "#2b2c2b"; g.fillRect(0, 0, w, h);
  // patches of older and newer tar
  for (let i = 0; i < 70; i++) {
    const x = r() * w, y = r() * h, rr = (0.8 + r() * 4) * px;
    const gr = g.createRadialGradient(x, y, 0, x, y, rr);
    const v = r() < 0.5 ? "rgba(20,21,21," : "rgba(58,58,55,";
    gr.addColorStop(0, v + (0.25 + r() * 0.3) + ")"); gr.addColorStop(1, v + "0)");
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rr, rr * (0.4 + r() * 0.8), r() * 3, 0, 7); g.fill();
  }
  // aggregate speckle
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.9; }
  g.putImageData(img, 0, 0);
  // painted lines (bone, worn)
  const m = cv(w, h), mg = m.getContext("2d");
  mg.fillStyle = "#000"; mg.fillRect(0, 0, w, h);
  const P = (x, z) => [(x + W / 2) * px, (z + H / 2) * px];
  g.lineCap = "butt";
  for (const L of lines) {
    const [x0, y0] = P(L[0], L[1]), [x1, y1] = P(L[2], L[3]);
    g.strokeStyle = "rgba(214,206,186,0.62)"; g.lineWidth = 0.12 * px;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    mg.strokeStyle = "#0f0"; mg.lineWidth = 0.12 * px; mg.beginPath(); mg.moveTo(x0, y0); mg.lineTo(x1, y1); mg.stroke();
  }
  // wear the paint
  g.globalCompositeOperation = "multiply";
  for (let i = 0; i < 2600; i++) { g.fillStyle = "rgba(40,40,40," + (0.3 + r() * 0.5) + ")"; g.fillRect(r() * w, r() * h, (0.05 + r() * 0.3) * px, (0.03 + r() * 0.1) * px); }
  g.globalCompositeOperation = "source-over";
  // puddles: low spots, soft edges
  const n1 = noise2(w, h, 6 * px, r), n2 = noise2(w, h, 1.6 * px, r);
  const mi = mg.getImageData(0, 0, w, h), md = mi.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const v = n1(x, y) * 0.75 + n2(x, y) * 0.25;
    md[i] = Math.max(0, Math.min(255, (v - 0.5) * 6 * 255));
    md[i + 2] = 0;
  }
  mg.putImageData(mi, 0, 0);
  const t1 = tex(c, { repeat: false }), t2 = tex(m, { linear: true });
  return { color: t1, mask: t2 };
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
