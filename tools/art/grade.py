#!/usr/bin/env python3
"""After Hours Library: the one shared grade for every key-art plate.

    python3 tools/art/grade.py <input.png> <id> [focus_x] --prompt "<exact generation prompt>"

Every plate goes through the same steps, so the set reads as one world:

1. Cover-crop the input to 16:9 (working width 1920 to 2560).
2. The look: a 65^3 3D LUT built from the art bible (see build_lut). Shadows
   fall to ink #0A0F0D through bottle green #1C3229, highlights warm toward
   bone #EDE7DB, a gentle filmic S in OKLab lightness, material colour kept
   (chroma scaled, never replaced), out-of-gamut colours pulled in by chroma
   rather than clipped. Float all the way; grain dithers the final 8 bits.
3. The left shade: the left of the frame falls toward ink in linear light.
   Strength starts at 0.70 and rises (to 0.90) until the text zone is calm;
   a soft-knee limiter then holds any leftover highlight in the text zone
   under a ceiling, so bone text keeps 4.5:1 against the brightest pixel.
4. Fine film grain, swinging about 3 percent at mid grey, from a fixed seed.
5. Export to assets/game/art/: <id>-1920.webp and .avif, <id>-1280.webp,
   <id>-m.webp (828x1104 portrait), <id>-tile-512.webp, <id>-tile-256.webp,
   and a 24px blurred placeholder in placeholders.json under <id>.
6. Measure the text zone (x 0 to 0.42, y 0.38 to 0.92) on the decoded
   16:9 files and report the max relative luminance and bone's contrast on it.
7. Record where the portrait crop sits in frames.json under <id>, with
   loop_x: the object-position that puts the 16:9 living loop over the same
   part of the lot as the portrait still on a phone (assemble_home.py writes
   it on the plate as --lx), so the still-to-loop dissolve holds its place.

The portrait and tile crops come from the graded frame without the left
shade: their type sits elsewhere. --tile-zoom crops the tile tighter than full
height (a fraction of the frame height, centred on --tile-x and --tile-y), for
a plate whose subject is small in a wide frame. Run with --cube <path> to
write the look as a .cube LUT for ffmpeg (lut3d) or a grading app.
"""

import argparse
import base64
import glob
import io
import json
import math
import os
import subprocess
import sys
import zlib
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter, features
from scipy.interpolate import PchipInterpolator

ROOT = Path(__file__).resolve().parents[2]
OUT_DEFAULT = ROOT / "assets" / "game" / "art"

# The palette, from the art bible.
INK = (10, 15, 13)
GREEN = (28, 50, 41)
BONE = (237, 231, 219)

# The look.
LUT_SIZE = 65
CONTRAST = 1.18        # logit-space slope through the pivot: gentle S
PIVOT = 0.565          # OKLab L of 18 percent grey
HI_WHITE = 0.35        # how far the white point sits past bone toward white (linear)

# The left shade and the text zone.
SHADE_FULL_TO = 0.30   # full shade from x 0 to here
SHADE_GONE_AT = 0.68   # and none from here on
SHADE_BASE = 0.70
SHADE_MAX = 0.90
ZONE = (0.0, 0.42, 0.38, 0.92)   # x0, x1, y0, y1 as fractions
ZONE_FEATHER = 0.06
MIN_CONTRAST = 4.5
MARGIN_CONTRAST = 4.6  # what the pre-encode frame has to hit, so encoding cannot push it under

WORK_MIN, WORK_MAX = 1920, 2560

# Phones: the still is the portrait crop at object-position STILL_POS, the
# living loop is the whole 16:9 frame; loop_x is measured at PHONE_ASPECT.
STILL_POS = 0.62       # game.css: .plate__img object-position on phones (--fx unset)
PHONE_ASPECT = 390 / 844
GRAIN_CLIP = 2.5       # sigma; bounded so a lone grain cannot spike the text zone


# ---------- colour maths ----------

def srgb_to_lin(v):
    v = np.asarray(v, dtype=np.float64)
    return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(v):
    v = np.clip(v, 0.0, None)
    return np.where(v <= 0.0031308, v * 12.92, 1.055 * np.power(v, 1 / 2.4) - 0.055)


def lin_to_oklab(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = np.cbrt(l), np.cbrt(m), np.cbrt(s)
    return np.stack([
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    ], axis=-1)


def oklab_to_lin(lab):
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    return np.stack([
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ], axis=-1)


def rel_lum(lin):
    return 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]


def lab_of(rgb8):
    return lin_to_oklab(srgb_to_lin(np.array(rgb8, dtype=np.float64) / 255.0))


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


INK_LIN = srgb_to_lin(np.array(INK) / 255.0)
BONE_Y = float(rel_lum(srgb_to_lin(np.array(BONE) / 255.0)))


def contrast_on(y):
    return (BONE_Y + 0.05) / (y + 0.05)


def ceiling_for(ratio):
    return (BONE_Y + 0.05) / ratio - 0.05


# ---------- the look ----------

def look(enc):
    """The bible as a function of one colour. enc: (..., 3) sRGB-encoded in 0..1."""
    lab = lin_to_oklab(srgb_to_lin(enc))
    L, ab = lab[..., 0], lab[..., 1:]

    ink, green, bone = lab_of(INK), lab_of(GREEN), lab_of(BONE)
    hi_lin = (1 - HI_WHITE) * srgb_to_lin(np.array(BONE) / 255.0) + HI_WHITE
    hi = lin_to_oklab(hi_lin)

    # Filmic S on lightness: a straight line in logit space through the pivot,
    # so the toe and the shoulder both roll off. Then black lands on ink and
    # white on the warm white point (scaled in linear light, a matte floor).
    Lc = np.clip(L, 1e-5, 1 - 1e-5)
    zp = math.log(PIVOT / (1 - PIVOT))
    y = 1 / (1 + np.exp(-(CONTRAST * (np.log(Lc / (1 - Lc)) - zp) + zp)))
    y_ink, y_hi = ink[0] ** 3, hi[0] ** 3
    Lo = np.cbrt(y_ink + (y_hi - y_ink) * y ** 3)

    # Chroma: keep the material's own colour, scaled down with the new
    # lightness (never up: the matte floor must not saturate the blacks),
    # a little quieter in deep shadow and at the shoulder.
    ratio = np.clip(Lo / np.maximum(L, 1e-4), 0.6, 1.0)
    sat = 0.94 - 0.12 * (1 - smoothstep(ink[0], 0.5, Lo)) - 0.06 * smoothstep(0.88, hi[0], Lo)
    ab_s = ab * (sat * ratio)[..., None]

    # The palette as a split tone along lightness: each colour is pulled part
    # of the way toward ink, then bottle green, near neutral through the mids,
    # then bone. Neutrals take the full pull; strong colours (brass, sodium,
    # skin, wood) keep most of their own hue.
    nodes_L = [ink[0], green[0], 0.52, 0.66, bone[0], hi[0]]
    target = np.array([ink[1:], green[1:], green[1:] * 0.35, bone[1:] * 0.35, bone[1:], hi[1:]])
    pull = np.array([1.0, 0.9, 0.35, 0.3, 0.8, 0.9])
    Lq = np.clip(Lo, ink[0], hi[0])
    T = PchipInterpolator(nodes_L, target, axis=0)(Lq)
    k = PchipInterpolator(nodes_L, pull)(Lq)
    rel_chroma = np.hypot(ab[..., 0], ab[..., 1]) / np.maximum(L, 0.05)
    k = k * (1 - 0.8 * smoothstep(0.03, 0.18, rel_chroma))
    ab_out = ab_s + k[..., None] * (T - ab_s)

    # Gamut: if a colour falls outside sRGB, pull its chroma in (keep L and hue).
    def inside(f):
        lin = oklab_to_lin(np.concatenate([Lo[..., None], ab_out * f[..., None]], axis=-1))
        return np.all((lin >= -1e-6) & (lin <= 1 + 1e-6), axis=-1)

    lo = np.zeros(Lo.shape)
    hi_f = np.ones(Lo.shape)
    ok = inside(hi_f)
    for _ in range(18):
        mid = (lo + hi_f) / 2
        good = inside(mid)
        lo = np.where(good, mid, lo)
        hi_f = np.where(good, hi_f, mid)
    f = np.where(ok, 1.0, lo)
    lin = oklab_to_lin(np.concatenate([Lo[..., None], ab_out * f[..., None]], axis=-1))
    return lin_to_srgb(np.clip(lin, 0, 1))


def build_lut(n=LUT_SIZE):
    g = np.linspace(0.0, 1.0, n)
    r, gg, b = np.meshgrid(g, g, g, indexing="ij")
    return look(np.stack([r, gg, b], axis=-1)).astype(np.float32)   # [r, g, b, 3]


def apply_lut(img, lut, chunk=1 << 20):
    n = lut.shape[0]
    flat = img.reshape(-1, 3)
    out = np.empty_like(flat, dtype=np.float32)
    for s in range(0, flat.shape[0], chunk):
        p = np.clip(flat[s:s + chunk], 0, 1) * (n - 1)
        i0 = np.minimum(np.floor(p).astype(np.int32), n - 2)
        f = (p - i0).astype(np.float32)
        acc = np.zeros((p.shape[0], 3), np.float32)
        for dr in (0, 1):
            wr = f[:, 0] if dr else 1 - f[:, 0]
            for dg in (0, 1):
                wg = f[:, 1] if dg else 1 - f[:, 1]
                for db in (0, 1):
                    wb = f[:, 2] if db else 1 - f[:, 2]
                    acc += (wr * wg * wb)[:, None] * lut[i0[:, 0] + dr, i0[:, 1] + dg, i0[:, 2] + db]
        out[s:s + chunk] = acc
    return out.reshape(img.shape)


def write_cube(path, lut):
    n = lut.shape[0]
    with open(path, "w") as fh:
        fh.write('TITLE "After Hours Library"\n')
        fh.write(f"LUT_3D_SIZE {n}\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n")
        for b in range(n):              # .cube: red varies fastest
            for g in range(n):
                for r in range(n):
                    v = lut[r, g, b]
                    fh.write(f"{v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n")


# ---------- the left shade and the text zone ----------

def shade_mask(w, h):
    x = (np.arange(w) + 0.5) / w
    t = np.clip((x - SHADE_FULL_TO) / (SHADE_GONE_AT - SHADE_FULL_TO), 0, 1)
    m = 1 - (t * t * t * (t * (t * 6 - 15) + 10))      # smootherstep
    return np.broadcast_to(m[None, :], (h, w)).astype(np.float32)


def zone_slices(h, w):
    x0, x1, y0, y1 = ZONE
    return slice(int(round(y0 * h)), int(round(y1 * h))), slice(int(round(x0 * w)), int(round(x1 * w)))


def zone_weight(w, h):
    x0, x1, y0, y1 = ZONE
    x = (np.arange(w) + 0.5) / w
    y = (np.arange(h) + 0.5) / h
    wx = 1 - smoothstep(x1, x1 + ZONE_FEATHER, x)
    wy = (1 - smoothstep(y1, y1 + ZONE_FEATHER, y)) * smoothstep(y0 - ZONE_FEATHER, y0, y)
    wy[(y >= y0) & (y <= y1)] = 1.0
    wx[x <= x1] = 1.0
    return (wy[:, None] * wx[None, :]).astype(np.float32)


def apply_shade(lin, mask, s):
    a = (s * mask)[..., None]
    return lin * (1 - a) + INK_LIN.astype(np.float32) * a


def limit(lin, weight, ceiling):
    """Soft-knee compression of luminance above 0.6 x ceiling, weighted to the zone."""
    Y = rel_lum(lin)
    knee = 0.6 * ceiling
    over = Y > knee
    Yc = np.where(over, knee + (ceiling - knee) * np.tanh((Y - knee) / (ceiling - knee)), Y)
    Yn = Y + (Yc - Y) * weight
    touched = float(np.mean((Yn < Y - 1e-6)[zone_slices(*Y.shape)]))
    return lin * (Yn / np.maximum(Y, 1e-8))[..., None], touched


LUM8 = srgb_to_lin(np.arange(256) / 255.0)


def zone_stats(img8):
    h, w = img8.shape[:2]
    z = img8[zone_slices(h, w)]
    Y = 0.2126 * LUM8[z[..., 0]] + 0.7152 * LUM8[z[..., 1]] + 0.0722 * LUM8[z[..., 2]]
    ymax = float(Y.max())
    return {"max_lum": round(ymax, 4), "p99_lum": round(float(np.percentile(Y, 99)), 4),
            "mean_lum": round(float(Y.mean()), 4), "bone_contrast": round(contrast_on(ymax), 2)}


# ---------- grain, resize, encode ----------

def grain_field(h, w, seed):
    rng = np.random.default_rng(seed)

    def fine(shape, sigma):
        n = rng.standard_normal(shape).astype(np.float32)
        n = cv2.GaussianBlur(n, (0, 0), sigma)
        return n / n.std()

    mono = fine((h, w), 0.6)
    chroma = np.stack([fine((h, w), 0.8) for _ in range(3)], axis=-1)
    return np.clip(mono[..., None] + 0.15 * chroma, -GRAIN_CLIP, GRAIN_CLIP)


def add_grain(enc, field, amount):
    # amount is the typical swing at mid grey: grains sit within +/- amount
    # there about 87 percent of the time (sigma = amount / 1.5). Film-like
    # response: full in the mids, about 0.4 in the deep shadows and at the top,
    # so the ink stays calm and the bone stays clean.
    v = np.clip(enc, 0, 1)
    resp = 0.35 + 0.65 * 4 * v * (1 - v)
    return np.clip(v + (amount / 1.5) * resp * field, 0, 1)


def to8(enc):
    return np.clip(np.rint(enc * 255.0), 0, 255).astype(np.uint8)


def resize(enc, w, h):
    src_h, src_w = enc.shape[:2]
    if (src_w, src_h) == (w, h):
        return enc.copy()
    interp = cv2.INTER_AREA if (w < src_w and h < src_h) else cv2.INTER_LANCZOS4
    return np.clip(cv2.resize(enc, (w, h), interpolation=interp), 0, 1)


def crop_window(W, H, aspect, focus_x):
    """Full-height window of width H*aspect centred on focus_x, kept inside the frame."""
    ww = min(W, int(round(H * aspect)))
    x0 = int(round(focus_x * W - ww / 2))
    return max(0, min(W - ww, x0)), ww


def square_window(W, H, zoom, cx, cy):
    """Square of side zoom*H centred on (cx, cy) as fractions, kept inside the frame."""
    side = min(W, H, int(round(zoom * H)))
    x0 = int(round(cx * W - side / 2))
    y0 = int(round(cy * H - side / 2))
    return max(0, min(W - side, x0)), max(0, min(H - side, y0)), side


def loop_x(W, H, x0, ww, aspect=PHONE_ASPECT, still=STILL_POS):
    """Object-position (percent) for the 16:9 loop that shows the same frame
    columns as the portrait still [x0, x0 + ww] does at `still`, on a screen of
    `aspect` (width over height) where both cover the full height."""
    vw = aspect * H                          # visible width, in frame pixels
    if vw >= ww:                             # the still is fitted by width: it shows the whole crop
        left = x0 + (ww - vw) / 2
    else:
        left = x0 + still * (ww - vw)
    if vw >= W:
        return 50.0
    return round(100 * min(1.0, max(0.0, left / (W - vw))), 1)


def webp_bytes(img8, q):
    buf = io.BytesIO()
    Image.fromarray(img8).save(buf, "WEBP", quality=int(q), method=6)
    return buf.getvalue()


def avif_bytes(img8, q):
    buf = io.BytesIO()
    Image.fromarray(img8).save(buf, "AVIF", quality=int(q), speed=4, subsampling="4:2:0")
    return buf.getvalue()


def tune(encode, img8, cap_bytes, lo, hi):
    """Highest integer quality in [lo, hi] whose file fits under cap_bytes."""
    best = None
    a, b = lo, hi
    while a <= b:
        q = (a + b) // 2
        data = encode(img8, q)
        if len(data) <= cap_bytes:
            best = (q, data)
            a = q + 1
        else:
            b = q - 1
    if best is None:
        best = (lo, encode(img8, lo))
    return best


def decode(data):
    return np.asarray(Image.open(io.BytesIO(data)).convert("RGB"))


def avif_ok():
    try:
        if not features.check("avif"):
            return False
        decode(avif_bytes(np.full((16, 16, 3), 40, np.uint8), 60))
        return True
    except Exception:
        return False


def find_embed(explicit):
    for cand in [explicit, os.environ.get("EMBED_PROMPT")]:
        if cand and Path(cand).is_file():
            return cand
    hits = sorted(glob.glob(str(Path.home() / ".claude/skills/**/impeccable/scripts/embed-prompt.mjs"), recursive=True))
    return hits[0] if hits else None


# ---------- the run ----------

def load(path):
    raw = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if raw is None:
        sys.exit(f"grade: cannot read {path}")
    scale = 65535.0 if raw.dtype == np.uint16 else 255.0
    img = raw.astype(np.float32) / scale
    if img.ndim == 2:
        img = np.repeat(img[..., None], 3, axis=-1)
    if img.shape[2] == 4:
        alpha = img[..., 3:4]
        img = img[..., :3] * alpha + (np.array(INK[::-1], np.float32) / 255.0) * (1 - alpha)
    return np.ascontiguousarray(img[..., :3][..., ::-1])   # BGR to RGB


def cover_16x9(img):
    h, w = img.shape[:2]
    if w * 9 > h * 16:
        nw = int(round(h * 16 / 9))
        x0 = (w - nw) // 2
        img = img[:, x0:x0 + nw]
    elif w * 9 < h * 16:
        nh = int(round(w * 9 / 16))
        y0 = (h - nh) // 2
        img = img[y0:y0 + nh]
    h, w = img.shape[:2]
    tw = min(max(w, WORK_MIN), WORK_MAX)
    th = int(round(tw * 9 / 16))
    return resize(img, tw, th), (w < WORK_MIN)


def main():
    ap = argparse.ArgumentParser(description="Grade an After Hours plate and export the web set.")
    ap.add_argument("input", nargs="?", help="source image (PNG, 8 or 16 bit; JPEG and WebP work too)")
    ap.add_argument("id", nargs="?", help="plate id, used in file names and placeholders.json")
    ap.add_argument("focus_x", nargs="?", type=float, default=0.62,
                    help="horizontal centre of the portrait and tile crops, 0 to 1 (default 0.62)")
    ap.add_argument("--prompt", help="exact generation prompt, embedded in every file written")
    ap.add_argument("--prompt-file", help="read the prompt from a file")
    ap.add_argument("--no-provenance", action="store_true", help="tests only: write files with no prompt")
    ap.add_argument("--out", default=str(OUT_DEFAULT), help="output folder (default assets/game/art)")
    ap.add_argument("--webp-kb", type=float, default=220, help="size cap for the 1920 WebP, KB (default 220)")
    ap.add_argument("--grain", type=float, default=0.03, help="grain swing at mid grey, fraction of full scale (default 0.03)")
    ap.add_argument("--seed", type=int, default=1979, help="base grain seed (default 1979)")
    ap.add_argument("--tile-zoom", type=float, default=1.0,
                    help="tile side as a fraction of the frame height (default 1.0: full height)")
    ap.add_argument("--tile-x", type=float, help="tile centre, 0 to 1 across (default: focus_x)")
    ap.add_argument("--tile-y", type=float, default=0.5, help="tile centre, 0 to 1 down (default 0.5)")
    ap.add_argument("--cube", help="also write the look as a .cube LUT here")
    ap.add_argument("--embed-script", help="path to embed-prompt.mjs (default: $EMBED_PROMPT or ~/.claude/skills)")
    a = ap.parse_args()

    log = lambda *m: print(*m, file=sys.stderr)
    lut = build_lut()
    if a.cube:
        write_cube(a.cube, lut)
        log(f"wrote {a.cube}")
    if not a.input:
        if not a.cube:
            ap.error("input and id are required")
        return
    if not a.id:
        ap.error("id is required")
    if not 0 <= a.focus_x <= 1:
        ap.error("focus_x must be between 0 and 1")
    if not 0.2 <= a.tile_zoom <= 1:
        ap.error("--tile-zoom must be between 0.2 and 1")
    tile_x = a.focus_x if a.tile_x is None else a.tile_x

    prompt = a.prompt
    if a.prompt_file:
        prompt = Path(a.prompt_file).read_text().strip()
    embed = None
    if prompt:
        embed = find_embed(a.embed_script)
        if not embed:
            sys.exit("grade: embed-prompt.mjs not found; pass --embed-script or set EMBED_PROMPT")
    elif not a.no_provenance:
        sys.exit("grade: every shipped raster carries its prompt: pass --prompt or --prompt-file "
                 "(or --no-provenance for a test run you will delete)")

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    warnings = []

    src = load(a.input)
    work, upscaled = cover_16x9(src)
    H, W = work.shape[:2]
    if upscaled:
        warnings.append(f"source is under {WORK_MIN}px wide after the 16:9 crop and was upscaled")
    log(f"{a.id}: working frame {W}x{H}")

    graded = apply_lut(work, lut)                    # encoded, the look applied
    lin = srgb_to_lin(graded).astype(np.float32)

    # Left shade: rise from the base strength only as far as the zone needs.
    mask = shade_mask(W, H)
    zs = zone_slices(H, W)
    calm = 0.55 * ceiling_for(MARGIN_CONTRAST)

    def zone_p995(s):
        return float(np.percentile(rel_lum(apply_shade(lin[zs], mask[zs], s)), 99.5))

    s = SHADE_BASE
    if zone_p995(s) > calm:
        lo_s, hi_s = SHADE_BASE, SHADE_MAX
        for _ in range(12):
            mid = (lo_s + hi_s) / 2
            lo_s, hi_s = (lo_s, mid) if zone_p995(mid) <= calm else (mid, hi_s)
        s = hi_s
    shaded = apply_shade(lin, mask, s)
    weight = zone_weight(W, H)

    sid = (a.seed + zlib.crc32(a.id.encode())) & 0xFFFFFFFF
    g1920 = grain_field(1080, 1920, sid)
    g1280 = grain_field(720, 1280, sid + 1)

    # Limiter: tighten the ceiling until the brightest grained pixel in the
    # zone still leaves bone at the margin ratio, in both 16:9 sizes.
    ceiling = ceiling_for(MARGIN_CONTRAST)
    for attempt in range(4):
        for _ in range(16):
            limited, touched = limit(shaded, weight, ceiling)
            hero = lin_to_srgb(limited).astype(np.float32)
            h1920 = to8(add_grain(resize(hero, 1920, 1080), g1920, a.grain))
            h1280 = to8(add_grain(resize(hero, 1280, 720), g1280, a.grain))
            worst = max(zone_stats(h1920)["max_lum"], zone_stats(h1280)["max_lum"])
            if contrast_on(worst) >= MARGIN_CONTRAST:
                break
            ceiling *= max(0.6, min(0.95, ceiling_for(MARGIN_CONTRAST) / worst))
        else:
            warnings.append("text zone did not reach the margin ratio before encoding")

        webp_q, webp1920 = tune(webp_bytes, h1920, a.webp_kb * 1024, 40, 95)
        webp1280 = webp_bytes(h1280, webp_q)
        files = {f"{a.id}-1920.webp": webp1920, f"{a.id}-1280.webp": webp1280}
        avif_q = None
        if avif_ok():
            avif_q, avif1920 = tune(avif_bytes, h1920, int(len(webp1920) * 0.8), 30, 90)
            files[f"{a.id}-1920.avif"] = avif1920
        measured = {name: zone_stats(decode(data)) for name, data in files.items()}
        if min(m["bone_contrast"] for m in measured.values()) >= MIN_CONTRAST:
            break
        ceiling *= 0.9
    else:
        warnings.append("text zone below 4.5:1 after encoding; recompose the plate")

    if not avif_q:
        warnings.append("no working AVIF encoder: AVIF skipped")
    if touched > 0.002:
        warnings.append(f"limiter held {touched * 100:.1f}% of the text zone: the subject is "
                        "crowding the type side; the plate wants recomposing")
    kb = len(webp1920) / 1024
    if not 150 <= kb <= 250:
        warnings.append(f"1920 WebP is {kb:.0f}KB, outside 150 to 250KB")

    # Crops come from the graded frame without the left shade.
    base = graded
    x0, ww = crop_window(W, H, 828 / 1104, a.focus_x)
    mob = to8(add_grain(resize(base[:, x0:x0 + ww], 828, 1104), grain_field(1104, 828, sid + 2), a.grain))
    files[f"{a.id}-m.webp"] = webp_bytes(mob, webp_q)
    tx0, ty0, tw = square_window(W, H, a.tile_zoom, tile_x, a.tile_y)
    tile = base[ty0:ty0 + tw, tx0:tx0 + tw]
    for side in (512, 256):
        t8 = to8(add_grain(resize(tile, side, side), grain_field(side, side, sid + side), a.grain))
        files[f"{a.id}-tile-{side}.webp"] = webp_bytes(t8, max(webp_q, 78))

    # Mobile type usually sits low: report the bottom band so the page knows
    # whether it needs its own shade there.
    mh = mob.shape[0]
    band = mob[int(0.62 * mh):int(0.96 * mh)]
    band_y = float((0.2126 * LUM8[band[..., 0]] + 0.7152 * LUM8[band[..., 1]] + 0.0722 * LUM8[band[..., 2]]).max())

    written = []
    for name, data in files.items():
        p = out / name
        p.write_bytes(data)
        written.append(p)

    # Placeholder: 24px wide, softened, as a data URI.
    ph = Image.fromarray(to8(resize(lin_to_srgb(shaded).astype(np.float32), 24, 14)))
    ph = ph.filter(ImageFilter.GaussianBlur(0.8))
    buf = io.BytesIO()
    ph.save(buf, "WEBP", quality=50, method=6)
    uri = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
    pj = out / "placeholders.json"
    data = json.loads(pj.read_text()) if pj.exists() else {}
    data["_about"] = ("24px wide blurred previews of the graded After Hours plates, "
                      "made by tools/art/grade.py from each plate's 16:9 frame")
    data[a.id] = uri
    pj.write_text(json.dumps(dict(sorted(data.items())), indent=2) + "\n")

    # Where the portrait crop sits, and the loop position that matches it on a phone.
    lx = loop_x(W, H, x0, ww)
    fj = out / "frames.json"
    frames = json.loads(fj.read_text()) if fj.exists() else {}
    frames["_about"] = ("Where each graded plate's portrait crop sits in its 16:9 frame, written by "
                        "tools/art/grade.py. loop_x is the object-position, in percent, that puts the "
                        "16:9 living loop over the same part of the frame as the portrait still on a "
                        "phone (390 by 844, the still at 62 percent); tools/site/assemble_home.py writes "
                        "it on each plate as --lx.")
    frames[a.id] = {"focus_x": a.focus_x, "portrait_x": [round(x0 / W, 4), round(ww / W, 4)], "loop_x": lx}
    fj.write_text(json.dumps(dict(sorted(frames.items())), indent=2) + "\n")

    if embed:
        for p in written:
            subprocess.run(["node", embed, str(p), "--prompt", prompt], check=True,
                           stdout=subprocess.DEVNULL)

    report = {
        "id": a.id,
        "source": f"{src.shape[1]}x{src.shape[0]}",
        "working": f"{W}x{H}",
        "focus_x": a.focus_x,
        "crop_windows": {"portrait": [x0, 0, ww, H], "tile": [tx0, ty0, tw, tw]},
        "loop_x_phone": lx,
        "shade_strength": round(s, 3),
        "limiter_ceiling_lum": round(float(ceiling), 4),
        "limiter_touched_pct": round(touched * 100, 3),
        "text_zone": {"x": [ZONE[0], ZONE[1]], "y": [ZONE[2], ZONE[3]], "bone_lum": round(BONE_Y, 4),
                      "need_max_lum": round(ceiling_for(MIN_CONTRAST), 4), "measured": measured},
        "text_zone_pass": min(m["bone_contrast"] for m in measured.values()) >= MIN_CONTRAST,
        "mobile_bottom_band": {"max_lum": round(band_y, 4), "bone_contrast": round(contrast_on(band_y), 2)},
        "webp_quality": webp_q,
        "avif_quality": avif_q,
        "files": {p.name: f"{p.stat().st_size / 1024:.1f}KB" for p in written},
        "placeholder_bytes": len(uri),
        "grain": {"amount": a.grain, "seed": sid},
        "provenance": "embedded" if embed else "none (test run)",
        "warnings": warnings,
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
