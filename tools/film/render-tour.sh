#!/bin/sh
# Renders the walkthrough film, After Hours: assets/film/after-hours.mp4 (1920 x 1080,
# a 2.39:1 picture inside the frame) and after-hours-vertical.mp4 (1080 x 1920, composed
# for a phone, not cropped), a WebM of each, a poster for each (.jpg), and
# after-hours.vtt (the narrator's lines as a captions track); then re-assembles the
# site so the title screen, the help sheet and /walkthrough.html offer it.
#
#   sh tools/film/render-tour.sh            (from the repo root or tools/film)
#
# The narration contract: assets/voice/tour/<id>.mp3, <id>.json (word timings)
# and manifest.json, written by tools/voice/narrate_free.py from the film's lines in
# tools/voice/tour_lines.json (ids starting f-). timeline.mjs reads whatever is there:
# a recorded line plays in the film and its captions light on the recording's own
# word timings; a line with no recording runs caption-only on an estimated pace,
# and the film then carries no voice for it.
#
# Inputs it makes (local, gitignored, in tools/film/public/tour): the hero objects
# (capture-heroes.mjs: the Player 2 card as the site draws it, the resume page, the
# sale desk's phone; it needs the site served on 127.0.0.1:8765, and runs when
# they are missing or CAPTURE=1), one trophy medal struck large (hero_medal.py,
# needs tools/art/candidates/medal-base.png), the sound effects (sfx.py, synthesised),
# and copies of the lot's key art, the six living loops, the portrait, the score
# and the fonts. Chromium in /opt/pw-browsers (REMOTION_BROWSER overrides), python3.
# ONLY=AfterHours or ONLY=AfterHoursVertical renders one cut.
#
# The film files are named after-hours.*: /assets is cached for a year, so a new
# film ships under a new name, never over an old one.
set -e
cd "$(dirname "$0")"
FILM=$(pwd)
ROOT=$(cd ../.. && pwd)
B=${REMOTION_BROWSER:-/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell}
OUT=$ROOT/assets/film
NAME=after-hours
P=public/tour

# 1. the timeline: beats, lines, word timings (recorded or estimated)
node "$ROOT/tools/voice/timeline.mjs"

# 2. inputs
if [ -n "$CAPTURE" ] || [ ! -f $P/hero/card.png ] || [ ! -f $P/hero/desk-2.png ] || [ ! -f $P/hero/resume.png ]; then node capture-heroes.mjs; fi
[ -f $P/hero/medal.png ] || python3 hero_medal.py
python3 sfx.py
mkdir -p $P/fonts $P/score $P/voice $P/loops $P/art out/tour
cp "$ROOT/tools/fonts/16a24145dd00.woff2" $P/fonts/cormorant.woff2
cp "$ROOT/tools/fonts/b8f117656b5c.woff2" $P/fonts/hanken.woff2
# ogg: the headless renderer decodes Opus and Vorbis, not AAC
cp "$ROOT"/assets/score/*.ogg $P/score/
cp "$ROOT"/assets/game/loops/*.mp4 $P/loops/
cp "$ROOT/assets/game/art/triple-j-w-1920.webp" $P/art/lot.webp
cp "$ROOT/assets/game/portrait/jason-relit-1200.webp" $P/art/portrait.webp
rm -f $P/voice/*.mp3
if ls "$ROOT"/assets/voice/tour/f-*.mp3 >/dev/null 2>&1; then cp "$ROOT"/assets/voice/tour/f-*.mp3 $P/voice/; fi

ff() { npx remotion ffmpeg "$@"; }

# 3. render a master, then a streaming copy with its index at the front
render() {
  comp=$1; name=$2
  npx remotion render src/index.ts "$comp" "out/tour/$name.mp4" --codec h264 --crf 16 --audio-codec aac --audio-bitrate 192k \
    --pixel-format yuv420p --color-space bt709 --browser-executable="$B" --concurrency 4 --log=error
  # loudness, two passes: measure the master's mix, then bring it to -16 LUFS integrated, -1.5 dBTP
  m=$(ff -hide_banner -i "out/tour/$name.mp4" -vn -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | node -e "let s=require('fs').readFileSync(0,'utf8');const j=JSON.parse(s.slice(s.lastIndexOf('{'),s.lastIndexOf('}')+1));process.stdout.write('measured_I='+j.input_i+':measured_TP='+j.input_tp+':measured_LRA='+j.input_lra+':measured_thresh='+j.input_thresh+':offset='+j.target_offset)")
  LN="loudnorm=I=-16:TP=-1.5:LRA=11:$m,aresample=48000"
  # the web copy: a slow x264 pass sized for streaming (the master stays in out/tour)
  ff -v error -y -i "out/tour/$name.mp4" -c:v libx264 -preset slow -crf 25 -tune film -pix_fmt yuv420p \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 -af "$LN" -c:a aac -b:a 128k -movflags +faststart "$OUT/$name.mp4"
  # and a WebM (VP9 and Opus), the fallback for browsers without H.264
  ff -v error -y -i "out/tour/$name.mp4" -c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 -deadline good -cpu-used 4 -pix_fmt yuv420p \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 -af "$LN" -c:a libopus -b:a 96k "$OUT/$name.webm"
  # the poster: the lot, lit, under the name (a lossless still, not a decoded frame)
  f=$(node -e "const t=require('./src/tour/timeline.json');const s=t.shots.find(x=>x.shot==='name');console.log(s.from+s.frames-12)")
  npx remotion still src/index.ts "$comp" "out/tour/$name.png" --frame "$f" --browser-executable="$B" --log=error
  python3 -c "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGB').save(sys.argv[2], quality=84, optimize=True, progressive=True)" "out/tour/$name.png" "$OUT/$name.jpg"
  ls -l "$OUT/$name.mp4" "$OUT/$name.webm" "$OUT/$name.jpg"
}
[ -z "$ONLY" ] || [ "$ONLY" = AfterHours ] && render AfterHours $NAME
[ -z "$ONLY" ] || [ "$ONLY" = AfterHoursVertical ] && render AfterHoursVertical $NAME-vertical

# 4. the captions track: one cue per caption line, on the same timing the film uses
node -e "
const t=require('./src/tour/timeline.json');
const ts=x=>{const h=Math.floor(x/3600),m=Math.floor(x/60)%60,s=(x%60).toFixed(3).padStart(6,'0');return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+s};
let v='WEBVTT\n\n',n=0;
t.shots.forEach(s=>{if(!s.words.length)return;const a=s.speechFrom/t.fps+s.words[0].s,b=s.speechFrom/t.fps+s.words[s.words.length-1].e+0.5;v+=(++n)+'\n'+ts(a)+' --> '+ts(b)+'\n'+s.text+'\n\n'});
require('fs').writeFileSync('$OUT/$NAME.vtt',v);"

# 5. the site picks it up (title screen, help sheet, /walkthrough.html)
python3 "$ROOT/tools/site/assemble_home.py"
echo "render-tour: done ($(node -e "const t=require('./src/tour/timeline.json');console.log(t.seconds+' s, '+(t.voiced?'voiced':'caption-only'))"))"
