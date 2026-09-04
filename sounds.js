/* The sample bank. Real recordings for the moments that need weight: water
   for the loader, air for the transitions, keys for the name, one click
   for a choice, one sparkle for the unlock. The synthesized glass tones in
   guide.js still carry the melody; these sit underneath them.

   window.JG_SFX.play(name, { gain, rate, delay, variant, vary, throttle })
   returns true when a sample actually played, so callers can fall back to
   the synth while a file is still loading. Sources and licenses are in
   assets/sfx/CREDITS.md. */
(function () {
  "use strict";
  var BASE = "assets/sfx/", V = "1";
  var BANK = {
    drop: { f: ["drop-1.wav", "drop-2.wav", "drop-3.wav", "drop-4.wav"], g: 0.55 },
    splash: { f: ["splash.mp3"], g: 0.5 },
    plunge: { f: ["plunge.mp3"], g: 0.45 },
    swoosh: { f: ["swoosh.mp3"], g: 0.42 },
    "swoosh-long": { f: ["swoosh-long.mp3"], g: 0.38 },
    "swoosh-deep": { f: ["swoosh-deep.mp3"], g: 0.5 },
    sparkle: { f: ["sparkle.wav"], g: 0.5 },
    open: { f: ["open.wav"], g: 0.32 },
    select: { f: ["select.wav"], g: 0.45 },
    key: { f: ["key-1.wav", "key-2.wav", "key-3.wav", "key-4.wav"], g: 0.4 },
    "key-back": { f: ["key-back.wav"], g: 0.36 },
    chime: { f: ["chime-soft.wav"], g: 0.3 }
  };
  var AC = null, out = null, muted = false;
  try { muted = localStorage.getItem("jg_muted") === "1"; } catch (e) {}
  var bufs = {}, loading = {}, rr = {}, last = {};
  var RD = matchMedia("(prefers-reduced-data: reduce)").matches || (navigator.connection && navigator.connection.saveData);

  function ctx() {
    if (AC) return AC;
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      out = AC.createGain(); out.gain.value = muted ? 0 : 1; out.connect(AC.destination);
    } catch (e) { AC = null; }
    return AC;
  }
  function load(file) {
    if (bufs[file]) return Promise.resolve(bufs[file]);
    if (loading[file]) return loading[file];
    var c = ctx(); if (!c) return Promise.reject();
    loading[file] = fetch(BASE + file + "?v=" + V).then(function (r) { return r.arrayBuffer(); }).then(function (ab) {
      return new Promise(function (res, rej) { c.decodeAudioData(ab, function (b) { bufs[file] = b; res(b); }, rej); });
    }).catch(function () { delete loading[file]; });
    return loading[file];
  }
  function warm(names) {
    if (RD) return;
    (names || Object.keys(BANK)).forEach(function (n) { var e = BANK[n]; if (e) e.f.forEach(load); });
  }
  function play(name, o) {
    o = o || {};
    var e = BANK[name]; if (!e || muted) return false;
    var c = ctx(); if (!c) return false;
    var now = performance.now();
    if (o.throttle && last[name] && now - last[name] < o.throttle) return false;
    var i = o.variant != null ? o.variant % e.f.length : (rr[name] = ((rr[name] || 0) + 1 + (e.f.length > 2 ? Math.floor(Math.random() * 2) : 0)) % e.f.length);
    var file = e.f[i], b = bufs[file];
    if (!b) { load(file); return false; }
    last[name] = now;
    if (c.state === "suspended") c.resume();
    var s = c.createBufferSource(); s.buffer = b;
    s.playbackRate.value = (o.rate || 1) * (o.vary === false ? 1 : 1 + (Math.random() - 0.5) * 0.07);
    var g = c.createGain(); g.gain.value = e.g * (o.gain == null ? 1 : o.gain);
    s.connect(g); g.connect(out);
    s.start(c.currentTime + (o.delay || 0));
    return true;
  }
  function mute(m) {
    muted = !!m;
    if (out && AC) out.gain.setTargetAtTime(muted ? 0 : 1, AC.currentTime, 0.02);
  }
  window.JG_SFX = { play: play, warm: warm, mute: mute, ctx: ctx, muted: function () { return muted; } };

  /* Decoding does not need a gesture, only playback does, so the small
     files come down as soon as the page is idle. */
  var first = document.body && document.body.classList.contains("is-loading") ? ["drop", "splash", "swoosh-long", "swoosh-deep", "swoosh", "select", "key", "open"] : ["select", "sparkle", "swoosh", "key"];
  if ("requestIdleCallback" in window) requestIdleCallback(function () { warm(first); }, { timeout: 1500 }); else setTimeout(function () { warm(first); }, 300);
  ["pointerdown", "keydown", "touchstart"].forEach(function (ev) { addEventListener(ev, function () { warm(); }, { once: true, passive: true }); });
})();
