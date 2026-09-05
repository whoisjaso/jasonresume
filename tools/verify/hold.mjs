import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const TOOLS = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO = path.dirname(TOOLS);
const OUT = path.join(TOOLS, 'verify', 'out') + '/';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ["--autoplay-policy=user-gesture-required"] });
for (const mobile of [false, true]) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile });
  await ctx.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await ctx.addInitScript(() => {
    // emulate a real browser: the context reports suspended until the first gesture
    window.__act = false;
    const P = (window.AudioContext || window.webkitAudioContext).prototype;
    Object.defineProperty(P, "state", { get() { return window.__act ? "running" : "suspended"; } });
    Object.defineProperty(navigator, "userActivation", { get() { return { hasBeenActive: window.__act, isActive: window.__act }; } });
    ["pointerdown", "keydown", "touchstart"].forEach((ev) => addEventListener(ev, () => { window.__act = true; }, { capture: true, passive: true }));
  });
  const p = await ctx.newPage(); const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "load" });
  // wait until the loader finishes its count without any gesture
  await p.waitForFunction(() => document.querySelector("#jg-loader .jg-loader__pct span")?.textContent === "100", null, { timeout: 15000 });
  await p.waitForTimeout(400);
  const hold = await p.evaluate(() => ({ hold: document.getElementById("jg-loader").classList.contains("is-hold"), hint: getComputedStyle(document.querySelector(".jg-loader__hint")).opacity, gate: !!document.querySelector("#jg-gate.is-in, #jg-gate.is-open"), state: window.JG_SFX && window.JG_SFX.ctx().state }));
  // first gesture anywhere
  if (mobile) await p.touchscreen.tap(200, 700); else await p.mouse.click(700, 800);
  await p.waitForTimeout(2500);
  const after = await p.evaluate(() => ({ hold: document.getElementById("jg-loader") && document.getElementById("jg-loader").classList.contains("is-hold"), loaderDone: !document.getElementById("jg-loader") || document.getElementById("jg-loader").classList.contains("is-done"), film: !!document.querySelector(".jg-film.is-in"), state: window.JG_SFX && window.JG_SFX.ctx().state }));
  await p.waitForTimeout(7000);
  const gate = await p.evaluate(() => ({ gateVisible: !!document.querySelector("#jg-gate") && getComputedStyle(document.querySelector("#jg-gate")).opacity !== "0", loaderGone: !document.getElementById("jg-loader") }));
  console.log(mobile ? "mobile" : "desktop", "at100:", JSON.stringify(hold), "afterTap:", JSON.stringify(after), "later:", JSON.stringify(gate), "errors:", errors.length, errors.slice(0, 2));
  await ctx.close();
}
await browser.close();
