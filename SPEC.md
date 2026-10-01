# The Screening: build spec for the rebuilt jasonobawemimo.com

> Superseded in part on 2026-10-01. The home page is now an App Store Today feed with story cards and the desk as an iPhone app (HANDOFF.md, section 4, is current). The Obavia page is the Obavia Desk app page for Texas dealers. The hiring page is retired. cinema.js, desk.js, games.js and extras.js are removed. The intro and the reel described here still apply.

Written 2026-09-30 from five research tracks (interviewer psychology in the AI-application era, cinematic web craft, the agency-owner buyer, first-party analytics, and a blunt audit of the previous site), three competing concepts, and a judge panel. The winning concept was "The Screening". This file is what the build follows. HANDOFF.md holds the product canon and CLAUDE.md the rules.

## The idea

You're screening me, so the site is a screening room. The first frame is the verdict: who I am, what I do, and one tap to the resume, the proof, and a way to reach me. Everything after it is proof you can operate, open or check, told with film grammar (title cards, hard cuts through black, letterbox bars, ink, one gold element per shot) and never at the cost of the visitor's time.

## Audience goals

- **Interviewer.** Knows who I am and what to do next within ten seconds with no interaction. Resume, PDF, proof and email one tap from every frame at every width. Can operate a real system of mine in under a minute. Can verify every claim in one tap.
- **Agency owner.** Gets something useful in under two minutes even if they never buy: a handoff card, their first leak and a Monday fix, the rule that only verified cash counts. Obavia is described inside the claims boundary. The calendar sits under the films.
- **Lurker.** One optional tap starts a sixty-second trailer rolled by holding a button. A water portrait to touch at the end.
- **Jason.** First-party tracking of every meaningful moment through /api/track, a warmth score, and a one-screen board.

## Rules that shape every scene

- No loader, gate, name step or forced tour. The page paints the Slate immediately. The cold open is decoration over visible text, under 1.2 s.
- No autoplay of sound or film. Films play on press. Sound effects fire only in response to the visitor's own gestures and can be muted; the choice persists.
- Skips, cancels and closes are silent. Choices, arrivals, sends and unlocks fire sound, haptic and motion in the same frame.
- No scores, points, timers, badges or percentages. Reveals compare, never grade.
- Every fictional person, figure and line is labeled fictional next to it. Every Obavia film has "People and figures in these films are fictional." directly under it.
- Only facts in llms.txt. Only lacquer, gold, ivory, link, edge and secondary colors. No gradient text, glassmorphism, three equal cards in a row, emoji icons or em dashes.
- Transform and opacity only. One rAF clock that sleeps off screen. No pins on mobile. Reduced motion and the Still toggle show finished states.
- No synthetic Jason on any default path. The illustrated faces and the forced guide are retired. The cloned voice survives only as an opt-in Commentary track, disclosed in the colophon and in llms.txt.

## Storyboard (home)

1. **The Slate.** Name, one line, four rows (Obavia, Triple J, Pearland, Education), actions Resume (primary), Proof, Talk, Check me, the one-page PDF, and "That's the ten-second version." Real headshot. Cold open: letterbox bars close and open, the name rises out of a line mask, the gold rule draws in ink, the headshot comes up from black. Readable with JavaScript off.
2. **The cut.** "Want a different cut?" I'm screening you (goes to the desk), I run an agency (goes to /obavia.html), Just looking (opens the trailer). Optional, remembered, deep-linkable with ?cut=. A small line for setters and closers.
3. **Chrome.** An opaque top bar that hides on scroll down: monogram, Resume, Check me, Talk, Sound, Commentary, menu. On phones a fixed bottom dock with Resume, Check me, Talk. Keyboard shortcuts: R resume deck, V verify, P proof, ? help, backtick rig.
4. **Title card: Run the desk.**
5. **Run the desk.** A hands-on sketch of Triple J's Handle a Sale flow with the film's own fictional buyer: how is the buyer paying, who files the title and registration, hold to scan the license (every form fills at once), the registration math with the film's fictional figures, English or Spanish, sign (typed name on the dealer line, never an image of a real signature), on file. Then a hard cut to the reveal: the desk Triple J closes sales on, the public address and hours, the real film.
6. **The real one.** The 82-second film, play on press, with a chapter row (The old way, Question, Scan, Math, Documents, Language, Sign, On file) and a readable transcript. Short pin on desktop only.
7. **The record.** The plain resume on the page, every line with a proof chip, "Present it" and "PDF, one page". Generated from tools/site/record.json, which also feeds the deck and resume-pdf.html.
8. **Presentation mode.** Ten slides in a native dialog: arrow keys, swipe, click halves, number keys, #present/N deep links, print. The resume button's label match-cuts into slide one.
9. **The one I'm building.** Obavia in three lines, then Mark the Words: tap the words in a fictional buyer's sentence a closer should carry, then Show me reveals my marks and one question built from them. The six stages as a gold thread. Link to the briefing.
10. **Questions worth asking me.** Two questions for the call, each with "Add to my questions". The collected list can be emailed with one tap.
11. **You're standing in it.** The colophon and the Show the rig switch: live scene clocks, cue ticks, page weight, scripts loaded, and the Cue Sheet listing every analytics event this visit has queued (or "Your browser asked not to be tracked. Nothing is being sent.").
12. **Your move.** Email first for screeners, 30 minutes on the calendar second, the reverse for agency owners. Setters and closers link.
13. **End credits.** A held final card: who made it, the films and their fictional labels, the sound source, the privacy line, the links.
14. **Post-credits.** "Still here. Touch the water." The real headshot under the water simulation, and the forward kit (copy a two-line blurb, or share this cut).

Overlays: **Check me** (verification drawer with an Ask field grounded in llms.txt), **Trailer** (hold to roll six shots built from live HTML), **Presentation mode**, **Help**.

## Obavia briefing (/obavia.html)

Slate with the mark, tagline, one paragraph, "In development". Both films with the fictional label and the calendar directly under them. Three lessons, each under ninety seconds with a silent Skip: The Handoff (pick the closer's first line, keep a four-line handoff card), Where Your Floor Leaks (six yes, not sure, no questions, one per stage, returns the first leak and a Monday fix), Counts Yet? (sort a fictional week's events into counts or not yet). Pricing as a ledger, planned connections in plain text, what I won't claim, waitlist and calendar.

## Hiring (/join.html)

Slate, Rewrite the Note (place fragments of a fictional call into the four lines a closer needs), the two roles, the application to /api/apply with the mailto fallback. Only verified promises.

## Architecture

- tokens.css: the design system and base layer for every rebuilt page.
- chrome.js / chrome.css: top bar, dock, menu, sound, Still, Commentary toggles, the cut row, shortcuts, the screen lock, dialogs.
- track.js: the one browser tracker (JG_TRACK, JG_ID, JG_SID), DNT and GPC honored with zero requests, first touch and UTM capture, section reach and attention dwell, the cue sheet feed.
- cinema.js: the projector, kept, exposing window.JG_PROJECTOR for the rig.
- desk.js, deck.js, games.js, verify.js, rig.js, trailer.js, water.js, hold.js, commentary.js: the scene modules, each lazy where possible.
- sounds.js and haptics.js: kept.
- tools/site/record.json: the single source for the Slate, the record, the deck and the PDF. tools/site/assemble_home.py builds index.html; tools/site/build_resume.py builds resume-pdf.html.
- Retired: the guide overlay (guide.js, guide.css), the intake (site.js on the home page), the illustrated faces. The loader, the question and the name step came back on 2026-10-01 as intro.js, at Jason's request: first visit only, skippable at every step.
- api/track.js: a per-event schema instead of the silent allowlist; drops are counted. api/metrics.js and admin.html: the Dailies board with the warmth score.

## Verification

tools/verify/cinema.mjs walks every scene on desktop 1440x900 and mobile 390x844: no page errors, no horizontal overflow, no em dashes, no "%" or "customers" in rendered text, the Slate's actions above the fold at 390x844, nothing under the dock. tools/verify/facts.mjs checks the numbers and proper nouns in rendered pages against llms.txt. tools/verify/privacy.mjs asserts zero requests to /api/track with DNT or GPC set.
