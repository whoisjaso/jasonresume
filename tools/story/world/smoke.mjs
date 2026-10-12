// A quick smoke test after any edit to the world layer: open #story/lot (and any other scenes named) and report page errors.
//   node tools/story/world/smoke.mjs [lot office memory keys]
import { chromium } from 'playwright';
const scenes = process.argv.slice(2).length ? process.argv.slice(2) : ['lot'];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let bad = 0;
for (const sc of scenes) {
  const p = await (await b.newContext({ viewport: { width: 800, height: 500 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|404/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  await p.goto('http://127.0.0.1:8765/?debug=story&fast=1&pr=0.3#story/' + sc);
  await p.waitForSelector('#intro [data-intro-skip]', { timeout: 30000 }).then(() => p.click('#intro [data-intro-skip]')).catch(() => {});
  const ok = await p.waitForFunction(s => window.JG_STORY && window.JG_STORY.debug.state().scene === s, sc, { timeout: 120000 }).then(() => true, () => false);
  await p.waitForTimeout(1500);
  if (!ok || errs.length) bad++;
  console.log(sc, ok ? 'opened' : 'FAILED', errs.length ? 'errors: ' + errs.join(' | ') : 'no errors');
}
await b.close();
process.exitCode = bad ? 1 : 0;
