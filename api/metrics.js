// Numbers for the admin page. Reads PostHog through HogQL with a personal
// API key that never reaches the browser. Gated by ADMIN_TOKEN.
//   ADMIN_TOKEN               any long secret; the admin page asks for it once
//   POSTHOG_PERSONAL_API_KEY  phx_... with query:read on the project
//   POSTHOG_PROJECT_ID        the numeric project id
//   POSTHOG_API_HOST          default https://us.posthog.com

let cache = { at: 0, data: null };

const Q = {
  days: `select toDate(timestamp) as d, count(distinct distinct_id) as v, count() as e
         from events where event = 'site_arrived' and timestamp > now() - interval 30 day
         group by d order by d`,
  totals: `select
             count(distinct if(timestamp > now() - interval 1 day, distinct_id, null)) as today,
             count(distinct if(timestamp > now() - interval 7 day, distinct_id, null)) as week,
             count(distinct distinct_id) as month
           from events where event = 'site_arrived' and timestamp > now() - interval 30 day`,
  roles: `select properties.role as r, count(distinct distinct_id) as v
          from events where event = 'role_chosen' and timestamp > now() - interval 30 day group by r order by v desc`,
  funnel: `select event, count(distinct distinct_id) as v from events
           where timestamp > now() - interval 30 day
             and event in ('site_arrived','role_chosen','name_given','guide_finished','chat_asked','intake_sent','cta_click')
           group by event`,
  people: `select properties.name as name, properties.role as role, max(timestamp) as at,
             any(properties.$geoip_city_name) as city, any(properties.$geoip_subdivision_1_code) as region,
             any(properties.$geoip_country_code) as country, any(properties.$device_type) as device,
             any(properties.$referring_domain) as ref
           from events where event = 'name_given' and timestamp > now() - interval 30 day
           group by name, role order by at desc limit 40`,
  refs: `select coalesce(nullIf(properties.$referring_domain, ''), 'direct') as r, count(distinct distinct_id) as v
         from events where event = 'site_arrived' and timestamp > now() - interval 30 day group by r order by v desc limit 8`,
  devices: `select coalesce(nullIf(properties.$device_type, ''), 'Unknown') as d, count(distinct distinct_id) as v
            from events where event = 'site_arrived' and timestamp > now() - interval 30 day group by d order by v desc`,
  questions: `select properties.q as q, properties.role as role, timestamp as at from events
              where event = 'chat_asked' and timestamp > now() - interval 30 day order by at desc limit 20`,
  intents: `select properties.pain as pain, count(distinct distinct_id) as v from events
            where event = 'intake_step' and properties.step = 1 and timestamp > now() - interval 30 day group by pain order by v desc`
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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method" }); }

  const token = process.env.ADMIN_TOKEN;
  if (!token) return res.status(503).json({ error: "unconfigured", missing: ["ADMIN_TOKEN"] });
  const given = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!given || given.length !== token.length || !timingSafeEqual(given, token)) return res.status(401).json({ error: "unauthorized" });

  const missing = ["POSTHOG_PERSONAL_API_KEY", "POSTHOG_PROJECT_ID"].filter((k) => !process.env[k]);
  if (missing.length) return res.status(503).json({ error: "unconfigured", missing });

  if (cache.data && Date.now() - cache.at < 60_000) return res.status(200).json(cache.data);

  const host = (process.env.POSTHOG_API_HOST || "https://us.posthog.com").replace(/\/$/, "");
  const id = process.env.POSTHOG_PROJECT_ID, key = process.env.POSTHOG_PERSONAL_API_KEY;
  try {
    const names = Object.keys(Q);
    const results = await Promise.all(names.map((n) => hogql(host, id, key, Q[n]).catch((e) => ({ error: String(e.message) }))));
    const data = { at: new Date().toISOString() };
    names.forEach((n, i) => { data[n] = results[i]; });
    cache = { at: Date.now(), data };
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: "upstream", detail: String(err.message) });
  }
}

function timingSafeEqual(a, b) {
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
