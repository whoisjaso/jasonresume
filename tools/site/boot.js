/* The loading screen's engine, inlined right after #boot by assemble_home.py so it
   runs while the page is still parsing. It measures real loading, never a timer:
   the title screen's key art (decoded), the two typefaces (loaded), and the page's
   own scripts (DOMContentLoaded). --p on #boot follows that progress, and every
   stroke in the drawing draws over its own stretch of it (game.css, .boot). The
   drawing may not race ahead of the measure, and takes its time even when the
   page is ready: about 3.4 s to draw, then the lamps light and hold for a beat
   before it dissolves into the title screen. A tap or a key finishes it at once
   (silently, like any skip).
   Reduced motion shows the finished drawing as a still.
   window.JG_BOOT.ready resolves when the dissolve starts; intro.js waits on it.
   window.JG_BOOT.film is set when "Watch the walkthrough" is pressed before
   intro.js has loaded. */
(function () {
  var d = document.documentElement, b = document.getElementById("boot");
  var res, J = window.JG_BOOT = { ready: new Promise(function (r) { res = r; }), film: false };
  if (!b || !d.classList.contains("intro-pending")) { if (b) b.remove(); res(); return; }
  var RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var DRAW = 3400, HOLD = 1300, W = { page: 1, fonts: 1, art: 2 }, got = {}, target = 0, shown = 0, last = performance.now(), t0 = last, over = false;
  function mark(k) { if (got[k]) return; got[k] = 1; var s = 0, t = 0; for (var x in W) { t += W[x]; if (got[x]) s += W[x]; } target = s / t; }
  var mob = innerWidth < 760, art = document.body.getAttribute("data-intro-art") || b.getAttribute("data-art");
  if (art) { var im = new Image(); im.decoding = "async"; im.src = art + (mob ? "-m.webp" : "-1920.webp"); (im.decode ? im.decode() : Promise.reject()).then(function () { mark("art"); }, function () { im.complete ? mark("art") : (im.onload = im.onerror = function () { mark("art"); }); }); } else mark("art");
  function fonts() {
    var f = document.fonts;
    if (!f || !f.load) { mark("fonts"); return; }
    Promise.all([f.load('600 1em "Cormorant Garamond"'), f.load('400 1em "Hanken Grotesk"')]).then(function () { return f.ready; }).then(function () { mark("fonts"); }, function () { mark("fonts"); });
    setTimeout(function () { mark("fonts"); }, 3500);
  }
  if (document.readyState !== "loading") { mark("page"); fonts(); }
  else document.addEventListener("DOMContentLoaded", function () { mark("page"); fonts(); });
  var bar = b.querySelector(".boot__bar i");
  function frame(now) {
    if (over) return;
    var dt = now - last; last = now;
    /* the drawing follows the measure, at most a full drawing per DRAW ms */
    shown = RM ? target : Math.min(target, shown + dt / DRAW);
    b.style.setProperty("--p", shown.toFixed(4));
    if (bar) bar.style.transform = "scaleX(" + target.toFixed(3) + ")";
    if (shown >= 1 || now - t0 > 10000) { finish(); return; }
    requestAnimationFrame(frame);
  }
  function finish() {
    over = true;
    b.style.setProperty("--p", "1");
    b.classList.add("is-lit");
    setTimeout(function () {
      b.classList.add("is-out"); res();
      setTimeout(function () { b.remove(); }, RM ? 150 : 800);
    }, RM ? 0 : HOLD);
  }
  /* a tap or a key: straight to the lamps (only once the page itself is in) */
  function hurry(e) { if (over || (e.target && e.target.closest && e.target.closest("[data-watch]"))) return; if (!got.page) return; DRAW = 1; HOLD = 250; target = 1; }
  b.addEventListener("pointerdown", hurry);
  addEventListener("keydown", function k(e) { if (over) { removeEventListener("keydown", k); return; } hurry(e); });
  requestAnimationFrame(frame);
  /* the walkthrough, if pressed before intro.js is here to open it */
  var w = b.querySelector("[data-watch]");
  if (w) w.addEventListener("click", function () { if (window.JG_FILM) window.JG_FILM.open("boot"); else J.film = true; });
})();
