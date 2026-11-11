# The visitor's look: what story/people.js gives the character creator

The visitor's own character (the `player` body, the one main.js keeps as `me`) can be
made your own. Nobody else can: `setLook` on Jason, Dell, Renata, Marisol, the crew or
a passer-by resolves to `null` and changes nothing.

```js
import { lookOptions, defaultLook } from "./people.js";

const look = await me.setLook({ skin: "#74492f", hair: { style: "buzz" } }); // the whole look now worn
me.getLook();          // a copy of it (plain JSON: save this)
lookOptions();         // what can be chosen (below)
defaultLook("a");      // the look a body starts with ("a" or "b")
```

## setLook(part)

Pass any part of a look; what you leave out stays as it is. It resolves to the whole
look now worn, as plain JSON. Out-of-range numbers are clamped, unknown ids and bad
colours are ignored, so a saved look from an older version is safe to pass back in.

```js
{
  body: "a" | "b",                       // the two bodies (player-v3.glb, renata-v3.glb)
  height: 1.5 .. 1.92,                   // metres
  build: -1 .. 1,                        // slight to heavy
  skin: "#rrggbb",
  hair: { style, color: "#rrggbb" },     // styles: a: bald, buzz, short, full; b: bald, cropped, ponytail
  eyes: { color: "#rrggbb" },
  nose: { width: -1 .. 1, length: -1 .. 1 },
  mouth: { width: -1 .. 1, fullness: -1 .. 1 },
  brows: -1 .. 1,                        // thin to heavy
  jaw: -1 .. 1,                          // narrow to wide
  outfit: "earth" | "wine" | "charcoal" | "navy" | "olive" | "teal" | "sand" | "black"
}
```

- Colours, the face, the build, the hair and the outfit apply in the same frame (they
  are uniforms on the materials): call it on every slider move.
- `body` and `height` build the body again in place: the same `me` object, where it
  stands, with its key, shadow and whatever else main.js set on it. That takes a
  fetch from the cache and a few milliseconds, so the promise matters: await it, and
  set them while the character is standing (not seated, in a car or mid-reach). Calls
  that overlap are safe: the newest wins.
- Changing `body` without a `height` or a hair style takes that body's own height
  (a 1.66, b 1.6) and its own hair (a short, b ponytail); the skin, eyes and outfit
  carry over.
- Both bodies run on the same skeleton and the same clips: walk, run, jump, sit, the
  car, reaches. The body is rebuilt with every bone's place and bind matrix scaled, so
  the stride, the planted feet and the reach are measured at the new height.

## lookOptions()

```js
{
  bodies: [{ id: "a", label, height }, { id: "b", label, height }],
  height: { min, max, step, unit: "m" },
  build: { min: -1, max: 1, step, default: 0 },
  skin: ["#...", ...],                   // a palette; any #rrggbb is accepted
  hair: { styles: { a: [{ id, label }], b: [{ id, label }] }, colors: ["#...", ...] },
  eyes: { colors: ["#...", ...] },
  nose: { width: range, length: range },
  mouth: { width: range, fullness: range },
  brows: range, jaw: range,
  outfits: [{ id, label, color }],       // color: a swatch for the button
  defaults: { a: look, b: look }
}
```

## What it is made of

- Height: the bones and bind matrices of a fresh copy of the body, scaled (scaleBody).
- Build: the skin and the clothes pushed out or drawn in along their normals below the
  neck, most round the middle, none on the hands and feet (story/paint.js, USE_BODY).
- Nose, mouth, jaw: soft pushes round landmarks found on the body itself (the tip of
  the nose, the middle of the mouth), in the same vertex stage, under the face's
  expression shapes, so talking, blinking and smiling still work.
- Hair: body a's hair is one shell that knows the way to the scalp (`_SCALP`, written
  by tools/story/cast_v3.mjs) and is worn close, as it is or grown out; body b's
  ponytail is drawn whole or cropped to the head. Shaved hides it.
- Eyes: the iris is recoloured in the eye's shader; the white, the pupil and the dark
  ring stay.
- Outfits: colour sets on the body's own clothes (main cloth, light cloth, shoes).

## Not there

- No other clothing meshes: an outfit is a colour set on the suit each body came with.
- No beard, glasses or hats for the visitor.
- Body b's skirt can open over the thigh on a long stride (it does on Renata too).
