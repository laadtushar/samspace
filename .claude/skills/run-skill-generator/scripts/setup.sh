#!/bin/bash
# setup.sh — one-time tools for the pipeline. Safe to run again.
#   ffmpeg/ffprobe  (system)       cutting, grading, loudness, audit
#   faster-whisper  (Python venv)  word-level transcription, offline
#   playwright      (repo or npx)  renders the motion layer and cards in Chromium
set -euo pipefail
VENV="${RSG_VENV:-$HOME/.cache/run-skill-generator/venv}"
command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null || { echo "Install ffmpeg first (apt-get install -y ffmpeg / brew install ffmpeg)"; exit 1; }
if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q --upgrade pip
  "$VENV/bin/pip" install -q faster-whisper numpy
fi
"$VENV/bin/python" -c "import faster_whisper, numpy; print('faster-whisper', faster_whisper.__version__)"
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
if node -e "require.resolve('playwright', {paths: ['$ROOT']})" 2>/dev/null; then
  echo "playwright: from $ROOT/node_modules"
else
  echo "playwright not in this repo — run: npm i -D playwright && npx playwright install chromium"
fi
echo "venv: $VENV"
