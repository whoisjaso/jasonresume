/* The guided tour: the live library, one stop at a time.

   Started from the title screen (Take the tour), from the help sheet, or with
   ?tour=1. Each stop does something real in the page (focuses a title, opens
   one and scrolls to its desk, opens a screen, presents the resume), lays a
   soft ink vignette around what it is showing, and plays its line as a caption
   that lights word by word. The words and their timing come from
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

  var on = false, i = 0, ui = null, veil, spot, cap, line, timeBar, ticks, nextBtn, backBtn, mode;
  var audio = null, t0 = 0, raf = 0, settleT = 0, advanced = false, startFocus = null, target = null, words = [], cur = null;

  function build() {
    ui = document.createElement("div");
    ui.className = "tour"; ui.setAttribute("role", "region"); ui.setAttribute("aria-label", "Guided tour");
    ui.innerHTML =
      '<svg class="tour__veil" aria-hidden="true" focusable="false"><defs><filter id="tour-soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="26"/></filter></defs><path fill-rule="evenodd" filter="url(#tour-soft)"/></svg>' +
      '<div class="tour__spot" aria-hidden="true"></div>' +
      '<div class="tour__cap">' +
        '<span class="tour__time" aria-hidden="true"><i></i></span>' +
        '<p class="tour__line" aria-live="polite"></p>' +
        '<div class="tour__row"><span class="tour__n" data-tour-n></span>' +
          '<button class="btn btn--ghost btn--sm" type="button" data-tour-exit>Exit</button>' +
          '<button class="btn btn--sm" type="button" data-tour-back><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-left"/></svg>Back</button>' +
          '<button class="btn btn--primary btn--sm" type="button" data-tour-next>Next<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-right"/></svg></button>' +
        "</div>" +
        '<small class="tour__mode">' + E(D.label || "") + "</small>" +
      "</div>";
    veil = $(".tour__veil path", ui); spot = $(".tour__spot", ui); cap = $(".tour__cap", ui); line = $(".tour__line", ui);
    timeBar = $(".tour__time i", ui); ticks = $("[data-tour-n]", ui);
    nextBtn = $("[data-tour-next]", ui); backBtn = $("[data-tour-back]", ui); mode = $(".tour__mode", ui);
    ticks.innerHTML = D.steps.map(function () { return '<b class="tour__tick"></b>'; }).join("");
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
      setTimeout(function () { if (a) a.scrollTo({ top: sec ? Math.max(0, sec.offsetTop - 110) : 0, behavior: RM.matches ? "auto" : "smooth" }); }, 120);
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
  var hole = null, holeFrom = null, holeTo = null, holeT = 0, holeRaf = 0;
  function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); return "M" + (x + r) + " " + y + "H" + (x + w - r) + "Q" + (x + w) + " " + y + " " + (x + w) + " " + (y + r) + "V" + (y + h - r) + "Q" + (x + w) + " " + (y + h) + " " + (x + w - r) + " " + (y + h) + "H" + (x + r) + "Q" + x + " " + (y + h) + " " + x + " " + (y + h - r) + "V" + (y + r) + "Q" + x + " " + y + " " + (x + r) + " " + y + "Z"; }
  function drawHole(h) {
    var W = innerWidth, H = innerHeight, m = 200;
    veil.setAttribute("d", "M" + -m + " " + -m + "H" + (W + m) + "V" + (H + m) + "H" + -m + "Z" + (h && h[2] > 0 ? rr(h[0], h[1], h[2], h[3], 14) : ""));
  }
  function moveHole(to) {
    holeFrom = hole || to; holeTo = to; holeT = performance.now(); cancelAnimationFrame(holeRaf);
    (function step(now) {
      var k = RM.matches ? 1 : Math.min(1, (now - holeT) / 700), e = 1 - Math.pow(1 - k, 3);
      hole = holeFrom.map(function (v, j) { return v + (holeTo[j] - v) * e; });
      drawHole(hole);
      if (k < 1) holeRaf = requestAnimationFrame(step);
    })(performance.now());
  }
  function place() {
    if (!on) return;
    var el = target, vw = innerWidth, vh = innerHeight;
    var r = el && el.getBoundingClientRect();
    if (!r || !r.width || !r.height) { ui.classList.add("is-wide"); moveHole([vw * 0.05, vh * 0.08, vw * 0.9, vh * 0.7]); ui.classList.toggle("is-top", false); return; }
    ui.classList.remove("is-wide");
    var pad = vw < 760 ? 8 : 16;
    var L = Math.max(6, r.left - pad), Tp = Math.max(6, r.top - pad), R = Math.min(vw - 6, r.right + pad), B = Math.min(vh - 6, r.bottom + pad);
    spot.style.left = L + "px"; spot.style.top = Tp + "px"; spot.style.width = Math.max(0, R - L) + "px"; spot.style.height = Math.max(0, B - Tp) + "px";
    moveHole([L, Tp, Math.max(0, R - L), Math.max(0, B - Tp)]);
    /* the caption sits wherever the subject is not */
    ui.classList.toggle("is-top", (Tp + B) / 2 > vh * 0.52);
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
  function clock() { return audio && !audio.paused ? audio.currentTime : (performance.now() - t0) / 1000; }
  function tick() {
    if (!on) return;
    var t = clock(), W = cur.words || [];
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
    [].forEach.call(ticks.children, function (b, k) { b.classList.toggle("is-on", k <= i); });
    ticks.setAttribute("aria-label", "Stop " + (i + 1) + " of " + D.steps.length);
    backBtn.disabled = i === 0;
    nextBtn.firstChild.nodeValue = i === D.steps.length - 1 ? "Finish" : "Next";
    target = null;
    say(s.line);
    /* let the page's own transition land, bring the subject into view, then light it */
    settleT = setTimeout(function () {
      target = resolve(s.target);
      if (target) {
        var r = target.getBoundingClientRect();
        if (r.top < 60 || r.bottom > innerHeight - 40) { target.scrollIntoView({ block: "center", behavior: RM.matches ? "auto" : "smooth" }); settleT = setTimeout(place, RM.matches ? 30 : 480); }
      }
      place();
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
    on = true; root.classList.add("tour-on"); ui.hidden = false;
    if (window.JG_FX) window.JG_FX("arrive");
    T("tour_started", { where: where || "", voiced: !!D.voiced });
    go(0, where);
    setTimeout(function () { nextBtn.focus({ preventScroll: true }); }, 80);
  }
  function teardown() {
    on = false; cancelAnimationFrame(raf); clearTimeout(settleT); stopVoice();
    home();
    if (startFocus && G()) G().focus(startFocus);
    if (ui) { ui.hidden = true; if (ui.parentNode !== body) body.appendChild(ui); }
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
