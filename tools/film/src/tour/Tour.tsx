import React from "react";
import {
  AbsoluteFill, Audio, Img, Sequence, continueRender, delayRender, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import timeline from "./timeline.json";
import boot from "./boot.json";
import lines from "../../../voice/tour_lines.json";
import { CHAPTER, DESK, STING, T, TALL, WIDE, ShotPlan } from "./theme";

/* The walkthrough: the live site, captured as it is (capture-tour.mjs), framed
   and moved through as one continuous thought. It opens on the loading
   screen's own line drawing of the lot, which dissolves into the title
   screen's photograph of the same lot; then the title screen, who's playing,
   the build and the card, the library and a focus move, a title opened, the
   sale desk on its phone, the platinum and the trophies, Level 53, Player 2 and
   the resume; and it closes on the drawing again under the name.
   Every shot is as long as its narrator line (timeline.json, from
   tools/voice/timeline.mjs). Captions light word by word on the recording's
   timing when there is one; in caption-only mode on the estimate, and then the
   film carries no voice at all. Wide (1920 by 1080) and tall (1080 by 1920)
   are composed separately: the tall cut uses the phone captures. */

type Word = { w: string; s: number; e: number };
type Shot = { shot: string; line: string; text: string; from: number; frames: number; speechFrom: number; voiced: boolean; audio: string | null; words: Word[] };
const TL = timeline as unknown as { fps: number; frames: number; voiced: boolean; shots: Shot[] };
export const TOUR_FRAMES = TL.frames;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const shotSrc = (n: string) => staticFile(`tour/shots/${n}.png`);

/* ---------- fonts: the site's own Cormorant Garamond and Hanken Grotesk ---------- */
if (typeof window !== "undefined" && typeof document !== "undefined" && !(window as any).__tourFonts) {
  (window as any).__tourFonts = true;
  const h = delayRender("tour fonts");
  const faces = [
    new FontFace("Cormorant Garamond", `url(${staticFile("tour/fonts/cormorant.woff2")}) format("woff2")`, { weight: "300 700", style: "normal" }),
    new FontFace("Hanken Grotesk", `url(${staticFile("tour/fonts/hanken.woff2")}) format("woff2")`, { weight: "100 900", style: "normal" }),
  ];
  Promise.all(faces.map((f) => f.load()))
    .then((l) => { l.forEach((f) => (document as any).fonts.add(f)); continueRender(h); })
    .catch(() => continueRender(h));
}

/* ---------- the finish over everything: grade, grain, vignette ---------- */
const Finish: React.FC = () => {
  const f = useCurrentFrame();
  const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`;
  return (
    <>
      <AbsoluteFill style={{ backgroundColor: T.c.bottle, mixBlendMode: "soft-light", opacity: 0.16, pointerEvents: "none" }} />
      <AbsoluteFill style={{ backgroundImage: noise, backgroundSize: "240px", backgroundPosition: `${(f * 37) % 240}px ${(f * 61) % 240}px`, opacity: 0.04, mixBlendMode: "overlay", pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 46%, transparent 58%, rgba(5,8,7,0.55) 100%)", pointerEvents: "none" }} />
    </>
  );
};

/* ---------- the line drawing of the lot (tools/art/boot.py) ---------- */
const LineLot: React.FC<{ p: number; lit: number; style?: React.CSSProperties; dim?: number }> = ({ p, lit, style, dim = 1 }) => (
  <svg viewBox="0 0 1920 1080" style={{ position: "absolute", ...style, opacity: dim }}>
    <defs>
      <radialGradient id="boot-glow">
        <stop offset="0" stopColor={T.c.bone} stopOpacity=".55" />
        <stop offset=".35" stopColor={T.c.bone} stopOpacity=".16" />
        <stop offset="1" stopColor={T.c.bone} stopOpacity="0" />
      </radialGradient>
    </defs>
    <g style={{ opacity: lit }} dangerouslySetInnerHTML={{ __html: (boot as any).lit.replace(/class="boot__wet"/, `fill="none" stroke="${T.c.bone}" stroke-opacity=".24" stroke-width="2.4" stroke-dasharray="10 16"`).replace(/<circle (cx="\d+" cy="\d+" r="[\d.]+")\/>/g, `<circle $1 fill="${T.c.bone}"/>`) }} />
    {(boot as any).paths.map(([d, a, b, cls]: [string, number, number, string], i: number) => {
      const k = Math.max(0, Math.min(1, (p - a) / (b - a)));
      return (
        <path key={i} d={d} pathLength={1} strokeDasharray="1 2" strokeDashoffset={1 - k}
          fill={cls === "solid" ? T.c.ink : cls === "lamp" && lit > 0 ? `rgba(237,231,219,${0.5 * lit})` : "none"}
          fillOpacity={cls === "solid" ? Math.min(1, Math.max(0, (p - a) * 30)) : 1}
          stroke={cls === "thin" ? T.c.bone2 : T.c.bone} strokeOpacity={cls === "thin" ? 0.72 : 1}
          strokeWidth={cls === "thin" ? 1.2 : 1.7} strokeLinejoin="round" />
      );
    })}
  </svg>
);

/* ---------- kinetic type: a shot's name, letter by letter ---------- */
const Chapter: React.FC<{ text: string; dur: number; tall: boolean }> = ({ text, dur, tall }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = 10;
  const out = interpolate(f, [dur - 18, dur - 6], [0, 1], { ...clamp, easing: T.ease.in });
  const chars = text.toUpperCase().split("");
  const line = spring({ frame: f - start - chars.length * 1.4, fps, config: T.spring.settle });
  return (
    <div style={{ position: "absolute", left: tall ? 0 : 260, right: tall ? 0 : undefined, top: tall ? 170 : 34, textAlign: tall ? "center" : "left",
      opacity: 1 - out, transform: `translateY(${-14 * out}px)` }}>
      <div style={{ font: `600 ${tall ? 58 : 50}px/1 ${T.f.serif}`, letterSpacing: "0.14em", color: T.c.bone, whiteSpace: "nowrap", textShadow: "0 2px 30px rgba(0,0,0,.45)" }}>
        {chars.map((ch, i) => {
          const s = spring({ frame: f - start - i * 1.4, fps, config: T.spring.settle });
          return <span key={i} style={{ display: "inline-block", opacity: s, transform: `translateY(${(1 - s) * 22}px)`, filter: `blur(${(1 - s) * 6}px)`, minWidth: ch === " " ? "0.3em" : undefined }}>{ch}</span>;
        })}
      </div>
      <div style={{ height: 1, marginTop: 16, width: 120 * line, background: T.c.bone, opacity: 0.6, marginLeft: tall ? "auto" : 0, marginRight: tall ? "auto" : 0 }} />
    </div>
  );
};

/* ---------- captions: the line, word by word, on the voice's own timing ---------- */
function pages(words: Word[], per: number): Word[][] {
  const out: Word[][] = []; let cur: Word[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    const brk = /[.:?!]$/.test(w.w) || (cur.length >= per - 2 && /[,;]$/.test(w.w)) || cur.length >= per;
    if (brk && i < words.length - 1) { out.push(cur); cur = []; }
  });
  if (cur.length) out.push(cur);
  return out;
}
const Captions: React.FC<{ shot: Shot; tall: boolean }> = ({ shot, tall }) => {
  const f = useCurrentFrame(); /* frames since the shot's speech starts */
  const { fps } = useVideoConfig();
  const t = f / fps;
  const P = pages(shot.words, tall ? 5 : 9);
  let pi = 0;
  P.forEach((pg, i) => { if (t >= pg[0].s - 0.05) pi = i; });
  const pg = P[pi];
  const end = shot.frames - (shot.speechFrom - shot.from);
  const nextStart = P[pi + 1] ? P[pi + 1][0].s : Infinity;
  /* a page leaves just before the next one, or as the shot ends */
  const leaveAt = Math.min(nextStart * fps - 4, end - 8);
  const out = interpolate(f, [leaveAt - 6, leaveAt], [0, 1], { ...clamp, easing: T.ease.in });
  const nowIdx = pg.findIndex((w, i) => t >= w.s && (i === pg.length - 1 || t < pg[i + 1].s));
  if (t < pg[0].s - 0.05) return null;
  return (
    <div style={{ position: "absolute", left: tall ? 70 : 260, right: tall ? 70 : 260, top: tall ? 1636 : undefined, bottom: tall ? undefined : 52,
      display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: tall ? 16 : 14, rowGap: tall ? 6 : 2,
      opacity: 1 - out, transform: `translateY(${-12 * out}px)` }}>
      {pg.map((w, i) => {
        /* the spoken-word sweep (jason-motion-graphics): unsaid words wait as ghosts, each lights on its own spoken frame */
        const s = spring({ frame: f - Math.round(w.s * fps) + 2, fps, config: T.spring.word });
        const ghost = 0.22 * spring({ frame: f - Math.round(pg[0].s * fps) + 4, fps, config: T.spring.word });
        const on = i === nowIdx;
        return (
          <span key={i} style={{ display: "inline-block", position: "relative", font: `500 ${tall ? 56 : 42}px/1.3 ${T.f.sans}`, color: T.c.bone, letterSpacing: "0.005em",
            opacity: ghost + (1 - ghost) * s, transform: `translateY(${(1 - s) * 10}px)`, filter: `blur(${(1 - s) * 4}px)`, textShadow: "0 2px 18px rgba(0,0,0,.6)" }}>
            {w.w}
            <span style={{ position: "absolute", left: 0, right: 0, bottom: tall ? 2 : 1, height: 2, background: T.c.bone, opacity: on ? 0.7 : 0, transform: `scaleX(${on ? 1 : 0.4})`, transformOrigin: "left center" }} />
          </span>
        );
      })}
    </div>
  );
};

/* ---------- a still on a screen, with the camera inside it ---------- */
function camAt(plan: ShotPlan, k: number) {
  const e = T.ease.cam(k);
  const z = plan.from.z + (plan.to.z - plan.from.z) * e;
  const x = plan.from.x + (plan.to.x - plan.from.x) * e;
  const y = plan.from.y + (plan.to.y - plan.from.y) * e;
  return { z, x, y };
}
const Stills: React.FC<{ plan: ShotPlan; dur: number; w: number; h: number }> = ({ plan, dur, w, h }) => {
  const f = useCurrentFrame();
  const k = Math.max(0, Math.min(1, f / dur));
  const { z, x, y } = camAt(plan, k);
  /* keep the framing inside the still: the point (x, y) sits as near centre as the zoom allows */
  const tx = Math.max(-(z - 1) * w, Math.min(0, w / 2 - x * w * z));
  const ty = Math.max(-(z - 1) * h, Math.min(0, h / 2 - y * h * z));
  const n = plan.stills.length, seg = dur / n;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${z})` }}>
        {plan.stills.map((s, i) => {
          const a = i === 0 ? 1 : interpolate(f, [i * seg - 8, i * seg + 10], [0, 1], { ...clamp, easing: T.ease.out });
          return <Img key={s} src={shotSrc(s)} style={{ position: "absolute", inset: 0, width: w, height: h, opacity: a }} />;
        })}
      </div>
    </div>
  );
};

/* the ambient light a screen throws into the dark room around it */
const Ambient: React.FC<{ still: string; dim?: number }> = ({ still, dim = 0.4 }) => {
  if (/^(deck|verify|resume)$/.test(still)) dim = Math.min(dim, 0.16);
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img src={shotSrc(still)} style={{ position: "absolute", left: "-10%", top: "-10%", width: "120%", height: "120%", objectFit: "cover", filter: `blur(70px) brightness(${dim}) saturate(0.9)`, transform: `scale(${1.05 + Math.sin(f / 90) * 0.01})` }} />
      <AbsoluteFill style={{ background: "rgba(10,15,13,0.5)" }} />
    </AbsoluteFill>
  );
};

/* ---------- a wide shot: the site on a display, in a dark room ---------- */
const WideShot: React.FC<{ shot: Shot; plan: ShotPlan; first?: boolean }> = ({ shot, plan, first }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = shot.frames + T.overlap;
  /* the first screen starts full bleed (the match from the drawing) and settles into its frame */
  const settle = first ? spring({ frame: f - Math.round(dur * 0.42), fps, config: { damping: 200, stiffness: 40, mass: 1.4 } }) : 1;
  const W = 1920 + (1400 - 1920) * settle, H = W * 9 / 16;
  const left = (1920 - W) / 2, top = (1080 - H) / 2 + (first ? -6 * settle : -6) + Math.sin(f / 70) * 3 * settle;
  const r = 14 * settle;
  const which = plan.stills[Math.min(plan.stills.length - 1, Math.floor((f / dur) * plan.stills.length))];
  return (
    <AbsoluteFill style={{ background: T.c.ink }}>
      <AbsoluteFill style={{ opacity: settle }}><Ambient still={which} /></AbsoluteFill>
      <div style={{ position: "absolute", left, top, width: W, height: H, borderRadius: r, overflow: "hidden",
        boxShadow: `0 0 0 1px rgba(237,231,219,${0.18 * settle}), 0 50px 120px rgba(0,0,0,${0.65 * settle})` }}>
        <Stills plan={plan} dur={dur} w={W} h={H} />
      </div>
      {CHAPTER[shot.shot] && <Chapter text={CHAPTER[shot.shot]} dur={dur} tall={false} />}
    </AbsoluteFill>
  );
};

/* ---------- the sale desk: the phone itself, stepping through a sale ---------- */
const DeskShot: React.FC<{ shot: Shot; tall: boolean }> = ({ shot, tall }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = shot.frames + T.overlap;
  const seg = (dur - 20) / DESK.length;
  const ph = tall ? 1240 : 900, pw = ph * 600 / 1242;
  /* the phone is bright: it rises in after the cut's dissolve, never during it (a pop in QA) */
  const arrive = spring({ frame: f - T.overlap - 4, fps, config: { damping: 200, stiffness: 70, mass: 1 } });
  const float = Math.sin(f / 40) * 6;
  const z = 1 + 0.05 * T.ease.cam(Math.min(1, f / dur));
  const cx = tall ? 540 : 1280, cy = tall ? 330 + ph / 2 : 560;
  return (
    <AbsoluteFill style={{ background: T.c.ink }}>
      {!tall && <Ambient still="desk-wide" dim={0.22} />}
      {tall && <Ambient still="m-desk" dim={0.4} />}
      {!tall && (
        <div style={{ position: "absolute", left: 260, top: 260, width: 640, opacity: arrive, transform: `translateY(${(1 - arrive) * 20}px)` }}>
          {["Pick the car.", "Scan the license once.", "The money, worked out.", "Only the forms it needs.", "Signed at the desk."].map((s, i) => {
            const at = Math.round(seg * [1, 3, 5, 6, 7][i]);
            const k = spring({ frame: f - at, fps, config: T.spring.settle });
            const lit = f >= at;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 22, padding: "17px 0", borderBottom: `1px solid ${T.c.hair}`, opacity: 0.35 + 0.65 * k, transform: `translateX(${(1 - k) * -12}px)` }}>
                <span style={{ width: 34, height: 34, borderRadius: 17, display: "grid", placeItems: "center", border: `1px solid ${lit ? T.c.bone : T.c.hair2}`, background: lit ? T.c.bone : "transparent", color: lit ? T.c.ink : T.c.ash, font: `500 15px/1 ${T.f.sans}` }}>{i + 1}</span>
                <span style={{ font: `500 30px/1.2 ${T.f.sans}`, color: lit ? T.c.bone : T.c.ash }}>{s}</span>
              </div>
            );
          })}
          <div style={{ marginTop: 26, font: `400 22px/1.4 ${T.f.sans}`, color: T.c.ash }}>Fictional buyer, example figures.</div>
        </div>
      )}
      <div style={{ position: "absolute", left: cx - pw / 2, top: cy - ph / 2 + float + (1 - arrive) * 60, width: pw, height: ph, opacity: arrive,
        transform: `scale(${z})`, filter: "drop-shadow(0 50px 80px rgba(0,0,0,.7))" }}>
        {DESK.map((s, i) => {
          const a = i === 0 ? 1 : interpolate(f, [10 + i * seg - 2, 10 + i * seg + 3], [0, 1], { ...clamp, easing: T.ease.out });
          return <Img key={s} src={shotSrc(s)} style={{ position: "absolute", inset: 0, width: pw, height: ph, opacity: a }} />;
        })}
      </div>
      <Chapter text={CHAPTER.desk} dur={dur} tall={tall} />
    </AbsoluteFill>
  );
};

/* ---------- a tall shot: the site on a phone ---------- */
const PhoneFrame: React.FC<{ children: React.ReactNode; w: number; h: number; style?: React.CSSProperties }> = ({ children, w, h, style }) => (
  <div style={{ position: "absolute", width: w + 28, height: h + 28, borderRadius: 64, background: "#1c1f1d", padding: 14, boxShadow: "inset 0 0 0 1px rgba(237,231,219,.12), 0 50px 100px rgba(0,0,0,.7)", ...style }}>
    <div style={{ position: "relative", width: w, height: h, borderRadius: 52, overflow: "hidden", background: T.c.ink }}>
      {children}
      <div style={{ position: "absolute", left: "50%", top: 14, width: 150, height: 40, marginLeft: -75, borderRadius: 20, background: "#000" }} />
    </div>
  </div>
);
const TallShot: React.FC<{ shot: Shot; plan: ShotPlan; first?: boolean }> = ({ shot, plan, first }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = shot.frames + T.overlap;
  const settle = first ? spring({ frame: f - Math.round(dur * 0.42), fps, config: { damping: 200, stiffness: 40, mass: 1.4 } }) : 1;
  /* the phone: 390 by 844 at 1240 tall; the first shot starts full bleed */
  const PH = 1240, PW = PH * 390 / 844;
  const h = 1920 + (PH - 1920) * settle, w = first ? 1080 + (PW - 1080) * settle : PW;
  const top = 330 * settle + (1920 - h) / 2 * (1 - settle) + Math.sin(f / 70) * 3 * settle;
  const which = plan.stills[Math.min(plan.stills.length - 1, Math.floor((f / dur) * plan.stills.length))];
  const inner = <Stills plan={plan} dur={dur} w={w} h={w * 844 / 390} />;
  return (
    <AbsoluteFill style={{ background: T.c.ink }}>
      <AbsoluteFill style={{ opacity: settle }}><Ambient still={which} /></AbsoluteFill>
      {settle < 0.999 ? (
        <div style={{ position: "absolute", left: (1080 - w) / 2, top: top + (h - w * 844 / 390) / 2, width: w, height: w * 844 / 390, borderRadius: 52 * settle, overflow: "hidden" }}>{inner}</div>
      ) : (
        <PhoneFrame w={PW} h={PH} style={{ left: (1080 - PW) / 2 - 14, top: top - 14 }}>{inner}</PhoneFrame>
      )}
      {CHAPTER[shot.shot] && <Chapter text={CHAPTER[shot.shot]} dur={dur} tall />}
    </AbsoluteFill>
  );
};
/* the resume as a printed page, for the tall cut */
const PaperShot: React.FC<{ shot: Shot }> = ({ shot }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = shot.frames + T.overlap;
  const a = spring({ frame: f - 4, fps, config: T.spring.settle });
  const z = 1 + 0.06 * T.ease.cam(Math.min(1, f / dur));
  /* the page sits in the middle of the 1600 by 900 capture: crop to it */
  const cw = 820, ch = cw * 1.25, sw = cw / 0.51;
  return (
    <AbsoluteFill style={{ background: T.c.ink }}>
      <Ambient still="resume" dim={0.12} />
      <div style={{ position: "absolute", left: (1080 - cw) / 2, top: 360 + (1 - a) * 50, width: cw, height: ch, overflow: "hidden", borderRadius: 6, opacity: a, transform: `scale(${z}) rotate(${-1.2 + 1.2 * a}deg)`, boxShadow: "0 40px 90px rgba(0,0,0,.6)" }}>
        <Img src={shotSrc("resume")} style={{ position: "absolute", width: sw, height: sw * 9 / 16, left: -sw * 0.245, top: -sw * 9 / 16 * 0.1 }} />
      </div>
      <Chapter text={CHAPTER.resume} dur={dur} tall />
    </AbsoluteFill>
  );
};

/* ---------- the opening and the close: the drawing of the lot ---------- */
const BootShot: React.FC<{ shot: Shot; tall: boolean; next: string }> = ({ shot, tall, next }) => {
  const f = useCurrentFrame();
  const dur = shot.frames + T.overlap;
  const drawEnd = Math.round(dur * 0.55);
  const p = interpolate(f, [6, drawEnd], [0, 1], { ...clamp, easing: T.ease.cam });
  const lit = interpolate(f, [drawEnd, drawEnd + 14], [0, 1], { ...clamp, easing: T.ease.out });
  /* the photo is whole before the title screen's shot takes over (it starts 2 overlaps before this one ends) */
  const photo = interpolate(f, [drawEnd + 10, dur - 2 * T.overlap - 2], [0, 1], { ...clamp, easing: T.ease.cam });
  /* the drawing sits exactly where the title screen's photo puts the lot (game.css, .boot__draw) */
  const k = 1080 / 390;
  const svg: React.CSSProperties = tall ? { left: -1018.2 * k, top: -208.5, width: 1500.2 * k, height: 844 * k } : { left: 0, top: 0, width: 1920, height: 1080 };
  const still = tall ? "m-title" : "title";
  const label = interpolate(f, [8, 26, drawEnd, drawEnd + 12], [0, 1, 1, 0], { ...clamp, easing: T.ease.out });
  return (
    <AbsoluteFill style={{ background: T.c.ink }}>
      <LineLot p={p} lit={lit} style={{ ...svg, transform: `scale(${1 + 0.02 * photo})`, transformOrigin: "60% 50%" }} />
      <AbsoluteFill style={{ opacity: photo }}>
        <Img src={shotSrc(still)} style={tall ? { position: "absolute", left: 0, top: -208.5, width: 1080, height: 844 * k } : { width: 1920, height: 1080 }} />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: tall ? 0 : 140, right: tall ? 0 : undefined, bottom: tall ? 300 : 150, textAlign: tall ? "center" : "left", opacity: label,
        font: `500 ${tall ? 22 : 18}px/1 ${T.f.sans}`, letterSpacing: "0.32em", color: T.c.bone2 }}>OPENING THE LOT</div>
    </AbsoluteFill>
  );
};
const EndShot: React.FC<{ shot: Shot; tall: boolean }> = ({ shot, tall }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = 1080 / 390;
  const svg: React.CSSProperties = tall ? { left: -1018.2 * k, top: -208.5, width: 1500.2 * k, height: 844 * k } : { left: 0, top: 0, width: 1920, height: 1080 };
  const p = interpolate(f, [0, 70], [0, 1], { ...clamp, easing: T.ease.cam });
  const a = spring({ frame: f - 14, fps, config: T.spring.settle });
  const b = spring({ frame: f - 26, fps, config: T.spring.settle });
  const c = spring({ frame: f - 40, fps, config: T.spring.settle });
  const breathe = 0.82 + 0.18 * (0.5 + 0.5 * Math.cos(f / 12));
  return (
    <AbsoluteFill style={{ background: T.c.ink }}>
      <LineLot p={p} lit={interpolate(f, [60, 80], [0, 1], clamp)} dim={0.32} style={svg} />
      <AbsoluteFill style={{ background: "linear-gradient(0deg, rgba(10,15,13,.92) 0%, rgba(10,15,13,.3) 60%)" }} />
      <div style={{ position: "absolute", left: tall ? 0 : 160, right: tall ? 0 : undefined, top: tall ? 980 : 520, textAlign: tall ? "center" : "left" }}>
        <div style={{ font: `600 ${tall ? 104 : 124}px/0.92 ${T.f.serif}`, letterSpacing: "0.12em", color: T.c.bone, opacity: a, transform: `translateY(${(1 - a) * 24}px)` }}>
          <div>JASON</div><div style={{ letterSpacing: "0.1em" }}>OBAWEMIMO</div>
        </div>
        <div style={{ marginTop: 28, font: `400 ${tall ? 32 : 30}px/1.3 ${T.f.sans}`, color: T.c.bone2, opacity: b, transform: `translateY(${(1 - b) * 14}px)` }}>jasonobawemimo.com</div>
        <div style={{ marginTop: 40, font: `500 ${tall ? 20 : 17}px/1 ${T.f.sans}`, letterSpacing: "0.32em", color: T.c.bone, opacity: c * breathe }}>PRESS START</div>
        {TL.voiced && <div style={{ marginTop: 34, font: `400 ${tall ? 20 : 17}px/1.3 ${T.f.sans}`, color: T.c.ash, opacity: c }}>{(lines as any).voice.label}</div>}
      </div>
    </AbsoluteFill>
  );
};

/* the score runs at 64 BPM from frame 0: a beat is 28.125 frames */
const BEAT = (30 * 60) / 64;
const onBeat = (fr: number) => Math.round(Math.ceil(fr / BEAT) * BEAT);

/* ---------- the film ---------- */
export const Tour: React.FC<{ tall: boolean }> = ({ tall }) => {
  const shots = TL.shots;
  const O = T.overlap;
  return (
    <AbsoluteFill style={{ background: T.c.ink }}>
      {/* the library's own score as the bed, under the voice when there is one */}
      <Audio src={staticFile("tour/score/bed.ogg")} loop volume={(f) => {
        const total = TL.frames;
        const fadeIn = interpolate(f, [0, 45], [0, 1], clamp), fadeOut = interpolate(f, [total - 60, total - 2], [1, 0], clamp);
        return (TL.voiced ? 0.2 : 0.42) * fadeIn * fadeOut;
      }} />
      {shots.map((s, i) => {
        const from = Math.max(0, s.from - (i ? O : 0));
        const dur = s.frames + (i ? O : 0) + (i < shots.length - 1 ? O : 0);
        const plan = tall ? TALL[s.shot] : WIDE[s.shot];
        let body: React.ReactNode = null;
        if (s.shot === "boot") body = <BootShot shot={s} tall={tall} next={shots[1].shot} />;
        else if (s.shot === "end") body = <EndShot shot={s} tall={tall} />;
        else if (s.shot === "desk") body = <DeskShot shot={s} tall={tall} />;
        else if (tall && s.shot === "resume") body = <PaperShot shot={s} />;
        else if (plan) body = tall ? <TallShot shot={s} plan={plan} first={s.shot === "title"} /> : <WideShot shot={s} plan={plan} first={s.shot === "title"} />;
        return (
          <Sequence key={s.shot} from={from} durationInFrames={dur} name={s.shot}>
            <ShotFade dur={dur} first={i === 0} last={i === shots.length - 1} hard={s.shot === "title"}>{body}</ShotFade>
          </Sequence>
        );
      })}
      {shots.map((s) => STING[s.shot] && (
        <Sequence key={"sting-" + s.shot} from={onBeat(s.from + STING[s.shot].at) - 1} durationInFrames={120} name={"sting " + STING[s.shot].name}>
          <Audio src={staticFile(`tour/score/sting-${STING[s.shot].name}.ogg`)} volume={TL.voiced ? 0.35 : 0.6} />
        </Sequence>
      ))}
      {shots.map((s) => s.voiced && s.audio && (
        <Sequence key={"vo-" + s.shot} from={s.speechFrom} durationInFrames={s.frames} name={"voice " + s.line}>
          <Audio src={staticFile(`tour/voice/${s.line}.mp3`)} />
        </Sequence>
      ))}
      <Finish />
      {shots.map((s) => (
        <Sequence key={"cap-" + s.shot} from={s.speechFrom} durationInFrames={s.frames - (s.speechFrom - s.from)} name={"caption " + s.line}>
          <Captions shot={s} tall={tall} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/* every cut is a dissolve with a breath of scale; the title screen arrives without one (the drawing hands it over) */
const ShotFade: React.FC<{ dur: number; first: boolean; last: boolean; hard: boolean; children: React.ReactNode }> = ({ dur, first, last, hard, children }) => {
  const f = useCurrentFrame();
  const O = T.overlap;
  /* a quick dissolve (two screens of UI never sit on each other for long) under a slower push */
  const a = first || hard ? 1 : interpolate(f, [O - 5, O + 5], [0, 1], { ...clamp, easing: T.ease.out });
  const z = first || hard ? 1 : interpolate(f, [O - 5, O * 2 + 4], [1.07, 1], { ...clamp, easing: T.ease.out });
  const inner = <AbsoluteFill style={{ opacity: a, transform: `scale(${z})` }}>{children}</AbsoluteFill>;
  /* the push through a cut smears like a camera move (30 fps plus CameraMotionBlur, jason-motion-graphics); once it settles, plain frames */
  if (!first && !hard && f < O * 2) return <CameraMotionBlur samples={6} shutterAngle={180}>{inner}</CameraMotionBlur>;
  return inner;
};
