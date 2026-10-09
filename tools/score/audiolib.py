"""Shared audio toolchain: MIDI writing, sfizz/fluidsynth rendering, DSP
(EQ, filters, convolution reverb, tape saturation, linked bus compression,
true-peak limiting), loudness measurement, encoding and spectrograms.
Everything runs at 48 kHz, float64 internally."""
import os, json, subprocess, re, tempfile, shutil
import numpy as np
import soundfile as sf
from scipy import signal
import numba

SR = 48000
# The work root holds the downloaded libraries (src/, dl/), generated SFZ maps
# (sfz/), impulse responses (ir/) and intermediate renders (build/). Nothing in
# it belongs in the repo. Point SCORE_WORK at your own copy (see README.md).
ROOT = os.environ.get('SCORE_WORK', '/tmp/claude-0/-home-user-jasonresume/01fbfe3c-4438-5d4b-acfd-b24db03f562e/scratchpad/audio')
FFMPEG = os.environ.get('SCORE_FFMPEG', os.path.join(ROOT, 'bin', 'ffmpeg'))
SFZ_DIR = os.path.join(ROOT, 'sfz')
BUILD = os.path.join(ROOT, 'build')
OUT = os.path.join(ROOT, 'out')
TPB = 9600          # MIDI ticks per beat; files are written at 60 BPM so 1 beat = 1 s

NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def nn(name):
    """'Db4' / 'C#3' / 'A0' -> MIDI number (C4 = 60)."""
    m = re.fullmatch(r'([A-G])(#|b)?(-?\d)', name)
    n = NOTE[m.group(1)] + {'#': 1, 'b': -1, None: 0}[m.group(2)]
    return 12 * (int(m.group(3)) + 1) + n


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12.0)


# ----------------------------------------------------------------- MIDI ----
def write_midi(path, notes, ccs=(), program=None, channel=0):
    """notes: iterable of (start_s, dur_s, midi_note, velocity). Times in
    seconds (file tempo is 60 BPM). ccs: (time_s, controller, value)."""
    import mido
    ev = []
    for (t, d, n, v) in notes:
        t = max(0.0, t)
        ev.append((t, 1, mido.Message('note_on', note=int(n), velocity=int(np.clip(v, 1, 127)), channel=channel)))
        ev.append((t + max(d, 0.01), 0, mido.Message('note_off', note=int(n), velocity=0, channel=channel)))
    for (t, c, val) in ccs:
        ev.append((max(0.0, t), 2, mido.Message('control_change', control=int(c), value=int(np.clip(val, 0, 127)), channel=channel)))
    ev.sort(key=lambda e: (e[0], e[1]))   # note-offs before note-ons at equal times
    mid = mido.MidiFile(ticks_per_beat=TPB)
    tr = mido.MidiTrack()
    mid.tracks.append(tr)
    tr.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(60)))
    if program is not None:
        tr.append(mido.Message('program_change', program=program, channel=channel, time=0))
    last = 0
    for (t, _, msg) in ev:
        tick = int(round(t * TPB))
        msg.time = tick - last
        last = tick
        tr.append(msg)
    tr.append(mido.MetaMessage('end_of_track', time=int(2 * TPB)))
    mid.save(path)


# ------------------------------------------------------------ rendering ----
def render_sfz(sfz, notes, out_wav, ccs=(), length=None):
    """Render note events through an SFZ instrument with sfizz_render at 48 kHz.
    Returns float stereo array (n, 2)."""
    os.makedirs(os.path.dirname(out_wav), exist_ok=True)
    mid = out_wav[:-4] + '.mid'
    write_midi(mid, notes, ccs)
    subprocess.run(['sfizz_render', '--sfz', sfz, '--midi', mid, '--wav', out_wav,
                    '-s', str(SR), '-q', '3', '-b', '256', '-p', '256'],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    x, sr = sf.read(out_wav, always_2d=True)
    assert sr == SR
    clip = np.mean(np.abs(x) >= 0.99997)
    if clip > 0:
        raise RuntimeError('sfizz render clipped (%s): lower the SFZ volume' % out_wav)
    return fit(x, length)


def render_sf2(sf2, notes, out_wav, program, bank=0, gain=0.4, ccs=(), length=None):
    """Render with FluidSynth (reverb/chorus off, 7th-order interpolation)."""
    os.makedirs(os.path.dirname(out_wav), exist_ok=True)
    mid = out_wav[:-4] + '.mid'
    write_midi(mid, notes, ccs, program=program)
    cfg = out_wav[:-4] + '.fluid'
    with open(cfg, 'w') as f:
        f.write('interp 7\n')
    subprocess.run(['fluidsynth', '-ni', '-q', '-R', '0', '-C', '0', '-g', str(gain), '-r', str(SR),
                    '-o', 'synth.polyphony=512', '-O', 'float', '-T', 'wav', '-f', cfg,
                    '-F', out_wav, sf2, mid], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    x, sr = sf.read(out_wav, always_2d=True)
    assert sr == SR
    return fit(x, length)


def fit(x, length):
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    if length is None:
        return x
    if len(x) >= length:
        return x[:length]
    return np.vstack([x, np.zeros((length - len(x), x.shape[1]))])


# ---------------------------------------------------------------- filters --
def _apply(sos, x):
    return signal.sosfilt(sos, x, axis=0)


def hpf(x, fc, order=2):
    return _apply(signal.butter(order, fc, 'highpass', fs=SR, output='sos'), x)


def lpf(x, fc, order=2):
    return _apply(signal.butter(order, fc, 'lowpass', fs=SR, output='sos'), x)


def biquad(kind, f0, gain_db=0.0, q=0.707):
    """RBJ cookbook biquad as an SOS row."""
    A = 10 ** (gain_db / 40.0)
    w0 = 2 * np.pi * f0 / SR
    cw, sw = np.cos(w0), np.sin(w0)
    alpha = sw / (2 * q)
    if kind == 'peak':
        b = [1 + alpha * A, -2 * cw, 1 - alpha * A]
        a = [1 + alpha / A, -2 * cw, 1 - alpha / A]
    elif kind == 'lowshelf':
        sa = 2 * np.sqrt(A) * alpha
        b = [A * ((A + 1) - (A - 1) * cw + sa), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sa)]
        a = [(A + 1) + (A - 1) * cw + sa, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sa]
    elif kind == 'highshelf':
        sa = 2 * np.sqrt(A) * alpha
        b = [A * ((A + 1) + (A - 1) * cw + sa), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sa)]
        a = [(A + 1) - (A - 1) * cw + sa, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sa]
    else:
        raise ValueError(kind)
    b = np.array(b) / a[0]
    a = np.array(a) / a[0]
    return np.concatenate([b, a])[None, :]


def eq(x, bands):
    """bands: list of (kind, f0, gain_db, q)."""
    if not bands:
        return x
    sos = np.vstack([biquad(*b) for b in bands])
    return _apply(sos, x)


# --------------------------------------------------------------- reverb ----
def load_ir(path, decay_scale=None, hp=None, lp=None):
    """Load an IR, resample to 48 kHz, trim leading silence (keep 1 ms),
    optionally shorten its decay by an exponential window (decay_scale = target
    RT60 / measured RT60), normalise to unit energy."""
    ir, sr = sf.read(path, always_2d=True)
    if sr != SR:
        g = np.gcd(SR, sr)
        ir = signal.resample_poly(ir, SR // g, sr // g, axis=0)
    on = np.argmax(np.abs(ir).max(1) > 1e-3 * np.abs(ir).max())
    ir = ir[max(0, on - SR // 1000):]
    if ir.shape[1] == 1:
        ir = np.hstack([ir, ir])
    if decay_scale:
        rt, s = decay_scale
        t = np.arange(len(ir)) / SR
        # extra decay so RT60 becomes s*rt: multiply by exp(-k t), with
        # 60 dB over s*rt total, original gives 60 dB over rt
        k = (6.91 / (s * rt)) - (6.91 / rt)
        ir = ir * np.exp(-k * t)[:, None]
    if hp:
        ir = hpf(ir, hp, 2)
    if lp:
        ir = lpf(ir, lp, 2)
    # fade the last 50 ms and trim where energy is negligible
    e = np.cumsum((ir ** 2).sum(1)[::-1])[::-1]
    end = np.argmax(e < e[0] * 1e-7) or len(ir)
    ir = ir[:end]
    n = min(len(ir), int(0.05 * SR))
    ir[-n:] *= np.linspace(1, 0, n)[:, None]
    ir /= np.sqrt((ir ** 2).sum() / 2)
    return ir


def synth_plate(rt=2.0, hf_rt=1.0, size_ms=0.0, seed=7, length=None):
    """Algorithmic plate IR: dense decorrelated noise with frequency-dependent
    exponential decay (three bands), no early reflections, slight build-up."""
    rng = np.random.default_rng(seed)
    n = int((length or rt * 1.6) * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    bands = [(None, 400, rt * 0.9), (400, 3000, rt), (3000, None, hf_rt)]
    for lo, hi, r in bands:
        noise = rng.standard_normal((n, 2))
        if lo and hi:
            sos = signal.butter(4, [lo, hi], 'bandpass', fs=SR, output='sos')
        elif hi:
            sos = signal.butter(4, hi, 'lowpass', fs=SR, output='sos')
        else:
            sos = signal.butter(4, lo, 'highpass', fs=SR, output='sos')
        nb = signal.sosfiltfilt(sos, noise, axis=0)
        out += nb * np.exp(-6.91 * t / r)[:, None]
    build = 1 - np.exp(-t / 0.004)
    out *= build[:, None]
    out = lpf(out, 11000, 2)
    out /= np.sqrt((out ** 2).sum() / 2)
    return out


def convolve(x, ir, predelay_ms=0.0):
    """Stereo convolution (L->IR_L, R->IR_R); output length = len(x) (+ tail
    if the caller pads x). Returns wet signal only."""
    d = int(predelay_ms * SR / 1000)
    y = np.zeros_like(x)
    for c in range(2):
        w = signal.oaconvolve(x[:, c], ir[:, c], mode='full')[:len(x) - d]
        y[d:, c] = w
    return y


# ----------------------------------------------------------- saturation ----
def tape(x, drive_db=3.0, bias=0.08, mix=1.0, linear_only=False):
    """Tape-style soft saturation: 4x oversampled asymmetric tanh, level
    compensated so small signals pass at unity, then the linear part of a
    tape path (gentle head bump, slight HF loss, DC removal).
    linear_only=True returns just the linear path, so the nonlinear residual
    (the actual distortion added) can be measured as tape(x) - tape(x, linear_only=True)."""
    if drive_db is None:
        return x
    if linear_only:
        y = x
    else:
        d = 10 ** (drive_db / 20.0)
        up = signal.resample_poly(x, 4, 1, axis=0)
        y = (np.tanh(d * up + bias) - np.tanh(bias)) / (d * (1 - np.tanh(bias) ** 2))
        y = signal.resample_poly(y, 1, 4, axis=0)[:len(x)]
    y = hpf(y, 10, 1)
    y = eq(y, [('peak', 90, 0.6, 0.8), ('highshelf', 14000, -0.8, 0.7)])
    return mix * y + (1 - mix) * x


def tape_residual(x, drive_db):
    """Distortion actually added by tape(): energy of the nonlinear residual
    relative to the linear path, in dB."""
    y = tape(x, drive_db)
    lin = tape(x, drive_db, linear_only=True)
    return 10 * np.log10(((y - lin) ** 2).sum() / ((lin ** 2).sum() + 1e-30) + 1e-30)


def tape_calibrated(x, target_resid_db):
    """Choose the tape drive by bisection so the added distortion lands at
    target_resid_db (e.g. -40 dB = subtle warmth). Returns (y, drive, resid)."""
    # calibrate on the loudest 30 s (where saturation matters most)
    w = int(15 * SR)
    if len(x) > w:
        e = np.convolve((x ** 2).sum(1)[::480], np.ones(w // 480), mode='valid')
        st = int(np.argmax(e)) * 480
        probe = x[st:st + w]
    else:
        probe = x
    lo, hi = -30.0, 12.0
    for _ in range(9):
        mid = 0.5 * (lo + hi)
        r = tape_residual(probe, mid)
        if r > target_resid_db:
            hi = mid
        else:
            lo = mid
    d = 0.5 * (lo + hi)
    return tape(x, d), d, tape_residual(x, d)


# ---------------------------------------------------- dynamics (linked) ----
@numba.njit(cache=True)
def _smooth_gain(gr_db, att, rel):
    out = np.empty_like(gr_db)
    s = 0.0
    for i in range(len(gr_db)):
        g = gr_db[i]
        if g < s:      # more reduction (gr is <= 0): attack
            s = att * s + (1 - att) * g
        else:
            s = rel * s + (1 - rel) * g
        out[i] = s
    return out


def compressor_gain(x, thr_db=-20.0, ratio=1.6, attack_ms=30.0, release_ms=250.0,
                    knee_db=6.0, rms_ms=20.0, sc_hpf=90.0):
    """Stereo-linked RMS compressor. Returns a per-sample linear gain curve so
    the same gain can be applied to every stem (stems keep summing to the mix)."""
    sc = hpf(x, sc_hpf, 2) if sc_hpf else x
    p = (sc ** 2).mean(1)
    a = np.exp(-1.0 / (rms_ms * 1e-3 * SR))
    p = signal.lfilter([1 - a], [1, -a], p)
    lev = 10 * np.log10(p + 1e-12)
    over = lev - thr_db
    gr = np.where(over <= -knee_db / 2, 0.0,
                  np.where(over >= knee_db / 2, -(1 - 1 / ratio) * over,
                           -(1 - 1 / ratio) * (over + knee_db / 2) ** 2 / (2 * knee_db)))
    att = np.exp(-1.0 / (attack_ms * 1e-3 * SR))
    rel = np.exp(-1.0 / (release_ms * 1e-3 * SR))
    g = _smooth_gain(gr.astype(np.float64), att, rel)
    return 10 ** (g / 20.0)


@numba.njit(cache=True)
def _release(s, rel):
    out = np.empty_like(s)
    r = 1.0
    for i in range(len(s)):
        r = r + (1.0 - r) * (1 - rel)
        if s[i] < r:
            r = s[i]
        out[i] = r
    return out


def true_peak_env(x, os_factor=4):
    up = signal.resample_poly(x, os_factor, 1, axis=0)
    a = np.abs(up).max(1)
    n = len(x)
    a = a[:n * os_factor].reshape(n, os_factor).max(1)
    return a


def limiter_gain(x, ceiling_db=-1.2, lookahead_ms=5.0, release_ms=120.0):
    """Look-ahead true-peak limiter gain (linear, per sample), offline.
    req[n] = ceiling / true_peak[n]; m = centred min over +-L; s = centred box
    mean of m over +-L/2 (so s[n] <= req[n] everywhere); then instant attack,
    exponential release. Result never exceeds the required gain."""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    c = 10 ** (ceiling_db / 20.0)
    tp = true_peak_env(x)
    req = np.minimum(1.0, c / np.maximum(tp, 1e-12))
    L = max(2, int(lookahead_ms * SR / 1000))
    h = L // 2
    m = minimum_filter1d(req, size=2 * L + 1, mode='nearest')
    s = uniform_filter1d(m, size=2 * h + 1, mode='nearest')
    rel = np.exp(-1.0 / (release_ms * 1e-3 * SR))
    g = _release(np.minimum(s, req).astype(np.float64), rel)
    return np.minimum(g, req)


# ------------------------------------------------------------- measuring ---
def lufs(x):
    import pyloudnorm as pyln
    return pyln.Meter(SR).integrated_loudness(x)


def ffmpeg_ebur128(path):
    """Integrated loudness, LRA and true peak as measured by ffmpeg ebur128."""
    r = subprocess.run([FFMPEG, '-hide_banner', '-nostats', '-i', path, '-af',
                        'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'],
                       capture_output=True, text=True)
    t = r.stderr
    tail = t[t.rfind('Summary:'):]
    I = float(re.search(r'I:\s+(-?[\d.]+|-inf) LUFS', tail).group(1))
    LRA = float(re.search(r'LRA:\s+(-?[\d.]+) LU', tail).group(1))
    tp = re.search(r'Peak:\s+(-?[\d.]+|-inf) dBFS', tail)
    TP = float(tp.group(1)) if tp else float('nan')
    return {'I': I, 'LRA': LRA, 'TP': TP}


def kweight(x):
    """ITU-R BS.1770 K-weighting at 48 kHz."""
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    y = signal.lfilter(b1, a1, x, axis=0)
    return signal.lfilter(b2, a2, y, axis=0)


def momentary_max(x):
    """Max momentary loudness (400 ms K-weighted window, LUFS), for short
    sounds where integrated loudness is not meaningful."""
    pad = np.vstack([x, np.zeros((int(0.4 * SR), 2))])
    y = kweight(pad)
    p = (y ** 2).sum(1)
    w = int(0.4 * SR)
    c = np.cumsum(np.concatenate([[0], p]))
    ms = (c[w:] - c[:-w]) / w
    return -0.691 + 10 * np.log10(ms.max() + 1e-20)


def peak_db(x):
    return 20 * np.log10(np.abs(x).max() + 1e-20)


def tp_db(x):
    return 20 * np.log10(true_peak_env(x).max() + 1e-20)


# ------------------------------------------------------------- encoding ----
def write_wav(path, x, subtype='PCM_24'):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sf.write(path, x, SR, subtype=subtype)


def encode(wav, base, opus_kbps=128, mp3_kbps=192, mono=False):
    """wav -> base.ogg (Opus) and base.mp3 (LAME CBR, gapless header).
    Returns the two paths."""
    ac = ['-ac', '1'] if mono else []
    ogg, mp3 = base + '.ogg', base + '.mp3'
    subprocess.run([FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', '-i', wav] + ac +
                   ['-c:a', 'libopus', '-b:a', '%dk' % opus_kbps, '-vbr', 'on',
                    '-compression_level', '10', '-application', 'audio', ogg], check=True)
    subprocess.run([FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', '-i', wav] + ac +
                   ['-c:a', 'libmp3lame', '-b:a', '%dk' % mp3_kbps, '-q:a', '0', mp3], check=True)
    return ogg, mp3


def decode(path):
    """Decode any file to float 48 kHz stereo via ffmpeg (for verification)."""
    tmp = tempfile.mktemp(suffix='.wav', dir=BUILD)
    subprocess.run([FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', '-i', path,
                    '-ar', str(SR), '-ac', '2', '-c:a', 'pcm_f32le', tmp], check=True)
    x, _ = sf.read(tmp, always_2d=True)
    os.remove(tmp)
    return x


# ----------------------------------------------------------- spectrogram ---
def spectrogram_png(x, path, title, marks=(), mark_labels=(), fmin=20, fmax=20000):
    """Log-frequency spectrogram (mid channel) with a long-term average
    spectrum panel and band-energy readout."""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    m = x.mean(1) if x.ndim == 2 else x
    nfft = 8192
    hop = 1024
    f, t, S = signal.stft(m, SR, nperseg=nfft, noverlap=nfft - hop, window='hann')
    P = np.abs(S) ** 2
    db = 10 * np.log10(P + 1e-14)
    ref = db.max()
    fig = plt.figure(figsize=(14, 8.5), dpi=100)
    ax = fig.add_axes([0.06, 0.38, 0.86, 0.55])
    sel = (f >= fmin) & (f <= fmax)
    im = ax.pcolormesh(t, f[sel], db[sel] - ref, shading='auto', cmap='magma', vmin=-90, vmax=0)
    ax.set_yscale('log')
    ax.set_ylim(fmin, fmax)
    ax.set_ylabel('Hz')
    ax.set_title(title)
    for i, mk in enumerate(marks):
        ax.axvline(mk, color='cyan', lw=0.6, alpha=0.6)
        if i < len(mark_labels):
            ax.text(mk, fmax * 0.8, mark_labels[i], color='cyan', fontsize=8)
    for yb in (200, 400):
        ax.axhline(yb, color='w', lw=0.4, ls=':', alpha=0.5)
    cax = fig.add_axes([0.93, 0.38, 0.01, 0.55])
    fig.colorbar(im, cax=cax, label='dB')
    # LTAS
    ax2 = fig.add_axes([0.06, 0.06, 0.5, 0.25])
    fw, Pw = signal.welch(m, SR, nperseg=16384)
    ok = (fw >= fmin) & (fw <= fmax)
    L = 10 * np.log10(Pw[ok] + 1e-20)
    ax2.semilogx(fw[ok], L - L.max(), lw=0.8)
    # pink reference (-3 dB/oct) anchored at 1 kHz
    i1k = np.argmin(np.abs(fw[ok] - 1000))
    ax2.semilogx(fw[ok], (L - L.max())[i1k] - 10 * np.log10(fw[ok] / 1000), 'k--', lw=0.5, alpha=0.6)
    ax2.set_xlim(fmin, fmax)
    ax2.set_ylim(-100, 3)
    ax2.set_title('long-term average spectrum (dashed: pink -3 dB/oct ref @1k)', fontsize=9)
    ax2.grid(alpha=0.3, which='both')
    # band energies
    bands = band_energies(m)
    ax3 = fig.add_axes([0.62, 0.06, 0.32, 0.25])
    ax3.axis('off')
    txt = 'band energy share (dB re total)\n' + '\n'.join('%-16s %6.1f dB' % (k, v) for k, v in bands.items())
    ax3.text(0, 1, txt, va='top', family='monospace', fontsize=9)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fig.savefig(path)
    plt.close(fig)
    return bands


BANDS = [('sub 20-60', 20, 60), ('low 60-200', 60, 200), ('mud 200-400', 200, 400),
         ('lowmid 400-1k', 400, 1000), ('mid 1k-4k', 1000, 4000),
         ('presence 4k-8k', 4000, 8000), ('air 8k-16k', 8000, 16000), ('top 16k-20k', 16000, 20000)]


def band_energies(m):
    fw, Pw = signal.welch(m, SR, nperseg=16384)
    tot = Pw[(fw >= 20) & (fw <= 20000)].sum() + 1e-30
    return {name: 10 * np.log10(Pw[(fw >= lo) & (fw < hi)].sum() / tot + 1e-20) for name, lo, hi in BANDS}
