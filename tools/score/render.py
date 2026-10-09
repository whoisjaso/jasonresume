"""Render the After Hours Library score: eight stems (the bed and seven title
layers), eight stings and three ticks, encoded for the web into
assets/score/ with score.json.

  python3 render.py            render everything
  python3 render.py --only bed obavia start   render a subset (others are reused)

Pipeline per stem: every part is rendered on a timeline that starts PRE
seconds before bar 1 and runs TAIL seconds past bar 17; each part is
filtered, gently saturated, panned and sent to reverbs; the stem's own reverb
returns are added; then the pre-roll is folded onto the loop's end and the
tail onto its head, so each stem is exactly LOOP_N samples and gapless.
Loudness: the bed is set so that bed x 0.85 sits near -21 LUFS; each title
layer is set so bed x 0.85 + layer x level measures -18.0 LUFS integrated.
"""
import os, sys, json, argparse, subprocess
import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audiolib as A
import gapless
import score as S
from sampler import Instrument

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
ASSETS = os.path.join(REPO, 'assets', 'score')
WAV = os.path.join(A.BUILD, 'score')          # 24-bit masters (scratch only, never committed)
VOX = os.path.join(A.ROOT, 'dl', 'voxengo')
SR = A.SR
N = S.LOOP_N
PRE_N = int(S.PRE * SR)
TAIL_N = int(12.0 * SR)
TOTAL = PRE_N + N + TAIL_N
META = json.load(open(os.path.join(A.SFZ_DIR, 'instruments.json')))

LEVELS = {'bed': 0.85, 'triple-j': 0.8, 'lead-to-title': 0.8, 'the-inbound': 0.8,
          'prospector': 0.8, 'neuroscience': 0.8, 'obavia': 0.8}
PAIR_TARGET = -18.0       # LUFS, bed x 0.85 + one layer x its level
BED_ALONE = -21.0         # LUFS, bed x 0.85
STING_TARGET = {'start': -24.0, 'open': -26.0, 'select': -29.0, 'trophy-bronze': -25.0,
                'trophy-silver': -24.5, 'trophy-gold': -24.0, 'trophy-platinum': -23.5, 'level-clear': -23.0}
STING_GAIN = 1.0          # manifest stingGain; the player also scales stings by 0.9
TICK_PEAK = -18.0         # dBFS in the file; the player plays ticks at tickGain
TICK_GAIN = 0.5

# --------------------------------------------------------------- mixing ---
FAMILY = {
    'vln': dict(hpf=150, eq=[('peak', 320, -2.0, 1.0), ('highshelf', 8000, 0.5, 0.7)], tape=-40, send={'hall': 0.30, 'chamber': 0.08}),
    'vla': dict(hpf=100, eq=[('peak', 300, -2.5, 1.0)], tape=-40, send={'hall': 0.30, 'chamber': 0.08}),
    'vc': dict(hpf=45, eq=[('peak', 250, -2.5, 0.9)], tape=-38, send={'hall': 0.26, 'chamber': 0.10}),
    'cb': dict(hpf=28, lpf=5000, eq=[('peak', 220, -2.0, 0.9)], tape=-34, send={'hall': 0.14}),
    'vla_trem': dict(hpf=110, lpf=6000, eq=[('peak', 300, -2.0, 1.0), ('peak', 3500, -2.0, 1.0)], tape=-40, send={'hall': 0.40}),
    'vln_trem': dict(hpf=150, lpf=6500, eq=[('peak', 3500, -2.0, 1.0)], tape=-40, send={'hall': 0.40}),
    'felt': dict(hpf=38, eq=[('peak', 180, -2.0, 0.9), ('peak', 300, -1.5, 1.0)], tape=-42, send={'hall': 0.26, 'chamber': 0.16}),
    'piano': dict(hpf=60, eq=[('peak', 280, -2.0, 0.9), ('peak', 3200, -1.0, 1.2), ('highshelf', 9000, 1.0, 0.7)],
                  tape=-42, send={'chamber': 0.18, 'hall': 0.24, 'plate': 0.05}),
    'vibes': dict(hpf=120, eq=[('peak', 3000, -1.0, 1.0)], tape=None, send={'plate': 0.20, 'hall': 0.26}),
    'vibes_short': dict(hpf=140, eq=[('peak', 3000, -1.0, 1.0)], tape=None, send={'plate': 0.20, 'hall': 0.24}),
    'vibes_bowed': dict(hpf=180, eq=[('highshelf', 8000, -2.0, 0.7)], tape=None, send={'hall': 0.40, 'plate': 0.10}),
    'chimes': dict(hpf=200, eq=[('highshelf', 9000, -1.5, 0.7)], tape=None, send={'plate': 0.22, 'hall': 0.30}),
    'marimba': dict(hpf=90, eq=[('peak', 300, -1.5, 1.0)], tape=-42, send={'plate': 0.12, 'hall': 0.24, 'chamber': 0.10}),
}
# per part: (pan, loudness target LUFS within the stem, extra overrides)
PART = {
    'bed': {'cb': (0.2, -29.0, {}), 'vc': (0.3, -29.5, {'eq': [('peak', 250, -3.0, 0.9)]}), 'pad_vla': (0.15, -29.5, {'send': {'hall': 0.38}}),
            'pad_vln2': (-0.15, -30.5, {'send': {'hall': 0.38}}), 'pad_vln1': (-0.3, -30.5, {'send': {'hall': 0.38}}),
            'felt': (0.0, -24.0, {}), 'glass': (0.05, -34.0, {})},
    'triple-j': {'melody': (0.1, -21.0, {'hpf': 80, 'eq': [('peak', 250, -3.0, 0.9), ('peak', 2200, 2.0, 0.8)]}), 'chord_vla': (0.25, -28.0, {}), 'chord_vln2': (-0.2, -29.0, {}),
                 'chord_vln1': (-0.35, -29.5, {})},
    'lead-to-title': {'vibes_l': (-0.6, -24.0, {}), 'vibes_r': (0.6, -25.0, {}), 'chimes': (0.0, -31.0, {})},
    'the-inbound': {'cello': (0.25, -22.0, {'hpf': 70, 'eq': [('peak', 250, -3.0, 0.9), ('peak', 2200, 1.5, 0.8)]}), 'piano': (-0.15, -23.0, {})},
    'prospector': {'marimba': (-0.25, -22.0, {}), 'marimba_echo': (0.5, -28.5, {})},
    'neuroscience': {'q_vc': (0.35, -27.0, {'hpf': 60}), 'q_vla': (0.15, -28.0, {}), 'q_vln2': (-0.15, -28.5, {}),
                     'q_vln1': (-0.35, -28.0, {}), 'piano': (0.0, -22.0, {})},
    'obavia': {'trem_lo': (0.25, -27.5, {}), 'trem_hi': (-0.25, -27.5, {}), 'voice': (0.0, -24.0, {'lpf': 4500}),
               'voice_glass': (0.0, -30.0, {})},
}
AIR_DB = {'bed': 3.0, 'lead-to-title': 2.0, 'prospector': 2.0}
REVERBS = {'hall': (18.0, 180.0, 11000.0, 1.0), 'chamber': (6.0, 220.0, 11000.0, 0.9), 'plate': (10.0, 300.0, 11000.0, 0.8)}
_INST = {}
_IRS = {}


def inst(name):
    if name not in _INST:
        _INST[name] = Instrument(os.path.join(A.SFZ_DIR, name + '.sfz'), seed=len(_INST) + 1)
    return _INST[name]


def irs():
    if not _IRS:
        # Voxengo "Going Home" (RT60 ~3.1 s) shortened to ~2.6 s: the warm hall
        _IRS['hall'] = A.load_ir(os.path.join(VOX, 'Going Home.wav'), decay_scale=(3.1, 2.6 / 3.1))
        # Voxengo "Ruby Room" (~1.0 s): early body
        _IRS['chamber'] = A.load_ir(os.path.join(VOX, 'Ruby Room.wav'))
        # our own algorithmic plate
        _IRS['plate'] = A.synth_plate(rt=2.2, hf_rt=1.1)
    return _IRS


def attack_comp(name):
    fam = {'vln': 'vln', 'vla': 'vla', 'vc': 'vc', 'cb': 'cb', 'vln_trem': 'vln_trem', 'vla_trem': 'vla_trem'}.get(name)
    if not fam:
        return 0.0
    return 0.6 * float(np.median([v['attack'] for v in META[fam].values()]))


def to_events(part, rng, sd):
    """(bar, beat, beats, pitch, vel, opts) -> sampler events in render seconds."""
    comp = attack_comp(part['inst'])
    ev = []
    for (bar, beat, beats, q, vel, opts) in part['notes']:
        t = S.PRE + S.at(bar, beat) - comp + rng.normal(0, sd)
        v = int(np.clip(round(vel + rng.normal(0, 2.5)), 1, 127))
        ev.append((t, beats * S.BEAT, q, v, opts))
    ccs = []
    if part.get('pedal'):
        for bar in range(1, S.BARS + 1):
            t0 = S.PRE + S.at(bar, 0)
            ccs += [(t0 - 0.03, 64, 0), (t0 + 0.06, 64, 127)]
        ccs.append((S.PRE + S.at(S.BARS + 1, 0) - 0.03, 64, 0))
    return ev, ccs


def pan(x, p):
    return x * np.array([1 - max(0.0, p) * 0.6, 1 + min(0.0, p) * 0.6])[None, :]


def process(x, cfg, target):
    if cfg.get('hpf'):
        x = A.hpf(x, cfg['hpf'], 2)
    if cfg.get('lpf'):
        x = A.lpf(x, cfg['lpf'], 2)
    x = A.eq(x, cfg.get('eq', []))
    L = A.lufs(x)
    x = x * 10 ** ((-20.0 - L) / 20.0)
    info = {}
    if cfg.get('tape') is not None:
        x, drive, resid = A.tape_calibrated(x, cfg['tape'])
        info = {'tape_drive_db': round(drive, 1), 'tape_residual_db': round(resid, 1)}
    x = x * 10 ** ((target + 20.0) / 20.0)
    return x, info


def reverb_returns(sends, length):
    out = np.zeros((length, 2))
    for rv, sig in sends.items():
        pre, hp, lp, g = REVERBS[rv]
        wet = A.convolve(sig, irs()[rv], pre)
        out += A.lpf(A.hpf(wet, hp, 2), lp, 2) * g
    return out


def fold(x):
    """Render timeline -> exactly N samples: tail onto the head, pre-roll onto the end."""
    loop = x[PRE_N:PRE_N + N].copy()
    tail = x[PRE_N + N:]
    loop[:len(tail)] += tail
    loop[N - PRE_N:] += x[:PRE_N]
    return loop


def render_stem(layer):
    rng = np.random.default_rng(sum(map(ord, layer)) * 7919)
    P = S.parts()[layer]
    dry = np.zeros((TOTAL, 2))
    sends = {}
    report = {}
    for name, part in P.items():
        sd = 0.006 if part['inst'] in ('piano', 'felt', 'vibes', 'vibes_short', 'marimba', 'chimes') else 0.012
        ev, ccs = to_events(part, rng, sd)
        x = inst(part['inst']).render(ev, TOTAL, ccs)
        cfg = dict(FAMILY[part['inst']])
        pn, target, over = PART[layer][name]
        cfg.update(over)
        x, info = process(x, cfg, target)
        x = pan(x, pn)
        dry += x
        for rv, amt in cfg.get('send', {}).items():
            sends.setdefault(rv, np.zeros((TOTAL, 2)))
            sends[rv] += x * amt
        report[name] = dict(info, lufs=round(A.lufs(x), 1))
    stem = dry + reverb_returns(sends, TOTAL)
    # a little air on every stem (the sampled strings and felt are dark)
    stem = A.eq(stem, [('highshelf', 7000, AIR_DB.get(layer, 2.5), 0.7)])
    end_db = 20 * np.log10(np.abs(stem[-int(0.5 * SR):]).max() + 1e-12) - A.peak_db(stem)
    loop = fold(stem)
    return loop, report, end_db


# --------------------------------------------------------------- stings ---
def render_sting(name):
    spec = S.STINGS[name]
    length = int(spec['length'] * SR)
    pad = int(3.0 * SR)                    # room for reverb before the final fade
    total = length + pad
    dry = np.zeros((total, 2))
    sends = {}
    rng = np.random.default_rng(sum(map(ord, name)))
    for instname, notes in spec.items():
        if instname == 'length':
            continue
        sfz = instname
        ev = [(t, d, q, v, (o[0] if o else {})) for (t, d, q, v, *o) in notes]
        x = inst(sfz).render(ev, total)
        fam = 'vln' if sfz == 'vln' else sfz
        cfg = dict(FAMILY.get(fam, FAMILY['vibes'])) if sfz != 'perc' else dict(hpf=150, eq=[('highshelf', 9000, -2.0, 0.7)], tape=None, send={'hall': 0.35})
        if name == 'select':
            cfg['send'] = {'plate': 0.10, 'chamber': 0.10}
        if sfz in ('cb', 'vc'):
            cfg['hpf'] = 55
        if sfz == 'piano':
            cfg['hpf'] = 70
        if name.startswith('trophy'):
            cfg['send'] = dict(cfg.get('send', {}), plate=cfg.get('send', {}).get('plate', 0.0) + 0.12)
        if sfz == 'piano':                 # keep hammer and soundboard thumps out of the stings
            x = A.hpf(x, 55 if name in ('start', 'level-clear') else 100, 4)
        elif sfz == 'chimes':
            x = A.hpf(x, 300, 4)
        elif cfg.get('hpf'):
            x = A.hpf(x, cfg['hpf'], 2)
        x = A.eq(x, cfg.get('eq', []))
        dry += x
        for rv, amt in cfg.get('send', {}).items():
            sends.setdefault(rv, np.zeros((total, 2)))
            sends[rv] += x * amt
    y = dry + reverb_returns(sends, total)
    y = A.eq(y, [('highshelf', 7000, 2.0, 0.7)])
    y = y[:length]
    # natural ending: fade the last 35% (min 0.15 s) with a raised cosine
    f = max(int(0.15 * SR), int(0.35 * length))
    y[-f:] *= (0.5 + 0.5 * np.cos(np.linspace(0, np.pi, f)))[:, None]
    y[:int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))[:, None]
    eff = 20 * np.log10(STING_GAIN * 0.9)
    g = STING_TARGET[name] - eff - A.momentary_max(y)
    y = y * 10 ** (g / 20)
    tp = A.tp_db(y)
    if tp + eff > -12.0:                   # keep sting peaks well under the music
        y *= 10 ** ((-12.0 - eff - tp) / 20)
    return y


def render_ticks():
    """Felt piano with a muted vibe on top: a 0.22 s pluck, pitched tail, tuned to Db."""
    out = []
    for k, q in enumerate(S.TICKS):
        total = int(0.6 * SR)
        a = inst('felt').render([(0.0, 0.05, q, 38 + 3 * k)], total)
        b = inst('vibes_short').render([(0.0, 0.05, q, 30)], total)
        y = 0.5 * A.hpf(a, 700, 2) + 1.0 * A.hpf(b, 450, 2)
        t = np.arange(total) / SR
        env = np.exp(-t / 0.055)
        env[t > 0.16] *= 0.5 + 0.5 * np.cos(np.pi * np.clip((t[t > 0.16] - 0.16) / 0.06, 0, 1))
        y = y * env[:, None]
        wet = A.convolve(y, irs()['plate'], 4.0) * 0.06
        y = (y + wet)[:int(0.22 * SR)]
        f = int(0.03 * SR)
        y[-f:] *= np.linspace(1, 0, f)[:, None]
        y *= 10 ** ((TICK_PEAK - A.tp_db(y)) / 20)
        out.append(y)
    return out


# ------------------------------------------------------------- encoding ---
def encode(wav, base, opus_kbps):
    ff = A.FFMPEG
    q = ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-ar', str(SR), '-ac', '2']
    subprocess.run([ff] + q + ['-c:a', 'libopus', '-b:a', '%dk' % opus_kbps, '-vbr', 'on', '-compression_level', '10',
                               '-application', 'audio', base + '.ogg'], check=True)
    subprocess.run([ff] + q + ['-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', base + '.m4a'], check=True)
    subprocess.run([ff] + q + ['-c:a', 'libmp3lame', '-b:a', '160k', base + '.mp3'], check=True)
    return {e: os.path.basename(base) + '.' + e for e in ('ogg', 'm4a', 'mp3')}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='*')
    args = ap.parse_args()
    os.makedirs(WAV, exist_ok=True)
    os.makedirs(ASSETS, exist_ok=True)
    layers = list(LEVELS)
    want = set(args.only) if args.only else None
    report = {'parts': {}, 'stems': {}}
    raw = {}
    for layer in layers:
        path = os.path.join(WAV, 'raw_%s.wav' % layer)
        if want is None or layer in want or not os.path.exists(path):
            loop, rep, end_db = render_stem(layer)
            sf.write(path, loop.astype(np.float32), SR, subtype='FLOAT')
            report['parts'][layer] = rep
            report['stems'][layer] = {'render_tail_end_db_re_peak': round(end_db, 1)}
            print('rendered', layer, 'tail end %.0f dB re peak' % end_db, flush=True)
        raw[layer] = sf.read(path, always_2d=True)[0].astype(np.float64)
        assert len(raw[layer]) == N
    # ---- loudness: bed alone, then each layer against the bed
    gb = 10 ** ((BED_ALONE - A.lufs(raw['bed'] * LEVELS['bed'])) / 20)
    bed = raw['bed'] * gb
    gains = {'bed': gb}
    for layer in layers[1:]:
        lo, hi = -40.0, 20.0
        for _ in range(30):
            mid = 0.5 * (lo + hi)
            L = A.lufs(bed * LEVELS['bed'] + raw[layer] * 10 ** (mid / 20) * LEVELS[layer])
            lo, hi = (mid, hi) if L < PAIR_TARGET else (lo, mid)
        gains[layer] = 10 ** (0.5 * (lo + hi) / 20)
    stems = {k: raw[k] * gains[k] for k in layers}
    # safety: no stem or pair may exceed -1 dBTP
    worst = max([A.tp_db(stems[k]) for k in layers] +
                [A.tp_db(stems['bed'] * LEVELS['bed'] + stems[k] * LEVELS[k]) for k in layers[1:]])
    if worst > -1.2:
        trim = 10 ** ((-1.2 - worst) / 20)
        stems = {k: v * trim for k, v in stems.items()}
        report['tp_trim_db'] = round(20 * np.log10(trim), 2)
    manifest = {'bpm': S.BPM, 'beatsPerBar': S.BEATS_PER_BAR, 'loopSeconds': N / SR, 'master': 0.9,
                'stems': {}, 'levels': dict(LEVELS), 'stings': {}, 'stingGain': {}, 'ticks': [], 'tickGain': TICK_GAIN}
    report['gapless'] = {}
    for k in layers:
        w = os.path.join(WAV, '%s.wav' % k)
        sf.write(w, stems[k], SR, subtype='PCM_24')
        q = sf.read(w, always_2d=True)[0]          # encode exactly what the 24-bit master holds
        manifest['stems'][k], report['gapless'][k] = gapless.encode_loop(q, os.path.join(ASSETS, k), A.FFMPEG, SR,
                                                                         96, 128, 160, tmpdir=WAV)
    # ---- stings and ticks
    for name in S.STINGS:
        w = os.path.join(WAV, 'sting_%s.wav' % name)
        if want is None or name in want or not os.path.exists(w):
            y = render_sting(name)
            sf.write(w, y, SR, subtype='PCM_24')
            print('sting', name, '%.2f s' % (len(y) / SR), flush=True)
        manifest['stings'][name] = encode(w, os.path.join(ASSETS, 'sting-' + name), 128)
        manifest['stingGain'][name] = STING_GAIN
    ticks = render_ticks()
    for k, y in enumerate(ticks):
        w = os.path.join(WAV, 'tick_%d.wav' % (k + 1))
        sf.write(w, y, SR, subtype='PCM_24')
        manifest['ticks'].append(encode(w, os.path.join(ASSETS, 'tick-%d' % (k + 1)), 128))
    manifest['credits'] = CREDITS
    with open(os.path.join(ASSETS, 'score.json'), 'w') as f:
        json.dump(manifest, f, indent=2)
        f.write('\n')
    report['gains_db'] = {k: round(20 * np.log10(v), 2) for k, v in gains.items()}
    json.dump(report, open(os.path.join(WAV, 'render_report.json'), 'w'), indent=1)
    print(json.dumps(report['gains_db']), report.get('tp_trim_db'))


CREDITS = ('Salamander Grand Piano by Alexander Holm, CC BY 3.0; strings, felt upright piano, vibraphone, '
           'marimba, hand chimes and suspended cymbal from VSCO 2 Community Edition and the Versilian Community '
           'Sample Library by Versilian Studios (Sam Gossner) and Ivy Audio (Simon Dalzell), CC0; Going Home and '
           'Ruby Room reverb impulse responses by Aleksey Vaneev of Voxengo, free for commercial use under the '
           'Voxengo impulse license.')

if __name__ == '__main__':
    main()
