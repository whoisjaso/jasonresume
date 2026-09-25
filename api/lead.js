// The Obavia desk. An agency owner who is booking (or has booked) a call
// leaves a short note here. The function records the person, drafts a
// pre-call brief for Jason with the free-model chain, emails it to him, and,
// when a verified sender is configured, sends the owner a short confirmation
// in Jason's voice. With no keys it still answers 200 and tells the page to
// fall back to email.

import { complete } from "./_lib/llm.js";
import { NOTIFY_TO, STR, EMAIL_OK, esc, sendMail, capture, limited, readBody, clientIp, verifiedSender } from "./_lib/notify.js";

const REVENUE = new Set(["under100k", "100to250k", "250to500k", "500kto1m", "over1m", "unsure"]);
const REVENUE_TEXT = { under100k: "under $100K a month", "100to250k": "$100K to $250K a month", "250to500k": "$250K to $500K a month", "500kto1m": "$500K to $1M a month", over1m: "over $1M a month", unsure: "revenue not given" };

const BOUNDARY = `Obavia is sales operating software in development for agency owners at $100K to $1M a month and their setters and closers. It follows a sale through Capture, Connect, Book, Discover, Agree and Collect, inside the agency's own funnel, scripts and vocabulary, and its method is to listen to the buyer's exact words. It is not live: never say it has customers, results, a conversion rate, a percentage or any outcome. Zoom, Calendly, GoHighLevel, HubSpot, Slack, Zapier, Google Calendar and Cal.com are planned connection targets, not active integrations. The waitlist is free and grants no access. Core is planned at $3,000 a month; Scale and Enterprise are proposed; implementation is a one-time $5,000.`;

const BRIEF_SYSTEM = `You prepare Jason Obawemimo for a thirty-minute call with an agency owner who asked to talk about Obavia. ${BOUNDARY} Write a pre-call brief for Jason only. Plain text, no markdown, no headings, no bullets, no emoji, no em dashes. Four short paragraphs at most: who they are and what they said, in their words where possible; the likely leak behind it (leads nobody owns, no-shows, the setter to closer handoff, signed but not collected, a method that lives in the owner's head) stated as a guess and labeled as a guess; three questions Jason should ask first, written as plain questions that reuse the owner's own words; one thing to avoid promising. Never invent facts about the agency. Under 180 words.`;

const CONFIRM_SYSTEM = `You are Jason Obawemimo writing a two-paragraph email to an agency owner who just asked to talk about Obavia. ${BOUNDARY} Plain text, no markdown, no bullets, no emoji, no exclamation marks, no em dashes. First paragraph: thank them in one line and reflect back what they said, in their words. Second paragraph: what to have on hand for the call (one recent sales call they remember, what the buyer actually said, and how a lead moves from setter to closer today), and that it is thirty minutes with you, no deck. Sign off with "Jason". Under 110 words. Never promise outcomes.`;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method" }); }
  const ip = clientIp(req);
  if (limited(ip)) return res.status(429).json({ error: "slow down" });

  const b = readBody(req);
  if (STR(b.website, 10)) return res.status(200).json({ ok: true, delivered: true }); // honeypot filled: pretend
  const name = STR(b.name, 60), agency = STR(b.agency || b.dealership, 80), site = STR(b.site, 120), email = STR(b.email, 120).toLowerCase();
  const revenue = REVENUE.has(b.revenue) ? b.revenue : "unsure", sellers = STR(b.sellers, 20);
  const note = STR(b.note, 900), booked = b.booked === true || b.booked === "yes";
  if (!name || !EMAIL_OK(email)) return res.status(400).json({ error: "name and a real email, please" });

  const id = "lead:" + email;
  await capture("lead_note", id, { agency, revenue, sellers, booked, note_len: note.length, $ip: ip }, { name, email, agency, role: "partner" });

  const facts = `Name: ${name}\nAgency: ${agency || "not given"}\nWebsite: ${site || "not given"}\nRevenue: ${REVENUE_TEXT[revenue]}\nSetters and closers: ${sellers || "not given"}\nBooked a time on Calendly: ${booked ? "yes" : "not yet"}\nWhat they wrote: ${note || "(nothing)"}`;

  let brief = "";
  try { brief = (await complete(BRIEF_SYSTEM, [{ role: "user", content: facts }], { maxTokens: 420 })).text; } catch { brief = ""; }

  const subject = `Obavia call: ${name}${agency ? ", " + agency : ""}`;
  const text = `${facts}\n\n${brief ? "Pre-call brief\n" + brief : "No brief: no model key configured."}\n\nReply to this email to reach them: ${email}`;
  const html = `<div style="font:15px/1.55 -apple-system,Helvetica,Arial,sans-serif;color:#1a1a1a;max-width:640px"><pre style="white-space:pre-wrap;font:inherit">${esc(facts)}</pre>${brief ? `<p style="margin:18px 0 6px;font-weight:600">Pre-call brief</p><p style="white-space:pre-wrap">${esc(brief)}</p>` : `<p>No brief: no model key configured.</p>`}<p style="color:#666;margin-top:18px">Reply to reach them: ${esc(email)}</p></div>`;
  const toJason = await sendMail({ to: NOTIFY_TO, subject, text, html, replyTo: email });

  let confirmed = false;
  if (toJason.sent && verifiedSender()) {
    let body = "";
    try { body = (await complete(CONFIRM_SYSTEM, [{ role: "user", content: facts }], { maxTokens: 260 })).text; } catch { body = ""; }
    if (!body) body = `Thanks, ${name.split(" ")[0]}. I read what you wrote.\n\nFor the call, bring one recent sales call you remember, what the buyer actually said, and how a lead gets from your setter to your closer today. Thirty minutes, me, no deck.\n\nJason`;
    const r = await sendMail({ to: email, subject: "Before our call", text: body, html: `<div style="font:15px/1.6 -apple-system,Helvetica,Arial,sans-serif;color:#1a1a1a;max-width:560px;white-space:pre-wrap">${esc(body)}</div>`, replyTo: NOTIFY_TO });
    confirmed = r.sent;
  }

  return res.status(200).json({ ok: true, delivered: toJason.sent, confirmed });
}
