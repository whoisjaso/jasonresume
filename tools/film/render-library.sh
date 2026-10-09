#!/bin/sh
# Renders the After Hours Library living loops into assets/game/loops: for each
# key art plate, an 8-second seamless loop at 1920 x 1080, 30 fps, where one
# light behaves over the graded still (src/library). game.js swaps them in when
# a visitor rests on a title; assemble_home.py adds the <video> only for ids
# whose .mp4 and .webm both exist.
# Run from tools/film: sh render-library.sh [id ...]   (no ids renders all six)
# Needs: Chromium (REMOTION_BROWSER), python3 with Pillow (or dwebp) to turn the
# webp plates into PNG with libwebp, the decoder browsers use for the still, so
# the dissolve from still to loop holds its colour. FFMPEG overrides the encoder
# (default: the ffmpeg Remotion bundles). KEEP=1 keeps the PNG frames; REUSE=1
# re-encodes from frames kept by an earlier KEEP=1 run instead of rendering.
set -e
B=${REMOTION_BROWSER:-/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell}
ART=../../assets/game/art
OUT=../../assets/game/loops
ids="$*"
[ -n "$ids" ] || ids="triple-j lead-to-title the-inbound prospector neuroscience obavia"
mkdir -p public/library out/library "$OUT"

ff() { if [ -n "$FFMPEG" ]; then "$FFMPEG" "$@"; else npx remotion ffmpeg "$@"; fi; }

comp() {
  case $1 in
    triple-j) echo LibraryTripleJ ;;
    lead-to-title) echo LibraryLeadToTitle ;;
    the-inbound) echo LibraryTheInbound ;;
    prospector) echo LibraryProspector ;;
    neuroscience) echo LibraryNeuroscience ;;
    obavia) echo LibraryObavia ;;
    *) echo "unknown id: $1" >&2; exit 1 ;;
  esac
}

plate() {
  src=$ART/$1-1920.webp
  dst=public/library/$1.png
  if python3 -c "import PIL" 2>/dev/null; then
    python3 -c "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGB').save(sys.argv[2])" "$src" "$dst"
  elif command -v dwebp >/dev/null 2>&1; then
    dwebp -quiet "$src" -o "$dst"
  else
    echo "need python3 with Pillow, or dwebp, to convert $src" >&2; exit 1
  fi
}

# BT.709, limited range, tagged, so browsers decode the loop to the still's colours
COLOR="-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv"
VF="scale=out_color_matrix=bt709:out_range=tv,format=yuv420p"

for id in $ids; do
  c=$(comp "$id")
  if [ -n "$REUSE" ] && [ -f "out/library/$id/239.png" ]; then
    echo "re-encoding $id from kept frames"
  else
    plate "$id"
    rm -rf "out/library/$id"
    npx remotion render src/index.ts "$c" "out/library/$id" --sequence --image-format=png \
      --image-sequence-pattern='[frame].[ext]' --browser-executable="$B" --log=error
  fi
  seq="out/library/$id/%03d.png"
  # One GOP for the whole loop: the browser seeks to frame 0 on every pass. x264
  # cannot reference frame 0 from frame 239, so its keyframe would pop back to
  # full detail at the seam; the zones lift the keyframe and the last half second
  # so both sides of the seam sit close to the source. VP9 keeps frame 0 as its
  # golden frame and closes the loop on its own; constrained quality caps the
  # busiest plate near the mp4's size.
  ff -v error -y -framerate 30 -i "$seq" -vf "$VF" -c:v libx264 -preset slow -crf 27 -tune grain -g 240 \
    -x264-params "zones=0,0,q=22/225,239,q=23" $COLOR -movflags +faststart -an "$OUT/$id.mp4"
  ff -v error -y -framerate 30 -i "$seq" -vf "$VF" -c:v libvpx-vp9 -crf 30 -b:v 1400k -row-mt 1 \
    -deadline good -cpu-used 2 -g 240 $COLOR -an "$OUT/$id.webm"
  [ -n "$KEEP" ] || rm -rf "out/library/$id"
  ls -l "$OUT/$id.mp4" "$OUT/$id.webm"
done
echo DONE
