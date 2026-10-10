// After Hours: The Run, played by a bot through real input, level by level.
//   python3 -m http.server 8765 &   then
//   node tools/verify/run-bot.mjs [desktop|mobile] [level ...] [--quick] [--walk]
//
// Each level opens at ?debug=run&run=<level> (the page's read-only hook, off
// without the flag) on a paused clock that the bot moves one 16 ms frame at a
// time, so every run is exact and repeatable. A planner (tools/verify/run-sim.mjs,
// a frame-exact copy of the game's physics) searches jumps and runs over the
// level's own geometry to each medal in turn and then the goal; the bot plays
// the plan with real keys on desktop (1440 by 900: arrows, Shift to run,
// Space to jump) and real touches on a phone held sideways (844 by 390: a
// thumb on the stick, a tap on the right for each jump), checking the game
// against the copy after every move and planning again from where the game
// really is if they ever part.
//
// Desktop must finish every level with every medal; the phone must finish
// every level. Per level it prints: finished, medals found, the level time,
// respawns, how forgiving each jump was (the share of 21 nearby timings that
// still land: three frames early to three late, held three frames shorter to
// three longer), and any jump whose landing was off screen at take-off.
// --walk plans the way to the goal without Shift (a first-timer who walks).
// --quick plays every level to the goal by touch on a phone and the first by
// keys on desktop, no medals (what library.mjs runs).
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { makeWorld, initState, plan, frame, clone, tolerance, FRAME } from './run-sim.mjs';

const TOOLS = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(TOOLS, 'verify', 'out');
fs.mkdirSync(OUT, { recursive: true });
const URL0 = process.env.URL0 || 'http://127.0.0.1:8765/';
const args = process.argv.slice(2);
const quick = args.includes('--quick'), walk = args.includes('--walk');
const which = args.find(a => a === 'desktop' || a === 'mobile');
const RUN = JSON.parse(fs.readFileSync(path.join(TOOLS, 'site', 'run.json'), 'utf8'));
const pick = args.filter(a => RUN.levels.some(l => l.id === a));
const LEVELS = pick.length ? pick : RUN.levels.map(l => l.id);
const exe = [process.env.PW_CHROMIUM, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => f && fs.existsSync(f));
const fonts = path.join(TOOLS, 'fonts', 'fonts.css');

export async function playLevel(b, level, { mobile = false, medals = true, walkOnly = false, log = () => {} } = {}) {
  const [w, h] = mobile ? [844, 390] : [1440, 900];
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
  if (fs.existsSync(fonts)) {
    await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(fonts, 'utf8') }));
    await ctx.route('**/pwfonts/*', r => r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(path.join(TOOLS, 'fonts', r.request().url().split('/').pop())) }));
  }
  await ctx.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"on":false}' }));
  await ctx.route(/calendly\.com/, r => r.abort());
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.clock.install({ time: new Date('2026-10-10T22:00:00Z') });
  await p.clock.pauseAt(new Date('2026-10-10T22:00:01Z'));
  await p.goto(URL0 + '?debug=run&run=' + level);
  let ready = false;
  for (let i = 0; i < 400 && !ready; i++) { await p.clock.runFor(48); ready = await p.evaluate(() => { const d = window.JG_RUN_DEBUG, s = d && d.state(); return !!(s && s.running && !s.panel); }); }
  const res = { level, mobile, finished: false, medals: [], of: 0, ms: 0, respawns: 0, tol: [], blind: [], replans: 0, missed: [], errors, planned: [] };
  if (!ready) { res.errors.push('the run never opened'); await ctx.close(); return res; }
  const D = await p.evaluate(() => ({ P: JG_RUN_DEBUG.P, STEP: JG_RUN_DEBUG.STEP, TS: JG_RUN_DEBUG.TS, still: JG_RUN_DEBUG.still, L: JG_RUN_DEBUG.level() }));
  const W = makeWorld(D.L, D.P, D.STEP, D.TS, D.still, mobile);
  fs.writeFileSync(path.join(OUT, `run-level-${level}.json`), JSON.stringify(D));
  res.of = D.L.medals.length;
  const state = () => p.evaluate(() => JG_RUN_DEBUG.state());
  const cam = () => p.evaluate(() => { const s = window.JG_RUN.debug.state(); return { x: s.cam.x, y: s.cam.y, w: innerWidth / s.scale, h: innerHeight / s.scale }; });

  // ---- real input ----
  let cur = { x: 0, run: false, jump: false };
  const cdp = mobile ? await ctx.newCDPSession(p) : null;
  // a thumb lands low on the left to move and lifts when it stops; jumps alternate between
  // the drawn button and anywhere low on the right half, as the first hint invites
  const stick = { x: 150, y: h - 64 }, jumpAts = [{ x: w - 28 - 42, y: h - 28 - 42 }, { x: Math.round(w * 0.6), y: h - 52 }];
  let pts = [], jumps = 0;
  const touch = async (type, list) => { pts = list; await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: list.map(q => ({ x: q.x, y: q.y, id: q.id })) }); };
  async function setInput(inp) {
    if (!mobile) {
      const K = p.keyboard;
      if (cur.x !== inp.x) { if (cur.x === 1) await K.up('ArrowRight'); if (cur.x === -1) await K.up('ArrowLeft'); if (inp.x === 1) await K.down('ArrowRight'); if (inp.x === -1) await K.down('ArrowLeft'); }
      if (cur.run !== inp.run) await (inp.run ? K.down('Shift') : K.up('Shift'));
      if (cur.jump !== inp.jump) await (inp.jump ? K.down(' ') : K.up(' '));
    } else {
      const others = id => pts.filter(q => q.id !== id);
      if (cur.x !== inp.x) {
        if (inp.x === 0) { const s1 = pts.find(q => q.id === 1); pts = others(1); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: s1.x, y: s1.y, id: 1 }] }); }
        else {
          if (!pts.some(q => q.id === 1)) await touch('touchStart', [...others(1), { ...stick, id: 1 }]);
          await touch('touchMove', [...others(1), { x: stick.x + 52 * inp.x, y: stick.y, id: 1 }]);
        }
      }
      if (cur.jump !== inp.jump) {
        if (inp.jump) await touch('touchStart', [...others(2), { ...jumpAts[jumps++ % 2], id: 2 }]);
        else { const s2 = pts.find(q => q.id === 2); pts = others(2); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: s2.x, y: s2.y, id: 2 }] }); }
      }
    }
    cur = { ...inp };
  }
  async function playInputs(inputs) {
    let i = 0;
    while (i < inputs.length) {
      let j = i + 1;
      const same = (a, b2) => a.x === b2.x && a.run === b2.run && a.jump === b2.jump;
      while (j < inputs.length && same(inputs[j], inputs[i])) j++;
      await setInput(inputs[i]);
      await p.clock.runFor(16 * (j - i));
      i = j;
    }
  }
  const touchRun = mobile;
  // ---- the route: each medal in turn (nearest first along the level), then the goal ----
  const targets = [];
  if (medals) D.L.medals.map((m, i) => ({ kind: 'medal', i, x: m.x, y: m.y, slug: m.slug, where: m.where })).sort((a, b2) => a.x - b2.x).forEach(t => targets.push(t));
  targets.push({ kind: 'goal', x: D.L.goal.x + D.L.goal.w / 2, y: D.L.goal.y - 40 });
  for (const tg of targets) {
    let tries = 0, done = false;
    while (!done && tries < 4) {
      tries++;
      const s = await state();
      if (s.finished) { done = true; break; }
      if (tg.kind === 'medal' && s.medals[tg.i].got) { done = true; break; }
      const S0 = initState(W, s);
      const t0 = Date.now();
      const r = plan(W, S0, tg, { touch: touchRun, walkOnly, robust: true });
      res.planned.push({ target: tg.slug || 'goal', ms: Date.now() - t0, expanded: r.expanded, ok: !r.fail });
      if (r.fail) { log(`  ${level}: no plan to ${tg.slug || 'the goal'} (closest ${JSON.stringify(r.closest)})`); break; }
      res.tol.push(...tolerance(W, S0, r.macros, tg.kind === 'medal' ? (S => S.got[tg.i]) : (S => S.finished)).map(t => ({ ...t, to: tg.slug || 'goal' })));
      let diverged = false;
      for (const seg of r.macros) {
        if (seg.mac.kind === 'jump') {
          const c = await cam();
          const lx = seg.S.x + 9, ly = seg.S.y + 44;
          // where the jump lands has to be on screen when you take off: ahead, or above you;
          // dropping down to the floor below is fine
          const floor = !!(seg.S.on && seg.S.on.k === 'solid');
          if (lx < c.x || lx > c.x + c.w || ly < c.y || (ly > c.y + c.h && !floor)) res.blind.push({ at: Math.round(lx / D.TS * 10) / 10, to: tg.slug || 'goal', view: [Math.round(c.x / D.TS), Math.round((c.x + c.w) / D.TS), Math.round(c.y / D.TS), Math.round((c.y + c.h) / D.TS)] });
        }
        await playInputs(seg.inputs);
        const a = (await state()).pl, e = seg.S;
        // (once the door is reached the game lets you settle; the copy stops there)
        if (!e.finished && (Math.abs(a.x - e.x) > 0.5 || Math.abs(a.y - e.y) > 0.5)) { diverged = true; res.replans++; log(`  ${level}: the game and the copy parted at x ${a.x.toFixed(1)} (copy ${e.x.toFixed(1)}), y ${a.y.toFixed(1)} (copy ${e.y.toFixed(1)}); planning again`); break; }
      }
      if (!diverged) done = true;
    }
    if (!done && tg.kind === 'medal') res.missed.push(tg.slug);
  }
  // let the finish land, release everything
  await setInput({ x: 0, run: false, jump: false });
  await p.clock.runFor(16 * 30);
  const s = await state();
  res.finished = s.finished; res.ms = Math.round(s.levelT); res.respawns = s.deaths;
  res.medals = s.medals.filter(m => m.got).map(m => m.slug);
  await p.clock.runFor(1600);
  await p.screenshot({ path: path.join(OUT, `bot-${mobile ? 'phone' : 'desktop'}-${level}.png`) });
  await ctx.close();
  return res;
}

export function summary(r) {
  const tol = r.tol.length ? Math.min(...r.tol.map(t => t.ok / t.of)) : 1;
  const tight = r.tol.filter(t => t.ok / t.of < 0.34).map(t => `${t.at}${t.to !== 'goal' ? ' (' + t.to + ')' : ''} ${t.ok}/${t.of}`);
  return `${r.mobile ? 'phone  ' : 'desktop'} ${r.level.padEnd(14)} ${r.finished ? 'finished' : 'NOT FINISHED'}  medals ${r.medals.length}/${r.of}  ${(r.ms / 1000).toFixed(1)} s  respawns ${r.respawns}  jumps ${r.tol.length}, least forgiving ${Math.round(tol * 21)}/21` +
    (tight.length ? `\n    tight: ${tight.join('; ')}` : '') +
    (r.blind.length ? `\n    landing off screen at take-off: ${r.blind.map(x => x.at + (x.to !== 'goal' ? ' (' + x.to + ')' : '') + ' [view x ' + x.view[0] + '-' + x.view[1] + ', y ' + x.view[2] + '-' + x.view[3] + ']').join('; ')}` : '') +
    (r.missed.length ? `\n    missed: ${r.missed.join(', ')}` : '') +
    (r.replans ? `\n    replans: ${r.replans}` : '') +
    (r.errors.length ? `\n    page errors: ${r.errors.join(' | ')}` : '');
}

// the quick version (library.mjs runs it): every level to the goal by touch on a phone,
// and the first level by keys on desktop
export async function quickRun(b, log = () => {}) {
  const errs = [], lines = [];
  const jobs = RUN.levels.map(l => [true, l.id]).concat([[false, RUN.levels[0].id]]);
  for (const [mobile, level] of jobs) {
    const r = await playLevel(b, level, { mobile, medals: false, log });
    const line = summary(r); lines.push(line);
    if (!r.finished) errs.push(`run bot: ${mobile ? 'phone' : 'desktop'} ${level} not finished`);
    if (r.errors.length) errs.push(`run bot: ${level} page errors ${r.errors.join(' | ')}`);
  }
  return { errs, lines };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const b = await chromium.launch({ executablePath: exe });
  const errs = [], lines = [];
  if (quick) {
    const q = await quickRun(b, s => console.log(s));
    q.lines.forEach(l => console.log(l)); errs.push(...q.errs); lines.push(...q.lines);
  } else {
    const modes = which === 'desktop' ? [false] : which === 'mobile' ? [true] : [false, true];
    for (const mobile of modes) for (const level of LEVELS) {
      const t0 = Date.now();
      const r = await playLevel(b, level, { mobile, medals: !walk, walkOnly: walk, log: s => console.log(s) });
      const line = summary(r) + `  [${((Date.now() - t0) / 1000).toFixed(0)} s]`;
      console.log(line); lines.push(line);
      if (!r.finished) errs.push(`${mobile ? 'phone' : 'desktop'} ${level}: not finished`);
      if (!mobile && !walk && r.medals.length < r.of) errs.push(`desktop ${level}: ${r.medals.length} of ${r.of} medals`);
      if (r.errors.length) errs.push(`${level}: page errors`);
    }
  }
  await b.close();
  fs.writeFileSync(path.join(OUT, quick ? 'run-bot-quick.txt' : 'run-bot.txt'), lines.join('\n') + '\n');
  console.log(errs.length ? 'ISSUES:\n' + errs.join('\n') : 'every level finished' + (quick || walk ? '' : ', every medal collected on desktop'));
  process.exit(errs.length ? 1 : 0);
}
