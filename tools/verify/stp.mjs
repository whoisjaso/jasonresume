// /stp, Stop Thinking Poor, on desktop and mobile.
//   python3 -m http.server 8765 &   then   node tools/verify/stp.mjs [desktop|mobile]
// Checks: /stp serves the page (the Vercel rewrite is mimicked here), the mark,
// headline, video slot and Apply above the fold on a phone, the honest holding
// state while assets/stp/vsl.mp4 is missing, the player when it exists (no
// autoplay, not muted, captions track when the .vtt exists), no link back to
// the rest of the site, the testimonial slot hidden while the data file is
// empty and shown only for consented entries, the application (validation,
// sent, the email fallback), the events, overflow, console errors, and the
// text rules (no dashes, no percent signs, no phone number, every number in
// llms.txt). Screenshots land in tools/verify/out/stp-*.png.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
const TOOLS = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ROOT = path.dirname(TOOLS);
const OUT = path.join(TOOLS, 'verify', 'out');
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
const BASE = 'http://127.0.0.1:8765';
const exe = [process.env.PW_CHROMIUM, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(f => f && fs.existsSync(f));
const b = await chromium.launch({ executablePath: exe });
const errs = [], notes = [];
const LLMS = fs.readFileSync(path.join(ROOT, 'llms.txt'), 'utf8') + fs.readFileSync(path.join(ROOT, 'llms-full.txt'), 'utf8');
const fonts = path.join(TOOLS, 'fonts', 'fonts.css');
const HTML = fs.readFileSync(path.join(ROOT, 'stp.html'), 'utf8');

async function ctxFor(w, h, mobile, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  if (fs.existsSync(fonts)) {
    await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(fonts, 'utf8') }));
    await ctx.route('**/pwfonts/*', r => r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(path.join(TOOLS, 'fonts', r.request().url().split('/').pop())) }));
  }
  await ctx.route(/calendly\.com|instagram\.com/, r => r.abort());
  await ctx.route(BASE + '/stp', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: HTML }));
  if (opts.video) {
    await ctx.route('**/assets/stp/vsl.mp4', r => r.fulfill({ status: 200, contentType: 'video/mp4', body: '' }));
    await ctx.route('**/assets/stp/vsl.vtt', r => r.fulfill({ status: 200, contentType: 'text/vtt', body: 'WEBVTT\n' }));
  }
  if (opts.voices) await ctx.route('**/stp-testimonials.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: [{ quote: 'Test quote, harness only.', name: 'Harness', consent: true }, { quote: 'No consent, never shown.', name: 'Hidden', consent: false }] }) }));
  const tracked = [];
  await ctx.route('**/api/track', r => { try { tracked.push(...JSON.parse(r.request().postData() || '{}').events.map(e => e.event)); } catch {} r.fulfill({ status: 204, body: '' }); });
  const lead = [];
  await ctx.route('**/api/lead', r => { const body = JSON.parse(r.request().postData() || '{}'); lead.push(body); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, delivered: opts.delivered !== false }) }); });
  return { ctx, tracked, lead };
}
async function textRules(p, label) {
  const t = await p.evaluate(() => {
    const attrs = [...document.querySelectorAll('[aria-label],[title],[alt],[placeholder]')].map(e => [e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('alt'), e.getAttribute('placeholder')].filter(Boolean).join(' ')).join(' ');
    return { text: document.body.innerText, attrs, head: document.head.innerHTML };
  });
  const all = t.text + ' ' + t.attrs;
  if (/[\u2013\u2014]/.test(all + t.head)) errs.push(`${label} dash in text, labels or head`);
  if (/%/.test(all)) errs.push(`${label} percent sign in text or labels`);
  if (/apohenia/i.test(all)) errs.push(`${label} Apohenia visible`);
  if (/\(?\b832\)?[\s.-]?\d{3}[\s.-]?\d{4}\b|tel:/.test(all + t.head)) errs.push(`${label} a phone number on the page`);
  if (/\$\s?\d|guarantee(d|s)? (you|results|income)|\bper (month|year)\b/i.test(t.text)) errs.push(`${label} a money figure or income claim in the copy`);
  const nums = new Set((t.text.match(/\$?\d[\d,]*(\.\d+)?/g) || []).map(n => n.replace(/,+$/, '')).filter(n => n.replace(/[$,.]/g, '').length >= 2));
  const bad = [...nums].filter(n => !LLMS.includes(n.replace(/^\$/, '')));
  if (bad.length) errs.push(`${label} numbers not in llms.txt: ${bad.join(' ')}`);
}
async function overflow(p, label) {
  const ov = await p.evaluate(() => ({ docW: document.documentElement.scrollWidth, winW: innerWidth }));
  if (ov.docW > ov.winW + 1) errs.push(`${label} horizontal overflow ${JSON.stringify(ov)}`);
}
function watch(p, label) {
  p.on('pageerror', e => errs.push(`${label} pageerror: ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(`${label} console: ${m.text().slice(0, 160)}`); });
}
async function fill(p) {
  await p.fill('input[name=name]', 'Test Person');
  await p.fill('input[name=email]', 'test@example.com');
  await p.fill('input[name=instagram]', '@testhandle');
  await p.check('input[name=pillar][value=identity]');
  await p.fill('textarea[name=desire]', 'To build something of my own.');
  await p.fill('textarea[name=belief]', 'That I start things and stop.');
  await p.check('input[name=ready][value=now]');
}

for (const [name, w, h, mobile] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
  if (only && only !== name) continue;
  const L = name;
  const { ctx, tracked, lead } = await ctxFor(w, h, mobile);
  const p = await ctx.newPage(); watch(p, L);
  const shot = label => p.screenshot({ path: path.join(OUT, `stp-${name}-${label}.png`) });
  const r = await p.goto(BASE + '/stp', { waitUntil: 'networkidle' });
  if (!r || r.status() !== 200) errs.push(`${L} /stp did not load`);
  await p.waitForTimeout(1600);

  // Above the fold
  const fold = await p.evaluate(() => {
    const vis = s => { const el = document.querySelector(s); if (!el) return false; const r = el.getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight + 1; };
    return { mark: vis('.bar .mark'), h1: vis('h1'), lede: vis('.lede'), video: vis('#vsl-frame'), apply: vis('.hero-act .btn'), hold: !!document.querySelector('#vsl-hold'), video_el: !!document.querySelector('video') };
  });
  for (const k of ['mark', 'h1', 'lede', 'video', 'apply']) if (!fold[k]) errs.push(`${L} above the fold missing: ${k}`);
  if (!fold.hold || fold.video_el) errs.push(`${L} holding state not shown while vsl.mp4 is missing`);
  await shot('top');

  // No link back to the site
  const links = await p.$$eval('a[href]', as => as.map(a => a.getAttribute('href')));
  const bad = links.filter(h => !/^#|^https:\/\/calendly\.com\/jason-apohenia\/30min$|^https:\/\/www\.instagram\.com\/0bawemimo\/$|^mailto:/.test(h));
  if (bad.length) errs.push(`${L} links off the page: ${bad.join(' ')}`);
  if (await p.$('#voices:not([hidden])')) errs.push(`${L} testimonial section visible with no entries`);
  if (await p.isVisible('#stp-done') || await p.isVisible('#voices')) errs.push(`${L} a hidden block renders before its time`);

  await textRules(p, L); await overflow(p, L);

  // Middle
  await p.locator('#what').scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, -20)); await p.waitForTimeout(1500); await shot('pillars');
  await p.locator('.pillar').nth(1).scrollIntoViewIfNeeded(); await p.waitForTimeout(1400); await shot('pillar-2');
  await p.locator('#fit').scrollIntoViewIfNeeded(); await p.waitForTimeout(1400); await shot('fit');
  await p.locator('#how').scrollIntoViewIfNeeded(); await p.waitForTimeout(1400); await shot('how');
  await p.locator('.slogan').scrollIntoViewIfNeeded(); await p.waitForTimeout(1400); await shot('slogan');

  // Validation
  await p.evaluate(() => document.getElementById('apply').scrollIntoView());
  await p.waitForTimeout(600);
  await p.click('#stp-send');
  await p.waitForTimeout(200);
  if (await p.$eval('#stp-err', e => e.hidden)) errs.push(`${L} empty application was not stopped`);
  if (lead.length) errs.push(`${L} empty application was sent`);
  await fill(p);
  await p.evaluate(() => document.getElementById('apply').scrollIntoView());
  await p.waitForTimeout(400);
  await shot('apply');
  await p.click('#stp-send');
  await p.waitForSelector('#stp-done:not([hidden])', { timeout: 5000 }).catch(() => errs.push(`${L} confirmation did not show`));
  await p.waitForTimeout(1200);
  await shot('confirm');
  const sent = lead[0] || {};
  if (sent.kind !== 'stp' || sent.pillar !== 'identity' || sent.ready !== 'now' || !sent.desire || !sent.belief) errs.push(`${L} lead payload wrong ${JSON.stringify(sent)}`);
  if (!(await p.$('#stp-done a[href="https://calendly.com/jason-apohenia/30min"]'))) errs.push(`${L} no Calendly link on confirmation`);
  if (!(await p.$eval('#stp-mail', e => e.hidden))) errs.push(`${L} email fallback shown although delivered`);
  if (await p.isVisible('#stp-form') || !(await p.isVisible('#stp-done'))) errs.push(`${L} confirmation state did not replace the form`);
  await textRules(p, L + ' confirm'); await overflow(p, L + ' confirm');
  await p.evaluate(() => dispatchEvent(new Event('pagehide')));
  await p.waitForTimeout(1200);
  for (const e of ['page_view', 'stp_apply_started', 'stp_apply_sent']) if (!tracked.includes(e)) errs.push(`${L} event missing: ${e}`);
  await ctx.close();

  // Not delivered: the email fallback
  {
    const { ctx, lead } = await ctxFor(w, h, mobile, { delivered: false });
    const p = await ctx.newPage(); watch(p, L + ' fallback');
    await p.goto(BASE + '/stp.html', { waitUntil: 'networkidle' });
    await fill(p); await p.click('#stp-send');
    await p.waitForSelector('#stp-done:not([hidden])', { timeout: 5000 }).catch(() => errs.push(`${L} fallback confirmation did not show`));
    const href = await p.$eval('#stp-mail-a', a => a.getAttribute('href'));
    if (await p.$eval('#stp-mail', e => e.hidden) || !/^mailto:jobawems@gmail\.com\?subject=/.test(href)) errs.push(`${L} email fallback missing`);
    if (!lead.length) errs.push(`${L} fallback: nothing posted`);
    await p.waitForTimeout(800);
    await p.screenshot({ path: path.join(OUT, `stp-${name}-fallback.png`) });
    await ctx.close();
  }

  // The video once it exists, and real testimonials once they exist
  {
    const { ctx, tracked } = await ctxFor(w, h, mobile, { video: true, voices: true, reduced: true });
    const p = await ctx.newPage(); watch(p, L + ' video');
    p.on('console', () => {});
    await p.goto(BASE + '/stp', { waitUntil: 'networkidle' });
    await p.waitForTimeout(600);
    const v = await p.evaluate(() => { const v = document.querySelector('#vsl-frame video'); return v && { autoplay: v.autoplay, muted: v.muted || v.hasAttribute('muted'), controls: v.controls, track: !!v.querySelector('track[kind=captions][src="/assets/stp/vsl.vtt"]'), hold: !!document.querySelector('#vsl-hold') }; });
    if (!v) errs.push(`${L} player did not replace the holding state when vsl.mp4 exists`);
    else {
      if (v.autoplay || v.muted) errs.push(`${L} player autoplays or is muted`);
      if (!v.controls) errs.push(`${L} player has no controls`);
      if (!v.track) errs.push(`${L} captions track missing when vsl.vtt exists`);
      if (v.hold) errs.push(`${L} holding state left beside the player`);
    }
    const voices = await p.$$eval('#voices:not([hidden]) .voice', els => els.map(e => e.textContent));
    if (voices.length !== 1) errs.push(`${L} testimonials: expected the one consented entry, got ${voices.length}`);
    const rm = await p.evaluate(() => getComputedStyle(document.querySelector('.reveal')).opacity);
    if (rm !== '1') errs.push(`${L} reduced motion: reveals still hidden`);
    await ctx.close();
  }
  notes.push(`${name}: done`);
}

await b.close();
console.log(notes.join('\n'));
if (errs.length) { console.log('\nFAIL\n' + errs.map(e => '  ' + e).join('\n')); process.exit(1); }
console.log('\nPASS');
