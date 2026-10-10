import { Easing } from "remotion";

/* After Hours, the walkthrough film, in the After Hours Library's own terms:
   ink grounds, bone type, no chromatic accent (the key art carries the colour);
   Cormorant Garamond for the act cards, Hanken Grotesk for the captions.
   Three easing characters (arrive, leave, the camera) and springs damped to
   settle without overshoot. */
export const T = {
  c: {
    ink: "#0a0f0d",
    night: "#050807",
    bone: "#ede7db",
    bone2: "#d9d2c4",
    ash: "#9a9890",
  },
  f: {
    serif: '"Cormorant Garamond", Garamond, serif',
    sans: '"Hanken Grotesk", system-ui, sans-serif',
  },
  ease: {
    /* the site's one ease: arrives and settles */
    out: Easing.bezier(0.2, 0.7, 0.1, 1),
    /* exits accelerate away */
    exit: Easing.bezier(0.55, 0.055, 0.675, 0.19),
    /* the camera: slow off the mark, long settle */
    cam: Easing.bezier(0.45, 0.05, 0.55, 0.95),
    /* a dolly through a hold */
    dolly: Easing.bezier(0.35, 0, 0.65, 1),
  },
  spring: {
    /* critically damped: no wobble, no overshoot */
    settle: { damping: 200, stiffness: 120, mass: 1 },
    letter: { damping: 200, stiffness: 160, mass: 0.8 },
    word: { damping: 200, stiffness: 220, mass: 0.7 },
    heavy: { damping: 200, stiffness: 60, mass: 1.4 },
  },
} as const;

/* the lot (assets/game/art/triple-j-w, 1920 by 1080): its six lamps, the
   showroom, and where each lamp's light lies on the wet ground. The line drawing
   (tools/art/boot.py) is drawn over the same coordinates. */
export const LAMPS = [
  { x: 1110, y: 279, r: 560, wet: 820, wr: 300 },
  { x: 1426, y: 415, r: 360, wet: 720, wr: 170 },
  { x: 1537, y: 448, r: 250, wet: 700, wr: 140 },
  { x: 1591, y: 469, r: 210, wet: 690, wr: 120 },
  { x: 1633, y: 483, r: 190, wet: 680, wr: 110 },
  { x: 1851, y: 456, r: 280, wet: 690, wr: 150 },
];
export const SHOWROOM = { x: 1790, y: 540, rx: 230, ry: 120, wet: 660 };

/* the six titles' living key art, in library order (assets/game/loops) and,
   for the tall cut, where each plate's subject sits across its width */
export const PLATES: { id: string; loop: string; tallX: number }[] = [
  { id: "triple-j", loop: "triple-j-w", tallX: 0.7 },
  { id: "lead-to-title", loop: "lead-to-title", tallX: 0.6 },
  { id: "the-inbound", loop: "the-inbound", tallX: 0.76 },
  { id: "prospector", loop: "prospector", tallX: 0.45 },
  { id: "neuroscience", loop: "neuroscience", tallX: 0.6 },
  { id: "obavia", loop: "obavia", tallX: 0.78 },
];
