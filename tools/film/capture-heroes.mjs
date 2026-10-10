// The After Hours film's hero objects, each one thing alone (local render inputs,
// gitignored, in tools/film/public/tour/hero):
//   card.png        the Player 2 card exactly as the site draws it (1080 by 1350),
//                   built for a role with no name on it ("Built for you")
//   resume.png      the resume's first page, alone, at 3x
//   desk-<n>.png    the sale desk's phone at three steps, at 3x (fictional buyer, example figures)
//   python3 -m http.server 8765 &   (from the repo root)
//   node tools/film/capture-heroes.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(HERE, 'public', 'tour', 'hero');
fs.mkdirSync(OUT, { recursive: true });
const URL0 = process.env.SITE || 'http://127.0.0.1:8765/';
const exe = [process.env.PW_CHROMIUM, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => f && fs.existsSync(f));
const b = await chromium.launch({ executablePath: exe });
const fonts = path.join(ROOT, 'tools', 'fonts', 'fonts.css');
async function ctxFor(w, h, scale, mobile) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale, isMobile: mobile, hasTouch: mobile, acceptDownloads: true });
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(fonts, 'utf8') }));
  await ctx.route('**/pwfonts/*', r => r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(path.join(ROOT, 'tools', 'fonts', r.request().url().split('/').pop())) }));
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  await ctx.route(/calendly\.com/, r => r.abort());
  return ctx;
}
const wait = (p, ms) => p.waitForTimeout(ms);

// the card: the site's own canvas drawing, saved through its own download
{
  const ctx = await ctxFor(1600, 900, 1, false);
  const p = await ctx.newPage();
  await p.goto(URL0, { referer: URL0 }); /* a click from inside the site: no title screen */
  await p.waitForFunction(() => window.JG_BUILD && window.JG_BUILD.make);
  await p.evaluate(() => { try { localStorage.removeItem('jg_build'); } catch (e) {} window.JG_BUILD.make('role', 'ai', 'film'); });
  await wait(p, 400);
  const dl = p.waitForEvent('download');
  await p.evaluate(() => window.JG_BUILD.save(null, 'film'));
  await (await dl).saveAs(path.join(OUT, 'card.png'));
  console.log('hero card');
  await ctx.close();
}
// the resume page, alone
{
  const ctx = await ctxFor(1000, 1400, 3, false);
  const p = await ctx.newPage();
  await p.goto(URL0 + 'resume-pdf.html'); await wait(p, 1200);
  await (await p.$('main.page')).screenshot({ path: path.join(OUT, 'resume.png') });
  console.log('hero resume');
  await ctx.close();
}
// the phone: three steps of the desk (pick the car, the license scanned, the money)
{
  const ctx = await ctxFor(1600, 900, 3, false);
  const p = await ctx.newPage();
  await p.goto(URL0, { referer: URL0 }); /* a click from inside the site: no title screen */
  await p.waitForFunction(() => window.JG_GAME && window.JG_GAME.open);
  await p.evaluate(() => window.JG_GAME.open('lead-to-title', 'film')); await wait(p, 1300);
  await p.evaluate(() => document.querySelector('article.title.is-open [data-desk-app]').scrollIntoView({ block: 'center' })); await wait(p, 900);
  const phone = 'article.title.is-open [data-desk-app]';
  const c = sel => p.click(`article.title.is-open [data-desk-app] .app-screen.is-on ${sel}`);
  const shot = async n => { await (await p.$(phone)).screenshot({ path: path.join(OUT, `desk-${n}.png`) }); console.log('hero desk', n); };
  await c('.app-btn--gold'); await wait(p, 700); await shot(0);
  await c('[data-car="2"]'); await wait(p, 1200);
  await c('[data-ok]'); await wait(p, 700);
  await c('[data-shutter]'); await wait(p, 2400); await shot(1);
  await c('[data-ok]'); await wait(p, 600);
  await c('[data-pay="bhph"]'); await c('[data-ok]'); await wait(p, 1600); await shot(2);
  await ctx.close();
}
await b.close();
