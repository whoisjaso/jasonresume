"""Read the note data back as music theory, before any audio is rendered.

  * chorales (neuroscience quartet, bed pad over the bed cello, triple-j
    chords): parallel fifths and octaves between every pair of voices,
    direct fifths/octaves in the outer voices, voice crossing, spacing, leaps
  * clashes: for the bed with each title layer (the combinations the player
    actually sounds), every minor second or minor ninth that sounds for more
    than an eighth note, and any C natural or E natural (foreign to the bed)
  * melodies: range, longest stretch without a breath, non-chord tones on
    strong beats
Prints a report; exits non-zero if a chorale has parallels.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import score as S

NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']


def nm(q):
    return NAMES[q % 12] + str(q // 12 - 1)


def parallels(voices, label):
    """voices: list of per-bar pitch lists, lowest voice first."""
    issues = []
    nv = len(voices)
    for b in range(S.BARS):
        a, c = b, (b + 1) % S.BARS
        for i in range(nv):
            for j in range(i + 1, nv):
                x1, y1 = voices[i][a], voices[j][a]
                x2, y2 = voices[i][c], voices[j][c]
                if x1 == x2 or y1 == y2:
                    continue
                i1, i2 = (y1 - x1) % 12, (y2 - x2) % 12
                same = (x2 - x1) * (y2 - y1) > 0
                if same and i1 == i2 and i1 in (0, 7):
                    issues.append('%s bars %d->%d: parallel %s between voice %d (%s->%s) and %d (%s->%s)' % (
                        label, a + 1, c + 1, 'octaves' if i1 == 0 else 'fifths', i, nm(x1), nm(x2), j, nm(y1), nm(y2)))
                if i == 0 and j == nv - 1 and same and i2 in (0, 7) and abs(y2 - y1) > 2:
                    issues.append('%s bars %d->%d: direct %s in outer voices (top leaps %s->%s)' % (
                        label, a + 1, c + 1, 'octave' if i2 == 0 else 'fifth', nm(y1), nm(y2)))
            if i + 1 < nv:
                if voices[i][a] > voices[i + 1][a]:
                    issues.append('%s bar %d: voices %d and %d cross' % (label, a + 1, i, i + 1))
                if i > 0 and voices[i + 1][a] - voices[i][a] > 12:
                    issues.append('%s bar %d: more than an octave between upper voices %d and %d' % (label, a + 1, i, i + 1))
        for i in range(nv):
            leap = abs(voices[i][c] - voices[i][a])
            if leap > 7 and i > 0:
                issues.append('%s bars %d->%d: voice %d leaps %d semitones' % (label, a + 1, c + 1, i, leap))
    return issues


def sounding(layer_parts, grid=8):
    """Pitch sets on a 1/grid-beat grid over the loop (notes wrap)."""
    steps = S.BARS * 4 * grid
    sets = [[] for _ in range(steps)]
    for name, part in layer_parts.items():
        for (bar, beat, beats, q, vel, *_) in part['notes']:
            if vel <= 0:
                continue
            if part.get('pedal'):
                beats = max(beats, 4 - beat)
            s0 = int(round(((bar - 1) * 4 + beat) * grid))
            n = max(1, int(round(beats * grid)))
            for k in range(n):
                sets[(s0 + k) % steps].append((q, name))
    return sets


def clashes(bed, layer, label, grid=8):
    a = sounding(bed, grid)
    b = sounding(layer, grid)
    found = {}
    for t in range(len(a)):
        for (q1, n1) in b[t]:
            for (q2, n2) in a[t] + [x for x in b[t] if x[1] != n1]:
                d = abs(q1 - q2)
                if d in (1, 13):
                    key = (min(q1, q2), max(q1, q2), n1, n2)
                    found.setdefault(key, []).append(t)
    out = []
    for (lo, hi, n1, n2), ts in found.items():
        if len(ts) > grid // 2:        # longer than an eighth note
            bar = ts[0] // (4 * grid) + 1
            beat = (ts[0] % (4 * grid)) / grid
            out.append('%s: %s (%s) against %s (%s), %.2f beats from bar %d beat %.2f' % (
                label, nm(lo), n1 if lo in [x[0] for x in b[ts[0]] if x[1] == n1] else n2,
                nm(hi), n2, len(ts) / grid, bar, beat))
    return out


def foreign(layer, label):
    out = []
    for name, part in layer.items():
        for (bar, beat, beats, q, vel, *_) in part['notes']:
            if q % 12 in (0, 4) and vel > 0:
                out.append('%s %s bar %d beat %.2f: %s is foreign to the bed' % (label, name, bar, beat, nm(q)))
            if q % 12 not in S.TONES[bar] and beat in (0, 2) and beats >= 1:
                out.append('%s %s bar %d beat %.2f: %s is a non-chord tone on a strong beat (%s)' % (
                    label, name, bar, beat, nm(q), S.SYMBOL[bar]))
    return out


def breath(notes, label):
    ev = sorted((((b - 1) * 4 + bt), (b - 1) * 4 + bt + d) for (b, bt, d, *_r) in notes)
    longest, run_start, prev_end = 0, ev[0][0], ev[0][1]
    for s, e in ev[1:]:
        if s - prev_end >= 0.9:
            longest = max(longest, prev_end - run_start)
            run_start = s
        prev_end = max(prev_end, e)
    longest = max(longest, prev_end - run_start)
    lo = min(n[3] for n in notes)
    hi = max(n[3] for n in notes)
    return '%s: range %s-%s, longest stretch without a breath %.1f beats' % (label, nm(lo), nm(hi), longest)


def main():
    P = S.parts()
    rep = []
    rep += parallels([S.NS_BASS] + [[v[k] for v in S.NS_UPPER] for k in range(3)], 'neuroscience chorale')
    rep += parallels([S.BED_VC] + [[v[k] for v in S.BED_PAD] for k in range(3)], 'bed pad over cello')
    rep += parallels([S.BED_CB] + [[v[k] for v in S.BED_PAD] for k in range(3)], 'bed pad over contrabass')
    rep += parallels([[v[k] for v in S.TJ_CHORDS] for k in range(3)], 'triple-j chords')
    rep += parallels([[v[k] for v in S.OB_TREM] for k in range(2)], 'obavia tremolo')
    hard = [r for r in rep if 'parallel' in r]
    print('== voice leading (%d notes, %d parallels)' % (len(rep), len(hard)))
    for r in rep:
        print('  ' + r)
    print('== clashes against the bed (minor 2nds / 9ths longer than an eighth)')
    tot = 0
    for layer in P:
        if layer == 'bed':
            c = clashes({}, P['bed'], 'bed alone')
        else:
            c = clashes(P['bed'], P[layer], layer)
        tot += len(c)
        for r in c:
            print('  ' + r)
    print('  total %d' % tot)
    print('== foreign and strong-beat non-chord tones')
    for layer in P:
        for r in foreign(P[layer], layer):
            print('  ' + r)
    print('== melodies')
    for layer, part in (('triple-j', 'melody'), ('the-inbound', 'cello'), ('the-inbound', 'piano'), ('neuroscience', 'piano')):
        print('  ' + breath(P[layer][part]['notes'], '%s %s' % (layer, part)))
    return 1 if hard else 0


if __name__ == '__main__':
    sys.exit(main())
