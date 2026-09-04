// Email through Resend and person-level events through PostHog. Both are
// optional: with no key the functions return { sent: false } and the page
// falls back to a mailto link.
//   RESEND_API_KEY   resend.com, API keys
//   RESEND_FROM      a sender on a domain you verified in Resend, e.g.
//                    "Jason Obawemimo <jason@apohenia.com>". Without it the
//                    Resend test sender is used, which can only reach your
//                    own inbox, so visitor confirmations are skipped.
//   NOTIFY_TO        where the desk emails land, default jobawems@gmail.com
//   POSTHOG_KEY      same key the tracker uses

export const NOTIFY_TO = process.env.NOTIFY_TO || "jobawems@gmail.com";
export const STR = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
export const EMAIL_OK = (s) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[a-z]{2,}$/i.test(s);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function verifiedSender() { return !!process.env.RESEND_FROM; }

export async function sendMail({ to, subject, text, html, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, why: "no key" };
  const from = process.env.RESEND_FROM || "Jason Obawemimo <onboarding@resend.dev>";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, text, html, reply_to: replyTo || undefined })
    });
    if (!r.ok) return { sent: false, why: "http " + r.status };
    return { sent: true };
  } catch (err) { return { sent: false, why: String(err?.message || err) }; }
}

export async function capture(event, distinctId, properties, set) {
  const key = process.env.POSTHOG_KEY;
  if (!key) return;
  const host = (process.env.POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
  const props = { $lib: "jasonobawemimo-desk", ...properties };
  if (set) props.$set = set;
  try {
    await fetch(host + "/capture/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key, event, distinct_id: distinctId, properties: props, timestamp: new Date().toISOString() })
    });
  } catch {}
}

// Small per-instance limiter shared by the desks.
const hits = new Map();
export function limited(ip, max = 6, win = 600_000) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < win);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

export function readBody(req) {
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  return body && typeof body === "object" ? body : {};
}

export function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim() || "anon";
}
