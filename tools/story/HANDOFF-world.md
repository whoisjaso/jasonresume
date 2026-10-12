# After Hours: the world, for whoever wires it

Owner of this layer: story/world.js, story/paint.js, story/post.js, story/tex.js,
assets/story/world/ and tools/story/world/. This note says what the sets now
expose, what the rest of the episode can (or should) do with it, and how the
assets are built.

## 1. Loading

- `story/world.js` starts its downloads as soon as it is imported and exports
  `lotReady`, a promise that settles when the lot's assets (the five cars and
  the asphalt and concrete textures) are in or have given up. There is no
  top-level await: main.js awaits `lotReady` (with its own 15 s cap) before it
  builds the lot, and drives its bar from the progress events. It never hangs:
  every texture resolves (to `null`, flat colour) after 12 s or on an error,
  every car file rejects after 12 s and the lot uses a kind that did load.
- Nothing in world.js assumes the lot is loaded: a lot built before
  `lotReady` settles parks its cars when they land, patches the ground's and
  the poles' textures in, and re-renders its reflection cube.
- Progress: each finished file fires `document` event `jg:world-load` with
  `detail: { f (0..1), done, total }`.
- The office's and library's textures (`roomsReady`) load in the background
  after the lot's. A set built before they land renders with flat colours and
  patches itself in when they arrive. Every set has `set.userData.ready`
  (a promise) if you would rather wait.
- Budget (files are already compressed): desktop lot: cars 447 KB +
  asphalt (1024 colour, 512 normal and ARM) and concrete 494 KB = 0.94 MB;
  phone lot: cars 239 KB + 512 textures 251 KB = 0.49 MB. Rooms afterwards:
  desktop 0.74 MB, phone 0.30 MB. With three.js and the story scripts
  (1.35 MB raw, about 0.4 MB gzipped) and the lot's people and clips (about
  1.75 MB), the first scene is about 3.1 MB transferred on desktop and
  2.6 MB on a phone.

## 2. Hooks on `set.userData`

| key | what | sets |
|---|---|---|
| `surfaceAt(x, z)` | what's underfoot: `"wet"` (wet asphalt), `"puddle"`, `"wet-concrete"`, `"concrete"`, `"asphalt"` (dry, the morning), `"tile"` (showroom, office coffee corner), `"carpet"`, `"wood"` | lot, keys, office, memory |
| `puddles` | `[{ x, z, r }]`, the larger standing water on the lot (empty in the morning) | lot |
| `sounds` | where things make noise (all `{ x, y, z, kind }`, some with `w`, the width of a long source): | |
| | lot: `idle` (the black sedan by the showroom, engine running, lights on, kind `engine-idle`), `lamps` (each pole's head, `sodium-hum`), `gate` (`chain-link`), `road` (Almeda Genoa Rd beyond the fence, `traffic`), `rain` (`rain-canopy` along the showroom canopy, `rain-cars` over the rows, `rain-glass` on the storefront) | lot (keys: no idle, no rain) |
| | office: `fridge` (`fridge-hum`), `window` (`rain-glass`), `lamps` (`fluorescent-hum`), `phone` (`desk-phone`), `laptop` (`laptop-fan`), `coffee` (`coffee-machine`), `arcade` (`arcade-attract`), `clock` (`clock-tick`, the wall clock above the break room door) | office |
| | memory: `windows` (`rain-glass`, w 18), `clock` | memory |
| `ready` | promise: the set's streamed textures are in | all |
| `fogDen` | the room's own fog density, applied every frame while the set is up (office 0.006, memory 0.006); the lot leaves main.js's value alone | office, memory |
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
node tools/story/world/pack.mjs /tmp/cars v2                          # assets/story/world/car-<kind>[-lo]-v2.glb
python3 tools/story/world/textures.py /tmp/ph-cache                   # assets/story/world/tex-v1/*.webp from Poly Haven (CC0)
node tools/story/world/stills.mjs <tag> [desktop|phone|all] [lot office memory keys]   # tools/verify/out/real-world-*.png
node tools/story/world/probe.mjs "<expression>"                       # evaluate against /story/world.js in a blank page
```

`/assets` is cached for a year: a rebuilt car or texture set ships under a
new version (`v2`, `tex-v2`) and story/world.js moves with it.

## 6. Verification, last run

- `node tools/story/world/smoke.mjs lot office memory keys`: all open, no page errors.
- `story.mjs` under the shared lock: desktop every branch clean; landscape every branch clean;
  portrait failed once on a different step in each of two runs ("laptop did not respond", then
  "board did not respond") at 1 to 3 fps under a load average near 19, while the same steps
  passed in the other portrait branches. Worth a rerun on a quiet machine.
- The harness URL (`?debug=story&fast=1`) gets the light world tier (`-lo` cars, 512 textures,
  no clear-coat lamp loop) so the game clock keeps up on SwiftShader; stills.mjs pins `wq`.

## 7. Driving (this pass)

The cars are v2 (`car-<kind>[-lo]-v2.glb`): the same bodies cut into parts that move (front doors on
hinges, wheels on hubs, the steering wheel on its column), a cabin behind see-through glass, reverse
and third brake lamps. Three of them on the lot are drivable rigs (`set.userData.drivable`), driven by
story/vehicle.js against `set.userData.colliders` and `set.userData.driveBounds`. The contract for
main.js and people.js is tools/story/HANDOFF-drive.md. Build: `cars.py` then `pack.mjs <dir> v2`
(the phone tier is simplified aggressively, `-sa`). Tests: `drive-test.mjs`, `drive-stills.mjs`.
The fence row leaves the stalls in front of the gate empty and the road has no pole or palm in
front of the gate, so a car can drive out onto Almeda Genoa Road.

## 8. Phones: the performance pass

What the phone tier (`TIER.name === "lo"`, which is `LOWQ` in paint.js: a coarse pointer, `?wq=lo`, or
the fast harness) does differently, and what main.js can call:

- **Warm-up, no hitches**: `warmSet(renderer, camera, set)` (world.js, async) compiles every material in
  a set, including the hidden ones (the drivable rigs, the office door's room, the fridge's inside),
  and uploads its textures to the GPU. Call it for each set during loading, after
  `set.userData.ready` (lot, office, memory, keys), so entering a scene or a car never stalls on a
  shader compile or a texture upload. It shows hidden parts only inside one synchronous
  `renderer.compile`, so nothing hidden is ever drawn.
- **Cars**: the phone files fold the near-black and the bright-metal materials into one each (about
  10 materials a kind instead of 21), so each kind costs about half the draws. A drivable car
  standing still is drawn with the parked rows (one instance slot per part); its rig shows only
  while story/vehicle.js has it (`set.userData.showRig(car, on)`, which createVehicle and dispose
  call). The rig's four wheels are one instanced mesh per material (all tiers).
- **The wet ground's mirror** (post.js `lite`, on by default on phones; `post.lite = false` turns it
  off): a quarter of the screen instead of a half, and it leaves out every car part but the lamps
  (`set.userData.reflectSkip()`, the list it hides for that pass).
- **Bloom** on phones: three levels from a quarter of the screen, one blur each way, added back up
  without copy passes (11 passes instead of 23). Depth of field stays off below quality 2 (main.js).
- **No garbage per frame** in world or vehicle code: the collision helpers write into shared buffers,
  inputs reuse one object, the lamps' colours are set only when they change, the parked cars' rocking
  reuses its matrices, and the things' animations allocate nothing.
- Measure: `node tools/story/world/perf.mjs <tag> [land,port,desk] [scene ...]` (phone viewport, DPR 3,
  CPU slowed 4x through CDP, the pixel ratio pinned tiny so software GL keeps up; reports the main
  thread's ms per frame, draw calls, triangles, texture memory; stills at
  tools/verify/out/real-world-perf-<tag>-<scene>-<vp>.png).

For main.js (not mine to change): the arcade's VideoTexture re-uploads the whole clip every frame in
the office (the biggest texture cost on a phone: update it every other frame, or only when the
cabinet is on screen); `updateLamps` allocates a copy and sorts all lamps every frame; the rain's
particle count on phones (`quality >= 2 ? 800 : 420`) could go to about 250.
