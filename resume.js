/*
  The resume pages. Print, and a print tailored to a listing.

  resume/<build>.html#t=Term,Term:spelling,... (canonical terms from match.js that are on the record, each
  optionally with the listing's own spelling) puts the bullets whose proofs verify those terms first, in each
  list, and starts the Skills section with "Relevant skills:" naming the terms in the listing's spelling, but
  only terms a bullet or entry on this page proves. A spelling is used only when it is one of that term's known
  spellings; anything else falls back to the canonical term, so the hash cannot put words on the page.
  The page sets its title to the download file name and offers Print. textContent only. Nothing leaves the browser.
*/
(function () {
  "use strict";

  var page = document.querySelector(".page");
  if (!page) return;
  var body = document.body;
  var file = body.getAttribute("data-file") || "";
  var original = document.title;
  var tailored = false;
  var me = document.currentScript;
  var version = me && me.src ? (/[?&]v=([^&#]+)/.exec(me.src) || [])[1] || "" : "";

  var printBtn = document.querySelector("[data-print]");
  if (printBtn && typeof window.print === "function") {
    printBtn.hidden = false;
    printBtn.addEventListener("click", function () { window.print(); });
  }
  window.addEventListener("beforeprint", function () { if (file) document.title = file; });
  window.addEventListener("afterprint", function () { if (!tailored) document.title = original; });

  function terms() {
    var m = /^#t=([^#]*)$/.exec(location.hash || "");
    if (!m || !m[1]) return [];
    return m[1].split(",").slice(0, 40).map(function (piece) {
      var at = piece.indexOf(":");
      var name = at === -1 ? piece : piece.slice(0, at);
      var as = at === -1 ? "" : piece.slice(at + 1);
      try {
        return { name: decodeURIComponent(name), as: decodeURIComponent(as) };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  }

  function withMatch(cb) {
    if (window.JG_MATCH) return cb(window.JG_MATCH);
    var s = document.createElement("script");
    s.src = "/match.js" + (version ? "?v=" + version : "");
    s.onload = function () { if (window.JG_MATCH) cb(window.JG_MATCH); };
    document.head.appendChild(s);
  }

  // Stable: matched items first, the rest after, each group in its printed order.
  function lead(list, isHit) {
    var items = Array.prototype.filter.call(list.children, function (li) { return li.tagName === "LI"; });
    var hits = items.filter(isHit);
    if (!hits.length) return;
    var rest = items.filter(function (li) { return !isHit(li); });
    hits.concat(rest).forEach(function (li) { list.appendChild(li); });
  }

  function tailor(M, wanted) {
    var onPage = {};
    // A skills line names its skill proofs, space separated; a bullet or entry names one.
    Array.prototype.forEach.call(page.querySelectorAll("[data-proof]"), function (el) {
      el.getAttribute("data-proof").split(/\s+/).forEach(function (p) { if (p) onPage[p] = true; });
    });
    var matched = {};
    var relevant = [];
    var seen = {};
    wanted.forEach(function (w) {
      var t = M.term(w.name);
      if (!t || t.off) return;
      t.proofs.forEach(function (p) { matched[p] = true; });
      var proven = t.proofs.some(function (p) { return onPage[p]; });
      var label = w.as && M.spells(t.term, w.as) ? w.as : t.term;
      var key = t.term.toLowerCase();
      if (proven && !seen[key]) {
        seen[key] = true;
        relevant.push(label);
      }
    });
    if (!Object.keys(matched).length) return false;

    var proofHit = function (li) { return !!matched[li.getAttribute("data-proof")]; };
    var duties = page.querySelector(".duties");
    if (duties) {
      Array.prototype.forEach.call(duties.querySelectorAll(".sys > ul"), function (ul) { lead(ul, proofHit); });
      var jobLevel = Array.prototype.filter.call(duties.children, function (li) { return !li.classList.contains("sys"); });
      var systems = Array.prototype.filter.call(duties.children, function (li) { return li.classList.contains("sys"); });
      var sysHit = function (li) { return Array.prototype.some.call(li.querySelectorAll("[data-proof]"), proofHit); };
      var jobHits = jobLevel.filter(proofHit);
      var ordered = jobHits.concat(jobLevel.filter(function (li) { return !proofHit(li); }))
        .concat(systems.filter(sysHit))
        .concat(systems.filter(function (li) { return !sysHit(li); }));
      ordered.forEach(function (li) { duties.appendChild(li); });
    }
    Array.prototype.forEach.call(page.querySelectorAll(".plain"), function (ul) { lead(ul, proofHit); });

    var skills = page.querySelector(".skills");
    if (skills && relevant.length) {
      var p = document.createElement("p");
      p.className = "relevant";
      var k = document.createElement("span");
      k.className = "k";
      k.textContent = "Relevant skills:";
      p.appendChild(k);
      p.appendChild(document.createTextNode(" " + relevant.slice(0, 14).join(", ")));
      var h = skills.querySelector("h2");
      skills.insertBefore(p, h ? h.nextSibling : skills.firstChild);
    }

    tailored = true;
    if (file) document.title = file;
    var note = document.querySelector("[data-tailor-note]");
    if (note) {
      note.textContent = "Ordered for the listing you pasted: the bullets that match it come first. The facts are the same on every version, and nothing from the listing left your browser.";
      note.hidden = false;
    }
    body.setAttribute("data-tailored", "");
    return true;
  }

  var wanted = terms();
  if (wanted.length && body.getAttribute("data-build")) {
    withMatch(function (M) { tailor(M, wanted); });
  }
})();
