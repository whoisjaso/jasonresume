// Prints the ten resumes to PDF and plain text, then gates every file and fails loudly.
//
//   python3 tools/site/build_resume.py     # writes resume-pdf.html and resume/<build>.html
//   python3 -m http.server 8765            # at the repo root
//   node tools/verify/resume.mjs
//
// Writes assets/Jason_Obawemimo_Resume_2026.pdf and .txt (the canonical resume) and
// assets/resume/Jason_Obawemimo_Resume_<Label>.pdf and .txt for each build in tools/site/builds.json.
// Each page names its own file in <body data-file>. Gates, per PDF: pdfinfo says one page and Tagged yes;
// pdffonts lists no Type 3 font; pdftotext -raw keeps the headings in order and every bullet between the
// job's header and the next heading; the email extracts intact with no letters spaced apart; no em dash,
// no en dash, no percent sign, nothing shaped like a phone number, and every number is in llms.txt.
// Needs poppler-utils (pdfinfo, pdffonts, pdftotext).
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const TOOLS = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO = path.dirname(TOOLS);
const OUT = path.join(TOOLS, "verify", "out");
const HOST = process.env.RESUME_HOST || "http://127.0.0.1:8765";
const HEADINGS = ["Summary", "Experience", "Education", "Certificates and Courses", "Skills"];
const EMAIL = "jobawems@gmail.com";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(REPO, "assets", "resume"), { recursive: true });

const builds = JSON.parse(fs.readFileSync(path.join(TOOLS, "site", "builds.json"), "utf8")).builds;
const llms = fs.readFileSync(path.join(REPO, "llms.txt"), "utf8");
const numbers = (s) => (s.match(/\d[\d,]*(?:\.\d+)?/g) || []).map((n) => n.replace(/[.,]+$/, ""));
const LLMS_NUMBERS = new Set(numbers(llms));
const PHONE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/;

const pages = [{ id: "canonical", url: "/resume-pdf.html", dir: "assets" }].concat(
  builds.map((b) => ({ id: b.id, url: "/resume/" + b.id + ".html", dir: "assets/resume" }))
);

for (const tool of ["pdfinfo", "pdffonts", "pdftotext"]) {
  try {
    execFileSync(tool, ["-v"], { stdio: "ignore" });
  } catch (e) {
    if (e.code === "ENOENT") {
      console.error("Missing " + tool + ". Install poppler-utils (apt-get install poppler-utils, or brew install poppler).");
      process.exit(2);
    }
  }
}

const exe = [process.env.PW_CHROMIUM, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((f) => f && fs.existsSync(f));
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 816, height: 1056 } });
const p = await ctx.newPage();
const pageErrors = [];
p.on("pageerror", (e) => pageErrors.push(e.message));

// The page as plain text for application text boxes: headings, the job, bullets as "- ", sub-bullets indented.
function toText() {
  const out = [];
  const clean = (s) => s.replace(/\s+/g, " ").trim();
  const own = (el) => clean(Array.from(el.childNodes).filter((n) => !(n.nodeType === 1 && n.tagName === "UL")).map((n) => n.textContent).join(""));
  const page = document.querySelector(".page");
  const walk = (el, depth) => {
    for (const c of el.children) {
      if (getComputedStyle(c).display === "none") continue;
      const tag = c.tagName;
      if (tag === "H1" || tag === "H2") {
        if (out.length) out.push("");
        out.push(clean(c.textContent));
      } else if (tag === "P" && c.classList.contains("row")) {
        out.push(Array.from(c.children).map((x) => clean(x.textContent)).filter(Boolean).join(", "));
      } else if (tag === "P") {
        out.push(clean(c.textContent));
      } else if (tag === "UL") {
        walk(c, depth + 1);
      } else if (tag === "LI") {
        const pad = "  ".repeat(Math.max(0, depth - 1));
        out.push(pad + (c.classList.contains("sys") ? "" : "- ") + own(c));
        const sub = c.querySelector(":scope > ul");
        if (sub) walk(sub, depth + 1);
      } else {
        walk(c, depth);
      }
    }
  };
  walk(page, 0);
  return out.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" });
const flat = (s) => s.replace(/\s+/g, " ").replace(/(\w)- (\w)/g, "$1-$2").trim();
let failures = 0;

for (const pg of pages) {
  const problems = [];
  await p.goto(HOST + pg.url, { waitUntil: "networkidle" });
  await p.emulateMedia({ media: "print" });
  const info = await p.evaluate(async () => {
    const want = ['400 10pt "Hanken Grotesk"', '600 10pt "Hanken Grotesk"', '600 29pt "Cormorant Garamond"'];
    await Promise.all(want.map((f) => document.fonts.load(f)));
    await document.fonts.ready;
    const loaded = Array.from(document.fonts).filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, "") + " " + f.weight);
    const page = document.querySelector(".page");
    const bullets = Array.from(page.querySelectorAll(".duties li[data-proof]")).map((li) => li.textContent.replace(/\s+/g, " ").trim());
    const systems = Array.from(page.querySelectorAll(".duties .sys > strong")).map((s) => s.textContent.trim());
    return {
      file: document.body.getAttribute("data-file"),
      loaded,
      heights: { content: page.scrollHeight, letter: 1056 },
      headings: Array.from(page.querySelectorAll("h2")).map((h) => h.textContent.trim()),
      role: page.querySelector(".job .role").textContent.trim(),
      bullets,
      systems,
    };
  });
  if (!info.file) problems.push("page has no data-file");
  for (const f of ["Hanken Grotesk 400", "Hanken Grotesk 600", "Cormorant Garamond 600"]) if (!info.loaded.includes(f)) problems.push("font not loaded: " + f);
  if (JSON.stringify(info.headings) !== JSON.stringify(HEADINGS)) problems.push("headings in the page: " + info.headings.join(", "));

  const pdf = path.join(REPO, pg.dir, info.file + ".pdf");
  const txt = path.join(REPO, pg.dir, info.file + ".txt");
  await p.pdf({ path: pdf, format: "Letter", printBackground: false, preferCSSPageSize: true, tagged: true, outline: false, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  const text = await p.evaluate(toText);
  fs.writeFileSync(txt, text);
  await p.emulateMedia({ media: "screen" });
  await p.screenshot({ path: path.join(OUT, "resume-" + pg.id + ".png"), fullPage: true });

  // pdfinfo
  const pinfo = sh("pdfinfo", [pdf]);
  const pagesN = (/^Pages:\s+(\d+)/m.exec(pinfo) || [])[1];
  const tagged = (/^Tagged:\s+(\w+)/m.exec(pinfo) || [])[1];
  if (pagesN !== "1") problems.push("pages " + pagesN);
  if (tagged !== "yes") problems.push("tagged " + tagged);

  // pdffonts
  const fontLines = sh("pdffonts", [pdf]).split("\n").slice(2).filter(Boolean);
  const fonts = fontLines.map((l) => {
    const name = l.split(/\s+/)[0].replace(/^[A-Z]{6}\+/, "");
    const type = /Type 3/.test(l) ? "Type 3" : /CID TrueType/.test(l) ? "CID TrueType" : /TrueType/.test(l) ? "TrueType" : /Type 1/.test(l) ? "Type 1" : "other";
    return name + " (" + type + ")";
  });
  if (fontLines.some((l) => /Type 3/.test(l))) problems.push("Type 3 font: " + fonts.join(", "));

  // pdftotext -raw: reading order
  const raw = sh("pdftotext", ["-raw", "-enc", "UTF-8", pdf, "-"]);
  const lines = raw.split("\n").map((l) => l.trim());
  const at = HEADINGS.map((h) => lines.indexOf(h));
  if (at.some((i) => i < 0)) problems.push("heading missing from raw text: " + HEADINGS.filter((h, i) => at[i] < 0).join(", "));
  else if (at.some((v, i) => i && v <= at[i - 1])) problems.push("headings out of order in raw text");
  const body = flat(raw);
  const pos = (s) => body.indexOf(flat(s));
  const roleAt = pos(info.role);
  const eduAt = body.indexOf(" Education ");
  const expAt = body.indexOf(" Experience ");
  if (!(expAt < roleAt && roleAt < eduAt)) problems.push("job header not between Experience and Education");
  let order = roleAt;
  for (const b of info.bullets) {
    const i = pos(b);
    if (i < 0) problems.push("bullet not found intact in raw text: " + b.slice(0, 60));
    else if (i < roleAt || i > eduAt) problems.push("bullet outside its job: " + b.slice(0, 60));
    order = Math.max(order, i);
  }
  for (const s of info.systems) {
    const i = pos(s);
    if (i < roleAt || i > eduAt) problems.push("system heading outside its job: " + s);
  }
  if (!raw.includes(EMAIL)) problems.push("email not intact in raw text");

  // default extraction: no letters spaced apart, email intact
  const plain = sh("pdftotext", ["-enc", "UTF-8", pdf, "-"]);
  if (!plain.includes(EMAIL)) problems.push("email not intact in default text");
  const spaced = /(?:\b[A-Za-z] ){3,}[A-Za-z]\b/.exec(plain);
  if (spaced) problems.push("letters spaced apart: " + spaced[0]);

  // words and numbers, in the PDF text and the plain-text copy
  for (const [label, s] of [["pdf", raw], ["txt", text]]) {
    if (s.includes("\u2014")) problems.push(label + " has an em dash");
    if (s.includes("\u2013")) problems.push(label + " has an en dash");
    if (s.includes("%")) problems.push(label + " has a percent sign");
    if (PHONE.test(s)) problems.push(label + " has a phone-number pattern");
    for (const n of numbers(s)) if (!LLMS_NUMBERS.has(n)) problems.push(label + " number not in llms.txt: " + n);
  }

  const rel = path.relative(REPO, pdf);
  const fill = Math.round((info.heights.content / info.heights.letter) * 100) / 100;
  const ok = !problems.length;
  if (!ok) failures++;
  console.log((ok ? "ok   " : "FAIL ") + rel);
  console.log("     pages " + pagesN + ", tagged " + tagged + ", fonts " + fonts.join(", "));
  console.log("     reading order: " + HEADINGS.length + " headings in order, job header then " + info.bullets.length + " bullets and " + info.systems.length + " system headings before Education; email intact; sheet height " + fill + " of a Letter page");
  for (const m of problems) console.log("     " + m);
}

if (pageErrors.length) {
  failures++;
  console.log("FAIL page errors: " + pageErrors.join(" | "));
}
await browser.close();
if (failures) {
  console.error("\n" + failures + " resume file(s) failed the gate.");
  process.exit(1);
}
console.log("\nall " + pages.length + " resumes passed");
