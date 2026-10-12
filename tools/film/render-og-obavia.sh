#!/bin/sh
# Renders Obavia's share card (src/dash/films.tsx, ObaviaFilm compact, as the
# OgObavia composition) to out/og-obavia.png, then to assets/og-obavia.jpg.
# /assets/ is cached immutable for a year: a changed card ships under a new name.
# Run from tools/film: sh render-og-obavia.sh
set -e
B=${REMOTION_BROWSER:-/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell}
mkdir -p out
npx remotion still src/index.ts OgObavia out/og-obavia.png --frame 10 --browser-executable=$B --log=error
npx remotion ffmpeg -y -loglevel error -i out/og-obavia.png -q:v 3 out/og-obavia.jpg
echo "out/og-obavia.jpg written; copy it over ../../assets/og-obavia.jpg (or under a new name) when it should ship"
