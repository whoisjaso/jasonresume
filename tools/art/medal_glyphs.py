"""The 18 trophy glyphs and the 16 proof medal glyphs, authored as geometry and written as SVG.

Every glyph sits on a 48 unit grid and is one weight of line: stroke 3, round
caps and round joins, no fills. Where two lines cross and one should pass
under the other (rings, links, the monogram) the under line is cut back so a
clear gap shows on both sides of the over line, the way an engraver would cut
it. The files in assets/game/medals/glyphs are the source medals.py reads;
run this to rewrite them after changing a shape here.

    python3 tools/art/medal_glyphs.py                 # all 34
    python3 tools/art/medal_glyphs.py --proofs        # the 16 proof medals
    python3 tools/art/medal_glyphs.py crew,payroll    # named glyphs
"""
import math
import os
import sys

GRID = 48
STROKE = 3.0
GAP = 1.75  # clear metal between an over line and the cut ends of the under line

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "assets", "game", "medals", "glyphs")


# ---------- pieces ----------

class Line:
    def __init__(self, p0, p1):
        self.p0, self.p1 = tuple(p0), tuple(p1)

    def at(self, t):
        return (self.p0[0] + (self.p1[0] - self.p0[0]) * t, self.p0[1] + (self.p1[1] - self.p0[1]) * t)

    def sub(self, t0, t1):
        return Line(self.at(t0), self.at(t1))

    def xf(self, f):
        return Line(f.pt(self.p0), f.pt(self.p1))

    def svg(self):
        return "L%s %s" % (n(self.p1[0]), n(self.p1[1]))


class Arc:
    """Circular arc. Angles in degrees on the y-down grid, so a growing angle runs clockwise."""

    def __init__(self, c, r, a0, a1):
        self.c, self.r, self.a0, self.a1 = tuple(c), r, a0, a1

    def at(self, t):
        a = math.radians(self.a0 + (self.a1 - self.a0) * t)
        return (self.c[0] + self.r * math.cos(a), self.c[1] + self.r * math.sin(a))

    @property
    def p0(self):
        return self.at(0)

    @property
    def p1(self):
        return self.at(1)

    def sub(self, t0, t1):
        d = self.a1 - self.a0
        return Arc(self.c, self.r, self.a0 + d * t0, self.a0 + d * t1)

    def xf(self, f):
        return Arc(f.pt(self.c), self.r * f.s, self.a0 + f.rot, self.a1 + f.rot)

    def svg(self):
        d = self.a1 - self.a0
        if abs(d) > 359.0:  # SVG cannot draw a full turn in one arc
            h = self.sub(0, 0.5)
            return h.svg() + " " + self.sub(0.5, 1).svg()
        x, y = self.p1
        return "A%s %s 0 %d %d %s %s" % (n(self.r), n(self.r), 1 if abs(d) > 180 else 0, 1 if d > 0 else 0, n(x), n(y))


class Cubic:
    def __init__(self, p0, p1, p2, p3):
        self.p0, self.c1, self.c2, self.p1 = tuple(p0), tuple(p1), tuple(p2), tuple(p3)

    def at(self, t):
        u = 1 - t
        a, b, c, d = self.p0, self.c1, self.c2, self.p1
        return tuple(u * u * u * a[i] + 3 * u * u * t * b[i] + 3 * u * t * t * c[i] + t * t * t * d[i] for i in (0, 1))

    def _split(self, t):
        lerp = lambda p, q: (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)
        a, b, c, d = self.p0, self.c1, self.c2, self.p1
        ab, bc, cd = lerp(a, b), lerp(b, c), lerp(c, d)
        abc, bcd = lerp(ab, bc), lerp(bc, cd)
        m = lerp(abc, bcd)
        return Cubic(a, ab, abc, m), Cubic(m, bcd, cd, d)

    def sub(self, t0, t1):
        if t1 <= t0:
            return Cubic(self.at(t0), self.at(t0), self.at(t0), self.at(t0))
        right = self._split(t0)[1] if t0 > 0 else self
        if t1 >= 1:
            return right
        return right._split((t1 - t0) / (1 - t0))[0]

    def xf(self, f):
        return Cubic(f.pt(self.p0), f.pt(self.c1), f.pt(self.c2), f.pt(self.p1))

    def svg(self):
        return "C%s %s %s %s %s %s" % tuple(n(v) for v in (self.c1 + self.c2 + self.p1))


def Quad(p0, c, p1):
    return Cubic(p0, (p0[0] + 2 / 3 * (c[0] - p0[0]), p0[1] + 2 / 3 * (c[1] - p0[1])),
                 (p1[0] + 2 / 3 * (c[0] - p1[0]), p1[1] + 2 / 3 * (c[1] - p1[1])), p1)


def n(v):
    s = ("%.2f" % v).rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


class Xf:
    """Rotate (degrees, clockwise on the y-down grid) about a point, then scale about it, then move."""

    def __init__(self, rot=0.0, about=(24, 24), s=1.0, move=(0, 0)):
        self.rot, self.about, self.s, self.move = rot, about, s, move

    def pt(self, p):
        a = math.radians(self.rot)
        x, y = p[0] - self.about[0], p[1] - self.about[1]
        x, y = x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a)
        return (self.about[0] + x * self.s + self.move[0], self.about[1] + y * self.s + self.move[1])


# ---------- paths: a path is a list of pieces end to start ----------

def poly(*pts, closed=False):
    pts = list(pts) + ([pts[0]] if closed else [])
    return [Line(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]


def circle(c, r, start=-90):
    return [Arc(c, r, start, start + 360)]


def rrect(x0, y0, x1, y1, r):
    return [Line((x0 + r, y0), (x1 - r, y0)), Arc((x1 - r, y0 + r), r, -90, 0),
            Line((x1, y0 + r), (x1, y1 - r)), Arc((x1 - r, y1 - r), r, 0, 90),
            Line((x1 - r, y1), (x0 + r, y1)), Arc((x0 + r, y1 - r), r, 90, 180),
            Line((x0, y1 - r), (x0, y0 + r)), Arc((x0 + r, y0 + r), r, 180, 270)]


def stadium(c, length, h):
    """A chain link: a rounded bar `length` long overall and `h` tall, centred on c, lying flat."""
    r = h / 2
    x0, x1 = c[0] - length / 2 + r, c[0] + length / 2 - r
    y0, y1 = c[1] - r, c[1] + r
    return [Line((x0, y0), (x1, y0)), Arc((x1, c[1]), r, -90, 90),
            Line((x1, y1), (x0, y1)), Arc((x0, c[1]), r, 90, 270)]


def xf(path, f):
    return [p.xf(f) for p in path]


def sample(path, step=0.25):
    pts = []
    for p in path:
        k = max(4, int(math.ceil(length(p) / step)))
        pts.extend(p.at(i / k) for i in range(k + 1))
    return pts


def length(p, k=24):
    q = [p.at(i / k) for i in range(k + 1)]
    return sum(math.dist(q[i], q[i + 1]) for i in range(k))


def cut(under, over, near, radius=6.0, clear=STROKE + GAP):
    """Cut `under` back wherever it runs within `clear` of the `over` line, inside `radius` of `near`.

    Returns a list of paths (the under line falls apart into runs)."""
    o = sample(over, 0.2)
    out, run = [], []

    def blocked(q):
        if math.dist(q, near) > radius:
            return False
        return min(math.dist(q, p) for p in o) < clear

    for piece in under:
        k = max(40, int(length(piece) / 0.05))
        flags = [blocked(piece.at(i / k)) for i in range(k + 1)]
        i = 0
        while i <= k:
            if flags[i]:
                if run:
                    out.append(run)
                    run = []
                i += 1
                continue
            j = i
            while j + 1 <= k and not flags[j + 1]:
                j += 1
            if j > i:
                run.append(piece.sub(i / k, j / k))
            if j < k:
                out.append(run)
                run = []
            i = j + 1
    if run:
        out.append(run)
    # a closed under line that was cut once wraps: join its last run to its first
    if len(out) > 1 and math.dist(out[-1][-1].p1, out[0][0].p0) < 1e-6:
        out[0] = out.pop() + out[0]
    # drop slivers left between two nearby cuts: they read as specks, not line
    return [r for r in out if r and sum(length(p) for p in r) > 2.0]


def cut_many(under, overs):
    """Apply several cuts to a path or a list of paths: overs is [(over_path, near), ...]."""
    paths = under if under and isinstance(under[0], list) else [under]
    for over, near in overs:
        nxt = []
        for p in paths:
            nxt.extend(cut(p, over, near))
        paths = nxt
    return paths


def keepout(path, centre, r):
    """Cut a path back where it runs inside a circle (an object sitting on top of it)."""
    ring = circle(centre, r)
    out = []
    for piece in path:
        k = max(40, int(length(piece) / 0.05))
        flags = [math.dist(piece.at(i / k), centre) < r for i in range(k + 1)]
        i = 0
        while i <= k:
            if flags[i]:
                i += 1
                continue
            j = i
            while j + 1 <= k and not flags[j + 1]:
                j += 1
            if j > i:
                out.append([piece.sub(i / k, j / k)])
            i = j + 1
    del ring
    return chain(out)


def chain(paths):
    """Join runs whose ends meet so round joins stay joins, not overlapping caps."""
    paths = [list(p) for p in paths if p]
    merged = True
    while merged:
        merged = False
        for i in range(len(paths)):
            for j in range(len(paths)):
                if i != j and math.dist(paths[i][-1].p1, paths[j][0].p0) < 1e-4:
                    paths[i] = paths[i] + paths[j]
                    del paths[j]
                    merged = True
                    break
            if merged:
                break
    return paths


# ---------- the glyphs ----------

def g_fifty_three():
    """A car key on a ring."""
    ring = circle((24, 7.5), 6.0, start=90)
    head = rrect(17, 13, 31, 29, 5)
    button = circle((24, 21), 2.6)
    blade = poly((21.5, 29), (21.5, 41.5), (24, 44), (26.5, 44), (26.5, 40), (25, 38.5), (26.5, 37), (26.5, 33), (25.5, 32), (26.5, 31), (26.5, 29))
    # the ring threads the head: over it on the left, under it on the right
    left_x, right_x = 24 - math.sqrt(36 - (13 - 7.5) ** 2), 24 + math.sqrt(36 - (13 - 7.5) ** 2)
    head_parts = cut(head, ring, (left_x, 13), radius=4)
    ring_parts = cut(ring, head, (right_x, 13), radius=4)
    f = Xf(rot=-45, about=(24, 24), move=(0, 0))
    return [xf(p, f) for p in chain(head_parts) + ring_parts + [button, blade]]


def g_proceeds():
    """A banded stack of notes."""
    # the top note, a second one behind it up and to the right, and the strap across both
    front = rrect(5, 18, 37, 38, 2.5)
    off = 6.0
    back = [Line((5 + off + 2.5, 18 - off), (37 + off - 2.5, 18 - off)), Arc((37 + off - 2.5, 18 - off + 2.5), 2.5, -90, 0),
            Line((37 + off, 18 - off + 2.5), (37 + off, 38 - off - 2.5)), Arc((37 + off - 2.5, 38 - off - 2.5), 2.5, 0, 90),
            Line((37 + off - 2.5, 38 - off), (37 + 3.2, 38 - off))]
    back_l = [Line((5 + off, 18 - off + 2.5 + 3.2), (5 + off, 18 - off + 2.5)), Arc((5 + off + 2.5, 18 - off + 2.5), 2.5, 180, 270)]
    band_l, band_r = 17, 25
    c = STROKE + GAP
    strap = [poly((band_l, 18), (band_l, 38)), poly((band_r, 18), (band_r, 38)),
             poly((band_l + off, 18 - off), (band_l + off, 18 - c + 0.9)), poly((band_r + off, 18 - off), (band_r + off, 18 - c + 0.9))]
    mark = circle((31, 28), 2.4)
    return [front, back, back_l] + strap + [mark]

def g_keys_to_the_lot():
    """A key tag on a hook."""
    plate = poly((19, 4.5), (35, 4.5))
    hook = [Line((30, 4.5), (30, 10)), Arc((25, 10), 5, 0, 180), Line((20, 10), (20, 8.5))]
    string = poly((25, 15), (25, 21.2))
    tag = poly((16.5, 26), (21.5, 20), (28.5, 20), (33.5, 26), (33.5, 42), (31.5, 44), (18.5, 44), (16.5, 42), closed=True)
    hole = circle((25, 24.6), 1.9)
    lines = [poly((21, 32), (29, 32)), poly((21, 37.5), (26, 37.5))]
    return [plate, hook, string, tag, hole] + lines

def g_title_run():
    """A folded vehicle title with a seal."""
    seal_c, seal_r = (34.5, 33), 6.5
    keep = seal_r + STROKE + GAP
    sheet = [Line((26, 5), (9.5, 5)), Arc((9.5, 7.5), 2.5, 270, 180), Line((7, 7.5), (7, 35.5)), Arc((9.5, 35.5), 2.5, 180, 90),
             Line((9.5, 38), (33, 38)), Line((33, 38), (33, 12)), Line((33, 12), (26, 5))]
    fold = poly((26, 5), (26, 12), (33, 12))
    out = keepout(sheet, seal_c, keep) + keepout(fold, seal_c, keep)
    text = [poly((12, 13), (21, 13)), poly((12, 19.5), (27, 19.5)), poly((12, 26), (21, 26))]
    seal = circle(seal_c, seal_r)
    core = circle(seal_c, 2.2)
    tails = [poly((31.2, 38.8), (29, 45), (31.6, 43.6), (33, 45.6)), poly((37.8, 38.8), (40, 45), (37.4, 43.6), (36, 45.6))]
    return out + text + [seal, core] + tails


def g_daily_driver():
    """Three linked rings."""
    r, side = 10.0, 14.0
    cy = 23.5
    k = side / math.sqrt(3)
    a, b, c = (24, cy - k), (24 - side / 2, cy + k / 2), (24 + side / 2, cy + k / 2)
    A, B, C = circle(a, r), circle(b, r, start=0), circle(c, r, start=180)

    def xs(p, q):
        """The crossing of two rings away from the centre, then the one near it."""
        d = math.dist(p, q)
        h = math.sqrt(r * r - (d / 2) ** 2)
        mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
        ux, uy = (q[0] - p[0]) / d, (q[1] - p[1]) / d
        s1, s2 = (mx - uy * h, my + ux * h), (mx + uy * h, my - ux * h)
        return sorted((s1, s2), key=lambda s: -math.dist(s, (24, cy)))

    ab_out, ab_in = xs(a, b)
    ac_out, ac_in = xs(a, c)
    bc_out, bc_in = xs(b, c)
    R = 4.8
    # each pair is linked: over at one of its crossings, under at the other
    Ap = A
    Ap = [p for q in [Ap] for p in cut(q, B, ab_out, radius=R)]
    Ap = [p for q in Ap for p in cut(q, C, ac_in, radius=R)]
    Bp = [p for q in [B] for p in cut(q, A, ab_in, radius=R)]
    Bp = [p for q in Bp for p in cut(q, C, bc_out, radius=R)]
    Cp = [p for q in [C] for p in cut(q, A, ac_out, radius=R)]
    Cp = [p for q in Cp for p in cut(q, B, bc_in, radius=R)]
    return Ap + Bp + Cp

def g_locked_rows():
    """A padlock over ruled rows."""
    body = rrect(15, 22, 33, 39.5, 3)
    shackle = [Line((19.5, 22), (19.5, 16.5)), Arc((24, 16.5), 4.5, 180, 360), Line((28.5, 16.5), (28.5, 22))]
    hole = circle((24, 28.6), 1.3)
    slot = poly((24, 29.5), (24, 33.5))
    c = STROKE + GAP
    rows = []
    for y, lo, hi in ((15, 19.5 - c, 28.5 + c), (26, 15 - c, 33 + c), (37, 15 - c, 33 + c)):
        rows += [poly((3.5, y), (lo, y)), poly((hi, y), (44.5, y))]
    return [body, shackle, hole, slot] + rows


def g_clean_books():
    """A ledger with a check."""
    cover = rrect(10, 6, 38, 42, 2.5)
    spine = poly((16, 6), (16, 42))
    corners = [poly((31, 6), (38, 13)), poly((31, 42), (38, 35))]
    check = poly((21, 24.5), (25.5, 29), (32.5, 19.5))
    return [cover, spine, check] + corners


def g_nothing_lost():
    """Two stacked drums with an arrow between them."""
    def drum(cx, y0, rx=7.5, ry=3.0, h=15):
        top = [Cubic((cx - rx, y0), (cx - rx, y0 - ry * 1.333), (cx + rx, y0 - ry * 1.333), (cx + rx, y0)),
               Cubic((cx + rx, y0), (cx + rx, y0 + ry * 1.333), (cx - rx, y0 + ry * 1.333), (cx - rx, y0))]
        side = [Line((cx - rx, y0), (cx - rx, y0 + h)),
                Cubic((cx - rx, y0 + h), (cx - rx, y0 + h + ry * 1.333), (cx + rx, y0 + h + ry * 1.333), (cx + rx, y0 + h)),
                Line((cx + rx, y0 + h), (cx + rx, y0))]
        band = [Cubic((cx - rx, y0 + h / 2), (cx - rx, y0 + h / 2 + ry * 1.333), (cx + rx, y0 + h / 2 + ry * 1.333), (cx + rx, y0 + h / 2))]
        return [top, side, band]
    arrow = [Cubic((23.5, 9), (31, 9), (35, 11.5), (35, 17))]
    head = poly((31.2, 13.6), (35, 17.4), (38.8, 13.6))
    return drum(13, 8) + drum(35, 25) + [arrow, head]


def g_booked():
    """A calendar leaf with a tick."""
    leaf = rrect(8, 10, 40, 42, 3)
    head = poly((8, 18.5), (40, 18.5))
    rings = [poly((16, 6), (16, 13.5)), poly((32, 6), (32, 13.5))]
    tick = poly((17, 30), (22, 35), (31.5, 25))
    return [leaf, head, tick] + rings


def g_matched():
    """Two interlocking links."""
    A = stadium((17, 24), 23, 11)
    B = stadium((31, 24), 23, 11)
    # where the right end of A meets the left end of B: A over at the top, under at the bottom
    xa = 17 + 23 / 2 - 5.5  # centre of A's right cap
    xb = 31 - 23 / 2 + 5.5  # centre of B's left cap
    top = (24, 18.5)
    bot = (24, 29.5)
    # find the true crossings numerically
    sa, sb = sample(A, 0.05), sample(B, 0.05)
    crosses = []
    for p in sa:
        q = min(sb, key=lambda s: math.dist(s, p))
        if math.dist(p, q) < 0.08:
            if not any(math.dist(p, c) < 2 for c in crosses):
                crosses.append(p)
    crosses.sort(key=lambda p: p[1])
    top, bot = crosses[0], crosses[-1]
    Ap = cut(A, B, bot, radius=5)
    Bp = cut(B, A, top, radius=5)
    f = Xf(rot=-45, about=(24, 24))
    del xa, xb
    return [xf(p, f) for p in Ap + Bp]


def g_hand_off():
    """A handset with a curved transfer arrow."""
    # a handset upright in its own frame: earpiece at the top, mouthpiece at the bottom, the grip bowed left
    h = [Line((7.5, -16), (-1, -16)),
         Cubic((-1, -16), (-9.5, -16), (-9.5, 16), (-1, 16)),
         Line((-1, 16), (7.5, 16)),
         Line((7.5, 16), (7.5, 10)),
         Line((7.5, 10), (3.5, 10)),
         Cubic((3.5, 10), (-1.8, 7), (-1.8, -7), (3.5, -10)),
         Line((3.5, -10), (7.5, -10)),
         Line((7.5, -10), (7.5, -16))]
    f = Xf(rot=40, about=(0, 0), s=1.0, move=(17, 29.5))
    handset = xf(h, f)
    arc = Arc((22, 26), 16, -80, -14)
    tip = arc.p1
    a = math.radians(arc.a1)
    tx, ty = -math.sin(a), math.cos(a)  # direction of travel at the tip
    arms = []
    for s in (1, -1):
        b = math.atan2(-ty, -tx) + s * math.radians(38)
        arms.append((tip[0] + 5.2 * math.cos(b), tip[1] + 5.2 * math.sin(b)))
    head = poly(arms[0], tip, arms[1])
    return [handset, [arc], head]

def g_field_notes():
    """A notebook with a pin."""
    page = rrect(11, 6, 40, 42, 2.5)
    loops = [poly((7, y), (15, y)) for y in (12, 18, 24, 30, 36)]
    pin = [Arc((27.5, 21), 6.5, 145, 395), Cubic((27.5 + 6.5 * math.cos(math.radians(35)), 21 + 6.5 * math.sin(math.radians(35))),
                                                  (31, 29.5), (27.5, 34), (27.5, 35.5)),
           Cubic((27.5, 35.5), (27.5, 34), (24, 29.5), (27.5 - 6.5 * math.cos(math.radians(35)), 21 + 6.5 * math.sin(math.radians(35))))]
    dot = circle((27.5, 21), 1.6)
    return [page, pin, dot] + loops


def g_by_the_book():
    """An open book with a quill."""
    left = [Cubic((24, 25), (19, 21.5), (11.5, 21), (5, 23)), Line((5, 23), (5, 41)),
            Cubic((5, 41), (11.5, 39), (19, 39.5), (24, 43))]
    right = [Cubic((24, 25), (29, 21.5), (36.5, 21), (43, 23)), Line((43, 23), (43, 41)),
             Cubic((43, 41), (36.5, 39), (29, 39.5), (24, 43))]
    spine = poly((24, 25), (24, 43))
    vane = [Cubic((29.5, 27), (30, 17.5), (35, 10.5), (41.5, 6.5)), Cubic((41.5, 6.5), (40.5, 14), (36.5, 21), (31.2, 24.4))]
    shaft = poly((26.5, 33), (37, 14.5))
    right_cut = cut(right, shaft, (28.5, 29), radius=6)
    return [left, spine, shaft] + right_cut + [vane]

def g_deans_list():
    """A laurel sprig."""
    stem = Cubic((13, 43), (13, 31), (20.5, 18), (34, 9))
    parts = [[stem]]

    def leaf(t, side, size=8.6, width=3.2, ang=38):
        p = stem.at(t)
        q = stem.at(min(1, t + 0.01))
        a = math.atan2(q[1] - p[1], q[0] - p[0]) + side * math.radians(ang)
        tip = (p[0] + size * math.cos(a), p[1] + size * math.sin(a))
        nx, ny = -math.sin(a), math.cos(a)
        m1 = (p[0] + 0.5 * size * math.cos(a) + width * nx, p[1] + 0.5 * size * math.sin(a) + width * ny)
        m2 = (p[0] + 0.5 * size * math.cos(a) - width * nx, p[1] + 0.5 * size * math.sin(a) - width * ny)
        return [Quad(p, m1, tip), Quad(tip, m2, p)]

    for t, s in ((0.22, -1), (0.30, 1), (0.47, -1), (0.55, 1), (0.72, -1), (0.80, 1)):
        parts.append(leaf(t, s))
    end = stem.p1
    parts.append(leaf(0.995, 0, size=7.5, width=2.8, ang=0))
    del end
    return parts


def g_associate():
    """A rolled diploma with a ribbon."""
    cx, cy = 24, 21
    f = Xf(rot=-30, about=(cx, cy))
    L, H = 31, 12.0
    x0, x1 = cx - L / 2, cx + L / 2
    y0, y1 = cy - H / 2, cy + H / 2
    e = 4.6  # how far the round ends bulge
    body = [Line((x0, y0), (x1, y0))], [Line((x0, y1), (x1, y1))]
    end_r = [Cubic((x1, y0), (x1 + e, y0), (x1 + e, y1), (x1, y1)), Cubic((x1, y1), (x1 - e, y1), (x1 - e, y0), (x1, y0))]
    end_l = [Cubic((x0, y0), (x0 - e, y0), (x0 - e, y1), (x0, y1))]
    curl = [Arc((x1, cy), 1.5, -90, 200)]
    band = [Line((cx - 3.2, y0), (cx - 3.2, y1))], [Line((cx + 3.2, y0), (cx + 3.2, y1))]
    parts = [xf(p, f) for p in list(body) + [end_r, end_l, curl] + list(band)]
    # two short tails from under the band, forked at the ends; kept short so they read as ribbon, not legs
    k = f.pt((cx, y1))
    t1 = poly((k[0] - 1.2, k[1] + 0.8), (k[0] - 5.5, k[1] + 7.5), (k[0] - 3.2, k[1] + 6.8), (k[0] - 2.6, k[1] + 9.2))
    t2 = poly((k[0] + 1.2, k[1] + 0.8), (k[0] + 5.5, k[1] + 7.5), (k[0] + 3.2, k[1] + 6.8), (k[0] + 2.6, k[1] + 9.2))
    return parts + [t1, t2]

def g_nineteen():
    """The numeral 19 in an engraved roman."""
    one = [poly((9.5, 14.5), (15.5, 9.5), (15.5, 38.5)), poly((10, 38.5), (21, 38.5))]
    bowl = [Cubic((38.5, 18), (38.5, 12.5), (35, 9.5), (31.2, 9.5)), Cubic((31.2, 9.5), (27, 9.5), (24.5, 13), (24.5, 17.5)),
            Cubic((24.5, 17.5), (24.5, 22.5), (27.5, 25.8), (31.2, 25.8)), Cubic((31.2, 25.8), (35, 25.8), (38.5, 23), (38.5, 18))]
    tail = [Cubic((38.5, 18), (38.5, 30), (34.5, 38.5), (27, 39))]
    return one + [bowl, tail]

def g_essentials():
    """A small spark in a circle."""
    ring = circle((24, 24), 16.5)
    rays = []
    for k in range(8):
        a = math.radians(k * 45 - 90)
        r0, r1 = (4.2, 10.0) if k % 2 == 0 else (4.2, 6.8)
        rays.append(poly((24 + r0 * math.cos(a), 24 + r0 * math.sin(a)), (24 + r1 * math.cos(a), 24 + r1 * math.sin(a))))
    return [ring] + rays


def g_operator():
    """A JO monogram."""
    # the J and the O side by side on one line, a hair of clear metal between them, the J's serif
    # and hook framing the pair; interlacing them read as a b or a phi at 40 pixels, this reads JO
    jx = 16.5
    O = circle((32, 25.5), 10.5, start=0)
    J = [Line((jx, 9), (jx, 31)), Cubic((jx, 31), (jx, 38.5), (jx - 7, 40.5), (jx - 10, 34.5))]
    serif = poly((jx - 6, 9), (jx + 6, 9))
    return [O, J, serif]

# ---------- the proof medals: the visitor's build card ----------

def inside(q, ring):
    """Even-odd test of a point against a closed polygon given as points."""
    x, y = q
    hit = False
    j = len(ring) - 1
    for i in range(len(ring)):
        (xi, yi), (xj, yj) = ring[i], ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            hit = not hit
        j = i
    return hit


def runs(path, blocked):
    """Split a path into the runs where blocked(point) is false, the way cut() does."""
    out, run = [], []
    for piece in path:
        k = max(40, int(length(piece) / 0.05))
        flags = [blocked(piece.at(i / k)) for i in range(k + 1)]
        i = 0
        while i <= k:
            if flags[i]:
                if run:
                    out.append(run)
                    run = []
                i += 1
                continue
            j = i
            while j + 1 <= k and not flags[j + 1]:
                j += 1
            if j > i:
                run.append(piece.sub(i / k, j / k))
            if j < k:
                out.append(run)
                run = []
            i = j + 1
    if run:
        out.append(run)
    if len(out) > 1 and math.dist(out[-1][-1].p1, out[0][0].p0) < 1e-6:
        out[0] = out.pop() + out[0]
    return [r for r in out if r and sum(length(p) for p in r) > 2.0]


def behind(paths, shape, clear=STROKE + GAP):
    """Hide what a closed shape in front covers: the under lines stop clear of its edge, as cut() does."""
    edge = sample(shape, 0.2)
    ex = [p[0] for p in edge]
    ey = [p[1] for p in edge]

    def blocked(q):
        if inside(q, edge):
            return True
        return min(math.hypot(q[0] - a, q[1] - b) for a, b in zip(ex, ey)) < clear

    paths = paths if paths and isinstance(paths[0], list) else [paths]
    out = []
    for p in paths:
        out.extend(runs(p, blocked))
    return out


def handset():
    """The handset hand-off uses, upright in its own frame: earpiece at the top, the grip bowed left."""
    return [Line((7.5, -16), (-1, -16)),
            Cubic((-1, -16), (-9.5, -16), (-9.5, 16), (-1, 16)),
            Line((-1, 16), (7.5, 16)),
            Line((7.5, 16), (7.5, 10)),
            Line((7.5, 10), (3.5, 10)),
            Cubic((3.5, 10), (-1.8, 7), (-1.8, -7), (3.5, -10)),
            Line((3.5, -10), (7.5, -10)),
            Line((7.5, -10), (7.5, -16))]


def spark(c, r, pinch=0.16):
    """A four point spark: four concave edges meeting at points up, right, down and left."""
    x, y = c
    pts = [(x, y - r), (x + r, y), (x, y + r), (x - r, y)]
    ctl = [(x + r * pinch, y - r * pinch), (x + r * pinch, y + r * pinch), (x - r * pinch, y + r * pinch), (x - r * pinch, y - r * pinch)]
    return [Quad(pts[i], ctl[i], pts[(i + 1) % 4]) for i in range(4)]


def mirror(path, axis=24):
    """Mirror a path left to right about x = axis, keeping its direction of travel reversed so it chains."""
    out = []
    for p in reversed(path):
        if isinstance(p, Line):
            out.append(Line((2 * axis - p.p1[0], p.p1[1]), (2 * axis - p.p0[0], p.p0[1])))
        elif isinstance(p, Cubic):
            m = lambda q: (2 * axis - q[0], q[1])
            out.append(Cubic(m(p.p1), m(p.c2), m(p.c1), m(p.p0)))
        else:
            out.append(Arc((2 * axis - p.c[0], p.c[1]), p.r, 180 - p.a1, 180 - p.a0))
    return out


def g_crew():
    """A staff badge on a lanyard."""
    straps = [poly((13.5, 3.5), (22.5, 11.5)), poly((34.5, 3.5), (25.5, 11.5))]
    clip = [Line((20.5, 18.5), (20.5, 13.5)), Arc((22.5, 13.5), 2, 180, 270), Line((22.5, 11.5), (25.5, 11.5)),
            Arc((25.5, 13.5), 2, 270, 360), Line((27.5, 13.5), (27.5, 18.5))]
    card = rrect(7, 18.5, 41, 42, 3)
    head = circle((16.5, 26.2), 3.3)
    shoulders = [Cubic((10.5, 37.5), (10.5, 32.2), (22.5, 32.2), (22.5, 37.5))]
    lines = [poly((27, 26.5), (35.5, 26.5)), poly((27, 32.5), (33, 32.5))]
    return straps + [clip, card, head, shoulders] + lines


def g_payroll():
    """A pay cheque with a seal."""
    cheque = rrect(4, 12, 44, 36, 3)
    seal = circle((13, 24), 4.6)
    core = circle((13, 24), 1.0)
    payee = poly((21, 18.5), (38.5, 18.5))
    sign = [Cubic((21, 29.5), (23.5, 24.5), (26, 33), (29.5, 28.5)), Cubic((29.5, 28.5), (32.5, 24.5), (34.5, 31.5), (38.5, 27.5))]
    return [cheque, seal, core, payee, sign]

def g_help_desk():
    """A headset."""
    band = [Arc((24, 21.5), 14.5, 180, 360)]
    cups = [rrect(5, 21.5, 14, 34.5, 3.5), rrect(34, 21.5, 43, 34.5, 3.5)]
    boom = [Cubic((9.5, 34.5), (9.5, 40), (13.5, 42), (19.75, 42))]
    mic = stadium((23, 42), 6.5, 3.5)
    return [band] + cups + [boom, mic]


def g_access():
    """A keyhole on a shield."""
    right = [Cubic((24, 5.5), (28.5, 8.5), (34, 10), (39, 10)), Line((39, 10), (39, 22)), Cubic((39, 22), (39, 32.5), (32, 39.5), (24, 43))]
    shield = right + mirror(right)
    c, r = (24, 20.5), 3.6
    bow = Arc(c, r, 118, 422)
    hole = [bow, Line(bow.p1, (26.8, 30.5)), Line((26.8, 30.5), (21.2, 30.5)), Line((21.2, 30.5), bow.p0)]
    return [shield, hole]


def g_network():
    """A router with its signal."""
    box = rrect(5, 28, 43, 39, 3)
    masts = [poly((10.5, 28), (10.5, 16.5)), poly((37.5, 28), (37.5, 16.5))]
    lamps = [circle((11.5, 33.5), 0.6), circle((16.5, 33.5), 0.6)]
    vent = poly((29, 33.5), (37, 33.5))
    waves = [[Arc((24, 24), 6, 225, 315)], [Arc((24, 24), 12, 225, 315)]]
    point = circle((24, 23.2), 0.6)
    return [box] + masts + lamps + [vent] + waves + [point]


def g_built_not_bought():
    """A claw hammer and a spark."""
    f = Xf(rot=45, about=(0, 0), move=(29, 19))
    # the head: a square face on the right, the claw tapering to a split on the left
    head = [Line((-2.5, -3.5), (8, -3.5)), Arc((8, -5.5), 2, 90, 0), Line((10, -5.5), (10, -9)), Arc((8, -9), 2, 0, -90),
            Line((8, -11), (-2.5, -11)), Cubic((-2.5, -11), (-6.5, -11), (-9.5, -9.5), (-12, -6)),
            Cubic((-12, -6), (-8.5, -6.5), (-5.5, -5), (-2.5, -3.5))]
    grip = poly((0, -3.5), (0, 21))
    return [xf(head, f), xf(grip, f), spark((12.5, 14.5), 7), spark((36, 36), 3.6)]

def g_on_the_line():
    """A handset and a speech bubble."""
    phone = xf(handset(), Xf(rot=-45, about=(0, 0), s=0.85, move=(16.5, 31.5)))
    bubble = [Line((31, 21.5), (39.5, 21.5)), Arc((39.5, 18), 3.5, 90, 0), Line((43, 18), (43, 9.5)), Arc((39.5, 9.5), 3.5, 0, -90),
              Line((39.5, 6), (26.5, 6)), Arc((26.5, 9.5), 3.5, 270, 180), Line((23, 9.5), (23, 18)), Arc((26.5, 18), 3.5, 180, 90),
              Line((26.5, 21.5), (24.5, 26.5)), Line((24.5, 26.5), (31, 21.5))]
    lines = [poly((28, 11.5), (38, 11.5)), poly((28, 16.5), (34, 16.5))]
    return [phone, bubble] + lines


def g_handshake():
    """Two hands clasped between two cuffs."""
    cuffs = [rrect(3, 18, 9, 32, 1.5), rrect(39, 18, 45, 32, 1.5)]
    # the right hand reaches in from its cuff: its knuckles run under the thumb, its heel under the fingertips
    back = [poly((39, 20), (30, 18.5)), poly((39, 30), (31.5, 31.5))]
    # the left hand: its thumb laid across the right hand, its fingers curled down over it, sharing their sides
    thumb = [Cubic((9, 20), (12.5, 16.5), (17, 15.5), (21, 15.5)), Line((21, 15.5), (27.5, 15.5)), Arc((27.5, 18), 2.5, 270, 450),
             Line((27.5, 20.5), (21.5, 20.5))]
    root, theta, w = (14.2, 26.2), 58, 5.2
    e = (math.cos(math.radians(theta)), math.sin(math.radians(theta)))
    q = (e[1], -e[0])  # along the knuckles, up and to the right
    fingers = []
    for i, L in enumerate((8.0, 9.5, 8.5)):
        c = (root[0] + q[0] * w * i, root[1] + q[1] * w * i)
        a0 = (c[0] - q[0] * w / 2, c[1] - q[1] * w / 2)
        b0 = (c[0] + q[0] * w / 2, c[1] + q[1] * w / 2)
        tip = (c[0] + e[0] * L, c[1] + e[1] * L)
        fingers.append([Line(b0, (b0[0] + e[0] * L, b0[1] + e[1] * L)), Arc(tip, w / 2, theta - 90, theta + 90),
                        Line((a0[0] + e[0] * L, a0[1] + e[1] * L), a0)])
    first = (root[0] - q[0] * w / 2, root[1] - q[1] * w / 2)
    heel = [Cubic((9, 30), (10.5, 30), (11.3, first[1] + 1.5), first)]
    return [xf(q, Xf(s=0.94)) for q in cuffs + back + [thumb, heel] + fingers]

def g_filed():
    """A sheet with a notary seal, its lower corner folded up."""
    sheet = [Line((26, 43), (9.5, 43)), Arc((9.5, 40.5), 2.5, 90, 180), Line((7, 40.5), (7, 7.5)), Arc((9.5, 7.5), 2.5, 180, 270),
             Line((9.5, 5), (35.5, 5)), Arc((35.5, 7.5), 2.5, 270, 360), Line((38, 7.5), (38, 31)), Line((38, 31), (26, 43))]
    flap = poly((38, 31), (28, 33), (26, 43))
    seal_c = (22.5, 17.5)
    k = 14
    rosette = [Arc(seal_c, 6.6, 0, 1)]
    pts = []
    for i in range(k * 12 + 1):
        a = 2 * math.pi * i / (k * 12)
        rr = 6.4 + 0.75 * math.cos(k * a)
        pts.append((seal_c[0] + rr * math.cos(a), seal_c[1] + rr * math.sin(a)))
    rosette = poly(*pts)
    core = circle(seal_c, 2.2)
    lines = [poly((12, 31.5), (22, 31.5)), poly((12, 37), (19, 37))]
    return [sheet, flap, rosette, core] + lines

def g_deal_jacket():
    """A file folder with a pen nib on it."""
    folder = [Line((5, 38.5), (5, 12.5)), Arc((7.5, 12.5), 2.5, 180, 270), Line((7.5, 10), (15.5, 10)), Line((15.5, 10), (18.5, 13.5)),
              Line((18.5, 13.5), (40.5, 13.5)), Arc((40.5, 16), 2.5, 270, 360), Line((43, 16), (43, 38.5)), Arc((40.5, 38.5), 2.5, 0, 90),
              Line((40.5, 41), (7.5, 41)), Arc((7.5, 38.5), 2.5, 90, 180)]
    cover = poly((5, 19.5), (43, 19.5))
    f = Xf(rot=45, about=(0, 0), s=1.15, move=(34, 32))
    nib = xf([Cubic((0, 10), (2.5, 6.5), (5.5, 3), (5.5, -1)), Line((5.5, -1), (4, -8)), Line((4, -8), (-4, -8)), Line((-4, -8), (-5.5, -1)),
              Cubic((-5.5, -1), (-5.5, 3), (-2.5, 6.5), (0, 10))], f)
    hole = xf(circle((0, -1.5), 1.3), f)
    slit = xf(poly((0, 1.5), (0, 5)), f)
    return behind([folder, cover], nib) + [nib, hole, slit]


def g_in_order():
    """A card file: two tabbed cards standing in a tray, a check on its face."""
    tray = rrect(6, 26, 42, 43, 3)
    back = [Line((9.5, 18), (9.5, 9.5)), Line((9.5, 9.5), (28.5, 9.5)), Line((28.5, 9.5), (28.5, 6)), Line((28.5, 6), (38.5, 6)),
            Line((38.5, 6), (38.5, 18))]
    front = [Line((9.5, 26), (9.5, 18)), Line((9.5, 18), (13, 18)), Line((13, 18), (13, 14.5)), Line((13, 14.5), (23, 14.5)),
             Line((23, 14.5), (23, 18)), Line((23, 18), (38.5, 18)), Line((38.5, 18), (38.5, 26))]
    check = poly((18.5, 35), (22, 38.5), (29, 31.5))
    return [tray, back, front, check]


def g_collections():
    """A calendar leaf and a coin."""
    cc, cr = (33.5, 33.5), 9.0
    keep = cr + STROKE + GAP
    leaf = rrect(5, 9, 33, 37, 3)
    head = poly((5, 16.5), (33, 16.5))
    rings = [poly((12, 5), (12, 12.5)), poly((26, 5), (26, 12.5))]
    out = keepout(leaf, cc, keep) + keepout(head, cc, keep)
    coin = circle(cc, cr)
    face = circle(cc, 4.5)
    return out + rings + [coin, face]


def g_data_model():
    """Three tables joined by their keys."""
    a = rrect(5, 5, 21, 15, 2.5)
    b = rrect(27, 19, 43, 29, 2.5)
    c = rrect(5, 33, 21, 43, 2.5)
    j1 = poly((21, 10), (35, 10), (35, 19))
    j2 = poly((35, 29), (35, 38), (21, 38))
    return [xf(q, Xf(s=0.94)) for q in (a, b, c, j1, j2)]


def g_shipped():
    """An arrow leaving the top of an open triangle."""
    base = poly((19.5, 23), (8, 41.5), (40, 41.5), (28.5, 23))
    shaft = poly((24, 36), (24, 5.5))
    head = poly((17.5, 12), (24, 5.5), (30.5, 12))
    return [base, shaft, head]


def g_every_form():
    """A licence card in the scanner's corners, the forms it fills stacked behind."""
    back = rrect(21, 4.5, 42, 27, 2)
    front = rrect(16.5, 9, 37.5, 31.5, 2)
    rows = [poly((21, 14.5), (33, 14.5)), poly((21, 19.5), (29, 19.5))]
    card = rrect(7.5, 24.5, 30.5, 40.5, 2.5)
    forms = behind(behind(back, front) + [front] + rows, card)
    photo = rrect(11.5, 28.5, 17.5, 34.5, 1.5)
    lines = [poly((21.5, 30), (26.5, 30)), poly((21.5, 34.5), (23, 34.5))]
    corners = [poly((3, 26.5), (3, 20.5), (9, 20.5)), poly((3, 38.5), (3, 44.5), (9, 44.5)), poly((35, 38.5), (35, 44.5), (29, 44.5))]
    return [xf(q, Xf(s=0.88)) for q in forms + [card, photo] + lines + corners]

def g_neuron():
    """A neuron: the cell body, its forked dendrites, the axon and its terminals."""
    c, r = (18, 19), 5.2

    def rim(a):
        t = math.radians(a)
        return (c[0] + r * math.cos(t), c[1] + r * math.sin(t))

    def fork(a, l1, l2, spread):
        p = rim(a)
        t = math.radians(a)
        q = (p[0] + l1 * math.cos(t), p[1] + l1 * math.sin(t))
        arms = [poly(q, (q[0] + l2 * math.cos(t + s * math.radians(spread)), q[1] + l2 * math.sin(t + s * math.radians(spread))))
                for s in (-1, 1)]
        return [poly(p, q)] + arms

    dendrites = fork(270, 6, 5, 30) + fork(195, 4.5, 4.5, 32) + fork(140, 4.5, 4.0, 32) + fork(330, 4.0, 4.0, 32)
    axon = [Cubic(rim(50), (24, 28), (28, 31), (33.5, 34.5))]
    ends = [(42, 35), (35, 43), (40.5, 41)]
    terminals = [poly((33.5, 34.5), e) for e in ends] + [circle(e, 0.7) for e in ends]
    return [circle(c, r), circle(c, 1.0)] + dendrites + [axon] + terminals

GLYPHS = {
    "fifty-three": g_fifty_three, "proceeds": g_proceeds, "keys-to-the-lot": g_keys_to_the_lot,
    "title-run": g_title_run, "daily-driver": g_daily_driver, "locked-rows": g_locked_rows,
    "clean-books": g_clean_books, "nothing-lost": g_nothing_lost, "booked": g_booked,
    "matched": g_matched, "hand-off": g_hand_off, "field-notes": g_field_notes,
    "by-the-book": g_by_the_book, "deans-list": g_deans_list, "associate": g_associate,
    "nineteen": g_nineteen, "essentials": g_essentials, "operator": g_operator,
}

# the proof medals for the visitor's build card: not trophies, struck on their own (medals.py --proofs)
PROOFS = {
    "crew": g_crew, "payroll": g_payroll, "help-desk": g_help_desk, "access": g_access, "network": g_network,
    "built-not-bought": g_built_not_bought, "on-the-line": g_on_the_line, "handshake": g_handshake, "filed": g_filed,
    "deal-jacket": g_deal_jacket, "in-order": g_in_order, "collections": g_collections, "data-model": g_data_model,
    "shipped": g_shipped, "every-form": g_every_form, "neuron": g_neuron,
}
GLYPHS.update(PROOFS)


def to_svg(slug, paths):
    ds = []
    for p in paths:
        if not p:
            continue
        d = "M%s %s" % (n(p[0].p0[0]), n(p[0].p0[1]))
        for piece in p:
            d += " " + piece.svg()
        if math.dist(p[-1].p1, p[0].p0) < 1e-4 and len(p) > 1 or (len(p) == 1 and isinstance(p[0], Arc) and abs(p[0].a1 - p[0].a0) >= 359.9):
            d += " Z"
        ds.append(d)
    body = "\n".join('  <path d="%s"/>' % d for d in ds)
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" fill="none" stroke="currentColor" '
            'stroke-width="%s" stroke-linecap="round" stroke-linejoin="round" data-glyph="%s">\n%s\n</svg>\n'
            % (GRID, GRID, GRID, GRID, n(STROKE), slug, body))


# nudges that put each glyph's mass on the medal's centre
OFFSETS = {
    "fifty-three": (0.9, 1.8), "keys-to-the-lot": (-1.8, 0), "title-run": (0, -1.2), "daily-driver": (0, 2.4),
    "hand-off": (1.6, -3.6), "deans-list": (-1.5, 0.5), "associate": (0, 2.0), "field-notes": (0.5, 0),
    "operator": (-0.2, 0.5), "locked-rows": (0, -1.6), "proceeds": (0, -1.0),
    # the proof medals
    "crew": (0.4, -0.8), "help-desk": (0.5, -1.2), "network": (0, -2.4), "built-not-bought": (-1.0, 2.4),
    "on-the-line": (-0.5, 0.6), "handshake": (0, -1.0), "filed": (1.5, 0), "deal-jacket": (-0.4, -1.4),
    "in-order": (0, -0.7), "shipped": (0, -2.0), "every-form": (1.6, -0.9), "neuron": (1.0, 0.6), "data-model": (0.6, 0),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    only = set()
    for arg in sys.argv[1:]:
        if arg == "--proofs":
            only |= set(PROOFS)
        else:
            only |= {s for s in arg.split(",") if s}
    unknown = sorted(only - set(GLYPHS))
    if unknown:
        sys.exit("medal_glyphs.py: no glyph named %s" % ", ".join(unknown))
    for slug, fn in GLYPHS.items():
        if only and slug not in only:
            continue
        with open(os.path.join(OUT, slug + ".svg"), "w") as fh:
            paths = fn()
            if slug in OFFSETS:
                paths = [xf(p, Xf(move=OFFSETS[slug])) for p in paths]
            fh.write(to_svg(slug, paths))
    print("wrote", len(only or GLYPHS), "glyphs to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
