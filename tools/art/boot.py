"""The loading screen's illustration: the Triple J lot after hours, as a fine bone
line drawing laid over the same composition as the title screen's key art
(assets/game/art/triple-j-w), so when it is done it dissolves into the photo of
the lot it was drawing. Writes tools/site/boot.html, which assemble_home.py puts
at the top of the home page and /obavia.html.

Every stroke carries --a and --b, the stretch of real loading progress over which
it draws (the page sets --p from 0 to 1 as the art, the fonts and the scripts
arrive). Once everything is in, the lamps and the showroom light, the wet
asphalt takes their reflections, and the drawing gives way to the title screen.

Also writes tools/film/src/tour/boot.json: the walkthrough film opens on it.

Run:  python3 tools/art/boot.py   (then python3 tools/site/assemble_home.py)
"""
import math
import pathlib
import random

ROOT = pathlib.Path(__file__).resolve().parents[2]
random.seed(53)
GROUND = 604
paths = []  # (d, a, b, cls)


def P(d, a, b, cls=""):
    paths.append((d, round(a, 3), round(b, 3), cls))


def f(v):
    return ("%.1f" % v).rstrip("0").rstrip(".")


# the ground, drawn out from the lamp both ways
P("M1108 %d H120" % GROUND, 0.0, 0.16)
P("M1108 %d H1880" % GROUND, 0.0, 0.16)

# the far tree line: low brush and a few crowns, a smooth silhouette (a
# Catmull-Rom curve through jittered points) from the left edge to the showroom
pts = []
x = 30.0
while x < 1660:
    crown = random.random() < 0.16
    y = 544 - (random.uniform(14, 24) if crown else random.uniform(2, 9))
    pts.append((x, y))
    x += random.uniform(26, 40) if crown else random.uniform(34, 70)
segs = []
for k in range(len(pts) - 1):
    p0 = pts[k - 1] if k else pts[k]
    p1, p2 = pts[k], pts[k + 1]
    p3 = pts[k + 2] if k + 2 < len(pts) else p2
    c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
    c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
    segs.append("C%s %s %s %s %s %s" % (f(c1[0]), f(c1[1]), f(c2[0]), f(c2[1]), f(p2[0]), f(p2[1])))
P("M%s %s " % (f(pts[0][0]), f(pts[0][1])) + " ".join(segs), 0.04, 0.34, "thin")

# distant poles over the trees
for px, top in [(250, 468), (420, 480), (610, 488), (760, 492), (972, 500)]:
    P("M%d 546 V%d M%d %d h12" % (px, top, px - 6, top + 2), 0.12, 0.3, "thin")

# the main lamp, centre of the frame, and the lamps down the row
def lamp(x, top, base, span, a, b):
    P("M%d %d V%d" % (x, base, top), a, b - 0.06)
    P("M%d %d H%d" % (x - span, top + 4, x + span), b - 0.08, b)
    for hx in (x - span, x + span):
        P("M%s %s h%s l-%s %s h-%s z" % (f(hx - span * 0.42), f(top), f(span * 0.84), f(span * 0.14), f(span * 0.24), f(span * 0.56)), b - 0.06, b)


lamp(1108, 272, GROUND, 30, 0.14, 0.42)
lamp(1426, 412, 556, 12, 0.24, 0.46)
for x, top in [(1536, 446), (1586, 466), (1630, 478)]:
    P("M%d 556 V%d M%d %d h12" % (x, top, x - 6, top), 0.28, 0.46, "thin")

# the showroom: roof slab, the glass band and its mullions
P("M1660 480 H1916 M1660 488 H1916 M1664 488 V%d M1912 488 V%d" % (GROUND - 22, GROUND - 22), 0.3, 0.52)
P("M1664 %d H1912" % (GROUND - 22), 0.34, 0.54)
P(" ".join("M%d 494 V%d" % (mx, GROUND - 26) for mx in range(1690, 1912, 26)), 0.4, 0.62, "thin")

# palms behind the showroom and down the row
def palm(x, top, base, s, a, b):
    P("M%d %d C%s %s %s %s %d %d" % (x, base, f(x - 2 * s), f(base - (base - top) * 0.4), f(x - 6 * s), f(top + (base - top) * 0.3), x, top), a, a + (b - a) * 0.55)
    fr = [(-20, -6, -40, 2, -54, 16), (18, -8, 38, -4, 52, 10), (-8, -14, -26, -22, -40, -22), (10, -14, 26, -20, 42, -18), (-24, 4, -40, 18, -46, 34), (22, 2, 40, 14, 48, 32)]
    for i, (a1, b1, a2, b2, a3, b3) in enumerate(fr):
        P("M%d %d c%s %s %s %s %s %s" % (x, top, f(a1 * s), f(b1 * s), f(a2 * s), f(b2 * s), f(a3 * s), f(b3 * s)), a + (b - a) * (0.5 + i * 0.07), b, "thin")





# the row of cars, seen from behind, smaller as they run toward the showroom
def car(x, w, h, kind, a, b):
    base = GROUND
    body_t = base - h * 0.6
    sill = base - h * 0.14
    r = min(10, h * 0.12)
    # wheels first, then the body, the cabin, the glass, the lamps, the bumper
    ww = w * 0.13
    P("M%s %s V%s H%s V%s M%s %s V%s H%s V%s" % (f(x + w * 0.07), f(sill), f(base), f(x + w * 0.07 + ww), f(sill),
                                                 f(x + w * 0.93 - ww), f(sill), f(base), f(x + w * 0.93), f(sill)), a, a + (b - a) * 0.3)
    P("M%s %s H%s Q%s %s %s %s V%s Q%s %s %s %s H%s Q%s %s %s %s V%s Q%s %s %s %s Z" % (
        f(x + r), f(sill), f(x + w - r), f(x + w), f(sill), f(x + w), f(sill - r), f(body_t + r), f(x + w), f(body_t), f(x + w - r), f(body_t),
        f(x + r), f(x), f(body_t), f(x), f(body_t + r), f(sill - r), f(x), f(sill), f(x + r), f(sill)), a + (b - a) * 0.1, a + (b - a) * 0.6, "solid")
    top = base - h
    if kind == "pickup":
        cx0, cx1 = x + w * 0.2, x + w * 0.8
        P("M%s %s L%s %s H%s L%s %s" % (f(cx0), f(body_t), f(cx0 + w * 0.05), f(top), f(cx1 - w * 0.05), f(cx1), f(body_t)), a + (b - a) * 0.12, a + (b - a) * 0.75, "solid")
        P("M%s %s H%s" % (f(x + w * 0.04), f(body_t + h * 0.08), f(x + w * 0.96)), a + (b - a) * 0.5, a + (b - a) * 0.8, "thin")
        glass = (cx0 + w * 0.09, top + h * 0.08, cx1 - w * 0.09, body_t - h * 0.04)
    else:
        sl = 0.16 if kind == "sedan" else 0.09
        cx0, cx1 = x + w * 0.1, x + w * 0.9
        P("M%s %s L%s %s Q%s %s %s %s H%s Q%s %s %s %s L%s %s" % (
            f(cx0), f(body_t), f(cx0 + w * sl), f(top + 4), f(cx0 + w * sl), f(top), f(cx0 + w * sl + 6), f(top),
            f(cx1 - w * sl - 6), f(cx1 - w * sl), f(top), f(cx1 - w * sl), f(top + 4), f(cx1), f(body_t)), a + (b - a) * 0.12, a + (b - a) * 0.75, "solid")
        glass = (cx0 + w * sl + w * 0.05, top + h * 0.09, cx1 - w * sl - w * 0.05, body_t - h * 0.05)
    gx0, gy0, gx1, gy1 = glass
    P("M%s %s H%s L%s %s H%s Z" % (f(gx0), f(gy0), f(gx1), f(gx1 + w * 0.025), f(gy1), f(gx0 - w * 0.025)), a + (b - a) * 0.55, a + (b - a) * 0.85, "thin")
    ly = body_t + (sill - body_t) * 0.22
    lh = (sill - body_t) * 0.22
    P("M%s %s h%s v%s h-%s z M%s %s h-%s v%s h%s z" % (f(x + w * 0.05), f(ly), f(w * 0.16), f(lh), f(w * 0.16), f(x + w * 0.95), f(ly), f(w * 0.16), f(lh), f(w * 0.16)), a + (b - a) * 0.7, b, "lamp")
    P("M%s %s h%s v%s h-%s z" % (f(x + w * 0.42), f(ly + lh * 1.6), f(w * 0.16), f(lh * 0.9), f(w * 0.16)), a + (b - a) * 0.75, b, "thin")
    P("M%s %s H%s" % (f(x + w * 0.03), f(sill - (sill - body_t) * 0.24), f(x + w * 0.97)), a + (b - a) * 0.6, b, "thin")


palm(1812, 372, GROUND - 22, 1.0, 0.62, 0.92)
palm(1880, 360, GROUND - 22, 1.06, 0.66, 0.96)
palm(1702, 424, 482, 0.72, 0.6, 0.88)
palm(1516, 420, 556, 0.68, 0.58, 0.86)

row = [(640, 214, 98, "pickup"), (874, 196, 90, "suv"), (1136, 156, 72, "sedan"), (1304, 108, 60, "suv"), (1446, 92, 50, "sedan"), (1554, 92, 46, "suv")]
for i, (x, w, h, kind) in enumerate(row):
    a = 0.38 + i * 0.07
    car(x, w, h, kind, a, min(1.0, a + 0.3))

# what the light does once everything is in: lamps, showroom glass, reflections
glow = (
    '<g class="boot__lit">'
    '<circle cx="1108" cy="282" r="74" fill="url(#boot-glow)"/><circle cx="1426" cy="418" r="34" fill="url(#boot-glow)"/>'
    '<rect x="1666" y="490" width="244" height="90" fill="rgba(237,231,219,0.13)"/>'
    '<path class="boot__wet" d="M1108 626 V1010 M1426 622 V826 M1716 612 V706 M1794 612 V690 M1872 612 V720"/>'
    '<circle cx="1078" cy="276" r="3.2"/><circle cx="1138" cy="276" r="3.2"/><circle cx="1414" cy="414" r="1.8"/><circle cx="1438" cy="414" r="1.8"/>'
    "</g>"
)

strokes = "".join(
    '<path%s d="%s" pathLength="1" style="--a:%s;--b:%s"/>' % (' class="%s"' % c if c else "", d, a, b) for d, a, b, c in paths
)

html_out = (
    "<!-- boot: the loading screen (tools/art/boot.py writes this file; assemble_home.py places it). Shown only while html.intro-pending, so crawlers, no-JS readers and clicks between the site's own pages never see it. -->\n"
    '<div id="boot" class="boot" role="status" aria-label="Loading the title screen" data-art="%%BOOT_ART%%">'
    '<svg class="boot__draw" viewBox="0 0 1920 1080" aria-hidden="true" focusable="false">'
    '<defs><radialGradient id="boot-glow"><stop offset="0" stop-color="#ede7db" stop-opacity=".55"/><stop offset=".35" stop-color="#ede7db" stop-opacity=".16"/><stop offset="1" stop-color="#ede7db" stop-opacity="0"/></radialGradient></defs>'
    + glow
    + '<g class="boot__lines">' + strokes + "</g></svg>"
    '<div class="boot__foot"><p class="boot__label">Opening the lot</p><span class="boot__bar" aria-hidden="true"><i></i></span>'
    "%%BOOT_FILM%%</div></div>\n"
    "<script>%%BOOT_JS%%</script>\n"
)
(ROOT / "tools/site/boot.html").write_text(html_out)
# the walkthrough film opens on the same drawing (tools/film/src/tour)
import json
(ROOT / "tools/film/src/tour").mkdir(parents=True, exist_ok=True)
(ROOT / "tools/film/src/tour/boot.json").write_text(json.dumps({"paths": paths, "lit": glow}, separators=(",", ":")) + "\n")
print("tools/site/boot.html", len(html_out), "bytes,", len(paths), "strokes")
