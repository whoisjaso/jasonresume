import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { dash, clamp } from "./theme";

const C = dash.c;

/* ---------- the cabin: dash leather, a passing streetlight, the stitched seam ---------- */
export const Cabin: React.FC<{ seamAt?: number }> = ({ seamAt = 0.86 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, height } = useVideoConfig();
  // one streetlight band crosses the dash per loop, eased so it lingers mid-dash
  const sweep = interpolate(frame, [0, durationInFrames], [-0.45, 1.25], { easing: dash.ease.inOut, ...clamp });
  const y = height * seamAt;
  return (
    <AbsoluteFill style={{ background: C.dash }}>
      <AbsoluteFill style={{ background: `radial-gradient(120% 70% at 50% 0%, ${C.panel} 0%, ${C.dash} 58%)` }} />
      <AbsoluteFill style={{ background: `linear-gradient(105deg, transparent ${sweep * 100 - 14}%, rgba(239,232,216,0.06) ${sweep * 100}%, transparent ${sweep * 100 + 14}%)` }} />
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        <line x1="0" x2="100%" y1={y - 3} y2={y - 3} stroke={C.seam} strokeWidth="3" />
        <line x1="0" x2="100%" y1={y + 9} y2={y + 9} stroke={C.stitch} strokeWidth="2.4" strokeDasharray="14 10" strokeLinecap="round" opacity="0.7" />
      </svg>
    </AbsoluteFill>
  );
};

/* ---------- grade, grain and vignette sit above everything ---------- */
export const Finish: React.FC<{ grain?: number; vignette?: number }> = ({ grain = 0.08, vignette = 0.5 }) => {
  const frame = useCurrentFrame();
  const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`;
  return (
    <>
      <AbsoluteFill style={{ pointerEvents: "none", backgroundColor: C.stitch, mixBlendMode: "soft-light", opacity: 0.12 }} />
      <AbsoluteFill style={{ pointerEvents: "none", backgroundImage: noise, backgroundSize: "240px", backgroundPosition: `${(frame * 7) % 240}px ${(frame * 13) % 240}px`, opacity: grain, mixBlendMode: "overlay" }} />
      <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,${vignette}) 100%)` }} />
    </>
  );
};

/* loops seam through black, quicker out than in */
export const LoopFade: React.FC<{ inF?: number; outF?: number }> = ({ inF = 14, outF = 10 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const o = Math.max(
    interpolate(frame, [0, inF], [1, 0], { easing: dash.ease.out, ...clamp }),
    interpolate(frame, [durationInFrames - outF, durationInFrames - 1], [0, 1], { easing: dash.ease.in, ...clamp })
  );
  return <AbsoluteFill style={{ background: C.seam, opacity: o, pointerEvents: "none" }} />;
};

/* ---------- the needle's ignition sweep: up to the stop, then settle on the value ---------- */
export function sweep(frame: number, fps: number, start: number, min: number, max: number, value: number) {
  const up = spring({ frame: frame - start, fps, config: dash.spring.slow });
  const down = spring({ frame: frame - start - Math.round(fps * 0.8), fps, config: dash.spring.needle });
  const peak = min + (max - min) * up;
  return peak * (1 - down) + value * down;
}

/* ---------- a gauge: chrome bezel, ivory face, ticks, numerals, red needle ---------- */
export const Gauge: React.FC<{
  size: number; min: number; max: number; value: number; major: number; minor: number;
  label: string; readout?: string; red?: number; fmt?: (n: number) => string; style?: React.CSSProperties;
  steps?: string[]; lit?: number;
}> = ({ size, min, max, value, major, minor, label, readout, red, fmt = (n) => String(n), style, steps, lit = -1 }) => {
  const id = React.useId().replace(/:/g, "");
  const deg = (v: number) => -135 + ((v - min) / (max - min)) * 270;
  const pt = (d: number, r: number) => { const a = ((d - 90) * Math.PI) / 180; return [100 + r * Math.cos(a), 100 + r * Math.sin(a)]; };
  const ticks: React.ReactNode[] = [];
  const nTicks = Math.round((max - min) / minor);
  for (let i = 0; i <= nTicks; i++) {
    const t = min + i * minor, isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6;
    const [x1, y1] = pt(deg(t), 82), [x2, y2] = pt(deg(t), isMajor ? 71 : 76);
    ticks.push(<line key={"t" + i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={red !== undefined && t >= red ? C.needle : C.ink} strokeWidth={isMajor ? 2.6 : 1.2} strokeLinecap="round" />);
    if (isMajor) { const [nx, ny] = pt(deg(t), 59); ticks.push(<text key={"n" + i} x={nx} y={ny + 5} textAnchor="middle" fontFamily={dash.font.sans} fontWeight={700} fontSize="14" fill={C.ink}>{fmt(t)}</text>); }
  }
  if (steps) steps.forEach((name, i) => {
    const d = deg(min + i * major), [x, y] = pt(d, 112), side = x < 92 ? "end" : x > 108 ? "start" : "middle";
    ticks.push(<text key={"s" + i} x={x} y={y + 3} textAnchor={side} fontFamily={dash.font.sans} fontWeight={i <= lit ? 700 : 500} fontSize="9" fill={i <= lit ? C.text : C.mute}>{name}</text>);
  });
  let redArc = null;
  if (red !== undefined) {
    const [ax, ay] = pt(deg(red), 85), [bx, by] = pt(deg(max), 85);
    const large = deg(max) - deg(red) > 180 ? 1 : 0;
    redArc = <path d={`M ${ax} ${ay} A 85 85 0 ${large} 1 ${bx} ${by}`} fill="none" stroke={C.needle} strokeWidth="4" opacity="0.85" />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ overflow: "visible", filter: "drop-shadow(0 18px 28px rgba(0,0,0,0.55))", ...style }}>
      <defs>
        <linearGradient id={"bz" + id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={C.chromeHi} /><stop offset="0.45" stopColor={C.chromeMid} /><stop offset="0.55" stopColor={C.chromeLo} /><stop offset="1" stopColor={C.chromeHi} />
        </linearGradient>
        <radialGradient id={"fc" + id} cx="0.5" cy="0.38" r="0.7">
          <stop offset="0" stopColor={C.dial} /><stop offset="1" stopColor={C.dialShade} />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="98" fill={`url(#bz${id})`} />
      <circle cx="100" cy="100" r="90" fill={C.seam} />
      <circle cx="100" cy="100" r="88" fill={`url(#fc${id})`} />
      {redArc}
      {ticks}
      <text x="100" y="80" textAnchor="middle" fontFamily={dash.font.sans} fontWeight={700} fontSize="8.6" letterSpacing="1" fill={C.inkDim}>{label.toUpperCase()}</text>
      {readout ? <text x="100" y="156" textAnchor="middle" fontFamily={dash.font.sans} fontWeight={800} fontSize="21" fill={C.ink} style={{ fontVariantNumeric: "tabular-nums" }}>{readout}</text> : null}
      <g transform={`rotate(${deg(Math.min(max, Math.max(min, value)))} 100 100)`}>
        <polygon points="98.2,104 101.8,104 100.7,22 99.3,22" fill={C.needle} />
        <polygon points="98.6,104 101.4,104 100,122" fill={C.ink} />
      </g>
      <circle cx="100" cy="100" r="9" fill={C.ink} />
      <circle cx="100" cy="100" r="4.5" fill={`url(#bz${id})`} />
    </svg>
  );
};

/* ---------- a tell-tale lamp ---------- */
const LAMP_PATHS: Record<string, string> = {
  car: "M5 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M15 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M5 17H3v-6l2-5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0H9m-6-6h15m-6 0V6",
  check: "M4.5 12.5 9.5 17.5 19.5 6.5",
  wrench: "M7 10h3V7L6.5 3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1-3 3l-6-6a6 6 0 0 1-8-8z",
  sign: "M3 17c3-1 5 1 8 0s4-6 7-6c1.5 0 2.5 1 3 2M3 21h18",
};
export const Lamp: React.FC<{ icon: keyof typeof LAMP_PATHS; on: number; color: string; size?: number }> = ({ icon, on, color, size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ overflow: "visible", filter: on > 0.05 ? `drop-shadow(0 0 ${8 * on}px ${color})` : "none" }}>
    <path d={LAMP_PATHS[icon]} fill="none" stroke={on > 0.05 ? color : C.chromeLo} strokeOpacity={0.35 + 0.65 * on} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ---------- the odometer: black drums, ivory digits, rolling into place ---------- */
export const Odometer: React.FC<{ value: string; start: number; h?: number }> = ({ value, start, h = 92 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", gap: 6, padding: 8, background: C.seam, borderRadius: 10, boxShadow: `inset 0 0 0 2px ${C.chromeLo}, 0 18px 30px rgba(0,0,0,0.5)` }}>
      {value.split("").map((d, i) => {
        const target = parseInt(d, 10);
        const p = spring({ frame: frame - start - i * 5, fps, config: dash.spring.slow });
        const pos = target * p + (1 - p) * 0;
        return (
          <div key={i} style={{ width: h * 0.62, height: h, overflow: "hidden", borderRadius: 6, background: `linear-gradient(180deg, #050505, ${C.dash2} 50%, #050505)` }}>
            <div style={{ transform: `translateY(${-pos * h}px)` }}>
              {Array.from({ length: 10 }).map((_, k) => (
                <div key={k} style={{ height: h, display: "grid", placeItems: "center", fontFamily: dash.font.sans, fontWeight: 700, fontSize: h * 0.66, color: C.dial, fontVariantNumeric: "tabular-nums" }}>{k}</div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ---------- words land one at a time: rise, sharpen, settle ---------- */
export const Words: React.FC<{ text: string; start: number; per?: number; size: number; weight?: number; color?: string; em?: string[]; italic?: boolean; family?: string; exitAt?: number }> =
  ({ text, start, per = 3, size, weight = 800, color = C.text, em = [], italic = false, family = dash.font.sans, exitAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = exitAt === undefined ? 0 : interpolate(frame, [exitAt, exitAt + 10], [0, 1], { easing: dash.ease.in, ...clamp });
  return (
    <div style={{ display: "flex", flexWrap: "wrap", columnGap: size * 0.26, rowGap: 0, fontFamily: family, fontWeight: weight, fontStyle: italic ? "italic" : "normal", fontSize: size, lineHeight: 1.05, letterSpacing: "-0.03em", color, opacity: 1 - out, transform: `translateY(${-out * 28}px)` }}>
      {text.split(" ").map((w, i) => {
        const p = spring({ frame: frame - start - i * per, fps, config: dash.spring.snappy });
        const strip = (x: string) => x.replace(/[.,]/g, ""); const hot = em.map(strip).includes(strip(w));
        return (
          <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${interpolate(p, [0, 1], [36, 0])}px)`, filter: `blur(${interpolate(p, [0, 1], [8, 0])}px)`, color: hot ? C.needle : undefined }}>{w}</span>
        );
      })}
    </div>
  );
};

/* a soft rise for any block */
export const Rise: React.FC<{ start: number; children: React.ReactNode; exitAt?: number; style?: React.CSSProperties }> = ({ start, children, exitAt, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - start, fps, config: dash.spring.smooth });
  const out = exitAt === undefined ? 0 : interpolate(frame, [exitAt, exitAt + 10], [0, 1], { easing: dash.ease.in, ...clamp });
  return <div style={{ opacity: p * (1 - out), transform: `translateY(${interpolate(p, [0, 1], [30, 0]) - out * 24}px) scale(${interpolate(p, [0, 1], [0.96, 1])})`, ...style }}>{children}</div>;
};

/* idle breathing for anything on screen more than two seconds */
export const breathe = (frame: number, amp = 0.012, rate = 26) => 1 + Math.sin(frame / rate) * amp;
