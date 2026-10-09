"""Cut the static resume fonts in assets/fonts from the variable OFL sources.

Chromium writes a variable font into a PDF as Type 3 (drawn glyphs that some
resume parsers cannot read back), so the resume pages use static instances.

Usage (sources from github.com/google/fonts, ofl/hankengrotesk and
ofl/cormorantgaramond):

  python3 tools/fonts/cut_static.py HankenGrotesk[wght].ttf CormorantGaramond[wght].ttf

Writes HankenGrotesk-Regular.woff2 (400), HankenGrotesk-SemiBold.woff2 (600)
and CormorantGaramond-SemiBold.woff2 (600), each pinned to one weight with no
fvar or gvar left, and subset to Latin. Copy each family's OFL.txt next to them.
"""
import sys
from pathlib import Path

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

OUT = Path(__file__).resolve().parents[2] / "assets" / "fonts"

# Basic Latin, Latin-1, general punctuation, the euro and the bullet.
UNICODES = list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + list(range(0x2010, 0x2027)) + [0x2030, 0x2039, 0x203A, 0x20AC, 0x2122]

CUTS = [
    ("HankenGrotesk", 400, "HankenGrotesk-Regular", "Hanken Grotesk", "Regular"),
    ("HankenGrotesk", 600, "HankenGrotesk-SemiBold", "Hanken Grotesk SemiBold", "Regular"),
    ("CormorantGaramond", 600, "CormorantGaramond-SemiBold", "Cormorant Garamond SemiBold", "Regular"),
]


def name_font(font, family, sub, ps):
    name = font["name"]
    for rec in list(name.names):
        if rec.nameID in (1, 2, 3, 4, 6, 16, 17, 25):
            name.removeNames(nameID=rec.nameID)
    full = family if sub == "Regular" else family + " " + sub
    for nid, val in ((1, family), (2, sub), (3, ps + ";static"), (4, full), (6, ps)):
        name.setName(val, nid, 3, 1, 0x409)


def cut(src, weight, ps, family, sub):
    font = TTFont(src)
    static = instancer.instantiateVariableFont(font, {"wght": weight}, updateFontNames=False)
    for tag in ("STAT", "fvar", "gvar", "avar", "HVAR", "MVAR", "cvar"):
        if tag in static:
            del static[tag]
    static["OS/2"].usWeightClass = weight
    name_font(static, family, sub, ps)
    opts = Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern", "mark", "mkmk", "case", "lnum", "tnum", "pnum", "onum"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    sub_ = Subsetter(options=opts)
    sub_.populate(unicodes=UNICODES)
    sub_.subset(static)
    static.flavor = "woff2"
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / (ps + ".woff2")
    static.save(out)
    print("wrote", out.relative_to(OUT.parents[1]), out.stat().st_size, "bytes")


def main(argv):
    srcs = {}
    for p in argv:
        key = "HankenGrotesk" if "hanken" in p.lower() else "CormorantGaramond" if "cormorant" in p.lower() else None
        if key:
            srcs[key] = p
    for fam, weight, ps, family, sub in CUTS:
        if fam not in srcs:
            sys.exit("missing source for " + fam)
        cut(srcs[fam], weight, ps, family, sub)


if __name__ == "__main__":
    main(sys.argv[1:])
