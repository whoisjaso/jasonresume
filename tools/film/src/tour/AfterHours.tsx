import React from "react";
import {
  AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, continueRender, delayRender, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import timeline from "./timeline.json";
import boot from "./boot.json";
import lines from "../../../voice/tour_lines.json";
import { LAMPS, PLATES, SHOWROOM, T } from "./theme";

/* After Hours: the walkthrough as a journey, not a tour of screens.
   One world: the used car lot at night (the title screen's key art and the
   loading screen's line drawing of it), the six titles' living key art, and
   the library's own score. The device is the lot's lamps: one strikes in the
   dark and opens the film, each act card lights another, a lamp's light flares
   and the camera goes through it into the next place; at the end the camera
   pulls back to the whole lot and the lamps go out one by one.
   The camera only travels forward until that last pull back. Between the lot
   visits, one plate or one object at a time: the Player 2 card, the plates, the
   sale desk's phone, one trophy medal, Level 53, the resume page. Captions are
   one line in the lower letterbox bar, each word lighting on the narrator's own
   timing (timeline.json, from tools/voice/timeline.mjs).
   32 fps, so the score's 64 BPM is a whole 30 frames a beat. */

type Word = { w: string; s: number; e: number };
type Shot = { shot: string; card: string | null; line: string | null; text: string; from: number; frames: number; speakAt: number | null; speechFrom: number | null; voiced: boolean; audio: string | null; words: Word[] };
const TL = timeline as unknown as { fps: number; beat: number; frames: number; voiced: boolean; shots: Shot[] };
export const AH_FRAMES = TL.frames;
export const AH_FPS = TL.fps;
const FPS = TL.fps, BEAT = TL.beat, BAR = BEAT * 4;
const S: Record<string, Shot> = Object.fromEntries(TL.shots.map((s) => [s.shot, s]));
const end = (s: Shot) => s.from + s.frames;
/* the frame a word of a shot's line is said */
const wordAt = (s: Shot, i: number) => Math.round((s.speechFrom || 0) + (s.words[Math.max(0, Math.min(s.words.length - 1, i))]?.s || 0) * FPS);
const lastWord = (s: Shot) => Math.round((s.speechFrom || 0) + (s.words.length ? s.words[s.words.length - 1].e : 0) * FPS);
const findWord = (s: Shot, re: RegExp, from = 0) => { for (let i = from; i < s.words.length; i++) if (re.test(s.words[i].w)) return i; return from; };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lmix = (a: number, b: number, k: number) => Math.exp(lerp(Math.log(a), Math.log(b), k));
const ramp = (f: number, a: number, b: number, ease: (x: number) => number = T.ease.out) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: ease });
/* the one envelope for a punch: a quick rise, an exponential fall */
const hitPulse = (f: number, attack = 2, tau = 6) => (f < 0 ? 0 : f < attack ? Math.sin((f / attack) * Math.PI / 2) : Math.exp(-(f - attack) / tau));
const src = (p: string) => staticFile("tour/" + p);

/* ---------- fonts: the site's own Cormorant Garamond and Hanken Grotesk ---------- */
if (typeof window !== "undefined" && typeof document !== "undefined" && !(window as any).__ahFonts) {
  (window as any).__ahFonts = true;
  const h = delayRender("after hours fonts");
  const faces = [
    new FontFace("Cormorant Garamond", `url(${src("fonts/cormorant.woff2")}) format("woff2")`, { weight: "300 700", style: "normal" }),
    new FontFace("Hanken Grotesk", `url(${src("fonts/hanken.woff2")}) format("woff2")`, { weight: "100 900", style: "normal" }),
  ];
  Promise.all(faces.map((f) => f.load()))
    .then((l) => { l.forEach((f) => (document as any).fonts.add(f)); continueRender(h); })
    .catch(() => continueRender(h));
}

/* ---------- the frame: 2.39:1 on the wide cut, a tall window on the vertical ---------- */
type Geo = { W: number; H: number; ax: number; ay: number; aw: number; ah: number; capY: number; cap: number; card: number; tall: boolean };
const geo = (tall: boolean): Geo => tall
  ? { W: 1080, H: 1920, ax: 0, ay: 300, aw: 1080, ah: 1240, capY: 1540 + 120, cap: 46, card: 66, tall }
  : { W: 1920, H: 1080, ax: 0, ay: 138, aw: 1920, ah: 804, capY: 1080 - 69, cap: 38, card: 92, tall };

/* ======================= the lot ======================= */

/* a lamp striking: on, off, on, settling, the way a sodium lamp catches */
function strike(f: number) {
  if (f < 0) return 0;
  const k = [0, 0.95, 0.2, 0.05, 0.75, 0.35, 0.9, 0.7, 1];
  const i = Math.floor(f / 2);
  const v = i < k.length - 1 ? lerp(k[i], k[i + 1], (f % 2) / 2) : 1;
  return v * (0.97 + 0.03 * Math.sin(f / 9));
}
/* and going out: a drop, one last catch, then dark */
function fade(f: number) {
  if (f < 0) return 1;
  if (f < 2) return lerp(1, 0.2, f / 2);
  if (f < 5) return lerp(0.2, 0.45, (f - 2) / 3);
  return 0.45 * Math.exp(-(f - 5) / 4);
}
/* when each lamp strikes and goes out (global frames) */
const LIT_AT = [30, S.name.from, S.library.from + 14, end(S.end) + 9999, end(S.end) + 9999, end(S.end) + 9999];
const E0 = S.end.from;
const END_ON = [E0 + 42, E0 + 57, E0 + 72]; /* lamps 4, 5, 6 at the close, on eighths */
const STOP = Math.ceil((E0 + 90 - 30) / BAR) * BAR + 30; /* the score stops on a bar line */
const OUT_AT = [STOP + 150, STOP + 105, STOP + 90, STOP + 75, STOP + 60, STOP + 45];
function lampLevel(i: number, f: number) {
  const on = i < 3 ? strike(f - LIT_AT[i]) : strike(f - END_ON[i - 3]);
  return on * fade(f - OUT_AT[i]);
}

/* the line drawing (tools/art/boot.py), drawn as far as p */
const LineLot: React.FC<{ p: number; opacity: number }> = ({ p, opacity }) => (
  <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0, opacity }}>
    {(boot as any).paths.map(([d, a, b, cls]: [string, number, number, string], i: number) => {
      const k = Math.max(0, Math.min(1, (p - a) / (b - a)));
      return (
        <path key={i} d={d} pathLength={1} strokeDasharray="1 2" strokeDashoffset={1 - k}
          fill={cls === "solid" ? T.c.night : "none"} fillOpacity={cls === "solid" ? Math.min(1, Math.max(0, (p - a) * 30)) : 1}
          stroke={cls === "thin" ? T.c.bone2 : T.c.bone} strokeOpacity={cls === "thin" ? 0.6 : 0.9}
          strokeWidth={cls === "thin" ? 1.1 : 1.6} strokeLinejoin="round" />
      );
    })}
  </svg>
);

type LotProps = { f: number; g: Geo; k: number; at: [number, number]; base: number; draw: number; drawOn: number; show: number };
/* the lot at night: a dark plate, lit where a lamp has struck */
const Lot: React.FC<LotProps> = ({ f, g, k, at, base, draw, drawOn, show }) => {
  const cover = Math.max(g.aw / 1920, g.ah / 1080), s = cover * k;
  const tx = Math.max(g.aw - 1920 * s, Math.min(0, g.aw / 2 - at[0] * s));
  const ty = Math.max(g.ah - 1080 * s, Math.min(0, g.ah / 2 - at[1] * s));
  const lv = LAMPS.map((_, i) => lampLevel(i, f));
  const masks: string[] = [];
  LAMPS.forEach((L, i) => {
    const a = lv[i]; if (a <= 0.002) return;
    masks.push(`radial-gradient(circle at ${L.x}px ${L.y}px, rgba(0,0,0,${a}) 0px, rgba(0,0,0,${0.55 * a}) ${L.r * 0.4}px, transparent ${L.r}px)`);
    masks.push(`radial-gradient(ellipse ${L.wr * 0.5}px ${L.wr * 1.6}px at ${L.x}px ${L.wet}px, rgba(0,0,0,${0.85 * a}) 0px, transparent 100%)`);
  });
  if (show > 0.002) {
    masks.push(`radial-gradient(ellipse ${SHOWROOM.rx}px ${SHOWROOM.ry}px at ${SHOWROOM.x}px ${SHOWROOM.y}px, rgba(0,0,0,${show}) 0px, rgba(0,0,0,${0.5 * show}) 50%, transparent 100%)`);
    masks.push(`radial-gradient(ellipse 160px 260px at ${SHOWROOM.x}px ${SHOWROOM.wet}px, rgba(0,0,0,${0.7 * show}) 0px, transparent 100%)`);
  }
  const mask = masks.length ? masks.join(", ") : "linear-gradient(transparent, transparent)";
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: T.c.night }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${s})` }}>
        <Img src={src("art/lot.webp")} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, opacity: base }} />
        <Img src={src("art/lot.webp")} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, WebkitMaskImage: mask, maskImage: mask }} />
        {LAMPS.map((L, i) => lv[i] > 0.002 && (
          <div key={i} style={{ position: "absolute", left: L.x - L.r * 0.22, top: L.y - L.r * 0.22, width: L.r * 0.44, height: L.r * 0.44, borderRadius: "50%",
            background: `radial-gradient(circle, rgba(237,231,219,${0.75 * lv[i]}) 0%, rgba(237,231,219,${0.16 * lv[i]}) 30%, rgba(237,231,219,0) 70%)`, mixBlendMode: "screen" }} />
        ))}
        {draw > 0 && <LineLot p={draw} opacity={drawOn} />}
      </div>
    </AbsoluteFill>
  );
};
/* where a point of the lot lands on screen, for a flare centred on it */
function lotToScreen(g: Geo, k: number, at: [number, number], px: number, py: number) {
  const cover = Math.max(g.aw / 1920, g.ah / 1080), s = cover * k;
  const tx = Math.max(g.aw - 1920 * s, Math.min(0, g.aw / 2 - at[0] * s));
  const ty = Math.max(g.ah - 1080 * s, Math.min(0, g.ah / 2 - at[1] * s));
  return [tx + px * s, ty + py * s];
}

/* a light flaring to bone, centred on (x, y), then settling */
const Flare: React.FC<{ a: number; x: number; y: number; g: Geo }> = ({ a, x, y, g }) => {
  if (a <= 0.003) return null;
  const r = lerp(120, Math.max(g.aw, g.ah) * 1.3, Math.min(1, a * 1.3));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(237,231,219,${Math.min(1, a * 1.2)}) 0%, rgba(237,231,219,${0.7 * a}) 35%, rgba(237,231,219,0) 70%)` }} />
      <AbsoluteFill style={{ background: T.c.bone, opacity: Math.max(0, a - 0.25) * 0.85 }} />
    </AbsoluteFill>
  );
};

/* ======================= type ======================= */

/* an act card: letterspaced capitals, each letter rising out of the dark with its own light */
const Card: React.FC<{ text: string; f: number; out: number; g: Geo; size?: number; lines?: string[] }> = ({ text, f, out, g, size, lines: ls }) => {
  const { fps } = useVideoConfig();
  if (f < 0) return null;
  const px = size || g.card;
  const rows = ls || [text];
  const leave = ramp(f, out, out + 12, T.ease.exit);
  if (leave >= 1) return null;
  const breathe = 1 + 0.035 * T.ease.dolly(Math.min(1, f / Math.max(1, out)));
  let n = 0;
  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: px * 0.28,
      opacity: 1 - leave, transform: `translateY(${-14 * leave}px) scale(${breathe})`, filter: leave > 0 ? `blur(${6 * leave}px)` : undefined }}>
      {rows.map((row, r) => (
        <div key={r} style={{ font: `600 ${px}px/1 ${T.f.serif}`, letterSpacing: "0.2em", marginRight: "-0.2em", color: T.c.bone, whiteSpace: "nowrap", textTransform: "uppercase" }}>
          {row.split("").map((ch, i) => {
            const at = 2 * n++;
            const s = spring({ frame: f - at, fps, config: T.spring.letter });
            const glow = hitPulse(f - at - 4, 3, 14);
            return (
              <span key={i} style={{ display: "inline-block", minWidth: ch === " " ? "0.32em" : undefined, opacity: s,
                transform: `translateY(${(1 - s) * 0.42 * px}px)`, filter: s < 0.995 ? `blur(${(1 - s) * 9}px)` : undefined,
                textShadow: `0 0 ${px * 0.35}px rgba(237,231,219,${0.1 + 0.55 * glow})` }}>{ch}</span>
            );
          })}
        </div>
      ))}
    </AbsoluteFill>
  );
};

/* captions: one line at a time in the lower bar, each word lighting as it is said */
function pages(words: Word[], max: number): Word[][] {
  /* phrases first (a comma or a full stop ends one), packed into lines that fit; a phrase too long for a line breaks between words */
  const phrases: Word[][] = []; let cur: Word[] = [];
  words.forEach((w) => { cur.push(w); if (/[.,:;?!]$/.test(w.w)) { phrases.push(cur); cur = []; } });
  if (cur.length) phrases.push(cur);
  const len = (ws: Word[]) => ws.reduce((a, w, i) => a + w.w.length + (i ? 1 : 0), 0);
  const out: Word[][] = []; let line: Word[] = [];
  phrases.forEach((ph) => {
    if (line.length && len(line.concat(ph)) > max) { out.push(line); line = []; }
    if (len(ph) > max) { ph.forEach((w) => { if (line.length && len(line.concat([w])) > max) { out.push(line); line = []; } line.push(w); }); }
    else line = line.concat(ph);
    /* a sentence that ends a well-filled line closes it */
    if (/[.?!]$/.test(line[line.length - 1].w) && len(line) > max * 0.45) { out.push(line); line = []; }
  });
  if (line.length) out.push(line);
  return out;
}
const Captions: React.FC<{ f: number; g: Geo }> = ({ f, g }) => {
  const { fps } = useVideoConfig();
  const sh = TL.shots.find((s) => s.speechFrom != null && s.words.length && f >= wordAt(s, 0) - 6 && f < lastWord(s) + 24);
  if (!sh) return null;
  const t = (f - (sh.speechFrom || 0)) / fps;
  const P = pages(sh.words, g.tall ? 26 : 50);
  let pi = 0;
  P.forEach((pg, i) => { if (t >= pg[0].s - 0.12) pi = i; });
  const pg = P[pi];
  const nextAt = P[pi + 1] ? P[pi + 1][0].s - 0.12 : sh.words[sh.words.length - 1].e + 0.7;
  const appear = ramp(t * fps, (pg[0].s - 0.2) * fps, (pg[0].s) * fps);
  const leave = ramp(t * fps, nextAt * fps - 6, nextAt * fps, T.ease.exit);
  return (
    <div style={{ position: "absolute", left: 40, right: 40, top: g.capY - g.cap * 0.65, height: g.cap * 1.3, display: "flex", justifyContent: "center", alignItems: "center",
      columnGap: g.cap * 0.32, opacity: appear * (1 - leave), transform: `translateY(${-6 * leave}px)` }}>
      {pg.map((w, i) => {
        const s = spring({ frame: Math.round(t * fps - w.s * fps + 2), fps, config: T.spring.word });
        return (
          <span key={i} style={{ display: "inline-block", font: `500 ${g.cap}px/1.2 ${T.f.sans}`, color: T.c.bone, whiteSpace: "nowrap",
            opacity: 0.26 + 0.74 * s, transform: `translateY(${(1 - s) * 6}px)`, filter: s < 0.99 ? `blur(${(1 - s) * 3}px)` : undefined }}>{w.w}</span>
        );
      })}
    </div>
  );
};

/* ======================= the plates and the objects ======================= */

/* a title's living key art, full bleed, with the camera easing forward through it */
const Plate: React.FC<{ loop: string; g: Geo; tallX: number; push: number; dim?: number }> = ({ loop, g, tallX, push, dim = 0 }) => {
  const cover = Math.max(g.aw / 1920, g.ah / 1080);
  const w = 1920 * cover, h = 1080 * cover;
  const left = g.tall ? Math.max(g.aw - w, Math.min(0, g.aw / 2 - tallX * w)) : (g.aw - w) / 2;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: T.c.night }}>
      <div style={{ position: "absolute", left, top: (g.ah - h) / 2, width: w, height: h, transform: `scale(${push})`, transformOrigin: `${(g.aw / 2 - left) / w * 100}% 50%` }}>
        <OffthreadVideo src={src(`loops/${loop}.mp4`)} muted style={{ width: w, height: h }} />
      </div>
      {dim > 0 && <AbsoluteFill style={{ background: T.c.night, opacity: dim }} />}
    </AbsoluteFill>
  );
};

/* the Player 2 card, alone in the dark, turning slowly toward you */
const HeroCard: React.FC<{ f: number; dur: number; g: Geo }> = ({ f, dur, g }) => {
  const { fps } = useVideoConfig();
  const a = spring({ frame: f - 6, fps, config: T.spring.heavy });
  const k = Math.min(1, f / dur);
  const h = g.ah * (g.tall ? 0.8 : 0.94), w = h * 1080 / 1350;
  const yaw = lerp(-18, 7, T.ease.cam(k)), pitch = lerp(5, 0, T.ease.cam(k));
  const z = lmix(0.94, 1.04, T.ease.dolly(k));
  const sheen = ramp(f, dur * 0.35, dur * 0.35 + 34, T.ease.dolly);
  return (
    <AbsoluteFill style={{ perspective: 2400 }}>
      <div style={{ position: "absolute", left: (g.aw - w) / 2, top: (g.ah - h) / 2 + (1 - a) * 90, width: w, height: h, opacity: a,
        transform: `rotateY(${yaw}deg) rotateX(${pitch}deg) scale(${z})`, boxShadow: "0 60px 120px rgba(0,0,0,.75)", overflow: "hidden" }}>
        <Img src={src("hero/card.png")} style={{ width: w, height: h }} />
        {sheen > 0 && sheen < 1 && <div style={{ position: "absolute", top: -h * 0.2, height: h * 1.4, width: w * 0.35, left: lerp(-w * 0.5, w * 1.2, sheen),
          transform: "rotate(18deg)", background: "linear-gradient(90deg, rgba(237,231,219,0), rgba(237,231,219,.16), rgba(237,231,219,0))", mixBlendMode: "screen" }} />}
      </div>
    </AbsoluteFill>
  );
};

/* the sale desk on its phone, stepping through a sale */
const HeroPhone: React.FC<{ f: number; dur: number; g: Geo; steps: number[] }> = ({ f, dur, g, steps }) => {
  const { fps } = useVideoConfig();
  const a = spring({ frame: f - 4, fps, config: T.spring.heavy });
  const k = Math.min(1, f / dur);
  const h = g.ah * (g.tall ? 0.86 : 0.9), w = h * 900 / 1863;
  const yaw = lerp(8, -5, T.ease.cam(k));
  return (
    <AbsoluteFill style={{ perspective: 2600 }}>
      <div style={{ position: "absolute", left: (g.aw - w) / 2, top: (g.ah - h) / 2 + (1 - a) * 80 + Math.sin(f / 40) * 3, width: w, height: h, opacity: a,
        transform: `rotateY(${yaw}deg) scale(${lmix(0.97, 1.03, T.ease.dolly(k))})`, filter: "drop-shadow(0 50px 70px rgba(0,0,0,.8))" }}>
        {[0, 1, 2].map((i) => {
          const o = i === 0 ? 1 : ramp(f, steps[i] - 7, steps[i] + 7, T.ease.cam);
          return <Img key={i} src={src(`hero/desk-${i}.png`)} style={{ position: "absolute", inset: 0, width: w, height: h, opacity: o }} />;
        })}
      </div>
    </AbsoluteFill>
  );
};

/* one trophy medal: it comes toward you out of the dark, turns face on, catches the light, and becomes light */
const HeroMedal: React.FC<{ f: number; dur: number; g: Geo }> = ({ f, dur, g }) => {
  const { fps } = useVideoConfig();
  const d = g.ah * (g.tall ? 0.42 : 0.56);
  const come = spring({ frame: f - 2, fps, config: T.spring.heavy });
  const turn = spring({ frame: f - 8, fps, config: { damping: 200, stiffness: 50, mass: 1.2 } });
  const glow = ramp(f, dur - 34, dur, T.ease.dolly);
  const sheen = ramp(f, 30, 66, T.ease.dolly);
  const z = lmix(0.55, 1, come) * lmix(1, 1.08, T.ease.dolly(Math.min(1, f / dur))) * (1 + 0.25 * glow);
  const mask = `url(${src("hero/medal.png")})`;
  return (
    <AbsoluteFill style={{ perspective: 1800 }}>
      <div style={{ position: "absolute", left: (g.aw - d) / 2, top: (g.ah - d) / 2, width: d, height: d, opacity: come,
        transform: `scale(${z}) rotateY(${lerp(72, 0, turn)}deg)`, filter: `brightness(${1 + 1.6 * glow}) drop-shadow(0 30px 60px rgba(0,0,0,.7))` }}>
        <Img src={src("hero/medal.png")} style={{ width: d, height: d }} />
        <div style={{ position: "absolute", inset: 0, WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: "100% 100%", maskSize: "100% 100%", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -d * 0.3, height: d * 1.6, width: d * 0.3, left: lerp(-d * 0.5, d * 1.2, sheen), transform: "rotate(24deg)",
            background: "linear-gradient(90deg, rgba(255,250,240,0), rgba(255,250,240,.55), rgba(255,250,240,0))", mixBlendMode: "screen" }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* Level 53: the portrait in the dark, and the number */
const HeroLevel: React.FC<{ f: number; dur: number; g: Geo }> = ({ f, dur, g }) => {
  const { fps } = useVideoConfig();
  const k = Math.min(1, f / dur);
  const a = ramp(f, 0, 30, T.ease.out);
  const ph = g.tall ? g.ah * 0.78 : g.ah * 1.08;
  const pz = lmix(1.0, 1.14, T.ease.dolly(k));
  const num = g.tall ? 300 : 340;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", width: ph, height: ph, left: g.tall ? (g.aw - ph) / 2 : g.aw * 0.5, top: g.tall ? 0 : (g.ah - ph) / 2 + 30,
        opacity: a * 0.92, transform: `translate(${(g.tall ? 0 : -40) * T.ease.dolly(k)}px, ${(g.tall ? -36 : 0) * T.ease.dolly(k)}px) scale(${g.tall ? pz * 1.04 : pz})`, transformOrigin: "50% 40%" }}>
        <Img src={src("art/portrait.webp")} style={{ width: ph, height: ph }} />
        <AbsoluteFill style={{ background: g.tall
          ? `linear-gradient(0deg, ${T.c.night} 4%, rgba(5,8,7,0) 45%), radial-gradient(ellipse at 50% 40%, rgba(5,8,7,0) 40%, ${T.c.night} 78%)`
          : `linear-gradient(90deg, ${T.c.night} 2%, rgba(5,8,7,0) 38%), radial-gradient(ellipse at 50% 45%, rgba(5,8,7,0) 42%, ${T.c.night} 76%)` }} />
      </div>
      <div style={{ position: "absolute", left: g.tall ? 0 : g.aw * 0.12, width: g.tall ? g.aw : g.aw * 0.36, top: g.tall ? g.ah * 0.7 : (g.ah - num) / 2 - 10,
        display: "flex", justifyContent: "center", transform: `translateX(${18 * T.ease.dolly(k)}px)` }}>
        <Card text="53" f={f - 18} out={dur + 99} g={g} size={num} />
      </div>
    </AbsoluteFill>
  );
};

/* the resume page, rising out of the dark */
const HeroPage: React.FC<{ f: number; dur: number; g: Geo }> = ({ f, dur, g }) => {
  const { fps } = useVideoConfig();
  const a = spring({ frame: f - 4, fps, config: T.spring.heavy });
  const w = g.tall ? g.aw * 0.8 : g.aw * 0.34, h = w * 3216 / 2448;
  const k = Math.min(1, f / dur);
  const top = g.ah * 0.1 + (1 - a) * g.ah * 0.5 - T.ease.dolly(k) * h * 0.12;
  return (
    <AbsoluteFill style={{ perspective: 2200 }}>
      <div style={{ position: "absolute", left: (g.aw - w) / 2, top, width: w, height: h, opacity: a, transform: `rotateX(${lerp(14, 2, a)}deg)`, transformOrigin: "50% 0%",
        boxShadow: "0 50px 120px rgba(0,0,0,.7)" }}>
        <Img src={src("hero/resume.png")} style={{ width: w, height: h }} />
        <AbsoluteFill style={{ background: T.c.night, opacity: 0.12 }} />
      </div>
    </AbsoluteFill>
  );
};

/* ======================= the finish ======================= */
const Finish: React.FC<{ f: number }> = ({ f }) => {
  const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`;
  const tile = Math.floor(f / 2);
  return (
    <>
      <AbsoluteFill style={{ backgroundColor: "#1c3229", mixBlendMode: "soft-light", opacity: 0.14, pointerEvents: "none" }} />
      <AbsoluteFill style={{ backgroundImage: noise, backgroundSize: "240px", backgroundPosition: `${(tile * 37) % 240}px ${(tile * 61) % 240}px`, opacity: 0.05, mixBlendMode: "overlay", pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 48%, transparent 55%, rgba(3,5,4,0.6) 100%)", pointerEvents: "none" }} />
    </>
  );
};

/* ======================= the sound ======================= */
type Cue = { at: number; file: string; vol: number; lead?: number };
function cues(): Cue[] {
  const c: Cue[] = [];
  /* the lamps: each strike, each going out */
  LIT_AT.slice(0, 3).forEach((at, i) => c.push({ at, file: "sfx/lamp.wav", vol: i === 0 ? 0.55 : 0.42 }));
  END_ON.forEach((at) => c.push({ at, file: "sfx/lamp.wav", vol: 0.36 }));
  OUT_AT.forEach((at) => c.push({ at, file: "sfx/out.wav", vol: 0.4 }));
  /* the act cards land with a soft hit (and, where the site plays one, its sting) */
  c.push({ at: S.name.from + 8, file: "sfx/hit.wav", vol: 0.5 });
  c.push({ at: S.seat.from + 18, file: "sfx/hit.wav", vol: 0.42 }, { at: S.seat.from + 18, file: "score/sting-select.ogg", vol: 0.32 });
  c.push({ at: S.library.from + 14, file: "sfx/hit.wav", vol: 0.42 }, { at: S.library.from + 16, file: "score/sting-open.ogg", vol: 0.32 });
  c.push({ at: STOP, file: "sfx/hit.wav", vol: 0.5 });
  /* the push-throughs: a riser into each flare, air on the way through */
  c.push({ at: end(S.career), file: "sfx/riser.wav", vol: 0.3, lead: 1.6 }, { at: end(S.career), file: "sfx/whoosh.wav", vol: 0.36, lead: 0.7 });
  c.push({ at: end(S.library), file: "sfx/riser.wav", vol: 0.3, lead: 1.6 }, { at: end(S.library), file: "sfx/whoosh.wav", vol: 0.36, lead: 0.7 });
  PLATE_AT.slice(1).forEach((at) => c.push({ at, file: "sfx/whoosh.wav", vol: 0.14, lead: 0.7 }));
  c.push({ at: end(S.desk), file: "sfx/whoosh.wav", vol: 0.3, lead: 0.7 });
  /* the objects: the medal catching the light, Level 53 */
  c.push({ at: S.trophies.from + 40, file: "score/sting-trophy-gold.ogg", vol: 0.36 });
  c.push({ at: S.level.from + 22, file: "score/sting-level-clear.ogg", vol: 0.3 });
  return c;
}
/* the narrator speaks over these windows; the score steps back under them */
const SPEECH = TL.shots.filter((s) => s.speechFrom != null).map((s) => [wordAt(s, 0) - 8, lastWord(s) + 10]);
function duck(f: number) {
  let d = 0;
  SPEECH.forEach(([a, b]) => { d = Math.max(d, interpolate(f, [a - 10, a, b, b + 16], [0, 1, 1, 0], clamp)); });
  return 1 - 0.58 * d;
}
/* when each title's plate arrives: on its name, as it is said */
const TS = S.titles;
const PLATE_AT = [TS.from, wordAt(TS, findWord(TS, /^Lead/)) - 3, wordAt(TS, findWord(TS, /^The$/, 3)) - 3, wordAt(TS, findWord(TS, /^Prospector/)) - 3, wordAt(TS, findWord(TS, /^Neuroscience/)) - 3, wordAt(TS, findWord(TS, /^Obavia/)) - 3];

const Sound: React.FC = () => {
  const SCORE0 = 30;
  const scoreLen = STOP - SCORE0 + 2;
  const lotOn = (f: number) => Math.max(interpolate(f, [0, BAR, end(S.career) - 30, end(S.career)], [0.55, 0.55, 0.55, 0], clamp),
    interpolate(f, [S.library.from - 20, S.library.from, end(S.library), end(S.library) + 20], [0, 0.5, 0.5, 0], clamp),
    interpolate(f, [E0 - 30, E0 + 10], [0, 0.55], clamp));
  const deskOn = (f: number) => interpolate(f, [S.desk.from - 30, S.desk.from + 20, end(S.desk) - 20, end(S.desk) + 10], [0, 0.5, 0.5, 0], clamp);
  const stopEnv = (f: number) => interpolate(f, [STOP - 2, STOP], [1, 0], clamp);
  return (
    <>
      <Sequence from={SCORE0} durationInFrames={scoreLen} name="score">
        <Audio src={src("score/bed.ogg")} loop volume={(lf) => { const f = lf + SCORE0; return 0.55 * duck(f) * stopEnv(f) * interpolate(lf, [0, 6], [0, 1], clamp); }} />
        <Audio src={src("score/triple-j.ogg")} loop volume={(lf) => { const f = lf + SCORE0; return lotOn(f) * 0.6 * duck(f) * stopEnv(f); }} />
        <Audio src={src("score/lead-to-title.ogg")} loop volume={(lf) => { const f = lf + SCORE0; return deskOn(f) * 0.6 * duck(f); }} />
      </Sequence>
      {cues().map((c, i) => {
        const from = Math.max(0, Math.round(c.at - (c.lead || 0) * FPS));
        return (
          <Sequence key={i} from={from} durationInFrames={FPS * 6} name={"sfx " + c.file}>
            <Audio src={src(c.file)} volume={c.vol} />
          </Sequence>
        );
      })}
      {TL.shots.map((s) => s.voiced && s.speechFrom != null && (
        <Sequence key={"vo-" + s.shot} from={s.speechFrom} durationInFrames={s.frames} name={"voice " + s.line}>
          <Audio src={src(`voice/${s.line}.mp3`)} />
        </Sequence>
      ))}
    </>
  );
};

/* ======================= the film ======================= */
export const AfterHours: React.FC<{ tall: boolean }> = ({ tall }) => {
  const f = useCurrentFrame();
  const g = geo(tall);
  const layers: React.ReactNode[] = [];
  let flare = { a: 0, x: g.aw / 2, y: g.ah / 2 };
  let blur = false;

  /* --- act one: the lot. A lamp strikes, the drawing draws, the photo resolves; the camera dollies toward the showroom --- */
  const careerEnd = end(S.career);
  if (f < careerEnd + 2) {
    const kOpen = interpolate(f, [30, S.career.from], [0, 1], { ...clamp, easing: T.ease.dolly });
    const kPush = ramp(f, S.career.from, careerEnd, T.ease.exit);
    const k = lmix(1, 1.22, kOpen) * lmix(1, 3.4, kPush);
    const at: [number, number] = [lerp(1420, 1640, kOpen) + (SHOWROOM.x - 1640) * kPush, lerp(470, 500, kOpen) + (SHOWROOM.y - 500) * kPush];
    const draw = interpolate(f, [44, 170], [0, 1], { ...clamp, easing: T.ease.out });
    const drawOn = 1 - ramp(f, 190, S.name.from + 40, T.ease.cam) * 0.92;
    const base = 0.03 + 0.19 * ramp(f, 120, 230, T.ease.cam);
    const show = ramp(f, S.career.from - 20, S.career.from + 50) * (0.7 + 0.3 * kPush);
    layers.push(<Lot key="lot1" f={f} g={g} k={k} at={at} base={base} draw={draw} drawOn={drawOn} show={show} />);
    const fa = ramp(f, careerEnd - 26, careerEnd, T.ease.dolly);
    if (fa > 0) { const [x, y] = lotToScreen(g, k, at, SHOWROOM.x, SHOWROOM.y); flare = { a: fa, x: lerp(x, g.aw / 2, fa), y: lerp(y, g.ah / 2, fa) }; } /* the light comes to the middle as it fills the frame */
    if (f > careerEnd - 16) blur = true;
  }
  /* the name, over the lot */
  if (f >= S.name.from && f < S.career.from + 10) {
    layers.push(<Card key="name" text="Jason Obawemimo" lines={tall ? ["Jason", "Obawemimo"] : undefined} f={f - S.name.from - 4} out={S.career.from - S.name.from - 8} g={g} size={tall ? 96 : 100} />);
  }

  /* --- who's playing: the flare settles into the dark, and the card waits for the answer --- */
  if (f >= S.seat.from - 2 && f < end(S.seat) + 2) {
    const lf = f - S.seat.from;
    const settle = 1 - ramp(lf, 0, 34, T.ease.dolly);
    if (settle > 0) flare = { a: settle, x: g.aw / 2, y: g.ah / 2 };
    if (lf < 8) blur = true;
    layers.push(<Card key="seat" text="Who's playing?" f={lf - 14} out={S.seat.frames - 30} g={g} />);
  }

  /* --- the build: the Player 2 card --- */
  if (f >= S.build.from - 10 && f < end(S.build) + 2) {
    const lf = f - S.build.from;
    const out = ramp(lf, S.build.frames - 22, S.build.frames, T.ease.exit);
    layers.push(<AbsoluteFill key="build" style={{ opacity: 1 - out, transform: `scale(${1 + 0.06 * out})` }}><HeroCard f={lf} dur={S.build.frames} g={g} /></AbsoluteFill>);
  }

  /* --- the library: back on the lot, a third lamp strikes, and the camera goes into its light --- */
  if (f >= S.library.from && f < end(S.library) + 2) {
    const lf = f - S.library.from;
    const inn = ramp(lf, 0, 20, T.ease.out);
    const push = ramp(lf, S.library.frames - 40, S.library.frames, T.ease.exit);
    const L3 = LAMPS[2];
    const at: [number, number] = [lerp(1500, L3.x, push), lerp(470, L3.y, push)];
    const k = lmix(1.5, 1.75, T.ease.dolly(Math.min(1, lf / S.library.frames))) * lmix(1, 5, push);
    layers.push(<AbsoluteFill key="lot2" style={{ opacity: inn }}><Lot f={f} g={g} k={k} at={at} base={0.2} draw={0} drawOn={0} show={0.8} /></AbsoluteFill>);
    layers.push(<Card key="lib" text="The library" f={lf - 10} out={S.library.frames - 34} g={g} />);
    const fa = ramp(lf, S.library.frames - 26, S.library.frames, T.ease.dolly);
    if (fa > 0) { const [x, y] = lotToScreen(g, k, at, L3.x, L3.y); flare = { a: fa, x: lerp(x, g.aw / 2, fa), y: lerp(y, g.ah / 2, fa) }; }
    if (lf > S.library.frames - 16) blur = true;
  }

  /* --- six titles: one plate at a time, each arriving on its name; the camera keeps going forward --- */
  if (f >= S.titles.from - 2 && f < end(S.titles) + 2) {
    const lf = f - S.titles.from;
    const settle = 1 - ramp(lf, 0, 34, T.ease.dolly);
    if (settle > 0) flare = { a: settle, x: g.aw / 2, y: g.ah / 2 };
    if (lf < 8) blur = true;
    PLATE_AT.forEach((at, i) => {
      const next = PLATE_AT[i + 1] ?? end(S.titles);
      if (f < at - 10 || f > next + 13) return;
      const life = Math.min(1, (f - at) / Math.max(1, next - at));
      const into = i === 0 ? 1 : ramp(f, at - 10, at + 8, T.ease.cam);
      const thru = i === PLATE_AT.length - 1 ? ramp(f, end(S.titles) - 18, end(S.titles), T.ease.exit) : ramp(f, next - 6, next + 12, T.ease.cam);
      const push = lmix(1.02, 1.1, T.ease.dolly(Math.max(0, life))) * lmix(1, 1.3, thru);
      if (i > 0 && Math.abs(f - at) < 6) blur = true;
      layers.push(
        <Sequence key={"plate" + i} from={at - 10} durationInFrames={next + 13 - (at - 10) + 1} layout="none">
          <AbsoluteFill style={{ opacity: into * (1 - thru) }}><Plate loop={PLATES[i].loop} g={g} tallX={PLATES[i].tallX} push={push} /></AbsoluteFill>
        </Sequence>,
      );
    });
  }

  /* --- the sale desk: the Lead to Title plate in the dark, and the phone --- */
  if (f >= S.desk.from - 16 && f < end(S.desk) + 2) {
    const lf = f - S.desk.from;
    const inn = ramp(lf, -12, 14, T.ease.cam);
    const out = ramp(lf, S.desk.frames - 20, S.desk.frames, T.ease.exit);
    const steps = [0, wordAt(S.desk, findWord(S.desk, /^Scan/)) - 6 - S.desk.from, wordAt(S.desk, findWord(S.desk, /^Fictional/)) - 6 - S.desk.from];
    layers.push(
      <Sequence key="deskplate" from={S.desk.from - 16} durationInFrames={S.desk.frames + 18} layout="none">
        <AbsoluteFill style={{ opacity: inn * (1 - out) }}><Plate loop="lead-to-title" g={g} tallX={0.6} push={lmix(1.04, 1.14, T.ease.dolly(Math.max(0, Math.min(1, lf / S.desk.frames))))} dim={0.68} /></AbsoluteFill>
      </Sequence>,
    );
    layers.push(<AbsoluteFill key="phone" style={{ opacity: 1 - out, transform: `scale(${lmix(1, 1.5, out)})` }}><HeroPhone f={lf} dur={S.desk.frames} g={g} steps={steps} /></AbsoluteFill>);
    if (lf > S.desk.frames - 10) blur = true;
  }

  /* --- the trophies: one medal, which becomes light --- */
  if (f >= S.trophies.from && f < end(S.trophies) + 2) {
    const lf = f - S.trophies.from;
    layers.push(<HeroMedal key="medal" f={lf} dur={S.trophies.frames} g={g} />);
    const fa = ramp(lf, S.trophies.frames - 20, S.trophies.frames, T.ease.dolly) * 0.8;
    if (fa > 0) flare = { a: fa, x: g.aw / 2, y: g.ah / 2 };
  }

  /* --- Level 53 --- */
  if (f >= S.level.from - 2 && f < end(S.level) + 2) {
    const lf = f - S.level.from;
    const settle = 1 - ramp(lf, 0, 26, T.ease.dolly);
    if (settle > 0) flare = { a: 0.8 * settle, x: g.aw / 2, y: g.ah / 2 };
    const out = ramp(lf, S.level.frames - 18, S.level.frames, T.ease.exit);
    layers.push(<AbsoluteFill key="level" style={{ opacity: 1 - out, transform: `scale(${1 + 0.05 * out})` }}><HeroLevel f={lf} dur={S.level.frames} g={g} /></AbsoluteFill>);
  }

  /* --- the resume page --- */
  if (f >= S.resume.from && f < end(S.resume) + 2) {
    const lf = f - S.resume.from;
    const out = ramp(lf, S.resume.frames - 18, S.resume.frames, T.ease.exit);
    layers.push(<AbsoluteFill key="page" style={{ opacity: 1 - out, transform: `scale(${1 + 0.08 * out})` }}><HeroPage f={lf} dur={S.resume.frames} g={g} /></AbsoluteFill>);
  }

  /* --- the close: the camera pulls back out to the whole lot; the last lamps strike; the score stops; they go out one by one --- */
  if (f >= E0) {
    const lf = f - E0;
    const back = ramp(lf, 0, 120, T.ease.cam);
    const k = lmix(2.6, 1.0, back) * lmix(1, 1.04, ramp(lf, 120, S.end.frames, T.ease.dolly));
    const at: [number, number] = [lerp(1560, 1420, back), lerp(470, 480, back)];
    const inn = ramp(lf, 0, 24, T.ease.cam);
    const base = 0.2 * (1 - ramp(f, OUT_AT[0] - 10, OUT_AT[0] + 20, T.ease.cam));
    const show = 0.8 * (1 - ramp(f, OUT_AT[5] - 4, OUT_AT[5] + 10, T.ease.exit));
    layers.push(<AbsoluteFill key="lot3" style={{ opacity: inn }}><Lot f={f} g={g} k={k} at={at} base={base} draw={0} drawOn={0} show={show} /></AbsoluteFill>);
    const nameAt = STOP - E0 - 6;
    layers.push(<AbsoluteFill key="endname" style={{ transform: `translateY(${tall ? -40 : -40}px)` }}><Card text="Jason Obawemimo" lines={tall ? ["Jason", "Obawemimo"] : undefined} f={lf - nameAt} out={S.end.frames + 99} g={g} size={tall ? 84 : 84} /></AbsoluteFill>);
    const startAt = (S.end.speakAt || 0) - E0 - 4;
    const pulse = 0.78 + 0.22 * (0.5 + 0.5 * Math.cos((lf - startAt) / 10));
    layers.push(<AbsoluteFill key="press" style={{ transform: `translateY(${tall ? 150 : 76}px)`, opacity: lf > startAt + 30 ? pulse : 1 }}><Card text="Press start" f={lf - startAt} out={S.end.frames + 99} g={g} size={tall ? 34 : 30} /></AbsoluteFill>);
  }

  /* the letterbox: closed over black, it opens as the first lamp strikes, and closes at the end */
  const open = ramp(f, 26, 104, T.ease.cam), close = ramp(f, TL.frames - 40, TL.frames - 4, T.ease.cam);
  const barK = 1 - open + close; /* 1 = closed */
  const topBar = g.ay + (g.ah / 2) * Math.min(1, barK), botBar = g.H - g.ay - g.ah + (g.ah / 2) * Math.min(1, barK);

  const stage = (
    <AbsoluteFill style={{ left: g.ax, top: g.ay, width: g.aw, height: g.ah, overflow: "hidden", background: T.c.night }}>
      {layers}
      <Flare a={flare.a} x={flare.x} y={flare.y} g={g} />
      <Finish f={f} />
    </AbsoluteFill>
  );
  const credit = (lines as any).voice.label as string;
  const creditA = ramp(f, lastWord(S.end) + 34, lastWord(S.end) + 54) * (1 - close);
  return (
    <AbsoluteFill style={{ background: T.c.night }}>
      {blur ? <CameraMotionBlur samples={5} shutterAngle={180}>{stage}</CameraMotionBlur> : stage}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: topBar, background: T.c.night }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: botBar, background: T.c.night }} />
      <Captions f={f} g={g} />
      {TL.voiced && creditA > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: g.capY - 12, textAlign: "center", font: `400 ${g.tall ? 24 : 20}px/1.3 ${T.f.sans}`, color: T.c.ash, opacity: creditA }}>{credit}</div>
      )}
      <Sound />
    </AbsoluteFill>
  );
};
