#!/bin/sh
# Renders the dash films into assets/film and the share cards into assets.
# Run from tools/film: sh render-dash.sh
set -e
B=${REMOTION_BROWSER:-/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell}
A=../../assets/film
# the desk film crops the Handle a Sale screen out of the existing loop
mkdir -p public/vid && cp $A/loop-sale.mp4 public/vid/loop-sale.mp4
for id in DashDesk:dash-desk DashRecord:dash-record DashObavia:dash-obavia DashLot:dash-lot DashCut:dash-cut; do
  c=${id%%:*}; f=${id##*:}
  npx remotion render src/index.ts $c $A/$f.mp4 --codec h264 --crf 23 --muted --browser-executable=$B --log=error
  npx remotion still src/index.ts $c out/$f-poster.png --frame 200 --browser-executable=$B --log=error
done
npx remotion still src/index.ts OgHome out/og-home.png --frame 89 --browser-executable=$B --log=error
npx remotion still src/index.ts OgObavia out/og-obavia.png --frame 10 --browser-executable=$B --log=error
echo DONE
