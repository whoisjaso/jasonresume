import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme";
import { Grade, Grain, Vignette } from "./layers";

type Shot = { src: string; from: number; to: number; pos: [string, string]; zoom: [number, number]; pan: [number, number]; kicker: string; line: string };

const Still: React.FC<{ s: Shot }> = ({ s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - s.from, len = s.to - s.from;
  const inO = interpolate(local, [0, 14], [0, 1], { easing: theme.ease.out, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outO = interpolate(local, [len - 10, len], [1, 0], { easing: theme.ease.in, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(local, [0, len], s.zoom, { easing: theme.ease.inOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pan = interpolate(local, [0, len], s.pan, { easing: theme.ease.inOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const capP = interpolate(local, [16, 40], [0, 1], { easing: theme.ease.out, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const capOut = interpolate(local, [len - 16, len - 6], [1, 0], { easing: theme.ease.in, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (local < 0 || local > len) return null;
  return (
    <AbsoluteFill style={{ opacity: Math.min(inO, outO) }}>
      <Img src={staticFile(s.src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${s.pos[0]} ${s.pos[1]}`, transform: `scale(${scale}) translateY(${pan}px)` }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "58%", background: "linear-gradient(180deg, rgba(5,7,6,0) 0%, rgba(5,7,6,0.55) 45%, rgba(5,7,6,0.92) 100%)" }} />
      <div style={{ position: "absolute", left: 64, bottom: 56, opacity: Math.min(capP, capOut), transform: `translateY(${interpolate(capP, [0, 1], [14, 0])}px)` }}>
        <div style={{ fontFamily: theme.fonts.body, fontWeight: 500, fontSize: 18, letterSpacing: "0.32em", textTransform: "uppercase", color: theme.colors.primary2 }}>{s.kicker}</div>
        <div style={{ marginTop: 10, fontFamily: theme.fonts.display, fontWeight: 500, fontSize: 52, lineHeight: 1.04, color: theme.colors.text, maxWidth: 900 }}>{s.line}</div>
      </div>
    </AbsoluteFill>
  );
};

export const Screen: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  const third = Math.round(durationInFrames / 3);
  const shots: Shot[] = [
    { src: "img/apohenia-hero.png", from: 0, to: third + 8, pos: ["50%", "60%"], zoom: [1.08, 1.0], pan: [0, 14], kicker: "apohenia.com", line: "Deal Packet Checker reads the packet before the county does." },
    { src: "img/apohenia-poster.png", from: third - 6, to: third * 2 + 8, pos: ["50%", "50%"], zoom: [1.0, 1.08], pan: [0, -10], kicker: "Apohenia", line: "Intelligence for every deal. Founded by Jason Obawemimo." },
    { src: "img/triplej.png", from: third * 2 - 6, to: durationInFrames, pos: ["50%", "42%"], zoom: [1.1, 1.02], pan: [-12, 12], kicker: "thetriplejauto.com", line: "Triple J Auto Investment. Clear vehicles, clear terms, real people." },
  ];
  return (
    <AbsoluteFill style={{ background: "#050706" }}>
      {shots.map((s, i) => <Still key={i} s={s} />)}
      <Grade strength={0.12} />
      <AbsoluteFill style={{ pointerEvents: "none", background: "linear-gradient(112deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 40%)" }} />
      <Grain opacity={0.06} />
      <Vignette strength={0.28} />
    </AbsoluteFill>
  );
};
