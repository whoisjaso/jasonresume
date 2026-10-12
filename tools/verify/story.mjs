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
const URL0 = 'http://127.0.0.1:8765/';
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
  const ringing = await until(p, () => window.JG_STORY.debug.state().flags.ringing, null, 30000);
  if (!ringing) errs.push(`${label}: the phone never rang`);
  await use(p, mobile, 'phone', label);
  await choose(p, mobile, o.phone, label);
  await finishTalk(p, label);
  for (const id of o.looks || []) {
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
  if (pr.bad.length) errs.push(`${label}: camera inside geometry at ${pr.bad.length} of ${pr.n} samples, e.g. ${JSON.stringify(pr.bad.slice(0, 3))}`);
  else notes.push(`${label}: camera clear of geometry at all ${pr.n} sampled positions on the lot`);
  // skips are silent: no FX, no haptic, no interface sound when a line is cut short
  await p.evaluate(() => window.JG_STORY.debug.put(3.2, 18.2, 0));
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
  // finish Dell's talk with the first choice
  const sc = await untilChoice(p, label); if (sc && sc.choices) await choose(p, mobile, sc.choices[0], label);
  await finishTalk(p, label);
  // settings: in the pause menu, sliders that stick across a reload
  if (mobile) await p.tap('[data-st="pause"]'); else await p.keyboard.press('Escape');
  await phase(p, 'pause', 8000);
  if (mobile) await p.tap('[data-p="settings"]'); else await p.click('[data-p="settings"]');
  await p.waitForSelector('[data-mix="master"]', { timeout: 5000 });
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
  await p.waitForSelector('#intro [data-intro-skip]', { timeout: 20000 }); await p.click('#intro [data-intro-skip]');
  const ok = await until(p, () => window.JG_STORY && window.JG_STORY.debug.state().scene === 'office', null, 60000);
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
