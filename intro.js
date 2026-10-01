/* The intro. Tap anywhere to begin, one question, an optional name, then the
   cut that suits you. Shown once per browser; /?intro=1 replays it.
   The page underneath is complete without it: crawlers, deep links and
   returning visitors never see it, and every skip is silent.
   The head script decides whether to show it (html.intro-pending) so the
   Slate never flashes before the curtain. */
(function () {
  "use strict";
  var root = document.documentElement, body = document.body;
  if (!root.classList.contains("intro-pending")) return;
  if (!body.classList.contains("home")) { root.classList.remove("intro-pending"); return; }

  var RM = matchMedia("(prefers-reduced-motion: reduce)").matches || root.hasAttribute("data-still");
  var COARSE = matchMedia("(pointer: coarse)").matches;
  var T = window.JG_TRACK || function () {};
  function fx(k) { if (window.JG_FX) window.JG_FX(k); }
  function sfx(n, o) { return window.JG_SFX ? window.JG_SFX.play(n, o) : false; }
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function wait(ms) { return RM ? Math.min(ms, 120) : ms; }

  var ROLES = {
    interviewer: { n: "1", icon: "i-hire", h: "I’m hiring", p: "Interviewer or recruiter. The proof, fast.", cut: "screening",
      line: "The ten-second version first. Then the proof." },
    partner: { n: "2", icon: "i-grow", h: "I run an agency", p: "Business partner. Where your sales floor leaks.", cut: "agency",
      line: "Where your sales floor leaks, and what I’m building for it." },
    lurker: { n: "3", icon: "i-look", h: "Just looking", p: "No pitch. The fun parts.", cut: "trailer",
      line: "The fun parts. No pitch." }
  };

  /* ---------- the curtain ---------- */
  if (/[?&]intro=1/.test(location.search)) { try { var u = new URL(location.href); u.searchParams.delete("intro"); history.replaceState(null, "", u.pathname + u.search + u.hash); } catch (e) {} }
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  scrollTo(0, 0);
  var el = document.createElement("div");
  el.id = "intro"; el.className = "intro";
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "intro-title");
  el.innerHTML =
    '<button class="intro__skip" type="button" data-intro-skip>Skip intro</button>' +
    '<div class="intro__stage">' +
      '<div class="intro__medal"><canvas aria-hidden="true"></canvas>' +
        '<svg class="intro__ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48.5"/><circle class="intro__ring-p" cx="50" cy="50" r="48.5" pathLength="100"/></svg>' +
        '<span class="intro__wave" aria-hidden="true"></span><span class="intro__wave intro__wave--2" aria-hidden="true"></span></div>' +
      '<div class="intro__scene intro__scene--a">' +
        '<p class="intro__name" id="intro-title"><span class="mask"><span>Jason</span></span><span class="mask"><span><em>Obawemimo</em></span></span></p>' +
        '<svg class="intro__rule" viewBox="0 0 240 8" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M2 5c40-3 80-3 118-1.5S200 6 238 3"/></svg>' +
        '<p class="intro__count" aria-hidden="true"><span>0</span></p>' +
        '<p class="intro__hint" aria-live="polite">' + (COARSE ? "Tap anywhere to begin" : "Click anywhere to begin") + '</p>' +
      '</div>' +
      '<div class="intro__scene intro__scene--b" hidden></div>' +
    '</div>';
  body.appendChild(el);
  root.classList.add("intro-mounted");
  if (window.JG_LOCK) window.JG_LOCK(true);
  var medal = el.querySelector(".intro__medal"), canvas = medal.querySelector("canvas");
  var sceneA = el.querySelector(".intro__scene--a"), sceneB = el.querySelector(".intro__scene--b");
  var ring = el.querySelector(".intro__ring-p"), count = el.querySelector(".intro__count span"), hint = el.querySelector(".intro__hint");
  var phase = "loading";
  requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("is-shown"); }); });
  T("intro_shown", {});

  /* ---------- water on the portrait: two height fields and a displacement pass ---------- */
  var LOW = (navigator.hardwareConcurrency || 4) <= 4, GN = LOW ? 140 : 200, alive = true, hidden = false;
  var cur = new Float32Array(GN * GN), prev = new Float32Array(GN * GN), src = null, out = null, octx = null, vctx = null;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function setup(img) {
    var off = document.createElement("canvas"); off.width = GN; off.height = GN;
    octx = off.getContext("2d", { willReadFrequently: true });
    var s = Math.min(img.naturalWidth, img.naturalHeight);
    octx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) * 0.25, s, s, 0, 0, GN, GN);
    src = octx.getImageData(0, 0, GN, GN).data; out = octx.createImageData(GN, GN);
    var dpr = Math.min(devicePixelRatio || 1, 2), size = canvas.clientWidth || 240;
    canvas.width = size * dpr; canvas.height = size * dpr;
    vctx = canvas.getContext("2d"); vctx.imageSmoothingEnabled = true; vctx.imageSmoothingQuality = "high";
    if (RM) { vctx.drawImage(off, 0, 0, canvas.width, canvas.height); return; }
    drop(GN / 2, GN / 2, 6, 14); requestAnimationFrame(frame); ambient();
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
  function frame() {
    if (!alive) return;
    if (hidden) return requestAnimationFrame(frame);
    var i, x, y;
    for (y = 1; y < GN - 1; y++) { var row = y * GN; for (x = 1; x < GN - 1; x++) { i = row + x; cur[i] = ((prev[i - 1] + prev[i + 1] + prev[i - GN] + prev[i + GN]) * 0.5 - cur[i]) * 0.982; } }
    var d = out.data;
    for (y = 0; y < GN; y++) for (x = 0; x < GN; x++) {
      i = y * GN + x; var dx = 0, dy = 0;
      if (x > 0 && x < GN - 1 && y > 0 && y < GN - 1) { dx = cur[i - 1] - cur[i + 1]; dy = cur[i - GN] - cur[i + GN]; }
      var si = (clamp((y + dy * 0.9) | 0, 0, GN - 1) * GN + clamp((x + dx * 0.9) | 0, 0, GN - 1)) * 4, oi = i * 4, sh = dx * 2.4;
      d[oi] = clamp(src[si] + sh, 0, 255); d[oi + 1] = clamp(src[si + 1] + sh, 0, 255); d[oi + 2] = clamp(src[si + 2] + sh, 0, 255); d[oi + 3] = 255;
    }
    var t = cur; cur = prev; prev = t;
    octx.putImageData(out, 0, 0); vctx.drawImage(octx.canvas, 0, 0, canvas.width, canvas.height);
    requestAnimationFrame(frame);
  }
  var ambT = null, unlocked = false;
  function ambient() {
    if (!alive || !src) return;
    var a = Math.random() * Math.PI * 2, rad = GN * (0.18 + Math.random() * 0.26);
    drop(GN / 2 + Math.cos(a) * rad, GN / 2 + Math.sin(a) * rad, 3, 4);
    ambT = setTimeout(ambient, 800 + Math.random() * 1000);
  }
  function rippleAt(cx, cy, big) {
    if (!src || RM) return;
    var r = canvas.getBoundingClientRect();
    var gx = ((cx - r.left) / r.width) * GN, gy = ((cy - r.top) / r.height) * GN;
    if (gx < 0 || gy < 0 || gx > GN || gy > GN) { gx = GN / 2; gy = GN / 2; }
    drop(gx, gy, big ? 7 : 2.2, big ? 22 : 5);
  }
  var lastX = -99, lastY = -99;
  canvas.addEventListener("pointermove", function (e) {
    if (phase !== "loading" && phase !== "ready") return;
    if (Math.abs(e.clientX - lastX) < 4 && Math.abs(e.clientY - lastY) < 4) return;
    lastX = e.clientX; lastY = e.clientY; rippleAt(e.clientX, e.clientY, false);
    if (unlocked) sfx("drop", { gain: 0.18, throttle: 140 });
  }, { passive: true });
  document.addEventListener("visibilitychange", function () { hidden = document.hidden; });
  var pic = new Image();
  pic.onload = function () { setup(pic); got(); };
  pic.onerror = got;
  pic.src = "assets/jason-loader.webp";

  /* ---------- loading: a real count, held at 96 until the portrait and fonts are in ---------- */
  var t0 = performance.now(), MIN = RM ? 300 : 1600, assets = 0, NEED = 2, wantGo = false;
  function got() { assets++; }
  Promise.resolve(document.fonts && document.fonts.ready).then(got, got);
  setTimeout(function () { assets = NEED; }, 6000);
  function ease(p) { return -(Math.cos(Math.PI * p) - 1) / 2; }
  function tick(now) {
    if (phase !== "loading") return;
    var p = clamp((now - t0) / MIN, 0, 1), shown = Math.round(ease(p) * 100);
    if (assets < NEED && shown > 96) shown = 96;
    count.textContent = shown; ring.style.strokeDashoffset = 100 - shown;
    if (shown >= 100) return ready();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  function ready() {
    phase = "ready"; count.textContent = "100"; ring.style.strokeDashoffset = 0;
    el.classList.add("is-ready");
    if (wantGo) begin();
  }

  /* ---------- tap anywhere ---------- */
  el.addEventListener("pointerdown", function (e) {
    if (e.target.closest("[data-intro-skip]")) return;
    unlocked = true;
    if (phase === "loading") { wantGo = true; el.classList.add("is-waiting"); hint.textContent = "One moment"; rippleAt(e.clientX, e.clientY, true); return; }
    if (phase === "ready") { rippleAt(e.clientX, e.clientY, true); begin(); }
  });
  function begin() {
    if (phase !== "ready") return;
    phase = "begun"; el.classList.add("is-go");
    sfx("splash", { gain: 0.85 }); fx("cut");
    T("intro_started", {});
    setTimeout(question, wait(560));
  }

  /* shared-element move: measure, change, measure, play the difference */
  function flip(node, mutate, ms, curve) {
    var a = node.getBoundingClientRect(); mutate(); var b = node.getBoundingClientRect();
    if (RM || !b.width) return;
    var dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2), s = a.width / b.width;
    node.style.transition = "none"; node.style.transform = "translate(" + dx + "px," + dy + "px) scale(" + s + ")";
    void node.offsetWidth;
    node.style.transition = "transform " + ms + "ms " + (curve || "var(--spring-soft)"); node.style.transform = "";
  }
  function swap(html, then) {
    if (!sceneB.hidden && sceneB.innerHTML) {
      sceneB.classList.add("is-out");
      setTimeout(function () { put(html); then && then(); }, wait(260));
    } else { put(html); then && then(); }
  }
  function put(html) {
    sceneB.classList.remove("is-in", "is-out"); sceneB.innerHTML = html; sceneB.hidden = false;
    void sceneB.offsetWidth; requestAnimationFrame(function () { sceneB.classList.add("is-in"); });
  }

  /* ---------- the question ---------- */
  function question() {
    phase = "question";
    flip(medal, function () { sceneA.hidden = true; el.classList.add("is-q"); }, 800);
    var rows = Object.keys(ROLES).map(function (k, i) {
      var R = ROLES[k];
      return '<li style="--i:' + i + '"><button class="row intro__path" type="button" data-role="' + k + '">' +
        '<span class="appicon appicon--sm" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20"><use href="#' + R.icon + '"/></svg></span>' +
        '<span class="row__txt"><b>' + R.h + '</b><span>' + R.p + '</span></span>' +
        '<kbd aria-hidden="true">' + R.n + '</kbd><i class="row__chev" aria-hidden="true"></i></button></li>';
    }).join("");
    swap('<h2 class="intro__q" id="intro-q"><span class="mask"><span>What brings you</span></span><span class="mask"><span><em>here?</em></span></span></h2>' +
      '<ul class="group intro__paths">' + rows + '</ul>' +
      '<p class="intro__fine">' + (COARSE ? "Pick one. You can switch later." : "Or press 1, 2 or 3.") + '</p>', function () {
      el.setAttribute("aria-labelledby", "intro-q");
      sceneB.querySelectorAll("[data-role]").forEach(function (b) { b.addEventListener("click", function () { choose(b.getAttribute("data-role")); }); });
      var first = sceneB.querySelector("[data-role]"); if (first && !COARSE) setTimeout(function () { first.focus({ preventScroll: true }); }, wait(500));
    });
  }
  function choose(role) {
    if (phase !== "question" || !ROLES[role]) return;
    phase = "chosen";
    var b = sceneB.querySelector('[data-role="' + role + '"]'); if (b) b.classList.add("is-picked");
    fx("choice");
    store.set("jg_role", role); store.set("jg_cut", ROLES[role].cut);
    T("role_chosen", { role: role, where: "intro" }, { role: role });
    setTimeout(function () { askName(role); }, wait(480));
  }

  /* ---------- the name, skippable ---------- */
  var curRole = null;
  function askName(role) {
    phase = "name"; curRole = role;
    var prior = store.get("jg_name") || "";
    swap('<h2 class="intro__q" id="intro-n"><span class="mask"><span>And your <em>name?</em></span></span></h2>' +
      '<form class="intro__form" autocomplete="on"><input class="intro__input" type="text" name="name" maxlength="40" autocomplete="given-name" autocapitalize="words" spellcheck="false" enterkeyhint="go" placeholder="First name is plenty" aria-label="Your name" value="' + esc(prior) + '" />' +
      '<div class="intro__row"><button class="btn btn--gold" type="submit">Continue</button><button class="btn btn--ghost" type="button" data-intro-noname>Skip</button></div>' +
      '<p class="intro__fine">So I know who stopped by. Only I see it.</p></form>', function () {
      el.setAttribute("aria-labelledby", "intro-n");
      var form = sceneB.querySelector("form"), input = form.querySelector("input");
      setTimeout(function () { input.focus({ preventScroll: true }); }, wait(420));
      input.addEventListener("keydown", function (e) {
        if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
        if (e.key === "Backspace") sfx("key-back", { throttle: 30 }); else if (e.key.length === 1) sfx("key", { throttle: 30 });
      });
      form.addEventListener("submit", function (e) { e.preventDefault(); named(role, input.value); });
      form.querySelector("[data-intro-noname]").addEventListener("click", function () { named(role, ""); });
    });
  }
  function clean(v) { return String(v || "").replace(/[^\p{L}\p{M}' .-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40); }
  function named(role, raw) {
    if (phase !== "name") return;
    phase = "cut";
    var name = clean(raw);
    if (name) { store.set("jg_name", name); fx("send"); T("name_given", { role: role, name: name }, { name: name, role: role }); }
    else T("name_skipped", { role: role });
    card(role, name);
  }

  /* ---------- the title card, then the cut ---------- */
  function card(role, name) {
    var first = name ? name.split(" ")[0] : "";
    swap('<p class="intro__card" id="intro-c"><span class="mask"><span>' + (first ? "Okay, <em>" + esc(first) + ".</em>" : "Okay. <em>Your cut.</em>") + '</span></span></p>' +
      '<svg class="intro__rule intro__rule--card" viewBox="0 0 240 8" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M2 5c40-3 80-3 118-1.5S200 6 238 3"/></svg>' +
      '<p class="intro__cardline">' + esc(ROLES[role].line) + '</p>', function () {
      el.setAttribute("aria-labelledby", "intro-c");
      sfx("swoosh", { gain: 0.45, rate: 1.05 });
      setTimeout(function () { leave(role, first); }, wait(1500));
    });
  }

  function markCut(k) {
    document.querySelectorAll("[data-cut]").forEach(function (c) {
      var on = c.getAttribute("data-cut") === k;
      c.classList.toggle("is-on", on); if (c.tagName === "BUTTON") c.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  function done() {
    alive = false; clearTimeout(ambT);
    store.set("jg_intro", "1");
    root.classList.remove("intro-pending", "intro-mounted");
    if (window.JG_LOCK) window.JG_LOCK(false);
    removeEventListener("keydown", keys, true);
  }
  function leave(role, first) {
    phase = "leaving";
    T("intro_finished", { role: role, named: !!first });
    if (role === "partner") {
      try { sessionStorage.setItem("jg_greet", first || "1"); } catch (e) {}
      el.classList.add("is-black"); fx("cut");
      setTimeout(function () { done(); location.href = "/obavia.html"; }, wait(420));
      return;
    }
    markCut(ROLES[role].cut);
    var face = document.querySelector(".slate__face img"), slate = document.querySelector(".slate [data-rise]");
    if (slate) { slate.classList.remove("is-in"); void slate.offsetWidth; }
    done();
    el.classList.add("is-out");
    if (face && !RM) {
      var m = medal.getBoundingClientRect(), t = face.getBoundingClientRect();
      if (t.width && t.bottom > 0) {
        medal.style.transition = "transform .95s var(--ease), border-radius .95s var(--ease), opacity .5s var(--ease) .3s";
        medal.style.borderRadius = getComputedStyle(face.parentNode).borderRadius;
        medal.style.transform = "translate(" + (t.left + t.width / 2 - (m.left + m.width / 2)) + "px," + (t.top + t.height / 2 - (m.top + m.height / 2)) + "px) scale(" + (t.width / m.width) + ")";
        medal.classList.add("is-landing"); medal.style.opacity = "0";
      }
    }
    if (!RM) { root.style.setProperty("--bars", "1"); setTimeout(function () { root.style.setProperty("--bars", "0"); }, 560); }
    setTimeout(function () { if (slate) slate.classList.add("is-in"); fx("arrive"); }, wait(420));
    setTimeout(function () {
      el.remove();
      if (window.JG_TOAST) window.JG_TOAST(first ? "Welcome, " + first : "Welcome in");
    }, wait(1250));
    setTimeout(function () { route(role); }, wait(3400));
  }
  function route(role) {
    if (!window.JG_NOTIFY) return;
    if (role === "interviewer") window.JG_NOTIFY({ app: "Your cut", title: "Start with the desk", body: "Run the sale desk I built for Triple J. About a minute.", ms: 7000,
      go: function () { if (window.JG_CUT) window.JG_CUT(function () { window.JG_JUMP("#desk-title"); }); T("cta_click", { label: "intro_desk" }); } });
    else window.JG_NOTIFY({ app: "Your cut", title: "Roll the trailer", body: "Six shots. Hold to play.", ms: 7000,
      go: function () { if (window.JG_OPEN) window.JG_OPEN("trailer", "intro"); } });
  }

  /* ---------- skip: silent, and it never comes back ---------- */
  function skip() {
    if (phase === "leaving") return;
    T("intro_skipped", { phase: phase });
    phase = "leaving"; done();
    el.classList.add("is-out", "is-fast");
    setTimeout(function () { el.remove(); }, wait(420));
  }
  el.querySelector("[data-intro-skip]").addEventListener("click", skip);

  /* ---------- keys: any key begins, 1 2 3 choose, Escape skips, Tab stays inside ---------- */
  function keys(e) {
    if (!document.body.contains(el)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Escape") { e.preventDefault(); if (phase === "name") return named(curRole, ""); return skip(); }
    if (e.key === "Tab") {
      var f = [].slice.call(el.querySelectorAll("button, input")).filter(function (n) { return n.offsetParent !== null; });
      if (!f.length) return;
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      else if (!el.contains(document.activeElement)) { e.preventDefault(); a.focus(); }
      return;
    }
    if (phase === "question") {
      var map = { "1": "interviewer", "2": "partner", "3": "lurker" };
      if (map[e.key]) { e.preventDefault(); choose(map[e.key]); }
      return;
    }
    if ((phase === "loading" || phase === "ready") && (e.key === "Enter" || e.key === " " || e.key.length === 1)) {
      e.preventDefault(); unlocked = true;
      if (phase === "loading") { wantGo = true; el.classList.add("is-waiting"); hint.textContent = "One moment"; } else begin();
    }
  }
  addEventListener("keydown", keys, true);
})();
