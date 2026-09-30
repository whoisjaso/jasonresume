/* Check me: every claim one tap from anywhere. The same list as the plain
   #verify section in the credits, in a drawer, with a side door to ask a
   question the page doesn't answer. The answer comes from /api/guide, which
   only knows what llms.txt says; when it can't answer, it hands off to email. */
(function () {
  "use strict";
  var dlg = document.getElementById("verify-drawer"), dataEl = document.getElementById("record-data");
  if (!dlg || !dataEl) return;
  var data = JSON.parse(dataEl.textContent);
  function FX(k) { if (window.JG_FX) window.JG_FX(k); }
  function T(e, p) { if (window.JG_TRACK) window.JG_TRACK(e, p); }
  function E(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  dlg.querySelector(".vd__list").innerHTML = data.verify.map(function (v) {
    var ext = /^http/.test(v.href) ? ' target="_blank" rel="noopener"' : "";
    return '<li><a href="' + E(v.href) + '"' + ext + ' data-verify="' + E(v.kind) + '" data-where="drawer"><b>' + E(v.k) + "</b> <span>" + E(v.v) + "</span></a></li>";
  }).join("");
  function open(where) { window.JG_SHOW(dlg); FX("arrive"); T("verify_opened", { where: where || "" }); }
  document.addEventListener("jg:open", function (e) { if (e.detail.what === "verify") open(e.detail.where); });
  (window.JG_HAS = window.JG_HAS || {}).verify = true;
  dlg.addEventListener("click", function (e) { if (e.target.closest("a[data-verify]")) FX("choice"); });

  var form = dlg.querySelector("[data-ask-form]"), input = form.querySelector("input"), out = form.querySelector(".ask-form__answer");
  var history = [], busy = false;
  var MAIL = data.email;
  function say(text, thinking) { out.classList.toggle("is-thinking", !!thinking); out.textContent = text; }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = input.value.trim(); if (!q || busy) return;
    busy = true; input.value = ""; FX("choice");
    say("Thinking about it.", true);
    history.push({ role: "user", content: q });
    T("chat_asked", { q: q.slice(0, 160), where: "verify" });
    var ctrl = window.AbortController ? new AbortController() : null, timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
    fetch("/api/guide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "interviewer", messages: history.slice(-8) }), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        clearTimeout(timer);
        if (r.status === 503) throw new Error("off");
        if (r.status === 429) throw new Error("busy");
        if (!r.ok) throw new Error("http");
        return r.json();
      })
      .then(function (j) { history.push({ role: "assistant", content: j.text }); say(j.text); FX("send"); })
      .catch(function (err) {
        var m = err && err.message;
        say(m === "busy" ? "A lot of people are asking at once. Email me the question instead: " + MAIL : "The live answers aren't switched on here yet. Email me the question and I'll answer it myself: " + MAIL);
      })
      .then(function () { busy = false; });
  });
})();
