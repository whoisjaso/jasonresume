// The Dailies: who came, what they cared about, who is worth a look.
// Reads PostHog through one HogQL pull with a personal API key that never
// reaches the browser, aggregates and scores in JavaScript, and caches for
// five minutes so the board never hammers the query endpoint.
//   ADMIN_TOKEN               any long secret; the board asks for it once
//   POSTHOG_PERSONAL_API_KEY  phx_... with query:read on the project
//   POSTHOG_PROJECT_ID        the numeric project id
//   POSTHOG_API_HOST          default https://us.posthog.com
//   REF_CODES                 optional JSON {"code": "label"} for outreach links (?r=code); kept server side

let cache = { at: 0, data: null };

const PULL = `select event, distinct_id, timestamp,
    properties.role as role, properties.section as section, properties.page as page, properties.source as source,
    properties.campaign as campaign, properties.ref_code as ref_code, properties.returning as returning, properties.visits as visits,
    properties.kind as kind, properties.label as label, properties.film as film, properties.pct as pct, properties.step as step,
    properties.format as format, properties.q as q, properties.stage as stage, properties.option as opt, properties.dwell as dwell,
    properties.attention_s as attention, properties.names as names, properties.count as cnt,
    properties.$geoip_city_name as city, properties.$geoip_subdivision_1_code as region, properties.$geoip_country_code as country,
    properties.$device_type as device, properties.$referring_domain as refd
  from events
  where timestamp > now() - interval 30 day and properties.$lib = 'jasonobawemimo-guide'
  order by timestamp asc
  limit 60000`;

/* Points per moment. Terminal actions weigh most; nothing penalizes a skip. */
const POINTS = {
  page_view: 1, section_viewed: 0.5, role_chosen: 2, desk_step: 1, desk_finished: 8, film_play: 4, film_progress: 1, film_complete: 6,
  film_chapter: 1, resume_open: 8, resume_print: 6, deck_slide: 0.5, deck_finished: 6, proof_open: 3, verify_opened: 6, verify_link: 6,
  chat_asked: 6, mark_words: 3, handoff_pick: 4, leak_stage: 6, counts_done: 4, note_done: 5, card_copied: 6, question_added: 5,
  questions_mailed: 15, questions_copied: 8, forward_copied: 10, share_opened: 10, trailer_finished: 3, cta_click: 2, outbound_click: 2,
  contact_click: 15, book_click: 15, call_booked: 40, lead_sent: 40, apply_sent: 30
};
const TERMINAL = new Set(["call_booked", "lead_sent", "apply_sent", "questions_mailed"]);
const STORY = {
  desk_finished: "ran the desk", film_complete: "watched the whole film", film_play: "played the film", resume_open: "opened the resume",
  deck_finished: "went through the deck", verify_opened: "opened Check me", verify_link: "checked a proof link", chat_asked: "asked a question",
  leak_stage: "found their leak", handoff_pick: "did the handoff lesson", note_done: "rewrote the note", question_added: "saved questions for a call",
  questions_mailed: "emailed their questions", forward_copied: "copied the forward blurb", share_opened: "shared the site", contact_click: "clicked email",
  book_click: "clicked the calendar", call_booked: "booked a call", lead_sent: "sent a note", apply_sent: "applied"
};

async function hogql(host, id, key, query) {
  const r = await fetch(`${host}/api/projects/${id}/query/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } })
  });
  if (!r.ok) throw new Error("posthog " + r.status);
  const j = await r.json();
  const cols = j.columns || [];
  return (j.results || []).map((row) => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
}

function audience(v) {
  if (v.role) return { interviewer: "Screening", partner: "Agency owner", lurker: "Just looking" }[v.role] || v.role;
  if (v.did.apply_sent || v.pages.join) return "Applicant";
  if (v.did.leak_stage || v.did.handoff_pick || v.did.counts_done || v.pages.obavia) return "Agency owner";
  if (v.did.resume_open || v.did.deck_slide || v.did.verify_opened || v.did.verify_link) return "Screening";
  return "Just looking";
}

function build(rows, refCodes) {
  const now = Date.now(), DAY = 864e5;
  const people = new Map(), sources = {}, attention = {}, questions = [], leaks = {}, drops = { count: 0, names: {} };
  const journeys = { Screening: [0, 0, 0, 0], "Agency owner": [0, 0, 0, 0], Applicant: [0, 0, 0, 0] };
  for (const r of rows) {
    if (r.event === "relay_dropped") { drops.count += Number(r.cnt) || 0; String(r.names || "").split(",").filter(Boolean).forEach((n) => { drops.names[n] = (drops.names[n] || 0) + 1; }); continue; }
    const id = r.distinct_id; if (!id) continue;
    let v = people.get(id);
    if (!v) { v = { id, first: r.timestamp, last: r.timestamp, score: 0, terminal: false, did: {}, pages: {}, moments: [], visits: 1, role: "", where: "", device: "", source: "", ref: "" }; people.set(id, v); }
    v.last = r.timestamp;
    const age = (now - Date.parse(r.timestamp)) / DAY;
    v.score += (POINTS[r.event] || 0) * Math.pow(0.5, age / 14);
    v.did[r.event] = (v.did[r.event] || 0) + 1;
    if (TERMINAL.has(r.event)) v.terminal = true;
    if (r.page) v.pages[r.page] = 1;
    if (r.event === "role_chosen" && r.role) v.role = r.role;
    if (r.city || r.region) v.where = [r.city, r.region || r.country].filter(Boolean).join(", ");
    if (r.device) v.device = r.device;
    if (r.event === "site_arrived") {
      if (r.visits) v.visits = Math.max(v.visits, Number(r.visits) || 1);
      if (!v.source) v.source = r.source || r.refd || "direct";
      if (r.ref_code && !v.ref) v.ref = (refCodes[r.ref_code] || "outreach code " + r.ref_code);
      const src = r.source || r.refd || "direct"; sources[src] = sources[src] || new Set(); sources[src].add(id);
    }
    if (STORY[r.event] && v.moments[v.moments.length - 1] !== STORY[r.event]) v.moments.push(STORY[r.event]);
    if (r.event === "page_left" && r.dwell) String(r.dwell).split(",").forEach((pair) => { const [k, s] = pair.split(":"); if (k) attention[k] = (attention[k] || 0) + (Number(s) || 0); });
    if (r.event === "chat_asked" && r.q) questions.push({ q: r.q, at: r.timestamp });
    if (r.event === "leak_stage" && r.stage) leaks[r.stage] = (leaks[r.stage] || 0) + 1;
  }
  const list = [...people.values()].map((v) => {
    const score = Math.min(100, Math.round(v.score)), aud = audience(v);
    const tier = v.terminal || score >= 40 ? "Hot" : score >= 15 ? "Warm" : "Cold";
    const j = journeys[aud];
    if (j) { j[0]++; if (v.did.desk_step || v.did.leak_stage || v.did.note_placed) j[1]++; if (v.did.resume_open || v.did.verify_opened || v.did.film_play || v.did.handoff_pick) j[2]++; if (v.terminal || v.did.contact_click || v.did.book_click) j[3]++; }
    return { name: "", who: ["Someone", v.where ? "in " + v.where : "", v.device ? "on a " + v.device.toLowerCase() : "", v.source && v.source !== "direct" ? "from " + v.source : ""].filter(Boolean).join(" "), audience: aud, tier, score, visits: v.visits, ref: v.ref, story: v.moments.slice(-3), last: v.last };
  });
  const week = list.filter((p) => now - Date.parse(p.last) < 7 * DAY);
  const worth = list.filter((p) => p.tier !== "Cold").sort((a, b) => (b.tier === "Hot") - (a.tier === "Hot") || b.score - a.score).slice(0, 40);
  return {
    at: new Date().toISOString(),
    headline: { week: week.length, worth: week.filter((p) => p.tier !== "Cold").length, outreach: week.filter((p) => p.ref).length, month: list.length },
    worth,
    journeys: Object.entries(journeys).map(([k, v]) => ({ audience: k, arrived: v[0], played: v[1], checked: v[2], reached_out: v[3] })),
    attention: Object.entries(attention).sort((a, b) => b[1] - a[1]).map(([section, seconds]) => ({ section, seconds })),
    sources: Object.entries(sources).map(([k, s]) => ({ source: k, people: s.size })).sort((a, b) => b.people - a.people).slice(0, 10),
    questions: questions.slice(-20).reverse(),
    leaks: Object.entries(leaks).map(([stage, n]) => ({ stage, n })).sort((a, b) => b.n - a.n),
    drops
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method" }); }
  const token = process.env.ADMIN_TOKEN;
  if (!token) return res.status(503).json({ error: "unconfigured", missing: ["ADMIN_TOKEN"] });
  const given = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!given || given.length !== token.length || !timingSafeEqual(given, token)) return res.status(401).json({ error: "unauthorized" });

  const missing = ["POSTHOG_PERSONAL_API_KEY", "POSTHOG_PROJECT_ID"].filter((k) => !process.env[k]);
  if (missing.length) return res.status(503).json({ error: "unconfigured", missing });

  if (cache.data && Date.now() - cache.at < 300_000) return res.status(200).json(cache.data);

  const host = (process.env.POSTHOG_API_HOST || "https://us.posthog.com").replace(/\/$/, "");
  const id = process.env.POSTHOG_PROJECT_ID, key = process.env.POSTHOG_PERSONAL_API_KEY;
  let refCodes = {}; try { refCodes = JSON.parse(process.env.REF_CODES || "{}"); } catch { refCodes = {}; }
  try {
    const rows = await hogql(host, id, key, PULL);
    const data = build(rows, refCodes);
    cache = { at: Date.now(), data };
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: "upstream", detail: String(err.message) });
  }
}

export { build };

function timingSafeEqual(a, b) {
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
