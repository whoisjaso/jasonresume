import { Easing, interpolate } from "remotion";

/* After Hours Library: the living loops. A visitor rests on a title for three
   seconds and its still key art dissolves into eight seconds where one light
   behaves. Every loop is 240 frames at 30 fps, and every motion rides a sine
   path or an eased window that is dark at both ends, so frame 240 is frame 0.

   The plates are graded already (bottle green shadow, sodium amber, brass,
   bone), so light is never painted on top in a new colour: it relights the
   plate's own pixels, scaled by a tint taken from the practical that casts it.
   Left of TYPE_EDGE is where the type sits: no light goes there, and the push
   is anchored on that edge, so the dark zone only ever shows its own pixels. */

const FPS = 30;
const SECONDS = 8;
export const LOOP = { fps: FPS, seconds: SECONDS, frames: FPS * SECONDS, w: 1920, h: 1080 } as const;

export const TYPE_EDGE = 0.42;
/* the gate in plate pixels: nothing lit left of `from`, full light from `to` */
export const GATE = { from: Math.round(TYPE_EDGE * LOOP.w) + 24, to: Math.round(TYPE_EDGE * LOOP.w) + 96 } as const;

/* a push of 1.5 percent and back, on a sine, anchored where the type zone ends */
export const PUSH = { amount: 0.015, ox: TYPE_EDGE * LOOP.w, oy: 0.62 * LOOP.h } as const;

export const lib = {
  ease: {
    /* sine-shaped in and out: slow off the mark, slow into the stop */
    drift: Easing.bezier(0.37, 0, 0.63, 1),
    /* a longer hold at each end, for a light that crosses once */
    sweep: Easing.bezier(0.45, 0.05, 0.55, 0.95),
    /* rain on a window: a drop hangs, lets go, then catches */
    slide: Easing.bezier(0.6, 0.02, 0.3, 1),
  },
  /* channel gains for each practical, read off the plates' own highlights */
  light: {
    headlamp: [1, 0.86, 0.64],
    brass: [1, 0.8, 0.52],
    amber: [1, 0.68, 0.32],
    rain: [0.8, 0.9, 1],
    paper: [1, 0.87, 0.64],
    dusk: [0.84, 0.93, 1],
    dawn: [1, 0.93, 0.82],
  },
  /* the art bible's bone, for the few marks drawn outright (motes, one glint) */
  bone: "#EDE7DB",
  boneWarm: "#F2E2C2",
  shadow: "#0A0F0D",
  /* animated grain over the plate's own frozen grain: overlay, so blacks stay black */
  grain: 0.11,
} as const;

export type Tint = readonly [number, number, number];

export const TAU = Math.PI * 2;
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/* 0 at both ends of the loop, 1 at the middle (or `cycles` times round): the sine path */
export const swell = (frame: number, cycles = 1, offset = 0) =>
  (1 - Math.cos(TAU * (cycles * (frame / LOOP.frames) + offset))) / 2;

/* a periodic wobble in -1..1 that closes on itself every loop */
export const orbit = (frame: number, cycles: number, phase: number) => Math.sin(TAU * (cycles * (frame / LOOP.frames) + phase));

/* a light that crosses once: eased progress through [a, b] and an envelope dark at both ends */
export const pass = (frame: number, a: number, b: number, ease = lib.ease.sweep) => {
  const p = interpolate(frame, [a, b], [0, 1], { easing: ease, ...clamp });
  const raw = interpolate(frame, [a, b], [0, 1], { easing: lib.ease.drift, ...clamp });
  const env = Math.pow(Math.sin(Math.PI * raw), 2);
  return { p, env };
};

/* the same, for an event that may wrap round the loop's seam (rain drops) */
export const passWrapped = (frame: number, start: number, dur: number, ease = lib.ease.slide) => {
  const t = (((frame - start) % LOOP.frames) + LOOP.frames) % LOOP.frames;
  if (t >= dur) return { p: 0, env: 0, on: false };
  const p = interpolate(t, [0, dur], [0, 1], { easing: ease, ...clamp });
  const raw = interpolate(t, [0, dur], [0, 1], { easing: lib.ease.drift, ...clamp });
  return { p, env: Math.pow(Math.sin(Math.PI * raw), 1.6), on: true };
};
