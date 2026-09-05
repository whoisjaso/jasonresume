// Verifies partners.html and join.html on desktop and mobile against the local server.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const TOOLS = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO = path.dirname(TOOLS);
const OUT = path.join(TOOLS, 'verify', 'out') + '/';
const base = "http://127.0.0.1:8765";
const out = OUT;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const fontRoute = async (ctx) => {
  await ctx.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|assets\.calendly\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
};
for (const [name, vp, mobile] of [["desktop", { width: 1440, height: 900 }, false], ["mobile", { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  await fontRoute(ctx);
  for (const page of ["partners", "join"]) {
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    p.on("console", (m) => { if (m.type() === "error" && !/favicon|vsl\.mp4|vsl-poster|vsl\.vtt|api\/track/.test(m.text())) errors.push("console: " + m.text()); });
    p.on("requestfailed", (r) => { if (!/calendly|gstatic|googleapis|api\/track/.test(r.url())) errors.push("failed: " + r.url()); });
    await p.goto(`${base}/${page}.html`, { waitUntil: "networkidle" });
    await p.waitForTimeout(600);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    const h1 = await p.locator("h1").first().textContent();
    const emdash = await p.evaluate(() => (document.body.innerText.match(/[—–]/g) || []).length);
    await p.screenshot({ path: `${out}${page}-${name}.png`, fullPage: true });
    // form validation and desk fallback (no server): submit should show the error path, not crash
    if (page === "join") {
      await p.fill("#a-name", "Test Person"); await p.fill("#a-email", "test@example.com");
      await p.fill("#a-story", "I sold a used truck to a contractor who pushed back on the price twice and bought anyway. He came back for a second one.");
      await p.click('form[data-desk] button[type="submit"]');
      await p.waitForTimeout(1200);
      const status = await p.locator(".form__status").textContent();
      console.log(`${page}/${name} submit status: "${status.trim()}"`);
    }
    console.log(`${page}/${name}: h1="${h1.trim()}" overflow=${overflow} emdashes=${emdash} errors=${errors.length}`);
    errors.forEach((e) => console.log("   ", e));
    await p.close();
  }
  await ctx.close();
}
await browser.close();
