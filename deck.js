/* Presentation mode: the resume as a deck you drive. Built at open time from
   the same record.json data as the Slate, the record and the PDF, so the
   three can never disagree. Keys, swipe, click halves, number keys, and a
   #present/N hash you can paste to a colleague. */
(function () {
  "use strict";
  var dlg = document.getElementById("deck"), dataEl = document.getElementById("record-data");
  if (!dlg || !dataEl) return;
  var data = JSON.parse(dataEl.textContent), slides = data.deck, n = slides.length, at = 0, openedAt = 0, seen = {};
  var stage = dlg.querySelector(".deck__stage"), nEl = dlg.querySelector("[data-deck-n]"), totEl = dlg.querySelector("[data-deck-total]");
  totEl.textContent = n;
  function FX(k) { if (window.JG_FX) window.JG_FX(k); }
  function T(e, p) { if (window.JG_TRACK) window.JG_TRACK(e, p); }
  function E(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function chip(p) { if (!p) return ""; var ext = p.ext ? ' target="_blank" rel="noopener"' : ""; return '<a class="chip chip--proof" href="' + E(p.href) + '"' + ext + (p.seek != null ? ' data-seek-to="' + p.seek + '"' : "") + ' data-proof="' + E(p.label) + '">' + E(p.label) + "</a>"; }
  function weight() {
    try {
      var tot = 0; performance.getEntriesByType("navigation").concat(performance.getEntriesByType("resource")).forEach(function (r) { tot += r.transferSize || 0; });
      return tot ? Math.round(tot / 1024) + " KB" : "";
    } catch (e) { return ""; }
  }
  function render(i) {
    var s = slides[i], h = '<div class="slide" data-slide="' + (i + 1) + '">';
    h += '<h2 class="slide__t" tabindex="-1"><span class="mask"><span>' + E(s.t) + "</span></span></h2>";
    if (s.rows) h += '<dl class="slide__rows">' + data.slate.map(function (r) { return "<div><dt>" + E(r.k) + "</dt><dd>" + E(r.v) + "</dd></div>"; }).join("") + "</dl>";
    if (s.s) h += '<p class="slide__s">' + E(s.s) + "</p>";
    if (s.fine) h += '<p class="slide__fine">' + E(s.fine) + "</p>";
    if (s.weight) { var w = weight(); if (w) h += '<p class="slide__fine">This page, measured just now in your browser: ' + w + " so far.</p>"; }
    if (s.verify) h += '<div class="slide__list">' + data.verify.map(function (v) { var ext = /^http/.test(v.href) ? ' target="_blank" rel="noopener"' : ""; return '<a href="' + E(v.href) + '"' + ext + ' data-verify="' + E(v.kind) + '">' + E(v.k) + "</a>"; }).join("") + "</div>";
    if (s.move) h += '<div class="slide__proof"><a class="btn btn--gold" href="mailto:' + E(data.email) + '?subject=Your%20site%2C%20and%20a%20role" data-contact="email" data-where="deck">Email me</a><a class="btn" href="' + E(data.calendar) + '" target="_blank" rel="noopener" data-book="deck">Pick 30 minutes</a></div>';
    var chips = chip(s.proof) + chip(s.proof2);
    if (chips) h += '<p class="slide__proof">' + chips + "</p>";
    return h + "</div>";
  }
  function go(i, quiet) {
    i = Math.max(0, Math.min(n - 1, i));
    var changed = i !== at || !stage.firstChild; at = i;
    stage.innerHTML = render(i);
    var sl = stage.firstChild;
    requestAnimationFrame(function () { requestAnimationFrame(function () { sl.classList.add("is-in"); }); });
    nEl.textContent = i + 1;
    try { history.replaceState(history.state, "", "#present/" + (i + 1)); } catch (e) {}
    var hd = sl.querySelector(".slide__t"); if (hd) hd.focus({ preventScroll: true });
    if (changed && !quiet) { if (window.JG_SFX) window.JG_SFX.play("key-back", { gain: 0.6 }); if (window.JG_HAPTIC) window.JG_HAPTIC("tap"); }
    if (!seen[i]) { seen[i] = 1; T("deck_slide", { n: i + 1 }); }
    if (i === n - 1 && !seen.done) { seen.done = 1; FX("unlock"); T("deck_finished", { seconds: Math.round((performance.now() - openedAt) / 1000) }); }
  }
  function open(where) {
    var m = location.hash.match(/^#present\/(\d+)/), start = m ? parseInt(m[1], 10) - 1 : 0;
    var run = function () { window.JG_SHOW(dlg); openedAt = performance.now(); go(start, true); FX("arrive"); T("resume_open", { format: "deck", where: where || "" }); };
    if (document.startViewTransition && !(window.JG_STILL && window.JG_STILL())) document.startViewTransition(run); else run();
  }
  document.addEventListener("jg:open", function (e) { if (e.detail.what === "deck") open(e.detail.where); });
  (window.JG_HAS = window.JG_HAS || {}).deck = true;
  dlg.addEventListener("close", function () { try { history.replaceState(history.state, "", location.pathname + location.search); } catch (e) {} });
  dlg.addEventListener("keydown", function (e) {
    var k = e.key;
    if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || (k === " " && !e.shiftKey)) { e.preventDefault(); go(at + 1); }
    else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp" || (k === " " && e.shiftKey)) { e.preventDefault(); go(at - 1); }
    else if (k === "Home") { e.preventDefault(); go(0); }
    else if (k === "End") { e.preventDefault(); go(n - 1); }
    else if (/^[0-9]$/.test(k)) { e.preventDefault(); go(k === "0" ? 9 : parseInt(k, 10) - 1); }
  });
  dlg.addEventListener("click", function (e) {
    var b = e.target.closest("[data-deck]");
    if (b) { var k = b.getAttribute("data-deck"); if (k === "next") go(at + 1); else if (k === "prev") go(at - 1); else if (k === "print") { T("resume_print", {}); dlg.close(); setTimeout(function () { window.print(); }, 150); } return; }
    var seek = e.target.closest("[data-seek-to]");
    if (seek) { e.preventDefault(); dlg.close(); document.dispatchEvent(new CustomEvent("jg:seek", { detail: { film: "sale-desk", t: parseFloat(seek.getAttribute("data-seek-to")) } })); return; }
    if (e.target.closest("a,button,input")) { if (e.target.closest('a[href^="#"]')) dlg.close(); return; }
    if (performance.now() - swiped < 400) return;
    if (e.target.closest(".deck__stage")) { var r = dlg.getBoundingClientRect(); if (e.clientX > r.left + r.width / 2) go(at + 1); else go(at - 1); }
  });
  var sx = 0, sy = 0, swiped = 0;
  dlg.addEventListener("pointerdown", function (e) { sx = e.clientX; sy = e.clientY; });
  dlg.addEventListener("pointerup", function (e) { var dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4 && e.pointerType !== "mouse") { swiped = performance.now(); if (dx < 0) go(at + 1); else go(at - 1); } });
})();
