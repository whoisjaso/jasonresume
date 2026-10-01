// /obavia.html, the Obavia page, played on desktop and mobile: the
// onboarding (it plays here too, and not again on a click from home), the
// product header, the film button, the desk app from start to Filed, a
// lesson, the early-access form and its email fallback, the get bar, the
// /join redirect target, overflow, dashes, percent signs, and the fictional
// labels.
//   python3 -m http.server 8765 &   then   node tools/verify/briefing.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
const TOOLS = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(TOOLS, 'verify', 'out');
fs.mkdirSync(OUT, { recursive: true });
const exe = [process.env.PW_CHROMIUM, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(f => f && fs.existsSync(f));
const b = await chromium.launch({ executablePath: exe });
const errs = [];
for (const [name, w, h, mobile] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
  await ctx.route('**/api/track', r => r.fulfill({ status: 204, body: '' }));
  await ctx.route(/calendly\.com/, r => r.abort());
  let sentBody = null;
  await ctx.route('**/api/lead', r => { sentBody = r.request().postDataJSON(); r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"delivered":false}' }); });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(`${name} pageerror: ${e.message}`));
  const shot = l => p.screenshot({ path: path.join(OUT, `brief-${name}-${l}.png`) });
  const go = async (sel, l, wait = 700) => { await p.evaluate(s => { document.documentElement.style.scrollBehavior = 'auto'; const el = document.querySelector(s); scrollTo(0, el.getBoundingClientRect().top + scrollY - 70); }, sel); await p.waitForTimeout(wait); if (l) await shot(l); };

  await p.goto('http://127.0.0.1:8765/obavia.html', { waitUntil: 'domcontentloaded' });
  // arriving from outside the site: the onboarding plays here too; skip it silently
  await p.waitForSelector('#intro', { timeout: 4000 }).catch(() => errs.push(`${name} onboarding did not show on /obavia.html`));
  await p.waitForTimeout(600); await shot('o0-onboarding');
  await p.click('[data-intro-skip]'); await p.waitForTimeout(900);
  if (await p.$('#intro')) errs.push(`${name} onboarding did not leave on skip`);
  await shot('o1-head');
  // the early-access button is above the fold on arrival
  const fold = await p.evaluate(() => { const a = document.querySelector('.pp-head__actions .pill--gold').getBoundingClientRect(); return a.bottom <= innerHeight; });
  if (!fold) errs.push(`${name} early access button below the fold`);
  const barAway = await p.evaluate(() => document.querySelector('[data-getbar]').classList.contains('is-away'));
  if (!barAway) errs.push(`${name} get bar showing over the header`);

  await go('#film', 'o2-film');
  const cap = await p.textContent('.pp-film figcaption'); if (!/fictional/.test(cap)) errs.push(`${name} film missing the fictional label`);
  await p.click('#film [data-film-play]'); await p.waitForTimeout(500);
  if (!(await p.evaluate(() => document.querySelector('#film [data-film-box]').classList.contains('is-playing')))) errs.push(`${name} film did not start`);
  await p.evaluate(() => document.querySelector('#film video').pause());
  const barOn = await p.evaluate(() => !document.querySelector('[data-getbar]').classList.contains('is-away'));
  if (!barOn) errs.push(`${name} get bar hidden mid-page`);

  // the desk, start to Filed
  await go('#run', null, 900);
  const c = sel => p.click(`[data-desk-app] .app-screen.is-on ${sel}`);
  await c('.app-btn--gold'); await p.waitForTimeout(500);
  await c('[data-car="0"]'); await p.waitForTimeout(1100);
  await c('[data-ok]'); await p.waitForTimeout(600);
  await c('[data-shutter]'); await p.waitForTimeout(2300);
  await c('[data-ok]'); await p.waitForTimeout(500);
  await c('[data-pay="bank"]'); await c('[data-ok]'); await p.waitForTimeout(1400);
  await c('[data-ok]'); await p.waitForTimeout(1200);
  await c('[data-ok]'); await p.waitForTimeout(500);
  await c('[data-auto]'); await c('[data-ok]'); await p.waitForTimeout(1000);
  await go('#run', 'o3-desk', 300);
  const filed = await p.evaluate(() => /Filed/.test(document.querySelector('[data-desk-app] .app-screen.is-on').textContent));
  if (!filed) errs.push(`${name} desk did not reach Filed`);

  await go('#what', 'o4-what');
  await go('#lessons', 'o5-lessons');
  await p.click('#lessons .pp-lesson:first-child [data-film-play]'); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelectorAll('video').forEach(v => v.pause()));

  await go('#early', null);
  await p.fill('#l-name', 'Test Dealer'); await p.fill('#l-email', 'dealer@example.com');
  await p.fill('#l-dealership', 'Example Motors'); await p.fill('#l-city', 'Houston');
  await p.selectOption('#l-pay', 'bhph');
  await p.click('#early button[type="submit"]'); await p.waitForTimeout(900);
  if (!sentBody || sentBody.dealership !== 'Example Motors' || sentBody.pay !== 'bhph' || sentBody.city !== 'Houston') errs.push(`${name} lead body wrong: ${JSON.stringify(sentBody)}`);
  const fb = await p.evaluate(() => !document.querySelector('#lead-sent [data-fallback]').hidden); if (!fb) errs.push(`${name} lead fallback not shown`);
  await shot('o6-early');
  await go('#book', 'o7-book');

  const text = await p.evaluate(() => document.body.innerText);
  if (/[—–]/.test(text)) errs.push(`${name} obavia dash`); if (/%/.test(text)) errs.push(`${name} obavia percent`);
  if (/agency|setter|closer|waitlist/i.test(text)) errs.push(`${name} old agency wording on the page`);
  const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); if (ov) errs.push(`${name} obavia overflow`);
  await ctx.close();
}
// The onboarding on /obavia.html, start to finish: the dealer's cut ends on early access, on this page
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route('**/api/track', r => r.fulfill({ status: 204, body: '' })); await ctx.route(/calendly\.com/, r => r.abort());
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(`onboarding pageerror: ${e.message}`));
  await p.goto('http://127.0.0.1:8765/obavia.html'); await p.waitForSelector('.intro.is-ready', { timeout: 9000 });
  await p.mouse.click(195, 700); await p.waitForSelector('[data-role="partner"]'); await p.waitForTimeout(900);
  await p.click('[data-role="partner"]'); await p.waitForSelector('.intro__input'); await p.waitForTimeout(500);
  await p.fill('.intro__input', 'Dana'); await p.keyboard.press('Enter');
  await p.waitForSelector('.tr.is-on', { timeout: 6000 }).catch(() => errs.push('obavia onboarding: trailer did not play'));
  for (let k = 0; k < 30 && !(await p.$('.tr--end.is-on')); k++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(420); }
  await p.waitForTimeout(1500); await p.screenshot({ path: path.join(OUT, 'brief-onboarding-end.png') });
  const url0 = p.url();
  await p.click('[data-reel-cta="briefing"]'); await p.waitForTimeout(2200);
  const st = await p.evaluate(() => ({ reel: !!document.querySelector('.tr'), locked: document.documentElement.classList.contains('is-locked'), top: Math.round(document.getElementById('early').getBoundingClientRect().top) }));
  if (st.reel || st.locked || Math.abs(st.top) > 120) errs.push(`obavia onboarding: early access landing wrong ${JSON.stringify(st)}`);
  if (p.url().split('#')[0] !== url0.split('#')[0]) errs.push('obavia onboarding: the early access button left the page');
  await p.screenshot({ path: path.join(OUT, 'brief-onboarding-early.png') });
  // a click from the home page to /obavia.html is not a new arrival: no second onboarding
  await p.goto('http://127.0.0.1:8765/'); await p.waitForSelector('#intro'); await p.click('[data-intro-skip]'); await p.waitForTimeout(700);
  await p.evaluate(() => { const a = document.createElement('a'); a.href = '/obavia.html'; a.id = 'go-ob'; a.textContent = 'go'; document.body.appendChild(a); });
  await Promise.all([p.waitForURL(/obavia\.html/), p.click('#go-ob')]); await p.waitForTimeout(1200);
  if (await p.$('#intro')) errs.push('onboarding replayed on a click between pages');
  await ctx.close();
}
await b.close();
console.log(errs.length ? errs.join('\n') : 'briefing: all clear');
process.exit(errs.length ? 1 : 0);
