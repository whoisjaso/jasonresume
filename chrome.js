/* The chrome: the bar, the dock, the menu, the toggles, the cut, keys, dialogs,
   and the one feedback function every scene uses.

   window.JG_FX(kind)      "choice" | "arrive" | "send" | "unlock" | "flip" | "key"
                           fires sound and haptic in the same frame; skips and
                           cancels never call it, so they stay silent
   window.JG_CUT(fn)       a hard cut through black: fn runs while the frame is black
   window.JG_LOCK(on)      the iOS-safe screen lock for surfaces over the page
   window.JG_TOAST(text)   a short status line
   window.JG_OPEN(what)    open an overlay by name (deck, verify, trailer, rig, cues, help)
   Events: document "jg:open" {what, where}, "jg:commentary" {on}, "jg:still" {on} */
(function () {
  "use strict";
  var root = document.documentElement, body = document.body;
  var RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  function T(e, p) { if (window.JG_TRACK) window.JG_TRACK(e, p); }
  function sfx(n, o) { return window.JG_SFX ? window.JG_SFX.play(n, o) : false; }
  function hap(k) { if (window.JG_HAPTIC) window.JG_HAPTIC(k); }

  /* ---------- feedback ---------- */
  var FX = {
    choice: function () { sfx("select", { gain: 0.8 }); hap("tap"); },
    arrive: function () { sfx("open", { gain: 0.7 }); hap("tap"); },
    send: function () { sfx("chime", { gain: 1 }); hap("select"); },
    unlock: function () { sfx("sparkle", { gain: 0.8 }); hap("success"); },
    flip: function () { sfx("swoosh", { gain: 0.5, rate: 1.08 }); hap("tap"); },
    key: function () { sfx("key", { gain: 0.5, throttle: 45 }); },
    cut: function () { sfx("swoosh-deep", { gain: 0.35, throttle: 900 }); }
  };
  window.JG_FX = function (kind) { var f = FX[kind]; if (f) f(); };

  /* ---------- toggles: sound, still, commentary ---------- */
  var muted = store.get("jg_muted") === "1";
  var still = store.get("jg_still") === "1" || RM;
  var commentary = store.get("jg_commentary") === "1";
  if (still) root.setAttribute("data-still", "");
  function paint() {
    document.querySelectorAll('[data-toggle="sound"]').forEach(function (b) { b.setAttribute("aria-pressed", muted ? "false" : "true"); b.textContent = muted ? "Sound off" : "Sound on"; });
    document.querySelectorAll('[data-toggle="still"]').forEach(function (b) { b.setAttribute("aria-pressed", still ? "true" : "false"); b.textContent = still ? "Still on" : "Still"; });
    document.querySelectorAll('[data-toggle="commentary"]').forEach(function (b) { b.setAttribute("aria-pressed", commentary ? "true" : "false"); b.textContent = commentary ? "Commentary on" : "Commentary"; });
  }
  paint();
  if (window.JG_SFX) window.JG_SFX.mute(muted); else addEventListener("DOMContentLoaded", function () { if (window.JG_SFX) window.JG_SFX.mute(muted); });
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-toggle]"); if (!b) return;
    var k = b.getAttribute("data-toggle");
    if (k === "sound") {
      muted = !muted; store.set("jg_muted", muted ? "1" : "0");
      if (window.JG_SFX) window.JG_SFX.mute(muted);
      if (!muted) { FX.send(); }
      T("sound_toggled", { on: !muted });
    } else if (k === "still") {
      still = !still; store.set("jg_still", still ? "1" : "0");
      if (still) root.setAttribute("data-still", ""); else root.removeAttribute("data-still");
      if (!still) FX.choice();
      document.dispatchEvent(new CustomEvent("jg:still", { detail: { on: still } }));
      T("still_toggled", { on: still });
    } else if (k === "commentary") {
      commentary = !commentary; store.set("jg_commentary", commentary ? "1" : "0");
      if (commentary) FX.choice();
      document.dispatchEvent(new CustomEvent("jg:commentary", { detail: { on: commentary } }));
      T("commentary_toggled", { on: commentary });
    }
    paint();
  });
  window.JG_STILL = function () { return still; };
  window.JG_COMMENTARY = function () { return commentary; };

  /* ---------- screen lock ---------- */
  var locks = 0, lockY = 0;
  window.JG_LOCK = function (on) {
    if (on) {
      if (locks++ === 0) { lockY = scrollY; body.style.position = "fixed"; body.style.top = -lockY + "px"; body.style.left = "0"; body.style.right = "0"; root.classList.add("is-locked"); }
    } else if (locks > 0 && --locks === 0) {
      body.style.position = ""; body.style.top = ""; body.style.left = ""; body.style.right = ""; root.classList.remove("is-locked");
      var b = root.style.scrollBehavior; root.style.scrollBehavior = "auto"; scrollTo(0, lockY); root.style.scrollBehavior = b;
    }
  };

  /* ---------- the island: a black pill that springs open with a status ---------- */
  var island = document.createElement("div"); island.className = "island"; island.setAttribute("role", "status"); island.setAttribute("aria-live", "polite");
  island.innerHTML = '<span class="island__dot" aria-hidden="true"></span><span class="island__text"></span>';
  body.appendChild(island);
  var islandT = null;
  window.JG_TOAST = function (text) {
    island.querySelector(".island__text").textContent = text;
    island.classList.remove("is-on"); void island.offsetWidth; island.classList.add("is-on");
    clearTimeout(islandT); islandT = setTimeout(function () { island.classList.remove("is-on"); }, 2000);
  };

  /* ---------- a notification banner, lock-screen style ---------- */
  var notice = document.createElement("div"); notice.className = "notice"; notice.setAttribute("role", "status"); notice.setAttribute("aria-live", "polite");
  notice.innerHTML = '<img class="notice__icon" alt="" /><div><p class="notice__app"><span></span><span>now</span></p><p class="notice__title"></p><p class="notice__body"></p></div>';
  body.appendChild(notice);
  var noticeT = null, noticeGo = null;
  window.JG_NOTIFY = function (o) {
    notice.querySelector(".notice__icon").src = o.icon || "assets/favicon-192.png";
    notice.querySelector(".notice__app span").textContent = o.app || "";
    notice.querySelector(".notice__title").textContent = o.title || "";
    notice.querySelector(".notice__body").textContent = o.body || "";
    noticeGo = o.go || null;
    notice.classList.remove("is-on"); void notice.offsetWidth; notice.classList.add("is-on");
    clearTimeout(noticeT); noticeT = setTimeout(function () { notice.classList.remove("is-on"); }, o.ms || 4200);
  };
  notice.addEventListener("click", function () { notice.classList.remove("is-on"); if (noticeGo) noticeGo(); });

  /* ---------- the hard cut through black ---------- */
  var black = document.querySelector(".blackout");
  window.JG_CUT = function (fn) {
    if (!black || still) { fn(); return; }
    black.classList.add("is-on");
    setTimeout(function () { fn(); requestAnimationFrame(function () { setTimeout(function () { black.classList.remove("is-on"); }, 60); }); }, 290);
  };
  function jump(sel) {
    var el = document.querySelector(sel); if (!el) return;
    var b = root.style.scrollBehavior; root.style.scrollBehavior = "auto";
    scrollTo(0, el.getBoundingClientRect().top + scrollY - (parseInt(getComputedStyle(root).getPropertyValue("--bar-h"), 10) || 64));
    root.style.scrollBehavior = b;
  }
  window.JG_JUMP = jump;

  /* ---------- the bar hides on scroll down, returns on scroll up ---------- */
  var bar = document.querySelector("[data-chrome]"), lastY = scrollY, ticking = false;
  addEventListener("scroll", function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      var y = scrollY, d = y - lastY;
      if (bar && !root.classList.contains("is-locked")) { if (y > 160 && d > 6) bar.classList.add("is-hidden"); else if (d < -6 || y < 80) bar.classList.remove("is-hidden"); }
      lastY = y; ticking = false;
    });
  }, { passive: true });

  /* ---------- the menu ---------- */
  var menu = document.getElementById("menu"), burger = document.querySelector(".bar__menu");
  function setMenu(on) {
    if (!menu || !burger) return;
    if (on === menu.classList.contains("is-open")) return;
    menu.classList.toggle("is-open", on); burger.setAttribute("aria-expanded", on ? "true" : "false");
    window.JG_LOCK(on);
    if (on) { FX.arrive(); T("menu_opened", {}); var f = menu.querySelector("a,button"); if (f) f.focus({ preventScroll: true }); } else burger.focus({ preventScroll: true });
  }
  if (burger) burger.addEventListener("click", function () { setMenu(!menu.classList.contains("is-open")); });
  if (menu) menu.addEventListener("click", function (e) { var a = e.target.closest("a,button"); if (a && !a.hasAttribute("data-toggle")) setMenu(false); });

  /* ---------- overlays by name ---------- */
  window.JG_OPEN = function (what, where) { document.dispatchEvent(new CustomEvent("jg:open", { detail: { what: what, where: where || "" } })); };
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-open]"); if (!a) return;
    var what = a.getAttribute("data-open");
    if (!window.JG_HAS || !window.JG_HAS[what]) return; /* no module: the link just works as a link */
    e.preventDefault();
    window.JG_OPEN(what, a.getAttribute("data-where") || "");
  });
  window.JG_HAS = window.JG_HAS || {};

  /* Dialogs: close buttons are silent; opening and closing drives the lock */
  document.addEventListener("click", function (e) {
    var c = e.target.closest && e.target.closest("[data-close]"); if (!c) return;
    var d = c.closest("dialog"); if (d && d.open) d.close();
  });
  document.querySelectorAll("dialog").forEach(function (d) {
    d.addEventListener("close", function () { if (d._locked) { d._locked = false; window.JG_LOCK(false); } });
    d.addEventListener("click", function (e) { if (e.target === d && d.classList.contains("drawer")) d.close(); });
  });
  document.querySelectorAll("dialog.drawer").forEach(function (d) {
    var inner = d.querySelector(".drawer__inner"); if (!inner) return;
    var g = document.createElement("div"); g.className = "drawer__grab"; g.setAttribute("aria-hidden", "true");
    d.insertBefore(g, inner);
    var y0 = 0, dy = 0, dragging = false;
    g.addEventListener("pointerdown", function (e) { dragging = true; y0 = e.clientY; dy = 0; d.classList.add("is-dragging"); try { g.setPointerCapture(e.pointerId); } catch (x) {} });
    g.addEventListener("pointermove", function (e) { if (!dragging) return; dy = Math.max(0, e.clientY - y0); d.style.transform = "translateY(" + dy + "px)"; });
    var end = function () { if (!dragging) return; dragging = false; d.classList.remove("is-dragging"); if (dy > 90) { d.style.transform = "translateY(100%)"; setTimeout(function () { d.close(); d.style.transform = ""; }, 220); } else d.style.transform = ""; };
    g.addEventListener("pointerup", end); g.addEventListener("pointercancel", end);
  });
  window.JG_SHOW = function (d) {
    if (!d || d.open) return;
    if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
    if (!d._locked) { d._locked = true; window.JG_LOCK(true); }
  };
  document.addEventListener("jg:open", function (e) {
    if (e.detail.what !== "help") return;
    var h = document.getElementById("help"); if (!h) return;
    window.JG_SHOW(h); FX.arrive();
  });
  window.JG_HAS.help = true;

  /* ---------- the cut ---------- */
  function markCut(k) {
    document.querySelectorAll("[data-cut]").forEach(function (c) { if (c.tagName === "BUTTON") c.setAttribute("aria-pressed", c.getAttribute("data-cut") === k ? "true" : "false"); c.classList.toggle("is-on", c.getAttribute("data-cut") === k); });
  }
  var cut = store.get("jg_cut");
  if (cut) markCut(cut);
  function orderMove() {
    var box = document.querySelector("[data-move]"); if (!box) return;
    var book = box.querySelector("[data-book]"), mail = box.querySelector("[data-move-primary]");
    if (!book || !mail) return;
    if (store.get("jg_cut") === "agency") { box.insertBefore(book, mail); book.classList.add("btn--gold"); mail.classList.remove("btn--gold"); book.textContent = "Book 30 minutes"; }
  }
  orderMove();
  var ROLE = { screening: "interviewer", agency: "partner", trailer: "lurker" };
  document.addEventListener("click", function (e) {
    var c = e.target.closest && e.target.closest("[data-cut]"); if (!c) return;
    var k = c.getAttribute("data-cut");
    store.set("jg_cut", k); markCut(k); FX.choice();
    T("role_chosen", { role: ROLE[k] || k, where: "cut" }, { role: ROLE[k] || k });
    if (k === "screening") { e.preventDefault(); FX.cut(); window.JG_CUT(function () { jump("#desk-title"); }); }
    else if (k === "trailer") { e.preventDefault(); window.JG_OPEN("trailer", "cut"); }
  });

  /* Deep links: ?cut=screening|agency|trailer, #present/N, #verify, #trailer */
  var qCut = new URLSearchParams(location.search).get("cut");
  function arrive() {
    if (qCut && ROLE[qCut]) { store.set("jg_cut", qCut); markCut(qCut); orderMove(); T("role_chosen", { role: ROLE[qCut], where: "link" }, { role: ROLE[qCut] }); if (qCut === "screening") jump("#desk-title"); if (qCut === "trailer") window.JG_OPEN("trailer", "link"); if (qCut === "agency") location.replace("/obavia.html"); }
    var h = location.hash;
    if (/^#present(\/\d+)?$/.test(h)) window.JG_OPEN("deck", "link");
    else if (h === "#verify" && window.JG_HAS.verify) window.JG_OPEN("verify", "link");
    else if (h === "#trailer") window.JG_OPEN("trailer", "link");
  }
  addEventListener("load", function () { setTimeout(arrive, 60); });

  /* ---------- keys ---------- */
  addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (document.querySelector("dialog[open]") && e.key !== "Escape") return;
    var k = e.key;
    if (k === "r" || k === "R") { e.preventDefault(); window.JG_OPEN("deck", "key"); }
    else if (k === "v" || k === "V") { e.preventDefault(); window.JG_OPEN("verify", "key"); }
    else if (k === "p" || k === "P") { e.preventDefault(); jump("#desk-title"); }
    else if (k === "t" || k === "T") { e.preventDefault(); window.JG_OPEN("trailer", "key"); }
    else if (k === "`") { e.preventDefault(); window.JG_OPEN("rig", "key"); }
    else if (k === "?") { e.preventDefault(); window.JG_OPEN("help", "key"); }
    else if (k === "Escape" && menu && menu.classList.contains("is-open")) setMenu(false);
  });

  /* ---------- rise and fade as scenes enter ---------- */
  var risers = [].slice.call(document.querySelectorAll("[data-rise],[data-fade]"));
  if ("IntersectionObserver" in window && !still) {
    var io = new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add("is-in"); io.unobserve(x.target); } }); }, { rootMargin: "0px 0px -12% 0px", threshold: 0.2 });
    risers.forEach(function (r) { io.observe(r); });
  } else risers.forEach(function (r) { r.classList.add("is-in"); });
  var slateCopy = document.querySelector(".slate [data-rise]");
  if (slateCopy) requestAnimationFrame(function () { slateCopy.classList.add("is-in"); });

  /* Letterbox: close for a beat on arrival, then open. Your turn. */
  if (!still && body.classList.contains("home")) {
    root.style.setProperty("--bars", "1");
    setTimeout(function () { root.style.setProperty("--bars", "0"); }, 520);
  }

  /* ---------- copy buttons ---------- */
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (res) { var ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0"; body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} body.removeChild(ta); res(); });
  }
  window.JG_COPY = copy;
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-copy]"); if (!b) return;
    copy(b.getAttribute("data-copy")).then(function () { FX.send(); window.JG_TOAST("Copied"); T("copy_clicked", { what: "email" }); });
  });

  /* ---------- questions for the call ---------- */
  var asks = []; try { asks = JSON.parse(store.get("jg_asks") || "[]"); } catch (e) { asks = []; }
  var box = document.querySelector("[data-questions]");
  function paintAsks() {
    document.querySelectorAll("[data-ask]").forEach(function (b) { var on = asks.indexOf(b.getAttribute("data-ask")) >= 0; b.setAttribute("aria-pressed", on ? "true" : "false"); b.textContent = on ? "Added" : "Add to my questions"; });
    if (!box) return;
    box.hidden = !asks.length;
    var ol = box.querySelector("ol"); ol.innerHTML = "";
    asks.forEach(function (q) { var li = document.createElement("li"); li.textContent = q; ol.appendChild(li); });
    var mail = box.querySelector("[data-questions-mail]");
    if (mail) mail.href = "mailto:jobawems@gmail.com?subject=" + encodeURIComponent("Questions for our call") + "&body=" + encodeURIComponent("Jason,\n\nBefore we talk, here's what I'd like to ask:\n\n" + asks.map(function (q, i) { return (i + 1) + ". " + q; }).join("\n") + "\n\n");
  }
  paintAsks();
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-ask]"); if (!b) return;
    var q = b.getAttribute("data-ask"), i = asks.indexOf(q);
    if (i >= 0) asks.splice(i, 1); else { asks.push(q); FX.choice(); window.JG_TOAST("Added to your questions"); }
    store.set("jg_asks", JSON.stringify(asks)); paintAsks();
    T("question_added", { on: i < 0, n: asks.length });
    var cp = e.target.closest("[data-questions-copy]"); if (cp) return;
  });
  document.addEventListener("click", function (e) {
    var cp = e.target.closest && e.target.closest("[data-questions-copy]"); if (!cp) return;
    copy(asks.map(function (q, i) { return (i + 1) + ". " + q; }).join("\n")).then(function () { FX.send(); window.JG_TOAST("Copied"); T("questions_copied", { n: asks.length }); });
  });
  document.addEventListener("click", function (e) {
    var m = e.target.closest && e.target.closest("[data-questions-mail]"); if (!m) return;
    FX.send(); T("questions_mailed", { n: asks.length });
  });

  /* Sends fire their feedback: email, calendar, resume */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-contact],[data-book],[data-resume]"); if (!a) return;
    FX.send();
  });

  /* ---------- a note for whoever opens the console ---------- */
  try {
    if (!sessionStorage.getItem("jg_note")) {
      sessionStorage.setItem("jg_note", "1");
      console.log("%cYou opened the console. Good.%c\nNo framework, no build step. The projector is cinema.js, the desk is desk.js.\nSource: github.com/whoisjaso/jasonresume\nIf you're hiring: jobawems@gmail.com", "font:600 14px Georgia,serif;color:#c9a642", "font:12px ui-monospace,monospace;color:#c9c2b2");
    }
  } catch (e) {}
})();
