// After Hours: stills of the Texas plates, in the episode's own renderer.
//   python3 -m http.server 8765 &   then   node tools/story/world/plate-stills.mjs [desktop|phone] [--all]
// Writes tools/verify/out/plate-texture.png (one face, flat, from story/tex.js), plate-car.png (a parked car's rear
// plate on the night lot), plate-car-front.png (a front plate) and plate-lost.png (a lost plate on the gravel by the
// taco truck); with --all, plate-lost-<id>.png for every lost plate where it lies. Prints the plate meshes per set.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = path.join(ROOT, 'tools', 'verify', 'out'); fs.mkdirSync(OUT, { recursive: true });
const vp = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'desktop';
const ALL = process.argv.includes('--all');
const [w, h, mobile] = vp === 'phone' ? [844, 390, true] : [1440, 900, false];
const sfx = vp === 'phone' ? '-phone' : '';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const fonts = path.join(ROOT, 'tools', 'fonts', 'fonts.css');
const errs = [];
const HIDE = '#story .st-hud,#story .st-cap,#story .st-prompt,#story .st-obj,#story .st-hint,#story .st-choices,#story .st-dots,#story .st-stick,#story .st-toast,#story .st-card,#story .st-turn,#story .st-note,#story .st-drv,#story .st-way{display:none!important} #story .st-fade{opacity:0!important}';
async function open(scene) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  if (fs.existsSync(fonts)) await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(fonts, 'utf8') }));
  await ctx.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"on":false}' }));
  const p = await ctx.newPage(); p.setDefaultTimeout(240000);
  p.on('pageerror', e => errs.push(`${scene}: ${e.message}`));
  p.on('console', m => { if (m.type() === 'warning' && /plates/.test(m.text())) errs.push(`${scene}: ${m.text()}`); });
  await p.goto(`http://127.0.0.1:8765/?debug=story&fast=1&pr=1&wq=${vp === 'phone' ? 'lo' : 'hi'}#story/${scene}`);
  await p.waitForSelector('#intro [data-intro-skip]', { timeout: 30000 }).then(() => p.click('#intro [data-intro-skip]')).catch(() => {});
  await p.waitForFunction(s => window.JG_STORY && window.JG_STORY.debug.state().scene === s, scene, { timeout: 180000 });
  await p.waitForFunction(() => { const s = window.JG_STORY.debug.state(); return s.phase === 'explore' || s.phase === 'talk'; }, null, { timeout: 120000 }).catch(() => {});
  await p.evaluate(() => { const d = window.JG_STORY.debug; d.quality(2, 1); d.skip(); for (const who of ['you', 'dell', 'jason', 'renata']) d.place(who, 60, 60, 0); });
  await p.addStyleTag({ content: HIDE });
  // the plate model is in (not the stand-in)
  await p.waitForFunction(async () => { const P = await import('/story/plates.js'); return P.plateGeo().index !== null; }, null, { timeout: 60000 }).catch(() => errs.push(`${scene}: the plate model never loaded`));
  return { ctx, p };
}
async function shot(p, pos, look, name, fov = 30) {
  await p.evaluate(([pos, look, fov]) => window.JG_STORY.debug.view(pos, look, fov), [pos, look, fov]);
  await p.waitForTimeout(2500);
  const f = path.join(OUT, name); await p.screenshot({ path: f, timeout: 240000 }); console.log(f);
}

// the face, flat
{
  const { ctx, p } = await open('lot');
  const png = await p.evaluate(async () => { const T = await import('/story/tex.js'); return T.plateFace('TXJ', 'LMR', 1200).toDataURL(); });
  fs.writeFileSync(path.join(OUT, 'plate-texture.png'), Buffer.from(png.split(',')[1], 'base64')); console.log(path.join(OUT, 'plate-texture.png'));
  const info = await p.evaluate(async () => {
    const W = await import('/story/world.js'), set = W._debug.sets.lot, plates = [];
    set.traverse(o => { if (o.isInstancedMesh && o.geometry === set.userData.tags.im.geometry) plates.push(o.name || (o === set.userData.tags.im ? 'lost' : o === set.userData.tags.gl ? 'glint' : o === set.userData.tags.fly ? 'flyer' : '?') + ':' + o.count); });
    // a parked car near the gate, its back to the lane, and one facing it
    const cars = set.userData.parked, lib = W._debug.carLib;
    const at = (c, k) => { const m = lib[c.kind].mounts[k], e = m.elements, cs = Math.cos(c.yaw), sn = Math.sin(c.yaw); return [c.x + e[12] * cs + e[14] * sn, e[13], c.z - e[12] * sn + e[14] * cs, (k ? -1 : 1) * sn, (k ? -1 : 1) * cs]; };
    const rear = cars.filter(c => Math.abs(c.z - 4.5) < 1 && c.kind === 'sedan').sort((a, b) => Math.abs(a.x + 1.6) - Math.abs(b.x + 1.6))[0] || cars[0];
    const front = cars.filter(c => Math.abs(c.z + 5.6) < 1 && c.kind !== 'truck').sort((a, b) => Math.abs(a.x) - Math.abs(b.x))[0] || cars[1];
    return { plates, rear: at(rear, 1), front: at(front, 1), frontF: at(front, 0), cells: [rear.plateCell, front.plateCell] };
  });
  console.log('lot plate meshes:', info.plates.join(' '), 'cells', info.cells.join(' '));
  const [x, y, z, dx, dz] = info.rear;
  await shot(p, [x + dx * 1.15 + 0.25, y + 0.32, z + dz * 1.15], [x, y, z], `plate-car${sfx}.png`, 34);
  const [fx, fy, fz, fdx, fdz] = info.frontF;
  await shot(p, [fx + fdx * 1.3 - 0.3, fy + 0.45, fz + fdz * 1.3], [fx, fy, fz], `plate-car-front${sfx}.png`, 34);
  // a lost plate on the wet ground
  const lost = await p.evaluate(() => window.JG_STORY.debug.tagAt('tag-taco'));
  if (lost) { const [lx, ly, lz] = lost.p, [sx, sz] = lost.stand, L = Math.hypot(lx - sx, lz - sz); await shot(p, [lx + (sx - lx) / L * 0.75, 0.55, lz + (sz - lz) / L * 0.75], [lx, ly, lz], `plate-lost${sfx}.png`, 34); }
  if (ALL) for (const id of ['tag-wiper', 'tag-dumpster', 'tag-bus', 'tag-laundry']) {
    if (id === 'tag-laundry') await p.evaluate(async () => { const W = await import('/story/world.js'); const x = W._debug.sets.lot.userData.spots['laundry-door']; if (x && x.use) { x.on = true; x.use({ kind: x.kind, on: true }); } });
    const t = await p.evaluate(id => window.JG_STORY.debug.tagAt(id), id); if (!t) { errs.push(`no ${id}`); continue; }
    const [lx, ly, lz] = t.p, [sx, sz] = t.stand, L = Math.hypot(lx - sx, lz - sz) || 1;
    await shot(p, [sx + (sx - lx) / L * 0.4, ly + 1.0, sz + (sz - lz) / L * 0.4], [lx, ly, lz], `plate-lost-${id}${sfx}.png`, 40);
  }
  await ctx.close();
}
if (ALL) for (const [scene, ids] of [['office', ['tag-coffee', 'tag-desk', 'tag-cabinet', 'tag-arcade']], ['memory', ['tag-table', 'tag-stacks', 'tag-sill']]]) {
  const { ctx, p } = await open(scene);
  for (const id of ids) {
    const t = await p.evaluate(id => window.JG_STORY.debug.tagAt(id), id); if (!t) { errs.push(`no ${id}`); continue; }
    const [lx, ly, lz] = t.p, [sx, sz] = t.stand, L = Math.hypot(lx - sx, lz - sz) || 1;
    await shot(p, [sx + (sx - lx) / L * 0.3, Math.max(ly + 0.9, 1.2), sz + (sz - lz) / L * 0.3], [lx, ly, lz], `plate-lost-${id}${sfx}.png`, 40);
  }
  await ctx.close();
}
await b.close();
if (errs.length) { console.log('PROBLEMS:\n  ' + errs.join('\n  ')); process.exit(1); }
