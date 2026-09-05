# Tools

Everything that produced the site's media and proved it works, moved out of the cloud scratchpad so it runs on your own machine. None of this runs in production; production is the static files plus `api/`.

| Folder | What it makes | Needs |
|---|---|---|
| `film/` | The Remotion project: the signature film (`Signature`), the laptop screen film (`Screen`), the partner film (`Vsl`). | Node 20+, `npm install` inside `tools/film`, Chromium (Remotion downloads one, or set `PW_CHROMIUM`). |
| `voice/` | Guide lines in Jason's cloned voice (Chatterbox) and the visitor replies (Chatterbox default voice). | Python 3.11, `pip install chatterbox-tts soundfile imageio-ffmpeg`; your reference recording at `tools/voice/ref.wav` (gitignored, never commit it). |
| `vsl/` | The partner film pipeline: narration, timing data, render, transcode, poster, captions. | The two above. |
| `sfx/` | Rebuilds `assets/sfx` from the raw Mixkit recordings. | `pip install soundfile numpy imageio-ffmpeg`; raw files in `tools/sfx/raw/` (see `assets/sfx/CREDITS.md`). |
| `verify/` | Playwright harnesses that load the site against a local server and check the loader hold, the guide, the lock, the new pages, the sound bank, the resume PDF. | `npm install playwright` at the repo root, a local server on port 8765. |

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
node tools/verify/round3.mjs     # loader, gate, guide, screen lock, menu, desktop and mobile
node tools/verify/hold.mjs       # the tap-to-enter hold with real-browser autoplay emulated
node tools/verify/pages.mjs      # partners.html and join.html, overflow, em dashes, form fallback
node tools/verify/sfx.mjs        # every sound file loads and plays
node tools/verify/resume.mjs     # regenerates assets/Jason_Obawemimo_Resume_2026.pdf, one page
```

Screenshots land in `tools/verify/out/`.

## Re-render voice

1. Put your recording at `tools/voice/ref.wav` (mono or stereo, 20 to 40 seconds of you talking naturally; the one used so far was 31 s trimmed from a phone memo).
2. Edit the lines in `guide.js`, then `python3 tools/voice/extract2.py` to regenerate `tools/voice/lines.json` and `tools/voice/items.json` with the ids the page will look up.
3. `python3 tools/voice/render_some.py <id> <id>` renders only the changed guide lines into `assets/voice/` and updates `assets/voice/manifest.json`. `render_clone.py` does all of them (about three minutes a line on CPU, far less on an M1 with MPS if you set the device).
4. `python3 tools/voice/render_you2.py` renders the visitor replies.
5. Check parity: every id in `items.json` must exist in `manifest.json` and as an mp3. `render_some.py` never removes stale clips, so prune by hand.

## Re-render the partner film

```
python3 tools/vsl/render_vsl.py          # narration, one wav per line
bash tools/vsl/render_film.sh            # timing data, Remotion render, transcode, poster, captions
```

Edit the script in `tools/vsl/lines.json`; keep the transcript in `partners.html` (the VideoObject JSON-LD and the "Read it instead" block) in sync by hand.

## Rebuild the sound bank

Download the fourteen Mixkit sources named in `tools/sfx/process.py` into `tools/sfx/raw/`, then `python3 tools/sfx/process.py`. Cut points are in the script. Gains are in `sounds.js`.
