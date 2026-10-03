import React from "react";
import { Composition } from "remotion";
import "./fonts";
import { Signature } from "./Signature";
import { Screen } from "./Screen";
import { Vsl } from "./Vsl";
import { LINES, LEAD_IN, TAIL } from "./vsl-data";
import { RecordReel, ObaviaFilm, LotFilm, CutTile, OgHome, DeskFilm } from "./dash/films";

export const Root: React.FC = () => (
  <>
    <Composition id="Signature" component={Signature} durationInFrames={150} fps={30} width={1920} height={1080} defaultProps={{ portrait: false }} />
    <Composition id="SignaturePortrait" component={Signature} durationInFrames={150} fps={30} width={1080} height={1920} defaultProps={{ portrait: true }} />
    <Composition id="Vsl" component={Vsl} durationInFrames={LEAD_IN + TAIL + LINES.reduce((a, l) => a + l.frames, 0)} fps={30} width={1920} height={1080} />
    <Composition id="Screen" component={Screen} durationInFrames={360} fps={30} width={1600} height={1000} />
    {/* the dash: films for the redesigned site, 1600 x 900 loops plus share cards */}
    <Composition id="DashRecord" component={RecordReel} durationInFrames={300} fps={30} width={1600} height={900} />
    <Composition id="DashObavia" component={ObaviaFilm} durationInFrames={300} fps={30} width={1600} height={900} defaultProps={{ compact: false }} />
    <Composition id="DashLot" component={LotFilm} durationInFrames={300} fps={30} width={1600} height={900} />
    <Composition id="DashDesk" component={DeskFilm} durationInFrames={288} fps={30} width={1600} height={900} />
    <Composition id="DashCut" component={CutTile} durationInFrames={257} fps={30} width={1080} height={1080} />
    <Composition id="OgHome" component={OgHome} durationInFrames={90} fps={30} width={1200} height={630} />
    <Composition id="OgObavia" component={ObaviaFilm} durationInFrames={30} fps={30} width={1200} height={630} defaultProps={{ compact: true }} />
  </>
);
