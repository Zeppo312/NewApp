#!/usr/bin/env bash
# Erzeugt aus dem HyperFrames-Master die App-Store-Fassung nach Apple-Vorgaben
# (App Preview iPhone hochkant): 886 × 1920, 30 fps, H.264 High ≤ 4.0, 10–12 Mbit/s,
# AAC Stereo 256 kbit/s, 48 kHz. Musik auf ruhige −20 LUFS normalisiert.
# Benötigt ffmpeg mit macOS-AudioToolbox-Encoder (aac_at).
set -euo pipefail
cd "$(dirname "$0")/.."
MASTER=export/arbeit/render-master.mp4
SCORE=projekt/assets/audio/lotti-score.wav
OUT=export/lotti-baby-vorschau-motion-de.mp4
POSTER=export/lotti-baby-vorschau-motion-de-poster.png
POSTER_T=${POSTER_T:-2.9}
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$MASTER")

ffmpeg -hide_banner -loglevel error -y -i "$MASTER" -i "$SCORE" \
  -filter_complex "[0:v]fps=30,scale=886:1920:flags=lanczos,setsar=1,format=yuv420p[v];[1:a]loudnorm=I=-20:TP=-2:LRA=11,aresample=48000,aformat=channel_layouts=stereo[a]" \
  -map "[v]" -map "[a]" -t "$DUR" \
  -c:v libx264 -preset slow -profile:v high -level:v 4.0 -pix_fmt yuv420p \
  -b:v 10.5M -minrate 10.5M -maxrate 10.5M -bufsize 21M -x264-params nal-hrd=cbr:filler=1 \
  -g 30 -bf 2 -r 30 -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac_at -aac_at_mode cbr -b:a 256k -ar 48000 -ac 2 \
  -movflags +faststart "$OUT"

# Ausweichfassung mit stummer Stereospur (gleiches Bild), falls die Musik nicht gefällt.
ffmpeg -hide_banner -loglevel error -y -i "$OUT" -f lavfi -t "$DUR" -i anullsrc=channel_layout=stereo:sample_rate=48000 \
  -map 0:v -map 1:a -c:v copy -c:a aac_at -aac_at_mode cbr -b:a 256k -ar 48000 -ac 2 -t "$DUR" \
  -movflags +faststart "${OUT%.mp4}-ohne-musik.mp4"

ffmpeg -hide_banner -loglevel error -y -ss "$POSTER_T" -i "$OUT" -frames:v 1 "$POSTER"
ffprobe -v error -show_entries stream=codec_name,profile,level,width,height,r_frame_rate,avg_frame_rate,nb_frames,bit_rate,channels,sample_rate,pix_fmt:format=duration,size,bit_rate -of json "$OUT" > export/arbeit/technik.json
echo "$OUT"
