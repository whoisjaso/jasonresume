// Getting into a car and out again, stepped on a fixed clock and drawn frame by frame, for judging the motion
// where software GL runs at a few frames a second.
//   python3 -m http.server 8765 &   then   node tools/verify/car-sheet.mjs [--every=6] [--cam=side|game]
// Writes tools/verify/out/car-enter-sheet.png (the way in, then the way out, a still every 0.2 s by default) and
// prints the timeline: when the door leaves its latch and shuts, when the hands land, when you're seated.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'tools', 'verify', 'out');
fs.mkdirSync(OUT, { recursive: true });
const URL0 = process.env.STORY_URL || 'http://127.0.0.1:8765/';
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const EVERY = +arg('every', 6), FPS = 30, CAM = arg('cam', 'side');
const exe = [process.env.PW_CHROMIUM, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => f && fs.existsSync(f));
const b = await chromium.launch({ executablePath: exe });
const ctx = await b.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
await ctx.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"on":false}' }));
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(URL0 + '?debug=story&fast=1&sq=0&pr=0.3');
await p.waitForSelector('#intro [data-title-play]', { timeout: 20000 });
await p.waitForSelector('#boot', { state: 'detached', timeout: 15000 }).catch(() => {});
await p.click('[data-title-play]');
const until = (fn, a, ms = 120000) => p.waitForFunction(fn, a, { timeout: ms, polling: 150 }).then(() => true, () => { console.log('timed out: ' + fn.toString().slice(0, 120)); process.exit(1); });
await until(() => window.JG_STORY && window.JG_STORY.debug.state().phase === 'explore');
await until(() => !window.JG_STORY.debug.state().line && window.JG_STORY.debug.cars().length > 0);
const car = (await p.evaluate(() => window.JG_STORY.debug.cars())).find(c => c.id !== 'idle');
await p.evaluate(([x, z, cx, cz]) => window.JG_STORY.debug.put(x, z, Math.atan2(cx - x, cz - z)), [car.stand[0], car.stand[1], car.x, car.z]);
await until(id => window.JG_STORY.debug.state().near === id, 'car:' + car.id, 20000);
// the observer: three quarters from behind on the driver's side, at head height
const view = async () => p.evaluate(([cam]) => {
  const d = window.JG_STORY.debug, v = d.veh(); if (!v || cam !== 'side') return;
  const o = v.object; o.updateMatrixWorld(true);
  const w = (x, y, z) => { const q = o.localToWorld(o.position.clone().set(x, y, z)); return [q.x, q.y, q.z]; };
  d.view(w(2.7, 1.55, -2.3), w(0.7, 0.9, -0.05), 3);
}, [CAM]);
const tiles = [], log = [];
let T = 0;
const frame = async (label, n) => {
  const s = await p.evaluate(([n, dt, draw]) => {
    const d = window.JG_STORY.debug; d.step(n, dt, draw);
    const me = d.you(), v = d.veh(), c = me && me.car, r = me && me.reaches;
    return { state: d.drive().state, mode: c ? c.mode : null, seated: !!(c && c.seated), door: v && v.doors.angle ? +v.doors.angle('driver').toFixed(3) : 0,
      hands: r ? ['l', 'r'].map(s => r[s] ? s + ':' + r[s].hold + ':' + r[s].phase : '').filter(Boolean).join(' ') : '', wheel: c ? +(c.wheelK || 0).toFixed(2) : 0 };
  }, [n, 1 / FPS, !!label]);
  T += n / FPS;
  if (label) { const f = path.join(OUT, `car-sheet-${String(tiles.length).padStart(3, '0')}.png`); await p.screenshot({ path: f }); tiles.push({ f, label: `${label} ${T.toFixed(1)} s` }); }
  return s;
};
const run = async (label, done, max) => {
  T = 0; let prev = null;
  for (let i = 0; i < max; i++) {
    const s = await frame(i % EVERY === 0 ? label : null, 1);
    const k = JSON.stringify([s.mode, s.seated, s.door > 0.002, s.hands, s.wheel >= 0.99]);
    if (k !== prev) { log.push(`${label} ${T.toFixed(2)} s: ${s.state} ${s.mode} seated ${s.seated} door ${s.door} ${s.hands} wheel ${s.wheel}`); prev = k; }
    if (done(s)) { await frame(label, 1); return T; }
  }
  return null;
};
// in
await p.keyboard.press('e');
await until(() => window.JG_STORY.debug.drive().state === 'enter', null, 5000);
await p.evaluate(() => { const d = window.JG_STORY.debug; d.freeze(true); d.quality(1, 1); });
await view();
const tIn = await run('in', s => s.state === 'drive' && s.wheel >= 0.99, FPS * 12);
for (let i = 0; i < 6; i++) await frame(null, 1);
// out
await p.evaluate(() => { const d = window.JG_STORY.debug; d.quality(0, 0.3); d.freeze(false); });
await p.keyboard.press('e');
await until(() => window.JG_STORY.debug.drive().state === 'exit', null, 5000);
await p.evaluate(() => { const d = window.JG_STORY.debug; d.freeze(true); d.quality(1, 1); });
await view();
const tOut = await run('out', s => !s.state, FPS * 12);
await p.evaluate(() => window.JG_STORY.debug.freeze(false));
// the sheet
const cols = 5, W = 384, H = 216;
const html = `<html><body style="margin:0;background:#0A0F0D;color:#EDE7DB;font:12px sans-serif"><div style="display:grid;grid-template-columns:repeat(${cols},${W}px);gap:4px;padding:4px">${tiles.map(t => `<figure style="margin:0"><img src="data:image/png;base64,${fs.readFileSync(t.f).toString('base64')}" style="width:${W}px;height:${H}px;display:block"><figcaption style="padding:2px 4px">${t.label}</figcaption></figure>`).join('')}</div></body></html>`;
const sp = await ctx.newPage();
await sp.setViewportSize({ width: cols * (W + 4) + 4, height: 600 });
await sp.setContent(html);
await sp.screenshot({ path: path.join(OUT, 'car-enter-sheet.png'), fullPage: true });
for (const t of tiles) fs.unlinkSync(t.f);
console.log(log.join('\n'));
console.log(`in: ${tIn == null ? 'did not finish' : tIn.toFixed(2) + ' s'}; out: ${tOut == null ? 'did not finish' : tOut.toFixed(2) + ' s'}; ${tiles.length} stills in tools/verify/out/car-enter-sheet.png`);
if (errs.length) console.log('page errors:\n' + errs.join('\n'));
await b.close();
process.exit(errs.length || tIn == null || tOut == null ? 1 : 0);
