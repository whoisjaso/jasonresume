import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme";
import { BgMesh, Grade, Grain, Vignette } from "./layers";
import { LINES, LEAD_IN, TAIL } from "./vsl-data";

// One line of narration: the illustrated face on the left, the words on the
// right revealed at reading pace, a hairline of gold that fills as the line
// plays. Nothing else moves; the voice carries it.
const Line: React.FC<{ text: string; face: string; frames: number; index: number }> = ({ text, face, frames, index }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const unit = Math.min(width, height);
  const inP = spring({ frame, fps, config: theme.spring.smooth });
  const outP = interpolate(frame, [frames - 10, frames - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: theme.ease.in });
  const words = text.split(" ");
  const perWord = Math.max(2, (frames - 14) / words.length);
  const fill = interpolate(frame, [0, frames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const faceSize = unit * 0.5;
  const breathe = 1 + Math.sin(frame / 22) * 0.006;
  return (
    <AbsoluteFill style={{ opacity: outP }}>
      <div style={{ position: "absolute", left: width * 0.08, top: (height - faceSize) / 2, width: faceSize, height: faceSize, opacity: inP, transform: `translateY(${interpolate(inP, [0, 1], [18, 0])}px) scale(${breathe})` }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: theme.colors.bgAlt, overflow: "hidden", boxShadow: "0 60px 120px -50px rgba(0,0,0,0.9)" }}>
          <Img src={staticFile(`faces/${face}.webp`)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 30%" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(201,166,66,0.08), rgba(0,0,0,0) 40%, rgba(10,13,11,0.45) 100%)" }} />
        </div>
        <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: "-3%", width: "106%", height: "106%", transform: "rotate(-90deg)" }}>
          <circle cx="50" cy="50" r="49" fill="none" stroke="rgba(239,232,216,0.10)" strokeWidth="0.45" />
          <circle cx="50" cy="50" r="49" fill="none" stroke={theme.colors.primary} strokeWidth="0.7" strokeLinecap="round" strokeDasharray={2 * Math.PI * 49} strokeDashoffset={2 * Math.PI * 49 * (1 - fill)} opacity={0.85} />
        </svg>
      </div>
      <div style={{ position: "absolute", left: width * 0.08 + faceSize + width * 0.06, right: width * 0.08, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 26 }}>
        <div style={{ fontFamily: theme.fonts.body, fontWeight: 500, fontSize: Math.round(unit * 0.017), letterSpacing: "0.34em", textTransform: "uppercase", color: theme.colors.textMute, opacity: inP }}>
          {index === 0 ? "Jason Obawemimo" : index === LINES.length - 1 ? "jasonobawemimo.com/partners" : "Apohenia, Deal Packet Checker"}
        </div>
        <div style={{ fontFamily: theme.fonts.display, fontWeight: 500, fontSize: Math.round(unit * 0.062), lineHeight: 1.12, letterSpacing: "-0.01em", color: theme.colors.text }}>
          {words.map((w, i) => {
            const p = interpolate(frame - 6 - i * perWord, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: theme.ease.out });
            const gold = /Apohenia|Deal Packet Checker|Texas|webDEALER|county/i.test(w.replace(/[.,]/g, ""));
            return (
              <span key={i} style={{ display: "inline-block", marginRight: "0.26em", opacity: p, transform: `translateY(${(1 - p) * 10}px)`, color: gold ? theme.colors.primary2 : theme.colors.text, fontStyle: gold ? "italic" : "normal" }}>{w}</span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Card: React.FC<{ title: string; sub: string; frames: number }> = ({ title, sub, frames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const unit = Math.min(width, height);
  const p = spring({ frame, fps, config: theme.spring.smooth });
  const out = interpolate(frame, [frames - 12, frames - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const line = interpolate(frame, [8, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: theme.ease.out });
  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 22, opacity: Math.min(p, out) }}>
      <div style={{ fontFamily: theme.fonts.display, fontWeight: 500, fontSize: Math.round(unit * 0.11), lineHeight: 1, color: theme.colors.text, transform: `translateY(${(1 - p) * 20}px)` }}>{title}</div>
      <div style={{ width: unit * 0.24 * line, height: 1, background: "linear-gradient(90deg, rgba(201,166,66,0), rgba(201,166,66,0.7), rgba(201,166,66,0))" }} />
      <div style={{ fontFamily: theme.fonts.body, fontWeight: 500, fontSize: Math.round(unit * 0.018), letterSpacing: "0.34em", textTransform: "uppercase", color: theme.colors.textDim }}>{sub}</div>
    </AbsoluteFill>
  );
};

export const Vsl: React.FC = () => {
  let at = LEAD_IN;
  return (
    <AbsoluteFill>
      <BgMesh />
      <Sequence from={0} durationInFrames={LEAD_IN}><Card title="Apohenia" sub="Ninety seconds. Jason's voice." frames={LEAD_IN} /></Sequence>
      {LINES.map((l, i) => {
        const from = at; at += l.frames;
        return (
          <Sequence key={l.id} from={from} durationInFrames={l.frames}>
            <Audio src={staticFile(`vsl/${l.id}.mp3`)} />
            <Line text={l.text} face={l.face} frames={l.frames} index={i} />
          </Sequence>
        );
      })}
      <Sequence from={at} durationInFrames={TAIL}><Card title="Pick a time." sub="Thirty minutes. Me. No deck." frames={TAIL} /></Sequence>
      <Grade strength={0.14} />
      <Grain opacity={0.07} />
      <Vignette strength={0.34} />
    </AbsoluteFill>
  );
};
