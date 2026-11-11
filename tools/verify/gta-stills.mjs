// After Hours: the look, in stills. Renders the night lot, the street, a car with its lamps on and the
// morning lot at real resolution (1440 wide at pixel ratio 1 and 2, and an upright phone), and prints the
// draw calls and frame cost of each view.
//   python3 -m http.server 8765 &   then   node tools/verify/gta-stills.mjs <tag> [desktop|desktop2|portrait]
// Stills land in tools/verify/out/gta-<tag>-<view>-<shot>.png.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'tools', 'verify', 'out');
fs.mkdirSync(OUT, { recursive: true });
const URL0 = process.env.STORY_URL || 'http://127.0.0.1:8765/';
const tag = process.argv[2] || 'now', only = process.argv[3];
const exe = [process.env.PW_CHROMIUM, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => f && fs.existsSync(f));
const b = await chromium.launch({ executablePath: exe });
const fonts = path.join(ROOT, 'tools', 'fonts', 'fonts.css');
const VIEWS = [['desktop', 1440, 900, false, 1, 'wq=hi&sq=2&pr=1'], ['desktop2', 1440, 900, false, 2, 'wq=hi&sq=2&pr=2'], ['portrait', 390, 844, true, 2, 'wq=lo&sq=1&pr=1.25']];
const until = (p, fn, arg, ms = 300000) => p.waitForFunction(fn, arg, { timeout: ms, polling: 150 }).then(() => true, () => false);
const toExplore = p => until(p, () => { if (!window.JG_STORY) return false; const d = window.JG_STORY.debug, s = d.state(); if (s.line) d.skip(); else if (s.choices) d.choose(0); else if (s.phase === 'sheet') d.desk(); else if (s.phase === 'close') d.closeAll(); return s.phase === 'explore' && !s.line && !s.busy; });
const rows = [];
for (const [vname, w, h, mobile, dsf, q] of VIEWS) {
  if (only && only !== vname) continue;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: dsf });
  if (fs.existsSync(fonts)) {
    await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(fonts, 'utf8') }));
    await ctx.route('**/pwfonts/*', r => r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(path.join(ROOT, 'tools', 'fonts', r.request().url().split('/').pop())) }));
  }
  await ctx.route(/calendly\.com/, r => r.abort());
  await ctx.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"on":false}' }));
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log(`${vname} pageerror: ${e.message}`));
  const open = async hash => {
    await p.goto('about:blank');
    await p.goto(URL0 + '?debug=story&fast=1&' + q + (hash || ''));
    if (hash) { await p.waitForSelector('#intro [data-intro-skip]', { timeout: 60000 }).catch(() => {}); await p.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).catch(() => {}); await p.click('#intro [data-intro-skip]').catch(() => {}); }
    else { await p.waitForSelector('#intro [data-title-play]', { timeout: 30000 }); await p.waitForSelector('#boot', { state: 'detached', timeout: 15000 }).catch(() => {}); if (mobile) await p.tap('[data-title-play]'); else await p.click('[data-title-play]'); }
    await toExplore(p);
    const t = await p.$('.st-turn.is-on .st-turn__stay'); if (t) { await p.tap('.st-turn__stay').catch(() => p.click('.st-turn__stay')); await p.waitForTimeout(400); }
    await toExplore(p);
  };
  const shot = async (name, clean) => {
    // settle a few frames on a fixed clock, then measure and draw
    const m = await p.evaluate(clean => { const d = window.JG_STORY.debug; d.freeze(true); d.step(24, 1 / 30, false); d.step(1, 1 / 30); const b = d.bench(); d.step(1, 1 / 30); const s = d.stats ? d.stats() : null; if (clean) document.getElementById('story').classList.add('is-still'); return { ...b, all: s }; }, clean);
    await p.waitForTimeout(700); // (the HUD's own fades)
    await p.screenshot({ path: path.join(OUT, `gta-${tag}-${vname}-${name}.png`), timeout: 240000 });
    await p.evaluate(() => { window.JG_STORY.debug.freeze(false); document.getElementById('story').classList.remove('is-still'); });
    rows.push(`${vname} ${name}: ` + (m.all ? `${m.all.calls} draw calls a frame (mirror ${m.all.mirror}, scene ${m.all.scene}, the rest the lens), ${m.all.tris} tris; ` : '') + `scene and lens ${m.post} ms, mirror ${m.refl} ms at ${m.w}x${m.h} (software GL)`);
  };
  const put = (x, z, yaw, cy, pitch) => p.evaluate(([x, z, yaw, cy, pitch]) => { const d = window.JG_STORY.debug; d.put(x, z, yaw); if (d.cam) d.cam(cy, pitch); }, [x, z, yaw, cy, pitch]);
  // the night lot: from the gate toward the showroom; then among the cars; then the street
  await open('#story/lot');
  await put(1.5, 15, Math.PI, null, null); await shot('night-lot');
  await put(-4, 2, Math.PI * 0.75, null, null); await shot('night-cars');
  await put(-5, 23.6, Math.PI / 2, null, null); await shot('night-street');
  // a passer-by, and what they say when you ask (the build under test may not have them)
  if (await p.evaluate(() => !!window.JG_STORY.debug.amb)) {
    await until(p, () => window.JG_STORY.debug.amb().list.some(n => n.id === 'walker' && n.live), null, 90000);
    const ok = await p.evaluate(() => { const d = window.JG_STORY.debug, n = d.amb().list.find(x => x.id === 'walker'); if (!n) return false; d.put(n.x - 1.5, n.z + 0.5, Math.atan2(1.5, -0.5)); d.step(6, 1 / 30, false); d.interact('amb:walker'); return !!d.amb().cap; });
    if (ok) await shot('npc-talk');
  }
  // a car, lamps on
  const car = await p.evaluate(() => { const c = window.JG_STORY.debug.cars(); return c.find(x => x.id !== 'idle') || c[0]; });
  if (car) {
    await p.evaluate(([x, z, cx, cz]) => window.JG_STORY.debug.put(x, z, Math.atan2(cx - x, cz - z)), [car.stand[0], car.stand[1], car.x, car.z]);
    if (await until(p, id => window.JG_STORY.debug.state().near === id, 'car:' + car.id, 20000)) {
      if (mobile) await p.tap('.st-act', { force: true }); else await p.keyboard.press('e');
      await until(p, () => window.JG_STORY.debug.drive().state === 'enter', null, 8000);
      await p.waitForTimeout(800); await p.evaluate(() => window.JG_STORY.debug.skipCar());
      if (await until(p, () => window.JG_STORY.debug.drive().state === 'drive', null, 120000)) {
        const lane = await p.evaluate(() => window.JG_STORY.debug.lane(14));
        if (lane) await p.evaluate(l => window.JG_STORY.debug.carPut(l[0], l[1], l[2]), lane);
        await shot('night-drive');
      }
    }
  }
  // the morning lot
  await open('#story/sale');
  await shot('morning-lot');
  await ctx.close();
}
await b.close();
console.log(rows.join('\n'));
fs.writeFileSync(path.join(OUT, `gta-${tag}-numbers.txt`), rows.join('\n') + '\n', { flag: only ? 'a' : 'w' });
