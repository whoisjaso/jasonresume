# Handoff

For whoever opens this repository next, on Jason's MacBook or anywhere else: this is the whole picture. What the company is, what the site is for, what has been built, where it stands on 2026-09-25, where it is going, and the rules that make it hold together. Read it once end to end. Then CLAUDE.md is the short version for a working session, CONFIG.md is the switchboard, RESEARCH.md is the evidence, OUTREACH.md is the voice, tools/README.md is the machinery.

## 1. Who and what

**Jason Obawemimo.** Pearland, Texas. Founder of Obavia. Co-owner and operator of Triple J Auto Investment, a used-vehicle dealership at 8774 Almeda Genoa Rd, Houston, open Monday to Saturday 9 to 7, in-house financing, sell and trade valuations, registration and title support. He runs pricing, customer intake, scheduling, payments, follow-up, and the title and registration workload, and he built Handle a Sale, the sale desk Triple J closes on. Associate of Arts in Business, San Jacinto College, May 2026, GPA 3.63, Dean's Honor List. Pursuing a bachelor's in neuroscience, expected 2027. Nineteen completed Anthropic courses. Email jobawems@gmail.com. LinkedIn, GitHub (whoisjaso), Instagram (0bawemimo, his surname with a zero for the first letter). Calendly: https://calendly.com/jason-apohenia/30min, a thirty-minute call, Central time (the URL still carries the old name and cannot be changed from here).

**Obavia (https://obavia.co).** Sales operating software, in development, for agency owners generating $100K to $1M a month and their own setters and closers. Tagline: "Hear what clients really mean. Carry it from the first call to collected cash." Six stages: Capture (the inquiry becomes a lead), Connect (one owner, the buyer's exact words), Book (a call with a clear purpose), Discover (fit, from what actually happened), Agree (the buyer's words reach the closer), Collect (cash, counted when verified). It works inside the agency's own funnel, SOPs and vocabulary. The method is conversation psychology: inspect the buyer's exact words, consider what they reveal, ask a question that uses them. Owners see progress ranked on collected cash, not calls. Prelaunch pricing: Core planned at $3,000 a month (10 active sellers, 5,000 pooled meeting minutes); Scale ($6,000) and Enterprise (custom) proposed; implementation a one-time $5,000. Free waitlist at https://obavia.co/waitlist, which grants no access. Two vertical ad films, "The closer" (33 s) and "The owner" (34 s), from https://5ab678eb.obavia.pages.dev/ads, now in assets/film. Spelled O-B-A-V-I-A.

**Handle a Sale.** Triple J's sale desk (repository whoisjaso/thetriplejauto, Remotion composition `SaleDesk` in remotion/src/sale-desk.ts). One plain question at a time, scan the license once and every form fills itself, the registration math, the right documents with nothing missing and nothing extra, English or Spanish, e-sign on the phone or in person, every sale on file. The 82-second demo film is assets/film/triple-j-sale-desk.mp4, rendered at 1440x810 and transcoded to 720p.

**Apohenia** is an earlier project (2024, apohenia.com, Deal Packet Checker for Texas dealers). It is gone from the visible site. The answers layer carries one "earlier project" line so that searches for it resolve honestly, and the guide mentions it only if asked.

**What we stand for.** Specificity and restraint. Say exactly what the product does and does not do, in the words an agency owner or a closer uses on a call. Authority comes from being the person who runs a sales floor and a dealership and builds the systems they run on, not from volume, adjectives, or borrowed proof. Cinematic, but quiet: gold on lacquer, film light, nothing that shouts.

**The claims boundary, which governs every sentence on the site, in the guide, in the emails, in the outreach, and in the films.** Obavia is in development and not live. Never claim customers, results, a conversion rate, a percentage, or an outcome. Zoom, Calendly, GoHighLevel, HubSpot, Slack, Zapier, Google Calendar and Cal.com are planned connection targets, not active integrations. People and figures in demos and ads are fictional and say so near them. Only Core's price is planned; the rest is proposed. The waitlist grants no access. If pushed, the answer is: it is being built, and the honest next step is the waitlist or a call.

## 2. What the site is for

jasonobawemimo.com is three things at once, and every screen has to know which one it is serving.

1. **A proof of work for interviewers and recruiters.** A screener decides in ten seconds and the failure is not knowing what the person does. The first line of the resume and the first line of the hero both say it. The site itself is the work sample: he built it, and it plays like a film.
2. **A landing page for business partners,** meaning agency owners at $100K to $1M a month. They watch the two Obavia films, see the loop and the prelaunch pricing on /obavia.html, then join the waitlist or book directly on his calendar. No rep.
3. **A door for people who want to work with him,** setters and closers who will sell Obavia to agency owners, and a plain answer for anyone (or any AI) asking who he is.

The visitor picks which of these they are at the gate, and the guide, an animated Jason with seven expressions and his own cloned voice, walks them to the parts that matter for them. That guide is the novelty, and the rule for it is Portal's rule: the whole thing is a tutorial and the visitor should never notice.

## 3. What "visuals" and "optimizing for user experience" mean here

These words get used loosely. On this project they mean something specific.

**Visuals** mean a committed world, not decoration. The world is a dark theater: lacquer black (#0a0d0b, deeper #060807 behind films), gold (#c9a642) for the one thing that matters on screen, ivory (#efe8d8) for type, #c9c2b2 for secondary text and links, #252724 for edges. Cormorant Garamond for display (h1 up to 96px, h2 up to 64px), Hanken Grotesk at 15px for body, a 12px base unit, pill buttons (primary gold on lacquer, secondary #101512 with a #252724 edge), grain and vignette over everything, ink annotations drawn by hand in SVG. The home page is a film in reels: letterbox bars open when the loader ends, pinned scenes hold still while the story plays, words brighten as you scroll, films play only while on screen. Research on what reads as vibe-coded (RESEARCH.md, section 2) gives the anti-list: Inter, purple-to-blue gradients, gradient text, glassmorphism, three-card feature rows, emoji as icons, em dashes, the same writing voice as every other AI site. None of those are allowed to appear.

**Optimizing for user experience** means four things in this order:

- **Orientation.** At every moment the visitor knows what this screen is, what it wants from them, and how to leave. Skip is everywhere. Escape closes. The menu is a J and two dashes on every width. The page behind a modal never scrolls (iOS-safe screen lock).
- **Tactility.** A choice should feel like something in the hand. Sound, haptic and ink fire in the same frame on choices, arrivals, sends and unlocks. Skips and cancels are silent, which is the other half of the signal. Repeats vary in pitch so nothing sounds like a machine.
- **Pace.** One idea per screen. Sixty words or fewer per guide line. The teacher camera moves to the exact spot and underlines it rather than making the visitor hunt. One surprise at the end, not ten.
- **Honesty.** Nothing sent anywhere without saying so. Nothing tracked when Do Not Track is set. Every fact verified. Fallbacks that still work when a key is missing.

**What "novel" means.** Not effects for their own sake. The novelty is that the site is a person talking to you in his own voice, reading your role, and taking you where you need to go. Everything else supports that or gets cut. The Codex, the HUD, the chapter cards and the dust all got cut for that reason.

## 4. What is built and live

Production is `main`, deployed by Vercel to jasonobawemimo.com.

**Arrival.** A loader with a water simulation over Jason's portrait (canvas, two height fields), real water-drop samples under the ripple, a synthesized water bed underneath. The loader counts to 100, then waits with "Tap anywhere to enter" until the first touch, because browsers keep audio silent until then. Then a splash and a swoosh, the signature film (Remotion, his name in Cormorant, gold rule, "Founder of Obavia"), and the question.

**The gate.** Interviewer, business partner, or lurker. Then "what is your name?" with Continue and Skip side by side.

**The guide.** A card with the illustrated face (calm, warm, attentive, serious, surprised, laugh, wink), the line in text and in Jason's cloned voice, and the visitor's replies also voiced. Teacher mode scrolls the page to the anchor and draws ink on the exact phrase. An anchor written `#scene@0.4` lands a pinned scene at that point of its story. Scripts per role live in guide.js SCRIPTS. Behind the script, a live chat mode calls `/api/guide` (free-model chain) with the facts and the claims boundary. End screen with role-specific calls to action: resume for interviewers, the calendar and the waitlist for partners, the films for lurkers.

**The projector (cinema.js, cinema.css).** Drives the home page. `data-scene="lead|pass|pin"` gives a section a clock; `data-cue="a,b[,c,d]"` gives an element its own entrance and exit on that clock; `data-words` brightens a line word by word; `data-pan` slides a pinned track sideways; `data-fire` plays a quiet swoosh the first time a cue lands; `video[data-src]` loads late and plays only in view; `[data-unmute]` buttons give one film sound at a time. One requestAnimationFrame loop that runs only while a scene is on screen. Reduced motion sets every clock to its finished state and nothing pins.

**Home page (index.html, built by tools/site/assemble_home.py from tools/site/home.body.html).** The opening title over the portrait plate; Obavia as a pinned reel (the line, the mark, the two phone films rising in); the listening scene (one buyer sentence, ink on the words he chose); the loop, six stages panning sideways on a gold thread; Handle a Sale, the Triple J film growing from a frame into the full screen and settling; the lot; the record as credits; nineteen courses in a marquee; plain facts; the intake (three taps that write an email about where your sales floor leaks); the finale and a credits roll.

**Sound.** Two engines. guide.js synthesizes glass tones and the water bed. sounds.js plays eighteen real recordings from Mixkit's free license, decoded at idle, pitch-varied, throttled. The projector borrows the swoosh for scene arrivals. One mute toggle silences both and persists.

**Haptics.** haptics.js: Vibration API on Android, the switch-toggle haptic on iOS 17.4+.

**Obavia page (`/obavia.html`; `/partners` and `/partners.html` redirect here).** The two films as phones with sound buttons, the listening scene, the loop, prelaunch pricing with what is planned and what is proposed, the Calendly event inline, an optional pre-call note to `/api/lead`, and what will not be claimed.

**Hiring page (`/join`).** Setters and closers for Obavia: where the conversations come from (the Obavia page, the waitlist, the outreach desk), the two roles, how pay works (numbers in writing before any work; none published), the application with one story field, `/api/apply`. JobPosting structured data for both roles.

**The desks (`api/lead.js`, `api/apply.js`).** Record the person in PostHog, ask the free-model chain for a pre-call brief or a screening read under the Obavia boundary, email Jason through Resend with reply-to set to the sender, and with a verified sender write back in his voice. Without keys, the page shows a mailto fallback.

**Analytics and admin.** guide.js and pages.js batch events to `/api/track`, which relays to PostHog server-side. `/admin.html` is a token-gated board over `/api/metrics`.

**Resume.** resume-pdf.html rendered to assets/Jason_Obawemimo_Resume_2026.pdf by tools/verify/resume.mjs, one page, "Founder, Obavia" under the name.

**Answers layer (AEO, GEO, SEO).** llms.txt, llms-full.txt, jason-obawemimo.md, answers.json, .well-known/, faq.jsonld, schema.json, answers.html, the knowledge card, credentials and mentions pages, sitemaps with the three film entries, feed. All carry the same canon. The home page's JSON-LD is generated from schema.json and faq.jsonld by the assembly script, so change those and re-run it.

**Outreach desk.** OUTREACH.md is the voice and the rules, now aimed at agency owners and their setters and closers. A weekly Routine drafts the week's posts for approval as a draft PR. It never posts. Human approves every send.

## 5. Where the work stands

Shipped through PR #15 (the cinematic Obavia revamp). The working branch `claude/website-redesign-imagery-5py41u` tracks `main`.

**Switched off until keys exist (CONFIG.md has every variable and where to get it):**

- Live chat: OPENROUTER_API_KEY (free), or GROQ_API_KEY, or GEMINI_API_KEY. Until then the guide stays scripted, which still works.
- Tracking: POSTHOG_KEY. Admin: ADMIN_TOKEN, POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID.
- Desk emails: RESEND_API_KEY; confirmations to owners and applicants need RESEND_FROM on a verified sender domain (obavia.co once it is verified in Resend). NOTIFY_TO defaults to jobawems@gmail.com.

**Verified by machine, not by ear.** Every voice clip, the films, and every sound were checked by duration, waveform, file presence and browser playback, not listened to. The first thing to do on the Mac is open the site with sound on and walk the whole path. If a clip is loud, long, early or late, each has its own gain and delay in sounds.js and guide.js.

**Known limits.**

- The outreach Routine runs without connectors (the org does not allow them on Routines), so it researches through web search and delivers as a PR. Recreate it from the claude.ai Routines page to attach Gmail and Composio.
- X returned nothing in research (API credits gone). Facebook groups have no posting API. Most subreddits ban self-promotion, so Reddit drafts carry no product mention until asked.
- The Facebook Meta Ads connector needs authorization before it can be used.
- Kenney's CC0 sound packs were reviewed and not used (game-UI timbre); they remain a fallback source. Sonniss GDC bundles are worth mining on a machine with disk.

## 6. Direction

In order. Each one is a round: research if the answer could have changed, build, verify on desktop and mobile, ship, confirm live.

1. **Watch it with sound on.** Scroll the home page top to bottom on a phone and a laptop. Tune the scene lengths (the `height` of each pinned scene in cinema.css) and the cue points in tools/site/home.body.html until nothing feels rushed or held too long. Re-render any voice line that reads wrong.
2. **Keys in Vercel.** Turn on chat, tracking, the desks. Then watch the admin board: which role people pick, how far they scroll, whether the films get sound, whether the calendar and the waitlist get used.
3. **A Calendly event under the Obavia name,** then swap the URL everywhere it appears (grep for calendly).
4. **Obavia's own evidence, when there is some.** Until Obavia is live, nothing on the site may imply results. When it is, publish what is true and dated, and update every answers-layer file at once.
5. **Hiring in motion.** The first closer sits in on Jason's calls. Pay numbers go to that person in writing, never on the page.
6. **The Mac.** Local Claude Code can run Remotion and the voice clone at full speed. Move film, voice and verification there (tools/README.md).

**What not to do.** Do not add a loyalty system, streaks, badges, or points; the research on games says novelty wears off and the fans mislead you. Do not add a chatbot bubble that talks first. Do not widen the claims. Do not say Obavia is live. Do not add a third-person bio. Do not buy followers or automate posting. Do not put a phone number or a street address for Jason on the site.

## 7. Working on it

**Run.** `python3 -m http.server 8765` at the repo root, open http://127.0.0.1:8765/. For the `api/` functions, `npx vercel dev` with the project's environment.

**Verify.** tools/verify (cinema.mjs for the home page scenes, pages.mjs for /obavia and /join), both desktop and mobile, before every push: no horizontal overflow, no page errors, no em dashes, the loader holds and releases, the guide line renders, the screen lock engages on the loader and gate and releases on the guide, the new pages' forms fall back cleanly.

**Ship.** Commit with a plain message that says what changed and why. Push the working branch, open a PR against main, merge, confirm the change is live with curl, ping IndexNow (key file is in the repo root) when the answers layer changed, then reset the working branch onto main.

**Change a fact.** tools/site/home.body.html (then run tools/site/assemble_home.py), the guide's FACTS in guide.js and the system prompt in api/guide.js, llms.txt, llms-full.txt, jason-obawemimo.md, answers.json, .well-known/ai-answers.json, faq.jsonld, schema.json, answers.html, and the resume if it touches him. Re-render any voice line that changed.

**Write copy.** Second person for the reader's situation, first person for what Jason did. Contractions. Specific nouns: setter, closer, the handoff, no-show, collected cash, the buyer's exact words. No "solutions", "leverage", "seamless", "streamline", "elevate", "game-changer", "unlock". No tidy groups of three. No "it's not X, it's Y". No em dashes. No emoji. Vary sentence length. Read it aloud; if it sounds like a brochure, rewrite it.

**Design a new surface.** Decide which of the three jobs it serves (section 2). Pick its mode: persuade, operate, read, or experience. Use the Vault tokens in site.css. Build it, screenshot desktop and mobile once, fix everything the screenshots show in one pass, confirm once, stop polishing.

## 8. File map

| Path | What it is |
|---|---|
| index.html | Generated. Do not edit by hand; edit tools/site/home.body.html and run tools/site/assemble_home.py |
| cinema.js, cinema.css | The projector: scenes, cues, word scrub, pans, films, letterbox |
| site.css, site.js | Tokens, buttons, nav, menu, reveals, the intake |
| guide.css, guide.js | Loader, signature film, gate, name step, guide card, teacher camera and ink, synth sound, voice playback, chat, end screen, analytics batching |
| sounds.js, assets/sfx | Sample bank engine and the eighteen clips |
| haptics.js | Touch feedback |
| obavia.html, join.html, pages.css, pages.js | The Obavia and hiring pages, the calendar, the desks' front end |
| api/guide.js, api/lead.js, api/apply.js, api/_lib | Live chat and the two desks; shared model chain and mail/analytics helpers |
| api/track.js, api/metrics.js, admin.html | Analytics relay and the admin board |
| resume-pdf.html, resume-pdf.css, assets/Jason_Obawemimo_Resume_2026.pdf | The resume and its PDF |
| assets/film | obavia-closer, obavia-owner, triple-j-sale-desk (with posters), signature and signature-portrait |
| assets/brand | The Obavia mark, recolored gold and ivory, and the original |
| assets/voice, assets/guide | Voice clips and manifest, the seven faces |
| llms.txt, llms-full.txt, answers.json, faq.jsonld, schema.json, .well-known/ | The answers layer |
| CONFIG.md | Every environment variable |
| RESEARCH.md, OUTREACH.md | The research and the outreach voice |
| tools/ | Site assembly, film, voice, sound and verification machinery |
| vercel.json | Redirects (www, clean URLs, /partners to /obavia.html), headers, cache rules |

## 9. If something breaks

- **No sound at all.** The visitor has not touched the page yet, or the mute toggle is on (stored in localStorage as jg_muted). The loader hold exists for exactly this.
- **Guide line has no voice.** Its id is missing from assets/voice/manifest.json. Run tools/voice/extract2.py and render the missing ids.
- **Chat returns 503.** No model key. 429: the free tier is exhausted for the day; the scripted guide still works.
- **Desk says "did not go through".** The API is unreachable or rate-limited; the page offers the mailto link. With no RESEND_API_KEY the form still returns 200 and shows the fallback.
- **Calendar does not load.** Calendly's script is blocked (content blocker) or offline; the fallback link under it opens the event in a new tab.
- **Mobile page scrolls behind a modal.** The screen lock (`window.JG_LOCK`) was not called for that surface; every full-screen surface must lock on open and unlock on close.
- **Overflow on mobile.** Usually a grid with a bare text node, a long unbreakable string, or the nav links. tools/verify/overflow.mjs names the element.
