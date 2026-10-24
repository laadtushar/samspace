#!/bin/bash
# compose.sh <project_dir> <reel>  ->  <project_dir>/out/<name>-<reel>.mp4 + -cover.jpg
set -euo pipefail
P=$1; r=$2; name=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['name'])" "$P/project.json")
mkdir -p "$P/out"
ffmpeg -v error -y -i "$P/$r.base.mp4" -framerate 30 -i "$P/frames/$r/%05d.png" \
  -filter_complex "[0:v][1:v]overlay=0:0:format=auto:shortest=1,format=yuv420p[v]" -map "[v]" -map 0:a \
  -c:v libx264 -preset slow -crf 20 -maxrate 12M -bufsize 24M -profile:v high -level 4.1 -r 30 \
  -c:a copy -movflags +faststart "$P/out/$name-$r.mp4"
hook=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['hook']['end']-0.15)" "$P/$r.timeline.json")
ffmpeg -v error -y -ss "$hook" -i "$P/out/$name-$r.mp4" -frames:v 1 -q:v 2 "$P/out/$name-$r-cover.jpg"
cp "$P/$r.en.srt" "$P/out/$name-$r.en.srt"; [ -f "$P/$r.hi.srt" ] && cp "$P/$r.hi.srt" "$P/out/$name-$r.hi.srt"
echo "composed $r"
