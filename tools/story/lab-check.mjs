// The cast lab, checked: contact tests for the hands. Fails (exit 1) when a hand that should be holding something is
// more than 2 cm from it.
//   node tools/story/lab-check.mjs            (needs the site served on 8765, or LAB_PORT)
// - wheel: seated in the sedan, the wheel straight and then turned a full turn each way (hand over hand); every frame a
//   hand holds the rim (not while it is changing grip), the centre of its grip must be on the rim's centre line
// - reach: the door handle, a book on a shelf, keys on the floor and a button; at contact the gripping part of the hand
//   (the grip, the pinch, the fingertip) must be on the point
import { chromium } from 'playwright';
import fs from 'node:fs';
const exe = [process.env.PW_CHROMIUM, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => f && fs.existsSync(f));
const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const LIMIT = 0.02;
let fail = 0;
async function page(query) {
  const p = await b.newPage({ viewport: { width: 200, height: 200 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${process.env.LAB_PORT || 8765}/tools/story/lab.html?auto=0&hud=0&w=200&h=200&${query}`);
  await p.waitForFunction(() => window.LAB_READY || window.LAB_ERR, null, { timeout: 60000 });
  return { p, errs };
}
for (const [name, q] of [['wheel straight', 'wheel=0.0001'], ['wheel turning', ''], ['wheel turning, model as built', 'wheelfix=0']]) {
  const { p, errs } = await page('who=jason&run=car&car=sedan&seq=drive&' + q);
  const r = await p.evaluate(async () => {
    const P = window.LAB.P[0], V = P.pos.constructor; let n = 0, bad = 0, worst = 0, at = '', el = [999, 0];
    for (let fr = 0; fr < 360; fr++) {
      window.LAB.step(1 / 30); await null; if (fr < 20) continue;
      const c = P.car, S = c.G.steer; S.updateWorldMatrix(true, false);
      const hub = S.getWorldPosition(new V()), N = new V(); N[S.userData.rimAxis || 'z'] = 1; N.transformDirection(S.matrixWorld);
      for (const s of ['l', 'r']) {
        if (c.hands[s].sw) continue;
        const hb = P.bones['hand_' + s]; hb.updateWorldMatrix(true, false);
        const g = P.handRig[s].gripL.clone().applyMatrix4(hb.matrixWorld).sub(hub), off = g.dot(N), rad = g.addScaledVector(N, -off).length();
        const e = Math.hypot(off, rad - c.G.rimR); n++; if (e > 0.02) bad++;
        if (e > worst) { worst = e; at = s + ' at ' + (fr / 30).toFixed(2) + ' s'; }
        const A = P.arm[s], a = P.wp[A.ua].clone().sub(P.wp[A.la]).normalize(), bb = P.wp[A.ha].clone().sub(P.wp[A.la]).normalize();
        const deg = Math.acos(a.dot(bb)) * 57.3; el[0] = Math.min(el[0], deg); el[1] = Math.max(el[1], deg);
      }
    }
    return { n, bad, worst, at, el };
  });
  const ok = r.worst <= LIMIT && !errs.length;
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${r.n} holding frames, worst ${(r.worst * 100).toFixed(1)} cm (${r.at}), elbows ${r.el[0].toFixed(0)} to ${r.el[1].toFixed(0)} degrees${errs.length ? ', errors: ' + errs.join('; ') : ''}`);
  await p.close();
}
{
  const { p, errs } = await page('who=jason&run=reach');
  const r = await p.evaluate(async () => {
    const P = window.LAB.P[0], out = {};
    for (let fr = 0; fr < 600; fr++) {
      window.LAB.step(1 / 30); await null;
      for (const s of ['l', 'r']) {
        const R = P.reaches && P.reaches[s]; if (!R || R.phase !== 'on' || !R.cl) continue;
        const g = P.arm[s], at = R.cl.clone().applyQuaternion(P.wq[g.ha]).add(P.wp[g.ha]), e = at.distanceTo(R.tc);
        const k = R.hold + ' ' + R.tc.toArray().map(v => v.toFixed(2)).join(',');
        out[k] = Math.max(out[k] || 0, e);
      }
    }
    return out;
  });
  for (const [k, e] of Object.entries(r)) { const ok = e <= LIMIT; if (!ok) fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} reach ${k}: worst ${(e * 100).toFixed(1)} cm`); }
  if (!Object.keys(r).length) { fail++; console.log('FAIL reach: no contact'); }
  if (errs.length) { fail++; console.log('FAIL reach: ' + errs.join('; ')); }
  await p.close();
}
// things to do: every reach at contact (pick up, put down, knock, the switch, the button, the lid's edge), hands held by
// something (carrying, on the thighs seated), the carried thing in the hand, what's put down on its spot, the hips on
// the seat; and no pops (a hand or the head jumping further in a frame than the body moved, plus 3 m/s)
{
  const { p, errs } = await page('who=jason&run=ix&seq=all');
  const r = await p.evaluate(async () => {
    const L = window.LAB, P = L.P[0], V = P.pos.constructor, out = {}, put = (k, e) => (out[k] = Math.max(out[k] || 0, e));
    const last = {}, prev = new V(); let pop = 0, popAt = '', seen = {};
    const dt = 1 / 30;
    for (let fr = 0; fr < 2400; fr++) {
      L.step(dt); await L.tick();
      const toW = P.group.matrixWorld.clone().multiply(P.root.matrix); P.group.updateMatrixWorld(true);
      for (const s of ['l', 'r']) {
        const g = P.arm[s], R = P.reaches && P.reaches[s];
        if (R && R.phase === 'on' && R.cl) { const at = R.cl.clone().applyQuaternion(P.wq[g.ha]).add(P.wp[g.ha]); put('reach ' + R.hold, at.distanceTo(R.tc)); seen['reach ' + R.hold] = 1; }
        const pin = P.pins && P.pins[s];
        // (a hold is measured once it has settled: not within 0.2 s of a reach on that hand)
        if (R) seen['busy ' + s] = fr;
        if (pin && pin.k > 0.95 && pin.cl && !(R && R.k > 0.05) && fr - (seen['busy ' + s] ?? -99) > 6) { const at = pin.cl.clone().applyQuaternion(P.wq[g.ha]).add(P.wp[g.ha]); put('held ' + pin.pose, at.distanceTo(pin.at)); seen['held ' + pin.pose] = 1; }
        const c = P.carrying && P.carrying[s];
        if (c) { c.obj.updateMatrixWorld(true); const op = c.obj.getWorldPosition(new V()), hp = P.bones['hand_' + s].getWorldPosition(new V()); const k = 'obj ' + s; if (seen[k] && seen[k].obj === c.obj) put('picked-up thing never jumps', Math.max(0, op.distanceTo(seen[k].op) - hp.distanceTo(seen[k].hp) - 0.002)); seen[k] = { obj: c.obj, op, hp }; }
        else seen['obj ' + s] = null;
        if (c) { const hand = c.cl.clone().applyQuaternion(P.wq[g.ha]).add(P.wp[g.ha]).applyMatrix4(P.group.matrixWorld.clone().multiply(P.root.matrix)); c.obj.updateMatrixWorld(true); put('carried in the hand', c.obj.localToWorld(c.gl.clone()).distanceTo(hand)); }
      }
      if (P.car && P.car.mode === 'seat') { const h = P.toWorld(P.hipC, new V()); P.car.G.body.updateMatrixWorld(true); const sw = P.car.G.S.clone().applyMatrix4(P.car.G.body.matrixWorld); put('hips on the seat', h.distanceTo(sw)); }
      const mv = fr ? P.pos.distanceTo(prev) : 0;
      for (const b of ['hand_l', 'hand_r', 'head', 'foot_l', 'foot_r']) { const w = P.bones[b].getWorldPosition(new V()); if (last[b]) { const j = w.distanceTo(last[b]) - mv - (b.startsWith('foot') ? 5 : 3) * dt; if (j > pop) { pop = j; popAt = b + ' at ' + (fr * dt).toFixed(2) + ' s'; } } last[b] = w; }
      prev.copy(P.pos);
      if (L.IX && L.IX.done) break;
    }
    // what was put down stands where it was put: the middle of its base on the point
    for (const x of (L.IX.placed || [])) {
      x.obj.updateMatrixWorld(true);
      let lo = Infinity; const c = new V(), v = new V(); let n = 0;
      x.obj.traverse(o => { if (!o.isMesh) return; const a = o.geometry.attributes.position; for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld); lo = Math.min(lo, v.y); c.add(v); n++; } });
      c.divideScalar(n); c.y = lo; put('put down on its spot', c.distanceTo(x.at));
    }
    return { out, pop, popAt, done: !!(window.LAB.IX && window.LAB.IX.done) };
  });
  for (const [k, e] of Object.entries(r.out)) { const lim = k === 'hips on the seat' ? 0.03 : LIMIT; const ok = e <= lim; if (!ok) fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${k}: worst ${(e * 100).toFixed(1)} cm`); }
  const popOk = r.pop <= 0.02; if (!popOk) fail++;
  console.log(`${popOk ? 'ok  ' : 'FAIL'} no pops through the things to do: worst ${(Math.max(0, r.pop) * 100).toFixed(1)} cm over${r.popAt ? ' (' + r.popAt + ')' : ''}`);
  if (!r.done) { fail++; console.log('FAIL the things to do never finished'); }
  if (errs.length) { fail++; console.log('FAIL things to do: ' + errs.join('; ')); }
  await p.close();
}
// the feet at a phone's frame rates: a planted foot never slides (more than 2 cm in a frame, not counting a step) and
// nothing pops, walking, running and turning on the spot at 30, 15 and 10 frames a second
for (const run of ['walk', 'jog', 'turn']) {
  const { p, errs } = await page('who=jason&run=' + run);
  const r = await p.evaluate(async () => {
    const P = window.LAB.P[0], V = P.pos.constructor, res = [];
    for (const fps of [30, 15, 10]) {
      const dt = 1 / fps; let slides = 0, frames = 0, pop = 0; const last = {}, prev = new V();
      for (let f = 0; f < fps * 12; f++) {
        window.LAB.step(dt); P.group.updateMatrixWorld(true);
        for (const s of ['l', 'r']) {
          const F = P.feet[s], a = P.bones['foot_' + s].getWorldPosition(new V()), locked = F.lock && F.w > 0.95 && !(F.step > 0);
          if (locked && last[s] && last[s].lock) { frames++; if (Math.hypot(a.x - last[s].a.x, a.z - last[s].a.z) > 0.02) slides++; }
          last[s] = { lock: locked, a };
        }
        const mv = f ? P.pos.distanceTo(prev) : 0;
        for (const b of ['hand_l', 'hand_r', 'head', 'foot_l', 'foot_r']) { const w = P.bones[b].getWorldPosition(new V()); if (last[b]) { const j = w.distanceTo(last[b]) - mv - (b.startsWith('foot') ? 5 : 3) * dt; pop = Math.max(pop, j); } last[b] = w; }
        prev.copy(P.pos);
      }
      res.push({ fps, slides, frames, pop });
    }
    return res;
  });
  for (const x of r) { const ok = x.slides <= Math.max(1, x.frames * 0.01) && x.pop <= 0.02; if (!ok) fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${run} at ${x.fps} fps: ${x.slides} of ${x.frames} planted frames slide, worst pop ${(Math.max(0, x.pop) * 100).toFixed(1)} cm`); }
  if (errs.length) { fail++; console.log('FAIL ' + run + ': ' + errs.join('; ')); }
  await p.close();
}
// cheap: one person's update, after the engine has warmed up, well under 0.1 ms
for (const q of ['who=jason&run=idle', 'who=jason&run=walk', 'who=jason&run=talk', 'who=dell&run=walk', 'who=jason&run=car&car=sedan&seq=drive']) {
  const { p } = await page(q);
  const us = await p.evaluate(() => { const P = window.LAB.P[0]; for (let i = 0; i < 1500; i++) window.LAB.step(1 / 30); let t = 0; for (let i = 0; i < 1500; i++) { const a = performance.now(); P.update(1 / 30); t += performance.now() - a; } return t / 1500 * 1000; });
  const ok = us < 100; if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} update ${q.replace(/^who=|&/g, ' ').trim()}: ${us.toFixed(0)} us`);
  await p.close();
}
await b.close();
console.log(fail ? `${fail} failed` : 'all contact checks pass');
process.exit(fail ? 1 : 0);
