# After Hours: the world, for whoever wires it

Owner of this layer: story/world.js, story/paint.js, story/post.js, story/tex.js,
assets/story/world/ and tools/story/world/. This note says what the sets now
expose, what the rest of the episode can (or should) do with it, and how the
assets are built.

## 1. Loading

- `story/world.js` starts its downloads as soon as it is imported and
  **top-level-awaits the lot's assets** (the five cars and the asphalt and
  concrete textures) before it finishes evaluating, so `buildLot()` stays
  synchronous and the cars are there on the first frame. It never hangs:
  every texture resolves (to `null`, flat colour) after 12 s or on an error,
  every car file rejects after 12 s and the lot uses a kind that did load,
  and the whole await gives up at 14 s and builds with what it has.
- Progress: each finished file fires `document` event `jg:world-load` with
  `detail: { f (0..1), done, total }`. Because the await runs while
  main.js is still being imported, main.js's own listeners are not up yet; the
  loading screen game.js draws (`#story .st-load`) is what shows. If you want
  a bar during this phase, either listen from game.js, or (better) take the
  await out of world.js's hands: import `{ lotReady }` and `await lotReady`
  in `getSet("lot")` with your own bar. Tell me and I'll drop the top-level
  await; nothing else changes.
- The office's and library's textures (`roomsReady`) load in the background
  after the lot's. A set built before they land renders with flat colours and
  patches itself in when they arrive. Every set has `set.userData.ready`
  (a promise) if you would rather wait.
- Budget (gzip-free sizes, they are already compressed):
  desktop lot: cars 436 KB + asphalt (1024 colour, 512 normal and ARM) 452 KB +
  concrete 27 KB = about 0.92 MB; phone lot: cars 234 KB + 512 textures 237 KB
  = about 0.47 MB. Rooms afterwards: desktop about 0.75 MB, phone about 0.3 MB.
  With three.js (0.74 MB), the story scripts and the three lot people
  (about 1.5 MB), the first scene is about 3.5 MB on desktop, 3.0 MB on a phone.

## 2. Hooks on `set.userData`

| key | what | sets |
|---|---|---|
| `surfaceAt(x, z)` | what's underfoot: `"wet"` (wet asphalt), `"puddle"`, `"wet-concrete"`, `"concrete"`, `"asphalt"` (dry, the morning), `"tile"` (showroom, office coffee corner), `"carpet"`, `"wood"` | lot, keys, office, memory |
| `puddles` | `[{ x, z, r }]`, the larger standing water on the lot (empty in the morning) | lot |
| `sounds` | where things make noise (all `{ x, y, z, kind }`, some with `w`, the width of a long source): | |
| | lot: `idle` (the black sedan by the showroom, engine running, lights on, kind `engine-idle`), `lamps` (each pole's head, `sodium-hum`), `gate` (`chain-link`), `road` (Almeda Genoa Rd beyond the fence, `traffic`), `rain` (`rain-canopy` along the showroom canopy, `rain-cars` over the rows, `rain-glass` on the storefront) | lot (keys: no idle, no rain) |
| | office: `window` (`rain-glass`), `lamps` (`fluorescent-hum`), `phone` (`desk-phone`), `laptop` (`laptop-fan`), `coffee` (`fridge-hum`), `arcade` (`arcade-attract`), `clock` (`clock-tick`, the wall clock above the break room door) | office |
| | memory: `windows` (`rain-glass`, w 18), `clock` | memory |
| `ready` | promise: the set's streamed textures are in | all |
| `lamps[i].car` | true for the idle car's headlight spill (not a pole; leave its cone alone) | lot |
| `cars` | `[{ kind, x, z, yaw, color, metal, idle }]` | lot |

Everything that was there before is unchanged: `lamps` (index 5 is still the
pole by Jason), `spots`, `walls`, `marks`, `gate`, `window`, `monitor`,
`phone.{g,led}`, `notes`, `book`, `arcadeScreen`, `deskLamp`, `bounds`,
`groundMat` (still a direct child's material, with `uRefl`, `uRes`, `uReflK`,
`uRain`), `camRail`, `camLook`. No `nav` is given: every car, pole, desk,
shelf and fence is in `walls`, which nav.js already reads.

## 3. Requests for main.js (not mine to change)

1. **Rain streaks near the camera** (`makeRain`): they read as smears close up.
   Fade them in from about 4 m instead of 2.5 m and cap the side offset
   (`side * position.x * 3.0` makes near drops wide); about 1.2 and a length
   of 0.25 m keeps them as streaks.
2. **Depth of field only in conversations**: explore sets `uDofK = 0.45`,
   which blurs the lot in plain walking. The brief asks for none outside talk.
3. Optional: listen for `jg:world-load` (see 1).
4. Quality: your ladder (`quality` 0 to 2 and `pixelRatio`) still drives
   post.js. The world's own tier is by pointer: phones get the lighter cars
   (`-lo`, about a quarter of the triangles) and 512 textures; `?wq=lo|hi`
   forces one for testing. `TIER` is exported if you want to show it.

## 4. What changed in the look

- **Cars** (tools/story/world/cars.py, first-party): sedan, compact, hatch,
  SUV and pickup, lofted in Blender from side, plan and section profiles,
  smoothed, wheel wells cut, glass, pillars, bumpers and rocker assigned from
  the loft, lamps (lens plus a lit inner element), grille, plates (plain,
  embossed, no characters), mirrors, handles, wipers, lathed wheels with
  spoked rims and discs, interiors and headrests behind the glass, ambient
  occlusion baked to vertex colour. Paint is clear-coated with rain beading,
  panel lines drawn from each car's measurements, colour per car, solid or
  metallic. Instanced by kind and material (about 60 draws for 30 cars).
  One car idles by the showroom with its lights on.
- **The lot**: tiled CC0 asphalt (two scales against repetition) under a baked
  layer of patches, oil under engines, worn paint, tar-sealed cracks, puddles
  (one where the story's puddle spot is), a concrete apron, contact shade
  under every car and pole, and **baked lamp shadows** (each pole's light
  through the cars, a channel per lamp). GGX lamp highlights, a planar mirror
  in puddles and streaked on wet asphalt, rain rings and splashes. Steel lot
  lights on concrete bases, wheel stops, a showroom with a canopy, downlights,
  storefront glass (Fresnel) and a real room behind it (tile floor, light
  panels, counter, posters without words, plants, three cars), chain-link with
  a top rail and barbed wire, the rolling gate, Almeda Genoa Road beyond with
  cobra-head street lights, power poles and wires, a strip of low buildings
  across the road, palms, and a cloud deck lit from below.
- **Office**: carpet, painted drywall, a suspended ceiling with 2 by 4
  troffers, room-corner occlusion, a wood desk with clutter (papers, folder,
  mug of coffee, pen cup, stapler, a sticky note), an arm lamp, task chairs,
  a four-drawer cabinet with label holders, an aluminium-framed whiteboard
  with markers, a stocked bookshelf, a coffee counter, a printer, armchairs,
  framed pictures, a wall clock without numerals, blinds, and the window onto
  the lot with drops clinging and runs sliding down.
- **Library**: herringbone parquet, wood wainscot under plaster, beams,
  banker's lamps in green, pendants, full stacks, Windsor-ish chairs, a cart,
  tall windows with rain over a dark campus.
- **paint.js**: `pbr()` (GGX, Fresnel, metal, clear coat, baked or analytic
  AO, normal and ARM maps by UV or projected, water beads, glass, panel lines,
  reflections from a cube each set renders of itself once it is on screen).
  `paint()` (the people) is unchanged except the skin notes from
  HANDOFF-people.md section 6 (under-eye channel, warmer cheeks, softer skin
  highlight). `blobMat(k, rect)` can draw a rounded rectangle.

## 5. Building the assets

```
# Blender 4.2 LTS headless (no extensions needed)
blender -b --python tools/story/world/cars.py -- /tmp/cars          # 5 raw GLBs
node tools/story/world/pack.mjs /tmp/cars v1                          # assets/story/world/car-<kind>[-lo]-v1.glb
python3 tools/story/world/textures.py /tmp/ph-cache                   # assets/story/world/tex-v1/*.webp from Poly Haven (CC0)
node tools/story/world/stills.mjs <tag> [desktop|phone|all] [lot office memory keys]   # tools/verify/out/real-world-*.png
node tools/story/world/probe.mjs "<expression>"                       # evaluate against /story/world.js in a blank page
```

`/assets` is cached for a year: a rebuilt car or texture set ships under a
new version (`v2`, `tex-v2`) and story/world.js moves with it.
