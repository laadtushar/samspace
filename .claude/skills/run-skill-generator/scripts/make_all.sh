#!/bin/bash
# make_all.sh <project_dir> [reel ...]: render + compose reels (two at a time), render cards, audit.
P=$1; shift; D=$(dirname "$0")
if [ $# -gt 0 ]; then reels="$*"; else
  reels=$(python3 -c "import json,sys;print(' '.join(json.load(open(sys.argv[1]))['reels']))" "$P/project.json"); fi
job() { for r in "$@"; do node "$D/render.mjs" "$P" "$r" && "$D/compose.sh" "$P" "$r" || echo "FAILED $r"; done; }
a=(); b=(); i=0
for r in $reels; do if (( i % 2 == 0 )); then a+=("$r"); else b+=("$r"); fi; i=$((i+1)); done
job "${a[@]}" > "$P/log-a.txt" 2>&1 &
[ ${#b[@]} -gt 0 ] && job "${b[@]}" > "$P/log-b.txt" 2>&1 &
wait
cat "$P/log-a.txt" "$P/log-b.txt" 2>/dev/null
if [ -f "$P/cards.json" ]; then node "$D/render_cards.mjs" "$P"; fi
python3 "$D/audit.py" "$P"
