#!/usr/bin/env python3
"""The After Hours film's sound effects, synthesised in code (first-party, no samples).

Writes 48 kHz stereo WAVs into tools/film/public/tour/sfx (local render inputs):
  lamp.wav    a sodium lamp striking: a relay tick, a soft felt thump, a faint
              120 Hz ballast hum that flickers and settles (peak at 0.00 s)
  hit.wav     a soft low hit for an act card landing (peak at 0.01 s)
  whoosh.wav  air past the camera on a push-through (apex at 0.70 s)
  riser.wav   a breath of rising air into a flare (ends, hard, at 1.60 s)
  out.wav     a lamp going out: a click and a short falling hum (peak at 0.00 s)
Every effect is dry, mono-centred except the whoosh and riser, which widen.
The film places each one by its peak (AfterHours.tsx, SFX).
    python3 tools/film/sfx.py
"""
import os
import wave
import numpy as np
from scipy import signal

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "public", "tour", "sfx")
rng = np.random.default_rng(53)


def t(sec):
    return np.arange(int(sec * SR)) / SR


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="high", fs=SR, output="sos"), x)


def sweep_bp(x, f0, f1, curve, q=1.4):
    """a band-pass whose centre follows curve (0..1) from f0 to f1, in blocks"""
    out = np.zeros_like(x); n = 1024; zi = None
    for i in range(0, len(x), n):
        k = curve[min(i, len(curve) - 1)]
        fc = f0 * (f1 / f0) ** k
        sos = signal.butter(2, [fc / q, min(fc * q, SR / 2 - 100)], btype="band", fs=SR, output="sos")
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        out[i:i + n], zi = signal.sosfilt(sos, x[i:i + n], zi=zi)
    return out


def write(name, left, right=None, peak_db=-3.0):
    right = left if right is None else right
    st = np.stack([left, right], 1)
    st *= 10 ** (peak_db / 20) / max(1e-9, np.abs(st).max())
    fade = int(0.004 * SR)
    st[:fade] *= np.linspace(0, 1, fade)[:, None]
    st[-fade:] *= np.linspace(1, 0, fade)[:, None]
    pcm = (st * 32767).astype("<i2")
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


def lamp():
    x = t(1.4)
    tick = hp(rng.standard_normal(len(x)), 1800) * np.exp(-x / 0.004) * 0.6
    thump = np.sin(2 * np.pi * (70 * x - 30 * x * x)) * np.exp(-x / 0.09) * 0.8
    # flicker: on, off, on, settling, as a sodium lamp strikes
    env = np.interp(x, [0, .03, .06, .12, .16, .3, 1.4], [0, 1, .2, .9, .5, .7, .35])
    hum = (np.sin(2 * np.pi * 120 * x) + 0.4 * np.sin(2 * np.pi * 240 * x) + 0.15 * np.sin(2 * np.pi * 360 * x)) * env * 0.12
    hum *= np.exp(-x / 0.9)
    write("lamp.wav", tick + thump + hum, peak_db=-4)


def hit():
    x = t(2.2)
    f = 46 + 40 * np.exp(-x / 0.05)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.5)
    felt = lp(rng.standard_normal(len(x)), 900) * np.exp(-x / 0.02) * 0.5
    air = bp(rng.standard_normal(len(x)), 200, 1200) * np.exp(-x / 0.35) * 0.06
    write("hit.wav", body + felt + air, peak_db=-3)


def whoosh():
    dur, apex = 1.2, 0.70
    x = t(dur)
    env = np.where(x < apex, (x / apex) ** 2.2, np.exp(-(x - apex) / 0.16))
    curve = np.where(x < apex, x / apex, 1 - 0.6 * (x - apex) / (dur - apex))
    n = rng.standard_normal((2, len(x)))
    L = sweep_bp(n[0], 250, 2200, curve) * env
    R = sweep_bp(n[1], 250, 2200, curve) * env
    pan = np.clip(x / dur, 0, 1)
    write("whoosh.wav", L * (1.1 - 0.4 * pan), R * (0.7 + 0.4 * pan), peak_db=-4)


def riser():
    dur = 1.6
    x = t(dur)
    k = x / dur
    env = k ** 2.4
    n = rng.standard_normal((2, len(x)))
    tone = np.sin(2 * np.pi * np.cumsum(180 * 2 ** (1.6 * k)) / SR) * 0.08 * env
    L = sweep_bp(n[0], 300, 3200, k, q=1.8) * env + tone
    R = sweep_bp(n[1], 300, 3200, k, q=1.8) * env + tone
    write("riser.wav", L, R, peak_db=-6)


def out():
    x = t(0.9)
    click = hp(rng.standard_normal(len(x)), 2400) * np.exp(-x / 0.003) * 0.5
    f = 120 * (1 - 0.35 * np.clip(x / 0.5, 0, 1))
    hum = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.18) * 0.18
    thud = np.sin(2 * np.pi * 52 * x) * np.exp(-x / 0.07) * 0.35
    write("out.wav", click + hum + thud, peak_db=-6)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for f in (lamp, hit, whoosh, riser, out):
        f()
    print("sfx: lamp, hit, whoosh, riser, out ->", OUT)
