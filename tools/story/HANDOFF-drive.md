# After Hours: driving, for whoever wires it

Owner: the WORLD layer (story/vehicle.js, story/world.js, tools/story/world/cars.py,
assets/story/world/car-*-v2.glb). FEEL (main.js: input, camera, audio) and PEOPLE
(people.js: the driver's pose, hands, getting in and out) build against this.
Status lines at the bottom say what is real and what is still a plan.

## 0. Conventions (all of it)

- Units: metres, seconds, radians, m/s. `speed` is signed (negative is reverse).
- A car's local frame: **+Z is forward, +X is the driver's side (left, US cars), +Y up**,
  origin on the ground under the middle of the car (half way along its length).
- A car's world pose is `x, z, yaw` with `forward = (sin yaw, 0, cos yaw)`, the same yaw the
  parked cars use (`set.userData.cars[i].yaw`).
- Inputs: `throttle` 0..1, `brake` 0..1, `steer` -1..1 (**+1 is right**), `handbrake` 0..1 (or a bool).

## 1. Which cars

`set.userData.drivable` (lot and keys sets) is a list of the cars you can drive, each one
`{ id, kind, x, z, yaw, color, metal, idle, object, wall }`:

- `id`: `"idle"` (the black sedan idling by the showroom at x 16.6, z -11.2, facing the lot; night
  only; engine running, headlights and cluster on; it owns the `car: true` lamp and moves
  `set.userData.sounds.idle` with it), `"car"` (the car at the head of the entrance aisle in the row
  at z 4.5, x about -1.6, facing the fence; a sedan in this layout), `"truck"` (the pickup at the
  `truck` spot, x about 4.8, z 4.5, facing the fence). The keys set (the morning) has `car` and
  `truck`, no `idle`.
- `object`: the car's root (a Group in the set at its parked pose). Its rig (body, doors, wheels,
  steering wheel, seats, its own lamp materials) is built when the car models land, so **create a
  vehicle after `await set.userData.ready`** (createVehicle throws before that).
- `wall`: the entry in `set.userData.walls` that is its footprint. vehicle.js keeps it on the
  car as it moves (it mutates `x0 x1 z0 z1`), so the walk collision and nav follow. If nav.js
  caches its grid, rebuild it after a drive (`set.userData.navDirty` turns true when a drivable
  car has moved more than 0.5 m since the last time you cleared it).
- `x, z, yaw` are kept current while it's driven.

These cars are not in the instanced parked rows. `set.userData.parked` is the rest (each with its
`collider`); `set.userData.cars` still lists every car on the lot. A parked car that's hit rocks on
its springs and creeps a few centimetres at most (`set.userData.rockCar(car, strength, nx, nz)`,
animated by `set.userData.tickCars(dt)`, which `update` calls for you).

Layout changes that came with driving: the fence row keeps its stalls in front of the gate empty,
and there is no power pole or palm in front of the gate (it's a driveway now).

## 2. The API (story/vehicle.js)

```js
import { createVehicle } from "./vehicle.js";
const car = createVehicle(set, set.userData.drivable[0], { quality });   // quality 0..2 from main.js, optional
// every frame (vehicle.js substeps internally at 1/120 s; pass the real dt, it clamps at 0.1):
car.update(dt, { throttle, brake, steer, handbrake });
```

Read every frame:

| field | what |
|---|---|
| `speed` | m/s along the car's forward axis, signed |
| `kmh`, `mph` | abs speed |
| `rpm` | engine rpm, 800 idle to 6400 redline (0 when the engine is off) |
| `gear` | `-1` reverse, `0` neutral (engine off or stopped with no input), `1..5` |
| `load` | 0..1 how hard the engine is working (throttle times torque); for the engine sound |
| `slip` | 0..1 how much the tyres are sliding (for squeal and smoke) |
| `slipF`, `slipR` | 0..1 front and rear separately |
| `drifting` | true while the rear is out more than about 12 degrees at speed |
| `steerAngle` | the front wheels' angle now, rad (+ is right) |
| `wheelAngle` | the steering wheel's angle now, rad (+ is right; about 14 times the road wheels) |
| `onRoad` | true past the gate, on Almeda Genoa Road |
| `surface` | what's under the car: `set.userData.surfaceAt` at its centre (`wet`, `puddle`, ...) |
| `events` | what happened during this update (cleared at the start of the next): `{ type: "impact", strength, x, y, z, nx, nz, what }` (strength is the closing speed in m/s; `what`: `"car"`, `"pole"`, `"wall"`, `"fence"`, `"gate"`, `"bound"`), `{ type: "bump", wheel, strength }` (a wheel over a wheel stop), `{ type: "shift", gear }`, `{ type: "door", side, open }`, `{ type: "splash", wheel, strength }` (a wheel through a puddle) |
| `impacts` | the last 8 impacts, newest last, same shape as the events |
| `pose` | `{ x, y, z, yaw, pitch, roll, vx, vz, speed }` of the body (pitch and roll are the suspension's) |

Parts (Object3D, live, read their world matrices):

| field | what |
|---|---|
| `object` | the car's root (its position and yaw are the pose) |
| `body` | the sprung part: tilts with pitch and roll and bobs; the doors, seats, wheel and dash are inside it |
| `seat` | the driver's hip point (H-point), facing +Z of the car. `seatP`: the passenger's |
| `steeringWheel` | the wheel, pivot at its hub. `steeringWheel.userData.rimR` is the rim's centre-line radius (m) |
| `grips()` | `{ left, right, normal }` world Vector3s: the rim at 10 and 2 o'clock as it turns now, and the wheel's face normal toward the driver |
| `wheels` | `[FL, FR, RL, RR]` nodes, pivot at the hub (FL is the driver's side front) |
| `doors` | `doors.open(side, t)` with side `"driver"`/`"left"` or `"passenger"`/`"right"`, t 0..1 (1 is about 65 degrees); `doors.get(side)` the t now; `doors.node(side)` the door (pivot on the hinge, local Y up). `doors.handle(side)` the outside handle's world point, `doors.inner(side)` the inside pull |
| `lights` | `lights.set({ head, tail, brake, reverse, cluster })` each true/false or 0..1; `update` drives `brake` and `reverse` from the inputs on its own unless you set `lights.auto = false`. `head` also moves a lamp (in `set.userData.lamps`, `car: true`) with the car |
| `engine` | `engine.on` (bool), `engine.start()`, `engine.stop()`; off means no drive, no rpm, no cluster glow |

Other calls: `reset(x, z, yaw)`, `park()` (stop, handbrake, engine left as is), `dispose()`
(puts it back as a parked car where it stands).

Reverse is automatic, the arcade way: holding `brake` when nearly stopped engages reverse and
`brake` then drives backwards; `throttle` in reverse brakes, and pulls it back into first once stopped.

## 3. The car models (assets/story/world/car-<kind>[-lo]-v2.glb)

Kinds: `sedan`, `compact`, `hatch`, `suv`, `truck`. `-lo` is the phone tier (about a quarter
of the triangles); the nodes and names are the same in both.

Nodes (three.js names after GLTFLoader):

| node | pivot | what |
|---|---|---|
| `car` | ground, middle | root; extras: `L W H cab sg pillars axles tr arch belt` (as before) plus `seat` (H-point xyz), `rimR`, `hinge` |
| `body` | same as root | the shell, glass, interior, dash, seats, lamps (by material) |
| `door_L`, `door_R` | the hinge: the door's front edge, outer skin, half way up | the front doors, outer skin, glass, door card |
| `wheel_FL` `wheel_FR` `wheel_RL` `wheel_RR` | the hub | tyre, rim, disc; spin about local X |
| `steer` | the hub | the steering wheel (rim, spokes, boss); turns about its local Z |
| `seat_D`, `seat_P` | the H-point | empties: the driver's and passenger's hip point |

Materials by role (world.js paints them): `paint glass trim chrome tire rim disc well
interior seat dash cluster lamp_head lamp_head_in lamp_tail lamp_tail_in lamp_brake lamp_rev
lamp_amber plate`. Glass is see-through (you can see the seats, the dash and the wheel).

Measurements, in the car's local frame (metres; x the driver's side, y up, z forward; with the body at
rest; the same numbers are in each file's extras on the `car` node and on `car.object.userData.rig.meta`):

| kind | L | W | H | seat (H-point) | wheel hub | door hinge (driver's) | wheels FL (others mirror x, rear z) |
|---|---|---|---|---|---|---|---|
| sedan | 4.82 | 1.84 | 1.46 | 0.387, 0.558, -0.190 | 0.387, 0.918, 0.310 | 0.893, 0.545, 0.740 | 0.79, 0.34, 1.43 / rear z -1.39 |
| compact | 4.45 | 1.76 | 1.45 | 0.370, 0.559, -0.225 | 0.370, 0.919, 0.275 | 0.853, 0.539, 0.675 | 0.76, 0.32, 1.30 / -1.32 |
| hatch | 4.15 | 1.76 | 1.50 | 0.372, 0.557, -0.245 | 0.372, 0.917, 0.255 | 0.858, 0.554, 0.685 | 0.76, 0.31, 1.22 / -1.35 |
| suv | 4.85 | 1.93 | 1.75 | 0.408, 0.635, -0.075 | 0.408, 0.995, 0.425 | 0.941, 0.682, 0.855 | 0.82, 0.37, 1.43 / -1.41 |
| truck | 5.75 | 2.00 | 1.91 | 0.421, 0.701, 0.225 | 0.421, 1.061, 0.725 | 0.971, 0.773, 0.975 | 0.85, 0.39, 1.82 / -1.75 |

- The passenger's seat (`seat_P`) is the driver's mirrored (x negated).
- **The steering wheel**: rim centre-line radius **0.185 m** (`rimR`), rim tube 0.016 m; the hub is
  0.50 m ahead of the H-point and 0.36 m above it; the column tilts the wheel's face **24 degrees** back
  from vertical (`column`, 0.419 rad). In the `steer` node's own frame the wheel lies in its XY plane:
  **local +Y is 12 o'clock, local +X the driver's left (9 o'clock side), local -Z points at the driver's
  chest**. Hands at 10 and 2: local `(+0.160, +0.0925, 0)` and `(-0.160, +0.0925, 0)` (that is
  `rimR * (±sin 60, cos 60, 0)`), which `grips()` gives you in world space as it turns. Turning right
  is a positive turn about local Z (`wheelAngle`, about 14 times the road wheels; lock to lock about
  1.4 turns each way at a standstill, less at speed).
- **The doors**: the front doors only (rear doors stay shut). Pivot on the front edge of the door at
  the outer skin, half way between the sill and the belt; they turn about the body's local Y. Fully
  open is 1.13 rad (65 degrees): the driver's door turns to `rotation.y = -1.13`, the passenger's to
  `+1.13`. The opening runs from the hinge back about 1.0 to 1.3 m (to the B pillar) and from the sill
  (about 0.28 m up on a sedan) to the roof rail. The outside handle: `doors.handle(side)`; the inside
  pull: `doors.inner(side)`.
- **The cabin**: front seats (cushion top about 0.07 m under the H-point, back reclined 18 degrees,
  headrest), a rear bench in the four-doors, a console, the dash with a lit cluster behind the wheel
  and a screen in the middle (material `cluster`, glows when the engine runs), the steering column, a
  floor, and the shell's inner side (dark trim). The glass is see-through.
- Phone tier: same nodes, about 70 KB a car (desktop about 145 KB). All five kinds: 364 KB phone,
  728 KB desktop (v1 was 239 and 447).

## 4. Colliders and bounds

`set.userData.colliders`: static shapes in the set's space, what the car hits:

- `{ type: "box", x, z, hw, hl, yaw, h, what }`: oriented box (half width along local X, half
  length along local Z). `what` is `"car"` (parked; heavy, rocks a little when hit), `"wall"`
  (showroom, pylon, can, buildings) or `"fence"`.
- `{ type: "circle", x, z, r, what }`: poles (lot lights and their bases, power poles, street
  lights, palms, the pylon's legs).
- `{ type: "bump", x, z, hw, hl, h }`: wheel stops (a wheel rides over, 0.13 m).
- The gate is live: its box follows `set.userData.gate.position` (it spans x from gate.x - 3.4
  to gate.x at z 21.9), so open it by moving the gate as main.js already does.

`set.userData.driveBounds`: `{ rects: [{ x0, x1, z0, z1, name }], soft: [...] }`: where a car may
be. The lot inside the fence, the gate's opening, and Almeda Genoa Road (z 24.4 to 37.6) from
x -60 to 60. Past the road's ends there is a soft wall (a spring, no crash) and the event
`{ type: "impact", what: "bound" }` with a small strength, so the camera can turn you round.
`inDriveBounds(x, z)` is on `set.userData` too.

## 5. Status

- [ ] cars rebuilt with nodes (v2)
- [ ] vehicle.js driving
- [ ] colliders and bounds
- [ ] stills and drive-test
