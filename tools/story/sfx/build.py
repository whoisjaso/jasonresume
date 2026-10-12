#!/usr/bin/env python3
"""Build the episode's one-shot sound sprite: assets/story/sfx/sfx.mp3 and sfx.json.

    python3 tools/story/sfx/build.py

Every source here is CC0 (Kenney's Impact Sounds, RPG Audio and Interface
Sounds; the licence files sit next to them in src/). Each sound is made mono at
44.1 kHz, trimmed of leading silence, peak normalized to -1 dBFS (the levels
live in story/audio.js, not here), given a short fade out, then laid end to end
with 0.25 s of silence between them and encoded once as a mono mp3. The JSON
holds each sound's start and length in seconds.

Everything else the episode plays (rain, the wet half of every footstep and
the puddle splashes, the lamp buzz, traffic, the passing car and its doppler,
the idling car, the door chime, the HVAC, the clock, the phone, the typing,
the library hush, the notice chime) is synthesized at run time in
story/audio.js, so it costs nothing to download.

Needs sox with mp3 support.
"""
import json, os, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SRC = os.path.join(HERE, "src")
OUT = os.path.join(ROOT, "assets", "story", "sfx")
SR = 44100
GAP = 0.25

# name in the sprite -> source file in src/
LIST = []
for s in ("concrete", "carpet", "wood"):
    for i in range(5):
        LIST.append((f"step-{s}-{i}", f"kenney-impact_footstep_{s}_00{i}.ogg"))
for i, f in enumerate(["cloth1", "cloth2", "cloth3", "cloth4"]):
    LIST.append((f"cloth-{i}", f"kenney-rpg_{f}.ogg"))
for i, f in enumerate(["bookFlip1", "bookFlip2", "bookFlip3"]):
    LIST.append((f"page-{i}", f"kenney-rpg_{f}.ogg"))
LIST += [
    ("book-open", "kenney-rpg_bookOpen.ogg"), ("book-close", "kenney-rpg_bookClose.ogg"), ("book-place", "kenney-rpg_bookPlace1.ogg"),
    ("creak-0", "kenney-rpg_creak1.ogg"), ("creak-1", "kenney-rpg_creak2.ogg"), ("creak-2", "kenney-rpg_creak3.ogg"),
    ("latch", "kenney-rpg_metalLatch.ogg"), ("click-metal", "kenney-rpg_metalClick.ogg"),
    ("keys-0", "kenney-rpg_handleCoins.ogg"), ("keys-1", "kenney-rpg_handleCoins2.ogg"),
    ("door-open", "kenney-rpg_doorOpen_1.ogg"), ("door-close", "kenney-rpg_doorClose_1.ogg"),
    ("chain-0", "kenney-impact_impactMetal_light_000.ogg"), ("chain-1", "kenney-impact_impactMetal_light_001.ogg"), ("chain-2", "kenney-impact_impactMetal_light_002.ogg"),
    ("ui-tick", "kenney-interface_tick_001.ogg"), ("ui-select", "kenney-interface_select_001.ogg"), ("ui-click", "kenney-interface_click_001.ogg"),
    ("ui-drop", "kenney-interface_drop_001.ogg"), ("ui-toggle", "kenney-interface_toggle_001.ogg"),
]


def run(*a):
    subprocess.run(a, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def dur(f):
    return float(subprocess.check_output(["soxi", "-D", f]).decode().strip())


def main():
    os.makedirs(OUT, exist_ok=True)
    tmp = tempfile.mkdtemp()
    parts, sprites, t = [], {}, 0.0
    gap = os.path.join(tmp, "gap.wav")
    run("sox", "-n", "-r", str(SR), "-c", "1", "-b", "16", gap, "trim", "0", str(GAP))
    for name, src in LIST:
        w = os.path.join(tmp, name + ".wav")
        # mono, trim leading silence, normalize, a 15 ms fade out so nothing clicks
        run("sox", os.path.join(SRC, src), "-r", str(SR), "-c", "1", "-b", "16", w,
            "silence", "1", "0.002", "0.4%", "norm", "-1", "reverse", "fade", "t", "0.015", "reverse")
        d = dur(w)
        sprites[name] = [round(t, 4), round(d, 4)]
        parts += [w, gap]
        t += d + GAP
    wav = os.path.join(tmp, "all.wav")
    run("sox", *parts, wav)
    mp3 = os.path.join(OUT, "sfx.mp3")
    run("sox", wav, "-C", "96", mp3)
    with open(os.path.join(OUT, "sfx.json"), "w") as f:
        json.dump({"v": 1, "src": "sfx.mp3", "length": round(t, 3), "sprites": sprites,
                   "about": "One-shots for After Hours. Sources: Kenney Impact Sounds, RPG Audio and Interface Sounds, all CC0 (tools/story/sfx/src). Built by tools/story/sfx/build.py."}, f, indent=1)
    print(f"{len(sprites)} sounds, {t:.1f} s, {os.path.getsize(mp3) // 1024} KB -> {os.path.relpath(mp3, ROOT)}")


if __name__ == "__main__":
    main()
