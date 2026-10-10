// The run's community: boards, ghosts and tonight's crew for After Hours: The
// Run (game-run.js). Everything here is optional. Without a store it answers
// { on: false } and the game plays the same, with no board, no other players'
// ghosts and no crew line. With Do Not Track or Global Privacy Control the
// page never calls this, and the function answers { on: false } anyway.
//
// Store: Upstash Redis (or Vercel KV, which is Upstash) over its REST API.
//   KV_REST_API_URL     and  KV_REST_API_TOKEN          (Vercel KV names), or
//   UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN  (Upstash names)
//
// GET  /api/run?level=<id>[&ghosts=1]   the top ten, a few recent best ghosts, tonight's crew
// POST /api/run  { level, ms, medals, name, pid, c, s? }   a finished level (or "all" for the whole run)
// POST /api/run  { hello: 1, pid }                          a player started tonight (the crew count)
//
// The only free text is a display name: letters, digits and spaces, sixteen at
// most, run through a blocklist; anything else shows as "Player". Times must
// sit inside plausible bounds for the level, ghost samples are capped and
// checked against the level's size, bodies over 48 KB are refused, and each
// address gets a dozen writes a minute.

const LEVELS = {
  //               min ms   medals  width px
  neuroscience:    [9000,   4, 124 * 32],
  "triple-j":      [11000,  4, 152 * 32],
  "lead-to-title": [11000,  4, 150 * 32],
  "the-inbound":   [11000,  3, 150 * 32],
  prospector:      [9500,   2, 132 * 32],
  obavia:          [8000,   0, 112 * 32],
  all:             [60000, 17, 0]
};
const MAX_MS = 30 * 60 * 1000, MAX_BODY = 48 * 1024, MAX_SAMPLES = 1200, KEEP = 200, GHOSTS = 20;

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

async function redis(cmds) {
  const r = await fetch(URL_.replace(/\/$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmds)
  });
  if (!r.ok) throw new Error("store " + r.status);
  const out = await r.json();
  return out.map((x) => (x && "result" in x ? x.result : null));
}

/* ---------- the one free text: a display name ---------- */
const BLOCK = ["fuck", "shit", "cunt", "bitch", "nigg", "niga", "fag", "slut", "whore", "rape", "nazi", "hitler", "kike", "spic", "chink", "retard", "pussy", "penis", "vagina", "porn", "twat", "wank", "bastard", "asshole", "isis", "heil", "molest", "pedo", "tranny", "dyke", "coon", "gook", "wetback", "beaner"];
const WORDS = ["kkk", "dick", "cock", "sex", "anal", "cum", "ass", "tit", "tits", "fag", "hoe", "ho"]; /* whole words only: Dickens and Essex are fine */
const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", 8: "b", 9: "g" };
export function cleanName(v) {
  const s = String(v == null ? "" : v).normalize("NFKD").replace(/[^A-Za-z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 16);
  if (!s) return "Player";
  const flat = s.toLowerCase().replace(/[0-9]/g, (d) => LEET[d] || d).replace(/ /g, "").replace(/(.)\1+/g, "$1");
  if (BLOCK.some((w) => flat.includes(w.replace(/(.)\1+/g, "$1")))) return "Player";
  const words = s.toLowerCase().replace(/[0-9]/g, (d) => LEET[d] || d).split(" ");
  if (words.some((w) => WORDS.includes(w))) return "Player";
  return s;
}

function cleanChar(c) {
  if (!c || typeof c !== "object" || c.me) return { me: 1 };
  const n = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  return { me: 0, skin: n(c.skin, 5), hair: n(c.hair, 3), outfit: n(c.outfit, 4), glasses: c.glasses ? 1 : 0 };
}

function cleanSamples(s, w, ms) {
  if (!Array.isArray(s) || s.length < 5 || s.length > MAX_SAMPLES) return null;
  const out = [];
  for (const p of s) {
    if (!Array.isArray(p) || p.length < 2) return null;
    const x = Math.round(Number(p[0])), y = Math.round(Number(p[1])), f = Number(p[2]) < 0 ? -1 : 1;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < -40 || x > w + 40 || y < -800 || y > 800) return null;
    out.push([x, y, f]);
  }
  /* ten samples a second: the count has to agree with the time, give or take */
  const expect = ms / 100;
  if (out.length < expect * 0.6 || out.length > expect * 1.4 + 10) return null;
  /* and nobody moves faster than the game lets them */
  for (let i = 1; i < out.length; i++) if (out[i][0] - out[i - 1][0] > 60) return null; /* backwards is a respawn at a lamp */
  return out;
}

function night() {
  /* tonight in Houston: the crew key rolls over at noon, so one evening is one count */
  const d = new Date(Date.now() - 12 * 3600 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(d);
}

function clientIp(req) { return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim() || "anon"; }
function privateReq(req) { return req.headers["sec-gpc"] === "1" || req.headers["dnt"] === "1"; }

async function readJson(req) {
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body).length > MAX_BODY ? null : req.body;
  if (typeof req.body === "string") return req.body.length > MAX_BODY ? null : JSON.parse(req.body);
  let size = 0; const chunks = [];
  for await (const ch of req) { size += ch.length; if (size > MAX_BODY) return null; chunks.push(ch); }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!URL_ || !TOKEN || privateReq(req)) { return res.status(200).json({ on: false }); }

  if (req.method === "GET") {
    const level = String(req.query?.level || new URL(req.url, "http://x").searchParams.get("level") || "");
    const wantGhosts = /[?&]ghosts=1/.test(req.url || "");
    if (!LEVELS[level]) return res.status(400).json({ on: true, error: "level" });
    try {
      const cmds = [["ZRANGE", "run:b:" + level, "0", "9", "WITHSCORES"], ["PFCOUNT", "run:crew:" + night()]];
      if (wantGhosts && level !== "all") cmds.push(["LRANGE", "run:g:" + level, "0", "5"]);
      const [top, crew, ghosts] = await redis(cmds);
      const pids = [], scores = [];
      for (let i = 0; i < (top || []).length; i += 2) { pids.push(top[i]); scores.push(Number(top[i + 1])); }
      let details = [];
      if (pids.length) details = (await redis([["HMGET", "run:p:" + level, ...pids]]))[0] || [];
      const board = pids.map((pid, i) => {
        let d = {}; try { d = JSON.parse(details[i] || "{}"); } catch {}
        return { pid: pid.slice(0, 4), name: cleanName(d.name), ms: scores[i], medals: d.medals | 0, c: cleanChar(d.c) };
      });
      const gs = (ghosts || []).map((g) => { try { const j = JSON.parse(g); return { pid: String(j.pid || "").slice(0, 4), c: cleanChar(j.c), s: j.s }; } catch { return null; } }).filter(Boolean);
      res.setHeader("Cache-Control", "public, s-maxage=20, stale-while-revalidate=60");
      return res.status(200).json({ on: true, board, ghosts: gs, crew: Number(crew) || 0 });
    } catch {
      return res.status(200).json({ on: false });
    }
  }

  if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return res.status(405).end(); }
  if (Number(req.headers["content-length"] || 0) > MAX_BODY) return res.status(413).json({ error: "too big" });
  let b;
  try { b = await readJson(req); } catch { return res.status(400).json({ error: "json" }); }
  if (!b) return res.status(413).json({ error: "too big" });
  const pid = String(b.pid || "");
  if (!/^[a-z0-9]{6,24}$/.test(pid)) return res.status(400).json({ error: "pid" });

  const ip = clientIp(req);
  try {
    const [n] = await redis([["INCR", "run:rl:" + ip], ["EXPIRE", "run:rl:" + ip, "60", "NX"]]);
    if (Number(n) > 12) return res.status(429).json({ error: "slow down" });
  } catch { return res.status(200).json({ on: false }); }

  const crewKey = "run:crew:" + night();
  if (b.hello) {
    try { await redis([["PFADD", crewKey, pid], ["EXPIRE", crewKey, String(3 * 86400)]]); } catch {}
    return res.status(200).json({ on: true });
  }

  const level = String(b.level || ""), L = LEVELS[level];
  if (!L) return res.status(400).json({ error: "level" });
  const ms = Math.round(Number(b.ms));
  if (!Number.isFinite(ms) || ms < L[0] || ms > MAX_MS) return res.status(400).json({ error: "time" });
  const medals = Math.floor(Number(b.medals));
  if (!Number.isFinite(medals) || medals < 0 || medals > L[1]) return res.status(400).json({ error: "medals" });
  const name = cleanName(b.name), c = cleanChar(b.c);
  const samples = level !== "all" ? cleanSamples(b.s, L[2], ms) : null;

  try {
    const bKey = "run:b:" + level;
    const [, best] = await redis([["ZADD", bKey, "LT", String(ms), pid], ["ZSCORE", bKey, pid], ["PFADD", crewKey, pid], ["EXPIRE", crewKey, String(3 * 86400)]]);
    const isBest = Number(best) === ms;
    const cmds = [];
    if (isBest) {
      cmds.push(["HSET", "run:p:" + level, pid, JSON.stringify({ name, medals, c })]);
      if (samples) cmds.push(["LPUSH", "run:g:" + level, JSON.stringify({ pid, c, s: samples })], ["LTRIM", "run:g:" + level, "0", String(GHOSTS - 1)]);
    }
    cmds.push(["ZREMRANGEBYRANK", bKey, String(KEEP), "-1"]);
    await redis(cmds);
    const [rank] = await redis([["ZRANK", bKey, pid]]);
    return res.status(200).json({ on: true, best: isBest, rank: rank == null ? null : Number(rank) + 1 });
  } catch {
    return res.status(200).json({ on: false });
  }
}
