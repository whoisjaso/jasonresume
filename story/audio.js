/* After Hours: the sound. Everything you hear in the episode except the score
   and the voices' recordings: the rain, the lamps, the street, the rooms, your
   feet, the things you touch, and the soft sounds of the interface. It sits
   under the site's score (score.js) and follows its toggle (M, or Sound in the
   pause menu): with the score off, the episode is silent.

   One AudioContext, built only when someone presses Play or Continue (a user
   gesture), never before. The graph:

     voice ─┐
     sfx ───┤ (sends to the room's reverb)
     amb ───┼─> master ─> glue compressor ─> limiter ─> out
     ui ────┘
     "outside" sources (rain, traffic, cars, the roof) pass a lowpass first,
     wide open on the lot and closed down to a murmur behind the office glass.

   Music lives in score.js; its level follows Master times Music through
   JG_SCORE.mix. Under dialogue the ambience and effects step back (and the
   score steps back itself, through JG_SCORE.voice). Footsteps, the lamps, the
   phone, the typing, the gate and the passing car are placed in space with
   PannerNodes, heard from the camera.

   Sources: the one-shots in assets/story/sfx/sfx.mp3 are Kenney's CC0 packs
   (tools/story/sfx/build.py lists them); everything else is synthesized here.

   createAudio({ soundOn, store }) -> the api below. */

const MIX_KEY = "jg_story_mix";
export const MIX0 = { master: 1, music: 0.8, voice: 1, sfx: 0.85 };
/* the levels, as linear gains, before the sliders; tuned so a voice sits about
   9 dB over the rain and footsteps sit between them */
/* every rain sound at one level (the open lot, the canopy, the cars' roofs, the glass, the car's roof from inside):
   present under everything, never over the voices */
export const RAIN = 0.32;
export const LEVELS = { voice: 1.0, sfx: 0.62, amb: 0.42, ui: 0.5, verb: 0.22 };

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];

export function createAudio(o) {
  const soundOn = o.soundOn, store = o.store;
  const mix = Object.assign({}, MIX0, (() => { try { return JSON.parse(store.get(MIX_KEY) || "null") || {}; } catch (e) { return {}; } })());
  const A = {
    ctx: null, built: false, mix, events: [], scene: null, sprites: null, buf: null, amb: [], timers: [], nodes: {},
    duckV: 1, veiled: false, peak: 0, mobile: !!o.mobile, lamps: [], car: null, nextCar: 0, nextBird: 0, nextHush: 0, nextType: 0, typing: 0, tickT: 0, clockOn: false,
    walk: {}
  };
  const log = (kind, name) => { A.events.push({ t: performance.now(), kind, name }); if (A.events.length > 200) A.events.shift(); };

  /* ---------- build: only from a gesture ---------- */
  function build() {
    if (A.ctx) return A.ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    let C; try { C = new AC({ latencyHint: "interactive" }); } catch (e) { try { C = new AC(); } catch (x) { return null; } }
    A.ctx = C;
    const N = A.nodes;
    N.master = C.createGain(); N.master.gain.value = 0;
    N.glue = C.createDynamicsCompressor(); N.glue.threshold.value = -20; N.glue.knee.value = 10; N.glue.ratio.value = 2.5; N.glue.attack.value = 0.012; N.glue.release.value = 0.25;
    N.limit = C.createDynamicsCompressor(); N.limit.threshold.value = -2; N.limit.knee.value = 0; N.limit.ratio.value = 20; N.limit.attack.value = 0.002; N.limit.release.value = 0.09;
    N.meter = C.createAnalyser(); N.meter.fftSize = 1024;
    N.master.connect(N.glue); N.glue.connect(N.limit); N.limit.connect(N.meter); N.limit.connect(C.destination);
    // the veil: the world steps back behind the journal and the pause menu
    N.veil = C.createBiquadFilter(); N.veil.type = "lowpass"; N.veil.frequency.value = 20000; N.veil.Q.value = 0.4;
    N.veilG = C.createGain(); N.veil.connect(N.veilG); N.veilG.connect(N.master);
    for (const k of ["voice", "sfx", "amb", "ui"]) { N[k] = C.createGain(); N[k + "Duck"] = C.createGain(); N[k].connect(N[k + "Duck"]); }
    N.voiceDuck.connect(N.master); N.uiDuck.connect(N.master);
    N.sfxDuck.connect(N.veil); N.ambDuck.connect(N.veil);
    // outside: rain, traffic and cars, heard through the glass when you're in
    N.out = C.createGain(); N.outLp = C.createBiquadFilter(); N.outLp.type = "lowpass"; N.outLp.frequency.value = 16000; N.outLp.Q.value = 0.5;
    N.out.connect(N.outLp); N.outLp.connect(N.amb);
    // the room: a convolution reverb whose impulse changes with the scene
    N.verb = C.createConvolver(); N.verbG = C.createGain(); N.verbG.gain.value = LEVELS.verb; N.verb.connect(N.verbG); N.verbG.connect(N.veil);
    noise();
    applyMix(true);
    A.built = true; log("build", C.state);
    // the one-shots, loaded once (about 270 KB)
    fetch(o.base + "sfx.json").then(r => (r.ok ? r.json() : null)).then(j => {
      if (!j) return; A.sprites = j.sprites;
      return fetch(o.base + j.src).then(r => r.arrayBuffer()).then(ab => new Promise((res, rej) => C.decodeAudioData(ab, res, rej))).then(b => { A.buf = b; log("loaded", "sfx"); });
    }).catch(() => {});
    if (C.state === "suspended" && soundOn()) C.resume().catch(() => {});
    return C;
  }
  /* noise, made once: white, pink and brown, and a bed of raindrops */
  function noise() {
    const C = A.ctx, sr = C.sampleRate;
    const make = (secs, ch, fill) => { const b = C.createBuffer(ch, Math.floor(sr * secs), sr); for (let c = 0; c < ch; c++) fill(b.getChannelData(c), c); return b; };
    A.white = make(2, 1, d => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; });
    A.pink = make(4, 2, d => { let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; } });
    A.brown = make(4, 2, d => { let l = 0; for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } });
    // drops: many tiny clicks with a heavy tail of bigger ones, stereo
    A.drops = make(3, 2, d => { for (let n = 0; n < 2400; n++) { const at = (Math.random() * (d.length - 400)) | 0, big = Math.pow(Math.random(), 3), len = 20 + ((big * 260) | 0), a = (0.08 + big * 0.7) * (Math.random() < 0.5 ? -1 : 1), k = 0.55 + Math.random() * 0.4; let y = 0; for (let i = 0; i < len; i++) { y = y * k + (Math.random() * 2 - 1) * (1 - k); d[at + i] += y * a * Math.exp(-i / (len * 0.3)) * 3; } } });
  }
  const now = () => A.ctx.currentTime;
  function ramp(p, v, secs) { const t = now(); p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(v, t + (secs || 0.05)); }

  /* ---------- the mix ---------- */
  let scoreK = 1, scoreT = 0; // (scoreLevel, below)
  function applyMix(instant) {
    const s = A.ctx ? 1 : 0, m = mix, N = A.nodes, on = soundOn();
    if (A.ctx) {
      const t = instant ? 0.01 : 0.12;
      ramp(N.master.gain, on ? m.master : 0, t);
      ramp(N.voice.gain, LEVELS.voice * m.voice, t);
      ramp(N.sfx.gain, LEVELS.sfx * m.sfx, t);
      ramp(N.amb.gain, LEVELS.amb * m.sfx, t);
      ramp(N.ui.gain, LEVELS.ui * m.sfx, t);
      ramp(N.verbG.gain, LEVELS.verb * m.sfx, t);
    }
    // the score's own level: master times music for the stems, master times effects for its stings
    const SC = window.JG_SCORE; if (SC && SC.mix) SC.mix(m.master * m.music * scoreK, m.master * Math.min(1, 0.4 + m.sfx * 0.7));
    return s;
  }
  /* a scene's hold on the score, under the visitor's own music level: the waiting room nearly silences it, the
     morning gives it back; eased over secs */
  function scoreLevel(k, secs = 3) {
    clearInterval(scoreT);
    const from = scoreK, t0 = performance.now();
    if (!(secs > 0) || Math.abs(k - from) < 1e-3) { scoreK = k; applyMix(); return; }
    scoreT = setInterval(() => { const u = Math.min(1, (performance.now() - t0) / (secs * 1000)); scoreK = from + (k - from) * u * u * (3 - 2 * u); applyMix(); if (u >= 1) clearInterval(scoreT); }, 150);
  }
  function setMix(k, v) { mix[k] = Math.max(0, Math.min(1, +v)); store.set(MIX_KEY, JSON.stringify(mix)); applyMix(); }
  function sound(on) {
    if (on && !A.ctx) build();
    if (!A.ctx) return;
    if (on && A.ctx.state !== "running") A.ctx.resume().catch(() => {});
    applyMix();
  }
  /* dialogue: the world steps back; a voiced line more than a caption */
  function duck(k) {
    if (!A.ctx) return; A.duckV = k;
    const N = A.nodes, t = k < 1 ? 0.25 : 1.1;
    ramp(N.ambDuck.gain, k < 1 ? Math.max(0.35, k) : 1, t);
    ramp(N.sfxDuck.gain, k < 1 ? Math.max(0.6, 0.3 + k * 0.6) : 1, t);
  }
  function veil(on) {
    if (!A.ctx || A.veiled === on) return; A.veiled = on;
    const N = A.nodes, t = now();
    N.veil.frequency.cancelScheduledValues(t); N.veil.frequency.setValueAtTime(N.veil.frequency.value, t); N.veil.frequency.exponentialRampToValueAtTime(on ? 900 : 20000, t + (on ? 0.4 : 0.9));
    ramp(N.veilG.gain, on ? 0.45 : 1, on ? 0.4 : 0.9);
  }
  /* a voice line (an <audio>) goes through the voice bus, so the sliders and the limiter hold it */
  function voice(a) {
    if (!A.ctx || !a) return;
    try { const s = A.ctx.createMediaElementSource(a); s.connect(A.nodes.voice); a.volume = 1; log("voice", a.src.split("/").pop()); }
    catch (e) { a.volume = Math.min(1, mix.master * mix.voice); }
  }

  /* ---------- placing a sound ---------- */
  function panner(x, y, z, ref = 2, roll = 1, max = 60) {
    const C = A.ctx, p = C.createPanner();
    p.panningModel = A.mobile ? "equalpower" : "HRTF"; p.distanceModel = "inverse"; p.refDistance = ref; p.rolloffFactor = roll; p.maxDistance = max;
    setPos(p, x, y, z); return p;
  }
  function setPos(p, x, y, z) { if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z); }
  function listen(pos, fwd) {
    if (!A.ctx) return;
    const L = A.ctx.listener;
    if (L.positionX) { L.positionX.value = pos.x; L.positionY.value = pos.y; L.positionZ.value = pos.z; L.forwardX.value = fwd.x; L.forwardY.value = fwd.y; L.forwardZ.value = fwd.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else { L.setPosition(pos.x, pos.y, pos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0); }
    A.lpos = pos; A.lfwd = fwd;
  }
  /* play a one-shot from the sprite */
  function sprite(name, o = {}) {
    if (!A.ctx || !A.buf || !A.sprites || !soundOn()) return false;
    const sp = A.sprites[name]; if (!sp) return false;
    const C = A.ctx, s = C.createBufferSource(); s.buffer = A.buf; s.playbackRate.value = o.rate || 1;
    const g = C.createGain(); g.gain.value = o.gain == null ? 1 : o.gain;
    let head = s;
    if (o.lp) { const f = C.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; head.connect(f); head = f; }
    if (o.hp) { const f = C.createBiquadFilter(); f.type = "highpass"; f.frequency.value = o.hp; head.connect(f); head = f; }
    head.connect(g);
    const out = o.at ? panner(o.at.x, o.at.y, o.at.z, o.ref || 2.5, o.roll || 1) : null;
    if (out) { g.connect(out); out.connect(o.bus || A.nodes.sfx); } else g.connect(o.bus || A.nodes.sfx);
    if (o.verb) { const v = C.createGain(); v.gain.value = o.verb; g.connect(v); v.connect(A.nodes.verb); }
    const when = now() + (o.delay || 0);
    s.start(when, sp[0], sp[1] + 0.06);
    log(o.kind || "sfx", name);
    return true;
  }
  /* a burst of filtered noise: the wet half of a step, a splash, a key, a tick */
  function burst(o) {
    if (!A.ctx || !soundOn()) return;
    const C = A.ctx, s = C.createBufferSource(); s.buffer = o.buf || A.white; s.playbackRate.value = o.rate || 1;
    const f = C.createBiquadFilter(); f.type = o.type || "bandpass"; f.frequency.value = o.f || 2000; f.Q.value = o.q || 0.8;
    const g = C.createGain(), t = now() + (o.delay || 0), a = o.attack || 0.002, d = o.decay || 0.05;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain || 0.1), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    s.connect(f); f.connect(g);
    if (o.at) { const p = panner(o.at.x, o.at.y, o.at.z, o.ref || 2.5, o.roll || 1); g.connect(p); p.connect(o.bus || A.nodes.sfx); } else g.connect(o.bus || A.nodes.sfx);
    if (o.verb) { const v = C.createGain(); v.gain.value = o.verb; g.connect(v); v.connect(A.nodes.verb); }
    s.start(t, Math.random() * 1.5, a + d + 0.05);
  }
  /* a pure tone with partials: a bell, a chime, a bubble */
  function tone(o) {
    if (!A.ctx || !soundOn()) return;
    const C = A.ctx, t = now() + (o.delay || 0), g = C.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.gain || 0.05, t + (o.attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + (o.attack || 0.004) + (o.decay || 0.6));
    for (const [m, k] of o.partials || [[1, 1]]) {
      const os = C.createOscillator(); os.type = o.wave || "sine"; os.frequency.setValueAtTime(o.f * m, t);
      if (o.to) os.frequency.exponentialRampToValueAtTime(o.to * m, t + (o.glide || 0.05));
      const pg = C.createGain(); pg.gain.value = k; os.connect(pg); pg.connect(g); os.start(t); os.stop(t + (o.attack || 0.004) + (o.decay || 0.6) + 0.05);
    }
    if (o.at) { const p = panner(o.at.x, o.at.y, o.at.z, o.ref || 2, o.roll || 1); g.connect(p); p.connect(o.bus || A.nodes.sfx); } else g.connect(o.bus || A.nodes.sfx);
    if (o.verb) { const v = C.createGain(); v.gain.value = o.verb; g.connect(v); v.connect(A.nodes.verb); }
  }

  /* ---------- the rooms: an impulse for each ---------- */
  function room(secs, damp, pre) {
    const C = A.ctx, sr = C.sampleRate, len = Math.floor(sr * secs), b = C.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const t = i / len; const n = Math.random() * 2 - 1; lp = lp + (n - lp) * (1 - damp * t); d[i] = (i < pre * sr ? 0 : lp * Math.pow(1 - t, 3.2)); } }
    return b;
  }

  /* ---------- ambience, per scene ---------- */
  function loop(buf, o = {}) {
    const C = A.ctx, s = C.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = o.rate || 1;
    let head = s;
    for (const f0 of o.filters || []) { const f = C.createBiquadFilter(); f.type = f0[0]; f.frequency.value = f0[1]; f.Q.value = f0[2] == null ? 0.7 : f0[2]; if (f0[3] != null) f.gain.value = f0[3]; head.connect(f); head = f; }
    const g = C.createGain(); g.gain.value = 0; head.connect(g);
    let out = g;
    if (o.at) { const p = panner(o.at.x, o.at.y, o.at.z, o.ref || 2, o.roll || 1, o.max || 80); g.connect(p); out = p; o.pan = p; }
    out.connect(o.bus || A.nodes.amb);
    s.start(now() + 0.02, Math.random() * buf.duration);
    const node = { s, g, p: o.pan || null, level: o.gain || 0.1, name: o.name || "" };
    A.amb.push(node);
    ramp(g.gain, node.level, o.fade || 1.5);
    return node;
  }
  function osc(type, f, o = {}) {
    const C = A.ctx, os = C.createOscillator(); os.type = type; os.frequency.value = f;
    const g = C.createGain(); g.gain.value = 0; let head = os;
    for (const f0 of o.filters || []) { const fl = C.createBiquadFilter(); fl.type = f0[0]; fl.frequency.value = f0[1]; fl.Q.value = f0[2] == null ? 0.7 : f0[2]; head.connect(fl); head = fl; }
    head.connect(g); let out = g;
    if (o.at) { const p = panner(o.at.x, o.at.y, o.at.z, o.ref || 1.5, o.roll || 1.5, o.max || 30); g.connect(p); out = p; o.pan = p; }
    out.connect(o.bus || A.nodes.amb); os.start();
    const node = { s: os, g, p: o.pan || null, level: o.gain || 0.02, name: o.name || "" };
    A.amb.push(node); ramp(g.gain, node.level, o.fade || 1.5);
    return node;
  }
  function clearAmb(secs = 1.2) {
    const old = A.amb; A.amb = [];
    for (const n of old) { try { ramp(n.g.gain, 0, secs); n.s.stop(now() + secs + 0.1); } catch (e) {} }
    A.lamps = []; A.roof = null; A.window = null; A.typingAt = null; A.lines = []; A.arcade = null; A.wind = null; A.windV = -1; A.dial = null;
    if (A.car) { try { A.car.stop(); } catch (e) {} A.car = null; }
    if (A.radio) { A.radio.stop(); A.radio = null; }
    A.lampAt = null;
    if (A.drv) { try { A.drv.stop(0.3); } catch (e) {} }
  }
  const HUM = { "fridge-hum": { f: [["lowpass", 170], ["peaking", 120, 4, 6]], g: 0.05, ref: 1.0 }, "sodium-hum": { f: [["bandpass", 240, 3]], g: 0.035, ref: 3 }, dryer: { f: [["lowpass", 300], ["highpass", 55]], g: 0.09, ref: 2.2 }, generator: { f: [["bandpass", 120, 1.6], ["peaking", 240, 3, 5]], g: 0.11, ref: 2.0 } };
  /* a scene's soundscape: called on every arrival */
  function scene(name, set, info = {}) {
    A.scene = name; A.set = set; A.info = info;
    if (!A.ctx) return;
    clearAmb();
    const N = A.nodes, t = now(), outside = name === "lot" || name === "decision" || name === "keys" || name === "sale";
    const rain = (name === "lot" ? 1 : name === "decision" ? 0.6 : name === "office" ? 1 : 0) * RAIN;
    // the glass: wide open outside, a murmur inside
    N.outLp.frequency.cancelScheduledValues(t); N.outLp.frequency.setTargetAtTime(outside ? 16000 : name === "office" ? 640 : 300, t, 0.3);
    ramp(N.out.gain, outside ? 1 : name === "office" ? 0.5 : 0, 1);
    N.verb.buffer = name === "memory" ? room(2.4, 0.6, 0.012) : name === "office" ? room(0.55, 0.85, 0.004) : name === "june" ? room(0.9, 0.9, 0.006) : room(1.1, 0.95, 0.03);
    A.verbAmt = name === "memory" ? 0.55 : name === "office" ? 0.32 : name === "june" ? 0.4 : 0.16;
    A.clockGain = 0.05;
    if (rain) {
      loop(A.pink, { name: "rain-hiss", bus: N.out, filters: [["highpass", 450], ["lowpass", 9000], ["peaking", 3200, 0.8, 3]], gain: 0.2 * rain });
      loop(A.drops, { name: "rain-patter", bus: N.out, filters: [["highpass", 900]], gain: 0.34 * rain });
      loop(A.brown, { name: "rain-body", bus: N.out, filters: [["lowpass", 260]], gain: 0.28 * rain });
    }
    const SN = set.userData.sounds || {};
    A.lines = [];
    const rainSrc = kind => (SN.rain || []).find(r => r.kind === kind);
    if (name === "lot" || name === "decision") {
      // the showroom's canopy: rain drumming on metal, loud under it, gone across the lot (a long source: heard from its nearest point)
      const can = rainSrc("rain-canopy") || { x: 2, y: 4.4, z: -16.8, w: 25 };
      A.roof = loop(A.drops, { name: "roof", rate: 0.55, filters: [["bandpass", 820, 1.3], ["peaking", 220, 3, 6]], gain: 0.55 * rain, at: can, ref: 2.2, roll: 1.6, bus: N.out }); A.lines.push({ n: A.roof, src: can });
      // rain ticking on the parked cars' roofs and on the storefront glass
      const cars = rainSrc("rain-cars"); if (cars) { const n = loop(A.drops, { name: "rain-cars", rate: 1.3, filters: [["bandpass", 3200, 1.1]], gain: 0.2 * rain, at: cars, ref: 3, roll: 1, bus: N.out }); A.lines.push({ n, src: cars, zSpan: 12 }); }
      const glass = rainSrc("rain-glass"); if (glass) { const n = loop(A.drops, { name: "rain-glass", rate: 0.9, filters: [["bandpass", 2300, 0.8]], gain: 0.16 * rain, at: glass, ref: 1.5, roll: 1.4, bus: N.out }); A.lines.push({ n, src: glass }); }
      // an engine idling: the black sedan by the showroom with its lights on (the world's), else a car at the curb
      const ip = SN.idle || { x: -9, y: 0.5, z: 31 };
      const idle = osc("sawtooth", 27, { name: "idle", filters: [["lowpass", 140, 1.2]], gain: SN.idle ? 0.09 : 0.06, at: ip, ref: 2.5, roll: 1.3, bus: N.out });
      const lfo = A.ctx.createOscillator(), lg = A.ctx.createGain(); lfo.frequency.value = 13.5; lg.gain.value = 0.03; lfo.connect(lg); lg.connect(idle.g.gain); lfo.start(); A.amb.push({ s: lfo, g: lg, level: 0.03 });
      if (SN.idle) loop(A.brown, { name: "idle-body", filters: [["lowpass", 90]], gain: 0.12, at: ip, ref: 2, roll: 1.5, bus: N.out });
      lamps(set, "sodium");
      A.nextCar = t + rnd(6, 14);
      // the wind through the street: a breath of it always, swelling with the world's gusts (set.userData.gust)
      A.wind = loop(A.pink, { name: "wind", bus: N.out, filters: [["lowpass", 620, 0.6], ["highpass", 110]], gain: 0.025 * rain }); A.windV = -1;
      // far off: a siren, a train's horn, a dog
      A.nextFar = t + rnd(20, 45);
    }
    if (outside) {
      const road = SN.road || { x: 0, y: 0.5, z: 38 };
      A.traffic = loop(A.brown, { name: "traffic", bus: N.out, filters: [["lowpass", 380], ["highpass", 40]], gain: name === "keys" ? 0.5 : 0.3, at: road, ref: 12, roll: 0.6 }); A.lines.push({ n: A.traffic, src: { ...road, w: 120 } });
      A.roadZ = road.z;
      A.hiss = loop(A.pink, { name: "tires", bus: N.out, filters: [["bandpass", name === "keys" ? 900 : 1600, 0.6]], gain: name === "keys" ? 0.025 : 0.05, at: { x: 30, y: 1, z: 45 }, ref: 40, roll: 0.5 });
      // the places that hum: the machine by the showroom, the gas station's canopy, the laundromat's dryers, the taco truck's generator
      for (const k of Object.keys(SN)) { const s0 = SN[k], h = s0 && HUM[s0.kind]; if (h) loop(A.brown, { name: "hum-" + k, bus: N.out, filters: h.f, gain: h.g, at: s0, ref: h.ref, roll: 1.4, max: 60 }); }
    }
    if (name === "keys" || name === "sale") { A.nextBird = t + 1; A.nextCar = t + rnd(3, 8); }
    if (name === "june") {
      // the waiting room after midnight: the building's air, the tubes' hum (one failing), the machines, the rain on the
      // window, and the clock, loud in the quiet; far down the corridor now and then a page, footsteps, a monitor
      loop(A.brown, { name: "hvac", filters: [["lowpass", 180]], gain: 0.2 });
      loop(A.pink, { name: "air", filters: [["highpass", 1600], ["lowpass", 5000]], gain: 0.014 });
      osc("sine", 60, { name: "mains", gain: 0.016 });
      osc("sine", 120, { name: "mains-2", gain: 0.006 });
      lamps(set, "tube");
      if (SN.vending) loop(A.brown, { name: "hum-vending", filters: HUM["fridge-hum"].f, gain: 0.07, at: SN.vending, ref: 1.2, roll: 1.4 });
      const win = SN.window || { x: 5.9, y: 1.6, z: -0.4 };
      A.window = loop(A.drops, { name: "window", filters: [["bandpass", 2200, 0.6]], gain: 0.3 * RAIN, at: win, ref: 1.8, roll: 1.1 }); if (win.w) A.lines.push({ n: A.window, src: { ...win, w: 0 }, zSpan: win.w / 2 });
      loop(A.brown, { name: "rain-far", filters: [["lowpass", 420]], gain: 0.06 * RAIN });
      A.clock = SN.clock || { x: -0.9, y: 2.4, z: -4.4 };
      A.clockOn = true; A.tickT = t + 0.4; A.clockGain = 0.11;
      A.corridor = SN.corridor || { x: 4.2, y: 1.2, z: 6 };
      A.nextHosp = t + rnd(5, 10);
    }
    if (name === "office") {
      // HVAC: a low rush of air and the mains hum under the fluorescents
      loop(A.brown, { name: "hvac", filters: [["lowpass", 210]], gain: 0.22 });
      loop(A.pink, { name: "air", filters: [["highpass", 1400], ["lowpass", 5200]], gain: 0.018 });
      osc("sine", 60, { name: "mains", gain: 0.012 });
      lamps(set, "tube");
      // the window, with the rain on it
      const win = SN.window || ((set.userData.spots && set.userData.spots.window) ? set.userData.spots.window.p : { x: 0, y: 1.6, z: 4.8 });
      A.window = loop(A.drops, { name: "window", filters: [["bandpass", 2400, 0.6]], gain: 0.22 * RAIN, at: { x: win.x, y: win.y, z: win.z + 0.1 }, ref: 1.6, roll: 1.2 }); if (win.w) A.lines.push({ n: A.window, src: win });
      // the laptop's fan, the fridge under the coffee counter
      if (SN.laptop) loop(A.pink, { name: "laptop-fan", filters: [["bandpass", 1100, 1.2]], gain: 0.012, at: SN.laptop, ref: 0.6, roll: 1.6 });
      if (SN.coffee) { osc("sine", 120, { name: "fridge", gain: 0.01, at: SN.coffee, ref: 0.8, roll: 1.5 }); loop(A.brown, { name: "fridge-body", filters: [["lowpass", 160]], gain: 0.05, at: SN.coffee, ref: 0.8, roll: 1.5 }); }
      A.arcade = SN.arcade || null; A.nextArcade = t + rnd(3, 8);
      A.clock = SN.clock || { x: -4.2, y: 2.3, z: -4.9 };
      A.clockOn = true; A.tickT = t + 0.5;
      A.nextType = t + rnd(1, 3);
    } else if (name !== "memory") A.clockOn = false;
    if (name === "memory") {
      // the library: the hush of a big room, far air, now and then a page somewhere
      loop(A.pink, { name: "hush", filters: [["lowpass", 900], ["highpass", 90]], gain: 0.07 });
      loop(A.brown, { name: "far-air", filters: [["lowpass", 160]], gain: 0.1 });
      // rain on the tall windows, and a slow clock high on the wall
      if (SN.windows) { const n = loop(A.drops, { name: "rain-glass", rate: 0.8, filters: [["bandpass", 2000, 0.7]], gain: 0.14 * RAIN, at: SN.windows, ref: 3, roll: 1 }); A.lines.push({ n, src: SN.windows }); }
      if (SN.clock) { A.clock = SN.clock; A.clockOn = true; A.tickT = t + 0.7; }
      A.nextHush = t + rnd(4, 9);
    }
    log("scene", name);
  }
  /* the lamps nearest you buzz: sodium on the lot (a gritty 120 Hz), the office's tubes cleaner and higher */
  function lamps(set, kind) {
    const SN = set.userData.sounds || {};
    const C = A.ctx, list = SN.lamps && SN.lamps.length ? SN.lamps.map(q => ({ p: q })) : (set.userData.lamps || []).filter(l => !l.car && (kind === "tube" ? l.fixed : !l.fixed));
    if (!list.length) return;
    for (let i = 0; i < Math.min(3, list.length); i++) {
      const os = C.createOscillator(); os.type = "sawtooth"; os.frequency.value = 120 + rnd(-0.4, 0.4);
      const bp = C.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = kind === "tube" ? 480 : 360; bp.Q.value = 1.6;
      const g = C.createGain(); g.gain.value = 0;
      const p = panner(0, -50, 0, kind === "tube" ? 1.4 : 1.1, kind === "tube" ? 1.4 : 2.2, 25);
      os.connect(bp); bp.connect(g);
      // the crackle of an old ballast
      const cr = C.createBufferSource(); cr.buffer = A.drops; cr.loop = true; cr.playbackRate.value = 0.3;
      const cf = C.createBiquadFilter(); cf.type = "bandpass"; cf.frequency.value = 3800; cf.Q.value = 2; const cg = C.createGain(); cg.gain.value = kind === "tube" ? 0.0 : 0.5;
      cr.connect(cf); cf.connect(cg); cg.connect(g);
      g.connect(p); p.connect(A.nodes.amb); os.start(); cr.start(now(), Math.random() * 2);
      const node = { s: os, g, p, level: kind === "tube" ? 0.018 : 0.03, name: "lamp", lamp: null };
      A.amb.push(node, { s: cr, g: cg, level: cg.gain.value });
      A.lamps.push(node);
    }
    A.lampList = list;
  }

  /* ---------- per frame ---------- */
  function update(dt, w) {
    if (!A.ctx || A.ctx.state !== "running") return;
    const t = now();
    // a radio the world switched on plays where it stands; off, it stops
    const rs = A.set && A.set.userData && A.set.userData.sounds && A.set.userData.sounds.radio;
    if (rs && !A.radio && soundOn()) A.radio = radio(rs); else if (!rs && A.radio) { A.radio.stop(); A.radio = null; }
    if (A.radio) A.radio.tick(t);
    // the nearest lamps get the buzzing voices
    if (A.lamps.length && A.lampList && w.ear && (!A.lampAt || Math.abs(A.lampAt.x - w.ear.x) + Math.abs(A.lampAt.z - w.ear.z) > 1)) {
      A.lampAt = { x: w.ear.x, z: w.ear.z }; // re-sorted only when you've moved a metre, not every frame
      const ear = w.ear, sorted = A.lampList.slice().sort((a, b) => (a.p.x - ear.x) ** 2 + (a.p.z - ear.z) ** 2 - (b.p.x - ear.x) ** 2 - (b.p.z - ear.z) ** 2);
      A.lamps.forEach((v, i) => {
        const l = sorted[i]; if (!l) return;
        if (v.lamp !== l) { v.lamp = l; setPos(v.p, l.p.x, l.p.y, l.p.z); ramp(v.g.gain, w.day ? 0 : v.level, 0.6); }
      });
    }
    // long sources (the canopy, the rows of cars, the glass, the road) are heard from their nearest point
    if (A.lines && w.ear) for (const L of A.lines) { const s0 = L.src, h = (s0.w || 0) / 2; if (!L.n.p) continue; setPos(L.n.p, Math.max(s0.x - h, Math.min(s0.x + h, w.ear.x)), s0.y, L.zSpan ? Math.max(s0.z - L.zSpan, Math.min(s0.z + L.zSpan, w.ear.z)) : s0.z); }
    // the arcade cabinet in attract mode: now and then a few quiet notes
    if (A.scene === "office" && A.arcade && t >= A.nextArcade) {
      const root = pick([261.6, 293.7, 329.6, 392]), steps = [1, 1.25, 1.5, 2, 1.5, 1.25];
      steps.forEach((m, i) => tone({ f: root * m, wave: "square", decay: 0.09, gain: 0.006, delay: i * 0.11, at: A.arcade, ref: 0.9, roll: 1.6, bus: A.nodes.amb }));
      A.nextArcade = t + rnd(7, 14);
    }
    // the office clock
    if (A.clockOn && t >= A.tickT) {
      const tock = (A.tickN = (A.tickN || 0) + 1) % 2;
      burst({ f: tock ? 2400 : 3100, q: 6, gain: A.clockGain || 0.05, decay: 0.03, at: A.clock, ref: 1.2, roll: 1.3, bus: A.nodes.amb });
      if (A.scene === "june") tone({ f: tock ? 520 : 610, decay: 0.05, gain: 0.012, at: A.clock, ref: 1.2, roll: 1.3, bus: A.nodes.amb });
      A.tickT += 1;
    }
    // Renata types when she's at her desk and not talking
    if (A.scene === "office" && w.typist && t >= A.nextType) {
      if (A.typing <= 0) { A.typing = (rnd(4, 18)) | 0; }
      const at = w.typist;
      const space = Math.random() < 0.14;
      burst({ type: "lowpass", f: space ? 900 : 1800, q: 1, gain: space ? 0.07 : 0.05, decay: space ? 0.04 : 0.022, at, ref: 1.2, roll: 1.4, bus: A.nodes.amb });
      burst({ type: "highpass", f: 4200, q: 0.7, gain: 0.025, decay: 0.008, at, ref: 1.2, roll: 1.4, bus: A.nodes.amb });
      A.typing--;
      A.nextType = t + (A.typing > 0 ? rnd(0.07, 0.17) : rnd(1.2, 5));
    }
    // the library: a page somewhere far off, a chair, the building settling
    if (A.scene === "memory" && t >= A.nextHush) {
      const a = Math.random() * Math.PI * 2, r = rnd(6, 10), at = { x: Math.cos(a) * r, y: 1, z: Math.sin(a) * r };
      if (Math.random() < 0.7) sprite(pick(["page-0", "page-1", "page-2"]), { gain: 0.16, rate: rnd(0.9, 1.1), at, ref: 1, roll: 1, verb: 0.6, lp: 4000, bus: A.nodes.amb, kind: "amb" });
      else sprite(pick(["creak-0", "creak-2"]), { gain: 0.1, rate: rnd(0.6, 0.8), at, ref: 1, roll: 1, verb: 0.7, lp: 2500, bus: A.nodes.amb, kind: "amb" });
      A.nextHush = t + rnd(7, 18);
    }
    // the hospital, far down the corridor: a soft two-note page, someone's footsteps passing, a monitor somewhere
    if (A.scene === "june" && A.nextHosp && t >= A.nextHosp) { hospital(); A.nextHosp = t + rnd(9, 20); }
    // the morning: birds in the trees along the fence
    if ((A.scene === "keys" || A.scene === "sale") && t >= A.nextBird) {
      const at = { x: rnd(-30, 30), y: rnd(4, 8), z: rnd(-26, 22) }, n = (rnd(2, 6)) | 0, base = rnd(2600, 4200);
      for (let i = 0; i < n; i++) tone({ f: base * rnd(0.9, 1.1), to: base * rnd(1.2, 1.6), glide: rnd(0.04, 0.09), decay: rnd(0.05, 0.12), gain: 0.02, delay: i * rnd(0.09, 0.16), at, ref: 3, roll: 1, bus: A.nodes.amb });
      A.nextBird = t + rnd(1.5, 6);
    }
    // the wind follows the world's gusts
    if (A.wind && A.set && A.set.userData) { const gv = +(A.set.userData.gust || 0).toFixed(2); if (gv !== A.windV) { A.windV = gv; A.wind.g.gain.setTargetAtTime(0.025 + 0.2 * gv, t, 0.3); } }
    // a payphone off its hook: the dial tone, where it hangs
    const dl = A.set && A.set.userData && A.set.userData.sounds && A.set.userData.sounds.dial;
    if (dl && !A.dial && soundOn()) { A.dial = [osc("sine", 350, { name: "dial", gain: 0.014, at: dl, ref: 0.4, roll: 2.2, max: 14, fade: 0.05, bus: A.nodes.sfx }), osc("sine", 440, { name: "dial", gain: 0.014, at: dl, ref: 0.4, roll: 2.2, max: 14, fade: 0.05, bus: A.nodes.sfx })]; log("amb", "dial"); }
    else if (!dl && A.dial) { for (const n of A.dial) { ramp(n.g.gain, 0, 0.06); try { n.s.stop(now() + 0.1); } catch (e) {} } A.amb = A.amb.filter(n => !A.dial.includes(n)); A.dial = null; }
    // far off, now and then: a siren crossing town, a train's horn, a dog
    if ((A.scene === "lot" || A.scene === "decision") && A.nextFar && t >= A.nextFar) { far(); A.nextFar = t + rnd(35, 80); }
    // a car passes on the street, with its doppler
    if ((A.scene === "lot" || A.scene === "decision" || A.scene === "keys" || A.scene === "sale" || A.scene === "office") && !A.car && t >= A.nextCar && A.nextCar) passCar(A.scene !== "keys" && A.scene !== "sale");
    if (A.car) A.car.tick(dt, w.ear);
    // a peak meter, for the harness: the limiter keeps it under full scale
    if ((A.mt = (A.mt || 0) + dt) > 0.25) { A.mt = 0; const d = new Float32Array(A.nodes.meter.fftSize); A.nodes.meter.getFloatTimeDomainData(d); let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); A.peak = Math.max(A.peak * 0.9, m); A.peakMax = Math.max(A.peakMax || 0, m); }
  }
  function hospital() {
    if (!soundOn()) return;
    const c = A.corridor || { x: 4.2, y: 1.2, z: 6 }, at = { x: c.x + rnd(-2, 2), y: 1.6, z: c.z + rnd(1, 5) }, roll = Math.random(), amb = A.nodes.amb;
    if (roll < 0.34) {
      // the page: two soft notes down a long hall, through the doors
      tone({ f: 659.3, partials: [[1, 1], [2, 0.2]], decay: 1.1, gain: 0.018, at, ref: 2, roll: 0.8, bus: amb });
      tone({ f: 523.3, partials: [[1, 1], [2, 0.2]], decay: 1.4, gain: 0.018, delay: 0.42, at, ref: 2, roll: 0.8, bus: amb });
      log("amb", "page");
    } else if (roll < 0.72) {
      // footsteps passing outside the doors, left to right, unhurried
      const n = 8 + ((Math.random() * 5) | 0), dir = Math.random() < 0.5 ? 1 : -1;
      for (let i = 0; i < n; i++) { const k = i / (n - 1); sprite("step-concrete-" + (i % 5), { at: { x: c.x + dir * (k * 10 - 5), y: 0.05, z: c.z + 1.2 }, gain: 0.16 * Math.sin(k * Math.PI) + 0.02, rate: rnd(1.0, 1.1), lp: 2600, ref: 2, roll: 1.1, verb: 0.7, delay: i * 0.56, bus: amb, kind: "amb" }); }
      log("amb", "steps");
    } else {
      // a monitor in a room down the hall: a few soft beeps, then it stops
      for (let i = 0; i < 6; i++) tone({ f: 1046.5, decay: 0.09, gain: 0.006, delay: i * 0.92, at, ref: 2, roll: 0.9, bus: amb });
      log("amb", "monitor");
    }
  }
  /* a phone vibrating on a plastic seat: bursts of a low rattle */
  function buzz(at, n = 2) {
    if (!A.ctx) return false;
    for (let i = 0; i < n; i++) {
      tone({ f: 165, wave: "square", partials: [[1, 1]], decay: 0.42, attack: 0.02, gain: 0.03, delay: i * 1.1, at, ref: 1.2, roll: 1.4, lp: 900 });
      burst({ type: "bandpass", f: 310, q: 4, gain: 0.05, attack: 0.02, decay: 0.38, delay: i * 1.1, at, ref: 1.2, roll: 1.4 });
    }
    log("thing", "buzz"); return true;
  }
  /* a heartbeat: the pulse that runs under a hold, felt more than heard */
  function heart(k = 1) {
    if (!A.ctx) return false;
    const U = A.nodes.ui;
    tone({ f: 58, to: 44, glide: 0.08, decay: 0.16, gain: 0.07 * k, bus: U });
    tone({ f: 52, to: 40, glide: 0.08, decay: 0.2, gain: 0.05 * k, delay: 0.19, bus: U });
    log("ui", "heart"); return true;
  }
  function far() {
    if (!soundOn()) return;
    const C = A.ctx, t = now(), a = Math.random() * Math.PI * 2, r = rnd(140, 220), at = { x: Math.cos(a) * r, y: 8, z: Math.sin(a) * r }, roll = Math.random();
    if (roll < 0.4) {
      // a siren, crossing town: the wail rising and falling, coming up and fading away
      const os = C.createOscillator(); os.type = "sine"; const f = os.frequency, dur = rnd(10, 15);
      f.setValueAtTime(720, t); for (let i = 0, k = 0; k < dur; i++, k += 2.2) f.linearRampToValueAtTime(i % 2 ? 720 : 1380, t + k + 2.2);
      const lp = C.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1700; const g = C.createGain(); g.gain.value = 0;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
      const p = panner(at.x, at.y, at.z, 30, 1, 400); os.connect(lp); lp.connect(g); g.connect(p); p.connect(A.nodes.out); os.start(t); os.stop(t + dur + 0.1);
      log("amb", "siren");
    } else if (roll < 0.75) {
      // a train's horn across the bayou: two long, a short, a long
      const blasts = [[0, 1.6], [2.0, 1.5], [3.9, 0.6], [4.8, 2.2]], g = C.createGain(); g.gain.value = 0;
      for (const [s0, d] of blasts) { g.gain.setValueAtTime(0, t + s0); g.gain.linearRampToValueAtTime(0.035, t + s0 + 0.12); g.gain.setValueAtTime(0.035, t + s0 + d - 0.2); g.gain.linearRampToValueAtTime(0, t + s0 + d); }
      const lp = C.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; g.connect(lp);
      const p = panner(at.x, at.y, at.z, 30, 1, 400); lp.connect(p); p.connect(A.nodes.out);
      for (const f0 of [155.6, 185, 233.1]) { const os = C.createOscillator(); os.type = "sawtooth"; os.frequency.value = f0 * rnd(0.995, 1.005); os.connect(g); os.start(t); os.stop(t + 7.2); }
      log("amb", "train");
    } else {
      // a dog somewhere behind the buildings across the road
      const dog = { x: rnd(-40, 40), y: 0.6, z: rnd(60, 90) }, n = 2 + ((Math.random() * 3) | 0);
      for (let i = 0; i < n; i++) tone({ f: rnd(480, 560), to: rnd(330, 380), glide: 0.07, decay: 0.12, partials: [[1, 1], [2, 0.45], [3, 0.2]], gain: 0.02, delay: i * rnd(0.3, 0.45), at: dog, ref: 6, roll: 1, bus: A.nodes.out });
      log("amb", "dog");
    }
  }
  function passCar(wet) {
    const C = A.ctx, dir = Math.random() < 0.5 ? 1 : -1, z = (A.roadZ || 31) + rnd(-1, 2.5), v = rnd(11, 17) * dir;
    let x = -95 * dir;
    // the world shows it: a body and its lights along the road (world.js, passCar), when it's the street outside
    try { const pc = A.set && A.set.userData && A.set.userData.passCar; if (pc && (A.scene === "lot" || A.scene === "decision")) pc(x, v); } catch (e) {}
    const eng = C.createOscillator(); eng.type = "sawtooth"; const f0 = rnd(34, 52); eng.frequency.value = f0;
    const el = C.createBiquadFilter(); el.type = "lowpass"; el.frequency.value = 520; el.Q.value = 0.9;
    const tire = C.createBufferSource(); tire.buffer = A.pink; tire.loop = true;
    const tf = C.createBiquadFilter(); tf.type = "bandpass"; tf.frequency.value = wet ? 2400 : 1100; tf.Q.value = 0.5;
    const g = C.createGain(); g.gain.value = 0;
    const eg = C.createGain(); eg.gain.value = 0.22; const tg = C.createGain(); tg.gain.value = wet ? 0.9 : 0.5;
    eng.connect(el); el.connect(eg); eg.connect(g); tire.connect(tf); tf.connect(tg); tg.connect(g);
    const p = panner(x, 0.6, z, 6, 1.1, 200); g.connect(p); p.connect(A.nodes.out);
    eng.start(); tire.start(now(), Math.random() * 3); ramp(g.gain, 0.5, 2.5);
    let prevD = null;
    A.car = {
      tick(dt, ear) {
        x += v * dt; setPos(p, x, 0.6, z);
        if (ear) {
          // the pitch rises as it comes and falls as it goes: c / (c - closing speed)
          const d = Math.hypot(x - ear.x, z - ear.z), vr = prevD == null ? 0 : (prevD - d) / Math.max(dt, 1e-3); prevD = d;
          const k = 343 / (343 - Math.max(-60, Math.min(60, vr)));
          eng.frequency.setTargetAtTime(f0 * k, now(), 0.05); tire.playbackRate.setTargetAtTime(k, now(), 0.05);
        }
        if (Math.abs(x) > 95 && Math.sign(x) === Math.sign(v)) this.stop();
      },
      stop() { ramp(g.gain, 0, 0.6); try { eng.stop(now() + 0.7); tire.stop(now() + 0.7); } catch (e) {} A.car = null; A.nextCar = now() + rnd(18, 45); }
    };
    log("amb", "car");
  }

  /* ---------- feet ---------- */
  /* surface: asphalt (dry), wet, puddle, carpet, tile, wood, concrete */
  function step(surface, o = {}) {
    if (!A.ctx || !soundOn()) return false;
    const run = !!o.run, k = (o.gain || 1) * (run ? 1.35 : 1), at = o.at, ref = o.ref || 3, verb = A.verbAmt * (surface === "tile" ? 1.3 : surface === "carpet" ? 0.3 : 1);
    const i = (Math.random() * 5) | 0;
    const base = { at, ref, roll: 1.2, verb };
    if (surface === "carpet") sprite("step-carpet-" + i, { ...base, gain: 0.42 * k, rate: rnd(0.92, 1.05), lp: 3800, kind: "step" });
    else if (surface === "wood") sprite("step-wood-" + i, { ...base, gain: 0.4 * k, rate: rnd(0.94, 1.06), kind: "step" });
    else if (surface === "tile") { sprite("step-concrete-" + i, { ...base, gain: 0.42 * k, rate: rnd(1.06, 1.16), kind: "step" }); burst({ f: 4200, q: 3, gain: 0.03 * k, decay: 0.014, at, ref }); }
    else if (surface === "asphalt" || surface === "concrete") { sprite("step-concrete-" + i, { ...base, gain: 0.46 * k, rate: rnd(0.84, 0.96), lp: 6500, kind: "step" }); burst({ type: "highpass", f: 3500, gain: 0.018 * k, decay: 0.02, delay: 0.012, at, ref }); }
    else {
      // wet asphalt: the heel, then the slap of water off the sole and a few drops
      const pud = surface === "puddle";
      sprite("step-concrete-" + i, { ...base, gain: (pud ? 0.28 : 0.36) * k, rate: rnd(0.84, 0.95), lp: 5000, kind: "step" });
      burst({ f: rnd(2600, 3600), q: 0.7, gain: (pud ? 0.2 : 0.09) * k, attack: 0.003, decay: pud ? 0.24 : (run ? 0.11 : 0.075), delay: 0.006, at, ref });
      burst({ type: "highpass", f: 5200, gain: (pud ? 0.07 : 0.025) * k, decay: pud ? 0.3 : 0.09, delay: 0.015, at, ref });
      const nb = pud ? (4 + Math.random() * 4) | 0 : Math.random() < 0.5 ? 1 : 0;
      for (let b = 0; b < nb; b++) { const f = rnd(700, 1400); tone({ f, to: f * rnd(1.6, 2.4), glide: 0.018, decay: 0.03, gain: (pud ? 0.03 : 0.012) * k, delay: rnd(0.02, pud ? 0.3 : 0.08), at, ref }); }
      if (pud) tone({ f: 190, to: 80, glide: 0.07, decay: 0.08, gain: 0.05 * k, delay: 0.01, at, ref });
    }
    return true;
  }
  /* cloth: when you turn, start or stop */
  function cloth(at, k = 1) {
    if (!A.ctx) return false;
    return sprite("cloth-" + ((Math.random() * 4) | 0), { gain: 0.16 * k, rate: rnd(0.9, 1.12), lp: 5200, at, ref: 3, kind: "cloth" });
  }

  /* ---------- things in the world ---------- */
  function thing(id, at) {
    if (!A.ctx) return;
    const v = { at, ref: 2.2, verb: A.verbAmt };
    const P = n => pick(["page-0", "page-1", "page-2"]);
    switch (id) {
      case "cabinet": sprite("latch", { ...v, gain: 0.35, rate: 0.8 }); burst({ type: "bandpass", f: 700, q: 1.5, gain: 0.12, attack: 0.08, decay: 0.3, delay: 0.1, at }); sprite(P(), { ...v, gain: 0.3, delay: 0.5 }); break;
      case "ledger": case "book": case "mem-folder": sprite("book-open", { ...v, gain: 0.6 }); sprite(P(), { ...v, gain: 0.35, delay: 0.25 }); break;
      case "mem-cert": case "mem-letter": sprite(P(), { ...v, gain: 0.4 }); break;
      case "laptop": case "mem-laptop": sprite("ui-click", { ...v, gain: 0.12, rate: 0.7, lp: 3000 }); sprite("ui-click", { ...v, gain: 0.1, rate: 0.75, lp: 3000, delay: 0.16 }); break;
      case "keys": sprite("keys-0", { ...v, gain: 0.45 }); break;
      case "mem-psych": sprite("book-open", { ...v, gain: 0.45, rate: 1.15 }); sprite(P(), { ...v, gain: 0.3, delay: 0.2 }); break;
      case "june-window": for (let i = 0; i < 3; i++) tone({ f: 1900 + i * 140, to: 2400 + i * 160, glide: 0.2, decay: 0.16, gain: 0.006, delay: 0.05 + i * 0.22, at, ref: 1.2 }); burst({ type: "bandpass", f: 3200, q: 2, gain: 0.03, attack: 0.05, decay: 0.5, at, ref: 1.2 }); break;
      case "june-scan": sprite("click-metal", { ...v, gain: 0.22, rate: 1.3 }); break;
      case "june-coffee": sprite("ui-click", { ...v, gain: 0.3, rate: 0.8, lp: 3000 }); burst({ type: "lowpass", f: 700, gain: 0.08, attack: 0.15, decay: 1.4, delay: 0.3, at, ref: 1.6 }); break;
      case "june-phone": sprite("ui-click", { ...v, gain: 0.15, rate: 1.4, lp: 4000 }); break;
      case "june-door": sprite("door-open", { ...v, gain: 0.45, rate: 0.9 }); break;
      case "june-jason": case "sale-buyer": case "sale-keys": cloth(at, 0.8); break;
      case "gate": chain(at); break;
      case "door": sprite("door-open", { ...v, gain: 0.45, rate: 0.95 }); break;
      case "mem-lamp": case "lampoff": sprite("click-metal", { ...v, gain: 0.3, rate: 1.2 }); break;
      case "coffee": tone({ f: 2100, partials: [[1, 1], [2.7, 0.4]], decay: 0.5, gain: 0.03, at }); break;
      case "truck": sprite("chain-2", { ...v, gain: 0.18, rate: 0.55, lp: 2000 }); break;
      case "dell": case "jason-lot": case "jason-end": case "renata": cloth(at, 0.8); break;
    }
    log("thing", id);
  }
  function chain(at, n = 5) {
    for (let i = 0; i < n; i++) sprite("chain-" + ((Math.random() * 3) | 0), { at, ref: 2.4, gain: rnd(0.12, 0.25), rate: rnd(1.1, 1.6), delay: i * rnd(0.05, 0.11), verb: A.verbAmt });
  }
  /* the gate rolls: the creak of the wheels, the chain, the latch */
  function gate(at) {
    if (!A.ctx) return;
    sprite("creak-1", { at, ref: 3, gain: 0.5, rate: 0.55, lp: 3000, verb: A.verbAmt }); sprite("creak-0", { at, ref: 3, gain: 0.35, rate: 0.5, delay: 0.6, lp: 3000 });
    chain(at, 7); sprite("latch", { at, ref: 3, gain: 0.45, rate: 0.85, delay: 1.5 });
    log("thing", "gate-roll");
  }
  /* the office: the door closes behind you, and the chime over it */
  function arriveOffice(at) {
    if (!A.ctx) return;
    tone({ f: 659.3, partials: [[1, 1], [2.76, 0.35], [5.4, 0.12]], decay: 1.6, gain: 0.07, at, ref: 2, verb: 0.5 });
    tone({ f: 523.3, partials: [[1, 1], [2.76, 0.35], [5.4, 0.12]], decay: 2.0, gain: 0.07, delay: 0.42, at, ref: 2, verb: 0.5 });
    sprite("door-close", { at, ref: 2.5, gain: 0.35, delay: 0.15, verb: 0.4 });
    log("thing", "chime");
  }
  /* the desk phone: an electronic ring, two tones warbling, where the phone is */
  function ring(at, secs) {
    if (!A.ctx || !soundOn()) return;
    const C = A.ctx, t = now(), g = C.createGain(); g.gain.value = 0;
    for (const f of [440, 480]) { const os = C.createOscillator(); os.frequency.value = f; os.connect(g); os.start(t); os.stop(t + secs + 0.05); }
    const am = C.createOscillator(), ag = C.createGain(); am.type = "square"; am.frequency.value = 20; ag.gain.value = 0.045; am.connect(ag); ag.connect(g.gain); am.start(t); am.stop(t + secs);
    g.gain.setValueAtTime(0.05, t); g.gain.setValueAtTime(0.05, t + secs - 0.05); g.gain.linearRampToValueAtTime(0, t + secs);
    const bp = C.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1100; bp.Q.value = 0.4;
    const p = panner(at.x, at.y, at.z, 1.6, 1.1); g.connect(bp); bp.connect(p); p.connect(A.nodes.sfx);
    const v = C.createGain(); v.gain.value = 0.4; bp.connect(v); v.connect(A.nodes.verb);
    log("sfx", "ring");
  }

  /* ---------- the car you drive ----------
     The engine is synthesized from its rpm and load: a saw at the firing
     rate (two pulses a turn for a four), a square an octave down for the
     body, a little detuned saw an octave up for the edge, and the intake's
     breath, all through a soft clip that bites harder under load and a
     lowpass that opens with the throttle. A shift dips it for a beat. The
     tyres squeal from slip; the road hisses with speed, wetter on the wet;
     impacts thump by strength. From inside the car the world closes down
     behind the glass and the rain drums on the roof. */
  function drive(o = {}) {
    if (!A.ctx) return null;
    if (A.drv) A.drv.stop(0.05);
    const C = A.ctx, N = A.nodes, t0 = now();
    const out = C.createGain(); out.gain.value = 0; out.connect(N.sfx);
    // engine
    const eng = C.createGain(); eng.gain.value = 0;
    const clip = C.createWaveShaper(), curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 2.2); } clip.curve = curve; clip.oversample = A.mobile ? "none" : "2x";
    const pre = C.createGain(); pre.gain.value = 0.6;
    const lp = C.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 600; lp.Q.value = 1.6;
    const body = C.createBiquadFilter(); body.type = "peaking"; body.frequency.value = 120; body.Q.value = 0.9; body.gain.value = 5;
    pre.connect(clip); clip.connect(lp); lp.connect(body); body.connect(eng); eng.connect(out);
    const o1 = C.createOscillator(), o2 = C.createOscillator(), o3 = C.createOscillator();
    o1.type = "sawtooth"; o2.type = "square"; o3.type = "sawtooth"; o3.detune.value = 9;
    const g1 = C.createGain(), g2 = C.createGain(), g3 = C.createGain(); g1.gain.value = 0.5; g2.gain.value = 0.28; g3.gain.value = 0.12;
    o1.connect(g1); o2.connect(g2); o3.connect(g3); g1.connect(pre); g2.connect(pre); g3.connect(pre);
    // the firing pulse: a little amplitude wobble at the firing rate, so it isn't a pure buzz
    const wob = C.createOscillator(), wobG = C.createGain(); wob.type = "sine"; wobG.gain.value = 0.18; wob.connect(wobG); wobG.connect(g1.gain);
    const intake = C.createBufferSource(); intake.buffer = A.pink; intake.loop = true;
    const ibp = C.createBiquadFilter(); ibp.type = "bandpass"; ibp.frequency.value = 400; ibp.Q.value = 1.4;
    const ig = C.createGain(); ig.gain.value = 0; intake.connect(ibp); ibp.connect(ig); ig.connect(eng);
    // tyres
    const sq = C.createBufferSource(); sq.buffer = A.white; sq.loop = true;
    const sbp = C.createBiquadFilter(); sbp.type = "bandpass"; sbp.frequency.value = 1150; sbp.Q.value = 9;
    const sqT = C.createOscillator(); sqT.type = "triangle"; sqT.frequency.value = 980;
    const sqV = C.createOscillator(), sqVG = C.createGain(); sqV.frequency.value = 7; sqVG.gain.value = 22; sqV.connect(sqVG); sqVG.connect(sqT.frequency);
    const sqTG = C.createGain(); sqTG.gain.value = 0.05; sqT.connect(sqTG);
    const sg = C.createGain(); sg.gain.value = 0; sq.connect(sbp); sbp.connect(sg); sqTG.connect(sg); sg.connect(out);
    // the road: a rumble and, on the wet, the spray
    const road = C.createBufferSource(); road.buffer = A.brown; road.loop = true;
    const rlp = C.createBiquadFilter(); rlp.type = "lowpass"; rlp.frequency.value = 250;
    const rg = C.createGain(); rg.gain.value = 0; road.connect(rlp); rlp.connect(rg); rg.connect(out);
    const spray = C.createBufferSource(); spray.buffer = A.pink; spray.loop = true;
    const shp = C.createBiquadFilter(); shp.type = "highpass"; shp.frequency.value = 2200;
    const spg = C.createGain(); spg.gain.value = 0; spray.connect(shp); shp.connect(spg); spg.connect(out);
    // the roof: rain drumming on thin metal, heard from inside
    const roof = C.createBufferSource(); roof.buffer = A.drops; roof.loop = true; roof.playbackRate.value = 0.8;
    const rbp = C.createBiquadFilter(); rbp.type = "bandpass"; rbp.frequency.value = 1400; rbp.Q.value = 0.6;
    const rlp2 = C.createBiquadFilter(); rlp2.type = "lowpass"; rlp2.frequency.value = 3200;
    const roofG = C.createGain(); roofG.gain.value = 0; roof.connect(rbp); rbp.connect(rlp2); rlp2.connect(roofG); roofG.connect(out);
    const srcs = [o1, o2, o3, wob, intake, sq, sqT, sqV, road, spray, roof];
    srcs.forEach(n => n.start(t0 + 0.01));
    ramp(out.gain, 1, 0.4);
    const rain = (o.rain == null ? 1 : o.rain) * RAIN;
    const D = { rpm: 0, on: !!o.running, inside: false, dip: 0, last: {}, gearT: 0 };
    log("car", "drive");
    if (!D.on && o.start !== false) start();
    function start() {
      // the starter: a ragged whirr, then the engine catches
      const t = now(), st = C.createOscillator(), sg2 = C.createGain(), am = C.createOscillator(), amg = C.createGain();
      st.type = "sawtooth"; st.frequency.setValueAtTime(48, t); st.frequency.linearRampToValueAtTime(66, t + 0.55);
      am.frequency.value = 9; amg.gain.value = 0.05; am.connect(amg); amg.connect(sg2.gain);
      sg2.gain.setValueAtTime(0.0001, t); sg2.gain.exponentialRampToValueAtTime(0.07, t + 0.05); sg2.gain.setValueAtTime(0.07, t + 0.5); sg2.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      const f = C.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900; st.connect(f); f.connect(sg2); sg2.connect(out);
      st.start(t); am.start(t); st.stop(t + 0.75); am.stop(t + 0.75);
      setTimeout(() => { D.on = true; D.catch = 1; }, 520);
      log("car", "start");
    }
    function update(v) {
      const t = now(), rpm = Math.max(0, v.rpm || 0), load = Math.max(0, Math.min(1, v.load || 0)), sp = Math.abs(v.speed || 0);
      D.dip = Math.max(0, D.dip - 0.016 * 5);
      const on = D.on && (v.engine !== false);
      const f = Math.max(14, rpm / 60 * 2);
      const tc = 0.04;
      o1.frequency.setTargetAtTime(f, t, tc); o2.frequency.setTargetAtTime(f / 2, t, tc); o3.frequency.setTargetAtTime(f * 2, t, tc); wob.frequency.setTargetAtTime(f / 2, t, tc);
      const r = Math.min(1, rpm / 6400);
      lp.frequency.setTargetAtTime(340 + load * 2200 + r * 1500 - (D.inside ? 150 : 0), t, 0.06);
      pre.gain.setTargetAtTime(0.45 + load * 1.4, t, 0.06);
      ibp.frequency.setTargetAtTime(250 + r * 1300, t, 0.06);
      ig.gain.setTargetAtTime(on ? (0.02 + load * 0.12) * (0.4 + r) : 0, t, 0.06);
      const catchK = D.catch ? Math.min(1, (D.catch += 0.03)) : 1;
      eng.gain.setTargetAtTime(on ? (0.11 + load * 0.16 + r * 0.06) * (1 - D.dip * 0.6) * (D.inside ? 1.15 : 1) * catchK : 0, t, 0.05);
      const slip = Math.max(0, Math.min(1, v.slip || 0)), sk = Math.pow(slip, 1.5) * Math.min(1, sp / 5);
      sg.gain.setTargetAtTime(sk * 0.22 * (D.inside ? 0.6 : 1), t, 0.05);
      sbp.frequency.setTargetAtTime(950 + slip * 600 + sp * 6, t, 0.08); sqT.frequency.setTargetAtTime(880 + slip * 260, t, 0.08);
      const wet = /wet|puddle/.test(v.surface || "wet");
      rg.gain.setTargetAtTime(Math.min(1, sp / 22) * 0.32, t, 0.1); rlp.frequency.setTargetAtTime(160 + sp * 14, t, 0.1);
      spg.gain.setTargetAtTime((wet ? 1 : 0.15) * Math.min(1, sp / 16) * 0.09 * (D.inside ? 0.4 : 1) * (v.surface === "puddle" ? 2.2 : 1), t, 0.1);
      roofG.gain.setTargetAtTime(D.inside ? 0.16 * rain : 0.025 * rain, t, 0.3);
      if (v.gear !== D.last.gear && D.last.gear != null && v.gear > 0 && D.last.gear > 0) shift(v.gear > D.last.gear);
      D.last = { gear: v.gear }; D.rpm = rpm;
    }
    function shift(up) {
      D.dip = 1;
      tone({ f: up ? 150 : 120, to: 70, glide: 0.04, decay: 0.06, gain: 0.05 * (D.inside ? 1.4 : 0.7), bus: out });
      log("car", "shift");
    }
    /* from inside, the world closes down behind the glass */
    function inside(on) {
      if (D.inside === on) return; D.inside = on;
      const t = now();
      N.outLp.frequency.cancelScheduledValues(t); N.outLp.frequency.setValueAtTime(N.outLp.frequency.value, t);
      N.outLp.frequency.exponentialRampToValueAtTime(on ? 700 : (A.scene === "office" ? N.outLp.frequency.value : 16000), t + 0.35);
      ramp(N.ambDuck.gain, on ? 0.55 : A.duckV < 1 ? Math.max(0.35, A.duckV) : 1, 0.35);
      log("car", on ? "inside" : "outside");
    }
    function impact(k, at) {
      const s = Math.max(0, Math.min(1, k / 9));
      if (s < 0.03) return;
      const ref = at ? 3 : null;
      tone({ f: 95, to: 38, glide: 0.12, decay: 0.18 + s * 0.25, gain: 0.08 + s * 0.4, at, ref });
      burst({ type: "lowpass", f: 900 + s * 1600, gain: 0.05 + s * 0.35, decay: 0.06 + s * 0.12, at, ref, buf: A.brown });
      if (s > 0.25) { sprite("click-metal", { at, ref: 3, gain: 0.15 + s * 0.35, rate: 0.55 + Math.random() * 0.15, lp: 3800 }); burst({ type: "highpass", f: 3000, gain: 0.04 + s * 0.12, decay: 0.12 + s * 0.2, delay: 0.02, at, ref }); }
      if (s > 0.6) sprite("chain-" + ((Math.random() * 3) | 0), { at, ref: 3, gain: 0.2, rate: 0.6, delay: 0.05, lp: 3000 });
      log("car", "impact");
    }
    function door(open, at) {
      if (open) { sprite("latch", { at, ref: 2, gain: 0.32, rate: 1.25 }); burst({ type: "bandpass", f: 500, q: 1.2, gain: 0.05, attack: 0.04, decay: 0.2, delay: 0.05, at }); }
      else { tone({ f: 85, to: 45, glide: 0.08, decay: 0.16, gain: 0.22, at, ref: 2 }); sprite("latch", { at, ref: 2, gain: 0.35, rate: 0.9 }); burst({ type: "lowpass", f: 700, gain: 0.12, decay: 0.08, at, buf: A.brown }); }
      log("car", open ? "door-open" : "door-close");
    }
    function stop(secs = 0.5) {
      inside(false);
      ramp(out.gain, 0, secs); const t = now() + secs + 0.05; srcs.forEach(n => { try { n.stop(t); } catch (e) {} });
      if (A.drv === api) A.drv = null;
      log("car", "stop");
    }
    const api = { start, update, shift, inside, impact, door, stop, get on() { return D.on; }, get state() { return { on: D.on, inside: D.inside, rpm: D.rpm, eng: eng.gain.value, squeal: sg.gain.value, roof: roofG.gain.value, out: N.outLp.frequency.value }; } };
    A.drv = api;
    return api;
  }

  /* the radio: a small speaker's worth of slow chords and a picked line over a little static */
  function radio(at) {
    const C = A.ctx, out = C.createGain(); out.gain.value = 0;
    const bp = C.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1100; bp.Q.value = 0.7;
    const p = panner(at.x, at.y, at.z, 1.4, 1.3, 25); out.connect(bp); bp.connect(p); p.connect(A.nodes.sfx);
    const v = C.createGain(); v.gain.value = 0.25; bp.connect(v); v.connect(A.nodes.verb);
    const hiss = C.createBufferSource(); hiss.buffer = A.pink; hiss.loop = true; const hg = C.createGain(); hg.gain.value = 0.012; hiss.connect(hg); hg.connect(out); hiss.start();
    ramp(out.gain, 1, 0.4);
    const CH = [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 329.6]];
    let next = now() + 0.05, bar = 0, step = 0;
    log("amb", "radio");
    return {
      tick(t) {
        while (next < t + 0.3) {
          const ch = CH[bar % CH.length];
          if (step % 8 === 0) for (const f of ch) tone({ f, decay: 2.4, gain: 0.012, attack: 0.08, wave: "triangle", bus: out, delay: Math.max(0, next - now()) });
          const f = ch[(step * 2) % 3] * (step % 4 === 3 ? 2 : 1);
          tone({ f: f * 2, decay: 0.35, gain: 0.01, wave: "sine", bus: out, delay: Math.max(0, next - now()) });
          next += 0.36; step++; if (step % 8 === 0) bar++;
        }
      },
      stop() { ramp(out.gain, 0, 0.3); try { hiss.stop(now() + 0.4); } catch (e) {} log("amb", "radio-off"); }
    };
  }

  /* ---------- the things you can use anywhere: a sound for each kind ---------- */
  function use(kind, at, on) {
    if (!A.ctx) return;
    const v = { at, ref: 2.2, verb: A.verbAmt };
    switch (kind) {
      case "toggle": sprite("click-metal", { ...v, gain: 0.32, rate: on ? 1.25 : 1.05 }); break;
      case "press": sprite("ui-click", { ...v, gain: 0.3, rate: 0.85, lp: 3500 }); tone({ f: 880, decay: 0.08, gain: 0.012, at }); break;
      case "open": sprite("latch", { ...v, gain: 0.32, rate: 0.95 }); sprite("creak-0", { ...v, gain: 0.18, rate: 0.9, delay: 0.12, lp: 3000 }); break;
      case "sit": cloth(at, 0.9); sprite("creak-1", { ...v, gain: 0.14, rate: 1.4, delay: 0.25, lp: 2500 }); break;
      case "pickup": sprite("keys-0", { ...v, gain: 0.25, rate: 1.2 }); cloth(at, 0.5); break;
      case "read": sprite(pick(["page-0", "page-1", "page-2"]), { ...v, gain: 0.4 }); break;
      // a lost plate: the light clink of thin aluminium lifted off where it lay (a click and the sheet's own
      // short, out-of-tune ring), then the soft chime that says it counted
      case "tag": sprite("click-metal", { ...v, gain: 0.3, rate: 1.55, lp: 7000 }); tone({ f: 1874, partials: [[1, 1], [2.32, 0.55], [3.91, 0.3], [5.73, 0.14]], decay: 0.32, gain: 0.016, at, ref: 2.2 }); tone({ f: 1567.98, partials: [[1, 1], [2.01, 0.22]], decay: 0.8, gain: 0.02, delay: 0.09, bus: A.nodes.ui }); tone({ f: 2349.3, decay: 0.6, gain: 0.011, delay: 0.18, bus: A.nodes.ui }); break;
      case "splash": step("puddle", { at, gain: 1.5, ref: 3 }); burst({ f: 3000, q: 0.6, gain: 0.18, decay: 0.3, at }); break;
      case "knock": for (let i = 0; i < 3; i++) { tone({ f: 140, to: 90, glide: 0.04, decay: 0.07, gain: 0.12, delay: i * 0.17, at, ref: 2 }); burst({ type: "lowpass", f: 900, gain: 0.08, decay: 0.04, delay: i * 0.17, at, buf: A.brown }); } break;
      case "exit": sprite("door-open", { ...v, gain: 0.4, rate: 1.0 }); break;
      case "knock1": tone({ f: 140, to: 90, glide: 0.04, decay: 0.07, gain: 0.12, at, ref: 2 }); burst({ type: "lowpass", f: 900, gain: 0.08, decay: 0.04, at, buf: A.brown }); break;
    }
    log("use", kind);
  }

  /* ---------- the interface ---------- */
  function ui(kind) {
    if (!A.ctx) return false;
    const U = A.nodes.ui;
    switch (kind) {
      case "choice": sprite("ui-select", { bus: U, gain: 0.35, rate: 0.72, lp: 3200, kind: "ui" }); break;
      case "page": sprite(pick(["page-1", "page-2"]), { bus: U, gain: 0.45, rate: rnd(0.95, 1.1), kind: "ui" }); break;
      case "tab": sprite("page-2", { bus: U, gain: 0.25, rate: 1.25, kind: "ui" }); break;
      case "notice": tone({ f: 1318.5, partials: [[1, 1], [1.5, 0.5], [3, 0.12]], decay: 1.4, gain: 0.03, bus: U }); tone({ f: 1975.5, decay: 1.1, gain: 0.016, delay: 0.09, bus: U }); log("ui", "notice"); break;
      case "trophy": tone({ f: 1567.98, partials: [[1, 1], [2.76, 0.3], [5.4, 0.1]], decay: 1.8, gain: 0.025, delay: 0.25, bus: U }); log("ui", "trophy"); break;
      case "land": sprite("ui-drop", { bus: U, gain: 0.12, rate: 0.7, lp: 2600, kind: "ui" }); break;
      case "toggle": sprite("ui-toggle", { bus: U, gain: 0.3, kind: "ui" }); break;
      case "level": sprite("ui-tick", { bus: U, gain: 0.5, kind: "ui" }); break;
      case "open": sprite("ui-click", { bus: U, gain: 0.25, rate: 0.8, lp: 3000, kind: "ui" }); break;
    }
    return true;
  }
  function suspend(on) { if (!A.ctx) return; if (on) A.ctx.suspend().catch(() => {}); else if (soundOn()) A.ctx.resume().catch(() => {}); }
  function stopAll() { if (!A.ctx) return; clearAmb(0.6); A.clockOn = false; }

  return {
    get ctx() { return A.ctx; }, build, sound, setMix, mix, applyMix, duck, veil, voice, listen, update, scene, step, cloth, thing, gate, arriveOffice, ring, ui, suspend, stopAll, drive, use, buzz, heart, scoreLevel, get scoreK() { return scoreK; },
    debug: () => {
      const N = A.nodes;
      return {
        built: !!A.ctx, state: A.ctx ? A.ctx.state : "none", loaded: !!A.buf, scene: A.scene, mix: { ...mix },
        buses: A.ctx ? { master: N.master.gain.value, voice: N.voice.gain.value, sfx: N.sfx.gain.value, amb: N.amb.gain.value, ui: N.ui.gain.value, ambDuck: N.ambDuck.gain.value, sfxDuck: N.sfxDuck.gain.value, out: N.outLp.frequency.value, limiter: N.limit.threshold.value } : null,
        amb: A.amb.filter(n => n.name).map(n => n.name), car: A.drv ? A.drv.state : null, radio: !!A.radio, peak: +(A.peak || 0).toFixed(3), peakMax: +(A.peakMax || 0).toFixed(3), events: A.events.slice(-60)
      };
    }
  };
}
