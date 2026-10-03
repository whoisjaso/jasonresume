/* The onboarding. Tap anywhere to begin, one question, an optional name, then
   the cut that suits you. Every visitor sees it on every arrival from outside
   the site, on the home page or /obavia.html; clicks between the site's own
   pages and crawlers go straight to the page, which is complete without it.
   Its words and choices live in tools/site/onboarding.json, inlined as
   #onboarding-data. Every skip is silent. A deep link (#present, #verify,
   #story-..., ?cut=, or any #section on the page) opens once the onboarding
   ends, instead of the trailer.
   The head script sets html.intro-pending so the page never flashes first.
   When it ends, document gets "jg:intro-done". */
(function () {
  "use strict";
  var root = document.documentElement, body = document.body;
  if (!root.classList.contains("intro-pending")) return;
  if (!document.getElementById("onboarding-data")) { root.classList.remove("intro-pending"); return; }

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

  var O = null; try { O = JSON.parse(document.getElementById("onboarding-data").textContent); } catch (e) {}
  if (!O || !O.roles) { root.classList.remove("intro-pending"); document.dispatchEvent(new CustomEvent("jg:intro-done")); return; }
  var ROLES = {}, KEYS = {};
  O.roles.forEach(function (r, i) { r.n = String(i + 1); ROLES[r.id] = r; KEYS[r.n] = r.id; });
  var HASH = location.hash, DEEP = /[?&]cut=/.test(location.search) || /^#(present|verify|trailer|story-)/.test(HASH);
  try { if (HASH.length > 1 && HASH !== "#top" && document.getElementById(decodeURIComponent(HASH.slice(1)))) DEEP = true; } catch (e) {}

  /* ---------- the curtain ---------- */
  if (/[?&]intro=1/.test(location.search)) { try { var u = new URL(location.href); u.searchParams.delete("intro"); history.replaceState(null, "", u.pathname + u.search + u.hash); } catch (e) {} }
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  scrollTo(0, 0);
  var el = document.createElement("div");
  el.id = "intro"; el.className = "intro";
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "intro-title");
  el.innerHTML =
    '<button class="intro__skip" type="button" data-intro-skip>' + esc(O.loading.skip) + '</button>' +
    '<div class="intro__stage">' +
      '<div class="intro__medal"><img class="intro__face" src="assets/jason-headshot-620.webp" alt="" width="620" height="620" />' +
        '<svg class="intro__ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48.5"/><circle class="intro__ring-p" cx="50" cy="50" r="48.5" pathLength="100"/>' + ticks() + '</svg>' +
        '<span class="intro__needle" aria-hidden="true"></span>' +
        '<span class="intro__wave" aria-hidden="true"></span><span class="intro__wave intro__wave--2" aria-hidden="true"></span></div>' +
      '<div class="intro__scene intro__scene--a">' +
        '<p class="intro__name" id="intro-title"><span class="mask"><span>' + esc(O.loading.first) + '</span></span><span class="mask"><span><em>' + esc(O.loading.last) + '</em></span></span></p>' +
        '<svg class="intro__rule" viewBox="0 0 240 8" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M2 5c40-3 80-3 118-1.5S200 6 238 3"/></svg>' +
        '<p class="intro__count" aria-hidden="true"><span>0</span></p>' +
        '<p class="intro__hint" aria-live="polite">' + esc(COARSE ? O.loading.hint_touch : O.loading.hint_pointer) + '</p>' +
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

  /* ---------- the bezel: a tachometer's ticks around the portrait ---------- */
  function ticks() {
    var out = "";
    for (var k = 0; k <= 30; k++) {
      var d = -135 + k * 9, r1 = 44.6, r2 = k % 5 ? 42.6 : 40.6, a = (d - 90) * Math.PI / 180;
      out += '<line x1="' + (50 + r1 * Math.cos(a)).toFixed(2) + '" y1="' + (50 + r1 * Math.sin(a)).toFixed(2) + '" x2="' + (50 + r2 * Math.cos(a)).toFixed(2) + '" y2="' + (50 + r2 * Math.sin(a)).toFixed(2) + '" class="intro__tick' + (k >= 26 ? " is-red" : "") + '"/>';
    }
    return out;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rippleAt() {}
  var unlocked = false;
  var pic = el.querySelector(".intro__face");
  if (pic.complete) setTimeout(got, 0); else { pic.addEventListener("load", got); pic.addEventListener("error", got); }

  /* ---------- the engine: a starter that chugs, then catches and settles ---------- */
  function crank() {
    var S = window.JG_SFX; if (!S || !S.ctx) return;
    var c = S.ctx(); if (!c) return;
    var out = (S.out && S.out()) || c.destination, t = c.currentTime + 0.02;
    try {
      var len = Math.floor(c.sampleRate * 0.8), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var src = c.createBufferSource(), lp = c.createBiquadFilter(), g = c.createGain();
      src.buffer = buf; lp.type = "lowpass"; lp.frequency.value = 760; g.gain.value = 0.0001;
      for (var k = 0; k < 6; k++) { var st = t + k * 0.092; g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(0.32, st + 0.014); g.gain.exponentialRampToValueAtTime(0.0001, st + 0.075); }
      src.connect(lp); lp.connect(g); g.connect(out); src.start(t); src.stop(t + 0.62);
      var o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), eg = c.createGain(), on = t + 0.56;
      o.type = "sawtooth"; o2.type = "square"; f.type = "lowpass";
      o.frequency.setValueAtTime(36, on); o.frequency.exponentialRampToValueAtTime(74, on + 0.28); o.frequency.exponentialRampToValueAtTime(41, on + 1.1);
      o2.frequency.setValueAtTime(18, on); o2.frequency.exponentialRampToValueAtTime(37, on + 0.28); o2.frequency.exponentialRampToValueAtTime(20.5, on + 1.1);
      f.frequency.setValueAtTime(240, on); f.frequency.exponentialRampToValueAtTime(720, on + 0.28); f.frequency.exponentialRampToValueAtTime(210, on + 1.1);
      eg.gain.setValueAtTime(0.0001, on); eg.gain.exponentialRampToValueAtTime(0.3, on + 0.12); eg.gain.exponentialRampToValueAtTime(0.09, on + 0.9); eg.gain.exponentialRampToValueAtTime(0.0001, on + 1.5);
      o.connect(f); o2.connect(f); f.connect(eg); eg.connect(out); o.start(on); o2.start(on); o.stop(on + 1.6); o2.stop(on + 1.6);
    } catch (e) {}
  }

  /* ---------- loading: a real count, held at 96 until the portrait and fonts are in ---------- */
  var t0 = performance.now(), MIN = RM ? 300 : 1100, assets = 0, NEED = 2, wantGo = false;
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
    if (phase === "loading") { wantGo = true; el.classList.add("is-waiting"); hint.textContent = O.loading.waiting; return; }
    if (phase === "ready") begin();
  });
  function begin() {
    if (phase !== "ready") return;
    phase = "begun"; el.classList.add("is-go");
    crank(); fx("cut");
    if (window.JG_HAPTIC) window.JG_HAPTIC("tap");
    document.dispatchEvent(new CustomEvent("jg:ignition"));
    T("intro_started", {});
    setTimeout(question, wait(1250));
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
        '<span class="row__txt"><b>' + esc(R.h) + '</b><span>' + esc(R.p) + '</span></span>' +
        '<kbd aria-hidden="true">' + R.n + '</kbd><i class="row__chev" aria-hidden="true"></i></button></li>';
    }).join("");
    swap('<h2 class="intro__q" id="intro-q"><span class="mask"><span>' + esc(O.question.title) + '</span></span><span class="mask"><span><em>' + esc(O.question.title_em) + '</em></span></span></h2>' +
      '<ul class="group intro__paths">' + rows + '</ul>' +
      '<p class="intro__fine">' + esc(COARSE ? O.question.fine_touch : O.question.fine_pointer) + '</p>', function () {
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
  var curRole = null, back = false;
  function askName(role) {
    phase = "name"; curRole = role;
    var prior = store.get("jg_name") || "";
    swap('<h2 class="intro__q" id="intro-n"><span class="mask"><span>' + esc(O.name.title) + ' <em>' + esc(O.name.title_em) + '</em></span></span></h2>' +
      '<form class="intro__form" autocomplete="on"><input class="intro__input" type="text" name="name" maxlength="40" autocomplete="given-name" autocapitalize="words" spellcheck="false" enterkeyhint="go" placeholder="' + esc(O.name.placeholder) + '" aria-label="Your name" value="' + esc(prior) + '" />' +
      '<div class="intro__row"><button class="btn btn--gold" type="submit">' + esc(O.name.continue) + '</button><button class="btn btn--ghost" type="button" data-intro-noname>' + esc(O.name.skip) + '</button></div>' +
      '<p class="intro__fine">' + esc(O.name.fine) + '</p></form>', function () {
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
    var name = clean(raw), before = clean(store.get("jg_name") || "");
    back = !!name && name === before && store.get("jg_intro") === "1";
    if (name) { store.set("jg_name", name); fx("send"); T("name_given", { role: role, name: name }, { name: name, role: role }); }
    else T("name_skipped", { role: role });
    card(role, name);
  }

  /* ---------- the title card, then the cut ---------- */
  function card(role, name) {
    var first = name ? name.split(" ")[0] : "";
    swap('<p class="intro__card" id="intro-c"><span class="mask"><span>' + (first ? esc(back ? O.card.returning : O.card.named) + " <em>" + esc(first) + ".</em>" : esc(O.card.anonymous) + " <em>" + esc(O.card.anonymous_em) + "</em>") + '</span></span></p>' +
      '<svg class="intro__rule intro__rule--card" viewBox="0 0 240 8" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M2 5c40-3 80-3 118-1.5S200 6 238 3"/></svg>' +
      '<p class="intro__cardline">' + esc(ROLES[role].line) + '</p>', function () {
      el.setAttribute("aria-labelledby", "intro-c");
      sfx("swoosh", { gain: 0.45, rate: 1.05 });
      setTimeout(function () { leave(role, first); }, wait(950));
    });
  }

  function markCut(k) {
    document.querySelectorAll("[data-cut]").forEach(function (c) {
      var on = c.getAttribute("data-cut") === k;
      c.classList.toggle("is-on", on); if (c.tagName === "BUTTON") c.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  function done() {
    store.set("jg_intro", "1");
    root.classList.remove("intro-pending", "intro-mounted");
    if (window.JG_LOCK) window.JG_LOCK(false);
    removeEventListener("keydown", keys, true);
    setTimeout(function () { document.dispatchEvent(new CustomEvent("jg:intro-done")); }, 0);
  }
  function leave(role, first) {
    phase = "leaving";
    T("intro_finished", { role: role, named: !!first });
    if (window.JG_REEL && !DEEP) {
      markCut(ROLES[role].cut);
      window.JG_REEL.play(role, { name: first, from: "intro" });
      setTimeout(function () { done(); el.remove(); }, wait(400));
      return;
    }
    if (role === "partner" && !window.JG_REEL && !/obavia\.html$/.test(location.pathname)) {
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
      if (window.JG_TOAST) window.JG_TOAST(first ? O.after.welcome_named + first : O.after.welcome_anonymous);
    }, wait(1250));
    if (!DEEP) setTimeout(function () { route(role); }, wait(3400));
  }
  function route(role) {
    var n = ROLES[role] && ROLES[role].next; if (!window.JG_NOTIFY || !n) return;
    window.JG_NOTIFY({ app: O.after.next_app, title: n.title, body: n.body, ms: 7000,
      go: function () { if (window.JG_STORY) window.JG_STORY(n.story); T("cta_click", { label: "intro_" + n.story }); } });
  }

  /* ---------- skip: silent; the onboarding is back on the next visit ---------- */
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
      if (KEYS[e.key]) { e.preventDefault(); choose(KEYS[e.key]); }
      return;
    }
    if ((phase === "loading" || phase === "ready") && (e.key === "Enter" || e.key === " " || e.key.length === 1)) {
      e.preventDefault(); unlocked = true;
      if (phase === "loading") { wantGo = true; el.classList.add("is-waiting"); hint.textContent = O.loading.waiting; } else begin();
    }
  }
  addEventListener("keydown", keys, true);
})();
