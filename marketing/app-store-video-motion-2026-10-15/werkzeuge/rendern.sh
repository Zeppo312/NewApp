#!/usr/bin/env bash
# Kompletter Renderlauf: Prüfung → HyperFrames-Master → App-Store-Export + Poster.
# Voraussetzung: Node ≥ 22, ffmpeg (mit aac_at), Netz für den ersten npx-Aufruf.
set -euo pipefail
cd "$(dirname "$0")/.."
export HYPERFRAMES_NO_TELEMETRY=1 DO_NOT_TRACK=1 HYPERFRAMES_SKIP_SKILLS=1
HF="npx --yes hyperframes@0.8.159"
mkdir -p export/arbeit
( cd projekt && $HF check )
( cd projekt && $HF render --quality delivery --fps 30 --video-frame-format png -o ../export/arbeit/render-master.mp4 )
./werkzeuge/store-export.sh
