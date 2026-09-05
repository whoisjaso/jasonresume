# Rebuilds assets/sfx from the raw Mixkit recordings. Download the sources
# listed in SOURCES into tools/sfx/raw/ first (each is a free-license file
# from https://mixkit.co/free-sound-effects/, see assets/sfx/CREDITS.md),
# then: python3 tools/sfx/process.py
import os, json, subprocess
import numpy as np, soundfile as sf
import imageio_ffmpeg
TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(TOOLS)
RAW = os.path.join(TOOLS, "sfx", "raw")
OUT = os.path.join(REPO, "assets", "sfx")
FF = imageio_ffmpeg.get_ffmpeg_exe()

SOURCES = {  # local file name: Mixkit title (search it on mixkit.co, download the WAV)
    "water-bubble.wav": "Water bubble",
    "deep-water-bubbles.wav": "Deep water bubbles",
    "water-splash.wav": "Water splash",
    "jump-into-the-water.wav": "Jump into the water",
    "air-woosh.wav": "Air woosh",
    "fast-whoosh-transition.wav": "Fast whoosh transition",
    "cinematic-tunnel-reverb-woosh.wav": "Cinematic tunnel reverb woosh",
    "magic-sparkle-whoosh.wav": "Magic sparkle whoosh",
    "opening-software-interface.wav": "Opening software interface",
    "select-click.wav": "Select click",
    "single-key-type.wav": "Single key type",
    "single-key-press-in-a-laptop.wav": "Single key press in a laptop",
    "laptop-backspace-typing-sequence.wav": "Laptop backspace typing sequence",
    "positive-interface-beep.wav": "Positive interface beep",
}

# name: (source, start seconds, duration, format, filter chain)
PLAN = {
    "drop-1": ("water-bubble.wav", 2.16, 0.7, "wav", "highpass=f=120"),
    "drop-2": ("water-bubble.wav", 6.92, 0.7, "wav", "highpass=f=120"),
    "drop-3": ("water-bubble.wav", 9.31, 0.7, "wav", "highpass=f=120"),
    "drop-4": ("deep-water-bubbles.wav", 0.13, 0.8, "wav", "highpass=f=100"),
    "splash": ("water-splash.wav", 0.0, 1.6, "mp3", "highpass=f=90,lowpass=f=9000"),
    "plunge": ("jump-into-the-water.wav", 0.05, 1.9, "mp3", "lowpass=f=7000"),
    "swoosh": ("air-woosh.wav", 0.5, 0.83, "mp3", "highpass=f=150,lowpass=f=9000"),
    "swoosh-long": ("fast-whoosh-transition.wav", 0.0, 1.8, "mp3", "highpass=f=120,lowpass=f=8000"),
    "swoosh-deep": ("cinematic-tunnel-reverb-woosh.wav", 0.2, 1.56, "mp3", "lowpass=f=6000"),
    "sparkle": ("magic-sparkle-whoosh.wav", 0.0, 0.48, "wav", "highpass=f=300"),
    "open": ("opening-software-interface.wav", 0.05, 0.85, "wav", "highpass=f=150"),
    "select": ("select-click.wav", 0.0, 0.5, "wav", "highpass=f=200"),
    "key-1": ("single-key-type.wav", 0.08, 0.22, "wav", "highpass=f=250"),
    "key-2": ("single-key-press-in-a-laptop.wav", 0.22, 0.14, "wav", "highpass=f=250"),
    "key-3": ("single-key-press-in-a-laptop.wav", 0.47, 0.14, "wav", "highpass=f=250"),
    "key-4": ("single-key-press-in-a-laptop.wav", 0.72, 0.14, "wav", "highpass=f=250"),
    "key-back": ("laptop-backspace-typing-sequence.wav", 0.31, 0.16, "wav", "highpass=f=250"),
    "chime-soft": ("positive-interface-beep.wav", 0.0, 1.1, "wav", "highpass=f=200"),
}

def main():
    os.makedirs(OUT, exist_ok=True)
    bank = {}
    for name, (src, ss, dur, fmt, flt) in PLAN.items():
        path = os.path.join(RAW, src)
        if not os.path.exists(path):
            print("missing", path, "(", SOURCES.get(src), ")"); continue
        tmp = f"/tmp/sfx-{name}.wav"
        fade_out = min(0.15, dur * 0.3)
        af = f"{flt},afade=t=in:st=0:d=0.004,afade=t=out:st={dur - fade_out:.3f}:d={fade_out:.3f}"
        subprocess.run([FF, "-v", "error", "-y", "-ss", str(ss), "-t", str(dur), "-i", path, "-ac", "1", "-ar", "44100", "-af", af, tmp], check=True)
        s, sr = sf.read(tmp)
        s = s / max(np.abs(s).max(), 1e-6) * 0.7           # peak at -3 dBFS
        idx = np.where(np.abs(s) > 0.0008)[0]              # drop the silent tail
        if len(idx): s = s[: min(len(s), idx[-1] + int(0.04 * sr))]
        sf.write(tmp, s, sr, subtype="PCM_16")
        if fmt == "wav":
            out = os.path.join(OUT, name + ".wav")
            subprocess.run([FF, "-v", "error", "-y", "-i", tmp, "-ar", "32000", "-ac", "1", "-c:a", "pcm_s16le", out], check=True)
        else:
            out = os.path.join(OUT, name + ".mp3")
            subprocess.run([FF, "-v", "error", "-y", "-i", tmp, "-codec:a", "libmp3lame", "-b:a", "96k", "-ac", "1", "-ar", "44100", out], check=True)
        bank[name] = {"f": os.path.basename(out), "d": round(len(s) / sr, 3), "kb": round(os.path.getsize(out) / 1024, 1), "src": src}
        print(f"{name:12s} {bank[name]['d']:.2f}s {bank[name]['kb']:6.1f} KB")
    json.dump(bank, open(os.path.join(OUT, "bank.json"), "w"), indent=1)

if __name__ == "__main__":
    main()
