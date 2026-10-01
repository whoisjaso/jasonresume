import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const TOOLS = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO = path.dirname(TOOLS);
const OUT = path.join(TOOLS, 'verify', 'out') + '/';
import fs from 'fs';
const exe = [process.env.PW_CHROMIUM, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => f && fs.existsSync(f));
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.route(/googleapis|gstatic|calendly/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
const p = await ctx.newPage();
for (const page of ["index", "obavia", "resume-pdf", "answers", "credentials"]) {
  await p.goto("http://127.0.0.1:8765/" + page + ".html", { waitUntil: "networkidle" });
  const bad = await p.evaluate(() => { const w = document.documentElement.clientWidth; const out = []; document.querySelectorAll("body *").forEach((el) => { for (let a = el.parentElement; a; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o !== 'visible') return; } const r = el.getBoundingClientRect(); if (r.right > w + 1 && r.width > 0) out.push(el.tagName + "." + (el.className && el.className.baseVal === undefined ? el.className : "") + " right=" + Math.round(r.right) + " w=" + Math.round(r.width)); }); return out.slice(0, 12); });
  const scrolls = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  console.log(page, scrolls ? "SCROLLS SIDEWAYS" : "no page overflow", scrolls ? bad : "");
}
await browser.close();
