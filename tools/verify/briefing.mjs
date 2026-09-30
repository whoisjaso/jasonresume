// /obavia.html and /join.html, played on desktop and mobile: the three lessons,
// Rewrite the Note, the film buttons, the forms' email fallback, overflow,
// dashes, percent signs, and the fictional label under the Obavia films.
//   python3 -m http.server 8765 &   then   node tools/verify/briefing.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
const TOOLS = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(TOOLS, 'verify', 'out');
const exe = [process.env.PW_CHROMIUM, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => f && fs.existsSync(f));
const b = await chromium.launch({ executablePath: exe });
const errs = [], notes = [];
for (const [name, w, h, mobile] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
  await ctx.route('**/api/track', r => r.fulfill({ status: 204, body: '' }));
  await ctx.route(/calendly\.com/, r => r.abort());
  await ctx.route('**/api/lead', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"delivered":false}' }));
  await ctx.route('**/api/apply', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"delivered":false}' }));
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(`${name} pageerror: ${e.message}`));
  const shot = l => p.screenshot({ path: path.join(OUT, `brief-${name}-${l}.png`) });
  const go = async (sel, l, wait = 700) => { await p.evaluate(s => { document.documentElement.style.scrollBehavior = 'auto'; const el = document.querySelector(s); scrollTo(0, el.getBoundingClientRect().top + scrollY - 70); }, sel); await p.waitForTimeout(wait); if (l) await shot(l); };

  await p.goto('http://127.0.0.1:8765/obavia.html', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200);
  await shot('o1-slate');
  await go('#films', 'o2-films');
  const label = await p.textContent('.b-films__fiction'); if (!/fictional/.test(label)) errs.push(`${name} films missing the fictional label`);
  await go('#handoff', null);
  await p.click('[data-kind="words"]'); await p.waitForTimeout(600); await shot('o3-handoff');
  await go('#leaks', null);
  for (const [i, a] of [[0, 'yes'], [1, 'no'], [2, 'yes'], [3, 'unsure'], [4, 'yes'], [5, 'yes']]) await p.click(`[data-leaks] li[data-stage]:nth-child(${i + 1}) [data-a="${a}"]`);
  await p.waitForTimeout(600); await go('[data-leaks-result]', 'o4-leaks');
  const leak = await p.textContent('[data-leak-name]'); if (leak.trim() !== 'Connect') errs.push(`${name} leak finder said ${leak}`);
  await go('#counts', null);
  for (let i = 1; i <= 6; i++) await p.click(`[data-counts] li:nth-child(${i}) [data-sort="${i === 6 ? 'counts' : 'not'}"]`);
  await p.waitForTimeout(600); await go('[data-counts-result]', 'o5-counts');
  await go('#pricing', 'o6-pricing');
  await go('.b-lead', null);
  await p.fill('#l-name', 'Test Owner'); await p.fill('#l-email', 'owner@example.com');
  await p.click('.b-lead button[type="submit"]'); await p.waitForTimeout(900);
  const fb = await p.evaluate(() => !document.querySelector('#lead-sent [data-fallback]').hidden); if (!fb) errs.push(`${name} lead fallback not shown`);
  await shot('o7-lead');
  let text = await p.evaluate(() => document.body.innerText);
  if (/[—–]/.test(text)) errs.push(`${name} obavia dash`); if (/%/.test(text)) errs.push(`${name} obavia percent`);
  let ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); if (ov) errs.push(`${name} obavia overflow`);

  await p.goto('http://127.0.0.1:8765/join.html', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1000);
  await shot('j1-slate');
  await go('#note', null);
  for (const f of ['said', 'purpose', 'decides', 'promised']) await p.click(`[data-frag="${f}"]`);
  await p.waitForTimeout(700); await go('[data-note-result]', 'j2-note');
  const done = await p.evaluate(() => !document.querySelector('[data-note-result]').hidden); if (!done) errs.push(`${name} note game did not finish`);
  await go('#roles', 'j3-roles');
  await go('#apply', null);
  await p.fill('#a-name', 'Test Closer'); await p.fill('#a-email', 'closer@example.com');
  await p.fill('#a-story', 'I sold a used truck to a contractor who pushed back on the price twice and bought anyway. He came back for a second one.');
  await p.click('#apply button[type="submit"]'); await p.waitForTimeout(900); await shot('j4-apply');
  text = await p.evaluate(() => document.body.innerText);
  if (/[—–]/.test(text)) errs.push(`${name} join dash`); if (/%/.test(text)) errs.push(`${name} join percent`);
  ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); if (ov) errs.push(`${name} join overflow`);
  notes.push(`${name} ok`);
  await ctx.close();
}
await b.close();
console.log(notes.join('\n'));
console.log(errs.length ? 'ISSUES:\n' + errs.join('\n') : 'both pages play end to end, no overflow, no dashes, no percent signs');
