import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { dash } from "./theme";
import { Cabin, Finish, Gauge, Lamp, LoopFade, Words } from "./parts";

/* Obavia's share card (assets/og-obavia.jpg) renders from this, as OgObavia
   (render-og-obavia.sh). The other dash films were retired with the dash. */
const C = dash.c;
const sans = dash.font.sans;

/* =====================================================================
   OBAVIA: the badge lands, the name, then the step dial walks a sale
   from the car to the signature and the green lamp lights.
   ===================================================================== */
const STEPS = ["The car", "The odometer", "The buyer", "The money", "The paperwork", "Signed"];
export const ObaviaFilm: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const k = width / 1600;
  const badge = spring({ frame: frame - 4, fps, config: dash.spring.snappy });
  let v = 0;
  for (let i = 1; i < STEPS.length; i++) v += spring({ frame: frame - (compact ? 0 : 74) - i * 26, fps, config: dash.spring.needle });
  if (compact) v = STEPS.length - 1;
  const lit = Math.floor(v + 0.15);
  const signed = compact ? 1 : spring({ frame: frame - 74 - 5 * 26 - 8, fps, config: dash.spring.snappy });
  const dev = compact ? 1 : spring({ frame: frame - 40, fps, config: dash.spring.smooth });
  return (
    <AbsoluteFill>
      <Cabin />
      <div style={{ position: "absolute", left: 130 * k, top: 140 * k, width: 760 * k }}>
        <div style={{ width: 150 * k, height: 150 * k, borderRadius: "50%", padding: 8 * k, background: `linear-gradient(135deg, ${C.chromeHi}, ${C.chromeMid} 45%, ${C.chromeLo} 55%, ${C.chromeHi})`, boxShadow: "0 18px 30px rgba(0,0,0,0.55)", transform: `scale(${interpolate(badge, [0, 1], [0.6, 1])}) rotate(${interpolate(badge, [0, 1], [-40, 0])}deg)`, opacity: badge }}>
          <Img src={staticFile("img/obavia-icon.png")} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
        </div>
        <div style={{ height: 34 * k }} />
        <Words text="Obavia" start={compact ? -40 : 12} size={128 * k} />
        <div style={{ height: 18 * k }} />
        <Words text="Every sale, start to signed." start={compact ? -40 : 28} per={3} size={52 * k} weight={600} em={["signed."]} />
        <div style={{ height: 40 * k }} />
        <div style={{ display: "flex", alignItems: "center", gap: 16 * k, opacity: dev, transform: `translateY(${(1 - dev) * 20}px)` }}>
          <Lamp icon="wrench" on={dev} color={C.amber} size={40 * k} />
          <span style={{ fontFamily: sans, fontWeight: 600, fontSize: 26 * k, color: C.dim }}>In development. For Texas independent dealers.</span>
        </div>
      </div>
      <div style={{ position: "absolute", right: 250 * k, top: 210 * k }}>
        <Gauge size={500 * k} min={0} max={5} value={v} major={1} minor={0.5} label="One question a screen" fmt={() => ""} steps={STEPS} lit={lit} />
        <div style={{ position: "absolute", left: "50%", top: "66%", transform: `translate(-50%, 0) scale(${interpolate(signed, [0, 1], [0.7, 1])})`, opacity: signed }}>
          <Lamp icon="check" on={signed} color={C.green} size={54 * k} />
        </div>
      </div>
      <Finish />
      {compact ? null : <LoopFade />}
    </AbsoluteFill>
  );
};
