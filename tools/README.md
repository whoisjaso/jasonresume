# Tools

Everything that produced the site's media and proved it works, moved out of the cloud scratchpad so it runs on your own machine. None of this runs in production; production is the static files plus `api/`.

| Folder | What it makes | Needs |
|---|---|---|
| `site/` | `assemble_home.py` builds index.html from `home.body.html`, the old head, schema.json and faq.jsonld. `build_resume.py` writes the ten resume pages (resume-pdf.html and resume/<build>.html) from `builds.json`, `record.json` and `resume.template.html`, and copies `lexicon.json` into match.js. | Python 3. |
| `film/` | The Remotion project: the living key-art loops (`src/library`, `render-library.sh`) and Obavia's share card (`OgObavia`, `render-og-obavia.sh`). | Node 20+, `npm install` inside `tools/film`, Chromium (Remotion downloads one, or set `PW_CHROMIUM`). |
| `voice/` | Voices for the run and the episode: `narrate_free.py` (stock Kokoro voices for the fictional characters), `narrate_jason.py` (Jason's own lines from his recording), `level.py`, and the line files. | Python 3.11 with Kokoro (see the header of `narrate_free.py`); your reference recording at `tools/voice/ref.wav` (gitignored, never commit it). |
| `score/` | The adaptive score in `assets/score/`: the notes as data (`score.py`), a theory check, the SFZ sampler, render, encode and verify. See `tools/score/README.md`. | Python 3.11 with numpy, scipy, soundfile, pyloudnorm, matplotlib, mido, numba; an ffmpeg with libopus and libmp3lame; the sample libraries in a work folder outside the repo (the README lists the downloads). |
| `sfx/` | Rebuilds `assets/sfx` from the raw Mixkit recordings. | `pip install soundfile numpy imageio-ffmpeg`; raw files in `tools/sfx/raw/` (see `assets/sfx/CREDITS.md`). |
| `verify/` | Playwright harnesses that play the home page, the Obavia page, overflow, and the resume PDFs against a local server; `match.test.mjs` checks the listing match. | `npm install playwright` at the repo root, a local server on port 8765, poppler-utils for the resume gates. |
| `story/` | After Hours, the episode's cast. `mh_cast.py` builds the five people in headless Blender 4.2 LTS with the MPFB2 extension from MakeHuman's CC0 assets (bodies, eyes, brows, lashes, teeth, clothes, hair, the game_engine rig, face shape keys), grows Jason's short afro and goatee as geometry, bakes a face mask and marks the tie; `pack_cast.mjs` compresses each GLB with gltfpack (meshoptimizer, MIT) into `assets/story/cast/`. `cast.mjs` is the earlier signed-distance cast, kept for reference; its output is no longer shipped. `clips.mjs` (with `cmu.mjs`) builds the shared motion file `assets/story/cast/clips-v2.glb`. It holds CMU motion capture (mocap.cs.cmu.edu, free to copy, modify and redistribute, NSF EIA-0196217): walk 35_01, brisk walk 16_21, jog 16_35, idle 77_02, conversation 18_08 and hand out 141_23. It also holds clips from Quaternius's Universal Animation Library 1 and 2 (CC0, quaternius.com): talking, phone, fold arms, sitting in, sitting, sitting talking, sitting out, interact, pick up and lean. Each clip is retargeted onto that library's skeleton; story/people.js then retargets onto each body at runtime. `lab.html` and `lab-shots.mjs` are the cast lab, which records contact sheets of walks, runs, turns, idles, sitting and lip-sync. `HANDOFF-people.md` lists the one-line hooks main.js can call. See "After Hours, the episode" below. | Blender 4.2 LTS (download.blender.org), MPFB2 (static.makehumancommunity.org/mpfb), the MakeHuman system assets, glasses01, hats01, visemes01 and faceunits01 packs (CC0); `npm install` inside `tools/story` (meshoptimizer 0.22.0, gltfpack 0.22.0). |
| `story/world/` | After Hours, the sets' assets. `cars.py` models the lot's five cars (sedan, compact, hatch, SUV, pickup) in headless Blender 4.2 LTS from side, plan and section profiles and bakes their ambient occlusion; `pack.mjs` compresses them with gltfpack into `assets/story/world/car-<kind>[-lo]-v1.glb`; `textures.py` fetches the tiled materials from Poly Haven (CC0) into `assets/story/world/tex-v1/`; `stills.mjs` renders stills of every set (desktop and phone) to `tools/verify/out/real-world-*.png`; `probe.mjs` evaluates an expression against the world module in a page. See tools/story/HANDOFF-world.md. | Blender 4.2 LTS (no extensions), `npm install` inside `tools/story`, Python 3 with Pillow, network for the first texture fetch. |
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
node tools/verify/library.mjs    # home page end to end, desktop and mobile, the retired doors staying gone, and a quick bot run of every level
node tools/verify/briefing.mjs   # obavia.html: title screen, title head, tabs and Q/E, film, desk to Filed, lessons, early access and its fallbacks, get bar, no-JS
node tools/verify/overflow.mjs   # names the element when a page scrolls sideways
python3 tools/site/build_resume.py  # the ten resume pages and match.js's data, refuses unverified numbers
node tools/verify/resume.mjs     # ten PDFs and .txt copies (assets/ and assets/resume/), gated: one page, tagged, no Type 3, reading order, numbers in llms.txt
node tools/verify/match.test.mjs # the listing match on realistic listings and lookalike phrases
node tools/verify/run-bot.mjs    # After Hours: The Run played by a bot, every level, desktop keys and phone touches
node tools/verify/story.mjs      # After Hours, the episode: every branch through real keys, clicks and taps, desktop and phone both ways
```

## The run, played by a bot

`node tools/verify/run-bot.mjs [desktop|mobile] [level ...] [--quick] [--walk]` plays After Hours: The Run through real input: keys on desktop (1440 by 900: arrows, Shift to run, Space to jump) and touches on a phone held sideways (844 by 390: a thumb on the stick that lifts when it stops, jumps tapped on the drawn button and low on the right half). Each level opens from `?debug=run` through `window.JG_GAME.play(<level>)`, the call the episode's arcade cabinet makes (the page is reached as a click from the site itself, so the title screen stays out of the way); the `debug=run` flag turns on `window.JG_RUN_DEBUG`, a read-only view of the player and the level's geometry (off without the flag). The page's clock is paused and moved one 16 ms frame at a time, so a run is exact and repeatable.

`tools/verify/run-sim.mjs` is a frame-exact copy of the player physics in game-run.js and a planner over it: a search over runs, jumps (how long the button is held, where you steer in the air) and waits, to each medal in turn and then the goal. It plans the careful way: a jump that falls when pressed three frames early or late, or held a little shorter or longer, costs extra, so it takes the safe route where there is one. The bot checks the game against the copy after every move and plans again from where the game really is if they part. If game-run.js changes how the player moves, change `step()` in run-sim.mjs to match.

Desktop has to finish every level with every medal; the phone has to finish every level. Per level it prints whether it finished, the medals found, the level time, respawns, how forgiving each jump was (of 21 timings around the planned one, how many don't fall), and any jump whose landing was off screen at take-off. `--walk` plans the goal without Shift (the tutorial never mentions running, so every main path has to work at a walk). `humanTrial()` in run-sim.mjs plays the same plans with every press and release up to k frames early or late, replanning after each miss and respawning at the last lamp, to estimate falls per run for a careful but imprecise player. `--quick` plays every level to the goal by touch and the first by keys, no medals; `tools/verify/library.mjs` runs it at the end. Screenshots land in `tools/verify/out/bot-*.png`, the summary in `tools/verify/out/run-bot.txt`.

Screenshots land in `tools/verify/out/`.

## After Hours, the episode

The story is data: `tools/site/story.json` (talks with lines, choices, conditions and actions; the objects you can look at; the journal; the recap; the endings). `assemble_home.py` inlines it as `#story-data` and refuses a Jason line that differs from the voice file. The engine is `story/` (ES modules: `main.js` the game, `world.js` the sets, `people.js` the cast, `paint.js` the shading, `post.js` the lens, `tex.js` the painted canvases) and `story.css`; game.js loads them with three.js only when someone presses Play.

Third-party code it loads, all vendored, pinned and self-hosted, nothing from a CDN at runtime:

- three.js 0.184.0 (MIT, Copyright 2010-2026 three.js authors): `vendor/three-0.184.0/three.module.min.js` and `three.core.min.js`, and from its examples `addons/loaders/GLTFLoader.js`, `addons/utils/BufferGeometryUtils.js`, `addons/utils/SkeletonUtils.js` (their `from 'three'` import rewritten to the pinned file). Licence in `vendor/three-0.184.0/LICENSE`. three.js is the approved exception to the site's first-party rule.
- meshoptimizer 0.22.0 decoder (MIT, Arseny Kapoulkine): `vendor/meshopt-0.22.0/meshopt_decoder.module.js`, licence beside it.
- From three.js 0.184.0's examples (MIT, same copyright, fetched from the npm tarball three-0.184.0.tgz): `addons/geometries/RoundedBoxGeometry.js`, its `from 'three'` import rewritten to the vendored module like the others.

The sets (story/world.js; tools/story/HANDOFF-world.md has the detail):

- The cars are first-party: modelled by `tools/story/world/cars.py` in Blender, no third-party mesh. Compressed with gltfpack 0.22.0 (MIT).
- Tiled materials from Poly Haven (polyhaven.com), all CC0 (public domain, no attribution required; credited here anyway), downloaded at 1k and re-encoded as WebP by `tools/story/world/textures.py`: asphalt `asphalt_02`, concrete `concrete_floor_worn_001`, plaster `painted_plaster_wall`, wood `oak_veneer_01`, carpet `dirty_carpet`, parquet `herringbone_parquet`, fabric `caban` (greyed). Files: `assets/story/world/tex-v1/<role>_{col,nor,arm}_<size>.webp`.
- Everything else in the sets (signs, posters, the plates' emboss, the ceiling tiles, the clocks, the sky, the ground's patches, oil, puddles, cracks and lamp shadows) is drawn in code in story/tex.js and story/world.js.

```
blender -b --python tools/story/world/cars.py -- /tmp/cars [sedan compact hatch suv truck]
node tools/story/world/pack.mjs /tmp/cars v2          # assets/story/world/car-<kind>-v2.glb (about 150 KB, with doors, wheels, a cabin) and -lo (about 75 KB)
python3 tools/story/world/textures.py /tmp/ph-cache    # assets/story/world/tex-v1/*.webp
node tools/story/world/stills.mjs <tag> all            # stills of every set, desktop and phone
```

The cast (MakeHuman system assets, CC0; MPFB2 is GPL but only runs offline in Blender, nothing of it ships):

```
# once: Blender 4.2 LTS, then the extension and the asset packs into MPFB's user data
blender -b --command extension install-file -r user_default -e mpfb2-latest.zip
unzip makehuman_system_assets_cc0.zip glasses01_cc0.zip hats01_cc0.zip  -> ~/.config/blender/4.2/extensions/.user/user_default/mpfb/data/
unzip visemes01.zip faceunits01.zip -> .../mpfb/data/targets/{visemes,faceunits}/
cd tools/story && npm install
# each time
blender -b --python tools/story/mh_cast.py -- /tmp/cast [jason jason-memory player dell renata]   # adds eye bones, repaints the irises brown with a limbal ring, tailors the jackets' shoulders to the body and smooths the shoulder weights, grows Jason's, the memory's and the visitor's hair
node tools/story/pack_cast.mjs /tmp/cast v2      # assets/story/cast/<name>-v2.glb, 435 to 605 KB each
# the motion: UAL1/UAL2 Standard GLBs from quaternius.itch.io (free download), CMU .asf/.amc from mocap.cs.cmu.edu/subjects/<NN>/
node tools/story/clips.mjs UAL1_Standard.glb UAL2_Standard.glb <cmu dir> v2   # assets/story/cast/clips-v2.glb
```

`/assets` is cached for a year, so a rebuilt cast ships under a new version (`v2`) and story/main.js's `VER` moves with it.

Voices: `python3 tools/site/story_voice.py` writes `tools/voice/story_lines.json` (the fictional cast, each with a stock Kokoro voice) and `tools/voice/story_jason_lines.json` (my lines, with pronunciations for the figures). Render with `/root/kvenv/bin/python -I tools/voice/narrate_free.py tools/voice/story_lines.json` and `/root/cbvenv/bin/python -I tools/voice/narrate_jason.py tools/voice/story_jason_lines.json --takes 1` (needs `tools/voice/ref.wav`, never committed; about two minutes a line on a 4-core CPU). Both skip lines that haven't changed. Until a line of mine is rendered, it plays as a caption.

Sound (`story/audio.js`, under the score and following its toggle). One AudioContext, built when Play or Continue is pressed, never before. Buses: voice 1.0, effects 0.62, ambience 0.42 and interface 0.5 (linear, before the sliders), into master, then a glue compressor (threshold -20 dB, ratio 2.5) and a limiter (threshold -2 dB, ratio 20, 2 ms attack). Under a voiced line the ambience drops to 0.45 and the effects to about 0.6; the score steps back on its own (`JG_SCORE.voice`). Outdoor sources (rain, traffic, the passing car, the awning, the idling car) go through one lowpass that is wide open on the lot and closes to 640 Hz behind the office glass. Each room has a generated convolution reverb (lot 1.1 s, office 0.55 s, library 2.4 s). The pause menu's Settings set Master, Music (through `JG_SCORE.mix`), Voices and Effects, saved in `localStorage` as `jg_story_mix`; the controls (run hold or toggle, pointer lock, invert, remapped keys) are saved as `jg_story_controls`.

Sources and licences:

- Synthesized at run time in `story/audio.js` (first party, nothing to download): the rain bed (pink and brown noise, a bed of drops), the rain drumming on the showroom awning, rain on the office window, the sodium lamps' 120 Hz buzz and the office tubes' hum, distant traffic and tyre hiss, a car passing on the street with doppler, a car idling past the gate, the office door chime, HVAC, mains hum and the wall clock, the desk phone's ring, typing at the desk, the library's hush, morning birds, the wet half of every footstep (the slap, the spray, the drops) and the puddle splashes, the notice chime and the trophy bell.
- Recorded, from Kenney (kenney.nl), all CC0 1.0, the licence files in `tools/story/sfx/src/`: Impact Sounds (footsteps on concrete, carpet and wood; light metal impacts used as the gate's chain), RPG Audio (cloth, book flips, book open, close and place, creaks, metal latch and click, coins used as the keys, door open and close), Interface Sounds (tick, select, click, drop, toggle). `python3 tools/story/sfx/build.py` (needs sox) trims, normalizes and joins them into `assets/story/sfx/sfx.mp3` (mono, 96 kbps, about 270 KB) with `sfx.json` giving each sound's offset.

`node tools/verify/story.mjs [desktop|landscape|portrait] [--shots] [--feel|--nofeel]` first runs a short feel check per viewport (no AudioContext before a gesture; the audio graph and its buses after Play; the trail and the edge arrow pointing to the objective; the stuck nudge; analog walk and run on the stick or keys; tap to walk round a parked car; the camera never inside geometry at sampled points; a skipped line makes no sound or haptic; the settings persist across a reload; stills in `tools/verify/out/real-feel-*.png`), then plays every branch (hiring, a dealer, curious, deflecting all the way, deflecting then telling) through real keys, clicks and taps, checks the endings, Continue after a reload, trophies in the library's store, no page errors, no dashes, percent signs or unverified numbers; `--shots` adds stills of every scene and moment and contact sheets in `tools/verify/out/story-sheet-*.png`. It opens the page with `?debug=story` (a read-only state view and a hook that stands you at a spot) and `&pr=0.3` (a low render resolution, since headless Chromium draws WebGL in software). `--jump` checks the jump alone (Space, or the Jump button on a phone; a standing and a running jump stepped on a fixed clock; never into a wall, never in a talk or the pause menu; the landing's step, haptic and camera dip in one frame; a splash in a puddle) and on desktop writes a contact sheet of stills at fixed times to `tools/verify/out/jump-sheet.png`. `--pad` drives the episode from a standard-mapping pad injected through `navigator.getGamepads`: the stick's curve, the run and camera clicks, A and X jumping, the pause menu and its sliders, the journal's tabs, a talk's choices, the desk's phone and the end screen, with the focus always shown and a rumble wherever a haptic fires (never on a cancel).

## Re-render voice

- The run's cast: `/root/kvenv/bin/python -I tools/voice/narrate_free.py tools/site/run.json` writes assets/voice/run-v2 (the file names its own `out` folder). Jason's run lines: tools/voice/run_jason_lines.json through `narrate_jason.py`.
- The episode: `python3 tools/site/story_voice.py`, then `narrate_free.py tools/voice/story_lines.json` and `narrate_jason.py tools/voice/story_jason_lines.json`, into assets/voice/story-v3.
- Reference: `tools/voice/ref.wav` and `ref_full.wav` (gitignored, never commit them).

## Films

- Obavia's share card: `cd tools/film && npm install && sh render-og-obavia.sh` renders the OgObavia composition (src/dash/films.tsx, the one dash film kept) to `tools/film/out/og-obavia.png` and `.jpg`; it ships as `assets/og-obavia.jpg`. `/assets/` is served immutable for a year, so a changed card gets a new filename (and the pages point at it) rather than overwriting the old one. It finds Chromium at `/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell`; set `REMOTION_BROWSER` elsewhere.
- The living key-art loops: `sh render-library.sh [id ...]` (see its header).
- Triple J, Handle a Sale: in whoisjaso/thetriplejauto, `cd remotion && npx remotion render src/sale-desk.ts SaleDesk out/handle-a-sale.mp4 --scale 0.75` (the scale has to give whole-pixel sizes; 0.5 and 0.75 work), then transcode to 1280x720, 30 fps, faststart, AAC, and pull the poster at 30 seconds.
- Obavia ads: retired, never current. The two vertical ads belonged to the agency product.

## The loading screen

- The loading screen's drawing: `python3 tools/art/boot.py` writes tools/site/boot.html; tools/site/boot.js is its engine. `python3 tools/site/assemble_home.py` places both in index.html and obavia.html.
- The walkthrough film and the guided tour are retired (October 2026); /walkthrough.html redirects to the home page (vercel.json).

## Rebuild the sound bank

Download the fourteen Mixkit sources named in `tools/sfx/process.py` into `tools/sfx/raw/`, then `python3 tools/sfx/process.py`. Cut points are in the script. Gains are in `sounds.js`.
