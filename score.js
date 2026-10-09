/* The score: an adaptive piece in layers, played from stems that all start on
   the same clock so any mix of them is in time. Focusing a title fades its
   layer in from the next bar line; trophies and opens play stings quantized
   to the beat; the music ducks under them. Nothing loads or plays until the
   visitor turns the score on (the title screen's Start does, Start muted does
   not), and the choice is remembered.

   window.JG_SCORE
     .isOn()                 is the score playing (or about to)
     .set(on, where)         turn it on or off; on needs a user gesture the first time
     .toggle(where)
     .focus(id)              bring a title's layer in on the next bar ("bed" alone for none)
     .sting(name)            "open" | "trophy-bronze" | "trophy-silver" | "trophy-gold" | "trophy-platinum" | "level-clear" | "start"
     .tick()                 the soft focus-move tick, tuned to the piece
     .voice(on)              hold the music down under a narrator's line (tour.js), and let it back up
   window.JG_SFX            the old effects API, kept so older modules stay quiet and unbroken
   Event: document "jg:score" { on } */
(function () {
  "use strict";
  var BASE = "assets/score/";
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  function T(e, p) { if (window.JG_TRACK) window.JG_TRACK(e, p); }
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master = null, music = null, fxBus = null, comp = null, veil = null, veilLp = null, veiled = false;
  var manifest = null, manifestP = null;
  var buffers = {}, loading = {};
  var layers = {}; /* id -> { gain, src } */
  var t0 = 0, playing = false, wanted = false, focusId = "bed";
  var on = store.get("jg_score") === "1"; /* remembered, but never autoplays: a gesture starts it */

  function ext() {
    var a = document.createElement("audio");
    if (a.canPlayType && a.canPlayType('audio/ogg; codecs="opus"')) return "ogg";
    if (a.canPlayType && a.canPlayType('audio/mp4; codecs="mp4a.40.2"')) return "m4a";
    return "mp3";
  }
  var EXT = ext();

  function loadManifest() {
    if (!manifestP) manifestP = fetch(BASE + "score.json?v=2", { cache: "force-cache" }).then(function (r) { if (!r.ok) throw new Error("no score"); return r.json(); }).then(function (m) { manifest = m; return m; });
    return manifestP;
  }
  function srcOf(entry) {
    if (!entry) return null;
    if (typeof entry === "string") return BASE + entry;
    return BASE + (entry[EXT] || entry.m4a || entry.mp3 || entry.ogg);
  }
  function load(key, entry) {
    if (buffers[key]) return Promise.resolve(buffers[key]);
    if (loading[key]) return loading[key];
    var url = srcOf(entry); if (!url) return Promise.reject(new Error("no " + key));
    loading[key] = fetch(url).then(function (r) { if (!r.ok) throw new Error(key); return r.arrayBuffer(); })
      .then(function (ab) { return new Promise(function (res, rej) { ctx.decodeAudioData(ab, res, rej); }); })
      .then(function (b) { buffers[key] = b; return b; });
    return loading[key];
  }

  function build() {
    if (ctx) return true;
    if (!AC) return false;
    try { ctx = new AC({ latencyHint: "playback" }); } catch (e) { try { ctx = new AC(); } catch (x) { return false; } }
    master = ctx.createGain(); master.gain.value = 0;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 2.2; comp.attack.value = 0.02; comp.release.value = 0.4;
    var shelf = ctx.createBiquadFilter(); shelf.type = "highshelf"; shelf.frequency.value = 9000; shelf.gain.value = -1.5;
    music = ctx.createGain(); music.gain.value = 1;
    fxBus = ctx.createGain(); fxBus.gain.value = 0.9;
    /* the veil: when the visitor goes into something to read, the score steps back and goes soft, as if heard from the next room */
    veil = ctx.createGain(); veil.gain.value = 1;
    veilLp = ctx.createBiquadFilter(); veilLp.type = "lowpass"; veilLp.frequency.value = 18000; veilLp.Q.value = 0.5;
    music.connect(veilLp); veilLp.connect(veil); veil.connect(comp); fxBus.connect(comp);
    setTimeout(syncVeil, 0); comp.connect(shelf); shelf.connect(master); master.connect(ctx.destination);
    return true;
  }

  function loopLen() { return manifest ? manifest.loopSeconds : 58.18; }
  function barLen() { return manifest ? (60 / manifest.bpm) * (manifest.beatsPerBar || 4) : 3.636; }
  function nextBar(after) {
    var b = barLen(), now = after || ctx.currentTime;
    return t0 + Math.ceil((now - t0 + 0.05) / b) * b;
  }
  function nextEighth() {
    var e = manifest ? 30 / manifest.bpm : 0.4545, now = ctx.currentTime;
    return t0 + Math.ceil((now - t0 + 0.02) / e) * e;
  }

  /* a layer joins the running loop in phase, at gain 0, then follows focus */
  function startLayer(id) {
    if (layers[id] || !buffers[id] || !playing) return;
    var src = ctx.createBufferSource(); src.buffer = buffers[id]; src.loop = true;
    var L = Math.min(loopLen(), buffers[id].duration); src.loopStart = 0; src.loopEnd = L;
    var g = ctx.createGain(); g.gain.value = 0;
    src.connect(g); g.connect(music);
    var when = ctx.currentTime + 0.06, off = ((when - t0) % L + L) % L;
    src.start(when, off);
    layers[id] = { gain: g, src: src };
    target(id, (id === "bed" || id === focusId) ? level(id) : 0, when, id === "bed" ? 2.5 : 1.5);
  }
  function level(id) { var m = manifest && manifest.levels; return (m && m[id] != null) ? m[id] : (id === "bed" ? 0.85 : 0.8); }
  function target(id, v, at, secs) {
    var l = layers[id]; if (!l) return;
    var g = l.gain.gain, t = Math.max(at, ctx.currentTime);
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v, t + secs);
  }

  function begin() {
    if (playing || !wanted) return;
    loadManifest().then(function (m) {
      if (!wanted) return;
      return load("bed", m.stems.bed).then(function () {
        if (!wanted || playing) return;
        playing = true; t0 = ctx.currentTime + 0.1;
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(0, ctx.currentTime);
        master.gain.linearRampToValueAtTime(MASTER, ctx.currentTime + 2.5);
        startLayer("bed");
        /* the focused title's layer first, then the rest stream in */
        var order = [focusId].concat(Object.keys(m.stems).filter(function (k) { return k !== "bed" && k !== focusId; }));
        order.reduce(function (p, id) { return p.then(function () { if (id === "bed" || !m.stems[id]) return; return load(id, m.stems[id]).then(function () { startLayer(id); }).catch(function () {}); }); }, Promise.resolve());
        /* stings and the tick are small; load them after the bed */
        Object.keys(m.stings || {}).forEach(function (k) { load("sting:" + k, m.stings[k]).catch(function () {}); });
        (m.ticks || []).forEach(function (t, i) { load("tick:" + i, t).catch(function () {}); });
      });
    }).catch(function () { /* no score shipped yet: stay silent and say so in the label */ paint(true); });
  }

  function stopAll(fade) {
    if (!ctx) return;
    var now = ctx.currentTime;
    master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now); master.gain.linearRampToValueAtTime(0, now + (fade || 0.6));
    var ls = layers; layers = {}; playing = false;
    setTimeout(function () { Object.keys(ls).forEach(function (k) { try { ls[k].src.stop(); } catch (e) {} }); }, ((fade || 0.6) + 0.1) * 1000);
  }

  function set(v, where) {
    v = !!v;
    on = v; store.set("jg_score", v ? "1" : "0");
    wanted = v;
    if (v) {
      if (!build()) { on = false; wanted = false; paint(); return false; }
      if (ctx.state === "suspended") ctx.resume();
      try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch (e) {}
      begin();
    } else stopAll(0.6);
    paint();
    document.dispatchEvent(new CustomEvent("jg:score", { detail: { on: v } }));
    if (where) T("sound_toggled", { on: v, where: where });
    return true;
  }

  function paint(missing) {
    document.querySelectorAll('[data-toggle="sound"]').forEach(function (b) { b.setAttribute("aria-pressed", on ? "true" : "false"); b.classList.toggle("is-on", on); });
    document.querySelectorAll("[data-score-label]").forEach(function (s) { s.textContent = on ? "Score on" : "Score off"; });
    document.documentElement.classList.toggle("score-on", on);
  }

  function focus(id) {
    focusId = id || "bed";
    if (!playing) return;
    var at = nextBar();
    Object.keys(layers).forEach(function (k) { if (k !== "bed") target(k, k === focusId ? level(k) : 0, at, 1.5); });
    if (!layers[focusId] && manifest && manifest.stems[focusId]) load(focusId, manifest.stems[focusId]).then(function () { startLayer(focusId); }).catch(function () {});
  }

  /* the overall level sits a little under the mix, and lower still (and muffled) while the visitor reads */
  var MASTER = 0.72, VEIL = { gain: 0.42, hz: 1600 };
  function setVeil(on, secs) {
    veiled = on;
    if (!ctx || !veil) return;
    var now = ctx.currentTime, t = secs || (on ? 0.9 : 1.6);
    veil.gain.cancelScheduledValues(now); veil.gain.setValueAtTime(veil.gain.value, now);
    veil.gain.linearRampToValueAtTime(on ? VEIL.gain : 1, now + t);
    veilLp.frequency.cancelScheduledValues(now); veilLp.frequency.setValueAtTime(veilLp.frequency.value, now);
    veilLp.frequency.exponentialRampToValueAtTime(on ? VEIL.hz : 18000, now + t);
  }
  function reading() {
    var c = document.documentElement.classList;
    return c.contains("title-open") || c.contains("screen-open") || c.contains("clear-on") || !!document.querySelector("dialog[open]");
  }
  function syncVeil() { var r = reading(); if (r !== veiled) setVeil(r); }
  if (window.MutationObserver) {
    var mo = new MutationObserver(syncVeil);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    document.addEventListener("DOMContentLoaded", function () { [].forEach.call(document.querySelectorAll("dialog"), function (d) { mo.observe(d, { attributes: true, attributeFilter: ["open"] }); }); });
  }

  var VOICE_BED = 0.3, voicing = false;
  function duck(secs) {
    if (!playing) return;
    var now = ctx.currentTime, g = music.gain, rest = voicing ? VOICE_BED : 1;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(Math.min(0.5, rest), now + 0.08); g.setValueAtTime(Math.min(0.5, rest), now + secs); g.linearRampToValueAtTime(rest, now + secs + 0.8);
  }
  /* a narrator is speaking: the music steps well back for the line, then returns */
  function voice(v) {
    voicing = !!v;
    if (!ctx || !music) return;
    var now = ctx.currentTime, g = music.gain;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(voicing ? VOICE_BED : 1, now + (voicing ? 0.3 : 1.2));
  }
  function playBuf(key, gain, when) {
    var b = buffers[key]; if (!b) return false;
    var s = ctx.createBufferSource(); s.buffer = b;
    var g = ctx.createGain(); g.gain.value = gain == null ? 1 : gain;
    s.connect(g); g.connect(fxBus); s.start(when || ctx.currentTime);
    return b.duration;
  }
  function sting(name) {
    if (!on || !ctx || !manifest || !manifest.stings || !manifest.stings[name]) return false;
    var key = "sting:" + name;
    var go = function () { var at = playing ? nextEighth() : ctx.currentTime; var d = playBuf(key, (manifest.stingGain && manifest.stingGain[name]) || 1, at); if (d) duck(Math.min(d, 3)); };
    if (buffers[key]) go(); else load(key, manifest.stings[name]).then(go).catch(function () {});
    return true;
  }
  var lastTick = -1, tickAt = 0;
  function tick() {
    if (!on || !playing || !manifest || !manifest.ticks || !manifest.ticks.length) return;
    var now = ctx.currentTime; if (now - tickAt < 0.09) return; tickAt = now;
    var n = manifest.ticks.length, i = Math.floor(Math.random() * n); if (n > 1 && i === lastTick) i = (i + 1) % n; lastTick = i;
    playBuf("tick:" + i, manifest.tickGain || 0.5);
  }

  /* the tab goes quiet when hidden and returns when shown */
  document.addEventListener("visibilitychange", function () {
    if (!ctx || !playing) return;
    var now = ctx.currentTime;
    if (document.hidden) { master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now); master.gain.linearRampToValueAtTime(0, now + 0.6); setTimeout(function () { if (document.hidden && ctx.state === "running") ctx.suspend(); }, 700); }
    else { ctx.resume().then(function () { var t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(0, t); master.gain.linearRampToValueAtTime(MASTER, t + 1.2); }); }
  });

  /* the score button anywhere on the page */
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest('[data-toggle="sound"]'); if (!b) return;
    e.preventDefault(); set(!on, b.getAttribute("data-where") || "bar");
  });
  addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    var t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if ((e.key === "m" || e.key === "M") && !document.documentElement.classList.contains("intro-on")) { e.preventDefault(); set(!on, "key"); }
  });
  /* a remembered "on" resumes on the first gesture of the visit (browsers need one) */
  if (on) {
    var resume = function () { removeEventListener("pointerdown", resume, true); removeEventListener("keydown", resume, true); if (on && !playing && !document.documentElement.classList.contains("intro-on")) set(true); };
    addEventListener("pointerdown", resume, true); addEventListener("keydown", resume, true);
  }
  paint();

  window.JG_SCORE = {
    isOn: function () { return on; },
    set: set,
    toggle: function (where) { return set(!on, where); },
    focus: focus,
    sting: sting,
    tick: tick,
    voice: voice
  };
  /* the old effects API: everything that used to click or swoosh is silent now */
  window.JG_SFX = {
    play: function (name) {
      if (name === "open" || name === "arrive") return sting("open");
      if (name === "unlock" || name === "sparkle") return sting("trophy-silver");
      return false;
    },
    mute: function () {},
    ready: function () { return !!ctx; }
  };
})();
