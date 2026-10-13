// After Hours, the episode, played end to end through real input.
//   python3 -m http.server 8765 &   then   node tools/verify/story.mjs [desktop|landscape|portrait] [--shots]
//
// For each viewport (desktop 1440x900, a phone sideways 844x390 and upright 390x844) it
// plays every major branch with the keyboard, clicks or taps: hiring (and the role's
// one-page resume), a dealer (Obavia early access), just curious (the arcade cabinet
// opens the run), deflecting all the way (its own honest ending) and deflecting then
// telling Jason at the end. It checks that choices persist (a reload offers Continue
// and resumes with the flags kept), that trophies unlock through JG_GAME.unlock (the
// library's own store agrees), that the desk runs to Filed, and that there are no page
// errors, no dashes or percent signs in any rendered text, and no number on the page
// that isn't in llms.txt (the desk's fictional figures are labelled and excluded, as
// in library.mjs). Long walks use the debug hook (?debug=story) to stand you at a
// spot; everything you do there goes through real keys, clicks and taps.
// With --shots it also renders stills of every scene and key moment at full
// resolution and writes contact sheets to tools/verify/out/story-sheet-*.png.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'tools', 'verify', 'out');
fs.mkdirSync(OUT, { recursive: true });
const URL0 = process.env.STORY_URL || 'http://127.0.0.1:8765/';
const LLMS = fs.readFileSync(path.join(ROOT, 'llms.txt'), 'utf8') + fs.readFileSync(path.join(ROOT, 'llms-full.txt'), 'utf8');
const LIB = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'site', 'library.json'), 'utf8'));
const STORY = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'site', 'story.json'), 'utf8'));
const only = process.argv.slice(2).find(a => !a.startsWith('--'));
const SHOTS = process.argv.includes('--shots');
const ONLY_PATH = (process.argv.find(a => a.startsWith('--path=')) || '').slice(7);
const LOG = process.argv.includes('--log');
const log = (...a) => { if (LOG) console.log(new Date().toISOString().slice(11, 19), ...a); };
const exe = [process.env.PW_CHROMIUM, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => f && fs.existsSync(f));
const b = await chromium.launch({ executablePath: exe });
const errs = [], notes = [], fps = [];
const _push = errs.push.bind(errs); errs.push = (...a) => { if (process.argv.includes('--log')) a.forEach(x => console.log('  ERROR', x)); return _push(...a); };
const fonts = path.join(ROOT, 'tools', 'fonts', 'fonts.css');

async function ctxFor(w, h, mobile) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  if (fs.existsSync(fonts)) {
    await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(fonts, 'utf8') }));
    await ctx.route('**/pwfonts/*', r => r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(path.join(ROOT, 'tools', 'fonts', r.request().url().split('/').pop())) }));
  }
  await ctx.route(/calendly\.com/, r => r.abort());
  await ctx.route('**/api/run**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"on":false}' }));
  await ctx.route('**/api/guide', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  return ctx;
}
async function textRules(p, label) {
  const t = await p.evaluate(() => {
    const st = document.getElementById('story'); if (!st) return null;
    const attrs = [...st.querySelectorAll('[aria-label],[title],[alt]')].map(e => [e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('alt')].filter(Boolean).join(' ')).join(' ');
    const data = (document.getElementById('story-data') || {}).textContent || '';
    const facts = [...st.querySelectorAll('[data-desk-app]')].reduce((t, el) => t.replace(el.innerText, ''), st.innerText);
    return { text: st.innerText, facts, attrs, data };
  });
  if (!t) return;
  const all = t.text + ' ' + t.attrs + ' ' + t.data;
  if (/[—–]/.test(all)) errs.push(`${label}: dash in text: ${(all.match(/.{30}[—–].{30}/) || [''])[0]}`);
  if (/%/.test(t.text + ' ' + t.attrs + ' ' + t.data)) errs.push(`${label}: percent sign`);
  const nums = new Set((t.facts + ' ' + t.data.replace(/"id":"[^"]*"/g, '')).replace(/\b\d{1,2}:\d\d\s?(AM|PM)?/gi, '').match(/\$?\d[\d,]*(\.\d+)?/g) || []);
  const bad = [...nums].map(n => n.replace(/,+$/, '')).filter(n => n.replace(/[$,.]/g, '').length >= 2 && !LLMS.includes(n.replace(/^\$/, '')));
  if (bad.length) errs.push(`${label}: numbers not in llms.txt: ${bad.join(' ')}`);
}

const st = p => p.evaluate(() => window.JG_STORY && window.JG_STORY.debug.state());
async function until(p, fn, arg, ms = 90000) { return p.waitForFunction(fn, arg, { timeout: ms, polling: 120 }).then(() => true, () => false); }
/* an upright phone meets the turn-sideways prompt first; it must show, and "Keep playing upright" lets the run go on (silently) */
let turnSeen = false;
async function turnAway(p) {
  const t = await p.$('.st-turn.is-on .st-turn__stay');
  if (!t) return;
  turnSeen = true;
  const vs = p.viewportSize(); if (vs.width > vs.height) errs.push('the turn-sideways prompt showed on a sideways screen');
  await p.tap('.st-turn__stay').catch(() => p.click('.st-turn__stay'));
  await p.waitForTimeout(500);
}
async function phase(p, ph, ms) { const r = await until(p, ph => window.JG_STORY && window.JG_STORY.debug.state().phase === ph, ph, ms); await turnAway(p); return r; }
async function shot(p, name) { if (SHOTS) await p.screenshot({ path: path.join(OUT, `story-${name}.png`) }); }

/* advance through lines until choices show, the talk ends, or a phase changes */
async function untilChoice(p, label) {
  // a scene change passes through explore for a beat before its first talk starts, so a quiet phase has to hold
  const t0 = Date.now(); let calm = 0;
  while (Date.now() - t0 < 120000) {
    const s = await st(p);
    if (s.choices) return s;
    const quiet = !s.talking && !s.line && (s.phase === 'explore' || s.phase === 'end' || s.phase === 'sheet' || s.phase === 'close');
    if (quiet) { if (!calm) calm = Date.now(); else if (Date.now() - calm > 4000) return s; } else calm = 0;
    await p.waitForTimeout(150);
  }
  errs.push(`${label}: stuck ${JSON.stringify(await st(p))}`); return null;
}
/* choose by visible label, with a number key or a click/tap on the button */
async function choose(p, mobile, text, label) {
  log(label, 'choose', text);
  const s = await untilChoice(p, label);
  if (!s || !s.choices) { errs.push(`${label}: no choices for "${text}" ${JSON.stringify(s)}`); return false; }
  const i = s.choices.findIndex(c => c === text);
  if (i < 0) { errs.push(`${label}: no choice "${text}" in ${JSON.stringify(s.choices)}`); return false; }
  await p.waitForTimeout(200);
  if (mobile) await p.tap(`.st-ch[data-i="${i}"]`, { force: true }); else if (i % 2) await p.click(`.st-ch[data-i="${i}"]`, { force: true }); else await p.keyboard.press(String(i + 1));
  await until(p, () => !window.JG_STORY.debug.state().choices, null, 8000);
  return true;
}
/* stand at a spot and interact with E, a click on the prompt, or a tap */
async function use(p, mobile, id, label) {
  log(label, 'use', id);
  const ex = await phase(p, 'explore', 120000);
  if (!ex) { errs.push(`${label}: not exploring before ${id} ${JSON.stringify(await st(p))}`); return false; }
  const ok = await p.evaluate(id => { window.__scene = window.JG_STORY.debug.state().scene; return window.JG_STORY.debug.warp(id); }, id);
  if (!ok) { errs.push(`${label}: no spot ${id} here (${JSON.stringify(await p.evaluate(() => window.JG_STORY.debug.spots()))})`); return false; }
  const near = await until(p, id => window.JG_STORY.debug.state().near === id, id, 15000);
  if (!near) { errs.push(`${label}: prompt did not show for ${id} (near ${(await st(p)).near})`); return false; }
  await p.waitForTimeout(150);
  const n0 = (await st(p)).looked[id] || 0;
  // the prompt follows the thing on screen; it has to be there and on top to be pressed
  await until(p, () => { const b = document.querySelector('.st-prompt'); return b && !b.hidden; }, null, 4000);
  const hit = await p.evaluate(() => { const b = document.querySelector('.st-prompt'); if (!b || b.hidden) return 'hidden'; const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && b.contains(e) ? 'ok' : 'covered by ' + (e ? e.className || e.tagName : 'nothing'); });
  if (hit !== 'ok' && (mobile || hit !== 'hidden')) errs.push(`${label}: the prompt for ${id} is ${hit}`);
  if (hit !== 'ok') { if (mobile) await p.evaluate(id => { window.JG_STORY.debug.interact(id); }, id); else await p.keyboard.press('e'); }
  else if (mobile) await p.tap('.st-prompt', { force: true }); else if (Math.random() < 0.5) await p.keyboard.press('e'); else await p.click('.st-prompt', { force: true });
  const on = await until(p, ([id, n]) => { const s = window.JG_STORY.debug.state(); return s.phase !== 'explore' || (s.looked[id] || 0) > n || s.scene !== window.__scene; }, [id, n0], 20000);
  if (!on) errs.push(`${label}: ${id} did not respond`);
  return on;
}
async function finishTalk(p, label) { const ok = await phase(p, 'explore', 120000); if (!ok) errs.push(`${label}: talk did not end ${JSON.stringify(await st(p))}`); return ok; }

async function start(ctx, label, q = '') {
  const p = await ctx.newPage();
  p.on('pageerror', e => { const m = `${label} pageerror: ${e.message} ${(e.stack || '').split('\n').slice(1, 3).join(' ').trim()}`; if (!errs.includes(m)) errs.push(m); log(m); });
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|404/.test(m.text())) errs.push(`${label} console: ${m.text().slice(0, 200)}`); });
  await p.goto(URL0 + '?debug=story&fast=1&pr=' + (SHOTS ? '1' : '0.3') + q);
  await p.waitForSelector('#intro [data-title-play]', { timeout: 20000 });
  await p.waitForSelector('#boot', { state: 'detached', timeout: 15000 }).catch(() => {});
  const label0 = await p.textContent('[data-title-play]');
  await p.click('[data-title-play]');
  const up = await until(p, () => window.JG_STORY && window.JG_STORY.debug.state().open, null, 60000);
  if (!up) errs.push(`${label}: Play did not open the episode`);
  return { p, label0: (label0 || '').trim() };
}

/* ---------- the lot: arrive, Dell, Jason (the why), optional looks, the gate ---------- */
async function lot(p, mobile, o, label) {
  await phase(p, 'explore', 120000);
  if (o.shots) { await p.waitForTimeout(800); await shot(p, `${o.tag}-lot`); }
  // walking: a second of real keys moves you
  if (!mobile) { const a = (await st(p)).me; await p.keyboard.down('w'); await p.waitForTimeout(1200); await p.keyboard.up('w'); const b2 = (await st(p)).me; if (Math.hypot(a[0] - b2[0], a[1] - b2[1]) < 0.02) errs.push(`${label}: W did not walk`); }
  else { const a = (await st(p)).me; const vs = p.viewportSize(); await p.tap('.st-cv', { position: { x: Math.round(vs.width * 0.68), y: Math.round(vs.height * 0.62) } }).catch(() => {}); await p.waitForTimeout(2500); const b2 = (await st(p)).me; if (Math.hypot(a[0] - b2[0], a[1] - b2[1]) < 0.02) errs.push(`${label}: tapping the ground did not walk`); else notes.push(`${label}: tapping the ground walks`); }
  await use(p, mobile, 'dell', label); await choose(p, mobile, o.dell, label); await finishTalk(p, label);
  if (o.sign) { await use(p, mobile, 'sign', label); await finishTalk(p, label); }
  await use(p, mobile, 'jason-lot', label);
  if (o.shots) { await until(p, () => !!window.JG_STORY.debug.state().choices, null, 60000); await p.waitForTimeout(400); await shot(p, `${o.tag}-choices`); }
  await choose(p, mobile, o.why, label);
  if (o.cluster) await choose(p, mobile, o.cluster, label);
  if (o.lot) { if (o.lotMore) { await choose(p, mobile, 'Something else', label); } await choose(p, mobile, o.lot, label); }
  if (o.shots) { await p.waitForTimeout(300); await shot(p, `${o.tag}-notice`); }
  await finishTalk(p, label);
  if (o.sold) { await use(p, mobile, 'sold', label); await finishTalk(p, label); }
  if (o.gate) { await use(p, mobile, 'gate', label); await choose(p, mobile, o.gate, label); await finishTalk(p, label); }
  await use(p, mobile, 'door', label);
  const inOffice = await until(p, () => window.JG_STORY.debug.state().scene === 'office', null, 60000);
  if (!inOffice) errs.push(`${label}: the door did not lead to the office`);
}
/* ---------- the office: the desk, the call, the room, the book ---------- */
async function office(p, mobile, o, label) {
  await choose(p, mobile, o.desk, label);
  if (o.desk === 'Let me close her deal.') {
    const sheet = await phase(p, 'sheet', 60000);
    if (!sheet) errs.push(`${label}: the desk did not open`);
    else {
      if (o.shots) { await p.waitForTimeout(500); await shot(p, `${o.tag}-desk`); }
      const c = async sel => { const s = `.st-sheet [data-desk-app] .app-screen.is-on ${sel}`; await p.waitForSelector(s, { timeout: 8000 }); if (mobile) await p.tap(s); else await p.click(s); };
      try {
        await c('.app-btn--gold'); await p.waitForTimeout(500);
        await c('[data-car="2"]'); await p.waitForTimeout(1100);
        await c('[data-ok]'); await p.waitForTimeout(600);
        await c('[data-shutter]'); await p.waitForTimeout(2300);
        await c('[data-ok]'); await p.waitForTimeout(500);
        await c('[data-pay="cash"]'); await c('[data-ok]'); await p.waitForTimeout(1500);
        await c('[data-ok]'); await p.waitForTimeout(1300);
        await c('[data-ok]'); await p.waitForTimeout(500);
        await c('[data-auto]'); await c('[data-ok]'); await p.waitForTimeout(1500);
      } catch (e) { errs.push(`${label}: desk run failed: ${e.message.split('\n')[0]}`); await p.evaluate(() => window.JG_STORY.debug.desk()); }
      const back = await until(p, () => window.JG_STORY.debug.state().phase !== 'sheet', null, 10000);
      if (!back) { errs.push(`${label}: the desk never reached Filed`); await p.evaluate(() => window.JG_STORY.debug.desk()); }
    }
  }
  await finishTalk(p, label);
  if (/hire|deflect/.test(o.tag)) {
    const pr = await p.evaluate(() => window.JG_STORY.debug.camProbe([[4.5, 3.6], [0.5, 3.6], [-5.4, -2.6], [2.6, -3.3], [5.0, 0.6], [-2.9, -3.5], [-5.4, 2.6], [0, 0.8], [6, 4], [-6, -4]]));
    if (pr.bad.length) errs.push(`${label}: office camera inside geometry at ${pr.bad.length} of ${pr.n}, e.g. ${JSON.stringify(pr.bad.slice(0, 3))}`);
    else notes.push(`${label}: office camera clear of geometry at all ${pr.n} samples`);
  }
  const ringing = await until(p, () => window.JG_STORY.debug.state().flags.ringing, null, 30000);
  if (!ringing) errs.push(`${label}: the phone never rang`);
  await use(p, mobile, 'phone', label);
  await choose(p, mobile, o.phone, label);
  await finishTalk(p, label);
  for (const id of o.looks || []) {
    if (id === 'arcade') {
      // the cabinet plays the run: it opens over the episode, and closing it puts you back at the cabinet
      await use(p, mobile, 'arcade', label);
      const open = await until(p, () => window.JG_RUN && window.JG_RUN.isOpen(), null, 30000);
      if (!open) { errs.push(`${label}: the arcade cabinet did not open the run`); continue; }
      notes.push(`${label}: the arcade cabinet plays the run`);
      await p.waitForTimeout(1500);
      await p.evaluate(() => window.JG_RUN.close('test'));
      const back = await phase(p, 'explore', 60000);
      const st0 = await st(p);
      if (!back || st0.scene !== 'office') errs.push(`${label}: closing the run did not bring you back to the office (${JSON.stringify({ phase: st0.phase, scene: st0.scene })})`);
      else notes.push(`${label}: closing the run puts you back in the office`);
      continue;
    }
    if (id === 'board') {
      await use(p, mobile, 'board', label);
      const close = await phase(p, 'close', 60000);
      if (!close) { errs.push(`${label}: the whiteboard close-up did not open`); continue; }
      if (o.shots) { await p.waitForTimeout(900); await shot(p, `${o.tag}-board`); }
      for (const n of ['note-rls', 'note-valid', 'note-migr']) {
        await p.waitForSelector(`[data-note="${n}"]`, { timeout: 8000 });
        await until(p, () => !document.querySelector('.st-close.is-busy'), null, 60000);
        const hit = await p.evaluate(n => { const b = document.querySelector(`[data-note="${n}"]`); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && b.contains(e) ? 'ok' : `covered by ${e ? (e.dataset && e.dataset.note) || e.className || e.tagName : 'nothing'} at ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`; }, n);
        if (hit !== 'ok') errs.push(`${label}: whiteboard note ${n} is ${hit}`);
        if (mobile) await p.tap(`[data-note="${n}"]`, { force: true }); else await p.click(`[data-note="${n}"]`, { force: true });
        await p.waitForTimeout(400);
        await until(p, () => !document.querySelector('.st-close.is-busy'), null, 60000);
      }
      await finishTalk(p, label);
    } else { await use(p, mobile, id, label); await finishTalk(p, label); }
  }
  if (o.journal) {
    if (mobile) await p.tap('[data-st="journal"]'); else await p.keyboard.press('j');
    const j = await phase(p, 'journal', 8000);
    if (!j) errs.push(`${label}: the journal did not open`);
    else { await p.waitForTimeout(500); await shot(p, `${o.tag}-journal`); await textRules(p, `${label} journal`); if (mobile) await p.tap('[data-st="journal-close"]'); else await p.keyboard.press('Escape'); await phase(p, 'explore', 8000); }
  }
  const hinted = await until(p, () => window.JG_STORY.debug.state().flags.hinted, null, 60000);
  if (!hinted) errs.push(`${label}: Jason never pointed at the book`);
  await finishTalk(p, label);
  await use(p, mobile, 'book', label);
  const mem = await until(p, () => window.JG_STORY.debug.state().scene === 'memory', null, 60000);
  if (!mem) errs.push(`${label}: the book did not open the memory`);
}
/* ---------- the memory, the keys ---------- */
async function memory(p, mobile, o, label) {
  await phase(p, 'explore', 60000);
  if (o.shots) { await p.waitForTimeout(4000); await shot(p, `${o.tag}-memory`); }
  for (const id of ['mem-laptop', 'mem-cert', 'mem-folder', 'mem-letter', 'mem-brain']) { await use(p, mobile, id, label); await finishTalk(p, label); }
  await use(p, mobile, 'mem-lamp', label);
  await choose(p, mobile, o.lamp, label);
  const keys = await until(p, () => window.JG_STORY.debug.state().scene === 'keys', null, 60000);
  if (!keys) { errs.push(`${label}: the memory did not lead to the keys`); return; }
  await phase(p, 'explore', 60000);
  if (o.shots) { await p.waitForTimeout(4000); await shot(p, `${o.tag}-keys`); }
  await use(p, mobile, 'keys', label);
  const dec = await until(p, () => window.JG_STORY.debug.state().scene === 'decision', null, 60000);
  if (!dec) errs.push(`${label}: the keys did not lead back to the lot`);
}
/* ---------- the decision and the ending ---------- */
async function decision(p, mobile, o, label) {
  for (const c of o.final || []) await choose(p, mobile, c, label);
  const end = await phase(p, 'end', 120000);
  if (!end) { errs.push(`${label}: no ending ${JSON.stringify(await st(p))}`); return; }
  const s = await st(p);
  if (s.ending !== o.ending) errs.push(`${label}: ending ${s.ending}, expected ${o.ending}`);
  await p.waitForSelector('.st-end.is-on', { timeout: 90000 });
  await p.waitForTimeout(1500);
  await shot(p, `${o.tag}-ending`);
  await textRules(p, `${label} ending`);
  const recap = await p.evaluate(() => [...document.querySelectorAll('.en-list li')].map(li => li.textContent));
  for (const r of o.recap || []) if (!recap.some(x => x.includes(r))) errs.push(`${label}: recap is missing "${r}" (${recap.join(' | ')})`);
  if (o.ending === 'hiring') {
    const href = await p.getAttribute('.st-end [data-build-resume]', 'href').catch(() => null);
    if (!href || !href.includes(o.resume)) errs.push(`${label}: hiring ending has no resume for ${o.resume} (${href})`);
    if (!(await p.$('.st-end .bcard'))) errs.push(`${label}: hiring ending has no card`);
  }
  if (o.ending === 'dealer' && !(await p.$('.st-end a[href="/obavia.html#early"]'))) errs.push(`${label}: dealer ending has no early access link`);
  if (o.ending === 'passing' && !(await p.$('.st-end [data-st="resume"]'))) errs.push(`${label}: passing ending has no resume`);
  if (o.ending === 'curious') {
    if (mobile) await p.tap('.st-end [data-st="run"]'); else await p.click('.st-end [data-st="run"]');
    const run = await until(p, () => window.JG_RUN && window.JG_RUN.isOpen(), null, 20000);
    if (!run) errs.push(`${label}: the cabinet did not open the run`); else notes.push(`${label}: the cabinet opens the run`);
  } else {
    if (mobile) await p.tap('.st-end [data-st="library"]'); else await p.click('.st-end [data-st="library"]');
    const lib = await until(p, () => !window.JG_STORY.isOpen() && !document.documentElement.classList.contains('story-on'), null, 10000);
    if (!lib) errs.push(`${label}: Enter the library did not close the episode`);
  }
  // trophies earned in the episode are the library's trophies
  const tro = await p.evaluate(() => JSON.parse(localStorage.getItem('jg_trophies') || '[]'));
  for (const t of o.trophies || []) if (!tro.includes(t)) errs.push(`${label}: trophy ${t} not in the library's store`);
  const f = await p.evaluate(() => window.JG_STORY.debug.state().fps);
  fps.push(`${label}: ${f.join(' ')}`);
}

/* ---------- the feel: the way, the controls, the camera, the sound (one short run per viewport) ---------- */
const FEEL = process.argv.includes('--feel');
const NOFEEL = process.argv.includes('--nofeel');
async function feel(vname, w, h, mobile) {
  const label = `${vname} feel`;
  const ctx = await ctxFor(w, h, mobile);
  // every AudioContext the page makes is logged with whether the visitor had pressed anything yet
  await ctx.addInitScript(() => {
    window.__ac = [];
    for (const k of ['AudioContext', 'webkitAudioContext']) {
      const C = window[k]; if (!C) continue;
      window[k] = class extends C { constructor(...a) { super(...a); window.__ac.push({ t: performance.now(), active: !!(navigator.userActivation && navigator.userActivation.hasBeenActive) }); } };
    }
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(`${label} pageerror: ${e.message}`));
  await p.goto(URL0 + '?debug=story&fast=1&pr=0.4');
  await p.waitForSelector('#intro [data-title-play]', { timeout: 20000 });
  await p.waitForTimeout(1500);
  const before = await p.evaluate(() => window.__ac.length);
  if (before) errs.push(`${label}: ${before} audio context(s) before any gesture`);
  await p.click('[data-title-play]');
  await phase(p, 'explore', 120000);
  await until(p, () => !window.JG_STORY.debug.state().line, null, 30000);
  const acs = await p.evaluate(() => window.__ac);
  if (acs.some(a => !a.active)) errs.push(`${label}: an audio context was made before a gesture`);
  // the sound: built after the press, with its buses, the lot's rain and lamps playing, nothing clipping
  await until(p, () => window.JG_STORY.debug.audio().loaded, null, 30000);
  let au = await p.evaluate(() => window.JG_STORY.debug.audio());
  if (!au.built || !au.buses) errs.push(`${label}: no audio graph after Play (${JSON.stringify(au).slice(0, 200)})`);
  else {
    for (const k of ['master', 'voice', 'sfx', 'amb', 'ui']) if (!(au.buses[k] > 0)) errs.push(`${label}: bus ${k} is silent (${au.buses[k]})`);
    for (const k of ['rain-hiss', 'roof', 'lamp', 'traffic']) if (!au.amb.includes(k)) errs.push(`${label}: the lot has no ${k}`);
    if (au.peakMax >= 1) errs.push(`${label}: the mix clips (peak ${au.peakMax})`);
    notes.push(`${label}: audio graph built on Play (${au.state}), buses ${Object.entries(au.buses).filter(([k]) => ['master', 'voice', 'sfx', 'amb', 'ui'].includes(k)).map(([k, v]) => k + ' ' + (+v).toFixed(2)).join(', ')}; lot bed: ${au.amb.join(' ')}`);
  }
  // the way: a trail toward Jason; turn the camera and the arrow moves to the side he's on
  // the trail fades in over a few frames; at software-GL frame rates give it time to land
  await until(p, () => window.JG_STORY.debug.guide().trail > 0, null, 15000);
  const g0 = await p.evaluate(() => window.JG_STORY.debug.guide());
  if (!g0.target || g0.target.id !== 'jason-lot') errs.push(`${label}: the way doesn't lead to Jason (${JSON.stringify(g0.target)})`);
  if (!(g0.trail > 0) || !g0.route || g0.route.length < 2) errs.push(`${label}: no trail on the ground (${g0.trail})`);
  await p.waitForTimeout(300);
  await shot0(p, `real-feel-guidance-${vname}`);
  const sides = {};
  for (const off of [1.7, -1.7]) {
    const t = g0.target, a = await p.evaluate(([x, z, o]) => window.JG_STORY.debug.yawTo(x, z, o), [t.x, t.z, off]);
    await p.waitForTimeout(400);
    const ar = (await p.evaluate(() => window.JG_STORY.debug.guide())).arrow;
    if (!ar.shown) { errs.push(`${label}: no edge arrow with the target off screen (turned ${off})`); continue; }
    const right = ar.x > w / 2, points = Math.cos(ar.ang) > 0;
    if (right !== points) errs.push(`${label}: the edge arrow at x ${ar.x} points ${points ? 'right' : 'left'}`);
    sides[off] = right;
    if (off > 0) await shot0(p, `real-feel-guidance-${vname}-arrow`);
  }
  if (sides[1.7] === sides[-1.7]) errs.push(`${label}: the arrow stayed on one side when the camera turned both ways`);
  else notes.push(`${label}: the trail leads to Jason; the edge arrow follows him off either side of the screen`);
  // the stuck helper: the arrow pulses once and the objective repeats
  const n0 = (await p.evaluate(() => window.JG_STORY.debug.guide())).nudges;
  await p.evaluate(() => window.JG_STORY.debug.stuck()); await p.waitForTimeout(1500);
  if (!((await p.evaluate(() => window.JG_STORY.debug.guide())).nudges > n0)) errs.push(`${label}: the stuck helper never nudged`);
  // controls: analog walk and run
  await p.evaluate(() => window.JG_STORY.debug.put(-8, 9, 0));
  if (mobile) {
    const cdp = await ctx.newCDPSession(p);
    const T0 = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const bx = Math.round(w * 0.18), by = Math.round(h * 0.75);
    await T0('touchStart', bx, by); await T0('touchMove', bx, by - 6); await T0('touchMove', bx, by - 26);
    await p.waitForTimeout(200);
    const lite = await p.evaluate(() => window.JG_STORY.debug.input());
    if (!lite.stick || lite.run || !(lite.want > 0.3 && lite.want < 1.46)) errs.push(`${label}: a light push should walk (${JSON.stringify(lite)})`);
    await T0('touchMove', bx, by - 58); await p.waitForTimeout(200);
    const full = await p.evaluate(() => window.JG_STORY.debug.input());
    if (!full.run || !full.stickRun || full.want < 2.5) errs.push(`${label}: a full push should run (${JSON.stringify(full)})`);
    await p.evaluate(() => window.JG_STORY.debug.sim(45, 1 / 30));
    const sp = (await p.evaluate(() => window.JG_STORY.debug.input())).speed;
    if (sp < 2.2) errs.push(`${label}: running speed only ${sp}`);
    await shot0(p, `real-feel-controls-${vname}`);
    await T0('touchMove', bx, by - 300); await p.waitForTimeout(100);
    const follow = await p.evaluate(() => window.JG_STORY.debug.input());
    if (!follow.run) errs.push(`${label}: a thumb past the rim lost the stick`);
    await T0('touchEnd'); await p.waitForTimeout(200);
    const off = await p.evaluate(() => window.JG_STORY.debug.input());
    if (off.stick || off.mag) errs.push(`${label}: the stick stayed after the thumb lifted`);
    notes.push(`${label}: floating stick: a light push walks at ${lite.want.toFixed(2)} m/s, a full push runs at ${full.want.toFixed(2)}, the base follows the thumb`);
    // a drag on the right turns the camera
    const yaw0 = await p.evaluate(() => window.JG_STORY.debug.camera());
    await T0('touchStart', Math.round(w * 0.8), Math.round(h * 0.5)); for (let i = 1; i <= 6; i++) await T0('touchMove', Math.round(w * 0.8) - i * 20, Math.round(h * 0.5)); await T0('touchEnd');
    await p.evaluate(() => window.JG_STORY.debug.sim(1, 1 / 30)); await p.waitForTimeout(1200);
    const yaw1 = await p.evaluate(() => window.JG_STORY.debug.camera());
    if (Math.hypot(yaw0[0] - yaw1[0], yaw0[2] - yaw1[2]) < 0.05) errs.push(`${label}: dragging on the right did not turn the camera`);
  } else {
    await p.keyboard.down('w'); await p.evaluate(() => window.JG_STORY.debug.sim(45, 1 / 30));
    const walk = (await p.evaluate(() => window.JG_STORY.debug.input())).speed;
    await p.keyboard.down('Shift'); await p.evaluate(() => window.JG_STORY.debug.sim(45, 1 / 30));
    const run = (await p.evaluate(() => window.JG_STORY.debug.input())).speed;
    await p.keyboard.up('Shift'); await p.keyboard.up('w');
    if (!(walk > 1.2 && walk < 1.6) || !(run > 2.3)) errs.push(`${label}: W walks at ${walk}, Shift W runs at ${run}`);
    else notes.push(`${label}: W walks at ${walk.toFixed(2)} m/s, Shift runs at ${run.toFixed(2)}`);
    const sf = await p.evaluate(() => [0.1, 0.3, 0.6, 0.85, 1].map(m => window.JG_STORY.debug.speedFor(m)));
    if (!(sf[0] === 0 || sf[0] < sf[1]) || !(sf[1] < sf[2]) || sf[3] < 2.5) errs.push(`${label}: the analog curve is off ${sf}`);
  }
  // tap to walk around a parked car: the path bends round it and gets there
  const walls = await p.evaluate(() => window.JG_STORY.debug.walls());
  const car = walls.find(r => r[1] - r[0] > 1.8 && r[1] - r[0] < 3 && r[3] - r[2] > 4 && r[3] - r[2] < 6 && r[2] > 0 && r[3] < 10);
  if (!car) errs.push(`${label}: no parked car to walk around`);
  else {
    const cx = (car[0] + car[1]) / 2, from = [cx, car[3] + 1.2], to = [cx, car[2] - 1.2];
    await p.evaluate(([x, z]) => window.JG_STORY.debug.put(x, z, Math.PI), from);
    const path = await p.evaluate(([x, z]) => window.JG_STORY.debug.walk(x, z), to);
    if (!path || path.length < 3) errs.push(`${label}: the walk across the car went straight (${JSON.stringify(path)})`);
    else {
      const hit = (x, z) => walls.some(r => x > r[0] - 0.05 && x < r[1] + 0.05 && z > r[2] - 0.05 && z < r[3] + 0.05);
      let through = false;
      for (let i = 1; i < path.length; i++) for (let k = 0; k <= 20; k++) { const t = k / 20; if (hit(path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t)) through = true; }
      if (through) errs.push(`${label}: the path cuts through a wall ${JSON.stringify(path)}`);
      const end = await p.evaluate(() => window.JG_STORY.debug.sim(600, 1 / 30));
      const miss = Math.hypot(end[0] - to[0], end[1] - to[1]);
      if (miss > 0.4) errs.push(`${label}: walking round the car ended ${miss.toFixed(2)} m short`);
      else notes.push(`${label}: tap to walk goes round a parked car in ${path.length - 1} legs and arrives`);
    }
  }
  // the camera never ends up inside a car, a pole, a fence or a person
  const pts = [[0.2, 19.5], [3, 18.5], [-6, 9], [cxOr(car, 0), 8.6], [4.8, 1], [10.6, -16.2], [13, -16.3], [-13.6, -6.4], [-1.5, 12.6], [18, -1], [-20, 0.5], [9, -12.5]];
  const pr = await p.evaluate(pts => window.JG_STORY.debug.camProbe(pts), pts);
  if (pr.bad.length) errs.push(`${label}: camera inside geometry at ${pr.bad.length} of ${pr.n} samples, e.g. ${JSON.stringify(pr.bad.filter((b, i, a) => i === a.findIndex(c => c[0] === b[0] && c[1] === b[1])).slice(0, 6))}`);
  else notes.push(`${label}: camera clear of geometry at all ${pr.n} sampled positions on the lot`);
  // skips are silent: no FX, no haptic, no interface sound when a line is cut short
  await p.evaluate(() => window.JG_STORY.debug.put(3.2, 18.2, 0));
  await p.evaluate(() => window.JG_STORY.debug.hold(true));
  await use(p, mobile, 'dell', label);
  const lineOn = await until(p, () => !!window.JG_STORY.debug.state().line, null, 20000);
  if (lineOn) {
    await p.evaluate(() => { window.__fx = 0; const f = window.JG_FX, h = window.JG_HAPTIC; window.JG_FX = k => { window.__fx++; return f(k); }; window.JG_HAPTIC = k => { window.__fx++; return h(k); }; window.__ev = window.JG_STORY.debug.audio().events.length; window.__evT = performance.now(); });
    if (mobile) await p.tap('.st-cap', { force: true }); else await p.click('.st-cap', { force: true });
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => ({ fx: window.__fx, ev: window.JG_STORY.debug.audio().events.filter(e => e.t > window.__evT && !['step', 'cloth', 'amb', 'scene', 'loaded', 'voice'].includes(e.kind)) }));
    if (r.fx || r.ev.length) errs.push(`${label}: skipping a line made sound or a haptic (${r.fx} fx, ${JSON.stringify(r.ev)})`);
    else notes.push(`${label}: skipping a line is silent`);
  } else errs.push(`${label}: Dell never spoke`);
  await p.evaluate(() => window.JG_STORY.debug.hold(false)); await p.evaluate(() => window.JG_STORY.debug.skip());
  // finish Dell's talk with the first choice
  const sc = await untilChoice(p, label); if (sc && sc.choices) await choose(p, mobile, sc.choices[0], label);
  await finishTalk(p, label);
  // settings: in the pause menu, sliders that stick across a reload
  if (mobile) await p.tap('[data-st="pause"]'); else await p.keyboard.press('Escape');
  await phase(p, 'pause', 8000);
  if (mobile) await p.tap('[data-p="settings"]'); else await p.click('[data-p="settings"]');
  if (!(await p.waitForSelector('[data-mix="master"]', { timeout: 30000 }).catch(() => null))) { await shot0(p, `real-feel-fail-${vname}`); throw new Error('no settings panel ' + JSON.stringify(await st(p)).slice(0, 300)); }
  await p.evaluate(() => { const r = document.querySelector('[data-mix="master"]'); r.value = 40; r.dispatchEvent(new Event('input', { bubbles: true })); const m = document.querySelector('[data-mix="music"]'); m.value = 25; m.dispatchEvent(new Event('input', { bubbles: true })); });
  if (!mobile) await p.click('[data-c="runToggle"]');
  await p.waitForTimeout(400);
  au = await p.evaluate(() => window.JG_STORY.debug.audio());
  const lv = await p.evaluate(() => window.JG_SCORE.level && window.JG_SCORE.level());
  if (Math.abs(au.mix.master - 0.4) > 0.01 || Math.abs(au.buses.master - 0.4) > 0.05) errs.push(`${label}: the Master slider did not set the level (${au.mix.master}, bus ${au.buses.master})`);
  if (!lv || Math.abs(lv.music - 0.1) > 0.02) errs.push(`${label}: the Music slider did not reach the score (${JSON.stringify(lv)})`);
  await shot0(p, `real-feel-settings-${vname}`);
  await textRules(p, `${label} settings`);
  await p.reload();
  await p.waitForSelector('#intro [data-title-play]', { timeout: 20000 });
  await p.click('[data-title-play]');
  await until(p, () => window.JG_STORY && window.JG_STORY.debug.state().open, null, 60000);
  const kept = await p.evaluate(() => window.JG_STORY.debug.settings());
  if (Math.abs(kept.mix.master - 0.4) > 0.01 || Math.abs(kept.mix.music - 0.25) > 0.01 || (!mobile && !kept.runToggle)) errs.push(`${label}: settings not kept across a reload ${JSON.stringify(kept)}`);
  else notes.push(`${label}: Master, Music${mobile ? '' : ' and the run toggle'} kept across a reload`);
  await ctx.close();
}
/* ---------- the voice clock: real voices, some arriving late; captions, the ball and the mouth follow the recording ---------- */
const SYNC = process.argv.includes('--sync');
async function sync(vname, w, h, mobile) {
  const label = `${vname} sync`;
  const ctx = await ctxFor(w, h, mobile);
  // every other recording arrives late, as on a slow phone connection; the caption must wait for it
  let nth = 0;
  await ctx.route(/assets\/voice\/story-v\d+\/.*\.mp3$/, async r => { if (nth++ % 2 === 0) await new Promise(res => setTimeout(res, 1100)); r.continue(); });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(`${label} pageerror: ${e.message}`));
  await p.goto(URL0 + '?debug=story&pr=0.2&sq=0');
  await p.waitForSelector('#intro [data-title-play]', { timeout: 20000 });
  await p.waitForSelector('#boot', { state: 'detached', timeout: 15000 }).catch(() => {});
  await p.click('[data-title-play]');
  // the arrival is your own thought (no voice): skip through it, silently, to the people who speak
  await until(p, () => { if (!window.JG_STORY) return false; const d = window.JG_STORY.debug; if (d.state().line) d.skip(); return d.state().phase === 'explore'; }, null, 400000);
  if (((await st(p)) || {}).phase !== 'explore') { errs.push(`${label}: never got to explore ${JSON.stringify(await st(p))}`); await ctx.close(); return; }
  const on = await p.evaluate(() => !!(window.JG_SCORE && window.JG_SCORE.isOn()));
  if (!on) { errs.push(`${label}: the score is off after Play, so nothing is voiced`); await ctx.close(); return; }
  // sample every frame: the caption's clock against the recording's, the lit words, the ball, how many voices sound
  await p.evaluate(() => {
    window.__sync = []; const D = window.JG_STORY.debug;
    const f = () => { const s = D.sync(); if (s.line) { const b = D.ball(); window.__sync.push({ line: s.line, mode: s.mode, now: s.now, ct: s.ct, paused: s.paused, stall: s.stall, said: s.said, words: s.words, voices: s.voices, ball: b && b.b ? { x: b.b.x, y: b.b.y, air: b.b.air, o: b.b.o } : null }); } else window.__sync.push({ line: null, voices: s.voices }); window.__syncRaf = requestAnimationFrame(f); };
    f();
  });
  await use(p, mobile, 'dell', label);
  await choose(p, mobile, 'Rough night to be out.', label);
  await phase(p, 'explore', 120000);
  await until(p, () => !window.JG_STORY.debug.state().line, null, 60000);
  const r = await p.evaluate(() => { cancelAnimationFrame(window.__syncRaf); return { s: window.__sync, log: window.JG_STORY.debug.sync().log }; });
  const voiced = r.log.filter(l => l.voiced);
  if (voiced.length < 3) errs.push(`${label}: only ${voiced.length} voiced lines played (${JSON.stringify(r.log.map(l => l.id + ':' + l.mode))})`);
  // drift: the lit words against the words the recording has reached; the caption clock against currentTime
  let n = 0, wordOff = 0, maxDrift = 0, sumDrift = 0, maxVoices = 0, early = 0;
  for (const x of r.s) {
    maxVoices = Math.max(maxVoices, x.voices || 0);
    if (!x.line || x.mode !== 'voice' || x.paused || x.ct == null) { if (x.line && x.mode === 'wait' && x.said > 0) early++; continue; }
    const d = Math.abs(x.now - x.ct); maxDrift = Math.max(maxDrift, d); sumDrift += d; n++;
    const want = x.words.filter(w => x.ct >= w[0] - 0.02).length;
    if (Math.abs(want - x.said) > 1) wordOff++;
  }
  if (!n) errs.push(`${label}: never saw a voice playing`);
  if (maxVoices > 1) errs.push(`${label}: ${maxVoices} voices sounded at once`);
  if (early) errs.push(`${label}: words lit before their voice started (${early} frames)`);
  if (n && maxDrift > 0.3) errs.push(`${label}: the caption clock drifted ${maxDrift.toFixed(3)} s from the recording`);
  if (n && wordOff > n * 0.02) errs.push(`${label}: the lit words were more than a word off the voice in ${wordOff} of ${n} frames`);
  // each voiced line ends after its recording ends (a short hold), and the next line starts after that
  const ends = [];
  for (const l of voiced) {
    if (l.skipped) continue;
    if (l.mode !== 'voice') { errs.push(`${label}: ${l.id} fell back to ${l.mode}`); continue; }
    if (!l.ended) { errs.push(`${label}: ${l.id} ended before its voice did`); continue; }
    ends.push(l.end - l.ended);
    if (l.end < l.ended - 5) errs.push(`${label}: ${l.id} ended ${(l.ended - l.end).toFixed(0)} ms before its voice`);
  }
  for (let i = 1; i < r.log.length; i++) if (r.log[i].at < r.log[i - 1].end - 5) errs.push(`${label}: ${r.log[i].id} started before ${r.log[i - 1].id} finished`);
  const waits = voiced.filter(l => l.playing).map(l => Math.round(l.playing - l.at));
  // the ball lands on each word: at the word's start it sits on that word
  const landed = r.s.filter(x => x.ball && x.mode === 'voice' && !x.ball.air).length, air = r.s.filter(x => x.ball && x.ball.air && x.ball.o > 0.5).length;
  if (!landed || !air) errs.push(`${label}: the caption ball never ${landed ? 'flew' : 'landed'}`);
  notes.push(`${label}: ${voiced.length} voiced lines (half their files held back 1.1 s), caption clock vs recording drift mean ${(sumDrift / Math.max(1, n) * 1000).toFixed(1)} ms, max ${(maxDrift * 1000).toFixed(0)} ms over ${n} frames; lit words off by more than one word in ${wordOff} frames; voices at once: max ${maxVoices}; caption waited for its voice ${waits.join(', ')} ms; line ends ${ends.map(e => Math.round(e)).join(', ')} ms after the voice; ball landed ${landed} frames, in flight ${air}`);
  await ctx.close();
}
/* ---------- driving: get in, drive, steer, brake, hit something, swap the camera, get out (keys on desktop, the touch controls on a phone) ---------- */
const DRIVE = process.argv.includes('--drive');
async function drive(vname, w, h, mobile) {
  const label = `${vname} drive`;
  const ctx = await ctxFor(w, h, mobile);
  const p = await ctx.newPage();
  p.on('pageerror', e => { const m = `${label} pageerror: ${e.message}`; if (!errs.includes(m)) errs.push(m); });
  await p.goto(URL0 + '?debug=story&fast=1&sq=' + (SHOTS ? '1' : '0') + '&pr=' + (SHOTS ? '0.8' : '0.3'));
  await p.waitForSelector('#intro [data-title-play]', { timeout: 20000 });
  await p.waitForSelector('#boot', { state: 'detached', timeout: 15000 }).catch(() => {});
  if (mobile) await p.tap('[data-title-play]'); else await p.click('[data-title-play]');
  if (!(await phase(p, 'explore', 120000))) { errs.push(`${label}: never got to explore`); await ctx.close(); return; }
  await until(p, () => !window.JG_STORY.debug.state().line && window.JG_STORY.debug.cars().length > 0, null, 60000);
  const D = () => p.evaluate(() => window.JG_STORY.debug.drive());
  const cars = await p.evaluate(() => window.JG_STORY.debug.cars());
  if (!cars.length) { errs.push(`${label}: no drivable cars on the lot`); await ctx.close(); return; }
  const car = cars.find(c => c.id !== 'idle') || cars[0];
  // stand at the driver's door: the Drive prompt shows
  await p.evaluate(([x, z, cx, cz]) => window.JG_STORY.debug.put(x, z, Math.atan2(cx - x, cz - z)), [car.stand[0], car.stand[1], car.x, car.z]);
  const near = await until(p, id => window.JG_STORY.debug.state().near === id, 'car:' + car.id, 15000);
  if (!near) { errs.push(`${label}: no Drive prompt at ${car.id}'s door (near ${(await st(p)).near})`); await ctx.close(); return; }
  const verb = await p.textContent('.st-prompt__verb');
  if (verb !== STORY.ui.drive) errs.push(`${label}: the prompt says "${verb}", not "${STORY.ui.drive}"`);
  // in: E on a keyboard, the big button on a phone; the sequence plays (on a phone, a tap skips it)
  if (mobile) await p.tap('.st-act', { force: true }); else await p.keyboard.press('e');
  await until(p, () => window.JG_STORY.debug.drive().state === 'enter', null, 5000);
  const t0 = Date.now();
  if (mobile) { await p.waitForTimeout(1500); await p.evaluate(() => window.JG_STORY.debug.skipCar()); }
  const inside = await until(p, () => window.JG_STORY.debug.drive().state === 'drive', null, 120000);
  if (!inside) { errs.push(`${label}: never got in ${JSON.stringify(await D())}`); await ctx.close(); return; }
  const dIn = await D();
  notes.push(`${label}: Drive at ${car.id}'s door; in after ${((Date.now() - t0) / 1000).toFixed(1)} s${mobile ? ' (skipped with a tap)' : ''}, seated ${dIn.inCar}, engine ${dIn.au && dIn.au.on ? 'on' : 'quiet (sound off)'}`);
  if (!dIn.ui) errs.push(`${label}: the drive controls did not show`);
  await p.waitForTimeout(1200);
  await shot0(p, `drive-${vname}-chase`);
  // drive: hold the gas; then steer; then brake
  const pressGas = async on => { if (mobile) { const b = await p.$('[data-drv="gas"]'); const bb = await b.boundingBox(); await touch(on ? 'touchStart' : 'touchEnd', bb.x + bb.width / 2, bb.y + bb.height / 2, 2); } else if (on) await p.keyboard.down('w'); else await p.keyboard.up('w'); };
  let cdp = null;
  const touch = async (type, x, y, id) => { cdp = cdp || await ctx.newCDPSession(p); touch.pts = touch.pts || {}; if (type === 'touchEnd') delete touch.pts[id]; else touch.pts[id] = { x: Math.round(x), y: Math.round(y), id }; await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: Object.values(touch.pts) }); };
  // a clear run on the lot to drive and turn in
  const lane = await p.evaluate(() => window.JG_STORY.debug.lane(14));
  if (!lane) errs.push(`${label}: no clear lane on the lot to drive in`);
  else await p.evaluate(l => window.JG_STORY.debug.carPut(l[0], l[1], l[2]), lane);
  await p.waitForTimeout(400);
  await pressGas(true);
  await until(p, () => window.JG_STORY.debug.drive().speed > 3, null, 40000);
  await p.waitForTimeout(300);
  const fast = await D();
  if (!(fast.speed > 3)) errs.push(`${label}: the gas didn't get it moving (${JSON.stringify(fast)})`);
  if (!(fast.rpm > 1000)) errs.push(`${label}: the engine didn't rev (${fast.rpm})`);
  if (fast.fov <= dIn.fov) errs.push(`${label}: the view didn't widen with speed (${dIn.fov} to ${fast.fov})`);
  if (mobile) await shot0(p, `drive-${vname}-touch`);
  // steer right
  const yaw0 = fast.pose[2];
  if (mobile) { const s0 = await (await p.$('.st-drive__steer')).boundingBox(); const sx = s0.x + s0.width / 2, sy = s0.y + s0.height / 2; await touch('touchStart', sx, sy, 3); for (let i = 1; i <= 6; i++) await touch('touchMove', sx + i * 14, sy, 3); }
  else await p.keyboard.down('d');
  await until(p, y0 => Math.abs(window.JG_STORY.debug.drive().pose[2] - y0) > 0.25, yaw0, 20000);
  const turned = await D();
  if (!(turned.inp.steer > 0.3)) errs.push(`${label}: steering right read ${turned.inp.steer}`);
  if (Math.abs(turned.pose[2] - yaw0) < 0.25) errs.push(`${label}: the car didn't turn (${yaw0} to ${turned.pose[2]})`);
  if (mobile) await touch('touchEnd', 0, 0, 3); else await p.keyboard.up('d');
  await pressGas(false);
  // brake
  if (mobile) { const b = await (await p.$('[data-drv="brake"]')).boundingBox(); await touch('touchStart', b.x + b.width / 2, b.y + b.height / 2, 4); } else await p.keyboard.down('s');
  const v1 = (await D()).speed;
  await until(p, () => Math.abs(window.JG_STORY.debug.drive().speed) < 0.5, null, 30000);
  const stopped = await D();
  if (mobile) await touch('touchEnd', 0, 0, 4); else await p.keyboard.up('s');
  if (Math.abs(stopped.speed) >= 0.5) errs.push(`${label}: braking from ${v1} only got to ${stopped.speed}`);
  else notes.push(`${label}: gas to ${fast.speed} m/s at ${fast.rpm} rpm (gear ${fast.gear}, view ${dIn.fov} to ${fast.fov} degrees), steered ${(turned.pose[2] - yaw0).toFixed(2)} rad, braked from ${v1} to a stop`);
  // hit something: point it at a parked car a few metres off and floor it
  const walls = await p.evaluate(() => window.JG_STORY.debug.walls());
  const here = (await D()).pose;
  const target = walls.map(r => ({ r, cx: (r[0] + r[1]) / 2, cz: (r[2] + r[3]) / 2 })).filter(o => { const a = o.r[1] - o.r[0], b = o.r[3] - o.r[2]; return Math.max(a, b) > 3.6 && Math.max(a, b) < 6 && Math.min(a, b) > 1.5 && Math.min(a, b) < 2.4 && Math.hypot(o.cx - here[0], o.cz - here[1]) > 3; }).sort((a, b) => Math.hypot(a.cx - here[0], a.cz - here[1]) - Math.hypot(b.cx - here[0], b.cz - here[1]))[0];
  if (!target) errs.push(`${label}: nothing to drive into`);
  else {
    // start 7 m off the target's long side, facing it
    const a = target.r[1] - target.r[0] > target.r[3] - target.r[2];
    let sx = target.cx, sz = target.cz; if (a) sz += (target.cz > 0 ? -1 : 1) * 7; else sx += (target.cx > 0 ? -1 : 1) * 7;
    await p.evaluate(([x, z, tx, tz]) => window.JG_STORY.debug.carPut(x, z, Math.atan2(tx - x, tz - z)), [sx, sz, target.cx, target.cz]);
    const h0 = (await D()).hits;
    await pressGas(true);
    const hit = await until(p, h0 => window.JG_STORY.debug.drive().hits > h0, h0, 40000);
    await p.waitForTimeout(60);
    const dh = await D();
    await pressGas(false);
    if (!hit) errs.push(`${label}: drove at a parked car and never hit it (${JSON.stringify(dh.pose)}, target ${JSON.stringify(target.r)})`);
    else {
      const ev = await p.evaluate(() => window.JG_STORY.debug.audio().events.filter(e => e.kind === 'car').map(e => e.name));
      if (!(dh.shake > 0) && !dh.log.length) errs.push(`${label}: a hit didn't shake the camera`);
      notes.push(`${label}: hit ${dh.log.slice(-1).map(l => l.what + ' at ' + l.k + ' m/s').join('')}; the camera shook; car sounds: ${[...new Set(ev)].join(' ') || 'none (sound off)'}`);
      if (await p.evaluate(() => window.JG_SCORE && window.JG_SCORE.isOn()) && !ev.includes('impact')) errs.push(`${label}: no impact sound`);
    }
    await p.waitForTimeout(800);
    await shot0(p, `drive-${vname}-impact`);
  }
  // the camera: in the car, then back out
  if (mobile) await p.tap('[data-drv="cam"]', { force: true }); else await p.keyboard.press('c');
  await p.waitForTimeout(900);
  const inCam = await D();
  if (inCam.cam !== 'car') errs.push(`${label}: C/camera didn't switch to the in-car view`);
  await shot0(p, `drive-${vname}-incar`);
  if (mobile) await p.tap('[data-drv="cam"]', { force: true }); else await p.keyboard.press('c');
  // a talk prompt never shows from inside the car
  const ns = await st(p); if (ns.near) errs.push(`${label}: a prompt (${ns.near}) showed from inside the car`);
  // pause works in the car
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  if ((await st(p)).phase !== 'pause') errs.push(`${label}: Esc didn't pause in the car`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  if ((await st(p)).phase !== 'drive') errs.push(`${label}: resume didn't come back to the car (${(await st(p)).phase})`);
  // out
  if (mobile) await p.tap('[data-drv="out"]', { force: true }); else await p.keyboard.press('e');
  if (mobile) { await p.waitForTimeout(1200); await p.evaluate(() => window.JG_STORY.debug.skipCar()); }
  const out = await until(p, () => window.JG_STORY.debug.state().phase === 'explore' && !window.JG_STORY.debug.drive().state, null, 120000);
  // on your feet: the walk camera finds its room again (a few frames, which is a while on software GL)
  await until(p, () => window.JG_STORY.debug.drive().visible, null, 30000);
  const dOut = await D();
  if (!out) errs.push(`${label}: never got out (${JSON.stringify(dOut)})`);
  else if (!dOut.visible || dOut.inCar) errs.push(`${label}: out of the car but not on your feet (${JSON.stringify(dOut)}, you at ${JSON.stringify((await st(p)).me)})`);
  else notes.push(`${label}: got out on your feet; the walk is back`);
  await ctx.close();
}
/* ---------- the caption ball: stills in flight and landed, and it never sits on the words ---------- */
const BALL = process.argv.includes('--ball');
async function ballCheck(vname, w, h, mobile) {
  const label = `${vname} ball`;
  const ctx = await ctxFor(w, h, mobile);
  const p = await ctx.newPage();
  p.on('pageerror', e => { const m = `${label} pageerror: ${e.message}`; if (!errs.includes(m)) errs.push(m); });
  await p.goto(URL0 + '?debug=story&fast=1&sq=0&pr=0.5');
  await p.waitForSelector('#intro [data-title-play]', { timeout: 20000 });
  await p.waitForSelector('#boot', { state: 'detached', timeout: 15000 }).catch(() => {});
  if (mobile) await p.tap('[data-title-play]'); else await p.click('[data-title-play]');
  if (!(await phase(p, 'explore', 300000))) { errs.push(`${label}: never got to explore`); await ctx.close(); return; }
  await until(p, () => !window.JG_STORY.debug.state().line, null, 30000);
  await p.evaluate(() => window.JG_STORY.debug.hold(true));
  await use(p, mobile, 'jason-lot', label);
  if (!(await until(p, () => { const s = window.JG_STORY.debug.sync(); return s.line && s.words.length >= 6; }, null, 30000))) { errs.push(`${label}: no line long enough to watch`); await ctx.close(); return; }
  await p.waitForTimeout(600);
  const r = await p.evaluate(() => {
    const D = window.JG_STORY.debug, s = D.sync(), W = s.words, cap = document.querySelector('.st-cap').getBoundingClientRect();
    const spans = [...document.querySelectorAll('.st-cap__said i')].map(e => { const q = e.getBoundingClientRect(); return { x0: q.left - cap.left, x1: q.right - cap.left, y0: q.top - cap.top + (q.height - parseFloat(getComputedStyle(e).fontSize)) * 0.5, y1: q.bottom - cap.top - (q.height - parseFloat(getComputedStyle(e).fontSize)) * 0.5 }; });
    let over = 0, n = 0, landed = 0, air = 0, R = D.ball(0).R;
    const end = W[W.length - 1][1] + 0.5;
    for (let t = 0; t < end; t += 0.01) {
      const b = D.ball(t).b; if (!b || b.o < 0.3) continue; n++;
      if (b.air) air++; else landed++;
      if (b.wrap) continue;
      // the glyphs proper (not the line box): the ball may pass over the gap, never over a word's letters
      if (spans.some(q => b.x + R > q.x0 + 1 && b.x - R < q.x1 - 1 && b.y + R > q.y0 + 2 && b.y - R < q.y1 - 2)) over++;
    }
    // a mid-flight moment and a landed one
    let fly = null; for (let i = 1; i < W.length && !fly; i++) { const t = W[i][0] - Math.min(0.12, (W[i][0] - W[i - 1][0]) * 0.3); const b = D.ball(t).b; if (b && b.air && !b.wrap && W[i][0] - W[i - 1][0] > 0.2) fly = t; }
    return { over, n, landed, air, fly: fly || W[2][0] - 0.06, land: W[2][0] + 0.08, rest: W[Math.min(4, W.length - 1)][0] + 0.12, line: s.line };
  });
  if (r.over) errs.push(`${label}: the ball sat on the letters in ${r.over} of ${r.n} samples`);
  if (!r.air || !r.landed) errs.push(`${label}: the ball never ${r.air ? 'landed' : 'flew'}`);
  await p.evaluate(t => window.JG_STORY.debug.pin(t), r.fly); await p.waitForTimeout(500);
  await shot0(p, `caption-ball-${vname}-flight`);
  await p.evaluate(t => window.JG_STORY.debug.pin(t), r.land); await p.waitForTimeout(500);
  await shot0(p, `caption-ball-${vname}-landed`);
  const cap = await p.$('.st-cap'); const bb = await cap.boundingBox();
  await p.screenshot({ path: path.join(OUT, `caption-ball-${vname}.png`), clip: { x: Math.max(0, bb.x - 20), y: Math.max(0, bb.y - 30), width: Math.min(w, bb.width + 40), height: Math.min(h - Math.max(0, bb.y - 30), bb.height + 50) } });
  await p.evaluate(() => { window.JG_STORY.debug.pin(null); window.JG_STORY.debug.hold(false); });
  notes.push(`${label}: on ${r.line} the ball flew in ${r.air} and rested in ${r.landed} of ${r.n} samples, on the letters in ${r.over}; stills caption-ball-${vname}{,-flight,-landed}.png`);
  await ctx.close();
}
/* ---------- resume: save at several points, reload, Continue, and you can still walk (keys, or the touch stick) ---------- */
const RESUME = process.argv.includes('--resume');
async function resume(vname, w, h, mobile) {
  const label = `${vname} resume`;
  const ctx = await ctxFor(w, h, mobile);
  const p = await ctx.newPage();
  p.on('pageerror', e => { const m = `${label} pageerror: ${e.message}`; if (!errs.includes(m)) errs.push(m); });
  const go = async () => { await p.goto(URL0 + '?debug=story&fast=1&sq=0&pr=0.3'); await p.waitForSelector('#intro [data-title-play]', { timeout: 30000 }); await p.waitForSelector('#boot', { state: 'detached', timeout: 15000 }).catch(() => {}); };
  const press = async () => { if (mobile) await p.tap('[data-title-play]'); else await p.click('[data-title-play]'); };
  // to explore: skip lines; at choices take the first
  const toExplore = async () => until(p, () => { if (!window.JG_STORY) return false; const d = window.JG_STORY.debug, s = d.state(); if (s.line) d.skip(); else if (s.choices) d.choose(0); else if (s.phase === 'sheet') d.desk(); else if (s.phase === 'close') d.closeAll(); return s.phase === 'explore'; }, null, 300000);
  let cdp = null;
  const canMove = async tag => {
    if (!(await toExplore())) { errs.push(`${label} ${tag}: never got back to exploring ${JSON.stringify(await st(p))}`); return; }
    await turnAway(p);
    const a = (await st(p)).me;
    if (mobile) {
      cdp = cdp || await ctx.newCDPSession(p);
      const bx = Math.round(w * 0.18), by = Math.round(h * 0.75), T0 = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
      await T0('touchStart', bx, by); await T0('touchMove', bx, by - 10); await T0('touchMove', bx, by - 40);
      await until(p, a => { const m = window.JG_STORY.debug.state().me; return Math.hypot(m[0] - a[0], m[1] - a[1]) > 0.05; }, a, 20000);
      await p.evaluate(() => window.JG_STORY.debug.sim(30, 1 / 30));
      await T0('touchEnd');
    } else {
      await p.keyboard.down('w');
      await until(p, a => { const m = window.JG_STORY.debug.state().me; return Math.hypot(m[0] - a[0], m[1] - a[1]) > 0.05; }, a, 20000);
      await p.evaluate(() => window.JG_STORY.debug.sim(30, 1 / 30));
      await p.keyboard.up('w');
    }
    const b2 = (await st(p)).me, d = Math.hypot(b2[0] - a[0], b2[1] - a[1]);
    if (d < 0.4) errs.push(`${label} ${tag}: can't move after resuming (moved ${d.toFixed(2)} m from ${a.map(n => n.toFixed(1))}, ${JSON.stringify(await p.evaluate(() => window.JG_STORY.debug.input()))})`);
    else notes.push(`${label} ${tag}: walks ${d.toFixed(2)} m with ${mobile ? 'the touch stick' : 'W'} after resuming`);
  };
  const reload = async () => { await go(); const lab = (await p.textContent('[data-title-play]')).trim(); if (lab !== 'Continue') errs.push(`${label}: the start screen says "${lab}" after a save`); await press(); };
  await p.addInitScript(() => { try { if (!sessionStorage.getItem('__cleared')) { localStorage.removeItem('jg_story'); sessionStorage.setItem('__cleared', '1'); } } catch (e) {} });
  await go(); await press();
  // 1: saved on the lot, before meeting anyone
  await toExplore(); await reload(); await canMove('lot, before Jason');
  // 2: mid-talk with Dell
  await p.evaluate(() => window.JG_STORY.debug.hold(true));
  await use(p, mobile, 'dell', label);
  await until(p, () => !!window.JG_STORY.debug.state().line, null, 20000);
  await reload(); await canMove('mid-talk');
  // 3: after a choice
  await use(p, mobile, 'dell', label);
  await until(p, () => { const d = window.JG_STORY.debug, s = d.state(); if (s.line) d.skip(); return !!s.choices; }, null, 60000);
  await p.evaluate(() => window.JG_STORY.debug.choose(0)); await p.waitForTimeout(500);
  await reload(); await canMove('after a choice');
  // 4: in a car
  const cars = await p.evaluate(() => window.JG_STORY.debug.cars());
  if (cars.length) {
    const c = cars.find(x => x.id !== 'idle') || cars[0];
    await p.evaluate(([x, z, cx, cz]) => window.JG_STORY.debug.put(x, z, Math.atan2(cx - x, cz - z)), [c.stand[0], c.stand[1], c.x, c.z]);
    await until(p, id => window.JG_STORY.debug.state().near === id, 'car:' + c.id, 15000);
    await p.evaluate(id => window.JG_STORY.debug.interact(id), 'car:' + c.id);
    await until(p, () => window.JG_STORY.debug.drive().state, null, 10000); await p.evaluate(() => window.JG_STORY.debug.skipCar());
    await until(p, () => window.JG_STORY.debug.drive().state === 'drive', null, 60000);
    await reload(); await canMove('saved in a car');
  }
  // 5: paused while arriving (the scene card), then Resume: you can walk
  await go(); await press();
  await until(p, () => window.JG_STORY && window.JG_STORY.debug.state().phase === 'cinematic', null, 120000);
  await p.waitForTimeout(150);
  if (mobile) await p.tap('[data-st="pause"]', { force: true }).catch(() => p.evaluate(() => document.querySelector('[data-st="pause"]').click())); else await p.keyboard.press('Escape');
  await until(p, () => window.JG_STORY.debug.state().phase === 'pause', null, 15000);
  await p.waitForTimeout(4000);
  if (mobile) await p.tap('[data-p="resume"]', { force: true }); else await p.keyboard.press('Escape');
  await canMove('paused while arriving, then resumed');
  // 6: close and open again in the same page
  await p.evaluate(() => window.JG_STORY.close('test')); await p.waitForTimeout(800);
  await p.evaluate(() => window.JG_STORY.open(null, 'test'));
  await canMove('closed and reopened');
  // 7: the office, by its link, then Continue
  await p.goto('about:blank');
  await p.goto(URL0 + '?debug=story&fast=1&sq=0&pr=0.3#story/office');
  await p.waitForSelector('#intro [data-intro-skip]', { timeout: 60000 }).catch(() => {}); await p.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).catch(() => {});
  await p.click('#intro [data-intro-skip]').catch(() => {});
  await until(p, () => window.JG_STORY && window.JG_STORY.debug.state().scene === 'office', null, 240000);
  await canMove('office by its link');
  await reload(); await canMove('office, continued');
  await ctx.close();
}
/* ---------- the way: every hint's trail ends at the thing it names (or the way into its room) ---------- */
const WAY = process.argv.includes('--way');
async function wayCheck(vname, w, h, mobile) {
  const label = `${vname} way`;
  const ctx = await ctxFor(w, h, mobile);
  const p = await ctx.newPage();
  p.on('pageerror', e => { const m = `${label} pageerror: ${e.message}`; if (!errs.includes(m)) errs.push(m); });
  const toExplore = async () => until(p, () => { if (!window.JG_STORY) return false; const d = window.JG_STORY.debug, s = d.state(); if (s.line) d.skip(); else if (s.choices) d.choose(0); else if (s.phase === 'sheet') d.desk(); else if (s.phase === 'close') d.closeAll(); return s.phase === 'explore'; }, null, 300000);
  const check = async (talk, want, where) => {
    // the thing has to be there to be pointed at: the phone rings, the book is mentioned, the desk is open
    const need = (STORY.objects[want] || {}).if;
    await p.evaluate(([t, id, f]) => { const d = window.JG_STORY.debug; if (f && /^\w+$/.test(f)) d.flag(f, 1); d.unlook(id); d.obj(null); d.hint(t); }, [talk, want, need || null]);
    const ok = await until(p, want => { const g = window.JG_STORY.debug.guide(); return g.target && g.target.id === want && g.route && g.route.length > 1; }, want, 20000);
    const g = await p.evaluate(() => window.JG_STORY.debug.guide());
    if (!ok) { errs.push(`${label}: after "${talk}" the way leads to ${g.target ? g.target.id : 'nothing'}, not ${want}`); return; }
    const end = g.route[g.route.length - 1], miss = Math.hypot(end[0] - g.target.x, end[1] - g.target.z);
    if (miss > 0.6) errs.push(`${label}: the trail for "${talk}" stops ${miss.toFixed(2)} m short of ${want}`);
    return true;
  };
  // the lot: after meeting Jason, an office hint leads to the door
  await p.goto(URL0 + '?debug=story&fast=1&sq=0&pr=0.3');
  await p.waitForSelector('#intro [data-title-play]', { timeout: 30000 }); await p.waitForSelector('#boot', { state: 'detached', timeout: 15000 }).catch(() => {});
  if (mobile) await p.tap('[data-title-play]'); else await p.click('[data-title-play]');
  await toExplore(); await turnAway(p);
  let n = 0;
  await p.evaluate(() => window.JG_STORY.debug.flag('met', 1));
  for (const t of ['hire-build', 'lot-paperwork', 'lot-come-in']) if (await check(t, 'door', 'lot')) n++;
  // the office: each hint leads to its own thing
  await p.goto('about:blank');
  await p.goto(URL0 + '?debug=story&fast=1&sq=0&pr=0.3#story/office');
  await p.waitForSelector('#intro [data-intro-skip]', { timeout: 60000 }).catch(() => {}); await p.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).catch(() => {});
  await p.click('#intro [data-intro-skip]').catch(() => {});
  await until(p, () => window.JG_STORY && window.JG_STORY.debug.state().scene === 'office', null, 240000);
  await toExplore(); await turnAway(p);
  const H = await p.evaluate(() => window.JG_STORY.debug.hints());
  for (const [t, id] of Object.entries(H)) { if (STORY.objects[id] && STORY.objects[id].scene === 'office' && await check(t, id, 'office')) n++; }
  await shot0(p, `way-${vname}`);
  notes.push(`${label}: ${n} hints checked; each trail ends at the thing named (or the office door from the lot)`);
  await ctx.close();
}
/* ---------- the sound: no missing files, one voice at a time, beds that change with the room, feet on every
   surface, car sounds that stop when you get out, nothing stuck after a scene change, nothing clipping ---------- */
const AUDIO = process.argv.includes('--audio');
async function audioCheck(vname, w, h, mobile) {
  const label = `${vname} audio`;
  const ctx = await ctxFor(w, h, mobile);
  const p = await ctx.newPage();
  const missing = [];
  p.on('response', r => { if (r.status() >= 400 && /\/assets\//.test(r.url())) missing.push(r.status() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '')); });
  p.on('pageerror', e => { const m = `${label} pageerror: ${e.message}`; if (!errs.includes(m)) errs.push(m); });
  await p.goto(URL0 + '?debug=story&pr=0.2&sq=0');
  await p.waitForSelector('#intro [data-title-play]', { timeout: 30000 }); await p.waitForSelector('#boot', { state: 'detached', timeout: 15000 }).catch(() => {});
  if (mobile) await p.tap('[data-title-play]'); else await p.click('[data-title-play]');
  await until(p, () => { if (!window.JG_STORY) return false; const d = window.JG_STORY.debug, s = d.state(); if (s.line && s.line.startsWith('lot-you')) d.skip(); return s.phase === 'explore'; }, null, 400000);
  await turnAway(p);
  if (!(await p.evaluate(() => window.JG_SCORE && window.JG_SCORE.isOn()))) { errs.push(`${label}: the score is off after Play`); await ctx.close(); return; }
  const A = () => p.evaluate(() => window.JG_STORY.debug.audio());
  const lotAmb = (await A()).amb;
  // voices: Dell's lines, each played once, never two at a time, the world ducked under them
  await p.evaluate(() => { window.__vmax = 0; window.__duck = 1; const f = () => { const d = window.JG_STORY.debug, s = d.sync(), a = d.audio(); window.__vmax = Math.max(window.__vmax, s.voices); if (s.line && s.mode === 'voice' && a.buses) window.__duck = Math.min(window.__duck, a.buses.ambDuck); window.__vr = requestAnimationFrame(f); }; f(); });
  await use(p, mobile, 'dell', label);
  await choose(p, mobile, 'Rough night to be out.', label);
  await until(p, () => window.JG_STORY.debug.state().phase === 'explore' && !window.JG_STORY.debug.state().line, null, 120000);
  const v = await p.evaluate(() => { cancelAnimationFrame(window.__vr); const log = window.JG_STORY.debug.sync().log, ev = window.JG_STORY.debug.audio().events.filter(e => e.kind === 'voice').map(e => e.name); return { log, ev, vmax: window.__vmax, duck: window.__duck }; });
  const voiced = v.log.filter(l => l.voiced);
  const twice = Object.entries(v.ev.reduce((m, n) => (m[n] = (m[n] || 0) + 1, m), {})).filter(([, n]) => n > 1);
  if (!voiced.length) errs.push(`${label}: no voiced lines played`);
  if (v.vmax > 1) errs.push(`${label}: ${v.vmax} voices at once`);
  if (twice.length) errs.push(`${label}: voices routed twice: ${twice.map(t => t[0]).join(' ')}`);
  if (!(v.duck < 0.95)) errs.push(`${label}: the world didn't step back under the voices (amb duck ${v.duck})`);
  for (const l of voiced) if (l.mode !== 'voice' || !l.ended) errs.push(`${label}: ${l.id} ${l.mode !== 'voice' ? 'fell back to ' + l.mode : 'never finished its voice'}`);
  // feet: on the lot's wet and dry ground
  const surf = new Set();
  for (const [x, z] of [[-6, 9], [2, -18.2]]) {
    await p.evaluate(([x, z]) => window.JG_STORY.debug.put(x, z, 0), [x, z]);
    const n0 = (await A()).events.length;
    if (mobile) await p.evaluate(() => window.JG_STORY.debug.sim(40, 1 / 30)); else { await p.keyboard.down('w'); await p.evaluate(() => window.JG_STORY.debug.sim(40, 1 / 30)); await p.keyboard.up('w'); }
    await p.waitForTimeout(300);
    const evs = (await A()).events.slice(n0).filter(e => e.kind === 'step');
    if (evs.length) surf.add(await p.evaluate(([x, z]) => window.JG_STORY.debug.surface(x, z), [x, z]));
  }
  if (!surf.size) errs.push(`${label}: no footsteps on the lot`);
  // a car: its sounds start, and stop when you get out
  const cars = await p.evaluate(() => window.JG_STORY.debug.cars());
  let carNote = 'no car';
  if (cars.length) {
    const c = cars.find(x => x.id !== 'idle') || cars[0];
    await p.evaluate(([x, z, cx, cz]) => window.JG_STORY.debug.put(x, z, Math.atan2(cx - x, cz - z)), [c.stand[0], c.stand[1], c.x, c.z]);
    await until(p, id => window.JG_STORY.debug.state().near === id, 'car:' + c.id, 15000);
    await p.evaluate(id => window.JG_STORY.debug.interact(id), 'car:' + c.id);
    await until(p, () => window.JG_STORY.debug.drive().state, null, 10000); await p.waitForTimeout(500); await p.evaluate(() => window.JG_STORY.debug.skipCar());
    await until(p, () => window.JG_STORY.debug.drive().state === 'drive', null, 60000);
    await p.waitForTimeout(1500);
    const inCar = (await A()).car;
    if (!inCar || !inCar.on) errs.push(`${label}: no engine in the car (${JSON.stringify(inCar)})`);
    if (mobile) { await p.tap('[data-drv="out"]', { force: true }); await p.waitForTimeout(600); await p.evaluate(() => window.JG_STORY.debug.skipCar()); } else await p.keyboard.press('e');
    await until(p, () => !window.JG_STORY.debug.drive().state, null, 120000);
    await p.waitForTimeout(1600);
    const out = await A();
    if (out.car) errs.push(`${label}: car sounds still going after getting out`);
    carNote = `engine ${inCar ? Math.round(inCar.rpm) + ' rpm' : 'none'}, silent after getting out`;
  }
  // the office: the lot's bed stops, the office's starts
  await p.evaluate(() => { const d = window.JG_STORY.debug; d.flag('met', 1); d.warp('door'); });
  await p.waitForTimeout(500);
  await p.evaluate(() => window.JG_STORY.debug.interact('door'));
  await until(p, () => window.JG_STORY.debug.state().scene === 'office', null, 120000);
  await until(p, () => { const d = window.JG_STORY.debug, s = d.state(); if (s.line) d.skip(); else if (s.choices) d.choose(0); else if (s.phase === 'sheet') d.desk(); else if (s.phase === 'close') d.closeAll(); return s.phase === 'explore'; }, null, 300000);
  await p.waitForTimeout(2500);
  const off = await A();
  if (off.scene !== 'office') errs.push(`${label}: the sound still thinks it's on the ${off.scene}`);
  const stuck = off.amb.filter(n => lotAmb.includes(n) && /traffic|rain-hiss|lamp/.test(n));
  if (stuck.length) errs.push(`${label}: the lot's sounds kept going in the office: ${stuck.join(' ')}`);
  if (off.peakMax >= 1) errs.push(`${label}: the mix clipped (peak ${off.peakMax})`);
  if (missing.length) errs.push(`${label}: missing files: ${[...new Set(missing)].slice(0, 6).join(', ')}`);
  notes.push(`${label}: ${voiced.length} voiced lines, each once, max ${v.vmax} at a time, beds ducked to ${(+v.duck).toFixed(2)} under them; feet on ${[...surf].join(' and ')}; car: ${carNote}; lot bed [${lotAmb.join(' ')}] gave way to the office's [${off.amb.join(' ')}]; peak ${off.peakMax}; ${missing.length} missing files`);
  await ctx.close();
}
/* ---------- free roam: every set has a way out, the world's things answer, and you can sit and get up ---------- */
const EXPLORE = process.argv.includes('--explore');
async function exploreCheck(vname, w, h, mobile) {
  const label = `${vname} explore`;
  const ctx = await ctxFor(w, h, mobile);
  const p = await ctx.newPage();
  p.on('pageerror', e => { const m = `${label} pageerror: ${e.message}`; if (!errs.includes(m)) errs.push(m); });
  const toExplore = async () => until(p, () => { if (!window.JG_STORY) return false; const d = window.JG_STORY.debug, s = d.state(); if (s.line) d.skip(); else if (s.choices) d.choose(0); else if (s.phase === 'sheet') d.desk(); else if (s.phase === 'close') d.closeAll(); return s.phase === 'explore'; }, null, 300000);
  const open = async hash => {
    await p.goto('about:blank');
    await p.goto(URL0 + '?debug=story&fast=1&sq=0&pr=0.3' + (hash || ''));
    if (hash) { await p.waitForSelector('#intro [data-intro-skip]', { timeout: 60000 }).catch(() => {}); await p.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).catch(() => {}); await p.click('#intro [data-intro-skip]').catch(() => {}); }
    else { await p.waitForSelector('#intro [data-title-play]', { timeout: 30000 }); await p.waitForSelector('#boot', { state: 'detached', timeout: 15000 }).catch(() => {}); if (mobile) await p.tap('[data-title-play]'); else await p.click('[data-title-play]'); }
    await toExplore(); await turnAway(p);
  };
  const spots = () => p.evaluate(() => window.JG_STORY.debug.spots());
  const useIt = async id => {
    const ok = await p.evaluate(id => window.JG_STORY.debug.warp(id), id);
    if (!ok) { errs.push(`${label}: no ${id} here`); return false; }
    await until(p, id => window.JG_STORY.debug.state().near === id, id, 15000);
    const n0 = (await p.evaluate(() => window.JG_STORY.debug.audio().events.length));
    if (mobile) await p.tap('.st-act', { force: true }).catch(() => p.evaluate(id => window.JG_STORY.debug.interact(id), id)); else await p.keyboard.press('e');
    await p.waitForTimeout(1600);
    const ev = await p.evaluate(n0 => window.JG_STORY.debug.audio().events.slice(n0).filter(e => e.kind === 'use').map(e => e.name), n0);
    return ev;
  };
  const kinds = new Set(), exits = [];
  // the lot: a switch, a machine, a lid, a puddle, a knock, a sign
  await open('');
  const lot = await spots();
  for (const id of ['showroom-lights', 'vending', 'dumpster', 'puddle-0', 'showroom-glass', 'bus-sign'].filter(x => lot.includes(x))) { const ev = await useIt(id); (ev || []).forEach(k => kinds.add(k)); }
  // sit on the bench and get up again with a push
  if (lot.includes('bus-bench')) {
    await useIt('bus-bench');
    const sat = await until(p, () => window.JG_STORY.debug.seated && window.JG_STORY.debug.seated(), null, 30000);
    if (!sat) errs.push(`${label}: never sat on the bench`);
    else {
      if (mobile) await p.evaluate(() => window.JG_STORY.debug.sim(5, 1 / 30)); else { await p.keyboard.down('w'); await p.evaluate(() => window.JG_STORY.debug.sim(5, 1 / 30)); }
      const up = await until(p, () => !window.JG_STORY.debug.seated(), null, 30000);
      if (!mobile) await p.keyboard.up('w');
      if (!up) errs.push(`${label}: a push didn't get you up off the bench`); else kinds.add('sit');
    }
  }
  // out through the office door and back through the office's own exit
  await p.evaluate(() => window.JG_STORY.debug.flag('met', 1));
  await useIt('door');
  if (await until(p, () => window.JG_STORY.debug.state().scene === 'office', null, 120000)) exits.push('lot to office');
  await toExplore();
  const off = await spots();
  for (const id of ['desk-lamp', 'radio', 'drawer', 'fridge', 'mug'].filter(x => off.includes(x))) { const ev = await useIt(id); (ev || []).forEach(k => kinds.add(k)); }
  const radio = await p.evaluate(() => window.JG_STORY.debug.audio().amb.includes('radio'));
  if (off.includes('radio') && !radio && await p.evaluate(() => window.JG_SCORE && window.JG_SCORE.isOn())) errs.push(`${label}: the radio is on but silent`);
  if (!off.includes('office-exit')) errs.push(`${label}: the office has no way out`);
  else { await useIt('office-exit'); if (await until(p, () => window.JG_STORY.debug.state().scene === 'lot', null, 120000)) exits.push('office to lot'); else errs.push(`${label}: the office exit didn't lead to the lot`); }
  await toExplore();
  const back = await p.evaluate(() => window.JG_STORY.debug.state().me);
  // the library: its own way out
  await open('#story/memory');
  const mem = await spots();
  if (!mem.includes('memory-exit')) errs.push(`${label}: the library has no way out`);
  else { await useIt('memory-exit'); if (await until(p, () => window.JG_STORY.debug.state().scene === 'office', null, 120000)) exits.push('library to office'); else errs.push(`${label}: the library exit didn't lead out`); }
  await shot0(p, `explore-${vname}`);
  notes.push(`${label}: ways out: ${exits.join(', ')}; things used: ${[...kinds].join(' ')}; back on the lot at ${back.map(n => n.toFixed(1))}`);
  await ctx.close();
}
function cxOr(car, d) { return car ? (car[0] + car[1]) / 2 : d; }
async function shot0(p, name) { await p.screenshot({ path: path.join(OUT, `${name}.png`) }); }

const VIEWS = [['desktop', 1440, 900, false], ['landscape', 844, 390, true], ['portrait', 390, 844, true]];
let RAN_PORTRAIT = false;
const ALL_MEDALS = Object.keys(LIB.trophies).filter(s => s !== LIB.platinum);
const PATHS = [
  { tag: 'hire', dell: 'Rough night to be out.', why: "I'm hiring.", cluster: 'Operations or the back office', sign: true, sold: true, gate: 'Give him a hand.', desk: 'Let me close her deal.', phone: 'Hand Jason the phone.', looks: ['cabinet', 'board', 'laptop', 'ledger', 'arcade'], journal: true, lamp: 'One more chapter.', final: ['Title and Back Office'], ending: 'hiring', resume: 'Title_and_Back_Office', recap: ["You told Jason you're hiring.", 'You helped Dell with the gate.', "You closed Renata's deal yourself.", 'You handed Jason the phone.', 'In the memory, you kept the lamp on.'], trophies: ALL_MEDALS.concat([LIB.platinum]) },
  { tag: 'dealer', dell: 'Do you work here?', why: 'I run a dealership.', lot: 'Paperwork that comes back', gate: 'Leave him to it.', desk: 'Show me how it works.', phone: 'Let him reach for it.', looks: ['cabinet'], lamp: 'Lamp off.', final: [], ending: 'dealer', recap: ['You told Jason you run a dealership.', "Your lot's paperwork keeps coming back.", 'You left Dell to the gate.', "You watched Jason close Renata's deal.", 'In the memory, you turned the lamp off.'], trophies: ['daily-driver', 'booked', 'hand-off', 'matched', 'title-run', 'keys-to-the-lot'] },
  { tag: 'curious', dell: 'Say nothing.', why: 'Just curious.', desk: 'Show me how it works.', phone: 'Let him reach for it.', looks: ['coffee', 'window'], lamp: 'One more chapter.', final: [], ending: 'curious', recap: ['You told Jason you were just curious.', 'You walked past Dell without a word.'] },
  { tag: 'deflect', dell: 'Is he expecting me?', why: "I'd rather not say.", desk: 'Show me how it works.', phone: 'Let him reach for it.', looks: ['laptop'], lamp: 'Lamp off.', final: ['Still not saying.'], ending: 'passing', recap: ['You kept your reason to yourself.'] },
  { tag: 'late', dell: 'Rough night to be out.', why: "I'd rather not say.", desk: 'Show me how it works.', phone: 'Hand Jason the phone.', looks: ['board'], lamp: 'One more chapter.', final: ["I'm hiring.", 'Software or data', 'Data and Databases'], ending: 'hiring', resume: 'Data_and_Databases', recap: ['You kept your reason to yourself.', 'You told him why at the very end.'] }
];

for (const [vname, w, h, mobile] of VIEWS) {
  if (only && only !== vname) continue;
  if (EXPLORE) { try { await exploreCheck(vname, w, h, mobile); } catch (e) { errs.push(`${vname} explore: ${e.message.split('\n')[0]}`); } continue; }
  if (AUDIO) { try { await audioCheck(vname, w, h, mobile); } catch (e) { errs.push(`${vname} audio: ${e.message.split('\n')[0]}`); } continue; }
  if (WAY) { try { await wayCheck(vname, w, h, mobile); } catch (e) { errs.push(`${vname} way: ${e.message.split('\n')[0]}`); } continue; }
  if (RESUME) { try { await resume(vname, w, h, mobile); } catch (e) { errs.push(`${vname} resume: ${e.message.split('\n')[0]}`); } continue; }
  if (BALL) { try { await ballCheck(vname, w, h, mobile); } catch (e) { errs.push(`${vname} ball: ${e.message.split('\n')[0]}`); } continue; }
  if (DRIVE) { try { await drive(vname, w, h, mobile); } catch (e) { errs.push(`${vname} drive: ${e.message.split('\n')[0]}`); } continue; }
  if (SYNC) { try { await sync(vname, w, h, mobile); } catch (e) { errs.push(`${vname} sync: ${e.message.split('\n')[0]}`); } continue; }
  if (!NOFEEL && !ONLY_PATH) { try { await feel(vname, w, h, mobile); } catch (e) { errs.push(`${vname} feel: ${e.message.split('\n')[0]}`); } }
  if (FEEL) continue;
  if (vname === 'portrait') RAN_PORTRAIT = true;
  const paths = vname === 'desktop' ? PATHS : vname === 'landscape' ? [PATHS[0], PATHS[1], PATHS[2]] : [PATHS[3], PATHS[4]];
  for (const P0 of paths) {
    if (ONLY_PATH && P0.tag !== ONLY_PATH) continue;
    const o = { ...P0, tag: `${vname}-${P0.tag}`, shots: SHOTS && (vname !== 'portrait' || P0.tag === 'deflect') };
    const label = `${vname} ${P0.tag}`;
    const ctx = await ctxFor(w, h, mobile);
    const t0 = Date.now();
    const { p } = await start(ctx, label);
    try {
      await lot(p, mobile, o, label);
      await textRules(p, `${label} lot`);
      // persistence: reload in the office, the start screen says Continue, the flags are kept
      if (P0.tag === 'hire' || (vname === 'portrait' && P0.tag === 'deflect')) {
        await phase(p, 'talk', 30000);
        const before = (await st(p)).flags;
        await p.reload();
        await p.waitForSelector('#intro [data-title-play]', { timeout: 20000 });
        const lab = (await p.textContent('[data-title-play]')).trim();
        if (lab !== 'Continue') errs.push(`${label}: after a reload the start screen says "${lab}", not Continue`); else notes.push(`${label}: a saved episode reads Continue`);
        await p.click('[data-title-play]');
        await until(p, () => window.JG_STORY && window.JG_STORY.debug.state().scene === 'office', null, 60000);
        const after = (await st(p)).flags;
        for (const k of ['why', 'met', 'dell']) if (before[k] !== after[k]) errs.push(`${label}: ${k} not kept across the reload (${before[k]} vs ${after[k]})`);
      }
      await office(p, mobile, o, label);
      await textRules(p, `${label} office`);
      await memory(p, mobile, o, label);
      await textRules(p, `${label} memory`);
      await decision(p, mobile, o, label);
      if (!errs.some(e => e.startsWith(label + ':') || e.startsWith(label + ' '))) notes.push(`${label}: ended "${o.ending}" in ${Math.round((Date.now() - t0) / 1000)} s, clean`);
    } catch (e) { errs.push(`${label}: ${e.message.split('\n')[0]}`); await shot(p, `${o.tag}-fail`); }
    await ctx.close();
  }
}

// deep links: #story/office opens the office after the title screen
if (!only || only === 'desktop') {
  const ctx = await ctxFor(1280, 800, false);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(`deeplink pageerror: ${e.message}`));
  await p.goto(URL0 + '?debug=story&fast=1&pr=0.3#story/office');
  await p.waitForSelector('#intro [data-intro-skip]', { timeout: 60000 }); await p.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).catch(() => {}); await p.click('#intro [data-intro-skip]');
  const ok = await until(p, () => window.JG_STORY && window.JG_STORY.debug.state().scene === 'office', null, 240000);
  if (!ok) errs.push('#story/office did not open the office'); else notes.push('#story/office opens the office');
  await ctx.close();
}

if (SHOTS) {
  // contact sheets: every still from a viewport on one page
  const { createCanvas } = await import('node:module').then(() => ({})).catch(() => ({}));
  const p = await (await b.newContext({ viewport: { width: 1800, height: 1200 } })).newPage();
  for (const v of ['desktop', 'landscape', 'portrait']) {
    const files = fs.readdirSync(OUT).filter(f => f.startsWith(`story-${v}-`) && f.endsWith('.png')).sort();
    if (!files.length) continue;
    const html = '<body style="margin:0;background:#0a0f0d;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px;font:12px sans-serif;color:#9a9890">' + files.map(f => `<figure style="margin:0"><img src="data:image/png;base64,${fs.readFileSync(path.join(OUT, f)).toString('base64')}" style="width:100%;display:block"/><figcaption>${f.replace('story-', '').replace('.png', '')}</figcaption></figure>`).join('') + '</body>';
    await p.setContent(html); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(OUT, `story-sheet-${v}.png`), fullPage: true });
    notes.push(`contact sheet: tools/verify/out/story-sheet-${v}.png (${files.length} stills)`);
  }
}

if (RAN_PORTRAIT && !turnSeen) errs.push('an upright phone never saw the turn-sideways prompt');
else if (turnSeen) notes.push('an upright phone meets the turn-sideways prompt, and Keep playing upright lets it go');
await b.close();
console.log(notes.map(n => 'ok  ' + n).join('\n'));
if (fps.length) console.log('fps (headless, software GL; the debug pixel ratio is ' + (SHOTS ? '1' : '0.3') + '):\n' + fps.join('\n'));
if (errs.length) { console.log('\n' + errs.length + ' problems:\n' + errs.map(e => '  ' + e).join('\n')); process.exit(1); }
console.log('\nstory: every branch played through, no problems');
