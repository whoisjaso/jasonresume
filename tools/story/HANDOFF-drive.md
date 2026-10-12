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

- `id`: `"idle"` (the black sedan idling by the showroom, night only, engine already running,
  lights on), `"sedan"` (a sedan in the row by the entrance aisle), `"truck"` (the pickup at the
  `truck` spot). The keys set (morning) has no idle car, the other two are there.
- `object`: the car as a real hierarchy (not instanced), already in the set at its parked pose.
- `wall`: the entry in `set.userData.walls` that is its footprint. vehicle.js keeps it on the
  car as it moves (it mutates `x0 x1 z0 z1`), so the walk collision and nav follow. If nav.js
  caches its grid, rebuild it after a drive (`set.userData.navDirty` turns true when a drivable
  car has moved more than 0.5 m since the last time you cleared it).

These cars are no longer drawn by the instanced parked rows; everything else is unchanged.

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

Measurements (sedan; the others are in each file's extras and on `car.spec` in vehicle.js):
filled in below once the models are built.

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
