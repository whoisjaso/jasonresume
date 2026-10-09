"""After Hours Library: the adaptive score, as note data.

One shared 16-bar loop at 64 BPM in D-flat major (a beat is exactly 45000
samples at 48 kHz, a bar 3.75 s, the loop exactly 60.000 s). Every layer is
written over the same bars, so any layer can join the bed on any bar line.

The harmony (one chord per bar). The bed never sounds C natural, and every
chord holds A-flat, D-flat and E-flat as consonant tones, so the obavia layer
(a D-flat held over an A-flat/E-flat tremolo, the suspended fourth of the
dominant) floats over all of it without a clash.

  1 Dbmaj6/9      2 Dbmaj6/9      3 Gbmaj9        4 Gbmaj9
  5 Bb7sus4       6 Bbm11 (sus resolves Eb to Db)  7 Ebm9   8 Ab9sus4
  9 Db6/9 over F  10 Gbmaj9       11 Bbb maj7#11 (bVI, borrowed)  12 Ab9sus4
 13 Bbm11 (deceptive)             14 Gbm6 (iv, borrowed)  15 Ebm9  16 Ab13sus4

Pitches are MIDI numbers (C4 = 60), times are (bar, beat) with bar 1 beat 0
the loop start. Each note is (bar, beat, beats, pitch, velocity).
"""
import numpy as np

BPM = 64.0
BEATS_PER_BAR = 4
BARS = 16
SR = 48000
BEAT = 60.0 / BPM
BAR = BEATS_PER_BAR * BEAT
LOOP_N = int(round(BARS * BAR * SR))
assert BARS * BAR * SR == LOOP_N
PRE = 1.0          # render pre-roll (s), folded onto the loop end
TAIL = 9.0         # render tail (s), folded onto the loop head

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def p(name):
    """'Db4' -> 61. Flats and sharps, C4 = 60 (so 'Cb4' is B3)."""
    letter, rest = name[0], name[1:]
    acc = 0
    while rest and rest[0] in 'b#':
        acc += -1 if rest[0] == 'b' else 1
        rest = rest[1:]
    return 12 * (int(rest) + 1) + NAMES[letter] + acc


def ps(names):
    return [p(n) for n in names.split()]


# --------------------------------------------------------------- harmony --
# pitch classes: Db=1 Eb=3 F=5 Gb=6 Ab=8 A(Bbb)=9 Bb=10 B(Cb)=11 C=0
CHORDS = [
    # bar, symbol, bass pc, chord tones (pcs) every part may use
    (1, 'Dbmaj6/9', 1, [1, 5, 8, 10, 3]),
    (2, 'Dbmaj6/9', 1, [1, 5, 8, 10, 3]),
    (3, 'Gbmaj9', 6, [6, 10, 1, 5, 8]),
    (4, 'Gbmaj9', 6, [6, 10, 1, 5, 8]),
    (5, 'Bb7sus4', 10, [10, 3, 5, 8]),
    (6, 'Bbm11', 10, [10, 1, 5, 8, 3]),
    (7, 'Ebm9', 3, [3, 6, 10, 1, 5]),
    (8, 'Ab9sus4', 8, [8, 1, 3, 6, 10]),
    (9, 'Db6/9/F', 5, [1, 5, 8, 10, 3]),
    (10, 'Gbmaj9', 6, [6, 10, 1, 5, 8]),
    (11, 'Bbbmaj7#11', 9, [9, 1, 8, 11, 3]),
    (12, 'Ab9sus4', 8, [8, 1, 3, 6, 10]),
    (13, 'Bbm11', 10, [10, 1, 5, 8, 3]),
    (14, 'Gbm6', 6, [6, 9, 1, 3]),
    (15, 'Ebm9', 3, [3, 6, 10, 1, 5]),
    (16, 'Ab13sus4', 8, [8, 1, 3, 6, 5, 10]),
]
TONES = {b: set(t) for (b, _, _, t) in CHORDS}
SYMBOL = {b: s for (b, s, _, _) in CHORDS}

# --------------------------------------------------------------- the bed --
# contrabass on the roots, low and long (sounding pitch)
BED_CB = ps('Db2 Db2 Gb1 Gb1 Bb1 Bb1 Eb2 Ab1 F1 Gb1 A1 Ab1 Bb1 Gb1 Eb2 Ab1')
# cello: a slow tenor line under the pad (the 4-3 suspension of bars 5-6 is
# in the pad's middle voice, so the cello holds the fifth instead of doubling it)
BED_VC = ps('Ab2 Ab2 Bb2 Db3 F3 F3 Bb2 Db3 Ab2 Bb2 Db3 Db3 F3 Db3 Db3 Eb3')
# sustained soft strings (violas, violins 2, violins 1), voice-led by hand:
# common tones held, steps elsewhere, no thirds doubled, no C anywhere
BED_PAD = [
    ps('Ab3 Eb4 F4'),     # 1  Db6/9
    ps('Ab3 Eb4 F4'),     # 2
    ps('Ab3 Db4 F4'),     # 3  Gbmaj9: Eb steps down to Db (5th), F becomes the maj7
    ps('Bb3 Db4 F4'),     # 4  Ab moves up to Bb (3rd of Gb)
    ps('Ab3 Eb4 F4'),     # 5  Bb7sus4: Eb is the suspension
    ps('Ab3 Db4 F4'),     # 6  Bbm11: Eb resolves down to Db
    ps('Bb3 Db4 Gb4'),    # 7  Ebm9
    ps('Bb3 Db4 Gb4'),    # 8  Ab9sus4: all three are common tones
    ps('Ab3 Eb4 F4'),     # 9  Db6/9 over F
    ps('Ab3 Db4 F4'),     # 10 Gbmaj9: Ab held (the 9th), no octaves with the cello
    ps('Ab3 Db4 Eb4'),    # 11 bVI: G#, C# and D# (maj7, 3rd, #11) over A
    ps('Ab3 Db4 Eb4'),    # 12 Ab9sus4
    ps('Ab3 Db4 Eb4'),    # 13 Bbm11: all held from bar 12 (7th, 3rd, 11th)
    ps('A3 Db4 Eb4'),     # 14 Gbm6: the borrowed A natural, low, under Db/Eb
    ps('Bb3 Db4 F4'),     # 15 Ebm9 (5th, 7th, 9th; the 3rd is in the felt piano)
    ps('Ab3 Db4 Gb4'),    # 16 Ab13sus4 (Gb the 7th)
]
# felt piano, low and soft: per bar a root (octave 2) with its fifth, then
# two answering tones; (beat, pitch, velocity)
BED_FELT = {
    1: [(0, 'Db2', 36), (0.06, 'Ab2', 30), (1.5, 'Eb4', 30), (2.5, 'F3', 28), (3.25, 'Ab3', 24)],
    2: [(0, 'Db2', 32), (0.06, 'Ab2', 28), (1.5, 'Bb3', 28), (2.5, 'Eb4', 27)],
    3: [(0, 'Gb2', 36), (0.06, 'Db3', 30), (1.5, 'F4', 30), (2.5, 'Bb3', 28), (3.25, 'Ab3', 24)],
    4: [(0, 'Gb2', 32), (0.06, 'Db3', 28), (1.5, 'Ab3', 28), (2.5, 'F4', 27)],
    5: [(0, 'Bb1', 36), (0.06, 'F2', 30), (1.5, 'Eb4', 30), (2.5, 'Ab3', 28), (3.25, 'F3', 24)],
    6: [(0, 'Bb1', 32), (0.06, 'F2', 28), (1.5, 'Db4', 30), (2.5, 'F3', 27)],
    7: [(0, 'Eb2', 36), (0.06, 'Bb2', 30), (1.5, 'Gb3', 30), (2.5, 'Db4', 28), (3.25, 'Eb4', 24)],
    8: [(0, 'Ab1', 34), (0.06, 'Eb2', 30), (1.5, 'Db4', 30), (2.5, 'Bb3', 28), (3.25, 'Gb3', 24)],
    9: [(0, 'F2', 36), (0.06, 'Db3', 30), (1.5, 'Ab3', 30), (2.5, 'Eb4', 28), (3.25, 'F3', 24)],
    10: [(0, 'Gb2', 34), (0.06, 'Db3', 30), (1.5, 'F4', 30), (2.5, 'Bb3', 28)],
    11: [(0, 'A1', 36), (0.06, 'Db3', 30), (1.5, 'Ab3', 30), (2.5, 'Db4', 28), (3.25, 'Eb4', 24)],
    12: [(0, 'Ab1', 34), (0.06, 'Eb2', 30), (1.5, 'Db4', 30), (2.5, 'Bb3', 27)],
    13: [(0, 'Bb1', 36), (0.06, 'F2', 30), (1.5, 'Db4', 30), (2.5, 'Ab3', 28), (3.25, 'F3', 24)],
    14: [(0, 'Gb1', 36), (0.06, 'Db2', 30), (1.5, 'A3', 26), (2.5, 'Eb4', 28)],
    15: [(0, 'Eb2', 36), (0.06, 'Bb2', 30), (1.5, 'Gb3', 30), (2.5, 'Db4', 28), (3.25, 'F4', 24)],
    16: [(0, 'Ab1', 34), (0.06, 'Eb2', 30), (1.5, 'Gb3', 28), (2.5, 'Db4', 27), (3.25, 'Eb4', 24)],
}
# bowed vibraphone: four glassy held tones, one per four-bar phrase
BED_VIBES = [(1, 'Ab4'), (5, 'Eb5'), (9, 'Ab4'), (13, 'Db5')]

# ------------------------------------------------- triple-j: main theme --
# cello melody, warm and sure; four two-bar phrases per half, each ending in
# a held note or a rest so it breathes. Motif: a rising fifth Ab-Eb, a step down.
TJ_MELODY = [
    (1, 1, 1, 'Ab3', 70), (1, 2, 3, 'Eb4', 80),
    (2, 1, 1.5, 'Db4', 74), (2, 2.5, 0.5, 'Bb3', 66), (2, 3, 1, 'Ab3', 68),
    (3, 1, 1, 'Bb3', 70), (3, 2, 2.5, 'F4', 82), (4, 0.5, 1.5, 'Eb4', 74), (4, 2, 1, 'Db4', 70),
    (5, 0, 2, 'Eb4', 76), (5, 2, 1, 'F4', 78), (5, 3, 1, 'Ab4', 84),
    (6, 0, 2, 'F4', 80), (6, 2, 1.5, 'Db4', 70),
    (7, 0.5, 1.5, 'Gb4', 78), (7, 2, 2, 'Eb4', 74),
    (8, 0, 3, 'Db4', 72),
    (9, 1, 1, 'Ab3', 72), (9, 2, 1, 'Eb4', 80), (9, 3, 1, 'F4', 80),
    (10, 0, 2, 'Bb4', 90), (10, 2, 1, 'Ab4', 80),
    (11, 0, 2, 'Ab4', 86), (11, 2, 1.5, 'Eb4', 76),
    (12, 0, 2.5, 'Db4', 72),
    (13, 0, 2, 'F4', 82), (13, 2, 1, 'Db4', 72),
    (14, 0, 1, 'Gb4', 76), (14, 1, 1, 'Eb4', 70), (14, 2, 2, 'Db4', 68),
    (15, 1, 1, 'Bb3', 66), (15, 2, 1, 'Db4', 70), (15, 3, 1, 'F4', 74),
    (16, 0, 3, 'Eb4', 70),
]
# warm string chords around the melody: violas below it (octave 3), violins
# 2 and 1 above it (octave 5), so the cello line sings in the gap between
TJ_CHORDS = [
    ps('Db3 Eb5 Ab5'), ps('Db3 Eb5 Ab5'), ps('Db3 Db5 F5'), ps('Db3 Db5 F5'),
    ps('F3 Eb5 Ab5'), ps('F3 Db5 F5'), ps('Db3 Db5 Gb5'), ps('Eb3 Db5 Gb5'),
    ps('F3 Db5 F5'), ps('F3 Db5 F5'), ps('Db3 Db5 Ab5'), ps('Eb3 Db5 Ab5'),
    ps('F3 Db5 F5'), ps('A3 Db5 Eb5'), ps('Gb3 Db5 F5'), ps('Eb3 Eb5 Ab5'),
]

# ------------------------------------------ lead-to-title: interlocking --
# two vibraphones in hocket (left on the beat, right off it), each bar's
# chord tones from Db4 up; the two lines converge like records seating.
LT_RANGE = (p('Db4'), p('Ab5'))

# --------------------------------------------- the-inbound: call/response --
INB_CELLO = [   # calls: bars 1-2, 5-6, 9-10, 13-14
    (1, 1, 1, 'F3', 66), (1, 2, 1, 'Ab3', 70), (1, 3, 1, 'Bb3', 72), (2, 0, 3, 'Eb4', 78),
    (5, 1, 1, 'Ab3', 68), (5, 2, 0.5, 'Bb3', 70), (5, 2.5, 1.5, 'Eb4', 78), (6, 0, 3, 'Db4', 72),
    (9, 1, 0.5, 'Ab3', 68), (9, 1.5, 1.5, 'Db4', 74), (9, 3, 1, 'Eb4', 76), (10, 0, 2, 'F4', 82), (10, 2, 1.5, 'Db4', 70),
    (13, 1, 1, 'Db3', 64), (13, 2, 1, 'F3', 68), (13, 3, 1, 'Ab3', 72), (14, 0, 2, 'Eb4', 76), (14, 2, 1.5, 'Db4', 68),
]
INB_PIANO = [   # answers: bars 3-4, 7-8, 11-12, 15-16 (right hand)
    (3, 1, 1, 'Db5', 58), (3, 2, 0.5, 'Bb4', 52), (3, 2.5, 1.5, 'Ab4', 54), (4, 0, 2, 'F4', 50),
    (7, 1, 0.5, 'Gb4', 52), (7, 1.5, 0.5, 'Eb4', 50), (7, 2, 1, 'Bb4', 56), (7, 3, 1, 'Db5', 58),
    (8, 0, 1.5, 'Eb5', 60), (8, 1.5, 2, 'Db5', 54),
    (11, 1, 0.5, 'Eb5', 58), (11, 1.5, 0.5, 'Db5', 54), (11, 2, 2, 'Ab4', 52),
    (12, 0, 1, 'Bb4', 54), (12, 1, 1, 'Ab4', 52), (12, 2, 2, 'Eb4', 48),
    (15, 1, 0.5, 'Bb4', 54), (15, 1.5, 0.5, 'Db5', 56), (15, 2, 1, 'F5', 60), (15, 3, 1, 'Eb5', 56),
    (16, 0, 3, 'Db5', 52),
]
INB_PIANO_LH = [  # a quiet dyad under the first note of each answer
    (3, 1, 3, 'Gb3', 40), (3, 1.03, 3, 'Db4', 36),
    (7, 1, 3, 'Eb3', 40), (7, 1.03, 3, 'Bb3', 36),
    (11, 1, 3, 'A2', 40), (11, 1.03, 3, 'Ab3', 34),
    (15, 1, 3, 'Eb3', 40), (15, 1.03, 3, 'Bb3', 36),
]

# ------------------------------------------- prospector: rising marimba --
# each bar: eight sixteenths climbing the chord from a start that steps up
# through each four-bar phrase, then a soft two-note look back down.
PR_START = ps('Db3 Eb3 F3 Ab3 Bb2 Db3 Eb3 Gb3 F3 Gb3 A3 Ab3 Bb2 Db3 Eb3 Gb3')

# ------------------------------------------ neuroscience: chorale + piano --
# a four-part chorale (cello bass, viola, violins 2 and 1), one chord per
# bar, checked for parallel fifths and octaves by verify.py; a slow piano
# melody above it in half and whole notes.
NS_BASS = ps('Db3 Db3 Gb2 Gb2 Bb2 Bb2 Eb3 Ab2 F2 Gb2 A2 Ab2 Bb2 Gb2 Eb3 Ab2')
NS_UPPER = [   # viola, violin 2, violin 1 (all below the piano line)
    ps('Ab3 Db4 F4'), ps('Ab3 Eb4 F4'), ps('Bb3 Db4 F4'), ps('Ab3 Db4 F4'),
    ps('Ab3 Eb4 F4'), ps('Ab3 Db4 F4'), ps('Bb3 Db4 Gb4'), ps('Bb3 Eb4 Gb4'),
    ps('Ab3 Db4 F4'), ps('Bb3 Db4 F4'), ps('B3 Db4 Eb4'), ps('Ab3 Db4 Eb4'),
    ps('F3 Db4 Ab4'), ps('A3 Db4 Eb4'), ps('Bb3 Db4 F4'), ps('Ab3 Eb4 Gb4'),
]
NS_PIANO = [   # four-bar phrases; the last bar of each is cut short to breathe
    (1, 0, 2, 'Ab5', 50), (1, 2, 2, 'F5', 46), (2, 0, 3, 'Eb5', 48),
    (3, 0, 2, 'Db5', 46), (3, 2, 2, 'F5', 50), (4, 0, 2, 'Ab5', 52),
    (5, 0, 2, 'Bb5', 54), (5, 2, 2, 'Ab5', 50), (6, 0, 3, 'F5', 48),
    (7, 0, 2, 'Gb5', 50), (7, 2, 2, 'F5', 46), (8, 0, 2, 'Eb5', 46),
    (9, 0, 2, 'F5', 50), (9, 2, 2, 'Ab5', 52), (10, 0, 3, 'Bb5', 56),
    (11, 0, 2, 'Ab5', 54), (11, 2, 2, 'Eb5', 48), (12, 0, 2, 'Db5', 46),
    (13, 0, 2, 'F5', 50), (13, 2, 2, 'Db5', 46), (14, 0, 3, 'Eb5', 48),
    (15, 0, 2, 'Db5', 46), (15, 2, 2, 'Bb4', 44), (16, 0, 2, 'Ab4', 44),
]

# ------------------------------------------------- obavia: never resolving --
# soft tremolo on open fifths of the bar (no thirds), and one sustained voice
# on Db5: the suspended fourth over Ab, held for all sixteen bars.
OB_TREM = [   # violas tremolo, two voices
    ps('Ab3 Eb4'), ps('Ab3 Eb4'), ps('Ab3 Db4'), ps('Gb3 Db4'),
    ps('F3 Eb4'), ps('F3 Eb4'), ps('Gb3 Eb4'), ps('Ab3 Eb4'),
    ps('Ab3 Eb4'), ps('Ab3 Db4'), ps('Ab3 Eb4'), ps('Ab3 Eb4'),
    ps('F3 Eb4'), ps('Gb3 Eb4'), ps('Gb3 Eb4'), ps('Ab3 Eb4'),
]
OB_VOICE = 'Db5'

# ------------------------------------------------------------- stings ----
# (time_s, dur_s, pitch, velocity[, opts]) per instrument; all in Db, built
# from Ab, Db and Eb (consonant over every bar of the loop) except the
# level-clear cadence, which is its own moment.
STINGS = {
    'start': {
        'length': 5.2,
        'vla': [(0.0, 2.45, p('Ab3'), 72, {'attack': 2.2, 'release': 1.8}), (0.0, 2.45, p('Eb4'), 70, {'attack': 2.2, 'release': 1.8})],
        'vln': [(0.05, 2.4, p('Db4'), 70, {'attack': 2.2, 'release': 1.8}), (0.05, 2.4, p('Ab4'), 72, {'attack': 2.2, 'release': 1.8})],
        'vc': [(0.0, 2.45, p('Db3'), 74, {'attack': 2.0, 'release': 1.8})],
        'cb': [(0.0, 2.45, p('Db2'), 70, {'attack': 2.0, 'release': 1.8})],
        'vibes_bowed': [(0.3, 2.2, p('Db5'), 90), (0.3, 2.2, p('Ab5'), 90)],
        'perc': [(2.3 - 1.25, 3.0, 49, 46)],
        'piano': [(2.3, 2.5, p('Db2'), 46), (2.32, 2.5, p('Ab2'), 40), (2.36, 2.5, p('Eb4'), 40), (2.4, 2.5, p('Ab4'), 44)],
        'chimes': [(2.3, 2.0, p('Db6'), 34)],
    },
    'open': {
        'length': 2.0,
        'vc': [(0.0, 0.6, p('Db3'), 70, {'attack': 0.55, 'release': 0.5}), (0.0, 0.6, p('Ab2'), 66, {'attack': 0.55, 'release': 0.5})],
        'cb': [(0.0, 0.6, p('Db2'), 70, {'attack': 0.5, 'release': 0.5})],
        'vla': [(0.03, 0.57, p('Ab3'), 56, {'attack': 0.55, 'release': 0.45})],
    },
    'select': {
        'length': 0.48,
        'felt': [(0.0, 0.12, p('Ab4'), 46), (0.07, 0.14, p('Db5'), 50)],
        'vibes_short': [(0.0, 0.12, p('Ab4'), 34), (0.07, 0.14, p('Db5'), 38)],
    },
    'trophy-bronze': {
        'length': 2.8,
        'piano': [(0.0, 1.2, p('Db5'), 62)],
        'chimes': [(0.0, 2.0, p('Db5'), 52), (0.004, 2.0, p('Db6'), 30)],
    },
    'trophy-silver': {
        'length': 3.0,
        'piano': [(0.0, 1.4, p('Ab4'), 58), (0.018, 1.4, p('Eb5'), 62)],
        'chimes': [(0.018, 2.2, p('Eb6'), 40), (0.0, 2.2, p('Ab5'), 34)],
        'vibes': [(0.0, 1.4, p('Ab4'), 40), (0.018, 1.4, p('Eb5'), 42)],
    },
    'trophy-gold': {
        'length': 3.4,
        'piano': [(0.0, 0.3, p('Ab4'), 54), (0.11, 0.3, p('Db5'), 56), (0.22, 0.3, p('Eb5'), 58),
                  (0.33, 0.3, p('Ab5'), 60), (0.5, 1.6, p('Db5'), 62), (0.5, 1.6, p('Db6'), 64)],
        'vibes': [(0.0, 0.3, p('Ab4'), 36), (0.11, 0.3, p('Db5'), 38), (0.22, 0.3, p('Eb5'), 40),
                  (0.33, 0.3, p('Ab5'), 42), (0.5, 1.6, p('Db6'), 46)],
        'chimes': [(0.5, 2.4, p('Db6'), 46)],
    },
    'trophy-platinum': {
        'length': 4.6,
        'piano': [(0.0, 0.3, p('Db4'), 50), (0.09, 0.3, p('Ab4'), 54), (0.18, 0.3, p('Db5'), 56),
                  (0.27, 0.3, p('Eb5'), 58), (0.36, 0.3, p('Ab5'), 60),
                  (0.52, 2.2, p('Db2'), 50), (0.52, 2.2, p('Db5'), 64), (0.52, 2.2, p('Db6'), 66), (0.55, 2.2, p('Ab5'), 52)],
        'vibes': [(0.18, 0.3, p('Db5'), 38), (0.27, 0.3, p('Eb5'), 40), (0.36, 0.3, p('Ab5'), 42), (0.52, 2.0, p('Db6'), 48), (0.52, 2.0, p('Ab6'), 40)],
        'chimes': [(0.52, 3.0, p('Db6'), 50), (0.56, 3.0, p('Ab5'), 40)],
        'vla': [(0.2, 2.3, p('Ab3'), 62, {'attack': 0.45, 'release': 1.8})],
        'vln': [(0.2, 2.3, p('Db4'), 60, {'attack': 0.45, 'release': 1.8}), (0.2, 2.3, p('Eb4'), 58, {'attack': 0.45, 'release': 1.8})],
        'cb': [(0.45, 2.3, p('Db2'), 56, {'attack': 0.3, 'release': 1.8})],
        'perc': [(0.52 - 0.0, 3.0, 56, 40)],
    },
    'level-clear': {
        'length': 6.0,
        # dominant (Ab9sus4 resolving to Ab9 at 1.15 s), tonic Dbmaj9 at 2.0 s
        'cb': [(0.0, 2.0, p('Ab1'), 70, {'attack': 0.25, 'release': 0.6}), (2.0, 2.3, p('Db2'), 76, {'attack': 0.1, 'release': 2.0})],
        'vc': [(0.0, 2.0, p('Eb3'), 66, {'attack': 0.25, 'release': 0.6}), (2.0, 2.3, p('Ab2'), 74, {'attack': 0.1, 'release': 2.0})],
        'vla': [(0.0, 1.15, p('Db4'), 64, {'attack': 0.25, 'release': 0.35}), (1.15, 0.85, p('C4'), 66, {'attack': 0.08, 'release': 0.5}),
                (2.0, 2.3, p('F3'), 72, {'attack': 0.1, 'release': 2.0})],
        'vln': [(0.0, 2.0, p('Gb4'), 62, {'attack': 0.25, 'release': 0.6}), (0.0, 2.0, p('Bb4'), 64, {'attack': 0.25, 'release': 0.6}),
                (2.0, 2.3, p('C5'), 74, {'attack': 0.12, 'release': 2.0}), (2.0, 2.3, p('Eb5'), 76, {'attack': 0.12, 'release': 2.0}),
                (2.0, 2.3, p('Ab4'), 72, {'attack': 0.12, 'release': 2.0})],
        'piano': [(0.0, 1.9, p('Ab2'), 54), (0.03, 1.9, p('Eb3'), 46), (0.06, 1.0, p('Db4'), 46), (0.09, 1.0, p('Gb4'), 48),
                  (0.12, 1.0, p('Bb4'), 50), (0.15, 1.0, p('Db5'), 54), (1.15, 0.8, p('C5'), 52),
                  (2.0, 3.0, p('Db2'), 60), (2.0, 3.0, p('Db3'), 54), (2.04, 3.0, p('Ab3'), 48), (2.08, 3.0, p('F4'), 50),
                  (2.12, 3.0, p('C5'), 52), (2.16, 3.0, p('Eb5'), 56), (2.2, 3.0, p('Ab5'), 58)],
        'chimes': [(2.0, 3.0, p('Db6'), 40)],
        'perc': [(2.0 - 1.25, 3.0, 49, 54)],
    },
}
TICKS = [p('Db6'), p('Eb6'), p('Ab5')]


# ------------------------------------------------- pattern generators -----
def at(bar, beat):
    """Loop seconds of (bar, beat)."""
    return ((bar - 1) * BEATS_PER_BAR + beat) * BEAT


def chord_tones(bar, lo, hi):
    return [q for q in range(lo, hi + 1) if q % 12 in TONES[bar]]


def bed_pitches(bar):
    """Pitches the bed sustains through a bar (pad, cello, bass, glass, felt)."""
    out = set(BED_PAD[bar - 1]) | {BED_VC[bar - 1], BED_CB[bar - 1]}
    for (b, name) in BED_VIBES:
        if b <= bar < b + 3:
            out.add(p(name))
    out |= {p(nm) for (_, nm, v) in BED_FELT[bar] if v > 0}
    return out


def safe_tones(bar, lo, hi):
    """Chord tones that sit no closer than a whole tone (or a major ninth)
    to anything the bed sustains in that bar: no minor 2nds or 9ths."""
    bp = bed_pitches(bar)
    return [q for q in chord_tones(bar, lo, hi) if all(abs(q - r) not in (1, 13) for r in bp)]


def lead_to_title():
    """Two vibraphones in hocket. Left plays the beats, climbing from the
    bottom of the bar's chord; right plays the off-beats, falling from the
    top; on beats 3 and 4 they swap direction so the lines interlock and
    meet. Returns (left, right, chimes) note lists of (bar, beat, beats, pitch, vel)."""
    left, right, chimes = [], [], []
    for bar in range(1, BARS + 1):
        T = safe_tones(bar, LT_RANGE[0], LT_RANGE[1])
        hi_extra = LT_RANGE[1]
        while len(T) < 6:
            hi_extra += 1
            T = safe_tones(bar, LT_RANGE[0], hi_extra)
        n = len(T)
        lo_line = [T[0], T[1], T[2], T[1]] if bar % 2 else [T[1], T[2], T[3], T[2]]
        hi_line = [T[n - 1], T[n - 2], T[n - 3], T[n - 2]] if bar % 2 else [T[n - 2], T[n - 3], T[n - 4], T[n - 3]]
        for k in range(4):
            left.append((bar, k, 0.45, lo_line[k], 46 if k in (0, 2) else 40))
            right.append((bar, k + 0.5, 0.45, hi_line[k], 38 if k in (0, 2) else 34))
        if bar % 2 == 1:
            top = [q for q in safe_tones(bar, p('Db6'), p('Ab6'))][0]
            chimes.append((bar, 0, 2.0, top, 36))
    return left, right, chimes


def prospector():
    """Rising marimba: eight sixteenths up the chord from PR_START, a held top,
    then a soft two-note glance back down on beats 3 and 3.5."""
    notes = []
    for bar in range(1, BARS + 1):
        T = safe_tones(bar, PR_START[bar - 1], PR_START[bar - 1] + 34)
        phrase_pos = (bar - 1) % 4
        for k in range(8):
            v = 34 + 3 * k + 2 * phrase_pos
            notes.append((bar, k * 0.25, 0.25 if k < 7 else 1.0, T[k], min(v, 66)))
        notes.append((bar, 3.0, 0.5, T[5], 34))
        notes.append((bar, 3.5, 0.5, T[3], 30))
    return notes


# ------------------------------------------------------- all the parts ----
def _held(voice_pitches, vel, max_bars, opts, vel_fn=None):
    """One pitch per bar -> notes, tying repeated pitches across bar lines up
    to max_bars, re-bowing (a fresh note) beyond that."""
    out = []
    b = 1
    while b <= BARS:
        q = voice_pitches[b - 1]
        e = b
        while e + 1 <= BARS and voice_pitches[e] == q and (e + 1 - b) < max_bars:
            e += 1
        v = vel_fn(b) if vel_fn else vel
        out.append((b, 0, 4 * (e - b + 1), q, v, dict(opts)))
        b = e + 1
    return out


def _melody(rows, legato=0.08, opts=None):
    out = []
    for i, (bar, beat, beats, name, vel) in enumerate(rows):
        q = p(name) if isinstance(name, str) else name
        o = dict(opts or {})
        out.append((bar, beat, beats + legato, q, vel, o))
    return out


def parts():
    """layer -> part -> {'inst': sfz name, 'notes': [(bar, beat, beats, pitch, vel, opts)],
    'pedal': bool}. Everything the renderer and the theory check read."""
    L = {}
    bed = {}
    bed['cb'] = {'inst': 'cb', 'notes': _held(BED_CB, 54, 1, {'attack': 0.5, 'release': 1.6})}
    bed['vc'] = {'inst': 'vc', 'notes': _held(BED_VC, 46, 1, {'attack': 0.7, 'release': 1.6})}
    for k, (nm, inst) in enumerate([('pad_vla', 'vla'), ('pad_vln2', 'vln'), ('pad_vln1', 'vln')]):
        bed[nm] = {'inst': inst, 'notes': _held([v[k] for v in BED_PAD], 42, 2, {'attack': 1.2, 'release': 1.8})}
    felt = []
    for bar, evs in BED_FELT.items():
        for (beat, name, vel) in evs:
            felt.append((bar, beat, 4 - beat, p(name), vel, {}))
    bed['felt'] = {'inst': 'felt', 'notes': felt, 'pedal': True}
    bed['glass'] = {'inst': 'vibes_bowed', 'notes': [(b, 0, 12, p(n), 70, {}) for (b, n) in BED_VIBES]}
    L['bed'] = bed

    tj = {'melody': {'inst': 'vc', 'notes': _melody(TJ_MELODY, 0.1, {'attack': 0.14, 'release': 0.9})}}
    for k, (nm, inst) in enumerate([('chord_vla', 'vla'), ('chord_vln2', 'vln'), ('chord_vln1', 'vln')]):
        tj[nm] = {'inst': inst, 'notes': _held([v[k] for v in TJ_CHORDS], 56 - 2 * k, 2, {'attack': 0.55, 'release': 1.5})}
    L['triple-j'] = tj

    left, right, chimes = lead_to_title()
    L['lead-to-title'] = {
        'vibes_l': {'inst': 'vibes_short', 'notes': [n + ({},) for n in left]},
        'vibes_r': {'inst': 'vibes_short', 'notes': [n + ({},) for n in right]},
        'chimes': {'inst': 'chimes', 'notes': [n + ({},) for n in chimes]},
    }

    L['the-inbound'] = {
        'cello': {'inst': 'vc', 'notes': _melody(INB_CELLO, 0.1, {'attack': 0.16, 'release': 1.0})},
        'piano': {'inst': 'piano', 'notes': _melody(INB_PIANO, 0.0) + _melody(INB_PIANO_LH, 0.0), 'pedal': True},
    }

    mar = prospector()
    L['prospector'] = {
        'marimba': {'inst': 'marimba', 'notes': [n + ({},) for n in mar]},
        # a dotted-eighth echo, dropped where it would spill into the next chord
        'marimba_echo': {'inst': 'marimba', 'notes': [(b, bt + 0.75, min(d, 4 - bt - 0.75), q, max(1, v - 16), {}) for (b, bt, d, q, v) in mar if bt + 0.75 < 4]},
    }

    ns = {'q_vc': {'inst': 'vc', 'notes': _held(NS_BASS, 50, 1, {'attack': 0.4, 'release': 1.2})}}
    for k, (nm, inst) in enumerate([('q_vla', 'vla'), ('q_vln2', 'vln'), ('q_vln1', 'vln')]):
        ns[nm] = {'inst': inst, 'notes': _held([v[k] for v in NS_UPPER], 50, 2, {'attack': 0.4, 'release': 1.2})}
    ns['piano'] = {'inst': 'piano', 'notes': _melody(NS_PIANO, 0.0), 'pedal': True}
    L['neuroscience'] = ns

    ob = {}
    for k, nm in enumerate(['trem_lo', 'trem_hi']):
        ob[nm] = {'inst': 'vla_trem', 'notes': _held([v[k] for v in OB_TREM], 40, 1, {'attack': 0.9, 'release': 1.6})}
    ob['voice'] = {'inst': 'vln', 'notes': [(b, 0, 8 + 1.0, p(OB_VOICE), 44, {'attack': 1.6, 'release': 2.0}) for b in range(1, BARS + 1, 2)]}
    ob['voice_glass'] = {'inst': 'vibes_bowed', 'notes': [(b, 0, 16, p(OB_VOICE), 80, {}) for b in (1, 5, 9, 13)]}
    L['obavia'] = ob
    return L
