import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { dash, clamp } from "./theme";
import { Cabin, Finish, Gauge, Lamp, LoopFade, Odometer, Rise, Words, breathe, sweep } from "./parts";

const C = dash.c;
const sans = dash.font.sans;

/* =====================================================================
   THE RECORD: two gauges sweep at ignition and settle on what is true,
   the odometer rolls to the year it started, then the line about school.
   ===================================================================== */
export const RecordReel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const courses = sweep(frame, fps, 8, 0, 20, 19);
  const gpa = sweep(frame, fps, 14, 0, 4, 3.63);
  const b = breathe(frame);
  return (
    <AbsoluteFill>
      <Cabin />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
        <Words text="Jason Obawemimo" start={6} size={70} />
        <div style={{ height: 14 }} />
        <Rise start={20}><div style={{ fontFamily: sans, fontWeight: 500, fontSize: 30, color: C.dim }}>AI engineer and business operator.</div></Rise>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 110, top: 250, transform: `scale(${b})` }}>
        <Gauge size={420} min={0} max={20} value={courses} major={5} minor={1} label="Courses" readout={String(Math.round(courses))} />
      </div>
      <div style={{ position: "absolute", right: 110, top: 250, transform: `scale(${b})` }}>
        <Gauge size={420} min={0} max={4} value={gpa} major={1} minor={0.25} label="GPA" readout={gpa.toFixed(2)} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 330, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        <Rise start={40}><Odometer value="2024" start={46} h={104} /></Rise>
        <Rise start={70}><div style={{ fontFamily: sans, fontWeight: 600, fontSize: 25, color: C.text, textAlign: "center", lineHeight: 1.35 }}>Operator since August.<br />Founder since September.</div></Rise>
      </div>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 150 }}>
        <div style={{ position: "absolute", bottom: 150 }}>
          <Rise start={120} exitAt={186}><div style={{ fontFamily: sans, fontWeight: 600, fontSize: 30, color: C.text, textAlign: "center" }}>Associate of Arts in Business, San Jacinto College, May 2026.</div></Rise>
        </div>
        <div style={{ position: "absolute", bottom: 150 }}>
          <Words text="Every line checks out." start={200} size={44} weight={700} em={["checks"]} />
        </div>
      </AbsoluteFill>
      <Finish />
      <LoopFade />
    </AbsoluteFill>
  );
};

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

/* =====================================================================
   TRIPLE J: the lot itself, the lamp for the posted hours, the promise.
   ===================================================================== */
export const LotFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const zoom = interpolate(frame, [0, durationInFrames], [1.04, 1.14], { easing: dash.ease.inOut, ...clamp });
  const pan = interpolate(frame, [0, durationInFrames], [0, -40], { easing: dash.ease.inOut, ...clamp });
  const lamp = spring({ frame: frame - 44, fps, config: dash.spring.smooth });
  return (
    <AbsoluteFill style={{ background: C.dash }}>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img src={staticFile("img/triplej-og.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom}) translateX(${pan}px)`, filter: "saturate(0.9) contrast(1.06)" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(90deg, ${C.dash} 0%, rgba(19,18,17,0.88) 34%, rgba(19,18,17,0.2) 70%, rgba(19,18,17,0.35) 100%)` }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(10,9,9,0.4), transparent 30%, transparent 62%, rgba(10,9,9,0.75))" }} />
      <div style={{ position: "absolute", left: 120, top: 96 }}>
        <Rise start={4}><Img src={staticFile("img/triplej-logo.png")} style={{ height: 120 }} /></Rise>
      </div>
      <div style={{ position: "absolute", left: 120, bottom: 120, width: 900 }}>
        <Words text="Triple J Auto Investment" start={12} size={92} />
        <div style={{ height: 20 }} />
        <Rise start={30}><div style={{ fontFamily: sans, fontWeight: 600, fontSize: 30, color: C.text }}>8774 Almeda Genoa Rd, Houston</div></Rise>
        <div style={{ height: 26 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: lamp, transform: `translateY(${(1 - lamp) * 18}px)` }}>
          <Lamp icon="car" on={lamp} color={C.green} size={40} />
          <span style={{ fontFamily: sans, fontWeight: 600, fontSize: 26, color: C.dim }}>Monday to Saturday, 9 to 7</span>
        </div>
        <div style={{ height: 40 }} />
        <Words text="Clear vehicles. Clear terms. Real people." start={120} per={4} size={44} weight={700} em={["people."]} />
      </div>
      <Finish vignette={0.42} />
      <LoopFade />
    </AbsoluteFill>
  );
};

/* =====================================================================
   YOUR CUT: the tach redlines on the beat of the trailer's score,
   112 BPM, sixteen beats so the loop closes on itself.
   ===================================================================== */
export const CutTile: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const beat = (fps * 60) / 112;
  const into = (frame % beat) / beat;
  const kick = Math.exp(-into * 5.5);
  const rpm = 1.1 + 5.2 * kick + Math.sin(frame / 7) * 0.08;
  const third = durationInFrames / 3;
  const lines: [string, string[]][] = [["Thirty seconds.", []], ["Sound on.", ["on."]], ["Your cut.", ["cut."]]];
  return (
    <AbsoluteFill>
      <Cabin seamAt={0.9} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <Gauge size={640} min={0} max={8} value={rpm} major={1} minor={0.5} red={6.5} label="RPM x1000" />
      </AbsoluteFill>
      {lines.map(([t, em], i) => (
        <div key={t} style={{ position: "absolute", left: 0, right: 0, top: 86, display: "flex", justifyContent: "center" }}>
          <Words text={t} start={Math.round(i * third) + 2} size={96} em={em} exitAt={i < 2 ? Math.round((i + 1) * third) - 12 : durationInFrames + 20} />
        </div>
      ))}
      <Finish />
      <LoopFade inF={8} outF={8} />
    </AbsoluteFill>
  );
};

/* =====================================================================
   Share cards, 1200 x 630.
   ===================================================================== */
export const OgHome: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const courses = sweep(frame, fps, 0, 0, 20, 19), gpa = sweep(frame, fps, 0, 0, 4, 3.63);
  return (
    <AbsoluteFill>
      <Cabin seamAt={0.9} />
      <div style={{ position: "absolute", left: 60, top: 150 }}><Gauge size={330} min={0} max={20} value={courses} major={5} minor={1} label="Courses" readout="19" /></div>
      <div style={{ position: "absolute", right: 60, top: 150 }}><Gauge size={330} min={0} max={4} value={gpa} major={1} minor={0.25} label="GPA" readout="3.63" /></div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 30 }}>
        <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 58, letterSpacing: "-0.03em", color: C.text, textAlign: "center", lineHeight: 1.02 }}>Jason<br />Obawemimo</div>
        <div style={{ height: 18 }} />
        <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 22, color: C.dim, textAlign: "center", lineHeight: 1.35 }}>AI engineer and<br />business operator</div>
        <div style={{ height: 26 }} />
        <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 18, color: C.needle }}>jasonobawemimo.com</div>
      </AbsoluteFill>
      <Finish />
    </AbsoluteFill>
  );
};
