/* The Obavia Desk page: the films, the get bar, the calendar and the early-access desk. Tracking lives in track.js. */
(function () {
  "use strict";
  var body = document.body;

  /* Tracking goes through track.js (window.JG_TRACK), loaded first on every page */
  function track(event, props) { if (window.JG_TRACK) window.JG_TRACK(event, props); }
  function H(k) { if (typeof window.JG_HAPTIC === "function") window.JG_HAPTIC(k); }

  /* ---------- a single glass tone for the unlock moment ---------- */
  var AC = null;
  function tone() {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === "suspended") AC.resume();
      var t = AC.currentTime;
      [587.33, 880, 1174.66].forEach(function (f, i) {
        var o = AC.createOscillator(), g = AC.createGain();
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.09, t + i * 0.06 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + 0.9);
        o.connect(g).connect(AC.destination); o.start(t + i * 0.06); o.stop(t + i * 0.06 + 1);
      });
    } catch (e) {}
  }
  var flash = document.createElement("div"); flash.className = "flash"; flash.setAttribute("aria-hidden", "true"); body.appendChild(flash);
  function unlock() { flash.classList.remove("is-on"); void flash.offsetWidth; flash.classList.add("is-on"); H("unlock"); tone(); if (window.JG_SFX) window.JG_SFX.play("sparkle", { delay: 0.05 }); }

  /* ---------- the films: one plays at a time, with sound ---------- */
  var boxes = [].slice.call(document.querySelectorAll("[data-film-box]"));
  boxes.forEach(function (box) {
    var video = box.querySelector("video"), play = box.querySelector("[data-film-play]"), name = video.getAttribute("data-film"), done = false;
    function start() {
      boxes.forEach(function (b) { if (b !== box) b.querySelector("video").pause(); });
      box.classList.add("is-playing"); video.controls = true; video.muted = false;
      var p = video.play(); if (p && p.catch) p.catch(function () { video.muted = true; var q = video.play(); if (q && q.catch) q.catch(function () {}); });
      if (window.JG_FX) window.JG_FX("choice"); track("film_play", { film: name });
    }
    if (play) play.addEventListener("click", start);
    video.addEventListener("play", function () { box.classList.add("is-playing"); });
    video.addEventListener("ended", function () { if (!done) { done = true; track("film_complete", { film: name }); } box.classList.remove("is-playing"); video.controls = false; });
  });

  /* ---------- the get bar steps aside at the top and at the form ---------- */
  var getbar = document.querySelector("[data-getbar]"), early = document.getElementById("early"), head = document.querySelector(".pp-head");
  if (getbar && "IntersectionObserver" in window) {
    var seen = { head: true, early: false };
    var sync = function () { getbar.classList.toggle("is-away", seen.head || seen.early); };
    new IntersectionObserver(function (en) { en.forEach(function (x) { seen[x.target === early ? "early" : "head"] = x.isIntersecting; }); sync(); }, { threshold: 0 }).observe(early);
    if (head) new IntersectionObserver(function (en) { seen.head = en[0].isIntersecting; sync(); }).observe(head);
    sync();
  }

  /* ---------- the calendar ---------- */
  var cal = document.querySelector(".calendly-inline-widget");
  if (cal) {
    var s = document.createElement("script"); s.src = "https://assets.calendly.com/assets/external/widget.js"; s.async = true;
    var io = "IntersectionObserver" in window ? new IntersectionObserver(function (en) { if (en[0].isIntersecting) { document.head.appendChild(s); io.disconnect(); } }, { rootMargin: "400px 0px" }) : null;
    if (io) io.observe(cal); else document.head.appendChild(s);
    window.addEventListener("message", function (e) {
      if (!e.data || typeof e.data.event !== "string" || e.data.event.indexOf("calendly.") !== 0) return;
      if (e.data.event === "calendly.event_scheduled") {
        track("call_booked", {}); unlock();
        var b = document.querySelector('[name="booked"]'); if (b) b.value = "yes";
        var note = document.getElementById("note-head"); if (note) note.textContent = "Booked. Tell me about your lot.";
      }
    });
  }
  /* [data-book] clicks are tracked and voiced by track.js and chrome.js */

  /* ---------- the desks ---------- */
  document.querySelectorAll("form[data-desk]").forEach(function (form) {
    var status = form.querySelector(".form__status"), btn = form.querySelector('button[type="submit"]'), sent = document.getElementById(form.dataset.sent);
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
              var p = sent.querySelector("[data-fallback]");
              if (p) { p.hidden = false; p.querySelector("a").href = "mailto:" + mail + "?subject=" + subject + "&body=" + bodyText; }
            }
            sent.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          unlock(); track("lead_sent", { delivered: r.j.delivered !== false });
          if (window.JG_FX) window.JG_FX("send");
        })
        .catch(function (err) {
          btn.disabled = false; status.className = "form__status is-bad";
          status.innerHTML = (err.message === "slow down" ? "Too many tries. Give it a few minutes." : "That did not go through.") + ' You can also <a href="mailto:' + mail + '">email me directly</a>.';
        });
    });
  });
})();
