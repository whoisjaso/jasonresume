# Sound credits

Every file in this folder was cut, filtered and normalized from a source that allows free commercial use without attribution. Credit is given anyway.

## Mixkit (Sound Effects Free License)

Source: https://mixkit.co/free-sound-effects/ . License: https://mixkit.co/license/ , the Sound Effects Free License, which permits use in commercial projects, including websites, without attribution.

| File | Mixkit title |
|---|---|
| drop-1.wav, drop-2.wav, drop-3.wav | Water bubble |
| drop-4.wav | Deep water bubbles |
| splash.mp3 | Water splash |
| plunge.mp3 | Jump into the water |
| swoosh.mp3 | Air woosh |
| swoosh-long.mp3 | Fast whoosh transition |
| swoosh-deep.mp3 | Cinematic tunnel reverb woosh |
| sparkle.wav | Magic sparkle whoosh |
| open.wav | Opening software interface |
| select.wav | Select click |
| key-1.wav | Single key type |
| key-2.wav, key-3.wav, key-4.wav | Single key press in a laptop |
| key-back.wav | Laptop backspace typing sequence |
| chime-soft.wav | Positive interface beep |

## Processing

ffmpeg trims to the hit, a high-pass to keep the low end clean, a 4 ms fade in, a short fade out, peak normalized to -3 dBFS. Short hits are 16-bit mono WAV at 32 kHz so they start on the sample with no codec padding; tails are mono MP3 at 96 kbps. Playback gain per sound is set in `sounds.js`, and every play varies pitch by a few percent so repeats do not sound like a machine.

## Not used

Kenney's Interface Sounds and UI Audio packs (CC0, https://kenney.nl/assets/interface-sounds) were downloaded and reviewed. Their timbre is game-UI, cleaner and more synthetic than this site's world, so none shipped. They remain a good fallback source.
