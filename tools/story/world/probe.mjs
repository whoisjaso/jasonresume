// A probe for the world module: opens a blank page on the local server and evaluates an expression (it may import /story/world.js).
//   node tools/story/world/probe.mjs "<async expression>"
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 800, height: 500 } })).newPage();
p.on('console', m => console.log('console', m.type(), m.text().slice(0, 300)));
p.on('pageerror', e => console.log('pageerror', e.message));
p.on('response', r => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });
await p.goto('http://127.0.0.1:8765/tools/story/world/blank.html');
const r = await p.evaluate(async (code) => { return await eval(code); }, process.argv[2]);
// data URLs come back as files in tools/verify/out/probe-<i>.png
if (Array.isArray(r) && r.every(x => typeof x === 'string' && x.startsWith('data:image/png'))) {
  const fs = await import('node:fs'); r.forEach((u, i) => { const f = `tools/verify/out/probe-${i}.png`; fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64')); console.log(f); });
} else console.log(JSON.stringify(r, null, 1).slice(0, 6000));
await b.close();
