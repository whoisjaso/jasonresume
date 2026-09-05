import { continueRender, delayRender, staticFile } from "remotion";
if (typeof window !== "undefined" && typeof document !== "undefined") {
  const h = delayRender("fonts");
  const faces = [
    new FontFace("Cormorant Garamond", `url(${staticFile("fonts/CormorantGaramond-500-normal.ttf")})`, { weight: "500", style: "normal" }),
    new FontFace("Cormorant Garamond", `url(${staticFile("fonts/CormorantGaramond-500-italic.ttf")})`, { weight: "500", style: "italic" }),
    new FontFace("Hanken Grotesk", `url(${staticFile("fonts/HankenGrotesk-500-normal.ttf")})`, { weight: "500", style: "normal" }),
  ];
  Promise.all(faces.map((f) => f.load())).then((loaded) => { loaded.forEach((f) => document.fonts.add(f)); continueRender(h); }).catch(() => continueRender(h));
}
