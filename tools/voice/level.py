# Every voice line at one loudness, so no speaker is quieter than the next.
#
#   python3 tools/voice/level.py [dir] [--force] [--check]
#
# The cast are rendered by two different engines (narrate_free.py for the
# fictional voices, narrate_jason.py for mine), and they come out at different
# levels. This brings each <dir>/*.mp3 to TARGET integrated loudness (EBU R128)
# with peaks under PEAK, the way dialogue is finished for small speakers:
# rumble under 70 Hz out, a gentle compressor so the loud syllables don't set the
# level, then the gain the measurement asks for and a limiter on the peaks. It
# measures the result and, if the limiter cost loudness, adds the difference once.
# Phone speakers and laptops want speech near -16 LUFS.
#
# A file already levelled (its hash is in <dir>/manifest-level.json) is skipped,
# so run it after every render. --check only measures and fails if any line is
# more than 1 LU off the target or peaks above the ceiling.
import hashlib, json, re, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
TARGET, PEAK = -16.0, -1.5
# a full ffmpeg (imageio-ffmpeg's, in the voice venv); Remotion's build lacks these filters
FF = next((str(p) for p in [Path("/root/cbvenv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2")] if p.exists()), "ffmpeg")
SHAPE = "highpass=f=70,acompressor=threshold=-24dB:ratio=3:attack=4:release=120:knee=4"

args = sys.argv[1:]
force, check = "--force" in args, "--check" in args
pos = [a for a in args if not a.startswith("--")]
d = ROOT / (pos[0] if pos else "assets/voice/story-v2")

def sha(p): return hashlib.sha1(p.read_bytes()).hexdigest()[:12]

def loud(p):
    r = subprocess.run([FF, "-hide_banner", "-nostats", "-i", str(p), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    s = r.stderr[r.stderr.rfind("Summary"):]
    return float(re.search(r"I:\s+(-?[\d.]+)", s).group(1)), float(re.search(r"Peak:\s+(-?[\d.inf]+)", s).group(1))

def run(*a): subprocess.run([FF, "-v", "error", "-y", *a], check=True)

man_p = d / "manifest-level.json"
try: man = json.loads(man_p.read_text())
except Exception: man = {}
bad, files = 0, sorted(d.glob("*.mp3"))
for p in files:
    if check:
        i, tp = loud(p)
        if abs(i - TARGET) > 1.0 or tp > PEAK + 0.3:
            bad += 1
            print(f"level: {p.name} at {i:.1f} LUFS, peak {tp:.1f} dBTP")
        continue
    if not force and man.get(p.name) == sha(p):
        continue
    with tempfile.TemporaryDirectory() as t:
        shaped = Path(t) / "shaped.wav"
        run("-i", str(p), "-af", SHAPE, str(shaped))
        i0, _ = loud(shaped)
        gain, lim = TARGET - i0, 10 ** ((PEAK - 0.5) / 20)  # sample peaks under the true-peak ceiling
        for _ in range(2):
            out = Path(t) / "out.mp3"
            run("-i", str(shaped), "-af", f"volume={gain:.2f}dB,alimiter=limit={lim:.4f}:attack=2:release=50:level=disabled", "-ar", "44100", "-b:a", "128k", str(out))
            i1, tp1 = loud(out)
            if abs(i1 - TARGET) <= 0.5: break
            gain += TARGET - i1
        out.replace(p)
    man[p.name] = sha(p)
    print(f"level: {p.name}  {i0:.1f} -> {i1:.1f} LUFS, peak {tp1:.1f}", flush=True)
if check:
    print(f"level: {bad} of {len(files)} lines off target" if bad else f"level: all {len(files)} lines at {TARGET} LUFS")
    sys.exit(1 if bad else 0)
man_p.write_text(json.dumps(dict(sorted(man.items())), indent=1) + "\n")
