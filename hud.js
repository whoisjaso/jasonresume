/* The HUD: the shared plumbing every screen uses. Feedback, dialogs, the lock,
   status toasts, deep links, global keys, copy, the Houston clock.

   window.JG_FX(kind)     "choice" | "arrive" | "send" | "unlock" | "key"
                          haptic and (with the score on) the tuned sound in the
                          same frame; skips and cancels never call it, so they
                          stay silent
   window.JG_LOCK(on)     the iOS-safe scroll lock under full-screen layers
   window.JG_TOAST(text)  a short status line
   window.JG_NOTIFY(o)    a titled status line ({title, body}); older modules call it
   window.JG_OPEN(what)   open an overlay by name: deck, verify, help
   window.JG_SHOW(dlg)    show a dialog modally with the lock
   window.JG_STILL()      reduced motion is on
   Events: document "jg:open" {what, where} */
(function () {
  "use strict";
  var root = document.documentElement, body = document.body;
  var RM = matchMedia("(prefers-reduced-motion: reduce)");
  function T(e, p, s) { if (window.JG_TRACK) window.JG_TRACK(e, p, s); }
  function hap(k) { if (window.JG_HAPTIC) window.JG_HAPTIC(k); }
  function S() { return window.JG_SCORE; }

  /* ---------- feedback ---------- */
  var FX = {
    choice: function () { hap("tap"); if (S()) S().sting("select"); },
    arrive: function () { hap("tap"); if (S()) S().sting("open"); },
    send: function () { hap("select"); if (S()) S().sting("select"); },
    unlock: function () { hap("success"); if (S()) S().sting("trophy-silver"); },
    key: function () { if (S()) S().tick(); }
  };
  window.JG_FX = function (kind) { var f = FX[kind]; if (f) f(); };
  window.JG_STILL = function () { return RM.matches; };
  if (RM.matches) root.setAttribute("data-still", "");

  /* ---------- lock ---------- */
  var locks = 0, lockY = 0;
  window.JG_LOCK = function (on) {
    if (on) {
      if (locks++ === 0) { lockY = scrollY; body.style.position = "fixed"; body.style.top = -lockY + "px"; body.style.left = "0"; body.style.right = "0"; root.classList.add("is-locked"); }
    } else if (locks > 0 && --locks === 0) {
      body.style.position = ""; body.style.top = ""; body.style.left = ""; body.style.right = ""; root.classList.remove("is-locked");
      scrollTo(0, lockY);
    }
  };

  /* ---------- status toasts ---------- */
  var tbox = document.querySelector("[data-toasts]");
  if (!tbox) { tbox = document.createElement("div"); tbox.className = "toasts"; tbox.setAttribute("data-toasts", ""); body.appendChild(tbox); }
  var live = document.querySelector("[data-live]");
  function toast(title, text, ms) {
    var t = document.createElement("div"); t.className = "toast toast--status";
    t.innerHTML = '<p class="toast__t"></p>' + (text ? '<p class="toast__s"></p>' : "");
    t.querySelector(".toast__t").textContent = title;
    if (text) t.querySelector(".toast__s").textContent = text;
    tbox.appendChild(t);
    if (live) live.textContent = title + (text ? ". " + text : "");
    requestAnimationFrame(function () { requestAnimationFrame(function () { t.classList.add("is-on"); }); });
    setTimeout(function () { t.classList.remove("is-on"); setTimeout(function () { t.remove(); }, 600); }, ms || 2600);
  }
  window.JG_TOAST = function (text) { toast(text, "", 2200); };
  window.JG_NOTIFY = function (o) { toast(o.title || "", o.body || "", o.ms || 4200); };

  /* ---------- overlays ---------- */
  window.JG_HAS = window.JG_HAS || {};
  window.JG_OPEN = function (what, where) { document.dispatchEvent(new CustomEvent("jg:open", { detail: { what: what, where: where || "" } })); };
  window.JG_SHOW = function (d) {
    if (!d || d.open) return;
    if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
    if (!d._locked) { d._locked = true; window.JG_LOCK(true); }
  };
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-open]"); if (!a) return;
    var what = a.getAttribute("data-open");
    if (!window.JG_HAS[what]) return;
    e.preventDefault(); window.JG_OPEN(what, a.getAttribute("data-where") || "");
  });
  document.addEventListener("click", function (e) {
    var c = e.target.closest && e.target.closest("[data-close]"); if (!c) return;
    var d = c.closest("dialog"); if (d && d.open) d.close();
  });
  document.querySelectorAll("dialog").forEach(function (d) {
    d.addEventListener("close", function () { if (d._locked) { d._locked = false; window.JG_LOCK(false); } });
    d.addEventListener("click", function (e) { if (e.target === d && d.classList.contains("drawer")) d.close(); });
  });
  document.addEventListener("jg:open", function (e) {
    if (e.detail.what !== "help") return;
    var h = document.getElementById("help"); if (!h) return;
    window.JG_SHOW(h); FX.arrive();
  });
  window.JG_HAS.help = true;

  /* ---------- deep links ----------
     #present/N the deck, #verify the proof drawer, #title/id a title, #trophies,
     #profile. Older links still land: #story-desk, #story-obavia, #story-lot,
     #story-record, #story-check, #record, ?cut=screening|dealer|trailer. */
  var LEGACY = { "#story-desk": "#title/lead-to-title", "#story-obavia": "#title/obavia", "#story-lot": "#title/triple-j", "#story-record": "#profile", "#record": "#profile", "#slate": "", "#top": "", "#move": "#profile", "#trailer": "" };
  var SEAT = { screening: "interviewer", trailer: "lurker" };
  function arrive() {
    var q = new URLSearchParams(location.search).get("cut");
    if (q === "dealer" || q === "agency") { location.replace("/obavia.html"); return; }
    if (q && SEAT[q] && window.JG_GAME) window.JG_GAME.seat(SEAT[q], "link");
    var h = location.hash;
    if (h === "#story-check") h = "#verify";
    if (LEGACY.hasOwnProperty(h)) { h = LEGACY[h]; try { history.replaceState(history.state, "", location.pathname + location.search + h); } catch (e) {} }
    if (/^#present(\/\d+)?$/.test(h)) window.JG_OPEN("deck", "link");
    else if (h === "#verify" && window.JG_HAS.verify) window.JG_OPEN("verify", "link");
    else if (window.JG_GAME) window.JG_GAME.route(h, "link");
  }
  var arrived = false;
  function arriveOnce() { if (arrived) return; arrived = true; arrive(); }
  document.addEventListener("jg:intro-done", function () { setTimeout(arriveOnce, 40); });
  addEventListener("load", function () {
    if (!root.classList.contains("intro-pending")) setTimeout(arriveOnce, 40);
    else setTimeout(function () { if (!document.getElementById("intro")) arriveOnce(); }, 6000);
  });

  /* ---------- global keys (the library's own keys live in game.js) ---------- */
  addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (root.classList.contains("intro-on")) return;
    if (document.querySelector("dialog[open]")) return;
    var k = e.key;
    if (k === "r" || k === "R") { e.preventDefault(); window.JG_OPEN("deck", "key"); }
    else if (k === "v" || k === "V") { e.preventDefault(); window.JG_OPEN("verify", "key"); }
    else if (k === "?") { e.preventDefault(); window.JG_OPEN("help", "key"); }
  });

  /* ---------- copy ---------- */
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (res) { var ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0"; body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} body.removeChild(ta); res(); });
  }
  window.JG_COPY = copy;
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-copy]"); if (!b) return;
    copy(b.getAttribute("data-copy")).then(function () { FX.send(); window.JG_TOAST("Copied"); T("copy_clicked", { what: "email" }); });
  });
  /* sends fire their feedback: email, calendar, resume */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-contact],[data-book],[data-resume]"); if (!a) return;
    FX.send();
  });

  /* ---------- the Houston clock ---------- */
  var clocks = [].slice.call(document.querySelectorAll("[data-clock]"));
  function tick() {
    var s = "";
    try { s = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).format(new Date()); } catch (e) {}
    clocks.forEach(function (c) { c.textContent = s; });
  }
  if (clocks.length) { tick(); setInterval(tick, 15000); }

  /* ---------- a note for whoever opens the console ---------- */
  try {
    if (!sessionStorage.getItem("jg_note")) {
      sessionStorage.setItem("jg_note", "1");
      console.log("%cYou opened the console. Good.%c\nNo framework, no build step. The library is game.js, the score is score.js, the title screen is intro.js.\nSource: github.com/whoisjaso/jasonresume\nIf you're hiring: jobawems@gmail.com", "font:600 14px Georgia,serif;color:#EDE7DB", "font:12px ui-monospace,monospace;color:#9A9890");
    }
  } catch (e) {}
})();
