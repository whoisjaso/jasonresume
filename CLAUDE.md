# jasonobawemimo.com

Read HANDOFF.md first. It is the brief: what Obavia is, what the site is for, where the work stands, the direction, and the rules that every change has to respect. This file is the short version for a working session.

## What this is

A static site (index.html, tokens.css, home.css, intro.js, reel.js, chrome.js, desk.js, deck.js, verify.js, games.js, extras.js, cinema.js, track.js, sounds.js, haptics.js; obavia.html and join.html add briefing.css and pages.js; the proof pages (credentials, answers, profile, knowledge card, mentions, honor, search) use tokens.css and proof.css) plus Vercel Node functions in `api/`, deployed from `main` to production at jasonobawemimo.com. No build step. No framework. The desk game, the sound, the films and the tracking are all first-party. SPEC.md is the build spec for this version.

## Rules that do not bend

- Claims boundary for Obavia: sales software in development for agency owners at $100K to $1M a month and their setters and closers. Never say it is live, has customers, or produces results; never a conversion rate or percentage; integrations (Zoom, Calendly, GoHighLevel, HubSpot, Slack, Zapier, Google Calendar, Cal.com) are planned, not active; people and figures in demos and ads are fictional; only Core ($3,000 a month) is planned, the rest is proposed; the waitlist grants no access. Apohenia is Obavia's earlier name and appears only as one line in the answers layer.
- Never publish Jason's private phone or street address. Triple J's business address (8774 Almeda Genoa Rd, Houston) is fine.
- No em dashes anywhere on the site. No gradients on text, no glassmorphism, no three-card rows, no emoji as icons. Fonts are Cormorant Garamond and Hanken Grotesk.
- Second person for the reader's situation, first person for what Jason did, never third person.
- Skips and cancels make no sound and no haptic. Choices, arrivals, sends and unlocks fire sound, haptic and motion in the same frame.
- Every fact on the site must be true and already verified in llms.txt. No invented numbers.
- No model identifiers in commits, PR titles or bodies, or code comments.

## Verify before pushing

`python3 -m http.server 8765` then `node tools/verify/screening.mjs` and `node tools/verify/briefing.mjs` (see tools/README.md). Both desktop and mobile. No horizontal overflow, no page errors, no em dashes.

## Where things are

- Home page: edit tools/site/home.body.html and tools/site/record.json (the Slate, record, deck, Check me and PDF link), then `python3 tools/site/assemble_home.py` writes index.html (its JSON-LD comes from schema.json and faq.jsonld). Never hand-edit index.html.
- Scenes and look: home.css and tokens.css (design system, iOS layer); cinema.js is the projector, cue points live in the body markup. chrome.js owns FX, the island, banners, sheets and deep links.
- Copy and facts: tools/site/record.json, tools/site/home.body.html, resume-pdf.html, api/guide.js, llms.txt, llms-full.txt, answers.json, faq.jsonld. Change a fact in all of them.
- Intro: intro.js (first visit: tap to begin, the question, the optional name); the head script in tools/site/assemble_home.py decides whether it shows.
- Reel: reel.js (a trailer cut per visitor with a live Web Audio score, played after the intro and from the cut chips under the Slate; shots and copy live in cuts() at the top, and every line must be in llms.txt).
- Games: games.js (home, obavia, join), desk.js (the Handle a Sale desk), deck.js (resume deck), extras.js (films, rig, trailer, water, commentary captions).
- Sound: sounds.js (bank and gains), assets/sfx, tools/sfx.
- Films: assets/film (Obavia ads, Triple J Handle a Sale, signature), tools/film. The Sale Desk film renders from whoisjaso/thetriplejauto, remotion/src/sale-desk.ts.
- Desks and chat: api/guide.js, api/lead.js, api/apply.js, api/_lib. Config in CONFIG.md.
- Analytics: track.js to api/track.js (allowlist there) to PostHog; api/metrics.js and admin.html are the Dailies board.
- Outreach: OUTREACH.md. Research: RESEARCH.md.
