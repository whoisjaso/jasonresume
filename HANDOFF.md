# Handoff

For whoever opens this repository next, on Jason's MacBook or anywhere else: this is the whole picture. What the company is, what the site is for, what has been built, where it stands on 2026-09-05, where it is going, and the rules that make it hold together. Read it once end to end. Then CLAUDE.md is the short version for a working session, CONFIG.md is the switchboard, RESEARCH.md is the evidence, OUTREACH.md is the voice, tools/README.md is the machinery.

## 1. Who and what

**Jason Obawemimo.** Pearland, Texas. Co-owner and operator of Triple J Auto Investment, a used-vehicle dealership at 8774 Almeda Genoa Rd, Houston, open Monday to Saturday 9 to 7, in-house financing, sell and trade valuations, registration and title support. He runs pricing, customer intake, scheduling, payments, follow-up, and the title and registration workload. Founder of Apohenia. Associate of Arts in Business, San Jacinto College, May 2026, GPA 3.63, Dean's Honor List. Pursuing a bachelor's in neuroscience, expected 2027. Nineteen completed Anthropic courses. Email jobawems@gmail.com. LinkedIn, GitHub (whoisjaso), Instagram (0bawemimo, his surname with a zero for the first letter). Calendly: https://calendly.com/jason-apohenia/30min, a thirty-minute outbound call, Central time.

**Apohenia.** Founded 2024. The control layer between a constructed car deal and a clean county submission: no deal leaves until the evidence agrees. First product, Deal Packet Checker: a packet-readiness review for Texas independent dealers that checks the deal jacket against current webDEALER requirements before the dealer files, cross-checks the documents against each other, and hands the title clerk a short list to review. Findings are reported as prevalence, by how often they show up. A human clerk decides. Status: in build, run on Triple J's own packets first, founding waitlist, a few Texas pilot places. Sequence after that: a compliance graph underneath, then DealDesk for constructing the deal, then a managed network of licensed title services. Target: the roughly 9,000 to 15,000 Texas independents under thirty deals a month who cannot justify a title clerk. Spelled A-P-O-H-E-N-I-A, distinct from the psychology term apophenia. Site: https://apohenia.com. Its own headline is "Registration is a bitch." That is the register.

**What we stand for.** Specificity and restraint. Say exactly what the product does and does not do, in the words a dealer uses on a Tuesday. Authority comes from being the person who runs a lot and built the thing that fixes the paperwork he fights with, not from volume, adjectives, or borrowed proof. Clean, professional, transparent. Opulent in the sense of a well-made object: quiet materials, gold on lacquer, nothing that shouts.

**The claims boundary, which governs every sentence on the site, in the guide, in the emails, in the outreach, and in the film.** Never say the checker catches, prevents or reduces rejections. Never quote a percentage. Never borrow a case study or testimonial. Never show a real customer's packet. Never imply affiliation with TxDMV, webDEALER, or any county office. No approval guarantee. If pushed, the answer is: the evidence is being gathered on our own lot first and will be published as prevalence, not as a promise.

## 2. What the site is for

jasonobawemimo.com is three things at once, and every screen has to know which one it is serving.

1. **A proof of work for interviewers and recruiters.** A screener decides in ten seconds and the failure is not knowing what the person does. The first line of the resume and the first line of the hero both say it. The site itself is the work sample: he built it.
2. **A landing page for business partners,** meaning Texas independent dealers who might take a pilot place. They watch ninety seconds in Jason's own voice, then book directly on his calendar. No form between the film and the calendar. No rep.
3. **A door for people who want to work with him,** closers and appointment setters, and a plain answer for anyone (or any AI) asking who he is.

The visitor picks which of these they are at the gate, and the guide, an animated Jason with seven expressions and his own cloned voice, walks them to the parts that matter for them. That guide is the novelty, and the rule for it is Portal's rule: the whole thing is a tutorial and the visitor should never notice.

## 3. What "visuals" and "optimizing for user experience" mean here

These words get used loosely. On this project they mean something specific.

**Visuals** mean a committed world, not decoration. The world is The Vault: lacquer black (#0a0d0b), gold (#c9a642, #e6c964), ivory (#efe8d8), emerald (#2f8f6b), Cormorant Garamond for display, Hanken Grotesk for everything else, grain and vignette over the whole page, ink annotations drawn by hand in SVG. Every element either belongs to that world or is removed. Research on what reads as vibe-coded (RESEARCH.md, section 2) gives the anti-list: Inter, purple-to-blue gradients, glassmorphism, rounded-everything, three-card feature rows, emoji as icons, em dashes, the same writing voice as every other AI site. None of those are allowed to appear.

**Optimizing for user experience** means four things in this order:

- **Orientation.** At every moment the visitor knows what this screen is, what it wants from them, and how to leave. Skip is everywhere. Escape closes. The menu is a J and two dashes on every width. The page behind a modal never scrolls (iOS-safe screen lock).
- **Tactility.** A choice should feel like something in the hand. Sound, haptic and ink fire in the same frame on choices, arrivals, sends and unlocks. Skips and cancels are silent, which is the other half of the signal. Repeats vary in pitch so nothing sounds like a machine.
- **Pace.** One idea per screen. Sixty words or fewer per guide line. The teacher camera moves to the exact spot and underlines it rather than making the visitor hunt. One surprise at the end, not ten.
- **Honesty.** Nothing sent anywhere without saying so. Nothing tracked when Do Not Track is set. Every fact verified. Fallbacks that still work when a key is missing.

**What "novel" means.** Not effects for their own sake. The novelty is that the site is a person talking to you in his own voice, reading your role, and taking you where you need to go. Everything else supports that or gets cut. The Codex, the HUD, the chapter cards and the dust all got cut for that reason.

## 4. What is built and live

Production is `main`, deployed by Vercel to jasonobawemimo.com. As of 2026-09-05 everything below is live.

**Arrival.** A loader with a water simulation over Jason's portrait (canvas, two height fields), real water-drop samples under the ripple, a synthesized water bed underneath. The loader counts to 100, then waits with "Tap anywhere to enter" until the first touch, because browsers keep audio silent until then; visitors whose browser already allows sound are not held. Then a splash and a swoosh, the signature film (Remotion, his name in Cormorant, gold rule, "Founder of Apohenia"), and the question.

**The gate.** Interviewer, business partner, or lurker. Then "what is your name?" with Continue and Skip side by side. Name is stored locally and used in the greeting and the end screen.

**The guide.** A card with the illustrated face (calm, warm, attentive, serious, surprised, laugh, wink), the line in text and in Jason's cloned voice, and the visitor's replies also voiced. Teacher mode scrolls the page to the anchor and draws ink (underline, circle, box, strike) on the exact phrase. Scripts per role live in guide.js SCRIPTS, written in his voice and humanized. Behind the script, a live chat mode calls `/api/guide`, which runs a free-model chain (OpenRouter free models, Groq, Gemini, optional Anthropic) with a system prompt that carries the facts and the claims boundary. End screen with role-specific calls to action; the partner path leads to booking.

**Sound.** Two engines. guide.js synthesizes glass tones in D pentatonic (tick, select, chime, open, close, stage, arrive) and the water bed. sounds.js plays eighteen real recordings from Mixkit's free license (drops, splash, three swooshes, a click, laptop keys, a sparkle, a soft chime), decoded at idle, pitch-varied, throttled, sharing one AudioContext with the synth. One mute toggle silences both and persists. Credits and cut points are in assets/sfx/CREDITS.md and tools/sfx/process.py.

**Haptics.** haptics.js: Vibration API on Android, the switch-toggle haptic on iOS 17.4+, patterns for tap, select, arrive, success, unlock, heart.

**Home page.** Hero, thesis, the Apohenia section (problem, what it does, what it will not claim, where this is going, facts), Triple J, proof of work with the live laptop film, capabilities, credentials, intake (three taps that write an email), contact with LinkedIn, GitHub, Instagram.

**Partners page (`/partners`).** The film: fifty-six seconds, seven lines in his cloned voice, the illustrated face per line, words revealed at reading pace, captions as WebVTT, poster. Under it the Calendly event embedded inline, loaded when scrolled near. An optional pre-call note that goes to `/api/lead`. The claims boundary stated plainly. A booking inside the embed fires the unlock moment.

**Hiring page (`/join`).** Where the appointments come from (this site, the outreach desk, his network, Triple J's counter), the two roles, how pay works (structure stated, numbers given in writing before any work; no numbers were invented), the application with one story field, `/api/apply`. JobPosting structured data for both roles.

**The desks (`api/lead.js`, `api/apply.js`).** Record the person in PostHog, ask the free-model chain for a pre-call brief or a screening read (labeled as a read, never a decision), email Jason through Resend with reply-to set to the sender, and with a verified sender write back to the dealer or applicant in his voice. Without keys, the page shows a mailto fallback, nothing is lost.

**Analytics and admin.** guide.js and pages.js batch events to `/api/track`, which relays to PostHog server-side (the key never ships to the browser, Do Not Track honored). `/admin.html` is a token-gated, noindex board over `/api/metrics` (HogQL).

**Resume.** resume-pdf.html rendered to assets/Jason_Obawemimo_Resume_2026.pdf by tools/verify/resume.mjs, one page, role line under the name for the ten-second test, numbers only where real.

**Answers layer (AEO, GEO, SEO).** llms.txt, llms-full.txt, jason-obawemimo.md, answers.json, .well-known/ai-answers.json, faq.jsonld, schema.json, answers.html, the knowledge card and credentials pages, sitemaps (with a video entry), feed, IndexNow key. All carry the same canon: who he is, what Apohenia is, its direction, the claims boundary, how to book, that he is hiring. Change a fact in every one of them or in none.

**Outreach desk.** OUTREACH.md is the voice and the rules. A weekly Routine fires Monday 7 am Central, researches the last thirty days in the dealer and title niche, drafts the week's LinkedIn, Reddit, Facebook group, X and video-outline set in his voice under the claims boundary, and opens a draft PR for approval. It never posts. Human approves every send.

## 5. Where the work stands

Shipped and confirmed on production: PRs #7 through #13. Nothing is uncommitted. The working branch `claude/website-redesign-imagery-5py41u` tracks `main`.

**Switched off until keys exist (CONFIG.md has every variable and where to get it):**

- Live chat: OPENROUTER_API_KEY (free), or GROQ_API_KEY, or GEMINI_API_KEY. Until then the guide stays scripted, which still works.
- Tracking: POSTHOG_KEY. Admin: ADMIN_TOKEN, POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID.
- Desk emails: RESEND_API_KEY; confirmations to dealers and applicants need RESEND_FROM on a verified apohenia.com sender. NOTIFY_TO defaults to jobawems@gmail.com.

**Verified by machine, not by ear.** Every voice clip, the film, and every sound were checked by duration, waveform, file presence and browser playback, not listened to. The first thing to do on the Mac is open the site with sound on and walk the whole path. If a clip is loud, long, early or late, each has its own gain and delay in sounds.js and guide.js.

**Known limits.**

- The outreach Routine runs without connectors (the org does not allow them on Routines), so it researches through web search and delivers as a PR. Recreate it from the claude.ai Routines page to attach Gmail and Composio.
- X returned nothing in research (API credits gone). Facebook groups have no posting API. Most subreddits ban self-promotion, so Reddit drafts carry no product mention until asked.
- The Facebook Meta Ads connector needs authorization before it can be used.
- Kenney's CC0 sound packs were reviewed and not used (game-UI timbre); they remain a fallback source. Sonniss GDC bundles are worth mining on a machine with disk.

## 6. Direction

In order. Each one is a round: research if the answer could have changed, build, verify on desktop and mobile, ship, confirm live.

1. **Listen and tune.** Walk the site with sound on. Adjust gains and delays. Re-render any voice line that reads wrong (tools/voice).
2. **Keys in Vercel.** Turn on chat, tracking, the desks. Then watch the admin board for a week: where people drop, which role they pick, whether the film plays through, whether the calendar gets used.
3. **The evidence.** As Triple J's packets go through the checker, publish prevalence findings on the Apohenia section and in the answers layer, as prevalence, never as a promise. This is the only kind of proof the boundary allows and it is the strongest kind.
4. **Outreach with connectors.** Recreate the Routine with Gmail and Composio attached so drafts arrive as Gmail drafts with real research links. Keep every send human-approved.
5. **Hiring in motion.** The first closer sits in on Jason's calls. Publish the pay numbers to that person in writing, never on the page.
6. **The Mac.** Local Claude Code can drive a real browser, run Remotion and the voice clone at full speed, and use computer-use automation; the proxy limits that shaped some choices here are gone. Move the film rendering, the voice rendering and the verification to the Mac (tools/README.md), and keep the cloud session for research and routines.
7. **Later, only if the numbers ask for it.** A Spanish version of the partner page for Houston lots. A short film per role at the gate. The DealDesk story once the checker has evidence.

**What not to do.** Do not add a loyalty system, streaks, badges, or points; the research on games says novelty wears off and the fans mislead you. Do not add a chatbot bubble that talks first. Do not widen the claims. Do not add a third-person bio. Do not buy followers or automate posting. Do not put a phone number or a street address for Jason on the site.

## 7. Working on it

**Run.** `python3 -m http.server 8765` at the repo root, open http://127.0.0.1:8765/. For the `api/` functions, `npx vercel dev` with the project's environment.

**Verify.** tools/verify, both desktop and mobile, before every push: no horizontal overflow, no page errors, no em dashes, the loader holds and releases, the guide line renders, the screen lock engages on the loader and gate and releases on the guide, the new pages' forms fall back cleanly.

**Ship.** Commit with a plain message that says what changed and why. Push the working branch, open a PR against main, merge, confirm the change is live with curl, ping IndexNow (key file is in the repo root) when the answers layer changed, then reset the working branch onto main.

**Change a fact.** index.html, the guide's FACTS in guide.js and the system prompt in api/guide.js, llms.txt, llms-full.txt, jason-obawemimo.md, answers.json, .well-known/ai-answers.json, faq.jsonld, schema.json, answers.html, and the resume if it touches him. Re-render any voice line that changed.

**Write copy.** Second person for the reader's situation, first person for what Jason did. Contractions. Specific nouns: deal jacket, webDEALER, title clerk, county return, GDN. No "solutions", "leverage", "seamless", "streamline", "elevate", "game-changer", "unlock". No tidy groups of three. No "it's not X, it's Y". No em dashes. No emoji. Vary sentence length. Read it aloud; if it sounds like a brochure, rewrite it.

**Design a new surface.** Decide which of the three jobs it serves (section 2). Pick its mode: persuade, operate, read, or experience. Use the Vault tokens in site.css. Build it, screenshot desktop and mobile once, fix everything the screenshots show in one pass, confirm once, stop polishing.

## 8. File map

| Path | What it is |
|---|---|
| index.html, site.css, site.js | The home page, its styles, scroll feel, reveals, menu, intake, tracking hooks |
| guide.css, guide.js | Loader, films, gate, name step, guide card, teacher camera and ink, synth sound, voice playback, chat, end screen, analytics batching |
| sounds.js, assets/sfx | Sample bank engine and the eighteen clips |
| haptics.js | Touch feedback |
| partners.html, join.html, pages.css, pages.js | The partner and hiring pages, the film player, the calendar, the desks' front end |
| api/guide.js, api/lead.js, api/apply.js, api/_lib | Live chat and the two desks; shared model chain and mail/analytics helpers |
| api/track.js, api/metrics.js, admin.html | Analytics relay and the admin board |
| resume-pdf.html, resume-pdf.css, assets/Jason_Obawemimo_Resume_2026.pdf | The resume and its PDF |
| assets/voice, assets/guide, assets/film | Voice clips and manifest, the seven faces, the three films |
| llms.txt, llms-full.txt, answers.json, faq.jsonld, schema.json, .well-known/ | The answers layer |
| CONFIG.md | Every environment variable |
| RESEARCH.md | The anecdotal research and the decisions taken from it |
| OUTREACH.md | The outreach voice, cadence, and rules |
| tools/ | Film, voice, VSL, sound and verification machinery, portable |
| vercel.json | Redirects (www, clean URLs), headers, cache rules |

## 9. If something breaks

- **No sound at all.** The visitor has not touched the page yet, or the mute toggle is on (stored in localStorage as jg_muted). The loader hold exists for exactly this.
- **Guide line has no voice.** Its id is missing from assets/voice/manifest.json. Run tools/voice/extract2.py and render the missing ids.
- **Chat returns 503.** No model key. 429: the free tier is exhausted for the day; the scripted guide still works.
- **Desk says "did not go through".** The API is unreachable or rate-limited; the page offers the mailto link. With no RESEND_API_KEY the form still returns 200 and shows the fallback.
- **Calendar does not load.** Calendly's script is blocked (content blocker) or offline; the fallback link under it opens the event in a new tab.
- **Mobile page scrolls behind a modal.** The screen lock (`window.JG_LOCK`) was not called for that surface; every full-screen surface must lock on open and unlock on close.
- **Overflow on mobile.** Usually a grid with a bare text node, a long unbreakable string, or the nav links. tools/verify/overflow.mjs names the element.
