#!/usr/bin/env python3
"""The trophy medallions for the After Hours Library.

One generated nickel-silver medal (tools/art/candidates/medal-base.png) is cut
from its black ground, warped to a true circle, engraved with each medal's
glyph as a recessed V cut lit from the upper left, and struck in its tier's
metal. Writes, into assets/game/medals:

    <slug>-160.webp, <slug>-80.webp      the 18 trophies and the 16 proof medals, transparent, square
    <tier>-blank-160.webp                 bronze, silver, gold, platinum with an empty field
    sheen.webp                            160x160 diagonal specular streak swept over a medal on unlock

and contact sheets in tools/art/candidates: medals-contact.png (the 18
trophies at 80 and 40 pixels on ink, plus the blanks) and
medals-contact-proofs.png (all 34 at 80 and 40 pixels on ink). Every shipped
raster gets its prompt through the impeccable skill's embed-prompt.mjs (WebP
takes a .json sidecar).

The proof medals are the visitor's build card, not trophies. Strike them, or
any named medals, without touching the rest:

    python3 tools/art/medals.py                          # everything
    python3 tools/art/medals.py --proofs                 # the 16 proof medals only
    python3 tools/art/medals.py --only crew,payroll      # named medals only
    python3 tools/art/medals.py --trophies               # the 18 trophies only
    python3 tools/art/medals.py --no-provenance          # a test run you will delete

A partial run writes only the named medals and their sidecars (plus the proofs
contact sheet when it strikes a proof medal); the blanks, the sheen and the
trophy contact sheet come only from a full run.

The glyphs are the SVGs in assets/game/medals/glyphs (tools/art/medal_glyphs.py
writes them); this script reads them back, so an edited SVG is what ships.
Needs numpy, scipy, opencv-python-headless and Pillow.
"""
import argparse
import glob
import math
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
BASE = os.path.join(HERE, "candidates", "medal-base.png")
BASE_PROMPT = os.path.join(HERE, "candidates", "medal-base.prompt.txt")
OUT = os.path.join(ROOT, "assets", "game", "medals")
GLYPHS = os.path.join(OUT, "glyphs")
SHEET = os.path.join(HERE, "candidates", "medals-contact.png")
PROOF_SHEET = os.path.join(HERE, "candidates", "medals-contact-proofs.png")

TROPHIES = [
    ("fifty-three", "gold"), ("proceeds", "gold"), ("keys-to-the-lot", "silver"), ("title-run", "bronze"),
    ("daily-driver", "gold"), ("locked-rows", "silver"), ("clean-books", "silver"), ("nothing-lost", "bronze"),
    ("booked", "gold"), ("matched", "gold"), ("hand-off", "silver"), ("field-notes", "silver"),
    ("by-the-book", "bronze"), ("deans-list", "gold"), ("associate", "silver"), ("nineteen", "silver"),
    ("essentials", "bronze"), ("operator", "platinum"),
]

# the proof medals for the visitor's build card (glyphs in medal_glyphs.PROOFS)
PROOFS = [
    ("crew", "silver"), ("payroll", "silver"), ("help-desk", "silver"), ("access", "silver"), ("network", "silver"),
    ("built-not-bought", "silver"), ("on-the-line", "silver"), ("handshake", "silver"), ("filed", "silver"),
    ("deal-jacket", "silver"), ("in-order", "silver"), ("collections", "silver"), ("data-model", "silver"),
    ("shipped", "silver"), ("every-form", "silver"), ("neuron", "bronze"),
]

S = 960            # working square, pixels
R_DISC = 0.492 * S  # the medal's outer radius in the working square
GLYPH_FRAC = 0.58  # the glyph's 48 unit grid as a fraction of the medal's diameter
LIGHT = np.array([-1.0, -1.0, 1.25]) / np.linalg.norm([-1.0, -1.0, 1.25])  # from the upper left, about 41 degrees up

INK = (10, 15, 13)
BONE = (237, 231, 219)


# ---------- colour ----------

def hex_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64) / 255.0


def srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, None)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def to_oklab(rgb):
    l = srgb_to_lin(rgb)
    m1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929],
                   [0.2119034982, 0.6806995451, 0.1073969566],
                   [0.0883024619, 0.2817188376, 0.6299787005]])
    m2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468],
                   [1.9779984951, -2.4285922050, 0.4505937099],
                   [0.0259040371, 0.7827717662, -0.8086757660]])
    return np.cbrt(l @ m1.T) @ m2.T


def from_oklab(lab):
    m2i = np.array([[1.0, 0.3963377774, 0.2158037573],
                    [1.0, -0.1055613458, -0.0638541728],
                    [1.0, -0.0894841775, -1.2914855480]])
    m1i = np.array([[4.0767416621, -3.3077115913, 0.2309699292],
                    [-1.2684380046, 2.6097574011, -0.3413193965],
                    [-0.0041960863, -0.7034186147, 1.7076147010]])
    lms = (lab @ m2i.T) ** 3
    return np.clip(lin_to_srgb(lms @ m1i.T), 0, 1)


def ramp(stops, n=1024):
    """A gradient map: luminance 0..1 to colour, interpolated in OKLab."""
    pos = np.array([p for p, _ in stops])
    lab = to_oklab(np.array([hex_rgb(c) for _, c in stops]))
    x = np.linspace(0, 1, n)
    return from_oklab(np.stack([np.interp(x, pos, lab[:, i]) for i in range(3)], -1))


# Each tier: a gradient map whose base colour sits on the field's median tone,
# its own tone curve, and its own finish. Bronze is antiqued (darker, harder,
# its recesses deepened); silver is neutral and bright; gold is a pale satin
# (soft highlights, a broad low sheen, cream at the top, never lemon);
# platinum is the coolest and the brightest, crisp, with a narrow polished streak.
TIERS = {
    "bronze": dict(stops=[(0.0, "#120904"), (0.24, "#3E2312"), (0.46, "#6E4828"), ("m", "#9C6B43"),
                          (0.84, "#C48D5E"), (0.94, "#E6B98E"), (1.0, "#F8DDBE")],
                   contrast=1.18, gamma=1.08, antique=0.32, satin=0.0, sheen=(0.05, 0.30), crisp=0.0),
    "silver": dict(stops=[(0.0, "#0F1011"), (0.24, "#383A3C"), (0.46, "#76797B"), ("m", "#B9BCBE"),
                          (0.84, "#D7D8D8"), (0.94, "#EDEDEC"), (1.0, "#FDFDFB")],
                   contrast=1.12, gamma=1.04, antique=0.12, satin=0.0, sheen=(0.06, 0.24), crisp=0.12),
    "gold": dict(stops=[(0.0, "#171108"), (0.24, "#45361D"), (0.46, "#866C41"), ("m", "#C9A96A"),
                        (0.84, "#DCC796"), (0.94, "#ECDFC0"), (1.0, "#F9F2E3")],
                 contrast=0.94, gamma=0.98, antique=0.0, satin=0.45, sheen=(0.10, 0.42), crisp=0.0),
    "platinum": dict(stops=[(0.0, "#161B24"), (0.24, "#48526A"), (0.46, "#949CAD"), ("m", "#DCDDE0"),
                            (0.84, "#EAEEF5"), (0.94, "#F4F7FC"), (1.0, "#FFFFFF")],
                     contrast=0.98, gamma=0.80, antique=0.0, satin=0.0, sheen=(0.16, 0.14), crisp=0.30),
}


# ---------- the base ----------

def load_base():
    """Cut the medal from black, warp its slight ellipse to a circle, centre it in the working square."""
    im = np.asarray(Image.open(BASE).convert("RGB")).astype(np.float64) / 255.0
    lum = im @ np.array([0.2126, 0.7152, 0.0722])
    m = (lum > 0.12).astype(np.uint8)
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cnts, key=cv2.contourArea)
    (ex, ey), (ew, eh), ang = cv2.fitEllipse(c)
    a, b = ew / 2, eh / 2
    t = math.radians(ang)
    rot = np.array([[math.cos(t), -math.sin(t)], [math.sin(t), math.cos(t)]])
    sc = np.diag([R_DISC / a, R_DISC / b])
    A = rot @ sc @ rot.T
    off = np.array([S / 2, S / 2]) - A @ np.array([ex, ey])
    M = np.hstack([A, off[:, None]])
    warped = cv2.warpAffine(im.astype(np.float32), M.astype(np.float32), (S, S), flags=cv2.INTER_CUBIC, borderValue=0)
    warped = np.clip(warped, 0, 1).astype(np.float64)
    y = warped @ np.array([0.2126, 0.7152, 0.0722])

    yy, xx = np.mgrid[0:S, 0:S]
    rr = np.hypot(xx + 0.5 - S / 2, yy + 0.5 - S / 2)
    # the silhouette: the last radius where the beads still catch light, feathered a pixel
    edge = None
    for r in np.arange(R_DISC + 12, R_DISC - 20, -0.5):
        ring = (rr >= r) & (rr < r + 1)
        if np.percentile(y[ring], 90) > 0.35:
            edge = r
            break
    alpha = np.clip(edge + 0.5 - rr, 0, 1)
    # the flat centre field: the radius where the bevel's dark line starts
    prof = [y[(rr >= r) & (rr < r + 2)].mean() for r in range(int(R_DISC * 0.6), int(R_DISC * 0.85), 2)]
    rs = list(range(int(R_DISC * 0.6), int(R_DISC * 0.85), 2))
    base = np.mean(prof[:6])
    field_r = next(r for r, p in zip(rs, prof) if p < base - 0.04)
    return y, alpha, rr, edge, field_r


# ---------- glyphs: read the SVG back ----------

TOK = re.compile(r"[MLHVCQAZmlhvcqaz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?")


def arc_points(p0, rx, ry, phi, large, sweep, p1, step):
    """SVG endpoint arc to points (the spec's F.6.5 conversion)."""
    if rx == 0 or ry == 0:
        return [p1]
    c, s = math.cos(math.radians(phi)), math.sin(math.radians(phi))
    dx, dy = (p0[0] - p1[0]) / 2, (p0[1] - p1[1]) / 2
    x1, y1 = c * dx + s * dy, -s * dx + c * dy
    lam = x1 ** 2 / rx ** 2 + y1 ** 2 / ry ** 2
    if lam > 1:
        rx, ry = rx * math.sqrt(lam), ry * math.sqrt(lam)
    num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
    den = rx * rx * y1 * y1 + ry * ry * x1 * x1
    k = math.sqrt(max(0, num / den)) * (-1 if large == sweep else 1)
    cx1, cy1 = k * rx * y1 / ry, -k * ry * x1 / rx
    cx = c * cx1 - s * cy1 + (p0[0] + p1[0]) / 2
    cy = s * cx1 + c * cy1 + (p0[1] + p1[1]) / 2

    def ang(u, v):
        a = math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])
        return a

    t1 = ang((1, 0), ((x1 - cx1) / rx, (y1 - cy1) / ry))
    dt = ang(((x1 - cx1) / rx, (y1 - cy1) / ry), ((-x1 - cx1) / rx, (-y1 - cy1) / ry))
    if not sweep and dt > 0:
        dt -= 2 * math.pi
    elif sweep and dt < 0:
        dt += 2 * math.pi
    n = max(2, int(abs(dt) * max(rx, ry) / step) + 1)
    pts = []
    for i in range(1, n + 1):
        t = t1 + dt * i / n
        x, y = rx * math.cos(t), ry * math.sin(t)
        pts.append((c * x - s * y + cx, s * x + c * y + cy))
    return pts


def path_polylines(d, step=0.2):
    toks = TOK.findall(d)
    i, cur, start, cmd = 0, (0.0, 0.0), (0.0, 0.0), None
    lines, pts = [], []

    def num():
        nonlocal i
        v = float(toks[i])
        i += 1
        return v

    while i < len(toks):
        if re.match(r"[A-Za-z]", toks[i]):
            cmd = toks[i]
            i += 1
        rel = cmd.islower()
        C = cmd.upper()
        ox, oy = cur if rel else (0.0, 0.0)
        if C == "M":
            if len(pts) > 1:
                lines.append(pts)
            cur = (num() + ox, num() + oy)
            start = cur
            pts = [cur]
            cmd = "l" if rel else "L"
        elif C == "L":
            cur = (num() + ox, num() + oy)
            pts.append(cur)
        elif C == "H":
            cur = (num() + ox, cur[1])
            pts.append(cur)
        elif C == "V":
            cur = (cur[0], num() + oy)
            pts.append(cur)
        elif C in "CQ":
            k = 3 if C == "C" else 2
            ctrl = [(num() + ox, num() + oy) for _ in range(k)]
            P = [cur] + ctrl
            if C == "Q":
                P = [P[0], (P[0][0] + 2 / 3 * (P[1][0] - P[0][0]), P[0][1] + 2 / 3 * (P[1][1] - P[0][1])),
                     (P[2][0] + 2 / 3 * (P[1][0] - P[2][0]), P[2][1] + 2 / 3 * (P[1][1] - P[2][1])), P[2]]
            L = sum(math.dist(P[j], P[j + 1]) for j in range(3))
            n = max(4, int(L / step) + 1)
            for j in range(1, n + 1):
                t = j / n
                u = 1 - t
                pts.append(tuple(u ** 3 * P[0][q] + 3 * u * u * t * P[1][q] + 3 * u * t * t * P[2][q] + t ** 3 * P[3][q] for q in (0, 1)))
            cur = P[3]
        elif C == "A":
            rx, ry, phi, large, sweep = num(), num(), num(), int(num()), int(num())
            end = (num() + ox, num() + oy)
            pts.extend(arc_points(cur, rx, ry, phi, large, sweep, end, step))
            cur = end
        elif C == "Z":
            pts.append(start)
            cur = start
        else:
            raise ValueError("unsupported path command %s" % cmd)
    if len(pts) > 1:
        lines.append(pts)
    return lines


def read_glyph(slug):
    root = ET.parse(os.path.join(GLYPHS, slug + ".svg")).getroot()
    vb = [float(v) for v in root.get("viewBox").split()]
    width = float(root.get("stroke-width", "3"))
    lines = []
    for el in root.iter():
        tag = el.tag.split("}")[-1]
        if tag == "path":
            lines += path_polylines(el.get("d"))
        elif tag == "circle":
            cx, cy, r = (float(el.get(k)) for k in ("cx", "cy", "r"))
            n = max(24, int(2 * math.pi * r / 0.2))
            lines.append([(cx + r * math.cos(2 * math.pi * j / n), cy + r * math.sin(2 * math.pi * j / n)) for j in range(n + 1)])
        elif tag == "line":
            lines.append([(float(el.get("x1")), float(el.get("y1"))), (float(el.get("x2")), float(el.get("y2")))])
        elif tag in ("rect", "ellipse", "polygon", "polyline", "use", "text"):
            raise ValueError("%s.svg: write <%s> as a <path>" % (slug, tag))
    return vb, width, lines


def distance_field(lines, vb, width):
    """Exact distance from every working pixel to the glyph's centrelines, plus the unit vector away from them."""
    unit = GLYPH_FRAC * 2 * R_DISC / vb[2]
    hw = width / 2 * unit
    cx0, cy0 = vb[0] + vb[2] / 2, vb[1] + vb[3] / 2
    best = np.full((S, S), np.inf)
    vx = np.zeros((S, S))
    vy = np.zeros((S, S))
    pad = hw + 4
    for pts in lines:
        P = np.array([((x - cx0) * unit + S / 2, (y - cy0) * unit + S / 2) for x, y in pts])
        for a, b in zip(P[:-1], P[1:]):
            x0, x1 = int(max(0, math.floor(min(a[0], b[0]) - pad))), int(min(S, math.ceil(max(a[0], b[0]) + pad)))
            y0, y1 = int(max(0, math.floor(min(a[1], b[1]) - pad))), int(min(S, math.ceil(max(a[1], b[1]) + pad)))
            if x1 <= x0 or y1 <= y0:
                continue
            yy, xx = np.mgrid[y0:y1, x0:x1]
            px, py = xx + 0.5, yy + 0.5
            ab = b - a
            L2 = ab @ ab
            t = np.zeros_like(px) if L2 == 0 else np.clip(((px - a[0]) * ab[0] + (py - a[1]) * ab[1]) / L2, 0, 1)
            qx, qy = a[0] + t * ab[0], a[1] + t * ab[1]
            dx, dy = px - qx, py - qy
            d = np.hypot(dx, dy)
            win = best[y0:y1, x0:x1]
            take = d < win
            win[take] = d[take]
            vx[y0:y1, x0:x1][take] = dx[take]
            vy[y0:y1, x0:x1][take] = dy[take]
    dd = np.maximum(best, 1e-6)
    return best, vx / dd, vy / dd, hw


# ---------- engraving ----------

def engrave(y, field, hw, gx, gy, dist, small=False):
    """Cut the glyph into the field as a V groove: the wall on the top-left side of each stroke faces
    away from the light and falls dark, the wall on the bottom-right faces it and catches a light edge.

    small: the optical size for the 80 pixel file (shown at 40 and 52). The same glyph, cut 12 percent
    wider and a shade darker, so the groove still reads once its two walls are a pixel each."""
    if small:
        hw = hw * 1.12
    k = 1.05  # wall slope, about 46 degrees
    nz = 1 / math.sqrt(1 + k * k)
    nx, ny = -k * gx * nz, -k * gy * nz
    dot = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]
    rel = np.clip(dot / LIGHT[2], 0, None)
    rel = ndimage.gaussian_filter(rel, 0.8)
    depth = np.clip(1 - dist / hw, 0, 1)
    # the floor of the cut sees less of the room: darker toward the bottom of the V
    occl = 1 - 0.34 * depth ** 1.5
    wall = np.where(rel < 1, 0.06 + 0.78 * rel ** 2.0, 0.84 + 0.45 * (rel - 1))
    if small:
        wall = wall * 0.86
    local = ndimage.gaussian_filter(field, hw * 1.5)  # the tone the cut would show if the field were flat here
    g = local * wall * occl
    # a hard glint where the lit wall squares up to the light
    g = g + 0.32 * np.clip((rel - 1.18) / 0.22, 0, 1) ** 2
    cov = np.clip(hw - dist + 0.5, 0, 1)
    return y * (1 - cov) + np.clip(g, 0, 1.05) * cov


# ---------- striking a tier ----------

def strike(y, alpha, rr, field_r, tier):
    T = TIERS[tier]
    inner = rr < field_r * 0.7
    yv = y.copy()
    if T["satin"]:
        # satin: the brushed finish spreads small glints out; mid detail (the guilloche) stays
        soft = ndimage.gaussian_filter(yv, 2.2)
        hi = np.clip(yv - soft, 0, None)
        yv = yv - T["satin"] * hi
    if T["antique"]:
        # antiqued: recesses hold darker patina, so the relief reads harder
        yv = yv + T["antique"] * (yv - ndimage.gaussian_filter(yv, 3.0))
    if T["crisp"]:
        yv = yv + T["crisp"] * (yv - ndimage.gaussian_filter(yv, 1.2))
    # the tier's sheen: a broad band of extra light across the face, square to the key light
    amp, width = T["sheen"]
    u = ((np.mgrid[0:S, 0:S][1] - S / 2) + (np.mgrid[0:S, 0:S][0] - S / 2)) / (math.sqrt(2) * R_DISC)
    band = np.exp(-((u + 0.32) / width) ** 2)
    yv = yv + amp * band * (1 - yv)
    m0 = np.median(yv[inner])
    yv = np.clip((yv - m0) * T["contrast"] + m0, 0, 1) ** T["gamma"]
    m = float(np.median(yv[inner]))
    stops = [(m if p == "m" else p, c) for p, c in T["stops"]]
    stops = sorted(stops, key=lambda s: s[0])
    lut = ramp(stops)
    idx = np.clip((yv * (len(lut) - 1)).round().astype(int), 0, len(lut) - 1)
    rgb = lut[idx]
    return np.dstack([rgb, alpha])


# ---------- output ----------

def downscale(rgba, size, sharpen):
    a = rgba[..., 3:4]
    pre = np.concatenate([rgba[..., :3] * a, a], -1).astype(np.float32)
    small = cv2.resize(pre, (size, size), interpolation=cv2.INTER_AREA).astype(np.float64)
    al = small[..., 3:4]
    rgb = np.where(al > 1e-4, small[..., :3] / np.maximum(al, 1e-4), 0)
    if sharpen:
        blur = cv2.GaussianBlur(rgb.astype(np.float32), (0, 0), 0.7).astype(np.float64)
        rgb = rgb + sharpen * (rgb - blur)
    return np.dstack([np.clip(rgb, 0, 1), np.clip(al, 0, 1)])


def save_webp(rgba, path, cap_kb=25, quality=90):
    im = Image.fromarray((rgba * 255 + 0.5).clip(0, 255).astype(np.uint8), "RGBA")
    q = quality
    while True:
        im.save(path, "WEBP", quality=q, method=6, alpha_quality=100, exact=False)
        if os.path.getsize(path) <= cap_kb * 1024 or q <= 60:
            break
        q -= 4
    return os.path.getsize(path), q


def make_sheen(size=160):
    """A soft diagonal specular streak on transparent, warm white, with a thinner echo beside it."""
    s = size * 4
    yy, xx = np.mgrid[0:s, 0:s]
    u = ((xx - s / 2) + (yy - s / 2)) / (s / 2)      # across the streak: it runs lower left to upper right
    v = ((xx - s / 2) - (yy - s / 2)) / (s / 2)      # along it
    main = np.exp(-(u / 0.21) ** 2)
    core = 0.35 * np.exp(-(u / 0.06) ** 2)
    echo = 0.40 * np.exp(-((u - 0.40) / 0.06) ** 2)
    taper = np.exp(-(v / 1.35) ** 4)
    a = np.clip((main + core + echo) * taper, 0, 1) * 0.9
    rgb = np.ones((s, s, 3)) * np.array([1.0, 0.985, 0.955])
    big = np.dstack([rgb, a])
    return downscale(big, size, 0)


def contact_sheet(made, blanks):
    pad, gut = 28, 20
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
        head = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
    except OSError:
        font = head = ImageFont.load_default()
    cols = 6
    c80, c40 = 120, 64
    rows = math.ceil(len(made) / cols)
    W = pad * 2 + cols * c80 + gut + cols * c40 + gut + 2 * 172
    H = pad * 2 + 24 + rows * (c80 + 22) + 10
    H = max(H, pad * 2 + 24 + 2 * 196)
    sheet = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(sheet)
    x80 = pad
    x40 = pad + cols * c80 + gut
    xb = x40 + cols * c40 + gut
    d.text((x80, pad), "80 px", fill=BONE, font=head)
    d.text((x40, pad), "40 px", fill=BONE, font=head)
    d.text((xb, pad), "blanks, 160 px", fill=BONE, font=head)
    for i, (slug, tier) in enumerate(made):
        im80 = Image.open(os.path.join(OUT, slug + "-80.webp")).convert("RGBA")
        r, c = divmod(i, cols)
        y = pad + 24 + r * (c80 + 22)
        sheet.paste(im80, (x80 + c * c80 + (c80 - 80) // 2, y), im80)
        d.text((x80 + c * c80 + 4, y + 84), slug, fill=(170, 165, 155), font=font)
        im40 = im80.resize((40, 40), Image.LANCZOS)
        sheet.paste(im40, (x40 + c * c40 + 12, y + 20), im40)
    for i, tier in enumerate(blanks):
        im = Image.open(os.path.join(OUT, tier + "-blank-160.webp")).convert("RGBA")
        r, c = divmod(i, 2)
        x, y = xb + c * 172, pad + 24 + r * 196
        sheet.paste(im, (x, y), im)
        d.text((x + 4, y + 164), tier, fill=(170, 165, 155), font=font)
    sheet.save(SHEET)
    return SHEET


def proofs_sheet():
    """All 34 medals as they stand on disk, trophies then proofs, at 80 and 40 pixels on ink."""
    pad, gut = 28, 20
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
        head = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
    except OSError:
        font = head = ImageFont.load_default()
    cols, c80, c40, row = 6, 120, 64, 104
    groups = [("trophies", TROPHIES), ("proofs", PROOFS)]
    W = pad * 2 + cols * c80 + gut + cols * c40
    H = pad * 2 + sum(30 + math.ceil(len(g) / cols) * row for _, g in groups)
    sheet = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(sheet)
    x80, x40 = pad, pad + cols * c80 + gut
    y = pad
    for name, group in groups:
        d.text((x80, y), "%s, 80 px" % name, fill=BONE, font=head)
        d.text((x40, y), "40 px", fill=BONE, font=head)
        y += 30
        for i, (slug, tier) in enumerate(group):
            r, c = divmod(i, cols)
            yy = y + r * row
            im80 = Image.open(os.path.join(OUT, slug + "-80.webp")).convert("RGBA")
            sheet.paste(im80, (x80 + c * c80 + (c80 - 80) // 2, yy), im80)
            d.text((x80 + c * c80 + 4, yy + 84), slug, fill=(170, 165, 155), font=font)
            im40 = im80.resize((40, 40), Image.LANCZOS)
            sheet.paste(im40, (x40 + c * c40 + 12, yy + 20), im40)
        y += math.ceil(len(group) / cols) * row
    sheet.save(PROOF_SHEET)
    return PROOF_SHEET


def pick(args):
    """The medals a run strikes, in order: everything, a group, or named slugs (commas or spaces)."""
    every = TROPHIES + PROOFS
    if not (args.only or args.proofs or args.trophies):
        return every, True
    want = set()
    if args.proofs:
        want |= {s for s, _ in PROOFS}
    if args.trophies:
        want |= {s for s, _ in TROPHIES}
    for item in args.only or []:
        want |= {s for s in item.split(",") if s}
    unknown = sorted(want - {s for s, _ in every})
    if unknown:
        sys.exit("medals.py: no medal named %s" % ", ".join(unknown))
    return [(s, t) for s, t in every if s in want], False


def embed(path, prompt, script):
    subprocess.run(["node", script, path, "--prompt", prompt], check=True, stdout=subprocess.DEVNULL)


def find_embed(arg):
    if arg:
        return arg
    if os.environ.get("EMBED_PROMPT"):
        return os.environ["EMBED_PROMPT"]
    hits = glob.glob(os.path.expanduser("~/.claude/skills/**/impeccable/scripts/embed-prompt.mjs"), recursive=True)
    if not hits:
        sys.exit("medals.py: embed-prompt.mjs not found; pass --embed-script or --no-provenance")
    return hits[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-provenance", action="store_true")
    ap.add_argument("--embed-script")
    ap.add_argument("--only", nargs="*", help="slugs to strike, comma or space separated (default all)")
    ap.add_argument("--proofs", action="store_true", help="strike the 16 proof medals")
    ap.add_argument("--trophies", action="store_true", help="strike the 18 trophies")
    args = ap.parse_args()
    made, full = pick(args)

    os.makedirs(OUT, exist_ok=True)
    prompt = open(BASE_PROMPT).read().strip()
    script = None if args.no_provenance else find_embed(args.embed_script)

    y, alpha, rr, edge, field_r = load_base()
    print("medal edge r=%.1f, field r=%d (of %d working px)" % (edge, field_r, S))

    report = []
    for slug, tier in made:
        vb, width, lines = read_glyph(slug)
        dist, gx, gy, hw = distance_field(lines, vb, width)
        if np.any((dist < hw) & (rr > field_r - 6)):
            print("  warning: %s reaches the bevel" % slug)
        for size, sharp, small in ((160, 0.35, False), (80, 0.55, True)):
            rgba = strike(engrave(y, y, hw, gx, gy, dist, small), alpha, rr, field_r, tier)
            path = os.path.join(OUT, "%s-%d.webp" % (slug, size))
            b, q = save_webp(downscale(rgba, size, sharp), path)
            report.append((os.path.basename(path), b, q))
            if script:
                embed(path, prompt + "\n\nrecoloured and engraved in code with the %s glyph" % slug, script)

    blanks = ["bronze", "silver", "gold", "platinum"]
    if full:
        for tier in blanks:
            rgba = strike(y, alpha, rr, field_r, tier)
            path = os.path.join(OUT, "%s-blank-160.webp" % tier)
            b, q = save_webp(downscale(rgba, 160, 0.35), path)
            report.append((os.path.basename(path), b, q))
            if script:
                embed(path, prompt + "\n\nrecoloured in code as the %s blank, no glyph" % tier, script)
        path = os.path.join(OUT, "sheen.webp")
        b, q = save_webp(make_sheen(160), path, quality=92)
        report.append(("sheen.webp", b, q))
        if script:
            embed(path, "Drawn in code by tools/art/medals.py, no generation: a soft diagonal specular streak, "
                        "warm white on transparent, 160x160, swept across a medal by CSS on unlock.", script)
        print("contact sheet:", contact_sheet(TROPHIES, blanks))
    if full or any(slug in dict(PROOFS) for slug, _ in made):
        print("proofs contact sheet:", proofs_sheet())
    for name, b, q in report:
        print("  %-28s %6.1f KB  q%d" % (name, b / 1024, q))


if __name__ == "__main__":
    main()
