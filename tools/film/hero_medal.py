#!/usr/bin/env python3
"""One trophy medal, large, for the After Hours film (a local render input).

Strikes a medal the way tools/art/medals.py does (same base, glyph, engraving
and metal) at 720 px instead of 160, into tools/film/public/tour/hero/medal.png.
Needs tools/art/candidates/medal-base.png (local) and the medals.py deps.
    python3 tools/film/hero_medal.py [slug tier]     default: fifty-three gold
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "art"))
import medals as M

slug, tier = (sys.argv[1], sys.argv[2]) if len(sys.argv) > 2 else ("fifty-three", "gold")
y, alpha, rr, edge, field_r = M.load_base()
vb, width, lines = M.read_glyph(slug)
dist, gx, gy, hw = M.distance_field(lines, vb, width)
rgba = M.strike(M.engrave(y, y, hw, gx, gy, dist, False), alpha, rr, field_r, tier)
out = os.path.join(HERE, "public", "tour", "hero")
os.makedirs(out, exist_ok=True)
r = M.downscale(rgba, 720, 0.2)
M.Image.fromarray((r * 255 + 0.5).clip(0, 255).astype(M.np.uint8), "RGBA").save(os.path.join(out, "medal.png"))
print("hero medal:", slug, tier)
