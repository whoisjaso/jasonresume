import React from "react";
import { Composition } from "remotion";
import "./fonts";
import { ObaviaFilm } from "./dash/films";
import { LibraryTripleJ, LibraryLeadToTitle, LibraryTheInbound, LibraryProspector, LibraryNeuroscience, LibraryObavia } from "./library/plates";
import { LOOP } from "./library/theme";

export const Root: React.FC = () => (
  <>
    {/* Obavia's share card, assets/og-obavia.jpg (render-og-obavia.sh) */}
    <Composition id="OgObavia" component={ObaviaFilm} durationInFrames={30} fps={30} width={1200} height={630} defaultProps={{ compact: true }} />
    {/* After Hours Library: living loops for the key art, 8 seconds, seamless, one light each */}
    <Composition id="LibraryTripleJ" component={LibraryTripleJ} durationInFrames={LOOP.frames} fps={LOOP.fps} width={LOOP.w} height={LOOP.h} />
    <Composition id="LibraryLeadToTitle" component={LibraryLeadToTitle} durationInFrames={LOOP.frames} fps={LOOP.fps} width={LOOP.w} height={LOOP.h} />
    <Composition id="LibraryTheInbound" component={LibraryTheInbound} durationInFrames={LOOP.frames} fps={LOOP.fps} width={LOOP.w} height={LOOP.h} />
    <Composition id="LibraryProspector" component={LibraryProspector} durationInFrames={LOOP.frames} fps={LOOP.fps} width={LOOP.w} height={LOOP.h} />
    <Composition id="LibraryNeuroscience" component={LibraryNeuroscience} durationInFrames={LOOP.frames} fps={LOOP.fps} width={LOOP.w} height={LOOP.h} />
    <Composition id="LibraryObavia" component={LibraryObavia} durationInFrames={LOOP.frames} fps={LOOP.fps} width={LOOP.w} height={LOOP.h} />
  </>
);
