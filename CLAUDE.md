# jasonobawemimo.com

Read HANDOFF.md first. It is the brief: what Apohenia is, what the site is for, where the work stands, the direction, and the rules that every change has to respect. This file is the short version for a working session.

## What this is

A static site (index.html, site.css, site.js, guide.css, guide.js, sounds.js, haptics.js, pages.css, pages.js) plus Vercel Node functions in `api/`, deployed from `main` to production at jasonobawemimo.com. No build step. No framework. The guide, the sound, the films and the voice are all first-party.

## Rules that do not bend

- Claims boundary for Apohenia: Deal Packet Checker is "a packet-readiness review that checks your deal jacket against current webDEALER requirements before you file"; findings are reported as prevalence; a human clerk decides. Never "catches, prevents or reduces rejections", never a percentage, never a borrowed case study, never an affiliation with TxDMV, webDEALER or a county, never an approval guarantee.
- Never publish Jason's private phone or street address. Triple J's business address (8774 Almeda Genoa Rd, Houston) is fine.
- No em dashes anywhere on the site. No gradients on text, no glassmorphism, no three-card rows, no emoji as icons. Fonts are Cormorant Garamond and Hanken Grotesk.
- Second person for the reader's situation, first person for what Jason did, never third person.
- Skips and cancels make no sound and no haptic. Choices, arrivals, sends and unlocks fire sound, haptic and motion in the same frame.
- Every fact on the site must be true and already verified in llms.txt. No invented numbers.
- No model identifiers in commits, PR titles or bodies, or code comments.

## Verify before pushing

`python3 -m http.server 8765` then the harnesses in `tools/verify/` (see tools/README.md). Both desktop and mobile. No horizontal overflow, no page errors, no em dashes.

## Where things are

- Copy and facts: index.html, llms.txt, llms-full.txt, answers.json, faq.jsonld. Change a fact in all of them.
- Guide script and voice: guide.js SCRIPTS, `assets/voice/manifest.json`, tools/voice.
- Sound: sounds.js (bank and gains), assets/sfx, tools/sfx.
- Films: assets/film, tools/film, tools/vsl.
- Desks and chat: api/guide.js, api/lead.js, api/apply.js, api/_lib. Config in CONFIG.md.
- Analytics and admin: api/track.js, api/metrics.js, admin.html.
- Outreach: OUTREACH.md. Research: RESEARCH.md.
