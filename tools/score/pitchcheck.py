"""Verify the root pitch of every sample against the note name in its file
name, so each SFZ map is right by measurement, not by trust.
Prints the median offset (semitones) per instrument folder and the cents
spread, using a harmonic-sum f0 estimate on the steady part of each sample."""
import sys, glob, os, re
import numpy as np, soundfile as sf

NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}

def name_to_midi(s):
    m = re.search(r'(?<![A-Za-z])([A-G])(#|b)?(-?\d)(?!\d)', s)
    if not m:
        return None
    n = NOTE[m.group(1)] + (1 if m.group(2) == '#' else -1 if m.group(2) == 'b' else 0)
    return 12 * (int(m.group(3)) + 1) + n

def f0_estimate(x, sr, fmin=25, fmax=2500):
    n = len(x)
    win = np.hanning(n)
    X = np.abs(np.fft.rfft(x * win, 8 * n))
    f = np.fft.rfftfreq(8 * n, 1 / sr)
    cands = 440 * 2 ** (np.arange(-48 * 4, 36 * 4) / 48.0)   # quarter-semitone grid
    cands = cands[(cands > fmin) & (cands < fmax)]
    best, bf = -1, None
    for c in cands:
        s = 0
        for h in range(1, 7):
            idx = np.searchsorted(f, c * h)
            if idx >= len(X) - 3:
                break
            s += X[idx - 3:idx + 4].max() / h ** 0.5
        if s > best:
            best, bf = s, c
    # refine with parabolic peak around fundamental-ish strongest harmonic
    lo, hi = bf * 0.97, bf * 1.03
    sel = (f > lo) & (f < hi)
    if sel.any():
        i = np.argmax(X * sel)
        if 0 < i < len(X) - 1:
            a, b, c = X[i - 1], X[i], X[i + 1]
            p = 0.5 * (a - c) / (a - 2 * b + c + 1e-20)
            return (i + p) * (f[1] - f[0])
    return bf

def check(folder, pattern='*.wav', skip=0.3, dur=0.6):
    res = []
    for fn in sorted(glob.glob(os.path.join(folder, pattern))):
        midi = name_to_midi(os.path.basename(fn))
        if midi is None:
            continue
        x, sr = sf.read(fn, always_2d=True)
        x = x.mean(1)
        on = np.argmax(np.abs(x) > 0.05 * np.abs(x).max())
        a = on + int(skip * sr)
        seg = x[a:a + int(dur * sr)]
        if len(seg) < int(0.2 * sr):
            continue
        f = f0_estimate(seg, sr)
        meas = 69 + 12 * np.log2(f / 440)
        res.append((os.path.basename(fn), midi, meas))
    if not res:
        print('no samples', folder)
        return
    offs = np.array([r[2] - r[1] for r in res])
    semis = np.round(offs)
    vals, counts = np.unique(semis, return_counts=True)
    mode = vals[np.argmax(counts)]
    cents = (offs - mode) * 100
    good = np.abs(cents) < 50
    print('%-60s n=%2d offset=%+d semis (agree %d/%d) cents median=%+.0f spread=%.0f' % (
        folder[-60:], len(res), mode, good.sum(), len(res), np.median(cents[good]), cents[good].std()))
    bad = [(r[0], round(r[2] - r[1], 2)) for r, g in zip(res, good) if not g]
    if bad:
        print('    outliers:', bad[:8])

if __name__ == '__main__':
    for d in sys.argv[1:]:
        check(d)
