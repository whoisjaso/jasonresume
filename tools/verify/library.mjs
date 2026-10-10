// The After Hours Library, played end to end on desktop and mobile.
//   python3 -m http.server 8765 &   then   node tools/verify/library.mjs [desktop|mobile]
// Checks: the title screen on arrival (Start, who's playing, the build, the
// name and the card), Player 2 (the build screen, its edits, the card saved
// as a 1080 by 1350 PNG, a shared build link, a ?for= link), the funnel
// (availability only beside a hiring visitor's actions, a ?for= reading as
// sent, a dealer's quiet hiring question and the lot's next step on its card,
// nothing on a lurker's card and a referral in their Player 2, and never on
// the card), the listing pasted on a phone, the focused title clear of the
// library row on short laptops, the band under the fixed chrome in Player 2,
// the first frame's actions, moving focus, opening every title, trophies and the
// Platinum, the desk demo run to Filed, the screens, the deck and Check me;
// the doors (return visits, skip, deep links, legacy links, the dealer cut);
// privacy; the score staying silent until Start; the no-JS document; the
// loading screen (drawn while the art, the fonts and the scripts arrive, gone
// soon after, never for crawlers or the site's own links); the guided tour
// (every stop, its line, the vignette on its subject, Back, keys, a clean
// silent exit) on both sizes; the walkthrough film (its dialog on the title
// screen and its page) when it has been rendered; and the
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
  // a comma after a number is punctuation ("Microsoft 365, Google Workspace"), not part of it
  const nums = new Set((t.facts.replace(/\b\d{1,2}:\d\d\s?(AM|PM)?/gi, '').replace(/\bCC BY( SA)? \d\.\d\b/g, '').match(/\$?\d[\d,]*(\.\d+)?/g) || []).map(n => n.replace(/,+$/, '')).filter(n => n.replace(/[$,.]/g, '').length >= 2));
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

  // The loading screen first: a line drawing of the lot, measured on real loading, then the title screen
  const boot = await p.evaluate(() => { const b = document.getElementById('boot'); return { on: !!b && getComputedStyle(b).display !== 'none', strokes: b ? b.querySelectorAll('.boot__lines path').length : 0 }; });
  if (!boot.on || boot.strokes < 40) errs.push(`${name} no loading screen on arrival ${JSON.stringify(boot)}`);
  await p.waitForTimeout(250); await shot('00-boot');
  await p.waitForSelector('#boot', { state: 'detached', timeout: 9000 }).catch(() => errs.push(`${name} the loading screen never left`));
  notes.push(`${name} loading screen gone ${Date.now() - t0} ms after navigation`);
  // The title screen: Press start, who's playing, the name
  await p.waitForSelector('#intro', { timeout: 4000 }).catch(() => errs.push(`${name} title screen did not appear`));
  await p.waitForTimeout(1200); await shot('00a-title');
  if (!(await p.$('#intro [data-intro-tour]'))) errs.push(`${name} the title screen offers no tour`);
  if (scoreFetches.length) errs.push(`${name} the score loaded before Start`);
  await p.click('[data-start="on"]');
  await p.waitForSelector('[data-scene="seat"].is-on', { timeout: 4000 }).catch(() => errs.push(`${name} no seat menu after Start`));
  await p.waitForTimeout(700); await shot('00b-seat');
  if (!(await p.evaluate(() => document.documentElement.classList.contains('score-on')))) errs.push(`${name} Start did not turn the score on`);
  await p.click('[data-role="interviewer"]');
  // The build: what you're hiring for
  await p.waitForSelector('[data-scene="build"].is-on', { timeout: 4000 }).catch(() => errs.push(`${name} no build step after the seat`));
  await p.waitForTimeout(900); await shot('00c-build');
  const rowsN = await p.$$eval('[data-build-menu] .menu__row[data-n]', r => r.length);
  if (rowsN < 8) errs.push(`${name} build step shows ${rowsN} roles`);
  // the listing comes first for someone hiring, and the extra row carries no number (keys 1 to 9 are the readings)
  const menu = await p.evaluate(() => { const r = [...document.querySelectorAll('[data-build-menu] .menu__row')]; return { first: r[0]?.dataset.id, on: document.querySelector('[data-build-menu] .menu__row.is-on')?.dataset.id, badges: r.map(x => x.querySelector('.menu__n')?.textContent.trim()).filter(Boolean) }; });
  if (menu.first !== 'paste' || menu.on === 'paste' || menu.badges.some(n => !/^[1-9]$/.test(n))) errs.push(`${name} build menu: paste first, unnumbered, a reading highlighted ${JSON.stringify(menu)}`);
  await textRules(p, `${name} build step`); await overflow(p, `${name} build step`);
  await p.click('[data-build-menu] [data-id="ops"]');
  await p.waitForSelector('[data-scene="name"].is-on', { timeout: 4000 }); await p.waitForTimeout(500);
  if (!/Sign your build/i.test(await p.textContent('[data-name-h]'))) errs.push(`${name} name step should ask to sign the build`);
  await p.fill('#intro-name', 'Test Visitor'); await shot('00d-name'); await p.keyboard.press('Enter');
  await p.waitForSelector('[data-scene="card"].is-on [data-built]:not([hidden]) .bcard', { timeout: 4000 }).catch(() => errs.push(`${name} no card after signing`));
  await p.waitForTimeout(1800); await shot('00e-card');
  const cardTxt = await p.textContent('[data-built-card]').catch(() => '');
  if (!/Operations and Logistics/i.test(cardTxt) || !/Built by Test Visitor/.test(cardTxt)) errs.push(`${name} card text wrong: ${cardTxt.slice(0, 120)}`);
  // the funnel for someone hiring: the role's resume beside Enter, one fine line, nothing on the card
  const fun = await p.evaluate(() => ({ resume: document.querySelector('#intro [data-built] [data-build-resume]')?.getAttribute('href') || '', line: (document.querySelector('#intro [data-built-more]:not([hidden])') || {}).textContent || '', ref: !!document.querySelector('#intro [data-referral]') }));
  if (!/Resume_Operations_and_Logistics\.pdf/.test(fun.resume)) errs.push(`${name} hiring card has no Resume for this role: ${fun.resume}`);
  if (!/open to full-time, part-time and contract roles/.test(fun.line) || fun.ref) errs.push(`${name} hiring card line wrong ${JSON.stringify(fun)}`);
  if (/open to/i.test(cardTxt)) errs.push(`${name} availability is on the card itself`);
  await textRules(p, `${name} card`); await overflow(p, `${name} card`);
  await p.click('[data-enter]');
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
  const p2 = await p.evaluate(() => ({ slot: document.querySelector('[data-p2]')?.textContent || '', resume: document.querySelector('.sys [data-resume]')?.getAttribute('href') || '' }));
  if (!/Operations/.test(p2.slot)) errs.push(`${name} Player 2 slot does not show the build: ${p2.slot}`);
  if (!/Resume_Operations_and_Logistics\.pdf(\?v=\w+)?$/.test(p2.resume)) errs.push(`${name} Resume does not serve the build's PDF: ${p2.resume}`);
  else if (!fs.existsSync(path.join(ROOT, p2.resume.split('?')[0]))) errs.push(`${name} the build's PDF is missing: ${p2.resume}`);
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
  await p.waitForSelector('article.title.is-open', { timeout: 4000 }).catch(() => {}); await p.waitForTimeout(600);
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

  // Player 2: the build screen, edits, the card as an image, the link
  if (mobile) await p.click('[data-p2]'); else await p.keyboard.press('j');
  await p.waitForSelector('#build.is-open .bcard', { timeout: 4000 }).catch(() => errs.push(`${name} Player 2 did not open the build screen`));
  await p.waitForTimeout(900); await shot('09b-build');
  await p.click('#build [data-pick="role:it"]'); await p.waitForTimeout(700);
  await p.click('#build [data-equip="daily"]').catch(() => {}); await p.waitForTimeout(300);
  await p.click('#build [data-art="the-inbound"]'); await p.waitForTimeout(500);
  const bs = await p.evaluate(() => { const b = window.JG_BUILD.get(); return { id: b.id, a: b.a, p: b.p.length, n: b.n, card: document.querySelector('#build .bcard__class')?.textContent }; });
  if (bs.id !== 'it' || bs.a !== 'the-inbound' || bs.p !== 4 || !/IT and Systems Support/i.test(bs.card || '')) errs.push(`${name} build edits did not stick ${JSON.stringify(bs)}`);
  const p2f = await p.evaluate(() => ({ line: !!document.querySelector('#build .build__acts [data-open-line]'), hire: !!document.querySelector('#build [data-hire-line]'), ref: !!document.querySelector('#build [data-referral-line]'), card: document.querySelector('#build .bcard')?.textContent || '' }));
  if (!p2f.line || p2f.hire || p2f.ref || /open to/i.test(p2f.card)) errs.push(`${name} Player 2 funnel for someone hiring ${JSON.stringify({ ...p2f, card: undefined })}`);
  await shot('09c-build-edited'); await textRules(p, `${name} build screen`); await overflow(p, `${name} build screen`);
  const dl = p.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await p.click('#build [data-save]');
  const d = await dl;
  if (!d) errs.push(`${name} Save the card gave no download`);
  else { const f = path.join(OUT, `lib-${name}-card.png`); await d.saveAs(f); const buf = fs.readFileSync(f); const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20); if (w !== 1080 || h !== 1350) errs.push(`${name} card image is ${w}x${h}`); else notes.push(`${name} card saved as a 1080 by 1350 PNG`); }
  await p.keyboard.press('Escape'); await p.waitForTimeout(600);
  if (await p.evaluate(() => !!document.querySelector('#build.is-open'))) errs.push(`${name} Escape did not close the build screen`);

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
  for (const ev of ['intro_shown', 'intro_started', 'role_chosen', 'build_shown', 'build_chosen', 'name_given', 'intro_finished', 'story_opened', 'trophy_unlocked', 'level_clear', 'trophies_opened', 'build_opened', 'build_edited', 'card_saved']) if (!tracked.includes(ev)) errs.push(`${name} never sent ${ev}`);
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
  await p.click('[data-role="partner"]'); await p.waitForSelector('[data-scene="build"].is-on'); await p.waitForTimeout(500);
  if (!/slowing your lot/i.test(await p.textContent('[data-build-h]'))) errs.push('dealer seat did not ask about the lot');
  await p.click('[data-build-skip]'); await p.waitForSelector('[data-scene="name"].is-on'); await p.waitForTimeout(400);
  if (/Sign your build/i.test(await p.textContent('[data-name-h]'))) errs.push('skipping the build still asked to sign it');
  await p.fill('#intro-name', 'Pat'); await p.keyboard.press('Enter');
  await p.waitForSelector('#intro', { state: 'detached', timeout: 6000 }); await p.waitForTimeout(700);
  if (score.length) errs.push('Start muted still fetched the score');
  else notes.push('start muted: no audio fetched');
  const f = await p.evaluate(() => document.querySelector('.tile.is-focus')?.dataset.title);
  if (f !== 'the-inbound') errs.push(`dealer seat should focus The Inbound, focused ${f}`); else notes.push('dealer seat: library reordered, The Inbound focused');
  await p.goto(URL0); await p.waitForTimeout(1000);
  if (!(await p.$('#intro'))) errs.push('title screen did not show to a return visitor');
  await p.click('[data-start="off"]'); await p.waitForSelector('[data-scene="seat"].is-on'); await p.click('[data-role="lurker"]');
  await p.waitForSelector('[data-scene="build"].is-on'); await p.waitForTimeout(400); await p.keyboard.press('Escape');
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
  // A shared build: the title screen first, no build step, then the build as its maker left it
  await q.goto('about:blank');
  await q.goto(URL0 + '#build/v1/it/help-desk+access+network+rls/lead-to-title/silver/Sam'); await q.waitForSelector('#intro');
  await q.click('[data-start="off"]'); await q.waitForSelector('[data-scene="seat"].is-on'); await q.click('[data-role="interviewer"]');
  await q.waitForSelector('[data-scene="name"].is-on', { timeout: 4000 }).catch(() => errs.push('a shared build link still asked for a build'));
  await q.click('[data-name-skip]'); await q.waitForTimeout(3600);
  const sh = await q.evaluate(() => ({ open: !!document.querySelector('#build.is-open'), lede: document.querySelector('#build .build__lede')?.textContent || '', card: document.querySelector('#build .bcard__class')?.textContent || '', fin: !!document.querySelector('#build .bcard--silver') }));
  if (!sh.open || !/Sam built me for/.test(sh.lede) || !/IT and Systems Support/i.test(sh.card) || !sh.fin) errs.push(`shared build did not open as left ${JSON.stringify(sh)}`);
  else notes.push('shared build link: title screen first, then Sam\'s build');
  if (!(await q.evaluate(() => !!document.querySelector('#build [data-open-line]')))) errs.push('shared build opened by someone hiring has no availability line');
  await q.screenshot({ path: path.join(OUT, 'lib-shared-build.png') }); await overflow(q, 'shared build');
  // ?for=it from an application: the role is highlighted, and the library reads for it even when skipped
  const c3 = await ctxFor(1280, 800, false); await c3.route('**/api/track', r => r.fulfill({ status: 204, body: '' }));
  const r3 = await c3.newPage(); await r3.goto(URL0 + '?for=it'); await r3.waitForSelector('#intro');
  await r3.click('[data-start="off"]'); await r3.waitForSelector('[data-scene="seat"].is-on'); await r3.click('[data-role="interviewer"]');
  await r3.waitForSelector('[data-scene="build"].is-on'); await r3.waitForTimeout(500);
  const hi = await r3.textContent('[data-build-menu] .menu__row.is-on');
  if (!/IT and Systems Support/.test(hi)) errs.push(`?for=it highlighted "${hi}"`);
  await r3.keyboard.press('Escape'); await r3.waitForSelector('[data-scene="name"].is-on'); await r3.click('[data-name-skip]'); await r3.waitForTimeout(3600);
  const f3 = await r3.evaluate(() => ({ url: location.search, slot: document.querySelector('[data-p2]')?.textContent || '', resume: document.querySelector('.sys [data-resume]')?.getAttribute('href') || '', focus: document.querySelector('.tile.is-focus')?.dataset.title }));
  if (f3.url || !/Read for IT/.test(f3.slot) || !/IT_and_Systems_Support/.test(f3.resume) || f3.focus !== 'lead-to-title') errs.push(`?for=it did not read the library for IT ${JSON.stringify(f3)}`);
  else notes.push('?for=it: role highlighted, library and Resume read for IT');
  // nothing built yet: Player 2 is the reading as I sent it, then Make it yours
  await r3.keyboard.press('j'); await r3.waitForSelector('#build.is-open', { timeout: 4000 }).catch(() => {}); await r3.waitForTimeout(800);
  const sent = await r3.evaluate(() => ({ lede: document.querySelector('#build .build__lede')?.textContent || '', sum: document.querySelector('#build .build__panel .build__head')?.textContent || '', hl: (document.querySelector('#build .build__panel')?.innerText || '').split(document.querySelector('#build .bcard__line')?.textContent || '\u0000').length - 1, resume: document.querySelector('#build [data-build-resume]')?.getAttribute('href') || '', line: !!document.querySelector('#build [data-open-line]'), make: !!document.querySelector('#build [data-make-yours]'), chips: document.querySelectorAll('#build [data-pick]').length }));
  // the card carries the headline; the panel goes straight to the summary
  if (!/reading I sent you/.test(sent.lede) || !/IT and Systems Support/.test(sent.lede) || !sent.sum || sent.hl || !/IT_and_Systems_Support/.test(sent.resume) || !sent.line || !sent.make || sent.chips) errs.push(`?for=it Player 2 did not show the reading as sent ${JSON.stringify(sent)}`);
  await textRules(r3, '?for=it Player 2'); await overflow(r3, '?for=it Player 2');
  await r3.click('#build [data-make-yours]'); await r3.waitForTimeout(700);
  const made = await r3.evaluate(() => ({ b: window.JG_BUILD.get(), chips: document.querySelectorAll('#build [data-pick]').length }));
  if (!made.b || made.b.id !== 'it' || !made.chips) errs.push(`Make it yours did not start a build ${JSON.stringify(made)}`);
  else notes.push('?for=it Player 2: the reading as sent, the resume and the line, then Make it yours');
  await c3.close();
  await q.goto('about:blank');
  await q.goto(URL0 + '?cut=dealer'); await q.waitForSelector('#intro'); await q.click('[data-intro-skip]');
  await q.waitForURL(/obavia\.html/, { timeout: 6000 }).then(() => notes.push('?cut=dealer: on to /obavia.html')).catch(() => errs.push('?cut=dealer did not go to /obavia.html'));
  await c2.close();

  // The dealer: the lot answer and its call to action, then one quiet line for a dealer who is hiring
  const c5 = await ctxFor(390, 844, true); await c5.route('**/api/track', r => r.fulfill({ status: 204, body: '' }));
  const d5 = await c5.newPage(); d5.on('pageerror', e => errs.push(`dealer funnel pageerror: ${e.message}`));
  await d5.goto(URL0); await d5.waitForSelector('#intro'); await d5.click('[data-start="off"]'); await d5.waitForSelector('[data-scene="seat"].is-on');
  await d5.click('[data-role="partner"]'); await d5.waitForSelector('[data-scene="build"].is-on'); await d5.waitForTimeout(500);
  await d5.click('[data-build-menu] [data-id="paperwork"]'); await d5.waitForSelector('[data-scene="name"].is-on'); await d5.fill('#intro-name', 'Pat'); await d5.keyboard.press('Enter');
  await d5.waitForSelector('[data-scene="card"].is-on [data-built]:not([hidden])'); await d5.waitForTimeout(600);
  // the dealer's card scene: the lot's own next step beside Enter, and no hiring pitch
  const dc = await d5.evaluate(() => ({ more: !document.querySelector('#intro [data-built-more]').hidden, resume: !!document.querySelector('#intro [data-build-resume]'), cta: document.querySelector('#intro [data-built-acts] [data-build-obavia], #intro [data-built-acts] [data-book]')?.textContent || '', open: /open to/i.test(document.getElementById('intro').innerText) }));
  if (dc.more || dc.resume || dc.open) errs.push(`dealer card carries a hiring pitch ${JSON.stringify(dc)}`);
  if (!/Obavia early access/.test(dc.cta)) errs.push(`dealer card has no next step for the lot ${JSON.stringify(dc)}`);
  await d5.click('[data-enter]'); await d5.waitForSelector('#intro', { state: 'detached', timeout: 6000 }); await d5.waitForTimeout(700);
  await d5.click('[data-p2]'); await d5.waitForSelector('#build.is-open .bcard'); await d5.waitForTimeout(700);
  const dl5 = await d5.evaluate(() => ({ cta: !!document.querySelector('#build [data-build-obavia], #build [data-book]'), hire: document.querySelector('#build [data-hire-line]')?.textContent || '', to: document.querySelector('#build [data-hire]')?.getAttribute('data-hire') || '', line: !!document.querySelector('#build [data-open-line]:not([data-hire-line])'), open: /open to/i.test(document.getElementById('build').innerText) }));
  // one quiet question; the availability waits for the switch
  if (!dl5.cta || !/^Hiring for your lot\? Read me for Title and Back Office$/.test(dl5.hire.trim()) || dl5.to !== 'title' || dl5.line || dl5.open) errs.push(`dealer Player 2 funnel ${JSON.stringify(dl5)}`);
  await textRules(d5, 'dealer Player 2'); await overflow(d5, 'dealer Player 2');
  await d5.click('#build [data-hire]'); await d5.waitForTimeout(800);
  const dh = await d5.evaluate(() => ({ b: window.JG_BUILD.get(), line: !!document.querySelector('#build [data-open-line]'), opens: (document.getElementById('build').innerText.match(/open to full-time/gi) || []).length, resume: document.querySelector('#build [data-build-resume]')?.getAttribute('href') || '', card: document.querySelector('#build .bcard')?.textContent || '', cardTop: Math.round(document.querySelector('#build [data-cardwrap]').getBoundingClientRect().top), toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' ') }));
  // the line shows once, after the switch, and a phone sees the repainted card
  if (dh.b.kind !== 'role' || dh.b.id !== 'title' || dh.b.n !== 'Pat' || !dh.line || dh.opens !== 1 || !/Title_and_Back_Office/.test(dh.resume) || /open to/i.test(dh.card)) errs.push(`dealer hiring link did not switch the build ${JSON.stringify({ ...dh, card: undefined })}`);
  if (dh.cardTop < 0 || dh.cardTop > 844 / 2 || !/Read for Title and Back Office/.test(dh.toast)) errs.push(`dealer hiring switch: the repainted card is off screen ${JSON.stringify({ cardTop: dh.cardTop, toast: dh.toast })}`);
  else notes.push('dealer: lot answer and its call to action, then the hiring line switches to Title and Back Office');
  await c5.close();

  // Just looking: no availability anywhere, a referral that copies the build link
  const c6 = await ctxFor(390, 844, true); await c6.grantPermissions(['clipboard-read', 'clipboard-write']);
  const ev6 = []; await c6.route('**/api/track', r => { try { ev6.push(...JSON.parse(r.request().postData() || '{}').events); } catch {} r.fulfill({ status: 204, body: '' }); });
  const l6 = await c6.newPage(); l6.on('pageerror', e => errs.push(`lurker funnel pageerror: ${e.message}`));
  await l6.goto(URL0); await l6.waitForSelector('#intro'); await l6.click('[data-start="off"]'); await l6.waitForSelector('[data-scene="seat"].is-on');
  await l6.click('[data-role="lurker"]'); await l6.waitForSelector('[data-scene="build"].is-on'); await l6.waitForTimeout(500);
  await l6.click('[data-build-menu] [data-id="sales"]'); await l6.waitForSelector('[data-scene="name"].is-on'); await l6.fill('#intro-name', 'Lou'); await l6.keyboard.press('Enter');
  await l6.waitForSelector('[data-scene="card"].is-on [data-built]:not([hidden])'); await l6.waitForTimeout(600);
  // the seat promised no pitch: the card scene is the card, Enter and Save, nothing else
  const lc = await l6.evaluate(() => ({ text: document.getElementById('intro').innerText, ref: !!document.querySelector('#intro [data-referral]'), resume: !!document.querySelector('#intro [data-build-resume]'), more: !document.querySelector('#intro [data-built-more]').hidden, acts: document.querySelectorAll('#intro [data-built-acts] a, #intro [data-built-acts] button').length }));
  if (lc.ref || lc.resume || lc.more || lc.acts !== 2 || /open to|hiring/i.test(lc.text)) errs.push(`lurker card funnel ${JSON.stringify({ ...lc, text: undefined })}`);
  await l6.click('[data-enter]'); await l6.waitForSelector('#intro', { state: 'detached', timeout: 6000 }); await l6.waitForTimeout(700);
  await l6.click('[data-p2]'); await l6.waitForSelector('#build.is-open .bcard'); await l6.waitForTimeout(700);
  // Player 2: one referral that is also the one way to copy the link; no resume button, no availability
  const lp = await l6.evaluate(() => ({ text: document.getElementById('build').innerText, ref: !!document.querySelector('#build [data-referral-line]'), hire: !!document.querySelector('#build [data-hire-line]'), copy: !!document.querySelector('#build [data-copy-link]'), resume: !!document.querySelector('#build .build__acts [data-build-resume]') }));
  if (!lp.ref || lp.hire || lp.copy || lp.resume || /open to/i.test(lp.text)) errs.push(`lurker Player 2 funnel ${JSON.stringify({ ...lp, text: undefined, open: /open to/i.test(lp.text) })}`);
  await l6.click('#build [data-referral]'); await l6.waitForTimeout(500);
  const clip = await l6.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  if (!/#build\/v1\/[a-z-]+\/.+\/Lou$/.test(clip)) errs.push(`referral copied "${clip}"`);
  await l6.evaluate(() => dispatchEvent(new Event('pagehide'))); await l6.waitForTimeout(900);
  if (!ev6.some(e => e.event === 'build_link_copied' && e.props && e.props.where === 'referral')) errs.push('the referral was not tracked as build_link_copied where referral');
  else notes.push('just looking: no availability, the referral copies the build link');
  await c6.close();

  // A listing pasted on a phone: the match and Build it stay on screen
  const c7 = await ctxFor(390, 844, true); await c7.route('**/api/track', r => r.fulfill({ status: 204, body: '' }));
  const m7 = await c7.newPage(); m7.on('pageerror', e => errs.push(`phone paste pageerror: ${e.message}`));
  const BDC = fs.readFileSync(path.join(TOOLS, 'verify', 'match.test.mjs'), 'utf8').match(/bdc: `([\s\S]*?)`/)[1];
  await m7.goto(URL0); await m7.waitForSelector('#intro'); await m7.click('[data-start="off"]'); await m7.waitForSelector('[data-scene="seat"].is-on');
  await m7.click('[data-role="interviewer"]'); await m7.waitForSelector('[data-scene="build"].is-on'); await m7.waitForTimeout(500);
  await m7.click('[data-build-menu] [data-id="paste"]'); await m7.waitForTimeout(400);
  await m7.fill('#intro-list', BDC); await m7.click('[data-paste] button[type="submit"]'); await m7.waitForTimeout(900);
  const go7 = await m7.evaluate(() => { const g = document.querySelector('[data-go-build]'); const r = g ? g.getBoundingClientRect() : { width: 0, height: 0, top: -1, bottom: -1 }; return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), chips: document.querySelectorAll('[data-build-preview] .cls__chips li').length, h3: document.querySelector('[data-build-preview] .cls__name')?.textContent || '' }; });
  if (!go7.w || !go7.h || go7.top < 0 || go7.bottom > 844 || !go7.chips) errs.push(`phone paste: the match result is not on screen ${JSON.stringify(go7)}`);
  else notes.push(`phone paste: ${go7.chips} terms matched, Build it on screen for ${go7.h3}`);
  await m7.screenshot({ path: path.join(OUT, 'lib-phone-paste.png') });
  await m7.click('[data-go-build]'); await m7.waitForSelector('[data-scene="name"].is-on', { timeout: 4000 }).catch(() => errs.push('phone paste: Build it did not build'));
  await c7.close();

  // A ?for= reading on a phone, nothing built: the Player 2 slot names it
  const c8 = await ctxFor(390, 844, true); await c8.route('**/api/track', r => r.fulfill({ status: 204, body: '' }));
  const f8 = await c8.newPage(); await f8.goto(URL0 + '?for=title'); await f8.waitForSelector('#intro'); await f8.click('[data-intro-skip]'); await f8.waitForTimeout(1200);
  const s8 = await f8.evaluate(() => { const t = document.querySelector('[data-p2] [data-p2-label]'); const r = t ? t.getBoundingClientRect() : { width: 0, right: 0 }; return { w: Math.round(r.width), right: Math.round(r.right), text: t ? t.textContent : '' }; });
  if (!s8.w || s8.right > 390 || !/Read for Back office/.test(s8.text)) errs.push(`phone ?for=title: the Player 2 slot does not name the reading ${JSON.stringify(s8)}`);
  else notes.push('phone ?for=title: the Player 2 slot reads "Read for Back office"');
  await overflow(f8, 'phone ?for= slot');
  // the same reading opened by someone just looking: the reading and its resume, never the availability line
  await f8.evaluate(() => { try { localStorage.setItem('jg_role', 'lurker'); } catch (e) {} });
  await f8.click('[data-p2]'); await f8.waitForSelector('#build.is-open', { timeout: 4000 }).catch(() => {}); await f8.waitForTimeout(700);
  const l8 = await f8.evaluate(() => ({ sent: /reading I sent you/.test(document.getElementById('build').innerText), open: /open to/i.test(document.getElementById('build').innerText) }));
  if (!l8.sent || l8.open) errs.push(`?for= opened by someone just looking ${JSON.stringify(l8)}`);
  else notes.push('?for= opened by someone just looking: the reading as sent, no availability line');
  await c8.close();

  // phone landscape: no overflow, the actions on screen
  const c4 = await ctxFor(844, 390, true); await c4.route('**/api/track', r => r.fulfill({ status: 204, body: '' }));
  await c4.addInitScript(() => { try { sessionStorage.setItem('x', '1'); } catch (e) {} });
  const l = await c4.newPage(); await l.goto(URL0); await l.waitForSelector('#intro'); await l.click('[data-intro-skip]'); await l.waitForTimeout(1200);
  await l.screenshot({ path: path.join(OUT, 'lib-landscape.png') }); await overflow(l, 'phone landscape');
  await c4.close();
}

// Laptops: the focused title stays clear of the library row and above the legend, for every title
if (!only || only === 'desktop') {
  for (const [w, h] of [[1366, 768], [1536, 864], [1280, 720], [1366, 650]]) {
    const ctx = await ctxFor(w, h, false); await ctx.route('**/api/track', r => r.fulfill({ status: 204, body: '' }));
    await ctx.addInitScript(() => { try { localStorage.setItem('jg_role', 'partner'); } catch (e) {} });
    const p = await ctx.newPage(); await p.goto(URL0); await p.waitForSelector('#intro'); await p.click('[data-intro-skip]'); await p.waitForTimeout(1000);
    const bad = [];
    for (const id of LIB.titles.map(t => t.id)) {
      await p.evaluate(i => window.JG_GAME.focus(i), id); await p.waitForTimeout(800);
      const m = await p.evaluate(() => {
        const row = Math.max(...[...document.querySelectorAll('.tile')].map(t => t.getBoundingClientRect().bottom));
        const logo = document.querySelector('article.title.is-focus .title__logo').getBoundingClientRect();
        const acts = document.querySelector('article.title.is-focus .title__acts').getBoundingClientRect();
        const lg = document.querySelector('.legend').getBoundingClientRect();
        return { gap: Math.round(logo.top - row), foot: Math.round((lg.height ? lg.top : innerHeight) - acts.bottom) };
      });
      if (m.gap < 0 || m.foot < 0) bad.push(`${id} ${JSON.stringify(m)}`);
    }
    if (bad.length) errs.push(`${w}x${h}: a focused title runs under the library row or the legend: ${bad.join('; ')}`);
    else notes.push(`${w}x${h}: every focused title clear of the library row and the legend`);
    if (w === 1366 && h === 768) { await p.evaluate(() => window.JG_GAME.focus('the-inbound')); await p.waitForTimeout(900); await p.screenshot({ path: path.join(OUT, 'lib-laptop-inbound.png') }); }
    // Player 2 scrolled: Back stays put, and the panel goes under a solid band, not through the bar
    if (w === 1366 && h === 768) {
      await p.evaluate(() => window.JG_BUILD.make('lot', 'calls', 'test')); await p.keyboard.press('j'); await p.waitForSelector('#build.is-open .bcard'); await p.waitForTimeout(900);
      await p.evaluate(() => { document.getElementById('build').scrollTop = 600; }); await p.waitForTimeout(400);
      const band = await p.evaluate(() => { const s = document.getElementById('build'); const bf = getComputedStyle(s, '::before'); const bk = s.querySelector('.screen__back').getBoundingClientRect(); return { back: Math.round(bk.top), bg: bf.backgroundColor, pos: bf.position, h: parseFloat(bf.height) }; });
      if (band.back < 0 || band.back > 30 || band.pos !== 'fixed' || band.bg !== 'rgb(10, 15, 13)' || band.h < 60) errs.push(`Player 2 scrolled: Back or the band moved ${JSON.stringify(band)}`);
      else notes.push('Player 2 scrolled: Back stays, the panel goes under a solid band');
      await p.screenshot({ path: path.join(OUT, 'lib-p2-scrolled.png') });
    }
    await ctx.close();
  }
}

// The guided tour: from the title screen, every stop on both sizes, then a clean, silent exit
{
  const TOURD = JSON.parse(fs.readFileSync(path.join(TOOLS, 'site', 'tour.json'), 'utf8'));
  for (const [name, w, h, mobile] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
    if (only && only !== name) continue;
    const ctx = await ctxFor(w, h, mobile);
    await ctx.route('**/api/track', r => r.fulfill({ status: 204, body: '' }));
    const p = await ctx.newPage();
    const voice = []; p.on('request', r => { if (/assets\/voice\//.test(r.url())) voice.push(r.url()); });
    p.on('pageerror', e => errs.push(`tour ${name} pageerror: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(`tour ${name} console: ${m.text().slice(0, 160)}`); });
    await p.goto(URL0); await p.waitForSelector('#intro'); await p.waitForSelector('#boot', { state: 'detached', timeout: 9000 }).catch(() => {});
    await p.click('[data-intro-tour]');
    await p.waitForSelector('.tour:not([hidden])', { timeout: 6000 }).catch(() => errs.push(`tour ${name}: Take the tour did not start it`));
    const n = TOURD.steps.length;
    for (let i = 0; i < n; i++) {
      await p.waitForTimeout(1300);
      const st = await p.evaluate(() => { const v = document.querySelector('.tour__veil path'); const c = document.querySelector('.tour__cap').getBoundingClientRect(); return { line: document.querySelector('.tour__line').textContent.replace(/\s+/g, ' ').trim(), hole: (v.getAttribute('d') || '').split('Z').length > 2, cap: c.left >= 0 && c.right <= innerWidth + 1 && c.bottom <= innerHeight + 1 && c.top >= 0, deck: !!document.querySelector('#deck[open]') }; });
      const want = TOURD.lines[TOURD.steps[i].line].text;
      if (st.line !== want) errs.push(`tour ${name} stop ${i + 1} says "${st.line.slice(0, 50)}"`);
      if (!st.hole || !st.cap) errs.push(`tour ${name} stop ${i + 1}: vignette ${st.hole}, caption on screen ${st.cap}`);
      if (TOURD.steps[i].do === 'deck' && !st.deck) errs.push(`tour ${name}: the resume stop did not present the deck`);
      if (i === 4 || i === 9) { await textRules(p, `tour ${name} stop ${i + 1}`); }
      await overflow(p, `tour ${name} stop ${i + 1}`);
      if ([1, 5, 9].includes(i)) await p.screenshot({ path: path.join(OUT, `lib-${name}-tour-${i + 1}.png`) });
      if (i < n - 1) { if (mobile) await p.click('[data-tour-next]'); else await p.keyboard.press('ArrowRight'); }
    }
    await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(700);
    const back = await p.evaluate(() => document.querySelector('.tour__line').textContent.replace(/\s+/g, ' ').trim());
    if (back !== TOURD.lines[TOURD.steps[n - 2].line].text) errs.push(`tour ${name}: Back did not return a stop`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(1200);
    const end = await p.evaluate(() => ({ on: window.JG_TOUR.on(), shown: !!document.querySelector('.tour:not([hidden])'), open: !!document.querySelector('article.title.is-open, .screen.is-open, dialog[open]'), locked: document.documentElement.classList.contains('is-locked'), inert: document.querySelectorAll('[inert]').length }));
    if (end.on || end.shown || end.open || end.locked || end.inert) errs.push(`tour ${name}: exit left ${JSON.stringify(end)}`);
    else notes.push(`tour ${name}: ${n} stops, Back, Escape leaves the library as it was`);
    if (!TOURD.voiced && voice.length) errs.push(`tour ${name}: fetched narration that does not exist`);
    // the help sheet starts it too
    await p.keyboard.press('?'); await p.waitForTimeout(500);
    if (!(await p.$('#help[open] [data-tour-start]'))) errs.push(`tour ${name}: the help sheet has no Take the tour`);
    else { await p.click('#help [data-tour-start]'); await p.waitForTimeout(900); if (!(await p.evaluate(() => window.JG_TOUR.on()))) errs.push(`tour ${name}: help sheet did not start it`); await p.keyboard.press('Escape'); }
    await ctx.close();
  }
}

// The walkthrough film: offered on the title screen in a dialog (closing is silent), and on its own page
if (fs.existsSync(path.join(ROOT, 'assets', 'film', 'after-hours.mp4')) && (!only || only === 'desktop')) {
  const ctx = await ctxFor(1440, 900, false);
  await ctx.route('**/api/track', r => r.fulfill({ status: 204, body: '' }));
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(`film pageerror: ${e.message}`));
  await p.goto(URL0); await p.waitForSelector('#intro'); await p.waitForSelector('#boot', { state: 'detached', timeout: 9000 }).catch(() => {});
  await p.click('#intro [data-watch]');
  await p.waitForSelector('dialog.film-sheet[open] video', { timeout: 4000 }).catch(() => errs.push('film: Watch the walkthrough opened nothing'));
  await p.waitForTimeout(1500);
  const fv = await p.evaluate(() => { const v = document.querySelector('dialog.film-sheet video'); return { d: v.duration, t: v.currentTime, src: v.currentSrc }; });
  if (!(fv.d >= 60 && fv.d <= 95)) errs.push(`film: duration ${fv.d}`);
  if (!(fv.t > 0)) errs.push('film: did not play after the press');
  await p.screenshot({ path: path.join(OUT, 'lib-film-dialog.png') });
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  const after = await p.evaluate(() => ({ open: !!document.querySelector('dialog.film-sheet[open]'), title: !!document.querySelector('#intro [data-scene="title"].is-on') }));
  if (after.open || !after.title) errs.push(`film: closing left ${JSON.stringify(after)}`);
  await p.goto(URL0 + 'walkthrough.html'); await p.waitForTimeout(1200);
  const pg = await p.evaluate(() => ({ v: !!document.querySelector('.walk__film video'), lines: document.querySelectorAll('.walk__lines li').length }));
  if (!pg.v || pg.lines < 8) errs.push(`film page: ${JSON.stringify(pg)}`);
  await textRules(p, 'film page'); await overflow(p, 'film page');
  await p.screenshot({ path: path.join(OUT, 'lib-film-page.png') });
  const m = await ctx.newPage(); await m.setViewportSize({ width: 390, height: 844 }); await m.goto(URL0 + 'walkthrough.html'); await m.waitForTimeout(800); await overflow(m, 'film page mobile');
  notes.push(`film: ${Math.round(fv.d)} s, plays from Watch the walkthrough, closes silently, page reads`);
  await ctx.close();
}

// The loading screen is only for arrivals: crawlers and the site's own links skip it
{
  const ctx = await ctxFor(1280, 800, false, { userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)' });
  const p = await ctx.newPage(); await p.goto(URL0, { waitUntil: 'domcontentloaded' });
  const vis = await p.evaluate(() => { const b = document.getElementById('boot'); return !!b && getComputedStyle(b).display !== 'none'; });
  if (vis) errs.push('a crawler saw the loading screen'); else notes.push('crawlers: no loading screen');
  await ctx.close();
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
