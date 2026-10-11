# After Hours: the cast, built in Blender from MakeHuman's CC0 assets.
#
#   blender -b --python tools/story/mh_cast.py -- <outdir> [name ...]
#
# Needs Blender 4.2 LTS with the MPFB2 extension and the MakeHuman system assets
# (CC0), glasses01 and hats01 (CC0) and the visemes01 and faceunits01 targets in
# MPFB's user data; tools/story/README.md has the setup. For each character:
# a MakeHuman body from macro settings, eyes, brows, lashes and teeth, clothes,
# the game_engine rig (53 bones), and the face as shape keys (blinks, brows,
# jaw, smiles and a few visemes) so the runtime can talk and emote. Jason's
# short afro is grown from his own scalp as real geometry (offset shell with a
# tight curl noise), matched to assets/jason-headshot.png. Materials are
# renamed by role (skin, hair, cloth_*, eyes, brow, lash, teeth) so
# story/people.js can paint them. Exports one GLB per character; then
# tools/story/pack_cast.mjs compresses them.
import bpy, bmesh, sys, os, math, random
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "/tmp/cast"
ONLY = set(argv[1:])
os.makedirs(OUT, exist_ok=True)

from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
from bl_ext.user_default.mpfb.services.locationservice import LocationService
from bl_ext.user_default.mpfb.services.exportservice import ExportService

UD = LocationService.get_user_data()
TDIR = os.path.join(LocationService.get_mpfb_data(), "targets")
def asset(kind, name): return os.path.join(UD, kind, name, name + ".mhclo")
FACE = ["eyeBlinkLeft", "eyeBlinkRight", "jawOpen", "mouthClose", "mouthSmileLeft", "mouthSmileRight", "browInnerUp", "browDownLeft", "browDownRight",
        "browOuterUpLeft", "browOuterUpRight", "mouthFunnel", "mouthPucker", "mouthPressLeft", "mouthPressRight", "eyeSquintLeft", "eyeSquintRight", "mouthFrownLeft", "mouthFrownRight"]
VIS = {"aa_02": "visAA", "ow_08": "visOW", "p_b_m_21": "visPBM", "f_v_18": "visFV", "y_iy_ih_ix_06": "visEE"}

# Jason's face, from assets/jason-headshot.png: a slim oval face with a defined jaw and chin,
# high cheekbones, a broad nose with wide nostrils, full lips (the lower fuller), almond eyes,
# a high forehead and a long neck
JASON = {"head/head-round": 0.35, "head/head-scale-vert-decr": 0.12, "chin/chin-prominent-incr": 0.15, "chin/chin-width-incr": 0.1,
         "nose/nose-nostrils-width-incr": 0.45, "nose/nose-flaring-incr": 0.35, "nose/nose-width2-incr": 0.2, "nose/nose-point-width-incr": 0.2,
         "mouth/mouth-lowerlip-volume-incr": 0.1, "cheek/l-cheek-volume-incr": 0.25, "cheek/r-cheek-volume-incr": 0.25,
         "cheek/l-cheek-bones-incr": 0.2, "cheek/r-cheek-bones-incr": 0.2, "eyes/l-eye-height2-incr": 0.3, "eyes/r-eye-height2-incr": 0.3,
         "eyes/l-eye-scale-incr": 0.15, "eyes/r-eye-scale-incr": 0.15, "eyebrows/eyebrows-trans-down": 0.15,
         "neck/neck-scale-vert-incr": 0.1, "ears/l-ear-flap-incr": 0.2, "ears/r-ear-flap-incr": 0.2}
DELL = {"head/head-square": 0.4, "nose/nose-scale-horiz-incr": 0.3, "chin/chin-width-incr": 0.3, "neck/neck-double-incr": 0.3}
RENATA = {"head/head-oval": 0.4, "mouth/mouth-upperlip-volume-incr": 0.2, "nose/nose-scale-horiz-decr": 0.2, "cheek/l-cheek-bones-incr": 0.2, "cheek/r-cheek-bones-incr": 0.2}

CAST = {
    "jason": {
        "macro": {"gender": 1.0, "age": 0.5, "muscle": 0.55, "weight": 0.45, "proportions": 0.75, "height": 0.5, "cupsize": 0.5, "firmness": 0.5,
                  "race": {"african": 1.0, "asian": 0.0, "caucasian": 0.0}},
        "clothes": ["male_elegantsuit01", "shoes02"], "brows": "eyebrow001", "lashes": "eyelashes02", "afro": True, "goatee": True, "face": "JASON"
    },
    "jason-memory": {
        "macro": {"gender": 1.0, "age": 0.5, "muscle": 0.55, "weight": 0.45, "proportions": 0.75, "height": 0.5, "cupsize": 0.5, "firmness": 0.5,
                  "race": {"african": 1.0, "asian": 0.0, "caucasian": 0.0}},
        "clothes": ["male_casualsuit03", "shoes01"], "brows": "eyebrow001", "lashes": "eyelashes02", "afro": True, "goatee": True, "face": "JASON"
    },
    "player": {
        "macro": {"gender": 0.62, "age": 0.45, "muscle": 0.5, "weight": 0.5, "proportions": 0.7, "height": 0.48, "cupsize": 0.5, "firmness": 0.5,
                  "race": {"african": 0.35, "asian": 0.3, "caucasian": 0.35}},
        "clothes": ["male_casualsuit05", "shoes01"], "hair": "short02", "brows": "eyebrow002", "lashes": "eyelashes01"
    },
    "dell": {
        "macro": {"gender": 1.0, "age": 0.85, "muscle": 0.5, "weight": 0.68, "proportions": 0.55, "height": 0.48, "cupsize": 0.5, "firmness": 0.5,
                  "race": {"african": 0.85, "asian": 0.0, "caucasian": 0.15}},
        "clothes": ["male_worksuit01", "shoes06", "jujube_newsboy_cap"], "brows": "eyebrow010", "lashes": "eyelashes01", "stubble": True, "face": "DELL"
    },
    "renata": {
        "macro": {"gender": 0.0, "age": 0.52, "muscle": 0.45, "weight": 0.48, "proportions": 0.75, "height": 0.42, "cupsize": 0.5, "firmness": 0.6,
                  "race": {"african": 0.2, "asian": 0.1, "caucasian": 0.7}},
        "clothes": ["female_elegantsuit01", "shoes03"], "hair": "bob02", "brows": "eyebrow009", "lashes": "eyelashes03", "face": "RENATA"
    }
}

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def find_children(base):
    return [o for o in bpy.data.objects if o.parent in (base, base.parent) and o is not base and o.type == "MESH"]

def role_material(obj, role, color=(0.5, 0.5, 0.5, 1), image=None):
    """keep the first image (for detail) and name the material by role"""
    img = bpy.data.images.load(image) if image else None
    for m in obj.data.materials:
        if m and m.use_nodes:
            for n in m.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image and img is None and "normal" not in n.image.name.lower() and "_ao" not in n.image.name.lower():
                    img = n.image
    mat = bpy.data.materials.new(role)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    if img is not None:
        lim = 256 if role in ("eyes", "brow", "lash") else 512
        if max(img.size) > lim:
            img.scale(lim, int(lim * img.size[1] / img.size[0]))
        tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if role in ("brow", "lash", "hair"):
            nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
            mat.blend_method = "CLIP"
    obj.data.materials.clear(); obj.data.materials.append(mat)

def grow_shell(body, pick, offset, name, color, rim=0.006, close=True):
    """duplicate the faces pick() chooses, push them out along their normals by offset(v), close the rim back onto the skin, and split them into their own object. Shape keys move with them (every key layer gets the same offset), so a goatee follows the jaw."""
    me = body.data
    bm = bmesh.new(); bm.from_mesh(me)
    bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table(); bm.normal_update()
    sel = [f for f in bm.faces if pick(f)]
    if not sel:
        bm.free(); return None
    geom = bmesh.ops.duplicate(bm, geom=sel)
    new_faces = [g for g in geom["geom"] if isinstance(g, bmesh.types.BMFace)]
    new_verts = [g for g in geom["geom"] if isinstance(g, bmesh.types.BMVert)]
    layers = list(bm.verts.layers.shape.values())
    bm.normal_update()
    for v in new_verts:
        d = v.normal * offset(v)
        v.co += d
        for L in layers: v[L] = v[L] + d
    keep = set(new_faces)
    if close:
        boundary = [e for e in {e for f in new_faces for e in f.edges} if e.is_boundary]
        ext = bmesh.ops.extrude_edge_only(bm, edges=boundary)
        for v in [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]:
            d = -v.normal * rim
            v.co += d
            for L in layers: v[L] = v[L] + d
        keep |= {g for g in ext["geom"] if isinstance(g, bmesh.types.BMFace)}
    for f in bm.faces: f.select = f in keep
    bm.to_mesh(me); bm.free()
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    o = [x for x in bpy.context.selected_objects if x is not body and x.type == "MESH"][0]
    o.name = name
    o.data.materials.clear()
    m = bpy.data.materials.new(name); m.use_nodes = True
    m.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = color
    o.data.materials.append(m)
    return o

def head_frame(body):
    """the head's landmarks from the body: top, centre, the front, and the mouth (from the teeth)"""
    vs = body.data.vertices
    top = max(v.co.z for v in vs)
    hv = [v.co for v in vs if v.co.z > top - 0.26]
    cx = sum(c.x for c in hv) / len(hv); cy = sum(c.y for c in hv) / len(hv)
    teeth = [o for o in bpy.data.objects if o.type == "MESH" and "teeth" in o.name.lower()]
    if teeth:
        tv = [teeth[0].matrix_world @ v.co for v in teeth[0].data.vertices]
        mz = sum(c.z for c in tv) / len(tv); my = min(c.y for c in tv)
    else:
        mz, my = top - 0.19, cy - 0.09
    return top, cx, cy, mz, my

def grow_goatee(body):
    top, cx, cy, mz, my = head_frame(body)
    def pick(f):
        c = f.calc_center_median()
        if f.normal.y > -0.25: return False  # front faces only
        ax = abs(c.x - cx)
        mous = (mz + 0.008) < c.z < (mz + 0.021) and ax < 0.026 and c.y < my + 0.01
        chin = (mz - 0.062) < c.z < (mz - 0.014) and ax < 0.017 + (mz - 0.014 - c.z) * 0.15 and c.y < my + 0.03
        return mous or chin
    return grow_shell(body, pick, lambda v: 0.0022 + noise.noise(v.co * 400.0) * 0.0006, "goatee", (0.02, 0.015, 0.013, 1), rim=0.002)

def grow_afro(body, depth_top=0.027, depth_side=0.011):
    top, cx, cy, mz, my = head_frame(body)
    def hl_depth(co):
        # how far below the crown the hairline sits, by direction around the head: a rounded front with soft temples, above the ears at the sides, low at the nape
        th = abs(math.atan2(co.x - cx, cy - co.y))
        def ss(a, b, x): t = min(1.0, max(0.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
        return 0.068 + 0.012 * ss(0.3, 0.65, th) + 0.022 * ss(0.8, 1.5, th) + 0.06 * ss(1.8, 2.7, th)
    def pick(f): return all(v.co.z > top - hl_depth(v.co) - 0.02 for v in f.verts)
    def off(v):
        up = max(0.0, (v.co.z - (top - 0.1)) / 0.1)
        d = depth_side + (depth_top - depth_side) * up
        return d + noise.noise(v.co * 110.0) * 0.0012 + noise.noise(v.co * 40.0) * 0.0025
    hair = grow_shell(body, pick, off, "hair", (0.012, 0.01, 0.01, 1), rim=0.0, close=False)
    # subdivide the shell, then trim it to the hairline so its edge is fine, and close it back onto the scalp
    bm = bmesh.new(); bm.from_mesh(hair.data)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
    bm.faces.ensure_lookup_table()
    # the hairline test is on the scalp point under each face: pull the centre back in by its offset
    gone = [f for f in bm.faces if f.calc_center_median().z - 0.012 < top - hl_depth(f.calc_center_median())]
    bmesh.ops.delete(bm, geom=gone, context="FACES")
    bm.normal_update()
    boundary = [e for e in bm.edges if e.is_boundary]
    ext = bmesh.ops.extrude_edge_only(bm, edges=boundary)
    layers = list(bm.verts.layers.shape.values())
    for v in [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]:
        d = -v.normal * 0.016
        v.co += d
        for L in layers: v[L] = v[L] + d
    bm.to_mesh(hair.data); bm.free()
    return hair

def face_mask(base, beard=None, size=512):
    """paint the face's detail into a small texture in the body's UV space: R the beard (a goatee and a thin moustache, or stubble), G the lips, B warmth on the cheeks. Rasterized from the mesh, so edges are smooth."""
    import numpy as np
    top, cx, cy, mz, my = head_frame(base)
    me = base.data; me.calc_loop_triangles()
    uv = me.uv_layers.active.data
    img = np.zeros((size, size, 4), dtype=np.float32); img[..., 3] = 1.0
    def sm(e0, e1, x): t = min(1.0, max(0.0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t)
    def fn(p, n):
        if n.y > -0.05 or p.z < mz - 0.09 or p.z > mz + 0.08: return (0, 0, 0)
        ax, dz = abs(p.x - cx), p.z - mz
        r = g = b = 0.0
        if beard == "goatee":
            # moustache: a thin band over the lip, tapering at the corners
            if 0.006 < dz < 0.02: r = max(r, (1 - sm(0.019, 0.025, ax)) * sm(0.006, 0.009, dz) * (1 - sm(0.015, 0.019, dz)))
            # goatee: under the lip to the chin, a soft rounded shape
            w = 0.015 + max(0.0, -dz - 0.02) * 0.12
            if -0.07 < dz < -0.012: r = max(r, (1 - sm(w - 0.003, w + 0.003, ax)) * sm(-0.07, -0.062, dz) * (1 - sm(-0.017, -0.012, dz)))
        elif beard == "stubble":
            if -0.075 < dz < 0.02: r = 0.35 * (1 - sm(0.045, 0.06, ax)) * (1 - sm(0.01, 0.02, dz)) * sm(-0.075, -0.06, dz)
        # lips
        lw, lh = 0.025, 0.011
        e = (ax / lw) ** 2 + ((dz + 0.001) / lh) ** 2
        if e < 1.6 and p.y < my + 0.018: g = 1 - sm(0.75, 1.3, e)
        # cheeks
        d = ((ax - 0.042) ** 2 + (dz - 0.035) ** 2) ** 0.5
        b = 1 - sm(0.0, 0.03, d)
        return (r, g, b)
    co = me.vertices
    for tri in me.loop_triangles:
        P = [co[v].co for v in tri.vertices]
        if max(q.z for q in P) < mz - 0.1 or min(q.z for q in P) > mz + 0.1: continue
        if min(q.y for q in P) > cy: continue
        U = [uv[l].uv for l in tri.loops]
        xs = [u.x * size for u in U]; ys = [u.y * size for u in U]
        x0, x1, y0, y1 = int(min(xs)), int(max(xs)) + 1, int(min(ys)), int(max(ys)) + 1
        den = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(den) < 1e-9: continue
        n = tri.normal
        for py in range(max(0, y0), min(size, y1 + 1)):
            for px in range(max(0, x0), min(size, x1 + 1)):
                fx, fy = px + 0.5, py + 0.5
                a = ((ys[1] - ys[2]) * (fx - xs[2]) + (xs[2] - xs[1]) * (fy - ys[2])) / den
                bb = ((ys[2] - ys[0]) * (fx - xs[2]) + (xs[0] - xs[2]) * (fy - ys[2])) / den
                c = 1 - a - bb
                if a < -0.02 or bb < -0.02 or c < -0.02: continue
                p = P[0] * a + P[1] * bb + P[2] * c
                img[py, px, :3] = np.maximum(img[py, px, :3], fn(p, n))
    im = bpy.data.images.new("facemask", size, size, alpha=True)
    im.pixels.foreach_set(img.ravel())
    m = base.data.materials[0]
    nt = m.node_tree; tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = im
    nt.links.new(tex.outputs["Color"], nt.nodes.get("Principled BSDF").inputs["Base Color"])

def paint_tie(base, size=None):
    """the tie is painted on the shirt in the suit's texture; mark its pixels red (R carries the fabric's light, G and B zero) so the runtime can give it its own colour"""
    import numpy as np
    suits = [o for o in bpy.data.objects if o.type == "MESH" and "elegantsuit" in o.name.lower() and "female" not in o.name.lower()]
    if not suits: return
    o = suits[0]
    mat = o.data.materials[0]
    tex = [n for n in mat.node_tree.nodes if n.type == "TEX_IMAGE"]
    if not tex: return
    im = tex[0].image; W, H = im.size
    px = np.array(im.pixels[:], dtype=np.float32).reshape(H, W, 4)
    top, cx, cy, mz, my = head_frame(base)
    knot = mz - 0.105
    me = o.data; me.calc_loop_triangles(); uv = me.uv_layers.active.data
    def inside(p, n):
        dz = knot - p.z
        if n.y > -0.2 or dz < -0.012 or dz > 0.42: return False
        w = 0.017 + max(0.0, dz) * 0.06
        return abs(p.x - cx) < w
    for tri in me.loop_triangles:
        P = [o.matrix_world @ me.vertices[v].co for v in tri.vertices]
        if min(q.z for q in P) > knot + 0.02 or max(q.z for q in P) < knot - 0.45: continue
        if min(abs(q.x - cx) for q in P) > 0.07: continue
        U = [uv[l].uv for l in tri.loops]
        xs = [u.x * W for u in U]; ys = [u.y * H for u in U]
        den = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(den) < 1e-9: continue
        for py in range(max(0, int(min(ys))), min(H, int(max(ys)) + 2)):
            for pxx in range(max(0, int(min(xs))), min(W, int(max(xs)) + 2)):
                fx, fy = pxx + 0.5, py + 0.5
                a = ((ys[1] - ys[2]) * (fx - xs[2]) + (xs[2] - xs[1]) * (fy - ys[2])) / den
                b = ((ys[2] - ys[0]) * (fx - xs[2]) + (xs[0] - xs[2]) * (fy - ys[2])) / den
                c = 1 - a - b
                if a < -0.03 or b < -0.03 or c < -0.03: continue
                p = P[0] * a + P[1] * b + P[2] * c
                if inside(p, tri.normal):
                    l = float(px[py, pxx, :3] @ np.array([0.299, 0.587, 0.114]))
                    px[py, pxx, :3] = (0.25 + 0.5 * min(1.0, l * 1.6), 0.0, 0.0)
    im.pixels.foreach_set(px.ravel())

def build(name, spec):
    clear()
    base = HumanService.create_human(mask_helpers=True, detailed_helpers=True, extra_vertex_groups=True, feet_on_ground=True, scale=0.1, macro_detail_dict=spec["macro"])
    for t, w in (globals()[spec["face"]] if spec.get("face") else {}).items():
        TargetService.load_target(base, os.path.join(TDIR, t + ".target.gz"), weight=w, name=t.split("/")[-1])
    TargetService.bake_targets(base)
    # the rig first, so every asset added after it is weighted to it
    HumanService.add_builtin_rig(base, "game_engine")
    rig = base.parent
    HumanService.add_mhclo_asset(asset("eyes", "low-poly"), base, asset_type="eyes", subdiv_levels=0)
    HumanService.add_mhclo_asset(asset("eyebrows", spec["brows"]), base, asset_type="eyebrows", subdiv_levels=0)
    HumanService.add_mhclo_asset(asset("eyelashes", spec["lashes"]), base, asset_type="eyelashes", subdiv_levels=0)
    HumanService.add_mhclo_asset(asset("teeth", "teeth_base"), base, asset_type="teeth", subdiv_levels=0)
    if spec.get("hair"):
        HumanService.add_mhclo_asset(asset("hair", spec["hair"]), base, asset_type="hair", subdiv_levels=0)
    for c in spec["clothes"]:
        HumanService.add_mhclo_asset(asset("clothes", c), base, asset_type="clothes", subdiv_levels=0)
    # the face, as shape keys on the body
    for t in FACE:
        TargetService.load_target(base, os.path.join(UD, "targets", "faceunits", t + ".target"), weight=0.0, name=t)
    for f, n in VIS.items():
        TargetService.load_target(base, os.path.join(UD, "targets", "visemes", f + ".target"), weight=0.0, name=n)
    # bake the masks (body hidden under clothes) and drop helpers, keeping the face keys
    ExportService.bake_modifiers_remove_helpers(base, bake_masks=True, bake_subdiv=False, remove_helpers=True, also_proxy=False)
    # remove any subdivision left on the assets
    for o in bpy.data.objects:
        if o.type == "MESH":
            for md in list(o.modifiers):
                if md.type == "SUBSURF": o.modifiers.remove(md)
    # roles
    for o in [o for o in bpy.data.objects if o.type == "MESH"]:
        n = o.name.lower().split(".", 1)[-1]
        if o is base: role_material(o, "skin", (0.3, 0.2, 0.15, 1))
        elif "eyebrow" in n: role_material(o, "brow")
        elif "eyelash" in n: role_material(o, "lash")
        elif "teeth" in n: role_material(o, "teeth", (0.85, 0.82, 0.75, 1))
        elif n in ("low-poly", "high-poly") or ("eye" in n and "glass" not in n): role_material(o, "eyes", image=os.path.join(UD, "eyes", "materials", "brown_eye.png"))
        elif any(h in n for h in ("short", "bob", "ponytail", "afro", "long", "braid")): role_material(o, "hair")
        elif "shoe" in n: role_material(o, "cloth_shoes")
        elif "cap" in n or "hat" in n: role_material(o, "cloth_hat")
        else: role_material(o, "cloth_" + n.replace(" ", "_")[:24])
    face_mask(base, beard="goatee" if spec.get("goatee") else "stubble" if spec.get("stubble") else None)
    grown = []
    if spec.get("afro"): grown.append(grow_afro(base))
    for g in grown:
        if g is None: continue
        g.parent = rig
        if not any(md.type == "ARMATURE" for md in g.modifiers):
            md = g.modifiers.new("Armature", "ARMATURE"); md.object = rig
    paint_tie(base)
    # export
    bpy.ops.object.select_all(action="SELECT")
    path = os.path.join(OUT, name + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_skins=True, export_morph=True, export_morph_normal=False,
                              export_apply=False, export_animations=False, export_image_format="WEBP", export_yup=True, export_texcoords=True, export_normals=True)
    print("CAST", name, path, os.path.getsize(path))

for name, spec in CAST.items():
    if ONLY and name not in ONLY: continue
    build(name, spec)
