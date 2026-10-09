#!/bin/sh
# Renders the walkthrough film: assets/film/tour.mp4 (1920 x 1080), tour-vertical.mp4
# (1080 x 1920, recomposed from the phone captures, not cropped), a poster for
# each (.jpg), and tour.vtt (the narrator's lines as a captions track); then
# re-assembles the site so the title screen, the help sheet and
# /walkthrough.html offer it.
#
#   sh tools/film/render-tour.sh            (from the repo root or tools/film)
#
# The narration contract: assets/voice/tour/<id>.mp3, <id>.json (word timings)
# and manifest.json, written by the voice tool in tools/voice. timeline.mjs reads
# whatever is there: a recorded line plays in the film and its captions light on
# the recording's own word timings; a line with no recording runs caption-only on
# an estimated pace, and the film then carries no voice for it. So once
# assets/voice/tour/ is populated, running this again re-renders with the voice.
#
# Needs the site served on 127.0.0.1:8765 for fresh captures (CAPTURE=1, or when
# tools/film/public/tour/shots is empty), Chromium in /opt/pw-browsers
# (REMOTION_BROWSER overrides), python3. ONLY=Tour or ONLY=TourVertical renders one.
set -e
cd "$(dirname "$0")"
FILM=$(pwd)
ROOT=$(cd ../.. && pwd)
B=${REMOTION_BROWSER:-/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell}
OUT=$ROOT/assets/film

# 1. the timeline: lines, shots, word timings (recorded or estimated)
node "$ROOT/tools/voice/timeline.mjs"

# 2. inputs: captures of the live site, the site's fonts, the library's score, the voice
if [ -n "$CAPTURE" ] || [ ! -f public/tour/shots/title.png ]; then node capture-tour.mjs; fi
mkdir -p public/tour/fonts public/tour/score public/tour/voice out/tour
cp "$ROOT/tools/fonts/16a24145dd00.woff2" public/tour/fonts/cormorant.woff2
cp "$ROOT/tools/fonts/b8f117656b5c.woff2" public/tour/fonts/hanken.woff2
# ogg: the headless renderer decodes Opus and Vorbis, not AAC
cp "$ROOT/assets/score/bed.ogg" "$ROOT"/assets/score/sting-*.ogg public/tour/score/
rm -f public/tour/voice/*.mp3
if ls "$ROOT"/assets/voice/tour/*.mp3 >/dev/null 2>&1; then cp "$ROOT"/assets/voice/tour/*.mp3 public/tour/voice/; fi

ff() { npx remotion ffmpeg "$@"; }

# 3. render a master, then a streaming copy with its index at the front
render() {
  comp=$1; name=$2
  npx remotion render src/index.ts "$comp" "out/tour/$name.mp4" --codec h264 --crf 16 --audio-codec aac --audio-bitrate 192k \
    --pixel-format yuv420p --color-space bt709 --browser-executable="$B" --concurrency 4 --log=error
  # the web copy: a slow x264 pass sized for streaming (the master stays in out/tour)
  ff -v error -y -i "out/tour/$name.mp4" -c:v libx264 -preset slow -crf 27 -tune film -pix_fmt yuv420p \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 -c:a aac -b:a 128k -movflags +faststart "$OUT/$name.mp4"
  # and a WebM (VP9 and Opus), the fallback for browsers without H.264
  ff -v error -y -i "out/tour/$name.mp4" -c:v libvpx-vp9 -b:v 0 -crf 38 -row-mt 1 -deadline good -cpu-used 4 -pix_fmt yuv420p \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 -c:a libopus -b:a 96k "$OUT/$name.webm"
  # the poster: the title screen settled in its frame
  f=$(node -e "const t=require('./src/tour/timeline.json');const s=t.shots.find(x=>x.shot==='title');console.log(s.from+Math.round(s.frames*0.8))")
  npx remotion still src/index.ts "$comp" "out/tour/$name.png" --frame "$f" --browser-executable="$B" --log=error
  python3 -c "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGB').save(sys.argv[2], quality=84, optimize=True, progressive=True)" "out/tour/$name.png" "$OUT/$name.jpg"
  ls -l "$OUT/$name.mp4" "$OUT/$name.webm" "$OUT/$name.jpg"
}
[ -z "$ONLY" ] || [ "$ONLY" = Tour ] && render Tour tour
[ -z "$ONLY" ] || [ "$ONLY" = TourVertical ] && render TourVertical tour-vertical

# 4. the captions track: one cue per line, on the same timing the film uses
node -e "
const t=require('./src/tour/timeline.json');
const ts=x=>{const h=Math.floor(x/3600),m=Math.floor(x/60)%60,s=(x%60).toFixed(3).padStart(6,'0');return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+s};
let v='WEBVTT\n\n';
t.shots.forEach((s,i)=>{const a=s.speechFrom/t.fps+(s.words[0]?s.words[0].s:0),b=s.speechFrom/t.fps+(s.words.length?s.words[s.words.length-1].e:0)+0.4;v+=(i+1)+'\n'+ts(a)+' --> '+ts(b)+'\n'+s.text+'\n\n'});
require('fs').writeFileSync('$OUT/tour.vtt',v);"

# 5. the site picks it up (title screen, help sheet, /walkthrough.html)
python3 "$ROOT/tools/site/assemble_home.py"
echo "render-tour: done ($(node -e "const t=require('./src/tour/timeline.json');console.log(t.seconds+' s, '+(t.voiced?'voiced':'caption-only'))"))"
