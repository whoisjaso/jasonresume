/* Run the desk: a hands-on sketch of Triple J's Handle a Sale flow, with the
   film's own fictional buyer and figures. One plain question at a time, a
   license scanned once that fills every form, the registration math, English
   or Spanish, a signature, and the deal on file. Then a hard cut to the real
   business and the real film.

   Without JavaScript every step is readable as a list. With it, one step at
   a time. The hold is juice, never a gate: a tap or Enter scans instantly.

   window.JG_HOLD(button, {ms, onDone, onProgress}) is shared with the trailer. */
(function () {
  "use strict";
  var desk = document.getElementById("desk"); if (!desk) return;
  function FX(k) { if (window.JG_FX) window.JG_FX(k); }
  function T(e, p) { if (window.JG_TRACK) window.JG_TRACK(e, p); }
  function still() { return window.JG_STILL ? window.JG_STILL() : false; }

  /* ---------- the shared hold verb ---------- */
  window.JG_HOLD = function (btn, o) {
    var ms = o.ms || 900, start = 0, raf = null, p = 0, done = false, downAt = 0, held = false;
    function set(v) { p = v; btn.style.setProperty("--hold", v.toFixed(3)); if (o.onProgress) o.onProgress(v); }
    function tick(t) {
      if (!held) return;
      if (!start) start = t;
      var v = Math.min(1, (t - start) / ms); set(v);
      if (v >= 1) { finish(); return; }
      raf = requestAnimationFrame(tick);
    }
    function finish() { held = false; if (done && !o.repeat) return; done = !o.repeat; set(1); btn.classList.add("is-done"); if (o.onDone) o.onDone(); if (o.repeat) setTimeout(function () { set(0); btn.classList.remove("is-done"); }, 200); }
    function down(e) { if (done) return; if (e && e.type === "pointerdown") { try { btn.setPointerCapture(e.pointerId); } catch (x) {} } held = true; downAt = performance.now(); start = 0; if (o.onStart) o.onStart(); raf = requestAnimationFrame(tick); }
    function up() {
      if (!held) return; held = false; cancelAnimationFrame(raf);
      if (performance.now() - downAt < 180 || still()) { finish(); return; } /* a tap scans at once */
      if (p < 1) { if (o.onCancel) o.onCancel(); drain(); }                  /* released early: silent */
    }
    function drain() { var from = p, t0 = performance.now(); (function d(t) { var v = Math.max(0, from - (t - t0) / 250); set(v); if (v > 0 && !held) requestAnimationFrame(d); })(t0); }
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up); btn.addEventListener("pointercancel", up); btn.addEventListener("pointerleave", function () { if (held) up(); });
    btn.addEventListener("keydown", function (e) { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); down(); } });
    btn.addEventListener("keyup", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); up(); } });
    btn.addEventListener("click", function (e) { e.preventDefault(); });
    return { reset: function () { done = false; set(0); btn.classList.remove("is-done"); } };
  };

  var steps = [].slice.call(desk.querySelectorAll(".step"));
  var dots = [].slice.call(desk.querySelectorAll(".desk__track li"));
  var live = desk.querySelector("[data-desk-live]");
  var reveal = document.getElementById("desk-reveal");
  var restart = desk.querySelector('[data-desk="restart"]');
  var at = -1, started = false, flipped = false, typedSig = false;
  var BUYER = { name: "JOHN A. MARTINEZ", addr: "1402 ELM ST, HOUSTON TX", dl: "DL 4821 **** 07" };

  desk.classList.add("is-live");
  function say(t) { if (live) live.textContent = t; }
  function show(i) {
    at = i;
    steps.forEach(function (s, j) { s.classList.toggle("is-now", j === i); });
    dots.forEach(function (d, j) { d.classList.toggle("is-done", j < i); d.classList.toggle("is-now", j === i); });
    var s = steps[i]; if (!s) return;
    T("desk_step", { step: s.getAttribute("data-step"), n: i + 1 });
    var f = s.querySelector("button, [tabindex]");
    if (f && started) setTimeout(function () { f.focus({ preventScroll: true }); }, 60);
    if (s.getAttribute("data-step") === "file") onFile();
    if (s.getAttribute("data-step") === "sign") setupPad();
  }
  function next() { if (at < steps.length - 1) show(at + 1); }
  function begin() { if (started) return; started = true; T("scene_interacted", { scene: "desk", action: "start" }); if (restart) restart.hidden = false; }

  /* Questions: one tap answers and moves on */
  desk.addEventListener("click", function (e) {
    var o = e.target.closest(".opt"); if (!o) return;
    var step = o.closest(".step"); begin();
    step.querySelectorAll(".opt").forEach(function (b) { b.setAttribute("aria-pressed", b === o ? "true" : "false"); });
    FX("choice");
    var name = step.getAttribute("data-step");
    if (name === "math") { doMath(o.getAttribute("data-v")); return; }
    say(o.textContent.replace(/\s+/g, " ").trim() + ".");
    setTimeout(next, still() ? 0 : 420);
  });

  /* Continue buttons for the steps that need a beat */
  function addNext(stepName, label) {
    var s = desk.querySelector('[data-step="' + stepName + '"]'); if (!s) return null;
    var b = document.createElement("button"); b.type = "button"; b.className = "btn btn--gold btn--sm step__next"; b.textContent = label || "Continue"; b.hidden = true;
    b.addEventListener("click", function () { FX("choice"); next(); });
    s.appendChild(b); return b;
  }
  var nextScan = addNext("scan"), nextMath = addNext("math"), nextLang = addNext("lang");

  /* Scan: hold, and every form fills at once */
  var scanBox = desk.querySelector(".scan"), holdBtn = desk.querySelector('[data-hold="scan"]'), scanned = false;
  var fields = [].slice.call(desk.querySelectorAll(".sheet i"));
  var holdCtl = null;
  if (holdBtn) {
    holdCtl = window.JG_HOLD(holdBtn, {
      ms: 900,
      onStart: function () { begin(); scanBox.classList.add("is-scanning"); },
      onCancel: function () { scanBox.classList.remove("is-scanning"); },
      onDone: function () {
        if (scanned) return; scanned = true;
        scanBox.classList.remove("is-scanning"); scanBox.classList.add("is-filled");
        FX("arrive"); holdBtn.querySelector("span").textContent = "Scanned";
        typeAll(function () { say("License scanned. Four forms filled."); if (nextScan) { nextScan.hidden = false; nextScan.focus({ preventScroll: true }); } });
      }
    });
  }
  function typeAll(done) {
    var texts = fields.map(function (f) { return BUYER[f.getAttribute("data-f")] || ""; });
    if (still()) { fields.forEach(function (f, i) { f.textContent = texts[i]; }); done(); return; }
    var max = Math.max.apply(null, texts.map(function (t) { return t.length; })), n = 0;
    (function step() {
      n++;
      fields.forEach(function (f, i) { f.textContent = texts[i].slice(0, n); });
      FX("key");
      if (n < max) setTimeout(step, 28); else done();
    })();
  }

  /* The registration math, with the film's fictional figures */
  var ledger = desk.querySelector(".ledger");
  var MONEY = { top: { vehicle: "$4,000.00", tax: "$250.00", title: "$33.00", doc: "$292.00", reg: "$75.00", total: "$4,650.00" }, whole: { vehicle: "$3,388.24", tax: "$211.76", title: "$33.00", doc: "$292.00", reg: "$75.00", total: "$4,000.00" } };
  function doMath(v) {
    var m = MONEY[v] || MONEY.top;
    ledger.classList.remove("is-on"); void ledger.offsetWidth;
    Object.keys(m).forEach(function (k) { var dd = ledger.querySelector('[data-m="' + k + '"]'); if (dd) dd.textContent = m[k]; });
    ledger.classList.add("is-on");
    [0, 90, 180, 270, 360, 500].forEach(function (d) { setTimeout(function () { FX("key"); }, still() ? 0 : d); });
    say("Total " + m.total + ". Fictional figures.");
    if (nextMath) { nextMath.hidden = false; }
  }

  /* English or Spanish, in place */
  var lang = desk.querySelector(".lang");
  desk.addEventListener("click", function (e) {
    var b = e.target.closest("[data-lang]"); if (!b) return;
    var to = b.getAttribute("data-lang");
    if (b.getAttribute("aria-checked") === "true") return;
    lang.querySelectorAll("[data-lang]").forEach(function (x) { x.setAttribute("aria-checked", x === b ? "true" : "false"); });
    FX("flip"); flipped = flipped || to === "es";
    lang.classList.add("is-flipping");
    setTimeout(function () {
      lang.querySelectorAll("[data-en]").forEach(function (el) { el.innerHTML = el.getAttribute("data-" + to); });
      lang.classList.remove("is-flipping");
      say(to === "es" ? "Now in Spanish." : "Back in English.");
      if (nextLang) nextLang.hidden = false;
    }, still() ? 0 : 200);
  });

  /* Sign: a gold stroke, or a typed name */
  var pad = null, ctx = null, drawing = false, strokes = 0, lastPt = null;
  function setupPad() {
    if (pad) return;
    pad = desk.querySelector(".sign__pad canvas"); if (!pad) return;
    var dpr = Math.min(devicePixelRatio || 1, 2), r = pad.getBoundingClientRect();
    pad.width = Math.max(1, r.width * dpr); pad.height = Math.max(1, r.height * dpr);
    ctx = pad.getContext("2d"); ctx.scale(dpr, dpr); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 2.4; ctx.strokeStyle = "#c9a642";
    pad.addEventListener("pointerdown", function (e) { drawing = true; begin(); lastPt = pt(e); try { pad.setPointerCapture(e.pointerId); } catch (x) {} });
    pad.addEventListener("pointermove", function (e) {
      if (!drawing) return; var p = pt(e);
      ctx.beginPath(); ctx.moveTo(lastPt.x, lastPt.y); ctx.quadraticCurveTo(lastPt.x, lastPt.y, (lastPt.x + p.x) / 2, (lastPt.y + p.y) / 2); ctx.lineTo(p.x, p.y); ctx.stroke();
      lastPt = p; strokes++;
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) { pad.addEventListener(ev, function () { drawing = false; }); });
  }
  function pt(e) { var r = pad.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  desk.addEventListener("click", function (e) {
    var b = e.target.closest("[data-sign]"); if (!b) return;
    var k = b.getAttribute("data-sign");
    if (k === "type") { typedSig = true; FX("choice"); desk.querySelector(".sign__typed").textContent = "John A. Martinez"; strokes = Math.max(strokes, 20); say("Signed with a typed name."); return; }
    if (k === "done") {
      if (strokes < 6) { desk.querySelector(".sign__label").textContent = "Buyer, sign above first"; return; }
      FX("send"); say("Signed."); next();
    }
  });

  /* On file, then the hard cut to the real thing */
  function onFile() {
    FX("unlock");
    say("Saved on file. Nothing missing. Nothing extra.");
    T("desk_finished", { lang_flipped: flipped, typed_signature: typedSig });
    setTimeout(function () {
      if (!reveal) return;
      var go = function () { reveal.hidden = false; reveal.classList.add("is-in"); window.JG_JUMP ? window.JG_JUMP("#desk-reveal") : reveal.scrollIntoView(); var a = reveal.querySelector("a"); if (a) a.focus({ preventScroll: true }); };
      if (window.JG_CUT) window.JG_CUT(go); else go();
    }, still() ? 200 : 1500);
  }

  /* Start over, silently */
  if (restart) restart.addEventListener("click", function () {
    desk.querySelectorAll(".opt").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
    scanned = false; scanBox.classList.remove("is-filled", "is-scanning"); fields.forEach(function (f) { f.textContent = ""; });
    if (holdBtn) { holdBtn.querySelector("span").textContent = "Hold to scan"; if (holdCtl) holdCtl.reset(); }
    lang.querySelectorAll("[data-lang]").forEach(function (x) { x.setAttribute("aria-checked", x.getAttribute("data-lang") === "en" ? "true" : "false"); });
    lang.querySelectorAll("[data-en]").forEach(function (el) { el.innerHTML = el.getAttribute("data-en"); });
    ledger.classList.remove("is-on");
    [nextScan, nextMath, nextLang].forEach(function (b) { if (b) b.hidden = true; });
    if (ctx) ctx.clearRect(0, 0, pad.width, pad.height); strokes = 0; typedSig = false; desk.querySelector(".sign__typed").textContent = "";
    if (reveal) reveal.hidden = true;
    show(0);
    window.JG_JUMP && window.JG_JUMP("#desk");
  });

  show(0);
})();
