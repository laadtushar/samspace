#!/bin/bash
# compose_only.sh <project_dir> [reel ...]: re-composite existing overlay frames over rebuilt base videos.
P=$1; shift; D=$(dirname "$0")
reels=${*:-$(python3 -c "import json,sys;print(' '.join(json.load(open(sys.argv[1]))['reels']))" "$P/project.json")}
for r in $reels; do "$D/compose.sh" "$P" "$r" & done; wait
