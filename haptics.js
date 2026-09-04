/* Touch feedback for the site. One function, window.JG_HAPTIC(kind).
   Android and desktop browsers with the Vibration API get a pattern.
   iOS Safari has no Vibration API; since iOS 17.4 a switch-style checkbox
   toggled inside a user gesture fires the system haptic, so a hidden one is
   clicked instead. Everything else is a no-op. Skips and cancels never call
   this: silence is the other half of the signal. */
(function () {
  "use strict";
  var ua = navigator.userAgent || "";
  var isIOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var canVibrate = !isIOS && typeof navigator.vibrate === "function";
  var PAT = {
    tap: [9],                 /* a choice made */
    select: [14],             /* continue, submit */
    arrive: [7, 34, 7],       /* the teacher camera lands on a spot */
    success: [12, 46, 22],    /* end of the tour, form accepted */
    unlock: [26],             /* booking or application sent */
    heart: [15, 120, 15]      /* welcome back */
  };
  var input = null, last = 0;
  function iosSwitch() {
    if (input) return input;
    try {
      var wrap = document.createElement("div");
      wrap.setAttribute("aria-hidden", "true");
      wrap.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;";
      input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("switch", "");
      input.tabIndex = -1;
      wrap.appendChild(input);
      (document.body || document.documentElement).appendChild(wrap);
    } catch (e) { input = null; }
    return input;
  }
  function fire(kind) {
    var now = Date.now();
    if (now - last < 45) return;
    last = now;
    var p = PAT[kind] || PAT.tap;
    if (isIOS) {
      var el = iosSwitch();
      if (!el) return;
      var clicks = Math.ceil(p.length / 2), i = 0;
      (function tick() {
        try { el.click(); } catch (e) {}
        i++;
        if (i < clicks) setTimeout(tick, p[2 * i - 1] || 60);
      })();
      return;
    }
    if (canVibrate) { try { navigator.vibrate(p); } catch (e) {} }
  }
  window.JG_HAPTIC = fire;
})();
