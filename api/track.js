// First-party analytics relay. The page posts small event batches here and
// this function forwards them to PostHog with the project key kept server
// side. Without POSTHOG_KEY it quietly accepts and drops everything.
//   POSTHOG_KEY   the project API key (phc_...)
//   POSTHOG_HOST  ingestion host, default https://us.i.posthog.com

const ALLOWED = new Set([
  // arrival and attention
  "page_view", "site_arrived", "section_viewed", "page_left",
  // the cut, chrome and toggles
  "role_chosen", "menu_opened", "sound_toggled", "still_toggled", "commentary_toggled", "commentary_line",
  // the desk and the films
  "scene_interacted", "desk_step", "desk_finished", "film_play", "film_progress", "film_complete", "film_chapter", "film_sound",
  // the resume and proof
  "resume_open", "resume_print", "deck_slide", "deck_finished", "proof_open", "verify_opened", "verify_link", "chat_asked",
  // games and lessons
  "mark_words", "card_copied",
  // questions, forwards, extras
  "question_added", "questions_copied", "questions_mailed", "forward_copied", "share_opened", "rig_toggled", "cues_toggled",
  "trailer_opened", "trailer_shot", "trailer_finished", "water_touched", "copy_clicked",
  // the intro: tap to begin, the question, the name
  "intro_shown", "intro_started", "intro_finished", "intro_skipped", "name_given", "name_skipped",
  // the reel: a cut for each visitor
  "reel_started", "reel_shot", "reel_finished", "reel_exited",
  // the Today feed: a card opens into its story, the desk app
  "story_opened", "desk_step", "desk_finished",
  // the library: titles, trophies, screens, the platinum
  "trophy_unlocked", "trophies_opened", "screen_opened", "level_clear",
  // Player 2: the build, the card, the listing match, the send
  "build_shown", "build_chosen", "build_skipped", "build_edited", "build_opened", "build_viewed", "card_saved", "build_link_copied",
  "listing_matched", "build_resume", "build_sent",
  // the walkthrough: the guided tour and the narrated film
  "intro_tour", "tour_started", "tour_step", "tour_finished", "tour_exit", "walkthrough_opened", "walkthrough_closed",
  // Stop Thinking Poor, the mentorship page at /stp
  "stp_video_play", "stp_video_complete", "stp_apply_started", "stp_apply_sent",
  // conversion
  "cta_click", "outbound_click", "contact_click", "book_click", "call_booked", "lead_sent",
  // older pages still in the wild
  "guide_line", "guide_skipped", "guide_finished", "guide_reopened",
  "chat_asked", "intake_step", "intake_sent", "laptop_played", "vsl_play", "vsl_complete"
]);
const STR = (v, n) => String(v == null ? "" : v).slice(0, n);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  const key = process.env.POSTHOG_KEY;
  if (!key) return res.status(204).end();
  // The browser asked not to be tracked: the page sends nothing, and this is the second net
  if (req.headers["sec-gpc"] === "1" || req.headers["dnt"] === "1") return res.status(204).end();

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  const id = STR(body?.id, 64).replace(/[^\w-]/g, "");
  const sid = STR(body?.sid, 64).replace(/[^\w-]/g, "");
  const events = Array.isArray(body?.events) ? body.events.slice(0, 25) : [];
  if (!id || !events.length) return res.status(204).end();

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ua = STR(req.headers["user-agent"], 300);
  if (/bot|crawl|spider|slurp|headless|preview|facebookexternalhit|embedly|lighthouse/i.test(ua)) return res.status(204).end();
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
    $ip: ip || undefined,
    $session_id: sid || undefined,
    $pathname: STR(common.path, 200) || undefined
  };

  const batch = [], dropped = [];
  for (const e of events) {
    const event = STR(e?.event, 40);
    if (!ALLOWED.has(event)) { dropped.push(event.replace(/[^a-z_]/g, "").slice(0, 40)); continue; }
    const props = { ...base };
    const p = e?.props && typeof e.props === "object" ? e.props : {};
    for (const k of Object.keys(p).slice(0, 14)) {
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
  // Drops are never silent: one personless count per batch, visible on the board
  if (dropped.length) batch.push({ event: "relay_dropped", distinct_id: "relay", properties: { ...base, $process_person_profile: false, count: dropped.length, names: dropped.slice(0, 10).join(",") }, timestamp: new Date().toISOString() });
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
