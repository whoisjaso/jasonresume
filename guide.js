/* ============================================================
   The film. Loader, the gate, and Jason the guide.
   Builds its own DOM. Needs only section ids on the page.
   ============================================================ */
(function () {
  "use strict";

  var RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FINE = window.matchMedia("(pointer: fine)").matches;
  var body = document.body;

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- Icons (authored, one stroke) ---------- */
  var I = {
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4zM16 9.5l5 5M21 9.5l-5 5"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 7l5 5-5 5"/></svg>'
  };

  /* ---------- Faces ---------- */
  var FACE_DIR = "assets/guide/";
  var FACES = ["calm", "warm", "attentive", "serious", "surprised", "laugh", "wink"];
  var faceOk = {};
  var FALLBACK = "assets/jason-headshot-620.webp";

  FACES.forEach(function (f) {
    var im = new Image();
    im.onload = function () { faceOk[f] = true; };
    im.onerror = function () { faceOk[f] = false; };
    im.src = FACE_DIR + f + ".png";
  });
  function faceSrc(f) {
    if (faceOk[f]) return FACE_DIR + f + ".png";
    if (faceOk.calm) return FACE_DIR + "calm.png";
    return FALLBACK;
  }

  /* ---------- Audio: synthesized, unlocked on first gesture ---------- */
  var AC = null;
  var muted = store.get("jg_muted") === "1";
  function unlock() {
    if (AC) return;
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === "suspended") AC.resume();
    } catch (e) { AC = null; }
  }
  ["pointerdown", "keydown", "touchstart"].forEach(function (ev) {
    window.addEventListener(ev, unlock, { once: true, passive: true });
  });
  function tone(freq, dur, type, peak, delay) {
    if (!AC || muted) return;
    var t0 = AC.currentTime + (delay || 0);
    var o = AC.createOscillator();
    var g = AC.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak || 0.06, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(AC.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  var SFX = {
    chime: function () { tone(659.25, 0.42, "sine", 0.055); tone(987.77, 0.6, "sine", 0.04, 0.1); },
    tick: function () { tone(880, 0.09, "triangle", 0.035); },
    low: function () { tone(261.63, 0.8, "sine", 0.05); tone(392, 0.9, "sine", 0.03, 0.05); },
    open: function () { tone(523.25, 0.3, "sine", 0.04); }
  };

  /* ---------- Scroll helper (site.js provides the tween) ---------- */
  function scrollToEl(node) {
    if (!node) return;
    var top = node.getBoundingClientRect().top + window.scrollY;
    var y = Math.max(0, top - Math.round(window.innerHeight * 0.14));
    if (typeof window.JG_SCROLL_TO === "function") window.JG_SCROLL_TO(y, RM ? 0 : 1400);
    else window.scrollTo({ top: y, behavior: RM ? "auto" : "smooth" });
  }

  /* ============================================================
     LOADER
     ============================================================ */

  var seen = store.get("jg_seen") === "1";
  var loader = el(
    '<div id="jg-loader" role="status" aria-live="polite" aria-label="Loading">' +
      '<div class="jg-loader__wrap">' +
        '<div class="jg-loader__stage">' +
          '<div class="jg-loader__medallion"><canvas></canvas></div>' +
          '<svg class="jg-ring" viewBox="0 0 100 100" aria-hidden="true">' +
            '<circle class="jg-ring__track" cx="50" cy="50" r="48.5"/>' +
            '<circle class="jg-ring__progress" cx="50" cy="50" r="48.5"/>' +
            '<circle class="jg-ring__orbit" cx="50" cy="50" r="45" pathLength="100" stroke-dasharray="14 86"/>' +
          '</svg>' +
        '</div>' +
        '<div class="jg-loader__pct"><span>0</span><small>%</small></div>' +
        '<div class="jg-loader__name">Jason Obawemimo</div>' +
      '</div>' +
    '</div>'
  );
  body.appendChild(loader);

  var canvas = loader.querySelector("canvas");
  var pctEl = loader.querySelector(".jg-loader__pct span");
  var ringP = loader.querySelector(".jg-ring__progress");
  var RING_C = 2 * Math.PI * 48.5;
  ringP.style.strokeDasharray = RING_C;
  ringP.style.strokeDashoffset = RING_C;

  /* Water: two height fields, the classic ripple integration, then a
     displacement pass that samples the portrait through the surface. */
  var N = 192;
  var cur = new Float32Array(N * N), prev = new Float32Array(N * N);
  var src = null, out = null, octx = null, vctx = null, ripplesOn = !RM;

  function setupWater(img) {
    var off = document.createElement("canvas");
    off.width = N; off.height = N;
    octx = off.getContext("2d", { willReadFrequently: true });
    // cover-crop the source into the square
    var s = Math.min(img.naturalWidth, img.naturalHeight);
    var sx = (img.naturalWidth - s) / 2, sy = (img.naturalHeight - s) * 0.25;
    octx.drawImage(img, sx, sy, s, s, 0, 0, N, N);
    src = octx.getImageData(0, 0, N, N).data;
    out = octx.createImageData(N, N);

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var size = canvas.clientWidth || 300;
    canvas.width = size * dpr; canvas.height = size * dpr;
    vctx = canvas.getContext("2d");
    vctx.imageSmoothingEnabled = true;
    vctx.imageSmoothingQuality = "high";

    if (!ripplesOn) {
      vctx.drawImage(off, 0, 0, canvas.width, canvas.height);
      return;
    }
    // first ring at the centre so the surface is alive immediately
    drop(N / 2, N / 2, 6, 14);
    requestAnimationFrame(waterFrame);
  }

  function drop(cx, cy, r, strength) {
    var r2 = r * r;
    for (var y = -r; y <= r; y++) for (var x = -r; x <= r; x++) {
      if (x * x + y * y > r2) continue;
      var px = (cx + x) | 0, py = (cy + y) | 0;
      if (px < 1 || py < 1 || px >= N - 1 || py >= N - 1) continue;
      prev[py * N + px] += strength * (1 - (x * x + y * y) / r2);
    }
  }

  var waterAlive = true;
  function waterFrame() {
    if (!waterAlive) return;
    var i, x, y;
    for (y = 1; y < N - 1; y++) {
      var row = y * N;
      for (x = 1; x < N - 1; x++) {
        i = row + x;
        var v = (prev[i - 1] + prev[i + 1] + prev[i - N] + prev[i + N]) * 0.5 - cur[i];
        cur[i] = v * 0.982;
      }
    }
    var d = out.data, k = 0.9;
    for (y = 0; y < N; y++) {
      for (x = 0; x < N; x++) {
        i = y * N + x;
        var dx = 0, dy = 0;
        if (x > 0 && x < N - 1 && y > 0 && y < N - 1) {
          dx = cur[i - 1] - cur[i + 1];
          dy = cur[i - N] - cur[i + N];
        }
        var sx = clamp((x + dx * k) | 0, 0, N - 1);
        var sy = clamp((y + dy * k) | 0, 0, N - 1);
        var si = (sy * N + sx) * 4, oi = i * 4;
        var shade = dx * 2.2;
        d[oi] = clamp(src[si] + shade, 0, 255);
        d[oi + 1] = clamp(src[si + 1] + shade, 0, 255);
        d[oi + 2] = clamp(src[si + 2] + shade, 0, 255);
        d[oi + 3] = 255;
      }
    }
    var t = cur; cur = prev; prev = t;
    octx.putImageData(out, 0, 0);
    vctx.drawImage(octx.canvas, 0, 0, canvas.width, canvas.height);
    requestAnimationFrame(waterFrame);
  }

  // the cursor is a finger on the surface
  var lastGx = -99, lastGy = -99;
  function pointerRipple(e) {
    if (!ripplesOn || !src) return;
    var r = canvas.getBoundingClientRect();
    var gx = ((e.clientX - r.left) / r.width) * N;
    var gy = ((e.clientY - r.top) / r.height) * N;
    if (Math.abs(gx - lastGx) < 1.5 && Math.abs(gy - lastGy) < 1.5) return;
    lastGx = gx; lastGy = gy;
    drop(gx, gy, 2.2, 5);
  }
  canvas.addEventListener("pointermove", pointerRipple, { passive: true });
  canvas.addEventListener("pointerdown", function (e) {
    var r = canvas.getBoundingClientRect();
    drop(((e.clientX - r.left) / r.width) * N, ((e.clientY - r.top) / r.height) * N, 5, 16);
  }, { passive: true });

  // the surface breathes on its own, so it moves before anyone touches it
  var autoTimer = null;
  function autoRipple() {
    if (!ripplesOn || !src) return;
    var a = Math.random() * Math.PI * 2, rad = 30 + Math.random() * 50;
    drop(N / 2 + Math.cos(a) * rad, N / 2 + Math.sin(a) * rad, 3, 4);
    autoTimer = setTimeout(autoRipple, 700 + Math.random() * 900);
  }

  // percentage that takes its time
  var DUR = seen ? 1900 : 4800;
  var t0 = performance.now(), assetsReady = false, finished = false;
  function easeInOutSine(p) { return -(Math.cos(Math.PI * p) - 1) / 2; }
  function pctFrame(now) {
    if (finished) return;
    var raw = clamp((now - t0) / DUR, 0, 1);
    var p = easeInOutSine(raw);
    // hold at 99 until the real assets are in
    var shown = Math.round(p * 100);
    if (shown >= 100 && !assetsReady) shown = 99;
    pctEl.textContent = shown;
    ringP.style.strokeDashoffset = RING_C * (1 - shown / 100);
    if (raw >= 1 && assetsReady) return finishLoader();
    requestAnimationFrame(pctFrame);
  }

  var loaderImg = new Image();
  loaderImg.onload = function () {
    setupWater(loaderImg);
    autoRipple();
    Promise.resolve(document.fonts && document.fonts.ready).then(function () { assetsReady = true; });
  };
  loaderImg.onerror = function () { assetsReady = true; };
  loaderImg.src = "assets/jason-loader.webp";
  requestAnimationFrame(pctFrame);
  // never trap anyone if the image stalls
  setTimeout(function () { assetsReady = true; }, 9000);

  function finishLoader() {
    finished = true;
    pctEl.textContent = "100";
    ringP.style.strokeDashoffset = 0;
    store.set("jg_seen", "1");
    SFX.low();
    setTimeout(function () {
      loader.classList.add("is-done");
      clearTimeout(autoTimer);
      setTimeout(function () {
        waterAlive = false;
        loader.remove();
      }, 1100);
      body.classList.remove("is-loading");
      showGate();
    }, RM ? 0 : 500);
  }

  /* ============================================================
     GATE
     ============================================================ */

  var ROLES = {
    interviewer: { label: "I’m interviewing", key: "1" },
    partner: { label: "I’m a business partner", key: "2" },
    lurker: { label: "Just lurking", key: "3" }
  };

  var gate = el(
    '<div id="jg-gate" role="dialog" aria-modal="true" aria-labelledby="jg-gate-q">' +
      '<div class="jg-gate__wrap">' +
        '<h1 class="jg-gate__q" id="jg-gate-q">Are you an <em>interviewer</em>, a <em>business partner</em>, or just <em>lurking</em>?</h1>' +
        '<div class="jg-gate__choices">' +
          Object.keys(ROLES).map(function (r, i) {
            return '<button class="jg-choice" type="button" data-role="' + r + '" style="--d:' + (250 + i * 120) + 'ms"><span>' + ROLES[r].label + '</span><kbd>' + ROLES[r].key + '</kbd></button>';
          }).join("") +
        '</div>' +
        '<button class="jg-gate__skip" type="button">Skip this, just show me the site</button>' +
      '</div>' +
    '</div>'
  );

  function showGate() {
    body.classList.add("is-gated");
    body.appendChild(gate);
    requestAnimationFrame(function () { requestAnimationFrame(function () { gate.classList.add("is-in"); }); });
    gate.querySelectorAll(".jg-choice").forEach(function (b) {
      b.addEventListener("click", function () { choose(b.dataset.role); });
    });
    gate.querySelector(".jg-gate__skip").addEventListener("click", function () { choose(null); });
    window.addEventListener("keydown", gateKeys);
  }
  function gateKeys(e) {
    var map = { "1": "interviewer", "2": "partner", "3": "lurker" };
    if (map[e.key]) choose(map[e.key]);
    if (e.key === "Escape") choose(null);
  }
  function choose(role) {
    window.removeEventListener("keydown", gateKeys);
    if (role) { store.set("jg_role", role); SFX.chime(); } else { SFX.tick(); }
    gate.classList.add("is-leaving");
    body.classList.remove("is-gated");
    body.classList.add("is-live");
    setTimeout(function () { gate.remove(); }, 950);
    if (role) setTimeout(function () { openGuide(role); }, RM ? 100 : 650);
    else showFab();
  }

  /* ============================================================
     GUIDE
     ============================================================ */

  var guide = el(
    '<aside id="jg-guide" aria-label="Jason, the guide">' +
      '<div class="jg-card">' +
        '<div class="jg-portrait"><img alt="" src="' + FALLBACK + '" /><img alt="" src="' + FALLBACK + '" /></div>' +
        '<div class="jg-body">' +
          '<div class="jg-top"><div class="jg-progress" aria-hidden="true"></div>' +
            '<div class="jg-ctl">' +
              '<button class="jg-ibtn jg-mute" type="button" aria-label="Sound"></button>' +
              '<button class="jg-ibtn jg-close" type="button" aria-label="Close the guide">' + I.close + '</button>' +
            '</div></div>' +
          '<p class="jg-say" aria-live="polite"></p>' +
          '<div class="jg-choices"></div>' +
          '<form class="jg-chat"><input type="text" maxlength="500" placeholder="Ask me anything about the work" aria-label="Ask Jason" autocomplete="off" /><button type="submit" aria-label="Send">' + I.send + '</button></form>' +
          '<p class="jg-note"></p>' +
        '</div>' +
      '</div>' +
    '</aside>'
  );
  body.appendChild(guide);

  var fab = el('<button id="jg-fab" type="button" aria-label="Open the guide"><img alt="" src="' + FALLBACK + '" /><span>Guide</span></button>');
  body.appendChild(fab);
  function showFab() { fab.classList.add("is-in"); }
  fab.addEventListener("click", function () {
    SFX.open();
    openGuide(store.get("jg_role") || "lurker");
  });
  document.querySelectorAll('[data-open-guide]').forEach(function (a) {
    a.addEventListener("click", function (e) { e.preventDefault(); SFX.open(); openGuide(store.get("jg_role") || "lurker"); });
  });

  var imgs = guide.querySelectorAll(".jg-portrait img");
  var sayEl = guide.querySelector(".jg-say");
  var choicesEl = guide.querySelector(".jg-choices");
  var progEl = guide.querySelector(".jg-progress");
  var noteEl = guide.querySelector(".jg-note");
  var chatForm = guide.querySelector(".jg-chat");
  var chatInput = chatForm.querySelector("input");
  var chatBtn = chatForm.querySelector("button");
  var muteBtn = guide.querySelector(".jg-mute");
  var curImg = 0, curFace = "";

  function setMuteIcon() { muteBtn.innerHTML = muted ? I.mute : I.sound; muteBtn.setAttribute("aria-label", muted ? "Sound off. Turn on" : "Sound on. Turn off"); }
  setMuteIcon();
  muteBtn.addEventListener("click", function () {
    muted = !muted; store.set("jg_muted", muted ? "1" : "0"); setMuteIcon(); if (!muted) SFX.tick();
  });
  guide.querySelector(".jg-close").addEventListener("click", closeGuide);

  function setFace(face) {
    if (face === curFace) return;
    curFace = face;
    var next = imgs[1 - curImg];
    next.src = faceSrc(face);
    next.classList.add("is-in");
    imgs[curImg].classList.remove("is-in");
    curImg = 1 - curImg;
  }

  /* typewriter with breath at punctuation */
  var typing = null;
  function say(text, done) {
    if (typing) { clearTimeout(typing); typing = null; }
    sayEl.classList.remove("is-done");
    sayEl.innerHTML = '<span class="jg-text"></span><span class="jg-caret"></span>';
    var span = sayEl.firstChild;
    if (RM) { span.innerHTML = text; sayEl.classList.add("is-done"); if (done) done(); return; }
    // keep <em> tags working: type through a tag-aware token list
    var tokens = text.match(/<[^>]+>|[^<]/g) || [];
    var i = 0, html = "";
    function step() {
      if (i >= tokens.length) { sayEl.classList.add("is-done"); typing = null; if (done) done(); return; }
      var t = tokens[i++];
      html += t;
      span.innerHTML = html;
      var wait = t.length > 1 ? 0 : /[.!?]/.test(t) ? 210 : /[,;:]/.test(t) ? 100 : 19;
      typing = setTimeout(step, wait);
    }
    step();
    sayEl.onclick = function () {
      if (!typing) return;
      clearTimeout(typing); typing = null;
      span.innerHTML = text; sayEl.classList.add("is-done"); if (done) done();
    };
  }

  function setChoices(list) {
    choicesEl.innerHTML = "";
    (list || []).forEach(function (c, i) {
      var b = el('<button class="jg-opt' + (c.primary ? " jg-opt--primary" : "") + '" type="button" style="--i:' + i + '">' + esc(c.label) + '</button>');
      b.addEventListener("click", function () { SFX.tick(); c.go(); });
      choicesEl.appendChild(b);
    });
  }

  function setProgress(n, at) {
    progEl.innerHTML = "";
    for (var i = 0; i < n; i++) {
      var s = document.createElement("i");
      if (i < at) s.className = "is-done";
      if (i === at) s.className = "is-now";
      progEl.appendChild(s);
    }
  }

  var litNode = null;
  function focusSection(sel) {
    if (litNode) litNode.classList.remove("jg-lit");
    litNode = sel ? document.querySelector(sel) : null;
    if (litNode) {
      litNode.classList.add("jg-lit");
      body.classList.add("jg-focus");
      scrollToEl(litNode);
      litNode.querySelectorAll("[data-reveal]").forEach(function (r) { r.classList.add("in-view"); });
      var head = litNode.querySelector(".section__head"); if (head) head.classList.add("in-view");
    } else {
      body.classList.remove("jg-focus");
    }
  }

  /* ---------- Scripts ----------
     Statements, not questions. The choices are the questions.       */

  var S = {}; // state shared across steps
  var CONTACT = "jobawems@gmail.com";

  function line(face, at, text, choices) { return { face: face, at: at, text: text, choices: choices }; }
  function next(label, primary) { return { label: label || "Continue", primary: primary !== false, go: function () { go(S.i + 1); } }; }
  function jump(label, idx) { return { label: label, go: function () { go(idx); } }; }
  function toChat(label) { return { label: label || "Ask me something", go: function () { enterChat(); } }; }
  function finish(label) { return { label: label || "That’s enough for now", go: function () { closeGuide(); } }; }

  var SCRIPTS = {
    interviewer: [
      line("wink", null, "Let me skip the jargon. You’re hiring, or deciding whether to, and you’ve read forty of these this week.", [next("Fair.")]),
      line("serious", null, "So here’s the part that matters. <em>This site is the work sample.</em> The loader, the choice you just made, the fact that I’m talking to you. I built it. You’re inside it.", [next("Show me what you do")]),
      line("calm", "#thesis", "I build the system underneath a business: the site people land on, the paperwork that gets checked before it costs a deal, and the follow-up that actually happens.", [next("Proof")]),
      line("attentive", "#work", "Proof one. A Texas dealer sends a title packet to the county. Three weeks later it comes back over one missing signature and the deal is already sideways. I built the thing that catches it before it leaves the building.", [next("Proof two")]),
      line("serious", "#triple-j", "Proof two. I co-own a dealership. I’ve priced the deal, chased the title, and eaten the bad follow-up. That’s why I don’t automate for sport.", [next("The record")]),
      line("calm", "#experience", "The record, in order. Nothing padded.", [jump("Credentials", 6), jump("Skip to the resume", 7)]),
      line("serious", "#credentials", "Nineteen Anthropic courses. Associate of Arts in Business, GPA 3.63, Dean’s Honor List. Every claim on this site has a proof page behind it. Click any of them.", [next("Wrap it up")]),
      line("warm", "#contact", "That’s the tour. The resume is right there. If you want to talk, my email is the big one.", [toChat("Ask me something"), finish("Done")])
    ],
    partner: [
      line("wink", null, "Let me skip the pitch. You have a business, and something in it is being done by hand that shouldn’t be.", [next("Go on")]),
      line("calm", "#thesis", "Most operations don’t break at the design. They break at the <em>handoff</em>. A lead nobody owns. A packet that leaves unchecked. A process that lives in one head.", [next("Which one is mine")]),
      line("attentive", null, "Closest one wins.", [
        { label: "Nobody finds us", go: function () { S.pain = "found"; go(3); } },
        { label: "Traffic that never becomes a lead", go: function () { S.pain = "convert"; go(3); } },
        { label: "Paperwork and compliance", go: function () { S.pain = "paper"; go(3); } },
        { label: "Follow-up after first contact", go: function () { S.pain = "followup"; go(3); } },
        { label: "It all lives in my head", go: function () { S.pain = "tribal"; go(3); } }
      ]),
      { dynamic: function () {
        var T = {
          found: ["calm", "Being hard to find is the cheapest problem on that list and the slowest to pay back. Before spending on traffic I’d check whether your pages state the offer in the first screen."],
          convert: ["serious", "Traffic that won’t convert is rarely a traffic problem. The page is asking for a decision before it has earned one, or the lead lands where nobody owns it."],
          paper: ["surprised", "That one I’ve lived hardest. A returned packet costs three weeks and sometimes the deal. It starts with finding the one document that actually causes the kickback."],
          followup: ["serious", "Follow-up failure is structural, not effort. If the next action isn’t written down and assigned to a person, it doesn’t survive a busy day."],
          tribal: ["laugh", "A process that lives in one head is a single point of failure drawing a salary. Writing it down is boring and it’s usually the best week of work available."]
        }[S.pain || "tribal"];
        return line(T[0], null, T[1], [next("What did you build for it")]);
      } },
      line("calm", "#work", "This. Apohenia’s Deal Packet Checker reads the packet before the state sees it and hands a human a short list instead of a stack.", [next("And the dealership")]),
      line("attentive", "#triple-j", "And the business I run it in. Clear vehicles, clear terms, real people. Intake, follow-up and reporting run off written scripts, not memory.", [next("What it’s costing me")]),
      line("attentive", null, "Roughly what it’s costing you.", [
        { label: "Under 5 hours a week", go: function () { S.cost = "under5"; go(7); } },
        { label: "5 to 15 hours a week", go: function () { S.cost = "5to15"; go(7); } },
        { label: "15 to 40 hours a week", go: function () { S.cost = "15to40"; go(7); } },
        { label: "More than one full-time role", go: function () { S.cost = "role"; go(7); } }
      ]),
      { dynamic: function () {
        if (typeof window.INTAKE_PREFILL === "function") window.INTAKE_PREFILL({ pain: S.pain, cost: S.cost });
        return line("warm", "#intake", "I’ve written your first message for you. Read it, change it, send it from your own mail. Nothing here is stored.", [toChat("Ask me something first"), finish("Done")]);
      } }
    ],
    lurker: [
      line("laugh", null, "Lurking. Respect. No pitch, then.", [next("Quick version")]),
      line("calm", "#top", "Quick version. I’m Jason. Pearland, Texas. I build the systems under small businesses, and I co-own a car lot.", [next("The weird one")]),
      line("surprised", "#work", "The weird one. I built a thing that reads Texas title paperwork so the county doesn’t bounce it.", [next("The real one")]),
      line("wink", "#triple-j", "The real one. The dealership. Clear vehicles, clear terms, real people.", [next("Okay")]),
      line("warm", null, "That’s it. The site stays here. Poke around.", [toChat("Actually, ask you something"), finish("Done")])
    ]
  };

  var open = false, role = null, steps = [];
  function openGuide(r) {
    role = r; steps = SCRIPTS[r] || SCRIPTS.lurker; S = { i: 0 };
    guide.classList.remove("is-chat");
    guide.classList.add("is-open");
    fab.classList.remove("is-in");
    noteEl.textContent = "";
    open = true;
    go(0);
  }
  function closeGuide() {
    open = false;
    guide.classList.remove("is-open", "is-chat");
    focusSection(null);
    showFab();
  }
  function go(i) {
    if (i >= steps.length) return closeGuide();
    S.i = i;
    var st = steps[i];
    if (st.dynamic) st = st.dynamic();
    var chapters = steps.length;
    setProgress(chapters, i);
    setFace(st.face || "calm");
    setChoices([]);
    focusSection(st.at);
    SFX.chime();
    say(st.text, function () { setChoices(st.choices); });
  }

  window.addEventListener("keydown", function (e) {
    if (!open) return;
    if (e.key === "Escape") { closeGuide(); return; }
    if (guide.classList.contains("is-chat")) return;
    var opts = choicesEl.querySelectorAll(".jg-opt");
    if (!opts.length) return;
    if ((e.key === "Enter" || e.key === " ") && document.activeElement === body) { e.preventDefault(); opts[0].click(); }
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= opts.length) opts[n - 1].click();
  });

  /* ============================================================
     CHAT: the live version of me, with the scripted one behind it
     ============================================================ */

  var history = [];
  var liveDown = null; // null unknown, true reachable, false not

  var FACTS = [
    [/apohenia|packet|webdealer|title|county|registration/i, "serious", "Apohenia is my company. Its first product, Deal Packet Checker, reads a Texas dealer’s title packet before webDEALER sees it, cross-checks the documents, and hands the clerk a short list of exceptions. Founding waitlist, Texas pilot. Not affiliated with TxDMV or any county office."],
    [/triple ?j|dealership|car lot|rental|finance|financing/i, "calm", "Triple J Auto Investment is a Houston dealership I co-own and run. Cars, trucks and SUVs you can finance in house, sell and trade valuations, and registration support after the sale. Clear vehicles, clear terms, real people."],
    [/credential|certif|anthropic|course|claude/i, "serious", "Nineteen completed Anthropic courses across Claude, Claude Code, the API, Model Context Protocol, agent skills, subagents, Bedrock, Vertex AI and AI fluency. The certificates are one PDF on this site."],
    [/degree|school|college|gpa|education|study/i, "calm", "Associate of Arts in Business from San Jacinto College, May 2026, GPA 3.63, Dean’s Honor List. Currently pursuing a Bachelor’s in Neuroscience, expected 2027."],
    [/stack|tools?|tech|supabase|postgres|vercel|mcp|codex/i, "attentive", "Supabase and PostgreSQL underneath, Vercel in production, Claude and Codex for agentic work, MCP integrations wired end to end. Obsidian for the knowledge base."],
    [/where|based|location|pearland|houston|texas/i, "calm", "Pearland, Texas. The dealership is in Houston, at 8774 Almeda Genoa Rd."],
    [/hire|rate|price|cost|budget|available|contract|work with/i, "warm", "Easiest path: the intake at the bottom of the page writes your first message for you. Or just email me at " + CONTACT + "."],
    [/site|website|this|built|how.*(make|build)/i, "wink", "This site is plain HTML, CSS and JavaScript on Vercel. The loader is a water simulation on a canvas. The guide is scripted first and live second. Nothing here needs a framework to feel like it does."],
    [/email|contact|reach|talk/i, "warm", "Email is " + CONTACT + ". It goes to a real inbox that I read."]
  ];
  function scripted(q) {
    for (var i = 0; i < FACTS.length; i++) if (FACTS[i][0].test(q)) return { face: FACTS[i][1], text: FACTS[i][2] };
    return { face: "attentive", text: "That one needs the live version of me. Email it to " + CONTACT + " and I’ll answer properly." };
  }

  function enterChat() {
    guide.classList.add("is-chat");
    focusSection(null);
    setChoices([]);
    setProgress(0, 0);
    setFace("attentive");
    say("Ask me anything about the work. I’ll answer as myself.", function () {
      setChoices([finish("Back to the site")]);
    });
    setTimeout(function () { chatInput.focus({ preventScroll: true }); }, 400);
  }

  chatForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = chatInput.value.trim();
    if (!q) return;
    chatInput.value = "";
    chatBtn.disabled = true;
    SFX.tick();
    setChoices([]);
    setFace("attentive");
    history.push({ role: "user", content: q });
    sayEl.classList.remove("is-done");
    sayEl.innerHTML = '<span class="jg-text"></span><span class="jg-caret"></span>';

    var handled = false;
    function reply(face, text, note) {
      if (handled) return; handled = true;
      chatBtn.disabled = false;
      history.push({ role: "assistant", content: text });
      if (history.length > 24) history = history.slice(-24);
      setFace(face);
      noteEl.textContent = note || "";
      say(text, function () { setChoices([finish("Back to the site")]); });
    }

    if (liveDown === false) { var s = scripted(q); return reply(s.face, s.text); }

    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 20000);
    fetch("/api/guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: role, messages: history.slice(-12) }),
      signal: ctrl.signal
    }).then(function (r) {
      clearTimeout(timer);
      if (r.status === 503) { liveDown = false; throw new Error("unconfigured"); }
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    }).then(function (j) {
      liveDown = true;
      reply(FACES.indexOf(j.face) >= 0 ? j.face : "calm", j.text);
    }).catch(function () {
      var s = scripted(q);
      var note = liveDown === false ? "The live version of me isn’t switched on here, so this is the scripted one." : "";
      reply(s.face, s.text, note);
    });
  });

  /* Sound stays honest: nothing plays until the page has been touched */
})();
