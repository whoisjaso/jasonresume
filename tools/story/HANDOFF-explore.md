# After Hours: the open world, for whoever wires it

Owner: the WORLD layer (story/world.js, story/tex.js). main.js already reads this contract
(`worldSpots`, `useWorld`, `roam`); this note says what the sets now hold and what each thing does.
Nothing here states a fact: labels are one or two plain words, the only text on anything is
generic ("Bus stop", "Closed", "OFFICE"), and everyone and everything across the road is fictional.

## 1. The contract

Every exit and every thing you can use is an entry in `set.userData.spots` with:

| field | what |
|---|---|
| `kind` | `exit`, `toggle`, `open`, `sit`, `press`, `pickup`, `read`, `splash`, `knock` |
| `label` | short, for the prompt: "Lid", "Lamp", "Bench" |
| `p` | Vector3, the thing itself (the reach target) |
| `stand` | Vector3, where you stand to use it (for an exit: where you arrive when you come back through it) |
| `r` | reach radius |
| `on` | its state; main.js flips it before calling `use` |
| `use({ kind, on })` | the world's answer: it animates the state (`act` is the same function) |
| `to` | exits only: the scene it takes you to |
| `seat`, `yaw` | sit only: the hip point and the facing for the sitter |
| `text` | read only: the words on it (generic) |

`set.userData.things` lists the ids the world added. The animations (lids, doors, drawers, the
crosswalk signal, the falling can, the cat, the moth, lights fading) run themselves from a hook in
the render, once a frame, without allocating. `set.userData.tick(dt, { player })` runs them by hand
(tests and stills use it). Sounds are main.js's: `AU.use(kind, at, on)`. A few things also add a
sound emitter while they're on (`set.userData.sounds.radio` while the radio plays).

## 2. Exits

| set | id | to | where | arrive at (`stand`) |
|---|---|---|---|---|
| lot, keys | `door` (the story's office door spot, now also `kind: "exit"`) | office | the office door by the showroom, x 13, z -17.6 | (13, -16.3) |
| office | `office-exit` | lot | the door on the left wall, by the coffee corner | (-6.0, 4.2) |
| memory | `memory-exit` | office | double doors at the end of the runner, lit over the top | (0, 7.6) |

The lot and the morning lot open onto the road through the gate: there is no exit spot for it,
you just walk or drive out (the old invisible wall across the gate is gone).
Marks for arrivals: office `marks["lot-door"]` (and `"lot-doorYaw"`), memory
`marks["office-door"]`. The office door opens with `set.userData.officeDoor.open(t)`, which main.js
already drives on the way in and out.

## 3. The open world (lot and keys sets)

- Walkable: the lot, the sidewalks, Almeda Genoa Road from x -77 to 77, and the places across it.
  `set.userData.nav` is now `{ x0: -77.5, x1: 77.5, z0: -26.4, z1: 56.5, cell: 0.4 }`; walls close the
  far ends and the back.
- Drivable (`set.userData.driveBounds`): the lot, the gate, the road from x -76 to 76, the gas
  station's forecourt, the empty lot.
- Across and along the road (all fictional, no names, no prices, no numbers):
  - a **crosswalk** by the gate (x -7.5), with a button and a signal on each side
  - a **bus stop** on the far side (x -18): a shelter with a glass back, a lit roof, a bench, a sign
    with a bus drawn on it
  - a **closed shop** (x 7 to 21): the shutter down, a dark sign band, a side door with a "CLOSED"
    card and a light over it
  - a **gas station** (x 26 to 42), open and lit under its canopy: two pump islands with lit screens,
    the kiosk at the back with its windows lit
  - an **empty lot** (x -38 to -22): gravel, weeds, one streetlight on a wooden pole, a puddle
- Life: a moth circling the lamp by Jason; a stray cat by the dumpster that walks off when you come
  near and wanders back when you leave.

## 4. Things, by set

Lot (night; the morning lot has the same except the puddles):

| id | kind | label | what happens |
|---|---|---|---|
| `showroom-lights` | toggle | Lights | the showroom's panels, downlights and its light on the lot fade down and back (starts on) |
| `vending` | press | Machine | a can drops into the tray |
| `dumpster` | open | Lid | the lid swings up |
| `mailbox` | open | Mailbox | the door drops open |
| `showroom-glass` | knock | Glass | (sound only) |
| `puddle-0..2` | splash | Puddle | (sound only; the story's own puddle spot is unchanged) |
| `crosswalk-0`, `crosswalk-1` | press | Button | the button lights, both signals show walk for 8 s, blinking at the end |
| `bus-bench` | sit | Bench | seat (x -18, y 0.49, z 40.08), facing the road |
| `bus-sign` | read | Sign | "Bus stop" |
| `shop-door`, `shop-shutter` | knock | Door, Shutter | (sound only) |
| `shop-sign` | read | Sign | "Closed" |
| `pump-0`, `pump-1` | press | Pump | (sound only) |
| `kiosk-door` | knock | Door | (sound only) |
| `lot-puddle` | splash | Puddle | the empty lot's puddle |

Office:

| id | kind | label | what happens |
|---|---|---|---|
| `desk-lamp` | toggle | Lamp | the arm lamp and its light (starts on) |
| `office-lights` | toggle | Lights | the troffers and the room's light, by the switch at the door (starts on) |
| `radio` | toggle | Radio | its dial lights; `sounds.radio` is set while it plays |
| `drawer` | open | Drawer | the filing cabinet's top drawer slides out, files in it |
| `fridge` | open | Fridge | the door swings open onto a lit inside |
| `chair-2` | sit | Chair | the second desk's chair |
| `armchair-l`, `armchair-r` | sit | Armchair | by the window |
| `mug` | pickup | Mug | a mug on the coffee counter: hidden while held, back on put-down; `set.userData.held = "mug"` |

Library (memory):

| id | kind | label | what happens |
|---|---|---|---|
| `reading-lamps` | toggle | Lamps | every banker's lamp and its light (starts on) |
| `lib-chair-0..3` | sit | Chair | chairs at the reading tables |
| `cart-book` | pickup | Book | a book on the cart: hidden while held; `set.userData.held = "book"` |

Cars: hood, trunk and horn go through story/vehicle.js (HANDOFF-drive.md); the models have no
hood or trunk nodes yet.

## 5. Tests and stills

- `node tools/story/world/things-test.mjs`: builds all four sets, uses every thing on and off, runs
  the tick with someone walking past; checks the kinds, labels, seats and that each set has an exit.
- `node tools/story/world/explore-stills.mjs [desktop|phone|all] [view ...]` writes
  tools/verify/out/explore-<view>-<vp>.png. Views: road, bus, crosswalk, shop, gas, empty, dumpster,
  vending, fridge, exit, doors.
