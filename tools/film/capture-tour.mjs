// Source footage for the walkthrough film: the live site, captured as it is.
//   python3 -m http.server 8765 &   (from the repo root)
//   node tools/film/capture-tour.mjs
// Plays the real pages in Chromium and writes stills into
// tools/film/public/tour/shots/ (local inputs, gitignored): the title screen and
// every step of the title screen's flow, the library and a focus move, an opened
// title, the sale desk at each step (the phone alone, for the film's device
// frame), the platinum, the trophies, the profile, Player 2, the deck, Check me
// and the resume PDF page; and the same moments on a phone for the vertical cut.
// Desktop at 1600 by 900 at 2x (headroom for the camera's push-ins), phone at
// 390 by 844 at 3x. Fonts come from tools/fonts so captures match production.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(HERE, 'public', 'tour', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const URL0 = process.env.SITE || 'http://127.0.0.1:8765/';
const exe = [process.env.PW_CHROMIUM, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => f && fs.existsSync(f));
const b = await chromium.launch({ executablePath: exe });
const fonts = path.join(ROOT, 'tools', 'fonts', 'fonts.css');
const errs = [];

async function ctxFor(w, h, scale, mobile) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale, isMobile: mobile, hasTouch: mobile, reducedMotion: 'no-preference' });
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(fonts, 'utf8') }));
  await ctx.route('**/pwfonts/*', r => r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(path.join(ROOT, 'tools', 'fonts', r.request().url().split('/').pop())) }));
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  await ctx.route(/calendly\.com/, r => r.abort());
  return ctx;
}
const wait = (p, ms) => p.waitForTimeout(ms);
async function shot(p, name, el) {
  const f = path.join(OUT, name + '.png');
  if (el) await (await p.$(el)).screenshot({ path: f, animations: 'allow' });
  else await p.screenshot({ path: f });
  console.log('shot', name);
}
async function hideToasts(p) { await p.addStyleTag({ content: '.toasts{opacity:0!important}' }); }

// ---------- desktop ----------
{
  const ctx = await ctxFor(1600, 900, 2, false);
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('desktop ' + e.message));
  await p.goto(URL0);
  await p.waitForSelector('#intro');
  await p.waitForSelector('#boot', { state: 'detached', timeout: 10000 }).catch(() => {});
  await wait(p, 1600); await shot(p, 'title');
  await p.click('[data-start="off"]');
  await p.waitForSelector('[data-scene="seat"].is-on'); await wait(p, 900); await shot(p, 'seat');
  await p.click('[data-role="interviewer"]');
  await p.waitForSelector('[data-scene="build"].is-on'); await wait(p, 700);
  await p.keyboard.press('ArrowDown'); await wait(p, 900); await shot(p, 'build');
  await p.click('[data-build-menu] [data-id="ai"]');
  await p.waitForSelector('[data-scene="name"].is-on'); await wait(p, 500);
  await p.fill('#intro-name', 'Alex'); await shot(p, 'name'); await p.keyboard.press('Enter');
  await p.waitForSelector('[data-scene="card"].is-on [data-built]:not([hidden]) .bcard');
  await wait(p, 2600); await shot(p, 'card');
  await p.click('[data-enter]');
  await p.waitForSelector('#intro', { state: 'detached', timeout: 6000 }); await wait(p, 1800);
  await p.evaluate(() => window.JG_GAME.focus('triple-j')); await wait(p, 1400); await shot(p, 'library');
  await p.evaluate(() => window.JG_GAME.focus('lead-to-title')); await wait(p, 1400); await shot(p, 'focus-1');
  await p.evaluate(() => window.JG_GAME.focus('the-inbound')); await wait(p, 1400); await shot(p, 'focus-2');
  await p.evaluate(() => window.JG_GAME.focus('lead-to-title')); await wait(p, 900);
  await p.evaluate(() => window.JG_GAME.open('lead-to-title', 'film')); await wait(p, 1300); await shot(p, 'opened');
  await hideToasts(p);
  await p.evaluate(() => { const a = document.querySelector('article.title.is-open'); const s = document.getElementById('lead-to-title-demo'); a.scrollTo({ top: s.offsetTop - 110 }); }); await wait(p, 900);
  await shot(p, 'desk-wide');
  const c = sel => p.click(`[data-desk-app] .app-screen.is-on ${sel}`);
  const phone = '[data-desk-app]';
  await shot(p, 'desk-0', phone);
  await c('.app-btn--gold'); await wait(p, 700); await shot(p, 'desk-1', phone);
  await c('[data-car="2"]'); await wait(p, 1200); await shot(p, 'desk-2', phone);
  await c('[data-ok]'); await wait(p, 700); await shot(p, 'desk-3', phone);
  await c('[data-shutter]'); await wait(p, 2400); await shot(p, 'desk-4', phone);
  await c('[data-ok]'); await wait(p, 600);
  await c('[data-pay="bhph"]'); await c('[data-ok]'); await wait(p, 1600); await shot(p, 'desk-5', phone);
  await c('[data-ok]'); await wait(p, 1400); await shot(p, 'desk-6', phone);
  await c('[data-ok]'); await wait(p, 600);
  await c('[data-auto]'); await wait(p, 700); await shot(p, 'desk-7', phone);
  await c('[data-ok]'); await wait(p, 1400); await shot(p, 'desk-8', phone);
  await p.evaluate(() => window.JG_GAME.back()); await wait(p, 900);
  await p.addStyleTag({ content: '.toasts{opacity:1!important}' });
  for (const id of ['triple-j', 'the-inbound', 'prospector', 'neuroscience']) {
    await p.evaluate(i => window.JG_GAME.open(i, 'film'), id); await wait(p, 800);
    await p.evaluate(() => window.JG_GAME.back()); await wait(p, 600);
  }
  await p.waitForSelector('.clear.is-on', { timeout: 9000 }).catch(() => errs.push('no platinum'));
  await wait(p, 2200); await shot(p, 'platinum');
  await p.keyboard.press('Escape'); await wait(p, 900);
  await hideToasts(p);
  await p.keyboard.press('t'); await wait(p, 1200); await shot(p, 'trophies');
  await p.keyboard.press('Escape'); await wait(p, 700);
  await p.keyboard.press('p'); await wait(p, 1200); await shot(p, 'profile');
  await p.keyboard.press('Escape'); await wait(p, 700);
  await p.keyboard.press('j'); await p.waitForSelector('#build.is-open .bcard'); await wait(p, 1600); await shot(p, 'player2');
  await p.keyboard.press('Escape'); await wait(p, 700);
  await p.keyboard.press('r'); await wait(p, 1300); await shot(p, 'deck');
  await p.keyboard.press('ArrowRight'); await wait(p, 900); await shot(p, 'deck-2');
  await p.keyboard.press('Escape'); await wait(p, 700);
  await p.keyboard.press('v'); await wait(p, 1200); await shot(p, 'verify');
  await p.keyboard.press('Escape'); await wait(p, 700);
  await p.goto(URL0 + 'resume-pdf.html'); await wait(p, 1200); await shot(p, 'resume');
  await ctx.close();
}

// ---------- phone ----------
{
  const ctx = await ctxFor(390, 844, 3, true);
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('phone ' + e.message));
  await p.goto(URL0);
  await p.waitForSelector('#intro');
  await p.waitForSelector('#boot', { state: 'detached', timeout: 10000 }).catch(() => {});
  await wait(p, 1600); await shot(p, 'm-title');
  await p.click('[data-start="off"]'); await p.waitForSelector('[data-scene="seat"].is-on'); await wait(p, 900); await shot(p, 'm-seat');
  await p.click('[data-role="interviewer"]'); await p.waitForSelector('[data-scene="build"].is-on'); await wait(p, 900); await shot(p, 'm-build');
  await p.click('[data-build-menu] [data-id="ai"]'); await p.waitForSelector('[data-scene="name"].is-on'); await wait(p, 400);
  await p.fill('#intro-name', 'Alex'); await p.keyboard.press('Enter');
  await p.waitForSelector('[data-scene="card"].is-on [data-built]:not([hidden]) .bcard'); await wait(p, 2600); await shot(p, 'm-card');
  await p.click('[data-enter]'); await p.waitForSelector('#intro', { state: 'detached', timeout: 6000 }); await wait(p, 1800);
  await shot(p, 'm-library');
  await p.evaluate(() => window.JG_GAME.focus('the-inbound')); await wait(p, 1400); await shot(p, 'm-focus');
  await p.evaluate(() => window.JG_GAME.open('lead-to-title', 'film')); await wait(p, 1300); await shot(p, 'm-opened');
  await hideToasts(p);
  await p.evaluate(() => document.querySelector('article.title.is-open [data-desk-app]').scrollIntoView({ block: 'center' })); await wait(p, 900); await shot(p, 'm-desk');
  await p.evaluate(() => window.JG_GAME.back()); await wait(p, 800);
  await p.evaluate(() => window.JG_GAME.screen('trophies', 'film')); await wait(p, 1200); await shot(p, 'm-trophies');
  await p.evaluate(() => window.JG_GAME.back()); await wait(p, 600);
  await p.evaluate(() => window.JG_GAME.screen('profile', 'film')); await wait(p, 1200); await shot(p, 'm-profile');
  await p.evaluate(() => window.JG_GAME.back()); await wait(p, 600);
  await p.evaluate(() => window.JG_GAME.route('#build', 'film')); await wait(p, 1600); await shot(p, 'm-player2');
  await ctx.close();
}
await b.close();
if (errs.length) { console.log('capture errors:\n' + errs.join('\n')); process.exitCode = 1; }
else console.log('capture: done, stills in', path.relative(ROOT, OUT));
