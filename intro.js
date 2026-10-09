/* The title screen. Every visitor sees it on every arrival from outside the
   site, on the home page and /obavia.html; clicks between the site's own pages
   and crawlers go straight to the page, which is complete without it.

   Press start (with the score) or Start muted; then who's playing (a game
   menu, keys 1 to 3); then an optional player name; then a welcome card and
   the library. Every skip is silent. Its words live in
   tools/site/onboarding.json, inlined as #onboarding-data.
   The head script sets html.intro-pending so the page never flashes first.
   While it is up, html has .intro-on. When it ends, document gets
   "jg:intro-done" { role, named }. */
(function () {
  "use strict";
  var root = document.documentElement, body = document.body;
  if (!root.classList.contains("intro-pending")) return;
  var dataEl = document.getElementById("onboarding-data");
  var O = null; try { O = JSON.parse(dataEl.textContent); } catch (e) {}
  if (!O || !O.roles) { root.classList.remove("intro-pending"); document.dispatchEvent(new CustomEvent("jg:intro-done", { detail: {} })); return; }

  var RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var COARSE = matchMedia("(pointer: coarse)").matches;
  function T(e, p, s) { if (window.JG_TRACK) window.JG_TRACK(e, p, s); }
  function hap(k) { if (window.JG_HAPTIC) window.JG_HAPTIC(k); }
  function S() { return window.JG_SCORE; }
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  function E(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function wait(ms) { return RM ? Math.min(ms, 120) : ms; }
  var KEYS = {}; O.roles.forEach(function (r, i) { r.n = String(i + 1); KEYS[r.n] = r.id; });

  if (/[?&]intro=1/.test(location.search)) { try { var u = new URL(location.href); u.searchParams.delete("intro"); history.replaceState(null, "", u.pathname + u.search + u.hash); } catch (e) {} }
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  scrollTo(0, 0);

  /* ---------- the title screen, mounted before anything else loads ---------- */
  var t = O.title, mob = innerWidth < 760;
  var art = body.getAttribute("data-intro-art") || O.art || "assets/game/art/triple-j";
  var el = document.createElement("div");
  el.id = "intro"; el.className = "intro";
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "intro-title");
  el.innerHTML =
    '<div class="intro__art" aria-hidden="true"><img src="' + art + (mob ? "-m.webp" : "-1920.webp") + '" alt="" decoding="async" fetchpriority="high" /></div>' +
    '<div class="intro__shade" aria-hidden="true"></div>' +
    '<button class="intro__skip" type="button" data-intro-skip>' + E(t.skip) + "</button>" +
    '<section class="intro__scene intro__scene--title is-on" data-scene="title">' +
      '<h1 class="intro__logo" id="intro-title"><span>' + E(t.first) + "</span><span>" + E(t.last) + "</span></h1>" +
      '<p class="intro__line">' + E(t.line) + "</p>" +
      '<p class="intro__press" aria-hidden="true">' + E(COARSE ? t.press_touch : t.press) + "</p>" +
      '<div class="intro__start">' +
        '<button class="btn btn--primary btn--lg" type="button" data-start="on"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-select"/></svg>' + E(t.start) + "</button>" +
        '<button class="btn btn--ghost" type="button" data-start="off">' + E(t.muted) + "</button>" +
      "</div>" +
      '<p class="intro__fine">' + E(t.note) + "</p>" +
    "</section>" +
    '<section class="intro__scene intro__scene--seat" data-scene="seat" hidden>' +
      '<h2 class="intro__h">' + E(O.question.title) + "</h2>" +
      '<ol class="menu" role="listbox" aria-label="' + E(O.question.title) + '">' + O.roles.map(function (r, i) {
        return '<li><button class="menu__row' + (i === 0 ? " is-on" : "") + '" type="button" role="option" aria-selected="' + (i === 0 ? "true" : "false") + '" data-role="' + r.id + '"><span class="menu__n" aria-hidden="true">' + r.n + '</span><span class="menu__txt"><b>' + E(r.h) + "</b><small>" + E(r.p) + "</small></span></button></li>";
      }).join("") + "</ol>" +
      '<p class="intro__fine">' + E(COARSE ? O.question.fine_touch : O.question.fine_pointer) + "</p>" +
    "</section>" +
    '<section class="intro__scene intro__scene--name" data-scene="name" hidden>' +
      '<h2 class="intro__h">' + E(O.name.title) + "</h2>" +
      '<form class="intro__form" data-name-form autocomplete="off">' +
        '<label class="vh" for="intro-name">' + E(O.name.title) + "</label>" +
        '<input id="intro-name" name="name" type="text" maxlength="40" spellcheck="false" autocapitalize="words" enterkeyhint="go" placeholder="' + E(O.name.placeholder) + '" />' +
        '<div class="intro__acts"><button class="btn btn--primary" type="submit">' + E(O.name.continue) + '</button><button class="btn btn--ghost" type="button" data-name-skip>' + E(O.name.skip) + "</button></div>" +
      "</form>" +
      '<p class="intro__fine">' + E(O.name.fine) + "</p>" +
    "</section>" +
    '<section class="intro__scene intro__scene--card" data-scene="card" hidden aria-live="polite">' +
      '<p class="intro__card"></p>' +
    "</section>";
  body.appendChild(el);
  root.classList.add("intro-on");
  if (window.JG_LOCK) window.JG_LOCK(true);
  T("intro_shown", {});
  requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("is-shown"); }); });

  var phase = "title", role = store.get("jg_role") || O.roles[0].id, named = false;
  function scene(name) {
    phase = name;
    [].forEach.call(el.querySelectorAll("[data-scene]"), function (s) {
      var on = s.getAttribute("data-scene") === name;
      if (on) { s.hidden = false; requestAnimationFrame(function () { requestAnimationFrame(function () { s.classList.add("is-on"); }); }); }
      else { s.classList.remove("is-on"); s.hidden = true; }
    });
    var f = name === "seat" ? el.querySelector(".menu__row.is-on") : name === "name" ? el.querySelector("#intro-name") : null;
    if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, wait(260));
  }
  var startBtn = el.querySelector('[data-start="on"]');
  setTimeout(function () { startBtn.focus({ preventScroll: true }); }, 60);

  /* ---------- start: with the score, or muted ---------- */
  function start(sound, how) {
    if (phase !== "title") return;
    if (S()) { S().set(sound, "intro"); if (sound) setTimeout(function () { S().sting("start"); }, 120); }
    hap("tap");
    T("intro_started", { sound: sound, how: how || "" });
    el.classList.add("is-started");
    setTimeout(function () { scene("seat"); }, wait(520));
  }
  el.addEventListener("click", function (e) {
    var b = e.target.closest("[data-start]");
    if (b) { start(b.getAttribute("data-start") === "on", "button"); return; }
    if (phase === "title" && !e.target.closest("button,a,input")) start(true, "tap");
  });

  /* ---------- who's playing ---------- */
  var rows = [].slice.call(el.querySelectorAll(".menu__row"));
  function mark(i) {
    rows.forEach(function (r, j) { r.classList.toggle("is-on", j === i); r.setAttribute("aria-selected", j === i ? "true" : "false"); });
    rows[i].focus({ preventScroll: true });
    if (S()) S().tick();
  }
  function choose(id, how) {
    if (phase !== "seat") return;
    role = id; store.set("jg_role", id);
    if (window.JG_FX) window.JG_FX("choice");
    T("role_chosen", { role: id, where: "intro" }, { role: id });
    var r = rows.filter(function (x) { return x.getAttribute("data-role") === id; })[0];
    if (r) r.classList.add("is-picked");
    setTimeout(function () { scene("name"); var inp = el.querySelector("#intro-name"); var prior = store.get("jg_name"); if (prior && inp) inp.value = prior; }, wait(420));
  }
  rows.forEach(function (r) {
    r.addEventListener("click", function () { choose(r.getAttribute("data-role"), "tap"); });
    r.addEventListener("pointerenter", function () { if (!COARSE) rows.forEach(function (x) { x.classList.toggle("is-on", x === r); x.setAttribute("aria-selected", x === r ? "true" : "false"); }); });
  });

  /* ---------- the player name ---------- */
  function clean(s) { return String(s || "").replace(/[^\p{L}\p{M}' .-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40); }
  var back = false;
  el.querySelector("[data-name-form]").addEventListener("submit", function (e) {
    e.preventDefault();
    var raw = el.querySelector("#intro-name").value, name = clean(raw), before = clean(store.get("jg_name") || "");
    if (!name) { finishName(""); return; }
    back = name === before && store.get("jg_intro") === "1";
    store.set("jg_name", name); named = true;
    if (window.JG_FX) window.JG_FX("send");
    T("name_given", { role: role, name: name }, { name: name, role: role });
    finishName(name);
  });
  el.querySelector("[data-name-skip]").addEventListener("click", function () { T("name_skipped", { role: role }); finishName(""); });
  function finishName(name) {
    if (phase !== "name") return;
    var first = name.split(" ")[0];
    var line = first ? (back ? O.card.returning + " " + first + "." : O.card.named + " " + first + ".") : O.card.anonymous;
    el.querySelector(".intro__card").textContent = line;
    scene("card");
    setTimeout(done, wait(1500));
  }

  /* ---------- the end: into the library ---------- */
  var ended = false;
  function done(skipped) {
    if (ended) return; ended = true;
    store.set("jg_intro", "1");
    if (!skipped) T("intro_finished", { role: role, named: named });
    el.classList.add("is-leaving");
    root.classList.remove("intro-on");
    setTimeout(function () {
      el.remove();
      root.classList.remove("intro-pending");
      if (window.JG_LOCK) window.JG_LOCK(false);
      document.dispatchEvent(new CustomEvent("jg:intro-done", { detail: { role: skipped ? store.get("jg_role") : role, named: named } }));
    }, wait(700));
  }
  el.querySelector("[data-intro-skip]").addEventListener("click", function () { T("intro_skipped", { phase: phase }); done(true); });

  /* ---------- keys ---------- */
  addEventListener("keydown", function (e) {
    if (ended || e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (phase === "title") {
      if (e.target && e.target.closest && e.target.closest("[data-start],[data-intro-skip]")) return; /* the focused button handles its own key */
      if (k === "Enter" || k === " ") { e.preventDefault(); start(true, "key"); }
      else if (k === "m" || k === "M") { e.preventDefault(); start(false, "key"); }
      else if (k === "Escape") { T("intro_skipped", { phase: phase }); done(true); }
    } else if (phase === "seat") {
      var i = rows.findIndex(function (r) { return r.classList.contains("is-on"); });
      if (KEYS[k]) { e.preventDefault(); choose(KEYS[k], "key"); }
      else if (k === "ArrowDown" || k === "ArrowRight") { e.preventDefault(); mark(Math.min(rows.length - 1, i + 1)); }
      else if (k === "ArrowUp" || k === "ArrowLeft") { e.preventDefault(); mark(Math.max(0, i - 1)); }
      else if (k === "Enter" || k === " ") { e.preventDefault(); choose(rows[Math.max(0, i)].getAttribute("data-role"), "key"); }
      else if (k === "Escape") { T("intro_skipped", { phase: phase }); done(true); }
    } else if (phase === "name") {
      if (k === "Escape") { e.preventDefault(); T("name_skipped", { role: role }); finishName(""); }
    }
  });

  /* ---------- a gamepad starts it too ---------- */
  addEventListener("gamepadconnected", function () {
    var prev = {};
    (function poll() {
      if (ended) return;
      var gp = (navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean)[0];
      if (gp) {
        var a = gp.buttons[0] && gp.buttons[0].pressed, dn = (gp.buttons[13] && gp.buttons[13].pressed) || gp.axes[1] > 0.5, up = (gp.buttons[12] && gp.buttons[12].pressed) || gp.axes[1] < -0.5;
        if (a && !prev.a) { if (phase === "title") start(true, "pad"); else if (phase === "seat") { var on = el.querySelector(".menu__row.is-on"); choose(on.getAttribute("data-role"), "pad"); } else if (phase === "name") finishName(""); }
        if (phase === "seat") { var i = rows.findIndex(function (r) { return r.classList.contains("is-on"); }); if (dn && !prev.dn) mark(Math.min(rows.length - 1, i + 1)); if (up && !prev.up) mark(Math.max(0, i - 1)); }
        prev = { a: a, dn: dn, up: up };
      }
      requestAnimationFrame(poll);
    })();
  });
})();
