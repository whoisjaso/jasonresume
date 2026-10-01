# jasonobawemimo.com

Read HANDOFF.md first. It is the brief: what Obavia is, what the site is for, where the work stands, the direction, and the rules that every change has to respect. This file is the short version for a working session.

## What this is

A static site (index.html, tokens.css, home.css, intro.js, reel.js, today.css, today.js, chrome.js, deck.js, verify.js, track.js, sounds.js, haptics.js; obavia.html adds briefing.css and pages.js and reuses today.css and today.js for the desk app; the proof pages (credentials, answers, profile, knowledge card, mentions, honor, search) use tokens.css and proof.css) plus Vercel Node functions in `api/`, deployed from `main` to production at jasonobawemimo.com. No build step. No framework. The desk game, the sound, the films and the tracking are all first-party. SPEC.md is the build spec for this version.

## Rules that do not bend

- Claims boundary for Obavia: Obavia's product is Obavia Desk, a dealership sale desk in development for Texas independent dealers ("Every sale, start to signed"), grown out of Handle a Sale at Triple J. Never say it is live or that dealers use it; never claim customers, results, a conversion rate or a percentage of anything it achieved; Text it to sign, Reach and dealer websites are in development, not live; pricing is not published, so never quote one; people and figures in demos and films are fictional and say so; early access is a conversation, not an account. Source of truth for Obavia is the whoisjaso/obavia repo (obavia-co/index.html and desk/README.md). Apohenia is Obavia's earlier name and appears only as one line in the answers layer. The agency sales product and the hiring page are retired.
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
- Look: tokens.css (design system, iOS layer), home.css (shared components, intro, reel), today.css (the Today feed, story cards, the iPhone desk app, the tab bar). chrome.js owns FX, the island, banners, sheets and deep links; today.js owns the feed, the story cards (window.JG_STORY) and the desk app.
- Copy and facts: tools/site/record.json, tools/site/home.body.html, resume-pdf.html, api/guide.js, llms.txt, llms-full.txt, answers.json, faq.jsonld. Change a fact in all of them.
- Intro: intro.js (first visit: tap to begin, the question, the optional name); the head script in tools/site/assemble_home.py decides whether it shows.
- Reel: reel.js (a trailer cut per visitor with a live Web Audio score, played after the intro and from the cut chips under the Slate; shots and copy live in cuts() at the top, and every line must be in llms.txt).
- Interactive: the desk app in today.js (fictional buyer, example figures), reel.js (the trailer, a cut per visitor, live score), deck.js (resume deck). /join redirects to /obavia.html; there is no hiring page.
- Sound: sounds.js (bank and gains), assets/sfx, tools/sfx.
- Films: assets/film (Obavia ads, Triple J Handle a Sale, signature), tools/film. The Sale Desk film renders from whoisjaso/thetriplejauto, remotion/src/sale-desk.ts.
- Desks and chat: api/guide.js (ask box), api/lead.js (Obavia Desk early access), api/_lib. Config in CONFIG.md.
- Analytics: track.js to api/track.js (allowlist there) to PostHog; api/metrics.js and admin.html are the Dailies board.
- Outreach: OUTREACH.md. Research: RESEARCH.md.
