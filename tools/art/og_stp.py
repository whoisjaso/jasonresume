"""The share image for /stp: assets/stp/og-stp.jpg, 1200 by 630.

Drawn in code, no generated art: ink ground, the STP monogram in a hairline
box, STOP THINKING POOR in tracked Cormorant capitals, the slogan, and one
signal-red rule. The provenance goes in through the impeccable skill's
embed-prompt.mjs when it is found (EMBED_PROMPT or ~/.claude/skills), and
always as a plain JPEG comment.

    python3 tools/art/og_stp.py
"""
import glob
import os
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FONTS = ROOT / "assets" / "fonts"
OUT = ROOT / "assets" / "stp" / "og-stp.jpg"

INK = (11, 11, 10)
BONE = (237, 231, 219)
BONE_2 = (207, 201, 189)
ASH = (154, 152, 144)
LINE = (52, 51, 47)
SIGNAL = (200, 68, 43)
W, H, S = 1200, 630, 2  # drawn at 2x, then reduced for clean edges

PROVENANCE = (
    "Drawn in code by tools/art/og_stp.py (Pillow), no generative model. "
    "Share image for jasonobawemimo.com/stp: ink #0B0B0A ground, STP monogram in a hairline box, "
    "STOP THINKING POOR in tracked Cormorant Garamond SemiBold capitals, the slogan "
    "'No caption, just action.' and a signal rule #C8442B. Fonts: Cormorant Garamond and "
    "Hanken Grotesk, SIL Open Font License (assets/fonts)."
)


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size * S)


def tracked(draw, xy, text, f, fill, track):
    """Draw text with letter spacing (track in em of the font size)."""
    x, y = xy
    size = f.size
    for ch in text:
        draw.text((x, y), ch, font=f, fill=fill)
        x += draw.textlength(ch, font=f) + track * size
    return x


def tracked_width(draw, text, f, track):
    return sum(draw.textlength(ch, font=f) for ch in text) + track * f.size * (len(text) - 1)


def main():
    img = Image.new("RGB", (W * S, H * S), INK)
    d = ImageDraw.Draw(img)
    serif = "CormorantGaramond-SemiBold.woff2"
    sans = "HankenGrotesk-Regular.woff2"
    pad = 84 * S

    # A faint oversized monogram, bottom right, for depth
    big = font(serif, 400)
    ghost = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(ghost)
    gw = gd.textlength("STP", font=big)
    gd.text((W * S - gw + 20 * S, H * S - 330 * S), "STP", font=big, fill=(237, 231, 219, 9))
    img.paste(ghost, (0, 0), ghost)

    # The monogram box
    mono = font(serif, 30)
    mw = tracked_width(d, "STP", mono, 0.14)
    bx, by, bh = pad, pad, 62 * S
    bw = int(mw + 40 * S)
    d.rectangle([bx, by, bx + bw, by + bh], outline=(90, 88, 82), width=2 * S)
    asc, desc = mono.getmetrics()
    ty = by + (bh - (asc + desc)) // 2 + 2 * S
    tracked(d, (bx + (bw - mw) / 2, ty), "STP", mono, BONE, 0.14)

    # The word mark
    word = font(serif, 26)
    wy = by + (bh - sum(word.getmetrics())) // 2 + 2 * S
    tracked(d, (bx + bw + 28 * S, wy), "STOP THINKING POOR", word, BONE, 0.34)

    # The slogan
    slog = font(serif, 104)
    y1 = 214 * S
    d.text((pad, y1), "No caption,", font=slog, fill=BONE)
    d.text((pad, y1 + 104 * S), "just action.", font=slog, fill=BONE)

    # The rule and the byline
    ry = H * S - pad - 6 * S
    d.rectangle([pad, ry - 46 * S, pad + 56 * S, ry - 44 * S], fill=SIGNAL)
    by_f = font(sans, 22)
    tracked(d, (pad, ry - 26 * S), "A MENTORSHIP BY JASON OBAWEMIMO", by_f, ASH, 0.16)

    out = img.resize((W, H), Image.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT, "JPEG", quality=90, optimize=True, progressive=True, comment=PROVENANCE.encode("utf-8"))
    print("wrote", OUT.relative_to(ROOT), out.size)
    script = os.environ.get("EMBED_PROMPT") or next(iter(sorted(glob.glob(os.path.expanduser("~/.claude/skills/**/embed-prompt.mjs"), recursive=True))), None)
    if script:
        subprocess.run(["node", script, str(OUT), "--prompt", PROVENANCE], check=True)
    else:
        print("embed-prompt.mjs not found; the JPEG comment carries the provenance")


if __name__ == "__main__":
    main()
