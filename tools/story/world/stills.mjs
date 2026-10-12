// After Hours: stills of the sets for the realism pass.
//   python3 -m http.server 8765 &   then   node tools/story/world/stills.mjs <tag> [desktop|phone] [scene ...]
// Opens each scene by its deep link, hides the HUD and the cast's prompts, holds the
// camera on fixed views (debug.view) and writes tools/verify/out/real-world-<tag>-<view>-<vp>.png.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = path.join(ROOT, 'tools', 'verify', 'out'); fs.mkdirSync(OUT, { recursive: true });
const tag = process.argv[2] || 'now';
const vps = process.argv[3] && process.argv[3] !== 'all' ? [process.argv[3]] : ['desktop', 'phone'];
const only = process.argv.slice(4);
const VIEWS = {
  lot: [
    ['wide', [-14, 2.6, 22], [6, 1.2, -6]],
    ['car', [-1.2, 1.25, 1.2], [-3.6, 0.8, 3.9]],
    ['puddle', [-4.5, 1.1, 8.0], [-1.2, 0.2, 11.0]],
    ['showroom', [4, 1.7, -7.5], [4, 2.0, -18]],
    ['jason', [6.4, 1.5, -9.3], [9.4, 1.45, -12.0]],
    ['gate', [2, 1.7, 13], [-2, 1.2, 22]],
    ['face', [9.9, 1.68, -13.6], [10.2, 1.62, -14.6]]
  ],
  office: [['face', [-0.91, 1.68, 0.37], [-1.3, 1.62, -0.55]], ['room', [4.8, 1.6, 3.9], [-1.5, 1.0, -2.5]], ['desk', [0.6, 1.4, 0.6], [-1.2, 0.9, -2.0]], ['window', [-1, 1.5, -0.5], [0.5, 1.6, 5]]],
  memory: [['room', [0, 1.7, 7.5], [0, 1.2, -4]], ['desk', [0.4, 1.4, 4.8], [0.2, 0.85, 3.0]]],
  keys: [['wide', [-6, 1.8, 6], [8, 1.5, -14]]]
};
const exe = [process.env.PW_CHROMIUM, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => f && fs.existsSync(f));
const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const fonts = path.join(ROOT, 'tools', 'fonts', 'fonts.css');
const errs = [];
for (const vp of vps) {
  const [w, h, mobile] = vp === 'phone' ? [844, 390, true] : [1440, 900, false];
  for (const scene of Object.keys(VIEWS)) {
    if (only.length && !only.includes(scene)) continue;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
    if (fs.existsSync(fonts)) {
      await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(fonts, 'utf8') }));
      await ctx.route('**/pwfonts/*', r => r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(path.join(ROOT, 'tools', 'fonts', r.request().url().split('/').pop())) }));
    }
    await ctx.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"on":false}' }));
    const p = await ctx.newPage(); p.setDefaultTimeout(240000);
    p.on('pageerror', e => errs.push(`${vp} ${scene}: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' || /\[world\]/.test(m.text())) console.log(`  [${vp} ${scene}] ${m.type()}: ${m.text().slice(0, 300)}`); });
    let bytes = 0; p.on('response', async r => { try { const l = +(r.headers()['content-length'] || 0); bytes += l; } catch (e) {} });
    await p.goto(`http://127.0.0.1:8765/?debug=story&fast=1&pr=1#story/${scene}`);
    await p.waitForSelector('#intro [data-intro-skip]', { timeout: 30000 }).then(() => p.click('#intro [data-intro-skip]')).catch(() => {});
    const ok = await p.waitForFunction(s => window.JG_STORY && window.JG_STORY.debug.state().scene === s, scene, { timeout: 90000 }).then(() => true, () => false);
    if (!ok) { errs.push(`${vp} ${scene}: did not open`); await ctx.close(); continue; }
    await p.waitForFunction(() => { const s = window.JG_STORY.debug.state(); return s.phase === 'explore' || s.phase === 'talk'; }, null, { timeout: 90000 }).catch(() => {});
    await p.evaluate(() => { window.JG_STORY.debug.quality(2, 1); window.JG_STORY.debug.box(0); });
    await p.addStyleTag({ content: '#story .st-hud,#story .st-cap,#story .st-prompt,#story .st-obj,#story .st-hint,#story .st-choices,#story .st-dots,#story .st-stick,#story .st-toast,#story .st-card,#story .st-turn,#story .st-note{display:none!important} #story .st-fade{opacity:0!important}' });
    for (const [name, pos, look] of VIEWS[scene]) {
      await p.evaluate(([pos, look]) => window.JG_STORY.debug.view(pos, look, 8), [pos, look]);
      await p.waitForTimeout(1500);
      const f = path.join(OUT, `real-world-${tag}-${scene}-${name}-${vp}.png`);
      await p.screenshot({ path: f, timeout: 240000 });
      console.log(f);
    }
    const perf = await p.evaluate(async () => { const P = await import('/story/paint.js'); return { ...window.JG_STORY.debug.bench(), envOn: P.U.uEnvOn.value, env: !!P.U.uEnv.value }; });
    console.log(`  ${vp} ${scene} bench`, JSON.stringify(perf), 'bytes', bytes);
    await ctx.close();
  }
}
await b.close();
if (errs.length) { console.log('ERRORS\n' + errs.join('\n')); process.exitCode = 1; }
