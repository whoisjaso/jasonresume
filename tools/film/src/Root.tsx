import React from "react";
import { Composition } from "remotion";
import "./fonts";
import { Signature } from "./Signature";
import { Screen } from "./Screen";
import { Vsl } from "./Vsl";
import { LINES, LEAD_IN, TAIL } from "./vsl-data";
import { RecordReel, ObaviaFilm, LotFilm, CutTile, OgHome, DeskFilm } from "./dash/films";
import { LibraryTripleJ, LibraryLeadToTitle, LibraryTheInbound, LibraryProspector, LibraryNeuroscience, LibraryObavia } from "./library/plates";
import { LOOP } from "./library/theme";
import { AfterHours, AH_FRAMES, AH_FPS } from "./tour/AfterHours";

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
    {/* After Hours Library: living loops for the key art, 8 seconds, seamless, one light each */}
    <Composition id="LibraryTripleJ" component={LibraryTripleJ} durationInFrames={LOOP.frames} fps={LOOP.fps} width={LOOP.w} height={LOOP.h} />
    <Composition id="LibraryLeadToTitle" component={LibraryLeadToTitle} durationInFrames={LOOP.frames} fps={LOOP.fps} width={LOOP.w} height={LOOP.h} />
    <Composition id="LibraryTheInbound" component={LibraryTheInbound} durationInFrames={LOOP.frames} fps={LOOP.fps} width={LOOP.w} height={LOOP.h} />
    <Composition id="LibraryProspector" component={LibraryProspector} durationInFrames={LOOP.frames} fps={LOOP.fps} width={LOOP.w} height={LOOP.h} />
    <Composition id="LibraryNeuroscience" component={LibraryNeuroscience} durationInFrames={LOOP.frames} fps={LOOP.fps} width={LOOP.w} height={LOOP.h} />
    <Composition id="LibraryObavia" component={LibraryObavia} durationInFrames={LOOP.frames} fps={LOOP.fps} width={LOOP.w} height={LOOP.h} />
    {/* the walkthrough, After Hours (render-tour.sh): 2.39:1 inside 16:9, and a tall cut composed for a phone */}
    <Composition id="AfterHours" component={AfterHours} durationInFrames={AH_FRAMES} fps={AH_FPS} width={1920} height={1080} defaultProps={{ tall: false }} />
    <Composition id="AfterHoursVertical" component={AfterHours} durationInFrames={AH_FRAMES} fps={AH_FPS} width={1080} height={1920} defaultProps={{ tall: true }} />
  </>
);
