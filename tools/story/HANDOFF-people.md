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
timings in assets/voice/story/*.json, and the brows and head react to stressed
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
