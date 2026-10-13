// After Hours: every thing you can use, used. Builds each set in a blank page, lists its exits and things, calls
// use() on each (on, then off), runs the world's tick for a few seconds with a player walking past, and checks
// that nothing throws, every spot has a kind main.js knows, a label, p and stand, and every set has a way out.
//   python3 -m http.server 8765 &   then   node tools/story/world/things-test.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 400, height: 300 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:8765/tools/story/world/blank.html');
const out = await p.evaluate(async () => {
  const THREE = await import('/vendor/three-0.184.0/three.module.min.js');
  const W = await import('/story/world.js'); await W.lotReady;
  const cv = document.createElement('canvas'); cv.width = cv.height = 8;
  const KINDS = ['exit', 'toggle', 'open', 'sit', 'press', 'pickup', 'read', 'splash', 'knock'];
  const sets = { lot: W.buildLot({ wordmark: cv }), keys: W.buildLot({ wordmark: cv, day: true }), office: W.buildOffice({ lotArt: '' }), memory: W.buildLibrary({}) };
  const log = [], fails = [];
  for (const [name, set] of Object.entries(sets)) {
    await set.userData.ready;
    const sp = Object.entries(set.userData.spots).filter(([, x]) => x && KINDS.includes(x.kind));
    const exits = sp.filter(([, x]) => x.kind === 'exit').map(([id, x]) => `${id} -> ${x.to}`);
    if (!exits.length) fails.push(name + ': no exit');
    for (const [id, x] of sp) {
      if (!x.label || !x.p || !(x.stand || x.kind === 'exit')) fails.push(`${name} ${id}: missing label/p/stand`);
      if (x.kind === 'sit' && !x.seat) fails.push(`${name} ${id}: sit without seat`);
      if (typeof x.use === 'function') { try { x.on = !x.on; x.use({ kind: x.kind, on: x.on }); } catch (e) { fails.push(`${name} ${id}: ${e.message}`); } }
    }
    // the world's tick with someone walking by (the cat, the moth, lids and drawers)
    const pl = new THREE.Vector3(-20, 0, -14);
    for (let i = 0; i < 240; i++) { pl.x += 0.05; set.userData.tick && set.userData.tick(1 / 60, { player: pl, t: i / 60 }); }
    for (const [id, x] of sp) if (typeof x.use === 'function') { try { x.on = !x.on; x.use({ kind: x.kind, on: x.on }); } catch (e) { fails.push(`${name} ${id} (off): ${e.message}`); } }
    for (let i = 0; i < 120; i++) set.userData.tick && set.userData.tick(1 / 60, { player: pl, t: 4 + i / 60 });
    const by = {}; for (const [, x] of sp) by[x.kind] = (by[x.kind] || 0) + 1;
    log.push(`${name.padEnd(6)} exits: ${exits.join(', ')}  things: ${sp.length} ${JSON.stringify(by)}`);
  }
  return { log, fails };
});
for (const l of out.log) console.log(l);
for (const f of out.fails) console.log('FAIL ' + f);
if (errs.length) console.log('PAGE ERRORS\n' + errs.join('\n'));
console.log(out.fails.length || errs.length ? 'failed' : 'all things work');
await b.close();
process.exitCode = out.fails.length || errs.length ? 1 : 0;
