/* The exercises. Each one is optional, loops in under a minute, has a silent
   skip, and leaves something you keep. No scores, no points, no percentages:
   reveals compare, they never grade. Every buyer, line and figure is fictional
   and labeled so next to it.

   Home:        Mark the Words      [data-mark-game]
   /obavia:     The Handoff         [data-handoff]
                Where Your Floor Leaks [data-leaks]
                Counts Yet?         [data-counts]
   /join:       Rewrite the Note    [data-note] */
(function () {
  "use strict";
  function FX(k) { if (window.JG_FX) window.JG_FX(k); }
  function T(e, p) { if (window.JG_TRACK) window.JG_TRACK(e, p); }
  function norm(w) { return w.toLowerCase().replace(/[^a-z']/g, ""); }
  function inkSvg() { return '<svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M2 6c20-3 40-4 60-3s26 3 36 1"/></svg>'; }

  /* ---------- Mark the Words ---------- */
  var SENTENCES = [
    { text: "We paid an agency last year and I never knew who was actually on my account.", mine: ["never", "knew", "account"], q: "When you say you never knew who was on your account, what would you want to know this time?" },
    { text: "Some months I'm fine. Other months my team is waiting for someone to pull a Babe Ruth and save the quarter.", mine: ["waiting", "babe", "ruth"], q: "What would a steady month look like, without waiting on a Babe Ruth?" },
    { text: "My closer asked me everything I already told the other guy.", mine: ["everything", "already", "told"], q: "What did you already tell us that you never want to repeat again?" }
  ];
  var game = document.querySelector("[data-mark-game]");
  if (game) {
    var sentEl = game.querySelector(".mark__sentence"), showBtn = game.querySelector('[data-mark="show"]'), justBtn = game.querySelector('[data-mark="just"]'), nextBtn = game.querySelector('[data-mark="next"]'), reveal = game.querySelector(".mark__reveal"), qEl = game.querySelector(".mark__question");
    var idx = 0, picked = 0;
    var build = function (i) {
      var s = SENTENCES[i]; picked = 0;
      game.classList.remove("is-revealed"); reveal.hidden = true; showBtn.disabled = true; nextBtn.hidden = true; justBtn.hidden = false;
      sentEl.innerHTML = "";
      sentEl.appendChild(document.createTextNode("“"));
      s.text.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { sentEl.appendChild(document.createTextNode(part)); return; }
        var b = document.createElement("button"); b.type = "button"; b.className = "mark__word"; b.setAttribute("aria-pressed", "false");
        b.innerHTML = part.replace(/[&<>]/g, "") + inkSvg();
        if (s.mine.indexOf(norm(part)) >= 0) b.classList.add("is-mine");
        sentEl.appendChild(b);
      });
      sentEl.appendChild(document.createTextNode("”"));
    };
    build(0);
    sentEl.addEventListener("click", function (e) {
      var w = e.target.closest(".mark__word"); if (!w || game.classList.contains("is-revealed")) return;
      var on = w.getAttribute("aria-pressed") !== "true";
      w.setAttribute("aria-pressed", on ? "true" : "false");
      picked += on ? 1 : -1;
      if (on) FX("choice"); /* untapping is silent */
      showBtn.disabled = picked < 1;
      if (picked === 1 && on) T("scene_interacted", { scene: "mark", action: "first_mark" });
    });
    var doReveal = function (why) {
      var s = SENTENCES[idx], mine = 0, overlap = 0;
      sentEl.querySelectorAll(".mark__word").forEach(function (w) { var m = w.classList.contains("is-mine"), p = w.getAttribute("aria-pressed") === "true"; if (m) mine++; if (m && p) overlap++; });
      game.classList.add("is-revealed"); reveal.hidden = false; qEl.textContent = "“" + s.q + "”";
      nextBtn.hidden = false; justBtn.hidden = true; showBtn.disabled = true;
      if (why === "show") FX("unlock");
      T("mark_words", { sentence: idx + 1, overlap: picked === 0 ? "none_marked" : overlap === 0 ? "none" : overlap === mine ? "all" : "some", how: why });
    };
    showBtn.addEventListener("click", function () { doReveal("show"); });
    justBtn.addEventListener("click", function () { doReveal("just"); }); /* a skip: silent */
    nextBtn.addEventListener("click", function () { idx = (idx + 1) % SENTENCES.length; build(idx); FX("flip"); });
  }

  /* ---------- The Handoff ---------- */
  document.querySelectorAll("[data-handoff]").forEach(function (box) {
    var out = box.querySelector("[data-handoff-reveal]");
    box.addEventListener("click", function (e) {
      var o = e.target.closest("[data-kind]"); if (!o) return;
      box.querySelectorAll("[data-kind]").forEach(function (b) { b.setAttribute("aria-pressed", b === o ? "true" : "false"); });
      var kind = o.getAttribute("data-kind");
      FX(kind === "words" ? "unlock" : "choice");
      box.querySelectorAll("[data-verdict]").forEach(function (v) { v.hidden = v.getAttribute("data-verdict") !== kind; });
      if (out) out.hidden = false;
      T("handoff_pick", { option: kind });
    });
  });

  /* ---------- Where Your Floor Leaks ---------- */
  var FIX = {
    Capture: "Decide who owns after-hours and weekend leads, and put that name on the calendar before Monday is over.",
    Connect: "Before any call, paste the buyer's own sentence at the top of the closer's notes.",
    Book: "Add one line to every booking: what this call is for.",
    Discover: "After each call, write down what the buyer said, not how the call felt.",
    Agree: "Hand off in four lines: the buyer said, this call is for, who decides, what we promised or ruled out.",
    Collect: "Count a deal on your board only when the cash is verified."
  };
  document.querySelectorAll("[data-leaks]").forEach(function (box) {
    var rows = [].slice.call(box.querySelectorAll("[data-stage]")), res = box.querySelector("[data-leaks-result]");
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-a]"); if (!b) return;
      var row = b.closest("[data-stage]");
      row.querySelectorAll("[data-a]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      row.setAttribute("data-answer", b.getAttribute("data-a"));
      FX("choice");
      var done = rows.every(function (r) { return r.hasAttribute("data-answer"); });
      if (!done) return;
      var leak = null;
      rows.some(function (r) { if (r.getAttribute("data-answer") !== "yes") { leak = r.getAttribute("data-stage"); return true; } return false; });
      box.querySelectorAll(".leaks__thread li").forEach(function (li) { li.classList.toggle("is-leak", li.getAttribute("data-s") === leak); });
      res.hidden = false;
      res.querySelector("[data-leak-name]").textContent = leak ? leak : "None of the six";
      res.querySelector("[data-leak-fix]").textContent = leak ? FIX[leak] : "Every stage came back yes. Pick the one you'd least like a new closer to guess at, and write it down this week.";
      FX("unlock");
      T("leak_stage", { stage: leak || "none" });
    });
  });

  /* ---------- Counts Yet? ---------- */
  document.querySelectorAll("[data-counts]").forEach(function (box) {
    var cards = [].slice.call(box.querySelectorAll("[data-event]")), res = box.querySelector("[data-counts-result]");
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-sort]"); if (!b) return;
      var card = b.closest("[data-event]"), counts = card.getAttribute("data-counts-real") === "yes";
      card.setAttribute("data-sorted", b.getAttribute("data-sort"));
      card.querySelectorAll("[data-sort]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      var note = card.querySelector("[data-note-real]"); if (note) note.hidden = false;
      card.classList.add(counts ? "is-real" : "is-not");
      if (window.JG_SFX) window.JG_SFX.play("key-back", { gain: 0.6 }); if (window.JG_HAPTIC) window.JG_HAPTIC("tap");
      if (cards.every(function (c) { return c.hasAttribute("data-sorted"); })) { res.hidden = false; FX("unlock"); T("counts_done", {}); }
    });
  });

  /* ---------- Rewrite the Note ---------- */
  document.querySelectorAll("[data-note]").forEach(function (box) {
    var frags = [].slice.call(box.querySelectorAll("[data-frag]")), slots = [].slice.call(box.querySelectorAll("[data-slot]")), held = null, res = box.querySelector("[data-note-result]");
    box.addEventListener("click", function (e) {
      var f = e.target.closest("[data-frag]");
      if (f && !f.disabled) {
        held = held === f ? null : f;
        frags.forEach(function (x) { x.setAttribute("aria-pressed", x === held ? "true" : "false"); });
        if (held) {
          /* place it in the slot it belongs to, or the first empty slot */
          var target = box.querySelector('[data-slot="' + held.getAttribute("data-frag") + '"]');
          if (target && !target.hasAttribute("data-filled")) {
            target.querySelector("span").textContent = held.textContent; target.setAttribute("data-filled", ""); held.disabled = true; held.setAttribute("aria-pressed", "false"); held = null; FX("choice");
            T("note_placed", { n: box.querySelectorAll("[data-filled]").length });
            if (slots.every(function (s) { return s.hasAttribute("data-filled"); })) { res.hidden = false; FX("unlock"); T("note_done", {}); }
          }
        }
        return;
      }
      var reset = e.target.closest("[data-note-reset]");
      if (reset) { slots.forEach(function (s) { s.removeAttribute("data-filled"); s.querySelector("span").textContent = ""; }); frags.forEach(function (x) { x.disabled = false; x.setAttribute("aria-pressed", "false"); }); res.hidden = true; }
    });
  });

  /* ---------- Copy buttons for the keepable cards ---------- */
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-copy-from]"); if (!b) return;
    var src = document.querySelector(b.getAttribute("data-copy-from")); if (!src) return;
    var text = src.innerText.trim();
    (window.JG_COPY ? window.JG_COPY(text) : Promise.resolve()).then(function () { FX("send"); if (window.JG_TOAST) window.JG_TOAST("Copied"); T("card_copied", { what: b.getAttribute("data-copy-from").replace("#", "") }); });
  });
})();
