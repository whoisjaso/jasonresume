import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme";
import { BgMesh, Grade, Grain, Vignette } from "./layers";

export const Signature: React.FC<{ portrait?: boolean }> = ({ portrait = false }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const unit = Math.min(width, height);

  // medallion
  const inP = spring({ frame, fps, config: theme.spring.smooth });
  const kb = interpolate(frame, [0, durationInFrames], [1.04, 1.12], { easing: theme.ease.inOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ring = interpolate(frame, [6, 58], [1, 0], { easing: theme.ease.out, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const breathe = 1 + Math.sin(frame / 26) * 0.006;
  const size = unit * (portrait ? 0.46 : 0.42);
  const R = 49, C = 2 * Math.PI * R;

  // name
  const words = ["Jason", "Obawemimo"];
  const tagP = spring({ frame: frame - 44, fps, config: theme.spring.smooth });
  const lineP = interpolate(frame, [30, 80], [0, 1], { easing: theme.ease.out, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // light sweep across the medallion
  const sweep = interpolate(frame, [52, 92], [-120, 220], { easing: theme.ease.inOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // exit
  const exitO = interpolate(frame, [durationInFrames - 14, durationInFrames - 2], [1, 0], { easing: theme.ease.in, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exitS = interpolate(frame, [durationInFrames - 14, durationInFrames - 2], [1, 1.03], { easing: theme.ease.in, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const nameSize = portrait ? unit * 0.11 : unit * 0.115;

  return (
    <AbsoluteFill>
      <BgMesh />
      <AbsoluteFill style={{ opacity: exitO, transform: `scale(${exitS})`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: portrait ? 44 : 34 }}>
        <div style={{ position: "relative", width: size, height: size, transform: `scale(${interpolate(inP, [0, 1], [0.92, 1]) * breathe}) translateY(${interpolate(inP, [0, 1], [30, 0])}px)`, opacity: inP }}>
          <div style={{ position: "absolute", inset: "7%", borderRadius: "50%", overflow: "hidden", background: theme.colors.bgAlt, boxShadow: "0 60px 120px -40px rgba(0,0,0,0.9)" }}>
            <Img src={staticFile("img/portrait.png")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 22%", transform: `scale(${kb})` }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(201,166,66,0.10), rgba(0,0,0,0) 35%, rgba(10,13,11,0.55) 100%)" }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, width: "38%", left: `${sweep}%`, background: "linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,240,200,0.16) 50%, rgba(255,255,255,0) 100%)", mixBlendMode: "screen" }} />
          </div>
          <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
            <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(239,232,216,0.10)" strokeWidth="0.5" />
            <circle cx="50" cy="50" r={R} fill="none" stroke={theme.colors.primary} strokeWidth="0.8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * ring} opacity={0.9} />
          </svg>
        </div>

        <div style={{ display: "flex", flexDirection: portrait ? "column" : "row", alignItems: "center", gap: portrait ? 0 : Math.round(nameSize * 0.32), fontFamily: theme.fonts.display, fontWeight: 500, fontSize: nameSize, lineHeight: 1, letterSpacing: "0.01em", color: theme.colors.text }}>
          {words.map((w, i) => {
            const p = spring({ frame: frame - 22 - i * 7, fps, config: theme.spring.smooth });
            return (
              <span key={w} style={{ display: "inline-block", opacity: p, transform: `translateY(${interpolate(p, [0, 1], [26, 0])}px)`, color: i === 1 ? theme.colors.primary : theme.colors.text, fontStyle: i === 1 ? "italic" : "normal" }}>{w}</span>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <div style={{ width: unit * 0.22 * lineP, height: 1, background: `linear-gradient(90deg, rgba(201,166,66,0), rgba(201,166,66,0.7), rgba(201,166,66,0))` }} />
          <div style={{ fontFamily: theme.fonts.body, fontWeight: 500, fontSize: Math.round(unit * 0.017), letterSpacing: "0.36em", textTransform: "uppercase", color: theme.colors.textDim, opacity: tagP, transform: `translateY(${interpolate(tagP, [0, 1], [10, 0])}px)` }}>
            Founder of Apohenia
          </div>
        </div>
      </AbsoluteFill>
      <Grade strength={0.14} />
      <Grain opacity={0.08} />
      <Vignette strength={0.36} />
    </AbsoluteFill>
  );
};
