# After Hours: the night's two rigs, modelled in Blender (no third-party mesh; first-party geometry).
#
#   python tools/story/world/rigs.py -- <outdir>        (Blender as a module: pip install bpy)
#   blender -b --python tools/story/world/rigs.py -- <outdir>
#
# A pumper (a custom cab, the pump panel with its gauges and outlets, the body's roll-up shutters,
# the hose bed, a ladder on its rack, a deck gun, a bar on the cab roof, a chrome bumper, polished
# hubs, a reflective stripe and chevrons on the back) and a box ambulance (a van cab, the patient
# box with a real inside behind two back doors on their hinges, lights round the top of the box, a
# band, a plain six-bar cross). Nothing is written on either but the word AMBULANCE, mirrored, on
# the hood: no department, no agency, no city, no number.
#
# x runs along the rig (the front is -x), y across (+y is the kerb side), z up. Each rig is built
# twice: the near model and a phone model (no ribs, rungs, gauges or lettering, fewer segments).
# Ambient occlusion is baked into a colour attribute with Cycles, with the ground under it.
# Materials are named by role (paint_red, paint_white, stripe, band, emblem, chrome, steel, glass,
# tire, trim, hose, interior, lamp_head, lamp_tail, bar_red, bar_white) so story/world.js can paint
# them with the same surfaces as the lot's cars; bar_red and bar_white are the lights that pulse.
# The phone model folds a few roles together (FOLD), so it costs no more draws than the blocks it replaced.
# The ambulance's back doors are their own nodes (door_L, door_R), each with its origin on its hinge.
# Then tools/story/world/pack_rigs.mjs compresses them into assets/story/world/rig-<name>[-lo]-v1.glb.
import bpy, bmesh, sys, os, math
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "/tmp/rigs"
ONLY = set(argv[1:])
os.makedirs(OUT, exist_ok=True)

LO = False            # the phone model
PARTS = {}            # node name -> the objects that make it
MATS = {}

# the phone model folds the near-black and bright-metal roles together: fewer draws
FOLD = {"steel": "chrome", "hose": "paint_white", "tire": "trim", "emblem": "band"}

def M(name):
    if LO: name = FOLD.get(name, name)
    if name not in MATS:
        m = bpy.data.materials.new(name); m.use_nodes = True; MATS[name] = m
    return MATS[name]

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear(); PARTS.clear()

def emit(bm, node, mat, name="p"):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    me.materials.append(M(mat))
    PARTS.setdefault(node, []).append(ob)
    return ob

def gridcut(bm, step):
    """cut a mesh on a regular grid, so the baked shade has vertices to live on"""
    for ax in range(3):
        lo = min(v.co[ax] for v in bm.verts); hi = max(v.co[ax] for v in bm.verts)
        n = int((hi - lo) / step)
        if n < 2: continue
        no = Vector((0, 0, 0)); no[ax] = 1
        for i in range(1, n):
            co = Vector((0, 0, 0)); co[ax] = lo + (hi - lo) * i / n
            bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no, dist=1e-5)

def box(node, mat, x0, x1, y0, y1, z0, z1, bev=0.0, seg=2, grid=0.0, deform=None, name="box"):
    (x0, x1), (y0, y1), (z0, z1) = sorted((x0, x1)), sorted((y0, y1)), sorted((z0, z1))
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector(((x0 + x1) / 2 + v.co.x * (x1 - x0), (y0 + y1) / 2 + v.co.y * (y1 - y0), (z0 + z1) / 2 + v.co.z * (z1 - z0)))
    if bev > 0: bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bev, segments=1 if LO else seg, affect="EDGES", profile=0.5)
    if grid: gridcut(bm, grid * (2.0 if LO else 1.0))
    if deform:
        for v in bm.verts: v.co = deform(v.co)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return emit(bm, node, mat, name)

def cyl(node, mat, a, b, r, r2=None, seg=12, caps=True, name="cyl"):
    a, b = Vector(a), Vector(b); d = b - a
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=max(6, seg // 2) if LO else seg, radius1=r, radius2=r if r2 is None else r2, depth=d.length)
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ rot, verts=bm.verts)
    return emit(bm, node, mat, name)

def poly(node, mat, pts, n=None, name="q"):
    """one flat face through pts, facing n"""
    bm = bmesh.new(); vs = [bm.verts.new(Vector(p)) for p in pts]; f = bm.faces.new(vs); bm.normal_update()
    if n is not None and f.normal.dot(Vector(n)) < 0: f.normal_flip()
    return emit(bm, node, mat, name)

def side(node, mat, s, x0, x1, z0, z1, y, name="side"):
    """a panel on a side of the rig (s: 1 the kerb side, -1 the street side), proud of the body at |y|"""
    return poly(node, mat, [(x0, s * y, z0), (x1, s * y, z0), (x1, s * y, z1), (x0, s * y, z1)], (0, s, 0), name)

def face(node, mat, d, x, y0, y1, z0, z1, name="face"):
    """a panel across the rig, facing along x (d: -1 the front, 1 the back)"""
    return poly(node, mat, [(x, y0, z0), (x, y1, z0), (x, y1, z1), (x, y0, z1)], (d, 0, 0), name)

def frame_side(node, mat, s, x0, x1, z0, z1, y, w=0.014):
    """a shut line round a door or a locker, on a side"""
    side(node, mat, s, x0, x1, z0, z0 + w, y); side(node, mat, s, x0, x1, z1 - w, z1, y)
    side(node, mat, s, x0, x0 + w, z0, z1, y); side(node, mat, s, x1 - w, x1, z0, z1, y)

def clip(pts, a, b, c, keep_le=True):
    """clip a convex polygon in the plane (u, v) to a*u + b*v <= c (Sutherland and Hodgman)"""
    out = []
    for i in range(len(pts)):
        p, q = pts[i], pts[(i + 1) % len(pts)]
        dp, dq = a * p[0] + b * p[1] - c, a * q[0] + b * q[1] - c
        if dp <= 0: out.append(p)
        if (dp < 0) != (dq < 0) and dp != dq:
            t = dp / (dp - dq); out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out

def chevrons(node, x, y1, z0, z1, w=0.2):
    """the back's chevrons: bands that fall away from the middle, in the stripe's colour and the paint's by turns"""
    for s in (1, -1):
        rect = [(0, z0), (y1, z0), (y1, z1), (0, z1)]
        k0 = int(math.floor(z0 / w)); k1 = int(math.ceil((y1 + z1) / w))
        for k in range(k0, k1 + 1):
            p = clip(clip(rect, 1, 1, (k + 1) * w), -1, -1, -k * w)
            if len(p) < 3: continue
            poly(node, "stripe" if k % 2 else "paint_red", [(x, s * u, v) for u, v in p], (1, 0, 0), "chev")

def lathe(node, mat, cx, cy, cz, prof, s, seg=20, name="lathe"):
    """turn a profile [(radius, how far out along the axle)] round the axle at (cx, cz); s: which side is out"""
    seg = max(10, seg // 2) if LO else seg
    bm = bmesh.new(); rings = []
    for r, t in prof:
        if r < 1e-5: rings.append([bm.verts.new((cx, cy + s * t, cz))])
        else: rings.append([bm.verts.new((cx + r * math.cos(i / seg * math.tau), cy + s * t, cz + r * math.sin(i / seg * math.tau))) for i in range(seg)])
    for a, b in zip(rings, rings[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            if len(a) == 1 and len(b) == 1: continue
            if len(a) == 1: bm.faces.new((a[0], b[j], b[i]))
            elif len(b) == 1: bm.faces.new((a[i], a[j], b[0]))
            else: bm.faces.new((a[i], a[j], b[j], b[i]))
    # an open surface: face it by the profile's own direction (the outside is to the right of the way it runs)
    bm.normal_update()
    for (r0, t0), (r1, t1), ra, rb in zip(prof, prof[1:], rings, rings[1:]):
        nr, nt = t1 - t0, r0 - r1
        vs = set(ra) | set(rb)
        for f in [f for f in bm.faces if all(v in vs for v in f.verts)]:
            c = f.calc_center_median(); rad = Vector((c.x - cx, 0, c.z - cz)); rad = rad.normalized() if rad.length > 1e-6 else Vector((0, 0, 0))
            if f.normal.dot(rad * nr + Vector((0, s * nt, 0))) < 0: f.normal_flip()
    return emit(bm, node, mat, name)

def wheel(node, x, y, r, w, s, dual=False):
    """a tyre with a shoulder and a sidewall, and a polished hub: a dome with its nuts in front, a deep dish on a dual"""
    h = w / 2
    lathe(node, "tire", x, y, r, [(r * 0.56, -h), (r * 0.9, -h), (r, -h * 0.72), (r, h * 0.72), (r * 0.9, h), (r * 0.6, h * 0.92)], s, 20, "tyre")
    if dual:
        lathe(node, "chrome", x, y, r, [(r * 0.6, h * 0.92), (r * 0.52, h * 0.55), (r * 0.3, h * 0.1), (r * 0.26, h * 0.42), (0, h * 0.46)], s, 16, "hub")
        lathe(node, "trim", x, y, r, [(r * 1.004, -0.02), (r * 0.9, -0.012), (r * 0.9, 0.012), (r * 1.004, 0.02)], s, 20, "groove")
    else:
        lathe(node, "chrome", x, y, r, [(r * 0.6, h * 0.92), (r * 0.5, h * 0.8), (r * 0.36, h * 0.86), (r * 0.2, h * 1.12), (0, h * 1.16)], s, 16, "hub")
    if not LO:
        n = 10 if r > 0.45 else 8
        for i in range(n):
            a = i / n * math.tau; rr = r * (0.44 if not dual else 0.4); t = h * (0.82 if not dual else 0.3)
            p = Vector((x + rr * math.cos(a), y + s * t, r + rr * math.sin(a)))
            cyl(node, "chrome", p, p + Vector((0, s * 0.035, 0)), 0.016, seg=6, name="nut")

def join(node):
    obs = PARTS[node]
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object; o.name = node
    for p in o.data.polygons: p.use_smooth = True
    o.data.set_sharp_from_angle(angle=math.radians(38))
    PARTS[node] = [o]
    return o

def boolean(ob, cutter):
    m = ob.modifiers.new("cut", "BOOLEAN"); m.operation = "DIFFERENCE"; m.object = cutter; m.solver = "EXACT"
    bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(cutter)

def scratch_cyl(x, z, r, half):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=12 if LO else 24, radius1=r, radius2=r, depth=half * 2)
    bmesh.ops.transform(bm, matrix=Matrix.Translation((x, 0, z)) @ Matrix.Rotation(math.pi / 2, 4, "X"), verts=bm.verts)
    me = bpy.data.meshes.new("cutter"); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new("cutter", me); bpy.context.scene.collection.objects.link(ob); return ob

def scratch_box(x0, x1, y0, y1, z0, z1):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector(((x0 + x1) / 2 + v.co.x * (x1 - x0), (y0 + y1) / 2 + v.co.y * (y1 - y0), (z0 + z1) / 2 + v.co.z * (z1 - z0)))
    me = bpy.data.meshes.new("cutter"); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new("cutter", me); bpy.context.scene.collection.objects.link(ob); return ob

def arches(ob, axles, r, mat="trim"):
    """cut the wheel arches through a hull and paint what the cut leaves dark"""
    for x, z in axles: boolean(ob, scratch_cyl(x, z, r, 3.0))
    ob.data.materials.append(M(mat)); k = len(ob.data.materials) - 1
    for p in ob.data.polygons:
        for x, z in axles:
            d = math.hypot(p.center.x - x, p.center.z - z)
            if d < r + 0.004 and abs(p.normal.y) < 0.5: p.material_index = k

def retag(ob, mat, pick):
    ob.data.materials.append(M(mat)); k = len(ob.data.materials) - 1
    for p in ob.data.polygons:
        if pick(p): p.material_index = k

def lens(node, mat, x0, x1, y0, y1, z0, z1, bev=0.02):
    return box(node, mat, x0, x1, y0, y1, z0, z1, bev=min(bev, (z1 - z0) * 0.45, (x1 - x0) * 0.45, abs(y1 - y0) * 0.45), seg=1, name="lens")

def mirror_arm(node, x, s, yb, z, reach=0.3, h=0.36, w=0.2):
    cyl(node, "chrome", (x, s * yb, z + h * 0.35), (x - 0.08, s * (yb + reach), z + h * 0.35), 0.014, seg=6)
    cyl(node, "chrome", (x, s * yb, z - h * 0.35), (x - 0.08, s * (yb + reach), z - h * 0.35), 0.014, seg=6)
    box(node, "trim", x - 0.13, x - 0.05, s * (yb + reach) - w / 2, s * (yb + reach) + w / 2, z - h / 2, z + h / 2, bev=0.02, seg=1)
    face(node, "glass", 1, x - 0.048, s * (yb + reach) - w / 2 + 0.02, s * (yb + reach) + w / 2 - 0.02, z - h / 2 + 0.02, z + h / 2 - 0.02)

# ---------------------------------------------------------------------------------
# The pumper: 9.8 m, 2.5 m wide, about 3 m to the top of its bar.
# ---------------------------------------------------------------------------------
def engine():
    N = "body"; HW = 1.22
    FA, RA, WR = -3.3, 2.7, 0.52
    # the cab: a flat face, a raked windshield, a white roof over red
    def rake(co):
        k = min(1.0, max(0.0, (co.z - 1.6) / 1.1)); f = min(1.0, max(0.0, (-4.1 - co.x) / 0.6))
        return Vector((co.x + 0.24 * k * f, co.y * (1.0 - 0.035 * k), co.z))
    cab = box(N, "paint_red", -4.75, -2.15, -HW, HW, 0.62, 2.84, bev=0.07, grid=0.42, deform=rake, name="cab")
    arches(cab, [(FA, WR)], 0.66)
    retag(cab, "paint_white", lambda p: p.center.z > 2.52 and p.material_index == 0)
    wx = lambda z: -4.75 + 0.24 * min(1.0, max(0.0, (z - 1.6) / 1.1)) - 0.006
    for s in (1, -1):
        # the windshield: two panes in a dark surround
        poly(N, "trim", [(wx(1.62) - 0.002, s * 0.02, 1.62), (wx(1.62) - 0.002, s * 1.1, 1.62), (wx(2.6) - 0.002, s * 1.07, 2.6), (wx(2.6) - 0.002, s * 0.02, 2.6)], (-1, 0, 0.2))
        poly(N, "glass", [(wx(1.68) - 0.006, s * 0.05, 1.68), (wx(1.68) - 0.006, s * 1.05, 1.68), (wx(2.54) - 0.006, s * 1.02, 2.54), (wx(2.54) - 0.006, s * 0.05, 2.54)], (-1, 0, 0.2))
        y = HW + 0.004
        # the driver's door ahead of the axle, a window over the wheel, the crew's door behind it
        for x0, x1 in ((-4.6, -3.92), (-2.92, -2.24)):
            frame_side(N, "trim", s, x0, x1, 0.86, 2.6, y)
            side(N, "trim", s, x0 + 0.07, x1 - 0.07, 1.68, 2.52, y + 0.001); side(N, "glass", s, x0 + 0.1, x1 - 0.1, 1.71, 2.49, y + 0.003)
            box(N, "chrome", x1 - 0.2, x1 - 0.06, s * y, s * (y + 0.03), 1.42, 1.47, bev=0.008, seg=1)
            cyl(N, "chrome", (x1 + 0.06, s * (y + 0.05), 1.3), (x1 + 0.06, s * (y + 0.05), 2.3), 0.016, seg=6)
            box(N, "steel", x0 + 0.04, x1 - 0.04, s * (HW - 0.1), s * (HW + 0.07), 0.56, 0.62, name="step")
        side(N, "trim", s, -3.8, -3.04, 1.68, 2.52, y); side(N, "glass", s, -3.77, -3.07, 1.71, 2.49, y + 0.002)
        mirror_arm(N, -4.5, s, HW, 2.0)
        # the face: two lamps a side in a bright bezel, a warning lamp over them
        box(N, "chrome", -4.79, -4.74, s * 0.62, s * 1.12, 0.98, 1.36, bev=0.02, seg=1)
        for i in (0, 1): face(N, "lamp_head", -1, -4.792, s * (0.67 + i * 0.22), s * (0.85 + i * 0.22), 1.04, 1.3)
        lens(N, "bar_red" if s > 0 else "bar_white", -4.8, -4.75, s * 0.66, s * 0.9, 1.42, 1.52)
        lens(N, "bar_white" if s > 0 else "bar_red", -4.8, -4.75, s * 0.92, s * 1.1, 1.42, 1.52)
        # warning lamps on the cab's side and the body's corners
        lens(N, "bar_red", -3.6, -3.3, s * (HW - 0.005), s * (HW + 0.03), 2.6, 2.7)
        lens(N, "bar_red", -1.1, -0.8, s * (HW - 0.005), s * (HW + 0.03), 2.56, 2.66)
        lens(N, "bar_red", 3.95, 4.25, s * (HW - 0.005), s * (HW + 0.03), 2.56, 2.66)
        # the stripe, front to back, over the arches
        for x0, x1 in ((-4.68, -2.2), (-1.26, 4.4)): side(N, "stripe", s, x0, x1, 1.26, 1.4, HW + 0.012)
        side(N, "stripe", s, -2.12, -1.33, 1.26, 1.4, HW + 0.012)
    # the grille and the bumper
    box(N, "chrome", -4.79, -4.74, -0.52, 0.52, 0.94, 1.5, bev=0.02, seg=1)
    face(N, "trim", -1, -4.792, -0.46, 0.46, 1.0, 1.44)
    if not LO:
        for i in range(5): box(N, "chrome", -4.805, -4.79, -0.46, 0.46, 1.04 + i * 0.09, 1.07 + i * 0.09)
    box(N, "chrome", -5.02, -4.72, -1.27, 1.27, 0.52, 0.84, bev=0.045, seg=2, name="bumper")
    for s in (1, -1): box(N, "trim", -5.03, -4.98, s * 0.5, s * 0.62, 0.6, 0.76, bev=0.01, seg=1)
    # the bar on the cab roof: a dark base, four lenses
    box(N, "trim", -4.22, -3.86, -0.98, 0.98, 2.84, 2.89, bev=0.012, seg=1)
    for y0, y1, m in ((-0.96, -0.5, "bar_red"), (-0.48, -0.02, "bar_white"), (0.02, 0.48, "bar_white"), (0.5, 0.96, "bar_red")):
        lens(N, m, -4.2, -3.88, y0, y1, 2.885, 3.03, bev=0.035)
    # two horns on the roof
    for s in (1, -1):
        cyl(N, "chrome", (-3.55, s * 0.72, 2.92), (-4.05, s * 0.72, 2.92), 0.03, r2=0.075, seg=10)
        box(N, "chrome", -3.62, -3.56, s * 0.69, s * 0.75, 2.84, 2.9)
    # the pump house: bright panels, gauges, outlets, an intake; the crosslays on top
    box(N, "steel", -2.15, -1.3, -HW, HW, 0.62, 2.36, bev=0.025, seg=1, grid=0.45, name="pump")
    for s in (1, -1):
        y = HW + 0.003
        side(N, "trim", s, -2.08, -1.37, 1.5, 2.24, y)
        gz = [(-1.9, 2.0, 0.085), (-1.56, 2.0, 0.085)] + ([] if LO else [(-2.0 + i * 0.125, 1.68, 0.045) for i in range(5)])
        for gx, gzz, r in gz:
            cyl(N, "chrome", (gx, s * y, gzz), (gx, s * (y + 0.022), gzz), r, seg=14)
            cyl(N, "trim", (gx, s * (y + 0.02), gzz), (gx, s * (y + 0.026), gzz), r * 0.8, seg=14)
        for ox in (-1.98, -1.72, -1.46):
            cyl(N, "chrome", (ox, s * (y - 0.02), 1.2), (ox, s * (y + 0.14), 1.2), 0.062, seg=10)
            cyl(N, "chrome", (ox, s * (y + 0.14), 1.2), (ox, s * (y + 0.17), 1.2), 0.075, seg=10)
            if not LO: cyl(N, "chrome", (ox, s * y, 1.4), (ox, s * (y + 0.09), 1.44), 0.011, seg=6)
        cyl(N, "chrome", (-1.72, s * (y - 0.02), 0.88), (-1.72, s * (y + 0.12), 0.88), 0.11, seg=12)
        cyl(N, "chrome", (-1.72, s * (y + 0.12), 0.88), (-1.72, s * (y + 0.16), 0.88), 0.125, seg=12)
        box(N, "steel", -2.15, -1.3, s * (HW - 0.1), s * (HW + 0.09), 0.56, 0.62, name="board")
    for i, y0 in enumerate((-1.1, -0.34, 0.42)):
        box(N, "hose", -2.08, -1.37, y0, y0 + 0.68, 2.36, 2.56 - 0.03 * (i % 2), bev=0.03, seg=1)
    # the body: lockers under roll-up shutters, the hose bed, the tailboard
    body = box(N, "paint_red", -1.3, 4.45, -HW, HW, 0.62, 2.74, bev=0.045, grid=0.45, name="apparatus")
    arches(body, [(RA, WR)], 0.68)
    def shutter(s, x0, x1, z0, z1):
        y = HW + 0.006
        side(N, "steel", s, x0, x1, z0, z1, y)
        if not LO:
            n = int((z1 - z0 - 0.1) / 0.12)
            for i in range(n):
                zz = z0 + 0.1 + i * 0.12
                poly(N, "steel", [(x0 + 0.02, s * y, zz), (x1 - 0.02, s * y, zz), (x1 - 0.02, s * (y + 0.012), zz + 0.035), (x0 + 0.02, s * (y + 0.012), zz + 0.035)], (0, s, -0.4))
                poly(N, "steel", [(x0 + 0.02, s * (y + 0.012), zz + 0.035), (x1 - 0.02, s * (y + 0.012), zz + 0.035), (x1 - 0.02, s * y, zz + 0.07), (x0 + 0.02, s * y, zz + 0.07)], (0, s, 0.4))
        box(N, "chrome", x0 + 0.03, x1 - 0.03, s * y, s * (y + 0.035), z0 + 0.02, z0 + 0.065, bev=0.01, seg=1)
        frame_side(N, "trim", s, x0 - 0.014, x1 + 0.014, z0 - 0.014, z1 + 0.014, y - 0.003)
    for s in (1, -1):
        top = 1.95 if s > 0 else 2.52    # the kerb side's lockers stop under the ladder
        shutter(s, -1.18, 0.3, 0.74, top); shutter(s, 0.42, 1.92, 0.74, top); shutter(s, 3.52, 4.36, 0.74, top)
        shutter(s, 2.02, 3.42, 1.52, top)
        box(N, "trim", RA + 0.72, RA + 0.76, s * 0.78, s * 1.2, 0.3, 0.66, name="flap")
        cyl(N, "chrome", (4.5, s * 1.16, 0.95), (4.5, s * 1.16, 2.35), 0.02, seg=8)
    # the ladder on its rack, kerb side: two rails, the rungs between them
    y = HW + 0.1
    for z in (2.1, 2.52): box(N, "steel", -0.9, 4.2, y - 0.015, y + 0.015, z - 0.04, z + 0.04, name="rail")
    for i in range(6 if LO else 17):
        x = -0.75 + i * (4.8 / (5 if LO else 16))
        cyl(N, "steel", (x, y, 2.14), (x, y, 2.48), 0.014, seg=6, caps=False)
    for x in (-0.3, 1.9, 3.8): box(N, "steel", x - 0.03, x + 0.03, HW - 0.01, y + 0.03, 2.56, 2.6, name="bracket")
    # the hard suction hose along the street side's top edge
    cyl(N, "trim", (-0.9, -HW - 0.02, 2.66), (4.0, -HW - 0.02, 2.66), 0.075, seg=10)
    for x in (-0.6, 1.55, 3.7): box(N, "steel", x - 0.04, x + 0.04, -HW - 0.11, -HW + 0.02, 2.57, 2.76, name="strap")
    # the hose bed: three lanes of flat hose between dividers
    for i, y0 in enumerate((-1.08, -0.34, 0.4)):
        box(N, "hose", -1.1, 4.3, y0, y0 + 0.68, 2.74, 2.84 + 0.03 * (i % 2), bev=0.03, seg=1, grid=1.2)
    for y0 in (-1.2, -0.38, 0.36, 1.12): box(N, "paint_red", -1.24, 4.4, y0, y0 + 0.06, 2.72, 2.92)
    # the deck gun
    cyl(N, "chrome", (-0.95, 0, 2.74), (-0.95, 0, 3.0), 0.06, seg=10)
    cyl(N, "chrome", (-0.95, 0, 3.0), (-1.45, 0, 3.12), 0.05, r2=0.038, seg=10)
    cyl(N, "trim", (-1.45, 0, 3.12), (-1.62, 0, 3.16), 0.05, r2=0.042, seg=10)
    # the back: chevrons, lamps, the tailboard
    chevrons(N, 4.456, 1.14, 0.78, 2.5)
    for s in (1, -1):
        lens(N, "lamp_tail", 4.45, 4.48, s * 1.16, s * 1.21, 1.05, 1.5, bev=0.01)
        lens(N, "bar_red", 4.44, 4.49, s * 0.72, s * 1.12, 2.56, 2.68)
    lens(N, "bar_white", 4.44, 4.49, -0.3, 0.3, 2.56, 2.68)
    box(N, "steel", 4.4, 4.82, -1.2, 1.2, 0.5, 0.58, bev=0.012, seg=1, name="tailboard")
    # under it all: the frame, the tank, the axles
    box(N, "trim", -4.6, 4.4, -0.5, 0.5, 0.36, 0.66, name="frame")
    for x in (FA, RA): cyl(N, "trim", (x, -0.95, WR), (x, 0.95, WR), 0.09, seg=8)
    for s in (1, -1):
        wheel(N, FA, s * 1.05, WR, 0.33, s)
        wheel(N, RA, s * 0.92, WR, 0.62, s, dual=True)

# ---------------------------------------------------------------------------------
# The ambulance: a van cab and a patient box, 7.3 m with its step, 2.3 m wide.
# ---------------------------------------------------------------------------------
def ambulance():
    N = "body"; CW = 1.0; BW = 1.15
    FA, RA, WR = -2.3, 1.8, 0.4
    # the cab: a box bent into a hood, a windshield and a roof
    def van(co):
        x, z = co.x, co.z
        # the top line: hood from the nose to the windshield's foot, the glass, the roof
        def top(x):
            if x < -3.38: return 1.0 + (x + 3.46) / 0.08 * 0.07
            if x < -2.55: return 1.07 + (x + 3.38) / 0.83 * 0.21
            if x < -1.95: return 1.28 + (x + 2.55) / 0.6 * 0.76
            return 2.04 + min(1.0, (x + 1.95) / 0.3) * 0.06
        k = (z - 0.55) / (2.1 - 0.55)
        nz = 0.55 + k * (top(x) - 0.55)
        # the sides lean in above the belt, the nose narrows
        lean = 1.0 - 0.07 * max(0.0, (nz - 1.3) / 0.8) - 0.1 * max(0.0, (-3.0 - x) / 0.46) ** 2
        return Vector((x, co.y * lean, nz))
    cab = box(N, "paint_white", -3.46, -1.36, -CW, CW, 0.55, 2.1, bev=0.06, grid=0.3, deform=van, name="cab")
    arches(cab, [(FA, WR)], 0.52)
    ln = lambda z: 1.0 - 0.07 * max(0.0, (z - 1.3) / 0.8)
    for s in (1, -1):
        # the windshield, one pane a side of the middle
        a, b = (-2.5, 1.36), (-1.99, 2.0)
        poly(N, "trim", [(a[0] - 0.01, 0, a[1] - 0.02), (a[0] - 0.01, s * 0.93 * ln(a[1]), a[1] - 0.02), (b[0], s * 0.9 * ln(b[1]), b[1] + 0.012), (b[0], 0, b[1] + 0.012)], (-1, 0, 1))
        poly(N, "glass", [(a[0] + 0.02, s * 0.01, a[1] + 0.022), (a[0] + 0.02, s * 0.88 * ln(a[1]), a[1] + 0.022), (b[0] - 0.02, s * 0.85 * ln(b[1]), b[1] - 0.004), (b[0] - 0.02, s * 0.01, b[1] - 0.004)], (-1, 0, 1))
        # the door: its shut line, its window, a handle; the mirror; the step
        yy = lambda z: (CW + 0.004) * ln(z)
        dw = [(-2.38, 1.36), (-1.96, 1.9), (-1.5, 1.9), (-1.5, 1.36)]
        poly(N, "trim", [(x + (0.03 if i > 1 else -0.03), s * (yy(z) + 0.001), z + (0.04 if 0 < i < 3 else -0.03)) for i, (x, z) in enumerate(dw)], (0, s, 0.05))
        poly(N, "glass", [(x, s * (yy(z) + 0.004), z) for x, z in dw], (0, s, 0.05))
        for x in (-2.52, -1.44): side(N, "trim", s, x, x + 0.014, 0.68, 1.34, CW + 0.004)
        side(N, "trim", s, -2.52, -1.43, 0.68, 0.694, CW + 0.004)
        box(N, "chrome", -1.66, -1.52, s * CW, s * (CW + 0.03), 1.2, 1.245, bev=0.008, seg=1)
        mirror_arm(N, -2.4, s, CW * 0.99, 1.5, reach=0.26, h=0.3, w=0.17)
        box(N, "trim", -2.5, -1.45, s * (CW - 0.12), s * (CW + 0.06), 0.42, 0.48, name="step")
        # the band along the cab
        side(N, "band", s, -2.98, -1.37, 0.98, 1.14, CW + 0.006)
        # the face: a lamp a side, a small warning lamp in the grille
        face(N, "lamp_head", -1, -3.468, s * 0.56, s * 0.86, 0.8, 0.98)
        box(N, "chrome", -3.47, -3.44, s * 0.53, s * 0.89, 0.77, 1.01, bev=0.012, seg=1)
        lens(N, "bar_red" if s > 0 else "bar_white", -3.5, -3.46, s * 0.12, s * 0.36, 0.84, 0.92)
    box(N, "chrome", -3.475, -3.44, -0.5, 0.5, 0.74, 1.02, bev=0.012, seg=1)
    face(N, "trim", -1, -3.478, -0.46, 0.46, 0.77, 0.99)
    if not LO:
        for i in range(3): box(N, "chrome", -3.49, -3.476, -0.46, 0.46, 0.8 + i * 0.065, 0.82 + i * 0.065)
    box(N, "chrome", -3.62, -3.4, -1.02, 1.02, 0.42, 0.66, bev=0.04, seg=2, name="bumper")
    # the word on the hood, mirrored, for the mirror of the car ahead
    if not LO:
        cu = bpy.data.curves.new("word", "FONT"); cu.body = "AMBULANCE"; cu.size = 0.2; cu.align_x = "CENTER"; cu.align_y = "CENTER"; cu.resolution_u = 2
        to = bpy.data.objects.new("word", cu); bpy.context.scene.collection.objects.link(to)
        me = bpy.data.meshes.new_from_object(to.evaluated_get(bpy.context.evaluated_depsgraph_get())); bpy.data.objects.remove(to)
        slope = math.atan2(0.21, 0.83)
        # the text reads along y; flipped left to right; laid on the hood's slope, a few millimetres proud of it
        T = Matrix.Translation((-2.97, 0, 1.185)) @ Matrix.Rotation(-slope, 4, "Y") @ Matrix.Rotation(-math.pi / 2, 4, "Z") @ Matrix.Scale(-1, 4, (1, 0, 0))
        me.transform(T); me.flip_normals()
        bm = bmesh.new(); bm.from_mesh(me)
        for f in bm.faces:
            if f.normal.z < 0: f.normal_flip()
        emit(bm, N, "emblem", "word")
    # the box: a shell with the inside cut into it from the back
    hull = box(N, "paint_white", -1.38, 3.35, -BW, BW, 0.58, 2.9, bev=0.05, grid=0.42, name="box")
    arches(hull, [(RA, WR)], 0.53)
    IN = (1.75, 3.5, -0.76, 0.76, 0.72, 2.6)
    boolean(hull, scratch_box(*IN))
    retag(hull, "interior", lambda p: IN[0] - 0.01 < p.center.x < 3.3 and abs(p.center.y) < 0.77 and 0.71 < p.center.z < 2.61 and p.normal.x < 0.9)
    # inside: a bench down one side, a cabinet up the other, the rails the cot locks into
    box(N, "trim", 1.78, 3.2, -0.74, -0.36, 0.72, 1.18, bev=0.02, seg=1, name="bench")
    box(N, "trim", 1.78, 2.5, 0.42, 0.74, 1.7, 2.58, bev=0.015, seg=1, name="cabinet")
    for y in (0.0, 0.3): box(N, "chrome", 1.9, 3.25, y - 0.012, y + 0.012, 0.72, 0.745, name="rail")
    face(N, "lamp_head", 1, 1.756, -0.2, 0.2, 2.48, 2.56)
    for s in (1, -1):
        y = BW + 0.004
        # the band and its pinstripe, front to back; the cross
        side(N, "band", s, -1.34, 3.31, 1.06, 1.36, y + 0.002); side(N, "band", s, -1.34, 3.31, 1.42, 1.47, y + 0.002)
        for a in (0, 60, 120):
            c, sn = math.cos(math.radians(a)), math.sin(math.radians(a)); L, Wd = 0.3, 0.075; cx, cz = 0.55, 2.1
            pts = [(cx + (u * L * c - v * Wd * sn), s * (y + 0.003 + a * 1e-5), cz + (u * L * sn + v * Wd * c)) for u, v in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            poly(N, "emblem", pts, (0, s, 0))
        # lockers: shut lines and a bright handle each
        lock = [(-1.24, -0.42, 0.72, 2.6), (2.42, 3.24, 0.72, 1.0)] if s > 0 else [(-1.24, -0.5, 0.72, 2.3), (-0.36, 1.1, 0.72, 1.0), (2.42, 3.24, 0.72, 1.0), (2.42, 3.24, 1.56, 2.3)]
        for x0, x1, z0, z1 in lock:
            frame_side(N, "trim", s, x0, x1, z0, z1, y)
            if z1 - z0 > 0.5: box(N, "chrome", x1 - 0.17, x1 - 0.05, s * y, s * (y + 0.028), (z0 + z1) / 2 - 0.02 + 0.2, (z0 + z1) / 2 + 0.025 + 0.2, bev=0.008, seg=1)
        if s > 0:
            # the kerb side door's window, and one in the box
            side(N, "trim", s, -1.14, -0.52, 1.62, 2.44, y + 0.001); side(N, "glass", s, -1.11, -0.55, 1.65, 2.41, y + 0.003)
            side(N, "trim", s, 1.3, 2.2, 1.7, 2.3, y + 0.001); side(N, "glass", s, 1.33, 2.17, 1.73, 2.27, y + 0.003)
        # warning lamps round the top of the box, the tail lamps, the flaps
        lens(N, "bar_red", -1.25, -0.9, s * (BW - 0.005), s * (BW + 0.03), 2.64, 2.78)
        lens(N, "bar_white", 0.8, 1.15, s * (BW - 0.005), s * (BW + 0.03), 2.64, 2.78)
        lens(N, "bar_red", 2.85, 3.2, s * (BW - 0.005), s * (BW + 0.03), 2.64, 2.78)
        lens(N, "bar_red", 3.34, 3.385, s * 0.72, s * 1.06, 2.66, 2.8)
        lens(N, "lamp_tail", 3.34, 3.375, s * 0.86, s * 1.06, 1.02, 1.42, bev=0.012)
        box(N, "trim", RA + 0.56, RA + 0.6, s * 0.66, s * 1.12, 0.26, 0.6, name="flap")
        # the box's front face, over the cab
        lens(N, "bar_red", -1.425, -1.375, s * 0.66, s * 1.06, 2.62, 2.78)
        lens(N, "bar_white", -1.425, -1.375, s * 0.24, s * 0.62, 2.62, 2.78)
    lens(N, "bar_red", -1.425, -1.375, -0.2, 0.2, 2.62, 2.78)
    lens(N, "bar_white", 3.34, 3.385, -0.3, 0.3, 2.66, 2.8)
    # the back: the frame round the doors, the step
    for s in (1, -1): face(N, "band", 1, 3.354, s * 0.8, s * 1.1, 1.06, 1.36)
    box(N, "chrome", 3.3, 3.74, -1.08, 1.08, 0.44, 0.52, bev=0.012, seg=1, name="step")
    box(N, "trim", -3.3, 3.3, -0.45, 0.45, 0.3, 0.6, name="frame")
    for x in (FA, RA): cyl(N, "trim", (x, -0.85, WR), (x, 0.85, WR), 0.07, seg=8)
    for s in (1, -1):
        wheel(N, FA, s * 0.9, WR, 0.26, s)
        wheel(N, RA, s * 0.9, WR, 0.5, s, dual=True)
    # the back doors: each leaf from its hinge to the middle, a window, the band, a bar to pull
    for s, name in ((1, "door_R"), (-1, "door_L")):
        hy = s * 0.77
        box(name, "paint_white", 3.352, 3.4, min(hy, s * 0.004), max(hy, s * 0.004), 0.71, 2.61, bev=0.012, seg=1, grid=0.45, name=name)
        y0, y1 = sorted((s * 0.14, s * 0.64))
        face(name, "glass" if LO else "trim", 1, 3.401, y0 - 0.03, y1 + 0.03, 1.69, 2.39); face(name, "glass", 1, 3.403, y0, y1, 1.72, 2.36)
        face(name, "glass", -1, 3.351, y0, y1, 1.72, 2.36)
        face(name, "band", 1, 3.402, min(hy, s * 0.01), max(hy, s * 0.01), 1.06, 1.36)
        box(name, "glass" if LO else "trim", 3.4, 3.44, s * 0.05, s * 0.09, 1.15, 1.6, bev=0.008, seg=1)
        o = join(name)
        o.data.transform(Matrix.Translation((-3.352, -hy, -0.71))); o.location = (3.352, hy, 0.71)

RIGS = {"engine": engine, "ambulance": ambulance}

def build(kind, lo):
    global LO
    LO = lo
    clear()
    RIGS[kind]()
    body = join("body")
    allm = [body] + [PARTS[n][0] for n in PARTS if n != "body"]
    # ambient occlusion into a colour attribute (Cycles), the doors shut, the ground under it
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0)); gp = bpy.context.active_object
    sc = bpy.context.scene; sc.render.engine = "CYCLES"; sc.cycles.samples = 96; sc.cycles.device = "CPU"
    sc.render.bake.target = "VERTEX_COLORS"; sc.world = bpy.data.worlds.new("w"); sc.world.light_settings.distance = 1.4
    for o in allm:
        o.data.color_attributes.new("ao", "BYTE_COLOR", "POINT"); o.data.color_attributes.active_color = o.data.color_attributes["ao"]
        bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
        try: bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
        except Exception as e: print("bake failed", o.name, e)
    bpy.data.objects.remove(gp)
    root = bpy.data.objects.new(kind, None); sc.collection.objects.link(root)
    for o in allm:
        mw = o.matrix_world.copy(); o.parent = root; o.matrix_world = mw
    bpy.ops.object.select_all(action="DESELECT")
    for o in [root] + allm: o.select_set(True)
    out = os.path.join(OUT, kind + ("-lo" if lo else "") + ".glb")
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_apply=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
                              export_normals=True, export_texcoords=False, export_materials="EXPORT", export_yup=True, export_extras=False)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in allm)
    print("RIG", kind, "lo" if lo else "hi", "tris", tris, "materials", sorted(MATS), "->", out)

for k in RIGS:
    if ONLY and k not in ONLY: continue
    for lo in (False, True): build(k, lo)
