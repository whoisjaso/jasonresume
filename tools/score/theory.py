"""Harmony helpers: chord spelling and a dynamic-programming voice-leading
solver (minimal motion, no voice crossing, no parallel fifths/octaves,
required colour tones covered, common tones held)."""
import itertools
import numpy as np

PC = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6,
      'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


class Chord:
    """name: display name; bass: pitch class name; tones: chord tone names
    (first = root); need: tones every voicing must contain (colour)."""
    def __init__(self, name, bass, tones, need=(), avoid_double=()):
        self.name = name
        self.bass = PC[bass]
        self.tones = [PC[t] for t in tones]
        self.need = [PC[t] for t in need]
        self.avoid_double = [PC[t] for t in avoid_double]

    def __repr__(self):
        return self.name


def candidates(chord, ranges, max_span=12):
    """All voicings (one pitch per voice, low->high) using chord tones."""
    per_voice = []
    for lo, hi in ranges:
        per_voice.append([p for p in range(lo, hi + 1) if p % 12 in chord.tones])
    out = []
    for combo in itertools.product(*per_voice):
        if any(combo[i] >= combo[i + 1] for i in range(len(combo) - 1)):
            continue                                   # strictly ascending, no unisons
        if any(combo[i + 1] - combo[i] > max_span for i in range(len(combo) - 1)):
            continue
        pcs = [p % 12 for p in combo]
        if any(n not in pcs for n in chord.need):
            continue
        # at most one doubling, and never the bass of an inversion/slash chord
        if len(pcs) - len(set(pcs)) > 1:
            continue
        if any(pcs.count(a) > 1 for a in chord.avoid_double):
            continue
        if any(pc == chord.bass for pc in pcs) and chord.bass in chord.avoid_double:
            continue                                   # slash chords: bass note stays in the bass
        out.append(combo)
    return out


def _parallel(a, b, bass_a=None, bass_b=None):
    """Count parallel perfect fifths/octaves between voice pairs (incl. bass)."""
    va = list(a) if bass_a is None else [bass_a] + list(a)
    vb = list(b) if bass_b is None else [bass_b] + list(b)
    n = 0
    for i in range(len(va)):
        for j in range(i + 1, len(va)):
            i1, i2 = (va[j] - va[i]) % 12, (vb[j] - vb[i]) % 12
            moved = va[i] != vb[i] and va[j] != vb[j]
            same_dir = (vb[i] - va[i]) * (vb[j] - va[j]) > 0
            if moved and same_dir and i1 == i2 and i1 in (0, 7):
                n += 1
    return n


def solve(chords, ranges, basses=None, start=None, weights=None):
    """Viterbi over voicings. Cost = motion (semitones, leaps penalised) +
    parallels + register drift from the range centres. basses: optional bass
    MIDI line used for parallel checks against the bass."""
    w = dict(motion=1.0, leap=2.5, parallel=12.0, centre=0.08, held=-0.6, semitone=9.0, low_second=3.0)
    if weights:
        w.update(weights)
    centres = [(lo + hi) / 2 for lo, hi in ranges]
    cands = [candidates(c, ranges) for c in chords]
    for i, c in enumerate(cands):
        if not c:
            raise ValueError('no voicing for chord %d %s' % (i, chords[i]))
    def colour(v):
        # adjacent minor seconds are harsh in sustained strings; low close
        # seconds are muddy
        c = 0.0
        for a, b in zip(v[:-1], v[1:]):
            if b - a == 1:
                c += w['semitone']
            elif b - a == 2 and a < 57:
                c += w['low_second']
        return c
    unary = [np.array([w['centre'] * sum(abs(p - m) for p, m in zip(v, centres)) + colour(v) for v in c])
             for c in cands]
    cost = unary[0].copy()
    if start is not None:
        cost += np.array([sum(abs(p - q) for p, q in zip(v, start)) for v in cands[0]])
    back = []
    for t in range(1, len(chords)):
        prev, cur = cands[t - 1], cands[t]
        P = np.array(prev)
        C = np.array(cur)
        d = np.abs(C[:, None, :] - P[None, :, :])                 # cur x prev x voices
        motion = d.sum(2) * w['motion'] + (np.maximum(d - 4, 0)).sum(2) * w['leap']
        motion += (d == 0).sum(2) * w['held']
        par = np.zeros_like(motion)
        ba = basses[t - 1] if basses is not None else None
        bb = basses[t] if basses is not None else None
        for i, cv in enumerate(cur):
            for j, pv in enumerate(prev):
                par[i, j] = _parallel(pv, cv, ba, bb)
        tot = cost[None, :] + motion + par * w['parallel']
        bi = np.argmin(tot, 1)
        back.append(bi)
        cost = tot[np.arange(len(cur)), bi] + unary[t]
    path = [int(np.argmin(cost))]
    for bi in reversed(back):
        path.append(int(bi[path[-1]]))
    path.reverse()
    return [cands[t][k] for t, k in enumerate(path)]
