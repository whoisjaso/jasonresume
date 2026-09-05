import React from "react";
import { Composition } from "remotion";
import "./fonts";
import { Signature } from "./Signature";
import { Screen } from "./Screen";
import { Vsl } from "./Vsl";
import { LINES, LEAD_IN, TAIL } from "./vsl-data";

export const Root: React.FC = () => (
  <>
    <Composition id="Signature" component={Signature} durationInFrames={150} fps={30} width={1920} height={1080} defaultProps={{ portrait: false }} />
    <Composition id="SignaturePortrait" component={Signature} durationInFrames={150} fps={30} width={1080} height={1920} defaultProps={{ portrait: true }} />
    <Composition id="Vsl" component={Vsl} durationInFrames={LEAD_IN + TAIL + LINES.reduce((a, l) => a + l.frames, 0)} fps={30} width={1920} height={1080} />
    <Composition id="Screen" component={Screen} durationInFrames={360} fps={30} width={1600} height={1000} />
  </>
);
