#!/usr/bin/env bash
# Generates a gentle ambient chord progression for flow videos.
# Replace assets/music/background.mp3 with any royalty-free MP3 you prefer.
set -euo pipefail

OUT="${1:-assets/music/background.mp3}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

generate_chord() {
  local f1="$1" f2="$2" f3="$3" dur="$4" out="$5"
  local fade_out=$((dur - 2))
  ffmpeg -loglevel error -y \
    -f lavfi -i "sine=frequency=${f1}:duration=${dur}" \
    -f lavfi -i "sine=frequency=${f2}:duration=${dur}" \
    -f lavfi -i "sine=frequency=${f3}:duration=${dur}" \
    -filter_complex "\
      [0:a]volume=0.09[a0];\
      [1:a]volume=0.07[a1];\
      [2:a]volume=0.055[a2];\
      [a0][a1][a2]amix=inputs=3:duration=longest,\
      afade=t=in:st=0:d=2,afade=t=out:st=${fade_out}:d=2" \
    "$out"
}

mkdir -p "$(dirname "$OUT")"

# C → Am → F → G (~2 min loop)
generate_chord 261.63 329.63 392.00 32 "$TMP/01-c.mp3"
generate_chord 220.00 261.63 329.63 32 "$TMP/02-am.mp3"
generate_chord 174.61 220.00 261.63 32 "$TMP/03-f.mp3"
generate_chord 196.00 246.94 293.66 32 "$TMP/04-g.mp3"

ffmpeg -loglevel error -y \
  -i "$TMP/01-c.mp3" -i "$TMP/02-am.mp3" -i "$TMP/03-f.mp3" -i "$TMP/04-g.mp3" \
  -filter_complex "\
    [0][1]acrossfade=d=3:c1=tri:c2=tri[a01];\
    [a01][2]acrossfade=d=3:c1=tri:c2=tri[a012];\
    [a012][3]acrossfade=d=3:c1=tri:c2=tri,\
    loudnorm=I=-18:TP=-1.5:LRA=11" \
  "$OUT"

echo "Generated → $OUT"
