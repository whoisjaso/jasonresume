"""Measure the shipped score in assets/score/ (nobody can listen here, so
everything is checked by measurement):

  * every loop file in every format decodes (ffmpeg) to loopSeconds within
    one 1024-sample frame; priming and padding read from the file headers
    (Opus pre-skip, AAC edit list, LAME tag)
  * the seam: last 2 s + first 2 s of each decoded loop, sample jump and
    2 ms high-frequency energy at the wrap compared with ordinary bar lines
  * loudness and true peak (ffmpeg ebur128) of the bed alone and of the bed
    plus each title layer at the manifest levels, from the WAV masters and
    from the decoded Opus files; clipping in every decoded file
  * sting and tick levels as the player plays them (stingGain x 0.9 fx bus)
  * sizes, per format and in total
  * spectrograms: every stem, bed + each layer, every sting, the ticks, and
    a seam panel per format, written to $SCORE_WORK/out/score_spectrograms
"""
import os, sys, json, struct, tempfile
import numpy as np
import soundfile as sf
from scipy import signal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audiolib as A
import score as S

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
ASSETS = os.path.join(REPO, 'assets', 'score')
WAV = os.path.join(A.BUILD, 'score')
SPEC = os.path.join(A.OUT, 'score_spectrograms')
SR = A.SR
FMTS = ('ogg', 'm4a', 'mp3')


# ------------------------------------------------------- header parsing ---
def opus_info(path):
    b = open(path, 'rb').read()
    i = b.find(b'OpusHead')
    preskip = struct.unpack('<H', b[i + 10:i + 12])[0]
    last = b.rfind(b'OggS')
    granule = struct.unpack('<q', b[last + 6:last + 14])[0]
    return {'priming_samples': preskip, 'decoded_samples_from_granule': granule - preskip,
            'end_trim': 'final granule position'}


def _boxes(b, start, end):
    i = start
    while i + 8 <= end:
        size, typ = struct.unpack('>I4s', b[i:i + 8])
        hdr = 8
        if size == 1:
            size = struct.unpack('>Q', b[i + 8:i + 16])[0]
            hdr = 16
        if size == 0:
            size = end - i
        yield typ.decode('latin1'), i + hdr, i + size
        i += size


def m4a_info(path):
    b = open(path, 'rb').read()
    out = {}

    def walk(start, end, depth=0):
        for typ, s, e in _boxes(b, start, end):
            if typ in ('moov', 'trak', 'edts', 'mdia', 'minf', 'stbl'):
                walk(s, e, depth + 1)
            elif typ == 'elst':
                ver = b[s]
                n = struct.unpack('>I', b[s + 4:s + 8])[0]
                if ver == 1:
                    dur, mt = struct.unpack('>Qq', b[s + 8:s + 24])
                else:
                    dur, mt = struct.unpack('>Ii', b[s + 8:s + 16])
                out['edit_entries'] = n
                out['edit_segment_duration_movie_ts'] = dur
                out['priming_samples'] = mt
            elif typ == 'mdhd':
                ver = b[s]
                if ver == 1:
                    ts, dur = struct.unpack('>IQ', b[s + 20:s + 32])
                else:
                    ts, dur = struct.unpack('>II', b[s + 12:s + 20])
                out['media_timescale'] = ts
                out['media_samples'] = dur
            elif typ == 'mvhd':
                ver = b[s]
                ts = struct.unpack('>I', b[s + (20 if ver == 1 else 12):s + (24 if ver == 1 else 16)])[0]
                out['movie_timescale'] = ts
    walk(0, len(b))
    if 'priming_samples' in out and 'media_samples' in out:
        seg = out['edit_segment_duration_movie_ts'] * out['media_timescale'] / out.get('movie_timescale', out['media_timescale'])
        out['padding_samples'] = int(round(out['media_samples'] - out['priming_samples'] - seg))
        out['gapless_samples'] = int(round(seg))
    return out


def mp3_info(path):
    b = open(path, 'rb').read(4096)
    i = b.find(b'LAME')
    if i < 0:
        i = b.find(b'Lavc')
    if i < 0:
        return {'lame_tag': False}
    d = b[i + 21:i + 24]
    delay = (d[0] << 4) | (d[1] >> 4)
    pad = ((d[1] & 0x0F) << 8) | d[2]
    return {'lame_tag': True, 'encoder_delay': delay, 'priming_samples': delay + 529, 'padding_samples': pad - 529 if pad >= 529 else pad,
            'raw_padding_field': pad}


HEADER = {'ogg': opus_info, 'm4a': m4a_info, 'mp3': mp3_info}


# -------------------------------------------------------------- measures ---
def _hf_max(y, c, half_ms=10.0):
    """Largest 2 ms high-frequency (>5 kHz) energy within +-half_ms of sample c."""
    h = A.hpf(y, 5000, 4)
    e = (h ** 2).sum(1)
    w = int(0.002 * SR)
    lo, hi = c - int(half_ms * SR / 1000), c + int(half_ms * SR / 1000)
    return 10 * np.log10(max(e[i:i + w].sum() for i in range(lo, hi - w)) + 1e-30)


def seam(x, bar_n, master=None):
    """Wrap point versus ordinary bar lines. A click would make the wrap's HF
    burst stand above every bar line, and its sample jump far above the
    99.9th percentile of neighbouring differences. With a master, also the
    codec residual (decoded minus master) at the wrap versus elsewhere."""
    y = np.vstack([x[-SR:], x[:SR]])
    d = np.abs(np.diff(y, axis=0)).max(1)
    jump = float(d[SR - 1] / (np.percentile(np.delete(d, [SR - 1]), 99.9) + 1e-20))
    wrap = _hf_max(y, SR)
    bars = [_hf_max(x[b - SR:b + SR], SR) for b in range(bar_n, len(x) - bar_n // 2, bar_n)]
    out = {'wrap_jump_ratio': round(jump, 3), 'wrap_hf_minus_max_barline_db': round(wrap - max(bars), 2),
           'wrap_hf_minus_median_barline_db': round(wrap - float(np.median(bars)), 2)}
    if master is not None:
        r = x[:len(master)] - master[:len(x)]
        ry = np.vstack([r[-SR:], r[:SR]])
        w = int(0.02 * SR)
        e_wrap = (ry[SR - w // 2:SR + w // 2] ** 2).sum()
        segs = np.array([(r[i:i + w] ** 2).sum() for i in range(0, len(r) - w, w)])
        out['codec_residual_at_wrap_vs_median_db'] = round(10 * np.log10((e_wrap + 1e-30) / (np.median(segs) + 1e-30)), 2)
        out['codec_residual_at_wrap_vs_p99_db'] = round(10 * np.log10((e_wrap + 1e-30) / (np.percentile(segs, 99) + 1e-30)), 2)
    return out


def lag(x, ref):
    a, b = x[:5 * SR].mean(1), ref[:5 * SR].mean(1)
    c = signal.correlate(a, b, mode='full', method='fft')
    m = len(b) - 1
    return int(np.argmax(c[m - 3000:m + 3001])) - 3000


def ebur(x):
    tmp = tempfile.mktemp(suffix='.wav', dir=A.BUILD)
    sf.write(tmp, x.astype(np.float32), SR, subtype='FLOAT')
    r = A.ffmpeg_ebur128(tmp)
    os.remove(tmp)
    return r


def seam_panel(decoded, path, title):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    ks = list(decoded)
    fig, ax = plt.subplots(len(ks), 2, figsize=(14, 2.0 * len(ks)))
    for r, k in enumerate(ks):
        x = decoded[k]
        y = np.vstack([x[-2 * SR:], x[:2 * SR]])
        f, t, Z = signal.stft(y.mean(1), SR, nperseg=2048, noverlap=1536)
        db = 20 * np.log10(np.abs(Z) + 1e-9)
        ax[r, 0].pcolormesh(t - 2, f, db - db.max(), shading='auto', cmap='magma', vmin=-90, vmax=0)
        ax[r, 0].set_yscale('symlog', linthresh=200)
        ax[r, 0].set_ylim(20, 20000)
        ax[r, 0].axvline(0, color='c', lw=0.6)
        ax[r, 0].set_ylabel(k, fontsize=8)
        w = np.vstack([x[-240:], x[:240]])
        ax[r, 1].plot(np.arange(-240, 240) / SR * 1000, w, lw=0.7)
        ax[r, 1].axvline(0, color='r', lw=0.5)
    ax[0, 0].set_title(title + ': spectrogram of last 2 s + first 2 s (wrap at 0)')
    ax[0, 1].set_title('waveform +-5 ms around the wrap')
    fig.tight_layout()
    fig.savefig(path, dpi=80)
    plt.close(fig)


def main():
    os.makedirs(SPEC, exist_ok=True)
    man = json.load(open(os.path.join(ASSETS, 'score.json')))
    N = int(round(man['loopSeconds'] * SR))
    bar_n = int(round(60 / man['bpm'] * 4 * SR))
    refs = [bar_n * k for k in (4, 8, 12)]
    rep = {'loops': {}, 'pairs': {}, 'stings': {}, 'ticks': [], 'sizes': {}, 'clipping': {}}
    masters = {k: sf.read(os.path.join(WAV, '%s.wav' % k), always_2d=True)[0] for k in man['stems']}
    decoded = {f: {} for f in FMTS}
    for k, ent in man['stems'].items():
        r = {'master_samples': len(masters[k]), 'master_seam': seam(masters[k], bar_n)}
        for f in FMTS:
            path = os.path.join(ASSETS, ent[f])
            x = A.decode(path)
            decoded[f][k] = x
            info = HEADER[f](path)
            n = len(x)
            xn = x[:N] if n >= N else np.vstack([x, np.zeros((N - n, 2))])
            r[f] = {'decoded_samples': n, 'delta_samples': n - N, 'within_one_frame': abs(n - N) <= 1024,
                    'offset_vs_master_samples': lag(x, masters[k]),
                    'header': info, 'seam': seam(xn, bar_n, masters[k]),
                    'clipped': int((np.abs(x) >= 1.0).sum()), 'peak_dbfs': round(A.peak_db(x), 2),
                    'size_kb': round(os.path.getsize(path) / 1024, 1)}
        rep['loops'][k] = r
    # loudness: bed alone and every pair, from masters and decoded opus
    lv = man['levels']
    for k in man['stems']:
        if k == 'bed':
            mix_w = masters['bed'] * lv['bed']
            mix_o = decoded['ogg']['bed'][:N] * lv['bed']
        else:
            mix_w = masters['bed'] * lv['bed'] + masters[k] * lv[k]
            mix_o = decoded['ogg']['bed'][:N] * lv['bed'] + decoded['ogg'][k][:N] * lv[k]
        ew, eo = ebur(mix_w), ebur(mix_o)
        rep['pairs'][k] = {'wav': ew, 'ogg': eo, 'bands': {b: round(v, 1) for b, v in A.band_energies(mix_w.mean(1)).items()}}
        A.spectrogram_png(mix_w, os.path.join(SPEC, 'mix_bed%s.png' % ('' if k == 'bed' else '+' + k)),
                          'bed x %.2f%s' % (lv['bed'], '' if k == 'bed' else ' + %s x %.2f' % (k, lv[k])),
                          [b * 4 * 60 / man['bpm'] for b in (0, 4, 8, 12, 16)], ['1', '5', '9', '13', 'loop'])
    for k in man['stems']:
        A.spectrogram_png(masters[k], os.path.join(SPEC, 'stem_%s.png' % k), 'stem: %s (alone, file level)' % k,
                          [b * 4 * 60 / man['bpm'] for b in (0, 4, 8, 12, 16)], ['1', '5', '9', '13', 'loop'])
    # worst case while crossfading: bed + two layers at full level
    ks = [k for k in man['stems'] if k != 'bed']
    worst = max(((a, b) for i, a in enumerate(ks) for b in ks[i + 1:]),
                key=lambda ab: A.tp_db(masters['bed'] * lv['bed'] + masters[ab[0]] * lv[ab[0]] + masters[ab[1]] * lv[ab[1]]))
    x = masters['bed'] * lv['bed'] + masters[worst[0]] * lv[worst[0]] + masters[worst[1]] * lv[worst[1]]
    rep['crossfade_worst'] = {'layers': worst, 'tp_dbtp': round(A.tp_db(x), 2), 'clipped': int((np.abs(x) >= 1).sum())}
    # stings and ticks as played (gain x 0.9 fx bus)
    for name, ent in man['stings'].items():
        g = man['stingGain'].get(name, 1.0) * 0.9
        x = A.decode(os.path.join(ASSETS, ent['ogg']))
        m = sf.read(os.path.join(WAV, 'sting_%s.wav' % name), always_2d=True)[0]
        rep['stings'][name] = {'seconds': round(len(m) / SR, 3), 'momentary_max_lufs_as_played': round(A.momentary_max(m * g), 1),
                               'true_peak_dbtp_as_played': round(A.tp_db(m * g), 1),
                               'decoded_ogg_clipped': int((np.abs(x) >= 1).sum()),
                               'size_kb': {f: round(os.path.getsize(os.path.join(ASSETS, ent[f])) / 1024, 1) for f in FMTS}}
        A.spectrogram_png(m, os.path.join(SPEC, 'sting_%s.png' % name), 'sting: %s' % name)
    tk = []
    for i, ent in enumerate(man['ticks']):
        m = sf.read(os.path.join(WAV, 'tick_%d.wav' % (i + 1)), always_2d=True)[0]
        tk.append(m)
        g = man['tickGain'] * 0.9
        rep['ticks'].append({'seconds': round(len(m) / SR, 3), 'peak_dbfs_as_played': round(A.peak_db(m * g), 1),
                             'momentary_max_lufs_as_played': round(A.momentary_max(m * g), 1),
                             'size_kb': {f: round(os.path.getsize(os.path.join(ASSETS, ent[f])) / 1024, 1) for f in FMTS}})
    A.spectrogram_png(np.vstack(tk + [np.zeros((int(0.1 * SR), 2))]), os.path.join(SPEC, 'ticks.png'), 'ticks 1-3 back to back')
    for f in FMTS:
        seam_panel(decoded[f], os.path.join(SPEC, 'seam_%s.png' % f), f)
    # sizes
    tot = {f: 0 for f in FMTS}
    for fn in os.listdir(ASSETS):
        e = fn.rsplit('.', 1)[-1]
        if e in tot:
            tot[e] += os.path.getsize(os.path.join(ASSETS, fn))
    rep['sizes'] = {'per_format_mb': {f: round(v / 1e6, 2) for f, v in tot.items()},
                    'all_formats_mb': round(sum(tot.values()) / 1e6, 2),
                    'bed_ogg_kb': round(os.path.getsize(os.path.join(ASSETS, man['stems']['bed']['ogg'])) / 1024, 1)}
    json.dump(rep, open(os.path.join(WAV, 'verify_report.json'), 'w'), indent=1, default=float)
    # summary
    print('loops: decoded length vs %d, offset vs master, wrap jump ratio, wrap HF minus loudest bar line (dB), codec residual at wrap vs median (dB)' % N)
    for k, r in rep['loops'].items():
        print('  %-14s master j%.2f hf%+.1f | ' % (k, r['master_seam']['wrap_jump_ratio'], r['master_seam']['wrap_hf_minus_max_barline_db'])
              + '  '.join('%s %+d off%+d j%.2f hf%+.1f res%+.1f' % (f, r[f]['delta_samples'], r[f]['offset_vs_master_samples'],
                          r[f]['seam']['wrap_jump_ratio'], r[f]['seam']['wrap_hf_minus_max_barline_db'],
                          r[f]['seam']['codec_residual_at_wrap_vs_median_db']) for f in FMTS))
    print('headers', json.dumps({f: rep['loops']['bed'][f]['header'] for f in FMTS}))
    print('pairs (I LUFS / TP dBTP / LRA), wav and decoded ogg:')
    for k, r in rep['pairs'].items():
        print('  %-14s wav %.1f / %.1f / %.1f   ogg %.1f / %.1f' % (k, r['wav']['I'], r['wav']['TP'], r['wav']['LRA'], r['ogg']['I'], r['ogg']['TP']))
    print('crossfade worst', rep['crossfade_worst'])
    print('clipped samples in decoded loops:', sum(r[f]['clipped'] for r in rep['loops'].values() for f in FMTS))
    for k, r in rep['stings'].items():
        print('  sting %-16s %.2fs  M %.1f LUFS  TP %.1f dBTP' % (k, r['seconds'], r['momentary_max_lufs_as_played'], r['true_peak_dbtp_as_played']))
    for i, r in enumerate(rep['ticks']):
        print('  tick %d %.2fs peak %.1f dBFS M %.1f' % (i + 1, r['seconds'], r['peak_dbfs_as_played'], r['momentary_max_lufs_as_played']))
    print('sizes', rep['sizes'])


if __name__ == '__main__':
    main()
