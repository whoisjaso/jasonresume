import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Band, LoopStage, PlateImage, Relight, Soft } from "./parts";
import { LOOP, TAU, clamp, lib, orbit, pass, passWrapped, swell } from "./theme";

/* Every coordinate below is in plate pixels (1920 x 1080), read off the graded
   plate in assets/game/art/<id>-1920.webp before anything was placed. */

/* =====================================================================
   TRIPLE J: headlights from a car we never see sweep the wet lot once.
   The beam lifts the rear quarters of the parked cars, and the wet ground
   under it answers in vertical streaks. The pole lights hold.
   ===================================================================== */
const TJ_STREAKS = [
  { dx: -150, w: 10, h: 170, y: 860, o: 0.55 },
  { dx: -96, w: 16, h: 230, y: 880, o: 0.8 },
  { dx: -52, w: 12, h: 190, y: 850, o: 0.6 },
  { dx: -14, w: 20, h: 250, y: 890, o: 1 },
  { dx: 30, w: 14, h: 210, y: 870, o: 0.75 },
  { dx: 74, w: 18, h: 240, y: 880, o: 0.9 },
  { dx: 118, w: 11, h: 180, y: 850, o: 0.5 },
  { dx: 160, w: 15, h: 200, y: 860, o: 0.7 },
];
export const LibraryTripleJ: React.FC = () => {
  const frame = useCurrentFrame();
  const { p, env } = pass(frame, 18, 222, lib.ease.sweep, 1);
  const x = 880 + (2010 - 880) * p;
  return (
    <LoopStage id="triple-j">
      <defs>
        {/* below the pole heads (the lowest sits at y 498) and the tree line: the beam
            only reaches the cars' rear quarters and the ground */}
        <linearGradient id="tj-low" gradientUnits="userSpaceOnUse" x1="0" y1="505" x2="0" y2="548">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <filter id="tj-feather" filterUnits="userSpaceOnUse" x="1600" y="440" width="400" height="200">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <mask id="tj-floor" maskUnits="userSpaceOnUse" x="0" y="0" width={LOOP.w} height={LOOP.h}>
          <rect x="0" y="0" width={LOOP.w} height={LOOP.h} fill="url(#tj-low)" />
          {/* the showroom's glazing far back right holds, like the poles */}
          <rect x="1668" y="490" width="300" height="80" fill="#000" filter="url(#tj-feather)" />
        </mask>
      </defs>
      <Relight id="beam" tint={lib.light.headlamp} gain={1.0 * env} gamma={1.05}>
        <g mask="url(#tj-floor)">
          <Soft cx={x} cy={640} rx={200} ry={320} rot={-12} />
        </g>
      </Relight>
      <Relight id="wet" tint={lib.light.headlamp} gain={1.8 * env} gamma={1.45} sheen={0.035 * env}>
        <g mask="url(#tj-floor)">
          {TJ_STREAKS.map((s, i) => (
            <Soft key={i} cx={x + s.dx} cy={s.y} rx={s.w} ry={s.h} o={s.o} />
          ))}
        </g>
      </Relight>
    </LoopStage>
  );
};

/* =====================================================================
   LEAD TO TITLE: the brass lamp's pool breathes, twice a loop and barely,
   and a few motes of dust drift through its beam.
   ===================================================================== */
const MOTES = [
  { x: 985, y: 300, r: 3.0, ax: 12, ay: 20, fx: 1, fy: 1, ph: 0.05, o: 0.9, tw: 2 },
  { x: 1062, y: 335, r: 2.6, ax: 16, ay: 16, fx: 1, fy: 2, ph: 0.31, o: 0.8, tw: 3 },
  { x: 1118, y: 292, r: 2.8, ax: 10, ay: 24, fx: 2, fy: 1, ph: 0.62, o: 0.85, tw: 1 },
  { x: 948, y: 392, r: 3.2, ax: 14, ay: 18, fx: 1, fy: 1, ph: 0.84, o: 0.75, tw: 2 },
  { x: 1030, y: 425, r: 2.5, ax: 18, ay: 14, fx: 1, fy: 2, ph: 0.47, o: 0.85, tw: 3 },
  { x: 1104, y: 402, r: 2.9, ax: 12, ay: 22, fx: 2, fy: 1, ph: 0.18, o: 0.8, tw: 1 },
  { x: 1002, y: 472, r: 2.7, ax: 15, ay: 16, fx: 1, fy: 1, ph: 0.73, o: 0.7, tw: 2 },
  { x: 1150, y: 462, r: 2.6, ax: 11, ay: 18, fx: 1, fy: 2, ph: 0.92, o: 0.7, tw: 3 },
];
export const LibraryLeadToTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const breath = swell(frame, 2);
  return (
    <LoopStage id="lead-to-title">
      <defs>
        <radialGradient id="mote">
          <stop offset="0" stopColor={lib.bone} stopOpacity="1" />
          <stop offset="0.45" stopColor={lib.bone} stopOpacity="0.55" />
          <stop offset="1" stopColor={lib.bone} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cone-fall" gradientUnits="userSpaceOnUse" x1="0" y1="245" x2="0" y2="540">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.45" />
        </linearGradient>
        <filter id="cone-blur" filterUnits="userSpaceOnUse" x="760" y="160" width="560" height="460">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        {/* the beam under the shade, rim to counter */}
        <mask id="cone" maskUnits="userSpaceOnUse" x="0" y="0" width={LOOP.w} height={LOOP.h}>
          <polygon points="922,246 1166,246 1246,540 846,540" fill="url(#cone-fall)" filter="url(#cone-blur)" />
        </mask>
      </defs>
      <Relight id="pool" tint={lib.light.brass} gain={0.3 * breath} gamma={1.05}>
        <Soft cx={1060} cy={600} rx={400} ry={300} />
        <Soft cx={1042} cy={238} rx={150} ry={34} o={0.8} />
        <Soft cx={1045} cy={390} rx={170} ry={180} o={0.5} />
      </Relight>
      <g mask="url(#gate)">
        <g mask="url(#cone)" style={{ mixBlendMode: "screen" }}>
          {MOTES.map((m, i) => {
            const cx = m.x + m.ax * orbit(frame, m.fx, m.ph);
            const cy = m.y + m.ay * orbit(frame, m.fy, m.ph + 0.25);
            const turn = 0.55 + 0.45 * orbit(frame, m.tw, m.ph * 2);
            return <circle key={i} cx={cx} cy={cy} r={m.r * 2} fill="url(#mote)" opacity={m.o * turn * (0.85 + 0.15 * breath)} />;
          })}
        </g>
      </g>
    </LoopStage>
  );
};

/* =====================================================================
   THE INBOUND: the patched lamp breathes amber, and rain light from the
   window slides down the switchboard's wooden stile and across the desk.
   ===================================================================== */
const STILE = [
  { x: 1112, y: 240, d: 220, rx: 16, ry: 56, start: 0, dur: 100, o: 0.9 },
  { x: 1136, y: 310, d: 180, rx: 18, ry: 62, start: 36, dur: 88, o: 0.75 },
  { x: 1120, y: 420, d: 200, rx: 15, ry: 50, start: 72, dur: 104, o: 1 },
  { x: 1140, y: 260, d: 240, rx: 17, ry: 70, start: 112, dur: 96, o: 0.85 },
  { x: 1106, y: 470, d: 170, rx: 15, ry: 52, start: 150, dur: 90, o: 0.8 },
  { x: 1128, y: 350, d: 220, rx: 18, ry: 60, start: 188, dur: 108, o: 0.9 },
  { x: 1116, y: 540, d: 130, rx: 14, ry: 46, start: 222, dur: 84, o: 0.7 },
];
const DESK = [
  { x: 960, y: 772, d: 90, rx: 34, ry: 15, start: 20, dur: 110, o: 0.75 },
  { x: 1080, y: 792, d: 110, rx: 38, ry: 16, start: 90, dur: 120, o: 0.85 },
  { x: 1205, y: 772, d: 80, rx: 30, ry: 14, start: 160, dur: 110, o: 0.65 },
  { x: 1012, y: 822, d: 70, rx: 28, ry: 13, start: 205, dur: 100, o: 0.6 },
];
export const LibraryTheInbound: React.FC = () => {
  const frame = useCurrentFrame();
  const breath = swell(frame, 2);
  const drop = (s: (typeof STILE)[number], i: number, k: string) => {
    const { p, env, on } = passWrapped(frame, s.start, s.dur);
    if (!on) return null;
    return <Soft key={k + i} cx={s.x + (k === "d" ? 8 * p : 0)} cy={s.y + s.d * p} rx={s.rx} ry={s.ry * (1 + 0.25 * p)} o={s.o * env} />;
  };
  return (
    <LoopStage id="the-inbound">
      <Relight id="lamp" tint={lib.light.amber} gain={0.6 * breath} gamma={1.2}>
        <Soft cx={1450} cy={266} rx={30} ry={28} />
        <Soft cx={1452} cy={300} rx={230} ry={170} o={0.42} />
      </Relight>
      <Relight id="rain" tint={lib.light.rain} gain={1.3} gamma={1} sheen={0.045}>
        {STILE.map((s, i) => drop(s, i, "s"))}
        {DESK.map((s, i) => drop(s, i, "d"))}
      </Relight>
    </LoopStage>
  );
};

/* =====================================================================
   PROSPECTOR: a soft beam crosses the paper map, warming it and letting
   it cool, and as it passes one thread between two pins glints.
   ===================================================================== */
const THREAD = { x1: 1196, y1: 689, x2: 1286, y2: 634 };
export const LibraryProspector: React.FC = () => {
  const frame = useCurrentFrame();
  const { p, env } = pass(frame, 6, 234);
  const bx = 1660 + (1110 - 1660) * p;
  const by = 290 + (730 - 290) * p;
  // the beam's centre is nearest the thread at p = 0.79
  const glint = Math.exp(-Math.pow((p - 0.79) / 0.055, 2));
  const s = interpolate(p, [0.7, 0.88], [0.12, 0.88], { easing: lib.ease.drift, ...clamp });
  const off = (v: number) => Math.min(1, Math.max(0, v));
  return (
    <LoopStage id="prospector">
      <defs>
        <linearGradient id="glint" gradientUnits="userSpaceOnUse" x1={THREAD.x1} y1={THREAD.y1} x2={THREAD.x2} y2={THREAD.y2}>
          <stop offset={off(s - 0.18)} stopColor={lib.boneWarm} stopOpacity="0" />
          <stop offset={off(s)} stopColor={lib.boneWarm} stopOpacity="1" />
          <stop offset={off(s + 0.18)} stopColor={lib.boneWarm} stopOpacity="0" />
        </linearGradient>
        <filter id="glint-soft" filterUnits="userSpaceOnUse" x="1170" y="610" width="140" height="100">
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
      </defs>
      <Relight id="beam" tint={lib.light.paper} gain={0.4 * env} gamma={1.05}>
        <Soft cx={bx} cy={by} rx={320} ry={220} rot={-28} />
      </Relight>
      <line
        x1={THREAD.x1}
        y1={THREAD.y1}
        x2={THREAD.x2}
        y2={THREAD.y2}
        stroke="url(#glint)"
        strokeWidth={2.4}
        strokeLinecap="round"
        filter="url(#glint-soft)"
        opacity={0.9 * glint}
        style={{ mixBlendMode: "screen" }}
      />
    </LoopStage>
  );
};

/* =====================================================================
   NEUROSCIENCE: the last of the window light slides across the glass
   brain, catching its folds, while every lamp shade holds.
   ===================================================================== */
export const LibraryNeuroscience: React.FC = () => {
  const frame = useCurrentFrame();
  const { p, env } = pass(frame, 24, 216, lib.ease.sweep, 1.5);
  const x = 1230 + (1720 - 1230) * p;
  return (
    <LoopStage id="neuroscience">
      <defs>
        <radialGradient id="ns-plateau">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.78" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.92" stopColor="#fff" stopOpacity="0.4" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        {/* the glass only: cerebrum and cerebellum, clear of the shades at either side */}
        <mask id="brain" maskUnits="userSpaceOnUse" x="0" y="0" width={LOOP.w} height={LOOP.h}>
          <ellipse cx="1466" cy="548" rx="190" ry="128" fill="url(#ns-plateau)" />
          <ellipse cx="1530" cy="668" rx="86" ry="54" fill="url(#ns-plateau)" />
        </mask>
      </defs>
      <Relight id="window" tint={lib.light.dusk} gain={1.0 * env} gamma={1.3}>
        <g mask="url(#brain)">
          <Band x={x} y={577} width={200} height={520} rot={16} />
        </g>
      </Relight>
    </LoopStage>
  );
};

/* =====================================================================
   OBAVIA: the early light brightens a touch through the tall windows and
   on the floor, and the hem of the dust sheet over the car stirs.
   ===================================================================== */
export const LibraryObavia: React.FC = () => {
  const frame = useCurrentFrame();
  const light = swell(frame);
  // a draught that rises and settles once a loop, drifting the fold field as it goes
  const gust = swell(frame, 1, 0);
  const ang = (TAU * frame) / LOOP.frames;
  return (
    <LoopStage id="obavia">
      <defs>
        <filter id="ob-soften" filterUnits="userSpaceOnUse" x="1000" y="-100" width="1000" height="420">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <filter id="stir" filterUnits="userSpaceOnUse" x="1180" y="230" width="460" height="260" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.028" numOctaves="2" seed="11" result="folds" />
          <feOffset in="folds" dx={30 * Math.sin(ang)} dy={10 * (1 - Math.cos(ang))} result="drift" />
          <feDisplacementMap in="SourceGraphic" in2="drift" scale={26 * gust} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <radialGradient id="hem-plateau">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="hem" maskUnits="userSpaceOnUse" x="0" y="0" width={LOOP.w} height={LOOP.h}>
          <ellipse cx="1400" cy="352" rx="150" ry="58" fill="url(#hem-plateau)" />
        </mask>
      </defs>
      <Relight id="dawn" tint={lib.light.dawn} gain={0.2 * light} gamma={1}>
        <g filter="url(#ob-soften)">
          <rect x="1092" y="-40" width="566" height="240" fill="#fff" />
          <rect x="1760" y="-40" width="200" height="250" fill="#fff" />
        </g>
        <Soft cx={1360} cy={410} rx={340} ry={125} o={0.7} />
      </Relight>
      <g mask="url(#hem)">
        <PlateImage filter="url(#stir)" />
      </g>
    </LoopStage>
  );
};
