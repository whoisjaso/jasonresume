/* The one tracker. First party only: events go in small batches to /api/track
   on this domain, which forwards them to PostHog with the key kept on the
   server. No third-party script ever loads in the browser.

   If the browser sends Global Privacy Control or Do Not Track, nothing is sent,
   not even a count. The cue sheet still shows what would have been recorded,
   so the visitor can see the promise kept.

   window.JG_TRACK(event, props, set)  queue an event
   window.JG_ID, window.JG_SID         the visitor and session ids
   window.JG_CUES                      the events this visit has queued, for the cue sheet */
(function () {
  "use strict";
  var OFF = navigator.globalPrivacyControl === true || navigator.doNotTrack === "1" || window.doNotTrack === "1";
  var store = {
    get: function (k, s) { try { return (s ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; } },
    set: function (k, v, s) { try { (s ? sessionStorage : localStorage).setItem(k, v); } catch (e) {} }
  };
  function rid(n) { var a = "abcdefghijklmnopqrstuvwxyz0123456789", s = ""; for (var i = 0; i < n; i++) s += a[(Math.random() * 36) | 0]; return s; }

  var id = store.get("jg_id"); if (!id) { id = "v" + Date.now().toString(36) + rid(8); store.set("jg_id", id); }
  var sid = store.get("jg_sid", true); if (!sid) { sid = "s" + Date.now().toString(36) + rid(6); store.set("jg_sid", sid, true); }
  var visits = parseInt(store.get("jg_visits") || "0", 10);
  var last = parseInt(store.get("jg_last") || "0", 10), now0 = Date.now();
  if (!store.get("jg_counted", true)) { visits += 1; store.set("jg_visits", String(visits)); store.set("jg_counted", "1", true); }
  store.set("jg_last", String(now0));
  window.JG_ID = id; window.JG_SID = sid;

  /* Attribution: read UTM and an opaque outreach code once, then clean the URL */
  var qs = new URLSearchParams(location.search), touch = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "r", "s", "cut"].forEach(function (k) { var v = qs.get(k); if (v) touch[k] = v.slice(0, 80); });
  var ref = document.referrer, refd = (ref.match(/^https?:\/\/([^/]+)/) || [])[1] || "";
  if (refd === location.host) refd = "";
  var ft = store.get("jg_ft");
  if (!ft) { ft = JSON.stringify({ src: touch.utm_source || (refd ? refd : "direct"), med: touch.utm_medium || "", camp: touch.utm_campaign || "", r: touch.r || "", land: location.pathname, at: now0 }); store.set("jg_ft", ft); }
  if (Object.keys(touch).some(function (k) { return k !== "cut"; })) {
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "r", "s"].forEach(function (k) { qs.delete(k); });
    var clean = location.pathname + (qs.toString() ? "?" + qs.toString() : "") + location.hash;
    try { history.replaceState(history.state, "", clean); } catch (e) {}
  }

  function common() {
    var w = innerWidth;
    return { url: location.origin + location.pathname, path: location.pathname, ref: ref.slice(0, 300), refd: refd, w: w, h: innerHeight, device: w < 700 ? "Mobile" : w < 1100 ? "Tablet" : "Desktop", lang: (navigator.language || "").slice(0, 16) };
  }

  var queue = [], timer = null, cues = [], t0 = performance.now();
  window.JG_CUES = cues;
  function flush(beacon) {
    timer = null;
    if (OFF || !queue.length) { queue.length = 0; return; }
    var payload = JSON.stringify({ id: id, sid: sid, common: common(), events: queue.splice(0, 25) });
    try {
      if (beacon && navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
      else fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(function () {});
    } catch (e) {}
    if (queue.length) timer = setTimeout(flush, 400);
  }
  function track(event, props, set) {
    var e = { event: event, props: props || {}, ts: Date.now() };
    if (set) e.set = set;
    cues.push({ t: Math.round((performance.now() - t0) / 1000), event: event, props: e.props });
    if (cues.length > 200) cues.shift();
    try { document.dispatchEvent(new CustomEvent("jg:track", { detail: e })); } catch (err) {}
    if (OFF) return;
    queue.push(e);
    if (!timer) timer = setTimeout(flush, 900);
  }
  window.JG_TRACK = track;
  window.JG_TRACK_OFF = OFF;

  var page = document.body.getAttribute("data-page") || (location.pathname === "/" ? "home" : location.pathname.replace(/^\/|\.html$/g, ""));
  track("page_view", { page: page, title: document.title.slice(0, 80) });
  var ftObj = {}; try { ftObj = JSON.parse(ft); } catch (e) {}
  track("site_arrived", { page: page, returning: visits > 1, visits: visits, days_since: last ? Math.round((now0 - last) / 864e5) : 0, source: ftObj.src || "", medium: ftObj.med || "", campaign: ftObj.camp || "", ref_code: touch.r || ftObj.r || "", share_code: touch.s || "", cut: touch.cut || "" });

  /* Section reach and attention. A second counts only when the tab is visible
     and focused and the visitor moved in the last five seconds, or a film plays. */
  var sections = [].slice.call(document.querySelectorAll("[data-track]"));
  var seen = {}, dwell = {}, active = performance.now(), maxDepth = 0, attention = 0;
  ["pointermove", "pointerdown", "scroll", "keydown", "touchstart", "wheel"].forEach(function (ev) { addEventListener(ev, function () { active = performance.now(); }, { passive: true }); });
  function inView(el) { var r = el.getBoundingClientRect(), vh = innerHeight; var vis = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)); return vis / Math.min(vh, Math.max(1, r.height)); }
  function playing() { var v = document.querySelectorAll("video"); for (var i = 0; i < v.length; i++) if (!v[i].paused && !v[i].ended) return true; return false; }
  setInterval(function () {
    var doc = document.documentElement, depth = Math.round(((scrollY + innerHeight) / Math.max(1, doc.scrollHeight)) * 100);
    if (depth > maxDepth) maxDepth = Math.min(100, depth);
    for (var i = 0; i < sections.length; i++) {
      var el = sections[i], name = el.getAttribute("data-track"), f = inView(el);
      if (f >= 0.4 && !seen[name]) { seen[name] = 1; track("section_viewed", { section: name, at_s: Math.round((performance.now() - t0) / 1000) }); }
    }
    var attending = document.visibilityState === "visible" && (document.hasFocus ? document.hasFocus() : true) && (performance.now() - active < 5000 || playing());
    if (!attending) return;
    attention++;
    var best = null, bf = 0;
    for (var j = 0; j < sections.length; j++) { var fr = inView(sections[j]); if (fr > bf) { bf = fr; best = sections[j].getAttribute("data-track"); } }
    if (best && bf >= 0.3) dwell[best] = (dwell[best] || 0) + 1;
  }, 1000);
  var left = false;
  function leave() {
    if (left) return; left = true;
    var d = Object.keys(dwell).map(function (k) { return k + ":" + dwell[k]; }).join(",");
    track("page_left", { page: page, depth_pct: maxDepth, attention_s: attention, dwell: d.slice(0, 200) });
    flush(true);
  }
  addEventListener("pagehide", leave);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") { flush(true); } });

  /* Every call to action, by delegation, so markup only needs a data attribute */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a,button");
    if (!a) return;
    var tr = a.closest("[data-track]"), where = a.getAttribute("data-where") || (tr ? tr.getAttribute("data-track") : "");
    if (a.hasAttribute("data-contact")) return track("contact_click", { kind: a.getAttribute("data-contact"), where: where });
    if (a.hasAttribute("data-resume")) return track("resume_open", { format: a.getAttribute("data-resume"), where: where });
    if (a.hasAttribute("data-verify")) return track("verify_link", { kind: a.getAttribute("data-verify"), where: where });
    if (a.hasAttribute("data-book")) return track("book_click", { where: a.getAttribute("data-book") || where });
    if (a.hasAttribute("data-proof")) return track("proof_open", { label: a.getAttribute("data-proof"), where: where });
    if (a.hasAttribute("data-cta")) return track("cta_click", { label: a.getAttribute("data-cta"), where: where });
    if (a.tagName === "A" && a.host && a.host !== location.host && /^https?:/.test(a.href)) track("outbound_click", { host: a.host.slice(0, 60), where: where });
  });
})();
