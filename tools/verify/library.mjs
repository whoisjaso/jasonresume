// The After Hours Library, played end to end on desktop and mobile.
//   python3 -m http.server 8765 &   then   node tools/verify/library.mjs [desktop|mobile]
// Checks: the title screen on arrival (Start, who's playing, the name), the
// first frame's actions, moving focus, opening every title, trophies and the
// Platinum, the desk demo run to Filed, the screens, the deck and Check me;
// the doors (return visits, skip, deep links, legacy links, the dealer cut);
// privacy; the score staying silent until Start; the no-JS document; and the
// text rules (no dashes, no percent signs, no phone number, every number in
// llms.txt) over visible text, labels and attributes. Screenshots land in
// tools/verify/out/lib-*.png.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
const TOOLS = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ROOT = path.dirname(TOOLS);
const OUT = path.join(TOOLS, 'verify', 'out');
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
const URL0 = 'http://127.0.0.1:8765/';
const exe = [process.env.PW_CHROMIUM, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => f && fs.existsSync(f));
const b = await chromium.launch({ executablePath: exe });
const errs = [], notes = [];
const LLMS = fs.readFileSync(path.join(ROOT, 'llms.txt'), 'utf8') + fs.readFileSync(path.join(ROOT, 'llms-full.txt'), 'utf8');
const LIB = JSON.parse(fs.readFileSync(path.join(TOOLS, 'site', 'library.json'), 'utf8'));
const careers = LIB.titles.filter(t => t.career).map(t => t.id);
const fonts = path.join(TOOLS, 'fonts', 'fonts.css');

async function ctxFor(w, h, mobile, extra = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, ...extra });
  if (fs.existsSync(fonts)) {
    await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(fonts, 'utf8') }));
    await ctx.route('**/pwfonts/*', r => r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(path.join(TOOLS, 'fonts', r.request().url().split('/').pop())) }));
  }
  await ctx.route(/calendly\.com/, r => r.abort());
  await ctx.route('**/api/guide', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unconfigured"}' }));
  return ctx;
}
async function textRules(p, label) {
  const t = await p.evaluate(() => {
    const attrs = [...document.querySelectorAll('[aria-label],[title],[alt],[placeholder]')].map(e => [e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('alt'), e.getAttribute('placeholder')].filter(Boolean).join(' ')).join(' ');
    const data = ['library-data', 'onboarding-data', 'record-data'].map(id => (document.getElementById(id) || {}).textContent || '').join(' ');
    // the desk demo runs a fictional buyer with example figures; its numbers are labelled as such, so they sit outside the facts check
    const facts = [...document.body.querySelectorAll('[data-desk-app], .steps')].reduce((t, el) => t.replace(el.innerText, ''), document.body.innerText);
    return { text: document.body.innerText, facts, attrs, data: data.replace(/calendly\.com\/jason-apohenia/g, ''), head: document.head.innerHTML };
  });
  const all = t.text + ' ' + t.attrs + ' ' + t.data;
  if (/[—–]/.test(all)) errs.push(`${label} dash in text, labels or data: ${(all.match(/.{30}[—–].{30}/) || [''])[0]}`);
  if (/%/.test(t.text + ' ' + t.attrs)) errs.push(`${label} percent sign in text or labels`);
  if (/apohenia/i.test(t.text + ' ' + t.attrs + ' ' + t.data)) errs.push(`${label} Apohenia on the page`);
  if (/\(?\b832\)?[\s.-]?\d{3}[\s.-]?\d{4}\b|tel:/.test(all + t.head)) errs.push(`${label} a phone number on the page`);
  const nums = new Set((t.facts.match(/\$?\d[\d,]*(\.\d+)?/g) || []).filter(n => n.replace(/[$,.]/g, '').length >= 2));
  const unknown = [...nums].filter(n => !LLMS.includes(n.replace(/^\$/, '')) && !/^\d{1,2}:\d\d$/.test(n));
  const clock = /^(1[0-2]|[1-9])$/;
  const bad = unknown.filter(n => !clock.test(n));
  if (bad.length) errs.push(`${label} numbers on the page not in llms.txt: ${bad.join(' ')}`);
}
async function overflow(p, label) {
  const ov = await p.evaluate(() => ({ docW: document.documentElement.scrollWidth, winW: innerWidth }));
  if (ov.docW > ov.winW + 1) errs.push(`${label} horizontal overflow ${JSON.stringify(ov)}`);
}

for (const [name, w, h, mobile] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
  if (only && only !== name) continue;
  const ctx = await ctxFor(w, h, mobile);
  const tracked = [], scoreFetches = [];
  await ctx.route('**/api/track', async r => { try { tracked.push(...JSON.parse(r.request().postData() || '{}').events.map(e => e.event)); } catch {} r.fulfill({ status: 204, body: '' }); });
  const p = await ctx.newPage();
  p.on('request', r => { if (/assets\/score\//.test(r.url())) scoreFetches.push(r.url()); });
  p.on('pageerror', e => errs.push(`${name} pageerror: ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(`${name} console: ${m.text().slice(0, 160)}`); });
  const shot = async label => p.screenshot({ path: path.join(OUT, `lib-${name}-${label}.png`) });
  const t0 = Date.now();
  await p.goto(URL0, { waitUntil: 'domcontentloaded' });

  // The title screen: Press start, who's playing, the name
  await p.waitForSelector('#intro', { timeout: 4000 }).catch(() => errs.push(`${name} title screen did not appear`));
  await p.waitForTimeout(1200); await shot('00a-title');
  if (scoreFetches.length) errs.push(`${name} the score loaded before Start`);
  await p.click('[data-start="on"]');
  await p.waitForSelector('[data-scene="seat"].is-on', { timeout: 4000 }).catch(() => errs.push(`${name} no seat menu after Start`));
  await p.waitForTimeout(700); await shot('00b-seat');
  if (!(await p.evaluate(() => document.documentElement.classList.contains('score-on')))) errs.push(`${name} Start did not turn the score on`);
  await p.click('[data-role="interviewer"]');
  await p.waitForSelector('[data-scene="name"].is-on', { timeout: 4000 }); await p.waitForTimeout(500);
  await p.fill('#intro-name', 'Test Visitor'); await shot('00c-name'); await p.keyboard.press('Enter');
  await p.waitForTimeout(500); await shot('00d-card');
  await p.waitForSelector('#intro', { state: 'detached', timeout: 6000 }).catch(() => errs.push(`${name} title screen did not leave`));
  await p.waitForTimeout(1200);

  // The first frame: who, the numbers, and the actions, with nothing in front
  const first = await p.evaluate(() => {
    const vis = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom <= innerHeight + 1 && r.top >= 0; };
    const head = document.querySelector('article.title.is-focus .title__head');
    return {
      focus: (document.querySelector('.tile.is-focus') || {}).dataset?.title,
      tiles: document.querySelectorAll('.tile').length,
      open: vis(document.querySelector('article.title.is-focus [data-open-title]')),
      pdf: vis(document.querySelector('article.title.is-focus .title__acts [data-resume]')) || vis(document.querySelector('.sys [data-resume]')),
      mail: vis(document.querySelector('article.title.is-focus .title__acts [data-contact]')) || vis(document.querySelector('.sys [data-contact]')),
      logo: vis(head && head.querySelector('.title__logo')),
      stats: head ? head.querySelectorAll('.stat').length : 0,
      dialogs: document.querySelectorAll('dialog[open]').length, locked: document.documentElement.classList.contains('is-locked')
    };
  });
  if (first.focus !== 'triple-j' || first.tiles !== LIB.titles.length) errs.push(`${name} library row wrong ${JSON.stringify(first)}`);
  if (!first.open || !first.pdf || !first.mail || !first.logo) errs.push(`${name} first frame is missing an action or the title ${JSON.stringify(first)}`);
  if (first.stats !== 2) errs.push(`${name} first frame should show the two Triple J stats`);
  if (first.dialogs || first.locked) errs.push(`${name} something open or locked on arrival`);
  notes.push(`${name} title screen to library in ${Date.now() - t0} ms`);
  await shot('01-library'); await textRules(p, `${name} library`); await overflow(p, `${name} library`);

  // Moving focus: the ring, the key art, the title
  if (mobile) await p.click('.tile[data-title="lead-to-title"]'); else await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(1200);
  const moved = await p.evaluate(() => ({ tile: document.querySelector('.tile.is-focus')?.dataset.title, plate: document.querySelector('.plate.is-on')?.dataset.plate, logo: document.querySelector('article.title.is-focus .title__logo')?.textContent }));
  if (moved.tile !== 'lead-to-title' || moved.plate !== 'lead-to-title' || !/Lead to Title/i.test(moved.logo || '')) errs.push(`${name} focus did not move ${JSON.stringify(moved)}`);
  await shot('02-focus-crm');

  // Opening a title: its own page, a trophy, the sections, the desk demo
  if (mobile) await p.click('article.title.is-focus [data-open-title]'); else await p.keyboard.press('Enter');
  await p.waitForTimeout(1300);
  const opened = await p.evaluate(() => ({ open: !!document.querySelector('article.title.is-open'), hash: location.hash, toast: !!document.querySelector('.toast--trophy') }));
  if (!opened.open || opened.hash !== '#title/lead-to-title') errs.push(`${name} title did not open ${JSON.stringify(opened)}`);
  if (!opened.toast) errs.push(`${name} first open gave no trophy toast`);
  await shot('03-title-open');
  if (!mobile) { await p.keyboard.press('e'); await p.waitForTimeout(900); await shot('04-title-tab'); }
  await p.evaluate(() => document.querySelector('article.title.is-open [data-desk-app]').scrollIntoView({ block: 'center' })); await p.waitForTimeout(900);
  const c = sel => p.click(`[data-desk-app] .app-screen.is-on ${sel}`);
  try {
    await c('.app-btn--gold'); await p.waitForTimeout(500);
    await c('[data-car="2"]'); await p.waitForTimeout(1100);
    await c('[data-ok]'); await p.waitForTimeout(600);
    await c('[data-shutter]'); await p.waitForTimeout(2300);
    await c('[data-ok]'); await p.waitForTimeout(500);
    await c('[data-pay="bhph"]'); await c('[data-ok]'); await p.waitForTimeout(1500); await shot('05-desk-money');
    await c('[data-ok]'); await p.waitForTimeout(1300);
    await c('[data-ok]'); await p.waitForTimeout(500);
    await c('[data-auto]'); await c('[data-ok]'); await p.waitForTimeout(1200); await shot('06-desk-filed');
    if (!(await p.evaluate(() => /Filed/.test(document.querySelector('[data-desk-app] .app-screen.is-on').textContent)))) errs.push(`${name} desk did not reach Filed`);
  } catch (e) { errs.push(`${name} desk demo failed: ${e.message.split('\n')[0]}`); }
  await textRules(p, `${name} open title`); await overflow(p, `${name} open title`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(900);
  const closed = await p.evaluate(() => ({ open: !!document.querySelector('article.title.is-open'), locked: document.documentElement.classList.contains('is-locked'), hash: location.hash, inert: document.querySelectorAll('[inert]').length }));
  if (closed.open || closed.locked || closed.hash || closed.inert) errs.push(`${name} title did not close cleanly ${JSON.stringify(closed)}`);

  // Every career title: the Platinum
  for (const id of careers) {
    await p.evaluate(i => window.JG_GAME.open(i, 'test'), id); await p.waitForTimeout(700);
    await p.evaluate(() => window.JG_GAME.back()); await p.waitForTimeout(500);
  }
  await p.waitForSelector('.clear.is-on', { timeout: 9000 }).catch(() => errs.push(`${name} no Platinum after opening every career title`));
  await p.waitForTimeout(1600); await shot('07-platinum');
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);

  // Screens: trophies, profile
  await p.keyboard.press('t'); await p.waitForTimeout(900); await shot('08-trophies');
  const seen = await p.evaluate(() => document.querySelector('[data-trophy-seen]').textContent);
  if (seen !== String(Object.keys(LIB.trophies).length)) errs.push(`${name} trophies seen ${seen} after the Platinum`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  await p.keyboard.press('p'); await p.waitForTimeout(900); await shot('09-profile');
  await textRules(p, `${name} profile`); await overflow(p, `${name} profile`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);

  // Overlays: the deck and Check me
  await p.evaluate(() => window.JG_OPEN('deck', 'test')); await p.waitForTimeout(900); await shot('10-deck');
  for (let i = 0; i < 4; i++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(250); }
  const hash = await p.evaluate(() => location.hash); if (hash !== '#present/5') errs.push(`${name} deck hash was ${hash}`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.evaluate(() => window.JG_OPEN('verify', 'test')); await p.waitForTimeout(700); await shot('11-verify');
  await p.fill('#ask-q', 'What would you do first?'); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  const ans = await p.textContent('.ask-form__answer'); if (!/jobawems/.test(ans)) errs.push(`${name} ask fallback missing: ${ans}`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  if (await p.evaluate(() => document.documentElement.classList.contains('is-locked'))) errs.push(`${name} screen still locked after closing overlays`);

  await p.evaluate(() => { dispatchEvent(new Event('pagehide')); }); await p.waitForTimeout(1200);
  notes.push(`${name} events sent: ${[...new Set(tracked)].join(', ')}`);
  for (const ev of ['intro_shown', 'intro_started', 'role_chosen', 'name_given', 'intro_finished', 'story_opened', 'trophy_unlocked', 'level_clear', 'trophies_opened']) if (!tracked.includes(ev)) errs.push(`${name} never sent ${ev}`);
  await ctx.close();
}

// The trophy count matches the data
{
  const n = Object.keys(LIB.trophies).length;
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = html.match(/data-trophy-count>(\d+)</);
  if (!m || +m[1] !== n) errs.push(`trophy count in the bar ${m && m[1]} but ${n} in library.json`);
}

// The doors: Start muted stays silent, return visits, skip, deep links, legacy links, the dealer cut
if (!only || only === 'mobile') {
  const ctx = await ctxFor(390, 844, true);
  await ctx.route('**/api/track', r => r.fulfill({ status: 204, body: '' }));
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(`doors pageerror: ${e.message}`));
  const score = []; p.on('request', r => { if (/assets\/score\//.test(r.url())) score.push(r.url()); });
  await p.goto(URL0); await p.waitForSelector('#intro');
  await p.click('[data-start="off"]'); await p.waitForSelector('[data-scene="seat"].is-on');
  await p.click('[data-role="partner"]'); await p.waitForSelector('[data-scene="name"].is-on'); await p.waitForTimeout(400);
  await p.fill('#intro-name', 'Pat'); await p.keyboard.press('Enter');
  await p.waitForSelector('#intro', { state: 'detached', timeout: 6000 }); await p.waitForTimeout(700);
  if (score.length) errs.push('Start muted still fetched the score');
  else notes.push('start muted: no audio fetched');
  const f = await p.evaluate(() => document.querySelector('.tile.is-focus')?.dataset.title);
  if (f !== 'the-inbound') errs.push(`dealer seat should focus The Inbound, focused ${f}`); else notes.push('dealer seat: library reordered, The Inbound focused');
  await p.goto(URL0); await p.waitForTimeout(1000);
  if (!(await p.$('#intro'))) errs.push('title screen did not show to a return visitor');
  await p.click('[data-start="off"]'); await p.waitForSelector('[data-scene="seat"].is-on'); await p.click('[data-role="lurker"]');
  await p.waitForSelector('[data-scene="name"].is-on'); await p.waitForTimeout(400);
  const pre = await p.inputValue('#intro-name'); if (pre !== 'Pat') errs.push(`return visit name not prefilled: "${pre}"`);
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  const card = await p.textContent('.intro__card').catch(() => ''); if (!/Welcome back, Pat/.test(card)) errs.push(`return visit card said "${card}"`); else notes.push('return visit: welcomed back by name');
  await ctx.close();

  const c2 = await ctxFor(390, 844, true); await c2.route('**/api/track', r => r.fulfill({ status: 204, body: '' }));
  const q = await c2.newPage();
  await q.goto(URL0); await q.waitForSelector('#intro'); await q.click('[data-intro-skip]'); await q.waitForTimeout(1000);
  const sk = await q.evaluate(() => ({ intro: !!document.getElementById('intro'), locked: document.documentElement.classList.contains('is-locked'), score: document.documentElement.classList.contains('score-on') }));
  if (sk.intro || sk.locked || sk.score) errs.push(`skip left ${JSON.stringify(sk)}`); else notes.push('skip: gone, unlocked, silent');
  for (const [u, test, label] of [
    ['#present/2', () => !!document.querySelector('#deck[open]'), 'the deck'],
    ['#title/obavia', () => location.hash === '#title/obavia' && !!document.querySelector('#title-obavia.is-open'), 'the Obavia title'],
    ['#story-obavia', () => !!document.querySelector('#title-obavia.is-open'), 'a legacy story link'],
    ['#trophies', () => !!document.querySelector('#trophies.is-open'), 'the trophies screen'],
  ]) {
    await q.goto('about:blank'); await q.goto(URL0 + '?from=test' + u); await q.waitForSelector('#intro');
    if (await q.evaluate(() => !!document.querySelector('dialog[open], article.title.is-open'))) errs.push(`${u} opened under the title screen`);
    await q.click('[data-intro-skip]'); await q.waitForTimeout(1500);
    if (!(await q.evaluate(test))) errs.push(`deep link ${u} did not open ${label}`); else notes.push(`deep link ${u}: title screen first, then ${label}`);
  }
  await q.goto('about:blank');
  await q.goto(URL0 + '?cut=dealer'); await q.waitForSelector('#intro'); await q.click('[data-intro-skip]');
  await q.waitForURL(/obavia\.html/, { timeout: 6000 }).then(() => notes.push('?cut=dealer: on to /obavia.html')).catch(() => errs.push('?cut=dealer did not go to /obavia.html'));
  await c2.close();

  // phone landscape: no overflow, the actions on screen
  const c4 = await ctxFor(844, 390, true); await c4.route('**/api/track', r => r.fulfill({ status: 204, body: '' }));
  await c4.addInitScript(() => { try { sessionStorage.setItem('x', '1'); } catch (e) {} });
  const l = await c4.newPage(); await l.goto(URL0); await l.waitForSelector('#intro'); await l.click('[data-intro-skip]'); await l.waitForTimeout(1200);
  await l.screenshot({ path: path.join(OUT, 'lib-landscape.png') }); await overflow(l, 'phone landscape');
  await c4.close();
}

// No JavaScript: the whole record is a readable document
{
  const ctx = await ctxFor(1280, 900, false, { javaScriptEnabled: false });
  const p = await ctx.newPage(); await p.goto(URL0);
  const doc = await p.evaluate(() => ({ h2: [...document.querySelectorAll('article.title h2')].filter(h => h.getBoundingClientRect().height > 0).length, trophies: [...document.querySelectorAll('#trophies .trophy')].filter(t => t.getBoundingClientRect().height > 0).length, text: document.body.innerText }));
  if (doc.h2 !== LIB.titles.length) errs.push(`no-JS: ${doc.h2} of ${LIB.titles.length} titles readable`);
  if (doc.trophies !== Object.keys(LIB.trophies).length) errs.push(`no-JS: ${doc.trophies} trophies readable`);
  if (!/\$206,777/.test(doc.text) || !/University of Texas at Austin/.test(doc.text)) errs.push('no-JS: the record is missing facts');
  else notes.push('no JavaScript: every title and trophy readable');
  await p.screenshot({ path: path.join(OUT, 'lib-nojs.png'), fullPage: false });
  await ctx.close();
}

// Privacy: with Global Privacy Control or Do Not Track on, nothing reaches /api/track
for (const flag of ['globalPrivacyControl', 'doNotTrack']) {
  if (only && only !== 'desktop') break;
  const ctx = await ctxFor(1280, 800, false);
  await ctx.addInitScript(f => Object.defineProperty(Navigator.prototype, f, { get: () => f === 'doNotTrack' ? '1' : true }), flag);
  let sent = 0; await ctx.route('**/api/track', r => { sent++; r.fulfill({ status: 204, body: '' }); });
  const p = await ctx.newPage();
  await p.goto(URL0, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('#intro'); await p.click('[data-intro-skip]'); await p.waitForTimeout(900);
  await p.evaluate(() => window.JG_GAME && window.JG_GAME.open('triple-j', 'test')); await p.waitForTimeout(400);
  await p.evaluate(() => dispatchEvent(new Event('pagehide'))); await p.waitForTimeout(800);
  if (sent) errs.push(`${flag}: ${sent} request(s) reached /api/track`); else notes.push(`${flag} on: nothing sent`);
  await ctx.close();
}
await b.close();
console.log(notes.join('\n'));
console.log(errs.length ? 'ISSUES:\n' + errs.join('\n') : 'no page errors, no overflow, no dashes, no percent signs, no phone number, every number in llms.txt, every scene played');
