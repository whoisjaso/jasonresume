/* The reel. A cut for each visitor, Stories style: it plays itself, one idea
   per shot, and ends on the next move. Tap the right side to go on, the left
   to go back, hold to pause, Escape or the cross to leave. Leaving lands you
   on the Slate. Every fact here is in llms.txt; the buyer is fictional and
   says so.
   window.JG_REEL.play(role, { name, from })   role: interviewer | partner | lurker */
(function () {
  "use strict";
  var root = document.documentElement, body = document.body;
  if (!body.classList.contains("home")) return;
  var RM = matchMedia("(prefers-reduced-motion: reduce)").matches || root.hasAttribute("data-still");
  var COARSE = matchMedia("(pointer: coarse)").matches;
  var T = window.JG_TRACK || function () {};
  function fx(k) { if (window.JG_FX) window.JG_FX(k); }
  function sfx(n, o) { return window.JG_SFX ? window.JG_SFX.play(n, o) : false; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var DATA = {}; try { DATA = JSON.parse(document.getElementById("record-data").textContent); } catch (e) {}
  var EMAIL = DATA.email || "jobawems@gmail.com", CAL = DATA.calendar || "https://calendly.com/jason-apohenia/30min", PDF = DATA.pdf || "assets/Jason_Obawemimo_Resume_2026.pdf";
  var FACE = "assets/jason-headshot-620.webp";

  /* ---------- shots ---------- */
  var BUYER = { s: "We paid an agency last year and I never knew who was actually on my account.", mine: ["never knew", "actually on my account"] };
  var STAGES = [["Capture", "The inquiry becomes a lead."], ["Connect", "One owner, the buyer's exact words."], ["Book", "A call with a clear purpose."], ["Discover", "Fit, from what actually happened."], ["Agree", "The buyer's words reach the closer."], ["Collect", "Cash, counted when verified."]];
  var LOGOS = ["claude", "anthropic", "modelcontextprotocol", "supabase", "postgresql", "vercel", "github"];
  var CHECKS = [["LinkedIn", "Jason Obawemimo"], ["GitHub", "whoisjaso, with this site's source"], ["Triple J Auto Investment", "8774 Almeda Genoa Rd, Houston"], ["Degree", "Associate degree PDF"], ["Coursework", "Anthropic certificates PDF"], ["Public record", "City of Pearland document"]];

  var CUTS = {
    interviewer: { label: "The screening cut", shots: [
      { k: "title", ms: 4600, h: "Jason <em>Obawemimo.</em>", p: "AI engineer and business operator. Pearland, Texas." },
      { k: "audit", ms: 7600 },
      { k: "photo", ms: 6600, img: "assets/brand/triplej-og.jpg", h: "Triple J Auto <em>Investment.</em>", p: "I’ve co-owned and run it since August 2024: intake, pricing, inventory, scheduling, vendors, and the negotiation.", chip: "8774 Almeda Genoa Rd, Houston" },
      { k: "film", ms: 7400, from: 37.3, h: "Handle a <em>Sale.</em>", p: "The desk Triple J closes sales on. I built it. Scan the license once and every form fills itself." },
      { k: "stages", ms: 7200, h: "<em>Obavia.</em>", p: "A sales intelligence platform I’m building for agency owners and their setters and closers. In development since September 2024." },
      { k: "words", ms: 7200, cap: "It picks out the words that matter, then tells the rep what to ask next." },
      { k: "stack", ms: 6800 },
      { k: "checks", ms: 6400 },
      { k: "end", cta: "interviewer" }
    ] },
    partner: { label: "The agency owner cut", shots: [
      { k: "quote", ms: 5600, q: "Most sales floors don’t lose the deal on the call. They lose it in the <em>handoff.</em>" },
      { k: "obavia", ms: 6200 },
      { k: "words", ms: 7200, cap: "The closer gets the buyer’s exact words, not a summary of them." },
      { k: "stages", ms: 8600, h: "From the first inquiry to <em>collected cash.</em>", p: "Six stages, inside your own funnel, scripts and vocabulary.", long: true },
      { k: "big", ms: 4800, h: "Progress ranked on <em>collected cash,</em> not calls." },
      { k: "photo", ms: 6200, img: "assets/brand/triplej-og.jpg", h: "Built by an <em>operator.</em>", p: "I co-own a used car dealership in Houston and built the desk it closes sales on.", chip: "Triple J Auto Investment" },
      { k: "price", ms: 8000 },
      { k: "end", cta: "partner" }
    ] },
    lurker: { label: "The fun cut", shots: [
      { k: "title", ms: 4200, h: "Jason <em>Obawemimo.</em>", p: "No pitch. Here are the fun parts." },
      { k: "film", ms: 7000, from: 37.3, h: "A desk that <em>fills itself.</em>", p: "I built the sale desk a Houston dealership closes on. Scan once, every form fills." },
      { k: "words", ms: 7000, cap: "Listen to the person. The words they choose tell you what to ask." },
      { k: "rig", ms: 6400 },
      { k: "end", cta: "lurker" }
    ] }
  };

  function title(s) { return '<div class="rs__face"><img src="' + FACE + '" alt="" /></div><h2 class="rs__h rs__h--xl" data-d="1">' + s.h + '</h2><p class="rs__p" data-d="2">' + s.p + "</p>"; }
  function audit() {
    return '<h2 class="rs__h" data-d="0">My work starts with a <em>process audit.</em></h2>' +
      '<p class="rs__lead" data-d="1">I find where <mark data-ink="1">work gets delayed</mark>, where <mark data-ink="2">information gets lost</mark>, and where <mark data-ink="3">people repeat tasks</mark> that AI could handle.</p>' +
      '<p class="rs__p rs__p--gold" data-d="5">Then I write the requirements, build the workflow, and keep a human checking it.</p>';
  }
  function photo(s) { return '<figure class="rs__photo"><img src="' + s.img + '" alt="" /></figure><div class="rs__over"><h2 class="rs__h" data-d="1">' + s.h + '</h2><p class="rs__p" data-d="2">' + s.p + '</p>' + (s.chip ? '<p class="rs__chip" data-d="3">' + esc(s.chip) + "</p>" : "") + "</div>"; }
  function film(s) {
    return '<div class="rs__phone"><video muted playsinline preload="none" poster="assets/film/triple-j-sale-desk.jpg" data-from="' + s.from + '"></video><span class="rs__live">Real film. Fictional buyer.</span></div>' +
      '<div class="rs__side"><h2 class="rs__h" data-d="1">' + s.h + '</h2><p class="rs__p" data-d="2">' + s.p + "</p></div>";
  }
  function stages(s) {
    return (s.long ? "" : '<span class="appicon appicon--lg rs__icon" data-d="0"><img src="assets/brand/obavia-icon.png" alt="" /></span>') +
      '<h2 class="rs__h" data-d="1">' + s.h + '</h2><p class="rs__p" data-d="2">' + s.p + "</p>" +
      '<ol class="rs__stages' + (s.long ? " rs__stages--long" : "") + '"><svg class="rs__thread" viewBox="0 0 600 4" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M2 2H598"/></svg>' +
      STAGES.map(function (x, i) { return '<li style="--i:' + i + '"><b>' + x[0] + "</b>" + (s.long ? "<span>" + x[1] + "</span>" : "") + "</li>"; }).join("") + "</ol>";
  }
  function words(s) {
    var t = esc(BUYER.s); BUYER.mine.forEach(function (m, i) { t = t.replace(m, '<mark data-ink="' + (i + 1) + '">' + m + "</mark>"); });
    return '<p class="rs__fiction" data-d="0">A fictional buyer, on a call</p><blockquote class="rs__quote rs__quote--buyer" data-d="1">“' + t + '”</blockquote><p class="rs__p rs__p--gold" data-d="4">' + s.cap + "</p>";
  }
  function stack() {
    return '<h2 class="rs__h" data-d="0">What I <em>build with.</em></h2><div class="rs__logos">' +
      LOGOS.map(function (n, i) { return '<span class="appicon appicon--logo appicon--ink" style="--i:' + i + '"><img src="assets/brand/stack/' + n + '.svg" alt="' + n + '" /></span>'; }).join("") + "</div>" +
      '<div class="rs__stats" data-d="3"><p><b data-count="19">0</b><span>Anthropic courses completed</span></p><p><b data-count="3.63" data-dec="2">0</b><span>GPA, Associate of Arts in Business, Dean’s Honor List</span></p></div>';
  }
  function checks() {
    return '<h2 class="rs__h" data-d="0">Check <em>every claim.</em></h2><ul class="group rs__checks">' +
      CHECKS.map(function (c, i) { return '<li style="--i:' + i + '"><span class="rs__tick" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16"><use href="#i-check"/></svg></span><span><b>' + c[0] + "</b> " + c[1] + "</span></li>"; }).join("") +
      '</ul><p class="rs__p" data-d="4">Same name, same titles, same town on every one. The links are under Check me.</p>';
  }
  function quote(s) { return '<div class="rs__face rs__face--sm"><img src="' + FACE + '" alt="" /></div><blockquote class="rs__quote" data-d="1">' + s.q + '</blockquote><p class="rs__cite" data-d="2">Jason Obawemimo, founder of Obavia</p>'; }
  function obavia() {
    return '<span class="appicon appicon--lg rs__icon" data-d="0"><img src="assets/brand/obavia-icon.png" alt="" /></span><h2 class="rs__h rs__h--xl" data-d="1"><em>Obavia.</em></h2>' +
      '<p class="rs__lead" data-d="2">Hear what clients really mean. Carry it from the first call to collected cash.</p><p class="rs__p" data-d="3">For agency owners at $100K to $1M a month and their own setters and closers. In development, not live yet.</p>';
  }
  function big(s) { return '<h2 class="rs__h rs__h--xl" data-d="0">' + s.h + "</h2>"; }
  function price() {
    return '<h2 class="rs__h" data-d="0">Core is planned at <em>$3,000 a month.</em></h2><ul class="group rs__plan" data-d="1"><li><b>Up to 10</b> active sellers</li><li><b>5,000</b> pooled meeting minutes</li><li><b>$5,000</b> one-time implementation</li></ul>' +
      '<p class="rs__p" data-d="3">Scale and Enterprise are proposed. It’s in development, not live, and the waitlist is free and grants no access.</p>';
  }
  function rig() {
    return '<h2 class="rs__h" data-d="0">This whole site is <em>hand-built.</em></h2><p class="rs__lead" data-d="1">No framework, no build step. The sound, the films, the desk game and this reel are all mine.</p>' +
      '<p class="rs__p rs__p--gold" data-d="2">' + (COARSE ? "Open the menu and show the rig to see it running." : "Press the key under Esc to see the rig running.") + "</p>";
  }
  function end(s, name) {
    var first = name ? ", " + esc(name) : "";
    var c = {
      interviewer: { h: "Your move" + first + ".", p: "If I’m a fit, email is fastest. The one-page resume and every proof link are one tap away.",
        b: [["Email me", "mailto:" + EMAIL + "?subject=" + encodeURIComponent("Your site, and a role"), "gold", "email"], ["One-page resume", PDF, "", "pdf"], ["Book 30 minutes", CAL, "", "book"]],
        s: [["Run the desk yourself", "desk"], ["Look around", "site"]] },
      partner: { h: "Where does yours leak" + first + "?", p: "Thirty minutes on your funnel, or a minute on the leak finder. Either way you leave with something.",
        b: [["Book 30 minutes", CAL, "gold", "book"], ["Find your leak", "/obavia.html#leaks", "", "leaks"], ["The Obavia briefing", "/obavia.html", "", "briefing"]],
        s: [["Look around", "site"]] },
      lurker: { h: "Have a look around" + first + ".", p: "The desk is a game. The trailer is a minute. Both are better than scrolling.",
        b: [["Run the desk", "#desk", "gold", "desk"], ["Roll the trailer", "#trailer", "", "trailer"]],
        s: [["Send this to someone", "share"], ["Look around", "site"]] }
    }[s.cta];
    return '<div class="rs__face rs__face--sm" data-d="0"><img src="' + FACE + '" alt="" /></div><h2 class="rs__h rs__h--xl" data-d="1">' + c.h + '</h2><p class="rs__p" data-d="2">' + c.p + "</p>" +
      '<div class="rs__ctas" data-d="3">' + c.b.map(function (b) {
        var ext = /^https?:/.test(b[1]) ? ' target="_blank" rel="noopener"' : "";
        var dl = b[3] === "pdf" ? ' download="Jason Obawemimo - Resume.pdf" data-resume="pdf"' : b[3] === "email" ? " data-contact=\"email\"" : b[3] === "book" ? " data-book=\"reel\"" : "";
        return '<a class="btn' + (b[2] ? " btn--gold" : "") + '" href="' + esc(b[1]) + '"' + ext + dl + ' data-reel-cta="' + b[3] + '">' + b[0] + "</a>";
      }).join("") + "</div>" +
      '<p class="rs__more" data-d="4">' + c.s.map(function (x) { return '<button type="button" class="textlink" data-reel-go="' + x[1] + '">' + x[0] + "</button>"; }).join("") + "</p>";
  }
  var DRAW = { title: title, audit: audit, photo: photo, film: film, stages: stages, words: words, stack: stack, checks: checks, quote: quote, obavia: obavia, big: big, price: price, rig: rig, end: end };

  /* ---------- the stage ---------- */
  var el = null, shots = [], i = 0, role = null, name = "", elapsed = 0, last = 0, paused = false, held = false, raf = 0, open = false, video = null, viaIntro = false;
  function build() {
    var cut = CUTS[role];
    el = document.createElement("div");
    el.className = "reel"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", cut.label);
    el.innerHTML =
      '<div class="reel__top"><div class="reel__bars">' + cut.shots.map(function () { return "<i><b></b></i>"; }).join("") + "</div>" +
        '<div class="reel__who"><img src="' + FACE + '" alt="" /><span><b>Jason Obawemimo</b> ' + esc(cut.label) + '</span>' +
        '<button type="button" class="reel__btn" data-reel-pause aria-label="Pause"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>' +
        '<button type="button" class="reel__btn" data-toggle="sound" aria-label="Sound"></button>' +
        '<button type="button" class="reel__btn" data-reel-close aria-label="Close and look around"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div></div>' +
      '<div class="reel__shots">' + cut.shots.map(function (s, n) { return '<section class="rs rs--' + s.k + '" data-n="' + n + '" aria-hidden="true"><div class="rs__in">' + DRAW[s.k](s, name) + "</div></section>"; }).join("") + "</div>" +
      '<p class="reel__hint" aria-hidden="true">' + (COARSE ? "Tap to go on. Hold to pause." : "Click or press → to go on. Space pauses.") + "</p>" +
      '<button type="button" class="reel__nav reel__nav--prev" data-reel-prev aria-label="Previous"></button><button type="button" class="reel__nav reel__nav--next" data-reel-next aria-label="Next"></button>';
    body.appendChild(el);
    shots = [].slice.call(el.querySelectorAll(".rs"));
    var snd = el.querySelector('[data-toggle="sound"]'), muted = window.JG_SFX && window.JG_SFX.muted && window.JG_SFX.muted();
    snd.textContent = muted ? "Sound off" : "Sound on";
    wire();
  }

  function play(r, o) {
    if (open || !CUTS[r]) return;
    o = o || {}; role = r; name = (o.name || "").split(" ")[0]; viaIntro = o.from === "intro"; i = 0;
    open = true; build();
    if (window.JG_LOCK) window.JG_LOCK(true);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("is-on"); show(0, 1); }); });
    T("reel_started", { role: r, where: o.from || "chip" });
    last = performance.now(); raf = requestAnimationFrame(loop);
  }

  function show(n, dir) {
    if (n < 0) n = 0;
    if (n >= shots.length) n = shots.length - 1;
    var prev = shots[i];
    if (prev && prev !== shots[n]) { prev.classList.remove("is-on"); prev.classList.add(dir > 0 ? "is-past" : "is-future"); prev.setAttribute("aria-hidden", "true"); }
    i = n; elapsed = 0;
    var s = shots[i], spec = CUTS[role].shots[i];
    s.classList.remove("is-past", "is-future"); void s.offsetWidth; s.classList.add("is-on"); s.removeAttribute("aria-hidden");
    shots.forEach(function (x, k) { if (k < i) { x.classList.add("is-past"); x.classList.remove("is-future"); } else if (k > i) { x.classList.add("is-future"); x.classList.remove("is-past"); } });
    var bars = el.querySelectorAll(".reel__bars i b");
    bars.forEach(function (b, k) { b.style.transform = "scaleX(" + (k < i ? 1 : 0) + ")"; });
    stopVideo();
    if (spec.k === "film") startVideo(s);
    if (spec.k === "stack") count(s);
    el.classList.toggle("is-end", spec.k === "end");
    if (spec.k === "end") { fx("unlock"); T("reel_finished", { role: role }); var f = s.querySelector(".btn"); if (f && !COARSE) setTimeout(function () { f.focus({ preventScroll: true }); }, 500); }
    T("reel_shot", { role: role, n: i, kind: spec.k });
  }
  function next(manual) {
    if (i >= shots.length - 1) return;
    if (manual) { sfx("swoosh", { gain: 0.28, rate: 1.1 }); if (window.JG_HAPTIC) window.JG_HAPTIC("tap"); } else sfx("swoosh", { gain: 0.14, rate: 1.2 });
    show(i + 1, 1);
  }
  function prev() { if (i === 0) { elapsed = 0; return; } sfx("swoosh", { gain: 0.22, rate: 0.9 }); show(i - 1, -1); }

  function loop(now) {
    if (!open) return;
    var dt = now - last; last = now;
    var spec = CUTS[role].shots[i];
    if (!paused && !held && spec.ms && !document.hidden) {
      elapsed += dt;
      var b = el.querySelectorAll(".reel__bars i b")[i];
      if (b) b.style.transform = "scaleX(" + Math.min(1, elapsed / spec.ms) + ")";
      if (elapsed >= spec.ms) next(false);
    }
    raf = requestAnimationFrame(loop);
  }
  function setPaused(p) {
    paused = p; el.classList.toggle("is-paused", p);
    var b = el.querySelector("[data-reel-pause]");
    b.setAttribute("aria-label", p ? "Play" : "Pause");
    b.innerHTML = p ? '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>' : '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
    if (video) { if (p) video.pause(); else video.play().catch(function () {}); }
  }

  /* the real Handle a Sale film, muted, from the scan */
  function startVideo(s) {
    var v = s.querySelector("video"); if (!v) return;
    var save = navigator.connection && navigator.connection.saveData;
    if (save || RM) return;
    video = v;
    if (!v.src) { v.preload = "auto"; v.src = "assets/film/triple-j-sale-desk.mp4"; }
    var from = parseFloat(v.getAttribute("data-from")) || 0;
    function go() { try { v.currentTime = from; } catch (e) {} v.play().catch(function () {}); }
    if (v.readyState >= 1) go(); else v.addEventListener("loadedmetadata", go, { once: true });
  }
  function stopVideo() { if (video) { try { video.pause(); } catch (e) {} video = null; } }
  function count(s) {
    s.querySelectorAll("[data-count]").forEach(function (b) {
      var to = parseFloat(b.getAttribute("data-count")), dec = parseInt(b.getAttribute("data-dec") || "0", 10), t0 = performance.now(), dur = RM ? 1 : 1400;
      (function f(now) { var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3); b.textContent = (to * e).toFixed(dec); if (p < 1) requestAnimationFrame(f); })(t0);
    });
  }

  /* ---------- input: tap sides, hold to pause, swipe down to leave ---------- */
  function wire() {
    var downAt = 0, dx0 = 0, dy0 = 0, holdT = null, moved = false;
    var stage = el.querySelector(".reel__shots");
    stage.addEventListener("pointerdown", function (e) {
      if (e.target.closest("a, button")) return;
      downAt = performance.now(); dx0 = e.clientX; dy0 = e.clientY; moved = false;
      holdT = setTimeout(function () { held = true; el.classList.add("is-held"); if (video) video.pause(); }, 220);
    });
    stage.addEventListener("pointermove", function (e) { if (downAt && (Math.abs(e.clientX - dx0) > 12 || Math.abs(e.clientY - dy0) > 12)) moved = true; });
    stage.addEventListener("pointerup", function (e) {
      if (!downAt) return;
      clearTimeout(holdT);
      var wasHeld = held; held = false; el.classList.remove("is-held");
      if (video && !paused) video.play().catch(function () {});
      var dy = e.clientY - dy0, dx = e.clientX - dx0; downAt = 0;
      if (dy > 90 && Math.abs(dy) > Math.abs(dx)) return leave("site", "swipe");
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) next(true); else prev(); return; }
      if (wasHeld || moved) return;
      if (CUTS[role].shots[i].k === "end") return;
      if (e.clientX < innerWidth * 0.3) prev(); else next(true);
    });
    stage.addEventListener("pointercancel", function () { clearTimeout(holdT); held = false; downAt = 0; el.classList.remove("is-held"); });
    el.querySelector("[data-reel-next]").addEventListener("click", function () { next(true); });
    el.querySelector("[data-reel-prev]").addEventListener("click", prev);
    el.querySelector("[data-reel-pause]").addEventListener("click", function () { setPaused(!paused); });
    el.querySelector("[data-reel-close]").addEventListener("click", function () { leave("site", "close"); });
    el.addEventListener("click", function (e) {
      var g = e.target.closest("[data-reel-go]"), a = e.target.closest("[data-reel-cta]");
      if (a) {
        var k = a.getAttribute("data-reel-cta"); fx("choice"); T("cta_click", { label: "reel_" + k, role: role });
        if (k === "briefing" || k === "leaks") { try { sessionStorage.setItem("jg_greet", name || "1"); } catch (err) {} }
        if (k === "desk" || k === "trailer") { e.preventDefault(); leave(k, "cta"); }
        return;
      }
      if (!g) return;
      var to = g.getAttribute("data-reel-go");
      if (to === "share") { share(); return; }
      if (to === "desk") fx("choice");
      leave(to, "cta");
    });
    addEventListener("keydown", keys, true);
  }
  function keys(e) {
    if (!open || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target; if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
    if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); next(true); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); prev(); }
    else if (e.key === " " && !(t && /^(A|BUTTON)$/.test(t.tagName))) { e.preventDefault(); e.stopPropagation(); setPaused(!paused); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); leave("site", "escape"); }
    else if (e.key === "Tab") {
      var f = [].slice.call(el.querySelectorAll("button, a")).filter(function (n) { return n.offsetParent !== null && !n.closest('[aria-hidden="true"]'); });
      if (!f.length) return;
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      else if (!el.contains(document.activeElement)) { e.preventDefault(); a.focus(); }
    }
  }
  function share() {
    var url = location.origin + "/?s=reel", text = "Jason Obawemimo: AI engineer and business operator. Worth two minutes.";
    if (navigator.share) navigator.share({ title: "Jason Obawemimo", text: text, url: url }).then(function () { T("share_opened", { where: "reel" }); }).catch(function () {});
    else if (window.JG_COPY) window.JG_COPY(url).then(function () { if (window.JG_TOAST) window.JG_TOAST("Link copied"); fx("send"); T("forward_copied", { where: "reel" }); });
  }

  /* ---------- leaving: the portrait lands on the Slate ---------- */
  function leave(to, how) {
    if (!open) return;
    open = false; cancelAnimationFrame(raf); stopVideo();
    removeEventListener("keydown", keys, true);
    var spec = CUTS[role].shots[i];
    if (spec.k !== "end") T("reel_exited", { role: role, at: i, how: how });
    var face = document.querySelector(".slate__face img"), slate = document.querySelector(".slate [data-rise]");
    var land = to === "site" || to === "desk" || to === "trailer";
    if (land) {
      if (window.JG_LOCK) window.JG_LOCK(false);
      scrollTo(0, 0);
      if (slate) { slate.classList.remove("is-in"); void slate.offsetWidth; }
      var src = el.querySelector(".rs.is-on .rs__face img") || el.querySelector(".reel__who img");
      if (face && src && !RM) fly(src, face);
      if (!RM) { root.style.setProperty("--bars", "1"); setTimeout(function () { root.style.setProperty("--bars", "0"); }, 560); }
      el.classList.add("is-leaving");
      setTimeout(function () { if (slate) slate.classList.add("is-in"); fx("arrive"); }, RM ? 0 : 380);
      setTimeout(function () {
        el.remove();
        if (viaIntro && window.JG_TOAST) window.JG_TOAST(name ? "Welcome, " + name : "Welcome in");
        viaIntro = false;
        if (to === "desk" && window.JG_CUT) window.JG_CUT(function () { window.JG_JUMP("#desk-title"); });
        if (to === "trailer" && window.JG_OPEN) window.JG_OPEN("trailer", "reel");
      }, RM ? 60 : 1050);
    } else { el.remove(); if (window.JG_LOCK) window.JG_LOCK(false); }
  }
  function fly(src, face) {
    var a = src.getBoundingClientRect(), b = face.getBoundingClientRect();
    if (!a.width || !b.width) return;
    var c = document.createElement("img"); c.src = face.currentSrc || face.src; c.alt = ""; c.className = "reel__fly";
    c.style.cssText = "left:" + a.left + "px;top:" + a.top + "px;width:" + a.width + "px;height:" + a.height + "px;border-radius:50%";
    body.appendChild(c);
    var r = getComputedStyle(face.parentNode).borderRadius;
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      c.style.transform = "translate(" + (b.left - a.left) + "px," + (b.top - a.top) + "px) scale(" + (b.width / a.width) + "," + (b.height / a.height) + ")";
      c.style.borderRadius = r === "50%" ? "50%" : (parseFloat(r) || 4) * (a.width / b.width) + "px";
      c.classList.add("is-flying");
    }); });
    setTimeout(function () { c.classList.add("is-landed"); }, 900);
    setTimeout(function () { c.remove(); }, 1500);
  }

  window.JG_REEL = { play: play, open: function () { return open; } };

  /* the cut chips under the Slate play the matching reel */
  var CHIP = { screening: "interviewer", agency: "partner", trailer: "lurker" };
  document.addEventListener("click", function (e) {
    var c = e.target.closest && e.target.closest("[data-cut]"); if (!c || !CHIP[c.getAttribute("data-cut")]) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var k = c.getAttribute("data-cut");
    try { localStorage.setItem("jg_cut", k); } catch (err) {}
    document.querySelectorAll("[data-cut]").forEach(function (x) { x.classList.toggle("is-on", x === c); });
    fx("choice"); T("role_chosen", { role: CHIP[k], where: "chip" }, { role: CHIP[k] });
    var n = ""; try { n = localStorage.getItem("jg_name") || ""; } catch (err) {}
    play(CHIP[k], { name: n, from: "chip" });
  }, true);
})();
