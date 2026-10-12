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
await b.close();
console.log(fail ? `${fail} failed` : 'all contact checks pass');
process.exit(fail ? 1 : 0);
