/* The title screen. Every visitor sees it on every arrival from outside the
   site, on the home page and /obavia.html; clicks between the site's own pages
   and crawlers go straight to the page, which is complete without it.

   Press start (with the score) or Start muted; then who's playing (a game
   menu, keys 1 to 3); on the home page, the build: the role they're hiring
   for, the problem on their lot, or a class (build.js keeps it); then an
   optional player name that signs it; then the card and the library. Every
   skip is silent. A ?for=<build> link (from an application) highlights that
   role first. Someone hiring can paste the listing (the unnumbered row at the
   top) and build the role it matches. On the card, the funnel: someone hiring
   who built a role gets Resume for this role and one fine line saying what
   I'm open to; a dealer gets the lot's own next step (a call, or Obavia early
   access) and no availability; someone just looking gets nothing but the
   card (the seat promised no pitch; Player 2 carries a referral). Its words
   live in tools/site/onboarding.json, inlined as #onboarding-data.
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
  var BD = null; try { BD = JSON.parse(document.getElementById("builds-data").textContent); } catch (e) {}
  var W = O.build || null; if (!W) BD = null;
  var FOR = null;
  (function () {
    var m = location.search.match(/[?&]for=([a-z-]+)/); if (!m) return;
    if (BD && BD.builds.some(function (b) { return b.id === m[1]; })) { FOR = m[1]; store.set("jg_for", m[1]); }
    try { var u = new URL(location.href); u.searchParams.delete("for"); history.replaceState(null, "", u.pathname + u.search + u.hash); } catch (e) {}
  })();
  if (/^#build\/v1\//.test(location.hash)) BD = null; /* a shared build opens after the title screen; no need to build one first */

  if (/[?&]intro=1/.test(location.search)) { try { var u = new URL(location.href); u.searchParams.delete("intro"); history.replaceState(null, "", u.pathname + u.search + u.hash); } catch (e) {} }
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  scrollTo(0, 0);

  /* ---------- the title screen, mounted before anything else loads ---------- */
  var t = O.title, mob = innerWidth < 760;
  /* a title's art files go by its stem (O.arts, from library.json "art"): a regraded plate ships under a new name */
  var art = body.getAttribute("data-intro-art") || O.art || "assets/game/art/" + ((O.arts && O.arts["triple-j"]) || "triple-j");
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
    (BD ? '<section class="intro__scene intro__scene--build" data-scene="build" hidden>' +
      '<div class="cls"><div class="cls__menu">' +
        '<h2 class="intro__h" data-build-h></h2><p class="intro__sub" data-build-sub></p>' +
        '<ol class="menu menu--cls" role="listbox" data-build-menu></ol>' +
        '<p class="intro__fine">' + E(COARSE ? W.fine_touch : W.fine_pointer) + ' <button class="intro__textbtn" type="button" data-build-skip>' + E(W.skip) + "</button></p>" +
      '</div><aside class="cls__preview" data-build-preview aria-live="polite"></aside></div>' +
    "</section>" : "") +
    '<section class="intro__scene intro__scene--name" data-scene="name" hidden>' +
      '<h2 class="intro__h" data-name-h>' + E(O.name.title) + "</h2>" +
      '<form class="intro__form" data-name-form autocomplete="off">' +
        '<label class="vh" for="intro-name">' + E(O.name.title) + "</label>" +
        '<input id="intro-name" name="name" type="text" maxlength="40" spellcheck="false" autocapitalize="words" enterkeyhint="go" placeholder="' + E(O.name.placeholder) + '" />' +
        '<div class="intro__acts"><button class="btn btn--primary" type="submit">' + E(O.name.continue) + '</button><button class="btn btn--ghost" type="button" data-name-skip>' + E(O.name.skip) + "</button></div>" +
      "</form>" +
      '<p class="intro__fine" data-name-fine>' + E(O.name.fine) + "</p>" +
    "</section>" +
    '<section class="intro__scene intro__scene--card" data-scene="card" hidden aria-live="polite">' +
      '<p class="intro__card"></p>' +
      '<div class="intro__built" data-built hidden><div class="intro__cardwrap" data-built-card></div><div class="intro__built-side"><p class="intro__card intro__card--sm" data-built-hi></p><p class="intro__fine">' + E(O.card.edit || "") + '</p><div class="intro__acts" data-built-acts><button class="btn btn--primary" type="button" data-enter>' + E(O.card.enter || "Enter the library") + '</button><button class="btn" type="button" data-save-card><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-share"/></svg>' + E(O.card.save || "Save the card") + '</button></div><p class="intro__fine intro__open" data-built-more hidden></p></div></div>' +
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
    var f = name === "seat" ? el.querySelector(".menu__row.is-on") : name === "build" ? el.querySelector("[data-build-menu] .menu__row.is-on") : name === "name" ? el.querySelector("#intro-name") : name === "card" ? el.querySelector("[data-built]:not([hidden]) [data-enter]") : null;
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
    setTimeout(function () { if (BD && window.JG_BUILD) { buildScene(id); scene("build"); } else toName(); }, wait(420));
  }
  function toName() {
    var h = el.querySelector("[data-name-h]"), fi = el.querySelector("[data-name-fine]");
    if (built) { h.textContent = O.name.title_build || O.name.title; fi.textContent = O.name.fine_build || O.name.fine; }
    scene("name"); var inp = el.querySelector("#intro-name"); var prior = store.get("jg_name"); if (prior && inp) inp.value = prior;
  }

  /* ---------- the build: what they're hiring for, what's slowing their lot, or a class ---------- */
  var built = null, bitems = [], brows = [], spinning = false, armed = false;
  /* a mouse resting where the menu draws shouldn't pick for you: hover counts once it moves */
  el.addEventListener("pointermove", function (e) { if (phase === "build" && (e.movementX || e.movementY)) armed = true; });
  function bTitle(it) { return it.kind === "role" ? BD.builds.filter(function (b) { return b.id === it.id; })[0].titles[0] : BD.lot.filter(function (l) { return l.id === it.id; })[0].titles[0]; }
  function buildScene(seatId) {
    var w = W[seatId] || W.interviewer;
    el.querySelector("[data-build-h]").textContent = w.title;
    el.querySelector("[data-build-sub]").textContent = w.sub;
    bitems = seatId === "partner" ? BD.lot.map(function (l, i) { return { kind: "lot", id: l.id, h: l.label, p: "", n: String(i + 1) }; })
      : BD.builds.map(function (b, i) { return { kind: "role", id: b.id, h: b.label, p: b.targets.slice(0, 3).join(", "), n: String(i + 1) }; });
    /* the extra row carries an icon, not a number: keys 1 to 9 are the readings */
    if (seatId === "lurker") bitems.push({ kind: "spin", id: "spin", h: w.surprise, p: w.surprise_p, icon: "g-move" });
    /* someone hiring meets the listing first: it is the most tailored way in */
    if (seatId === "interviewer" && window.JG_MATCH) bitems.unshift({ kind: "paste", id: "paste", h: W.paste, p: W.paste_p, icon: "g-doc" });
    armed = false;
    var start = Math.max(0, bitems.findIndex(function (it) { return it.n; }));
    if (FOR) bitems.forEach(function (it, i) { if (it.kind === "role" && it.id === FOR) start = i; });
    var menu = el.querySelector("[data-build-menu]");
    menu.setAttribute("aria-label", w.title);
    menu.innerHTML = bitems.map(function (it, i) {
      var badge = it.icon ? '<span class="menu__n menu__n--icon" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#' + it.icon + '"/></svg></span>' : '<span class="menu__n" aria-hidden="true">' + it.n + "</span>";
      return '<li><button class="menu__row' + (i === start ? " is-on" : "") + (it.icon ? " menu__row--alt" : "") + '" type="button" role="option" aria-selected="' + (i === start) + '" data-i="' + i + '" data-id="' + it.id + '"' + (it.n ? ' data-n="' + it.n + '"' : "") + ">" + badge + '<span class="menu__txt"><b>' + E(it.h) + "</b>" + (it.p ? "<small>" + E(it.p) + "</small>" : "") + "</span></button></li>";
    }).join("");
    brows = [].slice.call(menu.querySelectorAll(".menu__row"));
    brows.forEach(function (r) {
      r.addEventListener("click", function () { pick(+r.getAttribute("data-i"), "tap"); });
      r.addEventListener("pointerenter", function () { if (!COARSE && !spinning && armed) bmark(+r.getAttribute("data-i"), true); });
    });
    preview(start);
    T("build_shown", { seat: seatId });
  }
  function bmark(i, quiet) {
    brows.forEach(function (r, j) { r.classList.toggle("is-on", j === i); r.setAttribute("aria-selected", j === i ? "true" : "false"); });
    if (!quiet) brows[i].focus({ preventScroll: true });
    preview(i);
    if (S() && !spinning) S().tick();
  }
  var artNow = "";
  function preview(i) {
    var it = bitems[i], pv = el.querySelector("[data-build-preview]"); if (!it || !pv) return;
    pv.classList.toggle("is-paste", it.kind === "paste"); pv.classList.remove("is-matched");
    if (it.kind === "paste") { pv.innerHTML = '<form class="cls__paste" data-paste><label class="cls__k" for="intro-list">' + E(W.paste_h) + '</label><textarea id="intro-list" rows="7"></textarea><p class="intro__fine">' + E(W.paste_fine) + '</p><button class="btn btn--sm" type="submit">' + E(W.match) + "</button></form>"; return; }
    if (it.kind === "spin") { pv.innerHTML = ""; return; }
    var src = it.kind === "role" ? BD.builds.filter(function (b) { return b.id === it.id; })[0] : BD.lot.filter(function (l) { return l.id === it.id; })[0];
    var proofs = src.proofs.slice(0, BD.equip);
    pv.innerHTML = '<h3 class="cls__name">' + E(src.label) + '</h3><p class="cls__line">' + E(it.kind === "lot" ? src.line : src.headline) + '</p><ul class="cls__proofs">' + proofs.map(function (x) { var p = BD.proofs[x]; return '<li><img class="bcard__medal" src="assets/game/medals/' + p.medal + '-80.webp" data-tier="' + p.tier + '" alt="" width="44" height="44" /><span>' + E(p.short) + "</span></li>"; }).join("") + "</ul>" + (it.kind === "role" ? '<p class="cls__for">Written for ' + E(src.targets.join(", ")) + ".</p>" : "");
    showArt(bTitle(it));
  }
  function showArt(id) {
    if (!id || id === artNow) return; artNow = id;
    if (S()) S().focus(id);
    var box = el.querySelector(".intro__art"), im = document.createElement("img");
    im.className = "is-next"; im.alt = ""; im.decoding = "async";
    im.onload = function () { requestAnimationFrame(function () { im.classList.add("is-on"); }); setTimeout(function () { var all = box.querySelectorAll("img"); for (var k = 0; k < all.length - 1; k++) all[k].remove(); }, 1000); };
    im.src = "assets/game/art/" + ((O.arts && O.arts[id]) || id) + (mob ? "-m.webp" : "-1920.webp");
    box.appendChild(im);
  }
  function pick(i, how) {
    if (phase !== "build" || spinning) return;
    var it = bitems[i]; if (!it) return;
    if (it.kind === "paste") { bmark(i, true); var ta = el.querySelector("#intro-list"); if (ta) ta.focus(); return; }
    if (it.kind === "spin") { spin(); return; }
    brows[i].classList.add("is-picked");
    built = window.JG_BUILD.make(it.kind, it.id, how);
    if (pendingMatch && window.JG_BUILD.setMatch) window.JG_BUILD.setMatch(pendingMatch);
    if (window.JG_FX) window.JG_FX("choice");
    setTimeout(toName, wait(420));
  }
  function spin() {
    spinning = true; if (window.JG_FX) window.JG_FX("choice");
    var idx = bitems.map(function (it, i) { return it.kind === "role" ? i : -1; }).filter(function (i) { return i >= 0; });
    var n = idx.length, land = Math.floor(Math.random() * n), steps = n * 2 + land, k = 0, cur = 0;
    (function step() {
      cur = idx[k % n]; brows.forEach(function (r, j) { r.classList.toggle("is-on", j === cur); });
      if (S()) S().tick();
      if (k++ < steps) { setTimeout(step, RM ? 0 : 60 + Math.pow(k / steps, 3) * 260); return; }
      spinning = false; preview(cur); setTimeout(function () { pick(cur, "spin"); }, wait(650));
    })();
  }
  var pendingMatch = null;
  el.addEventListener("submit", function (e) {
    if (!e.target.hasAttribute("data-paste")) return; e.preventDefault();
    var text = (el.querySelector("#intro-list") || {}).value || ""; if (!text.trim() || !window.JG_MATCH) return;
    var m = window.JG_MATCH.read(text); if (!m) return;
    pendingMatch = m;
    T("listing_matched", { build: m.build || "", on: m.on.length, off: m.off.length, where: "intro" });
    var pv = el.querySelector("[data-build-preview]");
    if (!m.on.length || !m.build) { pv.querySelector(".intro__fine").textContent = W.none; return; }
    var i = bitems.findIndex(function (it) { return it.kind === "role" && it.id === m.build; });
    if (window.JG_FX) window.JG_FX("arrive");
    bmark(i, true);
    pv.insertAdjacentHTML("beforeend", '<p class="cls__k">' + E(W.on) + '</p><ul class="cls__chips">' + m.on.slice(0, 12).map(function (x) { return "<li>" + E(x.as || x.term) + "</li>"; }).join("") + "</ul>" + (m.off.length ? '<p class="cls__k">' + E(W.off) + '</p><ul class="cls__chips cls__chips--off">' + m.off.slice(0, 8).map(function (x) { return "<li>" + E(x.as || x.term) + "</li>"; }).join("") + "</ul>" : "") + '<button class="btn btn--primary" type="button" data-go-build>' + E(W.go) + "</button>");
    /* a phone hides the preview under the menu; the match result stays on screen, above it */
    pv.classList.add("is-matched");
    var go = pv.querySelector("[data-go-build]");
    if (go) {
      go.addEventListener("click", function () { pick(i, "listing"); });
      go.focus({ preventScroll: true });
      /* again once a phone's keyboard has folded away and the screen has its height back */
      var center = function () { go.scrollIntoView({ block: "center", behavior: RM ? "auto" : "smooth" }); };
      center(); if (COARSE) setTimeout(center, 350);
    }
  });
  function skipBuild() { if (phase !== "build") return; T("build_skipped", {}); toName(); }
  if (BD) el.querySelector("[data-build-skip]").addEventListener("click", skipBuild);
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
    if (built && window.JG_BUILD) built = window.JG_BUILD.sign(name) || built;
    if (window.JG_FX) window.JG_FX("send");
    T("name_given", { role: role, name: name }, { name: name, role: role });
    finishName(name);
  });
  el.querySelector("[data-name-skip]").addEventListener("click", function () { T("name_skipped", { role: role }); finishName(""); });
  function finishName(name) {
    if (phase !== "name") return;
    var first = name.split(" ")[0];
    var line = first ? (back ? O.card.returning + " " + first + "." : O.card.named + " " + first + ".") : O.card.anonymous;
    if (built && window.JG_BUILD) {
      el.querySelector(".intro__card").hidden = true;
      var box = el.querySelector("[data-built]"); box.hidden = false;
      el.querySelector("[data-built-hi]").textContent = line;
      var cw = el.querySelector("[data-built-card]"); cw.innerHTML = window.JG_BUILD.cardHTML(built); cw.classList.add("is-minting");
      funnel();
      scene("card");
      if (S()) setTimeout(function () { S().sting("trophy-gold"); }, wait(500));
      if (window.JG_HAPTIC) setTimeout(function () { window.JG_HAPTIC("success"); }, wait(500));
      return;
    }
    el.querySelector(".intro__card").textContent = line;
    scene("card");
    setTimeout(done, wait(1500));
  }
  /* the funnel on the card: never on the card itself, only beside it. Someone
     just looking gets nothing here: the seat they picked promised no pitch */
  function funnel() {
    var F = O.funnel || {}, more = el.querySelector("[data-built-more]"), B = window.JG_BUILD;
    if (!more || !built || role === "lurker") return;
    var next = built.kind === "role" ? (B.resume ? B.resume(built, "btn") : "") : (B.lotCta ? B.lotCta(built, "btn", "intro") : "");
    if (next) { el.querySelector("[data-enter]").insertAdjacentHTML("afterend", next); el.querySelector("[data-built]").classList.add("has-cta"); }
    /* the availability line is for someone hiring on a role reading; a dealer's next step is the lot's */
    if (built.kind === "role" && next && F.open) { more.textContent = F.open; more.hidden = false; }
  }
  el.addEventListener("click", function (e) {
    if (e.target.closest("[data-enter]")) { if (window.JG_FX) window.JG_FX("arrive"); done(); }
    else if (e.target.closest("[data-save-card]") && window.JG_BUILD) window.JG_BUILD.save(built, "intro");
    else if (e.target.closest("[data-build-resume]")) { if (window.JG_FX) window.JG_FX("send"); T("build_resume", { build: built ? built.id : "", matched: !!pendingMatch, viewing: false, where: "intro" }); }
    else if (e.target.closest("[data-build-obavia]")) { if (built && window.JG_BUILD) store.set("jg_lot", window.JG_BUILD.label(built)); if (window.JG_FX) window.JG_FX("send"); T("cta_click", { cta: "obavia_early", where: "intro", lot: built ? built.id : "" }); }
  });

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
      document.dispatchEvent(new CustomEvent("jg:intro-done", { detail: { role: skipped ? store.get("jg_role") : role, named: named, build: built ? built.id : "" } }));
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
    } else if (phase === "build") {
      if (e.target && e.target.closest && e.target.closest("textarea,input")) return;
      var bi = brows.findIndex(function (r) { return r.classList.contains("is-on"); });
      var ni = /^[1-9]$/.test(k) ? bitems.findIndex(function (it) { return it.n === k; }) : -1;
      if (ni >= 0) { e.preventDefault(); bmark(ni, true); pick(ni, "key"); }
      else if (k === "ArrowDown" || k === "ArrowRight") { e.preventDefault(); bmark(Math.min(brows.length - 1, bi + 1)); }
      else if (k === "ArrowUp" || k === "ArrowLeft") { e.preventDefault(); bmark(Math.max(0, bi - 1)); }
      else if (k === "Enter" || k === " ") { if (e.target && e.target.closest && e.target.closest("[data-go-build],[data-build-skip]")) return; e.preventDefault(); pick(Math.max(0, bi), "key"); }
      else if (k === "Escape") { e.preventDefault(); skipBuild(); }
    } else if (phase === "name") {
      if (k === "Escape") { e.preventDefault(); T("name_skipped", { role: role }); finishName(""); }
    } else if (phase === "card" && built) {
      if (k === "Escape") { e.preventDefault(); done(); }
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
        if (a && !prev.a) { if (phase === "title") start(true, "pad"); else if (phase === "seat") { var on = el.querySelector(".menu__row.is-on"); choose(on.getAttribute("data-role"), "pad"); } else if (phase === "build") { pick(Math.max(0, brows.findIndex(function (r) { return r.classList.contains("is-on"); })), "pad"); } else if (phase === "name") finishName(""); else if (phase === "card") done(); }
        if (phase === "seat") { var i = rows.findIndex(function (r) { return r.classList.contains("is-on"); }); if (dn && !prev.dn) mark(Math.min(rows.length - 1, i + 1)); if (up && !prev.up) mark(Math.max(0, i - 1)); }
        if (phase === "build") { var j = brows.findIndex(function (r) { return r.classList.contains("is-on"); }); if (dn && !prev.dn) bmark(Math.min(brows.length - 1, j + 1)); if (up && !prev.up) bmark(Math.max(0, j - 1)); }
        prev = { a: a, dn: dn, up: up };
      }
      requestAnimationFrame(poll);
    })();
  });
})();
