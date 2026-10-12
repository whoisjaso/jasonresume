// After Hours: a headless drive. Builds the lot in a blank page, takes a drivable car (story/vehicle.js) and
// drives it with scripted inputs at a fixed 60 Hz: launch and the gears, a turn, the brakes, reverse, a
// handbrake slide, a lamp pole, a parked car, a wheel stop, out through the gate onto Almeda Genoa Road and
// into the soft wall at the road's end. Prints speed, rpm and gear, and fails on anything that's off.
//   python3 -m http.server 8765 &   then   node tools/story/world/drive-test.mjs [car|idle|truck]
import { chromium } from 'playwright';
const which = process.argv[2] || 'car';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 400, height: 300 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:8765/tools/story/world/blank.html');
const out = await p.evaluate(async (which) => {
  const W = await import('/story/world.js'); const V = await import('/story/vehicle.js');
  await W.lotReady;
  const cv = document.createElement('canvas'); cv.width = cv.height = 8;
  const set = W.buildLot({ wordmark: cv }); await set.userData.ready;
  const d = set.userData.drivable.find(c => c.id === which) || set.userData.drivable[0];
  const car = V.createVehicle(set, d);
  car.engine.start();
  const log = [], fails = [], dt = 1 / 60;
  const fmt = () => `v ${car.speed.toFixed(2).padStart(6)} m/s  ${car.kmh.toFixed(0).padStart(3)} km/h  rpm ${String(car.rpm).padStart(4)}  gear ${String(car.gear).padStart(2)}  x ${car.pose.x.toFixed(1)} z ${car.pose.z.toFixed(1)} yaw ${car.pose.yaw.toFixed(2)} slip ${car.slip.toFixed(2)}`;
  const run = (secs, inp, every = 0.5, tag = '') => { const evs = []; let t = 0, next = 0; while (t < secs - 1e-6) { car.update(dt, typeof inp === 'function' ? inp(t) : inp); evs.push(...car.events.map(e => ({ ...e, at: +t.toFixed(2) }))); t += dt; if (every && t >= next) { log.push(`${tag} t ${t.toFixed(1)}  ${fmt()}`); next += every; } } return evs; };
  const check = (ok, what) => { log.push((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails.push(what); };
  const R = (x, z, yaw) => { car.reset(x, z, yaw); car.engine.start(); run(0.3, {}, 0); };
  log.push(`car: ${d.id} (${d.kind}) ${JSON.stringify(car.spec)}`);

  // 1. launch on the road, through the gears, then brake to a stop
  R(-50, 30, Math.PI / 2);
  let ev = run(6, { throttle: 1 }, 0.5, 'launch');
  const vTop = car.speed, gTop = car.gear;
  check(vTop > 20 && vTop < 45, `launch: ${vTop.toFixed(1)} m/s after 6 s (20 to 45)`);
  check(gTop >= 2, `launch: gear ${gTop} after 6 s (2 or more)`);
  check(ev.some(e => e.type === 'shift' && e.gear >= 2), 'launch: the box shifted up');
  const x0 = car.pose.x, v0 = car.speed; let tb = 0; while (car.speed > 0.2 && tb < 8) { car.update(dt, { brake: 1 }); tb += dt; }
  check(car.speed <= 0.2 && tb < 4, `brake: ${v0.toFixed(1)} m/s to a stop in ${tb.toFixed(2)} s and ${(car.pose.x - x0).toFixed(1)} m`);

  // 2. a right turn at 12 m/s: yaw goes down (right), speed holds near
  R(-50, 27, Math.PI / 2); run(3, t => ({ throttle: car.speed < 12 ? 1 : 0.2 }), 0);
  const y0 = car.pose.yaw; ev = run(1.0, { throttle: 0.35, steer: 1 }, 0.5, 'turn R');
  check(car.pose.yaw < y0 - 0.4, `turn right: yaw ${y0.toFixed(2)} -> ${car.pose.yaw.toFixed(2)}`);
  const y1 = car.pose.yaw; run(1.5, { throttle: 0.35, steer: -1 }, 0.5, 'turn L');
  check(car.pose.yaw > y1 + 0.5, `turn left: yaw ${y1.toFixed(2)} -> ${car.pose.yaw.toFixed(2)}`);

  // 3. reverse: hold the brake from a stop
  R(0, 30, Math.PI / 2); ev = run(2.5, { brake: 1 }, 0.5, 'reverse');
  check(car.gear === -1 && car.speed < -1, `reverse: gear ${car.gear}, ${car.speed.toFixed(2)} m/s`);
  run(2, { throttle: 1 }, 0.5, 'reverse->1'); check(car.gear >= 1 && car.speed > 0, `out of reverse: gear ${car.gear}, ${car.speed.toFixed(2)} m/s`);

  // 4. a handbrake turn at speed: the rear comes round
  R(-50, 30, Math.PI / 2); run(3.2, { throttle: 1 }, 0);
  let maxSlip = 0, drift = false; ev = run(1.2, t => ({ throttle: 0.6, steer: -1, handbrake: t < 0.6 ? 1 : 0 }), 0.3, 'handbrake');
  for (let i = 0; i < 1; i++) { maxSlip = Math.max(maxSlip, car.slip); }
  { // re-run sampling the slip every step
    R(-50, 30, Math.PI / 2); run(3.2, { throttle: 1 }, 0);
    for (let t = 0; t < 1.2; t += dt) { car.update(dt, { throttle: 0.6, steer: -1, handbrake: t < 0.6 ? 1 : 0 }); maxSlip = Math.max(maxSlip, car.slip); drift = drift || car.drifting; }
  }
  check(maxSlip > 0.5 && drift, `handbrake slide: slip peaked ${maxSlip.toFixed(2)}, drifting ${drift}`);

  // 5. a lamp pole in the lane (-9, -1.2): drive at it from the west and stop dead against it
  R(-22, -1.0, Math.PI / 2); ev = run(4, { throttle: 0.8 }, 0.5, 'pole');
  const hitPole = ev.find(e => e.type === 'impact' && e.what === 'pole');
  check(!!hitPole, `pole: ${hitPole ? 'hit at ' + hitPole.strength + ' m/s' : 'no impact'}`);
  run(1.5, {}, 0.5, 'after');
  check(car.pose.x < -9 - 0.34 + 0.05 - 2.0 && Math.abs(car.speed) < 3, `pole: stopped short of it, x ${car.pose.x.toFixed(2)}, ${car.speed.toFixed(2)} m/s`);

  // 6. a parked car: nose into the row at z -5.6 from the lane, it rocks and doesn't move far
  const target = set.userData.parked.filter(c => Math.abs(c.z + 5.6) < 1).sort((a, b) => Math.abs(a.x) - Math.abs(b.x))[0];
  const tx = target.x, tz = target.z;
  R(target.x, 0.5, Math.PI); ev = run(3, { throttle: 0.5 }, 0.5, 'car');
  const hitCar = ev.find(e => e.type === 'impact' && e.what === 'car');
  check(!!hitCar, `parked car: ${hitCar ? 'hit at ' + hitCar.strength + ' m/s' : 'no impact'}`);
  check(Math.hypot(target.x - tx, target.z - tz) < 0.3, `parked car moved ${Math.hypot(target.x - tx, target.z - tz).toFixed(3)} m (under 0.3)`);
  check(!!(target._rock && (target._rock.live || target._rock.t > 0)), 'parked car rocked');

  // 7. a wheel stop at the head of a stall: a bump, not a wall
  R(1.6, 2.5, 0); ev = run(3.0, t => ({ throttle: Math.abs(car.speed) < 2.5 ? 0.5 : 0 }), 0.5, 'stop');
  check(ev.some(e => e.type === 'bump'), `wheel stop: ${ev.filter(e => e.type === 'bump').length} bumps`);

  // 8. out through the gate onto the road (the gate rolled open), then east into the road's end
  set.userData.gate.position.x = -3.2;
  R(1.6, 2, 0); ev = run(6, t => ({ throttle: car.speed < 6 ? 0.7 : 0, steer: Math.max(-1, Math.min(1, car.pose.x * 0.35 + car.pose.yaw * 2.5)) }), 0.5, 'gate');
  check(car.onRoad, `through the gate: z ${car.pose.z.toFixed(1)} (on the road past 22.4)`);
  check(!ev.some(e => e.type === 'impact'), `through the gate clean: ${ev.filter(e => e.type === 'impact').map(e => e.what).join(',') || 'no impacts'}`);
  R(40, 31, Math.PI / 2); ev = run(6, { throttle: 1 }, 1, 'road end');
  check(ev.some(e => e.what === 'bound') && car.pose.x < 62, `road end: soft wall, x ${car.pose.x.toFixed(1)}`);
  check(set.userData.inDriveBounds(car.pose.x, car.pose.z) || car.pose.x < 61.6, 'stays in the drivable area');

  // 9. bounds sweep: random inputs for 60 s never leave the area or go NaN
  R(0, -1, Math.PI / 2); let bad = 0; let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  let inp = {};
  for (let t = 0; t < 60; t += dt) {
    if (Math.floor(t * 2) !== Math.floor((t - dt) * 2)) inp = { throttle: rnd() < 0.7 ? rnd() : 0, brake: rnd() < 0.2 ? rnd() : 0, steer: rnd() * 2 - 1, handbrake: rnd() < 0.1 ? 1 : 0 };
    car.update(dt, inp);
    const q = car.pose; if (!isFinite(q.x) || !isFinite(q.z) || !isFinite(q.yaw)) { bad++; break; }
    if (!set.userData.inDriveBounds(q.x, q.z)) { const out = set.userData.driveBounds.rects.reduce((m, r) => Math.min(m, Math.hypot(q.x - Math.min(Math.max(q.x, r.x0), r.x1), q.z - Math.min(Math.max(q.z, r.z0), r.z1))), 1e9); if (out > 1.6) bad++; }
  }
  check(bad === 0, `random minute: ${bad ? 'left the area or broke' : 'stayed in, no NaN'} (ended at ${car.pose.x.toFixed(1)}, ${car.pose.z.toFixed(1)})`);

  // the parts move: wheels spin, fronts steer, the steering wheel turns, a door opens
  car.reset(0, 30, Math.PI / 2); car.update(0.5, { throttle: 1, steer: 1 });
  const w = car.wheels; const g = car.grips();
  check(w[0].rotation.y < -0.05 && Math.abs(w[2].rotation.y) < 1e-6, `front wheels steer (${w[0].rotation.y.toFixed(2)} rad), rears don't`);
  car.doors.open('driver', 1); check(car.doors.node('driver').rotation.y < -1, `driver's door opens (${car.doors.node('driver').rotation.y.toFixed(2)} rad)`);
  check(!!g && g.left.distanceTo(g.right) > 0.25, `grips at 10 and 2: ${g ? g.left.distanceTo(g.right).toFixed(3) : '-'} m apart`);
  car.lights.set({ head: true }); check(set.userData.lamps.some(l => l.car && Math.hypot(l.p.x - car.pose.x, l.p.z - car.pose.z) < 4), 'headlights move a lamp with the car');
  return { log, fails };
}, which);
for (const l of out.log) console.log(l);
if (errs.length) console.log('PAGE ERRORS\n' + errs.join('\n'));
console.log(out.fails.length || errs.length ? `\n${out.fails.length} checks failed` : '\nall checks passed');
await b.close();
process.exitCode = out.fails.length || errs.length ? 1 : 0;
