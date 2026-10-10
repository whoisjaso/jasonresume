/* Player 2: the build. The visitor builds me for the role they're hiring for,
   the problem on their lot, or a class they like, from verified facts only
   (tools/site/builds.json, inlined as #builds-data). They pick the reading,
   equip four proofs, a backdrop and a finish, and sign it. They keep it three
   ways: the card as an image, a link that rebuilds it, and for a role a
   one-page resume written for that job. The library reorders around it, the
   Resume button serves that role's PDF, and Email carries the build.

   window.JG_BUILD
     .data                     builds.json
     .get()                    the visitor's build, or null
     .make(kind, id, how)      start one: kind "role" | "lot"
     .sign(name)               put a name on it
     .cardHTML(build)          the card, as HTML
     .save(build, where)       the card as a PNG: the share sheet or a download
     .load(hash)               "#build" or a shared "#build/v1/..." before the screen opens
     .label(build)
     .resume(build, cls)       the "Resume for this role" link, as HTML (the PDF, or the tailored print after a listing match)
     .lotCta(build, cls, where) a lot build's next step, as HTML: a call, or Obavia early access
     .copyLink(build, where)   copy the build's link (where "referral" is the lurker's "send them your build")
   Events: document "jg:build" { build }

   The funnel: my availability shows only where a visitor is already deciding.
   Hiring (or no seat yet) on a role reading: one fine line beside the actions.
   A ?for= link with nothing built yet: the reading as I sent it, with the
   resume, the line (not for someone just looking), and Make it yours. A
   dealer: the lot answer and its call to action, then one quiet question for a
   dealer who is really hiring ("Hiring for your lot? Read me for ..."), which
   switches the build to the reading their lot problem points to; the line
   shows once, after the switch. Just looking: never the line, and in Player 2
   one referral (send your build to someone hiring) that is also the way to
   copy the link. The card never carries any of it. Words in
   tools/site/onboarding.json (funnel). */
(function () {
  "use strict";
  var el = document.getElementById("builds-data"); if (!el) return;
  var D = null; try { D = JSON.parse(el.textContent); } catch (e) { return; }
  var libEl = document.getElementById("library-data");
  var LIB = {}; try { LIB = JSON.parse(libEl.textContent); } catch (e) {}
  var root = document.documentElement;
  var COARSE = matchMedia("(pointer: coarse)").matches;
  var OB = {}; try { OB = JSON.parse((document.getElementById("onboarding-data") || {}).textContent || "{}"); } catch (e) {}
  var FN = OB.funnel || {};
  function say(k, d) { return FN[k] || d; }
  var BY = {}, LOT = {}, P = D.proofs;
  D.builds.forEach(function (b) { BY[b.id] = b; });
  D.lot.forEach(function (l) { LOT[l.id] = l; });
  var ARTS = (LIB.titles || []).map(function (t) { return t.id; });
  var LOGO = {}; (LIB.titles || []).forEach(function (t) { LOGO[t.id] = t.logo; });
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  function T(e, p, s) { if (window.JG_TRACK) window.JG_TRACK(e, p, s); }
  function FX(k) { if (window.JG_FX) window.JG_FX(k); }
  function E(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function clean(s) { return String(s || "").replace(/[^\p{L}\p{M}' .-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 28); }
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function when(t) { var d = new Date(t || Date.now()); return MONTHS[d.getMonth()] + " " + d.getFullYear(); }

  /* ---------- finishes: trophies earned in the run give the card a better metal ---------- */
  function seenCount() { var n = 0; try { JSON.parse(store.get("jg_trophies") || "[]").forEach(function (s) { if (LIB.trophies && LIB.trophies[s]) n++; }); } catch (e) {} return n; }
  function unlocked(f) { var fin = D.finishes.filter(function (x) { return x.id === f; })[0]; if (!fin) return false; if (fin.need === "operator") return store.get("jg_platinum") === "1"; return seenCount() >= fin.need; }
  function bestFinish() { var best = "bronze"; D.finishes.forEach(function (f) { if (unlocked(f.id)) best = f.id; }); return best; }
  var NEED = { silver: "Earn six trophies in the run", gold: "Earn twelve trophies in the run", platinum: "Earn the platinum: every medal in the run" };

  /* ---------- the build itself ---------- */
  function valid(b) {
    if (!b || (b.kind !== "role" && b.kind !== "lot")) return false;
    if (b.kind === "role" && !BY[b.id]) return false;
    if (b.kind === "lot" && !LOT[b.id]) return false;
    if (!Array.isArray(b.p) || !b.p.length || b.p.some(function (x) { return !P[x]; })) return false;
    if (ARTS.indexOf(b.a) < 0) b.a = ARTS[0];
    if (!D.finishes.some(function (f) { return f.id === b.f; })) b.f = "bronze";
    return true;
  }
  function mine() { var b = null; try { b = JSON.parse(store.get("jg_build") || "null"); } catch (e) {} return valid(b) ? b : null; }
  function keep(b) { store.set("jg_build", JSON.stringify(b)); }
  function pool(b) { return b.kind === "role" ? BY[b.id].proofs : LOT[b.id].proofs.concat(BY[LOT[b.id].build].proofs.filter(function (x) { return LOT[b.id].proofs.indexOf(x) < 0; })); }
  function titlesOf(b) { return b.kind === "role" ? BY[b.id].titles : LOT[b.id].titles; }
  function label(b) { return b.kind === "role" ? BY[b.id].label : LOT[b.id].label; }
  function line(b) { return b.kind === "role" ? BY[b.id].headline : LOT[b.id].line; }
  function make(kind, id, how) {
    var src = kind === "role" ? BY[id] : LOT[id]; if (!src) return null;
    var prev = mine();
    var b = { v: 1, kind: kind, id: id, p: src.proofs.slice(0, D.equip), a: src.titles[0], f: bestFinish(), n: clean(store.get("jg_name") || ""), t: Date.now() };
    if (prev && prev.f && unlocked(prev.f)) b.f = prev.f;
    keep(b); apply(b);
    T("build_chosen", { build: id, kind: kind, how: how || "" });
    document.dispatchEvent(new CustomEvent("jg:build", { detail: { build: b } }));
    return b;
  }
  function sign(name) { var b = mine(); if (!b) return null; b.n = clean(name); keep(b); paintSlot(b); return b; }

  /* ---------- links: a build travels as a hash ---------- */
  function link(b) {
    var head = (b.kind === "lot" ? "lot-" : "") + b.id;
    return location.origin + location.pathname + "#build/v1/" + [head, b.p.join("+"), b.a, b.f, encodeURIComponent(b.n || "")].join("/");
  }
  function parse(h) {
    var m = String(h || "").match(/^#build\/v1\/([a-z-]+)\/([a-z0-9+-]+)\/([a-z-]+)\/([a-z]+)(?:\/([^/]*))?$/); if (!m) return null;
    var lot = m[1].indexOf("lot-") === 0, id = lot ? m[1].slice(4) : m[1], n = "";
    try { n = clean(decodeURIComponent(m[5] || "")); } catch (e) {}
    var b = { v: 1, kind: lot ? "lot" : "role", id: id, p: m[2].split("+").slice(0, D.equip), a: m[3], f: m[4], n: n, t: Date.now() };
    return valid(b) ? b : null;
  }
  /* /assets is cached for a year: the version moves when the resumes are rendered again */
  var RV = (String(LIB.pdf || "").match(/[?&]v=([^&#]+)/) || [])[1] || "";
  function resumePdf(b) { return b && b.kind === "role" ? "assets/resume/Jason_Obawemimo_Resume_" + BY[b.id].label.replace(/[^A-Za-z0-9]+/g, "_") + ".pdf" + (RV ? "?v=" + RV : "") : (LIB.pdf || ""); }
  /* the tailored print: each on-record term, with the listing's own spelling when it differs */
  function resumePage(b, on) { return "resume/" + b.id + ".html" + (on && on.length ? "#t=" + on.map(function (x) { return encodeURIComponent(x.term) + (x.as && x.as !== x.term ? ":" + encodeURIComponent(x.as) : ""); }).join(",") : ""); }
  /* a lot build's next step: the conversation it calls for */
  function lotCta(b, cls, where) {
    if (!b || b.kind !== "lot") return "";
    return LOT[b.id].cta === "obavia" ? '<a class="' + (cls || "btn btn--primary") + '" href="/obavia.html#early" data-build-obavia>Ask for Obavia early access</a>'
      : '<a class="' + (cls || "btn btn--primary") + '" href="https://calendly.com/jason-apohenia/30min" target="_blank" rel="noopener" data-book="' + E(where || "build") + '">Talk shop for 30 minutes</a>';
  }
  /* Resume for this role: the role's PDF, or after a listing match the print that marks its words */
  function resumeLink(b, cls, view) {
    if (!b || b.kind !== "role") return "";
    var m = matched && !view;
    return '<a class="' + (cls || "btn btn--primary") + '" href="' + E(m ? resumePage(b, matched.on) : resumePdf(b)) + '"' + (m ? ' target="_blank" rel="noopener"' : ' download="Jason Obawemimo - Resume, ' + E(BY[b.id].label) + '.pdf"') + ' data-build-resume><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-doc"/></svg>' + E(say("resume", "Resume for this role")) + "</a>";
  }

  /* ---------- the card ---------- */
  function medalSrc(slug, size) { return "assets/game/medals/" + slug + "-" + size + ".webp"; }
  /* a title's art files go by its stem (OB.arts, from library.json "art"): a regraded plate ships under a new name */
  function artSrc(id, kind) { return "assets/game/art/" + ((OB.arts && OB.arts[id]) || id) + (kind === "tile" ? "-tile-256.webp" : "-m.webp"); }
  function cardHTML(b, o) {
    o = o || {};
    if (!b) return '<figure class="bcard bcard--empty"><div class="bcard__frame"></div><p class="bcard__empty"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-plus"/></svg>Player 2<small>Pick a role or a lot to start</small></p></figure>';
    var by = b.n ? "Built by " + b.n : "Built for you";
    return '<figure class="bcard bcard--' + b.f + '" data-card aria-label="' + E("Jason Obawemimo, built for " + label(b) + ". " + by + ", " + when(b.t) + ".") + '">' +
      '<img class="bcard__art" src="' + artSrc(b.a) + '" alt="" decoding="async" />' +
      '<div class="bcard__shade"></div>' +
      '<img class="bcard__portrait" src="assets/game/portrait/jason-relit-800.webp" alt="" decoding="async" />' +
      '<div class="bcard__frame"></div>' +
      '<header class="bcard__top"><p class="bcard__name">Jason Obawemimo</p><p class="bcard__title">' + E(LIB.profile && LIB.profile.title || "AI Implementation, Workflow Automation, CRM Systems") + "</p></header>" +
      '<div class="bcard__mid"><h3 class="bcard__class">' + E(label(b)) + '</h3><p class="bcard__line">' + E(line(b)) + "</p></div>" +
      '<ul class="bcard__proofs">' + b.p.map(function (x) {
        var p = P[x];
        return '<li><img class="bcard__medal" src="' + medalSrc(p.medal, 80) + '" data-tier="' + p.tier + '" alt="" />' + "<span>" + E(p.short) + "</span></li>";
      }).join("") + "</ul>" +
      '<footer class="bcard__foot"><p class="bcard__lvl"><span>Level</span><b>' + E(LIB.profile && LIB.profile.level || "53") + '</b></p><p class="bcard__sig"><b>' + E(by) + "</b><span>" + when(b.t) + " &middot; jasonobawemimo.com</span></p></footer>" +
      "</figure>";
  }
  /* a proof medal that hasn't been minted yet falls back to its tier's blank */
  document.addEventListener("error", function (e) {
    var t = e.target; if (!t || t.tagName !== "IMG" || !t.classList || !t.classList.contains("bcard__medal") || t.dataset.fell) return;
    t.dataset.fell = "1"; t.src = "assets/game/medals/" + (t.getAttribute("data-tier") || "silver") + "-blank-160.webp";
  }, true);

  /* ---------- the card as an image: drawn, not screenshotted ---------- */
  var FIN = { bronze: "#9c6b43", silver: "#b9bcbe", gold: "#c9a96a", platinum: "#dcdde0" };
  function img(src) { return new Promise(function (ok) { var i = new Image(); i.decoding = "async"; i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; }); }
  function medalImg(p) { return img(medalSrc(p.medal, 160)).then(function (i) { return i || img("assets/game/medals/" + p.tier + "-blank-160.webp"); }); }
  function wrap(c, text, max) {
    var words = String(text).split(" "), lines = [], cur = "";
    words.forEach(function (w) { var t = cur ? cur + " " + w : w; if (c.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur); return lines;
  }
  function tracked(c, text, x, y, em) {
    if ("letterSpacing" in c) { c.letterSpacing = em + "px"; c.fillText(text, x, y); c.letterSpacing = "0px"; return; }
    for (var i = 0; i < text.length; i++) { c.fillText(text[i], x, y); x += c.measureText(text[i]).width + em; }
  }
  function draw(b) {
    var W = 1080, H = 1350, U = W / 100;
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var c = cv.getContext("2d");
    var fonts = ['600 44px "Cormorant Garamond"', '500 80px "Cormorant Garamond"', '400 28px "Hanken Grotesk"', '500 28px "Hanken Grotesk"', '600 28px "Hanken Grotesk"'];
    var fl = document.fonts && document.fonts.load ? Promise.all(fonts.map(function (f) { return document.fonts.load(f).catch(function () {}); })) : Promise.resolve();
    return Promise.all([fl, img(artSrc(b.a)), img("assets/game/portrait/jason-relit-800.webp"), Promise.all(b.p.map(function (x) { return medalImg(P[x]); }))]).then(function (r) {
      var art = r[1], por = r[2], meds = r[3], fin = FIN[b.f] || FIN.bronze;
      c.fillStyle = "#0a0f0d"; c.fillRect(0, 0, W, H);
      if (art) { var s = Math.max(W / art.width, H / art.height), aw = art.width * s, ah = art.height * s; c.drawImage(art, (W - aw) * 0.62, (H - ah) / 2, aw, ah); }
      var g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, "rgba(10,15,13,.86)"); g.addColorStop(0.5, "rgba(10,15,13,.5)"); g.addColorStop(0.85, "rgba(10,15,13,.12)"); c.fillStyle = g; c.fillRect(0, 0, W, H);
      if (por) { var ph = 78 * U, pw = ph * por.width / por.height; c.drawImage(por, W - pw + 11 * U, 19 * U, pw, ph); }
      var v = c.createLinearGradient(0, 0, 0, H); v.addColorStop(0, "rgba(10,15,13,.55)"); v.addColorStop(0.2, "rgba(10,15,13,0)"); v.addColorStop(0.46, "rgba(10,15,13,0)"); v.addColorStop(0.6, "rgba(10,15,13,.82)"); v.addColorStop(1, "rgba(10,15,13,.97)"); c.fillStyle = v; c.fillRect(0, 0, W, H);
      /* the frame, in the finish's metal */
      c.strokeStyle = fin; c.lineWidth = 0.2 * U; c.strokeRect(2.6 * U, 2.6 * U, W - 5.2 * U, H - 5.2 * U);
      c.globalAlpha = 0.45; c.lineWidth = 1; c.strokeRect(3.6 * U, 3.6 * U, W - 7.2 * U, H - 7.2 * U); c.globalAlpha = 1;
      var L = 7.4 * U;
      c.textBaseline = "alphabetic"; c.fillStyle = "#ede7db";
      c.font = '600 ' + (4.1 * U) + 'px "Cormorant Garamond", Garamond, serif'; tracked(c, "JASON OBAWEMIMO", L, 11.9 * U, 0.6 * U);
      c.fillStyle = "#9a9890"; c.font = '400 ' + (2.05 * U) + 'px "Hanken Grotesk", sans-serif'; c.fillText((LIB.profile && LIB.profile.title) || "AI Implementation, Workflow Automation, CRM Systems", L, 16.05 * U);
      c.fillStyle = "#ede7db"; c.font = '500 ' + (6.2 * U) + 'px "Cormorant Garamond", Garamond, serif';
      if ("letterSpacing" in c) c.letterSpacing = (0.434 * U) + "px";
      var cl = wrap(c, label(b).toUpperCase(), 56 * U); if ("letterSpacing" in c) c.letterSpacing = "0px";
      cl.forEach(function (t, i) { tracked(c, t, L, (35.16 + i * 6.6) * U, 0.434 * U); });
      c.fillStyle = "#d9d2c4"; c.font = '400 ' + (2.75 * U) + 'px "Hanken Grotesk", sans-serif';
      wrap(c, line(b), 52 * U).slice(0, 4).forEach(function (t, i) { c.fillText(t, L, (34.98 + 6.6 * cl.length + i * 3.9) * U); });
      /* the proofs: medal and line */
      var py = 72 * U, row = 9.6 * U;
      c.font = '500 ' + (2.6 * U) + 'px "Hanken Grotesk", sans-serif';
      b.p.forEach(function (x, i) {
        var m = meds[i], top = py + i * row;
        if (m) c.drawImage(m, L - 0.6 * U, top, 7 * U, 7 * U);
        c.fillStyle = "#ede7db";
        var ls = wrap(c, P[x].short, 77 * U).slice(0, 2), ty = top + (ls.length > 1 ? 2.6 : 4.4) * U;
        ls.forEach(function (t) { c.fillText(t, L + 8 * U, ty); ty += 3.38 * U; });
      });
      /* the foot: level and signature */
      var fy = H - 8.4 * U;
      c.fillStyle = "#9a9890"; c.font = '500 ' + (1.7 * U) + 'px "Hanken Grotesk", sans-serif'; tracked(c, "LEVEL", L, fy - 4.6 * U, 0.45 * U);
      c.fillStyle = "#ede7db"; c.font = '600 ' + (6 * U) + 'px "Cormorant Garamond", Garamond, serif'; c.fillText(String((LIB.profile && LIB.profile.level) || 53), L - 0.2 * U, fy + 0.6 * U);
      c.textAlign = "right";
      c.fillStyle = "#ede7db"; c.font = '600 ' + (2.6 * U) + 'px "Hanken Grotesk", sans-serif'; c.fillText(b.n ? "Built by " + b.n : "Built for you", W - L, fy - 2.6 * U);
      c.fillStyle = "#9a9890"; c.font = '400 ' + (2 * U) + 'px "Hanken Grotesk", sans-serif'; c.fillText(when(b.t) + "  ·  jasonobawemimo.com", W - L, fy + 0.6 * U);
      c.textAlign = "left";
      return cv;
    });
  }
  function fileName(b) { return "Jason Obawemimo, built for " + label(b).replace(/[^A-Za-z0-9 ]+/g, "") + ".png"; }
  function save(b, where) {
    b = b || mine(); if (!b) return Promise.resolve(false);
    return draw(b).then(function (cv) {
      return new Promise(function (ok) { cv.toBlob(function (blob) { ok(blob); }, "image/png"); });
    }).then(function (blob) {
      if (!blob) return false;
      var name = fileName(b), file = null;
      try { file = new File([blob], name, { type: "image/png" }); } catch (e) {}
      if (COARSE && file && navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: "Jason Obawemimo, built for " + label(b) }).then(function () { done("share"); return true; }, function () { return false; });
      }
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      done("download"); return true;
    });
    function done(how) { FX("send"); T("card_saved", { build: b.id, kind: b.kind, how: how, where: where || "" }); if (window.JG_TOAST) window.JG_TOAST("Card saved"); }
  }

  /* ---------- the library, the bar and the links follow the build ---------- */
  var sentFor = store.get("jg_for");
  function current() { return mine() || (sentFor && BY[sentFor] ? { v: 1, kind: "role", id: sentFor, p: BY[sentFor].proofs.slice(0, D.equip), a: BY[sentFor].titles[0], f: "bronze", n: "", t: Date.now(), sent: true } : null); }
  function apply(b) {
    b = b || current(); if (!b) { paintSlot(null); return; }
    if (window.JG_GAME && window.JG_GAME.arrange) window.JG_GAME.arrange(titlesOf(b), titlesOf(b)[0], "build");
    root.setAttribute("data-build", b.id);
    paintSlot(b.sent ? null : b, b);
    var pdf = resumePdf(b);
    $$('[data-resume="pdf"]').forEach(function (a) { if (!a.dataset.pdf0) a.dataset.pdf0 = a.getAttribute("href"); a.setAttribute("href", b.kind === "role" ? pdf : a.dataset.pdf0); if (b.kind === "role") a.setAttribute("download", "Jason Obawemimo - Resume, " + BY[b.id].label + ".pdf"); });
    var subj = b.kind === "role" ? "Your site, and a role in " + BY[b.id].label : "Your site, and my lot: " + LOT[b.id].label;
    $$('a[href^="mailto:"][data-contact="email"]').forEach(function (a) { a.setAttribute("href", "mailto:" + (LIB.email || "jobawems@gmail.com") + "?subject=" + encodeURIComponent(subj) + (b.sent ? "" : "&body=" + encodeURIComponent("The build: " + link(b) + "\n\n"))); });
  }
  function paintSlot(b, reading) {
    var slot = $("[data-p2]"); if (!slot) return;
    var ring = $("[data-p2-ring]", slot), lab = $("[data-p2-label]", slot), k = $("[data-p2-k]", slot);
    slot.classList.toggle("is-in", !!b);
    /* a reading sent with ?for=, nothing built yet: a phone shows its label too, so the reading is findable */
    slot.classList.toggle("is-sent", !b && !!(reading && reading.sent));
    slot.setAttribute("data-fin", b ? b.f : "");
    if (b) {
      var initial = (b.n || "").charAt(0).toUpperCase();
      ring.innerHTML = initial ? '<b>' + E(initial) + "</b>" : '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-check"/></svg>';
      if (k) k.textContent = b.n ? b.n + "'s build" : "Your build";
      lab.textContent = b.kind === "role" ? BY[b.id].short : "Your lot";
      slot.setAttribute("aria-label", "Player 2: " + (b.n ? b.n + "'s" : "your") + " build, " + label(b) + ". Open it.");
    } else {
      ring.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-plus"/></svg>';
      if (k) k.textContent = "Player 2";
      if (reading && reading.sent) lab.innerHTML = '<span class="p2__pre">Read for </span>' + E(BY[reading.id].short);
      else lab.textContent = COARSE ? "Tap to join" : "Press J to join";
      slot.setAttribute("aria-label", "Player 2: build me for your role");
    }
  }

  /* ---------- the build screen ---------- */
  var scr = document.getElementById("build"), viewing = null, matched = null;
  function load(h) { viewing = parse(h); if (viewing) T("build_viewed", { build: viewing.id, kind: viewing.kind }); }
  function render() {
    if (!scr) return;
    var v = viewing, b = v || mine(), role = store.get("jg_role");
    var sent = !b && sentFor && BY[sentFor] ? current() : null;
    var html = '<a class="btn btn--ghost screen__back" href="#library" data-back><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-back"/></svg>Back</a>';
    html += '<div class="build__grid"><div class="build__cardwrap" data-cardwrap>' + cardHTML(b || sent) + "</div><div class=\"build__panel\">";
    if (sent) html += sentHTML(sent);
    else if (v) {
      var who = v.n ? E(v.n) + " built me for " : "Someone built me for ";
      html += '<header class="screen__head"><h2 class="screen__h build__h" id="build-h" tabindex="-1">Player 2</h2><p class="screen__sub build__lede">' + who + "<b>" + E(label(v)) + "</b>.</p></header>";
      html += '<div class="build__acts build__acts--top">' + acts(v, true) + "</div>";
      html += '<p class="build__head">' + E(v.kind === "role" ? BY[v.id].summary : LOT[v.id].line) + "</p>";
      if (v.kind === "role") html += '<p class="build__for">Written for ' + E(BY[v.id].targets.join(", ")) + ".</p>";
    } else {
      html += '<header class="screen__head"><h2 class="screen__h build__h" id="build-h" tabindex="-1">' + (b ? (b.n ? E(b.n) + "'s build" : "Your build") : "Player 2") + '</h2><p class="screen__sub">' + (b ? "Every line on the card is a verified fact. Change anything; it's yours to keep." : "Build me for the role you're hiring for, or the problem on your lot. You keep the card.") + "</p></header>";
      var lotFirst = role === "partner";
      var roleChips = '<section class="build__sec"><h3>Read me for a role</h3><div class="chips" role="radiogroup" aria-label="Read me for a role">' + D.builds.map(function (x) { return chip("role", x.id, x.label, b); }).join("") + "</div>" + (b && b.kind === "role" ? '<p class="build__for">' + E(BY[b.id].headline) + " Written for " + E(BY[b.id].targets.join(", ")) + ".</p>" : "") + "</section>";
      var lotChips = '<section class="build__sec"><h3>Or for a problem on your lot</h3><div class="chips" role="radiogroup" aria-label="Or for a problem on your lot">' + D.lot.map(function (x) { return chip("lot", x.id, x.label, b); }).join("") + "</div>" + (b && b.kind === "lot" ? '<p class="build__for">' + E(LOT[b.id].line) + "</p>" : "") + "</section>";
      html += lotFirst ? lotChips.replace("Or for a problem on your lot", "For a problem on your lot") + roleChips.replace("Read me for a role", "Or for a role") : roleChips + lotChips;
      if (b) {
        html += '<section class="build__sec"><h3>Equip four</h3><ul class="equip">' + pool(b).map(function (x) {
          var on = b.p.indexOf(x) >= 0, p = P[x];
          return '<li><button type="button" class="equip__row' + (on ? " is-on" : "") + '" aria-pressed="' + on + '" data-equip="' + x + '"><img class="bcard__medal" src="' + medalSrc(p.medal, 80) + '" data-tier="' + p.tier + '" alt="" width="40" height="40" /><span>' + E(p.short) + '</span><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-check"/></svg></button></li>';
        }).join("") + "</ul></section>";
        html += '<section class="build__sec"><h3>Backdrop</h3><div class="arts" role="radiogroup" aria-label="Backdrop">' + ARTS.map(function (a) {
          return '<button type="button" role="radio" class="arts__one' + (b.a === a ? " is-on" : "") + '" aria-checked="' + (b.a === a) + '" data-art="' + a + '"><img src="' + artSrc(a, "tile") + '" alt="" width="64" height="64" loading="lazy" /><span>' + E(LOGO[a] || a) + "</span></button>";
        }).join("") + "</div></section>";
        html += '<section class="build__sec"><h3>Finish</h3><div class="fins" role="radiogroup" aria-label="Finish">' + D.finishes.map(function (f) {
          var ok = unlocked(f.id);
          return '<button type="button" role="radio" class="fins__one fins__one--' + f.id + (b.f === f.id ? " is-on" : "") + '" aria-checked="' + (b.f === f.id) + '" data-fin="' + f.id + '"' + (ok ? "" : ' aria-disabled="true" title="' + E(NEED[f.id] || "") + '"') + '><i></i><span>' + E(f.label) + "</span>" + (ok ? "" : '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-lock"/></svg>') + "</button>";
        }).join("") + '</div><p class="build__fine" data-fin-note>' + (unlocked("platinum") ? "Every finish is yours." : "Play the library to unlock better metals.") + "</p></section>";
        html += '<section class="build__sec"><h3>Signature</h3><label class="vh" for="build-sig">Your name on the card</label><input class="build__sig" id="build-sig" type="text" maxlength="28" autocomplete="off" spellcheck="false" autocapitalize="words" placeholder="Your first name" value="' + E(b.n || "") + '" /></section>';
        if (b.kind === "role" && window.JG_MATCH) html += '<section class="build__sec"><h3>Match a job listing</h3><label class="vh" for="build-list">Paste the job listing</label><textarea class="build__list" id="build-list" rows="4" placeholder="Paste the listing. It\'s read on your device and never leaves this page."></textarea><div class="build__row"><button class="btn btn--sm" type="button" data-match>Match it</button></div><div class="match" data-match-out aria-live="polite">' + (matched ? matchHTML(matched) : "") + "</div></section>";
        html += '<div class="build__acts">' + acts(b, false) + "</div>";
        html += sendForm(b);
      }
    }
    html += "</div></div>";
    scr.innerHTML = html;
  }
  function chip(kind, id, text, b) {
    var on = b && b.kind === kind && b.id === id;
    return '<button type="button" role="radio" class="chip' + (on ? " is-on" : "") + '" aria-checked="' + !!on + '" data-pick="' + kind + ":" + id + '">' + E(text) + "</button>";
  }
  /* ---------- the funnel: who sees my availability, and where ---------- */
  function seat() { return store.get("jg_role") || ""; }
  function openLine() { return '<p class="build__fine build__open" data-open-line>' + E(say("open", "I'm open to full-time, part-time and contract roles, remote or on site in Houston.")) + "</p>"; }
  function hireFor(b) { var to = LOT[b.id] && LOT[b.id].build; return BY[to] ? to : "dealer-tech"; }
  function hireLine(b) { var to = hireFor(b); return '<p class="build__fine build__open build__hire" data-hire-line>' + E(say("hiring", "Hiring for your lot?")) + ' <button class="build__textbtn" type="button" data-hire="' + to + '">' + E(say("hiring_link", "Read me for")) + " " + E(BY[to].label) + "</button></p>"; }
  function referLine() { return '<p class="build__fine build__open build__ref" data-referral-line>' + E(say("referral", "Know someone hiring?")) + ' <button class="build__textbtn" type="button" data-referral>' + E(say("referral_link", "Send them your build.")) + "</button></p>"; }
  function acts(b, view) {
    var a = [], lurk = seat() === "lurker";
    /* just looking: the card leads, and the bar's Resume is there for anyone who wants it; anyone else on a role gets the resume first */
    if (b.kind === "role" && (view || !lurk)) a.push(resumeLink(b, "btn btn--primary", view));
    if (view) {
      a.push('<a class="btn" href="mailto:' + E(LIB.email || "jobawems@gmail.com") + "?subject=" + encodeURIComponent(b.kind === "role" ? "Your site, and a role in " + BY[b.id].label : "Your site, and my lot: " + LOT[b.id].label) + "&body=" + encodeURIComponent("The build: " + link(b) + "\n\n") + '" data-contact="email" data-where="build"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-mail"/></svg>Email me about it</a>');
      a.push('<button class="btn btn--ghost" type="button" data-make-own>Make your own</button>');
      if (b.kind === "role" && !lurk) a.push(openLine());
      return a.join("");
    }
    if (b.kind === "lot") a.push(lotCta(b, "btn btn--primary", "build"));
    a.push('<button class="btn' + (lurk && b.kind === "role" ? " btn--primary" : "") + '" type="button" data-save><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-share"/></svg>Save the card</button>');
    /* just looking: the referral below is the one way to copy the link */
    if (!lurk) a.push('<button class="btn" type="button" data-copy-link><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-link"/></svg>Copy the link</button>');
    a.push('<button class="btn btn--ghost" type="button" data-send-open><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-send"/></svg>Send it to me</button>');
    if (b.kind === "lot" && LOT[b.id].obavia) a.push('<p class="build__fine build__obavia">' + E(LOT[b.id].obavia) + "</p>");
    if (lurk) a.push(referLine());
    else a.push(b.kind === "role" ? openLine() : hireLine(b));
    return a.join("");
  }
  /* a ?for= link, nothing built yet: the reading as I sent it (the card beside it already carries the headline) */
  function sentHTML(r) {
    var x = BY[r.id];
    return '<header class="screen__head"><h2 class="screen__h build__h" id="build-h" tabindex="-1">Player 2</h2><p class="screen__sub build__lede">' + E(say("sent", "The reading I sent you:")) + " <b>" + E(x.label) + "</b></p></header>" +
      '<div class="build__acts build__acts--top">' + resumeLink(r, "btn btn--primary", true) + '<button class="btn" type="button" data-make-yours="' + r.id + '"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-plus"/></svg>' + E(say("make", "Make it yours")) + "</button>" + (seat() !== "lurker" ? openLine() : "") + "</div>" +
      '<p class="build__head">' + E(x.summary) + '</p><p class="build__for">Written for ' + E(x.targets.join(", ")) + ".</p>";
  }
  function sendForm(b) {
    return '<form class="build__send" data-send hidden novalidate>' +
      '<p class="build__send-h">It lands in my inbox with the card, the link and your note. I read every one.</p>' +
      '<label class="label" for="bs-email">Your email</label><input id="bs-email" name="email" type="email" required maxlength="120" autocomplete="email" placeholder="you@company.com" />' +
      '<label class="label" for="bs-note">' + (b.kind === "role" ? "A line about the role (optional)" : "A line about your lot (optional)") + '</label><textarea id="bs-note" name="note" rows="3" maxlength="600"></textarea>' +
      '<input class="vh" tabindex="-1" aria-hidden="true" autocomplete="off" name="website" />' +
      '<div class="build__row"><button class="btn btn--primary" type="submit">Send</button><button class="btn btn--ghost" type="button" data-send-close>Not now</button></div>' +
      '<p class="build__fine" data-send-out aria-live="polite"></p></form>';
  }
  function matchHTML(m) {
    var h = "";
    if (m.on.length) h += '<p class="match__k">On my record</p><ul class="match__on">' + m.on.slice(0, 18).map(function (x) { return "<li>" + E(x.as || x.term) + "</li>"; }).join("") + "</ul>";
    if (m.off.length) h += '<p class="match__k">Not on my record</p><ul class="match__off">' + m.off.slice(0, 12).map(function (x) { return "<li>" + E(x.as || x.term) + "</li>"; }).join("") + "</ul>";
    if (m.facts && m.facts.length) h += m.facts.map(function (f) { return '<p class="build__fine">' + E(typeof f === "string" ? f : (f.answer || f.text || "")) + "</p>"; }).join("");
    if (!m.on.length) h += '<p class="build__fine">Nothing in it matched my record. Pick the closest role instead.</p>';
    return h;
  }
  function repaintCard(b, anim) { var w = $("[data-cardwrap]", scr); if (!w) return; w.classList.remove("bcard-swap"); w.innerHTML = cardHTML(b); if (anim) { void w.offsetWidth; w.classList.add("bcard-swap"); } }
  function edit(fn, what, val) { var b = mine(); if (!b) return; fn(b); keep(b); repaintCard(b, true); paintSlot(b); FX("choice"); T("build_edited", { what: what, value: String(val || "").slice(0, 40), build: b.id }); }

  if (scr) {
    scr.addEventListener("click", function (e) {
      var t = e.target.closest("button,a"); if (!t) return;
      if (t.hasAttribute("data-pick")) { var kv = t.getAttribute("data-pick").split(":"); var prev = mine(); if (prev && prev.kind === kv[0] && prev.id === kv[1]) return; var nb = make(kv[0], kv[1], "screen"); if (nb && prev) { nb.n = prev.n; nb.a = titlesOf(nb)[0]; keep(nb); } matched = null; FX("choice"); render(); focusIn('[data-pick="' + kv.join(":") + '"]'); return; }
      if (t.hasAttribute("data-equip")) {
        var id = t.getAttribute("data-equip");
        edit(function (b) { var i = b.p.indexOf(id); if (i >= 0) { if (b.p.length > 1) b.p.splice(i, 1); } else { b.p.push(id); if (b.p.length > D.equip) b.p.shift(); } }, "equip", id);
        var b2 = mine(); $$("[data-equip]", scr).forEach(function (r) { var on = b2.p.indexOf(r.getAttribute("data-equip")) >= 0; r.classList.toggle("is-on", on); r.setAttribute("aria-pressed", on); });
        return;
      }
      if (t.hasAttribute("data-art")) { var a = t.getAttribute("data-art"); edit(function (b) { b.a = a; }, "art", a); $$("[data-art]", scr).forEach(function (x) { var on = x === t; x.classList.toggle("is-on", on); x.setAttribute("aria-checked", on); }); return; }
      if (t.hasAttribute("data-fin")) {
        var f = t.getAttribute("data-fin");
        if (!unlocked(f)) { var n = $("[data-fin-note]", scr); if (n) n.textContent = (NEED[f] || "") + " to unlock " + f + "."; return; }
        edit(function (b) { b.f = f; }, "finish", f); $$("[data-fin]", scr).forEach(function (x) { var on = x === t; x.classList.toggle("is-on", on); x.setAttribute("aria-checked", on); }); return;
      }
      if (t.hasAttribute("data-save")) { e.preventDefault(); save(mine(), "screen"); return; }
      if (t.hasAttribute("data-copy-link")) { e.preventDefault(); copyLink(mine(), "screen"); return; }
      if (t.hasAttribute("data-send-open")) { var fm = $("[data-send]", scr); fm.hidden = false; FX("choice"); $("#bs-email", fm).focus(); return; }
      if (t.hasAttribute("data-send-close")) { $("[data-send]", scr).hidden = true; return; }
      if (t.hasAttribute("data-make-yours")) { var mb = make("role", t.getAttribute("data-make-yours"), "sent"); if (!mb) return; FX("choice"); render(); repaintCard(mb, true); scr.scrollTop = 0; focusIn("#build-h"); return; }
      if (t.hasAttribute("data-hire")) {
        var pv = mine(), hb = make("role", t.getAttribute("data-hire"), "hiring"); if (!hb) return;
        if (pv) { hb.n = pv.n; keep(hb); paintSlot(hb); }
        matched = null; FX("choice"); T("cta_click", { cta: "hiring", where: "build", lot: pv && pv.kind === "lot" ? pv.id : "" });
        render(); repaintCard(hb, true);
        if (window.JG_TOAST) window.JG_TOAST("Read for " + BY[hb.id].label);
        /* a phone stacks the card above the panel: show what changed, the resume is next in the tab order */
        var rl = $("[data-build-resume]", scr);
        if (matchMedia("(max-width: 899px)").matches) { scr.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); if (rl) rl.focus({ preventScroll: true }); }
        else if (rl) { rl.focus({ preventScroll: true }); rl.scrollIntoView({ block: "center" }); }
        return;
      }
      if (t.hasAttribute("data-referral")) { e.preventDefault(); copyLink(mine(), "referral"); return; }
      if (t.hasAttribute("data-make-own")) { viewing = null; try { history.replaceState(null, "", location.pathname + location.search + "#build"); } catch (e2) {} FX("choice"); render(); return; }
      if (t.hasAttribute("data-match")) { runMatch(); return; }
      if (t.hasAttribute("data-build-resume")) { var bb = viewing || mine() || current(); T("build_resume", { build: bb ? bb.id : "", matched: !!matched, viewing: !!viewing, where: viewing ? "shared" : mine() ? "screen" : "sent" }); FX("send"); return; }
      if (t.hasAttribute("data-build-obavia")) { var lb = mine(); if (lb) store.set("jg_lot", LOT[lb.id].label); T("cta_click", { cta: "obavia_early", where: "build" }); return; }
    });
    scr.addEventListener("input", function (e) {
      if (e.target.id === "build-sig") { var v = clean(e.target.value); var b = mine(); if (!b) return; b.n = v; keep(b); repaintCard(b); paintSlot(b); var h = $("#build-h", scr); if (h) h.textContent = v ? v + "'s build" : "Your build"; }
    });
    scr.addEventListener("change", function (e) { if (e.target.id === "build-sig") { var v = clean(e.target.value); if (v) { store.set("jg_name", v); FX("choice"); T("build_edited", { what: "signature" }); } } });
    scr.addEventListener("submit", function (e) { if (e.target.hasAttribute("data-send")) { e.preventDefault(); send(e.target); } });
  }
  function focusIn(sel) { var x = $(sel, scr); if (x) x.focus({ preventScroll: true }); }
  function runMatch() {
    var ta = $("#build-list", scr); if (!ta || !window.JG_MATCH) return;
    var text = ta.value.trim(); if (!text) { ta.focus(); return; }
    var m = window.JG_MATCH.read(text); if (!m) return;
    matched = m;
    var b = mine();
    if (m.build && BY[m.build] && (!b || b.kind !== "role" || b.id !== m.build)) { var keepName = b && b.n; b = make("role", m.build, "listing"); if (keepName) { b.n = keepName; keep(b); } }
    /* equip the proofs the listing asked for first */
    var want = {}; m.on.forEach(function (x) { (x.proofs || []).forEach(function (p) { want[p] = (want[p] || 0) + 1; }); });
    var pl = pool(b).slice().sort(function (x, y) { return (want[y] || 0) - (want[x] || 0); });
    b.p = pl.slice(0, D.equip); keep(b);
    FX("arrive");
    T("listing_matched", { build: b.id, on: m.on.length, off: m.off.length });
    render();
    var out = $("[data-match-out]", scr); if (out) out.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function copyLink(b, where) {
    b = b || mine(); if (!b) return;
    var text = link(b);
    var ok = function () { FX("send"); if (window.JG_TOAST) window.JG_TOAST("Link copied"); T("build_link_copied", { build: b.id, kind: b.kind, where: where || "" }); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { prompt("Copy the link", text); });
    else prompt("Copy the link", text);
  }
  function send(form) {
    var b = mine(); if (!b) return;
    var out = $("[data-send-out]", form), email = form.email.value.trim(), note = form.note.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { out.textContent = "That email doesn't look right."; form.email.focus(); return; }
    var btn = $('button[type="submit"]', form); btn.disabled = true; out.textContent = "Sending.";
    var body = { kind: "build", name: b.n || clean(store.get("jg_name") || ""), email: email, note: note, website: form.website.value, build: b.kind === "role" ? b.id : "", lot: b.kind === "lot" ? b.id : "", proofs: b.p, link: link(b), on: matched ? matched.on.map(function (x) { return x.as || x.term; }) : [], off: matched ? matched.off.map(function (x) { return x.as || x.term; }) : [], seat: store.get("jg_role") || "" };
    fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(function (r) { return r.ok ? r.json() : { ok: false }; }).catch(function () { return { ok: false }; }).then(function (j) {
      btn.disabled = false;
      T("build_sent", { build: b.id, kind: b.kind, delivered: !!(j && j.delivered) });
      if (j && j.delivered) { FX("send"); out.textContent = "Sent. I'll write back to " + email + "."; if (window.JG_TOAST) window.JG_TOAST("Sent to Jason"); form.reset(); return; }
      var subj = b.kind === "role" ? "Your site, and a role in " + BY[b.id].label : "Your site, and my lot: " + LOT[b.id].label;
      location.href = "mailto:" + (LIB.email || "jobawems@gmail.com") + "?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent((note ? note + "\n\n" : "") + "The build: " + link(b) + "\n\nFrom: " + email);
      out.textContent = "Your mail app has it, ready to send.";
    });
  }

  document.addEventListener("jg:screen", function (e) { if (e.detail && e.detail.name === "build") { render(); T("build_opened", { has: !!mine(), viewing: !!viewing }); } });
  document.addEventListener("jg:screen-closed", function (e) { if (e.detail && e.detail.name === "build") { viewing = null; } });
  document.addEventListener("jg:trophy", function () { if (scr && scr.classList.contains("is-open") && !viewing) render(); });

  /* ---------- start ---------- */
  apply();
  document.addEventListener("jg:intro-done", function () { apply(); });

  window.JG_BUILD = { data: D, get: mine, make: make, sign: sign, cardHTML: cardHTML, save: save, load: load, label: label, link: link, apply: apply, line: line, resume: resumeLink, lotCta: lotCta, copyLink: copyLink, setMatch: function (m) { matched = m || null; } };
})();
