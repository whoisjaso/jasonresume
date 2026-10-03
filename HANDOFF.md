# Handoff

For whoever opens this repository next, on Jason's MacBook or anywhere else: this is the whole picture. What the company is, what the site is for, what has been built, where it stands on 2026-10-01, where it is going, and the rules that make it hold together. Read it once end to end. Then CLAUDE.md is the short version for a working session, CONFIG.md is the switchboard, RESEARCH.md is the evidence, OUTREACH.md is the voice, tools/README.md is the machinery.

## 1. Who and what

**Jason Obawemimo.** Pearland, Texas. Resume title (September 2026): AI Engineer, Business Systems and Sales Intelligence. His work starts with a process audit. Founder of Obavia since September 2024 (previously Apohenia). Co-owner and operator of Triple J Auto Investment, a used-vehicle dealership at 8774 Almeda Genoa Rd, Houston, open Monday to Saturday 9 to 7, in-house financing, sell and trade valuations, registration and title support. Co-owner and operator since August 2024: he runs daily operations (intake, pricing, inventory, scheduling, vendors), negotiates prices and financing, and built Handle a Sale, the sale desk Triple J closes on, plus software for a former rental operation. The phone number on his own resume never goes on the site; the site's PDF is rendered from resume-pdf.html without it. Associate of Arts in Business, San Jacinto College, May 2026, GPA 3.63, Dean's Honor List. Pursuing a bachelor's in neuroscience, expected 2027. Nineteen completed Anthropic courses. Email jobawems@gmail.com. LinkedIn, GitHub (whoisjaso), Instagram (0bawemimo, his surname with a zero for the first letter). Calendly: https://calendly.com/jason-apohenia/30min, a thirty-minute call, Central time (the URL still carries the old name and cannot be changed from here).

**Obavia (https://obavia.co).** The company Jason founded in September 2024. Its product carries the same name, **Obavia**: a dealership sale desk in development for Texas independent dealers. Tagline: "Every sale, start to signed." It takes a sale from the car to the last signature: pick the car, take the buyer's details, work out the money and print the paperwork in the dealer's name, then the buyer signs at the desk. One question per screen. Cash, buy here pay here and bank financing; Texas sales tax, title, registration and the dealer's doc fee on every deal; the bill of sale and Form 130-U filled from the deal; rebuilt and salvage disclosures; forms that need ink print for ink. It grew out of Handle a Sale and is being built on Triple J's floor. Text it to sign, Reach (Facebook Marketplace posting from the salesperson's phone, after the dealer accepts the terms) and dealer websites are in development, not live. No price is published; early access is a conversation at /obavia.html#early, not an account. The source of truth for the product is the whoisjaso/obavia repository. The earlier agency product (setters and closers, Core at $3,000 a month, the waitlist, the two vertical ads) is retired from the site; OUTREACH.md is paused. Film: assets/film/obavia-desk.mp4 (42 s), cut from real Obavia screens. Spelled O-B-A-V-I-A.

**Handle a Sale.** Triple J's sale desk (repository whoisjaso/thetriplejauto, Remotion composition `SaleDesk` in remotion/src/sale-desk.ts). One plain question at a time, scan the license once and every form fills itself, the registration math, the right documents with nothing missing and nothing extra, English or Spanish, e-sign on the phone or in person, every sale on file. The 82-second demo film is assets/film/triple-j-sale-desk.mp4, rendered at 1440x810 and transcoded to 720p.

**Apohenia** is Obavia's earlier name (2024, apohenia.com, Deal Packet Checker for Texas dealers). It is gone from the visible site. The answers layer carries one "earlier project" line so that searches for it resolve honestly, and the guide mentions it only if asked.

**What we stand for.** Specificity and restraint. Say exactly what the product does and does not do, in the words a dealer or an interviewer uses. Authority comes from being the person who runs a dealership and builds the systems it runs on, not from volume, adjectives, or borrowed proof. Native and quiet: gold on lacquer, iOS motion, nothing that shouts.

**The claims boundary, which governs every sentence on the site, in the guide, in the emails, in the outreach, and in the films.** Obavia is in development and not live. Never claim dealers using it, customers, results, a percentage or an outcome. Text it to sign, Reach and websites are not live. People and figures in demos and films are fictional and say so near them. No price is published; never quote one. Early access grants no account and no access. If pushed, the answer is: it is being built on a real lot, and the honest next step is early access or a call.

## 2. What the site is for

jasonobawemimo.com is three things at once, and every screen has to know which one it is serving.

1. **A proof of work for interviewers and recruiters.** They have seen a thousand AI-written applications and decide in ten seconds. The first frame is the verdict: face, name, one line, four facts, and the actions (Resume, Proof, Talk, Check me) above the fold on a phone, with nothing in front of them. Then the site proves it: they run the desk Jason built, flip through the resume as a deck, and open every claim's source.
2. **A product page for dealers.** /obavia.html is built like an app page: the icon, Obavia, Early access; an at-a-glance strip; the film and the Obavia screens; the desk you can run; what it does and what is not live; three free paperwork lessons; early access; the calendar.
3. **The hiring page is retired.** /join and /join.html redirect to /obavia.html (vercel.json). Jason is not hiring publicly.

Lurkers are the third audience: they get the trailer, the desk to play and the stories, and they are counted (anonymously, first party) so Jason can see who is warm.

## 3. What "visuals" and "optimizing for user experience" mean here

**Visuals** mean a committed world, and since 2026-10-03 that world is the dash: black dash leather (#131211) with cognac stitching, ivory gauge faces, one signal-red needle (#e8553b) for the one thing that matters, brushed chrome, tell-tale lamps in their real colors, a CarPlay screen, and brass only on the badge (the paragraph below describes the earlier theater it replaced: lacquer #0a0d0b, gold #c9a642 for the one thing that matters, ivory #efe8d8, #c9c2b2 for secondary, #252724 for edges, panels #101512), Cormorant Garamond and Hanken Grotesk, grain and vignette. Cinematic grammar: title cards, cuts through black, letterbox bars, line masks on headings, hand-drawn gold ink. And iOS is the whole structure now, because Jason's philosophy is iOS: the home page is an App Store Today screen (large title, widgets, story cards that grow into the screen with drag-down to close, a tab bar), the Obavia page is an app product page with a get bar, a Dynamic Island that confirms actions (window.JG_TOAST), notification banners (JG_NOTIFY), spring curves and press-scale on every button, sheets with a grabber that drag down to dismiss, grouped lists like Settings, squircle app icons with the real Triple J, Obavia and stack logos, and the desk inside an iPhone frame. Surfaces stay opaque: CLAUDE.md bans glassmorphism, so the island and sheets are solid. The anti-list (RESEARCH.md, section 2): Inter, gradient text, glassmorphism, three equal cards, emoji icons, em dashes, AI-sounding copy.

**Optimizing for user experience** means, in order: orientation (the verdict first, Escape closes, Skip is everywhere, the page behind a sheet never scrolls), tactility (sound, haptic and motion fire in the same frame on choices, arrivals, sends and unlocks; skips and cancels are silent), pace (one idea per screen, nothing plays on its own), honesty (Do Not Track and Global Privacy Control mean nothing is sent; every fact is in llms.txt; fallbacks work without keys).

## 4. What is built and live

Production is `main`, deployed by Vercel to jasonobawemimo.com. SPEC.md is the build spec for this version ("The Screening").

**The onboarding (intro.js, words in tools/site/onboarding.json, styles in home.css and the ignition skin in dash.css).** The portrait sits inside a tachometer bezel; tapping starts the engine: the needle sweeps, a synthesized starter chugs and catches (Web Audio, no file), and the dash's gauges sweep with it. Every visitor, every arrival, on the home page and /obavia.html; only crawlers and clicks between the site's own pages skip it (assemble_home.py syncs its head script and data into obavia.html). On the Obavia page the dealer's cut ends on early access on that page, and the form takes the name given. A returning visitor who gives the same name gets "Welcome back", and a deep link (#present, #verify, #story-, ?cut=) opens once it ends instead of the trailer. The portrait under live water with a gold ring that fills as the page loads, your name rising in masks, then "Tap anywhere to begin". The tap splashes and sends a gold shockwave; the portrait shrinks to an avatar over "What brings you here?" with three rows (I'm hiring, I run a dealership, Just looking; keys 1 to 3); then "And your name?" with Continue and Skip side by side; then a title card ("Okay, Dana.") and the reel.

**The reel (reel.js, styles at the end of home.css).** A trailer cut per visitor, about thirty seconds, built to be a pattern interrupt. The score is synthesized live in the browser (Web Audio: kick, bass, hats, claps, a pad, booms, risers, glitches; no audio files) at 112 BPM, and every cut restarts the bar so the downbeat lands with the picture. Type slams in word by word on the half beat, with a camera shake and a flash on the big hits; a live oscilloscope runs along the bottom and a timecode in the corner. Live data: Houston's clock to the second and whether Triple J is open by its posted hours. Interactive beats: hold to scan the sample license (four forms stamp in), tap the words that matter in the fictional buyer's sentence, hit the drum. The screening cut opens on the visitor's name, then "You've read the AI-written resumes. So don't read mine. Watch it run." The dealer cut walks a sale through the six steps of the desk and ends on early access. The fun cut proves the music is live. Every cut ends on the next move; leaving lands on the profile card, or opens the desk or Obavia story. Tap or the right arrow skips ahead; the cut chips replay it. iPhones play it with the ringer switch off because sounds.js asks for audio playback mode. Copy lives in cuts() at the top of reel.js; every line must already be in llms.txt.

**Home page (index.html, generated by tools/site/assemble_home.py from tools/site/home.head.html, home.body.html and record.json).** The dash: the instrument cluster of a car (dash.css, dash.js, desk-app.js). The direction contract sits in the HTML comment at the top of the body. In order:

- **The cluster.** A stitched leather hood with two gauges (19 Anthropic courses, the 3.63 GPA; each links to its PDF) that sweep up to the stop at ignition and settle on the true value with a damped bounce, and the display between them: date and Houston time, portrait, name, the one line, the four facts. Under it the tell-tale lamps: Triple J (green when open by its posted hours), Obavia (amber, in development), the clock.
- **The console.** A CarPlay screen: the dock, four keys (Resume, Proof, Talk, Check me; above the fold on a phone) and the stories as app rows, plus the one-page PDF. Beside it, a phone on a dash mount running the desk (Handle a Sale as an iPhone app, fictional buyer, example figures). The onboarding and the trailer send interviewers here with the story id "drive".
- **Stories.** Cards with a Remotion film on top and the caption below; each opens to fill the screen (#story-id, Escape, back or drag down to close): the desk and its 82-second film, Obavia, Triple J, the record, your cut (replays the trailer), Check me.
- **Next move and credits.** Email, Book 30 minutes, copy the address.
- **Tab bar** on phones only; on wide screens the CarPlay dock does the job.
- **Overlays.** The resume as a keyboard deck (#present/N) and the Check me drawer. Keys: R deck, V Check me, P the desk, T your cut, ? help.

**Films (Remotion, tools/film/src/dash).** One theme (dash/theme.ts), shared parts (dash/parts.tsx: the cabin with its passing streetlight and stitched seam, the gauge, the lamp, the odometer, word reveals, grade, grain and vignette) and six compositions in dash/films.tsx: DashDesk (Handle a Sale on a phone set into the dash), DashRecord, DashObavia, DashLot, DashCut and the share cards OgHome and OgObavia. `cd tools/film && sh render-dash.sh` renders them into assets/film (muted loops, about ten seconds) and the cards into assets; convert the posters to JPEG as the script notes. They loop through black, so the card players can loop them.

**Modules.** tokens.css (base system), home.css (shared components, the intro and the reel), dash.css (the dash world: tokens that re-skin everything to the needle red, the cluster, lamps, CarPlay, mount, story cards and sheets, the iPhone app, the ignition and trailer skins), dash.js (Houston time and the lot lamp, the gauges and the ignition sweep, story cards, keys), desk-app.js (the desk, shared with /obavia.html), chrome.js (FX, toggles, island, banners, menus, sheets, deep links, keys), intro.js, reel.js, deck.js, verify.js, track.js, sounds.js, haptics.js. The Obavia page loads dash.css, dash.js and desk-app.js too, plus briefing.css and pages.js.

**Sound and haptics.** sounds.js plays real Mixkit recordings, only after a gesture. haptics.js: Vibration API on Android, the switch-toggle haptic on iOS 17.4+. One mute toggle, persisted.

**The desk (api/lead.js).** Early access for dealers: name, email, dealership, city, what they use today, sales a month, how buyers pay, a note. Records the person, drafts a pre-call brief under the Obavia boundary, emails Jason through Resend, falls back to mailto without keys. api/apply.js and the hiring page are gone.

**Analytics.** track.js batches events to /api/track (first party, sendBeacon), which drops everything under DNT or GPC, filters bots, allowlists event names and counts anything dropped, then relays to PostHog. UTM and ?r=code outreach links are captured and stripped from the address bar. Every section reports its on-screen time. /admin.html is the Dailies board over /api/metrics: who said hello (names from the intro, with the date), one cached HogQL pull, a warmth score per visitor that halves every two weeks (Hot at 40 or any terminal action, Warm at 15), an inferred audience, journeys per audience, attention per section, sources, questions asked, and the notes dealers left.

**Resume.** resume-pdf.html, rendered to assets/Jason_Obawemimo_Resume_2026.pdf by tools/verify/resume.mjs, one page, only verified facts. Bump the `?v=` on every link when it changes.

**Answers layer (AEO, GEO, SEO).** llms.txt, llms-full.txt, jason-obawemimo.md, answers.json, .well-known/, faq.jsonld, schema.json, answers.html, the knowledge card, credentials and mentions pages, sitemaps, feed. The home page's JSON-LD is generated from schema.json and faq.jsonld, so change those and re-run the assembly.

**Outreach desk.** OUTREACH.md is the voice and the rules. A weekly Routine drafts posts for approval as a draft PR. It never posts. Human approves every send.

## 5. Where the work stands

The Screening rebuild replaced the loader, gate, guide character and cloned voice on the home page. Those files (guide.js, guide.css, cinema.css, pages.css, assets/guide) are retired; assets/voice and tools/voice stay for a future voiced commentary.

**Switched off until keys exist (CONFIG.md has every variable):**

- Tracking: POSTHOG_KEY. Dailies: ADMIN_TOKEN, POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID, optional REF_CODES.
- Ask box and desk drafts: OPENROUTER_API_KEY, GROQ_API_KEY or GEMINI_API_KEY. Without one the ask box offers email.
- Desk emails: RESEND_API_KEY, RESEND_FROM.

**Known limits.**

- The outreach Routine runs without connectors; recreate it from the claude.ai Routines page to attach Gmail and Composio.
- The Facebook Meta Ads, Era Context and Inkbox connectors need authorization before use.
- The Calendly URL still carries the old name (jason-apohenia).

## 6. Direction

1. **Play it on a phone with sound on.** Start it, run a sale on the mounted phone, open a story, open the deck, open Check me, replay your cut. Tune the dash in today.css and today.js, the trailer in reel.js.
2. **The voice.** Jason is recording a reference clip for a cloned voice over the trailer. It goes in tools/voice as ref.wav, which is gitignored and never committed.
3. **Keys in Vercel,** then read the Dailies every morning. Send outreach links as `?r=code` and name the codes in REF_CODES.
4. **A Calendly event under the Obavia name,** then swap the URL everywhere (grep for calendly).
5. **Obavia's own evidence, when there is some.** Until it is live, nothing may imply results.
6. **The Mac.** Film, voice and verification run faster there (tools/README.md).

**What not to do.** Keep the onboarding to one question and one optional name, skippable at every step. It plays on every visit by Jason's choice. No chatbot that talks first. No autoplay sound. No streaks, badges or points. Do not widen the claims. No third-person bio. No phone number or street address for Jason.

## 7. Working on it

**Run.** `python3 -m http.server 8765` at the repo root. For `api/`, `npx vercel dev` with the project's environment.

**Verify.** `node tools/verify/screening.mjs` (home, desktop and mobile: the intro and trailer, profile actions above the fold, live widgets, the desk story opened and run to Filed and closed cleanly, the Obavia tab, deck, Check me, lock release, no overflow, no dashes, no percent signs) and `node tools/verify/briefing.mjs` (/obavia: header above the fold, film, the desk to Filed, lessons, the early-access form, the get bar) before every push.

**Ship.** Commit plainly. Push the working branch, open a PR, merge, confirm live with curl, ping IndexNow when the answers layer changed, reset the working branch onto main.

**Change a fact.** tools/site/record.json and home.body.html (then assemble), api/guide.js, llms.txt, llms-full.txt, jason-obawemimo.md, answers.json, .well-known/ai-answers.json, faq.jsonld, schema.json, answers.html, resume-pdf.html.

**Write copy.** Second person for the reader's situation, first person for what Jason did. Contractions. Specific nouns. No "solutions", "leverage", "seamless", "elevate", "unlock". No tidy groups of three. No "it's not X, it's Y". No em dashes. No emoji.

## 8. File map

| Path | What it is |
|---|---|
| index.html | Generated. Edit tools/site/home.body.html or record.json and run tools/site/assemble_home.py |
| tokens.css, home.css | Design system with the iOS layer; the home page scenes and overlays |
| intro.js, reel.js | The first-visit intro (tap to begin, the question, the name) and the reel, a cut per visitor |
| dash.css, dash.js, desk-app.js | The dash: cluster, gauges and ignition, lamps, CarPlay, story cards; the desk as an iPhone app |
| tools/film/src/dash, tools/film/render-dash.sh | The Remotion films and share cards for the dash |
| chrome.js, deck.js, verify.js | Chrome and FX, the resume deck, Check me |
| track.js, api/track.js, api/metrics.js, admin.html | Tracker, relay, metrics, the Dailies board |
| sounds.js, haptics.js, assets/sfx | Sound and touch |
| obavia.html, briefing.css, pages.js | The Obavia app page |
| api/guide.js, api/lead.js, api/_lib | Ask box and the early-access desk |
| proof.css | The proof pages (credentials, answers, profile, knowledge card, mentions, honor, search) in the home page's world: bar with a back chevron, grouped link lists, answer cards |
| resume-pdf.html, assets/Jason_Obawemimo_Resume_2026.pdf | The resume and its PDF |
| assets/film, assets/brand | Films and posters; real Triple J, Obavia and stack logos |
| llms.txt, llms-full.txt, answers.json, faq.jsonld, schema.json, .well-known/ | The answers layer |
| SPEC.md, CONFIG.md, RESEARCH.md, OUTREACH.md | The spec, the switchboard, the research, the outreach voice |

## 9. If something breaks

- **No sound.** Nothing has been pressed yet, or the mute toggle is on (localStorage jg_muted).
- **Something visible that should be hidden.** tokens.css forces `[hidden]` and closed dialogs to display none; check the element uses `hidden`, not a class.
- **Ask box says email me.** No model key (503) or the free tier is spent (429).
- **Dailies says not wired.** The listed variables are missing in Vercel.
- **Page scrolls behind a sheet.** The surface did not call window.JG_LOCK on open and close.
- **Overflow on mobile.** A grid child without min-width 0, or a long button; screening.mjs reports it.
