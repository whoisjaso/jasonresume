/* Stop Thinking Poor (/stp): the video slot, the reveals, the application and
   the testimonial slot. Events go through track.js (first party, silent under
   Do Not Track and Global Privacy Control).

   The video: publish assets/stp/vsl.mp4 and the player replaces the holding
   state on its own. Add assets/stp/vsl-poster.jpg for the poster and
   assets/stp/vsl.vtt for captions; each is used only when it exists. It never
   autoplays: it plays on press, with sound.

   Testimonials: /stp-testimonials.json. The section stays hidden until that
   file holds at least one entry with a quote, a name and consent: true. */
(function () {
  "use strict";
  var T = function (e, p) { try { window.JG_TRACK && window.JG_TRACK(e, p || {}); } catch (err) {} };
  var $ = function (s) { return document.querySelector(s); };
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* The bar picks up a hairline once the page moves */
  var bar = $(".bar");
  var onScroll = function () { if (bar) bar.classList.toggle("scrolled", scrollY > 8); };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* Reveals */
  var rev = [].slice.call(document.querySelectorAll(".reveal"));
  if (reduce || !("IntersectionObserver" in window)) rev.forEach(function (el) { el.classList.add("in"); });
  else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    rev.forEach(function (el) { io.observe(el); });
  }

  /* The video slot */
  var exists = function (url, type) {
    return fetch(url, { method: "HEAD", cache: "no-store" }).then(function (r) {
      if (!r.ok) return false;
      var ct = r.headers.get("content-type") || "";
      return !type || ct.indexOf(type) === 0;
    }).catch(function () { return false; });
  };
  var frame = $("#vsl-frame");
  if (frame) {
    Promise.all([exists("/assets/stp/vsl.mp4", "video/"), exists("/assets/stp/vsl-poster.jpg", "image/"), exists("/assets/stp/vsl.vtt", "")]).then(function (r) {
      if (!r[0]) return;
      var v = document.createElement("video");
      v.controls = true; v.preload = "metadata"; v.playsInline = true;
      v.setAttribute("playsinline", ""); v.setAttribute("aria-label", "Stop Thinking Poor, the video");
      if (r[1]) v.poster = "/assets/stp/vsl-poster.jpg";
      var s = document.createElement("source"); s.src = "/assets/stp/vsl.mp4"; s.type = "video/mp4"; v.appendChild(s);
      if (r[2]) { var t = document.createElement("track"); t.kind = "captions"; t.src = "/assets/stp/vsl.vtt"; t.srclang = "en"; t.label = "English"; v.appendChild(t); }
      var played = false, done = false;
      v.addEventListener("play", function () { if (!played) { played = true; T("stp_video_play", {}); } });
      v.addEventListener("ended", function () { if (!done) { done = true; T("stp_video_complete", { seconds: Math.round(v.duration || 0) }); } });
      var hold = $("#vsl-hold"); if (hold) hold.remove();
      frame.appendChild(v);
    });
  }

  /* Testimonials: real entries only */
  var voices = $("#voices"), vlist = $("#voice-list");
  if (voices && vlist) {
    fetch("/stp-testimonials.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      var list = (d && Array.isArray(d.entries) ? d.entries : []).filter(function (e) {
        return e && e.consent === true && typeof e.quote === "string" && e.quote.trim() && typeof e.name === "string" && e.name.trim();
      });
      if (!list.length) return;
      list.forEach(function (e) {
        var f = document.createElement("figure"); f.className = "voice";
        var q = document.createElement("blockquote"); q.textContent = e.quote.trim();
        var c = document.createElement("figcaption"); c.textContent = e.name.trim() + (e.detail ? ", " + String(e.detail).trim() : "");
        f.appendChild(q); f.appendChild(c); vlist.appendChild(f);
      });
      voices.hidden = false;
    }).catch(function () {});
  }

  /* The application */
  var form = $("#stp-form"), err = $("#stp-err"), send = $("#stp-send"), done = $("#stp-done");
  if (!form) return;
  var started = false;
  var begin = function (ev) {
    if (!started) { started = true; T("stp_apply_started", {}); }
    var box = ev.target.closest && ev.target.closest(".invalid"); if (box) box.classList.remove("invalid");
  };
  form.addEventListener("input", begin);
  form.addEventListener("change", begin);

  var LABEL = { belief: "Belief alignment", identity: "Ego and identity", ai: "AI and income", now: "Now", month: "Within the month", deciding: "I'm still deciding" };
  function val(n) { var el = form.elements[n]; return el ? String(el.value || "").trim() : ""; }
  function mark(n, bad) {
    var el = form.elements[n]; if (!el) return;
    var box = el.length && !el.tagName ? el[0].closest("fieldset") : el.closest(".field");
    if (box) box.classList.toggle("invalid", !!bad);
  }
  function fail(msg, first) {
    err.textContent = msg; err.hidden = false;
    var el = first && form.elements[first]; if (el) { (el.length && !el.tagName ? el[0] : el).focus(); }
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    err.hidden = true;
    var d = {
      kind: "stp", name: val("name"), email: val("email"), instagram: val("instagram"),
      pillar: val("pillar"), desire: val("desire"), belief: val("belief"), ready: val("ready"), website: val("website")
    };
    var emailOk = /^[^\s@]{1,64}@[^\s@]{1,255}\.[a-z]{2,}$/i.test(d.email);
    var checks = [["name", !d.name], ["email", !emailOk], ["pillar", !d.pillar], ["desire", !d.desire], ["belief", !d.belief], ["ready", !d.ready]];
    var first = null;
    checks.forEach(function (c) { mark(c[0], c[1]); if (c[1] && !first) first = c[0]; });
    if (first) return fail(first === "email" && d.email ? "That email doesn't look right." : "Answer every question so I can read where you are.", first);

    send.disabled = true; send.textContent = "Sending";
    fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.status === 400) throw { user: res.j && res.j.error ? "Check your answers: " + res.j.error + "." : "Check your answers and try again." };
        if (res.status >= 500 || res.status === 429) return finish(d, false);
        finish(d, !!(res.j && res.j.delivered));
      })
      .catch(function (e) {
        if (e && e.user) { send.disabled = false; send.textContent = "Send my application"; return fail(e.user, null); }
        finish(d, false);
      });
  });

  function finish(d, delivered) {
    T("stp_apply_sent", { pillar: d.pillar, ready: d.ready, delivered: delivered });
    var first = d.name.split(" ")[0];
    $("#stp-done-h").textContent = first ? "Thank you, " + first + "." : "Thank you.";
    if (!delivered) {
      var body = "Name: " + d.name + "\nEmail: " + d.email + "\nInstagram: " + (d.instagram || "not given") +
        "\nWants most: " + (LABEL[d.pillar] || "") + "\nReady to act: " + (LABEL[d.ready] || "") +
        "\nWhat I desire: " + d.desire + "\nWhat I believe about myself: " + d.belief;
      $("#stp-mail-a").href = "mailto:jobawems@gmail.com?subject=" + encodeURIComponent("Stop Thinking Poor application: " + d.name) + "&body=" + encodeURIComponent(body);
      $("#stp-mail").hidden = false;
      $("#stp-done-line").textContent = "Your answers are ready to send. The next step after that is the call.";
    }
    form.hidden = true;
    var head = $(".apply-head"); if (head) head.hidden = true;
    done.hidden = false;
    done.focus({ preventScroll: true });
    var top = document.getElementById("apply").getBoundingClientRect().top + scrollY - 60;
    scrollTo({ top: top, behavior: reduce ? "auto" : "smooth" });
  }
})();
