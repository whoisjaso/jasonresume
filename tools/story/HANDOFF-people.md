# People: hooks for story/main.js

The cast (story/people.js, assets/story/cast/*-v2.glb, clips-v2.glb) works with
main.js as it stands. The calls below make it better. Each is one line, and
people.js already exports what it needs.

## 1. Lip-sync from the voice (wanted)

In `tickLine`, inside `if (line.audio) { ... }`, next to the line that sets
`line.sp.talk` from the words:

```js
if (line.sp && line.sp.speak) line.sp.speak(line.words, now);
```

The mouth then makes a viseme for each sound in each word, timed to the word
timings in assets/voice/story-v3/*.json, and the brows and head react to stressed
words. Without this call the mouth still moves with `talk`, using generic
syllables.

## 2. Footsteps (done on our side; main.js sets it)

`p.onFoot = (side, weight) => ...` is called with side "L" or "R" each time a
foot plants: about 0.7 walking, 1 running, 0.2 for a small step while standing
or turning on the spot. It replaces the footstep fallback based on
`floor(phase / PI)`. `p.phase` still advances, so that fallback keeps working
until main.js switches over.

## 3. Cast version (optional, cosmetic)

`const VER = "v2";`, or `import { CAST_VER } from "./people.js"`. people.js
already maps any `-v1` request to `-v2`, so this is only for clarity.

## 4. One-shot moves (optional, nice)

`p.play(kind)` returns the move's length in seconds. kind is one of:

- "pickup": bend and pick something up
- "reach" or "interact": reach out and touch
- "give": hold a hand out (handing over keys, a shake)
- "yes": a nod
- "no": a head shake

Suggested calls:

```js
me.play("reach");          // in interact(), when you examine an object you can touch (ledger, phone, keys)
P.jason.play("give");      // in the keys memory, when the keys change hands
me.play("pickup");         // in the keys memory, when you take them, if they are low
```

## State people.js reads (unchanged)

pos, wantYaw, speed, talk, nod, brow, smile, lookAtP, pose ("stand" or
"sit"), and hold ("umbrella", "phone" or null).

The walk speed is measured from how far `pos` actually moves each frame. If
the body is blocked, it stands instead of walking on the spot. The stride and
cadence follow the measured speed, so any walk or run speed main.js chooses
keeps the feet planted. The jog clip is natural at about 2.6 to 3.0 m/s.

## 5. Standing styles (optional)

`p.idleStyle = "fold"` (arms folded) or `"lean"` (forearms resting on a rail
or a car roof, so place the person facing the car), and `null` to clear it.
The change blends in over about half a second.

## 6. For story/paint.js (the materials owner): skin variation

The face mask now carries more detail. B is warmth on the cheeks, the nose
and a soft mottle (up to 1). The new A channel is the cooler, thinner skin
under the eyes: 1 means none, lower means cooler. paint.js still reads only
R, G and B. One line after `alb *= 1.0 + fm.b * ...` in the USE_MASK block
would use the new channel:

```glsl
alb *= mix(vec3(0.9, 0.93, 1.0), vec3(1.0), fm.a);
```

Raising the warmth term from 0.12 to about 0.18 would also lift the cheeks
and nose. A soft roughness and subsurface look for skin is paint.js's to
add, for example a slightly broader wrap and lower specular on `uSkin`.

## 7. Hands, reaching for things (wanted)

The hands now have a pose library (relaxed, flat, open, fist, grip, pinch,
point, phone), with per-finger curls blended per hand by what the body does.
Running uses loose fists swung by IK. Walking swings the arms past the thighs.
Standing lets the arms hang (the idle capture clasped the hands, and the fingers
went through each other). Talking makes word-timed open-palm beats. Forearm
twist and wrist limits keep the palms facing the thighs, with no bent-back
wrists.

To touch, take or press something, the hand goes to the object's real point
with two-bone arm IK: approach, contact, retract. The body leans, turns or
squats when the point is far or low.

```js
await me.reachTo(worldPoint, { hold: "touch" });              // ledger, laptop, a sign: a flat hand on it
await me.reachTo(keysWorldPoint, { hold: "pinch" });          // keys, a card, a book off a shelf
await me.reachTo(handleWorldPoint, { hold: "grip", stay: true }); // resolves at contact and holds on
await me.release("l");                                        // let go of a held reach
await me.reachTo(buttonWorldPoint, { hold: "press" });        // a fingertip on a button
```

Options: `hand` "l" or "r" (default: the side the point is on), `hold`,
`stay`, `palm` (a world direction for the palm at contact), `dur` (the approach
in seconds) and `onContact()`. The point may be a live `Vector3` or a function,
so a hand on a door handle follows the door as it opens. In `interact()`,
`me.reachTo(point, { hold })` replaces `me.play("reach")`, which still works.
`me.hold = "phone"` now holds the phone at the ear by IK, with a small phone
in the hand (`me.showPhone = false` hides it).

## 8. Cars (wanted, against tools/story/HANDOFF-drive.md)

```js
await me.enterCar(car, "driver");   // walk to the door, open it by the handle, step in, sit, legs in, close it, hands on the wheel
me.drive(car);                      // or me.driving = car: straight into the seat (skips, saves); me.driving = null: out at once
await me.exitCar(car);              // the reverse: let go of the wheel, open the door, legs out, stand, step clear, close it
me.inCar                            // true from the start of enterCar until exitCar resolves
```

While a sequence runs, people.js moves the body. main.js leaves `me.pos` and
`me.wantYaw` alone until the promise resolves, and while seated the body
follows `car.body` (pitch and roll included).

Seated, the driver:

- sits with the hips on the seat's H-point, leaning back
- holds the rim at about 10 and 2, the hands following it as it turns; past
  about 75 degrees, or when an arm would straighten, a hand lets go and takes
  the rim again (hand over hand), and one that is still out of reach slides
  round the rim
- keeps the right foot on the accelerator, moving it to the brake (`car.throttle`
  and `car.brake`, or `car.input.throttle` and `car.input.brake`)
- looks into the turn (`car.steerAngle`, or `car.wheelAngle / 14`)
- is thrown outward in corners and pitches with acceleration and braking

The steering wheel's turning axis is read from its mesh (the thinnest axis),
and the turn from `steeringWheel.rotation[axis]`.

## 9. Voice timings (for whoever owns assets/voice and the line clock)

Laid over the audio, my lines' word timings (narrate_jason.py, from
faster-whisper) are compressed: right at the start, then early by 0.2 to 0.4 s
by the end of a line. The captions light words early, and the mouth closes
while the voice is still talking. The fictional voices are on time, but each
line's last word runs on into the silence after it.

`tools/story/retime.py` fits each line's timings to its own audio. On the 126
story lines it takes the agreement between "inside a word" and "voice on" from
0.843 to 0.926, the lag to a median of 0 ms, and the last word's end to within
2 ms of the voice's. The retimed set ships as assets/voice/story-v3 (story.json
points at it; /assets is cached for a year, so a new directory, never an
in-place rewrite). Both narrators now run the same fit on every line before
writing it (`retime_words()` in narrate_jason.py and narrate_free.py), so new
renders come out timed. For files already rendered:
`/root/kvenv/bin/python -I tools/story/retime.py <voice dir> [--write <dir>]`.

people.js itself caps each word's mouth shapes to the time they take to say, so
a word whose timing runs on closes the mouth. With the blend rates now used,
the mouth leads the sound by 10 to 60 ms, as lips do.

## 10. Things to do (wanted, for the open world)

Every move below returns a promise, blends in from whatever the body was doing
(walking, running, standing, talking) and back out again. Points are world
`Vector3`s (read live, so a moving lid or door can be followed) or functions
returning one. While one runs, main.js keeps steering the body as usual. The
exceptions are `sitDown`/`standUp`, which move the body like the car sequences:
leave `pos`/`wantYaw` alone until they resolve.

```js
await me.sitDown(seatPoint, facing);     // seatPoint: the seat's surface; facing: a yaw or a point. Walks to the
                                         // front of it, turns, sits back with the feet gathered, settles; seated idle:
                                         // hands on the thighs, breathing, talking beats lift the hands off the lap
me.sitAt(seat, yaw);                     // the same (main.js already calls this)
me.seatApproach(seat, facing);           // the floor point sitDown walks to: path there first if anything's in the way
me.seated;                               // true once settled
await me.standUp();                      // feet under, lean forward, rise; walking again when it resolves

await me.pickUp(obj, { hand, hold });    // a cup from the side ("cup"), anything flat or small with a "pinch", a
                                         // handle "grip" (default by its size). The thing then follows the hand,
                                         // upright, turned with the body; carried in front of the waist while walking
await me.putDown(point, { hand });       // its base onto point, upright; let go; the hand back
me.carrying;                             // { l, r }: what each hand holds

await me.knock(point, { n: 3, normal, onKnock(i) });   // knuckles to the door, n taps, onKnock on each (play the sound)
await me.press(point, { onContact });                  // a fingertip on a button
await me.flip(point, { dir: "down" | "up", onFlip });  // a light switch: fingertip on it, a short push, onFlip at the click
await me.openWith(handlePoint, { dur, onProgress(t) });              // one hand: a drawer, the fridge, a mailbox
await me.openLid(() => ({ l, r }), { dur, onProgress(t), letGo });  // both hands on a hood or trunk lid's edge; the
me.openHatch(...)                                                    // hands ride up with it and let go at letGo (0.7)
await me.lookAt(point, { read: true, dur: 4 });        // head and eyes on it; read: the eyes go along lines
me.lookAt(null);                                       // stop looking
await me.reachTo(point, { hold, stay, cl, keepAim, pose, dur, onContact }); // the general reach these are built on
```

`onProgress(t)` (0 to 1) is where the world moves the drawer, lid or door. The
hands follow the live points while they hold on.

## 11. Phones and cost

- Feet stay planted at 30, 15 and 10 fps: walking, running, starting,
  stopping and turning on the spot. A lock that can't hold lets go and blends.
  It never snaps. An overextended stance foot peels off instead of dragging.
  Landing a foot uses where it is, not where it was last planted.
- No pops: every hold blends in by its weight, and approach and return times
  scale with distance.
- One person's `update()` measures 30 to 55 µs warm in headless Chromium
  standing, walking or talking, and about 41 µs driving.

## Checks

- `node tools/story/lab-check.mjs`: the gate, exits 1 on any failure:
  - a holding hand more than 2 cm off the wheel's rim, a reach target, the
    thigh it rests on, or what it carries
  - a carried thing jumping; a thing put down more than 2 cm off its spot
  - hips more than 3 cm off the seat
  - any pop through the things to do
  - a planted foot sliding, or a pop, walking, running or turning at 30, 15
    or 10 fps
  - an update over 100 µs
- `tools/story/lab.html`:
  - `?run=reach&pt=0..3&cam=reachl|reachr`
  - `?run=car&car=sedan&seq=enter|drive|exit&cam=car|carin|carside`
  - `?run=talk|jog|walk&cam=hand|arm|armr`
  - `?run=ix&seq=sit|cup|knock|switch|lid|read|all&cam=ix` (the things to do,
    with a chair, two tables, a cup, a book, a door, a switch, a button, a lid
    and a sign; `&talk=1` talks seated; `&seed=` varies the run, which is the
    same every time by default)
  - `lab-shots.mjs ... [w h fps]` renders at a phone's frame rate
  - `?words=<voice line id>` plays a line's timings on the mouth (`&vdir=` picks the voice directory)
