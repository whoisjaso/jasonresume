# Tools

Everything that produced the site's media and proved it works, moved out of the cloud scratchpad so it runs on your own machine. None of this runs in production; production is the static files plus `api/`.

| Folder | What it makes | Needs |
|---|---|---|
| `site/` | `assemble_home.py` builds index.html from `home.body.html`, the old head, schema.json and faq.jsonld. | Python 3. |
| `film/` | The Remotion project: the signature film (`Signature`, `SignaturePortrait`). `Screen` and `Vsl` are retired compositions kept for reference. | Node 20+, `npm install` inside `tools/film`, Chromium (Remotion downloads one, or set `PW_CHROMIUM`). |
| `voice/` | Guide lines in Jason's cloned voice (Chatterbox) and the visitor replies (Chatterbox default voice). | Python 3.11, `pip install chatterbox-tts soundfile imageio-ffmpeg`; your reference recording at `tools/voice/ref.wav` (gitignored, never commit it). |
| `vsl/` | The partner film pipeline: narration, timing data, render, transcode, poster, captions. | The two above. |
| `sfx/` | Rebuilds `assets/sfx` from the raw Mixkit recordings. | `pip install soundfile numpy imageio-ffmpeg`; raw files in `tools/sfx/raw/` (see `assets/sfx/CREDITS.md`). |
| `verify/` | Playwright harnesses that play the home page, the Obavia and hiring pages, overflow, and the resume PDF against a local server. | `npm install playwright` at the repo root, a local server on port 8765. |

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
node tools/verify/screening.mjs  # home page end to end, desktop and mobile
node tools/verify/briefing.mjs   # obavia.html: header, film, the desk to Filed, lessons, early-access form, get bar
node tools/verify/overflow.mjs   # names the element when a page scrolls sideways
node tools/verify/resume.mjs     # regenerates assets/Jason_Obawemimo_Resume_2026.pdf, one page
```

Screenshots land in `tools/verify/out/`.

## Re-render voice

The trailer (reel.js) speaks one line per shot in Jason's cloned voice. Each line is a `vo: "..."` on a shot in `cuts()`; reel.js keys its clip by an FNV-1a hash of the text (`r` plus hex), looks it up in `assets/voice/manifest.json`, plays it over the score with the score ducked, and holds the shot until the line is said. A line with no clip simply plays silent, so edit freely and render after.

1. Reference: `tools/voice/ref.wav` (gitignored, never commit it): 20 to 40 seconds of Jason's real voice talking naturally. Nothing else: the narration in the Triple J films is an AI voice, and a clone of a clone did not sound like him, so the trailer ships silent until his recording arrives.
2. `node tools/voice/reel_lines.mjs` lists the lines that have no clip yet in `tools/voice/reel_lines.json` (`--all` lists every line, to re-render after a new reference).
3. Python 3.11 with `torch==2.6.0 torchaudio==2.6.0` (CPU wheels from download.pytorch.org/whl/cpu), `chatterbox-tts`, `imageio-ffmpeg` and `soundfile`; a virtualenv outside the repo is fine.
4. `LINES=reel_lines.json python3 tools/voice/render_clone.py` renders them into `assets/voice/` and updates the manifest (about 35 seconds a line on a 4-core CPU). Pass ids as arguments to render only those, which skips the manifest write.
5. Retired guide lines (`lines.json`, `items.json`, `extract*.py`, `render_some.py`, `render_you2.py`) and their clips are kept for reference; the site no longer plays them.

## Films

- The dash films: `cd tools/film && npm install && sh render-dash.sh` renders DashRecord, DashObavia, DashLot and DashCut into `assets/film/dash-*.mp4` (muted loops) with posters in `tools/film/out`, and the share cards OgHome and OgObavia. Convert the posters and cards to JPEG (`assets/film/dash-*.jpg`, `assets/og-home.jpg`, `assets/og-obavia.jpg`). It finds Chromium at `/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell`; set `REMOTION_BROWSER` elsewhere. Check frames from the encoded files before shipping.
- Signature: `cd tools/film && npx remotion render src/index.ts Signature out/signature.mp4` (and `SignaturePortrait`), then transcode to 1600x900 and 900x1600 into assets/film.
- Triple J, Handle a Sale: in whoisjaso/thetriplejauto, `cd remotion && npx remotion render src/sale-desk.ts SaleDesk out/handle-a-sale.mp4 --scale 0.75` (the scale has to give whole-pixel sizes; 0.5 and 0.75 work), then transcode to 1280x720, 30 fps, faststart, AAC, and pull the poster at 30 seconds.
- Obavia ads: the two vertical films come from the Obavia ads page; transcode to 720x1280 with a poster each.

## Rebuild the sound bank

Download the fourteen Mixkit sources named in `tools/sfx/process.py` into `tools/sfx/raw/`, then `python3 tools/sfx/process.py`. Cut points are in the script. Gains are in `sounds.js`.
