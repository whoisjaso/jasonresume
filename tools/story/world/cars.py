# After Hours: the lot's cars, modelled in headless Blender from side, plan and
# section profiles (no third-party mesh; every car is first-party geometry).
#
#   blender -b --python tools/story/world/cars.py -- <outdir> [kind ...]
#
# Each car is one lofted body (stations along the length, a fixed-topology section
# at each: rocker, door, shoulder, glass, roof rail, roof), smoothed with one level
# of subdivision, the wheel wells cut with exact booleans, and the glass, pillars,
# bumpers and rocker assigned by where each face sits in the loft. Lamps, grille,
# plates, mirrors and handles are patches shrink-wrapped onto the body; wheels are
# lathed (tyre with sidewall and tread, a five or six spoke rim, the brake disc).
# Ambient occlusion is baked into a colour attribute with Cycles. Materials are
# named by role (paint, glass, trim, chrome, tire, rim, disc, well, lamp_head,
# lamp_tail, lamp_amber, plate, interior) so story/world.js can paint them; the
# paint colour is per instance. Then tools/story/world/pack.mjs compresses them.
import bpy, bmesh, sys, os, math
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "/tmp/cars"
ONLY = set(argv[1:])
os.makedirs(OUT, exist_ok=True)

def cr(pts, x):
    """Catmull-Rom through (x, y) key points, clamped, sampled at x."""
    if x <= pts[0][0]: return pts[0][1]
    if x >= pts[-1][0]: return pts[-1][1]
    for i in range(len(pts) - 1):
        if pts[i][0] <= x <= pts[i + 1][0]: break
    p0 = pts[max(i - 1, 0)]; p1 = pts[i]; p2 = pts[i + 1]; p3 = pts[min(i + 2, len(pts) - 1)]
    t = (x - p1[0]) / max(p2[0] - p1[0], 1e-6)
    # monotone-ish cubic Hermite with Catmull-Rom tangents scaled to the interval
    def tan(a, b, c):
        return (c[1] - a[1]) / max(c[0] - a[0], 1e-6) * (p2[0] - p1[0])
    m1 = tan(p0, p1, p2); m2 = tan(p1, p2, p3)
    t2, t3 = t * t, t * t * t
    return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2

def smooth01(a, b, x):
    t = min(max((x - a) / (b - a), 0.0), 1.0); return t * t * (3 - 2 * t)

# ---------------------------------------------------------------------------------
# The cars. x runs from the front bumper (0) to the rear (L); z is up; y is across.
#   top: the side profile's upper line; belt: the beltline (top of the doors);
#   bot: the underside; hw: plan half width; gw: the greenhouse's half width at the top;
#   cab: [windshield base, roof start, roof end, backlight base]; wheels: axle x's;
#   pillars: B (and C) pillar centres on the side glass; rw: rim radius, tr: tyre radius.
# ---------------------------------------------------------------------------------
KINDS = {
  "sedan": dict(L=4.82, W=1.84, tr=0.335, tw=0.225, rw=0.23, spokes=5, axles=[0.98, 3.80], arch=0.36,
    top=[(0, 0.64), (0.05, 0.76), (0.22, 0.835), (0.7, 0.885), (1.55, 0.94), (2.0, 1.22), (2.35, 1.40), (2.75, 1.455), (3.25, 1.44), (3.65, 1.30), (4.02, 1.04), (4.45, 1.015), (4.70, 0.97), (4.80, 0.82), (4.82, 0.62)],
    belt=[(0, 0.62), (0.5, 0.80), (1.5, 0.90), (3.0, 0.95), (4.0, 1.0), (4.82, 0.96)],
    bot=[(0, 0.33), (0.35, 0.24), (0.9, 0.19), (3.9, 0.19), (4.4, 0.25), (4.82, 0.36)],
    hw=[(0, 0.74), (0.07, 0.845), (0.25, 0.895), (0.7, 0.915), (2.4, 0.92), (4.2, 0.915), (4.6, 0.88), (4.76, 0.80), (4.82, 0.70)],
    gw=[(1.5, 0.80), (2.3, 0.66), (3.3, 0.66), (4.0, 0.80)], cab=[1.55, 2.38, 3.30, 4.02], sg=[1.72, 3.62], pillars=[2.93], crown=0.035, hood=0.025),
  "compact": dict(L=4.45, W=1.76, tr=0.315, tw=0.205, rw=0.215, spokes=6, axles=[0.92, 3.55], arch=0.365,
    top=[(0, 0.62), (0.05, 0.74), (0.2, 0.81), (0.6, 0.86), (1.42, 0.92), (1.85, 1.20), (2.2, 1.40), (2.6, 1.445), (3.05, 1.425), (3.4, 1.28), (3.72, 1.04), (4.1, 1.01), (4.36, 0.96), (4.44, 0.80), (4.45, 0.60)],
    belt=[(0, 0.60), (0.5, 0.79), (1.45, 0.89), (3.0, 0.95), (3.75, 0.99), (4.45, 0.95)],
    bot=[(0, 0.32), (0.3, 0.24), (0.85, 0.19), (3.6, 0.19), (4.1, 0.25), (4.45, 0.35)],
    hw=[(0, 0.71), (0.07, 0.81), (0.25, 0.86), (0.6, 0.875), (2.2, 0.88), (3.9, 0.875), (4.25, 0.84), (4.4, 0.76), (4.45, 0.67)],
    gw=[(1.4, 0.76), (2.2, 0.63), (3.1, 0.63), (3.72, 0.76)], cab=[1.42, 2.22, 3.10, 3.72], sg=[1.6, 3.38], pillars=[2.70], crown=0.03, hood=0.022),
  "hatch": dict(L=4.15, W=1.76, tr=0.31, tw=0.205, rw=0.21, spokes=5, axles=[0.86, 3.43], arch=0.385,
    top=[(0, 0.64), (0.05, 0.76), (0.2, 0.83), (0.55, 0.89), (1.25, 0.96), (1.7, 1.24), (2.05, 1.45), (2.5, 1.50), (3.3, 1.485), (3.75, 1.43), (3.98, 1.32), (4.08, 1.10), (4.13, 0.95), (4.15, 0.62)],
    belt=[(0, 0.62), (0.5, 0.82), (1.3, 0.92), (3.2, 0.99), (3.9, 1.02), (4.15, 0.98)],
    bot=[(0, 0.32), (0.3, 0.24), (0.8, 0.19), (3.4, 0.19), (3.85, 0.26), (4.15, 0.38)],
    hw=[(0, 0.71), (0.07, 0.815), (0.25, 0.865), (0.6, 0.88), (2.2, 0.885), (3.7, 0.88), (4.0, 0.85), (4.12, 0.78), (4.15, 0.70)],
    gw=[(1.25, 0.77), (2.05, 0.66), (3.6, 0.66), (4.0, 0.74)], cab=[1.27, 2.05, 3.62, 4.08], sg=[1.44, 3.80], pillars=[2.62, 3.42], crown=0.03, hood=0.022),
  "suv": dict(L=4.85, W=1.93, tr=0.37, tw=0.245, rw=0.245, spokes=6, axles=[1.0, 3.83], arch=0.425,
    top=[(0, 0.86), (0.05, 0.99), (0.25, 1.06), (0.7, 1.10), (1.42, 1.14), (1.85, 1.48), (2.2, 1.70), (2.7, 1.75), (4.2, 1.74), (4.62, 1.70), (4.78, 1.55), (4.84, 1.20), (4.85, 0.78)],
    belt=[(0, 0.88), (0.5, 1.04), (1.4, 1.10), (3.5, 1.12), (4.6, 1.15), (4.85, 1.12)],
    bot=[(0, 0.44), (0.4, 0.34), (0.95, 0.27), (3.9, 0.27), (4.4, 0.34), (4.85, 0.46)],
    hw=[(0, 0.80), (0.08, 0.90), (0.28, 0.95), (0.7, 0.965), (2.4, 0.97), (4.3, 0.965), (4.66, 0.94), (4.80, 0.88), (4.85, 0.80)],
    gw=[(1.4, 0.84), (2.2, 0.73), (4.5, 0.73), (4.8, 0.80)], cab=[1.45, 2.22, 4.55, 4.82], sg=[1.62, 4.55], pillars=[2.95, 3.95], crown=0.03, hood=0.03),
  "truck": dict(L=5.75, W=2.0, tr=0.39, tw=0.255, rw=0.255, spokes=6, axles=[1.05, 4.62], arch=0.445, bed=[3.35, 5.62],
    top=[(0, 0.98), (0.05, 1.12), (0.3, 1.19), (0.9, 1.21), (1.75, 1.245), (2.15, 1.58), (2.45, 1.86), (2.75, 1.91), (3.15, 1.905), (3.28, 1.86), (3.32, 1.22), (3.4, 1.23), (5.6, 1.24), (5.72, 1.20), (5.75, 0.90)],
    belt=[(0, 1.0), (0.5, 1.16), (1.75, 1.22), (3.3, 1.22), (5.75, 1.22)],
    bot=[(0, 0.50), (0.45, 0.40), (1.0, 0.33), (5.2, 0.36), (5.75, 0.50)],
    hw=[(0, 0.92), (0.08, 0.975), (0.3, 0.995), (0.8, 1.0), (5.5, 1.0), (5.70, 0.98), (5.75, 0.95)],
    gw=[(1.75, 0.88), (2.5, 0.78), (3.2, 0.78), (3.3, 0.86)], cab=[1.78, 2.5, 3.18, 3.30], sg=[1.95, 3.18], pillars=[2.90], crown=0.025, hood=0.03)
}

# section roles: 0 bottom centre .. 13 roof centre (one side; mirrored for the other)
SEC = 14
def section(K, x):
    hw = cr(K["hw"], x); zb = cr(K["bot"], x); zbelt = cr(K["belt"], x); zt = cr(K["top"], x)
    zt = max(zt, zbelt + 0.01)
    c0, c1, c2, c3 = K["cab"]
    incab = smooth01(c0 - 0.05, c0 + 0.25, x) * (1 - smooth01(c3 - 0.25, c3 + 0.05, x))
    gw_cab = cr(K["gw"], min(max(x, K["gw"][0][0]), K["gw"][-1][0]))
    gw = hw * 0.80 * (1 - incab) + gw_cab * incab
    gw = min(gw, hw * 0.93)
    crown = K["crown"] if incab > 0.5 else K["hood"]
    h = zbelt - zb
    pts = [
        (0.0, zb + 0.015),
        (hw * 0.80, zb),
        (hw * 0.955, zb + 0.035),
        (hw * 0.99, zb + 0.10),
        (hw * 1.0, zb + h * 0.38),          # widest: the door's swell
        (hw * 0.993, zb + h * 0.70),
        (hw * 0.975, zbelt - 0.03),          # shoulder crease
        (hw * 0.955, zbelt),                 # beltline (glass starts above)
    ]
    # upper: tumblehome from the belt to the roof rail, then the crowned roof (or hood/deck)
    gx0, gz0 = hw * 0.94, zbelt + 0.012
    gx1, gz1 = gw + 0.025, zt - 0.05 * min(1, (zt - zbelt) / 0.3)
    for t in (0.0, 0.5, 1.0):
        pts.append((gx0 + (gx1 - gx0) * t, gz0 + (gz1 - gz0) * t))
    pts.append((gw - 0.01, zt - 0.004))                 # roof rail
    pts.append((gw * 0.5, zt + crown * 0.75))
    pts.append((0.0, zt + crown))
    return pts

def stations(K):
    L = K["L"]; xs = []
    # dense at the ends (the rounded nose and tail), even in the middle
    n_end = 7
    for i in range(n_end): xs.append(L * 0.06 * (1 - math.cos(i / n_end * math.pi / 2)))
    x = L * 0.06
    while x < L * 0.94: xs.append(x); x += 0.075
    for i in range(n_end + 1): xs.append(L - L * 0.06 * (1 - math.cos((n_end - i) / n_end * math.pi / 2)))
    # add stations exactly on the cab marks and pillars so material borders follow edge loops
    marks = list(K["cab"]) + [p + d for p in K["pillars"] for d in (-0.05, 0.05)] + [a + d * K["arch"] for a in K["axles"] for d in (-1, 1)]
    if "bed" in K: marks += [K["bed"][0], K["bed"][1]]
    xs = sorted(set([round(v, 4) for v in xs + marks]))
    out = [xs[0]]
    for v in xs[1:]:
        if v - out[-1] > 0.012: out.append(v)
    return out

def mat(name, col=(0.5, 0.5, 0.5, 1), metal=0.0, rough=0.5, emit=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = col; b.inputs["Metallic"].default_value = metal; b.inputs["Roughness"].default_value = rough
    if emit: b.inputs["Emission Color"].default_value = emit; b.inputs["Emission Strength"].default_value = 1.0
    return m

MATS = None
def mats():
    global MATS
    if MATS: return MATS
    MATS = {
        "paint": mat("paint", (0.6, 0.6, 0.6, 1), 0.0, 0.3), "glass": mat("glass", (0.02, 0.025, 0.03, 1), 0.0, 0.05),
        "trim": mat("trim", (0.03, 0.03, 0.03, 1), 0.0, 0.6), "chrome": mat("chrome", (0.8, 0.8, 0.8, 1), 1.0, 0.15),
        "tire": mat("tire", (0.025, 0.025, 0.025, 1), 0.0, 0.85), "rim": mat("rim", (0.55, 0.56, 0.58, 1), 1.0, 0.3),
        "disc": mat("disc", (0.25, 0.24, 0.23, 1), 1.0, 0.55), "well": mat("well", (0.01, 0.01, 0.01, 1), 0.0, 0.9),
        "lamp_head": mat("lamp_head", (0.8, 0.82, 0.85, 1), 0.0, 0.05), "lamp_tail": mat("lamp_tail", (0.5, 0.02, 0.02, 1), 0.0, 0.1),
        "lamp_tail_in": mat("lamp_tail_in", (0.9, 0.08, 0.05, 1), 0.0, 0.2), "lamp_head_in": mat("lamp_head_in", (0.95, 0.95, 0.9, 1), 0.0, 0.2),
        "lamp_amber": mat("lamp_amber", (0.8, 0.35, 0.02, 1), 0.0, 0.1), "plate": mat("plate", (0.85, 0.83, 0.78, 1), 0.0, 0.5),
        "interior": mat("interior", (0.02, 0.02, 0.02, 1), 0.0, 0.8),
    }
    return MATS

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    global MATS; MATS = None

def link(obj):
    bpy.context.scene.collection.objects.link(obj); return obj

def body(K, name):
    xs = stations(K); M = mats()
    bm = bmesh.new()
    rings = []
    for x in xs:
        sec = section(K, x)
        # full loop: right side bottom->top (y = +), then left side top->bottom (y = -), centre points shared
        loop = [(x, s[0], s[1]) for s in sec] + [(x, -s[0], s[1]) for s in reversed(sec[1:-1])]
        rings.append([bm.verts.new(Vector((-p[1], -p[0], p[2]))) for p in loop])   # Blender: front at -Y
    n = len(rings[0])
    # faces between rings; remember (station i, section j) for each face to assign materials
    tags = {}
    for i in range(len(rings) - 1):
        for j in range(n):
            a, b2 = rings[i][j], rings[i][(j + 1) % n]; c, d = rings[i + 1][(j + 1) % n], rings[i + 1][j]
            f = bm.faces.new((a, d, c, b2))
            # the band between section points k and k+1, the same index on both sides
            band = j if j < SEC - 1 else (SEC - 2 if j == SEC - 1 else 2 * SEC - 3 - j)
            tags[f] = (i, band)
    # caps: fan the first and last rings onto a centre
    for ring, flip in ((rings[0], False), (rings[-1], True)):
        cz = sum(v.co.z for v in ring) / n; cx = sum(v.co.x for v in ring) / n; cy = ring[0].co.y
        ctr = bm.verts.new(Vector((cx, cy, cz)))
        for j in range(n):
            vs = (ring[j], ring[(j + 1) % n], ctr)
            f = bm.faces.new(vs if not flip else tuple(reversed(vs))); tags[f] = ("cap", 0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # crease: the first and last rings (the bumpers' faces) and the shoulder line keep an edge through the smoothing
    cl = bm.edges.layers.float.get("crease_edge") or bm.edges.layers.float.new("crease_edge")
    ringset = [set(rings[0]), set(rings[1]), set(rings[-1]), set(rings[-2])]
    for e in bm.edges:
        a, b2 = e.verts
        if any(a in rs and b2 in rs for rs in ringset): e[cl] = 0.55
    for i in range(len(rings) - 1):
        for j in (6, 7, 2 * SEC - 3 - 6 + 1, 2 * SEC - 3 - 7 + 1):
            for e in rings[i][j].link_edges:
                if e.other_vert(rings[i][j]) is rings[i + 1][j]: e[cl] = 0.45
    me = bpy.data.meshes.new(name); bm.to_mesh(me)
    # material slots and per-face assignment from the loft tags
    order = ["paint", "glass", "trim", "interior"]
    for k in order: me.materials.append(M[k])
    c0, c1, c2, c3 = K["cab"]
    polys = list(me.polygons)
    tag_list = [tags[f] for f in bm.faces]
    for p, tg in zip(polys, tag_list):
        mi = 0
        if tg[0] == "cap":
            mi = 0
        else:
            i, j = tg; x0, x1 = xs[i], xs[i + 1]; xm = (x0 + x1) / 2
            zc = p.center.z
            inside = c0 - 0.001 <= xm <= c3 + 0.001
            s0, s1 = K["sg"]
            if j in (8, 9) and s0 <= xm <= s1:               # side glass band
                mi = 1
                for pc in K["pillars"]:
                    if abs(xm - pc) < 0.05: mi = 2           # B and C pillars, black
            elif j in (11, 12) and inside and (xm < c1 - 0.02 or xm > c2 + 0.02):
                mi = 1                                       # windshield and backlight
                if "bed" in K and xm > c2 + 0.02: mi = 1
            elif j in (0, 1):
                mi = 2                                       # underside and lower rocker: black plastic
            elif j == 2 and (xm < 0.45 or xm > K["L"] - 0.45):
                mi = 2                                       # bumper lips
        p.material_index = mi
    bm.free()
    ob = link(bpy.data.objects.new(name, me))
    # one level of smoothing keeps the silhouette soft without the poly count
    sub = ob.modifiers.new("sub", "SUBSURF"); sub.levels = 1; sub.render_levels = 1
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.modifier_apply(modifier="sub")
    # wheel wells: exact boolean with a cylinder per axle (wider than the car, so both sides cut)
    for ax in K["axles"]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=K["arch"], depth=K["W"] * 0.5, location=(K["W"] * 0.5, -ax, K["tr"] + 0.005), rotation=(0, math.pi / 2, 0))
        cR = bpy.context.active_object
        bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=K["arch"], depth=K["W"] * 0.5, location=(-K["W"] * 0.5, -ax, K["tr"] + 0.005), rotation=(0, math.pi / 2, 0))
        cL = bpy.context.active_object
        for c in (cR, cL):
            c.data.materials.append(M["well"])
            bpy.context.view_layer.objects.active = ob
            mod = ob.modifiers.new("arch", "BOOLEAN"); mod.operation = "DIFFERENCE"; mod.object = c; mod.solver = "EXACT"
            mod.material_mode = "TRANSFER"
            bpy.ops.object.modifier_apply(modifier="arch")
            bpy.data.objects.remove(c)
    # a pickup's bed: hollow it out
    if "bed" in K:
        b0, b1 = K["bed"]; depth = 0.52
        top = cr(K["top"], (b0 + b1) / 2)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -(b0 + b1) / 2 - 0.02, top - depth / 2 + 0.3))
        cut = bpy.context.active_object; cut.scale = (K["W"] - 0.16, (b1 - b0) - 0.12, depth + 0.6)
        cut.data.materials.append(M["trim"])
        bpy.context.view_layer.objects.active = ob
        mod = ob.modifiers.new("bed", "BOOLEAN"); mod.operation = "DIFFERENCE"; mod.object = cut; mod.solver = "EXACT"; mod.material_mode = "TRANSFER"
        bpy.ops.object.modifier_apply(modifier="bed"); bpy.data.objects.remove(cut)
    # well material where the boolean left the paint on the inner surfaces
    for p in ob.data.polygons:
        if p.material_index == 0 and abs(p.center.x) < K["W"] / 2 - 0.12 and p.center.z < K["tr"] + K["arch"] + 0.02 and any(abs(-p.center.y - a) < K["arch"] + 0.02 for a in K["axles"]):
            p.material_index = ob.data.materials.find("well") if ob.data.materials.find("well") >= 0 else 0
    bpy.ops.object.shade_smooth()
    # crisp where it should be: the glass edges and the arches
    me = ob.data
    try:
        me.set_sharp_from_angle(angle=math.radians(50))
    except Exception:
        pass
    return ob

def surface_point(ob, origin, direction):
    """cast a ray at the body, in object space; returns (location, normal) or None"""
    ok, loc, nor, idx = ob.ray_cast(Vector(origin), Vector(direction).normalized())
    return (loc, nor) if ok else None

def patch(ob, name, matname, verts2d, origin_fn, direction, offset=0.004, cols=None, rings=4):
    """a flat outline (list of (u, v) points, star-shaped about its centre) projected onto the body along a
    direction as a fan of rings, so it follows the curvature, lifted off by offset"""
    M = mats(); bm = bmesh.new()
    cu = sum(p[0] for p in verts2d) / len(verts2d); cv = sum(p[1] for p in verts2d) / len(verts2d)
    def proj(u, v):
        hit = surface_point(ob, origin_fn(u, v), direction)
        return bm.verts.new(hit[0] + hit[1] * offset) if hit else None
    ctr = proj(cu, cv)
    if ctr is None: bm.free(); return None
    grid = []
    for r in range(1, rings + 1):
        t = r / rings
        grid.append([proj(cu + (u - cu) * t, cv + (v - cv) * t) for (u, v) in verts2d])
    n = len(verts2d)
    for k in range(n):
        a, b2 = grid[0][k], grid[0][(k + 1) % n]
        if a and b2: bm.faces.new((ctr, a, b2))
        for r in range(rings - 1):
            q = (grid[r][k], grid[r + 1][k], grid[r + 1][(k + 1) % n], grid[r][(k + 1) % n])
            if all(q):
                try: bm.faces.new(q)
                except ValueError: pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # face the way the ray came from
    for f in bm.faces:
        f.normal_update()
        if f.normal.dot(Vector(direction)) > 0: f.normal_flip()
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(M[matname])
    o = link(bpy.data.objects.new(name, me))
    bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.shade_smooth(); o.select_set(False)
    return o

def outline(cx, cy, w, h, r=0.3, n=6):
    """a rounded rectangle centred at (cx, cy)"""
    pts = []; rr = min(w, h) * r
    for k, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        ccx, ccy = cx + sx * (w / 2 - rr), cy + sy * (h / 2 - rr)
        a0 = [0, math.pi / 2, math.pi, 1.5 * math.pi][k]
        for i in range(n + 1):
            a = a0 + i / n * math.pi / 2; pts.append((ccx + math.cos(a) * rr, ccy + math.sin(a) * rr))
    return pts

def details(K, ob, name):
    L, W = K["L"], K["W"]; parts = []
    zbelt_f = cr(K["belt"], 0.1); zb_f = cr(K["bot"], 0.05); zbelt_r = cr(K["belt"], L - 0.1); zb_r = cr(K["bot"], L - 0.05)
    hl_z = zb_f + (zbelt_f - zb_f) * 0.80; tl_z = zb_r + (zbelt_r - zb_r) * 0.80
    # headlights: wrap round the front corners (projected from the front, then from the side for the wrap)
    for s in (1, -1):
        cx = s * W * 0.335
        parts.append(patch(ob, "hl", "lamp_head", outline(cx, hl_z, W * 0.28, 0.15 if K["L"] < 5 else 0.19, 0.4), lambda u, v: (u, 5, v), (0, -1, 0), 0.006))
        parts.append(patch(ob, "tl", "lamp_tail", outline(s * W * 0.36, tl_z, W * 0.25 if "bed" not in K else W * 0.1, 0.13 if "bed" not in K else 0.34, 0.3), lambda u, v: (u, -L - 5, v), (0, 1, 0), 0.006))
        # tail light wrap onto the side, and the amber marker at the front corner
        # the lens's inner element: a smaller bar a hair proud of the lens, the part that lights
        parts.append(patch(ob, "tli", "lamp_tail_in", outline(s * W * 0.36, tl_z, (W * 0.25 if "bed" not in K else W * 0.1) * 0.7, (0.13 if "bed" not in K else 0.34) * 0.35, 0.5), lambda u, v: (u, -L - 5, v), (0, 1, 0), 0.009))
        parts.append(patch(ob, "hli", "lamp_head_in", outline(cx + s * W * 0.03, hl_z, W * 0.09, 0.06, 0.5), lambda u, v: (u, 5, v), (0, -1, 0), 0.009))
        parts.append(patch(ob, "tlw", "lamp_tail", outline(-(L - 0.12), tl_z, 0.16, 0.09, 0.3), lambda u, v, s=s: (s * 5, u, v), (-s, 0, 0), 0.005))
        parts.append(patch(ob, "am", "lamp_amber", outline(-0.16, hl_z - 0.02, 0.1, 0.05, 0.45), lambda u, v, s=s: (s * 5, u, v), (-s, 0, 0), 0.005))
        # side mirror: a small rounded block on a stalk at the A-pillar base
        c0 = K["cab"][0]; zb = cr(K["belt"], c0 + 0.2)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(s * (cr(K["hw"], c0 + 0.2) + 0.09), -(c0 + 0.24), zb + 0.11))
        mr = bpy.context.active_object; mr.scale = (0.19, 0.09, 0.12); mr.data.materials.append(mats()["paint"])
        bv = mr.modifiers.new("bv", "BEVEL"); bv.width = 0.03; bv.segments = 3
        bpy.context.view_layer.objects.active = mr; bpy.ops.object.modifier_apply(modifier="bv"); bpy.ops.object.shade_smooth(); parts.append(mr)
        bpy.ops.mesh.primitive_plane_add(size=1, location=(s * (cr(K["hw"], c0 + 0.2) + 0.1), -(c0 + 0.24) - 0.047, zb + 0.11), rotation=(math.pi / 2, 0, 0))
        mg = bpy.context.active_object; mg.scale = (0.15, 0.085, 1); mg.data.materials.append(mats()["chrome"]); parts.append(mg)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(s * (cr(K["hw"], c0 + 0.2) + 0.02), -(c0 + 0.22), zb + 0.06))
        st = bpy.context.active_object; st.scale = (0.08, 0.04, 0.03); st.data.materials.append(mats()["trim"]); parts.append(st)
        # door handles: one per door, on the shoulder below the belt
        doors = [K["cab"][0] + 0.55] + [p + 0.45 for p in K["pillars"][:1]]
        for dx in doors:
            zh = cr(K["belt"], dx) - 0.09
            parts.append(patch(ob, "dh", "chrome" if K.get("chrome") else "trim", outline(-dx, zh, 0.16, 0.035, 0.5), lambda u, v, s=s: (s * 5, u, v), (-s, 0, 0), 0.008))
    # grille and lower intake (front), plates front and rear
    gz = zb_f + (zbelt_f - zb_f) * 0.55
    gw = W * (0.40 if "truck" not in name and "suv" not in name else 0.55)
    parts.append(patch(ob, "gr", "trim", outline(0, gz, gw, 0.13 if "truck" not in name else 0.30, 0.25), lambda u, v: (u, 5, v), (0, -1, 0), 0.007))
    parts.append(patch(ob, "gr2", "trim", outline(0, zb_f + 0.11, W * 0.55, 0.08, 0.4), lambda u, v: (u, 5, v), (0, -1, 0), 0.006))
    parts.append(patch(ob, "pf", "plate", outline(0, zb_f + 0.21, 0.52, 0.12, 0.08), lambda u, v: (u, 5, v), (0, -1, 0), 0.011))
    parts.append(patch(ob, "pr", "plate", outline(0, zb_r + (tl_z - zb_r) * 0.55, 0.31, 0.155, 0.08), lambda u, v: (u, -L - 5, v), (0, 1, 0), 0.011))
    parts.append(patch(ob, "rb", "trim", outline(0, zb_r + 0.09, W * 0.7, 0.07, 0.4), lambda u, v: (u, -L - 5, v), (0, 1, 0), 0.006))
    # a third brake light on the roof's trailing edge and the wipers' dark line under the windshield
    c0 = K["cab"][0]
    for s in (1, -1):
        parts.append(patch(ob, "wp", "trim", [(s * 0.05, -(c0 + 0.02)), (s * 0.62, -(c0 + 0.10)), (s * 0.62, -(c0 + 0.13)), (s * 0.05, -(c0 + 0.05))], lambda u, v: (u, v, 5), (0, 0, -1), 0.012))
    return [p for p in parts if p]

def wheel(K):
    """tyre (lathed: tread, shoulders, sidewall with a bulge) + rim (dish, spokes, hub) + disc; built at the origin, axis X"""
    M = mats(); R, Wd, Rr = K["tr"], K["tw"], K["rw"]
    prof = [(Rr + 0.004, -Wd / 2 + 0.012), (Rr + 0.03, -Wd / 2), (R - 0.05, -Wd / 2 - 0.006), (R - 0.018, -Wd / 2 + 0.006), (R, -Wd / 2 + 0.03),
            (R + 0.002, 0), (R, Wd / 2 - 0.03), (R - 0.018, Wd / 2 - 0.006), (R - 0.05, Wd / 2 + 0.006), (Rr + 0.03, Wd / 2), (Rr + 0.004, Wd / 2 - 0.012)]
    def lathe(name, prof, segs, mname, closed=False):
        bm = bmesh.new(); rings = []
        for k in range(segs):
            a = k / segs * math.pi * 2
            rings.append([bm.verts.new(Vector((w, math.cos(a) * r, math.sin(a) * r))) for (r, w) in prof])
        for k in range(segs):
            r0, r1 = rings[k], rings[(k + 1) % segs]
            for j in range(len(prof) - 1): bm.faces.new((r0[j], r0[j + 1], r1[j + 1], r1[j]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(M[mname])
        o = link(bpy.data.objects.new(name, me))
        bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.shade_smooth(); o.select_set(False)
        return o
    tyre = lathe("tire", prof, 36, "tire")
    # rim: outer lip, a dish that steps in, the barrel behind
    face = Wd / 2 - 0.02
    rp = [(Rr + 0.006, face - 0.005), (Rr + 0.012, face + 0.004), (Rr - 0.006, face + 0.012), (Rr - 0.025, face + 0.002), (Rr - 0.03, face - 0.03), (Rr - 0.03, -Wd / 2 + 0.03), (Rr + 0.004, -Wd / 2 + 0.02)]
    rim = lathe("rim", rp, 36, "rim")
    # hub and centre cap
    hp = [(0.0, face - 0.002), (0.045, face - 0.004), (0.06, face - 0.02), (0.075, face - 0.045)]
    hub = lathe("hub", hp, 16, "rim")
    # spokes: tapered boxes from hub to lip, a little dished
    n = K["spokes"]; sp = []
    for k in range(n):
        a = k / n * math.pi * 2
        bm = bmesh.new()
        r0, r1 = 0.06, Rr - 0.02; w0, w1 = 0.022, 0.04; t = 0.022
        quad = []
        for (r, w, d) in ((r0, w0, face - 0.03), (r1, w1, face + 0.0)):
            for sgn in (-1, 1):
                for dz in (0, -t):
                    quad.append(Vector((d + dz, r, sgn * w)))
        vs = [bm.verts.new(q) for q in quad]
        # 0:(r0,-w,front) 1:(r0,-w,back) 2:(r0,+w,front) 3:(r0,+w,back) 4..7 same at r1
        for f in ((0, 2, 6, 4), (1, 5, 7, 3), (0, 4, 5, 1), (2, 3, 7, 6), (4, 6, 7, 5), (0, 1, 3, 2)):
            bm.faces.new([vs[i] for i in f])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bmesh.ops.rotate(bm, verts=bm.verts, cent=Vector((0, 0, 0)), matrix=Matrix.Rotation(a, 3, "X"))
        me = bpy.data.meshes.new("spoke"); bm.to_mesh(me); bm.free(); me.materials.append(M["rim"])
        sp.append(link(bpy.data.objects.new("spoke", me)))
    # brake disc behind the spokes
    dp = [(0.07, -0.02), (Rr - 0.04, -0.02), (Rr - 0.04, -0.045), (0.07, -0.045)]
    disc = lathe("disc", dp, 24, "disc")
    parts = [tyre, rim, hub, disc] + sp
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active = tyre
    bpy.ops.object.join()
    w = bpy.context.active_object; w.name = "wheel"
    return w

def build(kind):
    clear(); K = KINDS[kind]
    ob = body(K, kind)
    parts = details(K, ob, kind)
    # the interior: a dark shell under the glass so the cabin never reads as empty sky
    c0, c1, c2, c3 = K["cab"]
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -(c0 + c3) / 2, (cr(K["belt"], (c0 + c3) / 2) + cr(K["top"], (c1 + c2) / 2)) / 2 - 0.05))
    inn = bpy.context.active_object; inn.scale = (K["W"] * 0.66, (c2 - c1) + 0.6, (cr(K["top"], (c1 + c2) / 2) - cr(K["belt"], (c0 + c3) / 2)) * 0.62)
    inn.location.y = -(c1 + c2) / 2
    inn.data.materials.append(mats()["interior"])
    # headrests: silhouettes behind the side glass
    hz = cr(K["belt"], (c0 + c3) / 2) + 0.28
    for s in (1, -1):
        for dx in ([c0 + 0.95] + ([c0 + 1.85] if c3 - c0 > 2.0 else [])):
            bpy.ops.mesh.primitive_cube_add(size=1, location=(s * 0.38, -dx, hz)); hr = bpy.context.active_object; hr.scale = (0.24, 0.1, 0.2); hr.data.materials.append(mats()["interior"]); parts.append(hr)
    parts.append(inn)
    # wheels at each corner (mirrored on the left)
    wl = wheel(K)
    ws = []
    for ax in K["axles"]:
        for s in (1, -1):
            c = wl.copy(); c.data = wl.data.copy(); link(c)
            c.location = (s * (K["W"] / 2 - K["tw"] / 2 - 0.02), -ax, K["tr"])
            if s < 0: c.rotation_euler = (0, 0, math.pi)
            ws.append(c)
    bpy.data.objects.remove(wl)
    # join everything into one object (materials stay separate primitives on export)
    bpy.ops.object.select_all(action="DESELECT")
    for o in [ob] + parts + ws: o.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.join()
    car = bpy.context.active_object; car.name = kind
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # centre it and turn it so the front faces -Y in Blender (+Z in three.js after the Y-up export)
    car.location = (0, K["L"] / 2, 0); bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    car.rotation_euler = (0, 0, math.pi); bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    # ambient occlusion into a colour attribute (Cycles), plus a ground plane so the underside darkens
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0)); gp = bpy.context.active_object
    car.data.color_attributes.new("ao", "BYTE_COLOR", "POINT")
    car.data.color_attributes.active_color = car.data.color_attributes["ao"]
    sc = bpy.context.scene; sc.render.engine = "CYCLES"; sc.cycles.samples = 256; sc.cycles.device = "CPU"
    sc.render.bake.target = "VERTEX_COLORS"
    bpy.ops.object.select_all(action="DESELECT"); car.select_set(True); bpy.context.view_layer.objects.active = car
    sc.world = bpy.data.worlds.new("w")
    try:
        bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
    except Exception as e:
        print("bake failed", e)
    bpy.data.objects.remove(gp)
    car.location = (0, 0, 0)
    # the car's measurements ride along as glTF extras: story/world.js draws its panel lines from them
    car["L"] = K["L"]; car["W"] = K["W"]; car["H"] = max(p[1] for p in K["top"]); car["cab"] = K["cab"]; car["sg"] = K["sg"]
    car["pillars"] = K["pillars"]; car["axles"] = K["axles"]; car["belt"] = [cr(K["belt"], x) for x in (0.5, K["L"] / 2, K["L"] - 0.5)]
    car["tr"] = K["tr"]; car["arch"] = K["arch"]
    out = os.path.join(OUT, kind + ".glb")
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_apply=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
                              export_normals=True, export_texcoords=False, export_materials="EXPORT", export_yup=True, export_extras=True)
    tris = sum(len(p.vertices) - 2 for p in car.data.polygons)
    print("CAR", kind, "tris", tris, "->", out)

for k in KINDS:
    if ONLY and k not in ONLY: continue
    build(k)
