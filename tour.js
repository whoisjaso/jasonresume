/* The guided tour: the live library, one stop at a time, as if you were being
   taken there. While it runs, letterbox bars slide in at the top and bottom and
   everything but the stop's subject falls to near black.

   Started from the title screen (Take the tour), from the help sheet, or with
   ?tour=1. Each stop does something real in the page (focuses a title, opens
   one and glides to its desk, opens a screen, presents the resume); the camera
   moves to it in one eased glide while the light travels with it, and its line
   plays one caption line at a time in the lower bar, lighting word by word. The words and their timing come from
   tools/voice/tour_lines.json through tools/site/tour.json, inlined as
   #tour-data. When tools/voice/narrate_free.py has recorded a line and the score is
   on, the narrator's audio plays with it, the score steps back under the voice
   (JG_SCORE.voice), and the words light on the recording's own timing. When it
   has not, the caption runs alone on an ESTIMATED pace and the panel says the
   narration is not recorded: it is never presented as voiced.

   Next and Back are choices (a tick, a tap, the move); Exit is silent and puts
   the library back the way it was, focused on the title you started from.
   Keys: Right, Enter or Space for Next, Left for Back, Escape to leave. On a
   phone the buttons, or swipe the caption. A stop auto-advances a beat after
   its line ends.

   window.JG_TOUR.start(where) / .exit() / .on()
   Events: document "jg:tour" { on, step } */
(function () {
  "use strict";
  var dataEl = document.getElementById("tour-data"); if (!dataEl) return;
  var D = null; try { D = JSON.parse(dataEl.textContent); } catch (e) {}
  if (!D || !D.steps || !D.steps.length) return;
  var root = document.documentElement, body = document.body;
  var RM = matchMedia("(prefers-reduced-motion: reduce)");
  function T(e, p) { if (window.JG_TRACK) window.JG_TRACK(e, p); }
  function S() { return window.JG_SCORE; }
  function G() { return window.JG_GAME; }
  function hap(k) { if (window.JG_HAPTIC) window.JG_HAPTIC(k); }
  function $(s, r) { return (r || document).querySelector(s); }
  function E(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var HOLD = 1.6; /* seconds after a line before the next stop */

  var on = false, i = 0, ui = null, veil, cap, line, timeBar, ticks, nextBtn, backBtn, mode, pageOf = [], page = -1;
  var audio = null, t0 = 0, raf = 0, settleT = 0, advanced = false, startFocus = null, target = null, words = [], cur = null;

  function build() {
    ui = document.createElement("div");
    ui.className = "tour"; ui.setAttribute("role", "region"); ui.setAttribute("aria-label", "Guided tour");
    ui.innerHTML =
      '<svg class="tour__veil" aria-hidden="true" focusable="false"><defs><filter id="tour-soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="30"/></filter></defs><path fill-rule="evenodd" filter="url(#tour-soft)"/></svg>' +
      '<div class="tour__bar" aria-hidden="true"><small class="tour__mode">' + E(D.label || "") + '</small><span class="tour__n" data-tour-n></span></div>' +
      '<div class="tour__cap">' +
        '<span class="tour__time" aria-hidden="true"><i></i></span>' +
        '<p class="tour__line" aria-live="polite"></p>' +
        '<div class="tour__row">' +
          '<button class="btn btn--ghost btn--sm" type="button" data-tour-exit>Exit</button>' +
          '<button class="btn btn--ghost btn--sm" type="button" data-tour-back><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-left"/></svg>Back</button>' +
          '<button class="btn btn--ghost btn--sm" type="button" data-tour-next>Next<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-right"/></svg></button>' +
        "</div>" +
      "</div>";
    veil = $(".tour__veil path", ui); cap = $(".tour__cap", ui); line = $(".tour__line", ui);
    timeBar = $(".tour__time i", ui); ticks = $("[data-tour-n]", ui);
    nextBtn = $("[data-tour-next]", ui); backBtn = $("[data-tour-back]", ui); mode = $(".tour__mode", ui);
    ui.addEventListener("click", function (e) {
      if (e.target.closest("[data-tour-next]")) next("tap");
      else if (e.target.closest("[data-tour-back]")) back("tap");
      else if (e.target.closest("[data-tour-exit]")) exit("button");
    });
    /* swipe the caption on a phone */
    var sx = null;
    cap.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") sx = e.clientX; });
    cap.addEventListener("pointerup", function (e) { if (sx == null) return; var dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 60) { if (dx < 0) next("swipe"); else back("swipe"); } });
    body.appendChild(ui);
  }

  /* ---------- putting the page where the stop needs it ---------- */
  function deckEl() { return document.getElementById("deck"); }
  function closeDeck() { var d = deckEl(); if (d && d.open) d.close(); if (ui && ui.parentNode !== body) body.appendChild(ui); }
  function home() { closeDeck(); var g = G(), n = 0; while (g && g.back() && n++ < 4) {} }
  function act(s) {
    var g = G(); if (!g) return;
    if (s.do === "library") { home(); if (s.focus) g.focus(s.focus); }
    else if (s.do === "title") {
      closeDeck();
      var a = document.getElementById("title-" + s.title);
      if (!a || !a.classList.contains("is-open")) g.open(s.title, "tour");
      a = document.getElementById("title-" + s.title);
      var sec = s.section && document.getElementById(s.title + "-" + s.section);
      setTimeout(function () { if (a) glideTo(a, sec ? Math.max(0, sec.offsetTop - 110) : 0); }, 120);
    }
    else if (s.do === "screen") { closeDeck(); g.screen(s.screen, "tour"); }
    else if (s.do === "deck") {
      home();
      if (window.JG_OPEN) window.JG_OPEN("deck", "tour");
      /* the deck is a modal dialog: the tour goes inside it so it stays on top and usable */
      var tries = 0;
      (function into() { var d = deckEl(); if (!on) return; if (d && d.open) { d.appendChild(ui); queuePlace(); return; } if (tries++ < 30) setTimeout(into, 40); })();
    }
  }
  function resolve(sel) {
    if (sel === "head") return $("article.title.is-focus .title__head");
    var el = null; try { el = $(sel); } catch (e) {}
    /* a subject taller than the screen (the desk on a phone): light the phone in it */
    if (el && el.getBoundingClientRect().height > innerHeight * 0.75) el = $("[data-desk-app]", el) || el;
    return el;
  }
  /* the camera: one eased glide (the site's ease, cubic-bezier(0.2, 0.7, 0.1, 1), near enough) */
  var GLIDE = 950;
  function ease(k) { return 1 - Math.pow(1 - k, 3.2); }
  var glideRaf = 0;
  function glideTo(el, top) {
    cancelAnimationFrame(glideRaf);
    var from = el.scrollTop, max = el.scrollHeight - el.clientHeight; top = Math.max(0, Math.min(max, top));
    if (RM.matches || Math.abs(top - from) < 2) { el.scrollTop = top; return; }
    var t0g = performance.now();
    (function step(now) { var k = Math.min(1, (now - t0g) / GLIDE); el.scrollTop = from + (top - from) * ease(k); if (k < 1 && on) glideRaf = requestAnimationFrame(step); })(performance.now());
  }
  function scroller(el) {
    for (var n = el && el.parentElement; n && n !== body; n = n.parentElement) {
      var o = getComputedStyle(n).overflowY;
      if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight + 2) return n;
    }
    return document.scrollingElement || root;
  }
  /* the space between the bars, where the subject is shown */
  function frame() {
    var bar = ui && $(".tour__bar", ui), top = bar ? bar.getBoundingClientRect().height : 0;
    var low = cap ? cap.getBoundingClientRect().height : 0;
    return { top: top, bottom: innerHeight - low };
  }
  function bring(el) {
    var r = el.getBoundingClientRect(), f = frame(), mid = (f.top + f.bottom) / 2;
    if (r.top >= f.top + 12 && r.bottom <= f.bottom - 12) return 0;
    var sc = scroller(el), d = r.height > f.bottom - f.top - 24 ? r.top - f.top - 16 : r.top + r.height / 2 - mid;
    glideTo(sc, sc.scrollTop + d);
    return RM.matches ? 0 : GLIDE;
  }
  /* the light: a soft hole in the dark veil that travels with the camera to each subject */
  var hole = null, aimFrom = null, aimT = 0, aimRaf = 0, aiming = false;
  function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); return "M" + (x + r) + " " + y + "H" + (x + w - r) + "Q" + (x + w) + " " + y + " " + (x + w) + " " + (y + r) + "V" + (y + h - r) + "Q" + (x + w) + " " + (y + h) + " " + (x + w - r) + " " + (y + h) + "H" + (x + r) + "Q" + x + " " + (y + h) + " " + x + " " + (y + h - r) + "V" + (y + r) + "Q" + x + " " + y + " " + (x + r) + " " + y + "Z"; }
  function drawHole(h) {
    var W = innerWidth, H = innerHeight, m = 200;
    veil.setAttribute("d", "M" + -m + " " + -m + "H" + (W + m) + "V" + (H + m) + "H" + -m + "Z" + (h && h[2] > 0 ? rr(h[0], h[1], h[2], h[3], 18) : ""));
  }
  function holeFor() {
    var el = target, vw = innerWidth, f = frame();
    var r = el && el.getBoundingClientRect();
    if (!r || !r.width || !r.height) return [vw * 0.06, f.top + 20, vw * 0.88, Math.max(40, f.bottom - f.top - 40)];
    var pad = vw < 760 ? 10 : 20;
    var L = Math.max(6, r.left - pad), Tp = Math.max(f.top + 6, r.top - pad), R = Math.min(vw - 6, r.right + pad), B = Math.min(f.bottom - 6, r.bottom + pad);
    return [L, Tp, Math.max(0, R - L), Math.max(0, B - Tp)];
  }
  /* a new subject: the light travels there over the same glide as the camera, aimed at where the subject is on every frame */
  function aim() {
    aimFrom = hole || holeFor(); aimT = performance.now(); aiming = true; cancelAnimationFrame(aimRaf);
    (function step(now) {
      if (!on) { aiming = false; return; }
      var k = RM.matches ? 1 : Math.min(1, (now - aimT) / GLIDE), e = ease(k), to = holeFor();
      hole = aimFrom.map(function (v, j) { return v + (to[j] - v) * e; });
      drawHole(hole);
      if (k < 1) aimRaf = requestAnimationFrame(step); else aiming = false;
    })(performance.now());
  }
  function place() {
    if (!on || aiming) return;
    hole = holeFor(); drawHole(hole);
  }
  var placeQ = 0;
  function queuePlace() { if (placeQ) return; placeQ = requestAnimationFrame(function () { placeQ = 0; place(); }); }

  /* ---------- the line: words lit on the voice's timing, or on the estimate ---------- */
  function stopVoice() {
    if (audio) { try { audio.pause(); } catch (e) {} audio = null; }
    if (S() && S().voice) S().voice(false);
  }
  function say(id) {
    stopVoice(); cancelAnimationFrame(raf);
    cur = D.lines[id] || { text: "", words: [], duration: 0 };
    var parts = cur.text.split(/\s+/).filter(Boolean);
    line.innerHTML = parts.map(function (w) { return '<span class="w">' + E(w) + "</span> "; }).join("");
    words = [].slice.call(line.querySelectorAll(".w"));
    paginate(parts); page = -1;
    advanced = false; t0 = performance.now();
    var voiced = cur.voiced && cur.audio && S() && S().isOn();
    mode.textContent = voiced ? (D.narration || "") : (D.voiced ? "" : (D.label || ""));
    if (voiced) {
      audio = new Audio(cur.audio); audio.preload = "auto";
      var p = audio.play();
      if (S().voice) S().voice(true);
      if (p && p.catch) p.catch(function () { audio = null; if (S() && S().voice) S().voice(false); t0 = performance.now(); });
      audio.addEventListener("ended", function () { if (S() && S().voice) S().voice(false); });
    }
    if (RM.matches) words.forEach(function (w) { w.classList.add("is-said"); });
    tick();
  }
  /* one caption line at a time: the words are packed by phrase into lines that fit the bar */
  function paginate(parts) {
    var fs = parseFloat(getComputedStyle(line).fontSize) || 20;
    var max = Math.max(18, Math.floor((line.clientWidth || innerWidth * 0.8) / (fs * 0.56)));
    var phrases = [], cur = [];
    parts.forEach(function (w, k) { cur.push(k); if (/[.,:;?!]$/.test(w)) { phrases.push(cur); cur = []; } });
    if (cur.length) phrases.push(cur);
    function len(ks) { return ks.reduce(function (a, k, j) { return a + parts[k].length + (j ? 1 : 0); }, 0); }
    var lines = [], ln = [];
    phrases.forEach(function (ph) {
      if (ln.length && len(ln.concat(ph)) > max) { lines.push(ln); ln = []; }
      if (len(ph) > max) ph.forEach(function (k) { if (ln.length && len(ln.concat([k])) > max) { lines.push(ln); ln = []; } ln.push(k); });
      else ln = ln.concat(ph);
      if (/[.?!]$/.test(parts[ln[ln.length - 1]]) && len(ln) > max * 0.45) { lines.push(ln); ln = []; }
    });
    if (ln.length) lines.push(ln);
    pageOf = []; lines.forEach(function (l, n) { l.forEach(function (k) { pageOf[k] = n; }); });
  }
  function clock() { return audio && !audio.paused ? audio.currentTime : (performance.now() - t0) / 1000; }
  function tick() {
    if (!on) return;
    var t = clock(), W = cur.words || [];
    var pg = 0;
    for (var q = 0; q < words.length; q++) { var wq = W[q] || [cur.duration, cur.duration]; if (t >= wq[0] - 0.12) pg = pageOf[q] || 0; }
    if (pg !== page) { page = pg; for (var z = 0; z < words.length; z++) words[z].classList.toggle("is-off", pageOf[z] !== pg); line.classList.remove("is-in"); void line.offsetWidth; line.classList.add("is-in"); }
    for (var k = 0; k < words.length; k++) {
      var w = W[k] || [cur.duration, cur.duration];
      words[k].classList.toggle("is-said", RM.matches || t >= w[0]);
      words[k].classList.toggle("is-now", !RM.matches && t >= w[0] && t < (W[k + 1] ? W[k + 1][0] : w[1] + 0.2));
    }
    var dur = Math.max(0.1, cur.duration || 0.1);
    timeBar.style.transform = "scaleX(" + Math.min(1, t / (dur + HOLD)).toFixed(4) + ")";
    if (!advanced && t >= dur + HOLD && !(audio && !audio.ended && !audio.paused)) {
      advanced = true;
      if (i < D.steps.length - 1) { next("auto"); return; }
    }
    raf = requestAnimationFrame(tick);
  }

  /* ---------- the stops ---------- */
  function go(n, how) {
    i = Math.max(0, Math.min(D.steps.length - 1, n));
    var s = D.steps[i];
    clearTimeout(settleT);
    act(s);
    ticks.textContent = (i + 1) + " / " + D.steps.length;
    backBtn.disabled = i === 0;
    nextBtn.firstChild.nodeValue = i === D.steps.length - 1 ? "Finish" : "Next";
    target = null;
    say(s.line);
    /* let the page's own transition land, bring the subject into view, then light it */
    settleT = setTimeout(function () {
      target = resolve(s.target);
      if (target) bring(target);
      aim();
    }, RM.matches ? 60 : 640);
    document.dispatchEvent(new CustomEvent("jg:tour", { detail: { on: true, step: s.step } }));
    T("tour_step", { step: s.step, n: i + 1, how: how || "" });
  }
  function feedback() { hap("tap"); if (S()) S().tick(); }
  function next(how) {
    if (!on) return;
    if (i >= D.steps.length - 1) { if (how !== "auto") { feedback(); finish(); } return; }
    if (how !== "auto") feedback();
    go(i + 1, how);
  }
  function back(how) { if (!on || i === 0) return; feedback(); go(i - 1, how); }

  function start(where) {
    if (on) return;
    if (root.classList.contains("intro-on") || root.classList.contains("intro-pending")) {
      document.addEventListener("jg:intro-done", function w() { document.removeEventListener("jg:intro-done", w); setTimeout(function () { start(where); }, 250); });
      return;
    }
    var help = document.getElementById("help"); if (help && help.open) help.close();
    var f = $(".tile.is-focus"); startFocus = f ? f.getAttribute("data-title") : null;
    if (!ui) build();
    if (ui.parentNode !== body) body.appendChild(ui);
    on = true; root.classList.add("tour-on"); ui.hidden = false; hole = null;
    ui.classList.remove("is-on"); void ui.offsetWidth; ui.classList.add("is-on");
    if (window.JG_FX) window.JG_FX("arrive");
    T("tour_started", { where: where || "", voiced: !!D.voiced });
    go(0, where);
    setTimeout(function () { nextBtn.focus({ preventScroll: true }); }, 80);
  }
  function teardown() {
    on = false; cancelAnimationFrame(raf); cancelAnimationFrame(aimRaf); cancelAnimationFrame(glideRaf); clearTimeout(settleT); stopVoice();
    home();
    if (startFocus && G()) G().focus(startFocus);
    if (ui) { ui.hidden = true; ui.classList.remove("is-on"); if (ui.parentNode !== body) body.appendChild(ui); }
    root.classList.remove("tour-on");
    var t = startFocus && $('.tile[data-title="' + startFocus + '"]'); if (t) t.focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent("jg:tour", { detail: { on: false, step: "" } }));
  }
  /* leaving is a cancel: no sound, no haptic */
  function exit(how) { if (!on) return; T("tour_exit", { at: D.steps[i].step, how: how || "" }); teardown(); }
  function finish() { T("tour_finished", {}); teardown(); }

  /* the tour has the keys while it runs; M still turns the score on or off */
  addEventListener("keydown", function (e) {
    if (!on || e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (k === "Tab" || k === "m" || k === "M") return;
    var t = e.target;
    var onBtn = t && t.closest && t.closest(".tour button");
    if (k === "ArrowRight" || ((k === "Enter" || k === " ") && !onBtn)) { e.preventDefault(); e.stopImmediatePropagation(); next("key"); }
    else if (k === "ArrowLeft") { e.preventDefault(); e.stopImmediatePropagation(); back("key"); }
    else if (k === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); exit("key"); }
    else if (!onBtn) { e.stopImmediatePropagation(); }
  }, true);
  /* a modal deck closed by its own button ends the deck stop's hold on the tour */
  document.addEventListener("close", function (e) { if (on && e.target === deckEl() && ui.parentNode === e.target) body.appendChild(ui); }, true);
  addEventListener("resize", queuePlace);
  addEventListener("scroll", queuePlace, true);
  document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-tour-start]"); if (!b) return; e.preventDefault(); start(b.getAttribute("data-where") || "help"); });
  /* ?tour=1 starts it once the title screen is done */
  if (/[?&]tour=1/.test(location.search)) {
    try { var u = new URL(location.href); u.searchParams.delete("tour"); history.replaceState(history.state, "", u.pathname + u.search + u.hash); } catch (e) {}
    start("link");
  }
  window.JG_TOUR = { start: start, exit: function () { exit("api"); }, on: function () { return on; } };
})();
