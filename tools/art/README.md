# Art: the After Hours grade

`grade.py` puts every key-art plate through one shared look and exports the web set, so six plates made one at a time read as one world: bottle-green shadows falling to ink, warm practical light, bone highlights, fine grain, and a calm left side for type.

## Needs

Python 3.11 with `numpy`, `scipy`, `opencv-python-headless` and `Pillow` 11.3 or later (AVIF is built in from 11.3; older Pillow skips AVIF and says so). Node for the provenance step.

## Run

```
python3 tools/art/grade.py <plate.png> <id> [focus_x] --prompt "<the exact generation prompt>"
```

- `focus_x` (default 0.62) is the horizontal centre of the portrait and tile crops, 0 to 1.
- `--prompt` or `--prompt-file` is required: every file written gets the prompt through the impeccable skill's `embed-prompt.mjs` (WebP and AVIF get a `.json` sidecar). The script finds it under `~/.claude/skills`; point `--embed-script` or `EMBED_PROMPT` at it elsewhere. `--no-provenance` is for test runs you delete.
- `--out` (default `assets/game/art`), `--webp-kb` (size cap for the 1920 WebP, default 220), `--grain` (default 0.03), `--seed` (default 1979).
- `--tile-zoom` (default 1.0, full height) crops the tile as a square of that fraction of the frame height, centred on `--tile-x` (default `focus_x`) and `--tile-y` (default 0.5), for a plate whose subject is small in a wide frame. Triple J's wide lot is graded at `--tile-zoom 0.6 --tile-y 0.48`, so the cars, poles and showroom fill the middle of a 162 pixel tile.
- `--cube after-hours.cube` also writes the look as a 65-point `.cube` LUT (it matches ffmpeg's `lut3d` to within one code value), so a film or a still from another tool can take the same grade. It runs without an input too.

## What it does

1. Cover-crops the source to 16:9 and works at 1920 to 2560 wide (it upscales a smaller source and warns).
2. The look, a 3D LUT built from the art bible: a gentle filmic S on OKLab lightness; black lands on ink `#0A0F0D`, white on a warm white past bone `#EDE7DB`; neutrals are pulled toward ink, then bottle green `#1C3229`, near neutral through the mids, then bone; strong colours (brass, sodium, skin, wood, leather) keep most of their own hue; out-of-gamut colours lose chroma rather than clip. All in float, so nothing posterizes.
3. The left shade: the frame falls toward ink in linear light, full to x 0.30 and gone by x 0.68. Strength starts at 0.70 and rises to 0.90 only if the text zone needs it. A soft-knee limiter then holds any leftover highlight in the zone under a ceiling it tightens until the brightest pixel passes. If the limiter touches more than 0.2 percent of the zone, the report says the subject is crowding the type side: recompose the plate rather than ship it.
4. Grain: fine, film-like, swinging about 3 percent at mid grey (less in deep shadow and at the top), from a seed fixed per id (`seed + crc32(id)`), drawn fresh at each output size.
5. Exports `<id>-1920.webp`, `<id>-1920.avif`, `<id>-1280.webp`, `<id>-m.webp` (828x1104 portrait), `<id>-tile-512.webp`, `<id>-tile-256.webp`. The 1920 WebP quality is the highest that fits the cap (150 to 250KB is the band); the AVIF fits 80 percent of the WebP's bytes; the other WebPs use the same quality. The portrait crop is full height and the tile full height unless `--tile-zoom` says otherwise, both centred on `focus_x`, and they come from the graded frame without the left shade, since their type sits elsewhere.
6. A 24px wide blurred placeholder goes into `placeholders.json` under `<id>` as a WebP data URI (`_about` in the same file says what they are).
7. `frames.json` gets `<id>`: where the portrait crop sits in the 16:9 frame and `loop_x`, the object-position that puts the 16:9 living loop over the same part of the frame as the portrait still on a phone (390 by 844, the still at 62 percent). The report prints it as `loop_x_phone`. `assemble_home.py` writes it on each plate as `--lx`, and game.css positions the loop with it at 760 pixels wide or less (the picture source's breakpoint), so the dissolve from still to loop holds its place. The five plates graded before this were measured from their shipped crops.

## A regraded plate gets a new name

`/assets/` is served immutable for a year, so a plate that changes ships under a new id rather than over the old files (a browser that has visited would keep the old plate and loop, and could mix the old still with the new loop). Grade under the new id (Triple J's wide lot is `triple-j-w`), name it as the title's `"art"` in `tools/site/library.json`, render its loop (`sh render-library.sh <title id>` reads the stem and writes `<stem>.mp4` and `.webm`), delete the old files and their `placeholders.json` and `frames.json` entries, then run `assemble_home.py`. The page, the title screen (`onboarding.json` names the art by title id; assemble_home.py resolves it) and Player 2's card all follow the stem through the onboarding data's `arts` map.

## The text-zone check

Bone text has to hold 4.5:1 over the brightest pixel in the zone x 0 to 0.42, y 0.38 to 0.92. Bone's relative luminance is 0.8027, so the zone's max relative luminance must stay at or under 0.1395. The script measures the decoded 1920 WebP, 1920 AVIF and 1280 WebP (grain and compression included), aims for 4.6:1 before encoding, and prints a JSON report with each file's max, p99 and mean luminance and bone's contrast on the max, plus the mobile bottom band (y 0.62 to 0.96 of the portrait crop) for information.

Tested on a synthetic 2560x1440 night plate (a sodium light pool, a wet-floor streak, material swatches, a grey ramp, and a stray lamp left in the text zone on purpose): the limiter caught the lamp and the zone measured 0.134 max luminance, 4.63:1 on the 1920 WebP (4.70:1 on the 1280, 4.76:1 on the AVIF), with the recompose warning. The same plate without the lamp measured 0.0115, 13.9:1, shade at its base strength and the limiter untouched. 1920 WebP about 195KB at quality 90, AVIF about 137KB. Test outputs were deleted.

# Medals: trophies and proof medals

`medal_glyphs.py` authors every glyph as geometry on a 48 unit grid (stroke 3, round caps and joins, no fills, under lines cut back where another line crosses over them) and writes the SVGs to `assets/game/medals/glyphs`. `medals.py` reads those SVGs back, cuts each one as a recessed V groove into the one nickel-silver base (`candidates/medal-base.png`), strikes it in its tier's metal and writes `<slug>-160.webp` and `<slug>-80.webp` to `assets/game/medals`, each with a provenance `.json` sidecar through `embed-prompt.mjs`. The 80 pixel file is cut 12 percent wider for its smaller optical size.

There are two sets. The 18 trophies (`TROPHIES` in medals.py) belong to the library. The 16 proof medals (`PROOFS`, silver except `neuron` in bronze) belong to the visitor's build card: crew, payroll, help-desk, access, network, built-not-bought, on-the-line, handshake, filed, deal-jacket, in-order, collections, data-model, shipped, every-form, neuron.

```
python3 tools/art/medal_glyphs.py --proofs          # rewrite the proof glyph SVGs
python3 tools/art/medal_glyphs.py crew,payroll      # rewrite named glyphs; no argument rewrites all 34
python3 tools/art/medals.py --proofs                # strike the 16 proof medals only
python3 tools/art/medals.py --only crew,payroll     # strike named medals only (commas or spaces)
python3 tools/art/medals.py --trophies              # strike the 18 trophies only
python3 tools/art/medals.py                         # everything: all 34, the blanks, the sheen, both sheets
```

- A partial run (`--proofs`, `--trophies` or `--only`) writes only the medals it names and their sidecars, so the rest stay byte-identical. The blanks, `sheen.webp` and `candidates/medals-contact.png` come only from a full run. An unknown slug stops the run before anything is written.
- Any run that strikes a proof medal also writes `candidates/medals-contact-proofs.png`: all 34 as they stand on disk, at 80 and 40 pixels on ink. Read it before shipping: each glyph has to read at 40 pixels, sit centred, match the family's weight and stay distinct from its neighbours.
- `OFFSETS` in medal_glyphs.py nudges a glyph's mass onto the medal's centre; a glyph that runs large is scaled inside its own function. medals.py warns when a stroke reaches the bevel.
- `--no-provenance` is for test runs you delete; `--embed-script` or `EMBED_PROMPT` points at `embed-prompt.mjs` when it is not under `~/.claude/skills`. Check with `node <embed-prompt.mjs> --scan assets/game/medals` (0 missing).
