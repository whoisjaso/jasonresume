/* The projector. Drives the home page as a film in reels.

   A scene is any element with data-scene:
     "lead"  progress 0 at the top of the page, 1 after scrolling one scene height
     "pass"  0 when its top enters the bottom of the screen, 1 when its bottom leaves the top
     "pin"   0 when its top reaches the top of the screen, 1 when its bottom reaches the bottom;
             its first child is sticky, so the scene holds still while the story plays
   Inside a scene, data-cue="a,b[,c,d]" gives an element its own clock: --t rises 0 to 1
   while scene progress runs a to b, --o rises 0 to 1 while it runs c to d (the exit).
   CSS turns --p, --t and --o into motion. data-words brightens a line word by word on
   its cue's clock. data-pan slides a pinned track sideways. data-fire plays a quiet
   swoosh the first time a cue lands. Videos with data-src play only while visible.

   One requestAnimationFrame loop, and it only runs while a scene is on screen.
   Reduced motion: every clock is set to its finished state and nothing pins. */
(function () {
  "use strict";
  var RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;
  root.classList.add("has-cinema");
  if (RM) root.classList.add("is-still");

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sfx(name, o) { if (window.JG_SFX) window.JG_SFX.play(name, o); }

  /* ---------- words ---------- */
  function splitWords(el) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), nodes = [], n;
    while ((n = walker.nextNode())) if (n.nodeValue.trim()) nodes.push(n);
    var spans = [];
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        var s = document.createElement("span"); s.className = "w"; s.textContent = part; frag.appendChild(s); spans.push(s);
      });
      node.parentNode.replaceChild(frag, node);
    });
    return spans;
  }

  /* ---------- scenes ---------- */
  var scenes = [].slice.call(document.querySelectorAll("[data-scene]")).map(function (el) {
    var cues = [].slice.call(el.querySelectorAll("[data-cue],[data-ink]")).map(function (c) {
      var v = (c.getAttribute("data-cue") || c.getAttribute("data-ink")).split(",").map(Number);
      var words = c.hasAttribute("data-words") ? splitWords(c) : [].concat.apply([], [].slice.call(c.querySelectorAll("[data-words]")).map(function (w) { return w.closest("[data-cue],[data-ink]") === c ? splitWords(w) : []; }));
      return { el: c, a: v[0], b: v[1], c: v[2], d: v[3], words: words, fire: c.getAttribute("data-fire"), fired: false, lt: -1, lo: -1 };
    });
    var own = el.hasAttribute("data-words") ? splitWords(el) : null;
    var pan = el.hasAttribute("data-pan") ? el.querySelector("[data-track]") : null;
    return { el: el, mode: el.getAttribute("data-scene"), cues: cues, own: own, pan: pan, lp: -1, on: false, panW: 0 };
  });

  function progress(s, vh) {
    var r = s.el.getBoundingClientRect();
    if (s.mode === "pin") { var d = r.height - vh; return d <= 0 ? (r.top <= 0 ? 1 : 0) : clamp(-r.top / d, 0, 1); }
    if (s.mode === "lead") return clamp(-r.top / Math.max(1, r.height), 0, 1);
    return clamp((vh - r.top) / (vh + r.height), 0, 1);
  }
  function paintWords(words, t) {
    if (!words || !words.length) return;
    var n = words.length, k = t * (n + 1.5);
    for (var i = 0; i < n; i++) words[i].style.opacity = (0.14 + 0.86 * clamp(k - i, 0, 1)).toFixed(3);
  }
  function apply(s, p) {
    s.el.style.setProperty("--p", p.toFixed(4));
    if (s.own) paintWords(s.own, clamp(p * 1.6 - 0.2, 0, 1));
    for (var i = 0; i < s.cues.length; i++) {
      var c = s.cues[i], t = clamp((p - c.a) / ((c.b - c.a) || 1), 0, 1), o = c.c == null ? 0 : clamp((p - c.c) / ((c.d - c.c) || 1), 0, 1);
      if (Math.abs(t - c.lt) > 0.0005) { c.el.style.setProperty("--t", t.toFixed(4)); c.lt = t; paintWords(c.words, t); }
      if (Math.abs(o - c.lo) > 0.0005) { c.el.style.setProperty("--o", o.toFixed(4)); c.lo = o; }
      var live = t > 0.5 && o < 0.5;
      c.el.classList.toggle("is-live", live);
      if (live && !c.fired && c.fire) { c.fired = true; sfx("swoosh", { gain: 0.34, rate: 0.95, throttle: 700 }); c.el.dispatchEvent(new CustomEvent("cue:in")); }
    }
    if (s.pan) s.pan.style.transform = "translate3d(" + (-s.panW * clamp((p - 0.06) / 0.86, 0, 1)).toFixed(1) + "px,0,0)";
  }

  function measurePans() {
    scenes.forEach(function (s) {
      if (!s.pan) return;
      if (RM) { s.el.style.height = ""; s.panW = 0; return; }
      var w = s.pan.scrollWidth - innerWidth;
      s.panW = Math.max(0, w);
      s.el.style.height = (s.panW + innerHeight) + "px";
    });
  }

  if (RM) {
    scenes.forEach(function (s) { measurePans(); s.el.style.setProperty("--p", "1"); s.cues.forEach(function (c) { c.el.style.setProperty("--t", "1"); c.el.style.setProperty("--o", "0"); c.el.classList.add("is-live"); (c.words || []).forEach(function (w) { w.style.opacity = 1; }); }); (s.own || []).forEach(function (w) { w.style.opacity = 1; }); });
  } else {
    var raf = null;
    function frame() {
      raf = null;
      var vh = innerHeight, any = false;
      for (var i = 0; i < scenes.length; i++) {
        var s = scenes[i]; if (!s.on) continue; any = true;
        var p = progress(s, vh);
        if (Math.abs(p - s.lp) > 0.0002) { s.lp = p; apply(s, p); }
      }
      if (any) raf = requestAnimationFrame(frame);
    }
    function wake() { if (!raf) raf = requestAnimationFrame(frame); }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { var s = scenes.find(function (x) { return x.el === e.target; }); if (s) s.on = e.isIntersecting; });
      wake();
    }, { rootMargin: "25% 0px 25% 0px" });
    scenes.forEach(function (s) { io.observe(s.el); });
    addEventListener("scroll", wake, { passive: true });
    addEventListener("resize", function () { measurePans(); scenes.forEach(function (s) { s.lp = -1; }); wake(); });
    measurePans();
    scenes.forEach(function (s) { apply(s, progress(s, innerHeight)); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measurePans(); wake(); });
  }

  /* ---------- films: load late, play only in view, sound on request ---------- */
  var films = [].slice.call(document.querySelectorAll("video[data-src]"));
  var cheap = matchMedia("(prefers-reduced-data: reduce)").matches || (navigator.connection && navigator.connection.saveData);
  function load(v) { if (!v.src) { v.src = v.getAttribute("data-src"); v.load(); } }
  function play(v) { load(v); var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  if ("IntersectionObserver" in window) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting && e.intersectionRatio > 0.3) { if (!cheap && !RM) play(v); else load(v); }
        else if (!v.paused) v.pause();
      });
    }, { threshold: [0, 0.3, 0.6] });
    films.forEach(function (v) { vio.observe(v); });
  }
  function soundOff(except) {
    films.forEach(function (v) { if (v !== except && !v.muted) { v.muted = true; var b = v.parentNode.querySelector("[data-unmute]"); if (b) setBtn(b, false); } });
  }
  function setBtn(b, on) { b.setAttribute("aria-pressed", on ? "true" : "false"); var l = b.querySelector("span"); if (l) l.textContent = on ? (b.getAttribute("data-on") || "Sound on") : (b.getAttribute("data-off") || "Sound off"); }
  document.querySelectorAll("[data-unmute]").forEach(function (b) {
    var v = b.parentNode.querySelector("video");
    if (!v) return;
    b.addEventListener("click", function () {
      var on = v.muted;
      soundOff(v);
      v.muted = !on;
      if (on) { if (b.hasAttribute("data-restart")) v.currentTime = 0; v.loop = false; play(v); if (window.JG_HAPTIC) window.JG_HAPTIC("select"); if (window.JG_TRACK) window.JG_TRACK("film_sound", { film: v.getAttribute("data-name") || "" }); }
      else v.loop = true;
      setBtn(b, on);
    });
    v.addEventListener("ended", function () { v.muted = true; v.loop = true; setBtn(b, false); play(v); });
  });

  /* ---------- the opening: letterbox opens once the loader is gone ---------- */
  var body = document.body;
  function open() { if (root.classList.contains("is-open")) return; root.classList.add("is-open"); }
  if (!body.classList.contains("is-loading")) open();
  else new MutationObserver(function (m, obs) { if (!body.classList.contains("is-loading")) { obs.disconnect(); setTimeout(open, 80); } }).observe(body, { attributes: true, attributeFilter: ["class"] });
  setTimeout(open, 12000);
})();
