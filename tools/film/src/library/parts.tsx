import React from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { GATE, LOOP, PUSH, Tint, lib, swell } from "./theme";

const W = LOOP.w;
const H = LOOP.h;

/* every relight layer redraws the same plate, so it travels by context */
const PlateCtx = React.createContext<string>("");

/* the plate as an SVG image that holds the frame until it has loaded */
export const PlateImage: React.FC<{ filter?: string }> = ({ filter }) => {
  const href = React.useContext(PlateCtx);
  const [handle] = React.useState(() => delayRender("plate " + href));
  const done = React.useRef(false);
  const finish = React.useCallback(() => {
    if (done.current) return;
    done.current = true;
    continueRender(handle);
  }, [handle]);
  return (
    <image
      href={href}
      x={0}
      y={0}
      width={W}
      height={H}
      preserveAspectRatio="none"
      filter={filter}
      onLoad={finish}
      onError={() => cancelRender(new Error("plate did not load: " + href))}
    />
  );
};

/* shared shapes for masks: a soft round falloff, a plateau with a feathered rim,
   a band soft across its width, and the gate that keeps light out of the type zone */
const SharedDefs: React.FC = () => (
  <defs>
    <radialGradient id="soft">
      <stop offset="0" stopColor="#fff" stopOpacity="1" />
      <stop offset="0.25" stopColor="#fff" stopOpacity="0.86" />
      <stop offset="0.5" stopColor="#fff" stopOpacity="0.52" />
      <stop offset="0.75" stopColor="#fff" stopOpacity="0.17" />
      <stop offset="1" stopColor="#fff" stopOpacity="0" />
    </radialGradient>
    <radialGradient id="plateau">
      <stop offset="0" stopColor="#fff" stopOpacity="1" />
      <stop offset="0.62" stopColor="#fff" stopOpacity="1" />
      <stop offset="0.84" stopColor="#fff" stopOpacity="0.45" />
      <stop offset="1" stopColor="#fff" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="band" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#fff" stopOpacity="0" />
      <stop offset="0.25" stopColor="#fff" stopOpacity="0.45" />
      <stop offset="0.5" stopColor="#fff" stopOpacity="1" />
      <stop offset="0.75" stopColor="#fff" stopOpacity="0.45" />
      <stop offset="1" stopColor="#fff" stopOpacity="0" />
    </linearGradient>
    <linearGradient id="gate-ramp" gradientUnits="userSpaceOnUse" x1={GATE.from} y1="0" x2={GATE.to} y2="0">
      <stop offset="0" stopColor="#fff" stopOpacity="0" />
      <stop offset="1" stopColor="#fff" stopOpacity="1" />
    </linearGradient>
    <mask id="gate" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
      <rect x="0" y="0" width={W} height={H} fill="url(#gate-ramp)" />
    </mask>
  </defs>
);

/* a soft ellipse for mask content: centre, radii, rotation in degrees, strength */
export const Soft: React.FC<{ cx: number; cy: number; rx: number; ry: number; rot?: number; o?: number; fill?: "soft" | "plateau" }> = ({
  cx, cy, rx, ry, rot = 0, o = 1, fill = "soft",
}) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${fill})`} opacity={o} transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined} />;

/* a long band, soft across its width, standing at x and leaning `rot` degrees */
export const Band: React.FC<{ x: number; y: number; width: number; height: number; rot?: number; o?: number }> = ({ x, y, width, height, rot = 0, o = 1 }) => (
  <rect x={x - width / 2} y={y - height / 2} width={width} height={height} fill="url(#band)" opacity={o} transform={rot ? `rotate(${rot} ${x} ${y})` : undefined} />
);

/* light that behaves: the plate relit by a practical. The mask (children, white
   is lit) is gated off the type zone; the plate is scaled by the tint and gain,
   and gamma above 1 favours what already shines (wet ground, glass, brass).
   Screen keeps highlights from clipping, so the grade holds. */
export const Relight: React.FC<{ id: string; tint: Tint; gain: number; gamma?: number; children: React.ReactNode }> = ({ id, tint, gain, gamma = 1, children }) => (
  <>
    <defs>
      <filter id={`lit-${id}`} filterUnits="userSpaceOnUse" x="0" y="0" width={W} height={H} colorInterpolationFilters="sRGB">
        <feComponentTransfer>
          <feFuncR type="gamma" amplitude={gain * tint[0]} exponent={gamma} offset="0" />
          <feFuncG type="gamma" amplitude={gain * tint[1]} exponent={gamma} offset="0" />
          <feFuncB type="gamma" amplitude={gain * tint[2]} exponent={gamma} offset="0" />
        </feComponentTransfer>
      </filter>
      <mask id={`m-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
        <g mask="url(#gate)">{children}</g>
      </mask>
    </defs>
    <g mask={`url(#m-${id})`} style={{ mixBlendMode: "screen" }}>
      <PlateImage filter={`url(#lit-${id})`} />
    </g>
  </>
);

/* film grain, fresh every frame: overlay, so it rides the plate's tones and never lifts black */
export const Grain: React.FC<{ amount?: number }> = ({ amount = lib.grain }) => {
  const frame = useCurrentFrame();
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, mixBlendMode: "overlay", opacity: amount, pointerEvents: "none" }}>
      <filter id="grain" filterUnits="userSpaceOnUse" x="0" y="0" width={W} height={H} colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.92" numOctaves="2" seed={(frame % LOOP.frames) + 1} stitchTiles="noStitch" />
        <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0 1" />
        <feComponentTransfer>
          <feFuncR type="linear" slope="2.6" intercept="-0.8" />
          <feFuncG type="linear" slope="2.6" intercept="-0.8" />
          <feFuncB type="linear" slope="2.6" intercept="-0.8" />
        </feComponentTransfer>
      </filter>
      <rect x="0" y="0" width={W} height={H} filter="url(#grain)" />
    </svg>
  );
};

/* the stage: the still, a 1.5 percent push and back on a sine, the light, then grain on top */
export const LoopStage: React.FC<{ id: string; children?: React.ReactNode }> = ({ id, children }) => {
  const frame = useCurrentFrame();
  const s = 1 + PUSH.amount * swell(frame);
  const href = staticFile(`library/${id}.png`);
  return (
    <AbsoluteFill style={{ background: lib.shadow }}>
      <PlateCtx.Provider value={href}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
          <SharedDefs />
          <g transform={`translate(${PUSH.ox} ${PUSH.oy}) scale(${s}) translate(${-PUSH.ox} ${-PUSH.oy})`}>
            <PlateImage />
            {children}
          </g>
        </svg>
      </PlateCtx.Provider>
      <Grain />
    </AbsoluteFill>
  );
};
