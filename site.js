/* Jason Obawemimo — scroll choreography & navigation */
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

  /* ---- nav state + progress hairline ---- */
  var nav = document.querySelector(".nav");
  var progress = document.querySelector(".progress");
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY || 0;
      nav.classList.toggle("is-scrolled", y > 24);
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(y / max, 1) : 0;
      progress.style.transform = "scaleX(" + p + ")";
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- mobile menu ---- */
  var burger = document.querySelector(".nav__burger");
  var menuLinks = document.querySelectorAll(".menu a");

  function setMenu(open) {
    document.body.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  burger.addEventListener("click", function () {
    setMenu(!document.body.classList.contains("menu-open"));
  });

  menuLinks.forEach(function (link) {
    link.addEventListener("click", function () { setMenu(false); });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setMenu(false);
  });
})();
