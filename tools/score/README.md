# The score (After Hours Library)

Composition and render code for the adaptive score that `score.js` plays from `assets/score/`. The notes live in `score.py` as plain data; everything else turns them into audio and proves the result by measurement. No samples, impulse responses or WAVs belong in this repo: they live in a work folder outside it (`SCORE_WORK`).

## What it is

One shared loop: 16 bars of 4/4 at 64 BPM in D-flat major, exactly 60.000 s (a beat is 45000 samples at 48 kHz, so every loop point is sample exact). Each stem is the whole loop, every stem is exactly 2,880,000 samples, and each stem's reverb tail is folded into its own loop head, so the loop is gapless.

| Stem | What it plays |
|---|---|
| `bed` | Felt upright piano voiced low and soft, long contrabass and cello notes, soft sustained strings, a bowed vibraphone tone each phrase, warm hall. Always on. |
| `triple-j` | The main theme on cello (A-flat rising a fifth to E-flat, a step down), with violas below and violins above it. |
| `lead-to-title` | Two vibraphones in interlocking eighths (hocket), panned apart, hand chime on odd bars. |
| `the-inbound` | Cello calls (bars 1-2, 5-6, 9-10, 13-14), piano answers (the bars between). |
| `prospector` | Marimba sixteenths climbing each bar's chord, with a dotted-eighth echo. |
| `neuroscience` | A four-part string chorale (cello, viola, violins), one chord a bar, under a slow piano melody. |
| `obavia` | Viola tremolo on open fifths and one held D-flat (the suspended fourth over A-flat) that never resolves. |

Harmony, one chord a bar: Dbmaj6/9, Dbmaj6/9, Gbmaj9, Gbmaj9, Bb7sus4, Bbm11 (the 4-3 resolves), Ebm9, Ab9sus4, Db6/9 over F, Gbmaj9, Bbb maj7#11 (borrowed bVI), Ab9sus4, Bbm11 (deceptive), Gbm6 (borrowed iv), Ebm9, Ab13sus4. The bed never sounds C natural, and A-flat, D-flat and E-flat are consonant in every bar, which is why any layer can sit on the bed and the obavia layer can hold its D-flat over all of it.

Stings (`start`, `open`, `select`, four trophies, `level-clear`) and three ticks are built in the same key from A-flat, D-flat and E-flat, so they sit over any bar; `level-clear` is a full dominant-to-tonic cadence.

## Files

| File | Job |
|---|---|
| `score.py` | The music: tempo, chords, every part as `(bar, beat, beats, pitch, velocity)`, stings, ticks. |
| `theory_check.py` | Reads the notes back as theory: parallel fifths and octaves, direct octaves, crossing, spacing, minor 2nds and 9ths between the bed and each layer, strong-beat non-chord tones, breaths in each melody. Run it after every edit to `score.py`. |
| `sfzgen.py` | Writes SFZ maps for the CC0 libraries (which ship as WAVs named by note), measuring each sample's real pitch and onset first; wraps the Salamander SFZ. |
| `sampler.py` | A deterministic offline SFZ renderer (polyphase pitch shifting, velocity crossfades, round robins, release triggers, sustain pedal). `sfizz_render` 1.2.3 was tried and rejected: it streams samples on a background thread and randomly rendered only the first fraction of a second of some notes. |
| `audiolib.py` | Filters, EQ, convolution reverb, calibrated tape saturation, true-peak limiter, loudness (BS.1770), encoding, spectrograms. |
| `render.py` | Renders, mixes, folds and balances the stems, renders stings and ticks, encodes Opus/AAC/MP3 into `assets/score/`, writes `score.json`. |
| `gapless.py` | Encodes each loop with real audio on both sides of the seam and trims it with the formats' own metadata (Opus pre-skip and final granule, AAC edit list, LAME delay and padding), so the decoded loop has no codec tick at the wrap. |
| `verify.py` | Decodes every file back, checks lengths, priming and padding, seams, loudness, true peak, clipping and sizes, and draws spectrograms. |

## Re-render

1. A Python 3.11 venv: `pip install numpy scipy soundfile pyloudnorm matplotlib mido numba`.
2. An ffmpeg 7 build with libopus, libmp3lame and the native AAC encoder (the `imageio-ffmpeg` wheel's binary works). Put it at `$SCORE_WORK/bin/ffmpeg` or set `SCORE_FFMPEG`.
3. A work folder, `export SCORE_WORK=/path/to/score-work` (it defaults to the cloud scratchpad path this was first built in), holding:

```
# Salamander Grand Piano V3, 48 kHz 24-bit SFZ + FLAC (CC BY 3.0, Alexander Holm), 707 MB
mkdir -p $SCORE_WORK/dl/salamander && cd $SCORE_WORK/dl/salamander
curl -LO https://freepats.zenvoid.org/Piano/SalamanderGrandPiano/SalamanderGrandPiano-SFZ+FLAC-V3+20200602.tar.gz
tar xzf SalamanderGrandPiano-SFZ+FLAC-V3+20200602.tar.gz

# Voxengo free impulse responses (Going Home, Ruby Room are used)
mkdir -p $SCORE_WORK/dl/voxengo && cd $SCORE_WORK/dl/voxengo
curl -LO https://www.voxengo.com/files/impulses/IMreverbs.zip && unzip IMreverbs.zip

# VSCO 2 Community Edition (CC0): only the folders used
git clone --filter=blob:none --no-checkout --depth 1 https://github.com/sgossner/VSCO-2-CE.git $SCORE_WORK/src/vsco2
cd $SCORE_WORK/src/vsco2 && git sparse-checkout init --no-cone
git sparse-checkout set "Strings/Violin Section/susVib/*" "Strings/Viola Section/susvib/*" \
  "Strings/Cello Section/susvib/*" "Strings/Solo Contrabass/SusNV/*" "Strings/Violin Section/Trem/*" \
  "Strings/Viola Section/trem/*" "Strings/Cello Section/trem/*" "Percussion/BDrumNewhit*" "Percussion/Timpani/*"
git read-tree -mu HEAD

# Versilian Community Sample Library (CC0): only the folders used
git clone --filter=blob:none --no-checkout --depth 1 https://github.com/sgossner/VCSL.git $SCORE_WORK/src/vcsl
cd $SCORE_WORK/src/vcsl && git sparse-checkout init --no-cone
git sparse-checkout set "Idiophones/Struck Idiophones/Vibraphone/*" "Idiophones/Struck Idiophones/Marimba/*" \
  "Idiophones/Struck Idiophones/Hand Chimes/*" "Idiophones/Struck Idiophones/Mark Trees/*" \
  "Idiophones/Struck Idiophones/Hi-Hat Cymbal/*" "Idiophones/Struck Idiophones/Shaker, Small/*" \
  "Idiophones/Struck Idiophones/Suspended Cymbal 1/*" "Membranophones/Struck Membranophones/Bass Drum 2/*" \
  "Membranophones/Struck Membranophones/Frame Drum/*" "Chordophones/Zithers/Upright Piano, Knight/*"
git read-tree -mu HEAD
```

4. Then, from this folder:

```
python3 sfzgen.py        # SFZ maps + measured tuning into $SCORE_WORK/sfz (once)
python3 theory_check.py  # must report 0 parallels and 0 clashes
python3 render.py        # about 12 minutes; writes assets/score/*
python3 verify.py        # report + spectrograms in $SCORE_WORK/out/score_spectrograms
```

`python3 render.py --only bed start` re-renders just those (the rest are reused from `$SCORE_WORK/build/score`).

## Levels

`render.py` sets the bed so that bed x 0.85 measures about -21 LUFS, and each title layer so that bed x 0.85 plus the layer at its `levels` value measures -18.0 LUFS integrated with true peak under -1 dBTP. Stings are set by their loudest 400 ms (momentary loudness, as played through the player's 0.9 effects bus) between -23 and -29 LUFS with true peaks at or below -12 dBTP, so after the player ducks the music 6 dB they sit inside the music rather than on top of it. Ticks peak near -25 dBFS as played.

## Credits

Salamander Grand Piano by Alexander Holm, CC BY 3.0 (the credit line is required and is in `score.json`). VSCO 2 Community Edition and the Versilian Community Sample Library by Versilian Studios (Sam Gossner) and Ivy Audio (Simon Dalzell), CC0. Impulse responses Going Home and Ruby Room by Aleksey Vaneev (Voxengo), free for commercial use; the IR files themselves may not be redistributed, so they are never committed. The plate reverb is synthesized in `audiolib.py`.

## What ships

The site ships the Opus (.ogg) and AAC (.m4a) files only: every browser that can play the library plays one of the two, and score.js falls back to the .m4a. After a render, delete the .mp3 files and their entries in score.json before committing (`python3 -c "import json,glob,os; p='assets/score/score.json'; d=json.load(open(p)); f=lambda o: (o.pop('mp3',None), [f(v) for v in o.values()]) if isinstance(o,dict) else [f(v) for v in o] if isinstance(o,list) else None; f(d); json.dump(d,open(p,'w'),indent=1); [os.remove(x) for x in glob.glob('assets/score/*.mp3')]"`). One visitor downloads one format, about 7 MB for the whole score.
