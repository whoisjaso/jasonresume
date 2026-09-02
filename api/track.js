// First-party analytics relay. The page posts small event batches here and
// this function forwards them to PostHog with the project key kept server
// side. Without POSTHOG_KEY it quietly accepts and drops everything.
//   POSTHOG_KEY   the project API key (phc_...)
//   POSTHOG_HOST  ingestion host, default https://us.i.posthog.com

const ALLOWED = new Set([
  "site_arrived", "intro_skipped", "role_chosen", "name_given", "name_skipped",
  "guide_line", "guide_skipped", "guide_finished", "guide_reopened",
  "chat_asked", "intake_step", "intake_sent", "cta_click", "menu_opened",
  "laptop_played", "sound_toggled", "page_left"
]);
const STR = (v, n) => String(v == null ? "" : v).slice(0, n);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  const key = process.env.POSTHOG_KEY;
  if (!key) return res.status(204).end();

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  const id = STR(body?.id, 64).replace(/[^\w-]/g, "");
  const events = Array.isArray(body?.events) ? body.events.slice(0, 25) : [];
  if (!id || !events.length) return res.status(204).end();

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ua = STR(req.headers["user-agent"], 300);
  const common = body?.common && typeof body.common === "object" ? body.common : {};
  const base = {
    $lib: "jasonobawemimo-guide",
    $current_url: STR(common.url, 300),
    $referrer: STR(common.ref, 300),
    $referring_domain: STR(common.refd, 120),
    $screen_width: Number(common.w) || undefined,
    $screen_height: Number(common.h) || undefined,
    $device_type: ["Desktop", "Mobile", "Tablet"].includes(common.device) ? common.device : undefined,
    $browser_language: STR(common.lang, 16),
    $raw_user_agent: ua,
    $ip: ip || undefined
  };

  const batch = [];
  for (const e of events) {
    const event = STR(e?.event, 40);
    if (!ALLOWED.has(event)) continue;
    const props = { ...base };
    const p = e?.props && typeof e.props === "object" ? e.props : {};
    for (const k of Object.keys(p).slice(0, 12)) {
      if (!/^[a-z_]{1,32}$/.test(k)) continue;
      const v = p[k];
      props[k] = typeof v === "number" ? v : typeof v === "boolean" ? v : STR(v, 200);
    }
    if (e?.set && typeof e.set === "object") {
      const set = {};
      if (e.set.name) set.name = STR(e.set.name, 40);
      if (e.set.role) set.role = STR(e.set.role, 20);
      if (Object.keys(set).length) { props.$set = set; props.$set_once = { first_seen: new Date().toISOString() }; }
    }
    batch.push({ event, distinct_id: id, properties: props, timestamp: new Date(Number(e?.ts) || Date.now()).toISOString() });
  }
  if (!batch.length) return res.status(204).end();

  const host = (process.env.POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
  try {
    await fetch(host + "/batch/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key, batch })
    });
  } catch {}
  return res.status(204).end();
}
