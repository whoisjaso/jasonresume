import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const TOOLS = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO = path.dirname(TOOLS);
const OUT = path.join(TOOLS, 'verify', 'out') + '/';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
const p = await ctx.newPage(); const errs = [], sfx = new Set();
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error" && !/favicon|api\/track/.test(m.text())) errs.push(m.text()); });
p.on("response", (r) => { if (/assets\/sfx\//.test(r.url())) sfx.add(r.url().split("/").pop().split("?")[0] + ":" + r.status()); });
await p.goto("http://127.0.0.1:8765/", { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
// tap the loader (water plink path), then skip through to the gate and the name step
await p.mouse.click(640, 400); await p.waitForTimeout(300);
const played = await p.evaluate(() => ({ hasSFX: !!window.JG_SFX, drop: window.JG_SFX.play("drop"), key: window.JG_SFX.play("key"), muted: window.JG_SFX.muted() }));
const skip = p.locator(".jg-loader [data-skip], .jg-loader button").first(); if (await skip.count()) await skip.click();
await p.waitForTimeout(1200);
const roleBtn = p.locator(".jg-gate button.jg-opt").first(); if (await roleBtn.count()) await roleBtn.click();
await p.waitForTimeout(900);
const input = p.locator(".jg-namestep input"); let typed = false;
if (await input.count()) { await input.click(); await p.keyboard.type("Ada", { delay: 90 }); await p.keyboard.press("Backspace"); typed = true; }
await p.waitForTimeout(600);
console.log("sfx loaded:", [...sfx].sort().join(" "));
console.log("played:", JSON.stringify(played), "typed:", typed, "errors:", errs.length); errs.forEach((e) => console.log("  ", e));
await browser.close();
