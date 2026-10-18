#!/usr/bin/env bash
# Wandelt die echten Simulator-Aufnahmen (variable Bildrate, 1206 × 2622) in
# gleichmäßige 30-fps-Arbeitskopien in exakter Anzeigegröße (640 × 1392) um.
# Keine Zwischenbild-Berechnung: der fps-Filter wiederholt nur vorhandene Bilder.
# Die Schnittpunkte stehen in projekt/index.html (data-media-start/data-duration).
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=../app-store-neugestaltung-2026-10-14/serie/captures/de-DE/video
OUT=projekt/assets/clips
mkdir -p "$OUT"
for c in v1-mahlzeiten v2-eintrag v3-gemeinsam v4-schlaf-raw; do
  ffmpeg -hide_banner -loglevel error -y -i "$SRC/$c.mp4" \
    -vf "fps=30,scale=640:1392:flags=lanczos+accurate_rnd+full_chroma_int,setsar=1" \
    -an -c:v libx264 -preset slow -crf 8 -pix_fmt yuv420p -g 15 -movflags +faststart \
    "$OUT/$c.mp4"
  echo "$c: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/$c.mp4") s"
done
shasum -a 256 "$SRC"/v1-mahlzeiten.mp4 "$SRC"/v2-eintrag.mp4 "$SRC"/v3-gemeinsam.mp4 "$SRC"/v4-schlaf-raw.mp4 > "$OUT/quellen.sha256"
