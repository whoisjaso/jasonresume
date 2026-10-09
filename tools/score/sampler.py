"""Deterministic offline SFZ renderer.

Why: sfizz_render 1.2.3 (OBS build) streams samples from disk on a background
thread and, in testing, randomly rendered only the preloaded first ~0.2 s of a
note (1 in 3 identical renders cut out). This renderer loads whole samples, so
the same score always renders to the same audio.

Supported SFZ subset (everything the instruments here use):
  <control> default_path; <global>/<master>/<group>/<region> inheritance
  sample lokey hikey key lovel hivel pitch_keycenter pitch_keytrack tune
  transpose volume amp_veltrack offset ampeg_attack ampeg_release
  xfin_lovel xfin_hivel xfout_lovel xfout_hivel (equal power)
  seq_length seq_position lorand hirand trigger=attack|release rt_decay
  loop_mode=one_shot  fil_type=lpf_2p cutoff fil_veltrack resonance
  on_locc64/on_hicc64 (pedal noises)   sustain pedal via CC64
Pitch shifting and the 44.1->48 kHz conversion are one polyphase resampling
step (Kaiser beta 9, ~ -90 dB stopband), with the ratio held to < 0.01 cent.
"""
import os, re
from fractions import Fraction
import numpy as np
import soundfile as sf
from scipy import signal

SR = 48000
_SAMPLE_CACHE = {}
_RS_CACHE = {}


def _parse_opcodes(text):
    out = {}
    ms = list(re.finditer(r'(?:(?<=\s)|^)([A-Za-z_][A-Za-z0-9_]*)=', text))
    for i, m in enumerate(ms):
        end = ms[i + 1].start() if i + 1 < len(ms) else len(text)
        out[m.group(1)] = text[m.end():end].strip()
    return out


def parse_sfz(path):
    txt = open(path).read()
    txt = re.sub(r'//[^\n]*', '', txt)
    base = os.path.dirname(os.path.abspath(path))
    default_path = ''
    levels = {'global': {}, 'master': {}, 'group': {}}
    regions = []
    for m in re.finditer(r'<(\w+)>([^<]*)', txt):
        head, body = m.group(1), m.group(2)
        ops = _parse_opcodes(body.replace('\n', ' '))
        if head == 'control':
            default_path = ops.get('default_path', default_path)
        elif head == 'global':
            levels = {'global': ops, 'master': {}, 'group': {}}
        elif head == 'master':
            levels['master'] = ops
            levels['group'] = {}
        elif head == 'group':
            levels['group'] = ops
        elif head == 'region':
            r = {}
            r.update(levels['global'])
            r.update(levels['master'])
            r.update(levels['group'])
            r.update(ops)
            s = r['sample'].replace('\\', '/')
            if not os.path.isabs(s):
                s = os.path.join(default_path or base, s)
            r['sample'] = s
            regions.append(_norm(r))
    return regions


def _norm(r):
    f = lambda k, d: float(r[k]) if k in r else d
    i = lambda k, d: int(float(r[k])) if k in r else d
    key = i('key', None)
    o = {
        'sample': r['sample'],
        'lokey': key if key is not None else i('lokey', 0),
        'hikey': key if key is not None else i('hikey', 127),
        'lovel': i('lovel', 1), 'hivel': i('hivel', 127),
        'center': key if key is not None and 'pitch_keycenter' not in r else i('pitch_keycenter', 60),
        'keytrack': f('pitch_keytrack', 100.0),
        'tune': f('tune', 0.0) + 100 * f('transpose', 0.0),
        'volume': f('volume', 0.0),
        'veltrack': f('amp_veltrack', 100.0),
        'offset': i('offset', 0),
        'attack': f('ampeg_attack', 0.0),
        'release': f('ampeg_release', 0.001),
        'xfin': (i('xfin_lovel', 0), i('xfin_hivel', 0)),
        'xfout': (i('xfout_lovel', 127), i('xfout_hivel', 127)),
        'seq_length': i('seq_length', 1), 'seq_position': i('seq_position', 1),
        'lorand': f('lorand', 0.0), 'hirand': f('hirand', 1.0),
        'trigger': r.get('trigger', 'attack'),
        'rt_decay': f('rt_decay', 0.0),
        'one_shot': r.get('loop_mode', '') == 'one_shot',
        'fil_type': r.get('fil_type', ''), 'cutoff': f('cutoff', 0.0),
        'fil_veltrack': f('fil_veltrack', 0.0), 'resonance': f('resonance', 0.0),
        'on_cc64': (i('on_locc64', -1), i('on_hicc64', -1)) if 'on_locc64' in r else None,
    }
    if o['center'] is None:
        o['center'] = 60
    return o


def _load(path):
    if path not in _SAMPLE_CACHE:
        x, sr = sf.read(path, always_2d=True, dtype='float64')
        if x.shape[1] == 1:
            x = np.hstack([x, x])
        _SAMPLE_CACHE[path] = (x[:, :2], sr)
    return _SAMPLE_CACHE[path]


def _resampled(path, offset, ratio, need_out):
    """Sample from `offset`, pitch-shifted by `ratio` (frequency ratio) and
    converted to 48 kHz; returns at least need_out output frames if available."""
    x, sr = _load(path)
    factor = Fraction(sr * ratio / SR).limit_denominator(4000)
    up, down = factor.denominator, factor.numerator
    key = (path, offset, up, down)
    cached = _RS_CACHE.get(key)
    if cached is not None and (len(cached) >= need_out or cached.shape[0] * down / up >= len(x) - offset - 64):
        return cached
    need_in = int(need_out * down / up) + 256
    seg = x[offset:offset + need_in]
    if up == down:
        y = seg.copy()
    else:
        y = signal.resample_poly(seg, up, down, axis=0, window=('kaiser', 9.0))
    _RS_CACHE[key] = y
    return y


class Instrument:
    def __init__(self, sfz_path, seed=1):
        self.regions = parse_sfz(sfz_path)
        self.rng = np.random.default_rng(seed)
        self.seq = {}

    def _match(self, note, vel, trigger, rnd):
        out = []
        for r in self.regions:
            if r['on_cc64'] is not None or r['trigger'] != trigger:
                continue
            if not (r['lokey'] <= note <= r['hikey'] and r['lovel'] <= vel <= r['hivel']):
                continue
            if not (r['lorand'] <= rnd < r['hirand'] or (r['hirand'] >= 1 and rnd >= r['lorand'])):
                continue
            out.append(r)
        # round robin
        if any(r['seq_length'] > 1 for r in out):
            c = self.seq.get(note, 0)
            out = [r for r in out if r['seq_length'] == 1 or (c % r['seq_length']) + 1 == r['seq_position']]
            if trigger == 'attack':
                self.seq[note] = c + 1
        return out

    @staticmethod
    def _xf(r, vel):
        g = 1.0
        lo, hi = r['xfin']
        if hi > lo and vel < hi:
            g *= np.sqrt(np.clip((vel - lo) / (hi - lo), 0, 1))
        lo, hi = r['xfout']
        if hi > lo and vel > lo:
            g *= np.sqrt(np.clip((hi - vel) / (hi - lo), 0, 1))
        return g

    def _voice(self, r, note, vel, start, dur, out, gain_extra=1.0, opts=None):
        """Render one region voice into out (n,2) at `start` seconds, released
        after `dur` seconds (None = never released)."""
        vt = r['veltrack'] / 100.0
        amp = (1 - vt) + vt * (vel / 127.0) ** 2
        amp *= 10 ** (r['volume'] / 20.0) * self._xf(r, vel) * gain_extra
        if amp <= 1e-7:
            return
        cents = (note - r['center']) * r['keytrack'] + r['tune']
        ratio = 2 ** (cents / 1200.0)
        opts = opts or {}
        rel = max(opts.get('release', r['release']), 0.003)
        attack = opts.get('attack', r['attack'])
        if r['one_shot'] or dur is None:
            need = len(out) - int(start * SR)
        else:
            need = int((dur + rel) * SR) + 16
        need = max(0, min(need, len(out) - int(start * SR)))
        if need <= 0:
            return
        y = _resampled(r['sample'], r['offset'], ratio, need)[:need]
        n = len(y)
        if n == 0:
            return
        env = np.ones(n)
        a = int(attack * SR)
        if a > 0:
            # raised-cosine swell for long attacks, linear for short ones
            ramp = np.linspace(0, 1, a)
            if attack > 0.15:
                ramp = 0.5 - 0.5 * np.cos(np.pi * ramp)
            env[:min(a, n)] = ramp[:min(a, n)]
        if not r['one_shot'] and dur is not None:
            k = int(dur * SR)
            if k < n:
                t = np.arange(n - k) / SR
                level = env[k] if k < n else 1.0
                env[k:] = level * np.power(10.0, -3.0 * t / rel)     # -60 dB at `rel`
                cut = k + int(rel * SR)
                if cut < n:
                    env[cut:] = 0
        yy = y * (env * amp)[:, None]
        if r['fil_type'].startswith('lpf') and r['cutoff'] > 0:
            fc = r['cutoff'] * 2 ** (r['fil_veltrack'] * (vel / 127.0) / 1200.0)
            fc = min(fc, 0.45 * SR)
            q = 0.707 * 10 ** (r['resonance'] / 20.0)
            b, a_ = signal.butter(2, fc, 'lowpass', fs=SR)
            yy = signal.lfilter(b, a_, yy, axis=0)
        s = int(round(start * SR))
        if s < 0:
            yy = yy[-s:]
            s = 0
        e = min(len(out), s + len(yy))
        out[s:e] += yy[:e - s]

    def render(self, notes, length, ccs=()):
        """notes: (start_s, dur_s, midi, vel[, opts]) where opts may override
        'attack' and 'release' (s) per note. ccs: (time_s, 64, value) for the
        sustain pedal. Returns (length, 2) float array."""
        out = np.zeros((length, 2))
        # sustain pedal: extend note-offs to the next pedal-up
        pedal = sorted([(t, v) for (t, c, v) in ccs if c == 64])

        def pedal_down(t):
            st = False
            for (pt, v) in pedal:
                if pt <= t:
                    st = v >= 64
                else:
                    break
            return st

        def next_up(t):
            for (pt, v) in pedal:
                if pt > t and v < 64:
                    return pt
            return None
        notes = sorted(notes, key=lambda e: e[:4])
        for ev in notes:
            t, d, n, v = ev[:4]
            opts = ev[4] if len(ev) > 4 else None
            off = t + d
            if pedal and pedal_down(off):
                up = next_up(off)
                off = up if up is not None else length / SR
            # a re-struck key damps the previous voice of that key (piano-like)
            dur = off - t
            rnd = self.rng.random()
            for r in self._match(n, v, 'attack', rnd):
                self._voice(r, n, v, t, dur, out, opts=opts)
            for r in self._match(n, v, 'release', rnd):
                att = 10 ** (-(r['rt_decay'] * dur) / 20.0)
                self._voice(r, n, v, off, None, out, gain_extra=att)
        # pedal mechanics noises
        for (pt, v) in pedal:
            rnd = self.rng.random()
            for r in self.regions:
                if r['on_cc64'] and r['on_cc64'][0] <= v <= r['on_cc64'][1] and r['lorand'] <= rnd < r['hirand']:
                    self._voice(r, r['center'], 100, pt, None, out)
        return out
