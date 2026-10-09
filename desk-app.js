/* The desk you can run: Handle a Sale as an iPhone app, one question per
   screen, with a fictional buyer and example figures. It builds itself into
   any [data-desk-app] when that comes into view: inside the Lead to Title
   title on the home page and in Run a sale on /obavia.html. Its feedback goes
   through hud.js (window.JG_FX, JG_NOTIFY); score.js keeps the old JG_SFX
   calls quiet. window.JG_DESK.build(el) builds one on demand. */
(function () {
  "use strict";
  var root = document.documentElement;
  var RM = matchMedia("(prefers-reduced-motion: reduce)").matches || root.hasAttribute("data-still");
  var T = window.JG_TRACK || function () {};
  function fx(k) { if (window.JG_FX) window.JG_FX(k); }
  function sfx(n, o) { return window.JG_SFX ? window.JG_SFX.play(n, o) : false; }
  function hap(k) { if (window.JG_HAPTIC) window.JG_HAPTIC(k); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }

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
        var s0 = screen(0, "Handle A Sale", '<p class="app-cap">Open sales</p><ul class="app-list"><li><span class="app-open" style="flex:1"><span>R. Alvarez<span class="sub">2016 Honda Accord</span></span><span class="app-pill app-pill--ink">Waiting on ink</span></span></li><li><span class="app-open" style="flex:1"><span>K. Nguyen<span class="sub">2018 Toyota Camry</span></span><span class="app-pill">3 of 3 signed</span></span></li></ul><p class="app-cap">On the lot</p><ul class="app-list">' + CARS.slice(0, 2).map(function (c) { return '<li><span class="app-tile" style="background:' + c.c + '">' + CAR_SVG + '</span><span>' + c.y + ' ' + c.mk + '<span class="sub">Stock ' + c.st + '</span></span></li>'; }).join("") + '</ul><p class="app-fic">Fictional buyers and cars.</p>');
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
  $$("[data-desk-app]").forEach(function (host) {
    var built = false;
    var ensure = function () { if (built) return; built = true; buildDesk(host); };
    if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { if (en[0].isIntersecting) ensure(); }, { rootMargin: "200px 0px" }).observe(host);
    else ensure();
  });
  window.JG_DESK = { build: buildDesk };

})();
