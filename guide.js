/* ============================================================
   The guided film. Loader and signature, the question, then
   Jason walks the visitor through the page: the camera moves,
   the page gets underlined, circled and crossed out, the lines
   are spoken. Builds its own DOM. Needs section ids and
   data-mark anchors on the page.
   ============================================================ */
(function () {
  "use strict";

  var RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var RD = matchMedia("(prefers-reduced-data: reduce)").matches;
  var LOW = (navigator.hardwareConcurrency || 4) <= 4 || innerWidth < 720;
  var body = document.body;

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  function el(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function plain(html) { return String(html).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(); }
  var hidden = false;
  document.addEventListener("visibilitychange", function () { hidden = document.hidden; });
  var JG_V = "4"; /* bumps the small JSON fetches past the long asset cache */

  /* ---------- Analytics: batched, first-party, off when Do Not Track is on ---------- */
  var AN = (function () {
    var dnt = navigator.doNotTrack === "1" || window.doNotTrack === "1";
    var id = store.get("jg_id");
    if (!id) { id = "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); store.set("jg_id", id); }
    var q = [], timer = null;
    function common() {
      var w = innerWidth, dev = w < 768 ? "Mobile" : w < 1100 && matchMedia("(pointer: coarse)").matches ? "Tablet" : "Desktop", refd = "";
      try { refd = document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) {}
      return { url: location.href.split("#")[0], ref: document.referrer || "", refd: refd, w: screen.width, h: screen.height, device: dev, lang: navigator.language };
    }
    function flush() {
      if (!q.length) return;
      var payload = JSON.stringify({ id: id, events: q.splice(0, 25), common: common() });
      try {
        if (navigator.sendBeacon && navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }))) return;
        fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(function () {});
      } catch (e) {}
    }
    function track(event, props, set) {
      if (dnt) return;
      var e = { event: event, props: props || {}, ts: Date.now() }; if (set) e.set = set;
      q.push(e); clearTimeout(timer); timer = setTimeout(flush, 900);
    }
    addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", function () { if (document.hidden) { track("page_left", { y: Math.round(scrollY) }); flush(); } });
    return { track: track, flush: flush };
  })();
  window.JG_TRACK = AN.track;

  /* Screen lock. overflow:hidden is ignored by iOS Safari, so the body is pinned in place
     while the loader, the question or the close owns the screen, and released to the same scroll position. */
  var lockY = 0, lockOn = false;
  function lockScreen(on) {
    if (on === lockOn) return; lockOn = on;
    if (on) { lockY = scrollY; body.style.position = "fixed"; body.style.top = -lockY + "px"; body.style.left = "0"; body.style.right = "0"; body.style.width = "100%"; document.documentElement.classList.add("is-locked"); }
    else { body.style.position = ""; body.style.top = ""; body.style.left = ""; body.style.right = ""; body.style.width = ""; document.documentElement.classList.remove("is-locked"); scrollTo(0, lockY); }
  }
  window.JG_LOCK = lockScreen;
  function H(k) { if (typeof window.JG_HAPTIC === "function") window.JG_HAPTIC(k); }
  function S2(n, o) { return !!(window.JG_SFX && window.JG_SFX.play(n, o)); }
  lockScreen(true);

  var I = {
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4zM16 9.5l5 5M21 9.5l-5 5"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 7l5 5-5 5"/></svg>'
  };

  /* ---------- Faces ---------- */
  var FACE_DIR = "assets/guide/", FACES = ["calm", "warm", "attentive", "serious", "surprised", "laugh", "wink"];
  var faceOk = {}, FALLBACK = "assets/jason-headshot-620.webp";
  /* assets/guide/faces.json lists which expression files exist, so nothing is requested blind */
  fetch(FACE_DIR + "faces.json?v=" + JG_V).then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
    (list || []).forEach(function (f) { if (FACES.indexOf(f) < 0) return; var im = new Image(); im.onload = function () { faceOk[f] = true; if (curFace === f) setFace(f, true); }; im.src = FACE_DIR + f + ".webp"; });
  }).catch(function () {});
  function faceSrc(f) { return faceOk[f] ? FACE_DIR + f + ".webp" : faceOk.calm ? FACE_DIR + "calm.webp" : FALLBACK; }

  /* ============================================================
     SOUND. Glass, not piano: slow attacks, long tails, a
     pentatonic in D, and a little shimmer behind everything.
     ============================================================ */
  var AC = null, muted = store.get("jg_muted") === "1", master = null, wet = null, padNodes = null, loaderDone = false, waterAlive = true;
  function unlock() {
    if (AC) return;
    try {
      AC = (window.JG_SFX && window.JG_SFX.ctx()) || new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === "suspended") AC.resume();
      master = AC.createGain(); master.gain.value = 0.55; master.connect(AC.destination);
      var d = AC.createDelay(1.5), fb = AC.createGain(), lp = AC.createBiquadFilter();
      d.delayTime.value = 0.34; fb.gain.value = 0.3; lp.type = "lowpass"; lp.frequency.value = 1400;
      wet = AC.createGain(); wet.gain.value = 0.22;
      wet.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(master);
    } catch (e) { AC = null; }
  }
  ["pointerdown", "keydown", "touchstart"].forEach(function (ev) { addEventListener(ev, unlock, { once: true, passive: true }); });
  var N = { D3: 146.83, A3: 220, D4: 293.66, E4: 329.63, Fs4: 369.99, A4: 440, B4: 493.88, D5: 587.33, E5: 659.25, Fs5: 739.99, A5: 880 };
  function glass(freq, delay, dur, peak) {
    if (!AC || muted) return;
    var t0 = AC.currentTime + (delay || 0), env = AC.createGain(), f = AC.createBiquadFilter();
    f.type = "lowpass"; f.frequency.setValueAtTime(2200, t0); f.frequency.exponentialRampToValueAtTime(900, t0 + dur);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(peak, t0 + 0.11);
    env.gain.exponentialRampToValueAtTime(peak * 0.55, t0 + 0.4);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    [[1, "sine", 1], [2, "sine", 0.16], [0.5, "triangle", 0.07]].forEach(function (p) {
      var o = AC.createOscillator(), g = AC.createGain(); o.type = p[1]; o.frequency.value = freq * p[0]; o.detune.value = (Math.random() - 0.5) * 6;
      g.gain.value = p[2]; o.connect(g); g.connect(f); o.start(t0); o.stop(t0 + dur + 0.1);
    });
    f.connect(env); env.connect(master); env.connect(wet);
  }
  var SFX = {
    tick: function () { glass(N.Fs5, 0, 0.5, 0.018); },
    select: function () { glass(N.A4, 0, 1.1, 0.04); glass(N.D5, 0.09, 1.3, 0.035); },
    chime: function () { glass(N.D5, 0, 1.4, 0.03); glass(N.A4, 0.05, 1.6, 0.022); },
    open: function () { glass(N.E4, 0, 1, 0.03); glass(N.B4, 0.1, 1.2, 0.028); },
    close: function () { glass(N.B4, 0, 1, 0.026); glass(N.E4, 0.12, 1.4, 0.026); },
    stage: function () { glass(N.D3, 0, 3.2, 0.05); glass(N.A3, 0.04, 3.2, 0.036); glass(N.Fs4, 0.35, 2.6, 0.02); glass(N.D5, 0.7, 2.4, 0.016); },
    arrive: function () { glass(N.D4, 0, 2.2, 0.03); glass(N.A4, 0.2, 2, 0.022); glass(N.E5, 0.42, 1.8, 0.016); }
  };
  /* Water. Starts on the first tap or click, because browsers keep audio silent before that. */
  var water = { bed: null, alive: false };
  function waterStart() {
    if (!AC || muted || water.bed || RD || !waterAlive) return;
    var len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    var src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
    var bp = AC.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 520; bp.Q.value = 0.6;
    var lp = AC.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400;
    var lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 260; lfo.connect(lg); lg.connect(bp.frequency); lfo.start();
    var g = AC.createGain(); g.gain.setValueAtTime(0.0001, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.05, AC.currentTime + 2.5);
    src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(master); src.start();
    water.bed = { g: g, src: src, lfo: lfo }; water.alive = true;
  }
  function waterStop() {
    if (!water.bed) return; var b = water.bed; water.bed = null; water.alive = false;
    b.g.gain.cancelScheduledValues(AC.currentTime); b.g.gain.setValueAtTime(Math.max(b.g.gain.value, 0.0001), AC.currentTime); b.g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + 1.4);
    setTimeout(function () { try { b.src.stop(); b.lfo.stop(); } catch (e) {} }, 1600);
  }
  var lastPlink = 0;
  function plink(strength) {
    if (S2("drop", { gain: 0.35 + 0.65 * strength, rate: 0.9 + (1 - strength) * 0.35, throttle: strength < 0.5 ? 140 : 40 })) return;
    if (!AC || muted || !water.alive) return;
    var now = performance.now(); if (now - lastPlink < (strength > 0.6 ? 40 : 110)) return; lastPlink = now;
    var t0 = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(), f0 = 900 + Math.random() * 700;
    o.type = "sine"; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f0 * 1.9, t0 + 0.06);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.012 + strength * 0.045, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28 + strength * 0.25);
    o.connect(g); g.connect(master); g.connect(wet); o.start(t0); o.stop(t0 + 0.6);
  }
  var pad = {
    start: function () {
      if (!AC || muted || padNodes || RD) return;
      var g = AC.createGain(), f = AC.createBiquadFilter(), lfo = AC.createOscillator(), lg = AC.createGain();
      f.type = "lowpass"; f.frequency.value = 320; lfo.frequency.value = 0.05; lg.gain.value = 90; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
      g.gain.setValueAtTime(0.0001, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.011, AC.currentTime + 3);
      var os = [73.42, 73.9, 110, 146.83].map(function (fr) { var o = AC.createOscillator(); o.type = "sine"; o.frequency.value = fr; o.connect(f); o.start(); return o; });
      f.connect(g); g.connect(master); padNodes = { g: g, os: os.concat([lfo]) };
    },
    stop: function () {
      if (!padNodes) return; var p = padNodes; padNodes = null;
      p.g.gain.cancelScheduledValues(AC.currentTime); p.g.gain.setValueAtTime(Math.max(p.g.gain.value, 0.0001), AC.currentTime);
      p.g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + 2);
      setTimeout(function () { p.os.forEach(function (o) { try { o.stop(); } catch (e) {} }); }, 2200);
    }
  };
  function setMuted(m) {
    muted = m; store.set("jg_muted", m ? "1" : "0");
    document.querySelectorAll("[data-sound-toggle]").forEach(function (b) { b.innerHTML = m ? I.mute : I.sound; b.setAttribute("aria-label", m ? "Sound is off. Turn it on" : "Sound is on. Turn it off"); b.setAttribute("aria-pressed", m ? "false" : "true"); });
    document.querySelectorAll("[data-sound-label]").forEach(function (b) { b.textContent = m ? "Sound off" : "Sound on"; b.setAttribute("aria-pressed", m ? "false" : "true"); });
    if (window.JG_SFX) window.JG_SFX.mute(m);
    if (m) { pad.stop(); voice.stop(); waterStop(); } else { unlock(); SFX.tick(); if (open) pad.start(); if (waterAlive && !loaderDone) waterStart(); }
  }
  document.addEventListener("click", function (e) { var b = e.target.closest("[data-sound-toggle],[data-sound-label]"); if (b) { e.preventDefault(); setMuted(!muted); AN.track("sound_toggled", { on: !muted }); } });

  /* ============================================================
     VOICE. Scripted lines are pre-rendered files. Live answers
     fall back to the browser's own speech.
     ============================================================ */
  var voice = (function () {
    var manifest = null, cur = null, ready = fetch("assets/voice/manifest.json?v=" + JG_V).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { manifest = j; }).catch(function () { manifest = null; });
    function hash(s) { var h = 5381, i; for (i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16); }
    function stop() {
      if (cur) { try { cur.pause(); } catch (e) {} cur = null; }
      if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {}
    }
    /* returns a promise resolving to duration in ms (0 if nothing will play) */
    function play(text, who) {
      stop();
      if (muted || RD) return Promise.resolve(0);
      var key = (who || "jason") + ":" + plain(text);
      return ready.then(function () {
        var e = manifest && manifest[hash(key)];
        if (!e) return 0;
        var a = new Audio("assets/voice/" + e.f); a.preload = "auto"; a.volume = who === "you" ? 0.85 : 1; cur = a;
        return a.play().then(function () { return Math.round(e.d * 1000); }).catch(function () { return 0; });
      });
    }
    function speak(text) {
      stop();
      if (muted || RD || !window.speechSynthesis) return 0;
      try {
        var u = new SpeechSynthesisUtterance(plain(text)), vs = speechSynthesis.getVoices(), pick = null;
        ["Google US English", "Daniel", "Alex", "Samantha", "Microsoft Guy", "Microsoft David"].some(function (n) { pick = vs.find(function (v) { return v.name.indexOf(n) === 0; }); return !!pick; });
        if (!pick) pick = vs.find(function (v) { return /^en(-|_)?(US|GB)/i.test(v.lang); }) || null;
        if (pick) u.voice = pick; u.rate = 0.98; u.pitch = 0.95; u.volume = 0.9;
        speechSynthesis.speak(u); return 1;
      } catch (e) { return 0; }
    }
    return { play: play, speak: speak, stop: stop, hash: hash };
  })();

  function scrollToY(y, dur) {
    if (typeof window.JG_SCROLL_TO === "function") window.JG_SCROLL_TO(y, RM ? 0 : dur);
    else scrollTo({ top: y, behavior: RM ? "auto" : "smooth" });
  }

  /* ============================================================
     LOADER, the signature, then the question
     ============================================================ */

  var seen = store.get("jg_seen") === "1";
  AN.track("site_arrived", { returning: seen });
  var loader = el(
    '<div id="jg-loader" role="status" aria-live="polite" aria-label="Loading">' +
      '<div class="jg-loader__wrap">' +
        '<div class="jg-loader__stage">' +
          '<div class="jg-loader__medallion"><canvas></canvas></div>' +
          '<svg class="jg-ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="jg-ring__track" cx="50" cy="50" r="48.5"/><circle class="jg-ring__progress" cx="50" cy="50" r="48.5"/></svg>' +
        '</div>' +
        '<div class="jg-loader__pct"><span>0</span><small>%</small></div>' +
        '<div class="jg-loader__name">Jason Obawemimo</div>' +
      '</div>' +
      '<div class="jg-film" aria-hidden="true"></div>' +
      '<div class="jg-title" aria-hidden="true"><div><h1>Jason <em>Obawemimo</em></h1><p>Founder of Apohenia</p></div></div>' +
      '<button class="jg-skip jg-loader__skip" type="button">Skip intro</button>' +
    '</div>'
  );
  body.appendChild(loader);
  var canvas = loader.querySelector(".jg-loader__medallion canvas"), pctEl = loader.querySelector(".jg-loader__pct span"), ringP = loader.querySelector(".jg-ring__progress");
  var RING_C = 2 * Math.PI * 48.5; ringP.style.strokeDasharray = RING_C; ringP.style.strokeDashoffset = RING_C;

  /* water: two height fields, then a displacement pass through the surface */
  var GN = LOW ? 128 : 192, cur = new Float32Array(GN * GN), prev = new Float32Array(GN * GN);
  var src = null, out = null, octx = null, vctx = null, ripplesOn = !RM && !RD;
  function setupWater(img) {
    var off = document.createElement("canvas"); off.width = GN; off.height = GN;
    octx = off.getContext("2d", { willReadFrequently: true });
    var s = Math.min(img.naturalWidth, img.naturalHeight);
    octx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) * 0.25, s, s, 0, 0, GN, GN);
    src = octx.getImageData(0, 0, GN, GN).data; out = octx.createImageData(GN, GN);
    var dpr = Math.min(devicePixelRatio || 1, 2), size = canvas.clientWidth || 300;
    canvas.width = size * dpr; canvas.height = size * dpr;
    vctx = canvas.getContext("2d"); vctx.imageSmoothingEnabled = true; vctx.imageSmoothingQuality = "high";
    if (!ripplesOn) { vctx.drawImage(off, 0, 0, canvas.width, canvas.height); return; }
    drop(GN / 2, GN / 2, 6, 14); requestAnimationFrame(waterFrame);
  }
  function drop(cx, cy, r, strength) {
    var r2 = r * r;
    for (var y = -r; y <= r; y++) for (var x = -r; x <= r; x++) {
      if (x * x + y * y > r2) continue;
      var px = (cx + x) | 0, py = (cy + y) | 0;
      if (px < 1 || py < 1 || px >= GN - 1 || py >= GN - 1) continue;
      prev[py * GN + px] += strength * (1 - (x * x + y * y) / r2);
    }
  }
  function waterFrame() {
    if (!waterAlive) return;
    if (hidden) return requestAnimationFrame(waterFrame);
    var i, x, y;
    for (y = 1; y < GN - 1; y++) { var row = y * GN; for (x = 1; x < GN - 1; x++) { i = row + x; cur[i] = ((prev[i - 1] + prev[i + 1] + prev[i - GN] + prev[i + GN]) * 0.5 - cur[i]) * 0.982; } }
    var d = out.data, k = 0.9;
    for (y = 0; y < GN; y++) for (x = 0; x < GN; x++) {
      i = y * GN + x; var dx = 0, dy = 0;
      if (x > 0 && x < GN - 1 && y > 0 && y < GN - 1) { dx = cur[i - 1] - cur[i + 1]; dy = cur[i - GN] - cur[i + GN]; }
      var si = (clamp((y + dy * k) | 0, 0, GN - 1) * GN + clamp((x + dx * k) | 0, 0, GN - 1)) * 4, oi = i * 4, sh = dx * 2.4;
      d[oi] = clamp(src[si] + sh, 0, 255); d[oi + 1] = clamp(src[si + 1] + sh, 0, 255); d[oi + 2] = clamp(src[si + 2] + sh, 0, 255); d[oi + 3] = 255;
    }
    var t = cur; cur = prev; prev = t;
    octx.putImageData(out, 0, 0); vctx.drawImage(octx.canvas, 0, 0, canvas.width, canvas.height);
    requestAnimationFrame(waterFrame);
  }
  var lastGx = -99, lastGy = -99;
  canvas.addEventListener("pointermove", function (e) {
    if (!ripplesOn || !src) return;
    var r = canvas.getBoundingClientRect(), gx = ((e.clientX - r.left) / r.width) * GN, gy = ((e.clientY - r.top) / r.height) * GN;
    if (Math.abs(gx - lastGx) < 1.5 && Math.abs(gy - lastGy) < 1.5) return;
    lastGx = gx; lastGy = gy; drop(gx, gy, 2.2, 5); plink(0.25);
  }, { passive: true });
  canvas.addEventListener("pointerdown", function (e) { var r = canvas.getBoundingClientRect(); drop(((e.clientX - r.left) / r.width) * GN, ((e.clientY - r.top) / r.height) * GN, 5, 16); plink(1); }, { passive: true });
  loader.addEventListener("pointerdown", function () { unlock(); waterStart(); }, { passive: true });
  loader.addEventListener("keydown", function () { unlock(); waterStart(); });
  var autoTimer = null;
  function autoRipple() { if (!ripplesOn || !src) return; var a = Math.random() * Math.PI * 2, rad = 30 + Math.random() * 50; drop(GN / 2 + Math.cos(a) * rad, GN / 2 + Math.sin(a) * rad, 3, 4); plink(0.12); autoTimer = setTimeout(autoRipple, 700 + Math.random() * 900); }

  var DUR = seen ? 1500 : 3600, t0 = performance.now(), assetsReady = false, finished = false, skipped = false;
  function easeInOutSine(p) { return -(Math.cos(Math.PI * p) - 1) / 2; }
  function pctFrame(now) {
    if (finished) return;
    var raw = clamp((now - t0) / DUR, 0, 1), shown = Math.round(easeInOutSine(raw) * 100);
    if (shown >= 100 && !assetsReady) shown = 99;
    pctEl.textContent = shown; ringP.style.strokeDashoffset = RING_C * (1 - shown / 100);
    if ((raw >= 1 && assetsReady) || skipped) return finishLoader();
    requestAnimationFrame(pctFrame);
  }
  var loaderImg = new Image();
  loaderImg.onload = function () { setupWater(loaderImg); autoRipple(); Promise.resolve(document.fonts && document.fonts.ready).then(function () { assetsReady = true; }); };
  loaderImg.onerror = function () { assetsReady = true; };
  loaderImg.src = "assets/jason-loader.webp";
  requestAnimationFrame(pctFrame);
  setTimeout(function () { assetsReady = true; }, 9000);
  setTimeout(function () { loader.classList.add("is-ready"); }, 600);

  /* the signature film: only the first time, only when it is cheap enough to show */
  var filmWrap = loader.querySelector(".jg-film"), filmVideo = null, filmWanted = !seen && !RM && !RD && !!document.createElement("video").canPlayType;
  if (filmWanted) {
    var portrait = innerHeight > innerWidth * 1.15;
    filmVideo = document.createElement("video"); filmVideo.muted = true; filmVideo.playsInline = true; filmVideo.setAttribute("playsinline", ""); filmVideo.setAttribute("muted", ""); filmVideo.preload = "auto";
    filmVideo.src = portrait ? "assets/film/signature-portrait.mp4" : "assets/film/signature.mp4";
    filmVideo.addEventListener("error", function () { filmWanted = false; });
    filmWrap.appendChild(filmVideo);
  }
  var skipBtn = loader.querySelector(".jg-loader__skip");
  skipBtn.addEventListener("click", function () { unlock(); AN.track("intro_skipped", { at: pctEl.textContent }); if (!finished) { skipped = true; return; } endLoader(true); });

  function finishLoader() {
    if (finished) return; finished = true; pctEl.textContent = "100"; ringP.style.strokeDashoffset = 0; store.set("jg_seen", "1");
    var wrap = loader.querySelector(".jg-loader__wrap"), title = loader.querySelector(".jg-title");
    if (skipped) return endLoader(true);
    setTimeout(function () {
      wrap.classList.add("is-out"); clearTimeout(autoTimer); S2("splash", { gain: 0.9 }); S2("swoosh-long", { delay: 0.05 });
      if (filmWanted && filmVideo && filmVideo.readyState >= 2) {
        skipBtn.textContent = "Skip";
        filmWrap.classList.add("is-in"); S2("swoosh-deep", { delay: 0.1 });
        filmVideo.play().catch(function () { title.classList.add("is-in"); setTimeout(function () { endLoader(false); }, 1800); });
        filmVideo.addEventListener("ended", function () { endLoader(false); });
        setTimeout(function () { endLoader(false); }, 6500);
      } else {
        title.classList.add("is-in"); S2("swoosh", { gain: 0.6 }); SFX.arrive(); H("arrive");
        setTimeout(function () { endLoader(false); }, RM ? 100 : 1900);
      }
    }, RM ? 0 : 600);
  }
  function endLoader(fast) {
    if (loaderDone) return; loaderDone = true; waterStop();
    loader.classList.add("is-done"); clearTimeout(autoTimer); if (!fast) S2("swoosh", { rate: 0.85, gain: 0.5 });
    if (filmVideo) { try { filmVideo.pause(); } catch (e) {} }
    setTimeout(function () { waterAlive = false; loader.remove(); }, fast ? 400 : 1000);
    body.classList.remove("is-loading"); showGate();
  }

  /* ============================================================
     THE QUESTION
     ============================================================ */

  var PATHS = {
    interviewer: { key: "1", h: "I’m interviewing", p: "Proof, record, resume. About five minutes, no jargon." },
    partner: { key: "2", h: "I’m a business partner", p: "Where your business is leaking, what I built for that, and I’ll write your first message for you." },
    lurker: { key: "3", h: "Just lurking", p: "No pitch. Five lines and then the site’s yours." }
  };
  var gate = el(
    '<div id="jg-gate" role="dialog" aria-modal="true" aria-labelledby="jg-gate-q"><div class="jg-gate__wrap">' +
      '<h1 class="jg-gate__q" id="jg-gate-q">Are you an <em>interviewer</em>, a <em>business partner</em>, or just <em>lurking</em>?</h1>' +
      '<div class="jg-paths">' + Object.keys(PATHS).map(function (r, i) { var P = PATHS[r];
        return '<button class="jg-path" type="button" data-role="' + r + '" style="--d:' + (300 + i * 120) + 'ms"><div><h2><kbd>' + P.key + '</kbd>' + P.h + '</h2><p>' + P.p + '</p></div><span class="jg-path__go">Begin</span></button>'; }).join("") +
      '</div><div class="jg-gate__foot"><button class="jg-skip jg-gate__skip" type="button">Skip, take me to the site</button><button class="jg-ibtn" type="button" data-sound-toggle></button></div></div></div>'
  );
  function showGate() {
    body.classList.add("is-gated"); body.appendChild(gate); setMuted(muted);
    requestAnimationFrame(function () { requestAnimationFrame(function () { gate.classList.add("is-in"); }); });
    gate.querySelectorAll(".jg-path").forEach(function (b) {
      b.addEventListener("click", function () { choose(b.dataset.role); });
      b.addEventListener("pointerenter", function () { SFX.tick(); });
    });
    gate.querySelector(".jg-gate__skip").addEventListener("click", function () { choose(null); });
    addEventListener("keydown", gateKeys);
  }
  function gateKeys(e) {
    var map = { "1": "interviewer", "2": "partner", "3": "lurker" };
    if (map[e.key] && !e.metaKey && !e.ctrlKey) return choose(map[e.key]);
    if (e.key === "Escape") return choose(null);
    if (e.key === "Tab") {
      var f = gate.querySelectorAll("button"), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!gate.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
  }
  function choose(role) {
    removeEventListener("keydown", gateKeys); unlock();
    if (role) {
      store.set("jg_role", role); SFX.select(); H("select"); S2("select"); AN.track("role_chosen", { role: role }, { role: role });
      var hot = gate.querySelector('[data-role="' + role + '"]'); if (hot) hot.classList.add("is-hot");
      return setTimeout(function () { askName(role); }, RM ? 60 : 450);
    }
    SFX.close(); AN.track("role_chosen", { role: "skipped" });
    leaveGate(); showFab();
  }
  function leaveGate() {
    gate.classList.add("is-leaving"); body.classList.remove("is-gated"); body.classList.add("is-live"); lockScreen(false);
    setTimeout(function () { gate.remove(); }, 950);
  }
  /* One more question, and it is skippable. The name is only used to greet you. */
  var visitorName = store.get("jg_name") || "";
  /* keys under the name and chat fields: a soft laptop key per character, a different one for backspace */
  document.addEventListener("keydown", function (e) {
    var t = e.target; if (!t || !t.matches || !t.matches(".jg-namestep input, .jg-chat input, .jg-chat textarea")) return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (e.key === "Backspace") S2("key-back", { gain: 0.9, throttle: 30 });
    else if (e.key === "Enter") S2("select");
    else if (e.key.length === 1) S2("key", { throttle: 25 });
  }, true);
  function askName(role) {
    var wrap = gate.querySelector(".jg-gate__wrap");
    wrap.classList.add("is-swapping");
    setTimeout(function () {
      wrap.innerHTML = '<h1 class="jg-gate__q" id="jg-gate-q">And your <em>name</em>?</h1>' +
        '<form class="jg-namestep"><input type="text" name="name" maxlength="40" autocomplete="given-name" autocapitalize="words" spellcheck="false" placeholder="First name is plenty" aria-label="Your name" value="' + esc(visitorName) + '" />' +
        '<div class="jg-namestep__row"><button class="jg-opt jg-opt--primary" type="submit">Continue</button><button class="jg-skip" type="button" data-skip>Skip</button></div>' +
        '<p class="jg-namestep__note">Just so I know who I’m talking to. That’s it.</p></form>';
      wrap.classList.remove("is-swapping"); wrap.classList.add("is-in");
      var form = wrap.querySelector("form"), input = form.querySelector("input");
      setTimeout(function () { input.focus({ preventScroll: true }); }, 350);
      function go(name) {
        SFX.select(); H("tap"); S2("select", { gain: 0.8 });
        if (name) { visitorName = name; store.set("jg_name", name); AN.track("name_given", { role: role, name: name }, { name: name, role: role }); }
        else { visitorName = ""; store.set("jg_name", ""); AN.track("name_skipped", { role: role }); }
        leaveGate(); setTimeout(function () { openGuide(role); }, RM ? 100 : 800);
      }
      form.addEventListener("submit", function (e) { e.preventDefault(); go(input.value.replace(/[^\p{L}\p{M}' .-]/gu, "").trim().slice(0, 40)); });
      form.querySelector("[data-skip]").addEventListener("click", function () { go(""); });
      addEventListener("keydown", function esc1(e) { if (e.key === "Escape") { removeEventListener("keydown", esc1); go(""); } });
    }, RM ? 0 : 420);
  }

  /* ============================================================
     THE CHALKBOARD: camera and annotations
     ============================================================ */

  var ink = document.createElementNS("http://www.w3.org/2000/svg", "svg"); ink.id = "jg-ink"; ink.setAttribute("aria-hidden", "true"); body.appendChild(ink);
  var marked = null, markPath = null, markType = null;
  function wobble(x, y, amp) { return (x + Math.sin(y * 0.15 + x * 0.05) * amp).toFixed(1); }
  function pathFor(r, type) {
    var x = r.left, y = r.top, w = r.width, h = r.height, d = "", i, n;
    if (type === "strike") {
      var my = y + h * 0.56; d = "M" + (x - 6) + " " + (my + 1.5);
      for (i = 1; i <= 12; i++) d += " L" + (x - 6 + (w + 12) * i / 12) + " " + (my + 1.5 - i * 0.25 + Math.sin(i) * 0.8);
    } else if (type === "circle") {
      var cx = x + w / 2, cy = y + h / 2, rx = w / 2 + 14, ry = h / 2 + 10; n = 40;
      for (i = 0; i <= n + 3; i++) { var a = -0.6 + (i / n) * Math.PI * 2, px = cx + Math.cos(a) * rx * (1 + Math.sin(i * 1.7) * 0.015), py = cy + Math.sin(a) * ry * (1 + Math.cos(i * 1.3) * 0.02); d += (i ? " L" : "M") + px.toFixed(1) + " " + py.toFixed(1); }
    } else if (type === "box") {
      d = "M" + (x - 10) + " " + (y - 6) + " L" + (x + w + 10) + " " + (y - 6.5) + " L" + (x + w + 11) + " " + (y + h + 6) + " L" + (x - 9) + " " + (y + h + 6.5) + " Z";
    } else {
      var by = y + h + 3; d = "M" + (x - 2) + " " + by;
      for (i = 1; i <= 14; i++) d += " L" + (x - 2 + (w + 4) * i / 14) + " " + (by + Math.sin(i * 0.9) * 1.1 + i * 0.12);
    }
    return d;
  }
  function drawMark() {
    if (!marked || !markPath) return;
    var r = marked.getBoundingClientRect(); markPath.setAttribute("d", pathFor(r, markType));
  }
  addEventListener("scroll", function () { if (marked) requestAnimationFrame(drawMark); }, { passive: true });
  addEventListener("resize", function () { if (marked) drawMark(); });
  function annotate(id, type) {
    clearMark();
    var node = id ? document.querySelector('[data-mark="' + id + '"]') : null; if (!node) return null;
    marked = node; markType = type || "underline"; node.classList.add("is-marked");
    markPath = document.createElementNS("http://www.w3.org/2000/svg", "path"); ink.appendChild(markPath); drawMark();
    var len = markPath.getTotalLength ? markPath.getTotalLength() : 600;
    if (!RM) {
      markPath.style.strokeDasharray = len; markPath.style.strokeDashoffset = len; markPath.style.transition = "none";
      requestAnimationFrame(function () { markPath.style.transition = "stroke-dashoffset " + Math.min(1.1, 0.35 + len / 900) + "s cubic-bezier(0.65,0,0.35,1)"; markPath.style.strokeDashoffset = 0; });
    }
    return node;
  }
  function clearMark() {
    if (marked) marked.classList.remove("is-marked");
    if (markPath) { var p = markPath; p.classList.add("is-out"); setTimeout(function () { p.remove(); }, 500); }
    marked = null; markPath = null;
  }
  var litNode = null;
  function camera(sel, markId) {
    if (litNode) litNode.classList.remove("jg-lit");
    litNode = sel ? document.querySelector(sel) : null;
    if (!litNode) { body.classList.remove("jg-focus"); return; }
    litNode.classList.add("jg-lit", "is-lit"); body.classList.add("jg-focus");
    litNode.querySelectorAll("[data-reveal]").forEach(function (r) { r.classList.add("in-view"); });
    var head = litNode.querySelector(".section__head"); if (head) head.classList.add("in-view");
    var target = markId ? document.querySelector('[data-mark="' + markId + '"]') : null, room = innerHeight - (guide.offsetHeight || 0) - 24;
    var y;
    if (target) { var tr = target.getBoundingClientRect(); y = tr.top + scrollY - room * 0.42 + tr.height / 2; }
    else { y = litNode.getBoundingClientRect().top + scrollY - Math.round(innerHeight * 0.1); }
    scrollToY(Math.max(0, y), 1500);
  }

  /* ============================================================
     GUIDE
     ============================================================ */

  var guide = el(
    '<aside id="jg-guide" aria-label="Jason, the guide"><div class="jg-card">' +
      '<div class="jg-portrait"><img alt="" src="' + FALLBACK + '" /><img alt="" src="' + FALLBACK + '" /></div>' +
      '<div class="jg-body"><div class="jg-top"><div class="jg-top__left"><span class="jg-name">Jason</span><div class="jg-progress" aria-hidden="true"><i></i></div></div>' +
      '<div class="jg-ctl"><button class="jg-skip jg-guide__skip" type="button">Skip tour</button><button class="jg-ibtn" type="button" data-sound-toggle></button><button class="jg-ibtn jg-close" type="button" aria-label="Close the guide">' + I.close + '</button></div></div>' +
      '<p class="jg-say" aria-live="polite"></p><div class="jg-choices"></div>' +
      '<form class="jg-chat"><input type="text" maxlength="500" placeholder="Ask me anything about the work" aria-label="Ask Jason" autocomplete="off" /><button type="submit" aria-label="Send">' + I.send + '</button></form>' +
      '<p class="jg-note"></p></div></div></aside>'
  );
  body.appendChild(guide);
  var fab = el('<button id="jg-fab" type="button" aria-label="Open the guide"><img alt="" src="' + FALLBACK + '" /><span>Guide</span></button>');
  body.appendChild(fab);
  function showFab() { fab.classList.add("is-in"); }
  fab.addEventListener("click", function () { SFX.open(); S2("open", { gain: 0.8 }); AN.track("guide_reopened", {}); openGuide(store.get("jg_role") || "lurker"); });
  document.querySelectorAll("[data-open-guide]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); body.classList.remove("menu-open"); SFX.open(); S2("open", { gain: 0.8 }); openGuide(store.get("jg_role") || "lurker"); }); });

  var portraitEl = guide.querySelector(".jg-portrait"), imgs = guide.querySelectorAll(".jg-portrait img"), sayEl = guide.querySelector(".jg-say"), choicesEl = guide.querySelector(".jg-choices"), progEl = guide.querySelector(".jg-progress i"), noteEl = guide.querySelector(".jg-note");
  var chatForm = guide.querySelector(".jg-chat"), chatInput = chatForm.querySelector("input"), chatBtn = chatForm.querySelector("button");
  var curImg = 0, curFace = "";
  guide.querySelector(".jg-close").addEventListener("click", closeGuide);
  guide.querySelector(".jg-guide__skip").addEventListener("click", function () { SFX.close(); AN.track("guide_skipped", { role: role, step: S.i || 0 }); closeGuide(); });
  function setFace(face, force) { if (face === curFace && !force) return; curFace = face; var next = imgs[1 - curImg]; next.src = faceSrc(face); next.classList.add("is-in"); imgs[curImg].classList.remove("is-in"); curImg = 1 - curImg; }

  var typing = null, sayId = 0;
  function say(text, done, who, spoken) {
    if (typing) { clearTimeout(typing); typing = null; }
    var id = ++sayId;
    sayEl.classList.remove("is-done"); sayEl.innerHTML = '<span class="jg-text"></span><span class="jg-caret"></span>';
    var span = sayEl.firstChild, tokens = text.match(/<[^>]+>|[^<]/g) || [], chars = plain(text).length || 1;
    function finish() { if (id !== sayId) return; sayEl.classList.add("is-done"); typing = null; portraitEl.classList.remove("is-talking"); if (done) done(); }
    if (RM) { span.innerHTML = text; voice.play(spoken || text, who); return finish(); }
    voice.play(spoken || text, who).then(function (ms) {
      if (id !== sayId) return;
      var per = ms ? clamp((ms - 250) / chars, 14, 60) : 19, i = 0, html = "";
      if (ms) portraitEl.classList.add("is-talking");
      function step() {
        if (id !== sayId) return;
        if (i >= tokens.length) return finish();
        var t = tokens[i++]; html += t; span.innerHTML = html;
        typing = setTimeout(step, t.length > 1 ? 0 : ms ? per : /[.!?]/.test(t) ? 210 : /[,;:]/.test(t) ? 100 : 19);
      }
      step();
    });
    sayEl.onclick = function () { if (!typing) return; clearTimeout(typing); span.innerHTML = text; finish(); };
  }
  function setChoices(list) {
    choicesEl.innerHTML = "";
    (list || []).forEach(function (c, i) {
      var b = el('<button class="jg-opt' + (c.primary ? " jg-opt--primary" : "") + '" type="button" style="--i:' + i + '">' + esc(c.label) + '</button>');
      b.addEventListener("click", function () {
        SFX.select(); H("tap"); S2("select", { gain: 0.8 }); setChoices([]);
        voice.play(c.label, "you").then(function (ms) { setTimeout(function () { if (open) c.go(); }, ms ? Math.min(ms + 80, 1600) : 0); });
      });
      choicesEl.appendChild(b);
    });
  }
  function setProgress(n, at) { progEl.style.transform = "scaleX(" + (n ? (at + 1) / n : 0) + ")"; }

  /* ---------- Scripts: statements, not questions ---------- */
  var S = {}, CONTACT = "jobawems@gmail.com";
  function greet() { var h = new Date().getHours(); return h < 12 ? "Good morning." : h < 17 ? "Good afternoon." : "Good evening."; }
  function line(face, at, mark, text, choices) { return { face: face, at: at, mark: mark, text: text, choices: choices }; }
  function next(label) { return { label: label || "Continue", primary: true, go: function () { go(S.i + 1); } }; }
  function jump(label, idx) { return { label: label, go: function () { go(idx); } }; }
  function toChat(label) { return { label: label || "Ask me something", go: function () { enterChat(); } }; }
  function finish(label) { return { label: label || "Finish", primary: true, go: function () { showEnd(); } }; }
  var U = "underline", C = "circle", X = "strike", B = "box";

  var SCRIPTS = {
    interviewer: [
      line("wink", null, null, greet() + " Real quick, I’m gonna skip the jargon. You’re hiring, or you’re figuring out if you should, and you’ve probably read forty of these this week.", [next("Fair.")]),
      line("serious", ".hero", ["happens", U], "So here’s the part that matters. <em>This site is the work sample.</em> The loading screen, the question you just answered, me talking to you right now. I built all of it, and you’re standing in it.", [next("Show me what you do")]),
      line("calm", "#thesis", ["handoff", C], "What I do is the stuff underneath a business. Honestly, most operations don’t break at the design. They break at the handoff, when one person passes something to the next and it just doesn’t land.", [next("Go on")]),
      line("attentive", "#thesis", ["sport", U], "And I co-own a dealership, so I’ve priced the deal, chased the title, and eaten the cost when the follow-up didn’t happen. That’s why I don’t automate stuff just to automate it.", [next("Proof")]),
      line("serious", "#work", ["signature", C], "Proof one. A Texas dealer sends a title packet to the county. Three weeks later it comes back because of one missing signature, and by then the deal is already sideways.", [next("And?")]),
      line("calm", "#work", ["dpc", U], "So I built the thing that checks it before it leaves the building. It reads the deal jacket against what webDEALER wants right now, and hands your clerk a short list instead of a whole stack.", [next("The dealership")]),
      line("attentive", "#triple-j", ["terms", U], "Proof two. Triple J Auto Investment, Houston. We put the terms on the table early, the trade number is real, and the paperwork doesn’t turn into the customer’s problem after they drive off.", [next("The record")]),
      line("calm", "#experience", ["dates", B], "Here’s the record, in order. Two operating roles since 2024, both still running. I didn’t pad any of this.", [next("Credentials"), jump("Skip to the close", 9)]),
      line("serious", "#credentials", ["nineteen", C], "Nineteen Anthropic courses. An Associate’s in Business, 3.63, Dean’s List. And every claim on this site has a proof page behind it, so you don’t have to take my word for it.", [next("Wrap it up")]),
      line("warm", "#contact", ["email", B], "That’s the tour. Resume and email are right here. You can ask me something first, or just grab what you need.", [toChat("Ask me something"), finish("Finish")])
    ],
    partner: [
      line("wink", null, null, greet() + " I’m gonna skip the pitch. You run a business, and somewhere in it something’s being done by hand that really shouldn’t be.", [next("Go on")]),
      line("calm", "#thesis", ["handoff", C], "Most operations don’t break at the design, they break at the <em>handoff</em>. A lead comes in and nobody owns it, or a packet leaves the building without anybody checking it, or the whole process is living in one person’s head.", [next("Which one is mine")]),
      line("attentive", null, null, "Pick whichever one’s closest.", [
        { label: "Nobody finds us", go: function () { S.pain = "found"; go(3); } },
        { label: "Traffic that never becomes a lead", go: function () { S.pain = "convert"; go(3); } },
        { label: "Paperwork and compliance", go: function () { S.pain = "paper"; go(3); } },
        { label: "Follow-up after first contact", go: function () { S.pain = "followup"; go(3); } },
        { label: "It all lives in my head", go: function () { S.pain = "tribal"; go(3); } }
      ]),
      { dynamic: function () {
        var T = { found: ["calm", "Being hard to find is the cheapest problem on that list, and the slowest one to pay back. Before you spend a dollar on traffic, I’d check whether your pages say what you sell in the first screen."],
          convert: ["serious", "Traffic that won’t convert is almost never a traffic problem. The page is asking for a decision before it’s earned one, or the lead lands somewhere nobody’s watching."],
          paper: ["surprised", "Okay, that one I’ve lived the hardest. A returned packet costs you three weeks, sometimes the whole deal. It starts with finding the one document that causes the kickback."],
          followup: ["serious", "Follow-up doesn’t fail because people are lazy. It fails because the next step isn’t written down and given to somebody, so it doesn’t survive a busy Tuesday."],
          tribal: ["laugh", "A process that lives in one head is a single point of failure that draws a salary. I’ve been that head. Writing it down is boring, I know. It’s also usually the best week of work you can do."] }[S.pain || "tribal"];
        return line(T[0], "#value", ["slides", X], T[1], [next("What did you build for it")]);
      } },
      line("calm", "#work", ["dpc", U], "This, for the one I lived the hardest. Deal Packet Checker reads the packet before the state sees it and hands a human a short list instead of a stack.", [next("And the dealership")]),
      line("attentive", "#triple-j", ["scripts", U], "And the business I run it in. Intake, follow-up, reporting, all of it runs off written scripts, not somebody’s memory.", [next("What it’s costing me")]),
      line("attentive", null, null, "Rough guess. What’s it costing you right now?", [
        { label: "Under 5 hours a week", go: function () { S.cost = "under5"; go(7); } },
        { label: "5 to 15 hours a week", go: function () { S.cost = "5to15"; go(7); } },
        { label: "15 to 40 hours a week", go: function () { S.cost = "15to40"; go(7); } },
        { label: "More than one full-time role", go: function () { S.cost = "role"; go(7); } }
      ]),
      { dynamic: function () {
        if (typeof window.INTAKE_PREFILL === "function") window.INTAKE_PREFILL({ pain: S.pain, cost: S.cost });
        return line("warm", "#intake", ["stored", U], "I already wrote your first message for you. Read it, change whatever you want, send it from your own email. Nothing here gets stored.", [toChat("Ask me something first"), finish("Finish")]);
      } }
    ],
    lurker: [
      line("laugh", null, null, greet() + " Lurking. Respect, honestly. No pitch then.", [next("Quick version")]),
      line("calm", ".hero", ["happens", U], "Quick version. I’m Jason, Pearland, Texas. I build the systems underneath small businesses, and I co-own a car lot in Houston.", [next("The weird one")]),
      line("surprised", "#work", ["signature", C], "The weird one. I built a thing that reads Texas title paperwork before it goes to the county. Nobody was checking it before that.", [next("The real one")]),
      line("wink", "#triple-j", ["terms", U], "The real one. The dealership. Clear vehicles, clear terms, real people. That’s the whole promise.", [next("Okay")]),
      line("warm", null, null, "That’s it. Site’s yours, scroll wherever. I’m down in the corner if you want me.", [toChat("Actually, ask you something"), finish("Finish")])
    ]
  };

  var open = false, role = null, steps = [];
  function openGuide(r) {
    role = r; steps = SCRIPTS[r] || SCRIPTS.lurker; S = { i: 0 };
    guide.classList.remove("is-chat"); guide.classList.add("is-open"); fab.classList.remove("is-in"); noteEl.textContent = ""; open = true;
    setMuted(muted); pad.start(); go(0);
  }
  function closeGuide() { open = false; guide.classList.remove("is-open", "is-chat"); camera(null); clearMark(); voice.stop(); pad.stop(); showFab(); sayId++; }
  function go(i) {
    if (!open) return;
    if (i >= steps.length) return showEnd();
    S.i = i; var st = steps[i]; if (st.dynamic) st = st.dynamic();
    setProgress(steps.length, i); setFace(st.face || "calm"); setChoices([]);
    if (typing) { clearTimeout(typing); typing = null; }
    sayEl.classList.remove("is-done"); sayEl.innerHTML = '<span class="jg-text"></span>';
    clearMark();
    var moved = !!st.at;
    if (moved) { camera(st.at, st.mark && st.mark[0]); SFX.stage(); H("arrive"); S2("swoosh", { gain: 0.35, rate: 1.15 }); } else { camera(null); SFX.chime(); }
    var wait = moved && !RM ? 900 : 0;
    setTimeout(function () {
      if (S.i !== i || !open) return;
      if (st.mark) annotate(st.mark[0], st.mark[1]);
      var shown = st.text;
      if (i === 0 && visitorName) shown = st.text.replace(/^(Good (?:morning|afternoon|evening))\./, "$1, " + esc(visitorName) + ".");
      AN.track("guide_line", { role: role, step: i });
      say(shown, function () { setChoices(st.choices); }, "jason", st.text);
    }, wait);
  }
  addEventListener("keydown", function (e) {
    if (!open) return;
    if (e.key === "Escape") return closeGuide();
    if (guide.classList.contains("is-chat")) return;
    var opts = choicesEl.querySelectorAll(".jg-opt"); if (!opts.length) return;
    if ((e.key === "Enter" || e.key === " ") && document.activeElement === body) { e.preventDefault(); opts[0].click(); }
    var n = parseInt(e.key, 10); if (n >= 1 && n <= opts.length && !e.metaKey && !e.ctrlKey) opts[n - 1].click();
  });

  /* ============================================================
     THE CLOSE
     ============================================================ */

  var endEl = el('<div id="jg-end" role="dialog" aria-modal="true" aria-labelledby="jg-end-h"><div class="jg-end__wrap"><h2 id="jg-end-h"></h2><p class="jg-end__sum"></p><div class="jg-end__cta"></div><div class="jg-end__replay"></div></div></div>');
  body.appendChild(endEl);
  function showEnd() {
    AN.track("guide_finished", { role: role });
    open = false; guide.classList.remove("is-open", "is-chat"); camera(null); clearMark(); voice.stop(); pad.stop();
    var R = { interviewer: "an <em>interviewer</em>", partner: "a <em>business partner</em>", lurker: "a <em>lurker</em>" }[role] || "a visitor";
    endEl.querySelector("h2").innerHTML = "You came as " + R + ".";
    var nm = (store.get("jg_name") || "").trim(); endEl.querySelector(".jg-end__sum").textContent = "That’s me, top to bottom" + (nm ? ", " + nm : "") + ". Nobody else built this. Grab what you need.";
    var cta = endEl.querySelector(".jg-end__cta"); cta.innerHTML = "";
    var CTAS = {
      interviewer: [['assets/Jason_Obawemimo_Resume_2026.pdf', 'Resume', true, 'download'], ['mailto:' + CONTACT, 'Email Jason', false]],
      partner: [['/partners.html#book', 'Pick a time with me', true], ['mailto:' + CONTACT, 'Email Jason', false]],
      lurker: [['#work', 'Back to the proof', true], ['mailto:' + CONTACT, 'Say hello', false]]
    }[role] || [['mailto:' + CONTACT, 'Email Jason', true]];
    CTAS.forEach(function (c) { var a = el('<a class="btn' + (c[2] ? " btn--solid" : "") + '" href="' + c[0] + '"' + (c[3] ? ' download="Jason Obawemimo - Resume.pdf"' : "") + '><span>' + c[1] + '</span></a>'); a.addEventListener("click", function (e) { AN.track("cta_click", { label: c[1], role: role, where: "end" }); hideEnd(); if (c[0].charAt(0) === "#") { e.preventDefault(); var n = document.querySelector(c[0]); if (n) scrollToY(n.getBoundingClientRect().top + scrollY - 80, 1200); } }); cta.appendChild(a); });
    var rp = endEl.querySelector(".jg-end__replay"); rp.innerHTML = "<span>Replay as</span>";
    Object.keys(PATHS).filter(function (r) { return r !== role; }).forEach(function (r) { var b = el('<button type="button">' + PATHS[r].h.toLowerCase() + '</button>'); b.addEventListener("click", function () { hideEnd(); store.set("jg_role", r); openGuide(r); }); rp.appendChild(b); });
    var back = el('<button type="button">or return to the site</button>'); back.addEventListener("click", function () { hideEnd(); showFab(); }); rp.appendChild(back);
    body.classList.add("is-card"); endEl.classList.add("is-in"); SFX.stage(); H("success"); S2("sparkle", { delay: 0.15 }); lockScreen(true);
    setTimeout(function () { var f = endEl.querySelector("a,button"); if (f) f.focus({ preventScroll: true }); }, 400);
  }
  function hideEnd() { endEl.classList.remove("is-in"); body.classList.remove("is-card"); lockScreen(false); }
  endEl.addEventListener("keydown", function (e) { if (e.key === "Escape") { hideEnd(); showFab(); } });

  /* ============================================================
     CHAT
     ============================================================ */

  var history = [], liveDown = null;
  var FACTS = [
    [/apohenia|packet|webdealer|title|county|registration/i, "serious", "Apohenia is my company. We’re building the layer between a car deal getting put together and it getting accepted by the county. The first product is Deal Packet Checker. It reads a Texas dealer’s deal jacket against what webDEALER wants right now, and hands the clerk a short list of what to look at. It’s in build, Texas pilot places. Not affiliated with TxDMV or any county office, and I don’t claim it prevents rejections until I can prove it."],
    [/triple ?j|dealership|car lot|rental|finance|financing/i, "calm", "Triple J Auto Investment is the dealership I co-own and run in Houston. Cars, trucks and SUVs you can finance in house, sell and trade valuations, and we help with registration after the sale. Clear vehicles, clear terms, real people."],
    [/credential|certif|anthropic|course|claude/i, "serious", "Nineteen Anthropic courses. Claude, Claude Code, the API, Model Context Protocol, agent skills, subagents, Bedrock, Vertex AI, the AI fluency series. The certificates are all in one PDF on this site."],
    [/degree|school|college|gpa|education|study/i, "calm", "Associate of Arts in Business from San Jacinto College, May 2026, 3.63, Dean’s Honor List. I’m working on a Bachelor’s in Neuroscience now, should be done 2027."],
    [/stack|tools?|tech|supabase|postgres|vercel|mcp|codex/i, "attentive", "Supabase and Postgres underneath, Vercel in production, Claude and Codex for the agent work, MCP wired all the way through. Obsidian for notes."],
    [/obawemimo|last name|surname|pronounce/i, "warm", "Obawemimo. Family name. As far as the internet is concerned there’s one of me: founder of Apohenia, co-owner of Triple J Auto Investment, Pearland, Texas."],
    [/where|based|location|pearland|houston|texas/i, "calm", "Pearland, Texas. The dealership is in Houston, at 8774 Almeda Genoa Rd."],
    [/hire|rate|price|cost|budget|available|contract|work with/i, "warm", "Easiest way: the intake at the bottom of the page writes your first message for you. Or honestly, just email me at " + CONTACT + "."],
    [/site|website|this|built|how.*(make|build)|game|loader|water|voice/i, "wink", "This site is plain HTML, CSS and JavaScript on Vercel. The loader is a water simulation on a canvas, the films are rendered with Remotion, and the voice is a clone of mine reading lines I wrote. No framework. Didn’t need one."],
    [/email|contact|reach|talk/i, "warm", "Email is " + CONTACT + ". Real inbox, I read it."]
  ];
  function scripted(q) { for (var i = 0; i < FACTS.length; i++) if (FACTS[i][0].test(q)) return { face: FACTS[i][1], text: FACTS[i][2] }; return { face: "attentive", text: "That one I’d rather answer for real. Email it to " + CONTACT + " and I’ll get back to you." }; }
  function enterChat() {
    guide.classList.add("is-chat"); camera(null); clearMark(); setChoices([]); setProgress(0, 0); setFace("attentive");
    say("Ask me whatever about the work. I’ll answer as me.", function () { setChoices([finish("Finish")]); });
    setTimeout(function () { chatInput.focus({ preventScroll: true }); }, 400);
  }
  chatForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = chatInput.value.trim(); if (!q) return;
    chatInput.value = ""; chatBtn.disabled = true; SFX.tick(); H("tap"); setChoices([]); setFace("attentive"); voice.stop();
    history.push({ role: "user", content: q });
    AN.track("chat_asked", { q: q.slice(0, 160), role: role, live: liveDown !== false });
    sayEl.classList.remove("is-done"); sayEl.innerHTML = '<span class="jg-text"></span><span class="jg-caret"></span>';
    var handled = false;
    function reply(face, text, note, live) {
      if (handled) return; handled = true; chatBtn.disabled = false;
      history.push({ role: "assistant", content: text }); if (history.length > 24) history = history.slice(-24);
      setFace(face); noteEl.textContent = note || "";
      say(text, function () { setChoices([finish("Finish")]); });
      if (live) setTimeout(function () { voice.speak(text); }, 50);
    }
    if (liveDown === false) { var s0 = scripted(q); return reply(s0.face, s0.text); }
    var ctrl = new AbortController(), timer = setTimeout(function () { ctrl.abort(); }, 20000);
    fetch("/api/guide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: role, name: visitorName, messages: history.slice(-12) }), signal: ctrl.signal })
      .then(function (r) { clearTimeout(timer); if (r.status === 503) { liveDown = false; throw new Error("unconfigured"); } if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (j) { liveDown = true; reply(FACES.indexOf(j.face) >= 0 ? j.face : "calm", j.text, "", true); })
      .catch(function () { var s = scripted(q); reply(s.face, s.text, liveDown === false ? "The live version of me isn’t switched on here, so this is the scripted one." : ""); });
  });

  window.JG = { open: openGuide, scripts: SCRIPTS, mute: setMuted };
})();
