// After Hours: the phone performance probe. Opens each set on a phone (touch, DPR 3, the CPU slowed 4x through
// CDP to stand in for a mid phone) without the debug flag (so nothing waits on the GPU), and measures, per drawn
// frame: the main thread's time in the frame callback (JS plus three.js submitting to WebGL), draw calls,
// triangles, and the texture memory uploaded by the time the scene is up (textures and render targets, at 4 bytes a texel). The quality main.js picked for the phone is held; the pixel ratio is
// pinned tiny so software GL keeps up (GPU fill is not measured, the CPU work per draw is the same). Software GL makes GPU time meaningless here, so it isn't reported.
//   python3 -m http.server 8765 &   then   node tools/story/world/perf.mjs [tag] [land|port|desk] [scene ...]
// Writes tools/verify/out/real-world-perf-<tag>-<scene>-<vp>[-phone].png and prints a table (and JSON with --json).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = path.join(ROOT, 'tools', 'verify', 'out'); fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const tag = args[0] || 'now';
const VPS = { land: [844, 390, 3, true], port: [390, 844, 3, true], desk: [1440, 900, 1, false] };
const vps = args[1] && args[1] !== 'all' ? args[1].split(',') : ['land', 'port'];
const scenes = args.slice(2).length ? args.slice(2) : ['lot', 'office', 'memory', 'keys'];
const SECS = +(process.env.PERF_SECS || 6);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const fonts = path.join(ROOT, 'tools', 'fonts', 'fonts.css');
// counts every draw and upload, and times each animation-frame callback
const PROBE = () => {
  const P = window.__perf = { frames: [], cur: null, tex: 0, on: false };
  const wrapCtx = proto => {
    if (!proto) return;
    const draw = (name, tri) => { const f = proto[name]; if (!f) return; proto[name] = function (...a) { if (P.cur) { P.cur.calls++; P.cur.tris += tri(a); } return f.apply(this, a); }; };
    const T = m => (m === 4 ? 1 / 3 : 0);
    draw('drawElements', a => a[1] * T(a[0])); draw('drawArrays', a => a[2] * T(a[0]));
    draw('drawElementsInstanced', a => a[1] * a[4] * T(a[0])); draw('drawArraysInstanced', a => a[2] * a[3] * T(a[0]));
    const up = (name, bytes) => { const f = proto[name]; if (!f) return; proto[name] = function (...a) { try { P.tex += bytes(a); } catch (e) {} return f.apply(this, a); }; };
    const px = (a) => { for (const v of a) if (v && (v.width || v.videoWidth)) return (v.videoWidth || v.width) * (v.videoHeight || v.height) * 4; return a[3] * a[4] * 4; };
    up('texImage2D', a => (typeof a[3] === 'number' && typeof a[4] === 'number' ? a[3] * a[4] * 4 : px(a)));
    up('texStorage2D', a => a[3] * a[4] * 4 * (a[1] > 1 ? 1.33 : 1));
    up('compressedTexImage2D', a => (a[6] ? a[6].byteLength : 0));
  };
  wrapCtx(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
  wrapCtx(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(t => {
    if (!P.on) return cb(t);
    const fr = P.cur = { calls: 0, tris: 0 }; const a = performance.now();
    try { cb(t); } finally { fr.ms = performance.now() - a; P.cur = null; if (fr.calls) P.frames.push(fr); }
  });
};
const rows = [];
for (const vp of vps) {
  const [w, h, dpr, mobile] = VPS[vp];
  for (const scene of scenes) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
    if (fs.existsSync(fonts)) await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(fonts, 'utf8') }));
    await ctx.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"on":false}' }));
    await ctx.addInitScript(PROBE);
    const p = await ctx.newPage(); p.setDefaultTimeout(240000);
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(`http://127.0.0.1:8765/#story/${scene}`);
    await p.waitForSelector('#intro [data-intro-skip]', { timeout: 30000 }).then(() => p.click('#intro [data-intro-skip]')).catch(() => {});
    const ok = await p.waitForFunction(s => window.JG_STORY && window.JG_STORY.debug.state().scene === s, scene, { timeout: 180000 }).then(() => true, () => false);
    if (!ok) { console.log(vp, scene, 'did not open', errs.join(' | ')); await ctx.close(); continue; }
    await p.waitForFunction(() => { const s = window.JG_STORY.debug.state(); return s.phase === 'explore' || s.phase === 'talk'; }, null, { timeout: 120000 }).catch(() => {});
    await p.waitForTimeout(2500);
    // hold the quality where main.js puts a phone (no adaptive steps mid-measure), and keep it drawing every frame
    // software GL can't keep up with a phone's pixels, and the frame callback would wait on it: render a
    // postage stamp (the same draws, the same shaders bound, the same JS) so the CPU side is what's measured
    const st0 = await p.evaluate(() => window.JG_STORY.debug.state());
    await p.evaluate(q => window.JG_STORY.debug.quality(q, 0.12), st0.quality);
    const cdp = await ctx.newCDPSession(p);
    if (mobile) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.waitForTimeout(800);
    await p.evaluate(() => { window.__perf.frames = []; window.__perf.on = true; window.__perf.texAt = window.__perf.tex; });
    // keep the camera moving a little so the idle-rest path doesn't skip frames
    const t0 = Date.now();
    while (Date.now() - t0 < SECS * 1000) { await p.evaluate(q => { const s = window.JG_STORY.debug.state(); if (s.quality !== q || s.pixelRatio !== 0.12) window.JG_STORY.debug.quality(q, 0.12); }, st0.quality); await p.mouse.move(w / 2 + Math.sin(Date.now() / 300) * 40, h / 2); await p.waitForTimeout(400); }
    const r = await p.evaluate(() => { const P = window.__perf; P.on = false; const f = P.frames.slice(2); const ms = f.map(x => x.ms).sort((a, b) => a - b);
      const avg = k => f.reduce((s, x) => s + x[k], 0) / Math.max(1, f.length);
      return { n: f.length, ms: avg('ms'), p50: ms[Math.floor(ms.length * 0.5)] || 0, p90: ms[Math.floor(ms.length * 0.9)] || 0, calls: avg('calls'), tris: avg('tris'), texMB: P.texAt / 1048576 }; });
    if (mobile) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    // the still at the phone's own quality and pixel ratio, as main.js had it
    await p.evaluate(([q, pr]) => window.JG_STORY.debug.quality(q, pr), [st0.quality, st0.pixelRatio]); await p.waitForTimeout(3500);
    const f = path.join(OUT, `real-world-perf-${tag}-${scene}-${vp}${mobile ? '-phone' : ''}.png`);
    await p.screenshot({ path: f, timeout: 240000 });
    const row = { tag, vp, scene, q: st0.quality, pr: st0.pixelRatio, ...r, errs: errs.length };
    rows.push(row);
    console.log(`${vp.padEnd(5)} ${scene.padEnd(7)} q${row.q} pr${(+row.pr).toFixed(2)}  frames ${String(r.n).padStart(3)}  cpu ${r.ms.toFixed(1).padStart(5)} ms (p50 ${r.p50.toFixed(1)}, p90 ${r.p90.toFixed(1)})  calls ${r.calls.toFixed(0).padStart(4)}  tris ${(r.tris / 1000).toFixed(0).padStart(5)}k  tex ${r.texMB.toFixed(1)} MB${errs.length ? '  ERR ' + errs[0].slice(0, 120) : ''}`);
    await ctx.close();
  }
}
await b.close();
if (process.argv.includes('--json')) fs.writeFileSync(path.join(OUT, `real-world-perf-${tag}.json`), JSON.stringify(rows, null, 1));
