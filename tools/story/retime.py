# Word timings that match the voice. The story's voice files carry word timings (<id>.json: words [{w, s, e}]) that
# the mouth (story/people.js face()) and the captions (story/main.js) follow. Two kinds of error show up when they are
# laid over the audio itself:
#  - my lines (narrate_jason.py) take their word times from the recogniser (faster-whisper), whose times come out
#    compressed: right at the start of a line, then early by 0.2 to 0.4 s by its end (a stretch of 3 to 12 percent)
#  - the fictional voices (narrate_free.py) are on time, but the last word runs on through the silence after it
#    (up to about a second), so the mouth keeps talking after the voice has stopped
# This fits each line's timings to its own audio: the stretch and offset (audio = k * json + b) that best line up
# "inside a word" with "voice on", then each word end is kept off the next word and the last one ends with the voice.
# A line is changed only when that matches the audio better than it did.
#
#   /root/kvenv/bin/python -I tools/story/retime.py <voice dir> [--write <out dir>] [--only id,id]
# Without --write it only reports. With --write it writes <out dir>/<id>.json (the same shape, plus "retimed":
# {k, b, before, after}); copy the .mp3s alongside (unchanged) for a new voice directory. Needs numpy and soundfile
# (libsndfile 1.1 or later, for mp3).
import json, os, sys, glob
import numpy as np, soundfile as sf

args = sys.argv[1:]
src = args[0] if args else "assets/voice/story-v2"
out = args[args.index("--write") + 1] if "--write" in args else None
only = set(args[args.index("--only") + 1].split(",")) if "--only" in args else None
HOP = 0.01


def envelope(path):
    x, sr = sf.read(path, always_2d=True)
    x = x.mean(1); hop = int(sr * HOP); n = len(x) // hop
    db = 20 * np.log10(np.sqrt(np.array([np.mean(x[i * hop:(i + 1) * hop] ** 2) for i in range(n)]) + 1e-12))
    return db > (db.max() - 30), len(x) / sr


def score(words, on, k, b):
    n = len(on); act = np.zeros(n, bool)
    for w in words:
        a, e = int((w["s"] * k + b) / HOP), int((w["e"] * k + b) / HOP); act[max(0, a):min(n, e)] = True
    return float(np.mean(act == on))


rows, changed = [], 0
for jf in sorted(glob.glob(os.path.join(src, "*.json"))):
    name = os.path.basename(jf)[:-5]
    if name.startswith("manifest") or (only and name not in only): continue
    mp = jf[:-5] + ".mp3"
    if not os.path.exists(mp): continue
    j = json.load(open(jf)); W = j.get("words") or []
    if not W: continue
    on, dur = envelope(mp)
    before = score(W, on, 1, 0)
    # coarse then fine search over stretch and offset
    best = (before, 1.0, 0.0)
    for k in np.arange(0.85, 1.25, 0.01):
        for b in np.arange(-0.2, 0.201, 0.02):
            s = score(W, on, k, b)
            if s > best[0] + 1e-9: best = (s, k, b)
    k0, b0 = best[1], best[2]
    for k in np.arange(k0 - 0.012, k0 + 0.0121, 0.002):
        for b in np.arange(b0 - 0.025, b0 + 0.0251, 0.005):
            s = score(W, on, k, b)
            if s > best[0] + 1e-9: best = (s, k, b)
    after, k, b = best
    nw = [{"w": w["w"], "s": round(max(0.0, w["s"] * k + b), 3), "e": round(min(dur, w["e"] * k + b), 3)} for w in W]
    # the voice's own end: the last word stops with it, not in the silence after it
    loud = np.where(on)[0]
    vend = (loud[-1] + 1) * HOP + 0.04 if len(loud) else dur
    if nw[-1]["e"] > vend: nw[-1]["e"] = round(max(nw[-1]["s"] + 0.08, vend), 3)
    for i in range(len(nw) - 1):
        if nw[i]["e"] > nw[i + 1]["s"]: nw[i]["e"] = nw[i + 1]["s"]
    trimmed = score(nw, on, 1, 0)
    use = trimmed > before + 0.005
    rows.append((name, k, b, before, trimmed, use))
    if use: changed += 1
    if out and use:
        os.makedirs(out, exist_ok=True)
        j2 = dict(j); j2["words"] = nw; j2["retimed"] = {"k": round(k, 3), "b": round(b, 3), "before": round(before, 3), "after": round(trimmed, 3)}
        with open(os.path.join(out, name + ".json"), "w") as f: f.write(json.dumps(j2, indent=1, ensure_ascii=False) + "\n")

if not rows: sys.exit("retime: no voice lines in " + src)
B = np.array([r[3] for r in rows]); A = np.array([r[4] if r[5] else r[3] for r in rows])
print(f"{len(rows)} lines, {changed} retimed; words on the voice: {B.mean():.3f} before, {A.mean():.3f} after (worst {B.min():.3f} -> {A.min():.3f})")
for r in sorted(rows, key=lambda r: r[3])[:8]:
    print(f"  {r[0]}: stretch {r[1]:.3f}, offset {r[2] * 1000:+.0f} ms, {r[3]:.3f} -> {r[4]:.3f}{'' if r[5] else ' (kept)'}")
