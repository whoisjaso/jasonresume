import { Easing } from "remotion";

/* The dash: the site is the instrument cluster of a car. Ivory gauge faces with
   black ticks and a signal-red needle, brushed-chrome bezels, black dash
   leather with cognac stitching, tell-tale lamps in their real colors, gold
   only on the badge. Every color, easing and spring the films use lives here. */
export const dash = {
  c: {
    dash: "#131211",
    dash2: "#1c1a18",
    panel: "#25221f",
    seam: "#0a0909",
    stitch: "#a0622d",
    cognac: "#6e3a1c",
    dial: "#efe8d8",
    dialShade: "#d9d1bf",
    ink: "#161514",
    inkDim: "#6a645a",
    needle: "#e0442a",
    chromeHi: "#eef0f2",
    chromeMid: "#9a9ea3",
    chromeLo: "#44484d",
    text: "#efe8d8",
    dim: "#b8b1a3",
    mute: "#8a8478",
    green: "#3bd16f",
    amber: "#f2a33a",
    gold: "#c9a642",
  },
  font: { sans: "Hanken Grotesk", serif: "Cormorant Garamond" },
  ease: {
    out: Easing.bezier(0.16, 1, 0.3, 1),
    inOut: Easing.bezier(0.83, 0, 0.17, 1),
    in: Easing.bezier(0.7, 0, 0.84, 0),
    soft: Easing.bezier(0.33, 1, 0.68, 1),
  },
  spring: {
    needle: { damping: 14, stiffness: 70, mass: 1 },
    snappy: { damping: 16, stiffness: 140, mass: 0.7 },
    smooth: { damping: 22, stiffness: 80, mass: 1 },
    slow: { damping: 26, stiffness: 50, mass: 1.2 },
  },
} as const;

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
