# Configuration

Everything on jasonobawemimo.com works with no configuration at all: the guide
is scripted, the voice is pre-rendered, nothing is tracked. Each feature below
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
PostHog directly and the key never ships to the client. Visitors who type a
name become identified people in PostHog with `name` and `role` set.

## Admin page (`/admin.html`)

| Variable | Where to get it |
|---|---|
| `ADMIN_TOKEN` | any long random string; the page asks for it once per browser |
| `POSTHOG_PERSONAL_API_KEY` | PostHog, Settings, Personal API keys (`phx_...`), scope `query:read` |
| `POSTHOG_PROJECT_ID` | the number in the PostHog project URL |
| `POSTHOG_API_HOST` | optional, default `https://us.posthog.com` |

The page is `noindex`, disallowed in robots.txt, and returns nothing without
the token.
