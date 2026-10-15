// Running after getting out of a car, against running before ever getting in: three runs stepped on a fixed clock and
// drawn with the same camera, side by side, for judging the stride (upright, facing the run, no crab, no lean).
//   python3 -m http.server 8765 &   then   node tools/verify/exit-run-sheet.mjs [--every=5]
// Writes tools/verify/out/exit-run-sheet.png: (1) a fresh run straight ahead for 1.5 s, (2) in, out (the whole way),
// then the same run, (3) in, out with a skip, then the same run; each from behind and from the side. Prints, per run,
// the worst gap between the facing and the way the body moves, and how far off upright the body stands.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'tools', 'verify', 'out');
fs.mkdirSync(OUT, { recursive: true });
const URL0 = process.env.STORY_URL || 'http://127.0.0.1:8765/';
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const EVERY = +arg('every', 5), FPS = 30, RUN_S = 1.5;
const exe = [process.env.PW_CHROMIUM, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => f && fs.existsSync(f));
const b = await chromium.launch({ executablePath: exe });
const ctx = await b.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
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
const car0 = (await p.evaluate(() => window.JG_STORY.debug.cars())).find(c => c.id !== 'idle');
// a clear run: the harness's lane, taken the way that faces past a quarter turn either side of +Z (the headings where a
// rotation read back from the car's matrix comes out as x = z = pi), so a stale tilt or a mirrored yaw would show
const lane = await p.evaluate(() => window.JG_STORY.debug.lane(16));
if (!lane) { console.log('no clear lane'); process.exit(1); }
let [lx, lz, ly] = lane;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
if (Math.abs(wrap(ly - Math.PI / 2)) < Math.PI / 2) { lx += Math.sin(ly) * 16; lz += Math.cos(ly) * 16; ly += Math.PI; }
ly = wrap(+arg('yaw', ly));
const step = (n, draw, dt = 1 / FPS) => p.evaluate(([n, dt, draw]) => window.JG_STORY.debug.step(n, dt, draw), [n, dt, !!draw]);
const freeze = on => p.evaluate(on => { const d = window.JG_STORY.debug; d.freeze(on); if (on) d.quality(1, 1); else d.quality(0, 0.3); }, on);
// the camera rides with the body along the run's own heading (not the body's), behind or beside, so a crab or a lean reads
const view = (kind, D) => p.evaluate(([kind, D]) => {
  const d = window.JG_STORY.debug, me = d.you(), fx = Math.sin(D), fz = Math.cos(D), x = me.pos.x, z = me.pos.z;
  if (kind === 'back') d.view([x - fx * 3.4, 1.55, z - fz * 3.4], [x + fx * 0.6, 0.95, z + fz * 0.6], 4);
  else d.view([x + fz * 3.6 + fx * 0.8, 1.25, z - fx * 3.6 + fz * 0.8], [x + fx * 0.8, 0.95, z + fz * 0.8], 4);
}, [kind, D]);
const probe = () => p.evaluate(() => {
  const me = window.JG_STORY.debug.you(), v = me.vel, q = me.group.quaternion;
  // the body's facing as drawn (from its group), the facing it keeps (yaw), and how far its up is from straight up
  const drawn = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
  const upY = 1 - 2 * (q.x * q.x + q.z * q.z);
  return { yaw: me.yaw, drawn, vdir: Math.atan2(v.x, v.z), sp: Math.hypot(v.x, v.z), tilt: Math.acos(Math.max(-1, Math.min(1, upY))), holds: me.reaches ? ['l', 'r'].filter(s => me.reaches[s]).length : 0, inCar: !!me.car };
});
const tiles = { back: [], side: [] }, report = [];
// one run: forward (W) with the run held, for RUN_S seconds, stills from behind and from the side every EVERY frames
async function run(label) {
  // straight ahead is the way the camera looks (the input is camera relative): the body's first frame of the run says
  // where that is; if the camera came to rest looking past the body, the run starts with a turn, and is judged after it
  await p.keyboard.down('Shift'); await p.keyboard.down('w');
  await step(1);
  const D = await p.evaluate(() => window.JG_STORY.debug.you().wantYaw), turn0 = await p.evaluate(() => { const m = window.JG_STORY.debug.you(); return Math.atan2(Math.sin(m.wantYaw - m.yaw), Math.cos(m.wantYaw - m.yaw)); });
  let turned = false;
  let worst = 0, worstDrawn = 0, tilt = 0, holds = 0;
  const n = Math.round(RUN_S * FPS);
  for (let i = 0; i <= n; i++) {
    if (i % EVERY === 0) for (const kind of ['back', 'side']) {
      await view(kind, D); await step(1, true, 0); // (a still frame: the camera moves, nothing else)
      const f = path.join(OUT, `exit-run-${label}-${kind}-${i}.png`); await p.screenshot({ path: f });
      tiles[kind].push({ f, label: `${label} ${(i / FPS).toFixed(2)} s ${kind}` });
    }
    if (i === n) break;
    await view('back', D); await step(1);
    const s = await probe();
    if (Math.abs(wrap(s.yaw - D)) < 0.05) turned = true;
    if (turned && s.sp > 1.2) { worst = Math.max(worst, Math.abs(wrap(s.yaw - s.vdir))); worstDrawn = Math.max(worstDrawn, Math.abs(wrap(s.drawn - s.vdir))); }
    tilt = Math.max(tilt, s.tilt); holds = Math.max(holds, s.holds);
  }
  await p.keyboard.up('w'); await p.keyboard.up('Shift');
  // and to a stop, out of the frame
  await p.evaluate(() => window.JG_STORY.debug.view(null)); await step(20);
  report.push({ label, heading: +D.toFixed(3), turn: +turn0.toFixed(3), yawVsMove: +worst.toFixed(3), drawnVsMove: +worstDrawn.toFixed(3), tilt: +tilt.toFixed(4), holds });
}
async function toCar() {
  const car = (await p.evaluate(() => window.JG_STORY.debug.cars())).find(c => c.id === car0.id);
  await p.evaluate(([x, z, cx, cz]) => window.JG_STORY.debug.put(x, z, Math.atan2(cx - x, cz - z)), [car.stand[0], car.stand[1], car.x, car.z]);
  await until(id => window.JG_STORY.debug.state().near === id, 'car:' + car.id, 20000);
  await p.keyboard.press('e');
  await until(() => window.JG_STORY.debug.drive().state === 'enter', null, 5000);
  await freeze(true);
  for (let i = 0; i < 200; i++) { await step(3); if ((await p.evaluate(() => window.JG_STORY.debug.drive().state)) === 'drive') break; }
  // parked on the lane, its driver's door toward the run (the car's +X is the driver's side)
  await p.evaluate(([x, z, y]) => window.JG_STORY.debug.carPut(x, z, y), [lx, lz, ly - Math.PI / 2]);
  await step(45);
  await freeze(false);
}
async function outOf(skip) {
  await p.keyboard.press('e');
  await until(() => window.JG_STORY.debug.drive().state === 'exit', null, 5000);
  await freeze(true);
  if (skip) { await step(8); await p.evaluate(() => window.JG_STORY.debug.skipCar()); }
  for (let i = 0; i < 300; i++) { await step(3); if (!(await p.evaluate(() => window.JG_STORY.debug.drive().state))) break; }
  await step(3);
}
// (1) fresh: on the lane, facing along it, settled
await p.evaluate(([x, z, y]) => window.JG_STORY.debug.put(x + Math.sin(y) * 1.3, z + Math.cos(y) * 1.3, y), [lx, lz, ly]);
await freeze(true); await step(30);
await run('fresh');
await freeze(false);
// (2) in, out the whole way, run
await toCar(); await outOf(false);
await run('exit');
await freeze(false);
// (3) in, out with a skip, run
await toCar(); await outOf(true);
await run('skip');
await freeze(false);
// the sheet: a row per run and view
const W = 320, H = 180, per = tiles.back.length / 3;
const rows = [];
for (let r = 0; r < 3; r++) for (const kind of ['back', 'side']) rows.push(tiles[kind].slice(r * per, (r + 1) * per));
const html = `<html><body style="margin:0;background:#0A0F0D;color:#EDE7DB;font:12px sans-serif"><div style="display:grid;grid-template-columns:repeat(${per},${W}px);gap:4px;padding:4px">${rows.flat().map(t => `<figure style="margin:0"><img src="data:image/png;base64,${fs.readFileSync(t.f).toString('base64')}" style="width:${W}px;height:${H}px;display:block"><figcaption style="padding:2px 4px">${t.label}</figcaption></figure>`).join('')}</div></body></html>`;
const sp = await ctx.newPage();
await sp.setViewportSize({ width: per * (W + 4) + 4, height: 600 });
await sp.setContent(html);
await sp.screenshot({ path: path.join(OUT, 'exit-run-sheet.png'), fullPage: true });
for (const t of [...tiles.back, ...tiles.side]) fs.unlinkSync(t.f);
for (const r of report) console.log(`${r.label.padEnd(6)} heading ${r.heading} (a turn of ${r.turn} first)  facing vs moving ${r.yawVsMove} rad (drawn ${r.drawnVsMove})  off upright ${r.tilt} rad  hands held ${r.holds}`);
console.log('tools/verify/out/exit-run-sheet.png');
if (errs.length) console.log('page errors:\n' + errs.join('\n'));
const f = report[0], bad = report.slice(1).filter(r => r.drawnVsMove > f.drawnVsMove + 0.05 || r.tilt > 0.01 || r.holds);
if (bad.length) console.log('differs from the fresh run: ' + bad.map(r => r.label).join(', '));
await b.close();
process.exit(errs.length || bad.length ? 1 : 0);
