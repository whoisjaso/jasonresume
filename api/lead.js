// Obavia Desk early access. A Texas dealer who is booking (or has booked) a
// call leaves a short note here. The function records the person, drafts a
// pre-call brief for Jason with the free-model chain, emails it to him, and,
// when a verified sender is configured, sends the dealer a short confirmation
// in Jason's voice. With no keys it still answers 200 and tells the page to
// fall back to email.

import { complete } from "./_lib/llm.js";
import { NOTIFY_TO, STR, EMAIL_OK, esc, sendMail, capture, limited, readBody, clientIp, verifiedSender } from "./_lib/notify.js";

const VOLUME = new Set(["under10", "10to30", "30to60", "over60", "unsure"]);
const VOLUME_TEXT = { under10: "under 10 sales a month", "10to30": "10 to 30 sales a month", "30to60": "30 to 60 sales a month", over60: "over 60 sales a month", unsure: "volume not given" };
const PAY = new Set(["cash", "bhph", "bank", "mix", "unsure"]);
const PAY_TEXT = { cash: "mostly cash deals", bhph: "mostly buy here pay here", bank: "mostly bank financing", mix: "a mix of cash, buy here pay here and bank", unsure: "financing mix not given" };

const BOUNDARY = `Obavia Desk is a dealership sale desk in development for Texas independent dealers: every sale, start to signed, one question per screen. It handles cash, buy here pay here and bank financing, works out Texas sales tax, title, registration and the dealer's doc fee, fills the bill of sale and Form 130-U from the deal, gives rebuilt and salvage titles their own disclosures, and the buyer signs at the desk. It grew out of Handle a Sale, the desk Jason built at Triple J Auto Investment in Houston. It is not live: never say dealers use it, never claim customers, results, a percentage or any outcome. Text it to sign, Reach (Facebook Marketplace posting from the salesperson's own phone) and dealer websites are in development, not live. Pricing is not published; never quote a price. Early access is a conversation, not an account.`;

const BRIEF_SYSTEM = `You prepare Jason Obawemimo for a thirty-minute call with a Texas dealer who asked about early access to Obavia Desk. ${BOUNDARY} Write a pre-call brief for Jason only. Plain text, no markdown, no headings, no bullets, no emoji, no em dashes. Four short paragraphs at most: who they are and what they said, in their words where possible; the likely paperwork pain behind it (title packets coming back from the county, the 130-U seller line, the doc fee and tax math, buy here pay here paperwork, a process that lives in one person's head) stated as a guess and labeled as a guess; three questions Jason should ask first, reusing the dealer's own words; one thing to avoid promising. Never invent facts about the dealership. Under 180 words.`;

const CONFIRM_SYSTEM = `You are Jason Obawemimo writing a two-paragraph email to a Texas dealer who just asked about early access to Obavia Desk. ${BOUNDARY} Plain text, no markdown, no bullets, no emoji, no exclamation marks, no em dashes. First paragraph: thank them in one line and reflect back what they said, in their words. Second paragraph: what to have on hand for the call (your last few deals and the paperwork you print for them, and what you use today), and that it is thirty minutes with you, no deck, from someone who runs a lot too. Sign off with "Jason". Under 110 words. Never promise outcomes or a launch date.`;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method" }); }
  const ip = clientIp(req);
  if (limited(ip)) return res.status(429).json({ error: "slow down" });

  const b = readBody(req);
  if (STR(b.website, 10)) return res.status(200).json({ ok: true, delivered: true }); // honeypot filled: pretend
  const name = STR(b.name, 60), dealership = STR(b.dealership || b.agency, 80), city = STR(b.city, 60), system = STR(b.system, 80), email = STR(b.email, 120).toLowerCase();
  const volume = VOLUME.has(b.volume) ? b.volume : "unsure", pay = PAY.has(b.pay) ? b.pay : "unsure";
  const note = STR(b.note, 900), booked = b.booked === true || b.booked === "yes";
  if (!name || !EMAIL_OK(email)) return res.status(400).json({ error: "name and a real email, please" });

  const id = "lead:" + email;
  await capture("lead_note", id, { dealership, city, volume, pay, booked, note_len: note.length, $ip: ip }, { name, email, dealership, role: "dealer" });

  const facts = `Name: ${name}\nDealership: ${dealership || "not given"}\nCity: ${city || "not given"}\nUses today: ${system || "not given"}\nVolume: ${VOLUME_TEXT[volume]}\nFinancing: ${PAY_TEXT[pay]}\nBooked a time on Calendly: ${booked ? "yes" : "not yet"}\nWhat they wrote: ${note || "(nothing)"}`;

  let brief = "";
  try { brief = (await complete(BRIEF_SYSTEM, [{ role: "user", content: facts }], { maxTokens: 420 })).text; } catch { brief = ""; }

  const subject = `Obavia Desk early access: ${name}${dealership ? ", " + dealership : ""}`;
  const text = `${facts}\n\n${brief ? "Pre-call brief\n" + brief : "No brief: no model key configured."}\n\nReply to this email to reach them: ${email}`;
  const html = `<div style="font:15px/1.55 -apple-system,Helvetica,Arial,sans-serif;color:#1a1a1a;max-width:640px"><pre style="white-space:pre-wrap;font:inherit">${esc(facts)}</pre>${brief ? `<p style="margin:18px 0 6px;font-weight:600">Pre-call brief</p><p style="white-space:pre-wrap">${esc(brief)}</p>` : `<p>No brief: no model key configured.</p>`}<p style="color:#666;margin-top:18px">Reply to reach them: ${esc(email)}</p></div>`;
  const toJason = await sendMail({ to: NOTIFY_TO, subject, text, html, replyTo: email });

  let confirmed = false;
  if (toJason.sent && verifiedSender()) {
    let body = "";
    try { body = (await complete(CONFIRM_SYSTEM, [{ role: "user", content: facts }], { maxTokens: 260 })).text; } catch { body = ""; }
    if (!body) body = `Thanks, ${name.split(" ")[0]}. I read what you wrote.\n\nFor the call, have your last few deals handy, the paperwork you print for them, and whatever you use today. Thirty minutes, me, no deck. I run a lot too.\n\nJason`;
    const r = await sendMail({ to: email, subject: "Before our call", text: body, html: `<div style="font:15px/1.6 -apple-system,Helvetica,Arial,sans-serif;color:#1a1a1a;max-width:560px;white-space:pre-wrap">${esc(body)}</div>`, replyTo: NOTIFY_TO });
    confirmed = r.sent;
  }

  return res.status(200).json({ ok: true, delivered: toJason.sent, confirmed });
}
