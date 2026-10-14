# After Hours: a Texas license plate, modelled in headless Blender (no third-party mesh).
#
#   python3 -m venv /root/bpyvenv && /root/bpyvenv/bin/pip install bpy     (Blender as a Python module)
#   /root/bpyvenv/bin/python tools/story/plate.py [out.glb]
#
# A standard plate is 12 by 6 inches of aluminium about a millimetre thick: rounded corners, a raised bead
# pressed in all round a few millimetres from the edge, and four slots for the bolts, 7 inches apart across
# and 4.75 inches apart up and down. The sheet is a filled 2D curve with the slots as holes and a small
# bevel round every edge; the bead is a half-round profile swept along a loop inset from the edge. The face
# (and the bead, which takes the face's paint) is mapped flat to 0..1 across the plate, top left at (0, 0)
# in glTF's terms; the back takes one texel near the edge, the bare metal's colour. Exported with +Z out of
# the face, +Y up the plate and the back on z = 0, then compressed with gltfpack (meshopt, float attributes)
# into assets/story/plate-v1.glb. The design itself (the characters, TEXAS, the star) is a canvas at
# runtime, story/tex.js plateAtlas, with a normal map for the embossed characters drawn from the same marks.
import bpy, bmesh, sys, os, math, subprocess
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
OUT = argv[0] if argv else os.path.join(ROOT, "assets", "story", "plate-v1.glb")
RAW = OUT.replace(".glb", "-raw.glb")

IN = 0.0254
W, H, T = 12 * IN, 6 * IN, 0.001          # the sheet
RC = 0.375 * IN                           # corner radius
BEV = 0.0003                              # the bevel on every edge of the sheet
BEAD_IN, BEAD_R, BEAD_H = 0.0055, 0.0021, 0.0009   # the bead: its centre line in from the edge, half its width, its height
SLOT_X, SLOT_Y, SLOT_L, SLOT_W = 3.5 * IN, 2.375 * IN, 0.55 * IN, 0.26 * IN

bpy.ops.wm.read_factory_settings(use_empty=True)
col = bpy.context.scene.collection

def rrect(w, h, r, n=5):
    """a rounded rectangle centred on the origin, counter-clockwise"""
    pts = []
    for k, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        cx, cy, a0 = sx * (w / 2 - r), sy * (h / 2 - r), k * math.pi / 2
        for i in range(n + 1):
            a = a0 + i / n * math.pi / 2
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    return pts

def slot(cx, cy, l, w, n=4):
    """a stadium: a slot for a bolt, long across the plate"""
    r, pts = w / 2, []
    for side, x0 in ((1, cx + l / 2 - r), (-1, cx - l / 2 + r)):
        for i in range(n + 1):
            a = -math.pi / 2 + i / n * math.pi if side > 0 else math.pi / 2 + i / n * math.pi
            pts.append((x0 + math.cos(a) * r, cy + math.sin(a) * r))
    return pts

# the sheet: a filled 2D curve, the slots holes in it, every edge bevelled (the outline is pulled in by the bevel)
cu = bpy.data.curves.new("sheet", "CURVE")
cu.dimensions = "2D"; cu.fill_mode = "BOTH"
cu.bevel_depth = BEV; cu.bevel_resolution = 0; cu.extrude = T / 2 - BEV
def loop(pts):
    sp = cu.splines.new("POLY"); sp.points.add(len(pts) - 1)
    for i, (x, y) in enumerate(pts): sp.points[i].co = (x, y, 0, 1)
    sp.use_cyclic_u = True
loop(rrect(W - 2 * BEV, H - 2 * BEV, RC - BEV))
for sx in (-1, 1):
    for sy in (-1, 1):
        loop(slot(sx * SLOT_X, sy * SLOT_Y, SLOT_L + 2 * BEV, SLOT_W + 2 * BEV))
ob = bpy.data.objects.new("sheet", cu); col.objects.link(ob)
dg = bpy.context.evaluated_depsgraph_get()
me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
me.transform(Matrix.Translation((0, 0, T / 2)))
bpy.data.objects.remove(ob)

bm = bmesh.new(); bm.from_mesh(me)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)

# the bead: a half-round swept along a loop inset from the edge, its foot sunk a hair into the face
path = rrect(W - 2 * BEAD_IN, H - 2 * BEAD_IN, max(RC - BEAD_IN, 0.003), 4)
K = 4
rings = []
n = len(path)
for i in range(n):
    p0, p1, p2 = Vector(path[i - 1]), Vector(path[i]), Vector(path[(i + 1) % n])
    t = ((p2 - p1).normalized() + (p1 - p0).normalized()).normalized()
    out = Vector((t.y, -t.x))  # counter-clockwise loop: the right of the tangent is outward
    ring = []
    for k in range(K + 1):
        a = k / K * math.pi
        q = p1 + out * (BEAD_R * math.cos(a))
        ring.append(bm.verts.new((q.x, q.y, T - 0.00008 + BEAD_H * math.sin(a))))
    rings.append(ring)
for i in range(n):
    a, b = rings[i], rings[(i + 1) % n]
    for k in range(K):
        bm.faces.new((a[k], b[k], b[k + 1], a[k + 1]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
# the face points out: anything on the front that turned inward is turned back
for f in bm.faces:
    c = f.calc_center_median()
    if c.z > T * 0.75 and f.normal.z < -0.2: f.normal_flip()
    if c.z < T * 0.25 and f.normal.z > 0.2: f.normal_flip()
bmesh.ops.triangulate(bm, faces=bm.faces)

# UVs: the face and the bead flat across the plate; the back one texel by the edge
for old in list(bm.loops.layers.uv): bm.loops.layers.uv.remove(old)   # (the curve's own mapping goes)
uv = bm.loops.layers.uv.new("UVMap")
for f in bm.faces:
    back = f.normal.z < -0.5
    for l in f.loops:
        x, y = l.vert.co.x, l.vert.co.y
        l[uv].uv = (0.004, 0.5) if back else ((x + W / 2) / W, (y + H / 2) / H)
bm.to_mesh(me); bm.free()
for p in me.polygons: p.use_smooth = True
me.set_sharp_from_angle(angle=math.radians(35))

# one material, by role (story/plates.js paints it; the exporter keeps the UVs only for a mesh with a material)
me.materials.append(bpy.data.materials.new("plate"))
plate = bpy.data.objects.new("plate", me); col.objects.link(plate)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=RAW, export_format="GLB", export_yup=False, export_materials="EXPORT",
                          export_texcoords=True, export_normals=True, export_extras=False)
print("plate:", len(me.vertices), "verts,", len(me.polygons), "triangles ->", RAW)

# compress: meshopt, float attributes (a millimetre bead does not survive quantization to a plate-sized box well),
# every attribute kept (the UVs feed a canvas at runtime, not a texture in the file)
gp = os.path.join(HERE, "node_modules", ".bin", "gltfpack")
if os.path.exists(gp):
    subprocess.run([gp, "-i", RAW, "-o", OUT, "-cc", "-noq", "-kn", "-kv"], check=True)
    os.remove(RAW)
    print("pack:", os.path.getsize(OUT) // 1024, "KB ->", OUT)
else:
    os.replace(RAW, OUT)
    print("gltfpack not found (npm install in tools/story); wrote it uncompressed:", OUT)
