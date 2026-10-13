# Stock narration and character voices (the run's cast, the episode's fictional
# people), voiced for free with Kokoro.
#
#   python tools/voice/narrate_free.py lines.json [--force] [--only id,id] [--voice am_michael]
#
# Kokoro-82M (hexgrad/Kokoro-82M on Hugging Face, Apache-2.0) is an open-weight
# text-to-speech model that runs locally on the CPU: no account, no key, no cost.
# Setup, once (CPU torch keeps the install small):
#   python3 -m venv ~/kvenv
#   ~/kvenv/bin/pip install --index-url https://download.pytorch.org/whl/cpu torch
#   ~/kvenv/bin/pip install kokoro soundfile
# then run this with ~/kvenv/bin/python. The weights download on first run.
#
# Reads the lines file given (tools/site/run.json, tools/voice/story_lines.json)
# and writes into the folder it names as "out":
#   <out>/<id>.mp3    the line, mp3 44.1 kHz 128 kbps
#   <out>/<id>.json   { id, text, duration, words: [{ w, s, e }] } in seconds,
#                     from Kokoro's own predicted word durations
#   <out>/manifest.json  every voiced line, its hash, the voice and model
# A line whose text, voice and speed are unchanged since the last run is skipped.
# A line in the json may carry its own "speed" (KOKORO_SPEED is the default) and
# its own stock "voice" (for a cast of characters, e.g. the run's speakers); the
# file names its own output folder as "out" (relative to the repo root).
# Lines without either hash exactly as before.
#
# The voice is a stock Kokoro voice, never a clone of anyone. Default am_michael,
# an American male narrator; --voice or KOKORO_VOICE overrides it.
import hashlib, json, os, re, subprocess, sys, tempfile
from datetime import date
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "story"))
from retime import retime_words

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = None
FFMPEG = ROOT / "tools/film/node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg"
MODEL = "hexgrad/Kokoro-82M"
SR = 24000

args = sys.argv[1:]
force = "--force" in args
def opt(name, default=None):
    return args[args.index(name) + 1] if name in args and args.index(name) + 1 < len(args) else default
only = set(filter(None, (opt("--only") or "").split(","))) or None
VOICE = opt("--voice") or os.environ.get("KOKORO_VOICE", "am_michael")
SPEED = float(os.environ.get("KOKORO_SPEED", "0.95"))
pos = [a for i, a in enumerate(args) if not a.startswith("--") and (i == 0 or args[i - 1] not in ("--only", "--voice"))]
if not pos:
    sys.exit("usage: narrate_free.py lines.json (tools/site/run.json or tools/voice/story_lines.json)")
lines_file = Path(pos[0])

# How names are said. Kokoro reads markdown links as [word](/IPA/); the written
# word stays the caption.
SAY = {
    "Obawemimo": "/ˌoʊbɑˈwɛmimoʊ/",
    "Obawemimo's": "/ˌoʊbɑˈwɛmimoʊz/",
    "Obavia": "/oʊˈbɑviə/",
}

def spoken(text):
    for word, ipa in SAY.items():
        text = re.sub(rf"(?<![\w\[]){re.escape(word)}(?![\w'])", f"[{word}]({ipa})", text)
    return text

def ffmpeg():
    return str(FFMPEG) if FFMPEG.exists() else "ffmpeg"

def main():
    import numpy as np, soundfile as sf
    from kokoro import KPipeline
    global OUT
    doc = json.loads(lines_file.read_text())
    if not doc.get("out"):
        sys.exit("%s names no \"out\" folder" % lines_file)
    OUT = ROOT / doc["out"]
    lines = [l for l in doc["lines"] if not only or l["id"] in only]
    OUT.mkdir(parents=True, exist_ok=True)
    man_path = OUT / "manifest.json"
    try:
        man = json.loads(man_path.read_text()); man.setdefault("lines", {})
    except Exception:
        man = {"lines": {}}
    pipe = KPipeline(lang_code="a", repo_id=MODEL)
    voiced = kept = 0
    for l in lines:
        sp = float(l.get("speed", SPEED))  # a line may set its own pace (the film's lines run a touch quicker)
        vo = l.get("voice") or VOICE  # a line may name its own stock voice (a cast of characters)
        h = hashlib.sha1(json.dumps([l["text"], "kokoro", vo, sp, SAY]).encode()).hexdigest()[:12]
        mp3, js = OUT / f"{l['id']}.mp3", OUT / f"{l['id']}.json"
        if not force and man["lines"].get(l["id"], {}).get("hash") == h and mp3.exists() and js.exists():
            kept += 1; continue
        audio, words, t0 = [], [], 0.0
        for r in pipe(spoken(l["text"]), voice=vo, speed=sp):
            a = r.audio.numpy(); audio.append(a)
            for tok in r.tokens or []:
                if tok.start_ts is None or not re.search(r"\w", tok.text):
                    continue
                words.append({"w": tok.text, "s": round(t0 + tok.start_ts, 3), "e": round(t0 + tok.end_ts, 3)})
            t0 += len(a) / SR
        # punctuation rides with the word it follows, as the captions expect
        written = l["text"].split()
        if len(written) == len(words):
            for w, src in zip(words, written): w["w"] = src
        pcm = np.concatenate(audio)
        # the timings fitted to the voice itself (the last word ends when the voice does): tools/story/retime.py
        words = retime_words(words, pcm, SR)
        with tempfile.TemporaryDirectory() as tmp:
            wav = Path(tmp) / "line.wav"
            sf.write(wav, pcm, SR)
            subprocess.run([ffmpeg(), "-v", "error", "-y", "-i", str(wav), "-ar", "44100", "-b:a", "128k", str(mp3)], check=True)
        duration = round(len(pcm) / SR, 3)
        js.write_text(json.dumps({"id": l["id"], "text": l["text"], "duration": duration, "words": words}, indent=1, ensure_ascii=False) + "\n")
        man["lines"][l["id"]] = {"hash": h, "duration": duration, "file": f"{l['id']}.mp3", "timings": f"{l['id']}.json"}
        if l.get("voice"):
            man["lines"][l["id"]]["voice"] = vo
        voiced += 1
        print(f"kokoro: {l['id']}  {duration:.2f} s  {len(words)} words" + ("" if len(written) == len(words) else "  (word count differs from the text)"))
    ids = {l["id"] for l in doc["lines"]}
    for k in list(man["lines"]):
        if k not in ids: del man["lines"][k]
    man["voice"] = {"id": VOICE, "name": VOICE, "model": MODEL, "format": "mp3_44100_128", "settings": {"speed": SPEED},
                    "source": "Kokoro-82M, an open-weight model (Apache-2.0), a stock voice (not a clone)"}
    man["updated"] = date.today().isoformat()
    man_path.write_text(json.dumps(man, indent=1, ensure_ascii=False) + "\n")
    print(f"kokoro: {voiced} voiced, {kept} unchanged, manifest at {man_path.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
