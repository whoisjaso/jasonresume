# My own lines in the run, in my voice, cloned from my own recording with my
# permission.
#
#   ~/cbvenv/bin/python -I tools/voice/narrate_jason.py [lines.json] [--force] [--only id,id] [--takes 3]
#
# Chatterbox (resemble-ai/chatterbox, MIT) clones the voice from a short
# reference, tools/voice/ref.wav, which is gitignored and never committed. Setup,
# once, in its own venv (CPU torch keeps it small):
#   python3 -m venv ~/cbvenv
#   ~/cbvenv/bin/pip install --index-url https://download.pytorch.org/whl/cpu torch==2.6.0 torchaudio==2.6.0
#   ~/cbvenv/bin/pip install chatterbox-tts faster-whisper resemblyzer
#
# Nobody has to listen to choose a take. Each line is rendered several times and
# every take is scored: a speech recogniser (faster-whisper) checks that it says
# the words, a speaker encoder (resemblyzer) checks that it sounds like the
# reference, and the pace has to be a person's. The best take ships, and the same
# recogniser's word timestamps become the captions, so they light on the real voice.
#
# Writes, like narrate_free.py: <out>/<id>.mp3 (44.1 kHz 128 kbps), <out>/<id>.json
# ({ id, text, duration, words: [{ w, s, e }] }) and <out>/manifest-jason.json
# with each line's hash, its scores and the takes tried. A line whose text is
# unchanged is skipped.
import difflib, hashlib, json, re, subprocess, sys, tempfile
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
REF = HERE / "ref.wav"
FFMPEG = ROOT / "tools/film/node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg"

args = sys.argv[1:]
def opt(name, default=None):
    return args[args.index(name) + 1] if name in args and args.index(name) + 1 < len(args) else default
force = "--force" in args
only = set(filter(None, (opt("--only") or "").split(","))) or None
TAKES = int(opt("--takes", "3"))
pos = [a for i, a in enumerate(args) if not a.startswith("--") and (i == 0 or args[i - 1] not in ("--only", "--takes"))]
lines_file = Path(pos[0]) if pos else HERE / "run_jason_lines.json"

ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()
def two(n):
    if n < 20: return ONES[n]
    return TENS[n // 10] + ("-" + ONES[n % 10] if n % 10 else "")
def say_number(tok):
    n = int(tok)
    if 2000 <= n <= 2099: return "twenty " + two(n - 2000) if n >= 2010 else "two thousand " + ONES[n - 2000]
    if n < 100: return two(n)
    return tok

# How the written line is said: each written word becomes one or more spoken words.
SAY = {"CRM": "C R M", "UT": "U T", "SOPs": "S.O.P.s", "Obavia": "Oh-bah-vee-uh"}
def spoken_words(text):
    out = []  # (spoken word, index of the written word it belongs to)
    for i, w in enumerate(text.split()):
        core = re.sub(r"^[^\w]+|[^\w']+$", "", w)
        trail = w[len(w.rstrip(".,!?;:")):]
        if core.isdigit(): say = say_number(core)
        elif core in SAY: say = SAY[core]
        else: say = core
        parts = say.split()
        for j, p in enumerate(parts):
            out.append((p + (trail if j == len(parts) - 1 else ""), i))
    return out

def norm(w): return re.sub(r"[^a-z0-9]", "", w.lower().replace("-", ""))

def main():
    import numpy as np, soundfile as sf, torch
    torch.set_num_threads(8)
    from chatterbox.tts import ChatterboxTTS
    from faster_whisper import WhisperModel
    from resemblyzer import VoiceEncoder, preprocess_wav
    if not REF.exists():
        sys.exit("narrate_jason: no tools/voice/ref.wav (the reference recording stays local and is never committed)")
    doc = json.loads(lines_file.read_text())
    out = ROOT / doc.get("out", "assets/voice/run")
    out.mkdir(parents=True, exist_ok=True)
    man_path = out / "manifest-jason.json"
    try: man = json.loads(man_path.read_text()); man.setdefault("lines", {})
    except Exception: man = {"lines": {}}
    tts = ChatterboxTTS.from_pretrained(device="cpu")
    asr = WhisperModel("small.en", device="cpu", compute_type="int8")
    enc = VoiceEncoder("cpu")
    ref_emb = enc.embed_utterance(preprocess_wav(str(REF)))
    ff = str(FFMPEG) if FFMPEG.exists() else "ffmpeg"

    for l in doc["lines"]:
        if only and l["id"] not in only: continue
        h = hashlib.sha1(json.dumps([l["text"], "chatterbox", SAY]).encode()).hexdigest()[:12]
        mp3, js = out / f"{l['id']}.mp3", out / f"{l['id']}.json"
        if not force and man["lines"].get(l["id"], {}).get("hash") == h and mp3.exists() and js.exists():
            continue
        spoken = spoken_words(l["text"])
        say_text = " ".join(w for w, _ in spoken)
        target = [norm(w) for w, _ in spoken]
        best, tried = None, []
        for t in range(TAKES):
            torch.manual_seed(1000 + t)
            wav = tts.generate(say_text, audio_prompt_path=str(REF), exaggeration=0.5, cfg_weight=0.5, temperature=0.7).squeeze(0).numpy()
            sr = tts.sr
            # trim silence at the ends
            a = np.abs(wav); idx = np.where(a > 0.01)[0]
            if len(idx): wav = wav[max(0, idx[0] - int(0.06 * sr)): min(len(wav), idx[-1] + int(0.25 * sr))]
            n = int(0.015 * sr); wav[:n] *= np.linspace(0, 1, n); wav[-n:] *= np.linspace(1, 0, n)
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f: tmp = f.name
            sf.write(tmp, wav, sr)
            segs, _ = asr.transcribe(tmp, word_timestamps=True, language="en", beam_size=5)
            heard = [(w.word.strip(), w.start, w.end) for s in segs for w in (s.words or [])]
            got = [norm(w) for w, _, _ in heard]
            sm = difflib.SequenceMatcher(None, target, got)
            match = sum(b.size for b in sm.get_matching_blocks()) / max(1, len(target))
            sim = float(np.dot(ref_emb, enc.embed_utterance(preprocess_wav(tmp))))
            dur = len(wav) / sr
            wps = len(target) / max(0.1, dur)
            pace_ok = 1.6 <= wps <= 3.6
            score = match * 2 + sim + (0 if pace_ok else -0.5)
            tried.append({"take": t, "heard": round(match, 3), "like_me": round(sim, 3), "words_per_s": round(wps, 2)})
            if best is None or score > best[0]:
                best = (score, wav, sr, heard, sm, dur, tried[-1])
        _, wav, sr, heard, sm, dur, pick = best
        # captions: spoken-word times from the recogniser, then written words from those
        times = [None] * len(spoken)
        for blk in sm.get_matching_blocks():
            for k in range(blk.size): times[blk.a + k] = (heard[blk.b + k][1], heard[blk.b + k][2])
        known = [i for i, x in enumerate(times) if x]
        for i in range(len(times)):
            if times[i]: continue
            prev = max([k for k in known if k < i], default=None); nxt = min([k for k in known if k > i], default=None)
            s = times[prev][1] if prev is not None else 0.0
            e = times[nxt][0] if nxt is not None else dur
            span = [k for k in range(prev + 1 if prev is not None else 0, nxt if nxt is not None else len(times))]
            step = (e - s) / max(1, len(span)); j = span.index(i)
            times[i] = (s + j * step, s + (j + 1) * step)
        written = l["text"].split()
        words = []
        for wi, w in enumerate(written):
            ts = [times[k] for k, (_, owner) in enumerate(spoken) if owner == wi]
            words.append({"w": w, "s": round(min(x[0] for x in ts), 3), "e": round(max(x[1] for x in ts), 3)})
        # loudness: even across lines, peaks under -1 dBFS
        rms = float(np.sqrt(np.mean(wav ** 2))) or 1e-6
        wav = wav * min(10 ** (-18 / 20) / rms, 10 ** (-1 / 20) / max(1e-6, float(np.abs(wav).max())))
        with tempfile.TemporaryDirectory() as tmpd:
            p = Path(tmpd) / "line.wav"; sf.write(p, wav, sr)
            subprocess.run([ff, "-v", "error", "-y", "-i", str(p), "-ar", "44100", "-b:a", "128k", str(mp3)], check=True)
        js.write_text(json.dumps({"id": l["id"], "text": l["text"], "duration": round(dur, 3), "words": words}, indent=1, ensure_ascii=False) + "\n")
        man["lines"][l["id"]] = {"hash": h, "duration": round(dur, 3), "picked": pick, "takes": tried}
        print(f"jason: {l['id']}  {dur:.2f} s  heard {pick['heard']:.2f}  like me {pick['like_me']:.2f}  {pick['words_per_s']} w/s", flush=True)
    man["voice"] = {"source": "Chatterbox (open source), cloned from Jason's own recording with his permission", "checked_with": "faster-whisper small.en, resemblyzer"}
    man["updated"] = date.today().isoformat()
    man_path.write_text(json.dumps(man, indent=1, ensure_ascii=False) + "\n")

if __name__ == "__main__":
    main()
