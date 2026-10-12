// After Hours: stills of the cars you can drive, in the episode's own renderer.
//   python3 -m http.server 8765 &   then   node tools/story/world/drive-stills.mjs <tag> [desktop|phone|all]
// Opens #story/lot, takes the lot set from story/world.js, drives the cars with story/vehicle.js and holds the
// camera on fixed views: a door open onto the cabin, the front wheels steered, the lights (head, tail, brake,
// reverse), a car mid-slide on the lot, and one out on Almeda Genoa Road past the gate.
// Writes tools/verify/out/drive-world-<tag>-<view>-<vp>.png.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = path.join(ROOT, 'tools', 'verify', 'out'); fs.mkdirSync(OUT, { recursive: true });
const tag = process.argv[2] || 'now';
const vps = process.argv[3] && process.argv[3] !== 'all' ? [process.argv[3]] : ['desktop', 'phone'];
const only = process.argv.slice(4);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const fonts = path.join(ROOT, 'tools', 'fonts', 'fonts.css');
const errs = [];
for (const vp of vps) {
  const [w, h, mobile] = vp === 'phone' ? [844, 390, true] : [1440, 900, false];
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  if (fs.existsSync(fonts)) await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(fonts, 'utf8') }));
  await ctx.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"on":false}' }));
  const p = await ctx.newPage(); p.setDefaultTimeout(240000);
  p.on('pageerror', e => errs.push(`${vp}: ${e.message}`)); p.on('response', r => { if (r.status() >= 400) console.log(`  [${vp}] HTTP ${r.status()} ${r.url()}`); });
  p.on('console', m => { if (m.type() === 'error') console.log(`  [${vp}] ${m.text().slice(0, 300)}`); });
  await p.goto(`http://127.0.0.1:8765/?debug=story&fast=1&pr=1&wq=${vp === 'phone' ? 'lo' : 'hi'}#story/lot`);
  await p.waitForSelector('#intro [data-intro-skip]', { timeout: 30000 }).then(() => p.click('#intro [data-intro-skip]')).catch(() => {});
  await p.waitForFunction(() => window.JG_STORY && window.JG_STORY.debug.state().scene === 'lot', null, { timeout: 120000 });
  await p.waitForFunction(() => { const s = window.JG_STORY.debug.state(); return s.phase === 'explore' || s.phase === 'talk'; }, null, { timeout: 90000 }).catch(() => {});
  await p.evaluate(async () => {
    window.JG_STORY.debug.quality(2, 1); window.JG_STORY.debug.box(0); window.JG_STORY.debug.skip();
    const W = await import('/story/world.js'); const V = await import('/story/vehicle.js');
    const set = W._debug.sets.lot; await set.userData.ready;
    const by = id => set.userData.drivable.find(c => c.id === id);
    window.__drive = { set, V, cars: {} };
    for (const c of set.userData.drivable) if (!window.__drive.cars[c.id]) window.__drive.cars[c.id] = V.createVehicle(set, c);
    // nobody in shot by the cars
    for (const who of ['you', 'dell']) window.JG_STORY.debug.place(who, 60, 60, 0);
  });
  await p.addStyleTag({ content: '#story .st-hud,#story .st-cap,#story .st-prompt,#story .st-obj,#story .st-hint,#story .st-choices,#story .st-dots,#story .st-stick,#story .st-toast,#story .st-card,#story .st-turn,#story .st-note{display:none!important} #story .st-fade{opacity:0!important}' });
  // each view: set the cars up, then a camera (in the car's frame: right, up, forward from its centre)
  const VIEWS = {
    door: `(() => { const v = D.cars.car; v.reset(-1.6, -0.6, Math.PI / 2 + 0.25); v.engine.start(); v.update(0.2, {}); v.doors.open('driver', 1); v.lights.set({ head: false, cluster: true }); return cam(v, [-2.5, 1.5, 0.9], [0.3, 0.85, -0.2]); })()`,
    cabin: `(() => { const v = D.cars.car; return cam(v, [-1.35, 1.3, -0.1], [0.4, 0.95, 0.75]); })()`,
    steer: `(() => { const v = D.cars.truck; v.reset(4.0, 9.5, -Math.PI / 2 + 0.3); v.engine.start(); v.update(0.5, { steer: 1 }); v.lights.set({ head: true }); return cam(v, [2.6, 0.9, 4.2], [0, 0.45, 1.4]); })()`,
    lights: `(() => { const v = D.cars.idle; v.lights.set({ head: true }); v.update(0.05, {}); return cam(v, [1.5, 1.0, 6.5], [0, 0.6, 0]); })()`,
    brake: `(() => { const v = D.cars.idle; v.reset(v.pose.x, v.pose.z, v.pose.yaw); v.lights.auto = false; v.lights.set({ head: true, brake: 1, reverse: 1 }); return cam(v, [-1.2, 1.1, -6.2], [0, 0.7, 0]); })()`,
    slide: `(() => { const v = D.cars.car; v.doors.close('driver'); v.lights.set({ head: true }); v.reset(-40, 30.5, Math.PI / 2); v.engine.start(); for (let i = 0; i < 190; i++) v.update(1 / 60, { throttle: 1 }); for (let i = 0; i < 26; i++) v.update(1 / 60, { throttle: 0.7, steer: -1, handbrake: i < 20 ? 1 : 0 }); const p = v.pose; return { p: [p.x - 7.5, 2.0, p.z - 4.5], t: [p.x + 0.5, 0.6, p.z], slip: v.slip, speed: v.speed }; })()`,
    driver: `(() => { const v = D.cars.car; v.reset(-1.6, -0.6, Math.PI / 2 + 0.25); v.engine.start(); v.lights.set({ head: true }); v.update(0.1, { steer: 0.3 }); const s = v.seat.position; return cam(v, [-s.x, s.y + 0.74, s.z - 0.16], [-s.x + 0.05, s.y + 0.5, s.z + 3]); })()`,
    road: `(() => { const v = D.cars.truck; D.set.userData.gate.position.x = -3.2; v.reset(6, 30.5, Math.PI / 2 + 0.05); v.lights.set({ head: true }); v.update(0.1, {}); return cam(v, [-1.5, 1.5, -8.5], [0, 0.9, 2]); })()`
  };
  for (const [name, code] of Object.entries(VIEWS)) {
    if (only.length && !only.includes(name)) continue;
    const view = await p.evaluate(`(() => { const D = window.__drive; const cam = (v, eye, look) => { const q = v.pose, s = Math.sin(q.yaw), c = Math.cos(q.yaw);
      const W = ([r, u, f]) => [q.x - r * c + f * s, u, q.z + r * s + f * c]; return { p: W(eye), t: W(look) }; }; return ${code}; })()`);
    await p.evaluate(v => window.JG_STORY.debug.view(v.p, v.t, 8), view);
    await p.waitForTimeout(1600);
    const f = path.join(OUT, `drive-world-${tag}-${name}-${vp}.png`);
    await p.screenshot({ path: f, timeout: 240000 });
    console.log(f, view.slip != null ? `slip ${view.slip.toFixed(2)} speed ${view.speed.toFixed(1)}` : '');
  }
  await ctx.close();
}
await b.close();
if (errs.length) { console.log('ERRORS\n' + errs.join('\n')); process.exitCode = 1; }
