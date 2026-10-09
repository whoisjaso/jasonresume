import { Easing } from "remotion";

/* The walkthrough film, in the After Hours Library's own terms (DESIGN.md):
   ink grounds, bone type, bottle green for what is held, no chromatic accent;
   Cormorant Garamond capitals name things, Hanken Grotesk does the talking.
   One ease for entrances (the site's), a symmetric one for the camera, and
   springs damped to settle without overshoot. */
export const T = {
  c: {
    ink: "#0a0f0d",
    lacquer: "#111b17",
    bottle: "#1c3229",
    bone: "#ede7db",
    bone2: "#d9d2c4",
    ash: "#9a9890",
    hair: "rgba(237,231,219,0.14)",
    hair2: "rgba(237,231,219,0.24)",
  },
  f: {
    serif: '"Cormorant Garamond", Garamond, serif',
    sans: '"Hanken Grotesk", system-ui, sans-serif',
  },
  ease: {
    /* the site's one ease: arrives and settles */
    out: Easing.bezier(0.2, 0.7, 0.1, 1),
    /* exits leave quickly */
    in: Easing.bezier(0.6, 0, 0.9, 0.4),
    /* the camera: slow off the mark, slow into the stop */
    cam: Easing.bezier(0.45, 0.05, 0.55, 0.95),
  },
  spring: {
    /* critically damped: no wobble, no overshoot */
    settle: { damping: 200, stiffness: 120, mass: 1 },
    word: { damping: 200, stiffness: 220, mass: 0.7 },
  },
  /* frames a shot overlaps its neighbours: the cut is always a dissolve */
  overlap: 14,
} as const;

/* what each shot names, as a logotype (none for the opening drawing and the end card) */
export const CHAPTER: Record<string, string> = {
  title: "The title screen",
  seat: "Who's playing",
  build: "The build",
  card: "The card",
  library: "The library",
  focus: "Focus",
  opened: "Open a title",
  desk: "The sale desk",
  trophies: "Trophies",
  profile: "Level 53",
  player2: "Player 2",
  resume: "The resume",
};

type Cam = { z: number; x: number; y: number };
/* the stills each shot shows (in order, dissolving), and the camera inside the
   screen: from one framing to another, x and y as fractions of the still */
export type ShotPlan = { stills: string[]; from: Cam; to: Cam };
const c = (z: number, x: number, y: number): Cam => ({ z, x, y });
export const WIDE: Record<string, ShotPlan> = {
  title: { stills: ["title"], from: c(1.0, 0.5, 0.5), to: c(1.12, 0.3, 0.42) },
  seat: { stills: ["seat"], from: c(1.08, 0.3, 0.45), to: c(1.32, 0.24, 0.44) },
  build: { stills: ["build"], from: c(1.04, 0.45, 0.4), to: c(1.24, 0.42, 0.34) },
  card: { stills: ["card"], from: c(1.06, 0.4, 0.42), to: c(1.3, 0.3, 0.36) },
  library: { stills: ["library"], from: c(1.22, 0.32, 0.26), to: c(1.14, 0.3, 0.7) },
  focus: { stills: ["library", "focus-1", "focus-2"], from: c(1.06, 0.4, 0.62), to: c(1.14, 0.34, 0.66) },
  opened: { stills: ["opened"], from: c(1.04, 0.42, 0.4), to: c(1.22, 0.36, 0.34) },
  trophies: { stills: ["platinum", "trophies"], from: c(1.04, 0.5, 0.45), to: c(1.16, 0.42, 0.42) },
  profile: { stills: ["profile"], from: c(1.04, 0.5, 0.42), to: c(1.34, 0.6, 0.3) },
  player2: { stills: ["player2"], from: c(1.04, 0.45, 0.42), to: c(1.2, 0.36, 0.42) },
  resume: { stills: ["deck", "verify", "resume"], from: c(1.04, 0.5, 0.45), to: c(1.18, 0.55, 0.38) },
};
export const TALL: Record<string, ShotPlan> = {
  title: { stills: ["m-title"], from: c(1.0, 0.5, 0.5), to: c(1.06, 0.4, 0.6) },
  seat: { stills: ["m-seat"], from: c(1.02, 0.5, 0.5), to: c(1.1, 0.45, 0.55) },
  build: { stills: ["m-build"], from: c(1.02, 0.5, 0.4), to: c(1.1, 0.5, 0.45) },
  card: { stills: ["m-card"], from: c(1.02, 0.5, 0.4), to: c(1.12, 0.5, 0.3) },
  library: { stills: ["m-library"], from: c(1.1, 0.5, 0.2), to: c(1.06, 0.5, 0.7) },
  focus: { stills: ["m-library", "m-focus"], from: c(1.02, 0.5, 0.6), to: c(1.1, 0.45, 0.62) },
  opened: { stills: ["m-opened"], from: c(1.02, 0.5, 0.4), to: c(1.1, 0.45, 0.3) },
  trophies: { stills: ["m-trophies"], from: c(1.02, 0.5, 0.4), to: c(1.1, 0.45, 0.35) },
  profile: { stills: ["m-profile"], from: c(1.02, 0.5, 0.4), to: c(1.16, 0.4, 0.82) },
  player2: { stills: ["m-player2"], from: c(1.02, 0.5, 0.4), to: c(1.1, 0.45, 0.35) },
};
export const DESK = ["desk-0", "desk-1", "desk-2", "desk-3", "desk-4", "desk-5", "desk-6", "desk-7", "desk-8"];
/* the score's stings, placed where the site plays them (frames after a shot starts) */
export const STING: Record<string, { name: string; at: number }> = {
  title: { name: "start", at: 26 },
  seat: { name: "select", at: 40 },
  build: { name: "select", at: 50 },
  card: { name: "trophy-gold", at: 18 },
  opened: { name: "open", at: 10 },
  trophies: { name: "level-clear", at: 8 },
};
