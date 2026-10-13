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
# Both narrators call retime_words() on each line before writing it (so new renders come out timed). For files
# already rendered:
#   python3 -I tools/story/retime.py <voice dir> [--write <out dir>] [--only id,id]
# Without --write it only reports. With --write it writes <out dir>/<id>.json (the same shape, plus "retimed":
# {k, b, before, after}); --write into the same directory retimes in place. Reading mp3 needs soundfile with
# libsndfile 1.1 or later (the voice venv, /root/kvenv/bin/python).
import json, os, sys, glob
import numpy as np

HOP = 0.01


def voice_on(x, sr):
    """Per 10 ms: is the voice sounding (within 30 dB of the line's loudest moment)."""
    x = np.asarray(x, dtype=np.float64)
    if x.ndim > 1: x = x.mean(1)
    hop = max(1, int(sr * HOP)); n = len(x) // hop
    if n == 0: return np.zeros(0, bool)
    fr = x[:n * hop].reshape(n, hop)
    db = 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-12)
    return db > (db.max() - 30)


def _score(words, on, k, b):
    n = len(on); act = np.zeros(n, bool)
    for w in words:
        a, e = int((w["s"] * k + b) / HOP), int((w["e"] * k + b) / HOP); act[max(0, a):min(n, e)] = True
    return float(np.mean(act == on))


def fit_words(words, on, dur):
    """The words refitted to the voice: returns (words, k, b, before, after, changed)."""
    if not words or not len(on): return words, 1.0, 0.0, 0.0, 0.0, False
    before = _score(words, on, 1, 0)
    best = (before, 1.0, 0.0)
    for k in np.arange(0.85, 1.25, 0.01):
        for b in np.arange(-0.2, 0.201, 0.02):
            s = _score(words, on, k, b)
            if s > best[0] + 1e-9: best = (s, k, b)
    k0, b0 = best[1], best[2]
    for k in np.arange(k0 - 0.012, k0 + 0.0121, 0.002):
        for b in np.arange(b0 - 0.025, b0 + 0.0251, 0.005):
            s = _score(words, on, k, b)
            if s > best[0] + 1e-9: best = (s, k, b)
    _, k, b = best
    nw = [{**w, "s": round(float(max(0.0, w["s"] * k + b)), 3), "e": round(float(min(dur, w["e"] * k + b)), 3)} for w in words]
    # the voice's own start and end: the first word doesn't start before it, the last one stops with it
    loud = np.where(on)[0]
    vbeg = loud[0] * HOP - 0.03 if len(loud) else 0.0
    if nw[0]["s"] < vbeg: nw[0]["s"] = round(float(min(vbeg, nw[0]["e"] - 0.05)), 3)
    vend = (loud[-1] + 1) * HOP + 0.04 if len(loud) else dur
    if nw[-1]["e"] > vend: nw[-1]["e"] = round(float(max(nw[-1]["s"] + 0.08, vend)), 3)
    for i in range(len(nw) - 1):
        if nw[i]["e"] > nw[i + 1]["s"]: nw[i]["e"] = nw[i + 1]["s"]
    after = _score(nw, on, 1, 0)
    if after > before + 0.005: return nw, float(k), float(b), before, after, True
    return words, 1.0, 0.0, before, before, False


def retime_words(words, x, sr):
    """For the narrators: the words fitted to the samples x (mono or channels last) at sr. Returns the words to write."""
    on = voice_on(x, sr)
    return fit_words(words, on, len(x) / sr)[0]


def main():
    import soundfile as sf
    args = sys.argv[1:]
    src = args[0] if args else "assets/voice/story-v3"
    out = args[args.index("--write") + 1] if "--write" in args else None
    only = set(args[args.index("--only") + 1].split(",")) if "--only" in args else None
    rows, changed = [], 0
    for jf in sorted(glob.glob(os.path.join(src, "*.json"))):
        name = os.path.basename(jf)[:-5]
        if name.startswith("manifest") or (only and name not in only): continue
        mp = jf[:-5] + ".mp3"
        if not os.path.exists(mp): continue
        j = json.load(open(jf)); W = j.get("words") or []
        if not W: continue
        x, sr = sf.read(mp, always_2d=True)
        nw, k, b, before, after, use = fit_words(W, voice_on(x, sr), len(x) / sr)
        rows.append((name, k, b, before, after, use))
        if use: changed += 1
        if out and use:
            os.makedirs(out, exist_ok=True)
            j2 = dict(j); j2["words"] = nw; j2["retimed"] = {"k": round(k, 3), "b": round(b, 3), "before": round(before, 3), "after": round(after, 3)}
            with open(os.path.join(out, name + ".json"), "w") as f: f.write(json.dumps(j2, indent=1, ensure_ascii=False) + "\n")
    if not rows: sys.exit("retime: no voice lines in " + src)
    B = np.array([r[3] for r in rows]); A = np.array([r[4] for r in rows])
    print(f"{len(rows)} lines, {changed} retimed; words on the voice: {B.mean():.3f} before, {A.mean():.3f} after (worst {B.min():.3f} -> {A.min():.3f})")
    for r in sorted(rows, key=lambda r: r[3])[:8]:
        print(f"  {r[0]}: stretch {r[1]:.3f}, offset {r[2] * 1000:+.0f} ms, {r[3]:.3f} -> {r[4]:.3f}{'' if r[5] else ' (kept)'}")


if __name__ == "__main__":
    main()
