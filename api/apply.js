// The hiring desk. Closers and appointment setters apply here. The function
// records the person, asks the free-model chain for a short screening read
// (labeled as a read, never a decision), and emails Jason. With a verified
// sender it also sends the applicant a plain acknowledgment that says what
// happens next.

import { complete } from "./_lib/llm.js";
import { NOTIFY_TO, STR, EMAIL_OK, esc, sendMail, capture, limited, readBody, clientIp, verifiedSender } from "./_lib/notify.js";

const ROLES = { setter: "Appointment setter", closer: "Closer", either: "Either role" };

const SCREEN_SYSTEM = `You help Jason Obawemimo read an application for a sales role at Apohenia (Texas car-deal paperwork software, in build, sold to independent dealers by phone). Write a screening read for Jason only. Plain text, no markdown, no headings, no bullets, no emoji, no em dashes. Three short paragraphs: what the applicant actually said, in their words, without embellishment; what stands out for a phone-sales role (specifics, ownership of what happened after a sale, honesty about a loss) and what is missing; two questions for the first call. Say plainly if the answer reads as generic or AI-written. This is a read, not a decision, and say so in the last line. Under 150 words.`;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method" }); }
  const ip = clientIp(req);
  if (limited(ip, 4)) return res.status(429).json({ error: "slow down" });

  const b = readBody(req);
  if (STR(b.website, 10)) return res.status(200).json({ ok: true, delivered: true });
  const name = STR(b.name, 60), email = STR(b.email, 120).toLowerCase(), phone = STR(b.phone, 30), city = STR(b.city, 60);
  const role = ROLES[b.role] ? b.role : "either";
  const story = STR(b.story, 1400), link = STR(b.link, 200), hours = STR(b.hours, 80);
  if (!name || !EMAIL_OK(email) || story.length < 40) return res.status(400).json({ error: "name, a real email, and the story, please" });

  const id = "applicant:" + email;
  await capture("application", id, { role, city, story_len: story.length, has_link: !!link, $ip: ip }, { name, email, city, role: "applicant" });

  const facts = `Name: ${name}\nEmail: ${email}\nPhone: ${phone || "not given"}\nCity: ${city || "not given"}\nRole: ${ROLES[role]}\nHours they can work: ${hours || "not given"}\nLink: ${link || "none"}\n\nThe last thing they sold and what happened after:\n${story}`;

  let read = "";
  try { read = (await complete(SCREEN_SYSTEM, [{ role: "user", content: facts }], { maxTokens: 360 })).text; } catch { read = ""; }

  const subject = `Application: ${ROLES[role]}, ${name}${city ? " (" + city + ")" : ""}`;
  const text = `${facts}\n\n${read ? "Screening read\n" + read : "No read: no model key configured."}\n\nReply to this email to reach them: ${email}`;
  const html = `<div style="font:15px/1.55 -apple-system,Helvetica,Arial,sans-serif;color:#1a1a1a;max-width:640px"><pre style="white-space:pre-wrap;font:inherit">${esc(facts)}</pre>${read ? `<p style="margin:18px 0 6px;font-weight:600">Screening read</p><p style="white-space:pre-wrap">${esc(read)}</p>` : `<p>No read: no model key configured.</p>`}<p style="color:#666;margin-top:18px">Reply to reach them: ${esc(email)}</p></div>`;
  const toJason = await sendMail({ to: NOTIFY_TO, subject, text, html, replyTo: email });

  let confirmed = false;
  if (toJason.sent && verifiedSender()) {
    const body = `Got it, ${name.split(" ")[0]}. I read applications myself, usually within a few days.\n\nIf it is a fit, the next step is a twenty-minute call with me. I will tell you the pay structure in writing before that call, so you can decide before you spend any time. If it is not a fit I will still write back and say so.\n\nJason`;
    const r = await sendMail({ to: email, subject: "Your application to Apohenia", text: body, html: `<div style="font:15px/1.6 -apple-system,Helvetica,Arial,sans-serif;color:#1a1a1a;max-width:560px;white-space:pre-wrap">${esc(body)}</div>`, replyTo: NOTIFY_TO });
    confirmed = r.sent;
  }

  return res.status(200).json({ ok: true, delivered: toJason.sent, confirmed });
}
