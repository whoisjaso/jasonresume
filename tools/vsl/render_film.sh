#!/bin/bash
S="$(cd "$(dirname "$0")/.." && pwd)"; REPO="$(dirname "$S")"
for i in $(seq 1 60); do [ -f $S/vsl/v7.mp3 ] && ! pgrep -f render_vsl.py >/dev/null && break; sleep 5; done
python3 $S/vsl/make_data.py || exit 1
cd $S/film && npx remotion render src/index.ts Vsl out/vsl.mp4 ${PW_CHROMIUM:+--browser-executable=$PW_CHROMIUM} --concurrency=2 --codec=h264 --crf=20 2>&1 | tail -n 5
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
$FF -v error -y -i out/vsl.mp4 -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 96k $REPO/assets/film/vsl.mp4
$FF -v error -y -ss 2.2 -i out/vsl.mp4 -frames:v 1 -q:v 3 $REPO/assets/film/vsl-poster.jpg
ls -la $REPO/assets/film/vsl*
echo FILM_DONE
