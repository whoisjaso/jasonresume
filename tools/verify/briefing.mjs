// /obavia.html, the Obavia page in the After Hours Library, played on desktop
// and mobile: the title screen (it plays here too on the Obavia plate, and not
// again on a click from home), the title head above the fold, every section
// tab and Q/E, the film, the screen loops, the desk app from start to Filed,
// the lessons, the early-access form (sent, the email fallback, a failed send,
// validation), the get bar, deep and legacy links, the no-JS document,
// overflow, dashes, percent signs, Apohenia never visible, the fictional
// labels, and the retired dash code staying off the page.
//   python3 -m http.server 8765 &   then   node tools/verify/briefing.mjs [desktop|mobile]
// Screenshots land in tools/verify/out/brief-*.png.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
const TOOLS = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(TOOLS, 'verify', 'out');
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
const URL = 'http://127.0.0.1:8765/obavia.html';
const exe = [process.env.PW_CHROMIUM, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(f => f && fs.existsSync(f));
const b = await chromium.launch({ executablePath: exe });
const errs = [], notes = [];
const fonts = path.join(TOOLS, 'fonts', 'fonts.css');
const TABS = ['film', 'run', 'what', 'lessons', 'early', 'book'];

async function ctxFor(w, h, mobile, extra = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, ...extra });
  if (fs.existsSync(fonts)) {
    await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(fonts, 'utf8') }));
    await ctx.route('**/pwfonts/*', r => r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(path.join(TOOLS, 'fonts', r.request().url().split('/').pop())) }));
  }
  await ctx.route('**/api/track', r => r.fulfill({ status: 204, body: '' }));
  await ctx.route(/calendly\.com/, r => r.abort());
  return ctx;
}
async function textRules(p, label) {
  const t = await p.evaluate(() => {
    const attrs = [...document.querySelectorAll('[aria-label],[title],[alt],[placeholder]')].map(e => [e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('alt'), e.getAttribute('placeholder')].filter(Boolean).join(' ')).join(' ');
    return { text: document.body.innerText, attrs };
  });
  const seen = t.text + ' ' + t.attrs;
  if (/[—–]/.test(seen)) errs.push(`${label} dash on the page: ${(seen.match(/.{0,30}[—–].{0,30}/) || [''])[0]}`);
  if (/%/.test(seen)) errs.push(`${label} percent sign on the page`);
  if (/apohenia/i.test(seen)) errs.push(`${label} Apohenia visible on the page`);
  if (/agency|setter|closer|waitlist/i.test(t.text)) errs.push(`${label} old agency wording on the page`);
  if (/\bnow live\b|\bis live now\b|\blive today\b|dealers use it|used by dealers|customers say/i.test(t.text)) errs.push(`${label} a live claim on the page`);
}
async function overflow(p, label) {
  const ov = await p.evaluate(() => ({ docW: document.documentElement.scrollWidth, winW: innerWidth }));
  if (ov.docW > ov.winW + 1) errs.push(`${label} horizontal overflow ${JSON.stringify(ov)}`);
}
// where a section lands: its top just under the bar and the sticky tabs
async function landing(p, id) {
  return p.evaluate(id => {
    const bar = document.querySelector('.ob-sys'), nav = document.querySelector('.ob-tabs');
    const chrome = bar.getBoundingClientRect().bottom + nav.offsetHeight;
    const top = document.getElementById(id).getBoundingClientRect().top;
    const tab = document.querySelector(`.ob-tabs a[href="#${id}"]`);
    return { top: Math.round(top), chrome: Math.round(chrome), seam: Math.round(nav.getBoundingClientRect().top - bar.getBoundingClientRect().bottom), on: !!(tab && tab.classList.contains('is-on')), solid: bar.classList.contains('is-solid'), hash: location.hash };
  }, id);
}

for (const [name, w, h, mobile] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
  if (only && only !== name) continue;
  const ctx = await ctxFor(w, h, mobile);
  let sentBody = null, leadMode = 'ok';
  await ctx.route('**/api/lead', r => {
    sentBody = r.request().postDataJSON();
    if (leadMode === 'fail') return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"failed"}' });
    if (leadMode === 'slow') return r.fulfill({ status: 429, contentType: 'application/json', body: '{"error":"slow down"}' });
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"delivered":false}' });
  });
  const p = await ctx.newPage();
  const assets = [], scoreFetches = [];
  p.on('request', r => { const u = r.url(); assets.push(u); if (/assets\/score\//.test(u)) scoreFetches.push(u); });
  p.on('pageerror', e => errs.push(`${name} pageerror: ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(`${name} console: ${m.text().slice(0, 160)}`); });
  const shot = l => p.screenshot({ path: path.join(OUT, `brief-${name}-${l}.png`) });

  await p.goto(URL, { waitUntil: 'domcontentloaded' });
  // arriving from outside the site: the title screen plays here too, on the Obavia plate; skip it silently
  await p.waitForSelector('#intro', { timeout: 4000 }).catch(() => errs.push(`${name} title screen did not show on /obavia.html`));
  await p.waitForTimeout(900); await shot('o0-title');
  const art = await p.evaluate(() => (document.querySelector('#intro .intro__art img') || {}).getAttribute?.('src') || '');
  if (!/assets\/game\/art\/obavia-/.test(art)) errs.push(`${name} title screen not on the Obavia plate: ${art}`);
  await p.click('[data-intro-skip]'); await p.waitForTimeout(1000);
  if (await p.$('#intro')) errs.push(`${name} title screen did not leave on skip`);
  if (scoreFetches.length) errs.push(`${name} the score loaded without a gesture`);
  await p.waitForTimeout(600);
  await shot('o1-head');

  // the retired dash code stays off this page
  const off = assets.filter(u => /\/(tokens|home|dash|briefing)\.css|\/(sounds|chrome|reel|dash)\.js/.test(u));
  if (off.length) errs.push(`${name} retired files loaded: ${off.map(u => u.split('/').pop()).join(' ')}`);
  for (const f of ['game.css', 'desk.css', 'obavia.css', 'hud.js', 'score.js', 'intro.js', 'desk-app.js', 'pages.js']) if (!assets.some(u => u.includes('/' + f))) errs.push(`${name} ${f} not loaded`);

  // the first viewport: the key art, the logotype, the tag, the line, early access above the fold
  const head = await p.evaluate(() => {
    const pr = document.querySelector('.ob-hero__acts .btn--primary'), a = pr.getBoundingClientRect();
    const img = document.querySelector('.ob-stage__img');
    return {
      fold: !!pr.offsetParent && a.width > 100 && a.height > 30 && a.bottom <= innerHeight - 4 && getComputedStyle(pr).visibility === 'visible', film: !!document.querySelector('.ob-hero__acts a[href="#film"]').offsetParent, logo: document.querySelector('#pp-h').textContent.trim(),
      tag: document.querySelector('.ob-hero .title__tag').textContent.trim(), line: document.querySelector('.ob-hero__line').textContent.trim(),
      art: img && img.complete && img.naturalWidth > 0, cur: img && img.currentSrc,
      away: document.querySelector('[data-getbar]').classList.contains('is-away'), solid: document.querySelector('.ob-sys').classList.contains('is-solid'),
      score: document.querySelector('.sys__score [data-score-label]').textContent, clock: document.querySelector('[data-clock]').textContent
    };
  });
  if (!head.fold) errs.push(`${name} early access button hidden or below the fold`);
  if (!head.film) errs.push(`${name} watch the film button hidden`);
  if (head.logo !== 'Obavia' || head.tag !== 'In development' || head.line !== 'Every sale, start to signed.') errs.push(`${name} title head wrong ${JSON.stringify(head)}`);
  if (!head.art) errs.push(`${name} the Obavia key art did not load`);
  if (mobile ? !/obavia-m\.webp/.test(head.cur) : !/obavia-1(280|920)\.webp/.test(head.cur)) errs.push(`${name} wrong key art size: ${head.cur}`);
  if (!head.away) errs.push(`${name} get bar showing over the title head`);
  if (head.solid) errs.push(`${name} bar solid over the key art`);
  if (head.score !== 'Score off') errs.push(`${name} score label "${head.score}"`);
  if (!/\d:\d\d/.test(head.clock)) errs.push(`${name} Houston clock empty`);
  await overflow(p, `${name} head`);

  // every tab lands its section under the chrome and lights itself
  for (const id of TABS) {
    await p.click(`.ob-tabs a[href="#${id}"]`); await p.waitForTimeout(1100);
    const l = await landing(p, id);
    if (Math.abs(l.top - l.chrome) > 2 && id !== 'book') errs.push(`${name} tab ${id} landed at ${l.top} (chrome ${l.chrome})`);
    if (!l.on) errs.push(`${name} tab ${id} not lit after landing`);
    if (l.hash !== '#' + id) errs.push(`${name} tab ${id} hash ${l.hash}`);
    if (!l.solid) errs.push(`${name} bar not solid at ${id}`);
    if (l.seam !== 0) errs.push(`${name} a gap of ${l.seam}px between the bar and the tabs at ${id}`);
    await overflow(p, `${name} #${id}`);
  }
  // Q and E step through the sections on a keyboard
  if (!mobile) {
    await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, 0); document.activeElement && document.activeElement.blur(); }); await p.waitForTimeout(400);
    await p.keyboard.press('e'); await p.waitForTimeout(1100);
    let l = await landing(p, 'film'); if (!l.on || Math.abs(l.top - l.chrome) > 40) errs.push(`desktop E from the top did not land on the film ${JSON.stringify(l)}`);
    await p.keyboard.press('e'); await p.waitForTimeout(1100);
    l = await landing(p, 'run'); if (!l.on) errs.push('desktop E did not step to Run a sale');
    await p.keyboard.press('q'); await p.waitForTimeout(1100);
    l = await landing(p, 'film'); if (!l.on) errs.push('desktop Q did not step back to the film');
    const keys = await p.evaluate(() => [...document.querySelectorAll('.ob-tabs .key')].filter(k => k.offsetParent).length);
    if (keys !== 2) errs.push(`desktop Q and E keycaps not shown (${keys})`);
  }
  const go = async (sel, l, wait = 700) => { await p.evaluate(s => { document.documentElement.style.scrollBehavior = 'auto'; const el = document.querySelector(s); const c = document.querySelector('.ob-sys').offsetHeight + document.querySelector('.ob-tabs').offsetHeight; scrollTo(0, el.getBoundingClientRect().top + scrollY - c); }, sel); await p.waitForTimeout(wait); if (l) await shot(l); };

  // the film: hairline 16:9, the fictional label, plays with one tap
  await go('#film', 'o2-film');
  const film = await p.evaluate(() => { const v = document.querySelector('#film .ob-film video').getBoundingClientRect(); return { cap: document.querySelector('#film .ob-film figcaption').textContent, ratio: v.width / v.height }; });
  if (!/fictional/.test(film.cap)) errs.push(`${name} film missing the fictional label`);
  if (Math.abs(film.ratio - 16 / 9) > 0.03) errs.push(`${name} film frame not 16:9 (${film.ratio.toFixed(3)})`);
  await p.click('#film .ob-film [data-film-play]'); await p.waitForTimeout(500);
  if (!(await p.evaluate(() => document.querySelector('#film .ob-film').classList.contains('is-playing')))) errs.push(`${name} film did not start`);
  await p.evaluate(() => document.querySelector('#film .ob-film video').pause());
  const barOn = await p.evaluate(() => !document.querySelector('[data-getbar]').classList.contains('is-away'));
  if (!barOn) errs.push(`${name} get bar hidden mid-page`);
  const loopsOn = await p.evaluate(async () => { const s = document.querySelector('.ob-shots'); s.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 1500)); return [...document.querySelectorAll('.ob-shot video')].some(v => v.preload === 'auto'); });
  // headless Chromium has no H.264, so this checks the loops were asked to play once in view
  if (!loopsOn) errs.push(`${name} the screen loops were not started in view`);
  await shot('o2b-shots');

  // the desk, start to Filed
  await go('#run', 'o3-desk-start', 1200);
  const c = sel => p.click(`[data-desk-app] .app-screen.is-on ${sel}`);
  try {
    await c('.app-btn--gold'); await p.waitForTimeout(500);
    await c('[data-car="0"]'); await p.waitForTimeout(1100);
    await c('[data-ok]'); await p.waitForTimeout(600);
    await c('[data-shutter]'); await p.waitForTimeout(2300);
    await c('[data-ok]'); await p.waitForTimeout(500);
    await c('[data-pay="bank"]'); await c('[data-ok]'); await p.waitForTimeout(1400);
    await go('#run', 'o3-desk-money', 300);
    await c('[data-ok]'); await p.waitForTimeout(1200);
    await c('[data-ok]'); await p.waitForTimeout(500);
    await c('[data-auto]'); await c('[data-ok]'); await p.waitForTimeout(1400);
  } catch (e) { errs.push(`${name} desk demo failed: ${e.message.split('\n')[0]}`); }
  await go('#run', 'o3-desk', 300);
  const desk = await p.evaluate(() => ({ filed: /Filed/.test(document.querySelector('[data-desk-app] .app-screen.is-on').textContent), done: document.querySelectorAll('[data-desk-notes] li.is-done').length, toast: (document.querySelector('.toast') || {}).textContent || '' }));
  if (!desk.filed) errs.push(`${name} desk did not reach Filed`);
  if (desk.done < 6) errs.push(`${name} desk steps not lit as it ran (${desk.done})`);
  if (!/Fictional buyer/.test(desk.toast)) notes.push(`${name} desk toast: ${desk.toast || 'gone by the check'}`);

  await go('#what', 'o4-what');
  const what = await p.evaluate(() => ({ n: document.querySelectorAll('#what .points li').length, soon: /None of these is live yet/.test(document.querySelector('#what').innerText) }));
  if (what.n !== 9 || !what.soon) errs.push(`${name} what it does lists wrong ${JSON.stringify(what)}`);

  // the lessons: on a desktop a menu picks one into the player; on a phone they swipe
  await go('#lessons', 'o5-lessons');
  if (!mobile) {
    await p.click('[data-pick="1"]'); await p.waitForTimeout(600);
    const ls = await p.evaluate(() => { const f = [...document.querySelectorAll('.ob-lesson')]; return { on: f.findIndex(x => x.classList.contains('is-on')), shown: f.filter(x => x.offsetParent).length, playing: f[1].classList.contains('is-playing'), pressed: document.querySelector('[data-pick="1"]').getAttribute('aria-pressed') }; });
    if (ls.on !== 1 || ls.shown !== 1 || !ls.playing || ls.pressed !== 'true') errs.push(`desktop lesson menu wrong ${JSON.stringify(ls)}`);
    await shot('o5b-lesson-playing');
  } else {
    await p.click('.ob-lesson:first-child [data-film-play]'); await p.waitForTimeout(500);
    if (!(await p.evaluate(() => document.querySelector('.ob-lesson').classList.contains('is-playing')))) errs.push('mobile lesson did not play');
  }
  await p.evaluate(() => document.querySelectorAll('video').forEach(v => v.pause()));

  // early access: validation first, then the send and its email fallback
  await go('#early', 'o6-early-form');
  const before = sentBody;
  await p.click('#early button[type="submit"]'); await p.waitForTimeout(400);
  if (sentBody !== before) errs.push(`${name} an empty form was sent`);
  await p.fill('#l-name', 'Test Dealer'); await p.fill('#l-email', 'dealer@example.com');
  await p.fill('#l-dealership', 'Example Motors'); await p.fill('#l-city', 'Houston');
  await p.selectOption('#l-pay', 'bhph');
  await p.click('#early button[type="submit"]'); await p.waitForTimeout(1200);
  if (!sentBody || sentBody.dealership !== 'Example Motors' || sentBody.pay !== 'bhph' || sentBody.city !== 'Houston' || sentBody.booked !== 'no' || sentBody.website) errs.push(`${name} lead body wrong: ${JSON.stringify(sentBody)}`);
  const fb = await p.evaluate(() => { const f = document.querySelector('#lead-sent [data-fallback]'); return { in: document.getElementById('lead-sent').classList.contains('is-in'), shown: !f.hidden, href: f.querySelector('a').getAttribute('href') }; });
  if (!fb.in) errs.push(`${name} the sent note did not show`);
  if (!fb.shown || !/^mailto:jobawems@gmail\.com\?subject=Obavia%20early%20access&body=.*Example%20Motors/.test(fb.href)) errs.push(`${name} lead fallback wrong ${JSON.stringify(fb)}`);
  const awayAtForm = await p.evaluate(() => document.querySelector('[data-getbar]').classList.contains('is-away'));
  if (!awayAtForm) errs.push(`${name} get bar over the form`);
  await shot('o6-early');
  await go('#book', 'o7-book');
  await textRules(p, name);
  await overflow(p, `${name} end`);

  // a send that fails falls back to email, and the button comes back
  await p.goto(URL + '?again=1#early', { waitUntil: 'load' }); await p.waitForTimeout(800);
  if (await p.$('#intro')) await p.click('[data-intro-skip]').then(() => p.waitForTimeout(900));
  for (const [mode, re] of [['fail', /did not go through/], ['slow', /Too many tries/]]) {
    leadMode = mode;
    await p.fill('#l-name', 'Test Dealer'); await p.fill('#l-email', 'dealer@example.com');
    await p.click('#early button[type="submit"]'); await p.waitForTimeout(900);
    const st = await p.evaluate(() => { const s = document.querySelector('#early .form__status'); return { bad: s.classList.contains('is-bad'), text: s.textContent, mail: !!s.querySelector('a[href^="mailto:jobawems@gmail.com"]'), btn: document.querySelector('#early button[type="submit"]').disabled, sent: document.getElementById('lead-sent').classList.contains('is-in') }; });
    if (!st.bad || !re.test(st.text) || !st.mail || st.btn || st.sent) errs.push(`${name} ${mode} send did not fall back ${JSON.stringify(st)}`);
  }
  leadMode = 'ok';
  await shot('o6b-early-failed');
  await ctx.close();
}

// The title screen on /obavia.html, start to finish: the name given fills the form; deep links land after it
if (!only || only === 'mobile') {
  const ctx = await ctxFor(390, 844, true);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(`onboarding pageerror: ${e.message}`));
  const scoreFetches = []; p.on('request', r => { if (/assets\/score\//.test(r.url())) scoreFetches.push(r.url()); });
  await p.goto(URL + '#early'); await p.waitForSelector('#intro');
  await p.waitForTimeout(700); await p.click('[data-start="off"]');
  await p.waitForSelector('[data-scene="seat"].is-on', { timeout: 4000 }).catch(() => errs.push('obavia onboarding: no seat menu'));
  await p.waitForTimeout(500); await p.click('[data-role="partner"]');
  await p.waitForSelector('[data-scene="name"].is-on', { timeout: 4000 }).catch(() => errs.push('obavia onboarding: no name scene'));
  await p.waitForTimeout(400); await p.fill('#intro-name', 'Dana'); await p.keyboard.press('Enter');
  await p.waitForSelector('#intro', { state: 'detached', timeout: 6000 }).catch(() => errs.push('obavia onboarding did not end'));
  await p.waitForTimeout(1400);
  const st = await p.evaluate(() => ({ name: document.getElementById('l-name').value, locked: document.documentElement.classList.contains('is-locked'), top: Math.round(document.getElementById('early').getBoundingClientRect().top), chrome: document.querySelector('.ob-sys').offsetHeight + document.querySelector('.ob-tabs').offsetHeight }));
  if (st.name !== 'Dana') errs.push(`obavia onboarding: the form did not take the name (${st.name})`);
  if (st.locked) errs.push('obavia onboarding: the page stayed locked');
  if (Math.abs(st.top - st.chrome) > 60) errs.push(`obavia onboarding: #early deep link did not land ${JSON.stringify(st)}`);
  if (scoreFetches.length) errs.push('obavia onboarding: Start muted still loaded the score');
  await p.screenshot({ path: path.join(OUT, 'brief-onboarding-early.png') });
  // a click from the home page to /obavia.html is not a new arrival: no second title screen
  await p.goto('http://127.0.0.1:8765/'); await p.waitForSelector('#intro'); await p.click('[data-intro-skip]'); await p.waitForTimeout(700);
  await p.evaluate(() => { const a = document.createElement('a'); a.href = '/obavia.html#story-desk'; a.id = 'go-ob'; a.textContent = 'go'; document.body.appendChild(a); });
  await Promise.all([p.waitForURL(/obavia\.html/), p.evaluate(() => document.getElementById('go-ob').click())]); await p.waitForTimeout(1600);
  if (await p.$('#intro')) errs.push('title screen replayed on a click between pages');
  const leg = await p.evaluate(() => ({ hash: location.hash, top: Math.round(document.getElementById('run').getBoundingClientRect().top) }));
  if (leg.hash !== '#run' || Math.abs(leg.top) > 200) errs.push(`legacy #story-desk did not land on the desk ${JSON.stringify(leg)}`);
  await ctx.close();
}

// No JavaScript: a plain, complete document
for (const [name, w, h, mobile] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
  if (only && only !== name) continue;
  const ctx = await ctxFor(w, h, mobile, { javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(400);
  const nj = await p.evaluate(() => ({
    h1: !!document.querySelector('#pp-h').offsetParent, tabs: !!document.querySelector('.ob-tabs').offsetParent,
    secs: ['film', 'run', 'what', 'lessons', 'early', 'book'].every(id => document.getElementById(id) && document.getElementById(id).offsetHeight > 40),
    form: !!document.querySelector('#early form').offsetParent, desk: /needs JavaScript/.test(document.querySelector('#run').innerText),
    lessons: [...document.querySelectorAll('.ob-lesson')].filter(f => f.offsetParent).length, credits: !!document.querySelector('.credits').offsetParent
  }));
  if (!nj.h1 || !nj.tabs || !nj.secs || !nj.form || !nj.desk || nj.lessons !== 3 || !nj.credits) errs.push(`${name} no-JS document incomplete ${JSON.stringify(nj)}`);
  await textRules(p, `${name} no-JS`); await overflow(p, `${name} no-JS`);
  await p.screenshot({ path: path.join(OUT, `brief-${name}-nojs.png`), fullPage: false });
  await p.evaluate(() => document.getElementById('lessons').scrollIntoView()); await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(OUT, `brief-${name}-nojs-lessons.png`) });
  await ctx.close();
}
await b.close();
if (notes.length) console.log(notes.join('\n'));
console.log(errs.length ? errs.join('\n') : 'briefing: all clear');
process.exit(errs.length ? 1 : 0);
