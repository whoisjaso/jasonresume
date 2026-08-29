/* Jason Obawemimo: scroll choreography, navigation, and the intake */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- reveal on scroll ---- */
  var revealEls = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in-view"); });
  }

  function revealHashTarget() {
    if (!window.location.hash) return;
    var target = document.getElementById(window.location.hash.slice(1));
    if (!target) return;
    target.querySelectorAll("[data-reveal]").forEach(function (el) {
      el.classList.add("in-view");
    });
  }

  revealHashTarget();
  window.addEventListener("hashchange", revealHashTarget);

  /* ---- venture sections warm as you enter them ---- */
  var ventures = document.querySelectorAll("[data-venture]");
  if (ventures.length && "IntersectionObserver" in window) {
    var vio = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          entry.target.classList.toggle("is-near", entry.isIntersecting);
        });
      },
      { rootMargin: "-18% 0px -18% 0px", threshold: 0 }
    );
    ventures.forEach(function (el) { vio.observe(el); });
  }

  /* ---- nav state + progress hairline ---- */
  var nav = document.querySelector(".nav");
  var progress = document.querySelector(".progress");
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY || 0;
      if (nav) nav.classList.toggle("is-scrolled", y > 24);
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(y / max, 1) : 0;
      if (progress) progress.style.transform = "scaleX(" + p + ")";
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- ambient work lamp, pointer devices only ---- */
  var lamp = document.querySelector(".lamp");
  if (lamp && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    var lampRaf = null;
    window.addEventListener("pointermove", function (e) {
      if (lampRaf) return;
      lampRaf = requestAnimationFrame(function () {
        lamp.style.setProperty("--lx", e.clientX + "px");
        lamp.style.setProperty("--ly", e.clientY + "px");
        lamp.classList.add("is-lit");
        lampRaf = null;
      });
    }, { passive: true });
  }

  /* ---- mobile menu ---- */
  var burger = document.querySelector(".nav__burger");
  var menuLinks = document.querySelectorAll(".menu a");

  function setMenu(open) {
    document.body.classList.toggle("menu-open", open);
    if (burger) {
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
  }

  if (burger) {
    burger.addEventListener("click", function () {
      setMenu(!document.body.classList.contains("menu-open"));
    });
  }

  menuLinks.forEach(function (link) {
    link.addEventListener("click", function () { setMenu(false); });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setMenu(false);
  });

  /* ------------------------------------------------------------
     The intake. Nothing leaves the browser; it composes a message
     the visitor sends themselves.
     ------------------------------------------------------------ */

  var board = document.getElementById("intake-readout");
  if (!board) return;

  var takeEl = document.getElementById("intake-take");
  var sendEl = document.getElementById("intake-send");
  var copyEl = document.getElementById("intake-copy");
  var flashEl = document.getElementById("intake-flash");

  var PAIN = {
    found: {
      phrase: "nobody finds us",
      subject: "getting found",
      take: "Being hard to find is the cheapest problem here to fix and the slowest to pay back. Before spending on traffic I would want to check whether the pages you already have state the offer inside the first screen."
    },
    convert: {
      phrase: "traffic that never becomes a lead",
      subject: "traffic that does not convert",
      take: "Traffic that does not convert is rarely a traffic problem. Usually the page asks for a decision before it has earned one, or the lead lands somewhere nobody owns."
    },
    paper: {
      phrase: "paperwork and compliance",
      subject: "paperwork and compliance",
      take: "This is the one I have lived hardest. Deal Packet Checker exists because a returned packet costs three weeks and sometimes the deal. The work starts with finding which single document actually causes the kickback."
    },
    followup: {
      phrase: "follow-up after first contact",
      subject: "follow-up that does not happen",
      take: "Follow-up failure is structural, not effort. If the next action is not written down and assigned to a person, it does not survive a busy day."
    },
    tribal: {
      phrase: "a process that only lives in my head",
      subject: "undocumented process",
      take: "A process that lives in one head is a single point of failure drawing a salary. Writing it down is boring, and it is usually the highest-return week of work on the table."
    }
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

  function currentBrief() {
    var pain = PAIN[state[1]];
    var cost = COST[state[2]];
    var when = WHEN[state[3]];
    if (!pain || !cost || !when) return null;
    return {
      subject: "Systems brief: " + pain.subject,
      body:
        "Jason,\n\n" +
        "The part of the business eating the most time right now is " + pain.phrase + ".\n" +
        "It costs us roughly " + cost.phrase + ".\n" +
        "We would want it running " + when.phrase + ".\n\n" +
        "A bit more context:\n\n\n" +
        "Business:\nWebsite:\nBest number to reach me:\n"
    };
  }

  function render() {
    var pain = PAIN[state[1]];
    var cost = COST[state[2]];
    var when = WHEN[state[3]];

    if (!pain && !cost && !when) {
      board.innerHTML = '<span class="intake__ghost">Pick the three above and your brief writes itself here.</span>';
    } else {
      board.innerHTML =
        "The part eating the most time is " +
        (pain ? "<b>" + pain.phrase + "</b>" : '<span class="intake__ghost">&hellip;</span>') +
        ". It costs " +
        (cost ? "<b>" + cost.phrase + "</b>" : '<span class="intake__ghost">&hellip;</span>') +
        ". It needs to be running " +
        (when ? "<b>" + when.phrase + "</b>" : '<span class="intake__ghost">&hellip;</span>') +
        ".";
    }

    var takes = [];
    if (pain) takes.push(pain.take);
    if (cost) takes.push(cost.take);
    if (when) takes.push(when.take);
    takeEl.textContent = takes.join(" ");

    var brief = currentBrief();
    var ready = !!brief;

    sendEl.setAttribute("aria-disabled", ready ? "false" : "true");
    copyEl.setAttribute("aria-disabled", ready ? "false" : "true");
    copyEl.disabled = !ready;

    sendEl.href = ready
      ? "mailto:jobawems@gmail.com?subject=" +
        encodeURIComponent(brief.subject) +
        "&body=" +
        encodeURIComponent(brief.body)
      : "mailto:jobawems@gmail.com";

    sendEl.querySelector("span").textContent = ready ? "Open in mail" : "Pick all three";
  }

  document.querySelectorAll(".opt").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var step = btn.dataset.step;
      var key = btn.dataset.key;
      var already = state[step] === key;

      document.querySelectorAll('.opt[data-step="' + step + '"]').forEach(function (sib) {
        sib.setAttribute("aria-pressed", "false");
      });

      state[step] = already ? null : key;
      if (!already) btn.setAttribute("aria-pressed", "true");

      if (flashEl) flashEl.classList.remove("is-on");
      render();
    });
  });

  copyEl.addEventListener("click", function () {
    var brief = currentBrief();
    if (!brief || !navigator.clipboard) return;
    navigator.clipboard.writeText(brief.subject + "\n\n" + brief.body).then(
      function () {
        flashEl.classList.add("is-on");
        window.setTimeout(function () { flashEl.classList.remove("is-on"); }, 2200);
      },
      function () {
        flashEl.textContent = "Press Ctrl C to copy";
        flashEl.classList.add("is-on");
      }
    );
  });

  render();
})();
