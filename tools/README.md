# Tools

Everything that produced the site's media and proved it works, moved out of the cloud scratchpad so it runs on your own machine. None of this runs in production; production is the static files plus `api/`.

| Folder | What it makes | Needs |
|---|---|---|
| `site/` | `assemble_home.py` builds index.html from `home.body.html`, the old head, schema.json and faq.jsonld. `build_resume.py` writes the ten resume pages (resume-pdf.html and resume/<build>.html) from `builds.json`, `record.json` and `resume.template.html`, and copies `lexicon.json` into match.js. | Python 3. |
| `film/` | The Remotion project: the signature film (`Signature`, `SignaturePortrait`). `Screen` and `Vsl` are retired compositions kept for reference. | Node 20+, `npm install` inside `tools/film`, Chromium (Remotion downloads one, or set `PW_CHROMIUM`). |
| `voice/` | Trailer lines in Jason's cloned voice (Chatterbox). The guide lines and the visitor replies are retired. | Python 3.11, `pip install chatterbox-tts soundfile imageio-ffmpeg`; your reference recording at `tools/voice/ref.wav` (gitignored, never commit it). |
| `vsl/` | Retired, never current: the partner (agency) film pipeline. Its scripts read `tools/vsl/lines.json`, which is gone; kept for reference only. | The two above. |
| `score/` | The adaptive score in `assets/score/`: the notes as data (`score.py`), a theory check, the SFZ sampler, render, encode and verify. See `tools/score/README.md`. | Python 3.11 with numpy, scipy, soundfile, pyloudnorm, matplotlib, mido, numba; an ffmpeg with libopus and libmp3lame; the sample libraries in a work folder outside the repo (the README lists the downloads). |
| `sfx/` | Rebuilds `assets/sfx` from the raw Mixkit recordings. | `pip install soundfile numpy imageio-ffmpeg`; raw files in `tools/sfx/raw/` (see `assets/sfx/CREDITS.md`). |
| `verify/` | Playwright harnesses that play the home page, the Obavia page, overflow, and the resume PDFs against a local server; `match.test.mjs` checks the listing match. | `npm install playwright` at the repo root, a local server on port 8765, poppler-utils for the resume gates. |
| `fonts/` | `cut_static.py` cuts the static resume fonts in assets/fonts (Hanken Grotesk 400 and 600, Cormorant Garamond 600) from the variable OFL sources; a variable font prints as Type 3. The woff2 files beside it are Google Fonts copies for offline harness runs. | `pip install fonttools brotli`. |

## Run the site locally

```
cd jasonresume
python3 -m http.server 8765
# open http://127.0.0.1:8765/
```

The `api/` functions need Vercel: `npx vercel dev` at the repo root runs them with the environment variables from the project (see CONFIG.md). Without them the pages fall back to email links and the scripted guide, by design.

## Verify before pushing

```
python3 -m http.server 8765 &
node tools/verify/library.mjs    # home page end to end, desktop and mobile, and a quick bot run of every level
node tools/verify/briefing.mjs   # obavia.html: title screen, title head, tabs and Q/E, film, desk to Filed, lessons, early access and its fallbacks, get bar, no-JS
node tools/verify/overflow.mjs   # names the element when a page scrolls sideways
python3 tools/site/build_resume.py  # the ten resume pages and match.js's data, refuses unverified numbers
node tools/verify/resume.mjs     # ten PDFs and .txt copies (assets/ and assets/resume/), gated: one page, tagged, no Type 3, reading order, numbers in llms.txt
node tools/verify/match.test.mjs # the listing match on realistic listings and lookalike phrases
node tools/verify/run-bot.mjs    # After Hours: The Run played by a bot, every level, desktop keys and phone touches
```

## The run, played by a bot

`node tools/verify/run-bot.mjs [desktop|mobile] [level ...] [--quick] [--walk]` plays After Hours: The Run through real input: keys on desktop (1440 by 900: arrows, Shift to run, Space to jump) and touches on a phone held sideways (844 by 390: a thumb on the stick that lifts when it stops, jumps tapped on the drawn button and low on the right half). Each level opens at `?run=<level>&debug=run`; the `debug=run` flag turns on `window.JG_RUN_DEBUG`, a read-only view of the player and the level's geometry (off without the flag). The page's clock is paused and moved one 16 ms frame at a time, so a run is exact and repeatable.

`tools/verify/run-sim.mjs` is a frame-exact copy of the player physics in game-run.js and a planner over it: a search over runs, jumps (how long the button is held, where you steer in the air) and waits, to each medal in turn and then the goal. It plans the careful way: a jump that falls when pressed three frames early or late, or held a little shorter or longer, costs extra, so it takes the safe route where there is one. The bot checks the game against the copy after every move and plans again from where the game really is if they part. If game-run.js changes how the player moves, change `step()` in run-sim.mjs to match.

Desktop has to finish every level with every medal; the phone has to finish every level. Per level it prints whether it finished, the medals found, the level time, respawns, how forgiving each jump was (of 21 timings around the planned one, how many don't fall), and any jump whose landing was off screen at take-off. `--walk` plans the goal without Shift (the tutorial never mentions running, so every main path has to work at a walk). `humanTrial()` in run-sim.mjs plays the same plans with every press and release up to k frames early or late, replanning after each miss and respawning at the last lamp, to estimate falls per run for a careful but imprecise player. `--quick` plays every level to the goal by touch and the first by keys, no medals; `tools/verify/library.mjs` runs it at the end. Screenshots land in `tools/verify/out/bot-*.png`, the summary in `tools/verify/out/run-bot.txt`.

Screenshots land in `tools/verify/out/`.

## Re-render voice

The trailer (reel.js) speaks one line per shot in Jason's cloned voice. Each line is a `vo: "..."` on a shot in `cuts()`; reel.js keys its clip by an FNV-1a hash of the text (`r` plus hex), looks it up in `assets/voice/manifest.json`, plays it over the score with the score ducked, and holds the shot until the line is said. A line with no clip simply plays silent, so edit freely and render after.

1. Reference: `tools/voice/ref.wav` (gitignored, never commit it): 20 to 40 seconds of Jason's real voice talking naturally. Nothing else: the narration in the Triple J films is an AI voice, and a clone of a clone did not sound like him, so the trailer ships silent until his recording arrives.
2. `node tools/voice/reel_lines.mjs` lists the lines that have no clip yet in `tools/voice/reel_lines.json` (`--all` lists every line, to re-render after a new reference).
3. Python 3.11 with `torch==2.6.0 torchaudio==2.6.0` (CPU wheels from download.pytorch.org/whl/cpu), `chatterbox-tts`, `imageio-ffmpeg` and `soundfile`; a virtualenv outside the repo is fine.
4. `LINES=reel_lines.json python3 tools/voice/render_clone.py` renders them into `assets/voice/` and updates the manifest (about 35 seconds a line on a 4-core CPU). Pass ids as arguments to render only those, which skips the manifest write.
5. The retired guide scripts (`extract*.py`, `render_some.py`, `render_you2.py`) are kept for reference; their line files and clips are deleted, and the site no longer plays them.

## Films

- The dash films: `cd tools/film && npm install && sh render-dash.sh` renders DashDesk, DashRecord, DashObavia, DashLot and DashCut into `assets/film/dash-*.mp4` (muted loops; DashDesk crops the Handle a Sale screen out of assets/film/loop-sale.mp4 (the script copies it in)) with posters in `tools/film/out`, and the share cards OgHome and OgObavia. Convert the posters and cards to JPEG (`assets/film/dash-*.jpg`, `assets/og-home-2026-10.jpg`, `assets/og-obavia.jpg`). `/assets/` is served immutable for a year, so a changed share card gets a new filename (and tools/site/home.head.html points at it) rather than overwriting the old one. It finds Chromium at `/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell`; set `REMOTION_BROWSER` elsewhere. Check frames from the encoded files before shipping.
- Signature: `cd tools/film && npx remotion render src/index.ts Signature out/signature.mp4` (and `SignaturePortrait`), then transcode to 1600x900 and 900x1600 into assets/film.
- Triple J, Handle a Sale: in whoisjaso/thetriplejauto, `cd remotion && npx remotion render src/sale-desk.ts SaleDesk out/handle-a-sale.mp4 --scale 0.75` (the scale has to give whole-pixel sizes; 0.5 and 0.75 work), then transcode to 1280x720, 30 fps, faststart, AAC, and pull the poster at 30 seconds.
- Obavia ads: retired, never current. The two vertical ads belonged to the agency product.

## The loading screen, the walkthrough film and the tour

- The loading screen's drawing: `python3 tools/art/boot.py` writes tools/site/boot.html (and tools/film/src/tour/boot.json); tools/site/boot.js is its engine. `python3 tools/site/assemble_home.py` places both in index.html and obavia.html.
- The words: tools/voice/tour_lines.json (film shots and tour stops). `node tools/voice/timeline.mjs` turns them, plus any recorded narration in assets/voice/tour/ (<id>.mp3, <id>.json word timings, manifest.json), into tools/film/src/tour/timeline.json and tools/site/tour.json. Lines with no recording run caption-only on an estimated pace.
- The film, After Hours: `sh tools/film/render-tour.sh` (site served on 8765) captures its hero objects if needed (`CAPTURE=1` forces it; tools/film/capture-heroes.mjs: the Player 2 card, the resume page, the sale desk's phone), strikes one medal large (tools/film/hero_medal.py), synthesises its sound effects (tools/film/sfx.py), renders the AfterHours and AfterHoursVertical compositions (tools/film/src/tour, 32 fps so the score's 64 BPM is 30 frames a beat), writes assets/film/after-hours.mp4, after-hours-vertical.mp4, their .webm and .jpg posters and after-hours.vtt, and re-assembles the site. The narration is the f- lines in tools/voice/tour_lines.json; the film array there is its beats (a line, an act card, or both, with the silence before and after). A new render of a changed film ships under a new file name: /assets is cached for a year.
- The tour in the site: tour.js (styles in game.css), data inlined as #tour-data.

## Rebuild the sound bank

Download the fourteen Mixkit sources named in `tools/sfx/process.py` into `tools/sfx/raw/`, then `python3 tools/sfx/process.py`. Cut points are in the script. Gains are in `sounds.js`.
