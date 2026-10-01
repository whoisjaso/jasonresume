/* The reel. A trailer cut for each visitor, scored live: the music is made by
   the browser on the spot (oscillators and noise, no audio files), the cuts
   land on the beat, the type slams in word by word, and three moments ask
   the visitor to do something: hold to scan a license, tap the words that
   matter, hit the drum. Houston's clock and whether Triple J is open are read
   live. Tap to skip ahead, Escape or the cross to leave; leaving lands on the
   Slate. Every fact is in llms.txt; the buyer is fictional and says so.
   window.JG_REEL.play(role, { name, from })   role: interviewer | partner | lurker */
(function () {
  "use strict";
  var root = document.documentElement, body = document.body;
  if (!body.classList.contains("home")) return;
  var RM = matchMedia("(prefers-reduced-motion: reduce)").matches || root.hasAttribute("data-still");
  var COARSE = matchMedia("(pointer: coarse)").matches;
  var T = window.JG_TRACK || function () {};
  function fx(k) { if (window.JG_FX) window.JG_FX(k); }
  function hap(k) { if (window.JG_HAPTIC) window.JG_HAPTIC(k); }
  function sample(n, o) { return window.JG_SFX ? window.JG_SFX.play(n, o) : false; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var DATA = {}; try { DATA = JSON.parse(document.getElementById("record-data").textContent); } catch (e) {}
  var EMAIL = DATA.email || "jobawems@gmail.com", CAL = DATA.calendar || "https://calendly.com/jason-apohenia/30min", PDF = DATA.pdf || "assets/Jason_Obawemimo_Resume_2026.pdf";
  var FACE = "assets/jason-headshot-900.webp";
  var BPM = 112, BEAT = 60 / BPM;

  /* =================================================================
     THE SCORE: synthesized live in the visitor's browser
     ================================================================= */
  var A = null;
  function audio() {
    if (A) return A;
    var c = window.JG_SFX && window.JG_SFX.ctx && window.JG_SFX.ctx(); if (!c) return null;
    var dest = (window.JG_SFX.out && window.JG_SFX.out()) || c.destination;
    var bus = c.createGain(); bus.gain.value = 0.0001;
    var comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.18;
    var an = c.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = 0.5;
    var duck = c.createGain(); bus.connect(duck); duck.connect(comp); comp.connect(an); an.connect(dest);
    var n = c.createBuffer(1, c.sampleRate, c.sampleRate), d = n.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    var len = Math.floor(c.sampleRate * 2.4), ir = c.createBuffer(2, len, c.sampleRate);
    for (var ch = 0; ch < 2; ch++) { var x = ir.getChannelData(ch); for (var k = 0; k < len; k++) x[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 3.2); }
    var verb = c.createConvolver(); verb.buffer = ir; var vg = c.createGain(); vg.gain.value = 0.32; verb.connect(vg); vg.connect(comp);
    A = { c: c, bus: bus, duck: duck, an: an, noise: n, verb: verb };
    return A;
  }
  function env(g, t, peak, attack, decay) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay); }
  /* ---------- the voice: Jason reads one line per shot when its clip exists.
     Clips are keyed by a hash of the line's text (tools/voice/reel_lines.mjs
     lists them, render_clone.py renders them into assets/voice). With no clip
     the cut plays as before. The score ducks under the voice. ---------- */
  var VO = { map: null, buf: {}, src: null };
  function vid(t) { var h = 0x811c9dc5; for (var k = 0; k < t.length; k++) { h ^= t.charCodeAt(k); h = Math.imul(h, 16777619); } return "r" + (h >>> 0).toString(16); }
  function voLoad(list) {
    if (!A || !window.fetch) return;
    var get = function () {
      list.forEach(function (sh) {
        if (!sh.vo) return; var id = vid(sh.vo), m = VO.map[id]; if (!m || VO.buf[id]) return;
        VO.buf[id] = "loading";
        fetch("assets/voice/" + m.f).then(function (r) { return r.arrayBuffer(); })
          .then(function (ab) { return new Promise(function (ok, no) { A.c.decodeAudioData(ab, ok, no); }); })
          .then(function (b) { VO.buf[id] = b; }).catch(function () { delete VO.buf[id]; });
      });
    };
    if (VO.map) return get();
    fetch("assets/voice/manifest.json").then(function (r) { return r.json(); }).then(function (j) { VO.map = j || {}; get(); }).catch(function () { VO.map = {}; });
  }
  function voStop() {
    if (!VO.src || !A) return;
    var t = A.c.currentTime; try { VO.src.g.gain.setTargetAtTime(0.0001, t, 0.04); VO.src.s.stop(t + 0.2); } catch (e) {}
    A.duck.gain.cancelScheduledValues(t); A.duck.gain.setTargetAtTime(1, t, 0.12);
    VO.src = null;
  }
  function voSay(sh) {
    if (!A || !sh.vo) return;
    var b = VO.buf[vid(sh.vo)]; if (!b || typeof b === "string") return;
    voStop();
    var c = A.c, t = c.currentTime + 0.06, s = c.createBufferSource(), g = c.createGain();
    s.buffer = b; g.gain.value = 1.15; s.connect(g); g.connect(A.an); s.start(t);
    A.duck.gain.cancelScheduledValues(t); A.duck.gain.setTargetAtTime(0.32, t - 0.04, 0.05); A.duck.gain.setTargetAtTime(1, t + b.duration, 0.25);
    VO.src = { s: s, g: g }; s.onended = function () { if (VO.src && VO.src.s === s) VO.src = null; };
  }
  function noiseSrc(t, dur) { var s = A.c.createBufferSource(); s.buffer = A.noise; s.loop = true; s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); return s; }
  var I = {
    kick: function (t, v) { var o = A.c.createOscillator(), g = A.c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13); env(g, t, v || 0.9, 0.003, 0.4); o.connect(g); g.connect(A.bus); o.start(t); o.stop(t + 0.5); },
    hat: function (t, v) { var s = noiseSrc(t, 0.06), f = A.c.createBiquadFilter(), g = A.c.createGain(); f.type = "highpass"; f.frequency.value = 7600; env(g, t, v || 0.11, 0.002, 0.045); s.connect(f); f.connect(g); g.connect(A.bus); },
    clap: function (t, v) { var s = noiseSrc(t, 0.25), f = A.c.createBiquadFilter(), g = A.c.createGain(); f.type = "bandpass"; f.frequency.value = 1700; f.Q.value = 0.9; env(g, t, v || 0.38, 0.004, 0.17); s.connect(f); f.connect(g); g.connect(A.bus); g.connect(A.verb); },
    bass: function (t, hz, dur, v) { var o = A.c.createOscillator(), f = A.c.createBiquadFilter(), g = A.c.createGain(); o.type = "sawtooth"; o.frequency.value = hz; f.type = "lowpass"; f.frequency.setValueAtTime(420, t); f.frequency.exponentialRampToValueAtTime(140, t + dur); f.Q.value = 7; env(g, t, v || 0.3, 0.008, dur); o.connect(f); f.connect(g); g.connect(A.bus); o.start(t); o.stop(t + dur + 0.1); },
    tick: function (t, hz, v) { var o = A.c.createOscillator(), g = A.c.createGain(); o.type = "square"; o.frequency.value = hz || 2400; env(g, t, v || 0.05, 0.001, 0.03); o.connect(g); g.connect(A.bus); o.start(t); o.stop(t + 0.06); },
    boom: function (t) {
      I.kick(t, 1.1);
      var o = A.c.createOscillator(), g = A.c.createGain(); o.frequency.setValueAtTime(58, t); o.frequency.exponentialRampToValueAtTime(34, t + 1.2); env(g, t, 0.75, 0.005, 1.5); o.connect(g); g.connect(A.bus); o.start(t); o.stop(t + 1.7);
      var s = noiseSrc(t, 0.9), f = A.c.createBiquadFilter(), g2 = A.c.createGain(); f.type = "lowpass"; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(180, t + 0.8); env(g2, t, 0.5, 0.004, 0.8); s.connect(f); f.connect(g2); g2.connect(A.bus); g2.connect(A.verb);
    },
    hit: function (t) { I.kick(t, 0.8); I.clap(t, 0.3); },
    riser: function (t, dur) { var s = noiseSrc(t, dur), f = A.c.createBiquadFilter(), g = A.c.createGain(); f.type = "bandpass"; f.Q.value = 5; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + dur * 0.96); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04); s.connect(f); f.connect(g); g.connect(A.bus); g.connect(A.verb); },
    glitch: function (t) { for (var i = 0; i < 7; i++) I.tick(t + i * 0.022, 200 + Math.random() * 3200, 0.07); },
    stamp: function (t) { I.kick(t, 0.5); I.tick(t, 1200, 0.08); I.hat(t + 0.01, 0.2); }
  };
  /* the groove: pad always, then kick, then hats and bass, then claps */
  var PROG = [73.42, 58.27, 87.31, 65.41], seq = { on: false, next: 0, n: 0, bar: 0, level: 0, timer: 0 }, pad = null;
  function padStart() {
    if (pad) return;
    var c = A.c, g = c.createGain(), f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 560; f.Q.value = 1;
    g.gain.value = 0.0001; g.gain.setTargetAtTime(0.055, c.currentTime, 0.8);
    var os = [1, 1.5, 2.01].map(function (m) { var o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = PROG[0] * 2 * m; o.connect(f); o.start(); return o; });
    f.connect(g); g.connect(A.bus); g.connect(A.verb);
    pad = { g: g, os: os };
  }
  function padNote(bar) { if (!pad) return; var r = PROG[bar % 4] * 2; pad.os.forEach(function (o, i) { o.frequency.setTargetAtTime(r * [1, 1.5, 2.01][i], A.c.currentTime, 0.12); }); }
  function schedule() {
    if (!seq.on) return;
    while (seq.next < A.c.currentTime + 0.12) {
      var t = seq.next, n = seq.n, step = n % 8, L = seq.level, root = PROG[(seq.bar + Math.floor(n / 8)) % 4];
      if (step === 0) padNote(seq.bar + Math.floor(n / 8));
      if (L >= 1 && n % 2 === 0) I.kick(t, step === 0 ? 0.95 : 0.75);
      if (L >= 2 && n % 2 === 1) I.hat(t, 0.1);
      if (L >= 2 && (step === 0 || step === 3 || step === 4 || step === 7)) I.bass(t, root, BEAT * (step === 3 || step === 7 ? 0.4 : 0.9), 0.28);
      if (L >= 3 && (step === 2 || step === 6)) I.clap(t, 0.3);
      if (L >= 3 && n % 2 === 0) I.hat(t + BEAT / 4, 0.05);
      seq.next += BEAT / 2; seq.n++;
    }
  }
  function scoreStart() {
    var a = audio(); if (!a) return;
    if (a.c.state !== "running") { try { a.c.resume(); } catch (e) {} }
    a.bus.gain.cancelScheduledValues(a.c.currentTime); a.bus.gain.setTargetAtTime(0.85, a.c.currentTime, 0.05);
    padStart(); seq.on = true; seq.next = a.c.currentTime + 0.02; seq.n = 0; seq.bar = 0;
    clearInterval(seq.timer); seq.timer = setInterval(schedule, 25);
  }
  /* every cut restarts the bar so the downbeat lands with the picture */
  function scoreCut(level) { if (!A || !seq.on) return; seq.bar += Math.max(1, Math.ceil(seq.n / 8)); seq.n = 0; seq.next = A.c.currentTime + 0.005; if (level != null) seq.level = level; }
  function scoreStop() {
    if (!A) return;
    seq.on = false; clearInterval(seq.timer);
    var c = A.c; A.bus.gain.cancelScheduledValues(c.currentTime); A.bus.gain.setTargetAtTime(0.0001, c.currentTime, 0.18);
    var p = pad; pad = null;
    if (p) setTimeout(function () { p.os.forEach(function (o) { try { o.stop(); } catch (e) {} }); }, 1200);
  }
  function play(kind, at) { if (!A || !seq.on) return; var t = A.c.currentTime + (at || 0) + 0.005; if (I[kind]) I[kind](t, kind === "riser" ? BEAT * 2 : undefined); }

  /* =================================================================
     LIVE: Houston's clock and Triple J's posted hours, Monday to Saturday 9 to 7
     ================================================================= */
  function houston() {
    var now = new Date(), p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).formatToParts(now).forEach(function (x) { p[x.type] = x.value; });
    var h24 = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).format(now), 10) % 24;
    var day = p.weekday, open = day !== "Sun" && h24 >= 9 && h24 < 19, status;
    if (open) status = ["Open", "Closes at 7 PM."];
    else if (day === "Sun" || (day === "Sat" && h24 >= 19)) status = ["Closed", "Opens Monday at 9 AM."];
    else if (h24 < 9) status = ["Closed", "Opens today at 9 AM."];
    else status = ["Closed", "Opens tomorrow at 9 AM."];
    return { time: p.hour + ":" + p.minute, sec: p.second, ampm: p.dayPeriod || "", open: open, status: status };
  }

  /* =================================================================
     THE CUTS
     ================================================================= */
  var FORMS = ["Bill Of Sale", "Form 130-U", "Power Of Attorney", "Vehicle Responsibility"];
  var STAGES = ["The car", "The odometer", "The buyer", "The money", "The paperwork", "Signed"];
  var PROOFS = ["LinkedIn", "GitHub", "Triple J Auto Investment", "Degree PDF", "Anthropic certificates", "City of Pearland record"];
  function cuts(name) {
    var N = name ? name.toUpperCase() + "." : "LISTEN.";
    var P = name ? ", " + name : "";
    return {
      interviewer: { label: "The screening cut", shots: [
        { k: "cold", b: 2, level: 0, cue: "riser" },
        { k: "name", b: 2, level: 1, cue: "boom", t: N },
        { k: "slam", b: 4, level: 1, cue: "hit", lines: ["You've read the", "*AI-written* resumes."], vo: "You've read the AI-written resumes." },
        { k: "slam", b: 3, level: 1, cue: "glitch", lines: ["So don't", "read mine."], glitch: true, vo: "So don't read mine." },
        { k: "slam", b: 2, level: 2, cue: "boom", lines: ["*Watch it run.*"], vo: "Watch it run." },
        { k: "id", b: 4, level: 2, cue: "boom", vo: "I'm Jason Obawemimo." },
        { k: "live", b: 6, level: 2, cue: "hit", lead: "The dealership I co-own and run, since August 2024.", vo: "This is the dealership I co-own and run, in Houston." },
        { k: "scan", level: 2, cue: "hit", lead: ["The desk it closes sales on?", "*I built it.*"], vo: "And the desk it closes sales on? I built it." },
        { k: "stages", b: 9, level: 3, cue: "boom", lead: "Obavia Desk. The sale desk I built at Triple J, now being built for Texas independent dealers. In development.", vo: "Now I'm building it for Texas independent dealers. It's called Obavia Desk." },
        { k: "count", b: 6, level: 3, cue: "hit", vo: "Nineteen Anthropic courses. A three point six three." },
        { k: "proof", b: 6, level: 3, cue: "boom", vo: "Don't take my word for it. Every link checks out." },
        { k: "slam", b: 3, level: 1, cue: "glitch", lines: ["P.S. This music isn't a file.", "*Your browser is playing it.*"], small: true },
        { k: "end", level: 0, cue: "end", cta: "interviewer", h: "Your move" + P + ".", vo: "Your move." }
      ] },
      partner: { label: "The dealer cut", shots: [
        { k: "cold", b: 2, level: 0, cue: "riser" },
        { k: "name", b: 2, level: 1, cue: "boom", t: N },
        { k: "slam", b: 4, level: 1, cue: "hit", lines: ["Every sale,", "*start to signed.*"], vo: "Every sale, start to signed." },
        { k: "slam", b: 3, level: 2, cue: "glitch", lines: ["One question", "per screen."], glitch: true, vo: "One question per screen." },
        { k: "scan", level: 2, cue: "hit", lead: ["Scan the license once.", "*Every form fills.*"], vo: "Scan the license once, and every form fills." },
        { k: "slam", b: 5, level: 3, cue: "boom", lines: ["Cash. Buy here pay here.", "*Bank financing.*"], sub: "Texas sales tax, title, registration and your doc fee, worked out on every deal.", vo: "Cash, buy here pay here, or the bank." },
        { k: "stages", b: 9, level: 3, cue: "boom", lead: "Obavia Desk. From the car to the last signature, and the buyer signs at the desk.", vo: "That's Obavia Desk. From the car to the last signature." },
        { k: "live", b: 6, level: 2, cue: "hit", lead: "Built on the floor of the dealership I co-own in Houston:", vo: "I'm building it on our lot in Houston." },
        { k: "slam", b: 5, level: 1, cue: "hit", lines: ["I won't sell you", "*results I don't have yet.*"], sub: "Obavia Desk is in development, with early access for Texas dealers. No price is published yet.", vo: "I won't sell you results I don't have yet." },
        { k: "end", level: 0, cue: "end", cta: "partner", h: "Want it on your lot" + P + "?", vo: "Want it on your lot?" }
      ] },
      lurker: { label: "The fun cut", shots: [
        { k: "cold", b: 2, level: 0, cue: "riser" },
        { k: "name", b: 2, level: 1, cue: "boom", t: N },
        { k: "slam", b: 2, level: 1, cue: "hit", lines: ["No pitch."], vo: "No pitch." },
        { k: "slam", b: 3, level: 2, cue: "glitch", lines: ["This music", "*isn't a file.*"], glitch: true, vo: "This music isn't a file." },
        { k: "drum", level: 3, cue: "boom", vo: "Go on. Hit it." },
        { k: "live", b: 5, level: 2, cue: "hit", lead: "Meanwhile, at the dealership I co-own in Houston:", vo: "Meanwhile, at our lot in Houston." },
        { k: "scan", level: 2, cue: "hit", lead: ["I built the desk it", "*closes sales on.*"], vo: "I built the desk it closes sales on." },
        { k: "end", level: 0, cue: "end", cta: "lurker", h: "Have a look around" + P + ".", vo: "Have a look around." }
      ] }
    };
  }

  function words(lines) {
    var n = 0;
    return lines.map(function (l) {
      return '<span class="k__l">' + l.split(/(\*[^*]+\*)/).filter(Boolean).map(function (part) {
        var em = /^\*.*\*$/.test(part), txt = em ? part.slice(1, -1) : part;
        return txt.split(" ").filter(Boolean).map(function (w) { return '<span class="w' + (em ? " w--em" : "") + '" data-w="' + (n++) + '">' + esc(w) + "</span>"; }).join(" ");
      }).join(" ") + "</span>";
    }).join("");
  }
  var DRAW = {
    cold: function () { return '<p class="tr__roll">Rolling</p>'; },
    name: function (s) { return '<h2 class="k k--name"><span class="w" data-w="0">' + esc(s.t) + "</span></h2>"; },
    slam: function (s) { return '<h2 class="k' + (s.small ? " k--small" : "") + (s.glitch ? " k--glitch" : "") + '">' + words(s.lines) + "</h2>" + (s.sub ? '<p class="tr__sub" data-at="' + (s.lines.join(" ").split(" ").length * 0.5 + 0.5) + '">' + esc(s.sub) + "</p>" : ""); },
    id: function () {
      return '<figure class="tr__id"><img src="' + FACE + '" alt="" /></figure><div class="tr__idtext"><h2 class="k k--id">' + words(["Jason", "*Obawemimo.*"]) + '</h2><p class="tr__tags" data-at="1.5"><span>AI engineer</span><span>Business operator</span><span>Pearland, Texas</span></p></div>';
    },
    live: function (s) {
      return '<p class="tr__kicker" data-at="0">' + esc(s.lead) + '</p><p class="tr__live"><span class="tr__clock" data-clock>--:--</span><span class="tr__ampm" data-ampm></span></p>' +
        '<p class="tr__where" data-at="0.5">Houston, Texas, right now</p><h2 class="k k--status" data-at="1.5">Triple J is <em data-open>open.</em></h2><p class="tr__status" data-at="2" data-status></p><p class="tr__sub" data-at="2.5">8774 Almeda Genoa Rd. Monday to Saturday, 9 to 7.</p>';
    },
    scan: function (s) {
      return '<h2 class="k k--mid">' + words(s.lead) + '</h2>' +
        '<div class="tr__scan" data-at="1"><div class="tr__lic"><span class="tr__licbar"></span><b>JOHN A. MARTINEZ</b><i>1402 ELM ST, HOUSTON TX</i><i>DL 4821 **** 07</i><span class="tr__sample">Sample. Fictional buyer.</span><span class="tr__beam"></span></div>' +
        '<ol class="tr__forms">' + FORMS.map(function (f, i) { return '<li data-form="' + i + '"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><use href="#i-check"/></svg>' + f + "</li>"; }).join("") + "</ol></div>" +
        '<button type="button" class="tr__hold" data-hold><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46"/><circle class="tr__holdp" cx="50" cy="50" r="46" pathLength="100"/></svg><span>Hold to scan</span></button>' +
        '<p class="tr__after" data-after>Scan once. <em>Every form fills.</em></p>';
    },
    words: function () {
      var s = "We paid an agency last year and I [never knew] who was [actually on my account].", n = 0;
      var html = esc(s).replace(/\[([^\]]+)\]/g, function (m, w) { return '<button type="button" class="tr__word" data-target="' + (n++) + '">' + w + "</button>"; });
      return '<p class="tr__kicker" data-at="0">A fictional buyer, on your setter’s call</p><blockquote class="tr__buyer" data-at="0.5">“' + html + '”</blockquote>' +
        '<p class="tr__prompt" data-prompt>Tap the words your closer needs.</p><p class="tr__after" data-after>Obavia carries <em>those words</em> to the closer.</p>';
    },
    stages: function (s) {
      return '<span class="appicon appicon--lg tr__icon"><img src="assets/brand/obavia-icon.png" alt="" /></span><h2 class="k k--stage" data-stage>Obavia.</h2>' +
        '<ol class="tr__dots" aria-hidden="true">' + STAGES.map(function (x, i) { return '<li data-dot="' + i + '"></li>'; }).join("") + '</ol><p class="tr__sub" data-at="7">' + esc(s.lead) + "</p>";
    },
    count: function () {
      return '<div class="tr__count" data-c="0"><b data-to="19">0</b><span>Anthropic courses completed</span></div>' +
        '<div class="tr__count" data-c="1"><b data-to="3.63" data-dec="2">0</b><span>GPA. Associate of Arts in Business. Dean’s Honor List.</span></div>' +
        '<div class="tr__count" data-c="2"><b data-to="2024">0</b><span>Operator since August. Founder since September.</span></div>';
    },
    proof: function () {
      return '<h2 class="k k--mid">' + words(["Don't take", "*my word for it.*"]) + '</h2><ul class="tr__proofs">' +
        PROOFS.map(function (p, i) { return '<li data-p="' + i + '"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><use href="#i-check"/></svg>' + p + "</li>"; }).join("") + '</ul><p class="tr__sub" data-at="5">Every link is under Check me.</p>';
    },
    drum: function () {
      return '<canvas class="tr__bigscope" data-bigscope></canvas><h2 class="k k--mid">' + words(["Your browser is playing it.", "*Right now.*"]) + '</h2><p class="tr__prompt" data-prompt>' + (COARSE ? "Tap anywhere to hit the drum." : "Click anywhere to hit the drum.") + '</p><p class="tr__hits" data-hits></p>';
    },
    end: function (s) {
      var c = {
        interviewer: { p: "If I’m a fit, email is fastest. The one-page resume and every proof link are one tap away.",
          b: [["Email me", "mailto:" + EMAIL + "?subject=" + encodeURIComponent("Your site, and a role"), "gold", "email"], ["One-page resume", PDF, "", "pdf"], ["Book 30 minutes", CAL, "", "book"]],
          s: [["Run the desk yourself", "desk"], ["Watch it again", "again"], ["Look around", "site"]] },
        partner: { p: "Ask for early access, or take thirty minutes with me. I run a lot too, so we'll talk about your paperwork, not a pitch.",
          b: [["Ask for early access", "/obavia.html#early", "gold", "briefing"], ["Book 30 minutes", CAL, "", "book"], ["Watch the Desk film", "/obavia.html#film", "", "film"]],
          s: [["Watch it again", "again"], ["Look around", "site"]] },
        lurker: { p: "The desk is a game you can finish in a minute. Obavia Desk is where it is going.",
          b: [["Run the desk", "#story-desk", "gold", "desk"], ["See Obavia Desk", "#story-obavia", "", "obavia"]],
          s: [["Send this to someone", "share"], ["Watch it again", "again"], ["Look around", "site"]] }
      }[s.cta];
      return '<div class="tr__face"><img src="assets/jason-headshot-620.webp" alt="" /></div><h2 class="k k--end">' + words([s.h]) + '</h2><p class="tr__sub" data-at="1">' + c.p + "</p>" +
        '<div class="tr__ctas" data-at="1.5">' + c.b.map(function (b) {
          var ext = /^https?:/.test(b[1]) ? ' target="_blank" rel="noopener"' : "";
          var dl = b[3] === "pdf" ? ' download="Jason Obawemimo - Resume.pdf" data-resume="pdf"' : b[3] === "email" ? ' data-contact="email"' : b[3] === "book" ? ' data-book="reel"' : "";
          return '<a class="btn' + (b[2] ? " btn--gold" : "") + '" href="' + esc(b[1]) + '"' + ext + dl + ' data-reel-cta="' + b[3] + '">' + b[0] + "</a>";
        }).join("") + "</div>" +
        '<p class="tr__more" data-at="2">' + c.s.map(function (x) { return '<button type="button" class="textlink" data-reel-go="' + x[1] + '">' + x[0] + "</button>"; }).join("") + "</p>";
    }
  };

  /* =================================================================
     THE PROJECTOR
     ================================================================= */
  var el = null, stage = null, shots = [], spec = [], cut = null, i = 0, role = null, name = "", open = false, viaIntro = false;
  var tShot = 0, raf = 0, useAudio = false, startedAt = 0, fired = {}, state = {};
  function clock() { return useAudio && A && A.c.state === "running" ? A.c.currentTime : performance.now() / 1000; }
  function since() { return clock() - tShot; }

  function build() {
    el = document.createElement("div");
    el.className = "tr"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", cut.label);
    el.innerHTML =
      '<div class="tr__glow" aria-hidden="true"></div>' +
      '<div class="tr__stage">' + spec.map(function (s, n) { return '<section class="tr__shot tr--' + s.k + '" data-n="' + n + '" aria-hidden="true"><div class="tr__in">' + DRAW[s.k](s) + "</div></section>"; }).join("") + "</div>" +
      '<div class="tr__flash" aria-hidden="true"></div>' +
      '<div class="tr__hud"><p class="tr__title"><b>Jason Obawemimo</b> <span>' + esc(cut.label) + '</span></p><p class="tr__tc" aria-hidden="true">00:00:00:00</p>' +
        '<button type="button" class="tr__btn" data-toggle="sound" aria-label="Sound"></button>' +
        '<button type="button" class="tr__btn tr__x" data-reel-close aria-label="Close and look around"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>' +
      '<div class="tr__foot"><canvas class="tr__scope" aria-hidden="true"></canvas><i class="tr__bar"><b></b></i><p class="tr__hint">' + (COARSE ? "Tap to skip ahead" : "Click or press → to skip ahead") + "</p></div>" +
      '<p class="tr__sr" aria-live="polite"></p>';
    body.appendChild(el);
    stage = el.querySelector(".tr__stage");
    shots = [].slice.call(el.querySelectorAll(".tr__shot"));
    var snd = el.querySelector('[data-toggle="sound"]'), m = window.JG_SFX && window.JG_SFX.muted && window.JG_SFX.muted();
    snd.textContent = m ? "Sound off" : "Sound on"; snd.setAttribute("aria-pressed", m ? "false" : "true");
    wire();
  }

  function playReel(r, o) {
    o = o || {};
    if (open || !{ interviewer: 1, partner: 1, lurker: 1 }[r]) return;
    role = r; name = (o.name || "").split(" ")[0]; viaIntro = o.from === "intro";
    cut = cuts(name)[r]; spec = cut.shots; i = 0; open = true;
    build();
    if (window.JG_LOCK) window.JG_LOCK(true);
    audio(); scoreStart(); useAudio = !!(A && A.c.state === "running"); voLoad(spec);
    startedAt = clock();
    requestAnimationFrame(function () { el.classList.add("is-on"); show(0); });
    T("reel_started", { role: r, where: o.from || "chip" });
    raf = requestAnimationFrame(loop);
  }

  function show(n) {
    if (n >= shots.length) n = shots.length - 1;
    shots.forEach(function (s, k) { var on = k === n; s.classList.toggle("is-on", on); s.setAttribute("aria-hidden", on ? "false" : "true"); });
    i = n; tShot = clock(); fired = {}; state = {};
    var s = spec[i], sh = shots[i];
    sh.querySelectorAll(".is-in").forEach(function (x) { x.classList.remove("is-in"); });
    el.classList.toggle("is-end", s.k === "end");
    el.classList.toggle("is-interactive", s.k === "scan" || s.k === "words" || s.k === "drum");
    scoreCut(s.level); voSay(s);
    if (s.cue === "end") { sample("sparkle", { gain: 0.8 }); hap("success"); T("reel_finished", { role: role }); var f = sh.querySelector(".btn"); if (f && !COARSE) setTimeout(function () { f.focus({ preventScroll: true }); }, 700); }
    else if (s.cue) { play(s.cue); if (s.cue === "boom") jolt(true); else if (s.cue === "hit") jolt(false); else if (s.cue === "glitch") { el.classList.remove("is-glitch"); void el.offsetWidth; el.classList.add("is-glitch"); } }
    el.querySelector(".tr__sr").textContent = sh.textContent.replace(/\s+/g, " ").trim().slice(0, 220);
    T("reel_shot", { role: role, n: i, kind: s.k });
  }
  function jolt(big) {
    if (RM) return;
    stage.classList.remove("is-shake", "is-nudge"); void stage.offsetWidth; stage.classList.add(big ? "is-shake" : "is-nudge");
    if (big) { var f = el.querySelector(".tr__flash"); f.classList.remove("is-on"); void f.offsetWidth; f.classList.add("is-on"); hap("tap"); }
  }
  function next() { if (i < shots.length - 1) show(i + 1); }
  function once(key) { if (fired[key]) return false; fired[key] = true; return true; }

  function loop() {
    if (!open) return;
    var t = since(), s = spec[i], sh = shots[i], b = t / BEAT;
    sh.querySelectorAll(".w:not(.is-in)").forEach(function (w) {
      var at = parseInt(w.getAttribute("data-w"), 10) * 0.5;
      if (b >= at) { w.classList.add("is-in"); if (s.k !== "name" && at > 0 && once("w" + at)) play("tick"); }
    });
    sh.querySelectorAll("[data-at]:not(.is-in)").forEach(function (x) { if (b >= parseFloat(x.getAttribute("data-at"))) x.classList.add("is-in"); });
    if (s.k === "live") live(sh);
    if (s.k === "stages") stagesTick(sh, b);
    if (s.k === "count") counts(sh, b);
    if (s.k === "proof") proofs(sh, b);
    if (s.k === "scan") scanTick(sh, b);
    if (s.k === "words") wordsTick(sh, b);
    if (s.k === "drum") drumTick(sh, b);
    if (s.b && b >= s.b) next();
    hud();
    raf = requestAnimationFrame(loop);
  }

  var tcEl = null, barEl = null, wave = null;
  function hud() {
    if (!tcEl) { tcEl = el.querySelector(".tr__tc"); barEl = el.querySelector(".tr__bar b"); }
    var total = Math.max(0, clock() - startedAt), sec = Math.floor(total), fr = Math.floor((total - sec) * 24);
    tcEl.textContent = "00:" + String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0") + ":" + String(fr).padStart(2, "0");
    var s = spec[i], frac = s.b ? Math.min(1, since() / (s.b * BEAT)) : 0.5;
    barEl.style.transform = "scaleX(" + Math.min(1, (i + frac) / (spec.length - 1)) + ")";
    scopeDraw(el.querySelector(".tr__scope"), 1);
    var big = shots[i].querySelector("[data-bigscope]"); if (big) scopeDraw(big, 3);
  }
  function scopeDraw(cv, gain) {
    if (!cv) return;
    var w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    g.strokeStyle = "#c9a642"; g.lineWidth = gain > 1 ? 2 : 1.2; g.beginPath();
    var n = 256, k, x, y, v;
    if (A && seq.on && A.c.state === "running") {
      if (!wave || wave.length !== A.an.fftSize) wave = new Uint8Array(A.an.fftSize);
      A.an.getByteTimeDomainData(wave);
      for (k = 0; k < n; k++) { v = (wave[Math.floor(k * wave.length / n)] - 128) / 128; x = k / (n - 1) * w; y = h / 2 + Math.max(-1, Math.min(1, v * gain)) * h * 0.45; if (k) g.lineTo(x, y); else g.moveTo(x, y); }
    } else {
      var tt = performance.now() / 600;
      for (k = 0; k < n; k++) { x = k / (n - 1) * w; y = h / 2 + Math.sin(k / 9 + tt) * h * 0.08; if (k) g.lineTo(x, y); else g.moveTo(x, y); }
    }
    g.stroke();
  }

  /* ---------- shot behaviours ---------- */
  function live(sh) {
    var H = houston();
    sh.querySelector("[data-clock]").textContent = H.time + ":" + H.sec; sh.querySelector("[data-ampm]").textContent = H.ampm;
    if (state.sec !== H.sec) { if (state.sec != null) play("tick"); state.sec = H.sec; }
    if (!state.st) { state.st = 1; sh.querySelector("[data-open]").textContent = H.status[0].toLowerCase() + "."; sh.querySelector("[data-status]").textContent = H.status[1]; sh.classList.toggle("is-open", H.open); }
  }
  function stagesTick(sh, b) {
    var k = Math.floor(b - 1.5);
    if (k >= 0 && k < STAGES.length && state.k !== k) {
      state.k = k; var h = sh.querySelector("[data-stage]"); h.textContent = STAGES[k] + (k === STAGES.length - 1 ? "." : "");
      h.classList.remove("is-pop"); void h.offsetWidth; h.classList.add("is-pop"); h.classList.toggle("is-gold", k === STAGES.length - 1);
      sh.querySelectorAll("[data-dot]").forEach(function (d, j) { d.classList.toggle("is-on", j <= k); });
      if (k === STAGES.length - 1) { play("boom"); jolt(true); } else { play("stamp"); jolt(false); }
    }
  }
  function counts(sh, b) {
    sh.querySelectorAll("[data-c]").forEach(function (box) {
      var c = parseInt(box.getAttribute("data-c"), 10), start = c * 2, on = b >= start && b < start + 2;
      box.classList.toggle("is-on", on);
      if (on) {
        var num = box.querySelector("b"), to = parseFloat(num.getAttribute("data-to")), dec = parseInt(num.getAttribute("data-dec") || "0", 10), p = Math.min(1, (b - start) / 1.1), e = 1 - Math.pow(1 - p, 3);
        num.textContent = (to * e).toFixed(dec);
        if (once("c" + c)) { play("hit"); jolt(false); }
      }
    });
  }
  function proofs(sh, b) {
    sh.querySelectorAll("[data-p]").forEach(function (li) {
      var k = parseInt(li.getAttribute("data-p"), 10);
      if (b >= 2 + k * 0.5 && !li.classList.contains("is-in")) { li.classList.add("is-in"); play("stamp"); }
    });
  }

  /* hold to scan: the ring fills under your thumb, then four forms stamp in on the beat */
  function scanTick(sh, b) {
    if (!state.wired) {
      state.wired = 1;
      var h = sh.querySelector("[data-hold]"), ring = h.querySelector(".tr__holdp"), t0 = 0, rq = 0;
      var go = function () { if (state.scanned) return; t0 = performance.now(); h.classList.add("is-down"); play("riser"); (function f() { var p = Math.min(1, (performance.now() - t0) / 900); ring.style.strokeDashoffset = 100 - p * 100; if (p >= 1) return scanned(sh, false); rq = requestAnimationFrame(f); })(); };
      var stop = function () { if (state.scanned) return; cancelAnimationFrame(rq); h.classList.remove("is-down"); ring.style.strokeDashoffset = 100; };
      h.addEventListener("pointerdown", function (e) { e.preventDefault(); go(); });
      h.addEventListener("pointerup", stop); h.addEventListener("pointerleave", stop); h.addEventListener("pointercancel", stop);
      h.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); scanned(sh, false); } });
      h.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    }
    if (!state.scanned && b >= 9) scanned(sh, true);
    if (state.scanned) {
      var sb = (since() - state.scanAt) / BEAT;
      sh.querySelectorAll("[data-form]").forEach(function (li) { var k = parseInt(li.getAttribute("data-form"), 10); if (sb >= 0.6 + k * 0.5 && !li.classList.contains("is-in")) { li.classList.add("is-in"); play("stamp"); hap("tap"); } });
      if (sb >= 3 && once("after")) { sh.querySelector("[data-after]").classList.add("is-in"); play("boom"); jolt(true); }
      if (sb >= 6.5 && once("leave")) next();
    }
  }
  function scanned(sh, auto) {
    if (state.scanned) return; state.scanned = 1; state.scanAt = since();
    sh.classList.add("is-scanned"); sh.querySelector("[data-hold]").classList.add("is-done");
    sh.querySelector(".tr__holdp").style.strokeDashoffset = 0;
    play("hit"); jolt(false); if (!auto) fx("unlock");
    T("scene_interacted", { scene: "reel_scan", auto: !!auto });
  }

  /* tap the words that matter */
  function wordsTick(sh, b) {
    if (!state.wired) {
      state.wired = 1; state.found = 0;
      sh.querySelectorAll("[data-target]").forEach(function (w) {
        w.addEventListener("click", function () { if (w.classList.contains("is-hit") || state.done) return; w.classList.add("is-hit"); state.found++; play("hit"); jolt(false); hap("tap"); if (state.found >= 2) wordsDone(sh, false); });
      });
    }
    if (!state.done && b >= 10) wordsDone(sh, true);
    if (state.done) { var sb = (since() - state.doneAt) / BEAT; if (sb >= 5 && once("leave")) next(); }
  }
  function wordsDone(sh, auto) {
    if (state.done) return;
    state.done = 1; state.doneAt = since();
    sh.querySelectorAll("[data-target]").forEach(function (w) { w.classList.add("is-hit"); });
    sh.querySelector("[data-prompt]").classList.add("is-gone");
    setTimeout(function () { if (!open) return; sh.querySelector("[data-after]").classList.add("is-in"); play("boom"); jolt(true); }, 380);
    if (!auto) fx("unlock");
    T("scene_interacted", { scene: "reel_words", auto: !!auto });
  }

  /* hit the drum: every tap is a boom, and the scope jumps */
  function drumTick(sh, b) {
    if (!state.wired) {
      state.wired = 1; state.hits = 0;
      sh.addEventListener("pointerdown", function (e) {
        if (e.target.closest("a, button") || spec[i].k !== "drum") return;
        state.hits++; play("boom"); jolt(true);
        sh.querySelector("[data-hits]").textContent = state.hits === 1 ? "One hit." : state.hits + " hits.";
        sh.querySelector("[data-prompt]").classList.add("is-gone");
        if (state.hits === 1) T("scene_interacted", { scene: "reel_drum" });
      });
    }
    if (b >= (state.hits ? 14 : 9) && once("leave")) next();
  }

  /* ---------- input ---------- */
  function wire() {
    stage.addEventListener("click", function (e) {
      if (e.target.closest("a, button, [data-target]")) return;
      if (spec[i].k === "end" || el.classList.contains("is-interactive")) return;
      next();
    });
    el.querySelector("[data-reel-close]").addEventListener("click", function () { leave("site", "close"); });
    el.addEventListener("click", function (e) {
      var a = e.target.closest("[data-reel-cta]"), g = e.target.closest("[data-reel-go]");
      if (a) {
        var k = a.getAttribute("data-reel-cta"); fx("choice"); T("cta_click", { label: "reel_" + k, role: role });
        if (k === "briefing" || k === "film") { try { sessionStorage.setItem("jg_greet", name || "1"); } catch (err) {} }
        if (k === "desk" || k === "obavia") { e.preventDefault(); leave(k, "cta"); }
        return;
      }
      if (!g) return;
      var to = g.getAttribute("data-reel-go");
      if (to === "share") return share();
      if (to === "again") { fx("choice"); T("cta_click", { label: "reel_again", role: role }); scoreStart(); startedAt = clock(); show(0); return; }
      leave(to, "cta");
    });
    addEventListener("keydown", keys, true);
  }
  function keys(e) {
    if (!open || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target; if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
    if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); if (spec[i].k === "scan" && !state.scanned) scanned(shots[i], false); else if (spec[i].k === "words" && !state.done) wordsDone(shots[i], false); else next(); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); leave("site", "escape"); }
    else if (e.key === "Tab") {
      var f = [].slice.call(el.querySelectorAll("button, a")).filter(function (n) { return n.offsetParent !== null && !n.closest('[aria-hidden="true"]'); });
      if (!f.length) return;
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      else if (!el.contains(document.activeElement)) { e.preventDefault(); a.focus(); }
    }
  }
  function share() {
    var url = location.origin + "/?s=reel", text = "Jason Obawemimo: AI engineer and business operator. Turn the sound on.";
    if (navigator.share) navigator.share({ title: "Jason Obawemimo", text: text, url: url }).then(function () { T("share_opened", { where: "reel" }); }).catch(function () {});
    else if (window.JG_COPY) window.JG_COPY(url).then(function () { if (window.JG_TOAST) window.JG_TOAST("Link copied"); fx("send"); T("forward_copied", { where: "reel" }); });
  }

  /* ---------- leaving: the portrait lands on the Slate ---------- */
  function leave(to, how) {
    if (!open) return;
    open = false; cancelAnimationFrame(raf); voStop(); scoreStop();
    removeEventListener("keydown", keys, true);
    if (spec[i].k !== "end") T("reel_exited", { role: role, at: i, how: how });
    var face = document.querySelector(".slate__face img"), slate = document.querySelector(".slate [data-rise]");
    if (window.JG_LOCK) window.JG_LOCK(false);
    scrollTo(0, 0);
    if (slate) { slate.classList.remove("is-in"); void slate.offsetWidth; }
    var src = el.querySelector(".tr__shot.is-on .tr__face img") || el.querySelector(".tr__shot.is-on .tr__id img");
    if (face && !RM) fly(src, face);
    if (!RM) { root.style.setProperty("--bars", "1"); setTimeout(function () { root.style.setProperty("--bars", "0"); }, 560); }
    el.classList.add("is-leaving");
    setTimeout(function () { if (slate) slate.classList.add("is-in"); fx("arrive"); }, RM ? 0 : 380);
    setTimeout(function () {
      el.remove(); tcEl = barEl = null;
      if (viaIntro && window.JG_TOAST) window.JG_TOAST(name ? "Welcome, " + name : "Welcome in");
      viaIntro = false;
      if ((to === "desk" || to === "obavia") && window.JG_STORY) window.JG_STORY(to);
    }, RM ? 60 : 1000);
  }
  function fly(src, face) {
    var b = face.getBoundingClientRect(); if (!b.width) return;
    var a = src ? src.getBoundingClientRect() : { left: innerWidth / 2 - 60, top: innerHeight / 2 - 60, width: 120, height: 120 };
    if (!a.width) return;
    var c = document.createElement("img"); c.src = face.currentSrc || face.src; c.alt = ""; c.className = "reel__fly";
    c.style.cssText = "left:" + a.left + "px;top:" + a.top + "px;width:" + a.width + "px;height:" + a.height + "px;border-radius:" + (src && src.closest(".tr__id") ? "0" : "50%");
    body.appendChild(c);
    var r = getComputedStyle(face.parentNode).borderRadius;
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      c.style.transform = "translate(" + (b.left - a.left) + "px," + (b.top - a.top) + "px) scale(" + (b.width / a.width) + "," + (b.height / a.height) + ")";
      c.style.borderRadius = r === "50%" ? "50%" : (parseFloat(r) || 4) * (a.width / b.width) + "px";
    }); });
    setTimeout(function () { c.classList.add("is-landed"); }, 900);
    setTimeout(function () { c.remove(); }, 1500);
  }

  window.JG_REEL = { play: playReel, open: function () { return open; } };

  /* the cut chips under the Slate play the matching reel */
  var CHIP = { screening: "interviewer", dealer: "partner", agency: "partner", trailer: "lurker" };
  document.addEventListener("click", function (e) {
    var c = e.target.closest && e.target.closest("[data-cut]"); if (!c || !CHIP[c.getAttribute("data-cut")]) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var k = c.getAttribute("data-cut");
    try { localStorage.setItem("jg_cut", k); } catch (err) {}
    document.querySelectorAll("[data-cut]").forEach(function (x) { x.classList.toggle("is-on", x === c); });
    fx("choice"); T("role_chosen", { role: CHIP[k], where: "chip" }, { role: CHIP[k] });
    var n = ""; try { n = localStorage.getItem("jg_name") || ""; } catch (err) {}
    playReel(CHIP[k], { name: n, from: "chip" });
  }, true);
})();
