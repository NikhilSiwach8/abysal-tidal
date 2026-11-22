#!/usr/bin/env bash
# Encode art/audio/wav/*.wav (from tools/sound_design.py) to frontend/src/assets/audio/*.mp3
# and copy the loop manifest. Mono SFX at 96 kbps, stereo music/ambience at 128 kbps.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FF="${ROOT}/video/node_modules/@remotion/compositor-linux-x64-gnu"
SRC="${ROOT}/art/audio/wav"; DST="${ROOT}/frontend/src/assets/audio"
mkdir -p "${DST}"
for w in "${SRC}"/*.wav; do
  n="$(basename "${w}" .wav)"
  ch=$(LD_LIBRARY_PATH="${FF}" "${FF}/ffprobe" -v error -show_entries stream=channels -of csv=p=0 "${w}")
  br=96k; [ "${ch}" = "2" ] && br=128k
  LD_LIBRARY_PATH="${FF}" "${FF}/ffmpeg" -v error -y -i "${w}" -c:a libmp3lame -b:a "${br}" "${DST}/${n}.mp3"
done
cp "${ROOT}/art/audio/manifest.json" "${ROOT}/frontend/src/audio_manifest.json"
du -ch "${DST}"/*.mp3 | tail -1
