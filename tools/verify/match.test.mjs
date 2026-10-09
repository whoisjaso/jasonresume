// The listing match, on six realistic listings. node tools/verify/match.test.mjs
// Asserts the build it picks, terms it must find on and off the record, the negative rules,
// the degree and experience facts, and that it never returns a percentage or a score.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
// match.js is a browser script; run it the way a page does and take window.JG_MATCH.
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL("../../match.js", import.meta.url), "utf8"), sandbox, { filename: "match.js" });
const JG = sandbox.window.JG_MATCH;
// Results cross back from the sandbox as plain data.
const plainData = (x) => JSON.parse(JSON.stringify(x));
const M = { read: (t) => plainData(JG.read(t)), term: (n) => plainData(JG.term(n)), spells: JG.spells, hash: JG.hash };

const LISTINGS = {
  it: `IT Support Specialist (Houston, on site)
We're a growing auto group looking for an IT Support Specialist to provide technical support and help desk services to our employees.
Responsibilities:
- Troubleshoot hardware and software issues on Windows 10 and macOS
- Set up computers, printers and phones for new hires
- Manage user accounts and permissions in Active Directory and Microsoft 365, and handle password resets
- Support our network setup, including Wi-Fi and VPN access
- Log and resolve tickets in our ticketing system (ServiceNow)
Requirements: 2+ years of experience in IT support. CompTIA A+ preferred. Associate degree or equivalent experience. Excellent customer service.`,

  title: `Title Clerk, Houston, TX
A busy pre-owned dealership needs a detail-oriented Title Clerk.
- Process vehicle titles and registrations through webDEALER and the county tax office
- Prepare Form 130-U title applications and collect the sales tax due on each deal
- Maintain deal jackets and file documents; handle lien payoffs and lien releases
- Issue temporary tags; ensure compliance with TxDMV rules
- Work in our DMS (Dealertrack) and Microsoft Excel
Bilingual (English/Spanish) a plus. High school diploma or GED required; 1 year of dealership title experience preferred.`,

  ai: `AI Automation Specialist
You'll design and build workflow automation for our sales and operations teams using n8n, Zapier and Make, integrate LLMs (OpenAI and Claude) through REST APIs and webhooks, and deploy voice AI agents with Twilio and Retell AI.
Strong Python and JavaScript skills required. Experience with prompt engineering, RAG and vector databases is a plus. Familiarity with CRM integration (HubSpot or Salesforce).
Bachelor's degree in Computer Science or 3+ years of relevant experience. Our mobile team ships in React Native and Java; data lives in SQL Server.`,

  salesforce: `Salesforce Administrator
Own our Salesforce Sales Cloud instance: user management, profiles and permission sets, validation rules, Flows, and reports and dashboards.
Keep data quality high, run data migrations with Data Loader, and train users on new features.
Salesforce Administrator certification required. Experience with Apex or SOQL is a plus. Excel skills (VLOOKUP, pivot tables).
You excel in a fast-paced environment. 2+ years of CRM administration experience.`,

  bdc: `Bilingual BDC Representative (English/Spanish), Houston
Our pre-owned dealership's Business Development Center needs a bilingual BDC Representative to answer inbound calls, set appointments and follow up with internet leads by phone and text.
- Bilingual in English and Spanish required
- Work every lead in our CRM (VinSolutions) and keep notes accurate
- Confirm appointments and hand customers off to the sales floor
- Cold calling experience a plus
Requirements: 1+ year of automotive sales or call center experience. High school diploma or GED. Strong customer service skills.`,

  m365: `IT Coordinator (on site, Houston)
Support our office on Microsoft 365 and Google Workspace: create and remove user accounts, manage licenses and shared mailboxes, and keep permissions tidy.
- Help desk support for staff computers, printers and phones; set up workstations for new hires
- Maintain the office network and Wi-Fi
- Write SOPs for common requests
- Track assets in Excel or Google Sheets; version control in GitHub a plus
- Intune and Azure AD experience preferred; Windows 11 and macOS; Microsoft Teams administration
Requirements: 2+ years of IT support experience. Bilingual (English/Vietnamese) a plus. CompTIA A+ preferred.`,
};

const terms = (list) => list.map((x) => x.term);
const show = (r) => JSON.stringify({ build: r.build, builds: r.builds, on: r.on.map((o) => o.term + (o.as !== o.term ? " (" + o.as + ")" : "")), off: r.off.map((o) => o.term + (o.as !== o.term ? " (" + o.as + ")" : "")), facts: r.facts.map((f) => f.topic + ": " + f.as) }, null, 1);

function common(r, name) {
  const text = JSON.stringify(r);
  assert.ok(!/%/.test(text), name + ": no percent sign anywhere in the result");
  assert.deepEqual(Object.keys(r).sort(), ["build", "builds", "facts", "off", "on"], name + ": only the documented keys");
  assert.ok(!/score|percent|fit/i.test(Object.keys(r).join(" ")), name + ": no score");
  for (const o of r.on) {
    assert.ok(o.proofs.length > 0, name + ": every on term names a proof (" + o.term + ")");
    assert.ok(!r.off.some((x) => x.term === o.term), name + ": a term is never both on and off");
  }
  const ids = r.builds.map((b) => b.id);
  assert.deepEqual(ids, ["ai", "software", "it", "ops", "title", "sales", "people", "dealer-tech", "data"], name + ": every build, in builds.json order");
  const max = Math.max(...r.builds.map((b) => b.hits));
  assert.equal(r.build, r.builds.find((b) => b.hits === max).id, name + ": most hits, ties to the earlier build");
  for (const f of r.facts) assert.ok(!/\bmeets?\b/i.test(f.answer), name + ": a fact is an answer, never a verdict");
}

let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log("ok  " + name);
  } catch (e) {
    failed++;
    console.log("FAIL " + name + "\n  " + e.message);
  }
}

const it = M.read(LISTINGS.it);
test("IT support posting", () => {
  common(it, "it");
  assert.equal(it.build, "it");
  for (const t of ["technical support", "hardware", "user accounts", "role-based access control", "network setup", "phones", "customer service", "Microsoft 365"]) assert.ok(terms(it.on).includes(t), "on: " + t);
  for (const t of ["Windows", "macOS", "Active Directory", "password resets", "ticketing systems", "CompTIA A+", "network protocols"]) assert.ok(terms(it.off).includes(t), "off: " + t);
  assert.ok(it.facts.some((f) => f.topic === "experience" && /2\+ years of experience/.test(f.as)), "experience fact");
  assert.ok(it.facts.some((f) => f.topic === "degree"), "degree fact");
  assert.equal(it.on.find((o) => o.term === "technical support").as, "IT Support", "as keeps the listing's first spelling");
});

const title = M.read(LISTINGS.title);
test("Title clerk posting", () => {
  common(title, "title");
  assert.equal(title.build, "title");
  for (const t of ["title and registration", "webDEALER", "TxDMV", "Form 130-U", "deal jackets", "documentation", "compliance", "dealership operations", "lien payoffs", "temporary tags", "Excel", "Spanish"]) assert.ok(terms(title.on).includes(t), "on: " + t);
  for (const t of ["DMS", "Dealertrack"]) assert.ok(terms(title.off).includes(t), "off: " + t);
  assert.ok(!terms(title.on).includes("sales"), "sales tax is not a sale");
  assert.equal(title.on.find((o) => o.term === "Spanish").as, "Bilingual", "first spelling in the listing");
  assert.equal(title.on.find((o) => o.term === "lien payoffs").as, "lien payoffs");
  assert.deepEqual(title.on.find((o) => o.term === "temporary tags").proofs, ["liens-tags"]);
  assert.ok(title.facts.some((f) => f.topic === "degree" && /High school diploma/i.test(f.as)), "degree fact");
  assert.ok(title.facts.some((f) => f.topic === "experience" && /1 year of dealership title experience/.test(f.as)), "experience fact");
});

const ai = M.read(LISTINGS.ai);
test("AI automation posting", () => {
  common(ai, "ai");
  assert.equal(ai.build, "ai");
  for (const t of ["workflow automation", "n8n", "LLM integration", "Claude API", "REST APIs", "webhooks", "voice AI", "Twilio", "Retell AI", "Python", "JavaScript", "CRM integration", "prompt writing"]) assert.ok(terms(ai.on).includes(t), "on: " + t);
  const pw = ai.on.find((o) => o.term === "prompt writing");
  assert.deepEqual(pw.proofs, ["prompts"]);
  assert.equal(pw.as, "prompt engineering", "the listing's spelling, read as the prompt writing on the record");
  for (const t of ["Zapier", "Make", "OpenAI API", "RAG", "vector databases", "HubSpot", "Salesforce", "bachelor's degree", "computer science degree", "React Native", "Java", "SQL Server"]) assert.ok(terms(ai.off).includes(t), "off: " + t);
  assert.ok(!terms(ai.on).includes("React"), "React Native is not React");
  assert.ok(!terms(ai.on).includes("SQL"), "SQL Server alone is not SQL");
  assert.equal(ai.off.find((o) => o.term === "Java").as, "Java", "Java matched on its own, never inside JavaScript");
  assert.equal(ai.off.filter((o) => o.term === "Java").length, 1);
  assert.equal(ai.facts.find((f) => f.topic === "degree").answer, "Associate of Arts in Business, San Jacinto College, May 2026 (GPA 3.63, Dean's Honor List). Bachelor of Science in Neuroscience at The University of Texas at Austin, expected 2028.");
});

const sf = M.read(LISTINGS.salesforce);
test("Salesforce admin posting", () => {
  common(sf, "salesforce");
  assert.ok(["software", "it", "dealer-tech", "data"].includes(sf.build), "a systems reading, got " + sf.build);
  for (const t of ["user accounts", "data validation", "data integrity", "database migrations", "user training", "CRM administration", "Excel"]) assert.ok(terms(sf.on).includes(t), "on: " + t);
  for (const t of ["Salesforce", "BI dashboards", "Excel lookups and pivot tables"]) assert.ok(terms(sf.off).includes(t), "off: " + t);
  assert.ok(!terms(sf.on).includes("Salesforce"), "Salesforce is never on the record");
  assert.equal(sf.on.find((o) => o.term === "Excel").as, "Excel", "Excel skills is Excel; 'You excel in' is not");
  assert.equal(sf.on.filter((o) => o.term === "Excel").length, 1);
  assert.equal(sf.off.find((o) => o.term === "Excel lookups and pivot tables").as, "VLOOKUP", "the lookups are named, never claimed");
});

const bdc = M.read(LISTINGS.bdc);
test("Bilingual BDC posting", () => {
  common(bdc, "bdc");
  assert.equal(bdc.build, "sales");
  for (const t of ["Spanish", "call handling", "appointment setting", "follow-up", "lead management", "phone sales", "CRM", "customer service", "dealership operations", "sales"]) assert.ok(terms(bdc.on).includes(t), "on: " + t);
  for (const t of ["VinSolutions", "cold calling"]) assert.ok(terms(bdc.off).includes(t), "off: " + t);
  const es = bdc.on.find((o) => o.term === "Spanish");
  assert.equal(es.as, "Bilingual", "the listing's first spelling");
  assert.deepEqual(es.proofs, ["spanish"]);
  assert.equal(bdc.on.filter((o) => o.term === "Spanish").length, 1, "English/Spanish and bilingual are one term");
  assert.ok(bdc.facts.some((f) => f.topic === "experience" && /1\+ year of automotive sales/.test(f.as)), "experience fact");
});

const m365 = M.read(LISTINGS.m365);
test("IT posting asking for Microsoft 365", () => {
  common(m365, "m365");
  assert.equal(m365.build, "it");
  for (const t of ["Microsoft 365", "Google Workspace", "user accounts", "role-based access control", "technical support", "hardware", "phones", "network setup", "SOPs", "Excel", "Google Sheets", "Git"]) assert.ok(terms(m365.on).includes(t), "on: " + t);
  for (const t of ["device management", "Active Directory", "Windows", "macOS", "chat and meeting tools", "CompTIA A+", "other languages"]) assert.ok(terms(m365.off).includes(t), "off: " + t);
  assert.deepEqual(m365.on.find((o) => o.term === "Microsoft 365").proofs, ["workspace"]);
  assert.equal(m365.on.find((o) => o.term === "Git").as, "version control", "version control is Git");
  assert.equal(m365.off.find((o) => o.term === "chat and meeting tools").as, "Microsoft Teams", "Teams is named, never claimed");
  assert.ok(!terms(m365.on).includes("Spanish"), "bilingual in another language is not Spanish");
  assert.equal(m365.off.find((o) => o.term === "other languages").as, "Vietnamese");
});

test("Bilingual in Spanish or another language", () => {
  const r = M.read("Bilingual in Spanish or Vietnamese preferred. Fluent in Spanish a plus.");
  common(r, "either");
  assert.equal(r.on.find((o) => o.term === "Spanish").as, "Bilingual", "Spanish named, so bilingual counts");
  assert.ok(terms(r.off).includes("other languages"));
  assert.ok(!r.on.some((o) => /fluent/i.test(o.as)), "fluent is never put on the record");
});

test("Words that only sound like the record", () => {
  const r = M.read(`Line cook: prepare plates for service and cut metal plates for the grill station.
Accounts clerk: process payoffs and payoff quotes for loan accounts; meet the 30-day deadline for reports, track the 30-day window for returns and the 30-day requirement for onboarding.
Respond to prompts in the survey. Build Google Apps Script automations. Experience in conversation design and conversational design for chat products.`);
  common(r, "lookalikes");
  for (const t of ["license plates", "lien payoffs", "30-day title deadline", "prompt writing", "Google Workspace", "call flows"]) assert.ok(!terms(r.on).includes(t), "not on the record: " + t);
  const d = M.read("Handle lien payoffs on trade-ins, trade-in payoffs, license plates and temp tags; file title transfers inside the 30-day title deadline. Write prompts and call flows for our voice agents. Administer Google Apps.");
  common(d, "dealer back office");
  for (const t of ["lien payoffs", "license plates", "temporary tags", "title transfers", "30-day title deadline", "prompt writing", "call flows", "Google Workspace"]) assert.ok(terms(d.on).includes(t), "on: " + t);
});

test("Nothing to read", () => {
  const r = M.read("");
  common(r, "empty");
  assert.equal(r.on.length + r.off.length + r.facts.length, 0);
  assert.equal(r.build, "ai", "all builds tie at zero, so the first build");
});

test("Helpers for the tailored print", () => {
  assert.deepEqual(M.term("postgresql"), { term: "PostgreSQL", proofs: ["rls", "migrations"], off: false });
  assert.equal(M.term("Salesforce").off, true);
  assert.equal(M.term("sales tax"), null, "ignore phrases are not terms");
  assert.equal(M.spells("PostgreSQL", "Postgres"), true);
  assert.equal(M.spells("PostgreSQL", "Postgres <img src=x>"), false);
  assert.equal(M.hash({ on: [{ term: "PostgreSQL", as: "Postgres" }, { term: "Python", as: "Python" }] }), "#t=PostgreSQL:Postgres,Python");
});

if (process.argv.includes("--show")) for (const [k, r] of Object.entries({ it, title, ai, salesforce: sf, bdc, m365 })) console.log("\n" + k + " " + show(r));
console.log(failed ? "\n" + failed + " failed" : "\nall passed");
process.exit(failed ? 1 : 0);
