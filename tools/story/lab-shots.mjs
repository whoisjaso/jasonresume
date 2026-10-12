// The cast lab, recorded: renders tools/story/lab.html headless and writes contact sheets.
//   node tools/story/lab-shots.mjs <out.png> "<query>" [cols rows every warmup]
// e.g. node tools/story/lab-shots.mjs tools/verify/out/real-people-walk.png "who=jason&run=walk&cam=side" 8 2 3 60
import { chromium } from 'playwright';
import fs from 'node:fs';
const [out, query, cols = 8, rows = 2, every = 3, warm = 30, w = 260, h = 360] = process.argv.slice(2);
const exe = [process.env.PW_CHROMIUM, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => f && fs.existsSync(f));
const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`http://127.0.0.1:${process.env.LAB_PORT || 8765}/tools/story/lab.html?auto=0&hud=0&w=${w}&h=${h}&${query}`);
await p.waitForFunction(() => window.LAB_READY || window.LAB_ERR, null, { timeout: 60000 }).catch(() => {});
if (errs.length) { console.log('errors:', errs.join('\n')); }
await p.evaluate(n => window.LAB.advance(+n), warm);
const url = await p.evaluate(([c, r, e]) => window.LAB.sheet(+c, +r, +e), [cols, rows, every]);
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
console.log('wrote', out);
await b.close();
