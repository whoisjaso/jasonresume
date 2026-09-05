import { Easing } from "remotion";
export const theme = {
  colors: {
    bg: "#0a0d0b", bgAlt: "#101512", velvet: "#0e2620",
    primary: "#c9a642", primary2: "#e6c964", accent: "#2f8f6b",
    text: "#efe8d8", textDim: "#c9c2b2", textMute: "#8f8a7c",
    glow: "rgba(201,166,66,0.35)",
  },
  fonts: { display: "Cormorant Garamond", body: "Hanken Grotesk" },
  ease: {
    out: Easing.bezier(0.16, 1, 0.3, 1),
    inOut: Easing.bezier(0.83, 0, 0.17, 1),
    in: Easing.bezier(0.7, 0, 0.84, 0),
    soft: Easing.bezier(0.33, 1, 0.68, 1),
  },
  spring: {
    snappy: { damping: 16, stiffness: 140, mass: 0.7 },
    smooth: { damping: 22, stiffness: 80, mass: 1 },
    slow: { damping: 26, stiffness: 50, mass: 1.2 },
  },
} as const;
