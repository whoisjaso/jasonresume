// The rebuilt home page, played end to end on desktop and mobile.
//   python3 -m http.server 8765 &   then   node tools/verify/screening.mjs [desktop|mobile]
// Checks: no page errors, no horizontal overflow, no em or en dashes, no "%" in
// visible text, the Slate's actions above the fold on a phone, the desk game
// from first question to the reveal, the deck, Check me, the trailer, the rig
// and the cue sheet. Screenshots land in tools/verify/out/screen-*.png.
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
  await p.waitForTimeout(600);
  // The ten-second test: the actions are on screen at arrival, with nothing in front
  const fold = await p.evaluate(() => { const r = [...document.querySelectorAll('.slate__actions .btn')].map(x => x.getBoundingClientRect()); const dock = document.querySelector('.dock'); const dh = dock && getComputedStyle(dock).display !== 'none' ? dock.getBoundingClientRect().height : 0; return { maxBottom: Math.max(...r.map(x => x.bottom)), vh: innerHeight - dh, n: r.length, dialogs: document.querySelectorAll('dialog[open]').length }; });
  if (fold.maxBottom > fold.vh) errs.push(`${name} Slate actions below the fold (${Math.round(fold.maxBottom)} > ${fold.vh})`);
  if (fold.dialogs) errs.push(`${name} a dialog is open on arrival`);
  notes.push(`${name} intro played and site ready in ${Date.now() - t0} ms, actions bottom ${Math.round(fold.maxBottom)} of ${fold.vh}`);
  await shot(p, name, '01-slate');

  const go = async (sel, label, extra = 900) => {
    await p.evaluate(s => { document.documentElement.style.scrollBehavior = 'auto'; const el = document.querySelector(s); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 70); }, sel);
    await p.waitForTimeout(extra); if (label) await shot(p, name, label);
  };

  // The desk, end to end
  await go('#desk-title', '02-title');
  await go('#desk', '03-desk-q1', 700);
  await p.click('[data-step="pay"] .opt[data-v="bhph"]'); await p.waitForTimeout(700);
  await p.click('[data-step="files"] .opt[data-v="us"]'); await p.waitForTimeout(700);
  await shot(p, name, '04-desk-scan');
  const hb = await p.$('[data-hold="scan"]'); await hb.scrollIntoViewIfNeeded(); await p.waitForTimeout(300); const box = await hb.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.waitForTimeout(1100); await p.mouse.up();
  await p.waitForTimeout(900); await shot(p, name, '05-desk-filled');
  await p.click('[data-step="scan"] .step__next');  await p.waitForTimeout(500);
  await p.click('[data-step="math"] .opt[data-v="top"]'); await p.waitForTimeout(900); await shot(p, name, '06-desk-math');
  await p.click('[data-step="math"] .step__next'); await p.waitForTimeout(500);
  await p.click('[data-lang="es"]'); await p.waitForTimeout(600); await shot(p, name, '07-desk-es');
  const esText = await p.textContent('[data-step="lang"] .lang__card .step__q');
  if (!/tramita/.test(esText)) errs.push(`${name} Spanish flip did not change the question`);
  await p.click('[data-step="lang"] .step__next'); await p.waitForTimeout(500);
  await p.click('[data-sign="type"]'); await p.waitForTimeout(200); await shot(p, name, '08-desk-sign');
  await p.click('[data-sign="done"]'); await p.waitForTimeout(700); await shot(p, name, '09-desk-file');
  await p.waitForTimeout(2200);
  const rev = await p.evaluate(() => { const r = document.getElementById('desk-reveal'); return r && !r.hidden; });
  if (!rev) errs.push(`${name} desk reveal did not appear`);
  await shot(p, name, '10-desk-reveal');

  await go('#film', '11-film');
  await go('#record', '12-record');
  await go('#listen-title', null, 300);
  await go('#listen', '13-listen', 700);
  const words = await p.$$('.mark__word'); if (words.length < 5) errs.push(`${name} Mark the Words did not tokenize`);
  for (const i of [5, 6, 14]) if (words[i]) await words[i].click();
  await p.click('[data-mark="show"]'); await p.waitForTimeout(800); await shot(p, name, '14-mark-reveal');
  await go('#questions', null, 300); await p.click('.questions__list [data-ask]'); await p.waitForTimeout(300); await shot(p, name, '15-questions');
  await go('#rig', null, 300);
  await p.click('#rig [data-open="rig"]'); await p.waitForTimeout(700); await shot(p, name, '16-rig');
  await p.click('#rig [data-open="rig"]');
  await p.click('#rig [data-open="cues"]'); await p.waitForTimeout(400); await shot(p, name, '17-cues');
  await p.click('#rig [data-open="cues"]');
  await go('#move', '18-move');
  await go('#credits', '19-credits');
  await go('#post', '20-post', 1200);

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
  await p.evaluate(() => window.JG_OPEN('trailer', 'test')); await p.waitForTimeout(600);
  for (let i = 0; i < 5; i++) { await p.click('[data-hold="trailer"]'); await p.waitForTimeout(250); }
  await p.waitForTimeout(1500); await shot(p, name, '24-trailer-end');
  const endShown = await p.evaluate(() => !document.querySelector('.trailer__end').hidden); if (!endShown) errs.push(`${name} trailer end did not appear`);
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
  for (const ev of ['intro_shown', 'intro_started', 'role_chosen', 'name_given', 'intro_finished']) if (!tracked.includes(ev)) errs.push(`${name} intro never sent ${ev}`);
  await ctx.close();
}
// The intro's other doors: the agency route, Skip, a return visit, a deep link
if (!only || only === 'mobile') {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route('**/api/track', r => r.fulfill({ status: 204, body: '' })); await ctx.route(/calendly\.com/, r => r.abort());
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(`intro doors pageerror: ${e.message}`));
  await p.goto('http://127.0.0.1:8765/'); await p.waitForSelector('.intro.is-ready', { timeout: 9000 });
  await p.mouse.click(195, 700); await p.waitForSelector('[data-role="partner"]'); await p.waitForTimeout(900);
  await p.click('[data-role="partner"]'); await p.waitForSelector('.intro__input'); await p.waitForTimeout(500);
  await p.fill('.intro__input', 'Pat'); await Promise.all([p.waitForURL('**/obavia.html', { timeout: 9000 }), p.keyboard.press('Enter')]);
  await p.waitForTimeout(1200); const greet = await p.textContent('.island__text').catch(() => '');
  if (!/Welcome, Pat/.test(greet)) errs.push(`agency route greeting was "${greet}"`); else notes.push('agency route: obavia.html, greeted by name');
  await p.waitForTimeout(1200); await p.screenshot({ path: path.join(OUT, 'screen-intro-agency.png') });
  await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(1200);
  if (await p.$('#intro')) errs.push('intro showed again to a return visitor'); else notes.push('return visit: no intro');
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
  const r3 = await c3.newPage(); await r3.goto('http://127.0.0.1:8765/?cut=screening'); await r3.waitForTimeout(1200);
  if (await r3.$('#intro')) errs.push('intro showed on a deep link'); else notes.push('deep link: no intro');
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
