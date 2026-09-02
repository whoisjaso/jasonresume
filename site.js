/* Jason Obawemimo: scroll feel, reveals, navigation, and the intake */
(function () {
  "use strict";

  var RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FINE = window.matchMedia("(pointer: fine)").matches;
  var body = document.body;

  function locked() {
    return body.classList.contains("is-loading") || body.classList.contains("is-gated") || body.classList.contains("is-card") || body.classList.contains("menu-open");
  }

  /* ------------------------------------------------------------
     Scroll feel. Wheel input is eased on pointer devices; touch,
     keyboard and anchors stay native. One tween serves the guide.
     ------------------------------------------------------------ */
  var target = window.scrollY, current = window.scrollY, raf = null, tween = null;
  function maxY() { return Math.max(0, document.documentElement.scrollHeight - window.innerHeight); }

  function loop() {
    current += (target - current) * 0.11;
    if (Math.abs(target - current) < 0.4) { current = target; window.scrollTo(0, current); raf = null; return; }
    window.scrollTo(0, current);
    raf = requestAnimationFrame(loop);
  }

  if (FINE && !RM) {
    window.addEventListener("wheel", function (e) {
      if (locked() || e.ctrlKey) return;
      if (e.target.closest && e.target.closest("[data-native-scroll]")) return;
      e.preventDefault();
      if (tween) { cancelAnimationFrame(tween); tween = null; }
      var d = e.deltaY;
      if (e.deltaMode === 1) d *= 16; else if (e.deltaMode === 2) d *= window.innerHeight;
      d = Math.max(-260, Math.min(260, d));
      target = Math.max(0, Math.min(maxY(), target + d));
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: false });
  }

  window.addEventListener("scroll", function () {
    if (!raf && !tween) { target = current = window.scrollY; }
  }, { passive: true });

  function easeInOutCubic(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  window.JG_SCROLL_TO = function (y, dur) {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    if (tween) { cancelAnimationFrame(tween); tween = null; }
    y = Math.max(0, Math.min(maxY(), y));
    if (!dur || RM) { window.scrollTo(0, y); target = current = y; return; }
    var from = window.scrollY, t0 = performance.now();
    (function step(now) {
      var p = Math.min(1, (now - t0) / dur);
      var v = from + (y - from) * easeInOutCubic(p);
      window.scrollTo(0, v);
      if (p < 1) tween = requestAnimationFrame(step);
      else { tween = null; target = current = y; }
    })(t0);
  };

  /* ------------------------------------------------------------
     Reveal on scroll
     ------------------------------------------------------------ */
  var revealEls = document.querySelectorAll("[data-reveal], .section__head");
  if ("IntersectionObserver" in window && !RM) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in-view"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.05 });
    revealEls.forEach(function (n) { io.observe(n); });
  } else {
    revealEls.forEach(function (n) { n.classList.add("in-view"); });
  }

  function revealHash() {
    if (!location.hash) return;
    var t = document.getElementById(location.hash.slice(1));
    if (t) t.querySelectorAll("[data-reveal], .section__head").forEach(function (n) { n.classList.add("in-view"); });
  }
  revealHash();
  window.addEventListener("hashchange", revealHash);

  /* ventures warm as you enter them */
  var ventures = document.querySelectorAll("[data-venture]");
  if (ventures.length && "IntersectionObserver" in window) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle("is-near", en.isIntersecting); });
    }, { rootMargin: "-18% 0px -18% 0px", threshold: 0 });
    ventures.forEach(function (n) { vio.observe(n); });
  }

  /* ------------------------------------------------------------
     Ambience: the portrait tilts toward the pointer, gold dust drifts
     ------------------------------------------------------------ */
  var hero = document.querySelector(".hero"), portrait = document.querySelector(".hero__portrait[data-tilt]");
  var hidden = false; document.addEventListener("visibilitychange", function () { hidden = document.hidden; });
  if (hero && portrait && FINE && !RM) {
    var tiltRaf = null, tx = 0, ty = 0;
    hero.addEventListener("pointermove", function (e) {
      var r = portrait.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      tx = Math.max(-1, Math.min(1, (e.clientX - cx) / (innerWidth / 2))); ty = Math.max(-1, Math.min(1, (e.clientY - cy) / (innerHeight / 2)));
      if (!tiltRaf) tiltRaf = requestAnimationFrame(function () { portrait.style.transform = "perspective(1200px) rotateY(" + (tx * 6).toFixed(2) + "deg) rotateX(" + (-ty * 5).toFixed(2) + "deg)"; tiltRaf = null; });
    }, { passive: true });
    hero.addEventListener("pointerleave", function () { portrait.style.transform = ""; });
  }
  /* The laptop plays only while it is on screen, and never on a metered connection */
  var film = document.querySelector(".device__film");
  if (film) {
    var cheap = matchMedia("(prefers-reduced-data: reduce)").matches || (navigator.connection && navigator.connection.saveData);
    if (cheap || RM) { film.removeAttribute("autoplay"); film.preload = "none"; }
    else if ("IntersectionObserver" in window) {
      var fio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { if (film.preload === "none") film.preload = "auto"; var p = film.play(); if (p && p.catch) p.catch(function () {}); }
          else if (!film.paused) film.pause();
        });
      }, { threshold: 0.25 });
      fio.observe(film);
    }
  }

  /* ------------------------------------------------------------
     Nav
     ------------------------------------------------------------ */
  var nav = document.querySelector(".nav"), ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      if (nav) nav.classList.toggle("is-scrolled", window.scrollY > 24);
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var burger = document.querySelector(".nav__burger"), menu = document.getElementById("site-menu");
  function setMenu(o) {
    body.classList.toggle("menu-open", o);
    if (burger) { burger.setAttribute("aria-expanded", o ? "true" : "false"); burger.setAttribute("aria-label", o ? "Close menu" : "Open menu"); }
    if (menu && o) setTimeout(function () { var f = menu.querySelector("a,button"); if (f) f.focus({ preventScroll: true }); }, 350);
    if (!o && burger && menu && menu.contains(document.activeElement)) burger.focus({ preventScroll: true });
  }
  if (burger) burger.addEventListener("click", function () { setMenu(!body.classList.contains("menu-open")); });
  document.querySelectorAll(".menu a").forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
  document.addEventListener("keydown", function (e) {
    if (!body.classList.contains("menu-open")) return;
    if (e.key === "Escape") return setMenu(false);
    if (e.key === "Tab" && menu) {
      var f = menu.querySelectorAll("a,button"), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === burger)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); burger.focus(); }
    }
  });

  /* ------------------------------------------------------------
     The intake. Nothing leaves the browser.
     ------------------------------------------------------------ */
  var board = document.getElementById("intake-readout");
  if (!board) return;
  var takeEl = document.getElementById("intake-take");
  var sendEl = document.getElementById("intake-send");
  var copyEl = document.getElementById("intake-copy");
  var flashEl = document.getElementById("intake-flash");

  var PAIN = {
    found: { phrase: "nobody finds us", subject: "getting found", take: "Being hard to find is the cheapest problem here to fix and the slowest to pay back. Before spending on traffic I would check whether the pages you already have state the offer inside the first screen." },
    convert: { phrase: "traffic that never becomes a lead", subject: "traffic that does not convert", take: "Traffic that does not convert is rarely a traffic problem. Usually the page asks for a decision before it has earned one, or the lead lands somewhere nobody owns." },
    paper: { phrase: "paperwork and compliance", subject: "paperwork and compliance", take: "This is the one I have lived hardest. Deal Packet Checker exists because a returned packet costs three weeks and sometimes the deal. The work starts with finding which single document actually causes the kickback." },
    followup: { phrase: "follow-up after first contact", subject: "follow-up that does not happen", take: "Follow-up failure is structural, not effort. If the next action is not written down and assigned to a person, it does not survive a busy day." },
    tribal: { phrase: "a process that only lives in my head", subject: "undocumented process", take: "A process that lives in one head is a single point of failure drawing a salary. Writing it down is boring, and it is usually the highest-return week of work on the table." }
  };
  var COST = {
    under5: { phrase: "under 5 hours a week", take: "Under five hours a week, this is worth tightening rather than rebuilding." },
    "5to15": { phrase: "5 to 15 hours a week", take: "At five to fifteen hours a week there is real money in systemising it." },
    "15to40": { phrase: "15 to 40 hours a week", take: "At fifteen to forty hours a week you are already paying for a system, just not one that exists." },
    role: { phrase: "more than one full-time role", take: "More than a full-time role means this is quietly the most expensive employee in the business." }
  };
  var WHEN = {
    "30": { phrase: "inside 30 days", take: "Inside thirty days means we scope narrow and ship one thing that works, then widen." },
    quarter: { phrase: "this quarter", take: "A quarter is enough to build it properly and leave the documentation behind." },
    scoping: { phrase: "as soon as it is scoped", take: "Scoping first is the right instinct. A short call normally settles whether this is a one-week fix or a build." }
  };
  var state = { 1: null, 2: null, 3: null };

  function brief() {
    var p = PAIN[state[1]], c = COST[state[2]], w = WHEN[state[3]];
    if (!p || !c || !w) return null;
    return {
      subject: "Systems brief: " + p.subject,
      body: "Jason,\n\nThe part of the business eating the most time right now is " + p.phrase + ".\nIt costs us roughly " + c.phrase + ".\nWe would want it running " + w.phrase + ".\n\nA bit more context:\n\n\nBusiness:\nWebsite:\nBest number to reach me:\n"
    };
  }
  function render() {
    var p = PAIN[state[1]], c = COST[state[2]], w = WHEN[state[3]];
    var ghost = '<span class="intake__ghost">&hellip;</span>';
    board.innerHTML = (!p && !c && !w)
      ? '<span class="intake__ghost">Pick the three above and your brief writes itself here.</span>'
      : "The part eating the most time is " + (p ? "<b>" + p.phrase + "</b>" : ghost) + ". It costs " + (c ? "<b>" + c.phrase + "</b>" : ghost) + ". It needs to be running " + (w ? "<b>" + w.phrase + "</b>" : ghost) + ".";
    takeEl.textContent = [p && p.take, c && c.take, w && w.take].filter(Boolean).join(" ");
    var b = brief(), ready = !!b;
    sendEl.setAttribute("aria-disabled", ready ? "false" : "true");
    copyEl.setAttribute("aria-disabled", ready ? "false" : "true");
    copyEl.disabled = !ready;
    sendEl.href = ready ? "mailto:jobawems@gmail.com?subject=" + encodeURIComponent(b.subject) + "&body=" + encodeURIComponent(b.body) : "mailto:jobawems@gmail.com";
    sendEl.querySelector("span").textContent = ready ? "Open in mail" : "Pick all three";
  }
  function press(step, key) {
    document.querySelectorAll('.opt[data-step="' + step + '"]').forEach(function (s) {
      s.setAttribute("aria-pressed", s.dataset.key === key ? "true" : "false");
    });
    state[step] = key;
  }
  document.querySelectorAll(".opt").forEach(function (b) {
    b.addEventListener("click", function () {
      var already = state[b.dataset.step] === b.dataset.key;
      press(b.dataset.step, already ? null : b.dataset.key);
      if (flashEl) flashEl.classList.remove("is-on");
      render();
    });
  });
  copyEl.addEventListener("click", function () {
    var b = brief();
    if (!b || !navigator.clipboard) return;
    navigator.clipboard.writeText(b.subject + "\n\n" + b.body).then(function () {
      flashEl.classList.add("is-on");
      setTimeout(function () { flashEl.classList.remove("is-on"); }, 2200);
    });
  });

  /* The guide hands its answers here */
  window.INTAKE_PREFILL = function (o) {
    if (o.pain && PAIN[o.pain]) press(1, o.pain);
    if (o.cost && COST[o.cost]) press(2, o.cost);
    render();
  };

  render();
})();
