import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { theme } from "./theme";

export const BgMesh: React.FC = () => {
  const frame = useCurrentFrame();
  const d1 = Math.sin(frame / 90) * 60, d2 = Math.cos(frame / 110) * 50;
  return (
    <AbsoluteFill style={{ background: theme.colors.bg }}>
      <div style={{ position: "absolute", width: "70%", height: "70%", borderRadius: "50%", top: "-20%", left: `${-15 + d1 / 20}%`, filter: "blur(80px)",
        background: `radial-gradient(circle, ${theme.colors.velvet}, transparent 62%)`, opacity: 0.9 }} />
      <div style={{ position: "absolute", width: "55%", height: "55%", borderRadius: "50%", bottom: "-22%", right: `${-12 - d2 / 20}%`, filter: "blur(90px)",
        background: `radial-gradient(circle, rgba(201,166,66,0.16), transparent 65%)` }} />
    </AbsoluteFill>
  );
};

export const Grade: React.FC<{ strength?: number }> = ({ strength = 0.16 }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <AbsoluteFill style={{ backgroundColor: theme.colors.primary, mixBlendMode: "soft-light", opacity: strength }} />
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.14), transparent 26%, transparent 70%, rgba(0,0,0,0.28))" }} />
  </AbsoluteFill>
);

export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.07 }) => {
  const frame = useCurrentFrame();
  const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;
  return <AbsoluteFill style={{ pointerEvents: "none", backgroundImage: noise, backgroundSize: "220px", backgroundPosition: `${(frame * 7) % 220}px ${(frame * 13) % 220}px`, opacity, mixBlendMode: "overlay" }} />;
};

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.32 }) => (
  <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,${strength}) 100%)` }} />
);
