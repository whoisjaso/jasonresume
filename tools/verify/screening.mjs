// The rebuilt home page, played end to end on desktop and mobile.
//   python3 -m http.server 8765 &   then   node tools/verify/screening.mjs [desktop|mobile]
// Checks: no page errors, no horizontal overflow, no em or en dashes, no "%" in
// visible text, the Slate's actions above the fold on a phone, the live
// widgets, the desk story opening full screen and its app run to Filed, a clean
// close, the Obavia tab, the deck and Check me. Screenshots land in tools/verify/out/screen-*.png.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
const TOOLS = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(TOOLS, 'verify', 'out');
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
const exe = [process.env.PW_CHROMIUM, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => f && fs.existsSync(f));
const b = await chromium.launch({ executablePath: exe });
const errs = [], notes = [];
const shot = async (p, name, label) => p.screenshot({ path: path.join(OUT, `screen-${name}-${label}.png`) });

for (const [name, w, h, mobile] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
  if (only && only !== name) continue;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
  const tracked = [];
  await ctx.route('**/api/track', async r => { try { tracked.push(...JSON.parse(r.request().postData() || '{}').events.map(e => e.event)); } catch {} r.fulfill({ status: 204, body: '' }); });
  await ctx.route('**/api/guide', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unconfigured"}' }));
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(`${name} pageerror: ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(`${name} console: ${m.text().slice(0, 160)}`); });
  const t0 = Date.now();
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'domcontentloaded' });
  // The intro: tap anywhere, the question, the name, the cut
  await p.waitForSelector('#intro', { timeout: 4000 }).catch(() => errs.push(`${name} intro did not appear`));
  await p.waitForSelector('.intro.is-ready', { timeout: 9000 }); await p.waitForTimeout(300); await shot(p, name, '00a-intro');
  await p.mouse.click(w / 2, h * 0.8); await p.waitForSelector('[data-role="interviewer"]'); await p.waitForTimeout(1100); await shot(p, name, '00b-question');
  await p.click('[data-role="interviewer"]'); await p.waitForSelector('.intro__input'); await p.waitForTimeout(600);
  await p.fill('.intro__input', 'Test Visitor'); await p.keyboard.press('Enter');
  await p.waitForSelector('#intro', { state: 'detached', timeout: 8000 }).catch(() => errs.push(`${name} intro did not leave`));
  // The reel: the interviewer's cut plays itself; arrows step through, the end card offers the next move
  await p.waitForSelector('.tr.is-on', { timeout: 5000 }).catch(() => errs.push(`${name} reel did not open after the intro`));
  await p.waitForTimeout(2600); await shot(p, name, '00c-reel-open');
  for (let k = 0; k < 30 && !(await p.$('.tr--end.is-on')); k++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(420); }
  await p.waitForTimeout(1600); await shot(p, name, '00d-reel-end');
  if (!(await p.$('.tr--end.is-on [data-reel-cta="email"]'))) errs.push(`${name} reel end card has no email`);
  await p.click('.tr [data-reel-go="site"]');
  await p.waitForSelector('.tr', { state: 'detached', timeout: 4000 }).catch(() => errs.push(`${name} reel did not leave`));
  await p.waitForTimeout(700);
  // The ten-second test: the actions are on screen at arrival, with nothing in front
  const fold = await p.evaluate(() => { const r = [...document.querySelectorAll('.slate__actions .btn')].map(x => x.getBoundingClientRect()); const dock = document.querySelector('.tabbar'); const dh = dock && getComputedStyle(dock).display !== 'none' ? dock.getBoundingClientRect().height : 0; return { maxBottom: Math.max(...r.map(x => x.bottom)), vh: innerHeight - dh, n: r.length, dialogs: document.querySelectorAll('dialog[open]').length }; });
  if (fold.maxBottom > fold.vh) errs.push(`${name} Slate actions below the fold (${Math.round(fold.maxBottom)} > ${fold.vh})`);
  if (fold.dialogs) errs.push(`${name} a dialog is open on arrival`);
  notes.push(`${name} intro played and site ready in ${Date.now() - t0} ms, actions bottom ${Math.round(fold.maxBottom)} of ${fold.vh}`);
  await shot(p, name, '01-slate');

  const go = async (sel, label, extra = 900) => {
    await p.evaluate(s => { document.documentElement.style.scrollBehavior = 'auto'; const el = document.querySelector(s); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 70); }, sel);
    await p.waitForTimeout(extra); if (label) await shot(p, name, label);
  };

  // The feed: widgets live, then the desk story opens full screen and the app runs to Filed
  const live = await p.evaluate(() => ({ date: document.querySelector('[data-today-date]').textContent, lot: document.querySelector('[data-lot]').textContent }));
  if (!/,/.test(live.date) || !/Open|Closed/.test(live.lot)) errs.push(`${name} widgets not live ${JSON.stringify(live)}`);
  await go('.widgets', '02-widgets');
  await go('#story-desk', '03-card', 600);
  await p.click('#story-desk .tcard__open'); await p.waitForTimeout(1200); await shot(p, name, '04-story-open');
  const top = await p.evaluate(() => { const r = document.querySelector('#story-desk').getBoundingClientRect(); const el = document.elementFromPoint(innerWidth / 2, 200); return { top: Math.round(r.top), mine: !!(el && el.closest('#story-desk')), hash: location.hash }; });
  if (top.top !== 0 || !top.mine || top.hash !== '#story-desk') errs.push(`${name} desk story did not open over the page ${JSON.stringify(top)}`);
  await p.evaluate(() => document.querySelector('[data-desk-app]').scrollIntoView({ block: 'center' })); await p.waitForTimeout(500);
  const c = sel => p.click(`[data-desk-app] .app-screen.is-on ${sel}`);
  await c('.app-btn--gold'); await p.waitForTimeout(500);
  await c('[data-car="2"]'); await p.waitForTimeout(1100); await shot(p, name, '05-desk-odo');
  await c('[data-ok]'); await p.waitForTimeout(600);
  await c('[data-shutter]'); await p.waitForTimeout(2300); await shot(p, name, '06-desk-scan');
  await c('[data-ok]'); await p.waitForTimeout(500);
  await c('[data-pay="bhph"]'); await c('[data-ok]'); await p.waitForTimeout(1500); await shot(p, name, '07-desk-money');
  const fin = await p.evaluate(() => [...document.querySelectorAll('[data-desk-app] .app-screen.is-on .app-total .val')].map(v => v.textContent));
  if (fin.length !== 2 || !/^\$[\d,]+\.\d\d$/.test(fin[1])) errs.push(`${name} desk money wrong ${JSON.stringify(fin)}`);
  await c('[data-ok]'); await p.waitForTimeout(1300); await shot(p, name, '08-desk-docs');
  const docs = await p.evaluate(() => document.querySelectorAll('[data-desk-app] .app-screen.is-on .app-doc').length); if (docs !== 4) errs.push(`${name} buy here pay here should need 4 papers, got ${docs}`);
  await c('[data-ok]'); await p.waitForTimeout(500);
  await c('[data-auto]'); await c('[data-ok]'); await p.waitForTimeout(1200); await shot(p, name, '09-desk-filed');
  if (!(await p.evaluate(() => /Filed/.test(document.querySelector('[data-desk-app] .app-screen.is-on').textContent)))) errs.push(`${name} desk did not reach Filed`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(1600);
  const closed = await p.evaluate(() => ({ open: document.documentElement.classList.contains('is-story-open'), locked: document.documentElement.classList.contains('is-locked'), hash: location.hash, style: document.querySelector('#story-desk').getAttribute('style') || '' }));
  if (closed.open || closed.locked || closed.hash || closed.style) errs.push(`${name} story did not close cleanly ${JSON.stringify(closed)}`);
  // the tab bar opens the Obavia story; the story's link goes to the page
  await p.click('.tabbar [data-story-open="obavia"]'); await p.waitForTimeout(1300); await shot(p, name, '10-obavia-story');
  if (!(await p.evaluate(() => location.hash === '#story-obavia'))) errs.push(`${name} Obavia tab did not open its story`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(1300);
  await go('#story-record', '11-record');
  await go('#move', '12-move');

  // Overlays
  await p.evaluate(() => window.JG_OPEN('deck', 'test')); await p.waitForTimeout(900); await shot(p, name, '21-deck-1');
  for (let i = 0; i < 4; i++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(250); }
  await p.waitForTimeout(500); await shot(p, name, '22-deck-5');
  const hash = await p.evaluate(() => location.hash); if (hash !== '#present/5') errs.push(`${name} deck hash was ${hash}`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.evaluate(() => window.JG_OPEN('verify', 'test')); await p.waitForTimeout(700); await shot(p, name, '23-verify');
  await p.fill('#ask-q', 'What would you do first?'); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  const ans = await p.textContent('.ask-form__answer'); if (!/Email me|jobawems/.test(ans)) errs.push(`${name} ask fallback missing: ${ans}`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const locked = await p.evaluate(() => document.documentElement.classList.contains('is-locked')); if (locked) errs.push(`${name} screen still locked after closing overlays`);

  // Text rules and layout
  const text = await p.evaluate(() => document.body.innerText);
  if (/[—–]/.test(text)) errs.push(`${name} dash in visible text`);
  if (/\d\s?%|%/.test(text)) errs.push(`${name} percent sign in visible text`);
  if (/apohenia/i.test(text)) errs.push(`${name} Apohenia in visible text`);
  const ov = await p.evaluate(() => ({ docW: document.documentElement.scrollWidth, winW: innerWidth }));
  if (ov.docW > ov.winW + 1) errs.push(`${name} horizontal overflow ${JSON.stringify(ov)}`);
  await p.evaluate(() => { dispatchEvent(new Event('pagehide')); });
  await p.waitForTimeout(1200);
  notes.push(`${name} events sent: ${[...new Set(tracked)].join(', ')}`);
  for (const ev of ['intro_shown', 'intro_started', 'role_chosen', 'name_given', 'intro_finished', 'reel_started', 'reel_finished']) if (!tracked.includes(ev)) errs.push(`${name} intro never sent ${ev}`);
  await ctx.close();
}
// The onboarding's other doors: the dealer route, every return visit, Skip, deep links after it
if (!only || only === 'mobile') {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route('**/api/track', r => r.fulfill({ status: 204, body: '' })); await ctx.route(/calendly\.com/, r => r.abort());
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(`intro doors pageerror: ${e.message}`));
  await p.goto('http://127.0.0.1:8765/'); await p.waitForSelector('.intro.is-ready', { timeout: 9000 });
  await p.mouse.click(195, 700); await p.waitForSelector('[data-role="partner"]'); await p.waitForTimeout(900);
  await p.click('[data-role="partner"]'); await p.waitForSelector('.intro__input'); await p.waitForTimeout(500);
  await p.fill('.intro__input', 'Pat'); await p.keyboard.press('Enter');
  await p.waitForSelector('.tr.is-on', { timeout: 6000 }); await p.waitForTimeout(2500); await p.screenshot({ path: path.join(OUT, 'screen-reel-partner-1.png') });
  for (let k = 0; k < 30 && !(await p.$('.tr--end.is-on')); k++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(420); }
  await p.waitForTimeout(1600);
  await Promise.all([p.waitForURL(/obavia\.html/, { timeout: 9000 }), p.click('[data-reel-cta="briefing"]')]);
  await p.waitForTimeout(1200); const greet = await p.textContent('.island__text').catch(() => '');
  if (!/Welcome, Pat/.test(greet)) errs.push(`dealer route greeting was "${greet}"`); else notes.push('dealer route: reel, then obavia.html, greeted by name');
  await p.waitForTimeout(1200); await p.screenshot({ path: path.join(OUT, 'screen-intro-dealer.png') });
  await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(1200);
  if (!(await p.$('#intro'))) errs.push('onboarding did not show to a return visitor'); else notes.push('return visit: onboarding again');
  // a returning visitor who gives the same name is welcomed back
  await p.waitForSelector('.intro.is-ready', { timeout: 9000 }); await p.mouse.click(195, 700);
  await p.waitForSelector('[data-role="lurker"]'); await p.waitForTimeout(900); await p.click('[data-role="lurker"]');
  await p.waitForSelector('.intro__input'); await p.waitForTimeout(500);
  const pre = await p.inputValue('.intro__input'); if (pre !== 'Pat') errs.push(`return visit name not prefilled: "${pre}"`);
  await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  const card = await p.textContent('.intro__card').catch(() => ''); if (!/Welcome back, Pat/.test(card)) errs.push(`return visit card said "${card}"`); else notes.push('return visit: welcomed back by name');
  await ctx.close();
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await c2.route('**/api/track', r => r.fulfill({ status: 204, body: '' }));
  const q = await c2.newPage();
  await q.goto('http://127.0.0.1:8765/'); await q.waitForSelector('#intro'); await q.click('[data-intro-skip]'); await q.waitForTimeout(700);
  const sk = await q.evaluate(() => ({ intro: !!document.getElementById('intro'), locked: document.documentElement.classList.contains('is-locked') }));
  if (sk.intro || sk.locked) errs.push(`skip left ${JSON.stringify(sk)}`); else notes.push('skip: gone, page unlocked');
  await c2.close();
  const c3 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await c3.route('**/api/track', r => r.fulfill({ status: 204, body: '' }));
  const r3 = await c3.newPage(); r3.on('pageerror', e => errs.push(`deep link pageerror: ${e.message}`));
  await r3.goto('http://127.0.0.1:8765/#present/2'); await r3.waitForTimeout(1200);
  if (!(await r3.$('#intro'))) errs.push('onboarding did not show on a deep link');
  if (await r3.evaluate(() => !!document.querySelector('dialog[open]'))) errs.push('deep link opened under the onboarding');
  await r3.click('[data-intro-skip]'); await r3.waitForTimeout(1200);
  const deck = await r3.evaluate(() => !!document.querySelector('#deck[open]'));
  if (!deck) errs.push('deep link #present/2 did not open after the onboarding'); else notes.push('deep link: onboarding first, then the deck');
  await r3.goto('http://127.0.0.1:8765/?from=test#story-obavia'); await r3.waitForSelector('#intro'); await r3.click('[data-intro-skip]'); await r3.waitForTimeout(1500);
  if (!(await r3.evaluate(() => document.documentElement.classList.contains('is-story-open')))) errs.push('#story-obavia did not open after the onboarding'); else notes.push('deep link: onboarding first, then the story');
  await c3.close();
}

// Privacy: with Global Privacy Control or Do Not Track on, nothing reaches /api/track
for (const flag of ['globalPrivacyControl', 'doNotTrack']) {
  if (only && only !== 'desktop') break;
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(f => Object.defineProperty(Navigator.prototype, f, { get: () => f === 'doNotTrack' ? '1' : true }), flag);
  await ctx.addInitScript(() => { try { localStorage.setItem('jg_intro', '1'); } catch (e) {} });
  let sent = 0; await ctx.route('**/api/track', r => { sent++; r.fulfill({ status: 204, body: '' }); });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200);
  await p.evaluate(() => window.JG_OPEN && window.JG_OPEN('verify', 'test')); await p.waitForTimeout(400);
  await p.evaluate(() => dispatchEvent(new Event('pagehide'))); await p.waitForTimeout(800);
  if (sent) errs.push(`${flag}: ${sent} request(s) reached /api/track`); else notes.push(`${flag} on: nothing sent`);
  await ctx.close();
}
await b.close();
console.log(notes.join('\n'));
console.log(errs.length ? 'ISSUES:\n' + errs.join('\n') : 'no page errors, no overflow, no dashes, no percent signs, every scene played');
