// The cinematic home page, scene by scene, desktop and mobile.
// Goes through the loader, the gate and the name step, closes the guide, then stops the
// projector at fixed points of each scene and takes a frame. Also checks overflow, page
// errors, em dashes, and that the films have posters and load when they come into view.
//   python3 -m http.server 8765 &  then  node tools/verify/cinema.mjs [desktop|mobile]
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
const TOOLS = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(TOOLS, 'verify', 'out');
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => fs.existsSync(f));
const b = await chromium.launch({ executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required'] });
const errs = [], notes = [];

// [scene selector, progress through the scene, label]; progress follows cinema.js rules
const STOPS = [
  ['#open', 0, 'open'], ['#open', 0.5, 'open-leaving'],
  ['#obavia', 0.1, 'obavia-hear'], ['#obavia', 0.45, 'obavia-mark'], ['#obavia', 0.84, 'obavia-films'],
  ['#listen', 0.55, 'listen'],
  ['#loop', 0.05, 'loop-start'], ['#loop', 0.6, 'loop-mid'],
  ['#triple-j', 0.14, 'desk-title'], ['#triple-j', 0.52, 'desk-full'], ['#triple-j', 0.85, 'desk-beats'],
  ['.c-lot', 0.45, 'lot'], ['#record', -1, 'record'], ['#facts', -1, 'facts'], ['#intake', -1, 'intake'], ['#contact', -1, 'finale']
];

for (const [name, w, h, mobile] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
  if (only && only !== name) continue;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await ctx.route('**/api/track', r => r.fulfill({ status: 204, body: '' }));
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(name + ' pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource|net::ERR/.test(m.text())) errs.push(name + ' console: ' + m.text().slice(0, 160)); });
  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(700);
  await p.mouse.click(w / 2, h / 2);
  await p.waitForSelector('#jg-gate.is-in', { timeout: 25000 });
  await p.click('.jg-path[data-role="lurker"]');
  await p.waitForSelector('.jg-namestep input', { timeout: 6000 }); await p.click('[data-skip]');
  await p.waitForSelector('#jg-guide.is-open', { timeout: 8000 }); await p.waitForTimeout(600);
  await p.click('.jg-guide__skip'); await p.waitForTimeout(900);
  const open = await p.evaluate(() => document.documentElement.classList.contains('is-open'));
  notes.push(name + ' letterbox open: ' + open);

  for (const [sel, prog, label] of STOPS) {
    const y = await p.evaluate(([sel, prog]) => {
      const el = document.querySelector(sel); if (!el) return null;
      const r = el.getBoundingClientRect(), top = r.top + scrollY, vh = innerHeight, mode = el.getAttribute('data-scene');
      if (prog < 0) return top - 60;
      if (mode === 'pin') return top + prog * Math.max(0, r.height - vh);
      if (mode === 'lead') return top + prog * r.height;
      return top - vh + prog * (vh + r.height);
    }, [sel, prog]);
    if (y == null) { errs.push(name + ' missing ' + sel); continue; }
    await p.evaluate(y => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo({ top: y, behavior: 'instant' }); }, y);
    await p.waitForTimeout(label.startsWith('obavia-films') || label.startsWith('desk') ? 1400 : 1600);
    await p.evaluate(() => document.querySelectorAll('[data-reveal]').forEach(e => { const r = e.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) e.classList.add('in-view'); }));
    await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(OUT, `cinema-${name}-${label}.png`) });
  }

  const films = await p.evaluate(() => [...document.querySelectorAll('video[data-src]')].map(v => ({ name: v.dataset.name, poster: !!v.poster, loaded: !!v.getAttribute('src') })));
  notes.push(name + ' films: ' + JSON.stringify(films));
  const text = await p.evaluate(() => document.body.innerText);
  if (/[\u2014\u2013]/.test(text)) errs.push(name + ' dash in visible text');
  if (/apohenia/i.test(text)) errs.push(name + ' Apohenia in visible text');
  const ov = await p.evaluate(() => ({ docW: document.documentElement.scrollWidth, winW: innerWidth }));
  if (ov.docW > ov.winW + 1) errs.push(name + ' H-OVERFLOW ' + JSON.stringify(ov));
  await ctx.close();
}
await b.close();
console.log(notes.join('\n'));
console.log(errs.length ? 'ISSUES:\n' + errs.join('\n') : 'no page errors, no overflow, no dashes');
