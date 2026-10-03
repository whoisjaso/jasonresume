/* The dash. Houston's clock and whether Triple J is open by its posted hours,
   the gauges (built from their data attributes, with the ignition sweep: up to
   the stop, then settle on what is true), the tell-tale lamps, the card loops,
   the story cards that grow out of the page into the screen, and the keys.
   Runs on the home page and /obavia.html; every part checks its element first.
   Events: "jg:ignition" sweeps the gauges; "jg:story" {id} opens a story;
   window.JG_STORY(id). Where a page has no card for a story, the element with
   [data-story-alt=id] scrolls into view instead. */
(function () {
  "use strict";
  var root = document.documentElement, body = document.body;
  var RM = matchMedia("(prefers-reduced-motion: reduce)").matches || root.hasAttribute("data-still");
  var SAVE = !!(navigator.connection && navigator.connection.saveData);
  var T = window.JG_TRACK || function () {};
  function fx(k) { if (window.JG_FX) window.JG_FX(k); }
  function sfx(n, o) { return window.JG_SFX ? window.JG_SFX.play(n, o) : false; }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }

  /* ---------- Houston, live ---------- */
  function houston() {
    var now = new Date(), p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(now).forEach(function (x) { p[x.type] = x.value; });
    var h = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).format(now), 10) % 24;
    var day = p.weekday, open = day !== "Sunday" && h >= 9 && h < 19, note;
    if (open) note = "Open now. Closes at 7 PM.";
    else if (day === "Sunday" || (day === "Saturday" && h >= 19)) note = "Closed. Opens Monday at 9 AM.";
    else if (h < 9) note = "Closed. Opens today at 9 AM.";
    else note = "Closed. Opens tomorrow at 9 AM.";
    return { date: p.weekday + ", " + p.month + " " + p.day, time: p.hour + ":" + p.minute, ampm: p.dayPeriod || "", open: open, note: note };
  }
  function tick() {
    var H = houston();
    $$("[data-today-date]").forEach(function (n) { n.textContent = H.date; });
    $$("[data-clock]").forEach(function (n) { n.textContent = H.time; });
    $$("[data-clock-day]").forEach(function (n) { n.textContent = H.ampm + ", Houston"; });
    $$("[data-lot]").forEach(function (n) { n.textContent = H.open ? "Triple J is open" : "Triple J is closed"; });
    $$("[data-lot-note]").forEach(function (n) { n.textContent = H.note.replace(/^(Closed|Open now)\. /, ""); });
    $$("[data-lamp='lot']").forEach(function (n) { n.classList.toggle("is-lit", H.open); });
    $$("[data-lot-status]").forEach(function (b) { b.textContent = "Triple J is " + (H.open ? "open right now" : "closed right now"); });
  }
  tick(); setInterval(tick, 15000);

  /* ---------- the compact bar once the name scrolls away ---------- */
  var navbar = $(".navbar"), title = $(".mfd__name") || $(".today__title");
  if (navbar && title && "IntersectionObserver" in window) new IntersectionObserver(function (en) { navbar.classList.toggle("is-compact", !en[0].isIntersecting); }, { rootMargin: "-60px 0px 0px 0px" }).observe(title);

  /* =================================================================
     THE GAUGES: chrome bezel, ivory face, ticks, numerals, one red needle
     ================================================================= */
  var NS = "http://www.w3.org/2000/svg";
  function el(tag, a) { var n = document.createElementNS(NS, tag); for (var k in a) n.setAttribute(k, a[k]); return n; }
  var gauges = $$("[data-gauge]").map(function (svg, gi) {
    var min = +svg.dataset.min, max = +svg.dataset.max, val = +svg.dataset.value, major = +svg.dataset.major, minor = +svg.dataset.minor, fmt = svg.dataset.fmt;
    var deg = function (v) { return -135 + ((v - min) / (max - min)) * 270; };
    var pt = function (d, r) { var a = (d - 90) * Math.PI / 180; return [100 + r * Math.cos(a), 100 + r * Math.sin(a)]; };
    var id = "g" + gi;
    var defs = el("defs", {});
    var lg = el("linearGradient", { id: id + "bz", x1: 0, y1: 0, x2: 1, y2: 1 });
    [["0", "#eef0f2"], ["0.45", "#9a9ea3"], ["0.55", "#44484d"], ["1", "#eef0f2"]].forEach(function (s) { lg.appendChild(el("stop", { offset: s[0], "stop-color": s[1] })); });
    var rg = el("radialGradient", { id: id + "fc", cx: "0.5", cy: "0.38", r: "0.7" });
    [["0", "#efe8d8"], ["1", "#d9d1bf"]].forEach(function (s) { rg.appendChild(el("stop", { offset: s[0], "stop-color": s[1] })); });
    defs.appendChild(lg); defs.appendChild(rg); svg.appendChild(defs);
    svg.appendChild(el("circle", { cx: 100, cy: 100, r: 98, fill: "url(#" + id + "bz)" }));
    svg.appendChild(el("circle", { cx: 100, cy: 100, r: 90, fill: "#0a0909" }));
    svg.appendChild(el("circle", { cx: 100, cy: 100, r: 88, fill: "url(#" + id + "fc)", class: "dial__face" }));
    var n = Math.round((max - min) / minor);
    for (var i = 0; i <= n; i++) {
      var t = min + i * minor, isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6;
      var a = pt(deg(t), 82), b = pt(deg(t), isMajor ? 71 : 76);
      svg.appendChild(el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: "#161514", "stroke-width": isMajor ? 2.6 : 1.2, "stroke-linecap": "round" }));
      if (isMajor) { var q = pt(deg(t), 59), tx = el("text", { x: q[0], y: q[1] + 5, "text-anchor": "middle", class: "dial__num" }); tx.textContent = String(t); svg.appendChild(tx); }
    }
    var lab = el("text", { x: 100, y: 80, "text-anchor": "middle", class: "dial__label" }); lab.textContent = (svg.dataset.label || "").toUpperCase(); svg.appendChild(lab);
    var ro = el("text", { x: 100, y: 156, "text-anchor": "middle", class: "dial__readout" }); svg.appendChild(ro);
    var needle = el("g", { class: "dial__needle" });
    needle.appendChild(el("polygon", { points: "98.2,104 101.8,104 100.7,22 99.3,22", fill: "#e0442a" }));
    needle.appendChild(el("polygon", { points: "98.6,104 101.4,104 100,122", fill: "#161514" }));
    svg.appendChild(needle);
    svg.appendChild(el("circle", { cx: 100, cy: 100, r: 9, fill: "#161514" }));
    svg.appendChild(el("circle", { cx: 100, cy: 100, r: 4.5, fill: "url(#" + id + "bz)" }));
    var g = { min: min, max: max, val: val, set: function (v) {
      v = Math.max(min - (max - min) * 0.02, Math.min(max + (max - min) * 0.02, v));
      needle.setAttribute("transform", "rotate(" + deg(v) + " 100 100)");
      var shown = Math.max(min, Math.min(max, v));
      ro.textContent = fmt === "int" ? String(Math.round(shown)) : shown.toFixed(+fmt || 0);
    } };
    g.set(RM ? val : min);
    return g;
  });

  /* the ignition sweep: needles up to the stop, then a damped settle on the value */
  var swept = false;
  function ignite(force) {
    if (!gauges.length || (swept && !force)) return;
    swept = true;
    root.classList.add("is-ignited");
    if (RM) { gauges.forEach(function (g) { g.set(g.val); }); return; }
    var t0 = performance.now(), UP = 620;
    (function f(now) {
      var t = now - t0, done = true;
      gauges.forEach(function (g, i) {
        var tt = t - i * 90;
        if (tt < 0) { g.set(g.min); done = false; return; }
        if (tt < UP) { var p = 1 - Math.pow(1 - tt / UP, 3); g.set(g.min + (g.max - g.min) * p); done = false; return; }
        var s = (tt - UP) / 1000, amp = g.max - g.val, w = 9, z = 0.42;
        var v = g.val + amp * Math.exp(-z * w * s) * Math.cos(w * Math.sqrt(1 - z * z) * s);
        g.set(v); if (s < 1.6) done = false;
      });
      if (!done) requestAnimationFrame(f); else gauges.forEach(function (g) { g.set(g.val); });
    })(t0);
    /* the bulb check: every lamp lights, then each returns to what is true */
    $$(".lamp").forEach(function (l, i) { l.classList.add("is-check"); setTimeout(function () { l.classList.remove("is-check"); }, 900 + i * 120); });
  }
  window.JG_IGNITE = ignite;
  document.addEventListener("jg:ignition", function () { ignite(true); });
  document.addEventListener("jg:intro-done", function () { setTimeout(function () { ignite(true); }, 380); });
  if (!root.classList.contains("intro-pending")) {
    var cl = $(".cluster");
    if (cl && "IntersectionObserver" in window) { var gio = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { gio.disconnect(); setTimeout(ignite, 250); } }, { threshold: 0.3 }); gio.observe(cl); }
    else ignite();
  }

  /* ---------- card loops play only while on screen ---------- */
  var loops = $$("video[data-loop]");
  if (!RM && !SAVE && "IntersectionObserver" in window) {
    var lio = new IntersectionObserver(function (en) {
      en.forEach(function (x) { var v = x.target; if (x.isIntersecting) { if (v.preload === "none") v.preload = "auto"; v.play().catch(function () {}); } else v.pause(); });
    }, { threshold: 0.35 });
    loops.forEach(function (v) { lio.observe(v); });
  }


  /* ---------- your cut: the trailer for the role you picked ---------- */
  function playCut() {
    var role = "interviewer", name = "";
    try { role = localStorage.getItem("jg_role") || "interviewer"; name = localStorage.getItem("jg_name") || ""; } catch (e) {}
    if (window.JG_REEL) window.JG_REEL.play(role, { name: name, from: "card" });
  }
  document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-reel-play]")) { e.preventDefault(); fx("choice"); playCut(); } });

  /* ---------- copy the email ---------- */
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-copy-email]"); if (!b) return;
    if (window.JG_COPY) window.JG_COPY(b.textContent.trim()).then(function () { if (window.JG_TOAST) window.JG_TOAST("Email copied"); fx("send"); T("copy_clicked", { what: "email" }); });
  });

  /* =================================================================
     THE STORY CARD: it grows out of the feed into the screen
     ================================================================= */
  var openCard = null, ph = null, backdrop = null, pushed = false;
  function geometry() { var pw = Math.min(innerWidth, 860), pl = Math.round((innerWidth - pw) / 2); return { pw: pw, pl: pl }; }
  function openStory(id, how) {
    var card = $('[data-story="' + id + '"]');
    if (!card) {
      var alt = $('[data-story-alt~="' + id + '"]');
      if (alt) { alt.scrollIntoView({ behavior: RM ? "auto" : "smooth", block: alt.offsetHeight < innerHeight * 0.8 ? "center" : "start" }); fx("arrive"); alt.classList.remove("is-called"); void alt.offsetWidth; alt.classList.add("is-called"); setTimeout(function () { alt.classList.remove("is-called"); }, 1600); T("story_opened", { story: id, how: how || "tap" }); }
      return;
    }
    if (openCard) return;
    if (document.querySelector("dialog[open]") || (window.JG_REEL && window.JG_REEL.open())) return;
    var menu = $("#menu"); if (menu && menu.classList.contains("is-open")) $(".bar__menu").click();
    openCard = card;
    var r = card.getBoundingClientRect(), G = geometry(), s = r.width / G.pw;
    ph = document.createElement("div"); ph.className = "tcard-ph"; ph.style.height = r.height + "px"; card.parentNode.insertBefore(ph, card);
    if (!backdrop) { backdrop = document.createElement("div"); backdrop.className = "story-backdrop"; backdrop.addEventListener("click", function () { closeStory(); }); body.appendChild(backdrop); }
    if (window.JG_LOCK) window.JG_LOCK(true);
    root.classList.add("is-story-open");
    card.style.setProperty("--pl", G.pl + "px"); card.style.setProperty("--pw", G.pw + "px"); card.style.setProperty("--hh", (r.height / s) + "px");
    card.classList.add("is-open");
    var x = document.createElement("button"); x.type = "button"; x.className = "story-x"; x.setAttribute("aria-label", "Close"); x.addEventListener("click", function () { closeStory(); });
    card.insertBefore(x, card.firstChild);
    card.scrollTop = 0;
    if (!RM) {
      card.style.transform = "translate(" + (r.left - G.pl) + "px," + r.top + "px) scale(" + s + ")";
      card.style.clipPath = "inset(0 0 " + Math.max(0, innerHeight - r.height / s) + "px 0 round " + (26 / s) + "px)";
      void card.offsetWidth;
      card.classList.add("is-animating");
      card.style.transform = ""; card.style.clipPath = "inset(0 0 0 0 round 0px)";
      setTimeout(function () { card.classList.remove("is-animating"); card.style.clipPath = ""; card.classList.add("is-settled"); }, 650);
    } else card.classList.add("is-settled");
    backdrop.classList.add("is-on");
    card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true");
    setTimeout(function () { x.focus({ preventScroll: true }); }, 300);
    fx("arrive");
    if (location.hash !== "#story-" + id) { history.pushState({ story: id }, "", "#story-" + id); pushed = true; }
    tabs(id);
    T("story_opened", { story: id, how: how || "tap" });
    document.dispatchEvent(new CustomEvent("jg:story-open", { detail: { id: id, card: card } }));
  }
  function closeStory(fromPop) {
    var card = openCard; if (!card) return;
    if (pushed && !fromPop) { pushed = false; history.back(); return; }
    pushed = false;
    card.classList.add("is-closing");
    var finish = function () {
      card.classList.remove("is-open", "is-animating", "is-closing", "is-settled");
      card.style.transform = ""; card.style.clipPath = ""; ["--pl", "--pw", "--hh"].forEach(function (v) { card.style.removeProperty(v); }); card.removeAttribute("role"); card.removeAttribute("aria-modal");
      var x = card.querySelector(".story-x"); if (x) x.remove();
      if (ph) { ph.remove(); ph = null; }
      root.classList.remove("is-story-open");
      if (window.JG_LOCK) window.JG_LOCK(false);
      $$("video", card).forEach(function (v) { if (!v.hasAttribute("data-loop")) v.pause(); });
      openCard = null; tabs("today");
    };
    backdrop.classList.remove("is-on");
    if (RM || !ph) return finish();
    var go = function () {
      var r = ph.getBoundingClientRect(), G = geometry(), s = r.width / G.pw;
      card.classList.add("is-animating"); card.classList.remove("is-settled");
      card.style.clipPath = "inset(0 0 0 0 round 0px)"; void card.offsetWidth;
      card.style.transform = "translate(" + (r.left - G.pl) + "px," + r.top + "px) scale(" + s + ")";
      card.style.clipPath = "inset(0 0 " + Math.max(0, innerHeight - r.height / s) + "px 0 round " + (26 / s) + "px)";
      setTimeout(finish, 600);
    };
    if (card.scrollTop > 0) { card.scrollTo({ top: 0, behavior: "smooth" }); setTimeout(go, 280); } else go();
  }
  window.JG_STORY = openStory;
  document.addEventListener("jg:story", function (e) { openStory(e.detail && e.detail.id, "event"); });
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-story-open]");
    if (t) { e.preventDefault(); var id = t.getAttribute("data-story-open"); if (openCard && openCard.getAttribute("data-story") !== id) { var go = function () { openStory(id, "link"); }; closeStory(); setTimeout(go, 700); } else openStory(id, "link"); return; }
    var o = e.target.closest && e.target.closest(".tcard__open");
    if (o && !o.hasAttribute("data-reel-play")) { var c = o.closest("[data-story]"); if (c) openStory(c.getAttribute("data-story"), "card"); }
  });
  addEventListener("popstate", function () { if (openCard) closeStory(true); else { var m = /^#story-(\w+)/.exec(location.hash); if (m) openStory(m[1], "back"); } });
  addEventListener("keydown", function (e) { if (e.key === "Escape" && openCard) { e.preventDefault(); e.stopPropagation(); closeStory(); } }, true);
  /* drag down from the top to close, the way a sheet does */
  (function () {
    var y0 = 0, dragging = false;
    document.addEventListener("touchstart", function (e) { if (!openCard || openCard.scrollTop > 0 || !openCard.contains(e.target)) return; y0 = e.touches[0].clientY; dragging = true; }, { passive: true });
    document.addEventListener("touchmove", function (e) { if (!dragging || !openCard) return; var dy = e.touches[0].clientY - y0; if (dy > 0 && openCard.scrollTop <= 0) { var s = Math.max(0.86, 1 - dy / 1400); openCard.style.transform = "scale(" + s + ")"; openCard.style.borderRadius = Math.min(26, dy / 4) + "px"; } }, { passive: true });
    document.addEventListener("touchend", function (e) { if (!dragging || !openCard) return; dragging = false; var dy = (e.changedTouches[0] || {}).clientY - y0; openCard.style.borderRadius = ""; if (dy > 110) closeStory(); else openCard.style.transform = ""; }, { passive: true });
  })();
  /* #story-id opens its story, after the onboarding when it is playing */
  function storyLink() { var m = /^#story-(\w+)/.exec(location.hash); if (m) setTimeout(function () { openStory(m[1], "link"); }, 200); }
  document.addEventListener("jg:intro-done", storyLink);
  addEventListener("load", function () { if (!root.classList.contains("intro-pending")) storyLink(); });

  /* ---------- the tab bar follows what you're looking at ---------- */
  function tabs(id) { $$(".tabbar .tab").forEach(function (t) { t.classList.toggle("is-on", t.getAttribute("data-tab") === id || (id !== "desk" && id !== "obavia" && t.getAttribute("data-tab") === "today")); }); }
  $$(".tabbar .tab[data-tab='today']").forEach(function (t) { t.addEventListener("click", function (e) { e.preventDefault(); if (openCard) closeStory(); var b = root.style.scrollBehavior; scrollTo({ top: 0, behavior: RM ? "auto" : "smooth" }); fx("choice"); }); });

  /* keys: P opens the desk, T plays your cut */
  addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (document.querySelector("dialog[open]") || openCard || (window.JG_REEL && window.JG_REEL.open())) return;
    if (e.key === "p" || e.key === "P") { e.preventDefault(); e.stopImmediatePropagation(); var m = $("[data-desk-app]"); if (m && !$("[data-story='desk']")) m.scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "center" }); else openStory("desk", "key"); }
    else if (e.key === "t" || e.key === "T") { e.preventDefault(); e.stopImmediatePropagation(); playCut(); }
  }, true);
})();
