/* The library: the home page played as a console home screen.

   Focus works like a fader. Moving focus to a title moves the ring, crossfades
   the key art to that title's plate, and (with the score on) brings the
   title's layer of the score in on the next bar. Rest on a title and its key
   art comes alive. Open makes the title its own page: Overview, Film, Demo,
   Trophies, Loadout. Every trophy is a verified fact; opening a career title
   for the first time awards its trophies, and opening all of them earns the
   Platinum. Nothing is hidden: every fact is also plain HTML in the page.

   window.JG_GAME.route(hash, how)   "#title/id" | "#trophies" | "#profile" | ""
   window.JG_GAME.seat(role, where)  interviewer | partner | lurker: reorders the library
   window.JG_GAME.focus(id)
   Events: document "jg:title" {id, open} */
(function () {
  "use strict";
  var root = document.documentElement;
  var main = document.getElementById("library"); if (!main) return;
  var dataEl = document.getElementById("library-data");
  var LIB = dataEl ? JSON.parse(dataEl.textContent) : null; if (!LIB) return;
  var RM = matchMedia("(prefers-reduced-motion: reduce)");
  var FINE = matchMedia("(hover: hover) and (pointer: fine)");
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  function T(e, p, s) { if (window.JG_TRACK) window.JG_TRACK(e, p, s); }
  function FX(k) { if (window.JG_FX) window.JG_FX(k); }
  function hap(k) { if (window.JG_HAPTIC) window.JG_HAPTIC(k); }
  function S() { return window.JG_SCORE; }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }

  var row = $(".shelf__row"), hudT = $("[data-hud-trophies]"), live = $("[data-live]"), clear = $("[data-clear]");
  var tiles = {}, arts = {}, plates = {};
  $$(".tile", row).forEach(function (t) { tiles[t.getAttribute("data-title")] = t; });
  $$("article.title").forEach(function (a) { arts[a.getAttribute("data-title")] = a; });
  $$("[data-plate]").forEach(function (p) { plates[p.getAttribute("data-plate")] = p; });
  var TITLES = {}; LIB.titles.forEach(function (t) { TITLES[t.id] = t; });
  var careers = LIB.titles.filter(function (t) { return t.career; }).map(function (t) { return t.id; });

  root.classList.add("lib-on");

  /* ---------- state ---------- */
  var order = LIB.titles.map(function (t) { return t.id; });
  var focusId = order[0], openId = null, screen = null, lastTileEl = null;
  var seen = {}; try { (JSON.parse(store.get("jg_trophies") || "[]")).forEach(function (s) { seen[s] = 1; }); } catch (e) {}
  var opened = {}; try { (JSON.parse(store.get("jg_opened") || "[]")).forEach(function (s) { opened[s] = 1; }); } catch (e) {}
  var platinum = store.get("jg_platinum") === "1";

  /* ---------- focus: ring, plate, hud, score ---------- */
  var liveT = null, restT = null;
  function announce(text) { clearTimeout(liveT); liveT = setTimeout(function () { if (live) live.textContent = text; }, 400); }
  function focus(id, how) {
    if (!tiles[id]) return;
    var changed = id !== focusId; focusId = id;
    Object.keys(tiles).forEach(function (k) {
      var on = k === id;
      tiles[k].classList.toggle("is-focus", on);
      tiles[k].setAttribute("tabindex", on ? "0" : "-1");
      if (on) tiles[k].setAttribute("aria-current", "true"); else tiles[k].removeAttribute("aria-current");
      if (arts[k]) arts[k].classList.toggle("is-focus", on);
      if (plates[k]) { plates[k].classList.toggle("is-on", on); if (!on) sleep(plates[k]); }
    });
    paintHud(id);
    if (S()) S().focus(id);
    if (changed && how && how !== "init") { announce(TITLES[id].logo + ". " + (TITLES[id].kind || "") + ". " + TITLES[id].line); if (S() && how !== "pointer") S().tick(); }
    clearTimeout(restT);
    if (!RM.matches && !(navigator.connection && navigator.connection.saveData)) restT = setTimeout(function () { wake(plates[id]); }, 3000);
    keepInView(tiles[id]);
    document.dispatchEvent(new CustomEvent("jg:title", { detail: { id: id, open: false } }));
  }
  function keepInView(t) {
    if (!t || !row) return;
    var r = t.getBoundingClientRect(), rr = row.getBoundingClientRect();
    if (r.left < rr.left + 8 || r.right > rr.right - 8) row.scrollTo({ left: t.offsetLeft - 16, behavior: RM.matches ? "auto" : "smooth" });
  }
  /* the living loop: a still plate wakes into its eight-second loop after you rest on it */
  function wake(p) {
    if (!p || openId) return;
    var v = $("video", p); if (!v) return;
    if (!v.getAttribute("src")) {
      var webm = v.getAttribute("data-webm"), mp4 = v.getAttribute("data-mp4");
      var src = (webm && v.canPlayType('video/webm; codecs="vp9"')) ? webm : mp4; if (!src) return;
      v.src = src;
      v.addEventListener("playing", function () { p.classList.add("is-live"); });
    }
    var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
  }
  function sleep(p) { var v = p && $("video", p); if (v && !v.paused) { v.pause(); } if (p) p.classList.remove("is-live"); }

  /* ---------- the trophies in this title, bottom right ---------- */
  function medal(slug, size) {
    var tr = LIB.trophies[slug];
    return '<img class="medal medal--' + tr.tier + '" src="assets/game/medals/' + slug + "-" + (size > 60 ? 160 : 80) + '.webp" alt="" width="' + size + '" height="' + size + '" loading="lazy" decoding="async" />';
  }
  function paintHud(id) {
    if (!hudT) return;
    var t = TITLES[id], list = t.trophies || [];
    if (!list.length) { hudT.innerHTML = '<p class="hud-trophies__h">Trophies</p><p class="hud-trophies__none">' + (id === "obavia" ? "No trophies yet. It isn't live." : "") + "</p>"; return; }
    hudT.innerHTML = '<p class="hud-trophies__h">Trophies in this title, ' + list.length + "</p><ul>" + list.slice(0, 3).map(function (s) {
      var tr = LIB.trophies[s];
      return '<li class="' + (seen[s] ? "is-seen" : "") + '">' + medal(s, 40) + "<span><b>" + E(tr.name) + "</b><small>" + tierWord(tr.tier) + "</small></span></li>";
    }).join("") + "</ul>";
  }
  function E(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function tierWord(t) { return { bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Platinum" }[t] || t; }

  /* ---------- open and close a title ---------- */
  var others = [$(".sys"), $(".shelf"), $(".hud-trophies"), $(".legend")].filter(Boolean);
  function setInert(on, keep) {
    others.concat($$("article.title"), $$("[data-screen]")).forEach(function (el) { if (el === keep) return; if (on) el.setAttribute("inert", ""); else el.removeAttribute("inert"); });
  }
  function open(id, how) {
    var a = arts[id]; if (!a) return;
    if (screen) closeScreen(true);
    if (openId && openId !== id) closeTitle(true);
    if (focusId !== id) focus(id, "open");
    openId = id; lastTileEl = tiles[id] || lastTileEl;
    var go = function () {
      a.classList.add("is-open"); root.classList.add("title-open");
      setInert(true, a); window.JG_LOCK && window.JG_LOCK(true);
      a.scrollTop = 0;
      var h = $(".title__logo", a); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
      sleep(plates[id]);
    };
    if (document.startViewTransition && !RM.matches) { a.style.viewTransitionName = "title-" + id; document.startViewTransition(go); } else go();
    if (location.hash !== "#title/" + id) { try { history.pushState({ t: id }, "", "#title/" + id); } catch (e) {} }
    hap("tap"); if (S()) S().sting("open");
    T("story_opened", { story: id, how: how || "" });
    document.dispatchEvent(new CustomEvent("jg:title", { detail: { id: id, open: true } }));
    if (!opened[id]) { opened[id] = 1; store.set("jg_opened", JSON.stringify(Object.keys(opened))); award(id); }
    paintProgress();
  }
  function closeTitle(quiet) {
    if (!openId) return;
    var a = arts[openId], id = openId; openId = null;
    var go = function () { a.classList.remove("is-open"); root.classList.remove("title-open"); setInert(false); window.JG_LOCK && window.JG_LOCK(false); };
    if (document.startViewTransition && !RM.matches && !quiet) document.startViewTransition(go); else go();
    setTimeout(function () { a.style.viewTransitionName = ""; }, 600);
    if (!quiet && (lastTileEl || tiles[id])) (lastTileEl || tiles[id]).focus({ preventScroll: true });
    if (!quiet && /^#title\//.test(location.hash)) { try { history.pushState({}, "", location.pathname + location.search); } catch (e) {} }
  }

  /* ---------- the trophies, profile and proof screens ---------- */
  var screens = {}; $$("[data-screen]").forEach(function (s) { screens[s.getAttribute("data-screen")] = s; });
  function openScreen(name, how) {
    var s = screens[name]; if (!s) return;
    if (openId) closeTitle(true);
    if (screen && screen !== name) closeScreen(true);
    screen = name;
    s.classList.add("is-open"); root.classList.add("screen-open");
    setInert(true, s); window.JG_LOCK && window.JG_LOCK(true);
    var h = $(".screen__h", s) || $("h2", s); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    s.scrollTop = 0;
    if (location.hash.indexOf("#" + name) !== 0) { try { history.pushState({ s: name }, "", "#" + name); } catch (e) {} }
    document.dispatchEvent(new CustomEvent("jg:screen", { detail: { name: name } }));
    FX("arrive");
    T(name === "trophies" ? "trophies_opened" : "screen_opened", { screen: name, how: how || "" });
    if (S()) S().focus(name === "profile" || name === "build" ? "profile" : "bed");
  }
  function closeScreen(quiet) {
    if (!screen) return;
    var s = screens[screen], was = screen; screen = null;
    document.dispatchEvent(new CustomEvent("jg:screen-closed", { detail: { name: was } }));
    s.classList.remove("is-open"); root.classList.remove("screen-open");
    setInert(false); window.JG_LOCK && window.JG_LOCK(false);
    if (S()) S().focus(focusId);
    if (!quiet) { if (tiles[focusId]) tiles[focusId].focus({ preventScroll: true }); if (/^#(trophies|profile|build)(\/.*)?$/.test(location.hash)) { try { history.pushState({}, "", location.pathname + location.search); } catch (e) {} } }
  }
  function back() {
    if (clear && !clear.hidden) { closeClear(); return true; }
    if (openId) { closeTitle(); return true; }
    if (screen) { closeScreen(); return true; }
    return false;
  }

  function route(h, how) {
    h = h || "";
    var m = h.match(/^#title\/([a-z0-9-]+)$/);
    if (m && arts[m[1]]) { open(m[1], how || "link"); return; }
    if (h === "#trophies" || h === "#profile") { openScreen(h.slice(1), how || "link"); return; }
    if (/^#build(\/.*)?$/.test(h) && screens.build) { if (window.JG_BUILD) window.JG_BUILD.load(h); openScreen("build", how || "link"); return; }
    var t = h.match(/^#title-([a-z0-9-]+)$/);
    if (t && arts[t[1]]) { open(t[1], how || "link"); return; }
    if (!h || h === "#" || h === "#library") { if (openId) closeTitle(true); if (screen) closeScreen(true); }
  }
  addEventListener("popstate", function () { route(location.hash, "back"); });

  /* ---------- trophies: awards, toasts, the Platinum ---------- */
  var queue = [], showing = false, tbox = $("[data-toasts]");
  function award(id) {
    var list = (TITLES[id].trophies || []).filter(function (s) { return !seen[s]; });
    if (!list.length) return;
    list.forEach(function (s) { seen[s] = 1; T("trophy_unlocked", { trophy: s, tier: LIB.trophies[s].tier, title: id }); });
    store.set("jg_trophies", JSON.stringify(Object.keys(seen)));
    document.dispatchEvent(new CustomEvent("jg:trophy", { detail: { title: id, list: list } }));
    var top = list.slice().sort(function (a, b) { return rank(LIB.trophies[b].tier) - rank(LIB.trophies[a].tier); })[0];
    queue.push({ slug: top, more: list.length - 1 });
    pump();
    paintSeen(); paintHud(focusId);
    if (!platinum && careers.every(function (c) { return opened[c]; })) {
      platinum = true; store.set("jg_platinum", "1"); seen[LIB.platinum] = 1; store.set("jg_trophies", JSON.stringify(Object.keys(seen)));
      setTimeout(levelClear, 2600); paintSeen();
    }
  }
  function rank(t) { return { bronze: 1, silver: 2, gold: 3, platinum: 4 }[t] || 0; }
  function pump() {
    if (showing || !queue.length || !tbox) return;
    showing = true;
    var q = queue.shift(), tr = LIB.trophies[q.slug];
    var el = document.createElement("div"); el.className = "toast toast--trophy toast--" + tr.tier;
    el.innerHTML = '<span class="toast__medal">' + medal(q.slug, 52) + '<img class="toast__sheen" src="assets/game/medals/sheen.webp" alt="" /></span><span class="toast__txt"><p class="toast__t">' + E(tr.name) + "<small>" + tierWord(tr.tier) + ' trophy</small></p><p class="toast__s">' + E(tr.desc) + (q.more > 0 ? " And " + q.more + " more in this title." : "") + "</p></span>";
    tbox.appendChild(el);
    if (live) live.textContent = tierWord(tr.tier) + " trophy. " + tr.name + ". " + tr.desc;
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("is-on"); }); });
    hap("success"); if (S()) S().sting("trophy-" + tr.tier);
    setTimeout(function () { el.classList.remove("is-on"); setTimeout(function () { el.remove(); showing = false; setTimeout(pump, 2400 - 600); }, 600); }, 4200);
  }
  function paintSeen() {
    var n = Object.keys(seen).filter(function (s) { return LIB.trophies[s]; }).length;
    $$("[data-trophy-seen]").forEach(function (e) { e.textContent = n; });
    $$("[data-trophy]").forEach(function (li) { li.classList.toggle("is-seen", !!seen[li.getAttribute("data-trophy")]); });
  }
  function paintProgress() {
    var n = careers.filter(function (c) { return opened[c]; }).length;
    $$("[data-library-count]").forEach(function (e) { e.textContent = n + " of " + careers.length; });
  }
  function levelClear() {
    if (!clear) return;
    var tr = LIB.trophies[LIB.platinum];
    clear.innerHTML = '<div class="clear__card" role="dialog" aria-modal="true" aria-labelledby="clear-h"><span class="clear__medal">' + medal(LIB.platinum, 160) + '<img class="toast__sheen" src="assets/game/medals/sheen.webp" alt="" /></span><p class="clear__k">Platinum trophy</p><h2 class="clear__h" id="clear-h" tabindex="-1">' + E(tr.name) + '</h2><p class="clear__s">' + E(tr.desc) + '</p><img class="clear__portrait" src="assets/game/portrait/jason-engraved-1024.png" alt="Engraved portrait of Jason Obawemimo" width="220" height="220" loading="lazy" /><div class="clear__acts"><a class="btn btn--primary" href="' + E(LIB.pdf) + '" data-resume="pdf" data-where="platinum" download="Jason Obawemimo - Resume.pdf"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-doc"/></svg>Resume PDF</a><a class="btn" href="mailto:' + E(LIB.email) + '?subject=Your%20site%2C%20and%20a%20role" data-contact="email" data-where="platinum">Email me</a><button class="btn btn--ghost" type="button" data-clear-close>Back to the library</button></div></div>';
    clear.hidden = false; root.classList.add("clear-on");
    requestAnimationFrame(function () { requestAnimationFrame(function () { clear.classList.add("is-on"); }); });
    var h = $("#clear-h", clear); if (h) h.focus({ preventScroll: true });
    hap("success"); if (S()) S().sting("level-clear");
    T("level_clear", { trophy: LIB.platinum });
  }
  function closeClear() { clear.classList.remove("is-on"); root.classList.remove("clear-on"); setTimeout(function () { clear.hidden = true; clear.innerHTML = ""; }, 500); if (tiles[focusId]) tiles[focusId].focus({ preventScroll: true }); }
  if (clear) clear.addEventListener("click", function (e) { if (e.target.closest("[data-clear-close]") || e.target === clear) closeClear(); });

  /* ---------- seats: who's playing reorders the library ---------- */
  /* a seat or a build reorders the shelf: tiles glide to their new places */
  function arrange(list, to, how) {
    list = (list || []).filter(function (id) { return tiles[id]; });
    Object.keys(tiles).forEach(function (id) { if (list.indexOf(id) < 0) list.push(id); });
    var first = {}; Object.keys(tiles).forEach(function (k) { first[k] = tiles[k].getBoundingClientRect(); });
    list.forEach(function (id) { row.appendChild(tiles[id].parentNode); });
    order = list.slice();
    if (!RM.matches) Object.keys(tiles).forEach(function (k) {
      var b = tiles[k].getBoundingClientRect(), dx = first[k].left - b.left;
      if (!dx) return;
      tiles[k].style.transition = "none"; tiles[k].style.transform = "translateX(" + dx + "px)";
      requestAnimationFrame(function () { requestAnimationFrame(function () { tiles[k].style.transition = ""; tiles[k].style.transform = ""; }); });
    });
    if (to && tiles[to] && !openId) focus(to, how || "seat");
    if (to && tiles[to]) row.scrollTo({ left: Math.max(0, tiles[to].parentNode.offsetLeft - 16), behavior: "auto" });
  }
  function seat(role, where) {
    var s = LIB.seats[role]; if (!s) return;
    store.set("jg_role", role);
    arrange(s.order, s.focus, "seat");
    $$("[data-seat-label]").forEach(function (e) { e.textContent = s.label; });
    if (where && where !== "init") T("role_chosen", { role: role, where: where }, { role: role });
  }

  /* ---------- input: pointer and touch ---------- */
  var hoverT = null;
  row.addEventListener("pointerover", function (e) {
    var t = e.target.closest(".tile"); if (!t || !FINE.matches || openId || screen) return;
    clearTimeout(hoverT); hoverT = setTimeout(function () { focus(t.getAttribute("data-title"), "pointer"); }, 250);
  });
  row.addEventListener("pointerout", function () { clearTimeout(hoverT); });
  row.addEventListener("click", function (e) {
    var t = e.target.closest(".tile"); if (!t) return;
    e.preventDefault();
    var id = t.getAttribute("data-title");
    if (id !== focusId) { focus(id, "tap"); FX("key"); return; }
    open(id, "tile");
  });
  document.addEventListener("click", function (e) {
    var o = e.target.closest && e.target.closest("[data-open-title]"); if (o) { e.preventDefault(); open(o.getAttribute("data-open-title"), "button"); return; }
    var r = e.target.closest && e.target.closest("[data-route]"); if (r) { e.preventDefault(); openScreen(r.getAttribute("data-route"), "link"); return; }
    var b = e.target.closest && e.target.closest("[data-back]"); if (b) { e.preventDefault(); back(); return; }
    var tab = e.target.closest && e.target.closest(".tabs a"); if (tab) { e.preventDefault(); goTab(tab); }
  });
  /* swipe down on a phone closes an open title from its top */
  var sy = 0, sx = 0;
  main.addEventListener("touchstart", function (e) { if (!openId) return; sy = e.touches[0].clientY; sx = e.touches[0].clientX; }, { passive: true });
  main.addEventListener("touchend", function (e) {
    if (!openId) return; var body = arts[openId];
    var dy = e.changedTouches[0].clientY - sy, dx = Math.abs(e.changedTouches[0].clientX - sx);
    if (dy > 110 && dx < 60 && body && body.scrollTop < 4) closeTitle();
  }, { passive: true });

  /* ---------- sections inside a title ---------- */
  function tabsOf(a) { return $$(".tabs a", a); }
  function goTab(tab) {
    var a = tab.closest("article.title"), id = tab.getAttribute("href").slice(1), sec = document.getElementById(id); if (!sec) return;
    a.scrollTo({ top: sec.offsetTop - 84, behavior: RM.matches ? "auto" : "smooth" });
    tabsOf(a).forEach(function (x) { x.classList.toggle("is-on", x === tab); if (x === tab) x.setAttribute("aria-current", "true"); else x.removeAttribute("aria-current"); });
    FX("key");
  }
  function stepTab(d) {
    if (!openId) return;
    var ts = tabsOf(arts[openId]); if (!ts.length) return;
    var i = ts.findIndex(function (x) { return x.classList.contains("is-on"); }); if (i < 0) i = 0;
    goTab(ts[(i + d + ts.length) % ts.length]);
  }
  $$("article.title").forEach(function (a) {
    var body = a, ts = tabsOf(a); if (!ts.length) return;
    ts[0].classList.add("is-on");
    var ticking = false;
    body.addEventListener("scroll", function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        ticking = false; var y = body.scrollTop + 120, cur = ts[0];
        ts.forEach(function (x) { var s = document.getElementById(x.getAttribute("href").slice(1)); if (s && s.offsetTop <= y) cur = x; });
        ts.forEach(function (x) { x.classList.toggle("is-on", x === cur); });
      });
    }, { passive: true });
  });

  /* ---------- input: keys ---------- */
  function ix() { return order.indexOf(focusId); }
  function move(d, how) { var i = Math.max(0, Math.min(order.length - 1, ix() + d)); if (order[i] !== focusId) { focus(order[i], how || "key"); var t = tiles[order[i]]; if (t && document.activeElement && document.activeElement.classList.contains("tile")) t.focus({ preventScroll: true }); } }
  addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (root.classList.contains("intro-on") || document.querySelector("dialog[open]")) return;
    var t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    var k = e.key;
    if (k === "Escape" || (k === "Backspace" && (openId || screen))) { if (back()) e.preventDefault(); return; }
    if (clear && !clear.hidden) return;
    if (openId) {
      if (k === "q" || k === "Q" || k === "[") { e.preventDefault(); stepTab(-1); }
      else if (k === "e" || k === "E" || k === "]") { e.preventDefault(); stepTab(1); }
      return;
    }
    if (screen) return;
    var onTile = t && t.classList && t.classList.contains("tile");
    var inActs = t && t.closest && t.closest(".title__acts");
    if (k === "ArrowRight" && !inActs) { e.preventDefault(); move(1); }
    else if (k === "ArrowLeft" && !inActs) { e.preventDefault(); move(-1); }
    else if (k === "ArrowDown" && (onTile || t === document.body)) { var b = $(".title__acts .btn", arts[focusId]); if (b) { e.preventDefault(); b.focus(); } }
    else if (k === "ArrowUp" && inActs) { e.preventDefault(); tiles[focusId].focus({ preventScroll: true }); }
    else if ((k === "ArrowRight" || k === "ArrowLeft") && inActs) { var bs = $$(".title__acts .btn", arts[focusId]), j = bs.indexOf(document.activeElement); if (j >= 0) { e.preventDefault(); var n = bs[Math.max(0, Math.min(bs.length - 1, j + (k === "ArrowRight" ? 1 : -1)))]; n.focus(); } }
    else if ((k === "Enter" || k === " ") && (onTile || t === document.body)) { e.preventDefault(); open(focusId, "key"); }
    else if (k === "Home") { e.preventDefault(); focus(order[0], "key"); }
    else if (k === "End") { e.preventDefault(); focus(order[order.length - 1], "key"); }
    else if (k === "t" || k === "T") { e.preventDefault(); openScreen("trophies", "key"); }
    else if (k === "p" || k === "P") { e.preventDefault(); openScreen("profile", "key"); }
    else if ((k === "j" || k === "J") && screens.build) { e.preventDefault(); openScreen("build", "key"); }
  });

  /* ---------- input: gamepad, polled only while one is connected ---------- */
  var pads = 0, prev = {}, rep = { d: 0, at: 0 };
  addEventListener("gamepadconnected", function () { if (pads++ === 0) { root.classList.add("pad"); requestAnimationFrame(poll); } });
  addEventListener("gamepaddisconnected", function () { pads = Math.max(0, pads - 1); if (!pads) root.classList.remove("pad"); });
  function pressed(gp, i) { var b = gp.buttons[i]; return !!(b && (b.pressed || b.value > 0.5)); }
  function poll(ts) {
    if (!pads) return;
    var gp = (navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean)[0];
    if (gp && !root.classList.contains("intro-on") && !document.querySelector("dialog[open]")) {
      var x = gp.axes[0] || 0, d = (pressed(gp, 15) || x > 0.35) ? 1 : (pressed(gp, 14) || x < -0.35) ? -1 : 0;
      if (d && !openId && !screen) {
        if (rep.d !== d) { rep.d = d; rep.at = ts + 380; move(d, "pad"); }
        else if (ts >= rep.at) { rep.at = ts + 120; move(d, "pad"); }
      } else if (!d) rep.d = 0;
      var edge = function (i) { var p = pressed(gp, i), was = prev[i]; prev[i] = p; return p && !was; };
      if (edge(0)) { if (clear && !clear.hidden) closeClear(); else if (!openId && !screen) open(focusId, "pad"); }
      if (edge(1)) back();
      if (edge(4)) stepTab(-1);
      if (edge(5)) stepTab(1);
      if (edge(3) && !openId) openScreen("trophies", "pad");
      if (edge(9)) { if (window.JG_OPEN) window.JG_OPEN("help", "pad"); }
    }
    requestAnimationFrame(poll);
  }

  /* ---------- start ---------- */
  var role = store.get("jg_role");
  if (role && LIB.seats[role]) seat(role, "init"); else focus(focusId, "init");
  paintSeen(); paintProgress();
  document.addEventListener("jg:intro-done", function (e) {
    var r = (e.detail && e.detail.role) || store.get("jg_role");
    if (r && LIB.seats[r]) seat(r, "init");
    root.classList.add("lib-in");
  });
  if (!root.classList.contains("intro-pending")) root.classList.add("lib-in");
  RM.addEventListener && RM.addEventListener("change", function () { if (RM.matches) Object.keys(plates).forEach(function (k) { sleep(plates[k]); }); });

  window.JG_GAME = { route: route, seat: seat, arrange: arrange, screen: openScreen, focus: function (id) { focus(id, "api"); }, open: open, back: back };
})();
