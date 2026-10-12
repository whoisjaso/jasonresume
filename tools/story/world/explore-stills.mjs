// After Hours: stills of the open world and the things in it, in the episode's own renderer.
//   python3 -m http.server 8765 &   then   node tools/story/world/explore-stills.mjs [desktop|phone|all] [view ...]
// Opens each set by its deep link, uses a few things (lights, lids, doors, the crosswalk) so their state shows, and
// holds the camera on fixed views. Writes tools/verify/out/explore-<view>-<vp>.png.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = path.join(ROOT, 'tools', 'verify', 'out'); fs.mkdirSync(OUT, { recursive: true });
const vps = process.argv[2] && process.argv[2] !== 'all' ? [process.argv[2]] : ['desktop', 'phone'];
const only = process.argv.slice(3);
// [scene, view, camera, target, things to use first]
const VIEWS = [
  ['lot', 'road', [-2, 1.7, 27.5], [14, 1.6, 41]],
  ['lot', 'bus', [-13.5, 1.6, 34.5], [-18, 1.2, 40]],
  ['lot', 'crosswalk', [-4.5, 1.6, 28.5], [-9.6, 1.6, 38], ['crosswalk-0']],
  ['lot', 'shop', [11, 1.7, 34], [17, 1.6, 41]],
  ['lot', 'gas', [28, 2.0, 34], [35, 2.0, 47]],
  ['lot', 'empty', [-24, 1.8, 35.5], [-30, 2.5, 46]],
  ['lot', 'dumpster', [-11.4, 1.5, -15.8], [-13.8, 0.8, -20.6], ['dumpster']],
  ['lot', 'vending', [18.6, 1.6, -17.2], [15.8, 1.1, -19.6], ['vending']],
  ['office', 'fridge', [-4.4, 1.6, 1.2], [-6.5, 1.0, 2.0], ['fridge', 'drawer']],
  ['office', 'exit', [-3.0, 1.6, 2.8], [-6.9, 1.2, 4.2]],
  ['memory', 'doors', [0, 1.7, 3.6], [0, 1.6, 8.9]]
];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const fonts = path.join(ROOT, 'tools', 'fonts', 'fonts.css');
const errs = [];
for (const vp of vps) {
  const [w, h, mobile] = vp === 'phone' ? [844, 390, true] : [1440, 900, false];
  for (const scene of [...new Set(VIEWS.map(v => v[0]))]) {
    const views = VIEWS.filter(v => v[0] === scene && (!only.length || only.includes(v[1])));
    if (!views.length) continue;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
    if (fs.existsSync(fonts)) await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(fonts, 'utf8') }));
    await ctx.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"on":false}' }));
    const p = await ctx.newPage(); p.setDefaultTimeout(240000);
    p.on('pageerror', e => errs.push(`${vp} ${scene}: ${e.message}`));
    await p.goto(`http://127.0.0.1:8765/?debug=story&fast=1&pr=1&wq=${vp === 'phone' ? 'lo' : 'hi'}#story/${scene}`);
    await p.waitForSelector('#intro [data-intro-skip]', { timeout: 30000 }).then(() => p.click('#intro [data-intro-skip]')).catch(() => {});
    const ok = await p.waitForFunction(s => window.JG_STORY && window.JG_STORY.debug.state().scene === s, scene, { timeout: 120000 }).then(() => true, () => false);
    if (!ok) { errs.push(`${vp} ${scene}: did not open`); await ctx.close(); continue; }
    await p.waitForFunction(() => { const s = window.JG_STORY.debug.state(); return s.phase === 'explore' || s.phase === 'talk'; }, null, { timeout: 90000 }).catch(() => {});
    await p.evaluate(() => { window.JG_STORY.debug.quality(2, 1); window.JG_STORY.debug.box(0); window.JG_STORY.debug.skip(); for (const who of ['you', 'dell', 'jason', 'renata']) window.JG_STORY.debug.place(who, 60, 60, 0); });
    await p.addStyleTag({ content: '#story .st-hud,#story .st-cap,#story .st-prompt,#story .st-obj,#story .st-hint,#story .st-choices,#story .st-dots,#story .st-stick,#story .st-toast,#story .st-card,#story .st-turn,#story .st-note,#story .st-drv{display:none!important} #story .st-fade{opacity:0!important}' });
    for (const [, name, pos, look, use] of views) {
      await p.evaluate(async ([scene, use]) => { const W = await import('/story/world.js'); const set = W._debug.sets[scene]; for (const id of use || []) { const x = set.userData.spots[id]; if (x && x.use) { x.on = true; x.use({ kind: x.kind, on: true }); } } if (use && use.length && set.userData.tick) for (let i = 0; i < 40; i++) set.userData.tick(0.05, { player: null, t: i * 0.05 }); }, [scene, use]);
      await p.evaluate(([pos, look]) => window.JG_STORY.debug.view(pos, look, 30), [pos, look]);
      await p.waitForTimeout(2200);
      const f = path.join(OUT, `explore-${name}-${vp}.png`);
      await p.screenshot({ path: f, timeout: 240000 });
      console.log(f);
    }
    await ctx.close();
  }
}
await b.close();
if (errs.length) { console.log('ERRORS\n' + errs.join('\n')); process.exitCode = 1; }
