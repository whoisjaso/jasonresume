# Handoff

For whoever opens this repository next, on Jason's MacBook or anywhere else: this is the whole picture. What the company is, what the site is for, what has been built, where it stands on 2026-09-30, where it is going, and the rules that make it hold together. Read it once end to end. Then CLAUDE.md is the short version for a working session, CONFIG.md is the switchboard, RESEARCH.md is the evidence, OUTREACH.md is the voice, tools/README.md is the machinery.

## 1. Who and what

**Jason Obawemimo.** Pearland, Texas. Resume title (September 2026): AI Engineer, Business Systems and Sales Intelligence. His work starts with a process audit. Founder of Obavia since September 2024 (previously Apohenia). Co-owner and operator of Triple J Auto Investment, a used-vehicle dealership at 8774 Almeda Genoa Rd, Houston, open Monday to Saturday 9 to 7, in-house financing, sell and trade valuations, registration and title support. Co-owner and operator since August 2024: he runs daily operations (intake, pricing, inventory, scheduling, vendors), negotiates prices and financing, and built Handle a Sale, the sale desk Triple J closes on, plus software for a former rental operation. The phone number on his own resume never goes on the site; the site's PDF is rendered from resume-pdf.html without it. Associate of Arts in Business, San Jacinto College, May 2026, GPA 3.63, Dean's Honor List. Pursuing a bachelor's in neuroscience, expected 2027. Nineteen completed Anthropic courses. Email jobawems@gmail.com. LinkedIn, GitHub (whoisjaso), Instagram (0bawemimo, his surname with a zero for the first letter). Calendly: https://calendly.com/jason-apohenia/30min, a thirty-minute call, Central time (the URL still carries the old name and cannot be changed from here).

**Obavia (https://obavia.co).** Sales operating software, in development, for agency owners generating $100K to $1M a month and their own setters and closers. Tagline: "Hear what clients really mean. Carry it from the first call to collected cash." Six stages: Capture (the inquiry becomes a lead), Connect (one owner, the buyer's exact words), Book (a call with a clear purpose), Discover (fit, from what actually happened), Agree (the buyer's words reach the closer), Collect (cash, counted when verified). It works inside the agency's own funnel, SOPs and vocabulary. The method is conversation psychology: inspect the buyer's exact words, consider what they reveal, ask a question that uses them. Owners see progress ranked on collected cash, not calls. Prelaunch pricing: Core planned at $3,000 a month (10 active sellers, 5,000 pooled meeting minutes); Scale ($6,000) and Enterprise (custom) proposed; implementation a one-time $5,000. Free waitlist at https://obavia.co/waitlist, which grants no access. Two vertical ad films, "The closer" (33 s) and "The owner" (34 s), from https://5ab678eb.obavia.pages.dev/ads, now in assets/film. Spelled O-B-A-V-I-A.

**Handle a Sale.** Triple J's sale desk (repository whoisjaso/thetriplejauto, Remotion composition `SaleDesk` in remotion/src/sale-desk.ts). One plain question at a time, scan the license once and every form fills itself, the registration math, the right documents with nothing missing and nothing extra, English or Spanish, e-sign on the phone or in person, every sale on file. The 82-second demo film is assets/film/triple-j-sale-desk.mp4, rendered at 1440x810 and transcoded to 720p.

**Apohenia** is Obavia's earlier name (2024, apohenia.com, Deal Packet Checker for Texas dealers). It is gone from the visible site. The answers layer carries one "earlier project" line so that searches for it resolve honestly, and the guide mentions it only if asked.

**What we stand for.** Specificity and restraint. Say exactly what the product does and does not do, in the words an agency owner or a closer uses on a call. Authority comes from being the person who runs a sales floor and a dealership and builds the systems they run on, not from volume, adjectives, or borrowed proof. Cinematic, but quiet: gold on lacquer, film light, nothing that shouts.

**The claims boundary, which governs every sentence on the site, in the guide, in the emails, in the outreach, and in the films.** Obavia is in development and not live. Never claim customers, results, a conversion rate, a percentage, or an outcome. Zoom, Calendly, GoHighLevel, HubSpot, Slack, Zapier, Google Calendar and Cal.com are planned connection targets, not active integrations. People and figures in demos and ads are fictional and say so near them. Only Core's price is planned; the rest is proposed. The waitlist grants no access. If pushed, the answer is: it is being built, and the honest next step is the waitlist or a call.

## 2. What the site is for

jasonobawemimo.com is three things at once, and every screen has to know which one it is serving.

1. **A proof of work for interviewers and recruiters.** They have seen a thousand AI-written applications and decide in ten seconds. The first frame is the verdict: face, name, one line, four facts, and the actions (Resume, Proof, Talk, Check me) above the fold on a phone, with nothing in front of them. Then the site proves it: they run the desk Jason built, flip through the resume as a deck, and open every claim's source.
2. **A landing page for business partners,** agency owners at $100K to $1M a month. /obavia.html: the two films, three lessons they play (Handoff, Leak finder, What counts), prelaunch pricing, and the calendar.
3. **A door for people who want to work with him,** setters and closers, at /join.html, which opens with Rewrite the Note.

Lurkers are the fourth audience: they get the films, the trailer, the water portrait and a forward kit, and they are counted (anonymously, first party) so Jason can see who is warm.

## 3. What "visuals" and "optimizing for user experience" mean here

**Visuals** mean a committed world. A dark theater (lacquer #0a0d0b, gold #c9a642 for the one thing that matters, ivory #efe8d8, #c9c2b2 for secondary, #252724 for edges, panels #101512), Cormorant Garamond and Hanken Grotesk, grain and vignette. Cinematic grammar: title cards, cuts through black, letterbox bars, line masks on headings, hand-drawn gold ink. And an iOS layer on top, because Jason's philosophy is iOS: a Dynamic Island that confirms actions (window.JG_TOAST), notification banners (JG_NOTIFY), spring curves and press-scale on every button, sheets with a grabber that drag down to dismiss, grouped lists like Settings, squircle app icons with the real Triple J, Obavia and stack logos, and the desk inside an iPhone frame. Surfaces stay opaque: CLAUDE.md bans glassmorphism, so the island and sheets are solid. The anti-list (RESEARCH.md, section 2): Inter, gradient text, glassmorphism, three equal cards, emoji icons, em dashes, AI-sounding copy.

**Optimizing for user experience** means, in order: orientation (the verdict first, Escape closes, Skip is everywhere, the page behind a sheet never scrolls), tactility (sound, haptic and motion fire in the same frame on choices, arrivals, sends and unlocks; skips and cancels are silent), pace (one idea per screen, nothing plays on its own), honesty (Do Not Track and Global Privacy Control mean nothing is sent; every fact is in llms.txt; fallbacks work without keys).

## 4. What is built and live

Production is `main`, deployed by Vercel to jasonobawemimo.com. SPEC.md is the build spec for this version ("The Screening").

**Home page (index.html, generated by tools/site/assemble_home.py from tools/site/home.head.html, home.body.html and record.json).** In order:

- **The Slate.** Portrait, name in line masks, the one line, four rows (Obavia, Triple J, Pearland, Education), actions, the one-page PDF, and cut chips (screening, agency owner, trailer) that jump the visitor to their cut.
- **The desk.** A title card, then Handle a Sale inside an iPhone frame: how the buyer pays, who files, hold to scan a (sample) license and watch four forms fill, the registration math, a Spanish flip, a signature, and the file. Fictional buyer, fictional figures, labeled. Finishing it fires the unlock, a notification banner, and the reveal (Triple J's real photo, address and hours).
- **The film.** Handle a Sale's demo film, plays only on press, with chapters and a transcript.
- **The record.** Entries with app icons and proof chips, the tools as a logo stack, nineteen courses.
- **Obavia.** A title card, Mark the Words (tap the words that matter in a fictional buyer's sentence, then see Jason's), the six stages on a thread, a link to the briefing.
- **Questions.** Three questions to ask Jason, collected into an email or copied.
- **The rig.** The colophon, an overlay that tags every scene with its live clock, and the cue sheet in plain words.
- **Next move, credits (Check me as a grouped list), the water portrait** (a canvas ripple on demand) with a forward kit.
- **Overlays.** The resume as a keyboard deck (#present/N), the Check me drawer (every proof, plus an ask box that uses /api/guide), a hold-to-roll trailer, keyboard help (?), commentary captions (opt-in).

**Modules.** tokens.css (design system and iOS layer), home.css (scenes), chrome.js (FX, toggles, island, banners, menus, sheets, deep links, keys), desk.js, deck.js, verify.js, games.js (Mark the Words, Handoff, Leaks, Counts, Rewrite the Note), extras.js (films, rig, cues, trailer, water, forward kit, commentary), cinema.js (the projector, window.JG_PROJECTOR), track.js, sounds.js, haptics.js. Obavia and hiring pages add briefing.css and pages.js.

**Sound and haptics.** sounds.js plays real Mixkit recordings, only after a gesture. haptics.js: Vibration API on Android, the switch-toggle haptic on iOS 17.4+. One mute toggle, persisted.

**The desks (api/lead.js, api/apply.js).** Record the person, draft a pre-call brief or screening read under the Obavia boundary, email Jason through Resend, fall back to mailto without keys.

**Analytics.** track.js batches events to /api/track (first party, sendBeacon), which drops everything under DNT or GPC, filters bots, allowlists event names and counts anything dropped, then relays to PostHog. UTM and ?r=code outreach links are captured and stripped from the address bar. Every section reports its on-screen time. /admin.html is the Dailies board over /api/metrics: one cached HogQL pull, a warmth score per visitor that halves every two weeks (Hot at 40 or any terminal action, Warm at 15), an inferred audience, journeys per audience, attention per section, sources, questions asked, and the leaks agency owners named.

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

1. **Play it on a phone with sound on.** Run the desk, open the deck, open Check me, roll the trailer. Tune timings in home.css and cue points in home.body.html.
2. **Keys in Vercel,** then read the Dailies every morning. Send outreach links as `?r=code` and name the codes in REF_CODES.
3. **A Calendly event under the Obavia name,** then swap the URL everywhere (grep for calendly).
4. **Obavia's own evidence, when there is some.** Until it is live, nothing may imply results.
5. **The Mac.** Film, voice and verification run faster there (tools/README.md).

**What not to do.** No loader or gate in front of the verdict. No chatbot that talks first. No autoplay sound. No streaks, badges or points. Do not widen the claims. No third-person bio. No phone number or street address for Jason.

## 7. Working on it

**Run.** `python3 -m http.server 8765` at the repo root. For `api/`, `npx vercel dev` with the project's environment.

**Verify.** `node tools/verify/screening.mjs` (home, desktop and mobile: Slate actions above the fold, the desk end to end, deck, Check me, trailer, lock release, no overflow, no dashes, no percent signs) and `node tools/verify/briefing.mjs` (/obavia and /join) before every push.

**Ship.** Commit plainly. Push the working branch, open a PR, merge, confirm live with curl, ping IndexNow when the answers layer changed, reset the working branch onto main.

**Change a fact.** tools/site/record.json and home.body.html (then assemble), api/guide.js, llms.txt, llms-full.txt, jason-obawemimo.md, answers.json, .well-known/ai-answers.json, faq.jsonld, schema.json, answers.html, resume-pdf.html.

**Write copy.** Second person for the reader's situation, first person for what Jason did. Contractions. Specific nouns. No "solutions", "leverage", "seamless", "elevate", "unlock". No tidy groups of three. No "it's not X, it's Y". No em dashes. No emoji.

## 8. File map

| Path | What it is |
|---|---|
| index.html | Generated. Edit tools/site/home.body.html or record.json and run tools/site/assemble_home.py |
| tokens.css, home.css | Design system with the iOS layer; the home page scenes and overlays |
| chrome.js, desk.js, deck.js, verify.js, games.js, extras.js, cinema.js | Chrome and FX, the desk game, the resume deck, Check me, the games, films and extras, the projector |
| track.js, api/track.js, api/metrics.js, admin.html | Tracker, relay, metrics, the Dailies board |
| sounds.js, haptics.js, assets/sfx | Sound and touch |
| obavia.html, join.html, briefing.css, pages.js | The Obavia briefing and hiring pages |
| api/guide.js, api/lead.js, api/apply.js, api/_lib | Ask box and the two desks |
| site.css, site.js | Used only by the answers, credentials, knowledge card and mentions pages |
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
