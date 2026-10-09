"""Gapless loop encoding with real context at the seam.

A lossy encoder that starts on sample 0 of a loop assumes silence came before
it, so the first frames of the decoded loop differ from what follows the
loop's end: a faint tick at every repeat. Instead each loop is encoded as
[last CONTEXT samples] + [the loop] + [first few hundred samples], and the
format's own gapless metadata is told to drop the extra samples at both ends:

  Opus/Ogg   OpusHead pre-skip += CONTEXT; the final page's granule position
             is pulled back by the tail (page CRCs recomputed)
  AAC/MP4    edit list media_time += CONTEXT + 512 (mid-packet, see below),
             segment duration = the loop
  MP3        LAME tag encoder delay += CONTEXT, padding += tail
             (tag CRC-16 recomputed)

Decoders that honour gapless metadata (ffmpeg, and the browsers' decoders
built on it) then return exactly the loop, and its first frames were coded
with the true preceding audio.
"""
import os, struct, subprocess, tempfile
import numpy as np
import soundfile as sf

CONTEXT = 2048

_T = []
for _i in range(256):
    _r = _i << 24
    for _ in range(8):
        _r = ((_r << 1) ^ 0x04C11DB7) if _r & 0x80000000 else (_r << 1)
    _T.append(_r & 0xFFFFFFFF)


def _ogg_crc(b):
    c = 0
    for x in b:
        c = ((c << 8) ^ _T[((c >> 24) & 0xFF) ^ x]) & 0xFFFFFFFF
    return c


def _crc16_arc(b):
    c = 0
    for x in b:
        c ^= x
        for _ in range(8):
            c = (c >> 1) ^ 0xA001 if c & 1 else c >> 1
    return c


def _ogg_pages(b):
    out, i = [], 0
    while i < len(b):
        assert b[i:i + 4] == b'OggS'
        nseg = b[i + 26]
        L = 27 + nseg + sum(b[i + 27:i + 27 + nseg])
        out.append((i, L, struct.unpack('<q', b[i + 6:i + 14])[0]))
        i += L
    return out


def _ogg_fix_crc(b, o, L):
    b[o + 22:o + 26] = b'\0\0\0\0'
    b[o + 22:o + 26] = struct.pack('<I', _ogg_crc(bytes(b[o:o + L])))


def opus_last_page_samples(path):
    pg = _ogg_pages(open(path, 'rb').read())
    return pg[-1][2] - pg[-2][2]


def patch_opus(path, extra, tail=0):
    b = bytearray(open(path, 'rb').read())
    pg = _ogg_pages(b)
    o, L, _ = pg[0]
    i = b.find(b'OpusHead', o, o + L)
    pre = struct.unpack('<H', b[i + 10:i + 12])[0]
    b[i + 10:i + 12] = struct.pack('<H', pre + extra)
    _ogg_fix_crc(b, o, L)
    if tail:
        o, L, g = pg[-1]
        assert g - tail >= pg[-2][2], 'final Ogg page shorter than the tail to trim'
        b[o + 6:o + 14] = struct.pack('<q', g - tail)
        _ogg_fix_crc(b, o, L)
    open(path, 'wb').write(bytes(b))
    return pre + extra


def _find_box(b, path, start=0, end=None):
    end = len(b) if end is None else end
    name = path[0]
    i = start
    while i + 8 <= end:
        size, typ = struct.unpack('>I4s', b[i:i + 8])
        hdr = 8
        if size == 1:
            size = struct.unpack('>Q', b[i + 8:i + 16])[0]
            hdr = 16
        if size == 0:
            size = end - i
        if typ.decode('latin1') == name:
            if len(path) == 1:
                return i + hdr, i + size
            return _find_box(b, path[1:], i + hdr, i + size)
        i += size
    return None


def patch_m4a(path, extra, loop_samples, sr):
    b = bytearray(open(path, 'rb').read())
    mv = _find_box(b, ['moov', 'mvhd'])
    ver = b[mv[0]]
    movie_ts = struct.unpack('>I', b[mv[0] + (20 if ver == 1 else 12):mv[0] + (24 if ver == 1 else 16)])[0]
    el = _find_box(b, ['moov', 'trak', 'edts', 'elst'])
    s = el[0]
    ver = b[s]
    seg = int(round(loop_samples * movie_ts / sr))
    if ver == 1:
        dur, mt = struct.unpack('>Qq', b[s + 8:s + 24])
        b[s + 8:s + 24] = struct.pack('>Qq', seg, mt + extra)
    else:
        dur, mt = struct.unpack('>Ii', b[s + 8:s + 16])
        b[s + 8:s + 16] = struct.pack('>Ii', seg, mt + extra)
    # the track header duration follows the edit
    tk = _find_box(b, ['moov', 'trak', 'tkhd'])
    v = b[tk[0]]
    if v == 1:
        b[tk[0] + 28:tk[0] + 36] = struct.pack('>Q', seg)
    else:
        b[tk[0] + 20:tk[0] + 24] = struct.pack('>I', seg)
    open(path, 'wb').write(bytes(b))
    return mt + extra


def patch_mp3(path, extra, tail=0):
    b = bytearray(open(path, 'rb').read())
    off = 0
    if b[:3] == b'ID3':
        off = 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9])
    assert b[off] == 0xFF
    fr = off
    li = b.find(b'LAME', fr, fr + 400)
    if li < 0:
        li = b.find(b'Lavc', fr, fr + 400)
    assert li > 0
    d = b[li + 21:li + 24]
    delay = ((d[0] << 4) | (d[1] >> 4)) + extra
    pad = (((d[1] & 0x0F) << 8) | d[2]) + tail
    assert delay < 4096 and pad < 4096
    b[li + 21:li + 24] = bytes([delay >> 4, ((delay & 0x0F) << 4) | (pad >> 8), pad & 0xFF])
    b[li + 34:li + 36] = struct.pack('>H', _crc16_arc(bytes(b[fr:li + 34])))
    open(path, 'wb').write(bytes(b))
    return delay, pad


def _wav(x, sr, tmpdir):
    t = tempfile.mktemp(suffix='.wav', dir=tmpdir)
    sf.write(t, x.astype(np.float32), sr, subtype='FLOAT')
    return t


def encode_loop(loop, base, ffmpeg, sr=48000, opus_kbps=96, aac_kbps=128, mp3_kbps=160, tmpdir=None):
    """loop: (n, 2) float array, exactly one period. Writes base.ogg/.m4a/.mp3
    with context on both sides of the seam, trimmed by each format's metadata."""
    P = CONTEXT
    q = ['-hide_banner', '-loglevel', 'error', '-y']
    info = {}
    # Opus: 100 ms pages; pick a tail the final page can absorb
    for tail in (480, 1440, 2400, 3360, 4320):
        t = _wav(np.vstack([loop[-P:], loop, loop[:tail]]), sr, tmpdir)
        subprocess.run([ffmpeg] + q + ['-i', t, '-c:a', 'libopus', '-b:a', '%dk' % opus_kbps, '-vbr', 'on',
                                       '-compression_level', '10', '-application', 'audio', '-page_duration', '100000',
                                       base + '.ogg'], check=True)
        os.remove(t)
        if opus_last_page_samples(base + '.ogg') >= tail:
            break
    info['opus'] = {'preskip': patch_opus(base + '.ogg', P, tail), 'tail_trimmed_by_granule': tail}
    # AAC: the edit list must start half a frame into a packet. On a packet
    # boundary, decoders start at that packet with no pre-roll and its first
    # 1024 samples come out without their overlap-add (a 20 ms smear at every
    # repeat); mid-packet, the MP4 roll group makes them decode one packet
    # early. One frame of tail; the edit list ends the track at the loop.
    PA = P + 512
    t = _wav(np.vstack([loop[-PA:], loop, loop[:1024]]), sr, tmpdir)
    subprocess.run([ffmpeg] + q + ['-i', t, '-c:a', 'aac', '-b:a', '%dk' % aac_kbps, '-movflags', '+faststart',
                                   base + '.m4a'], check=True)
    os.remove(t)
    info['aac'] = {'edit_media_time': patch_m4a(base + '.m4a', PA, len(loop), sr)}
    # MP3: one frame of tail, trimmed through the LAME padding field
    t = _wav(np.vstack([loop[-P:], loop, loop[:1152]]), sr, tmpdir)
    subprocess.run([ffmpeg] + q + ['-i', t, '-c:a', 'libmp3lame', '-b:a', '%dk' % mp3_kbps, base + '.mp3'], check=True)
    os.remove(t)
    d, pd = patch_mp3(base + '.mp3', P, 1152)
    info['mp3'] = {'encoder_delay': d, 'padding': pd}
    return {e: os.path.basename(base) + '.' + e for e in ('ogg', 'm4a', 'mp3')}, info
