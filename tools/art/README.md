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
- `--cube after-hours.cube` also writes the look as a 65-point `.cube` LUT (it matches ffmpeg's `lut3d` to within one code value), so a film or a still from another tool can take the same grade. It runs without an input too.

## What it does

1. Cover-crops the source to 16:9 and works at 1920 to 2560 wide (it upscales a smaller source and warns).
2. The look, a 3D LUT built from the art bible: a gentle filmic S on OKLab lightness; black lands on ink `#0A0F0D`, white on a warm white past bone `#EDE7DB`; neutrals are pulled toward ink, then bottle green `#1C3229`, near neutral through the mids, then bone; strong colours (brass, sodium, skin, wood, leather) keep most of their own hue; out-of-gamut colours lose chroma rather than clip. All in float, so nothing posterizes.
3. The left shade: the frame falls toward ink in linear light, full to x 0.30 and gone by x 0.68. Strength starts at 0.70 and rises to 0.90 only if the text zone needs it. A soft-knee limiter then holds any leftover highlight in the zone under a ceiling it tightens until the brightest pixel passes. If the limiter touches more than 0.2 percent of the zone, the report says the subject is crowding the type side: recompose the plate rather than ship it.
4. Grain: fine, film-like, swinging about 3 percent at mid grey (less in deep shadow and at the top), from a seed fixed per id (`seed + crc32(id)`), drawn fresh at each output size.
5. Exports `<id>-1920.webp`, `<id>-1920.avif`, `<id>-1280.webp`, `<id>-m.webp` (828x1104 portrait), `<id>-tile-512.webp`, `<id>-tile-256.webp`. The 1920 WebP quality is the highest that fits the cap (150 to 250KB is the band); the AVIF fits 80 percent of the WebP's bytes; the other WebPs use the same quality. The portrait and tile crops are full height, centred on `focus_x`, and come from the graded frame without the left shade, since their type sits elsewhere.
6. A 24px wide blurred placeholder goes into `placeholders.json` under `<id>` as a WebP data URI (`_about` in the same file says what they are).

## The text-zone check

Bone text has to hold 4.5:1 over the brightest pixel in the zone x 0 to 0.42, y 0.38 to 0.92. Bone's relative luminance is 0.8027, so the zone's max relative luminance must stay at or under 0.1395. The script measures the decoded 1920 WebP, 1920 AVIF and 1280 WebP (grain and compression included), aims for 4.6:1 before encoding, and prints a JSON report with each file's max, p99 and mean luminance and bone's contrast on the max, plus the mobile bottom band (y 0.62 to 0.96 of the portrait crop) for information.

Tested on a synthetic 2560x1440 night plate (a sodium light pool, a wet-floor streak, material swatches, a grey ramp, and a stray lamp left in the text zone on purpose): the limiter caught the lamp and the zone measured 0.134 max luminance, 4.63:1 on the 1920 WebP (4.70:1 on the 1280, 4.76:1 on the AVIF), with the recompose warning. The same plate without the lamp measured 0.0115, 13.9:1, shade at its base strength and the limiter untouched. 1920 WebP about 195KB at quality 90, AVIF about 137KB. Test outputs were deleted.
