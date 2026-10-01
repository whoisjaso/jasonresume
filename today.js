/* The Today feed. The live date and the compact bar, the widgets (Houston's
   clock, whether Triple J is open by its posted hours, the counts), the
   card loops, the App Store card that opens into its story, the cut card,
   and the desk as a real iPhone app with a fictional buyer.
   Events: document "jg:story" {id} opens a story; window.JG_STORY(id). */
(function () {
  "use strict";
  var root = document.documentElement, body = document.body;
  if (!body.classList.contains("today-page")) return;
  var RM = matchMedia("(prefers-reduced-motion: reduce)").matches || root.hasAttribute("data-still");
  var SAVE = !!(navigator.connection && navigator.connection.saveData);
  var T = window.JG_TRACK || function () {};
  function fx(k) { if (window.JG_FX) window.JG_FX(k); }
  function sfx(n, o) { return window.JG_SFX ? window.JG_SFX.play(n, o) : false; }
  function hap(k) { if (window.JG_HAPTIC) window.JG_HAPTIC(k); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }

  /* ---------- Houston, live ---------- */
  function houston() {
    var now = new Date(), p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).formatToParts(now).forEach(function (x) { p[x.type] = x.value; });
    var h = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).format(now), 10) % 24;
    var m = parseInt(p.minute, 10), s = parseInt(p.second, 10), day = p.weekday;
    var open = day !== "Sunday" && h >= 9 && h < 19, note;
    if (open) note = "Open now. Closes at 7 PM.";
    else if (day === "Sunday" || (day === "Saturday" && h >= 19)) note = "Closed. Opens Monday at 9 AM.";
    else if (h < 9) note = "Closed. Opens today at 9 AM.";
    else note = "Closed. Opens tomorrow at 9 AM.";
    return { date: p.weekday + ", " + p.month + " " + p.day, time: p.hour + ":" + p.minute, ampm: p.dayPeriod || "", h: h, m: m, s: s, open: open, note: note };
  }
  var dateEl = $("[data-today-date]"), clockEl = $("[data-clock]"), dayEl = $("[data-clock-day]"), lotEl = $("[data-lot]"), lotNote = $("[data-lot-note]"), lotW = $(".widget--lot");
  var hands = { h: $('[data-hand="h"]'), m: $('[data-hand="m"]'), s: $('[data-hand="s"]') };
  function tick() {
    var H = houston();
    if (dateEl) dateEl.textContent = H.date;
    if (clockEl) clockEl.textContent = H.time;
    if (dayEl) dayEl.textContent = H.ampm + " in Houston";
    if (hands.h) { hands.h.style.transform = "rotate(" + ((H.h % 12) * 30 + H.m * 0.5) + "deg)"; hands.m.style.transform = "rotate(" + (H.m * 6 + H.s * 0.1) + "deg)"; hands.s.style.transform = "rotate(" + H.s * 6 + "deg)"; }
    if (lotEl) { lotEl.textContent = H.open ? "Open" : "Closed"; lotNote.textContent = H.note.replace(/^(Closed|Open now)\. /, ""); lotW.classList.toggle("is-open", H.open); }
    $$("[data-lot-status]").forEach(function (b) { b.textContent = "Triple J is " + (H.open ? "open right now" : "closed right now"); });
  }
  tick(); setInterval(tick, 1000);

  /* ---------- the compact bar ---------- */
  var navbar = $(".navbar"), title = $(".today__title");
  if (navbar && title && "IntersectionObserver" in window) new IntersectionObserver(function (en) { navbar.classList.toggle("is-compact", !en[0].isIntersecting); }, { rootMargin: "-60px 0px 0px 0px" }).observe(title);

  /* ---------- counts rise when they come into view ---------- */
  function countUp(el) {
    var to = parseFloat(el.getAttribute("data-count")), dec = parseInt(el.getAttribute("data-dec") || "0", 10), t0 = performance.now(), dur = RM ? 1 : 1100;
    (function f(now) { var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = (to * e).toFixed(dec); if (p < 1) requestAnimationFrame(f); })(t0);
  }
  if ("IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) { countUp(x.target); cio.unobserve(x.target); } }); }, { threshold: 0.6 });
    $$("[data-count]").forEach(function (n) { cio.observe(n); });
  }

  /* ---------- card loops play only while on screen ---------- */
  var loops = $$("video[data-loop]");
  if (!RM && !SAVE && "IntersectionObserver" in window) {
    var lio = new IntersectionObserver(function (en) {
      en.forEach(function (x) { var v = x.target; if (x.isIntersecting) { if (v.preload === "none") v.preload = "auto"; v.play().catch(function () {}); } else v.pause(); });
    }, { threshold: 0.35 });
    loops.forEach(function (v) { lio.observe(v); });
  }

  /* ---------- the cut card: a gold line that breathes, and plays your cut ---------- */
  var scope = $("[data-card-scope]");
  if (scope) {
    var px = 0.5, py = 0.5, onScreen = false;
    scope.parentNode.addEventListener("pointermove", function (e) { var r = scope.getBoundingClientRect(); px = (e.clientX - r.left) / r.width; py = (e.clientY - r.top) / r.height; }, { passive: true });
    if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; if (onScreen) requestAnimationFrame(draw); }).observe(scope);
    var draw = function (now) {
      if (!onScreen) return;
      var w = scope.clientWidth, h = scope.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      if (scope.width !== Math.round(w * dpr)) { scope.width = Math.round(w * dpr); scope.height = Math.round(h * dpr); }
      var g = scope.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      var t = (now || 0) / 1000, beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 112 / 60)), 12);
      for (var L = 0; L < 3; L++) {
        g.beginPath(); g.strokeStyle = L ? "rgba(201,166,66," + (0.35 - L * 0.1) + ")" : "#c9a642"; g.lineWidth = L ? 1 : 2;
        for (var k = 0; k <= 160; k++) {
          var x = k / 160 * w, d = Math.abs(k / 160 - px), amp = (0.18 + beat * 0.5 + Math.max(0, 0.4 - d) * (1 - py)) * h * 0.4;
          var y = h / 2 + Math.sin(k / 9 + t * (2 + L) + L) * amp * Math.exp(-Math.pow((k / 160 - 0.5) * 2.2, 2));
          if (k) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.stroke();
      }
      if (!RM) requestAnimationFrame(draw);
    };
  }
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
    if (!card || openCard) return;
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
  addEventListener("load", function () { var m = /^#story-(\w+)/.exec(location.hash); if (m) setTimeout(function () { openStory(m[1], "link"); }, 200); });

  /* ---------- the tab bar follows what you're looking at ---------- */
  function tabs(id) { $$(".tabbar .tab").forEach(function (t) { t.classList.toggle("is-on", t.getAttribute("data-tab") === id || (id !== "desk" && id !== "obavia" && t.getAttribute("data-tab") === "today")); }); }
  $$(".tabbar .tab[data-tab='today']").forEach(function (t) { t.addEventListener("click", function (e) { e.preventDefault(); if (openCard) closeStory(); var b = root.style.scrollBehavior; scrollTo({ top: 0, behavior: RM ? "auto" : "smooth" }); fx("choice"); }); });

  /* =================================================================
     THE DESK: an iPhone app, one question per screen
     Fictional buyer, fictional cars, example figures.
     ================================================================= */
  var CARS = [
    { y: "2019", mk: "Chevrolet Malibu LT", st: "1142", price: 11900, odo: 84213, c: "#3a6ea5" },
    { y: "2017", mk: "Ford F-150 XLT", st: "1138", price: 18500, odo: 102776, c: "#8a3a2a" },
    { y: "2020", mk: "Nissan Altima S", st: "1151", price: 13400, odo: 61409, c: "#55616b" }
  ];
  var FEES = { doc: 150, title: 33, reg: 75 }, TAX = 0.0625;
  function money(n) { return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  var CAR_SVG = '<svg viewBox="0 0 24 24"><use href="#i-car"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24"><use href="#i-check"/></svg>';

  function buildDesk(host) {
    var deal = { car: null, pay: "cash", buyer: null };
    host.innerHTML = '<div class="iphone__screen"><div class="iphone__island"><i>' + CHECK.replace("<svg", '<svg width="12" height="12" style="color:#fff"') + '</i><span>Deal on file</span></div>' +
      '<div class="iphone__status"><b>9:41</b><svg viewBox="0 0 42 12" aria-hidden="true"><rect x="0" y="5" width="3" height="7" rx="1" fill="#111"/><rect x="5" y="3" width="3" height="9" rx="1" fill="#111"/><rect x="10" y="1" width="3" height="11" rx="1" fill="#111"/><rect x="22" y="1" width="17" height="10" rx="3" fill="none" stroke="#111"/><rect x="24" y="3" width="12" height="6" rx="1.5" fill="#111"/></svg></div>' +
      '<div class="iphone__stack"></div><div class="iphone__home"></div></div>';
    var stack = host.querySelector(".iphone__stack"), island = host.querySelector(".iphone__island");
    var screens = [], at = -1;
    var notes = $$("[data-desk-notes] li");
    var NOTE = ["", "car", "odo", "scan", "pay", "money", "docs", "sign", ""];
    function screen(i, title, html, back) {
      var s = document.createElement("section"); s.className = "app-screen"; s.setAttribute("aria-label", title);
      s.innerHTML = '<div class="app-nav">' + (back ? '<button type="button" data-back>Back</button>' : "<span></span>") + '<span class="app-step">' + (i > 0 && i < 8 ? i + " of 7" : "") + '</span></div><h4 class="app-title">' + title + '</h4><div class="app-scroll">' + html + "</div>";
      stack.appendChild(s); screens[i] = s;
      var b = s.querySelector("[data-back]"); if (b) b.addEventListener("click", function () { go(i - 1, true); });
      return s;
    }
    function go(i, back) {
      if (!screens[i]) make(i);
      screens.forEach(function (s, k) { if (!s) return; s.classList.toggle("is-on", k === i); s.classList.toggle("is-past", k < i); });
      if (back) { sfx("swoosh", { gain: 0.2, rate: 1.2 }); } else if (at >= 0) { sfx("swoosh", { gain: 0.24, rate: 1.1 }); hap("tap"); }
      at = i;
      notes.forEach(function (n) { var k = NOTE.indexOf(n.getAttribute("data-note")); n.classList.toggle("is-now", k === i); n.classList.toggle("is-done", k > 0 && k < i); });
      if (i > 0) T("desk_step", { step: NOTE[i] || "done" });
    }
    function make(i) {
      if (i === 0) {
        var s0 = screen(0, "Handle A Sale", '<p class="app-cap">Open sales</p><ul class="app-list"><li><span class="app-open" style="flex:1"><span>R. Alvarez<span class="sub">2016 Honda Accord</span></span><span class="app-pill app-pill--ink">Waiting on ink</span></span></li><li><span class="app-open" style="flex:1"><span>K. Nguyen<span class="sub">2018 Toyota Camry</span></span><span class="app-pill">3 of 3 signed</span></span></li></ul><p class="app-fic">Fictional buyers and cars.</p>');
        var b = document.createElement("button"); b.className = "app-btn app-btn--gold"; b.type = "button"; b.textContent = "Start A Sale"; s0.querySelector(".app-scroll").appendChild(b);
        b.addEventListener("click", function () { fx("choice"); T("scene_interacted", { scene: "desk_start" }); go(1); });
      }
      if (i === 1) {
        var s1 = screen(1, "Which car?", '<p class="app-cap">On the lot</p><ul class="app-list">' + CARS.map(function (c, k) { return '<li class="is-tap" data-car="' + k + '"><span class="app-tile" style="background:' + c.c + '">' + CAR_SVG + '</span><span>' + c.y + " " + c.mk + '<span class="sub">Stock ' + c.st + ". " + money(c.price).replace(".00", "") + '</span></span><span class="chev"></span></li>'; }).join("") + "</ul>", true);
        $$("[data-car]", s1).forEach(function (li) { li.addEventListener("click", function () { deal.car = CARS[+li.getAttribute("data-car")]; fx("choice"); go(2); }); });
      }
      if (i === 2) {
        var s2 = screen(2, "What does the odometer say?", '<div class="app-odo" data-odo>0<small>miles, read from the dash</small></div><ul class="app-list"><li>Actual mileage<span class="app-switch" aria-hidden="true"></span></li></ul><button class="app-btn app-btn--gold" type="button" data-ok>That\'s right</button>', true);
        s2.querySelector("[data-ok]").addEventListener("click", function () { fx("choice"); go(3); });
      }
      if (i === 3) {
        var s3 = screen(3, "Who\'s buying?", '<div class="app-cam" data-cam><div class="app-lic"><b>JOHN A. MARTINEZ</b><i>1402 ELM ST, HOUSTON TX</i><i>DL 4821 **** 07</i><em>Sample</em></div><span class="app-cam__beam"></span><span class="app-cam__flash"></span><p class="app-cam__hint">Hold the license in the frame</p></div><button class="app-shutter" type="button" aria-label="Scan the license" data-shutter></button><ul class="app-list" data-fields><li>Name<span class="val val--b app-typed" data-f="0"></span></li><li>Address<span class="val app-typed" data-f="1"></span></li><li>License<span class="val app-typed" data-f="2"></span></li></ul><button class="app-btn app-btn--gold" type="button" data-ok disabled>Read it back: that\'s me</button>', true);
        var cam = s3.querySelector("[data-cam]"), shut = s3.querySelector("[data-shutter]"), okb = s3.querySelector("[data-ok]");
        setTimeout(function () { cam.classList.add("is-in"); }, 350);
        shut.addEventListener("click", function () {
          if (shut.disabled) return; shut.disabled = true;
          cam.classList.add("is-in", "is-shot", "is-scanning"); sfx("select", { gain: 0.9 }); hap("tap"); T("desk_step", { step: "scanned" });
          var vals = ["JOHN A. MARTINEZ", "1402 ELM ST, HOUSTON TX", "DL 4821 **** 07"];
          vals.forEach(function (v, k) { var el = s3.querySelector('[data-f="' + k + '"]'); setTimeout(function () { type(el, v); }, 700 + k * 380); });
          setTimeout(function () { okb.disabled = false; fx("unlock"); }, 2000);
        });
        okb.addEventListener("click", function () { deal.buyer = "J. Martinez"; fx("choice"); go(4); });
      }
      if (i === 4) {
        var s4 = screen(4, "How are they paying?", '<div class="app-seg" role="tablist"><i></i><button type="button" data-pay="cash">Cash</button><button type="button" data-pay="bhph" aria-label="Buy here, pay here">BHPH</button><button type="button" data-pay="bank">Bank</button></div><ul class="app-list" data-paynote><li>Paid in full at the desk</li></ul><button class="app-btn app-btn--gold" type="button" data-ok>Continue</button>', true);
        var seg = s4.querySelector(".app-seg i"), noteL = s4.querySelector("[data-paynote]");
        var NOTES = { cash: "<li>Paid in full at the desk</li>", bhph: '<li>Buy here, pay here<span class="val">The lot finances it</span></li><li>Down payment<span class="val val--b">$2,500.00</span></li><li>Payments<span class="val">Every two weeks</span></li>', bank: "<li>Lender<span class=\"val\">The buyer's bank</span></li><li>Their paperwork comes from the bank</li>" };
        $$("[data-pay]", s4).forEach(function (b, k) { b.addEventListener("click", function () { deal.pay = b.getAttribute("data-pay"); seg.style.transform = "translateX(" + k * 100 + "%)"; noteL.innerHTML = NOTES[deal.pay]; fx("choice"); }); });
        s4.querySelector("[data-ok]").addEventListener("click", function () { fx("choice"); go(5); });
      }
      if (i === 5) {
        var c = deal.car || CARS[0], tax = Math.round(c.price * TAX * 100) / 100, total = c.price + FEES.doc + tax + FEES.title + FEES.reg;
        var rows = [["Vehicle", c.price], ["Doc fee", FEES.doc], ["Sales tax", tax], ["Title", FEES.title], ["Registration", FEES.reg]];
        var extra = deal.pay === "bhph" ? '<li>Down payment<span class="val">' + money(-2500) + '</span></li><li class="app-total">Amount financed<span class="val val--b" data-m="' + (total - 2500) + '">$0.00</span></li>' : "";
        var s5 = screen(5, "The money", '<ul class="app-list app-receipt">' + rows.map(function (r) { return "<li>" + r[0] + '<span class="val" data-m="' + r[1] + '">$0.00</span></li>'; }).join("") + '<li class="app-total">Out the door<span class="val val--b" data-m="' + total + '">$0.00</span></li>' + extra + '</ul><p class="app-fic">Example figures for a fictional deal. The desk works these out from the deal on every sale.</p><button class="app-btn app-btn--gold" type="button" data-ok>The paperwork</button>', true);
        setTimeout(function () { $$("[data-m]", s5).forEach(function (el, k) { setTimeout(function () { roll(el, parseFloat(el.getAttribute("data-m"))); sfx("key", { gain: 0.25, throttle: 40 }); }, k * 140); }); }, 420);
        s5.querySelector("[data-ok]").addEventListener("click", function () { fx("choice"); go(6); });
      }
      if (i === 6) {
        var docs = ["Bill of Sale", "Title Application, Form 130-U", "Power of Attorney"]; if (deal.pay === "bhph") docs.push("Retail Installment Contract");
        var car = deal.car || CARS[0];
        var s6 = screen(6, "The paperwork", '<p class="app-cap">This deal needs</p><ul class="app-list">' + docs.map(function (d, k) { return '<li class="app-doc" data-doc="' + k + '">' + d + '<span class="tick">' + CHECK + "</span></li>"; }).join("") + '</ul><div class="app-paper"><b>Your Dealership. Bill of Sale.</b><span class="ln"><span>Buyer</span><span>John A. Martinez</span></span><span class="ln"><span>Vehicle</span><span>' + car.y + " " + car.mk + '</span></span><span class="ln"><span>Odometer</span><span>' + car.odo.toLocaleString("en-US") + ' actual</span></span><span class="ln"><span>Price</span><span>' + money(car.price) + '</span></span></div><button class="app-btn app-btn--gold" type="button" data-ok>Hand them the screen</button>', true);
        setTimeout(function () { $$("[data-doc]", s6).forEach(function (li, k) { setTimeout(function () { li.classList.add("is-in"); sfx("select", { gain: 0.35 }); hap("tap"); }, k * 260); }); }, 450);
        s6.querySelector("[data-ok]").addEventListener("click", function () { fx("choice"); go(7); });
      }
      if (i === 7) {
        var s7 = screen(7, "Sign here, John", '<p class="app-cap">Bill of Sale, page 1 of 1</p><ul class="app-list"><li>You\'re buying this car at the price above, and the paperwork says so.</li></ul><div class="app-sign"><canvas></canvas><span>John A. Martinez</span></div><button class="app-btn app-btn--gold" type="button" data-ok disabled>Sign and file</button><button class="app-btn" type="button" data-auto style="background:#e3e3e8;color:#111">Sign for me</button>', true);
        var cv = s7.querySelector("canvas"), ok7 = s7.querySelector("[data-ok]"), ctx = null, drawing = false, ink = 0;
        var size = function () { var r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2); cv.width = r.width * dpr; cv.height = r.height * dpr; ctx = cv.getContext("2d"); ctx.scale(dpr, dpr); ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#111"; };
        var pt = function (e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
        cv.addEventListener("pointerdown", function (e) { if (!ctx) size(); drawing = true; cv.setPointerCapture(e.pointerId); var p = pt(e); ctx.beginPath(); ctx.moveTo(p[0], p[1]); });
        cv.addEventListener("pointermove", function (e) { if (!drawing) return; var p = pt(e); ctx.lineTo(p[0], p[1]); ctx.stroke(); ink++; if (ink > 12) ok7.disabled = false; });
        cv.addEventListener("pointerup", function () { drawing = false; });
        s7.querySelector("[data-auto]").addEventListener("click", function () {
          if (!ctx) size(); var w = cv.clientWidth, h = cv.clientHeight; ctx.beginPath();
          for (var k = 0; k <= 60; k++) { var x = 20 + k / 60 * (w - 40), y = h * 0.55 + Math.sin(k / 4) * 12 * Math.sin(k / 19 * Math.PI); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
          ctx.stroke(); ok7.disabled = false; fx("choice");
        });
        ok7.addEventListener("click", function () { filed(); });
      }
      if (i === 8) {
        var s8 = document.createElement("section"); s8.className = "app-screen"; s8.setAttribute("aria-label", "Filed");
        s8.innerHTML = '<div class="app-done"><div><svg class="app-done__ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46"/><path d="M30 52l13 13 27-29"/></svg><h4>Filed.</h4><p>' + (deal.pay === "bhph" ? "4 of 4" : "3 of 3") + ' signed. On file with the sale, ready to print for ink where ink is required.</p><button class="app-btn" type="button" data-again style="margin:22px 0 0;width:100%">Start another sale</button></div></div>';
        stack.appendChild(s8); screens[8] = s8;
        s8.querySelector("[data-again]").addEventListener("click", function () { screens.slice(1).forEach(function (s) { if (s) s.remove(); }); screens.length = 1; deal = { car: null, pay: "cash" }; fx("choice"); go(0, true); });
      }
    }
    function filed() {
      go(8); fx("unlock"); hap("success");
      island.classList.add("is-wide"); setTimeout(function () { island.classList.remove("is-wide"); }, 2600);
      T("desk_finished", { pay: deal.pay });
      setTimeout(function () { if (window.JG_NOTIFY) window.JG_NOTIFY({ icon: "assets/brand/obavia-icon.png", app: "Obavia", title: "Deal on file", body: "J. Martinez. Fictional buyer, example figures. This is the desk Obavia is built from.", ms: 5200 }); }, 900);
    }
    function type(el, v) { var k = 0; (function f() { el.textContent = v.slice(0, ++k); if (k % 2) sfx("key", { gain: 0.2, throttle: 35 }); if (k < v.length) setTimeout(f, RM ? 0 : 26); })(); }
    function roll(el, to) { var t0 = performance.now(), dur = RM ? 1 : 700; (function f(now) { var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = money(to * e); if (p < 1) requestAnimationFrame(f); })(t0); }
    /* the odometer spins up when its screen arrives */
    var obs = new MutationObserver(function () {
      var s2 = screens[2]; if (!s2 || !s2.classList.contains("is-on") || s2._spun) return; s2._spun = 1;
      var o = s2.querySelector("[data-odo]"), to = (deal.car || CARS[0]).odo, t0 = performance.now();
      (function f(now) { var p = Math.min(1, (now - t0) / (RM ? 1 : 900)), e = 1 - Math.pow(1 - p, 4); o.firstChild.nodeValue = Math.round(to * e).toLocaleString("en-US"); if (p < 1) requestAnimationFrame(f); })(t0);
    });
    obs.observe(stack, { attributes: true, subtree: true, attributeFilter: ["class"] });
    make(0); requestAnimationFrame(function () { go(0); });
  }
  var deskHost = $("[data-desk-app]"), built = false;
  function ensureDesk() { if (built || !deskHost) return; built = true; buildDesk(deskHost); }
  document.addEventListener("jg:story-open", function (e) { if (e.detail.id === "desk") ensureDesk(); });
  if (deskHost && "IntersectionObserver" in window) new IntersectionObserver(function (en) { if (en[0].isIntersecting) ensureDesk(); }).observe(deskHost);

  /* keys: P opens the desk, T plays your cut */
  addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (document.querySelector("dialog[open]") || openCard || (window.JG_REEL && window.JG_REEL.open())) return;
    if (e.key === "p" || e.key === "P") { e.preventDefault(); e.stopImmediatePropagation(); openStory("desk", "key"); }
    else if (e.key === "t" || e.key === "T") { e.preventDefault(); e.stopImmediatePropagation(); playCut(); }
  }, true);
})();
