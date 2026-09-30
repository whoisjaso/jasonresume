/* The rest of the film: the real desk film with chapters, the rig, the cue
   sheet, the trailer, the water portrait, the forward kit, and commentary.
   Everything here waits for the visitor: nothing plays, moves or speaks on
   its own. */
(function () {
  "use strict";
  var root = document.documentElement;
  function FX(k) { if (window.JG_FX) window.JG_FX(k); }
  function T(e, p) { if (window.JG_TRACK) window.JG_TRACK(e, p); }
  function still() { return window.JG_STILL ? window.JG_STILL() : false; }
  var HAS = window.JG_HAS = window.JG_HAS || {};

  /* ---------- the real film: play on press, chapters, progress ---------- */
  document.querySelectorAll("video[data-film]").forEach(function (v) {
    var name = v.getAttribute("data-film"), wrap = v.closest(".film") || v.parentNode, btn = wrap.querySelector('[data-play="' + name + '"]'), marks = {}, started = false;
    function play(from) {
      if (from != null) { try { v.currentTime = from; } catch (e) {} }
      v.muted = false; v.controls = true;
      var p = v.play(); if (p && p.catch) p.catch(function () { v.muted = true; v.play(); });
      wrap.classList.add("is-playing");
      if (!started) { started = true; FX("arrive"); T("film_play", { film: name, where: from != null ? "chapter" : "play" }); }
    }
    if (btn) btn.addEventListener("click", function () { play(); });
    wrap.querySelectorAll("[data-seek]").forEach(function (c) {
      c.addEventListener("click", function () { FX("choice"); play(parseFloat(c.getAttribute("data-seek"))); T("film_chapter", { film: name, name: c.textContent.trim() }); });
    });
    v.addEventListener("timeupdate", function () {
      if (!v.duration) return;
      var pct = Math.floor((v.currentTime / v.duration) * 4) * 25;
      if (pct > 0 && pct < 100 && !marks[pct]) { marks[pct] = 1; T("film_progress", { film: name, pct: pct }); }
      var cs = wrap.querySelectorAll("[data-seek]"), now = null;
      cs.forEach(function (c) { if (parseFloat(c.getAttribute("data-seek")) <= v.currentTime + 0.2) now = c; });
      cs.forEach(function (c) { c.classList.toggle("is-now", c === now); });
    });
    v.addEventListener("ended", function () { if (!marks[100]) { marks[100] = 1; T("film_complete", { film: name }); } wrap.classList.remove("is-playing"); });
    document.addEventListener("jg:seek", function (e) {
      if (e.detail.film !== name) return;
      if (window.JG_JUMP) window.JG_JUMP("#" + wrap.id); play(e.detail.t);
    });
  });

  /* ---------- the rig: the page's own machinery, live ---------- */
  var rigOn = false, rigTimer = null, readout = null, tags = [];
  function kb() { try { var t = 0; performance.getEntriesByType("navigation").concat(performance.getEntriesByType("resource")).forEach(function (r) { t += r.transferSize || r.encodedBodySize || 0; }); return Math.round(t / 1024); } catch (e) { return 0; } }
  function scripts() { return [].slice.call(document.scripts).filter(function (s) { return s.src; }).map(function (s) { return s.src.replace(location.origin + "/", "").split("?")[0]; }); }
  function setRig(on) {
    rigOn = on; root.classList.toggle("rig-on", on);
    document.querySelectorAll('[data-open="rig"]').forEach(function (b) { if (b.getAttribute("role") === "switch") b.setAttribute("aria-checked", on ? "true" : "false"); });
    tags.forEach(function (t) { t.remove(); }); tags = [];
    if (readout) { readout.remove(); readout = null; }
    clearInterval(rigTimer);
    if (!on) return;
    var proj = window.JG_PROJECTOR ? window.JG_PROJECTOR.scenes : [];
    document.querySelectorAll("[data-track]").forEach(function (el) {
      var tag = document.createElement("span"); tag.className = "rig-tag"; tag.setAttribute("aria-hidden", "true");
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      el.appendChild(tag); tags.push(tag);
      tag._el = el; tag._scene = proj.filter(function (s) { return s.el === el; })[0] || null;
    });
    readout = document.createElement("div"); readout.className = "rig-readout"; readout.setAttribute("aria-live", "off"); document.body.appendChild(readout);
    var paint = function () {
      tags.forEach(function (t) { var name = t._el.getAttribute("data-track"); t.textContent = t._scene ? name + "  " + t._scene.mode + "  p " + t._scene.p.toFixed(2) : name + "  static"; });
      var running = window.JG_PROJECTOR && window.JG_PROJECTOR.running();
      var inView = proj.filter(function (s) { return s.on; }).length;
      var sc = scripts();
      readout.innerHTML = "Projector loop: <b>" + (running ? "running" : "sleeping") + "</b><br>Scenes in view: <b>" + inView + "</b> of " + proj.length + "<br>Page weight so far: <b>" + kb() + " KB</b><br>Scripts: <b>" + sc.length + "</b>, all first party<br>" + sc.join(", ");
    };
    paint(); rigTimer = setInterval(paint, 250);
  }
  document.addEventListener("jg:open", function (e) {
    if (e.detail.what !== "rig") return;
    setRig(!rigOn); if (rigOn) FX("arrive");
    T("rig_toggled", { on: rigOn, where: e.detail.where });
  });
  HAS.rig = true;

  /* ---------- the cue sheet: what this visit records, in plain words ---------- */
  var cues = document.getElementById("cues"), cueList = cues ? cues.querySelector(".cues__list") : null, cuesOn = false;
  var WORDS = {
    page_view: function (p) { return "Opened " + (p.page || "this page"); },
    site_arrived: function (p) { return (p.returning ? "Came back, visit " + p.visits : "First visit") + (p.source ? ", from " + p.source : ""); },
    section_viewed: function (p) { return "Reached " + p.section; },
    page_left: function (p) { return "Left after " + p.attention_s + " attentive seconds"; },
    role_chosen: function (p) { return "Chose the " + p.role + " cut"; },
    desk_step: function (p) { return "Desk step: " + p.step; },
    desk_finished: function () { return "Finished the desk"; },
    film_play: function (p) { return "Played the " + p.film + " film"; },
    film_progress: function (p) { return "Watched " + ({ 25: "a quarter", 50: "half", 75: "three quarters" }[p.pct] || "some") + " of the film"; },
    film_complete: function () { return "Watched the whole film"; },
    film_chapter: function (p) { return "Jumped to the " + p.name + " chapter"; },
    resume_open: function (p) { return "Opened the resume as " + p.format; },
    deck_slide: function (p) { return "Slide " + p.n; },
    deck_finished: function () { return "Reached the last slide"; },
    verify_opened: function () { return "Opened Check me"; },
    verify_link: function (p) { return "Opened " + p.kind; },
    contact_click: function () { return "Clicked email"; },
    book_click: function () { return "Clicked the calendar"; },
    rig_toggled: function (p) { return "Rig " + (p.on ? "on" : "off"); },
    cues_toggled: function (p) { return "Cue sheet " + (p.on ? "on" : "off"); },
    mark_words: function () { return "Tried Mark the Words"; },
    scene_interacted: function (p) { return "Started " + (p.scene === "desk" ? "the desk" : p.scene); },
    proof_open: function (p) { return "Opened " + p.label; },
    cta_click: function (p) { return "Clicked " + p.label; },
    outbound_click: function (p) { return "Opened " + p.host; },
    commentary_toggled: function (p) { return "Commentary " + (p.on ? "on" : "off"); },
    sound_toggled: function (p) { return "Sound " + (p.on ? "on" : "off"); },
    chat_asked: function () { return "Asked a question"; },
    question_added: function (p) { return p.on ? "Added a question" : "Removed a question"; },
    trailer_opened: function () { return "Opened the trailer"; },
    trailer_shot: function (p) { return "Trailer shot " + p.n; },
    trailer_finished: function () { return "Finished the trailer"; }
  };
  function word(c) { var f = WORDS[c.event]; try { return f ? f(c.props || {}) : c.event.replace(/_/g, " "); } catch (e) { return c.event; } }
  function addCue(c) { if (!cueList) return; var li = document.createElement("li"); li.innerHTML = "<time>" + c.t + "s</time><span></span>"; li.querySelector("span").textContent = word(c); cueList.insertBefore(li, cueList.firstChild); }
  function setCues(on) {
    if (!cues) return;
    cuesOn = on; cues.hidden = !on;
    document.querySelectorAll('[data-open="cues"]').forEach(function (b) { b.setAttribute("aria-checked", on ? "true" : "false"); });
    if (on) {
      cueList.innerHTML = "";
      if (window.JG_TRACK_OFF) { var li = document.createElement("li"); li.innerHTML = "<time></time><b>Your browser asked not to be tracked. Nothing is being sent.</b>"; cueList.appendChild(li); }
      (window.JG_CUES || []).forEach(addCue);
    }
  }
  document.addEventListener("jg:track", function (e) { if (cuesOn) addCue({ t: Math.round(performance.now() / 1000), event: e.detail.event, props: e.detail.props }); });
  document.addEventListener("jg:open", function (e) { if (e.detail.what !== "cues") return; setCues(!cuesOn); if (cuesOn) FX("arrive"); T("cues_toggled", { on: cuesOn }); });
  if (cues) cues.querySelector("[data-close-cues]").addEventListener("click", function () { setCues(false); });
  HAS.cues = true;

  /* ---------- the trailer: hold to roll ---------- */
  var tr = document.getElementById("trailer");
  if (tr) {
    var shots = [].slice.call(tr.querySelectorAll(".shot")), SHOT = 6000, t = 0, holding = false, lastT = 0, raf = null, cur = -1, done = false;
    var nEl = tr.querySelector("[data-trailer-n]"), end = tr.querySelector(".trailer__end"), holdBtn = tr.querySelector('[data-hold="trailer"]');
    var ring = function () { holdBtn.style.setProperty("--hold", ((t % SHOT) / SHOT).toFixed(3)); };
    var showShot = function (i, quiet) {
      i = Math.max(0, Math.min(shots.length - 1, i));
      if (i === cur) return; cur = i;
      shots.forEach(function (s, j) { s.classList.toggle("is-on", j === i); });
      nEl.textContent = "Shot " + (i + 1) + " of " + shots.length;
      if (!quiet) { if (window.JG_SFX) window.JG_SFX.play("swoosh", { gain: 0.45 }); if (window.JG_HAPTIC) window.JG_HAPTIC("tap"); }
      T("trailer_shot", { n: i + 1 });
      if (i === shots.length - 1 && !done) { done = true; setTimeout(function () { end.hidden = false; tr.classList.add("is-ended"); FX("unlock"); T("trailer_finished", {}); }, still() ? 0 : 1200); }
    };
    var loop = function (now) {
      if (!holding) { raf = null; return; }
      t += now - lastT; lastT = now;
      if (t >= SHOT * shots.length) t = SHOT * shots.length - 1;
      showShot(Math.floor(t / SHOT)); ring();
      raf = requestAnimationFrame(loop);
    };
    var downAt = 0;
    var down = function (e) { if (e && e.type === "pointerdown") { try { holdBtn.setPointerCapture(e.pointerId); } catch (x) {} } holding = true; downAt = performance.now(); lastT = performance.now(); if (!raf) raf = requestAnimationFrame(loop); };
    var up = function () { if (!holding) return; holding = false; if (performance.now() - downAt < 180) { t = (Math.floor(t / SHOT) + 1) * SHOT; if (t >= SHOT * shots.length) t = SHOT * shots.length - 1; showShot(Math.floor(t / SHOT)); ring(); } };
    holdBtn.addEventListener("pointerdown", down); holdBtn.addEventListener("pointerup", up); holdBtn.addEventListener("pointercancel", up);
    holdBtn.addEventListener("keydown", function (e) { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); down(); } });
    holdBtn.addEventListener("keyup", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); up(); } });
    holdBtn.addEventListener("click", function (e) { e.preventDefault(); });
    tr.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); t = Math.min(SHOT * shots.length - 1, (cur + 1) * SHOT); showShot(cur + 1); ring(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); t = Math.max(0, (cur - 1) * SHOT); showShot(cur - 1); ring(); }
    });
    tr.querySelector('[data-trailer="desk"]').addEventListener("click", function (e) { e.preventDefault(); tr.close(); FX("choice"); setTimeout(function () { window.JG_JUMP && window.JG_JUMP("#desk-title"); }, 60); });
    document.addEventListener("jg:open", function (e) {
      if (e.detail.what !== "trailer") return;
      t = 0; cur = -1; done = false; end.hidden = true; tr.classList.remove("is-ended"); ring(); showShot(0, true);
      window.JG_SHOW(tr); FX("arrive"); T("trailer_opened", { where: e.detail.where });
      setTimeout(function () { holdBtn.focus({ preventScroll: true }); }, 50);
    });
    HAS.trailer = true;
  }

  /* ---------- the water portrait ---------- */
  var post = document.querySelector(".post__water");
  if (post) {
    var canvas = post.querySelector("canvas"), img = post.querySelector("img"), alive = false, GN = innerWidth > 900 ? 160 : 120;
    var cur2 = new Float32Array(GN * GN), prev2 = new Float32Array(GN * GN), src = null, out = null, octx = null, vctx = null, quietFor = 0, running = false, inView = false;
    var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
    var setup = function () {
      if (alive || still()) return;
      var go = function () {
        var off = document.createElement("canvas"); off.width = GN; off.height = GN;
        octx = off.getContext("2d", { willReadFrequently: true });
        var s = Math.min(img.naturalWidth, img.naturalHeight);
        octx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) * 0.2, s, s, 0, 0, GN, GN);
        src = octx.getImageData(0, 0, GN, GN).data; out = octx.createImageData(GN, GN);
        var size = canvas.clientWidth || 320; canvas.width = size; canvas.height = size;
        vctx = canvas.getContext("2d"); vctx.imageSmoothingEnabled = true;
        vctx.drawImage(off, 0, 0, canvas.width, canvas.height);
        alive = true; post.classList.add("is-live");
      };
      if (img.complete && img.naturalWidth) go(); else img.addEventListener("load", go, { once: true });
    };
    var drop = function (cx, cy, r, st) {
      var r2 = r * r;
      for (var y = -r; y <= r; y++) for (var x = -r; x <= r; x++) {
        if (x * x + y * y > r2) continue;
        var px = (cx + x) | 0, py = (cy + y) | 0;
        if (px < 1 || py < 1 || px >= GN - 1 || py >= GN - 1) continue;
        prev2[py * GN + px] += st * (1 - (x * x + y * y) / r2);
      }
      quietFor = 0; if (!running) { running = true; requestAnimationFrame(frame); }
    };
    var frame = function () {
      if (!alive || !inView || document.hidden) { running = false; return; }
      var i, x, y, energy = 0;
      for (y = 1; y < GN - 1; y++) { var row = y * GN; for (x = 1; x < GN - 1; x++) { i = row + x; cur2[i] = ((prev2[i - 1] + prev2[i + 1] + prev2[i - GN] + prev2[i + GN]) * 0.5 - cur2[i]) * 0.975; energy += cur2[i] < 0 ? -cur2[i] : cur2[i]; } }
      var d = out.data;
      for (y = 0; y < GN; y++) for (x = 0; x < GN; x++) {
        i = y * GN + x; var dx = 0, dy = 0;
        if (x > 0 && x < GN - 1 && y > 0 && y < GN - 1) { dx = cur2[i - 1] - cur2[i + 1]; dy = cur2[i - GN] - cur2[i + GN]; }
        var si = (clamp((y + dy * 0.9) | 0, 0, GN - 1) * GN + clamp((x + dx * 0.9) | 0, 0, GN - 1)) * 4, oi = i * 4, sh = dx * 2.4;
        d[oi] = clamp(src[si] + sh, 0, 255); d[oi + 1] = clamp(src[si + 1] + sh, 0, 255); d[oi + 2] = clamp(src[si + 2] + sh, 0, 255); d[oi + 3] = 255;
      }
      var tmp = cur2; cur2 = prev2; prev2 = tmp;
      octx.putImageData(out, 0, 0); vctx.drawImage(octx.canvas, 0, 0, canvas.width, canvas.height);
      if (energy < 0.5) { if ((quietFor += 1) > 90) { running = false; return; } } else quietFor = 0; /* rests about 1.5 s after it settles */
      requestAnimationFrame(frame);
    };
    var lastDrop = 0, lastG = [-9, -9];
    var touch = function (e) {
      if (!alive) { setup(); return; }
      var r = canvas.getBoundingClientRect(), gx = ((e.clientX - r.left) / r.width) * GN, gy = ((e.clientY - r.top) / r.height) * GN;
      if (Math.abs(gx - lastG[0]) < 1.5 && Math.abs(gy - lastG[1]) < 1.5) return; lastG = [gx, gy];
      drop(gx, gy, 3, e.type === "pointerdown" ? 16 : 5);
      var now = performance.now();
      if (e.type === "pointerdown" || now - lastDrop > 420) { lastDrop = now; if (window.JG_SFX) window.JG_SFX.play("drop", { gain: 0.6, throttle: 120 }); if (window.JG_HAPTIC && e.type === "pointerdown") window.JG_HAPTIC("tap"); }
    };
    canvas.addEventListener("pointerdown", touch); canvas.addEventListener("pointermove", touch);
    post.querySelector('[data-water="drop"]').addEventListener("click", function () { if (!alive) setup(); setTimeout(function () { drop(GN / 2, GN / 2, 5, 18); if (window.JG_SFX) window.JG_SFX.play("drop", { gain: 0.6 }); }, 30); T("water_touched", { how: "button" }); });
    var wio = new IntersectionObserver(function (en) { en.forEach(function (x) { inView = x.isIntersecting; if (inView) setup(); }); }, { rootMargin: "50% 0px" });
    wio.observe(post);
    var touched = false; canvas.addEventListener("pointerdown", function () { if (!touched) { touched = true; T("water_touched", { how: "touch" }); } });
  }

  /* ---------- the forward kit ---------- */
  document.querySelectorAll("[data-forward]").forEach(function (b) {
    b.addEventListener("click", function () {
      var blurb = (document.querySelector("[data-blurb]") || {}).textContent || "";
      var code = (window.JG_ID || "").replace(/^v/, "").slice(-6);
      var url = location.origin + "/?cut=screening&s=" + code;
      var text = blurb.replace("jasonobawemimo.com", "").trim() + " " + url;
      if (b.getAttribute("data-forward") === "share" && navigator.share) {
        navigator.share({ title: "Jason Obawemimo", text: blurb.replace(" jasonobawemimo.com", ""), url: url }).then(function () { FX("send"); T("share_opened", {}); }).catch(function () {});
        return;
      }
      (window.JG_COPY ? window.JG_COPY(text) : Promise.resolve()).then(function () { FX("send"); if (window.JG_TOAST) window.JG_TOAST("Copied, with a link to this cut"); T("forward_copied", {}); });
    });
  });

  /* ---------- commentary: opt-in, captions always, voice when a clip exists ---------- */
  var LINES = {
    slate: "That's me in ten seconds. The resume, the proof and my email are one tap away from anywhere on this page.",
    desk: "This is a sketch of the desk I built for Triple J. Run it once. It takes about a minute.",
    film: "This is the real one, the desk the team closes sales on. Press play when you want sound.",
    record: "The record, plain. Every line has a link to the thing it points at.",
    obavia: "Obavia is the one I'm building. It's in development, so there are no numbers here. Try the listening exercise instead.",
    questions: "If we talk, these are the questions I'd want you to ask me.",
    rig: "Flip the switch and you'll see how this page runs, live.",
    move: "Email is the fastest way to reach me.",
    credits: "Everything on this page is checkable from this list.",
    post: "Still here? Touch the water."
  };
  var strip = document.getElementById("commentary"), lineEl = strip ? strip.querySelector(".commentary__line") : null, said = {}, manifest = null, audio = null, section = null;
  function djb2(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16); }
  function loadManifest() { if (manifest) return Promise.resolve(manifest); return fetch("assets/voice/manifest.json?v=s1").then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) { manifest = j; return j; }).catch(function () { manifest = {}; return manifest; }); }
  function speak(text) {
    if (audio) { try { audio.pause(); } catch (e) {} audio = null; }
    if (window.JG_SFX && window.JG_SFX.muted()) return;
    loadManifest().then(function (m) { var e = m["" + djb2("jason:" + text)]; if (!e) return; audio = new Audio("assets/voice/" + e.f); audio.play().catch(function () {}); });
  }
  function current() {
    var best = null, bf = 0;
    document.querySelectorAll("[data-track]").forEach(function (el) { var r = el.getBoundingClientRect(), vis = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / innerHeight; if (vis > bf) { bf = vis; best = el.getAttribute("data-track"); } });
    return bf > 0.35 ? best : null;
  }
  function tick() {
    if (!strip || !(window.JG_COMMENTARY && window.JG_COMMENTARY())) return;
    var s = current(); if (!s || s === section || !LINES[s]) return;
    section = s; lineEl.textContent = LINES[s]; strip.hidden = false;
    if (!said[s]) { said[s] = 1; speak(LINES[s]); T("commentary_line", { section: s }); }
  }
  if (strip) {
    setInterval(tick, 700);
    document.addEventListener("jg:commentary", function (e) { if (!e.detail.on) { strip.hidden = true; section = null; if (audio) { try { audio.pause(); } catch (x) {} } } else { said = {}; tick(); } });
  }
})();
