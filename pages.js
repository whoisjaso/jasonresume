/* Partner and hiring pages: the film, the calendar, the two desks. */
(function () {
  "use strict";
  var body = document.body;

  /* ---------- tracking, same relay and id as the guide ---------- */
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var DNT = navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl === true;
  var id = store.get("jg_id");
  if (!id) { id = "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); store.set("jg_id", id); }
  var queue = [], timer = null;
  function common() {
    var w = innerWidth;
    return { url: location.href.slice(0, 300), ref: document.referrer.slice(0, 300), refd: (document.referrer.match(/^https?:\/\/([^/]+)/) || [])[1] || "", w: w, h: innerHeight, device: w < 700 ? "Mobile" : w < 1100 ? "Tablet" : "Desktop", lang: navigator.language };
  }
  function flush() {
    timer = null;
    if (!queue.length) return;
    var payload = JSON.stringify({ id: id, common: common(), events: queue.splice(0, 25) });
    try { if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" })); else fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }); } catch (e) {}
  }
  function track(event, props) {
    if (DNT) return;
    queue.push({ event: event, props: props || {}, ts: Date.now() });
    if (!timer) timer = setTimeout(flush, 900);
  }
  window.JG_TRACK = track;
  document.addEventListener("visibilitychange", function () { if (document.hidden) flush(); });
  track("page_view", { page: body.dataset.page || location.pathname });

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

  /* ---------- the film ---------- */
  var vsl = document.querySelector(".vsl");
  if (vsl) {
    var video = vsl.querySelector("video"), play = vsl.querySelector(".vsl__play"), done = false;
    function start() {
      vsl.classList.add("is-playing"); video.controls = true; video.muted = false;
      var p = video.play(); if (p && p.catch) p.catch(function () { video.muted = true; video.play(); });
      H("select"); if (window.JG_SFX) window.JG_SFX.play("select"); track("vsl_play", {});
    }
    if (play) play.addEventListener("click", start);
    video.addEventListener("ended", function () { if (!done) { done = true; track("vsl_complete", {}); } vsl.classList.remove("is-playing"); });
    video.addEventListener("pause", function () { if (video.currentTime > 0 && video.currentTime < video.duration - 0.5) vsl.classList.remove("is-playing"); });
    video.addEventListener("play", function () { vsl.classList.add("is-playing"); });
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
        track("book_click", { booked: true }); unlock();
        var b = document.querySelector('[name="booked"]'); if (b) b.value = "yes";
        var note = document.getElementById("note-head"); if (note) note.textContent = "Booked. One more thing helps me prepare.";
      }
    });
  }
  document.querySelectorAll("[data-book]").forEach(function (a) {
    a.addEventListener("click", function () { H("select"); if (window.JG_SFX) window.JG_SFX.play("select"); track("book_click", { booked: false, where: a.dataset.book }); });
  });

  /* ---------- the desks ---------- */
  document.querySelectorAll("form[data-desk]").forEach(function (form) {
    var status = form.querySelector(".form__status"), btn = form.querySelector('button[type="submit"]'), sent = document.getElementById(form.dataset.sent);
    var mail = form.dataset.mailto || "jobawems@gmail.com";
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) { return; }
      var data = {}; new FormData(form).forEach(function (v, k) { data[k] = v; });
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
          unlock(); track(form.dataset.desk === "lead" ? "lead_sent" : "apply_sent", { delivered: r.j.delivered !== false });
        })
        .catch(function (err) {
          btn.disabled = false; status.className = "form__status is-bad";
          status.innerHTML = (err.message === "slow down" ? "Too many tries. Give it a few minutes." : "That did not go through.") + ' You can also <a href="mailto:' + mail + '">email me directly</a>.';
        });
    });
  });
})();
