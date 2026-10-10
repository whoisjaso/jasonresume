# Configuration

Everything on jasonobawemimo.com works with no configuration at all: the ask
box offers email, the desks fall back to mailto, nothing is tracked. Each feature below
switches on when its environment variable exists in the Vercel project
(Settings, Environment Variables, then redeploy).

## Live chat (free models, rotated)

| Variable | Where to get it | Notes |
|---|---|---|
| `OPENROUTER_API_KEY` | openrouter.ai, Keys | Free models. 50 requests a day and 20 a minute on a fresh account; a one-time purchase of $10 in credits lifts the daily cap to 1,000 for good. |
| `GROQ_API_KEY` | console.groq.com | Free tier, no card. gpt-oss-120b at 1,000 requests a day. |
| `GEMINI_API_KEY` | aistudio.google.com | Free tier, no card. Gemini 2.5 Flash at 250 requests a day. |
| `ANTHROPIC_API_KEY` | console.anthropic.com | Optional paid path. When present it runs first. |
| `LLM_ORDER` | optional | Comma list to reorder providers, default `anthropic,openrouter,groq,gemini`. |
| `OPENROUTER_MODELS` | optional | Comma list to override the free rotation. Default: `nvidia/nemotron-3-ultra-550b-a55b:free, minimax/minimax-m3:free, z-ai/glm-5.2:free, nvidia/nemotron-3-super-120b-a12b:free, google/gemma-4-31b-it:free, openrouter/free`. |

Any one key is enough. With more than one, a failure or quota hit on the first
falls through to the next inside the same request.

## Tracking (PostHog)

| Variable | Where to get it |
|---|---|
| `POSTHOG_KEY` | PostHog project, Settings, Project API key (`phc_...`) |
| `POSTHOG_HOST` | optional, default `https://us.i.posthog.com` (use `https://eu.i.posthog.com` for an EU project) |

Events are relayed through `/api/track`, so the browser never talks to
PostHog directly and the key never ships to the client. The relay sends
nothing when the request carries `Sec-GPC: 1` or `DNT: 1`, ignores obvious
bots, and drops unknown event names (counted as one `relay_dropped` event so
the Dailies can show them). In PostHog, turn on "Discard client IP data"
(Settings, Project) if you want city-level location without stored IPs; the
relay forwards the visitor IP only so PostHog can resolve the city.

## Obavia early-access desk (`/api/lead`)

The desk works with no configuration: the page shows a mailto fallback when
nothing is switched on. Each variable adds a layer. The hiring desk
(`/api/apply`) is retired.

| Variable | Where to get it | What it switches on |
|---|---|---|
| any model key above | see Live chat | The pre-call brief for each dealer, drafted by the free-model chain and included in the email to you. |
| `RESEND_API_KEY` | resend.com, API keys (free tier, no card) | The email to you. Without a verified sender it uses Resend's test sender, which can only reach the account owner's inbox. |
| `RESEND_FROM` | a sender on a domain verified in Resend, e.g. `Jason Obawemimo <jason@obavia.co>` | Confirmation emails to the dealer in your voice. Skipped until this exists, so nobody gets an email from a test address. |
| `NOTIFY_TO` | optional, default `jobawems@gmail.com` | Where desk emails land. |
| `POSTHOG_KEY` | see Tracking | Every early-access note also becomes an identified person in PostHog (`lead_note`). |

The calendar on `/obavia.html` is Calendly's inline embed of
`https://calendly.com/jason-apohenia/30min` and needs nothing here. A booking
made in the embed fires the page's unlock moment and flips the note form to
"booked".

## The run's community (`/api/run`)

After Hours: The Run (the platformer on the home page) plays the same with no
configuration: your own best time, your own ghost and every medal live in your
browser. With a store, three quiet things switch on: faint ghosts of other
players' recent best runs on the same level, a board per level and one for the
whole run (fastest time and medals, shown with a display name or "Player" and
the character's colours), and a line saying how many players have walked the
lot tonight, counted from real starts and hidden below two. Visitors with Do
Not Track or Global Privacy Control send nothing and fetch nothing; the pause
menu says so in one line.

| Variable | Where to get it | Notes |
|---|---|---|
| `KV_REST_API_URL` | Vercel, Storage, create an Upstash for Redis (KV) database and connect it to this project; Vercel adds it | Or `UPSTASH_REDIS_REST_URL` from console.upstash.com, a free Redis database, REST API section |
| `KV_REST_API_TOKEN` | added with the URL above | Or `UPSTASH_REDIS_REST_TOKEN`. The read-write token, not the read-only one |

Keys it writes: `run:b:<level>` (a sorted set of best times, top 200 kept),
`run:p:<level>` (display name, medals and character per player), `run:g:<level>`
(the 20 most recent best-run ghosts, ten position samples a second, capped at
1,200), `run:crew:<date>` (a HyperLogLog of tonight's players, expires after
three days) and `run:rl:<ip>` (a one-minute write counter, a dozen writes a
minute). Times outside a level's plausible bounds, oversized bodies (48 KB) and
ghosts whose samples disagree with their time are refused. The only free text
is the display name: letters, digits and spaces, sixteen at most, through a
blocklist, else "Player". It never touches the Supabase databases.

## Admin page (`/admin.html`)

| Variable | Where to get it |
|---|---|
| `ADMIN_TOKEN` | any long random string; the page asks for it once per browser |
| `POSTHOG_PERSONAL_API_KEY` | PostHog, Settings, Personal API keys (`phx_...`), scope `query:read` |
| `POSTHOG_PROJECT_ID` | the number in the PostHog project URL |
| `POSTHOG_API_HOST` | optional, default `https://us.posthog.com` |
| `REF_CODES` | optional JSON, e.g. `{"k1": "Recruiter note, Sept"}`. Outreach links carry `?r=k1`; the Dailies shows the label. Kept server side. |

The page is `noindex`, disallowed in robots.txt, and returns nothing without
the token.
