# After Hours: the sets' tiled materials, from Poly Haven (CC0, polyhaven.com; no attribution
# required, credited in tools/README.md anyway). Downloads each texture's 1k or 2k diffuse,
# OpenGL normal and ARM (AO, roughness, metal) maps, and writes WebP at 1024 and 512 into
# assets/story/world/tex-v1/<role>_{col,nor,arm}_<size>.webp.
#   python3 tools/story/world/textures.py [cache dir]
import json, os, sys, io, urllib.request
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUT = os.path.join(ROOT, "assets", "story", "world", "tex-v1")  # /assets is cached for a year: a new look ships as tex-v2
CACHE = sys.argv[1] if len(sys.argv) > 1 else "/tmp/ph-cache"
os.makedirs(OUT, exist_ok=True); os.makedirs(CACHE, exist_ok=True)

# role -> (Poly Haven id, maps to keep, sizes, colour quality)
# role -> (Poly Haven id, {map: sizes}, colour quality[, grey: the colour is set per use]); data maps are tiled detail and hold up at 512
ROLES = {
    "asphalt": ("asphalt_02", {"col": [1024, 512], "nor": [512], "arm": [512]}, 74),
    "concrete": ("concrete_floor_worn_001", {"col": [512], "nor": [512], "arm": [512]}, 76),
    "plaster": ("painted_plaster_wall", {"col": [1024, 512], "nor": [512]}, 78),
    "wood": ("oak_veneer_01", {"col": [1024, 512], "nor": [512], "arm": [512]}, 80),
    "carpet": ("dirty_carpet", {"col": [1024, 512], "nor": [512]}, 76),
    "floor": ("herringbone_parquet", {"col": [1024, 512], "nor": [512], "arm": [512]}, 80),
    "fabric": ("caban", {"col": [512], "nor": [512]}, 78, True),
}
KEYS = {"col": "Diffuse", "nor": "nor_gl", "arm": "arm"}

UA = {"User-Agent": "jasonobawemimo.com-asset-build/1.0"}
def get(url): return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120)
def fetch(url):
    f = os.path.join(CACHE, url.rsplit("/", 1)[-1])
    if not os.path.exists(f):
        with get(url) as r, open(f, "wb") as o: o.write(r.read())
    return f

for role, (pid, maps, q, *gray) in ROLES.items():
    files = json.load(get("https://api.polyhaven.com/files/" + pid))
    for m, sizes in maps.items():
        res = "1k"
        entry = files[KEYS[m]][res]
        url = (entry.get("jpg") or entry.get("png"))["url"]
        im = Image.open(fetch(url))
        im = im.convert("RGB")
        if gray and gray[0] and m == "col": im = im.convert("L").convert("RGB")  # recoloured in the shader
        for s in sizes:
            o = im.resize((s, s), Image.LANCZOS)
            dst = os.path.join(OUT, f"{role}_{m}_{s}.webp")
            o.save(dst, "WEBP", quality=q if m == "col" else 86, method=6)
            print(role, m, s, os.path.getsize(dst) // 1024, "KB")
