/* After Hours: The Run. A 2D platformer through my record, on one canvas.

   Six short levels in the order of the record (tools/site/run.json, inlined by
   assemble_home.py as #run-data): Neuroscience, Triple J Auto, Lead to Title,
   The Inbound, Prospector and Obavia (in development, no medals). Each medal is
   a trophy from library.json; picking one up unlocks that same trophy through
   window.JG_GAME.unlock, so the library, the profile and the platinum agree.
   The run is the only place trophies are earned; every medal earns the platinum.
   Lazy: game.js loads this file and game-run.css only when someone presses Play.

   Feel: fixed 120 Hz step, coyote time, jump buffering, variable jump height,
   an apex hang, squash and stretch, dust, a little shake on hard landings
   (none with reduced motion). Choices, arrivals and pickups fire sound, haptic
   and motion in the same frame; skips, cancels and falls make no sound.
   Sound only plays with the score on (score.js); the characters' voices are
   stock Kokoro voices and the characters are fictional. My own lines are text.

   Community (api/run.js): ghosts of recent best runs, boards per level and for
   the whole run, and a real count of tonight's players. All of it is quiet
   and optional; without a store, or with Do Not Track or Global Privacy
   Control, nothing is sent or fetched and the game plays the same.

   window.JG_RUN.open(levelId, how)   .close(how)   .isOpen()
   window.JG_RUN.debug                 hooks for tools/verify/library.mjs */
(function () {
  "use strict";
  if (window.JG_RUN) return;
  var root = document.documentElement, body = document.body;
  var D = null, LIB = null;
  try { D = JSON.parse(document.getElementById("run-data").textContent); } catch (e) {}
  try { LIB = JSON.parse(document.getElementById("library-data").textContent); } catch (e) {}
  if (!D || !LIB) return;

  var TS = D.tile || 32;
  var RM = matchMedia("(prefers-reduced-motion: reduce)");
  var COARSE = matchMedia("(pointer: coarse)");
  var LEVELS = D.levels, BYID = {};
  LEVELS.forEach(function (l, i) { l.n = i; BYID[l.id] = l; });
  var TITLES = {}; LIB.titles.forEach(function (t) { TITLES[t.id] = t; });
  var LINES = {}; (D.lines || []).forEach(function (l) { LINES[l.id] = l; });
  (D.me || []).forEach(function (l) { LINES[l.id] = { id: l.id, who: "me", text: l.text }; });
  var ALL_MEDALS = []; LEVELS.forEach(function (l) { (l.md || []).forEach(function (m) { ALL_MEDALS.push(m[0]); }); });

  /* ---------- small helpers ---------- */
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  function jget(k, d) { try { var v = JSON.parse(store.get(k)); return v == null ? d : v; } catch (e) { return d; } }
  function jset(k, v) { store.set(k, JSON.stringify(v)); }
  function T(e, p) { if (window.JG_TRACK) window.JG_TRACK(e, p || {}); }
  function hap(k) { if (window.JG_HAPTIC) window.JG_HAPTIC(k); }
  function SC() { return window.JG_SCORE; }
  function soundOn() { return !!(SC() && SC().isOn()); }
  function E(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function approach(v, t, d) { return v < t ? Math.min(v + d, t) : Math.max(v - d, t); }
  function still() { return RM.matches; }
  function fmt(ms) {
    if (ms == null || !isFinite(ms)) return "";
    var s = ms / 1000, m = Math.floor(s / 60), r = s - m * 60;
    return m + ":" + (r < 10 ? "0" : "") + r.toFixed(1);
  }
  var PRIVATE = (function () { try { return navigator.globalPrivacyControl === true || navigator.doNotTrack === "1" || window.doNotTrack === "1"; } catch (e) { return false; } })();

  /* ---------- saved progress ---------- */
  var SAVE = jget("jg_run", null) || {};
  SAVE.cleared = SAVE.cleared || {}; SAVE.medals = SAVE.medals || {}; SAVE.best = SAVE.best || {}; SAVE.opts = SAVE.opts || { timer: 1, ghosts: 1 };
  function save() { jset("jg_run", SAVE); }
  var JASON = { me: 1, skin: 0, hair: 0, outfit: 0, glasses: 1 };
  var SKINS = ["#5b3a29", "#3f2a1f", "#7a5136", "#a87a55", "#d6a985", "#efc9a4"];
  var HAIRS = ["Short", "Close crop", "Curls", "Long"];
  var OUTFITS = [["#1c3229", "Bottle"], ["#2a2f2c", "Charcoal"], ["#5f5d57", "Ash"], ["#6b5038", "Camel"], ["#e4ddd0", "Bone"]];
  var CHAR = jget("jg_run_char", null) || JASON;
  function look(c) {
    c = c || CHAR;
    if (c.me) return { skin: SKINS[0], hair: 0, hairC: "#0d0c0b", suit: "#1f3a2e", shirt: "#eeeae2", tie: "#1c3229", glasses: 1, jason: 1 };
    return { skin: SKINS[c.skin] || SKINS[0], hair: c.hair | 0, hairC: "#15110e", suit: (OUTFITS[c.outfit] || OUTFITS[0])[0], shirt: c.outfit === 4 ? "#2a2f2c" : "#eeeae2", tie: c.outfit === 4 ? "#1c3229" : "#e4ddd0", glasses: c.glasses ? 1 : 0 };
  }
  var pid = store.get("jg_pid"); if (!pid) { pid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6); store.set("jg_pid", pid); }

  /* ---------- the DOM ---------- */
  var G = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#';
  var el = document.createElement("div");
  el.id = "run"; el.className = "run"; el.hidden = true;
  el.setAttribute("role", "application");
  el.setAttribute("aria-label", "After Hours: The Run. Arrows or A and D to move, Space to jump, Escape to pause.");
  el.innerHTML =
    '<canvas class="run__cv" aria-hidden="true"></canvas>' +
    '<div class="run__flash" aria-hidden="true"></div>' +
    '<div class="run__hud">' +
      '<div class="run__lvl"><b data-run-name></b><span class="run__socks" data-run-socks></span></div>' +
      '<p class="run__timer" data-run-live data-run-timer></p>' +
      '<div class="run__right">' +
        '<p class="run__crew" data-run-live data-run-crew hidden></p>' +
        '<button class="run__skip" type="button" data-run-cv>' + G + 'g-doc"/></svg><span>Skip to the resume</span></button>' +
        '<button class="run__btn" type="button" data-run-pause aria-label="Pause">' + G + 'g-pause"/></svg></button>' +
      "</div>" +
    "</div>" +
    '<div class="run__card" data-run-card aria-hidden="true"><h2 class="run__logo" data-run-card-h></h2><p class="run__line" data-run-card-p></p></div>' +
    '<p class="run__hint" data-run-hint hidden></p>' +
    '<div class="run__nug" data-run-nug hidden></div>' +
    '<button class="run__cap" type="button" data-run-cap hidden aria-label="Skip this line"><span class="run__who" data-run-who></span><span class="run__said" data-run-said></span></button>' +
    '<div class="run__touch" data-run-touch aria-hidden="true">' +
      '<div class="run__stick" data-run-stick><i></i></div>' +
      '<div class="run__jump" data-run-jumpbtn>' + G + 'g-up"/></svg></div>' +
    "</div>" +
    '<div class="run__turn" data-run-turn hidden><span class="run__phone" aria-hidden="true"><i></i></span><p>Turn your phone sideways for the full view.</p><button class="btn btn--sm btn--ghost" type="button" data-run-upright>Play upright</button></div>' +
    '<div class="run__panel" data-run-panel hidden><div class="run__sheet" data-run-sheet role="dialog" aria-modal="true" aria-labelledby="run-h"></div></div>' +
    '<p class="vh" aria-live="polite" data-run-live-region></p>';
  body.appendChild(el);
  var cv = $(".run__cv", el), ctx = cv.getContext("2d", { alpha: false });
  var panel = $("[data-run-panel]", el), sheet = $("[data-run-sheet]", el), liveR = $("[data-run-live-region]", el);
  function say(t) { if (liveR) liveR.textContent = t; }

  /* ---------- sound: a few tuned blips, only with the score on ---------- */
  var AC = null, NOISE = null;
  function ac() {
    if (!soundOn()) return null;
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (AC.state === "suspended") AC.resume();
    return AC;
  }
  function tone(f, dur, type, gain, slide, delay) {
    var a = ac(); if (!a) return;
    var t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain || 0.05, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function thud(gain) {
    var a = ac(); if (!a) return;
    if (!NOISE) { NOISE = a.createBuffer(1, a.sampleRate * 0.2, a.sampleRate); var d = NOISE.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); }
    var s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = NOISE; f.type = "lowpass"; f.frequency.value = 420; g.gain.value = gain || 0.12;
    s.connect(f); f.connect(g); g.connect(a.destination); s.start();
  }
  var LADDER = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093, 2349.3, 2637], combo = 0, comboT = 0;
  var SFX = {
    jump: function () { tone(330, 0.09, "triangle", 0.035, 470); },
    land: function (v) { thud(Math.min(0.16, v / 6000)); },
    spark: function () { var f = LADDER[Math.min(combo, LADDER.length - 1)]; tone(f, 0.22, "sine", 0.045); tone(f * 2, 0.12, "sine", 0.012); },
    pad: function () { tone(196, 0.24, "sine", 0.07, 588); tone(392, 0.18, "triangle", 0.02, 784); },
    lamp: function () { tone(784, 0.5, "sine", 0.03); tone(1175, 0.6, "sine", 0.02, null, 0.06); },
    medal: function () { [784, 988, 1175, 1568].forEach(function (f, i) { tone(f, 0.9, "sine", 0.04, null, i * 0.03); }); },
    scan: function () { tone(520, 0.35, "sine", 0.04, 1560); tone(1560, 0.4, "sine", 0.02, null, 0.3); },
    build: function () { tone(660, 0.12, "triangle", 0.02); },
    clear: function () { [523.3, 659.3, 784, 1046.5].forEach(function (f, i) { tone(f, 1.1, "sine", 0.04, null, i * 0.09); }); }
  };
  function sting(name) { if (SC() && SC().sting) SC().sting(name); }

  /* ---------- voices: fictional characters, stock voices, captions always ---------- */
  var talkQ = [], talking = null, capEl = $("[data-run-cap]", el), whoEl = $("[data-run-who]", el), saidEl = $("[data-run-said]", el);
  var timings = {}, meVoice = {};
  function speaker(id) { var c = D.cast[id]; return c ? c.name : ""; }
  function queueLine(id) { if (LINES[id]) { talkQ.push(id); if (!talking) nextLine(); } }
  function nextLine() {
    stopLine(true);
    var id = talkQ.shift(); if (!id) return;
    var L = LINES[id], words = L.text.split(" ");
    talking = { id: id, t: 0, words: words, dur: 1.4 + words.length * 0.34, audio: null, voiced: false };
    whoEl.textContent = speaker(L.who); saidEl.innerHTML = words.map(function (w) { return "<i>" + E(w) + "</i> "; }).join("");
    capEl.classList.toggle("is-me", L.who === "me");
    capEl.hidden = false; requestAnimationFrame(function () { capEl.classList.add("is-on"); });
    say(speaker(L.who) + ": " + L.text);
    var base = D.out || "assets/voice/run", file = L.who === "me" ? "jason-" + id : id;
    if (L.who === "me" && soundOn() && meVoice[id] == null) {
      /* my lines play in my own voice once they've been rendered; until then they're captions */
      meVoice[id] = 0;
      fetch(base + "/" + file + ".json").then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (!j) return; meVoice[id] = 1; timings[id] = j.words;
        if (talking && talking.id === id && talking.t < 1.2) voice(base + "/" + file + ".mp3", id);
      }).catch(function () {});
    }
    if ((L.who !== "me" || meVoice[id] === 1) && soundOn()) voice(base + "/" + file + ".mp3", id, L.who !== "me" ? base + "/" + id + ".json" : null);
    else $$("i", saidEl).forEach(function (w) { w.classList.add("is-said"); });
  }
  function voice(src, id, tj) {
    if (!talking) return;
    $$("i", saidEl).forEach(function (w) { w.classList.remove("is-said"); });
    {
      var a = new Audio(); a.preload = "auto"; a.src = src;
      a.volume = 0.95;
      var p = a.play(); if (p && p.catch) p.catch(function () {});
      a.addEventListener("loadedmetadata", function () { if (talking && talking.audio === a && a.duration) talking.dur = a.duration + 0.6; });
      talking.audio = a; talking.voiced = true;
      if (SC() && SC().voice) SC().voice(true);
      talking.t = 0;
      if (!timings[id] && tj) fetch(tj).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j) timings[id] = j.words; }).catch(function () {});
    }
  }
  function stopLine(quiet) {
    if (talking && talking.audio) { try { talking.audio.pause(); } catch (e) {} }
    if (talking && talking.voiced && SC() && SC().voice) SC().voice(false);
    talking = null;
    if (!quiet || !talkQ.length) { capEl.classList.remove("is-on"); setTimeout(function () { if (!talking) capEl.hidden = true; }, 300); }
  }
  function tickLine(dt) {
    if (!talking) return;
    talking.t += dt;
    var a = talking.audio, now = a && !a.paused ? a.currentTime : talking.t;
    var w = timings[talking.id];
    if (talking.voiced && w) { var spans = $$("i", saidEl); for (var i = 0; i < spans.length && i < w.length; i++) spans[i].classList.toggle("is-said", now >= w[i].s - 0.02); }
    else if (talking.voiced && !w) { var sp = $$("i", saidEl), n = Math.floor(sp.length * Math.min(1, now / Math.max(0.5, talking.dur - 0.6))); sp.forEach(function (s, j) { s.classList.toggle("is-said", j < n); }); }
    if (talking.t > talking.dur) { stopLine(); setTimeout(function () { if (!talking) nextLine(); }, 350); }
  }
  /* a tap on the caption skips it, silently */
  capEl.addEventListener("click", function (e) { e.preventDefault(); stopLine(); setTimeout(nextLine, 200); });

  /* ---------- level: data to world ---------- */
  var W = null, PL = null, CAM = { x: 0, y: 0, look: 0 }, PARTS = [], images = {};
  function img(src) { if (images[src]) return images[src]; var i = new Image(); i.decoding = "async"; i.src = src; images[src] = i; return i; }
  function stemOf(id) { var t = TITLES[id]; return (t && t.art) || id; }
  var LOOK_FAKE = { neuro: "shelf", lot: "office", office: "bank", line: "board", field: "ridge", build: "scaffold" };

  function buildWorld(L) {
    var w = {
      L: L, w: L.w * TS, top: (L.top || 0) * TS, bot: (L.bot || 14.8) * TS, theme: L.theme,
      solids: [], ones: [], movers: [], pads: [], lamps: [], sparks: [], medals: [], fakes: [], trigs: [], ghosts: [], doors: [], npcs: [], talks: [], water: [], cars: [],
      groups: {}, goal: null, t: 0, steps: 0, deaths: 0, said: {}, mid: null
    };
    (L.g || []).forEach(function (g) { w.solids.push({ x: g[0] * TS, y: g[2] * TS, w: (g[1] - g[0]) * TS, h: w.bot - g[2] * TS + TS * 6, look: "ground" }); });
    (L.b || []).forEach(function (b) { w.solids.push({ x: b[0] * TS, y: b[1] * TS, w: b[2] * TS, h: b[3] * TS, look: b[4] || "block" }); });
    (L.cab || []).forEach(function (c) { w.solids.push({ x: c[0] * TS, y: c[1] * TS, w: 1.6 * TS, h: c[2] * TS, look: "cab" }); });
    (L.car || []).forEach(function (c) {
      var x = c[0] * TS, gy = (c[2] || 12) * TS, k = c[1];
      var spec = k === "u" ? { w: 4.4, bh: 1.3, c0: 0.6, c1: 3.9, ct: 2.5 } : k === "t" ? { w: 5.4, bh: 1.2, c0: 0.3, c1: 2.1, ct: 2.5 } : { w: 4, bh: 1.1, c0: 1, c1: 3, ct: 2.0 };
      w.cars.push({ x: x, y: gy, k: k, s: spec });
      w.solids.push({ x: x, y: gy - spec.bh * TS, w: spec.w * TS, h: spec.bh * TS, look: "carbody", car: 1 });
      w.solids.push({ x: x + spec.c0 * TS, y: gy - spec.ct * TS, w: (spec.c1 - spec.c0) * TS, h: (spec.ct - spec.bh) * TS, look: "carcab", car: 1 });
    });
    (L.o || []).forEach(function (o) { w.ones.push({ x: o[0] * TS, y: o[1] * TS, w: o[2] * TS, look: o[3] || "plank" }); });
    (L.mv || []).forEach(function (m) { w.movers.push({ x0: m[0] * TS, y0: m[1] * TS, x: m[0] * TS, y: m[1] * TS, px: m[0] * TS, py: m[1] * TS, w: m[2] * TS, dx: m[3] * TS, dy: m[4] * TS, per: m[5], ph: m[6] || 0, look: m[7] || "plank", mover: 1 }); });
    (L.pad || []).forEach(function (p) { w.pads.push({ x: p[0] * TS - 0.75 * TS, y: p[1] * TS - 0.32 * TS, w: 1.5 * TS, k: 0 }); });
    (L.lamp || []).forEach(function (p) { w.lamps.push({ x: p[0] * TS, y: p[1] * TS, lit: false, a: 0 }); });
    (L.sp || []).forEach(function (s) {
      for (var i = 0; i < s[2]; i++) {
        var f = s[2] > 1 ? i / (s[2] - 1) : 0;
        w.sparks.push({ x: (s[0] + s[3] * i) * TS, y: (s[1] + s[4] * i - (s[5] || 0) * 4 * f * (1 - f)) * TS, got: false, ph: Math.random() * 6 });
      }
    });
    (L.md || []).forEach(function (m) {
      var tr = LIB.trophies[m[0]];
      w.medals.push({ slug: m[0], x: m[1] * TS, y: m[2] * TS, where: m[3], tier: tr ? tr.tier : "bronze", got: !!SAVE.medals[m[0]], now: false, img: img("assets/game/medals/" + m[0] + "-80.webp") });
    });
    (L.fake || []).forEach(function (f) {
      var fx = { x: f[0] * TS, y: f[1] * TS, w: f[2] * TS, h: f[3] * TS, rev: 0, look: LOOK_FAKE[L.theme] || "block" };
      w.solids.forEach(function (s) { if (s.look !== "ground" && Math.abs(s.y + s.h - (fx.y + fx.h)) < 2 && (Math.abs(s.x - (fx.x + fx.w)) < 2 || Math.abs(s.x + s.w - fx.x) < 2 || (s.x <= fx.x && s.x + s.w >= fx.x + fx.w))) fx.look = s.look; });
      w.fakes.push(fx);
    });
    (L.trig || []).forEach(function (t) { w.trigs.push({ x: t[0] * TS, y: t[1] * TS, w: t[2] * TS, h: t[3] * TS, g: t[4], look: t[5], on: false, a: 0 }); });
    (L.gh || []).forEach(function (g) { w.ghosts.push({ x: g[0] * TS, y: g[1] * TS, w: g[2] * TS, g: g[3], look: g[4] || "scaffold", on: false, a: 0 }); });
    (L.door || []).forEach(function (d) { w.doors.push({ x: d[0] * TS, y: d[1] * TS, w: 0.7 * TS, h: d[2] * TS, g: d[3], open: 0 }); });
    (L.npc || []).forEach(function (n) { w.npcs.push({ who: n[0], x: n[1] * TS, y: n[2] * TS, face: -1 }); });
    (L.talk || []).forEach(function (t) { w.talks.push({ at: t[0], id: t[1], done: false }); });
    (L.water || []).forEach(function (r) { w.water.push({ x: r[0] * TS, x2: r[1] * TS }); });
    if (L.goal) w.goal = { x: L.goal[0] * TS, y: L.goal[1] * TS, k: L.goal[2], w: 2.2 * TS, h: 3 * TS };
    if (L.caption) w.caption = { x: L.caption[0] * TS, y: L.caption[1] * TS, text: L.caption[2], a: 0 };
    w.mid = midLayer(L);
    return w;
  }

  /* the middle distance: procedural silhouettes per title, seeded so they never shift */
  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function midLayer(L) {
    var r = rng(L.n * 977 + 13), out = [], span = L.w * TS * 0.5 + 1600;
    for (var x = -200; x < span; ) {
      var o = { x: x, r: r(), r2: r(), r3: r() };
      out.push(o);
      x += { neuro: 210, lot: 150, office: 120, line: 260, field: 340, build: 230 }[L.theme] * (0.6 + r() * 0.8);
    }
    return out;
  }

  /* ---------- the player ---------- */
  var P = { w: 18, h: 44, walk: 220, run: 300, accG: 2600, accTurn: 4400, decG: 3000, accA: 1800, decA: 650, v0: 600, gUp: 1550, gCut: 3700, gFall: 2300, apex: 0.55, maxFall: 860, coyote: 0.09, buffer: 0.13, pad: 900 };
  function newPlayer(x, y) {
    return { x: x - P.w / 2, y: y - P.h, vx: 0, vy: 0, ground: true, on: null, face: 1, coyote: 0, buf: 0, sx: 1, sy: 1, run: 0, air: 0, land: 0, blink: 2, dead: 0, cheer: 0, fallV: 0 };
  }

  /* ---------- input ---------- */
  var IN = { x: 0, run: false, jump: false, jumpPress: false, down: false, keys: {}, touchX: 0, touchJump: false, padX: 0, padJump: false, padRun: false, any: false };
  function syncKeys() {
    var k = IN.keys, kx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    IN.x = kx || IN.touchX || IN.padX;
    IN.run = !!k.shift || IN.padRun || Math.abs(IN.touchX) > 0.86;
    IN.jump = !!k.jump || IN.touchJump || IN.padJump;
    IN.down = !!k.down || IN.touchDown;
  }
  var KEYMAP = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", ArrowUp: "jump", w: "jump", W: "jump", " ": "jump", Spacebar: "jump", ArrowDown: "down", s: "down", S: "down", Shift: "shift" };
  addEventListener("keydown", function (e) {
    if (!OPEN) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) { if (e.key === "Escape") t.blur(); return; }
    if (!panel.hidden) { menuKey(e); return; }
    var k = KEYMAP[e.key];
    if (k) { e.preventDefault(); if (k === "jump" && !IN.keys.jump) { IN.jumpPress = true; } IN.keys[k] = true; syncKeys(); firstInput(); return; }
    if (e.key === "Escape" || e.key === "p" || e.key === "P") { e.preventDefault(); pause(true); }
    else if (e.key === "Enter" && talking) { e.preventDefault(); stopLine(); setTimeout(nextLine, 200); }
  });
  addEventListener("keyup", function (e) { if (!OPEN) return; var k = KEYMAP[e.key]; if (k) { IN.keys[k] = false; syncKeys(); } });
  addEventListener("blur", function () { IN.keys = {}; syncKeys(); });

  /* touch: a joystick where the thumb lands on the left, jump anywhere on the right */
  var touch = $("[data-run-touch]", el), stick = $("[data-run-stick]", el), knob = $("i", stick), jumpBtn = $("[data-run-jumpbtn]", el);
  var tStick = null, tJump = {}, R = 52;
  function zoneLeft(x) { return x < innerWidth * 0.46; }
  el.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" || !OPEN || !panel.hidden) return;
    if (e.target.closest("button, a, input, .run__hud, .run__cap, .run__turn")) return;
    e.preventDefault();
    hideTurn();
    if (zoneLeft(e.clientX) && !tStick) {
      tStick = { id: e.pointerId, x: e.clientX, y: e.clientY };
      var r = el.getBoundingClientRect();
      stick.style.transform = "translate(" + (e.clientX - r.left - 60) + "px," + (e.clientY - r.top - 60) + "px)";
      stick.classList.add("is-on"); knob.style.transform = "";
    } else if (!zoneLeft(e.clientX)) {
      tJump[e.pointerId] = 1; IN.touchJump = true; IN.jumpPress = true; jumpBtn.classList.add("is-on");
    }
    try { el.setPointerCapture(e.pointerId); } catch (x) {}
    syncKeys(); firstInput();
  }, { passive: false });
  el.addEventListener("pointermove", function (e) {
    if (!tStick || e.pointerId !== tStick.id) return;
    e.preventDefault();
    var dx = e.clientX - tStick.x, dy = e.clientY - tStick.y, d = Math.hypot(dx, dy), m = Math.min(d, R);
    var nx = d ? dx / d * m : 0, ny = d ? dy / d * m : 0;
    knob.style.transform = "translate(" + nx + "px," + ny + "px)";
    var ax = nx / R; IN.touchX = Math.abs(ax) < 0.18 ? 0 : (ax - Math.sign(ax) * 0.18) / 0.82;
    IN.touchDown = ny / R > 0.7;
    syncKeys();
  }, { passive: false });
  function endTouch(e) {
    if (tStick && e.pointerId === tStick.id) { tStick = null; IN.touchX = 0; IN.touchDown = false; stick.classList.remove("is-on"); knob.style.transform = ""; }
    if (tJump[e.pointerId]) { delete tJump[e.pointerId]; if (!Object.keys(tJump).length) { IN.touchJump = false; jumpBtn.classList.remove("is-on"); } }
    syncKeys();
  }
  el.addEventListener("pointerup", endTouch); el.addEventListener("pointercancel", endTouch);
  el.addEventListener("touchmove", function (e) { if (OPEN && panel.hidden && !e.target.closest(".run__sheet")) e.preventDefault(); }, { passive: false });
  el.addEventListener("gesturestart", function (e) { e.preventDefault(); });
  el.addEventListener("contextmenu", function (e) { if (e.target === cv || e.target.closest(".run__touch")) e.preventDefault(); });

  /* gamepad: the stick or d-pad moves, A jumps, X runs, Start pauses, B backs out of a menu */
  var padPrev = {};
  function pollPad() {
    var gp = (navigator.getGamepads ? navigator.getGamepads() : []);
    gp = gp && [].filter.call(gp, Boolean)[0]; if (!gp) return;
    var b = function (i) { var x = gp.buttons[i]; return !!(x && (x.pressed || x.value > 0.5)); };
    var edge = function (i) { var p = b(i), w = padPrev[i]; padPrev[i] = p; return p && !w; };
    var ax = gp.axes[0] || 0; ax = Math.abs(ax) < 0.2 ? 0 : ax;
    if (!panel.hidden) {
      var ay = gp.axes[1] || 0, dn = b(13) || ay > 0.5, up = b(12) || ay < -0.5;
      if (dn && !padPrev.dn) menuMove(1); if (up && !padPrev.up) menuMove(-1); padPrev.dn = dn; padPrev.up = up;
      if (edge(0)) menuPick(); if (edge(1) || edge(9)) menuBack();
      return;
    }
    IN.padX = b(15) ? 1 : b(14) ? -1 : ax;
    var j = b(0); if (j && !IN.padJump) IN.jumpPress = true; IN.padJump = j;
    IN.padRun = b(2) || b(7);
    if (edge(9)) pause(true);
    if (IN.padX || j) firstInput();
    syncKeys();
  }

  /* ---------- the loop ---------- */
  var OPEN = false, RUNNING = false, raf = 0, last = 0, acc = 0, STEP = 1 / 120;
  var LV = null, levelT = 0, started = false, hitstop = 0, shake = 0, flashA = 0, finished = false;
  var stats = { sparks: 0, total: 0 };
  var dpr = 1, scale = 1, cw = 0, ch = 0, lowPower = false, slowFrames = 0;

  function resize() {
    var r = cv.getBoundingClientRect();
    cw = Math.max(1, r.width); ch = Math.max(1, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 2);
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    var upright = el.classList.contains("is-upright");
    /* a phone on its side sees a little closer, so you stay big under a thumb */
    var touchy = el.classList.contains("is-touch");
    var rows = upright ? 10.5 : touchy ? 11.5 : 13, cols = touchy ? 22 : 26;
    scale = Math.max(ch / (rows * TS), cw / (cols * TS));
  }
  addEventListener("resize", function () { if (OPEN) { orient(); resize(); } });

  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    if (dt > 0.03) { if (++slowFrames > 90 && !lowPower) { lowPower = true; resize(); } } else slowFrames = Math.max(0, slowFrames - 1);
    pollPad();
    if (RUNNING) {
      if (hitstop > 0) { hitstop -= dt; }
      else {
        acc += dt; var n = 0;
        while (acc >= STEP && n++ < 6) { step(STEP); acc -= STEP; }
        if (n >= 6) acc = 0;
      }
      tickLine(dt);
      tickUi(dt);
    }
    render(dt);
  }

  function firstInput() { if (!started && RUNNING) { started = true; } IN.any = true; }

  /* ---------- physics ---------- */
  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function plBox() { return { x: PL.x, y: PL.y, w: P.w, h: P.h }; }
  function solidList() {
    var out = W.solids.slice();
    W.doors.forEach(function (d) { if (d.open < 0.8) out.push({ x: d.x, y: d.y, w: d.w, h: d.h * (1 - d.open), look: "door" }); });
    return out;
  }
  function oneList() {
    var out = W.ones.slice();
    W.ghosts.forEach(function (g) { if (g.on && g.a > 0.3) out.push(g); });
    W.movers.forEach(function (m) { out.push(m); });
    return out;
  }

  function step(dt) {
    W.t += dt; W.steps++;
    if (started && !finished) levelT += dt * 1000;
    /* movers */
    W.movers.forEach(function (m) {
      m.px = m.x; m.py = m.y;
      var f = 0.5 - 0.5 * Math.cos(2 * Math.PI * (W.t / m.per + m.ph));
      m.x = m.x0 + m.dx * f; m.y = m.y0 + m.dy * f;
    });
    if (PL.dead > 0) { PL.dead -= dt; if (PL.dead <= 0) respawn(); return; }
    if (finished) { PL.vx *= 0.9; PL.cheer += dt; physicsY(dt); return; }
    /* carried by a mover */
    if (PL.ground && PL.on && PL.on.mover) { PL.x += PL.on.x - PL.on.px; PL.y += PL.on.y - PL.on.py; }
    /* run */
    var max = IN.run ? P.run : P.walk, tgt = IN.x * max, a;
    if (PL.ground) a = IN.x ? ((tgt > 0) !== (PL.vx > 0) && Math.abs(PL.vx) > 20 ? P.accTurn : P.accG) : P.decG;
    else a = IN.x ? P.accA : P.decA;
    PL.vx = approach(PL.vx, tgt, a * dt);
    if (IN.x) PL.face = IN.x > 0 ? 1 : -1;
    /* jump: buffered and forgiving */
    if (IN.jumpPress) { PL.buf = P.buffer; IN.jumpPress = false; }
    PL.buf -= dt; PL.coyote = PL.ground ? P.coyote : PL.coyote - dt;
    if (PL.buf > 0 && PL.coyote > 0) {
      if (IN.down && PL.on && !PL.on.solid && PL.on !== "solid") { PL.y += 3; PL.drop = 0.2; }
      else { PL.vy = -P.v0; PL.sx = 0.78; PL.sy = 1.24; dust(PL.x + P.w / 2, PL.y + P.h, 5, 0.7); SFX.jump(); if (COARSE.matches) hap("tap"); }
      PL.ground = false; PL.on = null; PL.coyote = 0; PL.buf = 0;
    }
    /* gravity: lighter while held, heavier when let go, a hang at the top */
    var g;
    if (PL.boost > 0) PL.boost -= dt;
    if (PL.vy < 0) g = (IN.jump || PL.boost > 0) ? (PL.vy > -90 ? P.gUp * P.apex : P.gUp) : P.gCut;
    else g = (IN.jump && PL.vy < 90) ? P.gFall * 0.6 : P.gFall;
    PL.vy = Math.min(PL.vy + g * dt, P.maxFall);
    /* x */
    PL.x += PL.vx * dt;
    var sol = solidList();
    for (var i = 0; i < sol.length; i++) {
      var s = sol[i];
      if (overlap(plBox(), s)) {
        if (PL.vx > 0 || (PL.x + P.w / 2) < s.x + s.w / 2) PL.x = s.x - P.w; else PL.x = s.x + s.w;
        PL.vx = 0;
      }
    }
    PL.x = clamp(PL.x, 0, W.w - P.w);
    physicsY(dt, sol);
    /* everything you can touch */
    touchWorld(dt);
    if (PL.y > W.bot + TS * 2) die();
    /* ghost samples, every tenth of a second */
    REC.t += dt; if (REC.t >= 0.1 && started) { REC.t -= 0.1; if (REC.s.length < 1500) REC.s.push([Math.round(PL.x), Math.round(PL.y), PL.face]); }
  }

  function physicsY(dt, sol) {
    sol = sol || solidList();
    var prevB = PL.y + P.h, wasGround = PL.ground;
    PL.y += PL.vy * dt;
    PL.ground = false; var on = null;
    for (var i = 0; i < sol.length; i++) {
      var s = sol[i];
      if (overlap(plBox(), s)) {
        if (PL.vy >= 0 && prevB <= s.y + 12) { PL.y = s.y - P.h; on = "solid"; }
        else if (PL.vy < 0) { PL.y = s.y + s.h; PL.vy = 30; }
        else { PL.y = s.y - P.h; on = "solid"; }
      }
    }
    if (PL.drop > 0) PL.drop -= dt;
    if (PL.vy >= 0 && !(PL.drop > 0)) {
      var ones = oneList();
      for (var j = 0; j < ones.length; j++) {
        var o = ones[j], top = o.y, ptop = o.mover ? o.py : o.y;
        if (PL.x + P.w > o.x + 2 && PL.x < o.x + o.w - 2 && prevB <= ptop + 4 + Math.max(0, o.y - (o.py || o.y)) && PL.y + P.h >= top) { PL.y = top - P.h; on = o; }
      }
    }
    /* synapses: land and they fire */
    if (PL.vy > 0) W.pads.forEach(function (p) {
      var feet = PL.y + P.h, over = PL.x + P.w > p.x + 4 && PL.x < p.x + p.w - 4;
      if (over && ((prevB <= p.y + 10 && feet >= p.y) || (wasGround && prevB >= p.y && prevB <= p.y + 16))) {
        PL.y = p.y - P.h; PL.vy = -P.pad * (IN.jump ? 1.06 : 1); PL.boost = 0.6; PL.sx = 0.7; PL.sy = 1.35; p.k = 1; on = null;
        burst(p.x + p.w / 2, p.y, 14, "bone"); SFX.pad(); hap("tap"); shake = Math.max(shake, still() ? 0 : 2);
      }
    });
    if (on) {
      if (!wasGround && PL.fallV > 380) { PL.sx = 1 + Math.min(0.3, PL.fallV / 2400); PL.sy = 1 - Math.min(0.28, PL.fallV / 2600); dust(PL.x + P.w / 2, PL.y + P.h, PL.fallV > 650 ? 9 : 5, 1); if (PL.fallV > 560) { SFX.land(PL.fallV); if (!still()) shake = Math.max(shake, PL.fallV > 760 ? 4 : 2); } }
      PL.vy = 0; PL.ground = true; PL.on = on;
    }
    if (PL.vy > 0) PL.fallV = PL.vy;
    else if (PL.ground) PL.fallV = 0;
  }

  function touchWorld(dt) {
    var cx = PL.x + P.w / 2, cy = PL.y + P.h / 2, box = plBox();
    /* secret walls give way */
    W.fakes.forEach(function (f) { if (overlap(box, f)) { if (!f.seen) { f.seen = 1; T("game_secret", { level: LV.id }); } f.rev = Math.min(1, f.rev + dt * 4); } });
    /* triggers: the scanner, the pins */
    W.trigs.forEach(function (t) { if (!t.on && overlap(box, t)) activate(t.g, t); });
    /* blueprints build themselves as you come near */
    W.ghosts.forEach(function (g) {
      if (!g.on && g.g === "~" && Math.abs(cx - (g.x + g.w / 2)) < TS * 6.5 && cy > g.y - TS * 7) { g.on = true; if (!still()) SFX.build(); burst(g.x + g.w / 2, g.y, 6, "dim"); }
      if (g.on) g.a = Math.min(1, g.a + dt * 2.4);
    });
    W.doors.forEach(function (d) { if (W.groups[d.g]) d.open = Math.min(1, d.open + dt * 1.6); });
    /* checkpoints */
    W.lamps.forEach(function (l) {
      if (!l.lit && cx > l.x - 8 && Math.abs(PL.y + P.h - l.y) < TS * 5) { l.lit = true; W.check = l; if (W.lamps.indexOf(l) > 0 || l.x > TS * 4) { SFX.lamp(); hap("tap"); burst(l.x, l.y - TS * 3.6, 10, "warm"); } }
      if (l.lit) l.a = Math.min(1, l.a + dt * 2);
    });
    /* sparks: lamplight for the eye, a rising chime */
    comboT -= dt; if (comboT <= 0) combo = 0;
    W.sparks.forEach(function (s) {
      if (s.got) return;
      var dx = cx - s.x, dy = cy - s.y, d = Math.hypot(dx, dy);
      if (d < 64) { s.x += dx * Math.min(1, dt * 7); s.y += dy * Math.min(1, dt * 7); }
      if (Math.abs(cx - s.x) < 18 && Math.abs(cy - s.y) < 28) {
        s.got = true; stats.sparks++; SFX.spark(); combo++; comboT = 0.6; burst(s.x, s.y, 5, "spark");
        if (COARSE.matches && combo % 3 === 1) hap("tap");
      }
    });
    /* medals: the facts */
    W.medals.forEach(function (m) {
      if (m.now) return;
      if (Math.abs(cx - m.x) < 26 && Math.abs(cy - m.y) < 32) collectMedal(m);
    });
    /* who's talking */
    W.talks.forEach(function (t) { if (!t.done && typeof t.at === "number" && cx > t.at * TS) { t.done = true; queueLine(t.id); } });
    /* the goal */
    if (W.goal && !finished && overlap(box, { x: W.goal.x + TS * 0.4, y: W.goal.y - W.goal.h, w: W.goal.w - TS * 0.8, h: W.goal.h })) finish();
    W.pads.forEach(function (p) { p.k = Math.max(0, p.k - dt * 3); });
    if (W.caption && W.groups.scan) W.caption.a = Math.min(1, W.caption.a + dt * 1.5);
  }

  function activate(group, t) {
    if (W.groups[group]) return;
    W.groups[group] = 1; if (t) t.on = true;
    W.ghosts.forEach(function (g) { if (g.g === group) g.on = true; });
    SFX.scan(); hap("select"); flash(still() ? 0.08 : 0.22);
    if (t) burst(t.x + t.w / 2, t.y + t.h / 2, 18, "bone");
    W.talks.forEach(function (k) { if (!k.done && k.at === group) { k.done = true; queueLine(k.id); } });
  }

  function die() {
    if (PL.dead > 0) return;
    PL.dead = 0.55; W.deaths++; fade(1);
  }
  function respawn() {
    var c = W.check || { x: LV.spawn[0] * TS, y: LV.spawn[1] * TS };
    var np = newPlayer(c.x + (W.check ? 18 : 0), c.y);
    np.face = 1; PL = np; CAM.look = 0; fade(0);
  }

  /* ---------- medals ---------- */
  var nugQ = [], nugT = 0, nugEl = $("[data-run-nug]", el);
  function collectMedal(m) {
    m.now = true;
    var first = !m.got && !SAVE.medals[m.slug];
    var cx = m.x, cy = m.y;
    if (!first) { burst(cx, cy, 8, "dim"); SFX.spark(); m.got = true; return; }
    m.got = true; SAVE.medals[m.slug] = 1; save();
    var tr = LIB.trophies[m.slug] || { name: m.slug, desc: "", tier: "bronze" };
    /* the same frame: the haptic, the sound, the flash, the burst, the flight to the HUD */
    hap("success"); SFX.medal(); sting("trophy-" + tr.tier);
    flash(still() ? 0.12 : 0.34); if (!still()) { hitstop = 0.09; shake = Math.max(shake, 3); }
    burst(cx, cy, 26, tr.tier);
    fly(m);
    if (window.JG_GAME && window.JG_GAME.unlock) window.JG_GAME.unlock(m.slug, "run");
    T("game_medal", { trophy: m.slug, tier: tr.tier, level: LV.id, where: m.where });
    nugQ.push(m.slug); if (nugT <= 0) showNug();
    paintSocks();
    /* every medal (or its trophy, earned before the run gave them out) earns the platinum, once */
    if (!SAVE.platinum && store.get("jg_platinum") !== "1" && ALL_MEDALS.every(function (s) { return SAVE.medals[s] || libSeen(s); })) { SAVE.platinum = 1; save(); platinumNow = true; if (window.JG_GAME && window.JG_GAME.unlock) window.JG_GAME.unlock(LIB.platinum, "run"); T("game_platinum", { level: LV.id }); }
  }
  var platinumNow = false;
  function libSeen(s) { try { return JSON.parse(store.get("jg_trophies") || "[]").indexOf(s) >= 0; } catch (e) { return false; } }
  function toScreen(x, y) { return { x: (x - CAM.x) * scale, y: (y - CAM.y) * scale }; }
  function fly(m) {
    var s = toScreen(m.x, m.y), sock = $('[data-sock="' + m.slug + '"]', el), r = el.getBoundingClientRect(), cr = cv.getBoundingClientRect();
    if (!sock) return;
    var t = sock.getBoundingClientRect();
    var im = document.createElement("img"); im.className = "run__fly"; im.alt = ""; im.src = "assets/game/medals/" + m.slug + "-80.webp";
    im.style.left = (cr.left - r.left + s.x - 24) + "px"; im.style.top = (cr.top - r.top + s.y - 24) + "px";
    el.appendChild(im);
    var dx = t.left + t.width / 2 - (cr.left + s.x), dy = t.top + t.height / 2 - (cr.top + s.y);
    if (im.animate && !still()) {
      im.animate([{ transform: "translate(0,0) scale(1.5)", opacity: 1 }, { transform: "translate(" + dx * 0.3 + "px," + (dy * 0.3 - 60) + "px) scale(1.8)", opacity: 1, offset: 0.35 }, { transform: "translate(" + dx + "px," + dy + "px) scale(0.5)", opacity: 0.9 }], { duration: 760, easing: "cubic-bezier(0.2, 0.7, 0.1, 1)" }).onfinish = function () { im.remove(); sock.classList.add("is-got", "is-new"); setTimeout(function () { sock.classList.remove("is-new"); }, 900); };
    } else { im.remove(); sock.classList.add("is-got"); }
  }
  function showNug() {
    var slug = nugQ.shift(); el.classList.toggle("has-nug", !!slug); if (!slug) { nugEl.classList.remove("is-on"); setTimeout(function () { if (nugT <= 0) nugEl.hidden = true; }, 400); return; }
    var tr = LIB.trophies[slug];
    nugEl.className = "run__nug run__nug--" + tr.tier;
    nugEl.innerHTML = '<span class="run__nugm"><img src="assets/game/medals/' + slug + '-160.webp" alt="" width="58" height="58" /><img class="run__sheen" src="assets/game/medals/sheen.webp" alt="" /></span><span><b>' + E(tr.name) + "<small>" + E(tier(tr.tier)) + " trophy</small></b><span>" + E(tr.desc) + "</span></span>";
    nugEl.hidden = false; requestAnimationFrame(function () { nugEl.classList.add("is-on"); });
    say(tier(tr.tier) + " trophy. " + tr.name + ". " + tr.desc);
    nugT = 4.4;
  }
  function tier(t) { return { bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Platinum" }[t] || t; }

  /* ---------- particles ---------- */
  var TIERC = { bronze: "#c08a5c", silver: "#d4d6d8", gold: "#e0c58c", platinum: "#eef0f2", bone: "#ede7db", warm: "#f2d9a6", spark: "#f6e7c4", dim: "rgba(237,231,219,0.5)" };
  function dust(x, y, n, k) {
    for (var i = 0; i < n; i++) PARTS.push({ x: x + (Math.random() - 0.5) * 14, y: y - 2, vx: (Math.random() - 0.5) * 140 * k, vy: -Math.random() * 60 * k, life: 0, max: 0.35 + Math.random() * 0.25, r: 2 + Math.random() * 3, kind: "dust" });
  }
  function burst(x, y, n, c) {
    for (var i = 0; i < n; i++) { var a = (i / n) * Math.PI * 2 + Math.random() * 0.4, v = 90 + Math.random() * 220; PARTS.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0, max: 0.45 + Math.random() * 0.4, r: 1.2 + Math.random() * 1.8, kind: "spark", c: TIERC[c] || c }); }
    if (n > 12) PARTS.push({ x: x, y: y, life: 0, max: 0.5, r: 6, kind: "ring", c: TIERC[c] || c });
  }
  function confetti() {
    var cs = [TIERC.gold, TIERC.silver, TIERC.platinum, TIERC.bronze, TIERC.bone];
    for (var i = 0; i < (still() ? 30 : 120); i++) PARTS.push({ x: CAM.x + Math.random() * cw / scale, y: CAM.y - 20 - Math.random() * 200, vx: (Math.random() - 0.5) * 60, vy: 60 + Math.random() * 120, life: 0, max: 3 + Math.random() * 2, r: 3 + Math.random() * 3, kind: "conf", c: cs[i % cs.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10 });
  }
  function tickParts(dt) {
    for (var i = PARTS.length - 1; i >= 0; i--) {
      var p = PARTS[i]; p.life += dt;
      if (p.life >= p.max) { PARTS.splice(i, 1); continue; }
      if (p.kind === "dust") { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; }
      else if (p.kind === "spark") { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.vx *= 0.97; }
      else if (p.kind === "conf") { p.x += p.vx * dt + Math.sin(p.life * 3 + i) * 0.6; p.y += p.vy * dt; p.rot += p.vr * dt; }
    }
  }

  /* ---------- the flash and the fade ---------- */
  var flashEl = $(".run__flash", el), fadeA = 0, fadeTo = 0;
  function flash(a) { flashA = Math.max(flashA, a); }
  function fade(to) { fadeTo = to; }

  /* ---------- rendering ---------- */
  var BONE = "rgba(237,231,219,", INK = "#0a0f0d", LAC = "#111b17";
  var glowC = null;
  function glowSprite() {
    if (glowC) return glowC;
    glowC = document.createElement("canvas"); glowC.width = glowC.height = 128;
    var g = glowC.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(246,222,170,0.85)"); gr.addColorStop(0.25, "rgba(240,206,150,0.32)"); gr.addColorStop(1, "rgba(240,206,150,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return glowC;
  }
  function glow(x, y, r, a) { if (a <= 0) return; ctx.globalAlpha = a; ctx.drawImage(glowSprite(), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; }
  var rain = [];
  function seedRain() {
    rain = []; var n = lowPower ? 50 : COARSE.matches ? 80 : 130;
    for (var i = 0; i < n; i++) rain.push({ x: Math.random(), y: Math.random(), z: 0.4 + Math.random() * 0.6 });
  }

  function render(dt) {
    if (!W) return;
    tickParts(RUNNING ? dt : 0);
    var vw = cw / scale, vh = ch / scale;
    /* camera */
    if (PL && RUNNING) {
      CAM.look = lerp(CAM.look, PL.face * 70 + PL.vx * 0.18, 1 - Math.exp(-dt * 2.6));
      var tx = PL.x + P.w / 2 + CAM.look - vw * 0.45;
      var ty = PL.y + P.h - vh * 0.64;
      CAM.x = lerp(CAM.x, tx, 1 - Math.exp(-dt * 7));
      var fy = PL.ground || PL.vy > 300 || PL.y < CAM.y + vh * 0.2 ? 5 : 1.6;
      CAM.y = lerp(CAM.y, ty, 1 - Math.exp(-dt * fy));
    }
    CAM.x = clamp(CAM.x, 0, Math.max(0, W.w - vw));
    var minY = W.top - TS * 2, maxY = W.bot - vh;
    CAM.y = maxY < minY ? maxY : clamp(CAM.y, minY, maxY);
    shake = Math.max(0, shake - dt * 18);
    var sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    background(vw, vh);
    /* the middle distance, at a third of the speed */
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -Math.round(CAM.x * 0.35 * scale * dpr) / 1, -Math.round((CAM.y * 0.5 - (W.bot - vh) * 0.5) * scale * dpr) / 1);
    mid(vw, vh);
    /* the world */
    var ox = Math.round((-CAM.x + sx) * scale * dpr), oy = Math.round((-CAM.y + sy) * scale * dpr);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, ox, oy);
    world(vw, vh);
    /* screen space: rain, vignette */
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    weather(dt);
    vignette();
    /* flash and fade in the DOM */
    flashA = Math.max(0, flashA - dt * 2.4);
    fadeA = approach(fadeA, fadeTo, dt * 3.4);
    flashEl.style.background = fadeA > flashA ? "rgba(10,15,13," + fadeA.toFixed(3) + ")" : "rgba(246,240,228," + flashA.toFixed(3) + ")";
  }

  function background(vw, vh) {
    ctx.fillStyle = INK; ctx.fillRect(0, 0, cw, ch);
    var im = W.plate;
    if (im && im.complete && im.naturalWidth) {
      var ih = ch * 1.08, iw = ih * im.naturalWidth / im.naturalHeight;
      if (iw < cw * 1.3) { iw = cw * 1.3; ih = iw * im.naturalHeight / im.naturalWidth; }
      var p = W.w > vw ? CAM.x / (W.w - vw) : 0;
      var x = -(iw - cw) * p, y = (ch - ih) * 0.55 - (CAM.y - (W.bot - vh)) * 0.08 * scale;
      ctx.globalAlpha = W.plateA = Math.min(1, (W.plateA || 0) + 0.04);
      ctx.drawImage(im, x, y, iw, ih);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "rgba(10,15,13,0.5)"; ctx.fillRect(0, 0, cw, ch);
    var gr = ctx.createLinearGradient(0, 0, 0, ch);
    gr.addColorStop(0, "rgba(10,15,13,0.55)"); gr.addColorStop(0.45, "rgba(10,15,13,0.05)"); gr.addColorStop(1, "rgba(10,15,13,0.7)");
    ctx.fillStyle = gr; ctx.fillRect(0, 0, cw, ch);
  }

  function vignette() {
    var gr = ctx.createRadialGradient(cw / 2, ch * 0.55, Math.min(cw, ch) * 0.35, cw / 2, ch * 0.55, Math.max(cw, ch) * 0.8);
    gr.addColorStop(0, "rgba(10,15,13,0)"); gr.addColorStop(1, "rgba(6,9,8,0.55)");
    ctx.fillStyle = gr; ctx.fillRect(0, 0, cw, ch);
  }

  function weather(dt) {
    var kind = W.L.rain || "rain";
    if (!rain.length) seedRain();
    var sp = still() ? 0.35 : 1;
    ctx.lineCap = "round";
    for (var i = 0; i < rain.length; i++) {
      var r = rain[i];
      if (kind === "rain") {
        r.y += dt * (1.1 + r.z) * sp; r.x -= dt * 0.12 * r.z * sp + (RUNNING && PL ? PL.vx * 0.00004 : 0);
        if (r.y > 1.05) { r.y = -0.05; r.x = Math.random() * 1.1; }
        if (r.x < -0.05) r.x += 1.1;
        var x = r.x * cw, y = r.y * ch, l = 10 + r.z * 14;
        ctx.strokeStyle = BONE + (0.06 + r.z * 0.12) + ")"; ctx.lineWidth = r.z * 1.2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - l * 0.18, y + l); ctx.stroke();
      } else {
        r.y -= dt * 0.015 * r.z * sp; r.x += Math.sin(W.t * 0.6 + i) * 0.0004 * sp;
        if (r.y < -0.05) { r.y = 1.05; r.x = Math.random(); }
        ctx.fillStyle = (kind === "motes" ? "rgba(246,222,170," : BONE) + (0.08 + r.z * 0.16) * (0.6 + 0.4 * Math.sin(W.t * 2 + i)) + ")";
        ctx.beginPath(); ctx.arc(r.x * cw, r.y * ch, r.z * 1.6, 0, 7); ctx.fill();
      }
    }
  }

  /* the middle distance per title */
  function mid(vw, vh) {
    var th = W.theme, base = W.bot - TS * 3.4, x0 = CAM.x * 0.35 - 200, x1 = x0 + vw + 400;
    ctx.lineWidth = 1.2;
    W.mid.forEach(function (o) {
      if (o.x < x0 - 300 || o.x > x1) return;
      var x = o.x, h;
      ctx.strokeStyle = BONE + "0.075)"; ctx.fillStyle = "rgba(13,20,17,0.5)";
      if (th === "lot") {
        if (o.r < 0.35) { /* a palm */ h = 170 + o.r2 * 90; ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x - 8, base - h * 0.5, x + 4, base - h); ctx.stroke(); for (var k = 0; k < 6; k++) { var a = -Math.PI / 2 + (k - 2.5) * 0.55; ctx.beginPath(); ctx.moveTo(x + 4, base - h); ctx.quadraticCurveTo(x + 4 + Math.cos(a) * 26, base - h + Math.sin(a) * 18 - 6, x + 4 + Math.cos(a) * 46, base - h + Math.sin(a) * 18 + 16); ctx.stroke(); } }
        else if (o.r < 0.62) { /* a lamp */ h = 200 + o.r2 * 60; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base - h); ctx.moveTo(x - 16, base - h); ctx.lineTo(x + 16, base - h); ctx.stroke(); glow(x, base - h + 4, 46, 0.35); }
        else { /* a row of parked cars */ for (var c = 0; c < 3; c++) { var cx = x + c * 70; ctx.beginPath(); ctx.moveTo(cx, base); ctx.lineTo(cx, base - 18); ctx.quadraticCurveTo(cx + 12, base - 34, cx + 26, base - 34); ctx.lineTo(cx + 42, base - 34); ctx.quadraticCurveTo(cx + 54, base - 30, cx + 60, base - 18); ctx.lineTo(cx + 60, base); ctx.closePath(); ctx.fill(); ctx.stroke(); } }
      } else if (th === "neuro") {
        if (o.r < 0.5) { /* an arched window */ var aw = 70 + o.r2 * 30, ah = 190 + o.r3 * 60, ay = base - 60; ctx.beginPath(); ctx.moveTo(x, ay); ctx.lineTo(x, ay - ah + aw / 2); ctx.arc(x + aw / 2, ay - ah + aw / 2, aw / 2, Math.PI, 0); ctx.lineTo(x + aw, ay); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + aw / 2, ay); ctx.lineTo(x + aw / 2, ay - ah); ctx.moveTo(x, ay - ah * 0.45); ctx.lineTo(x + aw, ay - ah * 0.45); ctx.stroke(); }
        else { /* a neuron */ var ny = base - 120 - o.r2 * 120; ctx.beginPath(); ctx.arc(x, ny, 7, 0, 7); ctx.stroke(); for (var d = 0; d < 6; d++) { var an = d * 1.05 + o.r3, len = 30 + (d % 3) * 18; ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * 7, ny + Math.sin(an) * 7); ctx.quadraticCurveTo(x + Math.cos(an + 0.3) * len * 0.6, ny + Math.sin(an + 0.3) * len * 0.6, x + Math.cos(an) * len, ny + Math.sin(an) * len); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(x + 7, ny); ctx.bezierCurveTo(x + 60, ny + 10, x + 80, ny + 60, x + 140, ny + 70); ctx.stroke(); }
      } else if (th === "office") {
        h = 120 + o.r * 140; var bw = 60 + o.r2 * 30; ctx.fillRect(x, base - h, bw, h); ctx.strokeRect(x, base - h, bw, h);
        for (var r = 1; r < h / 28; r++) { ctx.beginPath(); ctx.moveTo(x, base - h + r * 28); ctx.lineTo(x + bw, base - h + r * 28); ctx.stroke(); ctx.beginPath(); ctx.arc(x + bw / 2, base - h + r * 28 - 14, 2, 0, 7); ctx.stroke(); }
        if (o.r3 < 0.3) glow(x + bw / 2, base - h - 20, 60, 0.4);
      } else if (th === "line") {
        h = 230 + o.r * 40; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base - h); ctx.moveTo(x - 20, base - h + 12); ctx.lineTo(x + 20, base - h + 12); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 20, base - h + 12); ctx.quadraticCurveTo(x - 140, base - h + 50, x - 260, base - h + 12); ctx.moveTo(x + 20, base - h + 12); ctx.quadraticCurveTo(x + 120, base - h + 44, x + 240, base - h + 12); ctx.stroke();
        if (o.r2 < 0.5) { var bh = 80 + o.r3 * 120; ctx.fillRect(x + 40, base - bh, 70, bh); ctx.strokeRect(x + 40, base - bh, 70, bh); for (var wy = base - bh + 14; wy < base - 10; wy += 22) for (var wx = x + 50; wx < x + 104; wx += 18) { if ((wx * 7 + wy) % 5 < 2) { ctx.fillStyle = "rgba(240,206,150,0.14)"; ctx.fillRect(wx, wy, 8, 10); ctx.fillStyle = "rgba(13,20,17,0.5)"; } } }
      } else if (th === "field") {
        ctx.beginPath(); for (var k2 = 0; k2 < 4; k2++) { var yy = base - 40 - k2 * 34 - o.r * 30; ctx.moveTo(x - 160, yy + 30); ctx.bezierCurveTo(x - 60, yy - 30 - o.r2 * 30, x + 60, yy - 30, x + 180, yy + 30); } ctx.stroke();
        if (o.r3 < 0.4) { var py = base - 150 - o.r2 * 50; ctx.beginPath(); ctx.moveTo(x, py + 18); ctx.bezierCurveTo(x - 10, py + 6, x - 10, py - 8, x, py - 8); ctx.bezierCurveTo(x + 10, py - 8, x + 10, py + 6, x, py + 18); ctx.stroke(); glow(x, py, 26, 0.3); }
      } else if (th === "build") {
        h = 160 + o.r * 160; var tw = 50 + o.r2 * 30;
        ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base - h); ctx.moveTo(x + tw, base); ctx.lineTo(x + tw, base - h);
        for (var yb = base; yb > base - h + 1; yb -= 40) { ctx.moveTo(x, yb); ctx.lineTo(x + tw, yb - 40); ctx.moveTo(x, yb - 40); ctx.lineTo(x + tw, yb); ctx.moveTo(x, yb); ctx.lineTo(x + tw, yb); }
        ctx.stroke();
        if (o.r3 < 0.25) { ctx.beginPath(); ctx.moveTo(x + tw / 2, base - h); ctx.lineTo(x + tw / 2, base - h - 80); ctx.lineTo(x + tw / 2 + 180, base - h - 80); ctx.moveTo(x + tw / 2 + 150, base - h - 80); ctx.lineTo(x + tw / 2 + 150, base - h - 20); ctx.stroke(); }
      }
    });
  }

  /* ---------- the world ---------- */
  function vis(x, w, pad) { var vw = cw / scale; return x + w > CAM.x - (pad || 40) && x < CAM.x + vw + (pad || 40); }
  function stroke(a, w) { ctx.strokeStyle = BONE + a + ")"; ctx.lineWidth = w || 1.4; }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }

  function world(vw, vh) {
    var t = W.t;
    /* lamp glow first, behind everything */
    W.lamps.forEach(function (l) { if (vis(l.x, 0, 200)) { var lh = TS * 3.6; glow(l.x, l.y - lh + 6, 120, 0.22 + l.a * 0.4); glow(l.x, l.y, 90, 0.12 + l.a * 0.2); } });
    if (W.goal && vis(W.goal.x - 200, 600)) glow(W.goal.x + W.goal.w / 2, W.goal.y - W.goal.h * 0.5, 170, 0.45 + 0.05 * Math.sin(t * 2));
    /* water */
    W.water.forEach(function (w) {
      if (!vis(w.x, w.x2 - w.x)) return;
      var y = 12.35 * TS;
      ctx.fillStyle = "#070b09"; ctx.fillRect(w.x, y, w.x2 - w.x, W.bot - y + TS * 4);
      stroke(0.22, 1); ctx.beginPath();
      for (var x = w.x; x < w.x2; x += 6) ctx.lineTo(x, y + Math.sin(x * 0.08 + t * 2.4) * 1.4);
      ctx.stroke();
      ctx.strokeStyle = "rgba(240,206,150,0.16)";
      for (var k = 0; k < 4; k++) { var rx = w.x + (w.x2 - w.x) * (0.2 + k * 0.2); ctx.beginPath(); ctx.moveTo(rx, y + 6 + k * 3); ctx.lineTo(rx + 10 + Math.sin(t * 3 + k) * 4, y + 6 + k * 3); ctx.stroke(); }
    });
    /* poles under wires */
    W.ones.forEach(function (o) { if (o.look === "wire" && vis(o.x, o.w, 80)) { stroke(0.28, 2); ctx.beginPath(); ctx.moveTo(o.x, o.y - 10); ctx.lineTo(o.x, W.bot); ctx.moveTo(o.x + o.w, o.y - 10); ctx.lineTo(o.x + o.w, W.bot); ctx.moveTo(o.x - 9, o.y - 6); ctx.lineTo(o.x + 9, o.y - 6); ctx.moveTo(o.x + o.w - 9, o.y - 6); ctx.lineTo(o.x + o.w + 9, o.y - 6); ctx.stroke(); } });
    if (W.theme === "lot") W.ones.forEach(function (o) { if (o.look === "lampbar" && vis(o.x, o.w, 80)) { stroke(0.32, 2.4); ctx.beginPath(); ctx.moveTo(o.x + o.w / 2, o.y); ctx.lineTo(o.x + o.w / 2, 12 * TS); ctx.stroke(); glow(o.x + 8, o.y + 8, 70, 0.5); glow(o.x + o.w - 8, o.y + 8, 70, 0.5); } });
    /* goal behind the player */
    if (W.goal) drawGoal(W.goal, t);
    /* lamps (checkpoints) */
    W.lamps.forEach(function (l) { if (vis(l.x, 0)) drawLamp(l, t); });
    /* solids */
    W.solids.forEach(function (s) { if (!s.car && vis(s.x, s.w)) drawSolid(s, t); });
    W.cars.forEach(function (c) { if (vis(c.x, c.s.w * TS)) drawCar(c, t); });
    /* sparks */
    W.sparks.forEach(function (s) {
      if (s.got || !vis(s.x, 0)) return;
      var b = 0.7 + 0.3 * Math.sin(t * 4 + s.ph), y = s.y + Math.sin(t * 2.2 + s.ph) * 2;
      glow(s.x, y, 16, 0.5 * b);
      if (W.theme === "lot") drawKey(s.x, y, t + s.ph);
      else if (W.theme === "field") { ctx.fillStyle = "#f2d9a6"; ctx.beginPath(); ctx.moveTo(s.x, y + 6); ctx.bezierCurveTo(s.x - 5, y + 1, s.x - 5, y - 5, s.x, y - 5); ctx.bezierCurveTo(s.x + 5, y - 5, s.x + 5, y + 1, s.x, y + 6); ctx.fill(); }
      else { ctx.fillStyle = "#f6e7c4"; ctx.save(); ctx.translate(s.x, y); ctx.rotate(t * 1.4 + s.ph); ctx.beginPath(); ctx.moveTo(0, -4.5); ctx.lineTo(1.3, -1.3); ctx.lineTo(4.5, 0); ctx.lineTo(1.3, 1.3); ctx.lineTo(0, 4.5); ctx.lineTo(-1.3, 1.3); ctx.lineTo(-4.5, 0); ctx.lineTo(-1.3, -1.3); ctx.closePath(); ctx.fill(); ctx.restore(); }
    });
    /* medals: a turning coin in its tier's glow; one you already have is a ghost */
    W.medals.forEach(function (m) {
      if (m.now || !vis(m.x, 0)) return;
      var y = m.y + Math.sin(t * 2 + m.x) * 3, k = Math.cos(t * 2.2 + m.x * 0.01), r = 15;
      if (m.got) ctx.globalAlpha = 0.28;
      else glow(m.x, y, 46, 0.55 + 0.15 * Math.sin(t * 3));
      ctx.save(); ctx.translate(m.x, y); ctx.scale(Math.max(0.12, Math.abs(k)), 1);
      if (m.img.complete && m.img.naturalWidth) ctx.drawImage(m.img, -r, -r, r * 2, r * 2);
      else { ctx.fillStyle = TIERC[m.tier]; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); }
      ctx.restore(); ctx.globalAlpha = 1;
    });
    W.fakes.forEach(function (f) { if (vis(f.x, f.w)) { ctx.globalAlpha = 1 - f.rev * 0.82; drawSolid({ x: f.x, y: f.y, w: f.w, h: f.h, look: f.look, fake: 1 }, t); ctx.globalAlpha = 1; if (W.hintFake === f && !f.rev) shimmer(f, t); } });
    W.doors.forEach(function (d) { if (vis(d.x, d.w)) drawDoor(d, t); });
    W.trigs.forEach(function (tr) { if (vis(tr.x, tr.w)) drawTrig(tr, t); });
    W.ones.forEach(function (o) { if (vis(o.x, o.w)) drawOne(o, t); });
    W.ghosts.forEach(function (g) { if (vis(g.x, g.w)) drawGhost(g, t); });
    W.movers.forEach(function (m) { if (vis(Math.min(m.x0, m.x0 + m.dx), m.w + Math.abs(m.dx), 60)) drawMover(m, t); });
    W.pads.forEach(function (p) { if (vis(p.x, p.w)) drawPad(p, t); });
    if (W.caption && W.caption.a > 0) { ctx.globalAlpha = W.caption.a; ctx.fillStyle = "#ede7db"; ctx.font = "500 13px 'Hanken Grotesk', system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText(W.caption.text, W.caption.x + 120, W.caption.y); ctx.textAlign = "left"; ctx.globalAlpha = 1; }
    /* the people in it */
    W.npcs.forEach(function (n) { if (vis(n.x, 0)) drawNpc(n, t); });
    /* other players' ghosts, faint and lamplit */
    drawGhostRuns();
    /* you */
    if (PL) drawPlayer(t);
    /* particles */
    PARTS.forEach(function (p) {
      var k = 1 - p.life / p.max;
      if (p.kind === "dust") { ctx.fillStyle = "rgba(154,152,144," + (0.35 * k) + ")"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.6 - k * 0.6), 0, 7); ctx.fill(); }
      else if (p.kind === "spark") { ctx.fillStyle = p.c; ctx.globalAlpha = k; ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); ctx.globalAlpha = 1; }
      else if (p.kind === "ring") { ctx.strokeStyle = p.c; ctx.globalAlpha = k; ctx.lineWidth = 2 * k + 0.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + (1 - k) * 60, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
      else if (p.kind === "conf") { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.globalAlpha = Math.min(1, k * 2); ctx.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8); ctx.restore(); ctx.globalAlpha = 1; }
    });
  }

  function shimmer(f, t) {
    var y = f.y + ((t * 0.8) % 1) * f.h;
    ctx.save(); ctx.beginPath(); ctx.rect(f.x, f.y, f.w, f.h); ctx.clip();
    var g = ctx.createLinearGradient(0, y - 20, 0, y + 20); g.addColorStop(0, "rgba(246,231,196,0)"); g.addColorStop(0.5, "rgba(246,231,196,0.28)"); g.addColorStop(1, "rgba(246,231,196,0)");
    ctx.fillStyle = g; ctx.fillRect(f.x, y - 20, f.w, 40); ctx.restore();
  }

  function drawSolid(s, t) {
    var x = s.x, y = s.y, w = s.w, h = s.h, L = s.look;
    if (L === "ground") {
      var th = W.theme;
      ctx.fillStyle = th === "lot" ? "#0b100e" : th === "field" ? "#0c120e" : th === "neuro" ? "#100f0c" : "#0b110e";
      ctx.fillRect(x, y, w, h);
      stroke(0.5, 1.4); ctx.beginPath(); ctx.moveTo(x, y + 0.7); ctx.lineTo(x + w, y + 0.7); ctx.stroke();
      stroke(0.12, 1); ctx.beginPath(); ctx.moveTo(x, y + 7); ctx.lineTo(x + w, y + 7); ctx.stroke();
      if (th === "lot") { stroke(0.16, 1.4); for (var px = Math.ceil(x / 128) * 128; px < x + w - 4; px += 128) { ctx.beginPath(); ctx.moveTo(px, y + 10); ctx.lineTo(px + 14, y + 26); ctx.stroke(); } }
      else if (th === "office") { stroke(0.08, 1); for (var qx = Math.ceil(x / 64) * 64; qx < x + w; qx += 64) { ctx.beginPath(); ctx.moveTo(qx, y + 7); ctx.lineTo(qx, y + 40); ctx.stroke(); } }
      else if (th === "field") { stroke(0.2, 1); for (var gx = Math.ceil(x / 22) * 22; gx < x + w; gx += 22) { var gh = 4 + ((gx * 13) % 5); ctx.beginPath(); ctx.moveTo(gx, y + 1); ctx.lineTo(gx - 2, y - gh); ctx.stroke(); } }
      else if (th === "neuro") { stroke(0.1, 1); ctx.beginPath(); for (var nx = x; nx < x + w; nx += 8) ctx.lineTo(nx, y + 18 + Math.sin(nx * 0.05) * 3); ctx.stroke(); }
      else if (th === "build") { stroke(0.12, 1); for (var bx = Math.ceil(x / 96) * 96; bx < x + w; bx += 96) { ctx.strokeRect(bx + 4, y + 12, 88, 26); } }
      else if (th === "line") { stroke(0.1, 1); ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.moveTo(x, y + 20); ctx.lineTo(x + w, y + 20); ctx.stroke(); ctx.setLineDash([]); }
      return;
    }
    if (L === "books") {
      ctx.fillStyle = "#15130f"; ctx.fillRect(x, y, w, h);
      var bh = 9, row = 0;
      for (var by = y; by < y + h - 1; by += bh, row++) { stroke(0.3, 1); ctx.strokeRect(x + (row % 2 ? 3 : 0), by, w - 3, bh); stroke(0.14, 1); ctx.beginPath(); ctx.moveTo(x + w * 0.2 + (row % 2) * 4, by + 2); ctx.lineTo(x + w * 0.2 + (row % 2) * 4, by + bh - 2); ctx.stroke(); }
      stroke(0.5, 1.4); ctx.beginPath(); ctx.moveTo(x, y + 0.7); ctx.lineTo(x + w, y + 0.7); ctx.stroke();
      return;
    }
    if (L === "shelf" || L === "bank" || L === "board" || L === "office") {
      ctx.fillStyle = L === "office" ? "#0e1512" : L === "board" ? "#120f0c" : "#14110d"; ctx.fillRect(x, y, w, h);
      stroke(0.42, 1.3); ctx.strokeRect(x + 0.6, y + 0.6, w - 1.2, h - 1.2);
      if (L === "shelf") { stroke(0.16, 1); for (var sy = y + 18; sy < y + h; sy += 20) { ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x + w, sy); ctx.stroke(); for (var sx = x + 4; sx < x + w - 4; sx += 6 + ((sx * 3) % 4)) { ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - 12 - ((sx * 7) % 5)); ctx.stroke(); } } }
      else if (L === "bank") { stroke(0.18, 1); for (var dy = y + 4; dy < y + h - 8; dy += 22) for (var dx = x + 4; dx < x + w - 10; dx += 30) { ctx.strokeRect(dx, dy, 26, 18); ctx.fillStyle = "rgba(201,169,106,0.45)"; ctx.fillRect(dx + 10, dy + 11, 6, 2); } }
      else if (L === "board") { for (var jy = y + 10; jy < y + h - 4; jy += 12) for (var jx = x + 8; jx < x + w - 4; jx += 12) { ctx.fillStyle = ((jx + jy * 3) % 7 === 0) ? "rgba(246,222,170," + (0.5 + 0.4 * Math.sin(t * 3 + jx)) + ")" : "rgba(237,231,219,0.14)"; ctx.beginPath(); ctx.arc(jx, jy, 2, 0, 7); ctx.fill(); } }
      else if (L === "office") { for (var wy = y + 14; wy < y + h - 20; wy += 34) for (var wx = x + 12; wx < x + w - 20; wx += 40) { ctx.fillStyle = "rgba(240,206,150," + (0.1 + ((wx + wy) % 3) * 0.05) + ")"; ctx.fillRect(wx, wy, 22, 16); } }
      return;
    }
    if (L === "cab") {
      ctx.fillStyle = "#151a17"; ctx.fillRect(x, y, w, h);
      stroke(0.42, 1.3); ctx.strokeRect(x + 0.6, y + 0.6, w - 1.2, h - 1.2);
      stroke(0.2, 1); for (var cy = y + 26; cy < y + h - 4; cy += 26) { ctx.beginPath(); ctx.moveTo(x + 3, cy); ctx.lineTo(x + w - 3, cy); ctx.stroke(); }
      for (var hy = y + 13; hy < y + h - 4; hy += 26) { ctx.fillStyle = "rgba(201,169,106,0.55)"; ctx.fillRect(x + w / 2 - 6, hy, 12, 2.4); stroke(0.25, 1); ctx.strokeRect(x + w / 2 - 7, hy - 8, 14, 5); }
      return;
    }
    if (L === "paper") {
      for (var k = 0; k < h / 4; k++) { ctx.fillStyle = k % 2 ? "#cfc8ba" : "#e6dfd2"; ctx.fillRect(x + ((k * 5) % 3) - 1, y + k * 4, w, 4); }
      stroke(0.6, 1); ctx.strokeRect(x, y, w, h);
      return;
    }
    if (L === "lift") {
      ctx.fillStyle = "#1a201d"; ctx.fillRect(x, y, w, h); stroke(0.5, 1.3); ctx.strokeRect(x, y, w, h);
      stroke(0.3, 2); ctx.beginPath(); ctx.moveTo(x + 10, y + h); ctx.lineTo(x + 10, 12 * TS); ctx.moveTo(x + w - 10, y + h); ctx.lineTo(x + w - 10, 12 * TS); ctx.stroke();
      stroke(0.15, 1); for (var ly = y + h + 12; ly < 12 * TS; ly += 14) { ctx.beginPath(); ctx.moveTo(x + 6, ly); ctx.lineTo(x + 14, ly); ctx.moveTo(x + w - 14, ly); ctx.lineTo(x + w - 6, ly); ctx.stroke(); }
      return;
    }
    ctx.fillStyle = LAC; ctx.fillRect(x, y, w, h); stroke(0.4, 1.3); ctx.strokeRect(x, y, w, h);
  }

  function drawCar(c, t) {
    var x = c.x, y = c.y, s = c.s, W2 = s.w * TS, bh = s.bh * TS, ct = s.ct * TS, c0 = x + s.c0 * TS, c1 = x + s.c1 * TS;
    ctx.beginPath();
    ctx.moveTo(x + 4, y - 8);
    ctx.lineTo(x + 2, y - bh + 6); ctx.quadraticCurveTo(x + 2, y - bh, x + 10, y - bh);
    ctx.lineTo(c0 - 4, y - bh); ctx.lineTo(c0 + 8, y - ct + 3); ctx.quadraticCurveTo(c0 + 10, y - ct, c0 + 16, y - ct);
    ctx.lineTo(c1 - 12, y - ct); ctx.quadraticCurveTo(c1 - 8, y - ct, c1 - 4, y - ct + 4); ctx.lineTo(c1 + 6, y - bh);
    ctx.lineTo(x + W2 - 8, y - bh); ctx.quadraticCurveTo(x + W2 - 2, y - bh, x + W2 - 2, y - bh + 6); ctx.lineTo(x + W2 - 4, y - 8);
    ctx.closePath();
    ctx.fillStyle = "#0f1513"; ctx.fill(); stroke(0.55, 1.4); ctx.stroke();
    /* windows */
    stroke(0.24, 1); ctx.beginPath(); ctx.moveTo(c0 + 4, y - bh - 3); ctx.lineTo(c0 + 13, y - ct + 6); ctx.lineTo(c1 - 10, y - ct + 6); ctx.lineTo(c1 - 1, y - bh - 3); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo((c0 + c1) / 2, y - ct + 6); ctx.lineTo((c0 + c1) / 2, y - bh - 3); ctx.stroke();
    /* the roof catches the lamps */
    stroke(0.75, 1.2); ctx.beginPath(); ctx.moveTo(c0 + 18, y - ct + 1); ctx.lineTo(c1 - 14, y - ct + 1); ctx.stroke();
    /* wheels */
    [x + W2 * 0.22, x + W2 * 0.78].forEach(function (wx) { ctx.fillStyle = "#070a09"; ctx.beginPath(); ctx.arc(wx, y - 7, 9, 0, 7); ctx.fill(); stroke(0.4, 1.2); ctx.beginPath(); ctx.arc(wx, y - 7, 9, 0, 7); ctx.stroke(); stroke(0.25, 1); ctx.beginPath(); ctx.arc(wx, y - 7, 4, 0, 7); ctx.stroke(); });
    /* lights */
    ctx.fillStyle = "rgba(246,231,196,0.8)"; ctx.fillRect(x + W2 - 8, y - bh + 6, 5, 3);
    ctx.fillStyle = "rgba(170,60,50,0.7)"; ctx.fillRect(x + 3, y - bh + 6, 4, 3);
    /* the wet reflection */
    ctx.fillStyle = "rgba(237,231,219,0.05)"; ctx.fillRect(x + 6, y + 2, W2 - 12, 3);
  }

  function drawKey(x, y, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2) * 0.4);
    ctx.strokeStyle = "#f2dfb6"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(-3, 0, 3.4, 0, 7); ctx.moveTo(0.4, 0); ctx.lineTo(7, 0); ctx.moveTo(5, 0); ctx.lineTo(5, 2.6); ctx.moveTo(7, 0); ctx.lineTo(7, 2.6); ctx.stroke();
    ctx.restore();
  }

  function drawLamp(l, t) {
    var x = l.x, y = l.y, h = TS * 3.6;
    stroke(0.5, 2); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.lineTo(x + 10, y - h); ctx.stroke();
    ctx.fillStyle = l.lit ? "rgba(246,222,170," + (0.6 + 0.4 * l.a) + ")" : "rgba(237,231,219,0.25)";
    ctx.beginPath(); ctx.moveTo(x + 4, y - h + 2); ctx.lineTo(x + 18, y - h + 2); ctx.lineTo(x + 15, y - h + 7); ctx.lineTo(x + 7, y - h + 7); ctx.closePath(); ctx.fill();
    if (l.lit) glow(x + 11, y - h + 6, 50, 0.45 * l.a);
    stroke(0.3, 1); ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.stroke();
  }

  function drawOne(o, t) {
    var x = o.x, y = o.y, w = o.w, L = o.look;
    if (L === "wire") {
      stroke(0.62, 1.6); ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + w / 2, y + 5, x + w, y); ctx.stroke();
      stroke(0.18, 1); ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.quadraticCurveTo(x + w / 2, y + 2, x + w, y - 6); ctx.stroke();
      var pulse = ((t * 0.7) % 1); ctx.fillStyle = "rgba(246,222,170,0.8)"; ctx.beginPath(); ctx.arc(x + w * pulse, y + 5 * 4 * pulse * (1 - pulse) * 0.5, 2, 0, 7); ctx.fill();
      return;
    }
    if (L === "branch") {
      stroke(0.55, 2.6); ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.bezierCurveTo(x + w * 0.3, y - 2, x + w * 0.7, y + 4, x + w, y + 1); ctx.stroke();
      stroke(0.22, 1.1); for (var k = 1; k < 4; k++) { var bx = x + w * k / 4; ctx.beginPath(); ctx.moveTo(bx, y + 2); ctx.quadraticCurveTo(bx + 6, y + 12, bx + 2 + (k % 2 ? 8 : -6), y + 22); ctx.stroke(); }
      ctx.fillStyle = "rgba(246,222,170,0.7)"; ctx.beginPath(); ctx.arc(x + 3, y + 2, 2.5, 0, 7); ctx.arc(x + w - 3, y + 1, 2.5, 0, 7); ctx.fill();
      return;
    }
    if (L === "lampbar") { ctx.fillStyle = "#121816"; ctx.fillRect(x, y, w, 6); stroke(0.55, 1.2); ctx.strokeRect(x, y, w, 6); return; }
    if (L === "shelf") { ctx.fillStyle = "#1a1612"; ctx.fillRect(x, y, w, 7); stroke(0.5, 1.2); ctx.strokeRect(x, y, w, 7); stroke(0.25, 1); ctx.beginPath(); ctx.moveTo(x + 8, y + 7); ctx.lineTo(x + 18, y + 20); ctx.moveTo(x + w - 8, y + 7); ctx.lineTo(x + w - 18, y + 20); ctx.stroke(); return; }
    if (L === "ridge") { ctx.fillStyle = "#0c120e"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - 10, y + 16); ctx.lineTo(x + 8, y + 12); ctx.closePath(); ctx.fill(); stroke(0.5, 1.3); ctx.stroke(); return; }
    ctx.fillStyle = "#151b18"; ctx.fillRect(x, y, w, 7); stroke(0.5, 1.2); ctx.strokeRect(x, y, w, 7);
  }

  function drawMover(m, t) {
    var x = m.x, y = m.y, w = m.w, L = m.look;
    if (L === "axon") {
      stroke(0.18, 1.2); ctx.setLineDash([3, 6]); ctx.beginPath(); ctx.moveTo(m.x0, m.y0 + 4); ctx.lineTo(m.x0 + m.dx + w, m.y0 + m.dy + 4); ctx.stroke(); ctx.setLineDash([]);
      glow(x + w / 2, y + 4, 40, 0.5);
      ctx.fillStyle = "#1d1a14"; rr(x, y, w, 9, 4.5); ctx.fill(); stroke(0.7, 1.3); ctx.stroke();
      ctx.fillStyle = "rgba(246,222,170,0.9)"; ctx.beginPath(); ctx.arc(x + w / 2, y + 4.5, 2.5, 0, 7); ctx.fill();
      return;
    }
    if (L === "wave") {
      glow(x + w / 2, y + 3, 34, 0.32);
      stroke(0.75, 1.8); ctx.beginPath();
      for (var i = 0; i <= 24; i++) { var px = x + w * i / 24; ctx.lineTo(px, y + 3 + Math.sin(i * 0.8 + t * 6) * 2.2 * Math.sin(Math.PI * i / 24)); }
      ctx.stroke();
      stroke(0.25, 1); ctx.beginPath(); for (var j = 0; j <= 24; j++) { var qx = x + w * j / 24; ctx.lineTo(qx, y + 9 + Math.sin(j * 0.8 + t * 6 + 1) * 4 * Math.sin(Math.PI * j / 24)); } ctx.stroke();
      return;
    }
    if (L === "bubble") {
      ctx.fillStyle = "#18201c"; rr(x, y, w, 20, 10); ctx.fill(); stroke(0.65, 1.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 12, y + 20); ctx.lineTo(x + 8, y + 28); ctx.lineTo(x + 20, y + 20); ctx.fillStyle = "#18201c"; ctx.fill(); ctx.stroke();
      for (var d = 0; d < 3; d++) { ctx.fillStyle = "rgba(237,231,219," + (0.35 + 0.5 * Math.max(0, Math.sin(t * 5 - d))) + ")"; ctx.beginPath(); ctx.arc(x + w / 2 - 9 + d * 9, y + 10, 2, 0, 7); ctx.fill(); }
      return;
    }
    if (L === "paper") { ctx.save(); ctx.translate(x + w / 2, y); ctx.rotate(Math.sin(t * 1.6 + x) * 0.03); for (var k = 0; k < 3; k++) { ctx.fillStyle = k % 2 ? "#cfc8ba" : "#e6dfd2"; ctx.fillRect(-w / 2 + k, k * 3, w, 3); } stroke(0.6, 1); ctx.strokeRect(-w / 2, 0, w, 9); stroke(0.2, 1); ctx.restore(); return; }
    drawOne(m, t);
  }

  function drawGhost(g, t) {
    var x = g.x, y = g.y, w = g.w, a = g.a;
    if (g.look === "form") {
      if (a < 1) { stroke(0.35 * (1 - a) + 0.1, 1.2); ctx.setLineDash([5, 5]); ctx.strokeRect(x, y, w, 10); ctx.setLineDash([]); }
      if (a > 0) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w * a, 12); ctx.clip(); ctx.fillStyle = "#e6dfd2"; ctx.fillRect(x, y, w, 10); ctx.strokeStyle = "rgba(10,15,13,0.5)"; ctx.lineWidth = 1; for (var k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x + 6, y + 3 + k * 2.4); ctx.lineTo(x + w * (0.4 + 0.2 * k), y + 3 + k * 2.4); ctx.stroke(); } ctx.restore(); }
      return;
    }
    if (g.look === "trail") {
      if (a < 1) { stroke(0.22 * (1 - a), 1.2); ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke(); ctx.setLineDash([]); }
      if (a > 0) { ctx.globalAlpha = a; ctx.fillStyle = "#0c120e"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - 8, y + 14); ctx.lineTo(x + 6, y + 10); ctx.closePath(); ctx.fill(); stroke(0.6, 1.3); ctx.stroke(); glow(x + w / 2, y, 30, 0.3); ctx.globalAlpha = 1; }
      return;
    }
    /* scaffold: a blueprint until you come near, then planks and bracing */
    if (a < 1) { stroke(0.3 * (1 - a) + 0.08, 1); ctx.setLineDash([4, 4]); ctx.strokeRect(x, y, w, 8); ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x + w, y + 8 + TS * 1.4); ctx.moveTo(x + w, y + 8); ctx.lineTo(x, y + 8 + TS * 1.4); ctx.stroke(); ctx.setLineDash([]); }
    if (a > 0) {
      var e = 1 - Math.pow(1 - a, 3);
      ctx.save(); ctx.globalAlpha = e;
      stroke(0.4, 1.4); ctx.beginPath(); ctx.moveTo(x + 4, y + 8); ctx.lineTo(x + 4, y + 8 + TS * 1.4 * e); ctx.moveTo(x + w - 4, y + 8); ctx.lineTo(x + w - 4, y + 8 + TS * 1.4 * e); ctx.moveTo(x + 4, y + 8); ctx.lineTo(x + w - 4, y + 8 + TS * 1.4 * e); ctx.stroke();
      ctx.fillStyle = "#1c2420"; ctx.fillRect(x, y + (1 - e) * -10, w, 8); stroke(0.75, 1.3); ctx.strokeRect(x, y + (1 - e) * -10, w, 8);
      ctx.restore();
    }
  }

  function drawDoor(d, t) {
    var h = d.h * (1 - d.open);
    if (h < 1) return;
    ctx.fillStyle = "#1b1611"; ctx.fillRect(d.x, d.y, d.w, h); stroke(0.5, 1.3); ctx.strokeRect(d.x, d.y, d.w, h);
    stroke(0.2, 1); ctx.strokeRect(d.x + 4, d.y + 6, d.w - 8, Math.max(0, h * 0.4)); if (h > d.h * 0.5) ctx.strokeRect(d.x + 4, d.y + h * 0.52, d.w - 8, h * 0.4);
    ctx.fillStyle = "rgba(201,169,106,0.7)"; ctx.fillRect(d.x + d.w - 7, d.y + h * 0.55, 3, 6);
  }

  function drawTrig(tr, t) {
    if (tr.look === "scan") {
      stroke(0.55, 1.6); ctx.beginPath(); ctx.moveTo(tr.x, tr.y + tr.h); ctx.lineTo(tr.x, tr.y); ctx.lineTo(tr.x + tr.w, tr.y); ctx.lineTo(tr.x + tr.w, tr.y + tr.h); ctx.stroke();
      var by = tr.on ? tr.y + tr.h * 0.5 : tr.y + 4 + ((Math.sin(t * 2.4) + 1) / 2) * (tr.h - 8);
      ctx.fillStyle = tr.on ? "rgba(246,240,228,0.85)" : "rgba(246,222,170,0.7)"; ctx.fillRect(tr.x + 2, by, tr.w - 4, 2);
      glow(tr.x + tr.w / 2, by, 26, tr.on ? 0.2 : 0.45);
      /* a license card on the stand */
      ctx.fillStyle = "#e6dfd2"; rr(tr.x - 6, tr.y - 16, 20, 13, 2); ctx.fill(); ctx.fillStyle = "#3a3f3a"; ctx.fillRect(tr.x - 3, tr.y - 13, 6, 7); ctx.fillRect(tr.x + 5, tr.y - 12, 7, 1.4); ctx.fillRect(tr.x + 5, tr.y - 9, 6, 1.4);
      return;
    }
    if (tr.look === "pin") {
      var x = tr.x + tr.w / 2, y = tr.y + 6;
      glow(x, y, 30, tr.on ? 0.6 : 0.3 + 0.15 * Math.sin(t * 3));
      ctx.fillStyle = tr.on ? "#f2d9a6" : "rgba(242,217,166,0.55)";
      ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.bezierCurveTo(x - 9, y + 5, x - 9, y - 7, x, y - 7); ctx.bezierCurveTo(x + 9, y - 7, x + 9, y + 5, x, y + 14); ctx.fill();
      ctx.fillStyle = "#0c120e"; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill();
    }
  }

  function drawPad(p, t) {
    var k = p.k, x = p.x, y = p.y, w = p.w;
    glow(x + w / 2, y + 2, 40 + k * 40, 0.3 + k * 0.5 + 0.1 * Math.sin(t * 4));
    ctx.fillStyle = "#1b1a14"; rr(x, y + 2 + k * 3, w, 10 - k * 3, 5); ctx.fill(); stroke(0.7, 1.4); ctx.stroke();
    stroke(0.35 + k * 0.5, 1.1);
    for (var i = 0; i < 4; i++) { var a = -Math.PI / 2 + (i - 1.5) * 0.45; ctx.beginPath(); ctx.moveTo(x + w / 2 + Math.cos(a) * 8, y + 2 + Math.sin(a) * 8); ctx.lineTo(x + w / 2 + Math.cos(a) * (14 + k * 16), y + 2 + Math.sin(a) * (14 + k * 16)); ctx.stroke(); }
  }

  function drawGoal(g, t) {
    var x = g.x, y = g.y, w = g.w, h = g.h, k = g.k;
    if (k === "showroom") {
      var bx = x - TS * 1.5, bw = TS * 9, bh = TS * 4.6;
      ctx.fillStyle = "#0f1513"; ctx.fillRect(bx, y - bh, bw, bh);
      ctx.fillStyle = "rgba(240,206,150,0.22)"; ctx.fillRect(bx + 6, y - bh + 26, bw - 12, bh - 32);
      stroke(0.55, 1.4); ctx.strokeRect(bx, y - bh, bw, bh); ctx.beginPath(); ctx.moveTo(bx - 10, y - bh); ctx.lineTo(bx + bw + 10, y - bh); ctx.stroke();
      stroke(0.22, 1); for (var mx = bx + 6 + 40; mx < bx + bw - 6; mx += 40) { ctx.beginPath(); ctx.moveTo(mx, y - bh + 26); ctx.lineTo(mx, y - 6); ctx.stroke(); }
      ctx.fillStyle = "#0b100e"; ctx.beginPath(); ctx.moveTo(bx + 140, y - 6); ctx.lineTo(bx + 146, y - 22); ctx.quadraticCurveTo(bx + 160, y - 34, bx + 178, y - 34); ctx.lineTo(bx + 200, y - 34); ctx.quadraticCurveTo(bx + 214, y - 30, bx + 222, y - 20); ctx.lineTo(bx + 232, y - 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ede7db"; ctx.font = "600 12px 'Cormorant Garamond', serif"; ctx.textAlign = "center"; ctx.fillText("TRIPLE J AUTO", bx + bw / 2, y - bh + 17); ctx.textAlign = "left";
      ctx.fillStyle = "rgba(246,231,196,0.55)"; ctx.fillRect(x + 6, y - TS * 2.6, w - 12, TS * 2.6);
      stroke(0.7, 1.4); ctx.strokeRect(x + 6, y - TS * 2.6, w - 12, TS * 2.6);
      return;
    }
    /* a lit doorway in the title's own frame */
    var dx = x + 6, dw = w - 12, dh = TS * 2.7;
    ctx.fillStyle = "rgba(246,231,196,0.5)";
    if (k === "arch") { ctx.beginPath(); ctx.moveTo(dx, y); ctx.lineTo(dx, y - dh + dw / 2); ctx.arc(dx + dw / 2, y - dh + dw / 2, dw / 2, Math.PI, 0); ctx.lineTo(dx + dw, y); ctx.closePath(); ctx.fill(); stroke(0.7, 1.6); ctx.stroke(); stroke(0.3, 1); ctx.beginPath(); ctx.moveTo(dx - 10, y); ctx.lineTo(dx - 10, y - dh - 8); ctx.arc(dx + dw / 2, y - dh - 8 + dw / 2 + 4, dw / 2 + 10, Math.PI, 0); ctx.lineTo(dx + dw + 10, y); ctx.stroke(); return; }
    if (k === "flag") { ctx.fillStyle = "#0c120e"; ctx.beginPath(); ctx.moveTo(x - 20, y); ctx.lineTo(x + w / 2, y - TS * 2.4); ctx.lineTo(x + w + 20, y); ctx.closePath(); ctx.fill(); stroke(0.6, 1.4); ctx.stroke(); ctx.fillStyle = "rgba(246,231,196,0.5)"; ctx.beginPath(); ctx.moveTo(x + w / 2 - 12, y); ctx.lineTo(x + w / 2, y - TS * 1.4); ctx.lineTo(x + w / 2 + 12, y); ctx.closePath(); ctx.fill(); stroke(0.6, 1.6); ctx.beginPath(); ctx.moveTo(x + w / 2, y - TS * 2.4); ctx.lineTo(x + w / 2, y - TS * 3.6); ctx.stroke(); ctx.fillStyle = "#ede7db"; ctx.beginPath(); ctx.moveTo(x + w / 2, y - TS * 3.6); ctx.lineTo(x + w / 2 + 22 + Math.sin(t * 3) * 2, y - TS * 3.3); ctx.lineTo(x + w / 2, y - TS * 3.0); ctx.closePath(); ctx.fill(); return; }
    ctx.fillRect(dx, y - dh, dw, dh);
    stroke(0.7, 1.6); ctx.strokeRect(dx, y - dh, dw, dh);
    stroke(0.3, 1); ctx.strokeRect(dx - 8, y - dh - 8, dw + 16, dh + 8);
    ctx.fillStyle = "#ede7db"; ctx.textAlign = "center";
    if (k === "filed") { ctx.font = "600 13px 'Cormorant Garamond', serif"; ctx.fillText("FILED", dx + dw / 2, y - dh - 16); }
    if (k === "switch") { ctx.font = "600 13px 'Cormorant Garamond', serif"; ctx.fillText("THE DESK", dx + dw / 2, y - dh - 16); }
    if (k === "early") {
      ctx.font = "600 15px 'Cormorant Garamond', serif"; ctx.fillText("OBAVIA", dx + dw / 2, y - dh - 34);
      ctx.font = "500 10px 'Hanken Grotesk', sans-serif"; ctx.fillText("Early access is a conversation", dx + dw / 2, y - dh - 18);
      ctx.fillStyle = "rgba(237,231,219,0.6)"; ctx.fillText("In development", dx + dw / 2, y + 16);
    }
    ctx.textAlign = "left";
  }

  /* ---------- people: one procedural figure for you, the cast and the ghosts ---------- */
  function figure(c, L, o) {
    /* o: { face, run (phase), air (-1 rising .. 1 falling), sx, sy, cheer, blink, alpha, ghost } ; origin at the feet */
    var f = o.face || 1, ph = o.run || 0, moving = !!o.moving;
    c.save();
    c.scale(f * (o.sx || 1), o.sy || 1);
    if (o.ghost) { c.globalAlpha = o.alpha || 0.2; }
    var legA = moving ? Math.sin(ph) * 0.65 : 0, armA = moving ? -Math.sin(ph) * 0.55 : 0, bob = moving ? Math.abs(Math.cos(ph)) * -1.6 : Math.sin((o.t || 0) * 2) * 0.6;
    if (o.air) { legA = o.air < 0 ? 0.5 : -0.25; armA = o.air < 0 ? -2.3 : -1.6; }
    if (o.cheer) { armA = -2.7 + Math.sin(o.cheer * 10) * 0.2; }
    var pants = shade(L.suit, -0.18), shoe = "#060807";
    function limb(x, y, len, a, w, col) { c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = col; rrc(c, -w / 2, 0, w, len, w / 2); c.fill(); c.restore(); }
    /* back leg and arm */
    limb(-2, -20 + bob, 18, -legA, 5.4, shade(pants, -0.1)); c.fillStyle = shoe; c.save(); c.translate(-2, -20 + bob); c.rotate(-legA); c.fillRect(-3, 16, 8, 3.4); c.restore();
    limb(-1, -34 + bob, 14, -armA * 0.9 + 0.1, 4.4, shade(L.suit, -0.12));
    /* body */
    c.fillStyle = L.suit; rrc(c, -7, -36 + bob, 14, 18, 4); c.fill();
    c.fillStyle = L.shirt; c.beginPath(); c.moveTo(-3, -36 + bob); c.lineTo(3, -36 + bob); c.lineTo(0, -29 + bob); c.closePath(); c.fill();
    c.fillStyle = L.tie; c.fillRect(-0.9, -33 + bob, 1.8, 7);
    /* front leg */
    limb(2, -20 + bob, 18, legA, 5.6, pants); c.fillStyle = shoe; c.save(); c.translate(2, -20 + bob); c.rotate(legA); c.fillRect(-3, 16, 8.5, 3.4); c.restore();
    /* head */
    var hy = -43 + bob;
    c.fillStyle = L.skin; c.beginPath(); c.arc(1, hy, 6.6, 0, 7); c.fill();
    c.fillStyle = L.skin; c.fillRect(-1.5, hy + 5, 4, 3);
    c.fillStyle = L.hairC;
    if (L.hair === 0) { c.beginPath(); c.arc(1, hy - 1.2, 6.9, Math.PI * 1.02, Math.PI * 1.98); c.lineTo(7.6, hy - 1); c.quadraticCurveTo(1, hy - 4.2, -5.6, hy - 0.4); c.closePath(); c.fill(); }
    else if (L.hair === 1) { c.beginPath(); c.arc(1, hy - 0.6, 6.7, Math.PI * 1.08, Math.PI * 1.92); c.closePath(); c.fill(); }
    else if (L.hair === 2) { for (var k = 0; k < 7; k++) { c.beginPath(); c.arc(-4.5 + k * 1.8, hy - 5.6 + (k % 2) * 0.8, 2.6, 0, 7); c.fill(); } c.beginPath(); c.arc(-5, hy - 1.5, 2.6, 0, 7); c.fill(); }
    else { c.beginPath(); c.arc(1, hy - 1, 7, Math.PI * 1.0, Math.PI * 2.0); c.lineTo(7.6, hy + 2); c.lineTo(4, hy - 3); c.lineTo(-4, hy - 2); c.lineTo(-6.4, hy + 8); c.lineTo(-7.6, hy + 1); c.closePath(); c.fill(); }
    /* eyes, the glasses (browline, like the portrait), a blink */
    var bl = o.blink && o.blink < 0.12;
    c.fillStyle = "#0a0a0a"; if (bl) c.fillRect(3.4, hy - 0.2, 2.4, 0.8); else { c.beginPath(); c.arc(4.4, hy, 0.95, 0, 7); c.fill(); }
    if (L.glasses) {
      c.strokeStyle = "rgba(10,10,10,0.95)"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(1.2, hy - 1.6); c.lineTo(7.2, hy - 1.6); c.stroke();
      c.strokeStyle = L.jason ? "rgba(201,169,106,0.9)" : "rgba(237,231,219,0.55)"; c.lineWidth = 0.7; c.beginPath(); c.moveTo(1.4, hy - 1.5); c.lineTo(1.6, hy + 1.3); c.lineTo(6.9, hy + 1.3); c.lineTo(7.1, hy - 1.5); c.stroke();
    }
    /* front arm */
    limb(1, -34 + bob, 14, armA, 4.6, L.suit); c.fillStyle = L.skin; c.save(); c.translate(1, -34 + bob); c.rotate(armA); c.beginPath(); c.arc(0, 14.5, 2.4, 0, 7); c.fill(); c.restore();
    c.restore();
  }
  function rrc(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath(); }
  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var f = function (v) { return Math.round(clamp(k < 0 ? v * (1 + k) : v + (255 - v) * k, 0, 255)); };
    return "rgb(" + f(r) + "," + f(g) + "," + f(b) + ")";
  }

  function drawPlayer(t) {
    var p = PL, x = p.x + P.w / 2, y = p.y + P.h;
    p.sx = lerp(p.sx, 1, 0.18); p.sy = lerp(p.sy, 1, 0.18);
    if (Math.abs(p.vx) > 10 && p.ground) p.run += Math.abs(p.vx) / 15 / 60; /* a stride that matches the ground speed */
    p.blink -= 1 / 60; if (p.blink < 0) p.blink = 2.5 + Math.random() * 2.5;
    /* a shadow pooled under the feet */
    if (p.ground) { ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(x, y + 1, 11, 2.6, 0, 0, 7); ctx.fill(); }
    if (p.dead > 0) ctx.globalAlpha = Math.max(0, p.dead / 0.55);
    ctx.save(); ctx.translate(x, y + 1);
    /* a thin bone rim so you never lose yourself in the dark */
    ctx.shadowColor = "rgba(237,231,219,0.35)"; ctx.shadowBlur = 6;
    figure(ctx, look(), { face: p.face, run: p.run, moving: p.ground && Math.abs(p.vx) > 20, air: p.ground ? 0 : (p.vy < 0 ? -1 : 1), sx: p.sx, sy: p.sy, cheer: finished ? p.cheer : 0, blink: p.blink, t: t });
    ctx.restore(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  function drawNpc(n, t) {
    var c = D.cast[n.who] || {};
    if (PL) n.face = PL.x + P.w / 2 < n.x ? -1 : 1;
    var speaking = talking && LINES[talking.id] && LINES[talking.id].who === n.who;
    glow(n.x, n.y - 60, 60, 0.2);
    ctx.save(); ctx.translate(n.x, n.y + 1);
    figure(ctx, { skin: c.skin || "#8a5a3c", hair: n.who === "buyer" ? 3 : n.who === "prof" ? 1 : 0, hairC: c.hair || "#151515", suit: c.suit || "#2a2f2c", shirt: "#d9d2c4", tie: shade(c.suit || "#2a2f2c", -0.3), glasses: n.who === "prof" ? 1 : 0 }, { face: n.face, t: t, blink: (t + n.x) % 3 });
    ctx.restore();
    if (speaking) { for (var i = 0; i < 3; i++) { ctx.fillStyle = "rgba(237,231,219," + (0.3 + 0.6 * Math.max(0, Math.sin(t * 6 - i))) + ")"; ctx.beginPath(); ctx.arc(n.x - 6 + i * 6, n.y - 62, 1.8, 0, 7); ctx.fill(); } }
  }

  /* ---------- ghosts: your best on this level, and other players' recent bests ---------- */
  var REC = { t: 0, s: [] }, GHOSTS = [];
  function drawGhostRuns() {
    if (!SAVE.opts.ghosts || !GHOSTS.length || !started) return;
    var tt = levelT / 100;
    GHOSTS.forEach(function (g) {
      var s = g.s; if (!s || s.length < 2) return;
      var i = Math.floor(tt), f = tt - i;
      if (i >= s.length - 1) { i = s.length - 2; f = 1; }
      var a = s[i], b = s[i + 1]; if (!a || !b) return;
      var x = lerp(a[0], b[0], f) + P.w / 2, y = lerp(a[1], b[1], f) + P.h;
      if (!vis(x, 0)) return;
      var moving = Math.abs(b[0] - a[0]) > 1;
      glow(x, y - 26, 34, 0.18);
      ctx.save(); ctx.translate(x, y + 1);
      figure(ctx, ghostLook(g.c), { face: b[2] || 1, run: levelT / 1000 * 15, moving: moving, air: Math.abs(b[1] - a[1]) > 3 ? (b[1] < a[1] ? -1 : 1) : 0, ghost: 1, alpha: g.mine ? 0.22 : 0.16, t: W.t });
      ctx.restore();
    });
  }
  function ghostLook(c) { var l = look(c || JASON); return { skin: "#ede7db", hair: l.hair, hairC: "#ede7db", suit: "#ede7db", shirt: "#ede7db", tie: "#ede7db", glasses: 0 }; }

  /* ---------- HUD, hints, the level card ---------- */
  var hudName = $("[data-run-name]", el), socks = $("[data-run-socks]", el), timerEl = $("[data-run-timer]", el), hintEl = $("[data-run-hint]", el), cardEl = $("[data-run-card]", el), crewEl = $("[data-run-crew]", el);
  function paintSocks() {
    socks.innerHTML = W.medals.map(function (m) {
      return '<i class="run__sock run__sock--' + m.tier + (m.got ? " is-got" : "") + '" data-sock="' + m.slug + '" title="' + E(m.got ? LIB.trophies[m.slug].name : (m.where === "hidden" ? "Hidden" : m.where === "off" ? "Off the path" : m.where === "skill" ? "Takes some skill" : "On the path")) + '"><img src="assets/game/medals/' + m.slug + '-80.webp" alt="" /></i>';
    }).join("");
  }
  var hint = { step: 0, t: 0, shown: null };
  function setHint(html) {
    if (hint.shown === html) return; hint.shown = html;
    if (!html) { hintEl.classList.remove("is-on"); setTimeout(function () { if (!hint.shown) hintEl.hidden = true; }, 400); return; }
    hintEl.innerHTML = html; hintEl.hidden = false; requestAnimationFrame(function () { hintEl.classList.add("is-on"); });
  }
  function tutorial(dt) {
    /* taught by doing, once, one hint at a time; nothing to read before the first jump */
    if (SAVE.taught || LV.n !== 0) { if (hint.shown && hint.step < 9) setHint(null); return; }
    hint.t += dt;
    var touchy = COARSE.matches;
    if (hint.step === 0) { if (hint.t > 0.8) setHint(touchy ? '<span class="run__glyph run__glyph--drag"></span>Drag on the left to move' : '<span class="key">A</span><span class="key">D</span> or <span class="key">&larr;</span><span class="key">&rarr;</span> to move'); if (PL.x > LV.spawn[0] * TS + TS * 2.5) { hint.step = 1; hint.t = 0; setHint(null); } }
    else if (hint.step === 1) { if (hint.t > 0.3) setHint(touchy ? '<span class="run__glyph run__glyph--tap"></span>Tap the right side to jump' : '<span class="key key--w">Space</span> to jump. Hold it to go higher'); if (!PL.ground && PL.vy < 0) { hint.step = 2; hint.t = 0; setHint(null); } }
    else if (hint.step === 2) { if (PL.x > 19 * TS) { hint.step = 3; hint.t = 0; W.hintFake = W.fakes[LV.hint || 0]; setHint('<span class="run__glyph run__glyph--medal"></span>A medal is hidden in the shelf ahead'); } }
    else if (hint.step === 3) { var f = W.hintFake; if ((f && f.rev > 0) || hint.t > 9 || PL.x > 30 * TS) { hint.step = 4; setHint(null); SAVE.taught = 1; save(); if (store.get("jg_role") === "interviewer") setTimeout(function () { if (OPEN) { setHint("Every medal is a verified fact from my record. The resume is one tap away, top right."); setTimeout(function () { setHint(null); }, 5200); } }, 1800); } }
  }
  function tickUi(dt) {
    tutorial(dt);
    if (nugT > 0) { nugT -= dt; if (nugT <= 0) showNug(); }
    if (SAVE.opts.timer) timerEl.textContent = fmt(levelT) + (runTotal.on && runTotal.splits.length ? "  ·  run " + fmt(runTotal.ms + levelT) : "");
  }
  function levelCard() {
    var t = TITLES[LV.id] || { logo: LV.id, kind: "" };
    $("[data-run-card-h]", el).textContent = t.logo;
    $("[data-run-card-p]", el).textContent = "Level " + (LV.n + 1) + " of " + LEVELS.length + ". " + (LV.tag ? LV.tag + ". " : "") + (t.role || t.kind || "");
    cardEl.classList.remove("is-on"); void cardEl.offsetWidth; cardEl.classList.add("is-on");
  }

  /* ---------- levels: load, finish ---------- */
  var runTotal = { on: false, ms: 0, splits: [] };
  function load(id, how) {
    var L = BYID[id] || LEVELS[0]; LV = L;
    W = buildWorld(L);
    W.plate = img("assets/game/art/" + stemOf(L.id) + (innerWidth > 1300 ? "-1920.webp" : "-1280.webp"));
    W.plateA = 0;
    PL = newPlayer(L.spawn[0] * TS, L.spawn[1] * TS);
    W.check = null;
    var vw = cw / scale; CAM.x = clamp(PL.x - vw * 0.3, 0, Math.max(0, W.w - vw)); CAM.y = W.bot - ch / scale; CAM.look = 0;
    PARTS = []; levelT = 0; started = false; finished = false; stats = { sparks: 0, total: W.sparks.length }; REC = { t: 0, s: [] }; GHOSTS = [];
    talkQ = []; stopLine(); setHint(null); hint = { step: 0, t: 0, shown: null }; nugQ = []; nugT = 0; nugEl.hidden = true; el.classList.remove("has-nug"); platinumNow = false;
    hudName.textContent = (TITLES[L.id] || {}).logo || L.id;
    paintSocks();
    timerEl.hidden = !SAVE.opts.timer;
    levelCard();
    /* the arrival: sound, haptic and the card in the same frame */
    if (window.JG_FX) window.JG_FX("arrive"); else hap("tap");
    if (SC()) SC().focus(L.id);
    loadGhosts(L.id);
    store.set("jg_run_at", L.id);
    try { if (!/^#play\//.test(location.hash) || location.hash !== "#play/" + L.id) history.replaceState(history.state, "", location.pathname + location.search + "#play/" + L.id); } catch (e) {}
    T("game_started", { level: L.id, how: how || "", seat: store.get("jg_role") || "" });
    clip.start();
    if (panel.hidden && OPEN) { RUNNING = true; last = performance.now(); acc = 0; }
  }

  function finish() {
    finished = true; PL.cheer = 0;
    var ms = Math.round(levelT);
    var first = !SAVE.cleared[LV.id];
    SAVE.cleared[LV.id] = 1;
    var prev = SAVE.best[LV.id], isBest = !prev || ms < prev;
    if (isBest) { SAVE.best[LV.id] = ms; try { if (REC.s.length > 4) jset("jg_run_ghost_" + LV.id, { s: REC.s, c: CHAR, t: ms }); } catch (e) {} }
    if (runTotal.on) { runTotal.ms += ms; runTotal.splits.push([LV.id, ms]); }
    save();
    if (window.JG_GAME && window.JG_GAME.cleared) window.JG_GAME.cleared(LV.id);
    var found = W.medals.filter(function (m) { return SAVE.medals[m.slug]; }).length;
    /* the arrival at the door: sound, haptic, light and the cheer together */
    hap("success"); SFX.clear(); sting("level-clear"); flash(still() ? 0.1 : 0.3); burst(PL.x + P.w / 2, PL.y, 30, "warm");
    T("game_level_finished", { level: LV.id, medals: found, of: W.medals.length, ms: ms, best: isBest ? 1 : 0, first: first ? 1 : 0 });
    postRun(LV.id, ms, found, REC.s);
    clip.mark();
    var fullRun = runTotal.on && LV.n === LEVELS.length - 1 && runTotal.splits.length === LEVELS.length;
    if (fullRun) { var prevAll = SAVE.best.all; if (!prevAll || runTotal.ms < prevAll) SAVE.best.all = runTotal.ms; save(); postRun("all", runTotal.ms, Object.keys(SAVE.medals).length, null); }
    setTimeout(function () {
      if (!OPEN) return;
      if (platinumNow) { platinumNow = false; showPlatinum(function () { showComplete(ms, isBest, prev, found, fullRun); }); }
      else showComplete(ms, isBest, prev, found, fullRun);
    }, 1300);
  }

  /* ---------- panels: pause, levels, character, complete, platinum, board ---------- */
  var menuRows = [], menuOn = 0, panelName = "", panelBack = null;
  function openPanel(name, html, back) {
    panelName = name; panelBack = back || null;
    sheet.innerHTML = html; sheet.className = "run__sheet run__sheet--" + name;
    panel.hidden = false; RUNNING = false; el.classList.add("has-panel"); IN.keys = {}; IN.touchX = 0; IN.touchJump = false; syncKeys();
    if (talking && talking.audio) try { talking.audio.pause(); } catch (e) {}
    menuRows = $$(".menu__row:not([disabled]), [data-run-focus]", sheet);
    menuOn = 0; if (menuRows[0]) setTimeout(function () { var r = menuRows[0]; r.focus({ preventScroll: true }); mark(0, true); }, 30);
    requestAnimationFrame(function () { panel.classList.add("is-on"); });
  }
  function closePanel() {
    panel.classList.remove("is-on"); panel.hidden = true; panelName = ""; sheet.innerHTML = ""; el.classList.remove("has-panel");
    if (OPEN && !finished) { RUNNING = true; last = performance.now(); acc = 0; if (talking && talking.audio && soundOn()) { var p = talking.audio.play(); if (p && p.catch) p.catch(function () {}); } }
    cv.focus && el.focus({ preventScroll: true });
  }
  function mark(i, quiet) { menuRows.forEach(function (r, j) { r.classList.toggle("is-on", j === i); }); menuOn = i; if (!quiet && menuRows[i]) { menuRows[i].focus({ preventScroll: true }); if (SC()) SC().tick(); } }
  function menuMove(d) { if (!menuRows.length) return; mark(clamp(menuOn + d, 0, menuRows.length - 1)); }
  function menuPick() { var r = menuRows[menuOn]; if (r) r.click(); }
  function menuBack() { if (panelName === "pause") closePanel(); else if (panelBack) panelBack(); }
  function menuKey(e) {
    var k = e.key;
    if (k === "ArrowDown") { e.preventDefault(); menuMove(1); }
    else if (k === "ArrowUp") { e.preventDefault(); menuMove(-1); }
    else if (k === "Escape" || k === "p" || k === "P") { if (panelName === "complete" || panelName === "platinum") return; e.preventDefault(); menuBack(); }
  }
  function row(act, label, sub, extra) { return '<li><button class="menu__row" type="button" data-act="' + act + '"' + (extra || "") + '><span class="menu__txt"><b>' + E(label) + "</b>" + (sub ? "<small>" + sub + "</small>" : "") + "</span></button></li>"; }

  function pause(how) {
    if (!OPEN || finished || panelName === "pause") return;
    if (how === "hidden" && !panel.hidden) return;
    var hasBoard = COMM.on;
    openPanel("pause",
      '<h2 class="run__h" id="run-h">Paused</h2>' +
      '<ol class="menu">' +
        row("resume", "Continue") +
        row("restart", "Restart the level") +
        row("levels", "Levels") +
        row("char", "Character", CHAR.me ? "Playing as me" : "Your own") +
        (hasBoard ? row("board", "Boards", "Fastest runs on this level") : "") +
        row("cv", "Skip to the resume") +
        row("quit", "Quit to the library") +
      "</ol>" +
      '<div class="run__opts">' +
        '<button class="run__chip" type="button" data-opt="timer" aria-pressed="' + (!!SAVE.opts.timer) + '">Timer</button>' +
        '<button class="run__chip" type="button" data-opt="ghosts" aria-pressed="' + (!!SAVE.opts.ghosts) + '">Ghosts</button>' +
        '<button class="run__chip" type="button" data-toggle="sound" data-where="run" aria-pressed="' + soundOn() + '"><span data-score-label>' + (soundOn() ? "Score on" : "Score off") + "</span></button>" +
        (clip.ok ? '<button class="run__chip" type="button" data-opt="clip" aria-pressed="' + clip.on + '">Keep a clip</button>' : "") +
      "</div>" +
      '<p class="run__fine">' + E(D.voices_note || "") + "</p>" +
      (PRIVATE ? '<p class="run__fine">Your browser asks not to be tracked, so your runs stay on this device: no boards, no ghosts from other players.</p>' : ""));
  }
  function levelsPanel(back) {
    var next = LEVELS.filter(function (l) { return !SAVE.cleared[l.id]; })[0];
    openPanel("levels", '<h2 class="run__h" id="run-h">Levels</h2><ol class="menu">' + LEVELS.map(function (l) {
      var t = TITLES[l.id] || {}, open = SAVE.cleared[l.id] || l === next || l === LV;
      var got = (l.md || []).filter(function (m) { return SAVE.medals[m[0]]; }).length, of = (l.md || []).length;
      var sub = (l.tag ? l.tag + ". " : "") + (of ? got + " of " + of + " medals" : "No medals. It isn't live.") + (SAVE.best[l.id] ? '. <span data-run-live>Best ' + fmt(SAVE.best[l.id]) + "</span>" : "");
      return '<li><button class="menu__row" type="button" data-act="go" data-id="' + l.id + '"' + (open ? "" : " disabled") + '><span class="menu__n" aria-hidden="true">' + (open ? (l.n + 1) : G + 'g-lock"/></svg>') + '</span><span class="menu__txt"><b>' + E(t.logo || l.id) + "</b><small>" + (open ? sub : "Clear the one before it") + "</small></span></button></li>";
    }).join("") + '</ol><p class="run__fine"><button class="run__text" type="button" data-act="back">Back</button></p>', back || pause);
  }
  function charPanel(back) {
    var c = Object.assign({}, CHAR);
    function chips(name, list, cur, sw) { return '<div class="run__group"><p class="run__k">' + name + '</p><div class="run__chips" role="radiogroup" aria-label="' + name + '">' + list.map(function (x, i) { return '<button class="run__chip' + (sw ? " run__chip--sw" : "") + '" type="button" role="radio" aria-checked="' + (i === cur) + '" data-c="' + name + '" data-v="' + i + '">' + (sw ? '<i style="background:' + (sw[i]) + '"></i>' : "") + "<span>" + E(x) + "</span></button>"; }).join("") + "</div></div>"; }
    function draw() {
      var html = '<h2 class="run__h" id="run-h">Character</h2><div class="run__char"><canvas class="run__preview" width="240" height="300" aria-label="Your character"></canvas><div class="run__build">' +
        '<div class="run__chips" role="radiogroup" aria-label="Who"><button class="run__chip" type="button" role="radio" aria-checked="' + !!c.me + '" data-who="me"><span>Play as me</span></button><button class="run__chip" type="button" role="radio" aria-checked="' + !c.me + '" data-who="own"><span>Build your own</span></button></div>' +
        (c.me ? '<p class="run__fine">A drawing of me in the suit from my portrait. Not a likeness, just the look.</p>' :
          chips("Skin", SKINS.map(function (_, i) { return "Tone " + (i + 1); }), c.skin | 0, SKINS) +
          chips("Hair", HAIRS, c.hair | 0) +
          chips("Outfit", OUTFITS.map(function (o) { return o[1]; }), c.outfit | 0, OUTFITS.map(function (o) { return o[0]; })) +
          '<div class="run__group"><p class="run__k">Glasses</p><div class="run__chips"><button class="run__chip" type="button" role="switch" aria-checked="' + !!c.glasses + '" data-glasses><span>' + (c.glasses ? "On" : "Off") + "</span></button></div></div>") +
        '</div></div><div class="run__acts"><button class="btn btn--primary" type="button" data-act="charsave" data-run-focus>Done</button></div>';
      sheet.innerHTML = html; menuRows = $$("[data-run-focus]", sheet);
      preview();
    }
    openPanel("char", "", back || pause);
    draw();
    var pv = null;
    function preview() {
      var cvp = $(".run__preview", sheet); if (!cvp) return;
      var g = cvp.getContext("2d"), t0 = performance.now();
      (function anim(now) {
        if (!cvp.isConnected) return;
        var t = (now - t0) / 1000;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 240, 300);
        var gr = g.createRadialGradient(120, 170, 10, 120, 170, 150); gr.addColorStop(0, "rgba(246,222,170,0.22)"); gr.addColorStop(1, "rgba(246,222,170,0)"); g.fillStyle = gr; g.fillRect(0, 0, 240, 300);
        g.strokeStyle = "rgba(237,231,219,0.3)"; g.beginPath(); g.moveTo(30, 262); g.lineTo(210, 262); g.stroke();
        g.setTransform(4.4, 0, 0, 4.4, 120, 262);
        figure(g, look(c), { face: 1, t: t, blink: t % 3.2, moving: false });
        requestAnimationFrame(anim);
      })(t0);
    }
    sheet.onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.hasAttribute("data-who")) { c.me = b.getAttribute("data-who") === "me" ? 1 : 0; if (!c.me && c.skin == null) { c.skin = 0; c.hair = 0; c.outfit = 0; c.glasses = 1; } if (window.JG_FX) window.JG_FX("choice"); draw(); return; }
      if (b.hasAttribute("data-c")) { var k = { Skin: "skin", Hair: "hair", Outfit: "outfit" }[b.getAttribute("data-c")]; c[k] = +b.getAttribute("data-v"); if (window.JG_FX) window.JG_FX("choice"); draw(); return; }
      if (b.hasAttribute("data-glasses")) { c.glasses = c.glasses ? 0 : 1; if (window.JG_FX) window.JG_FX("choice"); draw(); return; }
      if (b.getAttribute("data-act") === "charsave") { CHAR = c.me ? JASON : { me: 0, skin: c.skin | 0, hair: c.hair | 0, outfit: c.outfit | 0, glasses: c.glasses ? 1 : 0 }; jset("jg_run_char", CHAR); if (window.JG_FX) window.JG_FX("choice"); T("game_character", { me: CHAR.me ? 1 : 0 }); sheet.onclick = null; (panelBack || pause)(); }
    };
  }

  function medalRows(list) {
    return '<ul class="run__medals">' + list.map(function (m) {
      var tr = LIB.trophies[m.slug], got = SAVE.medals[m.slug];
      var where = { main: "On the path", off: "Off the path", hidden: "Hidden", skill: "Takes some skill" }[m.where] || "";
      return '<li class="' + (got ? "is-got" : "") + '">' + (got ? '<img src="assets/game/medals/' + m.slug + '-80.webp" alt="" width="44" height="44" />' : '<i class="run__blank run__blank--' + m.tier + '"></i>') +
        "<span><b>" + (got ? E(tr.name) : "Not found yet") + "<small>" + E(tier(m.tier)) + (got ? "" : ". " + where) + "</small></b>" + (got ? "<span>" + E(tr.desc) + "</span>" : "") + "</span></li>";
    }).join("") + "</ul>";
  }
  function showComplete(ms, isBest, prev, found, fullRun) {
    var t = TITLES[LV.id] || {}, last = LV.n === LEVELS.length - 1, nextL = LEVELS[LV.n + 1];
    var timeLine = '<span data-run-live>' + fmt(ms) + (isBest && prev ? ", a new best" : prev ? ". Best " + fmt(prev) : "") + "</span>";
    var html = '<h2 class="run__h" id="run-h">' + E(t.logo || LV.id) + "</h2>" +
      '<p class="run__sub">Cleared in ' + timeLine + "." + (W.medals.length ? " " + found + " of " + W.medals.length + " medals." : "") + (stats.total && stats.sparks === stats.total ? " Every spark." : "") + "</p>" +
      (fullRun ? '<p class="run__sub">The whole run in <span data-run-live>' + fmt(runTotal.ms) + "</span>.</p>" : "") +
      (W.medals.length ? medalRows(W.medals) : "") +
      (LV.id === "obavia" ? '<p class="run__note">Obavia is a dealership sale desk in development for Texas independent dealers. It isn\'t live yet. Early access is a conversation, not an account.</p>' : "") +
      '<div class="run__acts">' +
        (last ? '<a class="btn btn--primary" href="/obavia.html#early" data-act="early" data-run-focus>Early access</a><button class="btn" type="button" data-act="library" data-run-focus>Back to the library</button>'
              : '<button class="btn btn--primary" type="button" data-act="next" data-run-focus>' + G + 'g-play"/></svg>Next level</button><button class="btn" type="button" data-act="title" data-run-focus>Open the title</button>') +
        '<button class="btn btn--ghost" type="button" data-act="again" data-run-focus>Play again</button>' +
      "</div>" +
      '<div class="run__share"><button class="run__text" type="button" data-act="share">' + G + 'g-share"/></svg>Share this run</button>' + (clip.has() ? '<button class="run__text" type="button" data-act="clip">' + G + 'g-play"/></svg>Save the last ten seconds</button>' : "") + '<span data-run-crewline hidden data-run-live></span></div>' +
      '<div class="run__board" data-run-board hidden></div>';
    openPanel("complete", html);
    sheet.dataset.next = nextL ? nextL.id : "";
    fetchBoard(LV.id, $("[data-run-board]", sheet));
  }
  function showPlatinum(then) {
    var tr = LIB.trophies[LIB.platinum];
    confetti(); hap("success"); sting("trophy-platinum"); flash(still() ? 0.12 : 0.4);
    openPanel("platinum", '<div class="run__plat"><span class="run__platm"><img src="assets/game/medals/' + LIB.platinum + '-160.webp" alt="" width="132" height="132" /><img class="run__sheen" src="assets/game/medals/sheen.webp" alt="" /></span>' +
      '<h2 class="run__h" id="run-h">' + E(tr.name) + '</h2><p class="run__sub">Every medal in the run. ' + E(String(tr.desc).split(". ")[0]) + '.</p><div class="run__acts"><button class="btn btn--primary" type="button" data-act="platok" data-run-focus>Continue</button><a class="btn" href="' + E(LIB.pdf) + '" data-resume="pdf" data-where="run" download="Jason Obawemimo - Resume.pdf">Resume PDF</a></div></div>');
    sheet.onclick = function (e) { if (e.target.closest('[data-act="platok"]')) { sheet.onclick = null; then(); } };
    say("Platinum trophy. " + tr.name + ".");
  }

  /* one listener for every panel's buttons */
  sheet.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act],[data-opt]"); if (!b || sheet.onclick) return;
    var a = b.getAttribute("data-act"), o = b.getAttribute("data-opt");
    if (o) { if (o === "clip") { clip.toggle(); } else { SAVE.opts[o] = SAVE.opts[o] ? 0 : 1; save(); timerEl.hidden = !SAVE.opts.timer; } b.setAttribute("aria-pressed", o === "clip" ? clip.on : !!SAVE.opts[o]); if (window.JG_FX) window.JG_FX("choice"); return; }
    if (a === "resume" || a === "back" && panelName === "levels" && !panelBack) { closePanel(); return; }
    if (a === "back") { (panelBack || pause)(); return; }
    if (a === "restart") { if (window.JG_FX) window.JG_FX("choice"); closePanel(); runTotal.on = false; load(LV.id, "restart"); return; }
    if (a === "levels") { if (window.JG_FX) window.JG_FX("choice"); levelsPanel(); return; }
    if (a === "char") { if (window.JG_FX) window.JG_FX("choice"); charPanel(); return; }
    if (a === "board") { if (window.JG_FX) window.JG_FX("choice"); boardPanel(); return; }
    if (a === "go") { if (window.JG_FX) window.JG_FX("choice"); closePanel(); runTotal.on = false; load(b.getAttribute("data-id"), "select"); return; }
    if (a === "cv") { close("resume"); setTimeout(function () { if (window.JG_OPEN) window.JG_OPEN("deck", "run"); }, 120); return; }
    if (a === "quit" || a === "library") { close(a); return; }
    if (a === "next") { if (window.JG_FX) window.JG_FX("choice"); var n = sheet.dataset.next; closePanel(); load(n, "next"); return; }
    if (a === "again") { if (window.JG_FX) window.JG_FX("choice"); closePanel(); runTotal.on = false; load(LV.id, "again"); return; }
    if (a === "title") { var id = LV.id; close("title"); if (window.JG_GAME) window.JG_GAME.open(id, "run"); return; }
    if (a === "early") { if (window.JG_FX) window.JG_FX("send"); T("cta_click", { cta: "obavia_early", where: "run" }); return; }
    if (a === "share") { share(); return; }
    if (a === "clip") { clip.save(); return; }
  });

  /* ---------- share: a card drawn in the page, the Web Share sheet or a download ---------- */
  function shareCanvas() {
    var c = document.createElement("canvas"); c.width = 1080; c.height = 1350;
    var g = c.getContext("2d"), t = TITLES[LV.id] || {}, im = W.plate;
    g.fillStyle = INK; g.fillRect(0, 0, 1080, 1350);
    if (im && im.complete && im.naturalWidth) { var h = 1350, w = h * im.naturalWidth / im.naturalHeight; g.globalAlpha = 0.85; g.drawImage(im, (1080 - w) * 0.62, 0, w, h); g.globalAlpha = 1; }
    var gr = g.createLinearGradient(0, 0, 0, 1350); gr.addColorStop(0, "rgba(10,15,13,0.55)"); gr.addColorStop(0.5, "rgba(10,15,13,0.25)"); gr.addColorStop(1, "rgba(10,15,13,0.92)"); g.fillStyle = gr; g.fillRect(0, 0, 1080, 1350);
    g.strokeStyle = "rgba(237,231,219,0.6)"; g.lineWidth = 2; g.strokeRect(36, 36, 1008, 1278); g.strokeStyle = "rgba(237,231,219,0.25)"; g.lineWidth = 1; g.strokeRect(50, 50, 980, 1250);
    var gl = g.createRadialGradient(540, 760, 10, 540, 760, 360); gl.addColorStop(0, "rgba(246,222,170,0.35)"); gl.addColorStop(1, "rgba(246,222,170,0)"); g.fillStyle = gl; g.fillRect(0, 300, 1080, 900);
    g.strokeStyle = "rgba(237,231,219,0.5)"; g.beginPath(); g.moveTo(300, 900); g.lineTo(780, 900); g.stroke();
    g.save(); g.translate(540, 900); g.scale(9, 9); figure(g, look(), { face: 1, t: 0.4, blink: 1, cheer: 0.1 }); g.restore();
    g.fillStyle = "#ede7db"; g.textAlign = "center";
    g.font = "600 30px 'Hanken Grotesk', sans-serif"; g.fillText("AFTER HOURS: THE RUN", 540, 140);
    g.font = "600 92px 'Cormorant Garamond', serif"; g.fillText(String(t.logo || LV.id).toUpperCase(), 540, 250);
    g.font = "500 64px 'Hanken Grotesk', sans-serif"; g.fillText(fmt(SAVE.best[LV.id] || levelT), 540, 1010);
    var ms = W.medals, n = ms.length, sx = 540 - (n * 110 - 20) / 2;
    ms.forEach(function (m, i) { var x = sx + i * 110; if (SAVE.medals[m.slug] && m.img.complete) g.drawImage(m.img, x, 1060, 90, 90); else { g.strokeStyle = "rgba(237,231,219,0.35)"; g.setLineDash([6, 6]); g.beginPath(); g.arc(x + 45, 1105, 42, 0, 7); g.stroke(); g.setLineDash([]); } });
    g.font = "500 30px 'Hanken Grotesk', sans-serif"; g.fillStyle = "rgba(237,231,219,0.85)"; g.fillText("jasonobawemimo.com/?run=" + LV.id, 540, 1250);
    return c;
  }
  function share() {
    if (window.JG_FX) window.JG_FX("send");
    var c = shareCanvas(), url = "https://jasonobawemimo.com/?run=" + LV.id, t = TITLES[LV.id] || {};
    var text = "I cleared " + (t.logo || LV.id) + " in After Hours: The Run.";
    c.toBlob(function (b) {
      if (!b) return;
      var f = null; try { f = new File([b], "after-hours-" + LV.id + ".png", { type: "image/png" }); } catch (e) {}
      if (f && navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: "After Hours: The Run", text: text, url: url }).catch(function () {}); T("game_shared", { level: LV.id, how: "share" }); return; }
      var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "after-hours-" + LV.id + ".png"; body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      if (window.JG_COPY) window.JG_COPY(url).then(function () { if (window.JG_TOAST) window.JG_TOAST("Card saved. The link is copied too."); });
      T("game_shared", { level: LV.id, how: "download" });
    }, "image/png");
  }

  /* ---------- the clip: the last ten seconds of the canvas, where the browser can ---------- */
  var clip = (function () {
    var ok = !!(cv.captureStream && window.MediaRecorder);
    var mime = ok ? ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].filter(function (m) { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } })[0] : null;
    ok = ok && !!mime;
    var on = ok && !COARSE.matches && store.get("jg_run_clip") !== "0", rec = null, chunks = [], begun = 0, prevBlob = null, prevLen = 0, lastBlob = null, timer = 0, stream = null;
    function startRec() {
      if (!ok || !on || !OPEN) return;
      try { stream = stream || cv.captureStream(30); rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 }); } catch (e) { ok = false; return; }
      chunks = []; begun = performance.now();
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      var mine = rec;
      rec.onstop = function () { if (mine._keep !== false) { prevBlob = new Blob(chunks.slice(), { type: mime }); prevLen = (performance.now() - begun) / 1000; } };
      rec.start(1000);
      clearTimeout(timer); timer = setTimeout(cycle, 12000);
    }
    function cycle() { if (!rec) return; try { rec.stop(); } catch (e) {} rec = null; startRec(); }
    return {
      get ok() { return ok; }, get on() { return on; },
      start: function () { if (rec) { try { rec._keep = false; rec.stop(); } catch (e) {} rec = null; } prevBlob = null; lastBlob = null; startRec(); },
      stop: function () { clearTimeout(timer); if (rec) { try { rec.stop(); } catch (e) {} rec = null; } },
      toggle: function () { on = !on; store.set("jg_run_clip", on ? "1" : "0"); if (on) startRec(); else this.stop(); },
      /* at the finish, keep whichever recording holds most of the last ten seconds */
      mark: function () {
        if (!rec) return;
        var len = (performance.now() - begun) / 1000, cur = rec, ch = chunks;
        clearTimeout(timer);
        cur.onstop = function () { lastBlob = len >= 8 || !prevBlob ? new Blob(ch.slice(), { type: mime }) : prevBlob; };
        try { cur.stop(); } catch (e) {} rec = null;
      },
      has: function () { return ok && on; },
      save: function () {
        var go = function () {
          var b = lastBlob || prevBlob; if (!b) return;
          var ext = /mp4/.test(mime) ? "mp4" : "webm", name = "after-hours-" + (LV ? LV.id : "run") + "." + ext;
          var f = null; try { f = new File([b], name, { type: mime.split(";")[0] }); } catch (e) {}
          if (f && navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: "After Hours: The Run" }).catch(function () {});
          else { var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
          if (window.JG_FX) window.JG_FX("send"); T("game_clip", { level: LV ? LV.id : "" });
        };
        if (lastBlob || prevBlob) go(); else setTimeout(go, 400);
      }
    };
  })();

  /* ---------- the community: boards, ghosts, tonight's crew (api/run.js) ---------- */
  var COMM = { on: false, tried: false };
  function api(qs) { return fetch("/api/run?" + qs, { headers: { Accept: "application/json" } }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  function loadGhosts(id) {
    var mine = jget("jg_run_ghost_" + id, null);
    if (mine && mine.s) GHOSTS.push({ s: mine.s, c: mine.c, mine: 1 });
    if (PRIVATE) return;
    api("level=" + encodeURIComponent(id) + (SAVE.opts.ghosts ? "&ghosts=1" : "")).then(function (j) {
      if (!j || !j.on) { COMM.on = false; crew(null); return; }
      COMM.on = true; crew(j.crew);
      if (!COMM.hello) { COMM.hello = 1; fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hello: 1, pid: pid }), keepalive: true }).catch(function () {}); }
      if (LV && LV.id === id) (j.ghosts || []).slice(0, 3).forEach(function (g) { if (g && g.s && g.pid !== pid) GHOSTS.push({ s: g.s, c: g.c }); });
    });
  }
  function crew(n) {
    if (typeof n === "number" && n >= 2) { crewEl.textContent = n + " players have walked the lot tonight"; crewEl.hidden = false; }
    else crewEl.hidden = true;
  }
  function cleanName(s) { return String(s || "").normalize("NFKD").replace(/[^\w ]|_/g, "").replace(/\s+/g, " ").trim().slice(0, 16); }
  function postRun(level, ms, medals, samples) {
    if (PRIVATE || !COMM.on) return;
    var name = cleanName(store.get("jg_run_name") || store.get("jg_name") || "") || "Player";
    var payload = { level: level, ms: ms, medals: medals, name: name, pid: pid, c: CHAR.me ? { me: 1 } : CHAR };
    if (samples && samples.length) payload.s = samples.length > 1200 ? samples.slice(0, 1200) : samples;
    fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: payload.s ? false : true }).catch(function () {});
  }
  function boardHTML(j, id) {
    var list = (j && j.board) || []; if (!list.length) return "";
    return '<p class="run__k">' + (id === "all" ? "The whole run" : "Fastest tonight and before") + '</p><ol class="run__rank" data-run-live>' + list.slice(0, 8).map(function (r, i) {
      var c = r.c && !r.c.me ? r.c : JASON, l = look(c);
      return '<li class="' + (r.pid === pid ? "is-me" : "") + '"><span class="run__pos">' + (i + 1) + '</span><i class="run__dot" style="background:' + E(l.suit) + ";box-shadow:inset 0 -5px 0 " + E(l.skin) + '"></i><b>' + E(cleanName(r.name) || "Player") + "</b><span>" + fmt(r.ms) + (r.medals != null ? " &middot; " + (r.medals | 0) + " medals" : "") + "</span></li>";
    }).join("") + "</ol>";
  }
  function fetchBoard(id, box) {
    if (!box || PRIVATE) return;
    api("level=" + encodeURIComponent(id)).then(function (j) {
      if (!j || !j.on || !box.isConnected) return;
      var h = boardHTML(j, id); if (!h) return;
      box.innerHTML = h; box.hidden = false;
      var cl = $("[data-run-crewline]", sheet); if (cl && j.crew >= 2) { cl.textContent = j.crew + " players have walked the lot tonight."; cl.hidden = false; }
    });
  }
  function boardPanel() {
    var name = cleanName(store.get("jg_run_name") || store.get("jg_name") || "");
    openPanel("board", '<h2 class="run__h" id="run-h">Boards</h2><form class="run__name" data-run-nameform><label class="run__k" for="run-name">Your name on the boards</label><input id="run-name" maxlength="16" autocomplete="off" spellcheck="false" placeholder="Player" value="' + E(name) + '" /><button class="btn btn--sm" type="submit">Save</button><p class="run__fine">Letters, numbers and spaces, up to sixteen. Nothing else about you is shown.</p></form><div data-run-board-l></div><div data-run-board-a></div><p class="run__fine"><button class="run__text" type="button" data-act="back" data-run-focus>Back</button></p>', pause);
    fetchBoard(LV.id, $("[data-run-board-l]", sheet));
    fetchBoard("all", $("[data-run-board-a]", sheet));
    var f = $("[data-run-nameform]", sheet);
    f.addEventListener("submit", function (e) { e.preventDefault(); var v = cleanName($("#run-name", sheet).value); store.set("jg_run_name", v); $("#run-name", sheet).value = v; if (window.JG_FX) window.JG_FX("send"); if (window.JG_TOAST) window.JG_TOAST(v ? "Saved" : "You'll show as Player"); });
  }

  /* ---------- portrait phones: play upright at once, the sideways view is a suggestion ---------- */
  var turnEl = $("[data-run-turn]", el), turnHidden = false;
  function orient() {
    var portrait = COARSE.matches && innerHeight > innerWidth * 1.05;
    el.classList.toggle("is-upright", portrait);
    el.classList.toggle("is-touch", COARSE.matches || (navigator.maxTouchPoints > 0 && !matchMedia("(hover: hover)").matches));
    turnEl.hidden = !portrait || turnHidden;
  }
  function hideTurn() { if (!turnEl.hidden) { turnHidden = true; turnEl.hidden = true; } }
  turnEl.addEventListener("click", function (e) { if (e.target.closest("[data-run-upright]")) { hideTurn(); } });

  /* ---------- HUD buttons ---------- */
  $("[data-run-pause]", el).addEventListener("click", function () { if (window.JG_FX) window.JG_FX("choice"); pause(true); });
  $("[data-run-cv]", el).addEventListener("click", function () { close("resume"); setTimeout(function () { if (window.JG_OPEN) window.JG_OPEN("deck", "run"); }, 120); });

  /* the tab hidden: everything holds */
  document.addEventListener("visibilitychange", function () { if (document.hidden && OPEN && RUNNING) pause("hidden"); });

  /* ---------- open and close ---------- */
  var fsMine = false;
  function open(id, how) {
    if (!id || !BYID[id]) id = LEVELS.filter(function (l) { return !SAVE.cleared[l.id]; }).map(function (l) { return l.id; })[0] || LEVELS[0].id;
    if (!OPEN) {
      OPEN = true; el.hidden = false; root.classList.add("run-on");
      if (window.JG_LOCK) window.JG_LOCK(true);
      orient(); resize(); seedRain();
      last = performance.now(); acc = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
      requestAnimationFrame(function () { el.classList.add("is-on"); });
      el.setAttribute("tabindex", "-1"); el.focus({ preventScroll: true });
      if (/^#play/.test(location.hash) === false) { try { history.pushState({ run: 1 }, "", location.pathname + location.search + "#play/" + id); } catch (e) {} }
    }
    if (!panel.hidden) closePanel();
    runTotal = { on: BYID[id].n === 0, ms: 0, splits: [] };
    RUNNING = true;
    load(id, how);
  }
  /* fullscreen and a sideways lock on phones, from the press itself (game.js calls this in the gesture) */
  function wantFullscreen() {
    if (!COARSE.matches || document.fullscreenElement) return;
    var d = document.documentElement, rq = d.requestFullscreen || d.webkitRequestFullscreen;
    if (!rq) return;
    try { var p = rq.call(d, { navigationUI: "hide" }); fsMine = true; if (p && p.then) p.then(function () { if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(function () {}); }).catch(function () { fsMine = false; }); } catch (e) {}
  }
  function close(how) {
    if (!OPEN) return;
    OPEN = false; RUNNING = false; cancelAnimationFrame(raf);
    stopLine(); clip.stop();
    if (!finished) T("game_quit", { level: LV ? LV.id : "", how: how || "", ms: Math.round(levelT) });
    panel.hidden = true; panel.classList.remove("is-on"); el.classList.remove("has-panel"); panelName = "";
    el.classList.remove("is-on"); root.classList.remove("run-on");
    setTimeout(function () { if (!OPEN) el.hidden = true; }, 360);
    if (window.JG_LOCK) window.JG_LOCK(false);
    if ((fsMine || window.JG_RUN_FS) && document.fullscreenElement && document.exitFullscreen) { document.exitFullscreen().catch(function () {}); } fsMine = false; window.JG_RUN_FS = false;
    if (/^#play/.test(location.hash)) { try { history.pushState({}, "", location.pathname + location.search); } catch (e) {} }
    if (SC() && window.JG_GAME && window.JG_GAME.focusId) SC().focus(window.JG_GAME.focusId());
    document.dispatchEvent(new CustomEvent("jg:run-closed", { detail: { how: how || "" } }));
  }


  /* ?debug=run: a read-only view of the level and the player for tools/verify/run-bot.mjs.
     Without the flag it doesn't exist; with it, it only reads. */
  if (/[?&]debug=run(&|$)/.test(location.search)) {
    var dOn = function (o) {
      if (!o) return null; if (o === "solid") return { k: "solid" };
      var i = W.movers.indexOf(o); if (i >= 0) return { k: "mover", i: i };
      i = W.ghosts.indexOf(o); if (i >= 0) return { k: "ghost", i: i };
      i = W.ones.indexOf(o); return { k: "one", i: i };
    };
    var box = function (b) { return { x: b.x, y: b.y, w: b.w, h: b.h }; };
    window.JG_RUN_DEBUG = {
      P: Object.assign({}, P), STEP: STEP, TS: TS, still: still(),
      state: function () {
        if (!W || !PL) return null;
        return {
          level: LV.id, open: OPEN, running: RUNNING, panel: panelName, finished: finished, started: started,
          steps: W.steps, t: W.t, acc: acc, hitstop: hitstop, levelT: levelT, deaths: W.deaths,
          pl: { x: PL.x, y: PL.y, vx: PL.vx, vy: PL.vy, ground: PL.ground, on: dOn(PL.on), face: PL.face, coyote: PL.coyote, buf: PL.buf, boost: PL.boost || 0, drop: PL.drop || 0, fallV: PL.fallV, dead: PL.dead },
          input: { x: IN.x, run: IN.run, jump: IN.jump, jumpPress: IN.jumpPress, down: IN.down },
          groups: Object.assign({}, W.groups),
          ghosts: W.ghosts.map(function (g) { return { on: g.on, a: g.a }; }),
          doors: W.doors.map(function (d) { return d.open; }),
          medals: W.medals.map(function (m) { return { slug: m.slug, got: !!SAVE.medals[m.slug], now: m.now }; }),
          check: W.check ? { x: W.check.x, y: W.check.y } : null
        };
      },
      level: function () {
        if (!W) return null;
        return {
          id: LV.id, w: W.w, top: W.top, bot: W.bot, spawn: LV.spawn.slice(),
          solids: W.solids.map(function (s) { var b = box(s); b.look = s.look; return b; }),
          ones: W.ones.map(function (o) { return { x: o.x, y: o.y, w: o.w, look: o.look }; }),
          movers: W.movers.map(function (m) { return { x0: m.x0, y0: m.y0, w: m.w, dx: m.dx, dy: m.dy, per: m.per, ph: m.ph }; }),
          pads: W.pads.map(function (p) { return { x: p.x, y: p.y, w: p.w }; }),
          ghosts: W.ghosts.map(function (g) { return { x: g.x, y: g.y, w: g.w, g: g.g }; }),
          doors: W.doors.map(function (d) { return { x: d.x, y: d.y, w: d.w, h: d.h, g: d.g }; }),
          trigs: W.trigs.map(function (t) { return { x: t.x, y: t.y, w: t.w, h: t.h, g: t.g }; }),
          lamps: W.lamps.map(function (l) { return { x: l.x, y: l.y }; }),
          medals: W.medals.map(function (m) { return { slug: m.slug, x: m.x, y: m.y, where: m.where, tier: m.tier }; }),
          goal: W.goal ? { x: W.goal.x, y: W.goal.y, w: W.goal.w, h: W.goal.h } : null
        };
      }
    };
  }

  window.JG_RUN = {
    open: open, close: close, isOpen: function () { return OPEN; }, fullscreen: wantFullscreen,
    levels: LEVELS.map(function (l) { return l.id; }),
    debug: {
      state: function () { return { open: OPEN, running: RUNNING, level: LV && LV.id, x: PL && PL.x, y: PL && PL.y, vx: PL && PL.vx, ground: PL && PL.ground, started: started, finished: finished, panel: panelName, medals: W ? W.medals.map(function (m) { return { slug: m.slug, got: !!SAVE.medals[m.slug] }; }) : [], ms: levelT, cam: { x: CAM.x, y: CAM.y }, scale: scale }; },
      warpTo: function (slug) { var m = W && W.medals.filter(function (x) { return x.slug === slug; })[0]; if (!m) return false; PL.x = m.x - P.w / 2; PL.y = m.y - P.h / 2; PL.vx = 0; PL.vy = 0; return true; },
      warpGoal: function () { if (!W || !W.goal) return false; PL.x = W.goal.x + W.goal.w / 2 - P.w / 2; PL.y = W.goal.y - P.h - 2; PL.vy = 0; return true; },
      support: function (dx, dy) { if (!PL) return false; var x = PL.x + P.w / 2 + dx, y = PL.y + P.h + dy; var hit = function (b) { return x >= b.x && x <= b.x + b.w && y >= b.y - 2 && y <= b.y + (b.h || 14); }; return solidList().some(hit) || oneList().some(hit) || W.pads.some(hit); },
      warp: function (tx, ty) { PL.x = tx * TS; PL.y = ty * TS - P.h; PL.vx = 0; PL.vy = 0; }
    }
  };
})();
