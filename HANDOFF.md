# Handoff

For whoever opens this repository next, on Jason's MacBook or anywhere else: this is the whole picture. What the company is, what the site is for, what has been built, where it stands on 2026-10-09, where it is going, and the rules that make it hold together. Read it once end to end. Then CLAUDE.md is the short version for a working session, CONFIG.md is the switchboard, RESEARCH.md is the evidence, OUTREACH.md is the voice, tools/README.md is the machinery.

## 1. Who and what

**Jason Obawemimo.** Pearland, Texas. Resume title (October 2026): AI Implementation, Workflow Automation and CRM Systems. He owns and operates a Houston dealership and ships the CRM, voice AI and automation systems that run it. Owner and Operations Lead of Triple J Auto Investment and Rental Operations since August 2024, and its sole owner: a used-vehicle dealership at 8774 Almeda Genoa Rd, Houston, open Monday to Saturday 9 to 7, in-house financing, sell and trade valuations, registration and title support. He manages pricing, inventory, vendors, logistics, financing and title processing, and since June 2025 he has personally closed 53 vehicle sales and collected $206,777 in sale proceeds. The three systems he built there: the custom dealership CRM, whose sale desk is Handle a Sale (one system; TypeScript, React, Next.js, PostgreSQL, Supabase, Vercel, Edge Functions; used daily by three staff across inventory, deals and follow-up); inbound voice AI (Retell AI, Bland AI, Twilio, CRM webhooks) that books appointments into the CRM and live-transfers unresolved calls to staff, averaging 41 inbound calls, 14 booked appointments and 4 CRM-matched vehicle sales per month across August and September 2026 ($15,000 a month in sale proceeds; keep the word "CRM-matched", never say the voice AI caused the sales, never compute a rate from them); and a prospecting workflow (Python, Claude API, n8n, CRM webhooks) that researches Facebook Marketplace leads, writes findings to the CRM and generates SOP-based reply text for automatic follow-up (Triple J's live lead-research workflow, never Obavia's Reach). Founder of Obavia since September 2024, which now comes after the Triple J work, never as the headline. The phone number on his own resume never goes on the site; the site's PDF is rendered from resume-pdf.html without it. Bachelor of Science in Neuroscience, The University of Texas at Austin, expected 2028. Associate of Arts in Business, San Jacinto College, May 2026, GPA 3.63, Dean's Honor List. Google AI Essentials (Google, Coursera, 2026). Nineteen completed Anthropic courses. Email jobawems@gmail.com. LinkedIn (https://www.linkedin.com/in/obawemimo; the older jason-obawemimo-51a76120a URL stays only as an extra identity link), GitHub (whoisjaso), Instagram (0bawemimo, his surname with a zero for the first letter). Calendly: https://calendly.com/jason-apohenia/30min, a thirty-minute call, Central time (the URL still carries the old name and cannot be changed from here).

**Obavia (https://obavia.co).** The company Jason founded in September 2024. Its product carries the same name, **Obavia**: a dealership sale desk in development for Texas independent dealers. Tagline: "Every sale, start to signed." It takes a sale from the car to the last signature: pick the car, take the buyer's details, work out the money and print the paperwork in the dealer's name, then the buyer signs at the desk. One question per screen. Cash, buy here pay here and bank financing; Texas sales tax, title, registration and the dealer's doc fee on every deal; the bill of sale and Form 130-U filled from the deal; rebuilt and salvage disclosures; forms that need ink print for ink. It grew out of Handle a Sale, the sale desk in the CRM Jason built for Triple J, and is being built on Triple J's floor. Text it to sign, Reach (Facebook Marketplace posting from the salesperson's phone, after the dealer accepts the terms) and dealer websites are in development, not live. No price is published; early access is a conversation at /obavia.html#early, not an account. The source of truth for the product is the whoisjaso/obavia repository. The earlier agency product (setters and closers, the waitlist, the two vertical ads) is retired and never described as current; OUTREACH.md is paused. Film: assets/film/obavia-desk.mp4 (42 s), cut from real Obavia screens. Spelled O-B-A-V-I-A.

**Handle a Sale.** Triple J's sale desk, inside the custom dealership CRM Jason built for Triple J: the CRM and Handle a Sale are one system (repository whoisjaso/thetriplejauto, Remotion composition `SaleDesk` in remotion/src/sale-desk.ts). One plain question at a time, scan the license once and every form fills itself, the registration math, the right documents with nothing missing and nothing extra, English or Spanish, e-sign on the phone or in person, every sale on file. The 82-second demo film is assets/film/triple-j-sale-desk.mp4, rendered at 1440x810 and transcoded to 720p.

**Apohenia** is Obavia's earlier name (2024, apohenia.com, Deal Packet Checker for Texas dealers). It is gone from the visible site. The answers layer carries one line ("Apohenia is Obavia's earlier name") so that searches for it resolve honestly; it appears nowhere else.

**What we stand for.** Specificity and restraint. Say exactly what the product does and does not do, in the words a dealer or an interviewer uses. Authority comes from being the person who owns and runs a dealership and builds the systems it runs on, not from volume, adjectives, or borrowed proof. Native and quiet: gold on lacquer, iOS motion, nothing that shouts.

**The claims boundary, which governs every sentence on the site, in the guide, in the emails, in the outreach, and in the films.** Obavia is in development and not live. Never claim dealers using it, customers, results, a percentage or an outcome. Text it to sign, Reach and websites are not live. People and figures in demos and films are fictional and say so near them. No price is published; never quote one. Early access grants no account and no access. If pushed, the answer is: it is being built on a real lot, and the honest next step is early access or a call. The resume figures (53 vehicle sales, $206,777 in sale proceeds, the voice AI's monthly averages) are quoted exactly as written, never as a percentage or a rate.

## 2. What the site is for

jasonobawemimo.com is three things at once, and every screen has to know which one it is serving.

1. **A proof of work for interviewers and recruiters.** They have seen a thousand AI-written applications and decide in ten seconds. The first frame of the library is the verdict: name, title, Level 53 (one level per car sold since June 2025), the focused title's summary and its real numbers, and Resume and Email in the system bar on every screen. Then the site proves it: they open a title, run the desk Jason built, flip through the resume as a deck, and open every claim's source in Check me.
2. **A product page for dealers.** /obavia.html is Obavia's title page in the same world: the key art, Early access, the film, the desk you can run, what it does and what is not live, three free paperwork lessons, early access and the calendar.
3. **The hiring page is retired.** /join and /join.html redirect to /obavia.html (vercel.json). Jason is not hiring publicly.

Lurkers are the third audience: they get the library to play (titles, trophies, the score) and they are counted (anonymously, first party) so Jason can see who is warm.

## 3. What "visuals" and "optimizing for user experience" mean here

**Visuals** mean a committed world, and since 2026-10-09 that world is the After Hours Library: a flagship console's home screen after close, with Jason's career as the game library. Jason asked for it to feel completely like a game, luxurious, a AAA game menu, with music that sounds expensive. Ink #0A0F0D, lacquer #111B17, bottle green #1C3229 (from the suit in the headshot), bone #EDE7DB, ash #9A9890. There is no chromatic UI accent: the key art carries all the colour. Matte, opaque lacquer panels with one bone hairline; square tiles with a breathing bone focus ring; tracked Cormorant Garamond capitals for logotypes and numerals, Hanken Grotesk for everything else; minted metal medallions for trophies; full-bleed after-hours key art for every title, graded through one recipe (tools/art/grade.py). One ease everywhere: cubic-bezier(0.2, 0.7, 0.1, 1). The dash (2026-10-03) and the theater before it are retired. The anti-list (RESEARCH.md, section 2): Inter, gradient text, glassmorphism, three equal cards, emoji icons, em dashes, neon gamer HUDs, AI-sounding copy.

**Optimizing for user experience** means, in order: orientation (the verdict on the first frame, Escape and B go back, Skip is on the title screen, the page behind a screen never scrolls), tactility (sound, haptic and motion fire in the same frame on choices, arrivals, sends and unlocks; skips and cancels are silent), pace (one idea per screen, nothing plays before Start), honesty (every trophy is a verified fact; Do Not Track and Global Privacy Control mean nothing is sent; every fact is in llms.txt; fallbacks work without keys).

## 4. What is built and live

Production is `main`, deployed by Vercel to jasonobawemimo.com. SPEC.md is history: this section and the direction contract at the top of tools/site/home.body.html are current.

**The title screen (intro.js, words in tools/site/onboarding.json, styles in game.css).** Every visitor, every arrival, on the home page and /obavia.html; only crawlers and clicks between the site's own pages skip it (assemble_home.py syncs its head script and data into obavia.html, and the Obavia page shows Obavia's key art through body[data-intro-art]). The focused title's key art under Jason's name in Cormorant capitals, then "Press start". Start turns the score on with a start sting; Start muted plays nothing and fetches no audio. Then "Who's playing?" with three seats (interviewer, partner, lurker; keys 1 to 3, arrows, a gamepad). On the home page the seat leads to the build (below): "What are you hiring for?", "What's slowing your lot down?" or "Pick a class". Then "Sign your build" (or "Enter your name" when the build was skipped), then the card minting, or a welcome card ("Welcome back," for a returning name). The seat and the build reorder the library and focus the title they came for. A ?for=<role> link (for applications: ?for=it, ?for=ops, ?for=title and so on) highlights that role in the build step, and even when skipped the library, the Resume button and Player 2 read for that role. A deep link (#title/id, #trophies, #profile, #present/N, the legacy #story-* links, ?cut=) opens once it ends; ?cut=dealer goes to /obavia.html.

**Home page (index.html, generated by tools/site/assemble_home.py from tools/site/home.head.html, home.body.html, library.json and record.json).** The library (game.css, game.js, hud.js, score.js, desk-app.js, deck.js, verify.js):

- **The system bar.** Avatar, name and title, Level 53, the trophy count; Resume (the PDF), Email, Score on or off, Houston's clock.
- **The library row.** Six titles: Triple J Auto (the main campaign), Lead to Title (the dealership CRM and Handle a Sale), The Inbound (voice AI inbound), Prospector (the prospecting workflow), Neuroscience (UT Austin), and Obavia as a small side quest in development. Moving focus crossfades the full-bleed key art, moves the ring, scores the title's layer in on the next bar, and shows the title's logotype, role, summary, two stats and its trophies. Resting on a title wakes its key art (a living loop). Mouse hover after a beat, tap to focus then tap to open, arrows, Enter, a gamepad.
- **A title page.** Open makes the title its own page (#title/id; Escape, B or swipe down to close) with tabs (Q and E move between them): Overview, Film, Demo (the desk on an iPhone, fictional buyer, example figures), Trophies, Loadout (the stack).
- **Trophies.** 18, each a verified fact, in bronze, silver and gold; opening a career title for the first time awards its trophies with a toast and a sting, and opening every career title earns the platinum, Operator, with a level-clear sting. Seen trophies are remembered (localStorage jg_trophies). The trophies screen (#trophies, key T) lists all of them; the profile (#profile, key P) is the portrait, the bio and the links.
- **Overlays.** The resume as a keyboard deck (#present/N, key R) and the Check me drawer (key V). ? opens help.
- **No JavaScript.** Every title, trophy and fact is plain HTML in the page.

**Player 2: the build (build.js, build.css, tools/site/builds.json).** Jason asked (October 2026) that every visitor feel part of the build and leave with something personal they made, and that the site position him from every angle a role could need, value first rather than owner first, in the words job listings use, never fabricating. So the visitor builds him. One fact base, tools/site/builds.json, holds 37 proofs (each a first-person line already in llms.txt, with a short card line, a medal and listing keywords), nine readings of the record for roles (AI and Automation, Software and CRM, IT and Systems Support, Operations and Logistics, Title and Back Office, Sales and Phones, People and Office, Dealer Technology, Data and Databases; each with target job titles, a headline, a value-first summary, its proofs in order and the library order), six lot problems for dealers, and four finishes. The visitor picks a reading (or a lot problem, or a class, or Surprise me, or pastes a listing), signs it, and keeps it three ways: the card as a 1080 by 1350 PNG drawn on a canvas in the page (the share sheet on a phone, a download elsewhere), a link (#build/v1/<reading>/<proofs>/<backdrop>/<finish>/<name>) that rebuilds it for whoever opens it after the title screen, and for a role the one-page resume written for that job. Player 2 in the top bar (or J) opens the build screen: switch the reading, equip four proofs, pick a backdrop and a finish (bronze, then silver at six trophies seen, gold at twelve, platinum with the platinum trophy), sign it, match a pasted listing (match.js, read in the browser, never sent; terms on the record and terms not on it, never a score), and send it (api/lead.js, kind "build": a fixed summary to Jason, no model text, mailto fallback). The library reorders around the build, the Resume button serves that role's PDF, Email carries the build's link, and a dealer's paperwork problem carries into the Obavia early-access note. The readings and their target roles are in llms.txt as "Nine Ways To Read The Record", and plain HTML in the #build screen for readers without JavaScript. The Dailies show each visitor's build.

**After Hours: The Run (game-run.js, game-run.css, tools/site/run.json).** Jason asked (October 2026) for the trophies to be earnable in a real game, with ease of use above everything: a first-time visitor on a phone plays within seconds of pressing Play, with nothing to read first. So the record is a 2D platformer on one canvas in the library's world (night, rain, lamplight, bone line-art over the dimmed key art). Six short levels in record order, each built from its title: Neuroscience (the library at UT Austin; synapses that fire as bounce pads, an axon signal to ride; the first level teaches move, jump and the hidden medal by doing, one hint at a time), Triple J Auto (car roofs, keys, lamp posts as checkpoints, flooded gaps, the showroom), Lead to Title (filing cabinets and paper; one license scan fills every form and opens the door), The Inbound (phone wires, sound waves, call bubbles), Prospector (a field map; a pin reveals a hidden trail), and Obavia (scaffolding that builds itself as you near it, ending at a door that says early access is a conversation; no medals, in development). Each of the 17 medals sits in its own title's level (on the path, off it, hidden, or behind a skill jump), shows its trophy's fact as you run, and unlocks that same trophy (JG_GAME.unlock, localStorage jg_trophies), so the library, the trophies screen and the platinum agree; all 17 earns Operator with its own celebration. Clearing a level marks its tile in the library. Fictional characters talk while you run (a professor, a night porter, a buyer, a caller and the voice agent, a seller, a dealer) in stock Kokoro voices with word-timed captions; my lines are first person and play in my own voice once rendered (tools/voice/run_jason_lines.json, assets/voice/run/jason-<id>.mp3), captions until then; the pause menu discloses both. A tap skips a line silently. Controls: arrows or WASD, Space (hold for height), Shift to run, Esc or P to pause, a gamepad; on a phone sideways a stick where the thumb lands and a jump button, upright the game plays at once with a turn suggestion and the controls below. Pause: Continue, Restart, Levels (cleared plus the next), Character (play as me, or build your own: skin, hair, outfit, glasses), Boards (when a store exists), Skip to the resume, Quit to the library; Timer, Ghosts, Score and Keep a clip toggles. Streamable: a small timer with run splits and local bests, a share card (1080 by 1350, Web Share or download, with a ?run=<level> link that drops a friend straight into that level), and on browsers with MediaRecorder the last ten seconds as a clip. Community (api/run.js, switched on by KV_REST_API_URL and KV_REST_API_TOKEN): faint ghosts of other players' recent bests, boards per level and for the whole run (a display name, letters, digits and spaces, filtered, or Player), and a count of tonight's players from real starts, hidden below two; with Do Not Track or GPC nothing is sent or fetched. Events: intro_play, game_started, game_level_finished, game_medal, game_platinum, game_quit, game_secret, game_character, game_shared, game_clip.

**Art (assets/game, tools/art).** One plate per title in assets/game/art (1920 and 1280 WebP and AVIF, a mobile crop and tiles), generated with GPT Image 2.5 and graded with tools/art/grade.py (LUT, a baked left shade, a contrast check for bone text at 4.5:1). The portrait (assets/game/portrait) is Jason's real headshot, relit. Medals in assets/game/medals come from tools/art/medals.py. Every shipping raster carries its provenance. /assets/ is cached immutable for a year, so a regraded plate ships under a new stem named as the title's "art" in library.json (Triple J's wide lot is triple-j-w), never over the old files; tools/art/README.md has the steps.

**Loops (Remotion, tools/film/src/library).** The living key art: one short loop per title in assets/game/loops, played when focus rests on a title.

**The score (score.js, assets/score, tools/score).** An adaptive piece composed for the library and rendered from sampled instruments (Salamander Grand Piano, VSCO 2 Community Edition, the Versilian Community Sample Library, Voxengo impulse responses; credits are printed in the page). Stems start on one clock, so any mix is in time: a bed, and a layer per title that fades in on the next bar line when it is focused; stings (start, open, trophies by tier, level clear) are quantized to the beat and the music ducks under them. Nothing loads or plays before Start; the choice is remembered (localStorage jg_score) and M toggles it. iPhones play it with the ringer switch off. haptics.js: Vibration API on Android, the switch-toggle haptic on iOS 17.4+.

**The desk (api/lead.js).** Early access for dealers: name, email, dealership, city, what they use today, sales a month, how buyers pay, a note. Records the person, drafts a pre-call brief under the Obavia boundary, emails Jason through Resend, falls back to mailto without keys. api/apply.js and the hiring page are gone.

**Analytics.** track.js batches events to /api/track (first party, sendBeacon), which drops everything under DNT or GPC, filters bots, allowlists event names and counts anything dropped, then relays to PostHog. UTM and ?r=code outreach links are captured and stripped from the address bar. Every section reports its on-screen time. /admin.html is the Dailies board over /api/metrics: who said hello (names from the intro, with the date), one cached HogQL pull, a warmth score per visitor that halves every two weeks (Hot at 40 or any terminal action, Warm at 15), an inferred audience, journeys per audience, attention per section, sources, questions asked, and the notes dealers left.

**Resume.** One generator, ten resumes: the canonical resume-pdf.html (assets/Jason_Obawemimo_Resume_2026.pdf) and one page per reading at resume/<id>.html (assets/resume/Jason_Obawemimo_Resume_<Reading>.pdf), all from builds.json and record.json, rendered by tools/verify/resume.mjs, one page each, ATS-safe (one column, reading order, standard headings, static fonts, tagged), only verified facts, summaries that lead with the work. Bump the `?v=` on every link when it changes.

**Answers layer (AEO, GEO, SEO).** llms.txt, llms-full.txt, jason-obawemimo.md, answers.json, .well-known/, faq.jsonld, schema.json, answers.html, the knowledge card, credentials and mentions pages, sitemaps, feed. The home page's JSON-LD is generated from schema.json and faq.jsonld, so change those and re-run the assembly.

**Outreach desk.** OUTREACH.md is the voice and the rules. A weekly Routine drafts posts for approval as a draft PR. It never posts. Human approves every send.

## 5. Where the work stands

The library replaced the dash on 2026-10-09. Retired with it: dash.css, dash.js, chrome.js, reel.js (the trailer), sounds.js and assets/sfx, briefing.css, home.css, the dash films and the screening harness. Earlier retirements (the guide character, the cloned voice on the home page) stand; assets/voice and tools/voice stay for a future voiced commentary.

**Switched off until keys exist (CONFIG.md has every variable):**

- Tracking: POSTHOG_KEY. Dailies: ADMIN_TOKEN, POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID, optional REF_CODES.
- Ask box and desk drafts: OPENROUTER_API_KEY, GROQ_API_KEY or GEMINI_API_KEY. Without one the ask box offers email.
- Desk emails: RESEND_API_KEY, RESEND_FROM.

**Known limits.**

- The outreach Routine runs without connectors; recreate it from the claude.ai Routines page to attach Gmail and Composio.
- The Facebook Meta Ads, Era Context and Inkbox connectors need authorization before use.
- The Calendly URL still carries the old name (jason-apohenia).

## 6. Direction

1. **Play it on a phone with the score on.** Press start, take a seat, move through the library, open a title, run a sale in Demo, collect the platinum, open the deck and Check me.
2. **Real Triple J lot photos.** The Triple J key art is generated; Jason's own photos of the lot at night would replace it.
3. **The voice.** A reference clip for a cloned voice goes in tools/voice as ref.wav, which is gitignored and never committed.
4. **Keys in Vercel,** then read the Dailies every morning. Send outreach links as `?r=code` and name the codes in REF_CODES.
5. **A Calendly event under the Obavia name,** then swap the URL everywhere (grep for calendly).
6. **Obavia's own evidence, when there is some.** Until it is live, nothing may imply results.

**What not to do.** Keep the title screen to one seat and one optional name, skippable at every step. It plays on every visit by Jason's choice. No chatbot that talks first. Nothing plays before Start. Trophies and levels are verified facts, never invented ones: no streaks, no points for time on page. Do not widen the claims. No third-person bio. No phone number or street address for Jason.

## 7. Working on it

**Run.** `python3 -m http.server 8765` at the repo root. For `api/`, `npx vercel dev` with the project's environment.

**Verify.** `node tools/verify/library.mjs` (home, desktop and mobile: the title screen and every door into it, focus, opening a title, the desk run to Filed, every trophy and the platinum, the screens, deck, Check me, no-JS, Do Not Track and GPC, no overflow, no dashes, no percent signs, every number in llms.txt) and `node tools/verify/briefing.mjs` (/obavia: header above the fold, film, the desk to Filed, lessons, the early-access form, the get bar) before every push.

**Ship.** Commit plainly. Push the working branch, open a PR, merge, confirm live with curl, ping IndexNow when the answers layer changed, reset the working branch onto main.

**Change a fact.** tools/site/library.json, builds.json, record.json and home.body.html (then assemble and render the resumes), api/guide.js, llms.txt, llms-full.txt, jason-obawemimo.md, answers.json, .well-known/ai-answers.json, faq.jsonld, schema.json, answers.html, resume-pdf.html.

**Write copy.** Second person for the reader's situation, first person for what Jason did. Contractions. Specific nouns. No "solutions", "leverage", "seamless", "elevate", "unlock". No tidy groups of three. No "it's not X, it's Y". No em dashes. No emoji.

## 8. File map

| Path | What it is |
|---|---|
| index.html | Generated. Edit tools/site/library.json, home.body.html or record.json and run tools/site/assemble_home.py |
| tokens.css, proof.css | The base layer and the proof pages |
| game.css, game.js, hud.js | The library: its world, the engine (focus, titles, trophies, seats, routes), FX, toasts, deep links and keys |
| intro.js, tools/site/onboarding.json | The title screen and its words |
| score.js, assets/score, tools/score | The adaptive score and its toolchain |
| desk.css, desk-app.js | The desk as an iPhone app, shared with /obavia.html |
| assets/game, tools/art | Key art, portrait, medals and the grading and medal tools |
| assets/game/loops, tools/film/src/library | The living key-art loops (Remotion) |
| build.js, build.css, tools/site/builds.json | Player 2: the build step, the card, the build screen, the readings and proofs |
| deck.js, verify.js | The resume deck, Check me |
| game-run.js, game-run.css, tools/site/run.json, api/run.js, assets/voice/run | After Hours: The Run, its levels and cast, its community endpoint, its voices |
| track.js, api/track.js, api/metrics.js, admin.html | Tracker, relay, metrics, the Dailies board |
| haptics.js | Touch |
| obavia.html, obavia.css, pages.js | Obavia's page in the library world |
| api/guide.js, api/lead.js, api/_lib | Ask box and the early-access desk |
| proof.css | The proof pages (credentials, answers, profile, knowledge card, mentions, honor, search) in the home page's world: bar with a back chevron, grouped link lists, answer cards |
| resume-pdf.html, assets/Jason_Obawemimo_Resume_2026.pdf | The resume and its PDF |
| assets/film, assets/brand | Films and posters; real Triple J, Obavia and stack logos |
| llms.txt, llms-full.txt, answers.json, faq.jsonld, schema.json, .well-known/ | The answers layer |
| SPEC.md, CONFIG.md, RESEARCH.md, OUTREACH.md | The spec, the switchboard, the research, the outreach voice |

## 9. If something breaks

- **No sound.** Start muted was chosen, or the score is off (localStorage jg_score; M or the Score button turns it on).
- **Something visible that should be hidden.** tokens.css forces `[hidden]` and closed dialogs to display none; check the element uses `hidden`, not a class.
- **Ask box says email me.** No model key (503) or the free tier is spent (429).
- **Dailies says not wired.** The listed variables are missing in Vercel.
- **Page scrolls behind a sheet.** The surface did not call window.JG_LOCK on open and close.
- **Overflow on mobile.** A grid child without min-width 0, or a long button; library.mjs and overflow.mjs report it.
