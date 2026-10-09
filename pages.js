/* The Obavia page: the bar and the section tabs (Q and E), the films and the
   screen loops, the lessons menu, the get bar, the calendar and the
   early-access desk. It runs on hud.js (window.JG_FX feedback, toasts, the
   Houston clock) and score.js (sound only while the score is on); tracking
   lives in track.js. The page reads complete without any of it. */
(function () {
  "use strict";
  var root = document.documentElement, body = document.body;
  var RM = matchMedia("(prefers-reduced-motion: reduce)");
  function track(event, props) { if (window.JG_TRACK) window.JG_TRACK(event, props); }
  function FX(k) { if (window.JG_FX) window.JG_FX(k); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function still() { return RM.matches || root.hasAttribute("data-still"); }

  /* ---------- the unlock moment: light, haptic and (score on) the sting, in one frame ---------- */
  var flash = document.createElement("div"); flash.className = "flash"; flash.setAttribute("aria-hidden", "true"); body.appendChild(flash);
  function unlock() { flash.classList.remove("is-on"); void flash.offsetWidth; flash.classList.add("is-on"); FX("unlock"); }

  /* ---------- the bar and the tabs ---------- */
  var bar = $(".ob-sys"), hero = $(".ob-hero"), nav = $(".ob-tabs");
  var tabs = nav ? $$('a[href^="#"]', nav) : [];
  var secs = tabs.map(function (t) { return document.getElementById(t.getAttribute("href").slice(1)); });
  var at = -1, marked = -1;
  function chrome() { return (bar && getComputedStyle(bar).position === "fixed" ? bar.offsetHeight : 0) + (nav ? nav.offsetHeight : 0); }
  function mark(i) {
    if (i === marked) return; marked = i;
    tabs.forEach(function (t, k) { var on = k === i; t.classList.toggle("is-on", on); if (on) t.setAttribute("aria-current", "true"); else t.removeAttribute("aria-current"); });
    /* on a phone the tabs scroll sideways: keep the lit one in view */
    if (nav && tabs[i] && nav.scrollWidth > nav.clientWidth + 2) nav.scrollTo({ left: Math.max(0, tabs[i].offsetLeft - 24), behavior: still() ? "auto" : "smooth" });
  }
  function sync() {
    if (bar && hero) bar.classList.toggle("is-solid", hero.getBoundingClientRect().bottom <= bar.offsetHeight + 1);
    var y = chrome() + 30, i = -1;
    secs.forEach(function (s, k) { if (s && s.getBoundingClientRect().top <= y) i = k; });
    /* at the very bottom the last section is the one you are in */
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4 && secs.length) i = secs.length - 1;
    at = i; mark(Math.max(0, i));
  }
  var ticking = false;
  addEventListener("scroll", function () { if (ticking) return; ticking = true; requestAnimationFrame(function () { ticking = false; sync(); }); }, { passive: true });
  addEventListener("resize", sync);
  sync();

  /* moving to a part of the page: smooth, under the bar and the tabs, focus follows */
  function jump(el, focus) {
    if (!el) return;
    var top = el === hero || el.id === "top" ? 0 : el.getBoundingClientRect().top + scrollY - chrome();
    scrollTo({ top: Math.max(0, top), behavior: still() ? "auto" : "smooth" });
    var h = focus && (el.matches("h1,h2,h3") ? el : $("h1,h2,h3", el));
    if (h) { if (!h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }
  function setHash(id) { try { history.replaceState(history.state, "", location.pathname + location.search + "#" + id); } catch (e) {} }
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
    var id = a.getAttribute("href").slice(1), el = id && document.getElementById(id); if (!el) return;
    var i = tabs.indexOf(a);
    e.preventDefault(); jump(el, i < 0); setHash(id);
    if (i >= 0) { mark(i); FX("key"); } else FX("choice");
  });
  /* Q and E (or [ and ]) step through the sections, like the tabs inside a title */
  addEventListener("keydown", function (e) {
    if (!tabs.length || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (root.classList.contains("intro-on") || document.querySelector("dialog[open]")) return;
    var k = e.key, d = (k === "q" || k === "Q" || k === "[") ? -1 : (k === "e" || k === "E" || k === "]") ? 1 : 0;
    if (!d) return;
    e.preventDefault();
    var n = at < 0 ? (d > 0 ? 0 : tabs.length - 1) : (at + d + tabs.length) % tabs.length;
    jump(secs[n]); mark(n); setHash(secs[n].id); FX("key");
  });

  /* ---------- older links: the story ids from the dash days land on their section ---------- */
  var HASH = location.hash, LEGACY = { "#story-desk": "run", "#story-drive": "run", "#story-obavia": "top" };
  function target(h) {
    if (!h || h.length < 2) return null;
    if (LEGACY[h]) return document.getElementById(LEGACY[h]);
    try { return document.getElementById(decodeURIComponent(h.slice(1))); } catch (e) { return null; }
  }
  window.JG_STORY = window.JG_STORY || function (id, how) {
    var alt = $('[data-story-alt~="' + id + '"]'); if (!alt) return;
    jump(alt, true); FX("arrive"); track("story_opened", { story: id, how: how || "tap" });
  };
  function land() {
    var t = target(HASH); if (!t) return;
    if (LEGACY[HASH]) setHash(t.id);
    if (t.id !== "top") jump(t);
  }
  /* the title screen plays first on an arrival from outside; the link lands when it ends */
  if (root.classList.contains("intro-pending")) document.addEventListener("jg:intro-done", function () { setTimeout(land, 80); });
  else if (LEGACY[HASH]) addEventListener("load", function () { setTimeout(land, 80); });

  /* ---------- the films: one plays at a time, with sound ---------- */
  var boxes = $$("[data-film-box]");
  boxes.forEach(function (box) {
    var video = $("video", box), play = $("[data-film-play]", box), name = video.getAttribute("data-film"), done = false;
    function start() {
      boxes.forEach(function (b) { if (b !== box) $("video", b).pause(); });
      box.classList.add("is-playing"); video.controls = true; video.muted = false;
      var p = video.play(); if (p && p.catch) p.catch(function () { video.muted = true; var q = video.play(); if (q && q.catch) q.catch(function () {}); });
      FX("choice"); track("film_play", { film: name });
    }
    box._start = start;
    if (play) play.addEventListener("click", start);
    video.addEventListener("play", function () { box.classList.add("is-playing"); });
    video.addEventListener("ended", function () { if (!done) { done = true; track("film_complete", { film: name }); } box.classList.remove("is-playing"); video.controls = false; });
  });

  /* ---------- the screen loops play only while on screen ---------- */
  var SAVE = navigator.connection && navigator.connection.saveData;
  var loops = $$("video[data-loop]");
  if (!still() && !SAVE && "IntersectionObserver" in window) {
    var lio = new IntersectionObserver(function (en) {
      en.forEach(function (x) { var v = x.target; if (x.isIntersecting) { if (v.preload === "none") v.preload = "auto"; var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause(); });
    }, { threshold: 0.35 });
    loops.forEach(function (v) { lio.observe(v); });
  }

  /* ---------- the lessons: pick one from the menu and it plays ---------- */
  var lessons = $("[data-lessons]");
  if (lessons) {
    var picks = $$("[data-pick]", lessons), figs = $$("[data-film-box]", lessons);
    var pick = function (i) {
      picks.forEach(function (p, k) { p.classList.toggle("is-on", k === i); p.setAttribute("aria-pressed", k === i ? "true" : "false"); });
      figs.forEach(function (f, k) { f.classList.toggle("is-on", k === i); if (k !== i) $("video", f).pause(); });
      if (figs[i] && figs[i]._start) figs[i]._start();
    };
    picks.forEach(function (p, i) { p.addEventListener("click", function () { pick(i); }); });
    lessons.classList.add("has-menu");
  }

  /* ---------- the get bar steps aside at the top and at the form ---------- */
  var getbar = $("[data-getbar]"), early = document.getElementById("early");
  if (getbar && early && "IntersectionObserver" in window) {
    var seen = { head: true, early: false };
    var away = function () { getbar.classList.toggle("is-away", seen.head || seen.early); };
    new IntersectionObserver(function (en) { en.forEach(function (x) { seen.early = x.isIntersecting; }); away(); }, { threshold: 0 }).observe(early);
    if (hero) new IntersectionObserver(function (en) { seen.head = en[0].isIntersecting; away(); }, { rootMargin: "0px 0px -35% 0px" }).observe(hero);
    away();
  }

  /* ---------- the calendar ---------- */
  var cal = $(".calendly-inline-widget");
  if (cal) {
    var s = document.createElement("script"); s.src = "https://assets.calendly.com/assets/external/widget.js"; s.async = true;
    var io = "IntersectionObserver" in window ? new IntersectionObserver(function (en) { if (en[0].isIntersecting) { document.head.appendChild(s); io.disconnect(); } }, { rootMargin: "400px 0px" }) : null;
    if (io) io.observe(cal); else document.head.appendChild(s);
    window.addEventListener("message", function (e) {
      if (!e.data || typeof e.data.event !== "string" || e.data.event.indexOf("calendly.") !== 0) return;
      if (e.data.event === "calendly.event_scheduled") {
        track("call_booked", {}); unlock();
        var b = $('[name="booked"]'); if (b) b.value = "yes";
        var note = document.getElementById("note-head"); if (note) note.textContent = "Booked. Tell me about your lot.";
      }
    });
  }
  /* [data-book] clicks are tracked by track.js and given their feedback by hud.js */

  /* ---------- the name given at the title screen fills the form ---------- */
  function prefill() {
    var n = document.getElementById("l-name"), v = "", lot = ""; try { v = localStorage.getItem("jg_name") || ""; lot = localStorage.getItem("jg_lot") || ""; } catch (e) {}
    if (n && v && !n.value) n.value = v;
    /* a dealer who built a card for the problem on their lot arrives with it named */
    var t = document.getElementById("l-note"); if (t && lot && !t.value) t.value = "What's slowing my lot down: " + lot.toLowerCase() + ". ";
  }
  prefill(); document.addEventListener("jg:intro-done", function () { setTimeout(prefill, 100); });

  /* ---------- the desks ---------- */
  $$("form[data-desk]").forEach(function (form) {
    var status = $(".form__status", form), btn = $('button[type="submit"]', form), sent = document.getElementById(form.dataset.sent);
    var mail = form.dataset.mailto || "jobawems@gmail.com";
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) { return; }
      var data = {}; new FormData(form).forEach(function (v, k) { data[k] = v; });
      if (window.JG_ID) data.vid = window.JG_ID;
      btn.disabled = true; status.className = "form__status"; status.textContent = "Sending.";
      fetch("/api/" + form.dataset.desk, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (r) {
          if (!r.ok) throw new Error(r.j && r.j.error || "failed");
          form.classList.add("is-sent"); status.textContent = "";
          if (sent) {
            sent.classList.add("is-in");
            if (r.j.delivered === false) {
              var subject = encodeURIComponent(form.dataset.subject || "From the site");
              var bodyText = encodeURIComponent(Object.keys(data).filter(function (k) { return k !== "website"; }).map(function (k) { return k + ": " + data[k]; }).join("\n"));
              var p = $("[data-fallback]", sent);
              if (p) { p.hidden = false; $("a", p).href = "mailto:" + mail + "?subject=" + subject + "&body=" + bodyText; }
            }
            sent.scrollIntoView({ behavior: still() ? "auto" : "smooth", block: "center" });
          }
          /* sent and accepted: the unlock carries the send's sound, haptic and light */
          unlock(); track("lead_sent", { delivered: r.j.delivered !== false });
        })
        .catch(function (err) {
          btn.disabled = false; status.className = "form__status is-bad";
          status.innerHTML = (err.message === "slow down" ? "Too many tries. Give it a few minutes." : "That did not go through.") + ' You can also <a href="mailto:' + mail + '">email me directly</a>.';
        });
    });
  });
})();
